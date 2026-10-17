/* ADMIN › Avaliações e Mapa › Configuração das Avaliações: um grupo por tipo de avaliação, cada um com o seu
 * Questionário e o seu Motor (e nenhuma tela intermediária repetindo as três opções):
 *   - três grupos — Produto/Serviço (P1–P16), Posicionamento Organizacional (O1–O9), Adequação à Gestão por Squad
 *     (S1–S8) — com nome, sigla, descrição curta e dois acessos (Questionário | Motor);
 *   - os seis acessos abrem direto a tela certa: o Questionário mostra só o questionário daquela avaliação (o mesmo
 *     cadastro central, window.faQuestionarios — nada duplicado), o Motor só o motor dela;
 *   - ida e volta: "← Voltar" e Voltar/Avançar do navegador devolvem ao Início com o grupo aberto; link direto / F5
 *     em cada um dos seis endereços abre a mesma tela;
 *   - perfis: admin geral e Avaliação + Configuração veem os seis acessos;
 *   - legibilidade: título das seções sem a fonte de cartaz (Anton) em negrito sintético; textos ≥ 14 px; 375 px sem
 *     rolagem lateral e alvos de toque ≥ 44 px.
 * Firebase falso em persistência real; hermético; nada é gravado. Desktop e 375 px. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarCondicao, esperarSessaoAssentada } = require('./esperas');
const SJ = require('./semente-jornada');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
let falhas = 0;
function afirma(c, msg, det) { console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + JSON.stringify(det) : '')); if (!c) falhas++; }

async function abrir(browser, vp, hash, o) {
  const db = SJ.semente();
  db['fa-admins'] = o && o.restrito ? {} : { [SJ.chave(SJ.ARQ)]: { email: SJ.ARQ, name: 'ADMIN' } };
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify({ db, user: { email: SJ.ARQ, emailVerified: true, uid: 'u1' }, delayDefault: 5, persistenciaReal: true }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + hash, { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
const ate = (page, fn, arg, descricao) => esperarCondicao(page, fn, arg, { limite: 15000, descricao });
const hash = (page) => page.evaluate(() => location.hash);
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

const QUESTIONARIOS = [
  { btn: '#avpQuestP1P16Btn', codigo: 'CLASSIFICACAO_ARQUITETURAL', hash: '#admin?arq=questionarios&q=p1p16', titulo: 'Questionário — Produto/Serviço P1–P16', grupo: 'avpAvalP1P16' },
  { btn: '#avpQuestO1O9Btn', codigo: 'POSICIONAMENTO_ORGANIZACIONAL', hash: '#admin?arq=questionarios&q=o1o9', titulo: 'Questionário — Posicionamento Organizacional O1–O9', grupo: 'avpAvalO1O9' },
  { btn: '#avpQuestS1S8Btn', codigo: 'ADEQUACAO_SQUAD', hash: '#admin?arq=questionarios&q=s1s8', titulo: 'Questionário — Adequação à Gestão por Squad S1–S8', grupo: 'avpAvalS1S8' }
];
const MOTORES = [
  { btn: '#avpConfigMotoresBtn', id: 'avpMotorArquitetural', hash: '#admin?arq=motores', grupo: 'avpAvalP1P16' },
  { btn: '#avpMotorPosicionamentoInicioBtn', id: 'avpMotorPosicionamento', hash: '#admin?arq=motores&m=o', grupo: 'avpAvalO1O9' },
  { btn: '#avpMotorSquadInicioBtn', id: 'sqMotorSquad', hash: '#admin?arq=motor-squad', grupo: 'avpAvalS1S8' }
];
/* tela de questionário: só o da avaliação escolhida, com as funções de sempre */
const telaQuestionario = (page) => page.evaluate(() => ({
  titulo: (document.getElementById('avpCfgTitulo') || {}).textContent || '',
  cartoes: [...document.querySelectorAll('.avp-config-item-card')].map((c) => c.id),
  editar: document.querySelectorAll('.avp-config-editar-btn').length,
  historico: document.querySelectorAll('.avp-config-auditoria-btn').length,
  exportar: document.querySelectorAll('.avp-config-exportar-btn').length,
  voltar: ((document.getElementById('avpConfigVoltar') || {}).textContent || '').trim()
}));
const noInicio = (page) => ate(page, () => { const g = document.getElementById('avpGrupoConfiguracao'); return !!g && g.offsetParent !== null; }, null, 'o Início de Avaliações e Mapa');
const abrirGrupo = (page) => page.evaluate(() => { document.getElementById('avpGrupoConfiguracao').open = true; });

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [nome, vp] of [['computador', { width: 1280, height: 900 }], ['375 px', { width: 375, height: 812 }]]) {
      console.log('\n######## ' + nome + ' ########');
      let r = await abrir(browser, vp, '#admin?arq=inicio'); let page = r.page;
      await page.waitForSelector('#avpGrupoConfiguracao', { timeout: 20000 });
      await abrirGrupo(page);

      console.log('\n== Três grupos: nome, sigla, descrição e Questionário | Motor ==');
      const grupos = await page.evaluate(() => [...document.querySelectorAll('#avpGrupoConfiguracao .avp-admin-aval')].map((g) => ({
        id: g.id, titulo: g.querySelector('.avp-admin-aval-titulo').textContent.trim(), desc: g.querySelector('.avp-admin-aval-desc').textContent.trim(),
        acessos: [...g.querySelectorAll('.avp-admin-acesso')].map((b) => ({ id: b.id, rotulo: b.querySelector('strong').textContent.trim(), texto: b.querySelector('span').textContent.trim(), h: b.getBoundingClientRect().height }))
      })));
      afirma(JSON.stringify(grupos.map((g) => g.titulo)) === JSON.stringify(['Produto/Serviço P1–P16', 'Posicionamento Organizacional O1–O9', 'Adequação à Gestão por Squad S1–S8']), 'três grupos, um por avaliação', grupos.map((g) => g.titulo));
      afirma(grupos.every((g) => g.desc.length > 20 && g.acessos.length === 2 && g.acessos[0].rotulo === 'Questionário' && g.acessos[1].rotulo === 'Motor' && g.acessos.every((a) => a.texto.length > 10)),
        'cada grupo: descrição curta e dois acessos distintos (Questionário, Motor) com o que cada um contém');
      afirma(JSON.stringify(grupos.map((g) => g.acessos.map((a) => a.id))) === JSON.stringify([['avpQuestP1P16Btn', 'avpConfigMotoresBtn'], ['avpQuestO1O9Btn', 'avpMotorPosicionamentoInicioBtn'], ['avpQuestS1S8Btn', 'avpMotorSquadInicioBtn']]),
        'cada acesso no grupo da própria avaliação');
      afirma(grupos.every((g) => g.acessos.every((a) => a.h >= 44)), 'alvos de toque ≥ 44 px');
      afirma(await page.locator('#avpAdminAbrirMapa ~ *, #adminAvaliacaoProduto').locator('text=Questionários e versões').count() === 0 && await page.locator('#avpSubMotores').count() === 0,
        'sem "Questionários e versões" isolado nem subgrupo "Motores de classificação" à parte');
      afirma(await larguraOk(page), 'sem rolagem horizontal');

      console.log('\n== Legibilidade dos títulos e textos ==');
      const tipo = await page.evaluate(() => {
        const cs = (s) => { const e = document.querySelector(s); const c = getComputedStyle(e); return { fam: c.fontFamily, tam: parseFloat(c.fontSize), peso: c.fontWeight, cor: c.color }; };
        return { titulo: cs('#avpGrupoConfiguracaoTitulo'), desc: cs('#avpGrupoConfiguracao .avp-admin-secao-desc'), aval: cs('#avpAvalP1P16 .avp-admin-aval-titulo'), avalDesc: cs('#avpAvalP1P16 .avp-admin-aval-desc'), acesso: cs('#avpQuestP1P16Btn span') };
      });
      afirma(!/Anton/i.test(tipo.titulo.fam) && tipo.titulo.tam >= 17, 'título da seção: sem a Anton em negrito sintético, ≥ 17 px', tipo.titulo);
      afirma(tipo.desc.tam >= 14 && tipo.avalDesc.tam >= 14 && tipo.acesso.tam >= 13 && tipo.aval.tam >= 16, 'descrições ≥ 14 px (acessos ≥ 13 px), título do grupo ≥ 16 px', tipo);
      afirma(tipo.desc.cor === 'rgb(184, 198, 228)' && tipo.avalDesc.cor === 'rgb(184, 198, 228)', 'descrições no tom de texto secundário de maior contraste (ink-2)', tipo.desc.cor);

      console.log('\n== Questionário de cada avaliação: abre direto, só ele; "← Voltar" e o Voltar do navegador ==');
      for (const Q of QUESTIONARIOS) {
        await abrirGrupo(page);
        await page.click(Q.btn);
        await ate(page, () => !!document.getElementById('avpCfgTitulo'), null, 'a tela do questionário');
        let t = await telaQuestionario(page);
        afirma(t.titulo === Q.titulo && JSON.stringify(t.cartoes) === JSON.stringify(['avpCfgCard-' + Q.codigo]) && t.editar === 1 && t.historico === 1 && t.exportar === 1 && await hash(page) === Q.hash,
          Q.titulo + ': só este questionário (editar, histórico, exportar), em ' + Q.hash, t);
        afirma(t.voltar === '← Voltar para Avaliações e Mapa', 'o Voltar leva direto ao Início (nenhum nível intermediário)', t.voltar);
        afirma(await larguraOk(page), 'sem rolagem horizontal');
        /* subtela e volta para o MESMO questionário */
        await page.click('.avp-config-auditoria-btn');
        await page.waitForSelector('#avpCfgAuditoriaVoltarBtn');
        const sigla = Q.titulo.split(' ').pop();
        afirma((await page.locator('#avpCfgAuditoriaVoltarBtn').textContent()).trim() === '← Voltar para Questionário ' + sigla, 'histórico: volta para o Questionário ' + sigla);
        await page.click('#avpCfgAuditoriaVoltarBtn');
        await ate(page, () => !!document.querySelector('.avp-config-editar-btn'), null, 'de volta ao questionário');
        t = await telaQuestionario(page);
        afirma(JSON.stringify(t.cartoes) === JSON.stringify(['avpCfgCard-' + Q.codigo]), 'de volta ao mesmo questionário');
        if (Q.codigo === 'POSICIONAMENTO_ORGANIZACIONAL') {
          await page.goBack();
          await noInicio(page);
          afirma(await hash(page) === '#admin?arq=inicio' && await page.evaluate(() => document.getElementById('avpGrupoConfiguracao').open), 'Voltar do navegador: Início, com Configuração das Avaliações aberta');
          await page.goForward();
          await ate(page, () => !!document.getElementById('avpCfgTitulo'), null, 'Avançar: o questionário');
          t = await telaQuestionario(page);
          afirma(t.titulo === Q.titulo && JSON.stringify(t.cartoes) === JSON.stringify(['avpCfgCard-' + Q.codigo]) && await hash(page) === Q.hash, 'Avançar do navegador: o mesmo questionário de novo', t);
        }
        await page.click('#avpConfigVoltar');
        await noInicio(page);
        afirma(await hash(page) === '#admin?arq=inicio' && await page.evaluate(() => document.getElementById('avpGrupoConfiguracao').open), '"← Voltar": Início, com o grupo aberto');
      }

      console.log('\n== Motor de cada avaliação: abre direto, só ele; Voltar do navegador devolve ao Início ==');
      for (const M of MOTORES) {
        await abrirGrupo(page);
        await page.click(M.btn);
        await page.waitForSelector('#' + M.id, { state: 'visible', timeout: 15000 });
        const vis = await page.evaluate(() => ['avpMotorArquitetural', 'avpMotorPosicionamento', 'sqMotorSquad'].filter((x) => { const e = document.getElementById(x); return !!e && e.offsetParent !== null; }));
        afirma(JSON.stringify(vis) === JSON.stringify([M.id]) && await hash(page) === M.hash && await page.locator('.avp-config-item-card:visible').count() === 0, M.hash + ': só este motor', vis);
        afirma(await larguraOk(page), 'sem rolagem horizontal');
        await page.goBack();
        await noInicio(page);
        afirma(await hash(page) === '#admin?arq=inicio', 'Voltar do navegador: Início');
      }
      afirma(r.erros.length === 0, 'nenhum erro de página', r.erros);
      await r.ctx.close();

      console.log('\n== Link direto / F5 em cada um dos seis endereços ==');
      for (const Q of QUESTIONARIOS) {
        r = await abrir(browser, vp, Q.hash); page = r.page;
        await ate(page, () => !!document.getElementById('avpCfgTitulo'), null, 'o questionário pelo link');
        let t = await telaQuestionario(page);
        afirma(t.titulo === Q.titulo && JSON.stringify(t.cartoes) === JSON.stringify(['avpCfgCard-' + Q.codigo]), 'link direto ' + Q.hash + ': o questionário certo', t);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await esperarSessaoAssentada(page);
        await ate(page, () => !!document.getElementById('avpCfgTitulo'), null, 'o questionário depois do F5');
        t = await telaQuestionario(page);
        afirma(t.titulo === Q.titulo && await hash(page) === Q.hash, 'F5: continua no mesmo questionário', t);
        afirma(r.erros.length === 0, 'nenhum erro de página', r.erros);
        await r.ctx.close();
      }
      for (const M of MOTORES) {
        r = await abrir(browser, vp, M.hash); page = r.page;
        await page.waitForSelector('#' + M.id, { state: 'visible', timeout: 20000 });
        afirma(await hash(page) === M.hash, 'link direto ' + M.hash + ': o motor certo');
        afirma(r.erros.length === 0, 'nenhum erro de página', r.erros);
        await r.ctx.close();
      }

      console.log('\n== Perfil Avaliação + Configuração (sem admin geral): os mesmos seis acessos ==');
      r = await abrir(browser, vp, '#admin?arq=inicio', { restrito: true }); page = r.page;
      await page.waitForSelector('#avpGrupoConfiguracao', { timeout: 20000 });
      await ate(page, () => !!document.getElementById('avpMotorSquadInicioBtn'), null, 'o Motor de Squad no grupo S1–S8');
      afirma(await page.locator(QUESTIONARIOS.map((q) => q.btn).concat(MOTORES.map((m) => m.btn)).join(', ')).count() === 6, 'os seis acessos');
      await abrirGrupo(page);
      await page.click('#avpQuestS1S8Btn');
      await ate(page, () => !!document.getElementById('avpCfgTitulo'), null, 'o questionário S1–S8');
      const t = await telaQuestionario(page);
      afirma(JSON.stringify(t.cartoes) === JSON.stringify(['avpCfgCard-ADEQUACAO_SQUAD']) && t.editar === 1, 'abre o questionário S1–S8 com edição (este perfil configura)', t);
      afirma(await page.locator('#avpUsuariosBtn').count() === 0, 'continua sem "Usuários autorizados" (só admin geral)');
      afirma(r.erros.length === 0, 'nenhum erro de página', r.erros);
      await r.ctx.close();
    }
  } catch (e) { console.error(e); falhas++; }
  await browser.close();
  console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
  process.exit(falhas ? 1 : 0);
})();
