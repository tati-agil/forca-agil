import { join } from 'path';
import { Pool } from 'pg';
import request from 'supertest';
import { lerConfiguracao } from '../../src/configuracao/configuracao';
import { aplicarMigracoes } from '../../src/persistencia/postgres/migracoes';
import { montarAppDeTeste } from './app-de-teste';

/* 8. Reiniciar os contêineres sem perder os registros. Roda em DUAS fases, separadas por um reinício real
   (scripts/demonstrar-reinicio.js: restart + down/up dos contêineres, mantendo o volume):
     FASE_REINICIO=gravar   → grava estruturas, relação, alteração e vínculo SINTÉTICOS pela API, num schema próprio;
     FASE_REINICIO=conferir → depois do reinício, lê tudo de novo pela API (com histórico) e apaga o schema.
   Sem FASE_REINICIO, não roda (é parte da demonstração, não da suíte comum). */
const FASE = process.env.FASE_REINICIO;
const SCHEMA = 'demonstracao_reinicio';
const NOMES = { neg: 'Demonstração — Negócios (sintética)', squad: 'Demonstração — Squad (sintética)' };
const OBJETO = 'objeto-sint-demonstracao';

(FASE ? describe : describe.skip)('8. registros sobrevivem ao reinício dos contêineres (fase: ' + FASE + ')', () => {
  const configuracao = lerConfiguracao();
  const conexao = { host: configuracao.banco.host, port: configuracao.banco.porta, database: configuracao.banco.banco, user: configuracao.banco.usuario, password: configuracao.banco.senha };
  let admin: Pool, pool: Pool, t: Awaited<ReturnType<typeof montarAppDeTeste>>;

  beforeAll(async () => {
    admin = new Pool(conexao);
    if (FASE === 'gravar') { await admin.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`); await admin.query(`CREATE SCHEMA ${SCHEMA}`); }
    pool = new Pool({ ...conexao, options: `-c search_path=${SCHEMA}` });
    if (FASE === 'gravar') await aplicarMigracoes(pool, join(__dirname, '..', '..', 'migracoes'));
    t = await montarAppDeTeste(configuracao, pool);
    t.posicionamento.vigentes[OBJETO] = { avaliacaoId: 'aval-sint-demonstracao', recomendacao: { codigoResultado: 'NEGOCIOS' } };
  });
  afterAll(async () => {
    await t?.app.close();
    if (FASE === 'conferir') await admin.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await admin.end();
  });

  if (!FASE) it('só roda dentro de npm run demonstrar:reinicio (com um reinício real entre as fases)', () => undefined);

  if (FASE === 'gravar') {
    it('grava pela API: duas estruturas, uma alteração, uma relação e um responsável principal', async () => {
      const api = () => request(t.app.getHttpServer());
      const neg = (await api().post('/api/estruturas').set('Authorization', t.auth.arquitetura).send({ tipo: 'SINT_NEGOCIOS', nome: 'Antes do reinício' }).expect(201)).body.estrutura;
      await api().patch('/api/estruturas/' + neg.id).set('Authorization', t.auth.arquitetura).send({ nome: NOMES.neg, revisaoEsperada: 1 }).expect(200);
      const squad = (await api().post('/api/estruturas').set('Authorization', t.auth.arquitetura).send({ tipo: 'SINT_SQUAD', nome: NOMES.squad }).expect(201)).body.estrutura;
      await api().post('/api/relacoes').set('Authorization', t.auth.arquitetura).send({ origem: squad.id, tipo: 'compoe', destino: neg.id }).expect(201);
      await api().post(`/api/objetos/${OBJETO}/responsavel`).set('Authorization', t.auth.arquitetura).send({ estruturaId: neg.id }).expect(201);
    });
  }

  if (FASE === 'conferir') {
    it('depois do reinício: as estruturas, a relação, o vínculo e os históricos continuam lá', async () => {
      const api = () => request(t.app.getHttpServer());
      const lista = (await api().get('/api/estruturas').set('Authorization', t.auth.consulta).expect(200)).body;
      expect(lista.map((e: { nome: string }) => e.nome).sort()).toEqual([NOMES.neg, NOMES.squad].sort());
      const neg = lista.find((e: { nome: string }) => e.nome === NOMES.neg);
      expect(neg).toMatchObject({ tipo: 'SINT_NEGOCIOS', revisao: 2, situacao: 'ativa' });
      const det = (await api().get('/api/estruturas/' + neg.id).set('Authorization', t.auth.consulta).expect(200)).body;
      expect(det.relacoes.entrada).toEqual([expect.objectContaining({ tipo: 'compoe', situacao: 'ativa' })]);
      expect(det.objetos).toEqual([expect.objectContaining({ objetoId: OBJETO, papel: 'responsavel-principal' })]);
      const h = (await api().get(`/api/estruturas/${neg.id}/historico`).set('Authorization', t.auth.consulta).expect(200)).body.eventos;
      expect(h.map((e: { tipo: string }) => e.tipo)).toEqual(['estrutura.criada', 'estrutura.alterada']);
      expect((await api().get(`/api/objetos/${OBJETO}/responsavel`).set('Authorization', t.auth.consulta).expect(200)).body.situacao).toBe('valido');
    });
  }
});
