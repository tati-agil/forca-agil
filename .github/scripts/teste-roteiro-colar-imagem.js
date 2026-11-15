/* Roteiro: imagem colada num campo de texto rico precisa ser GRAVADA.
 *
 * POR QUE ESTE TESTE EXISTE
 * Colar uma imagem (print de tela, "Copiar imagem") no Passo a passo de uma
 * atividade mostrava a imagem na caixa, mas o Salvar a descartava sem aviso:
 * o sanitizador só conhecia tags de texto, e <img> era removido. Pela regra
 * do repositório ("ou não deixa mexer ou deixa e salva"), isso é uma tela
 * quebrada. Agora a imagem é reduzida no navegador (lado maior até 1200 px,
 * JPEG, até ~350 KB) e gravada no próprio texto do campo como data:image —
 * o site não tem Firebase Storage. Qualquer outra imagem (endereço externo,
 * blob:) continua sendo removida pelo sanitizador.
 *
 * O QUE ELE EXIGE, em desktop e iPhone (Firebase falso):
 *   1. colar uma imagem GRANDE (3000×2000) sem texto no Passo a passo insere
 *      uma <img> data:image/jpeg reduzida (lado maior ≤ 1200 px, ≤ 350 KB);
 *   2. Salvar grava essa imagem no banco, junto com o texto que já existia;
 *   3. um <img> com endereço externo (http) no mesmo campo NÃO é gravado;
 *   4. colar algo com texto E imagem (como o Excel faz) cola só o texto;
 *   5. reabrir a atividade mostra a imagem de novo, sem passar da largura da
 *      caixa (sem rolagem horizontal no celular);
 *   6. um campo que tem SÓ a imagem (sem texto) também é gravado;
 *   7. nenhum erro de JavaScript não tratado.
 */

const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');

const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const ADM = 'adm@previ.com.br';

function banco() {
  const users = {}; users[chave(ADM)] = { name: 'ADMIN', email: ADM, area: 'INFOR' };
  const admins = {}; admins[chave(ADM)] = { email: ADM };
  return {
    'fa-users': users, 'fa-admins': admins, 'fa-diretores': {}, 'fa-facilitadores': {},
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: { ev1: { nome: 'EVENTO TESTE', order: 1, publicado: true, cargaHoraria: '8' } },
    turmas: {},
    'turmas-interesse': {}, 'turmas-interesse-log': {}, 'turmas-config': {}, 'turmas-checkin': {},
    'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {}, 'turmas-sorteio': {},
    avaliacoes: {}, pedidos: {}, holocron: {},
    'roteiros-evento': {
      ev1: {
        dias: { d1: { ordem: 10, titulo: '' } },
        atividades: {
          a1: {
            diaKey: 'd1', ordem: 10, titulo: 'Atividade com imagem',
            tipo: 'Dinâmica', horaInicio: '09:00', horaFim: '09:20', duracaoMinutos: 20,
            passoAPasso: 'Peça que cada participante escreva individualmente.',
          },
        },
      },
    },
  };
}

async function abrirRoteiroBase(browser, formato) {
  const ctx = await browser.newContext(formato.opts);
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify({
    db: banco(), user: { email: ADM, emailVerified: true, uid: 'u1' }, delayDefault: 15,
  }) + ';');
  await page.route('**/firebasejs/**', (r) =>
    r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) =>
    r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.admin-tab-btn', { timeout: 15000 });
  await page.waitForTimeout(400);
  await page.locator('[data-ev-key="ev1"] .ev-toggle-icon').click();
  await page.waitForTimeout(300);
  await page.locator('[data-ev-key="ev1"] button', { hasText: 'Roteiro' }).first().click();
  await page.waitForTimeout(400);
  return { ctx, page, erros };
}

/* Dispara um "paste" de verdade (ClipboardEvent com DataTransfer) no campo,
   com o cursor no fim do texto. comImagem gera um PNG com ruído (não
   comprime bem — força a redução de tamanho); texto opcional junto. */
function colar(page, seletor, { comImagem, texto, largura, altura }) {
  return page.evaluate(async ({ seletor, comImagem, texto, largura, altura }) => {
    const area = document.querySelector(seletor);
    area.focus();
    const sel = window.getSelection(); const r = document.createRange();
    r.selectNodeContents(area); r.collapse(false); sel.removeAllRanges(); sel.addRange(r);
    const dt = new DataTransfer();
    if (texto) dt.setData('text/plain', texto);
    if (comImagem) {
      const cv = document.createElement('canvas'); cv.width = largura; cv.height = altura;
      const cx = cv.getContext('2d'); const id = cx.createImageData(largura, altura);
      let s = 7; for (let i = 0; i < id.data.length; i++) { s = (s * 16807) % 2147483647; id.data[i] = i % 4 === 3 ? 255 : s & 255; }
      cx.putImageData(id, 0, 0);
      const blob = await new Promise((ok) => cv.toBlob(ok, 'image/png'));
      dt.items.add(new File([blob], 'print.png', { type: 'image/png' }));
    }
    area.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, { seletor, comImagem, texto, largura: largura || 300, altura: altura || 200 });
}

async function esperarImagens(page, seletor, n) {
  await page.waitForFunction(({ seletor, n }) => document.querySelectorAll(seletor + ' img').length >= n, { seletor, n }, { timeout: 15000 });
}

const lerAtividade = (page) => page.evaluate(() => window.__CFG.db['roteiros-evento'].ev1.atividades.a1);
const lerDimensoes = (src) => ({ bytes: Math.round((src.length - src.indexOf(',') - 1) * 0.75) });

async function testar(browser, formato) {
  const { ctx, page, erros } = await abrirRoteiroBase(browser, formato);
  try {
    await page.locator('.modal-box button', { hasText: 'Editar' }).first().click();
    await page.waitForSelector('#rfPasso');

    /* 1. imagem grande, sem texto */
    await colar(page, '#rfPasso', { comImagem: true, largura: 3000, altura: 2000 });
    await esperarImagens(page, '#rfPasso', 1);
    const info = await page.evaluate(() => new Promise((ok) => {
      const img = document.querySelector('#rfPasso img'); const i = new Image();
      i.onload = () => ok({ src: img.getAttribute('src'), w: i.naturalWidth, h: i.naturalHeight }); i.src = img.getAttribute('src');
    }));
    if (!/^data:image\/jpeg;base64,/.test(info.src)) throw new Error('a imagem colada não virou data:image/jpeg: ' + info.src.slice(0, 40));
    if (Math.max(info.w, info.h) > 1200) throw new Error(`imagem não foi reduzida: ${info.w}×${info.h}`);
    const { bytes } = lerDimensoes(info.src);
    if (bytes > 350 * 1024) throw new Error(`imagem ficou grande demais: ${bytes} bytes`);
    console.log(`  ok    colar imagem 3000×2000 → JPEG ${info.w}×${info.h}, ${Math.round(bytes / 1024)} KB`);

    /* 4. texto + imagem (Excel) → só o texto */
    await colar(page, '#rfPasso', { comImagem: true, texto: 'CELULA A\tCELULA B' });
    await page.waitForTimeout(300);
    const nImgs = await page.locator('#rfPasso img').count();
    if (nImgs !== 1) throw new Error(`colar texto+imagem deveria colar só o texto, mas há ${nImgs} imagens`);
    if (!/CELULA A/.test(await page.locator('#rfPasso').innerText())) throw new Error('colar texto+imagem não colou o texto');
    console.log('  ok    colar texto + imagem (como o Excel) cola só o texto');

    /* 3. imagem externa enfiada no campo não pode ser gravada */
    await page.evaluate(() => { document.querySelector('#rfPasso').insertAdjacentHTML('beforeend', '<img src="https://exemplo.com/x.png">'); });

    /* 6. campo só com imagem: Dicas */
    await colar(page, '#rfDicas', { comImagem: true, largura: 400, altura: 300 });
    await esperarImagens(page, '#rfDicas', 1);

    await page.locator('.roteiro-form-salvar').click();
    await page.waitForTimeout(400);
    const a = await lerAtividade(page);
    if (!/Peça que cada participante/.test(a.passoAPasso)) throw new Error('o texto que já existia sumiu ao salvar');
    if ((a.passoAPasso.match(/<img src="data:image\/jpeg;base64,/g) || []).length !== 1) throw new Error('a imagem colada não foi gravada no Passo a passo: ' + a.passoAPasso.slice(0, 200));
    if (/exemplo\.com/.test(a.passoAPasso)) throw new Error('uma imagem de endereço externo foi gravada');
    if (!/<img src="data:image\/jpeg;base64,/.test(a.dicasFacilitador || '')) throw new Error('campo só com imagem não foi gravado: ' + JSON.stringify(a.dicasFacilitador));
    console.log('  ok    Salvar grava a imagem com o texto; imagem externa descartada; campo só com imagem gravado');

    /* 5. reabrir mostra a imagem, dentro da largura da caixa */
    await page.locator('.modal-box button', { hasText: 'Editar' }).first().click();
    await page.waitForSelector('#rfPasso img');
    const caber = await page.evaluate(() => {
      const area = document.querySelector('#rfPasso'), img = area.querySelector('img');
      return { img: img.getBoundingClientRect().width, area: area.clientWidth, rola: document.documentElement.scrollWidth > window.innerWidth };
    });
    if (caber.img > caber.area + 1) throw new Error(`imagem passa da largura da caixa (${caber.img} > ${caber.area})`);
    if (caber.rola) throw new Error('a página ganhou rolagem horizontal');
    await page.locator('.roteiro-form-salvar').click();
    await page.waitForTimeout(400);
    const b = await lerAtividade(page);
    if (b.passoAPasso !== a.passoAPasso) throw new Error('reabrir e salvar sem editar mudou o valor gravado');
    console.log(`  ok    reabrir mostra a imagem (${Math.round(caber.img)} px na caixa de ${caber.area}); salvar de novo não altera nada`);

    if (erros.length) throw new Error('erro de JS não tratado: ' + erros[0]);
  } finally {
    await ctx.close();
  }
}

(async () => {
  const FORMATOS = [
    { nome: 'desktop', opts: { viewport: { width: 1280, height: 800 } } },
    { nome: 'iPhone', opts: devices['iPhone 12'] },
  ];
  let falhas = 0;
  for (const formato of FORMATOS) {
    const browser = await chromium.launch();
    try {
      console.log(`\n== ${formato.nome} ==`);
      await testar(browser, formato);
    } catch (e) {
      falhas++;
      console.error(`  FALHA [${formato.nome}]: ${e.message}`);
    } finally {
      await browser.close();
    }
  }
  if (falhas) { console.error(`\n${falhas} falha(s).`); process.exit(1); }
  console.log('\nTudo certo nos dois formatos.');
})();
