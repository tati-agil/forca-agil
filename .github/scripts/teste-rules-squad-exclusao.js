/* Regras do banco — Adequação à Squad: EXCLUSÃO LÓGICA e RESTAURAÇÃO (19/10/2026). Roda no emulador real (teste-rules.yml).
 * As gravações são as que a tela faz (avaliacao-squad.js › confirmarGestao): o registro + a auditoria na mesma gravação.
 *   A. Nada se apaga de verdade (nem o registro, nem o nó inteiro, nem a auditoria).
 *   B. Excluir: só os perfis que já gravam a Squad; justificativa obrigatória (não em branco, até 500); autoria do token;
 *      horário do servidor; auditoria nova "exclusao" com a mesma justificativa, na mesma gravação.
 *   C. Excluído: os dados da exclusão não mudam por fora de uma restauração; registro novo não nasce excluído.
 *   D. Restaurar: justificativa, autoria, horário e auditoria "restauracao"; a exclusão anterior continua na auditoria.
 *   E. Auditoria só de acréscimo; respostas e resultado intactos; salvar/reprocessar uma avaliação ativa segue normal. */
'use strict';
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
let total = 0, falhas = 0;
async function caso(nome, p, deve) {
  total++;
  try { await (deve ? assertSucceeds(p) : assertFails(p)); console.log('  ok    ' + nome); }
  catch (e) { falhas++; console.log('  FALHA ' + nome + ' → ' + String((e && e.message) || e).split('\n')[0]); }
}
function anota(nome, ok, det) { total++; if (ok) console.log('  ok    ' + nome); else { falhas++; console.log('  FALHA ' + nome + (det ? ' → ' + det : '')); } }
const ARQ = 'arquitetura@previ.com.br', AVAL = 'avaliacao@previ.com.br', SEM = 'sem.acesso@previ.com.br';
const k = (e) => e.replace(/[@.]/g, '_');
const SQ = 'avaliacoes-squad', AUD = 'avaliacoes-squad-auditoria', TS = { '.sv': 'timestamp' };
const registro = (extra) => Object.assign({ itemId: 'iX', itemNome: 'Item X', questionarioCodigo: 'ADEQUACAO_SQUAD', questionnaireContentVersion: 1, status: 'concluido',
  criadoEm: '2026-10-19T10:00:00.000Z', atualizadoEm: '2026-10-19T10:00:00.000Z', criadoPor: { name: 'P', email: ARQ }, respostas: { S1: { valor: 'sim' } }, resultadoAutomatico: 'r', excluido: false }, extra || {});
/* a gravação da tela */
function gestao(id, acao, email, just, audId, ajuste) {
  const b = SQ + '/' + id + '/', up = {}, por = { email, name: 'Pessoa' };
  up[b + 'excluido'] = acao === 'excluir'; up[b + 'auditoriaExclusaoId'] = audId;
  if (acao === 'excluir') { up[b + 'excluidoEm'] = TS; up[b + 'excluidoPor'] = por; up[b + 'justificativaExclusao'] = just; }
  else { up[b + 'restauradoEm'] = TS; up[b + 'restauradoPor'] = por; up[b + 'justificativaRestauracao'] = just; }
  up[AUD + '/' + id + '/' + audId] = { tipo: acao === 'excluir' ? 'exclusao' : 'restauracao', justificativa: just, em: TS, por };
  if (ajuste) ajuste(up);
  return up;
}

(async () => {
  const rules = fs.readFileSync(process.env.RULES_PATH || path.join(__dirname, '..', '..', 'database.rules.json'), 'utf8');
  const env = await initializeTestEnvironment({ projectId: 'demo-kyber-agil-rules-squad-exclusao', database: { rules } });
  const db = (e) => env.authenticatedContext(k(e), { email: e }).database();
  const semear = (fn) => env.withSecurityRulesDisabled((c) => fn(c.database()));
  const ler = async (p) => { let v; await semear(async (a) => { v = (await a.ref(p).once('value')).val(); }); return v; };
  await env.clearDatabase();
  await semear(async (a) => {
    await a.ref('fa-avaliacao-autorizados/' + k(ARQ)).set({ email: ARQ, tipo: 'avaliacao-arquitetura' });
    await a.ref('fa-avaliacao-autorizados/' + k(AVAL)).set({ email: AVAL, tipo: 'avaliacao' });
    await a.ref(SQ + '/s1').set(registro());
    await a.ref(SQ + '/s2').set(registro({ itemId: 'iY', itemNome: 'Item Y' }));
  });

  console.log('A. Nada se apaga de verdade');
  await caso('apagar uma avaliação de squad é recusado', db(ARQ).ref(SQ + '/s1').remove(), false);
  await caso('apagar o nó inteiro é recusado', db(ARQ).ref(SQ).remove(), false);

  console.log('B. Excluir');
  await caso('sem perfil não exclui', db(SEM).ref().update(gestao('s1', 'excluir', SEM, 'Teste criado por engano', 'a1')), false);
  await caso('sem justificativa é recusado', db(ARQ).ref().update(gestao('s1', 'excluir', ARQ, '   ', 'a1')), false);
  await caso('sem a auditoria na mesma gravação é recusado', db(ARQ).ref().update(gestao('s1', 'excluir', ARQ, 'Teste criado por engano', 'a1', (u) => { delete u[AUD + '/s1/a1']; })), false);
  await caso('autoria de outra pessoa é recusada', db(ARQ).ref().update(gestao('s1', 'excluir', AVAL, 'Teste criado por engano', 'a1')), false);
  await caso('horário do cliente (não do servidor) é recusado', db(ARQ).ref().update(gestao('s1', 'excluir', ARQ, 'Teste criado por engano', 'a1', (u) => { u[SQ + '/s1/excluidoEm'] = 123; })), false);
  await caso('auditoria com justificativa diferente é recusada', db(ARQ).ref().update(gestao('s1', 'excluir', ARQ, 'Teste criado por engano', 'a1', (u) => { u[AUD + '/s1/a1'].justificativa = 'Outra'; })), false);
  await caso('marcar "excluído" sem nada (como antes) é recusado', db(ARQ).ref(SQ + '/s1/excluido').set(true), false);
  await caso('Avaliação + Configuração exclui, com justificativa, autoria, horário e auditoria', db(ARQ).ref().update(gestao('s1', 'excluir', ARQ, 'Teste criado por engano', 'a1')), true);
  const s1 = await ler(SQ + '/s1');
  anota('respostas, resultado e status intactos; a exclusão registrada', s1.excluido === true && s1.respostas.S1.valor === 'sim' && s1.resultadoAutomatico === 'r' && s1.status === 'concluido' && s1.justificativaExclusao === 'Teste criado por engano' && typeof s1.excluidoEm === 'number');
  await caso('perfil Avaliação também exclui (os mesmos perfis que gravam a Squad)', db(AVAL).ref().update(gestao('s2', 'excluir', AVAL, 'Duplicada', 'a2')), true);

  console.log('C. Excluído não muda por fora');
  await caso('trocar a justificativa da exclusão é recusado', db(ARQ).ref(SQ + '/s1/justificativaExclusao').set('Outra'), false);
  await caso('reusar a mesma auditoria é recusado', db(ARQ).ref().update(gestao('s1', 'restaurar', ARQ, 'Volta', 'a1')), false);
  await caso('registro novo não nasce excluído', db(ARQ).ref(SQ + '/s9').set(registro({ excluido: true })), false);

  console.log('D. Restaurar');
  await caso('restaurar sem justificativa é recusado', db(ARQ).ref().update(gestao('s1', 'restaurar', ARQ, '', 'a3')), false);
  await caso('restaurar com justificativa, autoria, horário e auditoria', db(ARQ).ref().update(gestao('s1', 'restaurar', ARQ, 'Era válida', 'a3')), true);
  const s1r = await ler(SQ + '/s1'), auds = Object.values((await ler(AUD + '/s1')) || {});
  anota('restaurada; a auditoria guarda a exclusão e a restauração', s1r.excluido === false && s1r.justificativaRestauracao === 'Era válida' && auds.length === 2 && auds.some((x) => x.tipo === 'exclusao') && auds.some((x) => x.tipo === 'restauracao'));

  console.log('E. Auditoria e fluxo normal');
  await caso('a auditoria não se reescreve', db(ARQ).ref(AUD + '/s1/a1/justificativa').set('Outra'), false);
  await caso('a auditoria não se apaga', db(ARQ).ref(AUD + '/s1/a1').remove(), false);
  await caso('salvar uma avaliação ativa (como a tela) segue permitido', db(ARQ).ref(SQ + '/s1').update({ atualizadoEm: '2026-10-19T11:00:00.000Z', resultadoAutomatico: 'r2' }), true);
  await caso('criar uma avaliação nova segue permitido', db(ARQ).ref(SQ + '/s3').set(registro({ itemId: 'iZ', itemNome: 'Item Z', status: 'rascunho' })), true);

  await env.cleanup();
  console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
