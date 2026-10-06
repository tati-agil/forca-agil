/* TAXONOMIA — governança (Etapa 5), na tela: ligações da Avaliação, inativação e relações. Desktop e 375 px.
 * CONTEÚDO 100% FICTÍCIO. Firebase falso em persistência real; hermético (sem rede, sem segredo).
 * As REGRAS do banco (a trava de verdade) são provadas no emulador em teste-rules-taxonomia-governanca.js;
 * aqui se prova o que a pessoa vê e o que a tela grava (ou não grava).
 *
 *   1. Aviso permanente "Proteção da Avaliação incompleta: X de 11" enquanto faltar ligação.
 *   2. Conceitos-base: situação por código do motor; "Registrar ligações…" mostra a prévia (já ligado / será
 *      ligado / não pode ser ligado) e só grava ao confirmar; depois não sobra nada a registrar (idempotente).
 *      Gravação recusada pelo banco: erro visível, nada gravado.
 *   3. Conceito ligado: "Inativar" só explica ("…não pode ser inativado enquanto essa ligação estiver ativa.")
 *      e não grava nada. Ligações ainda lendo: "Conferindo…" — "ainda não sei" não vira "pode inativar".
 *   4. Inativar (organizacional): mostra filhos ativos e relações ativas afetadas; motivo obrigatório; grava
 *      ativo=false + inativacao + histórico; reativar volta e fica no histórico.
 *   5. Relações: criar (histórico nas duas pontas, mesmo operacaoId); relação idêntica a uma encerrada é
 *      bloqueada; encerrar com motivo (fica em "Relações encerradas"); alterar = encerrar + criar.
 *   6. Sem rolagem horizontal; nenhum erro de JS. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarCondicao, esperarSessaoAssentada } = require('./esperas');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const EMAIL = 'adm@previ.com.br';
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const DESKTOP = { width: 1280, height: 900 };
const CELULAR = { width: 375, height: 800 };
const QUANDO = '2026-10-01T09:00:00.000Z';
const SHOTS = process.env.FA_SHOTS_DIR || null;

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

const arq = (nome, ativo) => ({ nome, ordem: 1, ativo, situacaoDefinicao: 'ainda não registrada' });
const org = (nome, extra) => Object.assign({ nome, ordem: 1, ativo: true, situacaoDefinicao: 'em revisão', camada: 'B' }, extra || {});
const semente = () => {
  const adm = {}; adm[chave(EMAIL)] = { email: EMAIL, name: 'ADMIN' };
  const users = {}; users[chave(EMAIL)] = { name: 'ADMIN', email: EMAIL, area: 'INFOR' };
  return {
    'fa-users': users, 'fa-admins': adm, 'fa-diretores': {}, 'fa-facilitadores': {}, eventos: {}, turmas: {}, 'turmas-interesse': {}, 'turmas-config': {}, 'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {},
    'avaliacao-classificacoes': { 'produto-principal': { registradoEm: QUANDO, registradoPor: EMAIL, auditoriaId: 'k0' } },
    'avaliacao-classificacoes-auditoria': { 'produto-principal': { k0: { tipo: 'ligacao_registrada', codigo: 'produto-principal', usuario: { email: EMAIL }, dataHora: QUANDO } } },
    taxonomia: {
      meta: { cargaInicial: { feitaEm: QUANDO, feitaPor: EMAIL, resumo: {} } },
      arquitetural: {
        conceitos: {
          'produto-principal': arq('Produto Fictício', true), canal: arq('Canal Fictício', true), componente: arq('Componente Fictício', true),
          'regra-condicao': arq('Regra Fictícia', true), 'documento-informacao': arq('Documento Fictício', false)
        }
      },
      organizacional: {
        conceitos: { LINHA: org('Linha Fictícia', { camada: 'A' }), SQ: org('Squad Fictícia', { pai: 'LINHA' }), COE: org('CoE Fictício'), ANT: org('Antigo Fictício', { ativo: false }) },
        relacoes: {
          SQ__compoe__LINHA: { de: 'SQ', tipo: 'compoe', para: 'LINHA' },
          SQ__atende__COE: { de: 'SQ', tipo: 'atende', para: 'COE', criadaEm: QUANDO, criadaPor: EMAIL, auditoriaId: 'a0', encerrada: { motivo: 'Fim do acordo', em: QUANDO, por: EMAIL, auditoriaId: 'e0' } }
        },
        auditoria: {}
      }
    }
  };
};

async function abrir(browser, viewport, opts) {
  opts = opts || {};
  const cfg = { db: semente(), user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true, delays: opts.delays || {}, fail: opts.fail || [] };
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  await page.waitForSelector('.admin-tab-btn[data-panel="adminPanelTaxonomia"]', { state: 'visible', timeout: 12000 });
  await page.click('.admin-tab-btn[data-panel="adminPanelTaxonomia"]');
  await page.waitForSelector('.tax-item[data-codigo="SQ"]', { timeout: 8000 });
  return { ctx, page, erros };
}
const banco = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal)));
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const escritas = (page) => page.evaluate(() => (window.__ESCRITAS || []).length);
const texto = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.innerText : ''; }, sel);
async function foto(page, nome, sel) { if (!SHOTS) return; try { await page.locator(sel).first().screenshot({ path: path.join(SHOTS, nome + '.png') }); } catch (e) { console.log('(foto ' + nome + ' não tirada: ' + e.message + ')'); } }
async function dominio(page, dom) {
  await page.click('[data-tax="dominio"][data-dominio="' + dom + '"]');
  await esperarCondicao(page, (d) => !!document.querySelector('.tax-dominio--ativo[data-dominio="' + d + '"]') && !!document.querySelector('.tax-item'), dom, { descricao: 'domínio ' + dom + ' carregado' });
}
async function abreConceito(page, cod) {
  /* no celular a lista some quando o detalhe está aberto: volta para a lista antes */
  if (await page.locator('.tax-detalhe [data-tax="voltar-lista"]').first().isVisible() && !(await page.locator('.tax-item[data-codigo="' + cod + '"]').isVisible())) await page.locator('.tax-detalhe [data-tax="voltar-lista"]').first().click();
  await page.click('.tax-item[data-codigo="' + cod + '"]');
  await esperarCondicao(page, (c) => { const t = document.querySelector('#taxCodigo'); return !!t && t.innerText.indexOf(c) !== -1 && !document.querySelector('.tax-detalhe .loading-msg'); }, cod, { descricao: 'detalhe de ' + cod + ' carregado' });
}

(async () => {
  const browser = await chromium.launch();
  for (const [nomeTela, viewport, suf] of [['desktop', DESKTOP, 'desktop'], ['celular 375px', CELULAR, '375']]) {
    console.log('\n######## ' + nomeTela + ' ########');
    const { ctx, page, erros } = await abrir(browser, viewport);

    console.log('\n== 1. Aviso de proteção incompleta ==');
    await esperarCondicao(page, () => !!document.getElementById('taxProtecaoIncompleta'), null, { descricao: 'aviso de proteção' });
    afirma(/Proteção da Avaliação incompleta:.*1 de 11 classificações ligadas/.test(await texto(page, '#taxProtecaoIncompleta')), 'aviso permanente: "Proteção da Avaliação incompleta: 1 de 11"', await texto(page, '#taxProtecaoIncompleta'));

    console.log('\n== 2. Conceitos-base e registro controlado das ligações ==');
    await dominio(page, 'arquitetural');
    afirma(/Conceitos-base da Avaliação — 11 códigos · 1 de 11 ligadas/.test(await texto(page, '#taxConceitosBase summary')), 'cabeçalho: "11 códigos · 1 de 11 ligadas"');
    afirma(await page.locator('#taxConceitosBase [data-base="produto-principal"][data-ligado="1"]').count() === 1 && /ligado à Avaliação/.test(await texto(page, '#taxConceitosBase [data-base="produto-principal"]')), 'produto-principal aparece "ligado à Avaliação"');
    afirma(/sem conceito — a Avaliação usa o rótulo de contingência; não pode ser ligado/.test(await texto(page, '#taxConceitosBase [data-base="a-validar"]')) && /conceito inativo — não pode ser ligado/.test(await texto(page, '#taxConceitosBase [data-base="documento-informacao"]')), 'ausente e inativo: "não pode ser ligado"');
    let e0 = await escritas(page);
    await page.click('#taxRegistrarLigacoesBtn');
    await page.waitForSelector('#taxPreviaLigacoes', { timeout: 4000 });
    const sit = (c) => page.evaluate((x) => (document.querySelector('#taxPreviaLigacoes [data-previa="' + x + '"]') || {}).getAttribute ? document.querySelector('#taxPreviaLigacoes [data-previa="' + x + '"]').getAttribute('data-situacao') : null, c);
    afirma(await sit('produto-principal') === 'ligado' && await sit('canal') === 'ligar' && await sit('componente') === 'ligar' && await sit('regra-condicao') === 'ligar' && await sit('documento-informacao') === 'inativo' && await sit('a-validar') === 'sem-conceito', 'prévia: já ligado / será ligado / não pode ser ligado (inativo, ausente)');
    afirma(await escritas(page) === e0, 'a prévia não grava nada');
    afirma((await page.locator('#taxConfirmarLigacoes').innerText()).trim().toUpperCase() === 'REGISTRAR 3 LIGAÇÕES', 'botão diz quantas serão registradas (3)', await page.locator('#taxConfirmarLigacoes').innerText());
    await foto(page, 'governanca-previa-ligacoes-' + suf, '#taxConceitosBase');
    afirma(await larguraOk(page), 'prévia sem rolagem horizontal');
    await page.click('#taxConfirmarLigacoes');
    await esperarCondicao(page, () => Object.keys(window.__CFG.__dbReal['avaliacao-classificacoes'] || {}).length === 4, null, { descricao: 'ligações gravadas' });
    let b = await banco(page);
    const novas = ['canal', 'componente', 'regra-condicao'];
    afirma(novas.every((c) => b['avaliacao-classificacoes'][c] && b['avaliacao-classificacoes'][c].registradoPor === EMAIL && b['avaliacao-classificacoes-auditoria'][c][b['avaliacao-classificacoes'][c].auditoriaId].tipo === 'ligacao_registrada'), 'cada ligação nova aponta para a SUA linha de histórico (ligacao_registrada)');
    afirma(JSON.stringify(b['avaliacao-classificacoes']['produto-principal']) === JSON.stringify(semente()['avaliacao-classificacoes']['produto-principal']), 'a ligação que já existia não foi tocada');
    await esperarCondicao(page, () => /4 de 11 ligadas/.test((document.querySelector('#taxConceitosBase summary') || {}).innerText || ''), null, { descricao: 'contagem atualizada' });
    afirma(await page.locator('#taxRegistrarLigacoesBtn').count() === 0, 'idempotente: depois do registro não sobra nada a registrar (sem botão)');
    afirma(/4 de 11/.test(await texto(page, '#taxProtecaoIncompleta')), 'o aviso de proteção continua, agora "4 de 11" (faltam conceitos)');

    console.log('\n== 3. Conceito ligado à Avaliação não pode ser inativado ==');
    await abreConceito(page, 'canal');
    afirma(/ligado à Avaliação/.test(await texto(page, '#taxIdentLigado')), 'a identificação mostra "ligado à Avaliação"');
    e0 = await escritas(page);
    await page.click('#taxInativarBtn');
    await page.waitForSelector('#taxInativarBloqueado', { timeout: 4000 });
    afirma((await texto(page, '#taxInativarBloqueado')).trim() === 'Este conceito está ligado à classificação "Canal Fictício" da Avaliação e não pode ser inativado enquanto essa ligação estiver ativa.', 'mensagem exata do bloqueio', await texto(page, '#taxInativarBloqueado'));
    afirma(await page.locator('#taxPainelInativar [data-tax="confirmar-inativar"], #taxPainelInativar textarea').count() === 0, 'sem campo de motivo e sem botão de confirmar');
    afirma(await escritas(page) === e0 && (await banco(page)).taxonomia.arquitetural.conceitos.canal.ativo === true, 'nada foi gravado');
    await foto(page, 'governanca-bloqueio-' + suf, '#taxSecIdent');
    afirma(await larguraOk(page), 'bloqueio sem rolagem horizontal');
    await page.click('#taxPainelInativar [data-tax="cancelar-inativar"]');

    console.log('\n== 4. Inativar com motivo, mostrando o que é afetado; reativar ==');
    await dominio(page, 'organizacional');
    await abreConceito(page, 'LINHA');
    await page.click('#taxInativarBtn');
    await page.waitForSelector('#taxInativarAfetados', { timeout: 4000 });
    const af = await texto(page, '#taxInativarAfetados');
    afirma(/Filhos ativos \(1\)/i.test(af) && /Squad Fictícia/.test(af) && /Relações ativas \(1\)/i.test(af) && /Squad Fictícia \(SQ\) compõe Linha Fictícia \(LINHA\)/.test(af), 'antes de confirmar: filho ativo (SQ) e relação ativa afetada', af);
    e0 = await escritas(page);
    await page.click('[data-tax="confirmar-inativar"]');
    await esperarCondicao(page, () => /Informe o motivo/.test((document.getElementById('taxPainelInativar') || {}).innerText || ''), null, { descricao: 'pede o motivo' });
    afirma(await escritas(page) === e0, 'sem motivo: recusado sem gravar');
    await page.fill('#taxI_motivo', 'Reorganização fictícia');
    await foto(page, 'governanca-inativar-' + suf, '#taxPainelInativar');
    afirma(await larguraOk(page), 'painel de inativação sem rolagem horizontal');
    await page.click('[data-tax="confirmar-inativar"]');
    await esperarCondicao(page, () => window.__CFG.__dbReal.taxonomia.organizacional.conceitos.LINHA.ativo === false, null, { descricao: 'LINHA inativado' });
    b = await banco(page);
    const L = b.taxonomia.organizacional.conceitos.LINHA, audL = b.taxonomia.organizacional.auditoria.LINHA || {};
    afirma(L.inativacao && L.inativacao.motivo === 'Reorganização fictícia' && L.inativacao.por === EMAIL && audL[L.inativacao.auditoriaId] && audL[L.inativacao.auditoriaId].tipo === 'inativacao' && audL[L.inativacao.auditoriaId].filhosAtivos === 'SQ', 'gravado: ativo=false + motivo/autor + histórico apontado (com os filhos afetados)');
    afirma(b.taxonomia.organizacional.conceitos.SQ.ativo === true && !!b.taxonomia.organizacional.relacoes.SQ__compoe__LINHA && !b.taxonomia.organizacional.relacoes.SQ__compoe__LINHA.encerrada, 'nada mais mudou: o filho e a relação continuam como estavam');
    await esperarCondicao(page, () => !!document.getElementById('taxIdentInativacao'), null, { descricao: 'identificação com a inativação' });
    afirma(/motivo: Reorganização fictícia/.test(await texto(page, '#taxIdentInativacao')), 'a identificação mostra quando, quem e o motivo');
    await page.click('#taxReativarBtn');
    await esperarCondicao(page, () => window.__CFG.__dbReal.taxonomia.organizacional.conceitos.LINHA.ativo === true, null, { descricao: 'LINHA reativado' });
    b = await banco(page);
    afirma(!b.taxonomia.organizacional.conceitos.LINHA.inativacao && Object.values(b.taxonomia.organizacional.auditoria.LINHA).map((e) => e.tipo).sort().join(',') === 'inativacao,reativacao', 'reativado: o histórico tem a inativação E a reativação');

    console.log('\n== 5. Relações: criar, bloquear idêntica encerrada, encerrar, alterar ==');
    await abreConceito(page, 'SQ');
    afirma(/Relações encerradas \(1\)/.test(await texto(page, '#taxRelEncerradas summary')), 'a relação encerrada aparece em "Relações encerradas (1)"');
    await page.click('#taxNovaRelacaoBtn');
    await page.waitForSelector('#taxFormRelacao', { timeout: 4000 });
    afirma(await page.locator('#taxR_outro option[value="ANT"]').count() === 0 && await page.locator('#taxR_outro option[value="SQ"]').count() === 0, 'só conceitos ativos e diferentes do próprio podem ser escolhidos');
    await page.selectOption('#taxR_tipo', 'atende'); await page.selectOption('#taxR_outro', 'COE');
    e0 = await escritas(page);
    await page.click('[data-tax="salvar-relacao"]');
    await esperarCondicao(page, () => /já existiu e foi encerrada/.test((document.getElementById('taxFormRelacao') || {}).innerText || ''), null, { descricao: 'bloqueio da idêntica encerrada' });
    afirma(await escritas(page) === e0, 'relação idêntica a uma encerrada: bloqueada, sem gravar');
    await page.selectOption('#taxR_tipo', 'aloca-em'); await page.fill('#taxR_nota', 'Nota fictícia');
    await foto(page, 'governanca-nova-relacao-' + suf, '#taxSecRelacoes');
    afirma(await larguraOk(page), 'formulário de relação sem rolagem horizontal');
    await page.click('[data-tax="salvar-relacao"]');
    await esperarCondicao(page, () => !!(window.__CFG.__dbReal.taxonomia.organizacional.relacoes || {})['SQ__aloca-em__COE'], null, { descricao: 'relação criada' });
    b = await banco(page);
    const nr = b.taxonomia.organizacional.relacoes['SQ__aloca-em__COE'], A = b.taxonomia.organizacional.auditoria;
    afirma(nr.criadaPor === EMAIL && nr.nota === 'Nota fictícia' && A.SQ[nr.auditoriaId].tipo === 'relacao_criada' && A.COE[nr.auditoriaId].tipo === 'relacao_criada' && A.SQ[nr.auditoriaId].operacaoId === A.COE[nr.auditoriaId].operacaoId, 'criada com histórico na origem e no destino, mesmo operacaoId');
    await esperarCondicao(page, () => !!document.querySelector('#taxRelSaida [data-relacao="SQ__compoe__LINHA"] [data-tax="encerrar-relacao"]'), null, { descricao: 'lista de relações atualizada' });
    await page.click('#taxRelSaida [data-relacao="SQ__compoe__LINHA"] [data-tax="encerrar-relacao"]');
    await page.waitForSelector('#taxPainelEncerrar', { timeout: 4000 });
    e0 = await escritas(page);
    await page.click('[data-tax="confirmar-encerrar"]');
    await esperarCondicao(page, () => /Informe o motivo/.test((document.getElementById('taxPainelEncerrar') || {}).innerText || ''), null, { descricao: 'pede motivo do encerramento' });
    afirma(await escritas(page) === e0, 'encerrar sem motivo: recusado sem gravar');
    await page.fill('#taxE_motivo', 'Mudou a estrutura (fictício)');
    await page.click('[data-tax="confirmar-encerrar"]');
    await esperarCondicao(page, () => !!window.__CFG.__dbReal.taxonomia.organizacional.relacoes.SQ__compoe__LINHA.encerrada, null, { descricao: 'relação encerrada' });
    b = await banco(page);
    afirma(b.taxonomia.organizacional.relacoes.SQ__compoe__LINHA.de === 'SQ' && b.taxonomia.organizacional.relacoes.SQ__compoe__LINHA.encerrada.motivo === 'Mudou a estrutura (fictício)', 'encerrada, não apagada (com motivo)');
    await esperarCondicao(page, () => /Relações encerradas \(2\)/.test((document.querySelector('#taxRelEncerradas summary') || {}).innerText || ''), null, { descricao: 'encerradas (2)' });
    afirma(true, 'a lista mostra "Relações encerradas (2)"');
    await page.click('#taxRelSaida [data-relacao="SQ__aloca-em__COE"] [data-tax="alterar-relacao"]');
    await page.waitForSelector('#taxFormRelacao', { timeout: 4000 });
    afirma(await page.inputValue('#taxR_tipo') === 'aloca-em' && await page.inputValue('#taxR_outro') === 'COE' && await page.inputValue('#taxR_nota') === 'Nota fictícia', '"Alterar" abre com os dados atuais');
    await page.selectOption('#taxR_tipo', 'compoe');
    await page.click('[data-tax="salvar-relacao"]');
    await esperarCondicao(page, () => /motivo da alteração/.test((document.getElementById('taxFormRelacao') || {}).innerText || ''), null, { descricao: 'pede motivo da alteração' });
    await page.fill('#taxR_motivo', 'Tipo corrigido (fictício)');
    await page.click('[data-tax="salvar-relacao"]');
    await esperarCondicao(page, () => !!window.__CFG.__dbReal.taxonomia.organizacional.relacoes.SQ__compoe__COE, null, { descricao: 'relação alterada' });
    b = await banco(page);
    const rv = b.taxonomia.organizacional.relacoes;
    const opsCOE = Object.values(b.taxonomia.organizacional.auditoria.COE).filter((e) => e.relacao === 'SQ__aloca-em__COE' && e.tipo === 'relacao_encerrada' || e.relacao === 'SQ__compoe__COE');
    afirma(!!rv['SQ__aloca-em__COE'].encerrada && rv['SQ__aloca-em__COE'].encerrada.motivo === 'Tipo corrigido (fictício)' && rv.SQ__compoe__COE.nota === 'Nota fictícia' && !rv.SQ__compoe__COE.encerrada, 'alterar = a antiga encerrada (com o motivo) + a nova ativa');
    afirma(opsCOE.length === 2 && opsCOE[0].operacaoId === opsCOE[1].operacaoId, 'encerrar e criar compartilham o operacaoId (a mesma ação)');
    afirma(await larguraOk(page), 'sem rolagem horizontal');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  console.log('\n######## caminhos lentos e recusados ########');
  {
    /* ligações nunca respondem: "ainda não sei" não vira "pode inativar" */
    const { ctx, page, erros } = await abrir(browser, DESKTOP, { delays: { 'avaliacao-classificacoes': 100000000 } });
    await dominio(page, 'arquitetural');
    afirma(/conferindo ligações/.test(await texto(page, '#taxConceitosBase summary')) && await page.locator('#taxProtecaoIncompleta').count() === 0, 'ligações sem resposta: "conferindo ligações…", sem aviso de incompleta e sem botão de registrar');
    await abreConceito(page, 'componente');
    const e0 = await escritas(page);
    await page.click('#taxInativarBtn');
    await page.waitForSelector('#taxInativarLigacao', { timeout: 4000 });
    afirma(/Conferindo se este conceito está ligado à Avaliação/.test(await texto(page, '#taxInativarLigacao')) && await page.locator('#taxPainelInativar [data-tax="confirmar-inativar"]').count() === 0, 'inativar: "Conferindo…", sem botão de confirmar');
    afirma(await escritas(page) === e0, 'nada foi gravado');
    afirma(erros.length === 0, 'nenhum erro de JS');
    await ctx.close();
  }
  {
    /* leitura das ligações recusada: erro visível + "Tentar novamente"; inativar fica bloqueado */
    const { ctx, page, erros } = await abrir(browser, CELULAR, { fail: ['avaliacao-classificacoes'] });
    await dominio(page, 'arquitetural');
    await esperarCondicao(page, () => !!document.getElementById('taxLigacoesErro'), null, { descricao: 'erro das ligações' });
    afirma(/Sem acesso às ligações|Não foi possível ler as ligações/.test(await texto(page, '#taxLigacoesErro')) && await page.locator('#taxLigacoesErro [data-tax="ligacoes-recarregar"]').count() === 1, 'leitura recusada: erro visível com "Tentar novamente" (375 px)');
    afirma(await larguraOk(page), 'sem rolagem horizontal');
    afirma(erros.length === 0, 'nenhum erro de JS');
    await ctx.close();
  }
  {
    /* gravação das ligações recusada pelo banco: erro, nada gravado, prévia continua na tela */
    const { ctx, page, erros } = await abrir(browser, DESKTOP, { fail: ['avaliacao-classificacoes-auditoria'] });
    await dominio(page, 'arquitetural');
    await page.click('#taxRegistrarLigacoesBtn');
    await page.click('#taxConfirmarLigacoes');
    await esperarCondicao(page, () => !!document.querySelector('#taxFlash.tax-flash--erro'), null, { descricao: 'erro da gravação' });
    afirma(/Nada foi alterado/.test(await texto(page, '#taxFlash')) && Object.keys((await banco(page))['avaliacao-classificacoes']).length === 1 && await page.locator('#taxPreviaLigacoes').count() === 1, 'recusa do banco: erro visível, nenhuma ligação nova, a prévia continua na tela');
    afirma(erros.length === 0, 'nenhum erro de JS');
    await ctx.close();
  }
  await browser.close();
  console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nOK — governança da Taxonomia: ligações da Avaliação (prévia, registro idempotente, recusa), bloqueio da inativação do conceito ligado, inativar com motivo e afetados, reativar, relações criar/encerrar/alterar com histórico nas duas pontas; desktop e 375 px.');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
