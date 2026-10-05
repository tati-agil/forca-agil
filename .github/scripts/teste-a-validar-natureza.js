/* "A validar" por autonomia estrutural (P5 = SIM) × uma única natureza predominante (P11–P15) —
 * explicação específica, só para a lógica da versão 5 aprovada (correção editorial).
 *
 * Na versão 5, 576 combinações caem no fallback com P5 = SIM e exatamente uma natureza marcada.
 * Em 336 delas uma única troca de resposta resolveria a classificação, e o texto genérico
 * ("não reúnem evidência suficiente…") não dizia isso:
 *   - 316 'autonomia': só P5 = SIM impede a natureza (com P5 = NÃO, o motor classificaria nela);
 *   - 16 'natureza': só a natureza marcada impede Produto/Serviço principal;
 *   - 4 'ambiguo' (P13): as duas trocas resolvem — os sinais apontam para critérios incompatíveis.
 * Os outros 240 (falta mais de uma condição) continuam com o texto genérico.
 * A classificação gravada ganha a marca camadaSugerida.bloqueioNatureza = { tipo, natureza, pergunta },
 * com justificativa e interpretação aprovadas. Rótulo continua "A validar". A marca é metadado
 * explicativo: calculada depois da decisão, nunca lida pelo motor.
 * SÓ PARA A LÓGICA DA VERSÃO 5 APROVADA: a equivalência é semântica (faMotorArquitetura.
 * assinaturaSemantica — camada, tipo de decisão e camadas em conflito nas 65.536 combinações; sem
 * textos, motivos, códigos ou forma de escrita). Versões 3 e 4 restauradas e a fábrica mantêm o
 * texto da época. A checagem roda em segundo plano, em pedaços, e Concluir/Reprocessar esperam
 * por ela. Correção EDITORIAL: nenhuma classificação, regra ou precedência muda; MOTOR_VERSION e
 * questionário intactos; o motor só ganhou a exportação de leitura assinaturaSemantica /
 * criarVarreduraSemantica — identificarCamada idêntico (impressões digitais abaixo).
 *
 * PARTE A (sem navegador — código real em vm):
 *   - motor: retorno COMPLETO de identificarCamada idêntico ao da main nas 65.536 combinações
 *     (fábrica, versões 3, 4 e 5);
 *   - referência fixa da versão 5 = assinatura da versão 5 reconstruída; versões 3, 4 e fábrica
 *     diferentes;
 *   - versão 5: os marcados são EXATAMENTE os previstos por um oráculo escrito a partir das regras
 *     (316 + 16 + 4), com justificativa e interpretação exatas; os 240 restantes e todo o resto
 *     idênticos à main (impressão digital da main com a marca removida) e ao código sem a detecção;
 *     os 8 casos de P8 (#290) intactos;
 *   - versões 3, 4 e fábrica: nenhuma marca, nada muda;
 *   - versão 5 com mudança só de texto/forma: continua ligada (336); com mudança lógica mínima:
 *     desliga (0);
 *   - a marca não é lida como entrada; cache: uma varredura por conjunto de regras; a espera
 *     (quandoCompatibilidadePronta) usa a varredura em pedaços e nunca a de uma vez;
 *   - prova inversa embutida: sem a detecção, ou sem a restrição à versão 5, a conferência falha.
 * PARTE B (navegador, banco falso, desktop e 375 px): um item de cada tipo concluído ANTES (texto
 *   genérico, sem marca) mostra o comportamento da época na tela, no PDF e no Excel; reprocessado,
 *   mostra o texto novo; uma avaliação NOVA concluída logo ao abrir a página também; rótulo
 *   "A validar", sem rolagem horizontal, sem erro de JS.
 * Hermético: sem rede, sem segredo. Dados fictícios. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const RAIZ = path.join(__dirname, '..', '..', 'forca-agil');
const XLSX = require(path.join(RAIZ, 'xlsx.mini.min.js'));
const SRC = {
  qc: fs.readFileSync(path.join(RAIZ, 'questionarios-config.js'), 'utf8'),
  motor: fs.readFileSync(path.join(RAIZ, 'motor-arquitetura.js'), 'utf8'),
  avp: fs.readFileSync(path.join(RAIZ, 'avaliacao-produto.js'), 'utf8')
};
const EMAIL = 'adm@previ.com.br';
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const DESKTOP = { width: 1280, height: 900 };
const CELULAR = { width: 375, height: 800 };
const SHOTS = process.env.FA_SHOTS_DIR || null;

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

const MOTOR_VERSION_ESPERADA = '2026.09.29-2';
/* Retorno COMPLETO de identificarCamada (camada, regra aplicada, motivos, conflito, incoerência)
   nas 65.536 combinações, calculado com o motor da main antes desta mudança (db71f02). */
const DIGITAL_MOTOR = {
  fabrica: '3e35f58082ccef55cad53ee458674ecf2e4b92f8671969603c483e07b843f49c',
  v3: '85ee307243a19c286954794b34626524d331fa387c256382dc38748b341b91aa',
  v4: '958c2976f7d5f64ab9cbecbe7a718c729f7fd6f7932be4da8d374ffa59db5e1e',
  v5: '854dc6cf2e0c40084dc77550a5cd47f919cd44ae621b85c6138aea1129d338bb'
};
/* computeResultado + justificativa + interpretação das 16 perguntas, nas 65.536 combinações,
   calculado com o código da main antes desta mudança (db71f02). */
const DIGITAL_AVALIACAO = {
  fabrica: '9c30bd0ceae821b94457b850639d16c13dd11040da6cdce883af8f70c4e6d74a',
  v3: '1efb6d36e187cf00a90abbecd09748602fa0a74c4cc3d943940f6186bfc862a7',
  v4: 'edb5952aac7683c8e79df8efa39ae3f4a4d9da55dd0b6c9e961eda55d48411c0',
  v5: 'c109e490b406c0d23cfb3e49e83bc4dfecf23857d2845cf314c1c11f0b925a69'
};
const ROTULO = { 'capacidade-organizacional': 'Capacidade organizacional', 'processo-etapa': 'Processo/Etapa de processo',
  'modalidade-subproduto': 'Modalidade/Subproduto', 'regra-condicao': 'Regra/Opção', componente: 'Componente' };
const NATUREZA_DE = { P11: 'capacidade-organizacional', P12: 'processo-etapa', P13: 'modalidade-subproduto', P14: 'regra-condicao', P15: 'componente' };
const JUSTIFICATIVA = {
  autonomia: (n) => 'As respostas indicam ' + ROTULO[n] + ' como natureza predominante, mas também indicam autonomia estrutural. ' +
    'Como a classificação como ' + ROTULO[n] + ' exige que o item não tenha autonomia estrutural, o item permanece como A validar para análise.',
  natureza: (n) => 'As respostas atendem às demais condições exigidas para Produto/Serviço principal, mas indicam ' + ROTULO[n] + ' como natureza predominante. ' +
    'Como Produto/Serviço principal não pode ter outra natureza arquitetural predominante, o item permanece como A validar para análise.',
  ambiguo: (n) => 'As respostas indicam simultaneamente autonomia estrutural e ' + ROTULO[n] + '. ' +
    'Esses sinais conduzem a critérios incompatíveis entre Produto/Serviço principal e ' + ROTULO[n] + '. Por isso, o item permanece como A validar para análise.'
};
const INTERP_P5 = (n) => 'Esta resposta impediu a classificação como ' + ROTULO[n] + ', porque essa classificação exige ausência de autonomia estrutural e as demais condições foram atendidas.';
const INTERP_NATUREZA = 'Esta resposta impediu a classificação como Produto/Serviço principal, porque as demais condições foram atendidas e esta natureza foi indicada como predominante.';
const JUSTIFICATIVA_GENERICA = 'As respostas não reúnem evidência suficiente para indicar com segurança nenhuma das categorias arquiteturais previstas. ' +
  'Revise as respostas do questionário ou registre uma decisão manual com a justificativa correspondente.';
/* o texto aprovado para os ambíguos (P13), literalmente */
const AMBIGUO_APROVADO = 'As respostas indicam simultaneamente autonomia estrutural e Modalidade/Subproduto. Esses sinais conduzem a critérios incompatíveis entre Produto/Serviço principal e Modalidade/Subproduto. Por isso, o item permanece como A validar para análise.';

const ORDEM = ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia', 'jornada', 'medicao', 'gestao',
  'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'];
const clone = (x) => JSON.parse(JSON.stringify(x));
const sim = (m, cod) => ((m >> (Number(cod.slice(1)) - 1)) & 1) === 1;
const semPrefixo = (t) => String(t || '').replace(/^(SIM|NÃO)\s*—\s*/, '');

/* ORÁCULO (versão 5), escrito a partir das regras — independente do código da detecção:
   P5 = SIM, P9/P10/P16 = NÃO, exatamente uma natureza N.
   - "PP sem a natureza": P1–P4 e P8 = SIM (com N = NÃO o item seria Produto/Serviço principal);
   - "N sem P5": Processo/Regra/Componente exigem P2 = NÃO; Modalidade não exige (versão 4);
     Capacidade com P5 = SIM e P1 = NÃO já é Capacidade (não chega ao fallback) — então nunca. */
function oraculoV5(m) {
  if (!sim(m, 'P5') || sim(m, 'P9') || sim(m, 'P10') || sim(m, 'P16')) return null;
  const nat = Object.keys(NATUREZA_DE).filter((c) => sim(m, c));
  if (nat.length !== 1) return null;
  const n = nat[0];
  if (n === 'P11' && !sim(m, 'P1')) return null; /* é Capacidade, não fallback */
  const ppSemNatureza = ['P1', 'P2', 'P3', 'P4', 'P8'].every((c) => sim(m, c));
  const naturezaSemP5 = n === 'P13' ? true : (n === 'P11' ? false : !sim(m, 'P2'));
  if (!ppSemNatureza && !naturezaSemP5) return null;
  return { tipo: ppSemNatureza && naturezaSemP5 ? 'ambiguo' : (naturezaSemP5 ? 'autonomia' : 'natureza'), natureza: NATUREZA_DE[n], pergunta: n };
}

function carregar(src, config, espiar) {
  const ctx = { console, JSON, Object, Array, String, Math, Number, Date, RegExp, Error, Promise, WeakMap, Uint8Array, Uint16Array, TextEncoder, crypto: globalThis.crypto, setTimeout, clearTimeout, setInterval, clearInterval, parseFloat, parseInt, isNaN };
  ctx.window = ctx; ctx.window.window = ctx;
  const el = () => ({ addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, style: {}, classList: { add() {}, remove() {}, contains() { return false; } } });
  ctx.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, addEventListener() {}, body: el(), documentElement: el() };
  const ref = (p) => ({
    on(ev, cb) { if (p === 'motor-arquitetura-config' && config !== undefined) cb({ val: () => clone(config) }); },
    once() {}, off() {}, update() {}, set() {}, remove() {}, transaction() {}, child(c) { return ref(p + '/' + c); }, push() { return { key: 'k' }; }
  });
  ctx.firebase = { database: () => ({ ref }) };
  ctx.navigator = {}; ctx.location = { hash: '' }; ctx.localStorage = { getItem() { return null; }, setItem() {} };
  vm.createContext(ctx);
  vm.runInContext(src.qc, ctx, { filename: 'questionarios-config.js' });
  vm.runInContext(src.motor, ctx, { filename: 'motor-arquitetura.js' });
  if (espiar) espiar(ctx.window.faMotorArquitetura);
  const fim = src.avp.lastIndexOf('})();');
  vm.runInContext(src.avp.slice(0, fim) + '\nwindow.__avpTeste = { computeResultado: computeResultado, gerarJustificativaAutomatica: gerarJustificativaAutomatica, interpretacaoSistema: interpretacaoSistema, TODAS_PERGUNTAS: TODAS_PERGUNTAS, logicaDaVersao5Aprovada: logicaDaVersao5Aprovada, quandoCompatibilidadePronta: quandoCompatibilidadePronta };\n' + src.avp.slice(fim), ctx, { filename: 'avaliacao-produto.js' });
  if (config !== undefined) ctx.window.faMotorArquitetura.onMudanca(function () {});
  return { M: ctx.window.faMotorArquitetura, av: ctx.__avpTeste, Q: ctx.window.faQuestionarios };
}
function regrasV5(M) {
  const v5 = M.construirPropostaConflitoNaturezas(M.regrasVersao3Esperadas());
  v5.forEach((r) => { if (r.codigo === 'PRODUTO_SERVICO_PRINCIPAL' || r.codigo === 'UNIDADE_VALOR_ASSOCIADA') r.condicoes.all.push({ campo: 'P8', valor: 'SIM' }); });
  return v5;
}
function configs() {
  const { M } = carregar(SRC);
  const v3 = M.regrasVersao3Esperadas(), v4 = M.construirPropostaConflitoNaturezas(M.regrasVersao3Esperadas()), v5 = regrasV5(M);
  const com = (n, regras) => { const versoes = { 3: { regras: v3 }, 4: { regras: v4 } }; versoes[n] = { regras }; return { versaoPublicada: n, versoes }; };
  return { v3: { versaoPublicada: 3, versoes: { 3: { regras: v3 } } }, v4: com(4, v4), v5: com(5, v5), com5: (regras) => com(5, regras), regras: { v3, v4, v5 } };
}

/* Espera a compatibilidade das regras ativas (como Concluir/Reprocessar fazem no app). */
const pronto = (av) => new Promise((ok) => av.quandoCompatibilidadePronta(ok));
/* Varre as 65.536 combinações com o código real, DEPOIS da checagem de compatibilidade. */
async function varrer(src, config) {
  const { M, av } = carregar(src, config);
  await pronto(av);
  const TP = av.TODAS_PERGUNTAS, out = [];
  for (let m = 0; m < 65536; m++) {
    const resp = {};
    TP.forEach((d, i) => { const v = (m >> i) & 1 ? 'sim' : 'nao'; resp[d.id] = { valor: v, justificativaAuto: v === 'sim' ? d.justSim : d.justNao }; });
    const x = av.computeResultado({ respostas: resp });
    const just = av.gerarJustificativaAutomatica({ respostas: resp }, x);
    const item = { status: 'concluido', camadaSugerida: x.camadaSugerida };
    out.push({ m, x, just, interp: TP.map((d) => av.interpretacaoSistema(d, resp[d.id], item)), justSim: TP.map((d) => d.justSim) });
  }
  return { versao: M.versaoAtual(), out, M, av };
}
/* Impressão digital no formato da main, com a marca desta correção removida (estado da época). */
function digitalDaEpoca(r) {
  const h = crypto.createHash('sha256');
  r.out.forEach(({ m, x, just, interp, justSim }) => {
    const b = x.camadaSugerida.bloqueioNatureza;
    let j = just, i = interp, xx = x;
    if (b) {
      xx = clone(x); delete xx.camadaSugerida.bloqueioNatureza;
      j = JUSTIFICATIVA_GENERICA;
      i = interp.slice();
      if (b.tipo === 'autonomia') i[4] = semPrefixo(justSim[4]);
      if (b.tipo === 'natureza') { const k = Number(b.pergunta.slice(1)) - 1; i[k] = semPrefixo(justSim[k]); }
    }
    h.update(JSON.stringify([m, xx, j, i]) + '\n');
  });
  return h.digest('hex');
}
const LINHA_DETECCAO = 'var bloqueioNatureza = impedidaPorGestao ? null : bloqueioPorNatureza(contexto, regras, decisao);';
const SEM_DETECCAO = Object.assign({}, SRC, { avp: SRC.avp.replace(LINHA_DETECCAO, 'var bloqueioNatureza = null;') });
const LINHA_RESTRICAO = 'if (!logicaDaVersao5Aprovada(regras)) return null;';
const SEM_RESTRICAO = Object.assign({}, SRC, { avp: SRC.avp.replace(LINHA_RESTRICAO, '') });

function conferirV5(r) {
  const problemas = [], cont = { autonomia: 0, natureza: 0, ambiguo: 0 };
  let generico576 = 0;
  r.out.forEach(({ m, x, just, interp, justSim }) => {
    const c = x.camadaSugerida, b = c.bloqueioNatureza, esperado = oraculoV5(m);
    if (!esperado) {
      if (b) problemas.push(m + ': marca fora do previsto ' + JSON.stringify(b));
      const p5Uma = sim(m, 'P5') && Object.keys(NATUREZA_DE).filter((k) => sim(m, k)).length === 1 && c.id === 'a-validar' && !c.incoerencia && !c.conflitoNaturezas;
      if (p5Uma) { generico576++; if (just !== JUSTIFICATIVA_GENERICA) problemas.push(m + ': genérico mudou'); }
      return;
    }
    if (!b || b.tipo !== esperado.tipo || b.natureza !== esperado.natureza || b.pergunta !== esperado.pergunta) { problemas.push(m + ': marca ' + JSON.stringify(b) + ' ≠ ' + JSON.stringify(esperado)); return; }
    cont[b.tipo]++;
    if (c.id !== 'a-validar' || x.resultadoAutomatico !== 'a-validar' || c.label !== 'A validar') problemas.push(m + ': rótulo ' + c.label);
    if (c.motivos.length) problemas.push(m + ': motivos ' + JSON.stringify(c.motivos));
    if (just !== JUSTIFICATIVA[b.tipo](b.natureza)) problemas.push(m + ': justificativa ' + just);
    if (b.tipo === 'ambiguo' && just !== AMBIGUO_APROVADO) problemas.push(m + ': ambíguo fora do texto aprovado');
    const k = Number(b.pergunta.slice(1)) - 1;
    const esperadoP5 = b.tipo === 'autonomia' ? INTERP_P5(b.natureza) : semPrefixo(justSim[4]);
    const esperadoNat = b.tipo === 'natureza' ? INTERP_NATUREZA : semPrefixo(justSim[k]);
    if (interp[4] !== esperadoP5) problemas.push(m + ': interpretação de P5 ' + interp[4]);
    if (interp[k] !== esperadoNat) problemas.push(m + ': interpretação de ' + b.pergunta + ' ' + interp[k]);
  });
  return { problemas, cont, generico576 };
}

/* ===================== AUDITORIA ESTRUTURAL DOS CHAMADORES =====================
   Prova, sem exceção por nome, que todo ponto que CALCULA um resultado para gravar (computeResultado,
   gerarJustificativaAutomatica) só é alcançável DEPOIS de quandoCompatibilidadePronta — a espera é
   antecessora obrigatória de todo caminho até ele:
   1. o código é "mascarado" (strings, comentários e regex viram espaços) para casar as chaves;
   2. cada função (nomeada ou anônima) vira um intervalo; os callbacks passados a
      quandoCompatibilidadePronta(function …) são as "áreas protegidas";
   3. um ponto está protegido se, subindo pelas funções que o contêm, encontra uma área protegida ANTES de
      encontrar uma função nomeada; se encontrar primeiro uma função nomeada F, vale a proteção de F;
   4. F está protegida se TODO uso de F — cada chamada, em qualquer ramo, e cada referência sem
      parênteses (ex.: addEventListener('click', F)), que é uma entrada possível — estiver num ponto
      protegido. Calculado por ponto fixo (o maior): ciclos internos (ex.: um worker que se reagenda)
      continuam protegidos só se nenhuma entrada vem de fora sem a espera;
   5. cada uso é ligado à definição que ele enxerga pelo escopo léxico — funções homônimas em lugares
      diferentes nunca se confundem;
   6. guarda pelo primeiro parâmetro: se o ponto está dentro de `if (P === 'X') {` e P é o primeiro
      parâmetro de F, as chamadas de F com outro literal (ex.: 'rascunho') não alcançam o ponto.
   Nenhum nome de função é tratado de forma especial. Um caminho novo de gravação sem a espera deixa um
   ponto desprotegido e o teste falha (prova inversa logo abaixo). */
function mascarar(src) {
  const out = src.split('');
  let i = 0, anterior = '';
  const apagar = (a, b) => { for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' '; };
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { const f = src.indexOf('\n', i); const e = f === -1 ? src.length : f; apagar(i, e); i = e; continue; }
    if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2) + 2; apagar(i, e); i = e; continue; }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1; while (j < src.length && src[j] !== c) { if (src[j] === '\\') j++; j++; }
      apagar(i + 1, j); i = j + 1; anterior = 'a'; continue;
    }
    if (c === '/' && /^[(,=:[!&|?{};+\-*%<>~^]?$/.test(anterior)) {
      let j = i + 1, classe = false;
      while (j < src.length && src[j] !== '\n' && (classe || src[j] !== '/')) { if (src[j] === '\\') j++; else if (src[j] === '[') classe = true; else if (src[j] === ']') classe = false; j++; }
      apagar(i + 1, j); i = j + 1; anterior = 'a'; continue;
    }
    if (!/\s/.test(c)) {
      if (/[\w$]/.test(c)) { const p = /[\w$]+$/.exec(src.slice(Math.max(0, i - 10), i + 1))[0]; anterior = /^(return|typeof|case)$/.test(p) ? '(' : 'a'; } else anterior = c;
    }
    i++;
  }
  return out.join('');
}
function funcoesDe(m) {
  const fns = [], re = /\bfunction\b\s*([A-Za-z_$][\w$]*)?\s*\(/g; let x;
  while ((x = re.exec(m))) {
    const k = m.indexOf(')', x.index), a = m.indexOf('{', k); let prof = 0, j = a;
    for (; j < m.length; j++) { if (m[j] === '{') prof++; else if (m[j] === '}' && --prof === 0) break; }
    const params = m.slice(m.indexOf('(', x.index) + 1, k).split(',').map((t) => t.trim()).filter(Boolean);
    fns.push({ id: fns.length, nome: x[1] || null, ini: x.index, corpo: a, fim: j, params, protegida: /quandoCompatibilidadePronta\(\s*$/.test(m.slice(Math.max(0, x.index - 40), x.index)) });
  }
  /* escopo de declaração = corpo da função que contém a declaração (ou o arquivo inteiro) */
  fns.forEach((f) => {
    const pai = fns.filter((g) => g.corpo < f.ini && f.ini < g.fim).sort((a, b) => b.corpo - a.corpo)[0];
    f.escopo = pai ? [pai.corpo, pai.fim] : [0, m.length];
  });
  return fns;
}
function auditoriaEstrutural(src) {
  const m = mascarar(src), fns = funcoesDe(m);
  let balanco = 0; for (const c of m) { if (c === '{') balanco++; else if (c === '}') balanco--; }
  const cadeia = (pos) => fns.filter((f) => f.corpo < pos && pos < f.fim).sort((a, b) => b.corpo - a.corpo);
  const nomeadas = fns.filter((f) => f.nome);
  /* Cada uso de um nome é ligado à DEFINIÇÃO que ele enxerga (escopo léxico): a declaração de mesmo nome
     cujo escopo contém o uso e é o mais interno. Funções homônimas em lugares diferentes (ex.: três
     "encerrar") nunca se confundem. */
  const ocorrencias = {};
  const ocorrenciasDe = (nome) => {
    if (ocorrencias[nome]) return ocorrencias[nome];
    const r = [], re = new RegExp('(^|[^\\w$.])' + nome.replace(/\$/g, '\\$') + '(?![\\w$])', 'g'); let x;
    while ((x = re.exec(m))) { const pos = x.index + x[1].length; if (/function\s+$/.test(m.slice(Math.max(0, pos - 12), pos))) continue; r.push(pos); }
    return (ocorrencias[nome] = r);
  };
  const definicaoVista = (nome, pos) => nomeadas.filter((f) => f.nome === nome && f.escopo[0] <= pos && pos <= f.escopo[1]).sort((a, b) => b.escopo[0] - a.escopo[0])[0] || null;
  const usosDe = (f) => ocorrenciasDe(f.nome).filter((u) => definicaoVista(f.nome, u) === f);
  const primeiroArgLiteral = (pos, nome) => { const t = /^\s*\(\s*(['"])([^'"]*)\1/.exec(src.slice(pos + nome.length, pos + nome.length + 80)); return t ? t[2] : null; };
  function guardaDe(f, pos) {
    if (!f || !f.params.length) return null;
    const re = new RegExp('if \\(' + f.params[0] + " === '([^']*)'\\) \\{", 'g'), trecho = src.slice(f.corpo, f.fim);
    let x, g = null;
    while ((x = re.exec(trecho))) {
      let prof = 0, j = f.corpo + x.index + x[0].length - 1;
      for (; j < f.fim; j++) { if (m[j] === '{') prof++; else if (m[j] === '}' && --prof === 0) break; }
      if (f.corpo + x.index < pos && pos < j) g = x[1];
    }
    return g;
  }
  function pontoProtegido(pos, prot) {
    for (const f of cadeia(pos)) { if (f.protegida) return true; if (f.nome) return !!prot[f.id]; }
    return false;
  }
  function analisar(pos) {
    const dono = cadeia(pos).find((f) => f.nome || f.protegida);
    const guarda = dono && dono.nome ? guardaDe(dono, pos) : null;
    const prot = {}; nomeadas.forEach((f) => { prot[f.id] = true; });
    const usos = {}; nomeadas.forEach((f) => {
      usos[f.id] = usosDe(f).filter((u) => {
        if (!(dono && f === dono && guarda !== null)) return true;
        const l = primeiroArgLiteral(u, f.nome);
        return l === null || l === guarda;
      });
    });
    for (let mudou = true; mudou;) {
      mudou = false;
      for (const f of nomeadas) {
        if (!prot[f.id]) continue;
        if (!usos[f.id].length || usos[f.id].some((u) => !pontoProtegido(u, prot))) { prot[f.id] = false; mudou = true; }
      }
    }
    return { protegido: pontoProtegido(pos, prot), dono: dono ? (dono.protegida ? '(callback de quandoCompatibilidadePronta)' : dono.nome) : '(topo)', guarda };
  }
  const alvos = [];
  ['computeResultado', 'gerarJustificativaAutomatica'].forEach((nome) => {
    ocorrenciasDe(nome).forEach((pos) => { if (/^\s*\(/.test(m.slice(pos + nome.length, pos + nome.length + 5))) alvos.push(Object.assign({ nome, linha: src.slice(0, pos).split('\n').length }, analisar(pos))); });
  });
  return { balanco, alvos };
}

async function parteA() {
  console.log('== PARTE A — código real, as 65.536 combinações ==');
  const C = configs();
  const MOTOR_VERSION = /var MOTOR_VERSION = '([^']+)'/.exec(SRC.avp)[1];
  afirma(MOTOR_VERSION === MOTOR_VERSION_ESPERADA, 'MOTOR_VERSION não mudou: ' + MOTOR_VERSION);
  afirma(SRC.motor.indexOf('bloqueioNatureza') === -1, 'o motor não conhece a marca — ela não participa da decisão');
  afirma(SRC.avp.indexOf(LINHA_DETECCAO) !== -1 && SRC.avp.indexOf(LINHA_RESTRICAO) !== -1, 'detecção e restrição à versão 5 existem no código (base da prova inversa)');

  console.log('\n-- motor: identificarCamada idêntico ao da main --');
  const { M } = carregar(SRC);
  const conj = { fabrica: M.PADRAO_REGRAS.regras, v3: C.regras.v3, v4: C.regras.v4, v5: C.regras.v5 };
  Object.keys(conj).forEach((k) => {
    const h = crypto.createHash('sha256'); const ctx = {};
    for (let n = 0; n < 65536; n++) { for (let b = 0; b < 16; b++) ctx['P' + (b + 1)] = (n & (1 << b)) ? 'SIM' : 'NAO'; h.update(JSON.stringify(M.identificarCamada(ctx, { regras: conj[k] })) + '\n'); }
    afirma(h.digest('hex') === DIGITAL_MOTOR[k], k + ': retorno completo de identificarCamada idêntico ao da main nas 65.536 combinações');
  });

  console.log('\n-- referência fixa da lógica da versão 5 (SHA-256) --');
  const REF = /var ASSINATURA_LOGICA_VERSAO5 = '([0-9a-f]+)'/.exec(SRC.avp)[1];
  afirma(/^[0-9a-f]{64}$/.test(REF), 'a referência é um SHA-256 (64 dígitos hexadecimais)');
  afirma(await M.assinaturaSemantica(C.regras.v5) === REF, 'a versão 5 reconstruída produz exatamente o SHA-256 fixo no código (' + REF.slice(0, 16) + '…)');
  const v5seq = M.criarVarreduraSemantica({ regras: C.regras.v5 }); let passos = 0; while (!v5seq.avancar(512)) passos++;
  /* recálculo INDEPENDENTE no Node, a partir da sequência por extenso: etiquetas distintas em ordem
     alfabética + byte 0 + índice de cada combinação em 2 bytes big endian */
  const canonicoNode = (seq) => {
    const ls = seq.split('\n'), ord = Array.from(new Set(ls)).sort(), pos = new Map(ord.map((r, i) => [r, i]));
    const cab = Buffer.from(ord.join('\n'), 'utf8'), b = Buffer.alloc(cab.length + 1 + ls.length * 2);
    cab.copy(b, 0); b[cab.length] = 0; ls.forEach((r, k) => b.writeUInt16BE(pos.get(r), cab.length + 1 + 2 * k));
    return crypto.createHash('sha256').update(b).digest('hex');
  };
  afirma(canonicoNode(v5seq.sequencia()) === REF && await v5seq.assinatura() === REF,
    'varredura em pedaços (' + (passos + 1) + ') dá o mesmo SHA-256, recalculado de forma independente pelo crypto do Node a partir da sequência por extenso');
  afirma(v5seq.sequencia().split('\n').length === 65536 && !/motivo|Componente:|justific/i.test(v5seq.sequencia()), 'a sequência tem 65.536 linhas e nenhum texto (só camada, tipo de decisão e camadas em conflito)');
  const outras = await Promise.all(['v3', 'v4', 'fabrica'].map((k) => M.assinaturaSemantica(conj[k])));
  afirma(outras.every((h) => h !== REF), 'versões 3, 4 e fábrica têm SHA-256 diferentes');

  console.log('\n-- versão 5 publicada --');
  const r5 = await varrer(SRC, C.v5);
  afirma(r5.versao === 5, 'motor lendo a versão 5');
  const k5 = conferirV5(r5);
  afirma(k5.cont.autonomia === 316 && k5.cont.natureza === 16 && k5.cont.ambiguo === 4,
    'exatamente os previstos pelo oráculo: 316 "autonomia", 16 "natureza", 4 ambíguos (P13) = 336 — ' + JSON.stringify(k5.cont));
  afirma(k5.generico576 === 240, 'os outros ' + k5.generico576 + ' (de 576) continuam com o texto genérico (esperado 240)');
  afirma(k5.problemas.length === 0, 'justificativa, interpretação de P5/da natureza, rótulo "A validar" e motivos exatos; nada fora do previsto', k5.problemas.slice(0, 3).join(' | '));
  afirma(digitalDaEpoca(r5) === DIGITAL_AVALIACAO.v5, 'com a marca removida, TUDO é idêntico à main nas 65.536 (classificação, P8, conflito, incoerência, Canal, Documento, textos)');
  const marcasP8 = r5.out.filter((o) => o.x.camadaSugerida.impedidaPorGestao).length;
  afirma(marcasP8 === 8 && r5.out.every((o) => !(o.x.camadaSugerida.impedidaPorGestao && o.x.camadaSugerida.bloqueioNatureza)), 'os 8 casos de P8 (#290) continuam marcados, e nunca junto com esta marca');
  const r5sem = await varrer(SEM_DETECCAO, C.v5);
  const difClass = r5.out.filter((o, i) => JSON.stringify([o.x.camadaSugerida.id, o.x.resultadoAutomatico, o.x.camadaSugerida.label]) !==
    JSON.stringify([r5sem.out[i].x.camadaSugerida.id, r5sem.out[i].x.resultadoAutomatico, r5sem.out[i].x.camadaSugerida.label])).length;
  afirma(difClass === 0, 'nenhuma das 65.536 classificações muda em relação ao código sem a detecção');

  console.log('\n-- regras em que o tratamento NÃO vale --');
  for (const [nome, cfg, k] of [['fábrica', undefined, 'fabrica'], ['versão 3', C.v3, 'v3'], ['versão 4', C.v4, 'v4']]) {
    const r = await varrer(SRC, cfg);
    const marcas = r.out.filter((o) => o.x.camadaSugerida.bloqueioNatureza).length;
    afirma(marcas === 0 && digitalDaEpoca(r) === DIGITAL_AVALIACAO[k], nome + ': nenhuma marca e tudo idêntico à main nas 65.536 (' + marcas + ' marcas)');
  }
  const contarMarcas = async (regras) => {
    const { av } = carregar(SRC, C.com5(regras)); await pronto(av); let n = 0;
    for (let m = 0; m < 65536; m++) {
      if (!sim(m, 'P5')) continue;
      const resp = {}; ORDEM.forEach((id, i) => { resp[id] = { valor: (m >> i) & 1 ? 'sim' : 'nao' }; });
      if (av.computeResultado({ respostas: resp }).camadaSugerida.bloqueioNatureza) n++;
    }
    return n;
  };
  const textual = clone(C.regras.v5);
  textual.forEach((r) => { r.motivos = (r.motivos || []).slice().reverse(); if (r.condicoes && Array.isArray(r.condicoes.all)) r.condicoes.all.reverse(); r.ordem = r.ordem * 10; });
  textual.find((r) => r.codigo === 'COMPONENTE').codigo = 'COMPONENTE_RENOMEADO';
  textual.find((r) => r.codigo === 'PRODUTO_SERVICO_PRINCIPAL').observacao = 'redação revisada';
  afirma(await M.assinaturaSemantica(textual) === REF && await contarMarcas(textual) === 336, 'versão 5 só com mudança de texto/forma (motivos, ordem das condições, numeração, código renomeado, observação): mesmo SHA-256, tratamento ligado (336)');
  const logica1 = clone(C.regras.v5); logica1.find((r) => r.codigo === 'COMPONENTE').condicoes.all.push({ campo: 'P6', valor: 'NAO' });
  const logica2 = clone(C.regras.v5); const u = logica2.find((r) => r.codigo === 'UNIDADE_VALOR_ASSOCIADA'); u.condicoes.all = u.condicoes.all.filter((c) => c.campo !== 'P8');
  afirma(await M.assinaturaSemantica(logica1) !== REF && await M.assinaturaSemantica(logica2) !== REF && await contarMarcas(logica1) === 0 && await contarMarcas(logica2) === 0,
    'versão 5 com mudança lógica mínima (Componente exige P6 = NÃO; Unidade de valor sem P8): SHA-256 diferente, tratamento desligado (0)');

  console.log('\n-- marca, cache, espera e caminhos sem espera --');
  {
    const { av } = carregar(SRC, C.v5); await pronto(av);
    const resp = {}; ORDEM.forEach((id, i) => { resp[id] = { valor: (16400 >> i) & 1 ? 'sim' : 'nao' }; });
    const limpo = av.computeResultado({ respostas: resp });
    const forjado = av.computeResultado({ respostas: resp, camadaSugerida: { id: 'a-validar', bloqueioNatureza: { tipo: 'natureza', natureza: 'componente', pergunta: 'P15' } }, bloqueioNatureza: { tipo: 'ambiguo' } });
    afirma(JSON.stringify(limpo) === JSON.stringify(forjado) && limpo.camadaSugerida.bloqueioNatureza.tipo === 'autonomia', 'a marca nunca é lida como entrada: uma marca forjada no item não muda nada');
  }
  const espiao = () => {
    const conta = { deUmaVez: 0, pedacos: 0 };
    return { conta, espiar: (MM) => {
      const a = MM.assinaturaSemantica, b = MM.criarVarreduraSemantica;
      MM.assinaturaSemantica = function () { conta.deUmaVez++; return a.apply(this, arguments); };
      MM.criarVarreduraSemantica = function () { conta.pedacos++; return b.apply(this, arguments); };
    } };
  };
  const RESP_4112 = {}; ORDEM.forEach((id, i) => { RESP_4112[id] = { valor: (4112 >> i) & 1 ? 'sim' : 'nao' }; });
  {
    const e = espiao(); const { av, M: MM } = carregar(SRC, C.v5, e.espiar);
    const antes = av.computeResultado({ respostas: RESP_4112 });
    afirma(!antes.camadaSugerida.bloqueioNatureza && e.conta.pedacos === 0 && e.conta.deUmaVez === 0,
      'cálculo interno com a compatibilidade ainda desconhecida: comportamento anterior (sem marca) e NENHUMA varredura síncrona');
    let chamou = false;
    const imediato = new Promise((ok) => av.quandoCompatibilidadePronta(() => { chamou = true; ok(av.computeResultado({ respostas: RESP_4112 })); }));
    afirma(!chamou, 'concluir logo ao abrir: com a compatibilidade desconhecida, a gravação espera (não responde na hora)');
    const xImediato = await imediato;
    afirma(e.conta.pedacos === 1 && e.conta.deUmaVez === 0, 'a espera usou só a varredura em pedaços, nunca a de uma vez (' + JSON.stringify(e.conta) + ')');
    const e2 = espiao(); const { av: av2 } = carregar(SRC, C.v5, e2.espiar); await pronto(av2);
    const xDepois = av2.computeResultado({ respostas: RESP_4112 });
    afirma(JSON.stringify(xImediato) === JSON.stringify(xDepois) && xImediato.camadaSugerida.bloqueioNatureza.tipo === 'autonomia',
      'conclusão imediata grava EXATAMENTE o mesmo resultado que uma conclusão com o cache já pronto (texto específico, nunca o genérico por pressa)');
    for (let m = 0; m < 4096; m++) { const resp = {}; ORDEM.forEach((id, i) => { resp[id] = { valor: ((m | 16) >> i) & 1 ? 'sim' : 'nao' }; }); av.computeResultado({ respostas: resp }); }
    let ja = false; av.quandoCompatibilidadePronta(() => { ja = true; });
    afirma(ja && e.conta.pedacos === 1, 'cache: mais 4.096 cálculos e nova espera → nenhuma varredura nova, espera imediata');
    const nova = clone(MM.regrasDaVersao(5).regras);
    await new Promise((ok) => { av.logicaDaVersao5Aprovada({ regras: nova }); ok(); });
    afirma(e.conta.pedacos === 1 && av.logicaDaVersao5Aprovada({ regras: nova }) === false, 'outro conjunto de regras sem checagem: desconhecido = tratamento desligado, sem varredura síncrona');
  }

  console.log('\n-- auditoria estrutural dos caminhos de gravação (produção) --');
  {
    const a = auditoriaEstrutural(SRC.avp);
    afirma(a.balanco === 0, 'código mascarado com chaves balanceadas (análise confiável)');
    a.alvos.forEach((t) => console.log('        ' + t.nome + ' (linha ' + t.linha + ') em ' + t.dono + (t.guarda ? " [só quando status === '" + t.guarda + "']" : '') + ' → ' + (t.protegido ? 'só depois de quandoCompatibilidadePronta' : 'SEM ESPERA')));
    afirma(a.alvos.length >= 6 && a.alvos.every((t) => t.protegido), 'todo ponto que calcula resultado para gravar só é alcançável depois de quandoCompatibilidadePronta (' + a.alvos.length + ' pontos)',
      a.alvos.filter((t) => !t.protegido).map((t) => t.nome + '@' + t.linha).join(', '));
    const donos = Array.from(new Set(a.alvos.map((t) => t.dono))).sort();
    afirma(donos.every((d) => d !== '(topo)') && !donos.some((d) => /render|pdf|excel|exportar|linha/i.test(d)), 'nenhuma tela, PDF ou Excel recalcula: os pontos ficam em ' + JSON.stringify(donos));
    afirma(!/assinaturaSemantica\(/.test(SRC.avp), 'avaliacao-produto.js nunca chama a varredura de uma vez (assinaturaSemantica)');
    afirma(/'camadaSugerida\/especializacao': ident\.especializacao,\s*'camadaSugerida\/papelEstrutural': ident\.papelEstrutural,/.test(SRC.avp) && !/camadaSugerida\/bloqueioNatureza/.test(SRC.avp),
      'a gravação de curadoria (especialização/papel) nunca grava a marca nem a justificativa');
    console.log('   prova inversa da auditoria (mutações em memória, uma por vez):');
    const mut = (a1, b1) => { const r = SRC.avp.replace(a1, b1); return r === SRC.avp ? null : r; };
    [['lote sem a espera', mut('quandoCompatibilidadePronta(function () {\n        var n = Math.min(CONCORRENCIA', '(function () {\n        var n = Math.min(CONCORRENCIA')],
      ['Concluir sem a espera', mut("quandoCompatibilidadePronta(function () { salvarRegistro('concluido'", "(function () { salvarRegistro('concluido'")],
      ['Reprocessar individual sem a espera', mut('quandoCompatibilidadePronta(function () {\n        var updates;', '(function () {\n        var updates;')],
      ['lote com um ramo novo que inicia um worker sem a espera', mut('      quandoCompatibilidadePronta(function () {\n        var n = Math.min(CONCORRENCIA', '      if (fila.length > 100) { workersAtivos = 1; worker(); }\n      quandoCompatibilidadePronta(function () {\n        var n = Math.min(CONCORRENCIA')],
      ['caminho novo (prévia na tela) calculando sem a espera', mut('    function renderResultado() {', '    function previaDoResultado() { return computeResultado(state.atual); }\n    function renderResultado() { previaDoResultado();')],
      ["Concluir chamando a gravação de 'concluido' fora da espera", mut("salvarRegistro('rascunho', function (payload, key) {", "salvarRegistro('concluido', function (payload, key) {")]
    ].forEach(([nome, texto]) => {
      const r = texto && auditoriaEstrutural(texto);
      afirma(!!texto && r.alvos.some((t) => !t.protegido), nome + ' → a auditoria FALHA (' + (r ? r.alvos.filter((t) => !t.protegido).map((t) => t.nome + ' em ' + t.dono).join('; ') : 'mutação não aplicada') + ')');
    });
  }

  console.log('\n   prova inversa — a conferência falha sem a detecção ou sem a restrição à versão 5:');
  const kSem = conferirV5(r5sem);
  afirma(kSem.problemas.length === 336, 'sem a detecção → FALHA (' + kSem.problemas.length + ' problemas)');
  const rSemRestr = await varrer(SEM_RESTRICAO, C.v3);
  const marcasV3 = rSemRestr.out.filter((o) => o.x.camadaSugerida.bloqueioNatureza).length;
  afirma(SEM_RESTRICAO.avp !== SRC.avp && marcasV3 === 288 && digitalDaEpoca(rSemRestr) === DIGITAL_AVALIACAO.v3,
    'sem a restrição à versão 5 → a versão 3 restaurada ganharia ' + marcasV3 + ' explicações novas (a conferência "nenhuma marca" FALHA)');
}

/* ------------------------------ PARTE B ---------------------------------- */
function item(nome, mascara) {
  const { av, Q } = carregar(SRC);
  const respostas = {};
  av.TODAS_PERGUNTAS.forEach((d, i) => {
    const v = (mascara >> i) & 1 ? 'sim' : 'nao';
    const c = Q.conteudoPergunta('CLASSIFICACAO_ARQUITETURAL', d.codigoEstavel);
    respostas[d.id] = { valor: v, observacao: '', justificativaAuto: v === 'sim' ? c.justSim : c.justNao, codigoPergunta: d.codigoEstavel, textoPerguntaNaEpoca: c.texto, tituloNaEpoca: c.titulo, questionnaireContentVersion: 1 };
  });
  return {
    nome, descricao: '', publico: '', necessidade: '', observacoesGerais: '', status: 'concluido', respostas,
    resultadoAutomatico: 'a-validar', decisaoFinal: 'a-validar', decisaoManual: false,
    camadaSugerida: { id: 'a-validar', label: 'A validar', motivos: [], conflito: null, incoerencia: false, especializacao: null, papelEstrutural: null, relacao: null },
    justificativaAutomatica: JUSTIFICATIVA_GENERICA,
    criteriosEssenciaisFalhos: [], exclusoesConflitantes: null, criteriosAtendidos: 3,
    motorVersion: MOTOR_VERSION_ESPERADA, motorVersionArquitetura: 4, questionnaireContentVersion: 1, criadoEm: '2026-10-04T10:00:00.000Z', atualizadoEm: '2026-10-04T10:00:00.000Z',
    responsavel: { name: 'Teste', email: EMAIL }, versao: 1, versaoAnteriorKey: null, excluido: false, excluidoEm: null, excluidoPor: null,
    justificativaExclusao: null, historicoMotor: null, itemId: nome
  };
}
/* 16400: P5 + P15 (autonomia × Componente); 16543: P1–P5, P8 + P15 (Componente × Produto/Serviço);
   4255: P1–P5, P8 + P13 (ambíguo) */
const CASOS = [
  { key: 'aut1', nome: 'Item ficticio autonomia componente', mascara: 16400, tipo: 'autonomia', natureza: 'componente', pergunta: 15 },
  { key: 'nat1', nome: 'Item ficticio natureza componente', mascara: 16543, tipo: 'natureza', natureza: 'componente', pergunta: 15 },
  { key: 'amb1', nome: 'Item ficticio ambiguo modalidade', mascara: 4255, tipo: 'ambiguo', natureza: 'modalidade-subproduto', pergunta: 13 }
];
const NOVA = { nome: 'Nova ficticia autonomia modalidade', mascara: 4112, tipo: 'autonomia', natureza: 'modalidade-subproduto' };

async function abrir(browser, viewport) {
  const admins = {}; admins[chave(EMAIL)] = { email: EMAIL };
  const itens = {}; CASOS.forEach((c) => { itens[c.key] = item(c.nome, c.mascara); });
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': admins, 'turmas-config': {}, 'turmas-checkin': {}, 'turmas-espera': {},
    'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {}, eventos: {}, 'turmas-publico': {}, 'eventos-publico': {},
    'avaliacoes-produto': itens, 'avaliacoes-squad': {}, 'motor-squad-config': {}, 'motor-squad-auditoria': {},
    'motor-arquitetura-config': configs().v5, 'motor-arquitetura-auditoria': {}, 'fa-avaliacao-acessos': {} };
  const cfgPagina = { db, user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true };
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfgPagina) + ';');
  await ctx.addInitScript(`
    window.__pdfs = [];
    new MutationObserver(function (ms) {
      ms.forEach(function (m) { m.addedNodes.forEach(function (n) {
        if (n.nodeType !== 1 || n.parentNode !== document.body) return;
        var doc = n.classList && n.classList.contains('pdf-doc') ? n : (n.querySelector && n.querySelector('.pdf-doc'));
        if (!doc) return;
        window.__pdfs.push({ tudo: doc.innerText });
      }); });
    }).observe(document, { childList: true, subtree: true });`);
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#avaliacoes', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.body.classList.contains('aguardando-auth'), { timeout: 16000 }).catch(() => {});
  await page.waitForSelector('#avpNovoBtn', { timeout: 8000 });
  return { ctx, page, erros };
}
const banco = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal || window.__CFG.db)));
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const espaco = (t) => (t || '').replace(/\s+/g, ' ');
async function foto(locator, nome) { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await locator.screenshot({ path: path.join(SHOTS, nome + '.png') }); } }
async function abrirPorQue(page) { await page.evaluate(() => { const d = document.getElementById('avpPorQueDet'); if (d && !d.open) d.querySelector('summary').click(); }); }
const interpretacaoTela = (page, n) => page.evaluate((num) => {
  const it = Array.from(document.querySelectorAll('.avp-reasoning-item')).find((d) => new RegExp('^' + num + '\\.').test((d.querySelector('.avp-reasoning-q') || {}).textContent || ''));
  const p = it && it.querySelector('.avp-reasoning-auto');
  return p ? p.textContent.replace(/^Interpretação do sistema:\s*/, '').replace(/\s+/g, ' ').trim() : null;
}, n);
async function gerarPdf(page) {
  await page.evaluate(() => { window.__pdfs = []; });
  await Promise.all([page.waitForEvent('download', { timeout: 60000 }).catch(() => null), page.click('#avpGerarPdfBtn')]);
  await page.waitForTimeout(500);
  return page.evaluate(() => { const t = []; (window.__pdfs || []).forEach((b) => { if (t.indexOf(b.tudo) === -1) t.push(b.tudo); }); return t.join('\n').replace(/\s+/g, ' '); });
}
async function lerExcel(page) {
  await page.click('#avpExportarBtn');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#avpExportarExcelTodas')]);
  const arq = path.join(require('os').tmpdir(), 'avp-natureza-p5-' + process.pid + '-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.xlsx');
  await dl.saveAs(arq);
  const wb = XLSX.read(fs.readFileSync(arq), { type: 'buffer' });
  fs.unlinkSync(arq);
  const aba = (nome) => wb.Sheets[nome] ? XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, defval: '' }) : [];
  const resumo = aba('Resumo'), resp = aba('Respostas do questionário');
  const col = (linhas, nome) => (linhas[0] || []).indexOf(nome);
  return {
    classificacao: (nomeItem) => { const l = resumo.find((x) => x[1] === nomeItem); return l ? l[col(resumo, 'Classificação arquitetural')] : null; },
    interpretacao: (nomeItem, num) => { const l = resp.find((x) => x[1] === nomeItem && Number(x[col(resp, 'Número da pergunta')]) === num); return l ? l[col(resp, 'Interpretação do sistema')] : null; }
  };
}
async function voltarLista(page) {
  await page.click('#avpVoltarListaResultado');
  await page.waitForSelector('#avpNovoBtn', { timeout: 8000 });
  await page.waitForTimeout(300);
}
async function abrirItem(page, key) {
  await page.click('.avp-act-ver[data-key="' + key + '"]');
  await page.waitForSelector('#avpSecaoSistema', { timeout: 8000 });
  await page.waitForTimeout(300);
  await abrirPorQue(page);
}
const interpEsperada = (c, num) => {
  if (c.tipo === 'autonomia' && num === 5) return INTERP_P5(c.natureza);
  if (c.tipo === 'natureza' && num === c.pergunta) return INTERP_NATUREZA;
  return null; /* = interpretação de sempre */
};

async function parteB(browser) {
  for (const [nomeTela, viewport, sufixo] of [['desktop', DESKTOP, 'desktop'], ['celular 375px', CELULAR, '375']]) {
    console.log('\n######## ' + nomeTela + ' ########');
    const { ctx, page, erros } = await abrir(browser, viewport);

    console.log('-- avaliação NOVA concluída logo ao abrir a página --');
    await page.click('#avpNovoBtn');
    await page.fill('#avpfNome', NOVA.nome);
    await page.click('#avpIniciarBtn');
    await page.waitForTimeout(150);
    for (let i = 0; i < ORDEM.length; i++) await page.locator('#avpQuestion-' + ORDEM[i] + ' .avp-choice-btn--' + ((NOVA.mascara >> i) & 1 ? 'sim' : 'nao')).click();
    await page.click('#avpConcluirBtn');
    await page.waitForSelector('#avpSecaoSistema', { timeout: 8000 });
    await page.waitForTimeout(300);
    await abrirPorQue(page);
    const novaGravada = Object.values((await banco(page))['avaliacoes-produto']).find((x) => x.nome === NOVA.nome);
    afirma(novaGravada && novaGravada.camadaSugerida.bloqueioNatureza && novaGravada.camadaSugerida.bloqueioNatureza.tipo === 'autonomia' &&
      novaGravada.justificativaAutomatica === JUSTIFICATIVA.autonomia(NOVA.natureza), 'nova: marca e justificativa gravadas ("autonomia" × Modalidade)');
    const telaNova = espaco(await page.locator('#avpSecaoSistema').innerText());
    afirma(telaNova.indexOf('Camada identificada: A validar') !== -1 && telaNova.indexOf(JUSTIFICATIVA.autonomia(NOVA.natureza)) !== -1, 'nova: tela com "A validar" e a justificativa nova');
    afirma(await interpretacaoTela(page, 5) === INTERP_P5(NOVA.natureza), 'nova: interpretação de P5 específica');
    afirma(await larguraOk(page), 'nova: sem rolagem horizontal');
    await voltarLista(page);

    console.log('-- avaliações gravadas antes (sem a marca) --');
    for (const c of CASOS) {
      await abrirItem(page, c.key);
      const tela = espaco(await page.locator('#avpSecaoSistema').innerText());
      afirma(tela.indexOf(JUSTIFICATIVA_GENERICA) !== -1 && tela.indexOf(JUSTIFICATIVA[c.tipo](c.natureza)) === -1, c.key + ': tela mostra a justificativa da época');
      const i5 = await interpretacaoTela(page, 5), iN = await interpretacaoTela(page, c.pergunta);
      afirma(i5 && i5.indexOf('impediu') === -1 && iN && iN.indexOf('impediu') === -1, c.key + ': interpretações de P5 e P' + c.pergunta + ' da época', i5 + ' / ' + iN);
      const pdf = await gerarPdf(page);
      afirma(pdf.indexOf('Justificativa da classificação ' + JUSTIFICATIVA_GENERICA) !== -1 && pdf.indexOf('impediu a classificação') === -1, c.key + ': PDF da época');
      await voltarLista(page);
    }
    let ex = await lerExcel(page);
    CASOS.forEach((c) => afirma(String(ex.interpretacao(c.nome, 5)).indexOf('impediu') === -1 && String(ex.interpretacao(c.nome, c.pergunta)).indexOf('impediu') === -1 && ex.classificacao(c.nome) === 'A validar',
      c.key + ': Excel com as interpretações da época e "A validar"'));
    const gravado = (await banco(page))['avaliacoes-produto'];
    afirma(CASOS.every((c) => gravado[c.key].justificativaAutomatica === JUSTIFICATIVA_GENERICA && !('bloqueioNatureza' in gravado[c.key].camadaSugerida)), 'nada recalculado ao exibir: texto gravado da época e sem marca');

    console.log('-- reprocessadas com a versão 5 --');
    for (const c of CASOS) {
      await abrirItem(page, c.key);
      await page.click('#avpReprocessarBtn');
      await page.click('.avp-modal-confirm-btn');
      await page.waitForFunction((k) => { const it = window.__CFG.__dbReal['avaliacoes-produto'][k]; return it && it.motorVersionArquitetura === 5; }, c.key, { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(300);
      const it = (await banco(page))['avaliacoes-produto'][c.key];
      afirma(it.motorVersionArquitetura === 5 && it.camadaSugerida.id === 'a-validar' && it.camadaSugerida.label === 'A validar', c.key + ': reprocessado — continua "A validar"');
      const b = it.camadaSugerida.bloqueioNatureza || {};
      afirma(b.tipo === c.tipo && b.natureza === c.natureza && b.pergunta === 'P' + c.pergunta, c.key + ': marca gravada = ' + JSON.stringify(b));
      afirma(it.justificativaAutomatica === JUSTIFICATIVA[c.tipo](c.natureza), c.key + ': justificativa gravada = texto aprovado');
      afirma(it.historicoMotor && Object.values(it.historicoMotor).some((h) => h.justificativaAutomatica === JUSTIFICATIVA_GENERICA), c.key + ': histórico do motor guarda o texto anterior');
      await abrirPorQue(page);
      const tela = espaco(await page.locator('#avpSecaoSistema').innerText());
      afirma(tela.indexOf('Camada identificada: A validar') !== -1 && tela.indexOf(JUSTIFICATIVA[c.tipo](c.natureza)) !== -1 && tela.indexOf('evidência suficiente') === -1, c.key + ': tela — "A validar" e justificativa nova');
      for (const num of [5, c.pergunta]) {
        const esp = interpEsperada(c, num), t = await interpretacaoTela(page, num);
        afirma(esp ? t === esp : (t && t.indexOf('impediu') === -1), c.key + ': tela — interpretação da pergunta ' + num + (esp ? ' específica' : ' de sempre'), t);
      }
      afirma(await larguraOk(page), c.key + ': tela sem rolagem horizontal');
      await foto(page.locator('#avpSecaoSistema'), 'a-validar-natureza-' + c.key + '-' + sufixo);
      const pdf = await gerarPdf(page);
      afirma(pdf.indexOf('Justificativa da classificação ' + JUSTIFICATIVA[c.tipo](c.natureza)) !== -1 && pdf.indexOf('Classificação arquitetural A validar') !== -1, c.key + ': PDF — justificativa nova e "A validar"');
      const espPdf = interpEsperada(c, 5) || interpEsperada(c, c.pergunta);
      afirma(espPdf ? pdf.indexOf(espPdf) !== -1 : pdf.indexOf('impediu a classificação') === -1, c.key + ': PDF — interpretação ' + (espPdf ? 'específica' : 'de sempre (ambíguo não tem interpretação própria)'));
      await voltarLista(page);
    }
    ex = await lerExcel(page);
    CASOS.forEach((c) => {
      const ok = [5, c.pergunta].every((num) => { const esp = interpEsperada(c, num), t = String(ex.interpretacao(c.nome, num)); return esp ? t === esp : t.indexOf('impediu') === -1; });
      afirma(ok && ex.classificacao(c.nome) === 'A validar', c.key + ': Excel — interpretações e "A validar"');
    });
    afirma(await larguraOk(page), 'lista sem rolagem horizontal');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }
}

(async () => {
  await parteA();
  const browser = await chromium.launch();
  try { await parteB(browser); } finally { await browser.close(); }
  console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
