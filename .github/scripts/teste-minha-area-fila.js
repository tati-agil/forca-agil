/* Minha Área: contagem de turmas por fase e lista de espera por evento.
 *
 * POR QUE ESTE TESTE EXISTE
 * Dois defeitos relatados juntos, olhando a mesma tela:
 *
 *   1. O número ao lado de "Em andamento"/"Programadas"/"Concluídas" saía
 *      solto — só o dígito, sem "turma(s)" — parecendo uma métrica qualquer
 *      em vez da contagem de cartões daquele grupo.
 *
 *   2. "Lista de espera" mostrava um único cartão genérico ("Você está na
 *      lista de espera"), sem dizer de QUAL evento. Pior: fa-espera guarda
 *      uma entrada por ORIGEM (uma por evento em que a pessoa entrou na
 *      fila), e a tela só lia a mais antiga — quem espera por dois eventos
 *      via só um cartão, sem saber nem que o segundo existia.
 *
 * Roda com o Firebase falso, nos dois formatos de tela. O banco tem uma
 * pessoa com uma turma em cada fase (andamento/programada/concluída) e DUAS
 * entradas ativas de lista de espera, em eventos diferentes — se a tela
 * voltar a mostrar só uma, ou sem nome de evento, o teste acusa.
 *
 * O QUE ELE EXIGE, em desktop e celular:
 *   1. cada grupo de turmas mostra "N turma"/"N turmas" por extenso, nunca
 *      o número sozinho;
 *   2. aparecem DOIS cartões de lista de espera, um por evento;
 *   3. cada cartão de espera traz o NOME do evento daquela fila, não um
 *      título genérico;
 *   4. nenhum erro de JavaScript não tratado.
 */

const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

const ALUNA = 'aluna@previ.com.br';
const AK = chave(ALUNA);

function iso(offsetDias) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  return d.toISOString().slice(0, 10);
}

const EV_DIRETORES = 'FORÇA ÁGIL · DIRETORES';
const EV_GESTORES  = 'FORÇA ÁGIL · GESTORES';

function banco() {
  const users = {}; users[AK] = { name: 'ALUNA TESTE', email: ALUNA, area: 'INFOR' };
  return {
    'fa-users': users, 'fa-admins': {}, 'fa-diretores': {}, 'fa-facilitadores': {},
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {},
    'fa-espera': {
      [AK]: {
        'lista:ev3': { name: 'ALUNA TESTE', email: ALUNA, area: 'INFOR', date: iso(-10), removed: false, eventoKey: 'ev3' },
        'lista:ev4': { name: 'ALUNA TESTE', email: ALUNA, area: 'INFOR', date: iso(-3),  removed: false, eventoKey: 'ev4' },
      },
    },
    eventos: {
      ev1: { nome: 'JORNADA DE IMERSÃO', order: 1, publicado: true, cargaHoraria: '16', percentualMinimo: 75 },
      ev2: { nome: 'OFICINA DE AGILIDADE', order: 2, publicado: true, cargaHoraria: '8', percentualMinimo: 75 },
      ev3: { nome: EV_DIRETORES, order: 3, publicado: true, cargaHoraria: '8' },
      ev4: { nome: EV_GESTORES,  order: 4, publicado: true, cargaHoraria: '8' },
    },
    turmas: {
      tA: { label: 'TURMA A — EM ANDAMENTO', eventoKey: 'ev1', dias: [iso(-5), iso(-2), iso(2), iso(5)] },
      tB: { label: 'TURMA B — CONCLUÍDA', eventoKey: 'ev1', dias: [iso(-30), iso(-25), iso(-20)] },
      tC: { label: 'TURMA C — PROGRAMADA', eventoKey: 'ev2', dias: [iso(10), iso(15), iso(20)] },
    },
    'turmas-interesse': {
      tA: { [AK]: { status: 'inscrito', confirmedByAdmin: ALUNA, name: 'ALUNA TESTE', email: ALUNA, date: iso(-8) } },
      tB: { [AK]: { status: 'inscrito', confirmedByAdmin: ALUNA, name: 'ALUNA TESTE', email: ALUNA, date: iso(-35) } },
      tC: { [AK]: { status: 'inscrito', confirmedByAdmin: ALUNA, name: 'ALUNA TESTE', email: ALUNA, date: iso(-1) } },
    },
    'turmas-interesse-log': {},
    'turmas-config': { tB: { encerrada: true, dataConclusao: iso(-19) } },
    'turmas-checkin': {
      tA: { [iso(-5)]: { [AK]: true }, [iso(-2)]: { [AK]: true } },
      tB: { [iso(-30)]: { [AK]: true }, [iso(-25)]: { [AK]: true }, [iso(-20)]: { [AK]: true } },
    },
    'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {}, 'turmas-sorteio': {},
    avaliacoes: {}, pedidos: {}, holocron: {},
  };
}

async function abrirMinhaArea(browser, formato) {
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
  await page.goto(BASE + '/index.html#minha-area', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#minhaAreaContent .aluno-sec-title', { timeout: 15000 });
  await page.waitForTimeout(500);
  return { ctx, page, erros };
}

(async () => {
  const FORMATOS = [
    { nome: 'desktop', opts: { viewport: { width: 1280, height: 900 } } },
    { nome: 'iPhone', opts: devices['iPhone 12'] },
  ];

  let falhas = 0;
  for (const formato of FORMATOS) {
    const browser = await chromium.launch();
    try {
      console.log(`\n== ${formato.nome} ==`);
      const { ctx, page, erros } = await abrirMinhaArea(browser, formato);

      // 1. Contagem por fase escrita por extenso, nunca o número sozinho.
      const qtds = await page.locator('.aluno-grupo-qtd').allInnerTexts();
      if (!qtds.length) throw new Error('nenhum selo de contagem de turmas encontrado');
      qtds.forEach((t) => {
        if (!/turma/i.test(t)) throw new Error(`selo de contagem sem "turma" por extenso: ${JSON.stringify(t)}`);
      });
      console.log(`  ok    contagens por fase escritas por extenso: ${qtds.join(' · ')}`);

      // 2. Dois cartões de lista de espera, um por evento.
      const secao = page.locator('h3.aluno-sec-title', { hasText: 'Lista de espera' });
      if (await secao.count() !== 1) throw new Error('seção "Lista de espera" não encontrada (ou duplicada)');
      const cartoes = page.locator('.aluno-card-title').filter({ hasText: /FORÇA ÁGIL/ });
      const titulos = await cartoes.allInnerTexts();
      if (titulos.length !== 2) throw new Error(`esperava 2 cartões de espera (um por evento), achei ${titulos.length}: ${JSON.stringify(titulos)}`);
      if (!titulos.includes(EV_DIRETORES) || !titulos.includes(EV_GESTORES)) {
        throw new Error(`cartões de espera não trazem o nome dos dois eventos esperados: ${JSON.stringify(titulos)}`);
      }
      console.log(`  ok    lista de espera mostra um cartão por evento: ${titulos.join(' · ')}`);

      if (erros.length) throw new Error('erro de JS não tratado: ' + erros[0]);
      console.log('  ok    nenhum erro de JavaScript');

      await ctx.close();
    } catch (e) {
      falhas++;
      console.error(`  FALHA [${formato.nome}]: ${e.message}`);
    } finally {
      await browser.close();
    }
  }

  if (falhas) { console.error(`\n${falhas} falha(s).`); process.exit(1); }
  console.log('\nTudo certo nos dois formatos.');
})();
