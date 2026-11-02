/* "Ver esta tela como" só para admin — também depois de uma TROCA DE CONTA NA MESMA ABA.
 *
 * POR QUE ESTE TESTE EXISTE
 * Sair da conta não recarrega a página. Até 02/11/2026 a barra "Ver esta tela como" (Turmas e Minha Área), a pessoa
 * simulada e o "— eu mesma —" (que apontava para a sessão da ABERTURA da página) sobreviviam à troca: uma gerente que
 * entrava na aba onde uma admin estivera via a barra de ADMIN e, se havia simulação ativa, a página da pessoa simulada.
 * Visto em produção com a conta TESTE_GERENTE. Nada era gravado em nome de ninguém (quem grava é a conta logada e o banco
 * confere), mas uma conta comum não pode ver nem usar uma ferramenta de admin.
 *
 * Firebase falso, contas sintéticas, 1280 e 375 px. O QUE ELE EXIGE:
 *   1. admin → sair → gerente na mesma aba: nenhum controle de ADMIN (barra, aviso, marca de pré-visualização), e a página
 *      é exatamente a da gerente abrindo do zero; ela age normalmente e só grava na própria chave;
 *   2. admin com "Ver como" ativo → sair → gerente: a simulação acaba (nada da pessoa simulada fica na tela);
 *   3. admin → sair → técnica, e → estagiária (Outros públicos): recurso indisponível;
 *   4. gerente entrando direto: recurso indisponível;
 *   5. admin entrando de novo na mesma aba: o recurso volta, em "— eu mesma —", e funciona;
 *   6. trocas rápidas de conta, sem esperar a página: nenhum estado de ADMIN sobra;
 *   7. leitura de fa-admins que falha: a admin da lista não ganha o recurso; lenta: só aparece depois que a leitura chega;
 *   8. Minha Área: a mesma troca de conta tira a barra de lá, e a tela é a da conta nova;
 *   9. nenhuma gravação além da ação da própria pessoa; sem erro de JS; sem rolagem lateral.
 * A equivalência entre o "Ver como" e o login real continua provada por teste-ver-como-card.js.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarCondicao, esperarCondicaoAte } = require('./esperas');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

const ADM = 'admin.tc@previ.com.br';        /* admin pela lista fa-admins (técnica, sem registro) */
const GER = 'gerente.tc@previ.com.br';      /* gerente comum */
const TEC = 'tecnica.tc@previ.com.br';      /* técnica comum, com interesse no evento de Técnicos */
const EST = 'estagiaria.tc@previ.com.br';   /* Outros públicos: estagiária */
const NOMES = { [ADM]: 'ADMIN TC', [GER]: 'GERENTE TC', [TEC]: 'TECNICA TC', [EST]: 'ESTAGIARIA TC' };
function dia(o) { const d = new Date(); d.setDate(d.getDate() + o); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
const ev = (nome, order, extra) => Object.assign({ nome, order, publicado: true, esperaAtiva: false, missaoTitulo: 'Missão ' + nome, missaoTexto: 'Texto.', topicos: 'T.', itinerario: ['Dia 1'] }, extra || {});
const reg = (e) => ({ name: NOMES[e], email: e, area: 'TI', status: 'interessado', removed: false, date: '2026-10-01T10:00:00.000Z' });

function banco() {
  const users = {}; Object.keys(NOMES).forEach((e) => { users[chave(e)] = { name: NOMES[e], email: e, area: 'TI', emailConfirmado: true }; });
  return {
    'fa-users': users, 'fa-admins': { [chave(ADM)]: { email: ADM, name: NOMES[ADM] } }, 'fa-gerentes': { [chave(GER)]: { email: GER, name: NOMES[GER] } },
    'fa-diretores': {}, 'fa-outros-publicos': { [chave(EST)]: { email: EST, name: NOMES[EST], categorias: { estagiario: true }, addedAt: '2026-11-01T10:00:00.000Z', addedBy: ADM } },
    'publicos-config': { ativo: true, em: '2026-11-02T12:45:42.000Z', por: 'super@previ.com.br', porNome: 'SUPER' },
    'fa-facilitadores': {}, 'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: {
      evGeral: ev('GERAL', 1, { esperaAtiva: true }), ep3: ev('SO TECNICOS', 2, { publicoDesc: 'Técnicos' }),
      ep4: ev('SO GERENTES', 3, { publicoDesc: 'Gerentes' }), evEst: ev('SO ESTAGIARIOS', 4, { publicoDesc: 'Estagiários' }),
    },
    turmas: {
      tG: { label: 'GERAL T1', eventoKey: 'evGeral', order: 1, dias: [dia(20)] }, t3: { label: 'TEC T1', eventoKey: 'ep3', order: 1, dias: [dia(21)] },
      t4: { label: 'GER T1', eventoKey: 'ep4', order: 1, dias: [dia(22)] }, tEst: { label: 'EST T1', eventoKey: 'evEst', order: 1, dias: [dia(23)] },
    },
    'turmas-interesse': { t3: { [chave(TEC)]: reg(TEC) }, tEst: { [chave(EST)]: reg(EST) } },
    'turmas-interesse-log': {}, 'turmas-config': {}, 'turmas-checkin': {}, 'turmas-sorteio': {}, 'turmas-equipe': {},
    'turmas-publico': {}, 'eventos-publico': {}, avaliacoes: {}, pedidos: {}, holocron: {},
  };
}

async function abrir(browser, email, vp, mob, rede, rota) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: !!mob, hasTouch: !!mob });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify(Object.assign({ db: banco(), user: { email, emailVerified: true, uid: 'u-' + chave(email) }, delayDefault: 20 }, rede || {})) + ';');
  await page.addInitScript(() => {
    window.__redesenhos = 0;
    document.addEventListener('DOMContentLoaded', () => { const h = document.querySelector('.turmas-eventos'); if (h) new MutationObserver(() => { window.__redesenhos++; }).observe(h, { childList: true }); });
  });
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#' + (rota || 'turmas'), { waitUntil: 'domcontentloaded' });
  if (!rede || !rede.semAssentar) await (rota === 'minha-area' ? assentarMA(page, email) : assentar(page, email));
  return { ctx, page, erros };
}
/* sessão = email, grade parada (sem redesenho novo em 1,5 s) e nenhum botão em "Verificando…" */
async function assentar(page, email) {
  await esperarCondicao(page, (e) => !!(window.faAuth && window.faAuth.getSession() && window.faAuth.getSession().email === e) && !!document.querySelector('.turmas-eventos .turma-card-new'), email, { limite: 15000, descricao: 'sessão de ' + email + ' e grade' });
  for (let i = 0; i < 10; i++) { const n = await page.evaluate(() => window.__redesenhos); if (!(await esperarCondicaoAte(page, (m) => window.__redesenhos > m, n, { limite: 1500 }))) break; }
  await esperarCondicao(page, () => !Array.from(document.querySelectorAll('.btn--interest, .btn--espera')).some((b) => b.offsetParent !== null && /Verificando/.test(b.textContent)), null, { limite: 15000, descricao: 'sem "Verificando…"' });
}
async function assentarMA(page, email) {
  await esperarCondicao(page, (e) => !!(window.faAuth && window.faAuth.getSession() && window.faAuth.getSession().email === e), email, { limite: 15000, descricao: 'sessão de ' + email });
  await esperarCondicao(page, () => { const w = document.getElementById('minhaAreaContent'); return !!w && !!w.textContent.trim() && !/Carregando/.test(w.textContent); }, null, { limite: 15000, descricao: 'Minha Área desenhada' });
  await page.waitForTimeout(800);
}
/* sair e entrar com outra conta NA MESMA ABA, sem recarregar; rota = a página aberta em seguida */
async function trocar(page, email, rota) {
  await page.evaluate(() => window.faAuth.logout());
  await esperarCondicao(page, () => !window.faAuth.getSession(), null, { descricao: 'sessão encerrada' });
  await page.evaluate((e) => firebase.auth().signInWithEmailAndPassword(e, 'x'), email);
  await esperarCondicao(page, (e) => !!window.faAuth.getSession() && window.faAuth.getSession().email === e, email, { descricao: 'sessão de ' + email });
  await page.evaluate((r) => { location.hash = '#' + r; }, rota || 'turmas');
  await (rota === 'minha-area' ? assentarMA(page, email) : assentar(page, email));
}
async function verComo(page, email) {
  await esperarCondicao(page, (em) => Array.from(document.querySelectorAll('.turmas-vercomo .aluno-vercomo-sel option')).some((o) => o.dataset.email === em), email, { descricao: 'a pessoa no seletor' });
  const v = await page.$eval('.turmas-vercomo .aluno-vercomo-sel', (el, em) => Array.from(el.options).find((o) => o.dataset.email === em).value, email);
  await page.selectOption('.turmas-vercomo .aluno-vercomo-sel', v);
  await assentar(page, await page.evaluate(() => window.faAuth.getSession().email));
}
/* o que está na tela: controles de ADMIN e a página Turmas (eventos na ordem, botões, mensagens, texto inteiro) */
function estado(page) {
  return page.evaluate(() => {
    const txt = (el) => ((el && el.textContent) || '').replace(/\s+/g, ' ').trim();
    const host = document.querySelector('.turmas-eventos');
    return {
      admin: {
        barras: document.querySelectorAll('.aluno-vercomo').length, avisos: Array.from(document.querySelectorAll('.aluno-vercomo-aviso')).filter((a) => a.offsetParent !== null || a.isConnected && getComputedStyle(a).display !== 'none').length,
        previa: !!document.querySelector('.turmas-previa'), inativos: document.querySelectorAll('[aria-disabled="true"]').length,
      },
      pagina: Array.from(host.querySelectorAll('.turmas-evento-grupo')).map((g) => ({ ev: g.getAttribute('data-evento-key'),
        turmas: Array.from(g.querySelectorAll('.turma-card-new[data-turma-key]')).map((c) => { const b = c.querySelector('.btn--interest'); return c.getAttribute('data-turma-key') + ':' + (b && b.offsetParent !== null ? txt(b) : '—') + '|' + txt(c.querySelector('.turma-intent-msg')); }),
        fila: g.querySelector('.turma-card-espera .btn--espera') ? txt(g.querySelector('.turma-card-espera .btn--espera')) : null })),
      texto: (host.innerText || '').replace(/\s+/g, ' ').trim(),
      escritas: (window.__ESCRITAS || []).map((e) => e.path),
      largura: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
}
const maEstado = (page) => page.evaluate(() => ({
  barras: document.querySelectorAll('.minha-area-vercomo, #page-minha-area .aluno-vercomo').length,
  avisos: document.querySelectorAll('#minhaAreaContent .aluno-vercomo-aviso').length,
  texto: ((document.getElementById('minhaAreaContent') || {}).innerText || '').replace(/\s+/g, ' ').trim(),
}));
const SEM_ADMIN = { barras: 0, avisos: 0, previa: false, inativos: 0 };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  const browser = await chromium.launch();
  let falhas = 0;
  const anota = (r, ok, d) => { if (ok) console.log('  ok    ' + r); else { falhas++; console.error('  FALHA ' + r + (d ? ' → ' + d : '')); } };

  for (const [vp, mob, F] of [[{ width: 1280, height: 900 }, false, '1280'], [{ width: 375, height: 812 }, true, '375']]) {
    console.log('\n== ' + F + ' px ==');
    /* referências: cada conta abrindo a página do zero */
    const ref = {};
    for (const e of [ADM, GER, TEC, EST]) {
      const { ctx, page, erros } = await abrir(browser, e, vp, mob);
      ref[e] = await estado(page);
      if (e !== ADM) anota(NOMES[e] + ' @' + F + ' entrando direto: nenhum controle de ADMIN', igual(ref[e].admin, SEM_ADMIN) && !erros.length, JSON.stringify({ a: ref[e].admin, erros }));
      else anota('admin @' + F + ' entrando direto: o recurso está disponível', ref[e].admin.barras === 1, JSON.stringify(ref[e].admin));
      await ctx.close();
    }

    /* 1 e 5: admin → gerente → admin, na mesma aba */
    {
      const { ctx, page, erros } = await abrir(browser, ADM, vp, mob);
      await trocar(page, GER);
      let e = await estado(page);
      anota('1 @' + F + ': admin → sair → gerente na mesma aba: nenhum controle de ADMIN', igual(e.admin, SEM_ADMIN), JSON.stringify(e.admin));
      anota('1 @' + F + ': a página é exatamente a da gerente abrindo do zero', igual(e.pagina, ref[GER].pagina) && e.texto === ref[GER].texto, JSON.stringify({ e: e.pagina, ref: ref[GER].pagina }));
      const antes = e.escritas.length;
      await page.locator('.turma-card-new[data-turma-key="t4"] .btn--interest').click();
      await esperarCondicao(page, () => (window.__ESCRITAS || []).some((w) => w.path.indexOf('turmas-interesse/t4/') === 0), null, { descricao: 'o interesse da gerente gravado' });
      const novas = (await estado(page)).escritas.slice(antes);
      anota('1 @' + F + ': a gerente age normalmente, e só na própria chave (nenhuma ação de ADMIN)', novas.length > 0 && novas.every((p) => p.indexOf(chave(GER)) !== -1), JSON.stringify(novas));
      await trocar(page, ADM);
      e = await estado(page);
      anota('5 @' + F + ': admin entrando de novo na mesma aba: o recurso volta, em "eu mesma", sem pré-visualização',
        e.admin.barras === 1 && !e.admin.previa && (await page.$eval('.turmas-vercomo .aluno-vercomo-sel', (s) => s.value)) === '', JSON.stringify(e.admin));
      await verComo(page, TEC);
      e = await estado(page);
      anota('5 @' + F + ': e funciona — "Ver como" a técnica mostra a página dela, em pré-visualização', e.admin.previa && igual(e.pagina.map((g) => g.ev), ref[TEC].pagina.map((g) => g.ev)), JSON.stringify({ a: e.admin, ev: e.pagina.map((g) => g.ev) }));
      anota('1/5 @' + F + ': sem erro de JS, sem rolagem lateral', !erros.length && !e.largura, JSON.stringify(erros));
      await ctx.close();
    }

    /* 2 e 3: admin com simulação ativa → sair → gerente / técnica / estagiária */
    for (const quem of [GER, TEC, EST]) {
      const { ctx, page, erros } = await abrir(browser, ADM, vp, mob);
      await verComo(page, quem === TEC ? EST : TEC);
      const antes = (await estado(page)).escritas.length;
      await trocar(page, quem);
      const e = await estado(page);
      anota('2/3 @' + F + ': admin em "Ver como" → sair → ' + NOMES[quem] + ': simulação encerrada, nenhum controle de ADMIN', igual(e.admin, SEM_ADMIN), JSON.stringify(e.admin));
      anota('2/3 @' + F + ': ' + NOMES[quem] + ' vê só a própria página (nada da pessoa simulada)', igual(e.pagina, ref[quem].pagina) && e.texto === ref[quem].texto, JSON.stringify({ e: e.pagina, ref: ref[quem].pagina }));
      anota('2/3 @' + F + ': nenhuma gravação na troca, sem erro de JS', e.escritas.length === antes && !erros.length, JSON.stringify({ w: e.escritas.slice(antes), erros }));
      await ctx.close();
    }

    /* 6: trocas rápidas, sem esperar a página entre elas */
    {
      const { ctx, page, erros } = await abrir(browser, ADM, vp, mob);
      await verComo(page, TEC);
      await page.evaluate(async (c) => {
        const ent = (e) => firebase.auth().signInWithEmailAndPassword(e, 'x');
        window.faAuth.logout(); await ent(c.ger); window.faAuth.logout(); await ent(c.adm); window.faAuth.logout(); await ent(c.tec);
        location.hash = '#home'; location.hash = '#turmas';
      }, { ger: GER, adm: ADM, tec: TEC });
      await assentar(page, TEC);
      const e = await estado(page);
      anota('6 @' + F + ': trocas rápidas (admin → gerente → admin → técnica): nenhum estado de ADMIN sobra', igual(e.admin, SEM_ADMIN), JSON.stringify(e.admin));
      anota('6 @' + F + ': a página final é a da técnica abrindo do zero', igual(e.pagina, ref[TEC].pagina) && e.texto === ref[TEC].texto, JSON.stringify({ e: e.pagina, ref: ref[TEC].pagina }));
      anota('6 @' + F + ': sem gravação, sem erro de JS', !e.escritas.length && !erros.length, JSON.stringify({ w: e.escritas, erros }));
      await ctx.close();
    }

    /* 8: Minha Área */
    {
      const { ctx, page, erros } = await abrir(browser, ADM, vp, mob, null, 'minha-area');
      const v = await page.$eval('.minha-area-vercomo .aluno-vercomo-sel, #page-minha-area .aluno-vercomo-sel', (el, em) => { const o = Array.from(el.options).find((x) => x.dataset.email === em); return o ? o.value : ''; }, TEC).catch(() => '');
      let simulou = false;
      if (v) { await page.selectOption('#page-minha-area .aluno-vercomo-sel', v); await esperarCondicao(page, () => !!document.querySelector('#minhaAreaContent .aluno-vercomo-aviso'), null, { descricao: 'Minha Área como a técnica' }); simulou = true; }
      anota('8 @' + F + ': admin na Minha Área tem o recurso (e simula a técnica)', simulou, 'sem barra ou sem a técnica no seletor');
      await trocar(page, GER, 'minha-area');
      const e = await maEstado(page);
      const g = await abrir(browser, GER, vp, mob, null, 'minha-area'); const refMA = await maEstado(g.page); await g.ctx.close();
      anota('8 @' + F + ': admin em "Ver como" na Minha Área → sair → gerente: barra e aviso sumiram, a tela é a da gerente', e.barras === 0 && e.avisos === 0 && e.texto === refMA.texto, JSON.stringify({ e: { b: e.barras, a: e.avisos, t: e.texto.slice(0, 120) }, ref: refMA.texto.slice(0, 120) }));
      anota('8 @' + F + ': sem erro de JS', !erros.length, JSON.stringify(erros));
      await ctx.close();
    }
  }

  /* 7: autorização que falha ou demora (só desktop: não depende do formato) */
  console.log('\n== autorização lenta ou que falha ==');
  {
    const { ctx, page, erros } = await abrir(browser, ADM, { width: 1280, height: 900 }, false, { fail: ['fa-admins'] });
    await page.waitForTimeout(1500);
    const e = await estado(page);
    anota('7: leitura de fa-admins que falha: a admin da lista NÃO ganha o recurso', e.admin.barras === 0 && !e.admin.previa, JSON.stringify(e.admin));
    anota('7: falha: sem erro de JS', !erros.length, JSON.stringify(erros));
    await ctx.close();
  }
  {
    const { ctx, page, erros } = await abrir(browser, ADM, { width: 1280, height: 900 }, false, { delays: { 'fa-admins': 3000 }, semAssentar: true });
    let cedo = false;
    for (let i = 0; i < 8; i++) { await page.waitForTimeout(250); cedo = cedo || await page.evaluate(() => !!document.querySelector('.turmas-vercomo')); }
    await esperarCondicao(page, () => !!document.querySelector('.turmas-vercomo'), null, { limite: 15000, descricao: 'o recurso depois que fa-admins chega' });
    anota('7: leitura de fa-admins lenta: o recurso só aparece depois que a autorização chega', !cedo, 'apareceu antes');
    anota('7: lenta: sem erro de JS', !erros.length, JSON.stringify(erros));
    await ctx.close();
  }

  await browser.close();
  if (falhas) { console.error('\n' + falhas + ' falha(s).'); process.exit(1); }
  console.log('\nTudo certo.');
})().catch((e) => { console.error(e); process.exit(1); });
