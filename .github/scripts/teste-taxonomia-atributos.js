/* TAXONOMIA — Administração › Perfil: os atributos agrupados (Estado, Valor, Papel, Origem) e "Gerenciar perfil" integrado.
 * O Catálogo não mostra perfil nenhum. Desktop e celular (375 px).
 * CONTEÚDO 100% FICTÍCIO (semente-taxonomia-ficha.js, mesma estrutura de "Linhas de Estratégia de Clientes": 13 atributos,
 * 3 definidos). Firebase falso em persistência real; hermético (sem rede, sem segredo).
 *
 *   1. Administração › Perfil: os 13 atributos numa tabela agrupada por grupo (sem cartões), com Estado, Valor, Papel e
 *      Origem; os sem registro aparecem aqui para preenchimento; "3 de 13 atributos definidos"; Papel/Origem em ajuda
 *      contextual; UMA ação, "Gerenciar perfil". O Catálogo não mostra perfil.
 *   2. Conceito sem nenhum atributo: "0 de 13", todos "sem registro".
 *   3. Gerenciar perfil: todos os atributos num formulário; altera vários (criar registrado, criar ausência, mudar valor) e
 *      salva UMA vez: grava só os alterados, um evento de auditoria por atributo, nenhum registro vazio; a consulta acompanha.
 *   4. Validação: "registrado" sem valor → erro no atributo e NADA gravado; o resto do formulário continua como estava.
 *   5. Cancelar com alterações pede confirmação ("Continuar editando" mantém tudo); sem alterações fecha direto; nada gravado.
 *   6. Concorrência: outra pessoa mudou o atributo enquanto o formulário estava aberto → nada gravado, aviso claro.
 *   7. Clique repetido em "Salvar perfil" grava uma vez só.
 *   8. Somente leitura: sem "Gerenciar perfil". Perfis lentos → "Carregando o perfil…"; recusados → "não foi possível",
 *      nunca "0 de 13".
 *   9. 375 px: formulário aberto sem rolagem horizontal, todo campo dentro da tela; nenhum erro de JS. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarCondicao, esperarSessaoAssentada } = require('./esperas');
const S = require('./semente-taxonomia-ficha');
const T = require('./taxonomia-tela');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const EMAIL = S.EMAIL;
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const DESKTOP = { width: 1280, height: 900 };
const CELULAR = { width: 375, height: 800 };
const EC = 'ESTRATEGIA_CLIENTES';
const PERFIS = 'taxonomia/organizacional/perfis/' + EC;

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

function banco() {
  const adm = {}; adm[chave(EMAIL)] = { email: EMAIL, name: 'ADMIN' };
  const users = {}; users[chave(EMAIL)] = { name: 'ADMIN', email: EMAIL, area: 'INFOR' };
  return Object.assign({ 'fa-users': users, 'fa-admins': adm, 'fa-diretores': {}, 'fa-facilitadores': {}, eventos: {}, turmas: {}, 'turmas-interesse': {}, 'turmas-config': {}, 'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {} }, S.semente());
}
async function abrir(browser, viewport, opts) {
  opts = opts || {};
  const cfg = { db: banco(), user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true, delays: opts.delays || {}, fail: opts.fail || [] };
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  await page.evaluate(() => { location.hash = '#arquitetura?arq=taxonomia'; }); /* a Taxonomia é área da Gestão da Floresta */
  await page.waitForSelector('.tax-item[data-codigo="' + EC + '"]', { timeout: 8000 });
  return { ctx, page, erros };
}
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const escritas = (page) => page.evaluate(() => (window.__ESCRITAS || []).length);
const perfisDb = (page) => page.evaluate((p) => JSON.parse(JSON.stringify(p.split('/').reduce((o, k) => (o == null ? o : o[k]), window.__CFG.__dbReal) || {})), PERFIS);
const contagem = (page) => page.evaluate(() => { const e = document.getElementById('taxPerfilContagem'); return e ? e.textContent.trim() : ''; });
/* o perfil fica na Administração › Perfil do conceito */
async function abreConceito(page, cod) { await T.abrirAdmin(page, cod, 'perfil'); }
async function gerenciar(page) {
  await page.click('#taxGerenciarPerfilBtn');
  await page.waitForSelector('#taxFormPerfilLote', { timeout: 4000 });
}

(async () => {
  const browser = await chromium.launch();
  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    const movel = viewport.width <= 720;
    console.log('\n######## ' + nomeTela + ' ########');
    {
      const { ctx, page, erros } = await abrir(browser, viewport);
      await abreConceito(page, EC);

      console.log('\n== 1. Consulta compacta ==');
      afirma(await contagem(page) === '3 de 13 atributos definidos', '"3 de 13 atributos definidos"', await contagem(page));
      const linhas = await page.locator('#taxPerfilTabela tr.tax-atributo').evaluateAll((els) => els.map((e) => e.getAttribute('data-atributo')));
      afirma(linhas.length === 13 && await page.locator('#taxPerfilTabela tr.tax-atributo--vazio').count() === 10, 'os 13 atributos numa tabela, os 10 sem registro aqui para preenchimento', String(linhas.length));
      afirma(JSON.stringify(await page.locator('#taxPerfilTabela .tax-perfil-grupo th').allTextContents()) === JSON.stringify(['Quem recebe', 'Alcance', 'O que entrega', 'Governança', 'Outros']), 'agrupados por grupo, sem cartões decorativos');
      const obj = await page.locator('#taxPerfilTabela tr[data-atributo="OBJETO_PREDOMINANTE"] td').allTextContents();
      afirma(JSON.stringify(obj) === JSON.stringify(['registrado', 'públicos e segmentos (fictício)', 'definidor', 'decisão']), 'cada atributo com Estado, Valor, Papel e Origem', obj.join(' | '));
      afirma(await page.locator('#taxPerfilPendentes, #taxPerfilDefinidos').count() === 0, 'nada de listas "definidos/ainda não definidos" separadas');
      afirma(await page.locator('#taxLegenda').count() === 1 && !(await page.locator('#taxLegenda').evaluate((d) => d.open)) && /observado: valor presente na fonte ou registrado no perfil/.test(await page.locator('#taxLegenda').textContent()), 'Papel e Origem explicados em ajuda contextual recolhida (o significado não mudou)');
      afirma(await page.locator('#taxSecAtributos .tax-acoes button').count() === 1 && await page.locator('#taxGerenciarPerfilBtn').isVisible() && await page.locator('[data-tax="editar-perfil"]').count() === 0, 'UMA ação na seção: "Gerenciar perfil" (nenhum "Editar" por atributo)');
      afirma(await page.locator('.tax-inferencia-aviso').count() === 0, 'nenhuma explicação longa repetida em cada linha');
      await T.voltarCatalogo(page);
      afirma(await page.locator('#taxSecAtributos, #taxPerfilContagem').count() === 0, 'o Catálogo não mostra perfil nenhum');
      await T.administrar(page, 'perfil');

      console.log('\n== 2. Conceito sem atributos definidos ==');
      await abreConceito(page, 'LINHA');
      afirma(await contagem(page) === '0 de 13 atributos definidos' && await page.locator('#taxPerfilTabela tr.tax-atributo--vazio').count() === 13, '"0 de 13": todos sem registro, para preenchimento');
      await abreConceito(page, EC);

      console.log('\n== 3. Gerenciar perfil: vários atributos, uma gravação ==');
      const antes = await perfisDb(page);
      await gerenciar(page);
      afirma(await page.locator('#taxFormPerfilLote .tax-perfil-linha').count() === 13 && /Nenhuma alteração ainda/.test(await page.locator('#taxPerfilResumo').innerText()), 'os 13 atributos num formulário só; "Nenhuma alteração ainda."');
      afirma(await page.locator('#taxPL_CONSUMIDOR_DIRETO_estado option[value=""]').count() === 1 && await page.locator('#taxPL_LIDERANCA_estado option[value=""]').count() === 0, 'atributo sem registro começa "— sem registro —"; um com registro não pode virar "sem registro"');
      await page.selectOption('#taxPL_ALCANCE_ATUACAO_estado', 'registrado');
      await page.selectOption('#taxPL_ALCANCE_ATUACAO_valor', 'transversal');
      await page.selectOption('#taxPL_ALCANCE_ATUACAO_papel', 'típico');
      await page.selectOption('#taxPL_ALCANCE_ATUACAO_origem', 'decisão');
      await page.selectOption('#taxPL_BENEFICIARIO_INDIRETO_estado', 'não consta na fonte');
      await page.fill('#taxPL_OBJETO_PREDOMINANTE_valor', 'públicos, segmentos e experiência (fictício)');
      await page.selectOption('#taxPL_CONSUMIDOR_DIRETO_estado', 'registrado'); /* sem valor: inválido */
      afirma(/4 atributos alterados/.test(await page.locator('#taxPerfilResumo').innerText()) && await page.locator('.tax-perfil-linha--alterada').count() === 4, 'o formulário mostra o que mudou (4 alterados, marcados)');

      console.log('\n== 4. Validação: nada gravado ==');
      const e0 = await escritas(page);
      await page.click('#taxSalvarPerfilBtn');
      await page.waitForSelector('#taxPerfilLoteErro', { timeout: 4000 });
      afirma(/Corrija 1 atributo indicado\. Nada foi salvo\./.test(await page.locator('#taxPerfilLoteErro').innerText()) && /exige o valor/.test(await page.locator('.tax-perfil-linha[data-atributo="CONSUMIDOR_DIRETO"] .tax-perfil-erro').innerText()), 'erro no atributo inválido e "Nada foi salvo"');
      afirma(await escritas(page) === e0 && JSON.stringify(await perfisDb(page)) === JSON.stringify(antes), 'nenhuma escrita');
      afirma(await page.inputValue('#taxPL_OBJETO_PREDOMINANTE_valor') === 'públicos, segmentos e experiência (fictício)' && await page.inputValue('#taxPL_ALCANCE_ATUACAO_valor') === 'transversal', 'o que foi digitado nos outros atributos continua');
      await page.selectOption('#taxPL_CONSUMIDOR_DIRETO_estado', '');
      afirma(/3 atributos alterados/.test(await page.locator('#taxPerfilResumo').innerText()), 'voltar a "sem registro" desfaz a alteração (3)');
      /* 7. clique repetido: dois cliques seguidos, uma gravação */
      await page.evaluate(() => { const b = document.getElementById('taxSalvarPerfilBtn'); b.click(); b.click(); });
      await esperarCondicao(page, () => /3 atributos salvos/.test((document.getElementById('taxFlash') || {}).innerText || ''), null, { descricao: 'perfil salvo' });
      const depois = await perfisDb(page);
      afirma(depois.ALCANCE_ATUACAO && depois.ALCANCE_ATUACAO.estado === 'registrado' && depois.ALCANCE_ATUACAO.valor === 'transversal' && depois.ALCANCE_ATUACAO.papel === 'típico' && depois.ALCANCE_ATUACAO.origem === 'decisão', 'atributo novo "registrado" gravado com valor, papel e origem');
      afirma(depois.BENEFICIARIO_INDIRETO && JSON.stringify(Object.keys(depois.BENEFICIARIO_INDIRETO).sort()) === JSON.stringify(['atualizadoEm', 'estado']), 'ausência gravada como estado, sem valor/papel/origem');
      afirma(depois.OBJETO_PREDOMINANTE.valor === 'públicos, segmentos e experiência (fictício)' && depois.OBJETO_PREDOMINANTE.papel === 'definidor', 'valor alterado; papel e origem mantidos');
      afirma(!depois.CONSUMIDOR_DIRETO && Object.keys(depois).length === 5, 'nenhum registro vazio criado (só 3 + os 2 que existiam e não mudaram)', Object.keys(depois).join(','));
      afirma(JSON.stringify(depois.LIDERANCA) === JSON.stringify(antes.LIDERANCA) && JSON.stringify(depois.PROPOSITO_PREDOMINANTE) === JSON.stringify(antes.PROPOSITO_PREDOMINANTE), 'os atributos não alterados ficaram intactos');
      const aud = await page.evaluate((c) => Object.values(window.__CFG.__dbReal.taxonomia.organizacional.auditoria[c]).filter((e) => e.tipo === 'alteracao_perfil' && e.dataHora > '2026-10-10'), EC);
      afirma(aud.length === 3 && aud.every((e) => e.usuario.email === EMAIL), 'um evento de auditoria por atributo alterado (3), do autor — clique repetido não duplicou', String(aud.length));
      const audObj = aud.find((e) => e.campo === 'Objeto predominante');
      afirma(!!audObj && /públicos e segmentos \(fictício\)/.test(audObj.valorAnterior) && /experiência/.test(audObj.valorNovo), 'auditoria com anterior → novo');
      await esperarCondicao(page, () => /^5 de 13/.test(((document.getElementById('taxPerfilContagem') || {}).textContent || '').trim()), null, { descricao: 'contagem atualizada' });
      afirma(await page.locator('#taxFormPerfilLote').count() === 0, 'o formulário fecha e a consulta mostra "5 de 13"');

      console.log('\n== 5. Cancelar ==');
      await gerenciar(page);
      await page.click('#taxCancelarPerfilBtn');
      afirma(await page.locator('#taxFormPerfilLote').count() === 0, 'sem alterações, "Cancelar" fecha direto');
      await gerenciar(page);
      await page.fill('#taxPL_LIDERANCA_valor', 'compartilhada (fictício)');
      await page.locator('#taxPL_LIDERANCA_valor').dispatchEvent('change');
      await page.click('#taxCancelarPerfilBtn');
      afirma(await page.locator('#taxPerfilDescartar').count() === 1 && /Descartar 1 alteração não salva/.test(await page.locator('#taxPerfilDescartar').innerText()), 'com alteração, pede confirmação antes de descartar');
      await page.click('[data-tax="continuar-perfil"]');
      afirma(await page.inputValue('#taxPL_LIDERANCA_valor') === 'compartilhada (fictício)', '"Continuar editando" mantém o que foi digitado');

      console.log('\n== 6. Concorrência ==');
      await page.evaluate((c) => { window.__CFG.__dbReal.taxonomia.organizacional.perfis[c].LIDERANCA.valor = 'outra pessoa mudou (fictício)'; }, EC);
      const e1 = await escritas(page);
      await page.click('#taxSalvarPerfilBtn');
      await esperarCondicao(page, () => /Outra pessoa alterou/.test((document.getElementById('taxPerfilLoteErro') || {}).innerText || ''), null, { descricao: 'aviso de concorrência' });
      afirma(/Outra pessoa alterou Liderança/.test(await page.locator('#taxPerfilLoteErro').innerText()) && await escritas(page) === e1, 'outra pessoa mudou o mesmo atributo: nada gravado, aviso diz qual');
      afirma((await perfisDb(page)).LIDERANCA.valor === 'outra pessoa mudou (fictício)', 'o valor da outra pessoa ficou intacto');
      await page.click('#taxCancelarPerfilBtn');
      await page.click('[data-tax="descartar-perfil"]');
      afirma(await page.locator('#taxFormPerfilLote').count() === 0, '"Descartar" fecha sem gravar');

      if (movel) {
        console.log('\n== 9. 375 px ==');
        await gerenciar(page);
        afirma(await larguraOk(page), 'formulário aberto: sem rolagem horizontal');
        afirma(await page.evaluate(() => [...document.querySelectorAll('#taxFormPerfilLote select, #taxFormPerfilLote input, #taxFormPerfilLote fieldset')].every((el) => el.getBoundingClientRect().right <= window.innerWidth + 1)), 'todo campo do formulário cabe na tela');
        await page.click('#taxCancelarPerfilBtn');
      }
      afirma(await larguraOk(page), 'sem rolagem horizontal');
      afirma(erros.length === 0, 'sem erros de JavaScript (' + erros.length + ')');
      await ctx.close();
    }
    {
      console.log('\n== 8. Somente leitura, leitura lenta e recusada ==');
      const { ctx, page } = await abrir(browser, viewport);
      await T.abrirConceito(page, EC);
      await page.evaluate(() => window.faTaxonomia.abrir({ somenteLeitura: true }));
      await esperarCondicao(page, () => !!document.getElementById('taxDefinicaoTexto') && !document.getElementById('taxAdministrarBtn'), null, { descricao: 'ficha em modo leitura' });
      afirma(await page.locator('#taxGerenciarPerfilBtn, #taxSecAtributos, #taxAdministrarBtn').count() === 0, 'somente leitura: sem administração, o perfil não é editável nem aparece na consulta');
      await ctx.close();
      const lenta = await abrir(browser, viewport, { delays: { [PERFIS]: 600000 } });
      await T.abrirConceito(lenta.page, EC);
      await lenta.page.click('#taxAdministrarBtn');
      await lenta.page.click('#taxAba_perfil');
      await lenta.page.waitForSelector('#taxPerfilCarregando', { timeout: 4000 });
      afirma(/Carregando o perfil/.test(await lenta.page.locator('#taxSecAtributos').innerText()) && await lenta.page.locator('#taxPerfilContagem').count() === 0 && await lenta.page.locator('#taxGerenciarPerfilBtn').count() === 0, 'lenta: "Carregando o perfil…", nunca "0 de 13", sem botão de editar');
      await lenta.ctx.close();
      const rec = await abrir(browser, viewport, { fail: [PERFIS] });
      await T.abrirConceito(rec.page, EC);
      await rec.page.click('#taxAdministrarBtn');
      await rec.page.click('#taxAba_perfil');
      await rec.page.waitForSelector('#taxPerfilErro', { timeout: 6000 });
      afirma(/Não foi possível carregar o perfil/.test(await rec.page.locator('#taxSecAtributos').innerText()) && await rec.page.locator('#taxGerenciarPerfilBtn').count() === 0, 'recusada: "Não foi possível carregar o perfil agora", sem botão de editar');
      await rec.ctx.close();
    }
  }
  await browser.close();
  console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
