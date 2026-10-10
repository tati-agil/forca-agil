/* DIFF v1 × v2 do Motor de Posicionamento (H1-B) — gerado, nunca escrito à mão.
 *
 *   node .github/scripts/diff-motor-posicionamento-v1-v2.js            (só confere; sai com erro se o doc divergir)
 *   node .github/scripts/diff-motor-posicionamento-v1-v2.js --gravar   (reescreve docs/motor-posicionamento-v1-v2.md)
 *
 * Usa só o núcleo puro (forca-agil/motor-posicionamento-nucleo.js): enumerarEstados nas duas versões e simular.
 * teste-motor-posicionamento-v2.js confere que o doc publicado é exatamente o que este script gera. */
'use strict';
const fs = require('fs');
const path = require('path');
const ARQUIVO = path.join(__dirname, '..', '..', 'docs', 'motor-posicionamento-v1-v2.md');

function estadoCurto(e) {
  const r = Object.keys(e.respostas).sort().map((q) => q + '=' + e.respostas[q]).join(' ');
  const d = Object.keys(e.diagnosticos).sort().map((n) => n + ':' + e.diagnosticos[n]).join(' ');
  const p = Object.keys(e.predominancias).sort().map((n) => n + ':' + e.predominancias[n]).join(' ');
  return '`' + (r || '(nada respondido)') + (d ? ' · D1 ' + d : '') + (p ? ' · D2 ' + p : '') + '`';
}
function relatorio(N) {
  const V1 = N.definicao(1), V2 = N.definicao(2);
  const e1 = N.enumerarEstados(V1).length, e2 = N.enumerarEstados(V2).length;
  const s = N.simular(V1, V2, { exemplos: 1 });
  const L = [];
  L.push('# Motor de Posicionamento — diferenças v1 × v2');
  L.push('');
  L.push('> Gerado por `node .github/scripts/diff-motor-posicionamento-v1-v2.js --gravar` a partir do núcleo puro');
  L.push('> (`forca-agil/motor-posicionamento-nucleo.js`). Não editar à mão: `teste-motor-posicionamento-v2.js` confere');
  L.push('> que este arquivo é exatamente o que o script gera. A v2 está **inativa** (versão em vigor: ' + N.versaoEmVigor() + ').');
  L.push('');
  L.push('## Estados comparados');
  L.push('');
  L.push('Estados semanticamente válidos (respostas só no caminho, D1 só onde é exigido, D2 só depois de D1 "mesma" e só com');
  L.push('opções de papéis que receberam SIM; incompletos e pendentes incluídos):');
  L.push('');
  L.push('| | Quantidade |');
  L.push('|---|---|');
  L.push('| v1 | ' + e1 + ' |');
  L.push('| v2 | ' + e2 + ' |');
  L.push('| União comparada | ' + s.totalEstados + ' |');
  L.push('| Saída idêntica (objeto completo) | ' + s.identicos + ' |');
  L.push('| Mesmo resultado | ' + s.mantidos + ' (dos quais ' + s.soRegraOuMotivo + ' só com regra ou motivo diferente) |');
  L.push('| Resultado diferente | ' + s.alterados + ' |');
  L.push('| liberaSquad diferente | ' + s.mudancasLiberaSquad + ' |');
  L.push('| Violações de Linha × Squad (deve ser 0) | ' + s.violacoesLinhaSquad + ' |');
  L.push('');
  L.push('## Distribuição dos resultados');
  L.push('');
  L.push('| Resultado | v1 | v2 |');
  L.push('|---|---|---|');
  const rot = Array.from(new Set(Object.keys(s.distribuicaoA).concat(Object.keys(s.distribuicaoB)))).sort();
  rot.forEach((k) => L.push('| ' + k + ' | ' + (s.distribuicaoA[k] || 0) + ' | ' + (s.distribuicaoB[k] || 0) + ' |'));
  L.push('');
  L.push('## Transições (origem → destino)');
  L.push('');
  L.push('| Origem (v1) | Destino (v2) | Estados | Exemplo |');
  L.push('|---|---|---|---|');
  Object.values(s.transicoes).sort((a, b) => b.quantidade - a.quantidade || (a.de + a.para < b.de + b.para ? -1 : 1))
    .forEach((t) => L.push('| ' + t.de + ' | ' + t.para + ' | ' + t.quantidade + ' | ' + estadoCurto(t.exemplos[0].estado) + ' |'));
  L.push('');
  L.push('## Mudança de tipo de A_VALIDAR');
  L.push('');
  L.push('| v1 → v2 | Estados |');
  L.push('|---|---|');
  Object.keys(s.mudancasTipoAValidar).sort().forEach((k) => L.push('| ' + k + ' | ' + s.mudancasTipoAValidar[k] + ' |'));
  L.push('');
  L.push('## Mudança de motivo');
  L.push('');
  L.push('| v1 → v2 | Estados |');
  L.push('|---|---|');
  Object.keys(s.mudancasMotivo).sort().forEach((k) => L.push('| ' + k + ' | ' + s.mudancasMotivo[k] + ' |'));
  L.push('');
  return L.join('\n');
}
module.exports = { relatorio };

if (require.main === module) {
  const N = require(path.join(__dirname, '..', '..', 'forca-agil', 'motor-posicionamento-nucleo.js'));
  const texto = relatorio(N);
  if (process.argv.indexOf('--gravar') !== -1) { fs.writeFileSync(ARQUIVO, texto); console.log('gravado: ' + path.relative(process.cwd(), ARQUIVO)); }
  else {
    const atual = fs.existsSync(ARQUIVO) ? fs.readFileSync(ARQUIVO, 'utf8') : '';
    console.log(atual === texto ? 'o doc publicado é o gerado' : 'DIVERGE: rode com --gravar');
    process.exit(atual === texto ? 0 : 1);
  }
}
