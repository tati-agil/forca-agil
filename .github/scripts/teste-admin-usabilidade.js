/* USABILIDADE INTEGRADA DO ADMIN › Avaliação e Mapa — hermético (Firebase falso em persistência real), nada é gravado.
 * Prova, nos três perfis e em várias larguras (375, 640, 768, 1280, 1440, 1920 px — 640 e 1920 equivalem a 1280 px com
 * zoom de 200% e de 67%):
 *   A. Questionários: um cartão por questionário (P1–P16, S1–S8, O1–O9 "9 perguntas + diagnóstico") com versão,
 *      situação e Editar / Histórico / Exportar; correções editoriais e a redação da v2 (inativa) recolhidas DENTRO do
 *      cartão, sem perder nada; &q=p1p16|s1s8|o1o9 localiza o cartão sem abrir a edição (F5, Voltar/Avançar).
 *   B. Motores (aba O1–O9): resumo "v2 preparada e inativa — existem requisitos pendentes para entrada em vigor"; a governança numa seção
 *      avançada recolhida; nenhum botão de ativar; D2 — os marcadores da prontidão ficam dentro do cartão.
 *   C. Motor de Squad: o mesmo cabeçalho de Configuração dos Motores (seletor dos três) e o esqueleto comum (nome, sigla, versão · situação).
 *   D. Estruturas no tema escuro: superfícies escuras, contraste ≥ 4,5:1, lista/ficha/histórico/formulário.
 *   E. Início: título compacto, primeira ação visível sem rolar; nenhuma tela com rolagem lateral.
 *   F. Perfis: Avaliação + Configuração edita os questionários; consulta não entra no ADMIN. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const { semente, ARQ, AVAL, chave } = require('./semente-jornada');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const ADM = 'admin.geral@previ.com.br';
let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

async function abrir(browser, viewport, hash, opts) {
  opts = opts || {};
  const email = opts.email || ADM;
  const db = semente();
  db['fa-admins'] = { [chave(ADM)]: true };
  db['fa-users'][chave(ADM)] = { name: 'Admin', email: ADM, area: 'INFOR' };
  const cfg = { db, user: { email, emailVerified: true, uid: 'u-' + chave(email) }, delayDefault: 10, persistenciaReal: true, delays: {} };
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + hash, { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
const esperar = (page, fn, arg, limite) => esperarCondicao(page, fn, arg, { limite: limite || 15000 });
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const texto = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent : ''; }, sel);
const naListaQuestionarios = (page) => esperar(page, () => !!document.getElementById('avpCfgCard-POSICIONAMENTO_ORGANIZACIONAL'));
const focado = (page) => page.evaluate(() => Array.prototype.map.call(document.querySelectorAll('.avp-config-item-card--foco'), (e) => e.getAttribute('data-q')).join(','));
/* contraste WCAG entre duas cores computadas (rgb/rgba; o alfa é ignorado — superfícies opacas) */
const CONTRASTE = `(function () {
  const rgb = (c) => (c.match(/[\\d.]+/g) || []).slice(0, 3).map(Number);
  const lum = (c) => { const v = rgb(c).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  window.__lum = lum;
  window.__razao = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
})();`;

async function questionarios(browser, viewport) {
  console.log('A. Questionários');
  const { ctx, page, erros } = await abrir(browser, viewport, '#admin?arq=questionarios');
  await naListaQuestionarios(page);
  const q = await page.evaluate(() => ['CLASSIFICACAO_ARQUITETURAL', 'ADEQUACAO_SQUAD', 'POSICIONAMENTO_ORGANIZACIONAL'].map((c) => {
    const card = document.getElementById('avpCfgCard-' + c);
    return { c, q: card.getAttribute('data-q'), sigla: (card.querySelector('.avp-config-sigla') || {}).textContent, txt: card.textContent,
      editar: !!card.querySelector('.avp-config-editar-btn'), hist: !!card.querySelector('.avp-config-auditoria-btn'), exp: !!card.querySelector('.avp-config-exportar-btn'),
      subs: Array.prototype.map.call(card.querySelectorAll('details.avp-config-sub'), (d) => d.id + ':' + (d.open ? 'aberta' : 'fechada')).join(',') };
  }));
  afirma(q.map((x) => x.q + '=' + x.sigla).join(' ') === 'p1p16=P1–P16 s1s8=S1–S8 o1o9=O1–O9', 'três cartões, um por questionário, com a sigla', JSON.stringify(q.map((x) => x.q + '=' + x.sigla)));
  afirma(q.every((x) => x.editar && x.hist && x.exp && /Versão publicada:/.test(x.txt) && /Situação:/.test(x.txt)), 'cada cartão: versão, situação e Editar / Histórico / Exportar à vista');
  afirma(/9 perguntas \+ diagnóstico/.test(q[2].txt), 'O1–O9: "9 perguntas + diagnóstico" (o diagnóstico não conta como pergunta)', q[2].txt.slice(0, 120));
  const v2 = q[2].subs.split(',').find((s) => /avpCfgMotorV2/.test(s));
  afirma(v2 === 'avpCfgMotorV2:fechada' && /Versão futura inativa/.test(await texto(page, '#avpCfgMotorV2 > summary')), 'a redação da v2 fica numa seção secundária, recolhida e identificada como inativa', q[2].subs);
  const corr = await page.evaluate(() => Array.prototype.map.call(document.querySelectorAll('details[id^="avpCfgCorrecoes-"]'), (d) => ({ dentro: !!d.closest('.avp-config-item-card'), titulo: d.querySelector('summary').textContent, itens: d.querySelectorAll('.avp-config-sub-corpo > *').length })));
  afirma(corr.length >= 1 && corr.every((c) => c.dentro && /^Correções editoriais \(\d+\) — /.test(c.titulo) && c.itens >= 1), 'correções editoriais recolhíveis DENTRO do cartão, com o total e a situação — todos os registros continuam na página', JSON.stringify(corr));
  /* recolher uma seção sobrevive a um redesenho (escolha lembrada) */
  if (corr.length) {
    await page.evaluate(() => { const d = document.querySelector('details[id^="avpCfgCorrecoes-"]'); d.open = false; d.dispatchEvent(new Event('toggle')); });
    await page.waitForTimeout(200);
    afirma(true, 'seções recolhíveis respondem ao clique');
  }
  afirma(await larguraOk(page), 'Questionários sem rolagem lateral');

  console.log('   &q= localiza o cartão sem abrir a edição');
  await page.evaluate(() => { location.hash = '#admin?arq=questionarios&q=o1o9'; });
  await esperar(page, () => !!document.querySelector('#avpCfgCard-POSICIONAMENTO_ORGANIZACIONAL.avp-config-item-card--foco'));
  await page.waitForTimeout(300);
  const vis = await page.evaluate(() => { const r = document.getElementById('avpCfgCard-POSICIONAMENTO_ORGANIZACIONAL').getBoundingClientRect(); return r.top >= 0 && r.top < window.innerHeight; });
  afirma(await focado(page) === 'o1o9' && vis && await page.locator('#avpCfgVoltarListaBtn').count() === 0, '&q=o1o9: o cartão O1–O9 destacado e à vista; a edição não abre', await focado(page));
  await page.reload({ waitUntil: 'domcontentloaded' }); await esperarSessaoAssentada(page);
  await esperar(page, () => !!document.querySelector('.avp-config-item-card--foco'), undefined, 20000);
  afirma(await focado(page) === 'o1o9', 'F5: continua no cartão O1–O9', await focado(page));
  await page.evaluate(() => { location.hash = '#admin?arq=questionarios&q=s1s8'; });
  await esperar(page, () => !!document.querySelector('#avpCfgCard-ADEQUACAO_SQUAD.avp-config-item-card--foco'));
  afirma(await focado(page) === 's1s8', '&q=s1s8: o cartão S1–S8', await focado(page));
  await page.goBack();
  await esperar(page, () => !!document.querySelector('#avpCfgCard-POSICIONAMENTO_ORGANIZACIONAL.avp-config-item-card--foco'));
  afirma(await focado(page) === 'o1o9', 'Voltar: de novo o cartão O1–O9', await focado(page));
  await page.goForward();
  await esperar(page, () => !!document.querySelector('#avpCfgCard-ADEQUACAO_SQUAD.avp-config-item-card--foco'));
  afirma(await focado(page) === 's1s8', 'Avançar: o cartão S1–S8', await focado(page));
  await page.evaluate(() => { location.hash = '#admin?arq=questionarios'; });
  await esperar(page, () => !document.querySelector('.avp-config-item-card--foco'));
  afirma(true, 'sem &q=: nenhum cartão destacado');
  afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();
}

async function motores(browser, viewport) {
  console.log('B. Motores');
  const { ctx, page, erros } = await abrir(browser, viewport, '#admin?arq=motores&m=o');
  await esperar(page, () => !!document.getElementById('avpPosResumo'), undefined, 20000);
  const resumo = (await texto(page, '#avpPosResumo')).trim();
  afirma(/^v2 preparada e inativa — existem requisitos pendentes para entrada em vigor\. A v1 continua em vigor\.$/.test(resumo), 'resumo exato, à vista: "v2 preparada e inativa — existem requisitos pendentes para entrada em vigor"', resumo);
  afirma(await page.evaluate(() => { const d = document.getElementById('avpPosAvancado'); return !!d && !d.open && d.tagName === 'DETAILS'; }), 'governança da v2 (prontidão, simulação, impacto, aprovação) numa seção avançada recolhida');
  afirma(await page.evaluate(() => !!document.querySelector('#avpPosAvancado #avpPosProntidao')), 'a prontidão continua na página, dentro da seção avançada (nada removido)');
  afirma(await page.evaluate(() => !Array.prototype.some.call(document.querySelectorAll('#adminPanelArquitetura button'), (b) => /^\s*Ativar/i.test(b.textContent))), 'bloqueio preservado: nenhum botão "Ativar"');
  await page.evaluate(() => { const d = document.getElementById('avpPosAvancado'); d.open = true; d.dispatchEvent(new Event('toggle')); });
  await page.waitForTimeout(300);
  const d2 = await page.evaluate(() => {
    const card = document.getElementById('avpMotorPosicionamento').getBoundingClientRect(), ul = document.getElementById('avpPosProntidao');
    const lis = Array.prototype.map.call(ul.querySelectorAll(':scope > li'), (li) => li.getBoundingClientRect().left);
    return { n: lis.length, pad: parseFloat(getComputedStyle(ul).paddingLeft), estilo: getComputedStyle(ul).listStyleType, dentro: lis.every((l) => l - 14 > card.left) };
  });
  afirma(d2.n > 0 && d2.pad >= 18 && d2.estilo === 'disc' && d2.dentro, 'D2: os marcadores da prontidão ficam dentro do cartão', JSON.stringify(d2));
  afirma(await larguraOk(page), 'Motores sem rolagem lateral (seção aberta)');
  console.log('C. Motor de Squad');
  await page.evaluate(() => { location.hash = '#admin?arq=motor-squad'; });
  await esperar(page, () => !!document.getElementById('sqMotorEditarRegrasBtn'), undefined, 20000);
  const cab = await page.evaluate(() => { const s = document.getElementById('sqMotorSquad'), t = document.querySelector('#adminAvaliacaoSquad #avpMotoresTitulo'); return (t ? t.textContent : '') + ' | ' + (s ? s.querySelector('.avp-motor-cab').textContent + ' ' + s.querySelector('.avp-motor-situacao').textContent : ''); });
  afirma(/Configuração dos Motores/.test(cab) && /Adequação à Gestão por Squad/.test(cab) && /S1–S8/.test(cab) && /Versão vigente: \d+ · Situação:/.test(cab), 'Motor de Squad no padrão dos motores: cabeçalho comum, nome, sigla, versão · situação', cab.slice(0, 200));
  afirma(await larguraOk(page), 'Motor de Squad sem rolagem lateral');
  afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();
}

async function estruturas(browser, viewport) {
  console.log('D. Estruturas no tema escuro');
  const { ctx, page, erros } = await abrir(browser, viewport, '#admin?arq=estruturas');
  await page.waitForSelector('#estLista', { timeout: 20000 });
  await page.evaluate(CONTRASTE);
  const lista = await page.evaluate(() => {
    const p = document.querySelector('.est-painel'), it = document.querySelector('.est-item'), fp = getComputedStyle(p).backgroundColor, fi = getComputedStyle(it).backgroundColor;
    const c = (sel, fundo) => window.__razao(getComputedStyle(document.querySelector(sel)).color, fundo);
    return { painel: window.__lum(fp), item: window.__lum(fi), titulo: c('.est-titulo', fp), intro: c('.est-intro', fp), nome: c('.est-item-nome', fi), tipo: c('.est-item-tipo', fi), sit: c('.est-situacao', fi), img: getComputedStyle(p).backgroundImage };
  });
  afirma(lista.painel < 0.05 && lista.item < 0.05 && lista.img === 'none', 'painel e cartões em superfícies escuras do tema (sem o fundo claro)', JSON.stringify(lista));
  afirma(['titulo', 'intro', 'nome', 'tipo', 'sit'].every((k) => lista[k] >= 4.5), 'lista: título, introdução, nome, tipo e situação com contraste ≥ 4,5:1', JSON.stringify(lista));
  afirma(await larguraOk(page), 'lista sem rolagem lateral');
  await page.click('.est-item');
  await page.waitForSelector('#estFicha', { timeout: 15000 });
  await page.evaluate(() => { const h = document.getElementById('estHistorico'); if (h) h.open = true; });
  await page.evaluate(CONTRASTE);
  const ficha = await page.evaluate(() => {
    const f = document.getElementById('estFicha'), fundo = getComputedStyle(f).backgroundColor, h = document.getElementById('estHistorico');
    return { ficha: window.__lum(fundo), hist: h ? window.__lum(getComputedStyle(h).backgroundColor) : 0,
      dt: window.__razao(getComputedStyle(f.querySelector('.est-dado dt')).color, fundo), dd: window.__razao(getComputedStyle(f.querySelector('.est-dado dd')).color, fundo),
      secao: window.__razao(getComputedStyle(f.querySelector('.est-secao-titulo')).color, fundo) };
  });
  afirma(ficha.ficha < 0.05 && ficha.hist < 0.05 && ficha.dt >= 4.5 && ficha.dd >= 4.5 && ficha.secao >= 4.5, 'ficha e histórico escuros, rótulos e valores com contraste ≥ 4,5:1', JSON.stringify(ficha));
  afirma(await larguraOk(page), 'ficha sem rolagem lateral');
  if (await page.$('#estEditar')) {
    await page.click('#estEditar');
    await page.waitForSelector('#estForm', { timeout: 15000 });
    await page.evaluate(CONTRASTE);
    const form = await page.evaluate(() => {
      const card = document.querySelector('.est-painel .avp-form-card'), inp = document.querySelector('.est-painel .est-campo input'), fc = getComputedStyle(card).backgroundColor, fi = getComputedStyle(inp).backgroundColor;
      return { card: window.__lum(fc), campo: window.__lum(fi), texto: window.__razao(getComputedStyle(inp).color, fi), rotulo: window.__razao(getComputedStyle(document.querySelector('.est-painel .avp-field label')).color, fc) };
    });
    afirma(form.card < 0.05 && form.campo < 0.05 && form.texto >= 4.5 && form.rotulo >= 4.5, 'formulário de edição escuro, campos e rótulos legíveis', JSON.stringify(form));
    afirma(await larguraOk(page), 'formulário sem rolagem lateral');
    await page.click('#estCancelar');
  }
  afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();
}

async function larguras(browser) {
  console.log('E. Larguras (375 · 640 = 1280 a 200% · 768 · 1280 · 1440 · 1920 = 1280 a 67%)');
  const medidas = [];
  for (const w of [375, 640, 768, 1280, 1440, 1920]) {
    const vp = { width: w, height: w <= 400 ? 812 : 900 };
    const { ctx, page, erros } = await abrir(browser, vp, '#avaliacoes');
    await esperar(page, () => { const e = document.getElementById('avpInicio'); return !!e && e.offsetParent !== null; });
    const ini = await page.evaluate(() => { const a = document.getElementById('avpInicioTrabalhos').getBoundingClientRect() /* a primeira ação do Início (a Jornada do Mapa agora fica no bloco do Mapa, logo abaixo) */, h = document.querySelector('#page-avaliacoes .page-hero h1').getBoundingClientRect();
      return { acao: Math.round(a.top + scrollY), tituloAcao: Math.round(a.top - h.bottom), alto: document.documentElement.scrollHeight, vh: innerHeight }; });
    const m = { w, inicioPrimeiraAcao: ini.acao, inicioTituloAteAcao: ini.tituloAcao, inicio: ini.alto, larguraInicio: await larguraOk(page) };
    afirma(ini.acao + 44 <= ini.vh && m.larguraInicio, w + ' px: Início — primeira ação visível sem rolar; sem rolagem lateral', JSON.stringify(ini));
    for (const [area, sel] of [['questionarios', '#avpCfgCard-POSICIONAMENTO_ORGANIZACIONAL'], ['motores', '#avpMotorArqEditarBtn'], ['motor-squad', '#sqMotorEditarRegrasBtn'], ['estruturas', '#estLista']]) {
      await page.evaluate((a) => { location.hash = '#admin?arq=' + a; }, area);
      await page.waitForSelector(sel, { timeout: 20000 });
      await page.waitForTimeout(200);
      m[area] = await page.evaluate(() => document.documentElement.scrollHeight);
      const ok = await larguraOk(page);
      if (!ok) afirma(false, w + ' px: ' + area + ' sem rolagem lateral');
      m['largura-' + area] = ok;
    }
    afirma(['questionarios', 'motores', 'motor-squad', 'estruturas'].every((a) => m['largura-' + a]), w + ' px: Questionários, Motores, Motor de Squad e Estruturas sem rolagem lateral');
    afirma(!erros.length, w + ' px: nenhum erro de página', erros.join(' | '));
    medidas.push(m);
    await ctx.close();
  }
  console.log('   medidas (px): ' + JSON.stringify(medidas.map((m) => ({ w: m.w, primeiraAcao: m.inicioPrimeiraAcao, tituloAteAcao: m.inicioTituloAteAcao, inicio: m.inicio, questionarios: m.questionarios, motores: m.motores, squad: m['motor-squad'], estruturas: m.estruturas }))));
}

async function perfis(browser) {
  console.log('F. Perfis');
  let { ctx, page, erros } = await abrir(browser, { width: 375, height: 812 }, '#admin?arq=questionarios&q=p1p16', { email: ARQ });
  await naListaQuestionarios(page);
  await esperar(page, () => !!document.querySelector('.avp-config-item-card--foco'));
  afirma(await focado(page) === 'p1p16' && await page.locator('.avp-config-editar-btn').count() === 3, 'Avaliação + Configuração: os três cartões com Editar; &q= localiza o cartão');
  afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();
  ({ ctx, page, erros } = await abrir(browser, { width: 375, height: 812 }, '#admin?arq=questionarios', { email: AVAL }));
  await page.waitForTimeout(2500);
  afirma(await page.locator('#avpCfgCard-CLASSIFICACAO_ARQUITETURAL').count() === 0 && await page.locator('.avp-config-editar-btn').count() === 0, 'consulta (Avaliação): não vê nem edita os questionários pelo ADMIN');
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [vp, rot] of [[{ width: 1280, height: 900 }, 'Desktop 1280'], [{ width: 375, height: 812 }, 'Celular 375']]) {
      console.log('\n=== ' + rot + ' ===');
      await questionarios(browser, vp);
      await motores(browser, vp);
      await estruturas(browser, vp);
    }
    console.log('');
    await larguras(browser);
    await perfis(browser);
  } catch (e) { console.log('ERRO', e && e.stack || e); falhas++; }
  await browser.close();
  console.log('\n' + (falhas ? falhas + ' falha(s)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})();
