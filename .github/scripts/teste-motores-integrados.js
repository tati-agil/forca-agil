/* CONFIGURAÇÃO DOS MOTORES INTEGRADA — os três motores (P1–P16, O1–O9, S1–S8) com o mesmo cabeçalho, o mesmo seletor e o
 * mesmo esqueleto (identificação → situação → como decide → configurações e ações → versões anteriores → histórico), no
 * computador e a 375 px. Prova:
 *   - o seletor alterna entre os três sem voltar ao início, e o endereço acompanha (#admin?arq=motores, &m=o, motor-squad);
 *   - link direto e F5 em cada motor; Voltar do navegador do S1–S8 volta ao motor de antes;
 *   - "Como este motor decide" recolhido e específico de cada motor (nenhum texto de outro motor);
 *   - a pendência do O1–O9 (versão preparada e inativa) e a versão vigente ficam à vista, sem abrir nada;
 *   - teclado (Enter no seletor e no "Como decide"); perfil Avaliação + Configuração com os três motores; sem rolagem lateral;
 *     nenhum erro de página. Firebase falso em persistência real; hermético; nada é gravado. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarCondicao, esperarSessaoAssentada } = require('./esperas');
const SJ = require('./semente-jornada');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
let falhas = 0;
function afirma(c, msg, det) { console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + JSON.stringify(det) : '')); if (!c) falhas++; }

async function abrir(browser, vp, hash, o) {
  const db = SJ.semente();
  db['fa-admins'] = o && o.restrito ? {} : { [SJ.chave(SJ.ARQ)]: { email: SJ.ARQ, name: 'ADMIN' } };
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify({ db, user: { email: SJ.ARQ, emailVerified: true, uid: 'u1' }, delayDefault: 5, persistenciaReal: true }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + hash, { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
const ate = (page, fn, arg, descricao) => esperarCondicao(page, fn, arg, { limite: 15000, descricao });
const hash = (page) => page.evaluate(() => location.hash);
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const selecionado = (page) => page.evaluate(() => { const b = [...document.querySelectorAll('.avp-motores-aba')].filter((x) => x.offsetParent && x.getAttribute('aria-selected') === 'true'); return b.length === 1 ? b[0].getAttribute('data-motor') : b.length; });
const decide = (page, id) => page.evaluate((i) => { const d = document.getElementById(i); return d ? { aberto: d.open, texto: d.textContent } : null; }, id);

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [nome, vp] of [['computador', { width: 1280, height: 900 }], ['375 px', { width: 375, height: 812 }]]) {
      console.log('\n== ' + nome + ': os três motores, o mesmo padrão ==');
      let r = await abrir(browser, vp, '#admin?arq=motores'); let page = r.page;
      await page.waitForSelector('#avpMotorArquitetural', { timeout: 20000 });
      afirma(JSON.stringify(await page.locator('.avp-motores-aba strong').allTextContents()) === JSON.stringify(['Produto/Serviço', 'Posicionamento Organizacional', 'Adequação à Gestão por Squad']) && await selecionado(page) === 'p',
        'cabeçalho "Configuração dos Motores" com os três motores no seletor; P1–P16 selecionado');
      afirma(/Consulte as regras, versões e configurações dos motores utilizados nas avaliações\./.test(await page.locator('.avp-motores-desc').textContent()), 'descrição curta da tela');
      const p = await decide(page, 'avpMotorArquiteturalDecide');
      afirma(/Versão vigente: \d+/.test(await page.locator('#avpMotorArquiteturalSituacao').innerText()) && !p.aberto && /O que classifica/.test(p.texto) && !/Tipo × estrutura concreta|Não cria Squad/.test(p.texto),
        'P1–P16: versão vigente à vista; "Como este motor decide" recolhido e só dele');
      afirma(await larguraOk(page), 'P1–P16 sem rolagem lateral');
      /* teclado: Enter no seletor e no "Como decide" */
      await page.focus('#avpMotorAba_o'); await page.keyboard.press('Enter');
      await page.waitForSelector('#avpMotorPosicionamento #avpPosVigente, #avpMotorPosicionamento .loading-msg', { timeout: 15000 });
      await ate(page, () => !!document.getElementById('avpPosResumo') || !!document.getElementById('avpPosVigente'), null, 'O1–O9 carregado');
      afirma(await hash(page) === '#admin?arq=motores&m=o' && await selecionado(page) === 'o' && await page.locator('#avpMotorArquitetural').count() === 0, 'Enter no seletor: O1–O9, com o endereço #admin?arq=motores&m=o e só ele na tela');
      const o = await decide(page, 'avpMotorPosicionamentoDecide');
      afirma(!o.aberto && /Tipo × estrutura concreta/.test(o.texto) && /A validar/.test(o.texto) && !/O que classifica|Não cria Squad/.test(o.texto), 'O1–O9: "Como este motor decide" recolhido e só dele (tipo × estrutura concreta, A validar)');
      afirma(await page.locator('#avpPosVigente').isVisible() && await page.locator('#avpPosResumo').isVisible() && !(await page.evaluate(() => document.getElementById('avpPosAvancado').open)),
        'O1–O9: versão em vigor e a pendência da versão preparada à vista; a governança recolhida');
      await page.focus('#avpMotorPosicionamentoDecide > summary'); await page.keyboard.press('Enter');
      afirma((await decide(page, 'avpMotorPosicionamentoDecide')).aberto, 'Enter no "Como este motor decide" abre a explicação');
      /* S1–S8 pelo seletor; o Voltar do navegador volta ao motor de antes */
      await page.click('#avpMotorAba_s');
      await page.waitForSelector('#adminAvaliacaoSquad #sqMotorSquad', { state: 'visible', timeout: 15000 });
      const s = await decide(page, 'sqMotorSquadDecide');
      afirma(await hash(page) === '#admin?arq=motor-squad' && await selecionado(page) === 's' && !s.aberto && /Não cria Squad/.test(s.texto) && !/O que classifica|Tipo × estrutura concreta/.test(s.texto),
        'S1–S8: mesmo cabeçalho e seletor, no endereço de sempre; "Como este motor decide" recolhido e só dele');
      afirma(await larguraOk(page), 'S1–S8 sem rolagem lateral');
      await page.goBack();
      await ate(page, () => !!document.getElementById('avpMotorPosicionamento') && document.getElementById('adminAvaliacaoSquad').hidden, null, 'Voltar do navegador ao O1–O9');
      afirma(await selecionado(page) === 'o', 'Voltar do navegador: de volta ao motor de antes (O1–O9)');
      afirma(r.erros.length === 0, 'nenhum erro de página', r.erros);
      await r.ctx.close();

      console.log('\n== ' + nome + ': links diretos e F5 ==');
      for (const [h, m, sel] of [['#admin?arq=motores&m=o', 'o', '#avpMotorPosicionamento'], ['#admin?arq=motor-squad', 's', '#adminAvaliacaoSquad #sqMotorSquad'], ['#admin?arq=motores', 'p', '#avpMotorArquitetural']]) {
        r = await abrir(browser, vp, h); page = r.page;
        await page.waitForSelector(sel, { state: 'visible', timeout: 20000 });
        afirma(await selecionado(page) === m, 'link direto ' + h + ': o motor certo selecionado');
        await page.reload({ waitUntil: 'domcontentloaded' }); await esperarSessaoAssentada(page);
        await page.waitForSelector(sel, { state: 'visible', timeout: 20000 });
        afirma(await selecionado(page) === m && await hash(page) === h, 'F5 em ' + h + ': continua no mesmo motor');
        afirma(r.erros.length === 0, 'nenhum erro de página', r.erros);
        await r.ctx.close();
      }

      console.log('\n== ' + nome + ': perfil Avaliação + Configuração ==');
      r = await abrir(browser, vp, '#admin?arq=motores', { restrito: true }); page = r.page;
      await page.waitForSelector('#avpMotorArquitetural', { timeout: 20000 });
      afirma(await page.locator('.avp-motores-aba').count() === 3 && await page.locator('#avpMotorArqEditarBtn').count() === 1, 'os três motores no seletor e "Editar regras" (o perfil já podia editar)');
      await r.ctx.close();
    }
  } finally { await browser.close(); }
  console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
