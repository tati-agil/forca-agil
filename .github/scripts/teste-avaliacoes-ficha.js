/* Ficha da avaliação (Fase 3): Identificação, resultado, avaliação pergunta a
 * pergunta ("Sua justificativa" × "Interpretação do sistema") e histórico de
 * versões v1/v2/v3 — a mais recente é a vigente; as anteriores abrem só para
 * consulta, sem Reavaliar nem edição. Status: "Em andamento" / "Concluída".
 * Desktop e celular (375 px). Hermético: sem rede, sem segredo. */
const { chromium } = require('playwright');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const fs = require('fs');
const path = require('path');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const RAIZ = path.join(__dirname, '..', '..', 'forca-agil');
const MOTOR_VERSION = /var MOTOR_VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(RAIZ, 'avaliacao-produto.js'), 'utf8'))[1];
const EMAIL = 'pessoa@previ.com.br';
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const ORDEM = ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia', 'jornada', 'medicao', 'gestao', 'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'];
const DESKTOP = { width: 1280, height: 900 };
const CELULAR = { width: 375, height: 800 };

let falhas = 0;
function afirma(cond, msg) { console.log((cond ? '  ok    ' : '  FALHA ') + msg); if (!cond) falhas++; }

function item(nome, i, extra) {
  const respostas = {};
  ORDEM.forEach((id, n) => { respostas[id] = { valor: n < 5 ? 'sim' : 'nao', observacao: n === 0 ? 'porque o cliente pediu' : '', justificativaAuto: 'interpretação ' + id, codigoPergunta: 'P', textoPerguntaNaEpoca: 't', tituloNaEpoca: 't', questionnaireContentVersion: 1 }; });
  const n = String(i).padStart(2, '0');
  return Object.assign({
    nome: nome, descricao: 'descrição do ' + nome, publico: 'participantes', necessidade: 'entender o plano', observacoesGerais: 'obs gerais',
    status: 'concluido', respostas: respostas, resultadoAutomatico: 'produto', decisaoFinal: 'produto', decisaoManual: false,
    camadaSugerida: { id: 'produto-principal', label: 'Produto/Serviço principal', motivos: ['m1'], conflito: null, incoerencia: false, especializacao: null, papelEstrutural: null, relacao: null },
    justificativaAutomatica: 'justificativa gerada ' + i, criteriosEssenciaisFalhos: ['x'], exclusoesConflitantes: null, criteriosAtendidos: 5,
    motorVersion: MOTOR_VERSION, motorVersionArquitetura: 1, questionnaireContentVersion: 1,
    criadoEm: '2026-0' + (i + 2) + '-15T10:00:' + n + '.000Z', atualizadoEm: '2026-0' + (i + 2) + '-15T10:00:' + n + '.000Z',
    responsavel: { name: 'Avaliadora ' + i, email: 'a' + i + '@previ.com.br' }, itemId: 'k1', versao: 1, versaoAnteriorKey: null, excluido: false
  }, extra || {});
}
const camada = (id, label) => ({ id: id, label: label, motivos: ['m'], conflito: null, incoerencia: false, especializacao: null, papelEstrutural: null, relacao: null });
const AVALIACOES = () => ({
  k1: item('Plano Exemplo', 1, { versao: 1, resultadoAutomatico: 'nao-produto', decisaoFinal: 'nao-produto', camadaSugerida: camada('documento-informacao', 'Informação/Documento') }),
  k2: item('Plano Exemplo', 2, { versao: 2, versaoAnteriorKey: 'k1', resultadoAutomatico: 'nao-produto', decisaoFinal: 'nao-produto', camadaSugerida: camada('componente', 'Componente') }),
  k3: item('Plano Exemplo', 3, { versao: 3, versaoAnteriorKey: 'k2' }),
  k4: item('Item Em Andamento', 4, { itemId: 'k4', status: 'rascunho', resultadoAutomatico: null, decisaoFinal: null, camadaSugerida: null })
});

async function abrir(browser, tipo, viewport) {
  const acessos = {}; acessos[chave(EMAIL)] = { email: EMAIL, tipo: tipo };
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': {}, 'turmas-config': {}, 'turmas-checkin': {}, 'turmas-espera': {},
    'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {}, eventos: {}, 'turmas-publico': {}, 'eventos-publico': {},
    'avaliacoes-produto': AVALIACOES(), 'avaliacoes-squad': {}, 'motor-squad-config': {}, 'motor-squad-auditoria': {},
    'motor-arquitetura-config': {}, 'motor-arquitetura-auditoria': {}, 'fa-avaliacao-autorizados': acessos };
  const cfg = { db: db, user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true };
  const ctx = await browser.newContext({ viewport: viewport || DESKTOP });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#avaliacoes', { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page); /* login decidido e acessos resolvidos (antes: opções no lugar do argumento, engolida + 300 ms fixos) */
  await page.waitForSelector('#avaliacoesPainel .avp-table tbody tr', { timeout: 8000 });
  await esperarCondicao(page, () => !document.querySelector('.avp-tag-motor--verificando'), null, { descricao: 'os selos de motor verificados' });
  return { ctx, page, erros };
}
/* compara o conteúdo sem depender da ordem das chaves (o banco falso, como o real, não guarda null) */
const canon = (v) => Array.isArray(v) ? v.map(canon) : (v && typeof v === 'object' ? Object.keys(v).sort().reduce((o, k) => { if (v[k] !== null) o[k] = canon(v[k]); return o; }, {}) : v);
const contar = (page, sel) => page.locator(sel).count();
const banco = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal)));
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

(async () => {
  const browser = await chromium.launch();
  const original = JSON.stringify(AVALIACOES());

  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    console.log('\n######## ' + nomeTela + ' ########');
    const { ctx, page, erros } = await abrir(browser, 'avaliacao', viewport);

    console.log('\n== Status: "Em andamento" / "Concluída" ==');
    const badges = await page.locator('.avp-table .avp-badge--concluido, .avp-table .avp-badge--rascunho').allTextContents();
    afirma(badges.indexOf('Concluída') !== -1 && badges.indexOf('Em andamento') !== -1 && badges.indexOf('Rascunho') === -1 && badges.indexOf('Concluído') === -1, 'lista: ' + badges.join(', '));
    await page.click('#avpFiltrosBtn');
    afirma((await page.locator('#avpFiltroStatus option').allTextContents()).join('|') === 'Todos|Em andamento|Concluída', 'filtro de status usa os mesmos rótulos');
    afirma(await contar(page, '.avp-act-ver[data-key="k3"]') === 1 && await contar(page, '.avp-act-ver[data-key="k1"]') === 0 && await contar(page, '.avp-act-ver[data-key="k2"]') === 0, 'a lista mostra só a versão vigente (v3) do item');

    console.log('\n== Ficha da versão vigente (v3) ==');
    await page.click('.avp-act-ver[data-key="k3"]');
    await page.waitForSelector('#avpIdentificacao');
    /* todo histórico começa recolhido (versões, curadoria, decisão final) */
    const historicosAbertos = () => page.evaluate(() => Array.from(document.querySelectorAll('#avaliacoesPainel details.avp-historico-recolhido, #avaliacoesPainel details.avp-aut-historico')).filter((d) => d.open).map((d) => d.id));
    afirma(await contar(page, '#avaliacoesPainel details.avp-historico-recolhido, #avaliacoesPainel details.avp-aut-historico') >= 3 && (await historicosAbertos()).length === 0,
      'ficha: os históricos (versões, curadoria, decisão final) começam recolhidos — abertos: ' + JSON.stringify(await historicosAbertos()));
    await esperarCondicao(page, () => /— \d+ alteraç/.test((document.querySelector('#avpCuradoriaHistoricoDet summary') || {}).textContent || ''), null, { descricao: 'o cabeçalho do histórico da curadoria trazer a contagem' });
    afirma(/^Histórico da Curadoria — \d+ alteraç(ão|ões)$/.test((await page.locator('#avpCuradoriaHistoricoDet summary').textContent()).trim()) &&
      /^Histórico da Decisão final — \d+ alteraç(ão|ões)$/.test((await page.locator('#avpDecisaoHistoricoDet summary').textContent()).trim()), 'cabeçalhos "Histórico … — N alterações"');
    const ident = await page.locator('#avpIdentificacao').textContent(); /* descrição, público, necessidade e observações ficam recolhidos em "Dados do item" */
    afirma(/Plano Exemplo/.test(ident) && /v3/.test(ident) && /descrição do Plano Exemplo/.test(ident) && /participantes/.test(ident) && /entender o plano/.test(ident) && /obs gerais/.test(ident) && /Avaliadora 3/i.test(ident), 'Identificação: nome, versão, descrição, público, necessidade, observações e quem avaliou');
    afirma(!/versão anterior/i.test(ident) && await contar(page, '#avpAvisoVersaoAnterior') === 0, 'a vigente não tem aviso de versão anterior');
    /* avaliar ≠ decidir: o tipo "Avaliação" reavalia, mas a decisão arquitetural é de "Avaliação + Arquitetura" (teste-avaliacoes-acessos.js) */
    afirma(await contar(page, '#avpReavaliarBtn') === 1 && await contar(page, '#avpSalvarDecisaoBtn') === 0, 'vigente: Reavaliar à vista; a decisão fica só para leitura (o tipo "Avaliação" não decide)');
    const hist = await page.locator('.avp-hist-item').evaluateAll((els) => els.map((e) => e.dataset.key));
    afirma(JSON.stringify(hist) === JSON.stringify(['k3', 'k2', 'k1']), 'histórico de versões: v3, v2, v1 (mais recente primeiro): ' + hist.join(','));
    await page.evaluate(() => { const d = document.getElementById('avpHistoricoVersoesLista'); if (d) d.open = true; }); /* recolhido: abre para ler */
    afirma(/vigente/.test(await page.locator('.avp-hist-item[data-key="k3"]').innerText()) && /você está vendo/i.test(await page.locator('.avp-hist-item[data-key="k3"]').innerText()), 'v3 marcada como vigente e como a aberta');
    const nUser = await contar(page, '.avp-reasoning-user'), nAuto = await contar(page, '.avp-reasoning-auto');
    afirma(nUser === 16 && nAuto === 16, 'as 16 perguntas mostram "Sua justificativa" e "Interpretação do sistema" (' + nUser + '/' + nAuto + ')');
    afirma(/porque o cliente pediu/.test(await page.locator('.avp-reasoning-user').first().innerText()), 'a justificativa de quem avaliou aparece como escrita');
    afirma(/interpretação necessidade/.test(await page.locator('.avp-reasoning-auto').first().innerText()), 'e a interpretação do sistema aparece separada');
    afirma(await larguraOk(page), 'sem rolagem horizontal');

    console.log('\n== Versão anterior (v1): só consulta ==');
    await page.evaluate(() => { const d = document.getElementById('avpHistoricoVersoesLista'); if (d) d.open = true; }); /* o Histórico de versões fica recolhido: a pessoa abre antes de escolher a versão */ await page.click('.avp-hist-abrir[data-key="k1"]');
    await page.waitForSelector('#avpAvisoVersaoAnterior');
    afirma((await historicosAbertos()).length === 0, 'abrir outra versão começa de novo com os históricos recolhidos (o Histórico de versões tinha sido aberto na v3)');
    afirma(/versão v1/.test(await page.locator('#avpAvisoVersaoAnterior').innerText()) && /vigente é a v3/.test(await page.locator('#avpAvisoVersaoAnterior').innerText()), 'aviso: "Você está vendo a versão v1… a situação vigente é a v3"');
    afirma(await contar(page, '#avpReavaliarBtn') === 0, 'versão anterior: sem Reavaliar (reavaliar parte sempre da vigente)');
    afirma(await contar(page, '#avpSalvarDecisaoBtn') === 0 && await contar(page, '#avpDecisaoLeitura') === 1 && await contar(page, '.avp-especializacao-cadastro-card') === 0, 'versão anterior: decisão e especialização só em leitura');
    afirma(/Informação\/Documento/.test(await page.locator('.avp-alt-card').innerText()), 'mostra a classificação DAQUELA versão (Informação/Documento), não a de hoje');
    afirma(await larguraOk(page), 'sem rolagem horizontal');
    await page.click('#avpAbrirVigente');
    await page.waitForSelector('#avpReavaliarBtn');
    afirma(await contar(page, '#avpAvisoVersaoAnterior') === 0 && /v3/.test(await page.locator('#avpIdentificacao').innerText()), '"Abrir a versão vigente" volta à v3');

    afirma(JSON.stringify(canon((await banco(page))['avaliacoes-produto'])) === JSON.stringify(canon(JSON.parse(original))), 'nada foi gravado só por consultar as versões (v1, v2, v3 idênticas)');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  console.log('\n== Histórico: versões antigas só para leitura ==');
  {
    const { ctx, page, erros } = await abrir(browser, 'avaliacao');
    await page.click('.avp-act-ver[data-key="k3"]');
    await page.waitForSelector('#avpIdentificacao');
    afirma(await contar(page, '.avp-hist-item') === 3, 'vê as 3 versões no histórico');
    await page.evaluate(() => { const d = document.getElementById('avpHistoricoVersoesLista'); if (d) d.open = true; }); /* o Histórico de versões fica recolhido: a pessoa abre antes de escolher a versão */ await page.click('.avp-hist-abrir[data-key="k2"]');
    await page.waitForSelector('#avpAvisoVersaoAnterior');
    afirma(await contar(page, '#avpReavaliarBtn') === 0 && await contar(page, '#avpSalvarDecisaoBtn') === 0, 'sem Reavaliar nem edição');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  await browser.close();
  console.log('\n============================');
  console.log(falhas ? falhas + ' FALHA(S)' : 'TODOS OS TESTES PASSARAM');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
