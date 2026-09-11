/* "Enviar pedido" (página Ajuda) — nenhuma recusa pode ser silenciosa.
 *
 * POR QUE ESTE TESTE EXISTE
 * Relato de 11/09/2026: no iPhone, tocar em "Enviar pedido" não fazia nada.
 * Sem erro, sem mensagem, sem nada — e no Android funcionava. Não era o
 * iPhone: o botão NASCIA desabilitado (só ligava depois de escolher o tipo do
 * pedido) e não havia estilo de :disabled, então ele ficava pixel a pixel
 * idêntico a um botão vivo. Tocar num botão desabilitado não dispara evento
 * nenhum — o navegador engole o toque e não há o que mostrar na tela. Quem
 * não tinha escolhido o tipo concluía, com razão, que o site estava quebrado.
 *
 * No iPhone isso era muito mais fácil de cair porque o :hover GRUDA depois do
 * toque: um chip que o dedo só encostou ficava dourado igual a um escolhido
 * de verdade (o escolhido se distinguia por um color-mix que o Safari mais
 * velho descarta). Dava pra jurar que tinha escolhido o tipo sem ter escolhido.
 *
 * O segundo silêncio era o oposto: gravação que nunca responde deixava o
 * botão em "Enviando…" para sempre, sem timeout — a mesma tela calada do
 * PR #116, agora num formulário.
 *
 * A REGRA QUE ESTE TESTE IMPÕE: depois de tocar em "Enviar pedido", alguma
 * coisa SEMPRE muda na tela — sucesso, ou uma frase dizendo o que fazer.
 * Silêncio é falha, em qualquer caminho, nos dois formatos de tela.
 */

const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');

const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const EMAIL = 'pessoa@previ.com.br';

function banco() {
  const users = {};
  users[chave(EMAIL)] = { name: 'PESSOA TESTE', email: EMAIL, area: 'TI' };
  return {
    'fa-users': users, 'fa-admins': {}, 'fa-diretores': {}, 'fa-facilitadores': {},
    turmas: {}, eventos: {}, 'turmas-interesse': {}, 'turmas-config': {}, 'turmas-checkin': {},
    'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {}, 'fa-espera': {},
    'fa-progress': {}, pedidos: {}, avaliacoes: {},
  };
}

/* O que a pessoa vê do formulário: o rótulo do botão, se ele aceita toque, a
   mensagem ao lado e o bloco de sucesso. */
function lerForm(page) {
  return page.evaluate(() => {
    const b  = document.querySelector('#pedEnviar');
    const m  = document.querySelector('#pedMsg');
    const ok = document.querySelector('.ped-sucesso');
    const cs = b ? getComputedStyle(b) : null;
    return {
      existe:   !!b,
      rotulo:   b ? b.textContent.trim() : '',
      desabilitado: b ? b.disabled : false,
      opacidade: cs ? Number(cs.opacity) : 1,
      msg:      m ? m.textContent.trim() : '',
      sucesso:  !!ok,
    };
  });
}

async function abrir(browser, formato, cfgExtra) {
  const ctx = await browser.newContext(formato.opts);
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify(Object.assign({
    db: banco(), user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 20,
  }, cfgExtra || {})) + ';');
  await page.route('**/firebasejs/**', (r) =>
    r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) =>
    r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#ajuda', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pedEnviar', { timeout: 15000 });
  return { ctx, page, erros };
}

const FORMATOS = [
  { nome: 'desktop', opts: { viewport: { width: 1440, height: 900 } } },
  { nome: 'celular', opts: devices['iPhone 13'] },
];

(async () => {
  const browser = await chromium.launch();
  const falhas = [];
  const anota = (linha, problemas) => {
    if (problemas.length) {
      falhas.push(linha + ' → ' + problemas.join('; '));
      console.log('  FALHA ' + linha + ' → ' + problemas.join('; '));
    } else {
      console.log('  ok    ' + linha);
    }
  };

  for (const formato of FORMATOS) {
    console.log('\n===== ' + formato.nome.toUpperCase() + ' =====');

    /* 1. Tocar em ENVIAR sem ter escolhido o tipo — o caso relatado.
          O botão tem que RESPONDER, dizendo o que falta. */
    {
      const { ctx, page, erros } = await abrir(browser, formato);
      const antes = await lerForm(page);
      /* force: true porque um dedo real TOCA no botão mesmo desabilitado — é
         exatamente esse toque que não produzia nada. Sem isto o Playwright se
         recusa a clicar e o teste morre de exceção em vez de relatar o bug. */
      await page.click('#pedEnviar', { force: true });
      await page.waitForTimeout(400);
      const depois = await lerForm(page);
      const p = [];
      if (antes.desabilitado) p.push('o botão ainda NASCE desabilitado — tocar nele não dispara nada');
      if (!depois.msg) p.push('SILÊNCIO: tocar em Enviar sem escolher o tipo não disse nada');
      if (depois.sucesso) p.push('enviou sem tipo escolhido');
      if (erros.length) p.push('erro JS: ' + erros[0]);
      anota('sem escolher o tipo, o botão explica o que falta', p);
      await ctx.close();
    }

    /* 2. Caminho feliz. */
    {
      const { ctx, page, erros } = await abrir(browser, formato);
      await page.click('.ped-tipo-btn[data-tipo="tema"]');
      await page.fill('#pedTexto', 'Gostaria de aprender sobre OKR.');
      await page.click('#pedEnviar');
      await page.waitForTimeout(800);
      const d = await lerForm(page);
      const p = [];
      if (!d.sucesso) p.push('não confirmou o envio (rótulo: "' + d.rotulo + '", msg: "' + d.msg + '")');
      if (erros.length) p.push('erro JS: ' + erros[0]);
      anota('escolhendo o tipo, o pedido é enviado e confirmado', p);
      await ctx.close();
    }

    /* 3. O chip escolhido se distingue por FORMA, não só por cor — no iPhone
          o hover gruda e cor sozinha não diz quem está escolhido. */
    {
      const { ctx, page } = await abrir(browser, formato);
      await page.click('.ped-tipo-btn[data-tipo="curso"]');
      const marca = await page.evaluate(() => {
        const a = document.querySelector('.ped-tipo-btn[data-tipo="curso"]');
        const b = document.querySelector('.ped-tipo-btn[data-tipo="tema"]');
        const sinal = (el) => getComputedStyle(el, '::before').content;
        return { escolhido: sinal(a), outro: sinal(b), temActive: a.classList.contains('active') };
      });
      const p = [];
      if (!marca.temActive) p.push('o chip tocado não ficou marcado como escolhido');
      if (!marca.escolhido || marca.escolhido === 'none' || marca.escolhido === marca.outro) {
        p.push('o chip escolhido não tem marca própria além da cor (::before: ' + marca.escolhido + ')');
      }
      anota('o tipo escolhido se distingue por forma, não só por cor', p);
      await ctx.close();
    }

    /* 4. Gravação que NUNCA responde: não pode ficar "Enviando…" pra sempre.
          O timeout do código é 12s; esperamos um pouco mais. */
    {
      const { ctx, page, erros } = await abrir(browser, formato, { delays: { pedidos: 999000 } });
      await page.click('.ped-tipo-btn[data-tipo="material"]');
      await page.click('#pedEnviar');
      const durante = await lerForm(page);
      const pd = [];
      if (durante.desabilitado && durante.opacidade > 0.9) {
        pd.push('durante o envio o botão fica desabilitado mas com cara de clicável (opacidade ' + durante.opacidade + ')');
      }
      anota('durante o envio, o botão desabilitado parece desabilitado', pd);

      let voltou = null;
      try {
        await page.waitForFunction(() => {
          const b = document.querySelector('#pedEnviar');
          const m = document.querySelector('#pedMsg');
          return b && !b.disabled && m && m.textContent.trim();
        }, { timeout: 20000 });
        voltou = await lerForm(page);
      } catch (e) { voltou = await lerForm(page); }
      const p = [];
      if (voltou.rotulo === 'Enviando…' || voltou.desabilitado) {
        p.push('TRAVOU CALADO: continua "' + voltou.rotulo + '" sem explicação depois de 20s');
      }
      if (!voltou.msg) p.push('SILÊNCIO: a gravação não respondeu e nada foi dito');
      if (erros.length) p.push('erro JS: ' + erros[0]);
      anota('gravação que nunca responde volta a permitir tentar, com aviso', p);
      await ctx.close();
    }

    /* 5. Gravação recusada pelo banco: erro visível e botão utilizável. */
    {
      const { ctx, page, erros } = await abrir(browser, formato, { fail: ['pedidos'] });
      await page.click('.ped-tipo-btn[data-tipo="duvida"]');
      await page.click('#pedEnviar');
      await page.waitForTimeout(800);
      const d = await lerForm(page);
      const p = [];
      if (!d.msg) p.push('SILÊNCIO: a gravação falhou e nada foi dito');
      if (d.desabilitado) p.push('o botão ficou travado depois do erro — não dá pra tentar de novo');
      if (d.sucesso) p.push('disse que enviou, mas a gravação falhou');
      if (erros.length) p.push('erro JS: ' + erros[0]);
      anota('gravação recusada mostra erro e libera nova tentativa', p);
      await ctx.close();
    }
  }

  await browser.close();

  if (falhas.length) {
    console.error('\n' + falhas.length + ' falha(s):');
    falhas.forEach((f) => console.error('  - ' + f));
    process.exit(1);
  }
  console.log('\nTudo certo: o "Enviar pedido" nunca fica calado, nos dois formatos de tela.');
})();
