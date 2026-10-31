/* Monta as regras de fa-users em database.rules.json (segurança de fa-users, PR 1-B; ver docs/seguranca-fa-users.md).
 *
 * Quem grava (provado no emulador por teste-rules-fa-users.js e teste-rules-fa-users-compat.js):
 *   - o ADMIN GERAL (lista fixa + fa-admins): qualquer cadastro, inclusive apagar (correção de e-mail);
 *   - a PRÓPRIA PESSOA, só na chave do próprio e-mail:
 *       criar  — chave vazia, só os campos do cadastro público, email = o do login, emailVerificationRequired: true;
 *       alterar — o cadastro precisa ser dela (email gravado = o do login) e nada muda além da anotação
 *                 emailConfirmado/emailConfirmadoEm (que tem regra própria, mantida);
 *       apagar — nunca (o .validate não roda em exclusão, por isso a barreira fica no .write: newData.exists()).
 *   Qualquer outra pessoa ou perfil (avaliação, facilitadora, gerente): nada.
 *
 * A CHAVE DA PRÓPRIA PESSOA reproduz emailKey() do site (auth.js/admin.js):
 *     e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64)
 * As regras não têm "remover o que não for [a-z0-9_]" nem slice: a remoção lista os 30 caracteres imprimíveis ASCII
 * que sobram (REMOVIDOS) e o corte em 64 é conferido com beginsWith (chave de 64 = começo da derivada). A equivalência
 * é EXATA para todo e-mail de caracteres imprimíveis ASCII (prova exaustiva em teste-regras-fa-users-chave.js).
 * E-mail com caractere fora disso (acento, outro alfabeto): a própria pessoa não grava; o admin cadastra pelo painel
 * (decisão da dona, 31/10/2026). A chave sozinha nunca dá posse: criar exige a chave vazia, alterar exige o e-mail
 * gravado igual ao do login — uma colisão de chaves nunca deixa gravar no cadastro de outra pessoa.
 *
 * Campos conhecidos (leitura agregada de 31/10/2026 + o que o código grava). Campo novo que a própria pessoa não pode
 * mudar → acrescentar em CAMPOS_FIXOS; o resto cai em $outro (só admin acrescenta ou muda).
 *
 *   node .github/scripts/montar-regras-fa-users.js --gravar   (reescreve o nó fa-users)
 *   node .github/scripts/montar-regras-fa-users.js            (só confere; sai com erro se divergir)
 * Depois de --gravar: node .github/scripts/regras-compactas.js --gravar database.rules.min.json */
'use strict';
const fs = require('fs');
const path = require('path');
const ARQUIVO = path.join(__dirname, '..', '..', 'database.rules.json');

const PREVI = "auth.token.email.matches(/.*@previ\\.com\\.br/)";
const ADM = "(auth.token.email === 'tatianefdirene@previ.com.br' || auth.token.email === 'danielfrazao@previ.com.br' || " +
  "root.child('fa-admins').child(auth.token.email.replace('@','_').replace('.','_')).exists())";
const E = 'auth.token.email.toLowerCase()';
/* os 30 caracteres imprimíveis ASCII (0x20–0x7E) que não são letra, dígito, '_', '@' nem '.' */
const REMOVIDOS = [' ', '!', '"', '#', '$', '%', '&', "'", '(', ')', '*', '+', ',', '-', '/', ':', ';', '<', '=', '>', '?',
  '[', '\\', ']', '^', '`', '{', '|', '}', '~'];
const lit = (c) => "'" + c.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
const DERIVADA = E + ".replace('@', '_').replace('.', '_')" + REMOVIDOS.map((c) => '.replace(' + lit(c) + ", '')").join('');
/* e-mail só de imprimíveis ASCII, @previ.com.br; chave = derivada, ou os 64 primeiros caracteres dela */
const PROPRIA_CHAVE = '(' + E + ".matches(/^[ -~]+@previ\\.com\\.br$/) && $userKey.length <= 64 && " + DERIVADA +
  '.beginsWith($userKey) && ($userKey.length === 64 || $userKey === ' + DERIVADA + '))';

const PUBLICOS = ['email', 'name', 'area', 'optinTurmas', 'emailVerificationRequired', 'createdAt'];
/* tudo o que a própria pessoa não muda depois de criado (os públicos + os administrativos) */
const CAMPOS_FIXOS = PUBLICOS.concat(['adminApproved', 'approvedAt', 'approvedByAdmin', 'approvedByAdminName', 'blocked',
  'cadastroCompletadoEm', 'cadastroCompletadoPorAdmin', 'createdByAdmin', 'emailCorrigidoDe']);
const ADMINISTRATIVOS = CAMPOS_FIXOS.filter((c) => PUBLICOS.indexOf(c) === -1);

const and = (xs) => xs.join(' && ');
const texto = (c, n) => "newData.child('" + c + "').isString() && newData.child('" + c + "').val().length >= 1 && newData.child('" + c + "').val().length <= " + n;
const CRIA = '(!data.exists() && ' + and([
  "newData.hasChildren(['email', 'name', 'area', 'emailVerificationRequired', 'createdAt'])",
  texto('email', 200) + " && newData.child('email').val().toLowerCase() === " + E,
  "newData.child('emailVerificationRequired').val() === true",
  texto('name', 300), texto('area', 200), texto('createdAt', 40),
  "(!newData.child('optinTurmas').exists() || newData.child('optinTurmas').isBoolean())"
].concat(ADMINISTRATIVOS.map((c) => "!newData.child('" + c + "').exists()"))) + ')';
const ALTERA = '(data.exists() && ' + and([
  "data.child('email').isString() && data.child('email').val().toLowerCase() === " + E
].concat(CAMPOS_FIXOS.map((c) => "newData.child('" + c + "').val() === data.child('" + c + "').val()"))) + ')';

/* proteção existente da anotação (vale para todos, inclusive o admin) — mantida sem mudança */
const ANOTACAO_PERMANENTE = "(!data.child('emailConfirmado').exists() || newData.child('emailConfirmado').val() === data.child('emailConfirmado').val()) && " +
  "(!data.child('emailConfirmadoEm').exists() || newData.child('emailConfirmadoEm').val() === data.child('emailConfirmadoEm').val())";

const PREVI_TEXTO = 'auth != null && ' + PREVI;
const bloco = {
  '.read': PREVI_TEXTO,
  $userKey: {
    '.read': PREVI_TEXTO,
    /* a própria chave vem ANTES do admin: com ela verdadeira, a expressão do admin nem é avaliada */
    '.write': 'auth != null && ' + PREVI + ' && ((newData.exists() && ' + PROPRIA_CHAVE + ') || ' + ADM + ')',
    '.validate': ANOTACAO_PERMANENTE + ' && ((' + PROPRIA_CHAVE + ' && (' + CRIA + ' || ' + ALTERA + ')) || ' + ADM + ')',
    email: { '.validate': 'newData.isString()' },
    name: { '.validate': 'newData.isString()' },
    area: { '.validate': 'newData.isString()' },
    createdAt: { '.validate': 'newData.isString()' },
    optinTurmas: { '.validate': 'newData.isBoolean()' },
    emailVerificationRequired: { '.validate': 'newData.isBoolean()' },
    emailConfirmado: {
      '.validate': "newData.val() === true && (data.val() === true || (auth.token.email_verified === true && data.parent().child('email').isString() && data.parent().child('email').val().toLowerCase() === auth.token.email.toLowerCase() && newData.parent().child('email').val() === data.parent().child('email').val()))"
    },
    emailConfirmadoEm: {
      '.validate': "newData.isNumber() && (newData.val() === data.val() || (!data.exists() && newData.val() === now && !data.parent().child('emailConfirmado').exists() && newData.parent().child('emailConfirmado').val() === true))"
    },
    /* campos administrativos e qualquer outro: só o admin acrescenta ou muda */
    $outro: { '.validate': 'newData.val() === data.val() || ' + ADM }
  }
};
const BLOCOS = { 'fa-users': bloco };

if (require.main === module) {
  let s = fs.readFileSync(ARQUIVO, 'utf8');
  const regras = JSON.parse(s).rules;
  const divergentes = Object.keys(BLOCOS).filter((n) => JSON.stringify(regras[n]) !== JSON.stringify(BLOCOS[n]));
  if (process.argv.indexOf('--gravar') === -1) {
    console.log(divergentes.length ? 'DIVERGE de database.rules.json: ' + divergentes.join(', ') : 'o nó fa-users publicado é o montado');
    process.exit(divergentes.length ? 1 : 0);
  }
  const ind = (o) => JSON.stringify(o, null, 2).split('\n').map((l, k) => (k === 0 ? l : '    ' + l)).join('\n');
  Object.keys(BLOCOS).forEach((n) => {
    const ini = s.indexOf('\n    "' + n + '": {');
    if (ini === -1) throw new Error('nó ' + n + ' não encontrado');
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
module.exports = { BLOCOS, REMOVIDOS, DERIVADA, PROPRIA_CHAVE };
