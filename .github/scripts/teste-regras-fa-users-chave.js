/* Segurança de fa-users (PR 1-B) — a chave da PRÓPRIA PESSOA nas regras é EXATAMENTE a emailKey() do site
 * (sem navegador, sem rede, sem emulador; o emulador prova as regras de verdade em teste-rules-fa-users.js).
 *   - o nó fa-users de database.rules.json é o montado por montar-regras-fa-users.js;
 *   - as trocas são lidas DO TEXTO da regra gerada (não da lista do gerador) e aplicadas como as regras fazem:
 *     toLowerCase, replace literal de TODAS as ocorrências, beginsWith, length;
 *   - para todo e-mail de caracteres imprimíveis ASCII testado (cada caractere 0x20–0x7E em cada posição, pares,
 *     aleatórios, e-mails de 1 a 90 caracteres antes do @): a regra aceita a chave da emailKey() e só ela;
 *   - e-mail com caractere fora do ASCII imprimível: a regra não aceita chave nenhuma (o admin cadastra);
 *   - colisão (e-mails diferentes, mesma chave): a chave é aceita para os dois — a posse vem do e-mail gravado, que
 *     o emulador prova. */
'use strict';
const fs = require('fs');
const path = require('path');
const M = require('./montar-regras-fa-users.js');
let total = 0, falhas = 0;
function afirma(c, msg, det) { total++; console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det ? ' → ' + det : '')); if (!c) falhas++; }

const emailKey = (e) => (e || '').toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const regras = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'database.rules.json'), 'utf8')).rules;
afirma(JSON.stringify(regras['fa-users']) === JSON.stringify(M.BLOCOS['fa-users']), 'database.rules.json tem o nó fa-users montado (rode montar-regras-fa-users.js --gravar)');

/* as trocas, lidas do texto gerado: .replace('<a>', '<b>') com \\ e \' como escapes */
const trocas = [];
const re = /\.replace\('((?:\\.|[^'\\])*)', '((?:\\.|[^'\\])*)'\)/g;
const des = (s) => s.replace(/\\(.)/g, '$1');
let m; while ((m = re.exec(M.DERIVADA))) trocas.push([des(m[1]), des(m[2])]);
afirma(M.DERIVADA.indexOf('auth.token.email.toLowerCase()') === 0 && M.DERIVADA.replace(re, '') === 'auth.token.email.toLowerCase()',
  'a derivada é só toLowerCase + trocas literais', M.DERIVADA.replace(re, ''));
afirma(trocas.length === 32 && trocas[0].join() === '@,_' && trocas[1].join() === '.,_' && trocas.slice(2).every((t) => t[0].length === 1 && t[1] === ''),
  'ordem da emailKey: @ e . viram _ primeiro, depois 30 remoções de um caractere');
const ascii = []; for (let c = 0x20; c <= 0x7e; c++) ascii.push(String.fromCharCode(c));
const sobram = ascii.filter((c) => !/[a-zA-Z0-9_@.]/.test(c)).sort().join('');
afirma(trocas.slice(2).map((t) => t[0]).sort().join('') === sobram, 'as 30 remoções são exatamente os imprimíveis ASCII fora de [a-z0-9_@.]');

/* o que as regras fazem, com as trocas lidas do texto */
const derivada = (e) => trocas.reduce((s, t) => s.split(t[0]).join(t[1]), e.toLowerCase());
const gate = (e) => /^[ -~]+@previ\.com\.br$/.test(e.toLowerCase());
const aceita = (e, k) => gate(e) && k.length <= 64 && derivada(e).startsWith(k) && (k.length === 64 || k === derivada(e));
afirma(/matches\(\/\^\[ -~\]\+@previ\\\\\.com\\\\\.br\$\/\)/.test(JSON.stringify(M.PROPRIA_CHAVE)) &&
  M.PROPRIA_CHAVE.indexOf('$userKey.length <= 64 && ' + M.DERIVADA + '.beginsWith($userKey) && ($userKey.length === 64 || $userKey === ' + M.DERIVADA + ')') !== -1,
  'a regra da própria chave é a modelada aqui (ASCII imprimível, até 64, beginsWith, igual ou corte em 64)');

/* candidatos que uma chave errada poderia ter: a emailKey, a derivada inteira, prefixos, a regra antiga */
const candidatos = (e) => { const d = derivada(e), k = emailKey(e);
  return [k, d, d.slice(0, 63), d.slice(0, 65), k.slice(0, k.length - 1), k + '_', e.toLowerCase().split('@').join('_').split('.').join('_'), k.replace(/_/g, '')].filter((x) => x); };
let casos = 0, erros = [];
function confere(e) {
  casos++;
  const k = emailKey(e);
  if (!aceita(e, k)) { erros.push('nega a própria: ' + JSON.stringify(e)); return; }
  candidatos(e).forEach((c) => { if (c !== k && aceita(e, c)) erros.push('aceita outra chave ' + JSON.stringify(c) + ' para ' + JSON.stringify(e)); });
}
const dom = '@previ.com.br';
ascii.forEach((c) => { ['', 'a', 'ana.'].forEach((pre) => { ['', 'b', '.silva'].forEach((pos) => { if ((pre + c + pos).trim() !== '' || c === ' ') confere(pre + c + pos + dom); }); }); });
ascii.forEach((c) => ascii.forEach((d) => confere('x' + c + d + 'y' + dom)));
let semente = 42; const rnd = (n) => { semente = (semente * 1103515245 + 12345) & 0x7fffffff; return semente % n; };
for (let i = 0; i < 20000; i++) { let s = ''; const n = 1 + rnd(90); for (let j = 0; j < n; j++) s += ascii[rnd(ascii.length)]; confere(s + dom); }
for (let n = 1; n <= 90; n++) { confere('a'.repeat(n) + dom); confere('A-'.repeat(n).slice(0, n) + dom); confere(('ab.c+d\'e').repeat(20).slice(0, n) + dom); }
afirma(erros.length === 0, casos + ' e-mails ASCII imprimíveis: a regra aceita a chave da emailKey() e nenhuma outra', erros.slice(0, 3).join(' | '));

/* casos nomeados (os mesmos do emulador) */
const nomeados = { hifen: 'maria-silva@previ.com.br', mais: 'ana+turma@previ.com.br', apostrofo: "joao.d'avila@previ.com.br",
  aspas: 'a"b@previ.com.br', barra: 'a\\b@previ.com.br', maiusculas: 'Ana.Teste@PREVI.com.br',
  longo64: 'a'.repeat(51) + dom, longo65: 'a'.repeat(52) + dom, longo90: 'b'.repeat(77) + dom };
Object.keys(nomeados).forEach((n) => { const e = nomeados[n];
  afirma(aceita(e, emailKey(e)) && candidatos(e).every((c) => c === emailKey(e) || !aceita(e, c)), n + ': só a chave da emailKey() (' + emailKey(e).length + ' caracteres)'); });
afirma(emailKey(nomeados.longo65).length === 64 && derivada(nomeados.longo65).length === 65 && aceita(nomeados.longo65, emailKey(nomeados.longo65)) && !aceita(nomeados.longo65, derivada(nomeados.longo65)),
  'mais de 64: aceita os 64 primeiros, recusa a derivada inteira');
['joão.silva@previ.com.br', 'ana\u00e9@previ.com.br', 'ольга@previ.com.br', 'a\tb@previ.com.br', 'x@gmail.com', 'ana@previ.com.br.evil'].forEach((e) =>
  afirma(candidatos(e).concat([emailKey(e)]).every((c) => !aceita(e, c)), 'fora do ASCII imprimível ou de outro domínio: nenhuma chave aceita (' + JSON.stringify(e).replace(/[^\x20-\x7e]/g, '?') + ')'));
afirma(emailKey('a-b@previ.com.br') === emailKey('ab@previ.com.br') && aceita('a-b@previ.com.br', 'ab_previ_com_br') && aceita('ab@previ.com.br', 'ab_previ_com_br'),
  'colisão (a-b e ab): mesma chave para os dois — quem decide a posse é o e-mail gravado (emulador)');

console.log('\n' + (total - falhas) + '/' + total + ' verificações');
if (falhas) process.exit(1);
