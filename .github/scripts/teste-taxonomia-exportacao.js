/* TAXONOMIA — "Exportar Taxonomia" (Baixar Excel / Baixar JSON), Admin → Taxonomia, desktop e celular (375 px).
 * CONTEÚDO 100% FICTÍCIO. Firebase falso em persistência real; hermético (sem rede, sem segredo).
 * Modelo simplificado: cada conceito tem UMA definição vigente (conceitos/<c>/definicao) e o histórico imutável de
 * versões (definicoes/<c>/v<n>) — sem catálogo de fontes, situação, rótulo ou tipo de redação.
 *
 * O que se prova:
 *   1. Em Integridade e configurações › Dados e manutenção (nunca no Catálogo): título "Exportar Taxonomia", a descrição dos dois domínios e os dois botões ("Baixar Excel", "Baixar JSON",
 *      sem "(revisão)"/"(diagnóstico)"), que cabem na tela (375 px também) e somem no modo somente leitura.
 *   2. JSON: cabeçalho (formato, versão 2, exportadoEm, exportadoPor) + o nó `taxonomia` EXATAMENTE como está no
 *      banco (lido ramo a ramo) + `conceitosConsolidados` (um item por conceito, com `dominio`): dados básicos,
 *      definição vigente (texto, versão, publicação), histórico das versões, perfis, relações e auditoria.
 *   3. Excel: a 1ª aba é "Visão consolidada por conceito" (cabeçalho congelado + 3 colunas fixas, autofiltro,
 *      larguras e quebra de linha — conferidos no XML); depois Conceitos, Definições (uma linha por VERSÃO, a
 *      vigente marcada), Atributos, Perfis, Relações, Histórico e "Exportação". Nenhuma aba "Fontes".
 *   Conceitos sempre localizados pelo CÓDIGO (nunca pelo nome).
 *   4. Só leitura: nenhuma escrita durante as exportações (window.__ESCRITAS) e o banco fica idêntico.
 *   5. Leitura que não responde (12 s em produção, encurtado aqui) ou que é recusada: erro VISÍVEL dizendo qual
 *      ramo falhou e que nada foi baixado — nenhum download, nunca silêncio.
 *   Os dois domínios (Organizacional e Arquitetural) são exportados juntos, qualquer que seja a aba aberta. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarCondicao, esperarSessaoAssentada } = require('./esperas');
const T = require('./taxonomia-tela');
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
const D1 = { texto: 'Redação fictícia antiga do Squad.', versao: 1, publicadaEm: '2026-10-01T09:00:00.000Z', publicadaPor: EMAIL };
const D2 = { texto: 'Definição fictícia vigente do Squad.', versao: 2, publicadaEm: '2026-10-02T10:00:00.000Z', publicadaPor: EMAIL };
const DC = { texto: 'Definição fictícia de componente.', versao: 1, publicadaEm: '2026-10-01T09:00:00.000Z', publicadaPor: EMAIL };
const TAXO = () => ({
  meta: { cargaInicial: { feitaEm: '2026-10-01T09:00:00.000Z', feitaPor: EMAIL, resumo: { conceitos: 3, atributos: 1, perfis: 1, relacoes: 1, vigentes: 2 } } },
  organizacional: {
    conceitos: {
      LINHA: { nome: 'Linha Fictícia', camada: 'A', ordem: 1, ativo: true, atualizadoEm: '2026-10-01T09:00:00.000Z', atualizadoPor: EMAIL },
      SQ: { nome: 'Squad Fictício', camada: 'B', pai: 'LINHA', ordem: 2, ativo: true, definicao: D2,
        criterios: { k1: { texto: 'Critério fictício 1', ordem: 1 }, k2: { texto: 'Critério fictício 2', ordem: 2 } }, observacoes: 'Observação fictícia.', perguntaDiscriminadora: 'Pergunta fictícia?', notaDeAplicacao: 'Nota fictícia.',
        atualizadoEm: '2026-10-02T10:00:00.000Z', atualizadoPor: EMAIL }
    },
    definicoes: { SQ: {
      v1: Object.assign({ origem: 'carga-inicial' }, D1),
      v2: Object.assign({ origem: 'publicacao', motivo: 'Redação fictícia revisada.' }, D2)
    } },
    atributos: { ALCANCE: { nome: 'Alcance de atuação', grupo: 'alcance', tipoValor: 'lista', ordem: 1, ativo: true, valoresPermitidos: { v1: { texto: 'específica', ordem: 1 }, v2: { texto: 'transversal', ordem: 2 } } } },
    perfis: { SQ: { ALCANCE: { estado: 'registrado', valor: 'transversal', papel: 'típico', origem: 'decisão', atualizadoEm: '2026-10-02T10:00:00.000Z' } } },
    relacoes: { SQ__compoe__LINHA: { de: 'SQ', tipo: 'compoe', para: 'LINHA', nota: 'Relação fictícia de composição.' } },
    auditoria: {
      SQ: { '-P1': { tipo: 'definicao_publicada', conceito: 'SQ', campo: 'definição', valorAnterior: D1.texto, valorNovo: D2.texto, versao: 2, motivo: 'Redação fictícia revisada.', usuario: usr, dataHora: '2026-10-02T10:00:00.000Z' },
            '-P2': { tipo: 'alteracao', conceito: 'SQ', campo: 'observações', valorAnterior: '', valorNovo: 'Observação fictícia.', usuario: usr, dataHora: '2026-10-02T11:00:00.000Z' } },
      _catalogo: { '-P0': { tipo: 'carga_inicial', campo: 'carga inicial', valorNovo: 'Importação única: 3 conceitos', usuario: usr, dataHora: '2026-10-01T09:00:00.000Z' } }
    }
  },
  arquitetural: {
    conceitos: { componente: { nome: 'Componente', ordem: 1, ativo: true, definicao: DC } },
    definicoes: { componente: { v1: Object.assign({ origem: 'carga-inicial' }, DC) } },
    auditoria: { _catalogo: { '-P0': { tipo: 'carga_inicial', campo: 'carga inicial', valorNovo: 'Importação única: 1 conceito', usuario: usr, dataHora: '2026-10-01T09:00:00.001Z' } } }
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
  const noCatalogo = await page.locator('#taxExportar').count();
  await T.irIntegridade(page); /* exportar fica em Integridade e configurações › Dados e manutenção */
  return { ctx, page, erros, downloads, noCatalogo };
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
      const { ctx, page, erros, downloads, noCatalogo } = await abrir(browser, viewport);
      console.log('\n== 1. Botões ==');
      afirma(noCatalogo === 0 && await page.locator('#taxIntegridade #taxAcoesGerais #taxExportar').count() === 1, 'a exportação fica em Integridade › Dados e manutenção, nunca no Catálogo');
      afirma(await page.locator('#taxExportarExcel').isVisible() && await page.locator('#taxExportarJson').isVisible(), 'admin vê os dois botões de exportação');
      const rot = await page.evaluate(() => ['#taxExportarExcel', '#taxExportarJson'].map((q) => document.querySelector(q).textContent.trim()));
      afirma(/^baixar excel$/i.test(rot[0]) && /^baixar json$/i.test(rot[1]), 'rótulos exatos "Baixar Excel" e "Baixar JSON" (sem "(revisão)"/"(diagnóstico)")', rot.join(' / '));
      const caixa = await page.evaluate(() => { const c = document.getElementById('taxExportar'); return c ? c.textContent : ''; });
      afirma(/Exportar Taxonomia/.test(caixa) && /Baixe os dados da Taxonomia Organizacional e Arquitetural\./.test(caixa) && !/revisão|diagnóstico/i.test(caixa), 'título "Exportar Taxonomia" e a descrição dos dois domínios', caixa);
      afirma(await page.evaluate(() => ['#taxExportarExcel', '#taxExportarJson'].every((q) => { const r = document.querySelector(q).getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.right <= window.innerWidth + 1; })), 'os dois botões cabem na largura da tela');
      afirma(await larguraOk(page), 'sem rolagem horizontal');
      const antes = await taxDb(page);
      const e0 = await escritas(page);

      console.log('\n== 2. JSON ==');
      const j = await baixar(page, '#taxExportarJson');
      afirma(/^Taxonomia_exportacao_\d{4}-\d{2}-\d{2}\.json$/.test(j.nome), 'nome do arquivo: ' + j.nome);
      const doc = JSON.parse(j.buf.toString('utf8'));
      afirma(doc.formato === 'forca-agil/taxonomia-exportacao' && doc.versaoFormato === 2 && doc.exportadoPor && doc.exportadoPor.email === EMAIL && !isNaN(Date.parse(doc.exportadoEm)), 'cabeçalho: formato, versão 2 (modelo de definição única), exportadoEm e exportadoPor');
      afirma(igual(doc.taxonomia, antes), 'o nó "taxonomia" exportado é EXATAMENTE o que está no banco (todos os ramos)');
      afirma(doc.taxonomia.organizacional.definicoes && doc.taxonomia.arquitetural.definicoes && !doc.taxonomia.organizacional.fontes && !doc.taxonomia.arquitetural.fontes, 'os DOIS domínios vêm com o histórico de definições; nenhum ramo "fontes"');
      const CC = doc.conceitosConsolidados || [];
      const cc = (dom, cod) => CC.find((k) => k.dominio === dom && k.codigo === cod) || {};
      afirma(Array.isArray(CC) && CC.length === 3 && CC.every((k) => ['organizacional', 'arquitetural'].includes(k.dominio) && typeof k.codigo === 'string'), 'conceitosConsolidados: lista plana, UM item por conceito (3), cada um com dominio e codigo', JSON.stringify(CC.map((k) => k.dominio + '/' + k.codigo)));
      const ksq = cc('organizacional', 'SQ');
      afirma(ksq.nome === 'Squad Fictício' && ksq.ativo === true && ksq.camada === 'B' && ksq.pai && ksq.pai.codigo === 'LINHA' && ksq.criterios.join('|') === 'Critério fictício 1|Critério fictício 2' && ksq.perguntaDiscriminadora === 'Pergunta fictícia?' && !('situacaoDefinicao' in ksq), 'consolidado SQ: dados básicos (sem "situação da definição")');
      afirma(ksq.definicaoVigente && ksq.definicaoVigente.texto === D2.texto && ksq.definicaoVigente.versao === 2 && ksq.definicaoVigente.publicadaEm === D2.publicadaEm && ksq.definicaoVigente.publicadaPor === EMAIL && !('fonteVigente' in ksq) && !('fontesHistoricas' in ksq), 'consolidado SQ: definição vigente = texto, versão 2, publicada em/por; nada de fonte', JSON.stringify(ksq.definicaoVigente));
      afirma(ksq.historicoDefinicao.map((v) => v.versao).join(',') === '1,2' && ksq.historicoDefinicao[0].texto === D1.texto && ksq.historicoDefinicao[1].motivo === 'Redação fictícia revisada.' && ksq.integridadeDefinicao === null, 'consolidado SQ: histórico v1 → v2 (com o motivo) e integridade sem problema');
      afirma(ksq.perfis.length === 1 && ksq.perfis[0].atributo === 'ALCANCE' && ksq.perfis[0].atributoNome === 'Alcance de atuação' && ksq.perfis[0].valor === 'transversal' && ksq.perfis[0].papel === 'típico' && ksq.perfis[0].origem === 'decisão', 'consolidado SQ: perfil (atributo, valor, papel, origem)');
      afirma(ksq.relacoesSaida.length === 1 && ksq.relacoesSaida[0].para === 'LINHA' && ksq.relacoesSaida[0].tipo === 'compoe' && ksq.relacoesEntrada.length === 0 && cc('organizacional', 'LINHA').relacoesEntrada.length === 1 && cc('organizacional', 'LINHA').relacoesEntrada[0].de === 'SQ', 'consolidado: relação SQ → LINHA é de SAÍDA no SQ e de ENTRADA na LINHA');
      afirma(ksq.auditoria.total === 2 && ksq.auditoria.porTipo.definicao_publicada === 1 && ksq.auditoria.porTipo.alteracao === 1 && ksq.auditoria.ultimaAlteracaoEm === '2026-10-02T11:00:00.000Z' && ksq.auditoria.ultimaAlteracaoPor === EMAIL, 'consolidado SQ: resumo da auditoria (total, por tipo, última alteração e autor)');
      afirma(cc('arquitetural', 'componente').definicaoVigente.texto === DC.texto && cc('arquitetural', 'componente').historicoDefinicao.length === 1 && cc('arquitetural', 'componente').perfis.length === 0, 'consolidado: o conceito arquitetural está, com a sua definição e o seu histórico');
      afirma(cc('organizacional', 'LINHA').definicaoVigente === null && cc('organizacional', 'LINHA').historicoDefinicao.length === 0, 'consolidado: conceito sem definição → definicaoVigente null, histórico vazio');
      await page.waitForSelector('#taxExportarStatus', { timeout: 4000 });
      afirma(/JSON baixado/.test(await page.locator('#taxExportarStatus').innerText()), 'a tela confirma o download do JSON');

      console.log('\n== 3. Excel ==');
      const x = await baixar(page, '#taxExportarExcel');
      afirma(/^Taxonomia_exportacao_\d{4}-\d{2}-\d{2}\.xlsx$/.test(x.nome), 'nome do arquivo: ' + x.nome);
      const wb = XLSX.read(x.buf, { type: 'buffer' });
      const aba = (n) => (wb.Sheets[n] ? XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' }) : null);
      afirma(['Exportação', 'Conceitos', 'Definições', 'Atributos', 'Perfis', 'Relações', 'Histórico'].every((n) => wb.SheetNames.includes(n)) && !wb.SheetNames.includes('Fontes'), 'abas: Exportação, Conceitos, Definições, Atributos, Perfis, Relações, Histórico — sem "Fontes"', wb.SheetNames.join(', '));
      const linhaDe = (rows, col, val) => { const h = rows[0], i = h.indexOf(col); return rows.slice(1).map((r) => Object.fromEntries(h.map((k, n) => [k, r[n]]))).filter((r) => i >= 0 && r[col] === val); };
      /* ---- 1ª aba: visão consolidada por conceito ---- */
      const NOME_CONS = 'Visão consolidada por conceito';
      afirma(wb.SheetNames[0] === NOME_CONS && NOME_CONS.length <= 31, 'a PRIMEIRA aba é "' + NOME_CONS + '" (' + NOME_CONS.length + ' caracteres, limite do Excel: 31)', wb.SheetNames.join(', '));
      const V = aba(NOME_CONS);
      const COLS = ['Domínio', 'Código', 'Nome', 'Ativo', 'Camada / especialização', 'Conceito pai', 'Definição vigente', 'Versão da definição', 'Publicada em', 'Publicada por', 'Critérios', 'Pergunta discriminadora', 'Observações', 'Nota de aplicação', 'Atributos / perfil', 'Relações de saída', 'Relações de entrada', 'Versões da definição (qtd.)', 'Alterações (qtd.)', 'Atualizado em', 'Atualizado por'];
      afirma(JSON.stringify(V[0]) === JSON.stringify(COLS), 'consolidada: as 21 colunas, nesta ordem (sem situação, fonte, rótulo, contexto ou tipo de redação)', V[0].join(' | '));
      afirma(V.length === 4 && new Set(V.slice(1).map((r) => r[0] + '/' + r[1])).size === 3, 'consolidada: UMA linha por conceito (3) + cabeçalho', String(V.length));
      const vsq = linhaDe(V, 'Código', 'SQ')[0] || {};
      afirma(vsq['Domínio'] === 'Organizacional' && vsq['Nome'] === 'Squad Fictício' && vsq['Ativo'] === 'Sim' && vsq['Camada / especialização'] === 'Especialização' && vsq['Conceito pai'] === 'LINHA — Linha Fictícia', 'consolidada SQ: dados básicos');
      afirma(vsq['Definição vigente'] === D2.texto && vsq['Versão da definição'] === 2 && vsq['Publicada em'] === D2.publicadaEm && vsq['Publicada por'] === EMAIL, 'consolidada SQ: definição vigente, versão 2 e publicação');
      afirma(vsq['Critérios'] === 'Critério fictício 1\nCritério fictício 2' && vsq['Pergunta discriminadora'] === 'Pergunta fictícia?' && vsq['Observações'] === 'Observação fictícia.' && vsq['Nota de aplicação'] === 'Nota fictícia.', 'consolidada SQ: critérios (um por linha), pergunta, observações, nota');
      afirma(vsq['Atributos / perfil'] === 'Alcance de atuação: transversal (típico · origem: decisão)' && vsq['Relações de saída'] === 'compõe → LINHA — Linha Fictícia (Relação fictícia de composição.)' && vsq['Relações de entrada'] === '', 'consolidada SQ: perfil e relações');
      afirma(vsq['Versões da definição (qtd.)'] === 2 && vsq['Alterações (qtd.)'] === 2 && vsq['Atualizado em'] === '2026-10-02T10:00:00.000Z' && vsq['Atualizado por'] === EMAIL, 'consolidada SQ: 2 versões da definição, 2 alterações (números), atualizado em/por');
      afirma((linhaDe(V, 'Código', 'LINHA')[0] || {})['Relações de entrada'] === 'SQ — Squad Fictício compõe → este conceito (Relação fictícia de composição.)', 'consolidada LINHA: a relação aparece como de ENTRADA');
      const vco = linhaDe(V, 'Código', 'componente')[0] || {};
      afirma(vco['Domínio'] === 'Arquitetural' && vco['Camada / especialização'] === '' && vco['Definição vigente'] === 'Definição fictícia de componente.', 'consolidada: conceito arquitetural (sem camada) com a sua definição');
      /* usabilidade, conferida no XML gravado (a SheetJS sozinha não grava congelamento nem quebra de linha) */
      const zip = XLSX.CFB.read(x.buf, { type: 'buffer' });
      const xml = (cam) => { const f = XLSX.CFB.find(zip, cam); return f ? Buffer.from(f.content).toString('utf8') : ''; };
      const s1 = xml('/xl/worksheets/sheet1.xml'), est = xml('/xl/styles.xml');
      afirma(/<pane xSplit="3" ySplit="1" topLeftCell="D2" activePane="bottomRight" state="frozen"\/>/.test(s1), 'consolidada: cabeçalho congelado + 3 colunas fixas (Domínio, Código, Nome)');
      afirma(/<autoFilter ref="A1:U4"\/>/.test(s1), 'consolidada: autofiltro em todo o cabeçalho (A1:U4)');
      afirma(/<col min="8" max="8" width="[\d.]+" customWidth="1"\/>/.test(s1) && /<cols>/.test(s1), 'consolidada: larguras de coluna definidas');
      const xfs = (/<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/.exec(est) || [])[2] || '';
      const xfLista = xfs.match(/<xf [\s\S]*?(?:\/>|<\/xf>)/g) || [];
      const sCorpo = (/<c r="H2" s="(\d+)"/.exec(s1) || [])[1], sCab = (/<c r="A1" s="(\d+)"/.exec(s1) || [])[1];
      afirma(sCorpo !== undefined && /wrapText="1"/.test(xfLista[+sCorpo] || ''), 'consolidada: células com quebra de linha (wrapText no estilo aplicado)');
      afirma(sCab !== undefined && /wrapText="1"/.test(xfLista[+sCab] || '') && /applyFont="1"/.test(xfLista[+sCab] || ''), 'cabeçalho com estilo próprio (negrito, quebra de linha)');
      afirma(wb.SheetNames.slice(1).every((n, i) => /<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"\/>/.test(xml('/xl/worksheets/sheet' + (i + 2) + '.xml'))), 'as demais abas também com o cabeçalho congelado');
      const C = aba('Conceitos');
      afirma(JSON.stringify(C[0]) === JSON.stringify(['Domínio', 'Código', 'Nome', 'Camada / especialização', 'Pai (código)', 'Pai (nome)', 'Ativo', 'Definição vigente (texto)', 'Versão da definição', 'Publicada em', 'Publicada por', 'Versões no histórico', 'Ordem', 'Critérios', 'Observações', 'Pergunta discriminadora', 'Ordem da pergunta', 'Nota de aplicação', 'Criado em', 'Criado por', 'Atualizado em', 'Atualizado por', 'Integridade da definição']), 'Conceitos: cabeçalhos do modelo novo', C[0].join(' | '));
      afirma(C.length === 4, 'Conceitos: 3 linhas (2 organizacionais + 1 arquitetural) + cabeçalho', String(C.length));
      const sq = linhaDe(C, 'Código', 'SQ')[0] || {};
      afirma(sq['Domínio'] === 'Organizacional' && sq['Nome'] === 'Squad Fictício' && sq['Camada / especialização'] === 'Especialização' && sq['Pai (código)'] === 'LINHA' && sq['Pai (nome)'] === 'Linha Fictícia' && sq['Ativo'] === 'Sim', 'Conceitos: SQ com domínio, camada, pai e ativo');
      afirma(sq['Definição vigente (texto)'] === D2.texto && sq['Versão da definição'] === 2 && sq['Publicada por'] === EMAIL && sq['Versões no histórico'] === 2 && sq['Integridade da definição'] === '', 'Conceitos: SQ com definição vigente v2, 2 versões no histórico e integridade sem aviso');
      afirma(sq['Critérios'] === 'Critério fictício 1 | Critério fictício 2' && sq['Observações'] === 'Observação fictícia.' && sq['Pergunta discriminadora'] === 'Pergunta fictícia?' && sq['Nota de aplicação'] === 'Nota fictícia.', 'Conceitos: critérios, observações, pergunta e nota');
      afirma((linhaDe(C, 'Código', 'componente')[0] || {})['Domínio'] === 'Arquitetural' && (linhaDe(C, 'Código', 'LINHA')[0] || {})['Definição vigente (texto)'] === '', 'Conceitos: o arquitetural com o seu domínio; LINHA sem definição fica em branco');
      const F = aba('Definições');
      afirma(JSON.stringify(F[0]) === JSON.stringify(['Domínio', 'Conceito (código)', 'Conceito (nome)', 'Versão', 'É a vigente', 'Texto', 'Publicada em', 'Publicada por', 'Origem', 'Motivo']), 'Definições: cabeçalhos', F[0].join(' | '));
      afirma(F.length === 4, 'Definições: TODAS as 3 versões (SQ v1, SQ v2, componente v1) + cabeçalho', String(F.length));
      const dsq = linhaDe(F, 'Conceito (código)', 'SQ');
      afirma(dsq.length === 2 && dsq[0]['Versão'] === 1 && dsq[0]['É a vigente'] === 'Não' && dsq[0]['Texto'] === D1.texto && dsq[0]['Origem'] === 'carga inicial', 'Definições: SQ v1 (carga inicial), não vigente, com o texto preservado');
      afirma(dsq[1]['Versão'] === 2 && dsq[1]['É a vigente'] === 'Sim' && dsq[1]['Origem'] === 'publicação' && dsq[1]['Motivo'] === 'Redação fictícia revisada.' && dsq[1]['Publicada por'] === EMAIL, 'Definições: SQ v2 vigente, publicação com motivo e autor');
      afirma((linhaDe(F, 'Conceito (código)', 'componente')[0] || {})['Domínio'] === 'Arquitetural', 'Definições: o domínio arquitetural também');
      const A = aba('Atributos'), P = aba('Perfis'), R = aba('Relações'), H = aba('Histórico');
      afirma(A.length === 2 && (linhaDe(A, 'Código', 'ALCANCE')[0] || {})['Valores permitidos'] === 'específica | transversal', 'Atributos: o catálogo, com os valores permitidos');
      const p = linhaDe(P, 'Atributo (código)', 'ALCANCE')[0] || {};
      afirma(P.length === 2 && p['Conceito (código)'] === 'SQ' && p['Estado'] === 'registrado' && p['Valor'] === 'transversal' && p['Papel'] === 'típico' && p['Origem'] === 'decisão', 'Perfis: estado, valor, papel e origem');
      const rel = linhaDe(R, 'Relação (id)', 'SQ__compoe__LINHA')[0] || {};
      afirma(R.length === 2 && rel['De (código)'] === 'SQ' && rel['De (nome)'] === 'Squad Fictício' && rel['Tipo'] === 'compoe' && rel['Tipo (por extenso)'] === 'compõe' && rel['Para (código)'] === 'LINHA' && rel['Para (nome)'] === 'Linha Fictícia' && rel['Nota'] === 'Relação fictícia de composição.', 'Relações: de, tipo, para e nota (com os nomes)');
      afirma(['Domínio', 'Escopo (conceito)', 'Data/hora', 'Autor (nome)', 'Autor (e-mail)', 'Tipo', 'Campo', 'Valor anterior', 'Valor novo'].every((h) => H[0].includes(h)) && H.length === 5, 'Histórico: cabeçalhos e as 4 linhas (2 do conceito + carga de cada domínio)', String(H.length));
      const hv = linhaDe(H, 'Tipo', 'definicao_publicada')[0] || {};
      afirma(hv['Escopo (conceito)'] === 'SQ' && hv['Tipo (por extenso)'] !== '' && hv['Valor anterior'] === D1.texto && hv['Valor novo'] === D2.texto && hv['Autor (e-mail)'] === EMAIL && /"versao":2/.test(hv['Detalhes']) && /Redação fictícia revisada/.test(hv['Detalhes']), 'Histórico: a publicação da definição com anterior × nova, versão e motivo', JSON.stringify(hv));
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
      await page.evaluate(() => { window.faTaxonomia._interno.espera.leitura = 1500; window.__CFG.delays = { 'taxonomia/organizacional/definicoes': 600000 }; });
      const e0 = await escritas(page);
      await page.click('#taxExportarExcel');
      afirma(/Lendo a Taxonomia/.test(await page.locator('#taxExportarStatus').innerText()) && await page.locator('#taxExportarExcel').isDisabled(), 'enquanto lê: "Lendo a Taxonomia inteira…" e os botões travados (sem clique repetido)');
      await page.waitForSelector('#taxExportarStatus.tax-aviso-erro', { timeout: 6000 });
      const t = await page.locator('#taxExportarStatus').innerText();
      afirma(/Nada foi baixado/.test(t) && /organizacional\/definicoes/.test(t) && /não respondeu/.test(t), 'erro visível: diz QUAL ramo não respondeu e que nada foi baixado', t);
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
