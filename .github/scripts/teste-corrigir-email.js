/* Corrigir o e-mail de um cadastro criado pelo painel — de ponta a ponta.
 *
 * POR QUE ESTE TESTE EXISTE
 * Esta é a operação mais delicada do painel: ela ENTRA na conta de outra
 * pessoa, troca o login dela no Firebase Auth e move todos os dados dela de
 * uma chave para outra. São duas etapas que não são atômicas entre si — o
 * login vive no Auth, os dados no banco.
 *
 * Quando nasceu (PR #128), nada disso tinha como ser exercitado: o Firebase
 * falso não sabia checar senha nem trocar e-mail, então o caminho inteiro foi
 * validado só por leitura de código. Um caminho que ninguém roda é um caminho
 * que ninguém sabe se funciona. O falso aprendeu as duas coisas (CFG.senhas e
 * user.updateEmail) e agora isto aqui roda de verdade.
 *
 * O QUE ELE EXIGE:
 *   1. o login muda e TODOS os dados da pessoa vão junto para a chave nova —
 *      inclusive pedidos e conteúdos do Repositório, que não são indexados
 *      pela chave e seriam perdidos em silêncio;
 *   2. a admin termina logada como ELA MESMA — o painel entra na conta alheia
 *      no meio do processo, e terminar logada como outra pessoa seria pior
 *      que não ter feito nada;
 *   3. quando a pessoa já trocou a senha padrão, a operação é RECUSADA, sem
 *      gravar nada e sem deixar a sessão da admin quebrada — a conta é dela
 *      agora, não do painel.
 */

const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');

const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

const ADM       = 'adm@previ.com.br';
const SENHA_ADM = 'senhaDaAdmin';
const ERRADO    = 'erradoo@previ.com.br';    /* criada pelo painel, e-mail com typo */
const CERTO     = 'corrigido@previ.com.br';  /* para onde deve ir */

/* A pessoa tem dado em TODO lugar: é o que torna o teste capaz de pegar uma
   mudança de chave pela metade. */
function banco() {
  const kE = chave(ERRADO);
  const users = {};
  users[chave(ADM)] = { name: 'ADMIN', email: ADM, area: 'INFOR' };
  users[kE] = { name: 'PESSOA COM TYPO', email: ERRADO, area: 'GECAP',
                createdByAdmin: ADM, adminApproved: true, createdAt: '2026-02-01T10:00:00.000Z' };
  const admins = {}; admins[chave(ADM)] = { email: ADM, name: 'ADMIN' };

  const interesse = { t1: {} };
  interesse.t1[kE] = { name: 'PESSOA COM TYPO', email: ERRADO, area: 'GECAP',
                       status: 'inscrito', confirmedByAdmin: ADM, date: '2026-03-01T10:00:00.000Z' };
  const checkin = { t1: { '2099-01-01': {} } };
  checkin.t1['2099-01-01'][kE] = { name: 'PESSOA COM TYPO', email: ERRADO, area: 'GECAP' };
  const publico = { t1: {} }; publico.t1[kE] = { name: 'PESSOA COM TYPO', email: ERRADO, area: 'GECAP' };
  const pubEv  = { ev1: {} }; pubEv.ev1[kE]  = { name: 'PESSOA COM TYPO', email: ERRADO, area: 'GECAP' };
  const equipe = { t1: {} };  equipe.t1[kE]  = { name: 'PESSOA COM TYPO', email: ERRADO, papel: 'facilitador' };
  const espera = {}; espera[kE] = { 'lista:ev1': { name: 'PESSOA COM TYPO', email: ERRADO, eventoKey: 'ev1' } };
  const progress = {}; progress[kE] = { autodiagnostico: { q1: 3 } };
  const avaliacoes = { t1: {} }; avaliacoes.t1[kE] = { nota: 5 };

  return {
    'fa-users': users, 'fa-admins': admins, 'fa-diretores': {}, 'fa-facilitadores': {},
    'fa-users-log': {}, 'fa-progress': progress, 'fa-reset-signal': {}, 'fa-espera': espera,
    eventos: { ev1: { nome: 'EVENTO', cargaHoraria: '8', publicado: true, publicoRestrito: true } },
    turmas: { t1: { label: 'TURMA 1', dias: ['2099-01-01'], eventoKey: 'ev1', publicoRestrito: true } },
    'turmas-interesse': interesse, 'turmas-interesse-log': {}, 'turmas-config': {},
    'turmas-checkin': checkin, 'turmas-publico': publico, 'eventos-publico': pubEv,
    'turmas-equipe': equipe, 'turmas-sorteio': {}, avaliacoes: avaliacoes,
    pedidos: { p1: { tipo: 'tema', emailEnviou: ERRADO, nomeEnviou: 'PESSOA COM TYPO' } },
    holocron: { h1: { titulo: 'Um conteúdo', authorEmail: ERRADO } },
  };
}

async function abrirPainel(browser, formato, senhas) {
  const ctx = await browser.newContext(formato.opts);
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify({
    db: banco(), user: { email: ADM, emailVerified: true, uid: 'u1' },
    delayDefault: 20, senhas: senhas,
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
  await page.waitForSelector('.admin-edit-cad-btn', { timeout: 15000 });
  return { ctx, page, erros };
}

/* Abre a edição, troca o e-mail, confirma o modal de confirmação e espera
   a operação terminar (de sucesso ou de recusa). */
async function corrigirEmail(page, deEmail, paraEmail, senhaAdmin) {
  await page.evaluate((mail) => {
    const linha = Array.from(document.querySelectorAll('#adminCadastrados tbody tr'))
      .find((tr) => tr.textContent.indexOf(mail) !== -1);
    linha.querySelector('.admin-edit-cad-btn').click();
  }, deEmail);
  await page.waitForSelector('#cadEditNome', { timeout: 10000 });
  await page.waitForFunction(() => {
    const b = document.querySelector('.modal-box .admin-modal-save-btn');
    return b && !b.disabled;
  }, { timeout: 10000 });

  await page.fill('#cadEditEmail', paraEmail);
  await page.fill('#cadEditAdminPwd', senhaAdmin);
  await page.evaluate(() => { window.__ESCRITAS = []; });
  await page.evaluate(() => {
    document.querySelector('.modal-box .admin-modal-save-btn').click();
  });

  /* O modal de confirmação aparece por cima; confirmar é o que dispara tudo. */
  await page.waitForSelector('.admin-modal-confirm-btn', { timeout: 10000 });
  await page.click('.admin-modal-confirm-btn');

  /* Termina quando o aviso de sucesso aparece OU quando o erro é mostrado. */
  await page.waitForFunction(() => {
    const err = document.querySelector('#cadEditErr');
    const erroVisivel = err && getComputedStyle(err).display !== 'none' && err.textContent.trim();
    const alerta = Array.from(document.querySelectorAll('.modal-box'))
      .some((b) => /E-mail corrigido para/.test(b.textContent));
    return !!(erroVisivel || alerta);
  }, { timeout: 20000 });
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
    const kAntigo = chave(ERRADO);
    const kNovo   = chave(CERTO);

    /* 1. Caminho completo: senha ainda é a padrão, a correção acontece. */
    {
      const senhas = {}; senhas[ERRADO] = '12345678'; senhas[ADM] = SENHA_ADM;
      const { ctx, page, erros } = await abrirPainel(browser, formato, senhas);
      await corrigirEmail(page, ERRADO, CERTO, SENHA_ADM);
      const r = await page.evaluate(() => ({
        escritas: window.__ESCRITAS || [],
        logadaComo: (firebase.auth().currentUser || {}).email || null,
        erro: (document.querySelector('#cadEditErr') || {}).textContent || '',
      }));
      const gravou = (caminho) => r.escritas.some((e) => e.path === caminho);
      const apagou = (caminho) => r.escritas.some((e) => e.path === caminho && e.valor === null);

      const p = [];
      if (r.erro.trim()) p.push('deu erro: ' + r.erro.trim().split('\n')[0]);

      /* (2) a admin tem que terminar logada como ela mesma */
      if (r.logadaComo !== ADM) {
        p.push('a sessão NÃO voltou para a admin (ficou como ' + r.logadaComo + ')');
      }

      /* (1) tudo muda de endereço */
      const mover = [
        ['o cadastro',                 'fa-users/' + kNovo,                         'fa-users/' + kAntigo],
        ['a inscrição na turma',       'turmas-interesse/t1/' + kNovo,              'turmas-interesse/t1/' + kAntigo],
        ['a presença registrada',      'turmas-checkin/t1/2099-01-01/' + kNovo,     'turmas-checkin/t1/2099-01-01/' + kAntigo],
        ['o público restrito da turma','turmas-publico/t1/' + kNovo,                'turmas-publico/t1/' + kAntigo],
        ['o público restrito do evento','eventos-publico/ev1/' + kNovo,             'eventos-publico/ev1/' + kAntigo],
        ['a equipe de facilitação',    'turmas-equipe/t1/' + kNovo,                 'turmas-equipe/t1/' + kAntigo],
        ['a fila de espera',           'fa-espera/' + kNovo,                        'fa-espera/' + kAntigo],
        ['o progresso do jogo',        'fa-progress/' + kNovo,                      'fa-progress/' + kAntigo],
        ['a avaliação respondida',     'avaliacoes/t1/' + kNovo,                    'avaliacoes/t1/' + kAntigo],
      ];
      mover.forEach(([oque, destino, origem]) => {
        if (!gravou(destino)) p.push(oque + ' NÃO foi para a chave nova (' + destino + ')');
        if (!apagou(origem))  p.push(oque + ' ficou para trás na chave antiga (' + origem + ')');
      });

      /* pedidos e holocron não são indexados pela chave — some em silêncio */
      const ped = r.escritas.find((e) => e.path === 'pedidos/p1/emailEnviou');
      if (!ped || ped.valor !== CERTO) p.push('o pedido dela não seguiu o e-mail novo — ela perderia os próprios pedidos');
      const hol = r.escritas.find((e) => e.path === 'holocron/h1/authorEmail');
      if (!hol || hol.valor !== CERTO) p.push('o conteúdo dela no Repositório não seguiu o e-mail novo');

      if (!r.escritas.some((e) => e.path.indexOf('fa-users-log/' + kNovo) === 0)) {
        p.push('a correção não foi registrada no histórico, na chave nova');
      }
      if (erros.length) p.push('erro JS: ' + erros[0]);
      anota('corrigir o e-mail leva TUDO junto e devolve a sessão da admin', p);
      await ctx.close();
    }

    /* 2. A pessoa já trocou a senha: recusa, sem gravar e sem quebrar a sessão. */
    {
      const senhas = {}; senhas[ERRADO] = 'senhaQueElaEscolheu'; senhas[ADM] = SENHA_ADM;
      const { ctx, page, erros } = await abrirPainel(browser, formato, senhas);
      await corrigirEmail(page, ERRADO, CERTO, SENHA_ADM);
      const r = await page.evaluate(() => ({
        escritas: window.__ESCRITAS || [],
        logadaComo: (firebase.auth().currentUser || {}).email || null,
        erro: (document.querySelector('#cadEditErr') || {}).textContent || '',
      }));
      const p = [];
      if (!/senha/i.test(r.erro)) {
        p.push('não explicou que a recusa é por a senha não ser mais a padrão (disse: "' +
          r.erro.trim().split('\n')[0] + '")');
      }
      const tocouNaPessoa = r.escritas.filter((e) =>
        e.path.indexOf(kAntigo) !== -1 || e.path.indexOf(kNovo) !== -1);
      if (tocouNaPessoa.length) {
        p.push('GRAVOU mesmo tendo recusado: ' + tocouNaPessoa[0].path);
      }
      if (r.logadaComo !== ADM) {
        p.push('a sessão da admin ficou quebrada depois da recusa (está como ' + r.logadaComo + ')');
      }
      if (erros.length) p.push('erro JS: ' + erros[0]);
      anota('senha já trocada: recusa explicada, nada gravado, sessão intacta', p);
      await ctx.close();
    }
  }

  await browser.close();

  if (falhas.length) {
    console.error('\n' + falhas.length + ' falha(s):');
    falhas.forEach((f) => console.error('  - ' + f));
    process.exit(1);
  }
  console.log('\nTudo certo: a correção de e-mail leva os dados junto e devolve a sessão da admin.');
})();
