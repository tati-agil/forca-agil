/* ═══════════════════════════════════════════════════════════
   Regras do banco — COMPATIBILIDADE das gravações em fa-users do código da PR 1-A (segurança de fa-users).
   Roda contra o EMULADOR real do Realtime Database (teste-rules.yml) com o database.rules.json do repositório (ou
   RULES_PATH); as gravações são as que auth.js monta HOJE, com a mesma transação (gravarCadastroNovo). Dados 100%
   sintéticos. Prova, pelo BANCO, que o código novo grava sob as regras atuais — e, sem mudar uma linha, sob as regras
   endurecidas da PR 1-B (este arquivo é a coluna "código novo" da matriz de compatibilidade):
   A. criarContaPorAdmin: o cadastro novo é gravado com a sessão do ADMIN (de fa-admins e da lista fixa), por transação,
      com os mesmos campos de sempre (adminApproved, createdByAdmin).
   B. Completar cadastro: a própria pessoa, com o e-mail confirmado no token, cria o próprio cadastro só com os campos do
      cadastro público (emailVerificationRequired: true), por transação; depois anota a confirmação, como sempre.
   C. Cadastro público (register): a própria pessoa, ainda sem confirmar o e-mail, cria o próprio cadastro (set).
   D. A transação nunca sobrescreve: com o cadastro já existente, não grava nada (committed = false) e o cadastro fica
      intacto — tanto para o admin quanto para a própria pessoa.
   ═══════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds } = require('@firebase/rules-unit-testing');
const RAIZ = path.join(__dirname, '..', '..');

let total = 0, falhas = 0;
function anota(rotulo, ok, det) { total++; if (ok) console.log('  ok    ' + rotulo); else { falhas++; console.error('  FALHA ' + rotulo + (det ? ' → ' + det : '')); } }
const emailKey = (e) => String(e).toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const TS = { '.sv': 'timestamp' };
const ADMIN = 'admin.geral@previ.com.br';            /* admin por fa-admins */
const ADMIN_FIXO = 'tatianefdirene@previ.com.br';    /* admin pela lista fixa (a mesma de database.rules.json) */
const NOVA = 'nova.colaboradora@previ.com.br', PESSOA = 'pessoa.sem.cadastro@previ.com.br', AUTO = 'auto.cadastro@previ.com.br';

async function main() {
  const rules = fs.readFileSync(process.env.RULES_PATH || path.join(RAIZ, 'database.rules.json'), 'utf8');
  const env = await initializeTestEnvironment({ projectId: 'demo-kyber-agil-rules-fa-users-compat', database: { rules } });
  const db = (e, verificado) => env.authenticatedContext(emailKey(e), { email: e, email_verified: !!verificado }).database();
  const semear = (fn) => env.withSecurityRulesDisabled((c) => fn(c.database()));
  const ler = async (p) => { let v; await semear(async (a) => { v = (await a.ref(p).once('value')).val(); }); return v; };
  async function pode(rotulo, prom) { try { const r = await assertSucceeds(prom); anota(rotulo, true); return r; } catch (e) { anota(rotulo, false, 'NEGADO: ' + String(e.message || e).slice(0, 200)); return null; } }
  /* a mesma transação de auth.js gravarCadastroNovo: grava só se a chave estiver vazia */
  const criarSeVazio = (ref, cadastro) => ref.transaction((atual) => (atual === null ? cadastro : undefined));
  async function reiniciar() {
    await env.clearDatabase();
    await semear(async (a) => {
      await a.ref('fa-admins/' + emailKey(ADMIN)).set({ email: ADMIN });
      await a.ref('fa-users/' + emailKey(ADMIN)).set({ email: ADMIN, name: 'ADMIN GERAL', area: 'INFOR', adminApproved: true, createdAt: '2026-06-01T09:00:00.000Z' });
    });
  }
  const criadaPeloAdmin = (e, por) => ({ email: e, name: 'NOVA COLABORADORA', area: 'GECAT', adminApproved: true, createdByAdmin: por, createdAt: new Date().toISOString() });
  const publico = (e, extra) => Object.assign({ email: e, name: 'PESSOA EXEMPLO', area: 'GECAT', optinTurmas: false, emailVerificationRequired: true,
    createdAt: new Date().toISOString() }, extra || {});

  console.log('\nA. conta criada pelo admin: cadastro gravado com a sessão do ADMIN, por transação');
  await reiniciar();
  let r = await pode('A1 admin de fa-admins cria o cadastro novo', criarSeVazio(db(ADMIN, true).ref('fa-users/' + emailKey(NOVA)), criadaPeloAdmin(NOVA, ADMIN)));
  anota('A2 a transação gravou (committed) os campos de sempre', r && r.committed && (await ler('fa-users/' + emailKey(NOVA))).createdByAdmin === ADMIN);
  r = await pode('A3 admin da lista fixa cria outro cadastro novo (sem e-mail confirmado no token, como hoje)',
    criarSeVazio(db(ADMIN_FIXO, false).ref('fa-users/' + emailKey('outra.nova@previ.com.br')), criadaPeloAdmin('outra.nova@previ.com.br', ADMIN_FIXO)));
  anota('A4 gravou', r && r.committed);

  console.log('\nB. Completar cadastro: a própria pessoa, com o e-mail confirmado');
  r = await pode('B1 cria o próprio cadastro só com os campos públicos', criarSeVazio(db(PESSOA, true).ref('fa-users/' + emailKey(PESSOA)), publico(PESSOA, { optinTurmas: true })));
  const gravado = await ler('fa-users/' + emailKey(PESSOA));
  anota('B2 gravou exatamente os campos públicos', r && r.committed && Object.keys(gravado).sort().join() === 'area,createdAt,email,emailVerificationRequired,name,optinTurmas', JSON.stringify(gravado));
  await pode('B3 depois, anota a confirmação do e-mail (como sempre)', db(PESSOA, true).ref('fa-users/' + emailKey(PESSOA)).update({ emailConfirmado: true, emailConfirmadoEm: TS }));

  console.log('\nC. cadastro público (register), ainda sem confirmar o e-mail');
  await pode('C1 cria o próprio cadastro (set, como register)', db(AUTO, false).ref('fa-users/' + emailKey(AUTO)).set(publico(AUTO)));

  console.log('\nD. a transação nunca sobrescreve');
  const antes = JSON.stringify(await ler('fa-users/' + emailKey(PESSOA)));
  r = await pode('D1 a própria pessoa: com o cadastro já existente, a transação termina sem gravar', criarSeVazio(db(PESSOA, true).ref('fa-users/' + emailKey(PESSOA)), publico(PESSOA, { name: 'OUTRO NOME' })));
  anota('D2 nada gravado (committed = false) e cadastro intacto', r && r.committed === false && JSON.stringify(await ler('fa-users/' + emailKey(PESSOA))) === antes);
  r = await pode('D3 o admin: idem', criarSeVazio(db(ADMIN, true).ref('fa-users/' + emailKey(PESSOA)), criadaPeloAdmin(PESSOA, ADMIN)));
  anota('D4 nada gravado e cadastro intacto (sem adminApproved)', r && r.committed === false && JSON.stringify(await ler('fa-users/' + emailKey(PESSOA))) === antes);

  await env.cleanup();
  console.log('\n' + (total - falhas) + '/' + total + ' verificações');
  if (falhas) { console.error(falhas + ' FALHA(S)'); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
