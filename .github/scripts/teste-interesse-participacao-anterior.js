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
 *   6. nenhum erro de JavaScript não tratado.
 *
 * UMA TURMA POR PESSOA (eventos/<ev>/umaTurmaPorPessoa + umaTurmaComEventos — Episódios III e IV marcados um no outro):
 *   7. quem tem interesse numa turma do grupo vê, nas OUTRAS turmas (do mesmo evento e do outro), em qual turma está e
 *      como trocar ("remova seu interesse"); na própria turma, o "Remover interesse" de sempre; a fila também barra;
 *   8. quem está INSCRITA numa turma do grupo é orientada a pedir ao admin;
 *   9. o painel aplica a mesma regra: "＋ Participante" numa turma do grupo recusa com o motivo e nada é gravado;
 *  10. o formulário grava umaTurmaPorPessoa e umaTurmaComEventos. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarSessaoAssentada } = require('./esperas');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

const ADM = 'adm@previ.com.br', JA = 'ja.participou@previ.com.br', NOVA = 'nova@previ.com.br', SAIU = 'saiu@previ.com.br';
const UMA = 'uma.turma@previ.com.br', INSCR = 'inscrita.ep4@previ.com.br';

function banco() {
  const users = {}, admins = {};
  [[ADM, 'ADMIN'], [JA, 'JA PARTICIPOU'], [NOVA, 'PESSOA NOVA'], [SAIU, 'SAIU DO EP1'], [UMA, 'JA TEM TURMA EP3'], [INSCR, 'INSCRITA NO EP4']].forEach(([e, n]) => { users[chave(e)] = { name: n, email: e, area: 'INFOR' }; });
  admins[chave(ADM)] = { email: ADM, name: 'ADMIN' };
  const interesse = { t1: {} };
  interesse.t1[chave(JA)] = { name: 'JA PARTICIPOU', email: JA, status: 'inscrito', removed: false, date: '2026-08-01T10:00:00.000Z' };
  interesse.t1[chave(SAIU)] = { name: 'SAIU DO EP1', email: SAIU, status: 'removido', removed: true, date: '2026-08-01T10:00:00.000Z' };
  interesse.t3 = {}; interesse.t3[chave(UMA)] = { name: 'JA TEM TURMA EP3', email: UMA, status: 'interessado', removed: false, date: '2026-10-20T10:00:00.000Z' };
  interesse.t4 = {}; interesse.t4[chave(INSCR)] = { name: 'INSCRITA NO EP4', email: INSCR, status: 'inscrito', removed: false, confirmedByAdmin: ADM, date: '2026-10-20T10:00:00.000Z' };
  return {
    'fa-users': users, 'fa-admins': admins, 'fa-diretores': {}, 'fa-facilitadores': {},
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: {
      ev1: { nome: 'EPISÓDIO I', order: 1, publicado: true, cargaHoraria: '20', esperaAtiva: false },
      ev3: { nome: 'EPISÓDIO III', order: 2, publicado: true, cargaHoraria: '3', esperaAtiva: true, bloqueiaParticipantesDe: { ev1: true },
        umaTurmaPorPessoa: true, umaTurmaComEventos: { ev4: true } },
      ev4: { nome: 'EPISÓDIO IV', order: 3, publicado: true, cargaHoraria: '3', esperaAtiva: false, bloqueiaParticipantesDe: { ev1: true },
        umaTurmaPorPessoa: true, umaTurmaComEventos: { ev3: true } }
    },
    turmas: {
      t1: { label: 'TURMA EP1', eventoKey: 'ev1', order: 1, dias: ['2027-08-11'] },
      t3: { label: 'TURMA EP3', eventoKey: 'ev3', order: 2, dias: ['2027-11-03'] },
      t3b: { label: 'TURMA EP3 B', eventoKey: 'ev3', order: 3, dias: ['2027-11-05'] },
      t4: { label: 'TURMA EP4', eventoKey: 'ev4', order: 4, dias: ['2027-11-16'] }
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
  /* o login assenta e a página redesenha os cards: só depois disso o teste age (senão o redesenho corre com ele) */
  await esperarSessaoAssentada(page);
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
      /* a participação aparece no banco SEM avisar a página (como se tivesse sido gravada noutro lugar e a página ainda não
         soubesse): só a conferência do clique pode descobri-la. Gravar pelo Firebase faria o site redesenhar e barrar antes. */
      await page.evaluate((k) => { window.__CFG.db['turmas-interesse'].t1[k] = { name: 'PESSOA NOVA', status: 'interessado', removed: false }; }, chave(NOVA));
      /* clique pelo próprio elemento: se a página se redesenhar nesse instante (e, conferindo de novo, já esconder o
         botão — o que também é certo), o clique não fica esperando o botão aparecer; o que se prova é a conferência */
      await page.evaluate(() => document.querySelector('.btn--interest[data-turma="t3"]').click());
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
      anota('o formulário do Episódio III lista os outros eventos, com o Episódio I marcado (e não lista o próprio evento)', JSON.stringify(opcoes) === JSON.stringify(['ev1:true', 'ev4:false']), JSON.stringify(opcoes));
      const grupo = await page.$$eval('#eventoFormUmaTurmaLista .evento-umaturma-cb', (cs) => cs.map((c) => c.value + ':' + c.checked));
      anota('10. "Só uma turma por pessoa" marcada, contando também o Episódio IV', await page.$eval('#eventoFormUmaTurma', (c) => c.checked) && JSON.stringify(grupo) === JSON.stringify(['ev1:false', 'ev4:true']), JSON.stringify(grupo));
      await page.click('.modal-box .admin-modal-save-btn');
      await page.waitForFunction(() => (window.__ESCRITAS || []).some((e) => e.path === 'eventos/ev3'), null, { timeout: 10000 });
      const gravado = (await escritasDe(page, 'eventos/ev3')).pop();
      anota('salvar grava bloqueiaParticipantesDe = { ev1: true }', !!gravado && JSON.stringify(gravado.valor.bloqueiaParticipantesDe) === JSON.stringify({ ev1: true }), JSON.stringify(gravado && gravado.valor.bloqueiaParticipantesDe));
      anota('10. e grava umaTurmaPorPessoa = true com umaTurmaComEventos = { ev4: true }', !!gravado && gravado.valor.umaTurmaPorPessoa === true && JSON.stringify(gravado.valor.umaTurmaComEventos) === JSON.stringify({ ev4: true }),
        JSON.stringify(gravado && [gravado.valor.umaTurmaPorPessoa, gravado.valor.umaTurmaComEventos]));
      anota('sem erro de JavaScript (painel)', !erros.length, erros[0]);
      await ctx.close();
    }
    /* 7. já tem interesse numa turma do grupo */
    {
      const { ctx, page, erros } = await abrir(browser, UMA, '#turmas');
      /* estados finais (a página redesenha os cards quando o login assenta): barradas nas outras, Remover interesse na própria */
      await page.waitForFunction(() => { const ok = (k) => { const b = document.querySelector('.btn--interest[data-turma="' + k + '"]'), m = document.getElementById('intent-msg-' + k);
        return !!b && b.style.display === 'none' && /uma turma por vez/.test((m && m.textContent) || ''); };
        const p = document.querySelector('.btn--interest[data-turma="t3"]');
        return ok('t3b') && ok('t4') && !!p && /Remover interesse/.test(p.textContent); }, null, { timeout: 15000 });
      const m3b = await texto(page, '#intent-msg-t3b'), m4 = await texto(page, '#intent-msg-t4');
      anota('7. outra turma do MESMO evento: diz em qual turma ela está e como trocar, sem botão',
        !(await visivel(page, '.btn--interest[data-turma="t3b"]')) && /já tem interesse na TURMA EP3 — EPISÓDIO III \(dia 03\/11\)/.test(m3b) && /uma turma por vez/.test(m3b) && /remova seu interesse/.test(m3b), m3b);
      anota('7. turma do OUTRO evento do grupo (Episódio IV): a mesma regra', !(await visivel(page, '.btn--interest[data-turma="t4"]')) && /já tem interesse na TURMA EP3/.test(m4), m4);
      anota('7. na própria turma: "Remover interesse", como sempre', /Remover interesse/.test(await texto(page, '.btn--interest[data-turma="t3"]')));
      await page.waitForFunction(() => { const c = document.querySelector('.turma-card-espera'); return !!c && /uma turma por vez/.test((c.querySelector('.turma-intent-msg') || {}).textContent || ''); }, null, { timeout: 15000 });
      anota('7. e não entra na lista de espera do evento', !(await visivel(page, '.turma-card-espera .btn--espera')));
      anota('sem erro de JavaScript (uma turma)', !erros.length, erros[0]);
      await ctx.close();
    }
    /* 8. inscrita numa turma do grupo */
    {
      const { ctx, page, erros } = await abrir(browser, INSCR, '#turmas');
      await page.waitForFunction(() => /uma turma por vez/.test((document.getElementById('intent-msg-t3') || {}).textContent || ''), null, { timeout: 15000 });
      const m = await texto(page, '#intent-msg-t3');
      anota('8. inscrita na turma do Episódio IV: no Episódio III, orientada a pedir ao admin', /está inscrita na TURMA EP4 — EPISÓDIO IV/.test(m) && /peça ao admin/.test(m), m);
      anota('sem erro de JavaScript (inscrita)', !erros.length, erros[0]);
      await ctx.close();
    }
    /* 9. o painel: ＋ Participante numa turma do grupo */
    {
      const { ctx, page, erros } = await abrir(browser, ADM, '#admin');
      await page.waitForSelector('.admin-tab-btn', { timeout: 15000 });
      await page.evaluate(() => { const b = Array.from(document.querySelectorAll('.admin-tab-btn')).find((x) => /Eventos/i.test(x.textContent)); if (b) b.click(); });
      await page.waitForSelector('[data-ev-key="ev4"]', { timeout: 15000 });
      await page.click('[data-ev-key="ev4"] .ev-toggle-icon');
      await page.waitForSelector('#turma-card-t4 .taa-more-btn', { timeout: 10000 });
      await page.click('#turma-card-t4 .taa-more-btn');
      await page.evaluate(() => { Array.from(document.querySelectorAll('#turma-card-t4 .taa-dropdown button')).find((b) => /Participante/.test(b.textContent)).click(); });
      await page.waitForSelector('#addPartSearch', { timeout: 10000 });
      await page.fill('#addPartSearch', 'JA TEM TURMA');
      await page.waitForSelector('#addPartResults li', { timeout: 10000 });
      await page.click('#addPartResults li');
      await page.selectOption('#addPartStatus', 'interessado');
      await page.click('.modal-box .admin-modal-add-btn');
      await page.waitForFunction(() => /uma turma por pessoa/.test((document.getElementById('addPartErr') || {}).textContent || ''), null, { timeout: 10000 });
      const err = await texto(page, '#addPartErr');
      anota('9. painel: "＋ Participante" no Episódio IV recusa quem já tem interesse no III, com o motivo, e nada é gravado',
        /já tem interesse na TURMA EP3/.test(err) && /retire-a daquela turma primeiro/.test(err) && !(await escritasDe(page, 'turmas-interesse/t4/' + chave(UMA))).length, err);
      anota('sem erro de JavaScript (painel, uma turma)', !erros.length, erros[0]);
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
