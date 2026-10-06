/* ACESSOS da aba AVALIAÇÃO (#avaliacoes) e do ADMIN > ARQUITETURA.
 *
 * Modelo (fa-avaliacao-autorizados/<emailKey>.tipo), independente de qualquer
 * outro acesso do site:
 *   avaliacao             — usa a aba AVALIAÇÃO; não entra no ADMIN;
 *   avaliacao-arquitetura — aba AVALIAÇÃO + SOMENTE ADMIN > ARQUITETURA;
 *   fora da lista         — nada. O perfil antigo (consulta/avaliador/gestor em
 *                           fa-avaliacao-acessos) não vale para nada.
 * Admin geral entra em tudo por ser admin, sem precisar estar na lista.
 *
 * Prova, na tela (desktop e celular 375 px), com banco falso em persistenciaReal:
 *   - menu: "Avaliar oficina" (#avaliacao) × "Avaliação" (#avaliacoes);
 *   - tipo "Avaliação": opera a aba inteira; #admin é barrado;
 *   - tipo "Avaliação + Arquitetura": #admin abre SÓ com a aba Arquitetura (as
 *     outras abas/painéis não existem na tela), sem "Usuários autorizados" e sem
 *     NENHUMA gravação fora do que ele mesmo faz;
 *   - perfil antigo não concede nada; usuário comum não entra;
 *   - "não sei ≠ sem acesso": com o registro lento, F5 em #avaliacoes e em
 *     #admin NÃO expulsa;
 *   - "Usuários autorizados" (admin geral): lista só autorizados, adiciona
 *     procurando entre os cadastrados, altera o tipo, remove (só a autorização)
 *     e grava histórico no mesmo update; se o banco recusar, nada parece salvo.
 * Hermético: sem rede, sem segredo. */
const { chromium } = require('playwright');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
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
  k3: item('Item Em Andamento', 3, { status: 'rascunho', resultadoAutomatico: null, decisaoFinal: null })
});

async function abrir(browser, o) {
  const email = o.email;
  const admins = {}; if (o.admin) admins[chave(email)] = { email: email };
  const autorizados = {}; if (o.tipo) autorizados[chave(email)] = { email: email, nome: email, tipo: o.tipo, concedidoPor: 'tatianefdirene@previ.com.br', concedidoEm: '2026-10-01T10:00:00.000Z' };
  const acessos = {}; if (o.perfilAntigo) acessos[chave(email)] = { email: email, perfil: o.perfilAntigo };
  const db = Object.assign({ turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': admins, 'turmas-config': {},
    'turmas-checkin': {}, 'turmas-espera': {}, 'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {},
    eventos: {}, 'turmas-publico': {}, 'eventos-publico': {}, 'avaliacoes-produto': AVALIACOES(), 'avaliacoes-squad': {},
    'motor-squad-config': {}, 'motor-squad-auditoria': {}, 'motor-arquitetura-config': {}, 'motor-arquitetura-auditoria': {},
    'fa-avaliacao-acessos': acessos, 'fa-avaliacao-autorizados': autorizados, 'fa-avaliacao-autorizados-auditoria': {} }, o.db || {});
  const cfg = { db: db, user: { email: email, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true,
    delays: o.delays, fail: o.fail };
  const ctx = await browser.newContext({ viewport: o.viewport || DESKTOP });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + (o.hash || '#avaliacoes'), { waitUntil: 'domcontentloaded' });
  /* login decidido e acessos resolvidos (antes: opções no lugar do argumento, engolida + 800 ms fixos); quando o
     cenário derruba a leitura de fa-avaliacao-autorizados, o acesso à Avaliação fica "não sei" por desenho */
  await esperarSessaoAssentada(page, { semAvaliacao: (o.fail || []).some((c) => /^fa-avaliacao-autorizados/.test(c)) });
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
  const SUPER = 'tatianefdirene@previ.com.br';
  const visivelAdmin = (page) => page.evaluate(() => { const a = document.querySelector('a[data-nav-page="admin"]'); return !!a && !a.hidden && getComputedStyle(a).display !== 'none'; });

  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    console.log('\n######## ' + nomeTela + ' ########');

    console.log('\n== Menu: "Avaliar oficina" é o feedback da oficina; "Avaliação" é Produto/Serviço ==');
    {
      const { ctx, page, erros } = await abrir(browser, { email: EM, tipo: 'avaliacao', viewport, hash: '#home' });
      afirma(await page.locator('a[data-nav-page="avaliacao"]').first().textContent().then((t) => /Avaliar oficina/i.test(t)), 'item "Avaliar oficina" aponta para #avaliacao (feedback da oficina)');
      afirma(await page.locator('a[data-nav-page="avaliacao"]').first().getAttribute('href') === '#avaliacao', 'a rota da oficina continua #avaliacao');
      afirma(await page.locator('a[data-nav-page="avaliacoes"]').first().textContent().then((t) => /^\s*Avalia(ç|c)(ã|a)o\s*$/i.test(t)), 'item "Avaliação" aponta para #avaliacoes (Produto/Serviço)');
      afirma(await page.evaluate(() => !document.querySelector('.nav-link-avaliacoes').hidden), 'tipo "Avaliação" vê o item "Avaliação"');
      afirma(!(await visivelAdmin(page)), 'tipo "Avaliação" NÃO vê "Admin"');
      afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
      await ctx.close();
    }

    console.log('\n== Tipo "Avaliação": opera a aba inteira — e só ela ==');
    {
      const { ctx, page, erros } = await abrir(browser, { email: EM, tipo: 'avaliacao', viewport });
      await aguardaLista(page);
      afirma(await contar(page, '#avaliacoesPainel .avp-table tbody tr') === 3, 'vê as 3 (inclui a em andamento)');
      afirma(await contar(page, '#avpNovoBtn') === 1 && await contar(page, '#avpExportarBtn') === 1 && await contar(page, '#avpLixeiraBtn') === 1, 'novo, exportar e lixeira presentes');
      afirma(await contar(page, '.avp-act-editar[data-key="k3"]') === 1, '"Continuar" na em andamento');
      afirma(await contar(page, '.avp-check-item') === 3, 'seleção em lote (exportação)');
      const acoes = await abrirMais(page, 'k1');
      afirma(acoes.indexOf('reavaliar') !== -1 && acoes.indexOf('duplicar') !== -1 && acoes.indexOf('excluir') !== -1 && acoes.indexOf('bloquear') !== -1, 'menu ⋯: Reavaliar, Duplicar, Bloquear reprocessamento e Excluir — ' + acoes.join(','));
      await page.click('#avpMenuAcoesFechar');
      await page.click('.avp-act-ver[data-key="k1"]');
      await page.waitForSelector('#avpVoltarListaResultado', { timeout: 5000 });
      afirma(await contar(page, '#avpReavaliarBtn') === 1, 'resultado: REAVALIAR');
      /* Avaliar ≠ decidir: curadoria e decisão final são da Arquitetura (o banco também recusa —
         teste-rules-perfis-avaliacao.js). Aqui a pessoa vê as duas, só para consulta. */
      afirma(await contar(page, '#avpSalvarDecisaoBtn') === 0 && await contar(page, '#avpDecisaoLeitura') === 1, 'resultado: decisão final SÓ PARA CONSULTA (decidir é da Arquitetura)');
      afirma(await contar(page, '#avpCuradoriaCard') === 0 && await contar(page, '#avpCuradoriaLeitura') === 1, 'resultado: curadoria SÓ PARA CONSULTA (curadoria é da Arquitetura)');
      afirma(await contar(page, '#avpGerarPdfBtn') === 1, 'resultado: GERAR PDF');
      afirma(await larguraOk(page), 'resultado: sem rolagem horizontal');
      await page.evaluate(() => { location.hash = '#admin'; });
      await page.waitForTimeout(500);
      afirma(await hash(page) === '#home', 'tipo "Avaliação" tentando #admin é levado para #home');
      afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
      await ctx.close();
    }

    console.log('\n== Tipo "Avaliação + Arquitetura": aba AVALIAÇÃO + SOMENTE a Arquitetura do ADMIN ==');
    {
      const { ctx, page, erros } = await abrir(browser, { email: EM, tipo: 'avaliacao-arquitetura', viewport });
      await aguardaLista(page);
      await page.click('.avp-act-ver[data-key="k1"]');
      await page.waitForSelector('#avpVoltarListaResultado', { timeout: 5000 });
      afirma(await contar(page, '#avpSalvarDecisaoBtn') === 1 && await contar(page, '#avpDecisaoLeitura') === 0, 'resultado: decisão final editável (Arquitetura decide)');
      afirma(await contar(page, '#avpCuradoriaCard') === 1, 'resultado: curadoria editável (Arquitetura faz a curadoria)');
      await page.click('#avpVoltarListaResultado');
      await aguardaLista(page);
      afirma(await contar(page, '#avpNovoBtn') === 1, 'a aba AVALIAÇÃO opera normalmente');
      afirma(await page.evaluate(() => { const a = document.querySelector('a[data-nav-page="admin"]'); return !!a && !a.hidden; }), 'o menu passa a mostrar "Admin" (leva só à Arquitetura)');
      await page.evaluate(() => { location.hash = '#admin'; });
      await page.waitForSelector('#avpConfigQuestionariosBtn', { timeout: 8000 }).catch(() => {});
      afirma(/^#admin(\?arq=inicio)?$/.test(await hash(page)), '#admin abre (' + await hash(page) + ')');
      afirma(await page.evaluate(() => !document.getElementById('adminContent').hidden && document.getElementById('adminGuard').hidden), 'conteúdo do ADMIN visível, sem aviso de "Acesso restrito"');
      const abas = await page.evaluate(() => Array.from(document.querySelectorAll('.admin-tab-btn')).filter((b) => !b.hidden && b.offsetParent !== null).map((b) => b.textContent.trim()));
      afirma(abas.length <= 1, 'nenhuma aba do ADMIN além da Arquitetura aparece no menu de abas — ' + JSON.stringify(abas));
      const paineis = await page.evaluate(() => Array.from(document.querySelectorAll('.admin-tab-panel')).filter((p) => !p.hidden && p.offsetParent !== null).map((p) => p.id));
      afirma(paineis.length === 1 && paineis[0] === 'adminPanelArquitetura', 'o único painel visível é o da Arquitetura — ' + JSON.stringify(paineis));
      await esperarCondicao(page, () => !!document.getElementById('avpMotorSquadInicioBtn'), null, { descricao: 'o cartão "Motor de Squad" aparecer na Arquitetura' });
      afirma(await contar(page, '#avpConfigQuestionariosBtn') === 1 && await contar(page, '#avpConfigMotoresBtn') === 1 && await contar(page, '#avpConfigNaturezasBtn') === 1 && await contar(page, '#avpMotorSquadInicioBtn') === 1, 'Questionários, Motores, Naturezas e Motor de Squad disponíveis');
      afirma(await contar(page, '#avpUsuariosBtn') === 0, 'SEM "Usuários autorizados" (só admin geral gerencia a lista)');
      afirma(await page.evaluate(() => { const c = document.querySelector('#adminCadastrados, #adminInteresses, #adminAdmins'); return !c || c.offsetParent === null; }), 'Cadastrados, Eventos e Administradores não estão na tela');
      afirma(await larguraOk(page), 'sem rolagem horizontal');
      const escritas = await page.evaluate(() => (window.__ESCRITAS || []).length);
      afirma(escritas === 0, 'abrir o ADMIN não gravou nada no banco (migrações do admin geral NÃO rodam) — ' + escritas + ' escritas');
      afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
      await ctx.close();
    }

    console.log('\n== Perfil ANTIGO (Consulta/Avaliador/Gestor) não concede nada ==');
    for (const perfil of ['consulta', 'avaliador', 'gestor']) {
      const { ctx, page, erros } = await abrir(browser, { email: EM, perfilAntigo: perfil, viewport });
      await page.waitForTimeout(400);
      afirma(await hash(page) === '#home', 'perfil antigo "' + perfil + '": #avaliacoes leva para #home');
      afirma(await page.evaluate(() => document.querySelector('.nav-link-avaliacoes').hidden), 'perfil antigo "' + perfil + '": item "Avaliação" oculto');
      await page.evaluate(() => { location.hash = '#admin'; });
      await page.waitForTimeout(400);
      afirma(await hash(page) === '#home', 'perfil antigo "' + perfil + '": #admin barrado');
      afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
      await ctx.close();
    }
    {
      const r = await abrir(browser, { email: EM, viewport });
      await r.page.waitForTimeout(400);
      afirma(await hash(r.page) === '#home', 'usuário comum: #avaliacoes leva para #home');
      afirma(await r.page.evaluate(() => document.querySelector('.nav-link-avaliacoes').hidden), 'usuário comum: item "Avaliação" oculto');
      await r.ctx.close();
    }

    console.log('\n== Admin geral: acesso total por ser admin, mesmo sem estar na lista (e mesmo com perfil antigo) ==');
    for (const antigo of [null, 'nenhum', 'consulta']) {
      const r = await abrir(browser, { email: EM, admin: true, perfilAntigo: antigo, viewport });
      await aguardaLista(r.page);
      afirma(await contar(r.page, '#avpNovoBtn') === 1 && await contar(r.page, '#avpExportarBtn') === 1 && await contar(r.page, '.avp-act-mais') === 3,
        'admin geral' + (antigo ? ' (perfil antigo "' + antigo + '" ignorado)' : ' sem registro algum') + ': opera a aba inteira (as 3 avaliações)');
      await r.page.evaluate(() => { location.hash = '#admin'; });
      await r.page.waitForTimeout(500);
      const abas = await r.page.evaluate(() => Array.from(document.querySelectorAll('.admin-tab-btn')).filter((b) => !b.hidden).length);
      afirma(await hash(r.page) === '#admin' && abas >= 10, '#admin abre com todas as abas (' + abas + ')');
      await r.ctx.close();
    }
  }

  console.log('\n== "Não sei" não é "sem acesso": registro de acesso lento, F5 direto ==');
  {
    const { ctx, page, erros } = await abrir(browser, { email: EM, tipo: 'avaliacao', delays: { 'fa-avaliacao-autorizados': 3500 } });
    await page.waitForTimeout(800);
    afirma(await hash(page) === '#avaliacoes', 'enquanto o registro não chega, continua em #avaliacoes (não é expulso)');
    await page.waitForSelector('#avpNovoBtn', { timeout: 9000 });
    await page.waitForTimeout(400);
    afirma(await hash(page) === '#avaliacoes' && await contar(page, '#avaliacoesPainel .avp-table tbody tr') === 3, 'quando chega: entra e carrega as 3');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }
  {
    const { ctx, page, erros } = await abrir(browser, { email: EM, tipo: 'avaliacao-arquitetura', hash: '#admin', delays: { 'fa-avaliacao-autorizados': 3500 } });
    await page.waitForTimeout(800);
    afirma(/^#admin(\?arq=inicio)?$/.test(await hash(page)), 'F5 em #admin com o registro lento: não é expulso enquanto espera (' + await hash(page) + ')');
    await page.waitForSelector('#avpConfigQuestionariosBtn', { timeout: 10000 }).catch(() => {});
    afirma(/^#admin(\?arq=inicio)?$/.test(await hash(page)) && await contar(page, '#avpConfigQuestionariosBtn') === 1, 'quando chega: a Arquitetura carrega (' + await hash(page) + ')');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }
  {
    const { ctx, page, erros } = await abrir(browser, { email: EM, admin: true, delays: { 'fa-admins': 3500 } });
    await page.waitForSelector('#avpNovoBtn', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);
    afirma(await contar(page, '#avaliacoesPainel .avp-table tbody tr') === 3, 'admin geral com fa-admins lento: as 3 avaliações carregam');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }
  {
    const { ctx, page } = await abrir(browser, { email: EM, hash: '#admin', delays: { 'fa-avaliacao-autorizados': 2500 } });
    await page.waitForTimeout(3500);
    afirma(await hash(page) === '#home', 'usuário comum: depois de saber que não tem acesso, #admin leva para #home');
    await ctx.close();
  }

  console.log('\n== Link antigo #admin?avp=<chave> abre a avaliação em #avaliacoes ==');
  {
    const { ctx, page, erros } = await abrir(browser, { email: EM, tipo: 'avaliacao', hash: '#admin?avp=k1' });
    await page.waitForSelector('#avpVoltarListaResultado', { timeout: 8000 }).catch(() => {});
    afirma(/^#avaliacoes\?avp=k1/.test(await hash(page)), 'a URL foi reescrita para #avaliacoes?avp=k1');
    afirma(await contar(page, '#avpVoltarListaResultado') === 1, 'a avaliação abriu');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    console.log('\n== ADMIN: Usuários autorizados (' + nomeTela + ') ==');
    const users = {};
    users[chave('ana@previ.com.br')] = { email: 'ana@previ.com.br', name: 'Ana Souza' };
    users[chave('bruno@previ.com.br')] = { email: 'bruno@previ.com.br', name: 'Bruno Lima' };
    users[chave('carla@previ.com.br')] = { email: 'carla@previ.com.br', name: 'Carla Dias' };
    const aut = {}; aut[chave('bruno@previ.com.br')] = { email: 'bruno@previ.com.br', nome: 'Bruno Lima', tipo: 'avaliacao-arquitetura', concedidoPor: SUPER, concedidoPorNome: 'Tatiane', concedidoEm: '2026-10-01T10:00:00.000Z' };
    const antigos = {}; antigos[chave('carla@previ.com.br')] = { email: 'carla@previ.com.br', perfil: 'gestor' };
    const { ctx, page, erros } = await abrir(browser, { email: SUPER, admin: true, viewport, hash: '#admin',
      db: { 'fa-users': users, 'fa-avaliacao-autorizados': aut, 'fa-avaliacao-acessos': antigos } });
    await page.click('.admin-tab-btn[data-panel="adminPanelArquitetura"]');
    await page.waitForSelector('#avpUsuariosBtn', { timeout: 8000 });
    afirma(await contar(page, '#avpUsuariosBtn') === 1, 'admin geral vê o cartão "Usuários autorizados"');
    await page.click('#avpUsuariosBtn');
    await page.waitForSelector('#avpUsuariosBusca', { timeout: 8000 });
    afirma(await contar(page, '#avpAutLista .avp-aut-item') === 1, 'a lista mostra SÓ os autorizados (1) — não os 3 cadastrados');
    afirma(/Bruno Lima/.test(await page.locator('#avpAutLista').innerText()) && !/Ana Souza|Carla Dias/.test(await page.locator('#avpAutLista').innerText()), 'só Bruno aparece (Carla, que tem perfil antigo "gestor", NÃO aparece)');
    afirma(await page.locator('.avp-aut-tipo-sel[data-key="' + chave('bruno@previ.com.br') + '"]').inputValue() === 'avaliacao-arquitetura', 'tipo de Bruno: Avaliação + Arquitetura');
    afirma(/Tatiane/.test(await page.locator('#avpAutLista').innerText()), 'mostra quem concedeu e quando');
    afirma(await contar(page, '.avp-aut-matriz tbody tr') === 5, 'matriz de acessos por tipo exibida (inclui "Curadoria e decisão arquitetural")');
    afirma(await larguraOk(page), 'sem rolagem horizontal');

    /* adicionar: procura entre os cadastrados, sem base paralela */
    await page.click('#avpAutAdicionarBtn');
    await page.fill('#avpAutBuscaAdd', 'a');
    afirma(/pelo menos 2 letras/.test(await page.locator('#avpAutResultados').innerText()), 'busca curta pede pelo menos 2 letras');
    await page.fill('#avpAutBuscaAdd', 'bruno');
    afirma(await contar(page, '#avpAutResultados .avp-aut-item') === 0, 'quem já está autorizado (Bruno) não aparece como candidato');
    await page.fill('#avpAutBuscaAdd', 'ana');
    afirma(await contar(page, '#avpAutResultados .avp-aut-item') === 1, 'procura "ana" → Ana Souza');
    afirma(await page.locator('.avp-aut-novo-tipo[data-key="' + chave('ana@previ.com.br') + '"]').inputValue() === 'avaliacao', 'tipo padrão ao adicionar: Avaliação (o menor acesso)');
    afirma(await larguraOk(page), 'adicionar: sem rolagem horizontal');
    await page.click('.avp-aut-autorizar[data-key="' + chave('ana@previ.com.br') + '"]');
    await page.waitForFunction(() => /agora tem acesso/.test((document.getElementById('avpUsuariosFlash') || {}).innerText || ''), { timeout: 5000 }).catch(() => {});
    let b = await banco(page);
    const regAna = (b['fa-avaliacao-autorizados'] || {})[chave('ana@previ.com.br')];
    afirma(regAna && regAna.tipo === 'avaliacao' && regAna.email === 'ana@previ.com.br' && regAna.concedidoPor === SUPER && !!regAna.concedidoEm, 'autorizar GRAVOU em fa-avaliacao-autorizados (tipo, e-mail, quem concedeu e quando)');
    let hist = Object.keys(b['fa-avaliacao-autorizados-auditoria'] || {}).map((k) => b['fa-avaliacao-autorizados-auditoria'][k]);
    afirma(hist.length === 1 && hist[0].acao === 'concedido' && hist[0].email === 'ana@previ.com.br' && hist[0].tipoNovo === 'avaliacao' && hist[0].por === SUPER && !!hist[0].em, 'e gravou o histórico "concedido" na mesma gravação');
    afirma(await contar(page, '#avpAutLista .avp-aut-item') === 2, 'Ana entrou na lista de autorizados');
    afirma(Object.keys(b['fa-avaliacao-acessos'] || {}).length === 1 && b['fa-avaliacao-acessos'][chave('carla@previ.com.br')].perfil === 'gestor', 'o perfil antigo continua intacto (não foi lido, convertido nem apagado)');

    /* alterar o tipo */
    await page.selectOption('.avp-aut-tipo-sel[data-key="' + chave('ana@previ.com.br') + '"]', 'avaliacao-arquitetura');
    await page.waitForFunction((k) => { const r = window.__CFG.__dbReal['fa-avaliacao-autorizados']; return r && r[k] && r[k].tipo === 'avaliacao-arquitetura'; }, chave('ana@previ.com.br'), { timeout: 5000 }).catch(() => {});
    b = await banco(page);
    const regAna2 = b['fa-avaliacao-autorizados'][chave('ana@previ.com.br')];
    afirma(regAna2.tipo === 'avaliacao-arquitetura' && regAna2.alteradoPor === SUPER && !!regAna2.alteradoEm && regAna2.concedidoPor === SUPER && regAna2.concedidoEm === regAna.concedidoEm, 'alterar o tipo grava quem/quando alterou e PRESERVA quem/quando concedeu');
    hist = Object.keys(b['fa-avaliacao-autorizados-auditoria']).map((k) => b['fa-avaliacao-autorizados-auditoria'][k]);
    afirma(hist.some((h) => h.acao === 'alterado' && h.tipoAnterior === 'avaliacao' && h.tipoNovo === 'avaliacao-arquitetura'), 'histórico "alterado" com o tipo anterior e o novo');

    /* pesquisar entre os autorizados */
    await page.fill('#avpUsuariosBusca', 'bruno@previ');
    afirma(await contar(page, '#avpAutLista .avp-aut-item') === 1, 'pesquisa por e-mail filtra para 1');
    await page.fill('#avpUsuariosBusca', 'zzzz');
    afirma(/Nenhum usuário autorizado encontrado/.test(await page.locator('#avpAutLista').innerText()), 'sem resultado: mensagem clara');
    await page.fill('#avpUsuariosBusca', '');

    /* remover: só a autorização */
    await page.click('.avp-aut-remover[data-key="' + chave('bruno@previ.com.br') + '"]');
    await page.click('.avp-modal-confirm-btn');
    await page.waitForFunction((k) => !window.__CFG.__dbReal['fa-avaliacao-autorizados'][k], chave('bruno@previ.com.br'), { timeout: 5000 }).catch(() => {});
    b = await banco(page);
    afirma(!b['fa-avaliacao-autorizados'][chave('bruno@previ.com.br')], 'remover apagou só a autorização de Bruno');
    afirma(!!b['fa-users'][chave('bruno@previ.com.br')] && Object.keys(b['fa-users']).length === 3, 'a pessoa continua cadastrada (fa-users intacto)');
    hist = Object.keys(b['fa-avaliacao-autorizados-auditoria']).map((k) => b['fa-avaliacao-autorizados-auditoria'][k]);
    afirma(hist.some((h) => h.acao === 'removido' && h.email === 'bruno@previ.com.br' && h.tipoAnterior === 'avaliacao-arquitetura'), 'histórico "removido"');
    afirma(hist.length === 3, 'três linhas de histórico (concedido, alterado, removido)');
    afirma(/Concedido/.test(await page.locator('#avpAutHistorico').textContent()) && /Removido/.test(await page.locator('#avpAutHistorico').textContent()), 'o histórico aparece na tela (dentro de "Histórico…")');
    afirma(await larguraOk(page), 'sem rolagem horizontal ao final');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    console.log('\n== Lista vazia (estado inicial) e "Adicionar a mim" — ' + nomeTela + ' ==');
    const users = {}; users[chave(SUPER)] = { email: SUPER, name: 'Tatiane' };
    const { ctx, page, erros } = await abrir(browser, { email: SUPER, admin: true, hash: '#admin', viewport, db: { 'fa-users': users } });
    await page.click('.admin-tab-btn[data-panel="adminPanelArquitetura"]');
    await page.waitForSelector('#avpUsuariosBtn', { timeout: 8000 });
    await page.click('#avpUsuariosBtn');
    await page.waitForSelector('#avpAutVazio', { timeout: 8000 });
    afirma(/Ninguém está autorizado ainda/.test(await page.locator('#avpAutVazio').innerText()), 'sem autorizados: mensagem orienta a usar "+ ADICIONAR USUÁRIO"');
    afirma(await contar(page, '#avpAutEu') === 1 && /não está\s+registrado nesta lista/.test(await page.locator('#avpAutEu').innerText()), 'admin geral fora da lista vê o aviso de que o próprio acesso não está registrado');
    afirma(!(await banco(page))['fa-avaliacao-autorizados'] || Object.keys((await banco(page))['fa-avaliacao-autorizados']).length === 0, 'nada foi gravado sozinho: a lista continua vazia até o clique');
    afirma(await larguraOk(page), 'sem rolagem horizontal');
    await page.click('#avpAutAdicionarEuBtn');
    await page.waitForFunction((k) => { const r = window.__CFG.__dbReal['fa-avaliacao-autorizados']; return r && r[k]; }, chave(SUPER), { timeout: 5000 }).catch(() => {});
    const b = await banco(page);
    const reg = (b['fa-avaliacao-autorizados'] || {})[chave(SUPER)];
    afirma(reg && reg.tipo === 'avaliacao-arquitetura' && reg.email === SUPER && reg.concedidoPor === SUPER && !!reg.concedidoEm, 'o clique registra o PRÓPRIO usuário como "Avaliação + Arquitetura" (tipo, e-mail, quem e quando)');
    const hist = Object.keys(b['fa-avaliacao-autorizados-auditoria'] || {}).map((k) => b['fa-avaliacao-autorizados-auditoria'][k]);
    afirma(hist.length === 1 && hist[0].acao === 'concedido' && hist[0].email === SUPER && hist[0].tipoNovo === 'avaliacao-arquitetura', 'e grava o histórico "concedido" na mesma gravação');
    await page.waitForSelector('#avpAutLista .avp-aut-item', { timeout: 5000 }).catch(() => {});
    afirma(await contar(page, '#avpAutLista .avp-aut-item') === 1 && await contar(page, '#avpAutEu') === 0, 'ela aparece na lista e o aviso some (não pede de novo)');
    afirma(await page.locator('.avp-aut-tipo-sel[data-key="' + chave(SUPER) + '"]').inputValue() === 'avaliacao-arquitetura', 'tipo exibido: Avaliação + Arquitetura');
    afirma(Object.keys(b['fa-admins'] || {}).length === 1, 'o acesso de admin geral não foi tocado (continua só o que já era)');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  console.log('\n== Se o banco recusar, nada parece salvo ==');
  {
    const users = {}; users[chave('ana@previ.com.br')] = { email: 'ana@previ.com.br', name: 'Ana Souza' };
    const { ctx, page, erros } = await abrir(browser, { email: SUPER, admin: true, hash: '#admin', db: { 'fa-users': users }, fail: ['fa-avaliacao-autorizados/' + chave('ana@previ.com.br')] });
    await page.click('.admin-tab-btn[data-panel="adminPanelArquitetura"]');
    await page.waitForSelector('#avpUsuariosBtn', { timeout: 8000 });
    await page.click('#avpUsuariosBtn');
    await page.waitForSelector('#avpAutAdicionarBtn', { timeout: 8000 });
    await page.click('#avpAutAdicionarBtn');
    await page.fill('#avpAutBuscaAdd', 'ana');
    await page.click('.avp-aut-autorizar[data-key="' + chave('ana@previ.com.br') + '"]');
    await page.waitForFunction(() => /Não foi possível salvar/.test(document.getElementById('avpAutResultados').innerText), { timeout: 5000 }).catch(() => {});
    afirma(/Não foi possível salvar/.test(await page.locator('#avpAutResultados').innerText()), 'erro visível: "Não foi possível salvar"');
    const b = await banco(page);
    afirma(!(b['fa-avaliacao-autorizados'] || {})[chave('ana@previ.com.br')] && Object.keys(b['fa-avaliacao-autorizados-auditoria'] || {}).length === 0, 'nada foi gravado — nem o registro, nem o histórico');
    afirma(await contar(page, '#avpAutLista .avp-aut-item') === 0, 'Ana NÃO entrou na lista');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  console.log('\n== "Adicionar a mim": se o banco recusar, nada parece salvo ==');
  {
    const { ctx, page, erros } = await abrir(browser, { email: SUPER, admin: true, hash: '#admin', db: { 'fa-users': {} }, fail: ['fa-avaliacao-autorizados/' + chave(SUPER)] });
    await page.click('.admin-tab-btn[data-panel="adminPanelArquitetura"]');
    await page.waitForSelector('#avpUsuariosBtn', { timeout: 8000 });
    await page.click('#avpUsuariosBtn');
    await page.waitForSelector('#avpAutAdicionarEuBtn', { timeout: 8000 });
    await page.click('#avpAutAdicionarEuBtn');
    await page.waitForFunction(() => /Não foi possível salvar/.test((document.getElementById('avpAutEuAviso') || {}).textContent || ''), { timeout: 5000 }).catch(() => {});
    afirma(/Não foi possível salvar/.test(await page.locator('#avpAutEuAviso').textContent()), 'erro visível junto ao botão');
    const b = await banco(page);
    afirma(!(b['fa-avaliacao-autorizados'] || {})[chave(SUPER)] && Object.keys(b['fa-avaliacao-autorizados-auditoria'] || {}).length === 0, 'nada gravado — nem o registro, nem o histórico');
    afirma(await page.locator('#avpAutAdicionarEuBtn').isEnabled(), 'o botão volta a ficar disponível para tentar de novo');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  await browser.close();
  console.log('\n============================');
  console.log(falhas ? falhas + ' FALHA(S)' : 'TODOS OS TESTES PASSARAM');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
