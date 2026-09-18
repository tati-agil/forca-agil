/* Treinamento — o cartão fecha, mostra resumo, e abre sem perder progresso.
 *
 * POR QUE ESTE TESTE EXISTE
 * "precisa rever a forma como aparecem os treinamentos... do jeito que
 * está, um está contido numa caixa... mas o segundo está tão expandido.
 * Está muito estranho." — relatado no uso real. O convite da Construção
 * da Aposta é um card pequeno e fechado; o Treinamento Jedi era um banner
 * grande, sempre aberto, empilhado logo abaixo — pareciam de telas
 * diferentes na mesma página.
 *
 * Agora os dois compartilham o mesmo frame visual (.convite-card, a
 * mesma regra CSS de .aposta-convite) e o Treinamento também nasce
 * fechado, com um resumo de status que não exige abrir para ler.
 *
 * Roda com o Firebase falso, em desktop e iPhone.
 *
 * O QUE ELE EXIGE:
 *   1. o convite da Aposta e o cartão do Treinamento têm o MESMO frame
 *      visual (raio de borda e cor da borda iguais, por CSS computado —
 *      não só o nome da classe);
 *   2. o cartão do Treinamento nasce FECHADO, com o corpo (banner, quiz…)
 *      oculto, e o resumo diz "Ainda não iniciado";
 *   3. abrir com "Abrir treinamento →" mostra o quiz; responder atualiza
 *      o resumo sozinho ("N/20 afirmações respondidas") mesmo sem
 *      recolher para conferir;
 *   4. recolher com "← Recolher" NÃO apaga as respostas — reabrindo, elas
 *      continuam marcadas;
 *   5. nenhum erro de JavaScript.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

const ADM   = 'adm@previ.com.br';
const ALUNA = 'aluna@previ.com.br';

function banco() {
  const users = {};
  users[chave(ADM)]   = { name: 'ADMIN', email: ADM, area: 'INFOR' };
  users[chave(ALUNA)] = { name: 'ALUNA TESTE', email: ALUNA, area: 'GECAT' };
  const admins = {}; admins[chave(ADM)] = { email: ADM, name: 'ADMIN' };
  const interesse = { t1: {} };
  interesse.t1[chave(ALUNA)] = { name: 'ALUNA TESTE', email: ALUNA, status: 'inscrito', confirmedByAdmin: ADM };

  return {
    'fa-users': users, 'fa-admins': admins, 'fa-diretores': {}, 'fa-facilitadores': {},
    'fa-users-log': {}, 'fa-progress': {}, 'fa-progress-historico': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    /* apostaHabilitada:true também acende o convite da Aposta — é o par
       que este teste compara com o cartão do Treinamento. */
    eventos: { ev1: { nome: 'FORÇA ÁGIL - TESTE', order: 1, publicado: true, cargaHoraria: '8' } },
    turmas: { t1: { label: 'TURMA 1', eventoKey: 'ev1', dias: ['2026-10-01'], apostaHabilitada: true } },
    'turmas-interesse': interesse,
    treinamentos: { tjedi: { nome: 'Treinamento Jedi', conteudoKey: 'jedi', eventos: { ev1: true }, order: 1 } },
    'treinamentos-conteudo': {},
    avaliacoes: {}, 'turmas-interesse-log': {}, 'turmas-config': {}, 'turmas-checkin': {},
    'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {}, 'turmas-sorteio': {},
    apostas: {}, holocron: {}, pedidos: {},
  };
}

async function abrirTreinamento(browser, formato) {
  const ctx = await browser.newContext(formato.opts);
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify({
    db: banco(), user: { email: ALUNA, emailVerified: true, uid: 'u1' }, delayDefault: 20,
  }) + ';');
  await page.route('**/firebasejs/**', (r) =>
    r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) =>
    r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#treinoCardToggle', { timeout: 15000 });
  await page.waitForTimeout(500); /* convite da Aposta e resumo do cartão chegam por leitura assíncrona */
  return { ctx, page, erros };
}

const FORMATOS = [
  { nome: 'desktop', opts: { viewport: { width: 1280, height: 900 } } },
  { nome: 'celular', opts: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
];

(async () => {
  const browser = await chromium.launch();
  let falhas = 0;
  const anota = (linha, ok, detalhe) => {
    if (ok) console.log('  ok    ' + linha);
    else { falhas++; console.error('  FALHA ' + linha + (detalhe ? ' → ' + detalhe : '')); }
  };

  for (const formato of FORMATOS) {
    console.log('\n===== ' + formato.nome.toUpperCase() + ' =====');
    const { ctx, page, erros } = await abrirTreinamento(browser, formato);

    try {
      /* ── 1: mesmo frame visual do convite da Aposta ── */
      const frame = await page.evaluate(() => {
        const g = (sel, prop) => {
          const el = document.querySelector(sel);
          return el ? getComputedStyle(el)[prop] : null;
        };
        return {
          apostaVisivel: !document.getElementById('apostaEntrada').hidden,
          apostaRaio: g('.aposta-convite', 'borderRadius'),
          apostaBorda: g('.aposta-convite', 'borderColor'),
          treinoRaio: g('#treinoCard', 'borderRadius'),
          treinoBorda: g('#treinoCard', 'borderColor'),
        };
      });
      anota('o convite da Aposta está na tela (para comparar com o do Treinamento)', frame.apostaVisivel);
      anota('o cartão do Treinamento tem o MESMO raio de borda do convite da Aposta',
        !!frame.apostaRaio && frame.apostaRaio === frame.treinoRaio,
        frame.apostaRaio + ' vs ' + frame.treinoRaio);
      anota('e a MESMA cor de borda — mesmo frame visual, não só por acaso',
        !!frame.apostaBorda && frame.apostaBorda === frame.treinoBorda,
        frame.apostaBorda + ' vs ' + frame.treinoBorda);

      /* ── 2: nasce fechado, com resumo sem precisar abrir ── */
      const fechado = await page.evaluate(() => ({
        corpoOculto: document.getElementById('treinoCardCorpo').hidden,
        status: (document.getElementById('treinoCardStatus') || {}).textContent || '',
        botao: (document.getElementById('treinoCardToggle') || {}).textContent || '',
      }));
      anota('o cartão nasce com o corpo (banner, quiz…) oculto', fechado.corpoOculto);
      anota('o resumo diz que ainda não foi iniciado, sem precisar abrir', /ainda não iniciado/i.test(fechado.status), fechado.status);
      anota('o botão convida a abrir', /abrir treinamento/i.test(fechado.botao), fechado.botao);

      /* ── 3: abre, responde, o resumo acompanha sem precisar recolher ── */
      await page.click('#treinoCardToggle');
      await page.waitForSelector('#qList .q-item', { state: 'visible', timeout: 10000 });
      const primeiras3 = (await page.$$('.q-opt[data-v="2"]')).slice(0, 3);
      for (const b of primeiras3) { await b.click(); await page.waitForTimeout(80); }
      const meio = await page.evaluate(() => (document.getElementById('treinoCardStatus') || {}).textContent || '');
      anota('respondendo, o resumo do cartão atualiza sozinho (sem recolher para conferir)',
        /3\/20/.test(meio), meio);

      /* ── 4: recolher não apaga o que foi respondido ── */
      const marcadasAntes = await page.evaluate(() => document.querySelectorAll('.q-opt.sel').length);
      await page.click('#treinoCardToggle'); /* mesmo botão: agora recolhe */
      await page.waitForTimeout(300);
      const fechadoDeNovo = await page.evaluate(() => document.getElementById('treinoCardCorpo').hidden);
      anota('"← Recolher" (mesmo botão) fecha o corpo de novo', fechadoDeNovo);
      await page.click('#treinoCardToggle'); /* reabre */
      await page.waitForSelector('#qList .q-item', { state: 'visible', timeout: 10000 });
      const marcadasDepois = await page.evaluate(() => document.querySelectorAll('.q-opt.sel').length);
      anota('recolher e reabrir NÃO apaga o que já foi respondido',
        marcadasDepois === marcadasAntes && marcadasDepois === 3,
        'antes ' + marcadasAntes + ', depois ' + marcadasDepois);

      anota('nenhum erro de JavaScript', erros.length === 0, erros[0]);
    } catch (e) {
      falhas++;
      console.error('  FALHA inesperada (' + formato.nome + '): ' + e.message);
    }

    await ctx.close();
  }

  await browser.close();
  if (falhas) { console.error('\n' + falhas + ' falha(s).'); process.exit(1); }
  console.log('\nTudo certo: o cartão do Treinamento fecha, mostra resumo, e abre sem perder progresso.');
})();
