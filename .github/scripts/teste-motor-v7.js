/* Motor arquitetural — proposta da versão 7: incoerência ampliada, conflito de naturezas (P9–P16) e
 * recorte do objeto. A proposta é entregue pelo código e só vale sobre a versão 6 exata (Capacidade G);
 * nada é publicado sozinho.
 *
 * PARTE A (código real num vm, sem navegador):
 *   - a matriz dos 28 pares: exatamente os 13 conflitos e os 15 recortes aprovados;
 *   - V6 × V7 nas 65.536 combinações: contagens EXATAS de cada classificação, 44.416 mudanças e o delta
 *     origem → destino exato; as mesmas 252 Capacidades; nenhuma mudança em Produto/Serviço, Unidade de
 *     valor, Componente, Modalidade, Regra e Processo; com 0 ou 1 natureza só mudam os 384 casos de P5 com
 *     uma só P13/P14/P15; com 2 naturezas o tipo segue a matriz; P6, P7 e S1–S8 fora;
 *   - as regras firmes ficam com as condições da V6 (só a precedência muda);
 *   - a proposta só existe sobre a versão 6 exata, e consultar nunca grava;
 *   - os textos de incoerência, conflito, recorte e o caso misto; as versões 5/6 continuam com os textos
 *     da época.
 * PARTE B (navegador, banco falso em persistenciaReal, desktop e 375 px): cartão da proposta no editor,
 *   carregar, regras novas visíveis, simular (com o tipo e o motivo) sem gravar; com a versão 7 publicada,
 *   avaliações novas de recorte, incoerência e caso misto mostram rótulo, detalhe e justificativa; a
 *   avaliação concluída antes fica byte a byte igual. Hermético: sem rede, sem segredo. */
const { chromium } = require('playwright');
const { esperarSessaoAssentada } = require('./esperas');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const RAIZ = path.join(__dirname, '..', '..', 'forca-agil');
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const SRC = {
  qc: fs.readFileSync(path.join(RAIZ, 'questionarios-config.js'), 'utf8'),
  motor: fs.readFileSync(path.join(RAIZ, 'motor-arquitetura.js'), 'utf8'),
  avp: fs.readFileSync(path.join(RAIZ, 'avaliacao-produto.js'), 'utf8')
};
const EMAIL = 'adm@previ.com.br';
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const clone = (x) => JSON.parse(JSON.stringify(x));
const C = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'P11', 'P12', 'P13', 'P14', 'P15', 'P16'];
const NAT = ['P9', 'P10', 'P11', 'P12', 'P13', 'P14', 'P15', 'P16'];
const ORDEM = ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia', 'jornada', 'medicao', 'gestao',
  'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'];
const CONFLITOS = ['P9×P13', 'P9×P14', 'P9×P15', 'P10×P11', 'P10×P13', 'P10×P15', 'P11×P13', 'P11×P14', 'P11×P15', 'P12×P13', 'P12×P15', 'P13×P14', 'P13×P15'];
const RECORTES = ['P9×P10', 'P9×P11', 'P9×P12', 'P9×P16', 'P10×P12', 'P10×P14', 'P10×P16', 'P11×P12', 'P11×P16', 'P12×P14', 'P12×P16', 'P13×P16', 'P14×P15', 'P14×P16', 'P15×P16'];
const DIST_V6 = { 'AV-incoerencia': 16384, 'funcionalidade-operacao': 16384, canal: 16384, 'documento-informacao': 8192, 'AV-conflito': 6656, 'AV-sem-classificacao': 956,
  'capacidade-organizacional': 252, 'modalidade-subproduto': 128, componente: 64, 'regra-condicao': 64, 'processo-etapa': 64, 'produto-principal': 4, 'unidade-valor-associada': 4 };
const DIST_V7 = { 'AV-incoerencia': 30720, 'AV-conflito': 28416, 'AV-recorte': 4608, 'AV-sem-classificacao': 572, canal: 256, 'documento-informacao': 256,
  'capacidade-organizacional': 252, 'modalidade-subproduto': 128, 'funcionalidade-operacao': 128, componente: 64, 'regra-condicao': 64, 'processo-etapa': 64,
  'produto-principal': 4, 'unidade-valor-associada': 4 };
const DELTA = { 'funcionalidade-operacao → AV-conflito': 13952, 'canal → AV-conflito': 7680, 'canal → AV-incoerencia': 7168, 'documento-informacao → AV-conflito': 3840,
  'documento-informacao → AV-incoerencia': 3584, 'AV-conflito → AV-incoerencia': 3200, 'funcionalidade-operacao → AV-recorte': 2304, 'canal → AV-recorte': 1280,
  'documento-informacao → AV-recorte': 512, 'AV-conflito → AV-recorte': 512, 'AV-sem-classificacao → AV-incoerencia': 384 };

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (cond || detalhe === undefined ? '' : ' — ' + detalhe)); if (!cond) falhas++; }
const ordenado = (o) => JSON.stringify(Object.keys(o).sort().reduce((r, k) => { r[k] = o[k]; return r; }, {}));

function carregar(config, escritas, comAvaliacao) {
  const ctx = { console: { log() {}, warn() {}, error() {} }, JSON, Object, Array, String, Math, Number, Date, RegExp, Error, Promise, setTimeout, clearTimeout, setInterval, clearInterval, parseFloat, parseInt, isNaN };
  ctx.window = ctx;
  const el = () => ({ addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, style: {}, classList: { add() {}, remove() {}, contains() { return false; } } });
  ctx.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, addEventListener() {}, body: el(), documentElement: el() };
  const anota = (op, p) => { if (escritas) escritas.push(op + ' ' + p); };
  const ref = (p) => ({
    on(ev, cb) { if (p === 'motor-arquitetura-config' && config !== undefined) cb({ val: () => clone(config) }); },
    once() {}, off() {}, update() { anota('update', p); }, set() { anota('set', p); }, remove() { anota('remove', p); },
    transaction() { anota('transaction', p); }, child(c) { return ref(p + '/' + c); }, push() { anota('push', p); return { key: 'k' }; }
  });
  ctx.firebase = { database: () => ({ ref }) };
  ctx.navigator = {}; ctx.location = { hash: '' }; ctx.localStorage = { getItem() { return null; }, setItem() {} };
  vm.createContext(ctx);
  vm.runInContext(SRC.qc, ctx, { filename: 'questionarios-config.js' });
  vm.runInContext(SRC.motor, ctx, { filename: 'motor-arquitetura.js' });
  if (comAvaliacao) {
    const fim = SRC.avp.lastIndexOf('})();');
    vm.runInContext(SRC.avp.slice(0, fim) + '\nwindow.__avpTeste = { computeResultado: computeResultado, gerarJustificativaAutomatica: gerarJustificativaAutomatica };\n' + SRC.avp.slice(fim), ctx, { filename: 'avaliacao-produto.js' });
  }
  if (config !== undefined) ctx.window.faMotorArquitetura.onMudanca(function () {});
  return { M: ctx.window.faMotorArquitetura, av: ctx.__avpTeste };
}
const contexto = (n) => { const c = {}; for (let b = 0; b < 16; b++) c[C[b]] = (n >> b) & 1 ? 'SIM' : 'NAO'; return c; };
const bitsDe = (sims) => sims.reduce((n, c) => n | (1 << C.indexOf(c)), 0);
const nats = (n) => NAT.filter((c) => (n >> C.indexOf(c)) & 1);

function parteA() {
  console.log('== PARTE A — código real, 65.536 combinações, V6 publicada × proposta V7 ==');
  const { M } = carregar();
  const v6 = M.regrasVersao6Esperadas();
  const v7 = M.construirPropostaV7(clone(v6));
  afirma(JSON.stringify(v6) === JSON.stringify(M.regrasVersao6Esperadas()), 'montar a V7 não altera as regras da V6 recebidas');
  afirma(M.validarRegras({ regras: v6 }).length === 0 && M.validarRegras({ regras: v7 }).length === 0, 'V6 e V7 passam no validador do motor', M.validarRegras({ regras: v7 }).join(' / '));
  afirma(v6.length === 13 && v7.length === 14, 'V6 com 13 regras, V7 com 14', v6.length + ' / ' + v7.length);
  afirma(v7.map((r) => r.codigo).join(',') === 'INCOERENCIA,PRODUTO_SERVICO_PRINCIPAL,CONFLITO_NATUREZAS,RECORTE_OBJETO,FUNCIONALIDADE_OPERACAO,CANAL,DOCUMENTO_INFORMACAO,UNIDADE_VALOR_ASSOCIADA,CAPACIDADE_ORGANIZACIONAL,COMPONENTE,MODALIDADE_SUBPRODUTO,REGRA_CONDICAO,PROCESSO_ETAPA,FALLBACK_A_VALIDAR' && v7.every((r, i) => r.ordem === i),
    'precedência da V7: incoerência, Produto/Serviço, conflito, recorte, depois as firmes e o fallback');
  const firmes = ['PRODUTO_SERVICO_PRINCIPAL', 'FUNCIONALIDADE_OPERACAO', 'CANAL', 'DOCUMENTO_INFORMACAO', 'UNIDADE_VALOR_ASSOCIADA', 'CAPACIDADE_ORGANIZACIONAL', 'COMPONENTE', 'MODALIDADE_SUBPRODUTO', 'REGRA_CONDICAO', 'PROCESSO_ETAPA', 'FALLBACK_A_VALIDAR'];
  const semOrdem = (r) => JSON.stringify(Object.assign({}, r, { ordem: null }));
  afirma(firmes.every((c) => semOrdem(v6.find((r) => r.codigo === c)) === semOrdem(v7.find((r) => r.codigo === c))), 'as regras firmes e o fallback ficam idênticos aos da V6 (condições, motivos) — só a precedência muda');
  afirma(!/"P6"|"P7"|"S[1-8]"/.test(JSON.stringify(v7)), 'nenhuma regra da V7 lê P6, P7 ou S1–S8');
  const inc = v7.find((r) => r.codigo === 'INCOERENCIA');
  afirma(JSON.stringify(inc.condicoes) === JSON.stringify({ all: [{ campo: 'P5', valor: 'SIM' }, { atLeast: 1, of: ['P13', 'P14', 'P15', 'P16'].map((campo) => ({ campo, valor: 'SIM' })) }] }) && inc.incoerencia && inc.tipoAValidar === 'incoerencia',
    'INCOERENCIA: P5 = SIM e pelo menos uma entre P13, P14, P15 e P16 = SIM');
  const mtz = M.MATRIZ_NATUREZAS;
  afirma(mtz.length === 28, '28 pares na matriz');
  const de = (tipo) => mtz.filter((p) => p.tipo === tipo).map((p) => p.a + '×' + p.b);
  afirma(JSON.stringify(de('conflito')) === JSON.stringify(CONFLITOS), '13 pares de conflito, exatamente os aprovados', de('conflito').join(','));
  afirma(JSON.stringify(de('recorte')) === JSON.stringify(RECORTES), '15 pares de recorte, exatamente os aprovados', de('recorte').join(','));
  afirma(mtz.every((p) => p.pista && p.pista.length > 10), 'cada par tem uma pista de revisão (só orientação)');
  const conf = v7.find((r) => r.codigo === 'CONFLITO_NATUREZAS');
  afirma(conf.condicoes.all[1].any.map((g) => g.all.map((f) => f.campo).join('×')).join(',') === CONFLITOS.join(','), 'CONFLITO_NATUREZAS lista os 13 pares (a pista não entra na regra)');
  afirma(v7.find((r) => r.codigo === 'RECORTE_OBJETO').tipoAValidar === 'recorte' && v7.find((r) => r.codigo === 'RECORTE_OBJETO').resultado === 'a-validar', 'RECORTE_OBJETO é um tipo de "A validar", não uma classificação nova');

  const rot = (x) => (x.camada !== 'a-validar' ? x.camada : 'AV-' + M.tipoDeAValidar(x));
  const a = [], b = [];
  for (let n = 0; n < 65536; n++) { a.push(M.identificarCamada(contexto(n), { regras: v6 })); b.push(M.identificarCamada(contexto(n), { regras: v7 })); }
  const d6 = {}, d7 = {}, delta = {}; let muda = 0;
  for (let n = 0; n < 65536; n++) { const x = rot(a[n]), y = rot(b[n]); d6[x] = (d6[x] || 0) + 1; d7[y] = (d7[y] || 0) + 1; if (x !== y) { muda++; delta[x + ' → ' + y] = (delta[x + ' → ' + y] || 0) + 1; } }
  afirma(ordenado(d6) === ordenado(DIST_V6), 'V6: contagens exatas por classificação', JSON.stringify(d6));
  afirma(ordenado(d7) === ordenado(DIST_V7), 'V7: contagens exatas por classificação', JSON.stringify(d7));
  afirma(muda === 44416, 'exatamente 44.416 combinações mudam', muda);
  afirma(ordenado(delta) === ordenado(DELTA), 'delta origem → destino exato (11 conjuntos)', JSON.stringify(delta));
  let cap = true, firmeMuda = 0, umaMuda = 0, umaFora = 0;
  for (let n = 0; n < 65536; n++) {
    if ((a[n].camada === 'capacidade-organizacional') !== (b[n].camada === 'capacidade-organizacional')) cap = false;
    if (['produto-principal', 'unidade-valor-associada', 'componente', 'modalidade-subproduto', 'regra-condicao', 'processo-etapa'].some((k) => a[n].camada === k || b[n].camada === k) && a[n].camada !== b[n].camada) firmeMuda++;
    if (nats(n).length <= 1 && rot(a[n]) !== rot(b[n])) { umaMuda++; const c = contexto(n); if (!(c.P5 === 'SIM' && nats(n).length === 1 && ['P13', 'P14', 'P15'].includes(nats(n)[0]) && rot(b[n]) === 'AV-incoerencia')) umaFora++; }
  }
  afirma(cap, 'as mesmas 252 combinações continuam Capacidade (G)');
  afirma(firmeMuda === 0, 'Produto/Serviço, Unidade de valor, Componente, Modalidade, Regra e Processo: nenhuma combinação muda');
  afirma(umaMuda === 384 && umaFora === 0, 'com 0 ou 1 natureza, só mudam os 384 casos de P5 com uma única P13/P14/P15 (→ incoerência)', umaMuda + ' / ' + umaFora);
  let doisOk = true;
  for (let n = 0; n < 65536; n++) {
    const m = nats(n); if (m.length !== 2) continue; const c = contexto(n);
    if (c.P5 === 'SIM' && m.some((k) => ['P13', 'P14', 'P15', 'P16'].includes(k))) continue;
    const esperado = CONFLITOS.includes(m.join('×')) ? 'AV-conflito' : 'AV-recorte';
    if (rot(b[n]) !== esperado) doisOk = false;
  }
  afirma(doisOk, 'com exatamente 2 naturezas (sem incoerência), o tipo segue a matriz em todos os 28 pares');
  let misto = 0, mistoOk = true;
  for (let n = 0; n < 65536; n++) {
    if (b[n].regraAplicada !== 'CONFLITO_NATUREZAS') continue;
    const pares = M.paresMarcados(contexto(n));
    if (!pares.some((p) => p.tipo === 'conflito')) mistoOk = false;
    if (pares.some((p) => p.tipo === 'recorte')) misto++;
  }
  afirma(mistoOk && misto === 25472, 'todo conflito tem um par de conflito; 25.472 são mistos (conflito + recorte) e ficam conflito', misto);
  const comS = (n, v) => { const c = contexto(n); for (let i = 1; i <= 8; i++) c['S' + i] = v; return c; };
  let difS = 0; for (let n = 0; n < 65536; n += 7) if (rot(M.identificarCamada(comS(n, 'SIM'), { regras: v7 })) !== rot(b[n])) difS++;
  afirma(difS === 0, 'S1–S8 no contexto não mudam nada (amostra de 9.363 combinações)');
  let difP6 = 0; for (let n = 0; n < 65536; n++) { const t = n ^ (1 << 5) ^ (1 << 6); if (rot(b[n]) !== rot(b[t])) difP6++; }
  afirma(difP6 === 0, 'trocar P6 e P7 nunca muda o resultado da V7');
  return { M, v6, v7 };
}

function parteA2(R) {
  console.log('-- a proposta só existe sobre a versão 6 exata, e consultar nunca grava --');
  const escritas = [];
  const v5 = R.M.regrasVersao5Esperadas();
  const base6 = { versaoPublicada: 6, versoes: { 5: { regras: v5 }, 6: { regras: R.v6 } } };
  const k6 = carregar(base6, escritas).M;
  const s6 = k6.situacaoPropostaRegras();
  afirma(s6.estado === 'disponivel' && s6.versaoBase === 6 && s6.id === 'v7-incoerencia-conflito-recorte', 'versão 6 publicada com a estrutura esperada: proposta da V7 disponível');
  afirma(k6.diffRegras(k6.regrasDaPropostaRegras(), R.v7).length === 0, 'as regras entregues são exatamente as da V7 aprovada');
  const div = clone(base6); div.versoes[6].regras.find((r) => r.codigo === 'CAPACIDADE_ORGANIZACIONAL').condicoes.all.push({ campo: 'P2', valor: 'NAO' });
  const sd = carregar(div, escritas).M.situacaoPropostaRegras();
  afirma(sd.estado === 'bloqueada' && /CAPACIDADE_ORGANIZACIONAL/.test(sd.motivo), 'versão 6 com outra estrutura: bloqueada, dizendo qual regra difere', sd.motivo);
  afirma(carregar({ versaoPublicada: 7, versoes: { 6: { regras: R.v6 }, 7: { regras: R.v7 } } }, escritas).M.situacaoPropostaRegras().estado === 'aplicada', 'versão 7 = a proposta publicada: "aplicada"');
  afirma(escritas.length === 0, 'nenhuma consulta gravou nada', escritas.join(', '));

  console.log('-- textos (código real da avaliação) --');
  const publicada7 = { versaoPublicada: 7, versoes: { 6: { regras: R.v6 }, 7: { regras: R.v7 } } };
  const { av } = carregar(publicada7, null, true);
  const resp = (sims) => { const r = {}; ORDEM.forEach((id, i) => { r[id] = { valor: sims.includes('P' + (i + 1)) ? 'sim' : 'nao' }; }); return { respostas: r }; };
  const calc = (sims) => { const at = resp(sims); const x = av.computeResultado(at); return { x, j: av.gerarJustificativaAutomatica(at, x) }; };
  {
    const { x, j } = calc(['P5', 'P13']);
    afirma(x.camadaSugerida.label === 'A validar — incoerência' && x.camadaSugerida.tipoAValidar === 'incoerencia', 'P5 + P13: "A validar — incoerência"', x.camadaSugerida.label);
    afirma(j === 'As respostas se contradizem: o item foi descrito como capaz de existir e entregar resultado sem depender estruturalmente de outro Produto/Serviço e, ao mesmo tempo, como modalidade, opção ou configuração de outro Produto/Serviço. As duas respostas não podem descrever o mesmo objeto. Se o item pertence a outro Produto/Serviço, reveja P5; se existe por si, reveja a outra resposta. P5 avalia o objeto, não a autonomia da equipe.',
      'texto de incoerência com uma natureza', j);
    afirma(x.camadaSugerida.motivos.length === 2 && x.camadaSugerida.motivos.every((m) => /: SIM$/.test(m)), 'motivos: só P5 e a natureza marcada', JSON.stringify(x.camadaSugerida.motivos));
  }
  {
    const { j } = calc(['P5', 'P14', 'P16']);
    afirma(/como regra ou condição e funcionalidade ou operação de outro Produto\/Serviço\. Essas respostas não podem descrever o mesmo objeto\. .*reveja as outras respostas\./.test(j), 'incoerência com duas naturezas cita só as duas', j);
  }
  {
    const { x, j } = calc(['P13', 'P14']);
    afirma(x.camadaSugerida.label === 'A validar — conflito de naturezas', 'P13 + P14: "A validar — conflito de naturezas"', x.camadaSugerida.label);
    afirma(j === 'O mesmo objeto recebeu naturezas predominantes que não podem ser escolhidas simultaneamente para o mesmo recorte: Modalidade/Subproduto e Regra/Opção. Para esta avaliação, é necessário identificar qual natureza predomina no recorte analisado. Reveja as respostas e mantenha como SIM a natureza que melhor descreve o que o objeto é. Pista: Se o cliente escolhe, é Modalidade; se é imposta, é Regra.',
      'texto de conflito, com a pista do par', j);
    afirma(!/uma coisa só/.test(j), 'sem a frase absoluta "um item é principalmente uma coisa só"');
  }
  {
    const { x, j } = calc(['P9', 'P16']);
    afirma(x.camadaSugerida.label === 'A validar — recorte do objeto', 'P9 + P16: "A validar — recorte do objeto"', x.camadaSugerida.label);
    afirma(j === 'As naturezas marcadas (Canal e Funcionalidade/Operação) costumam pertencer a objetos diferentes e relacionados. A avaliação provavelmente reuniu mais de um objeto no mesmo item. Defina exatamente o que está sendo avaliado e, se forem objetos distintos, avalie cada um separadamente. Pista: O canal contém funcionalidades: avalie o canal ou a operação dentro dele.',
      'texto de recorte, com a pista do par', j);
  }
  {
    const { x, j } = calc(['P9', 'P12', 'P13']);
    afirma(x.camadaSugerida.label === 'A validar — conflito de naturezas', 'misto P9 + P12 + P13: conflito prevalece');
    afirma(/escolhidas simultaneamente para o mesmo recorte: Canal, Processo\/Etapa de processo e Modalidade\/Subproduto\./.test(j) && /Há também sinais de que o item pode estar reunindo objetos diferentes \(Canal e Processo\/Etapa de processo\)/.test(j) && !/Pista:/.test(j),
      'misto: cita as naturezas em conflito e também os sinais de mistura de objetos', j);
    const ms = x.camadaSugerida.motivos.join(' | ');
    afirma(/Naturezas que não podem ser escolhidas juntas: Canal × Modalidade\/Subproduto; Processo\/Etapa de processo × Modalidade\/Subproduto/.test(ms) && /Naturezas que costumam ser objetos diferentes: Canal × Processo\/Etapa de processo/.test(ms) && x.camadaSugerida.motivos.length === 2,
      'motivos: só os pares envolvidos, agrupados — nunca as oito perguntas', ms);
  }
  {
    const { x } = calc(['P9']);
    afirma(x.camadaSugerida.id === 'canal' && !x.camadaSugerida.tipoAValidar, 'P9 sozinho continua Canal, sem marca nova');
  }
  /* as versões anteriores continuam com os textos da época */
  const { av: av6 } = carregar({ versaoPublicada: 6, versoes: { 6: { regras: R.v6 } } }, null, true);
  const at = resp(['P11', 'P13']); const x6 = av6.computeResultado(at);
  afirma(!x6.camadaSugerida.tipoAValidar && x6.camadaSugerida.label === 'A validar — conflito de naturezas predominantes' && /^As respostas indicam mais de uma natureza arquitetural como predominante/.test(av6.gerarJustificativaAutomatica(at, x6)),
    'com a V6, o conflito continua com o rótulo e o texto da época');
}

function item(nome, sims, camada) {
  const respostas = {};
  ORDEM.forEach((id, i) => { const cod = 'P' + (i + 1); respostas[id] = { valor: sims.includes(cod) ? 'sim' : 'nao', observacao: '', justificativaAuto: 'auto', codigoPergunta: cod, textoPerguntaNaEpoca: 't', tituloNaEpoca: 't', questionnaireContentVersion: 1 }; });
  return { nome, descricao: '', publico: '', necessidade: '', observacoesGerais: '', status: 'concluido', respostas,
    resultadoAutomatico: camada === 'a-validar' ? 'a-validar' : 'nao-produto', decisaoFinal: null, decisaoManual: false,
    camadaSugerida: { id: camada, label: camada, motivos: ['motivo da época'], conflito: null, incoerencia: false, especializacao: null, papelEstrutural: null, relacao: 'relação da época' },
    justificativaAutomatica: 'justificativa da época', criteriosEssenciaisFalhos: [], exclusoesConflitantes: null, criteriosAtendidos: 1,
    motorVersionArquitetura: 6, questionnaireContentVersion: 1, criadoEm: '2026-10-07T10:00:00.000Z', atualizadoEm: '2026-10-07T10:00:00.000Z',
    responsavel: { name: 'Teste', email: EMAIL }, versao: 1, versaoAnteriorKey: null, excluido: false, excluidoEm: null, excluidoPor: null,
    justificativaExclusao: null, historicoMotor: null, itemId: nome };
}
async function abrir(browser, viewport, configMotor, avaliacoes, rota) {
  const admins = {}; admins[chave(EMAIL)] = { email: EMAIL };
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': admins, 'turmas-config': {}, 'turmas-checkin': {}, 'turmas-espera': {},
    'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {}, eventos: {}, 'turmas-publico': {}, 'eventos-publico': {},
    'avaliacoes-produto': avaliacoes, 'avaliacoes-squad': {}, 'motor-squad-config': {}, 'motor-squad-auditoria': {},
    'motor-arquitetura-config': configMotor, 'motor-arquitetura-auditoria': {} };
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify({ db, user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#' + (rota || 'admin'), { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
const banco = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal)));
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

async function parteB(browser, R) {
  const v5 = R.M.regrasVersao5Esperadas();
  const base6 = { versaoPublicada: 6, versoes: { 5: { regras: v5 }, 6: { regras: R.v6 } } };
  const publicada7 = { versaoPublicada: 7, versoes: { 6: { regras: R.v6 }, 7: { regras: R.v7 } } };
  for (const [rotulo, viewport] of [['desktop', { width: 1280, height: 900 }], ['celular 375 px', { width: 375, height: 800 }]]) {
    console.log('\n== PARTE B (' + rotulo + ') — proposta da V7 no editor do motor (versão 6 publicada) ==');
    {
      const avaliacoes = {
        so16: item('Só funcionalidade', ['P16'], 'funcionalidade-operacao'),
        chat: item('Chat do aplicativo', ['P9', 'P16'], 'funcionalidade-operacao'),
        perfil: item('Perfil autônomo', ['P5', 'P9', 'P13'], 'canal'),
        carencia: item('Carência', ['P11', 'P13'], 'a-validar')
      };
      const { ctx, page, erros } = await abrir(browser, viewport, clone(base6), avaliacoes);
      await page.click('.admin-tab-btn[data-panel="adminPanelArquitetura"]');
      await page.waitForSelector('#avpConfigMotoresBtn');
      await page.click('#avpConfigMotoresBtn');
      await page.waitForSelector('#avpMotorArqEditarBtn');
      const inicio = await banco(page);
      await page.click('#avpMotorArqEditarBtn');
      await page.waitForSelector('#avpPropostaRegras');
      const txt = await page.locator('#avpPropostaRegras').innerText();
      afirma(await page.locator('#avpPropostaRegras').getAttribute('data-estado') === 'disponivel' && /versão 7/.test(txt) && /versão 6 publicada/.test(txt) && /nada é gravado, nada é publicado/.test(txt) && /RECORTE_OBJETO/.test(txt),
        'cartão da proposta: sobre a versão 6, não publicada, carregar só troca o editor', txt.slice(0, 160));
      afirma(await larguraOk(page), 'cartão sem rolagem horizontal');
      await page.click('#avpCarregarPropostaBtn');
      await page.click('.avp-modal-confirm-btn');
      await page.waitForSelector('#avpPropostaNoEditor');
      const cabecalhos = await page.locator('.sq-regra-codigo').allInnerTexts();
      afirma(cabecalhos.length === 14 && /Precedência 2 — CONFLITO_NATUREZAS/.test(cabecalhos[2]) && /Precedência 3 — RECORTE_OBJETO/.test(cabecalhos[3]) && /recorte do objeto: cita só as naturezas marcadas SIM/.test(cabecalhos[3]) && /incoerência: cita só as naturezas marcadas SIM/.test(cabecalhos[0]),
        'as 14 regras novas aparecem no editor, com o tipo de "A validar"', cabecalhos.slice(0, 4).join(' | '));
      afirma(JSON.stringify(await banco(page)) === JSON.stringify(inicio), 'carregar a proposta não gravou nada');
      await page.click('#avpMotorArqSimularBtn');
      await page.waitForSelector('#avpMotorArqConfirmarPublicarBtn');
      const sim = await page.locator('.avp-config-motores').innerText();
      afirma(/4 avaliações analisadas/.test(sim) && /2 manteriam/.test(sim) && /2 mudariam/.test(sim), 'simulação: 4 analisadas, 2 mantêm (só funcionalidade; conflito continua conflito), 2 mudariam', sim.slice(0, 200));
      const linhas = await page.locator('.avp-config-motores table.admin-table tbody tr').evaluateAll((trs) => trs.map((t) => t.innerText.replace(/\s+/g, ' ')));
      afirma(linhas.some((l) => /Chat do aplicativo/.test(l) && /Funcionalidade\/Operação/.test(l) && /A validar — recorte do objeto/.test(l) && /Recorte do objeto: Canal e Funcionalidade\/Operação/.test(l)), 'Chat do aplicativo: Funcionalidade → recorte, com o motivo', linhas.join(' | '));
      afirma(linhas.some((l) => /Perfil autônomo/.test(l) && /Canal/.test(l) && /A validar — incoerência/.test(l) && /Incoerência: autonomia \(P5\) × Modalidade\/Subproduto/.test(l)), 'Perfil autônomo: Canal → incoerência, com o motivo', linhas.join(' | '));
      afirma(JSON.stringify(await banco(page)) === JSON.stringify(inicio), 'simular não gravou nada');
      afirma(await larguraOk(page), 'simulação sem rolagem horizontal');
      afirma(erros.length === 0, 'sem erro de página', erros.join(' | '));
      await ctx.close();
    }

    console.log('== PARTE B (' + rotulo + ') — versão 7 publicada: avaliações novas ==');
    {
      const antiga = item('Concluída na versão 6', ['P9', 'P16'], 'funcionalidade-operacao');
      const { ctx, page, erros } = await abrir(browser, viewport, clone(publicada7), { antiga: clone(antiga) }, 'avaliacoes');
      await page.waitForSelector('#avpNovoBtn');
      const inicio = await banco(page);
      const casos = [
        ['Chat do aplicativo', ['P9', 'P16'], 'recorte', 'A validar — recorte do objeto', /Naturezas que costumam ser objetos diferentes: Canal × Funcionalidade\/Operação\./],
        ['Perfil de investimento', ['P5', 'P13'], 'incoerencia', 'A validar — incoerência', /As respostas se contradizem: autonomia estrutural \(P5\) × Modalidade\/Subproduto\./],
        ['Atendimento', ['P9', 'P12', 'P13'], 'conflito', 'A validar — conflito de naturezas', /Naturezas que não podem ser escolhidas juntas: Canal × Modalidade\/Subproduto; Processo\/Etapa de processo × Modalidade\/Subproduto\..*Naturezas que costumam ser objetos diferentes: Canal × Processo\/Etapa de processo\./s]
      ];
      for (const [nome, sims, tipo, rotuloEsperado, detalhe] of casos) {
        await page.evaluate(() => { location.hash = '#avaliacoes'; });
        await page.waitForSelector('#avpNovoBtn');
        await page.click('#avpNovoBtn');
        await page.fill('#avpfNome', nome);
        await page.click('#avpIniciarBtn');
        await page.waitForSelector('#avpQuestion-funcionalidade');
        for (let i = 0; i < ORDEM.length; i++) await page.locator('#avpQuestion-' + ORDEM[i] + ' .avp-choice-btn--' + (sims.includes('P' + (i + 1)) ? 'sim' : 'nao')).click();
        await page.click('#avpConcluirBtn');
        await page.waitForSelector('#avpAValidarDetalhe', { timeout: 10000 });
        const db = await banco(page);
        const nova = Object.values(db['avaliacoes-produto']).find((i) => i.nome === nome);
        afirma(nova && nova.camadaSugerida.id === 'a-validar' && nova.camadaSugerida.tipoAValidar === tipo && nova.camadaSugerida.label === rotuloEsperado && nova.motorVersionArquitetura === 7,
          nome + ': ' + rotuloEsperado + ' (código a-validar), processada pela versão 7', nova && JSON.stringify(nova.camadaSugerida).slice(0, 200));
        const card = await page.locator('.avp-alt-card').textContent();
        afirma(card.includes(rotuloEsperado) && detalhe.test(card) && card.includes(nova.justificativaAutomatica), nome + ': a ficha mostra o rótulo, só as naturezas/pares envolvidos e a justificativa', card.slice(0, 300));
        afirma(await larguraOk(page), nome + ': ficha sem rolagem horizontal');
      }
      const db = await banco(page);
      afirma(JSON.stringify(db['avaliacoes-produto'].antiga) === JSON.stringify(inicio['avaliacoes-produto'].antiga), 'a avaliação concluída na versão 6 fica byte a byte igual (nada reprocessado)');
      afirma(JSON.stringify(db['motor-arquitetura-config']) === JSON.stringify(inicio['motor-arquitetura-config']), 'as regras publicadas não mudaram');
      afirma(erros.length === 0, 'sem erro de página', erros.join(' | '));
      await ctx.close();
    }
  }
}

(async () => {
  const R = parteA();
  parteA2(R);
  const browser = await chromium.launch();
  try { await parteB(browser, R); } catch (e) { afirma(false, 'execução', String(e && e.stack || e)); }
  await browser.close();
  console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nOK — V7: contagens e delta exatos, proposta só sobre a V6, textos dos três tipos e histórico intacto.');
  process.exit(falhas ? 1 : 0);
})();
