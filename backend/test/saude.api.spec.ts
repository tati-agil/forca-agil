import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarAplicacao } from '../src/aplicacao';
import { VERIFICADOR_BANCO, VerificacaoBanco } from '../src/modulos/saude/aplicacao/portas';

/* A API inteira (mesmos módulos, prefixo e filtro de erros), com a porta do banco substituída por um dublê:
   prova que a API não depende do adaptador PostgreSQL para responder e que trata o banco indisponível. */
const CONFIG = { porta: 0, banco: { host: 'nao-usado', porta: 5432, banco: 'x', usuario: 'x', senha: 'senha-que-nao-pode-vazar', timeoutMs: 200 }, firebase: { projetoId: null } };

describe('API de saúde', () => {
  let app: INestApplication;
  let resposta: VerificacaoBanco = { disponivel: true, latenciaMs: 3 };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule.com(CONFIG)] })
      .overrideProvider(VERIFICADOR_BANCO).useValue({ verificar: async () => resposta })
      .compile();
    app = modulo.createNestApplication({ logger: false });
    configurarAplicacao(app);
    await app.init();
  });
  afterAll(async () => { await app.close(); });

  it('GET /api/saude responde sem consultar o banco', async () => {
    const r = await request(app.getHttpServer()).get('/api/saude').expect(200);
    expect(r.body).toEqual({ status: 'ok', servico: 'forca-agil-backend' });
  });

  it('GET /api/saude/banco: 200 com o banco disponível', async () => {
    resposta = { disponivel: true, latenciaMs: 3 };
    const r = await request(app.getHttpServer()).get('/api/saude/banco').expect(200);
    expect(r.body).toEqual({ status: 'ok', banco: 'disponivel', latenciaMs: 3 });
  });

  it('GET /api/saude/banco: 503 com o banco indisponível, sem detalhes de conexão', async () => {
    resposta = { disponivel: false, motivo: 'CONEXAO_RECUSADA' };
    const r = await request(app.getHttpServer()).get('/api/saude/banco').expect(503);
    expect(r.body).toEqual({ status: 'indisponivel', banco: 'indisponivel', motivo: 'CONEXAO_RECUSADA' });
    expect(JSON.stringify(r.body)).not.toMatch(/senha-que-nao-pode-vazar|nao-usado/);
  });

  it('rota inexistente: 404 no formato padrão de erro', async () => {
    const r = await request(app.getHttpServer()).get('/api/nada').expect(404);
    expect(r.body.erro.status).toBe(404);
  });

  it('rotas de negócio não respondem sem identidade; Avaliações, Taxonomia e Mapa não existem no backend', async () => {
    const r = await request(app.getHttpServer()).get('/api/estruturas').expect(401);
    expect(r.body.erro.codigo).toBe('NAO_AUTENTICADO');
    for (const rota of ['/api/avaliacoes', '/api/taxonomia', '/api/mapa']) {
      await request(app.getHttpServer()).get(rota).expect(404);
    }
  });
});
