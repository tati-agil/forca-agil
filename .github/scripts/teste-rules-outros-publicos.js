/* ═════════════════════════════════════════════════════════════════
   Regras do banco — ADMIN › OUTROS PÚBLICOS (fa-outros-publicos; montar-regras-outros-publicos.js).
   Roda contra o EMULADOR real do Realtime Database (teste-rules.yml) com o database.rules.json do repositório (ou
   RULES_PATH). Dados 100% sintéticos. Prova, pelo BANCO — não pela tela:
   M. o nó publicado é exatamente o montado pelo gerador;
   S. os dois super-admins incluem (uma ou várias categorias), acrescentam e trocam categorias e removem;
   G. só o admin de fa-admins NÃO grava nada; a pessoa NÃO se inclui nem muda as próprias categorias; sem login, nada;
   V. recusado mesmo para super-admin: chave que não é a do e-mail do registro; e-mail fora de @previ.com.br; sem
      categoria; categoria inventada ou com valor diferente de true; campo inventado; sem email/addedAt/addedBy; tirar a
      última categoria (sem nenhuma, o que se faz é remover);
   L. a lista inteira só os super-admins leem (há menores de idade nela); o admin de fa-admins e a própria pessoa leem
      UM registro; pessoa comum não lê o de outra; sem login, nada;
   P. preservação: Gerentes e Diretores com as permissões de antes; gravar aqui não mexe em turmas, inscrições nem
      em gerentes/diretores; as tentativas recusadas não mudam nada.
   ═════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const RAIZ = path.join(__dirname, '..', '..');
const { BLOCOS } = require('./montar-regras-outros-publicos.js');

let total = 0, falhas = 0;
function anota(rotulo, ok, det) { total++; if (ok) console.log('  ok    ' + rotulo); else { falhas++; console.error('  FALHA ' + rotulo + (det ? ' → ' + det : '')); } }
const emailKey = (e) => String(e).toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const AGORA = '2026-11-01T10:00:00.000Z';

const SUPER1 = 'tatianefdirene@previ.com.br', SUPER2 = 'danielfrazao@previ.com.br', ADMIN = 'admin.comum.rop@previ.com.br';
const EST = 'estagiaria.rop@previ.com.br', APR = 'aprendiz.rop@previ.com.br', COMUM = 'pessoa.comum.rop@previ.com.br';
const LONGO = 'l'.repeat(70) + '@previ.com.br', HIFEN = 'maria-silva.rop@previ.com.br';
const NO = 'fa-outros-publicos';
const reg = (e, cats, extra) => Object.assign({ email: e, name: 'PESSOA', categorias: cats, addedAt: AGORA, addedBy: SUPER1 }, extra || {});

async function main() {
  const regrasTexto = fs.readFileSync(process.env.RULES_PATH || path.join(RAIZ, 'database.rules.json'), 'utf8');
  console.log('\n== M. o nó publicado é o montado ==');
  anota('M1 fa-outros-publicos em database.rules.json é exatamente o de montar-regras-outros-publicos.js',
    JSON.stringify(JSON.parse(regrasTexto).rules[NO]) === JSON.stringify(BLOCOS[NO]));

  const env = await initializeTestEnvironment({ projectId: 'demo-kyber-agil-rules-outros-publicos', database: { rules: regrasTexto } });
  const db = (e) => (e ? env.authenticatedContext('u' + emailKey(e), { email: e, email_verified: true }) : env.unauthenticatedContext()).database();
  const semear = (fn) => env.withSecurityRulesDisabled((c) => fn(c.database()));
  const ler = async (p) => { let v; await semear(async (a) => { v = (await a.ref(p).once('value')).val(); }); return v; };
  async function pode(rotulo, prom) { try { await assertSucceeds(prom); anota(rotulo, true); } catch (x) { anota(rotulo, false, 'NEGADO: ' + String(x.message || x).slice(0, 160)); } }
  async function nega(rotulo, prom) { try { await assertFails(prom); anota(rotulo, true); } catch (x) { anota(rotulo, false, 'foi ACEITO'); } }
  const r = (e) => NO + '/' + emailKey(e);

  await semear(async (a) => {
    await a.ref('fa-admins/' + emailKey(ADMIN)).set({ email: ADMIN, name: 'ADMIN' });
    await a.ref(r(EST)).set(reg(EST, { estagiario: true }));
    await a.ref(r(APR)).set(reg(APR, { menorAprendiz: true }));
    await a.ref('turmas/tX').set({ label: 'T', eventoKey: 'evX', dias: ['2027-01-10'], order: 1 });
    await a.ref('turmas-interesse/tX/' + emailKey(EST)).set({ name: 'E', email: EST, area: 'TI', date: AGORA, removed: false, status: 'interessado' });
    await a.ref('fa-gerentes/' + emailKey(COMUM)).set({ email: COMUM, name: 'G' });
  });
  const intocados = {};
  for (const n of ['turmas', 'turmas-interesse', 'fa-gerentes', 'fa-diretores']) intocados[n] = await ler(n);

  console.log('\n== S. super-admins mantêm a lista ==');
  for (const s of [SUPER1, SUPER2]) {
    const novo = 'novo.' + emailKey(s).slice(0, 8) + '.rop@previ.com.br';
    await pode('S1 ' + s.split('@')[0] + ': inclui com várias categorias', db(s).ref(r(novo)).set(reg(novo, { coaud: true, conselhoFiscal: true, conselhoDeliberativo: true })));
    await pode('S2 ' + s.split('@')[0] + ': acrescenta categoria (multipath com updatedAt/By)', db(s).ref().update({ [r(novo) + '/categorias/conselhoConsultivo']: true,
      [r(novo) + '/updatedAt']: AGORA, [r(novo) + '/updatedBy']: s }));
    await pode('S3 ' + s.split('@')[0] + ': troca as categorias', db(s).ref(r(novo) + '/categorias').set({ estagiario: true, menorAprendiz: true }));
    await pode('S4 ' + s.split('@')[0] + ': tira uma categoria (sobra outra)', db(s).ref(r(novo) + '/categorias/menorAprendiz').remove());
    await pode('S5 ' + s.split('@')[0] + ': remove a pessoa', db(s).ref(r(novo)).remove());
  }
  await pode('S6 e-mail com hífen', db(SUPER1).ref(r(HIFEN)).set(reg(HIFEN, { coaud: true })));
  await pode('S6 e-mail com mais de 64 caracteres (chave cortada em 64)', db(SUPER1).ref(r(LONGO)).set(reg(LONGO, { coaud: true })));

  console.log('\n== G. ninguém mais grava ==');
  await nega('G1 admin de fa-admins NÃO inclui', db(ADMIN).ref(r(COMUM)).set(reg(COMUM, { coaud: true }, { addedBy: ADMIN })));
  await nega('G1 admin de fa-admins NÃO acrescenta categoria', db(ADMIN).ref(r(EST) + '/categorias/coaud').set(true));
  await nega('G1 admin de fa-admins NÃO remove', db(ADMIN).ref(r(EST)).remove());
  await nega('G2 a pessoa NÃO se inclui', db(COMUM).ref(r(COMUM)).set(reg(COMUM, { coaud: true }, { addedBy: COMUM })));
  await nega('G2 a pessoa NÃO tira a própria categoria nem se remove', db(EST).ref(r(EST)).remove());
  await nega('G2 a pessoa NÃO troca a própria categoria', db(EST).ref(r(EST) + '/categorias').set({ coaud: true }));
  await nega('G3 sem login NÃO grava', db(null).ref(r(COMUM)).set(reg(COMUM, { coaud: true })));
  await nega('G4 multipath: a pessoa tira a própria categoria junto com uma mudança na própria inscrição', db(EST).ref().update({
    [r(EST) + '/categorias/estagiario']: null, ['turmas-interesse/tX/' + emailKey(EST) + '/removed']: true }));

  console.log('\n== V. validação (mesmo para super-admin) ==');
  await nega('V1 chave que não é a do e-mail do registro', db(SUPER1).ref(NO + '/outra_chave_previ_com_br').set(reg(COMUM, { coaud: true })));
  await nega('V2 e-mail fora de @previ.com.br', db(SUPER1).ref(NO + '/fulano_gmail_com').set(reg('fulano@gmail.com', { coaud: true })));
  await nega('V3 sem categoria', db(SUPER1).ref(r(COMUM)).set(reg(COMUM, {})));
  await nega('V4 categoria inventada', db(SUPER1).ref(r(COMUM)).set(reg(COMUM, { tecnico: true })));
  await nega('V4 categoria com valor diferente de true', db(SUPER1).ref(r(COMUM)).set(reg(COMUM, { coaud: 'sim' })));
  await nega('V5 campo inventado', db(SUPER1).ref(r(COMUM)).set(reg(COMUM, { coaud: true }, { cargo: 'gerente' })));
  await nega('V6 sem addedAt/addedBy', db(SUPER1).ref(r(COMUM)).set({ email: COMUM, categorias: { coaud: true } }));
  await nega('V7 tirar a última categoria (o que se faz é remover)', db(SUPER1).ref(r(EST) + '/categorias/estagiario').remove());

  console.log('\n== L. leitura ==');
  await pode('L1 super-admin lê a lista inteira', db(SUPER1).ref(NO).once('value'));
  await nega('L2 admin de fa-admins NÃO lê a lista inteira (há menores de idade)', db(ADMIN).ref(NO).once('value'));
  await pode('L3 admin de fa-admins lê UM registro', db(ADMIN).ref(r(APR)).once('value'));
  await pode('L4 a pessoa lê o próprio registro', db(APR).ref(r(APR)).once('value'));
  await pode('L4 quem não está na lista lê o próprio (vazio)', db(COMUM).ref(r(COMUM)).once('value'));
  await nega('L5 pessoa comum NÃO lê o registro de outra (menor aprendiz)', db(COMUM).ref(r(APR)).once('value'));
  await nega('L5 pessoa comum NÃO lê a lista inteira', db(COMUM).ref(NO).once('value'));
  await nega('L6 sem login NÃO lê', db(null).ref(r(APR)).once('value'));

  console.log('\n== P. preservação ==');
  await pode('P1 admin de fa-admins continua gravando em fa-gerentes', db(ADMIN).ref('fa-gerentes/' + emailKey(HIFEN)).set({ email: HIFEN, name: 'G' }));
  await pode('P1 admin de fa-admins continua removendo de fa-gerentes', db(ADMIN).ref('fa-gerentes/' + emailKey(HIFEN)).remove());
  await pode('P1 admin de fa-admins continua gravando em fa-diretores', db(ADMIN).ref('fa-diretores/' + emailKey(HIFEN)).set({ email: HIFEN, name: 'D' }));
  await pode('P1 admin de fa-admins continua removendo de fa-diretores', db(ADMIN).ref('fa-diretores/' + emailKey(HIFEN)).remove());
  for (const n of Object.keys(intocados)) anota('P2 ' + n + ' igual depois de tudo', JSON.stringify(await ler(n)) === JSON.stringify(intocados[n]));
  const est = await ler(r(EST));
  anota('P3 o registro que as tentativas recusadas miravam continua igual', !!est && JSON.stringify(est.categorias) === JSON.stringify({ estagiario: true }), JSON.stringify(est));

  await env.cleanup();
  console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
  process.exit(falhas ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
