/* Questionário governado de Posicionamento Organizacional (O1–O9 + diagnóstico
 * conflito × recorte) e tipos de pergunta em window.faQuestionarios — PR C.
 *
 * Parte 1 (sem navegador): o questionarios-config.js real carregado num vm.
 *   - REGRESSÃO: o conteúdo de fábrica de P1–P16 e S1–S8 (e as correções
 *     editoriais deles) é IGUAL, campo a campo, à referência gravada a partir do
 *     main ANTES desta mudança (referencia-questionarios-p-s.json, sha256 abaixo);
 *     16 e 8 perguntas, nenhuma ganhou "tipo" (ausência = binária);
 *   - o terceiro questionário: O1–O9 binárias explícitas, o diagnóstico com
 *     respostas estáveis mesma/distintas (as mesmas do motor), sem O10, sem
 *     justSim/justNao; tipo fora dos campos editoriais;
 *   - proteção estrutural: tipo mexido volta ao do código, código de pergunta
 *     desconhecido/repetido/faltando é recusado.
 * Parte 2 (navegador, desktop e celular 375 px, Firebase falso):
 *   - o editor mostra para P/S exatamente os campos e rótulos de antes, e para o
 *     diagnóstico só os campos dele (código, tipo e respostas só leitura);
 *   - publicar o rótulo de "mesma" cria versão nova + auditoria legível;
 *     restaurar a versão 1 traz o texto de volta; um "tipo" mexido por fora não
 *     sobrevive à gravação;
 *   - P/S: publicar, rascunho e restaurar continuam iguais (nada de "tipo" novo);
 *   - Excel: as 14 colunas antigas de P/S com os mesmos valores de antes, as 7
 *     novas vazias nelas; binária × diagnóstico separados;
 *   - sem rolagem horizontal e sem erro de JS. Hermético: sem rede, sem segredo. */
const { chromium } = require('playwright');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const RAIZ = path.join(__dirname, '..', '..');
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const EMAIL = 'adm@previ.com.br';
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const DESKTOP = { width: 1280, height: 900 };
const CELULAR = { width: 375, height: 800 };
const XLSX = require(path.join(RAIZ, 'forca-agil', 'xlsx.mini.min.js'));

/* Referência gravada a partir de origin/main (13c9c27) ANTES de mexer em
   questionarios-config.js. O hash é do JSON.stringify do objeto da referência. */
const REFERENCIA = JSON.parse(fs.readFileSync(path.join(__dirname, 'referencia-questionarios-p-s.json'), 'utf8'));
const HASH_REFERENCIA = 'b98a16d6fea1d56b22b9377cd0566cbf68fca2ced2fd172a7e1df1fa9fd29c9c';
const POS = 'POSICIONAMENTO_ORGANIZACIONAL';
const DIAG = 'DIAG_CONFLITO_RECORTE';
const TIPO_DIAG = 'diagnostico-conflito-recorte';

let falhas = 0;
function afirma(cond, msg) { console.log((cond ? '  ok    ' : '  FALHA ') + msg); if (!cond) falhas++; }
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const clone = (v) => JSON.parse(JSON.stringify(v));

function carregarModulo() {
  const ctx = { window: {}, firebase: { database() { throw new Error('sem banco na parte 1'); } }, console };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(RAIZ, 'forca-agil', 'questionarios-config.js'), 'utf8'), ctx);
  return ctx.window.faQuestionarios;
}

/* Campos e rótulos que o editor mostrava para uma pergunta P/S ANTES desta
   mudança (mesma lógica de renderConfigEditar no main). */
function camposEsperadosPS(p) {
  const c = [['titulo', 'Título'], ['texto', 'Texto da pergunta']];
  if (p.textoAjuda) c.push(['textoAjuda.significado', 'Ajuda — o que significa'], ['textoAjuda.quandoSim', 'Ajuda — quando marcar SIM'], ['textoAjuda.quandoNao', 'Ajuda — quando marcar NÃO']);
  if ('exemplo' in p) c.push(['exemplo', 'Exemplo']);
  c.push(['justSim', 'Interpretação automática quando a resposta é SIM'], ['justNao', 'Interpretação automática quando a resposta é NÃO'],
    ['observacaoAdministrativa', 'Observação administrativa (opcional, não aparece pra quem responde)']);
  return c;
}
/* As 14 colunas que o Excel exportava ANTES (mesma lógica de linhasQuestionarioExcel no main). */
function linhaExcelAntiga(nome, versao, q) {
  const ajuda = q.textoAjuda && typeof q.textoAjuda === 'object' ? q.textoAjuda : { significado: q.textoAjuda || '' };
  return [nome, versao, q.codigoEstavel || '', q.titulo || '', q.texto || '', ajuda.significado || '', ajuda.quandoSim || '', ajuda.quandoNao || '',
    q.exemplo || '', Array.isArray(q.exemplos) ? q.exemplos.join(', ') : (q.exemplos || ''), q.ajudaExtra || '',
    q.justSim || '', q.justNao || '', q.observacaoAdministrativa || ''];
}

function parte1() {
  const fq = carregarModulo();
  console.log('\n== Regressão: P1–P16 e S1–S8 iguais à referência do main ==');
  const atual = { CLASSIFICACAO_ARQUITETURAL: clone(fq.PADRAO.CLASSIFICACAO_ARQUITETURAL), ADEQUACAO_SQUAD: clone(fq.PADRAO.ADEQUACAO_SQUAD),
    correcoesEditoriais: clone(fq.listarCorrecoesEditoriais()).filter((c) => c.codigo !== POS) };
  const hRef = crypto.createHash('sha256').update(JSON.stringify(REFERENCIA)).digest('hex');
  const hAtual = crypto.createHash('sha256').update(JSON.stringify(atual)).digest('hex');
  afirma(hRef === HASH_REFERENCIA, 'a referência gravada é a do main (sha256 ' + hRef.slice(0, 16) + '…)');
  afirma(hAtual === HASH_REFERENCIA, 'conteúdo atual de P/S + correções editoriais tem o MESMO sha256 (' + hAtual.slice(0, 16) + '…)');
  ['CLASSIFICACAO_ARQUITETURAL', 'ADEQUACAO_SQUAD'].forEach((cod) => {
    const ref = REFERENCIA[cod], at = atual[cod];
    afirma(ref.nome === at.nome && ref.descricao === at.descricao, cod + ': nome e descrição iguais');
    ref.perguntas.forEach((p, i) => {
      const dif = Object.keys(Object.assign({}, p, at.perguntas[i] || {})).filter((k) => !igual(p[k], (at.perguntas[i] || {})[k]));
      if (dif.length) afirma(false, cod + ' ' + p.codigoEstavel + ': campos diferentes da referência: ' + dif.join(', '));
    });
  });
  const P = fq.PADRAO.CLASSIFICACAO_ARQUITETURAL.perguntas, S = fq.PADRAO.ADEQUACAO_SQUAD.perguntas;
  afirma(P.length === 16 && igual(P.map((p) => p.codigoEstavel), Array.from({ length: 16 }, (_, i) => 'P' + (i + 1))), '16 perguntas, P1…P16');
  afirma(S.length === 8 && igual(S.map((p) => p.codigoEstavel), Array.from({ length: 8 }, (_, i) => 'S' + (i + 1))), '8 perguntas, S1…S8');
  afirma(P.concat(S).every((p) => !('tipo' in p)), 'nenhuma P/S ganhou o campo "tipo" (sem migração)');
  afirma(P.concat(S).every((p) => fq.tipoPergunta(p) === 'binaria'), 'tipo ausente resolve como "binaria" em todas as 24');
  afirma(igual(fq.normalizarPerguntas('CLASSIFICACAO_ARQUITETURAL', clone(P)).perguntas, P) &&
    igual(fq.normalizarPerguntas('ADEQUACAO_SQUAD', clone(S)).perguntas, S), 'a gravação (normalização) devolve P/S intactos, campo a campo');

  console.log('\n== O terceiro questionário ==');
  afirma(fq.CODIGOS.POSICIONAMENTO_ORGANIZACIONAL === POS, 'CODIGOS.POSICIONAMENTO_ORGANIZACIONAL existe');
  afirma(igual(Object.keys(fq.CODIGOS), ['CLASSIFICACAO_ARQUITETURAL', 'ADEQUACAO_SQUAD', POS]), 'os dois códigos antigos continuam, na mesma ordem');
  const Q = fq.PADRAO[POS];
  afirma(Q.nome === 'Posicionamento Organizacional', 'nome: Posicionamento Organizacional');
  afirma(/^Questionário hierárquico O1–O9 para recomendar o tipo de estrutura organizacional/.test(Q.descricao) && !/é uma (Linha|Área|CoE)/.test(Q.descricao), 'descrição sem afirmar que o objeto "é uma Linha/Área/CoE"');
  const cods = Q.perguntas.map((p) => p.codigoEstavel);
  afirma(igual(cods, ['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7', 'O8', 'O9', DIAG]), 'O1–O9 + DIAG_CONFLITO_RECORTE: ' + cods.join(' '));
  afirma(!cods.includes('O10'), 'não existe O10');
  const O = Q.perguntas.slice(0, 9), D = Q.perguntas[9];
  afirma(O.every((p) => p.tipo === 'binaria' && fq.tipoPergunta(p) === 'binaria'), 'O1–O9 com tipo EXPLÍCITO "binaria"');
  afirma(O.every((p) => /^Considerando a responsabilidade organizacional associada a este objeto, /.test(p.texto)), 'O1–O9 começam por "Considerando a responsabilidade organizacional associada a este objeto…"');
  afirma(O.every((p) => /^SIM — A resposta indica /.test(p.justSim) && /^NÃO — A (resposta não indica|responsabilidade não se caracteriza) /.test(p.justNao)),
    'O1–O9 nascem com as duas interpretações (justSim/justNao) preenchidas');
  afirma(O.every((p) => !/o objeto é|classifica/i.test(p.justSim + ' ' + p.justNao)), 'as interpretações falam de evidência ("a resposta indica"), nunca "o objeto é"/"classifica como"');
  afirma(/^Identifica uma responsabilidade típica de Estratégia de Clientes: /.test(O[3].textoAjuda.significado), 'O4 com o significado de Estratégia de Clientes');
  afirma(/^Identifica uma responsabilidade típica de Plataforma Habilitadora de Negócios: /.test(O[6].textoAjuda.significado) &&
    /Não é necessário que o objeto seja previdenciário ou financeiro\.$/.test(O[6].textoAjuda.significado), 'O7: a ressalva "não precisa ser previdenciário ou financeiro" está na ajuda visível');
  afirma(['O2', 'O3', 'O5', 'O6', 'O9'].every((c) => !!O.find((p) => p.codigoEstavel === c).ajudaExtra) &&
    ['O1', 'O4', 'O7', 'O8'].every((c) => !O.find((p) => p.codigoEstavel === c).ajudaExtra), 'orientação adicional (ajudaExtra) em O2, O3, O5, O6 e O9');
  afirma(D.tipo === TIPO_DIAG && fq.tipoPergunta(D) === TIPO_DIAG, 'diagnóstico com tipo "' + TIPO_DIAG + '"');
  afirma(igual(fq.TIPOS_PERGUNTA, { BINARIA: 'binaria', DIAGNOSTICO_CONFLITO_RECORTE: TIPO_DIAG, DIAGNOSTICO_PREDOMINANCIA: 'diagnostico-predominancia' }) && Object.isFrozen(fq.TIPOS_PERGUNTA),
    'catálogo de tipos estável e congelado (o D2 do motor v2 entrou no H1-Final; o questionário v1 não usa)');
  afirma(!fq.PADRAO.POSICIONAMENTO_ORGANIZACIONAL.perguntas.some((p) => p.tipo === 'diagnostico-predominancia' || p.opcoes), 'o questionário v1 (PADRAO) não tem D2 nem opções');
  afirma(igual(fq.RESPOSTAS_DIAGNOSTICO, { MESMA: 'mesma', DISTINTAS: 'distintas' }) && Object.isFrozen(fq.RESPOSTAS_DIAGNOSTICO), 'respostas do diagnóstico: mesma / distintas (congeladas)');
  const motor = require(path.join(RAIZ, 'forca-agil', 'motor-posicionamento.js'));
  afirma(igual(Array.from(fq.respostasDoTipo(TIPO_DIAG)), motor.RESPOSTAS_DIAGNOSTICO) && igual(Array.from(fq.respostasDoTipo('binaria')), motor.RESPOSTAS),
    'os códigos de resposta são exatamente os do motor (mesma/distintas, SIM/NAO)');
  afirma(igual(cods.slice(0, 9), motor.PERGUNTAS) && D.codigoEstavel === motor.DIAGNOSTICO, 'os códigos das perguntas são exatamente os do motor');
  afirma(!fq.respostasDoTipo(TIPO_DIAG).includes('SIM') && !fq.respostasDoTipo(TIPO_DIAG).includes('NAO'), 'o diagnóstico não aceita SIM/NAO como resposta');
  afirma(!('justSim' in D) && !('justNao' in D) && !('quandoSim' in (D.textoAjuda || {})) && !('quandoNao' in (D.textoAjuda || {})), 'o diagnóstico não tem justSim/justNao nem ajuda de SIM/NÃO');
  afirma(D.rotuloMesma === 'Mesma responsabilidade' && D.rotuloDistintas === 'Responsabilidades distintas', 'rótulos: Mesma responsabilidade / Responsabilidades distintas');
  afirma(/conflito de posicionamento/.test(D.interpretacaoMesma) && /recortar o objeto/.test(D.interpretacaoDistintas), 'interpretações de mesma (conflito) e distintas (recorte)');
  afirma(/mesma responsabilidade organizacional/.test(D.textoAjuda.quandoMesma) && /poderiam ser separadas/.test(D.textoAjuda.quandoDistintas), 'ajuda de mesma e de distintas');
  afirma(!fq.CAMPOS_EDITORIAVEIS.includes('tipo') && !fq.CAMPOS_EDITORIAVEIS.includes('codigoEstavel'), '"tipo" e "codigoEstavel" fora de CAMPOS_EDITORIAVEIS');
  afirma(['rotuloMesma', 'interpretacaoMesma', 'rotuloDistintas', 'interpretacaoDistintas'].every((c) => fq.CAMPOS_EDITORIAVEIS.includes(c)), 'os quatro campos do diagnóstico são editoriais (versionados e auditados)');
  afirma(fq.tipoExplicito('O1') && fq.tipoExplicito(DIAG) && !fq.tipoExplicito('P1') && !fq.tipoExplicito('S1'), 'tipo explícito só em O1–O9 e no diagnóstico');

  console.log('\n== Proteção estrutural ==');
  const mexido = clone(Q.perguntas);
  mexido[0].tipo = TIPO_DIAG; mexido[9].tipo = 'binaria'; mexido[9].justSim = 'SIM — falso'; mexido[9].textoAjuda.quandoSim = 'falso';
  mexido[0].rotuloMesma = 'não pertence à binária';
  afirma(fq.tipoPergunta(mexido[0]) === 'binaria' && fq.tipoPergunta(mexido[9]) === TIPO_DIAG, 'leitura: um "tipo" mexido no banco é ignorado — vale o do código');
  const n = fq.normalizarPerguntas(POS, mexido);
  afirma(!n.erro && n.perguntas[0].tipo === 'binaria' && n.perguntas[9].tipo === TIPO_DIAG, 'gravação: O1 volta a binária e o diagnóstico volta a diagnóstico');
  afirma(!('justSim' in n.perguntas[9]) && !('quandoSim' in n.perguntas[9].textoAjuda) && !('rotuloMesma' in n.perguntas[0]), 'gravação: campos do outro tipo saem (justSim no diagnóstico, rotuloMesma na binária)');
  afirma(n.perguntas[9].rotuloMesma === D.rotuloMesma && n.perguntas[0].texto === O[0].texto, 'gravação: conteúdo editorial intacto');
  const pMexido = clone(P); pMexido[0].tipo = TIPO_DIAG;
  afirma(!('tipo' in fq.normalizarPerguntas('CLASSIFICACAO_ARQUITETURAL', pMexido).perguntas[0]), 'gravação: um "tipo" enfiado em P1 sai (P continua sem o campo)');
  const semUm = clone(Q.perguntas).slice(0, 9);
  const repetido = clone(Q.perguntas); repetido[1].codigoEstavel = 'O1';
  const estranho = clone(Q.perguntas); estranho[9].codigoEstavel = 'O10';
  const pTrocado = clone(P); pTrocado[0].codigoEstavel = 'P99';
  afirma([semUm, repetido, estranho].every((l) => fq.normalizarPerguntas(POS, l).erro === 'estrutura-divergente') &&
    fq.normalizarPerguntas('CLASSIFICACAO_ARQUITETURAL', pTrocado).erro === 'estrutura-divergente', 'código faltando, repetido ou desconhecido (O10, P99): recusado');
  return fq;
}

async function abrir(browser, viewport) {
  const admins = {}; admins[chave(EMAIL)] = { email: EMAIL };
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': admins, 'turmas-config': {}, 'turmas-checkin': {}, 'turmas-espera': {},
    'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {}, eventos: {}, 'turmas-publico': {}, 'eventos-publico': {},
    'avaliacoes-produto': {}, 'avaliacoes-squad': {}, 'motor-squad-config': {}, 'motor-squad-auditoria': {},
    'motor-arquitetura-config': {}, 'motor-arquitetura-auditoria': {}, 'fa-avaliacao-acessos': {} };
  const cfg = { db: db, user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true };
  const ctx = await browser.newContext({ viewport: viewport, acceptDownloads: true });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  await page.waitForSelector('.admin-tab-btn[data-panel="adminPanelArquitetura"]', { timeout: 8000 });
  await page.click('.admin-tab-btn[data-panel="adminPanelArquitetura"]');
  await page.waitForSelector('#avpConfigQuestionariosBtn', { timeout: 8000 });
  await page.click('#avpConfigQuestionariosBtn');
  await page.waitForSelector('#avpIntroQuestionarios');
  return { ctx, page, erros };
}
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const lerConfig = (page, codigo) => page.evaluate((c) => new Promise((ok) => firebase.database().ref('questionarios-config/' + c).once('value', (s) => ok(s.val()))), codigo);
const lerAuditoria = (page, codigo) => page.evaluate((c) => new Promise((ok) => firebase.database().ref('questionarios-auditoria/' + c).once('value', (s) => ok(Object.values(s.val() || {})))), codigo);
/* campos [data-campo, rótulo] de cada cartão de pergunta do editor */
const camposDoEditor = (page) => page.evaluate(() => Array.from(document.querySelectorAll('.avp-config-pergunta-card')).map((card) => ({
  codigo: card.dataset.codigoPergunta, tipo: card.dataset.tipoPergunta,
  campos: Array.from(card.querySelectorAll('[data-campo]')).map((el) => [el.dataset.campo, (card.querySelector('label[for="' + el.id + '"]') || {}).textContent || '']),
  texto: card.innerText
})));
async function abrirEditor(page, codigo) {
  await page.click('.avp-config-editar-btn[data-codigo="' + codigo + '"]');
  await page.waitForSelector('#avpCfgSalvarRascunhoBtn');
}
async function voltarLista(page) {
  await page.click('#avpConfigVoltar');
  const modal = page.locator('.avp-modal-confirm-btn');
  if (await modal.count()) await modal.click();
  await page.waitForSelector('.avp-config-editar-btn');
}
async function publicarEditor(page) {
  await page.click('#avpCfgPublicarBtn');
  await page.click('#avpCfgConfirmarPublicarBtn');
  await page.waitForSelector('.avp-config-editar-btn');
}
async function restaurar(page, codigo, versao) {
  await page.click('.avp-config-auditoria-btn[data-codigo="' + codigo + '"]');
  await page.waitForSelector('.avp-config-restaurar-btn[data-versao="' + versao + '"]');
  await page.click('.avp-config-restaurar-btn[data-versao="' + versao + '"]');
  await page.click('.avp-modal-confirm-btn');
}
async function baixar(page, seletor) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click(seletor)]);
  return XLSX.read(fs.readFileSync(await dl.path()), { type: 'buffer' });
}
const linhasDe = (wb, aba) => XLSX.utils.sheet_to_json(wb.Sheets[aba], { header: 1, defval: '' });

async function parte2(browser, fq, nomeTela, viewport) {
  console.log('\n######## ' + nomeTela + ' ########');
  const { ctx, page, erros } = await abrir(browser, viewport);

  console.log('\n== Lista: o terceiro questionário aparece ==');
  const cartoes = await page.locator('.avp-config-item-card h4').allTextContents();
  afirma(igual(cartoes, ['Classificação arquitetural (Produto/Serviço)', 'Adequação à gestão por Squad', 'Posicionamento Organizacional']), 'três questionários: ' + cartoes.join(' | '));
  afirma(/10 perguntas · Versão publicada: 1/.test(await page.locator('.avp-config-item-card').nth(2).innerText()), 'Posicionamento: 10 perguntas, versão 1 (fábrica)');

  console.log('\n== Editor de P1–P16 e S1–S8: os mesmos campos e rótulos de antes ==');
  for (const cod of ['CLASSIFICACAO_ARQUITETURAL', 'ADEQUACAO_SQUAD']) {
    await abrirEditor(page, cod);
    const cards = await camposDoEditor(page);
    const esperado = REFERENCIA[cod].perguntas.map((p) => ({ codigo: p.codigoEstavel, campos: camposEsperadosPS(p) }));
    const dif = esperado.filter((e, i) => !cards[i] || cards[i].codigo !== e.codigo || !igual(cards[i].campos, e.campos)).map((e) => e.codigo);
    afirma(cards.length === esperado.length && !dif.length, cod + ': ' + cards.length + ' cartões, campos e rótulos idênticos aos de antes' + (dif.length ? ' — diferentes: ' + dif.join(', ') : ''));
    afirma(cards.every((c) => c.tipo === 'binaria' && !/Tipo:|Respostas:/.test(c.texto)), cod + ': todas binárias, sem linha de tipo/respostas');
    await voltarLista(page);
  }

  console.log('\n== Editor do Posicionamento: binária × diagnóstico ==');
  await abrirEditor(page, POS);
  let cards = await camposDoEditor(page);
  afirma(igual(cards.map((c) => c.codigo), ['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7', 'O8', 'O9', DIAG]), 'dez cartões, O1…O9 e o diagnóstico');
  const camposBin = ['titulo', 'texto', 'textoAjuda.significado', 'textoAjuda.quandoSim', 'textoAjuda.quandoNao', 'ajudaExtra', 'justSim', 'justNao', 'observacaoAdministrativa'];
  afirma(cards.slice(0, 9).every((c) => c.tipo === 'binaria' && igual(c.campos.map((x) => x[0]), camposBin)), 'O1–O9: título, texto, ajuda (significado, SIM, NÃO, orientação), interpretações SIM/NÃO, observação');
  const d = cards[9];
  afirma(d.tipo === TIPO_DIAG, 'diagnóstico renderizado como "' + TIPO_DIAG + '"');
  afirma(igual(d.campos, [['titulo', 'Título'], ['texto', 'Texto da pergunta'], ['textoAjuda.significado', 'Ajuda — o que significa'],
    ['textoAjuda.quandoMesma', 'Ajuda — quando a resposta é "mesma"'], ['textoAjuda.quandoDistintas', 'Ajuda — quando a resposta é "distintas"'],
    ['rotuloMesma', 'Rótulo da resposta "mesma"'], ['interpretacaoMesma', 'Interpretação da resposta "mesma"'],
    ['rotuloDistintas', 'Rótulo da resposta "distintas"'], ['interpretacaoDistintas', 'Interpretação da resposta "distintas"'],
    ['observacaoAdministrativa', 'Observação administrativa (opcional, não aparece pra quem responde)']]), 'diagnóstico: exatamente os campos dele, na ordem pedida');
  afirma(!d.campos.some((x) => /justSim|justNao|quandoSim|quandoNao|^tipo$|codigoEstavel/.test(x[0])) && !/SIM|NÃO/.test(d.campos.map((x) => x[1]).join(' ')), 'diagnóstico: nenhum campo SIM/NÃO, nenhum campo de tipo ou código');
  afirma(/Código: DIAG_CONFLITO_RECORTE \(somente leitura\)/.test(d.texto) && /Tipo: diagnostico-conflito-recorte .*\(somente leitura\)/.test(d.texto) &&
    /Respostas: mesma · distintas \(códigos fixos, somente leitura\)/.test(d.texto), 'código, tipo e respostas mostrados como somente leitura');
  afirma(await page.locator('[data-campo="tipo"], [data-campo="codigoEstavel"]').count() === 0, 'não há campo de formulário para tipo ou código');
  afirma(await larguraOk(page), 'editor sem rolagem horizontal');

  console.log('\n== Publicar o rótulo de "mesma": versão nova + auditoria ==');
  await page.locator('[data-campo="rotuloMesma"]').fill('Mesma responsabilidade (revisado)');
  await page.locator('[data-campo="textoAjuda.quandoDistintas"]').fill('Ajuda distintas revisada.');
  await publicarEditor(page);
  await esperarCondicao(page, () => /Versão publicada: 2/.test(document.querySelectorAll('.avp-config-item-card')[2].innerText), null, { descricao: 'versão 2 do Posicionamento na lista' });
  let cfg = await lerConfig(page, POS);
  let v2 = cfg.versoes[2].perguntas;
  afirma(cfg.versaoPublicada === 2 && v2[9].rotuloMesma === 'Mesma responsabilidade (revisado)' && v2[9].textoAjuda.quandoDistintas === 'Ajuda distintas revisada.', 'versão 2 gravada com o rótulo e a ajuda novos');
  afirma(v2[9].tipo === TIPO_DIAG && v2.slice(0, 9).every((p) => p.tipo === 'binaria') && !('justSim' in v2[9]), 'na versão gravada: tipos do código, diagnóstico sem justSim');
  const aud = await lerAuditoria(page, POS);
  afirma(aud.some((a) => a.pergunta === DIAG && a.campo === 'rotuloMesma' && a.valorAnterior === 'Mesma responsabilidade' && a.valorNovo === 'Mesma responsabilidade (revisado)' && a.versaoAnterior === 1 && a.novaVersao === 2) &&
    aud.some((a) => a.pergunta === DIAG && a.campo === 'textoAjuda'), 'auditoria por campo: rotuloMesma (anterior → novo, v1 → v2) e textoAjuda');
  await page.click('.avp-config-auditoria-btn[data-codigo="' + POS + '"]');
  await page.waitForSelector('#avpCfgHistorico');
  await page.click('#avpCfgHistorico > summary');
  const hist = await page.locator('#avpCfgHistorico').innerText();
  afirma(/Rótulo da resposta "mesma": Mesma responsabilidade → Mesma responsabilidade \(revisado\)/.test(hist), 'histórico legível: Rótulo da resposta "mesma": X → Y');
  await page.click('#avpCfgAuditoriaVoltarBtn');
  await page.waitForSelector('.avp-config-editar-btn');

  console.log('\n== Rollback: restaurar a versão 1 ==');
  await restaurar(page, POS, 1);
  await esperarCondicao(page, () => new Promise((ok) => firebase.database().ref('questionarios-config/POSICIONAMENTO_ORGANIZACIONAL/versaoPublicada').once('value', (s) => ok(s.val() === 3))), null, { descricao: 'versão 3 (restauração) gravada' });
  cfg = await lerConfig(page, POS);
  afirma(cfg.versaoPublicada === 3 && igual(cfg.versoes[3].perguntas, fq.PADRAO[POS].perguntas), 'versão 3 = conteúdo da versão 1, campo a campo (rótulo e ajuda de volta)');
  afirma(cfg.versoes[2].perguntas[9].rotuloMesma === 'Mesma responsabilidade (revisado)', 'a versão 2 continua lá, intocada');
  await page.click('#avpCfgAuditoriaVoltarBtn');
  await page.waitForSelector('.avp-config-editar-btn');

  console.log('\n== "tipo" mexido por fora não sobrevive à gravação ==');
  const r = await page.evaluate((args) => new Promise((ok) => {
    const fqp = window.faQuestionarios;
    const lista = JSON.parse(JSON.stringify(fqp.perguntasDaVersao(args.pos)));
    lista[0].tipo = args.diag; lista[9].tipo = 'binaria'; lista[9].justSim = 'SIM — injetado'; lista[9].titulo = 'Título editado';
    fqp.publicarPerguntas(args.pos, lista, { email: 'adm@previ.com.br' }, (err) => {
      const ruim = JSON.parse(JSON.stringify(lista)); ruim[9].codigoEstavel = 'O10';
      fqp.publicarPerguntas(args.pos, ruim, { email: 'adm@previ.com.br' }, (err2) => ok({ err: err, err2: err2 }));
    });
  }), { pos: POS, diag: TIPO_DIAG });
  cfg = await lerConfig(page, POS);
  afirma(!r.err && cfg.versoes[4].perguntas[0].tipo === 'binaria' && cfg.versoes[4].perguntas[9].tipo === TIPO_DIAG && !('justSim' in cfg.versoes[4].perguntas[9]) &&
    cfg.versoes[4].perguntas[9].titulo === 'Título editado', 'publicação com tipos trocados: grava os tipos do código, sem justSim, com a edição de título');
  afirma(r.err2 === 'estrutura-divergente' && cfg.versaoPublicada === 4 && !cfg.versoes[5], 'publicação com código "O10": recusada, nada gravado');
  const tiposAud = (await lerAuditoria(page, POS)).map((a) => a.campo);
  afirma(!tiposAud.includes('tipo') && !tiposAud.includes('codigoEstavel'), 'a auditoria nunca registra "tipo" nem "codigoEstavel" como campo editorial');

  console.log('\n== P/S: rascunho, publicação e restauração continuam iguais ==');
  await abrirEditor(page, 'CLASSIFICACAO_ARQUITETURAL');
  await page.locator('[data-campo="titulo"]').first().fill('Necessidade do cliente (revisado)');
  await page.click('#avpCfgSalvarRascunhoBtn');
  await page.waitForSelector('.avp-flash-success');
  cfg = await lerConfig(page, 'CLASSIFICACAO_ARQUITETURAL');
  const esperadoRasc = clone(REFERENCIA.CLASSIFICACAO_ARQUITETURAL.perguntas); esperadoRasc[0].titulo = 'Necessidade do cliente (revisado)';
  afirma(cfg.rascunho && igual(cfg.rascunho.perguntas, esperadoRasc), 'rascunho de P gravado: só o título mudou, nenhum "tipo" acrescentado');
  await publicarEditor(page);
  await esperarCondicao(page, () => /Versão publicada: 2/.test(document.querySelectorAll('.avp-config-item-card')[0].innerText), null, { descricao: 'versão 2 da classificação' });
  cfg = await lerConfig(page, 'CLASSIFICACAO_ARQUITETURAL');
  afirma(igual(cfg.versoes[2].perguntas, esperadoRasc) && !cfg.rascunho, 'versão 2 de P = referência + título; rascunho limpo');
  const audP = await lerAuditoria(page, 'CLASSIFICACAO_ARQUITETURAL');
  afirma(audP.length === 1 && audP[0].pergunta === 'P1' && audP[0].campo === 'titulo', 'auditoria de P: uma entrada, P1 · titulo (como antes)');
  await page.click('.avp-config-auditoria-btn[data-codigo="CLASSIFICACAO_ARQUITETURAL"]');
  await page.waitForSelector('#avpCfgHistorico');
  await page.click('#avpCfgHistorico > summary');
  const histP = await page.locator('#avpCfgHistorico').innerText();
  afirma(/Pergunta P1 · titulo/.test(histP) && /Versão 1 → 2/.test(histP), 'histórico de P mostrado como antes ("Pergunta P1 · titulo", "Versão 1 → 2")');
  await page.click('#avpCfgAuditoriaVoltarBtn');
  await page.waitForSelector('.avp-config-editar-btn');
  await restaurar(page, 'CLASSIFICACAO_ARQUITETURAL', 1);
  await esperarCondicao(page, () => new Promise((ok) => firebase.database().ref('questionarios-config/CLASSIFICACAO_ARQUITETURAL/versaoPublicada').once('value', (s) => ok(s.val() === 3))), null, { descricao: 'versão 3 da classificação' });
  cfg = await lerConfig(page, 'CLASSIFICACAO_ARQUITETURAL');
  afirma(igual(cfg.versoes[3].perguntas, REFERENCIA.CLASSIFICACAO_ARQUITETURAL.perguntas), 'restaurar a v1 de P: versão 3 = referência do main, campo a campo');
  await page.click('#avpCfgAuditoriaVoltarBtn');
  await page.waitForSelector('.avp-config-editar-btn');
  await abrirEditor(page, 'ADEQUACAO_SQUAD');
  await page.locator('[data-campo="justNao"]').nth(7).fill('NÃO — revisado.');
  await publicarEditor(page);
  await esperarCondicao(page, () => /Versão publicada: 2/.test(document.querySelectorAll('.avp-config-item-card')[1].innerText), null, { descricao: 'versão 2 de squad' });
  cfg = await lerConfig(page, 'ADEQUACAO_SQUAD');
  const esperadoS = clone(REFERENCIA.ADEQUACAO_SQUAD.perguntas); esperadoS[7].justNao = 'NÃO — revisado.';
  afirma(igual(cfg.versoes[2].perguntas, esperadoS), 'S: versão 2 = referência + justNao de S8, sem "tipo"');

  console.log('\n== Excel: colunas antigas intactas, binária × diagnóstico ==');
  const wb = await baixar(page, '#avpCfgExportarTodosBtn');
  afirma(igual(wb.SheetNames, ['Classificação arquitetural', 'Adequação à Squad', 'Posicionamento Organizacional']), 'abas: ' + wb.SheetNames.join(' | '));
  const lp = linhasDe(wb, 'Classificação arquitetural'), ls = linhasDe(wb, 'Adequação à Squad'), lo = linhasDe(wb, 'Posicionamento Organizacional');
  const cab = lp[0];
  afirma(cab.length === 21 && igual(cab.slice(14), ['Tipo de pergunta', 'Ajuda — quando Mesma responsabilidade', 'Ajuda — quando Responsabilidades distintas',
    'Rótulo — Mesma responsabilidade', 'Interpretação — Mesma responsabilidade', 'Rótulo — Responsabilidades distintas', 'Interpretação — Responsabilidades distintas']), '21 colunas: as 14 antigas e as 7 novas no fim');
  const cabAntigo = ['Questionário', 'Versão publicada', 'Código', 'Título', 'Pergunta', 'O que significa', 'Quando responder SIM', 'Quando responder NÃO', 'Exemplo',
    'Palavras-exemplo', 'Orientação extra', 'Interpretação quando SIM', 'Interpretação quando NÃO', 'Observação administrativa'];
  afirma(igual(cab.slice(0, 14), cabAntigo), 'as 14 colunas antigas com o mesmo cabeçalho, na mesma posição');
  const versP = 3, versS = 2;
  const antigosP = REFERENCIA.CLASSIFICACAO_ARQUITETURAL.perguntas.map((q) => linhaExcelAntiga(REFERENCIA.CLASSIFICACAO_ARQUITETURAL.nome, versP, q));
  const antigosS = esperadoS.map((q) => linhaExcelAntiga(REFERENCIA.ADEQUACAO_SQUAD.nome, versS, q));
  afirma(lp.length === 17 && igual(lp.slice(1).map((l) => l.slice(0, 14)), antigosP), 'P1–P16: as 14 colunas com exatamente os valores que o export antigo dava');
  afirma(ls.length === 9 && igual(ls.slice(1).map((l) => l.slice(0, 14)), antigosS), 'S1–S8: idem');
  afirma(lp.slice(1).concat(ls.slice(1)).every((l) => l[14] === 'binaria' && l.slice(15).every((v) => v === '')), 'P/S: tipo "binaria" e as 6 colunas do diagnóstico vazias');
  afirma(lo.length === 11 && lo.slice(1, 10).every((l) => l[14] === 'binaria' && l.slice(15).every((v) => v === '')), 'O1–O9: binárias, colunas do diagnóstico vazias');
  afirma(lo.slice(1, 10).every((l, i) => l[11] === fq.PADRAO[POS].perguntas[i].justSim && l[12] === fq.PADRAO[POS].perguntas[i].justNao), 'O1–O9: interpretações SIM/NÃO nas colunas de sempre');
  const ld = lo[10], dv = cfg && (await lerConfig(page, POS)).versoes[4].perguntas[9];
  afirma(ld[2] === DIAG && ld[14] === TIPO_DIAG && ld[6] === '' && ld[7] === '' && ld[11] === '' && ld[12] === '', 'diagnóstico: tipo próprio e as colunas de SIM/NÃO vazias');
  afirma(ld[15] === dv.textoAjuda.quandoMesma && ld[16] === dv.textoAjuda.quandoDistintas && ld[17] === dv.rotuloMesma && ld[18] === dv.interpretacaoMesma &&
    ld[19] === dv.rotuloDistintas && ld[20] === dv.interpretacaoDistintas, 'diagnóstico: ajuda, rótulos e interpretações de mesma/distintas nas colunas novas');
  afirma(await larguraOk(page), 'sem rolagem horizontal ao final');
  await ctx.close();
  afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
}

(async () => {
  const fq = parte1();
  const browser = await chromium.launch();
  for (const [nome, vp] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) await parte2(browser, fq, nome, vp);
  await browser.close();
  console.log('\n============================\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
