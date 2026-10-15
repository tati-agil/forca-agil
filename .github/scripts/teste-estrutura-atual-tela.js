/* ESTRUTURA ORGANIZACIONAL ATUAL — a tela do ADMIN › Avaliação e Mapa (#admin?arq=estrutura-atual). Firebase falso em
 * persistência real; hermético; o banco é o da página (nada vai para produção; GECON e núcleos são dados de teste).
 * Prova, pela interface:
 *   A. Marcador: ausente = DESLIGADO — só consulta, sem "Nova unidade"; só o admin geral libera, com motivo.
 *   B. Admin geral: cria a GECON (gerência) e, pela ficha dela, os quatro núcleos; árvore em ordem; edita; altera a
 *      unidade superior (a própria e as subordinadas não aparecem); encerrar com subordinada ativa é bloqueado;
 *      encerra um núcleo com motivo; histórico com cada evento; F5 continua na área.
 *   C. Avaliação + Configuração mantém com o marcador liberado; Avaliação só consulta; com DESLIGADO ninguém edita.
 *   D. 375 px sem rolagem lateral nem corte. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const { semente, ARQ, AVAL, chave } = require('./semente-jornada');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const ADM = 'admin.geral@previ.com.br';
let falhas = 0, total = 0;
function afirma(c, msg, det) { total++; console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + (typeof det === 'string' ? det : JSON.stringify(det)) : '')); if (!c) falhas++; }
function db0(cfg) {
  const db = semente();
  db['fa-admins'] = Object.assign({}, db['fa-admins'] || {}, { [chave(ADM)]: true });
  db['fa-users'][chave(ADM)] = { name: 'Admin', email: ADM, area: 'INFOR' };
  if (cfg) db['estrutura-atual-config'] = { habilitacao: cfg, motivo: 'semente', alteradoEm: 1, alteradoPor: { uid: 'x', email: ADM }, auditoriaId: 'a0' };
  return db;
}
async function abrir(browser, viewport, opts) {
  opts = opts || {};
  const email = opts.email || ADM;
  const cfg = { db: opts.db || db0(opts.cfg), user: { email, emailVerified: true, uid: 'u-' + chave(email) }, uidDoUsuario: true, prefixoChave: 'e' + (++abrir.n) + 'x', delayDefault: 10, persistenciaReal: true };
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  page.on('dialog', (d) => d.accept());
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + (opts.hash || '#admin?arq=estrutura-atual'), { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  if (!opts.hash) await page.waitForSelector('#adminEstruturaAtual:not([hidden]) #eaMarcador', { timeout: 20000 });
  return { ctx, page, erros };
}
abrir.n = 0;
const esperar = (page, fn, arg) => esperarCondicao(page, fn, arg, { limite: 15000 });
const banco = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal)));
const texto = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent : ''; }, sel);
const existe = (page, sel) => page.evaluate((s) => !!document.querySelector(s), sel);
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const estouro = (page) => page.evaluate(() => Array.from(document.querySelectorAll('#adminEstruturaAtual *')).filter((e) => e.offsetParent && e.getBoundingClientRect().right > window.innerWidth + 1).map((e) => e.tagName + '#' + e.id).slice(0, 5));
const unidades = async (page) => (await banco(page))['estrutura-atual-unidades'] || {};
const idPorSigla = async (page, s) => { const u = await unidades(page); return Object.keys(u).find((k) => u[k].sigla === s); };
async function preencher(page, d) {
  await page.fill('#eaNome', d.nome); if (d.sigla) await page.fill('#eaSigla', d.sigla);
  await page.selectOption('#eaNivel', d.nivel);
}
async function criar(page, d, botao) {
  await page.click(botao || '#eaNovaBtn'); await page.waitForSelector('#eaFormUnidade');
  await preencher(page, d); await page.click('#eaGravar');
  await page.waitForSelector('#eaFicha'); await esperar(page, (n) => (document.getElementById('eaFichaNome') || {}).textContent === n, d.nome);
}

(async () => {
  const browser = await chromium.launch();
  try {
    console.log('\n== A. Marcador: ausente = DESLIGADO ==');
    let { ctx, page, erros } = await abrir(browser, { width: 1280, height: 900 });
    afirma(/Desligada/.test(await texto(page, '#eaMarcadorValor')) && !(await existe(page, '#eaNovaBtn')) && /Não é a Estrutura Organizacional do Mapa/.test(await texto(page, '#adminEstruturaAtual')), 'DESLIGADO: só consulta, sem "Nova unidade"; separado das Estruturas do Mapa');
    await page.click('#eaMarcadorDet > summary'); await page.click('#eaMarcadorGravar');
    await page.waitForSelector('#eaErro'); afirma(/motivo/i.test(await texto(page, '#eaErro')), 'liberar exige motivo');
    await page.evaluate(() => { document.getElementById('eaMarcadorDet').open = true; });
    await page.fill('#eaMarcadorMotivo', 'Homologação da GECON (teste)'); await page.click('#eaMarcadorGravar');
    await page.waitForSelector('#eaNovaBtn');
    const b = await banco(page);
    afirma(b['estrutura-atual-config'].habilitacao === 'LIBERADO' && Object.values(b['estrutura-atual-config-auditoria']).some((x) => x.anterior === 'DESLIGADO' && x.motivo === 'Homologação da GECON (teste)'), 'admin geral libera, com motivo e auditoria; aparece "Nova unidade"');
    afirma(!b['analises-organizacionais-config'], 'o marcador da Análise Organizacional não é tocado');

    console.log('\n== B. Cadastro: GECON e núcleos, ficha, edição, superior, encerramento, histórico ==');
    await criar(page, { nome: 'Gerência de Contabilidade e Controladoria', sigla: 'GECON', nivel: 'gerencia' });
    const gecon = await idPorSigla(page, 'GECON');
    for (const [s, n] of [['NUTES', 'Núcleo de Tesouraria'], ['CONTA', 'Núcleo de Contabilidade'], ['NUTRI', 'Núcleo Tributário'], ['NUCOT', 'Núcleo de Controle']]) {
      await page.click('#eaVoltar'); await page.waitForSelector('#eaAbrir_' + gecon);
      await page.click('#eaAbrir_' + gecon); await esperar(page, () => /GECON/.test((document.getElementById('eaTitulo') || {}).textContent || '') && !!document.getElementById('eaCriarSubordinada'));
      await page.click('#eaCriarSubordinada'); await page.waitForSelector('#eaFormUnidade');
      afirma(/Nova subordinada de GECON/.test(await texto(page, '#eaTitulo')) && (await page.$eval('#eaSuperior', (x) => x.value)) === gecon, s + ': criada pela ficha da GECON, com a superior já escolhida');
      await preencher(page, { nome: n, sigla: s, nivel: 'nucleo' }); await page.click('#eaGravar');
      await esperar(page, (nn) => (document.getElementById('eaFichaNome') || {}).textContent === nn, n);
    }
    let u = await unidades(page);
    afirma(['NUTES', 'CONTA', 'NUTRI', 'NUCOT'].every((s) => Object.values(u).some((x) => x.sigla === s && x.superiorId === gecon && x.nivel === 'nucleo')) && Object.keys((await banco(page))['estrutura-atual-filhos'][gecon]).length === 4, 'quatro núcleos subordinados à GECON, com o índice');
    await page.click('#eaVoltar'); await page.waitForSelector('#eaArvore');
    const ordem = await page.$$eval('#eaArvore .ea-no-nome', (l) => l.map((x) => x.textContent));
    afirma(ordem[0] === 'GECON — Gerência de Contabilidade e Controladoria' && ordem.length === 5, 'árvore: a GECON e, abaixo, os núcleos', ordem);
    const conta = await idPorSigla(page, 'CONTA'), nucot = await idPorSigla(page, 'NUCOT');
    await page.click('#eaAbrir_' + conta); await page.click('#eaEditarBtn'); await page.waitForSelector('#eaFormUnidade');
    await page.fill('#eaFonte', 'Regimento interno (teste)'); await page.fill('#eaVigencia', '2026-01-01'); await page.click('#eaGravar');
    await esperar(page, () => /Regimento interno/.test((document.getElementById('eaFicha') || {}).textContent || ''));
    afirma((await unidades(page))[conta].revisao === 2, 'edição: revisão 2');
    await page.click('[data-ea="ficha"][data-id="' + gecon + '"]'); await page.waitForSelector('#eaSuperiorBtn');
    await page.click('#eaSuperiorBtn'); await page.waitForSelector('#eaNovaSuperior');
    const ops = await page.$$eval('#eaNovaSuperior option', (l) => l.map((x) => x.value));
    afirma(ops.indexOf(gecon) === -1 && ops.indexOf(conta) === -1 && ops.indexOf('') === 0, 'alterar superior: a própria unidade e as subordinadas dela não aparecem (sem ciclo)');
    await page.click('[data-ea="voltar-ficha"]'); await page.click('#eaEncerrarBtn');
    await page.waitForSelector('#eaEncerrarBloqueado');
    afirma(/4 subordinadas ativas/.test(await texto(page, '#eaEncerrarBloqueado')) && !(await existe(page, '#eaConfirmarEncerrar')), 'encerrar a GECON com subordinadas ativas: bloqueado, com o motivo');
    await page.click('[data-ea="voltar-ficha"]'); await page.click('[data-ea="ficha"][data-id="' + nucot + '"]'); await page.click('#eaEncerrarBtn');
    await page.waitForSelector('#eaFormEncerrar'); await page.click('#eaConfirmarEncerrar');
    await page.waitForSelector('#eaErro'); afirma(/motivo/i.test(await texto(page, '#eaErro')), 'encerrar exige motivo');
    await page.fill('#eaMotivoEncerrar', 'Fusão com a CONTA (teste)'); await page.click('#eaConfirmarEncerrar');
    await esperar(page, () => /Encerrada em/.test((document.getElementById('eaFichaSituacao') || {}).textContent || ''));
    u = await unidades(page);
    afirma(u[nucot].situacao === 'encerrada' && u[nucot].encerramento.motivo === 'Fusão com a CONTA (teste)' && !(await existe(page, '#eaAcoes')) && !((await banco(page))['estrutura-atual-filhos'][gecon] || {})[nucot], 'NUCOT encerrado com motivo: sem ações, fora do índice, nada apagado');
    await page.click('#eaHistorico > summary');
    await esperar(page, () => /Encerrada\. Motivo: Fusão com a CONTA/.test((document.getElementById('eaEventos') || {}).textContent || ''));
    afirma(/Criada subordinada a GECON/.test(await texto(page, '#eaEventos')), 'histórico: criação e encerramento, com autoria');
    await page.click('#eaVoltar'); await page.waitForSelector('#eaArvore');
    afirma(!(await existe(page, '#eaAbrir_' + nucot)), 'árvore sem as encerradas');
    await page.check('#eaMostrarEncerradas'); afirma(await existe(page, '#eaAbrir_' + nucot), '"Mostrar encerradas" mostra o NUCOT');
    const dbLiberado = await banco(page);
    await page.reload({ waitUntil: 'domcontentloaded' }); await esperarSessaoAssentada(page);
    await page.waitForSelector('#adminEstruturaAtual:not([hidden]) #eaMarcador', { timeout: 20000 });
    afirma(await page.evaluate(() => location.hash) === '#admin?arq=estrutura-atual', 'F5: continua na Estrutura Organizacional Atual');
    afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
    await ctx.close();

    console.log('\n== C. Perfis ==');
    ({ ctx, page, erros } = await abrir(browser, { width: 1280, height: 900 }, { email: ARQ, db: dbLiberado }));
    await page.waitForSelector('#eaNovaBtn');
    await page.click('#eaAbrir_' + gecon); await page.waitForSelector('#eaCriarSubordinada');
    afirma(!(await existe(page, '#eaMarcadorDet')), 'Avaliação + Configuração mantém com o marcador liberado; não muda o marcador');
    await ctx.close();
    /* Avaliação não entra no ADMIN: consulta a Estrutura Atual pela Porta 2 (escolha da área e de quem executa) */
    ({ ctx, page, erros } = await abrir(browser, { width: 1280, height: 900 }, { email: AVAL, db: dbLiberado, hash: '#avaliacoes' }));
    await esperar(page, () => { const l = window.faEstruturaAtualAdmin.unidadesAtivas(); return Array.isArray(l) && l.length > 0; });
    const lidas = await page.evaluate(() => window.faEstruturaAtualAdmin.unidadesAtivas().map((x) => x.unidade.sigla));
    afirma(lidas.indexOf('GECON') !== -1 && lidas.indexOf('CONTA') !== -1 && lidas.indexOf('NUCOT') === -1 && await page.evaluate(() => !document.getElementById('eaNovaBtn')), 'Avaliação: lê as unidades ativas (para a Porta 2), sem tela de edição', lidas);
    await ctx.close();
    const dbDesl = JSON.parse(JSON.stringify(dbLiberado)); dbDesl['estrutura-atual-config'].habilitacao = 'DESLIGADO';
    ({ ctx, page, erros } = await abrir(browser, { width: 1280, height: 900 }, { email: ARQ, db: dbDesl }));
    await page.waitForSelector('#eaArvore');
    afirma(!(await existe(page, '#eaNovaBtn')) && await existe(page, '#eaAbrir_' + gecon), 'DESLIGADO: Avaliação + Configuração consulta, não edita (a unidade continua)');
    await ctx.close();

    console.log('\n== D. 375 px ==');
    ({ ctx, page, erros } = await abrir(browser, { width: 375, height: 812 }, { db: dbLiberado }));
    await page.waitForSelector('#eaArvore');
    afirma(await larguraOk(page) && !(await estouro(page)).length, '375: árvore sem rolagem lateral nem corte', await estouro(page));
    await page.click('#eaAbrir_' + conta); await page.waitForSelector('#eaAcoes');
    afirma(await larguraOk(page) && !(await estouro(page)).length, '375: ficha e ações sem corte', await estouro(page));
    await page.click('#eaEditarBtn'); await page.waitForSelector('#eaFormUnidade');
    afirma(await larguraOk(page) && !(await estouro(page)).length, '375: formulário sem corte', await estouro(page));
    afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
    await ctx.close();
  } catch (e) { console.log('ERRO', e && e.stack || e); falhas++; }
  await browser.close();
  console.log('\n' + total + ' verificações — ' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})();
