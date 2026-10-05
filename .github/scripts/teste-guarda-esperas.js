/* GUARDA DAS ESPERAS — nenhuma espera nova calada nem com a assinatura errada.
 *
 * O diagnóstico da suíte (PR 2) achou dois padrões que custavam tempo e, pior, deixavam testes
 * passando sem provar nada:
 *   1. page.waitForFunction(fn, { timeout }) — o objeto vai como ARGUMENTO da função, não como
 *      opção; o limite escrito é ignorado e vale o padrão de 30 s (assinatura certa:
 *      waitForFunction(fn, arg, { timeout })).
 *   2. espera seguida de .catch(...) — waitFor…/reload/goto/click que estoura e é engolido: o
 *      teste segue como se a condição tivesse acontecido.
 * Código novo usa esperas.js (esperarCondicao / esperarCondicaoAte / esperarAusencia).
 *
 * LEGADO: a contagem ATUAL de cada arquivo está abaixo e tem de BATER EXATAMENTE:
 *   - subiu  → espera nova com um dos padrões: use esperas.js;
 *   - desceu → alguém corrigiu: baixe o número aqui (a lista só diminui, nunca fica desatualizada).
 * Sem navegador, sem rede. */
const fs = require('fs');
const path = require('path');

/* arquivo: [waitForFunction com opções no lugar do argumento, esperas seguidas de .catch] */
const LEGADO = {
  "teste-a-validar-gestao.js": [1, 3],
  "teste-a-validar-natureza.js": [1, 3],
  "teste-admin-abrir-lista-restrita.js": [9, 0],
  "teste-admin-navegacao.js": [1, 1],
  "teste-admin-nome-evento-completo.js": [1, 0],
  "teste-aposta.js": [28, 1],
  "teste-avaliacoes-acessos.js": [4, 14],
  "teste-avaliacoes-ajustes.js": [4, 6],
  "teste-avaliacoes-ficha.js": [2, 2],
  "teste-avaliacoes-navegacao.js": [2, 13],
  "teste-avaliacoes-troca-usuario.js": [2, 12],
  "teste-conflito-naturezas.js": [1, 3],
  "teste-corrigir-email.js": [2, 0],
  "teste-curadoria-decisao-coerencia.js": [2, 11],
  "teste-curadoria-orfa.js": [2, 5],
  "teste-curadoria.js": [7, 8],
  "teste-editar-cadastro.js": [1, 0],
  "teste-exportacoes-trilha.js": [1, 2],
  "teste-ficha-estrutura.js": [5, 7],
  "teste-interpretacoes-p5-p15-natureza.js": [6, 10],
  "teste-menu-notebook.js": [1, 2],
  "teste-motor-adicionar-condicao.js": [1, 1],
  "teste-motor-concorrencia-publicacao.js": [1, 1],
  "teste-motor-diffregras-semantica.js": [1, 1],
  "teste-motor-legivel.js": [1, 1],
  "teste-motor-modal-atualizacao.js": [4, 8],
  "teste-motor-noop-atomico.js": [1, 1],
  "teste-motor-normalizacao-semantica.js": [1, 1],
  "teste-motor-reconciliacao.js": [4, 11],
  "teste-motor-reprocessamento-badge.js": [1, 1],
  "teste-motor-reprocessar-lote-robusto.js": [3, 4],
  "teste-natureza-complementar.js": [12, 11],
  "teste-pdf-quebra-titulos.js": [1, 2],
  "teste-pedido-envio.js": [1, 0],
  "teste-publico-restrito-incluir-todos.js": [2, 0],
  "teste-questionarios-excel.js": [1, 1],
  "teste-repositorio-carregando.js": [1, 0],
  "teste-squad-exportacoes.js": [1, 1],
  "teste-squad-inicio-motor.js": [1, 1],
  "teste-tabela-avaliacoes-rolagem.js": [1, 1],
  "teste-taxonomia.js": [4, 26],
  "teste-texto-componente.js": [1, 3],
  "teste-texto-unidade-valor.js": [1, 3],
  "teste-textos-informacao-documento.js": [2, 4],
  "teste-ver-como-turmas.js": [2, 3]
};

let falhas = 0;
function afirma(cond, msg) { console.log((cond ? '  ok    ' : '  FALHA ') + msg); if (!cond) falhas++; }

/* Argumentos de topo de uma chamada, a partir do "(" — respeita strings, comentários, regex e aninhamento. */
function argumentos(src, i) {
  const args = []; let prof = 0, ini = i + 1, k, aspas = null, prevSig = '(';
  for (k = i; k < src.length; k++) {
    const c = src[k], d = src[k + 1];
    if (aspas) { if (c === '\\') { k++; continue; } if (c === aspas) aspas = null; continue; }
    if (c === '/' && d === '/') { k = src.indexOf('\n', k); continue; }
    if (c === '/' && d === '*') { k = src.indexOf('*/', k) + 1; continue; }
    if (c === "'" || c === '"' || c === '`') { aspas = c; continue; }
    if (c === '/' && /[(,=:\[!&|?{};]/.test(prevSig)) { let cl = false; for (k++; k < src.length; k++) { const x = src[k]; if (x === '\\') { k++; continue; } if (x === '[') cl = true; else if (x === ']') cl = false; else if (x === '/' && !cl) break; } prevSig = 'r'; continue; }
    if (c === '(' || c === '[' || c === '{') prof++;
    else if (c === ')' || c === ']' || c === '}') { prof--; if (prof === 0) { args.push(src.slice(ini, k).trim()); return { args, fim: k }; } }
    else if (c === ',' && prof === 1) { args.push(src.slice(ini, k).trim()); ini = k + 1; }
    if (!/\s/.test(c)) prevSig = c;
  }
  return { args, fim: k };
}
const ESPERAS = /\.(waitForFunction|waitForSelector|waitForEvent|waitForLoadState|waitForURL|waitFor|reload|goto|click)\(/g;
function varrer(src) {
  let opcoesComoArg = 0, silenciosas = 0;
  for (const m of src.matchAll(ESPERAS)) {
    const { args, fim } = argumentos(src, m.index + m[0].length - 1);
    if (m[1] === 'waitForFunction' && args.length === 2 && /^\{[\s\S]*\b(timeout|polling)\s*:/.test(args[1])) opcoesComoArg++;
    let resto = src.slice(fim + 1);
    const then = /^\s*\.then\(/.exec(resto);
    if (then) { const t = argumentos(resto, then[0].length - 1); resto = resto.slice(t.fim + 1); }
    if (/^\s*\.catch\(\s*(\(\s*\w*\s*\)|\w+)\s*=>/.test(resto)) silenciosas++;
  }
  return { opcoesComoArg, silenciosas };
}
console.log('\n== O varredor enxerga os dois padrões (controles) ==');
const ctl1 = varrer("await page.waitForFunction(() => /a(b)/.test(x), { timeout: 5000 });");
const ctl2 = varrer("await page.waitForFunction((a) => a, 1, { timeout: 5000 }); await page.waitForSelector('#x', { timeout: 9 }).catch(() => {}); await page.click('#y').then(() => true).catch(() => false);");
afirma(ctl1.opcoesComoArg === 1 && ctl1.silenciosas === 0, 'acha waitForFunction com as opções no lugar do argumento (mesmo com regex e parênteses dentro)');
afirma(ctl2.opcoesComoArg === 0 && ctl2.silenciosas === 2, 'não confunde a assinatura certa e acha as esperas seguidas de .catch (inclusive depois de .then)');

console.log('\n== Contagem por arquivo = legado registrado ==');
const dir = __dirname;
const arquivos = fs.readdirSync(dir).filter((f) => /^teste-.*\.js$/.test(f) && f !== path.basename(__filename)).sort();
const subiu = [], desceu = [];
let total = [0, 0];
for (const f of arquivos) {
  const r = varrer(fs.readFileSync(path.join(dir, f), 'utf8'));
  const leg = LEGADO[f] || [0, 0];
  total[0] += r.opcoesComoArg; total[1] += r.silenciosas;
  if (r.opcoesComoArg > leg[0] || r.silenciosas > leg[1]) subiu.push(f + ' (agora ' + r.opcoesComoArg + '/' + r.silenciosas + ', legado ' + leg[0] + '/' + leg[1] + ')');
  else if (r.opcoesComoArg < leg[0] || r.silenciosas < leg[1]) desceu.push(f + ' (agora ' + r.opcoesComoArg + '/' + r.silenciosas + ', legado ' + leg[0] + '/' + leg[1] + ')');
}
const fantasmas = Object.keys(LEGADO).filter((f) => arquivos.indexOf(f) === -1);
afirma(subiu.length === 0, 'nenhuma espera nova calada ou com a assinatura errada' + (subiu.length ? ' — use esperas.js em: ' + subiu.join('; ') : ''));
afirma(desceu.length === 0, 'o legado registrado está em dia' + (desceu.length ? ' — corrigido, baixe o número no LEGADO: ' + desceu.join('; ') : ''));
afirma(fantasmas.length === 0, 'o legado não cita arquivo que não existe' + (fantasmas.length ? ': ' + fantasmas.join(', ') : ''));
console.log('  (legado atual: ' + total[0] + ' waitForFunction com opções no lugar do argumento, ' + total[1] + ' esperas seguidas de .catch)');

if (falhas) { console.log('\n' + falhas + ' FALHA(S)'); process.exit(1); }
console.log('\nOK — nenhuma espera nova calada nem com a assinatura errada; legado em dia.');
