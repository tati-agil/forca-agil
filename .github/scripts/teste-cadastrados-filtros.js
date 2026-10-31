/* ADMIN › Cadastrados: leitura de uma lista extensa — cabeçalho fixo, filtros combináveis, ordenação e Excel.
 *
 * POR QUE ESTE TESTE EXISTE
 * Ao rolar uma lista de centenas de cadastros, os títulos das oito colunas sumiam (a tabela estava dentro de caixas com
 * overflow próprio, que anulam o position: sticky), e não havia como recortar a lista por área, confirmação, liberação
 * ou data. Os filtros novos reaproveitam os MESMOS critérios da linha (situacaoCadastro, confirmacaoCadastro,
 * liberacaoCadastro) — este teste prova que cada filtro, sozinho ou combinado, devolve exatamente o conjunto certo, e
 * que o Excel baixa esse conjunto, na ordem da tela.
 *
 * Firebase falso, dados 100% fictícios. Exige:
 *   1. computador (1366 e 1024 px), com 60+ cadastros rolados até o meio: o cabeçalho fica visível logo abaixo do menu
 *      fixo, com fundo opaco, sem rolagem vertical interna nem lateral; o foco do teclado num botão de linha nunca fica
 *      atrás do cabeçalho;
 *   2. filtros isolados (situação, área, confirmação, liberação, liberado por, data: hoje/7/30/intervalo, busca) e
 *      combinados devolvem os conjuntos esperados; resultado vazio avisa e o Excel não baixa nada; o contador bate;
 *      "Limpar filtros" volta ao padrão;
 *   3. as opções de Área, Confirmação, Liberação e Liberado por saem só do que está gravado;
 *   4. ordenação por nome, cadastro e liberação; o Excel traz o conjunto filtrado na ordem da tela;
 *   5. celular (375 px): cartões com o rótulo de cada campo, filtros utilizáveis, nada rola para o lado;
 *   6. nenhum erro de JavaScript; nada é gravado.
 */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const XLSX = require(path.join(__dirname, '..', '..', 'forca-agil', 'xlsx.mini.min.js'));
const { verificarTela } = require('./padrao-visual-verificacoes');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const ADM = 'adm.exemplo@previ.com.br', OUTRA = 'outra.exemplo@previ.com.br';
const DIA = 864e5;
/* datas relativas ao dia de hoje (fuso local, o mesmo do navegador) */
const meioDia = (diasAtras) => { const d = new Date(); d.setHours(12, 0, 0, 0); return new Date(d.getTime() - diasAtras * DIA).toISOString(); };
const hojeCedo = () => { const d = new Date(); d.setHours(0, 30, 0, 0); return d.toISOString(); };
const ymd = (diasAtras) => { const d = new Date(Date.now() - diasAtras * DIA); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

const e = (n) => n + '.exemplo@previ.com.br';
function base() {
  const u = {};
  const pessoa = (email, nome, area, extra) => { u[chave(email)] = Object.assign({ email, name: nome, area }, extra); };
  pessoa(ADM, 'ADMIN EXEMPLO', 'INFOR', { createdAt: meioDia(100), adminApproved: true, emailConfirmado: true, emailConfirmadoEm: Date.now() - 2 * DIA });
  pessoa(e('a1'), 'PESSOA A1', 'GECAT', { createdAt: hojeCedo(), emailVerificationRequired: true });
  pessoa(e('a2'), 'PESSOA A2', 'INFOR', { createdAt: meioDia(3), emailVerificationRequired: true, emailConfirmado: true, emailConfirmadoEm: Date.now() - DIA });
  pessoa(e('a3'), 'PESSOA A3', 'GECAT', { createdAt: meioDia(20), emailVerificationRequired: true, emailConfirmado: true, adminApproved: true, approvedAt: meioDia(15), approvedByAdmin: ADM, approvedByAdminName: 'ADMIN EXEMPLO' });
  pessoa(e('a4'), 'PESSOA A4', 'DIRAD', { createdAt: meioDia(60), adminApproved: true, createdByAdmin: ADM });
  pessoa(e('a5'), 'PESSOA A5', 'INFOR', { createdAt: meioDia(70), adminApproved: true });
  pessoa(e('a6'), 'PESSOA A6', 'GECAT', { createdAt: meioDia(5), emailVerificationRequired: true, blocked: true });
  pessoa(e('a7'), 'PESSOA A7', 'GERAT', { createdAt: meioDia(10), emailVerificationRequired: true, adminApproved: true, approvedAt: meioDia(2), approvedByAdmin: OUTRA, approvedByAdminName: 'OUTRA ADMIN' });
  return u;
}
/* 60 a mais, todas "Sem liberação" e confirmadas, com nomes que ordenam DEPOIS dos casos acima (ZZ…), para a rolagem */
function muitos() {
  const u = base();
  for (let i = 0; i < 60; i++) {
    const em = 'zz.lista.exemplo.' + i + '@previ.com.br';
    u[chave(em)] = { email: em, name: 'ZZ LISTA EXEMPLO ' + String(i).padStart(2, '0'), area: 'GECAT', createdAt: meioDia(40), emailVerificationRequired: true, emailConfirmado: true, emailConfirmadoEm: Date.now() - DIA };
  }
  return u;
}
function banco(users) {
  const admins = {}; admins[chave(ADM)] = { email: ADM, name: 'ADMIN EXEMPLO' };
  return { 'fa-users': users, 'fa-admins': admins, 'fa-diretores': {}, 'fa-facilitadores': {}, 'fa-users-log': {}, 'fa-progress': {},
    'fa-progress-historico': {}, 'fa-reset-signal': {}, 'fa-espera': {}, eventos: {}, turmas: {}, 'turmas-interesse': {}, 'turmas-interesse-log': {},
    'turmas-config': {}, 'turmas-checkin': {}, 'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {}, 'turmas-sorteio': {}, avaliacoes: {}, pedidos: {}, holocron: {} };
}

async function abrir(browser, opts, users) {
  const ctx = await browser.newContext(Object.assign({ acceptDownloads: true }, opts));
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (x) => erros.push(String(x).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify({ db: banco(users), user: { email: ADM, emailVerified: true, uid: 'u1' }, delayDefault: 20 }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.admin-tab-btn', { timeout: 15000 });
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('.admin-tab-btn')).find((x) => /Cadastrados/i.test(x.textContent)); if (b) b.click(); });
  await page.waitForSelector('.cad-mais-btn', { timeout: 15000 });
  return { ctx, page, erros };
}
const emailsNaTela = (page) => page.$$eval('#adminCadastrados tbody tr td[data-label="E-mail"]', (tds) => tds.map((t) => t.textContent.trim()));
async function status(page, s) { await page.click('.admin-status-btn[data-status="' + s + '"]'); }
async function abrirMais(page) { const aberto = await page.$eval('#cadMaisFiltros', (d) => d.open); if (!aberto) await page.click('#cadMaisFiltros > summary'); }
async function escolher(page, id, valor) { await abrirMais(page); await page.selectOption('#' + id, valor); }
async function limpar(page) { if (await page.isVisible('#cadLimparFiltros')) await page.click('#cadLimparFiltros'); }
async function baixar(page) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('#cadastradosExportarBtn')]);
  const arq = path.join(require('os').tmpdir(), 'cadf-' + process.pid + '-' + Date.now() + '.xlsx');
  await dl.saveAs(arq);
  const wb = XLSX.read(fs.readFileSync(arq), { type: 'buffer' }); fs.unlinkSync(arq);
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
}
const ord = (a) => JSON.stringify(a.slice().sort());

(async () => {
  const browser = await chromium.launch();
  const falhas = [];
  function registrar(nome, p) {
    if (p.length) { falhas.push(nome + ' → ' + p.join('; ')); console.log('  FALHA ' + nome + ' → ' + p.join('; ')); }
    else console.log('  ok    ' + nome);
  }

  /* 1. Cabeçalho fixo e foco, no computador */
  for (const w of [1366, 1024]) {
    console.log('\n===== CABEÇALHO FIXO — ' + w + ' px =====');
    const { ctx, page, erros } = await abrir(browser, { viewport: { width: w, height: 800 } }, muitos());
    await status(page, 'todos');
    const p = [];
    /* a página rola com scroll-behavior: smooth — aqui a rolagem é instantânea, e só depois se mede */
    await page.evaluate(() => { const r = document.querySelector('#adminCadastrados table').getBoundingClientRect(); window.scrollTo({ top: window.scrollY + r.top + r.height / 2 - innerHeight / 2, behavior: 'instant' }); });
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => {
      const wrap = document.querySelector('#adminCadastrados .table-scroll-wrap'), tbl = wrap.querySelector('table');
      const th = tbl.querySelector('thead th'), tr = th.getBoundingClientRect(), nav = document.querySelector('.nav').getBoundingClientRect();
      const quem = document.elementFromPoint(tr.left + 8, tr.top + tr.height / 2);
      const bg = getComputedStyle(th).backgroundColor;
      return { thTop: tr.top, thAltura: tr.height, navBottom: nav.bottom, visivel: !!quem && th.contains(quem), bg,
        internaV: wrap.scrollHeight > wrap.clientHeight + 1 && getComputedStyle(wrap).overflowY !== 'visible',
        lado: wrap.scrollWidth > wrap.clientWidth + 1 || document.documentElement.scrollWidth > innerWidth + 1,
        cortados: Array.from(tbl.querySelectorAll('tbody button')).filter((b) => b.getBoundingClientRect().right > wrap.getBoundingClientRect().right + 0.5).length,
        titulos: Array.from(tbl.querySelectorAll('thead th')).map((t) => t.textContent.trim()) };
    });
    if (Math.abs(m.thTop - m.navBottom) > 1.5) p.push('cabeçalho não está logo abaixo do menu (topo ' + m.thTop + ', menu termina em ' + m.navBottom + ')');
    if (!m.visivel) p.push('cabeçalho escondido (atrás do menu ou fora da tela) no meio da lista');
    if (!/^rgb\(/.test(m.bg)) p.push('fundo do cabeçalho não é opaco: ' + m.bg);
    if (m.thAltura > 70) p.push('cabeçalho alto demais: ' + m.thAltura + 'px');
    if (m.internaV) p.push('a tabela criou rolagem vertical interna');
    if (m.lado) p.push('rolagem lateral');
    if (m.cortados) p.push(m.cortados + ' botão(ões) cortado(s)');
    if (JSON.stringify(m.titulos) !== JSON.stringify(['Nome', 'E-mail', 'Área', 'Cadastro em', 'Confirmou o e-mail?', 'Liberado em', 'Situação', 'Ações'])) p.push('títulos: ' + m.titulos.join(' | '));
    registrar(w + ' px: no meio da lista, os títulos das 8 colunas ficam visíveis logo abaixo do menu, fundo opaco, sem rolagem interna nem lateral', p);

    /* foco: um botão de linha que ficou para trás (acima) recebe o foco — tem que aparecer abaixo do cabeçalho */
    const q = [];
    const f = await page.evaluate(() => {
      const th = document.querySelector('#adminCadastrados thead th');
      const acima = Array.from(document.querySelectorAll('#adminCadastrados tbody .admin-edit-cad-btn')).filter((b) => b.getBoundingClientRect().bottom < th.getBoundingClientRect().top).pop();
      if (!acima) return { semAlvo: true };
      acima.focus();
      return { focado: document.activeElement === acima };
    });
    /* o foco rola a página com scroll-behavior: smooth — mede depois que a rolagem termina */
    const posicao = async () => { await page.waitForTimeout(800); return page.evaluate(() => { const a = document.activeElement, th = document.querySelector('#adminCadastrados thead th');
      return { emLinha: !!(a && a.closest('#adminCadastrados tbody')), botaoTop: a.getBoundingClientRect().top, thBottom: th.getBoundingClientRect().bottom }; }); };
    if (f.semAlvo) q.push('não havia linha acima para testar o foco');
    else {
      const r = await posicao();
      if (!f.focado || r.botaoTop < r.thBottom - 1) q.push('o botão focado ficou atrás do cabeçalho (botão em ' + r.botaoTop + ', cabeçalho termina em ' + r.thBottom + ')');
      /* subindo pela lista com Shift+Tab: cada botão focado aparece abaixo do cabeçalho */
      for (let i = 0; i < 4; i++) {
        await page.keyboard.press('Shift+Tab');
        const t = await posicao();
        if (t.emLinha && t.botaoTop < t.thBottom - 1) { q.push('Shift+Tab levou o foco para trás do cabeçalho (' + t.botaoTop + ' < ' + t.thBottom + ')'); break; }
      }
    }
    if (erros.length) q.push('erro JS: ' + erros[0]);
    registrar(w + ' px: foco do teclado nunca fica atrás do cabeçalho fixo', q);
    await ctx.close();
  }

  /* 2–4. Filtros, opções, ordenação e Excel */
  console.log('\n===== FILTROS (1366 px) =====');
  {
    const { ctx, page, erros } = await abrir(browser, { viewport: { width: 1366, height: 900 } }, base());
    const casos = [
      ['situação Ativos (padrão)', async () => {}, [ADM, e('a1'), e('a2'), e('a3'), e('a4'), e('a5'), e('a7')]],
      ['situação Pendentes', async () => status(page, 'pendentes'), [e('a1')]],
      ['situação Bloqueados', async () => status(page, 'bloqueados'), [e('a6')]],
      ['situação Todos', async () => status(page, 'todos'), [ADM, e('a1'), e('a2'), e('a3'), e('a4'), e('a5'), e('a6'), e('a7')]],
      ['área GECAT (Ativos)', async () => escolher(page, 'cadFiltroArea', 'GECAT'), [e('a1'), e('a3')]],
      ['confirmação: Sim', async () => escolher(page, 'cadFiltroConf', 'confirmado'), [ADM, e('a2'), e('a3')]],
      ['confirmação: Não registrada', async () => escolher(page, 'cadFiltroConf', 'sem-registro'), [e('a1'), e('a7')]],
      ['confirmação: Não exigida', async () => escolher(page, 'cadFiltroConf', 'nao-exigida'), [e('a4'), e('a5')]],
      ['liberação: pelo admin', async () => escolher(page, 'cadFiltroLib', 'liberado'), [e('a3'), e('a7')]],
      ['liberação: conta criada pelo admin', async () => escolher(page, 'cadFiltroLib', 'criado'), [e('a4')]],
      ['liberação: antiga, sem data nem autor', async () => escolher(page, 'cadFiltroLib', 'antiga'), [ADM, e('a5')]],
      ['liberação: sem liberação', async () => escolher(page, 'cadFiltroLib', 'nenhuma'), [e('a1'), e('a2')]],
      ['liberado por ADMIN EXEMPLO', async () => escolher(page, 'cadFiltroPor', ADM), [e('a3'), e('a4')]],
      ['liberado por OUTRA ADMIN', async () => escolher(page, 'cadFiltroPor', OUTRA), [e('a7')]],
      ['cadastro hoje', async () => escolher(page, 'cadFiltroData', 'hoje'), [e('a1')]],
      ['cadastro últimos 7 dias', async () => escolher(page, 'cadFiltroData', '7'), [e('a1'), e('a2')]],
      ['cadastro últimos 30 dias', async () => escolher(page, 'cadFiltroData', '30'), [e('a1'), e('a2'), e('a3'), e('a7')]],
      ['cadastro no intervalo (25 a 8 dias atrás)', async () => { await escolher(page, 'cadFiltroData', 'intervalo'); await page.fill('#cadFiltroDe', ymd(25)); await page.fill('#cadFiltroAte', ymd(8)); }, [e('a3'), e('a7')]],
      ['busca "a7.exemplo"', async () => page.fill('#cadastradosFiltro', 'a7.exemplo'), [e('a7')]],
      ['combinado: Todos + GECAT + Não registrada', async () => { await status(page, 'todos'); await escolher(page, 'cadFiltroArea', 'GECAT'); await escolher(page, 'cadFiltroConf', 'sem-registro'); }, [e('a1'), e('a6')]],
      ['combinado: Todos + GECAT + Não registrada + busca "a6"', async () => { await status(page, 'todos'); await escolher(page, 'cadFiltroArea', 'GECAT'); await escolher(page, 'cadFiltroConf', 'sem-registro'); await page.fill('#cadastradosFiltro', 'a6'); }, [e('a6')]],
      ['combinado: liberado pelo admin + últimos 30 dias + área GERAT', async () => { await escolher(page, 'cadFiltroLib', 'liberado'); await escolher(page, 'cadFiltroData', '30'); await escolher(page, 'cadFiltroArea', 'GERAT'); }, [e('a7')]],
      ['combinado sem resultado: DIRAD + Sim', async () => { await escolher(page, 'cadFiltroArea', 'DIRAD'); await escolher(page, 'cadFiltroConf', 'confirmado'); }, []],
    ];
    for (const [nome, acao, esperado] of casos) {
      await limpar(page);
      await acao();
      await page.waitForTimeout(120);
      const tela = await emailsNaTela(page);
      const p = [];
      if (ord(tela) !== ord(esperado)) p.push('mostrou ' + JSON.stringify(tela) + ', esperado ' + JSON.stringify(esperado));
      const r = await page.evaluate(() => ({ txt: document.getElementById('cadastradosResultado').textContent, badge: document.getElementById('cadastradosBadge').textContent,
        vazio: !document.getElementById('cadastradosVazio').hidden, limpar: !document.getElementById('cadLimparFiltros').hidden }));
      if (!new RegExp('^' + esperado.length + ' cadastros? encontrados? de 8$').test(r.txt) || +r.badge !== esperado.length) p.push('contador: "' + r.txt + '" / ' + r.badge);
      if (r.vazio !== (esperado.length === 0)) p.push('aviso de lista vazia ' + (r.vazio ? 'aparece' : 'não aparece'));
      if (nome !== 'situação Ativos (padrão)' && !r.limpar) p.push('"Limpar filtros" não aparece com filtro ativo');
      if (esperado.length) {
        const xs = await baixar(page);
        if (ord(xs.map((x) => x['E-mail'])) !== ord(esperado)) p.push('Excel: ' + JSON.stringify(xs.map((x) => x['E-mail'])));
      } else {
        await page.click('#cadastradosExportarBtn');
        if (!/Nada a exportar/.test(await page.textContent('#cadastradosExportMsg'))) p.push('lista vazia não avisou "Nada a exportar"');
      }
      registrar('filtro — ' + nome, p);
    }

    /* De/Até só aparecem com "Intervalo…" */
    {
      const p = [];
      await limpar(page); await abrirMais(page);
      const vis = () => page.evaluate(() => ['cadFiltroDe', 'cadFiltroAte'].map((id) => !!document.getElementById(id).offsetParent));
      if ((await vis()).some(Boolean)) p.push('De/Até visíveis sem "Intervalo…"');
      await page.selectOption('#cadFiltroData', 'intervalo');
      if (!(await vis()).every(Boolean)) p.push('De/Até não aparecem com "Intervalo…"');
      await page.selectOption('#cadFiltroData', '7');
      if ((await vis()).some(Boolean)) p.push('De/Até continuam visíveis depois de trocar o período');
      registrar('campos De/Até só aparecem com "Intervalo…"', p);
    }

    /* Limpar filtros volta ao padrão */
    {
      const p = [];
      await status(page, 'todos'); await escolher(page, 'cadFiltroArea', 'GECAT'); await page.selectOption('#cadOrdem', 'cadastro-antigo'); await page.fill('#cadastradosFiltro', 'pessoa');
      await page.click('#cadLimparFiltros');
      const r = await page.evaluate(() => ({ status: document.querySelector('.admin-status-btn.active').dataset.status, area: document.getElementById('cadFiltroArea').value,
        ordem: document.getElementById('cadOrdem').value, q: document.getElementById('cadastradosFiltro').value, limpar: !document.getElementById('cadLimparFiltros').hidden,
        ativos: document.getElementById('cadFiltrosAtivos').textContent }));
      if (r.status !== 'ativos' || r.area || r.ordem !== 'nome' || r.q || r.limpar || r.ativos) p.push(JSON.stringify(r));
      if ((await emailsNaTela(page)).length !== 7) p.push('não voltou aos 7 ativos');
      registrar('"Limpar filtros" volta ao padrão (Ativos, sem filtros, por nome) e some', p);
    }

    /* 3. Opções só do que está gravado */
    {
      const p = [];
      const o = await page.evaluate(() => { const v = (id) => Array.from(document.querySelectorAll('#' + id + ' option')).filter((x) => x.value).map((x) => x.value + '=' + x.textContent); return { area: v('cadFiltroArea'), conf: v('cadFiltroConf'), lib: v('cadFiltroLib'), por: v('cadFiltroPor') }; });
      if (JSON.stringify(o.area.map((x) => x.split('=')[0])) !== JSON.stringify(['DIRAD', 'GECAT', 'GERAT', 'INFOR'])) p.push('áreas: ' + o.area.join(', '));
      if (JSON.stringify(o.conf.map((x) => x.split('=')[0]).sort()) !== JSON.stringify(['confirmado', 'nao-exigida', 'sem-registro'])) p.push('confirmação: ' + o.conf.join(', '));
      if (JSON.stringify(o.lib.map((x) => x.split('=')[0]).sort()) !== JSON.stringify(['antiga', 'criado', 'liberado', 'nenhuma'])) p.push('liberação: ' + o.lib.join(', '));
      if (JSON.stringify(o.por) !== JSON.stringify([ADM + '=ADMIN EXEMPLO (2)', OUTRA + '=OUTRA ADMIN (1)'])) p.push('liberado por: ' + o.por.join(', '));
      registrar('opções de Área, Confirmação, Liberação e Liberado por vêm só dos dados (com contagem)', p);
    }

    /* 4. Ordenação e Excel na ordem da tela */
    {
      const p = [];
      await limpar(page); await status(page, 'todos');
      const ordens = {
        'nome': [ADM, e('a1'), e('a2'), e('a3'), e('a4'), e('a5'), e('a6'), e('a7')],
        'cadastro-recente': [e('a1'), e('a2'), e('a6'), e('a7'), e('a3'), e('a4'), e('a5'), ADM],
        'cadastro-antigo': [ADM, e('a5'), e('a4'), e('a3'), e('a7'), e('a6'), e('a2'), e('a1')],
        'liberacao-recente': [e('a7'), e('a3'), e('a4'), ADM, e('a1'), e('a2'), e('a5'), e('a6')],
        'liberacao-antiga': [e('a4'), e('a3'), e('a7'), ADM, e('a1'), e('a2'), e('a5'), e('a6')],
      };
      for (const [o, esperado] of Object.entries(ordens)) {
        await page.selectOption('#cadOrdem', o);
        const tela = await emailsNaTela(page);
        if (JSON.stringify(tela) !== JSON.stringify(esperado)) p.push(o + ': ' + JSON.stringify(tela));
        if (o === 'cadastro-recente') {
          const xs = await baixar(page);
          if (JSON.stringify(xs.map((x) => x['E-mail'])) !== JSON.stringify(esperado)) p.push('Excel fora da ordem/conjunto da tela: ' + JSON.stringify(xs.map((x) => x['E-mail'])));
        }
      }
      registrar('ordenação por nome, cadastro e liberação (sem data vai para o fim); Excel = conjunto e ordem da tela', p);
    }

    /* textos da liberação e da confirmação (as categorias distintas) */
    {
      const p = [];
      await limpar(page); await status(page, 'todos');
      const cel = await page.evaluate(() => { const o = {}; document.querySelectorAll('#adminCadastrados tbody tr').forEach((tr) => {
        const t = (l) => tr.querySelector('td[data-label="' + l + '"]').innerText.replace(/\s+/g, ' ').trim();
        o[t('E-mail')] = { conf: t('Confirmou o e-mail?'), lib: t('Liberado em') }; }); return o; });
      const exp = {
        [e('a1')]: [/^Não registrada$/, /^Sem liberação do admin$/],
        [e('a2')]: [/^Sim registrada em \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/, /^Sem liberação do admin$/],
        [e('a3')]: [/^Sim data não registrada$/, /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2} por ADMIN EXEMPLO$/],
        [e('a4')]: [/^Não exigida conta criada pelo admin$/, /^Conta criada pelo admin \d{2}\/\d{2}\/\d{4} \d{2}:\d{2} por ADMIN EXEMPLO$/],
        [e('a5')]: [/^Não exigida cadastro anterior à exigência$/, /^Liberação antiga sem data nem autor registrados$/],
        [e('a7')]: [/^Não registrada$/, /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2} por OUTRA ADMIN$/],
      };
      Object.keys(exp).forEach((k) => {
        const c = cel[k] || {};
        if (!exp[k][0].test(c.conf || '')) p.push(k + ' confirmação: "' + c.conf + '"');
        if (!exp[k][1].test(c.lib || '')) p.push(k + ' liberação: "' + c.lib + '"');
      });
      registrar('cada categoria de confirmação e de liberação tem um texto próprio, sem data inventada', p);
    }
    /* Padrão Visual Oficial (docs/padrao-visual.md): a área inteira, com "Mais filtros" aberto */
    await limpar(page); await abrirMais(page);
    const pv = await verificarTela(page, { escopo: '#adminCadastrados', largura: 1366, focos: 0 });
    registrar('Padrão Visual Oficial na área de Cadastrados (computador)', pv.map((x) => x.regra + ': ' + x.detalhe));
    const esc = await page.evaluate(() => (window.__ESCRITAS || []).filter((x) => /^fa-users/.test(x.path)).length);
    registrar('nada gravado no cadastro; nenhum erro de JavaScript', (esc ? ['gravou ' + esc] : []).concat(erros.length ? ['erro JS: ' + erros[0]] : []));
    await ctx.close();
  }

  /* 5. Celular */
  console.log('\n===== CELULAR (375 px) =====');
  {
    const { ctx, page, erros } = await abrir(browser, Object.assign({}, devices['iPhone 13'], { viewport: { width: 375, height: 812 } }), muitos());
    const p = [];
    await status(page, 'todos');
    const m = await page.evaluate(() => {
      const tr = document.querySelector('#adminCadastrados tbody tr');
      const rotulos = Array.from(tr.querySelectorAll('td')).map((td) => getComputedStyle(td, '::before').content.replace(/"/g, ''));
      const foraTela = Array.from(document.querySelectorAll('#adminCadastrados button, #adminCadastrados input, #adminCadastrados select, #adminCadastrados summary'))
        .filter((x) => x.offsetParent && x.getBoundingClientRect().right > innerWidth + 0.5).length;
      return { cabecalhoOculto: getComputedStyle(document.querySelector('#adminCadastrados thead')).display === 'none', rotulos,
        lado: document.documentElement.scrollWidth > innerWidth + 1, foraTela };
    });
    if (!m.cabecalhoOculto) p.push('no celular a tabela não virou cartão');
    const faltam = ['E-mail', 'Área', 'Cadastro em', 'Confirmou o e-mail?', 'Liberado em', 'Situação', 'Ações'].filter((r) => m.rotulos.indexOf(r) === -1);
    if (faltam.length) p.push('cartão sem rótulo: ' + faltam.join(', ') + ' (tem: ' + m.rotulos.join(' | ') + ')');
    if (m.lado) p.push('a página rola para o lado');
    if (m.foraTela) p.push(m.foraTela + ' controle(s) saindo da tela');
    await escolher(page, 'cadFiltroLib', 'liberado');
    const tela = await emailsNaTela(page);
    if (ord(tela) !== ord([e('a3'), e('a7')])) p.push('filtro no celular: ' + JSON.stringify(tela));
    const m2 = await page.evaluate(() => ({ lado: document.documentElement.scrollWidth > innerWidth + 1,
      fora: Array.from(document.querySelectorAll('#cadMaisFiltros select, #cadMaisFiltros input')).filter((x) => x.offsetParent && x.getBoundingClientRect().right > innerWidth + 0.5).length }));
    if (m2.lado || m2.fora) p.push('com "Mais filtros" aberto, algo sai da tela');
    (await verificarTela(page, { escopo: '#adminCadastrados', largura: 375, focos: 0 })).forEach((x) => p.push('padrão visual — ' + x.regra + ': ' + x.detalhe));
    if (erros.length) p.push('erro JS: ' + erros[0]);
    registrar('375 px: cartões com o rótulo de cada campo, filtros utilizáveis, nada rola para o lado', p);
    await ctx.close();
  }

  await browser.close();
  if (falhas.length) { console.error('\n' + falhas.length + ' falha(s):'); falhas.forEach((f) => console.error('  - ' + f)); process.exit(1); }
  console.log('\nTudo certo: cabeçalho fixo, filtros combináveis, ordenação, Excel e cartões no celular.');
})();
