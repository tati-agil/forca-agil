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

/* Do outro lado do pedido: o painel. Um banco com UM pedido de cada tipo,
   para conferir como cada rótulo se comporta na lista do admin. */
const ADM = 'adm@previ.com.br';

function bancoAdmin(tipos) {
  const users = {};
  users[chave(ADM)] = { name: 'ADMIN TESTE', email: ADM, area: 'TI' };
  const admins = {}; admins[chave(ADM)] = { email: ADM, name: 'ADMIN TESTE' };
  const pedidos = {};
  tipos.forEach(function (t, i) {
    pedidos['p' + i] = {
      tipo: t, descricao: 'Pedido do tipo ' + t + '.', nomeEnviou: 'PESSOA TESTE',
      emailEnviou: EMAIL, dataEnvio: '2026-09-0' + ((i % 8) + 1) + 'T10:00:00.000Z',
    };
  });
  return {
    'fa-users': users, 'fa-admins': admins, 'fa-diretores': {}, 'fa-facilitadores': {},
    turmas: {}, eventos: {}, 'turmas-interesse': {}, 'turmas-config': {}, 'turmas-checkin': {},
    'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {}, 'fa-espera': {},
    'fa-progress': {}, 'fa-users-log': {}, 'fa-reset-signal': {}, 'turmas-interesse-log': {},
    'turmas-sorteio': {}, holocron: {}, pedidos: pedidos, avaliacoes: {},
  };
}

async function abrirAdminPedidos(browser, formato, tipos) {
  const ctx = await browser.newContext(formato.opts);
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify({
    db: bancoAdmin(tipos), user: { email: ADM, emailVerified: true, uid: 'u1' }, delayDefault: 20,
  }) + ';');
  await page.route('**/firebasejs/**', (r) =>
    r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) =>
    r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.admin-tab-btn', { timeout: 15000 });
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('.admin-tab-btn'))
      .find((x) => /Pedidos/i.test(x.textContent));
    if (b) b.click();
  });
  await page.waitForSelector('.ped-admin-badge', { timeout: 15000 });
  return { ctx, page, erros };
}

const FORMATOS = [
  { nome: 'desktop', opts: { viewport: { width: 1440, height: 900 } } },
  { nome: 'celular', opts: devices['iPhone 13'] },
];

(async () => {
  const browser = await chromium.launch();
  const falhas = [];
  /* Preenchido ao ler os chips do formulário público: assim o teste do lado
     do admin usa exatamente os tipos que o site oferece hoje, sem uma
     segunda lista para alguém esquecer de atualizar. */
  let tiposDoSite = [];
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

    /* 1b. O formulário aparece SEM ROLAR, e antes do FAQ.
           Ele já morou no fim da página, embaixo de sete perguntas: quem não
           rolava até o rodapé não descobria que dava para pedir alguma coisa.
           Um canal que ninguém vê não existe, então a posição é requisito —
           principalmente no celular, onde o cabeçalho da página sozinho já
           gastava a tela inteira. */
    {
      const { ctx, page, erros } = await abrir(browser, formato);
      const m = await page.evaluate(() => {
        const form = document.querySelector('#pedidosFormWrap');
        const faq  = document.querySelector('.faq-list');
        const chips = document.querySelector('.ped-tipos');
        const ultimoChip = document.querySelectorAll('.ped-tipo-btn');
        return {
          temFaq: !!faq,
          pedidoAntesDoFaq: !!(faq && (form.compareDocumentPosition(faq) & Node.DOCUMENT_POSITION_FOLLOWING)),
          topoChips: chips.getBoundingClientRect().top + window.scrollY,
          fimDosChips: ultimoChip.length
            ? ultimoChip[ultimoChip.length - 1].getBoundingClientRect().bottom + window.scrollY
            : Infinity,
          tela: window.innerHeight,
        };
      });
      const p = [];
      if (!m.temFaq) p.push('não achei o FAQ para comparar a posição');
      else if (!m.pedidoAntesDoFaq) p.push('o formulário voltou para DEPOIS do FAQ — fica escondido de novo');
      if (m.fimDosChips > m.tela) {
        p.push('ENTERRADO: os tipos de pedido só aparecem rolando (terminam em ' +
          Math.round(m.fimDosChips) + 'px numa tela de ' + m.tela + 'px)');
      }
      if (erros.length) p.push('erro JS: ' + erros[0]);
      anota('o formulário aparece sem rolar e antes do FAQ', p);
      await ctx.close();
    }

    /* 1c. TODO tipo oferecido grava o tipo que diz.
           O tipo é só um <button> com data-tipo e um rótulo; nada liga um ao
           outro além do código que lê o atributo no clique. Um tipo novo
           entra na lista e parece funcionar — o chip acende, o envio confirma
           — mesmo que o que chegue no banco seja outro, ou nada. E isso não
           dá erro: quem descobre é o admin, meses depois, com um pedido no
           balde errado. Este caso percorre a lista inteira, então um tipo
           novo passa a ser exercitado no dia em que é criado, sem ninguém
           lembrar de escrever um teste para ele. */
    {
      const { ctx, page, erros } = await abrir(browser, formato);
      const tipos = await page.evaluate(() => Array.from(document.querySelectorAll('.ped-tipo-btn'))
        .map((b) => ({ key: b.dataset.tipo, rotulo: (b.textContent || '').trim() })));
      tiposDoSite = tipos.map((t) => t.key);
      const p = [];
      if (tipos.length < 2) p.push('a lista de tipos veio com ' + tipos.length + ' opção(ões) — algo não renderizou');
      const semRotulo = tipos.filter((t) => !t.rotulo || !t.key);
      if (semRotulo.length) p.push(semRotulo.length + ' tipo(s) sem rótulo ou sem chave');

      for (const t of tipos) {
        await page.click('.ped-tipo-btn[data-tipo="' + t.key + '"]');
        await page.fill('#pedTexto', 'Pedido de teste do tipo ' + t.key + '.');
        await page.click('#pedEnviar');
        await page.waitForSelector('.ped-sucesso', { timeout: 10000 });
        const gravado = await page.evaluate(() => {
          const w = (window.__ESCRITAS || []).filter((e) => e.path.indexOf('pedidos') === 0);
          return w.length ? w[w.length - 1].valor : null;
        });
        if (!gravado) p.push(t.rotulo + ': confirmou o envio mas não gravou nada');
        else if (gravado.tipo !== t.key) {
          p.push(t.rotulo + ': gravou tipo "' + gravado.tipo + '" em vez de "' + t.key + '"');
        }
        /* Volta ao formulário limpo para o próximo tipo. */
        await page.click('.ped-outro-btn');
        await page.waitForSelector('.ped-tipo-btn', { timeout: 10000 });
      }
      if (erros.length) p.push('erro JS: ' + erros[0]);
      anota('cada tipo oferecido grava o tipo que diz (' + tipos.length + ' tipos)', p);
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

    /* 2b. Depois de enviar, dá pra mandar OUTRO sem recarregar a página.
           Antes o sucesso substituía o formulário e não devolvia nada: o
           caminho feliz terminava num beco sem saída, e a única saída era o
           F5 — que no celular, na sala, é onde a pessoa desiste. */
    {
      const { ctx, page, erros } = await abrir(browser, formato);
      await page.click('.ped-tipo-btn[data-tipo="tema"]');
      await page.click('#pedEnviar');
      await page.waitForSelector('.ped-sucesso', { timeout: 10000 });
      const p = [];
      const temBotao = await page.evaluate(() => !!document.querySelector('.ped-outro-btn'));
      if (!temBotao) {
        p.push('BECO SEM SAÍDA: depois de enviar não há como fazer outro pedido sem recarregar');
        anota('depois de enviar, dá pra fazer outro sem recarregar', p);
      } else {
        await page.click('.ped-outro-btn');
        await page.waitForSelector('#pedEnviar', { timeout: 10000 });
        const limpo = await page.evaluate(() => {
          const t = document.querySelector('#pedTexto');
          const ativos = document.querySelectorAll('.ped-tipo-btn.active').length;
          const m = document.querySelector('#pedMsg');
          return {
            texto: t ? t.value : null,
            tiposAtivos: ativos,
            msg: m ? m.textContent.trim() : '',
            aindaTemSucesso: !!document.querySelector('.ped-sucesso'),
          };
        });
        if (limpo.texto) p.push('o formulário voltou com a descrição do pedido anterior: "' + limpo.texto + '"');
        if (limpo.tiposAtivos !== 0) p.push('o formulário voltou com o tipo anterior ainda escolhido');
        if (limpo.msg) p.push('o formulário voltou com mensagem sobrando: "' + limpo.msg + '"');
        if (limpo.aindaTemSucesso) p.push('a confirmação do envio anterior continua na tela junto do formulário');
        if (erros.length) p.push('erro JS: ' + erros[0]);
        anota('depois de enviar, dá pra fazer outro sem recarregar', p);

        /* E o formulário devolvido funciona de verdade: o segundo pedido vai. */
        const p2 = [];
        await page.click('.ped-tipo-btn[data-tipo="curso"]');
        await page.click('#pedEnviar');
        await page.waitForTimeout(800);
        const d2 = await lerForm(page);
        if (!d2.sucesso) p2.push('o segundo pedido não foi enviado (rótulo: "' + d2.rotulo + '", msg: "' + d2.msg + '")');
        if (erros.length) p2.push('erro JS: ' + erros[0]);
        anota('o formulário devolvido envia o segundo pedido normalmente', p2);
      }
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

  /* 6. O outro lado: no painel, o selo do tipo tem que caber no card.
        O selo era nowrap. Com rótulo curto isso nunca apareceu; o primeiro
        rótulo longo passou do fim do card no celular e o texto sumia
        cortado, sem nada indicando que havia mais. O tipo é justamente o
        que diz do que o pedido se trata. */
  for (const formato of FORMATOS) {
    const { ctx, page, erros } = await abrirAdminPedidos(browser, formato, tiposDoSite);
    const m = await page.evaluate(() => {
      const badges = Array.from(document.querySelectorAll('.ped-admin-item .ped-admin-badge'));
      return badges.map((b) => {
        const card = b.closest('.ped-admin-item');
        return {
          texto: (b.textContent || '').trim(),
          vaza: b.getBoundingClientRect().right > card.getBoundingClientRect().right + 0.5,
          cortado: b.scrollWidth > b.clientWidth + 1,
        };
      });
    });
    const p = [];
    if (!m.length) p.push('nenhum pedido apareceu no painel');
    const ruins = m.filter((x) => x.vaza || x.cortado).map((x) => x.texto);
    if (ruins.length) p.push('selo do tipo cortado/para fora do card: ' + ruins.join(' | '));
    if (erros.length) p.push('erro JS: ' + erros[0]);
    anota(formato.nome + ' · no painel, o selo do tipo cabe no card', p);
    await ctx.close();
  }

  /* 7. Reenquadrar: o admin corrige o tipo de um pedido já enviado.
        Existe porque a pessoa escolhe o tipo no momento em que escreve, e o
        tipo certo pode nem existir ainda — foi o que aconteceu com quem
        pediu para "participar do grupo" em "Outros" antes de haver a opção
        de iniciativas. Mudar o tipo é mexer no que a PESSOA escolheu, então
        o teste exige as duas coisas: que o pedido mude de balde de verdade,
        e que a tela diga que foi o painel que mudou. */
  for (const formato of FORMATOS) {
    const { ctx, page, erros } = await abrirAdminPedidos(browser, formato, ['outros']);
    const p = [];
    const seloAntes = (await page.textContent('.ped-admin-item .ped-admin-badge')).trim();

    await page.click('.ped-tipo-btn-admin');
    await page.waitForSelector('.ped-admin-select-tipo', { timeout: 10000 });
    const opcoes = await page.$$eval('.ped-admin-select-tipo option', (os) => os.map((o) => o.value));
    if (opcoes.indexOf('iniciativas') === -1) p.push('o tipo novo nem é oferecido no reenquadramento');

    await page.selectOption('.ped-admin-select-tipo', 'iniciativas');
    await page.click('.ped-confirmar-tipo-btn');
    await page.waitForTimeout(600);

    const gravado = await page.evaluate(() => {
      const w = (window.__ESCRITAS || []).filter((e) => e.path.indexOf('pedidos') === 0);
      return w.length ? w[w.length - 1].valor : null;
    });
    if (!gravado || gravado.tipo !== 'iniciativas') {
      p.push('não gravou o tipo novo (gravou: ' + JSON.stringify(gravado) + ')');
    } else {
      if (gravado.tipoAnterior !== 'outros') p.push('não guardou o tipo que a pessoa tinha escolhido');
      if (!gravado.tipoAlteradoPor || !gravado.tipoAlteradoPor.email) p.push('não registrou QUEM reenquadrou');
      if (!gravado.tipoAlteradoEm) p.push('não registrou QUANDO foi reenquadrado');
    }

    const seloDepois = (await page.textContent('.ped-admin-item .ped-admin-badge')).trim();
    if (seloDepois === seloAntes) {
      p.push('a lista continua mostrando "' + seloAntes + '" — a tela não acompanhou a mudança');
    }
    const hist = await page.$('.ped-admin-reenquadrado');
    if (!hist) p.push('nada na tela diz que o tipo foi mudado pelo painel, e não pela pessoa');

    /* Salvar o MESMO tipo não pode carimbar um reenquadramento que não houve. */
    const antesDoNada = await page.evaluate(() => (window.__ESCRITAS || []).length);
    await page.click('.ped-tipo-btn-admin');
    await page.waitForSelector('.ped-admin-select-tipo', { timeout: 10000 });
    await page.click('.ped-confirmar-tipo-btn');
    await page.waitForTimeout(400);
    const depoisDoNada = await page.evaluate(() => (window.__ESCRITAS || []).length);
    if (depoisDoNada !== antesDoNada) p.push('salvar o mesmo tipo gravou assim mesmo — inventaria um reenquadramento');

    if (erros.length) p.push('erro JS: ' + erros[0]);
    anota(formato.nome + ' · o admin reenquadra o tipo, e a tela conta que foi ele', p);
    await ctx.close();
  }

  await browser.close();

  if (falhas.length) {
    console.error('\n' + falhas.length + ' falha(s):');
    falhas.forEach((f) => console.error('  - ' + f));
    process.exit(1);
  }
  console.log('\nTudo certo: o "Enviar pedido" nunca fica calado, nos dois formatos de tela.');
})();
