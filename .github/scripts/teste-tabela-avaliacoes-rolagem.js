/* Lista de avaliações (área Avaliação): a PÁGINA inteira rola — o quadro da
 * tabela não tem rolagem própria (a "janela dentro da página" da PR #249 saiu).
 *
 * O que prova (1920x1080, 1366x768 e 1280x720 em tabela; 1024x768, 768x1024 e 375x740 em cartões):
 *   - nenhum elemento entre a tabela e a página tem rolagem vertical própria;
 *   - só as colunas necessárias para localizar a avaliação: Item, Resultado
 *     final, Classificação, Status, Atualizado em, Responsável e Ações;
 *   - o cabeçalho das colunas fica fixo logo abaixo do menu quando a PÁGINA rola;
 *   - a última linha é alcançada rolando a página, e as Ações de todas as
 *     linhas ficam dentro da largura da janela (sem rolagem lateral);
 *   - marcar uma linha (que refaz o HTML) não joga a página para o topo;
 *   - a lixeira usa o mesmo desenho; no celular continua em cartões;
 *   - nada de dados/ações mudou: mesmas 30 linhas, mesmos botões, nenhuma gravação.
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
  await page.goto(BASE + '/index.html#avaliacoes', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.body.classList.contains('aguardando-auth'), { timeout: 16000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.waitForSelector('.avp-tabela-wrap', { timeout: 8000 });
  await page.waitForTimeout(400);
  return { ctx, page, erros };
}


const docSemRolagemHorizontal = (page) => page.evaluate(() =>
  document.documentElement.scrollWidth <= window.innerWidth + 1 && document.body.scrollWidth <= window.innerWidth + 1);
const COLUNAS = ['Item', 'Classificação', 'Status', 'Atualizado em', 'Responsável', 'Ações'];

async function cenariosDesktop(browser, w, h) {
  console.log('\n== ' + w + 'x' + h + ' ==');
  const { ctx, page, erros } = await abrirApp(browser, base(30, 3), { width: w, height: h });
  afirma(await page.locator('.avp-tabela-wrap tbody tr').count() === 30, 'as 30 avaliações continuam na lista');
  afirma(await page.locator('.avp-act-ver').count() + await page.locator('.avp-act-editar').count() === 30 && await page.locator('.avp-act-mais').count() === 30,
    'os botões de ação de cada linha continuam (Abrir/Continuar + ⋯)');

  const ths = (await page.locator('.avp-tabela-wrap thead th').allTextContents()).map((t) => t.trim()).filter(Boolean);
  afirma(JSON.stringify(ths) === JSON.stringify(COLUNAS), 'colunas: ' + ths.join(' | '));

  /* sem rolagem vertical própria em nenhum ancestral da tabela */
  const presos = await page.evaluate(() => {
    const out = [];
    for (let e = document.querySelector('.avp-table'); e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (/(auto|scroll)/.test(cs.overflowY) || /(auto|scroll)/.test(cs.overflowX)) out.push(e.tagName + '.' + e.className + ' ' + cs.overflowX + '/' + cs.overflowY);
    }
    return out;
  });
  afirma(presos.length === 0, 'nenhum ancestral da tabela tem rolagem própria' + (presos.length ? ' — ' + presos.join('; ') : ''));
  afirma(await docSemRolagemHorizontal(page), 'a página não ganhou rolagem horizontal');
  const altPag = await page.evaluate(() => document.documentElement.scrollHeight);
  afirma(altPag > h + 200, 'com 30 linhas quem rola é a página (altura ' + altPag + ' > janela ' + h + ')');

  /* as Ações de toda linha cabem na janela, sem rolagem lateral */
  const acoesFora = await page.evaluate(() => Array.from(document.querySelectorAll('.avp-act-mais')).filter((b) => b.getBoundingClientRect().right > window.innerWidth).length);
  afirma(acoesFora === 0, 'o botão ⋯ de todas as linhas está dentro da largura da janela');

  /* cabeçalho fixo na rolagem da PÁGINA */
  const navH = await page.evaluate(() => document.querySelector('.nav').offsetHeight);
  await page.evaluate(() => window.scrollTo({ top: document.querySelector('.avp-table').getBoundingClientRect().top + window.scrollY + 600, behavior: 'instant' }));
  await page.waitForTimeout(250);
  const th = await page.evaluate(() => { const r = document.querySelector('.avp-table thead th.avp-col-camada').getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; });
  afirma(Math.abs(th.top - navH) <= 3, 'rolando a página, o cabeçalho das colunas fica colado logo abaixo do menu (topo ' + Math.round(th.top) + ', menu ' + navH + ')');
  const ponto = await page.evaluate(() => { const r = document.querySelector('.avp-table thead th.avp-col-camada').getBoundingClientRect(); const e = document.elementFromPoint(r.left + 10, r.top + r.height / 2); return !!(e && e.closest('th.avp-col-camada')); });
  afirma(ponto, 'o cabeçalho está por cima das linhas (nenhuma célula passa sobre ele)');
  const opaco = await page.evaluate(() => { const m = /rgba?\(([^)]+)\)/.exec(getComputedStyle(document.querySelector('.avp-table thead th')).backgroundColor); const p = m[1].split(',').map(parseFloat); return p.length === 3 || p[3] === 1; });
  afirma(opaco, 'cabeçalho com fundo opaco');

  /* corrida real vista no CI: a lista renderiza com o menu ainda escondido (altura 0).
     O cabeçalho não pode ficar por baixo do menu quando ele aparecer. */
  await page.evaluate(() => { document.querySelector('.nav').style.display = 'none'; });
  await page.click('#avpFiltrosBtn');
  await page.evaluate(() => { document.querySelector('.nav').style.display = ''; });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo({ top: document.querySelector('.avp-table').getBoundingClientRect().top + window.scrollY + 600, behavior: 'instant' }));
  await page.waitForTimeout(250);
  const th2 = await page.evaluate(() => document.querySelector('.avp-table thead th.avp-col-camada').getBoundingClientRect().top);
  const navH2 = await page.evaluate(() => document.querySelector('.nav').offsetHeight);
  afirma(Math.abs(th2 - navH2) <= 3, 'renderizada com o menu escondido, o cabeçalho ainda gruda abaixo do menu quando ele aparece (topo ' + Math.round(th2) + ', menu ' + navH2 + ')');
  await page.click('#avpFiltrosBtn');

  /* última linha alcançável pela página */
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await page.waitForTimeout(250);
  const ult = await page.evaluate(() => { const l = Array.from(document.querySelectorAll('.avp-table tbody tr')).pop().getBoundingClientRect(); return { top: l.top, bottom: l.bottom, ih: window.innerHeight }; });
  afirma(ult.bottom <= ult.ih + 1 && ult.top >= 0, 'rolando até o fim, a última linha fica visível');

  /* marcar uma linha não joga a página para o topo */
  await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'instant' }));
  await page.waitForTimeout(150);
  const antes = await page.evaluate(() => Math.round(window.pageYOffset));
  const chk = await page.evaluate(() => { const c = Array.from(document.querySelectorAll('.avp-check-item')).find((x) => { const r = x.getBoundingClientRect(); return r.top > 120 && r.bottom < window.innerHeight - 20; }); if (!c) return null; const r = c.getBoundingClientRect(); return { key: c.dataset.key, x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  afirma(!!chk, 'achou uma caixa de seleção visível para clicar');
  await page.mouse.click(chk.x, chk.y);
  await page.waitForTimeout(250);
  afirma(await page.locator('.avp-check-item[data-key="' + chk.key + '"]').isChecked(), 'a linha ficou marcada (seleção continua funcionando)');
  const depois = await page.evaluate(() => Math.round(window.pageYOffset));
  afirma(Math.abs(depois - antes) <= 4, 'a página NÃO voltou ao topo ao marcar (rolagem ' + antes + ' → ' + depois + ')');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.click('#avpSelecionarTodos');
  await page.waitForTimeout(200);
  afirma(await page.locator('.avp-check-item:checked').count() === 30, '"selecionar todos" marca as 30');
  await page.click('#avpSelecionarTodos');
  await page.waitForTimeout(150);

  /* a classificação longa aparece inteira (quebra de linha, sem reticências) */
  const longa = await page.evaluate(() => { const c = Array.from(document.querySelectorAll('.avp-table tbody td.avp-col-camada')).find((x) => /Unidade de valor/.test(x.textContent)); return { ok: !!c, corta: c ? c.scrollWidth > c.clientWidth + 1 : true, over: c ? getComputedStyle(c).textOverflow : '' }; });
  afirma(longa.ok && !longa.corta && longa.over !== 'ellipsis', 'a classificação longa aparece inteira (sem "Unidade de valor associ…")');

  /* lixeira */
  console.log(' -- lixeira --');
  await page.click('#avpLixeiraBtn');
  await page.waitForSelector('.avp-tabela-wrap--lixeira', { timeout: 3000 });
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
  await cenariosDesktop(browser, 1366, 768);
  await cenariosDesktop(browser, 1280, 720);

  for (const [w, h] of [[1024, 768], [768, 1024], [375, 740]]) {
    console.log('\n== ' + w + 'x' + h + ' (' + (w > 640 ? 'tablet/notebook pequeno' : 'celular') + '): cartões, sem rolagem horizontal da página ==');
    const { ctx, page, erros } = await abrirApp(browser, base(30), { width: w, height: h });
    const r = await page.evaluate(() => {
      const t = document.querySelector('.avp-table'); const cs = getComputedStyle(t);
      const tr = document.querySelector('.avp-table tbody tr');
      return { tabela: cs.display, thead: getComputedStyle(document.querySelector('.avp-table thead')).display,
        larguraTr: tr.getBoundingClientRect().width, alturaTr: tr.getBoundingClientRect().height, iw: window.innerWidth };
    });
    afirma(r.tabela === 'block' && r.thead === 'none', 'a tabela vira cartões (sem cabeçalho de colunas)');
    afirma(r.larguraTr <= r.iw, 'cada cartão cabe na largura da tela (' + Math.round(r.larguraTr) + ' de ' + r.iw + ')');
    afirma(r.alturaTr < 400, 'cada cartão tem altura razoável (' + Math.round(r.alturaTr) + ' px)');
    afirma(await docSemRolagemHorizontal(page), 'a página não rola na horizontal');
    afirma(await page.locator('.avp-tabela-wrap tbody tr').count() === 30, 'as 30 avaliações continuam (cartões)');
    const rotulos = await page.evaluate(() => Array.from(document.querySelectorAll('.avp-table tbody tr:first-child td[data-label]')).map((td) => td.dataset.label));
    afirma(rotulos.indexOf('Classificação') !== -1 && rotulos.indexOf('Atualizado em') !== -1, 'cada campo do cartão tem rótulo: ' + rotulos.join(', '));
    afirma(erros.length === 0, 'nenhum erro de JS');
    await ctx.close();
  }

  await browser.close();
  if (falhas) { console.log('\n' + falhas + ' FALHA(S)'); process.exit(1); }
  console.log('\nOK — a lista rola com a página, tem poucas colunas, cabeçalho fixo e nada mudou na funcionalidade.');
})().catch((e) => { console.error(e); process.exit(1); });
