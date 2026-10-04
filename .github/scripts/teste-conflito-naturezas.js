/* Política geral de conflitos de natureza predominante (P11–P15) — proposta da versão 4.
 *
 * Decisão conceitual (aprovada): P11 Capacidade, P12 Processo/Etapa, P13 Modalidade/Subproduto,
 * P14 Regra/Opção e P15 Componente perguntam, cada uma, se o item é PRINCIPALMENTE aquela
 * natureza; as definições curadas não estabelecem hierarquia entre elas. Duas ou mais SIM →
 * "A validar — conflito de naturezas predominantes", independentemente de P5, citando SÓ as
 * naturezas marcadas. P9, P10 e P16 ficam fora. Também: Componente só por P15 (sai P13) e
 * Modalidade sem exigir P2 = SIM. A regra CONFLITO_PROCESSO_CAPACIDADE é absorvida.
 *
 * O PR NÃO publica nada: entrega o operador "pelo menos N de", o conflito dinâmico nos textos e
 * uma PROPOSTA que a administradora carrega no editor (ação explícita), salva, simula e decide.
 *
 * PARTE A (sem navegador — código real em vm, as 65.536 combinações):
 *   A1 código novo + versão 3 publicada = EXATAMENTE o resultado de antes (motor e textos:
 *      impressões digitais calculadas com o código da main antes desta mudança);
 *   A2 a proposta reproduz a simulação aprovada (2.336 mudanças de camada, 4.384 só de motivo,
 *      distribuição final, nada inalcançável, cobertura total, Produto principal / Unidade de
 *      valor / Canal / Informação / Funcionalidade / INCOERÊNCIA sem nenhuma mudança);
 *   A3 conflitos com 2, 3, 4 e 5 naturezas; a lista dinâmica é EXATAMENTE a das perguntas SIM,
 *      nunca uma NÃO — no motor, no motivo, no rótulo e na justificativa — com prova inversa;
 *   A4 o operador: execução = prova exaustiva, validação, comparação entre versões, perguntas usadas;
 *   A5 a proposta só fica disponível sobre a versão 3 exata, e consultar nunca grava nada.
 * PARTE B (navegador, banco falso com persistência real; desktop e 375 px):
 *   B1 editor: carregar a proposta (nada gravado), ver o bloco "pelo menos 2", simular, salvar o
 *      rascunho (versão publicada, avaliações e auditoria intocadas), reabrir;
 *   B2 bloqueios: versão 3 divergente, outra versão publicada, edição em andamento;
 *   B3 resultado e PDF de uma avaliação reprocessada com a versão 4: rótulo, naturezas indicadas,
 *      justificativa e motivo — só as naturezas marcadas.
 * Hermético: sem rede, sem segredo. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const RAIZ = path.join(__dirname, '..', '..', 'forca-agil');
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

/* Impressões digitais da VERSÃO 3 publicada, calculadas com o código da main ANTES desta mudança
   (motor-arquitetura.js, avaliacao-produto.js e questionarios-config.js de f291b7f): o retorno
   completo do motor e, na avaliação, computeResultado (classificação, rótulo, motivos, conflito,
   incoerência, especialização, papel, relação) + a justificativa, nas 65.536 combinações. Só
   podem mudar se a lógica da versão 3 mudar — o que este PR não pode fazer. */
const DIGITAL_V3_MOTOR = '85ee307243a19c286954794b34626524d331fa387c256382dc38748b341b91aa';
const DIGITAL_V3_AVALIACAO = '3a069f009f49622a760c8679a5943f7e1a6450ca6c64d85ff51738176fe74d3b';

const ORDEM = ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia', 'jornada', 'medicao', 'gestao',
  'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'];
const NATUREZAS = ['P11', 'P12', 'P13', 'P14', 'P15'];
const ROTULO_NATUREZA = { P11: 'Capacidade organizacional', P12: 'Processo/Etapa de processo', P13: 'Modalidade/Subproduto', P14: 'Regra/Opção', P15: 'Componente' };
const listaComE = (a) => (a.length === 1 ? a[0] : a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1]);
const ROTULO_CONFLITO = 'A validar — conflito de naturezas predominantes';
const justificativaEsperada = (rot) => 'As respostas indicam mais de uma natureza arquitetural como predominante: ' + listaComE(rot) + '. ' +
  'Como essas classificações representam naturezas distintas do item, não é possível determinar uma classificação arquitetural única com segurança. ' +
  'O caso requer análise antes da classificação definitiva.';

/* ------------------------------------------------------------------------- *
 * Código REAL num vm. O banco é falso e só serve motor-arquitetura-config;
 * toda tentativa de gravação fica anotada em `escritas` (para provar que
 * nada grava). O gancho __avpTeste é acrescentado em memória — não existe no
 * arquivo de produção.
 * ------------------------------------------------------------------------- */
function carregar(src, config, escritas) {
  const ctx = { console, JSON, Object, Array, String, Math, Number, Date, RegExp, Error, Promise, setTimeout, clearTimeout, setInterval, clearInterval, parseFloat, parseInt, isNaN };
  ctx.window = ctx; ctx.window.window = ctx;
  const el = () => ({ addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, style: {}, classList: { add() {}, remove() {}, contains() { return false; } } });
  ctx.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, addEventListener() {}, body: el(), documentElement: el() };
  const anota = (op, p) => { if (escritas) escritas.push(op + ' ' + p); };
  const ref = (p) => ({
    on(ev, cb) { if (p === 'motor-arquitetura-config' && config !== undefined) cb({ val: () => JSON.parse(JSON.stringify(config)) }); },
    once() {}, off() {}, update() { anota('update', p); }, set() { anota('set', p); }, remove() { anota('remove', p); },
    transaction() { anota('transaction', p); }, child(c) { return ref(p + '/' + c); }, push() { anota('push', p); return { key: 'k' }; }
  });
  ctx.firebase = { database: () => ({ ref }) };
  ctx.navigator = {}; ctx.location = { hash: '' }; ctx.localStorage = { getItem() { return null; }, setItem() {} };
  vm.createContext(ctx);
  vm.runInContext(src.qc, ctx, { filename: 'questionarios-config.js' });
  vm.runInContext(src.motor, ctx, { filename: 'motor-arquitetura.js' });
  if (src.avp) {
    const fim = src.avp.lastIndexOf('})();');
    vm.runInContext(src.avp.slice(0, fim) + '\nwindow.__avpTeste = { computeResultado: computeResultado, gerarJustificativaAutomatica: gerarJustificativaAutomatica };\n' + src.avp.slice(fim), ctx, { filename: 'avaliacao-produto.js' });
  }
  if (config !== undefined) ctx.window.faMotorArquitetura.onMudanca(function () {});
  return { M: ctx.window.faMotorArquitetura, av: ctx.__avpTeste };
}
const clone = (x) => JSON.parse(JSON.stringify(x));
const respostasDe = (m) => { const r = {}; ORDEM.forEach((id, i) => { r[id] = { valor: (m >> i) & 1 ? 'sim' : 'nao' }; }); return r; };
function contexto(C, m) { const c = {}; for (let b = 0; b < 16; b++) c[C[b]] = (m >> b) & 1 ? 'SIM' : 'NAO'; return c; }
const simsDe = (c) => Object.keys(c).filter((k) => c[k] === 'SIM').join(',') || '(nenhuma)';

/* Configurações de motor-arquitetura-config usadas nos testes. */
function configs(M) {
  const v3 = M.regrasVersao3Esperadas();
  const v2 = clone(v3); const uva2 = v2.find((r) => r.codigo === 'UNIDADE_VALOR_ASSOCIADA');
  uva2.condicoes.all = uva2.condicoes.all.filter((c) => ['P3', 'P11', 'P12', 'P14'].indexOf(c.campo) === -1);
  const v4 = M.construirPropostaConflitoNaturezas(v3);
  const v3Divergente = clone(v3); const uvaD = v3Divergente.find((r) => r.codigo === 'UNIDADE_VALOR_ASSOCIADA');
  uvaD.condicoes.all = uvaD.condicoes.all.filter((c) => c.campo !== 'P14');
  return {
    v2, v3, v4,
    publicadaV3: { versaoPublicada: 3, versoes: { 2: { regras: v2 }, 3: { regras: v3 } } },
    publicadaV3Divergente: { versaoPublicada: 3, versoes: { 2: { regras: v2 }, 3: { regras: v3Divergente } } },
    publicadaV2: { versaoPublicada: 2, versoes: { 2: { regras: v2 } } },
    publicadaV4: { versaoPublicada: 4, versoes: { 2: { regras: v2 }, 3: { regras: v3 }, 4: { regras: v4 } } },
    /* versão 4 publicada com conteúdo IGUAL ao da 3 (ex.: republicação) — a versão mudou, então bloqueia */
    publicadaV4IgualV3: { versaoPublicada: 4, versoes: { 2: { regras: v2 }, 3: { regras: v3 }, 4: { regras: clone(v3) } } },
    /* versão 3 publicada + rascunho JÁ SALVO com uma mudança real (CANAL + P2 = NÃO) */
    publicadaV3ComRascunhoDiferente: (() => {
      const r = clone(v3); r.find((x) => x.codigo === 'CANAL').condicoes.all.push({ campo: 'P2', valor: 'NAO' });
      return { versaoPublicada: 3, versoes: { 2: { regras: v2 }, 3: { regras: v3 } }, rascunho: { regras: r, versaoBase: 3, atualizadoEm: '2026-10-04T10:00:00.000Z', atualizadoPor: null } };
    })(),
    /* versão 3 publicada + rascunho salvo SEMANTICAMENTE igual à 3 (outra ordem de condições e de propriedades) */
    publicadaV3ComRascunhoIgual: (() => {
      const r = clone(v3).reverse().map((x) => { const o = {}; Object.keys(x).reverse().forEach((k) => { o[k] = x[k]; }); if (o.condicoes && Array.isArray(o.condicoes.all)) o.condicoes.all = o.condicoes.all.slice().reverse(); return o; });
      return { versaoPublicada: 3, versoes: { 2: { regras: v2 }, 3: { regras: v3 } }, rascunho: { regras: r, versaoBase: 3, atualizadoEm: '2026-10-04T10:00:00.000Z', atualizadoPor: null } };
    })()
  };
}

/* Para cada combinação com conflito de naturezas, confere que a lista dinâmica é exatamente a das
   perguntas SIM, nos três lugares (motor, avaliação e textos). Devolve os problemas achados —
   usado também na prova inversa, com o código mutado. */
function conferirListas(M, av, cfg) {
  const C = M.CAMPOS_VALIDOS;
  const problemas = []; const porK = {}; const exemplos = {};
  for (let m = 0; m < 65536; m++) {
    const c = contexto(C, m);
    const r = M.identificarCamada(c, { regras: cfg.v4 });
    if (r.regraAplicada !== 'CONFLITO_NATUREZAS') continue;
    const marcadas = NATUREZAS.filter((p) => c[p] === 'SIM');
    const k = marcadas.length; porK[k] = (porK[k] || 0) + 1;
    const rotulos = marcadas.map((p) => ROTULO_NATUREZA[p]);
    if (JSON.stringify(r.motivosCodigos) !== JSON.stringify(marcadas)) problemas.push(m + ' motivos do motor ' + JSON.stringify(r.motivosCodigos));
    if (JSON.stringify(r.conflito) !== JSON.stringify(marcadas.map((p) => M.CAMADA_POR_NATUREZA[p]))) problemas.push(m + ' conflito do motor ' + JSON.stringify(r.conflito));
    if (!r.conflitoNaturezas || r.camada !== 'a-validar') problemas.push(m + ' não marcou conflitoNaturezas / camada');
    if (av && (m % 7 === 0 || k >= 4)) { /* textos: amostra larga (todas com 4 e 5 naturezas) */
      const atual = { respostas: respostasDe(m) };
      const x = av.computeResultado(atual);
      const just = av.gerarJustificativaAutomatica(atual, x);
      const cs = x.camadaSugerida;
      const naoMarcadas = NATUREZAS.filter((p) => c[p] !== 'SIM').map((p) => ROTULO_NATUREZA[p]);
      const textos = [cs.label].concat(cs.motivos, cs.conflito, [just]).join(' | ');
      if (cs.label !== ROTULO_CONFLITO || !cs.conflitoNaturezas) problemas.push(m + ' rótulo ' + cs.label);
      if (JSON.stringify(cs.conflito) !== JSON.stringify(rotulos)) problemas.push(m + ' conflito ' + JSON.stringify(cs.conflito));
      if (JSON.stringify(cs.motivos) !== JSON.stringify(['Naturezas predominantes indicadas: ' + listaComE(rotulos)])) problemas.push(m + ' motivos ' + JSON.stringify(cs.motivos));
      if (just !== justificativaEsperada(rotulos)) problemas.push(m + ' justificativa ' + just.slice(0, 120));
      if (naoMarcadas.some((n) => textos.indexOf(n) !== -1)) problemas.push(m + ' cita natureza NÃO marcada: ' + textos.slice(0, 160));
      if (!exemplos[k]) exemplos[k] = { sims: simsDe(c), motivo: cs.motivos[0], justificativa: just };
    }
  }
  return { problemas, porK, exemplos };
}

function parteA() {
  console.log('== PARTE A — código real, as 65.536 combinações ==');
  const base = carregar(SRC);
  const cfg = configs(base.M);
  const ORIG = { qc: SRC.qc, motor: SRC.motor, avp: SRC.avp };

  console.log('\n-- A1: com a versão 3 publicada, o código novo dá EXATAMENTE o resultado de antes --');
  {
    const { M, av } = carregar(ORIG, cfg.publicadaV3);
    afirma(M.versaoAtual() === 3, 'versão publicada lida do banco: 3');
    const hm = crypto.createHash('sha256'), ha = crypto.createHash('sha256');
    const C = M.CAMPOS_VALIDOS;
    let conflitoNaturezas = 0;
    for (let m = 0; m < 65536; m++) {
      const r = M.identificarCamada(contexto(C, m), M.regrasDaVersao(M.versaoAtual()));
      if (r.conflitoNaturezas) conflitoNaturezas++;
      hm.update(JSON.stringify(r) + '\n');
      const atual = { respostas: respostasDe(m) };
      const x = av.computeResultado(atual);
      ha.update(JSON.stringify([x, av.gerarJustificativaAutomatica(atual, x)]) + '\n');
    }
    afirma(hm.digest('hex') === DIGITAL_V3_MOTOR, 'motor: retorno completo (camada, regra, motivos, conflito, incoerência) idêntico ao de antes nas 65.536');
    afirma(ha.digest('hex') === DIGITAL_V3_AVALIACAO, 'avaliação: classificação, rótulo, motivos, conflito, relação e justificativa idênticos aos de antes nas 65.536');
    afirma(conflitoNaturezas === 0, 'na versão 3 nenhuma combinação vira "conflito de naturezas" (' + conflitoNaturezas + ')');
    const atual = { respostas: respostasDe((1 << 10) | (1 << 11)) }; /* P11 + P12 */
    const x = av.computeResultado(atual);
    afirma(x.camadaSugerida.label === 'A validar' && /^As respostas indicam características de mais de uma categoria arquitetural \(Processo\/Etapa de processo e Capacidade organizacional\)/.test(av.gerarJustificativaAutomatica(atual, x)),
      'P11 + P12 na versão 3: continua o conflito Processo × Capacidade de antes, com o texto de antes');
  }

  console.log('\n-- A2: a proposta reproduz a simulação aprovada --');
  const { M } = carregar(ORIG);
  const C = M.CAMPOS_VALIDOS;
  afirma(M.validarRegras({ regras: cfg.v4 }).length === 0, 'proposta válida (estrutura, fallback exaustivo, nenhuma regra inalcançável)', JSON.stringify(M.validarRegras({ regras: cfg.v4 })));
  afirma(M.regrasInalcancaveis(cfg.v4).length === 0, 'nenhuma regra inalcançável');
  const diff = M.diffRegras(cfg.v3, cfg.v4).map((d) => d.codigo).sort();
  afirma(JSON.stringify(diff) === JSON.stringify(['COMPONENTE', 'CONFLITO_NATUREZAS', 'CONFLITO_PROCESSO_CAPACIDADE', 'MODALIDADE_SUBPRODUTO']), 'só mudam COMPONENTE, MODALIDADE_SUBPRODUTO, a nova CONFLITO_NATUREZAS e a removida CONFLITO_PROCESSO_CAPACIDADE', JSON.stringify(diff));
  const porCodigo = (rs, c) => rs.find((r) => r.codigo === c);
  const comp4 = porCodigo(cfg.v4, 'COMPONENTE'), mod4 = porCodigo(cfg.v4, 'MODALIDADE_SUBPRODUTO'), conf4 = porCodigo(cfg.v4, 'CONFLITO_NATUREZAS');
  afirma(M.perguntasDaRegra(comp4).indexOf('P13') === -1 && comp4.condicoes.all.some((c) => c.campo === 'P15' && c.valor === 'SIM'), 'COMPONENTE: identificado por P15 = SIM, P13 saiu');
  afirma(['P5', 'P16', 'P2', 'P12', 'P14'].every((p) => M.perguntasDaRegra(comp4).indexOf(p) !== -1), 'COMPONENTE: as demais condições continuam (P5, P16, P2, P12, P14 = NÃO — mesmo as redundantes)');
  afirma(M.perguntasDaRegra(mod4).indexOf('P2') === -1 && ['P13', 'P16', 'P5', 'P15'].every((p) => M.perguntasDaRegra(mod4).indexOf(p) !== -1), 'MODALIDADE_SUBPRODUTO: sem P2; P13, P16, P5, P15 continuam');
  afirma(conf4.ordem === 6 && conf4.resultado === 'a-validar' && conf4.conflitoDinamico === true && conf4.condicoes.all.length === 1 && conf4.condicoes.all[0].atLeast === 2 &&
    JSON.stringify(conf4.condicoes.all[0].of.map((f) => f.campo + '=' + f.valor)) === JSON.stringify(NATUREZAS.map((p) => p + '=SIM')), 'CONFLITO_NATUREZAS: precedência 6, "pelo menos 2 de P11–P15 = SIM", sem condição de P5, A validar com conflito dinâmico');
  ['INCOERENCIA', 'PRODUTO_SERVICO_PRINCIPAL', 'FUNCIONALIDADE_OPERACAO', 'CANAL', 'DOCUMENTO_INFORMACAO', 'UNIDADE_VALOR_ASSOCIADA', 'CAPACIDADE_ORGANIZACIONAL', 'REGRA_CONDICAO', 'PROCESSO_ETAPA', 'FALLBACK_A_VALIDAR'].forEach((cod) => {
    afirma(M.diffRegras([porCodigo(cfg.v3, cod)], [porCodigo(cfg.v4, cod)]).length === 0, cod + ' idêntica à da versão 3');
  });
  let mudamCamada = 0, soMotivo = 0; const dist = {}; const intocadas = { INCOERENCIA: 0, PRODUTO_SERVICO_PRINCIPAL: 0, UNIDADE_VALOR_ASSOCIADA: 0, CANAL: 0, DOCUMENTO_INFORMACAO: 0, FUNCIONALIDADE_OPERACAO: 0 };
  const fluxos = {};
  for (let m = 0; m < 65536; m++) {
    const c = contexto(C, m);
    const a = M.identificarCamada(c, { regras: cfg.v3 }), b = M.identificarCamada(c, { regras: cfg.v4 });
    dist[b.camada] = (dist[b.camada] || 0) + 1;
    if (a.camada !== b.camada) { mudamCamada++; const f = a.camada + ' → ' + b.camada; fluxos[f] = (fluxos[f] || 0) + 1; }
    else if (a.regraAplicada !== b.regraAplicada) soMotivo++;
    Object.keys(intocadas).forEach((cod) => { if ((a.regraAplicada === cod) !== (b.regraAplicada === cod)) intocadas[cod]++; });
  }
  afirma(mudamCamada === 2336, 'mudam de camada: ' + mudamCamada + ' (aprovado: 2.336)');
  afirma(soMotivo === 4384, 'só mudam o motivo de A validar: ' + soMotivo + ' (aprovado: 4.384)');
  const DIST = { 'a-validar': 24112, 'unidade-valor-associada': 8, 'produto-principal': 8, canal: 16384, 'documento-informacao': 8192, 'capacidade-organizacional': 128, 'processo-etapa': 64, 'modalidade-subproduto': 128, 'regra-condicao': 64, componente: 64, 'funcionalidade-operacao': 16384 };
  afirma(JSON.stringify(Object.keys(DIST).sort().map((k) => k + ':' + dist[k])) === JSON.stringify(Object.keys(DIST).sort().map((k) => k + ':' + DIST[k])), 'distribuição final igual à aprovada', JSON.stringify(dist));
  const FLUXOS = { 'capacidade-organizacional → a-validar': 640, 'componente → modalidade-subproduto': 64, 'componente → a-validar': 224, 'modalidade-subproduto → a-validar': 320, 'processo-etapa → a-validar': 320, 'regra-condicao → a-validar': 768 };
  afirma(JSON.stringify(Object.keys(fluxos).sort().map((k) => k + ':' + fluxos[k])) === JSON.stringify(Object.keys(FLUXOS).sort().map((k) => k + ':' + FLUXOS[k])), 'fluxos de camada: só os aprovados (Capacidade, Processo, Modalidade, Regra, Componente → A validar; Componente → Modalidade)', JSON.stringify(fluxos));
  Object.keys(intocadas).forEach((cod) => afirma(intocadas[cod] === 0, cod + ': nenhuma combinação entra ou sai (' + intocadas[cod] + ')'));
  let cobertura = 0; for (let m = 0; m < 65536; m++) if (M.identificarCamada(contexto(C, m), { regras: cfg.v4 }).regraAplicada) cobertura++;
  afirma(cobertura === 65536, 'cobertura: as 65.536 combinações têm uma regra aplicada (' + cobertura + ')');

  console.log('\n-- A3: conflitos com 2, 3, 4 e 5 naturezas — a lista é só a das perguntas SIM --');
  {
    const { M: Mv4, av } = carregar(ORIG, cfg.publicadaV4);
    afirma(Mv4.versaoAtual() === 4, 'avaliação lendo a versão 4 (proposta publicada só neste banco de teste)');
    const r = conferirListas(Mv4, av, cfg);
    afirma(r.porK[2] === 2560 && r.porK[3] === 2560 && r.porK[4] === 1280 && r.porK[5] === 256 && !r.porK[1] && !r.porK[0], 'conflitos com 2 / 3 / 4 / 5 naturezas: ' + [2, 3, 4, 5].map((k) => r.porK[k]).join(' / ') + ' (aprovado: 2.560 / 2.560 / 1.280 / 256)');
    afirma(r.problemas.length === 0, 'em todas: motor, rótulo, motivo, conflito e justificativa listam EXATAMENTE as naturezas SIM, nunca uma NÃO', r.problemas.slice(0, 3).join(' ; '));
    [2, 3, 4, 5].forEach((k) => { const e = r.exemplos[k]; if (e) console.log('        ex. ' + k + ' naturezas — SIM: ' + e.sims + '\n            ' + e.motivo + '\n            ' + e.justificativa); });
    const caso = { respostas: respostasDe((1 << 10) | (1 << 12) | (1 << 14) | (1 << 0) | (1 << 4)) }; /* P1, P5, P11, P13, P15 */
    const x = av.computeResultado(caso);
    afirma(JSON.stringify(x.camadaSugerida.motivos) === JSON.stringify(['Naturezas predominantes indicadas: Capacidade organizacional, Modalidade/Subproduto e Componente']) && x.resultadoAutomatico === 'a-validar',
      'o exemplo aprovado: "Naturezas predominantes indicadas: Capacidade organizacional, Modalidade/Subproduto e Componente" (com P5 = SIM: a política vale independentemente de P5)');
    const so1 = av.computeResultado({ respostas: respostasDe(1 << 12) }); /* só P13 */
    afirma(so1.camadaSugerida.id === 'modalidade-subproduto' && !so1.camadaSugerida.conflitoNaturezas, 'uma natureza só (P13, sem P2) não é conflito: vira Modalidade/Subproduto');
    const canal = av.computeResultado({ respostas: respostasDe((1 << 8) | (1 << 10) | (1 << 11)) }); /* P9 + P11 + P12 */
    afirma(canal.camadaSugerida.id === 'canal', 'P9 continua fora da política: P9 + P11 + P12 segue Canal');
    const func = av.computeResultado({ respostas: respostasDe((1 << 15) | (1 << 12) | (1 << 13)) }); /* P16 + P13 + P14 */
    afirma(func.camadaSugerida.id === 'funcionalidade-operacao', 'P16 continua fora da política: P16 + P13 + P14 segue Funcionalidade/Operação');

    console.log('\n   prova inversa — a conferência pega uma lista que cite natureza NÃO marcada:');
    const mut1 = Object.assign({}, ORIG, { motor: ORIG.motor.replace("if (normalizarValor(contexto[campo]) === 'SIM') vistas[campo] = true;", 'vistas[campo] = true;') });
    afirma(mut1.motor !== ORIG.motor, '(mutação aplicada no motor: lista com TODAS as naturezas do grupo)');
    const r1 = (() => { const k = carregar(mut1, cfg.publicadaV4); return conferirListas(k.M, k.av, cfg); })();
    afirma(r1.problemas.length > 0, 'motor mutado → a conferência FALHA (' + r1.problemas.length + ' problemas; ex.: ' + (r1.problemas[0] || '').slice(0, 90) + ')');
    const mut2 = Object.assign({}, ORIG, { avp: ORIG.avp.replace('if (decisao.conflitoNaturezas) motivos = [textoNaturezasIndicadas(conflito)];', "if (decisao.conflitoNaturezas) motivos = [textoNaturezasIndicadas(['Capacidade organizacional', 'Processo/Etapa de processo', 'Modalidade/Subproduto', 'Regra/Opção', 'Componente'])];") });
    afirma(mut2.avp !== ORIG.avp, '(mutação aplicada na avaliação: motivo com rótulo fixo das cinco naturezas)');
    const r2 = (() => { const k = carregar(mut2, cfg.publicadaV4); return conferirListas(k.M, k.av, cfg); })();
    afirma(r2.problemas.some((p) => /motivos|cita natureza/.test(p)), 'motivo fixo → a conferência FALHA (' + r2.problemas.length + ' problemas)');
    const mut3 = Object.assign({}, ORIG, { avp: ORIG.avp.replace("return 'As respostas indicam mais de uma natureza arquitetural como predominante: ' + listaComE(rotulos || []) + '. ' +", "return 'As respostas indicam mais de uma natureza arquitetural como predominante: Capacidade organizacional e Componente. ' +") });
    afirma(mut3.avp !== ORIG.avp, '(mutação aplicada na avaliação: justificativa com lista fixa)');
    const r3 = (() => { const k = carregar(mut3, cfg.publicadaV4); return conferirListas(k.M, k.av, cfg); })();
    afirma(r3.problemas.some((p) => /justificativa|cita natureza/.test(p)), 'justificativa fixa → a conferência FALHA (' + r3.problemas.length + ' problemas)');
  }

  console.log('\n-- A4: o operador "pelo menos N de" --');
  {
    const folhas = NATUREZAS.map((p) => ({ campo: p, valor: 'SIM' }));
    let divergencias = 0;
    for (let n = 1; n <= 5; n++) {
      const regraN = [{ codigo: 'X', ordem: 1, resultado: 'a-validar', condicoes: { all: [{ atLeast: n, of: folhas }] } }, { codigo: 'FALLBACK_A_VALIDAR', tipo: 'FALLBACK', ordem: 2, resultado: 'a-validar' }];
      for (let m = 0; m < 65536; m += 1) {
        const c = contexto(C, m);
        const esperado = NATUREZAS.filter((p) => c[p] === 'SIM').length >= n;
        if (M.avaliarCondicao(regraN[0].condicoes, c) !== esperado) divergencias++;
      }
      /* a prova exaustiva (compilada) concorda com o executor: "pelo menos n" ≡ QUALQUER de todos os subconjuntos de n */
      const subconjuntos = [];
      (function gera(i, atual) { if (atual.length === n) { subconjuntos.push({ all: atual.map((p) => ({ campo: p, valor: 'SIM' })) }); return; } for (let j = i; j < NATUREZAS.length; j++) gera(j + 1, atual.concat(NATUREZAS[j])); })(0, []);
      const regraAny = clone(regraN); regraAny[0].condicoes = { any: subconjuntos };
      const eq = M.compararRegrasExaustivamente(regraN, regraAny);
      afirma(eq.equivalentes, 'pelo menos ' + n + ' de P11–P15 ≡ QUALQUER dos ' + subconjuntos.length + ' grupos de ' + n + ' (prova exaustiva compilada = executor)');
    }
    afirma(divergencias === 0, 'executor: "pelo menos N" verdadeiro exatamente quando N ou mais das condições são verdadeiras (N = 1..5, 65.536 cada)');
    const inval = (cond) => M.validarRegras({ regras: [{ codigo: 'X', ordem: 1, resultado: 'a-validar', condicoes: { all: [cond] } }, { codigo: 'F', tipo: 'FALLBACK', ordem: 2, resultado: 'a-validar' }] });
    afirma(inval({ atLeast: 0, of: folhas }).some((e) => /PELO MENOS/.test(e)), 'validação: quantidade 0 é recusada');
    afirma(inval({ atLeast: 6, of: folhas }).some((e) => /PELO MENOS/.test(e)), 'validação: quantidade maior que o número de condições é recusada');
    afirma(inval({ atLeast: 1.5, of: folhas }).some((e) => /PELO MENOS/.test(e)) && inval({ atLeast: '2', of: folhas }).some((e) => /PELO MENOS/.test(e)), 'validação: quantidade não inteira (1,5 ou "2") é recusada');
    afirma(inval({ atLeast: 2, of: [] }).some((e) => /PELO MENOS/.test(e)), 'validação: grupo sem condições é recusado');
    afirma(inval({ atLeast: 2, of: [{ campo: 'P99', valor: 'SIM' }, { campo: 'P11', valor: 'TALVEZ' }] }).length >= 2, 'validação: as condições do grupo passam pela validação normal (pergunta e valor)');
    afirma(inval({ atLeast: 2, of: folhas }).length === 0, 'validação: o grupo da política é aceito');
    const semNatureza = M.validarRegras({ regras: [{ codigo: 'X', ordem: 1, resultado: 'a-validar', conflitoDinamico: true, condicoes: { all: [{ campo: 'P1', valor: 'SIM' }] } }, { codigo: 'F', tipo: 'FALLBACK', ordem: 2, resultado: 'a-validar' }] });
    afirma(semNatureza.some((e) => /conflito dinâmico precisa de um grupo/.test(e)), 'validação: conflito dinâmico sem grupo de naturezas é recusado');
    const camadaErrada = clone(cfg.v4); camadaErrada.find((r) => r.codigo === 'CONFLITO_NATUREZAS').resultado = 'componente';
    afirma(M.validarRegras({ regras: camadaErrada }).some((e) => /precisa classificar como "A validar"/.test(e)), 'validação: conflito dinâmico que classificasse numa camada é recusado');
    const reordenado = clone(cfg.v4); const cr = reordenado.find((r) => r.codigo === 'CONFLITO_NATUREZAS'); cr.condicoes.all[0].of.reverse();
    const chavesTrocadas = reordenado.map((r) => { const o = {}; Object.keys(r).reverse().forEach((k) => { o[k] = r[k]; }); return o; });
    afirma(M.diffRegras(cfg.v4, chavesTrocadas).length === 0, 'comparação entre versões: ordem das condições do grupo e das propriedades não cria versão nova');
    const outroN = clone(cfg.v4); outroN.find((r) => r.codigo === 'CONFLITO_NATUREZAS').condicoes.all[0].atLeast = 3;
    afirma(JSON.stringify(M.diffRegras(cfg.v4, outroN).map((d) => d.codigo)) === '["CONFLITO_NATUREZAS"]', 'comparação entre versões: mudar o N (2 → 3) é mudança lógica');
    const semDinamico = clone(cfg.v4); delete semDinamico.find((r) => r.codigo === 'CONFLITO_NATUREZAS').conflitoDinamico;
    afirma(JSON.stringify(M.diffRegras(cfg.v4, semDinamico).map((d) => d.codigo)) === '["CONFLITO_NATUREZAS"]', 'comparação entre versões: ligar/desligar o conflito dinâmico é mudança (muda o que a regra devolve)');
    afirma(cfg.v3.every((r) => JSON.stringify(M.normalizarRegraParaComparacao(r)).indexOf('conflitoDinamico') === -1), 'regras que não usam conflito dinâmico mantêm a forma canônica de antes (versões já publicadas não "mudam")');
    afirma(JSON.stringify(M.perguntasDaRegra(conf4).sort()) === JSON.stringify(NATUREZAS.slice().sort()), 'perguntas usadas pela regra de conflito: P11–P15 (o editor não oferece repeti-las)');
    const eq34 = M.compararRegrasExaustivamente(cfg.v3, cfg.v4, 0);
    afirma(!eq34.equivalentes && eq34.diferencas === 6848, 'versões 3 e 4 NÃO são equivalentes (6.848 combinações com retorno diferente, contando motivos) — nunca reconciliadas sem recalcular');
  }

  console.log('\n-- A5: a proposta só existe sobre a versão 3 exata, e consultar nunca grava --');
  {
    const escritas = [];
    const naoCarregado = carregar(ORIG, undefined, escritas).M.situacaoPropostaRegras();
    afirma(naoCarregado.estado === 'bloqueada' && /ainda não foram carregadas/.test(naoCarregado.motivo), 'sem as regras publicadas carregadas: bloqueada ("ainda não foram carregadas")');
    const k3 = carregar(ORIG, cfg.publicadaV3, escritas).M;
    const s3 = k3.situacaoPropostaRegras();
    afirma(s3.estado === 'disponivel' && s3.versaoBase === 3 && s3.mudancas.length === 5, 'versão 3 publicada com a estrutura esperada: disponível, com as 5 mudanças descritas');
    afirma(k3.diffRegras(k3.regrasDaPropostaRegras(), cfg.v4).length === 0, 'as regras entregues são exatamente a proposta aprovada');
    const kd = carregar(ORIG, cfg.publicadaV3Divergente, escritas).M.situacaoPropostaRegras();
    afirma(kd.estado === 'bloqueada' && /não tem a estrutura esperada/.test(kd.motivo) && /UNIDADE_VALOR_ASSOCIADA/.test(kd.motivo), 'versão 3 com outra estrutura: bloqueada, dizendo qual regra difere', kd.motivo);
    afirma(carregar(ORIG, cfg.publicadaV3Divergente).M.regrasDaPropostaRegras() === null, '…e não entrega regra nenhuma');
    const k2 = carregar(ORIG, cfg.publicadaV2, escritas).M.situacaoPropostaRegras();
    afirma(k2.estado === 'bloqueada' && /versão publicada agora é a 2/.test(k2.motivo), 'outra versão publicada (2): bloqueada', k2.motivo);
    const k4 = carregar(ORIG, cfg.publicadaV4, escritas).M.situacaoPropostaRegras();
    afirma(k4.estado === 'aplicada', 'versão 4 = a proposta: "aplicada" (o cartão deixa de aparecer)');
    const v4Outra = clone(cfg.publicadaV4); v4Outra.versoes[4].regras.find((r) => r.codigo === 'CANAL').condicoes.all.push({ campo: 'P2', valor: 'NAO' });
    afirma(carregar(ORIG, v4Outra, escritas).M.situacaoPropostaRegras().estado === 'bloqueada', 'versão 4 diferente da proposta: bloqueada');
    const k4igual = carregar(ORIG, cfg.publicadaV4IgualV3, escritas).M;
    const s4igual = k4igual.situacaoPropostaRegras();
    afirma(s4igual.estado === 'bloqueada' && /versão publicada agora é a 4/.test(s4igual.motivo) && k4igual.regrasDaPropostaRegras() === null,
      'versão 4 publicada com conteúdo IGUAL ao da 3: continua bloqueada (a versão publicada mudou — não basta o conteúdo parecer igual)', s4igual.motivo);
    afirma(escritas.length === 0, 'nenhuma das consultas acima gravou nada no banco (' + escritas.length + ')', escritas.join(', '));
  }
}

/* ------------------------------ PARTE B ---------------------------------- */
function itemAvaliacao(nome, sims, camada, extra) {
  const respostas = {};
  ORDEM.forEach((id, i) => {
    const cod = 'P' + (i + 1);
    respostas[id] = { valor: sims.indexOf(cod) !== -1 ? 'sim' : 'nao', observacao: '', justificativaAuto: 'auto', codigoPergunta: cod, textoPerguntaNaEpoca: 't', tituloNaEpoca: 't', questionnaireContentVersion: 1 };
  });
  return Object.assign({
    nome, descricao: '', publico: '', necessidade: '', observacoesGerais: '', status: 'concluido', respostas,
    resultadoAutomatico: camada === 'produto-principal' ? 'produto' : (camada === 'a-validar' ? 'a-validar' : 'nao-produto'), decisaoFinal: null, decisaoManual: false,
    camadaSugerida: { id: camada, label: camada, motivos: [], conflito: null, incoerencia: false, especializacao: null, papelEstrutural: null, relacao: null },
    justificativaAutomatica: 'texto', criteriosEssenciaisFalhos: [], exclusoesConflitantes: null, criteriosAtendidos: 5,
    motorVersionArquitetura: 3, questionnaireContentVersion: 1, criadoEm: '2026-10-01T10:00:00.000Z', atualizadoEm: '2026-10-01T10:00:00.000Z',
    responsavel: { name: 'Teste', email: EMAIL }, versao: 1, versaoAnteriorKey: null, excluido: false, excluidoEm: null, excluidoPor: null,
    justificativaExclusao: null, historicoMotor: null, itemId: nome
  }, extra || {});
}
/* Avaliações fictícias concluídas na versão 3 (dados fictícios — nenhum conteúdo real). */
const AVALIACOES_SIM = () => ({
  s1: itemAvaliacao('Item fictício Regra e Capacidade', ['P1', 'P11', 'P14'], 'regra-condicao'),
  s2: itemAvaliacao('Item fictício Modalidade sem resultado', ['P1', 'P3', 'P4', 'P13'], 'componente'),
  s3: itemAvaliacao('Item fictício Canal', ['P9', 'P11', 'P12'], 'canal'),
  s4: itemAvaliacao('Item fictício Processo e Capacidade', ['P11', 'P12'], 'a-validar')
});
const AVALIACOES_REPROC = () => ({
  c2: itemAvaliacao('Item fictício duas naturezas', ['P1', 'P3', 'P4', 'P13', 'P15'], 'componente'),
  c3: itemAvaliacao('Item fictício três naturezas', ['P1', 'P5', 'P11', 'P13', 'P15'], 'a-validar'),
  c5: itemAvaliacao('Item fictício cinco naturezas', ['P11', 'P12', 'P13', 'P14', 'P15'], 'a-validar')
});

async function abrir(browser, viewport, configMotor, avaliacoes, rota) {
  const admins = {}; admins[chave(EMAIL)] = { email: EMAIL };
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': admins, 'turmas-config': {}, 'turmas-checkin': {}, 'turmas-espera': {},
    'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {}, eventos: {}, 'turmas-publico': {}, 'eventos-publico': {},
    'avaliacoes-produto': avaliacoes, 'avaliacoes-squad': {}, 'motor-squad-config': {}, 'motor-squad-auditoria': {},
    'motor-arquitetura-config': configMotor, 'motor-arquitetura-auditoria': {}, 'fa-avaliacao-acessos': {} };
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
  await page.goto(BASE + '/index.html#' + (rota || 'admin'), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.body.classList.contains('aguardando-auth'), { timeout: 16000 }).catch(() => {});
  return { ctx, page, erros };
}
async function abrirConfigMotores(page) {
  await page.waitForSelector('.admin-tab-btn[data-panel="adminPanelArquitetura"]', { timeout: 8000 });
  await page.click('.admin-tab-btn[data-panel="adminPanelArquitetura"]');
  await page.waitForSelector('#avpConfigMotoresBtn', { timeout: 8000 });
  await page.click('#avpConfigMotoresBtn');
  await page.waitForSelector('#avpMotorArqEditarBtn');
  await page.waitForTimeout(400);
}
async function abrirEditor(page) {
  await page.click('#avpMotorArqEditarBtn');
  await page.waitForSelector('.sq-regra-card');
  await page.waitForTimeout(150);
}
const banco = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal || window.__CFG.db)));
const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, kk) => { o[kk] = x[kk]; return o; }, {}) : x));
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const card = (page, codigo) => page.locator('.sq-regra-card').filter({ has: page.locator('.sq-regra-codigo', { hasText: '— ' + codigo + ' →' }) });
async function foto(page, nome) { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, nome + '.png'), fullPage: true }); } }
async function fotoDe(locator, nome) { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await locator.screenshot({ path: path.join(SHOTS, nome + '.png') }); } }
async function gerarPdf(page) {
  await page.evaluate(() => { window.__pdfs = []; });
  await Promise.all([page.waitForEvent('download', { timeout: 60000 }).catch(() => null), page.click('#avpGerarPdfBtn')]);
  await page.waitForTimeout(500);
  return page.evaluate(() => { const t = []; (window.__pdfs || []).forEach((b) => { if (t.indexOf(b.tudo) === -1) t.push(b.tudo); }); return t.join('\n').replace(/\s+/g, ' '); });
}

async function parteB(browser) {
  const { M } = carregar(SRC);
  const cfg = configs(M);
  for (const [nomeTela, viewport, sufixo] of [['desktop', DESKTOP, 'desktop'], ['celular 375px', CELULAR, '375']]) {
    console.log('\n######## ' + nomeTela + ' ########');

    console.log('\n== B1: carregar a proposta no editor, simular e salvar o rascunho (sem publicar) ==');
    {
      const { ctx, page, erros } = await abrir(browser, viewport, clone(cfg.publicadaV3), AVALIACOES_SIM());
      await abrirConfigMotores(page);
      const inicio = await banco(page);
      await abrirEditor(page);
      const cartao = page.locator('#avpPropostaRegras');
      afirma(await cartao.count() === 1 && await cartao.getAttribute('data-estado') === 'disponivel', 'o cartão da proposta aparece no topo do editor (disponível sobre a versão 3)');
      const txtCartao = await cartao.innerText();
      afirma(/Política geral de conflitos de natureza predominante/.test(txtCartao) && /pelo menos 2 entre P11, P12, P13, P14 e P15/.test(txtCartao) && /nada é gravado, nada é publicado/.test(txtCartao), 'o cartão explica a proposta e diz que carregar não grava nem publica');
      afirma(await card(page, 'CONFLITO_PROCESSO_CAPACIDADE').count() === 1 && await card(page, 'CONFLITO_NATUREZAS').count() === 0, 'antes de carregar: o editor mostra as regras da versão 3');
      await fotoDe(cartao, 'b1-proposta-disponivel-' + sufixo);
      await page.click('#avpCarregarPropostaBtn');
      await page.waitForSelector('.avp-modal-confirm-btn');
      afirma(/Nada é gravado/.test(await page.locator('.modal-box').last().innerText().catch(() => '')), 'a confirmação diz que nada é gravado');
      await page.click('.avp-modal-confirm-btn');
      await page.waitForSelector('#avpPropostaNoEditor');
      afirma(await card(page, 'CONFLITO_NATUREZAS').count() === 1 && await card(page, 'CONFLITO_PROCESSO_CAPACIDADE').count() === 0, 'carregada: CONFLITO_NATUREZAS aparece e CONFLITO_PROCESSO_CAPACIDADE sai');
      const confCard = card(page, 'CONFLITO_NATUREZAS');
      const confTxt = await confCard.innerText();
      afirma(/Precedência 6/.test(confTxt) && /SE PELO MENOS 2 destas condições forem verdadeiras/.test(confTxt) && /conflito de naturezas predominantes: cita só as naturezas marcadas SIM/.test(confTxt), 'CONFLITO_NATUREZAS: precedência 6, "SE PELO MENOS 2 destas condições", conflito dinâmico explicado');
      afirma(await confCard.locator('.sq-cond-folha--fixa').count() === 5 && await confCard.locator('.sq-cond-folha--fixa select').count() === 0 && /fixa nesta política/.test(confTxt), 'as cinco perguntas do grupo (P11–P15 = SIM) aparecem só para leitura — sem caixa SIM/NÃO');
      afirma(['P11', 'P12', 'P13', 'P14', 'P15'].every((p) => confTxt.indexOf(p) !== -1), 'P11, P12, P13, P14 e P15 estão no grupo');
      const compTxt = await card(page, 'COMPONENTE').innerText();
      afirma(/P15/.test(compTxt) && !/P13/.test(compTxt) && !/SE QUALQUER/.test(compTxt), 'COMPONENTE: só P15 (sem P13, sem o grupo QUALQUER)');
      const modTxt = await card(page, 'MODALIDADE_SUBPRODUTO').innerText();
      afirma(!/\bP2\b/.test(modTxt) && /P13/.test(modTxt), 'MODALIDADE_SUBPRODUTO: sem P2');
      afirma(await page.locator('.sq-cond-folha--nova').count() === 0, 'nenhuma condição aparece como NOVA (a proposta troca a estrutura, não acrescenta condições soltas)');
      const aposCarregar = await banco(page);
      afirma(canon(aposCarregar) === canon(inicio), 'carregar a proposta NÃO gravou nada no banco');
      afirma(await larguraOk(page), 'editor com a proposta: sem rolagem horizontal');
      await foto(page, 'b1-editor-proposta-' + sufixo);
      await fotoDe(confCard, 'b1-regra-conflito-' + sufixo);

      await page.click('#avpMotorArqSimularBtn');
      await page.waitForSelector('#avpMotorArqConfirmarPublicarBtn', { timeout: 8000 });
      const sim = await page.locator('.avp-config-motores').innerText();
      afirma(/4 avaliações analisadas/.test(sim) && /2 manteriam/.test(sim) && /2 mudariam/.test(sim), 'simulação: 4 analisadas, 2 mantêm, 2 mudariam', sim.slice(0, 260));
      const linhas = await page.locator('.avp-config-motores table.admin-table tbody tr').evaluateAll((trs) => trs.map((t) => t.innerText.replace(/\s+/g, ' ')));
      afirma(linhas.some((l) => /Regra e Capacidade/.test(l) && /Regra\/Opção/.test(l) && /A validar/.test(l)), 'Regra (P11 + P14) → A validar', linhas.join(' | '));
      afirma(linhas.some((l) => /Modalidade sem resultado/.test(l) && /Componente/.test(l) && /Modalidade\/Subproduto/.test(l)), 'Componente só por P13 → Modalidade/Subproduto', linhas.join(' | '));
      afirma(!linhas.some((l) => /Canal|Processo e Capacidade/.test(l)), 'Canal (P9 fora da política) e o antigo Processo × Capacidade (continua A validar) não mudam');
      afirma(await larguraOk(page), 'simulação: sem rolagem horizontal');
      await foto(page, 'b1-simulacao-' + sufixo);
      afirma(canon(await banco(page)) === canon(inicio), 'simular NÃO gravou nada');
      await page.click('#avpMotorArqVoltarEdicaoBtn');
      await page.waitForSelector('#avpPropostaNoEditor');

      await page.click('#avpMotorArqSalvarRascunhoBtn');
      await page.waitForSelector('#avpMotorArqEditarBtn');
      await page.waitForTimeout(300);
      const depois = await banco(page);
      const c = depois['motor-arquitetura-config'];
      const rascunhoIgual = await page.evaluate((regras) => window.faMotorArquitetura.diffRegras(window.faMotorArquitetura.regrasDaPropostaRegras(), regras).length === 0, (c.rascunho && c.rascunho.regras) || []);
      afirma(rascunhoIgual && c.rascunho.versaoBase === 3, 'salvar: o rascunho gravado é exatamente a proposta, com versão-base 3');
      afirma(c.versaoPublicada === 3 && canon(c.versoes) === canon(inicio['motor-arquitetura-config'].versoes), 'a versão publicada continua a 3 e nenhuma versão foi criada ou alterada');
      afirma(canon(depois['avaliacoes-produto']) === canon(inicio['avaliacoes-produto']), 'nenhuma avaliação mudou (nada recalculado)');
      afirma(canon(depois['motor-arquitetura-auditoria'] || {}) === canon(inicio['motor-arquitetura-auditoria'] || {}), 'auditoria do motor intocada (rascunho não é publicação)');

      await abrirEditor(page);
      afirma(await page.locator('#avpPropostaNoEditor').count() === 1 && await page.locator('#avpDescartarPropostaBtn').count() === 1, 'reabrindo: "as regras deste editor são as da proposta — ainda não publicadas", com a opção de voltar à versão 3');
      await page.click('#avpDescartarPropostaBtn');
      await page.waitForSelector('.avp-modal-confirm-btn');
      await page.click('.avp-modal-confirm-btn');
      await page.waitForSelector('#avpCarregarPropostaBtn');
      afirma(await card(page, 'CONFLITO_PROCESSO_CAPACIDADE').count() === 1 && await card(page, 'CONFLITO_NATUREZAS').count() === 0, '"Voltar às regras da versão 3" tira a proposta do editor');
      afirma(await page.locator('#avpPropostaRegras').getAttribute('data-estado') === 'disponivel', 'depois de voltar, as regras do editor são de novo as da versão 3 → a proposta volta a ficar disponível (não bloqueia só porque existe rascunho salvo)');
      await page.click('#avpCarregarPropostaBtn');
      await page.waitForSelector('.avp-modal-confirm-btn');
      await page.click('.avp-modal-confirm-btn');
      await page.waitForSelector('#avpPropostaNoEditor');
      afirma(await card(page, 'CONFLITO_NATUREZAS').count() === 1 && await card(page, 'CONFLITO_PROCESSO_CAPACIDADE').count() === 0, '"Voltar às regras da versão 3" → "Carregar proposta" de novo: a proposta volta ao editor');
      afirma((await banco(page))['motor-arquitetura-config'].versaoPublicada === 3, 'e nada foi publicado em momento algum');
      afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
      await ctx.close();
    }

    console.log('\n== B2: bloqueios ==');
    {
      const { ctx, page, erros } = await abrir(browser, viewport, clone(cfg.publicadaV3Divergente), AVALIACOES_SIM());
      await abrirConfigMotores(page); await abrirEditor(page);
      const t = await page.locator('#avpPropostaBloqueada').innerText().catch(() => '');
      afirma(/não tem a estrutura esperada/.test(t) && /UNIDADE_VALOR_ASSOCIADA/.test(t) && await page.locator('#avpCarregarPropostaBtn').count() === 0, 'versão 3 com outra estrutura: bloqueada, explica qual regra difere, sem botão de carregar', t);
      await fotoDe(page.locator('#avpPropostaRegras'), 'b2-bloqueada-divergente-' + sufixo);
      afirma(erros.length === 0, 'nenhum erro de JS');
      await ctx.close();
    }
    {
      const { ctx, page } = await abrir(browser, viewport, clone(cfg.publicadaV2), AVALIACOES_SIM());
      await abrirConfigMotores(page); await abrirEditor(page);
      const t = await page.locator('#avpPropostaBloqueada').innerText().catch(() => '');
      afirma(/versão publicada agora é a 2/.test(t) && await page.locator('#avpCarregarPropostaBtn').count() === 0, 'versão 2 publicada: bloqueada, sem botão', t);
      await ctx.close();
    }
    {
      const { ctx, page } = await abrir(browser, viewport, clone(cfg.publicadaV3), AVALIACOES_SIM());
      await abrirConfigMotores(page); await abrirEditor(page);
      await card(page, 'CANAL').locator('.sq-cond-add-btn').click();
      await page.selectOption('.sq-cond-add-pergunta', 'P2');
      await page.selectOption('.sq-cond-add-valor', 'NAO');
      await page.click('.sq-cond-add-confirmar');
      const t = await page.locator('#avpPropostaBloqueada').innerText().catch(() => '');
      afirma(/alterações não salvas/.test(t) && await page.locator('#avpCarregarPropostaBtn').count() === 0, 'com uma edição em andamento: bloqueada (a proposta nunca se mistura com outra edição)', t);
      await ctx.close();
    }
    {
      const { ctx, page } = await abrir(browser, viewport, clone(cfg.publicadaV4IgualV3), AVALIACOES_SIM());
      await abrirConfigMotores(page); await abrirEditor(page);
      const t = await page.locator('#avpPropostaBloqueada').innerText().catch(() => '');
      afirma(/versão publicada agora é a 4/.test(t) && await page.locator('#avpCarregarPropostaBtn').count() === 0, 'versão 4 publicada com conteúdo igual ao da 3: bloqueada (versão publicada diferente de 3), sem botão', t);
      await ctx.close();
    }
    {
      const { ctx, page } = await abrir(browser, viewport, clone(cfg.publicadaV3ComRascunhoDiferente), AVALIACOES_SIM());
      await abrirConfigMotores(page); await abrirEditor(page);
      const t = await page.locator('#avpPropostaBloqueada').innerText().catch(() => '');
      afirma(/Já existe um rascunho com alterações em relação à versão 3/.test(t) && /CANAL/.test(t) && await page.locator('#avpCarregarPropostaBtn').count() === 0, 'rascunho salvo com uma mudança REAL em relação à 3: bloqueada, dizendo qual regra difere', t);
      await ctx.close();
    }
    {
      const { ctx, page } = await abrir(browser, viewport, clone(cfg.publicadaV3ComRascunhoIgual), AVALIACOES_SIM());
      await abrirConfigMotores(page); await abrirEditor(page);
      afirma(await page.locator('#avpPropostaRegras').getAttribute('data-estado') === 'disponivel' && await page.locator('#avpCarregarPropostaBtn').count() === 1, 'rascunho salvo só com outra ordem de regras/condições/propriedades (semanticamente igual à 3): disponível — a comparação é semântica, não pela existência do rascunho');
      await ctx.close();
    }
    {
      const { ctx, page } = await abrir(browser, viewport, clone(cfg.publicadaV4), AVALIACOES_SIM());
      await abrirConfigMotores(page); await abrirEditor(page);
      afirma(await page.locator('#avpPropostaRegras').count() === 0, 'versão 4 (a proposta) publicada: o cartão não aparece mais');
      afirma(/SE PELO MENOS 2/.test(await card(page, 'CONFLITO_NATUREZAS').innerText()), 'e o editor mostra a regra publicada com o grupo "pelo menos 2"');
      await ctx.close();
    }

    console.log('\n== B3: resultado e PDF com a versão 4 (reprocessamento individual) ==');
    {
      const { ctx, page, erros } = await abrir(browser, viewport, clone(cfg.publicadaV4), AVALIACOES_REPROC(), 'avaliacoes');
      await page.waitForSelector('#avpNovoBtn', { timeout: 8000 });
      await page.waitForTimeout(600);
      const casos = [
        ['c2', ['Modalidade/Subproduto', 'Componente']],
        ['c3', ['Capacidade organizacional', 'Modalidade/Subproduto', 'Componente']],
        ['c5', ['Capacidade organizacional', 'Processo/Etapa de processo', 'Modalidade/Subproduto', 'Regra/Opção', 'Componente']]
      ];
      for (const [key, rotulos] of casos) {
        await page.click('.avp-act-ver[data-key="' + key + '"]');
        await page.waitForSelector('#avpReprocessarBtn', { timeout: 8000 });
        await page.click('#avpReprocessarBtn');
        await page.click('.avp-modal-confirm-btn');
        await page.waitForFunction((k) => { const it = window.__CFG.__dbReal['avaliacoes-produto'][k]; return it && it.motorVersionArquitetura === 4; }, key, { timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(300);
        const it = (await banco(page))['avaliacoes-produto'][key];
        const cs = it.camadaSugerida || {};
        const nao = Object.values(ROTULO_NATUREZA).filter((r) => rotulos.indexOf(r) === -1);
        afirma(it.motorVersionArquitetura === 4 && cs.id === 'a-validar' && cs.conflitoNaturezas === true && cs.label === ROTULO_CONFLITO, key + ': gravado como "' + ROTULO_CONFLITO + '"', JSON.stringify(cs).slice(0, 200));
        afirma(JSON.stringify(cs.conflito) === JSON.stringify(rotulos) && JSON.stringify(cs.motivos) === JSON.stringify(['Naturezas predominantes indicadas: ' + listaComE(rotulos)]), key + ': conflito e motivo gravados só com as naturezas marcadas (' + rotulos.length + ')');
        afirma(it.justificativaAutomatica === justificativaEsperada(rotulos), key + ': justificativa gravada é o texto aprovado com a lista dinâmica');
        /* abre sem alternar: a tela lembra o estado do detalhe entre avaliações */
        await page.evaluate(() => { const d = document.getElementById('avpPorQueDet'); if (d && !d.open) d.querySelector('summary').click(); });
        const secao = page.locator('#avpSecaoSistema');
        const tela = (await secao.innerText()).replace(/\s+/g, ' ');
        afirma(tela.indexOf('Camada identificada: ' + ROTULO_CONFLITO) !== -1, key + ' tela: "Camada identificada: ' + ROTULO_CONFLITO + '"');
        afirma(tela.indexOf('Naturezas predominantes indicadas: ' + listaComE(rotulos) + '.') !== -1, key + ' tela: "Naturezas predominantes indicadas: ' + listaComE(rotulos) + '."');
        afirma(tela.indexOf(justificativaEsperada(rotulos)) !== -1, key + ' tela: justificativa da classificação com a lista dinâmica');
        afirma(await page.locator('#avpPorQueDet .avp-motivos-list li').count() === 1, key + ' tela: um único motivo (as naturezas indicadas)');
        afirma(!nao.some((n) => tela.indexOf(n) !== -1), key + ' tela: nenhuma natureza NÃO marcada é citada');
        afirma(!/Categorias em conflito nas respostas/.test(tela) && !/não reúnem evidência suficiente/.test(tela), key + ' tela: sem o texto fixo de conflito nem "evidência insuficiente"');
        afirma(await larguraOk(page), key + ' tela: sem rolagem horizontal');
        if (key === 'c3') { await foto(page, 'b3-resultado-tres-naturezas-' + sufixo); await fotoDe(secao, 'b3-o-que-o-sistema-concluiu-' + sufixo); }
        const pdf = await gerarPdf(page);
        afirma(pdf.indexOf(ROTULO_CONFLITO) !== -1 && pdf.indexOf('Naturezas predominantes indicadas: ' + listaComE(rotulos) + '.') !== -1 && pdf.indexOf(justificativaEsperada(rotulos)) !== -1,
          key + ' PDF: rótulo, naturezas indicadas e justificativa — os mesmos da tela', pdf.slice(pdf.indexOf('O que o sistema concluiu'), pdf.indexOf('O que o sistema concluiu') + 300));
        const trechoPdf = pdf.slice(pdf.indexOf('O que o sistema concluiu'), pdf.indexOf('Relação arquitetural') > 0 ? pdf.indexOf('Relação arquitetural') : pdf.indexOf('O que o sistema concluiu') + 1500);
        afirma(!nao.some((n) => trechoPdf.indexOf(n) !== -1), key + ' PDF: nenhuma natureza NÃO marcada é citada na conclusão');
        await page.click('#avpVoltarListaResultado'); await page.waitForSelector('#avpNovoBtn'); await page.waitForTimeout(200);
      }
      afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
      await ctx.close();
    }
  }
}

(async () => {
  parteA();
  const browser = await chromium.launch();
  try { await parteB(browser); } finally { await browser.close(); }
  console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
