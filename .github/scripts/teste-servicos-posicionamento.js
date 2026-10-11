/* B1 (H2-b) — interface de serviços do Posicionamento (forca-agil/posicionamento-servicos.js), sem navegador.
 *   A. A tela de Posicionamento não chama o Firebase: nenhum firebase./db() em avaliacao-posicionamento.js; o
 *      site carrega a interface depois de firebase.js e antes da tela.
 *   B. Contrato do adaptador Firebase: gravar atômico (um update da raiz com o payload inteiro, intacto); ok → null;
 *      recusa → o erro; prazo sem resposta → 'sem-resposta' (e a resposta atrasada é ignorada: cb uma vez só);
 *      exceção síncrona → o erro; novaChave; lerUmaVez (valor, null, recusa rejeita); ouvir (cada mudança,
 *      erro, cancelar desliga). */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RAIZ = path.join(__dirname, '..', '..');
let total = 0, falhas = 0;
function afirma(c, msg, det) { total++; console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det ? ' → ' + det : '')); if (!c) falhas++; }

console.log('A. a tela só fala com a interface');
const tela = fs.readFileSync(path.join(RAIZ, 'forca-agil', 'avaliacao-posicionamento.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
afirma(!/firebase\.|\bdb\(\)/.test(tela), 'avaliacao-posicionamento.js não usa firebase nem db()');
const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const pos = (f) => html.indexOf('<script src="forca-agil/' + f + '"></script>');
afirma(pos('firebase.js') !== -1 && pos('firebase.js') < pos('posicionamento-servicos.js') && pos('posicionamento-servicos.js') < pos('avaliacao-posicionamento.js'), 'ordem de carga: firebase.js → posicionamento-servicos.js → avaliacao-posicionamento.js');

console.log('B. contrato do adaptador Firebase');
function contexto() {
  const log = { updates: [], on: [], off: [] }, pendentes = [], lidos = {}, recusas = {};
  const ctx = { console, JSON, Object, Array, String, Math, Number, Date, RegExp, Error, Promise, setTimeout, clearTimeout };
  ctx.window = ctx;
  ctx.firebase = { database: () => ({ ref: (p) => ({
    update(v, cb) { log.updates.push({ caminho: p, valor: v }); if (ctx.__lancar) throw new Error('falha síncrona'); pendentes.push(cb); },
    push() { return { key: 'k-' + (p || 'raiz') }; },
    once() { return recusas[p] ? Promise.reject(new Error('permission_denied')) : Promise.resolve({ val: () => (p in lidos ? lidos[p] : null) }); },
    on(ev, cb, erro) { log.on.push({ caminho: p, ev, cb, erro }); },
    off(ev, cb) { log.off.push({ caminho: p, ev, cb }); }
  }) }) };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(RAIZ, 'forca-agil', 'posicionamento-servicos.js'), 'utf8'), ctx);
  return { S: ctx.faServicosPosicionamento, log, pendentes, lidos, recusas, ctx };
}
(async () => {
  const c = contexto();
  afirma(Object.isFrozen(c.S) && c.S.implementacao === 'firebase-rtdb', 'interface congelada; implementação atual: firebase-rtdb');
  const payload = { 'a/1': { x: 1 }, 'b/2': 'y', 'c/3': null };
  let r = []; c.S.gravar(payload, 200, (e) => r.push(e));
  afirma(c.log.updates.length === 1 && c.log.updates[0].caminho === undefined && c.log.updates[0].valor === payload, 'um único update na raiz com o payload inteiro (atômico, intacto)');
  c.pendentes.shift()(null);
  afirma(JSON.stringify(r) === '[null]', 'gravou → cb(null)');
  r = []; c.S.gravar(payload, 200, (e) => r.push(e)); c.pendentes.shift()(new Error('PERMISSION_DENIED'));
  afirma(r.length === 1 && /PERMISSION_DENIED/.test(String(r[0])), 'recusada → cb(erro)');
  r = []; c.S.gravar(payload, 30, (e) => r.push(e));
  await new Promise((ok) => setTimeout(ok, 60));
  c.pendentes.shift()(null);
  afirma(JSON.stringify(r) === '["sem-resposta"]', 'prazo sem resposta → "sem-resposta"; a resposta atrasada é ignorada (cb uma vez)');
  c.ctx.__lancar = true; r = []; c.S.gravar(payload, 200, (e) => r.push(e)); c.ctx.__lancar = false;
  afirma(r.length === 1 && /falha síncrona/.test(String(r[0])), 'exceção síncrona → cb(erro), uma vez');
  await new Promise((ok) => setTimeout(ok, 250));
  afirma(r.length === 1, '... e o prazo não chama de novo');
  afirma(c.S.novaChave('avaliacoes-posicionamento') === 'k-avaliacoes-posicionamento', 'novaChave sob o caminho');
  c.lidos['x/1'] = { a: 1 };
  afirma(JSON.stringify(await c.S.lerUmaVez('x/1')) === '{"a":1}' && (await c.S.lerUmaVez('x/2')) === null, 'lerUmaVez: valor; ausente = null');
  c.recusas['x/3'] = true; let rejeitou = false;
  try { await c.S.lerUmaVez('x/3'); } catch (e) { rejeitou = true; }
  afirma(rejeitou, 'lerUmaVez recusada rejeita (nunca vira "vazio")');
  const vistos = [], erros = [];
  const cancelar = c.S.ouvir('y', (v) => vistos.push(v), (e) => erros.push(e));
  const o = c.log.on[0];
  o.cb({ val: () => ({ n: 1 }) }); o.cb({ val: () => null }); o.erro('negado');
  afirma(o.caminho === 'y' && o.ev === 'value' && JSON.stringify(vistos) === '[{"n":1},null]' && erros[0] === 'negado', 'ouvir: cada mudança e o erro chegam');
  cancelar();
  afirma(c.log.off.length === 1 && c.log.off[0].cb === o.cb && c.log.off[0].caminho === 'y', 'cancelar desliga exatamente aquele ouvinte');
  console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
  process.exit(falhas ? 1 : 0);
})();
