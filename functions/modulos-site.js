/* B4 — os MÓDULOS DO SITE no servidor, sem reescrever nenhuma regra.
 * functions/site/ é a cópia byte a byte de forca-agil/ (copiar-modulos-fronteira.js, no predeploy e antes dos testes).
 *   N, G: o núcleo do motor e a governança — módulos puros, carregados com require (module.exports).
 *   carregar(config): a redação dos questionários (questionarios-config.js) e o critério de conteúdo de
 *   Produto/Serviço (faCriterioReavaliacao, de avaliacao-produto.js), executados num contexto isolado com o
 *   nó questionarios-config lido do banco — o mesmo jeito que os testes do site já os executam. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const DIR = path.join(__dirname, 'site');
const N = require(path.join(DIR, 'motor-posicionamento-nucleo.js'));
const G = require(path.join(DIR, 'governanca-posicionamento.js'));
/* H3-b: também o motor v1, os NOMES dos posicionamentos (Taxonomia) e o núcleo da tela de Posicionamento — a conclusão
   de uma avaliação de motor ≥ 2 é montada pelo MESMO payloadConclusao da tela */
const SCRIPTS = ['motor-posicionamento-nucleo.js', 'governanca-posicionamento.js', 'questionarios-config.js', 'motor-arquitetura.js', 'avaliacao-produto.js',
  'motor-posicionamento.js', 'posicionamentos.js', 'avaliacao-posicionamento.js']
  .map((f) => new vm.Script(fs.readFileSync(path.join(DIR, f), 'utf8'), { filename: f }));

/* banco só de leitura, já lido: ref(caminho).on('value') responde na hora com o valor do snapshot */
function bancoLido(dados) {
  function valor(caminho) {
    return String(caminho || '').split('/').filter(Boolean).reduce((v, k) => (v && typeof v === 'object' ? v[k] : undefined), dados);
  }
  function ref(caminho) {
    const r = {
      on(ev, cb) { cb({ val: () => { const v = valor(caminho); return v === undefined ? null : JSON.parse(JSON.stringify(v)); } }); return cb; },
      off() {}, once() { return Promise.resolve({ val: () => (valor(caminho) === undefined ? null : valor(caminho)) }); },
      update() { throw new Error('somente leitura'); }, set() { throw new Error('somente leitura'); },
      child(c) { return ref(caminho + '/' + c); }, push() { return { key: 'k' }; },
      orderByChild() { return r; }, equalTo() { return r; }, limitToLast() { return r; }
    };
    return r;
  }
  const database = () => ({ ref });
  database.ServerValue = { TIMESTAMP: 0 };
  return { database, auth: () => ({ currentUser: null, onAuthStateChanged() {} }) };
}
function carregar(dados) {
  const ctx = { console: { log() {}, warn() {}, error() {}, info() {} }, JSON, Object, Array, String, Math, Number, Date, RegExp, Error, Promise, Set, Map,
    setTimeout, clearTimeout, setInterval() { return 0; }, clearInterval() {}, parseFloat, parseInt, isNaN };
  ctx.window = ctx;
  ctx.addEventListener = () => {}; ctx.removeEventListener = () => {};
  /* o servidor lê como o perfil que pediu a operação (já conferido por quem chama): posicionamentos.js só lê os nomes com acesso */
  ctx.faAuth = { podeAvaliacao: () => true, isAvaliacaoReady: () => true };
  const el = () => ({ addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, style: {}, classList: { add() {}, remove() {}, contains() { return false; } } });
  ctx.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, addEventListener() {}, body: el(), documentElement: el() };
  ctx.firebase = bancoLido(dados || {});
  ctx.navigator = {}; ctx.location = { hash: '' }; ctx.localStorage = { getItem() { return null; }, setItem() {} };
  vm.createContext(ctx);
  SCRIPTS.forEach((s) => s.runInContext(ctx));
  if (ctx.faPosicionamentos && typeof ctx.faPosicionamentos.iniciar === 'function') ctx.faPosicionamentos.iniciar();
  return { Q: ctx.faQuestionarios, mesmoConteudo: ctx.faCriterioReavaliacao.mesmoConteudo, T: ctx.faAvaliacaoPosicionamentoNucleo, P: ctx.faPosicionamentos, B: ctx.faBaseProdutoServico };
}
module.exports = { N, G, carregar };
