/* SEGURANÇA DE fa-users — PR 1-A (só código, compatível com as regras atuais). Desktop (1366) e 375 px.
 * Hermético: Firebase falso, sem rede, sem segredo. Dados 100% fictícios.
 * O que se prova:
 *   A. "Criar conta para colaboradora" (auth.js criarContaPorAdmin), na ordem nova: reautentica o admin ANTES de criar,
 *      cria o login, sai, volta como admin, confere a sessão e SÓ ENTÃO grava o cadastro — com a sessão do ADMIN (nunca
 *      com a da conta nova), uma gravação só, os mesmos campos de sempre. A sessão do admin continua de pé.
 *   B. Senha de admin errada: nada é criado (nem login, nem cadastro), a sessão do admin continua.
 *   C. Login que já existe COM cadastro: "E-mail já cadastrado", nada gravado.
 *   D. Login que já existe SEM cadastro (criação parcial anterior): mensagem explícita, nada gravado, nada liberado.
 *   E. A volta para o admin falha: o cadastro NÃO é gravado, nenhuma etapa é repetida, o site vai para o login com o aviso
 *      de criação incompleta (nada fica conectado como a conta nova).
 *   F. A gravação do cadastro falha: mensagem de criação incompleta, a sessão do admin continua, nenhuma nova tentativa.
 *   G. Login sem cadastro e e-mail NÃO confirmado: painel de verificação; nenhum módulo, nem pelo endereço; nada gravado.
 *   H. Login sem cadastro e e-mail confirmado: só "Completar cadastro"; validações; grava SÓ os campos do cadastro público
 *      (com emailVerificationRequired), como a própria pessoa; depois passa pelas verificações normais e entra no site.
 *   I. Leitura do cadastro lenta: nada é decidido antes de a resposta chegar ("ainda não sei" ≠ "não tem cadastro").
 *   J. Leitura do cadastro com erro: nunca vira "sem cadastro" (nem verificação, nem completar), nada gravado.
 *   K. Login de fora da Previ sem cadastro: sai.
 *   L. O cadastro aparece enquanto a pessoa preenche: nada é sobrescrito; valem as verificações normais.
 *   M. Navegação: no "Completar cadastro" o endereço não abre módulo; depois de completar, as rotas funcionam.
 *   Em todos: nenhuma rolagem lateral, nenhum erro de página. As contas que JÁ existem continuam entrando como antes:
 *   teste-login-contas-existentes.js (mesma suíte). */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { verificarTela } = require('./padrao-visual-verificacoes');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const ADM = 'admin.teste@previ.com.br', SENHA_ADM = 'senha-adm-ficticia';
const NOVA = 'nova.colaboradora@previ.com.br', EXISTE = 'ja.existe@previ.com.br', SOLTA = 'login.sem.cadastro@previ.com.br';
const PESSOA = 'pessoa.sem.cadastro@previ.com.br';
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe !== undefined ? ' → ' + (typeof detalhe === 'string' ? detalhe : JSON.stringify(detalhe)) : '')); if (!cond) falhas++; }

function banco(extraUsers) {
  const users = {};
  users[chave(ADM)] = { name: 'ADMIN TESTE', email: ADM, area: 'INFOR', adminApproved: true, createdAt: '2026-06-01T09:00:00.000Z', emailConfirmado: true };
  users[chave(EXISTE)] = { name: 'JA EXISTE', email: EXISTE, area: 'GECAT', emailVerificationRequired: true, createdAt: '2026-09-01T09:00:00.000Z' };
  Object.assign(users, extraUsers || {});
  const admins = {}; admins[chave(ADM)] = { email: ADM, name: 'ADMIN TESTE' };
  return { 'fa-users': users, 'fa-admins': admins, 'fa-diretores': {}, 'fa-facilitadores': {}, eventos: {}, turmas: {}, 'turmas-interesse': {},
    'turmas-config': {}, 'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {} };
}
async function abrir(browser, viewport, cfg, hash) {
  const ctx = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(Object.assign({ db: banco(), delayDefault: 10 }, cfg)) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + (hash || '#home'), { waitUntil: 'domcontentloaded' });
  return { ctx, page, erros };
}
const estado = (page) => page.evaluate(() => {
  const vis = (id) => { const e = document.getElementById(id); return !!e && !e.hidden && e.offsetParent !== null; };
  const modal = document.getElementById('authModal');
  const secoes = Array.from(document.querySelectorAll('.page-section')).filter((s) => !s.hidden && s.offsetParent !== null).map((s) => s.id);
  return {
    sessao: window.faAuth && window.faAuth.getSession() ? window.faAuth.getSession().email : null,
    logado: window.__CFG.__logado || null,
    modal: !!modal && !modal.hidden, travado: !!modal && modal.classList.contains('modal-overlay--forced'),
    fechar: (document.getElementById('authClose') || {}).style ? document.getElementById('authClose').style.display : '',
    verificacao: vis('auth-verificacao'), completar: vis('auth-completar'), login: vis('auth-login'), bloqueado: vis('auth-bloqueado'),
    secoes: document.body.classList.contains('aguardando-auth') ? [] : secoes,
    eventos: (window.__CFG.__eventosAuth || []).slice(),
    lateral: document.documentElement.scrollWidth > window.innerWidth + 1
  };
});
const escritasCadastro = (page, e) => page.evaluate((k) => (window.__ESCRITAS || []).filter((x) => x.path === 'fa-users/' + k || x.path.indexOf('fa-users/' + k + '/') === 0)
  .map((x) => ({ path: x.path, valor: x.valor, logado: x.logado })), chave(e));
const esperar = (page, fn, arg, ms) => page.waitForFunction(fn, arg, { timeout: ms || 15000 });

/* ---------- A–F: criação de conta pelo admin ---------- */
async function criarConta(page, email, senhaAdm) {
  await esperar(page, () => window.faAuth && window.faAuth.getSession() && document.querySelector('.admin-tab-btn'));
  await page.evaluate(() => Array.from(document.querySelectorAll('.admin-tab-btn')).find((x) => /Cadastrados/i.test(x.textContent)).click());
  await esperar(page, () => document.getElementById('criarContaBtn'));
  await page.evaluate(({ email, senhaAdm }) => {
    document.querySelector('.admin-criar-conta-box details').open = true;
    document.getElementById('criarNome').value = 'Nova Colaboradora Exemplo';
    document.getElementById('criarEmail').value = email;
    const s = document.getElementById('criarArea'); s.value = Array.from(s.options).map((o) => o.value).find((v) => v) || '';
    document.getElementById('criarAdminPwd').value = senhaAdm;
  }, { email, senhaAdm });
  /* o resultado que o painel mostra (r.error, ou sucesso) — capturado na chamada: a mensagem de sucesso não chega a ficar
     na tela, porque o painel se redesenha logo depois de criar (comportamento anterior a esta PR, registrado no backlog) */
  await page.evaluate(() => { window.__msgsCriar = []; const orig = window.faAuth.criarContaPorAdmin;
    window.faAuth.criarContaPorAdmin = function (d, p, cb) { return orig(d, p, function (r) { window.__msgsCriar.push(r.error || 'SUCESSO'); cb(r); }); }; });
  const antes = await page.evaluate(() => (window.__CFG.__eventosAuth || []).length);
  await page.click('#criarContaBtn');
  return antes;
}
const msgCriar = (page) => page.evaluate(() => (window.__msgsCriar || []).join(' | '));
const esperarMsg = (page) => esperar(page, () => (window.__msgsCriar || []).length > 0);

async function casosCriacao(browser, viewport, rotulo) {
  const base = { user: { email: ADM, emailVerified: true }, senhas: { [ADM]: SENHA_ADM }, cadastroReal: true };

  console.log('\nA. ' + rotulo + ' — criação de conta: ordem nova, cadastro gravado pelo admin');
  {
    const { ctx, page, erros } = await abrir(browser, viewport, base, '#admin');
    const i0 = await criarConta(page, NOVA, SENHA_ADM);
    await esperarMsg(page);
    const s = await estado(page); const esc = await escritasCadastro(page, NOVA);
    afirma(await msgCriar(page) === 'SUCESSO', 'resultado: sucesso', await msgCriar(page));
    afirma(JSON.stringify(s.eventos.slice(i0)) === JSON.stringify(['reautenticar:' + ADM, 'criar:' + NOVA, 'sair', 'entrar:' + ADM]),
      'ordem: reautenticar o admin → criar o login → sair → voltar como admin', s.eventos.slice(i0));
    afirma(esc.length === 1 && esc[0].path === 'fa-users/' + chave(NOVA) && esc[0].logado === ADM, 'UMA gravação do cadastro, feita com a sessão do ADMIN', esc);
    const v = (esc[0] || {}).valor || {};
    afirma(v.email === NOVA && v.adminApproved === true && v.createdByAdmin === ADM && v.name && v.area && typeof v.createdAt === 'string' &&
      Object.keys(v).sort().join() === 'adminApproved,area,createdAt,createdByAdmin,email,name', 'os mesmos campos de sempre (sem nada a mais)', v);
    afirma(s.sessao === ADM && s.logado === ADM && !s.modal, 'a sessão do admin continua de pé, sem tela de login', s);
    afirma(!s.lateral && !erros.length, 'sem rolagem lateral nem erro de página', erros);
    await ctx.close();
  }

  console.log('\nB. ' + rotulo + ' — senha de admin errada');
  {
    const { ctx, page, erros } = await abrir(browser, viewport, base, '#admin');
    const i0 = await criarConta(page, NOVA, 'senha-errada');
    await esperarMsg(page);
    const s = await estado(page);
    afirma(/Senha de admin incorreta\. Nada foi criado\./.test(await msgCriar(page)), 'mensagem: senha incorreta, nada criado', await msgCriar(page));
    afirma(JSON.stringify(s.eventos.slice(i0)) === JSON.stringify(['reautenticar:' + ADM]), 'nenhum login criado, nenhuma troca de sessão', s.eventos.slice(i0));
    afirma(!(await escritasCadastro(page, NOVA)).length && s.sessao === ADM && !s.modal && !erros.length, 'nada gravado; admin continua conectado', s);
    await ctx.close();
  }

  console.log('\nC/D. ' + rotulo + ' — login que já existe (com e sem cadastro)');
  for (const [email, re, desc] of [[EXISTE, /^E-mail já cadastrado\.$/, 'com cadastro: "E-mail já cadastrado"'],
    [SOLTA, /sem cadastro no site.*não é liberado por aqui.*completa o cadastro/, 'SEM cadastro (criação parcial anterior): mensagem explícita, não libera']]) {
    const { ctx, page, erros } = await abrir(browser, viewport, Object.assign({}, base, { loginsExistentes: [EXISTE, SOLTA] }), '#admin');
    const i0 = await criarConta(page, email, SENHA_ADM);
    await esperarMsg(page);
    const s = await estado(page);
    afirma(re.test(await msgCriar(page)), desc, await msgCriar(page));
    afirma(JSON.stringify(s.eventos.slice(i0)) === JSON.stringify(['reautenticar:' + ADM, 'criar:' + email]) && !(await escritasCadastro(page, email)).length &&
      s.sessao === ADM && !s.modal && !erros.length, 'nada gravado, nenhuma troca de sessão, admin continua', s);
    await ctx.close();
  }

  console.log('\nE. ' + rotulo + ' — a volta para o admin falha');
  {
    const { ctx, page, erros } = await abrir(browser, viewport, Object.assign({}, base, { falharLogin: [ADM] }), '#admin');
    const i0 = await criarConta(page, NOVA, SENHA_ADM);
    await esperar(page, () => !!document.getElementById('authCriacaoIncompleta'));
    await page.waitForTimeout(300);
    const s = await estado(page);
    const aviso = await page.evaluate(() => document.getElementById('authCriacaoIncompleta').textContent);
    afirma(JSON.stringify(s.eventos.slice(i0)) === JSON.stringify(['reautenticar:' + ADM, 'criar:' + NOVA, 'sair', 'entrar:' + ADM, 'sair']),
      'uma tentativa de voltar, sem repetir nada; termina desconectado', s.eventos.slice(i0));
    afirma(!(await escritasCadastro(page, NOVA)).length, 'o cadastro NÃO foi gravado (nem como a conta nova)');
    afirma(s.sessao === null && s.logado === null && s.modal && s.login, 'tela de login, ninguém conectado (nem a conta nova)', s);
    afirma(/INCOMPLETA/.test(aviso) && aviso.indexOf(NOVA) !== -1 && /Não tente criá-la de novo/.test(aviso), 'aviso de criação incompleta na tela de login', aviso);
    afirma(!s.lateral && !erros.length, 'sem rolagem lateral nem erro de página', erros);
    await ctx.close();
  }

  console.log('\nF. ' + rotulo + ' — a gravação do cadastro falha');
  {
    const { ctx, page, erros } = await abrir(browser, viewport, Object.assign({}, base, { fail: ['fa-users/' + chave(NOVA)] }), '#admin');
    const i0 = await criarConta(page, NOVA, SENHA_ADM);
    await esperarMsg(page);
    const s = await estado(page);
    afirma(/cadastro NÃO foi gravado.*INCOMPLETA/.test(await msgCriar(page)), 'mensagem de criação incompleta', await msgCriar(page));
    afirma(JSON.stringify(s.eventos.slice(i0)) === JSON.stringify(['reautenticar:' + ADM, 'criar:' + NOVA, 'sair', 'entrar:' + ADM]),
      'nenhuma nova tentativa automática', s.eventos.slice(i0));
    afirma(s.sessao === ADM && s.logado === ADM && !s.modal && !erros.length, 'a sessão do admin continua', s);
    await ctx.close();
  }
}

/* ---------- G–M: porta de entrada ---------- */
async function casosEntrada(browser, viewport, rotulo) {
  console.log('\nG. ' + rotulo + ' — sem cadastro, e-mail NÃO confirmado');
  {
    const { ctx, page, erros } = await abrir(browser, viewport, { user: { email: PESSOA, emailVerified: false }, semCadastro: true, db: banco() }, '#conteudos');
    await esperar(page, () => !document.getElementById('auth-verificacao').hidden);
    await page.evaluate(() => { location.hash = '#admin'; }); await page.waitForTimeout(500);
    await page.evaluate(() => { location.hash = '#treinamento'; }); await page.waitForTimeout(500);
    const s = await estado(page);
    afirma(s.verificacao && !s.completar && s.modal && s.travado && s.fechar === 'none', 'painel de verificação, travado (sem fechar)', s);
    afirma(s.sessao === null && !s.secoes.length, 'nenhum módulo à vista, nem pelo endereço (#conteudos, #admin, #treinamento)', s.secoes);
    afirma(await page.evaluate(() => !document.getElementById('reenviarVerificacao').hidden), 'oferece "Reenviar e-mail"');
    afirma(!(await escritasCadastro(page, PESSOA)).length && !s.lateral && !erros.length, 'nada gravado; sem rolagem lateral nem erro', erros);
    await ctx.close();
  }

  console.log('\nH/M. ' + rotulo + ' — sem cadastro, e-mail confirmado: só "Completar cadastro"');
  {
    const { ctx, page, erros } = await abrir(browser, viewport, { user: { email: PESSOA, emailVerified: true }, semCadastro: true, db: banco() }, '#home');
    await esperar(page, () => !document.getElementById('auth-completar').hidden);
    let s = await estado(page);
    afirma(s.completar && !s.verificacao && s.modal && s.travado && s.fechar === 'none' && s.sessao === null && !s.secoes.length,
      'só o painel "Completar cadastro", travado, sem sessão nem módulo', s);
    afirma(await page.evaluate((e) => document.getElementById('completarEmail').textContent === e, PESSOA), 'mostra o e-mail do login');
    await page.evaluate(() => { location.hash = '#admin'; }); await page.waitForTimeout(500);
    s = await estado(page);
    afirma(s.completar && !s.secoes.length && s.sessao === null, 'mudar o endereço para #admin não abre nada', s);
    /* validações: sem nome, sem área, sem termos */
    const tentar = async (nome, area, termos) => {
      await page.evaluate(({ nome, area, termos }) => {
        document.getElementById('completarNome').value = nome; document.getElementById('completarArea').value = area;
        document.getElementById('completarTerms').checked = termos; document.getElementById('completarForm').requestSubmit();
      }, { nome, area, termos });
      await page.waitForTimeout(250);
      return page.evaluate(() => { const e = document.getElementById('completarErr'); return e.hidden ? '' : e.textContent; });
    };
    const opcoes = await page.evaluate(() => Array.from(document.querySelectorAll('#completarArea option')).map((o) => o.value).filter(Boolean));
    const doCadastro = await page.evaluate(() => Array.from(document.querySelectorAll('#regAreaSelect li[data-val]')).map((l) => l.dataset.val));
    afirma(opcoes.length > 10 && JSON.stringify(opcoes) === JSON.stringify(doCadastro), 'as áreas são as mesmas do cadastro público', opcoes.length);
    afirma(/termos/.test(await tentar('Pessoa Exemplo', 'GECAT', false)), 'sem aceitar os termos: recusa');
    afirma(/Nome completo/.test(await tentar('', 'GECAT', true)), 'sem nome: recusa');
    afirma(/Área/.test(await tentar('Pessoa Exemplo', '', true)), 'sem área: recusa');
    afirma(!(await escritasCadastro(page, PESSOA)).length, 'nada gravado nas tentativas recusadas');
    await page.evaluate(() => { document.getElementById('completarOptin').checked = true; });
    await tentar('Pessoa Sem Cadastro Exemplo', 'GECAT', true);
    await esperar(page, () => window.faAuth.getSession() && document.getElementById('authModal').hidden);
    const esc = await escritasCadastro(page, PESSOA);
    const criou = esc.filter((x) => x.valor && x.valor.name);
    /* o falso guarda o mesmo objeto que gravou; a anotação da confirmação (gravação separada e legítima, logo depois)
       se mistura nele — por isso ela sai da comparação e é provada à parte */
    const v = Object.assign({}, (criou[0] || {}).valor || {}); delete v.emailConfirmado; delete v.emailConfirmadoEm;
    const anotacao = esc.filter((x) => x.valor && !x.valor.name);
    afirma(criou.length === 1 && criou[0].logado === PESSOA, 'UMA gravação do cadastro, feita pela própria pessoa', esc);
    afirma(anotacao.every((x) => Object.keys(x.valor).sort().join() === 'emailConfirmado,emailConfirmadoEm'), 'a outra gravação é só a anotação da confirmação (a de sempre)', anotacao);
    afirma(Object.keys(v).sort().join() === 'area,createdAt,email,emailVerificationRequired,name,optinTurmas' && v.email === PESSOA &&
      v.emailVerificationRequired === true && v.optinTurmas === true && v.area === 'GECAT', 'só os campos do cadastro público, com emailVerificationRequired', v);
    afirma(esc.every((x) => !x.valor || (x.valor.adminApproved === undefined && x.valor.blocked === undefined && x.valor.createdByAdmin === undefined)),
      'nenhum campo administrativo gravado', esc);
    s = await estado(page);
    afirma(s.sessao === PESSOA && !s.modal, 'depois de completar, passa pelas verificações normais e entra', s);
    await page.evaluate(() => { location.hash = '#turmas'; }); await page.waitForTimeout(600);
    afirma((await estado(page)).secoes.indexOf('page-turmas') !== -1, 'navegação normal depois de completar (#turmas)');
    afirma(!s.lateral && !erros.length, 'sem rolagem lateral nem erro de página', erros);
    await ctx.close();
  }

  console.log('\nI. ' + rotulo + ' — leitura do cadastro lenta');
  {
    const { ctx, page, erros } = await abrir(browser, viewport, { user: { email: PESSOA, emailVerified: true }, semCadastro: true, db: banco(), delays: { 'fa-users': 5000 } }, '#home');
    await page.waitForTimeout(2500);
    const s1 = await estado(page);
    afirma(!s1.completar && !s1.verificacao && s1.sessao === null, 'antes da resposta: nem "Completar", nem verificação', s1);
    await esperar(page, () => !document.getElementById('auth-completar').hidden, null, 15000);
    afirma(true, 'depois da resposta (sem cadastro, e-mail confirmado): "Completar cadastro"');
    afirma(!erros.length, 'sem erro de página', erros);
    await ctx.close();
  }

  console.log('\nJ. ' + rotulo + ' — leitura do cadastro com erro');
  {
    const { ctx, page, erros } = await abrir(browser, viewport, { user: { email: PESSOA, emailVerified: true }, semCadastro: true, db: banco(), fail: ['fa-users/' + chave(PESSOA)] }, '#home');
    await page.waitForTimeout(3000);
    const s = await estado(page);
    afirma(!s.completar && !s.verificacao && s.sessao === null && !s.secoes.length, 'erro de leitura nunca vira "sem cadastro" (nem completar, nem verificação), sem módulo', s);
    afirma(!(await escritasCadastro(page, PESSOA)).length && !erros.length, 'nada gravado; sem erro de página', erros);
    await ctx.close();
  }

  console.log('\nK. ' + rotulo + ' — login de fora da Previ, sem cadastro');
  {
    const fora = 'alguem@exemplo.com';
    const { ctx, page, erros } = await abrir(browser, viewport, { user: { email: fora, emailVerified: true }, semCadastro: true, db: banco() }, '#home');
    await page.waitForTimeout(2500);
    const s = await estado(page);
    afirma(s.logado === null && s.sessao === null && !s.completar && !s.verificacao && !s.secoes.length, 'sai (desconectado), sem painel nem módulo', s);
    afirma(!(await escritasCadastro(page, fora)).length && !erros.length, 'nada gravado; sem erro', erros);
    await ctx.close();
  }

  console.log('\nL. ' + rotulo + ' — o cadastro aparece enquanto a pessoa preenche');
  {
    const { ctx, page, erros } = await abrir(browser, viewport, { user: { email: PESSOA, emailVerified: true }, semCadastro: true, db: banco() }, '#home');
    await esperar(page, () => !document.getElementById('auth-completar').hidden);
    await page.evaluate((k) => { window.__CFG.db['fa-users'][k] = { email: 'pessoa.sem.cadastro@previ.com.br', name: 'NOME QUE JA EXISTIA', area: 'INFOR', adminApproved: true, createdAt: '2026-10-01T09:00:00.000Z' }; }, chave(PESSOA));
    await page.evaluate(() => {
      document.getElementById('completarNome').value = 'Outro Nome Digitado'; document.getElementById('completarArea').value = 'GECAT';
      document.getElementById('completarTerms').checked = true; document.getElementById('completarForm').requestSubmit();
    });
    await esperar(page, () => window.faAuth.getSession() && document.getElementById('authModal').hidden);
    const criou = (await escritasCadastro(page, PESSOA)).filter((x) => x.valor && x.valor.name);
    const s = await estado(page);
    afirma(!criou.length, 'nada sobrescrito', criou);
    afirma(s.sessao === PESSOA && await page.evaluate(() => window.faAuth.getSession().name) === 'NOME QUE JA EXISTIA', 'vale o cadastro que já existia, pelas verificações normais');
    afirma(!erros.length, 'sem erro de página', erros);
    await ctx.close();
  }
}

/* Padrão Visual Oficial (docs/padrao-visual.md) no painel novo, nos dois formatos */
async function padraoVisual(browser) {
  for (const vp of [{ width: 1366, height: 900 }, { width: 375, height: 812 }]) {
    const { ctx, page } = await abrir(browser, vp, { user: { email: PESSOA, emailVerified: true }, semCadastro: true, db: banco() }, '#home');
    await esperar(page, () => !document.getElementById('auth-completar').hidden);
    const pv = await verificarTela(page, { escopo: '#auth-completar', largura: vp.width });
    afirma(!pv.length, 'Padrão Visual Oficial no "Completar cadastro" (' + vp.width + ' px)', pv.map((x) => x.regra + ': ' + x.detalhe));
    await ctx.close();
  }
}
/* 375 px: o painel cabe, os campos e o botão estão inteiros e no padrão escuro (nada branco) */
async function visual375(browser) {
  console.log('\nVisual 375 px — "Completar cadastro"');
  const { ctx, page, erros } = await abrir(browser, { width: 375, height: 812 }, { user: { email: PESSOA, emailVerified: true }, semCadastro: true, db: banco() }, '#home');
  await esperar(page, () => !document.getElementById('auth-completar').hidden);
  const m = await page.evaluate(() => {
    const r = (id) => document.getElementById(id).getBoundingClientRect();
    const sel = document.getElementById('completarArea'), btn = document.querySelector('#completarForm [type=submit]');
    const dentro = ['completarNome', 'completarArea'].every((id) => r(id).left >= 0 && r(id).right <= innerWidth) && btn.getBoundingClientRect().right <= innerWidth;
    return { lateral: document.documentElement.scrollWidth > innerWidth + 1, dentro, fundo: getComputedStyle(sel).backgroundColor, cor: getComputedStyle(sel).color,
      alturaBtn: btn.getBoundingClientRect().height, fonteSel: parseFloat(getComputedStyle(sel).fontSize) };
  });
  afirma(!m.lateral && m.dentro, 'sem rolagem lateral; campos e botão inteiros', m);
  afirma(!/rgb\(255, 255, 255\)|rgba\(0, 0, 0, 0\)/.test(m.fundo) && m.cor !== 'rgb(0, 0, 0)', 'área no visual escuro do login (nada branco)', m);
  afirma(m.alturaBtn >= 40, 'botão com altura de toque', m.alturaBtn);
  afirma(!erros.length, 'sem erro de página', erros);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    await casosCriacao(browser, { width: 1366, height: 900 }, 'desktop');
    await casosEntrada(browser, { width: 1366, height: 900 }, 'desktop');
    await casosCriacao(browser, { width: 375, height: 812 }, '375 px');
    await casosEntrada(browser, { width: 375, height: 812 }, '375 px');
    await visual375(browser);
    await padraoVisual(browser);
  } finally { await browser.close(); }
  console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTUDO OK');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
