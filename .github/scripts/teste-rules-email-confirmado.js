/* ═════════════════════════════════════════════════════════════════
   Regras do banco — anotação "e-mail confirmado" no cadastro (fa-users/<chave>/emailConfirmado e emailConfirmadoEm).
   Roda contra o EMULADOR real do Realtime Database (teste-rules.yml) com o database.rules.json de produção; a gravação
   legítima é a mesma que auth.js anotarEmailConfirmado monta. Dados 100% sintéticos. Prova, pelo BANCO:
   A. A própria pessoa, com o token dizendo email_verified, anota no cadastro do próprio e-mail (horário do servidor).
   B. Recusado: token sem email_verified; cadastro de OUTRA pessoa (inclusive por admin); horário do cliente; data sem a
      marca; data acrescentada depois (a anotação única sem data não ganha data inventada); trocar o e-mail do cadastro
      na mesma gravação; marca false; sem login; e-mail de fora da Previ.
   C. Permanente: depois de anotada, ninguém apaga nem muda a marca ou a data — nem campo a campo, nem regravando o
      cadastro inteiro sem elas.
   D. Os fluxos de hoje continuam gravando no cadastro anotado: editar nome/área, bloquear/desbloquear, "Confirmar
      cadastro" (adminApproved), cadastro novo, conta criada pelo admin, e a troca de chave da correção de e-mail (o
      cadastro antigo sai inteiro; o novo nasce sem a confirmação do e-mail antigo).
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
const ANA = 'ana.teste@previ.com.br', BIA = 'bia.teste@previ.com.br', ADMIN = 'admin.geral@previ.com.br';
const cadastro = (e, extra) => Object.assign({ email: e, name: 'PESSOA ' + e.split('@')[0].toUpperCase(), area: 'INFOR',
  emailVerificationRequired: true, createdAt: '2026-10-30T10:00:00.000Z' }, extra || {});

async function main() {
  const rules = fs.readFileSync(process.env.RULES_PATH || path.join(RAIZ, 'database.rules.json'), 'utf8');
  const env = await initializeTestEnvironment({ projectId: 'demo-kyber-agil-rules-email-confirmado', database: { rules } });
  /* verificado: o que o Firebase Auth põe no token (email_verified) */
  const db = (e, verificado) => (e ? env.authenticatedContext(emailKey(e), { email: e, email_verified: !!verificado }) : env.unauthenticatedContext()).database();
  const semear = (fn) => env.withSecurityRulesDisabled((c) => fn(c.database()));
  const ler = async (p) => { let v; await semear(async (a) => { v = (await a.ref(p).once('value')).val(); }); return v; };
  async function pode(rotulo, prom) { try { await assertSucceeds(prom); anota(rotulo, true); } catch (e) { anota(rotulo, false, 'NEGADO: ' + String(e.message || e).slice(0, 200)); } }
  async function nega(rotulo, prom) { try { await assertFails(prom); anota(rotulo, true); } catch (e) { anota(rotulo, false, 'foi ACEITO'); } }
  const anotacao = () => ({ emailConfirmado: true, emailConfirmadoEm: TS });
  const ref = (e, verificado, chave) => db(e, verificado).ref('fa-users/' + emailKey(chave || e));
  async function reiniciar(extraAna, extraBia) {
    await env.clearDatabase();
    await semear(async (a) => {
      await a.ref('fa-users/' + emailKey(ANA)).set(cadastro(ANA, extraAna));
      await a.ref('fa-users/' + emailKey(BIA)).set(cadastro(BIA, extraBia));
      await a.ref('fa-admins/' + emailKey(ADMIN)).set({ email: ADMIN });
    });
  }

  console.log('\nA. a própria pessoa, com o e-mail confirmado no Auth, anota');
  await reiniciar();
  const antes = Date.now();
  await pode('A1 update {emailConfirmado:true, emailConfirmadoEm: horário do servidor} no próprio cadastro', ref(ANA, true).update(anotacao()));
  const gravado = await ler('fa-users/' + emailKey(ANA));
  anota('A2 marca true e data numérica do servidor; o resto do cadastro intacto',
    gravado && gravado.emailConfirmado === true && typeof gravado.emailConfirmadoEm === 'number' && gravado.emailConfirmadoEm >= antes - 60000 &&
    gravado.name === 'PESSOA ANA.TESTE' && gravado.emailVerificationRequired === true && !gravado.adminApproved, JSON.stringify(gravado));
  await pode('A3 só a marca (sem data) também é aceita', ref(BIA, true).update({ emailConfirmado: true }));

  console.log('\nB. gravações indevidas recusadas');
  await reiniciar();
  await nega('B1 token SEM email_verified', ref(ANA, false).update(anotacao()));
  await nega('B2 outra pessoa (com e-mail confirmado) anota o cadastro da Ana', ref(BIA, true, ANA).update(anotacao()));
  await nega('B3 admin anota o cadastro de outra pessoa', ref(ADMIN, true, ANA).update(anotacao()));
  await nega('B4 horário do cliente', ref(ANA, true).update({ emailConfirmado: true, emailConfirmadoEm: Date.now() }));
  await nega('B5 data sem a marca', ref(ANA, true).update({ emailConfirmadoEm: TS }));
  await nega('B6 marca false', ref(ANA, true).update({ emailConfirmado: false }));
  await nega('B7 marca em texto', ref(ANA, true).update({ emailConfirmado: 'sim', emailConfirmadoEm: TS }));
  await nega('B8 trocar o e-mail do cadastro para o próprio e anotar na mesma gravação',
    ref(BIA, true, ANA).update({ email: BIA, emailConfirmado: true, emailConfirmadoEm: TS }));
  await nega('B9 sem login', db(null).ref('fa-users/' + emailKey(ANA)).update(anotacao()));
  await nega('B10 e-mail de fora da Previ', db('ana.teste@gmail.com', true).ref('fa-users/' + emailKey(ANA)).update(anotacao()));
  await nega('B11 cadastro novo já nascendo com a marca, sem e-mail confirmado no token', ref('nova@previ.com.br', false).set(Object.assign(cadastro('nova@previ.com.br'), anotacao())));
  await nega('B12 admin cria conta de outra pessoa já com a marca', ref(ADMIN, true, 'nova@previ.com.br').set(Object.assign(cadastro('nova@previ.com.br'), { emailConfirmado: true })));
  anota('B13 nada foi gravado na Ana', !(await ler('fa-users/' + emailKey(ANA) + '/emailConfirmado')));

  console.log('\nC. depois de anotada, a marca é permanente');
  await reiniciar({ emailConfirmado: true, emailConfirmadoEm: 1761830000000 }, { emailConfirmado: true });
  await nega('C1 apagar a marca', ref(ANA, true).child('emailConfirmado').remove());
  await nega('C2 apagar a data', ref(ANA, true).child('emailConfirmadoEm').remove());
  await nega('C3 trocar a data (mesmo pelo servidor)', ref(ANA, true).update({ emailConfirmadoEm: TS }));
  await nega('C4 admin apaga a marca', ref(ADMIN, true, ANA).update({ emailConfirmado: null, emailConfirmadoEm: null }));
  await nega('C5 regravar o cadastro inteiro sem a marca', ref(ADMIN, true, ANA).set(cadastro(ANA)));
  await nega('C6 marca false por cima', ref(ANA, true).update({ emailConfirmado: false }));
  await nega('C7 anotação única sem data: não ganha data depois', ref(BIA, true).update({ emailConfirmadoEm: TS }));
  await nega('C8 anotação única sem data: nem regravando a marca junto', ref(BIA, true).update({ emailConfirmado: true, emailConfirmadoEm: TS }));
  const depois = await ler('fa-users/' + emailKey(ANA));
  anota('C9 marca e data intactas', depois.emailConfirmado === true && depois.emailConfirmadoEm === 1761830000000, JSON.stringify(depois));

  console.log('\nD. os fluxos de hoje continuam gravando');
  await pode('D1 editar nome e área (admin)', db(ADMIN, true).ref().update({ ['fa-users/' + emailKey(ANA) + '/name']: 'ANA NOVA', ['fa-users/' + emailKey(ANA) + '/area']: 'GECAT' }));
  await pode('D2 bloquear', ref(ADMIN, true, ANA).child('blocked').set(true));
  await pode('D3 desbloquear', ref(ADMIN, true, ANA).child('blocked').set(null));
  await pode('D4 "Confirmar cadastro" (adminApproved) num cadastro anotado', db(ADMIN, true).ref().update({
    ['fa-users/' + emailKey(ANA) + '/adminApproved']: true, ['fa-users/' + emailKey(ANA) + '/approvedByAdmin']: ADMIN,
    ['fa-users/' + emailKey(ANA) + '/approvedAt']: new Date().toISOString() }));
  await pode('D5 regravar a marca com o mesmo valor', ref(ANA, true).update({ emailConfirmado: true }));
  await pode('D6 cadastro novo (como o register grava)', ref('nova@previ.com.br', false).set(cadastro('nova@previ.com.br', { optinTurmas: true })));
  await pode('D7 conta criada pelo admin', ref(ADMIN, true, 'criada@previ.com.br').set({ email: 'criada@previ.com.br', name: 'CRIADA', area: 'INFOR', adminApproved: true, createdByAdmin: ADMIN, createdAt: new Date().toISOString() }));
  const ana = await ler('fa-users/' + emailKey(ANA));
  const novo = Object.assign({}, ana, { email: 'ana.certa@previ.com.br', emailCorrigidoDe: ANA });
  delete novo.emailConfirmado; delete novo.emailConfirmadoEm;
  await pode('D8 correção de e-mail: o cadastro antigo sai inteiro e o novo nasce sem a confirmação antiga', db(ADMIN, true).ref().update({
    ['fa-users/' + emailKey(ANA)]: null, ['fa-users/' + emailKey('ana.certa@previ.com.br')]: novo }));
  const certa = await ler('fa-users/' + emailKey('ana.certa@previ.com.br'));
  anota('D9 o cadastro novo não herdou a confirmação', certa && !certa.emailConfirmado && !certa.emailConfirmadoEm, JSON.stringify(certa));
  await pode('D10 a dona do e-mail novo, confirmado no Auth, anota o próprio', ref('ana.certa@previ.com.br', true).update(anotacao()));

  await env.cleanup();
  console.log('\n' + (total - falhas) + '/' + total + ' verificações');
  if (falhas) { console.error(falhas + ' FALHA(S)'); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
