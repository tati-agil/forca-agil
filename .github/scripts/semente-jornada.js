/* Semente comum da Jornada de Avaliação e Posicionamento (os 8 casos de referência: Capec, Assessoria, Jurídico,
 * Agilidade, sem Posicionamento, A validar, sem estrutura do tipo, vínculo pendente, mais uma atuação encerrada).
 * Usada por teste-jornada-guiada.js e teste-avaliacao-inicio.js — dados fictícios, como estariam gravados. */
const path = require('path');
const M = require(path.join(__dirname, '..', '..', 'forca-agil', 'motor-posicionamento.js'));
const MOTOR_PRODUTO = require('./montar-regras-posicionamento.js').MOTOR_PRODUTO;
const ARQ = 'arquitetura@previ.com.br', AVAL = 'avaliacao@previ.com.br';
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const QUANDO = '2026-10-01T09:00:00.000Z';
const ORDEM_P = ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia', 'jornada', 'medicao', 'gestao', 'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'];
function produto(id, nome, resultado) {
  const r = {}; ORDEM_P.forEach((q, i) => { r[q] = { valor: 'sim', justificativaAuto: 'i', codigoPergunta: 'P' + (i + 1), textoPerguntaNaEpoca: 't', tituloNaEpoca: 't', questionnaireContentVersion: 1 }; });
  return { itemId: id, nome, descricao: '', publico: '', necessidade: '', observacoesGerais: '', status: 'concluido', resultadoAutomatico: resultado || 'produto', decisaoFinal: resultado || 'produto',
    camadaSugerida: { id: 'produto-principal', label: 'Produto/Serviço principal' }, respostas: r, justificativaAutomatica: 'j', criteriosEssenciaisFalhos: [], criteriosAtendidos: 5,
    motorVersion: MOTOR_PRODUTO, motorVersionArquitetura: 1, questionnaireContentVersion: 1, excluido: false, criadoEm: QUANDO, atualizadoEm: QUANDO, versao: 1, responsavel: { name: 'F', email: 'f@previ.com.br' } };
}
const outra = { name: 'Outra', email: 'o@previ.com.br' };
function concluida(itemId, itemNome, respostas, extra) {
  const res = M.avaliar(respostas, {}), ra = {};
  Object.keys(res).forEach((k) => { const v = res[k]; if (v !== null && !(Array.isArray(v) && !v.length)) ra[k] = v; });
  const reg = { itemId, itemNome, questionarioCodigo: 'POSICIONAMENTO_ORGANIZACIONAL', questionnaireContentVersion: 1, versao: 1, status: 'concluido', revisao: 2, respostas: {}, resultadoAutomatico: ra,
    criadoPor: outra, criadoEm: QUANDO, atualizadoPor: outra, atualizadoEm: QUANDO, concluidoPor: outra, concluidoEm: QUANDO, auditoriaCriacaoId: 'ac' + itemId, auditoriaConclusaoId: 'az' + itemId };
  Object.keys(respostas).forEach((q) => { reg.respostas[q] = { resposta: respostas[q], codigoPergunta: q, questionnaireContentVersion: 1, dataResposta: QUANDO }; });
  return Object.assign(reg, extra || {});
}
const P2 = { origem: 'objeto-organizacional', hipoteseInicial: 'NAO_SEI' };
const objeto = (nome, extra) => Object.assign({ nome, descricao: 'Descrição', finalidade: 'Finalidade', situacao: 'ativo', revisao: 1, criadoPor: { uid: 'u', email: ARQ }, criadoEm: 1, atualizadoPor: { uid: 'u', email: ARQ }, atualizadoEm: 1, auditoriaId: 'a' }, extra || {});
const estrutura = (id, tipo, nome) => ({ id, tipo, nome, situacao: 'ativa', revisao: 1, criadaEm: 1791713600000, criadaPor: { id: 'semente', email: 'semente@teste' }, ultimaOperacao: 'op-' + id });
const vinculo = (id, objetoId, estruturaId, avaliacaoId, codigo, origem) => ({ id, objetoId, estruturaId, papel: 'responsavel-principal', base: { avaliacaoId, codigo, origem }, situacao: 'ativa', revisao: 1,
  criadoEm: 1791713600000, criadoPor: { id: 'semente', email: 'semente@teste' }, ultimaOperacao: 'op-' + id, ultimoEvento: 'op-' + id + ':1' });
const NEG = { O1: 'SIM', O2: 'NAO', O3: 'NAO', O4: 'NAO', O5: 'SIM' }, AE = { O1: 'NAO', O2: 'SIM', O3: 'NAO' }, COE = { O1: 'NAO', O2: 'NAO', O3: 'SIM' };
const CANAIS = { O1: 'SIM', O2: 'NAO', O3: 'NAO', O4: 'NAO', O5: 'NAO', O6: 'SIM', O7: 'NAO', O8: 'NAO', O9: 'NAO' }, CONFLITO = { O1: 'NAO', O2: 'SIM', O3: 'SIM' };
function semente() {
  const aut = {}; aut[chave(ARQ)] = { email: ARQ, tipo: 'avaliacao-arquitetura' }; aut[chave(AVAL)] = { email: AVAL, tipo: 'avaliacao' };
  const users = {}; [ARQ, AVAL].forEach((e) => { users[chave(e)] = { name: 'Pessoa', email: e, area: 'INFOR' }; });
  const conceitos = {}, fontes = {}, ligacoes = {};
  M.CODIGOS_FIRMES.concat(['LINHA', 'PLATAFORMA']).forEach((c, i) => {
    conceitos[c] = { nome: 'Tx ' + c, ordem: i + 1, ativo: true, situacaoDefinicao: 'registrada', camada: 'A', definicaoVigenteFonteId: 'f1' };
    fontes[c] = { f1: { texto: 'Definição de ' + c, contexto: 'PREVI', situacao: 'vigente', tipoRedacao: 'Conceito' } };
  });
  M.CODIGOS_FIRMES.forEach((c) => { ligacoes[c] = { registradoEm: QUANDO, registradoPor: ARQ, auditoriaId: 'l' }; });
  const CA = M.avaliar(CONFLITO, { N1: 'mesma' }), raC = {};
  Object.keys(CA).forEach((k) => { const v = CA[k]; if (v !== null && !(Array.isArray(v) && !v.length)) raC[k] = v; });
  return {
    'fa-users': users, 'fa-admins': {}, 'fa-diretores': {}, 'fa-facilitadores': {}, eventos: {}, turmas: {}, 'turmas-interesse': {}, 'turmas-config': {}, 'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {},
    'fa-avaliacao-autorizados': aut, 'avaliacoes-squad': {}, 'motor-squad-config': {},
    'estruturas-concretas-config': { gravacaoHabilitada: true },
    'avaliacoes-produto': { pCapec: produto('pCapec', 'Capec'), pAssess: produto('pAssess', 'Assessoria Previdenciária'), pJur: produto('pJur', 'Jurídico (P1–P16)', 'a-validar'),
      pSem: produto('pSem', 'Objeto sem Posicionamento'), pVal: produto('pVal', 'Objeto A validar'), pPlat: produto('pPlat', 'Gestão de canais'), pVinc: produto('pVinc', 'Produto a vincular') },
    'objetos-organizacionais': { oJur: objeto('Assessoramento jurídico', { referenciaItemId: 'pJur' }), oAgi: objeto('Disseminação de agilidade'),
      oEnc: objeto('Atuação encerrada', { situacao: 'encerrado', revisao: 2, encerramento: { motivo: 'Incorporada', em: 2, por: { uid: 'u', email: ARQ } } }) },
    'avaliacoes-posicionamento': {
      gC: concluida('pCapec', 'Capec', NEG, { avaliacaoArquiteturalId: 'pCapec' }), gS: concluida('pAssess', 'Assessoria Previdenciária', NEG, { avaliacaoArquiteturalId: 'pAssess' }),
      gJ: concluida('oJur', 'Assessoramento jurídico', AE, P2), gA: concluida('oAgi', 'Disseminação de agilidade', COE, P2),
      gV: Object.assign(concluida('pVal', 'Objeto A validar', CONFLITO, { avaliacaoArquiteturalId: 'pVal' }), { resultadoAutomatico: raC, diagnosticos: { N1: { resposta: 'mesma', papeis: ['AREA_ESPECIALIZADA', 'COE'], questionnaireContentVersion: 1, dataResposta: QUANDO } } }),
      gP: concluida('pPlat', 'Gestão de canais', CANAIS, { avaliacaoArquiteturalId: 'pPlat' }), gPV: concluida('pVinc', 'Produto a vincular', NEG, { avaliacaoArquiteturalId: 'pVinc' })
    },
    'posicionamento-vigente-por-item': { pCapec: 'gC', pAssess: 'gS', oJur: 'gJ', oAgi: 'gA', pVal: 'gV', pPlat: 'gP', pVinc: 'gPV' },
    'posicionamento-rascunho-por-item': {},
    'posicionamento-decisoes': {
      gS: { itemId: 'pAssess', versaoAvaliacao: 1, versaoMotor: 1, codigoAutomatico: 'NEGOCIOS', codigoFinal: 'NEGOCIOS', tipoDecisao: 'CONFIRMACAO', nomeNaDecisao: { nome: 'Tx NEGOCIOS', contingencia: false }, liberaSquad: true, decididoPor: outra, decididoEm: QUANDO, auditoriaId: 'd1' },
      gJ: { itemId: 'oJur', versaoAvaliacao: 1, versaoMotor: 1, codigoAutomatico: 'AREA_ESPECIALIZADA', codigoFinal: 'AREA_ESPECIALIZADA', tipoDecisao: 'CONFIRMACAO', nomeNaDecisao: { nome: 'Tx AREA_ESPECIALIZADA', contingencia: false }, liberaSquad: false, decididoPor: outra, decididoEm: QUANDO, auditoriaId: 'd2' }
    },
    'posicionamento-auditoria': {}, 'posicionamento-classificacoes': ligacoes,
    'estruturas-concretas': { registros: { 'neg-1': estrutura('neg-1', 'NEGOCIOS', 'Linha de Previdência'), jur: estrutura('jur', 'AREA_ESPECIALIZADA', 'Jurídico'), 'coe-ag': estrutura('coe-ag', 'COE', 'CoE de Agilidade') } },
    'estruturas-vinculos': {
      registros: { v1: vinculo('v1', 'pCapec', 'neg-1', 'gC', 'NEGOCIOS', 'recomendacao'), v2: vinculo('v2', 'pAssess', 'neg-1', 'gS', 'NEGOCIOS', 'decisao'),
        v3: vinculo('v3', 'oJur', 'jur', 'gJ', 'AREA_ESPECIALIZADA', 'decisao'), v4: vinculo('v4', 'oAgi', 'coe-ag', 'gA', 'COE', 'recomendacao') },
      'ativo-por-objeto': { pCapec: 'v1', pAssess: 'v2', oJur: 'v3', oAgi: 'v4' }
    },
    taxonomia: { organizacional: { conceitos, fontes } }
  };
}
module.exports = { semente, ARQ, AVAL, chave, M };
