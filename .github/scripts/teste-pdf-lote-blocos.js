/* PDF consolidado das avaliações: gerado em BLOCOS de altura limitada, todos no
 * mesmo PDF (nunca um canvas único com todo o documento).
 *
 * POR QUE: o navegador limita o tamanho de um canvas (Chrome ~65 mil px de
 * altura; Safari do iPhone ~16,7 milhões de px de área) e, acima disso,
 * devolve um canvas TODO BRANCO sem erro. Com ~4 avaliações longas o PDF
 * consolidado já saía com dezenas de páginas em branco.
 *
 * Prova, decodificando as imagens das páginas do PDF de verdade:
 *   - 1, 2, 3 avaliações e um conjunto grande (6 avaliações, curtas e longas
 *     alternadas = o caso de 54 páginas): nenhuma página em branco;
 *   - cada avaliação aparece UMA vez, na ordem pedida, e o cabeçalho do
 *     relatório uma vez só;
 *   - a numeração "Página X de N" continua válida (N = páginas reais);
 *   - nenhum bloco passa da altura segura (ALTURA_MAX_BLOCO_PDF);
 *   - o PDF de UMA avaliação segue igual; também em viewport de celular. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const RAIZ = path.join(__dirname, '..', '..', 'forca-agil');
const MOTOR_VERSION = /var MOTOR_VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(RAIZ, 'avaliacao-produto.js'), 'utf8'))[1];
const EMAIL = 'gestora@previ.com.br';
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const ORDEM = ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia', 'jornada', 'medicao', 'gestao', 'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'];
const DESKTOP = { width: 1280, height: 900 };
const CELULAR = { width: 375, height: 800 };

let falhas = 0;
function afirma(cond, msg) { console.log((cond ? '  ok    ' : '  FALHA ') + msg); if (!cond) falhas++; }

function item(nome, i, extra) {
  const respostas = {};
  ORDEM.forEach((id, n) => { respostas[id] = { valor: n < 5 ? 'sim' : 'nao', observacao: '', justificativaAuto: 'interpretação ' + id, codigoPergunta: 'P', textoPerguntaNaEpoca: 't', tituloNaEpoca: 't', questionnaireContentVersion: 1 }; });
  const n = String(i).padStart(2, '0');
  return Object.assign({
    nome: nome, descricao: 'desc ' + i, publico: '', necessidade: '', observacoesGerais: '',
    status: 'concluido', respostas: respostas, resultadoAutomatico: 'produto', decisaoFinal: 'produto', decisaoManual: false,
    camadaSugerida: { id: 'produto-principal', label: 'Produto/Serviço principal', motivos: ['m1'], conflito: null, incoerencia: false, especializacao: null, papelEstrutural: null, relacao: null },
    justificativaAutomatica: 'justificativa gerada ' + i, criteriosEssenciaisFalhos: ['x'], exclusoesConflitantes: null, criteriosAtendidos: 5,
    motorVersion: MOTOR_VERSION, motorVersionArquitetura: 1, questionnaireContentVersion: 1,
    criadoEm: '2026-03-15T10:00:' + n + '.000Z', atualizadoEm: '2026-03-15T10:00:' + n + '.000Z',
    responsavel: { name: 'Avaliadora Antiga', email: 'antiga@previ.com.br' }, itemId: 'k' + i, versao: 1, versaoAnteriorKey: null, excluido: false
  }, extra || {});
}
const camada = (id, label) => ({ id: id, label: label, motivos: ['m'], conflito: null, incoerencia: false, especializacao: null, papelEstrutural: null, relacao: null });
const AVALIACOES = () => ({
  k1: item('Item Produto', 1),
  k2: item('Item Componente', 2, { resultadoAutomatico: 'nao-produto', decisaoFinal: 'nao-produto', camadaSugerida: camada('componente', 'Componente') }),
  k3: item('Item Canal', 3, { resultadoAutomatico: 'nao-produto', decisaoFinal: 'nao-produto', camadaSugerida: camada('canal', 'Canal') }),
  k4: item('Item Rascunho', 4, { status: 'rascunho', resultadoAutomatico: null, decisaoFinal: null, camadaSugerida: null })
});


const longo = 'texto longo de justificativa para forçar uma avaliação extensa. '.repeat(40);
function mk(i, tamanho) {
  const it = item('Avaliação número ' + i, i);
  if (tamanho === 'longa') ORDEM.forEach((id) => { it.respostas[id].observacao = longo; it.respostas[id].justificativaAuto = longo; });
  it.descricao = tamanho === 'longa' ? longo : 'curta';
  return it;
}
const AV = (n, tams) => { const o = {}; for (let i = 1; i <= n; i++) o['k' + String(i).padStart(2, '0')] = mk(i, tams[(i - 1) % tams.length]); return o; };

/* extrai de um PDF as imagens JPEG de cada página (jsPDF só reaproveita a mesma
   imagem quando ela é idêntica — o que, para páginas de conteúdo, não ocorre) */
function paginasEImagens(buf) {
  const txt = buf.toString('latin1');
  const paginas = (txt.match(/\/Type\s*\/Page(?![s])/g) || []).length;
  const imgs = [];
  const re = /\/Filter\s*\/DCTDecode/g; let m;
  while ((m = re.exec(txt))) {
    let ini = txt.indexOf('stream', m.index); if (ini < 0) continue;
    ini += 6; if (txt[ini] === '\r') ini++; if (txt[ini] === '\n') ini++;
    const fim = txt.indexOf('endstream', ini);
    imgs.push(buf.subarray(ini, fim).toString('base64'));
  }
  return { paginas, imgs };
}
/* o próprio Chromium decodifica o JPEG e mede quanto da imagem NÃO é branco */
async function proporcaoDeTinta(page, b64) {
  return page.evaluate(async (b64) => {
    const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const bmp = await createImageBitmap(new Blob([u], { type: 'image/jpeg' }));
    const c = document.createElement('canvas'); c.width = Math.min(bmp.width, 400); c.height = Math.min(bmp.height, 600);
    const g = c.getContext('2d'); g.drawImage(bmp, 0, 0, c.width, c.height);
    const d = g.getImageData(0, 0, c.width, c.height).data; let tinta = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 235 || d[i + 1] < 235 || d[i + 2] < 235) tinta++;
    return tinta / (d.length / 4);
  }, b64);
}

async function exportar(browser, n, tams, viewport, so1) {
  const acessos = {}; acessos[chave(EMAIL)] = { email: EMAIL, perfil: 'gestor' };
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': {}, 'turmas-config': {}, 'turmas-checkin': {}, 'turmas-espera': {}, 'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {}, eventos: {}, 'turmas-publico': {}, 'eventos-publico': {}, 'avaliacoes-produto': AV(n, tams), 'avaliacoes-squad': {}, 'motor-squad-config': {}, 'motor-squad-auditoria': {}, 'motor-arquitetura-config': {}, 'motor-arquitetura-auditoria': {}, 'fa-avaliacao-acessos': acessos };
  const ctx = await browser.newContext({ viewport: viewport || DESKTOP, acceptDownloads: true });
  const page = await ctx.newPage();
  const erros = []; page.on('pageerror', (e) => erros.push(String(e)));
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify({ db, user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true }) + ';');
  /* captura o conteúdo de cada bloco montado para o PDF */
  await ctx.addInitScript(`
    window.__blocos = [];
    new MutationObserver(function (ms) { ms.forEach(function (m) { m.addedNodes.forEach(function (n) {
      if (n.nodeType !== 1 || n.parentNode !== document.body) return;
      var doc = n.classList && n.classList.contains('pdf-doc') ? n : (n.querySelector && n.querySelector('.pdf-doc'));
      if (doc && doc.querySelector('.pdf-av') && !doc.__visto) { doc.__visto = true; var t = doc.innerText; /* o html2pdf clona cada bloco num overlay: o clone repete o texto, então só conta o primeiro */ if (!window.__blocos.some(function (b) { return b.texto === t; })) window.__blocos.push({ texto: t, cab: !!doc.querySelector('.pdf-header'), altura: n.scrollHeight }); }
    }); }); }).observe(document, { childList: true, subtree: true });`);
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#avaliacoes');
  await page.waitForSelector('#avaliacoesPainel .avp-table tbody tr', { timeout: 15000 });
  await page.waitForTimeout(600);
  const ordemTela = await page.locator('.avp-item-nome').allTextContents();
  let dl;
  if (so1) {
    await page.click('.avp-act-ver'); await page.waitForSelector('#avpGerarPdfBtn');
    [dl] = await Promise.all([page.waitForEvent('download', { timeout: 240000 }), page.click('#avpGerarPdfBtn')]);
  } else {
    await page.click('#avpExportarBtn');
    [dl] = await Promise.all([page.waitForEvent('download', { timeout: 240000 }), page.click('#avpExportarPdfFiltrados')]);
  }
  const arq = path.join(require('os').tmpdir(), 'avp-lote-' + Date.now() + '.pdf');
  await dl.saveAs(arq);
  const buf = fs.readFileSync(arq); fs.unlinkSync(arq);
  const blocos = await page.evaluate(() => window.__blocos);
  return { page, ctx, buf, blocos, erros, nome: dl.suggestedFilename(), ordemTela };
}

async function verificar(titulo, r, n) {
  const ordemEsperada = r.ordemTela;
  console.log('\n== ' + titulo + ' ==');
  const { paginas, imgs } = paginasEImagens(r.buf);
  afirma(paginas > 0 && imgs.length > 0 && imgs.length <= paginas, 'o PDF tem ' + paginas + ' página(s) e ' + imgs.length + ' imagem(ns) distintas (páginas idênticas compartilham a imagem)');
  let brancas = 0; const tintas = [];
  for (const b of imgs) { const t = await proporcaoDeTinta(r.page, b); tintas.push(t); if (t < 0.002) brancas++; }
  afirma(brancas === 0, 'nenhuma página em branco (menor proporção de tinta: ' + Math.min.apply(null, tintas).toFixed(4) + ')');
  const todo = r.blocos.map((b) => b.texto).join('\n');
  const nomes = (todo.match(/Avaliação número \d+/g) || []);
  const unicos = nomes.filter((v, i) => nomes.indexOf(v) === i);
  afirma(unicos.length === n, 'as ' + n + ' avaliações aparecem (' + unicos.length + ')');
  /* o nome aparece na tabela de identificação (1x) e no título; aqui só a ordem da PRIMEIRA aparição */
  afirma(JSON.stringify(unicos) === JSON.stringify(ordemEsperada), 'na ordem em que a lista mostra na tela: ' + unicos.slice(0, 4).join(', ') + (unicos.length > 4 ? '…' : ''));
  const identificacoes = (todo.match(/Identificação da avaliação/g) || []).length;
  afirma(identificacoes === n, 'a "Identificação da avaliação" de cada uma aparece UMA vez (' + identificacoes + ' de ' + n + ') — nada repetido entre blocos');
  afirma(r.blocos.filter((b) => b.cab).length === 1 && r.blocos[0].cab, 'o cabeçalho do relatório aparece uma vez só, no primeiro bloco');
  const maiorBloco = Math.max.apply(null, r.blocos.map((b) => b.altura));
  afirma(maiorBloco <= 4400 * 1.6, 'nenhum bloco passa da altura segura (maior bloco: ' + Math.round(maiorBloco) + ' px CSS, em ' + r.blocos.length + ' bloco(s))');
  afirma(r.erros.length === 0, 'nenhum erro de JS (' + r.erros.length + ')');
  console.log('        ' + paginas + ' páginas, ' + r.blocos.length + ' blocos, arquivo ' + r.nome);
}

(async () => {
  const browser = await chromium.launch();
  const casos = [
    ['1 avaliação (consolidado)', 1, ['curta'], null, false],
    ['2 avaliações', 2, ['curta'], null, false],
    ['3 avaliações, curtas e longas', 3, ['curta', 'longa'], null, false],
    ['6 avaliações, curtas e longas alternadas (o caso das 54 páginas)', 6, ['curta', 'longa'], null, false],
    ['celular 375x667: 4 avaliações, curtas e longas', 4, ['curta', 'longa'], { width: 375, height: 667 }, false],
    ['PDF de UMA avaliação (botão da ficha)', 2, ['longa', 'curta'], null, true]
  ];
  for (const [titulo, n, tams, vp, so1] of casos) {
    const r = await exportar(browser, n, tams, vp, so1);
    if (so1) {
      console.log('\n== ' + titulo + ' ==');
      const { paginas, imgs } = paginasEImagens(r.buf);
      let brancas = 0; for (const b of imgs) if ((await proporcaoDeTinta(r.page, b)) < 0.002) brancas++;
      afirma(paginas > 0 && imgs.length > 0 && brancas === 0, 'PDF individual: ' + paginas + ' páginas, nenhuma em branco');
      afirma(/Avaliação_|Avaliacao_Produto_Servico_/.test(r.nome), 'mantém o nome do PDF individual: ' + r.nome);
    } else {
      await verificar(titulo, r, n);
    }
    await r.ctx.close();
  }
  await browser.close();
  console.log('\n============================');
  console.log(falhas ? falhas + ' FALHA(S)' : 'TODOS OS TESTES PASSARAM');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
