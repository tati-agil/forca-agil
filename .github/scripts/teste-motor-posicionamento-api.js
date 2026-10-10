/* MOTOR DE POSICIONAMENTO — liberaSquadParaCodigoFirme (PR F) e a saída do motor congelada.
 *
 * Sem navegador, sem rede e SEM depender do histórico Git (o CI faz checkout raso):
 *   1. as saídas de avaliar() nos 531.441 estados (O1–O9 em SIM/NAO/ausente × diagnóstico N1–N3 em
 *      mesma/distintas/ausente) têm exatamente o digest canônico registrado abaixo — calculado com o motor
 *      do main 76e2fb8, antes da extensão do PR F. Qualquer mudança de regra, campo, precedência ou versão
 *      muda o digest e este teste falha;
 *   2. para todo estado com resultado firme: liberaSquadParaCodigoFirme(codigoResultado) === resultado.liberaSquad
 *      (a função nova é a MESMA regra que alimenta o resultado — a decisão humana do PR F usa só ela);
 *   3. os 8 CODIGOS_FIRMES são aceitos (devolvem booleano);
 *   4. LINHA, PLATAFORMA, A_VALIDAR, código desconhecido, vazio, null e undefined são recusados (erro). */
'use strict';
const crypto = require('crypto');
const path = require('path');
const M = require(path.join(__dirname, '..', '..', 'forca-agil', 'motor-posicionamento.js'));

/* sha256 das 531.441 saídas, uma linha por estado, chaves em ordem — motor do main 76e2fb8 */
const DIGEST = '010adee5fe5fddebf922313c9ec4d240890a27f9ff2a556b483ae9e9e4da95c7';

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

console.log('\n== 1. As 531.441 saídas do motor não mudaram ==');
const P = M.PERGUNTAS, VR = ['SIM', 'NAO', null], VD = ['mesma', 'distintas', null];
const h = crypto.createHash('sha256');
let total = 0, firmes = 0, divergentes = 0, exemplo = null;
const porCodigo = {};
for (let a = 0; a < 19683; a++) {
  const r = {};
  let x = a;
  for (let i = 0; i < 9; i++) { const v = VR[x % 3]; x = Math.floor(x / 3); if (v) r[P[i]] = v; }
  for (let d = 0; d < 27; d++) {
    const g = {};
    let y = d;
    ['N1', 'N2', 'N3'].forEach((k) => { const v = VD[y % 3]; y = Math.floor(y / 3); if (v) g[k] = v; });
    const o = M.avaliar(r, g);
    h.update(JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]])) + '\n');
    total++;
    if (M.CODIGOS_FIRMES.indexOf(o.codigoResultado) !== -1) {
      firmes++;
      porCodigo[o.codigoResultado] = (porCodigo[o.codigoResultado] || 0) + 1;
      if (M.liberaSquadParaCodigoFirme(o.codigoResultado) !== o.liberaSquad) { divergentes++; if (!exemplo) exemplo = { r, g, o }; }
    }
  }
}
const digest = h.digest('hex');
afirma(total === 531441, 'percorreu ' + total + ' estados');
afirma(digest === DIGEST, 'digest canônico das saídas igual ao do motor antes do PR F', digest);

console.log('\n== 2. liberaSquadParaCodigoFirme é a mesma regra do resultado ==');
afirma(divergentes === 0, 'em todos os ' + firmes + ' estados com resultado firme, a função dá o liberaSquad do resultado (' + divergentes + ' divergências)', JSON.stringify(exemplo));
afirma(M.CODIGOS_FIRMES.every((c) => porCodigo[c] > 0), 'os 8 códigos firmes aparecem como resultado (a prova cobre todos)', JSON.stringify(porCodigo));

console.log('\n== 3. Os 8 códigos firmes são aceitos ==');
afirma(M.CODIGOS_FIRMES.length === 8 && M.CODIGOS_FIRMES.every((c) => typeof M.liberaSquadParaCodigoFirme(c) === 'boolean'), 'os 8 devolvem booleano');

console.log('\n== 4. O que não é firme é recusado ==');
[['LINHA', 'LINHA'], ['PLATAFORMA', 'PLATAFORMA'], ['A_VALIDAR', 'A_VALIDAR'], ['desconhecido', 'SQUAD'], ['vazio', ''], ['null', null], ['undefined', undefined]].forEach(([rot, c]) => {
  let recusou = false;
  try { M.liberaSquadParaCodigoFirme(c); } catch (e) { recusou = true; }
  afirma(recusou, rot + ': recusado (erro), sem valor padrão');
});
afirma(M.versaoAtual() === 1 && JSON.stringify(M.versoes()) === '[1]', 'a versão do motor continua 1');

console.log('\n============================\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
process.exit(falhas ? 1 : 0);
