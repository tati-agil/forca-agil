/* E4 — RELAÇÕES ENTRE OBJETOS na tela (relacoes-objetos.js), com o Firebase falso em persistência real. Desktop e 375 px.
 * Prova:
 *   1. Registro do objeto (Trabalhos): natureza individual registrada uma vez, por quem mantém, só entre as naturezas da
 *      classificação e só com conceito oficial (a sem definição aparece como indisponível); nada deduzido.
 *   2. Relacionar: a frase só oferece as leituras que a natureza admite; a busca só mostra objetos de natureza compatível;
 *      salva uma relação com natureza e base; aparece nas DUAS pontas, com a leitura de cada lado.
 *   3. Ida e volta entre registros (link → registro do outro objeto → "← Voltar para o registro" → o primeiro), F5.
 *   4. Encerrar: motivo obrigatório; a relação continua, em "Encerradas".
 *   5. Porta 2: natureza "Responsabilidade organizacional"; "atua sobre" um objeto P1–P16, com a frase "não é alocação".
 *   6. Perfil Avaliação: consulta, sem nenhum controle. Marcador false: "Gravação suspensa", sem controles; ausente:
 *      nada da E4 aparece.
 *   7. Taxonomia (administração geral): cartão das naturezas individuais; criar conceito exige nome, definição e a
 *      confirmação de que a definição foi aprovada; grava naturezaDe da classificação.
 *   8. Resumos só de leitura: ficha P1–P16, ficha do Posicionamento e detalhe da estrutura no Mapa. O Mapa continua só
 *      com estruturas (nenhuma caixa nova).
 *   Em todos: sem rolagem lateral, nenhum erro de JS. */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const SJ = require('./semente-jornada');
const R = require(path.join(__dirname, '..', '..', 'forca-agil', 'relacoes-objetos-nucleo.js'));

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
let falhas = 0;
function afirma(c, msg, det) { console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + (typeof det === 'string' ? det : JSON.stringify(det)) : '')); if (!c) falhas++; }

const T = '2026-10-18T09:00:00.000Z';
function conceito(nome, camada) { return { nome, ordem: 100, ativo: true, naturezaDe: camada, definicao: { texto: 'Definição aprovada de ' + nome + ' (teste).', versao: 1, publicadaEm: T, publicadaPor: 'adm@previ.com.br' } }; }
function banco(o) {
  o = o || {};
  const db = SJ.semente();
  const base = db['avaliacoes-produto'].pCapec;
  const item = (id, nome, camada, decisao) => Object.assign(JSON.parse(JSON.stringify(base)), { itemId: id, nome, decisaoFinal: decisao || 'nao-produto', resultadoAutomatico: decisao || 'nao-produto', camadaSugerida: { id: camada, label: camada } });
  Object.assign(db['avaliacoes-produto'], {
    cMotor: item('cMotor', 'Motor de cálculo de renda (teste)', 'componente'),
    fSim: item('fSim', 'Simulação de aposentadoria (teste)', 'funcionalidade-operacao'),
    oCalc: item('oCalc', 'Cálculo de imposto (teste)', 'funcionalidade-operacao'),
    rCar: item('rCar', 'Regra de carência (teste)', 'regra-condicao'),
    mPerf: item('mPerf', 'Perfil de investimento (teste)', 'modalidade-subproduto')
  });
  Object.assign(db['avaliacoes-produto-ponta'], { cMotor: 'cMotor', fSim: 'fSim', oCalc: 'oCalc', rCar: 'rCar', mPerf: 'mPerf' }); /* versão vigente de cada item novo */
  if (o.semIndice) delete db['avaliacoes-produto-ponta'][o.semIndice]; /* item antigo ainda não reconciliado */
  db['objetos-natureza'] = { oCalc: { natureza: 'operacao', camada: 'funcionalidade-operacao', avaliacaoId: 'oCalc', revisao: 1, registradaEm: 1, registradaPor: { id: 'u', email: SJ.ARQ }, auditoriaId: 'a0' } };
  db.taxonomia.arquitetural = { conceitos: { funcionalidade: conceito('Funcionalidade', 'funcionalidade-operacao'), operacao: conceito('Operação', 'funcionalidade-operacao'), regra: conceito('Regra', 'regra-condicao'), opcao: conceito('Opção', 'modalidade-subproduto'), modalidade: conceito('Modalidade', 'modalidade-subproduto') } };
  if (o.adminGeral) db['fa-admins'] = { [SJ.chave(SJ.ARQ)]: { email: SJ.ARQ, name: 'ADMIN' } };
  if (o.marcador === null) delete db['relacoes-objetos-config'];
  else if (o.marcador !== undefined) db['relacoes-objetos-config'] = { gravacaoHabilitada: o.marcador };
  if (o.relacoes) db['relacoes-objetos'] = o.relacoes;
  return db;
}
async function abrir(browser, vp, hash, o) {
  o = o || {};
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify({ db: banco(o), user: { email: o.email || SJ.ARQ, emailVerified: true, uid: 'u-' + SJ.chave(o.email || SJ.ARQ) }, delayDefault: 10, persistenciaReal: true }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  if (o.atrasarModulo) {
    /* rede lenta só para o módulo da E4: o login termina antes de ele chegar (conta os eventos perdidos) */
    await ctx.addInitScript(() => { window.__evAntesDoModulo = 0; ['fa-auth-ready', 'fa-auth-change', 'fa-avaliacao-ready', 'fa-admin-ready'].forEach((n) => window.addEventListener(n, () => { if (!window.faRelacoesObjetos) window.__evAntesDoModulo++; })); });
    await page.route('**/forca-agil/relacoes-objetos.js', async (r) => { await new Promise((ok) => setTimeout(ok, o.atrasarModulo)); r.continue(); });
  }
  await page.goto(BASE + '/index.html' + hash, { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
/* textContent: o texto como escrito (o CSS mostra títulos de grupo e alguns botões em maiúsculas) */
const texto = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; }, sel);
const existe = (page, sel) => page.evaluate((s) => !!document.querySelector(s), sel);
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const lerBanco = (page, p) => page.evaluate((x) => window.firebase.database().ref(x).once('value').then((s) => s.val()), p);
const ate = (page, fn, arg, descricao, limite) => esperarCondicao(page, fn, arg, { limite: limite || 15000, descricao });
/* identificação orientada: escolhe a alternativa, escreve justificativa (e diagnóstico, se for pendência) e registra */
async function identificar(page, alt, justificativa, diagnostico) {
  await page.check('input[name="roIdentAlt"][value="' + alt + '"]');
  if (diagnostico !== undefined) { await page.waitForSelector('#roIdentDiag'); await page.fill('#roIdentDiag', diagnostico); }
  await page.fill('#roIdentJust', justificativa);
  await page.click('#roIdentSalvar');
}
const alternativas = (page) => page.$$eval('input[name="roIdentAlt"]', (is) => is.map((i) => i.value + (i.disabled ? '(x)' : '')).join());
const secaoPronta = (page) => ate(page, () => { const s = document.getElementById('roSecao'); return !!s && !s.querySelector('.loading-msg'); }, undefined, 'a seção de relações');

async function rodada(browser, vp, tag) {
  console.log('\n######## ' + tag + ' ########');
  let r, page;

  console.log('1. Natureza individual');
  r = await abrir(browser, vp, '#arquitetura?tr=1&item=fSim'); page = r.page;
  await secaoPronta(page);
  afirma(/Natureza arquitetural ainda não identificada/.test(await texto(page, '#roNatureza')), 'classificação técnica sem registro: a natureza não é deduzida');
  afirma(/Classificação técnica do motor:.*não é a natureza do objeto/.test(await texto(page, '#roClassifTecnica')), 'a classificação técnica do motor aparece separada, dizendo que não é a natureza');
  afirma(/recurso que o público encontra e usa/.test(await texto(page, '#roIdentPergunta')) && /consultar saldo/.test(await texto(page, '#roIdentOrientacao')), 'pergunta orientadora e a explicação de que "consultar saldo" pode ser recurso ou ação');
  afirma(/Definição aprovada de Funcionalidade/.test(await texto(page, '#roIdentDefinicoes')) && /Definição aprovada de Operação/.test(await texto(page, '#roIdentDefinicoes')), 'as definições oficiais das duas naturezas, lidas da Taxonomia');
  afirma((await alternativas(page)) === 'funcionalidade,operacao,recorte,evidencia-insuficiente', 'alternativas: as duas naturezas + recorte + evidência insuficiente', await alternativas(page));
  afirma(await page.locator('.ro-ident-quando').count() === 4, 'cada alternativa diz quando marcar');
  afirma(!(await existe(page, '#roRelacionar')), 'sem natureza, não oferece relacionar');
  await page.click('#roIdentSalvar');
  await ate(page, () => !!document.getElementById('roErros'), undefined, 'escolha obrigatória');
  afirma(/Escolha a alternativa/.test(await texto(page, '#roErros')), 'sem escolher, não registra');
  await page.check('input[name="roIdentAlt"][value="funcionalidade"]'); await page.click('#roIdentSalvar');
  await ate(page, () => /justificativa/.test((document.getElementById('roErros') || {}).textContent || ''), undefined, 'justificativa obrigatória');
  afirma(true, 'sem justificativa, não registra');
  await identificar(page, 'funcionalidade', 'O público usa a simulação dentro do produto (teste)');
  await ate(page, () => /identificada:\s*Funcionalidade/.test((document.getElementById('roNatureza') || {}).textContent || ''), undefined, 'natureza identificada');
  afirma(/O público usa a simulação/.test(await texto(page, '#roFundamento')), 'a ficha mostra o fundamento (alternativa e justificativa)');
  const nat = await lerBanco(page, 'objetos-natureza/fSim');
  afirma(nat && nat.natureza === 'funcionalidade' && nat.camada === 'funcionalidade-operacao' && nat.avaliacaoId === 'fSim' && nat.revisao === 1 && nat.fundamento && nat.fundamento.versao === 1 && /recurso/.test(nat.fundamento.pergunta) && nat.fundamento.definicoes && /Funcionalidade/.test(nat.fundamento.definicoes.funcionalidade.texto),
    'gravou a natureza com o fundamento e o snapshot da pergunta e das definições da época', nat);
  const av = await lerBanco(page, 'avaliacoes-produto/fSim');
  afirma(!av.natureza && !av.naturezaIndividual && av.camadaSugerida.id === 'funcionalidade-operacao', 'a avaliação P1–P16 não foi alterada');

  console.log('1b. E5 — Modalidade, Subproduto e Opção (item de modalidade-subproduto)');
  {
    const r2 = await abrir(browser, vp, '#arquitetura?tr=1&item=mPerf'); const pg = r2.page;
    await secaoPronta(pg);
    afirma(/Natureza arquitetural ainda não identificada/.test(await texto(pg, '#roNatureza')), 'E5: a classificação do motor não decide a natureza (nada deduzido)');
    afirma((await alternativas(pg)) === 'modalidade,subproduto(x),opcao,recorte,evidencia-insuficiente', 'E5: Modalidade, Subproduto e Opção distintas; Subproduto sem conceito oficial fica indisponível', await alternativas(pg));
    afirma(/Não basta existir uma escolha/.test(await texto(pg, '#roIdentOrientacao')) && /não define Modalidade/.test(await texto(pg, '#roIdentOrientacao')) && /pendente/.test(await texto(pg, '#roIdentOrientacao')), 'E5: orientação aprovada (o que o objeto é; regras próprias não definem Modalidade; sem distinção → pendente)');
    afirma(/opção tributária/.test(await texto(pg, '#roIdentExemplos')) && !/perfil/i.test(await texto(pg, '#roIdentExemplos')), 'E5: só exemplos validados (opção tributária); nada de exemplo institucional não validado');
    await identificar(pg, 'modalidade', 'Forma específica de utilizar o produto (teste)');
    await ate(pg, () => /identificada:\s*Modalidade/.test((document.getElementById('roNatureza') || {}).textContent || ''), undefined, 'Modalidade registrada');
    const nm = await lerBanco(pg, 'objetos-natureza/mPerf');
    afirma(nm && nm.natureza === 'modalidade' && nm.camada === 'modalidade-subproduto' && nm.avaliacaoId === 'mPerf', 'E5: Modalidade registrada no objeto, com a avaliação vigente', nm);
    afirma((await lerBanco(pg, 'avaliacoes-produto/mPerf')).camadaSugerida.id === 'modalidade-subproduto', 'E5: a avaliação (classificação histórica do motor) não foi alterada');
    /* Regra/Opção: quem é Opção vira pendência "reavaliação necessária" (Opção nunca é registrada em regra-condicao) */
    const r4 = await abrir(browser, vp, '#arquitetura?tr=1&item=rCar'); const p4 = r4.page;
    await secaoPronta(p4);
    afirma((await alternativas(p4)) === 'regra,opcao-reavaliar,recorte,evidencia-insuficiente' && /admite só Regra/.test(await texto(p4, '#roIdentOrientacao')), 'Regra/Opção: só Regra como natureza; a alternativa "Opção" leva à reavaliação, nunca a registrar Opção');
    await identificar(p4, 'opcao-reavaliar', 'O participante escolhe a alternativa entre as que a regra permite (teste)', 'O objeto é uma alternativa escolhida, não uma condição imposta (teste)');
    await ate(p4, () => !!document.querySelector('#roNatureza[data-pendencia="reavaliacao-necessaria"]'), undefined, 'pendência registrada');
    afirma(/Identificação pendente:\s*Reavaliação P1–P16 necessária/.test(await texto(p4, '#roNatureza')) && /reavaliar o P1–P16/.test(await texto(p4, '#roNatureza')) && /alternativa escolhida/.test(await texto(p4, '#roNatureza')), 'a ficha mostra a pendência, o diagnóstico, a justificativa e o próximo passo');
    const np = await lerBanco(p4, 'objetos-natureza/rCar');
    afirma(np && !np.natureza && np.pendencia && np.pendencia.motivo === 'reavaliacao-necessaria' && np.avaliacaoId === 'rCar' && np.pendencia.versao === 1, 'pendência gravada no mesmo registro, sem natureza, com a versão da avaliação e da orientação', np);
    afirma(!(await existe(p4, '#roRelacionar')) && (await lerBanco(p4, 'avaliacoes-produto/rCar')).camadaSugerida.id === 'regra-condicao', 'pendência não autoriza relação; a classificação histórica não foi trocada');
    await p4.click('#roCorrigirNatureza');
    await identificar(p4, 'regra', 'Revisto: é uma condição imposta (teste)');
    await ate(p4, () => /identificada:\s*Regra/.test((document.getElementById('roNatureza') || {}).textContent || ''), undefined, 'retomada: Regra identificada');
    const auds = Object.values((await lerBanco(p4, 'objetos-natureza-auditoria/rCar')) || {});
    afirma(auds.length === 2 && auds.some((x) => x.tipo === 'pendencia') && auds.some((x) => x.tipo === 'alteracao' && x.fundamento && !x.anterior), 'retomar a identificação: revisão + 1; a auditoria guarda a pendência e a identificação', auds.map((x) => x.tipo).join());
    afirma(r4.erros.length === 0 && await larguraOk(p4), 'Regra/Opção: sem erro de JS e sem rolagem lateral');
    await r4.ctx.close();
    /* ficha P1–P16: a mesma etapa; registro anterior sem fundamento aparece como tal */
    const r5 = await abrir(browser, vp, '#arquitetura?avp=oCalc'); const p5 = r5.page;
    await ate(p5, () => !!document.querySelector('#roSecaoNatureza #roNatureza'), undefined, 'natureza na ficha P1–P16', 20000);
    afirma(/Classificação técnica do motor/.test(await texto(p5, '#roSecaoNatureza')) && /identificada:\s*Operação/.test(await texto(p5, '#roSecaoNatureza #roNatureza')) && /Registrada sem fundamento/.test(await texto(p5, '#roSecaoNatureza #roFundamento')),
      'ficha P1–P16: classificação técnica × natureza identificada; registro anterior aparece "sem fundamento"');
    afirma(r5.erros.length === 0 && await larguraOk(p5), 'ficha P1–P16: sem erro de JS e sem rolagem lateral');
    await r5.ctx.close();
    afirma(r2.erros.length === 0 && await larguraOk(pg), 'E5: sem erro de JS e sem rolagem lateral');
    await r2.ctx.close();
    const r3 = await abrir(browser, vp, '#arquitetura?tr=1&item=oAgi'); const p3 = r3.page;
    await secaoPronta(p3);
    await p3.click('#roRelacionar'); await p3.selectOption('#roLeitura', { label: 'atua sobre' });
    await ate(p3, () => !!document.getElementById('roCandidatos'), undefined, 'candidatos de atua sobre');
    afirma(!(await existe(p3, 'input[name="roOutro"][value="mPerf"]')), 'E5: item de Modalidade/Subproduto SEM natureza registrada não é candidato (a natureza tem de ser explícita)');
    await r3.ctx.close();
  }

  console.log('2. Relacionar');
  await page.click('#roRelacionar');
  const leituras = await page.$$eval('#roLeitura option', (os) => os.map((o) => o.textContent).filter((t) => t !== 'escolha…'));
  afirma(JSON.stringify(leituras.slice().sort()) === JSON.stringify(['usa', 'faz parte de', 'é acessado por meio de', 'é objeto de atuação de'].sort()), 'Funcionalidade: só as leituras da matriz (usa · faz parte de · é acessado por meio de · é objeto de atuação de)', leituras);
  await page.selectOption('#roLeitura', { label: 'usa' });
  await ate(page, () => !!document.getElementById('roCandidatos'), undefined, 'candidatos');
  const cands = await page.$$eval('input[name="roOutro"]', (is) => is.map((i) => i.value));
  afirma(JSON.stringify(cands) === JSON.stringify(['oCalc']), '"usa": só objetos de natureza Operação (Funcionalidade usa Operação)', cands);
  await page.click('#roSalvarRelacao');
  await ate(page, () => !!document.getElementById('roErros'), undefined, 'erro sem escolher');
  afirma(/Escolha o outro objeto/.test(await texto(page, '#roErros')), 'salvar sem escolher o outro objeto explica e não grava');
  await page.check('input[name="roOutro"][value="oCalc"]');
  await page.fill('#roObs', 'A simulação calcula o imposto (teste)');
  afirma(await larguraOk(page), 'formulário aberto sem rolagem lateral');
  await page.click('#roSalvarRelacao');
  await ate(page, () => /Relação registrada/.test((document.getElementById('roFlash') || {}).textContent || ''), undefined, 'relação registrada');
  const regs = (await lerBanco(page, 'relacoes-objetos/registros')) || {}, rel = Object.values(regs)[0];
  afirma(rel && rel.origem === 'fSim' && rel.tipo === 'usa' && rel.destino === 'oCalc' && rel.naturezaOrigem === 'funcionalidade' && rel.naturezaDestino === 'operacao' && rel.baseOrigem === 'fSim' && rel.observacao === 'A simulação calcula o imposto (teste)',
    'gravou a relação com naturezas, bases e observação', rel);
  afirma(/Usa/.test(await texto(page, '#roLista')) && /Cálculo de imposto \(teste\)/.test(await texto(page, '#roLista')), 'aparece em "Usa" no registro da Funcionalidade');

  console.log('3. Ida e volta');
  await page.click('#roLista a.ro-link');
  await ate(page, () => /item=oCalc/.test(location.hash) && !!document.getElementById('roSecao') && /É usado por/.test(document.getElementById('roSecao').textContent), undefined, 'registro da Operação');
  afirma(/Simulação de aposentadoria/.test(await texto(page, '#roLista')), 'a outra ponta mostra a leitura inversa ("É usado por")');
  afirma(await texto(page, '#mfVoltarLista') === '← Voltar para o registro', 'o retorno diz para onde vai: "← Voltar para o registro"', await texto(page, '#mfVoltarLista'));
  /* (o F5 é provado no bloco 8, com relação semeada: o Firebase falso recomeça da semente a cada carregamento) */
  await page.click('#mfVoltarLista');
  await ate(page, () => /item=fSim/.test(location.hash) && !!document.getElementById('roSecao'), undefined, 'de volta ao registro da Funcionalidade');
  afirma(true, '"← Voltar para o registro" volta ao registro de origem');

  console.log('4. Encerrar');
  await secaoPronta(page);
  await page.click('.ro-encerrar');
  await page.click('#roConfirmarEncerrar');
  await ate(page, () => !!document.getElementById('roErros'), undefined, 'erro sem motivo');
  afirma(/motivo/.test(await texto(page, '#roErros')), 'encerrar sem motivo é recusado com explicação');
  await page.fill('#roMotivo', 'A simulação deixou de calcular imposto (teste)');
  await page.click('#roConfirmarEncerrar');
  await ate(page, () => /encerrada/.test((document.getElementById('roFlash') || {}).textContent || ''), undefined, 'encerrada');
  const enc = Object.values((await lerBanco(page, 'relacoes-objetos/registros')) || {})[0];
  afirma(enc.situacao === 'encerrada' && enc.encerramento.motivo === 'A simulação deixou de calcular imposto (teste)' && await existe(page, '#roEncerradas'), 'encerrada com motivo, continua registrada (em "Encerradas")');
  afirma(r.erros.length === 0 && await larguraOk(page), 'sem erro de JS e sem rolagem lateral');
  await r.ctx.close();

  console.log('5. Composição e Porta 2');
  r = await abrir(browser, vp, '#arquitetura?tr=1&item=cMotor'); page = r.page;
  await secaoPronta(page);
  afirma(/Natureza arquitetural:\s*Componente/.test(await texto(page, '#roNatureza')) && !(await existe(page, '#roClassifTecnica')), 'Componente: a natureza é a própria classificação (sem etapa de identificação)');
  await page.click('#roRelacionar'); await page.selectOption('#roLeitura', { label: 'faz parte de' });
  await ate(page, () => !!document.getElementById('roCandidatos'), undefined, 'candidatos');
  const prods = await page.$$eval('input[name="roOutro"]', (is) => is.map((i) => i.value));
  afirma(prods.indexOf('pCapec') !== -1 && prods.indexOf('fSim') === -1 && prods.indexOf('oCalc') === -1, '"faz parte de": só Produtos/Serviços', prods);
  await page.fill('#roBusca', 'capec');
  await ate(page, () => document.querySelectorAll('input[name="roOutro"]').length === 1, undefined, 'busca filtra');
  await page.check('input[name="roOutro"][value="pCapec"]'); await page.click('#roSalvarRelacao');
  await ate(page, () => /Relação registrada/.test((document.getElementById('roFlash') || {}).textContent || ''), undefined, 'composição registrada');
  afirma((await lerBanco(page, 'relacoes-objetos/versao-compoe')) === 1, '"compõe" incrementou o contador do grafo');
  await r.ctx.close();
  r = await abrir(browser, vp, '#arquitetura?tr=1&item=oAgi'); page = r.page;
  await secaoPronta(page);
  afirma(/Responsabilidade organizacional/.test(await texto(page, '#roNatureza')) && /não é alocação nem vínculo/.test(await texto(page, '#roNotaPorta2')), 'Porta 2: identidade própria e a frase "não é alocação nem vínculo"');
  await page.click('#roRelacionar');
  afirma(JSON.stringify(await page.$$eval('#roLeitura option', (os) => os.map((o) => o.textContent).filter((t) => t !== 'escolha…'))) === JSON.stringify(['atua sobre']), 'Porta 2 só "atua sobre" (sem "abrange")');
  await page.selectOption('#roLeitura', { label: 'atua sobre' });
  await ate(page, () => !!document.querySelector('input[name="roOutro"][value="pCapec"]'), undefined, 'candidatos P1–P16');
  await page.check('input[name="roOutro"][value="pCapec"]'); await page.click('#roSalvarRelacao');
  await ate(page, () => /Relação registrada/.test((document.getElementById('roFlash') || {}).textContent || ''), undefined, 'atua sobre registrada');
  afirma(r.erros.length === 0 && await larguraOk(page), 'sem erro de JS e sem rolagem lateral');
  await r.ctx.close();

  console.log('6. Perfis e liberação');
  const relSemente = { registros: { r1: { id: 'r1', origem: 'cMotor', tipo: 'compoe', destino: 'pCapec', naturezaOrigem: 'componente', naturezaDestino: 'produto', baseOrigem: 'cMotor', baseDestino: 'pCapec', versaoMatriz: 1, situacao: 'ativa', revisao: 1, criadaEm: 1, criadaPor: { id: 'u', email: SJ.ARQ }, ultimaOperacao: 'op1', ultimoEvento: 'op1:1' } } };
  r = await abrir(browser, vp, '#arquitetura?tr=1&item=pCapec', { email: SJ.AVAL, relacoes: relSemente }); page = r.page;
  await secaoPronta(page);
  afirma(/Motor de cálculo de renda/.test(await texto(page, '#roLista')) && !(await existe(page, '#roRelacionar')) && !(await existe(page, '.ro-encerrar')) && !(await existe(page, '#roIdentSalvar')), 'perfil Avaliação vê as relações, sem nenhum controle');
  await r.ctx.close();
  r = await abrir(browser, vp, '#arquitetura?tr=1&item=pCapec', { marcador: false, relacoes: relSemente }); page = r.page;
  await secaoPronta(page);
  afirma(/Gravação suspensa/.test(await texto(page, '#roSecao')) && !(await existe(page, '#roRelacionar')) && !(await existe(page, '.ro-encerrar')), 'marcador false: "Gravação suspensa", só consulta');
  await r.ctx.close();
  r = await abrir(browser, vp, '#arquitetura?tr=1&item=pCapec', { marcador: null, relacoes: relSemente }); page = r.page;
  await ate(page, () => !!document.querySelector('[data-ro-secao]') && !!document.querySelector('.mf-item--detalhe'), undefined, 'registro sem a E4');
  await page.waitForTimeout(800);
  afirma(!(await existe(page, '#roSecao')), 'marcador ausente (produção hoje): nada da E4 aparece');
  await r.ctx.close();

  console.log('7. Taxonomia (o cadastro dos conceitos independe do marcador da E4 — C41)');
  /* marcador ausente (produção hoje), false e true: o cartão aparece para a administração geral e cria o conceito pela
     mesma rotina; o conceito que já existe não oferece "Criar" (sem duplicar) */
  for (const [marc, cod, nome] of [[null, 'processo', 'Processo'], [false, 'etapa', 'Etapa'], [true, 'documento', 'Documento']]) {
    const rot = 'marcador ' + (marc === null ? 'ausente' : String(marc));
    r = await abrir(browser, vp, '#arquitetura?arq=taxonomia', { adminGeral: true, marcador: marc }); page = r.page;
    /* as Verificações do sistema ficam na Administração de um conceito (como em teste-classificacoes-fonte-unica.js) */
    await ate(page, () => !!document.querySelector('.tax-dominio[data-dominio="arquitetural"]'), undefined, 'Taxonomia', 20000);
    await page.click('.tax-dominio[data-dominio="arquitetural"]');
    await ate(page, () => !!document.querySelector('.tax-item'), undefined, 'conceitos arquiteturais');
    await page.click('.tax-item');
    await page.click('#taxAdministrarBtn');
    await ate(page, () => !!document.getElementById('taxVerificacoesLink'), undefined, 'link das Verificações');
    await page.click('#taxVerificacoesLink');
    await ate(page, (c) => !!document.querySelector('#roTaxLista [data-codigo="' + c + '"]'), cod, 'cartão das naturezas (' + rot + ')', 20000);
    afirma(/conceitos oficiais/.test(await texto(page, '#roTaxTitulo')) && !/relações entre objetos/.test(await texto(page, '#roTaxTitulo')), rot + ': o cartão é da Taxonomia ("Naturezas individuais — conceitos oficiais")');
    afirma(await page.$eval('#roTaxLista [data-codigo="operacao"]', (e) => e.getAttribute('data-pronto')) === '1' && /sem conceito oficial/.test(await texto(page, '#roTaxLista [data-codigo="' + cod + '"]')), rot + ': mostra quais naturezas têm conceito oficial e quais não');
    afirma(!(await existe(page, '.ro-tax-criar[data-codigo="operacao"]')) && !(await existe(page, '.ro-tax-criar[data-codigo="funcionalidade"]')), rot + ': conceito que já existe não oferece "Criar" (sem duplicar)');
    await page.click('.ro-tax-criar[data-codigo="' + cod + '"]');
    await page.fill('#roTaxNome', nome); await page.fill('#roTaxDef', 'Definição aprovada de ' + nome + ' (teste).');
    if (marc === null) {
      await page.click('#roTaxSalvar');
      await ate(page, () => !!document.getElementById('roTaxErros'), undefined, 'confirmação exigida');
      afirma(/aprovada/.test(await texto(page, '#roTaxErros')), 'sem a confirmação de que a definição foi aprovada, não cria');
    }
    await page.check('#roTaxAprovada'); await page.click('#roTaxSalvar');
    await ate(page, () => /Conceito criado/.test((document.getElementById('roTaxFlash') || {}).textContent || ''), undefined, 'conceito criado', 20000);
    const cp = await lerBanco(page, 'taxonomia/arquitetural/conceitos/' + cod);
    const aud = await lerBanco(page, 'taxonomia/arquitetural/auditoria/' + cod);
    afirma(cp && cp.naturezaDe === R.NATUREZAS[cod].camada && cp.ativo === true && cp.definicao && cp.definicao.versao === 1 && Object.values(aud || {}).some((a) => a.tipo === 'conceito_criado'), rot + ': conceito criado com naturezaDe da classificação, definição v1 e auditoria', cp);
    afirma(!(await existe(page, '.ro-tax-criar[data-codigo="' + cod + '"]')) && (await page.$eval('#roTaxLista [data-codigo="' + cod + '"]', (e) => e.getAttribute('data-pronto'))) === '1', rot + ': depois de criado, pronto para uso e sem "Criar" de novo');
    afirma((await lerBanco(page, R.MARCADOR)) === marc && (await lerBanco(page, R.RAIZ)) === null, rot + ': o marcador da E4 não muda e nenhuma relação é gravada');
    afirma(r.erros.length === 0 && await larguraOk(page), rot + ': sem erro de JS e sem rolagem lateral');
    await r.ctx.close();
  }
  /* sem administração geral (Avaliação + Configuração): a Taxonomia não é dela e o cartão não aparece */
  r = await abrir(browser, vp, '#arquitetura?arq=taxonomia', { marcador: null }); page = r.page;
  await page.waitForTimeout(1500);
  afirma(!(await existe(page, '#roTaxonomia')) && !(await existe(page, '.ro-tax-criar')), 'sem administração geral: nenhum cartão de cadastro de conceitos');
  await r.ctx.close();

  console.log('8. F5, resumos e Mapa');
  r = await abrir(browser, vp, '#arquitetura?tr=1&item=pCapec', { relacoes: relSemente }); page = r.page;
  await secaoPronta(page);
  afirma(/É composto por/.test(await texto(page, '#roLista')), 'o Produto/Serviço mostra a leitura inversa da composição ("É composto por")');
  await page.click('#roLista a.ro-link');
  await ate(page, () => /item=cMotor/.test(location.hash) && !!document.getElementById('roSecao') && /Faz parte de/.test(document.getElementById('roSecao').textContent), undefined, 'registro do Componente');
  await page.reload({ waitUntil: 'domcontentloaded' }); await esperarSessaoAssentada(page);
  await secaoPronta(page);
  afirma(/Faz parte de/.test(await texto(page, '#roSecao')) && await texto(page, '#mfVoltarLista') === '← Voltar para o registro', 'F5 no registro aberto por outro registro: relações e retorno continuam', [await texto(page, '#roLista'), await texto(page, '#mfVoltarLista')]);
  await page.click('#mfVoltarLista');
  await ate(page, () => /item=pCapec/.test(location.hash) && !!document.getElementById('roSecao'), undefined, 'de volta ao Produto/Serviço');
  afirma(r.erros.length === 0 && await larguraOk(page), 'depois do F5, "← Voltar para o registro" volta ao registro de origem; sem erro de JS');
  await r.ctx.close();
  r = await abrir(browser, vp, '#arquitetura?po=gC', { relacoes: relSemente }); page = r.page;
  await ate(page, () => !!document.querySelector('.ro-resumo'), undefined, 'resumo no Posicionamento');
  afirma(/Relaciona-se com 1 objeto/.test(await texto(page, '.ro-resumo')) && !(await existe(page, '#roRelacionar')), 'ficha do Posicionamento: "Relaciona-se com 1 objeto — ver no registro", sem edição');
  await page.click('.ro-resumo a');
  await ate(page, () => /tr=1&item=pCapec/.test(location.hash) && !!document.getElementById('roSecao'), undefined, 'registro pelo resumo');
  afirma(true, 'o link do resumo abre o registro do objeto');
  await r.ctx.close();
  r = await abrir(browser, vp, '#arquitetura?avp=pCapec', { relacoes: relSemente }); page = r.page;
  await ate(page, () => !!document.querySelector('.ro-resumo'), undefined, 'resumo na ficha P1–P16');
  afirma(/Relaciona-se com 1 objeto/.test(await texto(page, '.ro-resumo')), 'ficha P1–P16: resumo só de leitura');
  await r.ctx.close();
  r = await abrir(browser, vp, '#arquitetura?mf=mapa&e=neg-1', { relacoes: relSemente }); page = r.page;
  await ate(page, () => !!document.querySelector('#mfmObjetos .mfm-objeto[data-objeto="pCapec"] .ro-resumo'), undefined, 'resumo no detalhe da estrutura', 20000);
  afirma(/Relaciona-se com 1 objeto/.test(await texto(page, '#mfmObjetos .mfm-objeto[data-objeto="pCapec"] .ro-resumo')), 'detalhe da estrutura no Mapa: a responsabilidade mostra o resumo');
  const caixas = await page.$$eval('#mfmMapa [data-estrutura]', (cs) => cs.map((c) => c.getAttribute('data-estrutura')));
  afirma(caixas.indexOf('cMotor') === -1 && caixas.indexOf('pCapec') === -1, 'o Mapa continua só com estruturas (nenhum objeto vira caixa)', caixas);
  afirma(r.erros.length === 0 && await larguraOk(page), 'sem erro de JS e sem rolagem lateral');
  await r.ctx.close();

  console.log('8b. Item antigo sem a versão vigente registrada (reconciliação pendente)');
  r = await abrir(browser, vp, '#arquitetura?tr=1&item=fSim', { semIndice: 'fSim' }); page = r.page;
  await secaoPronta(page);
  afirma(/versão vigente deste item ainda não está registrada/.test(await texto(page, '#roNatureza')) && !(await existe(page, '#roIdentSalvar')) && !(await existe(page, '#roRelacionar')),
    'sem o índice da versão vigente: explica a reconciliação pendente e não oferece natureza nem relação (o banco recusaria)', await texto(page, '#roNatureza'));
  afirma(r.erros.length === 0 && await larguraOk(page), 'sem erro de JS e sem rolagem lateral');
  await r.ctx.close();

  console.log('9. Módulo da E4 que chega DEPOIS do login (rede lenta, sessão já guardada)');
  /* reproduz o que acontecia no site publicado: o login (rápido, sessão guardada) dispara os eventos antes de o
     relacoes-objetos.js (fim da lista de scripts) chegar; a ficha já foi desenhada sem ele e o resumo ficava vazio */
  for (const [hash, rot] of [['#arquitetura?avp=pCapec', 'ficha P1–P16'], ['#arquitetura?po=gC', 'ficha do Posicionamento']]) {
    r = await abrir(browser, vp, hash, { relacoes: relSemente, atrasarModulo: 2500 }); page = r.page;
    await ate(page, () => !!window.faRelacoesObjetos, undefined, 'o módulo da E4 carregar', 20000);
    const ordem = await page.evaluate(() => window.__evAntesDoModulo);
    await ate(page, () => !!document.querySelector('.ro-resumo'), undefined, 'resumo na ' + rot + ' com o módulo atrasado', 15000);
    afirma(/Relaciona-se com 1 objeto/.test(await texto(page, '.ro-resumo')) && ordem > 0, rot + ': com o login antes do módulo, o resumo aparece mesmo assim', ordem);
    afirma(r.erros.length === 0, 'sem erro de JS', r.erros);
    await r.ctx.close();
  }
}

(async () => {
  const browser = await chromium.launch();
  try {
    await rodada(browser, { width: 1280, height: 900 }, 'desktop');
    await rodada(browser, { width: 375, height: 812 }, '375 px');
  } catch (e) { console.error('ERRO', e); falhas++; }
  await browser.close();
  console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTUDO OK');
  process.exit(falhas ? 1 : 0);
})();
