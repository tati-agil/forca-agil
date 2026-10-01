/* Área AVALIAÇÃO (#avaliacoes) × ADMIN: perfis Consulta < Avaliador < Gestor da
 * Avaliação, independentes de ser administrador.
 *
 * Prova, na tela (desktop e celular 375 px), com banco falso em persistenciaReal:
 *   - menu: "Avaliar oficina" (#avaliacao) e "Avaliação" (#avaliacoes) são coisas
 *     diferentes; "Avaliação" só aparece para quem tem perfil; "Admin" só para admin;
 *   - Consulta: só avaliações CONCLUÍDAS (a tela pede a consulta filtrada ANTES de
 *     ligar o ouvinte — o banco falso recusa o nó inteiro, como as regras), sem
 *     criar/continuar/reavaliar/excluir/exportar/reprocessar;
 *   - Avaliador: cria, continua, reavalia e duplica; não exclui, não bloqueia
 *     reprocessamento, não decide, não exporta;
 *   - Gestor: tudo isso mais excluir, bloquear, decidir e exportar;
 *   - independência: admin SEM registro = gestor (transição); admin com registro
 *     "consulta" vale consulta; avaliador NÃO é admin (#admin é barrado);
 *   - "não sei ≠ sem acesso": com o registro do perfil lento, quem abriu
 *     #avaliacoes (F5) NÃO é expulso — espera e entra;
 *   - ADMIN: só parametrização (4 cartões + Usuários e permissões), nada de
 *     avaliar; "Usuários e permissões" pesquisa, grava o perfil e, se o banco
 *     recusar, volta o seletor e avisa (nunca parece salvo sem estar);
 *   - link antigo #admin?avp=… abre a mesma avaliação em #avaliacoes.
 * Hermético: sem rede, sem segredo. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const RAIZ = path.join(__dirname, '..', '..', 'forca-agil');
const MOTOR_VERSION = /var MOTOR_VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(RAIZ, 'avaliacao-produto.js'), 'utf8'))[1];

const chave = (email) => email.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const DESKTOP = { width: 1280, height: 900 };
const CELULAR = { width: 375, height: 800 };

let falhas = 0;
function afirma(cond, msg) { console.log((cond ? '  ok    ' : '  FALHA ') + msg); if (!cond) falhas++; }

function item(nome, i, extra) {
  const respostas = {};
  ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia'].forEach((id) => { respostas[id] = { valor: 'sim', observacao: '', justificativaAuto: 'interpretação ' + id, codigoPergunta: 'P', textoPerguntaNaEpoca: 't', tituloNaEpoca: 't', questionnaireContentVersion: 1 }; });
  ['jornada', 'medicao', 'gestao', 'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'].forEach((id) => { respostas[id] = { valor: 'nao', observacao: '', justificativaAuto: 'interpretação ' + id, codigoPergunta: 'P', textoPerguntaNaEpoca: 't', tituloNaEpoca: 't', questionnaireContentVersion: 1 }; });
  const n = String(i).padStart(2, '0');
  return Object.assign({
    nome: nome, descricao: 'desc ' + i, publico: '', necessidade: '', observacoesGerais: '',
    status: 'concluido', respostas: respostas, resultadoAutomatico: 'produto', decisaoFinal: 'produto', decisaoManual: false,
    camadaSugerida: { id: 'produto-principal', label: 'Produto/Serviço principal', motivos: ['m1'], conflito: null, incoerencia: false, especializacao: null, papelEstrutural: null, relacao: null },
    justificativaAutomatica: 'justificativa gerada ' + i, criteriosEssenciaisFalhos: ['x'], exclusoesConflitantes: null, criteriosAtendidos: 5,
    motorVersion: MOTOR_VERSION, motorVersionArquitetura: 1, questionnaireContentVersion: 1,
    criadoEm: '2026-09-01T10:00:' + n + '.000Z', atualizadoEm: '2026-09-30T10:00:' + n + '.000Z',
    responsavel: { name: 'Teste', email: 'outra@previ.com.br' }, versao: 1, versaoAnteriorKey: null, excluido: false
  }, extra || {});
}
/* 2 concluídas + 1 em andamento */
const AVALIACOES = () => ({
  k1: item('Item Concluído Um', 1),
  k2: item('Item Concluído Dois', 2),
  k3: item('Item Em Andamento', 3, { status: 'em_andamento', resultadoAutomatico: null, decisaoFinal: null })
});

async function abrir(browser, o) {
  const email = o.email;
  const admins = {}; if (o.admin) admins[chave(email)] = { email: email };
  const acessos = {}; if (o.perfil) acessos[chave(email)] = { email: email, perfil: o.perfil };
  const db = Object.assign({ turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': admins, 'turmas-config': {},
    'turmas-checkin': {}, 'turmas-espera': {}, 'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {},
    eventos: {}, 'turmas-publico': {}, 'eventos-publico': {}, 'avaliacoes-produto': AVALIACOES(), 'avaliacoes-squad': {},
    'motor-squad-config': {}, 'motor-squad-auditoria': {}, 'motor-arquitetura-config': {}, 'motor-arquitetura-auditoria': {},
    'fa-avaliacao-acessos': acessos }, o.db || {});
  const cfg = { db: db, user: { email: email, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true,
    delays: o.delays, fail: o.fail, somenteFiltrado: o.perfil === 'consulta' ? ['avaliacoes-produto'] : [] }; /* como as regras: só quem tem "consulta" é obrigado a pedir a consulta filtrada */
  const ctx = await browser.newContext({ viewport: o.viewport || DESKTOP });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + (o.hash || '#avaliacoes'), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.body.classList.contains('aguardando-auth'), { timeout: 16000 }).catch(() => {});
  await page.waitForTimeout(800);
  return { ctx, page, erros };
}
const contar = (page, sel) => page.locator(sel).count();
const banco = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal)));
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const hash = (page) => page.evaluate(() => location.hash);
async function aguardaLista(page) { await page.waitForSelector('#avaliacoesPainel .avp-table tbody tr', { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(300); }
/* o link do menu só é "visível" no desktop; no celular fica dentro do menu recolhido —
   o que importa aqui é estar (ou não) no DOM sem o atributo hidden */
const linkVisivel = (page, sel) => page.evaluate((s) => { const a = document.querySelector(s); return !!a && !a.hidden && getComputedStyle(a).display !== 'none'; }, sel);
async function abrirMais(page, key) {
  await page.click('.avp-act-mais[data-key="' + key + '"]');
  await page.waitForSelector('.avp-menu-acoes-lista', { timeout: 3000 });
  return page.locator('.avp-menu-item').evaluateAll((els) => els.map((e) => e.dataset.acao));
}

(async () => {
  const browser = await chromium.launch();
  const EM = 'pessoa@previ.com.br';

  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    console.log('\n######## ' + nomeTela + ' ########');

    console.log('\n== Menu: "Avaliar oficina" é o feedback da oficina; "Avaliação" é Produto/Serviço ==');
    {
      const { ctx, page, erros } = await abrir(browser, { email: EM, perfil: 'avaliador', viewport, hash: '#home' });
      afirma(await page.locator('a[data-nav-page="avaliacao"]').first().textContent().then((t) => /Avaliar oficina/i.test(t)), 'item "Avaliar oficina" aponta para #avaliacao (feedback da oficina)');
      afirma(await page.locator('a[data-nav-page="avaliacao"]').first().getAttribute('href') === '#avaliacao', 'a rota da oficina continua #avaliacao');
      afirma(await page.locator('a[data-nav-page="avaliacoes"]').first().textContent().then((t) => /^\s*Avalia(ç|c)(ã|a)o\s*$/i.test(t)), 'item "Avaliação" aponta para #avaliacoes (Produto/Serviço)');
      afirma(await linkVisivel(page, '.nav-link-avaliacoes') || viewport.width < 600, 'avaliador vê o item "Avaliação"');
      afirma(await page.evaluate(() => !document.querySelector('.nav-link-avaliacoes').hidden), 'item "Avaliação" liberado (sem hidden) para avaliador');
      afirma(await page.evaluate(() => { const a = document.querySelector('a[data-nav-page="admin"]'); return !a || a.hidden || getComputedStyle(a).display === 'none'; }), 'avaliador NÃO vê "Admin" (não é administrador)');
      afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
      await ctx.close();
    }

    console.log('\n== Consulta: só concluídas, só leitura (consulta filtrada, como as regras do banco) ==');
    {
      const { ctx, page, erros } = await abrir(browser, { email: EM, perfil: 'consulta', viewport });
      await aguardaLista(page);
      afirma(await contar(page, '#avaliacoesPainel .avp-table tbody tr') === 2, 'lista só as 2 concluídas (a em andamento nunca chega)');
      afirma(!/Item Em Andamento/.test(await page.locator('#avaliacoesPainel').innerText()), 'a avaliação em andamento não aparece');
      afirma(await contar(page, '#avpNovoBtn') === 0, 'sem "Avaliar novo item"');
      afirma(await contar(page, '.avp-act-mais') === 0, 'sem menu "⋯" (nenhuma ação de escrita)');
      afirma(await contar(page, '.avp-act-editar') === 0, 'sem "Continuar"');
      afirma(await contar(page, '#avpExportarBtn') === 0 && await contar(page, '#avpReprocessarTudoBtn') === 0 && await contar(page, '#avpLixeiraBtn') === 0, 'sem exportar, reprocessar em lote nem lixeira');
      afirma(await contar(page, '.avp-check-item') === 0, 'sem seleção em lote');
      afirma(await contar(page, '.avp-act-ver') === 2, '"Visualizar" nas 2 concluídas');
      afirma(await larguraOk(page), 'sem rolagem horizontal na página');
      await page.click('.avp-act-ver[data-key="k1"]');
      await page.waitForSelector('#avpVoltarListaResultado', { timeout: 5000 });
      afirma(await contar(page, '#avpReavaliarBtn') === 0, 'resultado: sem REAVALIAR');
      afirma(await contar(page, '#avpReprocessarBtn') === 0 && await contar(page, '#avpReconciliarBtn') === 0, 'resultado: sem reprocessar/reconciliar');
      afirma(await contar(page, '#avpSalvarDecisaoBtn') === 0 && await contar(page, '#avpDecisaoLeitura') === 1, 'resultado: decisão só em leitura (sem formulário)');
      afirma(await contar(page, '#avpGerarPdfBtn') === 0, 'resultado: sem gerar PDF (exportação é do gestor)');
      afirma(await larguraOk(page), 'resultado: sem rolagem horizontal');
      await page.evaluate(() => { location.hash = '#admin'; });
      await page.waitForTimeout(500);
      afirma(await hash(page) === '#home', 'consulta tentando #admin é levada para #home');
      afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
      await ctx.close();
    }

    console.log('\n== Avaliador: cria, continua, reavalia, duplica — não exclui, decide nem exporta ==');
    {
      const { ctx, page, erros } = await abrir(browser, { email: EM, perfil: 'avaliador', viewport });
      await aguardaLista(page);
      afirma(await contar(page, '#avaliacoesPainel .avp-table tbody tr') === 3, 'vê as 3 (inclui a em andamento)');
      afirma(await contar(page, '#avpNovoBtn') === 1, '"Avaliar novo item" presente');
      afirma(await contar(page, '.avp-act-editar[data-key="k3"]') === 1, '"Continuar" na em andamento');
      afirma(await contar(page, '#avpExportarBtn') === 0 && await contar(page, '#avpReprocessarTudoBtn') === 0 && await contar(page, '#avpLixeiraBtn') === 0, 'sem exportar, reprocessar em lote nem lixeira');
      afirma(await contar(page, '.avp-check-item') === 0, 'sem seleção em lote (serve à exportação)');
      let acoes = await abrirMais(page, 'k1');
      afirma(acoes.indexOf('reavaliar') !== -1 && acoes.indexOf('duplicar') !== -1, 'menu ⋯ (concluída): Reavaliar e Duplicar — ' + acoes.join(','));
      afirma(acoes.indexOf('excluir') === -1 && acoes.indexOf('bloquear') === -1 && acoes.indexOf('desbloquear') === -1, 'menu ⋯: SEM Excluir nem Bloquear reprocessamento');
      await page.click('#avpMenuAcoesFechar');
      acoes = await abrirMais(page, 'k3');
      afirma(acoes.indexOf('editar') !== -1 && acoes.indexOf('excluir') === -1, 'menu ⋯ (em andamento): Editar, sem Excluir — ' + acoes.join(','));
      await page.click('#avpMenuAcoesFechar');
      await page.click('.avp-act-ver[data-key="k1"]');
      await page.waitForSelector('#avpVoltarListaResultado', { timeout: 5000 });
      afirma(await contar(page, '#avpReavaliarBtn') === 1, 'resultado: REAVALIAR presente');
      afirma(await contar(page, '#avpSalvarDecisaoBtn') === 0 && await contar(page, '#avpDecisaoLeitura') === 1, 'resultado: decisão só em leitura (sem formulário)');
      afirma(await larguraOk(page), 'resultado: sem rolagem horizontal');
      await page.click('#avpVoltarListaResultado');
      await page.waitForSelector('#avpNovoBtn');
      await page.evaluate(() => { location.hash = '#admin'; });
      await page.waitForTimeout(500);
      afirma(await hash(page) === '#home', 'avaliador NÃO é administrador: #admin é barrado');
      afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
      await ctx.close();
    }

    console.log('\n== Gestor da Avaliação (sem ser admin): tudo da avaliação, nada do Admin ==');
    {
      const { ctx, page, erros } = await abrir(browser, { email: EM, perfil: 'gestor', viewport });
      await aguardaLista(page);
      afirma(await contar(page, '#avpNovoBtn') === 1 && await contar(page, '#avpExportarBtn') === 1 && await contar(page, '#avpLixeiraBtn') === 1, 'novo, exportar e lixeira presentes');
      afirma(await contar(page, '.avp-check-item') === 3, 'seleção em lote (exportação)');
      const acoes = await abrirMais(page, 'k1');
      afirma(acoes.indexOf('excluir') !== -1 && acoes.indexOf('bloquear') !== -1 && acoes.indexOf('reavaliar') !== -1, 'menu ⋯: Reavaliar, Bloquear reprocessamento e Excluir — ' + acoes.join(','));
      await page.click('#avpMenuAcoesFechar');
      await page.click('.avp-act-ver[data-key="k1"]');
      await page.waitForSelector('#avpVoltarListaResultado', { timeout: 5000 });
      afirma(await contar(page, '#avpReavaliarBtn') === 1, 'resultado: REAVALIAR');
      afirma(await contar(page, '#avpSalvarDecisaoBtn') === 1 && await contar(page, '#avpDecisaoLeitura') === 0, 'resultado: decisão final editável (gestor)');
      afirma(await contar(page, '#avpGerarPdfBtn') === 1, 'resultado: GERAR PDF (gestor)');
      await page.evaluate(() => { location.hash = '#admin'; });
      await page.waitForTimeout(500);
      afirma(await hash(page) === '#home', 'gestor da avaliação NÃO é administrador: #admin é barrado');
      afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
      await ctx.close();
    }

    console.log('\n== Independência: ser admin ≠ ter perfil de avaliação ==');
    {
      /* transição: admin SEM registro = gestor (não perde o que já fazia) */
      let r = await abrir(browser, { email: EM, admin: true, viewport });
      await aguardaLista(r.page);
      afirma(await contar(r.page, '#avpNovoBtn') === 1 && await contar(r.page, '#avpExportarBtn') === 1, 'admin sem registro: comporta-se como gestor (transição)');
      afirma(await contar(r.page, '.avp-act-mais') === 3, 'admin sem registro: menu ⋯ em todas as linhas');
      await r.ctx.close();
      /* admin com registro "consulta": o registro explícito vence */
      r = await abrir(browser, { email: EM, admin: true, perfil: 'consulta', viewport });
      await aguardaLista(r.page);
      afirma(await contar(r.page, '#avaliacoesPainel .avp-table tbody tr') === 2, 'admin com perfil "consulta": só as concluídas');
      afirma(await contar(r.page, '#avpNovoBtn') === 0 && await contar(r.page, '.avp-act-mais') === 0, 'admin com perfil "consulta": sem escrita');
      await r.page.evaluate(() => { location.hash = '#admin'; });
      await r.page.waitForTimeout(500);
      afirma(await hash(r.page) === '#admin', 'mas continua administrador: #admin abre');
      await r.ctx.close();
      /* admin com registro "nenhum": sem acesso à área, mas ainda admin */
      r = await abrir(browser, { email: EM, admin: true, perfil: 'nenhum', viewport });
      await r.page.waitForTimeout(400);
      afirma(await hash(r.page) === '#home', 'admin com perfil "nenhum": #avaliacoes leva para #home');
      afirma(await r.page.evaluate(() => document.querySelector('.nav-link-avaliacoes').hidden), 'e o item "Avaliação" some do menu');
      await r.ctx.close();
      /* sem perfil e sem admin: sem acesso */
      r = await abrir(browser, { email: EM, viewport });
      await r.page.waitForTimeout(400);
      afirma(await hash(r.page) === '#home', 'sem perfil e sem admin: #avaliacoes leva para #home');
      afirma(await r.page.evaluate(() => document.querySelector('.nav-link-avaliacoes').hidden), 'item "Avaliação" oculto');
      await r.ctx.close();
    }
  }

  console.log('\n== "Não sei" não é "sem acesso": registro do perfil lento, F5 direto em #avaliacoes ==');
  {
    const { ctx, page, erros } = await abrir(browser, { email: EM, perfil: 'avaliador', delays: { 'fa-avaliacao-acessos': 3500 } });
    await page.waitForTimeout(800);
    afirma(await hash(page) === '#avaliacoes', 'enquanto o perfil não chega, continua em #avaliacoes (não é expulso)');
    await page.waitForSelector('#avpNovoBtn', { timeout: 9000 });
    await page.waitForTimeout(400);
    afirma(await hash(page) === '#avaliacoes' && await contar(page, '#avaliacoesPainel .avp-table tbody tr') === 3, 'quando chega: entra e carrega as 3 (incluindo a em andamento — pede o nó certo para o perfil)');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }
  console.log('\n== Lista de admins lenta (a transição depende dela) — a lista não pode ficar vazia para sempre ==');
  {
    const { ctx, page, erros } = await abrir(browser, { email: EM, admin: true, delays: { 'fa-admins': 3500 } });
    await page.waitForSelector('#avpNovoBtn', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);
    afirma(await contar(page, '#avaliacoesPainel .avp-table tbody tr') === 3, 'admin (sem registro) com fa-admins lento: as 3 avaliações carregam');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  console.log('\n== Link antigo #admin?avp=<chave> abre a avaliação em #avaliacoes ==');
  {
    const { ctx, page, erros } = await abrir(browser, { email: EM, perfil: 'avaliador', hash: '#admin?avp=k1' });
    await page.waitForSelector('#avpVoltarListaResultado', { timeout: 8000 }).catch(() => {});
    afirma(/^#avaliacoes\?avp=k1/.test(await hash(page)), 'a URL foi reescrita para #avaliacoes?avp=k1');
    afirma(await contar(page, '#avpVoltarListaResultado') === 1, 'a avaliação abriu');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    console.log('\n== ADMIN só parametriza (' + nomeTela + ') ==');
    const users = {};
    users[chave('ana@previ.com.br')] = { email: 'ana@previ.com.br', name: 'Ana Souza' };
    users[chave('bruno@previ.com.br')] = { email: 'bruno@previ.com.br', name: 'Bruno Lima' };
    users[chave('carla@previ.com.br')] = { email: 'carla@previ.com.br', name: 'Carla Dias' };
    const acessos = {}; acessos[chave('bruno@previ.com.br')] = { email: 'bruno@previ.com.br', nome: 'Bruno Lima', perfil: 'avaliador' };
    const { ctx, page, erros } = await abrir(browser, { email: EM, admin: true, viewport, hash: '#admin',
      db: { 'fa-users': users, 'fa-avaliacao-acessos': acessos }, fail: [] });
    await page.click('.admin-tab-btn[data-panel="adminPanelArquitetura"]');
    await page.waitForSelector('#avpConfigQuestionariosBtn', { timeout: 8000 });
    afirma(await contar(page, '#avpConfigQuestionariosBtn') === 1 && await contar(page, '#avpConfigMotoresBtn') === 1 && await contar(page, '#avpConfigNaturezasBtn') === 1, 'Admin: Questionários, Motores e Naturezas Complementares');
    afirma(await contar(page, '#avpAdequacaoSquadListaBtn') === 1 && await contar(page, '#avpUsuariosBtn') === 1, 'Admin: Adequação à Squad e Usuários e permissões');
    afirma(await contar(page, '#adminAvaliacaoProduto #avpNovoBtn') === 0 && await contar(page, '#adminAvaliacaoProduto .avp-table') === 0, 'Admin NÃO tem lista nem "Avaliar novo item" (isso é da área Avaliação)');
    afirma(await larguraOk(page), 'sem rolagem horizontal');
    await page.click('#avpUsuariosBtn');
    await page.waitForSelector('#avpUsuariosBusca', { timeout: 8000 });
    afirma(await contar(page, '#avpUsuariosCorpo tr[data-key]') >= 4, 'usuários listados (3 cadastrados + o administrador da sessão e os super-admins)');
    afirma(await page.locator('.avp-usuario-perfil[data-key="' + chave('bruno@previ.com.br') + '"]').inputValue() === 'avaliador', 'perfil atual de Bruno: Avaliador');
    afirma(await page.locator('.avp-usuario-perfil[data-key="' + chave('ana@previ.com.br') + '"]').inputValue() === 'nenhum', 'Ana (sem registro, não-admin): Sem acesso');
    await page.fill('#avpUsuariosBusca', 'carla');
    await page.waitForTimeout(150);
    afirma(await contar(page, '#avpUsuariosCorpo tr[data-key]') === 1, 'pesquisa por nome filtra para 1');
    await page.fill('#avpUsuariosBusca', 'bruno@previ');
    await page.waitForTimeout(150);
    afirma(await contar(page, '#avpUsuariosCorpo tr[data-key]') === 1, 'pesquisa por e-mail filtra para 1');
    await page.fill('#avpUsuariosBusca', 'zzzz');
    await page.waitForTimeout(150);
    afirma(/Nenhum usuário encontrado/.test(await page.locator('#avpUsuariosCorpo').innerText()), 'sem resultado: "Nenhum usuário encontrado."');
    await page.fill('#avpUsuariosBusca', '');
    await page.waitForTimeout(150);
    await page.selectOption('.avp-usuario-perfil[data-key="' + chave('ana@previ.com.br') + '"]', 'gestor');
    await page.waitForFunction(() => /✓ Salvo/.test(document.getElementById('avpUsuariosCorpo').innerText), { timeout: 5000 }).catch(() => {});
    const reg = ((await banco(page))['fa-avaliacao-acessos'] || {})[chave('ana@previ.com.br')];
    afirma(reg && reg.perfil === 'gestor' && reg.email === 'ana@previ.com.br' && !!reg.atribuidoPor && !!reg.atribuidoEm, 'trocar o perfil GRAVOU em fa-avaliacao-acessos (perfil, e-mail, quem atribuiu e quando)');
    afirma(await larguraOk(page), 'usuários: sem rolagem horizontal');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  console.log('\n== Usuários e permissões: se o banco recusar, o seletor volta e avisa ==');
  {
    const users = {}; users[chave('ana@previ.com.br')] = { email: 'ana@previ.com.br', name: 'Ana Souza' };
    const { ctx, page, erros } = await abrir(browser, { email: EM, admin: true, hash: '#admin', db: { 'fa-users': users }, fail: ['fa-avaliacao-acessos/' + chave('ana@previ.com.br')] });
    await page.click('.admin-tab-btn[data-panel="adminPanelArquitetura"]');
    await page.waitForSelector('#avpUsuariosBtn', { timeout: 8000 });
    await page.click('#avpUsuariosBtn');
    await page.waitForSelector('#avpUsuariosBusca', { timeout: 8000 });
    await page.selectOption('.avp-usuario-perfil[data-key="' + chave('ana@previ.com.br') + '"]', 'avaliador');
    await page.waitForFunction(() => /Não foi possível salvar/.test(document.getElementById('avpUsuariosCorpo').innerText), { timeout: 5000 }).catch(() => {});
    afirma(/Não foi possível salvar/.test(await page.locator('#avpUsuariosCorpo').innerText()), 'erro visível: "Não foi possível salvar"');
    afirma(await page.locator('.avp-usuario-perfil[data-key="' + chave('ana@previ.com.br') + '"]').inputValue() === 'nenhum', 'o seletor voltou ao valor de antes (não parece salvo)');
    afirma(!((await banco(page))['fa-avaliacao-acessos'] || {})[chave('ana@previ.com.br')], 'nada foi gravado');
    await ctx.close();
  }

  console.log('\n== Usuários e permissões: só super-admin mexe no acesso administrativo ==');
  {
    const users = {}; users[chave('ana@previ.com.br')] = { email: 'ana@previ.com.br', name: 'Ana Souza' };
    const { ctx, page } = await abrir(browser, { email: EM, admin: true, hash: '#admin', db: { 'fa-users': users } });
    await page.click('.admin-tab-btn[data-panel="adminPanelArquitetura"]');
    await page.waitForSelector('#avpUsuariosBtn', { timeout: 8000 });
    await page.click('#avpUsuariosBtn');
    await page.waitForSelector('#avpUsuariosBusca', { timeout: 8000 });
    afirma(await contar(page, '.avp-usuario-admin') === 0, 'admin comum não vê "Tornar administrador" (as regras só aceitam os super-admins)');
    await ctx.close();
  }
  {
    const users = {}; users[chave('ana@previ.com.br')] = { email: 'ana@previ.com.br', name: 'Ana Souza' };
    const SUPER = 'tatianefdirene@previ.com.br';
    const { ctx, page } = await abrir(browser, { email: SUPER, admin: true, hash: '#admin', db: { 'fa-users': users } });
    await page.click('.admin-tab-btn[data-panel="adminPanelArquitetura"]');
    await page.waitForSelector('#avpUsuariosBtn', { timeout: 8000 });
    await page.click('#avpUsuariosBtn');
    await page.waitForSelector('#avpUsuariosBusca', { timeout: 8000 });
    afirma(await contar(page, '.avp-usuario-admin[data-key="' + chave('ana@previ.com.br') + '"]') === 1, 'super-admin vê "Tornar administrador"');
    await ctx.close();
  }

  await browser.close();
  console.log('\n============================');
  console.log(falhas ? falhas + ' FALHA(S)' : 'TODOS OS TESTES PASSARAM');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
