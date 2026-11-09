/* ═════════════════════════════════════════════════════════════════
   Regras do banco — NOME de quem está na lista de administradores (fa-admins/<chave>/name).
   POR QUE: ADMIN › Cadastrados › Editar cadastro grava o nome em todas as cópias da pessoa, inclusive fa-admins; só os
   dois super-admins podiam gravar ali, e a edição de quem é admin falhava inteira para os outros admins ("se deixa
   mexer, tem de salvar"). Roda no EMULADOR real (teste-rules.yml). Prova:
   N. qualquer admin atualiza o NOME de quem já está na lista;
   S. incluir, remover ou trocar outro campo de administrador continua só com os dois super-admins;
   V. nome vazio, não texto ou longo demais recusado; nome numa chave que não está na lista (criaria um admin) recusado;
   P. pessoa comum não grava nada aqui; a edição completa (cadastro + cópias) passa para um admin de fa-admins.
   ═════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');

let total = 0, falhas = 0;
function anota(rotulo, ok, det) { total++; if (ok) console.log('  ok    ' + rotulo); else { falhas++; console.error('  FALHA ' + rotulo + (det ? ' → ' + det : '')); } }
const chave = (e) => String(e).toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const SUPER = 'tatianefdirene@previ.com.br', ADMIN = 'admin.comum.nome@previ.com.br', CADU = 'cadu.nome@previ.com.br', COMUM = 'pessoa.nome@previ.com.br';

async function main() {
  const regras = fs.readFileSync(process.env.RULES_PATH || path.join(__dirname, '..', '..', 'database.rules.json'), 'utf8');
  const env = await initializeTestEnvironment({ projectId: 'demo-kyber-agil-rules-admins-nome', database: { rules: regras } });
  const db = (e) => (e ? env.authenticatedContext('u' + chave(e), { email: e, email_verified: true }) : env.unauthenticatedContext()).database();
  const semear = (fn) => env.withSecurityRulesDisabled((c) => fn(c.database()));
  async function pode(r, p) { try { await assertSucceeds(p); anota(r, true); } catch (x) { anota(r, false, 'NEGADO: ' + String(x.message || x).slice(0, 140)); } }
  async function nega(r, p) { try { await assertFails(p); anota(r, true); } catch (x) { anota(r, false, 'foi ACEITO'); } }
  await semear(async (a) => {
    await a.ref('fa-admins/' + chave(ADMIN)).set({ email: ADMIN, name: 'ADMIN COMUM' });
    await a.ref('fa-admins/' + chave(CADU)).set({ email: CADU, name: 'CADU' });
    await a.ref('fa-users/' + chave(CADU)).set({ email: CADU, name: 'CADU', area: 'PNSEG' });
  });
  console.log('\n== N. nome ==');
  await pode('N1 admin de fa-admins atualiza o nome de outro admin', db(ADMIN).ref('fa-admins/' + chave(CADU) + '/name').set('CARLOS EDUARDO'));
  await pode('N2 super-admin também', db(SUPER).ref('fa-admins/' + chave(CADU) + '/name').set('CARLOS EDUARDO H'));
  console.log('\n== S. lista continua dos super-admins ==');
  await nega('S1 admin comum não inclui administrador', db(ADMIN).ref('fa-admins/' + chave(COMUM)).set({ email: COMUM, name: 'X' }));
  await nega('S2 admin comum não remove administrador', db(ADMIN).ref('fa-admins/' + chave(CADU)).remove());
  await nega('S3 admin comum não muda o e-mail do registro', db(ADMIN).ref('fa-admins/' + chave(CADU) + '/email').set('outro@previ.com.br'));
  await nega('S4 admin comum não apaga o nome', db(ADMIN).ref('fa-admins/' + chave(CADU) + '/name').remove());
  await pode('S5 super-admin inclui administrador (como antes)', db(SUPER).ref('fa-admins/' + chave(COMUM)).set({ email: COMUM, name: 'NOVO' }));
  await pode('S6 super-admin remove (como antes)', db(SUPER).ref('fa-admins/' + chave(COMUM)).remove());
  console.log('\n== V. validação ==');
  await nega('V1 nome numa chave fora da lista (criaria um admin)', db(ADMIN).ref('fa-admins/' + chave('ninguem@previ.com.br') + '/name').set('NINGUEM'));
  await nega('V2 nome vazio', db(ADMIN).ref('fa-admins/' + chave(CADU) + '/name').set(''));
  await nega('V3 nome que não é texto', db(ADMIN).ref('fa-admins/' + chave(CADU) + '/name').set(5));
  await nega('V4 nome longo demais', db(ADMIN).ref('fa-admins/' + chave(CADU) + '/name').set('X'.repeat(201)));
  console.log('\n== P. pessoa comum e a edição completa ==');
  await nega('P1 pessoa comum não muda o nome de um admin', db(COMUM).ref('fa-admins/' + chave(CADU) + '/name').set('X'));
  await pode('P2 a edição de cadastro de quem é admin (cadastro + cópia em fa-admins) passa para um admin comum',
    db(ADMIN).ref().update({ ['fa-users/' + chave(CADU) + '/name']: 'CARLOS EDUARDO', ['fa-users/' + chave(CADU) + '/area']: 'INFOR', ['fa-admins/' + chave(CADU) + '/name']: 'CARLOS EDUARDO' }));
  await env.cleanup();
  console.log('\n' + (total - falhas) + ' de ' + total + ' ok');
  process.exit(falhas ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
