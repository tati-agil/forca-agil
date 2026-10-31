/* Monta as regras de CONTA DE TESTE em database.rules.json: fa-contas-teste e fa-contas-teste-auditoria.
 *
 * É só IDENTIFICAÇÃO administrativa (ADMIN › Cadastrados): nenhum outro nó, regra ou código de acesso lê estes nós —
 * marcar ou desmarcar não muda login, senha, acesso, permissões, situação, inscrições, avaliações nem históricos.
 *
 * O que as regras garantem (provado no emulador por teste-rules-contas-teste.js):
 *   - lê e grava SÓ o admin geral (lista fixa + fa-admins — a mesma expressão de fa-users);
 *   - fa-contas-teste/<chave> = { marcada, email, por, em, auditoria[, movidoPara] }: estado atual; nunca se apaga
 *     (desmarcar = marcada: false); marcada: true só com o e-mail igual ao do cadastro fa-users/<chave>; autoria do
 *     token; horário do servidor;
 *   - toda mudança traz, NA MESMA GRAVAÇÃO, um evento NOVO em fa-contas-teste-auditoria/<id> (só acréscimo: não se
 *     muda nem se apaga), coerente com ela: "marcar" (não marcada → marcada), "desmarcar" (marcada → não marcada) ou
 *     "mover" (correção de e-mail: a chave nova nasce marcada e a antiga fica não marcada, com movidoPara);
 *   - evento sem a mudança correspondente, ou mudança sem evento, é recusado.
 *
 *   node .github/scripts/montar-regras-contas-teste.js --gravar   (reescreve/acrescenta os 2 nós)
 *   node .github/scripts/montar-regras-contas-teste.js            (só confere; sai com erro se divergir)
 * Depois de --gravar: node .github/scripts/regras-compactas.js --gravar database.rules.min.json */
'use strict';
const fs = require('fs');
const path = require('path');
const ARQUIVO = path.join(__dirname, '..', '..', 'database.rules.json');
const { ADM } = require('./montar-regras-fa-users.js');

const MARCAS = 'fa-contas-teste', AUD = 'fa-contas-teste-auditoria';
const LER = 'auth != null && ' + ADM;
const CHAVE = '/^[a-z0-9_]{1,64}$/';
const and = (xs) => xs.join(' && ');

/* a partir de fa-contas-teste/$chave: o evento citado em "auditoria", no estado depois da gravação */
const EV = "newData.parent().parent().child('" + AUD + "').child(newData.child('auditoria').val())";
const ev = (c) => EV + ".child('" + c + "').val()";
const MARCADA = "newData.child('marcada').val()";
const ESTAVA = "data.child('marcada').val() === true";
const coerente = '(' + [
  '(' + and([ev('acao') + " === 'marcar'", ev('chave') + ' === $chave', MARCADA + ' === true', '!(' + ESTAVA + ')']) + ')',
  '(' + and([ev('acao') + " === 'desmarcar'", ev('chave') + ' === $chave', MARCADA + ' === false', ESTAVA]) + ')',
  '(' + and([ev('acao') + " === 'mover'", ev('chave') + ' === $chave', MARCADA + ' === true', '!(' + ESTAVA + ')']) + ')',
  '(' + and([ev('acao') + " === 'mover'", ev('chaveAnterior') + ' === $chave', MARCADA + ' === false', ESTAVA,
    "newData.child('movidoPara').val() === " + ev('chave')]) + ')'
].join(' || ') + ')';

const blocoMarcas = {
  '.read': LER,
  $chave: {
    '.write': and(['auth != null', ADM, 'newData.exists()', '$chave.matches(' + CHAVE + ')']),
    '.validate': and([
      "newData.hasChildren(['marcada', 'email', 'por', 'em', 'auditoria'])",
      /* marcada só no cadastro que existe, com o mesmo e-mail (no estado depois da gravação: vale na correção de e-mail) */
      '(' + MARCADA + " === false || newData.parent().parent().child('fa-users').child($chave).child('email').val() === newData.child('email').val())",
      /* o evento é NOVO (não existia antes) e vem nesta mesma gravação */
      "!root.child('" + AUD + "').child(newData.child('auditoria').val()).exists()",
      EV + '.exists()',
      coerente
    ]),
    marcada: { '.validate': 'newData.isBoolean()' },
    email: { '.validate': 'newData.isString() && newData.val().length >= 3 && newData.val().length <= 200' },
    por: { '.validate': 'newData.val() === auth.token.email' },
    em: { '.validate': 'newData.val() === now' },
    auditoria: { '.validate': "newData.isString() && newData.val().matches(/^[A-Za-z0-9_-]{1,40}$/)" },
    movidoPara: { '.validate': 'newData.isString() && newData.val().matches(' + CHAVE + ')' },
    $outro: { '.validate': false }
  }
};

/* a partir de fa-contas-teste-auditoria/$id: a marca que o evento descreve, no estado depois da gravação */
const MARCA = (campoChave) => "newData.parent().parent().child('" + MARCAS + "').child(newData.child('" + campoChave + "').val())";
const blocoAuditoria = {
  '.read': LER,
  $id: {
    /* só acréscimo: um evento nunca é mudado nem apagado */
    '.write': and(['auth != null', ADM, '!data.exists()', 'newData.exists()']),
    '.validate': and([
      "newData.hasChildren(['acao', 'chave', 'email', 'por', 'em'])",
      MARCA('chave') + ".child('auditoria').val() === $id",
      "(newData.child('acao').val() !== 'mover' || (newData.hasChild('chaveAnterior') && " + MARCA('chaveAnterior') + ".child('auditoria').val() === $id))"
    ]),
    acao: { '.validate': "newData.val() === 'marcar' || newData.val() === 'desmarcar' || newData.val() === 'mover'" },
    chave: { '.validate': 'newData.isString() && newData.val().matches(' + CHAVE + ')' },
    chaveAnterior: { '.validate': "newData.isString() && newData.val().matches(" + CHAVE + ") && newData.parent().child('acao').val() === 'mover'" },
    email: { '.validate': 'newData.isString() && newData.val().length >= 3 && newData.val().length <= 200' },
    emailAnterior: { '.validate': "newData.isString() && newData.val().length <= 200 && newData.parent().child('acao').val() === 'mover'" },
    por: { '.validate': 'newData.val() === auth.token.email' },
    em: { '.validate': 'newData.val() === now' },
    $outro: { '.validate': false }
  }
};
const BLOCOS = {}; BLOCOS[MARCAS] = blocoMarcas; BLOCOS[AUD] = blocoAuditoria;

if (require.main === module) {
  let s = fs.readFileSync(ARQUIVO, 'utf8');
  const regras = JSON.parse(s).rules;
  const divergentes = Object.keys(BLOCOS).filter((n) => JSON.stringify(regras[n]) !== JSON.stringify(BLOCOS[n]));
  if (process.argv.indexOf('--gravar') === -1) {
    console.log(divergentes.length ? 'DIVERGEM de database.rules.json: ' + divergentes.join(', ') : 'os 2 nós publicados são os montados');
    process.exit(divergentes.length ? 1 : 0);
  }
  const ind = (o) => JSON.stringify(o, null, 2).split('\n').map((l, k) => (k === 0 ? l : '    ' + l)).join('\n');
  Object.keys(BLOCOS).forEach((n) => {
    const ini = s.indexOf('\n    "' + n + '": {');
    if (ini === -1) {
      const fim = s.lastIndexOf('\n  }');
      s = s.slice(0, fim) + ',\n    "' + n + '": ' + ind(BLOCOS[n]) + s.slice(fim);
      return;
    }
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
module.exports = { BLOCOS, MARCAS, AUD };
