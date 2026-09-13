/* Treinamento com conteúdo próprio, criado no painel.
 *
 * POR QUE ESTE TESTE EXISTE
 * O conteúdo do treinamento (as afirmações e as patentes) vivia só no
 * código: dava para cadastrar vários treinamentos, mas todos caíam nas
 * mesmas vinte afirmações do Jedi. Agora o conteúdo pode ser escrito no
 * painel — e isso cria duas maneiras silenciosas de entregar uma tela
 * quebrada para quem responde:
 *
 *   1. conteúdo pela metade. Um treinamento criado nasce vazio, e entre
 *      criar e terminar de escrever ele já pode estar ligado a um evento.
 *      Oferecer ali é dar um quiz sem pergunta, ou um resultado sem
 *      patente: a pessoa responde tudo e não recebe nada, sem erro nenhum
 *      na tela.
 *   2. conteúdo trocado. As afirmações vêm do treinamento escolhido, mas a
 *      escada de patentes era HTML fixo com os quatro nomes Jedi — quem
 *      respondesse outro treinamento veria as perguntas de um e as
 *      patentes de outro, e nada acusaria.
 *
 * Roda com o Firebase falso, em desktop e iPhone.
 *
 * O QUE ELE EXIGE:
 *   1. quem está inscrita só vê os treinamentos dos SEUS eventos, e só os
 *      que estão prontos;
 *   2. escolhido um treinamento, as afirmações E as patentes são as dele;
 *   3. a pontuação máxima é a do conteúdo (não os 60 pontos do Jedi);
 *   4. admin vê também o que está incompleto, com o que falta escrito na
 *      tela — senão a conclusão é "o site quebrou", não "falta conteúdo";
 *   5. nenhum erro de JavaScript.
 */

const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');

const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const ADM   = 'adm@previ.com.br';
const ALUNA = 'aluna@previ.com.br';

const AFIRM = [
  'Uso IA para acelerar decisões do dia a dia',
  'Reviso criticamente o que a IA me entrega',
  'Compartilho com o time o que aprendi usando IA',
];
/* A escala tem CINCO opções de propósito (0 a 4), não as quatro do Jedi:
   3 afirmações × 4 = 12 pontos no máximo. Assim a conta da pontuação só
   fecha se ela vier do conteúdo — com o "×3" fixo que existia antes, este
   treinamento terminaria em 9 e o teste acusa. As faixas cobrem 0..12. */
const ESCALA = ['Nunca', 'Raramente', 'Às vezes', 'Quase sempre', 'Sempre'];
const PONTOS_MAX = 12;
const PATENTES = [
  { id: 'exp1', name: 'Explorador', tag: 'Primeiros passos', icon: '🟢', sym: '#char-0',
    minDiag: 0, maxDiag: 6, desc: 'Está começando com IA.', carac: ['Usa pouco'], proximo: ['Experimentar'], frase: '"Comece."' },
  { id: 'exp2', name: 'Navegador', tag: 'Usa no dia a dia', icon: '🟣', sym: '#char-3',
    minDiag: 7, maxDiag: 12, desc: 'Já incorporou IA ao trabalho.', carac: ['Usa sempre'], proximo: ['Ensinar'], frase: '"Siga."' },
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
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: {
      ev1: { nome: 'FORÇA ÁGIL - DIRETORES', order: 1, publicado: true, cargaHoraria: '8' },
      ev2: { nome: 'FORÇA ÁGIL - OUTRO', order: 2, publicado: true, cargaHoraria: '8' },
    },
    turmas: {
      t1: { label: 'EXPERIÊNCIA EXECUTIVA', eventoKey: 'ev1', dias: ['2026-10-01'] },
      t2: { label: 'TURMA DO OUTRO EVENTO', eventoKey: 'ev2', dias: ['2026-11-01'] },
    },
    'turmas-interesse': interesse,
    treinamentos: {
      tjedi:  { nome: 'Treinamento Jedi',       conteudoKey: 'jedi', eventos: { ev1: true }, order: 1 },
      tnovo:  { nome: 'Mentalidade Ágil + IA',  conteudoKey: '',     eventos: { ev1: true }, order: 2 },
      tvazio: { nome: 'Rascunho sem conteúdo',  conteudoKey: '',     eventos: { ev1: true }, order: 3 },
      toutro: { nome: 'Treinamento de outro evento', conteudoKey: '', eventos: { ev2: true }, order: 4 },
    },
    'treinamentos-conteudo': {
      tnovo: {
        blocos: [{ id: 'b1', label: 'Bloco 1 — Mentalidade e IA', icon: '🤖', afirmacoes: AFIRM }],
        levels: ESCALA,
        ranks: PATENTES,
      },
      /* tvazio de propósito sem registro nenhum: é como um treinamento nasce. */
      toutro: {
        blocos: [{ id: 'b1', label: 'Outro', icon: '🔹', afirmacoes: ['Afirmação do outro evento'] }],
        levels: ['Nunca', 'Sempre'],
        ranks: [{ id: 'u', name: 'Única', tag: '', icon: '⭐', sym: '#char-0', minDiag: 0, maxDiag: 1,
                  desc: '', carac: [], proximo: [], frase: '' }],
      },
    },
    avaliacoes: {}, 'turmas-interesse-log': {}, 'turmas-config': {}, 'turmas-checkin': {},
    'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {}, 'turmas-sorteio': {},
    pedidos: {}, holocron: {},
  };
}

async function abrirTreinamento(browser, formato, email) {
  const ctx = await browser.newContext(formato.opts);
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify({
    db: banco(), user: { email: email, emailVerified: true, uid: 'u1' }, delayDefault: 20,
  }) + ';');
  await page.route('**/firebasejs/**', (r) =>
    r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) =>
    r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#treinamento', { timeout: 15000 });
  await page.waitForTimeout(600);
  return { ctx, page, erros };
}

function lerTela(page) {
  return page.evaluate(() => ({
    ofertados: Array.from(document.querySelectorAll('.treino-seletor-select option'))
      .map((o) => ({ key: o.value, nome: o.textContent.trim() })),
    ativo: window.faGameTreinamentoAtivo ? window.faGameTreinamentoAtivo() : null,
    afirmacoes: Array.from(document.querySelectorAll('#qList .q-label')).map((l) => l.textContent.trim()),
    escada: Array.from(document.querySelectorAll('#charLadder .char-card .cc-name')).map((n) => n.textContent.trim()),
    /* Os rótulos da escala da primeira afirmação — .q-item mora dentro de
       .q-bloco, então não dá para usar :first-child aqui. */
    escala: (() => {
      const item = document.querySelector('#qList .q-item');
      return item ? Array.from(item.querySelectorAll('.q-opt-lbl')).map((s) => s.textContent.trim()) : [];
    })(),
    aviso: (() => {
      const el = document.getElementById('treinoIncompleto');
      return el && !el.hidden ? el.textContent.replace(/\s+/g, ' ').trim() : '';
    })(),
    semAcesso: !document.getElementById('treinamento-sem-acesso').hidden,
  }));
}

async function escolher(page, key) {
  await page.selectOption('.treino-seletor-select', key);
  await page.waitForTimeout(300);
}

const FORMATOS = [
  { nome: 'desktop', opts: { viewport: { width: 1366, height: 900 } } },
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

    /* ── Quem está inscrita ─────────────────────────────────────────── */
    {
      const { ctx, page, erros } = await abrirTreinamento(browser, formato, ALUNA);
      const t = await lerTela(page);
      const keys = t.ofertados.map((o) => o.key);
      const p = [];
      if (t.semAcesso) p.push('quem está inscrita caiu na tela de "sem acesso"');
      if (keys.indexOf('tnovo') === -1) p.push('o treinamento novo, com conteúdo pronto, não foi oferecido');
      if (keys.indexOf('tvazio') !== -1) p.push('ofereceu um treinamento SEM conteúdo — a pessoa responderia um quiz sem pergunta');
      if (keys.indexOf('toutro') !== -1) p.push('VAZOU: ofereceu treinamento de um evento em que ela não está');
      if (erros.length) p.push('erro JS: ' + erros[0]);
      anota('inscrita vê só os treinamentos dos eventos dela, e só os prontos', p);
      await ctx.close();
    }

    /* ── As afirmações e as patentes são do treinamento escolhido ────── */
    {
      const { ctx, page, erros } = await abrirTreinamento(browser, formato, ALUNA);
      await escolher(page, 'tnovo');
      const t = await lerTela(page);
      const p = [];
      if (t.ativo !== 'tnovo') p.push('escolher o treinamento não trocou o ativo (está em "' + t.ativo + '")');
      if (t.afirmacoes.length !== AFIRM.length) {
        p.push('deveria mostrar as ' + AFIRM.length + ' afirmações do treinamento novo, mostrou ' + t.afirmacoes.length);
      }
      if (!t.afirmacoes.some((a) => a.indexOf(AFIRM[0]) !== -1)) {
        p.push('as afirmações não são as do treinamento escolhido: ' + JSON.stringify(t.afirmacoes.slice(0, 2)));
      }
      const nomesEsperados = PATENTES.map((r) => r.name);
      if (JSON.stringify(t.escada) !== JSON.stringify(nomesEsperados)) {
        p.push('a escada mostra ' + JSON.stringify(t.escada) + ' em vez das patentes do treinamento ' +
               JSON.stringify(nomesEsperados) + ' — perguntas de um, patentes de outro');
      }
      if (t.escala.indexOf('Sempre') === -1) {
        p.push('a escala de resposta não é a do treinamento (esperava "Sempre" entre as opções): ' + JSON.stringify(t.escala));
      }
      if (erros.length) p.push('erro JS: ' + erros[0]);
      anota('afirmações, escala e patentes são as do treinamento escolhido', p);
      await ctx.close();
    }

    /* ── Responder até o fim: pontuação e patente são as do conteúdo ── */
    {
      const { ctx, page, erros } = await abrirTreinamento(browser, formato, ALUNA);
      await escolher(page, 'tnovo');
      /* Responde tudo com a nota máxima da escala do treinamento. */
      await page.evaluate(() => {
        document.querySelectorAll('#qList .q-item').forEach((item) => {
          const opts = item.querySelectorAll('.q-opt');
          opts[opts.length - 1].click();
        });
      });
      await page.waitForTimeout(300);
      await page.click('#revelarBtn');
      await page.waitForTimeout(400);
      const r = await page.evaluate(() => ({
        score: (document.querySelector('.diag-result-score') || {}).textContent || '',
        patente: (document.querySelector('.diag-result-rank') || {}).textContent || '',
      }));
      const p = [];
      if (r.score.indexOf('/' + PONTOS_MAX) === -1) {
        p.push('a pontuação máxima não é a do conteúdo (esperava /' + PONTOS_MAX + ', veio "' + r.score.trim() +
               '") — é a escala de outro treinamento sendo usada na conta');
      }
      if (r.patente.indexOf('Navegador') === -1) {
        p.push(PONTOS_MAX + ' pontos deveriam dar a patente "Navegador", veio "' + r.patente.trim() + '"');
      }
      if (erros.length) p.push('erro JS: ' + erros[0]);
      anota('respondendo até o fim, pontuação e patente saem do conteúdo dele', p);
      await ctx.close();
    }

    /* ── Admin: vê o incompleto E o que falta nele ──────────────────── */
    {
      const { ctx, page, erros } = await abrirTreinamento(browser, formato, ADM);
      const t0 = await lerTela(page);
      const p = [];
      if (t0.ofertados.map((o) => o.key).indexOf('tvazio') === -1) {
        p.push('admin não enxergou o treinamento incompleto — é quem precisa revisar e consertar');
      }
      await escolher(page, 'tvazio');
      const t = await lerTela(page);
      if (!t.aviso) {
        p.push('escolhendo o treinamento vazio, nada explica por que ele está vazio: parece site quebrado');
      } else {
        if (t.aviso.indexOf('afirmação') === -1) p.push('o aviso não diz que faltam as afirmações: "' + t.aviso + '"');
        if (t.aviso.indexOf('patente') === -1) p.push('o aviso não diz que faltam as patentes: "' + t.aviso + '"');
      }
      if (erros.length) p.push('erro JS: ' + erros[0]);
      anota('admin vê o treinamento incompleto com o que falta escrito na tela', p);
      await ctx.close();
    }
  }

  await browser.close();

  if (falhas.length) {
    console.error('\n' + falhas.length + ' falha(s):');
    falhas.forEach((f) => console.error('  - ' + f));
    process.exit(1);
  }
  console.log('\nTudo certo: cada treinamento entrega o conteúdo dele, e o que está pela metade não chega a quem responde.');
})();
