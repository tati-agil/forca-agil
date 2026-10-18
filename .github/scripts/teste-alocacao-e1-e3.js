/* E1–E3 DA ALOCAÇÃO — as três perguntas na tela: o que é, onde deveria estar e onde de fato ficou. Desktop e 375 px.
 * Firebase falso em persistência real; hermético; dados fictícios (semente-jornada + vínculos próprios deste teste).
 * Prova:
 *   1. Divergência deliberada (E2): a ficha mostra a situação neutra (não é erro nem "revisão"), o posicionamento quando foi
 *      alocada, o motivo, a justificativa organizacional, quem decidiu (opcional) e quem registrou; os textos de E1.
 *   2. Reavaliação que passou a coincidir com a estrutura: "Válido", e a divergência original continua à vista.
 *   3. Vincular em estrutura de OUTRO tipo pela tela: os campos da divergência só aparecem quando o tipo difere; sem
 *      motivo/justificativa não salva; com eles, salva e a recomendação não muda.
 *   4. Colaboradoras (E3): listadas com o papel; adicionar exige justificativa; encerrar exige motivo e fica no histórico.
 *   5. Mapa: a Linha mostra várias responsabilidades (principal e alocação divergente) e a colaboradora aparece com o papel;
 *      as caixas continuam sendo só estruturas.
 *   6. Perfil de consulta: vê tudo, não vê ações de gravar. 375 px sem rolagem lateral; nenhum erro de página. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const { semente, ARQ, AVAL, chave } = require('./semente-jornada');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
let falhas = 0;
function afirma(c, msg, det) { console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + (typeof det === 'string' ? det : JSON.stringify(det)) : '')); if (!c) falhas++; }

const T0 = 1791713600000;
const reg = (id, objetoId, estruturaId, avaliacaoId, codigo, origem, extra) => Object.assign({ id, objetoId, estruturaId, papel: 'responsavel-principal', base: { avaliacaoId, codigo, origem },
  situacao: 'ativa', revisao: 1, criadoEm: T0, criadoPor: { id: 'semente', email: 'semente@teste' }, ultimaOperacao: 'op-' + id, ultimoEvento: 'op-' + id + ':1' }, extra || {});
const est = (id, tipo, nome) => ({ id, tipo, nome, situacao: 'ativa', revisao: 1, criadaEm: T0, criadaPor: { id: 'semente', email: 'semente@teste' }, ultimaOperacao: 'op-' + id });
function sementeE123() {
  const db = semente();
  Object.assign(db['estruturas-concretas'].registros, { 'lec-1': est('lec-1', 'ESTRATEGIA_CLIENTES', 'Linha de Relacionamento'), 'pcn-1': est('pcn-1', 'PLATAFORMA_CANAIS', 'Plataforma de Canais') });
  const V = db['estruturas-vinculos'];
  /* Gestão de canais: recomendada como Plataforma de Canais, absorvida pela Linha de Previdência (divergência deliberada) */
  V.registros.v6 = reg('v6', 'pPlat', 'neg-1', 'gP', 'PLATAFORMA_CANAIS', 'recomendacao', { divergencia: { motivo: 'escala', justificativa: 'Canais absorvidos pela Linha de Previdência (fictício)', autoridade: 'Diretoria (fictício)' } });
  V['ativo-por-objeto'].pPlat = 'v6';
  /* Agilidade: alocada no CoE quando a recomendação era outra; a reavaliação passou a CoE → válido, divergência à vista */
  V.registros.v4 = reg('v4', 'oAgi', 'coe-ag', 'gA0', 'ESTRATEGIA_CLIENTES', 'recomendacao', { divergencia: { motivo: 'afinidade', justificativa: 'Afinidade com o CoE (fictício)' } });
  /* Capec: a Plataforma de Canais colabora */
  V.registros.v7 = reg('v7', 'pCapec', 'pcn-1', 'gC', 'NEGOCIOS', 'recomendacao', { papel: 'colaboradora', justificativa: 'Atendimento pelos canais (fictício)' });
  V['colaboradoras-ativas'] = { pCapec: { 'pcn-1': 'v7' } };
  return db;
}
async function abrir(browser, viewport, hash, email, extra) {
  const cfg = Object.assign({ db: sementeE123(), user: { email: email || ARQ, emailVerified: true, uid: 'u-' + chave(email || ARQ) }, delayDefault: 10, persistenciaReal: true }, extra || {});
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + hash, { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
const texto = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ').trim() : ''; }, sel);
const existe = (page, sel) => page.evaluate((s) => !!document.querySelector(s), sel);
const situacao = (page) => page.evaluate(() => { const e = document.getElementById('poRespSituacao'); return e ? e.getAttribute('data-situacao') : null; });
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const bloco = (page) => esperarCondicao(page, () => !!document.getElementById('poRespSituacao'), undefined, { limite: 15000, descricao: 'o bloco Estrutura responsável' });

async function rodada(browser, vp, rotulo) {
  console.log('\n=== ' + rotulo + ' ===');
  console.log('1. Divergência deliberada registrada (E2) e os textos das três perguntas (E1)');
  let { ctx, page, erros } = await abrir(browser, vp, '#arquitetura?po=gP&bloco=responsavel');
  await bloco(page);
  afirma(await situacao(page) === 'divergencia-deliberada' && /Divergência deliberada/.test(await texto(page, '#poRespSituacao')), 'situação "Divergência deliberada"');
  afirma(!(await existe(page, '#poRespRevisao')) && /não um erro/.test(await texto(page, '#poRespDivergencia')), 'não é erro nem "precisa de revisão"; a recomendação continua como está');
  afirma(/Plataforma|PLATAFORMA_CANAIS/.test(await texto(page, '#poRespBaseVinculo')) && /recomendação automática/.test(await texto(page, '#poRespBaseVinculo')), 'mostra o posicionamento quando foi alocada (base intacta)', await texto(page, '#poRespBaseVinculo'));
  afirma(/Escala/.test(await texto(page, '#poRespDivMotivo')) && /Canais absorvidos/.test(await texto(page, '#poRespDivJustificativa')) && /Diretoria \(fictício\)/.test(await texto(page, '#poRespDivAutoridade')) &&
    /não informada/.test(await texto(page, '#poRespDivReferencia')), 'motivo, justificativa organizacional, quem decidiu e referência (opcional, "não informada")');
  afirma(/semente@teste/.test(await texto(page, '#poRespDados')) && /Registrado no sistema/.test(await texto(page, '#poRespDados')), 'quem registrou aparece separado de quem decidiu');
  afirma(/organograma/.test(await texto(page, '#poRespIntro')) && /várias responsabilidades/.test(await texto(page, '#poRespIntro')), 'E1: o bloco diz onde a responsabilidade ficou e que não é o organograma');
  afirma(/não exige criar uma estrutura exclusiva/.test(await texto(page, '#poRecomendacaoSentido')) && /deveria estar/.test(await texto(page, '#poDecisaoSentido')), 'E1: recomendação não obriga estrutura exclusiva; decisão final = onde deveria estar');
  afirma(await larguraOk(page), 'sem rolagem lateral');
  await ctx.close();

  console.log('2. Reavaliação que passou a coincidir com a estrutura');
  ({ ctx, page, erros } = await abrir(browser, vp, '#arquitetura?po=gA&bloco=responsavel'));
  await bloco(page);
  afirma(await situacao(page) === 'valido' && /passou a coincidir/.test(await texto(page, '#poRespDivergenciaResolvida')) && /Afinidade com o CoE/.test(await texto(page, '#poRespDivJustificativa')),
    'fica "Válido", diz qual avaliação tornou compatível e a divergência original continua registrada');
  await ctx.close();

  console.log('3. Vincular em estrutura de outro tipo, pela tela');
  ({ ctx, page, erros } = await abrir(browser, vp, '#arquitetura?po=gPV&bloco=responsavel'));
  await bloco(page);
  await page.click('#poRespVincular');
  await page.waitForSelector('#poRespEstruturaSel');
  const grupos = await page.$$eval('#poRespEstruturaSel optgroup', (gs) => gs.map((g) => g.label));
  afirma(grupos.length === 2 && /Do tipo recomendado/.test(grupos[0]) && /De outro tipo/.test(grupos[1]), 'a escolha separa "do tipo recomendado" e "de outro tipo"', grupos);
  afirma(!(await page.$$eval('#poRespEstruturaSel option', (os) => os.some((o) => /Squad/i.test(o.textContent)))), 'nenhum Squad na escolha');
  await page.selectOption('#poRespEstruturaSel', 'neg-1');
  afirma(!(await existe(page, '#poRespDivCampos')), 'mesmo tipo: sem campos de divergência');
  await page.selectOption('#poRespEstruturaSel', 'coe-ag');
  await page.waitForSelector('#poRespDivCampos');
  afirma(/continua registrada como está/.test(await texto(page, '#poRespDivNota')), 'outro tipo: os campos da divergência aparecem, com o aviso de que a recomendação não muda');
  afirma(await larguraOk(page), 'formulário da divergência sem rolagem lateral');
  await page.click('#poRespSalvar');
  await page.waitForSelector('#poRespErros');
  afirma(/motivo|justificativa/i.test(await texto(page, '#poRespErros')) && await situacao(page) === 'ausente', 'sem motivo e justificativa: não salva', await texto(page, '#poRespErros'));
  await page.selectOption('#poRespDivMotivoSel', 'afinidade');
  await page.fill('#poRespDivJust', 'Afinidade com o CoE existente (fictício)');
  await page.fill('#poRespDivRef', 'Ata 1 (fictício)');
  await page.click('#poRespSalvar');
  await esperarCondicao(page, () => { const e = document.getElementById('poRespSituacao'); return !!e && e.getAttribute('data-situacao') === 'divergencia-deliberada'; }, undefined, { limite: 15000, descricao: 'a alocação divergente gravada' });
  afirma(/Ata 1/.test(await texto(page, '#poRespDivReferencia')) && /Afinidade/.test(await texto(page, '#poRespDivMotivo')) && /recomendação automática/.test(await texto(page, '#poRespBaseVinculo')),
    'salva com motivo, justificativa e referência; a base continua a recomendação');
  afirma(/recomendado/i.test(await texto(page, '#poBlocoRecomendacao')), 'a recomendação automática continua na ficha, intacta');

  console.log('4. Colaboradoras (E3)');
  await page.click('#poRespColaborar');
  await page.waitForSelector('#poRespEstruturaSel');
  const opcoesColab = await page.$$eval('#poRespEstruturaSel option', (os) => os.map((o) => o.value).filter(Boolean));
  afirma(opcoesColab.indexOf('coe-ag') === -1 && opcoesColab.indexOf('pcn-1') !== -1, 'a principal não é oferecida como colaboradora', opcoesColab);
  await page.selectOption('#poRespEstruturaSel', 'pcn-1');
  await page.click('#poRespSalvar');
  await page.waitForSelector('#poRespErros');
  afirma(/Explique o que esta estrutura faz/.test(await texto(page, '#poRespErros')), 'sem justificativa: não salva');
  await page.fill('#poRespJustificativa', 'Adesão pelos canais (fictício)');
  await page.click('#poRespSalvar');
  await page.waitForSelector('#poRespColabs .po-resp-colab');
  afirma(/Plataforma de Canais/.test(await texto(page, '#poRespColabs')) && /Colabora/.test(await texto(page, '#poRespColabs')) && /Adesão pelos canais/.test(await texto(page, '#poRespColabs')), 'colaboradora registrada, com o papel e o que faz');
  await page.click('.po-resp-colab-encerrar');
  await page.waitForSelector('#poRespMotivo');
  await page.click('#poRespSalvar');
  await page.waitForSelector('#poRespErros');
  afirma(/motivo/i.test(await texto(page, '#poRespErros')), 'encerrar participação exige motivo');
  await page.fill('#poRespMotivo', 'Fim da colaboração (fictício)');
  await page.click('#poRespSalvar');
  await page.waitForSelector('#poRespSemColab');
  afirma(await situacao(page) === 'divergencia-deliberada', 'encerrar a colaboradora não mexe no responsável principal');
  afirma(erros.length === 0, 'nenhum erro de página', erros);
  await ctx.close();

  console.log('5. Mapa: só estruturas; a Linha com várias responsabilidades; a colaboradora com o papel');
  ({ ctx, page, erros } = await abrir(browser, vp, '#arquitetura?mf=mapa&e=neg-1'));
  await page.waitForSelector('#mfmObjetos', { timeout: 20000 });
  const linhas = await page.$$eval('#mfmObjetos .mfm-objeto', (ls) => ls.map((l) => l.getAttribute('data-objeto') + ':' + l.getAttribute('data-papel')));
  afirma(linhas.length === 3 && linhas.every((l) => /responsavel-principal$/.test(l)), 'Linha de Previdência: três responsabilidades como principal (dois produtos e uma absorvida)', linhas);
  afirma(/recomendado/.test(await texto(page, '#mfmObjetos .mfm-objeto[data-objeto="pPlat"]')), 'a absorvida diz o que era recomendado');
  afirma(/Responsabilidades assumidas/.test(await texto(page, '#mfmObjetosIntro')), 'E1: uma estrutura pode assumir várias responsabilidades');
  await page.evaluate(() => { location.hash = '#arquitetura?mf=mapa&e=pcn-1'; });
  await esperarCondicao(page, () => !!document.querySelector('#mfmObjetos .mfm-objeto[data-objeto="pCapec"]'), undefined, { limite: 20000, descricao: 'o detalhe da Plataforma de Canais' });
  afirma(/Colabora/.test(await texto(page, '#mfmObjetos .mfm-objeto[data-objeto="pCapec"]')) && await page.$eval('#mfmObjetos .mfm-objeto[data-objeto="pCapec"]', (l) => l.getAttribute('data-papel')) === 'colaboradora',
    'a colaboradora aparece no detalhe da estrutura, com o papel');
  afirma(await larguraOk(page), 'Mapa sem rolagem lateral');
  await ctx.close();

  console.log('6. Perfil de consulta');
  ({ ctx, page, erros } = await abrir(browser, vp, '#arquitetura?po=gP&bloco=responsavel', AVAL));
  await bloco(page);
  afirma(await situacao(page) === 'divergencia-deliberada' && /Canais absorvidos/.test(await texto(page, '#poRespDivJustificativa')), 'consulta vê a divergência e a justificativa');
  afirma(!(await existe(page, '#poRespSubstituir')) && !(await existe(page, '#poRespColaborar')) && !(await existe(page, '#poRespEncerrar')), 'consulta não vê ações de gravar');
  await ctx.close();

  console.log('7. Perfil Avaliação (consulta) e as ligações oficiais: carregando × recusadas × sem resposta');
  /* um caso de inconsistência real: alocada (com divergência) numa Área Especializada quando o posicionamento era CoE; o
     posicionamento vigente passou a Negócios — nem a base nem o tipo da estrutura coincidem com ele */
  const dbInc = sementeE123();
  dbInc['estruturas-vinculos'].registros.v9 = reg('v9', 'pVinc', 'jur', 'gPV0', 'COE', 'recomendacao', { divergencia: { motivo: 'pessoas', justificativa: 'Equipe do Jurídico (fictício)' } });
  dbInc['estruturas-vinculos']['ativo-por-objeto'].pVinc = 'v9';
  const irPara = (h) => page.evaluate((x) => { location.hash = x; }, h);
  const situacaoVira = (esperado, desc) => esperarCondicao(page, (s) => { const e = document.getElementById('poRespSituacao'); return !!e && e.getAttribute('data-situacao') === s; }, esperado, { limite: 15000, descricao: desc });
  const lendo = () => page.evaluate(() => { const r = document.getElementById('poResponsavel'); return !!r && /Carregando a estrutura responsável/.test(r.textContent) && !document.getElementById('poRespSituacao'); });
  /* 1 + 3) as regras reais RECUSAM ao perfil Avaliação a leitura das ligações (aqui: depois de 3 s, como numa rede lenta).
     Enquanto lê: "Carregando…", sem conclusão. Depois: o tipo é conferido pelas próprias estruturas (sem acesso a mais) */
  ({ ctx, page, erros } = await abrir(browser, vp, '#arquitetura?po=gC&bloco=responsavel', AVAL, { db: dbInc, fail: ['posicionamento-classificacoes'], delays: { 'posicionamento-classificacoes': 3000 } }));
  await esperarCondicao(page, () => !!document.getElementById('poResponsavel'), undefined, { limite: 15000, descricao: 'o bloco' });
  afirma(await lendo(), 'consulta, ligações ainda carregando: "Carregando…", sem situação (nenhuma conclusão antecipada)', await texto(page, '#poResponsavel'));
  await situacaoVira('valido', 'gC conferido');
  afirma(!(await existe(page, '#poRespRevisao')) && !(await existe(page, '#poRespIndeterminada')), 'consulta, leitura recusada: vínculo compatível conferido pelas estruturas → "Válido" (sem falso "Precisa de revisão")', await texto(page, '#poResponsavel'));
  await irPara('#arquitetura?po=gP&bloco=responsavel'); await situacaoVira('divergencia-deliberada', 'gP');
  afirma(true, 'consulta, leitura recusada: a alocação divergente é identificada ("Divergência deliberada")');
  await irPara('#arquitetura?po=gA&bloco=responsavel'); await situacaoVira('valido', 'gA');
  afirma(true, 'consulta, leitura recusada: divergência resolvida pela reavaliação → "Válido"');
  await irPara('#arquitetura?po=gPV&bloco=responsavel'); await situacaoVira('precisa-revisao', 'gPV');
  afirma(/posicionamento efetivo do item mudou/.test(await texto(page, '#poRespRevisao')), 'consulta, leitura recusada: a inconsistência real é identificada ("Precisa de revisão")', await texto(page, '#poRespRevisao'));
  afirma(await larguraOk(page) && erros.length === 0, 'sem rolagem lateral e nenhum erro de página', erros);
  await ctx.close();
  /* 2) a leitura das ligações não responde (prazo de 20 s vencido): "Não conferido" — nunca "Válido" nem uma falsa revisão;
     "Conferir de novo" recupera sem recarregar o site (a rede voltou: aqui, a recusa normal das regras ao perfil) */
  ({ ctx, page, erros } = await abrir(browser, vp, '#arquitetura?po=gC&bloco=responsavel', AVAL, { db: dbInc, delays: { 'posicionamento-classificacoes': 600000 } }));
  await page.evaluate(() => { window.__semRecarregar = 1; });
  await esperarCondicao(page, () => !!document.getElementById('poResponsavel'), undefined, { limite: 15000, descricao: 'o bloco' });
  afirma(await lendo(), 'consulta, sem resposta, enquanto espera: "Carregando…", sem conclusão');
  await esperarCondicao(page, () => !!document.getElementById('poRespSituacao'), undefined, { limite: 30000, descricao: 'o prazo da leitura das ligações vencer' });
  afirma(await situacao(page) === 'indeterminada' && /Não conferido/.test(await texto(page, '#poRespSituacao')) && /não foi possível ler as ligações oficiais/.test(await texto(page, '#poRespIndeterminada')) && !(await existe(page, '#poRespRevisao')) && await existe(page, '#poRespReconferir'),
    'consulta, sem resposta: "Não conferido", com o motivo e "Conferir de novo" — nunca "Válido" nem "Precisa de revisão"', await texto(page, '#poResponsavel'));
  await irPara('#arquitetura?po=gPV&bloco=responsavel'); await situacaoVira('indeterminada', 'gPV sem resposta');
  afirma(true, 'consulta, sem resposta: alocação divergente com código novo também "Não conferido" (não se presume revisão)');
  const papelNoMapa = (obj) => page.evaluate((o) => { const e = document.querySelector('#mfmObjetos .mfm-objeto[data-objeto="' + o + '"] [data-situacao]'); return e ? e.getAttribute('data-situacao') : null; }, obj);
  await irPara('#arquitetura?mf=mapa&e=neg-1');
  await esperarCondicao(page, () => !!document.querySelector('#mfmObjetos .mfm-objeto[data-objeto="pCapec"] [data-situacao]'), undefined, { limite: 15000, descricao: 'o detalhe da Linha no Mapa' });
  afirma(await papelNoMapa('pCapec') === 'indeterminada' && await larguraOk(page), 'consulta, sem resposta: o Mapa mostra a mesma situação ("Não conferido"), sem rolagem lateral', await texto(page, '#mfmObjetos'));
  await irPara('#arquitetura?po=gC&bloco=responsavel'); await situacaoVira('indeterminada', 'gC de novo');
  await page.evaluate(() => { window.__CFG.delays = {}; window.__CFG.fail = ['posicionamento-classificacoes']; }); /* a rede voltou (as regras recusam ao perfil, como sempre) */
  await page.click('#poRespReconferir');
  await situacaoVira('valido', 'gC reconferido');
  afirma(!(await existe(page, '#poRespReconferir')), '"Conferir de novo": relê e passa a "Válido" (conferido pelas estruturas)');
  await irPara('#arquitetura?po=gPV&bloco=responsavel'); await situacaoVira('precisa-revisao', 'gPV reconferido');
  await irPara('#arquitetura?mf=mapa&e=neg-1');
  await esperarCondicao(page, () => { const e = document.querySelector('#mfmObjetos .mfm-objeto[data-objeto="pCapec"] [data-situacao]'); return !!e && e.getAttribute('data-situacao') === 'valido'; }, undefined, { limite: 15000, descricao: 'o Mapa reconferido' });
  afirma(await page.evaluate(() => window.__semRecarregar === 1) && erros.length === 0, 'recuperado sem recarregar o site: o bloco (inconsistência real em gPV) e o Mapa já mostram a situação real', erros);
  await ctx.close();
  /* 2b) quem lê as ligações (Avaliação + Configuração), sem resposta → "Não conferido" no bloco e na ficha da estrutura →
     "Conferir de novo" na ficha → as ligações oficiais lidas */
  ({ ctx, page, erros } = await abrir(browser, vp, '#arquitetura?po=gC&bloco=responsavel', ARQ, { delays: { 'posicionamento-classificacoes': 600000 } }));
  await page.evaluate(() => { window.__semRecarregar = 1; });
  await esperarCondicao(page, () => !!document.getElementById('poRespReconferir'), undefined, { limite: 30000, descricao: 'o prazo vencer' });
  afirma(await situacao(page) === 'indeterminada', 'configuração, sem resposta: "Não conferido"');
  await irPara('#arquitetura?arq=estruturas&e=neg-1');
  await esperarCondicao(page, () => !!document.querySelector('#estProdutos .est-produto[data-objeto="pCapec"] [data-situacao]') && !!document.getElementById('estReconferir'), undefined, { limite: 15000, descricao: 'a ficha da Linha' });
  afirma(await page.$eval('#estProdutos .est-produto[data-objeto="pCapec"] [data-situacao]', (e) => e.getAttribute('data-situacao')) === 'indeterminada' && await larguraOk(page),
    'configuração, sem resposta: a ficha da estrutura mostra "Não conferido" e "Conferir de novo", sem rolagem lateral', await texto(page, '#estProdutos'));
  await page.evaluate(() => { window.__CFG.delays = {}; });
  await page.click('#estReconferir');
  await esperarCondicao(page, () => { const e = document.querySelector('#estProdutos .est-produto[data-objeto="pCapec"] [data-situacao]'); return !!e && e.getAttribute('data-situacao') === 'valido'; }, undefined, { limite: 15000, descricao: 'a ficha reconferida' });
  afirma(!(await existe(page, '#estReconferir')), '"Conferir de novo" na ficha: relê as ligações oficiais e passa a "Válido"');
  await irPara('#arquitetura?po=gC&bloco=responsavel'); await situacaoVira('valido', 'bloco depois da ficha');
  afirma(await page.evaluate(() => window.__semRecarregar === 1) && erros.length === 0, 'sem recarregar o site: o bloco do Posicionamento também já mostra "Válido"', erros);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    await rodada(browser, { width: 1280, height: 900 }, 'desktop');
    await rodada(browser, { width: 375, height: 812 }, '375 px');
  } catch (e) { console.error('ERRO', e); falhas++; }
  await browser.close();
  console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
  process.exit(falhas ? 1 : 0);
})();
