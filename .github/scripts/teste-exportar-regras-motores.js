/* EXPORTAR AS REGRAS DOS MOTORES EM PDF — exportacao-motores.js e os botões dos três cartões de motor.
 * Parte 1 (Node, módulo puro): condições aninhadas (todas / pelo menos uma / pelo menos N / NÃO) viram frases; os campos
 *   usados são achados; os itens de lógica de "Como decide" são filtrados; texto é escapado; nome do arquivo seguro.
 * Parte 2 (navegador, Firebase falso em persistência real, computador e 375 px): em Gestão da Floresta › Motores, o
 *   Motor Arquitetural (P1–P16), o de Posicionamento (O1–O9) e o de Squad (S1–S8) geram cada um um PDF cujo conteúdo é
 *   conferido contra os DADOS da própria página — todas as regras, na ordem de precedência; o texto vigente das
 *   perguntas; a versão em vigor; as perguntas que não entram em regra nenhuma; a tabela Linha × Squad — e nada é gravado. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const { semente, chave } = require('./semente-jornada');
const X = require(path.join(__dirname, '..', '..', 'forca-agil', 'exportacao-motores.js'));

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const ADM = 'admin.geral@previ.com.br';
let falhas = 0, total = 0;
function afirma(c, msg, det) { total++; console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + (typeof det === 'string' ? det : JSON.stringify(det)) : '')); if (!c) falhas++; }

function parte1() {
  console.log('== 1. Módulo puro ==');
  const cfg = { rotuloCampo: (c) => c + ' — Título', rotuloValor: (c, v) => (v === 'NAO' ? 'NÃO' : v) };
  const cond = { all: [{ campo: 'P5', valor: 'SIM' }, { atLeast: 1, of: [{ campo: 'P13', valor: 'SIM' }, { campo: 'P16', valor: 'SIM' }] }, { not: { any: [{ campo: 'P9', valor: 'NAO' }] } }] };
  const h = X.condicaoHtml(cond, cfg);
  afirma(/^todas estas condições:/.test(h) && /pelo menos 1 destas:/.test(h) && /NÃO acontecer o seguinte: pelo menos uma destas:/.test(h) && /<strong>P9 — Título<\/strong> = NÃO/.test(h), 'condições aninhadas viram frases (todas / pelo menos N / NÃO / pelo menos uma)', h);
  afirma(X.camposDe(cond).join() === 'P5,P13,P16,P9', 'campos usados por uma regra', X.camposDe(cond).join());
  const itens = '<li><strong>Precedência:</strong> a</li><li><strong>O que você pode mudar aqui:</strong> b</li><li><strong>Fallback ("A validar"):</strong> c</li>';
  afirma(X.itensDeLogica(itens, ['Precedência', 'Fallback']) === '<li><strong>Precedência:</strong> a</li><li><strong>Fallback ("A validar"):</strong> c</li>', 'só os itens de lógica de "Como decide" (o que é sobre editar fica de fora)');
  const at = X.atomos({ titulo: 'T', metadados: [['Versão', '<b>7</b>']], perguntas: [{ codigo: 'P1', titulo: 'A & B', texto: '<script>x</script>' }],
    secoes: [{ titulo: 'Regras', regras: [{ ordem: 1, codigo: 'R1', resultado: 'Canal', condicao: { campo: 'P9', valor: 'SIM' } }, { ordem: 2, codigo: 'FB', resultado: 'A validar', fallback: true }] }], rotuloCampo: (c) => c });
  const tudo = at.join('');
  afirma(!/<script>/.test(tudo) && /&lt;script&gt;/.test(tudo) && /&lt;b&gt;7&lt;\/b&gt;/.test(tudo), 'texto vindo de dados é escapado (nada de HTML injetado no PDF)');
  afirma(/Sempre que nenhuma regra anterior se aplicar/.test(tudo) && tudo.indexOf('[R1]') < tudo.indexOf('[FB]'), 'fallback descrito e regras na ordem recebida');
  afirma(X.nomeArquivo({ slug: 'Motor Arquitetural v7 / ç' }, '2026-10-20T10:00:00Z') === 'Regras_Motor_Arquitetural_v7_c_2026-10-20.pdf', 'nome de arquivo seguro, com a data', X.nomeArquivo({ slug: 'Motor Arquitetural v7 / ç' }, '2026-10-20T10:00:00Z'));
}

async function abrir(browser, viewport, hash) {
  const db = semente();
  db['fa-admins'] = Object.assign({}, db['fa-admins'] || {}, { [chave(ADM)]: true });
  db['fa-users'][chave(ADM)] = { name: 'Admin', email: ADM, area: 'INFOR' };
  const cfg = { db, user: { email: ADM, emailVerified: true, uid: 'u-' + chave(ADM) }, delayDefault: 10, persistenciaReal: true };
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await ctx.addInitScript(`window.__pdfs = []; new MutationObserver(function (ms) { ms.forEach(function (m) { m.addedNodes.forEach(function (n) {
    if (n.nodeType !== 1 || n.parentNode !== document.body) return; var d = n.classList && n.classList.contains('pdf-doc') ? n : (n.querySelector && n.querySelector('.pdf-doc')); if (d) window.__pdfs.push(d.innerText); }); }); }).observe(document, { childList: true, subtree: true });`);
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + hash, { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
const ate = (page, fn, arg, desc) => esperarCondicao(page, fn, arg === undefined ? null : arg, { limite: 20000, descricao: desc });
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const escritas = (page) => page.evaluate(() => (window.__ESCRITAS || []).length);
async function gerar(page, sel) {
  await page.waitForSelector(sel + ':not([disabled])');
  await page.evaluate(() => { window.__pdfs = []; });
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click(sel)]);
  if (process.env.FA_PDFS) { fs.mkdirSync(process.env.FA_PDFS, { recursive: true }); await dl.saveAs(path.join(process.env.FA_PDFS, dl.suggestedFilename())); } /* exemplos para conferir à mão */
  return { nome: dl.suggestedFilename(), texto: (await page.evaluate(() => (window.__pdfs || []).join('\n'))).replace(/\s+/g, ' ') };
}
/* as regras aparecem na mesma ordem (cada código depois do anterior) */
const emOrdem = (texto, codigos) => { let pos = -1; for (const c of codigos) { const i = texto.indexOf('[' + c + ']', pos + 1); if (i < 0) return c; pos = i; } return null; };

async function parte2(browser, viewport, rotulo) {
  console.log('\n== 2. ' + rotulo + ' ==');
  /* Motor Arquitetural */
  let { ctx, page, erros } = await abrir(browser, viewport, '#arquitetura?arq=motores');
  await page.waitForSelector('#avpMotorArqPdfBtn');
  afirma(await larguraOk(page), 'Motores: botão "Exportar regras (PDF)" sem rolagem lateral');
  const dadosP = await page.evaluate(() => {
    const M = window.faMotorArquitetura, v = M.versaoAtual(), rr = M.regrasDaVersao(v), regras = ((rr && rr.regras) || rr).slice().sort((a, b) => a.ordem - b.ordem);
    const usados = []; regras.forEach((r) => window.faExportacaoMotores.camposDe(r.condicoes, usados));
    return { v, codigos: regras.map((r) => r.codigo), naoUsadas: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'P11', 'P12', 'P13', 'P14', 'P15', 'P16'].filter((c) => usados.indexOf(c) === -1),
      p5: window.faQuestionarios.conteudoPergunta('CLASSIFICACAO_ARQUITETURAL', 'P5').texto };
  });
  let antes = await escritas(page);
  let pdf = await gerar(page, '#avpMotorArqPdfBtn');
  afirma(/Motor de Classificação Arquitetural \(P1–P16\)/.test(pdf.texto) && pdf.texto.indexOf('v' + dadosP.v) !== -1 && /^Regras_Motor_Arquitetural_v\d+_\d{4}-\d\d-\d\d\.pdf$/.test(pdf.nome), 'P1–P16: título, versão em vigor e nome do arquivo', pdf.nome);
  afirma(emOrdem(pdf.texto, dadosP.codigos) === null, 'P1–P16: todas as ' + dadosP.codigos.length + ' regras, na ordem de precedência', emOrdem(pdf.texto, dadosP.codigos));
  afirma(pdf.texto.indexOf(dadosP.p5.replace(/\s+/g, ' ')) !== -1 && /Como este motor decide/.test(pdf.texto) && /Precedência/.test(pdf.texto) && !/O que você pode mudar aqui/.test(pdf.texto), 'P1–P16: texto vigente das perguntas e só os itens de lógica de "Como decide"');
  afirma(!dadosP.naoUsadas.length || dadosP.naoUsadas.every((c) => new RegExp('não entram em nenhuma condição[^.]*' + c).test(pdf.texto)), 'P1–P16: as perguntas que não entram em regra nenhuma (' + dadosP.naoUsadas.join(', ') + ') são apontadas');
  afirma(/todas estas condições:/.test(pdf.texto) && /Sempre que nenhuma regra anterior se aplicar/.test(pdf.texto), 'P1–P16: condições por extenso e o fallback');
  await ate(page, () => /PDF das regras gerado/.test((document.getElementById('avpMotorRegrasStatus') || {}).textContent || ''), undefined, 'status');
  afirma(await escritas(page) === antes, 'P1–P16: nada foi gravado');
  /* Motor de Posicionamento */
  await page.evaluate(() => { location.hash = '#arquitetura?arq=motores&m=o'; });
  await page.waitForSelector('#avpMotorPosPdfBtn:not([disabled])');
  const dadosO = await page.evaluate(() => { const N = window.faMotorPosicionamentoNucleo; return { regras: N.definicao(1).regras, firmes: N.CODIGOS_FIRMES.length }; });
  antes = await escritas(page);
  pdf = await gerar(page, '#avpMotorPosPdfBtn');
  const frases = Object.keys(dadosO.regras).filter((k) => !/^DEF_/.test(k)).map((k) => dadosO.regras[k].replace(/\s+/g, ' '));
  afirma(/Motor de Posicionamento Organizacional \(O1–O9\)/.test(pdf.texto) && /Versão do motor em vigor v1/.test(pdf.texto), 'O1–O9: título e versão em vigor');
  afirma(frases.every((f) => pdf.texto.indexOf(f) !== -1), 'O1–O9: todas as ' + frases.length + ' regras da definição, com a frase da própria definição', frases.filter((f) => pdf.texto.indexOf(f) === -1));
  afirma(/Nível 1/.test(pdf.texto) && /Nível 2/.test(pdf.texto) && /Nível 3/.test(pdf.texto) && /Adequação à Squad \(regra fixa/.test(pdf.texto), 'O1–O9: os três níveis e a regra fixa Linha × Squad');
  afirma(await escritas(page) === antes && !erros.length, 'O1–O9: nada gravado, sem erro de página', erros);
  await ctx.close();

  /* Motor de Squad */
  ({ ctx, page, erros } = await abrir(browser, viewport, '#arquitetura?arq=motor-squad'));
  await page.waitForSelector('#sqMotorRegrasPdfBtn');
  afirma(await larguraOk(page), 'Motor de Squad: botão sem rolagem lateral');
  const dadosS = await page.evaluate(() => { const M = window.faMotorSquad, r = M.regrasDaVersao(M.versaoAtual()); return { v: M.versaoAtual(), codigos: ['eixoA', 'eixoB', 'combinacao'].flatMap((k) => r[k].slice().sort((a, b) => a.ordem - b.ordem).map((x) => x.codigo)), rot: M.textosAtuais().FORTE_ADERENCIA_SQUAD_DEDICADA.rotulo }; });
  antes = await escritas(page);
  pdf = await gerar(page, '#sqMotorRegrasPdfBtn');
  afirma(/Motor de Adequação à Squad \(S1–S8\)/.test(pdf.texto) && /Eixo A/.test(pdf.texto) && /Eixo B/.test(pdf.texto) && /Combinação dos dois eixos/.test(pdf.texto), 'S1–S8: título e as três seções (Eixo A, Eixo B, Combinação)');
  afirma(emOrdem(pdf.texto, dadosS.codigos) === null && pdf.texto.indexOf(dadosS.rot) !== -1, 'S1–S8: todas as ' + dadosS.codigos.length + ' regras na ordem, com o rótulo de cada veredito', emOrdem(pdf.texto, dadosS.codigos));
  afirma(/Eixo A — Necessidade de capacidade dedicada<?\/?[^=]*= Demonstrada/.test(pdf.texto) || /Necessidade de capacidade dedicada = Demonstrada/.test(pdf.texto), 'S1–S8: a combinação lê os resultados dos eixos pelo rótulo (não S1–S8 direto)');
  afirma(await escritas(page) === antes && !erros.length, 'S1–S8: nada gravado, sem erro de página', erros);
  await ctx.close();
}

(async () => {
  parte1();
  const browser = await chromium.launch();
  await parte2(browser, { width: 1280, height: 900 }, 'COMPUTADOR (1280 px)');
  await parte2(browser, { width: 375, height: 740 }, 'CELULAR (375 px)');
  await browser.close();
  console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
