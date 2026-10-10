/* MOTOR DE POSICIONAMENTO — H1-B: validação de definição, enumeração estruturada, simulação, contrato com o
 * questionário e a definição lógica v2 (INATIVA). Sem navegador, sem rede, sem banco.
 *
 *   A. As duas definições embarcadas passam em validarDefinicao; a v2 está inativa (em vigor: 1, no núcleo e no
 *      motor legado); nenhum texto humano no núcleo nem nas definições.
 *   B. Enumeração estruturada: determinística, sem repetição, só estados semanticamente válidos; e COMPLETA —
 *      confere com um filtro independente por força bruta (v1: os 531.441; v2: os 531.441 × as opções de D2).
 *   C. A tabela de transições aprovada da v2, por um ORÁCULO escrito à parte (literal da especificação), em todos
 *      os estados válidos e nos de incoerência; motivos e regras do catálogo v2.
 *   D. Casos nomeados: 0/1/2/3/4 SIM, D1 mesma/distintas/ausente, D2 por nível, N2 0 SIM só candidato a
 *      Plataforma, N3 0 SIM com Linha confirmada, completude, D2 inválido = pendente.
 *   E. Linha × Squad literal em todo resultado da v2.
 *   F. Incoerência vence qualquer conclusão; ausência nunca vira NAO.
 *   G. simular(v1, v2): números reproduzíveis, iguais aos de docs/motor-posicionamento-v1-v2.md, sem violação do
 *      invariante.
 *   H. Contrato motor × conteúdo: estrutura exata (códigos, tipos, opções), vínculo motorCompativel, legado só v1,
 *      podeEntrarEmVigor sem fallback; o texto é livre.
 *   I. validarDefinicao recusa cada violação das regras fixas (um caso por regra).
 * FA_RAIZ (opcional) troca a pasta dos arquivos — para rodar mutantes. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = process.env.FA_RAIZ || path.join(__dirname, '..', '..', 'forca-agil');
const N = require(path.join(RAIZ, 'motor-posicionamento-nucleo.js'));
const M = require(path.join(RAIZ, 'motor-posicionamento.js'));
const V1 = N.definicao(1), V2 = N.definicao(2);

let total = 0, falhas = 0;
function afirma(cond, msg, detalhe) { total++; console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }
const canon = (o) => JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));
const js = (v) => JSON.parse(JSON.stringify(v));
const S = 'SIM', X = 'NAO';
const NIV = { N1: ['O1', 'O2', 'O3'], N2: ['O4', 'O5'], N3: ['O6', 'O7', 'O8', 'O9'] };
const ORDEM = ['N1', 'N2', 'N3'];
/* a especificação aprovada, escrita à mão (não lida do núcleo) */
const PAPEL = { O1: 'LINHA', O2: 'AREA_ESPECIALIZADA', O3: 'COE', O4: 'ESTRATEGIA_CLIENTES', O5: 'NEGOCIOS', O6: 'PLATAFORMA_CANAIS',
  O7: 'PLATAFORMA_HABILITADORA_NEGOCIOS', O8: 'PLATAFORMA_HABILITADORA_TECNOLOGIA', O9: 'PLATAFORMA_CORPORATIVA' };
const D2 = { N1: { RESULTADO_INTEGRADO: 'LINHA', EXECUCAO_ESPECIALIZADA: 'AREA_ESPECIALIZADA', CAPACIDADE_NOS_OUTROS: 'COE' },
  N2: { ESTRATEGIA_PARA_CLIENTES: 'ESTRATEGIA_CLIENTES', RESULTADO_DE_NEGOCIO: 'NEGOCIOS' },
  N3: { INTERACAO_ACESSO_DISTRIBUICAO: 'PLATAFORMA_CANAIS', CAPACIDADE_DE_NEGOCIO: 'PLATAFORMA_HABILITADORA_NEGOCIOS',
    CAPACIDADE_TECNOLOGICA: 'PLATAFORMA_HABILITADORA_TECNOLOGIA', CAPACIDADE_INTERNA_CORPORATIVA: 'PLATAFORMA_CORPORATIVA' } };
const LINHA_SQUAD = { AREA_ESPECIALIZADA: false, COE: false, ESTRATEGIA_CLIENTES: true, NEGOCIOS: true, PLATAFORMA_CANAIS: true,
  PLATAFORMA_HABILITADORA_NEGOCIOS: true, PLATAFORMA_HABILITADORA_TECNOLOGIA: true, PLATAFORMA_CORPORATIVA: true };
const av = (def, e) => N.avaliar(def, e.respostas, e.diagnosticos, e.predominancias);

/* ---------- oráculo da v2 (a tabela aprovada, escrita à parte) ---------- */
function esperadoV2(r, d, p) {
  const resp = (q) => (r[q] === S || r[q] === X ? r[q] : null);
  let nivel = null, fim = null;
  const alc = [];
  const AV = (tipo, motivo, regra, papeis) => ({ codigoResultado: 'A_VALIDAR', tipoAValidar: tipo, motivo, regra, papeisDetectados: papeis });
  for (const n of ORDEM) {
    alc.push(n);
    const qs = NIV[n], sims = qs.filter((q) => resp(q) === S), papeis = sims.map((q) => PAPEL[q]);
    if (n === 'N3' && sims.length) nivel = 'PLATAFORMA';
    if (qs.some((q) => resp(q) === null)) { fim = AV('EVIDENCIA_INSUFICIENTE', 'RESPOSTA_FALTANDO', n + '_RESPOSTA_FALTANDO', papeis); break; }
    if (sims.length >= 2) {
      const d1 = d[n];
      if (d1 === 'distintas') { fim = AV('RECORTE', 'DIAGNOSTICO_DISTINTAS', n + '_RECORTE_DIAGNOSTICO', papeis); break; }
      if (d1 !== 'mesma') { fim = AV('EVIDENCIA_INSUFICIENTE', 'DIAGNOSTICO_PENDENTE', n + '_DIAGNOSTICO_PENDENTE', papeis); break; }
      const op = p[n], papelOp = D2[n][op];
      if (op === 'NAO_DETERMINAVEL') { fim = AV('CONFLITO', 'PREDOMINANCIA_INDEFINIDA', n + '_PREDOMINANCIA_INDEFINIDA', papeis); break; }
      if (!papelOp || papeis.indexOf(papelOp) === -1) { fim = AV('EVIDENCIA_INSUFICIENTE', 'PREDOMINANCIA_PENDENTE', n + '_PREDOMINANCIA_PENDENTE', papeis); break; }
      if (papelOp === 'LINHA') { nivel = 'LINHA'; continue; }
      fim = { codigoResultado: papelOp, tipoAValidar: null, motivo: 'PREDOMINANCIA', regra: n + '_PREDOMINANCIA_' + papelOp, papeisDetectados: papeis };
      break;
    }
    if (!sims.length) {
      if (n === 'N2') continue;                 /* candidato a Plataforma: nada confirmado */
      fim = AV('EVIDENCIA_INSUFICIENTE', 'SEM_PAPEL', n + '_SEM_PAPEL', []); break;
    }
    if (sims[0] === 'O1') { nivel = 'LINHA'; continue; }
    fim = { codigoResultado: PAPEL[sims[0]], tipoAValidar: null, motivo: 'PAPEL_UNICO', regra: n + '_' + PAPEL[sims[0]], papeisDetectados: [PAPEL[sims[0]]] };
    break;
  }
  const fora = ORDEM.filter((n) => alc.indexOf(n) === -1).reduce((a, n) => a.concat(NIV[n].filter((q) => resp(q) === S)), []);
  if (fora.length) fim = Object.assign(AV('INCOERENCIA', 'SIM_FORA_DO_CAMINHO', 'DEF_SIM_FORA_DO_CAMINHO', fora.map((q) => PAPEL[q])), { perguntasForaDoCaminho: fora });
  const nc = fim.codigoResultado === 'A_VALIDAR' && !fora.length ? nivel : null;
  return { codigoResultado: fim.codigoResultado, tipoAValidar: fim.tipoAValidar, motivo: fim.motivo, nivelConfirmado: nc, papeisDetectados: fim.papeisDetectados,
    regra: fim.regra, versaoMotor: 2, liberaSquad: fim.codigoResultado === 'A_VALIDAR' ? (nc === 'LINHA' || nc === 'PLATAFORMA') : LINHA_SQUAD[fim.codigoResultado],
    niveisAlcancados: alc, perguntasForaDoCaminho: fim.perguntasForaDoCaminho || [] };
}

console.log('\n== A. Definições embarcadas, v2 inativa, sem texto humano ==');
afirma(N.validarDefinicao(V1).valida, 'v1 passa em validarDefinicao', JSON.stringify(N.validarDefinicao(V1).erros));
afirma(N.validarDefinicao(V2).valida, 'v2 passa em validarDefinicao', JSON.stringify(N.validarDefinicao(V2).erros));
afirma(N.versaoEmVigor() === 1 && JSON.stringify(M.versoes()) === '[1]' && M.versaoAtual() === 1, 'em vigor continua a 1 (núcleo e motor legado); a v2 só existe no núcleo');
afirma(V2.versao === 2 && V2.desde === null, 'a v2 nunca entrou em vigor (desde = null)');
const fonte = fs.readFileSync(path.join(RAIZ, 'motor-posicionamento-nucleo.js'), 'utf8');
const textosAprovados = ['integrar continuamente', 'trabalho especializado que a própria', 'desenvolver conhecimento, práticas', 'estratégia para clientes ou participantes',
  'resultado de negócio de um Produto', 'meios reutilizáveis de interação', 'capacidade de negócio reutilizável', 'capacidade tecnológica reutilizável',
  'capacidades internas de gestão', 'mesma responsabilidade ou estamos', 'Onde acontece predominantemente', 'Resultado integrado e contínuo', 'Não é possível determinar'];
afirma(textosAprovados.every((t) => fonte.toLowerCase().indexOf(t.toLowerCase()) === -1), 'nenhuma redação de O1–O9, D1 ou D2 no núcleo (o texto é do questionário)');
const chavesDe = (o, out) => { if (o && typeof o === 'object') Object.keys(o).forEach((k) => { out.push(k); chavesDe(o[k], out); }); return out; };
const chavesTexto = chavesDe(V2, []).concat(chavesDe(V1, [])).filter((k) => /^(texto|pergunta|ajuda|rotulo|label|exemplo|interpretacao|quando|just|titulo)/i.test(k) && k !== 'perguntas');
afirma(!chavesTexto.length, 'as definições não têm campo de texto humano', chavesTexto.join(', '));

console.log('\n== B. Enumeração estruturada ==');
const E1 = N.enumerarEstados(V1), E2 = N.enumerarEstados(V2);
afirma(JSON.stringify(E2) === JSON.stringify(N.enumerarEstados(V2)) && JSON.stringify(E1) === JSON.stringify(N.enumerarEstados(V1)), 'determinística: duas enumerações idênticas, na mesma ordem');
const chave = (e) => JSON.stringify([e.respostas, e.diagnosticos, e.predominancias].map((m) => Object.keys(m).sort().map((k) => [k, m[k]])));
afirma(new Set(E1.map(chave)).size === E1.length && new Set(E2.map(chave)).size === E2.length, 'sem estado repetido (v1 ' + E1.length + ', v2 ' + E2.length + ')');
/* validade semântica de um estado: respostas só nos níveis alcançados; D1 só onde é exigido; D2 só onde é exigido, com opção oferecida */
function valido(def, e) {
  const o = av(def, e);
  if (o.tipoAValidar === 'INCOERENCIA') return false;
  const alc = o.niveisAlcancados;
  if (Object.keys(e.respostas).some((q) => alc.indexOf(Object.keys(NIV).find((n) => NIV[n].indexOf(q) !== -1)) === -1)) return false;
  const nd = N.diagnosticosNecessarios(def, e.respostas, e.diagnosticos, e.predominancias);
  if (Object.keys(e.diagnosticos).some((n) => nd.indexOf(n) === -1)) return false;
  const np = N.predominanciasNecessarias(def, e.respostas, e.diagnosticos, e.predominancias);
  return Object.keys(e.predominancias).every((n) => { const x = np.find((y) => y.nivel === n); return x && x.opcoes.indexOf(e.predominancias[n]) !== -1; });
}
afirma(E1.every((e) => valido(V1, e)) && E2.every((e) => valido(V2, e)), 'todo estado enumerado é semanticamente válido (nada fora do caminho, diagnóstico só onde é exigido)');
afirma(E2.every((e) => Object.keys(e.diagnosticos).every((n) => NIV[n].filter((q) => e.respostas[q] === S).length >= 2)), 'v2: D1 só existe em nível com 2 ou mais SIM');
afirma(E2.every((e) => Object.keys(e.predominancias).every((n) => e.diagnosticos[n] === 'mesma' &&
  (e.predominancias[n] === 'NAO_DETERMINAVEL' || NIV[n].filter((q) => e.respostas[q] === S).map((q) => PAPEL[q]).indexOf(D2[n][e.predominancias[n]]) !== -1))), 'v2: D2 só depois de D1 "mesma", e só com opção de papel que recebeu SIM');
/* completude da enumeração: filtro independente por força bruta */
const VR = [S, X, null], VD = ['mesma', 'distintas', null], P = ['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7', 'O8', 'O9'];
function forca(def, comD2) {
  let n = 0;
  for (let a = 0; a < 19683; a++) {
    const r = {}; let x = a;
    for (let i = 0; i < 9; i++) { const v = VR[x % 3]; x = Math.floor(x / 3); if (v) r[P[i]] = v; }
    for (let g = 0; g < 27; g++) {
      const d = {}; let y = g;
      ORDEM.forEach((k) => { const v = VD[y % 3]; y = Math.floor(y / 3); if (v) d[k] = v; });
      /* D2: em cada nível com D1 "mesma", ausente ou qualquer opção do nível (inclusive as que não teriam SIM) */
      let ps = [{}];
      if (comD2) ORDEM.forEach((k) => { if (d[k] !== 'mesma') return; const ops = Object.keys(D2[k]).concat(['NAO_DETERMINAVEL']); ps = ps.reduce((acc, base) => acc.concat([base], ops.map((o) => Object.assign({}, base, { [k]: o }))), []); });
      ps.forEach((pp) => { if (valido(def, { respostas: r, diagnosticos: d, predominancias: pp })) n++; });
    }
  }
  return n;
}
const f1 = forca(V1, false), f2 = forca(V2, true);
afirma(f1 === E1.length, 'v1: a enumeração tem exatamente os ' + f1 + ' estados válidos do espaço de 531.441 (força bruta: ' + f1 + ')');
afirma(f2 === E2.length, 'v2: a enumeração tem exatamente os ' + f2 + ' estados válidos (força bruta sobre 531.441 × opções de D2: ' + f2 + ')');
afirma(E1.every((e) => canon(av(V1, e)) === canon(M.avaliar(e.respostas, e.diagnosticos))), 'v1: em todo estado enumerado, o núcleo = o motor legado');
const concluiveis1 = E1.filter((e) => { const o = av(V1, e); return ['RESPOSTA_FALTANDO', 'DIAGNOSTICO_PENDENTE'].indexOf(o.motivo) === -1; }).length;
afirma(concluiveis1 === 36, 'v1: 36 estados concluíveis, como regras-posicionamento-tabela.js (' + concluiveis1 + ')');

console.log('\n== C. A tabela da v2 (oráculo da especificação) ==');
let ok2 = 0, ex2 = null;
E2.forEach((e) => { const a = av(V2, e), b = esperadoV2(e.respostas, e.diagnosticos, e.predominancias); if (canon(a) === canon(b)) ok2++; else if (!ex2) ex2 = { e, nucleo: a, esperado: b }; });
afirma(ok2 === E2.length, 'v2 = oráculo em ' + ok2 + '/' + E2.length + ' estados válidos (objeto completo)', JSON.stringify(ex2));
const regrasVistas = {}, motivosVistos = {}, porRotulo = {};
E2.forEach((e) => { const o = av(V2, e); regrasVistas[o.regra] = true; motivosVistos[o.motivo] = true; const l = o.codigoResultado === 'A_VALIDAR' ? 'A_VALIDAR/' + o.tipoAValidar : o.codigoResultado; porRotulo[l] = (porRotulo[l] || 0) + 1; });
afirma(V2.regras.filter((r) => r !== 'DEF_SIM_FORA_DO_CAMINHO').every((r) => regrasVistas[r]) && Object.keys(regrasVistas).every((r) => V2.regras.indexOf(r) !== -1), 'todas as regras da v2 (menos a de incoerência) são alcançadas por estados válidos, e nenhuma fora do catálogo');
afirma(JSON.stringify(Object.keys(motivosVistos).sort()) === JSON.stringify(V2.motivos.filter((m) => m !== 'SIM_FORA_DO_CAMINHO').sort()), 'motivos da v2 alcançados: ' + Object.keys(motivosVistos).sort().join(', '));
afirma(!motivosVistos.TRES_OU_MAIS_PAPEIS && !motivosVistos.DIAGNOSTICO_MESMA && V2.motivos.indexOf('TRES_OU_MAIS_PAPEIS') === -1 && V2.motivos.indexOf('DIAGNOSTICO_MESMA') === -1, 'TRES_OU_MAIS_PAPEIS e DIAGNOSTICO_MESMA não são semântica da v2 (continuam só na v1 histórica)');
afirma(Object.keys(LINHA_SQUAD).every((c) => porRotulo[c] > 0) && ['RECORTE', 'CONFLITO', 'EVIDENCIA_INSUFICIENTE'].every((t) => porRotulo['A_VALIDAR/' + t] > 0), 'os 8 firmes e os 3 tipos de A_VALIDAR alcançáveis por estado válido aparecem');

console.log('\n== D. Casos nomeados ==');
const caso = (rot, r, d, p, espera) => {
  const o = N.avaliar(V2, r, d || {}, p || {}), o2 = esperadoV2(r, d || {}, p || {});
  const ok = canon(o) === canon(o2) && Object.keys(espera).every((k) => JSON.stringify(o[k]) === JSON.stringify(espera[k]));
  afirma(ok, rot, JSON.stringify(o));
};
const L = { O1: S, O2: X, O3: X }, PL = Object.assign({ O4: X, O5: X }, L), N3 = (o6, o7, o8, o9) => Object.assign({ O6: o6, O7: o7, O8: o8, O9: o9 }, PL);
caso('N1 0 SIM → sem papel', { O1: X, O2: X, O3: X }, {}, {}, { motivo: 'SEM_PAPEL', liberaSquad: false });
caso('N1 só O2 → Área Especializada', { O1: X, O2: S, O3: X }, {}, {}, { codigoResultado: 'AREA_ESPECIALIZADA', motivo: 'PAPEL_UNICO', liberaSquad: false });
caso('N1 só O3 → CoE', { O1: X, O2: X, O3: S }, {}, {}, { codigoResultado: 'COE', liberaSquad: false });
caso('N1 2 SIM sem D1 → diagnóstico pendente', { O1: S, O2: S, O3: X }, {}, {}, { motivo: 'DIAGNOSTICO_PENDENTE' });
caso('N1 2 SIM, distintas → recorte', { O1: S, O2: S, O3: X }, { N1: 'distintas' }, {}, { tipoAValidar: 'RECORTE', motivo: 'DIAGNOSTICO_DISTINTAS' });
caso('N1 2 SIM, mesma, D2 ausente → predominância pendente (D2 não é pulado)', { O1: X, O2: S, O3: S }, { N1: 'mesma' }, {}, { motivo: 'PREDOMINANCIA_PENDENTE', regra: 'N1_PREDOMINANCIA_PENDENTE' });
caso('N1 mesma, D2 = execução especializada → Área Especializada', { O1: X, O2: S, O3: S }, { N1: 'mesma' }, { N1: 'EXECUCAO_ESPECIALIZADA' }, { codigoResultado: 'AREA_ESPECIALIZADA', motivo: 'PREDOMINANCIA', liberaSquad: false, papeisDetectados: ['AREA_ESPECIALIZADA', 'COE'] });
caso('N1 mesma, D2 = capacidade nos outros → CoE', { O1: X, O2: S, O3: S }, { N1: 'mesma' }, { N1: 'CAPACIDADE_NOS_OUTROS' }, { codigoResultado: 'COE', liberaSquad: false });
caso('N1 mesma, D2 = resultado integrado → Linha, segue para N2', { O1: S, O2: S, O3: X }, { N1: 'mesma' }, { N1: 'RESULTADO_INTEGRADO' }, { regra: 'N2_RESPOSTA_FALTANDO', nivelConfirmado: 'LINHA', niveisAlcancados: ['N1', 'N2'] });
caso('N1 mesma, D2 = não é possível determinar → conflito', { O1: S, O2: S, O3: X }, { N1: 'mesma' }, { N1: 'NAO_DETERMINAVEL' }, { tipoAValidar: 'CONFLITO', motivo: 'PREDOMINANCIA_INDEFINIDA', nivelConfirmado: null });
caso('N1 D2 escolhendo papel SEM SIM (CoE com O3 = NAO) → pendente, nunca CoE', { O1: S, O2: S, O3: X }, { N1: 'mesma' }, { N1: 'CAPACIDADE_NOS_OUTROS' }, { motivo: 'PREDOMINANCIA_PENDENTE' });
caso('N1 D2 com opção de outro nível → pendente', { O1: S, O2: S, O3: X }, { N1: 'mesma' }, { N1: 'RESULTADO_DE_NEGOCIO' }, { motivo: 'PREDOMINANCIA_PENDENTE' });
caso('N1 3 SIM NÃO é recorte direto: sem D1 → pendente', { O1: S, O2: S, O3: S }, {}, {}, { motivo: 'DIAGNOSTICO_PENDENTE' });
caso('N1 3 SIM, mesma, D2 = CoE → CoE', { O1: S, O2: S, O3: S }, { N1: 'mesma' }, { N1: 'CAPACIDADE_NOS_OUTROS' }, { codigoResultado: 'COE', papeisDetectados: ['LINHA', 'AREA_ESPECIALIZADA', 'COE'] });
caso('N1 3 SIM, distintas → recorte', { O1: S, O2: S, O3: S }, { N1: 'distintas' }, {}, { tipoAValidar: 'RECORTE' });
caso('N2 só O4 → Estratégia de Clientes', Object.assign({ O4: S, O5: X }, L), {}, {}, { codigoResultado: 'ESTRATEGIA_CLIENTES', liberaSquad: true });
caso('N2 só O5 → Negócios', Object.assign({ O4: X, O5: S }, L), {}, {}, { codigoResultado: 'NEGOCIOS', liberaSquad: true });
caso('N2 2 SIM, mesma, D2 = resultado de negócio → Negócios', Object.assign({ O4: S, O5: S }, L), { N2: 'mesma' }, { N2: 'RESULTADO_DE_NEGOCIO' }, { codigoResultado: 'NEGOCIOS', motivo: 'PREDOMINANCIA' });
caso('N2 2 SIM, mesma, não é possível determinar → conflito com Linha confirmada', Object.assign({ O4: S, O5: S }, L), { N2: 'mesma' }, { N2: 'NAO_DETERMINAVEL' }, { tipoAValidar: 'CONFLITO', nivelConfirmado: 'LINHA', liberaSquad: true });
caso('N2 0 SIM → só segue para N3 (incompleto lá): Plataforma NÃO confirmada', PL, {}, {}, { regra: 'N3_RESPOSTA_FALTANDO', nivelConfirmado: 'LINHA', niveisAlcancados: ['N1', 'N2', 'N3'] });
caso('N3 0 SIM → sem papel, nível confirmado LINHA (Plataforma não caracterizada)', N3(X, X, X, X), {}, {}, { motivo: 'SEM_PAPEL', nivelConfirmado: 'LINHA', liberaSquad: true });
caso('N3 só O8 → Habilitadora de Tecnologia', N3(X, X, S, X), {}, {}, { codigoResultado: 'PLATAFORMA_HABILITADORA_TECNOLOGIA', liberaSquad: true });
caso('N3 incompleto com 1 SIM → Plataforma já confirmada', Object.assign({ O6: S }, PL), {}, {}, { motivo: 'RESPOSTA_FALTANDO', nivelConfirmado: 'PLATAFORMA' });
caso('N3 2 SIM, distintas → recorte (Plataforma)', N3(S, S, X, X), { N3: 'distintas' }, {}, { tipoAValidar: 'RECORTE', nivelConfirmado: 'PLATAFORMA' });
caso('N3 3 SIM, mesma, D2 = capacidade de negócio → Habilitadora de Negócios', N3(S, S, S, X), { N3: 'mesma' }, { N3: 'CAPACIDADE_DE_NEGOCIO' }, { codigoResultado: 'PLATAFORMA_HABILITADORA_NEGOCIOS', motivo: 'PREDOMINANCIA' });
caso('N3 4 SIM, mesma, D2 = interna corporativa → Corporativa', N3(S, S, S, S), { N3: 'mesma' }, { N3: 'CAPACIDADE_INTERNA_CORPORATIVA' }, { codigoResultado: 'PLATAFORMA_CORPORATIVA' });
caso('N3 4 SIM, mesma, não é possível determinar → conflito (Plataforma)', N3(S, S, S, S), { N3: 'mesma' }, { N3: 'NAO_DETERMINAVEL' }, { tipoAValidar: 'CONFLITO', nivelConfirmado: 'PLATAFORMA' });
caso('N3 3 SIM + 1 ausente → incompleto (completude antes de D1)', Object.assign({ O6: S, O7: S, O8: S }, PL), { N3: 'mesma' }, { N3: 'CAPACIDADE_DE_NEGOCIO' }, { motivo: 'RESPOSTA_FALTANDO' });
caso('incoerência: Área por predominância + O4 = SIM', { O1: S, O2: S, O3: X, O4: S }, { N1: 'mesma' }, { N1: 'EXECUCAO_ESPECIALIZADA' }, { tipoAValidar: 'INCOERENCIA', perguntasForaDoCaminho: ['O4'] });
caso('Linha por predominância + N2 respondido = sem incoerência', { O1: S, O2: S, O3: X, O4: S, O5: X }, { N1: 'mesma' }, { N1: 'RESULTADO_INTEGRADO' }, { codigoResultado: 'ESTRATEGIA_CLIENTES' });

console.log('\n== E. Linha × Squad ==');
let firmes = 0, firmesOk = 0, avOk = 0, avN = 0;
E2.forEach((e) => { const o = av(V2, e); if (o.codigoResultado in LINHA_SQUAD) { firmes++; if (o.liberaSquad === LINHA_SQUAD[o.codigoResultado]) firmesOk++; } else { avN++; if (o.liberaSquad === (o.nivelConfirmado === 'LINHA' || o.nivelConfirmado === 'PLATAFORMA')) avOk++; } });
afirma(firmes > 0 && firmesOk === firmes, 'v2: nos ' + firmes + ' resultados firmes, liberaSquad = tabela literal (' + firmesOk + ')');
afirma(avOk === avN, 'v2: nos ' + avN + ' A_VALIDAR, liberaSquad só com nível LINHA/PLATAFORMA confirmado (' + avOk + ')');

console.log('\n== F. Incoerência e ausência ==');
let inc = 0, incOk = 0;
E2.forEach((e) => {
  const alc = av(V2, e).niveisAlcancados;
  ORDEM.filter((n) => alc.indexOf(n) === -1).forEach((n) => NIV[n].forEach((q) => {
    const f = js(e); f.respostas[q] = S; inc++;
    const o = av(V2, f);
    if (o.tipoAValidar === 'INCOERENCIA' && o.perguntasForaDoCaminho.indexOf(q) !== -1 && canon(o) === canon(esperadoV2(f.respostas, f.diagnosticos, f.predominancias))) incOk++;
  }));
});
afirma(inc > 0 && incOk === inc, 'um SIM fora do caminho em qualquer estado válido → incoerência, que vence qualquer conclusão (' + incOk + '/' + inc + ')');
let aus = 0, ausOk = 0;
E2.forEach((e) => {
  const o = av(V2, e);
  if (o.motivo === 'RESPOSTA_FALTANDO') return;
  Object.keys(e.respostas).filter((q) => e.respostas[q] === X).forEach((q) => {
    const f = js(e); delete f.respostas[q]; aus++;
    /* o nível dela fica incompleto: resposta faltando — ou incoerência, se níveis seguintes tinham SIM (eles saem do caminho) */
    const g = av(V2, f);
    if ((g.motivo === 'RESPOSTA_FALTANDO' || g.tipoAValidar === 'INCOERENCIA') && canon(g) !== canon(o) && canon(g) === canon(esperadoV2(f.respostas, f.diagnosticos, f.predominancias))) ausOk++;
  });
});
afirma(aus > 0 && ausOk === aus, 'tirar um NAO de um nível alcançado nunca mantém a conclusão (resposta faltando, ou incoerência do que ficou fora do caminho): ausência ≠ NAO (' + ausOk + '/' + aus + ')');

console.log('\n== G. simular(v1, v2) ==');
const sim = N.simular(V1, V2), sim2 = N.simular(V1, V2);
afirma(JSON.stringify(sim) === JSON.stringify(sim2), 'determinística');
afirma(sim.totalEstados === new Set(E1.concat(E2).map(chave)).size && sim.mantidos + sim.alterados === sim.totalEstados, 'compara a união dos estados das duas versões (' + sim.totalEstados + '), mantidos + alterados = total');
afirma(sim.violacoesLinhaSquad === 0, 'nenhum resultado das duas versões viola Linha × Squad');
const T = Object.values(sim.transicoes);
afirma(T.every((t) => t.exemplos.length && t.exemplos.every((x) => { const a = av(V1, x.estado), b = av(V2, x.estado); const l = (o) => o.codigoResultado === 'A_VALIDAR' ? 'A_VALIDAR/' + o.tipoAValidar : o.codigoResultado; return l(a) === t.de && l(b) === t.para; })), 'todo exemplo reproduz a sua transição (origem → destino)');
afirma(!!sim.transicoes['A_VALIDAR/CONFLITO → A_VALIDAR/EVIDENCIA_INSUFICIENTE'] && !!sim.transicoes['A_VALIDAR/RECORTE → A_VALIDAR/EVIDENCIA_INSUFICIENTE'], 'mudanças esperadas aparecem: "mesma" e 3+ SIM passam a pedir mais diagnóstico');
const DIFF = require('./diff-motor-posicionamento-v1-v2.js');
const doc = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'motor-posicionamento-v1-v2.md'), 'utf8');
afirma(doc === DIFF.relatorio(N), 'docs/motor-posicionamento-v1-v2.md é exatamente o que diff-motor-posicionamento-v1-v2.js gera hoje (reproduzível)');

console.log('\n== H. Contrato motor × conteúdo do questionário ==');
const c1 = N.contratoDoQuestionario(V1), c2 = N.contratoDoQuestionario(V2);
afirma(JSON.stringify(c1.itens.map((i) => i.codigoEstavel)) === JSON.stringify(P.concat(['DIAG_CONFLITO_RECORTE'])), 'v1 exige O1–O9 + DIAG_CONFLITO_RECORTE');
afirma(JSON.stringify(c2.itens.map((i) => i.codigoEstavel)) === JSON.stringify(P.concat(['DIAG_CONFLITO_RECORTE', 'DIAG_PREDOMINANCIA_N1', 'DIAG_PREDOMINANCIA_N2', 'DIAG_PREDOMINANCIA_N3'])), 'v2 exige O1–O9 + D1 + D2 por nível');
afirma(c2.itens.filter((i) => i.opcoes).every((i) => { const n = i.codigoEstavel.slice(-2); return JSON.stringify(i.opcoes.slice().sort()) === JSON.stringify(Object.keys(D2[n]).concat(['NAO_DETERMINAVEL']).sort()); }), 'v2: as opções exigidas de cada D2 são as do nível + NAO_DETERMINAVEL');
/* conteúdo = o formato do questionário (questionarios-config.js): perguntas com codigoEstavel, tipo, texto livre */
const conteudo = (contrato, extra) => Object.assign({ codigo: 'POSICIONAMENTO_ORGANIZACIONAL', versao: 7, publicado: true,
  perguntas: contrato.itens.map((i) => Object.assign({ codigoEstavel: i.codigoEstavel, tipo: i.tipo === 'binaria' ? 'binaria' : i.tipo, texto: 'Texto livre de ' + i.codigoEstavel },
    i.opcoes ? { opcoes: i.opcoes.map((o) => ({ codigo: o, rotulo: 'Rótulo livre ' + o })) } : {})) }, extra || {});
const ok = (def, c) => N.conteudoCompativel(def, c).compativel;
const cod = (def, c) => N.conteudoCompativel(def, c).erros.map((e) => e.codigo);
afirma(ok(V2, conteudo(c2, { motorCompativel: 2 })), 'v2 + conteúdo com a estrutura exata e vínculo 2 → compatível');
afirma(ok(V1, conteudo(c1)), 'v1 + conteúdo legado (sem vínculo) com a estrutura v1 → compatível');
afirma(!ok(V2, conteudo(c2)) && cod(V2, conteudo(c2)).indexOf('C_VINCULO') !== -1, 'v2 + conteúdo sem vínculo (legado) → incompatível: legado só serve à v1');
afirma(!ok(V1, conteudo(c1, { motorCompativel: 2 })), 'v1 + conteúdo vinculado ao 2 → incompatível');
afirma(!ok(V2, conteudo(c1, { motorCompativel: 2 })), 'v2 + estrutura da v1 (sem D2) com vínculo 2 → incompatível (falta D2)');
const mexe = (fn) => { const c = conteudo(c2, { motorCompativel: 2 }); fn(c); return c; };
afirma(cod(V2, mexe((c) => { c.perguntas = c.perguntas.filter((p) => p.codigoEstavel !== 'O7'); })).indexOf('C_FALTANDO') !== -1, 'faltando O7 → incompatível');
afirma(cod(V2, mexe((c) => { c.perguntas.push({ codigoEstavel: 'O10', tipo: 'binaria', texto: 'x' }); })).indexOf('C_SOBRANDO') !== -1, 'sobrando O10 → incompatível');
afirma(cod(V2, mexe((c) => { c.perguntas.push(js(c.perguntas[0])); })).indexOf('C_DUPLICADO') !== -1, 'O1 repetida → incompatível');
afirma(cod(V2, mexe((c) => { c.perguntas.find((p) => p.codigoEstavel === 'O3').tipo = 'diagnostico-predominancia'; })).indexOf('C_TIPO') !== -1, 'tipo de O3 trocado → incompatível');
afirma(cod(V2, mexe((c) => { c.perguntas.find((p) => p.codigoEstavel === 'DIAG_CONFLITO_RECORTE').tipo = 'binaria'; })).indexOf('C_TIPO') !== -1, 'tipo de D1 trocado → incompatível');
afirma(cod(V2, mexe((c) => { c.perguntas.find((p) => p.codigoEstavel === 'DIAG_PREDOMINANCIA_N1').opcoes.pop(); })).indexOf('C_OPCOES') !== -1, 'D2 do N1 sem uma opção → incompatível');
afirma(cod(V2, mexe((c) => { c.perguntas.find((p) => p.codigoEstavel === 'DIAG_PREDOMINANCIA_N2').opcoes.push({ codigo: 'CAPACIDADE_TECNOLOGICA' }); })).indexOf('C_OPCOES') !== -1, 'D2 do N2 com opção de outro nível → incompatível');
afirma(cod(V2, mexe((c) => { const o = c.perguntas.find((p) => p.codigoEstavel === 'DIAG_PREDOMINANCIA_N3').opcoes; o.push(js(o[0])); })).indexOf('C_OPCOES') !== -1, 'D2 do N3 com opção repetida → incompatível');
afirma(cod(V2, mexe((c) => { c.perguntas.find((p) => p.codigoEstavel === 'O2').opcoes = [{ codigo: 'X' }]; })).indexOf('C_OPCOES') !== -1, 'binária com opções → incompatível');
afirma(cod(V2, mexe((c) => { c.codigo = 'ADEQUACAO_SQUAD'; })).indexOf('C_QUESTIONARIO') !== -1, 'outro questionário → incompatível');
afirma(ok(V2, mexe((c) => { c.perguntas.forEach((p) => { p.texto = 'Redação totalmente outra'; p.textoAjuda = { significado: 'qualquer' }; (p.opcoes || []).forEach((o) => { o.rotulo = 'outro rótulo'; }); }); })), 'trocar TODO o texto (pergunta, ajuda, rótulos) não muda a compatibilidade: o texto é livre');
/* o conteúdo de fábrica que o site usa hoje (questionarios-config.js) é legado e serve só à v1 */
const ctx = { console, JSON, Object, Array, String, Math, Number, Date, RegExp, Error };
ctx.window = ctx; ctx.firebase = { database: () => ({ ref: () => ({ on() {}, off() {}, once() { return Promise.resolve({ val: () => null }); } }) }) };
vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(RAIZ, 'questionarios-config.js'), 'utf8'), ctx);
const fabrica = { codigo: 'POSICIONAMENTO_ORGANIZACIONAL', perguntas: js(ctx.faQuestionarios.perguntasDaVersao('POSICIONAMENTO_ORGANIZACIONAL', 1)) };
afirma(fabrica.perguntas.length === 10 && ok(V1, fabrica), 'o conteúdo publicado hoje (fábrica, versão 1) é compatível com a v1', JSON.stringify(N.conteudoCompativel(V1, fabrica).erros));
afirma(!ok(V2, fabrica), '…e NÃO com a v2 (sem vínculo e sem D2)');
console.log('  —— podeEntrarEmVigor (sem fallback) ——');
const pv = (def, lista) => N.podeEntrarEmVigor(def, lista);
afirma(!pv(V2, []).pode && pv(V2, []).motivo === 'sem-conteudo-publicado', 'v2 sem nenhum conteúdo publicado → não pode entrar em vigor');
afirma(!pv(V2, [Object.assign(js(fabrica), { publicado: true, versao: 1 })]).pode, 'v2 com só o conteúdo v1 publicado → não pode (nada de fallback para texto v1/fábrica)');
afirma(!pv(V2, [conteudo(c2, { motorCompativel: 2, publicado: false })]).pode, 'v2 com conteúdo compatível só em RASCUNHO → não pode');
afirma(!pv(V2, [mexe((c) => { c.perguntas.pop(); })]).pode, 'v2 com conteúdo publicado mas incompleto → não pode');
afirma(pv(V2, [Object.assign(js(fabrica), { publicado: true, versao: 1 }), conteudo(c2, { motorCompativel: 2 })]).pode && pv(V2, [conteudo(c2, { motorCompativel: 2 })]).conteudo === 7, 'v2 com conteúdo publicado, exato e vinculado → pode (e diz qual)');
afirma(pv(V1, [Object.assign(js(fabrica), { publicado: true, versao: 1 })]).pode, 'v1 com o conteúdo legado publicado → pode (compatibilidade histórica)');
afirma(!pv(Object.assign(js(V2), { liberaSquad: {} }), [conteudo(c2, { motorCompativel: 2 })]).pode, 'definição inválida nunca entra em vigor');

console.log('\n== I. validarDefinicao recusa cada violação das regras fixas ==');
function recusa(rot, mut, codigoErro) {
  const d = js(V2); mut(d);
  const r = N.validarDefinicao(d);
  afirma(!r.valida && r.erros.some((e) => e.codigo === codigoErro), rot + ' → ' + codigoErro, JSON.stringify(r.erros.slice(0, 3)));
}
const nv = (d, id) => d.niveis.find((n) => n.id === id);
recusa('3+ SIM como recorte direto (tresOuMais na v2)', (d) => { nv(d, 'N1').tresOuMais = { tipo: 'RECORTE', motivo: 'TRES_OU_MAIS_PAPEIS', regra: 'N1_RECORTE' }; }, 'E_D1');
recusa('D1 "mesma" pulando D2 (vira conflito direto) com D2 declarado', (d) => { nv(d, 'N1').diagnostico.mesma = { tipo: 'CONFLITO', motivo: 'DIAGNOSTICO_MESMA', regra: 'N1_CONFLITO' }; }, 'E_D2');
recusa('D1 "distintas" virando conflito', (d) => { nv(d, 'N2').diagnostico.distintas.tipo = 'CONFLITO'; }, 'E_DESFECHO');
recusa('D2 "não é possível determinar" virando recorte', (d) => { nv(d, 'N3').predominancia.indeterminado.tipo = 'RECORTE'; }, 'E_DESFECHO');
recusa('opção de D2 apontando para outro papel (resultado integrado → CoE: transversalidade/integração vira CoE)', (d) => { nv(d, 'N1').predominancia.opcoes[0] = { codigo: 'RESULTADO_INTEGRADO', papel: 'COE', regra: 'N1_X' }; }, 'E_D2');
recusa('opção de D2 de outro nível', (d) => { nv(d, 'N2').predominancia.opcoes.push({ codigo: 'CAPACIDADE_TECNOLOGICA', papel: 'PLATAFORMA_HABILITADORA_TECNOLOGIA', regra: 'N2_X' }); }, 'E_D2');
recusa('opção de D2 faltando', (d) => { nv(d, 'N3').predominancia.opcoes.pop(); }, 'E_D2');
recusa('O3 sinalizando outra coisa que CoE (significado fixo)', (d) => { nv(d, 'N1').perguntas[2].papel = 'AREA_ESPECIALIZADA'; }, 'E_SINAL');
recusa('O4 movida para o N1', (d) => { nv(d, 'N1').perguntas.push(nv(d, 'N2').perguntas.shift()); }, 'E_SINAL');
recusa('código de pergunta duplicado', (d) => { nv(d, 'N3').perguntas[1] = Object.assign({}, nv(d, 'N3').perguntas[0]); }, 'E_CODIGO_DUPLICADO');
recusa('código de opção de D2 duplicado', (d) => { nv(d, 'N3').predominancia.opcoes[1] = Object.assign({}, nv(d, 'N3').predominancia.opcoes[0]); }, 'E_CODIGO_DUPLICADO');
recusa('N2 sem SIM confirmando Plataforma', (d) => { nv(d, 'N2').semSim = { desce: true, confirma: 'PLATAFORMA' }; }, 'E_PLATAFORMA');
recusa('N2 confirmando Plataforma com SIM', (d) => { nv(d, 'N2').confirmaComSim = 'PLATAFORMA'; }, 'E_PLATAFORMA');
recusa('N3 sem SIM concluindo como firme', (d) => { nv(d, 'N3').semSim = { desce: true }; }, 'E_SEM_PAPEL');
recusa('LINHA como resultado firme', (d) => { nv(d, 'N1').perguntas[0] = { codigo: 'O1', papel: 'LINHA', regraUnico: 'N1_LINHA' }; }, 'E_INTERMEDIARIO');
recusa('hierarquia fora de ordem', (d) => { d.niveis.reverse(); }, 'E_HIERARQUIA');
recusa('completude desligada (resposta faltando vira recorte)', (d) => { nv(d, 'N2').respostaFaltando.tipo = 'RECORTE'; }, 'E_DESFECHO');
recusa('incoerência rebaixada a conflito', (d) => { d.incoerencia.tipo = 'CONFLITO'; }, 'E_DESFECHO');
recusa('tipo de A_VALIDAR fora do catálogo', (d) => { nv(d, 'N1').predominancia.pendente.tipo = 'DUVIDA'; }, 'E_TIPO');
recusa('motivo fora do catálogo', (d) => { nv(d, 'N1').diagnostico.ausente.motivo = 'QUALQUER'; }, 'E_MOTIVO');
recusa('regra usada fora do catálogo', (d) => { nv(d, 'N2').perguntas[0].regraUnico = 'N2_OUTRA'; }, 'E_REGRA');
recusa('mesma regra em dois desfechos', (d) => { nv(d, 'N2').perguntas[1].regraUnico = 'N2_ESTRATEGIA_CLIENTES'; }, 'E_REGRA');
recusa('configurar liberaSquad na definição', (d) => { d.liberaSquad = { COE: true }; }, 'E_LINHA_SQUAD');
recusa('configurar o ramo Linha na definição', (d) => { nv(d, 'N3').ramoLinha = ['COE']; }, 'E_LINHA_SQUAD');
recusa('texto humano na definição (pergunta)', (d) => { nv(d, 'N1').perguntas[0].texto = 'Essa responsabilidade exige…'; }, 'E_CAMPO_DESCONHECIDO');
recusa('texto humano na definição (rótulo de opção)', (d) => { nv(d, 'N1').predominancia.opcoes[1].rotulo = 'Execução direta'; }, 'E_CAMPO_DESCONHECIDO');
recusa('código de D1 trocado', (d) => { d.diagnostico.codigo = 'DIAG_OUTRO'; }, 'E_D1');
recusa('função na definição (não determinística)', (d) => { d.versao = 2; d.niveis[0].semSim = { aValidar: Object.assign(nv(d, 'N1').semSim.aValidar, { regra: () => 'N1_SEM_PAPEL' }) }; }, 'E_DADOS');
recusa('versão inválida', (d) => { d.versao = 2.5; }, 'E_VERSAO');
{
  const d = js(V1); d.niveis[0].diagnostico.mesma = { predominancia: true };
  const r = N.validarDefinicao(d);
  afirma(!r.valida && r.erros.some((e) => e.codigo === 'E_D1' || e.codigo === 'E_D2'), 'v1 com D2 mas D1 só para exatamente 2 SIM → recusada', JSON.stringify(r.erros.slice(0, 2)));
}

console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
process.exit(falhas ? 1 : 0);
