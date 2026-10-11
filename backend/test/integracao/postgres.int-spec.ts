import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Pool } from 'pg';
import { lerConfiguracao } from '../../src/configuracao/configuracao';
import { aplicarMigracoes } from '../../src/persistencia/postgres/migracoes';
import { UnidadeDeTrabalhoPostgres } from '../../src/persistencia/postgres/unidade-de-trabalho-postgres';
import { VerificadorBancoPostgres } from '../../src/persistencia/postgres/verificador-banco-postgres';

/* Integração com um PostgreSQL REAL, apontado pelas mesmas variáveis POSTGRES_* da aplicação.
   Tudo acontece num schema temporário próprio, apagado no fim; nenhum dado real. */
const configuracao = lerConfiguracao();
const SCHEMA = 'teste_' + process.pid + '_' + Date.now();
let pool: Pool;

beforeAll(async () => {
  const admin = new Pool({ host: configuracao.banco.host, port: configuracao.banco.porta, database: configuracao.banco.banco, user: configuracao.banco.usuario, password: configuracao.banco.senha });
  await admin.query(`CREATE SCHEMA ${SCHEMA}`);
  await admin.end();
  pool = new Pool({ host: configuracao.banco.host, port: configuracao.banco.porta, database: configuracao.banco.banco, user: configuracao.banco.usuario, password: configuracao.banco.senha, options: `-c search_path=${SCHEMA}`, max: 10 });
});
afterAll(async () => {
  await pool.query(`DROP SCHEMA ${SCHEMA} CASCADE`);
  await pool.end();
});

describe('PostgreSQL real', () => {
  it('verificação de disponibilidade: disponível', async () => {
    const v = await new VerificadorBancoPostgres(pool, configuracao).verificar();
    expect(v.disponivel).toBe(true);
  });

  it('verificação de disponibilidade: senha errada e porta sem banco são identificadas, sem detalhes', async () => {
    const errada = new Pool({ ...{ host: configuracao.banco.host, port: configuracao.banco.porta, database: configuracao.banco.banco, user: configuracao.banco.usuario }, password: 'senha-errada-sintetica' });
    const fechada = new Pool({ host: '127.0.0.1', port: 1, database: 'x', user: 'x', password: 'x' });
    const a = await new VerificadorBancoPostgres(errada, configuracao).verificar();
    const b = await new VerificadorBancoPostgres(fechada, configuracao).verificar();
    await errada.end(); await fechada.end();
    expect(a).toEqual({ disponivel: false, motivo: 'AUTENTICACAO' });
    expect(b).toEqual({ disponivel: false, motivo: 'CONEXAO_RECUSADA' });
  });

  it('migrações: aplica em ordem, não repete, recusa migração alterada', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'migr-'));
    writeFileSync(join(dir, '0001_um.sql'), 'CREATE TABLE exemplo_um (id int PRIMARY KEY);');
    writeFileSync(join(dir, '0002_dois.sql'), 'ALTER TABLE exemplo_um ADD COLUMN nome text;');
    expect(await aplicarMigracoes(pool, dir)).toEqual({ aplicadas: ['0001_um.sql', '0002_dois.sql'], jaAplicadas: [] });
    expect(await aplicarMigracoes(pool, dir)).toEqual({ aplicadas: [], jaAplicadas: ['0001_um.sql', '0002_dois.sql'] });
    writeFileSync(join(dir, '0002_dois.sql'), 'ALTER TABLE exemplo_um ADD COLUMN outro text;');
    await expect(aplicarMigracoes(pool, dir)).rejects.toThrow(/já aplicada foi alterada/);
  });

  it('migrações: uma migração com erro não deixa nada pela metade', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'migr-'));
    writeFileSync(join(dir, '0003_a.sql'), 'CREATE TABLE exemplo_a (id int); CREATE TABLE exemplo_a (id int);');
    await expect(aplicarMigracoes(pool, dir)).rejects.toThrow(/Falha ao aplicar 0003_a.sql/);
    const { rows } = await pool.query("SELECT to_regclass('exemplo_a') AS t");
    expect(rows[0].t).toBeNull();
  });

  it('unidade de trabalho: erro desfaz tudo', async () => {
    await pool.query('CREATE TABLE exemplo_uow (id int PRIMARY KEY)');
    const uow = new UnidadeDeTrabalhoPostgres(pool);
    await expect(uow.executar(async (sql) => {
      await sql.consultar('INSERT INTO exemplo_uow VALUES (1)');
      throw new Error('falha no meio');
    })).rejects.toThrow('falha no meio');
    expect((await pool.query('SELECT count(*)::int AS n FROM exemplo_uow')).rows[0].n).toBe(0);
  });

  it('unidade de trabalho: invariante entre registros sob concorrência (um responsável principal ativo por objeto)', async () => {
    /* Sem restrição única no banco: só o isolamento da unidade de trabalho segura o invariante "ler e depois gravar". */
    await pool.query('CREATE TABLE exemplo_vinculo (id text PRIMARY KEY, objeto text NOT NULL, ativo boolean NOT NULL)');
    const uow = new UnidadeDeTrabalhoPostgres(pool);
    const tentar = (id: string) => uow.executar(async (sql) => {
      const ativos = await sql.consultar('SELECT id FROM exemplo_vinculo WHERE objeto = $1 AND ativo', ['obj-1']);
      await new Promise((r) => setTimeout(r, 50)); /* as duas leem antes de qualquer uma gravar */
      if (ativos.length) return 'recusada: já existe responsável';
      await sql.consultar('INSERT INTO exemplo_vinculo VALUES ($1, $2, true)', [id, 'obj-1']);
      return 'criada';
    });
    const resultados = await Promise.all(Array.from({ length: 6 }, (_, i) => tentar('v' + i)));
    expect(resultados.filter((r) => r === 'criada')).toHaveLength(1);
    expect((await pool.query("SELECT count(*)::int AS n FROM exemplo_vinculo WHERE objeto = 'obj-1' AND ativo")).rows[0].n).toBe(1);
  });
});
