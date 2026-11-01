/* ═════════════════════════════════════════════════════════════════
   Regras do banco — LISTA DE ESPERA (fa-espera; montar-regras-fila-espera.js). Integridade: cada pessoa só mexe na
   PRÓPRIA entrada. Roda contra o EMULADOR real do Realtime Database (teste-rules.yml) com o database.rules.json do
   repositório (ou RULES_PATH). Dados 100% sintéticos, no formato dos registros reais (uma entrada por pessoa e origem:
   lista:<evento> ou <turma>). Prova, pelo BANCO — não pela tela:
   M. o nó publicado é exatamente o montado pelo gerador (ninguém o edita à mão) e usa a chave da própria pessoa;
   P. a pessoa faz tudo o que o site faz por ela (app.js): entrar na fila de um evento, sair (removed + removedDate +
      removedBySelf), entrar de novo depois de sair (inclusive numa entrada que o admin tinha mexido), esperar por dois
      eventos; e-mail com hífen, + e mais de 64 caracteres;
   N. recusado: gravar, alterar, marcar como removida ou apagar a entrada de OUTRA pessoa; criar entrada com o e-mail
      de outra pessoa; apagar a própria entrada ou o próprio nó; gravar campo de decisão do admin (motivo, migração,
      quem tirou, movida para turma) ou campo inventado; gravar o nó inteiro de uma pessoa ou a fila inteira;
      multipath que esconde uma gravação proibida; sem login;
   A. o admin (lista fixa e fa-admins) faz tudo o que o painel faz: migrar formato (nó inteiro), preencher eventoKey,
      mover da turma para a espera (com motivo), tirar da fila (com motivo e quem tirou), mover da fila para a turma,
      excluir uma entrada, excluir o cadastro (nó inteiro);
   L. a leitura não mudou (qualquer pessoa logada @previ lê; sem login, não);
   I. preservação: as tentativas recusadas não mudam nenhum registro existente.
   ═════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const RAIZ = path.join(__dirname, '..', '..');
const { BLOCOS } = require('./montar-regras-fila-espera.js');
const { PROPRIA_CHAVE } = require('./montar-regras-fa-users.js');

let total = 0, falhas = 0;
function anota(rotulo, ok, det) { total++; if (ok) console.log('  ok    ' + rotulo); else { falhas++; console.error('  FALHA ' + rotulo + (det ? ' → ' + det : '')); } }
const emailKey = (e) => String(e).toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const AGORA = '2026-11-01T10:00:00.000Z';

const ADMIN = 'admin.fila@previ.com.br', ADMIN_FIXO = 'tatianefdirene@previ.com.br';
const ANA = 'ana.fila@previ.com.br', BIA = 'bia.fila@previ.com.br', CAIO = 'caio.fila@previ.com.br';
const ESPECIAIS = { 'hífen': 'maria-silva.fila@previ.com.br', '+': 'ana+fila@previ.com.br', 'mais de 64': 'f'.repeat(70) + '@previ.com.br' };

const fila = (e) => 'fa-espera/' + emailKey(e);
const entradaSite = (e, ev) => ({ name: 'PESSOA ' + e.split('@')[0].toUpperCase(), email: e, area: 'GETHO', date: AGORA, removed: false, eventoKey: ev });
const SAIDA_SITE = { removed: true, removedDate: AGORA, removedBySelf: true };
/* como os registros reais vindos de uma turma (migrados pelo painel) */
const entradaMigrada = (e, ev, turma) => Object.assign(entradaSite(e, ev), { date: '2026-09-01T10:00:00.000Z', migratedAt: '2026-09-05T10:00:00.000Z',
  migratedByName: 'ADMIN', migratedFrom: turma, motivoEntrada: 'sem_vagas', motivoEntradaDetalhe: 'turma cheia' });

async function main() {
  const regrasTexto = fs.readFileSync(process.env.RULES_PATH || path.join(RAIZ, 'database.rules.json'), 'utf8');

  console.log('\n== M. o nó publicado é o montado ==');
  const publicado = JSON.parse(regrasTexto).rules['fa-espera'];
  anota('M1 fa-espera em database.rules.json é exatamente o de montar-regras-fila-espera.js', JSON.stringify(publicado) === JSON.stringify(BLOCOS['fa-espera']));
  anota('M2 a pessoa grava pela chave da própria pessoa (PROPRIA_CHAVE de fa-users)', publicado.$userKey.$origem['.write'].indexOf(PROPRIA_CHAVE) !== -1);
  anota('M3 nada acima da entrada libera a pessoa (o nó da pessoa e a fila inteira são só do admin)',
    !('.write' in publicado) && publicado.$userKey['.write'].indexOf(PROPRIA_CHAVE) === -1);

  const env = await initializeTestEnvironment({ projectId: 'demo-kyber-agil-rules-fila-espera', database: { rules: regrasTexto } });
  const db = (e) => (e ? env.authenticatedContext('u' + emailKey(e), { email: e, email_verified: true }) : env.unauthenticatedContext()).database();
  const semear = (fn) => env.withSecurityRulesDisabled((c) => fn(c.database()));
  const ler = async (p) => { let v; await semear(async (a) => { v = (await a.ref(p).once('value')).val(); }); return v; };
  async function pode(rotulo, prom) { try { await assertSucceeds(prom); anota(rotulo, true); } catch (x) { anota(rotulo, false, 'NEGADO: ' + String(x.message || x).slice(0, 160)); } }
  async function nega(rotulo, prom) { try { await assertFails(prom); anota(rotulo, true); } catch (x) { anota(rotulo, false, 'foi ACEITO'); } }

  async function reiniciar() {
    await env.clearDatabase();
    await semear(async (a) => {
      await a.ref('fa-admins/' + emailKey(ADMIN)).set({ email: ADMIN, name: 'ADMIN' });
      await a.ref(fila(BIA)).set({ 'lista:evA': entradaSite(BIA, 'evA'), tTurma1: entradaMigrada(BIA, 'evA', 'tTurma1') });
      await a.ref(fila(CAIO)).set({ tTurma2: Object.assign(entradaMigrada(CAIO, 'evB', 'tTurma2'), { removed: true, removedDate: AGORA,
        motivoSaida: 'desistiu', motivoSaidaDetalhe: 'pediu para sair', removedByName: 'ADMIN' }) });
    });
  }
  await reiniciar();
  const biaAntes = await ler(fila(BIA)), caioAntes = await ler(fila(CAIO));

  console.log('\n== P. a pessoa faz o que o site faz por ela ==');
  await pode('P1 entrar na fila de um evento (lista:<evento>)', db(ANA).ref(fila(ANA) + '/lista:evA').set(entradaSite(ANA, 'evA')));
  await pode('P2 esperar também por outro evento', db(ANA).ref(fila(ANA) + '/lista:evB').set(entradaSite(ANA, 'evB')));
  await pode('P3 sair da fila (removed, removedDate, removedBySelf — multipath como o site)', db(ANA).ref().update({
    [fila(ANA) + '/lista:evA/removed']: true, [fila(ANA) + '/lista:evA/removedDate']: AGORA, [fila(ANA) + '/lista:evA/removedBySelf']: true }));
  await pode('P4 entrar de novo depois de sair', db(ANA).ref(fila(ANA) + '/lista:evA').set(entradaSite(ANA, 'evA')));
  await pode('P5 sair de uma entrada que veio de turma (com campos do admin, que ficam como estão)', db(BIA).ref(fila(BIA) + '/tTurma1').update(SAIDA_SITE));
  const biaTurma = await ler(fila(BIA) + '/tTurma1');
  anota('P5 os campos do admin dessa entrada continuam lá', !!biaTurma && biaTurma.motivoEntrada === 'sem_vagas' && biaTurma.migratedFrom === 'tTurma1' && biaTurma.removedBySelf === true, JSON.stringify(biaTurma));
  await pode('P6 entrar de novo na fila depois de o admin ter tirado a pessoa', db(CAIO).ref(fila(CAIO) + '/lista:evB').set(entradaSite(CAIO, 'evB')));
  for (const [qual, e] of Object.entries(ESPECIAIS)) {
    await pode('P7 e-mail com ' + qual + ': entra e sai da própria fila', db(e).ref(fila(e) + '/lista:evA').set(entradaSite(e, 'evA')).then(() =>
      db(e).ref(fila(e) + '/lista:evA').update(SAIDA_SITE)));
  }

  await reiniciar();
  console.log('\n== N. recusado ==');
  await nega('N1 criar entrada na fila de OUTRA pessoa', db(ANA).ref(fila(BIA) + '/lista:evB').set(entradaSite(BIA, 'evB')));
  await nega('N2 marcar como removida a entrada de outra pessoa', db(ANA).ref(fila(BIA) + '/lista:evA').update(SAIDA_SITE));
  await nega('N3 alterar a data (o lugar na fila) da entrada de outra pessoa', db(ANA).ref(fila(BIA) + '/tTurma1/date').set('2020-01-01T00:00:00.000Z'));
  await nega('N4 apagar a entrada de outra pessoa', db(ANA).ref(fila(BIA) + '/lista:evA').remove());
  await nega('N5 apagar o nó de outra pessoa', db(ANA).ref(fila(BIA)).remove());
  await nega('N6 criar, na própria chave, entrada com o e-mail de outra pessoa', db(ANA).ref(fila(ANA) + '/lista:evA').set(entradaSite(BIA, 'evA')));
  await pode('N6 (contraprova) a mesma entrada com o próprio e-mail entra', db(ANA).ref(fila(ANA) + '/lista:evA').set(entradaSite(ANA, 'evA')));
  await nega('N7 apagar a própria entrada (sair é marcar removed)', db(ANA).ref(fila(ANA) + '/lista:evA').remove());
  await nega('N7 apagar o próprio nó inteiro', db(ANA).ref(fila(ANA)).remove());
  await nega('N8 gravar o próprio nó inteiro de uma vez', db(ANA).ref(fila(ANA)).set({ 'lista:evC': entradaSite(ANA, 'evC') }));
  for (const c of ['motivoEntrada', 'migratedFrom', 'removedByName', 'movedToTurma', 'motivoSaida', 'jaParticipouTurma', 'campoInventado']) {
    await nega('N9 gravar campo que só o admin grava: ' + c, db(BIA).ref(fila(BIA) + '/lista:evA/' + c).set('x'));
  }
  await nega('N9 entrar na fila já com campo do admin', db(ANA).ref(fila(ANA) + '/lista:evB').set(Object.assign(entradaSite(ANA, 'evB'), { motivoEntrada: 'sem_vagas' })));
  await nega('N10 removed que não é booleano', db(BIA).ref(fila(BIA) + '/lista:evA/removed').set('sim'));
  await nega('N11 multipath: a própria saída junto com a de outra pessoa', db(ANA).ref().update({
    [fila(ANA) + '/lista:evA/removed']: true, [fila(BIA) + '/lista:evA/removed']: true }));
  await nega('N12 gravar a fila inteira', db(ANA).ref('fa-espera').set({}));
  await nega('N13 sem login: entrar na fila', db(null).ref(fila(ANA) + '/lista:evA').set(entradaSite(ANA, 'evA')));

  console.log('\n== I. preservação ==');
  anota('I1 a fila da outra pessoa continua igual depois das tentativas recusadas', JSON.stringify(await ler(fila(BIA))) === JSON.stringify(biaAntes));
  anota('I2 a entrada que o admin tirou continua com o motivo e quem tirou', JSON.stringify(await ler(fila(CAIO))) === JSON.stringify(caioAntes));

  console.log('\n== L. leitura (não mudou) ==');
  await pode('L1 pessoa logada @previ lê a fila (o site e a Minha Área leem)', db(ANA).ref('fa-espera').once('value'));
  await nega('L2 sem login não lê', db(null).ref('fa-espera').once('value'));

  for (const [qual, adm] of [['admin de fa-admins', ADMIN], ['admin da lista fixa', ADMIN_FIXO]]) {
    await reiniciar();
    console.log('\n== A. ' + qual + ' faz o que o painel faz ==');
    const a = db(adm);
    await pode('A1 migrar formato (regravar o nó inteiro da pessoa)', a.ref(fila(BIA)).set({ 'lista:evA': entradaSite(BIA, 'evA'), tTurma1: entradaMigrada(BIA, 'evA', 'tTurma1') }));
    await pode('A2 preencher o eventoKey que faltava', a.ref(fila(BIA) + '/tTurma1/eventoKey').set('evB'));
    await pode('A3 mover da turma para a espera (entrada com motivo e migração)', a.ref().update({ [fila(ANA) + '/tTurma3']: entradaMigrada(ANA, 'evA', 'tTurma3') }));
    await pode('A4 tirar da fila com motivo e quem tirou', a.ref().update({ [fila(BIA) + '/lista:evA/removed']: true, [fila(BIA) + '/lista:evA/removedDate']: AGORA,
      [fila(BIA) + '/lista:evA/motivoSaida']: 'desistiu', [fila(BIA) + '/lista:evA/motivoSaidaDetalhe']: null, [fila(BIA) + '/lista:evA/removedByName']: 'ADMIN',
      [fila(BIA) + '/lista:evA/jaParticipouTurma']: 'tTurma9', [fila(BIA) + '/lista:evA/jaParticipouTurmaLabel']: 'TURMA 9' }));
    await pode('A5 mover da fila para a turma (movedToTurma)', a.ref().update({ [fila(BIA) + '/tTurma1/removed']: true, [fila(BIA) + '/tTurma1/removedDate']: AGORA,
      [fila(BIA) + '/tTurma1/movedToTurma']: 'tTurma4' }));
    await pode('A6 excluir uma entrada', a.ref(fila(CAIO) + '/tTurma2').remove());
    await pode('A7 excluir o cadastro (o nó inteiro da pessoa)', a.ref(fila(BIA)).remove());
  }

  await env.cleanup();
  console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
  process.exit(falhas ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
