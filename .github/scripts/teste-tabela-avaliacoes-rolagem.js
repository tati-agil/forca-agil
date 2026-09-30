/* Lista de avaliações (Admin → Arquitetura): o quadro da tabela rola sozinho e
 * mantém à vista o cabeçalho, o Item (com a caixa de seleção) e as Ações.
 *
 * POR QUE ESTE TESTE EXISTE
 * A tabela tem muitas colunas e muitas linhas. Com a página inteira rolando:
 * ao descer, o cabeçalho das colunas sumia; ao ir para a direita, o nome do
 * item sumia (não dava para saber de quem eram os valores); e a barra de
 * rolagem horizontal só aparecia no fim da tabela. Agora o quadro da tabela
 * tem rolagem própria (vertical e horizontal), com <thead> sticky no topo,
 * Item + caixa à esquerda e Ações à direita, todos com fundo opaco.
 *
 * O que prova (1920x1080, 1600x900, 1366x768 — cenários A-D do pedido):
 *   A. rolar até a última linha: o cabeçalho continua visível e o Item identificável;
 *   B. rolar até a direita: o Item continua à esquerda e as Ações à direita, clicáveis;
 *   C. rolar nos dois eixos: nenhuma célula passa POR CIMA das colunas fixas
 *      (elementFromPoint em cada ponto crítico devolve a célula certa) e todas
 *      as fixas têm fundo opaco;
 *   D. o documento não ganhou rolagem horizontal por causa da tabela;
 *   + a barra de rolagem horizontal fica dentro da janela (o quadro termina nela);
 *   + marcar uma linha (que refaz o HTML) NÃO joga a tabela de volta ao topo;
 *   + a lixeira usa o mesmo quadro (Item fixo à esquerda);
 *   + nada de dados/ações mudou: mesmas 30 linhas, mesmos botões, nenhuma gravação;
 *   + 768 px mantém as colunas fixas; 375 px (celular) continua em cartões,
 *     sem rolagem horizontal da página.
 * Hermético: sem rede, sem segredo. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const EMAIL = 'teste@previ.com.br';
const KEY = EMAIL.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

let falhas = 0;
function afirma(cond, msg) { console.log((cond ? '  ok    ' : '  FALHA ') + msg); if (!cond) falhas++; }

const NOMES = ['Previ Futuro', 'Perfil de Investimento — Previ Futuro', 'Portabilidade (entrada)', 'Portabilidade (saída)',
  'Escolha e Alteração de Perfil de Investimento — plano de contribuição definida com aporte adicional e complementar'];
function item(i, extra) {
  const respostas = {};
  ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia'].forEach((id) => { respostas[id] = { valor: 'sim', justificativaAuto: 'SIM ' + id, observacao: '' }; });
  ['jornada', 'medicao', 'gestao', 'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'].forEach((id) => { respostas[id] = { valor: 'nao', justificativaAuto: 'NÃO ' + id, observacao: '' }; });
  const n = String(i).padStart(2, '0');
  return Object.assign({
    nome: (i <= NOMES.length ? NOMES[i - 1] : 'Item de teste ' + i), descricao: '', publico: '', necessidade: '', observacoesGerais: '',
    status: 'concluido', respostas: respostas,
    resultadoAutomatico: 'produto', decisaoFinal: 'produto', decisaoManual: false,
    camadaSugerida: { id: 'produto-principal', label: i % 3 === 0 ? 'Unidade de valor associada ao produto/serviço principal' : 'Produto/Serviço principal', motivos: ['m'] },
    justificativaAutomatica: 'texto ' + i, criteriosAtendidos: 5, motorVersion: '2026.08.01-1',
    criadoEm: '2026-08-01T10:00:' + n + '.000Z', atualizadoEm: '2026-08-01T10:00:' + n + '.000Z',
    responsavel: { name: 'Responsável de Teste ' + i, email: EMAIL }, versao: 1, excluido: false
  }, extra || {});
}
function base(n, excluidas) {
  const o = {};
  for (let i = 1; i <= n; i++) o['it' + String(i).padStart(2, '0')] = item(i, i % 7 === 0 ? { status: 'rascunho' } : null);
  for (let j = 1; j <= (excluidas || 0); j++) {
    o['ex' + j] = item(100 + j, { excluido: true, excluidoPor: { name: 'Admin' }, excluidoEm: '2026-09-01T10:00:00.000Z', justificativaExclusao: 'duplicada de outra avaliação já registrada' });
  }
  return o;
}

async function abrirApp(browser, avaliacoes, viewport) {
  const admins = {}; admins[KEY] = { email: EMAIL };
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': admins, 'turmas-config': {},
    'turmas-checkin': {}, 'turmas-espera': {}, 'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {},
    eventos: {}, 'turmas-publico': {}, 'eventos-publico': {}, 'avaliacoes-produto': avaliacoes, 'avaliacoes-squad': {},
    'motor-squad-config': {}, 'motor-squad-auditoria': {}, 'motor-arquitetura-config': {}, 'motor-arquitetura-auditoria': {} };
  const cfg = { db: db, user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true };
  const ctx = await browser.newContext({ viewport: viewport });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.body.classList.contains('aguardando-auth'), { timeout: 16000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.click('.admin-tab-btn[data-panel="adminPanelArquitetura"]');
  await page.waitForSelector('.avp-tabela-scroll', { timeout: 8000 });
  await page.waitForTimeout(400);
  return { ctx, page, erros };
}

/* traz o quadro da tabela para a área visível da página (como a pessoa faria
   rolando até ele) e espera a altura se ajustar */
async function focarTabela(page) {
  await page.evaluate(() => {
    const el = document.querySelector('.avp-tabela-scroll');
    const nav = document.querySelector('.nav');
    const navH = (nav ? nav.offsetHeight : 64) + 8;
    window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - navH, behavior: 'instant' });
  });
  await page.waitForTimeout(250);
}
const geom = (page) => page.evaluate(() => {
  const el = document.querySelector('.avp-tabela-scroll');
  const r = el.getBoundingClientRect();
  return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, sh: el.scrollHeight, ch: el.clientHeight, sw: el.scrollWidth, cw: el.clientWidth,
    st: el.scrollTop, sl: el.scrollLeft, ih: window.innerHeight, iw: window.innerWidth, overflowY: getComputedStyle(el).overflowY, overflowX: getComputedStyle(el).overflowX };
});
const rolar = (page, top, left) => page.evaluate(([t, l]) => {
  const el = document.querySelector('.avp-tabela-scroll');
  el.scrollTop = t === 'fim' ? el.scrollHeight : t; el.scrollLeft = l === 'fim' ? el.scrollWidth : l;
}, [top, left]).then(() => page.waitForTimeout(120));
/* o elemento no ponto (x,y) pertence à célula `sel`? */
const pontoEm = (page, x, y, sel) => page.evaluate(([px, py, s]) => {
  const e = document.elementFromPoint(px, py); return !!(e && e.closest(s));
}, [x, y, sel]);
const rect = (page, sel, n) => page.evaluate(([s, i]) => {
  const e = document.querySelectorAll(s)[i]; if (!e) return null; const r = e.getBoundingClientRect();
  return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2 };
}, [sel, n || 0]);
const opaco = (page, sel) => page.evaluate((s) => {
  const e = document.querySelector(s); if (!e) return false;
  const m = /rgba?\(([^)]+)\)/.exec(getComputedStyle(e).backgroundColor); if (!m) return false;
  const p = m[1].split(',').map((x) => parseFloat(x)); return p.length === 3 || p[3] === 1;
}, sel);
const docSemRolagemHorizontal = (page) => page.evaluate(() =>
  document.documentElement.scrollWidth <= window.innerWidth + 1 && document.body.scrollWidth <= window.innerWidth + 1);

async function cenariosDesktop(browser, w, h) {
  console.log('\n== ' + w + 'x' + h + ' ==');
  const { ctx, page, erros } = await abrirApp(browser, base(30, 3), { width: w, height: h });
  const linhas = await page.locator('.avp-tabela-scroll tbody tr').count();
  afirma(linhas === 30, 'as 30 avaliações continuam na lista (' + linhas + ')');
  afirma(await page.locator('.avp-act-ver').count() + await page.locator('.avp-act-editar').count() === 30 && await page.locator('.avp-act-mais').count() === 30,
    'os botões de ação de cada linha continuam (Visualizar/Continuar + ⋯)');
  await focarTabela(page);

  let g = await geom(page);
  afirma(g.overflowY === 'auto' && g.overflowX === 'auto', 'o scroll container é .avp-tabela-scroll (overflow: auto nos dois eixos)');
  afirma(g.sh > g.ch + 20, 'tem rolagem vertical PRÓPRIA (conteúdo ' + g.sh + ' > altura ' + g.ch + ')');
  afirma(g.sw > g.cw + 20, 'tem rolagem horizontal PRÓPRIA (conteúdo ' + g.sw + ' > largura ' + g.cw + ') — a tabela não foi espremida para caber');
  afirma(g.bottom <= g.ih + 1 && g.bottom > g.ih - 40, 'o quadro termina dentro da janela (base em ' + Math.round(g.bottom) + ' de ' + g.ih + ') — a barra horizontal está à vista, sem ir ao fim da página');
  afirma(g.ch >= 320, 'altura útil de pelo menos 320 px (' + g.ch + ')');

  /* D */
  afirma(await docSemRolagemHorizontal(page), 'D: a página não ganhou rolagem horizontal por causa da tabela');

  /* opacidade */
  afirma(await opaco(page, '.avp-tabela-scroll thead th.avp-col-item'), 'cabeçalho "Item" com fundo opaco');
  afirma(await opaco(page, '.avp-tabela-scroll thead th.avp-col-res'), 'cabeçalho das demais colunas com fundo opaco');
  afirma(await opaco(page, '.avp-tabela-scroll tbody td.avp-col-item'), 'célula Item com fundo opaco');
  afirma(await opaco(page, '.avp-tabela-scroll tbody td.avp-check-col'), 'célula da caixa de seleção com fundo opaco');
  afirma(await opaco(page, '.avp-tabela-scroll tbody td.avp-col-acoes'), 'célula de Ações com fundo opaco');

  /* A — até a última linha */
  console.log(' -- A: rolar até a última linha --');
  await rolar(page, 'fim', 0);
  g = await geom(page);
  afirma(g.st > 0, 'a tabela rolou por dentro (scrollTop ' + Math.round(g.st) + ')');
  const th = await rect(page, '.avp-tabela-scroll thead th.avp-col-res');
  afirma(Math.abs(th.top - (g.top + 1)) <= 2, 'A: o cabeçalho das colunas continua colado no topo do quadro (th.top ' + Math.round(th.top) + ' x quadro ' + Math.round(g.top) + ')');
  afirma(await pontoEm(page, th.cx, th.cy, 'th.avp-col-res'), 'A: o cabeçalho está por cima das linhas (nada passa sobre ele)');
  const n = await page.locator('.avp-tabela-scroll tbody tr').count();
  const ultimo = await rect(page, '.avp-tabela-scroll tbody td.avp-col-item', n - 1);
  afirma(ultimo.bottom <= g.bottom + 1 && ultimo.top >= g.top, 'A: a última linha está visível');
  afirma(await pontoEm(page, ultimo.cx, ultimo.cy, 'td.avp-col-item'), 'A: o nome do item da última linha está identificável');

  /* B — até a direita */
  console.log(' -- B: rolar até a direita --');
  await rolar(page, 0, 'fim');
  g = await geom(page);
  afirma(g.sl > 0 && g.sl + g.cw >= g.sw - 2, 'rolou até o fim à direita (scrollLeft ' + Math.round(g.sl) + ')');
  const itH = await rect(page, '.avp-tabela-scroll thead th.avp-col-item');
  const chH = await rect(page, '.avp-tabela-scroll thead th.avp-check-col');
  afirma(Math.abs(chH.left - (g.left + 1)) <= 2, 'B: a caixa de seleção continua na borda esquerda do quadro');
  afirma(Math.abs(itH.left - chH.right) <= 2, 'B: o Item continua logo depois da caixa — colunas fixas sem sobreposição nem vão (' + Math.round(chH.right) + ' → ' + Math.round(itH.left) + ')');
  const it0 = await rect(page, '.avp-tabela-scroll tbody td.avp-col-item', 0);
  afirma(await pontoEm(page, it0.cx, it0.cy, 'td.avp-col-item'), 'B: o nome do item da 1ª linha continua visível à esquerda');
  const ac0 = await rect(page, '.avp-tabela-scroll tbody td.avp-col-acoes', 0);
  afirma(Math.abs(ac0.right - (g.right - 1 - (g.cw < g.sw ? (await page.evaluate(() => { const e = document.querySelector('.avp-tabela-scroll'); return e.offsetWidth - e.clientWidth - 2; })) : 0))) <= 3,
    'B: as Ações continuam coladas na borda direita do quadro');
  const btn = await rect(page, '.avp-tabela-scroll tbody .avp-act-mais', 0);
  afirma(await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return !!(e && e.closest('.avp-act-mais')); }, [btn.cx, btn.cy]),
    'B: o botão ⋯ da 1ª linha está acessível (clicável) mesmo rolado todo para a direita');

  /* C — os dois eixos */
  console.log(' -- C: rolar vertical + horizontal --');
  await rolar(page, 200, 420);
  g = await geom(page);
  const cab = await rect(page, '.avp-tabela-scroll thead th.avp-col-dec');
  afirma(await pontoEm(page, cab.cx, cab.cy, 'th.avp-col-dec') || await pontoEm(page, cab.cx, cab.cy, 'th'), 'C: cabeçalhos de colunas rolantes aparecem no topo');
  /* canto: cabeçalho da caixa e do Item acima das células rolantes */
  const cantoItem = await rect(page, '.avp-tabela-scroll thead th.avp-col-item');
  afirma(await pontoEm(page, cantoItem.cx, cantoItem.cy, 'th.avp-col-item'), 'C: o cabeçalho "Item" (canto) fica por cima de tudo');
  const cantoAcoes = await rect(page, '.avp-tabela-scroll thead th.avp-col-acoes');
  afirma(await pontoEm(page, cantoAcoes.cx, cantoAcoes.cy, 'th.avp-col-acoes'), 'C: o cabeçalho "Ações" (canto) fica por cima de tudo');
  const erradas = await page.evaluate(() => {
    const el = document.querySelector('.avp-tabela-scroll'); const c = el.getBoundingClientRect(); const out = [];
    document.querySelectorAll('.avp-tabela-scroll tbody tr').forEach((tr, i) => {
      const r = tr.getBoundingClientRect();
      if (r.bottom < c.top + 60 || r.top > c.bottom - 20) return; /* fora do quadro */
      [['td.avp-check-col', 'td.avp-check-col'], ['td.avp-col-item', 'td.avp-col-item'], ['td.avp-col-acoes', 'td.avp-col-acoes']].forEach(([sel, esperado]) => {
        const td = tr.querySelector(sel).getBoundingClientRect();
        const x = (td.left + td.right) / 2, y = (Math.max(td.top, c.top + 50) + Math.min(td.bottom, c.bottom - 20)) / 2;
        const e = document.elementFromPoint(x, y);
        if (!(e && e.closest(esperado) === tr.querySelector(sel))) out.push('linha ' + i + ' ' + sel + ' coberta por ' + (e ? e.tagName + '.' + e.className : 'nada'));
      });
    });
    return out;
  });
  afirma(erradas.length === 0, 'C: em todas as linhas visíveis, caixa + Item + Ações não são cobertos por nenhuma outra célula' + (erradas.length ? ' — ' + erradas.slice(0, 3).join('; ') : ''));
  afirma(await docSemRolagemHorizontal(page), 'C/D: a página continua sem rolagem horizontal depois de rolar a tabela');
  if (process.env.FA_SHOTS) await page.screenshot({ path: path.join(process.env.FA_SHOTS, 'tabela-' + w + 'x' + h + '-C.png') });

  /* a barra acompanha a página: rolando a página o quadro continua terminando na janela */
  console.log(' -- página rolando: o quadro continua terminando dentro da janela --');
  const meio = await page.evaluate(() => { window.scrollBy(0, -120); return new Promise((r) => setTimeout(r, 250)); }).then(() => geom(page));
  afirma(meio.bottom <= meio.ih + 1, 'com a página 120 px mais acima, o rodapé do quadro segue dentro da janela (' + Math.round(meio.bottom) + ' de ' + meio.ih + ')');

  /* marcar uma linha refaz o HTML — não pode perder o lugar */
  console.log(' -- marcar uma linha não perde o lugar --');
  await focarTabela(page);
  await rolar(page, 300, 260);
  const antes = await geom(page);
  const chk = await page.evaluate(() => {
    const el = document.querySelector('.avp-tabela-scroll'); const c = el.getBoundingClientRect();
    const alvo = Array.from(document.querySelectorAll('.avp-check-item')).find((x) => { const r = x.getBoundingClientRect(); return r.top > c.top + 80 && r.bottom < c.bottom - 10; });
    if (!alvo) return null; const r = alvo.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, key: alvo.dataset.key };
  });
  afirma(!!chk, 'achou uma caixa de seleção visível para clicar');
  await page.mouse.click(chk.x, chk.y);
  await page.waitForTimeout(250);
  const depois = await geom(page);
  afirma(await page.locator('.avp-check-item[data-key="' + chk.key + '"]').isChecked(), 'a linha ficou marcada (seleção continua funcionando)');
  afirma(Math.abs(depois.st - antes.st) <= 2 && Math.abs(depois.sl - antes.sl) <= 2,
    'a tabela NÃO voltou ao topo/à esquerda ao marcar (scrollTop ' + Math.round(antes.st) + '→' + Math.round(depois.st) + ', scrollLeft ' + Math.round(antes.sl) + '→' + Math.round(depois.sl) + ')');
  await page.click('#avpSelecionarTodos');
  await page.waitForTimeout(200);
  afirma(await page.locator('.avp-check-item:checked').count() === 30, '"selecionar todos" marca as 30');
  await page.click('#avpSelecionarTodos');
  await page.waitForTimeout(150);

  /* tooltip quando o texto é grande */
  const titulo = await page.evaluate(() => { const c = Array.from(document.querySelectorAll('.avp-tabela-scroll tbody td.avp-col-camada')).find((x) => /Unidade de valor/.test(x.textContent)); return c ? c.title : ''; });
  afirma(/Unidade de valor associada/.test(titulo), 'a classificação longa tem tooltip com o texto completo');
  const semReticencias = await page.evaluate(() => {
    const c = Array.from(document.querySelectorAll('.avp-tabela-scroll tbody td.avp-col-camada')).find((x) => /Unidade de valor/.test(x.textContent));
    return c.scrollWidth <= c.clientWidth + 1;
  });
  afirma(semReticencias, 'a classificação longa aparece inteira (sem "Unidade de valor associ…")');

  /* lixeira */
  console.log(' -- lixeira --');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.click('#avpLixeiraBtn');
  await page.waitForSelector('.avp-tabela-scroll--lixeira', { timeout: 3000 });
  await focarTabela(page);
  await rolar(page, 0, 'fim');
  const gl = await geom(page);
  const tl = await rect(page, '.avp-tabela-scroll--lixeira thead th.avp-col-item');
  afirma(Math.abs(tl.left - (gl.left + 1)) <= 2 || gl.sw <= gl.cw + 1, 'lixeira: o Item também fica fixo à esquerda quando há rolagem lateral');
  afirma(await page.locator('.avp-act-restaurar').count() === 3, 'lixeira: os 3 botões "Restaurar" continuam');
  afirma(await docSemRolagemHorizontal(page), 'lixeira: sem rolagem horizontal da página');

  const banco = await page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal || window.__CFG.db)));
  afirma(Object.keys(banco['avaliacoes-produto']).length === 33 && Object.keys(banco['avaliacoes-produto']).every((k) => banco['avaliacoes-produto'][k].motorVersion === '2026.08.01-1'),
    'nenhum dado foi alterado (33 avaliações, todas com o motor de antes)');
  afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();

  await cenariosDesktop(browser, 1920, 1080);
  await cenariosDesktop(browser, 1600, 900);
  await cenariosDesktop(browser, 1366, 768);

  console.log('\n== 768x1024 (tablet): continua com as colunas fixas ==');
  {
    const { ctx, page, erros } = await abrirApp(browser, base(30), { width: 768, height: 1024 });
    await focarTabela(page);
    await rolar(page, 'fim', 'fim');
    const g = await geom(page);
    const th = await rect(page, '.avp-tabela-scroll thead th.avp-col-res');
    const it = await rect(page, '.avp-tabela-scroll thead th.avp-col-item');
    afirma(g.sw > g.cw && g.sh > g.ch, 'rolagem própria nos dois eixos');
    afirma(Math.abs(th.top - (g.top + 1)) <= 2, 'cabeçalho fixo no topo');
    afirma(it.left - g.left <= 50 + 2, 'Item fixo à esquerda (logo depois da caixa)');
    afirma(g.bottom <= g.ih + 1, 'o quadro termina dentro da janela');
    afirma(await docSemRolagemHorizontal(page), 'a página não rola na horizontal');
    afirma(erros.length === 0, 'nenhum erro de JS');
    await ctx.close();
  }

  console.log('\n== 375x740 (celular): segue em cartões, sem rolagem horizontal da página ==');
  {
    const { ctx, page, erros } = await abrirApp(browser, base(30), { width: 375, height: 740 });
    const r = await page.evaluate(() => {
      const t = document.querySelector('.avp-table'); const cs = getComputedStyle(t);
      const tr = document.querySelector('.avp-table tbody tr'); const td = tr.querySelector('td.avp-col-item');
      return { tabela: cs.display, thead: getComputedStyle(document.querySelector('.avp-table thead')).display, tdDisplay: getComputedStyle(td).display,
        stickyTh: getComputedStyle(document.querySelector('.avp-table thead th.avp-col-res')).position,
        stickyItem: getComputedStyle(td).position, larguraTr: tr.getBoundingClientRect().width, iw: window.innerWidth };
    });
    afirma(r.tabela === 'block' && r.thead === 'none', 'a tabela continua virando cartões (sem cabeçalho de colunas)');
    afirma(r.stickyTh !== 'sticky' && r.stickyItem !== 'sticky', 'no celular nada é sticky (o cartão já traz o rótulo de cada campo)');
    afirma(r.larguraTr <= r.iw, 'cada cartão cabe na largura da tela (' + Math.round(r.larguraTr) + ' de ' + r.iw + ')');
    afirma(await docSemRolagemHorizontal(page), 'a página não rola na horizontal');
    afirma(await page.locator('.avp-tabela-scroll tbody tr').count() === 30, 'as 30 avaliações continuam (cartões)');
    afirma(erros.length === 0, 'nenhum erro de JS');
    await ctx.close();
  }

  await browser.close();
  if (falhas) { console.log('\n' + falhas + ' FALHA(S)'); process.exit(1); }
  console.log('\nOK — a tabela de avaliações tem rolagem própria, cabeçalho/Item/Ações fixos e nada mudou na funcionalidade.');
})().catch((e) => { console.error(e); process.exit(1); });
