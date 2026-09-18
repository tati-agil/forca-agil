/* Autodiagnóstico — a própria pessoa refaz, e o histórico não se perde.
 *
 * POR QUE ESTE TESTE EXISTE
 * Até aqui, revelar a patente travava o quiz para sempre: "🔒 Resultado
 * bloqueado. Para refazer, solicite ao admin o reset do seu progresso."
 * Pedido no uso real: a própria pessoa precisa conseguir fazer outra
 * rodada, sem depender do admin — e sem que isso apague o resultado de
 * antes, que precisa ficar guardado num histórico.
 *
 * A diferença para "resetar progresso" (ação do admin) é deliberada:
 * resetar apaga tudo; refazer abre uma rodada nova e preserva a anterior
 * no histórico — são caminhos diferentes, para propósitos diferentes.
 *
 * Roda com o Firebase falso, em desktop e iPhone.
 *
 * O QUE ELE EXIGE:
 *   1. ao revelar, a linha entra no histórico (fa-progress-historico);
 *   2. "🔁 Refazer autodiagnóstico" pede confirmação num modal próprio
 *      (não window.confirm) antes de fazer qualquer coisa;
 *   3. confirmado, o quiz reabre zerado — nenhuma opção marcada, nenhum
 *      campo desabilitado — SEM apagar a linha já gravada no histórico;
 *   4. uma segunda rodada, com respostas diferentes, entra como uma
 *      SEGUNDA linha, mais recente no topo — as duas continuam lá;
 *   5. a mensagem antiga ("solicite ao admin") não aparece mais em
 *      lugar nenhum da tela;
 *   6. nenhum erro de JavaScript.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

const ADM   = 'adm@previ.com.br';
const ALUNA = 'aluna@previ.com.br';

/* Duas afirmações, escala 0-2 (3 opções): máximo 4 pontos. Pequeno de
   propósito — o que importa aqui é o ciclo revelar → refazer → revelar
   de novo, não o conteúdo em si. */
const AFIRM = ['Eu falo a língua dos Wookiees', 'Eu piloto naves classe leve'];
const ESCALA = ['Nunca', 'Às vezes', 'Sempre'];
const PATENTES = [
  { id: 'p1', name: 'Youngling', tag: 'Começando', icon: '🟢', sym: '#char-0',
    minDiag: 0, maxDiag: 2, desc: '', carac: [], proximo: [], frase: '' },
  { id: 'p2', name: 'Padawan', tag: 'Avançando', icon: '🟣', sym: '#char-1',
    minDiag: 3, maxDiag: 4, desc: '', carac: [], proximo: [], frase: '' },
];

function banco() {
  const users = {};
  users[chave(ADM)]   = { name: 'ADMIN', email: ADM, area: 'INFOR' };
  users[chave(ALUNA)] = { name: 'ALUNA', email: ALUNA, area: 'GECAT' };
  const admins = {}; admins[chave(ADM)] = { email: ADM, name: 'ADMIN' };
  const interesse = { t1: {} };
  interesse.t1[chave(ALUNA)] = { name: 'ALUNA', email: ALUNA, status: 'inscrito', confirmedByAdmin: ADM };

  return {
    'fa-users': users, 'fa-admins': admins, 'fa-diretores': {}, 'fa-facilitadores': {},
    'fa-users-log': {}, 'fa-progress': {}, 'fa-progress-historico': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: { ev1: { nome: 'FORÇA ÁGIL - TESTE', order: 1, publicado: true, cargaHoraria: '8' } },
    turmas: { t1: { label: 'TURMA 1', eventoKey: 'ev1', dias: ['2026-10-01'] } },
    'turmas-interesse': interesse,
    treinamentos: { tnovo: { nome: 'Treino Refazer', conteudoKey: '', eventos: { ev1: true }, order: 1 } },
    'treinamentos-conteudo': {
      tnovo: {
        blocos: [{ id: 'b1', label: 'Bloco 1', icon: '🤖', afirmacoes: AFIRM }],
        levels: ESCALA,
        ranks: PATENTES,
      },
    },
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
  /* O cartão do treinamento nasce fechado, do mesmo jeito que o convite
     da Aposta — abre uma vez, e o resto do teste interage com o quiz
     já visível (só troca de treinamento fecharia de novo, e este teste
     usa um só). */
  await page.click('#treinoCardToggle');
  await page.waitForSelector('#qList .q-item', { state: 'visible', timeout: 15000 });
  await page.waitForTimeout(400);
  return { ctx, page, erros };
}

/* Responde as duas afirmações com o mesmo valor (0, 1 ou 2), para
   controlar a pontuação final sem depender de qual afirmação é qual. */
async function responder(page, valor) {
  const botoes = await page.$$('.q-opt[data-v="' + valor + '"]');
  for (const b of botoes) { await b.click(); await page.waitForTimeout(80); }
}

async function revelar(page) {
  await page.click('#revelarBtn');
  await page.waitForSelector('.diag-result', { timeout: 10000 });
  await page.waitForTimeout(500); /* leitura do histórico é assíncrona */
}

function lerResultado(page) {
  return page.evaluate(() => ({
    score: (document.querySelector('.diag-result-score') || {}).textContent || '',
    temBotaoRefazer: !!document.getElementById('refazerBtn'),
    temTextoAntigo: /solicite ao admin/i.test(document.body.textContent || ''),
    historico: Array.from(document.querySelectorAll('.diag-historico-lista li')).map((li) => ({
      rank: (li.querySelector('.diag-historico-rank') || {}).textContent || '',
      score: (li.querySelector('.diag-historico-score') || {}).textContent || '',
    })),
    tituloHistorico: (document.querySelector('.diag-historico-titulo') || {}).textContent || '',
  }));
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
      /* ── 1ª rodada: responde tudo com 2 (máximo), revela ── */
      await responder(page, 2);
      await revelar(page);
      let r = await lerResultado(page);
      anota('1ª rodada: revelar grava uma linha no histórico', r.historico.length === 1, JSON.stringify(r.historico));
      anota('a linha traz a patente e a pontuação certas',
        r.historico[0] && /Padawan/.test(r.historico[0].rank) && /4\/4/.test(r.historico[0].score),
        JSON.stringify(r.historico[0]));
      anota('a mensagem antiga ("solicite ao admin") não aparece mais', !r.temTextoAntigo);
      anota('o botão de refazer está na tela', r.temBotaoRefazer);

      /* ── Refazer: pede confirmação num modal próprio ──
         .modal-box também existe (oculto) no login/cadastro/QR — a
         conferência usa os botões do PRÓPRIO modal, que são únicos. */
      await page.click('#refazerBtn');
      await page.waitForSelector('#refazerConfirmar', { timeout: 5000 });
      const modal = await page.evaluate(() => (document.getElementById('refazerConfirmar').closest('.modal-box') || {}).textContent || '');
      anota('a confirmação é um modal da própria tela, com o aviso certo',
        /Refazer o autodiagnóstico/i.test(modal) && /já está no seu histórico/i.test(modal), modal.slice(0, 140));

      /* Cancelar não muda nada: a patente continua revelada. */
      await page.click('#refazerCancelar');
      await page.waitForTimeout(200);
      anota('cancelar mantém o resultado revelado', await page.evaluate(() => !!document.querySelector('.diag-result')));

      /* Confirmar reabre o quiz, zerado. */
      await page.click('#refazerBtn');
      await page.waitForSelector('#refazerConfirmar', { timeout: 5000 });
      await page.click('#refazerConfirmar');
      await page.waitForTimeout(300);
      const zerado = await page.evaluate(() => ({
        temResultado: !!document.querySelector('.diag-result'),
        marcadas: document.querySelectorAll('.q-opt.sel').length,
        desabilitadas: document.querySelectorAll('.q-opt[disabled]').length,
      }));
      anota('refazer reabre o quiz sem nenhuma opção marcada ou desabilitada',
        !zerado.temResultado && zerado.marcadas === 0 && zerado.desabilitadas === 0, JSON.stringify(zerado));

      /* ── 2ª rodada: respostas diferentes (mínimo), revela de novo ── */
      await responder(page, 0);
      await revelar(page);
      r = await lerResultado(page);
      anota('a 2ª rodada soma ao histórico — agora são duas linhas', r.historico.length === 2, JSON.stringify(r.historico));
      anota('a mais recente vem primeiro (a de agora, 0/4)',
        r.historico[0] && /0\/4/.test(r.historico[0].score), JSON.stringify(r.historico[0]));
      anota('a de antes (4/4) continua guardada, não foi sobrescrita',
        r.historico.some((h) => /4\/4/.test(h.score)), JSON.stringify(r.historico));
      anota('o título do histórico conta as duas linhas', /2 resultados/.test(r.tituloHistorico), r.tituloHistorico);

      anota('nenhum erro de JavaScript', erros.length === 0, erros[0]);
    } catch (e) {
      falhas++;
      console.error('  FALHA inesperada (' + formato.nome + '): ' + e.message);
    }

    await ctx.close();
  }

  await browser.close();
  if (falhas) { console.error('\n' + falhas + ' falha(s).'); process.exit(1); }
  console.log('\nTudo certo: refazer abre uma rodada nova sem apagar o histórico.');
})();
