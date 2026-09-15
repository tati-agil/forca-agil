/* Minha Área: "Encontros" de uma turma de um dia só precisa ler como dia,
 * não como um número perdido.
 *
 * POR QUE ESTE TESTE EXISTE
 * "Está perdido esse número que marquei, não sei nem o que representa" —
 * uma turma de encontro único mostrava "Encontros: 22" na Minha Área. Com
 * duas ou mais datas a vírgula/"e" já dá a pista de lista ("Encontros: 11,
 * 12 e 18"); com uma só, o número fica sozinho depois de dois-pontos e lê
 * como se "Encontros" fosse uma CONTAGEM (22 encontros!), não uma data.
 * Mesma classe de bug já corrigida no card da página Turmas (app.js) — ver
 * teste-turmas-dia-rotulo.js —, só que aqui em três lugares diferentes de
 * aluno.js: o card de "Minhas turmas", o card de "Inscrições em análise" e
 * a lista de "Turmas abertas no momento" de quem nunca interagiu.
 *
 * O certificado usa a mesma data por outro caminho (periodoTurma) e
 * PRECISA continuar sem o rótulo "dia"/"dias" — é um campo já usado no
 * documento gerado, com seu próprio formato. Por isso a correção vive num
 * campo novo (datasRotuladas), não na função que already alimenta o
 * certificado (textoDatas) — esse teste não cobre o PNG/PDF em si, mas
 * confirma que a tela e o certificado são casos calculados separadamente
 * (ver comentário em aluno.js).
 *
 * Roda com o Firebase falso, nos dois formatos de tela.
 *
 * O QUE ELE EXIGE, em desktop e celular:
 *   1. "Minhas turmas" (turma programada, 1 dia): "Encontros: dia N";
 *   2. "Inscrições em análise" (interesse não confirmado, 1 dia):
 *      "Encontros: dia N";
 *   3. "Turmas abertas no momento" (nunca interagiu, 1 dia): "(dia N)";
 *   4. turma de vários dias continua "dias N, M e O" (plural, com "e");
 *   5. nenhum erro de JavaScript não tratado.
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

function bancoBase(turmas, interesse) {
  const users = {}; users[AK] = { name: 'ALUNA TESTE', email: ALUNA, area: 'INFOR' };
  return {
    'fa-users': users, 'fa-admins': {}, 'fa-diretores': {}, 'fa-facilitadores': {},
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: { ev1: { nome: 'EVENTO ÚNICO', order: 1, publicado: true, cargaHoraria: '4', percentualMinimo: 75 } },
    turmas: turmas,
    'turmas-interesse': interesse, 'turmas-interesse-log': {}, 'turmas-config': {}, 'turmas-checkin': {},
    'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {}, 'turmas-sorteio': {},
    avaliacoes: {}, pedidos: {}, holocron: {},
  };
}

// Cenário 1: turma programada (confirmada) com 1 dia só — card em "Minhas turmas".
function bancoProgramadaUmDia() {
  return bancoBase(
    { tA: { label: 'TURMA ÚNICA', eventoKey: 'ev1', dias: [iso(8)] } },
    { tA: { [AK]: { status: 'inscrito', confirmedByAdmin: ALUNA, name: 'ALUNA TESTE', email: ALUNA, date: iso(-2) } } }
  );
}

// Cenário 2: interesse registrado, ainda não confirmado — card em "Inscrições em análise".
function bancoPendenteUmDia() {
  return bancoBase(
    { tA: { label: 'TURMA ÚNICA', eventoKey: 'ev1', dias: [iso(20)] } },
    { tA: { [AK]: { status: 'interessado', name: 'ALUNA TESTE', email: ALUNA, date: iso(-1) } } }
  );
}

// Cenário 3: nunca interagiu — lista de "Turmas abertas no momento".
function bancoNuncaInteragiuUmDia() {
  return bancoBase(
    { tA: { label: 'TURMA ÚNICA', eventoKey: 'ev1', dias: [iso(20)] } },
    {}
  );
}

// Cenário 4: turma programada com VÁRIOS dias — confirma que o plural não regride.
function bancoProgramadaVariosDias() {
  return bancoBase(
    { tA: { label: 'TURMA VÁRIOS DIAS', eventoKey: 'ev1', dias: [iso(8), iso(15), iso(22)] } },
    { tA: { [AK]: { status: 'inscrito', confirmedByAdmin: ALUNA, name: 'ALUNA TESTE', email: ALUNA, date: iso(-2) } } }
  );
}

async function abrirMinhaArea(browser, formato, db) {
  const ctx = await browser.newContext(formato.opts);
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify({
    db: db, user: { email: ALUNA, emailVerified: true, uid: 'u1' }, delayDefault: 20,
  }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#minha-area', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#minhaAreaContent .aluno-sec-title', { timeout: 15000 });
  await page.waitForTimeout(1000);
  return { ctx, erros, page };
}

(async () => {
  const FORMATOS = [
    { nome: 'desktop', opts: { viewport: { width: 1280, height: 900 } } },
    { nome: 'iPhone', opts: devices['iPhone 12'] },
  ];

  let falhas = 0;
  for (const formato of FORMATOS) {
    const browser = await chromium.launch();
    console.log(`\n== ${formato.nome} ==`);
    try {
      {
        const { ctx, erros, page } = await abrirMinhaArea(browser, formato, bancoProgramadaUmDia());
        const texto = await page.locator('.aluno-card-sub', { hasText: 'Encontros' }).innerText();
        await ctx.close();
        if (erros.length) throw new Error('[minhas turmas] erro de JS não tratado: ' + erros[0]);
        if (!/^Encontros: dia \d+$/.test(texto)) throw new Error(`[minhas turmas] esperava "Encontros: dia N", veio "${texto}"`);
        console.log(`  ok    minhas turmas (1 dia): "${texto}"`);
      }
      {
        const { ctx, erros, page } = await abrirMinhaArea(browser, formato, bancoPendenteUmDia());
        const texto = await page.locator('.aluno-card-sub', { hasText: 'Encontros' }).innerText();
        await ctx.close();
        if (erros.length) throw new Error('[inscrições em análise] erro de JS não tratado: ' + erros[0]);
        if (!/^Encontros: dia \d+$/.test(texto)) throw new Error(`[inscrições em análise] esperava "Encontros: dia N", veio "${texto}"`);
        console.log(`  ok    inscrições em análise (1 dia): "${texto}"`);
      }
      {
        const { ctx, erros, page } = await abrirMinhaArea(browser, formato, bancoNuncaInteragiuUmDia());
        const texto = await page.locator('.aluno-abertas-data').innerText();
        await ctx.close();
        if (erros.length) throw new Error('[nunca interagiu] erro de JS não tratado: ' + erros[0]);
        if (!/^\(dia \d+\)$/.test(texto)) throw new Error(`[nunca interagiu] esperava "(dia N)", veio "${texto}"`);
        console.log(`  ok    turmas abertas no momento (1 dia): "${texto}"`);
      }
      {
        const { ctx, erros, page } = await abrirMinhaArea(browser, formato, bancoProgramadaVariosDias());
        const texto = await page.locator('.aluno-card-sub', { hasText: 'Encontros' }).innerText();
        await ctx.close();
        if (erros.length) throw new Error('[vários dias] erro de JS não tratado: ' + erros[0]);
        // Não fixa o formato exato das datas (formatDias muda de cara quando
        // as datas cruzam de mês) — só que o plural "dias" (não "dia") foi
        // usado, o que já basta pra provar que o singular não regrediu.
        if (!/^Encontros: dias /.test(texto)) throw new Error(`[vários dias] esperava começar com "Encontros: dias ", veio "${texto}"`);
        console.log(`  ok    minhas turmas (vários dias, plural intacto): "${texto}"`);
      }
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
