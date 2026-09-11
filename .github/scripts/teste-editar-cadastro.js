/* Editar o cadastro de uma pessoa — a correção tem que chegar em TODO lugar.
 *
 * POR QUE ESTE TESTE EXISTE
 * O nome e a área da pessoa não moram só em fa-users: são COPIADOS para dentro
 * de cada inscrição, da fila de espera, das listas de público restrito, da
 * equipe de facilitação e de cada presença registrada. Corrigir só o cadastro
 * conserta uma tela e deixa o nome errado em todas as outras — e ninguém vê
 * erro nenhum: a admin corrige, olha a tabela da turma, vê o nome velho e
 * conclui que o site ignorou. É a mesma classe de falha silenciosa que a skill
 * criterio-de-estado existe para impedir (a janela de 27 dias do PR #113).
 *
 * O e-mail é caso à parte: é o login e é a chave que liga a pessoa a tudo. Só
 * pode ser corrigido em cadastro criado pelo painel, porque só desses o painel
 * conhece a senha. Este teste exige as duas metades da regra: que dê para
 * corrigir onde é permitido, e que NEM APAREÇA onde não é.
 *
 * Roda com o Firebase falso, que registra cada escrita em window.__ESCRITAS —
 * é assim que se prova onde a edição chegou, em vez de só constatar que a tela
 * não deu erro.
 */

const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');

const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

const ADM      = 'adm@previ.com.br';
const PROPRIA  = 'propria@previ.com.br';   /* cadastrou-se sozinha  → e-mail travado */
const DOADMIN  = 'doadmin@previ.com.br';   /* criada pelo painel    → e-mail editável */

function banco() {
  const users = {};
  users[chave(ADM)]     = { name: 'ADMIN', email: ADM, area: 'INFOR' };
  users[chave(PROPRIA)] = { name: 'NOME ERRADO', email: PROPRIA, area: 'GEBEN', createdAt: '2026-01-01T10:00:00.000Z' };
  users[chave(DOADMIN)] = { name: 'CRIADA PELO PAINEL', email: DOADMIN, area: 'GECAP',
                            createdByAdmin: ADM, adminApproved: true, createdAt: '2026-02-01T10:00:00.000Z' };
  const admins = {}; admins[chave(ADM)] = { email: ADM, name: 'ADMIN' };

  const interesse = { t1: {} };
  interesse.t1[chave(PROPRIA)] = { name: 'NOME ERRADO', email: PROPRIA, area: 'GEBEN',
                                   status: 'inscrito', confirmedByAdmin: ADM, date: '2026-03-01T10:00:00.000Z' };
  const checkin = { t1: { '2099-01-01': {} } };
  checkin.t1['2099-01-01'][chave(PROPRIA)] = { name: 'NOME ERRADO', email: PROPRIA, area: 'GEBEN' };
  const publico = { t1: {} };
  publico.t1[chave(PROPRIA)] = { name: 'NOME ERRADO', email: PROPRIA, area: 'GEBEN' };
  const espera = {};
  espera[chave(PROPRIA)] = { 'lista:ev1': { name: 'NOME ERRADO', email: PROPRIA, area: 'GEBEN', eventoKey: 'ev1' } };
  const equipe = { t1: {} };
  equipe.t1[chave(PROPRIA)] = { name: 'NOME ERRADO', email: PROPRIA, papel: 'facilitador' };

  return {
    'fa-users': users, 'fa-admins': admins, 'fa-diretores': {}, 'fa-facilitadores': {},
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': espera,
    eventos: { ev1: { nome: 'EVENTO', cargaHoraria: '8', publicado: true } },
    turmas: { t1: { label: 'TURMA 1', dias: ['2099-01-01'], eventoKey: 'ev1', publicoRestrito: true } },
    'turmas-interesse': interesse, 'turmas-interesse-log': {}, 'turmas-config': {},
    'turmas-checkin': checkin, 'turmas-publico': publico, 'eventos-publico': {},
    'turmas-equipe': equipe, 'turmas-sorteio': {}, avaliacoes: {}, pedidos: {}, holocron: {},
  };
}

async function abrirPainel(browser, formato) {
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
  /* A aba Cadastrados precisa estar aberta para a tabela existir. */
  await page.waitForSelector('.admin-tab-btn', { timeout: 15000 });
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('.admin-tab-btn'))
      .find((x) => /Cadastrados/i.test(x.textContent));
    if (b) b.click();
  });
  await page.waitForSelector('.admin-edit-cad-btn', { timeout: 15000 });
  return { ctx, page, erros };
}

/* Abre o modal de edição da pessoa cujo e-mail é `email`. */
async function abrirEdicao(page, email) {
  await page.evaluate((mail) => {
    const linha = Array.from(document.querySelectorAll('#adminCadastrados tbody tr'))
      .find((tr) => tr.textContent.indexOf(mail) !== -1);
    linha.querySelector('.admin-edit-cad-btn').click();
  }, email);
  await page.waitForSelector('#cadEditNome', { timeout: 10000 });
  /* Espera a contagem de cópias resolver: antes disso o Salvar fica travado. */
  await page.waitForFunction(() => {
    const b = document.querySelector('.modal-box .admin-modal-save-btn');
    return b && !b.disabled;
  }, { timeout: 10000 });
}

/* O modal de login mora no index.html desde o começo, então ele é o PRIMEIRO
   .modal-box da página. O modal aberto por último é o que interessa. */
function textoDoModalAberto(page) {
  return page.evaluate(() => {
    const bs = document.querySelectorAll('.modal-box');
    return bs.length ? bs[bs.length - 1].textContent : '';
  });
}

/* O painel semeia roteiro-tipos-atividade ao abrir, de forma assíncrona: essas
   escritas caem no meio do teste sem ter relação com a edição. A asserção
   olha só o que toca ESTA pessoa. */
function escritasDaPessoa(escritas, eKey) {
  return escritas.filter(function (e) {
    return e.path.indexOf(eKey) !== -1 || e.path.indexOf('fa-users') === 0;
  });
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

    /* 1. Corrigir o nome chega em TODAS as cópias, não só no cadastro. */
    {
      const { ctx, page, erros } = await abrirPainel(browser, formato);
      await abrirEdicao(page, PROPRIA);
      await page.fill('#cadEditNome', 'NOME CERTO');
      await page.evaluate(() => { window.__ESCRITAS = []; });
      await page.click('.modal-box .admin-modal-save-btn');
      await page.waitForTimeout(900);
      const escritas = await page.evaluate(() => window.__ESCRITAS || []);
      const kp = chave(PROPRIA);
      const esperados = [
        ['o cadastro',                'fa-users/' + kp + '/name'],
        ['a inscrição na turma',      'turmas-interesse/t1/' + kp + '/name'],
        ['a presença registrada',     'turmas-checkin/t1/2099-01-01/' + kp + '/name'],
        ['o público restrito',        'turmas-publico/t1/' + kp + '/name'],
        ['a lista de espera',         'fa-espera/' + kp + '/lista:ev1/name'],
        ['a equipe de facilitação',   'turmas-equipe/t1/' + kp + '/name'],
      ];
      const p = [];
      esperados.forEach(([oque, caminho]) => {
        const w = escritas.find((e) => e.path === caminho);
        if (!w) p.push('o nome NÃO foi atualizado em ' + oque + ' (' + caminho + ')');
        else if (String(w.valor).toUpperCase() !== 'NOME CERTO') {
          p.push(oque + ' recebeu "' + w.valor + '" em vez do nome novo');
        }
      });
      if (!escritas.some((e) => e.path.indexOf('fa-users-log/' + kp) === 0)) {
        p.push('a alteração não foi registrada no histórico (fa-users-log)');
      }
      if (erros.length) p.push('erro JS: ' + erros[0]);
      anota('corrigir o nome chega no cadastro e em todas as cópias', p);
      await ctx.close();
    }

    /* 2. Corrigir a área também propaga. */
    {
      const { ctx, page, erros } = await abrirPainel(browser, formato);
      await abrirEdicao(page, PROPRIA);
      await page.selectOption('#cadEditArea', 'GEPRO');
      await page.evaluate(() => { window.__ESCRITAS = []; });
      await page.click('.modal-box .admin-modal-save-btn');
      await page.waitForTimeout(900);
      const escritas = await page.evaluate(() => window.__ESCRITAS || []);
      const kp = chave(PROPRIA);
      const p = [];
      [['o cadastro', 'fa-users/' + kp + '/area'],
       ['a inscrição na turma', 'turmas-interesse/t1/' + kp + '/area'],
       ['a presença', 'turmas-checkin/t1/2099-01-01/' + kp + '/area']].forEach(([oque, caminho]) => {
        const w = escritas.find((e) => e.path === caminho);
        if (!w) p.push('a área NÃO foi atualizada em ' + oque);
        else if (w.valor !== 'GEPRO') p.push(oque + ' recebeu "' + w.valor + '" em vez de GEPRO');
      });
      if (erros.length) p.push('erro JS: ' + erros[0]);
      anota('corrigir a área chega no cadastro e nas cópias', p);
      await ctx.close();
    }

    /* 3. Cadastro feito pela própria pessoa: e-mail TRAVADO. */
    {
      const { ctx, page, erros } = await abrirPainel(browser, formato);
      await abrirEdicao(page, PROPRIA);
      const texto = await textoDoModalAberto(page);
      const est = {
        desabilitado: await page.evaluate(() => document.querySelector('#cadEditEmail').disabled),
        explica: /não pode ser alterado/i.test(texto),
      };
      const p = [];
      if (!est.desabilitado) p.push('o e-mail está editável num cadastro feito pela própria pessoa');
      if (!est.explica) p.push('não explica por que o e-mail está travado');
      if (erros.length) p.push('erro JS: ' + erros[0]);
      anota('cadastro da própria pessoa: e-mail travado e explicado', p);
      await ctx.close();
    }

    /* 4. Cadastro criado pelo painel: e-mail EDITÁVEL. */
    {
      const { ctx, page, erros } = await abrirPainel(browser, formato);
      await abrirEdicao(page, DOADMIN);
      const est = await page.evaluate(() => {
        const e = document.querySelector('#cadEditEmail');
        return { desabilitado: e.disabled, temSenha: !!document.querySelector('#cadEditAdminPwd') };
      });
      const p = [];
      if (est.desabilitado) p.push('o e-mail está travado num cadastro criado pelo painel');
      if (!est.temSenha) p.push('não pede a senha de admin, necessária para voltar à sessão');
      if (erros.length) p.push('erro JS: ' + erros[0]);
      anota('cadastro criado pelo painel: e-mail editável, com senha de admin', p);
      await ctx.close();
    }

    /* 5. Nome vazio é recusado EM VOZ ALTA (nunca em silêncio). */
    {
      const { ctx, page, erros } = await abrirPainel(browser, formato);
      await abrirEdicao(page, PROPRIA);
      await page.fill('#cadEditNome', '   ');
      await page.evaluate(() => { window.__ESCRITAS = []; });
      await page.click('.modal-box .admin-modal-save-btn');
      await page.waitForTimeout(400);
      const r = await page.evaluate(() => ({
        erro: (document.querySelector('#cadEditErr') || {}).textContent || '',
        visivel: document.querySelector('#cadEditErr') &&
                 getComputedStyle(document.querySelector('#cadEditErr')).display !== 'none',
        escritas: window.__ESCRITAS || [],
        modalAberto: !!document.querySelector('#cadEditNome'),
      }));
      const p = [];
      if (!r.visivel || !r.erro) p.push('SILÊNCIO: salvar com nome vazio não disse nada');
      const gravou = escritasDaPessoa(r.escritas, chave(PROPRIA));
      if (gravou.length) p.push('gravou ' + gravou.length + ' coisa(s) da pessoa mesmo com o nome vazio: ' + gravou[0].path);
      if (!r.modalAberto) p.push('fechou o modal em vez de deixar corrigir');
      if (erros.length) p.push('erro JS: ' + erros[0]);
      anota('nome vazio é recusado com mensagem, sem gravar nada', p);
      await ctx.close();
    }
  }

  await browser.close();

  if (falhas.length) {
    console.error('\n' + falhas.length + ' falha(s):');
    falhas.forEach((f) => console.error('  - ' + f));
    process.exit(1);
  }
  console.log('\nTudo certo: a correção do cadastro chega em todo lugar, nos dois formatos de tela.');
})();
