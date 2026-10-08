/* Adequação à Squad — concluir pela tela usa o motor certo, na versão certa.
 *
 * O teste-motor-squad-256.js prova o motor puro nas 256 combinações; este
 * prova o caminho de verdade: responder S1–S8 na tela, tocar em "CONCLUIR
 * AVALIAÇÃO" e conferir o que foi GRAVADO (códigos dos eixos, indicação e
 * motorSquadVersion) e o que a tela mostra.
 *   1. Uma combinação representativa de cada resultado, C1 a C5, com as
 *      regras de fábrica (nada publicado no banco → versão 1 de verdade).
 *   2. Versão publicada 2 (com C2 e C3 trocados, uma regra válida e
 *      diferente da de fábrica): a avaliação sai pela versão 2, nunca pela 1.
 *   3. Regras atrasadas (celular, 375 px): enquanto a leitura de
 *      motor-squad-config não volta, "Concluir" fica bloqueado e avisa que
 *      está carregando; nada é gravado. Quando a leitura chega, conclui pela
 *      versão 2 — "ainda não sei" nunca vira "vale a versão 1".
 *   4. Leitura das regras recusada: avisa o erro, oferece "Tentar novamente"
 *      e, quando a nova tentativa funciona, conclui pela versão publicada.
 *   5. Trava de publicação no ADMIN: uma troca de SIM/NÃO que deixa
 *      combinações sem resultado mostra quais são e não deixa publicar.
 * A largura (desktop × celular) já é coberta pelos testes de tela do Squad;
 * aqui o celular entra só no cenário de rede lenta, que é o uso real.
 * Hermético: Firebase falso, sem rede, sem segredo. */
const { chromium } = require('playwright');
const { esperarSessaoAssentada, esperarCondicao, esperarAusencia } = require('./esperas');
const fs = require('fs');
const path = require('path');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
/* Portão SÓ deste teste (o arquivo do falso não muda): com __CFG.segurarMotor,
   o ouvinte de motor-squad-config fica parado até o teste chamar
   __portaoMotor.soltar() — a leitura "que ainda não voltou", sem depender de
   tempo. A rota serve este corpo para os 3 scripts do Firebase; o embrulho é
   reaplicado a cada carga e o estado (G) fica em window. */
const PORTAO = String.raw`
(function () {
  var G = window.__portaoMotor = window.__portaoMotor || { fila: [], pedidos: 0 };
  var db0 = firebase.database;
  firebase.database = function () {
    var d = db0(), ref0 = d.ref;
    d.ref = function (p) {
      var r = ref0.apply(d, arguments);
      if (String(p || '') === 'motor-squad-config') {
        var on0 = r.on.bind(r);
        r.on = function (evt, ok, err) {
          G.pedidos++;
          if (window.__CFG.segurarMotor) { G.fila.push(function () { on0(evt, ok, err); }); return ok; }
          return on0(evt, ok, err);
        };
      }
      return r;
    };
    return d;
  };
  firebase.database.ServerValue = db0.ServerValue;
  G.soltar = function () { var f = G.fila.splice(0); f.forEach(function (x) { x(); }); return f.length; };
})();`;
const EMAIL = 'adm@previ.com.br';
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const DESKTOP = { width: 1280, height: 900 };
const CELULAR = { width: 375, height: 800 };
const PERGUNTAS = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'];

let falhas = 0;
function afirma(cond, msg) { console.log((cond ? '  ok    ' : '  FALHA ') + msg); if (!cond) falhas++; }

/* Regras de fábrica, lidas do próprio motor-squad.js (vm), para montar a
   versão 2 sem copiar regra nenhuma à mão. */
const vm = require('vm');
const ctxMotor = { window: {}, console: { error() {} }, firebase: {}, Date };
vm.createContext(ctxMotor);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'forca-agil', 'motor-squad.js'), 'utf8'), ctxMotor);
const FABRICA = JSON.parse(JSON.stringify(ctxMotor.window.faMotorSquad.PADRAO_REGRAS));
const TEXTOS = ctxMotor.window.faMotorSquad.PADRAO_TEXTOS;
/* Versão 2: C2 e C3 com os resultados trocados — completa (passa na trava),
   mas com resultado diferente da de fábrica para A demonstrada + B parcial. */
const V2 = JSON.parse(JSON.stringify(FABRICA));
const c2 = V2.combinacao.find((r) => r.codigo === 'C2'), c3 = V2.combinacao.find((r) => r.codigo === 'C3');
[c2.resultado, c3.resultado] = [c3.resultado, c2.resultado];
if (!ctxMotor.window.faMotorSquad.validarRegrasCompletas(V2).valida) throw new Error('a versão 2 do teste precisa ser válida');
const CONFIG_V2 = { versaoPublicada: 2, versoes: { 2: { regras: V2, publicadoEm: '2026-09-01T10:00:00.000Z', publicadoPor: { email: EMAIL } } } };

/* onde: 'avaliacao' (padrão) — a avaliação de Squad, na área AVALIAÇÃO; 'motor' — ADMIN ›
   Arquitetura › Motor de Squad (governança, onde ficou a configuração do motor). */
async function abrir(browser, viewport, motorConfig, extraCfg, onde) {
  const admins = {}; admins[chave(EMAIL)] = { email: EMAIL };
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': admins, 'turmas-config': {}, 'turmas-checkin': {}, 'turmas-espera': {},
    'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {}, eventos: {}, 'turmas-publico': {}, 'eventos-publico': {},
    'avaliacoes-produto': {}, 'avaliacoes-squad': {}, 'motor-squad-config': motorConfig || {}, 'motor-squad-auditoria': {},
    'motor-arquitetura-config': {}, 'motor-arquitetura-auditoria': {}, 'fa-avaliacao-acessos': {} };
  const cfg = Object.assign({ db: db, user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true }, extraCfg || {});
  const ctx = await browser.newContext({ viewport: viewport });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO + '\n' + PORTAO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  if (onde === 'motor') {
    await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
    await esperarSessaoAssentada(page);
    await page.waitForSelector('.admin-tab-btn[data-panel="adminPanelArquitetura"]', { timeout: 8000 });
    await page.click('.admin-tab-btn[data-panel="adminPanelArquitetura"]');
    await page.waitForSelector('#avpMotorSquadInicioBtn', { timeout: 8000 });
    await page.click('#avpMotorSquadInicioBtn');
    await page.waitForSelector('#adminAvaliacaoSquad #sqMotorEditarRegrasBtn', { timeout: 8000 });
    return { ctx, page, erros };
  }
  await page.goto(BASE + '/index.html#avaliacoes', { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  await page.waitForSelector('#avpSquadBtn', { timeout: 8000 });
  await page.click('#avpSquadBtn');
  await page.waitForSelector('#avaliacoesSquad #sqNovaBtn', { timeout: 8000 });
  return { ctx, page, erros };
}

/* Novo item + as 8 respostas ("SSNSSSSS" = S1..S8, S = SIM, N = NÃO). */
async function responder(page, nome, combinacao) {
  await page.click('#sqNovaBtn');
  await page.waitForSelector('#sqfEscolhaNovo');
  await page.click('#sqfEscolhaNovo');
  await page.waitForSelector('#sqfNovoItemNome');
  await page.fill('#sqfNovoItemNome', nome);
  await page.click('#sqfNovoItemConfirmar');
  await page.waitForSelector('.avp-question', { timeout: 8000 });
  for (let i = 0; i < 8; i++) {
    const valor = combinacao[i] === 'S' ? 'sim' : 'nao';
    await page.click('.sq-choice-group[data-codigo="' + PERGUNTAS[i] + '"] .sq-choice-btn[data-valor="' + valor + '"]');
  }
  await esperarCondicao(page, () => /8 de 8 perguntas respondidas/.test(document.body.textContent || ''), null, { descricao: 'as 8 perguntas respondidas' });
}
async function concluir(page) {
  await page.click('#sqConcluirBtn');
  await page.waitForSelector('#sqFlashResultado', { timeout: 8000 });
}
async function gravada(page, nome) {
  return page.evaluate((n) => firebase.database().ref('avaliacoes-squad').once('value').then((s) => {
    const v = s.val() || {};
    return Object.keys(v).map((k) => v[k]).filter((a) => a.itemNome === n)[0] || null;
  }), nome);
}
async function voltarLista(page) {
  await page.click('#sqVoltarListaRodape');
  await page.waitForSelector('#sqNovaBtn', { timeout: 8000 });
}
const CODIGOS_C = ['FORTE_ADERENCIA_SQUAD_DEDICADA', 'JUSTIFICA_CAPACIDADE_COM_CONDICOES_A_DESENVOLVER',
  'JUSTIFICA_CAPACIDADE_MAS_AUTONOMIA_PRECISA_SER_TRATADA', 'AVALIAR_MODELO_GESTAO_ANTES_DE_SQUAD_EXCLUSIVA', 'NECESSIDADE_SQUAD_DEDICADA_NAO_DEMONSTRADA'];

(async () => {
  const browser = await chromium.launch();

  console.log('\n######## 1. C1–C5 pela tela, regras de fábrica (nada publicado) ########');
  {
    const { ctx, page, erros } = await abrir(browser, DESKTOP, {});
    const casos = [
      { c: 'C1', comb: 'SSSSSSSS', A: 'DEMONSTRADA', B: 'PRESENTES' },
      { c: 'C2', comb: 'SSNSSSSS', A: 'DEMONSTRADA', B: 'PARCIAIS' },
      { c: 'C3', comb: 'SSSSSSNS', A: 'DEMONSTRADA', B: 'LIMITADAS_PELA_AUTONOMIA' },
      { c: 'C4', comb: 'SSSNSSSS', A: 'PARCIALMENTE_DEMONSTRADA', B: 'PRESENTES' },
      { c: 'C5', comb: 'NSSSSSSS', A: 'NAO_DEMONSTRADA', B: 'PRESENTES' }
    ];
    for (const caso of casos) {
      const nome = 'Item ' + caso.c;
      await responder(page, nome, caso.comb);
      await concluir(page);
      const g = await gravada(page, nome);
      const C = CODIGOS_C[Number(caso.c[1]) - 1];
      afirma(g && g.status === 'concluido' && g.necessidadeCapacidadeDedicada === caso.A && g.condicoesParaSquad === caso.B && g.indicacaoOrganizacional === C,
        caso.c + ' (' + caso.comb + '): gravou ' + (g ? g.necessidadeCapacidadeDedicada + ' + ' + g.condicoesParaSquad + ' → ' + g.indicacaoOrganizacional : 'nada'));
      afirma(g && g.motorSquadVersion === 1, caso.c + ': versão 1 (nada publicado no banco — versão 1 de fábrica legítima)');
      const tela = await page.locator('.sq-veredito').innerText();
      afirma(tela.includes(TEXTOS[C].rotulo) && tela.includes(TEXTOS[caso.A].rotulo) && tela.includes(TEXTOS[caso.B].rotulo),
        caso.c + ': a tela mostra "' + TEXTOS[C].rotulo + '"');
      if (caso.c === 'C1') afirma(/Recomendação de gestão por Squad/i.test(tela) && !/Indicação organizacional/i.test(tela),
        'o título do resultado é "Recomendação de gestão por Squad" (o campo gravado continua indicacaoOrganizacional)');
      await voltarLista(page);
    }
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  console.log('\n######## 2. Versão publicada 2 ########');
  {
    const { ctx, page, erros } = await abrir(browser, DESKTOP, CONFIG_V2);
    await responder(page, 'Item V2', 'SSNSSSSS'); /* C2 na fábrica; C3 na versão 2 */
    await concluir(page);
    const g = await gravada(page, 'Item V2');
    afirma(g && g.motorSquadVersion === 2, 'concluiu pela versão publicada 2 (' + (g && g.motorSquadVersion) + ')');
    afirma(g && g.indicacaoOrganizacional === 'JUSTIFICA_CAPACIDADE_MAS_AUTONOMIA_PRECISA_SER_TRATADA',
      'com o resultado da versão 2, não o da fábrica (' + (g && g.indicacaoOrganizacional) + ')');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  console.log('\n######## 3. Regras atrasadas — celular 375 px ########');
  {
    const { ctx, page, erros } = await abrir(browser, CELULAR, CONFIG_V2, { segurarMotor: true });
    afirma(await page.evaluate(() => window.__portaoMotor.fila.length) === 1, 'a leitura de motor-squad-config foi pedida e está parada no portão');
    afirma(await page.evaluate(() => window.faMotorSquad.estadoCarga()) === 'carregando', 'o motor sabe que ainda não sabe (carregando)');
    await responder(page, 'Item Lento', 'SSNSSSSS');
    const botao = page.locator('#sqConcluirBtn');
    afirma(await botao.isDisabled() && /CARREGANDO REGRAS/.test(await botao.innerText()), '"Concluir" bloqueado, dizendo CARREGANDO REGRAS…');
    afirma(await page.locator('#sqMotorCarga').count() === 1 && /Carregando as regras do motor de squad/.test(await page.locator('#sqMotorCarga').innerText()), 'aviso de carregamento no lugar da conclusão');
    await botao.click({ force: true }); /* clique "por baixo" do disabled: nada pode acontecer */
    await esperarAusencia(page, '#sqFlashResultado', { janela: 1000, motivo: 'concluir grava e troca de tela em ~10 ms no falso; 1 s sem a tela de resultado prova que o clique não concluiu' });
    afirma(await gravada(page, 'Item Lento') === null, 'nada foi gravado enquanto as regras não chegaram');
    if (await page.locator('#sqFlashResultado').count()) { console.log('  (a avaliação foi concluída antes das regras chegarem — o resto do cenário não se aplica)'); await ctx.close(); }
    else {
    afirma(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'sem rolagem horizontal no celular com o aviso');
    await page.evaluate(() => window.__portaoMotor.soltar());
    await esperarCondicao(page, () => { const b = document.getElementById('sqConcluirBtn'); return b && !b.disabled; }, null, { descricao: '"Concluir" liberado quando as regras chegam' });
    afirma(await page.locator('#sqMotorCarga').count() === 0, 'o aviso some quando as regras chegam');
    await concluir(page);
    const g = await gravada(page, 'Item Lento');
    afirma(g && g.motorSquadVersion === 2 && g.indicacaoOrganizacional === 'JUSTIFICA_CAPACIDADE_MAS_AUTONOMIA_PRECISA_SER_TRATADA',
      'concluiu pela versão 2 que chegou atrasada — nunca pela 1 (' + (g && g.motorSquadVersion) + ', ' + (g && g.indicacaoOrganizacional) + ')');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
    }
  }

  console.log('\n######## 4. Leitura das regras recusada → Tentar novamente ########');
  {
    const { ctx, page, erros } = await abrir(browser, DESKTOP, CONFIG_V2, { fail: ['motor-squad-config'] });
    await responder(page, 'Item Erro', 'SSNSSSSS');
    await esperarCondicao(page, () => { const el = document.getElementById('sqMotorCarga'); return el && el.dataset.estado === 'erro'; }, null, { descricao: 'o aviso de erro na leitura das regras' });
    afirma(/Não foi possível carregar as regras/.test(await page.locator('#sqMotorCarga').innerText()) && await page.locator('#sqMotorRecarregarBtn').count() === 1,
      'diz que não conseguiu carregar e oferece TENTAR NOVAMENTE');
    afirma(await page.locator('#sqConcluirBtn').isDisabled(), '"Concluir" bloqueado com a leitura recusada');
    afirma(await page.evaluate(() => document.querySelectorAll('.sq-choice-btn.active').length) === 8, 'as respostas continuam marcadas');
    await page.evaluate(() => { window.__CFG.fail = []; });
    await page.click('#sqMotorRecarregarBtn');
    await esperarCondicao(page, () => { const b = document.getElementById('sqConcluirBtn'); return b && !b.disabled; }, null, { descricao: '"Concluir" liberado depois de tentar de novo' });
    await concluir(page);
    const g = await gravada(page, 'Item Erro');
    afirma(g && g.motorSquadVersion === 2, 'depois de tentar de novo, concluiu pela versão 2 (' + (g && g.motorSquadVersion) + ')');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  console.log('\n######## 5. ADMIN: publicação de regras com buraco é bloqueada ########');
  {
    const { ctx, page, erros } = await abrir(browser, DESKTOP, {}, null, 'motor');
    await page.click('#sqMotorEditarRegrasBtn');
    await page.waitForSelector('.sq-cond-select');
    /* B1 é a 11ª condição sobre S1–S8 (A1: 4, A2: 4, A3: 2) — S7 = NÃO vira SIM */
    const b1 = page.locator('.sq-cond-select').nth(10);
    afirma(await b1.inputValue() === 'NAO', 'a condição de B1 (S7) está em NÃO');
    await b1.selectOption('SIM');
    await page.click('#sqMotorSimularBtn');
    await page.waitForSelector('#sqMotorConfirmarPublicarBtn', { timeout: 8000 });
    const aviso = await page.locator('#sqMotorValidacao').count() ? await page.locator('#sqMotorValidacao').innerText() : '';
    afirma(/não podem ser publicadas/.test(aviso) && /128 das 256/.test(aviso), 'diz que não pode publicar: 128 das 256 combinações sem resultado');
    afirma(/S7 NÃO/.test(aviso) && /sem resultado em:/.test(aviso), 'mostra exemplos das respostas que ficaram sem resultado');
    afirma(await page.locator('#sqMotorConfirmarPublicarBtn').isDisabled(), '"CONFIRMAR PUBLICAÇÃO" bloqueado');
    const cfgDepois = await page.evaluate(() => firebase.database().ref('motor-squad-config').once('value').then((s) => s.val()));
    afirma(!cfgDepois || !cfgDepois.versaoPublicada, 'nenhuma versão nova foi publicada');
    const recusa = await page.evaluate(() => new Promise((ok) => {
      const r = window.faMotorSquad.iniciarOuObterRascunhoRegras();
      r.eixoB[0].condicoes.all[0].valor = 'SIM';
      window.faMotorSquad.publicarRegras(r, { email: 'adm@previ.com.br' }, (err, info) => ok({ err, n: info && info.invalidas.length }), 1);
    }));
    afirma(recusa.err === 'regras-invalidas' && recusa.n === 128, 'chamada direta a publicarRegras também é recusada (' + recusa.err + ', ' + recusa.n + ')');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  await browser.close();
  console.log('\n============================\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
