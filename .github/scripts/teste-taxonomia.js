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
 *      mostra o erro, mantém o que foi digitado e não grava nada. Texto-fonte IMUTÁVEL: fonte existente só
 *      edita rótulo e situação (texto só para leitura); salvarFonte recusa, com mensagem, trocar o texto; a
 *      vigente tem "Nova versão da definição" no lugar de "Editar" (fluxo completo: teste-taxonomia-nova-versao.js).
 *      Código do conceito no detalhe; carga inicial com a contagem POR domínio (auditoria, meta e Histórico global,
 *      inclusive a apresentação honesta das linhas antigas, que só tinham o total geral).
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
const { esperarCondicao, esperarSessaoAssentada } = require('./esperas');
/* Etapa 6.1: "Atributos / perfil" começa RECOLHIDO — abrir (clicando no cabeçalho, como a pessoa) antes de ler ou editar */
async function abrirAtributos(page) {
  /* decide só com a ficha ASSENTADA: logo depois de salvar ela recarrega, e um clique nesse meio fecharia o que já estava aberto */
  await esperarCondicao(page, () => !!document.getElementById('taxAtributosRecolhivel') && !document.querySelector('.tax-detalhe .loading-msg') && !/carregando/.test((document.getElementById('taxAtributosResumo') || {}).textContent || '') && !document.querySelector('#taxFlash ~ * .tax-salvando'), null, { descricao: 'ficha do conceito assentada' });
  if (await page.evaluate(() => { const d = document.getElementById('taxAtributosRecolhivel'); return !!d && d.open; })) return;
  await page.click('#taxAtributosRecolhivel > summary');
  await page.waitForFunction(() => { const d = document.getElementById('taxAtributosRecolhivel'); return !!d && d.open; }, null, { timeout: 4000 });
}

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
  await esperarSessaoAssentada(page); /* login decidido e acessos resolvidos (antes: opções no lugar do argumento, engolida) */
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
/* histórico do conceito: recolhido por padrão — abre (clicando no cabeçalho) só se ainda estiver fechado */
async function abrirHistorico(page) {
  await page.waitForSelector('#taxHistoricoConceito > summary', { timeout: 6000 });
  if (!(await page.locator('#taxHistoricoConceito').evaluate((d) => d.open))) await page.click('#taxHistoricoConceito > summary');
  await esperarCondicao(page, () => { const d = document.querySelector('#taxHistoricoConceito'); return !!d && d.open; }, null, { limite: 4000, descricao: 'histórico do conceito aberto' });
}
/* ordem vertical das seções do detalhe (a de cima primeiro) */
const ordemSecoes = (page, ids) => page.evaluate((lista) => lista.map((id) => { const el = document.getElementById(id); return el ? el.getBoundingClientRect().top + window.pageYOffset : null; }), ids);

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
    /* carga POR DOMÍNIO: cada linha registra a contagem do próprio domínio (antes: o total geral, igual nas duas) */
    const audCatArq = Object.values((b.arquitetural.auditoria || {})._catalogo || {});
    afirma(audCat[0].valorNovo === 'Carga inicial — Organizacional: 5 conceitos, 7 textos-fonte (1 com definição vigente), 4 atributos, 3 valores de perfil, 2 relações' && audCat[0].resumoDominio.conceitos === 5 && audCat[0].resumoDominio.fontes === 7 && audCat[0].dominio === 'organizacional', 'linha da carga do Organizacional: contagem SÓ do Organizacional (5 conceitos, 7 textos-fonte)', audCat[0].valorNovo);
    afirma(audCatArq.length === 1 && audCatArq[0].valorNovo === 'Carga inicial — Arquitetural: 2 conceitos, 0 textos-fonte (0 com definição vigente)' && audCatArq[0].resumoDominio.conceitos === 2, 'linha da carga do Arquitetural: contagem SÓ do Arquitetural (2 conceitos)', audCatArq[0] && audCatArq[0].valorNovo);
    afirma(b.meta.cargaInicial.resumoPorDominio.organizacional.conceitos === 5 && b.meta.cargaInicial.resumoPorDominio.arquitetural.conceitos === 2 && b.meta.cargaInicial.resumo.conceitos === 7, 'meta da carga: total (7) e também por domínio (5 + 2)');
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
    afirma(/Definição registrada/.test(t) && /Texto fictício VIGENTE de Alfa\./.test(t), 'Alfa: definição vigente exibida');
    t = await page.locator('#taxVigenteMeta').innerText();
    afirma(/Rótulo da fonte\s+Conceito/.test(t) && /Contexto\s+PREVI/.test(t) && /Tipo de redação\s+Conceito/.test(t) && /Registrada por\s+/.test(t) && /Fonte \(id\)\s+a1/.test(t), 'cartão da definição vigente: rótulo, contexto, tipo de redação, autoria e id da fonte', t.replace(/\s+/g, ' '));
    /* ORDEM do detalhe: Identificação → Definição vigente → outras fontes → Critérios e pergunta → Atributos → Relações → Histórico (por último) */
    const tops = await ordemSecoes(page, ['taxSecIdent', 'taxSecDefinicao', 'taxSecFontes', 'taxSecPergunta', 'taxSecAtributos', 'taxSecRelacoes', 'taxSecHistorico']);
    afirma(tops.every((y) => y !== null) && tops.every((y, i) => i === 0 || y > tops[i - 1]), 'ordem do detalhe: Identificação, Definição vigente, outras fontes, Critérios e pergunta, Atributos, Relações, Histórico', JSON.stringify(tops));
    afirma(await page.evaluate(() => { const secs = document.querySelectorAll('.tax-detalhe > .tax-sec'); return secs.length > 0 && secs[secs.length - 1].id === 'taxSecHistorico'; }), 'o Histórico é a última seção do detalhe');
    t = await page.locator('#taxSecIdent').innerText();
    afirma(/Código:\s*ALFA/.test(t) && /Nome:\s*Tipo Alfa/.test(t) && /Situação:[\s\S]*ativo[\s\S]*Definição registrada/.test(t) && /Camada:\s*Tipo organizacional/.test(t), 'Identificação: código, nome, situação (ativo + definição) e camada', t.replace(/\s+/g, ' '));
    afirma(/^Definição vigente/.test((await page.locator('#taxSecDefinicao h4').innerText()).trim()) && await page.locator('#taxSecDefinicao.tax-sec--definicao').count() === 1, 'b) "Definição vigente" é uma seção própria, em destaque');
    afirma(await page.locator('#taxVigenteBloco article[data-fonte="a1"] .tax-acoes--fonte [data-tax="nova-versao"]').isVisible(), '"Nova versão da definição" fica DENTRO do cartão da definição vigente, à vista');
    afirma(/^Outras fontes da definição — 2$/.test((await page.locator('#taxOutrasFontes > summary').innerText()).trim()) && await page.locator('#taxOutrasFontes').evaluate((d) => d.open), '"Outras fontes da definição — 2" logo depois do cartão (aberto, recolhível)');
    /* HISTÓRICO recolhido por padrão — aqui com N = 0 (a carga inicial não grava no histórico do conceito) */
    afirma(await page.locator('#taxHistoricoConceito').count() === 1 && !(await page.locator('#taxHistoricoConceito').evaluate((d) => d.open)) && (await page.locator('#taxHistoricoConceito > summary').innerText()).trim() === 'Histórico — 0 alterações', 'histórico do conceito: fechado por padrão, cabeçalho "Histórico — 0 alterações"');
    await abrirHistorico(page);
    afirma(/Nenhuma alteração registrada/.test(await page.locator('#taxSecHistorico').innerText()), 'aberto (N = 0): "Nenhuma alteração registrada."');
    /* ações GERAIS separadas das ações do conceito */
    afirma(await page.locator('#taxAcoesGerais #taxExportar').count() === 1 && await page.locator('.tax-detalhe #taxExportar, .tax-detalhe [data-tax="exportar-excel"]').count() === 0, 'exportar fica em "Ações gerais da Taxonomia", fora do detalhe do conceito');
    afirma(await page.locator('#taxAcoesGerais [data-tax="editar-conceito"], #taxAcoesGerais [data-tax="nova-versao"]').count() === 0 && await page.locator('#taxSecIdent [data-tax="editar-conceito"]').count() === 1, 'as ações do conceito ficam no detalhe ("Editar dados do conceito" em Identificação), não nas gerais');
    afirma((await page.locator('#taxCodigo').innerText()).trim() === 'Código: ALFA' && await page.locator('#taxCodigo').isVisible(), 'o detalhe mostra o código do conceito ("Código: ALFA")');
    /* Textos-fonte: TRÊS blocos separados — Definição vigente / Fontes disponíveis / Fontes arquivadas */
    afirma(await page.locator('.tax-fonte--vigente').count() === 1, 'exatamente uma fonte marcada como vigente');
    afirma(await page.locator('#taxVigenteBloco article[data-fonte="a1"]').count() === 1 && /DEFINIÇÃO OFICIAL/.test(await page.locator('#taxVigenteBloco').innerText()) && /Texto fictício VIGENTE de Alfa\./.test(await page.locator('#taxVigenteBloco').innerText()), 'Definição vigente: aparece em cima, com o selo "DEFINIÇÃO OFICIAL" e o texto');
    afirma(await page.locator('#taxFontesDisponiveis article[data-fonte="a1"]').count() === 0 && await page.locator('article[data-fonte="a1"]').count() === 1, 'a vigente NÃO é repetida em "Fontes disponíveis"');
    afirma(/Fontes disponíveis \(2\)/.test(await page.locator('#taxFontesDisponiveis h5').textContent()) && await page.locator('#taxFontesDisponiveis .tax-fonte--disponivel').count() === 2, '"Fontes disponíveis (2)": as duas não vigentes, em cartões recolhidos');
    afirma(/^2 fontes disponíveis$/.test((await page.locator('#taxResumoFontes').innerText()).trim()) && await page.locator('#taxFontesArquivadas').count() === 0, 'contador simples "2 fontes disponíveis"; sem arquivadas não existe a seção de arquivadas');
    afirma(!/Texto fictício histórico de Alfa\./.test(await page.locator('#taxFontesDisponiveis').innerText()), 'cartão recolhido NÃO mostra o texto integral (só rótulo, contexto, situação)');
    t = await page.locator('article[data-fonte="a2"]').innerText();
    afirma(/Versão antiga/.test(t) && /BB/.test(t) && /histórica\/contextual/i.test(t), 'cartão recolhido mostra rótulo, contexto e situação resumida');
    afirma(await page.locator('#taxFontesDisponiveis .tax-identico--resumo').count() === 2 && await page.locator('article[data-fonte="a1"] .tax-identico').count() === 0, 'sinal de "texto idêntico" nas duas fontes envolvidas (a2 e a3), e só nelas');
    afirma((await page.locator('article[data-fonte="a2"] .tax-acoes--fonte .btn').allTextContents()).join('|') === 'Ver|Usar como vigente|Arquivar', 'ações do cartão recolhido: Ver, Usar como vigente, Arquivar (nesta ordem)');
    afirma((await page.locator('article[data-fonte="a1"] .tax-acoes--fonte .btn').allTextContents()).join('|') === 'Nova versão da definição|Alterar definição|Remover vigência|Editar rótulo|Ver detalhes' && await page.locator('article[data-fonte="a1"] [data-tax="arquivar"]').count() === 0, 'a vigente: Nova versão da definição, Alterar definição, Remover vigência, Editar rótulo, Ver detalhes — e NUNCA "Arquivar"');
    afirma(await page.locator('#taxFontesDisponiveis [data-tax="editar-fonte"], #taxVigenteBloco [data-tax="editar-fonte"]').count() === 0, '"Editar" não aparece enquanto o cartão está recolhido');
    await page.click('article[data-fonte="a2"] [data-tax="ver"]');
    t = await page.locator('article[data-fonte="a2"]').innerText();
    afirma(/Texto fictício histórico de Alfa\./.test(t) && /Significado v1/.test(t) && /Cópia idêntica/.test(t) && /\ba2\b/.test(t) && await page.locator('article[data-fonte="a2"] [data-tax="editar-fonte"]').count() === 1, 'Ver: texto integral, tipo de redação, situação, ids, nomes dos idênticos e o botão Editar (só aqui)');
    await page.click('article[data-fonte="a3"] [data-tax="ver"]');
    afirma(await page.locator('.tax-fonte--aberta').count() === 1 && await page.locator('article[data-fonte="a3"].tax-fonte--aberta').count() === 1 && !/Texto fictício histórico de Alfa\./.test(await page.locator('article[data-fonte="a2"]').innerText()), 'só UM cartão expandido por vez (abrir a3 recolhe a2)');
    await page.click('article[data-fonte="a1"] [data-tax="ver"]');
    afirma(await page.locator('.tax-fonte--aberta').count() === 1 && await page.locator('article[data-fonte="a1"].tax-fonte--aberta').count() === 1 && await page.locator('article[data-fonte="a1"] [data-tax="nova-versao"]').count() === 1, 'detalhes da vigente também seguem a regra de um só aberto, e "Nova versão da definição" fica dentro dela');
    afirma(await page.locator('article[data-fonte="a1"] [data-tax="editar-fonte"]').count() === 0 && /Nova versão da definição/.test(await page.locator('article[data-fonte="a1"] [data-tax="nova-versao"]').textContent()), 'a vigente NÃO tem "Editar" (texto-fonte imutável): o botão é "Nova versão da definição"');
    await page.click('article[data-fonte="a1"] [data-tax="ver"]');
    afirma(await page.locator('.tax-fonte--aberta').count() === 0, 'Ocultar detalhes recolhe de volta');
    t = await page.locator('#taxSecFontes').innerText();
    afirma(!/recomend|melhor|mais confiável|prefer/i.test(t), 'nenhum ranking nem recomendação automática');
    t = await page.locator('#taxVigenteBloco').boundingBox(); const t2 = await page.locator('#taxFontesDisponiveis').boundingBox();
    afirma(t && t2 && t.y + t.height <= t2.y + 1, 'visualmente separados: o bloco vigente termina antes do bloco de disponíveis começar');
    afirma(await page.locator('#taxSecFontes .btn--primary').count() === 0, 'nenhum botão dourado na lista (o destaque só existe na confirmação)');
    t = await page.locator('#taxSecPergunta').innerText();
    afirma(/Pergunta fictícia sobre Alfa\?/.test(t) && /Critério fictício A1/.test(t) && /Observação fictícia de Alfa\./.test(t), 'pergunta discriminadora, critérios e observações');
    await abrirAtributos(page);
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
    afirma(/Relações de saída \(0\)/.test(await page.locator('#taxRelSaida h5').innerText()) && /Relações de entrada \(1\)/.test(await page.locator('#taxRelEntrada h5').innerText()), 'relações separadas e rotuladas: "Relações de saída (0)" e "Relações de entrada (1)"');
    afirma(await page.locator('#taxRelEntrada li[data-relacao="BETA__compoe__ALFA"]').count() === 1 && /BETA/.test(await page.locator('#taxRelEntrada li[data-relacao="BETA__compoe__ALFA"]').innerText()) && /este conceito/.test(await page.locator('#taxRelEntrada li').first().innerText()), 'entrada: BETA compõe → este conceito (o outro conceito aparece com o código)');
    if (movel) {
      afirma(await page.locator('.tax-voltar').isVisible() && /VOLTAR PARA A LISTA/.test(await page.locator('.tax-voltar').innerText()), '375 px: "← VOLTAR PARA A LISTA" é um botão visível no topo do detalhe');
      afirma(await page.locator('.tax-voltar-rodape [data-tax="voltar-lista"]').isVisible(), '375 px: o mesmo "VOLTAR" também no fim do detalhe (tela longa)');
      afirma(await page.evaluate(() => [...document.querySelectorAll('.tax-detalhe button, .tax-detalhe summary')].filter((b) => b.offsetParent).every((b) => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth + 1; })), '375 px: todos os botões do detalhe cabem na largura da tela');
      await page.click('.tax-voltar-rodape [data-tax="voltar-lista"]');
      afirma(await page.locator('.tax-lista').isVisible() && await page.locator('.tax-detalhe').isHidden(), '375 px: o "VOLTAR" do rodapé volta à lista');
      afirma(await page.evaluate(() => { const it = document.querySelector('.tax-item--ativo[data-codigo="ALFA"]'); if (!it) return false; const r = it.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight; }), '375 px: de volta à lista, o conceito escolhido continua marcado e à vista');
      await abrirConceito(page, 'ALFA');
      afirma(!(await page.locator('#taxHistoricoConceito').evaluate((d) => d.open)), 'voltar ao conceito: o histórico recomeça fechado');
      await page.click('[data-tax="voltar-lista"]'); afirma(await page.locator('.tax-lista').isVisible() && await page.locator('.tax-detalhe').isHidden(), '375 px: "← Voltar para a lista" volta à lista');
    }
    await abrirConceito(page, 'BETA');
    t = await page.locator('#taxSecDefinicao').innerText();
    afirma(/Definição em revisão/.test(t) && /nenhum foi aprovado como definição vigente/.test(t) && !/Texto fictício histórico de Beta\./.test(t), 'Beta: "Definição em revisão" — o texto histórico NÃO é apresentado como definição');
    afirma(/Conceito pai:\s*Tipo Alfa\s*ALFA/.test(await page.locator('#taxIdentPai').innerText()), 'Identificação de Beta: o conceito pai (nome e código)');
    afirma(/Relações de saída \(1\)/.test(await page.locator('#taxRelSaida h5').innerText()) && await page.locator('#taxRelSaida li[data-relacao="BETA__compoe__ALFA"]').count() === 1 && /ALFA/.test(await page.locator('#taxRelSaida li').first().innerText()), 'a mesma relação, vista de Beta, é de SAÍDA (→ ALFA)');
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
    await abrirHistorico(page); /* aberto ANTES de salvar: tem de continuar aberto depois do re-render */
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
    await esperarCondicao(page, () => /Histórico — 3 alterações/.test((document.querySelector('#taxHistoricoConceito > summary') || {}).textContent || ''), null, { limite: 6000, descricao: 'histórico recarregado com as 3 alterações' });
    afirma(await page.locator('#taxHistoricoConceito').evaluate((d) => d.open), 'o histórico que estava aberto continua aberto depois de salvar (estado guardado no re-render)');
    t = await page.locator('#taxSecHistorico').innerText();
    afirma(/Tipo Alfa → Tipo Alfa Revisado/.test(t), 'o histórico na tela mostra a alteração');
    const linhaNome = page.locator('#taxHistoricoConceito .tax-hist-item').filter({ hasText: 'Tipo Alfa → Tipo Alfa Revisado' });
    t = await linhaNome.innerText();
    afirma(/\d{2}\/\d{2}\/\d{4}/.test(t) && new RegExp(EMAIL.replace('.', '\\.')).test(t) && /Alteração de conceito/.test(t), 'cada linha do histórico: data, autor e tipo da alteração', t.replace(/\s+/g, ' '));
    afirma(/Tipo Alfa Revisado/.test(await page.locator('.tax-item[data-codigo="ALFA"]').innerText().catch(() => '')) || movel, 'a lista reflete o novo nome');

    console.log('\n== 5b. Inferência pode ser alterada sem mexer no texto-fonte ==');
    const fontesAntes = JSON.stringify((await banco(page)).taxonomia.organizacional.fontes.ALFA);
    await abrirAtributos(page);
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
    await abrirAtributos(page);
    await page.click('[data-tax="editar-perfil"][data-atributo="BENEFICIARIO"]');
    await page.selectOption('#taxF_estado', 'ainda não definido');
    afirma(await page.locator('#taxF_valor').count() === 0, 'em estado de ausência não há campo de valor');
    await page.click('[data-tax="salvar-edicao"]');
    await esperaDb(page, () => (window.__CFG.__dbReal.taxonomia.organizacional.perfis.ALFA || {}).BENEFICIARIO);
    b = (await banco(page)).taxonomia;
    afirma(JSON.stringify(Object.keys(b.organizacional.perfis.ALFA.BENEFICIARIO).sort()) === JSON.stringify(['atualizadoEm', 'estado']) && b.organizacional.perfis.ALFA.BENEFICIARIO.estado === 'ainda não definido', 'gravado só com o estado (sem valor, papel nem origem)');
    await aparece(page, '[data-atributo="BENEFICIARIO"] .tax-valor--ausente');
    await abrirAtributos(page);
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
    afirma(await page.locator('.tax-confirma').count() === 1 && /Usar como definição vigente/.test(await page.locator('.tax-confirma').innerText()), '"Usar como vigente" abre a confirmação completa (painel inline)');
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
    await abrirHistorico(page);
    await page.waitForFunction(() => /Significado v1 \(BB\) → Nova redação/.test((document.querySelector('#taxSecHistorico') || {}).innerText || ''), null, { timeout: 6000 }).catch(() => {});
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
    await aparece(page, '[data-fonte="b1"] [data-tax="ver"]');
    afirma(await page.locator('[data-fonte="b1"] [data-tax="editar-fonte"]').count() === 0, '"Editar" só aparece depois de expandir o cartão (Ver)');
    await page.click('[data-fonte="b1"] [data-tax="ver"]');
    await aparece(page, '[data-fonte="b1"] [data-tax="editar-fonte"]');
    afirma(/redação superada/.test(await page.locator('article[data-fonte="b1"] .tax-ajuda-corrigir').innerText()), 'ao lado do "Editar", a dica: texto errado → nova fonte + arquivar com "redação superada"');
    await page.click('[data-fonte="b1"] [data-tax="editar-fonte"]');
    /* TEXTO-FONTE IMUTÁVEL: o formulário de uma fonte existente não oferece texto, contexto nem tipo para editar */
    afirma(await page.locator('#taxFormFonte #taxF_texto, #taxFormFonte #taxF_contexto, #taxFormFonte #taxF_tipoRedacao').count() === 0, 'fonte existente: sem campo de texto, contexto nem tipo de redação para editar');
    afirma((await page.locator('#taxF_textoFixo').innerText()) === 'Texto fictício histórico de Beta.' && /redação superada/.test(await page.locator('#taxAjudaImutavel').innerText()), 'o texto aparece só para leitura, com a explicação de como corrigir (nova fonte + arquivar com "redação superada")');
    afirma(await page.locator('#taxF_rotulo').count() === 1 && await page.locator('#taxF_situacao').count() === 1, 'o que continua editável — rótulo e situação — tem campo (e salva, abaixo)');
    await page.fill('#taxF_rotulo', 'Rótulo revisado de Beta');
    await page.click('[data-tax="salvar-edicao"]');
    await esperarCondicao(page, () => window.__CFG.__dbReal.taxonomia.organizacional.fontes.BETA.b1.rotulo === 'Rótulo revisado de Beta', null, { limite: 6000, descricao: 'rótulo de b1 gravado' });
    b = (await banco(page)).taxonomia;
    afirma(b.organizacional.fontes.BETA.b1.rotulo === 'Rótulo revisado de Beta' && b.organizacional.fontes.BETA.b1.texto === 'Texto fictício histórico de Beta.' && Object.values(b.organizacional.auditoria.BETA).some((l) => l.tipo === 'alteracao_fonte' && l.fonteId === 'b1'), 'edição de fonte (rótulo) salva, com auditoria; o texto ficou intacto');
    /* DEFESA EM PROFUNDIDADE: mesmo chamando a gravação com o texto mudado, a aplicação recusa com mensagem visível */
    await esperarCondicao(page, () => !!document.querySelector('[data-fonte="b1"] [data-tax="ver"]') && !document.querySelector('#taxSecFontes .loading-msg'), null, { limite: 6000, descricao: 'detalhe de Beta recarregado' });
    const escritasAntesT5 = await page.evaluate(() => (window.__ESCRITAS || []).length);
    await page.evaluate(() => {
      const I = window.faTaxonomia._interno, D = I.st.d.organizacional;
      D.edicao = { tipo: 'fonte', chave: 'b1', valores: { rotulo: 'Rótulo revisado de Beta', texto: 'Texto ADULTERADO por fora do formulário.', contexto: 'BB', tipoRedacao: 'Significado v1', situacao: 'histórica/contextual' }, erro: null };
      I.salvarFonte('organizacional', 'BETA');
    });
    await esperarCondicao(page, () => /não podem ser alterados/.test((document.querySelector('#taxFlash.tax-flash--erro') || {}).innerText || ''), null, { limite: 4000, descricao: 'recusa visível da troca de texto' });
    afirma(/não podem ser alterados/.test(await page.locator('#taxFlash').innerText()) && /redação superada/.test(await page.locator('#taxFlash').innerText()), 'salvarFonte RECUSA trocar o texto de fonte existente, com mensagem visível');
    afirma(await page.evaluate(() => (window.__ESCRITAS || []).length) === escritasAntesT5 && (await banco(page)).taxonomia.organizacional.fontes.BETA.b1.texto === 'Texto fictício histórico de Beta.', 'nenhuma escrita foi enviada e o texto continua o mesmo');
    await page.click('[data-tax="cancelar-edicao"]');
    await page.click('[data-tax="fechar-flash"]');
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
    /* A ausência só prova algo se o cartão da fonte vigente d2 está na tela — e também expandido.
       Antes: clique em "Editar" (que só existe com o cartão aberto) falhava calado em 30 s e a
       ausência passava por vazio. */
    afirma(await page.locator('article[data-fonte="d2"]').count() === 1, 'o cartão da fonte vigente d2 está na tela');
    afirma(await page.locator('article[data-fonte="d2"] [data-tax="tornar-vigente"]').count() === 0, 'fonte já vigente não oferece "Usar como vigente" (cartão fechado)');
    await page.click('article[data-fonte="d2"] [data-tax="ver"]');
    await esperarCondicao(page, () => { const b = document.querySelector('article[data-fonte="d2"] [data-tax="ver"]'); return !!b && b.getAttribute('aria-expanded') === 'true'; }, null, { limite: 4000, descricao: 'cartão d2 expandido' });
    afirma(await page.locator('article[data-fonte="d2"] [data-tax="tornar-vigente"]').count() === 0, 'fonte já vigente não oferece "Usar como vigente" (cartão aberto)');
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
    await esperarCondicao(page, () => !!(window.faAuth && window.faAuth.isAdminReady && window.faAuth.isAdminReady()), null, { limite: 8000, descricao: 'acesso de admin resolvido' });
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
    const botoes = await page.locator('#adminTaxonomia [data-tax="editar-conceito"], #adminTaxonomia [data-tax="nova-fonte"], #adminTaxonomia [data-tax="tornar-vigente"], #adminTaxonomia [data-tax="editar-perfil"], #adminTaxonomia [data-tax="editar-fonte"], #adminTaxonomia [data-tax="nova-versao"]').count();
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
    await r.page.evaluate(() => {
      const I = window.faTaxonomia._interno;
      I.espera.gravacao = 700; I.espera.reverificar = 400;
      /* o leitor de servidor de verdade é REST (ver teste-rules-taxonomia.js, seção 10); aqui lê o banco falso,
         que só guarda o estado do SERVIDOR, e obedece a getFalha ("sem conexão") */
      I.leitores.servidor = (caminho, cb) => {
        if (window.__CFG.getFalha) { setTimeout(() => cb({ ok: false, erro: 'sem conexão (falso)' }), 50); return; }
        const v = caminho.split('/').reduce((o, k) => (o == null ? o : o[k]), window.__CFG.__dbReal);
        setTimeout(() => cb({ ok: true, valor: v === undefined ? null : v }), 20);
      };
    });
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
      /* o flash sai antes das releituras (aposSalvar) que redesenham o bloco da vigente: espera o estado que a asserção exige */
      await esperarCondicao(page, () => { const b = document.getElementById('taxVigenteBloco'); return !!b && /Nenhuma definição vigente/.test(b.innerText); }, null, { descricao: 'o bloco da vigente ser redesenhado com "Nenhuma definição vigente"' });
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

  /* ---------- HISTÓRICO GLOBAL (auditoria/_catalogo dos dois domínios) ---------- */
  const chaveEv = (i) => '-P3A' + String(100000 + i); /* crescem com o tempo, como as chaves de push */
  /* As linhas de carga ANTIGAS como a aplicação as gravou até esta correção: o MESMO texto, com o total geral
     dos dois domínios, nas duas linhas (por isso o Histórico global mostrava duas linhas idênticas). */
  const CARGA_ANTIGA = 'Importação única: 7 conceitos, 7 fontes';
  const evOrg = (i) => i === 0
    ? { tipo: 'carga_inicial', campo: 'carga inicial', valorNovo: CARGA_ANTIGA, dataHora: '2026-10-03T10:00:00.000Z', usuario: { nome: 'Admin Fictício', email: EMAIL } }
    : { tipo: 'alteracao_atributo', campo: 'Atributo fictício ' + i, valorAnterior: 'antes ' + i, valorNovo: 'depois ' + i, dataHora: '2026-10-03T10:' + String(i).padStart(2, '0') + ':00.000Z', usuario: { nome: 'Admin Fictício', email: EMAIL } };
  const semenHG = (nOrg, comArq) => {
    const org = {}; for (let i = 0; i < nOrg; i++) org[chaveEv(i)] = evOrg(i);
    const arq = comArq ? {
      [chaveEv(0)]: { tipo: 'carga_inicial', campo: 'carga inicial', valorNovo: CARGA_ANTIGA, dataHora: '2026-10-03T10:00:00.002Z', usuario: { nome: 'Admin Fictício', email: EMAIL } },
      [chaveEv(20)]: { tipo: 'alteracao_relacao', campo: 'Squad → Linha', valorNovo: 'compõe', dataHora: '2026-10-03T10:20:00.500Z', usuario: { nome: 'Admin Fictício', email: EMAIL } },
      [chaveEv(40)]: { tipo: 'tipo_futuro_desconhecido', campo: 'algo', valorNovo: 'novo', dataHora: '2026-10-03T10:40:00.000Z', usuario: { email: EMAIL } }
    } : {};
    return { taxonomia: { meta: { cargaInicial: { feitaEm: '2026-10-03T10:00:00.000Z', feitaPor: EMAIL, resumo: {} } },
      organizacional: { conceitos: { SQ: { nome: 'Conceito Fictício', camada: 'A', ordem: 1, ativo: true, situacaoDefinicao: 'ainda não registrada' } }, auditoria: { _catalogo: org } },
      arquitetural: { conceitos: {}, auditoria: { _catalogo: arq } } } };
  };
  async function abrirHG(browser, viewport, nOrg, comArq, extra) {
    const r = await abrir(browser, Object.assign({ viewport, db: semenHG(nOrg, comArq) }, extra || {}));
    await irParaTaxonomia(r.page);
    await aparece(r.page, '.tax-item[data-codigo="SQ"]');
    await r.page.evaluate(() => { const e = window.faTaxonomia._interno.espera; e.leitura = 1200; });
    return r;
  }
  /* o histórico global também começa RECOLHIDO: a aba abre a área, e o cabeçalho "Histórico — N alterações" abre a lista */
  const abrirListaHG = async (page) => {
    await page.waitForSelector('#taxHgDetalhes > summary', { timeout: 4000 });
    if (!(await page.locator('#taxHgDetalhes').evaluate((d) => d.open))) await page.click('#taxHgDetalhes > summary');
    await esperarCondicao(page, () => { const d = document.querySelector('#taxHgDetalhes'); return !!d && d.open; }, null, { limite: 4000, descricao: 'lista do histórico global aberta' });
  };
  const abaHG = async (page) => { await page.click('[data-tax="aba-historico"]'); await abrirListaHG(page); };
  const linhasHG = (page) => page.locator('#taxHistoricoGlobal .tax-hg-item');

  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    const movel = viewport.width <= 720;
    console.log('\n######## Histórico global — ' + nomeTela + ' ########');

    console.log('\n== H1. Acesso, ordem, conteúdo e "Carregar mais" ==');
    {
      const { ctx, page, erros } = await abrirHG(browser, viewport, 30, true);
      const abas = await page.locator('.tax-dominios [role="tab"]').allInnerTexts();
      afirma(abas.length === 3 && /Histórico global/i.test(abas[2]), 'terceira aba "Histórico global" na linha dos domínios');
      const escritas0 = await page.evaluate(() => (window.__ESCRITAS || []).length);
      await page.click('[data-tax="aba-historico"]');
      await esperarCondicao(page, () => /^Histórico — 28 alterações/.test(((document.querySelector('#taxHgDetalhes > summary') || {}).textContent || '').trim()), null, { limite: 4000, descricao: 'cabeçalho do histórico global com a contagem' });
      afirma(!(await page.locator('#taxHgDetalhes').evaluate((d) => d.open)) && (await page.locator('#taxHgDetalhes > summary').innerText()).trim() === 'Histórico — 28 alterações carregadas (há mais antigas)', 'histórico global: começa RECOLHIDO, com "Histórico — 28 alterações carregadas (há mais antigas)"');
      afirma(!(await linhasHG(page).first().isVisible()), 'recolhido: nenhuma linha à vista antes do clique');
      await abrirListaHG(page);
      await aparece(page, '#taxHistoricoGlobal .tax-hg-item');
      afirma(await page.locator('.tax-wrap').count() === 0 && await page.locator('[data-tax="aba-historico"][aria-selected="true"]').count() === 1, 'a aba troca a área de lista/detalhe pelo histórico e fica marcada');
      afirma(await linhasHG(page).count() === 28, 'primeira carga: 25 eventos mais recentes do Organizacional + 3 do Arquitetural = 28');
      const datas = await linhasHG(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-datahora')));
      afirma(datas.every((d, i) => i === 0 || d <= datas[i - 1]), 'ordenado do mais recente para o mais antigo (mescla dos dois domínios)');
      const t = await page.locator('#taxHistoricoGlobal').innerText();
      afirma(/Arquitetural/.test(await linhasHG(page).first().innerText()) && /tipo_futuro_desconhecido/.test(t), 'o evento mais recente é do Arquitetural e um tipo desconhecido aparece com o nome técnico (não some)');
      afirma(/Alteração de atributo/.test(t) && /Alteração de relação/.test(t) && /Admin Fictício/.test(t) && new RegExp(EMAIL.replace('.', '\\.')).test(t), 'tipos legíveis, domínio e quem fez (nome e e-mail)');
      afirma(/Atributo fictício 29/.test(t) && !/Atributo fictício 4\b/.test(t), 'só os 25 mais recentes do Organizacional na primeira página');
      /* carga ANTIGA (só o total geral): título por domínio e contagem ATUAL do domínio, rotulada como tal */
      const cargaArq = page.locator('.tax-hg-item[data-dominio="arquitetural"][data-chave="' + chaveEv(0) + '"]');
      await esperarCondicao(page, (k) => /Hoje o domínio tem/.test((document.querySelector('.tax-hg-item[data-dominio="arquitetural"][data-chave="' + k + '"]') || {}).innerText || ''), chaveEv(0), { limite: 4000, descricao: 'contagem atual do Arquitetural' });
      const tCargaArq = await cargaArq.innerText();
      afirma(/Carga inicial — Arquitetural/.test(tCargaArq) && /Hoje o domínio tem 0 conceitos e 0 textos-fonte \(contagem atual, não a da carga\)/.test(tCargaArq), 'carga antiga: "Carga inicial — Arquitetural" com a contagem ATUAL do domínio, dita como atual', tCargaArq.replace(/\s+/g, ' '));
      afirma(/não registrada/.test(tCargaArq) && /total dos dois domínios juntos: "Importação única: 7 conceitos, 7 fontes"/.test(tCargaArq), 'o total antigo não é apresentado como do domínio: aparece marcado como "total dos dois domínios juntos"');
      afirma(await larguraOk(page), 'sem rolagem horizontal');
      if (movel) afirma(await linhasHG(page).first().evaluate((e) => e.getBoundingClientRect().right <= window.innerWidth + 1), '375 px: os cartões cabem na tela');
      afirma(await page.locator('[data-tax="hg-mais"]').count() === 1, 'há mais eventos: aparece "CARREGAR MAIS"');
      await page.click('[data-tax="hg-mais"]');
      await page.waitForFunction(() => document.querySelectorAll('#taxHistoricoGlobal .tax-hg-item').length === 33, null, { timeout: 5000 }).catch(() => {});
      afirma(await linhasHG(page).count() === 33, '"Carregar mais" traz os 5 restantes do Organizacional (33 no total)');
      const chaves2 = await linhasHG(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-dominio') + '/' + e.getAttribute('data-chave')));
      afirma(new Set(chaves2).size === chaves2.length, 'nenhum evento repetido entre as páginas');
      const datas2 = await linhasHG(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-datahora')));
      afirma(datas2.every((d, i) => i === 0 || d <= datas2[i - 1]) && await page.locator('[data-tax="hg-mais"]').count() === 0, 'continua ordenado e o botão some quando acabou');
      await esperarCondicao(page, (k) => /Hoje o domínio tem/.test((document.querySelector('.tax-hg-item[data-dominio="organizacional"][data-chave="' + k + '"]') || {}).innerText || ''), chaveEv(0), { limite: 4000, descricao: 'contagem atual do Organizacional' });
      const tCargaOrg = await page.locator('.tax-hg-item[data-dominio="organizacional"][data-chave="' + chaveEv(0) + '"]').innerText();
      afirma(/Carga inicial — Organizacional/.test(tCargaOrg) && /Hoje o domínio tem 1 conceito e 0 textos-fonte/.test(tCargaOrg), 'a outra linha: "Carga inicial — Organizacional", com a contagem do PRÓPRIO domínio (as duas linhas não são mais idênticas)', tCargaOrg.replace(/\s+/g, ' '));
      afirma(await page.evaluate(() => (window.__ESCRITAS || []).length) === escritas0, 'só leitura: nenhuma escrita (nada copiado para os conceitos, nenhuma auditoria nova)');
      if (movel) {
        afirma(await page.locator('.tax-voltar-hg--topo [data-tax="voltar-dominio"]').isVisible() && await page.locator('.tax-voltar-hg--rodape [data-tax="voltar-dominio"]').isVisible() && /VOLTAR PARA OS CONCEITOS/.test(await page.locator('.tax-voltar-hg--topo').innerText()), '375 px: "← VOLTAR PARA OS CONCEITOS" visível no topo e no fim do histórico global');
        await page.click('.tax-voltar-hg--rodape [data-tax="voltar-dominio"]');
        afirma(await page.locator('#taxHistoricoGlobal').count() === 0 && await page.locator('.tax-item[data-codigo="SQ"]').isVisible(), '375 px: o VOLTAR do rodapé leva de volta à lista de conceitos');
        await abaHG(page);
        afirma(await page.locator('#taxHgDetalhes').evaluate((d) => d.open), 'reabrir a aba: a lista continua como estava (aberta)');
      }
      await page.click('.tax-dominio[data-dominio="organizacional"]');
      await aparece(page, '.tax-wrap');
      afirma(await page.locator('#taxHistoricoGlobal').count() === 0 && await page.locator('.tax-item[data-codigo="SQ"]').count() === 1, 'voltar para um domínio restaura a lista de conceitos');
      afirma(erros.length === 0, 'sem erros de JavaScript');
      await ctx.close();
    }

    console.log('\n== H2. Estados: carregando ≠ vazio ≠ erro ≠ sem acesso ==');
    {
      const { ctx, page } = await abrirHG(browser, viewport, 30, true);
      await page.evaluate(() => { window.__CFG.delays = { 'taxonomia/organizacional/auditoria/_catalogo': 700 }; });
      await abaHG(page);
      afirma(await aparece(page, '#taxHgCarregando', 1000) && await page.locator('#taxHgVazio').count() === 0, 'enquanto lê: "Carregando…", nunca "vazio"');
      await page.waitForSelector('#taxHgCarregando', { state: 'detached', timeout: 4000 }).catch(() => {});
      afirma(await linhasHG(page).count() === 28 && await page.locator('#taxHgCarregando').count() === 0, 'ao chegar tudo, mostra os 28 eventos e o "Carregando…" some');
      await ctx.close();
    }
    {
      const { ctx, page } = await abrirHG(browser, viewport, 0, false);
      await abaHG(page);
      await aparece(page, '#taxHgVazio', 3000);
      afirma(/Nenhum evento global registrado/.test(await page.locator('#taxHgVazio').innerText()) && await page.locator('.tax-hg-erro').count() === 0, 'sem eventos: vazio de verdade ("Nenhum evento global registrado")');
      await ctx.close();
    }
    {
      const { ctx, page } = await abrirHG(browser, viewport, 30, true);
      await page.evaluate(() => { window.__CFG.delays = { 'taxonomia/arquitetural/auditoria/_catalogo': 600000 }; });
      await abaHG(page);
      await aparece(page, '.tax-hg-erro[data-dominio="arquitetural"]', 4000);
      afirma(await linhasHG(page).count() === 25 && await page.locator('#taxHgVazio').count() === 0, 'um domínio não respondeu: mostra os eventos do outro, sem fingir que o Arquitetural está vazio');
      afirma(/Arquitetural/.test(await page.locator('.tax-hg-erro[data-dominio="arquitetural"]').innerText()) && /TENTAR NOVAMENTE/i.test(await page.locator('.tax-hg-erro[data-dominio="arquitetural"]').innerText()), 'aviso do domínio que falhou, com "TENTAR NOVAMENTE"');
      await page.evaluate(() => { window.__CFG.delays = {}; });
      await page.click('[data-tax="hg-recarregar"]');
      await page.waitForFunction(() => document.querySelectorAll('#taxHistoricoGlobal .tax-hg-item').length === 28, null, { timeout: 5000 }).catch(() => {});
      afirma(await linhasHG(page).count() === 28 && await page.locator('.tax-hg-erro').count() === 0, '"TENTAR NOVAMENTE" lê de novo: os 28 eventos aparecem e o aviso some');
      await ctx.close();
    }
    {
      const { ctx, page, erros } = await abrirHG(browser, viewport, 30, true);
      await page.evaluate(() => { window.__CFG.fail = ['taxonomia/organizacional/auditoria/_catalogo']; });
      await abaHG(page);
      await aparece(page, '.tax-hg-erro[data-dominio="organizacional"]', 4000);
      afirma(/sem acesso/i.test(await page.locator('.tax-hg-erro[data-dominio="organizacional"]').innerText()), 'PERMISSION_DENIED num domínio: diz "sem acesso" (≠ erro de rede)');
      await page.waitForTimeout(300);
      afirma(erros.length === 0, 'PERMISSION_DENIED não gera erro nem rejeição não tratada na página');
      await ctx.close();
    }

    console.log('\n== H2b. Carga gravada com a contagem por domínio (formato atual) ==');
    {
      const r = await abrir(browser, { viewport, db: (() => { const d = semenHG(0, false);
        d.taxonomia.organizacional.auditoria._catalogo[chaveEv(0)] = { tipo: 'carga_inicial', campo: 'carga inicial', valorNovo: 'Carga inicial — Organizacional: 5 conceitos, 7 textos-fonte (1 com definição vigente)', dominio: 'organizacional', resumoDominio: { conceitos: 5, fontes: 7, vigentes: 1, atributos: 4, perfis: 3, relacoes: 2 }, dataHora: '2026-10-03T10:00:00.000Z', usuario: { nome: 'Admin Fictício', email: EMAIL } };
        d.taxonomia.arquitetural.auditoria._catalogo[chaveEv(0)] = { tipo: 'carga_inicial', campo: 'carga inicial', valorNovo: 'Carga inicial — Arquitetural: 2 conceitos, 0 textos-fonte (0 com definição vigente)', dominio: 'arquitetural', resumoDominio: { conceitos: 2, fontes: 0, vigentes: 0, atributos: 0, perfis: 0, relacoes: 0 }, dataHora: '2026-10-03T10:00:00.001Z', usuario: { nome: 'Admin Fictício', email: EMAIL } };
        return d; })() });
      await irParaTaxonomia(r.page);
      await abaHG(r.page);
      await esperarCondicao(r.page, () => document.querySelectorAll('#taxHistoricoGlobal .tax-hg-item').length === 2, null, { limite: 4000, descricao: 'duas linhas de carga' });
      const ts = await linhasHG(r.page).allInnerTexts();
      const tOrg = ts.find((x) => /Organizacional/.test(x)) || '', tArq = ts.find((x) => /Arquitetural/.test(x)) || '';
      afirma(/Carga inicial — Organizacional/.test(tOrg) && /5 conceitos, 7 textos-fonte \(1 com definição vigente\), 4 atributos, 3 valores de perfil, 2 relações/.test(tOrg), 'Organizacional: título por domínio e a contagem registrada do próprio domínio', tOrg.replace(/\s+/g, ' '));
      afirma(/Carga inicial — Arquitetural/.test(tArq) && /2 conceitos, 0 textos-fonte \(0 com definição vigente\)/.test(tArq) && !/atributos/.test(tArq), 'Arquitetural: só a contagem do Arquitetural', tArq.replace(/\s+/g, ' '));
      afirma(!/Hoje o domínio tem|não registrada/.test(ts.join(' ')), 'formato atual: nada de contagem "de hoje" nem aviso de registro antigo');
      afirma(await larguraOk(r.page), 'sem rolagem horizontal');
      await r.ctx.close();
    }

    console.log('\n== H3. Modo somente leitura: sem histórico global (auditoria é só de admin) ==');
    {
      const { ctx, page } = await abrirHG(browser, viewport, 3, true);
      await page.evaluate(() => window.faTaxonomia.abrir({ somenteLeitura: true }));
      await aparece(page, '.tax-dominios');
      afirma(await page.locator('[data-tax="aba-historico"]').count() === 0 && await page.locator('.tax-dominios [role="tab"]').count() === 2, 'somente leitura: a aba "Histórico global" não aparece');
      await ctx.close();
    }
  }

  /* ---------- TEXTOS-FONTE: arquivamento lógico (nenhuma fonte é apagada) ---------- */
  const TX = 'Texto fictício repetido.';
  const semeArq = () => { const d = semente(); const F = d.taxonomia.organizacional.fontes.SQ;
    F.f2.texto = TX; F.f3 = { texto: TX, contexto: 'PREVI', situacao: 'em validação', tipoRedacao: 'proposta', rotulo: 'Proposta', criadoEm: '2026-10-03T10:00:02.000Z', criadoPor: EMAIL };
    F.f4 = { texto: 'Texto fictício de placeholder.', contexto: 'indefinido', situacao: 'placeholder', tipoRedacao: 'Significado v2', criadoEm: '2026-10-03T10:00:03.000Z', criadoPor: EMAIL };
    F.f5 = { texto: 'Texto fictício não localizado.', contexto: 'indefinido', situacao: 'não localizado', tipoRedacao: 'Significado v2', criadoEm: '2026-10-03T10:00:04.000Z', criadoPor: EMAIL };
    F.f6 = { texto: 'Texto fictício já arquivado.', contexto: 'BB', situacao: 'histórica/contextual', tipoRedacao: 'Significado v1', rotulo: 'Versão velha', criadoEm: '2026-10-03T10:00:05.000Z', criadoPor: EMAIL,
      arquivada: true, arquivamento: { motivo: 'duplicidade', em: '2026-10-03T11:00:00.000Z', por: EMAIL } };
    return d; };
  let t;
  const fonteDb = async (page, id) => ((await banco2(page)).fontes.SQ || {})[id];
  const audTipos = async (page, tipo) => Object.values(((await banco2(page)).auditoria || {}).SQ || {}).filter((a) => a.tipo === tipo);
  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    console.log('\n######## Textos-fonte e arquivamento lógico — ' + nomeTela + ' ########');

    console.log('\n== I1. Estrutura: vigente / disponíveis / arquivadas, contadores ==');
    {
      const { ctx, page, erros } = await abrirSq(browser, viewport, { db: semeArq() });
      afirma(/^4 fontes disponíveis · 1 fonte arquivada$/.test((await page.locator('#taxResumoFontes').innerText()).trim()), 'contadores simples: "4 fontes disponíveis · 1 fonte arquivada"');
      afirma(await page.locator('#taxVigenteBloco').count() === 1 && await page.locator('#taxFontesDisponiveis').count() === 1 && await page.locator('#taxFontesArquivadas').count() === 1, 'os TRÊS blocos existem, separados');
      afirma(await page.locator('#taxFontesDisponiveis article').count() === 4 && await page.locator('#taxFontesDisponiveis article[data-fonte="f6"]').count() === 0, 'a arquivada NÃO aparece entre as disponíveis');
      afirma(await page.locator('#taxFontesArquivadas article').count() === 0 && /Fontes arquivadas \(1\)/.test(await page.locator('#taxFontesArquivadas h5').textContent()), 'arquivadas: recolhidas por padrão (só o título com a contagem)');
      afirma(await page.locator('#taxFontesDisponiveis .tax-identico--resumo').count() === 2 && await page.locator('article[data-fonte="f4"] .tax-identico').count() === 0, 'sinal de texto idêntico em f2 e f3, e só neles');
      afirma((await page.locator('article[data-fonte="f4"] .tax-acoes--fonte .btn').allTextContents()).join('|') === 'Ver|Arquivar' && (await page.locator('article[data-fonte="f5"] .tax-acoes--fonte .btn').allTextContents()).join('|') === 'Ver|Arquivar', 'placeholder e "não localizado": podem ser arquivados, NÃO têm "Usar como vigente"');
      afirma(await page.locator('#taxFontesDisponiveis').evaluate((el) => !/Texto fictício de placeholder\./.test(el.innerText)), 'cartões recolhidos não mostram o texto integral');
      await page.click('[data-tax="alternar-arquivadas"]');
      afirma(await page.locator('#taxFontesArquivadas article').count() === 1, 'abrir "Fontes arquivadas" mostra a lista');
      t = await page.locator('article[data-fonte="f6"]').innerText();
      afirma(/Versão velha/.test(t) && /duplicidade/.test(t) && /adm@previ\.com\.br/.test(t) && /ARQUIVADA/i.test(t), 'arquivada mostra rótulo, motivo, quem e selo "Arquivada"');
      afirma((await page.locator('article[data-fonte="f6"] .tax-acoes--fonte .btn').allTextContents()).join('|') === 'Ver|Restaurar' && await page.locator('article[data-fonte="f6"] [data-tax="tornar-vigente"], article[data-fonte="f6"] [data-tax="editar-fonte"]').count() === 0, 'arquivada: só Ver e Restaurar — nunca "Usar como vigente" nem "Editar"');
      await page.click('article[data-fonte="f6"] [data-tax="ver"]');
      afirma(/Texto fictício já arquivado\./.test(await page.locator('article[data-fonte="f6"]').innerText()) && await page.locator('article[data-fonte="f6"] [data-tax="editar-fonte"]').count() === 0, 'arquivada é consultável (Ver) mas continua sem Editar');
      const bb = await Promise.all(['#taxVigenteBloco', '#taxFontesDisponiveis', '#taxFontesArquivadas'].map((q) => page.locator(q).boundingBox()));
      afirma(bb[0].y + bb[0].height <= bb[1].y + 1 && bb[1].y + bb[1].height <= bb[2].y + 1, 'visualmente separados, na ordem vigente → disponíveis → arquivadas');
      afirma(await larguraOk(page), 'sem rolagem horizontal');
      afirma(erros.length === 0, 'sem erros de JavaScript');
      await ctx.close();
    }

    console.log('\n== I2. "Alterar definição" só leva até as fontes disponíveis (sem escolher nada) ==');
    {
      const { ctx, page } = await abrirSq(browser, viewport, { db: semeArq() });
      const antes = JSON.stringify((await banco(page)).taxonomia);
      afirma(await page.locator('#taxDicaAlterar').count() === 0, 'a dica só aparece depois do clique');
      await page.click('[data-tax="alterar-definicao"]');
      await aparece(page, '#taxDicaAlterar');
      t = await page.locator('#taxDicaAlterar').innerText();
      afirma(/Nenhuma delas é recomendada/.test(t), 'dica neutra: nenhuma fonte é recomendada');
      afirma(await page.evaluate(() => document.activeElement && document.activeElement.id === 'taxFontesDisponiveis'), 'o foco vai para "Fontes disponíveis"');
      afirma(await page.locator('.tax-confirma').count() === 0 && await page.locator('.tax-fonte--aberta').count() === 0, 'nada foi aberto nem pré-selecionado');
      afirma(JSON.stringify((await banco(page)).taxonomia) === antes, 'nada foi gravado');
      await ctx.close();
    }

    console.log('\n== I3. "Usar como vigente": confirmação completa; cancelar não grava ==');
    {
      const { ctx, page } = await abrirSq(browser, viewport, { db: semeArq() });
      await page.click('article[data-fonte="f3"] [data-tax="tornar-vigente"]');
      t = await page.locator('.tax-confirma').innerText();
      afirma(/Esta ação altera a definição oficial deste conceito\./.test(t) && /Texto fictício repetido\./.test(t) && /em validação/.test(t) && /proposta/.test(t) && /Conceito Fictício Sq/.test(t), 'confirmação com conceito, fonte, tipo, situação, texto integral e o aviso');
      afirma(await page.locator('.tax-confirma .btn--primary').count() === 1 && await page.locator('#taxSecFontes .btn--primary').count() === 1, 'único botão dourado: "Tornar esta fonte vigente"');
      afirma(await larguraOk(page), 'confirmação aberta: sem rolagem horizontal');
      await page.click('[data-tax="cancelar-confirmacao"]');
      afirma((await banco2(page)).conceitos.SQ.definicaoVigenteFonteId === 'f1' && (await audTipos(page, 'definicao_vigente')).length === 0, 'cancelar não grava nada');
      await ctx.close();
    }

    console.log('\n== I4. Arquivar: motivo obrigatório, "outro" exige justificativa, vigente nunca ==');
    {
      const { ctx, page } = await abrirSq(browser, viewport, { db: semeArq() });
      await page.click('article[data-fonte="f2"] [data-tax="arquivar"]');
      afirma(await page.locator('#taxFormArquivar').count() === 1 && await page.locator('#taxA_motivo option').count() === 7, 'abre o formulário com os 6 motivos da lista fechada');
      await page.click('[data-tax="confirmar-arquivar"]');
      afirma(/Escolha o motivo/.test(await page.locator('#taxFormArquivar').innerText()) && !(await fonteDb(page, 'f2')).arquivada, 'sem motivo: recusa e não grava');
      await page.selectOption('#taxA_motivo', 'outro');
      await page.click('[data-tax="confirmar-arquivar"]');
      afirma(/obrigatória quando o motivo é "outro"/.test(await page.locator('#taxFormArquivar').innerText()) && !(await fonteDb(page, 'f2')).arquivada, '"outro" sem justificativa: recusa e não grava');
      await page.fill('#taxA_justificativa', 'Explicação fictícia.');
      await page.click('[data-tax="confirmar-arquivar"]');
      await esperaDb(page, () => window.__CFG.__dbReal.taxonomia.organizacional.fontes.SQ.f2.arquivada === true);
      const f2 = await fonteDb(page, 'f2');
      afirma(f2.arquivada === true && f2.arquivamento.motivo === 'outro' && f2.arquivamento.justificativa === 'Explicação fictícia.' && f2.arquivamento.por === EMAIL && !!f2.arquivamento.em && f2.situacao === 'histórica/contextual' && f2.texto === TX, 'arquivada com motivo, justificativa, data e quem; texto e situação intactos');
      const ev = await audTipos(page, 'fonte_arquivada');
      afirma(ev.length === 1 && ev[0].fonteId === 'f2' && ev[0].motivo === 'outro' && ev[0].usuario.email === EMAIL, 'auditoria própria `fonte_arquivada` (fonte, motivo, quem)');
      await aparece(page, '#taxFlash:not(.tax-flash--erro)');
      afirma(/^3 fontes disponíveis · 2 fontes arquivadas$/.test((await page.locator('#taxResumoFontes').innerText()).trim()) && await page.locator('#taxFontesDisponiveis article[data-fonte="f2"]').count() === 0, 'sai das disponíveis; contadores: "3 fontes disponíveis · 2 fontes arquivadas"');
      afirma(await page.locator('article[data-fonte="f1"] [data-tax="arquivar"]').count() === 0, 'a vigente não tem "Arquivar"');
      afirma(await page.locator('[data-tax="arquivar"]').count() === 3, 'as demais disponíveis continuam arquivável');
      /* um motivo da lista (sem justificativa) também basta; e cancelar não grava */
      await page.click('article[data-fonte="f4"] [data-tax="arquivar"]');
      await page.selectOption('#taxA_motivo', 'criada por engano');
      await page.click('[data-tax="cancelar-arquivar"]');
      afirma(!(await fonteDb(page, 'f4')).arquivada, 'cancelar o arquivamento não grava');
      await page.click('article[data-fonte="f4"] [data-tax="arquivar"]');
      await page.selectOption('#taxA_motivo', 'criada por engano');
      await page.click('[data-tax="confirmar-arquivar"]');
      await esperaDb(page, () => window.__CFG.__dbReal.taxonomia.organizacional.fontes.SQ.f4.arquivada === true);
      afirma(!('justificativa' in (await fonteDb(page, 'f4')).arquivamento), 'placeholder arquivado com motivo da lista, sem justificativa');
      afirma(await larguraOk(page), 'sem rolagem horizontal');
      await ctx.close();
    }

    console.log('\n== I5. Restaurar: volta como estava, auditado ==');
    {
      const { ctx, page } = await abrirSq(browser, viewport, { db: semeArq() });
      await page.click('[data-tax="alternar-arquivadas"]');
      await page.click('article[data-fonte="f6"] [data-tax="restaurar"]');
      await esperaDb(page, () => !window.__CFG.__dbReal.taxonomia.organizacional.fontes.SQ.f6.arquivada);
      const f6 = await fonteDb(page, 'f6');
      afirma(!('arquivada' in f6) && !('arquivamento' in f6) && f6.texto === 'Texto fictício já arquivado.' && f6.situacao === 'histórica/contextual', 'restaurada: sem marca de arquivamento, mesmo texto e situação');
      afirma((await audTipos(page, 'fonte_restaurada')).length === 1, 'auditoria própria `fonte_restaurada`');
      await aparece(page, '#taxFlash:not(.tax-flash--erro)');
      afirma(await page.locator('#taxFontesDisponiveis article[data-fonte="f6"]').count() === 1 && await page.locator('#taxFontesArquivadas').count() === 0 && /^5 fontes disponíveis$/.test((await page.locator('#taxResumoFontes').innerText()).trim()), 'volta para as disponíveis; sem arquivadas a seção some; contador "5 fontes disponíveis"');
      afirma(await page.locator('article[data-fonte="f6"] [data-tax="tornar-vigente"]').count() === 1, 'depois de restaurada volta a poder ser usada como vigente');
      await ctx.close();
    }

    console.log('\n== I6. Somente leitura: consulta sem ações de edição ==');
    {
      const { ctx, page } = await abrirSq(browser, viewport, { db: semeArq() });
      await page.evaluate(() => window.faTaxonomia.abrir({ somenteLeitura: true }));
      /* abrir({somenteLeitura}) mantém aberto o detalhe que já estava (SQ). Antes o teste clicava no
         SQ da lista — escondida no celular —, o clique falhava calado em 30 s e a checagem abaixo
         ("sem ações de edição") podia passar por vazio. Agora ela só vale com o detalhe do SQ na
         tela, em modo leitura, com cartões de fonte. */
      const nomeSq = (await banco(page)).taxonomia.organizacional.conceitos.SQ.nome;
      await esperarCondicao(page, (nome) => { const t = document.querySelector('.tax-detalhe .tax-titulo'); return !!t && t.textContent.trim() === nome && !!document.querySelector('#taxSecFontes article.tax-fonte') && !document.querySelector('#taxSecFontes .loading-msg'); }, nomeSq, { limite: 6000, descricao: 'detalhe do SQ em leitura, com cartões de fonte' });
      afirma(await page.locator('#taxSecFontes article.tax-fonte').count() > 0, 'somente leitura: o detalhe do SQ está na tela, com cartões de fonte');
      await page.click('[data-tax="alternar-arquivadas"]');
      afirma(await page.locator('.tax-detalhe [data-tax="arquivar"], .tax-detalhe [data-tax="restaurar"], .tax-detalhe [data-tax="tornar-vigente"], .tax-detalhe [data-tax="alterar-definicao"], .tax-detalhe [data-tax="remover-vigencia"], .tax-detalhe [data-tax="nova-versao"]').count() === 0 && await page.locator('#taxSecFontes [data-tax="ver"]').count() > 0, 'sem botões de edição; "Ver" continua disponível');
      await ctx.close();
    }
  }

  await browser.close();
  console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
