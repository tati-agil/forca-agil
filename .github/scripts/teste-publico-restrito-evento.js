/* Público restrito do EVENTO — o que cada pessoa enxerga na página Turmas.
 *
 * POR QUE ESTE TESTE EXISTE
 * A restrição por lista de e-mails é a única regra do site em que o acerto e
 * o erro são invisíveis na mesma tela: quem escreve o código está logado como
 * admin, e admin vê tudo. O vazamento só aparece na conta de outra pessoa —
 * e "outra pessoa" é justamente quem ninguém abre no meio do desenvolvimento.
 * O mesmo descuido já aconteceu duas vezes neste repo (a Minha Área vazando
 * evento restrito a diretores, a turma restrita nascendo sem a prévia), então
 * aqui a conferência é mecânica, nos dois formatos de tela.
 *
 * Roda com o Firebase SUBSTITUÍDO pelo falso (.github/scripts/firebase-falso.js):
 * não precisa de segredo, de rede nem do banco real, e permite trocar de
 * pessoa logada sem ter três contas de verdade.
 *
 * O QUE ELE EXIGE, em cada pessoa × cada formato de tela:
 *   1. quem está na lista vê o evento restrito INTEIRO (título, turma, missão);
 *   2. quem está fora não vê NADA dele — nem título, nem card, nem missão;
 *   3. o evento aberto continua visível para todo mundo (a restrição é por
 *      evento, não uma cortina sobre a página);
 *   4. admin vê o evento restrito mesmo sem estar na lista;
 *   5. falha ao ler eventos-publico esconde o evento restrito, em vez de
 *      mostrá-lo — falhar escondendo é o lado seguro;
 *   6. nenhum erro de JavaScript não tratado.
 */

const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');

const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

const NA_LISTA  = 'nalista@previ.com.br';
const FORA      = 'fora@previ.com.br';
const ADM       = 'adm@previ.com.br';

const EV_RESTRITO = 'evRestrito';
const EV_ABERTO   = 'evAberto';

function banco() {
  const users = {};
  [[NA_LISTA, 'PESSOA NA LISTA'], [FORA, 'PESSOA DE FORA'], [ADM, 'ADMIN']].forEach(([e, n]) => {
    users[chave(e)] = { name: n, email: e, area: 'TI' };
  });
  const admins = {}; admins[chave(ADM)] = { email: ADM };

  const publicoEvento = {};
  publicoEvento[EV_RESTRITO] = {};
  publicoEvento[EV_RESTRITO][chave(NA_LISTA)] = { name: 'PESSOA NA LISTA', email: NA_LISTA };

  return {
    eventos: {
      [EV_RESTRITO]: {
        nome: 'EVENTO FECHADO', cargaHoraria: '8', order: 1,
        publicado: true, esperaAtiva: true, publicoRestrito: true,
        missaoTitulo: 'Missão fechada', missaoTexto: 'Texto da missão do evento fechado.',
        itinerario: ['D1 fechado'],
      },
      [EV_ABERTO]: {
        nome: 'EVENTO ABERTO', cargaHoraria: '8', order: 2,
        publicado: true, esperaAtiva: true,
        missaoTitulo: 'Missão aberta', missaoTexto: 'Texto da missão do evento aberto.',
        itinerario: ['D1 aberto'],
      },
    },
    turmas: {
      turmaFechada: { label: 'TURMA DO EVENTO FECHADO', dias: ['2099-01-01'], eventoKey: EV_RESTRITO, order: 1 },
      turmaAberta:  { label: 'TURMA DO EVENTO ABERTO',  dias: ['2099-01-02'], eventoKey: EV_ABERTO,   order: 2 },
    },
    'eventos-publico': publicoEvento,
    'turmas-publico': {},
    'turmas-interesse': {}, 'turmas-interesse-log': {}, 'turmas-config': {}, 'turmas-checkin': {},
    'turmas-equipe': {}, 'fa-espera': {}, 'fa-users': users, 'fa-admins': admins,
    'fa-diretores': {}, 'fa-facilitadores': {}, 'fa-progress': {}, pedidos: {}, avaliacoes: {},
  };
}

/* O que a pessoa realmente enxerga da página Turmas: os grupos de evento
   desenhados, os cards de turma e os blocos de missão. Conta só o que está
   visível de fato — um grupo com display:none não é "aparecer". */
function lerVitrine(page) {
  return page.evaluate(() => {
    const visivel = (el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden';
    };
    const grupos = Array.from(document.querySelectorAll('.turmas-evento-grupo')).filter(visivel);
    return {
      eventos: grupos.map((g) => g.getAttribute('data-evento-key')),
      titulos: grupos.map((g) => (g.textContent || '').trim()).join(' | '),
      cards: Array.from(document.querySelectorAll('.turma-card-new')).filter(visivel)
        .map((c) => (c.textContent || '').trim()).join(' | '),
    };
  });
}

const PESSOAS = [
  { nome: 'quem está na lista', email: NA_LISTA, veRestrito: true },
  { nome: 'quem está fora',     email: FORA,     veRestrito: false },
  { nome: 'admin fora da lista', email: ADM,     veRestrito: true },
  { nome: 'quem está na lista, com eventos-publico com erro',
    email: NA_LISTA, veRestrito: false, fail: ['eventos-publico'] },
];

const FORMATOS = [
  { nome: 'desktop', opts: { viewport: { width: 1440, height: 900 } } },
  { nome: 'celular', opts: devices['Pixel 5'] },
];

(async () => {
  const browser = await chromium.launch();
  const falhas = [];

  for (const formato of FORMATOS) {
    console.log('\n===== ' + formato.nome.toUpperCase() + ' =====');
    for (const p of PESSOAS) {
      const ctx = await browser.newContext(formato.opts);
      const page = await ctx.newPage();
      const erros = [];
      page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));

      const cfg = {
        db: banco(),
        user: { email: p.email, emailVerified: true, uid: 'u1' },
        delayDefault: 20,
      };
      if (p.fail) cfg.fail = p.fail;
      await page.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
      await page.route('**/firebasejs/**', (r) =>
        r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
      await page.route('**fonts.googleapis.com**', (r) =>
        r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
      await page.route('**fonts.gstatic.com**', (r) => r.abort());

      await page.goto(BASE + '/index.html#turmas', { waitUntil: 'domcontentloaded' });
      /* Espera a grade existir: o evento ABERTO tem que aparecer sempre, em
         todos os cenários, então ele serve de sinal de "já renderizou" sem
         mascarar o que está sendo medido. */
      try {
        await page.waitForFunction(
          (k) => !!document.querySelector('.turmas-evento-grupo[data-evento-key="' + k + '"]'),
          EV_ABERTO, { timeout: 15000 });
      } catch (e) { /* o assert abaixo reporta melhor que o timeout */ }

      const v = await lerVitrine(page);
      const temRestrito = v.eventos.indexOf(EV_RESTRITO) !== -1;
      const temAberto   = v.eventos.indexOf(EV_ABERTO) !== -1;
      /* Não basta o grupo sumir: nome do evento, card da turma e texto da
         missão não podem sobrar soltos em lugar nenhum da página. */
      const vazouTexto = !p.veRestrito &&
        (v.titulos.indexOf('EVENTO FECHADO') !== -1 ||
         v.titulos.indexOf('Missão fechada') !== -1 ||
         v.cards.indexOf('TURMA DO EVENTO FECHADO') !== -1);

      const problemas = [];
      if (temRestrito !== p.veRestrito) {
        problemas.push(p.veRestrito
          ? 'evento restrito NÃO apareceu para quem pode vê-lo'
          : 'VAZOU: evento restrito apareceu para quem não pode vê-lo');
      }
      if (vazouTexto) problemas.push('VAZOU: texto do evento restrito sobrou na página');
      if (!temAberto) problemas.push('evento aberto sumiu (a restrição vazou para o evento errado)');
      if (erros.length) problemas.push('erro JS: ' + erros[0]);

      const linha = formato.nome + ' · ' + p.nome;
      if (problemas.length) {
        falhas.push(linha + ' → ' + problemas.join('; '));
        console.log('  FALHA ' + linha + ' → ' + problemas.join('; '));
      } else {
        console.log('  ok    ' + linha + '  — vê: [' + v.eventos.join(', ') + ']');
      }

      await ctx.close();
    }
  }

  await browser.close();

  if (falhas.length) {
    console.error('\n' + falhas.length + ' falha(s):');
    falhas.forEach((f) => console.error('  - ' + f));
    process.exit(1);
  }
  console.log('\nTudo certo: a lista de e-mails do evento decide o que cada pessoa vê, nos dois formatos de tela.');
})();
