/* GATE P1–P16 → O1–O9 (H0) — o núcleo puro, sem navegador, sem banco.
 *
 * Carrega os arquivos REAIS (avaliacao-produto.js expõe faBaseProdutoServico; avaliacao-posicionamento.js expõe
 * gateDoItem no núcleo) e prova:
 *   A. Regressão da extração: situacaoMotorDe dá EXATAMENTE o que o diagnosticoMotor de antes dava (a cópia de
 *      referência abaixo é o corpo dele antes do H0), na mesma ordem de chamadas ao motor, numa grade de entradas;
 *      e diagnosticoMotor passou a só delegar (nenhuma segunda cópia da lógica).
 *   B. baseDoItem segue a regra da lista de Produto/Serviço (temVersaoMaisNova): em cadeias aleatórias, vale a
 *      ponta; a ponta em andamento, excluída ou ambígua não deixa voltar para uma versão anterior.
 *   C. Os casos do gate: atual libera; desatualizado, equivalente e verificando bloqueiam; v1 concluída + v2
 *      rascunho não usa a v1; v1 + v2 concluídas usam a v2; v2 concluída e depois excluída bloqueia (sem voltar para
 *      a v1); excluída, inexistente e ambígua bloqueiam; sem o módulo de Produto/Serviço bloqueia.
 *   D. As mensagens (textos exatos de verificando/desatualizado) e que equivalente e reavaliação em andamento dizem o
 *      que fazer.
 *   E. Nenhuma lógica de Produto/Serviço repetida em avaliacao-posicionamento.js.
 * FA_RAIZ (opcional) troca a pasta dos arquivos — é assim que os mutantes do H0 são rodados. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = process.env.FA_RAIZ || path.join(__dirname, '..', '..', 'forca-agil');
let total = 0, falhas = 0;
function anota(linha, ok, detalhe) {
  total++;
  if (ok) { console.log('  ok    ' + linha); return; }
  falhas++;
  console.error('  FALHA ' + linha + (detalhe ? ' → ' + detalhe : ''));
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function carregar() {
  const ctx = { console, JSON, Object, Array, String, Math, Number, Date, RegExp, Error, Promise, setTimeout, clearTimeout, setInterval, clearInterval, parseFloat, parseInt, isNaN };
  ctx.window = ctx;
  const el = () => ({ addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, style: {}, classList: { add() {}, remove() {}, contains() { return false; } } });
  ctx.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, addEventListener() {}, body: el(), documentElement: el() };
  ctx.firebase = { database: () => ({ ref: () => ({ on() {}, off() {}, once() { return Promise.resolve({ val: () => null }); }, update() {}, child() { return this; }, push() { return { key: 'k' }; } }) }) };
  ctx.navigator = {}; ctx.location = { hash: '' }; ctx.localStorage = { getItem() { return null; }, setItem() {} };
  vm.createContext(ctx);
  for (const f of ['questionarios-config.js', 'motor-arquitetura.js', 'avaliacao-produto.js', 'motor-posicionamento.js']) vm.runInContext(fs.readFileSync(path.join(RAIZ, f), 'utf8'), ctx, { filename: f });
  delete ctx.document;
  vm.runInContext(fs.readFileSync(path.join(RAIZ, 'avaliacao-posicionamento.js'), 'utf8'), ctx, { filename: 'avaliacao-posicionamento.js' });
  return ctx;
}
const ctx = carregar();
const B = ctx.faBaseProdutoServico, N = ctx.faAvaliacaoPosicionamentoNucleo;
const MOTOR = (fs.readFileSync(path.join(RAIZ, 'avaliacao-produto.js'), 'utf8').match(/\n  var MOTOR_VERSION = '([^']+)';/) || [])[1];

/* ---- A. Regressão da extração ---- */
console.log('\n== A. situacaoMotorDe = o diagnosticoMotor de antes do H0 ==');
anota('faBaseProdutoServico exposto e congelado', !!B && Object.isFrozen(B) && typeof B.situacaoMotorDe === 'function' && typeof B.baseDoItem === 'function');
/* Cópia de referência: o corpo de diagnosticoMotor ANTES do H0 (M = o motor de arquitetura; MOTOR_VERSION). */
function referencia(it, M, MOTOR_VERSION) {
  if (!it || it.status !== 'concluido') return null;
  if (!M.configCarregada()) return { situacao: 'verificando' };
  if (it.motorVersion !== MOTOR_VERSION) {
    return { situacao: 'desatualizado', motivo: { tipo: 'codigo', encontrada: it.motorVersion || null, esperada: MOTOR_VERSION } };
  }
  var vigente = M.versaoAtual();
  if (it.motorVersionArquitetura === vigente) return { situacao: 'atual' };
  if (typeof it.motorVersionArquitetura !== 'number') return { situacao: 'desatualizado', motivo: { tipo: 'sem-versao', destino: vigente } };
  var eq = M.equivalenciaEntreVersoes(it.motorVersionArquitetura, vigente);
  if (eq.equivalentes) return { situacao: 'equivalente', prova: eq };
  return { situacao: 'desatualizado', motivo: eq.diferencas > 0
    ? { tipo: 'logica', origem: eq.versaoA, destino: eq.versaoB, diferencas: eq.diferencas, combinacoes: eq.combinacoesAnalisadas }
    : { tipo: 'sem-prova', origem: eq.versaoA, destino: eq.versaoB, detalhe: eq.motivo || null } };
}
const EQS = [
  (a, b) => ({ versaoA: a, versaoB: b, equivalentes: true, diferencas: 0, combinacoesAnalisadas: 65536 }),
  (a, b) => ({ versaoA: a, versaoB: b, equivalentes: false, diferencas: 12, combinacoesAnalisadas: 65536 }),
  (a, b) => ({ versaoA: a, versaoB: b, equivalentes: false, motivo: 'versao-indisponivel' }),
  (a, b) => ({ versaoA: a, versaoB: b, equivalentes: false })
];
let casos = 0, iguais = 0, ordemIgual = 0;
for (const status of ['concluido', 'rascunho', undefined]) for (const mv of [MOTOR, '2000.01.01-1', undefined, '']) for (const carregada of [true, false])
  for (const vAtual of [1, 2, 3]) for (const mva of [1, 2, 3, '2', undefined, null]) for (let e = 0; e < EQS.length; e++) {
    const it = { status, motorVersion: mv, motorVersionArquitetura: mva };
    const log1 = [], log2 = [];
    const M1 = { configCarregada: () => (log1.push('c'), carregada), versaoAtual: () => (log1.push('v'), vAtual), equivalenciaEntreVersoes: (a, b) => (log1.push('e' + a + b), EQS[e](a, b)) };
    const c2 = { motorVersion: MOTOR, configCarregada: () => (log2.push('c'), carregada), versaoAtual: () => (log2.push('v'), vAtual), equivalencia: (a, b) => (log2.push('e' + a + b), EQS[e](a, b)) };
    casos++;
    if (igual(referencia(it, M1, MOTOR), B.situacaoMotorDe(it, c2))) iguais++;
    if (igual(log1, log2)) ordemIgual++;
  }
anota('mesma resposta em ' + casos + ' combinações (' + iguais + ')', iguais === casos);
anota('mesmas chamadas ao motor, na mesma ordem (' + ordemIgual + ')', ordemIgual === casos);
const fonteProduto = fs.readFileSync(path.join(RAIZ, 'avaliacao-produto.js'), 'utf8');
anota('diagnosticoMotor só delega para situacaoMotorDe com o contexto real', /function diagnosticoMotor\(it\) \{ return situacaoMotorDe\(it, contextoMotorAtual\(\)\); \}/.test(fonteProduto));
anota('a comparação de motorVersion existe uma vez só em avaliacao-produto.js', (fonteProduto.match(/it\.motorVersion !== /g) || []).length === 1);
const real = B.contextoMotorAtual();
anota('contexto real: MOTOR_VERSION do arquivo e as funções do motor carregado', real.motorVersion === MOTOR && real.configCarregada === ctx.faMotorArquitetura.configCarregada &&
  real.versaoAtual === ctx.faMotorArquitetura.versaoAtual && real.equivalencia === ctx.faMotorArquitetura.equivalenciaEntreVersoes);

/* ---- B. baseDoItem = a regra da lista de Produto/Serviço ---- */
console.log('\n== B. baseDoItem segue a lista de Produto/Serviço (temVersaoMaisNova) ==');
/* referência: o que a lista de Produto/Serviço mostra para o item (itemPassaFiltro / temVersaoMaisNova) */
function referenciaLista(itemId, regs) {
  const todos = Object.keys(regs).map((k) => Object.assign({ _key: k }, regs[k]));
  const temMaisNova = (key) => todos.some((o) => o.versaoAnteriorKey === key);
  const linhas = todos.filter((it) => (it.itemId || it._key) === itemId && !temMaisNova(it._key));
  if (!todos.some((it) => (it.itemId || it._key) === itemId)) return 'sem-avaliacao';
  if (linhas.length !== 1) return 'indefinida';
  const l = linhas[0];
  if (l.excluido === true) return 'excluida:' + l._key;
  if (l.status !== 'concluido') return (l.versaoAnteriorKey ? 'reavaliacao-em-andamento:' : 'nao-concluida:') + l._key;
  return 'valida:' + l._key;
}
let semente = 7;
const aleat = () => { semente = (semente * 1103515245 + 12345) % 2147483648; return semente / 2147483648; };
let cadeias = 0, conferem = 0;
for (let n = 0; n < 4000; n++) {
  const regs = {}, item = 'i' + n;
  const versoes = 1 + Math.floor(aleat() * 4);
  let ant = null;
  for (let v = 1; v <= versoes; v++) {
    const k = v === 1 ? item : item + 'v' + v;
    regs[k] = { itemId: v === 1 && aleat() < 0.2 ? undefined : item, versao: v, status: aleat() < 0.7 ? 'concluido' : 'rascunho', excluido: aleat() < 0.2 ? true : undefined, versaoAnteriorKey: ant || undefined };
    ant = k;
  }
  if (aleat() < 0.05 && versoes > 1) regs[item + 'fork'] = { itemId: item, versao: 2, status: 'concluido', versaoAnteriorKey: item }; /* duas reavaliações da v1 */
  if (aleat() < 0.3) regs['outro' + n] = { itemId: 'outro' + n, versao: 1, status: 'concluido' };
  const b = B.baseDoItem(item, JSON.parse(JSON.stringify(regs)));
  const obtido = b.situacao + (b.chave ? ':' + b.chave : '');
  cadeias++;
  if (obtido === referenciaLista(item, regs)) conferem++;
  else if (cadeias - conferem < 4) console.error('    divergiu: ' + JSON.stringify(regs) + ' → ' + obtido + ' × ' + referenciaLista(item, regs));
}
anota('em ' + cadeias + ' cadeias aleatórias, a base é a linha que a lista de Produto/Serviço mostra (' + conferem + ')', conferem === cadeias);

/* ---- C. Os casos do gate ---- */
console.log('\n== C. Casos do gate ==');
const CTX = (o) => Object.assign({ motorVersion: MOTOR, configCarregada: () => true, versaoAtual: () => 1, equivalencia: (a, b) => ({ versaoA: a, versaoB: b, equivalentes: false, diferencas: 3, combinacoesAnalisadas: 10 }) }, o || {});
const conc = (extra) => Object.assign({ itemId: 'p', status: 'concluido', motorVersion: MOTOR, motorVersionArquitetura: 1, versao: 1 }, extra || {});
const g = (regs, ctxo) => N.gateDoItem('p', regs, B, CTX(ctxo));
let r = g({ p: conc() });
anota('1. P1–P16 atual → libera, sobre a própria avaliação', r.libera === true && r.situacao === 'atual' && r.chave === 'p');
r = g({ p: conc({ motorVersion: '2000.01.01-1' }) });
anota('2. desatualizado (lógica em código antiga) → bloqueia', r.libera === false && r.situacao === 'desatualizado');
r = g({ p: conc({ motorVersionArquitetura: 1 }) }, { versaoAtual: () => 2 });
anota('2b. desatualizado (versão das regras com diferença lógica) → bloqueia', r.libera === false && r.situacao === 'desatualizado' && r.motivo && r.motivo.tipo === 'logica');
r = g({ p: conc({ motorVersionArquitetura: 1 }) }, { versaoAtual: () => 2, equivalencia: (a, b) => ({ versaoA: a, versaoB: b, equivalentes: true }) });
anota('3. equivalente → bloqueia (só "atual" libera)', r.libera === false && r.situacao === 'equivalente');
r = g({ p: conc() }, { configCarregada: () => false });
anota('4. configuração do motor ainda carregando → bloqueia ("verificando")', r.libera === false && r.situacao === 'verificando');
r = g({ p: conc(), pv2: { itemId: 'p', status: 'rascunho', versao: 2, versaoAnteriorKey: 'p' } });
anota('5. v1 concluída + v2 rascunho → não usa a v1 ("reavaliação em andamento")', r.libera === false && r.situacao === 'reavaliacao-em-andamento' && r.chave === 'pv2');
r = g({ p: conc(), pv2: conc({ versao: 2, versaoAnteriorKey: 'p' }) });
anota('6. v1 + v2 concluídas → usa a v2', r.libera === true && r.chave === 'pv2');
r = g({ p: conc(), pv2: conc({ versao: 2, versaoAnteriorKey: 'p', excluido: true }) });
anota('7. v2 concluída e depois excluída → bloqueia, sem voltar para a v1', r.libera === false && r.situacao === 'excluida' && r.chave === 'pv2');
r = g({ p: conc({ excluido: true }) });
anota('8. avaliação excluída → bloqueia', r.libera === false && r.situacao === 'excluida');
r = g({ p: conc(), pv2: conc({ versao: 2, versaoAnteriorKey: 'p', motorVersion: 'x' }) });
anota('6b. v2 concluída mas desatualizada → bloqueia (não cai para a v1 atual)', r.libera === false && r.situacao === 'desatualizado' && r.chave === 'pv2');
r = g({ p: conc(), a: conc({ versao: 2, versaoAnteriorKey: 'p' }), b: conc({ versao: 2, versaoAnteriorKey: 'p' }) });
anota('duas reavaliações da mesma versão → bloqueia ("indefinida")', r.libera === false && r.situacao === 'indefinida');
r = g({ q: conc({ itemId: 'q' }) });
anota('item sem Avaliação de Produto/Serviço → bloqueia', r.libera === false && r.situacao === 'sem-avaliacao');
r = g({ p: conc({ status: 'rascunho' }) });
anota('primeira versão ainda em rascunho → bloqueia', r.libera === false && r.situacao === 'nao-concluida');
r = N.gateDoItem('p', { p: conc() }, undefined, CTX());
anota('sem o módulo de Produto/Serviço → bloqueia ("verificando"), nunca supõe', r.libera === false && r.situacao === 'verificando');
r = g({ p: { status: 'concluido', motorVersion: MOTOR, motorVersionArquitetura: 1 } });
anota('legado sem itemId (o item é a chave) → libera pela própria avaliação', r.libera === true && r.chave === 'p');

/* ---- D. Mensagens ---- */
console.log('\n== D. Mensagens ==');
anota('verificando: texto exato', N.textoGate('verificando', 'iniciar') === 'Verificando a versão do motor da Avaliação de Produto/Serviço…');
anota('desatualizado: texto exato', N.textoGate('desatualizado', 'iniciar') === 'Motor da Avaliação de Produto/Serviço desatualizado. Atualize P1–P16 antes de iniciar o Posicionamento Organizacional.');
anota('desatualizado na reavaliação: "antes de reavaliar"', /Atualize P1–P16 antes de reavaliar o Posicionamento Organizacional\.$/.test(N.textoGate('desatualizado', 'reavaliar')));
anota('equivalente: logicamente equivalente, mas precisa ser reconciliada para ficar formalmente atual', /logicamente equivalente/.test(N.textoGate('equivalente')) && /Reconcilie-a em Produto\/Serviço/.test(N.textoGate('equivalente')) && /formalmente com Motor atual/.test(N.textoGate('equivalente')));
anota('reavaliação em andamento: versão mais nova a concluir ou resolver', /versão mais nova/.test(N.textoGate('reavaliacao-em-andamento')) && /Conclua ou resolva/.test(N.textoGate('reavaliacao-em-andamento')));
anota('toda situação que bloqueia tem mensagem e rótulo curto', ['verificando', 'desatualizado', 'equivalente', 'reavaliacao-em-andamento', 'excluida', 'nao-concluida', 'sem-avaliacao', 'indefinida']
  .every((s) => N.textoGate(s, 'iniciar').length > 20 && !!N.ROTULO_GATE[s]));

/* ---- E. Sem lógica duplicada ---- */
console.log('\n== E. Sem lógica de Produto/Serviço repetida no Posicionamento ==');
const fontePos = fs.readFileSync(path.join(RAIZ, 'avaliacao-posicionamento.js'), 'utf8');
anota('avaliacao-posicionamento.js não lê motorVersion, MOTOR_VERSION nem versaoAnteriorKey', !/motorVersion|MOTOR_VERSION|versaoAnteriorKey/.test(fontePos));
anota('nem escolhe "a maior versão" de Produto/Serviço (a regra antiga de itensAvaliaveis saiu)', !/itensAvaliaveis/.test(fontePos) && !/\(it\.versao \|\| 1\) > \(atual\.versao \|\| 1\)/.test(fontePos));

console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
process.exit(falhas ? 1 : 0);
