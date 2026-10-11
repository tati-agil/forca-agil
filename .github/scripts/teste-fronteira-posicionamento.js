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
 *      publicada responde ATIVACAO_DESABILITADA;
 *   H3-b (o gravador do servidor é a identidade restrita 'fronteira-confiavel' — passa pelas REGRAS, carregadas aqui):
 *   F. atomicidade nas regras: gravação de ativação incompleta, com sequência errada, proposta não aprovada ou já
 *      consumida é recusada; duas ativações simultâneas → uma só; a identidade restrita não grava fora do que é dela;
 *   G. retorno governado à v1 (proposta de motor 1, redação da trilha principal validada no servidor) — nova ativação;
 *   I. avaliação v2 concluída pela fronteira: o resultado é o do núcleo do motor, com vigente e auditoria; v1 recusada;
 *      revisão velha recusada; base que mudou recusada; as avaliações v1 existentes intactas. */
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
function alvoDaTela(db, o) {
  o = o || {};
  const versao = o.versao || 2, red = o.redacao || { versao: 1, perguntas: REDACAO };
  const vig = db['posicionamento-vigente-por-item'] || {}, regs = db['avaliacoes-posicionamento'] || {}, dec = db['posicionamento-decisoes'] || {};
  const porCodigo = {}; red.perguntas.forEach((p) => { porCodigo[p.codigoEstavel] = p; });
  const lista = Object.keys(vig).map((i) => (regs[vig[i]] ? { id: vig[i], reg: regs[vig[i]], decisao: dec[vig[i]] || null } : null)).filter(Boolean);
  const imp = GT.classificarImpacto(NT, { destino: NT.definicao(versao), registros: lista,
    conteudoOrigem: (reg, c, v) => QT.conteudoPergunta(QCOD, c, v), conteudoDestino: (c) => porCodigo[c] || null, mesmoConteudo: tela.faCriterioReavaliacao.mesmoConteudo });
  return clone(GT.alvoAtual({ definicao: NT.definicao(versao), redacao: red, impacto: imp }));
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
  const alvo = o.alvoCompleto || Object.assign(alvoDaTela(db), o.alvo || {});
  const rec = { digestImpacto: alvo.digestImpacto, alterados: alvo.impacto.alterados, incomparaveis: alvo.impacto.incomparaveis };
  const ap = (e, adm) => ({ uid: uidDe(e), email: e, em: 1, adminGeral: adm, auditoriaId: 'x', reconhecimento: clone(rec) });
  const p = { versaoMotor: o.versaoMotor || 2, alvo, justificativa: 'j', propostoPor: { uid: uidDe(ARQ), email: ARQ }, propostoEm: 1, situacao: o.situacao || 'aprovada', auditoriaId: 'x',
    aprovacoes: { a1: ap(o.a1 || ARQ2, (o.a1 || ARQ2) === ADM || (o.a1 || ARQ2) === ADM3), a2: ap(o.a2 || ADM, (o.a2 || ADM) === ADM || (o.a2 || ADM) === ADM3) } };
  if (p.situacao === 'aberta') delete p.aprovacoes.a2;
  return p;
}
const SEM_AUD = (db) => { const c = clone(db || {}); delete c[GT.NOS.auditoria]; return JSON.stringify(c); };

(async () => {
  const app = admin.initializeApp({ projectId: PROJETO, databaseURL: 'http://' + (process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1:9000') + '?ns=' + PROJETO }, 'teste'); /* projeto demo-: o emulador de functions usa ns = id do projeto */
  const database = app.database();
  /* as regras do banco (o fonte legível = o artefato publicado) no namespace deste teste: o gravador restrito passa por elas */
  const HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1:9000';
  const rr = await fetch('http://' + HOST + '/.settings/rules.json?ns=' + PROJETO, { method: 'PUT', headers: { Authorization: 'Bearer owner' }, body: fs.readFileSync(process.env.FA_REGRAS || path.join(RAIZ, 'database.rules.json'), 'utf8') }); /* FA_REGRAS: provas de mutação */
  if (!rr.ok) throw new Error('não carregou as regras: ' + rr.status);
  const restritoApp = admin.initializeApp({ projectId: PROJETO, databaseURL: 'http://' + HOST + '?ns=' + PROJETO, databaseAuthVariableOverride: { uid: 'fronteira-confiavel' } }, 'restrito');
  const restrito = restritoApp.database();
  const io = ioDoAdmin(database, restrito, admin.database.ServerValue.TIMESTAMP);
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
  afirma(await erroDe(F.validarRedacaoPublicada(auth(ARQ), { versaoMotor: 0, versaoRedacao: 1 })) === 'invalid-argument' && await erroDe(F.validarRedacaoPublicada(auth(ARQ), { versaoMotor: '2', versaoRedacao: 1 })) === 'invalid-argument',
    'versões inválidas (motor 0, texto): recusadas');
  const r0 = await F.validarRedacaoPublicada(auth(ARQ), { versaoMotor: 2, versaoRedacao: 2 });
  afirma(r0.valida === false && r0.motivos.includes('REDACAO_NAO_PUBLICADA') && !(await ler(NOS_FRONTEIRA.redacaoValidada)), 'redação não publicada: inválida, nada registrado como validado', JSON.stringify(r0));
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

  console.log('C. ativarEntradaEmVigor (uma gravação, pelas regras)');
  const antesAtivar = JSON.stringify(await ler());
  const dsl = await F.ativarEntradaEmVigor(auth(ADM), { propostaId: 'pOk' }, { habilitada: false });
  afirma(dsl.ativada === false && dsl.motivos.join() === 'ATIVACAO_DESABILITADA' && JSON.stringify(await ler()) === antesAtivar, 'desabilitada (como no servidor publicado): recusa e não grava NADA');
  afirma(await erroDe(F.ativarEntradaEmVigor(auth(ARQ), { propostaId: 'pOk' }, { habilitada: true })) === 'permission-denied', 'Avaliação + Arquitetura não ativa');
  afirma((await F.ativarEntradaEmVigor(auth(ADM), { propostaId: 'pAberta' }, { habilitada: true })).ativada === false && !(await ler(GT.NOS.vigencia)), 'proposta não apta: não ativa, vigência intacta');
  /* aprovada, mas o impacto mudou depois da aprovação: as regras não recalculam o impacto — quem recusa é o servidor */
  await database.ref('avaliacoes-posicionamento/gD').set(concluida('pD', { O1: 'SIM', O2: 'NAO', O3: 'NAO' }));
  await database.ref('posicionamento-vigente-por-item/pD').set('gD');
  const rImp = await F.ativarEntradaEmVigor(auth(ADM), { propostaId: 'pOk' }, { habilitada: true });
  afirma(rImp.ativada === false && rImp.motivos.includes('IMPACTO_DESATUALIZADO') && !(await ler(GT.NOS.vigencia)) && !(await ler(NOS_FRONTEIRA.ativacoes)),
    'aprovada mas com o impacto desatualizado: o servidor recalcula e não ativa (nada gravado)', JSON.stringify(rImp));
  await database.ref('avaliacoes-posicionamento/gD').remove(); await database.ref('posicionamento-vigente-por-item/pD').remove();
  /* a vigência muda entre a conferência e a gravação: as regras recusam (compare-and-set da sequência) */
  const ioCorrida = Object.assign({}, io, { gravar: async (w) => { await database.ref(GT.NOS.vigencia).set({ versaoEmVigor: 1, seq: 7 }); return io.gravar(w); } });
  const rc = await criarFronteira(ioCorrida, modulos).ativarEntradaEmVigor(auth(ADM), { propostaId: 'pOk' }, { habilitada: true });
  afirma(rc.ativada === false && rc.motivos.join() === 'VIGENCIA_MUDOU' && (await ler(GT.NOS.vigencia)).seq === 7 && !(await ler(NOS_FRONTEIRA.ativacoes)), 'a vigência mudou no meio: as regras recusam a gravação inteira');
  await database.ref(GT.NOS.vigencia).remove();
  const avalAntes = JSON.stringify([await ler('avaliacoes-posicionamento'), await ler('posicionamento-decisoes'), await ler('posicionamento-vigente-por-item'), await ler(GT.NOS.propostas)]);
  /* duas propostas diferentes ao mesmo tempo: as duas partem da sequência 0, só uma entra */
  const par2 = await Promise.all([F.ativarEntradaEmVigor(auth(ADM), { propostaId: 'pOk' }, { habilitada: true }), F.ativarEntradaEmVigor(auth(ADM), { propostaId: 'pAdm3' }, { habilitada: true })]);
  afirma(par2.filter((x) => x.ativada).length === 1 && par2.filter((x) => !x.ativada && /VIGENCIA_MUDOU|VERSAO_JA_EM_VIGOR/.test(x.motivos.join())).length === 1 && (await ler(GT.NOS.vigencia)).seq === 1,
    'duas ativações simultâneas (propostas diferentes): uma só entra, a outra é recusada', JSON.stringify(par2));
  const ganhou = par2[0].ativada ? 'pOk' : 'pAdm3', perdeu = ganhou === 'pOk' ? 'pAdm3' : 'pOk';
  afirma(!(await ler(NOS_FRONTEIRA.ativacoes + '/' + perdeu)) && await contarAud('ativacao') === 1, 'a recusada não deixa registro nem auditoria');
  /* a mesma proposta duas vezes ao mesmo tempo */
  await database.ref(GT.NOS.vigencia).remove(); await database.ref(NOS_FRONTEIRA.ativacoes).remove();
  const audsAtv = Object.entries((await ler(GT.NOS.auditoria)) || {}).filter(([, a]) => a.tipo === 'ativacao').map(([k]) => k);
  for (const k of audsAtv) await database.ref(GT.NOS.auditoria + '/' + k).remove();
  const par = await Promise.all([F.ativarEntradaEmVigor(auth(ADM), { propostaId: 'pOk' }, { habilitada: true }), F.ativarEntradaEmVigor(auth(ADM), { propostaId: 'pOk' }, { habilitada: true })]);
  const vg = await ler(GT.NOS.vigencia);
  afirma(par.filter((x) => x.ativada).length === 1 && par.filter((x) => !x.ativada && x.motivos.join() === 'PROPOSTA_JA_CONSUMIDA').length === 1 &&
    vg.versaoEmVigor === 2 && vg.seq === 1 && vg.versaoAnterior === 1 && vg.propostaId === 'pOk' && vg.ativadoPor.uid === uidDe(ADM) && typeof vg.ativadoEm === 'number',
    'a mesma proposta duas vezes ao mesmo tempo: uma ativação (v2, seq 1, quem ativou pelo UID, horário do servidor)', JSON.stringify(par));
  const atv = await ler(NOS_FRONTEIRA.ativacoes + '/pOk');
  const audAtv = (await ler(GT.NOS.auditoria + '/' + vg.auditoriaId)) || {};
  afirma(atv && atv.seq === 1 && atv.versaoMotor === 2 && atv.auditoriaId === vg.auditoriaId && audAtv.tipo === 'ativacao' && audAtv.seq === 1 && await contarAud('ativacao') === 1,
    'vigência, registro da ativação e auditoria juntos, apontando uns para os outros');
  const rep = await F.ativarEntradaEmVigor(auth(ADM), { propostaId: 'pOk' }, { habilitada: true });
  afirma(rep.ativada && rep.jaAtivada && await contarAud('ativacao') === 1 && (await ler(GT.NOS.vigencia)).seq === 1, 'repetir: devolve a mesma ativação, nada gravado de novo');
  afirma(JSON.stringify([await ler('avaliacoes-posicionamento'), await ler('posicionamento-decisoes'), await ler('posicionamento-vigente-por-item'), await ler(GT.NOS.propostas)]) === avalAntes,
    'avaliações, decisões, vigentes por item e propostas idênticas byte a byte');
  const depois = await F.conferirEntradaEmVigor(auth(ADM), { propostaId: 'pOk' });
  afirma(depois.motivos.includes('PROPOSTA_JA_CONSUMIDA') && depois.motivos.includes('VERSAO_JA_EM_VIGOR'), 'a proposta consumida não vale de novo');

  console.log('G. retorno governado à v1');
  const cfgDb = await ler('questionarios-config/' + QCOD);
  const QV1 = (cod, v) => QT.conteudoPergunta(QCOD, cod, v);
  const redV1 = GT.redacaoDaTrilhaPrincipal(NT, QV1, QT.situacao(QCOD).versaoPublicada);
  const alvoV1 = alvoDaTela(await ler(), { versao: 1, redacao: redV1 });
  const pV1 = proposta(base, { alvoCompleto: alvoV1, versaoMotor: 1 });
  await database.ref(GT.NOS.propostas + '/pV1').set(pV1);
  const val1 = await F.validarRedacaoPublicada(auth(ARQ), { versaoMotor: 1, versaoRedacao: redV1.versao });
  afirma(val1.valida && val1.digestRedacao === GT.digestRedacao(redV1.perguntas) && (await ler(NOS_FRONTEIRA.redacaoValidada + '/1/' + redV1.versao)).digestRedacao === val1.digestRedacao,
    'a redação da v1 (trilha principal) é validada no servidor, com o mesmo identificador da tela', JSON.stringify(val1));
  afirma((await F.validarRedacaoPublicada(auth(ARQ), { versaoMotor: 1, versaoRedacao: redV1.versao + 1 })).motivos.includes('REDACAO_NAO_PUBLICADA'), 'versão da trilha principal que não é a publicada: recusada');
  const cV1 = await F.conferirEntradaEmVigor(auth(ADM), { propostaId: 'pV1' }, { habilitada: true });
  afirma(cV1.apta === true && cV1.ativacaoHabilitada === true, 'retorno à v1 aprovado e conferido: apto', cV1.motivos.join());
  const aV1 = await F.ativarEntradaEmVigor(auth(ADM), { propostaId: 'pV1' }, { habilitada: true });
  const vg1 = await ler(GT.NOS.vigencia);
  afirma(aV1.ativada && vg1.versaoEmVigor === 1 && vg1.versaoAnterior === 2 && vg1.seq === 2 && (await ler(NOS_FRONTEIRA.ativacoes + '/pOk')).seq === 1 && (await ler(NOS_FRONTEIRA.ativacoes + '/pV1')).seq === 2,
    'retorno à v1 = nova ativação (seq 2); a ativação da v2 continua no histórico');
  afirma(JSON.stringify([await ler('avaliacoes-posicionamento'), await ler('posicionamento-decisoes'), await ler('posicionamento-vigente-por-item')]) === JSON.stringify(JSON.parse(avalAntes).slice(0, 3)),
    'nenhuma avaliação, decisão ou vigente mudou com as ativações');

  console.log('F. atomicidade: as regras recusam gravações incompletas do próprio servidor');
  const vgF = await ler(GT.NOS.vigencia), TS = admin.database.ServerValue.TIMESTAMP;
  const pAdm3 = await ler(GT.NOS.propostas + '/pAdm3');
  function ativacaoManual(o) {
    o = o || {};
    const seq = o.seq || vgF.seq + 1, aud = o.aud || ('m' + Math.random().toString(36).slice(2, 9)), pid = o.pid || 'pAdm3', alvo = (o.prop || pAdm3).alvo, por = { uid: uidDe(ADM), email: ADM };
    const comum = { versaoRedacao: alvo.versaoRedacao, digestRedacao: alvo.digestRedacao, digestDefinicao: alvo.digestDefinicao, digestImpacto: alvo.digestImpacto, ativadoEm: TS, ativadoPor: por, auditoriaId: aud };
    const w = { [GT.NOS.vigencia]: Object.assign({ versaoEmVigor: o.versao || 2, versaoAnterior: vgF.versaoEmVigor, seq, propostaId: pid }, comum),
      [NOS_FRONTEIRA.ativacoes + '/' + pid]: Object.assign({ seq, versaoMotor: o.versao || 2, versaoAnterior: vgF.versaoEmVigor }, comum),
      [GT.NOS.auditoria + '/' + aud]: { tipo: 'ativacao', propostaId: pid, versaoMotor: o.versao || 2, versaoAnterior: vgF.versaoEmVigor, seq, usuario: por, dataHora: TS, origem: 'fronteira' } };
    if (o.mexer) o.mexer(w, aud, pid);
    return w;
  }
  async function recusa(nome, w) { let ok = false; try { await restrito.ref().update(w); } catch (e) { ok = true; } afirma(ok, nome); }
  /* depois do retorno à v1 (seção G), pAdm3 — aprovada para a v2 e nunca consumida — é uma ativação VÁLIDA: cada caso
     abaixo é essa gravação com UMA coisa faltando ou errada (o controle positivo, no fim, prova que a base é aceita) */
  await recusa('reativar a versão que já está em vigor (v1 → v1)', ativacaoManual({ versao: 1, mexer: (w) => { w[GT.NOS.vigencia].versaoAnterior = 1; } }));
  await recusa('versão diferente da aprovada na proposta (v3)', ativacaoManual({ versao: 3 }));
  await recusa('versão anterior que não é a em vigor', ativacaoManual({ mexer: (w) => { w[GT.NOS.vigencia].versaoAnterior = 5; } }));
  await recusa('só a vigência, sem registro nem auditoria', (() => { const w = ativacaoManual(); return { [GT.NOS.vigencia]: w[GT.NOS.vigencia] }; })());
  await recusa('vigência + registro, sem auditoria', ativacaoManual({ mexer: (w, aud) => { delete w[GT.NOS.auditoria + '/' + aud]; } }));
  await recusa('vigência + auditoria, sem registro da ativação', ativacaoManual({ mexer: (w, aud, pid) => { delete w[NOS_FRONTEIRA.ativacoes + '/' + pid]; } }));
  await recusa('sequência pulada (+2 em vez de +1)', ativacaoManual({ seq: vgF.seq + 2 }));
  await recusa('proposta já consumida (pOk) de novo', ativacaoManual({ pid: 'pOk', prop: await ler(GT.NOS.propostas + '/pOk') }));
  await recusa('proposta não aprovada (pAberta)', ativacaoManual({ pid: 'pAberta', prop: await ler(GT.NOS.propostas + '/pAberta') }));
  await recusa('identificador do impacto diferente do aprovado', ativacaoManual({ mexer: (w) => { w[GT.NOS.vigencia].digestImpacto = 'ffffffffffffffff'; } }));
  await recusa('horário escolhido pelo servidor (não o "now" do banco)', ativacaoManual({ mexer: (w) => { w[GT.NOS.vigencia].ativadoEm = 1700000000000; } }));
  await recusa('apagar a vigência', { [GT.NOS.vigencia]: null });
  await recusa('só o registro da ativação, sem a vigência', (() => { const w = ativacaoManual(); return { [NOS_FRONTEIRA.ativacoes + '/pAdm3']: w[NOS_FRONTEIRA.ativacoes + '/pAdm3'] }; })());
  await recusa('reescrever um registro de ativação já feito (o da vigência atual)', { [NOS_FRONTEIRA.ativacoes + '/' + vgF.propostaId + '/ativadoPor/email']: 'outra@previ.com.br' });
  await recusa('a identidade restrita não grava fora do que é dela (fa-admins)', { ['fa-admins/x_y']: true });
  await recusa('nem decisões', { ['posicionamento-decisoes/gA']: { itemId: 'pA' } });
  await recusa('nem apaga o registro de uma ativação', { [NOS_FRONTEIRA.ativacoes + '/pOk']: null });
  /* um CLIENTE (mesmo admin geral, com sessão) não grava a vigência — nem a gravação completa e válida */
  const cliente = (admin.apps.find((a) => a && a.name === 'cliente-adm') || admin.initializeApp(Object.assign({}, app.options, { databaseAuthVariableOverride: { uid: uidDe(ADM), token: { email: ADM, email_verified: true } } }), 'cliente-adm')).database();
  { let ok = false; try { await cliente.ref().update(ativacaoManual()); } catch (e) { ok = true; } afirma(ok, 'admin geral pelo cliente não ativa (só a identidade restrita)'); }
  afirma(JSON.stringify(await ler(GT.NOS.vigencia)) === JSON.stringify(vgF), 'depois de tudo isso, a vigência é exatamente a de antes');
  /* controle positivo: a mesma gravação, completa e correta, É aceita — as recusas acima foram pelo que faltava */
  { let ok = true; try { await restrito.ref().update(ativacaoManual()); } catch (e) { ok = false; } const vgP = await ler(GT.NOS.vigencia);
    afirma(ok && vgP.versaoEmVigor === 2 && vgP.seq === vgF.seq + 1 && (await ler(NOS_FRONTEIRA.ativacoes + '/pAdm3')).seq === vgF.seq + 1, 'controle: a ativação completa (vigência + registro + auditoria) é aceita'); }

  console.log('I. avaliação v2 concluída pela fronteira');
  const MOTOR_PRODUTO = require('./montar-regras-posicionamento.js').MOTOR_PRODUTO;
  await database.ref('avaliacoes-produto/pV').set({ itemId: 'pV', nome: 'Item V', status: 'concluido', excluido: false, versao: 1, motorVersion: MOTOR_PRODUTO, motorVersionArquitetura: 1 });
  const rv2 = (q, v) => ({ resposta: v, codigoPergunta: q, questionnaireContentVersion: 1, dataResposta: QUANDO });
  const rasc = { itemId: 'pV', itemNome: 'Item V', avaliacaoArquiteturalId: 'pV', questionarioCodigo: QCOD, questionnaireContentVersion: 1, versao: 1, versaoMotor: 2, status: 'rascunho', revisao: 3,
    respostas: { O1: rv2('O1', 'NAO'), O2: rv2('O2', 'SIM'), O3: rv2('O3', 'NAO') }, criadoPor: outra, criadoEm: QUANDO, atualizadoPor: outra, atualizadoEm: QUANDO, auditoriaCriacaoId: 'acV' };
  await database.ref('avaliacoes-posicionamento/gV').set(rasc);
  await database.ref('posicionamento-rascunho-por-item/pV').set('gV');
  const v1Antes = JSON.stringify([await ler('avaliacoes-posicionamento/gA'), await ler('avaliacoes-posicionamento/gB'), await ler('posicionamento-decisoes')]);
  afirma(await erroDe(F.concluirAvaliacaoPosicionamento(auth(AVAL), { avaliacaoId: 'gV', revisao: 3 })) === 'permission-denied', 'perfil Avaliação não conclui');
  afirma((await F.concluirAvaliacaoPosicionamento(auth(ARQ), { avaliacaoId: 'gV', revisao: 2 })).motivos.join() === 'REVISAO_DESATUALIZADA', 'revisão velha: recusada (nada gravado)');
  afirma((await F.concluirAvaliacaoPosicionamento(auth(ARQ), { avaliacaoId: 'gA', revisao: 2 })).motivos.join() === 'NAO_E_RASCUNHO', 'avaliação já concluída: recusada');
  await database.ref('avaliacoes-produto/pV2').set({ itemId: 'pV', status: 'concluido', excluido: false, versao: 2, versaoAnteriorKey: 'pV', motorVersion: MOTOR_PRODUTO, motorVersionArquitetura: 1 });
  afirma((await F.concluirAvaliacaoPosicionamento(auth(ARQ), { avaliacaoId: 'gV', revisao: 3 })).motivos.join() === 'BASE_MUDOU', 'a base P1–P16 que vale hoje não é a do rascunho: recusada');
  await database.ref('avaliacoes-produto/pV2').remove();
  await database.ref('avaliacoes-posicionamento/gV/respostas/O3').remove();
  afirma((await F.concluirAvaliacaoPosicionamento(auth(ARQ), { avaliacaoId: 'gV', revisao: 3 })).motivos.join() === 'FALTAM_RESPOSTAS' && (await ler('avaliacoes-posicionamento/gV')).status === 'rascunho',
    'caminho incompleto: o servidor não conclui (as regras não conferem a completude da v2 — quem confere é o núcleo)');
  await database.ref('avaliacoes-posicionamento/gV/respostas/O3').set(rv2('O3', 'NAO'));
  const cc = await F.concluirAvaliacaoPosicionamento(auth(ARQ), { avaliacaoId: 'gV', revisao: 3 });
  const gV = await ler('avaliacoes-posicionamento/gV'), esperado = NT.avaliar(NT.definicao(2), { O1: 'NAO', O2: 'SIM', O3: 'NAO' }, {}, {});
  afirma(cc.concluida && gV.status === 'concluido' && gV.resultadoAutomatico.codigoResultado === esperado.codigoResultado && gV.resultadoAutomatico.versaoMotor === 2 &&
    gV.resultadoAutomatico.liberaSquad === esperado.liberaSquad && gV.concluidoPor.email === ARQ && gV.revisao === 4, 'concluída pelo servidor com o resultado do núcleo do motor v2', JSON.stringify(cc));
  const audsV = Object.values((await ler('posicionamento-auditoria/gV')) || {});
  afirma((await ler('posicionamento-vigente-por-item/pV')) === 'gV' && !(await ler('posicionamento-rascunho-por-item/pV')) && audsV.some((a) => a.tipo === 'conclusao' && a.versaoMotor === 2),
    'vigente do item, reserva liberada e auditoria "conclusao" na mesma gravação');
  afirma((await F.concluirAvaliacaoPosicionamento(auth(ARQ), { avaliacaoId: 'gV', revisao: 4 })).motivos.join() === 'NAO_E_RASCUNHO', 'repetir: já concluída, nada muda');
  await database.ref('avaliacoes-posicionamento/gW').set(Object.assign({}, rasc, { itemId: 'pA', avaliacaoArquiteturalId: 'pA', versaoMotor: null }));
  afirma((await F.concluirAvaliacaoPosicionamento(auth(ARQ), { avaliacaoId: 'gW', revisao: 3 })).motivos.join() === 'CONCLUSAO_PELA_TELA', 'avaliação v1: o servidor não conclui (é da tela)');
  await database.ref('avaliacoes-posicionamento/gW').remove();
  afirma(JSON.stringify([await ler('avaliacoes-posicionamento/gA'), await ler('avaliacoes-posicionamento/gB'), await ler('posicionamento-decisoes')]) === v1Antes, 'as avaliações v1 existentes e as decisões ficam idênticas');
  /* a regra também recusa: a identidade restrita não conclui v1 nem altera o que é fixo */
  await database.ref('avaliacoes-posicionamento/gX').set(Object.assign({}, rasc, { itemId: 'pX', avaliacaoArquiteturalId: 'pV', versaoMotor: null, revisao: 1 }));
  await recusa('a fronteira não conclui avaliação v1 (nem pelas regras)', { ['avaliacoes-posicionamento/gX/status']: 'concluido' });
  await database.ref('avaliacoes-posicionamento/gX').remove();

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
    /* a função publicada grava COM a identidade restrita: com as regras fechando a auditoria, a conferência é recusada */
    const regrasTxt = fs.readFileSync(process.env.FA_REGRAS || path.join(RAIZ, 'database.rules.json'), 'utf8'), regrasJ = JSON.parse(regrasTxt);
    regrasJ.rules[GT.NOS.auditoria]['$auditoriaId']['.write'] = false;
    await fetch('http://' + HOST + '/.settings/rules.json?ns=' + PROJETO, { method: 'PUT', headers: { Authorization: 'Bearer owner' }, body: JSON.stringify(regrasJ) });
    const fechada = await chamar('conferirEntradaEmVigor', { propostaId: 'pOk' }, tAdm);
    await fetch('http://' + HOST + '/.settings/rules.json?ns=' + PROJETO, { method: 'PUT', headers: { Authorization: 'Bearer owner' }, body: regrasTxt });
    afirma(fechada.error && fechada.error.status === 'INTERNAL', 'a função grava pelas REGRAS (identidade restrita): auditoria fechada → a conferência não grava', JSON.stringify(fechada));
    const conclF = await chamar('concluirAvaliacaoPosicionamento', { avaliacaoId: 'naoExiste', revisao: 1 }, tArq);
    afirma(conclF.result && conclF.result.concluida === false && conclF.result.motivos.join() === 'AVALIACAO_INEXISTENTE', 'a função de conclusão v2 está publicada e responde', JSON.stringify(conclF));
    afirma(conf.result && conf.result.ativacaoHabilitada === false, 'a conferência publicada informa que a ativação está desabilitada');
  }
  await app.delete();
  console.log('\n' + (total - falhas) + '/' + total + ' verificações.' + (falhas ? ' ' + falhas + ' falha(s).' : ' Tudo certo.'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
