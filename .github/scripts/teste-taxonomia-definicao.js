/* TAXONOMIA — modelo simplificado da definição, na tela (ADMIN › Taxonomia), nos DOIS domínios. Firebase falso em
 * persistência real; hermético; conteúdo 100% fictício. Desktop e 375 px. Prova:
 *   0. Catálogo: "O que é?" mostra a definição oficial vigente uma vez, sem "Última atualização" nem ações; a
 *      administração fica em "Administrar conceito".
 *   1. Administração › Conteúdo: UMA definição oficial vigente, a última atualização e UMA ação principal ("Atualizar
 *      definição"); nada de fontes, rótulos, tipos de redação, identificadores técnicos, "usar como vigente",
 *      "remover vigência", "editar rótulo", "outras fontes" ou "fontes arquivadas".
 *   2. Lista: o nome em destaque, sem a etiqueta repetida "Definição registrada"; "sem definição" só quando falta.
 *   3. "Atualizar definição": começa com o texto vigente; conferir mostra atual × proposta (e o motivo); publicar
 *      grava versão + 1, a entrada do histórico (com motivo) e a auditoria numa gravação; a tela volta à definição
 *      nova com a confirmação. Texto igual ou vazio não avança. Clique repetido em publicar não publica duas vezes.
 *   4. UM histórico (Administração › Histórico e governança), recolhido, com a contagem real ("Histórico — N alterações"); aberto: a versão nova com
 *      anterior → novo, responsável e motivo; a versão 1 migrada aparece como "Registro inicial da definição" (não é
 *      alteração); as trocas do modelo antigo ficam em "Detalhes técnicos anteriores à simplificação", com os textos do
 *      arquivo da migração — fontes que nunca foram vigentes não aparecem como versões.
 *   5. Conceito sem definição: o Catálogo diz que não há; "Registrar definição" publica a versão 1.
 *   6. "Editar informações" (nome, critérios…) fica em "Pergunta, critérios e observações", depois da definição e
 *      separado dela; a ligação com a Avaliação (arquitetural) continua indicada.
 *   7. As duas abas do ADMIN (Avaliações e Mapa, Taxonomia) continuam lá. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const T = require('./taxonomia-tela');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const EMAIL = 'adm@previ.com.br';
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
let falhas = 0, total = 0;
function afirma(c, msg, det) { total++; console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + (typeof det === 'string' ? det : JSON.stringify(det)) : '')); if (!c) falhas++; }

const T0 = '2026-09-01T10:00:00.000Z', T1 = '2026-10-01T10:00:00.000Z';
const def = (texto, versao, em, por) => ({ texto, versao, publicadaEm: em, publicadaPor: por || 'curadoria@previ.com.br' });
function semente() {
  const users = { [chave(EMAIL)]: { name: 'ADMIN', email: EMAIL, area: 'INFOR' } };
  return {
    'fa-users': users, 'fa-admins': { [chave(EMAIL)]: { email: EMAIL } }, 'fa-diretores': {}, 'fa-facilitadores': {}, eventos: {}, turmas: {}, 'turmas-interesse': {}, 'turmas-config': {},
    'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {}, 'avaliacoes-produto': {}, 'avaliacoes-squad': {}, 'motor-squad-config': {}, 'motor-squad-auditoria': {}, 'motor-arquitetura-auditoria': {},
    'avaliacao-classificacoes': { 'produto-principal': { registradoEm: T0, registradoPor: EMAIL, auditoriaId: 'l1' } },
    taxonomia: {
      meta: { cargaInicial: { feitaEm: T0, feitaPor: EMAIL }, indiceFilhos: { criadoEm: T0, criadoPor: EMAIL }, migracaoDefinicoes: { feitaEm: T0, feitaPor: 'migracao@conta-de-servico' } },
      arquitetural: {
        conceitos: { 'produto-principal': { nome: 'Produto principal (fictício)', ordem: 1, ativo: true, definicao: def('Definição arquitetural fictícia, versão 1.', 1, T0) } },
        definicoes: { 'produto-principal': { v1: Object.assign(def('Definição arquitetural fictícia, versão 1.', 1, T0), { origem: 'migracao', legado: { fonteId: 'fA' } }) } },
        auditoria: {}
      },
      organizacional: {
        conceitos: {
          PHN: { nome: 'Linhas de Plataforma Habilitadora de Negócios (fictício)', ordem: 1, ativo: true, camada: 'A', definicao: def('Texto organizacional fictício, versão 2.', 2, T1, 'outra@previ.com.br') },
          SEMDEF: { nome: 'Conceito ainda sem definição (fictício)', ordem: 2, ativo: true, camada: 'A' }
        },
        definicoes: { PHN: {
          v1: Object.assign(def('Texto organizacional fictício, versão 1.', 1, T0), { origem: 'migracao' }),
          v2: Object.assign(def('Texto organizacional fictício, versão 2.', 2, T1, 'outra@previ.com.br'), { origem: 'publicacao', motivo: 'Ajuste fictício de redação' })
        } },
        /* uma troca do modelo antigo (antes da migração): textos no arquivo; a fonte "fX" nunca foi vigente */
        auditoria: { PHN: { e1: { tipo: 'definicao_vigente', conceito: 'PHN', campo: 'definição vigente', valorAnterior: 'Conceito (PREVI)', valorNovo: 'Significado v1 (PREVI)', fonteAnteriorId: 'f0', fonteNovaId: 'f1', usuario: { email: 'antiga@previ.com.br' }, dataHora: '2026-08-01T10:00:00.000Z' } } },
        atributos: {}, perfis: {}, relacoes: {}, filhos: {}
      }
    },
    'taxonomia-arquivo-migracao': { organizacional: { fontes: { PHN: {
      f0: { texto: 'Texto antigo fictício anterior.', situacao: 'histórica/contextual', contexto: 'PREVI', tipoRedacao: 'Conceito' },
      f1: { texto: 'Texto organizacional fictício, versão 1.', situacao: 'vigente', contexto: 'PREVI', tipoRedacao: 'Significado v1' },
      fX: { texto: 'Proposta fictícia que nunca foi vigente.', situacao: 'em validação', contexto: 'PREVI', tipoRedacao: 'proposta' }
    } } } }
  };
}
async function abrir(browser, viewport) {
  const cfg = { db: semente(), user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true };
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  await page.waitForSelector('.admin-tab-btn[data-panel="adminPanelTaxonomia"]', { state: 'visible' });
  afirma((await page.locator('.admin-tab-btn[data-panel="adminPanelArquitetura"]').textContent()).trim() === 'Avaliações e Mapa', '7. aba "Avaliações e Mapa" ao lado da Taxonomia');
  await page.click('.admin-tab-btn[data-panel="adminPanelTaxonomia"]');
  await page.waitForSelector('#taxPergunta');
  return { ctx, page, erros };
}
const banco = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal)));
const texto = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.innerText : ''; }, sel);
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const esperar = (page, fn, arg) => esperarCondicao(page, fn, arg, { limite: 10000 });
async function dominio(page, d) { await T.dominio(page, d); await page.waitForSelector('.tax-item'); }
/* administração do conceito (aba Conteúdo): é onde a definição se atualiza */
async function abrirConceito(page, cod) {
  await T.abrirAdmin(page, cod);
  await esperar(page, () => !!document.querySelector('#taxAdmin #taxSecDefinicao') && !document.querySelector('#taxAdmin .loading-msg'));
}
const PROIBIDOS = ['Fonte (id)', 'Tipo de redação', 'Rótulo da fonte', 'Outras fontes', 'Fontes arquivadas', 'Fontes disponíveis', 'Usar como vigente', 'Remover vigência', 'Editar rótulo', 'Adicionar texto-fonte', 'Nova versão da definição', 'Alterar definição', 'Definição registrada'];
async function semComplexidade(page, rot) {
  const t = await texto(page, '#adminTaxonomia');
  const achados = PROIBIDOS.filter((p) => t.indexOf(p) !== -1);
  const botoes = await page.locator('[data-tax="nova-versao"], [data-tax="tornar-vigente"], [data-tax="editar-rotulo"], [data-tax="remover-vigencia"], [data-tax="alterar-definicao"], [data-tax="nova-fonte"], [data-tax="arquivar"], [data-tax="editar-fonte"]').count();
  afirma(!achados.length && botoes === 0, rot + ': nenhum controle ou termo do modelo de fontes na tela', achados);
}
async function publicar(page, novo, motivo) {
  await page.click('#taxAtualizarDefinicaoBtn');
  await page.waitForSelector('#taxDefNovo');
  await page.fill('#taxDefNovo', novo);
  if (motivo) await page.fill('#taxDefMotivo', motivo);
  await page.click('#taxDefConferirBtn');
  await page.waitForSelector('#taxConferirDefinicao');
}

async function rodada(browser, viewport, rotulo) {
  console.log('\n== ' + rotulo + ' ==');
  const { ctx, page, erros } = await abrir(browser, viewport);

  /* ---- ORGANIZACIONAL ---- */
  await dominio(page, 'organizacional');
  const itens = await page.evaluate(() => Array.from(document.querySelectorAll('.tax-item')).map((x) => x.getAttribute('data-codigo') + '|' + x.innerText.replace(/\s+/g, ' ')));
  afirma(itens.every((i) => i.indexOf('Definição registrada') === -1) && /SEMDEF\|.*sem definição/.test(itens.join('\n')) && !/PHN\|.*sem definição/.test(itens.join('\n')), '2. lista: sem etiqueta repetida; "sem definição" só onde falta', itens);
  await T.abrirConceito(page, 'PHN');
  const ficha = await texto(page, '.tax-ficha');
  afirma((await texto(page, '#taxDefinicaoTexto')).trim() === 'Texto organizacional fictício, versão 2.' && ficha.split('Texto organizacional fictício, versão 2.').length === 2, '0. Catálogo: "O que é?" com a definição vigente, uma vez');
  afirma(!/Última atualização|versão 1|Histórico/.test(ficha) && await page.locator('.tax-ficha [data-tax="atualizar-definicao"]').count() === 0, '0. Catálogo: sem "Última atualização", histórico nem ação de atualizar', ficha);
  await abrirConceito(page, 'PHN');
  afirma((await texto(page, '#taxDefinicaoTexto')).trim() === 'Texto organizacional fictício, versão 2.', '1. organizacional: a definição oficial vigente');
  afirma(/Última atualização: .*outra@previ\.com\.br · versão 2/.test(await texto(page, '#taxDefAtualizacao')), '1. organizacional: data, responsável e versão da última atualização', await texto(page, '#taxDefAtualizacao'));
  afirma(await page.locator('#taxSecDefinicao .btn--primary').count() === 1 && (await page.locator('#taxAtualizarDefinicaoBtn').textContent()).trim() === 'Atualizar definição', '1. organizacional: uma única ação principal, "Atualizar definição"');
  await semComplexidade(page, '1. organizacional');
  afirma(await page.evaluate(() => { const d = document.getElementById('taxSecDefinicao').getBoundingClientRect().top, i = document.getElementById('taxEditarInfoBtn').getBoundingClientRect().top; return i > d; }) && /Editar informações/i.test(await texto(page, '#taxSecPergunta')) && await page.locator('#taxSecDefinicao [data-tax="editar-conceito"]').count() === 0, '6. "Editar informações" em "Pergunta, critérios e observações", depois da definição e fora dela');
  await T.abaAdmin(page, 'historico');
  afirma(!(await page.evaluate(() => document.getElementById('taxHistoricoConceito').open)) && /^Histórico — 1 alteração$/.test((await texto(page, '#taxHistoricoConceito > summary')).trim()) && await page.locator('#taxHistDefinicao').count() === 0, '4. um histórico só, recolhido, com a contagem real (a versão 2; o registro inicial e o modelo antigo não contam)', await texto(page, '#taxHistoricoConceito > summary'));
  await page.click('#taxHistoricoConceito > summary');
  const hist = await texto(page, '#taxHistoricoConceito');
  afirma(/Definição atualizada \(versão 2\)/.test(hist) && /Texto organizacional fictício, versão 1\. → Texto organizacional fictício, versão 2\./.test(hist) && /Motivo: Ajuste fictício de redação/.test(hist) && /outra@previ\.com\.br/.test(hist), '4. versão 2: data, responsável, anterior → novo e motivo', hist);
  afirma(/Registro inicial da definição \(versão 1\)/.test(hist) && /Não é uma alteração/.test(hist), '4. a versão 1 migrada é o registro inicial, não uma edição');
  afirma((hist.match(/Texto organizacional fictício, versão 2\./g) || []).length === 1, '4. a definição vigente não é repetida várias vezes no histórico');
  afirma(!(await page.evaluate(() => document.getElementById('taxHistLegado').open)) && /Detalhes técnicos anteriores à simplificação \(1\)/.test(await texto(page, '#taxHistLegado > summary')), '4. o modelo antigo fica em "Detalhes técnicos anteriores à simplificação", recolhido');
  await page.click('#taxHistLegado > summary');
  const leg = await texto(page, '#taxHistLegado');
  afirma(/Texto que deixou de valer: Texto antigo fictício anterior\./.test(leg) && !/nunca foi vigente/.test(await texto(page, '#taxSecHistorico')), '4. troca do modelo antigo com os textos do arquivo; a proposta que nunca foi vigente não vira versão');
  /* 3. fluxo */
  await T.abaAdmin(page, 'conteudo');
  await page.click('#taxAtualizarDefinicaoBtn');
  await page.waitForSelector('#taxDefNovo');
  afirma((await page.inputValue('#taxDefNovo')) === 'Texto organizacional fictício, versão 2.' && await page.locator('#taxSecDefinicao [data-tax="atualizar-definicao"]').count() === 0, '3. a atualização começa com o texto vigente preenchido');
  await page.click('#taxDefConferirBtn');
  afirma(/igual à definição vigente/.test(await texto(page, '#taxDefErro')), '3. texto igual não avança');
  await page.fill('#taxDefNovo', '   ');
  await page.click('#taxDefConferirBtn');
  afirma(/Escreva o texto/.test(await texto(page, '#taxDefErro')), '3. texto vazio não avança');
  await page.click('#taxDefCancelarBtn');
  afirma(await page.locator('#taxDefNovo').count() === 0 && (await banco(page)).taxonomia.organizacional.conceitos.PHN.definicao.versao === 2, '3. cancelar não grava nada');
  await publicar(page, 'Texto organizacional fictício, versão 3.', 'Motivo fictício da versão 3');
  const conf = await texto(page, '#taxConferirDefinicao');
  afirma(/Definição atual\s*Texto organizacional fictício, versão 2\./.test(conf) && /Nova definição proposta\s*Texto organizacional fictício, versão 3\./.test(conf) && /Motivo fictício da versão 3/.test(conf) && /preservada no histórico/.test(conf), '3. conferir: atual × proposta, motivo e o aviso de preservação');
  afirma(await larguraOk(page), '3. conferência sem rolagem lateral');
  /* clique repetido */
  await page.evaluate(() => { const b = document.getElementById('taxDefPublicarBtn'); b.click(); b.click(); });
  await esperar(page, () => /Nova definição publicada/.test((document.getElementById('taxFlash') || {}).textContent || ''));
  await esperar(page, () => /versão 3\./.test((document.getElementById('taxDefinicaoTexto') || {}).textContent || ''));
  let db = await banco(page);
  const O = db.taxonomia.organizacional;
  afirma(O.conceitos.PHN.definicao.versao === 3 && O.conceitos.PHN.definicao.texto === 'Texto organizacional fictício, versão 3.' && O.conceitos.PHN.definicao.publicadaPor === EMAIL, '3. publicada: versão 3, texto novo, autoria');
  afirma(Object.keys(O.definicoes.PHN).sort().join() === 'v1,v2,v3' && O.definicoes.PHN.v3.motivo === 'Motivo fictício da versão 3' && O.definicoes.PHN.v2.texto === 'Texto organizacional fictício, versão 2.', '3. histórico: v3 com motivo; v1 e v2 intactas (clique repetido não criou v4)');
  afirma(Object.values(O.auditoria.PHN).filter((e) => e.tipo === 'definicao_publicada').length === 1, '3. uma linha de auditoria "definicao_publicada"');
  await T.abaAdmin(page, 'historico');
  await esperar(page, () => /Histórico — 2 alterações/.test((document.querySelector('#taxHistoricoConceito > summary') || {}).textContent || ''));
  afirma(true, '4. depois de publicar: a contagem passa a 2');
  /* 5. sem definição */
  await T.abrirConceito(page, 'SEMDEF');
  afirma((await texto(page, '#taxSemDefinicao')).trim() === 'Não há definição oficial disponível para este conceito.', '5. Catálogo sem definição: diz que não há (nada inventado)');
  await T.administrar(page);
  await esperar(page, () => !!document.querySelector('#taxAdmin #taxSemDefinicao'));
  afirma(/ainda não tem definição oficial vigente/.test(await texto(page, '#taxSemDefinicao')) && (await page.locator('#taxAtualizarDefinicaoBtn').textContent()).trim() === 'Registrar definição', '5. sem definição: "Registrar definição"');
  await publicar(page, 'Primeira definição fictícia.');
  await page.click('#taxDefPublicarBtn');
  await esperar(page, () => /Primeira definição/.test((document.getElementById('taxDefinicaoTexto') || {}).textContent || ''));
  db = await banco(page);
  afirma(db.taxonomia.organizacional.conceitos.SEMDEF.definicao.versao === 1 && db.taxonomia.organizacional.definicoes.SEMDEF.v1.origem === 'publicacao', '5. publicada a versão 1');

  /* ---- ARQUITETURAL ---- */
  await dominio(page, 'arquitetural');
  await abrirConceito(page, 'produto-principal');
  afirma((await texto(page, '#taxDefinicaoTexto')).trim() === 'Definição arquitetural fictícia, versão 1.' && /versão 1/.test(await texto(page, '#taxDefAtualizacao')), '1. arquitetural: a definição oficial vigente e a última atualização');
  afirma(await page.locator('#taxSecDefinicao .btn--primary').count() === 1, '1. arquitetural: uma única ação principal');
  await semComplexidade(page, '1. arquitetural');
  afirma(!!(await page.locator('#taxIdentLigado').count()), '6. arquitetural: a ligação com a Avaliação continua indicada (na administração)');
  await T.abaAdmin(page, 'historico');
  afirma(/^Histórico — 0 alterações$/.test((await texto(page, '#taxHistoricoConceito > summary')).trim()) && await page.locator('#taxHistInicial').count() === 1, '4. arquitetural: só o registro inicial (0 alterações)');
  await T.abaAdmin(page, 'conteudo');
  await publicar(page, 'Definição arquitetural fictícia, versão 2.', 'Motivo arquitetural fictício');
  await page.click('#taxDefPublicarBtn');
  await esperar(page, () => /versão 2\./.test((document.getElementById('taxDefinicaoTexto') || {}).textContent || ''));
  db = await banco(page);
  const A = db.taxonomia.arquitetural;
  afirma(A.conceitos['produto-principal'].definicao.versao === 2 && A.definicoes['produto-principal'].v2.motivo === 'Motivo arquitetural fictício' && A.definicoes['produto-principal'].v1.legado.fonteId === 'fA', '3. arquitetural: versão 2 publicada; a v1 (migração) intacta');
  afirma(!!db['avaliacao-classificacoes']['produto-principal'], '6. a ligação com a Avaliação não foi tocada');
  afirma(await larguraOk(page), 'sem rolagem lateral');
  afirma(!erros.length, 'sem erro de página', erros);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    await rodada(browser, { width: 1280, height: 900 }, 'Computador (1280 px)');
    await rodada(browser, { width: 375, height: 800 }, 'Celular (375 px)');
  } finally { await browser.close(); }
  console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
