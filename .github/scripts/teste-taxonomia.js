/* TAXONOMIA (Admin → Taxonomia) — interface, importador, edição, auditoria e a SEGUNDA BARREIRA
 * da definição vigente, no desktop e no celular (375 px), com o Firebase falso em persistência real.
 * CONTEÚDO 100% FICTÍCIO: nenhum texto conceitual real vive neste teste nem no código.
 *
 * O que se prova:
 *   1. Estados de leitura distintos: carregando ≠ erro (com "TENTAR NOVAMENTE") ≠ sem acesso ≠ vazio;
 *      "ainda não sei" nunca vira "vazio".
 *   2. Importação única: prévia antes de gravar; arquivo inválido (JSON, duas vigentes, conceito já existente)
 *      não grava NADA; falha do banco não deixa estado parcial; confirmar grava tudo de uma vez, respeitando a
 *      equivalência fonte vigente ⇔ ponteiro; a marca da carga impede nova carga.
 *   3. Dois domínios separados (Arquitetural / Organizacional), cada um com a sua pergunta orientadora e sem
 *      nenhum vínculo entre eles; árvore A → B → C; Disciplina como conceito auxiliar.
 *   4. Definição: registrada (texto vigente), em revisão e "ainda não registrada"; proposta "em validação"
 *      nunca vigente; placeholder/não localizado nunca viram definição.
 *   5. Pergunta discriminadora com a NOTA DE APLICAÇÃO junto; "Alcance de atuação" (nunca "Abrangência").
 *   6. Perfil: ausência é ESTADO (não consta na fonte, ainda não definido…), nunca campo vazio.
 *   7. Edição que de fato SALVA (conceito, fonte, perfil), com auditoria na mesma gravação; recusa do banco
 *      mostra o erro, mantém o que foi digitado e não grava nada.
 *   8. Vigência: tornar vigente (rebaixa a anterior), remover vigência, tudo atômico e auditado.
 *   9. SEGUNDA BARREIRA na aplicação: validarVigencia (no máximo UMA vigente, e só a apontada) e bloqueio
 *      de gravação diante de um estado legado inválido — o banco não é a única proteção.
 *  10. Só admin: não admin não vê nem lê; modo somente leitura sem botões de edição.
 *  11. Desktop: lista e detalhe lado a lado. 375 px: lista → detalhe → "← Voltar para a lista"; sem rolagem
 *      horizontal; sem erro de JS.
 * Hermético: sem rede, sem segredo. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const EMAIL = 'adm@previ.com.br';
const OUTRO = 'comum@previ.com.br';
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const DESKTOP = { width: 1280, height: 900 };
const CELULAR = { width: 375, height: 800 };

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

/* ---------- conteúdo FICTÍCIO ---------- */
const ARQUIVO = () => ({
  versao: 1,
  dominios: {
    organizacional: {
      conceitos: {
        ALFA: { nome: 'Tipo Alfa', camada: 'A', ordem: 1, perguntaDiscriminadora: 'Pergunta fictícia sobre Alfa?', criterios: ['Critério fictício A1', 'Critério fictício A2'], observacoes: 'Observação fictícia de Alfa.' },
        BETA: { nome: 'Especialização Beta', camada: 'B', pai: 'ALFA', ordem: 2, perguntaDiscriminadora: 'Pergunta fictícia sobre Beta?', notaDeAplicacao: 'Nota de aplicação fictícia: Beta e Gama não se confundem.' },
        GAMA: { nome: 'Subespecialização Gama', camada: 'C', pai: 'BETA', ordem: 3, perguntaDiscriminadora: 'Pergunta fictícia sobre Gama?' },
        DELTA: { nome: 'Tipo Delta', camada: 'A', ordem: 4 },
        DISC: { nome: 'Conceito Auxiliar Fictício', camada: 'auxiliar', ordem: 9 }
      },
      fontes: {
        ALFA: [
          { id: 'a1', rotulo: 'Conceito', texto: 'Texto fictício VIGENTE de Alfa.', contexto: 'PREVI', situacao: 'vigente', tipoRedacao: 'Conceito' },
          { id: 'a2', rotulo: 'Versão antiga', texto: 'Texto fictício histórico de Alfa.', contexto: 'BB', situacao: 'histórica/contextual', tipoRedacao: 'Significado v1' },
          { id: 'a3', rotulo: 'Cópia idêntica', texto: 'Texto fictício histórico de Alfa.', contexto: 'PREVI', situacao: 'histórica/contextual', tipoRedacao: 'Significado v2' }
        ],
        BETA: [
          { id: 'b1', texto: 'Texto fictício histórico de Beta.', contexto: 'BB', situacao: 'histórica/contextual', tipoRedacao: 'Significado v1' },
          { id: 'b2', texto: 'Texto fictício placeholder de Beta.', contexto: 'indefinido', situacao: 'placeholder', tipoRedacao: 'Significado v2' },
          { id: 'b3', texto: 'Texto fictício NÃO LOCALIZADO de Beta.', contexto: 'indefinido', situacao: 'não localizado', tipoRedacao: 'Significado v2' }
        ],
        GAMA: [{ id: 'g1', texto: 'Proposta fictícia de Gama, ainda sem aprovação.', contexto: 'PREVI', situacao: 'em validação', tipoRedacao: 'proposta' }]
      },
      atributos: {
        ALCANCE: { nome: 'Alcance de atuação', grupo: 'alcance', tipoValor: 'lista', ordem: 1, valoresPermitidos: ['específica', 'atende algumas estruturas', 'transversal'] },
        CONSUMIDOR: { nome: 'Consumidor direto principal', grupo: 'quem-recebe', tipoValor: 'texto', ordem: 2 },
        BENEFICIARIO: { nome: 'Beneficiário indireto', grupo: 'quem-recebe', tipoValor: 'texto', ordem: 3 },
        FORMA: { nome: 'Forma de entrega/consumo', grupo: 'entrega', tipoValor: 'texto', ordem: 4 }
      },
      perfis: { ALFA: { ALCANCE: { estado: 'registrado', valor: 'transversal', papel: 'observado', origem: 'decisão' }, CONSUMIDOR: { estado: 'não consta na fonte' }, FORMA: { estado: 'registrado', valor: 'Forma inferida fictícia', papel: 'observado', origem: 'inferência' } } },
      relacoes: [{ de: 'BETA', tipo: 'compoe', para: 'ALFA', nota: 'Relação fictícia.' }, { de: 'DELTA', tipo: 'desenvolve-disciplina', para: 'DISC' }]
    },
    arquitetural: {
      conceitos: {
        componente: { nome: 'Componente', ordem: 1 },
        'capacidade-organizacional': { nome: 'Capacidade organizacional', ordem: 2 }
      }
    }
  }
});

function bancoBase(extra) {
  const adm = {}; adm[chave(EMAIL)] = { email: EMAIL, name: 'ADMIN' };
  const users = {}; users[chave(EMAIL)] = { name: 'ADMIN', email: EMAIL, area: 'INFOR' }; users[chave(OUTRO)] = { name: 'COMUM', email: OUTRO, area: 'INFOR' };
  return Object.assign({
    'fa-users': users, 'fa-admins': adm, 'fa-diretores': {}, 'fa-facilitadores': {}, 'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: {}, turmas: {}, 'turmas-interesse': {}, 'turmas-interesse-log': {}, 'turmas-config': {}, 'turmas-checkin': {}, 'turmas-publico': {}, 'eventos-publico': {},
    'turmas-equipe': {}, 'turmas-sorteio': {}, avaliacoes: {}, pedidos: {}, holocron: {}, 'avaliacoes-produto': {}, 'avaliacoes-squad': {},
    'motor-squad-config': {}, 'motor-squad-auditoria': {}, 'motor-arquitetura-auditoria': {}
  }, extra || {});
}

async function abrir(browser, o) {
  o = o || {};
  const cfg = { db: bancoBase(o.db), user: { email: o.email || EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true, fail: o.fail, delays: o.delays, semConfirmacao: o.semConfirmacao, getFalha: o.getFalha };
  const ctx = await browser.newContext({ viewport: o.viewport || DESKTOP });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.body.classList.contains('aguardando-auth'), { timeout: 16000 }).catch(() => {});
  await page.waitForTimeout(600);
  return { ctx, page, erros };
}
async function irParaTaxonomia(page) {
  await page.waitForSelector('.admin-tab-btn[data-panel="adminPanelTaxonomia"]', { state: 'visible', timeout: 12000 });
  await page.click('.admin-tab-btn[data-panel="adminPanelTaxonomia"]');
  await page.waitForSelector('#taxPergunta', { timeout: 8000 });
}
const banco = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal)));
const raizTexto = (page) => page.locator('#adminTaxonomia').innerText();
const aparece = (page, sel, ms) => page.waitForSelector(sel, { timeout: ms || 4000 }).then(() => true).catch(() => false);
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
async function esperaDb(page, fn, arg) { await page.waitForFunction(fn, arg, { timeout: 6000 }).catch(() => {}); }
const carga = (arq) => ({ name: 'carga.json', mimeType: 'application/json', buffer: Buffer.from(typeof arq === 'string' ? arq : JSON.stringify(arq)) });
async function importar(page, arq) {
  await page.setInputFiles('#taxArquivo', carga(arq));
  await page.waitForFunction(() => document.querySelector('#taxPrevia') || document.querySelector('#taxImportErros'), { timeout: 8000 }).catch(() => {});
}
async function abrirConceito(page, codigo) {
  await page.click('.tax-item[data-codigo="' + codigo + '"]');
  await page.waitForSelector('#taxSecFontes', { timeout: 6000 });
  await page.waitForFunction(() => !document.querySelector('#taxSecFontes .loading-msg') && !document.querySelector('#taxSecHistorico .loading-msg'), { timeout: 6000 }).catch(() => {});
}
const TOTAL = 'taxonomia';

(async () => {
  const browser = await chromium.launch();

  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    const movel = viewport.width <= 720;
    console.log('\n######## ' + nomeTela + ' ########');
    const { ctx, page, erros } = await abrir(browser, { viewport });
    await irParaTaxonomia(page);

    /* ---------- vazio verdadeiro + importador ---------- */
    console.log('\n== 1. Vazio verdadeiro e carga inicial pendente ==');
    await aparece(page, '#taxVazio');
    let t = await raizTexto(page);
    afirma(/Nenhum conceito cadastrado: a carga inicial ainda não foi feita/.test(t), 'vazio de verdade: diz que a carga inicial ainda não foi feita');
    afirma(await page.locator('#taxImportador').count() === 1, 'o importador aparece (só admin, só antes da carga)');
    afirma(/A Taxonomia define os conceitos\. A Avaliação aplica/i.test(t), 'aviso fixo: Taxonomia define, Avaliação aplica');
    afirma(!/Abrangência/i.test(t), '"Abrangência" não aparece');

    console.log('\n== 2. Importação: arquivo inválido não grava NADA ==');
    await importar(page, '{ isto não é json');
    t = await page.locator('#taxImportErros').innerText();
    afirma(/não é um JSON válido/.test(t), 'JSON quebrado → erro claro');
    afirma(!(await banco(page)).taxonomia, 'nada gravado');
    const dupla = ARQUIVO(); dupla.dominios.organizacional.fontes.ALFA[1].situacao = 'vigente';
    await importar(page, dupla);
    t = await page.locator('#taxImportErros').innerText();
    afirma(/mais de uma fonte vigente/i.test(t) && await page.locator('#taxPrevia').count() === 0, 'duas fontes vigentes no mesmo conceito → recusado na prévia (segunda barreira, também na importação)');
    afirma(!(await banco(page)).taxonomia, 'nada gravado');
    const camadaRuim = ARQUIVO(); camadaRuim.dominios.organizacional.conceitos.ALFA.camada = 'Z';
    await importar(page, camadaRuim);
    afirma(/camada inválida/.test(await page.locator('#taxImportErros').innerText()), 'camada inválida → recusado');
    const perfilRuim = ARQUIVO(); perfilRuim.dominios.organizacional.perfis.ALFA.CONSUMIDOR = { estado: 'não consta na fonte', valor: '' };
    await importar(page, perfilRuim);
    afirma(/ausência é estado, nunca campo vazio/.test(await page.locator('#taxImportErros').innerText()), 'estado de ausência com valor (mesmo vazio) → recusado');
    const arqExistente = ARQUIVO();
    await page.evaluate(() => { window.__CFG.__dbReal.taxonomia = { organizacional: { conceitos: { ALFA: { nome: 'Já existia', ordem: 1, ativo: true, situacaoDefinicao: 'ainda não registrada', camada: 'A' } } } }; });
    await importar(page, arqExistente);
    afirma(/já existe — a importação nunca sobrescreve/.test(await page.locator('#taxImportErros').innerText()), 'conceito já existente → recusado, nunca sobrescreve');
    afirma((await banco(page)).taxonomia.organizacional.conceitos.ALFA.nome === 'Já existia', 'o conceito existente ficou intacto');
    await page.evaluate(() => { delete window.__CFG.__dbReal.taxonomia; });

    console.log('\n== 2b. Importação: falha do banco não deixa estado parcial ==');
    await importar(page, ARQUIVO());
    afirma(await page.locator('#taxPrevia').count() === 1, 'arquivo válido → prévia antes de gravar');
    t = await page.locator('#taxPrevia').innerText();
    afirma(/7 conceitos/.test(t) && /7 textos-fonte \(1 com definição vigente\)/.test(t) && /4 atributos/.test(t) && /3 valores de perfil/.test(t) && /2 relações/.test(t), 'prévia: 7 conceitos (5 org + 2 arq), 6 fontes, 1 vigente, 4 atributos, 2 relações', t.replace(/\s+/g, ' '));
    afirma(!(await banco(page)).taxonomia, 'a prévia NÃO gravou nada');
    await page.evaluate(() => { window.__CFG.fail = ['taxonomia/organizacional/auditoria']; });
    await page.click('[data-tax="confirmar-importacao"]');
    await page.waitForSelector('#taxFlash.tax-flash--erro', { timeout: 6000 }).catch(() => {});
    afirma(await page.locator('#taxFlash.tax-flash--erro').count() === 1, 'o banco recusou uma parte → erro visível');
    afirma(!(await banco(page)).taxonomia, 'NADA ficou gravado (a gravação é uma só)');
    afirma(await page.locator('#taxPrevia').count() === 1, 'a prévia continua na tela para tentar de novo');
    await page.evaluate(() => { window.__CFG.fail = []; });

    console.log('\n== 2c. Importação: confirmar grava tudo de uma vez ==');
    await page.click('[data-tax="confirmar-importacao"]');
    await esperaDb(page, () => window.__CFG.__dbReal.taxonomia && window.__CFG.__dbReal.taxonomia.meta && window.__CFG.__dbReal.taxonomia.meta.cargaInicial);
    let b = (await banco(page)).taxonomia;
    afirma(!!b && !!b.meta.cargaInicial && b.meta.cargaInicial.feitaPor === EMAIL, 'marca da carga inicial gravada (com o autor)');
    afirma(Object.keys(b.organizacional.conceitos).length === 5 && Object.keys(b.arquitetural.conceitos).length === 2, 'conceitos dos dois domínios gravados (5 + 2)');
    const alfa = b.organizacional.conceitos.ALFA;
    afirma(alfa.definicaoVigenteFonteId === 'a1' && b.organizacional.fontes.ALFA.a1.situacao === 'vigente' && alfa.situacaoDefinicao === 'registrada', 'equivalência respeitada: ponteiro = a1 e a1 é a única vigente');
    afirma(b.organizacional.fontes.ALFA.a2.situacao === 'histórica/contextual', 'a outra fonte de Alfa continua histórica');
    afirma(b.organizacional.conceitos.BETA.situacaoDefinicao === 'em revisão' && !b.organizacional.conceitos.BETA.definicaoVigenteFonteId, 'Beta: há textos, nenhum vigente → "em revisão", sem ponteiro');
    afirma(b.organizacional.conceitos.DELTA.situacaoDefinicao === 'ainda não registrada' && b.organizacional.conceitos.DISC.situacaoDefinicao === 'ainda não registrada', 'sem texto algum → "ainda não registrada"');
    afirma(b.organizacional.conceitos.GAMA.situacaoDefinicao === 'em revisão' && !b.organizacional.conceitos.GAMA.definicaoVigenteFonteId, 'proposta "em validação" NÃO é tornada vigente automaticamente');
    const audCat = Object.values((b.organizacional.auditoria || {})._catalogo || {});
    afirma(audCat.length === 1 && audCat[0].tipo === 'carga_inicial' && audCat[0].usuario.email === EMAIL, 'auditoria da carga gravada (_catalogo)');
    afirma(b.organizacional.perfis.ALFA.CONSUMIDOR.estado === 'não consta na fonte' && !('valor' in b.organizacional.perfis.ALFA.CONSUMIDOR), 'ausência gravada como ESTADO, sem campo de valor');
    afirma(await page.locator('#taxImportador').count() === 0, 'depois da carga o importador some (uma nova carga é recusada)');
    await esperaDb(page, () => document.querySelector('.tax-item'));
    afirma(await page.locator('#taxFlash').count() === 1 && /Carga inicial concluída/.test(await page.locator('#taxFlash').innerText()), 'confirmação visível');

    /* ---------- domínios, árvore, pergunta orientadora ---------- */
    console.log('\n== 3. Dois domínios separados; árvore A → B → C ==');
    t = await page.locator('#taxPergunta').innerText();
    afirma(/Taxonomia Organizacional/.test(t) && /Que tipo de estrutura organizacional é esta\?/.test(t), 'organizacional: pergunta orientadora "Que tipo de estrutura organizacional é esta?"');
    const niveis = await page.locator('.tax-lista .tax-item').evaluateAll((els) => els.map((e) => [e.dataset.codigo, /tax-item--n(\d)/.exec(e.className)[1]]));
    afirma(JSON.stringify(niveis) === JSON.stringify([['ALFA', '0'], ['BETA', '1'], ['GAMA', '2'], ['DELTA', '0'], ['DISC', '0']]), 'árvore: Alfa(A) › Beta(B) › Gama(C); Delta(A); auxiliar por último', JSON.stringify(niveis));
    afirma(/Conceito auxiliar/.test(await page.locator('.tax-lista').innerText()), 'o conceito auxiliar fica em grupo próprio');
    afirma(await page.locator('.tax-item[data-codigo="ALFA"]').innerText().then((x) => /Tipo organizacional/i.test(x) && /Definição registrada/i.test(x)), 'cada item mostra a camada e a situação da definição');
    await page.click('.tax-dominio[data-dominio="arquitetural"]');
    await page.waitForFunction(() => document.querySelector('.tax-item[data-codigo="componente"]'), { timeout: 6000 }).catch(() => {});
    t = await page.locator('#taxPergunta').innerText();
    afirma(/Taxonomia Arquitetural/.test(t) && /O que é o item\?/.test(t), 'arquitetural: pergunta orientadora "O que é o item?"');
    const arqItens = await page.locator('.tax-lista .tax-item').allInnerTexts();
    afirma(arqItens.length === 2 && /Componente/.test(arqItens[0]) && /Capacidade organizacional/.test(arqItens[1]), 'Componente e Capacidade organizacional são conceitos SEPARADOS');
    afirma(arqItens.every((x) => /Definição ainda não registrada/.test(x)), 'sem texto: "Definição ainda não registrada" (nada presumido)');
    afirma(!/Alfa|Beta|Gama/.test(await page.locator('.tax-lista').innerText()), 'o domínio arquitetural não mistura conceitos organizacionais');
    await page.click('.tax-dominio[data-dominio="organizacional"]');
    await aparece(page, '.tax-item[data-codigo="ALFA"]');
    afirma(await page.locator('a[href*="taxonomia"], [data-tax="ligar-dominios"]').count() === 0, 'nenhum vínculo entre os dois domínios');

    /* ---------- detalhe: definição, fontes, pergunta, perfil, relações ---------- */
    console.log('\n== 4. Detalhe: definição, fontes, nota de aplicação, perfil, relações ==');
    if (movel) afirma(await page.locator('.tax-detalhe').isHidden(), '375 px: antes de escolher, só a lista aparece');
    await abrirConceito(page, 'ALFA');
    if (movel) afirma(await page.locator('.tax-lista').isHidden() && await page.locator('.tax-voltar').isVisible(), '375 px: o detalhe ocupa a tela e há "← Voltar para a lista"');
    else afirma(await page.locator('.tax-lista').isVisible() && await page.locator('.tax-detalhe').isVisible(), 'desktop: lista e detalhe lado a lado');
    t = await page.locator('#taxSecDefinicao').innerText();
    afirma(/Definição registrada/.test(t) && /Texto fictício VIGENTE de Alfa\./.test(t) && /Fonte: Conceito \(PREVI\)/.test(t), 'Alfa: definição vigente exibida com a fonte');
    t = await page.locator('#taxSecFontes').innerText();
    afirma(/Texto fictício histórico de Alfa\./.test(t) && /histórica\/contextual/i.test(t) && /BB/.test(t), 'a fonte histórica é preservada, com contexto e situação');
    afirma(await page.locator('.tax-fonte--vigente').count() === 1, 'exatamente uma fonte marcada como vigente');
    /* A0 (clareza): três partes — Definição vigente / Fontes para curadoria / Análise para curadoria */
    afirma(await page.locator('#taxVigenteBloco article[data-fonte="a1"]').count() === 1 && /DEFINIÇÃO VIGENTE/i.test(await page.locator('#taxVigenteBloco').innerText()), 'Definição vigente: a fonte vigente aparece na parte de cima');
    afirma(await page.locator('#taxFontesCuradoria article[data-fonte="a1"]').count() === 0 && await page.locator('article[data-fonte="a1"]').count() === 1, 'a fonte vigente NÃO é repetida na lista "Fontes para curadoria"');
    afirma(await page.locator('#taxFontesCuradoria .tax-fonte--candidata').count() === 2 && (await page.locator('#taxFontesCuradoria .tax-fonte--candidata').allInnerTexts()).every((x) => /FONTE PARA CURADORIA/i.test(x)), 'cada candidata é identificada como "Fonte para curadoria"');
    afirma(/3 fontes cadastradas · 2 textos únicos/.test(await page.locator('#taxResumoFontes').innerText()), 'resumo: "3 fontes cadastradas · 2 textos únicos" (nenhuma fonte some)');
    afirma(/Cópia idêntica/.test(await page.locator('article[data-fonte="a2"] .tax-identico').innerText()) && /Versão antiga/.test(await page.locator('article[data-fonte="a3"] .tax-identico').innerText()) && await page.locator('article[data-fonte="a1"] .tax-identico').count() === 0, 'texto idêntico sinalizado nas duas fontes envolvidas, e só nelas');
    t = await page.locator('#taxFontesCuradoria').innerText();
    afirma(/não graus de autoridade/.test(t) && /Só um texto pode ser a definição vigente/.test(t), 'a tela explica que tipo de redação não é autoridade e que só um texto pode ser vigente');
    afirma(!/recomend|melhor|mais confiável|prefer/i.test(t), 'nenhum ranking nem recomendação automática');
    afirma((await page.locator('#taxFontesCuradoria .tax-acoes').allInnerTexts()).every((x) => /analisar para curadoria/i.test(x) && !/tornar vigente/i.test(x)), 'o botão do card é "Analisar para curadoria" (nunca "Tornar vigente" direto)');
    afirma(await page.locator('#taxSecFontes .btn--primary').count() === 0, 'nenhum botão dourado na lista (o destaque só existe na confirmação)');
    t = await page.locator('#taxSecPergunta').innerText();
    afirma(/Pergunta fictícia sobre Alfa\?/.test(t) && /Critério fictício A1/.test(t) && /Observação fictícia de Alfa\./.test(t), 'pergunta discriminadora, critérios e observações');
    t = await page.locator('#taxSecAtributos').innerText();
    afirma(/Alcance de atuação/.test(t) && /transversal/.test(t) && /Papel: observado/.test(t) && /Origem: decisão/.test(t), 'perfil: "Alcance de atuação" com valor, "Papel: observado" e "Origem: decisão"');
    afirma(/observado: valor presente na fonte ou registrado no perfil, mas ainda não curado como característica definidora ou típica do conceito/.test(await page.locator('#taxLegenda').innerText()), 'a tela DEFINE "observado": valor presente na fonte ou registrado no perfil, mas ainda não curado como definidor ou típico');
    afirma(/definidor: ajuda a distinguir\/classificar o conceito/.test(await page.locator('#taxLegenda').innerText()) && /típico: característica frequente ou esperada/.test(await page.locator('#taxLegenda').innerText()), 'e define "definidor" e "típico"');
    const linhaInf = page.locator('.tax-atributo[data-atributo="FORMA"]');
    afirma(/Origem: inferência/.test(await linhaInf.innerText()) && await linhaInf.locator('.tax-selo--origem-inferencia').count() === 1, 'valor com origem "inferência": exibe claramente "Origem: inferência", em destaque próprio');
    afirma(/não é dado de fonte nem decisão aprovada/.test(await linhaInf.innerText()), 'e avisa que NÃO é dado de fonte nem decisão aprovada');
    afirma(await page.locator('.tax-atributo[data-atributo="ALCANCE"] .tax-inferencia-aviso').count() === 0 && await page.locator('.tax-atributo[data-atributo="ALCANCE"] .tax-selo--origem-decisao').count() === 1, 'a origem "decisão" não leva o aviso de inferência e tem selo próprio');
    afirma(/Consumidor direto principal[\s\S]*Não consta na fonte/i.test(t), 'estado "não consta na fonte" aparece como estado (não como vazio)');
    afirma(/Beneficiário indireto[\s\S]*Ainda não definido/i.test(t), 'atributo sem registro: "Ainda não definido"');
    afirma(!/Abrangência/i.test(await page.locator('.tax-detalhe').innerText()), 'nenhuma "Abrangência"');
    t = await page.locator('#taxSecRelacoes').innerText();
    afirma(/Tipo Alfa|Alfa/.test(t) && /compõe/.test(t), 'relações exibidas ("compõe")');
    if (movel) { await page.click('[data-tax="voltar-lista"]'); afirma(await page.locator('.tax-lista').isVisible() && await page.locator('.tax-detalhe').isHidden(), '375 px: "← Voltar para a lista" volta à lista'); }
    await abrirConceito(page, 'BETA');
    t = await page.locator('#taxSecDefinicao').innerText();
    afirma(/Definição em revisão/.test(t) && /nenhum foi aprovado como definição vigente/.test(t) && !/Texto fictício histórico de Beta\./.test(t), 'Beta: "Definição em revisão" — o texto histórico NÃO é apresentado como definição');
    t = await page.locator('#taxSecPergunta').innerText();
    afirma(/Pergunta fictícia sobre Beta\?/.test(t) && await page.locator('#taxNotaAplicacao').innerText().then((x) => /Nota de aplicação fictícia: Beta e Gama não se confundem\./.test(x)), 'a NOTA DE APLICAÇÃO aparece junto da pergunta discriminadora');
    afirma(await page.locator('[data-fonte="b2"] [data-tax="tornar-vigente"], [data-fonte="b3"] [data-tax="tornar-vigente"]').count() === 0, 'placeholder e "não localizado" NÃO oferecem "Tornar vigente"');
    afirma(/Nenhuma definição vigente\. Nenhum dos textos abaixo vale como definição enquanto não for aprovado\./.test(await page.locator('#taxVigenteBloco').innerText()), 'sem vigente: "Nenhuma definição vigente. Nenhum dos textos abaixo vale como definição enquanto não for aprovado."');
    afirma(/Não pode ser definição \(placeholder\)/.test(await page.locator('article[data-fonte="b2"]').innerText()) && /Não pode ser definição \(não localizado\)/.test(await page.locator('article[data-fonte="b3"]').innerText()), 'placeholder e "não localizado": sem ação de vigência, com o motivo na tela');
    afirma(await page.locator('[data-fonte="b1"] [data-tax="tornar-vigente"]').count() === 1, 'a fonte histórica pode ser promovida');
    if (movel) await page.click('[data-tax="voltar-lista"]');
    await abrirConceito(page, 'GAMA');
    t = await page.locator('#taxSecFontes').innerText();
    afirma(/em validação/i.test(t) && /proposta/i.test(t) && await page.locator('.tax-fonte--vigente').count() === 0, 'proposta: situação "em validação" e tipo "proposta" separados, nunca vigente');
    if (movel) await page.click('[data-tax="voltar-lista"]');
    await abrirConceito(page, 'DELTA');
    t = await page.locator('#taxSecDefinicao').innerText();
    afirma(/Definição ainda não registrada\./.test(t), 'Delta: "Definição ainda não registrada."');
    afirma(await larguraOk(page), 'sem rolagem horizontal');
    if (movel) await page.click('[data-tax="voltar-lista"]');

    /* ---------- edição que SALVA ---------- */
    console.log('\n== 5. Edição de conceito: salva de verdade, com auditoria ==');
    await abrirConceito(page, 'ALFA');
    await page.click('[data-tax="editar-conceito"]');
    await page.fill('#taxF_nome', 'Tipo Alfa Revisado');
    await page.fill('#taxF_criterios', 'Critério fictício A1\nCritério fictício A2\nCritério fictício A3');
    await page.fill('#taxF_observacoes', 'Observação revisada.');
    await page.evaluate(() => { window.__CFG.fail = ['taxonomia/organizacional/conceitos']; });
    await page.click('[data-tax="salvar-edicao"]');
    await page.waitForSelector('#taxFlash.tax-flash--erro', { timeout: 6000 }).catch(() => {});
    afirma(/Nada foi alterado\. O que você digitou continua na tela/.test(await page.locator('#taxFlash').innerText()), 'recusa do banco: erro visível');
    afirma((await page.inputValue('#taxF_nome')) === 'Tipo Alfa Revisado', 'o texto digitado continua no formulário');
    b = (await banco(page)).taxonomia;
    afirma(b.organizacional.conceitos.ALFA.nome === 'Tipo Alfa' && !Object.values(b.organizacional.auditoria.ALFA || {}).length, 'nada gravado: nem o conceito nem a auditoria');
    await page.evaluate(() => { window.__CFG.fail = []; });
    await page.click('[data-tax="salvar-edicao"]');
    await esperaDb(page, () => window.__CFG.__dbReal.taxonomia.organizacional.conceitos.ALFA.nome === 'Tipo Alfa Revisado');
    b = (await banco(page)).taxonomia;
    const alf = b.organizacional.conceitos.ALFA;
    afirma(alf.nome === 'Tipo Alfa Revisado' && alf.observacoes === 'Observação revisada.' && Object.keys(alf.criterios).length === 3 && alf.atualizadoPor === EMAIL, 'conceito salvo (nome, critérios, observações, quem atualizou)');
    const audA = Object.values(b.organizacional.auditoria.ALFA || {});
    afirma(audA.length === 3 && audA.every((l) => l.usuario.email === EMAIL && l.tipo === 'alteracao_conceito') && audA.some((l) => l.campo === 'nome' && l.valorAnterior === 'Tipo Alfa' && l.valorNovo === 'Tipo Alfa Revisado'), 'auditoria: uma linha por campo alterado, com anterior → novo e o autor');
    await aparece(page, '#taxFlash:not(.tax-flash--erro)');
    t = await page.locator('#taxSecHistorico').innerText();
    afirma(/Tipo Alfa → Tipo Alfa Revisado/.test(t), 'o histórico na tela mostra a alteração');
    afirma(/Tipo Alfa Revisado/.test(await page.locator('.tax-item[data-codigo="ALFA"]').innerText().catch(() => '')) || movel, 'a lista reflete o novo nome');

    console.log('\n== 5b. Inferência pode ser alterada sem mexer no texto-fonte ==');
    const fontesAntes = JSON.stringify((await banco(page)).taxonomia.organizacional.fontes.ALFA);
    await page.click('[data-tax="editar-perfil"][data-atributo="FORMA"]');
    afirma(await page.inputValue('#taxF_origem') === 'inferência' && await page.inputValue('#taxF_papel') === 'observado', 'o formulário abre com a origem "inferência" e o papel "observado" atuais');
    await page.fill('#taxF_valor', 'Forma inferida fictícia, revisada');
    await page.click('[data-tax="salvar-edicao"]');
    await esperaDb(page, () => /revisada/.test(window.__CFG.__dbReal.taxonomia.organizacional.perfis.ALFA.FORMA.valor));
    b = (await banco(page)).taxonomia;
    afirma(/revisada/.test(b.organizacional.perfis.ALFA.FORMA.valor) && b.organizacional.perfis.ALFA.FORMA.origem === 'inferência', 'valor inferido alterado; a origem continua "inferência"');
    afirma(JSON.stringify(b.organizacional.fontes.ALFA) === fontesAntes, 'os textos-fonte NÃO foram tocados');
    afirma(Object.values(b.organizacional.auditoria.ALFA).some((l) => l.tipo === 'alteracao_perfil' && l.campo === 'Forma de entrega/consumo'), 'a alteração do valor inferido foi auditada');

    console.log('\n== 6. Edição de perfil: ausência é estado ==');
    await page.click('[data-tax="editar-perfil"][data-atributo="BENEFICIARIO"]');
    await page.selectOption('#taxF_estado', 'ainda não definido');
    afirma(await page.locator('#taxF_valor').count() === 0, 'em estado de ausência não há campo de valor');
    await page.click('[data-tax="salvar-edicao"]');
    await esperaDb(page, () => (window.__CFG.__dbReal.taxonomia.organizacional.perfis.ALFA || {}).BENEFICIARIO);
    b = (await banco(page)).taxonomia;
    afirma(JSON.stringify(Object.keys(b.organizacional.perfis.ALFA.BENEFICIARIO).sort()) === JSON.stringify(['atualizadoEm', 'estado']) && b.organizacional.perfis.ALFA.BENEFICIARIO.estado === 'ainda não definido', 'gravado só com o estado (sem valor, papel nem origem)');
    await aparece(page, '[data-atributo="BENEFICIARIO"] .tax-valor--ausente');
    await page.click('[data-tax="editar-perfil"][data-atributo="CONSUMIDOR"]');
    await page.selectOption('#taxF_estado', 'registrado');
    await page.click('[data-tax="salvar-edicao"]');
    afirma(/exige o valor/.test(await page.locator('#taxFormPerfil').innerText()), '"registrado" sem valor → recusado na tela');
    await page.fill('#taxF_valor', 'Times fictícios');
    afirma(await page.inputValue('#taxF_origem') === '' && await page.inputValue('#taxF_papel') === 'observado', 'ao registrar um valor, a origem NÃO vem pré-marcada (nunca "fonte" por padrão) e o papel nasce neutro ("observado")');
    await page.click('[data-tax="salvar-edicao"]');
    afirma(/exige papel e origem/.test(await page.locator('#taxFormPerfil').innerText()), 'sem escolher a origem, não salva');
    await page.selectOption('#taxF_papel', 'definidor');
    await page.selectOption('#taxF_origem', 'inferência');
    await page.click('[data-tax="salvar-edicao"]');
    await esperaDb(page, () => ((window.__CFG.__dbReal.taxonomia.organizacional.perfis.ALFA || {}).CONSUMIDOR || {}).estado === 'registrado');
    b = (await banco(page)).taxonomia;
    const pc = b.organizacional.perfis.ALFA.CONSUMIDOR;
    afirma(pc.estado === 'registrado' && pc.valor === 'Times fictícios' && pc.papel === 'definidor' && pc.origem === 'inferência', 'registrado com valor, papel e origem');
    afirma(Object.values(b.organizacional.auditoria.ALFA).some((l) => l.tipo === 'alteracao_perfil' && l.campo === 'Consumidor direto principal'), 'auditoria do perfil gravada');
    if (movel) await page.click('[data-tax="voltar-lista"]');

    /* ---------- fontes e vigência ---------- */
    console.log('\n== 7. Fontes e vigência (equivalência fonte vigente ⇔ ponteiro) ==');
    await abrirConceito(page, 'BETA');
    await page.click('[data-tax="nova-fonte"]');
    await page.fill('#taxF_texto', 'Nova redação fictícia de Beta.');
    await page.fill('#taxF_rotulo', 'Nova redação');
    await page.click('[data-tax="salvar-edicao"]');
    await esperaDb(page, () => Object.keys(window.__CFG.__dbReal.taxonomia.organizacional.fontes.BETA).length === 4);
    b = (await banco(page)).taxonomia;
    const novaId = Object.keys(b.organizacional.fontes.BETA).find((k) => !['b1', 'b2', 'b3'].includes(k));
    afirma(!!novaId && b.organizacional.fontes.BETA[novaId].situacao === 'em validação' && b.organizacional.fontes.BETA[novaId].criadoPor === EMAIL, 'nova fonte entra "em validação" (nunca vigente ao criar), com o autor');
    afirma(!b.organizacional.conceitos.BETA.definicaoVigenteFonteId, 'criar a fonte não mexe na definição vigente');
    await aparece(page, '[data-fonte="' + novaId + '"]');
    /* torna vigente com confirmação */
    await page.click('[data-fonte="b1"] [data-tax="tornar-vigente"]');
    afirma(await page.locator('.tax-confirma').count() === 1 && /Análise para curadoria/.test(await page.locator('.tax-confirma').innerText()), 'ANALISAR PARA CURADORIA abre a análise completa (painel inline)');
    afirma(await page.locator('.tax-confirma .btn--primary').count() === 1 && /Tornar esta fonte vigente/i.test(await page.locator('.tax-confirma .btn--primary').innerText()) && /Cancelar \/ manter em revisão/i.test(await page.locator('.tax-confirma .tax-acoes').innerText()) && await page.locator('#taxSecFontes .btn--primary').count() === 1, 'dois botões claros: "Tornar esta fonte vigente" (o ÚNICO dourado) e "Cancelar / manter em revisão"');
    /* A0: a confirmação traz tudo o que a decisão oficial precisa */
    const conf1 = await page.locator('.tax-confirma').innerText();
    const dados1 = await page.locator('.tax-confirma-dados').innerText();
    afirma(/Conceito\s+Especialização Beta/.test(dados1) && /Texto-fonte\s+Significado v1/.test(dados1), 'confirmação: mostra o conceito e a fonte escolhida');
    afirma(/Contexto\s+BB/.test(dados1) && /Tipo de redação\s+Significado v1/.test(dados1) && /Situação atual\s+histórica\/contextual/.test(dados1), 'confirmação: mostra contexto, tipo de redação e situação atual');
    afirma(/Texto integral/i.test(conf1) && (await page.locator('.tax-confirma-texto').innerText()) === 'Texto fictício histórico de Beta.', 'confirmação: mostra o texto INTEGRAL da fonte');
    afirma(/Esta ação altera a definição oficial deste conceito\./.test(conf1) && /não é alterado/.test(conf1) && /auditoria/.test(conf1), 'confirmação: avisa que ALTERA a definição oficial, que o texto-fonte não muda e que fica auditado');
    afirma(!/passa a "histórico\/contextual"/.test(conf1), 'confirmação (sem vigente anterior): não fala em rebaixar ninguém');
    afirma(await larguraOk(page), 'confirmação aberta: sem rolagem horizontal');
    afirma(await page.evaluate(() => { const r = document.querySelector('.tax-confirma').getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth + 1; }), 'confirmação aberta: cabe na largura da tela');
    afirma(await page.locator('[data-fonte="b2"] [data-tax="tornar-vigente"], [data-fonte="b3"] [data-tax="tornar-vigente"]').count() === 0, 'placeholder e "não localizado" não têm botão "Tornar vigente"');
    await page.click('[data-tax="cancelar-confirmacao"]');
    afirma(!(await banco(page)).taxonomia.organizacional.conceitos.BETA.definicaoVigenteFonteId, 'cancelar não grava');
    await page.click('[data-fonte="b1"] [data-tax="tornar-vigente"]');
    await page.click('[data-tax="confirmar-vigente"]');
    await esperaDb(page, () => window.__CFG.__dbReal.taxonomia.organizacional.conceitos.BETA.definicaoVigenteFonteId === 'b1');
    b = (await banco(page)).taxonomia;
    afirma(b.organizacional.conceitos.BETA.definicaoVigenteFonteId === 'b1' && b.organizacional.fontes.BETA.b1.situacao === 'vigente' && b.organizacional.conceitos.BETA.situacaoDefinicao === 'registrada', 'fonte promovida E ponteiro atualizado juntos; conceito "registrada"');
    afirma(Object.values(b.organizacional.fontes.BETA).filter((f) => f.situacao === 'vigente').length === 1, 'só UMA fonte vigente');
    await aparece(page, '.tax-fonte--vigente');
    t = await page.locator('#taxSecDefinicao').innerText();
    afirma(/Texto fictício histórico de Beta\./.test(t) && /Definição registrada/.test(t), 'a definição vigente aparece na seção Definição');
    /* troca: a anterior é rebaixada e a nova promovida na mesma gravação */
    await page.click('[data-fonte="' + novaId + '"] [data-tax="tornar-vigente"]');
    const conf2 = await page.locator('.tax-confirma').innerText();
    afirma(/Texto-fonte\s+Nova redação/.test(await page.locator('.tax-confirma-dados').innerText()) && /Situação atual\s+em validação/.test(conf2) && /Nova redação fictícia de Beta\./.test(conf2), 'confirmação da troca: mostra a nova fonte, a situação atual (em validação) e o texto');
    afirma(/O texto vigente atual \(Significado v1 \(BB\)\) passa a "histórico\/contextual"/.test(conf2), 'confirmação da troca: diz QUAL texto vigente atual será rebaixado');
    await page.click('[data-tax="confirmar-vigente"]');
    await esperaDb(page, (id) => window.__CFG.__dbReal.taxonomia.organizacional.conceitos.BETA.definicaoVigenteFonteId === id, novaId);
    b = (await banco(page)).taxonomia;
    afirma(b.organizacional.conceitos.BETA.definicaoVigenteFonteId === novaId && b.organizacional.fontes.BETA[novaId].situacao === 'vigente' && b.organizacional.fontes.BETA.b1.situacao === 'histórica/contextual', 'trocar a vigente: a anterior foi REBAIXADA e a nova promovida');
    afirma(Object.values(b.organizacional.fontes.BETA).filter((f) => f.situacao === 'vigente').length === 1, 'continua UMA só vigente');
    const audV = Object.values(b.organizacional.auditoria.BETA).filter((l) => l.tipo === 'definicao_vigente');
    afirma(audV.length === 2 && audV.every((l) => l.usuario.email === EMAIL), 'cada troca de definição vigente tem a sua linha de auditoria');
    const evTroca = audV.find((l) => l.fonteNovaId === novaId);
    afirma(!!evTroca && evTroca.fonteAnteriorId === 'b1' && /Significado v1 \(BB\)/.test(evTroca.valorAnterior) && /Nova redação/.test(evTroca.valorNovo) && !!evTroca.dataHora && evTroca.usuario.email === EMAIL, 'auditoria da troca: identifica a fonte ANTERIOR (b1) e a NOVA, quem fez e quando');
    afirma(/Significado v1 \(BB\) → Nova redação/.test(await page.locator('#taxSecHistorico').innerText()), 'o histórico na tela mostra "anterior → nova"');
    /* recusa do banco na troca: nada muda */
    await aparece(page, '[data-fonte="b1"] [data-tax="tornar-vigente"]');
    await page.evaluate(() => { window.__CFG.fail = ['taxonomia/organizacional/auditoria']; });
    await page.click('[data-fonte="b1"] [data-tax="tornar-vigente"]');
    await page.click('[data-tax="confirmar-vigente"]');
    await page.waitForSelector('#taxFlash.tax-flash--erro', { timeout: 6000 }).catch(() => {});
    b = (await banco(page)).taxonomia;
    afirma(b.organizacional.conceitos.BETA.definicaoVigenteFonteId === novaId && b.organizacional.fontes.BETA[novaId].situacao === 'vigente' && b.organizacional.fontes.BETA.b1.situacao === 'histórica/contextual', 'troca recusada pelo banco: NENHUMA das três partes mudou (atômico)');
    await page.evaluate(() => { window.__CFG.fail = []; });
    await page.click('[data-tax="fechar-flash"]');
    await page.click('[data-tax="cancelar-confirmacao"]').catch(() => {});
    /* remover vigência */
    await page.click('[data-fonte="' + novaId + '"] [data-tax="remover-vigencia"]');
    const confR = await page.locator('.tax-confirma').innerText();
    afirma(await page.locator('.tax-confirma').count() === 1 && /Esta ação remove a definição oficial vigente deste conceito e o deixará novamente em revisão\./.test(confR) && /auditoria/.test(confR), 'remover vigência pede confirmação, com o aviso de que o conceito volta para revisão e que a ação é auditada');
    afirma(/Conceito\s+Especialização Beta/.test(await page.locator('.tax-confirma-dados').innerText()) && /Fonte vigente atual\s+Nova redação \(PREVI\)/.test(await page.locator('.tax-confirma-dados').innerText()), 'a confirmação da remoção mostra o conceito e a fonte vigente atual');
    afirma(await larguraOk(page) && await page.locator('.tax-confirma .btn--primary').count() === 0, 'confirmação da remoção: sem rolagem horizontal e sem botão dourado (o dourado é só do "Tornar esta fonte vigente")');
    if (movel) afirma(await page.evaluate(() => { const b = document.querySelectorAll('.tax-confirma .tax-acoes .btn'); return b.length === 2 && b[1].getBoundingClientRect().top >= b[0].getBoundingClientRect().bottom - 1; }), '375 px: os botões da confirmação ficam empilhados');
    await page.click('[data-tax="cancelar-confirmacao"]');
    afirma((await banco(page)).taxonomia.organizacional.conceitos.BETA.definicaoVigenteFonteId === novaId, 'cancelar a remoção não grava nada: a definição vigente continua');
    await page.click('[data-fonte="' + novaId + '"] [data-tax="remover-vigencia"]');
    await page.click('[data-tax="confirmar-remocao"]');
    await esperaDb(page, () => !window.__CFG.__dbReal.taxonomia.organizacional.conceitos.BETA.definicaoVigenteFonteId);
    b = (await banco(page)).taxonomia;
    afirma(!b.organizacional.conceitos.BETA.definicaoVigenteFonteId && b.organizacional.fontes.BETA[novaId].situacao === 'histórica/contextual' && b.organizacional.conceitos.BETA.situacaoDefinicao === 'em revisão', 'remover vigência: ponteiro limpo E fonte rebaixada juntos; conceito volta a "em revisão"');
    afirma(Object.values(b.organizacional.fontes.BETA).filter((f) => f.situacao === 'vigente').length === 0, 'nenhuma fonte vigente sobrou');
    const audR = Object.values(b.organizacional.auditoria.BETA).filter((l) => l.tipo === 'definicao_vigente');
    afirma(audR.length === 3 && audR.some((l) => l.fonteAnteriorId === novaId && !l.fonteNovaId && !l.valorNovo), 'auditoria da remoção da vigência: identifica a fonte que deixou de ser vigente e que não há nova');
    /* editar fonte */
    await aparece(page, '[data-fonte="b1"] [data-tax="editar-fonte"]');
    await page.click('[data-fonte="b1"] [data-tax="editar-fonte"]');
    await page.fill('#taxF_texto', 'Texto fictício histórico de Beta, revisado.');
    await page.click('[data-tax="salvar-edicao"]');
    await esperaDb(page, () => /revisado/.test(window.__CFG.__dbReal.taxonomia.organizacional.fontes.BETA.b1.texto));
    b = (await banco(page)).taxonomia;
    afirma(/revisado/.test(b.organizacional.fontes.BETA.b1.texto) && Object.values(b.organizacional.auditoria.BETA).some((l) => l.tipo === 'alteracao_fonte' && l.fonteId === 'b1'), 'edição de fonte salva, com auditoria');
    afirma(await larguraOk(page), 'sem rolagem horizontal');
    if (movel) await page.click('[data-tax="voltar-lista"]');

    /* ---------- SEGUNDA BARREIRA ---------- */
    console.log('\n== 8. Segunda barreira na aplicação: no máximo UMA fonte vigente ==');
    const v = await page.evaluate(() => {
      const V = window.faTaxonomia.validarVigencia;
      return {
        nenhuma: V({ a: { situacao: 'histórica/contextual' } }, null),
        uma: V({ a: { situacao: 'vigente' }, b: { situacao: 'placeholder' } }, 'a'),
        duas: V({ a: { situacao: 'vigente' }, b: { situacao: 'vigente' } }, 'a'),
        semPonteiro: V({ a: { situacao: 'vigente' } }, null),
        ponteiroNaoVigente: V({ a: { situacao: 'histórica/contextual' } }, 'a'),
        ponteiroInexistente: V({ a: { situacao: 'vigente' } }, 'z'),
        vigenteDiferenteDoPonteiro: V({ a: { situacao: 'vigente' }, b: { situacao: 'histórica/contextual' } }, 'b')
      };
    });
    afirma(v.nenhuma.ok && v.uma.ok, 'sem vigente e sem ponteiro: ok; uma vigente = a apontada: ok');
    afirma(!v.duas.ok && /mais de uma fonte vigente/i.test(v.duas.erro), 'duas vigentes: recusado');
    afirma(!v.semPonteiro.ok, 'vigente sem ser a apontada pelo conceito: recusado');
    afirma(!v.ponteiroNaoVigente.ok && !v.ponteiroInexistente.ok && !v.vigenteDiferenteDoPonteiro.ok, 'ponteiro para fonte não vigente / inexistente / diferente da vigente: recusado');
    /* estado legado inválido, criado FORA das regras: a aplicação acusa e recusa salvar */
    await page.evaluate(() => {
      const t = window.__CFG.__dbReal.taxonomia.organizacional;
      t.fontes.DELTA = {
        d1: { texto: 'Legado 1', contexto: 'PREVI', situacao: 'vigente', tipoRedacao: 'Conceito' },
        d2: { texto: 'Legado 2', contexto: 'PREVI', situacao: 'vigente', tipoRedacao: 'Conceito' }
      };
      t.conceitos.DELTA.definicaoVigenteFonteId = 'd1';
    });
    await abrirConceito(page, 'DELTA');
    afirma(await aparece(page, '#taxAvisoVigencia') && /mais de uma fonte vigente/i.test(await page.locator('#taxAvisoVigencia').innerText()), 'estado legado com duas vigentes: a tela ACUSA a inconsistência');
    const antesLegado = JSON.stringify((await banco(page)).taxonomia.organizacional.fontes.DELTA);
    await page.click('[data-tax="nova-fonte"]');
    await page.fill('#taxF_texto', 'Tentativa de salvar com o estado inválido.');
    await page.click('[data-tax="salvar-edicao"]');
    await page.waitForSelector('#taxFlash.tax-flash--erro', { timeout: 4000 }).catch(() => {});
    afirma(/Não foi salvo: Há mais de uma fonte vigente/i.test(await page.locator('#taxFlash').innerText()), 'salvar fica BLOQUEADO pela aplicação (não depende só do banco)');
    afirma(JSON.stringify((await banco(page)).taxonomia.organizacional.fontes.DELTA) === antesLegado, 'nada foi gravado');
    await page.click('[data-tax="cancelar-edicao"]');
    await page.click('[data-fonte="d2"] [data-tax="editar-fonte"]').catch(() => {});
    if (await page.locator('[data-fonte="d2"] [data-tax="tornar-vigente"]').count()) afirma(false, 'não deveria oferecer promover uma fonte já vigente');
    else afirma(true, 'fonte já vigente não oferece "Tornar vigente"');
    afirma(await larguraOk(page), 'sem rolagem horizontal');
    afirma(erros.length === 0, 'sem erros de JavaScript (' + erros.length + ')');
    await ctx.close();
  }

  /* ---------- estados de leitura ---------- */
  console.log('\n######## Estados de leitura (desktop) ########');
  {
    console.log('\n== Carregando ≠ vazio: leitura lenta ==');
    const { ctx, page, erros } = await abrir(browser, { delays: { taxonomia: 1800 } });
    await irParaTaxonomia(page);
    afirma(await aparece(page, '#taxCarregando', 1500) && !(await page.locator('#taxVazio').count()), 'enquanto não chega, diz "Carregando a Taxonomia…" — nunca "vazio"');
    afirma(!/Nenhum conceito|não tem conceitos|Você não tem acesso/.test(await raizTexto(page)), 'e não diz que está vazia nem sem acesso');
    await aparece(page, '#taxVazio', 6000);
    afirma(await page.locator('#taxVazio').count() === 1, 'depois que chega vazio, aí sim mostra o vazio verdadeiro');
    afirma(erros.length === 0, 'sem erros de JavaScript');
    await ctx.close();
  }
  {
    console.log('\n== Banco que nunca responde: erro com TENTAR NOVAMENTE (não "vazio") ==');
    const { ctx, page } = await abrir(browser, { delays: { taxonomia: 600000 } });
    await irParaTaxonomia(page);
    await aparece(page, '#taxErro', 17000);
    afirma(await page.locator('#taxErro').count() === 1 && /TENTAR NOVAMENTE/.test(await page.locator('#taxErro').innerText()), 'depois do limite de espera: erro de rede com "TENTAR NOVAMENTE"');
    afirma(!(await page.locator('#taxVazio').count()), 'nunca finge que está vazio');
    await page.evaluate(() => { window.__CFG.delays = {}; });
    await page.click('[data-tax="recarregar"]');
    await aparece(page, '#taxVazio', 8000);
    afirma(await page.locator('#taxVazio').count() === 1, '"TENTAR NOVAMENTE" recarrega (agora chega, vazio de verdade)');
    await ctx.close();
  }
  {
    console.log('\n== Banco recusa a leitura: "sem acesso" (≠ erro de rede) ==');
    const { ctx, page, erros } = await abrir(browser, { fail: ['taxonomia'] });
    await irParaTaxonomia(page);
    await aparece(page, '#taxSemAcesso', 6000);
    afirma(await page.locator('#taxSemAcesso').count() === 1 && !(await page.locator('#taxErro').count()), 'PERMISSION_DENIED → "Você não tem acesso a esta área."');
    await page.waitForTimeout(500);
    afirma(erros.length === 0, 'PERMISSION_DENIED NÃO gera erro nem rejeição de promessa não tratada na página (' + erros.length + ')');
    await ctx.close();
  }

  /* ---------- só admin ---------- */
  console.log('\n######## Só admin / somente leitura ########');
  {
    const { ctx, page } = await abrir(browser, { email: OUTRO, db: { taxonomia: { meta: {}, organizacional: { conceitos: { ALFA: { nome: 'Tipo Alfa', camada: 'A', ordem: 1, ativo: true, situacaoDefinicao: 'ainda não registrada' } } } } } });
    await page.waitForTimeout(800);
    afirma(await page.locator('.admin-tab-btn[data-panel="adminPanelTaxonomia"]').isHidden().catch(() => true), 'quem não é admin não vê a aba Taxonomia');
    await page.evaluate(() => window.faTaxonomia.abrir());
    await page.waitForTimeout(500);
    const txt = await page.locator('#adminTaxonomia').innerText();
    afirma(/só para administradoras/.test(txt) && !/Tipo Alfa/.test(txt), 'mesmo chamando o módulo direto: nada é lido nem mostrado');
    await ctx.close();
  }
  {
    const arq = ARQUIVO();
    const { ctx, page } = await abrir(browser, {});
    await irParaTaxonomia(page);
    await importar(page, arq);
    await page.click('[data-tax="confirmar-importacao"]');
    await esperaDb(page, () => window.__CFG.__dbReal.taxonomia && window.__CFG.__dbReal.taxonomia.meta);
    await page.evaluate(() => window.faTaxonomia.abrir({ somenteLeitura: true }));
    await aparece(page, '.tax-item[data-codigo="ALFA"]');
    await abrirConceito(page, 'ALFA');
    const botoes = await page.locator('#adminTaxonomia [data-tax="editar-conceito"], #adminTaxonomia [data-tax="nova-fonte"], #adminTaxonomia [data-tax="tornar-vigente"], #adminTaxonomia [data-tax="editar-perfil"], #adminTaxonomia [data-tax="editar-fonte"]').count();
    afirma(botoes === 0, 'modo somente leitura: nenhum botão de edição (consulta de verdade)');
    afirma(/Texto fictício VIGENTE de Alfa\./.test(await page.locator('#taxSecDefinicao').innerText()), 'e a consulta continua completa');
    await ctx.close();
  }

  /* ---------- A GRAVAÇÃO QUE NÃO RECEBE CONFIRMAÇÃO DO SERVIDOR (bug de produção: Remover vigência) ---------- */
  const SEM = 'taxonomia/organizacional/fontes/SQ/f1'; /* só a ESCRITA do Squad bate aqui; as leituras não */
  const semente = () => ({ taxonomia: { meta: { cargaInicial: { feitaEm: '2026-10-03T10:00:00.000Z', feitaPor: EMAIL, resumo: {} } },
    organizacional: { conceitos: { SQ: { nome: 'Conceito Fictício Sq', camada: 'A', ordem: 1, ativo: true, situacaoDefinicao: 'registrada', definicaoVigenteFonteId: 'f1' } },
      fontes: { SQ: { f1: { texto: 'Texto fictício vigente.', contexto: 'PREVI', situacao: 'vigente', tipoRedacao: 'Conceito', rotulo: 'Conceito', criadoEm: '2026-10-03T10:00:00.000Z', criadoPor: EMAIL },
                      f2: { texto: 'Texto fictício histórico.', contexto: 'BB', situacao: 'histórica/contextual', tipoRedacao: 'Significado v1', criadoEm: '2026-10-03T10:00:01.000Z', criadoPor: EMAIL } } },
      auditoria: {} }, arquitetural: {} } });
  const banco2 = async (page) => (await banco(page)).taxonomia.organizacional;
  const nEventos = async (page) => Object.values(((await banco2(page)).auditoria || {}).SQ || {}).filter((a) => a.tipo === 'definicao_vigente').length;
  async function abrirSq(browser, viewport, extra) {
    const r = await abrir(browser, Object.assign({ viewport, db: semente() }, extra || {}));
    await irParaTaxonomia(r.page);
    await aparece(r.page, '.tax-item[data-codigo="SQ"]');
    await abrirConceito(r.page, 'SQ');
    /* tempos curtos só no teste (em produção: 20 s de espera e conferência a cada 5 s) */
    await r.page.evaluate(() => { const e = window.faTaxonomia._interno.espera; e.gravacao = 700; e.reverificar = 400; });
    return r;
  }
  const removerSq = async (page) => { await page.click('[data-tax="remover-vigencia"]'); await page.click('[data-tax="confirmar-remocao"]'); };

  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    const movel = viewport.width <= 720;
    console.log('\n######## Gravação sem confirmação do servidor — ' + nomeTela + ' ########');

    console.log('\n== G1. Sucesso normal: nada muda no comportamento ==');
    {
      const { ctx, page, erros } = await abrirSq(browser, viewport);
      await removerSq(page);
      await aparece(page, '#taxFlash:not(.tax-flash--erro)');
      const o = await banco2(page);
      afirma(!o.conceitos.SQ.definicaoVigenteFonteId && o.fontes.SQ.f1.situacao === 'histórica/contextual' && o.conceitos.SQ.situacaoDefinicao === 'em revisão' && await nEventos(page) === 1, 'remover vigência com confirmação normal: gravado, auditado (1 evento)');
      afirma(await page.locator('#taxPendente').count() === 0 && /Nenhuma definição vigente/.test(await page.locator('#taxVigenteBloco').innerText()), 'sem aviso de pendência e a tela já mostra "Nenhuma definição vigente"');
      afirma(erros.length === 0, 'sem erros de JavaScript');
      await ctx.close();
    }

    console.log('\n== G2. PERMISSION_DENIED: continua recusado, sem bloqueio nem aviso de pendência ==');
    {
      const { ctx, page } = await abrirSq(browser, viewport, { fail: [SEM] });
      await removerSq(page);
      await aparece(page, '#taxFlash.tax-flash--erro');
      afirma(/o banco recusou a gravação/.test(await page.locator('#taxFlash').innerText()) && await page.locator('#taxPendente').count() === 0, 'recusa de regra: mensagem de recusa, sem "pendência"');
      afirma((await banco2(page)).conceitos.SQ.definicaoVigenteFonteId === 'f1' && await nEventos(page) === 0, 'nada gravado, nenhum evento');
      await page.evaluate(() => { window.__CFG.fail = []; });
      await page.click('[data-tax="fechar-flash"]');
      await page.click('[data-tax="cancelar-confirmacao"]').catch(() => {});
      await removerSq(page);
      await aparece(page, '#taxFlash:not(.tax-flash--erro)');
      afirma(!(await banco2(page)).conceitos.SQ.definicaoVigenteFonteId && await nEventos(page) === 1, 'sem estado preso: repetir depois de corrigida a causa funciona (1 evento)');
      await ctx.close();
    }

    console.log('\n== G3. Confirmação ATRASADA: a tela confere, bloqueia repetição e reconcilia quando chega ==');
    {
      const { ctx, page, erros } = await abrirSq(browser, viewport);
      await page.evaluate((k) => { window.__CFG.delays = { [k]: 3200 }; }, SEM);
      await removerSq(page);
      afirma(await aparece(page, '#taxPendente', 3000), 'passado o limite: aparece o aviso "Gravação sem confirmação do servidor"');
      await page.waitForFunction(() => /NÃO consta/.test((document.querySelector('#taxPendente') || {}).innerText || ''), null, { timeout: 2500 }).catch(() => {});
      const aviso = await page.locator('#taxPendente').innerText();
      afirma(/NÃO consta no banco/.test(aviso) && /Não repita/i.test(aviso), 'conferiu o servidor: "a alteração ainda NÃO consta no banco" e pede para NÃO repetir');
      afirma(await larguraOk(page), 'aviso aberto: sem rolagem horizontal');
      if (movel) afirma(await page.evaluate(() => { const b = document.querySelector('#taxPendente .btn'); return !b || b.getBoundingClientRect().right <= window.innerWidth + 1; }), '375 px: o botão do aviso cabe na tela');
      const escritasAntes = await page.evaluate(() => (window.__ESCRITAS || []).length);
      await page.click('[data-tax="remover-vigencia"]').catch(() => {});
      await page.click('[data-tax="confirmar-remocao"]').catch(() => {});
      await page.waitForTimeout(250);
      afirma(/Aguarde|ainda sem confirmação/i.test(await page.locator('#taxFlash').innerText().catch(() => '')) && await page.evaluate(() => (window.__ESCRITAS || []).length) === escritasAntes, 'nova tentativa da mesma ação: BLOQUEADA com aviso, e nenhuma escrita nova foi enviada');
      afirma((await banco2(page)).conceitos.SQ.definicaoVigenteFonteId === 'f1', 'enquanto não confirma, o banco continua como estava');
      await page.waitForSelector('#taxPendente', { state: 'detached', timeout: 6000 }).catch(() => {});
      await page.waitForFunction(() => /Nenhuma definição vigente/.test((document.querySelector('#taxVigenteBloco') || {}).innerText || ''), null, { timeout: 5000 }).catch(() => {});
      afirma(await page.locator('#taxPendente').count() === 0, 'a confirmação chegou: o aviso some');
      afirma(/FOI aplicada/.test(await page.locator('#taxFlash').innerText()), 'a tela informa que a alteração FOI aplicada (confirmação atrasada)');
      afirma(/Nenhuma definição vigente/.test(await page.locator('#taxVigenteBloco').innerText()) && !(await banco2(page)).conceitos.SQ.definicaoVigenteFonteId && await nEventos(page) === 1, 'a tela foi reconciliada com o banco, e há UM só evento de auditoria (nenhuma repetição)');
      afirma(erros.length === 0, 'sem erros de JavaScript');
      await ctx.close();
    }

    console.log('\n== G4. Gravada, mas a confirmação se perdeu: a conferência no servidor reconcilia ==');
    {
      const { ctx, page } = await abrirSq(browser, viewport, { semConfirmacao: [SEM] });
      await removerSq(page);
      await page.waitForFunction(() => /FOI aplicada/.test((document.querySelector('#taxFlash') || {}).innerText || ''), null, { timeout: 5000 }).catch(() => {});
      afirma(/FOI aplicada/.test(await page.locator('#taxFlash').innerText().catch(() => '')) && await page.locator('#taxPendente').count() === 0, 'sem resposta, mas o servidor TEM o evento: a tela informa que foi aplicada e não deixa pendência');
      afirma(/Nenhuma definição vigente/.test(await page.locator('#taxVigenteBloco').innerText()) && await nEventos(page) === 1, 'tela atualizada; um único evento (não repetiu)');
      await ctx.close();
    }

    console.log('\n== G5. Sem resposta E sem conseguir consultar o servidor: não afirma nada e bloqueia ==');
    {
      const { ctx, page } = await abrirSq(browser, viewport, { getFalha: true });
      await page.evaluate((k) => { window.__CFG.delays = { [k]: 600000 }; }, SEM);
      await removerSq(page);
      await page.waitForFunction(() => /Não consegui consultar/.test((document.querySelector('#taxPendente') || {}).innerText || ''), null, { timeout: 4000 }).catch(() => {});
      const aviso = await page.locator('#taxPendente').innerText().catch(() => '');
      afirma(/Não consegui consultar o servidor/.test(aviso) && /Não sei se a alteração foi aplicada/.test(aviso), 'sem poder conferir: diz que NÃO sabe se foi aplicada (nunca afirma "gravou" nem "não gravou")');
      afirma(/recarregue a página/i.test(aviso), 'orienta recarregar a página para ver o estado real');
      afirma(await larguraOk(page), 'sem rolagem horizontal');
      const antes = await page.evaluate(() => (window.__ESCRITAS || []).length);
      await page.click('[data-tax="remover-vigencia"]').catch(() => {}); await page.click('[data-tax="confirmar-remocao"]').catch(() => {});
      await page.waitForTimeout(250);
      afirma(await page.evaluate(() => (window.__ESCRITAS || []).length) === antes, 'não há repetição cega: nenhuma escrita nova enquanto não houver confirmação');
      await page.evaluate(() => { window.__CFG.getFalha = false; });
      await page.click('[data-tax="verificar-pendente"]');
      await page.waitForFunction(() => /NÃO consta/.test((document.querySelector('#taxPendente') || {}).innerText || ''), null, { timeout: 4000 }).catch(() => {});
      afirma(/NÃO consta no banco/.test(await page.locator('#taxPendente').innerText().catch(() => '')), '"VERIFICAR NO SERVIDOR": consultou de novo (agora com conexão) e informa que NÃO consta');
      afirma((await banco2(page)).conceitos.SQ.definicaoVigenteFonteId === 'f1' && await nEventos(page) === 0, 'o banco segue intacto (nada aplicado)');
      await ctx.close();
    }
  }

  await browser.close();
  console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
