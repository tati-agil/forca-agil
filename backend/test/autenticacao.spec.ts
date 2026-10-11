import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SignJWT } from 'jose';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarAplicacao } from '../src/aplicacao';
import { FONTE_PERFIS } from '../src/compartilhado/autenticacao/perfis';
import { AutenticacaoIndisponivel, IdentidadeInvalida, VERIFICADOR_IDENTIDADE } from '../src/compartilhado/autenticacao/verificador-identidade';
import { VerificadorIdentidadeFirebase } from '../src/compartilhado/autenticacao/verificador-identidade-firebase';
import { REPOSITORIO_ESTRUTURAS } from '../src/persistencia/contratos/repositorio-estruturas';
import { UNIDADE_DE_TRABALHO } from '../src/persistencia/contratos/unidade-de-trabalho';
import { EMAILS, EmissorSintetico, PerfisSinteticos, PROJETO_SINTETICO } from './sinteticos';

/* Identidade Firebase + perfis oficiais. Sem rede e sem banco: chaves geradas aqui, repositório dublê. */
const CONFIG = { porta: 0, banco: { host: 'nao-usado', porta: 5432, banco: 'x', usuario: 'x', senha: 'x', timeoutMs: 200 }, firebase: { projetoId: null } };

describe('verificação do ID token do Firebase', () => {
  let emissor: EmissorSintetico;
  beforeAll(async () => { emissor = await EmissorSintetico.criar(); });

  it('aceita um token válido do projeto e devolve a identidade do token', async () => {
    const i = await emissor.verificador().verificar(await emissor.token('Pessoa@Sintetico.invalid', { uid: 'uid-123' }));
    expect(i).toEqual({ uid: 'uid-123', email: 'pessoa@sintetico.invalid', emailVerificado: true });
  });

  it('recusa token de outro projeto, de outro emissor, expirado, com login futuro, sem e-mail, ou assinado por outra chave', async () => {
    const v = emissor.verificador();
    const outro = await EmissorSintetico.criar('chave-sintetica'); /* mesmo kid, outra chave */
    const casos = [
      await emissor.token(EMAILS.admin, { projeto: 'outro-projeto' }),
      await emissor.token(EMAILS.admin, { emissor: 'https://securetoken.google.com/outro-projeto' }),
      await emissor.token(EMAILS.admin, { expiraEm: Math.floor(Date.now() / 1000) - 60 }),
      await emissor.token(EMAILS.admin, { authTime: Math.floor(Date.now() / 1000) + 3600 }),
      await emissor.token(EMAILS.admin, { semEmail: true }),
      await outro.token(EMAILS.admin),
      'nao-e-um-jwt'
    ];
    for (const t of casos) await expect(v.verificar(t)).rejects.toBeInstanceOf(IdentidadeInvalida);
  });

  it('recusa algoritmo diferente de RS256 (ex.: HS256 com chave conhecida)', async () => {
    const hs = await new SignJWT({ email: EMAILS.admin, auth_time: 1 }).setProtectedHeader({ alg: 'HS256', kid: 'chave-sintetica' })
      .setSubject('x').setAudience(PROJETO_SINTETICO).setIssuer('https://securetoken.google.com/' + PROJETO_SINTETICO).setIssuedAt().setExpirationTime('1h')
      .sign(new TextEncoder().encode('segredo-sintetico-qualquer-com-32-bytes!'));
    await expect(emissor.verificador().verificar(hs)).rejects.toBeInstanceOf(IdentidadeInvalida);
  });

  it('chaves públicas inalcançáveis: indisponível (nunca aceita)', async () => {
    const v = new VerificadorIdentidadeFirebase(PROJETO_SINTETICO, async () => { throw new TypeError('fetch failed'); });
    await expect(v.verificar(await emissor.token(EMAILS.admin))).rejects.toBeInstanceOf(AutenticacaoIndisponivel);
  });
});

describe('guarda de acesso nas rotas de negócio', () => {
  let emissor: EmissorSintetico;
  const gravados: unknown[] = [];
  const montar = async (comIdentidade: boolean, comPerfis: boolean) => {
    let m = Test.createTestingModule({ imports: [AppModule.com(CONFIG)] })
      .overrideProvider(UNIDADE_DE_TRABALHO).useValue({ executar: (t: (sql: unknown) => unknown) => t({}) })
      .overrideProvider(REPOSITORIO_ESTRUTURAS).useValue({
        lerEstado: async () => ({ estruturas: {}, relacoes: {}, vinculos: {} }), eventosDe: async () => [], operacaoPorChave: async () => null,
        gravar: async (...a: unknown[]) => { gravados.push(a); }
      });
    if (comIdentidade) m = m.overrideProvider(VERIFICADOR_IDENTIDADE).useValue(emissor.verificador());
    if (comPerfis) m = m.overrideProvider(FONTE_PERFIS).useValue(new PerfisSinteticos());
    const app = (await m.compile()).createNestApplication({ logger: false });
    configurarAplicacao(app);
    await app.init();
    return app;
  };
  let app: INestApplication;
  beforeAll(async () => { emissor = await EmissorSintetico.criar(); app = await montar(true, true); });
  afterAll(async () => { await app.close(); });
  const como = async (email: string) => ({ Authorization: 'Bearer ' + (await emissor.token(email)) });

  it('sem token: 401; token inválido: 401', async () => {
    expect((await request(app.getHttpServer()).get('/api/estruturas').expect(401)).body.erro.codigo).toBe('NAO_AUTENTICADO');
    expect((await request(app.getHttpServer()).get('/api/estruturas').set('Authorization', 'Bearer x.y.z').expect(401)).body.erro.codigo).toBe('IDENTIDADE_INVALIDA');
  });

  it('perfil Avaliação consulta, mas não mantém; sem perfil, nem consulta', async () => {
    await request(app.getHttpServer()).get('/api/estruturas').set(await como(EMAILS.consulta)).expect(200, []);
    const r = await request(app.getHttpServer()).post('/api/estruturas').set(await como(EMAILS.consulta)).send({ tipo: 'SINT_NEGOCIOS', nome: 'X' }).expect(403);
    expect(r.body.erro.codigo).toBe('SEM_PERMISSAO');
    await request(app.getHttpServer()).get('/api/estruturas').set(await como(EMAILS.semPerfil)).expect(403);
    expect(gravados).toEqual([]);
  });

  it('Avaliação + Arquitetura mantém, mas sem a Taxonomia oficial a operação é recusada (503) e nada é gravado', async () => {
    const r = await request(app.getHttpServer()).post('/api/estruturas').set(await como(EMAILS.arquitetura)).send({ tipo: 'SINT_NEGOCIOS', nome: 'X' }).expect(503);
    expect(r.body.erro).toMatchObject({ codigo: 'REFERENCIA_OFICIAL_INDISPONIVEL', fonte: 'taxonomia' });
    expect(gravados).toEqual([]);
  });

  it('o usuário vem só do token: campos de identidade, id ou situação no corpo são recusados', async () => {
    for (const extra of [{ usuario: { id: 'outro' } }, { id: 'escolhido' }, { situacao: 'encerrada' }, { criadaPor: 'x' }]) {
      const r = await request(app.getHttpServer()).post('/api/estruturas').set(await como(EMAILS.admin)).send({ tipo: 'SINT_NEGOCIOS', nome: 'X', ...extra }).expect(400);
      expect(r.body.erro.codigo).toBe('CAMPO_DESCONHECIDO');
    }
  });

  it('configuração padrão (sem FIREBASE_PROJECT_ID e sem fonte de perfis): tudo recusado com 503, nunca liberado', async () => {
    const padrao = await montar(false, false);
    const r = await request(padrao.getHttpServer()).get('/api/estruturas').set(await como(EMAILS.admin)).expect(503);
    expect(r.body.erro.codigo).toBe('AUTENTICACAO_NAO_CONFIGURADA');
    await padrao.close();
    const semPerfis = await montar(true, false);
    expect((await request(semPerfis.getHttpServer()).get('/api/estruturas').set(await como(EMAILS.admin)).expect(503)).body.erro.codigo).toBe('PERFIS_INDISPONIVEIS');
    await semPerfis.close();
  });
});
