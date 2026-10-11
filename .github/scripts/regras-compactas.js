/* B0 (H2-b) — versão COMPACTA de database.rules.json para deploy, com prova de equivalência. Só MEDE e GERA;
 * não muda o deploy (firebase.json continua apontando para o fonte legível — trocar isso é decisão do B2).
 *
 *   node .github/scripts/regras-compactas.js                 → mostra os tamanhos e confere a equivalência
 *   node .github/scripts/regras-compactas.js --gravar <saída> → grava a versão compacta em <saída>
 *
 * Compactar só tira espaços e quebras de linha FORA das strings: o JSON é lido e reescrito sem indentação, e a
 * prova é a igualdade estrutural profunda (mesmas chaves, mesma ordem, mesmas expressões, caractere a caractere). */
'use strict';
const fs = require('fs');
const path = require('path');
const FONTE = path.join(__dirname, '..', '..', 'database.rules.json');

function compactar(texto) { return JSON.stringify(JSON.parse(texto)); }
/* igualdade profunda que também exige a mesma ORDEM de chaves (o deploy é feito com o texto, e a ordem não pode mudar) */
function mesmaEstrutura(a, b) {
  if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b)) return false;
  if (a === null || typeof a !== 'object') return a === b;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false;
  return ka.every((k) => mesmaEstrutura(a[k], b[k]));
}
function relatorio(texto) {
  const c = compactar(texto);
  return { fonte: Buffer.byteLength(texto), compacto: Buffer.byteLength(c), equivalente: mesmaEstrutura(JSON.parse(texto), JSON.parse(c)), compactoTexto: c };
}
module.exports = { compactar, mesmaEstrutura, relatorio };

if (require.main === module) {
  const r = relatorio(fs.readFileSync(FONTE, 'utf8'));
  console.log('fonte legível: ' + r.fonte + ' bytes · compacto: ' + r.compacto + ' bytes · economia: ' + (r.fonte - r.compacto) + ' bytes · equivalente: ' + (r.equivalente ? 'sim' : 'NÃO'));
  const i = process.argv.indexOf('--gravar');
  if (i !== -1) { if (!r.equivalente) process.exit(1); fs.writeFileSync(process.argv[i + 1], r.compactoTexto); console.log('gravado: ' + process.argv[i + 1]); }
  process.exit(r.equivalente ? 0 : 1);
}
