/* Regras do banco da LISTA DE ESPERA (fa-espera) — montadas aqui, nunca editadas à mão em database.rules.json.
 *
 * Antes (até 01/11/2026), qualquer pessoa logada @previ gravava em QUALQUER chave de fa-espera: dava para criar, alterar
 * ou apagar a entrada de outra pessoa, ou criar uma com o e-mail de outra. Agora:
 *   - a pessoa grava só embaixo da PRÓPRIA chave (a mesma PROPRIA_CHAVE de fa-users e de turmas-interesse), entrada por
 *     entrada (fa-espera/<chave>/<origem>), e nunca apaga uma entrada — sair da fila é marcar removed (é o que o site
 *     faz: app.js joinEspera / removeEspera);
 *   - numa entrada, a pessoa só grava os campos que o site grava por ela (name, email, area, date, removed, eventoKey,
 *     removedDate, removedBySelf), e o e-mail precisa ser o do próprio login; campo de decisão do admin (motivo,
 *     migração, quem tirou…) só o admin grava;
 *   - o admin (lista fixa e fa-admins) continua gravando tudo, em qualquer nível: migrar, mover entre eventos, mover
 *     para a espera, tirar da fila, excluir cadastro.
 * A leitura não muda. As regras FUNCIONAIS da fila (quem pode entrar em qual evento) continuam conferidas na tela.
 * Formatos conferidos nos registros reais (leitura agregada de 01/11/2026): 63 pessoas, 65 entradas, todas por origem
 * (lista:<evento> e <turma>), todas na chave derivada do próprio e-mail.
 *
 *   node .github/scripts/montar-regras-fila-espera.js --gravar   (reescreve o nó fa-espera)
 *   node .github/scripts/montar-regras-fila-espera.js            (só confere; sai com erro se divergir)
 * Depois de --gravar: node .github/scripts/regras-compactas.js --gravar database.rules.min.json */
'use strict';
const fs = require('fs');
const path = require('path');
const ARQUIVO = path.join(__dirname, '..', '..', 'database.rules.json');
const { ADM, PROPRIA_CHAVE } = require('./montar-regras-fa-users.js');

const or = (xs) => '(' + xs.join(' || ') + ')';
const LER = "auth != null && auth.token.email.matches(/.*@previ\\.com\\.br/)";
const SO_ADMIN = 'auth != null && ' + ADM;
/* a pessoa: na própria chave, e a entrada continua existindo depois (nunca apaga) */
const PESSOA = 'auth != null && ' + PROPRIA_CHAVE + ' && newData.exists()';
const campo = (validacao) => ({ '.validate': or([ADM, validacao]) });
const TEXTO = (n) => 'newData.isString() && newData.val().length <= ' + n;

const BLOCO = {
  '.read': LER,
  $userKey: {
    /* a pessoa inteira (migração de formato, excluir cadastro): só o admin */
    '.write': SO_ADMIN,
    $origem: {
      '.write': or([SO_ADMIN, PESSOA]),
      name: campo(TEXTO(200)),
      email: campo("newData.isString() && newData.val().toLowerCase() === auth.token.email.toLowerCase()"),
      area: campo(TEXTO(200)),
      date: campo(TEXTO(40)),
      removed: campo('newData.isBoolean()'),
      eventoKey: campo(TEXTO(200)),
      removedDate: campo(TEXTO(40)),
      removedBySelf: campo('newData.val() === true'),
      /* qualquer outro campo (motivo, migração, quem tirou, ou um inventado): só o admin */
      $outro: { '.validate': ADM }
    }
  }
};
const BLOCOS = { 'fa-espera': BLOCO };

if (require.main === module) {
  let s = fs.readFileSync(ARQUIVO, 'utf8');
  const regras = JSON.parse(s).rules;
  const divergentes = Object.keys(BLOCOS).filter((n) => JSON.stringify(regras[n]) !== JSON.stringify(BLOCOS[n]));
  if (process.argv.indexOf('--gravar') === -1) {
    console.log(divergentes.length ? 'DIVERGE de database.rules.json: ' + divergentes.join(', ') : 'o nó fa-espera publicado é o montado');
    process.exit(divergentes.length ? 1 : 0);
  }
  const ind = (o) => JSON.stringify(o, null, 2).split('\n').map((l, k) => (k === 0 ? l : '    ' + l)).join('\n');
  Object.keys(BLOCOS).forEach((n) => {
    const ini = s.indexOf('\n    "' + n + '": {');
    if (ini === -1) throw new Error('nó ' + n + ' não encontrado em database.rules.json');
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
module.exports = { BLOCOS };
