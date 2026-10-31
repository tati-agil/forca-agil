/* ADMIN › Cadastrados: filtro "Pendentes", "Confirmação do e-mail", "Liberação administrativa" — e a anotação da confirmação no login.
 *
 * POR QUE ESTE TESTE EXISTE
 * O selo "Pendente" olhava só emailVerificationRequired && !adminApproved: quem confirmou pelo link do e-mail continuava
 * "Pendente" (o site nunca gravava a confirmação — ela só existia no Firebase Auth, que o painel não lê no plano
 * gratuito), e a admin liberava de novo quem já tinha confirmado. Agora o próprio site anota a confirmação no cadastro
 * (auth.js anotarEmailConfirmado) e o painel tem um critério só (admin.js situacaoCadastro) para o selo, o filtro, as
 * contagens, o menu "⋯" e o Excel. Confirmar o e-mail e ser liberada pelo admin continuam coisas separadas.
 *
 * Firebase falso (window.__ESCRITAS guarda cada escrita), desktop e celular (375 px). Exige:
 *   1. "Pendentes" lista só quem se cadastrou, não tem confirmação registrada, não foi liberada nem criada pelo admin e
 *      não está bloqueada; as contagens dos botões batem com as linhas de cada filtro e com o Excel;
 *   2. "Confirmação do e-mail" e "Liberação administrativa" mostram, para cada caso, o texto certo (sem data inventada);
 *   3. o Excel de cada filtro traz as mesmas pessoas e os mesmos textos da tela;
 *   4. "Confirmar cadastro" só aparece para quem precisa (não para quem confirmou o e-mail);
 *   5. a tabela não rola para o lado (1366 e 1024 px) e, no celular, cada pessoa vira cartão sem rolagem lateral;
 *   6. login: e-mail confirmado no Auth e cadastro sem a marca → grava UMA vez {emailConfirmado:true, emailConfirmadoEm:
 *      horário do servidor} no próprio cadastro; já anotado, não confirmado, bloqueado ou sem cadastro → não grava nada;
 *   7. nenhum erro de JavaScript não tratado.
 */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const XLSX = require(path.join(__dirname, '..', '..', 'forca-agil', 'xlsx.mini.min.js'));

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const ADM = 'adm@previ.com.br';
const QUANDO = Date.UTC(2026, 9, 30, 17, 2); /* emailConfirmadoEm gravado pelo servidor (número) */

/* Cada caso: o cadastro e o que a tela tem de mostrar. */
const CASOS = {
  'pendente@previ.com.br':   { c: { emailVerificationRequired: true }, sit: 'Pendente', conf: 'Não registrada', confEm: '', lib: 'nenhuma', orig: 'Autocadastro' },
  'link@previ.com.br':       { c: { emailVerificationRequired: true, emailConfirmado: true, emailConfirmadoEm: QUANDO }, sit: 'Ativo', conf: 'Sim', confEm: 'data', lib: 'nenhuma' },
  'antiga@previ.com.br':     { c: { emailVerificationRequired: true, emailConfirmado: true }, sit: 'Ativo', conf: 'Sim', confEm: 'data exata não registrada', lib: 'nenhuma' },
  'liberada@previ.com.br':   { c: { emailVerificationRequired: true, adminApproved: true, approvedAt: '2026-10-30T18:31:00.000Z', approvedByAdmin: ADM, approvedByAdminName: 'TATI ADMIN' }, sit: 'Ativo', conf: 'Não registrada', confEm: '', lib: 'data', libPor: 'ADMIN' },
  'semdata@previ.com.br':    { c: { emailVerificationRequired: true, adminApproved: true }, sit: 'Ativo', conf: 'Não registrada', confEm: '', lib: 'antiga' },
  /* quem liberou: com e-mail gravado, o nome ATUAL do cadastro desse e-mail (ADM = "ADMIN"), não o nome da época */
  'criada@previ.com.br':     { c: { adminApproved: true, createdByAdmin: ADM }, sit: 'Ativo', conf: 'Não exigida', confEm: '', lib: 'criada', libPor: 'ADMIN' },
  'ambas@previ.com.br':      { c: { emailVerificationRequired: true, emailConfirmado: true, emailConfirmadoEm: QUANDO, adminApproved: true, approvedAt: '2026-10-30T19:00:00.000Z', approvedByAdminName: 'TATI ADMIN' }, sit: 'Ativo', conf: 'Sim', confEm: 'data', lib: 'data', libPor: 'TATI ADMIN' },
  'bloqueada@previ.com.br':  { c: { emailVerificationRequired: true, blocked: true }, sit: 'Bloqueado', conf: 'Não registrada', confEm: '', lib: 'nenhuma' },
  'velha@previ.com.br':      { c: {}, sit: 'Ativo', conf: 'Não exigida', confEm: '', lib: 'nenhuma', orig: 'Não comprovada' },
  /* origem pelo fluxo da época: sem marca e criado antes de 14/08/2026 (o único caminho era o autocadastro) */
  'historica@previ.com.br': { c: { createdAt: '2026-07-01T12:00:00.000Z', adminApproved: true }, sit: 'Ativo', conf: 'Não exigida', confEm: '', lib: 'antiga', orig: 'Autocadastro (fluxo anterior a 14/08/2026)' },
};
const PENDENTES = ['pendente@previ.com.br'];

function banco(users) {
  const admins = {}; admins[chave(ADM)] = { email: ADM, name: 'ADMIN' };
  return {
    'fa-users': users, 'fa-admins': admins, 'fa-diretores': {}, 'fa-facilitadores': {},
    'fa-users-log': {}, 'fa-progress': {}, 'fa-progress-historico': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: {}, turmas: {}, 'turmas-interesse': {}, 'turmas-interesse-log': {},
    'turmas-config': {}, 'turmas-checkin': {}, 'turmas-publico': {}, 'eventos-publico': {},
    'turmas-equipe': {}, 'turmas-sorteio': {}, avaliacoes: {}, pedidos: {}, holocron: {},
  };
}
function usuarios() {
  const u = {}; u[chave(ADM)] = { name: 'ADMIN', email: ADM, area: 'INFOR', emailConfirmado: true, emailConfirmadoEm: QUANDO };
  Object.keys(CASOS).forEach((e, i) => { u[chave(e)] = Object.assign({ name: 'PESSOA ' + e.split('@')[0].toUpperCase(), email: e, area: 'GECAT', createdAt: '2026-10-0' + (i + 1) + 'T12:00:00.000Z' }, CASOS[e].c); });
  return u;
}

async function abrir(browser, opts, cfg, hash) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify(Object.assign({ delayDefault: 20 }, cfg)) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + hash, { waitUntil: 'domcontentloaded' });
  return { ctx, page, erros };
}
async function abrirCadastrados(browser, opts) {
  const r = await abrir(browser, opts, { db: banco(usuarios()), user: { email: ADM, emailVerified: true, uid: 'u1' } }, '#admin');
  await r.page.waitForSelector('.admin-tab-btn', { timeout: 15000 });
  await r.page.evaluate(() => { const b = Array.from(document.querySelectorAll('.admin-tab-btn')).find((x) => /Cadastrados/i.test(x.textContent)); if (b) b.click(); });
  await r.page.waitForSelector('.cad-mais-btn', { timeout: 15000 });
  return r;
}
async function filtrar(page, status) {
  await page.click('.admin-status-btn[data-status="' + status + '"]');
  await page.waitForTimeout(150);
}
/* O que a tabela mostra agora: por e-mail, os textos das colunas novas. */
function linhasDaTela(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('#adminCadastrados tbody tr')).map((tr) => {
    const cel = (l) => { const td = tr.querySelector('td[data-label="' + l + '"]'); return td ? td.innerText.replace(/\s+/g, ' ').trim() : null; };
    const origem = tr.querySelector('td[data-label="Cadastro e origem"] .cad-origem');
    return { email: cel('E-mail'), conf: cel('Confirmação do e-mail'), lib: cel('Liberação administrativa'), sit: cel('Situação'), orig: origem ? origem.textContent.trim() : null };
  }));
}
function contagens(page) {
  return page.evaluate(() => { const o = {}; document.querySelectorAll('.admin-status-btn').forEach((b) => { const m = b.textContent.match(/\((\d+)\)/); o[b.dataset.status] = m ? +m[1] : null; }); return o; });
}

const FORMATOS = [
  { nome: 'desktop', opts: { viewport: { width: 1366, height: 768 }, acceptDownloads: true } },
  { nome: 'celular', opts: Object.assign({}, devices['iPhone 13'], { viewport: { width: 375, height: 812 } }) },
];

(async () => {
  const browser = await chromium.launch();
  const falhas = [];
  let formatoAtual = '';
  function registrar(nome, problemas) {
    const linha = formatoAtual + ' · ' + nome;
    if (problemas.length) { falhas.push(linha + ' → ' + problemas.join('; ')); console.log('  FALHA ' + linha + ' → ' + problemas.join('; ')); }
    else console.log('  ok    ' + nome);
  }
  const dataRe = /\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/;
  /* origem do cadastro: explícita no caso, ou a marca que ele tem (criada pelo admin / autocadastro) */
  const origemEsperada = (k) => k.orig || (k.c.createdByAdmin ? 'Criada pelo administrador' : 'Autocadastro');
  function confere(p, e, l, origem) {
    const k = CASOS[e];
    if (!l) { p.push(origem + ': ' + e + ' ausente'); return; }
    const o = origem === 'tela' ? l.orig : l['Origem do cadastro'];
    if (o !== origemEsperada(k)) p.push(origem + ' ' + e + ' origem = "' + o + '" (esperado "' + origemEsperada(k) + '")');
    if (origem === 'tela') {
      if (!l.conf.startsWith(k.conf)) p.push(e + ' "Confirmação do e-mail" = ' + l.conf);
      if (k.confEm === 'data' && !dataRe.test(l.conf)) p.push(e + ' sem a data registrada: ' + l.conf);
      if (k.confEm && k.confEm !== 'data' && l.conf.indexOf(k.confEm) === -1) p.push(e + ' deveria dizer "' + k.confEm + '": ' + l.conf);
      if (!k.confEm && /\d/.test(l.conf)) p.push(e + ' mostra data de confirmação que não existe: ' + l.conf);
      if (k.lib === 'nenhuma' && l.lib !== 'Nenhuma') p.push(e + ' "Liberação administrativa" deveria ser "Nenhuma": ' + l.lib);
      if (k.lib === 'data' && !dataRe.test(l.lib)) p.push(e + ' "Liberação administrativa" sem data: ' + l.lib);
      if (k.lib === 'criada' && !/Conta criada pelo admin/.test(l.lib)) p.push(e + ' "Liberação administrativa": ' + l.lib);
      if (k.lib === 'antiga' && !/^Liberação antiga/.test(l.lib)) p.push(e + ' "Liberação administrativa" (antiga): ' + l.lib);
      if (k.libPor && l.lib.indexOf(k.libPor) === -1) p.push(e + ' sem quem liberou: ' + l.lib);
      if (l.sit.indexOf(k.sit === 'Bloqueado' ? 'Bloqueado' : 'Ativo') === -1 || (k.sit === 'Pendente') !== /Pendente/.test(l.sit)) p.push(e + ' situação: ' + l.sit);
    } else {
      if (l['Confirmação do e-mail'] !== k.conf) p.push('Excel ' + e + ' "Confirmação do e-mail" = ' + l['Confirmação do e-mail']);
      const ce = l['Confirmação registrada em'];
      if (k.confEm === 'data' ? !dataRe.test(ce) : ce !== k.confEm) p.push('Excel ' + e + ' "Confirmação registrada em" = ' + ce);
      const le = l['Liberação administrativa'];
      if (k.lib === 'nenhuma' ? le !== 'Nenhuma' : k.lib === 'antiga' ? le !== 'Liberação antiga, sem data nem autor' : k.lib === 'criada' ? !/^Conta criada pelo admin em /.test(le) : k.lib === 'data' ? !dataRe.test(le) : le !== k.lib) p.push('Excel ' + e + ' "Liberação administrativa" = ' + le);
      if ((k.libPor || '') !== l['Liberado por']) p.push('Excel ' + e + ' "Liberado por" = ' + l['Liberado por']);
      if (l['Situação'] !== k.sit) p.push('Excel ' + e + ' Situação = ' + l['Situação']);
    }
  }

  for (const formato of FORMATOS) {
    formatoAtual = formato.nome;
    console.log('\n===== ' + formato.nome.toUpperCase() + ' =====');

    /* 1–3. Filtros, colunas, contagens e Excel */
    {
      const { ctx, page, erros } = await abrirCadastrados(browser, formato.opts);
      const p = [];
      const total = Object.keys(CASOS).length + 1;
      const esperado = { ativos: total - 1, pendentes: PENDENTES.length, bloqueados: 1, todos: total };
      const cont = await contagens(page);
      if (JSON.stringify(cont) !== JSON.stringify(esperado)) p.push('contagens dos botões ' + JSON.stringify(cont) + ' ≠ ' + JSON.stringify(esperado));
      for (const st of ['ativos', 'pendentes', 'bloqueados', 'todos']) {
        await filtrar(page, st);
        const ls = await linhasDaTela(page);
        const badge = await page.$eval('#cadastradosBadge', (b) => +b.textContent);
        if (ls.length !== esperado[st] || badge !== esperado[st]) p.push(st + ': ' + ls.length + ' linhas, contador ' + badge + ', botão ' + esperado[st]);
        if (st === 'pendentes' && JSON.stringify(ls.map((l) => l.email).sort()) !== JSON.stringify(PENDENTES)) p.push('Pendentes mostra ' + ls.map((l) => l.email).join(', '));
        if (st === 'todos') Object.keys(CASOS).forEach((e) => confere(p, e, ls.find((l) => l.email === e), 'tela'));
        if (formato.nome === 'desktop') {
          const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('#cadastradosExportarBtn')]);
          const arq = path.join(require('os').tmpdir(), 'cadp-' + process.pid + '-' + Date.now() + '.xlsx');
          await dl.saveAs(arq);
          const wb = XLSX.read(fs.readFileSync(arq), { type: 'buffer' }); fs.unlinkSync(arq);
          const xs = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
          if (JSON.stringify(xs.map((x) => x['E-mail']).sort()) !== JSON.stringify(ls.map((l) => l.email).sort())) p.push('Excel de ' + st + ' traz pessoas diferentes da tela');
          if (st === 'todos') Object.keys(CASOS).forEach((e) => confere(p, e, xs.find((x) => x['E-mail'] === e), 'excel'));
        }
      }
      /* 5. sem rolagem lateral */
      await filtrar(page, 'todos');
      const lado = await page.evaluate(() => {
        const wrap = document.querySelector('#adminCadastrados .table-scroll-wrap');
        return { tabela: wrap.scrollWidth > wrap.clientWidth + 1, pagina: document.documentElement.scrollWidth > window.innerWidth + 1,
          /* a página esconde o que passa da borda: o botão cortado não faz rolar, então mede cada filtro */
          filtrosFora: Array.from(document.querySelectorAll('#adminCadastrados .admin-status-btn')).filter((b) => b.getBoundingClientRect().right > window.innerWidth - 1).map((b) => b.textContent) };
      });
      if (lado.filtrosFora.length) p.push('filtro(s) saindo da tela: ' + lado.filtrosFora.join(', '));
      if (lado.tabela) p.push('a tabela rola para o lado');
      if (lado.pagina) p.push('a página rola para o lado');
      if (erros.length) p.push('erro JS: ' + erros[0]);
      registrar('Pendentes, colunas, contagens' + (formato.nome === 'desktop' ? ' e Excel' : '') + ' coerentes; sem rolagem lateral', p);

      /* Origem do cadastro: o filtro (em Mais filtros) combina com a situação e devolve exatamente quem a célula diz */
      const r = [];
      const porOrigem = { admin: 'Criada pelo administrador', auto: 'Autocadastro', 'nao-comprovada': 'Não comprovada' };
      const opcoes = await page.$$eval('#cadFiltroOrigem option', (os) => os.map((o) => o.value + '=' + o.textContent));
      const todosCasos = Object.keys(CASOS);
      const contaOrig = (tipo) => todosCasos.filter((e) => origemEsperada(CASOS[e]).indexOf(porOrigem[tipo]) === 0).length;
      /* o ADMIN do banco não tem marca e foi criado sem data → "Não comprovada" */
      const esperadoOpcoes = ['=Todas', 'admin=Criada pelo administrador (' + contaOrig('admin') + ')', 'auto=Autocadastro (' + contaOrig('auto') + ')', 'nao-comprovada=Não comprovada (' + (contaOrig('nao-comprovada') + 1) + ')'];
      if (JSON.stringify(opcoes) !== JSON.stringify(esperadoOpcoes)) r.push('opções: ' + opcoes.join(' | '));
      if (!(await page.$eval('#cadMaisFiltros', (d) => d.open))) await page.click('#cadMaisFiltros > summary');
      for (const tipo of ['admin', 'auto', 'nao-comprovada']) {
        await page.selectOption('#cadFiltroOrigem', tipo);
        for (const st of ['todos', 'ativos', 'bloqueados']) {
          await filtrar(page, st);
          const ls = await linhasDaTela(page);
          const ruins = ls.filter((l) => l.orig.indexOf(porOrigem[tipo]) !== 0);
          const esperados = todosCasos.filter((e) => origemEsperada(CASOS[e]).indexOf(porOrigem[tipo]) === 0 && (st === 'todos' || (st === 'bloqueados') === (CASOS[e].sit === 'Bloqueado'))).length
            + (tipo === 'nao-comprovada' && st !== 'bloqueados' ? 1 : 0);
          if (ruins.length || ls.length !== esperados) r.push(tipo + '/' + st + ': ' + ls.length + ' linha(s), esperado ' + esperados + (ruins.length ? ', com origem diferente: ' + ruins.map((l) => l.email).join(', ') : ''));
        }
      }
      const ativosFiltro = await page.$eval('#cadFiltrosAtivos', (s) => s.textContent);
      if (!/1 ativo/.test(ativosFiltro)) r.push('"Mais filtros" não conta a origem como filtro ativo: ' + ativosFiltro);
      await page.click('#cadLimparFiltros');
      if ((await page.$eval('#cadFiltroOrigem', (s) => s.value)) !== '') r.push('"Limpar filtros" não limpou a origem');
      const ajuda = await page.$eval('#cadAjuda', (d) => d.textContent);
      if (!/Origem do cadastro.*criou.*Liberação administrativa.*autorizou o acesso/s.test(ajuda) || !/14\/08\/2026/.test(ajuda)) r.push('"Como ler esta lista" sem a diferença entre origem e liberação');
      if (erros.length) r.push('erro JS: ' + erros[0]);
      registrar('Origem do cadastro: opções com contagem, filtro combinado com a situação, "Limpar filtros" e a ajuda', r);

      /* 4. "Confirmar cadastro" só para quem precisa */
      const q = [];
      for (const [e, deve] of [['pendente@previ.com.br', true], ['link@previ.com.br', false], ['antiga@previ.com.br', false], ['liberada@previ.com.br', false]]) {
        await page.evaluate((mail) => { Array.from(document.querySelectorAll('#adminCadastrados tbody tr')).find((tr) => tr.textContent.indexOf(mail) !== -1).querySelector('.cad-mais-btn').click(); }, e);
        await page.waitForSelector('.cad-acoes-modal', { timeout: 10000 });
        const tem = await page.evaluate(() => document.querySelector('.cad-acoes-modal').textContent.indexOf('Confirmar cadastro') !== -1);
        if (tem !== deve) q.push(e + (deve ? ' sem' : ' com') + ' "Confirmar cadastro"');
        await page.click('.cad-acoes-modal .admin-modal-cancel-btn');
      }
      registrar('"Confirmar cadastro" só para quem não confirmou o e-mail nem foi liberada', q);
      await ctx.close();
    }

    /* 5b. 1024 px com e-mail comprido e liberação com nome comprido: cabe */
    if (formato.nome === 'desktop') {
      const LONGO = 'maria.fernanda.albuquerque.cavalcanti.dos.santos.oliveira.teste@previ.com.br';
      const u = usuarios(); u[chave(LONGO)] = { name: 'MARIA FERNANDA DE ALBUQUERQUE CAVALCANTI DOS SANTOS', email: LONGO, area: 'GERAT', createdAt: '2026-04-01T10:00:00.000Z',
        emailVerificationRequired: true, emailConfirmado: true, emailConfirmadoEm: QUANDO, adminApproved: true, approvedAt: '2026-10-30T19:00:00.000Z', approvedByAdminName: 'TATIANE FARO DIRENE DE OLIVEIRA SANTOS' };
      const r = await abrir(browser, { viewport: { width: 1024, height: 768 } }, { db: banco(u), user: { email: ADM, emailVerified: true, uid: 'u1' } }, '#admin');
      await r.page.waitForSelector('.admin-tab-btn', { timeout: 15000 });
      await r.page.evaluate(() => { const b = Array.from(document.querySelectorAll('.admin-tab-btn')).find((x) => /Cadastrados/i.test(x.textContent)); if (b) b.click(); });
      await r.page.waitForSelector('.cad-mais-btn', { timeout: 15000 });
      const m = await r.page.evaluate(() => {
        const wrap = document.querySelector('#adminCadastrados .table-scroll-wrap'), w = wrap.getBoundingClientRect();
        return { rola: wrap.scrollWidth > wrap.clientWidth + 1,
          cortados: Array.from(document.querySelectorAll('#adminCadastrados tbody tr button')).filter((b) => b.getBoundingClientRect().right > w.right + 0.5).length };
      });
      const p = [];
      if (m.rola) p.push('a tabela rola para o lado em 1024 px');
      if (m.cortados) p.push(m.cortados + ' botão(ões) cortado(s)');
      if (r.erros.length) p.push('erro JS: ' + r.erros[0]);
      registrar('1024 px com textos compridos: a tabela cabe e o "⋯" fica inteiro', p);
      await r.ctx.close();
    }

    /* 6. Anotação no login */
    {
      const PESSOA = 'pessoa@previ.com.br';
      const cenarios = [
        { nome: 'e-mail confirmado no Auth e cadastro sem a marca → anota uma vez', verificado: true, cad: { emailVerificationRequired: true }, grava: true },
        { nome: 'já anotado → não grava de novo', verificado: true, cad: { emailVerificationRequired: true, emailConfirmado: true, emailConfirmadoEm: QUANDO }, grava: false },
        { nome: 'e-mail ainda não confirmado → não grava', verificado: false, cad: { emailVerificationRequired: true }, grava: false },
        { nome: 'liberada pelo admin sem confirmar o e-mail → não grava (liberação ≠ confirmação)', verificado: false, cad: { emailVerificationRequired: true, adminApproved: true }, grava: false },
        { nome: 'bloqueada → não grava', verificado: true, cad: { emailVerificationRequired: true, blocked: true }, grava: false },
        { nome: 'sem cadastro no banco → não cria um', verificado: true, cad: null, grava: false },
      ];
      for (const c of cenarios) {
        const u = {}; if (c.cad) u[chave(PESSOA)] = Object.assign({ name: 'PESSOA', email: PESSOA, area: 'GECAT', createdAt: '2026-10-01T12:00:00.000Z' }, c.cad);
        const r = await abrir(browser, formato.opts, { db: banco(u), user: { email: PESSOA, emailVerified: c.verificado, uid: 'u1' } }, '#home');
        await r.page.waitForTimeout(2500);
        const esc = await r.page.evaluate((k) => (window.__ESCRITAS || []).filter((e) => e.path.indexOf('fa-users/' + k) !== -1 || (e.path === 'fa-users')).map((e) => ({ path: e.path, valor: e.valor })), chave(PESSOA));
        const p = [];
        if (c.grava) {
          const ok = esc.length === 1 && esc[0].path === 'fa-users/' + chave(PESSOA) && JSON.stringify(esc[0].valor) === JSON.stringify({ emailConfirmado: true, emailConfirmadoEm: 1 });
          if (!ok) p.push('esperava UMA gravação {emailConfirmado:true, emailConfirmadoEm: TIMESTAMP}: ' + JSON.stringify(esc));
          const tokens = await r.page.evaluate(() => window.__CFG.__tokens || 0);
          if (!tokens) p.push('não pediu token novo antes de anotar');
        } else if (esc.length) p.push('gravou: ' + JSON.stringify(esc));
        if (r.erros.length) p.push('erro JS: ' + r.erros[0]);
        registrar('login: ' + c.nome, p);
        await r.ctx.close();
      }
    }
  }

  await browser.close();
  if (falhas.length) { console.error('\n' + falhas.length + ' falha(s):'); falhas.forEach((f) => console.error('  - ' + f)); process.exit(1); }
  console.log('\nTudo certo: Pendentes, colunas, Excel e a anotação da confirmação no login.');
})();
