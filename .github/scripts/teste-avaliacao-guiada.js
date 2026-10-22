/* AVALIAÇÃO GUIADA (v22) — a experiência de perguntas da Avaliação de Produto/Serviço.
 * Hermético: Firebase falso em persistência real, sem rede nem segredo; dados sintéticos. Computador e 375 px.
 *
 * A. Módulo puro (forca-agil/avaliacao-guiada.js), em Node:
 *    - 31 perguntas, a ordem e as condicionais da v22; nenhuma regra de classificação no módulo;
 *    - "Não sei", "mistura", dúvida e confirmação ausente NUNCA viram NÃO (amostra aleatória grande do espaço guiado);
 *    - ida e volta nas 65.536 combinações de P1–P16: para cada uma há respostas guiadas que dão exatamente o mesmo
 *      P1–P16 e permitem concluir — com a regra PUBLICADA (v7), a mesma configuração que vai para a página;
 *    - P6/P7 com "Não sei": não impedem concluir quando a regra publicada não os lê (ficam "não confirmados");
 *      impedem quando ela lê.
 * B. Pela interface (computador e 375 px): iniciar → uma pergunta por vez (progresso, Anterior/Continuar, ajuda,
 *    condicional) → SALVAR RASCUNHO (interromper) → retomar de onde parou → revisão (prévia oficial; "Não sei" num
 *    critério decisivo = "Evidências ainda insuficientes" e Concluir desabilitado) → concluir → ficha (classificação do
 *    motor oficial para o P1–P16 traduzido, respostas guiadas, P7 "NÃO CONFIRMADO") → F5 → PDF e Excel com "NÃO
 *    CONFIRMADO"; Voltar do navegador com resposta não salva pergunta antes; reavaliação de uma avaliação antiga com
 *    decisão manual: começa em branco, a anterior fica byte a byte igual e a decisão não é herdada; regra publicada
 *    que lê P6 → P6 "Não sei" volta a impedir; sem rolagem lateral, sem erro de página.
 * C. Redação preservada: cada avaliação grava a cópia do que foi apresentado (pergunta, alternativas, resposta
 *    escolhida); com a cópia trocada no banco (simulando uma redação futura diferente), ficha, PDF e Excel mostram a
 *    cópia gravada — nunca o texto atual. Excel com a aba "Respostas guiadas" no fim (as abas de antes não mudam).
 * D. ADMIN › Questionários: o cartão e o editor de P1–P16 dizem que a redação técnica não é a pergunta guiada.
 * Capturas opcionais: FA_PRINTS=<pasta>. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SJ = require('./semente-jornada');
const RG = require('./responder-guiada');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const { arquivoTemporario } = require('./arquivo-temporario');
const RAIZ = path.join(__dirname, '..', '..', 'forca-agil');
const XLSX = require(path.join(RAIZ, 'xlsx.mini.min.js'));
const G = require(path.join(RAIZ, 'avaliacao-guiada.js'));

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
let falhas = 0, total = 0;
function afirma(c, msg, det) { total++; console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + (typeof det === 'string' ? det : JSON.stringify(det)) : '')); if (!c) falhas++; }
const clone = (x) => JSON.parse(JSON.stringify(x));

/* ---------- o motor oficial (código real) e a regra publicada (v7), montada pelo próprio código ---------- */
const ctxM = { console, JSON, Object, Array, String, Math, Number, Date, RegExp, Error };
ctxM.window = ctxM; ctxM.document = {}; ctxM.firebase = { database: () => ({ ref: () => ({ on() {} }) }) };
vm.createContext(ctxM);
vm.runInContext(fs.readFileSync(path.join(RAIZ, 'motor-arquitetura.js'), 'utf8'), ctxM, { filename: 'motor-arquitetura.js' });
const MA = ctxM.faMotorArquitetura;
const V6 = MA.regrasVersao6Esperadas();
const V7 = MA.construirPropostaV7(clone(V6));
const CONFIG_MOTOR = { versaoPublicada: 7, versoes: { 6: { regras: V6 }, 7: { regras: V7 } } };
const camadaOficial = (P) => { const c = {}; G.CODIGOS.forEach((k) => { c[k] = P[k] === 'S' ? 'SIM' : 'NAO'; }); return MA.identificarCamada(c, { regras: V7 }).camada; };

function parteA() {
  console.log('== A. Módulo puro e motor oficial ==');
  afirma(Object.keys(G.PERGUNTAS).length === 31 && G.ORDEM.length === 31 && G.ORDEM.every((k) => G.PERGUNTAS[k]), '31 perguntas guiadas, na ordem da v22');
  afirma(G.passos({}).length === 22 && G.passos({ P2: 'S', P5: 'oferta', P8: 'S', P12: 'trabalho', F13O: 'alternativa', F13S: 'parte', F13SP: 'oferta' }).length === 29,
    'condicionais: 22 perguntas no caminho inicial; confirmações aparecem só quando a resposta pede', G.passos({}).length);
  const fonteModulo = fs.readFileSync(path.join(RAIZ, 'avaliacao-guiada.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  afirma(!/avaliarV7|identificarCamada|PRODUTO_SERVICO_PRINCIPAL|faMotorArquitetura/.test(fonteModulo), 'o módulo não classifica: nenhum motor nem regra dentro dele (só a tradução)');
  afirma(Object.isFrozen(G) && Object.isFrozen(G.PERGUNTAS.P5.opts), 'módulo congelado');

  /* "Não sei" nunca vira NÃO: amostra aleatória do espaço guiado (respostas válidas de cada pergunta, inclusive "?") */
  let seed = 12345; const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  let violacoes = 0, amostras = 0;
  for (let i = 0; i < 60000; i++) {
    let r = {};
    for (let guarda = 0; guarda < 40; guarda++) {
      const falta = G.passos(r).filter((k) => !G.respondida(r, k))[0];
      if (!falta) break;
      const ops = G.opcoes(falta);
      r = G.responder(r, falta, ops.length ? ops[rnd(ops.length)].valor : (rnd(2) ? 'Produto principal' : ''));
      if (r[falta] === '') delete r[falta];
      if (!G.passos(r).some((k) => !G.respondida(r, k))) break;
      if (!ops.length && !r[falta]) break;
    }
    const m = G.criterios(r); amostras++;
    G.CODIGOS.forEach((c) => {
      if (m[c] !== 'N') return;
      const fontes = G.FONTES[c].filter((k) => G.passos(r).indexOf(k) !== -1);
      if (fontes.some((k) => r[k] === '?' || r[k] === 'mistura' || r[k] === undefined)) violacoes++;
    });
  }
  afirma(violacoes === 0, '"Não sei", "mistura" e pergunta sem resposta nunca viram NÃO (' + amostras + ' conjuntos aleatórios)', violacoes);
  const casos = [
    [{ P5: 'mistura' }, 'P5', '?', 'P5 "mistura oferta e partes" → indefinido'],
    [{ P2: 'S', C2: '?' }, 'P2', '?', 'P2 = Sim sem saber a quem pertence o resultado → indefinido'],
    [{ P2: 'S', C2: 'outro' }, 'P2', 'N', 'P2: resultado de outra entrega → NÃO (correspondência comprovada)'],
    [{ F10I: 'S', F10D: 'S' }, 'P10', '?', 'Informação e Documento juntos → P10 indefinido (não escolhe por conta própria)'],
    [{ F13M: 'oferta', F13O: 'alternativa', F13OC: 'oferta', F13S: 'propria' }, 'P13', '?', 'Opção sem confirmação de escolha interna → P13 indefinido'],
    [{ F16F: '?', F16O: 'N' }, 'P16', '?', 'Funcionalidade "Não sei" → P16 indefinido']
  ];
  casos.forEach(([r, c, v, msg]) => afirma(G.criterios(r)[c] === v, msg, G.criterios(r)[c]));

  /* ida e volta + conclusão possível, nas 65.536 combinações, com a regra publicada */
  let difere = 0, naoConclui = 0;
  const porCamada = {};
  for (let n = 0; n < 65536; n++) {
    const P = RG.pDaMascara(n), g = RG.guiadaDe(P), m = G.criterios(g);
    if (G.CODIGOS.some((c) => m[c] !== P[c])) { difere++; continue; }
    const camada = camadaOficial(m);
    porCamada[camada] = (porCamada[camada] || 0) + 1;
    if (!G.situacao(g, { ignorarContradicoes: camada === 'a-validar' }).podeConcluir) naoConclui++;
  }
  afirma(difere === 0, 'ida e volta: as respostas guiadas dão exatamente o mesmo P1–P16 nas 65.536 combinações', difere);
  afirma(naoConclui === 0, 'com a regra publicada (v7), toda combinação de P1–P16 tem um caminho guiado coerente que conclui', naoConclui);
  afirma(porCamada['produto-principal'] === 4 && porCamada['a-validar'] > 0, 'o motor oficial classifica a tradução (Produto/Serviço principal: 4 combinações, como na v7)', porCamada);

  /* P6/P7 complementares */
  const comP7 = Object.assign(RG.guiadaDe(RG.pDaMascara(0)), { P7: '?' });
  const s1 = G.situacao(comP7, { dispensaveis: ['P6', 'P7'] }), s2 = G.situacao(comP7, { dispensaveis: ['P6'] });
  afirma(s1.podeConcluir && s1.naoConfirmados.join() === 'P7' && !s1.indefinidos.length && G.criterios(comP7).P7 === '?', 'P7 "Não sei" dispensável: conclui, fica "não confirmado" e nunca vira NÃO');
  afirma(!s2.podeConcluir && s2.indefinidos.join() === 'P7', 'P7 exigido (regra que o lê): "Não sei" impede concluir');
  const comP8 = Object.assign(RG.guiadaDe(RG.pDaMascara(0)), { P8: '?' });
  afirma(!G.situacao(comP8, { dispensaveis: ['P6', 'P7'] }).podeConcluir, 'P8 "Não sei" sempre impede concluir (P8 é decisivo na regra publicada)');
  afirma(!/"campo":"P6"|"campo":"P7"/.test(JSON.stringify(V7)) && /"campo":"P8"/.test(JSON.stringify(V7)), 'a regra v7 não lê P6/P7 e lê P8');
}

/* ---------- semente e página ---------- */
const ANTIGA = 'pCapec';
function banco(o) {
  o = o || {};
  const db = SJ.semente();
  db['motor-arquitetura-config'] = clone(o.motor || CONFIG_MOTOR);
  /* a avaliação antiga (questionário antigo, sem guiada) com decisão manual registrada */
  if (o.admin) db['fa-admins'] = Object.assign({}, db['fa-admins'] || {}, { [SJ.chave(SJ.ARQ)]: { email: SJ.ARQ, name: 'ADMIN' } });
  Object.assign(db['avaliacoes-produto'][ANTIGA], { decisaoManual: true, decisaoConfirmada: true, justificativaDecisao: 'Decisão antiga (teste)', motorVersionArquitetura: 7 });
  return db;
}
let nAbrir = 0;
async function abrir(browser, vp, hash, o) {
  const ctx = await browser.newContext({ viewport: vp, acceptDownloads: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify({ db: banco(o), user: { email: SJ.ARQ, emailVerified: true, uid: 'u-guiada' }, prefixoChave: 'g' + (++nAbrir) + 'x', delayDefault: 10, persistenciaReal: true }) + ';');
  await ctx.addInitScript(`window.__pdfs = []; new MutationObserver(function (ms) { ms.forEach(function (m) { m.addedNodes.forEach(function (n) {
    if (n.nodeType !== 1 || n.parentNode !== document.body) return; var d = n.classList && n.classList.contains('pdf-doc') ? n : (n.querySelector && n.querySelector('.pdf-doc')); if (d) window.__pdfs.push(d.innerText); }); }); }).observe(document, { childList: true, subtree: true });`);
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  /* capturas (FA_PRINTS) com as fontes reais; no CI, sem rede de fontes */
  if (!process.env.FA_PRINTS) {
    await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.route('**fonts.gstatic.com**', (r) => r.abort());
  }
  await page.goto(BASE + '/index.html' + hash, { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
const dbReal = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal)));
const texto = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; }, sel);
const existe = (page, sel) => page.evaluate((s) => !!document.querySelector(s), sel);
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const passoAtual = (page) => page.evaluate(() => { const c = document.getElementById('avpGuiadaCartao'); return c ? c.getAttribute('data-passo') : (document.getElementById('avpGuiadaRevisao') ? 'revisao' : null); });
const foto = async (page, nome, sel) => { if (!process.env.FA_PRINTS) return; fs.mkdirSync(process.env.FA_PRINTS, { recursive: true });
  /* página inteira: o cabeçalho fixo se repetiria no meio da imagem — só na captura, ele fica no topo */
  const estilo = await page.addStyleTag({ content: '.nav { position: absolute !important; }' });
  const arq = path.join(process.env.FA_PRINTS, nome + '-' + page.viewportSize().width + '.png');
  if (sel) await page.locator(sel).first().screenshot({ path: arq }); else await page.screenshot({ path: arq, fullPage: true });
  await estilo.evaluate((e) => e.remove()); };
async function escolher(page, valor) {
  const p = await passoAtual(page);
  await page.check('input[name="avpGuiadaResp"][value="' + valor + '"]');
  await page.waitForFunction((v) => { const i = document.querySelector('#avpGuiadaCartao input[name="avpGuiadaResp"][value="' + v + '"]'); return !!(i && i.checked); }, valor);
  await page.click('#avpGuiadaContinuarBtn');
  await page.waitForFunction((x) => { const c = document.getElementById('avpGuiadaCartao'); return !c || c.getAttribute('data-passo') !== x; }, p);
}
const registroPorNome = async (page, nome) => { const d = (await dbReal(page))['avaliacoes-produto']; const k = Object.keys(d).find((x) => d[x].nome === nome); return k ? Object.assign({ _key: k }, d[k]) : null; };

async function jornada(browser, vp, rotulo) {
  console.log('\n######## B. ' + rotulo + ' ########');
  const NOME = 'Empréstimo guiado (' + rotulo + ')';
  /* P desejado: Produto/Serviço principal, com P7 "Não sei" */
  const P = RG.pDaMascara(0); ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P8'].forEach((c) => { P[c] = 'S'; }); P.P7 = '?';
  const alvo = RG.guiadaDe(P);
  let { ctx, page, erros } = await abrir(browser, vp, '#arquitetura?av=lista');
  await page.waitForSelector('#avpNovoBtn');
  await page.click('#avpNovoBtn');
  await page.fill('#avpfNome', NOME);
  await page.click('#avpIniciarBtn');
  await page.waitForSelector('#avpGuiadaCartao');
  afirma(/Pergunta 1 de 22/.test(await texto(page, '#avpGuiadaProgresso')) && await page.locator('#avpGuiadaAnteriorBtn').isDisabled(), 'iniciar: uma pergunta por vez, com progresso ("Pergunta 1 de 22") e sem "Anterior" na primeira');
  afirma(await page.locator('#avpGuiadaCartao .btn--primary').count() === 1 && await page.locator('.avp-guiada .btn--primary').count() === 1, 'uma só ação principal na tela (Continuar)');
  afirma(/Perguntas guiadas/.test(await texto(page, '#avpEtapas')), 'as etapas do caminho dizem "Perguntas guiadas"');
  await foto(page, 'g1-pergunta');
  await page.click('#avpGuiadaContinuarBtn');
  afirma(/Escolha uma resposta/.test(await texto(page, '.avp-error-msg')) && await passoAtual(page) === 'P1', 'Continuar sem responder: pede a resposta e não avança');
  await page.click('#avpGuiadaPorQueBtn');
  afirma(/Por que perguntamos/.test(await texto(page, '#avpGuiadaPorQue')) && /P1/.test(await texto(page, '#avpGuiadaPorQue')), 'a ajuda "?" diz por que perguntamos e qual critério a resposta alimenta');
  await escolher(page, 'S'); /* P1 */
  await escolher(page, 'S'); /* P2 → a confirmação C2 aparece */
  afirma(await passoAtual(page) === 'C2', 'condicional: P2 = Sim traz a confirmação da origem do resultado (C2)');
  await foto(page, 'g2-condicional');
  await page.click('#avpGuiadaAnteriorBtn');
  afirma(await passoAtual(page) === 'P2' && await page.locator('input[name="avpGuiadaResp"][value="S"]').isChecked(), 'Anterior volta à pergunta com a resposta dada');
  await page.click('#avpGuiadaContinuarBtn');
  await escolher(page, 'proprio'); /* C2 */
  await page.fill('#avpGuiadaObs', 'Observação de teste sobre P3');
  await escolher(page, 'S'); /* P3 */
  afirma(await passoAtual(page) === 'P4', 'a resposta avança para a próxima pergunta');

  /* INTERROMPER: salvar rascunho */
  await page.click('#avpSalvarRascunhoBtn');
  await page.waitForSelector('#avpNovoBtn');
  let reg = await registroPorNome(page, NOME);
  afirma(reg && reg.status === 'rascunho' && reg.guiada && reg.guiada.versao === 22 && reg.guiada.respostas.P1 === 'S' && reg.guiada.respostas.C2 === 'proprio',
    'interromper: o rascunho grava as respostas guiadas como escolhidas (versão 22)', reg && reg.guiada);
  afirma(reg.respostas.necessidade.valor === 'sim' && reg.respostas.resultado.valor === 'sim' && reg.respostas.solucao.observacao === 'Observação de teste sobre P3' && !reg.respostas.fronteira,
    'e só os critérios comprovados entram em P1–P16 (P1, P2, P3; P4 ainda não), com a observação');

  /* RETOMAR: pelo endereço do rascunho (o mesmo do link e do F5 — o banco falso volta à semente num recarregamento) */
  await page.evaluate((k) => { location.hash = '#arquitetura?editar=' + encodeURIComponent(k); }, reg._key);
  await page.waitForSelector('#avpGuiadaCartao');
  afirma(await passoAtual(page) === 'P4', 'retomar: o rascunho reabre na primeira pergunta sem resposta (P4)');
  await RG.responderGuiada(page, P);
  await page.waitForSelector('#avpGuiadaRevisao');
  await page.waitForSelector('#avpPrevia[data-camada]');
  afirma(await existe(page, '#avpPrevia[data-camada="produto-principal"]') && /nada foi gravado/.test(await texto(page, '#avpPrevia')), 'revisão: a prévia do motor oficial (Produto/Serviço principal), sem gravar');
  afirma(/P7/.test(await texto(page, '#avpGuiadaNaoConfirmados')) && /não confirmado/.test(await texto(page, '#avpGuiadaNaoConfirmados')), 'P7 "Não sei": avisa que fica "não confirmado" e não impede');
  afirma(!(await page.locator('#avpConcluirBtn').isDisabled()), 'Concluir disponível');
  afirma(await page.locator('.avp-guiada .btn--primary').count() === 1, 'na revisão a única ação principal é Concluir');
  await foto(page, 'g3-revisao');

  /* "Não sei" num critério decisivo (P8) → evidências insuficientes */
  await page.click('.avp-guiada-criterio[data-criterio="P8"] summary');
  await page.click('.avp-guiada-alterar[data-passo="P8"]');
  await escolher(page, '?');
  await page.waitForSelector('#avpGuiadaRevisao');
  afirma(/Evidências ainda insuficientes/.test(await texto(page, '#avpGuiadaPendencias')) && /P8/.test(await texto(page, '#avpGuiadaPendencias')) && await page.locator('#avpConcluirBtn').isDisabled() && !(await existe(page, '#avpPrevia')),
    'P8 "Não sei": "Evidências ainda insuficientes" com P8 indicado, sem prévia e Concluir desabilitado');
  await foto(page, 'g4-insuficiente');
  await page.click('.avp-guiada-criterio[data-criterio="P8"] .avp-guiada-alterar[data-passo="P8"]');
  await escolher(page, 'S');
  afirma(await passoAtual(page) === 'C8', 'voltar P8 para Sim traz de novo a confirmação (C8)');
  await escolher(page, 'entrega');
  await page.waitForSelector('#avpGuiadaRevisao');
  await RG.concluirGuiada(page);
  await page.waitForSelector('#avpCabecalhoFicha', { timeout: 30000 });
  reg = await registroPorNome(page, NOME);
  const mapa = G.criterios(reg.guiada.respostas);
  afirma(reg.status === 'concluido' && reg.camadaSugerida.id === camadaOficial(mapa) && reg.camadaSugerida.id === 'produto-principal' && reg.motorVersionArquitetura === 7,
    'concluir: a classificação gravada é a do motor oficial (v7) para o P1–P16 traduzido', reg.camadaSugerida && reg.camadaSugerida.id);
  afirma(JSON.stringify(reg.guiada.respostas) === JSON.stringify(Object.assign({}, alvo)) || G.CODIGOS.every((c) => mapa[c] === P[c]), 'as respostas guiadas ficam gravadas como foram escolhidas');
  afirma(!reg.respostas.medicao && reg.guiada.respostas.P7 === '?' && Object.keys(reg.respostas).length === 15, 'P7 "Não sei": nenhum SIM/NÃO inventado em P7 (15 critérios gravados), a resposta "Não sei" preservada');
  afirma(reg.decisaoFinal === reg.resultadoAutomatico && reg.decisaoManual === false, 'a decisão final nasce da recomendação (contrato de sempre)');
  const tx = (reg.guiada && reg.guiada.textos) || {};
  afirma(tx.C2 && tx.C2.pergunta === G.PERGUNTAS.C2.q && tx.C2.resposta === 'Do próprio item que estamos avaliando' && tx.C2.criterio === 'P2' && tx.C2.alternativas.length === 3 &&
    tx.C2.alternativas[1].rotulo === G.PERGUNTAS.C2.opts[1][1] && tx.C2.alternativas[1].descricao === G.PERGUNTAS.C2.opts[1][2],
    'C. a redação apresentada fica gravada na avaliação: pergunta, alternativas (com a descrição) e resposta escolhida', tx.C2);
  afirma(Object.keys(tx).length === G.passos(reg.guiada.respostas).length && Object.values(tx).every((x) => x.pergunta && x.resposta && x.ordem >= 1),
    'C. uma cópia por pergunta respondida do caminho, na ordem', Object.keys(tx).length);
  afirma(/NÃO CONFIRMADO/.test(await texto(page, '[data-criterio="P7"].avp-reasoning-item--nao-confirmado')), 'ficha: P7 aparece como "NÃO CONFIRMADO", por extenso');
  await page.click('#avpGuiadaFicha summary');
  afirma(/Respostas da avaliação guiada/.test(await texto(page, '#avpGuiadaFicha')) && /Do próprio item que estamos avaliando/.test(await texto(page, '#avpGuiadaFicha')), 'ficha: as respostas guiadas e de onde veio cada critério');
  afirma(await larguraOk(page), 'ficha sem rolagem lateral');
  await foto(page, 'g5-ficha');
  /* uma redação FUTURA diferente não altera a avaliação: troca a cópia gravada (simula o texto de outra época) e
     confere que ficha, PDF e Excel mostram a cópia, não o texto atual do módulo */
  const P1_DA_EPOCA = 'Redação da época, gravada nesta avaliação (teste)';
  await page.evaluate((x) => new Promise((ok) => firebase.database().ref('avaliacoes-produto/' + x[0] + '/guiada/textos/P1/pergunta').set(x[1], () => ok())), [reg._key, P1_DA_EPOCA]);
  await page.click('#avpVoltarListaResultado');
  await page.waitForSelector('#avpNovoBtn');
  await page.evaluate((k) => { location.hash = '#arquitetura?avp=' + encodeURIComponent(k); }, reg._key);
  await page.waitForSelector('#avpCabecalhoFicha');
  afirma(/NÃO CONFIRMADO/.test(await texto(page, '#avpQuestionarioCard')) && await existe(page, '#avpGuiadaFicha'), 'consultar de novo (lista → endereço da ficha): as respostas guiadas e o P7 não confirmado continuam lá');
  await page.click('#avpGuiadaFicha summary');
  await page.click('.avp-guiada-criterio[data-criterio="P1"] summary');
  const fichaGuiada = await texto(page, '#avpGuiadaFicha');
  afirma(fichaGuiada.includes(P1_DA_EPOCA) && !fichaGuiada.includes(G.PERGUNTAS.P1.q) && /gravado nela/.test(fichaGuiada), 'C. ficha: mostra a redação gravada na avaliação, não o texto atual');

  if (vp.width > 600) {
    await page.evaluate(() => { window.__pdfs = []; });
    await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#avpGerarPdfBtn')]);
    const pdf = (await page.evaluate(() => (window.__pdfs || []).join('\n'))).replace(/\s+/g, ' ');
    afirma(/7\. [^—]+— NÃO CONFIRMADO/.test(pdf), 'PDF: P7 "NÃO CONFIRMADO"');
    afirma(/Avaliação guiada — perguntas e respostas apresentadas/.test(pdf) && pdf.includes(P1_DA_EPOCA) && !pdf.includes(G.PERGUNTAS.P1.q) &&
      pdf.includes(G.PERGUNTAS.C2.q + ' — Do próprio item que estamos avaliando') && /Alternativas apresentadas: Do próprio item que estamos avaliando · De outra entrega/.test(pdf) &&
      /Critérios técnicos P1–P16/.test(pdf), 'C. PDF: perguntas guiadas com o texto gravado, alternativas e resposta, e depois os critérios técnicos P1–P16');
    await page.click('#avpVoltarListaResultado');
    await page.waitForSelector('#avpExportarBtn');
    await page.click('#avpExportarBtn');
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#avpExportarExcelTodas')]);
    const arq = arquivoTemporario('guiada-', '.xlsx'); await dl.saveAs(arq);
    const wb = XLSX.read(fs.readFileSync(arq), { type: 'buffer' }); fs.unlinkSync(arq);
    const aba = wb.SheetNames.find((n) => /Respostas/i.test(n));
    const linhas = XLSX.utils.sheet_to_json(wb.Sheets[aba], { defval: '' });
    const l7 = linhas.find((l) => l['ID da avaliação'] === reg._key && Number(l['Número da pergunta']) === 7);
    afirma(l7 && l7.Resposta === 'NÃO CONFIRMADO', 'Excel: P7 "NÃO CONFIRMADO" na aba de respostas', l7);
    afirma(JSON.stringify(wb.SheetNames) === JSON.stringify(['Resumo', 'Respostas do questionário', 'Histórico', 'Trilha', 'Respostas guiadas']), 'C. Excel: aba "Respostas guiadas" no fim; as abas de antes não mudam de lugar', wb.SheetNames);
    const gl = XLSX.utils.sheet_to_json(wb.Sheets['Respostas guiadas'], { defval: '' }).filter((l) => l['ID da avaliação'] === reg._key);
    const g1 = gl.find((l) => Number(l.Ordem) === 1), gC2 = gl.find((l) => l['Pergunta (texto apresentado)'] === G.PERGUNTAS.C2.q);
    afirma(gl.length === Object.keys(tx).length && g1 && g1['Pergunta (texto apresentado)'] === P1_DA_EPOCA && g1['Origem do texto'] === 'Registrado na avaliação' &&
      gC2 && gC2['Resposta escolhida'] === 'Do próprio item que estamos avaliando' && gC2['Critério técnico'] === 'P2' && /De outra entrega/.test(gC2['Alternativas apresentadas']),
      'C. Excel: uma linha por pergunta guiada, com o texto gravado, a resposta, as alternativas e o critério técnico', [gl.length, g1, gC2]);
  }
  afirma(!erros.length, 'sem erro de página', erros);
  await ctx.close();

  /* Voltar do navegador com resposta não salva pergunta antes */
  ({ ctx, page, erros } = await abrir(browser, vp, '#arquitetura?av=lista'));
  await page.waitForSelector('#avpNovoBtn');
  await page.click('#avpNovoBtn'); await page.fill('#avpfNome', 'Não salvo'); await page.click('#avpIniciarBtn');
  await page.waitForSelector('#avpGuiadaCartao');
  await escolher(page, 'S');
  await page.evaluate(() => history.back()); /* Voltar do navegador (navegação por hash: não há carga de página a esperar) */
  await esperarCondicao(page, () => !!document.querySelector('.modal-overlay:has(.avp-modal-confirm-btn) .modal-box'), null, { limite: 5000, descricao: 'a pergunta antes de descartar' });
  afirma(/Descartar alterações/.test(await texto(page, '.modal-overlay:has(.avp-modal-confirm-btn) .modal-box')), 'Voltar do navegador com resposta guiada não salva: pergunta antes de descartar');
  await ctx.close();

  /* REAVALIAR uma avaliação antiga com decisão manual */
  ({ ctx, page, erros } = await abrir(browser, vp, '#arquitetura?avp=' + ANTIGA));
  await page.waitForSelector('#avpReavaliarBtn');
  const antes = (await dbReal(page))['avaliacoes-produto'][ANTIGA];
  await page.click('#avpReavaliarBtn');
  await page.waitForSelector('.avp-modal-confirm-btn', { timeout: 5000 });
  afirma(/decisão manual/i.test(await texto(page, '.modal-overlay:has(.avp-modal-confirm-btn) .modal-box')), 'reavaliar com decisão manual: o aviso diz que ela fica na versão anterior');
  await page.click('.avp-modal-confirm-btn');
  await page.waitForSelector('#avpGuiadaCartao');
  afirma(await page.locator('input[name="avpGuiadaResp"]:checked').count() === 0 && /começa com as perguntas em branco/.test(await page.locator('#avpGuiadaDados').textContent()),
    'reavaliar a antiga: guiada, em branco, dizendo que as respostas antigas não são convertidas');
  const PR = RG.pDaMascara(0); ['P1', 'P9', 'P6', 'P7'].forEach((c) => { PR[c] = 'S'; });
  await RG.responderGuiada(page, PR);
  await RG.concluirGuiada(page);
  await page.waitForSelector('#avpCabecalhoFicha', { timeout: 30000 });
  const d = (await dbReal(page))['avaliacoes-produto'];
  const v2 = Object.values(d).find((x) => x.versaoAnteriorKey === ANTIGA);
  afirma(JSON.stringify(d[ANTIGA]) === JSON.stringify(antes), 'a versão anterior fica byte a byte igual (nada apagado nem convertido)');
  afirma(v2 && v2.guiada && v2.versao === (antes.versao || 1) + 1 && v2.decisaoManual === false && !v2.justificativaDecisao && v2.decisaoFinal === v2.resultadoAutomatico && v2.camadaSugerida.id === camadaOficial(PR),
    'a nova versão é guiada, classificada pelo motor oficial e sem herdar a decisão manual antiga', v2 && [v2.decisaoManual, v2.camadaSugerida && v2.camadaSugerida.id]);
  afirma(!erros.length, 'reavaliação sem erro de página', erros);
  await ctx.close();
}

async function avisoAdmin(browser, vp) {
  console.log('\n######## D. ADMIN › Questionários (' + vp.width + ' px) ########');
  const { ctx, page, erros } = await abrir(browser, vp, '#arquitetura?arq=questionarios&q=p1p16', { admin: true });
  await page.waitForSelector('#avpCfgCard-CLASSIFICACAO_ARQUITETURAL');
  const aviso = await texto(page, '#avpCfgAvisoGuiada');
  afirma(/Avaliação guiada/.test(aviso) && /não deste cadastro/.test(aviso) && /não muda nenhuma pergunta guiada/.test(aviso), 'D. o cartão de P1–P16 diz que o texto que o avaliador lê vem da avaliação guiada, não deste cadastro');
  if (process.env.FA_PRINTS) { /* recorte: do topo do cartão de P1–P16 até o fim do aviso (as correções abertas abaixo dele alongariam a imagem) */
    await page.locator('#avpCfgAvisoGuiada').scrollIntoViewIfNeeded();
    const c = await page.locator('#avpCfgCard-CLASSIFICACAO_ARQUITETURAL').boundingBox(), v = await page.locator('#avpCfgAvisoGuiada').boundingBox();
    await page.screenshot({ path: path.join(process.env.FA_PRINTS, 'g6-admin-questionarios-' + vp.width + '.png'), clip: { x: 0, y: c.y - 8, width: vp.width, height: v.y + v.height - c.y + 24 } });
  }
  await page.click('.avp-config-editar-btn[data-codigo="CLASSIFICACAO_ARQUITETURAL"]');
  await page.waitForSelector('#avpCfgAvisoGuiadaEditar');
  afirma(/texto TÉCNICO de P1–P16/.test(await texto(page, '#avpCfgAvisoGuiadaEditar')), 'D. o editor de P1–P16 repete o aviso antes das perguntas');
  afirma(await larguraOk(page), 'D. sem rolagem lateral');
  afirma(!erros.length, 'D. sem erro de página', erros);
  await ctx.close();
}

async function regraLeP6(browser) {
  console.log('\n######## B. regra publicada que lê P6 ########');
  const v8 = clone(V7);
  const fb = v8.find((r) => r.codigo === 'FALLBACK_A_VALIDAR');
  fb.condicoes = { any: [{ campo: 'P6', valor: 'SIM' }, { campo: 'P6', valor: 'NAO' }] };
  const motor = { versaoPublicada: 8, versoes: { 6: { regras: V6 }, 7: { regras: V7 }, 8: { regras: v8 } } };
  const { ctx, page, erros } = await abrir(browser, { width: 1280, height: 900 }, '#arquitetura?av=lista', { motor });
  await page.waitForSelector('#avpNovoBtn');
  await page.click('#avpNovoBtn'); await page.fill('#avpfNome', 'P6 lido pela regra'); await page.click('#avpIniciarBtn');
  const P = RG.pDaMascara(0); P.P1 = 'S'; P.P6 = '?';
  await RG.responderGuiada(page, P);
  await page.waitForSelector('#avpGuiadaPendencias');
  afirma(/P6/.test(await texto(page, '#avpGuiadaPendencias')) && await page.locator('#avpConcluirBtn').isDisabled(), 'se a regra publicada lê P6, "Não sei" em P6 volta a impedir a conclusão (nunca vira NÃO para o motor)');
  afirma(!erros.length, 'sem erro de página', erros);
  await ctx.close();
}

(async () => {
  parteA();
  const browser = await chromium.launch();
  try {
    await jornada(browser, { width: 1280, height: 900 }, 'computador');
    await jornada(browser, { width: 375, height: 800 }, 'celular 375px');
    await regraLeP6(browser);
    await avisoAdmin(browser, { width: 1280, height: 900 });
    await avisoAdmin(browser, { width: 375, height: 800 });
  } catch (e) { afirma(false, 'exceção: ' + String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')); }
  await browser.close();
  console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
  process.exit(falhas ? 1 : 0);
})();
