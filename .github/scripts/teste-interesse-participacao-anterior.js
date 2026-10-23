/* Interesse em turmas de um evento que não aceita quem já participou de eventos anteriores.
 *
 * O evento novo marca, no painel, "Não aceitar interesse de quem já participou de:" (eventos/<ev>/bloqueiaParticipantesDe).
 * Quem tem interesse ou inscrição — registro não removido — numa turma de um evento marcado não manifesta interesse nas
 * turmas do evento novo nem entra na fila dele; o card explica por quê. Roda com o Firebase falso (escritas em
 * window.__ESCRITAS) — prova o que chega ao banco, não só a tela. Só desktop.
 *
 * O QUE ELE EXIGE:
 *   1. quem já participou (inscrita numa turma do Episódio I) vê a explicação, sem botão — no card da turma e no da fila;
 *   2. quem não participou registra interesse normalmente (grava turmas-interesse/<turma>/<pessoa>);
 *   3. registro REMOVIDO no evento anterior não impede;
 *   4. o clique confere de novo no banco: participação que surgiu depois de a página abrir impede, e nada é gravado;
 *   5. o formulário do evento mostra o evento marcado e salvar grava bloqueiaParticipantesDe;
 *   6. nenhum erro de JavaScript não tratado. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

const ADM = 'adm@previ.com.br', JA = 'ja.participou@previ.com.br', NOVA = 'nova@previ.com.br', SAIU = 'saiu@previ.com.br';

function banco() {
  const users = {}, admins = {};
  [[ADM, 'ADMIN'], [JA, 'JA PARTICIPOU'], [NOVA, 'PESSOA NOVA'], [SAIU, 'SAIU DO EP1']].forEach(([e, n]) => { users[chave(e)] = { name: n, email: e, area: 'INFOR' }; });
  admins[chave(ADM)] = { email: ADM, name: 'ADMIN' };
  const interesse = { t1: {} };
  interesse.t1[chave(JA)] = { name: 'JA PARTICIPOU', email: JA, status: 'inscrito', removed: false, date: '2026-08-01T10:00:00.000Z' };
  interesse.t1[chave(SAIU)] = { name: 'SAIU DO EP1', email: SAIU, status: 'removido', removed: true, date: '2026-08-01T10:00:00.000Z' };
  return {
    'fa-users': users, 'fa-admins': admins, 'fa-diretores': {}, 'fa-facilitadores': {},
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: {
      ev1: { nome: 'EPISÓDIO I', order: 1, publicado: true, cargaHoraria: '20', esperaAtiva: false },
      ev3: { nome: 'EPISÓDIO III', order: 2, publicado: true, cargaHoraria: '3', esperaAtiva: true, bloqueiaParticipantesDe: { ev1: true } }
    },
    turmas: {
      t1: { label: 'TURMA EP1', eventoKey: 'ev1', order: 1, dias: ['2027-08-11'] },
      t3: { label: 'TURMA EP3', eventoKey: 'ev3', order: 2, dias: ['2027-11-03'] }
    },
    'turmas-interesse': interesse, 'turmas-interesse-log': {}, 'turmas-config': {}, 'turmas-checkin': {},
    'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {}, 'turmas-sorteio': {},
    avaliacoes: {}, pedidos: {}, holocron: {}
  };
}

async function abrir(browser, email, hash) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify({ db: banco(), user: { email, emailVerified: true, uid: 'u-' + chave(email) }, delayDefault: 20 }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + hash, { waitUntil: 'domcontentloaded' });
  return { ctx, page, erros };
}
const texto = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent.trim() : ''; }, sel);
const visivel = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!(e && e.offsetParent !== null && getComputedStyle(e).display !== 'none'); }, sel);
const escritasDe = (page, caminho) => page.evaluate((c) => (window.__ESCRITAS || []).filter((e) => e.path === c), caminho);
/* o botão da turma do Episódio III terminou de conferir (sai do "Verificando…") */
const conferido = (page) => page.waitForFunction(() => {
  const b = document.querySelector('.btn--interest[data-turma="t3"]'), m = document.getElementById('intent-msg-t3');
  return !!b && (b.style.display === 'none' || (!b.disabled && !/Verificando/.test(b.textContent))) && (b.style.display !== 'none' || !!(m && m.textContent));
}, null, { timeout: 15000 });

(async () => {
  const browser = await chromium.launch();
  let falhas = 0;
  const anota = (linha, ok, detalhe) => { if (ok) console.log('  ok    ' + linha); else { falhas++; console.error('  FALHA ' + linha + (detalhe ? ' → ' + detalhe : '')); } };
  try {
    /* 1. já participou */
    {
      const { ctx, page, erros } = await abrir(browser, JA, '#turmas');
      /* a página redesenha os cards quando o login assenta: espera o estado final (explicação, botão escondido) */
      await page.waitForFunction(() => { const b = document.querySelector('.btn--interest[data-turma="t3"]'), m = document.getElementById('intent-msg-t3');
        return !!b && b.style.display === 'none' && /quem ainda não participou/.test((m && m.textContent) || ''); }, null, { timeout: 15000 });
      const msg = await texto(page, '#intent-msg-t3');
      anota('quem já participou do Episódio I vê a explicação, sem o botão "Tenho interesse"',
        !(await visivel(page, '.btn--interest[data-turma="t3"]')) && /quem ainda não participou de EPISÓDIO I/.test(msg), 'mensagem: ' + msg);
      await page.waitForFunction(() => { const c = document.querySelector('.turma-card-espera'); return !!c && /EPISÓDIO I/.test((c.querySelector('.turma-intent-msg') || {}).textContent || ''); }, null, { timeout: 15000 });
      anota('e também não entra na lista de espera do Episódio III (explicação no card da fila)', !(await visivel(page, '.turma-card-espera .btn--espera')));
      anota('sem erro de JavaScript (já participou)', !erros.length, erros[0]);
      await ctx.close();
    }
    /* 2. não participou: registra */
    {
      const { ctx, page, erros } = await abrir(browser, NOVA, '#turmas');
      await conferido(page);
      anota('quem não participou vê "Tenho interesse" habilitado', await visivel(page, '.btn--interest[data-turma="t3"]') && /Tenho interesse/.test(await texto(page, '.btn--interest[data-turma="t3"]')));
      await page.click('.btn--interest[data-turma="t3"]');
      await page.waitForFunction((c) => (window.__ESCRITAS || []).some((e) => e.path === c), 'turmas-interesse/t3/' + chave(NOVA), { timeout: 10000 });
      anota('e o interesse é gravado em turmas-interesse/t3', (await escritasDe(page, 'turmas-interesse/t3/' + chave(NOVA))).some((e) => e.valor && e.valor.status === 'interessado'));
      anota('sem erro de JavaScript (não participou)', !erros.length, erros[0]);
      await ctx.close();
    }
    /* 3. registro removido no Episódio I não impede */
    {
      const { ctx, page, erros } = await abrir(browser, SAIU, '#turmas');
      await conferido(page);
      anota('registro REMOVIDO no Episódio I não impede: "Tenho interesse" habilitado', await visivel(page, '.btn--interest[data-turma="t3"]') && !(await page.$eval('.btn--interest[data-turma="t3"]', (b) => b.disabled)));
      anota('sem erro de JavaScript (removido)', !erros.length, erros[0]);
      await ctx.close();
    }
    /* 4. o clique confere de novo no banco */
    {
      const { ctx, page, erros } = await abrir(browser, NOVA, '#turmas');
      await conferido(page);
      await page.evaluate((k) => new Promise((ok) => firebase.database().ref('turmas-interesse/t1/' + k).set({ name: 'PESSOA NOVA', status: 'interessado', removed: false }, () => ok())), chave(NOVA));
      await page.click('.btn--interest[data-turma="t3"]');
      await page.waitForFunction(() => /quem ainda não participou/.test((document.getElementById('intent-msg-t3') || {}).textContent || ''), null, { timeout: 10000 });
      anota('participação registrada depois de a página abrir: o clique confere no banco, explica e NÃO grava',
        !(await escritasDe(page, 'turmas-interesse/t3/' + chave(NOVA))).length);
      anota('sem erro de JavaScript (reconferência)', !erros.length, erros[0]);
      await ctx.close();
    }
    /* 5. o formulário do evento */
    {
      const { ctx, page, erros } = await abrir(browser, ADM, '#admin');
      await page.waitForSelector('.admin-tab-btn', { timeout: 15000 });
      await page.evaluate(() => { const b = Array.from(document.querySelectorAll('.admin-tab-btn')).find((x) => /Eventos/i.test(x.textContent)); if (b) b.click(); });
      await page.waitForSelector('[data-ev-key="ev3"]', { timeout: 15000 });
      await page.evaluate(() => { const b = Array.from(document.querySelectorAll('[data-ev-key="ev3"] button')).find((x) => /Editar evento/.test(x.textContent)); b.click(); });
      await page.waitForSelector('#eventoFormBloqueioLista .evento-bloqueio-cb', { timeout: 10000 });
      const opcoes = await page.$$eval('#eventoFormBloqueioLista .evento-bloqueio-cb', (cs) => cs.map((c) => c.value + ':' + c.checked));
      anota('o formulário do Episódio III lista os outros eventos, com o Episódio I marcado (e não lista o próprio evento)', JSON.stringify(opcoes) === JSON.stringify(['ev1:true']), JSON.stringify(opcoes));
      await page.click('.modal-box .admin-modal-save-btn');
      await page.waitForFunction(() => (window.__ESCRITAS || []).some((e) => e.path === 'eventos/ev3'), null, { timeout: 10000 });
      const gravado = (await escritasDe(page, 'eventos/ev3')).pop();
      anota('salvar grava bloqueiaParticipantesDe = { ev1: true }', !!gravado && JSON.stringify(gravado.valor.bloqueiaParticipantesDe) === JSON.stringify({ ev1: true }), JSON.stringify(gravado && gravado.valor.bloqueiaParticipantesDe));
      anota('sem erro de JavaScript (painel)', !erros.length, erros[0]);
      await ctx.close();
    }
  } catch (e) {
    falhas++;
    console.error('  FALHA inesperada: ' + e.message);
  } finally {
    await browser.close();
  }
  if (falhas) { console.error(`\n${falhas} falha(s).`); process.exit(1); }
  console.log('\nTudo certo.');
})();
