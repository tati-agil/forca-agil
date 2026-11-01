/* Turmas da Oficina: eventos atuais e futuros primeiro, depois os já
 * realizados — reorganização SÓ DE EXIBIÇÃO.
 *
 * POR QUE ESTE TESTE EXISTE
 * A página listava os eventos só pela ordem manual do painel, então um
 * evento que já tinha acontecido inteiro podia ficar acima do que está com
 * inscrição aberta. A mudança reordena na tela e nada mais: não grava, não
 * esconde, não muda a ordem gravada. O risco que este teste vigia é o pior
 * possível aqui — uma turma (e com ela as pessoas inscritas) sumir da
 * página, ou aparecer duas vezes, por causa da reordenação.
 *
 * Critério de "evento realizado" (o mesmo do card "Turma realizada",
 * turmaRealizada em app.js): o evento tem turma visível e TODAS estão
 * realizadas (encerrada pelo admin ou com o último dia já passado). Por
 * isso:
 *   - inscrição encerrada (finalizada) com data futura NÃO é antigo: vai
 *     para a parte do meio, "Próximas turmas — inscrições encerradas";
 *   - evento com uma turma realizada e outra futura NÃO é antigo;
 *   - evento sem data identificável (sem turma, só fila; ou turma sem dias)
 *     fica entre os atuais, na ordem manual;
 *   - evento com todas as turmas realizadas mas com a fila de espera ligada
 *     fica entre os atuais: a fila é uma ação aberta para a pessoa;
 *   - turma sem evento continua no grupo sem título, no fim (como sempre).
 *
 * O QUE ELE EXIGE, em 1440, 1280 e 375 px:
 *   1. a ordem dos grupos: atuais na ordem manual, o divisor "Próximas
 *      turmas — inscrições encerradas" e os de inscrições encerradas, o
 *      divisor "Eventos já realizados" e os realizados (cada parte na ordem
 *      manual), o grupo sem evento;
 *   2. TODAS as turmas do banco na tela, cada uma uma vez só, dentro do seu
 *      evento e na ordem manual dele;
 *   3. as informações de cada evento nascem abertas, com o controle
 *      "Ocultar informações"; pelo teclado (Tab até o controle + Enter) fecha
 *      e passa a "Ver informações do evento", e Enter de novo reabre; nada do
 *      conteúdo se perde;
 *   4. sem rolagem horizontal; nenhuma escrita no banco; nenhum erro de JS.
 *
 * Com `--capturar <pasta>` só registra o estado (JSON) e as capturas de
 * tela, sem exigir nada — foi assim que se tirou o "antes" na main.
 */

const { chromium } = require('playwright');
const { esperarCondicao, esperarCondicaoAte } = require('./esperas');
const fs = require('fs');
const path = require('path');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const iCap = process.argv.indexOf('--capturar');
const CAPTURA = iCap > 0 ? process.argv[iCap + 1] : '';

const ALUNA = 'aluna@previ.com.br';
const AK = chave(ALUNA);

/* Data local (não UTC): é o mesmo "hoje" do app.js. */
function dia(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

const missao = (n) => ({ missaoTitulo: 'Missão ' + n, missaoTexto: 'Texto do evento ' + n + '.', topicos: 'Tópicos ' + n + '.', itinerario: ['Dia 1'] });

function banco() {
  const users = {}; users[AK] = { name: 'ALUNA TESTE', email: ALUNA, area: 'INFOR' };
  return {
    'fa-users': users, 'fa-admins': {}, 'fa-diretores': {}, 'fa-facilitadores': {},
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: {
      evPassadoA: Object.assign({ nome: 'PASSADO A', order: 1, publicado: true, esperaAtiva: false }, missao('PA')),
      evMisto:    Object.assign({ nome: 'MISTO', order: 2, publicado: true, esperaAtiva: false }, missao('MI')),
      evLotado:   Object.assign({ nome: 'INSCRICOES ENCERRADAS', order: 3, publicado: true, esperaAtiva: false }, missao('LO')),
      evFila:     Object.assign({ nome: 'SO FILA', order: 4, publicado: true, esperaAtiva: true }, missao('FI')),
      evSemDias:  Object.assign({ nome: 'SEM DIAS', order: 5, publicado: true, esperaAtiva: false }, missao('SD')),
      evEncerrado: Object.assign({ nome: 'ENCERRADO PELO ADMIN', order: 6, publicado: true, esperaAtiva: false }, missao('EN')),
      evPassadoB: Object.assign({ nome: 'PASSADO B', order: 0, publicado: true, esperaAtiva: false }, missao('PB')),
      evFuturo:   Object.assign({ nome: 'FUTURO', order: 7, publicado: true, esperaAtiva: false }, missao('FU')),
      evPassadoFila: Object.assign({ nome: 'PASSADO COM FILA', order: 8, publicado: true, esperaAtiva: true }, missao('PF')),
    },
    turmas: {
      tPA1: { label: 'PA TURMA 1', eventoKey: 'evPassadoA', order: 1, dias: [dia(-40), dia(-39)] },
      tPA2: { label: 'PA TURMA 2', eventoKey: 'evPassadoA', order: 2, dias: [dia(-20)] },
      tMI2: { label: 'MI TURMA 2', eventoKey: 'evMisto', order: 2, dias: [dia(10), dia(11)] },
      tMI1: { label: 'MI TURMA 1', eventoKey: 'evMisto', order: 1, dias: [dia(-30)] },
      tMI3: { label: 'MI TURMA 3', eventoKey: 'evMisto', order: 3, dias: [dia(-1), dia(1)] },
      tLO1: { label: 'LO TURMA 1', eventoKey: 'evLotado', order: 1, dias: [dia(5)] },
      tSD1: { label: 'SD TURMA 1', eventoKey: 'evSemDias', order: 1, dias: [] },
      tEN1: { label: 'EN TURMA 1', eventoKey: 'evEncerrado', order: 1, dias: [dia(3)] },
      tPB1: { label: 'PB TURMA 1', eventoKey: 'evPassadoB', order: 1, dias: [dia(-60)] },
      tFU1: { label: 'FU TURMA 1', eventoKey: 'evFuturo', order: 1, dias: [dia(30)] },
      tFU2: { label: 'FU TURMA 2', eventoKey: 'evFuturo', order: 2, dias: [dia(31)] },
      tPF1: { label: 'PF TURMA 1', eventoKey: 'evPassadoFila', order: 1, dias: [dia(-10)] },
      tSolta: { label: 'TURMA SEM EVENTO', order: 1, dias: [dia(15)] },
    },
    'turmas-interesse': {}, 'turmas-interesse-log': {},
    'turmas-config': { tLO1: { finalizada: true }, tEN1: { encerrada: true } },
    'turmas-checkin': {}, 'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {}, 'turmas-sorteio': {},
    avaliacoes: {}, pedidos: {}, holocron: {},
  };
}

const ATUAIS = ['evMisto', 'evFila', 'evSemDias', 'evFuturo', 'evPassadoFila'];
const ENCERRADOS = ['evLotado'];
const REALIZADOS = ['evPassadoB', 'evPassadoA', 'evEncerrado'];
const ORDEM_GRUPOS = ATUAIS.concat(['|divisor|'], ENCERRADOS, ['|divisor|'], REALIZADOS, ['']);
const DIVISORES = ['Próximas turmas — inscrições encerradas', 'Eventos já realizados'];
const TURMAS_DO_EVENTO = {
  evPassadoA: ['PA TURMA 1', 'PA TURMA 2'], evMisto: ['MI TURMA 1', 'MI TURMA 2', 'MI TURMA 3'],
  evLotado: ['LO TURMA 1'], evFila: [], evSemDias: ['SD TURMA 1'], evEncerrado: ['EN TURMA 1'],
  evPassadoB: ['PB TURMA 1'], evFuturo: ['FU TURMA 1', 'FU TURMA 2'], evPassadoFila: ['PF TURMA 1'], '': ['TURMA SEM EVENTO'],
};

/* O que está na tela: grupos na ordem, turmas de cada grupo na ordem, e o
   estado do bloco de informações de cada evento. */
async function estado(page) {
  return page.evaluate(() => {
    const host = document.querySelector('.turmas-eventos');
    const grupos = [];
    Array.from(host.children).forEach((el) => {
      if (el.classList.contains('turmas-periodo-divisor')) { grupos.push({ key: '|divisor|', texto: el.textContent.trim() }); return; }
      if (!el.classList.contains('turmas-evento-grupo')) return;
      const det = el.querySelector('.turmas-missao');
      grupos.push({
        key: el.getAttribute('data-evento-key'),
        periodo: el.getAttribute('data-evento-periodo') || '',
        turmas: Array.from(el.querySelectorAll('.turmas-grid > .turma-card-new:not(.turma-card-espera) .tc-label')).map((x) => x.textContent.trim()),
        chaves: Array.from(el.querySelectorAll('.turmas-grid > .turma-card-new[data-turma-key]')).map((x) => x.getAttribute('data-turma-key')),
        espera: !!el.querySelector('.turma-card-espera'),
        infoAberta: det ? det.hasAttribute('open') : null,
        controle: det ? (det.querySelector('.turmas-missao-acao') || {}).textContent || '' : null,
        textoInfo: det ? det.textContent.replace(/\s+/g, ' ').trim() : '',
      });
    });
    return {
      grupos,
      larguraExcede: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      escritas: (window.__ESCRITAS || []).map((e) => e.path),
    };
  });
}

async function abrir(browser, viewport, mobile) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: !!mobile, hasTouch: !!mobile });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify({
    db: banco(), user: { email: ALUNA, emailVerified: true, uid: 'u1' }, delayDefault: 20,
  }) + ';');
  /* conta os redesenhos da grade: com o login assentando, mais de um evento de perfil pinta a página de novo (duas vezes
     em poucos ms) — o teclado só pode ser provado depois que ela parou, senão um redesenho reabre o que o Enter fechou */
  await page.addInitScript(() => {
    window.__redesenhos = 0;
    document.addEventListener('DOMContentLoaded', () => {
      const h = document.querySelector('.turmas-eventos');
      if (h) new MutationObserver(() => { window.__redesenhos++; }).observe(h, { childList: true });
    });
  });
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#turmas', { waitUntil: 'domcontentloaded' });
  /* a grade e os blocos de informação dos 9 eventos desenhados */
  await esperarCondicao(page, () => document.querySelectorAll('.turmas-evento-grupo .turmas-missao').length === 9 &&
    !!document.querySelector('.turma-card-espera'), null, { limite: 15000, descricao: 'grade de turmas com as informações dos 9 eventos' });
  /* a grade parou de ser redesenhada: nenhum redesenho novo em 1,5 s */
  for (let i = 0; i < 10; i++) {
    const n = await page.evaluate(() => window.__redesenhos);
    if (!(await esperarCondicaoAte(page, (m) => window.__redesenhos > m, n, { limite: 1500 }))) break;
  }
  return { ctx, page, erros };
}

function igual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

(async () => {
  const FORMATOS = [
    { nome: '1440', viewport: { width: 1440, height: 900 } },
    { nome: '1280', viewport: { width: 1280, height: 800 } },
    { nome: '375', viewport: { width: 375, height: 812 }, mobile: true },
  ];
  const browser = await chromium.launch();
  let falhas = 0;
  const falha = (f, m) => { falhas++; console.error('  FALHA [' + f + ']: ' + m); };

  for (const f of FORMATOS) {
    console.log('\n== ' + f.nome + ' px ==');
    const { ctx, page, erros } = await abrir(browser, f.viewport, f.mobile);
    try {
      const e1 = await estado(page);
      if (CAPTURA) {
        fs.mkdirSync(CAPTURA, { recursive: true });
        fs.writeFileSync(path.join(CAPTURA, 'estado-' + f.nome + '.json'), JSON.stringify(e1, null, 2));
        await page.locator('.turmas-eventos').screenshot({ path: path.join(CAPTURA, 'turmas-' + f.nome + '.png') });
        console.log('  capturado: ' + e1.grupos.map((g) => g.key || '(sem evento)').join(' → '));
        continue;
      }

      // 1. ordem dos grupos
      const ordem = e1.grupos.map((g) => g.key);
      if (!igual(ordem, ORDEM_GRUPOS)) falha(f.nome, 'ordem dos grupos ' + JSON.stringify(ordem) + ', esperava ' + JSON.stringify(ORDEM_GRUPOS));
      else console.log('  ok    atuais → divisor → inscrições encerradas → divisor → realizados (cada parte na ordem manual) → sem evento');
      const divs = e1.grupos.filter((g) => g.key === '|divisor|').map((g) => g.texto);
      if (!igual(divs, DIVISORES)) falha(f.nome, 'divisores ausentes ou com outro texto: ' + JSON.stringify(divs));
      const periodos = e1.grupos.filter((g) => g.key && g.key !== '|divisor|');
      const periodoErrado = periodos.filter((g) => g.periodo !== (REALIZADOS.indexOf(g.key) >= 0 ? 'realizado' : ENCERRADOS.indexOf(g.key) >= 0 ? 'encerrado' : 'atual'));
      if (periodoErrado.length) falha(f.nome, 'data-evento-periodo errado em ' + periodoErrado.map((g) => g.key + '=' + g.periodo).join(', '));

      // 2. todas as turmas, uma vez só, no seu evento e na ordem manual
      const todasNaTela = [].concat.apply([], e1.grupos.filter((g) => g.chaves).map((g) => g.chaves));
      const doBanco = Object.keys(banco().turmas).sort();
      const naTela = todasNaTela.slice().sort();
      if (!igual(naTela, doBanco)) falha(f.nome, 'turmas na tela ' + JSON.stringify(naTela) + ' ≠ banco ' + JSON.stringify(doBanco));
      else console.log('  ok    ' + doBanco.length + ' turmas do banco na tela, cada uma uma vez só');
      const foraDeOrdem = e1.grupos.filter((g) => g.turmas && TURMAS_DO_EVENTO[g.key] && !igual(g.turmas, TURMAS_DO_EVENTO[g.key]));
      if (foraDeOrdem.length) falha(f.nome, 'turmas fora do evento ou da ordem manual: ' + foraDeOrdem.map((g) => g.key + '=' + JSON.stringify(g.turmas)).join('; '));
      else console.log('  ok    cada turma no seu evento, na ordem manual');
      const fila = e1.grupos.find((g) => g.key === 'evFila');
      if (!fila || !fila.espera) falha(f.nome, 'evento só com fila perdeu o card de espera');

      // 3. informações abertas + controle acessível pelo teclado
      const comInfo = e1.grupos.filter((g) => typeof g.infoAberta === 'boolean');
      const fechadas = comInfo.filter((g) => !g.infoAberta || g.controle !== 'Ocultar informações');
      if (comInfo.length !== 9 || fechadas.length) falha(f.nome, 'informações não nasceram abertas com "Ocultar informações": ' + JSON.stringify(comInfo.map((g) => [g.key, g.infoAberta, g.controle])));
      else console.log('  ok    as 9 informações de evento nascem abertas, controle "Ocultar informações"');
      const semTexto = comInfo.filter((g) => g.textoInfo.indexOf('Texto do evento ') < 0 || g.textoInfo.indexOf('Tópicos ') < 0);
      if (semTexto.length) falha(f.nome, 'conteúdo do evento faltando em ' + semTexto.map((g) => g.key).join(', '));

      const sum = page.locator('.turmas-evento-grupo[data-evento-key="evFuturo"] .turmas-missao-summary');
      await sum.focus();
      const focado = await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('turmas-missao-summary'));
      await page.keyboard.press('Enter');
      await esperarCondicao(page, () => { const d = document.querySelector('.turmas-evento-grupo[data-evento-key="evFuturo"] .turmas-missao'); return !d.hasAttribute('open') && d.querySelector('.turmas-missao-acao').textContent !== 'Ocultar informações'; }, null, { descricao: 'Enter recolher o evento e trocar o controle' });
      const fechou = await page.evaluate(() => {
        const d = document.querySelector('.turmas-evento-grupo[data-evento-key="evFuturo"] .turmas-missao');
        return { aberto: d.hasAttribute('open'), controle: d.querySelector('.turmas-missao-acao').textContent, outros: Array.from(document.querySelectorAll('.turmas-missao')).filter((x) => x !== d && !x.hasAttribute('open')).length };
      });
      await page.keyboard.press('Enter');
      await esperarCondicao(page, () => { const d = document.querySelector('.turmas-evento-grupo[data-evento-key="evFuturo"] .turmas-missao'); return d.hasAttribute('open') && d.querySelector('.turmas-missao-acao').textContent !== 'Ver informações do evento'; }, null, { descricao: 'Enter reabrir o evento e trocar o controle' });
      const reabriu = await page.evaluate(() => {
        const d = document.querySelector('.turmas-evento-grupo[data-evento-key="evFuturo"] .turmas-missao');
        return { aberto: d.hasAttribute('open'), controle: d.querySelector('.turmas-missao-acao').textContent };
      });
      if (!focado || fechou.aberto || fechou.controle !== 'Ver informações do evento' || fechou.outros !== 0) falha(f.nome, 'teclado: Enter não recolheu só este evento: ' + JSON.stringify({ focado, fechou }));
      else if (!reabriu.aberto || reabriu.controle !== 'Ocultar informações') falha(f.nome, 'teclado: Enter não reabriu: ' + JSON.stringify(reabriu));
      else console.log('  ok    teclado: Enter recolhe ("Ver informações do evento") e reabre ("Ocultar informações"), só aquele evento');

      // 4. sem rolagem horizontal, sem escrita, sem erro
      if (e1.larguraExcede) falha(f.nome, 'rolagem horizontal na página');
      const escritasTurmas = e1.escritas.filter((p) => /^\/?(eventos|turmas)/.test(p));
      if (escritasTurmas.length) falha(f.nome, 'a página gravou em ' + escritasTurmas.join(', '));
      if (erros.length) falha(f.nome, 'erro de JS: ' + erros[0]);
      if (!e1.larguraExcede && !escritasTurmas.length && !erros.length) console.log('  ok    sem rolagem horizontal, sem escrita em eventos/turmas, sem erro de JS');
    } finally {
      await ctx.close();
    }
  }
  await browser.close();
  if (CAPTURA) { console.log('\nCapturas em ' + CAPTURA); return; }
  if (falhas) { console.error('\n' + falhas + ' falha(s).'); process.exit(1); }
  console.log('\nTUDO OK.');
})();
