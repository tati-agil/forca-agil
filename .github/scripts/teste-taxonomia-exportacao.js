/* TAXONOMIA — exportação para revisão (Excel) e diagnóstico (JSON), Admin → Taxonomia, desktop e celular (375 px).
 * CONTEÚDO 100% FICTÍCIO. Firebase falso em persistência real; hermético (sem rede, sem segredo).
 *
 * O que se prova:
 *   1. Os dois botões aparecem para admin, cabem na tela (375 px também) e somem no modo somente leitura.
 *   2. JSON: cabeçalho (formato, versão, exportadoEm, exportadoPor) + o nó `taxonomia` EXATAMENTE como está no
 *      banco (lido ramo a ramo — a raiz não é legível em bloco nas regras) + `conceitosConsolidados` (lista plana,
 *      um item por conceito, com `dominio`): dados básicos, definição e fonte vigentes, fontes históricas,
 *      perfis, relações de saída e de entrada e o resumo da auditoria.
 *   3. Excel: a 1ª aba é "Visão consolidada por conceito" (uma linha por conceito, colunas da revisão), com
 *      cabeçalho congelado (+ 3 colunas fixas), autofiltro, larguras e quebra de linha — conferidos no XML do
 *      arquivo; depois, as abas de sempre (Conceitos, Fontes, Atributos, Perfis, Relações, Histórico) +
 *      "Exportação", com cabeçalhos em português e as linhas esperadas — inclusive uma fonte HISTÓRICA, uma
 *      ARQUIVADA, uma relação (de/tipo/para/nota) e o histórico de conceito e de domínio.
 *   Conceitos sempre localizados pelo CÓDIGO (nunca pelo nome).
 *   4. Só leitura: nenhuma escrita durante as exportações (window.__ESCRITAS) e o banco fica idêntico.
 *   5. Leitura que não responde (12 s em produção, encurtado aqui) ou que é recusada: erro VISÍVEL dizendo qual
 *      ramo falhou e que nada foi baixado — nenhum download, nunca silêncio. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarCondicao, esperarSessaoAssentada } = require('./esperas');
const { arquivoTemporario } = require('./arquivo-temporario');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const XLSX = require(path.join(__dirname, '..', '..', 'forca-agil', 'xlsx.mini.min.js'));
const EMAIL = 'adm@previ.com.br';
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const DESKTOP = { width: 1280, height: 900 };
const CELULAR = { width: 375, height: 800 };

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

const usr = { nome: 'Admin Fictício', email: EMAIL };
const TAXO = () => ({
  meta: { cargaInicial: { feitaEm: '2026-10-01T09:00:00.000Z', feitaPor: EMAIL, resumo: { conceitos: 3, fontes: 4, atributos: 1, perfis: 1, relacoes: 1, vigentes: 2 } } },
  organizacional: {
    conceitos: {
      LINHA: { nome: 'Linha Fictícia', camada: 'A', ordem: 1, ativo: true, situacaoDefinicao: 'ainda não registrada', atualizadoEm: '2026-10-01T09:00:00.000Z', atualizadoPor: EMAIL },
      SQ: { nome: 'Squad Fictício', camada: 'B', pai: 'LINHA', ordem: 2, ativo: true, situacaoDefinicao: 'registrada', definicaoVigenteFonteId: 'f1',
        criterios: { k1: { texto: 'Critério fictício 1', ordem: 1 }, k2: { texto: 'Critério fictício 2', ordem: 2 } }, observacoes: 'Observação fictícia.', perguntaDiscriminadora: 'Pergunta fictícia?', notaDeAplicacao: 'Nota fictícia.',
        atualizadoEm: '2026-10-02T10:00:00.000Z', atualizadoPor: EMAIL }
    },
    fontes: { SQ: {
      f1: { texto: 'Definição fictícia vigente do Squad.', contexto: 'PREVI', situacao: 'vigente', tipoRedacao: 'Conceito', rotulo: 'Conceito PREVI', criadoEm: '2026-10-01T09:00:00.000Z', criadoPor: EMAIL },
      f2: { texto: 'Redação fictícia antiga do Squad.', contexto: 'BB', situacao: 'histórica/contextual', tipoRedacao: 'Significado v1', rotulo: 'Versão BB', criadoEm: '2026-10-01T09:00:01.000Z', criadoPor: EMAIL },
      f3: { texto: 'Redação fictícia descartada.', contexto: 'indefinido', situacao: 'em validação', tipoRedacao: 'proposta', criadoEm: '2026-10-01T09:00:02.000Z', criadoPor: EMAIL,
        arquivada: true, arquivamento: { motivo: 'redação superada', justificativa: 'Substituída pela f1.', em: '2026-10-02T11:00:00.000Z', por: EMAIL } }
    } },
    atributos: { ALCANCE: { nome: 'Alcance de atuação', grupo: 'alcance', tipoValor: 'lista', ordem: 1, ativo: true, valoresPermitidos: { v1: { texto: 'específica', ordem: 1 }, v2: { texto: 'transversal', ordem: 2 } } } },
    perfis: { SQ: { ALCANCE: { estado: 'registrado', valor: 'transversal', papel: 'típico', origem: 'decisão', atualizadoEm: '2026-10-02T10:00:00.000Z' } } },
    relacoes: { SQ__compoe__LINHA: { de: 'SQ', tipo: 'compoe', para: 'LINHA', nota: 'Relação fictícia de composição.' } },
    auditoria: {
      SQ: { '-P1': { tipo: 'definicao_vigente', conceito: 'SQ', campo: 'definição vigente', valorAnterior: 'Versão BB (BB)', valorNovo: 'Conceito PREVI (PREVI)', fonteAnteriorId: 'f2', fonteNovaId: 'f1', usuario: usr, dataHora: '2026-10-02T10:00:00.000Z' },
            '-P2': { tipo: 'fonte_arquivada', conceito: 'SQ', campo: 'fonte', valorAnterior: 'proposta (indefinido)', valorNovo: 'arquivada: redação superada', fonteId: 'f3', motivo: 'redação superada', usuario: usr, dataHora: '2026-10-02T11:00:00.000Z' } },
      _catalogo: { '-P0': { tipo: 'carga_inicial', campo: 'carga inicial', valorNovo: 'Importação única: 3 conceitos, 4 fontes', usuario: usr, dataHora: '2026-10-01T09:00:00.000Z' } }
    }
  },
  arquitetural: {
    conceitos: { componente: { nome: 'Componente', ordem: 1, ativo: true, situacaoDefinicao: 'registrada', definicaoVigenteFonteId: 'c1' } },
    fontes: { componente: { c1: { texto: 'Definição fictícia de componente.', contexto: 'PREVI', situacao: 'vigente', tipoRedacao: 'Conceito', criadoEm: '2026-10-01T09:00:00.000Z', criadoPor: EMAIL } } },
    auditoria: { _catalogo: { '-P0': { tipo: 'carga_inicial', campo: 'carga inicial', valorNovo: 'Importação única: 3 conceitos, 4 fontes', usuario: usr, dataHora: '2026-10-01T09:00:00.001Z' } } }
  }
});

async function abrir(browser, viewport, extra) {
  const adm = {}; adm[chave(EMAIL)] = { email: EMAIL, name: 'ADMIN' };
  const users = {}; users[chave(EMAIL)] = { name: 'ADMIN', email: EMAIL, area: 'INFOR' };
  const db = { 'fa-users': users, 'fa-admins': adm, 'fa-diretores': {}, 'fa-facilitadores': {}, eventos: {}, turmas: {}, 'turmas-interesse': {}, 'turmas-config': {}, 'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {}, taxonomia: TAXO() };
  const cfg = Object.assign({ db, user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true }, extra || {});
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  const downloads = [];
  page.on('download', (d) => downloads.push(d.suggestedFilename()));
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  await page.waitForSelector('.admin-tab-btn[data-panel="adminPanelTaxonomia"]', { state: 'visible', timeout: 12000 });
  await page.click('.admin-tab-btn[data-panel="adminPanelTaxonomia"]');
  await page.waitForSelector('.tax-item[data-codigo="SQ"]', { timeout: 8000 });
  return { ctx, page, erros, downloads };
}
async function baixar(page, seletor) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click(seletor)]);
  const arq = arquivoTemporario('tax-exportacao-', path.extname(dl.suggestedFilename()));
  await dl.saveAs(arq);
  const buf = fs.readFileSync(arq); fs.unlinkSync(arq);
  return { nome: dl.suggestedFilename(), buf };
}
/* JSON canônico (chaves em ordem) para comparar o exportado com o banco sem depender da ordem das chaves */
function canon(v) {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') { const o = {}; Object.keys(v).sort().forEach((k) => { o[k] = canon(v[k]); }); return o; }
  return v;
}
const igual = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const escritas = (page) => page.evaluate(() => (window.__ESCRITAS || []).length);
const taxDb = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal.taxonomia)));

(async () => {
  const browser = await chromium.launch();
  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    console.log('\n######## ' + nomeTela + ' ########');
    {
      const { ctx, page, erros, downloads } = await abrir(browser, viewport);
      console.log('\n== 1. Botões ==');
      afirma(await page.locator('#taxExportarExcel').isVisible() && await page.locator('#taxExportarJson').isVisible(), 'admin vê "Baixar Excel (revisão)" e "Baixar JSON (diagnóstico)"');
      afirma(await page.evaluate(() => ['#taxExportarExcel', '#taxExportarJson'].every((q) => { const r = document.querySelector(q).getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.right <= window.innerWidth + 1; })), 'os dois botões cabem na largura da tela');
      afirma(await larguraOk(page), 'sem rolagem horizontal');
      const antes = await taxDb(page);
      const e0 = await escritas(page);

      console.log('\n== 2. JSON (diagnóstico) ==');
      const j = await baixar(page, '#taxExportarJson');
      afirma(/^Taxonomia_exportacao_\d{4}-\d{2}-\d{2}\.json$/.test(j.nome), 'nome do arquivo: ' + j.nome);
      const doc = JSON.parse(j.buf.toString('utf8'));
      afirma(doc.formato === 'forca-agil/taxonomia-exportacao' && doc.versaoFormato === 1 && doc.exportadoPor && doc.exportadoPor.email === EMAIL && !isNaN(Date.parse(doc.exportadoEm)), 'cabeçalho: formato, versão 1, exportadoEm e exportadoPor');
      afirma(igual(doc.taxonomia, antes), 'o nó "taxonomia" exportado é EXATAMENTE o que está no banco (todos os ramos)');
      const CC = doc.conceitosConsolidados || [];
      const cc = (dom, cod) => CC.find((k) => k.dominio === dom && k.codigo === cod) || {};
      afirma(Array.isArray(CC) && CC.length === 3 && CC.every((k) => ['organizacional', 'arquitetural'].includes(k.dominio) && typeof k.codigo === 'string'), 'conceitosConsolidados: lista plana, UM item por conceito (3), cada um com dominio e codigo', JSON.stringify(CC.map((k) => k.dominio + '/' + k.codigo)));
      const ksq = cc('organizacional', 'SQ');
      afirma(ksq.nome === 'Squad Fictício' && ksq.ativo === true && ksq.camada === 'B' && ksq.pai && ksq.pai.codigo === 'LINHA' && ksq.situacaoDefinicao === 'registrada' && ksq.criterios.join('|') === 'Critério fictício 1|Critério fictício 2' && ksq.perguntaDiscriminadora === 'Pergunta fictícia?' && ksq.notaDeAplicacao === 'Nota fictícia.', 'consolidado SQ: dados básicos (nome, ativo, camada, pai, situação, critérios, pergunta, nota)');
      afirma(ksq.definicaoVigente && ksq.definicaoVigente.fonteId === 'f1' && ksq.definicaoVigente.texto === 'Definição fictícia vigente do Squad.' && ksq.fonteVigente && ksq.fonteVigente.id === 'f1' && ksq.fonteVigente.rotulo === 'Conceito PREVI' && ksq.fonteVigente.contexto === 'PREVI' && ksq.fonteVigente.tipoRedacao === 'Conceito', 'consolidado SQ: definição vigente e fonte vigente (id, rótulo, contexto, tipo)');
      afirma(ksq.fontesHistoricas.map((f) => f.id).join(',') === 'f2,f3' && ksq.fontesHistoricas.find((f) => f.id === 'f3').arquivada === true, 'consolidado SQ: fontes históricas = as não vigentes, inclusive a arquivada (f2, f3)');
      afirma(ksq.perfis.length === 1 && ksq.perfis[0].atributo === 'ALCANCE' && ksq.perfis[0].atributoNome === 'Alcance de atuação' && ksq.perfis[0].valor === 'transversal' && ksq.perfis[0].papel === 'típico' && ksq.perfis[0].origem === 'decisão', 'consolidado SQ: perfil (atributo, valor, papel, origem)');
      afirma(ksq.relacoesSaida.length === 1 && ksq.relacoesSaida[0].para === 'LINHA' && ksq.relacoesSaida[0].tipo === 'compoe' && ksq.relacoesEntrada.length === 0 && cc('organizacional', 'LINHA').relacoesEntrada.length === 1 && cc('organizacional', 'LINHA').relacoesEntrada[0].de === 'SQ', 'consolidado: relação SQ → LINHA é de SAÍDA no SQ e de ENTRADA na LINHA');
      afirma(ksq.auditoria.total === 2 && ksq.auditoria.porTipo.definicao_vigente === 1 && ksq.auditoria.porTipo.fonte_arquivada === 1 && ksq.auditoria.ultimaAlteracaoEm === '2026-10-02T11:00:00.000Z' && ksq.auditoria.ultimaAlteracaoPor === EMAIL, 'consolidado SQ: resumo da auditoria (total, por tipo, última alteração e autor)');
      afirma(cc('arquitetural', 'componente').definicaoVigente.fonteId === 'c1' && cc('arquitetural', 'componente').perfis.length === 0, 'consolidado: o conceito arquitetural está, com a sua definição');
      await page.waitForSelector('#taxExportarStatus', { timeout: 4000 });
      afirma(/JSON baixado/.test(await page.locator('#taxExportarStatus').innerText()), 'a tela confirma o download do JSON');

      console.log('\n== 3. Excel (revisão) ==');
      const x = await baixar(page, '#taxExportarExcel');
      afirma(/^Taxonomia_exportacao_\d{4}-\d{2}-\d{2}\.xlsx$/.test(x.nome), 'nome do arquivo: ' + x.nome);
      const wb = XLSX.read(x.buf, { type: 'buffer' });
      const aba = (n) => (wb.Sheets[n] ? XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' }) : null);
      afirma(['Exportação', 'Conceitos', 'Fontes', 'Atributos', 'Perfis', 'Relações', 'Histórico'].every((n) => wb.SheetNames.includes(n)), 'abas: Exportação, Conceitos, Fontes, Atributos, Perfis, Relações, Histórico', wb.SheetNames.join(', '));
      const linhaDe = (rows, col, val) => { const h = rows[0], i = h.indexOf(col); return rows.slice(1).map((r) => Object.fromEntries(h.map((k, n) => [k, r[n]]))).filter((r) => i >= 0 && r[col] === val); };
      /* ---- 1ª aba: visão consolidada por conceito ---- */
      const NOME_CONS = 'Visão consolidada por conceito';
      afirma(wb.SheetNames[0] === NOME_CONS && NOME_CONS.length <= 31, 'a PRIMEIRA aba é "' + NOME_CONS + '" (' + NOME_CONS.length + ' caracteres, limite do Excel: 31)', wb.SheetNames.join(', '));
      const V = aba(NOME_CONS);
      const COLS = ['Domínio', 'Código', 'Nome', 'Ativo', 'Situação da definição', 'Camada / especialização', 'Conceito pai', 'Definição vigente', 'ID da fonte vigente', 'Rótulo da fonte', 'Contexto', 'Tipo de redação', 'Critérios', 'Pergunta discriminadora', 'Observações', 'Nota de aplicação', 'Atributos / perfil', 'Relações de saída', 'Relações de entrada', 'Fontes históricas (qtd.)', 'Alterações (qtd.)', 'Atualizado em', 'Atualizado por'];
      afirma(JSON.stringify(V[0]) === JSON.stringify(COLS), 'consolidada: as 23 colunas, nesta ordem', V[0].join(' | '));
      afirma(V.length === 4 && new Set(V.slice(1).map((r) => r[0] + '/' + r[1])).size === 3, 'consolidada: UMA linha por conceito (3) + cabeçalho', String(V.length));
      const vsq = linhaDe(V, 'Código', 'SQ')[0] || {};
      afirma(vsq['Domínio'] === 'Organizacional' && vsq['Nome'] === 'Squad Fictício' && vsq['Ativo'] === 'Sim' && vsq['Situação da definição'] === 'Definição registrada' && vsq['Camada / especialização'] === 'Especialização' && vsq['Conceito pai'] === 'LINHA — Linha Fictícia', 'consolidada SQ: domínio, nome, ativo, situação, camada e pai');
      afirma(vsq['Definição vigente'] === 'Definição fictícia vigente do Squad.' && vsq['ID da fonte vigente'] === 'f1' && vsq['Rótulo da fonte'] === 'Conceito PREVI' && vsq['Contexto'] === 'PREVI' && vsq['Tipo de redação'] === 'Conceito', 'consolidada SQ: definição vigente, id, rótulo, contexto e tipo de redação da fonte');
      afirma(vsq['Critérios'] === 'Critério fictício 1\nCritério fictício 2' && vsq['Pergunta discriminadora'] === 'Pergunta fictícia?' && vsq['Observações'] === 'Observação fictícia.' && vsq['Nota de aplicação'] === 'Nota fictícia.', 'consolidada SQ: critérios (um por linha), pergunta, observações e nota de aplicação');
      afirma(vsq['Atributos / perfil'] === 'Alcance de atuação: transversal (típico · origem: decisão)' && vsq['Relações de saída'] === 'compõe → LINHA — Linha Fictícia (Relação fictícia de composição.)' && vsq['Relações de entrada'] === '', 'consolidada SQ: perfil e relações de saída (entrada vazia)', JSON.stringify([vsq['Atributos / perfil'], vsq['Relações de saída'], vsq['Relações de entrada']]));
      afirma(vsq['Fontes históricas (qtd.)'] === 2 && vsq['Alterações (qtd.)'] === 2 && vsq['Atualizado em'] === '2026-10-02T10:00:00.000Z' && vsq['Atualizado por'] === EMAIL, 'consolidada SQ: 2 fontes históricas, 2 alterações (números), atualizado em/por');
      afirma((linhaDe(V, 'Código', 'LINHA')[0] || {})['Relações de entrada'] === 'SQ — Squad Fictício compõe → este conceito (Relação fictícia de composição.)', 'consolidada LINHA: a relação aparece como de ENTRADA');
      const vco = linhaDe(V, 'Código', 'componente')[0] || {};
      afirma(vco['Domínio'] === 'Arquitetural' && vco['Camada / especialização'] === '' && vco['Definição vigente'] === 'Definição fictícia de componente.', 'consolidada: conceito arquitetural (sem camada) com a sua definição');
      /* usabilidade, conferida no XML gravado (a SheetJS sozinha não grava congelamento nem quebra de linha) */
      const zip = XLSX.CFB.read(x.buf, { type: 'buffer' });
      const xml = (cam) => { const f = XLSX.CFB.find(zip, cam); return f ? Buffer.from(f.content).toString('utf8') : ''; };
      const s1 = xml('/xl/worksheets/sheet1.xml'), est = xml('/xl/styles.xml');
      afirma(/<pane xSplit="3" ySplit="1" topLeftCell="D2" activePane="bottomRight" state="frozen"\/>/.test(s1), 'consolidada: cabeçalho congelado + 3 colunas fixas (Domínio, Código, Nome)');
      afirma(/<autoFilter ref="A1:W4"\/>/.test(s1), 'consolidada: autofiltro em todo o cabeçalho (A1:W4)');
      afirma(/<col min="8" max="8" width="[\d.]+" customWidth="1"\/>/.test(s1) && /<cols>/.test(s1), 'consolidada: larguras de coluna definidas');
      const xfs = (/<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/.exec(est) || [])[2] || '';
      const xfLista = xfs.match(/<xf [\s\S]*?(?:\/>|<\/xf>)/g) || [];
      const sCorpo = (/<c r="H2" s="(\d+)"/.exec(s1) || [])[1], sCab = (/<c r="A1" s="(\d+)"/.exec(s1) || [])[1];
      afirma(sCorpo !== undefined && /wrapText="1"/.test(xfLista[+sCorpo] || ''), 'consolidada: células com quebra de linha (wrapText no estilo aplicado)');
      afirma(sCab !== undefined && /wrapText="1"/.test(xfLista[+sCab] || '') && /applyFont="1"/.test(xfLista[+sCab] || ''), 'cabeçalho com estilo próprio (negrito, quebra de linha)');
      afirma(wb.SheetNames.slice(1).every((n, i) => /<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"\/>/.test(xml('/xl/worksheets/sheet' + (i + 2) + '.xml'))), 'as demais abas também com o cabeçalho congelado');
      const C = aba('Conceitos');
      afirma(['Domínio', 'Código', 'Nome', 'Camada / especialização', 'Pai (código)', 'Pai (nome)', 'Ativo', 'Situação da definição', 'Definição vigente (texto)', 'Fonte vigente (id)', 'Fonte vigente (rótulo)', 'Fonte vigente (contexto)', 'Fonte vigente (tipo de redação)', 'Critérios', 'Observações', 'Pergunta discriminadora', 'Nota de aplicação', 'Criado em', 'Criado por', 'Atualizado em', 'Atualizado por'].every((h) => C[0].includes(h)), 'Conceitos: cabeçalhos em português', C[0].join(' | '));
      afirma(C.length === 4, 'Conceitos: 3 linhas (2 organizacionais + 1 arquitetural) + cabeçalho', String(C.length));
      const sq = linhaDe(C, 'Código', 'SQ')[0] || {};
      afirma(sq['Domínio'] === 'Organizacional' && sq['Nome'] === 'Squad Fictício' && sq['Camada / especialização'] === 'Especialização' && sq['Pai (código)'] === 'LINHA' && sq['Pai (nome)'] === 'Linha Fictícia' && sq['Ativo'] === 'Sim', 'Conceitos: SQ com domínio, camada, pai (código e nome) e ativo');
      afirma(sq['Situação da definição'] === 'Definição registrada' && sq['Definição vigente (texto)'] === 'Definição fictícia vigente do Squad.' && sq['Fonte vigente (id)'] === 'f1' && sq['Fonte vigente (rótulo)'] === 'Conceito PREVI' && sq['Fonte vigente (contexto)'] === 'PREVI' && sq['Fonte vigente (tipo de redação)'] === 'Conceito', 'Conceitos: definição vigente (texto, id, rótulo, contexto, tipo)');
      afirma(sq['Critérios'] === 'Critério fictício 1 | Critério fictício 2' && sq['Observações'] === 'Observação fictícia.' && sq['Pergunta discriminadora'] === 'Pergunta fictícia?' && sq['Nota de aplicação'] === 'Nota fictícia.' && sq['Atualizado por'] === EMAIL, 'Conceitos: critérios, observações, pergunta, nota e quem atualizou');
      afirma((linhaDe(C, 'Código', 'componente')[0] || {})['Domínio'] === 'Arquitetural', 'Conceitos: o conceito arquitetural está, com o seu domínio');
      const F = aba('Fontes');
      afirma(['Domínio', 'Conceito (código)', 'Fonte (id)', 'Situação', 'É a definição vigente', 'Arquivada', 'Rótulo', 'Contexto', 'Tipo de redação', 'Texto', 'Criada em', 'Criada por', 'Motivo do arquivamento', 'Justificativa do arquivamento', 'Arquivada em', 'Arquivada por'].every((h) => F[0].includes(h)), 'Fontes: cabeçalhos em português');
      afirma(F.length === 5, 'Fontes: TODAS as 4 fontes (vigente, histórica, arquivada e a arquitetural)', String(F.length));
      const f2 = linhaDe(F, 'Fonte (id)', 'f2')[0] || {};
      afirma(f2['Situação'] === 'histórica/contextual' && f2['É a definição vigente'] === 'Não' && f2['Texto'] === 'Redação fictícia antiga do Squad.' && f2['Contexto'] === 'BB' && f2['Tipo de redação'] === 'Significado v1' && f2['Rótulo'] === 'Versão BB' && f2['Criada por'] === EMAIL, 'Fontes: a HISTÓRICA (f2) com texto, contexto, tipo, rótulo e autoria');
      const f3 = linhaDe(F, 'Fonte (id)', 'f3')[0] || {};
      afirma(f3['Arquivada'] === 'Sim' && f3['Motivo do arquivamento'] === 'redação superada' && f3['Justificativa do arquivamento'] === 'Substituída pela f1.' && f3['Arquivada por'] === EMAIL, 'Fontes: a ARQUIVADA (f3) com motivo, justificativa e quem');
      afirma((linhaDe(F, 'Fonte (id)', 'f1')[0] || {})['É a definição vigente'] === 'Sim', 'Fontes: a vigente marcada como definição vigente');
      const A = aba('Atributos'), P = aba('Perfis'), R = aba('Relações'), H = aba('Histórico');
      afirma(A.length === 2 && (linhaDe(A, 'Código', 'ALCANCE')[0] || {})['Valores permitidos'] === 'específica | transversal', 'Atributos: o catálogo, com os valores permitidos');
      const p = linhaDe(P, 'Atributo (código)', 'ALCANCE')[0] || {};
      afirma(P.length === 2 && p['Conceito (código)'] === 'SQ' && p['Estado'] === 'registrado' && p['Valor'] === 'transversal' && p['Papel'] === 'típico' && p['Origem'] === 'decisão', 'Perfis: estado, valor, papel e origem');
      const rel = linhaDe(R, 'Relação (id)', 'SQ__compoe__LINHA')[0] || {};
      afirma(R.length === 2 && rel['De (código)'] === 'SQ' && rel['De (nome)'] === 'Squad Fictício' && rel['Tipo'] === 'compoe' && rel['Tipo (por extenso)'] === 'compõe' && rel['Para (código)'] === 'LINHA' && rel['Para (nome)'] === 'Linha Fictícia' && rel['Nota'] === 'Relação fictícia de composição.', 'Relações: de, tipo, para e nota (com os nomes)');
      afirma(['Domínio', 'Escopo (conceito)', 'Data/hora', 'Autor (nome)', 'Autor (e-mail)', 'Tipo', 'Campo', 'Valor anterior', 'Valor novo'].every((h) => H[0].includes(h)) && H.length === 5, 'Histórico: cabeçalhos e as 4 linhas (2 do conceito + carga de cada domínio)', String(H.length));
      const hv = linhaDe(H, 'Tipo', 'definicao_vigente')[0] || {};
      afirma(hv['Escopo (conceito)'] === 'SQ' && hv['Valor anterior'] === 'Versão BB (BB)' && hv['Valor novo'] === 'Conceito PREVI (PREVI)' && hv['Autor (e-mail)'] === EMAIL && /fonteAnteriorId/.test(hv['Detalhes']), 'Histórico: evento do conceito com anterior → novo, autor e detalhes');
      afirma(linhaDe(H, 'Tipo', 'carga_inicial').length === 2 && linhaDe(H, 'Tipo', 'carga_inicial').every((r) => r['Escopo (conceito)'] === '(domínio inteiro)'), 'Histórico: a carga de cada domínio, com escopo "domínio inteiro"');
      const S = aba('Exportação');
      afirma(S.some((r) => r[0] === 'Exportado por' && new RegExp(EMAIL.replace('.', '\\.')).test(r[1])) && S.some((r) => r[0] === 'Carga inicial feita em' && r[1] === '2026-10-01T09:00:00.000Z'), 'aba Exportação: quem exportou e a meta da carga inicial');
      await esperarCondicao(page, () => /Excel baixado/.test((document.querySelector('#taxExportarStatus') || {}).innerText || ''), null, { limite: 6000, descricao: 'confirmação do Excel' });
      afirma(!/Atenção/.test(await page.locator('#taxExportarStatus').innerText()), 'o ajuste da planilha (congelar/quebrar) não falhou: sem aviso de "Atenção"');

      console.log('\n== 4. Só leitura ==');
      afirma(await escritas(page) === e0, 'nenhuma escrita durante as exportações (' + ((await escritas(page)) - e0) + ')');
      afirma(igual(await taxDb(page), antes), 'o banco continua idêntico');
      afirma(downloads.length === 2, 'exatamente dois downloads');
      afirma(await larguraOk(page), 'sem rolagem horizontal');
      afirma(erros.length === 0, 'sem erros de JavaScript (' + erros.length + ')');
      await ctx.close();
    }
    {
      console.log('\n== 5. Leitura que não responde: erro visível, nada baixado ==');
      const { ctx, page, downloads } = await abrir(browser, viewport);
      await page.evaluate(() => { window.faTaxonomia._interno.espera.leitura = 1500; window.__CFG.delays = { 'taxonomia/organizacional/fontes': 600000 }; });
      const e0 = await escritas(page);
      await page.click('#taxExportarExcel');
      afirma(/Lendo a Taxonomia/.test(await page.locator('#taxExportarStatus').innerText()) && await page.locator('#taxExportarExcel').isDisabled(), 'enquanto lê: "Lendo a Taxonomia inteira…" e os botões travados (sem clique repetido)');
      await page.waitForSelector('#taxExportarStatus.tax-aviso-erro', { timeout: 6000 });
      const t = await page.locator('#taxExportarStatus').innerText();
      afirma(/Nada foi baixado/.test(t) && /organizacional\/fontes/.test(t) && /não respondeu/.test(t), 'erro visível: diz QUAL ramo não respondeu e que nada foi baixado', t);
      afirma(await page.locator('#taxExportarStatus[role="alert"]').count() === 1 && await page.locator('#taxExportarExcel').isEnabled(), 'o erro é anunciado (role=alert) e dá para tentar de novo');
      afirma(downloads.length === 0 && await escritas(page) === e0, 'nenhum download e nenhuma escrita');
      afirma(await larguraOk(page), 'aviso aberto: sem rolagem horizontal');
      await page.evaluate(() => { window.__CFG.delays = {}; window.__CFG.fail = ['taxonomia/arquitetural/auditoria']; });
      await page.click('#taxExportarJson');
      await esperarCondicao(page, () => /sem acesso/.test((document.querySelector('#taxExportarStatus.tax-aviso-erro') || {}).innerText || ''), null, { limite: 6000, descricao: 'erro de leitura recusada' });
      afirma(/arquitetural\/auditoria \(sem acesso\)/.test(await page.locator('#taxExportarStatus').innerText()) && downloads.length === 0, 'leitura recusada (PERMISSION_DENIED): "sem acesso" no ramo certo, nenhum download');
      await page.evaluate(() => { window.__CFG.fail = []; });
      const j = await baixar(page, '#taxExportarJson');
      afirma(/\.json$/.test(j.nome) && downloads.length === 1, 'corrigida a causa, tentar de novo baixa o arquivo');
      await ctx.close();
    }
    {
      console.log('\n== 6. Somente leitura: sem exportação (a auditoria é só de admin) ==');
      const { ctx, page } = await abrir(browser, viewport);
      await page.evaluate(() => window.faTaxonomia.abrir({ somenteLeitura: true }));
      await page.waitForSelector('.tax-dominios', { timeout: 4000 });
      afirma(await page.locator('#taxExportar').count() === 0, 'modo somente leitura: os botões de exportação não aparecem');
      await ctx.close();
    }
  }
  await browser.close();
  console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
