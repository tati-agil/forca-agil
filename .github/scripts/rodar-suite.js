/* Roda a suíte hermética (suite-hermetica.json) — localmente e nos grupos do CI.
 *
 * Por que existe: no CI cada teste era um passo do workflow, e um passo que falha faz o GitHub
 * PULAR todos os seguintes do job (em 03/10/2026 uma falha do teste-aposta escondeu 21 testes).
 * E rodar em sequência levava 35 min; em paralelo (medido: 3 processos numa máquina de 4 núcleos,
 * 12m37s, 65/65 em 6 suítes completas) cai para um terço.
 *
 * O que garante:
 *   - roda TODOS os testes atribuídos, mesmo depois de uma falha, e só no fim sai com código
 *     diferente de zero se algum falhou (1) — nenhum resultado fica escondido;
 *   - cada teste vira PASS/FAIL com a duração; no fim, um resumo (total, aprovados, falhas,
 *     tempo de parede); a saída completa de cada teste fica num log próprio e, em caso de falha,
 *     o final dela é mostrado aqui (no GitHub Actions, a saída inteira em grupo recolhível);
 *   - recusa rodar (código 2) se algum teste-*.js de .github/scripts não estiver na suíte nem em
 *     foraDaSuite — nenhum teste deixa de ser obrigatório por esquecimento;
 *   - recusa rodar (código 2) se o site não responde em FA_BASE_URL.
 *
 * Uso:
 *   node .github/scripts/rodar-suite.js                  todos, paralelismo automático
 *   node .github/scripts/rodar-suite.js --processos 1    sequencial
 *   node .github/scripts/rodar-suite.js --grupo 2/4      só o grupo 2 de 4 (CI)
 *   node .github/scripts/rodar-suite.js --mostrar-grupos --grupos 4   só mostra a divisão
 *   opções: --processos N|auto (ou FA_PROCESSOS), --lista outra-suite.json, --saida pasta-dos-logs
 *
 * Paralelismo automático: núcleos − 1, no máximo 3 (o ponto de equilíbrio medido: com 4 numa
 * máquina de 4 núcleos a carga dobra e o teste mais frágil, o da Aposta, é o que mais incha), no
 * mínimo 1, e nunca mais processos do que a memória livre comporta (~1,5 GB por navegador).
 * Pedir mais processos do que núcleos é reduzido aos núcleos, com aviso. */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const RAIZ = path.resolve(__dirname, '..', '..');
const LIMITE_AUTO = 3;
const MEMORIA_POR_PROCESSO = 1.5 * 1024 * 1024 * 1024;
const TEMPO_MAXIMO_TESTE_MS = 25 * 60 * 1000;

function argumento(nome, padrao) {
  const i = process.argv.indexOf('--' + nome);
  if (i === -1) return padrao;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
}
function sair(codigo, msg) { console.error(msg); process.exit(codigo); }

/* ---------- a suíte e a verificação de que nada ficou de fora ---------- */
const arquivoLista = path.resolve(RAIZ, argumento('lista', '.github/scripts/suite-hermetica.json'));
const suite = JSON.parse(fs.readFileSync(arquivoLista, 'utf8'));
const testes = suite.testes;
(function verificar() {
  const listados = new Set(testes.map((t) => t.arquivo));
  if (listados.size !== testes.length) sair(2, 'ERRO: a suíte lista o mesmo arquivo mais de uma vez.');
  const fora = suite.foraDaSuite || {};
  const faltando = testes.filter((t) => !fs.existsSync(path.join(RAIZ, t.arquivo))).map((t) => t.arquivo);
  if (faltando.length) sair(2, 'ERRO: arquivos listados na suíte que não existem: ' + faltando.join(', '));
  /* a regra vale para a suíte oficial; uma --lista avulsa (provas) só precisa existir */
  if (arquivoLista !== path.join(RAIZ, '.github/scripts/suite-hermetica.json')) return;
  const dir = path.join(RAIZ, '.github/scripts');
  const orfaos = fs.readdirSync(dir).filter((f) => /^teste-.*\.js$/.test(f))
    .map((f) => '.github/scripts/' + f).filter((f) => !listados.has(f) && !fora[f]);
  if (orfaos.length) sair(2, 'ERRO: teste fora da suíte e sem motivo em foraDaSuite (suite-hermetica.json): ' + orfaos.join(', ') +
    '\nAcrescente-o em "testes" (com a duração aproximada) ou, se não deve rodar aqui, em "foraDaSuite" com o motivo.');
})();

/* ---------- grupos equilibrados por duração (maior primeiro, no grupo mais leve) ---------- */
function dividir(lista, n) {
  const grupos = Array.from({ length: n }, () => ({ testes: [], soma: 0 }));
  [...lista].sort((a, b) => b.duracao - a.duracao || a.arquivo.localeCompare(b.arquivo)).forEach((t) => {
    const g = grupos.reduce((m, x) => (x.soma < m.soma ? x : m), grupos[0]);
    g.testes.push(t); g.soma += t.duracao;
  });
  return grupos;
}
const minSeg = (s) => Math.floor(s / 60) + 'm' + String(Math.round(s % 60)).padStart(2, '0') + 's';

if (argumento('mostrar-grupos', false)) {
  const n = Number(argumento('grupos', 4));
  dividir(testes, n).forEach((g, i) => {
    console.log('Grupo ' + (i + 1) + '/' + n + ' — ' + g.testes.length + ' testes, ~' + minSeg(g.soma) + ' em sequência');
    g.testes.forEach((t) => console.log('   ' + String(t.duracao).padStart(4) + ' s  ' + path.basename(t.arquivo)));
  });
  process.exit(0);
}

let selecionados = testes;
const grupo = argumento('grupo', null);
if (grupo) {
  const m = /^(\d+)\/(\d+)$/.exec(String(grupo));
  if (!m || +m[1] < 1 || +m[1] > +m[2]) sair(2, 'ERRO: --grupo espera N/TOTAL, ex.: 2/4');
  selecionados = dividir(testes, +m[2])[+m[1] - 1].testes;
}

/* ---------- quantos processos ---------- */
const nucleos = typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length;
const porMemoria = Math.max(1, Math.floor(os.freemem() / MEMORIA_POR_PROCESSO));
let pedido = argumento('processos', process.env.FA_PROCESSOS || 'auto');
let processos;
if (pedido === 'auto' || pedido === true) {
  processos = Math.max(1, Math.min(nucleos - 1, LIMITE_AUTO, porMemoria));
} else {
  processos = Math.floor(Number(pedido));
  if (!(processos >= 1)) sair(2, 'ERRO: --processos espera um número ≥ 1 ou "auto".');
  if (processos > nucleos) { console.log('AVISO: ' + processos + ' processos pedidos, mas há ' + nucleos + ' núcleos — usando ' + nucleos + '.'); processos = nucleos; }
}
processos = Math.min(processos, selecionados.length);

/* ---------- o site precisa responder ---------- */
const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
function siteResponde() {
  return new Promise((resolve) => {
    const req = http.get(BASE + '/index.html', (r) => { r.resume(); resolve(r.statusCode === 200); });
    req.on('error', () => resolve(false));
    req.setTimeout(5000, () => { req.destroy(); resolve(false); });
  });
}

/* ---------- execução ---------- */
const naActions = !!process.env.GITHUB_ACTIONS;
const saida = path.resolve(argumento('saida', path.join(os.tmpdir(), 'fa-suite-' + process.pid + '-' + Date.now())));
fs.mkdirSync(saida, { recursive: true });
const filhos = new Set();
function rodarUm(t) {
  return new Promise((resolve) => {
    const nomeLog = path.join(saida, path.basename(t.arquivo, '.js') + '.log');
    const log = fs.createWriteStream(nomeLog);
    const inicio = Date.now();
    const p = spawn(process.execPath, [t.arquivo], { cwd: RAIZ, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    filhos.add(p);
    p.stdout.pipe(log, { end: false }); p.stderr.pipe(log, { end: false });
    let estourou = false;
    const relogio = setTimeout(() => { estourou = true; p.kill('SIGKILL'); }, TEMPO_MAXIMO_TESTE_MS);
    p.on('close', (codigo, sinal) => {
      clearTimeout(relogio); filhos.delete(p);
      log.end(() => resolve({ t, codigo: estourou ? 'tempo esgotado' : (codigo === null ? sinal : codigo), ok: !estourou && codigo === 0, ms: Date.now() - inicio, nomeLog }));
    });
  });
}
function mostrar(r) {
  const linha = (r.ok ? 'PASS' : 'FAIL') + '  ' + (r.ms / 1000).toFixed(1).padStart(6) + ' s  ' + path.basename(r.t.arquivo) + (r.ok ? '' : '  (saída ' + r.codigo + ')') + (r.t.nome ? ' — ' + r.t.nome : '');
  const texto = fs.readFileSync(r.nomeLog, 'utf8');
  if (naActions) { console.log('::group::' + linha); console.log(texto); console.log('::endgroup::'); if (!r.ok) console.log('::error title=' + path.basename(r.t.arquivo) + '::falhou (saída ' + r.codigo + ')'); }
  else {
    console.log(linha);
    if (!r.ok) console.log(texto.split('\n').slice(-60).map((l) => '      | ' + l).join('\n'));
  }
}

(async () => {
  if (!(await siteResponde())) sair(2, 'ERRO: o site não responde em ' + BASE + ' — sirva a raiz do repositório (ex.: python3 -m http.server 8811) ou ajuste FA_BASE_URL.');
  const fila = [...selecionados].sort((a, b) => b.duracao - a.duracao || a.arquivo.localeCompare(b.arquivo));
  console.log('Suíte hermética: ' + fila.length + ' testes' + (grupo ? ' (grupo ' + grupo + ')' : '') + ', ' + processos + ' processo(s) em paralelo' +
    ' [' + nucleos + ' núcleos, ' + Math.round(os.freemem() / 2 ** 30) + ' GB livres] — logs em ' + saida);
  const inicio = Date.now();
  const resultados = [];
  async function trabalhador() {
    while (fila.length) { const r = await rodarUm(fila.shift()); resultados.push(r); mostrar(r); }
  }
  await Promise.all(Array.from({ length: processos }, trabalhador));
  const falhas = resultados.filter((r) => !r.ok);
  const parede = (Date.now() - inicio) / 1000;
  const resumo = { total: resultados.length, aprovados: resultados.length - falhas.length, falhas: falhas.map((r) => path.basename(r.t.arquivo)),
    processos, nucleos, paredeSegundos: Math.round(parede), somaSegundos: Math.round(resultados.reduce((a, r) => a + r.ms, 0) / 1000),
    testes: resultados.map((r) => ({ arquivo: r.t.arquivo, ok: r.ok, segundos: Math.round(r.ms / 100) / 10 })) };
  fs.writeFileSync(path.join(saida, '_resumo.json'), JSON.stringify(resumo, null, 2));
  console.log('\n==== RESUMO: ' + resumo.aprovados + '/' + resumo.total + ' aprovados, ' + falhas.length + ' falha(s) — ' + minSeg(parede) + ' de parede (' + minSeg(resumo.somaSegundos) + ' somados), ' + processos + ' processo(s)');
  if (falhas.length) { console.log('FALHARAM:'); falhas.forEach((r) => console.log('  - ' + path.basename(r.t.arquivo) + ' (log: ' + r.nomeLog + ')')); }
  process.exit(falhas.length ? 1 : 0);
})();

['SIGINT', 'SIGTERM'].forEach((s) => process.on(s, () => { filhos.forEach((p) => p.kill('SIGKILL')); process.exit(130); }));
