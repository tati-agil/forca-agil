/* Público da turma SOMADO ao do evento — nunca uma exceção que o enfraqueça.
 *
 * POR QUE ESTE TESTE EXISTE
 * Um evento pode ter turmas com públicos diferentes (Turma 1 aberta, Turma 2
 * só para uma lista de e-mails, Turma 3 aberta), mas as regras do EVENTO
 * continuam valendo para todas. Duas coisas furavam isso:
 *   - o "Público" (gerentes/técnicos) da turma valia POR CIMA do evento:
 *     turma "Só gerentes" num evento de Técnicos passava a aceitar gerentes;
 *   - "Adicionar à turma" em massa, no modal da lista da turma, conferia só a
 *     lista — um gerente na lista de uma turma de evento de Técnicos entrava.
 * Agora as duas restrições se somam (cargoEfetivo em turmas-util.js) e
 * contraditórias viram "ninguém entra", com aviso no painel.
 *
 * Roda com o Firebase falso, em 1280 e 375 px. O evento de Técnicos está em "Mostrar para todos" (visibilidade
 * 'todos'): no padrão, o gerente e a turma contraditória nem aparecem (teste-visibilidade-evento.js) — aqui se medem
 * as mensagens e a recusa de quem VÊ a turma sem poder participar.
 *
 * O QUE ELE EXIGE:
 *   PESSOA (#turmas)
 *   1. técnica na lista da Turma 2 vê as turmas 1, 2 e 3 e consegue manifestar
 *      interesse na 2 (grava SÓ o próprio registro);
 *   2. gerente na lista da Turma 2 vê a turma, mas não tem botão: lê que não é
 *      para gerentes, e nada é gravado;
 *   3. técnica FORA da lista não vê a Turma 2, e uma turma sem restrição
 *      nenhuma (outro evento) continua aceitando interesse como sempre;
 *   4. turma contraditória (Só gerentes num evento de Técnicos) não aceita
 *      ninguém e diz isso sem culpar a pessoa;
 *   ADMIN (#admin › Eventos)
 *   5. o card da turma contraditória avisa que ninguém entra;
 *   6. "Editar turma" mostra "Seguir as regras do evento" × "Restringir a uma
 *      lista específica de e-mails", marcado conforme o gravado, e o aviso de
 *      contradição aparece só na turma contraditória;
 *   7. salvar a Turma 1 sem mudar nada grava publicoRestrito = false nela e
 *      mais nada (nenhuma escrita em turmas-interesse nem nas listas);
 *   8. "Adicionar à turma" em massa inscreve a técnica e deixa o gerente de
 *      fora, dizendo por quê;
 *   SEMPRE
 *   9. a inscrição já existente de um gerente na Turma 2 não é tocada por
 *      nenhum desses caminhos; sem rolagem horizontal; sem erro de JS.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarCondicaoAte } = require('./esperas');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

const ADM = 'adm@previ.com.br';
const TEC = 'tecnica@previ.com.br';
const GER = 'gerente@previ.com.br';
const FORA = 'fora.da.lista@previ.com.br';
const ANTIGO = 'antigo.gerente@previ.com.br';  /* gerente já inscrito na Turma 2 antes da regra */

function banco() {
  const users = {};
  [[ADM, 'ADMIN'], [TEC, 'TECNICA NA LISTA'], [GER, 'GERENTE NA LISTA'], [FORA, 'TECNICA FORA'], [ANTIGO, 'GERENTE ANTIGO']]
    .forEach(([e, n]) => { users[chave(e)] = { name: n, email: e, area: 'GETHO' }; });
  const pessoa = (e) => ({ name: users[chave(e)].name, email: e, area: 'GETHO' });
  return {
    'fa-users': users, 'fa-admins': { [chave(ADM)]: { email: ADM, name: 'ADMIN' } }, 'fa-diretores': {}, 'fa-facilitadores': {},
    'fa-gerentes': { [chave(GER)]: { email: GER, name: 'GERENTE NA LISTA' }, [chave(ANTIGO)]: { email: ANTIGO, name: 'GERENTE ANTIGO' } },
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: {
      evT: { nome: 'EVENTO DE TECNICOS', order: 1, publicado: true, cargaHoraria: '4', esperaAtiva: false, publicoDesc: 'Técnicos', dispensaCmflex: true, visibilidade: 'todos' },
      evL: { nome: 'EVENTO LIVRE', order: 2, publicado: true, cargaHoraria: '4', esperaAtiva: false },
    },
    turmas: {
      t1: { label: 'TURMA 1 ABERTA', eventoKey: 'evT', order: 1, dias: ['2027-11-03'] },
      t2: { label: 'TURMA 2 LISTA', eventoKey: 'evT', order: 2, dias: ['2027-11-04'], publicoRestrito: true },
      t3: { label: 'TURMA 3 ABERTA', eventoKey: 'evT', order: 3, dias: ['2027-11-05'] },
      t4: { label: 'TURMA 4 CONTRADITORIA', eventoKey: 'evT', order: 4, dias: ['2027-11-06'], publicoCargo: 'gerentes' },
      tL: { label: 'TURMA LIVRE', eventoKey: 'evL', order: 1, dias: ['2027-11-07'] },
    },
    'turmas-interesse': {
      t2: { [chave(ANTIGO)]: Object.assign(pessoa(ANTIGO), { status: 'inscrito', confirmedByAdmin: ADM, confirmedByAdminName: 'ADMIN', confirmedDate: '2026-09-01T10:00:00.000Z', date: '2026-09-01T10:00:00.000Z', removed: false }) },
    },
    'turmas-interesse-log': {}, 'turmas-config': {}, 'turmas-checkin': {},
    'turmas-publico': { t2: { [chave(TEC)]: pessoa(TEC), [chave(GER)]: pessoa(GER) } },
    'eventos-publico': {}, 'turmas-equipe': {}, 'turmas-sorteio': {}, avaliacoes: {}, pedidos: {}, holocron: {},
  };
}
const ANTIGO_PATH = 'turmas-interesse/t2/' + chave(ANTIGO);

const FORMATOS = [
  { nome: '1280', opts: { viewport: { width: 1280, height: 900 } } },
  { nome: '375', opts: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true } },
];

const AJUDANTE = `window.__boxVis = function () {
  var boxes = Array.prototype.slice.call(document.querySelectorAll('.modal-overlay .modal-box'));
  for (var i = boxes.length - 1; i >= 0; i--) {
    var r = boxes[i].getBoundingClientRect();
    if (r.height > 0 && r.width > 0 && getComputedStyle(boxes[i]).display !== 'none') return boxes[i];
  }
  return null;
};`;

async function abrir(browser, formato, email, hash) {
  const ctx = await browser.newContext(formato.opts);
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify({
    db: banco(), user: { email, emailVerified: true, uid: 'u-' + chave(email) }, delayDefault: 20,
  }) + ';' + AJUDANTE);
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#' + hash, { waitUntil: 'domcontentloaded' });
  return { ctx, page, erros };
}

/* O card de uma turma na vitrine, pelo rótulo: texto, se tem botão de interesse visível. */
const cardsDaVitrine = (page) => page.evaluate(() => Array.from(document.querySelectorAll('.turmas-grid > .turma-card-new')).map((c) => {
  const b = c.querySelector('.btn--interest');
  return {
    label: ((c.querySelector('.tc-label') || {}).textContent || '').trim(),
    texto: (c.textContent || '').replace(/\s+/g, ' ').trim(),
    botao: !!(b && getComputedStyle(b).display !== 'none' && !b.disabled),
    turma: b ? b.getAttribute('data-turma') : '',
  };
}));
const escritas = (page) => page.evaluate(() => (window.__ESCRITAS || []).map((e) => ({ path: e.path.replace(/^\//, ''), valor: e.valor })));
const semRolagem = (page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

async function vitrinePronta(page) {
  await page.waitForSelector('.turmas-evento-titulo', { timeout: 15000 });
  /* os botões de turma com regras passam por "Verificando…" antes de se decidirem */
  await page.waitForFunction(() => !Array.from(document.querySelectorAll('.btn--interest')).some((b) => getComputedStyle(b).display !== 'none' && /Verificando/.test(b.textContent)), null, { timeout: 10000 });
  await page.waitForTimeout(300);
}

(async () => {
  const browser = await chromium.launch();
  let falhas = 0;
  const anota = (linha, ok, detalhe) => {
    if (ok) console.log('  ok    ' + linha);
    else { falhas++; console.error('  FALHA ' + linha + (detalhe ? ' → ' + detalhe : '')); }
  };
  /* nem o registro dele, nem um ancestral sobrescrito inteiro (turmas-interesse ou turmas-interesse/t2) */
  const naoTocouAntigo = (lista) => !lista.some((e) => e.path.indexOf(ANTIGO_PATH) === 0 || ANTIGO_PATH.indexOf(e.path + '/') === 0);

  for (const formato of FORMATOS) {
    console.log('\n===== ' + formato.nome + ' px =====');

    /* 1. técnica na lista */
    {
      const { ctx, page, erros } = await abrir(browser, formato, TEC, 'turmas');
      try {
        await vitrinePronta(page);
        const cards = await cardsDaVitrine(page);
        const labels = cards.map((c) => c.label);
        anota('1. técnica na lista vê as turmas 1, 2 e 3 do evento', ['TURMA 1 ABERTA', 'TURMA 2 LISTA', 'TURMA 3 ABERTA'].every((l) => labels.indexOf(l) !== -1), JSON.stringify(labels));
        const c2 = cards.find((c) => c.label === 'TURMA 2 LISTA');
        anota('1. e tem o botão "Tenho interesse" na Turma 2', !!(c2 && c2.botao), JSON.stringify(c2));
        await page.evaluate(() => { window.__ESCRITAS = []; });
        await page.click('.btn--interest[data-turma="t2"]');
        await esperarCondicaoAte(page, () => (window.__ESCRITAS || []).some((e) => /turmas-interesse\/t2\//.test(e.path)), null, { limite: 10000 });
        const es = (await escritas(page)).filter((e) => /^turmas-interesse\//.test(e.path));
        anota('1. o interesse grava só o registro dela na Turma 2', es.length >= 1 && es.every((e) => e.path.indexOf('turmas-interesse/t2/' + chave(TEC)) === 0), JSON.stringify(es.map((e) => e.path)));
        const c4 = cards.find((c) => c.label === 'TURMA 4 CONTRADITORIA');
        anota('4. turma contraditória: sem botão, com aviso que não culpa a pessoa', !!c4 && !c4.botao && /não está recebendo inscrições/i.test(c4.texto), c4 && c4.texto.slice(0, 160));
        anota('sem rolagem horizontal (técnica)', await semRolagem(page));
        anota('sem erro de JS (técnica)', !erros.length, erros[0]);
      } finally { await ctx.close(); }
    }

    /* 2. gerente na lista de uma turma de evento de Técnicos */
    {
      const { ctx, page, erros } = await abrir(browser, formato, GER, 'turmas');
      try {
        await vitrinePronta(page);
        await page.evaluate(() => { window.__ESCRITAS = []; });
        const cards = await cardsDaVitrine(page);
        const c2 = cards.find((c) => c.label === 'TURMA 2 LISTA');
        anota('2. gerente na lista da Turma 2: sem botão de interesse', !!c2 && !c2.botao, JSON.stringify(c2));
        anota('2. e lê que a turma não é para gerentes', !!c2 && /não é para gerentes/i.test(c2.texto), c2 && c2.texto.slice(0, 160));
        anota('2. nenhuma turma do evento de Técnicos oferece botão ao gerente',
          cards.filter((c) => /^TURMA [1-4]/.test(c.label)).every((c) => !c.botao), JSON.stringify(cards.map((c) => [c.label, c.botao])));
        /* mesmo forçando o clique num botão escondido, a revalidação no clique recusa */
        await page.evaluate(() => { const b = document.querySelector('.btn--interest[data-turma="t2"]'); if (b) { b.disabled = false; b.style.display = ''; b.click(); } });
        await page.waitForTimeout(1200);
        const es = (await escritas(page)).filter((e) => /^turmas-interesse\//.test(e.path));
        anota('2. forçar o clique no botão escondido não grava nada', es.length === 0, JSON.stringify(es.map((e) => e.path)));
        anota('sem erro de JS (gerente)', !erros.length, erros[0]);
      } finally { await ctx.close(); }
    }

    /* 3. técnica fora da lista + turma sem restrição */
    {
      const { ctx, page, erros } = await abrir(browser, formato, FORA, 'turmas');
      try {
        await vitrinePronta(page);
        const labels = (await cardsDaVitrine(page)).map((c) => c.label);
        anota('3. fora da lista: não vê a Turma 2, vê as turmas 1 e 3', labels.indexOf('TURMA 2 LISTA') === -1 && labels.indexOf('TURMA 1 ABERTA') !== -1 && labels.indexOf('TURMA 3 ABERTA') !== -1, JSON.stringify(labels));
        await page.evaluate(() => { window.__ESCRITAS = []; });
        await page.click('.btn--interest[data-turma="tL"]');
        await esperarCondicaoAte(page, () => (window.__ESCRITAS || []).some((e) => /turmas-interesse\/tL\//.test(e.path)), null, { limite: 10000 });
        const es = (await escritas(page)).filter((e) => /^turmas-interesse\//.test(e.path));
        anota('3. turma sem restrição continua aceitando interesse como sempre', es.length >= 1 && es.every((e) => e.path.indexOf('turmas-interesse/tL/' + chave(FORA)) === 0), JSON.stringify(es.map((e) => e.path)));
        anota('sem erro de JS (fora da lista)', !erros.length, erros[0]);
      } finally { await ctx.close(); }
    }

    /* 5–9. admin */
    {
      const { ctx, page, erros } = await abrir(browser, formato, ADM, 'admin');
      try {
        await page.waitForSelector('.admin-tab-btn', { timeout: 15000 });
        await page.evaluate(() => { const b = Array.from(document.querySelectorAll('.admin-tab-btn')).find((x) => /Eventos/i.test(x.textContent)); if (b) b.click(); });
        await page.waitForSelector('[data-ev-key="evT"]', { timeout: 15000 });
        await page.evaluate(() => document.querySelector('[data-ev-key="evT"] > div:first-child').click());
        await page.waitForSelector('#turma-card-t4', { timeout: 10000 });
        await page.evaluate(() => { window.__ESCRITAS = []; });

        const card4 = await page.evaluate(() => (document.querySelector('#turma-card-t4').textContent || '').replace(/\s+/g, ' '));
        anota('5. o card da turma contraditória avisa que ninguém entra', /contradiz o do evento: ninguém entra/.test(card4), card4.slice(0, 200));
        const card1 = await page.evaluate(() => (document.querySelector('#turma-card-t1').textContent || '').replace(/\s+/g, ' '));
        anota('5. a turma sem público próprio mostra o do evento ("só técnicos"), sem aviso', /só técnicos/.test(card1) && !/contradiz/.test(card1), card1.slice(0, 200));

        const abrirEditar = async (tk) => {
          await page.evaluate((k) => {
            const b = Array.from(document.querySelectorAll('#turma-card-' + k + ' button')).find((x) => /Editar turma/.test(x.textContent || ''));
            b.click();
          }, tk);
          await page.waitForSelector('#turmaFormPublicoEvento', { timeout: 10000 });
        };
        const estadoForm = () => page.evaluate(() => {
          const av = document.querySelector('#turmaFormCargoAviso');
          return {
            evento: document.querySelector('#turmaFormPublicoEvento').checked,
            lista: document.querySelector('#turmaFormPublicoRestrito').checked,
            tipo: document.querySelector('#turmaFormPublicoRestrito').type,
            aviso: !!av && !av.hidden && av.getBoundingClientRect().height > 0,
            textos: (document.querySelector('#turmaFormPublicoEvento').closest('fieldset').textContent || '').replace(/\s+/g, ' '),
            cabe: (() => { const b = window.__boxVis(); return !b || b.scrollWidth <= b.clientWidth + 1; })(),
          };
        });
        const fechar = async () => {
          await page.evaluate(() => { const b = window.__boxVis(); const c = b && Array.from(b.querySelectorAll('button')).find((x) => /Cancelar/i.test(x.textContent || '')); if (c) c.click(); });
          await page.waitForFunction(() => !document.querySelector('#turmaFormPublicoEvento'), null, { timeout: 10000 });
        };

        /* 6–7 isolados: se o formulário falhar, a matrícula em massa (8) e a preservação (9) ainda são medidas */
        let esSalvar = [];
        try {
        await abrirEditar('t2');
        let f = await estadoForm();
        anota('6. Editar turma oferece as duas opções de público', f.tipo === 'radio' && /Seguir as regras do evento/.test(f.textos) && /Restringir a uma lista específica de e-mails/.test(f.textos), f.textos.slice(0, 160));
        anota('6. Turma 2 abre com "Restringir a uma lista" marcado', f.lista && !f.evento, JSON.stringify(f));
        anota('6. Turma 2 (lista, sem cargo próprio) não mostra aviso de contradição', !f.aviso);
        anota('6. o formulário cabe na tela sem rolagem lateral', f.cabe);
        await fechar();

        await abrirEditar('t4');
        f = await estadoForm();
        anota('6. Turma 4 mostra o aviso de contradição', f.aviso);
        await page.selectOption('#turmaFormPublicoCargo', '');
        const avisoSome = await page.evaluate(() => document.querySelector('#turmaFormCargoAviso').hidden);
        anota('6. escolher "Igual ao evento" tira o aviso (sem salvar)', avisoSome);
        await fechar();

        await abrirEditar('t1');
        f = await estadoForm();
        anota('6. Turma 1 abre com "Seguir as regras do evento" marcado (padrão)', f.evento && !f.lista, JSON.stringify(f));
        await page.evaluate(() => { window.__ESCRITAS = []; });
        await page.evaluate(() => { const b = window.__boxVis(); Array.from(b.querySelectorAll('button')).find((x) => /^Salvar/i.test((x.textContent || '').trim())).click(); });
        await esperarCondicaoAte(page, () => (window.__ESCRITAS || []).length > 0, null, { limite: 10000 });
        await page.waitForTimeout(400);
        esSalvar = await escritas(page);
        const tocouTurma1 = esSalvar.filter((e) => /^turmas\/t1/.test(e.path));
        const fora = esSalvar.filter((e) => !/^turmas\/t1/.test(e.path));
        const gravado = tocouTurma1.length ? (tocouTurma1[0].path === 'turmas/t1' ? tocouTurma1[0].valor.publicoRestrito : tocouTurma1.find((e) => /publicoRestrito$/.test(e.path)) && tocouTurma1.find((e) => /publicoRestrito$/.test(e.path)).valor) : undefined;
        anota('7. salvar a Turma 1 sem mudar nada grava publicoRestrito = false nela', gravado === false, JSON.stringify(tocouTurma1.map((e) => e.path)));
        anota('7. e não grava em mais nada (inscrições, listas, outras turmas)', fora.length === 0, JSON.stringify(fora.map((e) => e.path)));
        } catch (e) {
          anota('6–7. formulário "Editar turma"', false, String(e.message).split('\n')[0]);
          await page.evaluate(() => { const b = window.__boxVis(); const c = b && Array.from(b.querySelectorAll('button')).find((x) => /Cancelar/i.test(x.textContent || '')); if (c) c.click(); });
        }

        /* 8. matrícula em massa pela lista da Turma 2 */
        await page.waitForSelector('#turma-card-t2 .js-pub-badge', { timeout: 10000 });
        await page.evaluate(() => { window.__ESCRITAS = []; });
        await page.click('#turma-card-t2 .js-pub-badge');
        await page.waitForFunction(() => { const b = window.__boxVis(); return !!(b && b.querySelector('.admin-table')); }, null, { timeout: 10000 });
        const temBulk = await page.evaluate(() => { const b = window.__boxVis(); const x = Array.from(b.querySelectorAll('button')).find((y) => /Adicionar à turma/i.test(y.textContent || '')); if (x) x.click(); return !!x; });
        anota('8. a lista da Turma 2 oferece "Adicionar à turma"', temBulk);
        await page.waitForFunction(() => { const b = window.__boxVis(); return b && /INSCRITAS\?|Ninguém desta lista/i.test(b.textContent || ''); }, null, { timeout: 10000 });
        const txt = await page.evaluate(() => (window.__boxVis().textContent || '').replace(/\s+/g, ' '));
        anota('8. a confirmação inscreve 1 pessoa e diz que o gerente fica de fora pelo público', /Adicionar 1 pessoa/.test(txt) && /GERENTE NA LISTA/.test(txt) && /gerentes\/técnicos/.test(txt), txt.slice(0, 300));
        await page.evaluate(() => window.__boxVis().querySelector('.admin-modal-confirm-btn').click());
        await esperarCondicaoAte(page, () => (window.__ESCRITAS || []).some((e) => /turmas-interesse\/t2\//.test(e.path)), null, { limite: 10000 });
        await page.waitForTimeout(300);
        const esBulk = (await escritas(page)).filter((e) => /^turmas-interesse\//.test(e.path));
        anota('8. gravou só a técnica, inscrita com o critério completo',
          esBulk.length === 1 && esBulk[0].path === 'turmas-interesse/t2/' + chave(TEC) && esBulk[0].valor.status === 'inscrito' && !!esBulk[0].valor.confirmedByAdmin,
          JSON.stringify(esBulk.map((e) => e.path)));
        anota('8. o gerente da lista não foi gravado', !esBulk.some((e) => e.path.indexOf(chave(GER)) !== -1));

        /* 9. a inscrição anterior do gerente antigo, ao vivo no banco falso */
        const antigo = await page.evaluate((p) => new Promise((res) => firebase.database().ref(p).once('value', (s) => res(s.val()))), ANTIGO_PATH);
        anota('9. a inscrição já existente do gerente na Turma 2 continua igual',
          !!antigo && antigo.status === 'inscrito' && antigo.confirmedByAdmin === ADM && antigo.removed === false && antigo.confirmedDate === '2026-09-01T10:00:00.000Z',
          JSON.stringify(antigo));
        anota('9. nenhum caminho do admin escreveu nela', naoTocouAntigo(esSalvar.concat(esBulk)));
        anota('sem rolagem horizontal (admin)', await semRolagem(page));
        anota('sem erro de JS (admin)', !erros.length, erros[0]);
      } finally { await ctx.close(); }
    }
  }
  await browser.close();
  if (falhas) { console.error('\n' + falhas + ' falha(s).'); process.exit(1); }
  console.log('\nTUDO OK.');
})();
