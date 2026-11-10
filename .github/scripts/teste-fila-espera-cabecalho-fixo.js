/* ADMIN › Eventos › Lista de Espera: os títulos das colunas continuam à vista ao descer a lista. Firebase falso; 1280 px, 900 px e 375 px.
 *
 * O QUE ELE EXIGE:
 *   1. 1280 px: rolando a página até o meio da lista, os títulos ficam logo abaixo do menu, sem rolagem interna, e a coluna
 *      Ações continua dentro da caixa mesmo com um e-mail comprido;
 *   2. 900 e 375 px: a tabela rola por dentro e os títulos ficam no topo do quadro, que não passa da tela;
 *   3. nos três: fundo opaco (as linhas não aparecem por trás), os 7 títulos presentes, e o título acompanha a coluna quando
 *      a tabela rola para o lado; sem rolagem lateral da página; nenhum erro de JavaScript. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const ADM = 'adm@previ.com.br';
const LINHAS = 40;
const TABELA = '[data-ev-key="evA"] .espera-tabela';

function banco() {
  const espera = {};
  for (let i = 1; i <= LINHAS; i++) {
    const e = i === 1 ? 'uma.pessoa.com.um.endereco.de.email.bem.comprido.para.testar@previ.com.br' : 'pessoa.' + i + '@previ.com.br';
    espera[chave(e)] = { 'lista:evA': { name: 'PESSOA ' + String(i).padStart(2, '0') + ' DA SILVA', email: e, area: 'GECAT', eventoKey: 'evA', date: '2026-08-05T09:00:00.000Z' } };
  }
  /* quem saiu da fila para uma turma de outro evento, com o destino por extenso comprido ("Saíram da fila") */
  espera[chave('saiu.para.turma@previ.com.br')] = { 'lista:evA': { name: 'RODRIGO CORREA LOPES DO NASCIMENTO', email: 'saiu.para.turma@previ.com.br', area: 'GESOP', eventoKey: 'evA', date: '2026-08-18T13:22:00.000Z', removed: true, removedDate: '2026-11-09T10:34:00.000Z', movedToTurma: 'tB1', movedToStatus: 'inscrito' } };
  return {
    'fa-users': { [chave(ADM)]: { name: 'ADMIN', email: ADM, area: 'INFOR' } }, 'fa-admins': { [chave(ADM)]: { email: ADM, name: 'ADMIN' } }, 'fa-diretores': {}, 'fa-facilitadores': {},
    'fa-gerentes': {}, 'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': espera,
    eventos: { evA: { nome: 'EPISÓDIO A', order: 1, publicado: true, cargaHoraria: '12', esperaAtiva: false }, evB: { nome: 'EPISÓDIO III - A REBELIÃO SE ESPALHA', order: 2, publicado: true, cargaHoraria: '3' } },
    turmas: { tA1: { label: 'Turma 1', eventoKey: 'evA', order: 1, dias: ['2026-09-11'] }, tB1: { label: 'Turma 8 - Técnicos', eventoKey: 'evB', order: 1, dias: ['2026-11-09'] } },
    'turmas-interesse': {}, 'turmas-interesse-log': {}, 'turmas-config': {}, 'turmas-checkin': {},
    'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {}, 'turmas-sorteio': {}, avaliacoes: {}, pedidos: {}, holocron: {}
  };
}

(async () => {
  const browser = await chromium.launch();
  let falhas = 0, oks = 0;
  const anota = (r, ok, d) => { if (ok) { oks++; console.log('  ok    ' + r); } else { falhas++; console.error('  FALHA ' + r + (d ? ' — ' + d : '')); } };
  try {
    for (const [nome, opt, interna] of [
      ['1280 px', { viewport: { width: 1280, height: 800 } }, false],
      ['900 px', { viewport: { width: 900, height: 800 } }, true],
      ['375 px', { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, true]
    ]) {
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
      await esperarCondicao(page, () => Array.from(document.querySelectorAll('.admin-tab-btn')).some((x) => /Eventos/i.test(x.textContent)), null, { limite: 15000, descricao: 'aba Eventos' });
      await page.evaluate(() => Array.from(document.querySelectorAll('.admin-tab-btn')).find((x) => /Eventos/i.test(x.textContent)).click());
      await esperarCondicao(page, (s) => !!document.querySelector(s + ' tbody tr'), TABELA, { limite: 15000, descricao: 'a tabela da lista de espera' });
      await page.evaluate((s) => { const t = document.querySelector(s); if (t.offsetParent === null) document.querySelector('[data-ev-key="evA"] .ev-toggle-icon').click(); }, TABELA);
      await esperarCondicao(page, (s) => document.querySelector(s).offsetParent !== null, TABELA, { limite: 15000, descricao: 'a tabela à vista' });

      /* desce até o meio da lista: a página (desktop) ou o quadro (tela menor) */
      await page.evaluate(([s, interna]) => {
        document.documentElement.style.scrollBehavior = 'auto';
        const w = document.querySelector(s), l = w.querySelectorAll('tbody tr')[20];
        if (interna) { w.scrollIntoView({ block: 'center' }); w.scrollTop = l.offsetTop - 100; } else window.scrollTo(0, l.getBoundingClientRect().top + window.scrollY - 300);
      }, [TABELA, interna]);
      await page.waitForTimeout(200);
      const m = await page.evaluate((s) => {
        const w = document.querySelector(s), th = w.querySelector('thead th'), r = th.getBoundingClientRect(), rw = w.getBoundingClientRect();
        const nav = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 73;
        const prim = w.querySelector('tbody tr').getBoundingClientRect(), tabela = w.querySelector('table').getBoundingClientRect();
        const botao = w.querySelector('tbody tr td:last-child button').getBoundingClientRect();
        const area = w.querySelector('tbody tr').children[2], rArea = document.createRange(); rArea.selectNodeContents(area);
        const areaLinhas = new Set(Array.from(rArea.getClientRects()).map((x) => Math.round(x.top))).size;
        const cor = getComputedStyle(th).backgroundColor, topoEl = document.elementFromPoint(r.left + 4, r.top + 4);
        return { top: Math.round(r.top), wTop: Math.round(rw.top), wBottom: Math.round(rw.bottom), wRight: Math.round(rw.right), tabRight: Math.round(tabela.right), botRight: Math.round(botao.right), areaLinhas, nav, primeiraPassou: prim.top < r.top,
          titulos: w.querySelectorAll('thead th').length, rolaDentro: w.scrollHeight > w.clientHeight + 1, altTela: window.innerHeight,
          opaco: !/rgba\(.*, 0(\.\d+)?\)|transparent/.test(cor), cor, porCima: !!(topoEl && topoEl.closest('thead')), pagina: document.documentElement.scrollWidth <= window.innerWidth + 1 };
      }, TABELA);
      if (interna) anota(nome + ': os títulos param no topo do quadro, e o quadro rola por dentro sem passar da tela',
        Math.abs(m.top - m.wTop) <= 2 && m.rolaDentro && m.primeiraPassou && m.wBottom - m.wTop <= m.altTela, JSON.stringify(m));
      else {
        anota(nome + ': os títulos param logo abaixo do menu, sem rolagem interna', m.top >= m.nav - 2 && m.top <= m.nav + 40 && !m.rolaDentro && m.primeiraPassou, JSON.stringify(m));
        anota(nome + ': com e-mail comprido, a tabela e o botão da coluna Ações ficam dentro da caixa, e a Área não parte no meio', m.tabRight <= m.wRight + 1 && m.botRight <= m.wRight + 1 && m.areaLinhas === 1, JSON.stringify(m));
      }
      if (!interna) {
        const sd = await page.evaluate(() => {
          const d = document.querySelector('[data-ev-key="evA"] .espera-saidos'); if (!d) return null; d.open = true;
          const w = d.querySelector('.table-scroll-wrap'), b = d.querySelector('.destino-turma').getBoundingClientRect(), rw = w.getBoundingClientRect();
          return { cabe: w.scrollWidth <= w.clientWidth + 1, badgeDentro: b.right <= rw.right + 1, texto: d.querySelector('.destino-turma').textContent };
        });
        anota(nome + ': "Saíram da fila" — destino por extenso comprido quebra linha e a tabela (com Motivo) cabe na caixa', !!sd && sd.cabe && sd.badgeDentro && /REBELIÃO/.test(sd.texto), JSON.stringify(sd));
      }
      anota(nome + ': os 7 títulos, por cima das linhas, com fundo opaco; sem rolagem lateral da página', m.titulos === 7 && m.opaco && m.porCima && m.pagina, JSON.stringify(m));

      /* na tela menor, o título acompanha a coluna na rolagem lateral */
      const lateral = await page.evaluate((s) => {
        const w = document.querySelector(s); w.scrollLeft = w.scrollWidth;
        const th = w.querySelectorAll('thead th')[2].getBoundingClientRect(), td = w.querySelector('tbody tr').children[2].getBoundingClientRect();
        return { th: Math.round(th.left), td: Math.round(td.left) };
      }, TABELA);
      anota(nome + ': o título acompanha a coluna quando a tabela rola para o lado', lateral.th === lateral.td, JSON.stringify(lateral));
      if (process.env.FA_SHOTS) await page.screenshot({ path: path.join(process.env.FA_SHOTS, 'espera-cab-' + opt.viewport.width + '.png') });
      anota(nome + ': nenhum erro de JavaScript', !erros.length, erros.join(' | '));
      await ctx.close();
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
