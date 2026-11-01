/* ADMIN › Outros públicos — o cadastro único de estagiários, menores aprendizes, COAUD e os três conselhos.
 *
 * POR QUE ESTE TESTE EXISTE
 * É a preparação da correção "técnico não é quem não é gerente": antes de qualquer público novo valer, a lista precisa
 * existir, estar preenchida e conferida. Esta etapa NÃO muda quem pode participar de nada — o risco que o teste vigia é o
 * cadastro gravar fora do próprio nó (mexer em turmas, inscrições, gerentes, diretores), perder uma categoria que a
 * pessoa já tinha, ou mostrar a lista a quem não deve (há menores de idade nela).
 *
 * Firebase falso, dados 100% sintéticos. O QUE ELE EXIGE, em 1280 e 375 px:
 *   1. super-admin vê a lista: categorias de cada pessoa, "Cadastro no site", "Também em" (Gerentes/Diretores) e o selo
 *      "Sobreposição" para quem tem mais de uma categoria ou também é gerente/diretor, com o aviso do total;
 *   2. busca por nome/e-mail e filtro por categoria (e "Com sobreposição");
 *   3. inclusão individual; inclusão em lote que cria quem não existe e ACRESCENTA categoria a quem já existe (sem perder
 *      as que tinha); e-mail fora de @previ e falta de categoria recusados sem gravar nada;
 *   4. edição das categorias (sem nenhuma marcada, recusa e manda usar "Remover"); remoção com confirmação;
 *   5. gravação recusada pelo banco: mensagem "nada foi gravado" e nada aparece; leitura que falha: mensagem de erro;
 *   6. admin comum (fa-admins): só o aviso de que a lista é dos super-admins — nenhuma tabela;
 *   7. toda gravação é em fa-outros-publicos; turmas, inscrições, eventos, gerentes e diretores continuam iguais; as abas
 *      Gerentes e Diretores continuam listando como antes;
 *   8. sem rolagem lateral, sem erro de JS.
 * Com `--capturar <pasta>` grava também as capturas de tela.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarCondicao } = require('./esperas');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const iCap = process.argv.indexOf('--capturar');
const CAPTURA = iCap > 0 ? process.argv[iCap + 1] : '';

const SUPER = 'tatianefdirene@previ.com.br', ADM = 'admin.comum.op@previ.com.br';
const P = {
  est: 'estagiaria.op@previ.com.br', multi: 'multi.op@previ.com.br', gerCons: 'gerente.conselho.op@previ.com.br',
  semCad: 'aprendiz.semcadastro.op@previ.com.br', ger: 'so.gerente.op@previ.com.br', dir: 'so.diretor.op@previ.com.br',
  novo1: 'novo.um.op@previ.com.br', novo2: 'novo.dois.op@previ.com.br', novo3: 'novo.tres.op@previ.com.br',
};
const nome = (e) => e.split('@')[0].toUpperCase().replace(/\./g, ' ');
const reg = (e, cats) => ({ email: e, name: nome(e), categorias: cats, addedAt: '2026-10-20T10:00:00.000Z', addedBy: SUPER });

function banco() {
  const users = {};
  [P.est, P.multi, P.gerCons, P.ger, P.dir, P.novo1, SUPER, ADM].forEach((e) => { users[chave(e)] = { name: nome(e), email: e, area: 'TI', emailConfirmado: true }; });
  return {
    'fa-users': users, 'fa-admins': { [chave(ADM)]: { email: ADM, name: 'ADMIN COMUM' } },
    'fa-gerentes': { [chave(P.ger)]: { email: P.ger, name: nome(P.ger) }, [chave(P.gerCons)]: { email: P.gerCons, name: nome(P.gerCons) } },
    'fa-diretores': { [chave(P.dir)]: { email: P.dir, name: nome(P.dir) } },
    'fa-outros-publicos': {
      [chave(P.est)]: reg(P.est, { estagiario: true }),
      [chave(P.multi)]: reg(P.multi, { coaud: true, conselhoFiscal: true }),
      [chave(P.gerCons)]: reg(P.gerCons, { conselhoDeliberativo: true }),
      [chave(P.semCad)]: reg(P.semCad, { menorAprendiz: true }),
    },
    'fa-facilitadores': {}, 'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: { evT: { nome: 'EVENTO SINTETICO OP', order: 1, publicado: true, publicoDesc: 'Técnicos', esperaAtiva: false } },
    turmas: { tT: { label: 'TURMA SINTETICA OP', eventoKey: 'evT', order: 1, dias: ['2027-03-10'], horarioInicio: '09:00', horarioFim: '12:00' } },
    'turmas-config': {}, 'turmas-interesse': { tT: { [chave(P.est)]: { name: nome(P.est), email: P.est, area: 'TI', status: 'interessado', removed: false, date: '2026-10-21T10:00:00.000Z' } } },
    'turmas-interesse-log': {}, 'turmas-checkin': {}, 'turmas-sorteio': {}, 'turmas-equipe': {}, 'turmas-publico': {}, 'eventos-publico': {},
    avaliacoes: {}, pedidos: {}, holocron: {},
  };
}
const INTOCADOS = ['eventos', 'turmas', 'turmas-config', 'turmas-interesse', 'turmas-publico', 'eventos-publico', 'fa-espera', 'fa-gerentes', 'fa-diretores', 'fa-users'];

async function abrir(browser, email, viewport, mobile, extra) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: !!mobile, hasTouch: !!mobile });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify(Object.assign({ db: banco(), user: { email, emailVerified: true, uid: 'u-' + chave(email) }, delayDefault: 20 }, extra || {})) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
  await esperarCondicao(page, () => Array.from(document.querySelectorAll('.admin-tab-btn')).some((x) => /Outros públicos/.test(x.textContent)), null, { limite: 15000, descricao: 'aba Outros públicos do ADMIN' });
  await page.evaluate(() => Array.from(document.querySelectorAll('.admin-tab-btn')).find((x) => /Outros públicos/.test(x.textContent)).click());
  return { ctx, page, erros };
}

const ler = (page) => page.evaluate(() => {
  const c = document.getElementById('adminOutrosPublicos');
  const linhas = Array.from(c.querySelectorAll('tr[data-outros-key]')).map((tr) => ({
    key: tr.getAttribute('data-outros-key'), cats: (tr.querySelector('[data-categorias]') || {}).getAttribute ? tr.querySelector('[data-categorias]').getAttribute('data-categorias') : '',
    sobreposta: tr.hasAttribute('data-sobreposicao'), texto: tr.textContent.replace(/\s+/g, ' ').trim() }));
  const av = c.querySelector('[data-sobreposicao-outros]');
  return { linhas, aviso: av ? av.getAttribute('data-sobreposicao-outros') : null, msg: ((document.getElementById('outrosMsg') || {}).textContent || '').trim(),
    soSuper: !!c.querySelector('[data-outros-so-super]'), erro: !!c.querySelector('[data-outros-erro]'), tabela: !!c.querySelector('table'),
    largura: document.documentElement.scrollWidth > document.documentElement.clientWidth };
});
const lerNo = (page, no) => page.evaluate((n) => firebase.database().ref(n).once('value').then((s) => s.val()), no);
const escritas = (page) => page.evaluate(() => (window.__ESCRITAS || []).map((e) => e.path)
  .filter((p) => !/^roteiro-tipos-atividade$|^treinamentos\/[^/]+$/.test(p)));
const esperarLinhas = (page, n, d) => esperarCondicao(page, (m) => document.querySelectorAll('#adminOutrosPublicos tr[data-outros-key]').length === m, n, { limite: 15000, descricao: d });
async function incluir(page, emails, cats) {
  await page.fill('#outrosEmails', emails);
  await page.evaluate((cs) => document.querySelectorAll('[data-novo-cat]').forEach((cb) => { cb.checked = cs.indexOf(cb.getAttribute('data-novo-cat')) !== -1; }), cats);
  await page.click('#outrosAddBtn');
}

(async () => {
  const browser = await chromium.launch();
  let falhas = 0, oks = 0;
  const anota = (r, ok, d) => { if (ok) { oks++; console.log('  ok    ' + r); } else { falhas++; console.error('  FALHA ' + r + (d ? ' — ' + d : '')); } };
  const FORMATOS = [{ nome: '1280', vp: { width: 1280, height: 800 } }, { nome: '375', vp: { width: 375, height: 812 }, mob: true }];
  const antes = banco();

  for (const f of FORMATOS) {
    console.log('\n== ' + f.nome + ' px — super-admin ==');
    const { ctx, page, erros } = await abrir(browser, SUPER, f.vp, f.mob);
    try {
      await esperarLinhas(page, 4, 'as 4 pessoas da lista');
      let e = await ler(page);
      const L = (k) => e.linhas.find((x) => x.key === chave(k)) || {};
      anota(f.nome + ': 1. categorias de cada pessoa', L(P.est).cats === 'estagiario' && L(P.multi).cats === 'coaud conselhoFiscal' && L(P.semCad).cats === 'menorAprendiz', JSON.stringify(e.linhas.map((x) => x.cats)));
      anota(f.nome + ': 1. "Sobreposição" para duas categorias e para quem também é gerente; aviso com o total (2)',
        L(P.multi).sobreposta && L(P.gerCons).sobreposta && !L(P.est).sobreposta && !L(P.semCad).sobreposta && e.aviso === '2', JSON.stringify({ a: e.aviso }));
      anota(f.nome + ': 1. "Também em: Gerentes" e "Ainda sem cadastro"', /Gerentes/.test(L(P.gerCons).texto) && /Ainda sem cadastro/.test(L(P.semCad).texto) && /Sim/.test(L(P.est).texto));
      if (CAPTURA) { fs.mkdirSync(CAPTURA, { recursive: true }); await page.locator('#adminOutrosPublicos').screenshot({ path: path.join(CAPTURA, 'outros-publicos-' + f.nome + '.png') }); }

      await page.fill('#outrosBusca', 'multi');
      await esperarLinhas(page, 1, 'a busca filtrar');
      anota(f.nome + ': 2. busca por nome/e-mail', (await ler(page)).linhas[0].key === chave(P.multi));
      await page.fill('#outrosBusca', '');
      await page.selectOption('#outrosFiltro', 'menorAprendiz');
      await esperarLinhas(page, 1, 'o filtro por categoria');
      anota(f.nome + ': 2. filtro por categoria', (await ler(page)).linhas[0].key === chave(P.semCad));
      await page.selectOption('#outrosFiltro', '__sobreposicao');
      await esperarLinhas(page, 2, 'o filtro de sobreposição');
      anota(f.nome + ': 2. filtro "Com sobreposição"', true);
      await page.selectOption('#outrosFiltro', '');

      /* 3. inclusão */
      await incluir(page, 'fulano@gmail.com', ['estagiario']);
      e = await ler(page);
      anota(f.nome + ': 3. e-mail fora de @previ recusado sem gravar', /Só e-mails @previ\.com\.br/.test(e.msg) && !(await escritas(page)).length, e.msg);
      await incluir(page, P.novo1, []);
      anota(f.nome + ': 3. sem categoria recusado sem gravar', /ao menos uma categoria/.test((await ler(page)).msg) && !(await escritas(page)).length);
      await incluir(page, P.novo1, ['estagiario']);
      await esperarLinhas(page, 5, 'a inclusão individual');
      const n1 = await lerNo(page, 'fa-outros-publicos/' + chave(P.novo1));
      anota(f.nome + ': 3. inclusão individual (registro completo, nome do cadastro do site)', n1 && n1.email === P.novo1 && n1.categorias.estagiario === true && n1.addedBy === SUPER && n1.name === nome(P.novo1), JSON.stringify(n1));
      await incluir(page, P.novo2 + '\n' + P.est, ['coaud']);
      await esperarLinhas(page, 6, 'a inclusão em lote');
      const n2 = await lerNo(page, 'fa-outros-publicos/' + chave(P.novo2)), est = await lerNo(page, 'fa-outros-publicos/' + chave(P.est));
      anota(f.nome + ': 3. lote: cria quem não existe e acrescenta a categoria a quem existe, sem perder a que tinha',
        n2 && n2.categorias.coaud === true && est.categorias.estagiario === true && est.categorias.coaud === true && est.addedAt === antes['fa-outros-publicos'][chave(P.est)].addedAt && est.updatedBy === SUPER,
        JSON.stringify({ n2, est }));
      e = await ler(page);
      anota(f.nome + ': 3. quem ganhou a segunda categoria passa a ter o selo "Sobreposição"', (e.linhas.find((x) => x.key === chave(P.est)) || {}).sobreposta === true);

      /* 4. edição e remoção */
      await page.click('[data-outros-editar="' + chave(P.est) + '"]');
      await page.evaluate(() => document.querySelectorAll('[data-ed-cat]').forEach((cb) => { cb.checked = false; }));
      await page.click('[data-outros-salvar]');
      anota(f.nome + ': 4. edição sem nenhuma categoria recusada (manda usar Remover)', /Remover/.test(await page.textContent('[data-outros-edicao-msg]')));
      await page.evaluate(() => { document.querySelector('[data-ed-cat="conselhoConsultivo"]').checked = true; });
      await page.click('[data-outros-salvar]');
      await esperarCondicao(page, () => !document.querySelector('[data-outros-edicao]'), null, { descricao: 'a edição fechar' });
      const est2 = await lerNo(page, 'fa-outros-publicos/' + chave(P.est));
      anota(f.nome + ': 4. edição grava exatamente as categorias marcadas', JSON.stringify(est2.categorias) === JSON.stringify({ conselhoConsultivo: true }), JSON.stringify(est2.categorias));
      await esperarLinhas(page, 6, 'a lista redesenhada');
      await page.click('[data-outros-remover="' + chave(P.novo1) + '"]');
      await esperarCondicao(page, () => !!document.querySelector('.admin-modal-confirm-btn'), null, { descricao: 'a confirmação' });
      anota(f.nome + ': 4. a confirmação diz que ninguém sai de turma', /Não tira a pessoa de nenhuma turma/.test(await page.evaluate(() => document.querySelector('.admin-modal-confirm-btn').closest('.modal-box').textContent)));
      await page.click('.admin-modal-confirm-btn');
      await esperarLinhas(page, 5, 'a remoção');
      anota(f.nome + ': 4. remoção com confirmação', (await lerNo(page, 'fa-outros-publicos/' + chave(P.novo1))) === null);

      /* 5. gravação recusada pelo banco */
      const nAntes = (await escritas(page)).length;
      await page.evaluate(() => { window.__CFG.fail = ['fa-outros-publicos']; });
      await incluir(page, P.novo3, ['conselhoFiscal']);
      await esperarCondicao(page, () => /Nada foi gravado/.test((document.getElementById('outrosMsg') || {}).textContent || ''), null, { descricao: 'a mensagem de erro de gravação' });
      await page.evaluate(() => { window.__CFG.fail = []; });
      anota(f.nome + ': 5. gravação recusada: "nada foi gravado", e a pessoa não entra', (await lerNo(page, 'fa-outros-publicos/' + chave(P.novo3))) === null && (await escritas(page)).length > nAntes);

      /* 7. nada fora do próprio nó */
      const fora = (await escritas(page)).filter((p) => !/^fa-outros-publicos(\/|$)/.test(p));
      anota(f.nome + ': 7. toda gravação é em fa-outros-publicos', !fora.length, JSON.stringify(fora));
      const mudou = [];
      for (const no of INTOCADOS) { if (JSON.stringify(await lerNo(page, no)) !== JSON.stringify(antes[no])) mudou.push(no); }
      anota(f.nome + ': 7. turmas, inscrições, eventos, fila, gerentes, diretores e cadastros iguais', !mudou.length, JSON.stringify(mudou));
      await page.evaluate(() => Array.from(document.querySelectorAll('.admin-tab-btn')).find((x) => x.textContent.trim() === 'Gerentes').click());
      await esperarCondicao(page, () => /SO GERENTE OP/.test((document.getElementById('adminGerentes') || {}).textContent || ''), null, { descricao: 'a aba Gerentes' });
      await page.evaluate(() => Array.from(document.querySelectorAll('.admin-tab-btn')).find((x) => x.textContent.trim() === 'Diretores').click());
      await esperarCondicao(page, () => /SO DIRETOR OP/.test((document.getElementById('adminDiretores') || {}).textContent || ''), null, { descricao: 'a aba Diretores' });
      anota(f.nome + ': 7. as abas Gerentes e Diretores continuam listando', true);
      await page.evaluate(() => Array.from(document.querySelectorAll('.admin-tab-btn')).find((x) => /Outros públicos/.test(x.textContent)).click());
      e = await ler(page);
      anota(f.nome + ': 8. sem rolagem lateral, sem erro de JS', !e.largura && !erros.length, JSON.stringify({ l: e.largura, erros }));
    } finally { await ctx.close(); }

    console.log('\n== ' + f.nome + ' px — leitura que falha e admin comum ==');
    {
      const { ctx: c2, page: p2, erros: e2 } = await abrir(browser, SUPER, f.vp, f.mob, { fail: ['fa-outros-publicos'] });
      try {
        await esperarCondicao(p2, () => !!document.querySelector('[data-outros-erro]'), null, { limite: 15000, descricao: 'o erro de leitura' });
        const r = await ler(p2);
        anota(f.nome + ': 5. leitura que falha: mensagem de erro, sem tabela e sem gravar', r.erro && !r.tabela && !(await escritas(p2)).length && !e2.length);
      } finally { await c2.close(); }
    }
    {
      const { ctx: c3, page: p3, erros: e3 } = await abrir(browser, ADM, f.vp, f.mob);
      try {
        await esperarCondicao(p3, () => !!document.querySelector('[data-outros-so-super]'), null, { limite: 15000, descricao: 'o aviso para admin comum' });
        const r = await ler(p3);
        anota(f.nome + ': 6. admin comum: só o aviso — sem tabela, sem nomes, sem formulário', r.soSuper && !r.tabela && !(await p3.evaluate(() => /ESTAGIARIA OP|APRENDIZ/.test(document.getElementById('adminOutrosPublicos').textContent))) && !(await p3.$('#outrosAddBtn')) && !e3.length);
      } finally { await c3.close(); }
    }
  }
  await browser.close();
  console.log('\n' + oks + ' ok, ' + falhas + ' falha(s).');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
