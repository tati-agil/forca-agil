/* Conversão "Contar turmas de outros eventos" → "Impedir nova participação" (converter-contar-turmas.js).
 *
 * POR QUE ESTE TESTE EXISTE
 * A conversão tira do banco o terceiro mecanismo (umaTurmaComEventos), que hoje é o que torna os Episódios III e IV
 * excludentes. A promessa é que NINGUÉM passe a entrar ou a ser barrado por causa dela — só a mensagem muda. O teste
 * prova isso com o próprio código de decisão (faTurmasUtil.regrasDeEntrada, turmas-util.js) rodando sobre um banco
 * sintético ANTES e DEPOIS da conversão, para a pessoa e para a lista de espera.
 *
 * Sem navegador e sem rede (um Firebase mínimo em memória). Dados 100% sintéticos. O QUE ELE EXIGE:
 *   P. o plano: só os eventos com o campo antigo; com "uma turma" ligada, o outro episódio entra em "Impedir nova
 *      participação" (sem tirar nada do que já estava); com "uma turma" desligada, nada é acrescentado (o campo não valia)
 *      — só o histórico; o próprio evento nunca; assinatura que não depende de quando/quem;
 *   I. idempotência: depois de aplicada, um novo plano é vazio; validar não acha nada; eventos fora do plano idênticos;
 *   D. decisões iguais antes/depois (bloqueado × livre) em todos os cenários: nunca participou; interesse ativo,
 *      inscrição confirmada e participação em turma já realizada num evento impeditivo; interesse removido; outra turma do
 *      próprio evento (uma turma, independente); III → IV e IV → III; evento com o campo antigo dormente; lista de espera;
 *   V. a validação acusa uma conversão adulterada (perda de bloqueio, campo de fora mudado).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const C = require('./converter-contar-turmas.js');

let falhas = 0, oks = 0;
const anota = (r, ok, d) => { if (ok) { oks++; console.log('  ok    ' + r); } else { falhas++; console.error('  FALHA ' + r + (d ? ' — ' + d : '')); } };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

/* banco sintético no formato dos registros reais (os eventos espelham a configuração de III e IV) */
const ev = (nome, extra) => Object.assign({ nome, publicado: true, order: 1 }, extra || {});
const EVENTOS = {
  evI: ev('EPISODIO I SINT'), evIID: ev('EPISODIO II D SINT'), evIIE: ev('EPISODIO II E SINT'),
  evIII: ev('EPISODIO III SINT', { bloqueiaParticipantesDe: { evI: true, evIID: true, evIIE: true }, umaTurmaPorPessoa: true, umaTurmaComEventos: { evIV: true } }),
  evIV: ev('EPISODIO IV SINT', { bloqueiaParticipantesDe: { evI: true, evIID: true, evIIE: true }, umaTurmaPorPessoa: true, umaTurmaComEventos: { evIII: true } }),
  evDorm: ev('EVENTO COM CAMPO ANTIGO DORMENTE', { umaTurmaPorPessoa: false, umaTurmaComEventos: { evIII: true } }),
  evLivre: ev('EVENTO SEM REGRAS', { vagasPorTurma: 30 }),
};
const T = (eventoKey, dias) => ({ label: 'T ' + eventoKey, eventoKey, dias, order: 1 });
const TURMAS = {
  tI: T('evI', ['2026-08-10']), tIID: T('evIID', ['2026-09-01']), tIIE: T('evIIE', ['2026-09-02']),
  tIII1: T('evIII', ['2027-01-10']), tIII2: T('evIII', ['2027-01-20']), tIV1: T('evIV', ['2027-02-10']), tIV2: T('evIV', ['2027-02-20']),
  tDorm: T('evDorm', ['2027-03-10']), tLivre: T('evLivre', ['2027-04-10']),
};
const P = { nunca: 'nunca.cv@previ.com.br', intI: 'interesse.i.cv@previ.com.br', inscIID: 'inscrita.iid.cv@previ.com.br', histI: 'historica.i.cv@previ.com.br',
  removI: 'removida.i.cv@previ.com.br', noIII: 'no.iii.cv@previ.com.br', noIV: 'no.iv.cv@previ.com.br', noDorm: 'no.dorm.cv@previ.com.br' };
const reg = (e, extra) => Object.assign({ name: 'X', email: e, area: 'TI', date: '2026-07-01T10:00:00.000Z', removed: false, status: 'interessado' }, extra || {});
const INTERESSE = {
  tI: { [chave(P.intI)]: reg(P.intI), [chave(P.histI)]: reg(P.histI, { status: 'inscrito', confirmedByAdmin: 'adm@previ.com.br' }),
    [chave(P.removI)]: reg(P.removI, { removed: true, status: 'removido' }) },
  tIID: { [chave(P.inscIID)]: reg(P.inscIID, { status: 'inscrito', confirmedByAdmin: 'adm@previ.com.br' }) },
  tIII1: { [chave(P.noIII)]: reg(P.noIII) }, tIV1: { [chave(P.noIV)]: reg(P.noIV, { status: 'inscrito', confirmedByAdmin: 'adm@previ.com.br' }) },
  tDorm: { [chave(P.noDorm)]: reg(P.noDorm) },
};

/* o código de decisão de verdade (turmas-util.js), com um Firebase mínimo em memória */
function carregarUtil(db) {
  const get = (p) => p.split('/').filter(Boolean).reduce((o, k) => (o == null ? undefined : o[k]), db);
  const firebase = { database: () => ({ ref: (p) => ({ once: (_e, cb) => { const v = get(p); cb({ val: () => (v === undefined ? null : JSON.parse(JSON.stringify(v))) }); } }) }) };
  const ctx = { window: {}, firebase, console };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'forca-agil', 'turmas-util.js'), 'utf8'), ctx);
  return ctx.window.faTurmasUtil;
}
const decidir = (U, eventoKey, email, turmaKey) => new Promise((res) => U.regrasDeEntrada({ eventoKey, eKey: chave(email), turmaKey }, res));

(async () => {
  console.log('\n== P. o plano ==');
  const plano = C.planejar(EVENTOS, '2026-11-02T10:00:00.000Z', 'teste');
  const resumo = plano.map((p) => [p.evento, p.acrescentar]);
  anota('P1 só os eventos com o campo antigo (III, IV e o dormente)', igual(plano.map((p) => p.evento), ['evDorm', 'evIII', 'evIV']), JSON.stringify(resumo));
  anota('P2 III ganha IV e IV ganha III em "Impedir nova participação"', igual(resumo, [['evDorm', []], ['evIII', ['evIV']], ['evIV', ['evIII']]]));
  anota('P3 com "uma turma" desligada nada é acrescentado (o campo não valia) — só o histórico', plano[0].acrescentar.length === 0 && plano[0].historico.umaTurmaPorPessoa === false);
  const up = C.gravacoes(plano);
  anota('P4 as gravações só tocam bloqueiaParticipantesDe/<novo>, o histórico e o campo antigo dos convertidos',
    Object.keys(up).every((k) => /^eventos\/(evIII|evIV|evDorm)\/(bloqueiaParticipantesDe\/ev\w+|umaTurmaComEventosHistorico|umaTurmaComEventos)$/.test(k)) && up['eventos/evIII/umaTurmaComEventos'] === null,
    JSON.stringify(Object.keys(up)));
  anota('P5 a assinatura não depende de quando nem de quem', C.assinatura(plano) === C.assinatura(C.planejar(EVENTOS, '2030-01-01T00:00:00.000Z', 'outra')));
  anota('P6 o próprio evento nunca entra na própria lista', !C.planejar({ e: ev('E', { umaTurmaPorPessoa: true, umaTurmaComEventos: { e: true, f: true } }) }, 'x', 'y')[0].acrescentar.includes('e'));

  console.log('\n== I. idempotência ==');
  const depois = C.aplicar(EVENTOS, plano);
  anota('I1 depois de aplicada, um novo plano é vazio', C.planejar(depois, 'x', 'y').length === 0);
  anota('I2 a validação não acha nada', C.validar(EVENTOS, depois, plano).length === 0, JSON.stringify(C.validar(EVENTOS, depois, plano)));
  anota('I3 eventos fora do plano idênticos; nos convertidos só os três campos mudam',
    ['evI', 'evIID', 'evIIE', 'evLivre'].every((k) => igual(EVENTOS[k], depois[k])) && depois.evIII.nome === EVENTOS.evIII.nome && depois.evIII.umaTurmaPorPessoa === true);
  anota('I4 o histórico guarda o valor antigo', igual(depois.evIII.umaTurmaComEventosHistorico.eventos, { evIV: true }) && !('umaTurmaComEventos' in depois.evIII));
  anota('I5 III: impede I, II-D, II-E e IV; IV: impede I, II-D, II-E e III; ambos com uma turma',
    igual(Object.keys(depois.evIII.bloqueiaParticipantesDe).sort(), ['evI', 'evIID', 'evIIE', 'evIV']) && igual(Object.keys(depois.evIV.bloqueiaParticipantesDe).sort(), ['evI', 'evIID', 'evIIE', 'evIII']) &&
    depois.evIII.umaTurmaPorPessoa && depois.evIV.umaTurmaPorPessoa);

  console.log('\n== D. as decisões de regrasDeEntrada, antes e depois ==');
  const Uantes = carregarUtil({ eventos: EVENTOS, turmas: TURMAS, 'turmas-interesse': INTERESSE });
  const Udepois = carregarUtil({ eventos: depois, turmas: TURMAS, 'turmas-interesse': INTERESSE });
  const CASOS = [
    ['1 nunca participou → III', P.nunca, 'evIII', 'tIII1', 'livre'],
    ['2 interesse ativo no I → III', P.intI, 'evIII', 'tIII1', 'bloqueado'],
    ['3 inscrição confirmada no II-D → IV', P.inscIID, 'evIV', 'tIV1', 'bloqueado'],
    ['4 participação em turma já realizada do I → IV', P.histI, 'evIV', 'tIV2', 'bloqueado'],
    ['5 interesse removido no I → III', P.removI, 'evIII', 'tIII1', 'livre'],
    ['6 já no III, outra turma do III (uma turma, independente)', P.noIII, 'evIII', 'tIII2', 'bloqueado'],
    ['6b já no III, a MESMA turma (o próprio registro não barra)', P.noIII, 'evIII', 'tIII1', 'livre'],
    ['7 no III → IV', P.noIII, 'evIV', 'tIV1', 'bloqueado'],
    ['8 no IV → III', P.noIV, 'evIII', 'tIII2', 'bloqueado'],
    ['9 evento com o campo antigo dormente: quem está no III entra nele', P.noIII, 'evDorm', 'tDorm', 'livre'],
    ['10 quem está no evento dormente entra no III (ele não é impeditivo do III)', P.noDorm, 'evIII', 'tIII1', 'livre'],
    ['11 evento sem regras', P.noIII, 'evLivre', 'tLivre', 'livre'],
    ['F1 lista de espera do IV para quem está no III', P.noIII, 'evIV', '', 'bloqueado'],
    ['F2 lista de espera do III para quem nunca participou', P.nunca, 'evIII', '', 'livre'],
    ['F3 lista de espera do III para quem já está no III (uma turma)', P.noIII, 'evIII', '', 'bloqueado'],
  ];
  const mudouMensagem = [];
  for (const [rot, email, evk, tk, esperado] of CASOS) {
    const a = await decidir(Uantes, evk, email, tk), d = await decidir(Udepois, evk, email, tk);
    anota('D' + rot + ': ' + esperado + ' antes e depois', a.estado === esperado && d.estado === esperado, JSON.stringify({ antes: [a.estado, a.regra], depois: [d.estado, d.regra] }));
    if (a.regra !== d.regra) mudouMensagem.push(rot + ': ' + a.regra + ' → ' + d.regra);
  }
  anota('D-msg só os casos entre III e IV trocam a mensagem ("uma turma" → "participação anterior"); o resto, igual',
    mudouMensagem.length === 3 && mudouMensagem.every((m) => /^(7|8|F1) /.test(m)), JSON.stringify(mudouMensagem));

  console.log('\n== V. a validação acusa adulteração ==');
  const perdeu = JSON.parse(JSON.stringify(depois)); delete perdeu.evIII.bloqueiaParticipantesDe.evIV;
  anota('V1 perder o IV no III é acusado', C.validar(EVENTOS, perdeu, plano).some((x) => /evIII: bloqueios efetivos mudaram/.test(x)));
  const mexeu = JSON.parse(JSON.stringify(depois)); mexeu.evLivre.vagasPorTurma = 99; mexeu.evIV.nome = 'OUTRO';
  const v2 = C.validar(EVENTOS, mexeu, plano);
  anota('V2 mexer em evento fora do plano ou em outro campo do convertido é acusado', v2.some((x) => /evLivre: evento fora do plano/.test(x)) && v2.some((x) => /evIV: outro campo/.test(x)), JSON.stringify(v2));

  console.log('\n' + oks + ' ok, ' + falhas + ' falha(s).');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
