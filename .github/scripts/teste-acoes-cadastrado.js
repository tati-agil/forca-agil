/* Aba Cadastrados: a linha da pessoa cabe na tela, e as ações continuam lá.
 *
 * POR QUE ESTE TESTE EXISTE
 * A tabela tinha uma coluna por ação — cinco botões por linha, dez colunas —
 * e não cabia na tela nem no computador: os últimos botões ficavam atrás de
 * uma rolagem lateral cuja barra só aparecia depois de milhares de pixels de
 * tabela. Uma ação que ninguém alcança é uma ação que não existe, e isso não
 * dá erro nenhum: a tela parece inteira, só está cortada.
 *
 * Trocar cinco colunas de botão por um menu "⋯" conserta o layout e cria um
 * risco novo, do tipo que passa despercebido: as ações saíram de dentro do
 * <tbody>, onde a delegação de clique vive. Se alguma parar de gravar, a
 * tela não acusa nada — some em silêncio. Por isso aqui não basta o menu
 * abrir: cada ação tem que chegar no banco.
 *
 * Roda com o Firebase falso (window.__ESCRITAS guarda cada escrita), nos dois
 * formatos de tela.
 *
 * O QUE ELE EXIGE, em desktop e celular:
 *   1. nada da linha fica cortado e a tabela não rola para o lado;
 *   2. o menu "⋯" diz de QUEM é a ação (nome e e-mail) — errar de linha numa
 *      lista de centenas é fácil demais;
 *   3. Bloquear grava fa-users/<chave>/blocked;
 *   4. Resetar progresso apaga fa-progress e pede o sinal de reset;
 *   5. "Confirmar cadastro" só aparece para quem está Pendente, e grava;
 *   6. quem está bloqueada vê "Desbloquear", não "Bloquear";
 *   7. nenhum erro de JavaScript não tratado.
 */

const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');

const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

const ADM       = 'adm@previ.com.br';
const ATIVA     = 'ativa@previ.com.br';      /* verificada, acesso liberado */
const PENDENTE  = 'pendente@previ.com.br';   /* cadastro próprio, e-mail não verificado */
const BLOQUEADA = 'bloqueada@previ.com.br';

function banco() {
  const users = {};
  users[chave(ADM)]       = { name: 'ADMIN', email: ADM, area: 'INFOR' };
  users[chave(ATIVA)]     = { name: 'PESSOA ATIVA', email: ATIVA, area: 'GECAT',
                              createdAt: '2026-01-01T10:00:00.000Z' };
  users[chave(PENDENTE)]  = { name: 'PESSOA PENDENTE', email: PENDENTE, area: 'GERAT',
                              createdAt: '2026-02-01T10:00:00.000Z', emailVerificationRequired: true };
  users[chave(BLOQUEADA)] = { name: 'PESSOA BLOQUEADA', email: BLOQUEADA, area: 'GEPAR',
                              createdAt: '2026-03-01T10:00:00.000Z', blocked: true };
  const admins = {}; admins[chave(ADM)] = { email: ADM, name: 'ADMIN' };
  return {
    'fa-users': users, 'fa-admins': admins, 'fa-diretores': {}, 'fa-facilitadores': {},
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: {}, turmas: {}, 'turmas-interesse': {}, 'turmas-interesse-log': {},
    'turmas-config': {}, 'turmas-checkin': {}, 'turmas-publico': {}, 'eventos-publico': {},
    'turmas-equipe': {}, 'turmas-sorteio': {}, avaliacoes: {}, pedidos: {}, holocron: {},
  };
}

async function abrirCadastrados(browser, formato) {
  const ctx = await browser.newContext(formato.opts);
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify({
    db: banco(), user: { email: ADM, emailVerified: true, uid: 'u1' }, delayDefault: 20,
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
      .find((x) => /Cadastrados/i.test(x.textContent));
    if (b) b.click();
  });
  await page.waitForSelector('.cad-mais-btn', { timeout: 15000 });
  return { ctx, page, erros };
}

/* Abre o menu "⋯" da linha de quem tem este e-mail. */
async function abrirMenu(page, email) {
  await page.evaluate((mail) => {
    const linha = Array.from(document.querySelectorAll('#adminCadastrados tbody tr'))
      .find((tr) => tr.textContent.indexOf(mail) !== -1);
    linha.querySelector('.cad-mais-btn').click();
  }, email);
  await page.waitForSelector('.cad-acoes-modal', { timeout: 10000 });
}

/* Clica na ação cujo rótulo casa com o texto pedido e confirma o modal
   de confirmação que vem depois. */
async function acionar(page, rotulo) {
  await page.evaluate((r) => {
    const btn = Array.from(document.querySelectorAll('.cad-acao-btn'))
      .find((b) => b.textContent.indexOf(r) !== -1);
    if (!btn) throw new Error('ação não encontrada: ' + r);
    btn.click();
  }, rotulo);
  await page.waitForSelector('.admin-modal-confirm-btn', { timeout: 10000 });
  await page.click('.admin-modal-confirm-btn');
  await page.waitForTimeout(400);
}

/* O painel semeia dados próprios ao abrir (tipos de atividade, treinamento
   base) e essas escritas não têm nada a ver com a pessoa. Reportar a lista
   inteira transforma a falha num paredão ilegível, então fica só o que toca
   a chave dela. */
function escritas(page, eKey) {
  return page.evaluate((k) => (window.__ESCRITAS || [])
    .filter((e) => e.path.indexOf(k) !== -1)
    .map((e) => e.path + ' = ' + JSON.stringify(e.valor)), eKey);
}

const FORMATOS = [
  { nome: 'desktop', opts: { viewport: { width: 1366, height: 768 } } },
  { nome: 'celular', opts: devices['iPhone 13'] },
];

(async () => {
  const browser = await chromium.launch();
  const falhas = [];

  for (const formato of FORMATOS) {
    console.log('\n===== ' + formato.nome.toUpperCase() + ' =====');

    function registrar(nome, problemas) {
      const linha = formato.nome + ' · ' + nome;
      if (problemas.length) {
        falhas.push(linha + ' → ' + problemas.join('; '));
        console.log('  FALHA ' + linha + ' → ' + problemas.join('; '));
      } else {
        console.log('  ok    ' + nome);
      }
    }

    /* 1. A linha inteira cabe na tela — o defeito que originou esta mudança. */
    {
      const { ctx, page, erros } = await abrirCadastrados(browser, formato);
      const m = await page.evaluate(() => {
        const wrap = document.querySelector('#adminCadastrados .table-scroll-wrap');
        const r = wrap.getBoundingClientRect();
        const linha = document.querySelector('#adminCadastrados tbody tr');
        const cortados = Array.from(linha.querySelectorAll('button')).filter((b) => {
          const br = b.getBoundingClientRect();
          return br.right > r.right + 0.5 || br.width === 0 || br.height === 0;
        }).map((b) => (b.textContent || '').trim() || b.getAttribute('aria-label'));
        return {
          rolaLado: wrap.scrollWidth > wrap.clientWidth + 1,
          cortados: cortados,
          alturas: Array.from(linha.querySelectorAll('button'))
            .map((b) => Math.round(b.getBoundingClientRect().height)),
        };
      });
      const p = [];
      if (m.rolaLado) p.push('a tabela ainda rola para o lado — o que sobra fica atrás de uma barra lá embaixo');
      if (m.cortados.length) p.push('botão cortado/invisível na linha: ' + m.cortados.join(', '));
      /* No computador a linha é densa e o mouse mira fino; no celular quem
         mira é o dedo, e aí 27px é um botão que se erra. */
      var alturaMinima = formato.nome === 'celular' ? 40 : 24;
      var baixos = m.alturas.filter((h) => h < alturaMinima);
      if (baixos.length) {
        p.push(baixos.length + ' botão(ões) com menos de ' + alturaMinima + 'px de altura (' +
               m.alturas.join(', ') + ') — alvo pequeno demais para ' +
               (formato.nome === 'celular' ? 'o dedo' : 'a linha'));
      }
      if (erros.length) p.push('erro JS: ' + erros[0]);
      registrar('a linha cabe na tela, sem rolagem lateral', p);
      await ctx.close();
    }

    /* 2. O menu diz de quem é a ação, e Bloquear grava. */
    {
      const { ctx, page, erros } = await abrirCadastrados(browser, formato);
      await abrirMenu(page, ATIVA);
      const cabecalho = await page.evaluate(() => document.querySelector('.cad-acoes-modal').textContent);
      const p = [];
      if (cabecalho.indexOf('PESSOA ATIVA') === -1) p.push('o menu não diz de quem é a ação (nome ausente)');
      if (cabecalho.indexOf(ATIVA) === -1) p.push('o menu não mostra o e-mail da pessoa');
      if (cabecalho.indexOf('Confirmar cadastro') !== -1) p.push('ofereceu "Confirmar cadastro" para quem já está verificada');
      await acionar(page, 'Bloquear acesso');
      const esc = await escritas(page, chave(ATIVA));
      const gravou = esc.some((e) => e.indexOf('fa-users/' + chave(ATIVA) + '/blocked = true') !== -1);
      if (!gravou) p.push('Bloquear não gravou nada — a ação sumiu junto com a coluna. Escritas: ' + JSON.stringify(esc));
      if (erros.length) p.push('erro JS: ' + erros[0]);
      registrar('o menu identifica a pessoa e "Bloquear" grava', p);
      await ctx.close();
    }

    /* 3. Resetar progresso continua chegando no banco. */
    {
      const { ctx, page, erros } = await abrirCadastrados(browser, formato);
      await abrirMenu(page, ATIVA);
      await acionar(page, 'Resetar progresso');
      const esc = await escritas(page, chave(ATIVA));
      const p = [];
      if (!esc.some((e) => e.indexOf('fa-progress/' + chave(ATIVA)) === 0)) {
        p.push('não apagou fa-progress. Escritas: ' + JSON.stringify(esc));
      }
      if (!esc.some((e) => e.indexOf('fa-reset-signal/' + chave(ATIVA)) === 0)) {
        p.push('não gravou o sinal de reset — a pessoa logada não seria avisada');
      }
      if (erros.length) p.push('erro JS: ' + erros[0]);
      registrar('"Resetar progresso" grava', p);
      await ctx.close();
    }

    /* 4. Confirmar cadastro: só para quem está Pendente. */
    {
      const { ctx, page, erros } = await abrirCadastrados(browser, formato);
      await abrirMenu(page, PENDENTE);
      const texto = await page.evaluate(() => document.querySelector('.cad-acoes-modal').textContent);
      const p = [];
      if (texto.indexOf('Confirmar cadastro') === -1) {
        p.push('não ofereceu "Confirmar cadastro" para quem está Pendente');
      } else {
        await acionar(page, 'Confirmar cadastro');
        const esc = await escritas(page, chave(PENDENTE));
        if (!esc.some((e) => e.indexOf('fa-users/' + chave(PENDENTE) + '/adminApproved = true') !== -1)) {
          p.push('confirmar não liberou o acesso. Escritas: ' + JSON.stringify(esc));
        }
      }
      if (erros.length) p.push('erro JS: ' + erros[0]);
      registrar('"Confirmar cadastro" aparece só para quem está Pendente, e grava', p);
      await ctx.close();
    }

    /* 5. Quem está bloqueada vê o caminho de volta. */
    {
      const { ctx, page, erros } = await abrirCadastrados(browser, formato);
      /* O filtro começa em "Ativos": quem está bloqueada só aparece em Todos. */
      await page.evaluate(() => {
        const b = Array.from(document.querySelectorAll('.admin-status-btn'))
          .find((x) => /Todos/i.test(x.textContent));
        if (b) b.click();
      });
      await page.waitForTimeout(200);
      await abrirMenu(page, BLOQUEADA);
      const texto = await page.evaluate(() => document.querySelector('.cad-acoes-modal').textContent);
      const p = [];
      if (texto.indexOf('Desbloquear acesso') === -1) p.push('não ofereceu "Desbloquear" para quem está bloqueada');
      if (texto.indexOf('Bloquear acesso') !== -1) p.push('ofereceu "Bloquear" para quem já está bloqueada');
      await acionar(page, 'Desbloquear acesso');
      const esc = await escritas(page, chave(BLOQUEADA));
      if (!esc.some((e) => e.indexOf('fa-users/' + chave(BLOQUEADA) + '/blocked = null') !== -1)) {
        p.push('desbloquear não gravou. Escritas: ' + JSON.stringify(esc));
      }
      if (erros.length) p.push('erro JS: ' + erros[0]);
      registrar('quem está bloqueada tem o caminho de volta', p);
      await ctx.close();
    }
  }

  await browser.close();

  if (falhas.length) {
    console.error('\n' + falhas.length + ' falha(s):');
    falhas.forEach((f) => console.error('  - ' + f));
    process.exit(1);
  }
  console.log('\nTudo certo: a linha cabe na tela e as ações do menu continuam chegando no banco.');
})();
