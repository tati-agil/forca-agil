/* ═════════════════════════════════════════════════════════════════
   Regras do banco — segurança de fa-users (PR 1-B; regras geradas por montar-regras-fa-users.js).
   Roda contra o EMULADOR real do Realtime Database (teste-rules.yml) com o database.rules.json do repositório (ou
   RULES_PATH). Dados 100% sintéticos. Prova, pelo BANCO:
   R. Regressão por tipo de conta (admin da lista fixa e de fa-admins, avaliação, avaliação + arquitetura, diretor,
      gerente, facilitadora, conta antiga sem verificação exigida, conta confirmada, liberada pelo admin, criada pelo
      admin, bloqueada): cada uma lê o próprio cadastro e a lista como antes; nenhuma gravação legítima dela muda.
   P. Permitido: cadastro público (set, sem e-mail confirmado), Completar cadastro (transação), anotação da confirmação,
      conta criada pelo admin (fa-admins e lista fixa), bloquear/desbloquear, liberar, editar nome/área, corrigir o
      e-mail (apaga a chave antiga e cria a nova), apagar um cadastro — e o próprio cadastro em e-mails com hífen, +,
      apóstrofo, aspas, barra invertida, # e $, e com 64 e mais de 64 caracteres (a chave é a emailKey do site).
   N. Recusado: mexer no cadastro de outra pessoa (inclusive pelos perfis especiais); autoliberação; tirar o bloqueio
      (campo, update com null, multipath da raiz, regravar o cadastro inteiro); apagar o próprio cadastro; apagar campos
      administrativos ou emailVerificationRequired; criar com campo privilegiado; criar na chave de outra pessoa ou com
      outro e-mail; campo desconhecido; trocar o próprio e-mail; colisão de chaves; e-mail com acento; chave sem corte.
      Ao fim, todos os cadastros estão intactos.
   ═════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const RAIZ = path.join(__dirname, '..', '..');

let total = 0, falhas = 0;
function anota(rotulo, ok, det) { total++; if (ok) console.log('  ok    ' + rotulo); else { falhas++; console.error('  FALHA ' + rotulo + (det ? ' → ' + det : '')); } }
const emailKey = (e) => String(e).toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const TS = { '.sv': 'timestamp' };
const ISO = '2026-06-01T09:00:00.000Z';

const ADMIN = 'admin.geral@previ.com.br', ADMIN_FIXO = 'tatianefdirene@previ.com.br';
const CONTAS = {   /* tipo → [e-mail, cadastro extra, nó de papel] */
  'admin da lista fixa': [ADMIN_FIXO, { adminApproved: true }],
  'admin de fa-admins': [ADMIN, { adminApproved: true }, ['fa-admins', { email: ADMIN }]],
  'avaliação': ['aval.teste@previ.com.br', { adminApproved: true }, ['fa-avaliacao-autorizados', { email: 'aval.teste@previ.com.br', tipo: 'avaliacao' }]],
  'avaliação + arquitetura': ['arq.teste@previ.com.br', { adminApproved: true }, ['fa-avaliacao-autorizados', { email: 'arq.teste@previ.com.br', tipo: 'avaliacao-arquitetura' }]],
  'diretor': ['dir.teste@previ.com.br', { adminApproved: true }, ['fa-diretores', { email: 'dir.teste@previ.com.br' }]],
  'gerente': ['ger.teste@previ.com.br', { adminApproved: true }, ['fa-gerentes', { email: 'ger.teste@previ.com.br' }]],
  'facilitadora': ['fac.teste@previ.com.br', { adminApproved: true }, ['fa-facilitadores', { email: 'fac.teste@previ.com.br' }]],
  'antiga (sem verificação exigida)': ['antiga.teste@previ.com.br', { adminApproved: true }],
  'confirmada': ['conf.teste@previ.com.br', { emailVerificationRequired: true, emailConfirmado: true, emailConfirmadoEm: 1761830000000, optinTurmas: true }],
  'não confirmada': ['pend.teste@previ.com.br', { emailVerificationRequired: true, optinTurmas: false }],
  'liberada pelo admin': ['lib.teste@previ.com.br', { emailVerificationRequired: true, adminApproved: true, approvedAt: ISO, approvedByAdmin: ADMIN, approvedByAdminName: 'ADMIN' }],
  'criada pelo admin': ['criada.teste@previ.com.br', { adminApproved: true, createdByAdmin: ADMIN }],
  'completada pelo admin': ['compl.teste@previ.com.br', { adminApproved: true, cadastroCompletadoEm: ISO, cadastroCompletadoPorAdmin: ADMIN }],
  'bloqueada': ['bloq.teste@previ.com.br', { emailVerificationRequired: true, blocked: true }],
  'e-mail corrigido': ['corr.teste@previ.com.br', { adminApproved: true, emailCorrigidoDe: 'corr.antigo@previ.com.br' }]
};
const cadastro = (e, extra) => Object.assign({ email: e, name: 'PESSOA ' + e.split('@')[0].toUpperCase(), area: 'INFOR', createdAt: ISO }, extra || {});
const publico = (e, extra) => Object.assign({ email: e, name: 'PESSOA NOVA', area: 'GECAT', optinTurmas: false, emailVerificationRequired: true,
  createdAt: new Date().toISOString() }, extra || {});
const e = (tipo) => CONTAS[tipo][0];
const PAPEL = ['admin de fa-admins', 'avaliação', 'avaliação + arquitetura', 'diretor', 'gerente', 'facilitadora'];

async function main() {
  const rules = fs.readFileSync(process.env.RULES_PATH || path.join(RAIZ, 'database.rules.json'), 'utf8');
  const env = await initializeTestEnvironment({ projectId: 'demo-kyber-agil-rules-fa-users', database: { rules } });
  const db = (em, verificado) => (em ? env.authenticatedContext('u' + emailKey(em).slice(0, 100), { email: em, email_verified: !!verificado }) : env.unauthenticatedContext()).database();
  const semear = (fn) => env.withSecurityRulesDisabled((c) => fn(c.database()));
  const ler = async (p) => { let v; await semear(async (a) => { v = (await a.ref(p).once('value')).val(); }); return v; };
  async function pode(rotulo, prom) { try { const r = await assertSucceeds(prom); anota(rotulo, true); return r; } catch (x) { anota(rotulo, false, 'NEGADO: ' + String(x.message || x).slice(0, 200)); return null; } }
  async function nega(rotulo, prom) { try { await assertFails(prom); anota(rotulo, true); } catch (x) { anota(rotulo, false, 'foi ACEITO'); } }
  const criarSeVazio = (ref, c) => ref.transaction((atual) => (atual === null ? c : undefined));
  const u = (em) => 'fa-users/' + emailKey(em);
  async function reiniciar() {
    await env.clearDatabase();
    await semear(async (a) => {
      for (const t of Object.keys(CONTAS)) {
        const [em, extra, papel] = CONTAS[t];
        await a.ref(u(em)).set(cadastro(em, extra));
        if (papel) await a.ref(papel[0] + '/' + emailKey(em)).set(papel[1]);
      }
    });
  }

  /* ── R. regressão por tipo de conta ── */
  console.log('\nR. cada tipo de conta lê como antes e mantém as gravações legítimas');
  await reiniciar();
  const antes = await ler('fa-users');
  for (const t of Object.keys(CONTAS)) {
    const em = e(t);
    await pode('R lê o próprio cadastro e a lista — ' + t, Promise.all([db(em, true).ref(u(em)).once('value'), db(em, false).ref('fa-users').once('value')]));
  }
  await pode('R a confirmada regrava a anotação com o mesmo valor', db(e('confirmada'), true).ref(u(e('confirmada'))).update({ emailConfirmado: true }));
  for (const t of ['não confirmada', 'antiga (sem verificação exigida)', 'liberada pelo admin', 'criada pelo admin', 'gerente', 'facilitadora', 'diretor', 'avaliação']) {
    await pode('R anota a confirmação do próprio e-mail — ' + t, db(e(t), true).ref(u(e(t))).update({ emailConfirmado: true, emailConfirmadoEm: TS }));
  }
  const depoisR = await ler('fa-users');
  const semAnotacao = (o) => { const c = JSON.parse(JSON.stringify(o)); Object.values(c).forEach((v) => { delete v.emailConfirmado; delete v.emailConfirmadoEm; }); return JSON.stringify(c); };
  anota('R só a anotação mudou: bloqueio, liberação, papéis e o resto de cada cadastro intactos', semAnotacao(antes) === semAnotacao(depoisR));
  anota('R a bloqueada continua bloqueada', (await ler(u(e('bloqueada')) + '/blocked')) === true);

  /* ── P. permitido ── */
  console.log('\nP. gravações legítimas');
  await reiniciar();
  await pode('P1 cadastro público: a própria pessoa, sem confirmar o e-mail, cria o próprio (set)', db('nova.pessoa@previ.com.br', false).ref(u('nova.pessoa@previ.com.br')).set(publico('nova.pessoa@previ.com.br', { optinTurmas: true })));
  let r = await pode('P2 Completar cadastro: transação da própria pessoa confirmada', criarSeVazio(db('completa@previ.com.br', true).ref(u('completa@previ.com.br')), publico('completa@previ.com.br')));
  anota('P2 gravou', r && r.committed);
  await pode('P3 depois, anota a confirmação', db('completa@previ.com.br', true).ref(u('completa@previ.com.br')).update({ emailConfirmado: true, emailConfirmadoEm: TS }));
  r = await pode('P4 admin de fa-admins cria conta (transação, campos administrativos)', criarSeVazio(db(ADMIN, true).ref(u('colab1@previ.com.br')), cadastro('colab1@previ.com.br', { adminApproved: true, createdByAdmin: ADMIN })));
  anota('P4 gravou', r && r.committed);
  r = await pode('P5 admin da lista fixa cria conta (token sem e-mail confirmado)', criarSeVazio(db(ADMIN_FIXO, false).ref(u('colab2@previ.com.br')), cadastro('colab2@previ.com.br', { adminApproved: true, createdByAdmin: ADMIN_FIXO })));
  anota('P5 gravou', r && r.committed);
  await pode('P6 bloquear', db(ADMIN, true).ref(u(e('confirmada')) + '/blocked').set(true));
  await pode('P7 desbloquear', db(ADMIN, true).ref(u(e('bloqueada')) + '/blocked').set(null));
  await pode('P8 liberar (multipath, como admin.js)', db(ADMIN_FIXO, true).ref().update({ [u(e('não confirmada')) + '/adminApproved']: true,
    [u(e('não confirmada')) + '/approvedByAdmin']: ADMIN_FIXO, [u(e('não confirmada')) + '/approvedByAdminName']: 'TATIANE', [u(e('não confirmada')) + '/approvedAt']: new Date().toISOString() }));
  await pode('P9 editar nome e área (multipath)', db(ADMIN, true).ref().update({ [u(e('gerente')) + '/name']: 'GERENTE NOVO', [u(e('gerente')) + '/area']: 'GECAT' }));
  const velho = await ler(u(e('liberada pelo admin')));
  const novo = Object.assign({}, velho, { email: 'lib.certa@previ.com.br', emailCorrigidoDe: e('liberada pelo admin') });
  await pode('P10 corrigir e-mail: apaga a chave antiga e cria a nova (multipath)', db(ADMIN, true).ref().update({ [u(e('liberada pelo admin'))]: null, [u('lib.certa@previ.com.br')]: novo }));
  await pode('P11 apagar um cadastro (admin)', db(ADMIN, true).ref(u(e('e-mail corrigido'))).remove());
  await pode('P12 admin edita o próprio cadastro', db(ADMIN, true).ref(u(ADMIN) + '/name').set('ADMIN RENOMEADO'));
  const ESPECIAIS = { 'hífen': 'maria-silva@previ.com.br', '+': 'ana+turma@previ.com.br', 'apóstrofo': "joao.d'avila@previ.com.br",
    'aspas': 'aspas"x@previ.com.br', 'barra invertida': 'barra\\y@previ.com.br', '# e $': 'cerq#d$z@previ.com.br', 'colchetes e /': 'colch[e]/w@previ.com.br',
    '64 caracteres': 'c'.repeat(51) + '@previ.com.br', 'mais de 64': 'd'.repeat(70) + '@previ.com.br' };
  /* chaves distintas entre si: dois e-mails com a mesma chave são uma COLISÃO, e a regra recusa a segunda (N13) */
  anota('P13 os e-mails especiais têm chaves distintas', new Set(Object.values(ESPECIAIS).map(emailKey)).size === Object.keys(ESPECIAIS).length);
  for (const n of Object.keys(ESPECIAIS)) {
    const em = ESPECIAIS[n];
    await pode('P13 e-mail com ' + n + ': cria o próprio na chave da emailKey (' + emailKey(em).length + ')', db(em, false).ref(u(em)).set(publico(em)));
    await pode('P13 e-mail com ' + n + ': anota a confirmação', db(em, true).ref(u(em)).update({ emailConfirmado: true, emailConfirmadoEm: TS }));
  }
  await pode('P14 e-mail em maiúsculas no token: chave em minúsculas', db('Maiuscula.Teste@previ.com.br', false).ref(u('maiuscula.teste@previ.com.br')).set(publico('maiuscula.teste@previ.com.br')));

  /* ── N. recusado ── */
  console.log('\nN. gravações indevidas');
  await reiniciar();
  const intactos = await ler('fa-users');
  const ANA = e('não confirmada'), BLOQ = e('bloqueada'), CONF = e('confirmada'), LIB = e('liberada pelo admin');
  const eu = (em, v) => db(em, v === undefined ? true : v).ref(u(em));
  await nega('N1 pessoa comum muda o nome de outra', db(ANA, true).ref(u(CONF) + '/name').set('X'));
  await nega('N2 pessoa comum regrava o cadastro de outra', db(ANA, true).ref(u(CONF)).set(cadastro(CONF)));
  await nega('N3 pessoa comum apaga o cadastro de outra', db(ANA, true).ref(u(CONF)).remove());
  for (const t of PAPEL.slice(1)) {
    await nega('N4 perfil ' + t + ': libera outra pessoa', db(e(t), true).ref(u(ANA) + '/adminApproved').set(true));
    await nega('N4 perfil ' + t + ': desbloqueia outra pessoa', db(e(t), true).ref(u(BLOQ) + '/blocked').remove());
    await nega('N4 perfil ' + t + ': cria conta para outra pessoa', db(e(t), true).ref(u('alheia@previ.com.br')).set(cadastro('alheia@previ.com.br', { adminApproved: true })));
  }
  await nega('N5 autoliberação (campo)', eu(ANA).child('adminApproved').set(true));
  await nega('N5 autoliberação (update)', eu(ANA).update({ adminApproved: true, approvedAt: ISO }));
  await nega('N5 autoliberação (multipath da raiz, junto da anotação)', db(ANA, true).ref().update({ [u(ANA) + '/emailConfirmado']: true, [u(ANA) + '/emailConfirmadoEm']: TS, [u(ANA) + '/adminApproved']: true }));
  await nega('N6 tirar o próprio bloqueio (remove)', eu(BLOQ).child('blocked').remove());
  await nega('N6 tirar o próprio bloqueio (update null)', eu(BLOQ).update({ blocked: null }));
  await nega('N6 tirar o próprio bloqueio (blocked false)', eu(BLOQ).child('blocked').set(false));
  await nega('N6 tirar o próprio bloqueio (multipath da raiz)', db(BLOQ, true).ref().update({ [u(BLOQ) + '/blocked']: null }));
  const semBloqueio = await ler(u(BLOQ)); delete semBloqueio.blocked;
  await nega('N6 tirar o próprio bloqueio (regravar o cadastro inteiro)', eu(BLOQ).set(semBloqueio));
  await nega('N7 apagar o próprio cadastro (remove)', eu(CONF).remove());
  await nega('N7 apagar o próprio cadastro (set null)', eu(ANA).set(null));
  await nega('N7 apagar o próprio cadastro (multipath da raiz)', db(ANA, true).ref().update({ [u(ANA)]: null }));
  await nega('N8 apagar emailVerificationRequired (entraria sem confirmar)', eu(ANA, false).child('emailVerificationRequired').remove());
  await nega('N8 emailVerificationRequired false', eu(ANA, false).child('emailVerificationRequired').set(false));
  await nega('N8 apagar a própria liberação', eu(LIB).update({ adminApproved: null, approvedAt: null }));
  await nega('N8 apagar o próprio approvedByAdmin', eu(LIB).child('approvedByAdmin').remove());
  await nega('N8 apagar createdByAdmin', eu(e('criada pelo admin')).child('createdByAdmin').remove());
  await nega('N9 trocar o próprio e-mail', eu(CONF).child('email').set('outro@previ.com.br'));
  await nega('N9 trocar o próprio nome (só o admin edita)', eu(CONF).child('name').set('OUTRO NOME'));
  await nega('N9 campo desconhecido no próprio cadastro', eu(CONF).child('papel').set('admin'));
  const cria = (em, extra, v) => db(em, v || false).ref(u(em)).set(publico(em, extra));
  for (const [campo, valor] of [['adminApproved', true], ['blocked', false], ['createdByAdmin', ADMIN], ['approvedAt', ISO], ['approvedByAdmin', ADMIN],
    ['approvedByAdminName', 'X'], ['cadastroCompletadoEm', ISO], ['cadastroCompletadoPorAdmin', ADMIN], ['emailCorrigidoDe', 'x@previ.com.br'], ['papel', 'admin']]) {
    await nega('N10 criar o próprio com ' + campo, cria('nova.' + campo.toLowerCase() + '@previ.com.br', { [campo]: valor }));
  }
  await nega('N10 criar sem emailVerificationRequired', db('sem.evr@previ.com.br', false).ref(u('sem.evr@previ.com.br')).set(cadastro('sem.evr@previ.com.br')));
  await nega('N10 criar com emailVerificationRequired false', cria('evr.false@previ.com.br', { emailVerificationRequired: false }));
  await nega('N10 criar sem nome', cria('sem.nome@previ.com.br', { name: '' }));
  await nega('N10 criar com e-mail de outra pessoa', db('eu.mesma@previ.com.br', false).ref(u('eu.mesma@previ.com.br')).set(publico('outra.pessoa@previ.com.br')));
  await nega('N11 criar na chave vazia de outra pessoa', db(ANA, true).ref(u('ainda.sem.cadastro@previ.com.br')).set(publico('ainda.sem.cadastro@previ.com.br')));
  await nega('N11 criar na chave de outra pessoa com o próprio e-mail', db(ANA, true).ref(u('ainda.sem.cadastro@previ.com.br')).set(publico(ANA)));
  await nega('N11 chave da regra antiga (sem remover o hífen)', db('jose-lima@previ.com.br', false).ref('fa-users/jose-lima_previ_com_br').set(publico('jose-lima@previ.com.br')));
  const longo = 'e'.repeat(70) + '@previ.com.br';
  await nega('N11 chave sem o corte em 64', db(longo, false).ref('fa-users/' + longo.replace(/[@.]/g, '_')).set(publico(longo)));
  await nega('N12 e-mail com acento cria o próprio (o admin cadastra)', db('joão.acento@previ.com.br', false).ref(u('joão.acento@previ.com.br')).set(publico('joão.acento@previ.com.br')));
  await pode('N12 … e o admin cadastra essa pessoa', db(ADMIN, true).ref(u('joão.acento@previ.com.br')).set(cadastro('joão.acento@previ.com.br', { adminApproved: true, createdByAdmin: ADMIN })));
  await semear((a) => a.ref(u('ab.colisao@previ.com.br')).set(cadastro('ab.colisao@previ.com.br', { emailVerificationRequired: true })));
  anota('N13 colisão: a-b.colisao e ab.colisao têm a mesma chave', emailKey('a-b.colisao@previ.com.br') === emailKey('ab.colisao@previ.com.br'));
  await nega('N13 colisão: a outra pessoa não regrava o cadastro', db('a-b.colisao@previ.com.br', true).ref(u('a-b.colisao@previ.com.br')).set(publico('a-b.colisao@previ.com.br')));
  await nega('N13 colisão: nem anota a confirmação nele', db('a-b.colisao@previ.com.br', true).ref(u('a-b.colisao@previ.com.br')).update({ emailConfirmado: true, emailConfirmadoEm: TS }));
  r = await pode('N13 colisão: a transação dela termina sem gravar', criarSeVazio(db('a-b.colisao@previ.com.br', true).ref(u('a-b.colisao@previ.com.br')), publico('a-b.colisao@previ.com.br')));
  anota('N13 nada gravado', r && r.committed === false && (await ler(u('ab.colisao@previ.com.br'))).email === 'ab.colisao@previ.com.br');
  await nega('N14 sem login', db(null).ref(u('anonima@previ.com.br')).set(publico('anonima@previ.com.br')));
  await nega('N14 e-mail de fora da Previ', db('fora@gmail.com', true).ref(u('fora@gmail.com')).set(publico('fora@gmail.com')));
  await nega('N15 admin apaga a anotação da confirmação (proteção mantida)', db(ADMIN, true).ref(u(CONF)).update({ emailConfirmado: null, emailConfirmadoEm: null }));
  const depoisN = await ler('fa-users');
  delete depoisN[emailKey('joão.acento@previ.com.br')]; delete depoisN[emailKey('ab.colisao@previ.com.br')];
  anota('N16 todos os cadastros intactos depois das tentativas', JSON.stringify(depoisN) === JSON.stringify(intactos));

  await env.cleanup();
  console.log('\n' + (total - falhas) + '/' + total + ' verificações');
  if (falhas) { console.error(falhas + ' FALHA(S)'); process.exit(1); }
}
main().catch((x) => { console.error(x); process.exit(1); });
