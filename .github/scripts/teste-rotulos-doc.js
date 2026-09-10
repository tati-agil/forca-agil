/* Rótulos citados na documentação existem na interface?
 *
 * POR QUE ESTE TESTE EXISTE
 * O Manual, o Mapa e a página Testes citam rótulos de botão e de selo entre
 * aspas — "Abrir check-in", "🗑 Excluir turma", "CHECK-IN ABERTO". Quando
 * alguém renomeia um botão no código, essas aspas ficam mentindo, e a pessoa
 * que segue o Manual procura na tela um botão que não existe mais com aquele
 * nome. É a mesma classe de rot da tela preta: nada quebra, nada avisa.
 *
 * A auditoria manual de 10/09/2026 pegou dois assim — o Manual dizia
 * "Check-in aberto: DD/MM" (é "CHECK-IN ABERTO · DD/MM") e "⌘ QR Code" (é
 * "⌘ QR"). Foram achados lendo prosa, uma regra por vez. São mais de 700
 * rótulos citados: ler tudo à mão não escala, e este teste cobre todos de
 * uma vez, em toda PR.
 *
 * COMO EVITA FALSO POSITIVO
 * A documentação também cita moldes ("X de Y encontros", "por <nome>") e
 * trechos de código/CSS. Nada disso é rótulo de interface, então é descartado
 * antes da comparação. No lado do código, entidades HTML viram o caractere
 * que representam (&#x2318; → ⌘), porque o Manual escreve o símbolo e o
 * código escreve a entidade — a mesma coisa, grafada de dois jeitos.
 *
 * ESTADO: FERRAMENTA DE AUDITORIA, AINDA NÃO PORTÃO DE CI
 * A lista de sobra ainda tem ~85 candidatos NÃO TRIADOS — prosa que o filtro
 * não descartou, caminhos SVG, moldes de texto. Para virar portão bastaria
 * despejar esses 85 em IGNORAR, e é exatamente o que NÃO se deve fazer:
 * silenciar sem verificar transforma o teste numa mentira que passa. Enquanto
 * a triagem não termina, ele roda sob demanda e SEMPRE sai com código 0.
 *
 * O caminho para virar portão: durante a auditoria da documentação, triar
 * cada linha da sobra em uma das três categorias abaixo até a lista zerar.
 * Aí trocar o final por process.exit(1) e acrescentar o passo ao workflow.
 *
 * O que ele já rendeu, rodado uma vez, em rótulos que a leitura de prosa não
 * teria alcançado sem ler tudo: "Adicionar ao Holocron" (é "Guardar no
 * Holocron"), "Demorando para conectar" (é "Não conseguimos retomar sua
 * sessão"), "Sair da lista de espera" (é "✓ Na lista — Sair"), o botão
 * "Ir para o CMFlex" (removido de propósito, e o Manual ainda o prometia) e
 * um teste manual inteiro descrevendo uma tela que não existe mais.
 */

const fs = require('fs');
const path = require('path');

const RAIZ  = path.join(__dirname, '..', '..');
const DOCS  = ['manual.js', 'mapa.js', 'testes.js'];

/* Entidades que o código usa nos rótulos, e o símbolo que o Manual escreve. */
const NORMALIZACOES = [
  ['&#x2318;', '⌘'], ['&#x2193;', '↓'], ['&#x2191;', '↑'], ['&#x21A9;', '↩'],
  ['&#x2195;', '↕'], ['&#x2713;', '✓'], ['&#x270E;', '✎'], ['&#xFF0B;', '＋'],
  ['&#x1F5D1;', '🗑'], ['&#x1F5A8;', '🖨'], ['&mdash;', '—'], ['&middot;', '·'],
  ['&nbsp;', ' '], ['&amp;', '&'], ['&quot;', '"'], ['&#39;', "'"],
];

/* Rótulos citados que legitimamente não existem como literal no código. */
const IGNORAR = new Set([
  /* o botão foi removido no PR #108; a documentação cita como história */
  '↩ Desfazer última migração',
]);

function normaliza(txt) {
  let s = txt;
  for (const [ent, ch] of NORMALIZACOES) s = s.split(ent).join(ch);
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

/* Um rótulo de interface é curto, tem letra, e não carrega sintaxe de código
   nem molde de texto. Tudo o mais é prosa ou fragmento — não é comparável. */
function pareceRotulo(txt) {
  const t = txt.trim();
  if (t.length < 3 || t.length > 40) return false;
  if (!/[A-Za-zÀ-ÿ]/.test(t)) return false;
  if (/[{};<>|]|--|\|\||' \+|\+ '|=>|\/\*|:#|,#/.test(t)) return false;  /* código/CSS/SVG */
  if (/\b[NXYZ]\b|\bDD\b|\bMM\b|\bAAAA\b|\.\.\./.test(t)) return false;  /* molde */
  if (/^[a-z][a-z0-9-]*( [a-z][a-z0-9-]*)*$/.test(t)) return false;      /* classe CSS / nome de campo */
  if (/^\d/.test(t)) return false;                                        /* "2 confirmados", medidas */
  if (/^#/.test(t)) return false;                                         /* cor hex, âncora */
  /* Aspas que a prosa abre e fecha em pontos diferentes da frase produzem
     fragmentos com pontuação nas beiradas — não são rótulos. */
  if (/^[(),.;:\-–—]|[(),;:\-–—]$/.test(t)) return false;
  /* "Abrir/Fechar check-in" é atalho do texto para dois botões distintos;
     rótulo de verdade não tem barra entre palavras. */
  if (/[A-Za-zÀ-ÿ]\/[A-Za-zÀ-ÿ]/.test(t)) return false;
  return true;
}

const docs = DOCS.map(f => fs.readFileSync(path.join(RAIZ, 'forca-agil', f), 'utf8')).join('\n');

let codigo = '';
for (const f of fs.readdirSync(path.join(RAIZ, 'forca-agil'))) {
  if ((f.endsWith('.js') || f.endsWith('.css')) && !DOCS.includes(f)) {
    codigo += fs.readFileSync(path.join(RAIZ, 'forca-agil', f), 'utf8') + '\n';
  }
}
codigo += fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');

/* As páginas Manual, Mapa e Testes também TÊM interface, e os rótulos dela
   moram nesses mesmos arquivos — só que misturados com a prosa que estamos
   auditando. Puxar o arquivo inteiro faria a prosa validar a si mesma e
   apagaria a cobertura; então entram só as linhas que constroem DOM. */
for (const f of DOCS) {
  const txt = fs.readFileSync(path.join(RAIZ, 'forca-agil', f), 'utf8');
  for (const linha of txt.split('\n')) {
    if (/innerHTML|textContent|createElement|className|<button|<th>|<span|<option|appendChild/.test(linha)) {
      codigo += linha + '\n';
    }
  }
}
const codigoNorm = normaliza(codigo);

const candidatos = new Set();
for (const m of docs.matchAll(/"([^"\\\n]{3,42})"/g)) {
  const t = m[1].trim();
  if (pareceRotulo(t) && !IGNORAR.has(t)) candidatos.add(t);
}

const faltando = [...candidatos].filter(c => !codigoNorm.includes(normaliza(c))).sort();

console.log('\n== Rótulos citados na documentação ==');
console.log('  %d rótulos comparados com o código', candidatos.size);

if (faltando.length) {
  console.log('\n  %d NÃO encontrados na interface:\n', faltando.length);
  faltando.forEach(f => console.log('    · "%s"', f));
  console.log(
    '\n  Cada um é uma destas três coisas — triar, não silenciar:\n' +
    '   1. o rótulo mudou no código e a documentação ficou para trás → corrija a documentação;\n' +
    '   2. o rótulo nunca existiu com esse nome → corrija a documentação;\n' +
    '   3. não é rótulo (prosa, molde, SVG) ou é grafia que o teste não normaliza\n' +
    '      → melhore pareceRotulo()/NORMALIZACOES, ou IGNORAR com o motivo escrito.\n' +
    '\n  Sai com código 0 de propósito: a sobra ainda NÃO foi triada, e reprovar\n' +
    '  agora obrigaria a despejar tudo em IGNORAR sem verificar — teste que passa\n' +
    '  por estar cego. Vira portão quando esta lista chegar a zero.\n'
  );
  process.exit(0);
}
console.log('  ok    todos existem na interface — pode virar portão de CI\n');
