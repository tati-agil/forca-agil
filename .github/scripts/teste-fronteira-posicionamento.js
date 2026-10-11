/* B4 — FRONTEIRA CONFIÁVEL do motor de Posicionamento, no emulador real (Realtime Database + Auth + Functions).
 * Roda em teste-rules.yml, job "fronteira" (emulators:exec --only database,auth,functions). Prova:
 *   A. validarRedacaoPublicada: login e perfil conferidos no servidor; recalcula o digest da redação publicada,
 *      o vínculo com o motor e o contrato; válida → registro único (repetir não grava); adulterada → recusada;
 *   B. conferirEntradaEmVigor (só admin geral): recalcula redação, definição, simulação, impacto, prontidão e a
 *      aprovação dupla com os perfis ATUAIS de quem aprovou; cada motivo de recusa; registra SÓ o veredito na
 *      auditoria — vigência, avaliações, decisões e proposta ficam idênticas byte a byte;
 *   C. ativarEntradaEmVigor: desabilitada → recusa sem gravar nada; habilitada (só aqui, no ensaio do emulador) →
 *      vigência + registro + auditoria; repetir não muda nada; duas chamadas simultâneas → uma só; vigência que
 *      mudou no meio → recusa; a proposta consumida não vale de novo; avaliações intactas;
 *   D. equivalência: o impacto e os digests do servidor (functions/site) são os da tela (forca-agil) nos mesmos dados;
 *   E. ponta a ponta pelas Cloud Functions do emulador, com tokens do Auth: sem login → recusa; perfis; a ativação
 *      publicada responde ATIVACAO_DESABILITADA. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RAIZ = path.join(__dirname, '..', '..');
const FN = path.join(RAIZ, 'functions');
const admin = require(path.join(FN, 'node_modules', 'firebase-admin'));
/* FA_FRONTEIRA: outro núcleo (provas de mutação); padrão = functions/fronteira.js */
const { criarFronteira, ioDoAdmin, NOS_FRONTEIRA } = require(process.env.FA_FRONTEIRA || path.join(FN, 'fronteira.js'));
const modulos = require(path.join(FN, 'modulos-site.js'));
const PROJETO = process.env.GCLOUD_PROJECT || 'demo-kyber-agil-fronteira';
const QCOD = 'POSICIONAMENTO_ORGANIZACIONAL';

let total = 0, falhas = 0;
function afirma(c, msg, det) { total++; console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det ? ' → ' + det : '')); if (!c) falhas++; }
const clone = (v) => JSON.parse(JSON.stringify(v));

/* ---- o lado da TELA: os arquivos de forca-agil/ (não a cópia do servidor) ---- */
const tela = (() => {
  const ctx = { console, JSON, Object, Array, String, Math, Number, Date, RegExp, Error, Promise, Set, Map, setTimeout, clearTimeout, setInterval, clearInterval, parseFloat, parseInt, isNaN };
  ctx.window = ctx;
  const el = () => ({ addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, style: {}, classList: { add() {}, remove() {}, contains() { return false; } } });
  ctx.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, addEventListener() {}, body: el(), documentElement: el() };
  ctx.firebase = { database: () => ({ ref: () => ({ on(ev, cb) { cb({ val: () => null }); }, off() {}, once() { return Promise.resolve({ val: () => null }); }, update() {}, child() { return this; }, push() { return { key: 'k' }; } }) }) };
  ctx.navigator = {}; ctx.location = { hash: '' }; ctx.localStorage = { getItem() { return null; }, setItem() {} };
  vm.createContext(ctx);
  ['motor-posicionamento-nucleo.js', 'governanca-posicionamento.js', 'questionarios-config.js', 'motor-arquitetura.js', 'avaliacao-produto.js', 'conteudo-inicial-posicionamento-v2.js', 'motor-posicionamento.js']
    .forEach((f) => vm.runInContext(fs.readFileSync(path.join(RAIZ, 'forca-agil', f), 'utf8'), ctx, { filename: f }));
  return ctx;
})();
const NT = tela.faMotorPosicionamentoNucleo, GT = tela.faGovernancaPosicionamento, QT = tela.faQuestionarios;
const REDACAO = clone(QT.normalizarConteudoMotor(QCOD, tela.faConteudoInicialPosicionamento[2].perguntas, 2).perguntas);
const QUANDO = '2026-10-01T09:00:00.000Z', outra = { name: 'Outra', email: 'o@previ.com.br' };
function concluida(itemId, respostas, diag) {
  const r = { itemId, itemNome: 'Item ' + itemId, avaliacaoArquiteturalId: itemId, questionarioCodigo: QCOD, questionnaireContentVersion: 1, versao: 1, status: 'concluido', revisao: 2,
    respostas: {}, criadoPor: outra, criadoEm: QUANDO, atualizadoPor: outra, atualizadoEm: QUANDO, auditoriaCriacaoId: 'ac' + itemId, concluidoPor: outra, concluidoEm: QUANDO, auditoriaConclusaoId: 'az' + itemId };
  Object.keys(respostas).forEach((q) => { r.respostas[q] = { resposta: respostas[q], codigoPergunta: q, questionnaireContentVersion: 1, dataResposta: QUANDO, textoPerguntaNaEpoca: QT.conteudoPergunta(QCOD, q, 1).texto }; });
  if (diag) r.diagnosticos = { N1: { resposta: diag, papeis: ['AREA_ESPECIALIZADA', 'COE'], textoPerguntaNaEpoca: QT.conteudoPergunta(QCOD, 'DIAG_CONFLITO_RECORTE', 1).texto, questionnaireContentVersion: 1 } };
  const res = tela.faMotorPosicionamento.avaliar(respostas, diag ? { N1: diag } : {}), ra = {};
  Object.keys(res).forEach((k) => { const v = res[k]; if (v !== null && !(Array.isArray(v) && !v.length)) ra[k] = v; });
  r.resultadoAutomatico = ra;
  return r;
}
/* o alvo exatamente como a tela calcula (calcularImpactoPosicionamento + alvoAtual), com os arquivos do site */
function alvoDaTela(db) {
  const vig = db['posicionamento-vigente-por-item'] || {}, regs = db['avaliacoes-posicionamento'] || {}, dec = db['posicionamento-decisoes'] || {};
  const porCodigo = {}; REDACAO.forEach((p) => { porCodigo[p.codigoEstavel] = p; });
  const lista = Object.keys(vig).map((i) => (regs[vig[i]] ? { id: vig[i], reg: regs[vig[i]], decisao: dec[vig[i]] || null } : null)).filter(Boolean);
  const imp = GT.classificarImpacto(NT, { destino: NT.definicao(2), registros: lista,
    conteudoOrigem: (reg, c, v) => QT.conteudoPergunta(QCOD, c, v), conteudoDestino: (c) => porCodigo[c] || null, mesmoConteudo: tela.faCriterioReavaliacao.mesmoConteudo });
  return clone(GT.alvoAtual({ definicao: NT.definicao(2), redacao: { versao: 1, perguntas: REDACAO }, impacto: imp }));
}

const ARQ = 'arq@previ.com.br', ARQ2 = 'arq2@previ.com.br', AVAL = 'aval@previ.com.br', ADM = 'tatianefdirene@previ.com.br', ADM3 = 'adm3@previ.com.br';
const k = (e) => e.replace(/[@.]/g, '_');
const uidDe = (e) => 'uid-' + k(e);
const auth = (e) => ({ uid: uidDe(e), token: { email: e } });
function semente() {
  const db = {
    'fa-admins': { [k(ADM3)]: true },
    'fa-avaliacao-autorizados': { [k(ARQ)]: { email: ARQ, tipo: 'avaliacao-arquitetura' }, [k(ARQ2)]: { email: ARQ2, tipo: 'avaliacao-arquitetura' }, [k(AVAL)]: { email: AVAL, tipo: 'avaliacao' } },
    'questionarios-config': { [QCOD]: { motores: { 2: { versaoPublicada: 1, versoes: { 1: { perguntas: REDACAO, motorCompativel: 2, publicadoEm: 1, publicadoPor: { uid: uidDe(ARQ), email: ARQ }, auditoriaId: 'q1', digestRedacao: GT.digestRedacao(REDACAO) } } } } } },
    'avaliacoes-posicionamento': { gA: concluida('pA', { O1: 'NAO', O2: 'SIM', O3: 'NAO' }), gB: concluida('pB', { O1: 'NAO', O2: 'SIM', O3: 'SIM' }, 'mesma') },
    'posicionamento-vigente-por-item': { pA: 'gA', pB: 'gB' },
    'posicionamento-decisoes': { gA: { itemId: 'pA', codigoFinal: 'AREA_ESPECIALIZADA', tipoDecisao: 'CONFIRMACAO', liberaSquad: false, decididoPor: outra, decididoEm: QUANDO } }
  };
  return db;
}
function proposta(db, o) {
  o = o || {};
  const alvo = Object.assign(alvoDaTela(db), o.alvo || {});
  const rec = { digestImpacto: alvo.digestImpacto, alterados: alvo.impacto.alterados, incomparaveis: alvo.impacto.incomparaveis };
  const ap = (e, adm) => ({ uid: uidDe(e), email: e, em: 1, adminGeral: adm, auditoriaId: 'x', reconhecimento: clone(rec) });
  const p = { versaoMotor: 2, alvo, justificativa: 'j', propostoPor: { uid: uidDe(ARQ), email: ARQ }, propostoEm: 1, situacao: o.situacao || 'aprovada', auditoriaId: 'x',
    aprovacoes: { a1: ap(o.a1 || ARQ2, (o.a1 || ARQ2) === ADM || (o.a1 || ARQ2) === ADM3), a2: ap(o.a2 || ADM, (o.a2 || ADM) === ADM || (o.a2 || ADM) === ADM3) } };
  if (p.situacao === 'aberta') delete p.aprovacoes.a2;
  return p;
}
const SEM_AUD = (db) => { const c = clone(db || {}); delete c[GT.NOS.auditoria]; return JSON.stringify(c); };

(async () => {
  const app = admin.initializeApp({ projectId: PROJETO, databaseURL: 'http://' + (process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1:9000') + '?ns=' + PROJETO }, 'teste'); /* projeto demo-: o emulador de functions usa ns = id do projeto */
  const database = app.database();
  const io = ioDoAdmin(database);
  const F = criarFronteira(io, modulos);
  const ler = async (c) => (await database.ref(c || '/').once('value')).val();
  const contarAud = async (tipo) => Object.values((await ler(GT.NOS.auditoria)) || {}).filter((a) => !tipo || a.tipo === tipo).length;
  async function erroDe(p) { try { await p; return null; } catch (e) { return e.codigo || e.code || String(e); } }
  await database.ref('/').set(null);
  const base = semente();
  base[GT.NOS.propostas] = { pOk: proposta(base), pAberta: proposta(base, { situacao: 'aberta' }), pDef: proposta(base, { alvo: { digestDefinicao: 'ffffffffffffffff' } }),
    pAdm3: proposta(base, { a2: ADM3 }) };
  base[GT.NOS.propostas].pInval = proposta(base); base[GT.NOS.propostas].pInval.aprovacoes.a1.uid = uidDe(ARQ); /* a1 = quem propôs (só escapando das regras) */
  await database.ref('/').set(base);

  console.log('A. validarRedacaoPublicada');
  afirma(await erroDe(F.validarRedacaoPublicada(null, { versaoMotor: 2, versaoRedacao: 1 })) === 'unauthenticated', 'sem login: recusada');
  afirma(await erroDe(F.validarRedacaoPublicada(auth(AVAL), { versaoMotor: 2, versaoRedacao: 1 })) === 'permission-denied', 'perfil Avaliação: recusada');
  afirma(await erroDe(F.validarRedacaoPublicada(auth(ARQ), { versaoMotor: 1, versaoRedacao: 1 })) === 'invalid-argument' && await erroDe(F.validarRedacaoPublicada(auth(ARQ), { versaoMotor: '2', versaoRedacao: 1 })) === 'invalid-argument',
    'versões inválidas (motor 1, texto): recusadas');
  const r0 = await F.validarRedacaoPublicada(auth(ARQ), { versaoMotor: 2, versaoRedacao: 2 });
  afirma(r0.valida === false && r0.motivos.includes('REDACAO_NAO_PUBLICADA') && !(await ler(NOS_FRONTEIRA.redacaoValidada)), 'redação não publicada: inválida, nada registrado como validado');
  const r1 = await F.validarRedacaoPublicada(auth(ARQ), { versaoMotor: 2, versaoRedacao: 1 });
  const val = await ler(NOS_FRONTEIRA.redacaoValidada + '/2/1');
  afirma(r1.valida && !r1.jaValidada && val && val.digestRedacao === GT.digestRedacao(REDACAO) && val.solicitadoPor.uid === uidDe(ARQ), 'Avaliação + Arquitetura valida: registro com o digest recalculado e o UID do token');
  const audV = Object.values(await ler(GT.NOS.auditoria)).filter((a) => a.tipo === 'validacao_redacao');
  afirma(audV.length === 2 && audV.some((a) => a.resultado === 'valida') && audV.some((a) => a.resultado === 'invalida'), 'auditoria do resultado (válida e inválida)');
  const r2 = await F.validarRedacaoPublicada(auth(ADM), { versaoMotor: 2, versaoRedacao: 1 });
  afirma(r2.valida && r2.jaValidada && await contarAud('validacao_redacao') === 2, 'repetir: já validada, nada gravado de novo');

  console.log('B. conferirEntradaEmVigor (só veredito)');
  afirma(await erroDe(F.conferirEntradaEmVigor(auth(ARQ), { propostaId: 'pOk' })) === 'permission-denied', 'Avaliação + Arquitetura não confere (só admin geral)');
  afirma(await erroDe(F.conferirEntradaEmVigor(null, { propostaId: 'pOk' })) === 'unauthenticated', 'sem login: recusada');
  afirma(await erroDe(F.conferirEntradaEmVigor(auth(ADM), { propostaId: '../x' })) === 'invalid-argument', 'propostaId inválido');
  afirma((await F.conferirEntradaEmVigor(auth(ADM), { propostaId: 'nao-existe' })).motivos.join() === 'PROPOSTA_INEXISTENTE', 'proposta inexistente');
  const antes = SEM_AUD(await ler());
  const c1 = await F.conferirEntradaEmVigor(auth(ADM), { propostaId: 'pOk' });
  afirma(c1.apta === true && c1.motivos.length === 0 && c1.ativacaoHabilitada === false, 'proposta aprovada, redação validada, impacto atual: APTA (e a ativação segue desabilitada)', c1.motivos.join());
  afirma(SEM_AUD(await ler()) === antes, 'conferir não altera a vigência, as avaliações, as decisões nem a proposta');
  const audC = Object.values(await ler(GT.NOS.auditoria)).filter((a) => a.tipo === 'conferencia' && a.propostaId === 'pOk');
  afirma(audC.length === 1 && audC[0].apta === true && audC[0].usuario.uid === uidDe(ADM) && audC[0].propostaId === 'pOk', 'o veredito vai para a auditoria, com o UID do token');
  afirma((await F.conferirEntradaEmVigor(auth(ADM), { propostaId: 'pAberta' })).motivos.includes('PROPOSTA_NAO_APROVADA'), 'proposta em aberto: não apta');
  afirma((await F.conferirEntradaEmVigor(auth(ADM), { propostaId: 'pDef' })).motivos.includes('DEFINICAO_DIFERENTE'), 'definição do motor diferente da aprovada: não apta');
  afirma((await F.conferirEntradaEmVigor(auth(ADM), { propostaId: 'pInval' })).motivos.includes('APROVACAO_INVALIDA'), 'aprovação de quem propôs (gravada escapando das regras): não apta');
  await database.ref('fa-avaliacao-autorizados/' + k(ARQ2)).remove();
  afirma((await F.conferirEntradaEmVigor(auth(ADM), { propostaId: 'pOk' })).motivos.includes('APROVADOR_SEM_PERFIL'), 'quem aprovou perdeu o perfil depois: não apta');
  await database.ref('fa-avaliacao-autorizados/' + k(ARQ2)).set({ email: ARQ2, tipo: 'avaliacao-arquitetura' });
  afirma((await F.conferirEntradaEmVigor(auth(ADM), { propostaId: 'pAdm3' })).apta === true, 'admin geral pela lista fa-admins: apta');
  await database.ref('fa-admins/' + k(ADM3)).remove();
  afirma((await F.conferirEntradaEmVigor(auth(ADM), { propostaId: 'pAdm3' })).motivos.includes('SEM_ADMIN_GERAL_ATUAL'), 'o admin geral que aprovou deixou de ser admin: não apta');
  await database.ref('fa-admins/' + k(ADM3)).set(true);
  await database.ref('avaliacoes-posicionamento/gD').set(concluida('pD', { O1: 'SIM', O2: 'NAO', O3: 'NAO' }));
  await database.ref('posicionamento-vigente-por-item/pD').set('gD');
  afirma((await F.conferirEntradaEmVigor(auth(ADM), { propostaId: 'pOk' })).motivos.includes('IMPACTO_DESATUALIZADO'), 'avaliação nova concluída depois da aprovação: IMPACTO_DESATUALIZADO');
  await database.ref('avaliacoes-posicionamento/gD').remove(); await database.ref('posicionamento-vigente-por-item/pD').remove();
  const redPath = 'questionarios-config/' + QCOD + '/motores/2/versoes/1/perguntas/0/texto';
  const textoOriginal = await ler(redPath);
  await database.ref(redPath).set('texto trocado por fora das regras');
  const cAdult = await F.conferirEntradaEmVigor(auth(ADM), { propostaId: 'pOk' });
  afirma(cAdult.motivos.includes('REDACAO_ADULTERADA') && cAdult.motivos.includes('REDACAO_DIFERENTE_DA_PROPOSTA'), 'redação publicada adulterada no banco: não apta');
  afirma((await F.validarRedacaoPublicada(auth(ARQ), { versaoMotor: 2, versaoRedacao: 1 })).motivos.includes('REDACAO_ADULTERADA'), 'e a validação também recusa a redação adulterada');
  await database.ref(redPath).set(textoOriginal);
  const M2 = 'questionarios-config/' + QCOD + '/motores/2';
  await database.ref(M2 + '/versoes/2').set(Object.assign(clone(base['questionarios-config'][QCOD].motores[2].versoes[1]), { auditoriaId: 'q2' }));
  await database.ref(M2 + '/versaoPublicada').set(2);
  afirma((await F.conferirEntradaEmVigor(auth(ADM), { propostaId: 'pOk' })).motivos.includes('REDACAO_NAO_E_A_PUBLICADA_ATUAL'), 'há uma redação publicada mais nova que a da proposta: não apta');
  await database.ref(M2 + '/versaoPublicada').set(1); await database.ref(M2 + '/versoes/2').remove();
  await database.ref(NOS_FRONTEIRA.redacaoValidada).remove();
  afirma((await F.conferirEntradaEmVigor(auth(ADM), { propostaId: 'pOk' })).motivos.includes('PRONTIDAO_REDACAO_VALIDADA_FRONTEIRA'), 'sem a validação da redação pela fronteira: não apta');
  await F.validarRedacaoPublicada(auth(ARQ), { versaoMotor: 2, versaoRedacao: 1 });

  console.log('C. ativarEntradaEmVigor');
  const antesAtivar = JSON.stringify(await ler());
  const dsl = await F.ativarEntradaEmVigor(auth(ADM), { propostaId: 'pOk' }, { habilitada: false });
  afirma(dsl.ativada === false && dsl.motivos.join() === 'ATIVACAO_DESABILITADA' && JSON.stringify(await ler()) === antesAtivar, 'desabilitada (como no servidor publicado): recusa e não grava NADA');
  afirma(await erroDe(F.ativarEntradaEmVigor(auth(ARQ), { propostaId: 'pOk' }, { habilitada: true })) === 'permission-denied', 'Avaliação + Arquitetura não ativa');
  afirma((await F.ativarEntradaEmVigor(auth(ADM), { propostaId: 'pAberta' }, { habilitada: true })).ativada === false && !(await ler(GT.NOS.vigencia)), 'proposta não apta: não ativa, vigência intacta');
  /* vigência que muda entre a conferência e a gravação */
  const ioCorrida = Object.assign({}, io, { transacao: async (c, f) => { await database.ref(c).set({ versaoEmVigor: 1, seq: 7 }); return io.transacao(c, f); } });
  const rc = await criarFronteira(ioCorrida, modulos).ativarEntradaEmVigor(auth(ADM), { propostaId: 'pOk' }, { habilitada: true });
  afirma(rc.ativada === false && rc.motivos.join() === 'VIGENCIA_MUDOU' && (await ler(GT.NOS.vigencia)).seq === 7, 'a vigência mudou no meio: recusa (compare-and-set)');
  await database.ref(GT.NOS.vigencia).remove();
  const avalAntes = JSON.stringify([await ler('avaliacoes-posicionamento'), await ler('posicionamento-decisoes'), await ler('posicionamento-vigente-por-item'), await ler(GT.NOS.propostas)]);
  const par = await Promise.all([F.ativarEntradaEmVigor(auth(ADM), { propostaId: 'pOk' }, { habilitada: true }), F.ativarEntradaEmVigor(auth(ADM), { propostaId: 'pOk' }, { habilitada: true })]);
  const vg = await ler(GT.NOS.vigencia);
  afirma(par.filter((x) => x.ativada && !x.jaAtivada).length === 1 && vg.versaoEmVigor === 2 && vg.seq === 1 && vg.versaoAnterior === 1 && vg.consumidas.pOk === 1 && vg.ativadoPor.uid === uidDe(ADM),
    'ensaio habilitado: duas chamadas simultâneas → uma ativação só (v2, seq 1, quem ativou pelo UID)', JSON.stringify(par));
  const atv = await ler(NOS_FRONTEIRA.ativacoes + '/pOk');
  afirma(atv && atv.seq === 1 && atv.versaoMotor === 2 && atv.digestImpacto === vg.digestImpacto && await contarAud('ativacao') === 1, 'registro da ativação e uma auditoria "ativacao"');
  const rep = await F.ativarEntradaEmVigor(auth(ADM), { propostaId: 'pOk' }, { habilitada: true });
  afirma(rep.ativada && rep.jaAtivada && await contarAud('ativacao') === 1 && (await ler(GT.NOS.vigencia)).seq === 1, 'repetir: devolve a mesma ativação, nada gravado de novo');
  afirma(JSON.stringify([await ler('avaliacoes-posicionamento'), await ler('posicionamento-decisoes'), await ler('posicionamento-vigente-por-item'), await ler(GT.NOS.propostas)]) === avalAntes,
    'avaliações, decisões, vigentes por item e propostas idênticas byte a byte');
  const depois = await F.conferirEntradaEmVigor(auth(ADM), { propostaId: 'pOk' });
  afirma(depois.motivos.includes('PROPOSTA_JA_CONSUMIDA') && depois.motivos.includes('VERSAO_JA_EM_VIGOR'), 'a proposta consumida não vale de novo');
  await database.ref(NOS_FRONTEIRA.ativacoes + '/pOk').remove();
  const rep2 = await F.ativarEntradaEmVigor(auth(ADM), { propostaId: 'pOk' }, { habilitada: true });
  afirma(rep2.jaAtivada && (await ler(NOS_FRONTEIRA.ativacoes + '/pOk')).seq === 1, 'se o registro faltou depois da transação, a repetição o completa (sem nova ativação)');

  console.log('D. equivalência tela × servidor');
  await database.ref(GT.NOS.vigencia).remove();
  const dbAgora = await ler();
  const alvoT = alvoDaTela(dbAgora), cS = await F.conferirEntradaEmVigor(auth(ADM), { propostaId: 'pAdm3' });
  afirma(cS.detalhes.digestImpacto === alvoT.digestImpacto && cS.detalhes.digestDefinicao === alvoT.digestDefinicao && cS.detalhes.digestRedacao === alvoT.digestRedacao &&
    JSON.stringify(cS.detalhes.impacto) === JSON.stringify(alvoT.impacto), 'impacto e digests do servidor = os da tela, nos mesmos dados', JSON.stringify([cS.detalhes, alvoT]));
  afirma(cS.detalhes.simulacao.violacoesLinhaSquad === 0 && cS.detalhes.simulacao.totalEstados === NT.simular(NT.definicao(1), NT.definicao(2)).totalEstados, 'simulação no servidor: mesmos estados, 0 violações');

  console.log('E. ponta a ponta pelas Cloud Functions do emulador');
  const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST, FUN = process.env.FUNCTIONS_EMULATOR_HOST || '127.0.0.1:5001';
  if (!AUTH) { afirma(false, 'emulador de Auth/Functions ativo (rode com emulators:exec --only database,auth,functions)'); }
  else {
    await database.ref('/').set(Object.assign(semente(), { [GT.NOS.propostas]: { pOk: proposta(semente()) } }));
    /* cria a conta no emulador de Auth (ou entra, se outra execução da mesma sessão já criou) */
    async function token(email) {
      const corpo = JSON.stringify({ email, password: 'senha-de-teste', returnSecureToken: true }), h = { 'Content-Type': 'application/json' };
      const novo = await (await fetch('http://' + AUTH + '/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake', { method: 'POST', headers: h, body: corpo })).json();
      if (novo.idToken) return novo.idToken;
      return (await (await fetch('http://' + AUTH + '/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake', { method: 'POST', headers: h, body: corpo })).json()).idToken;
    }
    async function chamar(nome, dados, idToken) {
      const r = await fetch('http://' + FUN + '/' + PROJETO + '/us-central1/' + nome, { method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, idToken ? { Authorization: 'Bearer ' + idToken } : {}), body: JSON.stringify({ data: dados }) });
      return r.json();
    }
    const [tArq, tAval, tAdm] = [await token(ARQ), await token(AVAL), await token(ADM)];
    const semLogin = await chamar('validarRedacaoPublicada', { versaoMotor: 2, versaoRedacao: 1 });
    afirma(semLogin.error && semLogin.error.status === 'UNAUTHENTICATED', 'sem token: UNAUTHENTICATED', JSON.stringify(semLogin));
    const aval = await chamar('validarRedacaoPublicada', { versaoMotor: 2, versaoRedacao: 1 }, tAval);
    afirma(aval.error && aval.error.status === 'PERMISSION_DENIED', 'perfil Avaliação: PERMISSION_DENIED', JSON.stringify(aval));
    const val2 = await chamar('validarRedacaoPublicada', { versaoMotor: 2, versaoRedacao: 1 }, tArq);
    afirma(val2.result && val2.result.valida === true, 'Avaliação + Arquitetura valida a redação pela função', JSON.stringify(val2));
    const regV = await ler(NOS_FRONTEIRA.redacaoValidada + '/2/1');
    afirma(regV && regV.solicitadoPor.email === ARQ && typeof regV.solicitadoPor.uid === 'string' && regV.solicitadoPor.uid.length > 0, 'registro com a identidade do TOKEN (UID do Auth)');
    const conf = await chamar('conferirEntradaEmVigor', { propostaId: 'pOk' }, tAdm);
    afirma(conf.result && conf.result.apta === true && conf.result.ativacaoHabilitada === false, 'admin geral confere pela função: apta, ativação desabilitada', JSON.stringify(conf).slice(0, 300));
    const atvF = await chamar('ativarEntradaEmVigor', { propostaId: 'pOk' }, tAdm);
    afirma(atvF.result && atvF.result.ativada === false && atvF.result.motivos.join() === 'ATIVACAO_DESABILITADA' && !(await ler(GT.NOS.vigencia)), 'a função publicada de ativação: ATIVACAO_DESABILITADA, vigência sem registro');
  }
  await app.delete();
  console.log('\n' + (total - falhas) + '/' + total + ' verificações.' + (falhas ? ' ' + falhas + ' falha(s).' : ' Tudo certo.'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
