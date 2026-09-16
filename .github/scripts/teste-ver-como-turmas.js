/* "Ver esta tela como" chega na página Turmas (antes só existia na Minha
 * Área, em aluno.js).
 *
 * POR QUE ESTE TESTE EXISTE
 * A vitrine de Turmas decide o que aparece POR PESSOA — evento de público
 * restrito, evento restrito a diretores — e quem escreve/revisa esse código
 * está sempre logado como admin, que vê tudo. O vazamento (ou o sumiço
 * indevido) só aparece na conta de outra pessoa, e essa regra específica já
 * foi esquecida mais de uma vez neste repo por faltar um jeito de conferir
 * na prática o que uma pessoa específica vê, sem ter a conta dela. A Minha
 * Área já resolvia isso para a própria área da pessoa; a página Turmas
 * ficava sem o mesmo recurso.
 *
 * A consulta que monta a lista de pessoas do seletor foi extraída para
 * forca-agil/turmas-util.js (window.faTurmasUtil.listarPessoasVerComo) —
 * este teste também cobre, indiretamente, que a Minha Área continua
 * funcionando com a versão compartilhada.
 *
 * Roda com o Firebase falso (.github/scripts/firebase-falso.js): sem
 * segredo, sem rede, sem precisar de três contas de verdade.
 *
 * O QUE ELE EXIGE:
 *   1. logada como admin, a barra "Ver esta tela como" aparece na página
 *      Turmas, com as pessoas que já manifestaram interesse em alguma turma;
 *   2. sem selecionar ninguém (padrão): admin vê o evento restrito E o aberto
 *      (ela sempre vê tudo), sem aviso de preview;
 *   3. selecionando quem NÃO está na lista do evento restrito: o grupo dele
 *      some da vitrine, o aberto continua, e aparece o aviso dizendo de quem
 *      é o preview;
 *   4. selecionando quem ESTÁ na lista: o evento restrito volta a aparecer;
 *   5. voltando para "— eu mesma —": aviso some, admin volta a ver tudo;
 *   6. interesse/lista de espera nunca são a preocupação aqui — o preview só
 *      muda o que a vitrine mostra, não escreve nada (não há botão de
 *      interesse na turma restrita usada aqui, então o teste teria como
 *      denunciar uma gravação indevida pela mudança de estado do botão da
 *      turma aberta, que não deve acontecer);
 *   7. nenhum erro de JavaScript não tratado.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

const ADM        = 'adm@previ.com.br';
const NA_LISTA   = 'nalista@previ.com.br';
const FORA       = 'fora@previ.com.br';

const EV_RESTRITO = 'evRestrito';
const EV_ABERTO   = 'evAberto';

function banco() {
  const users = {}; const admins = {};
  [[ADM, 'ADMIN'], [NA_LISTA, 'PESSOA NA LISTA'], [FORA, 'PESSOA DE FORA']].forEach(([e, n]) => {
    users[chave(e)] = { name: n, email: e, area: 'TI' };
  });
  admins[chave(ADM)] = { email: ADM, name: 'ADMIN' };

  const publicoEvento = {};
  publicoEvento[EV_RESTRITO] = {};
  publicoEvento[EV_RESTRITO][chave(NA_LISTA)] = { name: 'PESSOA NA LISTA', email: NA_LISTA };

  const interesse = { turmaAberta: {} };
  [[NA_LISTA, 'PESSOA NA LISTA'], [FORA, 'PESSOA DE FORA']].forEach(([e, n]) => {
    interesse.turmaAberta[chave(e)] = { name: n, email: e, status: 'interessado', date: '2027-01-01T00:00:00.000Z' };
  });

  return {
    'fa-users': users, 'fa-admins': admins, 'fa-diretores': {}, 'fa-facilitadores': {},
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: {
      [EV_RESTRITO]: {
        nome: 'EVENTO FECHADO', cargaHoraria: '8', order: 1,
        publicado: true, publicoRestrito: true,
      },
      [EV_ABERTO]: {
        nome: 'EVENTO ABERTO', cargaHoraria: '8', order: 2,
        publicado: true,
      },
    },
    turmas: {
      turmaFechada: { label: 'TURMA DO EVENTO FECHADO', dias: ['2099-01-01'], eventoKey: EV_RESTRITO, order: 1 },
      turmaAberta:  { label: 'TURMA DO EVENTO ABERTO',  dias: ['2099-01-02'], eventoKey: EV_ABERTO,   order: 2 },
    },
    'turmas-interesse': interesse, 'turmas-interesse-log': {}, 'turmas-config': {}, 'turmas-checkin': {},
    'turmas-publico': {}, 'eventos-publico': publicoEvento, 'turmas-equipe': {}, 'turmas-sorteio': {},
    avaliacoes: {}, pedidos: {}, holocron: {},
  };
}

function grupos(page) {
  return page.evaluate(() => {
    const visivel = (el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden';
    };
    return Array.from(document.querySelectorAll('.turmas-evento-grupo'))
      .filter(visivel)
      .map((g) => g.getAttribute('data-evento-key'));
  });
}

async function selecionarPorEmail(page, email) {
  const valor = await page.$eval('.turmas-vercomo .aluno-vercomo-sel', (el, em) => {
    const opt = Array.from(el.options).find((o) => o.dataset.email === em);
    return opt ? opt.value : null;
  }, email);
  if (valor === null) throw new Error('opção não encontrada para ' + email);
  await page.selectOption('.turmas-vercomo .aluno-vercomo-sel', valor);
}

(async () => {
  const browser = await chromium.launch();
  let falhas = 0;
  const anota = (linha, ok, detalhe) => {
    if (ok) { console.log('  ok    ' + linha); }
    else { falhas++; console.error('  FALHA ' + linha + (detalhe ? ' → ' + detalhe : '')); }
  };

  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const erros = [];
    page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
    await page.addInitScript('window.__CFG = ' + JSON.stringify({
      db: banco(), user: { email: ADM, emailVerified: true, uid: 'u1' }, delayDefault: 20,
    }) + ';');
    await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
    await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.route('**fonts.gstatic.com**', (r) => r.abort());

    await page.goto(BASE + '/index.html#turmas', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.turmas-evento-grupo', { timeout: 15000 });
    await page.waitForSelector('.turmas-vercomo .aluno-vercomo-sel', { timeout: 15000 });
    /* O <select> nasce só com "— eu mesma —"; as duas pessoas chegam depois,
       por window.faTurmasUtil.listarPessoasVerComo (duas leituras assíncronas
       encadeadas). Sem esperar isso, a checagem de quantidade de opções — e
       a seleção por e-mail logo abaixo — corre uma corrida contra essa
       consulta e falha só às vezes (dependia de o ambiente ser rápido o
       bastante para a consulta já ter voltado). */
    await page.waitForFunction(() => {
      var sel = document.querySelector('.turmas-vercomo .aluno-vercomo-sel');
      return !!sel && sel.options.length >= 3;
    }, { timeout: 15000 });

    anota('barra "Ver esta tela como" aparece na página Turmas para o admin',
      await page.locator('.turmas-vercomo').count() === 1);

    const qtdOpcoes = await page.locator('.turmas-vercomo .aluno-vercomo-sel option').count();
    anota('seletor lista as duas pessoas que manifestaram interesse (+ "eu mesma")', qtdOpcoes === 3, 'veio ' + qtdOpcoes);

    const semSelecao = await grupos(page);
    anota('admin sem selecionar ninguém vê o evento restrito',
      semSelecao.indexOf(EV_RESTRITO) !== -1, 'veio ' + JSON.stringify(semSelecao));
    anota('admin sem selecionar ninguém vê o evento aberto',
      semSelecao.indexOf(EV_ABERTO) !== -1, 'veio ' + JSON.stringify(semSelecao));
    anota('sem preview ativo, nenhum aviso "vendo como" aparece',
      await page.locator('.aluno-vercomo-aviso:visible').count() === 0);

    await selecionarPorEmail(page, FORA);
    await page.waitForFunction((k) => !document.querySelector(
      '.turmas-evento-grupo[data-evento-key="' + k + '"]'), EV_RESTRITO, { timeout: 10000 }).catch(() => {});
    const comoFora = await grupos(page);
    anota('vendo como quem está FORA da lista: evento restrito some',
      comoFora.indexOf(EV_RESTRITO) === -1, 'veio ' + JSON.stringify(comoFora));
    anota('vendo como quem está FORA da lista: evento aberto continua',
      comoFora.indexOf(EV_ABERTO) !== -1, 'veio ' + JSON.stringify(comoFora));
    const avisoTexto = await page.locator('.aluno-vercomo-aviso').innerText().catch(() => '');
    anota('aviso de preview aparece e cita o nome da pessoa',
      /PESSOA DE FORA/.test(avisoTexto), 'veio "' + avisoTexto + '"');

    await selecionarPorEmail(page, NA_LISTA);
    await page.waitForFunction((k) => !!document.querySelector(
      '.turmas-evento-grupo[data-evento-key="' + k + '"]'), EV_RESTRITO, { timeout: 10000 }).catch(() => {});
    const comoNaLista = await grupos(page);
    anota('vendo como quem ESTÁ na lista: evento restrito volta a aparecer',
      comoNaLista.indexOf(EV_RESTRITO) !== -1, 'veio ' + JSON.stringify(comoNaLista));

    await page.selectOption('.turmas-vercomo .aluno-vercomo-sel', '');
    await page.waitForFunction(() => {
      const el = document.querySelector('.aluno-vercomo-aviso');
      return !el || getComputedStyle(el).display === 'none';
    }, { timeout: 10000 }).catch(() => {});
    anota('voltando para "— eu mesma —": aviso some',
      await page.locator('.aluno-vercomo-aviso:visible').count() === 0);
    const semSelecaoDeNovo = await grupos(page);
    anota('voltando para "— eu mesma —": admin volta a ver os dois eventos',
      semSelecaoDeNovo.indexOf(EV_RESTRITO) !== -1 && semSelecaoDeNovo.indexOf(EV_ABERTO) !== -1,
      'veio ' + JSON.stringify(semSelecaoDeNovo));

    if (erros.length) anota('nenhum erro de JavaScript', false, erros[0]);
    await ctx.close();
  } catch (e) {
    falhas++;
    console.error('  FALHA inesperada: ' + e.message);
  } finally {
    await browser.close();
  }

  if (falhas) { console.error(`\n${falhas} falha(s).`); process.exit(1); }
  console.log('\nTudo certo.');
})();
