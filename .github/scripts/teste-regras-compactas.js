/* B0 (H2-b) — a versão compacta das regras é EXATAMENTE as mesmas regras (sem navegador, sem rede).
 *   - a compacta lida de volta tem a mesma estrutura, a mesma ordem de chaves e as mesmas expressões do fonte;
 *   - só espaços fora de strings saem (nenhuma expressão muda de texto);
 *   - a conferência de equivalência recusa diferença de valor, de chave e de ordem;
 *   - B2: o deploy publica database.rules.min.json, e esse arquivo é EXATAMENTE a compactação do fonte legível
 *     (byte a byte): quem edita database.rules.json e esquece de regenerar (`node .github/scripts/regras-compactas.js
 *     --gravar database.rules.min.json`) é pego aqui, no CI. */
'use strict';
const fs = require('fs');
const path = require('path');
const R = require('./regras-compactas.js');
let total = 0, falhas = 0;
function afirma(c, msg, det) { total++; console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det ? ' → ' + det : '')); if (!c) falhas++; }
const texto = fs.readFileSync(path.join(__dirname, '..', '..', 'database.rules.json'), 'utf8');
const r = R.relatorio(texto);
afirma(r.equivalente, 'compacta = fonte (estrutura, ordem de chaves e expressões)');
afirma(r.compacto < r.fonte, 'compacta é menor (' + r.fonte + ' → ' + r.compacto + ' bytes)');
const strings = (o, out) => { if (typeof o === 'string') out.push(o); else if (o && typeof o === 'object') Object.keys(o).forEach((k) => { out.push('K:' + k); strings(o[k], out); }); return out; };
afirma(JSON.stringify(strings(JSON.parse(texto), [])) === JSON.stringify(strings(JSON.parse(r.compactoTexto), [])), 'toda chave e toda expressão idênticas, na mesma sequência');
afirma(!R.mesmaEstrutura({ a: 1, b: 2 }, { b: 2, a: 1 }), 'ordem de chaves diferente é recusada');
afirma(!R.mesmaEstrutura({ a: "x === 'a'" }, { a: "x === 'b'" }) && !R.mesmaEstrutura({ a: 1 }, { a: 1, b: 1 }), 'expressão ou chave diferente é recusada');
afirma(JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'firebase.json'), 'utf8')).database.rules === 'database.rules.min.json', 'o deploy publica o artefato compacto (database.rules.min.json)');
const artefato = fs.readFileSync(path.join(__dirname, '..', '..', 'database.rules.min.json'), 'utf8');
afirma(artefato === r.compactoTexto, 'o artefato publicado é exatamente a compactação do fonte legível (byte a byte)', artefato.length + ' × ' + r.compactoTexto.length);
afirma(R.mesmaEstrutura(JSON.parse(texto), JSON.parse(artefato)), 'o artefato publicado tem as mesmas regras, chaves, ordem e expressões do fonte');
console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
process.exit(falhas ? 1 : 0);
