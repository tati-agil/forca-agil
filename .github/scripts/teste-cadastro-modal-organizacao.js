/* ADMIN › Cadastrados, menu ⋯: a organização da caixa — só apresentação. A consulta em si é provada em
 * teste-cadastro-turmas-pessoa.js, e as ações, em teste-acoes-cadastrado.js. Firebase falso; 1280 px, 375 px e celular baixo.
 *
 * O QUE ELE EXIGE, com 0, 1, 2 e 30 participações:
 *   1. cabeçalho com a pessoa; depois "Participações" com o total; depois "Ações administrativas", nesta ordem;
 *   2. nenhuma participação é escondida: todas as linhas existem e dá para rolar até a última;
 *   3. só a lista longa rola por dentro e mostra a dica; a curta, não; a rolagem interna recebe foco pelo teclado;
 *   4. as ações não são empurradas: começam no mesmo lugar com 30 ou com 3 participações, e à vista na tela;
 *   5. todas as ações, cada uma com a descrição; duas colunas onde couber, uma no celular;
 *   6. sem rolagem lateral (página, caixa e lista); as verificações do padrão visual passam;
 *   7. nada é gravado; nenhum erro de JavaScript. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const { verificarTela } = require('./padrao-visual-verificacoes');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

const ADM = 'adm@previ.com.br';
const QUANTAS = { 'nenhuma@previ.com.br': 0, 'uma@previ.com.br': 1, 'duas@previ.com.br': 2, 'tres@previ.com.br': 3, 'muitas@previ.com.br': 30 };

function banco() {
  const users = { [chave(ADM)]: { name: 'ADMIN', email: ADM, area: 'INFOR', createdAt: '2026-08-01T10:00:00.000Z' } };
  const turmas = {}, interesse = {}, espera = {};
  Object.keys(QUANTAS).forEach((e) => { users[chave(e)] = { name: e.split('@')[0].toUpperCase(), email: e, area: 'GECAT', createdAt: '2026-08-01T10:00:00.000Z' }; });
  for (let i = 1; i <= 30; i++) {
    const k = 't' + i;
    turmas[k] = { label: 'Turma ' + i, eventoKey: 'evA', order: i, dias: ['2027-11-' + String((i % 28) + 1).padStart(2, '0')] };
    interesse[k] = {};
    Object.keys(QUANTAS).forEach((e) => {
      if (i <= QUANTAS[e] - (QUANTAS[e] >= 2 ? 1 : 0)) interesse[k][chave(e)] = { name: e.split('@')[0].toUpperCase(), email: e, area: 'GECAT', status: 'interessado', removed: false, date: '2026-09-01T10:00:00.000Z' };
    });
  }
  /* de 2 em diante, uma das participações é a lista de espera */
  Object.keys(QUANTAS).filter((e) => QUANTAS[e] >= 2).forEach((e) => { espera[chave(e)] = { 'lista:evA': { name: e, email: e, area: 'GECAT', date: '2026-08-05T15:00:00.000Z', removed: false, eventoKey: 'evA' } }; });
  return {
    'fa-users': users, 'fa-admins': { [chave(ADM)]: { email: ADM, name: 'ADMIN' } }, 'fa-diretores': {}, 'fa-facilitadores': {}, 'fa-gerentes': {},
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-contas-teste': {}, 'fa-espera': espera,
    eventos: { evA: { nome: 'EPISÓDIO COM NOME BEM LONGO PARA TESTAR A QUEBRA DE LINHA NA CAIXA', order: 1, publicado: true, esperaAtiva: true } },
    turmas, 'turmas-interesse': interesse, 'turmas-interesse-log': {}, 'turmas-config': {}, 'turmas-checkin': {},
    'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {}, 'turmas-sorteio': {}, avaliacoes: {}, pedidos: {}, holocron: {}
  };
}

async function abrir(browser, opt) {
  const ctx = await browser.newContext(opt);
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify({ db: banco(), user: { email: ADM, emailVerified: true, uid: 'u-adm' }, delayDefault: 5 }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  await esperarCondicao(page, () => Array.from(document.querySelectorAll('.admin-tab-btn')).some((x) => x.textContent.trim() === 'Cadastrados'), null, { limite: 15000, descricao: 'a aba Cadastrados' });
  await page.evaluate(() => Array.from(document.querySelectorAll('.admin-tab-btn')).find((x) => x.textContent.trim() === 'Cadastrados').click());
  await esperarCondicao(page, () => !!document.querySelector('.cad-mais-btn'), null, { limite: 15000, descricao: 'a lista de cadastrados' });
  return { ctx, page, erros };
}
async function medir(page, email) {
  await page.evaluate((k) => document.querySelector('.cad-mais-btn[data-key="' + k + '"]').click(), chave(email));
  await esperarCondicao(page, () => { const c = document.querySelector('.cad-acoes-modal .cad-vinculos-corpo'); return !!c && !/Carregando/.test(c.textContent); }, null, { limite: 12000, descricao: 'a consulta de ' + email });
  return page.evaluate(() => {
    const box = document.querySelector('.cad-acoes-modal'), rb = box.getBoundingClientRect();
    const sec = document.querySelector('.cad-vinculos'), ac = document.querySelector('.cad-acoes-secao'), lista = box.querySelector('.cad-vinculos-lista');
    const cont = box.querySelector('.cad-vinculos-contador'), dica = box.querySelector('.cad-vinculos-dica');
    const titulos = Array.from(box.querySelectorAll('.cad-secao-titulo')).map((t) => t.firstChild.textContent.trim());
    const bts = Array.from(box.querySelectorAll('.cad-acao-btn')).map((b) => ({ r: b.querySelector('.cad-acao-rotulo').textContent.trim(), a: b.querySelector('.cad-acao-ajuda').textContent.trim(), x: Math.round(b.getBoundingClientRect().left), y: Math.round(b.getBoundingClientRect().top) }));
    let chegaNoFim = true;
    if (lista) { lista.scrollTop = lista.scrollHeight; const u = lista.lastElementChild.getBoundingClientRect(), l = lista.getBoundingClientRect(); chegaNoFim = u.bottom <= l.bottom + 1 && /Lista de espera|Turma/.test(lista.lastElementChild.textContent); lista.scrollTop = 0; }
    return { titulos, total: cont && !cont.hidden ? cont.textContent : null, linhas: box.querySelectorAll('.cad-vinculos-lista li').length, vazia: /Não está em nenhuma turma nem na lista de espera/.test(sec.textContent),
      rola: !!lista && lista.scrollHeight > lista.clientHeight + 1, altLista: lista ? Math.round(lista.getBoundingClientRect().height) : 0, foco: !!lista && lista.tabIndex === 0,
      dica: !!dica && !dica.hidden, chegaNoFim, ordem: sec.getBoundingClientRect().top < ac.getBoundingClientRect().top, cabecalho: /@previ\.com\.br/.test(box.firstElementChild.textContent) && box.firstElementChild.getBoundingClientRect().top < sec.getBoundingClientRect().top,
      acoesTopo: Math.round(ac.getBoundingClientRect().top - rb.top), acoesTela: Math.round(ac.getBoundingClientRect().top), altTela: window.innerHeight, bts,
      colunas: new Set(bts.map((b) => b.x)).size, semLateral: box.scrollWidth <= box.clientWidth + 1 && document.documentElement.scrollWidth <= window.innerWidth + 1 && (!lista || lista.scrollWidth <= lista.clientWidth + 1),
      dentro: rb.left >= 0 && rb.right <= window.innerWidth && rb.top >= 0 && rb.bottom <= window.innerHeight };
  });
}
const fechar = (page) => page.evaluate(() => document.querySelector('.cad-acoes-modal .admin-modal-cancel-btn').click());

(async () => {
  const browser = await chromium.launch();
  let falhas = 0, oks = 0;
  const anota = (r, ok, d) => { if (ok) { oks++; console.log('  ok    ' + r); } else { falhas++; console.error('  FALHA ' + r + (d ? ' — ' + d : '')); } };
  try {
    for (const [nome, opt, colunasEsperadas] of [
      ['1280 px', { viewport: { width: 1280, height: 900 } }, 2],
      ['375 px', { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, 1],
      ['celular baixo (320×568)', { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, 1]
    ]) {
      const A = await abrir(browser, opt);
      const antes = await A.page.evaluate(() => (window.__ESCRITAS || []).length);
      const m = {};
      for (const e of Object.keys(QUANTAS)) { m[QUANTAS[e]] = await medir(A.page, e); if (QUANTAS[e] !== 30) await fechar(A.page); }
      const curta = (x) => JSON.stringify(Object.assign({}, x, { bts: x.bts.length }));

      [0, 1, 2, 3, 30].forEach((n) => {
        const x = m[n];
        anota(nome + ' · ' + n + ': cabeçalho, Participações com o total e Ações administrativas, nesta ordem',
          x.cabecalho && x.ordem && x.titulos.join('|') === 'Participações|Ações administrativas' && x.total === String(n), curta(x));
        anota(nome + ' · ' + n + ': todas as participações na lista', n === 0 ? x.linhas === 0 && x.vazia : x.linhas === n && x.chegaNoFim, curta(x));
        anota(nome + ' · ' + n + ': todas as ações com a descrição; sem rolagem lateral; a caixa dentro da tela',
          x.bts.length >= 4 && x.bts.every((b) => b.r && b.a) && x.colunas === colunasEsperadas && x.semLateral && x.dentro, curta(x));
      });
      anota(nome + ': só a lista longa rola por dentro, com dica e foco pelo teclado', m[30].rola && m[30].dica && m[30].foco && !m[0].dica, curta(m[30]));
      anota(nome + ': com 1 participação, a lista não rola nem mostra dica', !m[1].rola && !m[1].dica && !m[1].foco, curta(m[1]));
      /* o limite da lista segura as ações: de 3 a 30 elas se movem no máximo o que falta para o limite (240 px) */
      anota(nome + ': as ações não são empurradas (lista limitada a 240 px; as ações começam à vista)',
        m[30].altLista <= 240 && m[30].acoesTopo - m[1].acoesTopo <= 240 && m[30].acoesTela < m[30].altTela - 40, JSON.stringify({ alt: m[30].altLista, topo30: m[30].acoesTopo, topo1: m[1].acoesTopo, tela: m[30].acoesTela, altTela: m[30].altTela }));
      const prob = await verificarTela(A.page, { escopo: '.cad-acoes-modal', largura: opt.viewport.width });
      anota(nome + ': verificações do padrão visual (contraste, foco, dois amarelos, rolagem lateral)', !prob.length, JSON.stringify(prob).slice(0, 500));
      if (process.env.FA_SHOTS) await A.page.screenshot({ path: path.join(process.env.FA_SHOTS, 'org-' + opt.viewport.width + '.png') });
      anota(nome + ': nada é gravado', (await A.page.evaluate(() => (window.__ESCRITAS || []).length)) === antes);
      anota(nome + ': nenhum erro de JavaScript', !A.erros.length, A.erros.join(' | '));
      await A.ctx.close();
    }
  } catch (e) {
    falhas++;
    console.error('  FALHA inesperada: ' + e.message);
  } finally {
    await browser.close();
  }
  console.log('\n' + oks + ' ok, ' + falhas + ' falha(s)');
  process.exit(falhas ? 1 : 0);
})();
