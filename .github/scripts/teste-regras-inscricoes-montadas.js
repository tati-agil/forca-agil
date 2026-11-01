/* Etapa B — segurança das inscrições, sem navegador nem emulador: os 5 nós de turmas em database.rules.json são
 * exatamente os montados por montar-regras-inscricoes.js (ninguém os edita à mão), a chave da própria pessoa é a
 * PROPRIA_CHAVE de fa-users (a emailKey do site, provada por teste-regras-fa-users-chave.js), e nenhum ANCESTRAL
 * libera gravação — no Realtime Database um .write verdadeiro num nó acima vale para tudo abaixo, então uma permissão
 * aberta na raiz ou no próprio nó anularia as regras de cada registro. A autorização real é provada no emulador por
 * teste-rules-inscricoes.js. */
'use strict';
const fs = require('fs');
const path = require('path');
const { BLOCOS } = require('./montar-regras-inscricoes.js');
const { PROPRIA_CHAVE, ADM } = require('./montar-regras-fa-users.js');

let falhas = 0;
const anota = (r, ok, d) => { if (ok) console.log('  ok    ' + r); else { falhas++; console.error('  FALHA ' + r + (d ? ' → ' + d : '')); } };
const regras = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'database.rules.json'), 'utf8')).rules;

Object.keys(BLOCOS).forEach((n) => anota('o nó ' + n + ' é o montado', JSON.stringify(regras[n]) === JSON.stringify(BLOCOS[n])));
anota('a raiz não libera gravação', regras['.write'] === false);
Object.keys(BLOCOS).forEach((n) => anota('o nó ' + n + ' não tem .write próprio (nada acima de $turmaKey libera)', !('.write' in regras[n])));
Object.keys(BLOCOS).forEach((n) => anota('em ' + n + ', a turma inteira ($turmaKey) só o admin grava', regras[n].$turmaKey['.write'] === 'auth != null && ' + ADM));
const reg = regras['turmas-interesse'].$turmaKey.$userKey['.write'];
anota('turmas-interesse usa a chave da própria pessoa de fa-users', reg.indexOf(PROPRIA_CHAVE) !== -1);
const log = regras['turmas-interesse-log'].$turmaKey.$userKey;
anota('no histórico, o nível da pessoa ($userKey) só o admin grava; ela só acrescenta itens', log['.write'] === 'auth != null && ' + ADM && log.$item['.write'].indexOf("!data.exists()") !== -1);
anota('nenhuma expressão desses nós libera por "qualquer @previ"', Object.keys(BLOCOS).every((n) => !JSON.stringify(regras[n]).match(/"\.write":"auth != null && auth\.token\.email\.matches/)));

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTUDO OK.');
process.exit(falhas ? 1 : 0);
