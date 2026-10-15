/* Refinamento pós-homologação da #375 — Firebase falso em persistência real; hermético; dados 100% sintéticos (os
 * nomes imitam o caso homologado, mas nada vem da produção). Desktop e 375 px. Prova, pela interface:
 *   2. Apoio O7 × O9 coerente com as perguntas oficiais: diz que a O7 não exige entrega ao participante nem objeto
 *      previdenciário/financeiro; nenhum "Raramente"; nenhuma condição "valor ... aos participantes"; seis pontos a
 *      verificar; exemplos com evidências para os dois lados.
 *   3. Origem: análise ativa (link), análise EXCLUÍDA ("Originada da análise … (excluída)") na lista, na ficha e na
 *      avaliação O1–O9; registrada individualmente só quando comprovado; sem leitura das análises, "Origem não
 *      disponível agora" (nunca "registrada individualmente"). Avaliação concluída e rascunho intactos.
 *   4. "Entenda os tipos de estrutura antes de responder" desde o O1, sem responder nada: nomes e definições da
 *      Taxonomia, o apoio O7 × O9 dentro; nenhuma pergunta fora do caminho aparece; nenhuma resposta gravada.
 *   5. "O que verificar para responder" em O1–O3 (e O4–O5 quando aparecem).
 *   6. Exclusão: sem confirmação ou sem motivo, a mensagem aparece junto do botão, visível, com o campo destacado, e
 *      nada é excluído (modal da responsabilidade e formulário da análise).
 *   7. Links de origem com contraste (≥ 4,5:1), nunca o roxo padrão.
 *   8. Consequências da exclusão da análise: só as aplicáveis (retiradas × cadastros que continuam).
 *   375 px sem rolagem lateral. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const { semente, ARQ, AVAL, chave } = require('./semente-jornada');
const N = require(path.join(__dirname, '..', '..', 'forca-agil', 'analises-organizacionais-nucleo.js'));
const F = require(path.join(__dirname, '..', '..', 'forca-agil', 'analises-organizacionais-firebase.js'));

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const ADM = 'admin.geral@previ.com.br';
let falhas = 0, total = 0;
function afirma(c, msg, det) { total++; console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + (typeof det === 'string' ? det : JSON.stringify(det)) : '')); if (!c) falhas++; }
const GECON = 'Sintética — Gerência de Contabilidade e Controladoria';
const objeto = (nome) => ({ nome, descricao: nome, finalidade: nome, contexto: 'Cadastro simplificado: o nome e a finalidade repetem a descrição informada pela pessoa; nada foi inferido.', situacao: 'ativo', revisao: 1,
  criadoPor: { uid: 'u', email: ARQ }, criadoEm: 1791713600000, atualizadoPor: { uid: 'u', email: ARQ }, atualizadoEm: 1791713600000, auditoriaId: 'a' });
function porCaminho(db, p, v) { const ks = p.split('/'); let o = db; ks.slice(0, -1).forEach((k) => { o = o[k] = o[k] || {}; }); if (v === null) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = v; }
function sementePos(hab) {
  const db = semente();
  db['fa-admins'] = Object.assign({}, db['fa-admins'] || {}, { [chave(ADM)]: true });
  db['fa-users'][chave(ADM)] = { name: 'Admin', email: ADM, area: 'INFOR' };
  db['analises-organizacionais-config'] = { habilitacao: hab || 'LIBERADO_PARA_PERFIS_AUTORIZADOS' };
  Object.assign(db['objetos-organizacionais'], { oG1: objeto('Gerir a contabilidade gerencial (sintética)'), oG2: objeto('Gerir o processo contábil (sintética)'), oAt: objeto('Sintética — da análise ativa'), oInd: objeto('Sintética — registrada individualmente') });
  /* O1–O9 concluído de oG1 (cópia sintética de um concluído da semente) */
  db['avaliacoes-posicionamento'].gG1 = Object.assign(JSON.parse(JSON.stringify(db['avaliacoes-posicionamento'].gA)), { itemId: 'oG1', itemNome: 'Gerir a contabilidade gerencial (sintética)' });
  db['posicionamento-vigente-por-item'].oG1 = 'gG1';
  let n = 0;
  const op = (fn) => {
    const est = F.estadoDoBanco({ analises: db['analises-organizacionais'], propostas: db['analises-propostas'], aprovacoes: db['analises-aprovacoes'] });
    const r = fn(est, { operacaoId: 'op' + (++n), novoId: 'n' + n, usuario: { id: chave(ADM), email: ADM }, agora: 1791713600000 + n });
    if (!r.ok) throw new Error(JSON.stringify(r.erros));
    const w = F.payloadOperacao(r, { audId: 'ev' + n, usuario: { uid: chave(ADM), email: ADM }, agora: 1791713600000 + n });
    Object.keys(w).forEach((k) => porCaminho(db, k, w[k]));
  };
  /* análise que será excluída: 10 responsabilidades, 2 com cadastro (oG1 concluída, oG2 ainda sem O1–O9) */
  op((e, c) => N.criarAnalise(e, { nome: GECON, tipoEscopo: 'estrutura' }, Object.assign(c, { novoId: 'anG' })));
  for (let i = 1; i <= 10; i++) op((e, c) => N.definirRecorte(e, 'anG', { descricao: 'Sintética G' + i, separacao: { valor: 'nao' } }, Object.assign(c, { novoId: 'rG' + i })));
  op((e, c) => N.associarAtuacao(e, 'anG', 'rG1', 'oG1', c));
  op((e, c) => N.associarAtuacao(e, 'anG', 'rG2', 'oG2', c));
  /* análise ativa com um cadastro */
  op((e, c) => N.criarAnalise(e, { nome: 'Sintética — análise ativa', tipoEscopo: 'estrutura' }, Object.assign(c, { novoId: 'anA' })));
  op((e, c) => N.definirRecorte(e, 'anA', { descricao: 'Sintética — da análise ativa', separacao: { valor: 'nao' } }, Object.assign(c, { novoId: 'rA1' })));
  op((e, c) => N.associarAtuacao(e, 'anA', 'rA1', 'oAt', c));
  /* análise que fica para conferir a confirmação de exclusão (texto + cadastro) */
  op((e, c) => N.criarAnalise(e, { nome: 'Sintética — para conferir a exclusão', tipoEscopo: 'estrutura' }, Object.assign(c, { novoId: 'anC' })));
  op((e, c) => N.definirRecorte(e, 'anC', { descricao: 'Sintética C1', separacao: { valor: 'nao' } }, Object.assign(c, { novoId: 'rC1' })));
  op((e, c) => N.definirRecorte(e, 'anC', { descricao: 'Sintética C2', separacao: { valor: 'nao' } }, Object.assign(c, { novoId: 'rC2' })));
  db['objetos-organizacionais'].oC2 = objeto('Sintética C2');
  op((e, c) => N.associarAtuacao(e, 'anC', 'rC2', 'oC2', c));
  db['analises-por-objeto'] = { oG1: { analiseId: 'anG', recorteId: 'rG1' }, oG2: { analiseId: 'anG', recorteId: 'rG2' }, oAt: { analiseId: 'anA', recorteId: 'rA1' }, oC2: { analiseId: 'anC', recorteId: 'rC2' } };
  /* exclusão excepcional da análise G pelo núcleo + adaptador (como a homologação fez) */
  op((e, c) => N.excluirAnalise(e, 'anG', { motivo: 'teste' }, c));
  return db;
}
async function abrir(browser, viewport, hash, email, db) {
  const cfg = { db: db || sementePos(), user: { email, emailVerified: true, uid: 'u-' + chave(email) }, uidDoUsuario: true, prefixoChave: 'k' + (++abrir.n) + 'x', delayDefault: 10, persistenciaReal: true };
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + hash, { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
abrir.n = 0;
const esperar = (page, fn, arg) => esperarCondicao(page, fn, arg, { limite: 20000 });
const banco = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal)));
const texto = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent : ''; }, sel);
const existe = (page, sel) => page.evaluate((s) => !!document.querySelector(s), sel);
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const foto = async (page, nome) => { if (!process.env.FA_PRINTS) return; await page.screenshot({ path: path.join(process.env.FA_PRINTS, nome + '-' + page.viewportSize().width + '.png'), fullPage: true }); };
const ir = (page, hash) => page.evaluate((h) => { location.hash = h; }, hash);
const naTela = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e || e.hidden) return false; const r = e.getBoundingClientRect(); return r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight; }, sel);
/* contraste WCAG do texto do link contra o fundo efetivo */
const contraste = (page, sel) => page.evaluate((s) => {
  const e = document.querySelector(s); if (!e) return null;
  const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number);
  const lum = (c) => { const v = rgb(c).slice(0, 3).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  let fundo = null; for (let n = e; n; n = n.parentElement) { const b = getComputedStyle(n).backgroundColor; const a = rgb(b); if (a.length && (a.length < 4 || a[3] > 0.5)) { fundo = b; break; } }
  if (!fundo) fundo = 'rgb(6,10,22)';
  const c = getComputedStyle(e).color, l1 = lum(c), l2 = lum(fundo);
  return { cor: c, razao: (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05) };
}, sel);

async function jornada(browser, viewport, rotulo) {
  console.log('\n== ' + rotulo + ' ==');
  let { ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes?po=todas', ARQ);
  /* 3. origem na lista */
  await page.waitForSelector('#poTodasLista');
  await esperar(page, () => !Array.from(document.querySelectorAll('.po-todas-origem')).some((x) => x.getAttribute('data-origem') === 'indisponivel'));
  const origem = (desc) => page.evaluate((d) => { const li = Array.from(document.querySelectorAll('#poTodasLista .po-todas-item')).find((x) => x.textContent.indexOf(d) !== -1); const m = li && li.querySelector('.po-todas-origem'); return m ? m.getAttribute('data-origem') + '|' + m.textContent : null; }, desc);
  const o1 = await origem('Gerir a contabilidade gerencial'), o2 = await origem('Gerir o processo contábil'), oa = await origem('da análise ativa'), oi = await origem('registrada individualmente');
  afirma(/^excluida\|Originada da análise Sintética — Gerência de Contabilidade e Controladoria \(excluída\)$/.test(o1) && /^excluida\|Originada da análise .* \(excluída\)$/.test(o2), '3. lista: os dois cadastros da análise excluída mostram a origem certa (não "registrada individualmente")', [o1, o2]);
  afirma(/^analise\|Área: Sintética — análise ativa$/.test(oa) && /^individual\|Registrada individualmente$/.test(oi), '3. lista: análise ativa com link; individual só quando comprovado', [oa, oi]);
  afirma(await page.evaluate(() => Array.from(document.querySelectorAll('#poTodasArea option')).some((o) => /\(excluída\)$/.test(o.textContent))), '3. filtro de área inclui a análise excluída, marcada');
  /* 7. contraste dos links */
  const c1 = await contraste(page, '.po-todas-origem a');
  afirma(c1 && c1.razao >= 4.5 && !/rgb\((85, 26, 139|128, 0, 128)\)/.test(c1.cor), '7. link de origem com contraste ≥ 4,5:1 e sem o roxo padrão', c1);
  afirma(await larguraOk(page), '3. lista sem rolagem lateral');
  await foto(page, 'origem-lista');
  /* 3. ficha e avaliação O1–O9 da concluída */
  await ir(page, '#avaliacoes?po=atuacoes&item=oG1');
  await page.waitForSelector('#anOrigem[data-origem="excluida"]');
  afirma(/Originada da análise Sintética — Gerência de Contabilidade e Controladoria \(excluída\)/.test(await texto(page, '#anOrigem')), '3. ficha da responsabilidade: origem na análise excluída');
  await ir(page, '#avaliacoes?po=gG1');
  await page.waitForSelector('#poObjeto #anOrigem');
  afirma(/\(excluída\)/.test(await texto(page, '#poObjeto #anOrigem')), '3. avaliação O1–O9 concluída: mostra a origem na análise excluída');
  /* 4/5. consulta antes de responder, no rascunho de oG2 */
  await ir(page, '#avaliacoes?po=atuacoes&item=oG2');
  await page.waitForSelector('#poHipoteseIniciar');
  await page.click('#poHipoteseIniciar input[value="NAO_SEI"]'); await page.click('#poIniciarAtuacaoBtn'); await page.waitForSelector('#poChecklist');
  afirma(/\(excluída\)/.test(await texto(page, '#poObjeto #anOrigem')), '3. rascunho O1–O9: mostra a origem na análise excluída');
  const perguntasAntes = await page.evaluate(() => Array.from(document.querySelectorAll('.po-pergunta')).map((x) => x.getAttribute('data-q')).join(','));
  afirma(perguntasAntes === 'O1,O2,O3' && await existe(page, '#poTiposEstrutura') && !(await page.evaluate(() => document.getElementById('poTiposEstrutura').open)), '4. desde o O1 (só O1–O3 à vista) existe a consulta, recolhida', perguntasAntes);
  await page.click('#poTiposEstrutura > summary');
  const tipos = await page.evaluate(() => Array.from(document.querySelectorAll('#poTiposLista .po-tipo')).map((x) => x.getAttribute('data-tipo')).join(','));
  afirma(tipos === 'AREA_ESPECIALIZADA,COE,LINHA,NEGOCIOS,ESTRATEGIA_CLIENTES,PLATAFORMA,PLATAFORMA_CANAIS,PLATAFORMA_HABILITADORA_NEGOCIOS,PLATAFORMA_HABILITADORA_TECNOLOGIA,PLATAFORMA_CORPORATIVA', '4. Área Especializada, CoE, Linha e especializações, Plataformas', tipos);
  afirma(/Definição de AREA_ESPECIALIZADA/.test(await texto(page, '#poTiposLista')) && /Tx COE/.test(await texto(page, '#poTiposLista')), '4. nomes e definições vêm da Taxonomia');
  await page.click('#poApoioO7O9 > summary');
  const ap = await texto(page, '#poApoioO7O9');
  /* 2. coerência */
  afirma(!/Raramente/i.test(ap) && !/valor previdenciário ou financeiro aos participantes/.test(ap), '2. sem "Raramente" e sem exigir valor aos participantes', ap.slice(0, 120));
  afirma(/A O7 não exige entrega direta ao participante/.test(await texto(page, '#poApoioNaoParticipante')) && /não é necessário que o objeto seja previdenciário ou financeiro/.test(await texto(page, '#poApoioNaoParticipante')) && /não decide, sozinho/.test(await texto(page, '#poApoioNaoParticipante')),
    '2. ausência de entrega ao participante não decide, sozinha (coerente com a Ajuda oficial da O7)');
  afirma(/consumidos em escala por diferentes Linhas e times/.test(ap) && /serviços corporativos ao cliente interno/.test(ap), '2. as descrições repetem a redação oficial da O7 e da O9');
  afirma(await page.evaluate(() => document.querySelectorAll('#poApoioPerguntas li').length) === 6 && /Uma ou várias/.test(await texto(page, '#poApoioPerguntas')) && /Quem define as regras/.test(await texto(page, '#poApoioPerguntas')), '2. seis pontos a verificar (natureza, consumo, operação × administração, regras, cadeia, uma ou várias)');
  afirma(/nenhum deles diz qual predomina/.test(ap) && await page.evaluate(() => document.querySelectorAll('#poApoioExemplos tbody tr').length) === 8, '2. oito exemplos com evidências dos dois lados, sem dizer qual predomina');
  const db0 = await banco(page), kG2 = db0['posicionamento-rascunho-por-item'].oG2;
  afirma(!Object.keys(db0['avaliacoes-posicionamento'][kG2].respostas || {}).length && await page.evaluate(() => document.querySelectorAll('.po-pergunta').length) === 3, '4. consultar não grava resposta nem mostra pergunta fora do caminho');
  /* 5. o que verificar */
  await page.click('#poInvestigar_O1 > summary');
  afirma(/Pelo que esta responsabilidade responde/.test(await texto(page, '#poInvestigar_O1')) && /o critério é a pergunta e a Ajuda oficial/.test(await texto(page, '#poInvestigar_O1')) && await existe(page, '#poInvestigar_O2') && await existe(page, '#poInvestigar_O3'), '5. O1–O3: "O que verificar para responder", como orientação');
  afirma(await larguraOk(page), '4/5. consulta e orientações sem rolagem lateral');
  await foto(page, 'consulta-tipos-apoio');
  const db1 = await banco(page);
  afirma(db1['avaliacoes-posicionamento'].gG1.status === 'concluido' && db1['posicionamento-vigente-por-item'].oG1 === 'gG1' && db1['avaliacoes-posicionamento'][kG2].status === 'rascunho' &&
    !!db1['analises-organizacionais-excluidas'].anG && !db1['analises-organizacionais'].anG && db1['analises-por-objeto'].oG1.analiseId === 'anG', '3. concluída e rascunho intactos; análise continua excluída; índice de origem imutável');
  afirma(!erros.length, 'sem erro de página', erros);
  await ctx.close();

  /* 3. sem leitura das análises (marcador desligado para o perfil): nunca "registrada individualmente" sem prova */
  ({ ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes?po=todas', ARQ, sementePos('SOMENTE_ADMIN_GERAL')));
  await page.waitForSelector('#poTodasLista');
  const semLeitura = await page.evaluate(() => Array.from(document.querySelectorAll('.po-todas-origem')).map((x) => x.getAttribute('data-origem')));
  afirma(semLeitura.length && semLeitura.every((x) => x === 'indisponivel') && !/Registrada individualmente/.test(await texto(page, '#poTodasLista')), '3. sem leitura das análises: "Origem não disponível agora", nunca "registrada individualmente"', semLeitura);
  await ctx.close();

  /* 6/8. confirmação de exclusão (admin geral) */
  ({ ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes?an=anC', ADM));
  await page.waitForSelector('#anExcluirBtn');
  await page.click('#anExcluirBtn');
  await page.waitForSelector('#anFormExcluir[data-nivel="excepcional"]');
  afirma(/1 responsabilidade que existia só dentro desta análise é retirada/.test(await texto(page, '#anExcConsSoDentro')) && /1 responsabilidade tem cadastro próprio e continua existindo/.test(await texto(page, '#anExcConsCadastros')) &&
    /nada disso é apagado em cascata/.test(await texto(page, '#anExcConsCadastros')) && /deixa de existir como cadastro ativo/.test(await texto(page, '#anExcConsAnalise')) && !(await existe(page, '#anExcConsPropostas')), '8. consequências claras e só as aplicáveis');
  await page.click('#anConfirmarExcluir');
  await page.waitForSelector('#anExcluirErro');
  afirma(/motivo/.test(await texto(page, '#anExcluirErro')) && await naTela(page, '#anExcluirErro') && await page.evaluate(() => document.activeElement && document.activeElement.id === 'anMotivoExcluir'), '6. sem motivo: mensagem junto do botão, visível, foco no campo');
  await page.fill('#anMotivoExcluir', 'teste');
  await page.click('#anConfirmarExcluir');
  await esperar(page, () => /confirmação/.test((document.getElementById('anExcluirErro') || {}).textContent || ''));
  afirma(await naTela(page, '#anExcluirErro') && await page.evaluate(() => document.getElementById('anExcluirConfirmo').closest('label').classList.contains('an-campo-pendente')) && (await page.inputValue('#anMotivoExcluir')) === 'teste',
    '6. sem a confirmação: mensagem visível, a confirmação destacada e o motivo preservado');
  afirma(!!(await banco(page))['analises-organizacionais'].anC, '6. nada foi excluído');
  await foto(page, 'exclusao-analise-pendente');
  afirma(await larguraOk(page), '6/8. formulário sem rolagem lateral');
  /* modal da responsabilidade (exclusão excepcional da concluída) */
  await ir(page, '#avaliacoes?po=atuacoes&item=oG1');
  await page.waitForSelector('#poExcluirAtuacaoBtn');
  await page.click('#poExcluirAtuacaoBtn');
  await page.waitForSelector('.po-modal #poExcConfirmo');
  await page.click('.po-modal .po-modal-sim');
  afirma(/motivo/.test(await texto(page, '.po-modal .po-modal-erro')) && await page.evaluate(() => document.getElementById('poMotivoExcluirAtuacao').classList.contains('po-campo-pendente')), '6. modal sem motivo: mensagem e campo destacado');
  await page.fill('#poMotivoExcluirAtuacao', 'teste');
  await page.click('.po-modal .po-modal-sim');
  afirma(/confirmação/.test(await texto(page, '.po-modal .po-modal-erro')) && await page.evaluate(() => { const e = document.querySelector('.po-modal .po-modal-erro'); const r = e.getBoundingClientRect(); return !e.hidden && r.top >= 0 && r.bottom <= window.innerHeight; }) &&
    await page.evaluate(() => document.getElementById('poExcConfirmo').closest('label').classList.contains('po-campo-pendente')), '6. modal sem confirmação: mensagem visível junto do botão e confirmação destacada');
  afirma(!!(await banco(page))['objetos-organizacionais'].oG1, '6. nada foi excluído');
  afirma(!erros.length, 'sem erro de página (admin geral)', erros);
  if (process.env.FA_PRINTS) { const fechar = await page.$('.po-modal .po-modal-nao'); if (fechar) await fechar.click(); await ir(page, '#avaliacoes'); await page.waitForSelector('#avpInicioConsultar', { state: 'attached' }); await page.evaluate(() => { document.getElementById('avpInicioConsultar').open = true; }); await page.waitForTimeout(300); await foto(page, 'entenda'); }
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    await jornada(browser, { width: 1280, height: 900 }, 'Computador (1280 px)');
    await jornada(browser, { width: 375, height: 800 }, 'Celular (375 px)');
  } finally { await browser.close(); }
  console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
