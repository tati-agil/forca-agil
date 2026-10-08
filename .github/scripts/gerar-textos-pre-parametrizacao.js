/* Gera .github/scripts/dados/textos-pre-parametrizacao.json — a EVIDÊNCIA de
 * quais textos de pergunta P1–P16 as avaliações legadas (concluídas antes de
 * existir questionnaireContentVersion/snapshot) mostraram.
 *
 * Percorre, no histórico do git, TODAS as versões de forca-agil/avaliacao-produto.js
 * desde a criação da Avaliação de Produto/Serviço (ea1a051) até o commit
 * imediatamente anterior à parametrização (c3a9de3^ — "Parametriza as 16
 * perguntas P1-P16"), extrai de cada uma o título e o texto de cada pergunta
 * (CRITERIOS/EXCLUSOES, campos titulo e pergunta) e grava tudo, por commit.
 * O teste teste-versionamento-historico.js compara esse arquivo com a versão 1
 * do questionário (texto de fábrica em questionarios-config.js): só a pergunta
 * igual em TODOS os commits pode ter o texto legado reconstruído.
 *
 * Precisa do histórico completo (git fetch --unshallow). Uso:
 *   node .github/scripts/gerar-textos-pre-parametrizacao.js */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..', '..');
const git = (c) => execSync('git ' + c, { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const PRIMEIRO = 'ea1a051';
const PARAMETRIZACAO = 'c3a9de3';
const commits = git('log --format=%H --reverse ' + PRIMEIRO + '^..' + PARAMETRIZACAO + '^ -- forca-agil/avaliacao-produto.js').trim().split('\n');

function extrairArray(src, nome) {
  const ini = src.indexOf('var ' + nome + ' = [');
  if (ini < 0) return null;
  let i = src.indexOf('[', ini), nivel = 0, dentroStr = null;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (dentroStr) { if (ch === '\\') { i++; continue; } if (ch === dentroStr) dentroStr = null; continue; }
    if (ch === "'" || ch === '"') { dentroStr = ch; continue; }
    if (ch === '[') nivel++; else if (ch === ']' && --nivel === 0) break;
  }
  return vm.runInNewContext('(' + src.slice(src.indexOf('[', ini), i + 1) + ')');
}

const porCommit = commits.map((h) => {
  const src = git('show ' + h + ':forca-agil/avaliacao-produto.js');
  const data = git('log -1 --format=%cI ' + h).trim();
  const lista = (extrairArray(src, 'CRITERIOS') || []).concat(extrairArray(src, 'EXCLUSOES') || []);
  const perguntas = {};
  lista.forEach((q) => { perguntas[q.id] = { titulo: q.titulo || null, texto: q.pergunta || q.texto || null }; });
  return { commit: h.slice(0, 7), data, perguntas };
});
const saida = {
  geradoPor: '.github/scripts/gerar-textos-pre-parametrizacao.js',
  intervalo: PRIMEIRO + '..' + PARAMETRIZACAO + '^ (avaliacao-produto.js)',
  parametrizacao: { commit: PARAMETRIZACAO, data: git('log -1 --format=%cI ' + PARAMETRIZACAO).trim() },
  commits: porCommit
};
fs.mkdirSync(path.join(__dirname, 'dados'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dados', 'textos-pre-parametrizacao.json'), JSON.stringify(saida, null, 1) + '\n');
console.log(porCommit.length + ' versões; perguntas por versão: ' + Array.from(new Set(porCommit.map((c) => Object.keys(c.perguntas).length))).join(', '));
