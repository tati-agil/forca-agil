/* CRITÉRIO DE REAVALIAÇÃO — window.faCriterioReavaliacao (PR F).
 *
 * O critério que decide se uma resposta herdada vale de novo ('null'), vale com aviso ('ajuda') ou precisa ser
 * respondida de novo ('pergunta') nasceu em avaliacao-produto.js (P1–P16). O PR F só o EXTRAIU para uma função
 * pura e o expôs congelado, para o Posicionamento Organizacional (O1–O9) usar o MESMO critério — sem cópia.
 * Sem navegador e sem rede (vm):
 *   1. o objeto exposto é congelado, e a lista de campos também (outro módulo não altera o critério de Produto);
 *   2. os campos comparados são exatamente titulo, textoAjuda, exemplo, exemplos e ajudaExtra;
 *   3. situacao(): texto ausente ou diferente → 'pergunta'; sem prova da ajuda da época → 'ajuda';
 *      ajuda igual (inclusive com chaves em outra ordem, null/''/ausente) → null; um campo de ajuda mudou → 'ajuda';
 *   4. situacaoRespostaHerdada de Produto continua passando pela mesma função (mesmo resultado nas perguntas reais). */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RAIZ = path.join(__dirname, '..', '..', 'forca-agil');

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

function carregar() {
  const ctx = { console, JSON, Object, Array, String, Math, Number, Date, RegExp, Error, Promise, setTimeout, clearTimeout, setInterval, clearInterval, parseFloat, parseInt, isNaN };
  ctx.window = ctx;
  const el = () => ({ addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, style: {}, classList: { add() {}, remove() {}, contains() { return false; } } });
  ctx.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, addEventListener() {}, body: el(), documentElement: el() };
  ctx.firebase = { database: () => ({ ref: () => ({ on() {}, once() {}, update() {}, child() { return this; }, push() { return { key: 'k' }; } }) }) };
  ctx.navigator = {}; ctx.location = { hash: '' }; ctx.localStorage = { getItem() { return null; }, setItem() {} };
  vm.createContext(ctx);
  ['questionarios-config.js', 'motor-arquitetura.js', 'avaliacao-produto.js'].forEach((f) => {
    vm.runInContext(fs.readFileSync(path.join(RAIZ, f), 'utf8'), ctx, { filename: f });
  });
  return ctx;
}
const ctx = carregar();
const C = ctx.faCriterioReavaliacao;

console.log('\n== 1. Exposto congelado ==');
afirma(!!C, 'window.faCriterioReavaliacao existe depois de avaliacao-produto.js');
if (!C) { console.log('\n============================\n1 FALHA(S)'); process.exit(1); }
afirma(Object.isFrozen(C), 'o objeto é congelado');
afirma(Object.isFrozen(C.CAMPOS_AJUDA_COMPARADOS), 'a lista de campos é congelada');
const original = C.situacao;
try { C.situacao = function () { return null; }; } catch (e) { /* modo estrito do vm: atribuição recusada */ }
afirma(C.situacao === original, 'não dá para trocar a função');
try { C.CAMPOS_AJUDA_COMPARADOS.push('texto'); } catch (e) { /* idem */ }
afirma(C.CAMPOS_AJUDA_COMPARADOS.length === 5, 'não dá para acrescentar campo à lista');

console.log('\n== 2. Campos comparados ==');
afirma(JSON.stringify(Array.from(C.CAMPOS_AJUDA_COMPARADOS)) === JSON.stringify(['titulo', 'textoAjuda', 'exemplo', 'exemplos', 'ajudaExtra']),
  'titulo, textoAjuda, exemplo, exemplos, ajudaExtra', JSON.stringify(C.CAMPOS_AJUDA_COMPARADOS));
afirma(typeof C.conteudoNormalizado === 'function' && typeof C.mesmoConteudo === 'function', 'conteudoNormalizado e mesmoConteudo expostos');

console.log('\n== 3. situacao() ==');
const base = { texto: 'Pergunta?', titulo: 'T', textoAjuda: { a: 'x', b: 'y' }, exemplo: '', exemplos: ['e1'], ajudaExtra: null };
const casos = [
  ['texto da época ausente', null, base, base, 'pergunta'],
  ['texto da época vazio', '', base, base, 'pergunta'],
  ['texto mudou', 'Outra pergunta?', base, base, 'pergunta'],
  ['texto igual, sem prova da ajuda da época', 'Pergunta?', null, base, 'ajuda'],
  ['texto e ajuda iguais', 'Pergunta?', base, Object.assign({}, base), null],
  ['chaves em outra ordem, null/""/ausente equivalentes', 'Pergunta?',
    { texto: 'Pergunta?', titulo: 'T', textoAjuda: { b: 'y', a: 'x' }, exemplos: ['e1'] }, base, null],
  ['só o título mudou', 'Pergunta?', Object.assign({}, base, { titulo: 'T2' }), base, 'ajuda'],
  ['só textoAjuda mudou', 'Pergunta?', Object.assign({}, base, { textoAjuda: { a: 'x', b: 'z' } }), base, 'ajuda'],
  ['só exemplo mudou', 'Pergunta?', Object.assign({}, base, { exemplo: 'novo' }), base, 'ajuda'],
  ['só exemplos mudou', 'Pergunta?', Object.assign({}, base, { exemplos: ['e1', 'e2'] }), base, 'ajuda'],
  ['só ajudaExtra mudou', 'Pergunta?', Object.assign({}, base, { ajudaExtra: 'mais' }), base, 'ajuda'],
  ['campo fora da lista mudou (não é ajuda)', 'Pergunta?', Object.assign({}, base, { ordem: 9 }), base, null]
];
casos.forEach(([rot, textoAntes, antes, agora, esperado]) => {
  const r = C.situacao(textoAntes, antes, agora);
  afirma(r === esperado, rot + ' → ' + JSON.stringify(esperado), JSON.stringify(r));
});

console.log('\n== 4. Produto/Serviço usa a mesma função ==');
const Q = ctx.faQuestionarios;
const codigos = Q.perguntasDaVersao('CLASSIFICACAO_ARQUITETURAL').map((p) => p.codigoEstavel);
afirma(codigos.length >= 16, 'perguntas de Produto/Serviço carregadas (' + codigos.length + ')');
let iguais = 0;
codigos.forEach((cod) => {
  const c = Q.conteudoPergunta('CLASSIFICACAO_ARQUITETURAL', cod, 1);
  if (C.situacao(c.texto, c, c) === null && C.situacao('outro', c, c) === 'pergunta') iguais++;
});
afirma(iguais === codigos.length, 'conteúdo real: igual → null, texto diferente → pergunta (' + iguais + '/' + codigos.length + ')');

console.log('\n============================\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
process.exit(falhas ? 1 : 0);
