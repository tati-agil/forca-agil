/* GOVERNANÇA DA EVOLUÇÃO DO MOTOR DE POSICIONAMENTO (H2-a / H3-a) — forca-agil/governanca-posicionamento.js, sem
 * navegador, sem rede. O critério de conteúdo é o MESMO de Produto/Serviço (faCriterioReavaliacao.mesmoConteudo,
 * carregado de avaliacao-produto.js).
 *   A. Módulo puro: sem DOM/Firebase/auth; digest determinístico, independente da ordem das chaves.
 *   B. Herança entre versões: só sem dúvida (mesmo código + mesmo significado + mesma pergunta + mesmos critérios);
 *      título pode mudar; texto, ajuda, interpretação, falta de texto da época ou de prova do critério → nova resposta;
 *      D1 recalculada no destino (reaproveitada só para os mesmos papéis e a mesma redação); D2 e decisão nunca herdadas.
 *   C. Impacto: iguais / alterados / incomparáveis (com motivo, nunca contados como iguais) / violações de Linha × Squad;
 *      rascunho e descartada fora do escopo; resultado gravado que diverge do motor da versão → incomparável.
 *   D. Prontidão ≠ autorização; autorização só com proposta e aprovações da versão EXATA (digests), proponente ≠
 *      aprovador, aprovadores distintos (dupla por padrão, mesmo e-mail com caixa diferente conta uma vez) e
 *      reconhecimento do impacto atual; decisaoDeVigencia sem fronteira confiável é sempre "não".
 *   E. Estado de produção: v1 em vigor, v2 não pode entrar em vigor (sem redação publicada). */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RAIZ = path.join(__dirname, '..', '..', 'forca-agil');
const N = require(path.join(RAIZ, 'motor-posicionamento-nucleo.js'));
const G = require(path.join(RAIZ, 'governanca-posicionamento.js'));
const QCOD = 'POSICIONAMENTO_ORGANIZACIONAL';

let total = 0, falhas = 0;
function afirma(c, msg, det) { total++; console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det ? ' → ' + det : '')); if (!c) falhas++; }
const clone = (v) => JSON.parse(JSON.stringify(v));

const ctx = { console, JSON, Object, Array, String, Math, Number, Date, RegExp, Error, Promise, Set, setTimeout, clearTimeout, setInterval, clearInterval, parseFloat, parseInt, isNaN };
ctx.window = ctx;
const el = () => ({ addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, style: {}, classList: { add() {}, remove() {}, contains() { return false; } } });
ctx.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, addEventListener() {}, body: el(), documentElement: el() };
ctx.firebase = { database: () => ({ ref: () => ({ on() {}, once() {}, update() {}, child() { return this; }, push() { return { key: 'k' }; } }) }) };
ctx.navigator = {}; ctx.location = { hash: '' }; ctx.localStorage = { getItem() { return null; }, setItem() {} };
vm.createContext(ctx);
['motor-posicionamento-nucleo.js', 'questionarios-config.js', 'motor-arquitetura.js', 'avaliacao-produto.js', 'conteudo-inicial-posicionamento-v2.js']
  .forEach((f) => vm.runInContext(fs.readFileSync(path.join(RAIZ, f), 'utf8'), ctx, { filename: f }));
const mesmo = ctx.faCriterioReavaliacao.mesmoConteudo;
const Q = ctx.faQuestionarios;
const V1 = N.definicao(1), V2 = N.definicao(2);
const c1 = (cod) => clone(Q.conteudoPergunta(QCOD, cod, 1));
/* redação "v2 com os mesmos textos da v1" (O1–O9 e D1 da v1 + D2 da carga) — o caso em que a herança é possível */
const SEED = Q.normalizarConteudoMotor(QCOD, ctx.faConteudoInicialPosicionamento[2].perguntas, 2).perguntas;
const v2IgualV1 = (cod) => (/^DIAG_PREDOMINANCIA/.test(cod) ? clone(SEED.find((p) => p.codigoEstavel === cod)) : c1(cod));
const v2Seed = (cod) => clone(SEED.find((p) => p.codigoEstavel === cod) || null);
function resp(q, v, cont) { const c = (cont || c1)(q); return { resposta: v, codigoPergunta: q, textoPerguntaNaEpoca: c.texto, questionnaireContentVersion: 1 }; }
function d1(v, papeis, cont) { const c = (cont || c1)('DIAG_CONFLITO_RECORTE'); return { resposta: v, papeis, textoPerguntaNaEpoca: c.texto, questionnaireContentVersion: 1 }; }
function reg(respostas, extra) { const r = Object.assign({ respostas: {}, questionnaireContentVersion: 1 }, extra || {}); Object.keys(respostas).forEach((q) => { r.respostas[q] = resp(q, respostas[q]); }); return r; }
const herdar = (r, defO, defD, cDest, cOrig) => G.herdarEntreVersoes(N, { origem: { def: defO, reg: r }, destino: { def: defD },
  conteudoOrigem: cOrig || ((cod) => c1(cod)), conteudoDestino: cDest, mesmoConteudo: mesmo });

console.log('A. módulo puro e digest');
const fonte = fs.readFileSync(path.join(RAIZ, 'governanca-posicionamento.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
afirma(!/firebase|document\.|localStorage|fetch\(|XMLHttpRequest|faAuth|require\(|faQuestionarios|faMotorPosicionamento\b/.test(fonte), 'sem DOM, Firebase, autenticação, rede nem outro módulo global');
afirma(Object.isFrozen(G), 'API congelada');
afirma(G.digest({ a: 1, b: [1, { c: 2, d: 3 }] }) === G.digest({ b: [1, { d: 3, c: 2 }], a: 1 }), 'digest não depende da ordem das chaves');
afirma(G.digest({ a: 1 }) !== G.digest({ a: 2 }) && /^[0-9a-f]{16}$/.test(G.digest({ a: 1 })), 'digest muda com o conteúdo (16 hex)');
afirma(G.digestRedacao([{ codigoEstavel: 'O1', texto: 'x', atualizadoEm: 'a' }]) === G.digestRedacao([{ texto: 'x', codigoEstavel: 'O1', atualizadoEm: 'b' }]), 'digest da redação ignora metadados de gravação');

console.log('B. herança entre versões');
const AE = { O1: 'NAO', O2: 'SIM', O3: 'NAO' };
let h = herdar(reg(AE), V1, V1, c1);
afirma(h.completo && h.resultado.codigoResultado === 'AREA_ESPECIALIZADA' && Object.keys(h.respostas).length === 3, 'v1 → v1 com a mesma redação: tudo herdado, mesmo resultado');
h = herdar(reg(AE), V1, V2, v2IgualV1);
afirma(h.completo && h.resultado.codigoResultado === 'AREA_ESPECIALIZADA' && h.resultado.versaoMotor === 2, 'v1 → v2 com a mesma redação: herdado e calculado no motor v2');
h = herdar(reg(AE), V1, V2, v2Seed);
afirma(!h.completo && h.novas.some((x) => x.codigo === 'O1' && x.motivo === 'pergunta-diferente') && !Object.keys(h.respostas).length, 'v1 → v2 com a redação v2 (texto novo): nada herdado, O1 "pergunta-diferente"');
const tituloNovo = (cod) => { const c = v2IgualV1(cod); if (cod === 'O2') c.titulo = 'Outro título'; return c; };
afirma(herdar(reg(AE), V1, V2, tituloNovo).completo, 'só o título mudou: herda');
const justNovo = (cod) => { const c = v2IgualV1(cod); if (cod === 'O2') c.justSim = 'outra interpretação'; return c; };
h = herdar(reg(AE), V1, V2, justNovo);
afirma(!h.completo && h.novas.some((x) => x.codigo === 'O2' && x.motivo === 'criterio-diferente'), 'interpretação (justSim) mudou: nova resposta ("criterio-diferente")');
const ajudaNova = (cod) => { const c = v2IgualV1(cod); if (cod === 'O3') c.textoAjuda = Object.assign({}, c.textoAjuda, { significado: 'outra ajuda' }); return c; };
afirma(herdar(reg(AE), V1, V2, ajudaNova).novas.some((x) => x.codigo === 'O3' && x.motivo === 'criterio-diferente'), 'ajuda mudou: nova resposta (dúvida não herda)');
const semTexto = reg(AE); delete semTexto.respostas.O1.textoPerguntaNaEpoca;
afirma(herdar(semTexto, V1, V2, v2IgualV1).novas.some((x) => x.codigo === 'O1' && x.motivo === 'sem-texto-da-epoca'), 'resposta sem texto da época: nova resposta');
afirma(herdar(reg(AE), V1, V2, v2IgualV1, () => null).novas.some((x) => x.motivo === 'sem-prova-do-criterio'), 'sem a redação da época (prova do critério): nova resposta');
afirma(herdar(reg(AE), V1, V2, () => null).novas.every((x) => x.motivo === 'sem-redacao-destino'), 'sem redação no destino: nada herdado');
/* D1: 2 SIM em N1, "mesma" — v1 = conflito; v2 pede D2 depois */
const conf = reg({ O1: 'NAO', O2: 'SIM', O3: 'SIM' }, { diagnosticos: { N1: d1('mesma', ['AREA_ESPECIALIZADA', 'COE']) } });
h = herdar(conf, V1, V2, v2IgualV1);
afirma(h.diagnosticos.N1 && !h.completo && h.novas.some((x) => x.codigo === 'DIAG_PREDOMINANCIA_N1' && x.motivo === 'd2-nunca-herdada'), 'D1 mesma redação e mesmos papéis: reaproveitada; a D2 que ela abre exige resposta');
const confPapel = clone(conf); confPapel.diagnosticos.N1.papeis = ['LINHA', 'COE'];
afirma(herdar(confPapel, V1, V2, v2IgualV1).novas.some((x) => /DIAG_CONFLITO_RECORTE:N1/.test(x.codigo) && x.motivo === 'papeis-diferentes'), 'D1 para outros papéis: nova resposta');
afirma(herdar(conf, V1, V2, v2Seed).novas.some((x) => x.codigo === 'O2'), 'D1 com redação v2 diferente: nem chega (as binárias já pedem resposta)');
const tres = reg({ O1: 'SIM', O2: 'SIM', O3: 'SIM' });
afirma(N.avaliar(V1, { O1: 'SIM', O2: 'SIM', O3: 'SIM' }, {}).tipoAValidar === 'RECORTE' &&
  herdar(tres, V1, V2, v2IgualV1).novas.some((x) => /DIAG_CONFLITO_RECORTE:N1/.test(x.codigo) && x.motivo === 'sem-resposta'), 'D1 recalculada: 3 SIM (sem D1 na v1) passam a exigir D1 na v2');
const comD2 = reg({ O1: 'NAO', O2: 'SIM', O3: 'SIM' }, { versaoMotor: 2, diagnosticos: { N1: d1('mesma', ['AREA_ESPECIALIZADA', 'COE']) },
  predominancias: { N1: { resposta: 'EXECUCAO_ESPECIALIZADA', papeis: ['AREA_ESPECIALIZADA', 'COE'] } } });
h = herdar(comD2, V2, V2, v2IgualV1, v2IgualV1);
afirma(JSON.stringify(h.d2Descartadas) === '["N1"]' && !h.completo && !('predominancias' in h), 'v2 → v2: a D2 nunca é herdada (sempre nova resposta)');
afirma(!('decisao' in h) && !('decisaoFinal' in h), 'a herança não carrega decisão humana');
let lancou = false; try { G.herdarEntreVersoes(N, { origem: { def: V1, reg: reg(AE) }, destino: { def: V1 }, conteudoOrigem: c1, conteudoDestino: c1 }); } catch (e) { lancou = true; }
afirma(lancou, 'sem o critério de conteúdo, recusa (não inventa um critério próprio)');

console.log('C. impacto sobre registros (só leitura)');
function concluida(respostas, extra, defO) {
  const r = reg(respostas, extra), s = { r: {}, d: {}, p: {} };
  Object.keys(r.respostas).forEach((q) => { s.r[q] = r.respostas[q].resposta; });
  Object.keys(r.diagnosticos || {}).forEach((n) => { s.d[n] = r.diagnosticos[n].resposta; });
  Object.keys(r.predominancias || {}).forEach((n) => { s.p[n] = r.predominancias[n].resposta; });
  r.status = 'concluido'; r.resultadoAutomatico = N.avaliar(defO || V1, s.r, s.d, s.p);
  return r;
}
const igualReg = concluida(AE);
const confReg = concluida({ O1: 'NAO', O2: 'SIM', O3: 'SIM' }, { diagnosticos: { N1: d1('mesma', ['AREA_ESPECIALIZADA', 'COE']) } });
const v2AE = concluida({ O1: 'NAO', O2: 'SIM', O3: 'SIM' }, { versaoMotor: 2, diagnosticos: { N1: d1('mesma', ['AREA_ESPECIALIZADA', 'COE']) },
  predominancias: { N1: { resposta: 'EXECUCAO_ESPECIALIZADA', papeis: ['AREA_ESPECIALIZADA', 'COE'] } } }, V2);
const adulterado = concluida(AE); adulterado.resultadoAutomatico.codigoResultado = 'COE';
const incompleto = concluida(AE); delete incompleto.respostas;
const desconhecida = concluida(AE, { versaoMotor: 9 });
const registros = [
  { id: 'igual', reg: igualReg, decisao: { codigoFinal: 'AREA_ESPECIALIZADA' } }, { id: 'conf', reg: confReg }, { id: 'adult', reg: adulterado },
  { id: 'inc', reg: incompleto }, { id: 'desc', reg: desconhecida }, { id: 'rasc', reg: Object.assign(reg(AE), { status: 'rascunho' }) },
  { id: 'desc2', reg: Object.assign(reg(AE), { status: 'descartado' }) }
];
const imp = G.classificarImpacto(N, { destino: V2, registros, conteudoOrigem: (r, c) => c1(c), conteudoDestino: v2IgualV1, mesmoConteudo: mesmo });
const ids = (l) => l.map((x) => x.id).sort().join(',');
afirma(ids(imp.iguais) === 'igual' && imp.iguais[0].comDecisao === true, 'igual: AE → AE (e marca que tem decisão)');
afirma(imp.incomparaveis.find((x) => x.id === 'conf').motivo === 'exige-novas-respostas', 'conflito v1 → v2 pede D2: incomparável, não igual');
afirma(imp.incomparaveis.find((x) => x.id === 'adult').motivo === 'resultado-gravado-diverge', 'resultado gravado que não é o do motor: incomparável');
afirma(imp.incomparaveis.find((x) => x.id === 'inc').motivo === 'dados-incompletos' && imp.incomparaveis.find((x) => x.id === 'desc').motivo === 'versao-desconhecida', 'sem respostas / versão desconhecida: incomparáveis');
afirma(ids(imp.foraDoEscopo) === 'desc2,rasc' && imp.total === 5, 'rascunho e descartada ficam fora; 5 concluídas avaliadas');
afirma(imp.iguais.length + imp.alterados.length + imp.incomparaveis.length === imp.total, 'cada concluída cai em exatamente um balde');
afirma(!imp.iguais.some((x) => imp.incomparaveis.some((y) => y.id === x.id)), 'nenhum incomparável contado como igual');
const imp2 = G.classificarImpacto(N, { destino: V1, registros: [{ id: 'v2ae', reg: v2AE }], conteudoOrigem: (r, c) => v2IgualV1(c), conteudoDestino: c1, mesmoConteudo: mesmo });
afirma(imp2.alterados.length === 1 && imp2.alterados[0].de === 'AREA_ESPECIALIZADA' && imp2.alterados[0].para === 'A_VALIDAR', 'alterado: v2 (AE por predominância) → v1 (conflito)');
afirma(imp.violacoes.length === 0 && imp2.violacoes.length === 0, 'sem violação de Linha × Squad nos registros válidos');
const viola = concluida(AE); viola.resultadoAutomatico.liberaSquad = true;
const imp3 = G.classificarImpacto(N, { destino: V2, registros: [{ id: 'v', reg: viola }], conteudoOrigem: (r, c) => c1(c), conteudoDestino: v2IgualV1, mesmoConteudo: mesmo });
afirma(imp3.violacoes.some((x) => x.id === 'v' && x.onde === 'gravado') && imp3.incomparaveis.some((x) => x.id === 'v'), 'AE gravada liberando Squad: violação de Linha × Squad (e incomparável)');
afirma(G.liberaSquadEsperado('COE') === false && G.liberaSquadEsperado('NEGOCIOS') === true && G.liberaSquadEsperado('A_VALIDAR', 'LINHA') === true && G.liberaSquadEsperado('LINHA') === null,
  'invariante literal: COE não libera, ramo Linha libera, código não firme não tem valor');
afirma(G.classificarImpacto(N, { destino: V2, registros, conteudoOrigem: (r, c) => c1(c), conteudoDestino: v2IgualV1, mesmoConteudo: mesmo }).digest === imp.digest, 'impacto determinístico (mesmo digest)');

console.log('D. prontidão ≠ autorização');
const sim = N.simular(V1, V2);
const pronta = G.prontidao(N, V2, { emVigor: V1, redacoesPublicadas: [{ publicado: true, versao: 1, codigo: QCOD, motorCompativel: 2, perguntas: SEED }], simulacao: sim, impacto: { total: 0, violacoes: [], incomparaveis: [], alterados: [], digest: 'x' } });
afirma(pronta.pronta === true && pronta.autorizada === false && /não é autorização/.test(pronta.aviso), 'tudo pronto tecnicamente → pronta, mas NÃO autorizada');
const semRedacao = G.prontidao(N, V2, { emVigor: V1, redacoesPublicadas: [], simulacao: sim, impacto: pronta && { total: 0, violacoes: [], incomparaveis: [], alterados: [], digest: 'x' } });
afirma(!semRedacao.pronta && semRedacao.itens.find((i) => i.codigo === 'REDACAO_PUBLICADA_COMPATIVEL').ok === false, 'sem redação publicada → não pronta');
afirma(!G.prontidao(N, V2, { emVigor: V1, redacoesPublicadas: [{ publicado: true, versao: 1, codigo: QCOD, motorCompativel: 2, perguntas: SEED }] }).pronta, 'sem simulação nem impacto → não pronta');
afirma(!G.prontidao(N, V1, { emVigor: V1 }).pronta, 'a própria versão em vigor não "entra em vigor" de novo');
const alvo = { versaoMotor: 2, digestDefinicao: G.digest(V2), versaoRedacao: 1, digestRedacao: G.digestRedacao(SEED), digestImpacto: imp.digest };
const rec = { digestImpacto: imp.digest, incomparaveis: imp.incomparaveis.length, alterados: imp.alterados.length };
const prop = { alvo, propostoPor: { email: 'ana@previ.com.br' } };
const ap = (email, extra) => Object.assign({ alvo: clone(alvo), aprovadoPor: { email }, reconhecimento: clone(rec) }, extra || {});
const ok = G.autorizacao(alvo, prop, [ap('bia@previ.com.br'), ap('caio@previ.com.br')], { impacto: imp });
afirma(ok.autorizada && ok.aprovadores.length === 2, 'proposta + 2 aprovadores distintos, versão exata, impacto reconhecido → autorizada');
afirma(!G.autorizacao(alvo, prop, [ap('bia@previ.com.br')], { impacto: imp }).autorizada, 'dupla aprovação por padrão: 1 aprovador não basta');
afirma(G.autorizacao(alvo, prop, [ap('bia@previ.com.br'), ap('ANA@previ.com.br')], { impacto: imp }).recusadas.some((r) => r.motivo === 'PROPONENTE_NAO_APROVA'), 'quem propõe não aprova (nem com o e-mail em outra caixa)');
afirma(!G.autorizacao(alvo, prop, [ap('bia@previ.com.br'), ap('Bia@previ.com.br ')], { impacto: imp }).autorizada, 'a mesma pessoa duas vezes conta uma');
const outraRed = ap('caio@previ.com.br'); outraRed.alvo.digestRedacao = 'outra';
afirma(!G.autorizacao(alvo, prop, [ap('bia@previ.com.br'), outraRed], { impacto: imp }).autorizada, 'aprovação de outra redação não vale');
const outroMotor = ap('caio@previ.com.br'); outroMotor.alvo.digestDefinicao = G.digest(V1);
afirma(!G.autorizacao(alvo, prop, [ap('bia@previ.com.br'), outroMotor], { impacto: imp }).autorizada, 'aprovação de outra definição do motor não vale');
afirma(!G.autorizacao(alvo, prop, [ap('bia@previ.com.br'), ap('caio@previ.com.br', { reconhecimento: { digestImpacto: imp.digest, incomparaveis: 0, alterados: imp.alterados.length } })], { impacto: imp }).autorizada,
  'reconhecimento que não cobre os incomparáveis não vale');
afirma(G.autorizacao(alvo, prop, [ap('bia@previ.com.br'), ap('caio@previ.com.br')], { impacto: imp2 }).motivos.includes('IMPACTO_DESATUALIZADO'), 'impacto mudou depois da proposta → não autorizada');
afirma(!G.autorizacao(alvo, { alvo: clone(alvo) }, [ap('bia@previ.com.br'), ap('caio@previ.com.br')], { impacto: imp }).autorizada, 'proposta sem autor → não autorizada');
afirma(G.decisaoDeVigencia(pronta, ok).pode === false && G.decisaoDeVigencia(pronta, ok).motivos.join() === 'SEM_FRONTEIRA_CONFIAVEL', 'pronta + autorizada, sem fronteira confiável → não pode');
afirma(G.decisaoDeVigencia(pronta, ok, true).pode === true && G.decisaoDeVigencia(semRedacao, ok, true).pode === false, 'só as três juntas podem (na fase b)');

console.log('E. estado de produção');
afirma(N.versaoEmVigor() === 1, 'v1 em vigor');
afirma(!G.prontidao(N, V2, { emVigor: V1, redacoesPublicadas: [] }).pronta, 'v2 não está pronta para entrar em vigor (sem redação publicada)');

console.log('F. a tela: reavaliação na mesma versão e atualização (dormente) para o motor atual');
const lst = {};
const cy = { console, JSON, Object, Array, String, Math, Number, Date, RegExp, Error, Promise, Set, setTimeout, clearTimeout, setInterval, clearInterval, parseFloat, parseInt, isNaN };
cy.window = cy; cy.document = ctx.document; cy.navigator = {}; cy.location = { hash: '' }; cy.localStorage = ctx.localStorage;
cy.firebase = { database: () => ({ ref: (p) => ({ on(ev, cb) { lst[p] = cb; }, off() {}, once() { return Promise.resolve({ val: () => null }); }, update() {}, child() { return this; }, push() { return { key: 'k' }; } }) }) };
vm.createContext(cy);
['motor-posicionamento-nucleo.js', 'governanca-posicionamento.js', 'questionarios-config.js', 'motor-arquitetura.js', 'avaliacao-produto.js', 'motor-posicionamento.js', 'avaliacao-posicionamento.js']
  .forEach((f) => vm.runInContext(fs.readFileSync(path.join(RAIZ, f), 'utf8'), cy, { filename: f }));
cy.faQuestionarios.onMudanca(QCOD, () => {});
const PUB_IGUAL = ['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7', 'O8', 'O9', 'DIAG_CONFLITO_RECORTE', 'DIAG_PREDOMINANCIA_N1', 'DIAG_PREDOMINANCIA_N2', 'DIAG_PREDOMINANCIA_N3']
  .map((c) => Object.assign(v2IgualV1(c), { codigoEstavel: c }));
lst['questionarios-config/' + QCOD]({ val: () => ({ motores: { 2: { versaoPublicada: 1, versoes: { 1: { perguntas: PUB_IGUAL, motorCompativel: 2 } } } } }) });
const T = cy.faAvaliacaoPosicionamentoNucleo;
const U = { name: 'Ana', email: 'ana@previ.com.br' };
const vig = Object.assign(concluida(AE), { itemId: 'i1', itemNome: 'Item', versao: 1 });
afirma(T.atualizacaoDisponivel(vig) === null, 'v1 em vigor: "Atualizar com motor atual" não existe para registro v1 (dormente)');
const at = T.payloadAtualizacaoMotor({ id: 'n1', audId: 'a1', anteriorId: 'g1', anterior: vig, itemNome: 'Item', avaliacaoArquiteturalId: 'p1', versaoMotorDestino: 2, versaoRedacaoDestino: 1,
  motivo: 'Atualização para o motor v2', usuario: U, agora: '2026-10-11T00:00:00Z' });
const nr = at.payload['avaliacoes-posicionamento/n1'];
afirma(nr.versaoMotor === 2 && nr.origemReavaliacao === 'motor' && nr.versao === 2 && nr.avaliacaoAnteriorId === 'g1' && nr.status === 'rascunho', 'atualização: vN+1 no motor v2, origem "motor", rascunho apontando a anterior');
afirma(Object.keys(nr.respostas).sort().join() === 'O1,O2,O3' && /Execução especializada|especializad/i.test(JSON.stringify(nr.respostas.O2.tituloNaEpoca || nr.respostas.O2.textoPerguntaNaEpoca)) && nr.respostas.O2.questionnaireContentVersion === 1,
  'respostas herdadas só as comprovadamente iguais, com a redação do destino');
afirma(Object.keys(at.payload).sort().join() === ['avaliacoes-posicionamento/n1', 'posicionamento-auditoria/n1/a1', 'posicionamento-rascunho-por-item/i1'].join(), 'grava só a nova versão, a reserva e a auditoria — nenhuma decisão, nada na anterior');
afirma(at.payload['posicionamento-auditoria/n1/a1'].origemReavaliacao === 'motor' && at.payload['posicionamento-auditoria/n1/a1'].versaoMotorAnterior === 1, 'auditoria registra origem e versões');
afirma(T.avaliar(nr).versaoMotor === 2 && T.falta(nr) === null && T.avaliar(nr).codigoResultado === 'AREA_ESPECIALIZADA', 'a nova versão é calculada no motor v2');
const confV = Object.assign(concluida({ O1: 'NAO', O2: 'SIM', O3: 'SIM' }, { diagnosticos: { N1: d1('mesma', ['AREA_ESPECIALIZADA', 'COE']) } }), { itemId: 'i2', itemNome: 'Item 2', versao: 1 });
const at2 = T.payloadAtualizacaoMotor({ id: 'n2', audId: 'a2', anteriorId: 'g2', anterior: confV, versaoMotorDestino: 2, versaoRedacaoDestino: 1, motivo: 'm', usuario: U, agora: 'x' });
const nr2 = at2.payload['avaliacoes-posicionamento/n2'];
afirma(nr2.diagnosticos && nr2.diagnosticos.N1.resposta === 'mesma' && !nr2.predominancias && T.falta(nr2) && T.falta(nr2).predominancia === 'N1', 'conflito v1 → v2: D1 reaproveitada, D2 pedida (nunca herdada)');
let l2 = false; try { T.payloadAtualizacaoMotor({ id: 'n', audId: 'a', anteriorId: 'g', anterior: vig, versaoMotorDestino: 1, versaoRedacaoDestino: 1, motivo: 'm', usuario: U, agora: 'x' }); } catch (e) { l2 = true; }
afirma(l2, 'atualizar para uma versão que não é mais nova é recusado');
const v2reg = Object.assign(clone(v2AE), { itemId: 'i3', itemNome: 'Item 3', versao: 1 });
Object.keys(v2reg.respostas).forEach((q) => { v2reg.respostas[q].textoPerguntaNaEpoca = v2IgualV1(q).texto; });
const re = T.payloadReavaliacao({ id: 'n3', audId: 'a3', anteriorId: 'g3', anterior: v2reg, itemNome: 'Item 3', avaliacaoArquiteturalId: 'p3', versao: 1, motivo: 'm', usuario: U, agora: 'x' });
const nr3 = re['avaliacoes-posicionamento/n3'];
afirma(nr3.versaoMotor === 2 && !nr3.predominancias && Object.keys(nr3.respostas).length === 3, 'reavaliar registro v2: continua v2 (nunca volta a v1); a D2 não é herdada');
afirma(T.textoVersoes(vig) === 'motor v1 · redação v1' && T.textoVersoes(nr3) === 'motor v2 · redação v1', 'identificação das versões: registro sem campo = motor v1');

console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
process.exit(falhas ? 1 : 0);
