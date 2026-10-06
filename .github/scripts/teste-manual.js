/* ADMIN › Manual — documentação para pessoas, carregada só quando a aba abre. Desktop e 375 px.
 * Hermético: Firebase falso, sem rede, sem segredo.
 *
 * POR QUE ESTE TESTE EXISTE
 * Na Etapa 6.2 as abas Mapa e Testes saíram do ADMIN e o Manual foi refeito: em vez de 254 regras
 * escritas à mão filtradas por quatro "personas" antigas (com um filtro que travava a aba), ele
 * explica cada área pelas quatro dimensões reais de acesso e aponta a fonte oficial e a prova.
 * Este teste garante:
 *
 *   1. Ninguém baixa manual.js só por abrir o site; o ADMIN só o busca quando a aba Manual abre.
 *   2. Rede lenta mostra "Carregando o Manual…"; arquivo que não chega mostra o erro com
 *      "Tentar novamente", que funciona.
 *   3. O Manual abre sem erro de JavaScript, com as quatro dimensões e as nove áreas, e o índice
 *      leva até cada área (abre e rola até ela).
 *   4. Não sobra nada do modelo antigo: sem filtro de Persona, sem contagem de regras, sem export.
 *   5. "Avaliar oficina" e "Avaliação de Produto/Serviço" são áreas diferentes, com esses nomes.
 *   6. Os estados de uma pessoa numa turma estão lá, e as ações que o Manual cita existem nos
 *      botões do site (coerência com app.js/admin.js).
 *   7. Avaliação de Produto/Serviço e Taxonomia apontam ADMIN › Taxonomia; Arquitetura aponta
 *      ADMIN › Arquitetura; os botões levam até lá; todo teste citado como prova existe.
 *   8. Nenhuma rolagem horizontal, mesmo com tudo aberto (375 px é a referência de celular).
 *   9. O ADMIN não tem mais as abas Mapa e Testes; "Avaliação + Arquitetura" continua vendo só a
 *      aba Arquitetura (e não baixa o Manual). */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarCondicao, esperarSessaoAssentada } = require('./esperas');
const { banco, ADM, FALSO } = require('./teste-checagens-interface');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const RAIZ = path.resolve(__dirname, '..', '..');
const ARQ = 'arq@previ.com.br';
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

async function abrir(browser, opts, email, rotaManual) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const erros = [];
  const pedidosManual = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  page.on('request', (r) => { if (/forca-agil\/manual\.js/.test(r.url())) pedidosManual.push(r.url()); });
  const db = banco();
  db['fa-users'][chave(ARQ)] = { name: 'ARQUITETA', email: ARQ, area: 'INFOR' };
  db['fa-avaliacao-autorizados'][chave(ARQ)] = { email: ARQ, nome: 'ARQUITETA', tipo: 'avaliacao-arquitetura' };
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify({ db, user: { email, emailVerified: true, uid: 'u-' + email }, delayDefault: 10, persistenciaReal: true }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  if (rotaManual) await page.route('**/forca-agil/manual.js*', rotaManual);
  await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros, pedidosManual };
}
const abrirAbaManual = (page) => page.click('.admin-tab-btn[data-panel="adminPanelManual"]');
const semRolagemLateral = (page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);

(async () => {
  const browser = await chromium.launch();
  const codigo = ['app.js', 'admin.js'].map((f) => fs.readFileSync(path.join(RAIZ, 'forca-agil', f), 'utf8')).join('\n');

  for (const [nome, opts] of [['desktop', { viewport: { width: 1280, height: 900 } }], ['celular 375px', { ...devices['iPhone 13'], viewport: { width: 375, height: 800 } }]]) {
    console.log('\n######## ' + nome + ' ########');

    console.log('\n== 1/3. Carregado só ao abrir a aba; abre completo ==');
    {
      const { ctx, page, erros, pedidosManual } = await abrir(browser, opts, ADM);
      await page.waitForSelector('.admin-tab-btn[data-panel="adminPanelManual"]', { state: 'visible', timeout: 12000 });
      afirma(pedidosManual.length === 0 && !(await page.evaluate(() => !!window.faInitManual)), 'abrir o site e o ADMIN não baixa manual.js');
      await abrirAbaManual(page);
      await esperarCondicao(page, () => !!document.querySelector('#adminManual .man-wrap'), null, { descricao: 'o Manual aparecer' });
      afirma(pedidosManual.length === 1, 'abrir a aba Manual baixa manual.js uma vez', pedidosManual.length + ' pedido(s)');
      const r = await page.evaluate(() => ({
        dims: Array.from(document.querySelectorAll('#manualDimensoes .man-dim-nome')).map((e) => e.textContent.trim()),
        areas: Array.from(document.querySelectorAll('#manualAreas > .man-area .man-area-titulo')).map((e) => e.textContent.trim()),
        indice: document.querySelectorAll('#manualIndice .man-indice-item').length,
        abertas: document.querySelectorAll('#manualAreas > .man-area[open]').length,
      }));
      afirma(JSON.stringify(r.dims) === JSON.stringify(['Autenticação', 'Participação no programa', 'Perfil funcional', 'Privilégio administrativo']), 'as quatro dimensões de acesso, nesta ordem', r.dims.join(' / '));
      afirma(r.areas.length === 9 && r.indice === 9, 'nove áreas e nove entradas no índice', r.areas.length + ' áreas, ' + r.indice + ' no índice');
      afirma(r.abertas === 0, 'as áreas começam fechadas (resumo antes do detalhe)');

      /* Índice: abre e rola até a área. */
      await page.click('#manualIndice .man-indice-item[data-alvo="taxonomia"]');
      await esperarCondicao(page, () => { const d = document.getElementById('manual-taxonomia'); if (!d || !d.open) return false; const b = d.getBoundingClientRect(); return b.top >= -2 && b.top < window.innerHeight; }, null, { descricao: 'a área Taxonomia abrir e ficar à vista' });
      afirma(true, 'o índice abre a área escolhida e rola até ela');

      console.log('\n== 4. Nada do modelo antigo ==');
      const velho = await page.evaluate(() => {
        const m = document.getElementById('adminManual');
        return { selects: m.querySelectorAll('select').length, personas: /Todas as personas|Filtrar por persona|regras encontradas/.test(m.textContent),
          exportar: /Exportar/.test(m.textContent), selos: m.querySelectorAll('.manual-badge, .manual-card').length };
      });
      afirma(velho.selects === 0 && !velho.personas && velho.selos === 0, 'sem filtro de Persona, sem "N regras encontradas", sem cartões antigos', JSON.stringify(velho));
      afirma(!velho.exportar, 'sem botão de exportar');

      console.log('\n== 5. "Avaliar oficina" × "Avaliação de Produto/Serviço" ==');
      afirma(r.areas.includes('Avaliar oficina') && r.areas.includes('Avaliação de Produto/Serviço') && !r.areas.includes('Avaliação'), 'duas áreas com os nomes explícitos, nenhuma chamada só "Avaliação"', r.areas.join(' | '));
      const aval = await page.evaluate(() => ({ oficina: document.querySelector('#manual-avaliar-oficina .man-oque').textContent, produto: document.querySelector('#manual-avaliacao-produto .man-oque').textContent }));
      afirma(/#avaliacao\b/.test(aval.oficina) && /#avaliacoes/.test(aval.produto), 'cada uma diz o seu endereço (#avaliacao e #avaliacoes)');

      console.log('\n== 6. Estados de uma pessoa numa turma ==');
      const est = await page.evaluate(() => ({
        estados: Array.from(document.querySelectorAll('#manualEstadosTurma .man-estado strong')).map((e) => e.textContent.trim()),
        acoes: Array.from(document.querySelectorAll('#manualEstadosTurma .man-trans-acao')).map((e) => e.textContent).join(' '),
      }));
      afirma(JSON.stringify(est.estados) === JSON.stringify(['Sem registro', 'Interessada', 'Inscrita', 'Removida']), 'os quatro estados', est.estados.join(' / '));
      const botoes = [...est.acoes.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
      const inexistentes = botoes.filter((b) => !codigo.includes(b.replace('＋ ', '')));
      afirma(botoes.length >= 5 && inexistentes.length === 0, 'toda ação citada nos estados existe nos botões do site (app.js/admin.js)', inexistentes.join(', ') || botoes.length + ' ações');

      console.log('\n== 7. Fontes oficiais, provas e caminhos para Arquitetura/Taxonomia ==');
      const refs = await page.evaluate(() => {
        const txt = (id) => (document.getElementById('manual-' + id) || {}).textContent || '';
        const provas = Array.from(document.querySelectorAll('.man-prova li')).map((li) => li.textContent.trim());
        const fontesVazias = Array.from(document.querySelectorAll('#manualAreas > .man-area')).filter((a) => !a.querySelector('.man-fonte li')).map((a) => a.id);
        return { taxNoProduto: /ADMIN › Taxonomia/.test(txt('avaliacao-produto')), taxNaTax: /ADMIN › Taxonomia/.test(txt('taxonomia')), arqNaArq: /ADMIN › Arquitetura/.test(txt('arquitetura')), provas, fontesVazias };
      });
      afirma(refs.taxNoProduto && refs.taxNaTax && refs.arqNaArq, 'Avaliação de Produto/Serviço e Taxonomia apontam ADMIN › Taxonomia; Arquitetura aponta ADMIN › Arquitetura', JSON.stringify(refs).slice(0, 160));
      afirma(refs.fontesVazias.length === 0, 'toda área diz qual é a fonte oficial', refs.fontesVazias.join(', '));
      const arquivos = refs.provas.map((p) => (p.match(/[a-z0-9-]+\.js/) || [])[0]).filter(Boolean);
      const naoExistem = arquivos.filter((f) => !fs.existsSync(path.join(__dirname, f)));
      afirma(arquivos.length >= 20 && naoExistem.length === 0, 'todo teste citado como prova existe em .github/scripts', naoExistem.join(', ') || arquivos.length + ' citados');

      console.log('\n== 8. Sem rolagem horizontal, com tudo aberto ==');
      await page.evaluate(() => document.querySelectorAll('#manualAreas > .man-area').forEach((d) => { d.open = true; }));
      afirma(await semRolagemLateral(page), 'nenhuma rolagem horizontal com todas as áreas abertas');

      await page.evaluate(() => { document.getElementById('manual-taxonomia').querySelector('.man-ir-aba').click(); });
      await esperarCondicao(page, () => document.getElementById('adminPanelTaxonomia').classList.contains('active'), null, { descricao: 'o botão levar à aba Taxonomia' });
      afirma(true, '"Abrir ADMIN › Taxonomia" leva até a aba Taxonomia');
      await abrirAbaManual(page);
      await page.evaluate(() => { document.querySelector('#manual-arquitetura .man-ir-aba').click(); });
      await esperarCondicao(page, () => document.getElementById('adminPanelArquitetura').classList.contains('active') && !!document.getElementById('avpConfigQuestionariosBtn'), null, { descricao: 'o botão levar à Arquitetura' });
      afirma(true, '"Abrir ADMIN › Arquitetura" leva até a tela inicial da Arquitetura');

      console.log('\n== 9. Abas do ADMIN ==');
      const abas = await page.evaluate(() => Array.from(document.querySelectorAll('.admin-tab-btn')).map((b) => b.textContent.trim()));
      afirma(!abas.includes('Mapa') && !abas.includes('Testes') && abas.includes('Manual'), 'sem as abas Mapa e Testes; Manual continua', abas.join(', '));
      afirma(erros.length === 0, 'nenhum erro de JavaScript', erros.slice(0, 3).join(' | '));
      await ctx.close();
    }

    console.log('\n== 2. Rede lenta e arquivo que não chega ==');
    {
      let liberar;
      const segura = new Promise((res) => { liberar = res; });
      const { ctx, page, erros } = await abrir(browser, opts, ADM, async (route) => { await segura; route.continue(); });
      await page.waitForSelector('.admin-tab-btn[data-panel="adminPanelManual"]', { state: 'visible', timeout: 12000 });
      await abrirAbaManual(page);
      await esperarCondicao(page, () => /Carregando o Manual…/.test((document.getElementById('adminManual') || {}).textContent || ''), null, { descricao: 'o "Carregando o Manual…" aparecer' });
      afirma(true, 'enquanto o arquivo não chega, a aba mostra "Carregando o Manual…"');
      liberar();
      await esperarCondicao(page, () => !!document.querySelector('#adminManual .man-wrap'), null, { descricao: 'o Manual aparecer depois da rede lenta' });
      afirma(true, 'quando o arquivo chega, o Manual aparece sem recarregar');
      afirma(erros.length === 0, 'nenhum erro de JavaScript', erros.join(' | '));
      await ctx.close();
    }
    {
      let falhar = true;
      const { ctx, page } = await abrir(browser, opts, ADM, (route) => (falhar ? route.abort() : route.continue()));
      await page.waitForSelector('.admin-tab-btn[data-panel="adminPanelManual"]', { state: 'visible', timeout: 12000 });
      await abrirAbaManual(page);
      await page.waitForSelector('#manualTentarDeNovo', { state: 'visible', timeout: 8000 });
      afirma(/Não foi possível carregar o Manual agora/.test(await page.textContent('#adminManual')), 'arquivo que falha mostra o erro com "Tentar novamente"');
      falhar = false;
      await page.click('#manualTentarDeNovo');
      await esperarCondicao(page, () => !!document.querySelector('#adminManual .man-wrap'), null, { descricao: 'o Manual aparecer depois de "Tentar novamente"' });
      afirma(true, '"Tentar novamente" carrega o Manual');
      await ctx.close();
    }

    console.log('\n== 9. "Avaliação + Arquitetura" continua vendo só a Arquitetura ==');
    {
      const { ctx, page, erros, pedidosManual } = await abrir(browser, opts, ARQ);
      await esperarCondicao(page, () => { const b = document.querySelector('.admin-tab-btn[data-panel="adminPanelArquitetura"]'); return !!b && b.classList.contains('active') && !!document.getElementById('avpConfigQuestionariosBtn'); }, null, { descricao: 'a Arquitetura abrir para Avaliação + Arquitetura' });
      const visiveis = await page.evaluate(() => Array.from(document.querySelectorAll('.admin-tab-btn')).filter((b) => !b.hidden && b.offsetParent !== null).map((b) => b.textContent.trim()));
      afirma(visiveis.length <= 1 && !visiveis.includes('Manual'), 'nenhuma outra aba (nem Manual) para Avaliação + Arquitetura', visiveis.join(', ') || 'barra oculta');
      afirma(pedidosManual.length === 0, 'e o Manual não é baixado');
      afirma(erros.length === 0, 'nenhum erro de JavaScript', erros.join(' | '));
      await ctx.close();
    }
  }

  await browser.close();
  console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nOK — Manual carregado só ao abrir a aba, com as quatro dimensões, as nove áreas, estados de turma coerentes, fontes e provas, sem rolagem lateral (desktop e 375 px).');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
