/* Porta 2 · ANÁLISE ORGANIZACIONAL — a jornada na tela (PR A). Firebase falso em persistência real; hermético; o
 * banco é o da página (nada vai para produção). As respostas são HIPÓTESES de teste (cenários de TI), não classificações
 * oficiais. Prova, pela interface:
 *   M. Acesso pelos perfis oficiais, sem controle de disponibilidade: sem marcador ou com qualquer estado antigo gravado
 *      (DESLIGADO, SOMENTE_ADMIN_GERAL), Avaliação + Configuração registra; o ADMIN não tem mais o formulário; o histórico
 *      antigo fica intacto.
 *   B. Jornada B (Núcleo de Arquitetura de TI): descoberta uma pergunta por vez, com o porquê; comparação com os sete
 *      critérios (contra os indícios exige justificativa); delimitação em 2 responsabilidades; fatos de quem executa e
 *      responde (descritivos); atuação criada e O1–O9 respondido NA TELA DO POSICIONAMENTO (fluxo de sempre); volta à
 *      análise; situação formal (compatível × exercida sem responsável formal compatível); alternativas sem
 *      reclassificar; proposta pendente; ficha da estrutura com "Exerce, segundo as análises"; Jornada com a origem;
 *      histórico; exportação Excel; F5 e Voltar.
 *   A. Jornada A (Núcleo de Governança de TI): regressão — políticas de SI e diretrizes contratuais (mesma forma, mesmos
 *      gestores, mesmo núcleo) NÃO podem ser juntadas sem comparação e, concluídas como distintas, continuam
 *      separadas; quatro responsabilidades; lacuna de hipótese; proposta; o admin geral registra a referência ao ato
 *      externo (o registro não é a aprovação); Avaliação + Configuração não vê o botão.
 *   C. Jornada C (Segurança de TI, capacidade): capacidade só como referência; responsabilidade de outra análise
 *      referenciada sem trocar a origem; operação classificada e vinculada; lacuna de incidentes; nenhuma estrutura
 *      "Segurança" criada.
 *   P. Perfil Avaliação (consulta): lê, não grava (nenhum formulário).
 *   R. 375 px: lista, nova análise, análise, formulários e ficha sem rolagem lateral.
 *   Em todo o percurso: nenhuma estrutura nova, nenhum conceito da Taxonomia, nenhuma caixa nova no Mapa. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const { semente, ARQ, AVAL, chave } = require('./semente-jornada');
const XLSX = require(path.join(__dirname, '..', '..', 'forca-agil', 'xlsx.mini.min.js'));

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const ADM = 'admin.geral@previ.com.br';
const CFG = 'analises-organizacionais-config';
let falhas = 0, total = 0;
function afirma(c, msg, det) { total++; console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + (typeof det === 'string' ? det : JSON.stringify(det)) : '')); if (!c) falhas++; }

function sementeAnalise(hab) {
  const db = semente();
  db['fa-admins'] = Object.assign({}, db['fa-admins'] || {}, { [chave(ADM)]: true });
  db['fa-users'][chave(ADM)] = { name: 'Admin', email: ADM, area: 'INFOR' };
  const reg = db['estruturas-concretas'].registros;
  const e = (id, tipo, nome) => ({ id, tipo, nome, situacao: 'ativa', revisao: 1, criadaEm: 1791713600000, criadaPor: { id: 'semente', email: 'semente@teste' }, ultimaOperacao: 'op-' + id });
  reg['nucleo-arq'] = e('nucleo-arq', 'AREA_ESPECIALIZADA', 'Núcleo de Arquitetura de TI');
  reg['nucleo-gov'] = e('nucleo-gov', 'AREA_ESPECIALIZADA', 'Núcleo de Governança de TI');
  reg['nucleo-infra'] = e('nucleo-infra', 'PLATAFORMA_HABILITADORA_TECNOLOGIA', 'Núcleo de Infraestrutura');
  db['posicionamento-classificacoes'].PLATAFORMA_HABILITADORA_TECNOLOGIA = { registradoEm: '2026-10-01T09:00:00.000Z', registradoPor: ARQ, auditoriaId: 'l' };
  if (hab) db[CFG] = { habilitacao: hab };
  return db;
}
async function abrir(browser, viewport, hash, opts) {
  opts = opts || {};
  const email = opts.email || ARQ;
  const cfg = { db: opts.db || sementeAnalise(opts.hab), user: { email, emailVerified: true, uid: 'u-' + chave(email) }, uidDoUsuario: true, prefixoChave: 'k' + (++abrir.n) + 'x', delayDefault: 10, persistenciaReal: true };
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  page.on('dialog', (d) => d.accept());
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + hash, { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
abrir.n = 0;
const esperar = (page, fn, arg, limite) => esperarCondicao(page, fn, arg, { limite: limite || 15000 });
const banco = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal)));
const texto = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent : ''; }, sel);
const existe = (page, sel) => page.evaluate((s) => !!document.querySelector(s), sel);
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const ir = async (page, hash) => { await page.evaluate((h) => { location.hash = h; }, hash); };
const gravar = (page, w) => page.evaluate((x) => new Promise((ok, falha) => window.firebase.database().ref().update(x, (e) => (e ? falha(String(e)) : ok()))), w);
const CRIT = ['finalidade', 'resultado', 'objeto', 'limitesAutonomia', 'riscos', 'obrigacaoResponder', 'governancaEspecializacao'];
/* a composição organizacional começa recolhida (opcional) */
/* "Detalhes e análise complementar" também começa recolhido */
const abrirDetalhes = (page) => page.evaluate(() => { const d = document.getElementById('anDetalhesResp'); if (d && !d.open) d.open = true; });
const abrirComposicao = (page) => page.evaluate(() => { const d = document.getElementById('anComposicaoSecao'); if (d && !d.open) d.open = true; });
const assinaturaPergunta = () => { const p = document.getElementById('anPergunta'); return p ? p.textContent.slice(0, 400) : 'nenhuma'; };

/* responde as perguntas pendentes, uma por vez, pela interface; mapa(info) devolve a resposta */
async function responderPendentes(page, mapa, limite) {
  for (let i = 0; i < (limite || 80); i++) {
    const info = await page.evaluate(() => {
      const p = document.getElementById('anPergunta'); if (!p) return null;
      /* a pergunta pode estar dentro de um bloco recolhido ("Mais sobre a área"): abre */
      for (let d = p.closest('details'); d; d = d.parentElement && d.parentElement.closest('details')) d.open = true;
      const fr = document.getElementById('anFormResponder'), fc = document.getElementById('anFormComparar');
      return { q: fr ? fr.getAttribute('data-q') : fc ? 'F10' : (document.getElementById('anSemEntregas') ? 'F3' : null),
        entrega: (p.querySelector('.an-sobre strong') || {}).textContent || null,
        par: fc ? Array.from(p.querySelectorAll('.an-par strong')).map((x) => x.textContent).sort() : null };
    });
    if (!info || info.q === 'F3') return info;
    const r = mapa(info);
    if (!r) return info;
    const antes = await page.evaluate(assinaturaPergunta);
    if (info.q === 'F10') {
      for (let k = 0; k < 7; k++) await page.check('input[name="anCrit_' + CRIT[k] + '"][value="' + { I: 'igual', D: 'diferente', N: 'nao-sei' }[r.criterios[k]] + '"]');
      await page.check('input[name="anConclusao"][value="' + r.conclusao + '"]');
      if (r.justificativa) await page.fill('#anJustComp', r.justificativa);
    } else {
      await page.check('#anFormResponder input[name="anResposta"][value="' + r.valor + '"]');
      if (r.certeza) await page.selectOption('#anCerteza', r.certeza);
      if (r.estrutura) await page.selectOption(info.q === 'F2b' ? '#anEstruturaCadastrada' : '#anOutraEstrutura', r.estrutura);
      if (r.texto) await page.fill('#anTextoResp', r.texto);
    }
    await page.click('#anResponderBtn');
    await esperar(page, (a) => { const p = document.getElementById('anPergunta'); const s = p ? p.textContent.slice(0, 400) : 'nenhuma'; return s !== a || !!document.getElementById('anErro'); }, antes);
    const erro = await texto(page, '#anErro');
    if (erro) { if (r.esperaErro) return { erro }; throw new Error('erro ao responder ' + JSON.stringify(info) + ': ' + erro); }
  }
  throw new Error('perguntas demais');
}
async function adicionarEntregas(page, descricoes) {
  /* o detalhamento por entregas é ajuda: abre por "Preciso de ajuda para separar" (ou já está aberto, com entregas) */
  if (!(await page.evaluate(() => !!document.getElementById('anDetalhar')))) await page.click('#anAjudaSeparar');
  await page.waitForSelector('#anDetalhar');
  if (!(await page.evaluate(() => document.getElementById('anDetalhar').open))) await page.click('#anDetalhar > summary');
  await page.waitForSelector('#anEntregaDesc', { state: 'visible' });
  for (const d of descricoes) {
    const n = await page.evaluate(() => document.querySelectorAll('.an-entrega').length);
    await page.fill('#anEntregaDesc', d);
    await page.click('#anAddEntregaBtn');
    await esperar(page, (k) => document.querySelectorAll('.an-entrega').length > k, n);
  }
}
async function delimitar(page, nome, resultado, justificativa, entregas) {
  await page.evaluate((es) => { document.querySelectorAll('#anFormRecorte .an-opcao').forEach((l) => { const i = l.querySelector('input'); i.checked = es.some((e) => l.textContent.trim() === e); }); }, entregas);
  await page.fill('#anRecDesc', nome); /* registro direto: só a descrição (sem pergunta sobre separar) */
  await page.click('#anDefinirRecorteBtn');
  await esperar(page, (n) => Array.from(document.querySelectorAll('.an-recorte h4')).some((h) => h.textContent === n) || !!document.getElementById('anErro'), nome);
  return texto(page, '#anErro');
}
const recorteId = (page, nome) => page.evaluate((n) => { const a = Array.from(document.querySelectorAll('.an-recorte')).find((x) => x.querySelector('h4').textContent === n); return a ? a.getAttribute('data-recorte') : null; }, nome);
async function registrarFatos(page, nome, f) {
  const k = await recorteId(page, nome);
  await abrirDetalhes(page); await page.click('.an-recorte[data-recorte="' + k + '"] button[data-form="fatos"]');
  await page.waitForSelector('#anFormFatos');
  if (f.exec) await page.selectOption('#anExecEstr', f.exec);
  await page.selectOption('#anExecCarater', f.execCarater); await page.fill('#anExecFonte', f.fonte);
  await page.selectOption('#anRespCerteza', f.certeza);
  if (f.resp) await page.selectOption('#anRespEstr', f.resp);
  await page.selectOption('#anRespCarater', f.respCarater); await page.fill('#anRespFonte', f.fonte);
  await page.click('#anFormFatos button[type="submit"]');
  await esperar(page, (kk) => { const a = document.querySelector('.an-recorte[data-recorte="' + kk + '"]'); return !document.getElementById('anFormFatos') && !!a && /Quem executa hoje:/.test(a.textContent); }, k);
}
async function criarAtuacao(page, nome) {
  const k = await recorteId(page, nome);
  await page.click('#anCriarAtuacao_' + k);
  /* descrição até 200 caracteres: registra direto, sem formulário */
  await esperar(page, () => /po=atuacoes&item=/.test(location.hash));
  return page.evaluate(() => decodeURIComponent(/item=([^&]*)/.exec(location.hash)[1]));
}
/* Posicionamento concluído do jeito que a tela do Posicionamento grava (o O1–O9 em si é provado em outros testes) */
async function semearPosicionamento(page, objetoId, codigo, tipoAValidar) {
  const id = 'pos-' + objetoId;
  const ra = codigo === 'A_VALIDAR' ? { codigoResultado: 'A_VALIDAR', tipoAValidar, motivo: 'X', regra: 'X', papeisDetectados: ['AREA_ESPECIALIZADA', 'COE'] } : { codigoResultado: codigo, motivo: 'PAPEL_UNICO', regra: 'R', papeisDetectados: [codigo] };
  await gravar(page, { ['avaliacoes-posicionamento/' + id]: { itemId: objetoId, itemNome: 'Atuação', status: 'concluido', origem: 'objeto-organizacional', versao: 1, revisao: 2, hipoteseInicial: 'NAO_SEI', resultadoAutomatico: ra, concluidoEm: '2026-10-14T12:00:00.000Z' },
    ['posicionamento-vigente-por-item/' + objetoId]: id });
}
async function semearVinculo(page, objetoId, estruturaId) {
  const id = 'vin-' + objetoId;
  await gravar(page, { ['estruturas-vinculos/registros/' + id]: { id, objetoId, estruturaId, papel: 'responsavel-principal', base: { avaliacaoId: 'pos-' + objetoId, codigo: 'X', origem: 'recomendacao' }, situacao: 'ativa', revisao: 1, criadoEm: 1791713600000, criadoPor: { id: 'semente' } },
    ['estruturas-vinculos/ativo-por-objeto/' + objetoId]: id });
}
const analiseAtual = (page) => page.evaluate(() => decodeURIComponent(/an=([^&]*)/.exec(location.hash)[1]));
async function abrirAnaliseNova(page, nome, escopo, extra) {
  await ir(page, '#arquitetura?an=nova');
  await page.waitForSelector('#anFormNova');
  await page.evaluate(() => { document.getElementById('anNovaAvancado').open = true; }); /* o tipo fica em "Opções avançadas" */
  await page.check('#anFormNova input[value="' + escopo + '"]');
  await page.fill('#anNome', nome);
  if (extra && extra.capacidades) await page.fill('#anCapacidades', extra.capacidades);
  await page.click('#anCriarBtn');
  await esperar(page, () => /an=(?!nova|lista)/.test(location.hash) && !!document.getElementById('anTitulo'));
  return analiseAtual(page);
}

/* respostas da Jornada B */
const B = {
  'Pareceres sobre soluções propostas': { F4: 'julgamento-tecnico', F5: 'diversas-linhas', F6: { valor: 'esta-estrutura', certeza: 'conhecido' }, F8: { valor: 'evidencia', texto: 'Pareceres em projetos' } },
  'Validação de aderência a padrões': { F4: 'julgamento-tecnico', F5: 'diversas-linhas', F6: { valor: 'esta-estrutura', certeza: 'conhecido' }, F8: { valor: 'evidencia', texto: 'Checklist de validação' } },
  'Padrões, guias e decisões de referência': { F4: 'padrao-capacitacao', F5: 'toda-organizacao', F6: { valor: 'esta-estrutura', certeza: 'conhecido' }, F12: 'outras-equipes', F8: { valor: 'evidencia', texto: 'Repositório de padrões' } },
  'Mentoria e trilhas para as equipes': { F4: 'padrao-capacitacao', F5: 'toda-organizacao', F6: { valor: 'ninguem', certeza: 'nao-definido' }, F12: 'outras-equipes', F8: { valor: 'evidencia', texto: 'Trilha de formação' } }
};
const ESTRUTURA_B = { F2b: { valor: 'cadastrada', estrutura: 'nucleo-arq' } };
function mapaB(info) {
  if (info.q === 'F2b') return ESTRUTURA_B.F2b;
  if (info.q === 'F10') {
    if (info.par.join('|') === ['Pareceres sobre soluções propostas', 'Validação de aderência a padrões'].sort().join('|')) return { criterios: 'IIIIIII', conclusao: 'mesma' };
    return { criterios: 'IIIIIDI', conclusao: 'integradas', justificativa: mapaB.justificar ? 'Padrões e mentoria formam o mesmo programa de evolução da disciplina.' : null, esperaErro: !mapaB.justificar };
  }
  const r = B[info.entrega][info.q];
  return typeof r === 'string' ? { valor: r } : r;
}

async function jornadaB(browser) {
  console.log('\n== B. Jornada B — Núcleo de Arquitetura de TI ==');
  const { ctx, page, erros } = await abrir(browser, { width: 1280, height: 900 }, '#arquitetura?po=atuacoes', { hab: 'LIBERADO_PARA_PERFIS_AUTORIZADOS' });
  await page.waitForSelector('#anEntradaAtuacoes');
  afirma(/Avaliar uma responsabilidade/.test(await texto(page, '#anEntradaAtuacoes #poNovaAtuacaoBtn')) && /Analisar uma área/.test(await texto(page, '#anEntradaNova')), 'Porta 2: "Avaliar uma responsabilidade" e "Analisar uma área"');
  await page.click('#anEntradaNova');
  await page.waitForSelector('#anFormNova');
  const escopos = await page.evaluate(() => Array.from(document.querySelectorAll('#anEscopo .an-opcao')).map((l) => l.textContent));
  afirma(escopos.length === 6 && escopos.every((t) => /Ex\.:/.test(t)), 'etapa 1: seis escopos, cada um com exemplo contrastante', escopos.length);
  afirma(!/Área Especializada|Centro de Excelência|CoE|Plataforma/.test(await texto(page, '#anFormNova')), 'nenhum tipo organizacional oferecido antes do O1–O9');
  const id = await abrirAnaliseNova(page, 'Núcleo de Arquitetura de TI', 'estrutura');
  afirma(/Essa estrutura já está cadastrada na Gestão da Floresta/.test(await texto(page, '#anPerguntaTitulo')) && /não deve ser confundido com o cadastro de Responsabilidades Organizacionais/.test(await texto(page, '#anPerguntaAjuda')), 'uma pergunta por vez, com a explicação (F2b: cadastro de Estruturas da Gestão ≠ Responsabilidades da Porta 2)');
  await responderPendentes(page, mapaB);
  afirma(/Informe as responsabilidades da área/.test(await texto(page, '#anProximaAcao')) && !(await existe(page, '#anDetalhar')) && await existe(page, '#anAjudaSeparar'), 'sem nada registrado: a próxima ação pede as responsabilidades; entregas só como ajuda opcional');
  await adicionarEntregas(page, Object.keys(B));
  mapaB.justificar = false;
  const r1 = await responderPendentes(page, mapaB);
  afirma(r1 && /Os critérios indicam responsabilidades distintas/.test(r1.erro || ''), 'concluir "integradas" contra os indícios sem justificativa: recusado com explicação', r1);
  mapaB.justificar = true;
  await responderPendentes(page, mapaB);
  afirma(!(await existe(page, '#anPergunta')), 'todas as perguntas respondidas');
  const dbB0 = await banco(page);
  afirma(Object.keys(dbB0['analises-organizacionais'][id].recortes || {}).length === 0, 'nada foi juntado automaticamente: nenhuma responsabilidade sem a pessoa delimitar');
  afirma(!(await delimitar(page, 'Pareceres e validações de arquitetura', 'Soluções avaliadas com parecer técnico', 'Julgamento técnico com resultado próprio', ['Pareceres sobre soluções propostas', 'Validação de aderência a padrões'])), 'delimitar R1 (pareceres e validação, comparadas como a mesma)');
  afirma(!(await delimitar(page, 'Evolução da disciplina de arquitetura', 'Maturidade arquitetural das equipes', 'Desenvolve competência nas outras equipes', ['Padrões, guias e decisões de referência', 'Mentoria e trilhas para as equipes'])), 'delimitar R2 (padrões e mentoria, integradas)');
  await registrarFatos(page, 'Pareceres e validações de arquitetura', { exec: 'nucleo-arq', execCarater: 'confirmado', fonte: 'Regimento interno', certeza: 'conhecido', resp: 'nucleo-arq', respCarater: 'confirmado' });
  await registrarFatos(page, 'Evolução da disciplina de arquitetura', { exec: 'nucleo-arq', execCarater: 'declarado', fonte: 'Entrevista com a coordenação', certeza: 'nao-definido', respCarater: 'declarado' });
  afirma(/ainda não definido/.test(await texto(page, '#anRecortes')) && (await page.$$('[id^="anCriarAtuacao_"]')).length > 0, 'N5: responsável "ainda não definido" não impede o O1–O9');
  /* R1: atuação criada e O1–O9 respondido na tela de sempre */
  const objR1 = await criarAtuacao(page, 'Pareceres e validações de arquitetura');
  await page.waitForSelector('#anOrigem');
  afirma(/Núcleo de Arquitetura de TI/.test(await texto(page, '#anOrigem')), 'Posicionamento da atuação: mostra a análise de origem');
  await page.click('#poHipoteseIniciar input[value="AREA_ESPECIALIZADA"]');
  await page.click('#poIniciarAtuacaoBtn');
  for (const [q, v] of [['O1', 'NAO'], ['O2', 'SIM'], ['O3', 'NAO']]) await page.click('#avaliacoesPosicionamento .po-resp[data-q="' + q + '"][data-v="' + v + '"]');
  await esperar(page, () => !document.getElementById('poConcluirBtn').disabled);
  await page.click('#poConcluirBtn');
  await esperar(page, (o) => { const d = window.__CFG.__dbReal; return !!(d['posicionamento-vigente-por-item'] || {})[o]; }, objR1, 20000);
  const dbPos = await banco(page), posR1 = dbPos['avaliacoes-posicionamento'][dbPos['posicionamento-vigente-por-item'][objR1]];
  afirma(posR1.resultadoAutomatico.codigoResultado === 'AREA_ESPECIALIZADA' && posR1.origem === 'objeto-organizacional', 'O1–O9 de sempre: resultado do motor gravado para a atuação da análise', posR1.resultadoAutomatico);
  await semearVinculo(page, objR1, 'nucleo-arq');
  await page.click('#anVoltarAnalise');
  await esperar(page, (i) => location.hash === '#arquitetura?an=' + i && !!document.getElementById('anTitulo'), id);
  const k1 = await recorteId(page, 'Pareceres e validações de arquitetura');
  await esperar(page, (k) => /Vínculo formal compatível/.test((document.getElementById('anSit_' + k) || {}).textContent || ''), k1);
  afirma(/Recomendação: /.test(await texto(page, '#anPos_' + k1)), 'R1 classificada e com vínculo formal compatível');
  /* R2: atuação criada; Posicionamento CoE (semeado) */
  const objR2 = await criarAtuacao(page, 'Evolução da disciplina de arquitetura');
  await semearPosicionamento(page, objR2, 'COE');
  await ir(page, '#arquitetura?an=' + id);
  const k2 = await recorteId(page, 'Evolução da disciplina de arquitetura') || (await page.waitForTimeout(500), await recorteId(page, 'Evolução da disciplina de arquitetura'));
  await esperar(page, (k) => /Exercida sem responsável formal compatível/.test((document.getElementById('anSit_' + k) || {}).textContent || ''), k2);
  afirma(true, 'R2 classificada como CoE e exercida pelo Núcleo (Área Especializada): "exercida sem responsável formal compatível", sem vínculo forçado');
  const alt = await page.evaluate((k) => document.querySelector('.an-recorte[data-recorte="' + k + '"] .an-alternativas').textContent, k2);
  afirma(/Rever a delimitação/.test(alt) && /Propor uma estrutura/.test(alt) && !/reclassific/i.test(alt), 'alternativas com consequência; nenhuma reclassifica', alt.slice(0, 200));
  afirma(/2 de 2/.test(await texto(page, '#anEstadoClassificacao')) && /1 com pendência/.test(await texto(page, '#anEstadoDiagnostico')), 'estados separados: classificação 2 de 2; diagnóstico com 1 pendência');
  /* proposta pendente; Avaliação + Configuração não registra aprovação */
  await abrirComposicao(page); await page.click('#anAbrirProposta'); await page.waitForSelector('#anFormProposta');
  await page.check('input[name="anAlternativa"][value="pendente"]');
  await page.fill('#anPropJust', 'Sem demanda que justifique outra estrutura; falta definir quem responde pela disciplina.');
  await page.fill('#anPendFalta', 'Quem responde pela evolução da disciplina'); await page.fill('#anPendAcao', 'Levar ao comitê de TI'); await page.fill('#anPendQuem', 'Diretoria de TI');
  await page.click('#anRegistrarProposta');
  await esperar(page, () => /Pendente \(proposta v1\)/.test((document.getElementById('anEstadoDecisao') || {}).textContent || ''));
  afirma(!(await existe(page, '#anAbrirAprovacao')), 'proposta pendente registrada; nenhum botão de aprovação para Avaliação + Configuração');
  /* histórico, F5 e Voltar */
  await page.click('#anHistorico > summary');
  await esperar(page, () => document.querySelectorAll('#anHistorico .an-eventos li').length > 10);
  afirma(/Análise aberta/.test(await texto(page, '#anHistorico')) && /Comparação registrada/.test(await texto(page, '#anHistorico')) && /Proposta registrada/.test(await texto(page, '#anHistorico')), 'histórico com autoria e horário de cada passo');
  /* F5: o banco falso não sobrevive ao recarregamento — repõe o estado atual antes de recarregar */
  const dbF5 = await banco(page);
  await ctx.addInitScript('window.__CFG.db = ' + JSON.stringify(dbF5) + '; delete window.__CFG.__dbReal;');
  await page.reload({ waitUntil: 'domcontentloaded' }); await esperarSessaoAssentada(page);
  await page.waitForSelector('#anTitulo', { timeout: 20000 });
  afirma(/Núcleo de Arquitetura de TI/.test(await texto(page, '#anTitulo')), 'F5: a mesma análise');
  /* exportação */
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('#anExportarBtn')]);
  const arq = path.join(require('os').tmpdir(), 'an-' + Date.now() + '.xlsx'); await download.saveAs(arq);
  const wb = XLSX.read(fs.readFileSync(arq)); fs.unlinkSync(arq);
  const resp = XLSX.utils.sheet_to_json(wb.Sheets.Responsabilidades, { header: 1 });
  afirma(wb.SheetNames.join() === 'Resumo,Entregas,Comparacoes,Responsabilidades,Propostas' && resp.length === 3 && /declarado/.test(JSON.stringify(resp)), 'Excel: resumo, entregas, comparações, responsabilidades (com caráter dos fatos) e propostas', wb.SheetNames);
  /* ficha da estrutura e Jornada */
  await ir(page, '#arquitetura?arq=estruturas');
  await page.waitForSelector('.est-item[data-estrutura="nucleo-arq"]', { timeout: 20000 });
  await page.click('.est-item[data-estrutura="nucleo-arq"]');
  await page.waitForSelector('#anExercidas', { timeout: 15000 });
  const ex = await texto(page, '#anExercidas');
  afirma(/Pareceres e validações/.test(ex) && /Evolução da disciplina/.test(ex) && /confirmado/.test(ex) && /declarado/.test(ex) && /não é vínculo formal/.test(ex), 'ficha da estrutura: "Exerce, segundo as análises", com caráter, fonte e data — separado do vínculo');
  await ir(page, '#arquitetura?mf=catalogo&item=' + objR2);
  await page.waitForSelector('#mfCatalogo .mf-item--detalhe #anOrigem', { timeout: 20000 });
  afirma(true, 'Jornada: a atuação mostra a análise de origem');
  const dbFim = await banco(page);
  afirma(Object.keys(dbFim['estruturas-concretas'].registros).length === Object.keys(sementeAnalise()['estruturas-concretas'].registros).length && !dbFim['analises-aprovacoes'], 'nenhuma estrutura nova; nenhuma aprovação registrada por quem não é admin geral');
  afirma(await larguraOk(page), 'sem rolagem lateral');
  afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();
  return { db: dbFim, id };
}

const A = {
  'Plano de TI e priorização do portfólio': { F4: 'decisao-estrategica', F5: 'toda-organizacao', F6: { valor: 'esta-estrutura', certeza: 'provavel' }, F8: { valor: 'sem-evidencia' } },
  'Avaliações de conformidade e controles': { F4: 'julgamento-tecnico', F5: 'outro', F6: { valor: 'esta-estrutura', certeza: 'conhecido' }, F8: { valor: 'evidencia', texto: 'Relatórios trimestrais' } },
  'Acompanhamento e medição dos contratos de TI': { F4: 'servico-operado', F5: 'cliente-interno', F6: { valor: 'esta-estrutura', certeza: 'conhecido' }, F13: 'administracao-interna', F8: { valor: 'evidencia', texto: 'Planilha de medição' } },
  'Políticas de Segurança da Informação': { F4: 'politica-norma', F5: 'cliente-interno', F6: { valor: 'esta-estrutura', certeza: 'conhecido' }, F8: { valor: 'evidencia', texto: 'Política publicada' } },
  'Diretrizes de gestão contratual': { F4: 'politica-norma', F5: 'cliente-interno', F6: { valor: 'esta-estrutura', certeza: 'conhecido' }, F8: { valor: 'evidencia', texto: 'Norma de gestão contratual' } }
};
function mapaA(info) {
  if (info.q === 'F2b') return { valor: 'cadastrada', estrutura: 'nucleo-gov' };
  if (info.q === 'F11') return { valor: 'boa-pratica' };
  if (info.q === 'F10') {
    const par = info.par.join('|');
    if (par === ['Acompanhamento e medição dos contratos de TI', 'Diretrizes de gestão contratual'].sort().join('|')) return { criterios: 'IIIIIII', conclusao: 'mesma' };
    return { criterios: 'DDDIDDD', conclusao: 'distintas' };
  }
  const r = A[info.entrega][info.q];
  return typeof r === 'string' ? { valor: r } : r;
}
async function jornadaA(browser, db) {
  console.log('\n== A. Jornada A — Núcleo de Governança de TI (regressão do agrupamento) ==');
  let { ctx, page, erros } = await abrir(browser, { width: 1280, height: 900 }, '#arquitetura?an=lista', { db });
  await page.waitForSelector('#anNovaBtn');
  const id = await abrirAnaliseNova(page, 'Núcleo de Governança de TI', 'estrutura');
  await responderPendentes(page, mapaA);
  await adicionarEntregas(page, Object.keys(A));
  /* antes de comparar: tentar juntar políticas de SI e diretrizes contratuais */
  await responderPendentes(page, (info) => (info.q === 'F10' ? null : mapaA(info)));
  const sinais = await texto(page, '#anPergunta');
  afirma(/3 perguntas do detalhamento/.test(await texto(page, '#anPendenciasDetalhe')) && /mesmo destinatário/.test(sinais) && /Parecer não basta/.test(sinais) && /nada é juntado sem a sua conclusão/.test(sinais), 'semelhança de superfície só SUGERE comparar (3 pares), com o porquê', sinais.slice(0, 200));
  const errJuntar = await delimitar(page, 'Políticas e diretrizes', 'Normas', 'Mesmo documento para os gestores', ['Políticas de Segurança da Informação', 'Diretrizes de gestão contratual']);
  afirma(/só podem ficar na mesma responsabilidade depois de comparadas/.test(errJuntar), 'REGRESSÃO: políticas de SI + diretrizes contratuais NÃO são juntadas sem comparação', errJuntar);
  await responderPendentes(page, mapaA);
  const errDistintas = await delimitar(page, 'Políticas e diretrizes', 'Normas', 'Mesmo documento para os gestores', ['Políticas de Segurança da Informação', 'Diretrizes de gestão contratual']);
  afirma(/só podem ficar na mesma responsabilidade/.test(errDistintas), 'REGRESSÃO: concluídas como distintas, continuam separadas', errDistintas);
  for (const [n, es] of [['Estratégia e portfólio de TI', ['Plano de TI e priorização do portfólio']], ['Governança e conformidade de TI', ['Avaliações de conformidade e controles']],
    ['Gestão de contratos de TI', ['Acompanhamento e medição dos contratos de TI', 'Diretrizes de gestão contratual']], ['Políticas e padrões de Segurança da Informação', ['Políticas de Segurança da Informação']]]) {
    const errD = await delimitar(page, n, 'Resultado de ' + n, 'Resultado e destinatário próprios', es); afirma(!errD, 'delimitar: ' + n, errD);
  }
  afirma(/Hipótese sem evidência: Plano de TI/.test(await texto(page, '#anLacunas')), 'lacuna: a hipótese sem evidência fica listada (não bloqueia)');
  const objPol = await criarAtuacao(page, 'Políticas e padrões de Segurança da Informação');
  await semearPosicionamento(page, objPol, 'A_VALIDAR', 'CONFLITO');
  await ir(page, '#arquitetura?an=' + id);
  const kPol = await (async () => { await page.waitForSelector('.an-recorte', { state: 'attached' }); return recorteId(page, 'Políticas e padrões de Segurança da Informação'); })();
  await abrirDetalhes(page); await page.waitForSelector('#anAprofundar_' + kPol);
  afirma(/mesma responsabilidade/.test(await texto(page, '#anAprofundar_' + kPol)) && /recomendação automática não muda/.test(await texto(page, '#anAprofundar_' + kPol)), 'A validar (conflito): explicação e evidência qualitativa, sem escolher código');
  await page.fill('#anEv_' + kPol, 'O papel de parecer aparece nas exceções à política; o de padrão, na revisão anual.');
  await page.click('#anAprofundar_' + kPol + ' button[type="submit"]');
  await esperar(page, (k) => /revisão anual/.test((document.querySelector('#anAprofundar_' + k + ' .an-evidencias') || {}).textContent || ''), kPol);
  afirma((await banco(page))['avaliacoes-posicionamento']['pos-' + objPol].resultadoAutomatico.codigoResultado === 'A_VALIDAR', 'D7: a evidência não muda a recomendação automática');
  await abrirComposicao(page); await page.click('#anAbrirProposta'); await page.waitForSelector('#anFormProposta');
  await page.check('input[name="anAlternativa"][value="manter-consciente"]');
  await page.fill('#anPropJust', 'Equipe integrada; separar não traria ganho demonstrado.');
  await page.click('#anRegistrarProposta');
  await esperar(page, () => /Proposta v1, sem aprovação registrada/.test((document.getElementById('anEstadoDecisao') || {}).textContent || ''));
  afirma(!(await existe(page, '#anAbrirAprovacao')) && /admin geral registra a referência/.test(await texto(page, '#anSemAprovacao')), 'Avaliação + Configuração registra a proposta, mas não a aprovação');
  db = await banco(page);
  const nRecortes = Object.values(db['analises-organizacionais'][id].recortes).find((r) => r.nome === 'Políticas e padrões de Segurança da Informação').entregas.length;
  afirma(nRecortes === 1, 'no banco: a responsabilidade de políticas de SI tem só a sua entrega');
  afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();
  /* admin geral registra a referência ao ato externo */
  ({ ctx, page, erros } = await abrir(browser, { width: 1280, height: 900 }, '#arquitetura?an=' + id, { db, email: ADM }));
  await page.waitForSelector('#anComposicaoSecao', { timeout: 20000 }); await abrirComposicao(page); await page.waitForSelector('#anAbrirAprovacao', { timeout: 20000 });
  await abrirComposicao(page); await page.click('#anAbrirAprovacao'); await page.waitForSelector('#anFormAprovacao');
  afirma(/Registrar não significa que você aprovou/.test(await texto(page, '#anFormAprovacao')), 'o formulário diz que registrar não é aprovar');
  await page.fill('#anApAutoridade', 'Diretoria Executiva'); await page.fill('#anApReferencia', 'Ata 12/2026, item 3'); await page.fill('#anApData', '2026-10-10');
  await page.click('#anRegistrarAprovacao');
  await page.waitForSelector('#anAprovacao');
  const apT = await texto(page, '#anAprovacao');
  afirma(/referência a ato externo/.test(apT) && /Diretoria Executiva/.test(apT) && /Registrado por admin.geral@previ.com.br/.test(apT) && /o registro não é a aprovação/.test(apT), 'aprovação: referência ao ato, com a autoridade e a autoria só do registro', apT.slice(0, 200));
  db = await banco(page);
  afirma(Object.values(db['analises-aprovacoes'][id])[0].natureza === 'referencia-a-ato-externo', 'no banco: natureza "referência a ato externo"');
  afirma(Object.keys(db['estruturas-concretas'].registros).length === Object.keys(sementeAnalise()['estruturas-concretas'].registros).length, 'a aprovação não criou nem alterou estrutura');
  afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();
  return { db, id, objPol };
}

async function jornadaC(browser, db, objPol) {
  console.log('\n== C. Jornada C — Segurança de TI (capacidade) ==');
  const { ctx, page, erros } = await abrir(browser, { width: 1280, height: 900 }, '#arquitetura?an=lista', { db });
  await page.waitForSelector('#anNovaBtn');
  const id = await abrirAnaliseNova(page, 'Segurança de TI', 'capacidade', { capacidades: 'Proteger informações e ambientes' });
  afirma(/Capacidades \(só referência\)Proteger informações e ambientes/.test(await texto(page, '#anObjeto')), 'capacidade registrada só como referência');
  await responderPendentes(page, (info) => (info.q === 'F2c' ? { valor: 'listadas' } : null));
  await page.evaluate(() => { document.getElementById('anRefMais').open = true; });
  await page.selectOption('#anReferenciaSel', objPol);
  await page.click('#anReferenciarBtn');
  await page.waitForSelector('#anReferencias');
  afirma(/Políticas e padrões de Segurança da Informação/.test(await texto(page, '#anReferencias')) && /origem: análise "Núcleo de Governança de TI"/.test(await texto(page, '#anReferencias')), 'responsabilidade da Jornada A referenciada, com a origem preservada');
  await adicionarEntregas(page, ['Operação de firewalls e controles técnicos', 'Resposta a incidentes de segurança']);
  const C = { F4: 'servico-operado', F5: 'diversas-linhas', F6: { valor: 'outra-estrutura', certeza: 'provavel', estrutura: 'nucleo-infra' }, F13: 'tecnicas-compartilhadas', F8: { valor: 'evidencia', texto: 'Contrato de operação 24x7' } };
  await responderPendentes(page, (info) => (info.q === 'F11' ? { valor: 'boa-pratica' } : info.entrega === 'Operação de firewalls e controles técnicos' ? (typeof C[info.q] === 'string' ? { valor: C[info.q] } : C[info.q]) : null));
  afirma(/Resposta a incidentes/.test(await texto(page, '.an-sobre')), 'a entrega sem respostas continua como pergunta pendente (lacuna, não bloqueio)');
  afirma(!(await delimitar(page, 'Operação dos controles técnicos de segurança', 'Ambientes protegidos continuamente', 'Serviço técnico operado para todos', ['Operação de firewalls e controles técnicos'])), 'delimitar a operação');
  const objOp = await criarAtuacao(page, 'Operação dos controles técnicos de segurança');
  await semearPosicionamento(page, objOp, 'PLATAFORMA_HABILITADORA_TECNOLOGIA');
  await semearVinculo(page, objOp, 'nucleo-infra');
  await ir(page, '#arquitetura?an=' + id);
  await page.waitForSelector('.an-recorte', { state: 'attached' });
  const k = await recorteId(page, 'Operação dos controles técnicos de segurança');
  await esperar(page, (kk) => /Vínculo formal compatível/.test((document.getElementById('anSit_' + kk) || {}).textContent || ''), k);
  afirma(/Entrega ainda fora de qualquer responsabilidade: Resposta a incidentes/.test(await texto(page, '#anLacunas')), 'lacuna: resposta a incidentes ainda sem responsabilidade');
  db = await banco(page);
  const nomes = Object.values(db['estruturas-concretas'].registros).map((e) => e.nome);
  afirma(!nomes.some((n) => /Seguran/i.test(n)) && !db.taxonomia.organizacional || !Object.keys((db.taxonomia.organizacional || {}).conceitos || {}).some((c) => /SEGURAN/i.test(c)), 'nenhuma estrutura nem conceito "Segurança": a capacidade ficou distribuída entre duas estruturas');
  afirma((db['analises-por-objeto'][objPol] || {}).analiseId !== id, 'a origem da responsabilidade referenciada continua sendo a Jornada A');
  afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();
  return db;
}

async function marcador(browser) {
  console.log('\n== M. Acesso pelos perfis oficiais (sem controle de disponibilidade) ==');
  /* sem marcador e com QUALQUER estado antigo de homologação gravado: o acesso é o do perfil — nada a ligar à mão */
  for (const [hab, rot] of [[null, 'sem marcador'], ['DESLIGADO', 'estado antigo DESLIGADO'], ['SOMENTE_ADMIN_GERAL', 'estado antigo SOMENTE_ADMIN_GERAL']]) {
    let { ctx, page, erros } = await abrir(browser, { width: 1280, height: 900 }, '#arquitetura?po=atuacoes', { hab });
    await page.waitForSelector('#anEntradaAtuacoes', { timeout: 20000 });
    afirma(await existe(page, '#anEntradaNova'), rot + ': Avaliação + Configuração vê a entrada da análise e pode abrir uma ("Analisar uma área")');
    await ir(page, '#arquitetura?an=lista');
    await page.waitForSelector('#anNovaBtn, #anListaVazia, #anLista', { timeout: 20000 });
    afirma(await existe(page, '#anNovaBtn') && !(await existe(page, '#anIndisponivel')) && !(await existe(page, '#anHomologacao')), rot + ': a lista abre com "Abrir uma análise", sem aviso de homologação');
    const db = await banco(page);
    afirma(hab ? db[CFG] && db[CFG].habilitacao === hab : !db[CFG], rot + ': o marcador antigo não é lido para decidir nem regravado');
    afirma(!erros.length, rot + ': nenhum erro de página', erros.join(' | '));
    await ctx.close();
  }
  /* ADMIN: nenhum controle de disponibilidade; o histórico antigo continua no banco */
  const dbHist = sementeAnalise('SOMENTE_ADMIN_GERAL');
  dbHist['analises-organizacionais-config-auditoria'] = { h1: { habilitacao: 'SOMENTE_ADMIN_GERAL', anterior: 'DESLIGADO', motivo: 'Homologação (registro antigo)', usuario: { uid: 'x', email: ADM }, dataHora: 1791713600000 } };
  let { ctx, page, erros } = await abrir(browser, { width: 1280, height: 900 }, '#arquitetura?arq=inicio', { db: dbHist, email: ADM });
  await page.waitForSelector('#avpAdminAcessos', { timeout: 20000 }); await page.waitForTimeout(800);
  afirma(!(await existe(page, '#anHabilitacao')) && !(await existe(page, '#anHabilitacaoAdmin')) && !/Disponibilidade de funcionalidades/.test(await texto(page, '#adminAvaliacaoProduto')),
    'ADMIN › Acessos (admin geral): sem "Disponibilidade de funcionalidades" e sem o formulário dos três estados');
  afirma(await existe(page, '#avpAdminAcessos #avpUsuariosBtn'), 'Acessos continua com as permissões (Usuários autorizados)');
  const depois = await banco(page);
  afirma(JSON.stringify(depois['analises-organizacionais-config-auditoria']) === JSON.stringify(dbHist['analises-organizacionais-config-auditoria']) && depois[CFG].habilitacao === 'SOMENTE_ADMIN_GERAL',
    'o histórico das alterações antigas e o último marcador ficam no banco, intactos (nada apagado nem migrado)');
  afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();
}

async function consulta(browser, db, idA) {
  console.log('\n== P. Perfil Avaliação (consulta) ==');
  const { ctx, page, erros } = await abrir(browser, { width: 1280, height: 900 }, '#arquitetura?an=lista', { db, email: AVAL });
  await page.waitForSelector('#anLista', { timeout: 20000 });
  afirma(!(await existe(page, '#anNovaBtn')), 'consulta: vê as análises, sem "Abrir uma análise"');
  await ir(page, '#arquitetura?an=' + idA);
  await page.waitForSelector('#anTitulo');
  afirma(!(await existe(page, '#anFormEntrega')) && !(await existe(page, '#anAbrirProposta')) && !(await existe(page, '#anPergunta')) && !(await existe(page, 'button[data-form="fatos"]')), 'consulta: nenhum formulário de gravação');
  afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();
}

async function celular(browser, db, idB) {
  console.log('\n== R. 375 px ==');
  const { ctx, page, erros } = await abrir(browser, { width: 375, height: 812 }, '#arquitetura?an=lista', { db });
  await page.waitForSelector('#anLista', { timeout: 20000 });
  afirma(await larguraOk(page), '375: lista sem rolagem lateral');
  await ir(page, '#arquitetura?an=nova'); await page.waitForSelector('#anFormNova');
  afirma(await larguraOk(page), '375: nova análise sem rolagem lateral');
  await ir(page, '#arquitetura?an=' + idB); await page.waitForSelector('#anTitulo');
  afirma(await larguraOk(page), '375: análise sem rolagem lateral');
  await abrirComposicao(page); await page.click('#anAbrirProposta'); await page.waitForSelector('#anFormProposta');
  afirma(await larguraOk(page), '375: formulário de proposta sem rolagem lateral');
  const k = await recorteId(page, 'Evolução da disciplina de arquitetura');
  await abrirDetalhes(page); await page.click('.an-recorte[data-recorte="' + k + '"] button[data-form="fatos"]'); await page.waitForSelector('#anFormFatos');
  afirma(await larguraOk(page), '375: formulário de fatos sem rolagem lateral');
  const alturas = await page.$$eval('#avaliacoesAnalise .btn, #avaliacoesAnalise .an-opcao', (ls) => ls.filter((l) => l.offsetParent).map((l) => l.getBoundingClientRect().height));
  afirma(alturas.every((h) => h >= 40), '375: alvos de toque com pelo menos 40 px', Math.min.apply(null, alturas));
  afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    await marcador(browser);
    const b = await jornadaB(browser);
    const a = await jornadaA(browser, b.db);
    const dbC = await jornadaC(browser, a.db, a.objPol);
    await consulta(browser, dbC, a.id);
    await celular(browser, dbC, b.id);
  } catch (e) { console.log('ERRO', e && e.stack || e); falhas++; }
  await browser.close();
  console.log('\n' + total + ' verificações — ' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})();
