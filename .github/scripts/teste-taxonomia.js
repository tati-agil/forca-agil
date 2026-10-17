/* TAXONOMIA (Admin → Taxonomia) — interface, importador, edição, definição oficial e auditoria, no desktop e no
 * celular (375 px), com o Firebase falso em persistência real.
 * CONTEÚDO 100% FICTÍCIO: nenhum texto conceitual real vive neste teste nem no código.
 * Modelo simplificado: cada conceito tem UMA definição oficial vigente (conceitos/<c>/definicao), versionada, com
 * histórico imutável (definicoes/<c>/v<n>) — sem catálogo de fontes, situação, rótulo, tipo de redação ou arquivamento.
 *
 * O que se prova:
 *   1. Estados de leitura distintos: carregando ≠ erro (com "TENTAR NOVAMENTE") ≠ sem acesso ≠ vazio;
 *      "ainda não sei" nunca vira "vazio".
 *   2. Importação única: prévia antes de gravar; arquivo inválido (JSON, duas vigentes, conceito já existente)
 *      não grava NADA; falha do banco não deixa estado parcial; confirmar grava tudo de uma vez — a definição
 *      vigente (campo "definicao" ou, no formato antigo do arquivo, a ÚNICA fonte "vigente") vira a versão 1 com o
 *      histórico v1; textos que não eram a vigente NÃO são importados (contados na prévia); nenhum nó "fontes".
 *   3. Dois domínios separados (Arquitetural / Organizacional), cada um com a sua pergunta orientadora e sem
 *      nenhum vínculo entre eles; árvore A → B → C; Disciplina como conceito auxiliar.
 *   4. Catálogo: a ficha só com nome, localização, "O que é?" (a definição oficial, uma vez; sem ela, diz que não há),
 *      hierarquia e "Administrar conceito" — sem código, perfil, relações, histórico nem ações de edição.
 *      Administração (abas Conteúdo / Perfil / Relações / Histórico e governança): "Última atualização",
 *      "Atualizar definição" e um histórico só ("Histórico — N alterações", recolhido); sem definição →
 *      "Registrar definição". Importação, exportação e histórico global ficam em Verificações do sistema › Dados e histórico.
 *   5. Pergunta discriminadora com a NOTA DE APLICAÇÃO junto; "Alcance de atuação" (nunca "Abrangência").
 *   6. Perfil: ausência é ESTADO (não consta na fonte, ainda não definido…), nunca campo vazio.
 *   7. Edição que de fato SALVA (conceito, perfil, definição), com auditoria na mesma gravação; recusa do banco
 *      mostra o erro, mantém o que foi digitado e não grava nada. Definição nos DOIS domínios: editar → conferir
 *      (anterior × proposta) → publicar = versão N+1 + histórico + auditoria definicao_publicada numa gravação só.
 *      Código do conceito no detalhe; carga inicial com a contagem POR domínio (auditoria, meta e Histórico global,
 *      inclusive a apresentação honesta das linhas antigas, que só tinham o total geral).
 *   8. Gravação sem confirmação do servidor (G1–G5), agora na publicação da definição.
 *  10. Só admin: não admin não vê nem lê; modo somente leitura sem botões de edição (nem "ATUALIZAR DEFINIÇÃO").
 *  11. Desktop: lista e ficha lado a lado. 375 px: lista → ficha → "← Voltar aos conceitos"; sem rolagem
 *      horizontal; sem erro de JS.
 * Hermético: sem rede, sem segredo. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarCondicao, esperarSessaoAssentada } = require('./esperas');
const T = require('./taxonomia-tela');
/* o perfil fica na Administração › Perfil */
async function abrirAtributos(page) {
  if (!(await page.locator('#taxAba_perfil[aria-selected="true"]').count())) await T.abaAdmin(page, 'perfil');
  await esperarCondicao(page, () => !!document.getElementById('taxPerfilContagem') && !document.querySelector('#taxAdmin .loading-msg'), null, { descricao: 'perfil do conceito assentado' });
}
async function gerenciarPerfil(page) {
  await abrirAtributos(page);
  await page.click('#taxGerenciarPerfilBtn');
  await page.waitForSelector('#taxFormPerfilLote', { timeout: 4000 });
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
        componente: { nome: 'Componente', ordem: 1, definicao: 'Definição fictícia de componente.' },
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
  await page.evaluate(() => { location.hash = '#arquitetura?arq=taxonomia'; }); /* a Taxonomia é área da Gestão da Floresta */
  await page.waitForSelector('#taxPergunta', { timeout: 8000 });
}
const banco = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal)));
const raizTexto = (page) => page.locator('#adminTaxonomia').innerText();
const aparece = (page, sel, ms) => page.waitForSelector(sel, { timeout: ms || 4000 }).then(() => true).catch(() => false);
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
async function esperaDb(page, fn, arg) { await page.waitForFunction(fn, arg, { timeout: 6000 }).catch(() => {}); }
const carga = (arq) => ({ name: 'carga.json', mimeType: 'application/json', buffer: Buffer.from(typeof arq === 'string' ? arq : JSON.stringify(arq)) });
async function importar(page, arq) {
  await T.irIntegridade(page);
  await page.setInputFiles('#taxArquivo', carga(arq));
  await page.waitForFunction(() => document.querySelector('#taxPrevia') || document.querySelector('#taxImportErros'), { timeout: 8000 }).catch(() => {});
}
/* abre o conceito na ADMINISTRAÇÃO (aba Conteúdo): é onde se edita e se publica */
async function abrirConceito(page, codigo) {
  await T.abrirAdmin(page, codigo);
  await esperarCondicao(page, () => !!document.querySelector('#taxAdmin #taxSecDefinicao') && !document.querySelector('#taxAdmin .loading-msg'), null, { limite: 6000, descricao: 'administração do conceito carregada' });
}
const TOTAL = 'taxonomia';
async function publicarPelaTela(page, texto, motivo) {
  await page.click('#taxAtualizarDefinicaoBtn');
  await page.fill('#taxDefNovo', texto);
  if (motivo) await page.fill('#taxDefMotivo', motivo);
  await page.click('#taxDefConferirBtn');
  await page.waitForSelector('#taxConferirDefinicao', { timeout: 4000 });
  await page.click('#taxDefPublicarBtn');
}
/* histórico do conceito (Administração › Histórico e governança): recolhido por padrão — abre só se estiver fechado */
async function abrirHistorico(page) {
  if (!(await page.locator('#taxAba_historico[aria-selected="true"]').count())) await T.abaAdmin(page, 'historico');
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
    afirma(await page.locator('#taxImportador').count() === 0 && await page.locator('#taxVazioCarga [data-tax="integridade"]').count() === 1, 'o Catálogo não tem importador: aponta para "Integridade e configurações"');
    afirma(!/A Taxonomia define os conceitos/i.test(t) && (await page.locator('#taxTituloArea').innerText()).trim() === 'Taxonomia', 'cabeçalho compacto ("Taxonomia"), sem texto explicativo fixo');
    await page.click('#taxVazioCarga [data-tax="integridade"]');
    await page.waitForSelector('#taxIntegridade', { timeout: 6000 });
    afirma(await page.locator('#taxIntegridade #taxImportador').count() === 1, 'o importador aparece em Verificações do sistema › Dados e histórico (só admin, só antes da carga)');
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
    await page.evaluate(() => { window.__CFG.__dbReal.taxonomia = { organizacional: { conceitos: { ALFA: { nome: 'Já existia', ordem: 1, ativo: true, camada: 'A' } } } }; });
    await importar(page, arqExistente);
    afirma(/já existe — a importação nunca sobrescreve/.test(await page.locator('#taxImportErros').innerText()), 'conceito já existente → recusado, nunca sobrescreve');
    afirma((await banco(page)).taxonomia.organizacional.conceitos.ALFA.nome === 'Já existia', 'o conceito existente ficou intacto');
    await page.evaluate(() => { delete window.__CFG.__dbReal.taxonomia; });

    console.log('\n== 2b. Importação: falha do banco não deixa estado parcial ==');
    await importar(page, ARQUIVO());
    afirma(await page.locator('#taxPrevia').count() === 1, 'arquivo válido → prévia antes de gravar');
    t = await page.locator('#taxPrevia').innerText();
    afirma(/7 conceitos \(2 com definição vigente\)/.test(t) && /4 atributos/.test(t) && /3 valores de perfil/.test(t) && /2 relações/.test(t), 'prévia: 7 conceitos (5 org + 2 arq), 2 com definição vigente (uma de cada formato), 4 atributos, 2 relações', t.replace(/\s+/g, ' '));
    afirma(/6 textos que não eram a definição vigente não serão importados/.test(await page.locator('#taxPreviaNaoImportados').innerText()), 'prévia: os 6 textos que não eram a vigente são CONTADOS e não serão importados (nunca viram versão)');
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
    afirma(alfa.definicao && alfa.definicao.texto === 'Texto fictício VIGENTE de Alfa.' && alfa.definicao.versao === 1 && alfa.definicao.publicadaPor === EMAIL && !!alfa.definicao.publicadaEm, 'formato antigo do arquivo: a única fonte vigente de Alfa virou a definição, versão 1, com autor e data');
    const hA = (b.organizacional.definicoes || {}).ALFA || {};
    afirma(Object.keys(hA).join(',') === 'v1' && hA.v1.texto === alfa.definicao.texto && hA.v1.origem === 'carga-inicial' && hA.v1.versao === 1, 'histórico de Alfa: só a v1 (carga inicial) — as fontes históricas NÃO viraram versões');
    afirma(!b.organizacional.fontes && !b.arquitetural.fontes, 'nenhum nó "fontes" é gravado (nos dois domínios)');
    afirma(['BETA', 'GAMA', 'DELTA', 'DISC'].every((k) => !b.organizacional.conceitos[k].definicao && !((b.organizacional.definicoes || {})[k])), 'Beta (só textos históricos/placeholder), Gama (proposta) e os sem texto: SEM definição — nada é presumido');
    afirma(Object.values(b.organizacional.conceitos).concat(Object.values(b.arquitetural.conceitos)).every((c) => !('situacaoDefinicao' in c) && !('definicaoVigenteFonteId' in c)), 'nenhum campo antigo (situação da definição, ponteiro de fonte)');
    const comp = b.arquitetural.conceitos.componente;
    afirma(comp.definicao && comp.definicao.texto === 'Definição fictícia de componente.' && comp.definicao.versao === 1 && b.arquitetural.definicoes.componente.v1.origem === 'carga-inicial' && !b.arquitetural.conceitos['capacidade-organizacional'].definicao, 'formato novo ("definicao"), no Arquitetural: versão 1 + histórico; o conceito sem texto fica sem definição');
    const audCat = Object.values((b.organizacional.auditoria || {})._catalogo || {});
    afirma(audCat.length === 1 && audCat[0].tipo === 'carga_inicial' && audCat[0].usuario.email === EMAIL, 'auditoria da carga gravada (_catalogo)');
    /* carga POR DOMÍNIO: cada linha registra a contagem do próprio domínio (antes: o total geral, igual nas duas) */
    const audCatArq = Object.values((b.arquitetural.auditoria || {})._catalogo || {});
    afirma(audCat[0].valorNovo === 'Carga inicial — Organizacional: 5 conceitos (1 com definição vigente), 4 atributos, 3 valores de perfil, 2 relações' && audCat[0].resumoDominio.conceitos === 5 && audCat[0].resumoDominio.vigentes === 1 && audCat[0].dominio === 'organizacional', 'linha da carga do Organizacional: contagem SÓ do Organizacional (5 conceitos, 1 com definição)', audCat[0].valorNovo);
    afirma(audCatArq.length === 1 && audCatArq[0].valorNovo === 'Carga inicial — Arquitetural: 2 conceitos (1 com definição vigente)' && audCatArq[0].resumoDominio.conceitos === 2, 'linha da carga do Arquitetural: contagem SÓ do Arquitetural (2 conceitos)', audCatArq[0] && audCatArq[0].valorNovo);
    afirma(b.meta.cargaInicial.resumoPorDominio.organizacional.conceitos === 5 && b.meta.cargaInicial.resumoPorDominio.arquitetural.conceitos === 2 && b.meta.cargaInicial.resumo.conceitos === 7, 'meta da carga: total (7) e também por domínio (5 + 2)');
    afirma(b.organizacional.perfis.ALFA.CONSUMIDOR.estado === 'não consta na fonte' && !('valor' in b.organizacional.perfis.ALFA.CONSUMIDOR), 'ausência gravada como ESTADO, sem campo de valor');
    await esperaDb(page, () => !document.querySelector('#taxImportador'));
    afirma(await page.locator('#taxImportador').count() === 0, 'depois da carga o importador some (uma nova carga é recusada)');
    afirma(await page.locator('#taxFlash').count() === 1 && /Carga inicial concluída/.test(await page.locator('#taxFlash').innerText()), 'confirmação visível');

    /* ---------- domínios, árvore, pergunta orientadora ---------- */
    await T.voltarCatalogo(page);
    await aparece(page, '.tax-item');
    console.log('\n== 3. Dois domínios separados; árvore A → B → C ==');
    t = await page.locator('#taxPergunta').innerText();
    afirma(/Taxonomia Organizacional/.test(t) && /Que tipo de estrutura organizacional é esta\?/.test(t), 'organizacional: pergunta orientadora "Que tipo de estrutura organizacional é esta?"');
    const niveis = await page.locator('.tax-lista .tax-item').evaluateAll((els) => els.map((e) => [e.dataset.codigo, /tax-item--n(\d)/.exec(e.className)[1]]));
    afirma(JSON.stringify(niveis) === JSON.stringify([['ALFA', '0'], ['BETA', '1'], ['GAMA', '2'], ['DELTA', '0'], ['DISC', '0']]), 'árvore: Alfa(A) › Beta(B) › Gama(C); Delta(A); auxiliar por último', JSON.stringify(niveis));
    afirma(/Conceito auxiliar/i.test(await page.locator('.tax-lista').innerText()), 'o conceito auxiliar fica em grupo próprio');
    afirma(await page.locator('.tax-item[data-codigo="ALFA"]').innerText().then((x) => !/sem definição/i.test(x) && !/ALFA|Tipo organizacional/.test(x)), 'o item mostra o nome (sem código nem selo de camada); com definição, nenhum selo extra');
    afirma(await page.locator('.tax-item[data-codigo="BETA"] .tax-selo--sem-def').count() === 1, 'sem definição: selo "sem definição" (só quando falta)');
    await page.click('.tax-dominio[data-dominio="arquitetural"]');
    await page.waitForFunction(() => document.querySelector('.tax-item[data-codigo="componente"]'), { timeout: 6000 }).catch(() => {});
    t = await page.locator('#taxPergunta').innerText();
    afirma(/Taxonomia Arquitetural/.test(t) && /O que é o item\?/.test(t), 'arquitetural: pergunta orientadora "O que é o item?"');
    const arqItens = await page.locator('.tax-lista .tax-item').allInnerTexts();
    afirma(arqItens.length === 2 && /Componente/.test(arqItens[0]) && /Capacidade organizacional/.test(arqItens[1]), 'Componente e Capacidade organizacional são conceitos SEPARADOS');
    afirma(!/sem definição/i.test(arqItens[0]) && /sem definição/i.test(arqItens[1]), 'Arquitetural: Componente com definição; Capacidade sem texto → "sem definição" (nada presumido)');
    afirma(!/Alfa|Beta|Gama/.test(await page.locator('.tax-lista').innerText()), 'o domínio arquitetural não mistura conceitos organizacionais');
    await page.click('.tax-dominio[data-dominio="organizacional"]');
    await aparece(page, '.tax-item[data-codigo="ALFA"]');
    afirma(await page.locator('a[href*="taxonomia"], [data-tax="ligar-dominios"]').count() === 0, 'nenhum vínculo entre os dois domínios');

    /* ---------- detalhe: definição, pergunta, perfil, relações ---------- */
    console.log('\n== 4a. Catálogo: a ficha mínima ==');
    if (movel) afirma(await page.locator('.tax-ficha').isHidden(), '375 px: antes de escolher, só a lista aparece');
    await T.abrirConceito(page, 'ALFA');
    if (movel) afirma(await page.locator('.tax-lista').isHidden() && await page.locator('.tax-voltar').isVisible(), '375 px: a ficha ocupa a tela e há "← Voltar aos conceitos"');
    else afirma(await page.locator('.tax-lista').isVisible() && await page.locator('.tax-ficha').isVisible(), 'desktop: lista e ficha lado a lado');
    afirma((await page.locator('.tax-ficha .tax-titulo').innerText()).trim() === 'Tipo Alfa' && /Organizacional/.test(await page.locator('#taxTrilha').innerText()), 'A: nome e localização');
    afirma((await page.locator('#taxSecDefinicao h4').innerText()).trim() === 'O que é?' && (await page.locator('#taxDefinicaoTexto').innerText()).trim() === 'Texto fictício VIGENTE de Alfa.', 'B: "O que é?" com a definição oficial vigente');
    t = await page.locator('.tax-ficha').innerText();
    afirma(t.split('Texto fictício VIGENTE de Alfa.').length === 2, 'a definição aparece UMA vez');
    afirma(/Especialização Beta/.test(await page.locator('#taxHierFilhos').innerText()) && await page.locator('#taxHierFilhos [data-tax="selecionar"][data-codigo="BETA"]').count() === 1, 'C: hierarquia com os filhos clicáveis');
    afirma(await page.locator('.tax-ficha #taxCodigo, .tax-ficha #taxSecAtributos, .tax-ficha #taxSecRelacoes, .tax-ficha #taxSecHistorico, .tax-ficha #taxSecPergunta, .tax-ficha [data-tax="editar-conceito"], .tax-ficha [data-tax="atualizar-definicao"], .tax-ficha [data-tax="inativar"], .tax-ficha [data-tax="alterar-camada"]').count() === 0, 'o Catálogo não mostra código, perfil, relações, histórico, pergunta/critérios nem ações de edição');
    afirma(!/ALFA|Pergunta fictícia|Critério fictício|Observação fictícia|Sem registro|Papel|Origem|compõe|Histórico|Texto fictício histórico/.test(t), 'nem os textos deles (nem os antigos não vigentes)', t.replace(/\s+/g, ' '));
    afirma(await page.locator('#taxAdministrarBtn').isVisible() && (await page.locator('#taxAdministrarBtn').innerText()).trim() === 'Administrar conceito', 'E: "Administrar conceito" (secundário, só para quem pode)');
    afirma(await page.locator('.tax-ficha #taxExportar, .tax-ficha #taxImportador').count() === 0, 'exportar e importar ficam em Integridade, fora da ficha');
    if (movel) {
      afirma(/Voltar aos conceitos/.test(await page.locator('.tax-voltar').innerText()), '375 px: "← Voltar aos conceitos" no topo da ficha');
      afirma(await page.locator('.tax-voltar-rodape [data-tax="voltar-lista"]').isVisible(), '375 px: o mesmo "Voltar" também no fim da ficha');
      afirma(await page.evaluate(() => [...document.querySelectorAll('.tax-ficha button, .tax-ficha summary')].filter((b) => b.offsetParent).every((b) => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth + 1; })), '375 px: todos os botões da ficha cabem na largura da tela');
      await page.click('.tax-voltar-rodape [data-tax="voltar-lista"]');
      afirma(await page.locator('.tax-lista').isVisible() && await page.locator('.tax-ficha').isHidden(), '375 px: o "Voltar" do rodapé volta à lista');
      afirma(await page.evaluate(() => { const it = document.querySelector('.tax-item--ativo[data-codigo="ALFA"]'); if (!it) return false; const r = it.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight; }), '375 px: de volta à lista, o conceito escolhido continua marcado e à vista');
    }
    await T.abrirConceito(page, 'BETA');
    afirma((await page.locator('#taxSemDefinicao').innerText()).trim() === 'Não há definição oficial disponível para este conceito.', 'Beta (sem definição): o Catálogo diz que não há — nada inventado');
    afirma(!/Texto fictício (histórico|placeholder|NÃO LOCALIZADO) de Beta/.test(await page.locator('.tax-ficha').innerText()), 'os textos não vigentes de Beta não foram importados nem aparecem');
    afirma(/Faz parte de\s*Tipo Alfa/.test(await page.locator('#taxHierPai').innerText()) && !/ALFA/.test(await page.locator('#taxHierPai').innerText()), 'hierarquia de Beta: "Faz parte de Tipo Alfa" (sem código)');
    await T.abrirConceito(page, 'GAMA');
    afirma(await page.locator('#taxSemDefinicao').count() === 1 && !/Proposta fictícia de Gama/.test(await page.locator('.tax-ficha').innerText()), 'Gama: a proposta "em validação" nunca virou definição');
    await T.abrirConceito(page, 'DELTA');
    afirma(await page.locator('#taxSemDefinicao').count() === 1 && await page.locator('#taxSecHierarquia').count() === 0, 'Delta: sem definição e sem hierarquia (nenhum bloco vazio)');
    afirma(await larguraOk(page), 'sem rolagem horizontal');

    console.log('\n== 4b. Administração: Conteúdo, Perfil, Relações, Histórico e governança ==');
    await abrirConceito(page, 'ALFA');
    afirma((await page.locator('#taxAdminTitulo').innerText()).trim() === 'Administrar — Tipo Alfa', 'título "Administrar — Tipo Alfa"');
    afirma(JSON.stringify(await page.locator('.tax-admin-abas [role="tab"]').allInnerTexts()) === JSON.stringify(['Conteúdo', 'Perfil', 'Relações', 'Histórico e governança']), 'abas: Conteúdo, Perfil, Relações, Histórico e governança', JSON.stringify(await page.locator('.tax-admin-abas [role="tab"]').allInnerTexts()));
    afirma((await page.locator('#taxDefinicaoTexto').innerText()).trim() === 'Texto fictício VIGENTE de Alfa.', 'Conteúdo: a definição oficial vigente');
    t = await page.locator('#taxDefAtualizacao').innerText();
    afirma(/^Última atualização:/.test(t.trim()) && /\d{2}\/\d{2}\/\d{4}/.test(t) && new RegExp(EMAIL.replace('.', '\\.')).test(t) && /versão 1/.test(t), '"Última atualização: data e responsável" (e a versão)', t);
    afirma(await page.locator('#taxAtualizarDefinicaoBtn').isVisible() && (await page.locator('#taxAtualizarDefinicaoBtn').textContent()).trim() === 'Atualizar definição', 'botão "Atualizar definição" (fluxo versionado)');
    afirma(await page.locator('#taxEditarInfoBtn').isVisible() && (await page.locator('#taxEditarInfoBtn').textContent()).trim() === 'Editar informações' && await page.locator('#taxAdmin [data-tax="editar-conceito"]').count() === 1, '"Editar informações" separado de "Atualizar definição" (um formulário só)');
    afirma(await page.locator('#taxHistDefinicao').count() === 0, 'a definição não tem um histórico separado: há UM histórico, na aba de governança');
    t = await page.locator('#taxAdmin').innerText();
    afirma(await page.locator('#taxSecFontes, [data-fonte], [data-tax="tornar-vigente"], [data-tax="nova-fonte"], [data-tax="arquivar"], [data-tax="nova-versao"]').count() === 0 && !/Rótulo da fonte|Tipo de redação|em validação|placeholder|histórica\/contextual|Fontes disponíveis/i.test(t), 'nenhum catálogo de fontes, situação, rótulo, tipo de redação, promoção ou arquivamento');
    afirma(!/Texto fictício histórico de Alfa\./.test(t), 'os textos antigos que não eram a vigente não aparecem');
    const tops = await ordemSecoes(page, ['taxSecIdent', 'taxSecDefinicao', 'taxSecPergunta']);
    afirma(tops.every((y) => y !== null) && tops.every((y, i) => i === 0 || y > tops[i - 1]), 'Conteúdo: Identificação, Definição, Pergunta/critérios/observações', JSON.stringify(tops));
    t = await page.locator('#taxSecIdent').innerText();
    afirma(/Código:\s*ALFA/.test(t) && /Camada:\s*Tipo organizacional/.test(t) && /Situação:\s*ativo/.test(t), 'Identificação (só na administração): código, camada e situação', t.replace(/\s+/g, ' '));
    t = await page.locator('#taxSecPergunta').innerText();
    afirma(/Pergunta fictícia sobre Alfa\?/.test(t) && /Critério fictício A1/.test(t) && /Observação fictícia de Alfa\./.test(t), 'pergunta discriminadora, critérios e observações');
    afirma(await page.locator('#taxAdmin #taxSecAtributos, #taxAdmin #taxSecRelacoes, #taxAdmin #taxSecHistorico, #taxAdmin #taxExportar').count() === 0, 'cada aba mostra só o seu conteúdo (exportar fica em Integridade)');
    await abrirAtributos(page);
    t = await page.locator('#taxSecAtributos').innerText();
    afirma(/3 de 4 atributos definidos/.test(t), 'Perfil: "3 de 4 atributos definidos"');
    const celulas = async (a) => (await page.locator('#taxPerfilTabela tr[data-atributo="' + a + '"] td').allTextContents()).map((x) => x.trim());
    afirma(JSON.stringify(await celulas('ALCANCE')) === JSON.stringify(['registrado', 'transversal', 'observado', 'decisão']), 'cada atributo com Estado, Valor, Papel e Origem ("Alcance de atuação")', JSON.stringify(await celulas('ALCANCE')));
    afirma(JSON.stringify(await celulas('FORMA')) === JSON.stringify(['registrado', 'Forma inferida fictícia', 'observado', 'inferência']), 'valor com origem "inferência": exibido como tal', JSON.stringify(await celulas('FORMA')));
    afirma((await celulas('CONSUMIDOR'))[0] === 'não consta na fonte', 'estado "não consta na fonte" aparece como estado (não como vazio)');
    afirma((await celulas('BENEFICIARIO'))[0] === 'sem registro' && await page.locator('#taxPerfilTabela tr.tax-atributo--vazio[data-atributo="BENEFICIARIO"]').count() === 1, 'atributo sem registro aparece AQUI, para preenchimento');
    afirma(/observado: valor presente na fonte ou registrado no perfil, mas ainda não curado como característica definidora ou típica do conceito/.test(await page.locator('#taxLegenda').textContent()), 'a tela DEFINE "observado"');
    afirma(/definidor: ajuda a distinguir\/classificar o conceito/.test(await page.locator('#taxLegenda').textContent()) && /típico: característica frequente ou esperada/.test(await page.locator('#taxLegenda').textContent()), 'e define "definidor" e "típico"');
    afirma(/inferência: leitura nossa, não é dado de fonte nem decisão aprovada/.test(await page.locator('#taxLegenda').textContent()) && await page.locator('.tax-inferencia-aviso').count() === 0, 'a ajuda contextual explica que inferência NÃO é dado de fonte (sem repetir em cada linha)');
    afirma(!/Abrangência/i.test(await page.locator('#taxAdmin').innerText()), 'nenhuma "Abrangência"');
    await T.abaAdmin(page, 'relacoes');
    afirma(/Relações registradas entre conceitos \(1\)/.test(await page.locator('#taxSecRelacoes h4').innerText()) && /Não comprovam relações entre áreas concretas/.test(await page.locator('#taxRelNatureza').innerText()), 'Relações: "Relações registradas entre conceitos (1)" e o que elas são (não relações entre áreas reais)');
    afirma(await page.locator('#taxRelLista li[data-relacao="BETA__compoe__ALFA"][data-direcao="entrada"]').count() === 1 && /Especialização Beta\s*—\s*compõe\s*—\s*Tipo Alfa/.test(await page.locator('#taxRelLista li[data-relacao="BETA__compoe__ALFA"] .tax-rel-frase').innerText()) && !/BETA/.test(await page.locator('#taxRelLista').innerText()), 'a relação como "A — compõe — B", com os nomes (sem códigos)');
    await T.abaAdmin(page, 'historico');
    afirma(await page.locator('#taxHistoricoConceito').count() === 1 && !(await page.locator('#taxHistoricoConceito').evaluate((d) => d.open)) && (await page.locator('#taxHistoricoConceito > summary').innerText()).trim() === 'Histórico — 0 alterações', 'Histórico e governança: recolhido por padrão, "Histórico — 0 alterações"');
    await abrirHistorico(page);
    afirma(/Nenhuma alteração depois do registro inicial/.test(await page.locator('#taxSecHistorico').innerText()) && /Registro inicial da definição \(versão 1\)/.test(await page.locator('#taxHistInicial').innerText()) && /carga inicial/.test(await page.locator('#taxHistInicial').innerText()), 'o registro inicial (carga) distinto das alterações: "Nenhuma alteração depois do registro inicial."');
    afirma(await page.locator('#taxSecIdentAcoes #taxInativarBtn').count() === 1 && await page.locator('#taxSecIdentAcoes #taxCamadaBtn').count() === 1, 'inativar e alterar camada ficam aqui, em "Situação do conceito"');
    if (movel) afirma(await page.evaluate(() => [...document.querySelectorAll('#taxAdmin button, #taxAdmin summary')].filter((b) => b.offsetParent).every((b) => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth + 1; })), '375 px: todos os botões da administração cabem na tela');
    await T.abaAdmin(page, 'conteudo');
    await abrirConceito(page, 'BETA');
    afirma(/Este conceito ainda não tem definição oficial vigente\./.test(await page.locator('#taxSemDefinicao').innerText()) && (await page.locator('#taxAtualizarDefinicaoBtn').textContent()).trim() === 'Registrar definição', 'Beta: "ainda não tem definição oficial vigente" e "Registrar definição"');
    afirma(/Conceito pai:\s*Tipo Alfa\s*ALFA/.test(await page.locator('#taxIdentPai').innerText()), 'Identificação de Beta: o conceito pai (nome e código)');
    t = await page.locator('#taxSecPergunta').innerText();
    afirma(/Pergunta fictícia sobre Beta\?/.test(t) && await page.locator('#taxNotaAplicacao').innerText().then((x) => /Nota de aplicação fictícia: Beta e Gama não se confundem\./.test(x)), 'a NOTA DE APLICAÇÃO aparece junto da pergunta discriminadora');
    await T.abaAdmin(page, 'relacoes');
    afirma(await page.locator('#taxRelLista li[data-relacao="BETA__compoe__ALFA"][data-direcao="saida"]').count() === 1, 'a mesma relação, vista de Beta (sai de Beta)');
    await T.abaAdmin(page, 'conteudo');
    afirma(await larguraOk(page), 'sem rolagem horizontal');

    /* ---------- edição que SALVA ---------- */
    console.log('\n== 5. Edição de conceito: salva de verdade, com auditoria ==');
    await abrirConceito(page, 'ALFA');
    await abrirHistorico(page); /* aberto ANTES de salvar: tem de continuar aberto depois do re-render */
    await T.abaAdmin(page, 'conteudo');
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
    await T.abaAdmin(page, 'historico');
    await esperarCondicao(page, () => /Histórico — 3 alterações/.test((document.querySelector('#taxHistoricoConceito > summary') || {}).textContent || ''), null, { limite: 6000, descricao: 'histórico recarregado com as 3 alterações' });
    afirma(await page.locator('#taxHistoricoConceito').evaluate((d) => d.open), 'o histórico que estava aberto continua aberto depois de salvar (estado guardado no re-render)');
    t = await page.locator('#taxSecHistorico').innerText();
    afirma(/Tipo Alfa → Tipo Alfa Revisado/.test(t), 'o histórico na tela mostra a alteração');
    const linhaNome = page.locator('#taxHistoricoConceito .tax-hist-item').filter({ hasText: 'Tipo Alfa → Tipo Alfa Revisado' });
    t = await linhaNome.innerText();
    afirma(/\d{2}\/\d{2}\/\d{4}/.test(t) && new RegExp(EMAIL.replace('.', '\\.')).test(t) && /Alteração de conceito/.test(t), 'cada linha do histórico: data, autor e tipo da alteração', t.replace(/\s+/g, ' '));
    afirma((await page.locator('#taxAdminTitulo').innerText()).trim() === 'Administrar — Tipo Alfa Revisado', 'o título da administração reflete o novo nome');
    await T.voltarCatalogo(page);
    afirma(/Tipo Alfa Revisado/.test(await page.locator('.tax-item[data-codigo="ALFA"]').innerText().catch(() => '')) || movel, 'a lista reflete o novo nome');
    await T.administrar(page);

    console.log('\n== 5b. Inferência pode ser alterada sem mexer na definição ==');
    const defAntes = await page.evaluate(() => JSON.stringify([window.__CFG.__dbReal.taxonomia.organizacional.conceitos.ALFA.definicao, window.__CFG.__dbReal.taxonomia.organizacional.definicoes.ALFA]));
    await gerenciarPerfil(page);
    afirma(await page.inputValue('#taxPL_FORMA_origem') === 'inferência' && await page.inputValue('#taxPL_FORMA_papel') === 'observado', '"Gerenciar perfil" abre com a origem "inferência" e o papel "observado" atuais');
    await page.fill('#taxPL_FORMA_valor', 'Forma inferida fictícia, revisada');
    await page.click('#taxSalvarPerfilBtn');
    await esperaDb(page, () => /revisada/.test(window.__CFG.__dbReal.taxonomia.organizacional.perfis.ALFA.FORMA.valor));
    b = (await banco(page)).taxonomia;
    afirma(/revisada/.test(b.organizacional.perfis.ALFA.FORMA.valor) && b.organizacional.perfis.ALFA.FORMA.origem === 'inferência', 'valor inferido alterado; a origem continua "inferência"');
    afirma(JSON.stringify([b.organizacional.conceitos.ALFA.definicao, b.organizacional.definicoes.ALFA]) === defAntes, 'a definição e o seu histórico NÃO foram tocados');
    afirma(Object.values(b.organizacional.auditoria.ALFA).some((l) => l.tipo === 'alteracao_perfil' && l.campo === 'Forma de entrega/consumo'), 'a alteração do valor inferido foi auditada');

    console.log('\n== 6. Edição de perfil: ausência é estado ==');
    await gerenciarPerfil(page);
    await page.selectOption('#taxPL_BENEFICIARIO_estado', 'ainda não definido');
    afirma(await page.locator('#taxPL_BENEFICIARIO_valor').count() === 0, 'em estado de ausência não há campo de valor');
    await page.click('#taxSalvarPerfilBtn');
    await esperaDb(page, () => (window.__CFG.__dbReal.taxonomia.organizacional.perfis.ALFA || {}).BENEFICIARIO);
    b = (await banco(page)).taxonomia;
    afirma(JSON.stringify(Object.keys(b.organizacional.perfis.ALFA.BENEFICIARIO).sort()) === JSON.stringify(['atualizadoEm', 'estado']) && b.organizacional.perfis.ALFA.BENEFICIARIO.estado === 'ainda não definido', 'gravado só com o estado (sem valor, papel nem origem)');
    await aparece(page, '#taxPerfilContagem');
    await gerenciarPerfil(page);
    await page.selectOption('#taxPL_CONSUMIDOR_estado', 'registrado');
    await page.click('#taxSalvarPerfilBtn');
    afirma(/exige o valor/.test(await page.locator('#taxFormPerfilLote').innerText()), '"registrado" sem valor → recusado na tela');
    await page.fill('#taxPL_CONSUMIDOR_valor', 'Times fictícios');
    afirma(await page.inputValue('#taxPL_CONSUMIDOR_origem') === '' && await page.inputValue('#taxPL_CONSUMIDOR_papel') === 'observado', 'ao registrar um valor, a origem NÃO vem pré-marcada (nunca "fonte" por padrão) e o papel nasce neutro ("observado")');
    await page.click('#taxSalvarPerfilBtn');
    afirma(/exige papel e origem/.test(await page.locator('#taxFormPerfilLote').innerText()), 'sem escolher a origem, não salva');
    await page.selectOption('#taxPL_CONSUMIDOR_papel', 'definidor');
    await page.selectOption('#taxPL_CONSUMIDOR_origem', 'inferência');
    await page.click('#taxSalvarPerfilBtn');
    await esperaDb(page, () => ((window.__CFG.__dbReal.taxonomia.organizacional.perfis.ALFA || {}).CONSUMIDOR || {}).estado === 'registrado');
    b = (await banco(page)).taxonomia;
    const pc = b.organizacional.perfis.ALFA.CONSUMIDOR;
    afirma(pc.estado === 'registrado' && pc.valor === 'Times fictícios' && pc.papel === 'definidor' && pc.origem === 'inferência', 'registrado com valor, papel e origem');
    afirma(Object.values(b.organizacional.auditoria.ALFA).some((l) => l.tipo === 'alteracao_perfil' && l.campo === 'Consumidor direto principal'), 'auditoria do perfil gravada');

    /* ---------- definição oficial: registrar e atualizar, nos dois domínios ---------- */
    console.log('\n== 7. Definição (Organizacional): registrar, recusa do banco e atualizar ==');
    const B1 = 'Definição fictícia de Beta, versão 1.', B2 = 'Definição fictícia de Beta, versão 2.';
    await abrirConceito(page, 'BETA');
    await page.click('#taxAtualizarDefinicaoBtn');
    await page.fill('#taxDefNovo', B1);
    await page.click('#taxDefConferirBtn');
    afirma(await page.locator('#taxConferirDefinicao').isVisible() && (await page.locator('#taxDefNovaConferir').innerText()).trim() === B1 && /\(nenhuma\)/.test(await page.locator('#taxDefAtualConferir').innerText()), 'conferir: a proposta, e "(nenhuma)" como atual');
    afirma(!(await banco(page)).taxonomia.organizacional.conceitos.BETA.definicao, 'conferir não grava nada');
    await page.evaluate(() => { window.__CFG.fail = ['taxonomia/organizacional/auditoria']; });
    await page.click('#taxDefPublicarBtn');
    await page.waitForSelector('#taxFlash.tax-flash--erro', { timeout: 6000 }).catch(() => {});
    b = (await banco(page)).taxonomia;
    afirma(await page.locator('#taxFlash.tax-flash--erro').count() === 1 && !b.organizacional.conceitos.BETA.definicao && !(b.organizacional.definicoes || {}).BETA, 'recusa do banco: erro visível e NADA gravado (definição, histórico e auditoria são uma gravação só)');
    afirma(await page.locator('#taxConferirDefinicao').count() === 1, 'a proposta continua na tela para tentar de novo');
    await page.evaluate(() => { window.__CFG.fail = []; });
    await page.click('[data-tax="fechar-flash"]');
    await page.click('#taxDefPublicarBtn');
    await esperaDb(page, () => !!window.__CFG.__dbReal.taxonomia.organizacional.conceitos.BETA.definicao);
    b = (await banco(page)).taxonomia;
    let dB = b.organizacional.conceitos.BETA.definicao;
    afirma(dB && dB.versao === 1 && dB.texto === B1 && dB.publicadaPor === EMAIL && b.organizacional.definicoes.BETA.v1.texto === B1 && b.organizacional.definicoes.BETA.v1.origem === 'publicacao', 'registrar: versão 1 + histórico v1, com autor', JSON.stringify(dB));
    await esperarCondicao(page, (x) => ((document.getElementById('taxDefinicaoTexto') || {}).textContent || '').trim() === x, B1, { limite: 6000, descricao: 'definição registrada na tela' });
    await publicarPelaTela(page, B2, 'Motivo fictício da revisão.');
    await esperaDb(page, () => window.__CFG.__dbReal.taxonomia.organizacional.conceitos.BETA.definicao.versao === 2);
    b = (await banco(page)).taxonomia;
    dB = b.organizacional.conceitos.BETA.definicao;
    afirma(dB.versao === 2 && dB.texto === B2 && b.organizacional.definicoes.BETA.v1.texto === B1 && b.organizacional.definicoes.BETA.v2.texto === B2 && b.organizacional.definicoes.BETA.v2.motivo === 'Motivo fictício da revisão.', 'atualizar: versão 2; a v1 continua intacta no histórico');
    const audP = Object.values(b.organizacional.auditoria.BETA).filter((l) => l.tipo === 'definicao_publicada');
    afirma(audP.length === 2 && audP.some((l) => l.versao === 2 && l.valorAnterior === B1 && l.valorNovo === B2 && l.usuario.email === EMAIL), 'auditoria definicao_publicada: anterior → nova, versão e autor');
    await esperarCondicao(page, (x) => ((document.getElementById('taxDefinicaoTexto') || {}).textContent || '').trim() === x, B2, { limite: 6000, descricao: 'nova definição na tela' });
    afirma(((await page.locator('#taxDefinicaoTexto').innerText()).trim() === B2) && /versão 2/.test(await page.locator('#taxDefAtualizacao').innerText()), 'a tela mostra a nova definição e "versão 2"');
    await T.abaAdmin(page, 'historico');
    await esperarCondicao(page, () => /Histórico — 2 alterações$/.test(((document.querySelector('#taxHistoricoConceito > summary') || {}).textContent || '').trim()), null, { limite: 6000, descricao: 'histórico com o registro e a atualização da definição' });
    afirma(await larguraOk(page), 'sem rolagem horizontal');
    await T.voltarCatalogo(page);
    afirma(((await page.locator('#taxDefinicaoTexto').innerText().catch(() => '')).trim() === B2), 'o Catálogo já mostra a definição publicada');

    console.log('\n== 8. Definição (Arquitetural): o mesmo fluxo ==');
    const C2 = 'Definição fictícia de componente, revisada.';
    await T.dominio(page, 'arquitetural');
    await aparece(page, '.tax-item[data-codigo="componente"]');
    await abrirConceito(page, 'componente');
    afirma(JSON.stringify(await page.locator('.tax-admin-abas [role="tab"]').allInnerTexts()) === JSON.stringify(['Conteúdo', 'Histórico e governança']), 'Arquitetural: só Conteúdo e Histórico e governança (sem Perfil nem Relações)');
    afirma((await page.locator('#taxDefinicaoTexto').innerText()).trim() === 'Definição fictícia de componente.' && /versão 1/.test(await page.locator('#taxDefAtualizacao').innerText()), 'Arquitetural: definição vigente (v1 da carga) na tela');
    await publicarPelaTela(page, C2);
    await esperaDb(page, () => window.__CFG.__dbReal.taxonomia.arquitetural.conceitos.componente.definicao.versao === 2);
    b = (await banco(page)).taxonomia;
    afirma(b.arquitetural.conceitos.componente.definicao.texto === C2 && b.arquitetural.definicoes.componente.v1.texto === 'Definição fictícia de componente.' && b.arquitetural.definicoes.componente.v2.texto === C2, 'Arquitetural: versão 2 publicada, v1 preservada');
    afirma(Object.values(b.arquitetural.auditoria.componente || {}).filter((l) => l.tipo === 'definicao_publicada' && l.versao === 2).length === 1, 'Arquitetural: auditoria definicao_publicada no próprio domínio');
    afirma(JSON.stringify(b.organizacional.conceitos.BETA.definicao) === JSON.stringify(dB), 'o Organizacional não foi tocado');
    await T.dominio(page, 'organizacional');
    await aparece(page, '.tax-item[data-codigo="ALFA"]');
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
    afirma(await page.locator('#taxErro').count() === 1 && /TENTAR NOVAMENTE/i.test(await page.locator("#taxErro").innerText()), 'depois do limite de espera: erro de rede com "TENTAR NOVAMENTE"');
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
    const { ctx, page } = await abrir(browser, { email: OUTRO, db: { taxonomia: { meta: {}, organizacional: { conceitos: { ALFA: { nome: 'Tipo Alfa', camada: 'A', ordem: 1, ativo: true } } } } } });
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
    await T.abrirConceito(page, 'ALFA');
    afirma(await page.locator('#taxAdministrarBtn, #taxVerificacoesLink').count() === 0, 'modo somente leitura: sem "Administrar conceito" nem "Verificações do sistema"');
    const botoes = await page.locator('#adminTaxonomia [data-tax="editar-conceito"], #adminTaxonomia [data-tax="atualizar-definicao"], #adminTaxonomia [data-tax="publicar-definicao"], #adminTaxonomia [data-tax="gerenciar-perfil"], #adminTaxonomia [data-tax="gerenciar-relacoes"], #adminTaxonomia [data-tax="inativar"], #adminTaxonomia [data-tax="nova-versao"]').count();
    afirma(botoes === 0, 'modo somente leitura: nenhum botão de edição (consulta de verdade)');
    afirma(/Texto fictício VIGENTE de Alfa\./.test(await page.locator('#taxSecDefinicao').innerText()), 'e a consulta continua completa');
    await ctx.close();
  }

  /* ---------- A GRAVAÇÃO QUE NÃO RECEBE CONFIRMAÇÃO DO SERVIDOR (bug de produção, então em "Remover vigência";
     hoje provado na publicação da definição, a gravação que substituiu aquele fluxo) ---------- */
  const SEM = 'taxonomia/organizacional/conceitos/SQ/definicao'; /* só a ESCRITA do Squad bate aqui; as leituras não */
  const SQ1 = 'Texto fictício vigente.', SQ2 = 'Texto fictício publicado sem confirmação.';
  const DSQ = { texto: SQ1, versao: 1, publicadaEm: '2026-10-03T10:00:00.000Z', publicadaPor: EMAIL };
  const semente = () => ({ taxonomia: { meta: { cargaInicial: { feitaEm: '2026-10-03T10:00:00.000Z', feitaPor: EMAIL, resumo: {} } },
    organizacional: { conceitos: { SQ: { nome: 'Conceito Fictício Sq', camada: 'A', ordem: 1, ativo: true, definicao: DSQ } },
      definicoes: { SQ: { v1: Object.assign({ origem: 'carga-inicial' }, DSQ) } },
      auditoria: {} }, arquitetural: {} } });
  const banco2 = async (page) => (await banco(page)).taxonomia.organizacional;
  const nEventos = async (page) => Object.values(((await banco2(page)).auditoria || {}).SQ || {}).filter((a) => a.tipo === 'definicao_publicada').length;
  const versaoSq = async (page) => ((await banco2(page)).conceitos.SQ.definicao || {}).versao;
  const telaSq = (page) => page.evaluate(() => ((document.getElementById('taxDefinicaoTexto') || {}).textContent || '').trim());
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
  const removerSq = (page) => publicarPelaTela(page, SQ2); /* nome antigo mantido: é a gravação sob teste */
  const repetirSq = async (page) => { await page.click('#taxDefPublicarBtn', { timeout: 3000 }); }; /* a proposta continua na tela enquanto a gravação não se resolve */

  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    const movel = viewport.width <= 720;
    console.log('\n######## Gravação sem confirmação do servidor — ' + nomeTela + ' ########');

    console.log('\n== G1. Sucesso normal: nada muda no comportamento ==');
    {
      const { ctx, page, erros } = await abrirSq(browser, viewport);
      await removerSq(page);
      await aparece(page, '#taxFlash:not(.tax-flash--erro)');
      /* o flash sai antes das releituras (aposSalvar) que redesenham o bloco da vigente: espera o estado que a asserção exige */
      await esperarCondicao(page, (x) => ((document.getElementById('taxDefinicaoTexto') || {}).textContent || '').trim() === x, SQ2, { descricao: 'a definição ser redesenhada com o texto novo' });
      const o = await banco2(page);
      afirma(o.conceitos.SQ.definicao.versao === 2 && o.definicoes.SQ.v2.texto === SQ2 && o.definicoes.SQ.v1.texto === SQ1 && await nEventos(page) === 1, 'publicar com confirmação normal: gravado (v2, v1 preservada), auditado (1 evento)');
      afirma(await page.locator('#taxPendente').count() === 0 && await telaSq(page) === SQ2, 'sem aviso de pendência e a tela já mostra a nova definição');
      afirma(erros.length === 0, 'sem erros de JavaScript');
      await ctx.close();
    }

    console.log('\n== G2. PERMISSION_DENIED: continua recusado, sem bloqueio nem aviso de pendência ==');
    {
      const { ctx, page } = await abrirSq(browser, viewport, { fail: [SEM] });
      await removerSq(page);
      await aparece(page, '#taxFlash.tax-flash--erro');
      afirma(/o banco recusou a gravação/.test(await page.locator('#taxFlash').innerText()) && await page.locator('#taxPendente').count() === 0, 'recusa de regra: mensagem de recusa, sem "pendência"');
      afirma(await versaoSq(page) === 1 && await nEventos(page) === 0, 'nada gravado, nenhum evento');
      await page.evaluate(() => { window.__CFG.fail = []; });
      await page.click('[data-tax="fechar-flash"]');
      await repetirSq(page); /* a proposta continuou na tela */
      await aparece(page, '#taxFlash:not(.tax-flash--erro)');
      await esperaDb(page, () => window.__CFG.__dbReal.taxonomia.organizacional.conceitos.SQ.definicao.versao === 2);
      afirma(await versaoSq(page) === 2 && await nEventos(page) === 1, 'sem estado preso: repetir depois de corrigida a causa funciona (1 evento)');
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
      await repetirSq(page);
      await page.waitForTimeout(250);
      afirma(/Aguarde|ainda sem confirmação/i.test(await page.locator('#taxFlash').innerText().catch(() => '')) && await page.evaluate(() => (window.__ESCRITAS || []).length) === escritasAntes, 'nova tentativa da mesma ação: BLOQUEADA com aviso, e nenhuma escrita nova foi enviada');
      afirma(await versaoSq(page) === 1, 'enquanto não confirma, o banco continua como estava');
      await page.waitForSelector('#taxPendente', { state: 'detached', timeout: 6000 }).catch(() => {});
      await esperarCondicao(page, (x) => ((document.getElementById('taxDefinicaoTexto') || {}).textContent || '').trim() === x, SQ2, { limite: 5000, descricao: 'a tela mostrar a definição publicada' });
      afirma(await page.locator('#taxPendente').count() === 0, 'a confirmação chegou: o aviso some');
      afirma(/FOI aplicada/.test(await page.locator('#taxFlash').innerText()), 'a tela informa que a alteração FOI aplicada (confirmação atrasada)');
      afirma(await telaSq(page) === SQ2 && await versaoSq(page) === 2 && await nEventos(page) === 1, 'a tela foi reconciliada com o banco, e há UM só evento de auditoria (nenhuma repetição)');
      afirma(erros.length === 0, 'sem erros de JavaScript');
      await ctx.close();
    }

    console.log('\n== G4. Gravada, mas a confirmação se perdeu: a conferência no servidor reconcilia ==');
    {
      const { ctx, page } = await abrirSq(browser, viewport, { semConfirmacao: [SEM] });
      await removerSq(page);
      await page.waitForFunction(() => /FOI aplicada/.test((document.querySelector('#taxFlash') || {}).innerText || ''), null, { timeout: 5000 }).catch(() => {});
      afirma(/FOI aplicada/.test(await page.locator('#taxFlash').innerText().catch(() => '')) && await page.locator('#taxPendente').count() === 0, 'sem resposta, mas o servidor TEM o evento: a tela informa que foi aplicada e não deixa pendência');
      await esperarCondicao(page, (x) => ((document.getElementById('taxDefinicaoTexto') || {}).textContent || '').trim() === x, SQ2, { limite: 5000, descricao: 'a tela mostrar a definição publicada' });
      afirma(await telaSq(page) === SQ2 && await nEventos(page) === 1, 'tela atualizada; um único evento (não repetiu)');
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
      await repetirSq(page);
      await page.waitForTimeout(250);
      afirma(await page.evaluate(() => (window.__ESCRITAS || []).length) === antes, 'não há repetição cega: nenhuma escrita nova enquanto não houver confirmação');
      await page.evaluate(() => { window.__CFG.getFalha = false; });
      await page.click('[data-tax="verificar-pendente"]');
      await page.waitForFunction(() => /NÃO consta/.test((document.querySelector('#taxPendente') || {}).innerText || ''), null, { timeout: 4000 }).catch(() => {});
      afirma(/NÃO consta no banco/.test(await page.locator('#taxPendente').innerText().catch(() => '')), '"VERIFICAR NO SERVIDOR": consultou de novo (agora com conexão) e informa que NÃO consta');
      afirma(await versaoSq(page) === 1 && await nEventos(page) === 0, 'o banco segue intacto (nada aplicado)');
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
      organizacional: { conceitos: { SQ: { nome: 'Conceito Fictício', camada: 'A', ordem: 1, ativo: true } }, auditoria: { _catalogo: org } },
      arquitetural: { conceitos: {}, auditoria: { _catalogo: arq } } } };
  };
  async function abrirHG(browser, viewport, nOrg, comArq, extra) {
    const r = await abrir(browser, Object.assign({ viewport, db: semenHG(nOrg, comArq) }, extra || {}));
    await irParaTaxonomia(r.page);
    await aparece(r.page, '.tax-item[data-codigo="SQ"]');
    await r.page.evaluate(() => { const e = window.faTaxonomia._interno.espera; e.leitura = 1200; });
    await T.irIntegridade(r.page);
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
      afirma(await page.locator('#taxAcoesGerais #taxHistoricoGlobalBtn').count() === 1 && /Ver o histórico global/.test(await page.locator('#taxHistoricoGlobalBtn').innerText()), '"Ver o histórico global" fica em Integridade › Dados e manutenção');
      const escritas0 = await page.evaluate(() => (window.__ESCRITAS || []).length);
      await page.click('[data-tax="aba-historico"]');
      await esperarCondicao(page, () => /^Histórico — 28 alterações/.test(((document.querySelector('#taxHgDetalhes > summary') || {}).textContent || '').trim()), null, { limite: 4000, descricao: 'cabeçalho do histórico global com a contagem' });
      afirma(!(await page.locator('#taxHgDetalhes').evaluate((d) => d.open)) && (await page.locator('#taxHgDetalhes > summary').innerText()).trim() === 'Histórico — 28 alterações carregadas (há mais antigas)', 'histórico global: começa RECOLHIDO, com "Histórico — 28 alterações carregadas (há mais antigas)"');
      afirma(!(await linhasHG(page).first().isVisible()), 'recolhido: nenhuma linha à vista antes do clique');
      await abrirListaHG(page);
      await aparece(page, '#taxHistoricoGlobal .tax-hg-item');
      afirma(await page.locator('.tax-wrap, #taxAcoesGerais').count() === 0 && await page.locator('#taxHistoricoGlobal').count() === 1, 'o histórico global ocupa a área (sem a lista nem os controles)');
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
      afirma(/Carga inicial — Arquitetural/.test(tCargaArq) && /Hoje o domínio tem 0 conceitos, 0 com definição vigente \(contagem atual, não a da carga\)/.test(tCargaArq), 'carga antiga: "Carga inicial — Arquitetural" com a contagem ATUAL do domínio, dita como atual', tCargaArq.replace(/\s+/g, ' '));
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
      afirma(/Carga inicial — Organizacional/.test(tCargaOrg) && /Hoje o domínio tem 1 conceito, 0 com definição vigente/.test(tCargaOrg), 'a outra linha: "Carga inicial — Organizacional", com a contagem do PRÓPRIO domínio (as duas linhas não são mais idênticas)', tCargaOrg.replace(/\s+/g, ' '));
      afirma(await page.evaluate(() => (window.__ESCRITAS || []).length) === escritas0, 'só leitura: nenhuma escrita (nada copiado para os conceitos, nenhuma auditoria nova)');
      if (movel) {
        afirma(await page.locator('.tax-voltar-hg--topo [data-tax="voltar-dominio"]').isVisible() && await page.locator('.tax-voltar-hg--rodape [data-tax="voltar-dominio"]').isVisible() && /Voltar às Verificações do sistema/.test(await page.locator('.tax-voltar-hg--topo').innerText()), '375 px: "← Voltar à Integridade" visível no topo e no fim do histórico global');
        await page.click('.tax-voltar-hg--rodape [data-tax="voltar-dominio"]');
        afirma(await page.locator('#taxHistoricoGlobal').count() === 0 && await page.locator('#taxAcoesGerais').isVisible(), '375 px: o Voltar do rodapé leva de volta à Integridade');
        await abaHG(page);
        afirma(await page.locator('#taxHgDetalhes').evaluate((d) => d.open), 'reabrir a aba: a lista continua como estava (aberta)');
      }
      if (!movel) { await page.click('.tax-voltar-hg--topo [data-tax="voltar-dominio"]'); afirma(await page.locator('#taxHistoricoGlobal').count() === 0 && await page.locator('#taxAcoesGerais').isVisible(), 'desktop: "Voltar à Integridade" no topo do histórico global'); }
      await T.voltarCatalogo(page);
      await aparece(page, '.tax-wrap');
      afirma(await page.locator('#taxHistoricoGlobal').count() === 0 && await page.locator('.tax-item[data-codigo="SQ"]').count() === 1, '"Voltar ao catálogo" restaura a lista de conceitos');
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
      await aparece(r.page, '.tax-item');
      await T.irIntegridade(r.page);
      await abaHG(r.page);
      await esperarCondicao(r.page, () => document.querySelectorAll('#taxHistoricoGlobal .tax-hg-item').length === 2, null, { limite: 4000, descricao: 'duas linhas de carga' });
      const ts = await linhasHG(r.page).allInnerTexts();
      const tOrg = ts.find((x) => /Organizacional/.test(x)) || '', tArq = ts.find((x) => /Arquitetural/.test(x)) || '';
      afirma(/Carga inicial — Organizacional/.test(tOrg) && /5 conceitos \(1 com definição vigente\), 4 atributos, 3 valores de perfil, 2 relações/.test(tOrg), 'Organizacional: título por domínio e a contagem registrada do próprio domínio', tOrg.replace(/\s+/g, ' '));
      afirma(/Carga inicial — Arquitetural/.test(tArq) && /2 conceitos \(0 com definição vigente\)/.test(tArq) && !/atributos/.test(tArq), 'Arquitetural: só a contagem do Arquitetural', tArq.replace(/\s+/g, ' '));
      afirma(!/Hoje o domínio tem|não registrada/.test(ts.join(' ')), 'formato atual: nada de contagem "de hoje" nem aviso de registro antigo');
      afirma(await larguraOk(r.page), 'sem rolagem horizontal');
      await r.ctx.close();
    }

    console.log('\n== H3. Modo somente leitura: sem histórico global (auditoria é só de admin) ==');
    {
      const { ctx, page } = await abrirHG(browser, viewport, 3, true);
      await page.evaluate(() => window.faTaxonomia.abrir({ somenteLeitura: true }));
      await aparece(page, '.tax-dominios');
      afirma(await page.locator('[data-tax="aba-historico"], #taxVerificacoesLink, #taxIntegridade').count() === 0 && await page.locator('.tax-dominios [role="tab"]').count() === 2, 'somente leitura: nem Integridade nem histórico global');
      await ctx.close();
    }
  }

  /* ---------- somente leitura: a definição é consulta, sem "ATUALIZAR DEFINIÇÃO" ---------- */
  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    console.log('\n== Somente leitura: definição e histórico sem ação de edição — ' + nomeTela + ' ==');
    const { ctx, page } = await abrirSq(browser, viewport);
    await page.evaluate(() => window.faTaxonomia.abrir({ somenteLeitura: true }));
    const nomeSq = (await banco(page)).taxonomia.organizacional.conceitos.SQ.nome;
    await esperarCondicao(page, (nome) => { const t = document.querySelector('.tax-ficha .tax-titulo'); return !!t && t.textContent.trim() === nome && !!document.getElementById('taxDefinicaoTexto'); }, nomeSq, { limite: 6000, descricao: 'ficha do SQ em modo leitura' });
    afirma(await telaSq(page) === SQ1, 'somente leitura: a definição vigente continua à vista no Catálogo');
    afirma(await page.locator('#taxAdministrarBtn, #taxAdmin, [data-tax="atualizar-definicao"], [data-tax="publicar-definicao"], #taxFormDefinicao, [data-tax="editar-conceito"]').count() === 0, 'somente leitura: sem "Administrar conceito", "Atualizar definição", formulário ou "Editar informações"');
    afirma(await larguraOk(page), 'sem rolagem horizontal');
    await ctx.close();
  }

  await browser.close();
  console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
