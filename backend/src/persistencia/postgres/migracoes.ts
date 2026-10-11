import { createHash } from 'crypto';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import type { Pool } from 'pg';

/* Migrações versionadas do esquema: arquivos SQL em backend/migracoes, nomeados NNNN_descricao.sql, aplicados em
   ordem, cada um na sua transação, e registrados em schema_migracoes com o checksum. Uma migração já aplicada não
   pode mudar (checksum diferente = erro): corrigir é criar a próxima. Duas execuções simultâneas não aplicam nada
   duas vezes (trava consultiva do PostgreSQL). */
const NOME_VALIDO = /^(\d{4})_[a-z0-9_]+\.sql$/;
const TRAVA = 726173; /* identificador fixo da trava consultiva das migrações */

export interface ResultadoMigracoes {
  aplicadas: string[];
  jaAplicadas: string[];
}

export function listarMigracoes(dir: string): { nome: string; versao: string; sql: string; checksum: string }[] {
  const arquivos = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  return arquivos.map((nome) => {
    const m = NOME_VALIDO.exec(nome);
    if (!m) throw new Error(`Nome de migração inválido: ${nome} (use NNNN_descricao.sql)`);
    const sql = readFileSync(join(dir, nome), 'utf8');
    return { nome, versao: m[1], sql, checksum: createHash('sha256').update(sql).digest('hex') };
  });
}

export async function aplicarMigracoes(pool: Pool, dir: string): Promise<ResultadoMigracoes> {
  const migracoes = listarMigracoes(dir);
  const versoes = new Set<string>();
  migracoes.forEach((m) => {
    if (versoes.has(m.versao)) throw new Error(`Versão de migração repetida: ${m.versao}`);
    versoes.add(m.versao);
  });
  const cliente = await pool.connect();
  const resultado: ResultadoMigracoes = { aplicadas: [], jaAplicadas: [] };
  try {
    await cliente.query('SELECT pg_advisory_lock($1)', [TRAVA]);
    await cliente.query(`CREATE TABLE IF NOT EXISTS schema_migracoes (
      versao text PRIMARY KEY, nome text NOT NULL, checksum text NOT NULL, aplicada_em timestamptz NOT NULL DEFAULT now())`);
    const { rows } = await cliente.query<{ versao: string; nome: string; checksum: string }>('SELECT versao, nome, checksum FROM schema_migracoes');
    const aplicadas = new Map(rows.map((r) => [r.versao, r]));
    for (const m of migracoes) {
      const ja = aplicadas.get(m.versao);
      if (ja) {
        if (ja.checksum !== m.checksum) throw new Error(`A migração ${m.nome} já aplicada foi alterada. Crie uma nova migração em vez de editar esta.`);
        resultado.jaAplicadas.push(m.nome);
        continue;
      }
      await cliente.query('BEGIN');
      try {
        await cliente.query(m.sql);
        await cliente.query('INSERT INTO schema_migracoes (versao, nome, checksum) VALUES ($1, $2, $3)', [m.versao, m.nome, m.checksum]);
        await cliente.query('COMMIT');
        resultado.aplicadas.push(m.nome);
      } catch (e) {
        await cliente.query('ROLLBACK').catch(() => undefined);
        throw new Error(`Falha ao aplicar ${m.nome}: ${(e as Error).message}`);
      }
    }
    return resultado;
  } finally {
    await cliente.query('SELECT pg_advisory_unlock($1)', [TRAVA]).catch(() => undefined);
    cliente.release();
  }
}
