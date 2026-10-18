import { INestApplication } from '@nestjs/common';
import { join } from 'path';
import { Pool } from 'pg';
import request from 'supertest';
import { lerConfiguracao } from '../../src/configuracao/configuracao';
import { aplicarMigracoes } from '../../src/persistencia/postgres/migracoes';
import { RepositorioEstruturasPostgres } from '../../src/persistencia/postgres/repositorio-estruturas-postgres';
import { UnidadeDeTrabalhoPostgres } from '../../src/persistencia/postgres/unidade-de-trabalho-postgres';
import { EMAILS, PosicionamentoSintetico, TaxonomiaSintetica } from '../sinteticos';
import { montarAppDeTeste } from './app-de-teste';

/* Estruturas Organizacionais Concretas DE PONTA A PONTA: a aplicação inteira (app-de-teste.ts) contra um PostgreSQL
   REAL, com as migrações versionadas aplicadas num schema próprio, apagado no fim. Dados sintéticos (sinteticos.ts). */
const configuracao = lerConfiguracao();
const SCHEMA = 'teste_estruturas_' + process.pid + '_' + Date.now();
const conexao = { host: configuracao.banco.host, port: configuracao.banco.porta, database: configuracao.banco.banco, user: configuracao.banco.usuario, password: configuracao.banco.senha };

let app: INestApplication, pool: Pool, admin: Pool;
let taxonomia: TaxonomiaSintetica, posicionamento: PosicionamentoSintetico, auth: Record<string, string>;

beforeAll(async () => {
  admin = new Pool(conexao);
  await admin.query(`CREATE SCHEMA ${SCHEMA}`);
  pool = new Pool({ ...conexao, options: `-c search_path=${SCHEMA}`, max: 12 });
  await aplicarMigracoes(pool, join(__dirname, '..', '..', 'migracoes'));
  ({ app, taxonomia, posicionamento, auth } = await montarAppDeTeste(configuracao, pool));
});
afterAll(async () => {
  await app?.close(); /* encerra também o pool do schema */
  await admin.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
  await admin.end();
});

const api = () => request(app.getHttpServer());
const sql = async (texto: string, p: unknown[] = []) => (await pool.query(texto, p)).rows;
const contar = async (tabela: string) => Number((await sql(`SELECT count(*)::int AS n FROM ${tabela}`))[0].n);
const codigos = (r: request.Response) => (r.body.erro?.erros || []).map((e: { codigo: string }) => e.codigo);
const criar = async (tipo: string, nome: string, extra: Record<string, unknown> = {}) =>
  (await api().post('/api/estruturas').set('Authorization', auth.arquitetura).send({ tipo, nome, ...extra }).expect(201)).body.estrutura;
const relacionar = (origem: string, tipo: string, destino: string) => api().post('/api/relacoes').set('Authorization', auth.arquitetura).send({ origem, tipo, destino });

describe('1–2. estrutura: criar, recuperar do PostgreSQL, alterar com histórico', () => {
  it('cria, recupera pela API e está gravada no banco exatamente como o núcleo produziu', async () => {
    const e = await criar('SINT_NEGOCIOS', 'Negócios A (sintética)', { sigla: 'NA', descricao: 'Exemplo sintético' });
    expect(e).toMatchObject({ tipo: 'SINT_NEGOCIOS', nome: 'Negócios A (sintética)', sigla: 'NA', situacao: 'ativa', revisao: 1, criadaPor: { id: 'uid-arquitetura', email: EMAILS.arquitetura } });
    expect((await api().get('/api/estruturas/' + e.id).set('Authorization', auth.consulta).expect(200)).body.estrutura).toEqual(e);
    const [linha] = await sql('SELECT tipo, nome, situacao, revisao, dados FROM estruturas WHERE id = $1', [e.id]);
    expect(linha).toEqual({ tipo: 'SINT_NEGOCIOS', nome: 'Negócios A (sintética)', situacao: 'ativa', revisao: 1, dados: e });
  });

  it('altera nome/sigla com revisão esperada, registra antes/depois/campos/autor, e recusa revisão velha e troca de tipo', async () => {
    const e = await criar('SINT_NEGOCIOS', 'Negócios B (sintética)');
    const r = await api().patch('/api/estruturas/' + e.id).set('Authorization', auth.admin).send({ nome: 'Negócios B renomeada (sintética)', sigla: 'NB', revisaoEsperada: 1, justificativa: 'ajuste sintético' }).expect(200);
    expect(r.body.estrutura).toMatchObject({ nome: 'Negócios B renomeada (sintética)', sigla: 'NB', revisao: 2, alteradaPor: { id: 'uid-admin-geral' } });
    const velha = await api().patch('/api/estruturas/' + e.id).set('Authorization', auth.admin).send({ nome: 'Outra', revisaoEsperada: 1 }).expect(409);
    expect(codigos(velha)).toEqual(['REVISAO_DESATUALIZADA']);
    expect(codigos(await api().patch('/api/estruturas/' + e.id).set('Authorization', auth.admin).send({ tipo: 'SINT_COE' }).expect(422))).toEqual(['TIPO_IMUTAVEL']);
    const h = (await api().get('/api/estruturas/' + e.id + '/historico').set('Authorization', auth.consulta).expect(200)).body.eventos;
    expect(h.map((x: { tipo: string }) => x.tipo)).toEqual(['estrutura.criada', 'estrutura.alterada']);
    expect(h[1]).toMatchObject({ campos: ['nome', 'sigla'], justificativa: 'ajuste sintético', antes: { nome: 'Negócios B (sintética)', revisao: 1 }, depois: { revisao: 2 }, usuario: { id: 'uid-admin-geral' } });
  });

  it('tipo fora da Taxonomia oficial, conceito inativo e nome vazio são recusados sem gravar nada', async () => {
    const antes = await contar('estruturas_eventos');
    expect(codigos(await api().post('/api/estruturas').set('Authorization', auth.arquitetura).send({ tipo: 'SINT_QUALQUER', nome: 'X' }).expect(422))).toEqual(['TIPO_NAO_ADMITIDO']);
    expect(codigos(await api().post('/api/estruturas').set('Authorization', auth.arquitetura).send({ tipo: 'SINT_INATIVO', nome: 'X' }).expect(422))).toEqual(['CONCEITO_INATIVO_OU_INEXISTENTE']);
    expect(codigos(await api().post('/api/estruturas').set('Authorization', auth.arquitetura).send({ tipo: 'SINT_NEGOCIOS', nome: ' ' }).expect(422))).toEqual(['CAMPO_OBRIGATORIO']);
    expect(await contar('estruturas_eventos')).toBe(antes);
  });

  it('encerrar exige motivo; encerrada não muda nem reativa; aparece só no filtro de encerradas', async () => {
    const e = await criar('SINT_COE', 'CoE a encerrar (sintética)');
    expect(codigos(await api().post(`/api/estruturas/${e.id}/encerramento`).set('Authorization', auth.arquitetura).send({}).expect(422))).toEqual(['MOTIVO_OBRIGATORIO']);
    const r = await api().post(`/api/estruturas/${e.id}/encerramento`).set('Authorization', auth.arquitetura).send({ motivo: 'encerramento sintético' }).expect(200);
    expect(r.body.estrutura).toMatchObject({ situacao: 'encerrada', revisao: 2, encerramento: { motivo: 'encerramento sintético', por: { id: 'uid-arquitetura' } } });
    expect(codigos(await api().patch('/api/estruturas/' + e.id).set('Authorization', auth.arquitetura).send({ nome: 'volta' }).expect(422))).toEqual(['ESTRUTURA_ENCERRADA']);
    const ativas = (await api().get('/api/estruturas').set('Authorization', auth.consulta).expect(200)).body.map((x: { id: string }) => x.id);
    const encerradas = (await api().get('/api/estruturas?situacao=encerrada').set('Authorization', auth.consulta).expect(200)).body.map((x: { id: string }) => x.id);
    expect(ativas).not.toContain(e.id);
    expect(encerradas).toEqual([e.id]);
  });
});

describe('3–4. relações: criar entre estruturas e recusar as inválidas', () => {
  it('Squad compõe Negócios e Capítulo aloca em Squad (Squad e Capítulo são estruturas concretas)', async () => {
    const neg = await criar('SINT_NEGOCIOS', 'Negócios C (sintética)');
    const squad = await criar('SINT_SQUAD', 'Squad 1 (sintética)');
    const cap = await criar('SINT_CAPITULO', 'Capítulo 1 (sintético)');
    const r1 = (await relacionar(squad.id, 'compoe', neg.id).expect(201)).body.relacao;
    await relacionar(cap.id, 'aloca-em', squad.id).expect(201);
    expect(r1).toMatchObject({ origem: squad.id, tipo: 'compoe', destino: neg.id, situacao: 'ativa', revisao: 1 });
    const det = (await api().get('/api/estruturas/' + squad.id).set('Authorization', auth.consulta).expect(200)).body.relacoes;
    expect(det.saida.map((x: { id: string }) => x.id)).toEqual([r1.id]);
    expect((await api().get('/api/relacoes/' + r1.id).set('Authorization', auth.consulta).expect(200)).body.avaliacao).toEqual({ situacao: 'valida', motivos: [] });
  });

  it('recusa autorrelação, duplicada, não admitida pela Taxonomia, ciclo em "compõe" e tipo inexistente — nada gravado', async () => {
    const a = await criar('SINT_COE', 'CoE A (sintética)'), b = await criar('SINT_COE', 'CoE B (sintética)'), c = await criar('SINT_COE', 'CoE C (sintética)');
    const neg = await criar('SINT_NEGOCIOS', 'Negócios D (sintética)');
    await relacionar(a.id, 'compoe', b.id).expect(201);
    await relacionar(b.id, 'compoe', c.id).expect(201);
    const antes = await contar('estruturas_eventos');
    expect(codigos(await relacionar(a.id, 'compoe', a.id).expect(422))).toContain('AUTORRELACAO');
    expect(codigos(await relacionar(a.id, 'compoe', b.id).expect(422))).toEqual(['RELACAO_DUPLICADA']);
    expect(codigos(await relacionar(neg.id, 'atende', a.id).expect(422))).toEqual(['RELACAO_NAO_ADMITIDA_PELA_TAXONOMIA']);
    expect(codigos(await relacionar(c.id, 'compoe', a.id).expect(422))).toEqual(['CICLO_NA_COMPOSICAO']);
    expect(codigos(await relacionar(a.id, 'chefia', b.id).expect(422))).toContain('TIPO_RELACAO_INVALIDO');
    expect(await contar('estruturas_eventos')).toBe(antes);
  });

  it('substituir = encerrar a atual e criar a nova (mesma operação, com motivo); encerrar exige motivo', async () => {
    const squad = await criar('SINT_SQUAD', 'Squad 2 (sintética)'), n1 = await criar('SINT_NEGOCIOS', 'Negócios E (sintética)'), n2 = await criar('SINT_NEGOCIOS', 'Negócios F (sintética)');
    const r = (await relacionar(squad.id, 'compoe', n1.id).expect(201)).body.relacao;
    expect(codigos(await api().post(`/api/relacoes/${r.id}/substituicao`).set('Authorization', auth.arquitetura).send({ destino: n2.id }).expect(422))).toContain('MOTIVO_OBRIGATORIO');
    const s = (await api().post(`/api/relacoes/${r.id}/substituicao`).set('Authorization', auth.arquitetura).send({ destino: n2.id, motivo: 'reorganização sintética' }).expect(201)).body;
    expect(s.encerrada).toMatchObject({ id: r.id, situacao: 'encerrada', encerramento: { motivo: 'reorganização sintética', substituidaPor: s.relacao.id } });
    expect(s.relacao).toMatchObject({ origem: squad.id, destino: n2.id, substitui: r.id, situacao: 'ativa' });
    const [h1, h2] = await Promise.all([r.id, s.relacao.id].map(async (id) => (await api().get(`/api/relacoes/${id}/historico`).set('Authorization', auth.consulta)).body.eventos));
    expect(h1.map((e: { tipo: string }) => e.tipo)).toEqual(['relacao.criada', 'relacao.encerrada']);
    expect(h2[0].operacaoId).toBe(h1[1].operacaoId);
    expect((await api().post(`/api/relacoes/${s.relacao.id}/encerramento`).set('Authorization', auth.arquitetura).send({ motivo: 'fim sintético' }).expect(200)).body.relacao.situacao).toBe('encerrada');
  });

  it('relação com ponta encerrada aparece como "a revisar" (nada é encerrado sozinho)', async () => {
    const squad = await criar('SINT_SQUAD', 'Squad 3 (sintética)'), neg = await criar('SINT_NEGOCIOS', 'Negócios G (sintética)');
    const r = (await relacionar(squad.id, 'atende', neg.id).expect(201)).body.relacao;
    await api().post(`/api/estruturas/${neg.id}/encerramento`).set('Authorization', auth.arquitetura).send({ motivo: 'encerramento sintético' }).expect(200);
    const pend = (await api().get('/api/relacoes?revisao=pendente').set('Authorization', auth.consulta).expect(200)).body;
    expect(pend.find((x: { relacao: { id: string } }) => x.relacao.id === r.id)).toEqual({ relacao: expect.objectContaining({ id: r.id, situacao: 'ativa' }), avaliacao: { situacao: 'a-revisar', motivos: ['DESTINO_ENCERRADO'] } });
  });
});

describe('5–7. responsável principal de um objeto avaliado', () => {
  let neg: { id: string }, neg2: { id: string }, coe: { id: string }, squad: { id: string };
  beforeAll(async () => {
    neg = await criar('SINT_NEGOCIOS', 'Negócios H (sintética)');
    neg2 = await criar('SINT_NEGOCIOS', 'Negócios I (sintética)');
    coe = await criar('SINT_COE', 'CoE D (sintética)');
    squad = await criar('SINT_SQUAD', 'Squad 4 (sintética)');
    posicionamento.vigentes = {
      'objeto-sint-1': { avaliacaoId: 'aval-sint-1', recomendacao: { codigoResultado: 'NEGOCIOS' } },
      'objeto-sint-avalidar': { avaliacaoId: 'aval-sint-2', recomendacao: { codigoResultado: 'A_VALIDAR' } },
      'objeto-sint-decisao': { avaliacaoId: 'aval-sint-3', recomendacao: { codigoResultado: 'A_VALIDAR' }, decisao: { codigoFinal: 'NEGOCIOS' } }
    };
  });
  const vincular = (objeto: string, estruturaId: string) => api().post(`/api/objetos/${objeto}/responsavel`).set('Authorization', auth.arquitetura).send({ estruturaId });

  it('5. vincula com o Posicionamento vigente e registra a base (avaliação, código, origem); situação válida', async () => {
    expect((await api().get('/api/objetos/objeto-sint-1/responsavel').set('Authorization', auth.consulta).expect(200)).body).toMatchObject({ situacao: 'ausente', vinculo: null });
    const v = (await vincular('objeto-sint-1', neg.id).expect(201)).body.vinculo;
    expect(v).toMatchObject({ objetoId: 'objeto-sint-1', estruturaId: neg.id, papel: 'responsavel-principal', base: { avaliacaoId: 'aval-sint-1', codigo: 'NEGOCIOS', origem: 'recomendacao' }, criadoPor: { id: 'uid-arquitetura' } });
    expect((await api().get('/api/objetos/objeto-sint-1/responsavel').set('Authorization', auth.consulta).expect(200)).body).toMatchObject({ situacao: 'valido', vinculo: { id: v.id } });
  });

  it('A_VALIDAR sem decisão nunca vincula; com decisão final vale a decisão; tipo diferente sem justificativa e Squad são recusados', async () => {
    expect(codigos(await vincular('objeto-sint-avalidar', neg.id).expect(422))).toEqual(['SEM_POSICIONAMENTO_EFETIVO']);
    expect(codigos(await vincular('objeto-sint-sem-posicionamento', neg.id).expect(422))).toEqual(['SEM_POSICIONAMENTO_EFETIVO']);
    expect(codigos(await vincular('objeto-sint-decisao', coe.id).expect(422))).toEqual(['DIVERGENCIA_SEM_JUSTIFICATIVA']); /* E2: tipo diferente só com divergência justificada */
    expect(codigos(await vincular('objeto-sint-decisao', squad.id).expect(422))).toEqual(['TIPO_NAO_ALOCAVEL']); /* Squad nunca recebe alocação */
    expect((await vincular('objeto-sint-decisao', neg.id).expect(201)).body.vinculo.base).toEqual({ avaliacaoId: 'aval-sint-3', codigo: 'NEGOCIOS', origem: 'decisao' });
  });

  it('6. impede um segundo responsável principal ativo', async () => {
    expect(codigos(await vincular('objeto-sint-1', neg2.id).expect(422))).toEqual(['RESPONSAVEL_PRINCIPAL_JA_EXISTE']);
    expect(Number((await sql("SELECT count(*)::int AS n FROM estruturas_vinculos WHERE objeto_id = 'objeto-sint-1' AND situacao = 'ativa'"))[0].n)).toBe(1);
  });

  it('7. substitui com motivo e preserva o histórico; mudança posterior no Posicionamento não altera o vínculo', async () => {
    const atual = (await api().get('/api/objetos/objeto-sint-1/responsavel').set('Authorization', auth.consulta)).body.vinculo;
    expect(codigos(await api().post(`/api/vinculos/${atual.id}/substituicao`).set('Authorization', auth.arquitetura).send({ estruturaId: neg2.id }).expect(422))).toContain('MOTIVO_OBRIGATORIO');
    const s = (await api().post(`/api/vinculos/${atual.id}/substituicao`).set('Authorization', auth.arquitetura).send({ estruturaId: neg2.id, motivo: 'troca sintética' }).expect(201)).body;
    expect(s.encerrado).toMatchObject({ id: atual.id, situacao: 'encerrada', encerramento: { motivo: 'troca sintética', substituidoPor: s.vinculo.id } });
    expect(s.vinculo).toMatchObject({ estruturaId: neg2.id, substitui: atual.id, base: atual.base });
    const hAntigo = (await api().get(`/api/vinculos/${atual.id}/historico`).set('Authorization', auth.consulta)).body.eventos;
    const hNovo = (await api().get(`/api/vinculos/${s.vinculo.id}/historico`).set('Authorization', auth.consulta)).body.eventos;
    expect(hAntigo.map((e: { tipo: string }) => e.tipo)).toEqual(['vinculo.criado', 'vinculo.encerrado']);
    expect(hNovo).toEqual([expect.objectContaining({ tipo: 'vinculo.criado', motivo: 'troca sintética', operacaoId: hAntigo[1].operacaoId })]);

    posicionamento.vigentes['objeto-sint-1'] = { avaliacaoId: 'aval-sint-1b', recomendacao: { codigoResultado: 'COE' } };
    const sit = (await api().get('/api/objetos/objeto-sint-1/responsavel').set('Authorization', auth.consulta).expect(200)).body;
    expect(sit).toMatchObject({ situacao: 'precisa-revisao', motivos: ['CODIGO_EFETIVO_MUDOU', 'TIPO_NAO_CORRESPONDE'], vinculo: { id: s.vinculo.id, revisao: 1, base: { codigo: 'NEGOCIOS' } } });
    expect((await sql('SELECT revisao FROM estruturas_vinculos WHERE id = $1', [s.vinculo.id]))[0].revisao).toBe(1);
    expect((await api().post(`/api/vinculos/${s.vinculo.id}/encerramento`).set('Authorization', auth.arquitetura).send({ motivo: 'encerrado sintético' }).expect(200)).body.vinculo.situacao).toBe('encerrada');
  });
});

describe('E2 e E3: alocação divergente justificada e estruturas colaboradoras (migração 0002)', () => {
  let neg: { id: string }, coe: { id: string }, coe2: { id: string };
  const DIV = { motivo: 'escala', justificativa: 'Sem massa crítica (sintética)', autoridade: 'Instância sintética', referencia: 'Ata sintética 1' };
  beforeAll(async () => {
    neg = await criar('SINT_NEGOCIOS', 'Negócios E2 (sintética)');
    coe = await criar('SINT_COE', 'CoE E2 (sintética)');
    coe2 = await criar('SINT_COE', 'CoE E3 (sintética)');
    posicionamento.vigentes['objeto-sint-e2'] = { avaliacaoId: 'aval-sint-e2', recomendacao: { codigoResultado: 'COE' } };
    posicionamento.vigentes['objeto-sint-e3'] = { avaliacaoId: 'aval-sint-e3', recomendacao: { codigoResultado: 'NEGOCIOS' } };
  });
  it('E2: aloca em tipo diferente com motivo e justificativa; a base fica intacta; a situação é "divergência deliberada"; o banco recusa reescrever a divergência', async () => {
    const post = (b: Record<string, unknown>) => api().post('/api/objetos/objeto-sint-e2/responsavel').set('Authorization', auth.arquitetura).send(b);
    expect(codigos(await post({ estruturaId: neg.id, divergencia: { motivo: 'gosto', justificativa: 'x' } }).expect(422))).toEqual(['MOTIVO_DIVERGENCIA_INVALIDO']);
    expect(codigos(await post({ estruturaId: coe.id, divergencia: DIV }).expect(422))).toEqual(['DIVERGENCIA_INDEVIDA']);
    const v = (await post({ estruturaId: neg.id, divergencia: DIV }).expect(201)).body.vinculo;
    expect(v).toMatchObject({ estruturaId: neg.id, base: { avaliacaoId: 'aval-sint-e2', codigo: 'COE', origem: 'recomendacao' }, divergencia: DIV, criadoPor: { id: 'uid-arquitetura' } });
    expect((await api().get('/api/objetos/objeto-sint-e2/responsavel').set('Authorization', auth.consulta).expect(200)).body).toMatchObject({ situacao: 'divergencia-deliberada', motivos: [], colaboradoras: [] });
    await expect(sql("UPDATE estruturas_vinculos SET revisao = revisao + 1, dados = jsonb_set(jsonb_set(dados, '{divergencia,justificativa}', '\"reescrita\"'), '{revisao}', to_jsonb(revisao + 1)) WHERE id = $1", [v.id])).rejects.toThrow(/imutáveis/);
    /* reavaliação que passa a coincidir com o tipo da estrutura: válido, e a divergência original continua visível */
    posicionamento.vigentes['objeto-sint-e2'] = { avaliacaoId: 'aval-sint-e2b', recomendacao: { codigoResultado: 'NEGOCIOS' } };
    expect((await api().get('/api/objetos/objeto-sint-e2/responsavel').set('Authorization', auth.consulta).expect(200)).body).toMatchObject({ situacao: 'valido', divergenciaResolvida: { codigoAtual: 'NEGOCIOS', avaliacaoId: 'aval-sint-e2b' }, vinculo: { base: { codigo: 'COE' }, divergencia: DIV } });
  });
  it('E3: colaboradora exige principal e justificativa; não repete a estrutura do principal nem a si mesma; o banco garante a forma', async () => {
    const colab = (b: Record<string, unknown>) => api().post('/api/objetos/objeto-sint-e3/colaboradoras').set('Authorization', auth.arquitetura).send(b);
    expect(codigos(await colab({ estruturaId: coe.id, justificativa: 'Apoio técnico (sintética)' }).expect(422))).toEqual(['SEM_RESPONSAVEL_PRINCIPAL']);
    await api().post('/api/objetos/objeto-sint-e3/responsavel').set('Authorization', auth.arquitetura).send({ estruturaId: neg.id }).expect(201);
    expect(codigos(await colab({ estruturaId: coe.id }).expect(422))).toEqual(['CAMPO_OBRIGATORIO']);
    expect(codigos(await colab({ estruturaId: neg.id, justificativa: 'x' }).expect(422))).toEqual(['COLABORADORA_E_PRINCIPAL']);
    expect(codigos(await api().post('/api/objetos/objeto-sint-e3/colaboradoras').set('Authorization', auth.consulta).send({ estruturaId: coe.id, justificativa: 'x' }))).toEqual([]); /* consulta não grava (403) */
    const c1 = (await colab({ estruturaId: coe.id, justificativa: 'Apoio técnico (sintética)' }).expect(201)).body.vinculo;
    expect(c1).toMatchObject({ papel: 'colaboradora', estruturaId: coe.id, justificativa: 'Apoio técnico (sintética)' });
    expect(codigos(await colab({ estruturaId: coe.id, justificativa: 'repetida' }).expect(422))).toEqual(['COLABORADORA_JA_EXISTE']);
    await colab({ estruturaId: coe2.id, justificativa: 'Segundo apoio (sintética)' }).expect(201);
    const sit = (await api().get('/api/objetos/objeto-sint-e3/responsavel').set('Authorization', auth.consulta).expect(200)).body;
    expect(sit.colaboradoras.map((c: { situacao: string; vinculo: { estruturaId: string } }) => [c.situacao, c.vinculo.estruturaId])).toEqual([['ativa', coe.id], ['ativa', coe2.id]]);
    await expect(sql("UPDATE estruturas_vinculos SET revisao = revisao + 1, dados = jsonb_set(dados - 'justificativa', '{revisao}', to_jsonb(revisao + 1)) WHERE id = $1", [c1.id])).rejects.toThrow(/colaboradora_check/);
    expect((await api().post(`/api/vinculos/${c1.id}/encerramento`).set('Authorization', auth.arquitetura).send({ motivo: 'fim sintético' }).expect(200)).body.vinculo).toMatchObject({ situacao: 'encerrada', papel: 'colaboradora' });
  });
  it('E3 sob concorrência: 6 pedidos simultâneos da MESMA colaboradora → uma só ativa (índice único parcial)', async () => {
    posicionamento.vigentes['objeto-sint-e3c'] = { avaliacaoId: 'aval-sint-e3c', recomendacao: { codigoResultado: 'NEGOCIOS' } };
    await api().post('/api/objetos/objeto-sint-e3c/responsavel').set('Authorization', auth.arquitetura).send({ estruturaId: neg.id }).expect(201);
    const rs = await Promise.all(Array.from({ length: 6 }, () => api().post('/api/objetos/objeto-sint-e3c/colaboradoras').set('Authorization', auth.arquitetura).send({ estruturaId: coe.id, justificativa: 'Concorrência (sintética)' })));
    expect(rs.filter((r) => r.status === 201)).toHaveLength(1);
    expect(Number((await sql("SELECT count(*)::int AS n FROM estruturas_vinculos WHERE objeto_id = 'objeto-sint-e3c' AND papel = 'colaboradora' AND situacao = 'ativa'"))[0].n)).toBe(1);
  });
});

describe('9. concorrência: operações simultâneas não violam as regras', () => {
  it('8 vínculos simultâneos para o mesmo objeto → exatamente um responsável principal ativo', async () => {
    const ests = await Promise.all([1, 2, 3, 4].map((i) => criar('SINT_NEGOCIOS', `Negócios conc ${i} (sintética)`)));
    posicionamento.vigentes['objeto-sint-conc'] = { avaliacaoId: 'aval-sint-conc', recomendacao: { codigoResultado: 'NEGOCIOS' } };
    const rs = await Promise.all(Array.from({ length: 8 }, (_, i) => api().post('/api/objetos/objeto-sint-conc/responsavel').set('Authorization', auth.arquitetura).send({ estruturaId: ests[i % 4].id })));
    expect(rs.filter((r) => r.status === 201)).toHaveLength(1);
    rs.filter((r) => r.status !== 201).forEach((r) => expect([r.status, codigos(r)[0] || r.body.erro.codigo]).toEqual([expect.any(Number), expect.stringMatching(/RESPONSAVEL_PRINCIPAL_JA_EXISTE|CONCORRENCIA/)]));
    expect(Number((await sql("SELECT count(*)::int AS n FROM estruturas_vinculos WHERE objeto_id = 'objeto-sint-conc' AND situacao = 'ativa'"))[0].n)).toBe(1);
  });

  it('X compõe Y e Y compõe X ao mesmo tempo (várias vezes) → uma só entra, nunca um ciclo', async () => {
    const x = await criar('SINT_COE', 'CoE X (sintética)'), y = await criar('SINT_COE', 'CoE Y (sintética)');
    const rs = await Promise.all(Array.from({ length: 8 }, (_, i) => (i % 2 ? relacionar(x.id, 'compoe', y.id) : relacionar(y.id, 'compoe', x.id))));
    expect(rs.filter((r) => r.status === 201)).toHaveLength(1);
    const ativas = await sql("SELECT origem, destino FROM estruturas_relacoes WHERE tipo = 'compoe' AND situacao = 'ativa' AND origem = ANY($1) AND destino = ANY($1)", [[x.id, y.id]]);
    expect(ativas).toHaveLength(1);
  });

  it('a mesma relação criada 6 vezes ao mesmo tempo → uma só ativa', async () => {
    const s = await criar('SINT_SQUAD', 'Squad conc (sintética)'), n = await criar('SINT_NEGOCIOS', 'Negócios conc dup (sintética)');
    const rs = await Promise.all(Array.from({ length: 6 }, () => relacionar(s.id, 'atende', n.id)));
    expect(rs.filter((r) => r.status === 201)).toHaveLength(1);
    expect(Number((await sql("SELECT count(*)::int AS n FROM estruturas_relacoes WHERE origem = $1 AND situacao = 'ativa'", [s.id]))[0].n)).toBe(1);
  });

  it('5 alterações simultâneas sobre a mesma revisão → uma vence, as outras recebem conflito de revisão', async () => {
    const e = await criar('SINT_NEGOCIOS', 'Negócios rev (sintética)');
    const rs = await Promise.all([1, 2, 3, 4, 5].map((i) => api().patch('/api/estruturas/' + e.id).set('Authorization', auth.arquitetura).send({ nome: 'Nome concorrente ' + i, revisaoEsperada: 1 })));
    expect(rs.filter((r) => r.status === 200)).toHaveLength(1);
    expect(rs.filter((r) => r.status === 409)).toHaveLength(4);
    expect((await sql('SELECT revisao FROM estruturas WHERE id = $1', [e.id]))[0].revisao).toBe(2);
  });
});

describe('integridade, idempotência, auditoria e referências oficiais', () => {
  it('idempotência: o mesmo pedido com a mesma chave devolve a mesma resposta e grava uma vez; outro pedido com a chave é recusado', async () => {
    const enviar = (nome: string) => api().post('/api/estruturas').set('Authorization', auth.arquitetura).set('Idempotency-Key', 'chave-sintetica-0001').send({ tipo: 'SINT_NEGOCIOS', nome });
    const a = await enviar('Negócios idempotente (sintética)').expect(201);
    const b = await enviar('Negócios idempotente (sintética)').expect(201);
    expect(b.body).toEqual(a.body);
    expect(Number((await sql("SELECT count(*)::int AS n FROM estruturas WHERE nome = 'Negócios idempotente (sintética)'"))[0].n)).toBe(1);
    expect((await enviar('Outro nome').expect(409)).body.erro.codigo).toBe('CHAVE_DE_IDEMPOTENCIA_REUTILIZADA');
  });

  it('sem a Taxonomia ou o Posicionamento oficiais: recusa (503) sem gravar; consultas mostram "indeterminada"', async () => {
    const neg = await criar('SINT_NEGOCIOS', 'Negócios ref (sintética)');
    const antes = await contar('estruturas_operacoes');
    taxonomia.disponivel = false;
    try {
      expect((await api().post('/api/estruturas').set('Authorization', auth.arquitetura).send({ tipo: 'SINT_NEGOCIOS', nome: 'X' }).expect(503)).body.erro).toMatchObject({ codigo: 'REFERENCIA_OFICIAL_INDISPONIVEL', fonte: 'taxonomia' });
      const lista = (await api().get('/api/relacoes').set('Authorization', auth.consulta).expect(200)).body;
      expect(lista.length).toBeGreaterThan(0);
      lista.forEach((x: { avaliacao: { situacao: string } }) => expect(x.avaliacao.situacao).toBe('indeterminada'));
    } finally { taxonomia.disponivel = true; }
    posicionamento.disponivel = false;
    try {
      expect((await api().post('/api/objetos/objeto-sint-ref/responsavel').set('Authorization', auth.arquitetura).send({ estruturaId: neg.id }).expect(503)).body.erro.fonte).toBe('posicionamento');
      expect((await api().get('/api/objetos/objeto-sint-1/responsavel').set('Authorization', auth.consulta).expect(200)).body.situacao).toBe('indeterminada');
    } finally { posicionamento.disponivel = true; }
    expect(await contar('estruturas_operacoes')).toBe(antes);
  });

  it('perfil Avaliação só consulta: gravar é recusado (403) e nada entra no banco', async () => {
    const antes = await contar('estruturas_operacoes');
    await api().post('/api/estruturas').set('Authorization', auth.consulta).send({ tipo: 'SINT_NEGOCIOS', nome: 'X' }).expect(403);
    await api().post('/api/estruturas').send({ tipo: 'SINT_NEGOCIOS', nome: 'X' }).expect(401);
    expect(await contar('estruturas_operacoes')).toBe(antes);
  });

  it('o próprio banco recusa apagar, reativar, trocar tipo, pular revisão e alterar eventos', async () => {
    const e = await criar('SINT_NEGOCIOS', 'Negócios banco (sintética)');
    await expect(sql('DELETE FROM estruturas WHERE id = $1', [e.id])).rejects.toThrow(/Exclusão não permitida/);
    await expect(sql("UPDATE estruturas SET tipo = 'SINT_COE', revisao = 2, dados = jsonb_set(jsonb_set(dados, '{tipo}', '\"SINT_COE\"'), '{revisao}', '2') WHERE id = $1", [e.id])).rejects.toThrow(/tipo da estrutura é imutável/);
    await expect(sql("UPDATE estruturas SET revisao = 3, dados = jsonb_set(dados, '{revisao}', '3') WHERE id = $1", [e.id])).rejects.toThrow(/avançar exatamente 1/);
    await expect(sql("UPDATE estruturas SET nome = 'outro' WHERE id = $1", [e.id])).rejects.toThrow(/check constraint|revisão/);
    await expect(sql('UPDATE estruturas_eventos SET em = now()')).rejects.toThrow(/somente de acréscimo/);
    await expect(sql('DELETE FROM estruturas_eventos')).rejects.toThrow(/Exclusão não permitida/);
    await expect(sql('TRUNCATE estruturas_vinculos')).rejects.toThrow(/Exclusão não permitida/);
    await api().post(`/api/estruturas/${e.id}/encerramento`).set('Authorization', auth.arquitetura).send({ motivo: 'encerramento sintético' }).expect(200);
    await expect(sql("UPDATE estruturas SET situacao = 'ativa', revisao = 3, dados = jsonb_set(jsonb_set(dados, '{situacao}', '\"ativa\"'), '{revisao}', '3') WHERE id = $1", [e.id])).rejects.toThrow(/não pode ser alterado nem reativado/);
  });

  it('gravação atômica: se um evento falha, nem a operação nem as mudanças ficam gravadas', async () => {
    const repo = new RepositorioEstruturasPostgres(), uow = new UnidadeDeTrabalhoPostgres(pool);
    const reg = { id: 'est-atomica', tipo: 'SINT_NEGOCIOS', nome: 'Atômica (sintética)', sigla: null, situacao: 'ativa' as const, revisao: 1 };
    const ev = { id: 'op-atomica:1', operacaoId: 'op-atomica', tipo: 'evento.invalido', entidade: 'estrutura' as const, entidadeId: reg.id, antes: null, depois: reg, usuario: { id: 'u' }, em: new Date().toISOString() };
    await expect(uow.executar((s) => repo.gravar(s, { id: 'op-atomica', operacao: 'x', usuarioId: 'u', chaveIdempotencia: null, digestPedido: null, resposta: null, em: ev.em },
      [{ entidade: 'estrutura', id: reg.id, antes: null, depois: reg, revisaoAnterior: null }], [ev]))).rejects.toThrow();
    expect(await sql("SELECT id FROM estruturas WHERE id = 'est-atomica'")).toEqual([]);
    expect(await sql("SELECT id FROM estruturas_operacoes WHERE id = 'op-atomica'")).toEqual([]);
  });

  it('cada evento aponta para a operação e para o usuário do token; todo registro tem o seu histórico', async () => {
    const orfaos = await sql('SELECT e.id FROM estruturas_eventos e LEFT JOIN estruturas_operacoes o ON o.id = e.operacao_id WHERE o.id IS NULL');
    expect(orfaos).toEqual([]);
    const semHistorico = await sql(`SELECT id FROM (SELECT id, 'estrutura' AS ent FROM estruturas UNION ALL SELECT id, 'relacao' FROM estruturas_relacoes UNION ALL SELECT id, 'vinculo' FROM estruturas_vinculos) r
      WHERE NOT EXISTS (SELECT 1 FROM estruturas_eventos e WHERE e.entidade = r.ent AND e.entidade_id = r.id)`);
    expect(semHistorico).toEqual([]);
    const usuarios = (await sql('SELECT DISTINCT usuario_id FROM estruturas_eventos ORDER BY 1')).map((l) => l.usuario_id);
    expect(usuarios).toEqual(['uid-admin-geral', 'uid-arquitetura']);
  });
});
