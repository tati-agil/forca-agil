/* Consistência entre a referência técnica e o que está implementado.
 *
 * POR QUE ESTE TESTE EXISTE
 * A referência técnica (docs/referencia-tecnica.md) descreve o banco e os
 * módulos para quem desenvolve, mantém ou migra o site. Ela é escrita à mão,
 * então envelhece em silêncio: um nó novo entra nas regras e ninguém o
 * documenta; um arquivo sai e a tabela continua citando-o. Nada disso quebra o
 * site — e é exatamente por isso que apodrece. Quem lê a documentação para
 * decidir algo (uma migração, uma regra nova) decide errado.
 *
 * Até a Etapa 6.2 este teste lia o texto das abas ADMIN › Mapa e Manual. O
 * dicionário do banco e a lista de arquivos saíram da interface para
 * docs/referencia-tecnica.md, e é ela que este teste confere agora.
 *
 * O que é verificável mecanicamente está verificado. O que é prosa (a
 * finalidade de um nó, o porquê de uma regra) continua sendo trabalho humano.
 */

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', '..');
const ler = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');
const REF = 'docs/referencia-tecnica.md';

const falhas = [];
const oks = [];

function checar(nome, condicao, detalhe) {
  if (condicao) { oks.push(nome); console.log('  ok    ' + nome + (detalhe ? '  — ' + detalhe : '')); }
  else { falhas.push(nome + (detalhe ? ' — ' + detalhe : '')); console.log('  FALHA ' + nome + (detalhe ? '  — ' + detalhe : '')); }
}

const indexHtml = ler('index.html');
const routerJs  = ler('forca-agil/router.js');
const claudeMd  = ler('CLAUDE.md');
const regras    = JSON.parse(ler('database.rules.json'));
let ref = '';
try { ref = ler(REF); } catch (e) { /* tratado logo abaixo */ }

console.log('\n== Referência técnica ==');
checar(REF + ' existe', ref.length > 0, ref.length ? ref.length + ' caracteres' : 'arquivo ausente');
if (!ref.length) { relatar(); }

/* Seção "## N. Título" → texto até a próxima seção de mesmo nível. */
function secao(titulo) {
  const i = ref.search(new RegExp('^## \\d+\\. ' + titulo, 'm'));
  if (i === -1) return '';
  const resto = ref.slice(i + 3);
  const j = resto.search(/^## /m);
  return j === -1 ? resto : resto.slice(0, j);
}
/* Linhas de tabela cuja 1ª coluna é `nome` em código. */
function linhasDaTabela(texto) {
  const linhas = {};
  texto.split('\n').forEach((l) => {
    const m = l.match(/^\|\s*`([^`]+)`\s*\|(.*)$/);
    if (m) linhas[m[1]] = m[2];
  });
  return linhas;
}

/* ---------- 1. Rotas ---------- */
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

/* ---------- 2. Nós do Realtime Database ---------- */
console.log('\n== Dicionário do banco ==');
const nosRegras = Object.keys(regras.rules).filter((k) => !k.startsWith('.') && !k.startsWith('$'));
const arquivosCodigo = fs.readdirSync(path.join(RAIZ, 'forca-agil'))
  .filter((f) => f.endsWith('.js') && f !== 'manual.js');
const codigo = arquivosCodigo.map((f) => ler('forca-agil/' + f)).join('\n');
/* "Usado" = aparece como caminho ('no' ou 'no/…'), não só como palavra solta. */
const usado = (n) => codigo.includes("'" + n + "'") || codigo.includes("'" + n + "/") || codigo.includes('"' + n + '/');
const dicionario = linhasDaTabela(secao('Dicionário do banco'));
const documentados = Object.keys(dicionario);
console.log('  ' + nosRegras.length + ' nós nas regras · ' + documentados.length + ' no dicionário');

const semDoc = nosRegras.filter((n) => !documentados.includes(n));
checar('todo nó das regras está no dicionário', semDoc.length === 0,
  semDoc.length ? 'faltam: ' + semDoc.join(', ') : nosRegras.length + ' documentados');
const fantasmas = documentados.filter((n) => !nosRegras.includes(n));
checar('o dicionário não cita nó que não existe nas regras', fantasmas.length === 0,
  fantasmas.length ? 'fantasmas: ' + fantasmas.join(', ') : 'nenhum');
const orfaosSemAviso = nosRegras.filter((n) => !usado(n) && dicionario[n] !== undefined && !/LEGADO/.test(dicionario[n]));
checar('nó que nenhum código usa está marcado como LEGADO', orfaosSemAviso.length === 0,
  orfaosSemAviso.length ? 'sem aviso: ' + orfaosSemAviso.join(', ') : 'ok');
const claim = Number((secao('Dicionário do banco').match(/\*\*(\d+) nós\*\*/) || [])[1]);
checar('a contagem declarada de nós bate com as regras', claim === nosRegras.length,
  'diz ' + claim + ', são ' + nosRegras.length);

/* ---------- 3. Módulos ---------- */
console.log('\n== Módulos e ordem de carga ==');
const modulos = linhasDaTabela(secao('Módulos e ordem de carga'));
const citados = Object.keys(modulos).filter((n) => n.startsWith('forca-agil/'));
const reais = fs.readdirSync(path.join(RAIZ, 'forca-agil'))
  .filter((f) => f.endsWith('.js') || f.endsWith('.css')).map((f) => 'forca-agil/' + f);
const naoDocumentados = reais.filter((f) => !citados.includes(f));
checar('todo .js/.css de forca-agil/ está na tabela de módulos', naoDocumentados.length === 0,
  naoDocumentados.length ? 'faltam: ' + naoDocumentados.join(', ') : reais.length + ' documentados');
const inexistentes = citados.filter((f) => !reais.includes(f));
checar('a tabela de módulos não cita arquivo inexistente', inexistentes.length === 0,
  inexistentes.length ? 'fantasmas: ' + inexistentes.join(', ') : 'nenhum');
const carregadosIndex = [...indexHtml.matchAll(/<(?:script[^>]*src|link[^>]*href)="(forca-agil\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]);
const cargaErrada = citados.filter((f) => {
  const diz = /\|\s*index\.html\s*\|/.test('|' + modulos[f]);
  return diz !== carregadosIndex.includes(f);
});
checar('a coluna Carga bate com o index.html (index.html × sob demanda)', cargaErrada.length === 0,
  cargaErrada.length ? 'divergem: ' + cargaErrada.join(', ') : carregadosIndex.length + ' carregados pelo index.html');

/* ---------- 4. Funcionalidades removidas ---------- */
/* Texto que promete um botão à pessoa e o botão não existe é pior que
   documentação errada: é o sistema mentindo na tela. Ao REMOVER uma
   funcionalidade, acrescente aqui um texto que só ela usava; o CI garante que
   nenhum resquício sobrou em código vivo ou marcação. O Manual fica de fora:
   ele pode contar que algo existiu e por que saiu. */
console.log('\n== Funcionalidades removidas ==');
const REMOVIDAS = [
  { nome: 'Desfazer última migração', removidaEm: 'PR #108' },
  { nome: 'adminPanelMapa', removidaEm: 'Etapa 6.2 (aba ADMIN › Mapa)' },
  { nome: 'adminPanelTestes', removidaEm: 'Etapa 6.2 (aba ADMIN › Testes)' },
  { nome: 'faInitMapa', removidaEm: 'Etapa 6.2' },
  { nome: 'faInitTestes', removidaEm: 'Etapa 6.2' },
  { nome: 'Exportar Excel (mapa completo)', removidaEm: 'Etapa 6.2' },
  { nome: 'Exportar Testes', removidaEm: 'Etapa 6.2' },
  { nome: 'Exportar Regras', removidaEm: 'Etapa 6.2' },
];
const codigoVivo = reais.filter((f) => f.endsWith('.js') && f !== 'forca-agil/manual.js')
  .map((f) => ler(f)).join('\n') + indexHtml;
REMOVIDAS.forEach((r) => {
  const sobrou = codigoVivo.includes(r.nome);
  checar('nenhum resquício de "' + r.nome + '" (' + r.removidaEm + ')', !sobrou,
    sobrou ? 'ainda citado em código vivo ou marcação' : 'limpo');
});

relatar();

function relatar() {
  console.log('\n' + oks.length + ' verificações ok, ' + falhas.length + ' falha(s).');
  if (falhas.length) {
    console.error('\nInconsistências entre a referência técnica e a implementação:');
    falhas.forEach((f) => console.error('  - ' + f));
    process.exit(1);
  }
  process.exit(0);
}
