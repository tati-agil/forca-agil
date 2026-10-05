/* TROCA DE USUÁRIO SEM RECARREGAR a página — ADMIN > ARQUITETURA.
 *
 * Defeito que isto prende: os módulos do ADMIN (avaliacao-produto.js, avaliacao-squad.js) e o
 * cabeçalho do ADMIN (admin.js) moram na página inteira. Quando alguém saía e OUTRA pessoa
 * entrava, sem recarregar, ficava a tela de quem estava antes:
 *   - o admin geral deixava a tela "Usuários autorizados" aberta; o perfil "Avaliação +
 *     Arquitetura" entrava e via só a mensagem "Só administradores gerais…", sem os cartões;
 *   - o perfil restrito escondia as abas do ADMIN; o admin geral que entrasse depois não as via;
 *   - o admin geral que entrava depois do restrito não via "Usuários autorizados" nem
 *     "+ ADICIONAR USUÁRIO" até um Ctrl+Shift+R: o cartão decide pela SESSÃO, que chega depois
 *     do registro de acesso, e nada redesenhava quando ela chegava.
 *
 * Prova, na tela (desktop e celular 375 px), com banco falso, SEM location.reload():
 *   admin geral abre "Usuários autorizados" → sai → "Avaliação + Arquitetura" volta ao início da
 *   Arquitetura com os 4 cartões e sem "Usuários autorizados" nem aviso → sai → admin geral vê
 *   "Usuários autorizados" e "+ ADICIONAR USUÁRIO" e o cabeçalho completo do ADMIN, com a sessão
 *   chegando DEPOIS do registro de acesso (rede lenta) — mais a lista de AVALIAÇÃO, que também não
 *   herda a avaliação aberta pela pessoa anterior.
 * Hermético: sem rede, sem segredo. */
const { chromium } = require('playwright');
const { esperarSessaoAssentada } = require('./esperas');
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

const ADMIN = 'admin.geral@previ.com.br';          /* fa-admins */
const ARQ = 'arquitetura@previ.com.br';            /* tipo 'avaliacao-arquitetura' */
const AVAL = 'avaliacao@previ.com.br';             /* tipo 'avaliacao' */

function item(nome, i) {
  const respostas = {};
  ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia'].forEach((id) => { respostas[id] = { valor: 'sim', observacao: '', justificativaAuto: 'interpretação ' + id, codigoPergunta: 'P', textoPergunta: 'Pergunta' }; });
  ['jornada', 'medicao', 'gestao', 'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'].forEach((id) => { respostas[id] = { valor: 'nao', observacao: '', justificativaAuto: 'interpretação ' + id, codigoPergunta: 'P', textoPergunta: 'Pergunta' }; });
  const n = String(i).padStart(2, '0');
  return {
    nome: nome, descricao: 'desc ' + i, publico: '', necessidade: '', observacoesGerais: '',
    status: 'concluido', respostas: respostas, resultadoAutomatico: 'produto', decisaoFinal: 'produto', decisaoManual: false,
    camadaSugerida: { id: 'produto-principal', label: 'Produto/Serviço principal', motivos: ['m1'], conflito: null, incoerencia: false, especializacao: null, papelEstrutural: null, relacao: null },
    justificativaAutomatica: 'justificativa gerada ' + i, criteriosEssenciaisFalhos: ['x'], exclusoesConflitantes: null, criteriosAtendidos: 5,
    motorVersion: MOTOR_VERSION, motorVersionArquitetura: 1, questionnaireContentVersion: 1,
    criadoEm: '2026-09-01T10:00:' + n + '.000Z', atualizadoEm: '2026-09-30T10:00:' + n + '.000Z',
    responsavel: { name: 'Teste', email: 'outra@previ.com.br' }, versao: 1, versaoAnteriorKey: null, excluido: false
  };
}

async function abrir(browser, o) {
  const registro = (email, tipo) => ({ email: email, nome: email, tipo: tipo, concedidoPor: 'tatianefdirene@previ.com.br', concedidoEm: '2026-10-01T10:00:00.000Z' });
  const autorizados = {}; autorizados[chave(ARQ)] = registro(ARQ, 'avaliacao-arquitetura'); autorizados[chave(AVAL)] = registro(AVAL, 'avaliacao');
  const admins = {}; admins[chave(ADMIN)] = { email: ADMIN };
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': admins, 'turmas-config': {},
    'turmas-checkin': {}, 'turmas-espera': {}, 'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {},
    eventos: {}, 'turmas-publico': {}, 'eventos-publico': {}, 'avaliacoes-produto': { k1: item('Item Um', 1), k2: item('Item Dois', 2) }, 'avaliacoes-squad': {},
    'motor-squad-config': {}, 'motor-squad-auditoria': {}, 'motor-arquitetura-config': {}, 'motor-arquitetura-auditoria': {},
    'fa-avaliacao-acessos': {}, 'fa-avaliacao-autorizados': autorizados, 'fa-avaliacao-autorizados-auditoria': {} };
  const cfg = { db: db, user: { email: o.email, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true };
  const ctx = await browser.newContext({ viewport: o.viewport || DESKTOP });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + (o.hash || '#home'), { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page); /* login decidido e acessos resolvidos (antes: opções no lugar do argumento, engolida + 600 ms fixos) */
  /* marca desta carga da página: se sumir, houve recarga — e este teste existe para NÃO recarregar */
  await page.evaluate(() => { window.__marcaDaPagina = 'mesma-pagina'; });
  return { ctx, page, erros };
}

const contar = (page, sel) => page.locator(sel).count();
const hash = (page) => page.evaluate(() => location.hash);
const mesmaPagina = (page) => page.evaluate(() => window.__marcaDaPagina === 'mesma-pagina');
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const textoDoAdmin = (page) => page.evaluate(() => (document.getElementById('adminContent') || document.body).innerText);
const abasVisiveis = (page) => page.evaluate(() => Array.from(document.querySelectorAll('.admin-tab-btn')).filter((b) => !b.hidden && getComputedStyle(b).display !== 'none').length);
const barraDeAbasVisivel = (page) => page.evaluate(() => { const b = document.querySelector('.admin-tabs-bar'); return !!b && !b.hidden && getComputedStyle(b).display !== 'none'; });
const sair = async (page) => {
  await page.evaluate(() => window.faAuth.logout());
  await page.waitForFunction(() => !window.faAuth.getSession(), { timeout: 8000 });
  await page.waitForTimeout(300);
};
const entrar = async (page, email) => {
  await page.evaluate((e) => firebase.auth().signInWithEmailAndPassword(e, 'x'), email);
  await page.waitForFunction((e) => { const s = window.faAuth.getSession(); return !!s && s.email === e; }, email, { timeout: 12000 });
};
const irPara = async (page, destino) => { await page.evaluate((h) => { location.hash = h; }, destino); await page.waitForTimeout(400); };
/* Admin geral: a aba Arquitetura é uma entre várias — a pessoa clica nela. Devolve false se o botão
   da aba não estiver visível (cabeçalho do ADMIN ainda escondido por quem esteve antes). */
async function abrirAbaArquitetura(page) {
  const btn = page.locator('.admin-tab-btn[data-panel="adminPanelArquitetura"]');
  const visivel = await btn.evaluate((b) => !b.hidden && getComputedStyle(b).display !== 'none').catch(() => false);
  if (!visivel) return false;
  await btn.click();
  return true;
}
const QUATRO = ['#avpConfigQuestionariosBtn', '#avpConfigMotoresBtn', '#avpConfigNaturezasBtn', '#avpAdequacaoSquadListaBtn'];
async function quatroCartoes(page) {
  for (const sel of QUATRO) if (await contar(page, sel) !== 1) return false;
  return true;
}

(async () => {
  const browser = await chromium.launch();

  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    console.log('\n######## ' + nomeTela + ' ########');

    console.log('\n== ADMIN > ARQUITETURA: admin geral → restrito → admin geral, SEM recarregar ==');
    {
      const { ctx, page, erros } = await abrir(browser, { email: ADMIN, hash: '#admin', viewport });
      await abrirAbaArquitetura(page);
      await page.waitForSelector('#avpUsuariosBtn', { timeout: 10000 }).catch(() => {});
      afirma(await quatroCartoes(page) && await contar(page, '#avpUsuariosBtn') === 1, '1) admin geral: os 4 cartões e "Usuários autorizados"');
      await page.click('#avpUsuariosBtn');
      await page.waitForSelector('#avpAutAdicionarBtn', { timeout: 8000 }).catch(() => {});
      afirma(await contar(page, '#avpAutAdicionarBtn') === 1, '2) admin geral abre "Usuários autorizados" e vê "+ ADICIONAR USUÁRIO"');

      await sair(page);
      await entrar(page, ARQ);
      await irPara(page, '#admin');
      await page.waitForSelector('#avpConfigQuestionariosBtn', { timeout: 10000 }).catch(() => {});
      afirma(await hash(page) === '#admin', '3-4) "Avaliação + Arquitetura" entra no ADMIN');
      afirma(await quatroCartoes(page), '5) volta ao INÍCIO da Arquitetura com os 4 cartões (Questionários, Motores, Naturezas, Squad)');
      afirma(await contar(page, '#avpUsuariosBtn') === 0, '6) NÃO vê o cartão "Usuários autorizados"');
      afirma(await contar(page, '#avpAutAdicionarBtn') === 0 && !/Só administradores gerais/.test(await textoDoAdmin(page)), '6) nem a tela de "Usuários autorizados" nem a mensagem de "só administradores gerais"');
      afirma(!(await barraDeAbasVisivel(page)) && await abasVisiveis(page) === 1, 'o ADMIN dele continua só com a Arquitetura (sem barra de abas)');
      afirma(await larguraOk(page), 'sem rolagem horizontal');

      await sair(page);
      /* a sessão chega DEPOIS do registro de acesso: rede lenta só na leitura do perfil */
      await page.evaluate(() => { window.__CFG.delays = { 'fa-users/': 2500 }; });
      await entrar(page, ADMIN).catch(() => {});
      await irPara(page, '#admin');
      afirma(await barraDeAbasVisivel(page) && await abasVisiveis(page) > 5, '9) o cabeçalho do ADMIN volta completo para o admin geral (todas as abas)');
      await abrirAbaArquitetura(page);
      await page.waitForSelector('#avpUsuariosBtn', { timeout: 12000 }).catch(() => {});
      afirma(await contar(page, '#avpUsuariosBtn') === 1 && await quatroCartoes(page), '9) admin geral de volta (sessão chegando depois): "Usuários autorizados" aparece sem F5');
      await page.click('#avpUsuariosBtn');
      await page.waitForSelector('#avpAutAdicionarBtn', { timeout: 8000 }).catch(() => {});
      afirma(await contar(page, '#avpAutAdicionarBtn') === 1, '9) e "+ ADICIONAR USUÁRIO" aparece, sem F5 nem Ctrl+Shift+R');
      afirma(await larguraOk(page), 'sem rolagem horizontal');
      afirma(await mesmaPagina(page), 'tudo isto sem recarregar a página (a marca desta carga continua)');
      afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
      await ctx.close();
    }

    console.log('\n== A tela de "Usuários autorizados" não sobrevive à troca de pessoa ==');
    {
      const { ctx, page, erros } = await abrir(browser, { email: ADMIN, hash: '#admin', viewport });
      await abrirAbaArquitetura(page);
      await page.waitForSelector('#avpUsuariosBtn', { timeout: 10000 }).catch(() => {});
      await page.click('#avpUsuariosBtn');
      await page.waitForSelector('#avpAutAdicionarBtn', { timeout: 8000 }).catch(() => {});
      await page.click('#avpAutAdicionarBtn');
      afirma(await contar(page, '#avpAutBuscaAdd') === 1, 'o admin geral deixa a busca de "adicionar usuário" aberta');
      await sair(page);
      await entrar(page, ARQ);
      await irPara(page, '#admin');
      await page.waitForSelector('#avpConfigQuestionariosBtn', { timeout: 10000 }).catch(() => {});
      afirma(await contar(page, '#avpAutBuscaAdd') === 0 && await contar(page, '#avpAutLista') === 0, 'o restrito não herda a lista nem a busca do admin geral');
      afirma(await quatroCartoes(page) && await contar(page, '#avpUsuariosBtn') === 0, 'vê o início da Arquitetura, sem "Usuários autorizados"');
      afirma(await mesmaPagina(page) && erros.length === 0, 'sem recarregar e sem erro de JS');
      await ctx.close();
    }

    console.log('\n== A lista de AVALIAÇÃO não herda a avaliação aberta pela pessoa anterior ==');
    {
      const { ctx, page, erros } = await abrir(browser, { email: AVAL, hash: '#avaliacoes', viewport });
      await page.waitForSelector('#avaliacoesPainel .avp-table tbody tr', { timeout: 10000 }).catch(() => {});
      await page.click('.avp-act-ver[data-key="k1"]');
      await page.waitForSelector('#avpVoltarListaResultado', { timeout: 6000 }).catch(() => {});
      afirma(await contar(page, '#avpVoltarListaResultado') === 1, 'o tipo "Avaliação" abre o resultado de uma avaliação');
      await sair(page);
      await entrar(page, ADMIN);
      await irPara(page, '#avaliacoes');
      await page.waitForSelector('#avpNovoBtn', { timeout: 10000 }).catch(() => {});
      afirma(await contar(page, '#avpVoltarListaResultado') === 0 && await contar(page, '#avpNovoBtn') === 1, 'quem entra depois vê a LISTA, não o resultado aberto pela pessoa anterior');
      afirma(await contar(page, '#avaliacoesPainel .avp-table tbody tr') === 2, 'e a lista carrega para ela (2 avaliações)');
      afirma(await mesmaPagina(page) && erros.length === 0, 'sem recarregar e sem erro de JS');
      await ctx.close();
    }
  }

  await browser.close();
  console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
