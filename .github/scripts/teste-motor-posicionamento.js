/* Motor de POSICIONAMENTO ORGANIZACIONAL O1–O9 — os 531.441 estados possíveis, um por um.
 *
 * Carrega o forca-agil/motor-posicionamento.js REAL (o mesmo arquivo que o site serve) num vm, como no navegador
 * (window.faMotorPosicionamento), sem navegador, sem Firebase e sem rede, e percorre o espaço DEFENSIVO inteiro:
 * O1–O9 em SIM / NAO / ausente (3^9 = 19.683) × diagnóstico de N1, N2 e N3 em mesma / distintas / ausente (3^3 = 27).
 *
 * Cada estado é comparado com uma EXPECTATIVA escrita aqui, à parte, a partir da especificação aprovada — nunca
 * copiada do motor (resultado, tipo de A validar, motivo, nível confirmado e liberaSquad). Depois se provam as
 * contagens consolidadas da especificação e as propriedades pedidas:
 *   - 480.870 incoerência · 38.502 evidência insuficiente (sem contar o diagnóstico pendente) · 1.926 diagnóstico
 *     pendente · 1.926 conflito · 3.789 recorte · o resto, firme, nas 8 classificações (todas alcançáveis);
 *   - NEGOCIOS em 432 estados, todos com O5 = SIM;
 *   - Área/CoE nunca liberam Squad; firme de Linha sempre libera; A_VALIDAR só com nível LINHA ou PLATAFORMA;
 *   - NAO fora do caminho nunca gera incoerência; SIM fora do caminho sempre gera;
 *   - diagnóstico gravado fora da sua condição de uso não muda o resultado;
 *   - COMPLETUDE DO NÍVEL: nível alcançado com pergunta ausente é sempre evidência insuficiente (RESPOSTA_FALTANDO),
 *     mesmo quando a categoria parece inevitável (N3 com 3 SIM + 1 ausente não é recorte);
 *   - só os 4 tipos de A validar; regra e motivo sempre códigos do catálogo; versão registrada.
 * Hermético: sem rede, sem navegador, sem segredo. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

const ARQUIVO = path.join(__dirname, '..', '..', 'forca-agil', 'motor-posicionamento.js');
const ctx = { window: {}, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(ARQUIVO, 'utf8'), ctx, { filename: 'motor-posicionamento.js' });
const M = ctx.window.faMotorPosicionamento;

console.log('== Contrato ==');
afirma(!!M && typeof M.avaliar === 'function', 'window.faMotorPosicionamento.avaliar existe (carregado como no navegador)');
afirma(M.versaoAtual() === 1 && JSON.stringify(M.versoes()) === '[1]', 'nasce na versão 1');
afirma(JSON.stringify(M.CODIGOS_FIRMES.slice().sort()) === JSON.stringify(['AREA_ESPECIALIZADA', 'COE', 'ESTRATEGIA_CLIENTES', 'NEGOCIOS', 'PLATAFORMA_CANAIS', 'PLATAFORMA_CORPORATIVA', 'PLATAFORMA_HABILITADORA_NEGOCIOS', 'PLATAFORMA_HABILITADORA_TECNOLOGIA']), 'os 8 códigos firmes canônicos');
afirma(JSON.stringify(M.TIPOS_A_VALIDAR) === JSON.stringify(['INCOERENCIA', 'CONFLITO', 'RECORTE', 'EVIDENCIA_INSUFICIENTE']), 'só os 4 tipos de A validar');
afirma(M.DIAGNOSTICO === 'DIAG_CONFLITO_RECORTE' && M.PERGUNTAS.join() === 'O1,O2,O3,O4,O5,O6,O7,O8,O9', 'O1–O9 e o diagnóstico DIAG_CONFLITO_RECORTE (sem O10)');

/* ---------- expectativa escrita à parte (especificação aprovada) ---------- */
const N1 = ['O1', 'O2', 'O3'], N2 = ['O4', 'O5'], N3 = ['O6', 'O7', 'O8', 'O9'];
const FIRME_N1 = { O2: 'AREA_ESPECIALIZADA', O3: 'COE' };
const FIRME_N2 = { O4: 'ESTRATEGIA_CLIENTES', O5: 'NEGOCIOS' };
const FIRME_N3 = { O6: 'PLATAFORMA_CANAIS', O7: 'PLATAFORMA_HABILITADORA_NEGOCIOS', O8: 'PLATAFORMA_HABILITADORA_TECNOLOGIA', O9: 'PLATAFORMA_CORPORATIVA' };
const DE_LINHA = ['ESTRATEGIA_CLIENTES', 'NEGOCIOS', 'PLATAFORMA_CANAIS', 'PLATAFORMA_HABILITADORA_NEGOCIOS', 'PLATAFORMA_HABILITADORA_TECNOLOGIA', 'PLATAFORMA_CORPORATIVA'];
function esperado(r, d) {
  const sims = (lv) => lv.filter((q) => r[q] === 'SIM');
  const incompleto = (lv) => lv.some((q) => r[q] !== 'SIM' && r[q] !== 'NAO');
  const algumSim = (lv) => lv.some((q) => r[q] === 'SIM');
  const av = (tipo, motivo, nivel) => ({ codigo: 'A_VALIDAR', tipo, motivo, nivel });
  function dois(nivelId, nivel) {
    return d[nivelId] === 'mesma' ? av('CONFLITO', 'DIAGNOSTICO_MESMA', nivel)
      : d[nivelId] === 'distintas' ? av('RECORTE', 'DIAGNOSTICO_DISTINTAS', nivel)
      : av('EVIDENCIA_INSUFICIENTE', 'DIAGNOSTICO_PENDENTE', nivel);
  }
  let res;
  /* Nível 1 */
  const s1 = sims(N1);
  if (incompleto(N1)) res = { ...av('EVIDENCIA_INSUFICIENTE', 'RESPOSTA_FALTANDO', null), fora: [N2, N3] };
  else if (s1.length === 3) res = { ...av('RECORTE', 'TRES_OU_MAIS_PAPEIS', null), fora: [N2, N3] };
  else if (s1.length === 2) res = { ...dois('N1', null), fora: [N2, N3] };
  else if (s1.length === 0) res = { ...av('EVIDENCIA_INSUFICIENTE', 'SEM_PAPEL', null), fora: [N2, N3] };
  else if (s1[0] !== 'O1') res = { codigo: FIRME_N1[s1[0]], tipo: null, motivo: 'PAPEL_UNICO', nivel: null, fora: [N2, N3] };
  else {
    /* Linha confirmada → Nível 2 */
    const s2 = sims(N2);
    if (incompleto(N2)) res = { ...av('EVIDENCIA_INSUFICIENTE', 'RESPOSTA_FALTANDO', 'LINHA'), fora: [N3] };
    else if (s2.length === 2) res = { ...dois('N2', 'LINHA'), fora: [N3] };
    else if (s2.length === 1) res = { codigo: FIRME_N2[s2[0]], tipo: null, motivo: 'PAPEL_UNICO', nivel: null, fora: [N3] };
    else {
      /* ramo Plataforma → Nível 3 */
      const s3 = sims(N3), nv = algumSim(N3) ? 'PLATAFORMA' : 'LINHA';
      if (incompleto(N3)) res = { ...av('EVIDENCIA_INSUFICIENTE', 'RESPOSTA_FALTANDO', nv), fora: [] };
      else if (s3.length >= 3) res = { ...av('RECORTE', 'TRES_OU_MAIS_PAPEIS', nv), fora: [] };
      else if (s3.length === 2) res = { ...dois('N3', nv), fora: [] };
      else if (s3.length === 1) res = { codigo: FIRME_N3[s3[0]], tipo: null, motivo: 'PAPEL_UNICO', nivel: null, fora: [] };
      else res = { ...av('EVIDENCIA_INSUFICIENTE', 'SEM_PAPEL', 'LINHA'), fora: [] };
    }
  }
  if (res.fora.some((lv) => algumSim(lv))) res = av('INCOERENCIA', 'SIM_FORA_DO_CAMINHO', null);
  res.libera = res.codigo === 'A_VALIDAR' ? (res.nivel === 'LINHA' || res.nivel === 'PLATAFORMA') : DE_LINHA.includes(res.codigo);
  return res;
}

/* ---------- os 531.441 estados ---------- */
console.log('\n== Os 531.441 estados (O1–O9 × diagnósticos N1–N3) ==');
const V = ['SIM', 'NAO', null], D = ['mesma', 'distintas', null];
const conta = {}, firmes = {}, regrasVistas = {};
let total = 0, divergentes = 0, exemploDiv = null, negocios = 0, negociosSemO5 = 0;
let areaCoeLibera = 0, linhaNaoLibera = 0, avLiberaErrado = 0, foraContrato = 0;
const r = {}, d = {};
for (let k = 0; k < 19683; k++) {
  let x = k;
  for (let i = 0; i < 9; i++) { const v = V[x % 3]; x = Math.floor(x / 3); if (v) r[M.PERGUNTAS[i]] = v; else delete r[M.PERGUNTAS[i]]; }
  for (let j = 0; j < 27; j++) {
    let y = j;
    ['N1', 'N2', 'N3'].forEach((lv) => { const v = D[y % 3]; y = Math.floor(y / 3); if (v) d[lv] = v; else delete d[lv]; });
    const o = M.avaliar(r, d), e = esperado(r, d);
    total++;
    if (o.codigoResultado !== e.codigo || o.tipoAValidar !== e.tipo || o.motivo !== e.motivo || o.nivelConfirmado !== e.nivel || o.liberaSquad !== e.libera) {
      divergentes++; if (!exemploDiv) exemploDiv = JSON.stringify({ r, d, motor: o, esperado: e });
    }
    if (o.versaoMotor !== 1 || !M.REGRAS[o.regra] || !M.MOTIVOS.includes(o.motivo) || !Array.isArray(o.papeisDetectados) ||
      (o.codigoResultado === 'A_VALIDAR' ? !M.TIPOS_A_VALIDAR.includes(o.tipoAValidar) : (o.tipoAValidar !== null || !M.CODIGOS_FIRMES.includes(o.codigoResultado))) ||
      M.CODIGOS_INTERMEDIARIOS.includes(o.codigoResultado)) foraContrato++;
    regrasVistas[o.regra] = (regrasVistas[o.regra] || 0) + 1;
    const cat = o.codigoResultado !== 'A_VALIDAR' ? 'FIRME' : o.motivo === 'DIAGNOSTICO_PENDENTE' ? 'DIAGNOSTICO_PENDENTE' : o.tipoAValidar;
    conta[cat] = (conta[cat] || 0) + 1;
    if (cat === 'FIRME') firmes[o.codigoResultado] = (firmes[o.codigoResultado] || 0) + 1;
    if (o.codigoResultado === 'NEGOCIOS') { negocios++; if (r.O5 !== 'SIM') negociosSemO5++; }
    if ((o.codigoResultado === 'AREA_ESPECIALIZADA' || o.codigoResultado === 'COE') && o.liberaSquad) areaCoeLibera++;
    if (DE_LINHA.includes(o.codigoResultado) && !o.liberaSquad) linhaNaoLibera++;
    if (o.codigoResultado === 'A_VALIDAR' && o.liberaSquad !== (o.nivelConfirmado === 'LINHA' || o.nivelConfirmado === 'PLATAFORMA')) avLiberaErrado++;
  }
}
afirma(total === 531441, 'percorreu os 531.441 estados (' + total + ')');
afirma(divergentes === 0, 'todos iguais à expectativa escrita à parte: resultado, tipo, motivo, nível confirmado e liberaSquad (' + divergentes + ' divergentes)', exemploDiv);
afirma(foraContrato === 0, 'todo retorno respeita o contrato: versão 1, regra e motivo do catálogo, tipo só em A_VALIDAR, nunca LINHA/PLATAFORMA como resultado (' + foraContrato + ')');
const ESPERADO = { INCOERENCIA: 480870, EVIDENCIA_INSUFICIENTE: 38502, DIAGNOSTICO_PENDENTE: 1926, CONFLITO: 1926, RECORTE: 3789, FIRME: 4428 };
Object.keys(ESPERADO).forEach((k) => afirma(conta[k] === ESPERADO[k], k + ': ' + ESPERADO[k] + ' estados (' + conta[k] + ')'));
afirma(Object.keys(conta).length === 6, 'nenhuma outra categoria (' + Object.keys(conta).join(', ') + ')');
const FIRMES = { AREA_ESPECIALIZADA: 1728, COE: 1728, ESTRATEGIA_CLIENTES: 432, NEGOCIOS: 432, PLATAFORMA_CANAIS: 27, PLATAFORMA_HABILITADORA_NEGOCIOS: 27, PLATAFORMA_HABILITADORA_TECNOLOGIA: 27, PLATAFORMA_CORPORATIVA: 27 };
afirma(M.CODIGOS_FIRMES.every((c) => firmes[c] === FIRMES[c]), 'as 8 classificações firmes alcançáveis, nestas quantidades: ' + JSON.stringify(firmes));
afirma(negocios === 432 && negociosSemO5 === 0, 'NEGOCIOS em 432 estados, e TODOS com O5 = SIM (' + negocios + ', sem O5 = SIM: ' + negociosSemO5 + ')');
afirma(areaCoeLibera === 0, 'Área Especializada e CoE nunca liberam Squad');
afirma(linhaNaoLibera === 0, 'todo resultado firme de Linha libera Squad');
afirma(avLiberaErrado === 0, 'A_VALIDAR libera Squad só com nível confirmado LINHA ou PLATAFORMA');
afirma(Object.keys(M.REGRAS).every((k) => regrasVistas[k] > 0), 'todas as ' + Object.keys(M.REGRAS).length + ' regras são alcançadas: ' + Object.keys(M.REGRAS).filter((k) => !regrasVistas[k]).join(', '));

/* ---------- propriedades pontuais ---------- */
console.log('\n== Resíduos, incoerência e diagnósticos ==');
const av = (o) => o.codigoResultado + '/' + o.tipoAValidar + '/' + o.motivo;
const base = { O1: 'SIM', O2: 'NAO', O3: 'NAO', O4: 'NAO', O5: 'SIM' };   /* Negócios */
afirma(M.avaliar(base).codigoResultado === 'NEGOCIOS', 'caminho de referência: Negócios');
afirma(['O6', 'O7', 'O8', 'O9'].every((q) => M.avaliar({ ...base, [q]: 'NAO' }).codigoResultado === 'NEGOCIOS'), 'NAO fora do caminho (O6–O9 com Negócios) é resíduo: o resultado não muda');
afirma(['O6', 'O7', 'O8', 'O9'].every((q) => { const o = M.avaliar({ ...base, [q]: 'SIM' }); return o.tipoAValidar === 'INCOERENCIA' && o.perguntasForaDoCaminho.join() === q && !o.liberaSquad; }), 'SIM fora do caminho (O6–O9 com Negócios) → incoerência, apontando a pergunta, sem liberar Squad');
const area = { O1: 'NAO', O2: 'SIM', O3: 'NAO' };
afirma(M.avaliar({ ...area, O4: 'SIM' }).tipoAValidar === 'INCOERENCIA' && M.avaliar({ ...area, O6: 'SIM' }).tipoAValidar === 'INCOERENCIA', 'Área + O4 = SIM ou O6 = SIM → incoerência');
afirma(M.avaliar({ ...area, O4: 'NAO', O5: 'NAO', O6: 'NAO' }).codigoResultado === 'AREA_ESPECIALIZADA', 'Área + NAO fora do caminho → continua Área');
afirma(M.avaliar({ O1: 'SIM', O2: 'NAO', O3: 'NAO', O4: 'SIM', O5: 'NAO', O7: 'SIM' }).tipoAValidar === 'INCOERENCIA', 'Estratégia de Clientes + O7 = SIM → incoerência');
let diagResiduoMuda = 0;
for (const est of [area, base, { O1: 'SIM', O2: 'NAO', O3: 'NAO', O4: 'NAO', O5: 'NAO', O6: 'SIM', O7: 'NAO', O8: 'NAO', O9: 'NAO' }, { O1: 'SIM', O2: 'SIM', O3: 'SIM' }]) {
  const ref = JSON.stringify(M.avaliar(est, {}));
  for (const dd of [{ N1: 'mesma' }, { N2: 'distintas' }, { N3: 'mesma' }, { N1: 'distintas', N2: 'mesma', N3: 'distintas' }]) if (JSON.stringify(M.avaliar(est, dd)) !== ref) diagResiduoMuda++;
}
afirma(diagResiduoMuda === 0, 'diagnóstico gravado fora da sua condição de uso não muda o resultado (' + diagResiduoMuda + ')');
const doisN1 = { O1: 'SIM', O2: 'SIM', O3: 'NAO' };
afirma(av(M.avaliar(doisN1, { N1: 'mesma' })) === 'A_VALIDAR/CONFLITO/DIAGNOSTICO_MESMA' && av(M.avaliar(doisN1, { N1: 'distintas' })) === 'A_VALIDAR/RECORTE/DIAGNOSTICO_DISTINTAS' && av(M.avaliar(doisN1)) === 'A_VALIDAR/EVIDENCIA_INSUFICIENTE/DIAGNOSTICO_PENDENTE', 'dois papéis no N1: mesma → conflito; distintas → recorte; sem resposta → evidência insuficiente (diagnóstico pendente)');
afirma(!M.avaliar(doisN1, { N1: 'mesma' }).liberaSquad && M.avaliar(doisN1, { N1: 'mesma' }).nivelConfirmado === null, 'conflito ainda no N1: sem nível confirmado, Squad bloqueado');
const plat = { O1: 'SIM', O2: 'NAO', O3: 'NAO', O4: 'NAO', O5: 'NAO' };
const c3 = M.avaliar({ ...plat, O6: 'NAO', O7: 'SIM', O8: 'NAO', O9: 'SIM' }, { N3: 'mesma' });
afirma(c3.tipoAValidar === 'CONFLITO' && c3.nivelConfirmado === 'PLATAFORMA' && c3.liberaSquad && c3.papeisDetectados.join() === 'PLATAFORMA_HABILITADORA_NEGOCIOS,PLATAFORMA_CORPORATIVA', 'conflito Hab. Negócios × Corporativa: nível PLATAFORMA preservado, papéis nomeados, Squad liberado');
const s3 = M.avaliar({ ...plat, O6: 'NAO', O7: 'NAO', O8: 'NAO', O9: 'NAO' });
afirma(s3.motivo === 'SEM_PAPEL' && s3.nivelConfirmado === 'LINHA' && s3.liberaSquad, 'ramo Plataforma sem nenhum SIM: evidência insuficiente com nível LINHA (Plataforma não confirmada)');
afirma(M.avaliar({ O1: 'SIM', O2: 'NAO', O3: 'NAO', O4: 'SIM', O5: 'SIM' }, { N2: 'distintas' }).nivelConfirmado === 'LINHA', 'recorte no N2: nível LINHA preservado');
const tresMaisAusente = ['O6', 'O7', 'O8', 'O9'].map((ausente) => { const e = { ...plat }; ['O6', 'O7', 'O8', 'O9'].forEach((q) => { if (q !== ausente) e[q] = 'SIM'; }); return M.avaliar(e); });
afirma(tresMaisAusente.every((o) => o.tipoAValidar === 'EVIDENCIA_INSUFICIENTE' && o.motivo === 'RESPOSTA_FALTANDO' && o.nivelConfirmado === 'PLATAFORMA'), 'COMPLETUDE DO NÍVEL: N3 com 3 SIM + 1 ausente é evidência insuficiente (RESPOSTA_FALTANDO), não recorte — nos 4 padrões');
afirma(M.avaliar({ ...plat, O6: 'SIM', O7: 'SIM', O8: 'SIM', O9: 'NAO' }).tipoAValidar === 'RECORTE' && M.avaliar({ ...plat, O6: 'SIM', O7: 'SIM', O8: 'SIM', O9: 'SIM' }).tipoAValidar === 'RECORTE', '…e só com O6–O9 todos respondidos, 3 ou 4 SIM viram recorte');
afirma(M.avaliar({ O1: 'SIM', O2: 'NAO' }).motivo === 'RESPOSTA_FALTANDO' && M.avaliar({ O1: 'SIM', O2: 'NAO' }).nivelConfirmado === null, 'falta de resposta não vira NAO: N1 incompleto → evidência insuficiente');
afirma(M.perguntasDoCaminho(base).join() === 'O1,O2,O3,O4,O5' && M.perguntasDoCaminho(area).join() === 'O1,O2,O3' && M.perguntasDoCaminho(plat).join() === 'O1,O2,O3,O4,O5,O6,O7,O8,O9', 'perguntasDoCaminho: só as do caminho alcançado');
let erro = null; try { M.avaliar(base, {}, { versao: 99 }); } catch (e) { erro = e; }
afirma(!!erro, 'versão desconhecida é recusada (nunca cai em outra regra calada)');

console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTUDO OK — motor O1–O9: 531.441 estados iguais à expectativa e às contagens consolidadas.');
process.exit(falhas ? 1 : 0);
