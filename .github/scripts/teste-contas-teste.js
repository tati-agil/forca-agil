/* ADMIN › Cadastrados: CONTA DE TESTE — identificação administrativa, filtro, aviso, Excel, auditoria e correção de e-mail.
 *
 * POR QUE ESTE TESTE EXISTE
 * As contas de teste ficavam misturadas aos cadastros reais na lista do ADMIN. A marca (fa-contas-teste) é SÓ
 * identificação: nenhum outro código lê esse nó, e marcar ou desmarcar não pode mudar login, senha, acesso, permissões,
 * situação, inscrições nem históricos. Este teste prova, com o Firebase falso e dados 100% fictícios, em computador
 * (1366 px) e celular (375 px):
 *   1. padrão: as marcadas não aparecem, e um aviso diz quantas são, com "Mostrar todas"; contadores e "N de M" contam só
 *      o que o recorte mostra; marca com e-mail diferente do cadastro não vale;
 *   2. "Mostrar todas" e o filtro "Contas de teste" (Não marcadas / Testes / Todas), combinável com situação; selo "Teste"
 *      nas marcadas (tabela e cartões); a busca respeita o recorte e avisa quando uma marcada também atende;
 *      "Limpar filtros" volta ao padrão;
 *   3. Excel: o conjunto da tela, com a coluna "Conta de teste" (Sim/Não);
 *   4. marcar e desmarcar pelo menu ⋯: UMA gravação com exatamente dois caminhos (a marca e o evento de auditoria), com
 *      autoria e horário do servidor — nada em fa-users nem em qualquer outro nó;
 *   5. sem conseguir ler a marcação: a lista inteira aparece, com aviso, e o menu não oferece marcar;
 *   6. correção de e-mail (a marca NUNCA impede a mudança dos dados — o login já foi trocado quando eles mudam de
 *      chave): sem marca, nada de marcação é gravado; com marca, os dados mudam e DEPOIS a marca (nova marcada, antiga
 *      desmarcada com movidoPara, evento "mover"); leitura ou gravação da marca recusada: os dados mudam mesmo assim e
 *      a admin é avisada; em todos, a admin termina ela mesma, a senha da conta não muda e nada é gravado em outra
 *      pessoa nem em nó de permissão;
 *   7. nenhum código fora do ADMIN lê fa-contas-teste; padrão visual; sem rolagem lateral; nenhum erro de JavaScript.
 */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const XLSX = require(path.join(__dirname, '..', '..', 'forca-agil', 'xlsx.mini.min.js'));
const { verificarTela } = require('./padrao-visual-verificacoes');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const RAIZ = path.join(__dirname, '..', '..');
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const ADM = 'adm.exemplo@previ.com.br', SENHA_ADM = 'senhaDaAdmin';
const e = (n) => n + '.exemplo@previ.com.br';
const T1 = e('teste.um'), T2 = e('teste.dois'), R1 = e('real.um'), R2 = e('real.dois'), DESM = e('desmarcada'), DIVERGE = e('diverge');
const ERRADO = 'testetypo.exemplo@previ.com.br', CERTO = 'testecerto.exemplo@previ.com.br';
const SEMMARCA = 'semmarca.exemplo@previ.com.br', CERTO2 = 'semmarca.certo.exemplo@previ.com.br';
/* para os cenários de correção: mais uma conta criada pelo painel, sem marca */
function bancoCorrecao() {
  const b = banco();
  b['fa-users'][chave(SEMMARCA)] = { email: SEMMARCA, name: 'PESSOA SEM MARCA', area: 'GECAT', createdAt: '2026-09-01T12:00:00.000Z', adminApproved: true, createdByAdmin: ADM };
  return b;
}
function senhasCorrecao() { const s = {}; s[ADM] = SENHA_ADM; s[ERRADO] = '12345678'; s[SEMMARCA] = '12345678'; return s; }

function banco() {
  const u = {}, m = {};
  const pessoa = (email, nome, extra) => { u[chave(email)] = Object.assign({ email, name: nome, area: 'GECAT', createdAt: '2026-09-01T12:00:00.000Z', adminApproved: true }, extra); };
  pessoa(ADM, 'ADMIN EXEMPLO', {});
  pessoa(R1, 'PESSOA REAL UM', {});
  pessoa(R2, 'PESSOA REAL DOIS', { blocked: true });
  pessoa(T1, 'TESTE_2', {});                       /* nome repetido de propósito: a marca é pela chave/e-mail exato */
  pessoa(T2, 'TESTE_2', { blocked: true });
  pessoa(DESM, 'PESSOA DESMARCADA', {});
  pessoa(DIVERGE, 'PESSOA MARCA DIVERGENTE', {});
  pessoa(ERRADO, 'TESTE COM TYPO', { createdByAdmin: ADM });
  const marca = (email, marcada, extra) => { m[chave(email)] = Object.assign({ marcada, email, por: ADM, em: 1761900000000, auditoria: 'a-' + chave(email) }, extra); };
  marca(T1, true); marca(T2, true); marca(ERRADO, true);
  marca(DESM, false);
  marca(DIVERGE, true, { email: 'outro.email@previ.com.br' });   /* e-mail diferente do cadastro: não vale */
  const admins = {}; admins[chave(ADM)] = { email: ADM, name: 'ADMIN EXEMPLO' };
  return { 'fa-users': u, 'fa-contas-teste': m, 'fa-contas-teste-auditoria': {}, 'fa-admins': admins, 'fa-diretores': {}, 'fa-facilitadores': {},
    'fa-users-log': {}, 'fa-progress': {}, 'fa-progress-historico': {}, 'fa-reset-signal': {}, 'fa-espera': {}, eventos: {}, turmas: {},
    'turmas-interesse': {}, 'turmas-interesse-log': {}, 'turmas-config': {}, 'turmas-checkin': {}, 'turmas-publico': {}, 'eventos-publico': {},
    'turmas-equipe': {}, 'turmas-sorteio': {}, avaliacoes: {}, pedidos: {}, holocron: {} };
}
const TODOS = [ADM, R1, R2, T1, T2, DESM, DIVERGE, ERRADO];
const MARCADOS = [T1, T2, ERRADO];

async function abrir(browser, opts, cfgExtra) {
  const ctx = await browser.newContext(Object.assign({ acceptDownloads: true }, opts));
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (x) => erros.push(String(x).split('\n')[0]));
  const senhas = {}; senhas[ADM] = SENHA_ADM; senhas[ERRADO] = '12345678';
  await page.addInitScript('window.__CFG = ' + JSON.stringify(Object.assign({ db: banco(), user: { email: ADM, emailVerified: true, uid: 'u1' }, delayDefault: 20, senhas }, cfgExtra || {})) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.admin-tab-btn', { timeout: 15000 });
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('.admin-tab-btn')).find((x) => /Cadastrados/i.test(x.textContent)); if (b) b.click(); });
  await page.waitForSelector('.cad-mais-btn', { timeout: 15000 });
  return { ctx, page, erros };
}
const emails = (page) => page.$$eval('#adminCadastrados tbody tr td[data-label="E-mail"]', (tds) => tds.map((t) => t.textContent.trim()));
const ord = (a) => JSON.stringify(a.slice().sort());
async function status(page, s) { await page.click('.admin-status-btn[data-status="' + s + '"]'); }
async function tipo(page, v) { const aberto = await page.$eval('#cadMaisFiltros', (d) => d.open); if (!aberto) await page.click('#cadMaisFiltros > summary'); await page.selectOption('#cadFiltroTeste', v); }
/* o que APARECE (estilo computado), não só o atributo hidden — display: flex já anulou o hidden uma vez */
const estado = (page) => page.evaluate(() => { const visivel = (el) => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0; return {
  aviso: visivel(document.getElementById('cadAvisoTeste')) ? document.getElementById('cadAvisoTeste').textContent.replace(/\s+/g, ' ').trim() : '',
  mostrar: visivel(document.getElementById('cadMostrarTodas')),
  avisoSemTexto: visivel(document.getElementById('cadAvisoTeste')) && !document.getElementById('cadAvisoTesteTexto').textContent.trim(),
  resultado: document.getElementById('cadastradosResultado').textContent.trim(),
  botoes: Array.from(document.querySelectorAll('.admin-status-btn')).map((b) => b.textContent.trim()),
  selos: Array.from(document.querySelectorAll('#adminCadastrados tbody tr')).filter((tr) => tr.querySelector('.cad-teste-badge')).map((tr) => tr.querySelector('td[data-label="E-mail"]').textContent.trim()),
  tipo: document.getElementById('cadFiltroTeste').value }; });
async function baixar(page) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('#cadastradosExportarBtn')]);
  const arq = path.join(require('os').tmpdir(), 'ct-' + process.pid + '-' + Date.now() + '.xlsx');
  await dl.saveAs(arq);
  const wb = XLSX.read(fs.readFileSync(arq), { type: 'buffer' }); fs.unlinkSync(arq);
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
}
async function acaoMenu(page, email, rotulo) {
  await page.evaluate((m) => { const tr = Array.from(document.querySelectorAll('#adminCadastrados tbody tr')).find((x) => x.querySelector('td[data-label="E-mail"]').textContent.trim() === m); tr.querySelector('.cad-mais-btn').click(); }, email);
  await page.waitForSelector('.cad-acoes-modal', { timeout: 10000 });
  const acoes = await page.$$eval('.cad-acoes-modal .cad-acao-btn .cad-acao-rotulo', (xs) => xs.map((x) => x.textContent.trim()));
  if (!rotulo) { await page.click('.cad-acoes-modal .admin-modal-cancel-btn'); return { acoes }; }
  await page.evaluate(() => { window.__ESCRITAS = []; });
  await page.evaluate((r) => Array.from(document.querySelectorAll('.cad-acoes-modal .cad-acao-btn')).find((b) => b.querySelector('.cad-acao-rotulo').textContent.trim() === r).click(), rotulo);
  await page.waitForSelector('.admin-modal-confirm-btn', { timeout: 10000 });
  const texto = await page.$eval('.admin-modal-confirm-btn', (b) => (b.closest('.modal-box') || b.parentNode.parentNode).textContent);
  await page.click('.admin-modal-confirm-btn');
  await page.waitForFunction(() => (window.__ESCRITAS || []).length > 0, null, { timeout: 10000 });
  await page.waitForSelector('.cad-mais-btn', { timeout: 15000 });
  await page.waitForTimeout(400);
  return { acoes, texto, escritas: await page.evaluate(() => (window.__ESCRITAS || []).map((x) => ({ path: x.path, valor: x.valor }))) };
}

const FORMATOS = [
  { nome: '1366 px', opts: { viewport: { width: 1366, height: 860 } } },
  { nome: '375 px', opts: Object.assign({}, devices['iPhone 13'], { viewport: { width: 375, height: 812 } }) },
];

(async () => {
  const browser = await chromium.launch();
  const falhas = [];
  const registrar = (nome, p) => { if (p.length) { falhas.push(nome + ' → ' + p.join('; ')); console.log('  FALHA ' + nome + ' → ' + p.join('; ')); } else console.log('  ok    ' + nome); };

  /* 7a. isolamento: só o ADMIN lê a marcação (nenhum código de login, rota ou acesso) */
  {
    const p = [];
    const quem = fs.readdirSync(path.join(RAIZ, 'forca-agil')).filter((f) => /\.js$/.test(f) && f !== 'manual.js')
      .filter((f) => fs.readFileSync(path.join(RAIZ, 'forca-agil', f), 'utf8').indexOf('fa-contas-teste') !== -1);
    if (JSON.stringify(quem) !== '["admin.js"]') p.push('lido por: ' + quem.join(', '));
    const regras = JSON.parse(fs.readFileSync(path.join(RAIZ, 'database.rules.json'), 'utf8')).rules;
    const outros = Object.keys(regras).filter((k) => !/^fa-contas-teste/.test(k) && JSON.stringify(regras[k]).indexOf('fa-contas-teste') !== -1);
    if (outros.length) p.push('regras de outros nós citam a marcação: ' + outros.join(', '));
    const M = require('./montar-regras-contas-teste.js');
    Object.keys(M.BLOCOS).forEach((n) => { if (JSON.stringify(regras[n]) !== JSON.stringify(M.BLOCOS[n])) p.push(n + ' difere do montado'); });
    registrar('só admin.js lê fa-contas-teste; nenhuma regra de outro nó depende dela; nós = montar-regras-contas-teste.js', p);
  }

  for (const f of FORMATOS) {
    console.log('\n===== ' + f.nome + ' =====');
    {
      const { ctx, page, erros } = await abrir(browser, f.opts);
      /* 1. padrão */
      let p = [];
      let s = await estado(page), vis = await emails(page);
      const ativosNaoTeste = TODOS.filter((x) => !MARCADOS.includes(x) && x !== R2);
      if (ord(vis) !== ord(ativosNaoTeste)) p.push('na tela: ' + vis.join(', '));
      if (!/^3 contas marcadas como teste não aparecem nesta lista\. Mostrar todas$/.test(s.aviso) || !s.mostrar) p.push('aviso: "' + s.aviso + '"');
      if (s.botoes.join('|') !== 'Ativos (4)|Pendentes (0)|Bloqueados (1)|Todos (5)') p.push('contadores: ' + s.botoes.join('|'));
      if (!/de 5$/.test(s.resultado)) p.push('resultado: ' + s.resultado);
      if (s.selos.length) p.push('selo fora das marcadas');
      if (!vis.includes(DIVERGE)) p.push('marca com e-mail divergente escondeu o cadastro');
      if (s.tipo !== 'nao-teste') p.push('filtro inicial: ' + s.tipo);
      registrar(f.nome + ': padrão esconde as 3 marcadas, avisa quantas e oferece "Mostrar todas"; contadores só do recorte; marca divergente não vale', p);

      /* 2. Mostrar todas, Testes, combinação, busca, limpar */
      p = [];
      await page.click('#cadMostrarTodas');
      s = await estado(page); vis = await emails(page);
      if (ord(vis) !== ord(TODOS.filter((x) => x !== R2 && x !== T2))) p.push('Mostrar todas (ativos): ' + vis.join(', '));
      if (ord(s.selos) !== ord([T1, ERRADO])) p.push('selos: ' + s.selos.join(', '));
      if (s.tipo !== 'todas' || s.aviso || s.mostrar || s.avisoSemTexto) p.push('depois de Mostrar todas: tipo ' + s.tipo + ', aviso "' + s.aviso + '"');
      if (s.botoes.join('|') !== 'Ativos (6)|Pendentes (0)|Bloqueados (2)|Todos (8)') p.push('contadores (todas): ' + s.botoes.join('|'));
      await tipo(page, 'testes'); await status(page, 'todos');
      vis = await emails(page); s = await estado(page);
      if (ord(vis) !== ord(MARCADOS) || ord(s.selos) !== ord(MARCADOS)) p.push('Testes/Todos: ' + vis.join(', '));
      if (!/Mostrando só as contas marcadas como teste/.test(s.aviso)) p.push('aviso em Testes: ' + s.aviso);
      await status(page, 'bloqueados');
      vis = await emails(page);
      if (ord(vis) !== ord([T2])) p.push('Testes + Bloqueados: ' + vis.join(', '));
      /* combinável com o Canal de criação: entre as marcadas, só a criada pelo painel do administrador */
      await status(page, 'todos'); await page.selectOption('#cadFiltroOrigem', 'admin');
      vis = await emails(page);
      if (ord(vis) !== ord([ERRADO])) p.push('Testes + Canal "Painel do administrador": ' + vis.join(', '));
      await page.selectOption('#cadFiltroOrigem', ''); await status(page, 'bloqueados');
      const selo375 = await page.evaluate(() => { const b = document.querySelector('#adminCadastrados tbody .cad-teste-badge'); if (!b) return null; const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.right <= innerWidth + 1; });
      if (!selo375) p.push('selo não visível na linha/cartão');
      await page.click('#cadLimparFiltros');
      s = await estado(page);
      if (s.tipo !== 'nao-teste' || !s.aviso) p.push('Limpar filtros não voltou ao padrão');
      await page.fill('#cadastradosFiltro', 'TESTE_2');
      vis = await emails(page); s = await estado(page);
      if (vis.length !== 0 || !/1 conta marcada como teste também atende a esta busca/.test(s.aviso) || !s.mostrar) p.push('busca "TESTE_2" (ativos): ' + vis.join(', ') + ' / "' + s.aviso + '"');
      await page.click('#cadMostrarTodas');
      vis = await emails(page);
      if (ord(vis) !== ord([T1])) p.push('busca + Mostrar todas: ' + vis.join(', '));
      await page.fill('#cadastradosFiltro', '');
      registrar(f.nome + ': Mostrar todas, Testes, combinação com situação, selo, busca que avisa o que o recorte esconde, Limpar filtros', p);

      /* 3. Excel */
      p = [];
      await page.click('#cadLimparFiltros'); await status(page, 'todos');
      let linhas = await baixar(page);
      if (JSON.stringify(Object.keys(linhas[0] || {})) !== JSON.stringify(['Nome', 'E-mail', 'Área', 'Cadastro em', 'Canal de criação', 'Confirmação do e-mail', 'Confirmação registrada em', 'Liberação administrativa', 'Liberado por', 'Situação', 'Conta de teste'])) p.push('colunas: ' + Object.keys(linhas[0] || {}).join(', '));
      if (ord(linhas.map((l) => l['E-mail'])) !== ord(TODOS.filter((x) => !MARCADOS.includes(x))) || linhas.some((l) => l['Conta de teste'] !== 'Não')) p.push('Excel padrão: ' + JSON.stringify(linhas.map((l) => [l['E-mail'], l['Conta de teste']])));
      await tipo(page, 'todas');
      linhas = await baixar(page);
      const sim = linhas.filter((l) => l['Conta de teste'] === 'Sim').map((l) => l['E-mail']);
      if (linhas.length !== TODOS.length || ord(sim) !== ord(MARCADOS)) p.push('Excel Todas: ' + JSON.stringify(linhas.map((l) => [l['E-mail'], l['Conta de teste']])));
      registrar(f.nome + ': Excel = conjunto da tela, com a coluna "Conta de teste"', p);

      /* 4. marcar e desmarcar: uma gravação, dois caminhos, nada mais */
      p = [];
      let r = await acaoMenu(page, R1, 'Marcar como conta de teste');
      if (!/Não muda login, senha, acesso/.test(r.texto)) p.push('confirmação não explica que é só identificação');
      const kR1 = chave(R1);
      const caminhos = r.escritas.map((x) => x.path).sort();
      const marcaR1 = r.escritas.find((x) => x.path === 'fa-contas-teste/' + kR1), evR1 = r.escritas.find((x) => /^fa-contas-teste-auditoria\//.test(x.path));
      if (r.escritas.length !== 2 || caminhos[0] !== 'fa-contas-teste-auditoria/' + (evR1 && evR1.path.split('/')[1]) || caminhos[1] !== 'fa-contas-teste/' + kR1) p.push('gravou: ' + caminhos.join(', '));
      if (!marcaR1 || marcaR1.valor.marcada !== true || marcaR1.valor.email !== R1 || marcaR1.valor.por !== ADM || !marcaR1.valor.em || marcaR1.valor.auditoria !== (evR1 && evR1.path.split('/')[1])) p.push('marca: ' + JSON.stringify(marcaR1 && marcaR1.valor));
      if (!evR1 || evR1.valor.acao !== 'marcar' || evR1.valor.chave !== kR1 || evR1.valor.email !== R1 || evR1.valor.por !== ADM || !evR1.valor.em) p.push('evento: ' + JSON.stringify(evR1 && evR1.valor));
      if (r.escritas.some((x) => /^fa-users/.test(x.path))) p.push('tocou fa-users');
      await tipo(page, 'testes'); await status(page, 'todos');
      if (!(await emails(page)).includes(R1)) p.push('a marcada não aparece em Testes depois de recarregar');
      r = await acaoMenu(page, T1, 'Desmarcar conta de teste');
      const evT1 = r.escritas.find((x) => /^fa-contas-teste-auditoria\//.test(x.path)), mT1 = r.escritas.find((x) => x.path === 'fa-contas-teste/' + chave(T1));
      if (r.escritas.length !== 2 || !mT1 || mT1.valor.marcada !== false || !evT1 || evT1.valor.acao !== 'desmarcar') p.push('desmarcar gravou: ' + JSON.stringify(r.escritas));
      await tipo(page, 'nao-teste');
      if (!(await emails(page)).includes(T1)) p.push('a desmarcada não voltou à lista padrão');
      const menuReal = await acaoMenu(page, DESM);
      if (!menuReal.acoes.includes('Marcar como conta de teste')) p.push('menu sem "Marcar": ' + menuReal.acoes.join(' | '));
      if (erros.length) p.push('erro JS: ' + erros[0]);
      registrar(f.nome + ': marcar/desmarcar pelo menu ⋯ = uma gravação, só a marca + o evento de auditoria (autoria, horário do servidor); nada em fa-users', p);

      /* 7b. padrão visual */
      p = [];
      await tipo(page, 'nao-teste');
      const pv = await verificarTela(page, { escopo: '#adminCadastrados .cad-resultado-linha', largura: f.opts.viewport.width, focos: 0 });
      if (pv && pv.length) p.push(...pv.slice(0, 4));
      const lado = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      if (lado) p.push('rolagem lateral');
      const link = await page.evaluate(() => { const b = document.getElementById('cadMostrarTodas'), cs = getComputedStyle(b), r = b.getBoundingClientRect(); return { cor: cs.color, alt: r.height }; });
      if (/rgb\(0, 0, 238\)|rgb\(85, 26, 139\)/.test(link.cor) || link.alt < 24) p.push('"Mostrar todas": ' + JSON.stringify(link));
      registrar(f.nome + ': padrão visual (selo, aviso, link complementar), sem rolagem lateral', p);
      await ctx.close();
    }

    /* 5. leitura da marcação recusada */
    {
      const p = [];
      const { ctx, page, erros } = await abrir(browser, f.opts, { fail: ['fa-contas-teste'] });
      await status(page, 'todos');
      const s = await estado(page), vis = await emails(page);
      if (ord(vis) !== ord(TODOS)) p.push('não mostrou todos: ' + vis.join(', '));
      if (!/Não foi possível carregar a marcação de contas de teste/.test(s.aviso) || s.mostrar) p.push('aviso: "' + s.aviso + '"');
      if (s.selos.length) p.push('selo sem marcação lida');
      const m = await acaoMenu(page, R1);
      if (m.acoes.some((a) => /conta de teste/.test(a))) p.push('ofereceu marcar sem saber o estado');
      if (erros.length) p.push('erro JS: ' + erros[0]);
      registrar(f.nome + ': sem ler a marcação, a lista aparece inteira com aviso e o menu não oferece marcar', p);
      await ctx.close();
    }

    /* 6. correção de e-mail × marca de teste: a marca nunca impede a mudança dos dados (o login já foi trocado quando
       os dados mudam de chave) — sem marca, com marca, leitura da marca recusada e gravação da marca recusada */
    async function corrigir(cfgExtra, de, para) {
      const { ctx, page, erros } = await abrir(browser, f.opts, Object.assign({ db: bancoCorrecao(), senhas: senhasCorrecao() }, cfgExtra));
      await page.click('#cadMostrarTodas');
      await page.evaluate((mail) => { const tr = Array.from(document.querySelectorAll('#adminCadastrados tbody tr')).find((x) => x.querySelector('td[data-label="E-mail"]').textContent.trim() === mail); tr.querySelector('.admin-edit-cad-btn').click(); }, de);
      await page.waitForSelector('#cadEditNome', { timeout: 10000 });
      await page.waitForFunction(() => { const b = document.querySelector('.modal-box .admin-modal-save-btn'); return b && !b.disabled; }, null, { timeout: 10000 });
      await page.fill('#cadEditEmail', para);
      await page.fill('#cadEditAdminPwd', SENHA_ADM);
      await page.evaluate(() => { window.__ESCRITAS = []; document.querySelector('.modal-box .admin-modal-save-btn').click(); });
      await page.waitForSelector('.admin-modal-confirm-btn', { timeout: 10000 });
      await page.click('.admin-modal-confirm-btn');
      await page.waitForFunction(() => Array.from(document.querySelectorAll('.modal-box')).some((b) => /E-mail corrigido para/.test(b.textContent)) || ((document.querySelector('#cadEditErr') || {}).textContent || '').trim(), null, { timeout: 20000 });
      await page.waitForTimeout(300);
      const r = await page.evaluate(() => ({
        esc: (window.__ESCRITAS || []).map((x) => ({ path: x.path, valor: x.valor })),
        alerta: (Array.from(document.querySelectorAll('.modal-box')).find((b) => /E-mail corrigido para/.test(b.textContent)) || {}).textContent || '',
        erro: ((document.querySelector('#cadEditErr') || {}).textContent || '').trim(),
        logada: (firebase.auth().currentUser || {}).email || null,
        senhas: window.__CFG.senhas }));
      await ctx.close();
      /* 5. preservação: dados movidos; admin continua ela mesma; a senha da conta corrigida é a mesma (só o login mudou
         de e-mail) e a da admin intacta; nenhuma gravação na chave de outra pessoa nem em nó de permissão */
      const kA = chave(de), kN = chave(para), outros = TODOS.concat([SEMMARCA]).filter((x) => x !== de).map(chave);
      const p = [];
      if (r.erro) p.push('erro: ' + r.erro.split('\n')[0]);
      if (!r.esc.some((x) => x.path === 'fa-users/' + kN && x.valor && x.valor.email === para) || !r.esc.some((x) => x.path === 'fa-users/' + kA && x.valor === null)) p.push('os dados não mudaram de chave');
      if (r.logada !== ADM) p.push('terminou logada como ' + r.logada);
      if (r.senhas[para] !== '12345678' || r.senhas[de] !== undefined || r.senhas[ADM] !== SENHA_ADM) p.push('senhas: ' + JSON.stringify(r.senhas));
      const indevidas = r.esc.filter((x) => outros.some((k) => x.path.split('/').includes(k)) || /^fa-(admins|diretores|gerentes|facilitadores|avaliacao-autorizados)\//.test(x.path));
      if (indevidas.length) p.push('gravou fora da pessoa: ' + indevidas.map((x) => x.path).join(', '));
      return Object.assign(r, { kA, kN, p });
    }
    {
      const r = await corrigir({}, SEMMARCA, CERTO2);
      if (r.esc.some((x) => /^fa-contas-teste/.test(x.path))) r.p.push('gravou marcação numa conta sem marca: ' + r.esc.filter((x) => /^fa-contas-teste/.test(x.path)).map((x) => x.path).join(', '));
      if (/marcação/.test(r.alerta)) r.p.push('aviso de marcação sem motivo: ' + r.alerta);
      registrar(f.nome + ': correção de conta SEM marca — dados movidos, nenhuma gravação de marcação, login/senha/permissões preservados', r.p);
    }
    {
      const r = await corrigir({}, ERRADO, CERTO);
      const nova = r.esc.find((x) => x.path === 'fa-contas-teste/' + r.kN), antiga = r.esc.find((x) => x.path === 'fa-contas-teste/' + r.kA);
      const ev = r.esc.find((x) => /^fa-contas-teste-auditoria\//.test(x.path));
      if (!nova || nova.valor.marcada !== true || nova.valor.email !== CERTO) r.p.push('chave nova: ' + JSON.stringify(nova && nova.valor));
      if (!antiga || antiga.valor.marcada !== false || antiga.valor.movidoPara !== r.kN) r.p.push('chave antiga: ' + JSON.stringify(antiga && antiga.valor));
      if (!ev || ev.valor.acao !== 'mover' || ev.valor.chave !== r.kN || ev.valor.chaveAnterior !== r.kA || nova.valor.auditoria !== ev.path.split('/')[1] || antiga.valor.auditoria !== ev.path.split('/')[1]) r.p.push('evento: ' + JSON.stringify(ev && ev.valor));
      const iDados = r.esc.findIndex((x) => x.path === 'fa-users/' + r.kN), iMarca = r.esc.findIndex((x) => /^fa-contas-teste/.test(x.path));
      if (!(iDados >= 0 && iMarca > iDados)) r.p.push('a marca não foi gravada DEPOIS dos dados');
      if (/marcação/.test(r.alerta)) r.p.push('aviso indevido: ' + r.alerta);
      registrar(f.nome + ': correção de conta MARCADA — dados movidos e, depois, a marca (nova marcada, antiga desmarcada com movidoPara, evento "mover")', r.p);
    }
    {
      const r = await corrigir({ fail: ['fa-contas-teste/' + chave(ERRADO)] }, ERRADO, CERTO);
      if (r.esc.some((x) => /^fa-contas-teste/.test(x.path))) r.p.push('gravou marcação sem tê-la lido');
      if (!/Não foi possível ler a marcação de conta de teste/.test(r.alerta)) r.p.push('sem aviso à admin: ' + (r.alerta || '(nenhum alerta)'));
      registrar(f.nome + ': leitura da marca RECUSADA na correção — os dados mudam mesmo assim, e a admin é avisada para marcar de novo', r.p);
    }
    {
      const r = await corrigir({ fail: ['fa-contas-teste-auditoria'] }, ERRADO, CERTO);
      if (!/não foi transferida para o e-mail novo/.test(r.alerta)) r.p.push('sem aviso à admin: ' + (r.alerta || '(nenhum alerta)'));
      registrar(f.nome + ': gravação da marca RECUSADA depois do login já trocado — os dados mudam mesmo assim, e a admin é avisada', r.p);
    }
  }

  await browser.close();
  console.log('\n' + (falhas.length ? falhas.length + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas.length ? 1 : 0);
})().catch((x) => { console.error(x); process.exit(1); });
