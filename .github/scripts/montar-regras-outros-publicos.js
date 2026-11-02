/* Regras do banco de ADMIN › Outros públicos (fa-outros-publicos) — montadas aqui, nunca editadas à mão em
 * database.rules.json.
 *
 * Um registro por pessoa, na chave do próprio e-mail: fa-outros-publicos/<chave> = { email, name, categorias,
 * addedAt, addedBy, updatedAt, updatedBy }, com categorias = { estagiario, menorAprendiz, coaud, conselhoDeliberativo,
 * conselhoFiscal, conselhoConsultivo, assessor } (só as verdadeiras; uma pessoa pode ter várias). Os públicos agrupados
 * (Estagiários e menores aprendizes, Conselheiros) NÃO têm registro: serão calculados das categorias.
 *   - incluir, editar e remover: só os dois super-admins (decisão de 01/11/2026);
 *   - a lista inteira: só os super-admins leem (há menores de idade nela — nada desta etapa precisa de mais);
 *   - um registro: o admin (lista fixa e fa-admins) e a própria pessoa leem — é o que a ativação dos públicos vai
 *     precisar (as portas do painel e a página Turmas perguntam por UMA pessoa);
 *   - o registro precisa estar na chave do próprio e-mail (@previ.com.br), ter ao menos uma categoria conhecida (só
 *     true) e nenhum campo inventado.
 * Nesta etapa NADA lê este nó para decidir participação: a classificação das Turmas não muda.
 *
 *   node .github/scripts/montar-regras-outros-publicos.js --gravar   (reescreve o nó)
 *   node .github/scripts/montar-regras-outros-publicos.js            (só confere; sai com erro se divergir)
 * Depois de --gravar: node .github/scripts/regras-compactas.js --gravar database.rules.min.json */
'use strict';
const fs = require('fs');
const path = require('path');
const ARQUIVO = path.join(__dirname, '..', '..', 'database.rules.json');
const { ADM, PROPRIA_CHAVE, DERIVADA } = require('./montar-regras-fa-users.js');

const and = (xs) => xs.join(' && ');
const or = (xs) => '(' + xs.join(' || ') + ')';
const SUPER = "(auth.token.email === 'tatianefdirene@previ.com.br' || auth.token.email === 'danielfrazao@previ.com.br')";
/* as sete categorias: a tabela do núcleo dos públicos (a mesma que o site e as regras de participação usam) */
const { CATEGORIAS } = require('../../forca-agil/publicos-nucleo.js');

/* a chave do registro = a chave do e-mail gravado nele (a mesma derivação da emailKey do site, provada em
   teste-regras-fa-users-chave.js para o e-mail do login — aqui aplicada ao e-mail do registro) */
const EMAIL_NOVO = "newData.child('email').val().toLowerCase()";
const DERIVADA_DO_REGISTRO = DERIVADA.split('auth.token.email.toLowerCase()').join(EMAIL_NOVO);
const CHAVE_DO_EMAIL = '(' + EMAIL_NOVO + ".matches(/^[ -~]+@previ\\.com\\.br$/) && $userKey.length <= 64 && " +
  DERIVADA_DO_REGISTRO + '.beginsWith($userKey) && ($userKey.length === 64 || $userKey === ' + DERIVADA_DO_REGISTRO + '))';
const TEXTO = (n) => 'newData.isString() && newData.val().length >= 1 && newData.val().length <= ' + n;

const BLOCO = {
  '.read': 'auth != null && ' + SUPER,
  $userKey: {
    '.read': 'auth != null && ' + or([ADM, PROPRIA_CHAVE]),
    '.write': 'auth != null && ' + SUPER,
    '.validate': and(["newData.hasChildren(['email', 'categorias', 'addedAt', 'addedBy'])",
      "newData.child('email').isString()", CHAVE_DO_EMAIL]),
    email: { '.validate': "newData.isString() && newData.val().matches(/^[^@]+@previ\\.com\\.br$/)" },
    name: { '.validate': 'newData.isString() && newData.val().length <= 200' },
    categorias: {
      /* ao menos uma categoria: sem nenhuma, o que se faz é remover a pessoa */
      '.validate': 'newData.hasChildren()',
      $categoria: { '.validate': or(CATEGORIAS.map((c) => "$categoria === '" + c + "'")) + ' && newData.val() === true' }
    },
    addedAt: { '.validate': TEXTO(40) },
    addedBy: { '.validate': TEXTO(200) },
    updatedAt: { '.validate': TEXTO(40) },
    updatedBy: { '.validate': TEXTO(200) },
    $outro: { '.validate': false }
  }
};
/* ATIVAÇÃO DOS PÚBLICOS (Entrega B): publicos-config/ativo = true liga Diretores, as sete categorias e os dois agrupados
   como públicos que restringem, e a classificação nova de Técnicos (fora de Gerentes, Diretores e das sete categorias).
   Ausente ou false = tudo como antes. Só os super-admins ligam/desligam (ADMIN › Outros públicos), com quem e quando;
   qualquer conta @previ lê (o site precisa saber para decidir quem vê e quem entra). */
const CONFIG = {
  '.read': "auth != null && auth.token.email.matches(/.*@previ\\.com\\.br/)",
  '.write': 'auth != null && ' + SUPER,
  '.validate': "newData.hasChildren(['ativo', 'em', 'por'])",
  ativo: { '.validate': 'newData.isBoolean()' },
  em: { '.validate': TEXTO(40) },
  por: { '.validate': 'newData.isString() && newData.val().toLowerCase() === auth.token.email.toLowerCase()' },
  porNome: { '.validate': TEXTO(200) },
  $outro: { '.validate': false }
};
const BLOCOS = { 'fa-outros-publicos': BLOCO, 'publicos-config': CONFIG };

if (require.main === module) {
  let s = fs.readFileSync(ARQUIVO, 'utf8');
  /* primeira vez: o nó nasce vazio logo depois de fa-gerentes, para ser preenchido abaixo */
  if (s.indexOf('\n    "fa-outros-publicos": {') === -1) {
    const marca = '\n    "fa-facilitadores": {';
    if (s.indexOf(marca) === -1) throw new Error('fa-facilitadores não encontrado em database.rules.json');
    s = s.replace(marca, '\n    "fa-outros-publicos": {},\n' + marca);
  }
  if (s.indexOf('\n    "publicos-config": {') === -1) {
    const marca = '\n    "fa-facilitadores": {';
    s = s.replace(marca, '\n    "publicos-config": {},\n' + marca);
  }
  const regras = JSON.parse(s).rules;
  const divergentes = Object.keys(BLOCOS).filter((n) => JSON.stringify(regras[n]) !== JSON.stringify(BLOCOS[n]));
  if (process.argv.indexOf('--gravar') === -1) {
    console.log(divergentes.length ? 'DIVERGE de database.rules.json: ' + divergentes.join(', ') : 'os nós fa-outros-publicos e publicos-config publicados são os montados');
    process.exit(divergentes.length ? 1 : 0);
  }
  const ind = (o) => JSON.stringify(o, null, 2).split('\n').map((l, k) => (k === 0 ? l : '    ' + l)).join('\n');
  Object.keys(BLOCOS).forEach((n) => {
    const ini = s.indexOf('\n    "' + n + '": {');
    const abre = s.indexOf('{', ini);
    let prof = 0, i = abre, emTexto = false;
    for (; i < s.length; i++) {
      const ch = s[i];
      if (emTexto) { if (ch === '\\') i++; else if (ch === '"') emTexto = false; continue; }
      if (ch === '"') emTexto = true; else if (ch === '{') prof++; else if (ch === '}' && --prof === 0) break;
    }
    s = s.slice(0, abre) + ind(BLOCOS[n]) + s.slice(i + 1);
  });
  JSON.parse(s);
  fs.writeFileSync(ARQUIVO, s);
  console.log('gravado: ' + s.length + ' bytes');
}
module.exports = { BLOCOS, CATEGORIAS };
