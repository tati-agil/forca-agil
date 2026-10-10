/* POSICIONAMENTO — a tabela das 25 regras (regras-posicionamento-tabela.js) é o motor v1, e o banco usa a tabela.
 *
 * Sem navegador, sem rede (o motor real e a tabela, em Node):
 *   1. nos 531.441 estados (O1–O9 em SIM/NAO/ausente × diagnóstico N1–N3 em mesma/distintas/ausente) vale
 *      EXATAMENTE UMA regra da tabela, e a saída que ela descreve é idêntica, campo a campo, à de
 *      faMotorPosicionamento.avaliar() — codigoResultado, tipoAValidar, motivo, nivelConfirmado, papeisDetectados,
 *      regra, versaoMotor, liberaSquad, niveisAlcancados, perguntasForaDoCaminho;
 *   2. as 25 regras são alcançadas, e os ids da tabela são os do motor;
 *   3. as regras que permitem CONCLUIR são exatamente as de dados completos (nunca falta de resposta, diagnóstico
 *      pendente ou SIM fora do caminho), e os 36 estados concluíveis caem nelas;
 *   4. o trecho que a tabela gera é EXATAMENTE o publicado em database.rules.json (caminho + resultado), os 5 nós
 *      publicados são, inteiros, os que montar-regras-posicionamento.js monta, e o banco aceita só a versão 1 do motor.
 * Os 36 estados concluíveis, um a um, e as adulterações são provados no emulador (teste-rules-posicionamento.js). */
'use strict';
const fs = require('fs');
const path = require('path');
const T = require('./regras-posicionamento-tabela.js');
const M = require(path.join(__dirname, '..', '..', 'forca-agil', 'motor-posicionamento.js'));

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('\n== 1. Os 531.441 estados: uma regra só, e a mesma saída do motor ==');
const VR = ['SIM', 'NAO', null], VD = ['mesma', 'distintas', null];
let total = 0, semUma = 0, divergentes = 0, exemplo = null;
const alcancadas = {};
for (let a = 0; a < 19683; a++) {
  const respostas = {};
  let x = a;
  for (let i = 0; i < 9; i++) { const v = VR[x % 3]; x = Math.floor(x / 3); if (v) respostas[T.PERGUNTAS[i]] = v; }
  for (let d = 0; d < 27; d++) {
    const diagnosticos = {};
    let y = d;
    ['N1', 'N2', 'N3'].forEach((n) => { const v = VD[y % 3]; y = Math.floor(y / 3); if (v) diagnosticos[n] = v; });
    total++;
    const est = { respostas, diagnosticos };
    const rs = T.regrasQueValem(est);
    if (rs.length !== 1) { semUma++; if (!exemplo) exemplo = { est, regras: rs.map((r) => r.id) }; continue; }
    alcancadas[rs[0].id] = (alcancadas[rs[0].id] || 0) + 1;
    const doMotor = M.avaliar(respostas, diagnosticos);
    if (!igual(T.saida(rs[0], est), doMotor)) { divergentes++; if (!exemplo) exemplo = { est, tabela: T.saida(rs[0], est), motor: doMotor }; }
  }
}
afirma(total === 531441, 'percorreu ' + total + ' estados');
afirma(semUma === 0, 'em todo estado vale exatamente uma regra (' + semUma + ' sem regra única)', JSON.stringify(exemplo));
afirma(divergentes === 0, 'a saída da regra é idêntica à do motor nos 10 campos (' + divergentes + ' divergências)', JSON.stringify(exemplo));

console.log('\n== 2. As 25 regras ==');
const idsTabela = T.REGRAS.map((r) => r.id);
afirma(idsTabela.length === 25 && new Set(idsTabela).size === 25, '25 regras, sem repetição');
afirma(igual(idsTabela.slice().sort(), Object.keys(M.REGRAS).sort()), 'os ids da tabela são exatamente os do motor');
afirma(idsTabela.every((id) => alcancadas[id] > 0), 'todas as 25 alcançadas', idsTabela.filter((id) => !alcancadas[id]).join(', '));
afirma(M.versaoAtual() === T.VERSAO_MOTOR && igual(M.versoes(), [1]), 'a tabela é da versão 1, a única do motor');

console.log('\n== 3. Só dados completos concluem ==');
const concl = T.REGRAS.filter((r) => r.conclusao).map((r) => r.id);
const naoConcl = T.REGRAS.filter((r) => !r.conclusao).map((r) => r.id);
afirma(igual(naoConcl.slice().sort(), ['DEF_SIM_FORA_DO_CAMINHO', 'N1_DIAGNOSTICO_PENDENTE', 'N1_RESPOSTA_FALTANDO', 'N2_DIAGNOSTICO_PENDENTE',
  'N2_RESPOSTA_FALTANDO', 'N3_DIAGNOSTICO_PENDENTE', 'N3_RESPOSTA_FALTANDO']), 'não concluem: SIM fora do caminho, resposta faltando e diagnóstico pendente (' + naoConcl.length + ')');
const estados = T.estadosConcluiveis();
afirma(estados.length === 36, 'estados completos concluíveis: ' + estados.length);
afirma(concl.length === 18 && concl.every((id) => estados.some((x) => x.regra.id === id)), 'as 18 regras de dados completos têm estado concluível');
afirma(estados.every((x) => igual(x.saida, M.avaliar(x.est.respostas, x.est.diagnosticos)) && x.saida.perguntasForaDoCaminho.length === 0),
  'nos 36 estados concluíveis a saída é a do motor e nada fica fora do caminho');
afirma(estados.every((x) => {
  const caminho = M.perguntasDoCaminho(x.est.respostas, x.est.diagnosticos);
  return igual(Object.keys(x.est.respostas).sort(), caminho.slice().sort());
}), 'cada estado concluível responde exatamente as perguntas do caminho (perguntasDoCaminho)');

console.log('\n== 4. O trecho gerado é o publicado ==');
const regras = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'database.rules.json'), 'utf8')).rules;
const no = regras['avaliacoes-posicionamento'];
const val = no && no.$avaliacaoId && no.$avaliacaoId['.validate'];
afirma(!!val, 'avaliacoes-posicionamento/$avaliacaoId tem .validate');
afirma(!!val && val.indexOf(T.trechoCaminho()) !== -1, 'o trecho do CAMINHO gerado está, idêntico, nas regras publicadas');
afirma(!!val && val.indexOf(T.trechoResultado()) !== -1, 'o trecho do RESULTADO gerado está, idêntico, nas regras publicadas');
const MONTADAS = require('./montar-regras-posicionamento.js');
MONTADAS.NOS.forEach((n) => afirma(igual(regras[n], MONTADAS.BLOCOS[n]), 'o nó ' + n + ' publicado é EXATAMENTE o montado por montar-regras-posicionamento.js (que usa esta tabela)'));
const versoesNasRegras = (val || '').match(/resultadoAutomatico\/versaoMotor'\)\.val\(\) === (\d+)/g) || [];
afirma(versoesNasRegras.length > 0 && versoesNasRegras.every((m) => /=== 1$/.test(m)), 'o banco aceita só versaoMotor 1 (' + versoesNasRegras.length + ' conferências, nenhuma de outra versão)');
const tamanho = fs.statSync(path.join(__dirname, '..', '..', 'database.rules.json')).size;
afirma(tamanho < 256 * 1024, 'database.rules.json com ' + tamanho + ' bytes (limite do Firebase: 262.144)');

console.log('\n============================\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
process.exit(falhas ? 1 : 0);
