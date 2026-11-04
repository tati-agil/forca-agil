/* Lista de espera no ADMIN › Eventos: ordem alfabética na tela e exportação para Excel e PDF, do evento inteiro ou de uma
 * turma de origem. Firebase falso, desktop e 375 px.
 *
 * O QUE ELE EXIGE:
 *   1. a tabela está em ordem alfabética pelo nome, com acento no lugar certo, e as linhas da mesma pessoa ficam juntas, da
 *      mais antiga para a mais nova;
 *   2. o recorte oferece Evento inteiro, Entrou pela lista e as turmas de origem, sem turma de que ninguém veio;
 *   3. Excel do evento inteiro: as mesmas linhas e a mesma ordem da tela, com evento, origem, datas e motivo, sem quem saiu
 *      da fila nem quem espera por outro evento;
 *   4. Excel de uma turma: só quem veio dela, com a turma no nome do arquivo;
 *   5. folha de impressão: diz evento, recorte e total, com as linhas certas, o texto escapado e o botão de imprimir;
 *   6. pop-up bloqueado: o painel avisa, em vez de não fazer nada;
 *   7. nada é gravado; sem rolagem lateral; nenhum erro de JavaScript. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const ADM = 'adm@previ.com.br';

const fila = (nome, email, ev, data, extra) => Object.assign({ name: nome, email, area: 'GECAT', date: data, eventoKey: ev }, extra || {});
const ORDEM = ['ÁLVARO DIAS', 'BRUNO LIMA', 'MARIA NEVES', 'MARIA NEVES', 'ZULEIDE ROCHA'];

function banco() {
  const pessoas = ['alvaro', 'bruno', 'maria', 'zuleide', 'saiu', 'outro'].map((x) => x + '@previ.com.br');
  const users = { [chave(ADM)]: { name: 'ADMIN', email: ADM, area: 'INFOR' } };
  pessoas.forEach((e) => { users[chave(e)] = { name: e.split('@')[0].toUpperCase(), email: e, area: 'GECAT' }; });
  return {
    'fa-users': users, 'fa-admins': { [chave(ADM)]: { email: ADM, name: 'ADMIN' } }, 'fa-diretores': {}, 'fa-facilitadores': {}, 'fa-gerentes': {},
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {},
    'fa-espera': {
      /* gravados fora da ordem alfabética, e a ZULEIDE é a mais antiga da fila */
      [chave('zuleide@previ.com.br')]: { 'lista:evA': fila('ZULEIDE ROCHA', 'zuleide@previ.com.br', 'evA', '2026-08-01T09:00:00.000Z') },
      [chave('maria@previ.com.br')]: {
        tA2: fila('MARIA NEVES', 'maria@previ.com.br', 'evA', '2026-08-09T09:00:00.000Z', { migratedAt: '2026-08-20T09:00:00.000Z', motivoEntrada: 'sem_vagas' }),
        tA1: fila('MARIA NEVES', 'maria@previ.com.br', 'evA', '2026-08-03T09:00:00.000Z', { migratedAt: '2026-08-10T09:00:00.000Z', motivoEntrada: 'sem_vagas' })
      },
      [chave('bruno@previ.com.br')]: { 'lista:evA': fila('BRUNO LIMA', 'bruno@previ.com.br', 'evA', '2026-08-04T09:00:00.000Z', { area: '<img src=x onerror=window.__XSS=1>' }) },
      [chave('alvaro@previ.com.br')]: { tA1: fila('ÁLVARO DIAS', 'alvaro@previ.com.br', 'evA', '2026-08-05T09:00:00.000Z', { migratedAt: '2026-08-06T09:00:00.000Z', motivoEntrada: 'sem_vagas' }) },
      [chave('saiu@previ.com.br')]: { 'lista:evA': fila('SAIU DA FILA', 'saiu@previ.com.br', 'evA', '2026-08-02T09:00:00.000Z', { removed: true, removedBySelf: true, removedDate: '2026-08-30T09:00:00.000Z' }) },
      [chave('outro@previ.com.br')]: { 'lista:evB': fila('OUTRO EVENTO', 'outro@previ.com.br', 'evB', '2026-08-02T09:00:00.000Z') }
    },
    eventos: {
      evA: { nome: 'EPISÓDIO A – O COMEÇO', order: 1, publicado: true, cargaHoraria: '12', esperaAtiva: false },
      evB: { nome: 'EPISÓDIO B – A SEQUÊNCIA', order: 2, publicado: true, cargaHoraria: '8', esperaAtiva: true }
    },
    turmas: {
      tA1: { label: 'Turma 1', eventoKey: 'evA', order: 1, dias: ['2026-09-11', '2026-09-10'] },
      tA2: { label: 'Turma 2', eventoKey: 'evA', order: 2, dias: ['2026-10-24'] },
      tA3: { label: 'Turma 3', eventoKey: 'evA', order: 3, dias: ['2026-11-24'] },
      tB1: { label: 'Turma 1', eventoKey: 'evB', order: 4, dias: ['2026-12-01'] }
    },
    'turmas-interesse': {}, 'turmas-interesse-log': {}, 'turmas-config': {},
    'turmas-checkin': {}, 'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {}, 'turmas-sorteio': {},
    avaliacoes: {}, pedidos: {}, holocron: {}
  };
}

/* a planilha: separador ';' e aspas só onde precisa */
function lerCsv(texto) {
  return texto.replace(/^﻿/, '').split('\r\n').map((l) => {
    const c = []; let a = '', q = false;
    for (let i = 0; i < l.length; i++) {
      const x = l[i];
      if (q) { if (x === '"' && l[i + 1] === '"') { a += '"'; i++; } else if (x === '"') q = false; else a += x; } else if (x === '"') q = true; else if (x === ';') { c.push(a); a = ''; } else a += x;
    }
    c.push(a); return c;
  });
}
async function baixar(page) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('[data-ev-key="evA"] .espera-exp-excel')]);
  const p = await dl.path();
  return { nome: dl.suggestedFilename(), linhas: lerCsv(fs.readFileSync(p, 'utf8')) };
}

(async () => {
  const browser = await chromium.launch();
  let falhas = 0, oks = 0;
  const anota = (r, ok, d) => { if (ok) { oks++; console.log('  ok    ' + r); } else { falhas++; console.error('  FALHA ' + r + (d ? ' — ' + d : '')); } };
  try {
    for (const [nome, opt] of [
      ['Desktop', { viewport: { width: 1280, height: 800 }, acceptDownloads: true }],
      ['375 px', { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, acceptDownloads: true }]
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
      await esperarCondicao(page, () => !!document.querySelector('[data-ev-key="evA"] .espera-exportar'), null, { limite: 15000, descricao: 'a barra de exportação' });
      await page.evaluate(() => { const ev = document.querySelector('[data-ev-key="evA"]'), b = ev.querySelector('.espera-exportar'); if (b.offsetParent === null) ev.querySelector('.ev-toggle-icon').click(); });
      await page.waitForSelector('[data-ev-key="evA"] .espera-exp-excel', { state: 'visible', timeout: 10000 });
      const escritasAntes = await page.evaluate(() => (window.__ESCRITAS || []).filter((e) => /^(fa-espera|turmas|eventos)/.test(e.path)).length);

      /* 1. a ordem na tela */
      const tela = await page.evaluate(() => {
        const sec = document.querySelector('[data-ev-key="evA"] .ev-espera-section'), tabela = sec.querySelector('.espera-exportar + .table-scroll-wrap table');
        return Array.from(tabela.querySelectorAll('tbody tr')).map((tr) => ({ nome: tr.children[0].textContent, data: tr.children[3].textContent, origem: tr.children[5].textContent }));
      });
      anota(nome + ': a tabela está em ordem alfabética, com o acento no lugar certo', JSON.stringify(tela.map((x) => x.nome)) === JSON.stringify(ORDEM), JSON.stringify(tela));
      const maria = tela.filter((x) => x.nome === 'MARIA NEVES');
      anota(nome + ': as linhas da mesma pessoa ficam juntas, da mais antiga para a mais nova', /Turma 1/.test(maria[0].origem) && /Turma 2/.test(maria[1].origem), JSON.stringify(maria));

      /* 2. o recorte */
      const opcoes = await page.evaluate(() => Array.from(document.querySelectorAll('[data-ev-key="evA"] .espera-exp-recorte option')).map((o) => o.textContent));
      anota(nome + ': o recorte tem o evento inteiro, a entrada direta e só as turmas de que alguém veio', JSON.stringify(opcoes) === JSON.stringify(['Evento inteiro', 'Entrou pela lista', 'Turma 1', 'Turma 2']), JSON.stringify(opcoes));

      /* 3. Excel do evento inteiro */
      const tudo = await baixar(page);
      const cab = tudo.linhas[0], corpo = tudo.linhas.slice(1), col = (n) => cab.indexOf(n);
      anota(nome + ': o Excel tem as mesmas linhas e a mesma ordem da tela', JSON.stringify(corpo.map((l) => l[col('Nome')])) === JSON.stringify(ORDEM), JSON.stringify(corpo.map((l) => l[col('Nome')])));
      anota(nome + ': o Excel não traz quem saiu da fila nem quem espera por outro evento', !JSON.stringify(corpo).match(/SAIU DA FILA|OUTRO EVENTO/));
      const alvaro = corpo[0];
      anota(nome + ': o Excel traz evento, origem, data da turma, motivo, e-mail, data do interesse e de remoção',
        alvaro[col('Evento')] === 'EPISÓDIO A – O COMEÇO' && alvaro[col('Origem')] === 'Turma 1' && alvaro[col('Data da turma de origem')] === '10/09/2026, 11/09/2026' && !!alvaro[col('Motivo')] &&
        alvaro[col('E-mail')] === 'alvaro@previ.com.br' && /05\/08\/2026/.test(alvaro[col('Data interesse')]) && /06\/08\/2026/.test(alvaro[col('Data remoção')]), JSON.stringify(alvaro));
      anota(nome + ': quem entrou pela lista sai sem data de remoção', corpo[1][col('Origem')] === 'Entrou pela lista' && corpo[1][col('Data remoção')] === '', JSON.stringify(corpo[1]));
      anota(nome + ': o arquivo tem o nome do evento e a data', /^lista-espera-episodio-a-o-comeco-\d{4}-\d{2}-\d{2}\.csv$/.test(tudo.nome), tudo.nome);

      /* 4. Excel de uma turma */
      await page.selectOption('[data-ev-key="evA"] .espera-exp-recorte', { label: 'Turma 1' });
      const t1 = await baixar(page);
      anota(nome + ': o Excel da turma traz só quem veio dela', JSON.stringify(t1.linhas.slice(1).map((l) => l[col('Nome')])) === JSON.stringify(['ÁLVARO DIAS', 'MARIA NEVES']), JSON.stringify(t1.linhas.slice(1)));
      anota(nome + ': o arquivo da turma tem a turma no nome', /^lista-espera-episodio-a-o-comeco-turma-1-/.test(t1.nome), t1.nome);

      /* 5. a folha de impressão da turma */
      const [folhaT] = await Promise.all([ctx.waitForEvent('page', { timeout: 15000 }), page.click('[data-ev-key="evA"] .espera-exp-pdf')]);
      await folhaT.waitForSelector('#le-print-btn');
      const fT = await folhaT.evaluate(() => ({ meta: document.querySelector('.le-meta').textContent, nomes: Array.from(document.querySelectorAll('tbody tr')).map((tr) => tr.children[1].textContent), titulo: document.title }));
      anota(nome + ': a folha da turma diz evento, origem e total, com as linhas certas',
        /EPISÓDIO A – O COMEÇO/.test(fT.meta) && /Origem: Turma 1/.test(fT.meta) && /Total: 2 pessoas/.test(fT.meta) && /Gerado em:/.test(fT.meta) && JSON.stringify(fT.nomes) === JSON.stringify(['ÁLVARO DIAS', 'MARIA NEVES']) && /Turma 1/.test(fT.titulo), JSON.stringify(fT));
      await folhaT.close();

      await page.selectOption('[data-ev-key="evA"] .espera-exp-recorte', 'todas');
      const [folha] = await Promise.all([ctx.waitForEvent('page', { timeout: 15000 }), page.click('[data-ev-key="evA"] .espera-exp-pdf')]);
      await folha.waitForSelector('#le-print-btn');
      const f = await folha.evaluate(() => { window.__imprimiu = 0; window.print = () => { window.__imprimiu++; }; document.getElementById('le-print-btn').click();
        return { meta: document.querySelector('.le-meta').textContent, nomes: Array.from(document.querySelectorAll('tbody tr')).map((tr) => tr.children[1].textContent), imagens: document.querySelectorAll('img').length, xss: !!window.__XSS, imprimiu: window.__imprimiu, areaBruno: document.querySelectorAll('tbody tr')[1].children[3].textContent, lateral: document.documentElement.scrollWidth <= window.innerWidth + 1 }; });
      anota(nome + ': a folha do evento inteiro tem as mesmas linhas da tela e conta pessoas e registros', JSON.stringify(f.nomes) === JSON.stringify(ORDEM) && /Total: 4 pessoas · 5 registros/.test(f.meta) && !/Origem:/.test(f.meta), JSON.stringify(f));
      anota(nome + ': o texto vai escapado na folha', f.imagens === 0 && !f.xss && /<img/.test(f.areaBruno), JSON.stringify(f));
      anota(nome + ': o botão da folha chama a impressão', f.imprimiu === 1, JSON.stringify(f));
      anota(nome + ': a folha não rola para o lado', f.lateral, JSON.stringify(f));
      /* o que sai no papel: sem o botão, e um PDF de verdade */
      await folha.emulateMedia({ media: 'print' });
      const botaoNoPapel = await folha.evaluate(() => getComputedStyle(document.querySelector('.le-actions')).display !== 'none');
      const pdf = await folha.pdf({ preferCSSPageSize: true });
      anota(nome + ': o botão não sai no papel, e a folha gera um PDF', !botaoNoPapel && pdf.slice(0, 5).toString() === '%PDF-' && pdf.length > 1000, 'botão: ' + botaoNoPapel + ', ' + pdf.length + ' bytes');
      if (process.env.FA_SHOTS) fs.writeFileSync(path.join(process.env.FA_SHOTS, 'fila-exp-' + opt.viewport.width + '.pdf'), pdf);
      await folha.close();

      /* 6. pop-up bloqueado */
      await page.evaluate(() => { window.__openReal = window.open; window.open = () => null; });
      await page.click('[data-ev-key="evA"] .espera-exp-pdf');
      await esperarCondicao(page, () => /bloqueador de pop-ups/.test(document.body.textContent), null, { limite: 8000, descricao: 'o aviso do pop-up' });
      anota(nome + ': com o pop-up bloqueado, o painel avisa', true);
      await page.evaluate(() => { window.open = window.__openReal; const b = document.querySelector('.modal-overlay:not([hidden]) button'); if (b) b.click(); });

      /* 7. nada gravado e tela */
      const fim = await page.evaluate(() => {
        const b = document.querySelector('[data-ev-key="evA"] .espera-exportar').getBoundingClientRect();
        return { escritas: (window.__ESCRITAS || []).filter((e) => /^(fa-espera|turmas|eventos)/.test(e.path)).length, lateral: document.documentElement.scrollWidth <= window.innerWidth + 1, cabe: b.right <= window.innerWidth + 1 && b.left >= 0 };
      });
      anota(nome + ': nada é gravado', fim.escritas === escritasAntes, JSON.stringify(fim));
      anota(nome + ': a barra cabe na tela, sem rolagem lateral da página', fim.lateral && fim.cabe, JSON.stringify(fim));
      if (process.env.FA_SHOTS) { await page.locator('[data-ev-key="evA"] .ev-espera-section').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(process.env.FA_SHOTS, 'fila-exp-' + opt.viewport.width + '.png') }); }
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
