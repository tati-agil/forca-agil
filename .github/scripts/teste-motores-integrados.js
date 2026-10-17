/* MOTORES — ESCOLHA ÚNICA: ADMIN › Avaliações e Mapa → o cartão de um dos três motores (P1–P16, O1–O9, S1–S8) → a tela
 * daquele motor → Voltar. No computador e a 375 px. Prova:
 *   - o cartão abre direto o motor escolhido: sem uma segunda seleção dos três motores, sem título genérico;
 *   - o mesmo esqueleto em cada motor: nome e finalidade → situação (versão vigente, pendências à vista) → "Como este
 *     motor decide" (recolhido, específico do motor) → configurações e ações → versões anteriores e histórico (recolhidos);
 *   - um "← Voltar" só, para Avaliações e Mapa, que reabre o grupo dos três motores; o Voltar do navegador faz o mesmo;
 *   - link direto e F5 em cada motor (#admin?arq=motores, &m=o, motor-squad); teclado (Enter no cartão e no "Como
 *     decide"); perfil Avaliação + Configuração; sem rolagem lateral; nenhum erro de página.
 * Firebase falso em persistência real; hermético; nada é gravado. */
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
const decide = (page, id) => page.evaluate((i) => { const d = document.getElementById(i); return d ? { aberto: d.open, texto: d.textContent } : null; }, id);
/* uma tela de motor: o motor escolhido e mais nenhum; nenhuma segunda seleção; um Voltar visível */
const soEle = (page, id) => page.evaluate((i) => {
  const vis = (e) => !!e && e.offsetParent !== null;
  const motores = ['avpMotorArquitetural', 'avpMotorPosicionamento', 'sqMotorSquad'].filter((x) => vis(document.getElementById(x)));
  const voltas = [...document.querySelectorAll('#adminAvaliacaoProduto button, #adminAvaliacaoSquad button')].filter((b) => vis(b) && /^← Voltar para Avaliações e Mapa$/.test(b.textContent.trim()));
  return { motores, selecao: document.querySelectorAll('.avp-motores-aba, [role="tablist"]').length, voltas: voltas.length, generico: /Configuração dos Motores/.test((document.getElementById(i) || document.body).closest('#adminPanelArquitetura').innerText) };
}, id);
const MOTORES = [
  { cartao: '#avpConfigMotoresBtn', id: 'avpMotorArquitetural', hash: '#admin?arq=motores', chave: /O que classifica/, outros: /Tipo × estrutura concreta|Não cria Squad/, rotulo: 'P1–P16' },
  { cartao: '#avpMotorPosicionamentoInicioBtn', id: 'avpMotorPosicionamento', hash: '#admin?arq=motores&m=o', chave: /Tipo × estrutura concreta/, outros: /O que classifica|Não cria Squad/, rotulo: 'O1–O9' },
  { cartao: '#avpMotorSquadInicioBtn', id: 'sqMotorSquad', hash: '#admin?arq=motor-squad', chave: /Não cria Squad/, outros: /O que classifica|Tipo × estrutura concreta/, rotulo: 'S1–S8' }
];

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [nome, vp] of [['computador', { width: 1280, height: 900 }], ['375 px', { width: 375, height: 812 }]]) {
      console.log('\n== ' + nome + ': cada cartão abre só o seu motor; Voltar devolve ao grupo ==');
      let r = await abrir(browser, vp, '#admin?arq=inicio'); let page = r.page;
      await page.waitForSelector('#avpGrupoConfiguracao', { timeout: 20000 });
      for (const M of MOTORES) {
        await page.evaluate(() => { document.getElementById('avpGrupoConfiguracao').open = true; });
        if (M.rotulo === 'O1–O9') { await page.focus(M.cartao); await page.keyboard.press('Enter'); } else await page.click(M.cartao);
        await page.waitForSelector('#' + M.id, { state: 'visible', timeout: 15000 });
        const t = await soEle(page, M.id);
        afirma(JSON.stringify(t.motores) === JSON.stringify([M.id]) && t.selecao === 0 && t.voltas === 1 && !t.generico && await hash(page) === M.hash,
          M.rotulo + (M.rotulo === 'O1–O9' ? ' (Enter no cartão)' : '') + ': só este motor, sem segunda seleção, um "← Voltar" só, em ' + M.hash, t);
        if (M.rotulo === 'O1–O9') await ate(page, () => !!document.getElementById('avpPosVigente'), null, 'versão em vigor do O1–O9 lida');
        const d = await decide(page, M.id + 'Decide');
        afirma(!!d && !d.aberto && M.chave.test(d.texto) && !M.outros.test(d.texto) && /Versão (vigente|em vigor)/.test(await page.locator('#' + M.id + 'Situacao').innerText()),
          M.rotulo + ': versão à vista; "Como este motor decide" recolhido e só dele');
        if (M.rotulo === 'O1–O9') {
          await ate(page, () => !!document.getElementById('avpPosResumo'), null, 'pendência do O1–O9');
          afirma(await page.locator('#avpPosResumo').isVisible() && !(await page.evaluate(() => document.getElementById('avpPosAvancado').open)), 'O1–O9: pendência da versão preparada à vista; governança recolhida');
          await page.focus('#avpMotorPosicionamentoDecide > summary'); await page.keyboard.press('Enter');
          afirma((await decide(page, 'avpMotorPosicionamentoDecide')).aberto, 'Enter no "Como este motor decide" abre a explicação');
        }
        afirma(await larguraOk(page), M.rotulo + ' sem rolagem lateral');
        await page.click(M.id === 'sqMotorSquad' ? '#sqMotorVoltarLista' : '#avpMotoresVoltarLista');
        await ate(page, () => location.hash === '#admin?arq=inicio' && !!document.getElementById('avpGrupoConfiguracao') && document.getElementById('avpGrupoConfiguracao').open, null, 'de volta ao grupo');
        afirma(true, M.rotulo + ': "← Voltar" devolve a Avaliações e Mapa com o grupo dos três motores aberto');
      }
      /* Voltar do navegador: do motor ao grupo */
      await page.click('#avpMotorPosicionamentoInicioBtn');
      await page.waitForSelector('#avpMotorPosicionamento', { state: 'visible' });
      await page.goBack();
      await ate(page, () => location.hash === '#admin?arq=inicio' && !!document.getElementById('avpGrupoConfiguracao') && document.getElementById('avpGrupoConfiguracao').open, null, 'Voltar do navegador');
      afirma(true, 'Voltar do navegador: do motor ao grupo dos três motores');
      afirma(r.erros.length === 0, 'nenhum erro de página', r.erros);
      await r.ctx.close();

      console.log('\n== ' + nome + ': links diretos e F5 ==');
      for (const M of MOTORES) {
        r = await abrir(browser, vp, M.hash); page = r.page;
        await page.waitForSelector('#' + M.id, { state: 'visible', timeout: 20000 });
        await page.reload({ waitUntil: 'domcontentloaded' }); await esperarSessaoAssentada(page);
        await page.waitForSelector('#' + M.id, { state: 'visible', timeout: 20000 });
        afirma(await hash(page) === M.hash && JSON.stringify((await soEle(page, M.id)).motores) === JSON.stringify([M.id]), 'link direto e F5 em ' + M.hash + ': o mesmo motor, só ele');
        afirma(r.erros.length === 0, 'nenhum erro de página', r.erros);
        await r.ctx.close();
      }

      console.log('\n== ' + nome + ': perfil Avaliação + Configuração ==');
      r = await abrir(browser, vp, '#admin?arq=motores', { restrito: true }); page = r.page;
      await page.waitForSelector('#avpMotorArquitetural', { timeout: 20000 });
      afirma(await page.locator('#avpMotorArqEditarBtn').count() === 1 && await page.locator('.avp-motores-aba').count() === 0, '"Editar regras" (o perfil já podia editar), sem segunda seleção');
      await r.ctx.close();
    }
  } finally { await browser.close(); }
  console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
