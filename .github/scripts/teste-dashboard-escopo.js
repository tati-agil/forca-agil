/* Dashboard: os números são de QUAIS eventos e turmas.
 *
 * POR QUE ESTE TESTE EXISTE
 * Enquanto existia uma oficina só, somar tudo dava no mesmo. A partir da
 * segunda, "média 9,8" deixa de responder a pergunta que se faz de verdade —
 * como foi ESTA turma, como foi ESTE evento — e um número agregado errado é
 * pior que número nenhum: ele parece certo. Nada na tela acusa se o filtro
 * deixar de filtrar; os cards continuam mostrando um número plausível.
 *
 * O outro defeito que este teste tranca é de forma: o gráfico de média era
 * de barras verticais com o nome da turma embaixo. Com duas turmas os nomes
 * já se sobrepunham, e com mais de um evento não dava para saber de quem era
 * cada barra.
 *
 * Roda com o Firebase falso, em desktop e iPhone. O banco tem dois eventos,
 * quatro turmas (uma sem nenhuma avaliação) e notas escolhidas para que cada
 * escopo tenha uma média DIFERENTE — se o filtro não filtrar, a conta não
 * bate e o teste acusa.
 *
 * O QUE ELE EXIGE:
 *   1. sem filtro, a tela soma tudo (7 avaliações, 35 inscritos, média 8,6);
 *   2. escolhendo um evento, cards, gráfico, temas e respostas individuais
 *      passam a ser só dele (5 avaliações, 18 inscritos, média 8,0);
 *   3. escolhendo uma turma dentro dele, idem (3 avaliações, 10, média 9,0);
 *   4. dá para marcar mais de um evento e mais de uma turma ao mesmo tempo;
 *   5. cada turma aparece com o nome INTEIRO e agrupada sob seu evento;
 *   6. turma sem avaliação aparece com "—", nunca com nota zero;
 *   7. nada rola para o lado no celular, e nenhum erro de JavaScript.
 */

const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');

const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const ADM = 'adm@previ.com.br';

function aval(nota, nps, tema, texto, turmaLabel) {
  return {
    notaGeral: nota, npsNota: nps, orgGeral: nota, conteudoRelevancia: nota,
    facilitadoresNota: nota, dinamicasNota: nota, aplicacaoPreparado: nota,
    temasDesejados: [tema], continuar: texto, turmaLabel: turmaLabel,
    timestamp: '2026-09-0' + (1 + (nota % 8)) + 'T10:00:00.000Z', identificado: false,
  };
}
function inscritos(n) {
  const o = {};
  for (let i = 0; i < n; i++) o['p' + i] = { status: 'inscrito', confirmedByAdmin: ADM, name: 'P' + i };
  return o;
}

/* Nome comprido de propósito: os rótulos reais são assim ('OFICINA DE
   AGILIDADE — TURMA 2 — SETEMBRO/2026'), e era com eles que os nomes se
   sobrepunham no gráfico antigo. Com nome curto, a conferência de nome
   cortado não teria como falhar nunca — e um teste que não pode falhar
   não está testando. */
const T1 = 'TURMA 1 — SETEMBRO DE 2026 — GRUPO DA MANHÃ';
const T2 = 'TURMA 2 — OUTUBRO DE 2026';
const T3 = 'TURMA 3 — NOVEMBRO DE 2026';
const T4 = 'TURMA 4 — DEZEMBRO DE 2026';

function banco() {
  const users = {}; users[chave(ADM)] = { name: 'ADMIN', email: ADM, area: 'INFOR' };
  const admins = {}; admins[chave(ADM)] = { email: ADM };
  return {
    'fa-users': users, 'fa-admins': admins, 'fa-diretores': {}, 'fa-facilitadores': {},
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: {
      ev1: { nome: 'JORNADA DE IMERSÃO', order: 1, publicado: true, cargaHoraria: '8' },
      ev2: { nome: 'OFICINA DE AGILIDADE', order: 2, publicado: true, cargaHoraria: '8' },
    },
    turmas: {
      t1: { label: T1, eventoKey: 'ev1', dias: ['2026-09-01'] },
      t2: { label: T2, eventoKey: 'ev1', dias: ['2026-10-01'] },
      t3: { label: T3, eventoKey: 'ev2', dias: ['2026-11-01'] },
      t4: { label: T4, eventoKey: 'ev2', dias: ['2026-12-01'] },
    },
    'turmas-interesse': { t1: inscritos(10), t2: inscritos(8), t3: inscritos(12), t4: inscritos(5) },
    avaliacoes: {
      t1: { a1: aval(10, 10, 'Scrum', 'Ótima, turma 1', T1),
            a2: aval(9, 10, 'Kanban', 'Boa, turma 1', T1),
            a3: aval(8, 9, 'Scrum', 'Legal, turma 1', T1) },
      t2: { a4: aval(6, 5, 'OKRs', 'Mediana, turma 2', T2),
            a5: aval(7, 7, 'Scrum', 'Ok, turma 2', T2) },
      t3: { a6: aval(10, 10, 'IA aplicada à Agilidade', 'Excelente, turma 3', T3),
            a7: aval(10, 10, 'IA aplicada à Agilidade', 'Muito boa, turma 3', T3) },
    },
    'turmas-interesse-log': {}, 'turmas-config': {}, 'turmas-checkin': {}, 'turmas-publico': {},
    'eventos-publico': {}, 'turmas-equipe': {}, 'turmas-sorteio': {}, pedidos: {}, holocron: {},
  };
}

/* Um programa que cresceu: N eventos com N turmas cada. É o caso que fez o
   filtro antigo virar um paredão — ele desenhava um chip por turma, sempre
   todos, e a lista cresce a cada oficina. */
function bancoGrande(nEv, nTu) {
  const users = {}; users[chave(ADM)] = { name: 'ADMIN', email: ADM, area: 'INFOR' };
  const admins = {}; admins[chave(ADM)] = { email: ADM, name: 'ADMIN' };
  const eventos = {}, turmas = {}, interesse = {};
  for (let e = 1; e <= nEv; e++) {
    eventos['ev' + e] = { nome: 'FORÇA ÁGIL · EVENTO ' + e, order: e, publicado: true, cargaHoraria: '8' };
    for (let t = 1; t <= nTu; t++) {
      const k = 'ev' + e + 't' + t;
      turmas[k] = { label: 'Turma ' + t + ' do evento ' + e + ' — 2026', eventoKey: 'ev' + e, dias: ['2026-01-01'] };
      interesse[k] = { p1: { status: 'inscrito', confirmedByAdmin: ADM, name: 'P' } };
    }
  }
  return {
    'fa-users': users, 'fa-admins': admins, 'fa-diretores': {}, 'fa-facilitadores': {},
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: eventos, turmas: turmas, 'turmas-interesse': interesse, avaliacoes: {},
    'turmas-interesse-log': {}, 'turmas-config': {}, 'turmas-checkin': {}, 'turmas-publico': {},
    'eventos-publico': {}, 'turmas-equipe': {}, 'turmas-sorteio': {}, pedidos: {}, holocron: {},
  };
}

async function abrirDashboard(browser, formato, dbUsado) {
  const ctx = await browser.newContext(formato.opts);
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify({
    db: dbUsado || banco(), user: { email: ADM, emailVerified: true, uid: 'u1' }, delayDefault: 20,
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
      .find((x) => /Dashboard/i.test(x.textContent));
    if (b) b.click();
  });
  await page.waitForSelector('.dash-stat-card', { timeout: 15000 });
  await page.waitForTimeout(200);
  return { ctx, page, erros };
}

/* O que a tela está afirmando neste momento. */
function lerTela(page) {
  return page.evaluate(() => {
    const card = (rotulo) => {
      const el = Array.from(document.querySelectorAll('.dash-stat-card'))
        .find((c) => (c.querySelector('.dash-stat-label') || {}).textContent === rotulo);
      return el ? el.querySelector('.dash-stat-value').textContent.trim() : null;
    };
    const visivel = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    return {
      participantes: card('Participantes'),
      avaliacoes: card('Avaliações recebidas'),
      media: card('Média geral'),
      resumo: (document.querySelector('.dash-escopo-resumo') || {}).textContent || '',
      eventosNoGrafico: Array.from(document.querySelectorAll('.dash-media-evento'))
        .map((p) => p.firstChild.textContent.trim()),
      turmas: Array.from(document.querySelectorAll('.dash-media-linha')).filter(visivel).map((l) => ({
        nome: l.querySelector('.dash-media-nome').textContent.trim(),
        valor: l.querySelector('.dash-media-valor').textContent.trim(),
        n: l.querySelector('.dash-media-n').textContent.trim(),
        /* Nome cortado por CSS: o que a pessoa lê é menor que o nome real. */
        cortado: l.querySelector('.dash-media-nome').scrollWidth >
                 l.querySelector('.dash-media-nome').clientWidth + 1,
      })),
      temas: Array.from(document.querySelectorAll('.dash-tema-chip')).map((c) => c.textContent.trim()),
      respostas: Array.from(document.querySelectorAll('.resp-card')).length,
      contagemRespostas: (document.querySelector('.resp-contagem') || {}).textContent || '',
      rolaLado: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });
}

/* Escolhe uma opção no controle de escopo: abre o painel se preciso e clica.
   (Os filtros eram chips soltos; viraram dois controles que abrem uma lista,
   para não encher a tela quando os eventos e turmas aumentarem.) */
async function clicar(page, campo, key) {
  await page.evaluate((c) => {
    const filtro = document.querySelector('.dash-filtro[data-campo="' + c + '"]');
    if (filtro && !filtro.classList.contains('aberto')) filtro.querySelector('.dash-filtro-btn').click();
  }, campo);
  await page.waitForSelector('.dash-filtro[data-campo="' + campo + '"].aberto', { timeout: 5000 });
  await page.click('.dash-filtro[data-campo="' + campo + '"] .dash-filtro-opt[data-key="' + key + '"]');
  await page.waitForTimeout(150);
}

/* Altura do controle de escopo FECHADO — é o espaço que ele rouba dos
   números antes de alguém sequer querer filtrar. */
function medirFiltro(page) {
  return page.evaluate(() => {
    const esc = document.querySelector('.dash-escopo');
    return {
      altura: esc ? Math.round(esc.getBoundingClientRect().height) : 0,
      temBusca: !!document.querySelector('.dash-filtro-busca'),
    };
  });
}

function anotaCompacto(linha, problemas, falhas) {
  if (problemas.length) {
    falhas.push(linha + ' → ' + problemas.join('; '));
    console.log('  FALHA ' + linha + ' → ' + problemas.join('; '));
  } else {
    console.log('  ok    ' + linha);
  }
}

const FORMATOS = [
  { nome: 'desktop', opts: { viewport: { width: 1366, height: 900 } } },
  { nome: 'celular', opts: devices['iPhone 13'] },
];

(async () => {
  const browser = await chromium.launch();
  const falhas = [];

  for (const formato of FORMATOS) {
    console.log('\n===== ' + formato.nome.toUpperCase() + ' =====');
    const { ctx, page, erros } = await abrirDashboard(browser, formato);

    function registrar(nome, problemas) {
      const linha = formato.nome + ' · ' + nome;
      if (problemas.length) {
        falhas.push(linha + ' → ' + problemas.join('; '));
        console.log('  FALHA ' + linha + ' → ' + problemas.join('; '));
      } else {
        console.log('  ok    ' + nome);
      }
    }

    /* 1. Sem filtro: soma tudo, e o gráfico separa os dois eventos. */
    {
      const t = await lerTela(page);
      const p = [];
      if (t.avaliacoes !== '7') p.push('avaliações deveria ser 7, é ' + t.avaliacoes);
      if (t.participantes !== '35') p.push('participantes deveria ser 35, é ' + t.participantes);
      if (t.media !== '8,6 / 10') p.push('média geral deveria ser 8,6, é ' + t.media);
      if (t.eventosNoGrafico.length !== 2) {
        p.push('o gráfico deveria agrupar os 2 eventos, agrupou ' + t.eventosNoGrafico.length);
      }
      if (t.turmas.length !== 4) p.push('deveria listar as 4 turmas, listou ' + t.turmas.length);
      const cortadas = t.turmas.filter((x) => x.cortado).map((x) => x.nome);
      if (cortadas.length) p.push('nome de turma cortado na tela: ' + cortadas.join(', '));
      if (t.rolaLado) p.push('a página rola para o lado');
      registrar('sem filtro, soma tudo e separa por evento', p);
    }

    /* 2. Turma sem avaliação: travessão, não zero. */
    {
      const t = await lerTela(page);
      const vazia = t.turmas.filter((x) => x.nome.indexOf('DEZEMBRO') !== -1)[0];
      const p = [];
      if (!vazia) p.push('a turma sem avaliação sumiu do gráfico');
      else {
        if (vazia.valor !== '—') p.push('turma sem avaliação mostra "' + vazia.valor + '" em vez de "—" — zero é a pior nota possível, e ninguém ter respondido não é nota');
        if (vazia.n.indexOf('sem avaliação') === -1) p.push('não diz que a turma está sem avaliação (diz "' + vazia.n + '")');
      }
      registrar('turma sem avaliação não vira nota zero', p);
    }

    /* 3. Um evento. */
    {
      await clicar(page, 'evento', 'ev1');
      const t = await lerTela(page);
      const p = [];
      if (t.avaliacoes !== '5') p.push('avaliações do evento deveria ser 5, é ' + t.avaliacoes);
      if (t.participantes !== '18') p.push('inscritos do evento deveria ser 18, é ' + t.participantes);
      if (t.media !== '8,0 / 10') p.push('média do evento deveria ser 8,0, é ' + t.media);
      if (t.turmas.length !== 2) p.push('deveria mostrar só as 2 turmas do evento, mostrou ' + t.turmas.length);
      if (t.temas.some((x) => x.indexOf('IA aplicada') !== -1)) {
        p.push('VAZOU: tema que só foi pedido no outro evento apareceu');
      }
      if (t.contagemRespostas.indexOf('5 ') !== 0) {
        p.push('as respostas individuais não seguiram o escopo (diz "' + t.contagemRespostas + '")');
      }
      registrar('escolhendo um evento, a tela inteira é dele', p);
    }

    /* 4. Uma turma dentro do evento. */
    {
      await clicar(page, 'turma', 't1');
      const t = await lerTela(page);
      const p = [];
      if (t.avaliacoes !== '3') p.push('avaliações da turma deveria ser 3, é ' + t.avaliacoes);
      if (t.participantes !== '10') p.push('inscritos da turma deveria ser 10, é ' + t.participantes);
      if (t.media !== '9,0 / 10') p.push('média da turma deveria ser 9,0, é ' + t.media);
      if (t.turmas.length !== 1) p.push('deveria mostrar só a turma escolhida, mostrou ' + t.turmas.length);
      registrar('escolhendo uma turma, a tela inteira é dela', p);
    }

    /* 5. Mais de uma turma ao mesmo tempo (o pedido literal). */
    {
      await clicar(page, 'turma', 't2');
      const t = await lerTela(page);
      const p = [];
      if (t.avaliacoes !== '5') p.push('com duas turmas marcadas, avaliações deveria ser 5, é ' + t.avaliacoes);
      if (t.turmas.length !== 2) p.push('deveria mostrar as 2 turmas marcadas, mostrou ' + t.turmas.length);
      registrar('dá para marcar mais de uma turma', p);
    }

    /* 6. Mais de um evento ao mesmo tempo. */
    {
      await clicar(page, 'turma', '');          /* volta para "Todas" */
      await clicar(page, 'evento', 'ev2');      /* ev1 + ev2 */
      const t = await lerTela(page);
      const p = [];
      if (t.avaliacoes !== '7') p.push('com os dois eventos marcados, avaliações deveria ser 7, é ' + t.avaliacoes);
      if (t.eventosNoGrafico.length !== 2) p.push('o gráfico deveria mostrar os dois eventos');
      registrar('dá para marcar mais de um evento', p);
    }

    /* 7. Limpar volta ao total. */
    {
      await clicar(page, 'evento', 'ev1');
      await clicar(page, 'evento', 'ev2');
      const t = await lerTela(page);
      const p = [];
      if (t.avaliacoes !== '7') p.push('sem nenhum chip marcado a tela deveria voltar a somar tudo, mostrou ' + t.avaliacoes);
      if (erros.length) p.push('erro JS: ' + erros[0]);
      registrar('desmarcando tudo, volta ao total', p);
    }

    await ctx.close();
  }

  /* 8. O filtro NÃO cresce quando o programa cresce.
        Este é o defeito que motivou a mudança: com um chip por turma sempre
        à vista, três eventos de seis turmas empilhavam 406px de filtro no
        computador e 949px no celular — mais de uma tela inteira de chips
        antes do primeiro número. E não havia teto: cada oficina nova
        somava mais. O controle de agora tem tamanho fixo, então dobrar o
        número de turmas não pode mudar nada. */
  for (const formato of FORMATOS) {
    const seis = await abrirDashboard(browser, formato, bancoGrande(3, 6));
    const m6 = await medirFiltro(seis.page);
    await seis.ctx.close();

    const doze = await abrirDashboard(browser, formato, bancoGrande(3, 12));
    const m12 = await medirFiltro(doze.page);

    const p = [];
    const teto = formato.nome === 'celular' ? 220 : 150;
    if (m6.altura > teto) {
      p.push('com 18 turmas o filtro já ocupa ' + m6.altura + 'px (teto ' + teto + 'px)');
    }
    /* 12px de tolerância: o resumo embaixo ("Mostrando: …") pode quebrar uma
       linha a mais quando os números ficam maiores. O que não pode é o filtro
       crescer com a lista. */
    if (m12.altura > m6.altura + 12) {
      p.push('dobrar as turmas (18 → 36) fez o filtro crescer de ' + m6.altura + 'px para ' + m12.altura + 'px — volta a ser um paredão');
    }
    if (!m12.temBusca) p.push('com 36 turmas não apareceu campo de busca na lista');
    if (doze.erros.length) p.push('erro JS: ' + doze.erros[0]);

    /* A busca precisa realmente reduzir a lista. */
    const filtrou = await doze.page.evaluate(async () => {
      const filtro = document.querySelector('.dash-filtro[data-campo="turma"]');
      filtro.querySelector('.dash-filtro-btn').click();
      const busca = filtro.querySelector('.dash-filtro-busca');
      const antes = filtro.querySelectorAll('.dash-filtro-opt:not([hidden])').length;
      busca.value = 'Turma 7 do evento 2';
      busca.dispatchEvent(new Event('input', { bubbles: true }));
      const depois = Array.from(filtro.querySelectorAll('.dash-filtro-opt:not([hidden])'))
        .map((o) => o.textContent.trim());
      return { antes: antes, depois: depois };
    });
    if (filtrou.antes < 30) p.push('a lista aberta mostrou só ' + filtrou.antes + ' opções — deveria trazer as 36 turmas');
    /* Sobram a turma buscada e a opção "Todas", que nunca some: é a saída
       para desfazer o filtro. */
    if (filtrou.depois.length !== 2 || !filtrou.depois.some((t) => t.indexOf('Turma 7 do evento 2') !== -1)) {
      p.push('buscar não reduziu a lista à turma procurada (sobrou: ' + JSON.stringify(filtrou.depois) + ')');
    }
    anotaCompacto(formato.nome + ' · o filtro não cresce quando os eventos e turmas aumentam', p, falhas);
    await doze.ctx.close();
  }

  await browser.close();

  if (falhas.length) {
    console.error('\n' + falhas.length + ' falha(s):');
    falhas.forEach((f) => console.error('  - ' + f));
    process.exit(1);
  }
  console.log('\nTudo certo: o Dashboard responde por evento e por turma, nos dois formatos de tela.');
})();
