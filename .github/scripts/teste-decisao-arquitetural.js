/* DECISÃO ARQUITETURAL — a jornada de uma área (GECON, dados fictícios) do registro ao resultado, com o que a pessoa
 * precisa para decidir. Firebase falso em persistência real; hermético; nada vai para produção. Prova:
 *   1. Depois do lote, a lista e a próxima ação vêm primeiro: "Adicionar" fecha e há uma só ação principal visível.
 *   2. Interromper e retomar: salvar o rascunho do O1–O9 leva de volta à área (sem link concorrente da lista de
 *      jornadas); a linha fica "Em avaliação" com "Continuar avaliação" como próximo passo.
 *   3. Resultado firme (O1 SIM, O4–O8 NÃO, só O9 SIM = Gestão Corporativa — regra vigente): "Avaliação concluída";
 *      uma só ação principal (voltar à área); "Como chegamos a esta recomendação" mostra o caminho e lembra que, se
 *      outra característica do nível também se aplicasse, o resultado seria "A validar".
 *   4. Estrutura responsável: vincular é etapa separada e OPCIONAL — sem botão principal; na Jornada, "Avaliação
 *      concluída · estrutura responsável: opcional", nunca "Próximo passo: Cadastrar estrutura deste tipo".
 *   5. O7 e O9 SIM na mesma responsabilidade: a regra vigente pede o diagnóstico (nenhuma precedência silenciosa).
 *   6. A volta à área mostra 1 avaliada e 9 prontas; nenhuma estrutura nem vínculo foi criado. 375 px sem corte. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const { semente, ARQ, chave } = require('./semente-jornada');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const GECON = ['Gerir a contabilidade gerencial.', 'Gerir o planejamento e execução orçamentária.', 'Gerir a modelagem, mensuração, análise e avaliação de desempenho e resultados econômicos.',
  'Elaborar a projeção anual de resultados.', 'Gerir a movimentação financeira das contas bancárias.', 'Coordenar as informações para o fluxo de caixa de curto prazo.',
  'Registrar e controlar as operações de investimentos mobiliários da carteira própria e de fundos de investimento.', 'Gerir o processo contábil.',
  'Gerir o cumprimento de obrigações legais no âmbito contábil e tributário.', 'Gerir bens do ativo imobilizado e do ativo intangível.'];
let falhas = 0, total = 0;
function afirma(c, msg, det) { total++; console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + (typeof det === 'string' ? det : JSON.stringify(det)) : '')); if (!c) falhas++; }
const esperar = (page, fn, arg) => esperarCondicao(page, fn, arg, { limite: 15000 });
const texto = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ') : ''; }, sel);
/* ações principais que a pessoa VÊ (fora de blocos recolhidos) */
const principais = (page, raiz) => page.$$eval(raiz + ' .btn--primary', (l) => l.filter((x) => x.offsetParent && !x.closest('details:not([open])') && !x.disabled).map((x) => x.textContent.trim()));
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

async function jornada(browser, viewport, rot) {
  console.log('\n== ' + rot + ' ==');
  const ctx = await browser.newContext({ viewport }); const page = await ctx.newPage(); page.setDefaultTimeout(20000);
  const erros = []; page.on('pageerror', (e) => erros.push(String(e)));
  const db = semente(); db['analises-organizacionais-config'] = { habilitacao: 'LIBERADO_PARA_PERFIS_AUTORIZADOS' };
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify({ db, user: { email: ARQ, emailVerified: true, uid: 'u-' + chave(ARQ) }, uidDoUsuario: true, prefixoChave: 'd' + rot.length + 'x', delayDefault: 10, persistenciaReal: true }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#arquitetura?an=nova', { waitUntil: 'domcontentloaded' }); await esperarSessaoAssentada(page);
  const estruturasAntes = JSON.stringify((await page.evaluate(() => window.__CFG.__dbReal['estruturas-concretas'])) || null);
  const vinculosAntes = JSON.stringify((await page.evaluate(() => window.__CFG.__dbReal['estruturas-vinculos'])) || null);
  await page.waitForSelector('#anFormNova'); await page.fill('#anNome', 'GECON — Gerência de Contabilidade e Controladoria'); await page.click('#anCriarBtn');
  await page.waitForSelector('#anLoteTexto'); await page.fill('#anLoteTexto', GECON.join('\n')); await page.click('#anLotePrevia'); await page.waitForSelector('#anLoteLista');
  await page.click('#anLoteRegistrar'); await page.waitForFunction(() => document.querySelectorAll('.an-linha[data-resp]').length === 10);
  console.log('1. Depois do lote');
  const p1 = await principais(page, '#avaliacoesAnalise');
  afirma(!(await page.evaluate(() => document.getElementById('anRegistrar').open)) && /10 responsabilidades registradas/.test(await texto(page, '#anLoteFeedback')) && p1.length === 1 && p1[0] === 'Avaliar próxima',
    'a lista e a próxima ação primeiro: "Adicionar" fecha, a confirmação fica à vista, uma só ação principal ("Avaliar próxima")', p1);
  const area = await page.evaluate(() => location.hash);
  const k0 = await page.evaluate(() => document.querySelector('.an-linha[data-resp]').getAttribute('data-resp'));
  console.log('2. Interromper e retomar');
  await page.click('#anIrProxima'); await page.waitForSelector('#poHipoteseIniciar');
  await page.click('#poHipoteseIniciar input[value="PLATAFORMA_CORPORATIVA"]'); await page.click('#poIniciarAtuacaoBtn'); await page.waitForSelector('#poChecklist');
  for (const [q, v] of [['O1', 'SIM'], ['O2', 'NAO'], ['O3', 'NAO']]) { await page.click('.po-resp[data-q="' + q + '"][data-v="' + v + '"]'); await page.waitForTimeout(80); }
  await page.click('#poSalvarBtn'); await page.waitForSelector('#poVoltarAreaRodape');
  afirma(!(await page.$('#poVoltarJornada')) && /Voltar às responsabilidades de GECON/.test(await texto(page, '#poVoltarAreaRodape')), 'rascunho salvo: a volta é para a área (sem o link concorrente da lista de jornadas)');
  await page.click('#poVoltarAreaRodape'); await page.waitForSelector('#anResponsabilidades');
  afirma(await page.evaluate(() => location.hash) === area && (await texto(page, '#anSituacao_' + k0)).trim() === 'Em avaliação' && (await texto(page, '#anIrProxima')).trim() === 'Continuar avaliação', 'de volta à área: "Em avaliação" e "Continuar avaliação"');
  await page.click('#anIrProxima'); await page.waitForSelector('#poChecklist');
  afirma(/Perguntas respondidas: 3 de/.test(await texto(page, '#poProgresso')), 'retoma de onde parou (3 respostas guardadas)', await texto(page, '#poProgresso'));
  for (const [q, v] of [['O4', 'NAO'], ['O5', 'NAO']]) { await page.click('.po-resp[data-q="' + q + '"][data-v="' + v + '"]'); await page.waitForTimeout(80); }
  afirma(await page.$('#poComoNivelN3') !== null && /Dois SIM/.test(await texto(page, '#poComoNivelN3')) && /Ajuda da O9/.test(await texto(page, '#poComoNivelN3')), 'nível 3: como as respostas levam ao resultado (regra vigente) e onde está a Ajuda oficial O7 × O9');
  const ev = await texto(page, '#poComoNivelN3Evidencia');
  afirma(/não marque NÃO só por insegurança/.test(ev) && /salve o rascunho e busque esclarecimentos antes de concluir/.test(ev) && /não transforma uma resposta incerta em evidência/.test(ev),
    'sem evidência para O7/O9: não marcar NÃO por insegurança; salvar o rascunho e esclarecer antes de concluir; Observação não é evidência', ev);
  console.log('5. O7 e O9 SIM: a regra pede o diagnóstico');
  for (const [q, v] of [['O6', 'NAO'], ['O7', 'SIM'], ['O8', 'NAO'], ['O9', 'SIM']]) { await page.click('.po-resp[data-q="' + q + '"][data-v="' + v + '"]'); await page.waitForTimeout(80); }
  afirma(/diagnóstico do Nível 3/.test(await texto(page, '#poConcluirBtn')) && await page.$('.po-diag') !== null, 'O7 e O9 SIM: o sistema pede o diagnóstico (sem precedência silenciosa); o resultado seria "A validar"');
  await page.click('.po-resp[data-q="O7"][data-v="NAO"]'); await page.waitForTimeout(150);
  const fecha = await page.$('.po-modal .po-modal-sim'); if (fecha) await fecha.click();
  await page.click('#poConcluirBtn'); const sim = await page.$('.po-modal .po-modal-sim'); if (sim) await sim.click();
  await page.waitForSelector('#poResultado'); await page.waitForSelector('#poExplicacao');
  console.log('3. Resultado firme');
  afirma(/Avaliação concluída/.test(await texto(page, '#poSituacaoAvaliacao')) && /PLATAFORMA_CORPORATIVA/.test(await texto(page, '#poRecomendado')), 'recomendação firme: "Avaliação concluída" (decisão final opcional)');
  const e = await texto(page, '#poExplicacao');
  afirma(/O1 = SIM.*LINHA/.test(e) && /O4, O5 = NÃO/.test(e) && /O9 = SIM.*PLATAFORMA_CORPORATIVA/.test(e) && /seria "A validar"/.test(await texto(page, '#poExplicacaoAtencao')), 'como chegamos: O1 → Linha; O4/O5 NÃO → Plataforma; só O9 → Gestão Corporativa; e o aviso do único SIM no nível', e);
  const at = await texto(page, '#poExplicacaoAtencao');
  afirma(/reavaliação fundamentada/.test(at) && /não serve para compensar respostas dadas sem evidência/.test(at) && !/registre a decisão final/.test(at),
    'dúvida sobre respostas registradas: a orientação é a reavaliação fundamentada; a decisão final não compensa respostas sem evidência', at);
  await page.waitForTimeout(800);
  const p3 = await principais(page, '#avaliacoesPosicionamento');
  afirma(p3.length === 1 && /Voltar às responsabilidades da GECON/i.test(p3[0]), 'uma só ação principal: continuar a análise da GECON (decisão, vínculo e Squad são opcionais)', p3);
  console.log('4. Estrutura responsável opcional');
  if (await page.$('#poRespVincular')) {
    afirma(!(await page.$eval('#poRespVincular', (b) => b.classList.contains('btn--primary'))) && /etapa separada e opcional/.test(await texto(page, '#poRespAusente')), 'vincular: sem botão principal; o texto diz que é etapa separada e opcional');
    await page.click('#poRespVincular');
    const sem = await page.$('#poRespSemOpcoes');
    if (sem) afirma(/continua válida sem estrutura vinculada/.test(await texto(page, '#poRespSemOpcoes')) && /não é preciso cadastrar/.test(await texto(page, '#poRespSemOpcoes')), 'sem estrutura do tipo: a recomendação continua válida; não é preciso cadastrar para concluir nem para continuar');
  } else afirma(true, '(bloco da estrutura responsável indisponível neste perfil/marcador)');
  await page.evaluate(() => { location.hash = '#arquitetura?mf=catalogo'; });
  await esperar(page, () => Array.from(document.querySelectorAll('#mfItens .mf-item')).some((x) => /contabilidade gerencial/.test(x.textContent)));
  const item = await page.evaluate(() => Array.from(document.querySelectorAll('#mfItens .mf-item')).find((x) => /contabilidade gerencial/.test(x.textContent)).textContent.replace(/\s+/g, ' '));
  afirma(/Avaliação concluída · estrutura responsável: opcional/.test(item) && !/Próximo passo/.test(item), 'Jornada: "Avaliação concluída · estrutura responsável: opcional" (nunca "Próximo passo: Cadastrar estrutura")', item);
  console.log('6. Volta à área');
  await page.evaluate((h) => { location.hash = h; }, area); await page.waitForSelector('#anResponsabilidades');
  afirma(/1 avaliada e 9 prontas para avaliar/.test(await texto(page, '#anResumo')), 'progresso real: 1 avaliada e 9 prontas', await texto(page, '#anResumo'));
  afirma(JSON.stringify((await page.evaluate(() => window.__CFG.__dbReal['estruturas-concretas'])) || null) === estruturasAntes && JSON.stringify((await page.evaluate(() => window.__CFG.__dbReal['estruturas-vinculos'])) || null) === vinculosAntes,
    'nenhuma estrutura nem vínculo criado pela avaliação');
  afirma(await larguraOk(page), rot + ': sem rolagem lateral');
  afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    await jornada(browser, { width: 1280, height: 900 }, 'desktop');
    await jornada(browser, { width: 375, height: 812 }, '375 px');
  } catch (e) { console.log('ERRO', e && e.stack || e); falhas++; }
  await browser.close();
  console.log('\n' + total + ' verificações — ' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})();
