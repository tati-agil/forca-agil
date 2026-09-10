/* Teste de tela preta — desktop e celular.
 *
 * POR QUE ESTE TESTE EXISTE
 * O body inteiro fica escondido (class "aguardando-auth") até o Firebase
 * confirmar a sessão. Se nada aparece nesse intervalo, uma rede lenta vira
 * uma tela preta indistinguível de um site quebrado — foi o que aconteceu
 * na oficina de 08-09/09/2026, no 4G da sala, e de novo no desktop na noite
 * seguinte. Medido na época: ZERO elemento visível aos 2 segundos em quatro
 * cenários diferentes, nos dois formatos de tela.
 *
 * A suíte "▶ Automáticos" de testes.js não pega isso: ela roda DEPOIS do
 * login resolver, então por definição nunca vê a espera. Este teste roda com
 * o Firebase SUBSTITUÍDO por um falso (.github/scripts/firebase-falso.js),
 * o que permite simular o que não dá para simular contra o banco real:
 * leitura que nunca responde, leitura que falha, autenticação muda, e o
 * próprio SDK fora do ar. Não precisa de segredo nem de rede.
 *
 * O QUE ELE EXIGE, em cada cenário × cada formato de tela:
 *   1. algo visível aos 2 segundos — nunca preto absoluto;
 *   2. algo visível no fim — a espera sempre termina em site ou em login;
 *   3. nenhum erro de JavaScript não tratado (menos onde o cenário é
 *      justamente derrubar o SDK).
 */

const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE   = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const ESPERA = Number(process.env.FA_ESPERA || 16000);
const FALSO  = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');

const EMAIL = 'teste@previ.com.br';
const KEY   = EMAIL.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

function bancoBase() {
  const interesse = { turma1: {} };
  interesse.turma1[KEY] = { name: 'TESTE', email: EMAIL, status: 'inscrito', confirmedByAdmin: 'adm@previ.com.br' };
  const users  = {}; users[KEY]  = { name: 'PESSOA TESTE', area: 'TI' };
  const admins = {}; admins[KEY] = { email: EMAIL };
  return {
    turmas: { turma1: { label: 'Turma de teste', dias: ['2026-01-01'] } },
    'turmas-interesse': interesse, 'fa-users': users, 'fa-admins': admins,
    'turmas-config': {}, 'turmas-checkin': {}, 'turmas-espera': {},
    'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {}, eventos: {}
  };
}

/* 999000ms = "nunca responde" dentro do tempo do teste. */
const CENARIOS = [
  { nome: 'rede normal',              cfg: { delayDefault: 20 } },
  { nome: 'rede lenta (2s/leitura)',  cfg: { delayDefault: 2000 } },
  { nome: 'turmas-interesse travado', cfg: { delayDefault: 20, delays: { 'turmas-interesse': 999000 } } },
  { nome: 'turmas-interesse com erro',cfg: { delayDefault: 20, fail: ['turmas-interesse'] } },
  { nome: 'fa-users com erro',        cfg: { delayDefault: 20, fail: ['fa-users'] } },
  { nome: 'fa-admins travado',        cfg: { delayDefault: 20, delays: { 'fa-admins': 999000 } } },
  { nome: 'auth nunca responde',      cfg: { delayDefault: 20, authDelay: 999000 } },
  { nome: 'SDK do Firebase fora',     cfg: { delayDefault: 20 }, semSdk: true },
];

const FORMATOS = [
  { nome: 'desktop', opts: { viewport: { width: 1440, height: 900 } } },
  { nome: 'celular', opts: devices['Pixel 5'] },
];

/* Conta o que a pessoa realmente enxerga. Olhar só a classe do body não
   serve: o modal de login é isento das regras que escondem, então a classe
   pode estar lá com a tela perfeitamente utilizável. */
function contarVisiveis(page) {
  return page.evaluate(() => {
    const visivel = function (el) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 &&
             cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0;
    };
    return Array.from(document.body.querySelectorAll('*')).filter(visivel).length;
  });
}

(async () => {
  const browser = await chromium.launch();
  const falhas = [];

  for (const formato of FORMATOS) {
    console.log('\n===== ' + formato.nome.toUpperCase() + ' =====');
    for (const c of CENARIOS) {
      const ctx = await browser.newContext(formato.opts);
      const page = await ctx.newPage();
      const erros = [];
      page.on('pageerror', function (e) { erros.push(String(e).split('\n')[0]); });

      const cfg = Object.assign(
        { db: bancoBase(), user: { email: EMAIL, emailVerified: true, uid: 'u1' } },
        c.cfg
      );
      await page.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');

      if (c.semSdk) {
        await page.route('**/firebasejs/**', function (r) { return r.abort(); });
      } else {
        await page.route('**/firebasejs/**', function (r) {
          return r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO });
        });
      }
      /* Fontes externas não podem decidir se o teste passa. */
      await page.route('**fonts.googleapis.com**', function (r) {
        return r.fulfill({ status: 200, contentType: 'text/css', body: '' });
      });
      await page.route('**fonts.gstatic.com**', function (r) { return r.abort(); });

      await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });

      await page.waitForTimeout(2000);
      const aos2s = await contarVisiveis(page);

      try {
        await page.waitForFunction(
          function () { return !document.body.classList.contains('aguardando-auth'); },
          { timeout: ESPERA }
        );
      } catch (e) { /* pode terminar em login em vez de site — o final decide */ }
      const noFim = await contarVisiveis(page);

      /* O cenário "SDK fora" derruba o firebase de propósito; o ReferenceError
         resultante é o próprio cenário, não uma regressão. */
      const errosReais = c.semSdk
        ? erros.filter(function (e) { return e.indexOf('firebase is not defined') === -1; })
        : erros;

      const problemas = [];
      if (aos2s === 0) problemas.push('TELA PRETA aos 2s');
      if (noFim === 0) problemas.push('TELA PRETA no fim');
      if (errosReais.length) problemas.push('erro JS: ' + errosReais[0]);

      const ok = problemas.length === 0;
      if (!ok) falhas.push(formato.nome + ' / ' + c.nome + ' → ' + problemas.join('; '));
      console.log(
        (ok ? '  ok   ' : '  FALHA ') + c.nome.padEnd(28) +
        ('visíveis aos 2s: ' + aos2s).padEnd(22) +
        ('no fim: ' + noFim).padEnd(14) +
        (ok ? '' : problemas.join('; '))
      );

      await ctx.close();
    }
  }

  await browser.close();

  if (falhas.length) {
    console.error('\n' + falhas.length + ' falha(s):');
    falhas.forEach(function (f) { console.error('  - ' + f); });
    process.exit(1);
  }
  console.log('\nNenhuma tela preta em ' + (CENARIOS.length * FORMATOS.length) + ' combinações.');
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
