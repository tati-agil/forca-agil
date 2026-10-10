/* NÚCLEO DECLARATIVO DO MOTOR DE POSICIONAMENTO (H1.1) — a v1 como dados reproduz EXATAMENTE o motor atual.
 *
 * Sem navegador, sem rede, sem histórico Git. A referência comportamental é forca-agil/motor-posicionamento.js:
 *   A. os 531.441 estados (O1–O9 em SIM/NAO/ausente × diagnóstico N1–N3 em mesma/distintas/ausente): a saída do
 *      núcleo com a definição v1 é IDÊNTICA à do motor, objeto completo (as 10 chaves, valores e tipos), e o
 *      digest das saídas do núcleo é o mesmo digest congelado de teste-motor-posicionamento-api.js;
 *   B. perguntasDoCaminho igual à do motor em todos os estados; diagnosticosNecessarios igual ao
 *      diagnosticoNecessario da tela (avaliacao-posicionamento.js) em todos os estados e níveis;
 *   C. catálogo idêntico: níveis, perguntas, papéis, regras, motivos, códigos firmes/intermediários, tipos;
 *   D. invariante Linha × Squad com o esperado LITERAL, e nenhuma definição carrega liberaSquad;
 *   E. casos nomeados: incompletos, incoerência, 0/1/2/3+ SIM por nível, diagnóstico mesma/distintas/ausente,
 *      resíduo fora do caminho;
 *   F. versão desconhecida e definição inválida recusadas;
 *   G. puro: definição e API congeladas, entradas não mudam, determinístico, sem DOM/Firebase/banco no arquivo.
 * FA_RAIZ (opcional) troca a pasta dos arquivos — para rodar mutantes. */
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = process.env.FA_RAIZ || path.join(__dirname, '..', '..', 'forca-agil');
const M = require(path.join(RAIZ, 'motor-posicionamento.js'));
const N = require(path.join(RAIZ, 'motor-posicionamento-nucleo.js'));
/* o MESMO digest congelado de teste-motor-posicionamento-api.js (motor do main 76e2fb8) */
const DIGEST = '010adee5fe5fddebf922313c9ec4d240890a27f9ff2a556b483ae9e9e4da95c7';
const CHAVES = ['codigoResultado', 'liberaSquad', 'motivo', 'niveisAlcancados', 'nivelConfirmado', 'papeisDetectados', 'perguntasForaDoCaminho', 'regra', 'tipoAValidar', 'versaoMotor'];

let total = 0, falhas = 0;
function afirma(cond, msg, detalhe) { total++; console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }
const canon = (o) => JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));
const P = M.PERGUNTAS, VR = ['SIM', 'NAO', null], VD = ['mesma', 'distintas', null];
function estados(cb) {
  for (let a = 0; a < 19683; a++) {
    const r = {}; let x = a;
    for (let i = 0; i < 9; i++) { const v = VR[x % 3]; x = Math.floor(x / 3); if (v) r[P[i]] = v; }
    for (let d = 0; d < 27; d++) {
      const g = {}; let y = d;
      ['N1', 'N2', 'N3'].forEach((k) => { const v = VD[y % 3]; y = Math.floor(y / 3); if (v) g[k] = v; });
      cb(r, g);
    }
  }
}
const V1 = N.definicao(1);

console.log('\n== A. Os 531.441 estados: núcleo (v1 como dados) = motor atual, objeto completo ==');
const h = crypto.createHash('sha256');
let n = 0, iguais = 0, chavesOk = 0, exemplo = null;
const regrasVistas = {}, motivosVistos = {};
estados((r, g) => {
  const a = M.avaliar(r, g), b = N.avaliar(V1, r, g);
  n++;
  if (canon(a) === canon(b)) iguais++; else if (!exemplo) exemplo = { r, g, motor: a, nucleo: b };
  if (JSON.stringify(Object.keys(b).sort()) === JSON.stringify(CHAVES)) chavesOk++;
  h.update(JSON.stringify(Object.keys(b).sort().map((k) => [k, b[k]])) + '\n');
  regrasVistas[b.regra] = true; motivosVistos[b.motivo] = true;
});
afirma(n === 531441, 'percorreu ' + n + ' estados');
afirma(iguais === n, 'saída idêntica à do motor em ' + iguais + '/' + n + ' estados (as 10 chaves, valores e tipos)', JSON.stringify(exemplo));
afirma(chavesOk === n, 'toda saída tem exatamente as 10 chaves do motor (' + chavesOk + ')');
const digest = h.digest('hex');
afirma(digest === DIGEST, 'digest das saídas do núcleo = o digest congelado do motor', digest);

console.log('\n== B. Caminho e diagnósticos necessários ==');
let caminhoIgual = 0;
estados((r, g) => { if (JSON.stringify(M.perguntasDoCaminho(r, g)) === JSON.stringify(N.perguntasDoCaminho(V1, r, g))) caminhoIgual++; });
afirma(caminhoIgual === 531441, 'perguntasDoCaminho igual à do motor em ' + caminhoIgual + '/531441');
/* a tela: diagnosticoNecessario(reg, nível) de avaliacao-posicionamento.js (núcleo sem DOM) */
const ctx = { console, JSON, Object, Array, String, Math, Number, Date, RegExp, Error, Promise, setTimeout, clearTimeout };
ctx.window = ctx;
ctx.firebase = { database: () => ({ ref: () => ({ on() {}, off() {}, once() { return Promise.resolve({ val: () => null }); } }) }) };
vm.createContext(ctx);
for (const f of ['questionarios-config.js', 'motor-posicionamento.js', 'avaliacao-posicionamento.js']) vm.runInContext(fs.readFileSync(path.join(RAIZ, f), 'utf8'), ctx, { filename: f });
const TELA = ctx.faAvaliacaoPosicionamentoNucleo;
let diagIgual = 0;
estados((r, g) => {
  const reg = { respostas: {}, diagnosticos: {} };
  Object.keys(r).forEach((q) => { reg.respostas[q] = { resposta: r[q] }; });
  Object.keys(g).forEach((k) => { reg.diagnosticos[k] = { resposta: g[k] }; });
  const tela = ['N1', 'N2', 'N3'].filter((k) => TELA.diagnosticoNecessario(reg, k));
  if (JSON.stringify(tela) === JSON.stringify(N.diagnosticosNecessarios(V1, r, g))) diagIgual++;
});
afirma(diagIgual === 531441, 'diagnosticosNecessarios igual ao diagnosticoNecessario da tela em ' + diagIgual + '/531441');

console.log('\n== C. Catálogo idêntico ao do motor ==');
afirma(JSON.stringify(V1.niveis.map((x) => ({ id: x.id, perguntas: x.perguntas.map((p) => p.codigo) }))) === JSON.stringify(M.NIVEIS), 'níveis e perguntas de cada nível');
const papeis = {}; V1.niveis.forEach((x) => x.perguntas.forEach((p) => { papeis[p.codigo] = p.papel; }));
afirma(JSON.stringify(papeis) === JSON.stringify(M.PAPEL_POR_PERGUNTA), 'o papel que o SIM de cada pergunta marca');
afirma(JSON.stringify(V1.regras) === JSON.stringify(M.REGRAS), 'as 25 regras (identificadores e descrições)');
afirma(JSON.stringify(V1.motivos) === JSON.stringify(M.MOTIVOS), 'os motivos');
afirma(JSON.stringify(V1.respostas) === JSON.stringify(M.RESPOSTAS) && JSON.stringify(V1.diagnostico.respostas) === JSON.stringify(M.RESPOSTAS_DIAGNOSTICO) && V1.diagnostico.codigo === M.DIAGNOSTICO, 'respostas, respostas do diagnóstico e o código do diagnóstico');
afirma(JSON.stringify(N.CODIGOS_FIRMES) === JSON.stringify(M.CODIGOS_FIRMES) && JSON.stringify(N.CODIGOS_INTERMEDIARIOS) === JSON.stringify(M.CODIGOS_INTERMEDIARIOS) && JSON.stringify(N.TIPOS_A_VALIDAR) === JSON.stringify(M.TIPOS_A_VALIDAR), 'códigos firmes, intermediários e tipos de A_VALIDAR');
afirma(Object.keys(V1.regras).every((k) => regrasVistas[k]) && Object.keys(regrasVistas).every((k) => V1.regras[k]), 'as 25 regras são alcançadas, e nada fora do catálogo é registrado');
afirma(Object.keys(motivosVistos).every((k) => V1.motivos.indexOf(k) !== -1) && V1.motivos.every((k) => motivosVistos[k]), 'os motivos registrados são exatamente os do catálogo');
afirma(JSON.stringify(N.versoes()) === JSON.stringify(M.versoes()) && V1.versao === M.versaoAtual(), 'mesmas versões conhecidas (só a 1) e a em vigor do motor é a da definição');

console.log('\n== D. Invariante Linha × Squad (literal) ==');
const LINHA_SQUAD = { AREA_ESPECIALIZADA: false, COE: false, ESTRATEGIA_CLIENTES: true, NEGOCIOS: true, PLATAFORMA_CANAIS: true,
  PLATAFORMA_HABILITADORA_NEGOCIOS: true, PLATAFORMA_HABILITADORA_TECNOLOGIA: true, PLATAFORMA_CORPORATIVA: true };
Object.keys(LINHA_SQUAD).forEach((c) => afirma(N.liberaSquadParaCodigoFirme(c) === LINHA_SQUAD[c], c + ' → liberaSquad ' + LINHA_SQUAD[c]));
['LINHA', 'PLATAFORMA', 'A_VALIDAR', 'SQUAD', ''].forEach((c) => { let erro = false; try { N.liberaSquadParaCodigoFirme(c); } catch (e) { erro = true; } afirma(erro, '"' + c + '" não é firme: erro, nunca um padrão'); });
let firmes = 0, firmesOk = 0;
estados((r, g) => { const o = N.avaliar(V1, r, g); if (o.codigoResultado in LINHA_SQUAD) { firmes++; if (o.liberaSquad === LINHA_SQUAD[o.codigoResultado]) firmesOk++; } });
afirma(firmes > 0 && firmesOk === firmes, 'nos ' + firmes + ' resultados firmes, liberaSquad = tabela literal (' + firmesOk + ')');
afirma(!/libera|squad/i.test(JSON.stringify(V1)), 'a definição não carrega liberaSquad nem nada de Squad (não é configurável por versão)');
/* uma definição adulterada que TENTA configurar liberaSquad (e o ramo Linha) não muda nada: o núcleo nunca lê isso */
const ADULTERADA = Object.assign(JSON.parse(JSON.stringify(V1)), { liberaSquad: { AREA_ESPECIALIZADA: true, COE: true, NEGOCIOS: false, ESTRATEGIA_CLIENTES: false, A_VALIDAR: true },
  ramoLinha: ['AREA_ESPECIALIZADA', 'COE'], deLinha: ['AREA_ESPECIALIZADA', 'COE'], RAMO_LINHA: ['COE'] });
let adulteradosOk = 0, adulteradosN = 0;
estados((r, g) => { adulteradosN++; if (N.avaliar(ADULTERADA, r, g).liberaSquad === N.avaliar(V1, r, g).liberaSquad) adulteradosOk++; });
afirma(adulteradosOk === adulteradosN, 'definição que tenta configurar liberaSquad/ramo Linha: o liberaSquad não muda em nenhum dos ' + adulteradosN + ' estados (' + adulteradosOk + ')');

console.log('\n== E. Casos nomeados ==');
const av = (r, g) => N.avaliar(V1, r, g || {});
const igualMotor = (r, g) => canon(M.avaliar(r, g || {})) === canon(av(r, g));
const caso = (rot, r, g, espera) => {
  const o = av(r, g), ok = igualMotor(r, g) && Object.keys(espera).every((k) => JSON.stringify(o[k]) === JSON.stringify(espera[k]));
  afirma(ok, rot, JSON.stringify(o));
};
const S = 'SIM', X = 'NAO';
caso('nada respondido → N1 incompleto', {}, {}, { codigoResultado: 'A_VALIDAR', motivo: 'RESPOSTA_FALTANDO', regra: 'N1_RESPOSTA_FALTANDO', niveisAlcancados: ['N1'] });
caso('N1 com O2 ausente → incompleto, com os papéis dos SIM presentes', { O1: S, O3: X }, {}, { motivo: 'RESPOSTA_FALTANDO', papeisDetectados: ['LINHA'] });
caso('N1 0 SIM → sem papel', { O1: X, O2: X, O3: X }, {}, { tipoAValidar: 'EVIDENCIA_INSUFICIENTE', motivo: 'SEM_PAPEL', regra: 'N1_SEM_PAPEL', liberaSquad: false });
caso('N1 só O2 → Área Especializada', { O1: X, O2: S, O3: X }, {}, { codigoResultado: 'AREA_ESPECIALIZADA', motivo: 'PAPEL_UNICO', liberaSquad: false });
caso('N1 só O3 → CoE', { O1: X, O2: X, O3: S }, {}, { codigoResultado: 'COE', liberaSquad: false });
caso('N1 só O1 → desce para N2 (incompleto lá)', { O1: S, O2: X, O3: X }, {}, { regra: 'N2_RESPOSTA_FALTANDO', nivelConfirmado: 'LINHA', liberaSquad: true, niveisAlcancados: ['N1', 'N2'] });
caso('N1 2 SIM, diagnóstico "mesma" → conflito', { O1: S, O2: S, O3: X }, { N1: 'mesma' }, { tipoAValidar: 'CONFLITO', regra: 'N1_CONFLITO', papeisDetectados: ['LINHA', 'AREA_ESPECIALIZADA'], nivelConfirmado: null });
caso('N1 2 SIM, diagnóstico "distintas" → recorte', { O1: X, O2: S, O3: S }, { N1: 'distintas' }, { tipoAValidar: 'RECORTE', regra: 'N1_RECORTE_DIAGNOSTICO' });
caso('N1 2 SIM, diagnóstico ausente → pendente', { O1: X, O2: S, O3: S }, {}, { motivo: 'DIAGNOSTICO_PENDENTE', regra: 'N1_DIAGNOSTICO_PENDENTE' });
caso('N1 3 SIM → recorte direto (v1)', { O1: S, O2: S, O3: S }, { N1: 'mesma' }, { tipoAValidar: 'RECORTE', motivo: 'TRES_OU_MAIS_PAPEIS', regra: 'N1_RECORTE' });
const L = { O1: S, O2: X, O3: X };
caso('N2 só O4 → Estratégia de Clientes', Object.assign({ O4: S, O5: X }, L), {}, { codigoResultado: 'ESTRATEGIA_CLIENTES', liberaSquad: true, nivelConfirmado: null });
caso('N2 só O5 → Negócios', Object.assign({ O4: X, O5: S }, L), {}, { codigoResultado: 'NEGOCIOS', liberaSquad: true });
caso('N2 2 SIM, "mesma" → conflito com Linha confirmada', Object.assign({ O4: S, O5: S }, L), { N2: 'mesma' }, { regra: 'N2_CONFLITO', nivelConfirmado: 'LINHA', liberaSquad: true });
caso('N2 2 SIM, ausente → pendente', Object.assign({ O4: S, O5: S }, L), {}, { regra: 'N2_DIAGNOSTICO_PENDENTE' });
const PL = Object.assign({ O4: X, O5: X }, L);
caso('N2 0 SIM → N3 (incompleto)', PL, {}, { regra: 'N3_RESPOSTA_FALTANDO', nivelConfirmado: 'LINHA', niveisAlcancados: ['N1', 'N2', 'N3'] });
caso('N3 incompleto com 1 SIM → Plataforma já confirmada', Object.assign({ O6: S }, PL), {}, { regra: 'N3_RESPOSTA_FALTANDO', nivelConfirmado: 'PLATAFORMA' });
caso('N3 0 SIM → sem papel, Linha confirmada', Object.assign({ O6: X, O7: X, O8: X, O9: X }, PL), {}, { regra: 'N3_SEM_PAPEL', nivelConfirmado: 'LINHA', liberaSquad: true });
caso('N3 só O8 → Habilitadora de Tecnologia', Object.assign({ O6: X, O7: X, O8: S, O9: X }, PL), {}, { codigoResultado: 'PLATAFORMA_HABILITADORA_TECNOLOGIA', liberaSquad: true });
caso('N3 2 SIM, "distintas" → recorte, Plataforma confirmada', Object.assign({ O6: S, O7: S, O8: X, O9: X }, PL), { N3: 'distintas' }, { regra: 'N3_RECORTE_DIAGNOSTICO', nivelConfirmado: 'PLATAFORMA' });
caso('N3 3 SIM → recorte', Object.assign({ O6: S, O7: S, O8: S, O9: X }, PL), {}, { regra: 'N3_RECORTE', motivo: 'TRES_OU_MAIS_PAPEIS' });
caso('N3 4 SIM → recorte', Object.assign({ O6: S, O7: S, O8: S, O9: S }, PL), {}, { regra: 'N3_RECORTE' });
caso('N3 3 SIM + 1 ausente → incompleto, não recorte (completude)', Object.assign({ O6: S, O7: S, O8: S }, PL), {}, { motivo: 'RESPOSTA_FALTANDO' });
caso('incoerência: Área + O4 = SIM → SIM fora do caminho', { O1: X, O2: S, O3: X, O4: S }, {}, { tipoAValidar: 'INCOERENCIA', regra: 'DEF_SIM_FORA_DO_CAMINHO', perguntasForaDoCaminho: ['O4'], papeisDetectados: ['ESTRATEGIA_CLIENTES'], liberaSquad: false });
caso('incoerência vence conclusão firme (Negócios + O6 = SIM)', Object.assign({ O4: X, O5: S, O6: S }, L), {}, { tipoAValidar: 'INCOERENCIA', perguntasForaDoCaminho: ['O6'], nivelConfirmado: null });
caso('resíduo: NAO fora do caminho não muda nada (Área + O4..O9 = NAO)', { O1: X, O2: S, O3: X, O4: X, O5: X, O6: X, O7: X, O8: X, O9: X }, {}, { codigoResultado: 'AREA_ESPECIALIZADA' });
caso('diagnóstico fora da condição de uso é ignorado (Área com N1 = mesma)', { O1: X, O2: S, O3: X }, { N1: 'mesma', N3: 'distintas' }, { codigoResultado: 'AREA_ESPECIALIZADA' });
caso('valor inválido conta como ausente, nunca NAO', { O1: 'sim', O2: X, O3: X }, {}, { motivo: 'RESPOSTA_FALTANDO' });
afirma(JSON.stringify(N.perguntasDoCaminho(V1, { O1: X, O2: S, O3: X }, {})) === '["O1","O2","O3"]', 'perguntasDoCaminho: Área → só O1–O3');
afirma(JSON.stringify(N.diagnosticosNecessarios(V1, Object.assign({ O6: S, O7: S, O8: X, O9: X }, PL), {})) === '["N3"]', 'diagnosticosNecessarios: 2 SIM no N3 → ["N3"]');

console.log('\n== F. Versão desconhecida e definição inválida ==');
const lanca = (fn) => { try { fn(); return false; } catch (e) { return true; } };
afirma(lanca(() => N.definicao(2)) && lanca(() => N.definicao(0)) && lanca(() => N.definicao('x')), 'definicao(2/0/"x") recusada');
afirma(lanca(() => N.avaliar(null, {}, {})) && lanca(() => N.avaliar({}, {}, {})) && lanca(() => N.avaliar({ versao: 1 }, {}, {})), 'avaliar sem definição válida recusa (nunca cai num padrão)');
afirma(lanca(() => M.avaliar({}, {}, { versao: 2 })), '…como o motor atual, que recusa versão desconhecida');

console.log('\n== G. Puro, congelado, determinístico ==');
const congelado = (o) => !o || typeof o !== 'object' || (Object.isFrozen(o) && Object.keys(o).every((k) => congelado(o[k])));
afirma(congelado(V1), 'a definição v1 é congelada em profundidade');
afirma(Object.isFrozen(N), 'a API é congelada');
const ent = { O1: S, O2: X, O3: X, O4: X, O5: X }, entD = { N1: 'mesma' }, copia = JSON.stringify([ent, entD]);
const o1 = N.avaliar(V1, ent, entD), o2 = N.avaliar(V1, ent, entD);
afirma(JSON.stringify([ent, entD]) === copia, 'as entradas não mudam');
afirma(canon(o1) === canon(o2) && o1 !== o2 && o1.niveisAlcancados !== o2.niveisAlcancados, 'determinístico, e cada saída é um objeto novo (nada compartilhado)');
const fonte = fs.readFileSync(path.join(RAIZ, 'motor-posicionamento-nucleo.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
afirma(!/firebase|document\.|localStorage|sessionStorage|fetch\(|XMLHttpRequest|faAuth|require\(/.test(fonte), 'o arquivo não usa DOM, Firebase, autenticação, rede, armazenamento nem outros módulos');
afirma(!/motor-posicionamento-nucleo/.test(fs.readFileSync(path.join(RAIZ, '..', 'index.html'), 'utf8')), 'lado a lado: o núcleo ainda não é carregado pelo site (nenhum consumidor mudou)');

console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
process.exit(falhas ? 1 : 0);
