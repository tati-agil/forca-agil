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
 * LEGADO: cada ocorrência que já existia está em esperas-legado.json, identificada por arquivo +
 * impressão (padrão + texto da chamada, espaços normalizados), com contagem para trechos idênticos.
 *   - ocorrência que não está no legado → PROIBIDA (use esperas.js) — inclusive "trocar" uma
 *     antiga por uma nova mantendo a mesma contagem;
 *   - ocorrência do legado que sumiu do código → a guarda pede a atualização explícita:
 *     node .github/scripts/teste-guarda-esperas.js --podar  (só REMOVE do legado; nunca acrescenta).
 * Sem navegador, sem rede. */
const fs = require('fs');
const path = require('path');

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
const crypto = require('crypto');
/* Cada ocorrência: padrão + texto da chamada (com o .then/.catch encadeado), espaços normalizados.
   A impressão é estável a reindentação e muda se a chamada mudar. */
function varrer(src) {
  const ocorrencias = [];
  for (const m of src.matchAll(ESPERAS)) {
    const { args, fim } = argumentos(src, m.index + m[0].length - 1);
    let chamada = src.slice(m.index, fim + 1);
    let resto = src.slice(fim + 1), cadeia = '';
    const then = /^\s*\.then\(/.exec(resto);
    if (then) { const t = argumentos(resto, then[0].length - 1); cadeia += resto.slice(0, t.fim + 1); resto = resto.slice(t.fim + 1); }
    const pegou = /^\s*\.catch\(\s*(\(\s*\w*\s*\)|\w+)\s*=>/.exec(resto);
    const registra = (padrao, texto) => {
      const norm = texto.replace(/\s+/g, ' ').trim();
      ocorrencias.push({ padrao, impressao: crypto.createHash('sha256').update(padrao + '|' + norm).digest('hex').slice(0, 16), trecho: norm.slice(0, 140) });
    };
    if (m[1] === 'waitForFunction' && args.length === 2 && /^\{[\s\S]*\b(timeout|polling)\s*:/.test(args[1])) registra('opcoes-como-argumento', chamada);
    if (pegou) { const c = argumentos(resto, resto.indexOf('(')); registra('catch', chamada + cadeia + resto.slice(0, c.fim + 1)); }
  }
  return ocorrencias;
}
const contar = (ocs) => ({ opcoesComoArg: ocs.filter((o) => o.padrao === 'opcoes-como-argumento').length, silenciosas: ocs.filter((o) => o.padrao === 'catch').length });

/* legado: { arquivo: { impressao: { n, padrao, trecho } } } × atual: { arquivo: [ocorrência] } */
function listaDe(ocs) { const r = {}; ocs.forEach((o) => { (r[o.impressao] = r[o.impressao] || { n: 0, padrao: o.padrao, trecho: o.trecho }).n++; }); return r; }
function comparar(legadoOc, atual) {
  const novas = [], sumiram = [];
  const arqs = new Set(Object.keys(legadoOc).concat(Object.keys(atual)));
  arqs.forEach((f) => {
    const leg = legadoOc[f] || {}, at = listaDe(atual[f] || []);
    Object.keys(at).forEach((k) => { const sobra = at[k].n - ((leg[k] && leg[k].n) || 0); for (let i = 0; i < sobra; i++) novas.push(Object.assign({ arquivo: f, impressao: k }, at[k])); });
    Object.keys(leg).forEach((k) => { const falta = leg[k].n - ((at[k] && at[k].n) || 0); for (let i = 0; i < falta; i++) sumiram.push(Object.assign({ arquivo: f, impressao: k }, leg[k])); });
  });
  return { novas, sumiram };
}

console.log('\n== O varredor enxerga os dois padrões (controles) ==');
const ctl1 = contar(varrer("await page.waitForFunction(() => /a(b)/.test(x), { timeout: 5000 });"));
const ctl2 = contar(varrer("await page.waitForFunction((a) => a, 1, { timeout: 5000 }); await page.waitForSelector('#x', { timeout: 9 }).catch(() => {}); await page.click('#y').then(() => true).catch(() => false);"));
afirma(ctl1.opcoesComoArg === 1 && ctl1.silenciosas === 0, 'acha waitForFunction com as opções no lugar do argumento (mesmo com regex e parênteses dentro)');
afirma(ctl2.opcoesComoArg === 0 && ctl2.silenciosas === 2, 'não confunde a assinatura certa e acha as esperas seguidas de .catch (inclusive depois de .then)');

console.log('\n== Controle: trocar uma ocorrência antiga por uma nova, no mesmo arquivo, com a mesma contagem ==');
{
  const antes = varrer("await page.waitForSelector('#a').catch(() => {});");
  const depois = varrer("await page.waitForSelector('#b').catch(() => {});");
  const d = comparar({ 'x.js': listaDe(antes) }, { 'x.js': depois });
  afirma(contar(antes).silenciosas === contar(depois).silenciosas && d.novas.length === 1 && d.sumiram.length === 1, 'a troca é pega: 1 ocorrência nova (proibida) e 1 legada que sumiu, com a mesma contagem');
}

console.log('\n== Ocorrências de cada arquivo = legado registrado (esperas-legado.json) ==');
const dir = __dirname;
const ARQ_LEGADO = path.join(dir, 'esperas-legado.json');
const legado = JSON.parse(fs.readFileSync(ARQ_LEGADO, 'utf8'));
const arquivos = fs.readdirSync(dir).filter((f) => /^teste-.*\.js$/.test(f) && f !== path.basename(__filename)).sort();
const atual = {};
arquivos.forEach((f) => { const o = varrer(fs.readFileSync(path.join(dir, f), 'utf8')); if (o.length) atual[f] = o; });
const d = comparar(legado.ocorrencias, atual);
if (process.argv.indexOf('--podar') !== -1) {
  /* manutenção: só REMOVE do legado o que não existe mais no código; nunca acrescenta */
  d.sumiram.forEach((x) => { const e = legado.ocorrencias[x.arquivo][x.impressao]; if (--e.n <= 0) delete legado.ocorrencias[x.arquivo][x.impressao]; if (!Object.keys(legado.ocorrencias[x.arquivo]).length) delete legado.ocorrencias[x.arquivo]; });
  fs.writeFileSync(ARQ_LEGADO, JSON.stringify(legado, null, 2) + '\n');
  console.log('  podado: ' + d.sumiram.length + ' ocorrência(s) removida(s) do legado; ' + d.novas.length + ' nova(s) continuam proibidas');
}
afirma(d.novas.length === 0, 'nenhuma espera nova calada ou com a assinatura errada' + (d.novas.length ? ' — use esperas.js: ' + d.novas.map((x) => x.arquivo + ' [' + x.padrao + '] ' + x.trecho).join(' || ') : ''));
afirma(process.argv.indexOf('--podar') !== -1 || d.sumiram.length === 0, 'o legado registrado está em dia' + (d.sumiram.length ? ' — sumiram do código (corrigidas?); rode "node .github/scripts/teste-guarda-esperas.js --podar": ' + d.sumiram.map((x) => x.arquivo + ' [' + x.padrao + '] ' + x.trecho).join(' || ') : ''));
const tot = contar([].concat(...Object.values(atual)));
console.log('  (legado atual: ' + tot.opcoesComoArg + ' waitForFunction com opções no lugar do argumento, ' + tot.silenciosas + ' esperas seguidas de .catch)');

if (falhas) { console.log('\n' + falhas + ' FALHA(S)'); process.exit(1); }
console.log('\nOK — nenhuma espera nova calada nem com a assinatura errada; legado em dia.');
