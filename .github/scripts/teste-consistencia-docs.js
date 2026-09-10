/* Consistência entre a documentação viva e o que está implementado.
 *
 * POR QUE ESTE TESTE EXISTE
 * O site documenta a si mesmo em três páginas do painel — Manual (manual.js),
 * Mapa (mapa.js) e Testes (testes.js). Elas são escritas à mão, então
 * envelhecem em silêncio: uma aba nova entra no painel e ninguém soma 1 na
 * frase que diz quantas abas existem. Numa auditoria em 10/09/2026 o painel
 * tinha 15 abas e a documentação dizia 14 em três lugares (e 15 num quarto,
 * contradizendo a si mesma); a aba "Tipos de atividade" e o nó do banco que a
 * alimenta não apareciam em documentação nenhuma; e o mapa dizia que
 * index.html tinha 14 seções quando tem 11.
 *
 * Nada disso quebra o site — e é exatamente por isso que apodrece. Quem lê a
 * documentação para decidir algo decide errado, e ninguém descobre.
 *
 * O que aqui é verificável mecanicamente está verificado. O que é prosa
 * (explicar POR QUE uma regra existe) continua sendo trabalho humano, e este
 * teste não tenta julgar.
 *
 * REGRA DE ESCRITA que este teste impõe: ao escrever "N abas" em manual.js ou
 * mapa.js, N tem que ser o total real de abas do painel. Para falar de um
 * subconjunto, escreva sem o padrão "N abas" ("as abas de documentação",
 * "três delas") — senão o teste, que não entende contexto, acusa.
 */

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', '..');
const ler = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

const DOCS = ['forca-agil/manual.js', 'forca-agil/mapa.js', 'forca-agil/testes.js'];
const falhas = [];
const oks = [];

function checar(nome, condicao, detalhe) {
  if (condicao) { oks.push(nome); console.log('  ok    ' + nome + (detalhe ? '  — ' + detalhe : '')); }
  else { falhas.push(nome + (detalhe ? ' — ' + detalhe : '')); console.log('  FALHA ' + nome + (detalhe ? '  — ' + detalhe : '')); }
}

const indexHtml = ler('index.html');
const routerJs  = ler('forca-agil/router.js');
const mapaJs    = ler('forca-agil/mapa.js');
const claudeMd  = ler('CLAUDE.md');
const regras    = JSON.parse(ler('database.rules.json'));

/* ---------- 1. Abas do painel admin ---------- */
console.log('\n== Abas do painel admin ==');
const abasReais = (indexHtml.match(/class="admin-tab-btn[^>]*>([^<]+)</g) || [])
  .map((m) => m.replace(/.*>/, '').replace(/<$/, '').trim());
console.log('  ' + abasReais.length + ' abas no index.html: ' + abasReais.join(', '));

DOCS.slice(0, 2).forEach((arq) => {
  const s = ler(arq);
  const claims = [...s.matchAll(/(\d+) abas/g)].map((m) => Number(m[1]));
  const erradas = claims.filter((n) => n !== abasReais.length);
  checar('contagem de abas em ' + arq, erradas.length === 0,
    claims.length ? 'diz ' + claims.join('/') + ', são ' + abasReais.length : 'não afirma contagem');
});

/* Toda aba real precisa estar nomeada nas duas docs — uma aba nova sem
   documentação é o caso mais comum de rot. */
DOCS.slice(0, 2).forEach((arq) => {
  const s = ler(arq);
  const ausentes = abasReais.filter((a) => !s.includes(a));
  checar('todas as abas nomeadas em ' + arq, ausentes.length === 0,
    ausentes.length ? 'faltam: ' + ausentes.join(', ') : abasReais.length + ' presentes');
});

/* ---------- 2. Rotas ---------- */
console.log('\n== Rotas ==');
const rotas = routerJs.match(/PAGES\s*=\s*\[([^\]]*)\]/)[1]
  .split(',').map((p) => p.trim().replace(/'/g, '')).filter(Boolean);
const secoes = (indexHtml.match(/class="page-section/g) || []).length;
console.log('  router.js: ' + rotas.length + ' rotas · index.html: ' + secoes + ' .page-section');
checar('rotas do router batem com as seções do index.html', rotas.length === secoes,
  rotas.length + ' vs ' + secoes);

const listaClaude = (claudeMd.match(/fixed page list \(([^)]*)\)/) || [])[1] || '';
const foraDoClaude = rotas.filter((r) => !listaClaude.includes('`' + r + '`'));
checar('CLAUDE.md lista todas as rotas', foraDoClaude.length === 0,
  foraDoClaude.length ? 'faltam: ' + foraDoClaude.join(', ') : rotas.length + ' listadas');

/* ---------- 3. Nós do Realtime Database ---------- */
console.log('\n== Nós do banco ==');
const nosRegras = Object.keys(regras.rules).filter((k) => !k.startsWith('.') && !k.startsWith('$'));
const arquivosCodigo = fs.readdirSync(path.join(RAIZ, 'forca-agil'))
  .filter((f) => f.endsWith('.js') && !DOCS.includes('forca-agil/' + f));
const codigo = arquivosCodigo.map((f) => ler('forca-agil/' + f)).join('\n');
const usados = nosRegras.filter((n) => codigo.includes("'" + n + "'") || codigo.includes("'" + n + "/"));
console.log('  ' + nosRegras.length + ' nós nas regras · ' + usados.length + ' usados pelo código');

/* Todo nó que o código usa tem que estar na descrição do banco no Mapa.
   Órfão (nó nas regras que nenhum código usa) é permitido, mas só se a
   documentação disser que é legado — senão é sujeira sem aviso. */
const i = mapaJs.indexOf('Regras de seguran');
const descBanco = mapaJs.slice(mapaJs.lastIndexOf("{ name: 'Firebase Realtime Database'", i), i);
const naoDocumentados = usados.filter((n) => !descBanco.includes(n));
checar('todo nó usado pelo código está na descrição do banco (mapa.js)',
  naoDocumentados.length === 0,
  naoDocumentados.length ? 'faltam: ' + naoDocumentados.join(', ') : usados.length + ' documentados');

const orfaos = nosRegras.filter((n) => !usados.includes(n));
const orfaosSemAviso = orfaos.filter((n) => {
  const j = descBanco.indexOf(n);
  return j === -1 || !/LEGADO|legado|não usar/.test(descBanco.slice(Math.max(0, j - 400), j + 400));
});
checar('nó órfão nas regras está marcado como legado na doc',
  orfaosSemAviso.length === 0,
  orfaos.length ? 'órfãos: ' + orfaos.join(', ') + (orfaosSemAviso.length ? ' — SEM aviso de legado: ' + orfaosSemAviso.join(', ') : ' (todos avisados)') : 'nenhum órfão');

/* A contagem declarada tem que bater com os itens listados. */
const claimEstruturas = Number((descBanco.match(/(\d+) estruturas principais/) || [])[1]);
const bullets = (descBanco.match(/•\s*[a-z][a-z0-9-]*/g) || []).length;
checar('contagem de estruturas do banco bate com a lista', claimEstruturas === bullets,
  'diz ' + claimEstruturas + ', lista ' + bullets);

/* ---------- 4. Arquivos ---------- */
console.log('\n== Arquivos ==');
const jsReais = fs.readdirSync(path.join(RAIZ, 'forca-agil')).filter((f) => f.endsWith('.js')).sort();
const jsNoMapa = [...mapaJs.matchAll(/name: 'forca-agil\/([a-z0-9.-]+\.js)'/g)].map((m) => m[1]);
const semDoc = jsReais.filter((f) => !jsNoMapa.includes(f));
const soNoMapa = jsNoMapa.filter((f) => !jsReais.includes(f));
checar('todo .js de forca-agil/ está na Estrutura de Arquivos do mapa', semDoc.length === 0,
  semDoc.length ? 'faltam: ' + semDoc.join(', ') : jsReais.length + ' documentados');
checar('mapa não cita arquivo inexistente', soNoMapa.length === 0,
  soNoMapa.length ? 'fantasmas: ' + soNoMapa.join(', ') : 'nenhum');

/* ---------- 5. Funcionalidades removidas ---------- */
/* Texto que promete um botão à pessoa e o botão não existe é pior que
   documentação errada: é o sistema mentindo na tela. Aconteceu de verdade — o
   "↩ Desfazer última migração" foi retirado do Roteiro-base e DOIS diálogos
   continuaram dizendo "dá pra desfazer depois pelo botão…", com as funções de
   restaurar viradas em código morto e o backup ainda sendo gravado no banco,
   sem leitor e sem limpeza.
   Tentei escrever um detector genérico ("todo botão citado em texto existe
   de fato") e ele acusou 27 falsos positivos: rótulo em title=, rótulo
   concatenado em tempo de execução, rótulo montado por innerHTML. Um teste
   que grita 27 vezes por engano é desligado em uma semana, então preferi uma
   lista explícita: ao REMOVER uma funcionalidade, acrescente o nome dela aqui
   e o CI garante que nenhum resquício sobrou em código, texto ou marcação. */
console.log('\n== Funcionalidades removidas ==');
const REMOVIDAS = [
  { nome: 'Desfazer última migração', removidaEm: 'PR #108' },
];
/* As três páginas de documentação ficam FORA desta varredura de propósito:
   elas precisam poder contar que o botão existiu e por que saiu. O alvo aqui
   é o código vivo e a marcação — o que a pessoa vê na tela. Descobri isso
   rodando o teste: ele acusou o próprio texto do Manual que explica a
   remoção, que é justamente o texto que deve existir. */
const codigoVivo = jsReais
  .filter((f) => !DOCS.includes('forca-agil/' + f))
  .map((f) => ler('forca-agil/' + f)).join('\n') + indexHtml;
REMOVIDAS.forEach((r) => {
  const sobrou = codigoVivo.includes(r.nome);
  checar('nenhum resquício de "' + r.nome + '" (' + r.removidaEm + ')', !sobrou,
    sobrou ? 'ainda citado em código vivo ou marcação' : 'limpo (documentação pode citar)');
});

/* ---------- resultado ---------- */
console.log('\n' + oks.length + ' verificações ok, ' + falhas.length + ' falha(s).');
if (falhas.length) {
  console.error('\nInconsistências entre documentação e implementação:');
  falhas.forEach((f) => console.error('  - ' + f));
  process.exit(1);
}
