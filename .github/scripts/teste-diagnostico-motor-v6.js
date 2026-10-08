/* Diagnóstico da versão 6 do motor P1–P16 — a simulação é confiável e não toca em nada.
 *
 * Prova, sem navegador, sem rede e sem Firebase real, que a rotina
 * .github/scripts/diagnostico-motor-v6.js:
 *   - gera as 2^16 = 65.536 combinações completas e distintas de P1–P16;
 *   - reconstrói a V5 igual ao motor real (identificarCamada) em todas elas;
 *   - compara V5 × proposta com o MESMO executor do site (equivalência provada
 *     para a V6 também, nunca presumida) e com regras que o editor aceitaria
 *     (validarRegras: sem erro, nenhuma regra inalcançável);
 *   - conflitos P9–P16: cada par julgado "conflitante" na matriz, isolado, vai
 *     para "A validar — conflito"; cada par compatível, subordinado ou
 *     ambíguo, isolado, fica exatamente como na V5;
 *   - Capacidade: as alternativas A e B mudam as MESMAS combinações (P15 = NÃO
 *     e as outras naturezas já são garantidas pela precedência), e a G só
 *     muda P1 = SIM com P11 sozinha, fora do núcleo completo de Produto/Serviço;
 *   - precedência 0 (incoerência) continua a primeira e decide as mesmas
 *     combinações; P6 e P7 continuam sem decidir nada; P8 continua exigido
 *     em Produto/Serviço principal e Unidade de valor associada;
 *   - nada é gravado: o Firebase falso não recebe nenhuma escrita;
 *   - PROVA INVERSA: com a regra nova colocada DEPOIS de Canal, a checagem
 *     dos pares acusa a combinação exata (a checagem não passa por vazio).
 * Não muda regra nenhuma do site: só lê forca-agil/motor-arquitetura.js. */
const D = require('./diagnostico-motor-v6.js');

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (cond || detalhe === undefined ? '' : ' — ' + detalhe)); if (!cond) falhas++; }
const copia = (x) => JSON.parse(JSON.stringify(x));
const bitsDe = (campos) => campos.reduce((n, c) => n | (1 << D.CAMPOS.indexOf(c)), 0);

const { M, escritas } = D.carregarMotor();
const v5 = D.regrasV5(M);
const dV5 = D.decisor(v5);
const variantes = {};
for (const [id, v] of Object.entries(D.VARIANTES)) variantes[id] = v.montar(v5);
const dV6 = D.decisor(variantes.v6);

console.log('\n-- combinações --');
{
  const vistas = new Set(); const sims = {};
  for (let n = 0; n < D.TOTAL; n++) {
    const c = D.combinacao(n); vistas.add(D.CAMPOS.map((k) => c[k][0]).join(''));
    D.CAMPOS.forEach((k) => { if (c[k] === 'SIM') sims[k] = (sims[k] || 0) + 1; });
  }
  afirma(vistas.size === 65536, '65.536 combinações completas e distintas', vistas.size);
  afirma(D.CAMPOS.every((k) => sims[k] === 32768), 'cada pergunta é SIM em exatamente metade delas');
}

console.log('\n-- V5 e motor real --');
afirma(D.provarEquivalencia(M, v5) === 0, 'V5 reconstruída = identificarCamada do motor real nas 65.536');
['PRODUTO_SERVICO_PRINCIPAL', 'UNIDADE_VALOR_ASSOCIADA'].forEach((c) => {
  const r = v5.find((x) => x.codigo === c);
  afirma(r.condicoes.all.some((f) => f.campo === 'P8' && f.valor === 'SIM'), c + ': P8 = SIM no grupo principal (exigido, não proibido)');
});
afirma(M.validarRegras({ regras: copia(v5) }).length === 0, 'V5 aceita por validarRegras');

console.log('\n-- variantes da V6 --');
for (const [id, regras] of Object.entries(variantes)) {
  const erros = Array.from(M.validarRegras({ regras: copia(regras) }));
  afirma(erros.length === 0, id + ': aceita por validarRegras (nenhuma regra inalcançável)', erros.join(' / '));
}
afirma(D.provarEquivalencia(M, variantes.v6) === 0, 'V6 proposta: o avaliador rápido = identificarCamada do motor real nas 65.536');
afirma(D.provarEquivalencia(M, variantes['cap-g']) === 0, 'Capacidade G: o avaliador rápido = identificarCamada do motor real nas 65.536');

console.log('\n-- conflitos P9–P16 (par isolado) --');
function checarPares(d, rotulo) {
  const erros = [];
  for (const p of D.PARES) {
    for (let base = 0; base < 256; base++) { /* P1–P8 livres; só o par entre P9–P16 */
      const n = base | bitsDe([p.a, p.b]);
      const antes = dV5(n), depois = d(n);
      if (antes.codigo === 'INCOERENCIA') { if (depois.codigo !== 'INCOERENCIA') erros.push(p.a + '×' + p.b + ' #' + n + ': incoerência virou ' + depois.codigo); continue; }
      if (p.categoria === 'conflitante') {
        if (depois.resultado !== 'a-validar' || !/^CONFLITO_/.test(depois.codigo)) erros.push(p.a + '×' + p.b + ' #' + n + ': ' + depois.codigo + ' em vez de conflito');
      } else if (antes.codigo !== depois.codigo) erros.push(p.a + '×' + p.b + ' (' + p.categoria + ') #' + n + ': mudou de ' + antes.codigo + ' para ' + depois.codigo);
    }
  }
  return erros;
}
{
  const erros = checarPares(dV6);
  afirma(erros.length === 0, 'V6: pares conflitantes → conflito; compatíveis, subordinados e ambíguos → igual à V5', erros.slice(0, 3).join(' | '));
  const conflitantes = D.PARES.filter((p) => p.categoria === 'conflitante').length;
  afirma(conflitantes === 13 && D.NOVOS_CONFLITOS.length === 8, 'matriz: 13 pares conflitantes, 8 deles novos (fora do grupo P11–P15 da V5)', conflitantes + '/' + D.NOVOS_CONFLITOS.length);
  afirma(D.PARES.length === 28, 'matriz cobre os 28 pares P9–P16 sem repetir');
}

console.log('\n-- Capacidade organizacional --');
{
  const cA = D.comparar(dV5, D.decisor(variantes['cap-a']));
  const cB = D.comparar(dV5, D.decisor(variantes['cap-b']));
  const iguais = cA.total === cB.total && cA.mudancas.every((m, i) => m.n === cB.mudancas[i].n && m.b.codigo === cB.mudancas[i].b.codigo);
  afirma(cA.total === 128 && iguais, 'A e B mudam as mesmas 128 combinações (P15 = NÃO e "nenhuma outra natureza" já vêm da precedência)', cA.total + '/' + cB.total);
  const cG = D.comparar(dV5, D.decisor(variantes['cap-g']));
  const nucleo = bitsDe(['P1', 'P2', 'P3', 'P4', 'P5', 'P8']);
  const fora = cG.mudancas.filter((m) => !(D.sim(m.n, 'P1') && D.sim(m.n, 'P11') && D.naturezasSim(m.n).length === 1 &&
    (m.n & nucleo) !== nucleo && m.a.codigo === 'FALLBACK_A_VALIDAR' && m.b.codigo === 'CAPACIDADE_ORGANIZACIONAL'));
  afirma(cG.total === 124 && fora.length === 0, 'G: 124 mudanças, todas "A validar → Capacidade" com P1 = SIM, P11 como única natureza e fora do núcleo de Produto/Serviço', cG.total + ', fora do padrão: ' + fora.length);
}

console.log('\n-- precedência 0, P6/P7, P8 --');
{
  const z5 = D.precedenciaZero(v5, dV5), z6 = D.precedenciaZero(variantes.v6, dV6);
  let mesmas = true; for (let n = 0; n < D.TOTAL; n++) if ((dV5(n).codigo === 'INCOERENCIA') !== (dV6(n).codigo === 'INCOERENCIA')) { mesmas = false; break; }
  afirma(z6.primeira === 'INCOERENCIA' && z6.decide === 16384 && mesmas, 'incoerência continua a primeira e decide as mesmas 16.384 combinações', JSON.stringify(z6));
  afirma(z5.decide === z6.decide, 'nenhuma regra nova a torna inalcançável');
  afirma(D.invariancia(dV6, 'P6') === 0 && D.invariancia(dV6, 'P7') === 0, 'V6: trocar só P6 ou só P7 não muda nenhuma decisão');
  const p8 = { prod: D.dependenciaP8(dV6, 'PRODUTO_SERVICO_PRINCIPAL'), uva: D.dependenciaP8(dV6, 'UNIDADE_VALOR_ASSOCIADA') };
  afirma(p8.prod === D.dependenciaP8(dV5, 'PRODUTO_SERVICO_PRINCIPAL') && p8.uva === D.dependenciaP8(dV5, 'UNIDADE_VALOR_ASSOCIADA') && p8.prod > 0 && p8.uva > 0,
    'V6: P8 = SIM continua exigido em Produto/Serviço principal e Unidade de valor (mesmas combinações dependem dele)', JSON.stringify(p8));
}

console.log('\n-- impressão digital da proposta --');
{
  const c = D.comparar(dV5, dV6);
  afirma(c.total === 36220, 'V6 muda 36.220 das 65.536 (qualquer mudança na proposta tem de atualizar este número de propósito)', c.total);
  afirma(c.porNaturezas[0].mudam === 0, 'nenhuma combinação sem natureza marcada muda');
  afirma(c.porNaturezas[1].mudam === 124, 'com uma única natureza, só as 124 da Capacidade mudam', c.porNaturezas[1].mudam);
  const destinos = new Set(c.mudancas.map((m) => m.b.codigo));
  afirma(destinos.size === 2 && destinos.has('CONFLITO_NATUREZAS_AMPLIADO') && destinos.has('CAPACIDADE_ORGANIZACIONAL'), 'toda mudança vai para o conflito novo ou para Capacidade', Array.from(destinos).join(', '));
}

console.log('\n-- hipótese: incoerência generalizada (P5 × P13–P16), só simulação --');
{
  const dI = D.decisor(variantes['incoerencia-p5']);
  let ja = 0, novas = 0, outras = 0; const origem = {};
  for (let n = 0; n < D.TOTAL; n++) {
    const a = dV5(n), b = dI(n);
    if (a.codigo === 'INCOERENCIA') { if (b.codigo === 'INCOERENCIA') ja++; continue; }
    if (b.codigo === 'INCOERENCIA') { novas++; origem[a.codigo] = (origem[a.codigo] || 0) + 1; } else if (a.codigo !== b.codigo) outras++;
  }
  afirma(ja === 16384, 'as 16.384 de P5 + P16 continuam incoerência', ja);
  afirma(novas === 14336 && outras === 0, '14.336 combinações novas viram incoerência e nenhuma outra muda', novas + '/' + outras);
  afirma(JSON.stringify(Object.keys(origem).sort()) === JSON.stringify(['CANAL', 'CONFLITO_NATUREZAS', 'DOCUMENTO_INFORMACAO', 'FALLBACK_A_VALIDAR']),
    'só Canal, Informação/Documento, conflito de naturezas e "sem classificação" são ultrapassados', JSON.stringify(origem));
  afirma(D.provarEquivalencia(M, variantes['incoerencia-p5']) === 0, 'o avaliador da simulação = identificarCamada do motor real');
}

console.log('\n-- nada é gravado --');
afirma(escritas.length === 0, 'o Firebase falso não recebeu nenhuma escrita', JSON.stringify(escritas));

console.log('\n-- prova inversa --');
{
  const errada = copia(variantes.v6);
  errada.find((r) => r.codigo === 'CONFLITO_NATUREZAS_AMPLIADO').ordem = errada.find((r) => r.codigo === 'CANAL').ordem + 0.5; /* logo depois de Canal */
  const erros = checarPares(D.decisor(errada));
  afirma(erros.some((e) => /^P9×P12 .*CANAL em vez de conflito/.test(e)), 'com o conflito novo depois de Canal, a checagem acusa P9×P12 resolvido como Canal', erros[0]);
}

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
