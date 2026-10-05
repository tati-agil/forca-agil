/* Construção da Aposta — a turma escolhida no convite NÃO se perde num redesenho tardio.
 *
 * POR QUE ESTE TESTE EXISTE
 * montarEntrada() (forca-agil/aposta.js) roda várias vezes num mesmo carregamento — onPageInit,
 * fa-auth-ready, fa-auth-change (este só depois de ler fa-progress), fa-admin-ready… — e cada vez
 * espera uma leitura de `turmas`. Antes da correção, cada resposta recriava o <select> do zero, na
 * primeira turma: quem já tinha escolhido outra turma via o seletor voltar sozinho, o aviso de ensaio
 * sumir e "Abrir dinâmica" abrir a turma ERRADA. No celular, em 4G, a última resposta chega segundos
 * depois — exatamente quando a pessoa já escolheu. Foi o que derrubou o teste-aposta no CI em 03/10/2026
 * (aviso lido vazio 200 ms depois de escolher a turma não liberada).
 *
 * COMO CONTROLA A ORDEM (sem depender de tempo, carga ou sorte)
 * Um portão, anexado ao firebase-falso SÓ na rota deste teste (o arquivo do falso não muda), segura
 * cada leitura de `turmas` feita pelo aposta.js depois de "armado" e só a solta quando o teste manda.
 * O carregamento inicial corre livre; com a tela assentada, o teste escolhe a turma, provoca um novo
 * montarEntrada() (a mesma função que os eventos chamam) e decide quando — e em que ordem — as
 * respostas chegam. "A turma usada" é a do primeiro caminho apostas/<turma>/… lido depois do clique
 * em "Abrir dinâmica": o que a dinâmica efetivamente carrega, não o que a tela diz.
 *
 * O QUE EXIGE, em desktop (1280) e celular (375):
 *   A. admin escolhe a 3ª turma; uma leitura tardia termina depois: seletor, aviso e turma usada
 *      continuam a 3ª;
 *   B. o mesmo para participante confirmada em várias turmas liberadas;
 *   C. a turma escolhida sai da lista na leitura tardia: cai na 1ª turma, com seletor, aviso e turma
 *      usada coerentes;
 *   D. respostas fora de ordem: a mais nova chega antes da antiga; a antiga (com uma lista velha) é
 *      descartada e não mexe em nada;
 *   E. controle: sem leitura tardia, nada muda; e quem tem UMA turma só continua sem seletor, com a
 *      turma certa, mesmo com redesenho tardio;
 *   e nenhum erro de JavaScript. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

const ADM = 'adm@previ.com.br';
const DIRETORA = 'diretora@previ.com.br';
const EV = 'evDir';
const T_LIB = 'tLiberada';     /* 'TURMA LIBERADA'   — liberada: vem primeiro */
const T_EXTRA = 'tExtra';      /* 'TURMA EXTRA'      — não liberada (ou liberada no cenário B) */
const T_SEM = 'tSemAposta';    /* 'TURMA SEM APOSTA' — não liberada (ou liberada no cenário B); a escolhida */
const ENSAIO = /ainda não foi liberada/i;

/* todasLiberadas: as três turmas liberadas (participante só vê turmas liberadas). */
function banco(todasLiberadas) {
  const users = {}, interesse = {};
  [[ADM, 'ADMIN'], [DIRETORA, 'DIRETORA TESTE']].forEach(([e, n]) => { users[chave(e)] = { name: n, email: e, area: 'DIRAD' }; });
  const admins = {}; admins[chave(ADM)] = { email: ADM, name: 'ADMIN' };
  const confirmada = {
    name: 'DIRETORA TESTE', email: DIRETORA, area: 'DIRAD', status: 'inscrito', confirmedByAdmin: ADM,
    confirmedByAdminName: 'ADMIN', confirmedDate: '2026-09-01T10:00:00.000Z', date: '2026-09-01T10:00:00.000Z',
  };
  [T_LIB, T_EXTRA, T_SEM].forEach((t) => { interesse[t] = { [chave(DIRETORA)]: Object.assign({}, confirmada) }; });
  const lib = todasLiberadas ? { apostaHabilitada: true } : {};
  return {
    'fa-users': users, 'fa-admins': admins, 'fa-diretores': {}, 'fa-facilitadores': {}, 'fa-users-log': {},
    'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: { [EV]: { nome: 'FORÇA ÁGIL - DIRETORES', order: 1, publicado: true, cargaHoraria: '3.5' } },
    turmas: {
      [T_LIB]: { label: 'TURMA LIBERADA', eventoKey: EV, order: 1, dias: ['2027-09-16'], apostaHabilitada: true },
      [T_EXTRA]: Object.assign({ label: 'TURMA EXTRA', eventoKey: EV, order: 2, dias: ['2027-10-16'] }, lib),
      [T_SEM]: Object.assign({ label: 'TURMA SEM APOSTA', eventoKey: EV, order: 3, dias: ['2027-11-16'] }, lib),
    },
    'turmas-interesse': interesse, 'turmas-interesse-log': {}, 'turmas-config': {}, 'turmas-checkin': {},
    'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {}, 'turmas-sorteio': {}, apostas: {},
    treinamentos: {}, 'treinamentos-conteudo': {}, avaliacoes: {}, pedidos: {}, holocron: {},
  };
}

/* O portão. A rota serve este corpo para os 3 scripts do Firebase (app/database/auth) e o falso recria
   `firebase` a cada vez: o embrulho do database é reaplicado a cada carga, mas o estado (G), o espião de
   eventos e o contador de desenhos são instalados uma vez só. Só leituras de `turmas` cuja pilha passa
   por aposta.js são seguradas, e só depois de G.armado — o carregamento inicial corre livre. */
const PORTAO = String.raw`
(function () {
  var primeira = !window.__portao;
  var G = window.__portao = window.__portao || { fila: [], respondidas: [], lidas: [], eventos: [], desenhos: 0, armado: false };
  var db0 = firebase.database;
  firebase.database = function () {
    var d = db0(), ref0 = d.ref;
    d.ref = function (p) {
      var r = ref0(p), s = String(p || '');
      if (/^apostas\//.test(s)) G.lidas.push(s);
      if (s === 'turmas' && /aposta\.js/.test(new Error().stack || '')) {
        var once0 = r.once.bind(r);
        r.once = function (evt, ok, err) {
          var item = { id: G.fila.length + 1, solta: false };
          item.run = function () { return once0(evt, function (sn) { G.respondidas.push(item.id); if (ok) ok(sn); }, err); };
          G.fila.push(item);
          if (!G.armado) { item.solta = true; item.run(); }
          return new Promise(function () {});
        };
      }
      return r;
    };
    return d;
  };
  firebase.database.ServerValue = db0.ServerValue;
  G.soltar = function (id) { var x = G.fila[id - 1]; if (!x || x.solta) return false; x.solta = true; x.run(); return true; };
  if (!primeira) return;
  var de = window.dispatchEvent;
  window.dispatchEvent = function (e) { if (e && /^fa-/.test(e.type)) G.eventos.push(e.type); return de.apply(this, arguments); };
  /* cada desenho de montarEntrada() troca o innerHTML do convite: conta quantas vezes */
  new MutationObserver(function () {
    var host = document.getElementById('apostaEntrada');
    var c = host && host.querySelector('.aposta-convite');
    if (c && !c.dataset.desenho) { G.desenhos++; c.dataset.desenho = String(G.desenhos); }
  }).observe(document.documentElement, { childList: true, subtree: true });
})();`;

const FORMATOS = [
  { nome: 'desktop', opts: { viewport: { width: 1280, height: 900 } } },
  { nome: 'celular', opts: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true } },
];

let falhas = 0;
function afirma(cond, msg, detalhe) {
  if (cond) console.log('  ok    ' + msg);
  else { falhas++; console.error('  FALHA ' + msg + (detalhe !== undefined ? ' → ' + JSON.stringify(detalhe) : '')); }
}

/* Espera a condição; se não acontecer, FALHA dizendo o que se esperava (nunca em silêncio). */
async function esperar(page, fn, arg, descricao, limite) {
  try {
    await page.waitForFunction(fn, arg === undefined ? null : arg, { timeout: limite || 8000 });
  } catch (e) {
    throw new Error('Esperado e não aconteceu em ' + (limite || 8000) + ' ms: ' + descricao);
  }
}

async function novaPagina(browser, formato, email, todasLiberadas, erros) {
  const ctx = await browser.newContext(formato.opts);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  page.on('dialog', (d) => d.accept());
  await page.addInitScript('window.__CFG = ' + JSON.stringify({
    db: banco(todasLiberadas), user: { email, emailVerified: true, uid: 'u1' }, delayDefault: 20,
  }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO + '\n' + PORTAO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
  return { ctx, page };
}

/* Tela assentada: auth, admin e facilitador decidiram, fa-auth-change (o último gatilho do carregamento)
   já disparou, todas as leituras de turmas responderam e o convite está desenhado com `opcoes` turmas. */
async function assentar(page, opcoes) {
  await esperar(page, () => window.faAuth && faAuth.isAdminReady && faAuth.isAdminReady() && faAuth.isFacilitadorReady() &&
    window.__portao && window.__portao.eventos.indexOf('fa-auth-change') !== -1, null, 'auth/admin/facilitador decididos e fa-auth-change disparado', 15000);
  await esperar(page, (n) => {
    const G = window.__portao;
    if (G.respondidas.length !== G.fila.length) return false;
    const sel = document.getElementById('apostaTurmaSel');
    return n > 1 ? !!(sel && sel.options.length === n) : !!(!sel && document.querySelector('#apostaEntrada .aposta-convite-turma'));
  }, opcoes, 'convite desenhado com ' + opcoes + ' turma(s) e todas as leituras respondidas');
}

const estado = (page) => page.evaluate(() => {
  const sel = document.getElementById('apostaTurmaSel');
  const unica = document.querySelector('#apostaEntrada .aposta-convite-turma');
  return {
    valor: sel ? sel.value : null,
    visivel: sel ? sel.options[sel.selectedIndex].textContent : (unica ? unica.textContent : null),
    opcoes: sel ? sel.options.length : 0,
    aviso: ((document.getElementById('apostaConviteAviso') || {}).textContent || '').trim(),
    desenhos: window.__portao.desenhos,
  };
});

/* Arma o portão e provoca um novo montarEntrada(): a leitura dele fica segura até o teste soltar. */
async function provocarRedesenho(page) {
  const antes = await page.evaluate(() => window.__portao.fila.length);
  await page.evaluate(() => { window.__portao.armado = true; window.faAposta.montarEntrada(); });
  await esperar(page, (n) => window.__portao.fila.length === n + 1, antes, 'o novo montarEntrada() pedir turmas');
  return antes + 1;
}
async function soltarEEsperarDesenho(page, id) {
  const antes = await page.evaluate(() => window.__portao.desenhos);
  await page.evaluate((i) => window.__portao.soltar(i), id);
  await esperar(page, (a) => window.__portao.respondidas.indexOf(a.id) !== -1 && window.__portao.desenhos > a.antes,
    { id, antes }, 'a leitura #' + id + ' responder e redesenhar o convite');
}

async function turmaUsadaAoAbrir(page) {
  const antes = await page.evaluate(() => window.__portao.lidas.length);
  await page.$eval('#apostaAbrirBtn', (el) => el.click());
  await esperar(page, (n) => window.__portao.lidas.length > n, antes, 'a dinâmica ler apostas/<turma>/… depois de "Abrir dinâmica"');
  return page.evaluate((n) => window.__portao.lidas[n].split('/')[1], antes);
}

async function escolher(page, turma) {
  await page.selectOption('#apostaTurmaSel', turma);
  return estado(page);
}

(async () => {
  const browser = await chromium.launch();
  try {
    for (const formato of FORMATOS) {
      console.log('\n===== ' + formato.nome.toUpperCase() + ' =====');
      const erros = [];

      /* ── A: admin, leitura tardia termina DEPOIS da escolha ── */
      {
        const { ctx, page } = await novaPagina(browser, formato, ADM, false, erros);
        await assentar(page, 3);
        const e0 = await estado(page);
        afirma(e0.valor === T_LIB && e0.aviso === '', 'A — antes da escolha, a 1ª turma (liberada) está selecionada, sem aviso de ensaio', e0);
        const e1 = await escolher(page, T_SEM);
        afirma(e1.valor === T_SEM && ENSAIO.test(e1.aviso), 'A — escolher a 3ª turma (não liberada) mostra o aviso de ensaio', e1);
        const id = await provocarRedesenho(page);
        await soltarEEsperarDesenho(page, id);
        const e2 = await estado(page);
        afirma(e2.valor === T_SEM, 'A — depois do redesenho tardio, o seletor continua na turma escolhida', e2);
        afirma(/TURMA SEM APOSTA/.test(e2.visivel), 'A — o texto visível do seletor continua sendo a turma escolhida', e2.visivel);
        afirma(ENSAIO.test(e2.aviso), 'A — o aviso continua sendo o da turma escolhida (ensaio)', e2.aviso);
        afirma(e2.opcoes === 3, 'A — a lista continua com as 3 turmas', e2.opcoes);
        const usada = await turmaUsadaAoAbrir(page);
        afirma(usada === T_SEM, 'A — "Abrir dinâmica" abre a turma escolhida, não a primeira', usada);
        await ctx.close();
      }

      /* ── B: participante confirmada em várias turmas liberadas ── */
      {
        const { ctx, page } = await novaPagina(browser, formato, DIRETORA, true, erros);
        await assentar(page, 3);
        const e1 = await escolher(page, T_SEM);
        afirma(e1.valor === T_SEM && e1.aviso === '', 'B — participante escolhe a 3ª turma (liberada: sem aviso de ensaio)', e1);
        const id = await provocarRedesenho(page);
        await soltarEEsperarDesenho(page, id);
        const e2 = await estado(page);
        afirma(e2.valor === T_SEM && /TURMA SEM APOSTA/.test(e2.visivel), 'B — depois do redesenho tardio, o seletor continua na turma escolhida', e2);
        afirma(e2.aviso === '', 'B — o aviso continua coerente com a turma escolhida (liberada: nenhum)', e2.aviso);
        const usada = await turmaUsadaAoAbrir(page);
        afirma(usada === T_SEM, 'B — "Abrir dinâmica" abre a turma escolhida pela participante', usada);
        await ctx.close();
      }

      /* ── C: a turma escolhida deixa de existir na leitura tardia ── */
      {
        const { ctx, page } = await novaPagina(browser, formato, ADM, false, erros);
        await assentar(page, 3);
        await escolher(page, T_SEM);
        const id = await provocarRedesenho(page);
        await page.evaluate((t) => { delete window.__CFG.db.turmas[t]; }, T_SEM);
        await soltarEEsperarDesenho(page, id);
        const e2 = await estado(page);
        afirma(e2.opcoes === 2, 'C — a turma removida sai do seletor', e2);
        afirma(e2.valor === T_LIB && /TURMA LIBERADA/.test(e2.visivel), 'C — sem a turma escolhida, o seletor cai na 1ª turma disponível', e2);
        afirma(e2.aviso === '', 'C — o aviso acompanha a 1ª turma (liberada: nenhum aviso de ensaio)', e2.aviso);
        const usada = await turmaUsadaAoAbrir(page);
        afirma(usada === T_LIB, 'C — "Abrir dinâmica" abre a 1ª turma, a mesma que o seletor mostra', usada);
        await ctx.close();
      }

      /* ── D: respostas fora de ordem — a antiga não sobrescreve a nova ── */
      {
        const { ctx, page } = await novaPagina(browser, formato, ADM, false, erros);
        await assentar(page, 3);
        await escolher(page, T_SEM);
        const antiga = await provocarRedesenho(page);
        const nova = await provocarRedesenho(page);
        await soltarEEsperarDesenho(page, nova);
        const e1 = await estado(page);
        afirma(e1.valor === T_SEM && ENSAIO.test(e1.aviso), 'D — a resposta MAIS NOVA chega primeiro e preserva a escolha', e1);
        /* a resposta antiga passa a enxergar uma lista velha, sem a turma escolhida */
        await page.evaluate((t) => { delete window.__CFG.db.turmas[t]; }, T_SEM);
        await page.evaluate((i) => window.__portao.soltar(i), antiga);
        /* para admin, a resposta de turmas desenha no MESMO passo em que chega: quando ela consta como
           respondida, um redesenho já teria acontecido — não há janela de tempo a esperar */
        await esperar(page, (i) => window.__portao.respondidas.indexOf(i) !== -1, antiga, 'a resposta antiga chegar');
        const e2 = await estado(page);
        afirma(e2.desenhos === e1.desenhos, 'D — a resposta antiga, chegando depois, é descartada: o convite não é redesenhado', { antes: e1.desenhos, depois: e2.desenhos });
        afirma(e2.valor === T_SEM && e2.opcoes === 3 && ENSAIO.test(e2.aviso), 'D — o estado continua o produzido pela resposta mais nova', e2);
        const usada = await turmaUsadaAoAbrir(page);
        afirma(usada === T_SEM, 'D — "Abrir dinâmica" abre a turma escolhida', usada);
        await ctx.close();
      }

      /* ── E: controle — sem leitura tardia nada muda; e quem tem uma turma só ── */
      {
        const { ctx, page } = await novaPagina(browser, formato, ADM, false, erros);
        await assentar(page, 3);
        const e1 = await escolher(page, T_EXTRA);
        const e2 = await estado(page);
        afirma(e2.valor === T_EXTRA && ENSAIO.test(e2.aviso) && e2.desenhos === e1.desenhos, 'E — sem leitura tardia, a escolha e o aviso ficam como estão', e2);
        const usada = await turmaUsadaAoAbrir(page);
        afirma(usada === T_EXTRA, 'E — "Abrir dinâmica" abre a turma escolhida', usada);
        await ctx.close();
      }
      {
        /* participante com UMA turma liberada (as outras não liberadas): sem seletor */
        const { ctx, page } = await novaPagina(browser, formato, DIRETORA, false, erros);
        await assentar(page, 1);
        const e1 = await estado(page);
        afirma(e1.opcoes === 0 && /TURMA LIBERADA/.test(e1.visivel) && e1.aviso === '', 'E — uma turma só: sem seletor, com o nome da turma e sem aviso de ensaio', e1);
        const id = await provocarRedesenho(page);
        await page.evaluate((i) => window.__portao.soltar(i), id);
        await esperar(page, (a) => window.__portao.respondidas.indexOf(a.id) !== -1 && window.__portao.desenhos > a.antes,
          { id, antes: e1.desenhos }, 'o redesenho tardio da participante com uma turma');
        const e2 = await estado(page);
        afirma(e2.opcoes === 0 && /TURMA LIBERADA/.test(e2.visivel) && e2.aviso === '', 'E — uma turma só: o redesenho tardio mantém tudo igual', e2);
        const usada = await turmaUsadaAoAbrir(page);
        afirma(usada === T_LIB, 'E — uma turma só: "Abrir dinâmica" abre essa turma', usada);
        await ctx.close();
      }

      afirma(erros.length === 0, 'nenhum erro de JavaScript', erros.slice(0, 3));
    }
  } finally {
    await browser.close();
  }
  if (falhas) { console.log('\n' + falhas + ' falha(s).'); process.exit(1); }
  console.log('\nOK — a turma escolhida sobrevive a redesenhos tardios e a respostas fora de ordem, nos dois formatos.');
})().catch((e) => { console.error(e); process.exit(1); });
