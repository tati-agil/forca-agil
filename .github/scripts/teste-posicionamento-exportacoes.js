/* POSICIONAMENTO ORGANIZACIONAL — EXPORTAÇÕES na tela (PR G1): PDF individual e Excel. Desktop e celular 375 px.
 * Firebase falso em persistência real; hermético. O conteúdo é provado em detalhe no núcleo puro
 * (teste-posicionamento-exportacao-nucleo.js); aqui, os arquivos DE VERDADE que a pessoa baixa:
 *   1. Lista: "Exportar ▾" → "Excel — lista atual" (respeita o filtro) e "Excel — todas as avaliações"; o arquivo
 *      baixado tem as abas Resumo / Respostas O1–O9 / Histórico / Trilha, "Situação na exportação", datas como
 *      datas, acentos intactos, e o Histórico traz as versões do item mesmo fora do filtro;
 *   2. Ficha concluída (vigente e histórica): "📄 GERAR PDF" baixa um PDF com páginas e nenhuma em branco, com
 *      a Avaliação de Produto/Serviço EXATA (v1, mesmo com v2 e v3 do item), "Sem decisão registrada." no PR E,
 *      a decisão gravada e a trilha; rascunho e descartada não têm o botão;
 *   3. Decisões ainda carregando → exportar desabilitado ("Carregando…"); leitura das decisões recusada →
 *      exportar bloqueado com explicação (nunca "Sem decisão registrada" por engano);
 *   4. Auditoria recusada → o PDF e o Excel saem com "Trilha indisponível" e o resto correto;
 *   5. Perfil "Avaliação" exporta (só leitura);
 *   6. Sem rolagem horizontal; nenhum erro de JS; prints do menu e do botão (desktop e 375 px). */
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { esperarCondicao, esperarSessaoAssentada } = require('./esperas');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const XLSX = require(path.join(__dirname, '..', '..', 'forca-agil', 'xlsx.mini.min.js'));
const M = require(path.join(__dirname, '..', '..', 'forca-agil', 'motor-posicionamento.js'));
const ARQ = 'arquitetura@previ.com.br';
const AVAL = 'avaliacao@previ.com.br';
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const DESKTOP = { width: 1280, height: 900 };
const CELULAR = { width: 375, height: 800 };
const QUANDO = '2026-10-01T09:00:00.000Z';
const PRINTS = process.env.FA_PRINTS_DIR || null; /* opcional: onde salvar os prints do menu e do botão */
const NOME = 'Gestão de Crédito — Ação "Ônibus" São João';

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

const ORDEM_P = ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia', 'jornada', 'medicao', 'gestao',
  'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'];
function produto(id, nome, extra) {
  const r = {};
  ORDEM_P.forEach((q, i) => { r[q] = { valor: 'sim', justificativaAuto: 'interpretação', codigoPergunta: 'P' + (i + 1), textoPerguntaNaEpoca: 't', tituloNaEpoca: 't', questionnaireContentVersion: 1 }; });
  return Object.assign({ itemId: id, nome, descricao: '', publico: '', necessidade: '', observacoesGerais: '', status: 'concluido', resultadoAutomatico: 'produto', decisaoFinal: 'produto',
    camadaSugerida: { id: 'produto-principal', label: 'Produto/Serviço principal' }, respostas: r, justificativaAutomatica: 'j', criteriosEssenciaisFalhos: [], criteriosAtendidos: 5,
    motorVersionArquitetura: 1, questionnaireContentVersion: 1, excluido: false, criadoEm: QUANDO, atualizadoEm: QUANDO, versao: 1, responsavel: { name: 'Fulana', email: 'f@previ.com.br' } }, extra || {});
}
const outra = { name: 'Conceição Araújo', email: 'o@previ.com.br' };
function concluida(itemId, itemNome, versao, respostas, diagnosticos, extra) {
  const res = M.avaliar(respostas, diagnosticos || {}), ra = {};
  Object.keys(res).forEach((k) => { const v = res[k]; if (v !== null && !(Array.isArray(v) && !v.length)) ra[k] = v; });
  const reg = { itemId, itemNome, avaliacaoArquiteturalId: itemId, questionarioCodigo: 'POSICIONAMENTO_ORGANIZACIONAL', questionnaireContentVersion: 1, versao, status: 'concluido', revisao: 2,
    respostas: {}, resultadoAutomatico: ra, criadoPor: outra, criadoEm: QUANDO, atualizadoPor: outra, atualizadoEm: QUANDO, concluidoPor: outra, concluidoEm: QUANDO,
    auditoriaCriacaoId: 'ac', auditoriaConclusaoId: 'az' };
  Object.keys(respostas).forEach((q) => { reg.respostas[q] = { resposta: respostas[q], codigoPergunta: q, tituloNaEpoca: 'Título ' + q, textoPerguntaNaEpoca: 'Pergunta ' + q + ' — redação da época', questionnaireContentVersion: 1, dataResposta: QUANDO }; });
  if (diagnosticos) Object.keys(diagnosticos).forEach((n) => { reg.diagnosticos = reg.diagnosticos || {}; reg.diagnosticos[n] = { resposta: diagnosticos[n], papeis: ['AREA_ESPECIALIZADA', 'COE'], textoPerguntaNaEpoca: 'Mesma responsabilidade?', rotuloNaEpoca: 'Mesma responsabilidade', questionnaireContentVersion: 1, dataResposta: QUANDO }; });
  return Object.assign(reg, extra || {});
}
function semente(email) {
  const aut = {}; aut[chave(ARQ)] = { email: ARQ, tipo: 'avaliacao-arquitetura' }; aut[chave(AVAL)] = { email: AVAL, tipo: 'avaliacao' };
  const users = {}; users[chave(email)] = { name: 'Pessoa', email, area: 'INFOR' };
  const conceitos = {}, fontes = {};
  M.CODIGOS_FIRMES.concat(['LINHA', 'PLATAFORMA']).forEach((c, i) => {
    conceitos[c] = { nome: 'Tx ' + c, ordem: i + 1, ativo: true, situacaoDefinicao: 'registrada', camada: 'A', definicaoVigenteFonteId: 'f1' };
    fontes[c] = { f1: { texto: 'Definição de ' + c, contexto: 'PREVI', situacao: 'vigente', tipoRedacao: 'Conceito' } };
  });
  const AE = { O1: 'NAO', O2: 'SIM', O3: 'NAO' };
  return {
    'fa-users': users, 'fa-admins': {}, 'fa-diretores': {}, 'fa-facilitadores': {}, eventos: {}, turmas: {}, 'turmas-interesse': {}, 'turmas-config': {}, 'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {},
    'fa-avaliacao-autorizados': aut, 'avaliacoes-squad': {}, 'motor-squad-config': {},
    'avaliacoes-produto': {
      /* o item p1 tem Produto/Serviço v1 (p1), v2 e v3: o Posicionamento h2 está ligado à v1 */
      p1: produto('p1', NOME, { camadaSugerida: { id: 'produto-principal', label: 'Classificação da v1' } }),
      p1v2: produto('p1', NOME, { versao: 2, versaoAnteriorKey: 'p1', camadaSugerida: { id: 'componente', label: 'Classificação da v2' } }),
      p1v3: produto('p1', NOME, { versao: 3, versaoAnteriorKey: 'p1v2', camadaSugerida: { id: 'componente', label: 'Classificação da v3' } }),
      p2: produto('p2', 'Item Beta'), p3: produto('p3', 'Item Gama'), p4: produto('p4', 'Item Delta'), p5: produto('p5', 'Item Épsilon'), p6: produto('p6', 'Item Zeta')
    },
    'avaliacoes-posicionamento': {
      g1: concluida('p3', 'Item Gama', 1, { O1: 'NAO', O2: 'NAO', O3: 'SIM' }),
      h1: concluida('p1', NOME, 1, AE),
      h2: concluida('p1', NOME, 2, AE, null, { avaliacaoAnteriorId: 'h1', motivoReavaliacao: 'Revisão anual — atuação da área' }),
      a1: concluida('p2', 'Item Beta', 1, { O1: 'NAO', O2: 'SIM', O3: 'SIM' }, { N1: 'mesma' }),
      d1: concluida('p4', 'Item Delta', 1, { O1: 'SIM', O2: 'NAO', O3: 'NAO', O4: 'NAO', O5: 'SIM' }),
      x1: { itemId: 'p5', itemNome: 'Item Épsilon', avaliacaoArquiteturalId: 'p5', questionarioCodigo: 'POSICIONAMENTO_ORGANIZACIONAL', questionnaireContentVersion: 1, versao: 1, status: 'descartado', revisao: 2,
        motivoDescarte: 'Iniciada por engano', descartadoPor: outra, descartadoEm: QUANDO, criadoPor: outra, criadoEm: QUANDO, atualizadoPor: outra, atualizadoEm: QUANDO, auditoriaCriacaoId: 'x', auditoriaDescarteId: 'y' },
      r1: { itemId: 'p6', itemNome: 'Item Zeta', avaliacaoArquiteturalId: 'p6', questionarioCodigo: 'POSICIONAMENTO_ORGANIZACIONAL', questionnaireContentVersion: 1, versao: 1, status: 'rascunho', revisao: 1,
        criadoPor: outra, criadoEm: QUANDO, atualizadoPor: outra, atualizadoEm: QUANDO, auditoriaCriacaoId: 'r' }
    },
    'posicionamento-vigente-por-item': { p3: 'g1', p1: 'h2', p2: 'a1', p4: 'd1' },
    'posicionamento-rascunho-por-item': { p6: 'r1' },
    'posicionamento-decisoes': {
      h1: { itemId: 'p1', versaoAvaliacao: 1, versaoMotor: 1, codigoAutomatico: 'AREA_ESPECIALIZADA', codigoFinal: 'AREA_ESPECIALIZADA', tipoDecisao: 'CONFIRMACAO',
        nomeNaDecisao: { nome: 'Área Especializada', contingencia: false }, liberaSquad: false, decididoPor: outra, decididoEm: QUANDO, auditoriaId: 'd1' },
      a1: { itemId: 'p2', versaoAvaliacao: 1, versaoMotor: 1, codigoAutomatico: 'A_VALIDAR', tipoAValidarAutomatico: 'CONFLITO', codigoFinal: 'PLATAFORMA_CANAIS', tipoDecisao: 'RESOLUCAO_A_VALIDAR',
        justificativa: 'Decisão após reunião — atuação em canais', nomeNaDecisao: { nome: 'Plataforma de Canais', contingencia: false }, liberaSquad: true, decididoPor: outra, decididoEm: QUANDO, auditoriaId: 'd2' },
      d1: { itemId: 'p4', versaoAvaliacao: 1, versaoMotor: 1, codigoAutomatico: 'NEGOCIOS', codigoFinal: 'COE', tipoDecisao: 'DIVERGENCIA', justificativa: 'Referência técnica da organização',
        nomeNaDecisao: { nome: 'CoE (nome na decisão)', contingencia: false }, liberaSquad: false, decididoPor: outra, decididoEm: QUANDO, auditoriaId: 'd3' }
    },
    'posicionamento-auditoria': {
      h2: { e1: { tipo: 'criacao', itemId: 'p1', avaliacaoAnteriorId: 'h1', motivo: 'Revisão anual — atuação da área', usuario: outra, dataHora: '2026-10-01T09:00:00.000Z' },
            e2: { tipo: 'conclusao', itemId: 'p1', codigoResultado: 'AREA_ESPECIALIZADA', regra: 'N1_AREA_ESPECIALIZADA', versaoMotor: 1, liberaSquad: false, vigenteAnterior: 'h1', usuario: outra, dataHora: '2026-10-01T10:00:00.000Z' } }
    },
    taxonomia: { organizacional: { conceitos, fontes } }
  };
}
async function abrir(browser, viewport, opts) {
  opts = opts || {};
  const email = opts.email || ARQ;
  const cfg = { db: semente(email), user: { email, emailVerified: true, uid: 'u-' + chave(email) }, delayDefault: 10, persistenciaReal: true, delays: opts.delays || {}, fail: opts.fail || [] };
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  /* os blocos do PDF, como texto, antes de virarem imagem (mesma captura de teste-squad-exportacoes.js) */
  await ctx.addInitScript(`
    window.__blocos = [];
    new MutationObserver(function (ms) { ms.forEach(function (m) { m.addedNodes.forEach(function (n) {
      if (n.nodeType !== 1 || n.parentNode !== document.body) return;
      var doc = n.classList && n.classList.contains('pdf-doc') ? n : (n.querySelector && n.querySelector('.pdf-doc'));
      if (doc && !doc.__visto) { doc.__visto = true; var t = doc.innerText; if (!window.__blocos.some(function (b) { return b.texto === t; })) window.__blocos.push({ texto: t }); }
    }); }); }).observe(document, { childList: true, subtree: true });`);
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + (opts.hash || '#avaliacoes?po=lista'), { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
async function baixar(page, seletor) {
  await page.evaluate(() => { window.__blocos = []; });
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.click(seletor)]);
  const arq = path.join(os.tmpdir(), 'po-' + Date.now() + '-' + Math.random().toString(36).slice(2) + path.extname(dl.suggestedFilename()));
  await dl.saveAs(arq);
  const buf = fs.readFileSync(arq); fs.unlinkSync(arq);
  const blocos = await page.evaluate(() => window.__blocos.map((b) => b.texto));
  return { nome: dl.suggestedFilename(), buf, texto: blocos.join('\n') };
}
const abas = (buf) => { const wb = XLSX.read(buf, { type: 'buffer', cellDates: true }); const o = {}; wb.SheetNames.forEach((n) => { o[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' }); }); return { nomes: wb.SheetNames, o }; };
const coluna = (linhas, nome) => linhas[0].indexOf(nome);
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const existe = (page, sel) => page.evaluate((s) => !!document.querySelector(s), sel);
const texto = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.innerText : ''; }, sel);
const ir = (page, h) => page.evaluate((x) => { location.hash = x; }, h);
async function prontoParaClicar(page, sel) { await esperarCondicao(page, (s) => { const b = document.querySelector(s); return !!b && !b.disabled; }, sel, { descricao: sel + ' habilitado', limite: 10000 }); }

/* páginas do PDF e quanto de cada uma NÃO é branco (o próprio Chromium decodifica a imagem) */
function imagensDoPdf(buf) {
  const txt = buf.toString('latin1'), paginas = (txt.match(/\/Type\s*\/Page(?![s])/g) || []).length, imgs = [];
  const re = /\/Filter\s*\/DCTDecode/g; let m;
  while ((m = re.exec(txt))) {
    let ini = txt.indexOf('stream', m.index); if (ini < 0) continue;
    ini += 6; if (txt[ini] === '\r') ini++; if (txt[ini] === '\n') ini++;
    imgs.push(buf.subarray(ini, txt.indexOf('endstream', ini)).toString('base64'));
  }
  return { paginas, imgs };
}
async function tinta(page, b64) {
  return page.evaluate(async (b64) => {
    const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const bmp = await createImageBitmap(new Blob([u], { type: 'image/jpeg' }));
    const c = document.createElement('canvas'); c.width = Math.min(bmp.width, 400); c.height = Math.min(bmp.height, 600);
    const g = c.getContext('2d'); g.drawImage(bmp, 0, 0, c.width, c.height);
    const d = g.getImageData(0, 0, c.width, c.height).data; let t = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 235 || d[i + 1] < 235 || d[i + 2] < 235) t++;
    return t / (d.length / 4);
  }, b64);
}
async function semPaginaEmBranco(page, buf) {
  const { paginas, imgs } = imagensDoPdf(buf);
  const t = []; for (const i of imgs) t.push(await tinta(page, i));
  return { paginas, ok: paginas > 0 && imgs.length > 0 && t.every((x) => x > 0.002) };
}

async function fluxo(browser, nomeTela, viewport) {
  console.log('\n######## ' + nomeTela + ' — lista, Excel e PDF ########');
  const { ctx, page, erros } = await abrir(browser, viewport);
  const sufixo = viewport.width < 641 ? '375' : 'desktop';

  console.log('\n== 1. Excel ==');
  await prontoParaClicar(page, '#poExportarBtn');
  await page.click('#poExportarBtn');
  await page.waitForSelector('#poExportarMenu');
  afirma(/Excel — lista atual \(5\)/i.test(await texto(page, '#poExportarMenu')) && /Excel — todas as avaliações \(7\)/i.test(await texto(page, '#poExportarMenu')), 'menu: lista atual (5: vigentes e em andamento) e todas (7)', await texto(page, '#poExportarMenu'));
  afirma(await larguraOk(page), 'menu aberto sem rolagem horizontal');
  if (PRINTS) await page.screenshot({ path: path.join(PRINTS, 'menu-exportar-' + sufixo + '.png'), fullPage: false });
  const lista = await baixar(page, '#poExportarExcelLista');
  const L = abas(lista.buf);
  afirma(/^Posicionamentos_Organizacionais_Lista_atual_\d{4}-\d{2}-\d{2}\.xlsx$/.test(lista.nome), 'arquivo ' + lista.nome);
  afirma(JSON.stringify(L.nomes) === JSON.stringify(['Resumo', 'Respostas O1–O9', 'Histórico', 'Trilha']), 'abas Resumo / Respostas O1–O9 / Histórico / Trilha', JSON.stringify(L.nomes));
  const R = L.o.Resumo, cId = coluna(R, 'ID da avaliação');
  afirma(R.slice(1).map((l) => l[cId]).sort().join() === 'a1,d1,g1,h2,r1', 'lista atual: exatamente as 5 que a tela mostra (sem a histórica h1 nem a descartada x1)', R.slice(1).map((l) => l[cId]).join());
  afirma(coluna(R, 'Situação na exportação') !== -1, 'coluna "Situação na exportação"');
  const linhaH2 = R.find((l) => l[cId] === 'h2');
  afirma(linhaH2 && linhaH2[coluna(R, 'Item')] === NOME, 'acentos e aspas intactos no Excel', linhaH2 && linhaH2[coluna(R, 'Item')]);
  afirma(linhaH2 && linhaH2[coluna(R, 'ID da Avaliação de Produto/Serviço usada')] === 'p1' && /· v1 ·/.test(linhaH2[coluna(R, 'Avaliação de Produto/Serviço usada')]), 'Produto/Serviço usado: exatamente p1 (v1), não a v3');
  afirma(linhaH2 && linhaH2[coluna(R, 'Decisão final')] === 'Sem decisão registrada', 'h2 vigente sem decisão: "Sem decisão registrada"');
  afirma(linhaH2 && linhaH2[coluna(R, 'Criado em')] instanceof Date, 'datas como datas');
  const H = L.o.Histórico, cHid = coluna(H, 'ID da avaliação');
  afirma(H.slice(1).some((l) => l[cHid] === 'h1') && H.slice(1).some((l) => l[cHid] === 'h2'), 'Histórico traz a v1 (h1) do item, fora do filtro');
  const T = L.o.Trilha;
  afirma(T.slice(1).some((l) => l[coluna(T, 'Evento')] === 'Conclusão' && l[coluna(T, 'Avaliação anterior / vigente anterior')] === 'h1'), 'Trilha com a conclusão de h2 (vigente anterior h1)');
  await prontoParaClicar(page, '#poExportarBtn');
  await page.click('#poExportarBtn');
  await page.waitForSelector('#poExportarExcelTodas');
  const todas = await baixar(page, '#poExportarExcelTodas');
  const Tz = abas(todas.buf).o.Resumo;
  afirma(Tz.length - 1 === 7 && /_Todas_/.test(todas.nome), 'todas: 7 linhas (inclui histórica, descartada e rascunho)');
  const sit = (id) => (Tz.find((l) => l[coluna(Tz, 'ID da avaliação')] === id) || [])[coluna(Tz, 'Situação na exportação')];
  afirma(sit('h1') === 'Histórica' && sit('x1') === 'Descartada' && sit('r1') === 'Rascunho', 'situações na exportação');
  afirma(/Arquivo gerado com sucesso/.test(await texto(page, '#poExportarStatus')), 'aviso "Arquivo gerado com sucesso."');

  console.log('\n== 2. PDF ==');
  await ir(page, '#avaliacoes?po=h2');
  await page.waitForSelector('#poResultado');
  await prontoParaClicar(page, '#poGerarPdfBtn');
  if (PRINTS) await page.locator('.po-ficha-acoes').screenshot({ path: path.join(PRINTS, 'botao-pdf-' + sufixo + '.png') });
  afirma(await larguraOk(page), 'ficha com o botão sem rolagem horizontal');
  const p2 = await baixar(page, '#poGerarPdfBtn');
  afirma(/^Posicionamento_Organizacional_Gestao_de_Credito_Acao_Onibus_Sao_Joao_v2_\d{4}-\d{2}-\d{2}\.pdf$/.test(p2.nome), 'arquivo ' + p2.nome);
  const pg = await semPaginaEmBranco(page, p2.buf);
  afirma(pg.ok, 'PDF com ' + pg.paginas + ' página(s), nenhuma em branco');
  const t2 = p2.texto.replace(/\s+/g, ' ');
  afirma(/Situação na exportação\s*Vigente/.test(t2) && /Reavaliação da v1 \(ID h1\) — motivo: Revisão anual — atuação da área/.test(t2), 'PDF: vigente, reavaliação da v1 com motivo');
  afirma(new RegExp(NOME.replace(/[.*+?^${}()|[\]\\"]/g, '\\$&') + ' · v1 · Classificação da v1 · ID p1').test(t2), 'PDF: Avaliação de Produto/Serviço EXATA (v1, mesmo com v2 e v3)');
  afirma(/Decisão final\s*Sem decisão registrada\./.test(t2), 'PDF: "Sem decisão registrada."');
  afirma(/Iniciada como reavaliação da v1/.test(t2) && /passou a vigente no lugar da v1/.test(t2), 'PDF: trilha lida');
  afirma(/Respostas O1–O9/.test(t2) && /Pergunta O2 — redação da época/.test(t2), 'PDF: respostas com o texto da época');
  await ir(page, '#avaliacoes?po=h1');
  await page.waitForSelector('#poHistorica');
  await prontoParaClicar(page, '#poGerarPdfBtn');
  const p1 = await baixar(page, '#poGerarPdfBtn');
  const t1 = p1.texto.replace(/\s+/g, ' ');
  afirma(/Situação na exportação\s*Histórica/.test(t1) && /Confirmação da recomendação automática/.test(t1), 'histórica tem PDF, com a decisão dela');
  await ir(page, '#avaliacoes?po=a1');
  await page.waitForSelector('#poResultado');
  await prontoParaClicar(page, '#poGerarPdfBtn');
  const pa = (await baixar(page, '#poGerarPdfBtn')).texto.replace(/\s+/g, ' ');
  afirma(/A validar — conflito de posicionamento/.test(pa) && /Resolução do "A validar"/.test(pa) && /Decisão após reunião — atuação em canais/.test(pa) && /Pela decisão final, a Adequação à Squad \(S1–S8\) pode ser realizada/.test(pa),
    'RESOLUCAO_A_VALIDAR: recomendação, tipo, justificativa e efeito GRAVADO da decisão');
  await ir(page, '#avaliacoes?po=x1');
  await page.waitForSelector('#poDescartado');
  afirma(!(await existe(page, '#poGerarPdfBtn')), 'descartada: sem PDF');
  await ir(page, '#avaliacoes?po=r1');
  await page.waitForSelector('#poChecklist');
  afirma(!(await existe(page, '#poGerarPdfBtn')), 'rascunho: sem PDF');
  await ctx.close();
  afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')', erros.join(' | '));
}

async function leituras(browser, nomeTela, viewport) {
  console.log('\n######## ' + nomeTela + ' — decisões lentas/recusadas e trilha recusada ########');
  let { ctx, page, erros } = await abrir(browser, viewport, { hash: '#avaliacoes?po=h2', delays: { 'posicionamento-decisoes': 3500 } });
  await page.waitForSelector('#poGerarPdfBtn');
  afirma(await page.evaluate(() => { const b = document.querySelector('#poGerarPdfBtn'); return b.disabled && /carregando/i.test(b.innerText); }), 'decisões carregando: "Carregando…" e PDF desabilitado');
  await prontoParaClicar(page, '#poGerarPdfBtn');
  afirma(true, '…habilita quando as decisões chegam');
  await ctx.close();
  ({ ctx, page, erros } = await abrir(browser, viewport, { hash: '#avaliacoes?po=h2', fail: ['posicionamento-decisoes'] }));
  await page.waitForSelector('#poExportarBloqueado');
  afirma(await page.evaluate(() => document.querySelector('#poGerarPdfBtn').disabled) && /para não registrar "Sem decisão" por engano/.test(await texto(page, '#poExportarBloqueado')), 'decisões recusadas: PDF bloqueado, com explicação');
  await ir(page, '#avaliacoes?po=lista');
  await page.waitForSelector('#poExportarBtn');
  afirma(await page.evaluate(() => document.querySelector('#poExportarBtn').disabled) && await existe(page, '#poExportarBloqueado'), 'lista: Exportar bloqueado, com explicação');
  await ctx.close();
  afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
  ({ ctx, page, erros } = await abrir(browser, viewport, { hash: '#avaliacoes?po=h2', fail: ['posicionamento-auditoria'] }));
  await prontoParaClicar(page, '#poGerarPdfBtn');
  const p = (await baixar(page, '#poGerarPdfBtn')).texto.replace(/\s+/g, ' ');
  afirma(/Trilha indisponível/.test(p) && !/Nenhum evento registrado/.test(p) && /Sem decisão registrada\./.test(p) && /Respostas O1–O9/.test(p), 'auditoria recusada: PDF com "Trilha indisponível" e o resto completo');
  await ir(page, '#avaliacoes?po=lista');
  await prontoParaClicar(page, '#poExportarBtn');
  await page.click('#poExportarBtn');
  await page.waitForSelector('#poExportarExcelTodas');
  const x = abas((await baixar(page, '#poExportarExcelTodas')).buf).o;
  afirma(x.Trilha.length - 1 === 7 && x.Trilha.slice(1).every((l) => l[coluna(x.Trilha, 'Evento')] === 'Trilha indisponível') && x.Resumo.length - 1 === 7, 'auditoria recusada: Excel com "Trilha indisponível" por avaliação e Resumo completo');
  await ctx.close();
  afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
}

async function perfilAvaliacao(browser, nomeTela, viewport) {
  console.log('\n######## ' + nomeTela + ' — perfil "Avaliação" exporta (só leitura) ########');
  const { ctx, page, erros } = await abrir(browser, viewport, { email: AVAL, hash: '#avaliacoes?po=d1' });
  await prontoParaClicar(page, '#poGerarPdfBtn');
  const p = (await baixar(page, '#poGerarPdfBtn')).texto.replace(/\s+/g, ' ');
  afirma(/Divergência da recomendação automática/.test(p) && /CoE \(nome na decisão\)/.test(p) && /Referência técnica da organização/.test(p), 'perfil Avaliação: PDF da divergência (nome registrado na decisão, justificativa)');
  afirma(!(await existe(page, '#poDecisaoForm')) && !(await existe(page, '#poReavaliarBtn')), '…sem formulário de decisão nem Reavaliar');
  await ctx.close();
  afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
}

(async () => {
  const browser = await chromium.launch();
  for (const [nome, vp] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    await fluxo(browser, nome, vp);
    await leituras(browser, nome, vp);
    await perfilAvaliacao(browser, nome, vp);
  }
  await browser.close();
  console.log('\n============================\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
