/* H3-b — Regras do banco para a ATIVAÇÃO GOVERNADA: avaliações no motor em vigor e conclusão v2 pela fronteira.
 * Roda no emulador real (teste-rules.yml). As gravações da tela são montadas pelo núcleo real da tela
 * (faAvaliacaoPosicionamentoNucleo); a identidade restrita do servidor é o uid 'fronteira-confiavel' (no servidor ela
 * só existe com a credencial de servidor — teste-fronteira-posicionamento.js prova isso com o Admin SDK). Prova:
 *   A. sem registro de vigência (= v1): nasce v1; uma avaliação "v2" é recusada;
 *   B. vigência 2: nasce v2 (versaoMotor 2); v1 nova é recusada; D2 (predominancias) só em registro v2; o motor do
 *      registro não muda depois de criado (nem some, nem troca);
 *   C. conclusão: a TELA conclui só v1 (a de v2 é recusada); a FRONTEIRA conclui v2 (resultado do núcleo, vigente,
 *      reserva e auditoria juntos) e não conclui v1, não cria nem salva rascunho e não decide;
 *   D. reavaliação: mantém o motor da anterior; "Atualizar com motor atual" (origem 'motor') só para o motor em vigor
 *      e mais novo; origem 'motor' para versão mais velha é recusada;
 *   E. retorno à v1: proposta de motor 1 só quando a versão em vigor não é a 1. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const G = require('../../forca-agil/governanca-posicionamento.js');
const NUC = require('../../forca-agil/motor-posicionamento-nucleo.js');
const MOTOR_OK = { motorVersion: require('./montar-regras-posicionamento.js').MOTOR_PRODUTO, motorVersionArquitetura: 1 };
let total = 0, falhas = 0;
async function caso(nome, p, deve) {
  total++;
  try { await (deve ? assertSucceeds(p) : assertFails(p)); console.log('  ok    ' + nome); }
  catch (e) { falhas++; console.log('  FALHA ' + nome + ' → ' + String((e && e.message) || e).split('\n')[0]); }
}
function carregarNucleo() {
  const raiz = path.join(__dirname, '..', '..', 'forca-agil');
  const ctx = { console, JSON, Object, Array, String, Math, Number, Date, RegExp, Error, Promise, setTimeout, clearTimeout };
  ctx.window = ctx;
  const el = () => ({ addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, style: {}, classList: { add() {}, remove() {}, contains() { return false; } } });
  ctx.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, addEventListener() {}, body: el(), documentElement: el() };
  ctx.navigator = {}; ctx.location = { hash: '' }; ctx.localStorage = { getItem() { return null; }, setItem() {} }; ctx.setInterval = () => 0; ctx.clearInterval = () => {};
  ctx.firebase = { database: () => ({ ref: () => ({ on() {}, off() {}, once() { return Promise.resolve({ val: () => null }); }, update() {}, child() { return this; }, push() { return { key: 'k' }; } }) }) };
  vm.createContext(ctx);
  for (const f of ['motor-posicionamento-nucleo.js', 'governanca-posicionamento.js', 'questionarios-config.js', 'motor-arquitetura.js', 'avaliacao-produto.js', 'motor-posicionamento.js', 'avaliacao-posicionamento.js']) vm.runInContext(fs.readFileSync(path.join(raiz, f), 'utf8'), ctx, { filename: f });
  ctx.faPosicionamentos = { nome: (c) => 'Nome de ' + c, usandoContingencia: () => false };
  return ctx.faAvaliacaoPosicionamentoNucleo;
}
const T = carregarNucleo();
const clone = (v) => JSON.parse(JSON.stringify(v));
const QUANDO = '2026-10-11T12:00:00.000Z';
const ARQ = 'arquitetura@previ.com.br', ADM = 'tatianefdirene@previ.com.br', ARQ2 = 'arq2@previ.com.br';
const k = (e) => e.replace(/[@.]/g, '_');
const AV = 'avaliacoes-posicionamento', RES = 'posicionamento-rascunho-por-item', VIG = 'posicionamento-vigente-por-item', AUDP = 'posicionamento-auditoria';
const resp = (q, v) => ({ resposta: v, codigoPergunta: q, questionnaireContentVersion: 1, dataResposta: QUANDO });

(async () => {
  const rules = fs.readFileSync(process.env.FA_REGRAS || path.join(__dirname, '..', '..', 'database.rules.json'), 'utf8'); /* FA_REGRAS: provas de mutação */
  const env = await initializeTestEnvironment({ projectId: 'demo-kyber-agil-posicionamento-v2', database: { rules } });
  await env.clearDatabase();
  const db = (e) => env.authenticatedContext('uid-' + k(e), { email: e }).database();
  const fronteira = () => env.authenticatedContext('fronteira-confiavel').database();
  const raiz = (e) => db(e).ref();
  const admin = async (f) => env.withSecurityRulesDisabled(async (c) => f(c.database()));
  const ler = async (p) => { let v; await admin(async (d) => { v = (await d.ref(p).once('value')).val(); }); return v; };
  const usuario = (e) => ({ name: 'Pessoa', email: e });
  await admin(async (d) => {
    await d.ref('fa-avaliacao-autorizados/' + k(ARQ)).set({ email: ARQ, tipo: 'avaliacao-arquitetura' });
    await d.ref('fa-avaliacao-autorizados/' + k(ARQ2)).set({ email: ARQ2, tipo: 'avaliacao-arquitetura' });
    const prods = {};
    ['i1', 'i2', 'i3', 'i4', 'i5', 'i6'].forEach((i) => { prods[i] = Object.assign({ itemId: i, status: 'concluido', excluido: false }, MOTOR_OK); });
    await d.ref('avaliacoes-produto').set(prods);
  });
  const criacao = (id, item, e, vMotor) => T.payloadCriacao({ id, audId: 'ac' + id, itemId: item, itemNome: 'Item ' + item, avaliacaoArquiteturalId: item, versao: 1, usuario: usuario(e), agora: QUANDO, versaoMotor: vMotor });
  const vig = (v) => admin(async (d) => { if (v === null) await d.ref('posicionamento-motor-vigencia').remove(); else await d.ref('posicionamento-motor-vigencia').set({ versaoEmVigor: v, seq: 1 }); });

  console.log('A. sem registro de vigência (v1)');
  await caso('cria avaliação v1', raiz(ARQ).update(criacao('a1', 'i1', ARQ)), true);
  await caso('avaliação v2 é recusada (o motor em vigor é o 1)', raiz(ARQ).update(criacao('a2', 'i2', ARQ, 2)), false);

  console.log('B. vigência 2');
  await vig(2);
  await caso('avaliação v1 nova é recusada', raiz(ARQ).update(criacao('b1', 'i2', ARQ)), false);
  await caso('avaliação v2 é criada (versaoMotor 2)', raiz(ARQ).update(criacao('b2', 'i2', ARQ, 2)), true);
  afirmaRegistro((await ler(AV + '/b2')).versaoMotor === 2, 'o registro guarda versaoMotor 2');
  const b2 = await ler(AV + '/b2');
  const comD2 = Object.assign(clone(b2), { respostas: { O1: resp('O1', 'NAO'), O2: resp('O2', 'SIM'), O3: resp('O3', 'SIM') },
    diagnosticos: { N1: { resposta: 'mesma', papeis: ['AREA_ESPECIALIZADA', 'COE'], questionnaireContentVersion: 1, dataResposta: QUANDO } },
    predominancias: { N1: { resposta: 'EXECUCAO_ESPECIALIZADA', papeis: ['AREA_ESPECIALIZADA', 'COE'], questionnaireContentVersion: 1, dataResposta: QUANDO } } });
  await caso('salva rascunho v2 com D2 (predominancias)', raiz(ARQ).update(T.payloadSalvar('b2', comD2, usuario(ARQ), QUANDO, 1)), true);
  const a1 = await ler(AV + '/a1');
  await caso('D2 em registro v1 é recusado', raiz(ARQ).update(T.payloadSalvar('a1', Object.assign(clone(a1), { predominancias: comD2.predominancias }), usuario(ARQ), QUANDO, 1)), false);
  const b2b = await ler(AV + '/b2');
  await caso('o motor do registro não some (v2 → sem campo)', raiz(ARQ).update(T.payloadSalvar('b2', Object.assign(clone(b2b), { versaoMotor: null }), usuario(ARQ), QUANDO, 2)), false);
  await caso('o motor do registro não troca (v2 → v3)', raiz(ARQ).update(T.payloadSalvar('b2', Object.assign(clone(b2b), { versaoMotor: 3 }), usuario(ARQ), QUANDO, 2)), false);
  await caso('a v1 já aberta continua sendo salva (sem D2)', raiz(ARQ).update(T.payloadSalvar('a1', Object.assign(clone(a1), { respostas: { O1: resp('O1', 'NAO') } }), usuario(ARQ), QUANDO, 1)), true);

  console.log('C. conclusão: tela só v1, fronteira só v ≥ 2');
  await caso('cria outra avaliação v2', raiz(ARQ).update(criacao('b4', 'i4', ARQ, 2)), true);
  const b4 = Object.assign(clone(await ler(AV + '/b4')), { respostas: { O1: resp('O1', 'NAO'), O2: resp('O2', 'SIM'), O3: resp('O3', 'NAO') } });
  await caso('salva o rascunho v2 completo', raiz(ARQ).update(T.payloadSalvar('b4', b4, usuario(ARQ), QUANDO, 1)), true);
  const b4s = await ler(AV + '/b4'), b4v1 = clone(b4s); delete b4v1.versaoMotor;
  const conclComoV1 = T.payloadConclusao('b4', b4v1, usuario(ARQ), QUANDO, b4s.revisao, 'kc4').payload; conclComoV1[AV + '/b4'].versaoMotor = 2;
  await caso('a TELA não conclui v2 nem com o resultado exato da tabela v1', raiz(ARQ).update(conclComoV1), false);
  const b2c = await ler(AV + '/b2');
  const conclV2 = T.payloadConclusao('b2', b2c, usuario(ARQ), QUANDO, b2c.revisao, 'kc2');
  await caso('a TELA não conclui avaliação v2', raiz(ARQ).update(conclV2.payload), false);
  const a1b = await ler(AV + '/a1');
  const a1Comp = Object.assign(clone(a1b), { respostas: { O1: resp('O1', 'NAO'), O2: resp('O2', 'SIM'), O3: resp('O3', 'NAO') } });
  await caso('a fronteira não salva rascunho', fronteira().ref().update(T.payloadSalvar('a1', a1Comp, usuario(ARQ), QUANDO, a1b.revisao)), false);
  await caso('a fronteira não conclui avaliação v1', fronteira().ref().update(T.payloadConclusao('a1', a1Comp, usuario(ARQ), QUANDO, a1b.revisao, 'kc1').payload), false);
  await caso('a fronteira não cria rascunho', fronteira().ref().update(criacao('f1', 'i3', ARQ, 2)), false);
  const adult = clone(conclV2.payload); adult[AV + '/b2'].itemNome = 'outro nome';
  await caso('a fronteira não altera o que é fixo ao concluir', fronteira().ref().update(adult), false);
  const semAud = clone(conclV2.payload); delete semAud[AUDP + '/b2/kc2'];
  await caso('conclusão v2 sem a auditoria é recusada', fronteira().ref().update(semAud), false);
  const semVig = clone(conclV2.payload); delete semVig[VIG + '/i2'];
  await caso('conclusão v2 sem o vigente é recusada', fronteira().ref().update(semVig), false);
  await caso('a FRONTEIRA conclui a v2 (resultado do núcleo, vigente, reserva e auditoria juntos)', fronteira().ref().update(conclV2.payload), true);
  const b2f = await ler(AV + '/b2'), esperado = NUC.avaliar(NUC.definicao(2), { O1: 'NAO', O2: 'SIM', O3: 'SIM' }, { N1: 'mesma' }, { N1: 'EXECUCAO_ESPECIALIZADA' });
  afirmaRegistro(b2f.status === 'concluido' && b2f.resultadoAutomatico.versaoMotor === 2 && b2f.resultadoAutomatico.codigoResultado === esperado.codigoResultado && (await ler(VIG + '/i2')) === 'b2' && !(await ler(RES + '/i2')),
    'concluída v2: ' + b2f.resultadoAutomatico.codigoResultado + ' (o do núcleo), vigente e reserva liberada');
  await caso('a fronteira não registra decisão', fronteira().ref('posicionamento-decisoes/b2').set({ itemId: 'i2' }), false);
  await caso('Avaliação + Configuração registra a decisão humana sobre a v2', raiz(ARQ).update(T.payloadDecisao({ id: 'b2', reg: b2f, codigoFinal: 'AREA_ESPECIALIZADA', justificativa: 'Decidido.', usuario: usuario(ARQ), agora: QUANDO, audId: 'kd2' })), true);
  await caso('a tela continua concluindo a v1 (tabela do motor v1)', raiz(ARQ).update(T.payloadConclusao('a1', a1Comp, usuario(ARQ), QUANDO, a1b.revisao, 'kc1').payload), true);

  console.log('D. reavaliação e "Atualizar com motor atual"');
  const a1c = await ler(AV + '/a1');
  const reav = (id, ant, extra) => {
    const p = T.payloadReavaliacao({ id, audId: 'ar' + id, anteriorId: 'a1', anterior: ant, itemNome: 'Item i1', avaliacaoArquiteturalId: 'i1', versao: 1, motivo: 'Revisar', usuario: usuario(ARQ), agora: QUANDO });
    if (extra) extra(p);
    return p;
  };
  await caso('reavaliar a v1 mantém a v1 (mesmo com a v2 em vigor)', raiz(ARQ).update(reav('r1', a1c)), true);
  await admin(async (d) => { await d.ref(AV + '/r1').remove(); await d.ref(RES + '/i1').remove(); await d.ref(AUDP + '/r1').remove(); });
  await caso('reavaliar trocando para v2 sem a origem "motor" é recusado', raiz(ARQ).update(reav('r2', a1c, (p) => { p[AV + '/r2'].versaoMotor = 2; })), false);
  const at = T.payloadAtualizacaoMotor({ id: 'r3', audId: 'ar3', anteriorId: 'a1', anterior: a1c, itemNome: 'Item i1', avaliacaoArquiteturalId: 'i1', versaoMotorDestino: 2, versaoRedacaoDestino: 1,
    motivo: 'Atualização para o motor v2', usuario: usuario(ARQ), agora: QUANDO });
  await caso('"Atualizar com motor atual": v1 → v2 (origem "motor"), a anterior intacta', raiz(ARQ).update(at.payload), true);
  afirmaRegistro((await ler(AV + '/r3')).versaoMotor === 2 && (await ler(AV + '/r3')).origemReavaliacao === 'motor' && (await ler(AV + '/a1')).status === 'concluido' && (await ler(VIG + '/i1')) === 'a1',
    'nova versão v2 em rascunho; a v1 continua concluída e vigente');
  await admin(async (d) => { await d.ref(AV + '/r3').remove(); await d.ref(RES + '/i1').remove(); await d.ref(AUDP + '/r3').remove(); });
  await vig(3);
  await caso('origem "motor" para uma versão que não é a em vigor é recusada', raiz(ARQ).update(at.payload), false);
  await vig(2);
  const b2v = await ler(AV + '/b2');
  /* o núcleo nem monta isso (destino-nao-e-mais-novo): monta-se como se a anterior fosse v1 e devolve-se a versão real */
  const b2comoV1 = clone(b2v); delete b2comoV1.versaoMotor;
  const atMesma = T.payloadAtualizacaoMotor({ id: 'r4', audId: 'ar4', anteriorId: 'b2', anterior: b2comoV1, itemNome: 'Item i2', avaliacaoArquiteturalId: 'i2', versaoMotorDestino: 2, versaoRedacaoDestino: 1,
    motivo: 'Atualização para o mesmo motor', usuario: usuario(ARQ), agora: QUANDO });
  atMesma.payload[AUDP + '/r4/ar4'].versaoMotorAnterior = 2;
  await caso('origem "motor" para a MESMA versão do registro anterior é recusada (só para uma mais nova)', raiz(ARQ).update(atMesma.payload), false);

  console.log('E. proposta de retorno à v1');
  const alvoV1 = { digestDefinicao: G.digest(NUC.definicao(1)), versaoRedacao: 1, digestRedacao: '0123456789abcdef', digestImpacto: '1111111111111111', impacto: { total: 0, iguais: 0, alterados: 0, incomparaveis: 0, violacoes: 0 } };
  const prop = (pid) => G.montarProposta({ propostaId: pid, auditoriaId: 'ap' + pid, versaoMotor: 1, alvo: alvoV1, justificativa: 'Voltar para a v1', usuario: { uid: 'uid-' + k(ARQ), email: ARQ }, agora: { '.sv': 'timestamp' } });
  await caso('com a v2 em vigor: proposta de retorno à v1 é aceita', db(ARQ).ref().update(prop('pv1')), true);
  await vig(null);
  await caso('com a v1 em vigor: proposta de motor 1 é recusada', db(ARQ).ref().update(prop('pv2')), false);

  await env.cleanup();
  console.log('\n' + (total - falhas) + '/' + total + ' casos.' + (falhas ? ' ' + falhas + ' falha(s).' : ' Tudo certo.'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
function afirmaRegistro(c, msg) { total++; if (c) console.log('  ok    ' + msg); else { falhas++; console.log('  FALHA ' + msg); } }
