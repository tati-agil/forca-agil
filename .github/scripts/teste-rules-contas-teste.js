/* ═════════════════════════════════════════════════════════════════
   Regras do banco — CONTA DE TESTE (fa-contas-teste e fa-contas-teste-auditoria; montar-regras-contas-teste.js).
   Roda contra o EMULADOR real do Realtime Database (teste-rules.yml) com o database.rules.json do repositório (ou
   RULES_PATH). Dados 100% sintéticos. Prova, pelo BANCO:
   P. o admin geral (fa-admins e lista fixa) lê, marca, desmarca, marca de novo e move a marca na correção de e-mail —
      sempre com o evento de auditoria na mesma gravação;
   N. recusado: qualquer outra pessoa ou perfil (comum, avaliação, arquitetura, diretor, gerente, facilitadora) lê ou
      grava; marca sem evento; evento sem marca; evento incoerente; marcar o que já está marcado; desmarcar o que não
      está; autoria ou horário falsos; e-mail diferente do cadastro; cadastro inexistente; apagar marca ou evento;
      mudar um evento; reaproveitar um evento antigo; campo desconhecido; "mover" sem movidoPara ou sem chave anterior;
      sem login;
   I. isolamento: a marca não toca fa-users; a conta marcada continua lendo e anotando o próprio cadastro como antes.
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
const ADMIN = 'admin.geral@previ.com.br', ADMIN_FIXO = 'tatianefdirene@previ.com.br';
const TESTE = 'conta.teste@previ.com.br', REAL = 'pessoa.real@previ.com.br', NOVO = 'conta.teste.certa@previ.com.br';
const PERFIS = {
  'pessoa comum': ['comum@previ.com.br'],
  'avaliação': ['aval@previ.com.br', 'fa-avaliacao-autorizados', { tipo: 'avaliacao' }],
  'arquitetura': ['arq@previ.com.br', 'fa-avaliacao-autorizados', { tipo: 'avaliacao-arquitetura' }],
  'diretor': ['dir@previ.com.br', 'fa-diretores', {}],
  'gerente': ['ger@previ.com.br', 'fa-gerentes', {}],
  'facilitadora': ['fac@previ.com.br', 'fa-facilitadores', {}],
  'a própria conta de teste': [TESTE]
};
const cadastro = (e) => ({ email: e, name: 'PESSOA ' + e.split('@')[0].toUpperCase(), area: 'INFOR', createdAt: '2026-09-01T12:00:00.000Z', adminApproved: true });

async function main() {
  const rules = fs.readFileSync(process.env.RULES_PATH || path.join(RAIZ, 'database.rules.json'), 'utf8');
  const env = await initializeTestEnvironment({ projectId: 'demo-kyber-agil-rules-contas-teste', database: { rules } });
  const db = (e, v) => (e ? env.authenticatedContext('u' + emailKey(e), { email: e, email_verified: !!v }) : env.unauthenticatedContext()).database();
  const semear = (fn) => env.withSecurityRulesDisabled((c) => fn(c.database()));
  const ler = async (p) => { let v; await semear(async (a) => { v = (await a.ref(p).once('value')).val(); }); return v; };
  async function pode(rotulo, prom) { try { await assertSucceeds(prom); anota(rotulo, true); } catch (x) { anota(rotulo, false, 'NEGADO: ' + String(x.message || x).slice(0, 200)); } }
  async function nega(rotulo, prom) { try { await assertFails(prom); anota(rotulo, true); } catch (x) { anota(rotulo, false, 'foi ACEITO'); } }
  let seq = 0;
  /* a gravação que o painel faz (admin.js acaoContaTeste) */
  function gravacao(por, e, marcada, acao, extra) {
    const id = 'ev' + (++seq), k = emailKey(e), u = {};
    u['fa-contas-teste/' + k] = Object.assign({ marcada, email: e, por, em: TS, auditoria: id }, (extra || {}).marca);
    u['fa-contas-teste-auditoria/' + id] = Object.assign({ acao, chave: k, email: e, por, em: TS }, (extra || {}).evento);
    return { id, u };
  }
  const grava = (quem, g) => db(quem, true).ref().update(g.u);
  async function reiniciar(marcadaJa) {
    await env.clearDatabase();
    await semear(async (a) => {
      await a.ref('fa-admins/' + emailKey(ADMIN)).set({ email: ADMIN });
      for (const e of [ADMIN, ADMIN_FIXO, TESTE, REAL]) await a.ref('fa-users/' + emailKey(e)).set(cadastro(e));
      for (const t of Object.keys(PERFIS)) {
        const [e, no, v] = PERFIS[t];
        if (e !== TESTE) await a.ref('fa-users/' + emailKey(e)).set(cadastro(e));
        if (no) await a.ref(no + '/' + emailKey(e)).set(Object.assign({ email: e }, v));
      }
      if (marcadaJa) {
        await a.ref('fa-contas-teste/' + emailKey(TESTE)).set({ marcada: true, email: TESTE, por: ADMIN, em: 1761900000000, auditoria: 'antigo' });
        await a.ref('fa-contas-teste-auditoria/antigo').set({ acao: 'marcar', chave: emailKey(TESTE), email: TESTE, por: ADMIN, em: 1761900000000 });
      }
    });
  }
  const kT = emailKey(TESTE);

  console.log('\nP. o admin geral marca, desmarca e move — sempre com o evento na mesma gravação');
  await reiniciar(false);
  const usuariosAntes = JSON.stringify(await ler('fa-users'));
  await pode('P1 admin (fa-admins) marca a conta de teste', grava(ADMIN, gravacao(ADMIN, TESTE, true, 'marcar')));
  const m = await ler('fa-contas-teste/' + kT), ev = await ler('fa-contas-teste-auditoria/ev1');
  anota('P2 marca e evento gravados, com autoria e horário do servidor', m && m.marcada === true && m.por === ADMIN && typeof m.em === 'number' && ev && ev.acao === 'marcar' && ev.chave === kT, JSON.stringify({ m, ev }));
  await pode('P3 admin lê a marcação e a auditoria', Promise.all([db(ADMIN, true).ref('fa-contas-teste').once('value'), db(ADMIN, true).ref('fa-contas-teste-auditoria').once('value')]));
  await pode('P4 admin da lista fixa desmarca', grava(ADMIN_FIXO, gravacao(ADMIN_FIXO, TESTE, false, 'desmarcar')));
  await pode('P5 marca de novo', grava(ADMIN, gravacao(ADMIN, TESTE, true, 'marcar')));
  anota('I1 nada mudou em fa-users', JSON.stringify(await ler('fa-users')) === usuariosAntes);
  {
    /* como admin.js faz: primeiro os dados mudam de chave (gravação da correção, sem a marca); DEPOIS, numa gravação
       própria, a marca — que nunca pode impedir a mudança dos dados */
    const id = 'ev' + (++seq), kN = emailKey(NOVO), cad = cadastro(NOVO), dados = {}, u = {};
    dados['fa-users/' + kT] = null; dados['fa-users/' + kN] = Object.assign(cad, { emailCorrigidoDe: TESTE });
    await pode('P6a correção de e-mail: os dados mudam de chave sem tocar na marcação', db(ADMIN, true).ref().update(dados));
    u['fa-contas-teste/' + kN] = { marcada: true, email: NOVO, por: ADMIN, em: TS, auditoria: id };
    u['fa-contas-teste/' + kT] = { marcada: false, email: TESTE, por: ADMIN, em: TS, auditoria: id, movidoPara: kN };
    u['fa-contas-teste-auditoria/' + id] = { acao: 'mover', chave: kN, chaveAnterior: kT, email: NOVO, emailAnterior: TESTE, por: ADMIN, em: TS };
    await pode('P6 depois, a marca muda de chave numa gravação própria (evento "mover")', db(ADMIN, true).ref().update(u));
    const n = await ler('fa-contas-teste/' + kN), a = await ler('fa-contas-teste/' + kT);
    anota('P7 nova marcada; antiga desmarcada apontando para a nova', n && n.marcada === true && a && a.marcada === false && a.movidoPara === kN, JSON.stringify({ n, a }));
  }

  console.log('\nN. gravações e leituras indevidas');
  await reiniciar(true);
  for (const t of Object.keys(PERFIS)) {
    const e = PERFIS[t][0];
    await nega('N1 ' + t + ': lê a marcação', db(e, true).ref('fa-contas-teste').once('value'));
    await nega('N1 ' + t + ': lê a auditoria', db(e, true).ref('fa-contas-teste-auditoria').once('value'));
    await nega('N1 ' + t + ': lê a própria marca', db(e, true).ref('fa-contas-teste/' + emailKey(e)).once('value'));
    await nega('N1 ' + t + ': marca alguém', grava(e, gravacao(e, REAL, true, 'marcar')));
    await nega('N1 ' + t + ': desmarca a conta de teste', grava(e, gravacao(e, TESTE, false, 'desmarcar')));
  }
  await nega('N2 sem login', db(null).ref().update(gravacao(ADMIN, REAL, true, 'marcar').u));
  let g = gravacao(ADMIN, REAL, true, 'marcar');
  await nega('N3 marca sem o evento', db(ADMIN, true).ref('fa-contas-teste/' + emailKey(REAL)).set(g.u['fa-contas-teste/' + emailKey(REAL)]));
  await nega('N3 evento sem a marca', db(ADMIN, true).ref('fa-contas-teste-auditoria/' + g.id).set(g.u['fa-contas-teste-auditoria/' + g.id]));
  await nega('N4 evento incoerente ("desmarcar" marcando)', grava(ADMIN, gravacao(ADMIN, REAL, true, 'desmarcar')));
  await nega('N4 marcar quem já está marcada', grava(ADMIN, gravacao(ADMIN, TESTE, true, 'marcar')));
  await nega('N4 desmarcar quem não está marcada', grava(ADMIN, gravacao(ADMIN, REAL, false, 'desmarcar')));
  await nega('N4 evento de outra chave', grava(ADMIN, gravacao(ADMIN, REAL, true, 'marcar', { evento: { chave: kT } })));
  await nega('N5 autoria falsa na marca', grava(ADMIN, gravacao(ADMIN, REAL, true, 'marcar', { marca: { por: ADMIN_FIXO } })));
  await nega('N5 autoria falsa no evento', grava(ADMIN, gravacao(ADMIN, REAL, true, 'marcar', { evento: { por: ADMIN_FIXO } })));
  await nega('N5 horário do cliente', grava(ADMIN, gravacao(ADMIN, REAL, true, 'marcar', { marca: { em: Date.now() }, evento: { em: Date.now() } })));
  await nega('N6 e-mail diferente do cadastro', grava(ADMIN, gravacao(ADMIN, REAL, true, 'marcar', { marca: { email: 'outro@previ.com.br' } })));
  await nega('N6 cadastro inexistente', grava(ADMIN, gravacao(ADMIN, 'ninguem@previ.com.br', true, 'marcar')));
  await nega('N7 apagar a marca', db(ADMIN, true).ref('fa-contas-teste/' + kT).remove());
  await nega('N7 apagar a marca (multipath)', db(ADMIN, true).ref().update({ ['fa-contas-teste/' + kT]: null }));
  await nega('N7 apagar um evento', db(ADMIN, true).ref('fa-contas-teste-auditoria/antigo').remove());
  await nega('N7 mudar um evento', db(ADMIN, true).ref('fa-contas-teste-auditoria/antigo/acao').set('desmarcar'));
  await nega('N8 desmarcar reaproveitando o evento antigo', db(ADMIN, true).ref('fa-contas-teste/' + kT).update({ marcada: false, em: TS, auditoria: 'antigo' }));
  await nega('N9 campo desconhecido na marca', grava(ADMIN, gravacao(ADMIN, REAL, true, 'marcar', { marca: { acesso: 'admin' } })));
  await nega('N9 campo desconhecido no evento', grava(ADMIN, gravacao(ADMIN, REAL, true, 'marcar', { evento: { senha: 'x' } })));
  {
    const kN = emailKey(NOVO), id = 'evm', base = () => {
      const u = {};
      u['fa-users/' + kT] = null; u['fa-users/' + kN] = cadastro(NOVO);
      u['fa-contas-teste/' + kN] = { marcada: true, email: NOVO, por: ADMIN, em: TS, auditoria: id };
      u['fa-contas-teste/' + kT] = { marcada: false, email: TESTE, por: ADMIN, em: TS, auditoria: id, movidoPara: kN };
      u['fa-contas-teste-auditoria/' + id] = { acao: 'mover', chave: kN, chaveAnterior: kT, email: NOVO, emailAnterior: TESTE, por: ADMIN, em: TS };
      return u;
    };
    let u = base(); delete u['fa-contas-teste/' + kT].movidoPara;
    await nega('N10 "mover" sem movidoPara na chave antiga', db(ADMIN, true).ref().update(u));
    u = base(); delete u['fa-contas-teste-auditoria/' + id].chaveAnterior;
    await nega('N10 "mover" sem a chave anterior no evento', db(ADMIN, true).ref().update(u));
    u = base(); u['fa-contas-teste/' + kT].movidoPara = emailKey(REAL);
    await nega('N10 "mover" apontando para outra chave', db(ADMIN, true).ref().update(u));
  }
  const ordenado = (o) => JSON.stringify(Object.keys(o || {}).sort().map((k) => [k, o[k]]));
  anota('N11 a marca e o evento antigos continuam intactos', ordenado(await ler('fa-contas-teste/' + kT)) === ordenado({ marcada: true, email: TESTE, por: ADMIN, em: 1761900000000, auditoria: 'antigo' }) &&
    (await ler('fa-contas-teste-auditoria/antigo')).acao === 'marcar');

  console.log('\nI. a marca não muda nada para a conta marcada');
  await pode('I2 a conta marcada lê o próprio cadastro e a lista, como antes', Promise.all([db(TESTE, true).ref('fa-users/' + kT).once('value'), db(TESTE, false).ref('fa-users').once('value')]));
  await pode('I3 a conta marcada anota a confirmação do próprio e-mail, como antes', db(TESTE, true).ref('fa-users/' + kT).update({ emailConfirmado: true, emailConfirmadoEm: TS }));

  await env.cleanup();
  console.log('\n' + (total - falhas) + '/' + total + ' verificações');
  if (falhas) { console.error(falhas + ' FALHA(S)'); process.exit(1); }
}
main().catch((x) => { console.error(x); process.exit(1); });
