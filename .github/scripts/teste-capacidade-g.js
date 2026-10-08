/* Capacidade organizacional "G" — proposta de regras da versão 6 (entregue pelo código, publicada só pela tela).
 *
 * Decisão: CAPACIDADE_ORGANIZACIONAL deixa de exigir P1 = NÃO e ganha só a proteção do núcleo COMPLETO de
 * Produto/Serviço — P11 = SIM, P15 = NÃO e não (P1, P2, P3, P4, P5 e P8 = SIM). Precedência igual. Os
 * textos de Capacidade deixam de afirmar "interna, sem necessidade de cliente identificável".
 *
 * PARTE A (motor real num vm, sem navegador): delta EXATO nas 65.536 combinações sobre a versão 5 —
 *   Capacidade 128 → 252; exatamente 124 de "A validar" para Capacidade; os 4 do núcleo completo continuam
 *   "A validar"; os 128 de antes continuam Capacidade; nenhuma outra classificação (nem regra aplicada,
 *   nem motivos) muda; P11 + P15 = SIM nunca vira Capacidade; S1–S8 não participam; casos nomeados;
 *   a proposta só existe sobre a versão 5 exata e consultar nunca grava.
 * PARTE B (navegador, banco falso em persistenciaReal, desktop e 375 px): o cartão da proposta no editor
 *   do motor (versão 5 publicada), carregar e simular sem gravar; com a versão 6 publicada, uma avaliação
 *   nova com P1 e P11 = SIM é Capacidade, com os motivos, a relação e a justificativa novos, e a
 *   avaliação concluída antes fica byte a byte igual. Hermético: sem rede, sem segredo. */
const { chromium } = require('playwright');
const { esperarSessaoAssentada } = require('./esperas');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const RAIZ = path.join(__dirname, '..', '..', 'forca-agil');
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const SRC = { qc: fs.readFileSync(path.join(RAIZ, 'questionarios-config.js'), 'utf8'), motor: fs.readFileSync(path.join(RAIZ, 'motor-arquitetura.js'), 'utf8') };
const EMAIL = 'adm@previ.com.br';
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const clone = (x) => JSON.parse(JSON.stringify(x));
const C = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'P11', 'P12', 'P13', 'P14', 'P15', 'P16'];
const ORDEM = ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia', 'jornada', 'medicao', 'gestao',
  'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'];
const NUCLEO = ['P1', 'P2', 'P3', 'P4', 'P5', 'P8'];
const MOTIVOS_ESPERADOS = ['É principalmente uma capacidade que a organização precisa possuir: SIM', 'É principalmente um elemento estrutural que compõe outro Produto/Serviço: NÃO'];
const RELACAO = 'Representa uma capacidade que a organização precisa possuir para realizar, sustentar ou evoluir suas entregas. Pode atender públicos internos ou externos; a existência de um público identificável não determina, por si só, que o item seja Produto/Serviço.';
const JUSTIFICATIVA = 'As respostas indicam que o item é principalmente uma capacidade que a organização precisa possuir. Embora possa atender um cliente ou público e apresentar alguns sinais associados a Produto/Serviço, não reúne simultaneamente todo o núcleo que caracteriza uma solução principal. Por isso, sua classificação predominante é Capacidade organizacional.';
const SEM_CLIENTE = /sem necessidade de cliente|capacidade organizacional interna/;

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (cond || detalhe === undefined ? '' : ' — ' + detalhe)); if (!cond) falhas++; }

function carregar(config, escritas) {
  const ctx = { console: { log() {}, warn() {}, error() {} } };
  ctx.window = ctx;
  const anota = (op, p) => { if (escritas) escritas.push(op + ' ' + p); };
  const ref = (p) => ({
    on(ev, cb) { if (p === 'motor-arquitetura-config' && config !== undefined) cb({ val: () => clone(config) }); },
    once() {}, off() {}, update() { anota('update', p); }, set() { anota('set', p); }, remove() { anota('remove', p); },
    transaction() { anota('transaction', p); }, child(c) { return ref(p + '/' + c); }, push() { anota('push', p); return { key: 'k' }; }
  });
  ctx.firebase = { database: () => ({ ref }) };
  ctx.navigator = {}; ctx.location = { hash: '' };
  vm.createContext(ctx);
  vm.runInContext(SRC.qc, ctx, { filename: 'questionarios-config.js' });
  vm.runInContext(SRC.motor, ctx, { filename: 'motor-arquitetura.js' });
  if (config !== undefined) ctx.window.faMotorArquitetura.onMudanca(function () {});
  return ctx.window.faMotorArquitetura;
}
const contexto = (n) => { const c = {}; for (let b = 0; b < 16; b++) c[C[b]] = (n >> b) & 1 ? 'SIM' : 'NAO'; return c; };
const bitsDe = (sims) => sims.reduce((n, c) => n | (1 << C.indexOf(c)), 0);

function parteA() {
  console.log('== PARTE A — motor real, 65.536 combinações sobre a versão 5 ==');
  const M = carregar();
  const v5 = M.regrasVersao5Esperadas();
  const g = M.construirPropostaCapacidadeG(clone(v5));
  afirma(JSON.stringify(v5) === JSON.stringify(M.regrasVersao5Esperadas()), 'montar a proposta não altera as regras da versão 5 recebidas');
  afirma(M.validarRegras({ regras: g }).length === 0, 'a proposta passa na validação do motor (a mesma que barra a publicação)', M.validarRegras({ regras: g }).join(' / '));
  const dif = M.diffRegras(v5, g).map((d) => d.codigo);
  afirma(JSON.stringify(dif) === '["CAPACIDADE_ORGANIZACIONAL"]', 'só a regra de Capacidade muda', dif.join(','));
  const cap = g.find((r) => r.codigo === 'CAPACIDADE_ORGANIZACIONAL'), cap5 = v5.find((r) => r.codigo === 'CAPACIDADE_ORGANIZACIONAL');
  afirma(cap.ordem === cap5.ordem, 'precedência da Capacidade igual (' + cap.ordem + ')');
  afirma(JSON.stringify(cap.condicoes) === JSON.stringify({ all: [{ campo: 'P11', valor: 'SIM' }, { campo: 'P15', valor: 'NAO' }, { not: { all: NUCLEO.map((campo) => ({ campo, valor: 'SIM' })) } }] }),
    'condição: P11 = SIM, P15 = NÃO e não (P1, P2, P3, P4, P5 e P8 = SIM) — sem P1 = NÃO', JSON.stringify(cap.condicoes));
  afirma(JSON.stringify(cap.motivos) === '["P11","P15"]', 'motivos: P11 e P15 (P1 deixa de ser motivo)', JSON.stringify(cap.motivos));

  const a = [], b = [];
  for (let n = 0; n < 65536; n++) { a.push(M.identificarCamada(contexto(n), { regras: v5 })); b.push(M.identificarCamada(contexto(n), { regras: g })); }
  const conta = (lista, camada) => lista.filter((x) => x.camada === camada).length;
  afirma(conta(a, 'capacidade-organizacional') === 128 && conta(b, 'capacidade-organizacional') === 252, 'Capacidade: 128 → 252', conta(a, 'capacidade-organizacional') + ' → ' + conta(b, 'capacidade-organizacional'));
  const mudam = []; for (let n = 0; n < 65536; n++) if (a[n].camada !== b[n].camada || a[n].regraAplicada !== b[n].regraAplicada) mudam.push(n);
  /* fora de Capacidade, o retorno do motor é idêntico (motivos, conflito, incoerência…); nos 128 que já
     eram Capacidade só os motivos mudam: P1 deixa de ser motivo */
  let outrosIguais = true, so128Motivos = true;
  for (let n = 0; n < 65536; n++) {
    if (a[n].camada !== 'capacidade-organizacional' && b[n].camada !== 'capacidade-organizacional' && JSON.stringify(a[n]) !== JSON.stringify(b[n])) outrosIguais = false;
    if (a[n].camada === 'capacidade-organizacional') { const x = Object.assign({}, a[n], { motivosCodigos: null }), y = Object.assign({}, b[n], { motivosCodigos: null });
      if (JSON.stringify(x) !== JSON.stringify(y) || JSON.stringify(a[n].motivosCodigos) !== '["P11","P1","P15"]' || JSON.stringify(b[n].motivosCodigos) !== '["P11","P15"]') so128Motivos = false; }
  }
  afirma(outrosIguais, 'fora de Capacidade, o retorno completo do motor é idêntico nas 65.536 (motivos, conflito, incoerência)');
  afirma(so128Motivos, 'nos 128 que já eram Capacidade, só os motivos mudam: P11, P1, P15 → P11, P15');
  afirma(mudam.length === 124, 'exatamente 124 combinações mudam', mudam.length);
  afirma(mudam.every((n) => a[n].camada === 'a-validar' && a[n].regraAplicada === 'FALLBACK_A_VALIDAR' && b[n].camada === 'capacidade-organizacional'), 'todas de "A validar" (sem classificação) para Capacidade');
  afirma(mudam.every((n) => { const c = contexto(n); return c.P1 === 'SIM' && c.P11 === 'SIM' && ['P9', 'P10', 'P12', 'P13', 'P14', 'P15', 'P16'].every((k) => c[k] === 'NAO') && !NUCLEO.every((k) => c[k] === 'SIM'); }),
    'todas com P1 e P11 = SIM, nenhuma outra natureza e sem o núcleo completo');
  let antesCap = 0, continuam = 0; for (let n = 0; n < 65536; n++) if (a[n].camada === 'capacidade-organizacional') { antesCap++; if (b[n].camada === 'capacidade-organizacional') continuam++; }
  afirma(antesCap === 128 && continuam === 128, 'os 128 que já eram Capacidade continuam Capacidade', continuam);
  const nucleo = []; for (let n = 0; n < 65536; n++) { const c = contexto(n); if (c.P11 === 'SIM' && NUCLEO.every((k) => c[k] === 'SIM') && ['P9', 'P10', 'P12', 'P13', 'P14', 'P15', 'P16'].every((k) => c[k] === 'NAO')) nucleo.push(n); }
  afirma(nucleo.length === 4 && nucleo.every((n) => b[n].camada === 'a-validar' && a[n].camada === 'a-validar'), 'os 4 com o núcleo completo + P11 continuam "A validar"', nucleo.map((n) => b[n].camada).join(','));
  let p11p15 = 0, p11p15Cap = 0; for (let n = 0; n < 65536; n++) { const c = contexto(n); if (c.P11 === 'SIM' && c.P15 === 'SIM') { p11p15++; if (b[n].camada === 'capacidade-organizacional') p11p15Cap++; } }
  afirma(p11p15 === 16384 && p11p15Cap === 0, 'P11 + P15 = SIM (16.384 combinações) nunca vira Capacidade');
  /* P15 = NÃO é redundante hoje (o conflito pega antes), mas fica explícito */
  const semP15 = clone(g); semP15.find((r) => r.codigo === 'CAPACIDADE_ORGANIZACIONAL').condicoes.all.splice(1, 1);
  let difP15 = 0; for (let n = 0; n < 65536; n++) if (M.identificarCamada(contexto(n), { regras: semP15 }).camada !== b[n].camada) difP15++;
  afirma(difP15 === 0, 'P15 = NÃO hoje é garantida pela precedência (tirá-la mudaria 0 combinações) e continua explícita na regra');

  console.log('-- casos nomeados --');
  const caso = (sims) => M.identificarCamada(contexto(bitsDe(sims)), { regras: g });
  const caso5 = (sims) => M.identificarCamada(contexto(bitsDe(sims)), { regras: v5 });
  afirma(caso(['P1', 'P11']).camada === 'capacidade-organizacional' && caso5(['P1', 'P11']).camada === 'a-validar', 'P1 + P11 = SIM, sem núcleo completo → Capacidade (antes: A validar)');
  afirma(caso(['P1', 'P2', 'P5', 'P11']).camada === 'capacidade-organizacional', 'P1, P2, P5 e P11 = SIM, com P3, P4 e P8 = NÃO → Capacidade');
  afirma(caso(['P1', 'P2', 'P3', 'P4', 'P5', 'P8', 'P11']).camada === 'a-validar', 'núcleo completo (P1–P5 e P8) + P11 → continua A validar');
  afirma(caso(['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P11']).camada === 'capacidade-organizacional', 'P8 = NÃO e os demais sinais fortes (P1–P7) + P11 → Capacidade');
  afirma(caso(['P11']).camada === 'capacidade-organizacional' && caso5(['P11']).camada === 'capacidade-organizacional', 'P11 sozinho (P1 = NÃO) → Capacidade, antes e depois');
  afirma(JSON.stringify(caso(['P1', 'P11']).motivosCodigos) === '["P11","P15"]', 'motivos do motor para Capacidade: P11 e P15', JSON.stringify(caso(['P1', 'P11']).motivosCodigos));

  console.log('-- S1–S8 não participam --');
  const comS = (n, v) => { const c = contexto(n); for (let i = 1; i <= 8; i++) c['S' + i] = v; return c; };
  let difS = 0; for (let n = 0; n < 65536; n += 7) { if (M.identificarCamada(comS(n, 'SIM'), { regras: g }).camada !== b[n].camada || M.identificarCamada(comS(n, 'NAO'), { regras: g }).camada !== b[n].camada) difS++; }
  afirma(difS === 0, 'S1–S8 = SIM ou NÃO no contexto não mudam nenhuma classificação (amostra de 9.363 combinações, cada uma com S tudo SIM e tudo NÃO)');
  const comCondS = clone(g); comCondS.find((r) => r.codigo === 'CAPACIDADE_ORGANIZACIONAL').condicoes.all.push({ campo: 'S6', valor: 'SIM' });
  afirma(M.validarRegras({ regras: comCondS }).length > 0, 'e o validador recusa uma condição com S6 na regra de Capacidade');

  console.log('-- a proposta só existe sobre a versão 5 exata, e consultar nunca grava --');
  const escritas = [];
  const v4 = M.construirPropostaConflitoNaturezas(M.regrasVersao3Esperadas());
  const base5 = { versaoPublicada: 5, versoes: { 4: { regras: v4 }, 5: { regras: v5 } } };
  const k5 = carregar(base5, escritas);
  const s5 = k5.situacaoPropostaRegras();
  afirma(s5.estado === 'disponivel' && s5.versaoBase === 5 && s5.id === 'capacidade-g', 'versão 5 publicada com a estrutura esperada: Capacidade G disponível', JSON.stringify(s5).slice(0, 200));
  afirma(k5.diffRegras(k5.regrasDaPropostaRegras(), g).length === 0, 'as regras entregues são exatamente a proposta aprovada');
  const v5Div = clone(base5); v5Div.versoes[5].regras.find((r) => r.codigo === 'CANAL').condicoes.all.push({ campo: 'P2', valor: 'NAO' });
  const kd = carregar(v5Div, escritas).situacaoPropostaRegras();
  afirma(kd.estado === 'bloqueada' && /não tem a estrutura esperada/.test(kd.motivo) && /CANAL/.test(kd.motivo), 'versão 5 com outra estrutura: bloqueada, dizendo qual regra difere', kd.motivo);
  const k6 = carregar({ versaoPublicada: 6, versoes: { 5: { regras: v5 }, 6: { regras: g } } }, escritas).situacaoPropostaRegras();
  /* com a 6 publicada, a proposta que passa a valer é a seguinte (versão 7); a G deixa de ser oferecida */
  afirma(k6.id !== 'capacidade-g', 'versão 6 = a proposta publicada: a Capacidade G deixa de ser oferecida (passa a valer a proposta seguinte, ' + k6.id + ')');
  const k4 = carregar({ versaoPublicada: 4, versoes: { 4: { regras: v4 } } }, escritas).situacaoPropostaRegras();
  afirma(k4.id === 'politica-conflito-naturezas', 'com a versão 4 publicada, continua valendo a proposta anterior (conflito de naturezas)');
  afirma(escritas.length === 0, 'nenhuma consulta gravou nada', escritas.join(', '));
  return { v4, v5, g };
}

function item(nome, sims, camada, extra) {
  const respostas = {};
  ORDEM.forEach((id, i) => { const cod = 'P' + (i + 1); respostas[id] = { valor: sims.indexOf(cod) !== -1 ? 'sim' : 'nao', observacao: '', justificativaAuto: 'auto', codigoPergunta: cod, textoPerguntaNaEpoca: 't', tituloNaEpoca: 't', questionnaireContentVersion: 1 }; });
  return Object.assign({
    nome, descricao: '', publico: '', necessidade: '', observacoesGerais: '', status: 'concluido', respostas,
    resultadoAutomatico: camada === 'a-validar' ? 'a-validar' : 'nao-produto', decisaoFinal: null, decisaoManual: false,
    camadaSugerida: { id: camada, label: camada, motivos: ['motivo da época'], conflito: null, incoerencia: false, especializacao: null, papelEstrutural: null, relacao: 'relação da época' },
    justificativaAutomatica: 'justificativa da época', criteriosEssenciaisFalhos: [], exclusoesConflitantes: null, criteriosAtendidos: 1,
    motorVersionArquitetura: 5, questionnaireContentVersion: 1, criadoEm: '2026-10-07T10:00:00.000Z', atualizadoEm: '2026-10-07T10:00:00.000Z',
    responsavel: { name: 'Teste', email: EMAIL }, versao: 1, versaoAnteriorKey: null, excluido: false, excluidoEm: null, excluidoPor: null,
    justificativaExclusao: null, historicoMotor: null, itemId: nome
  }, extra || {});
}
async function abrir(browser, viewport, configMotor, avaliacoes, rota) {
  const admins = {}; admins[chave(EMAIL)] = { email: EMAIL };
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': admins, 'turmas-config': {}, 'turmas-checkin': {}, 'turmas-espera': {},
    'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {}, eventos: {}, 'turmas-publico': {}, 'eventos-publico': {},
    'avaliacoes-produto': avaliacoes, 'avaliacoes-squad': {}, 'motor-squad-config': {}, 'motor-squad-auditoria': {},
    'motor-arquitetura-config': configMotor, 'motor-arquitetura-auditoria': {} };
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify({ db, user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#' + (rota || 'admin'), { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
const banco = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal)));
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

async function parteB(browser, R) {
  const base5 = { versaoPublicada: 5, versoes: { 4: { regras: R.v4 }, 5: { regras: R.v5 } } };
  const publicada6 = { versaoPublicada: 6, versoes: { 4: { regras: R.v4 }, 5: { regras: R.v5 }, 6: { regras: R.g } } };
  for (const [rotulo, viewport] of [['desktop', { width: 1280, height: 900 }], ['celular 375 px', { width: 375, height: 800 }]]) {
    console.log('\n== PARTE B (' + rotulo + ') — cartão da proposta no editor do motor (versão 5 publicada) ==');
    {
      const avaliacoes = { interna: item('Capacidade interna', ['P11'], 'capacidade-organizacional'), comPublico: item('Capacidade com público', ['P1', 'P11'], 'a-validar') };
      const { ctx, page, erros } = await abrir(browser, viewport, clone(base5), avaliacoes);
      await page.click('.admin-tab-btn[data-panel="adminPanelArquitetura"]');
      await page.waitForSelector('#avpConfigMotoresBtn');
      await page.click('#avpConfigMotoresBtn');
      await page.waitForSelector('#avpMotorArqEditarBtn');
      const inicio = await banco(page);
      await page.click('#avpMotorArqEditarBtn');
      await page.waitForSelector('#avpPropostaRegras');
      const cartao = page.locator('#avpPropostaRegras');
      const txt = await cartao.innerText();
      afirma(await cartao.getAttribute('data-estado') === 'disponivel' && /Capacidade G/.test(txt) && /deixa de exigir P1 = NÃO/.test(txt) && /128 para 252/.test(txt), 'o cartão da Capacidade G aparece, disponível, com as mudanças descritas', txt.slice(0, 200));
      afirma(await larguraOk(page), 'cartão sem rolagem horizontal');
      await page.click('#avpCarregarPropostaBtn');
      await page.click('.avp-modal-confirm-btn');
      await page.waitForSelector('#avpPropostaNoEditor');
      afirma(JSON.stringify(await banco(page)) === JSON.stringify(inicio), 'carregar a proposta não gravou nada');
      await page.click('#avpMotorArqSimularBtn');
      await page.waitForSelector('#avpMotorArqConfirmarPublicarBtn');
      const sim = await page.locator('.avp-config-motores').innerText();
      afirma(/2 avaliações analisadas/.test(sim) && /1 manteria/.test(sim) && /1 mudaria/.test(sim), 'simulação: 2 analisadas, 1 mantém (Capacidade interna), 1 mudaria (Capacidade com público)', sim.slice(0, 240));
      afirma(JSON.stringify(await banco(page)) === JSON.stringify(inicio), 'simular não gravou nada');
      afirma(await larguraOk(page), 'simulação sem rolagem horizontal');
      afirma(erros.length === 0, 'sem erro de página', erros.join(' | '));
      await ctx.close();
    }

    console.log('== PARTE B (' + rotulo + ') — versão 6 publicada: avaliação nova com P1 e P11 = SIM ==');
    {
      const antiga = item('Concluída na versão 5', ['P1', 'P11'], 'a-validar');
      const { ctx, page, erros } = await abrir(browser, viewport, clone(publicada6), { antiga: clone(antiga) }, 'avaliacoes');
      await page.waitForSelector('#avpNovoBtn');
      const inicio = await banco(page);
      await page.click('#avpNovoBtn');
      await page.fill('#avpfNome', 'Gestão atuarial');
      await page.click('#avpIniciarBtn');
      await page.waitForSelector('#avpQuestion-capacidade');
      for (const id of ORDEM) await page.locator('#avpQuestion-' + id + ' .avp-choice-btn--' + (id === 'necessidade' || id === 'capacidade' ? 'sim' : 'nao')).click();
      await page.click('#avpConcluirBtn');
      await page.waitForSelector('.avp-reasoning-list', { timeout: 10000 });
      const db = await banco(page);
      const nova = Object.values(db['avaliacoes-produto']).find((i) => i.nome === 'Gestão atuarial');
      afirma(nova && nova.camadaSugerida.id === 'capacidade-organizacional' && nova.motorVersionArquitetura === 6, 'Capacidade organizacional, processada pela versão 6', nova && (nova.camadaSugerida.id + ' / v' + nova.motorVersionArquitetura));
      afirma(JSON.stringify(nova.camadaSugerida.motivos) === JSON.stringify(MOTIVOS_ESPERADOS), 'motivos: P11 = SIM e P15 = NÃO, sem P1', JSON.stringify(nova.camadaSugerida.motivos));
      afirma(nova.camadaSugerida.relacao === RELACAO, 'relação arquitetural nova', nova.camadaSugerida.relacao);
      afirma(nova.justificativaAutomatica === JUSTIFICATIVA, 'justificativa nova', nova.justificativaAutomatica);
      const ficha = await page.locator('.avp-alt-card').textContent();
      afirma(MOTIVOS_ESPERADOS.every((m) => ficha.includes(m)) && ficha.includes(RELACAO) && ficha.includes(JUSTIFICATIVA) && !SEM_CLIENTE.test(ficha), 'a ficha mostra motivos, relação e justificativa novos, sem "sem necessidade de cliente"');
      afirma(JSON.stringify(db['avaliacoes-produto'].antiga) === JSON.stringify(inicio['avaliacoes-produto'].antiga), 'a avaliação concluída na versão 5 fica byte a byte igual (nada reprocessado sozinho)');
      afirma(JSON.stringify(db['motor-arquitetura-config']) === JSON.stringify(inicio['motor-arquitetura-config']), 'as regras publicadas não mudaram');
      afirma(await larguraOk(page), 'ficha sem rolagem horizontal');
      afirma(erros.length === 0, 'sem erro de página', erros.join(' | '));
      await ctx.close();
    }
  }
}

(async () => {
  const R = parteA();
  const browser = await chromium.launch();
  try { await parteB(browser, R); } catch (e) { afirma(false, 'execução', String(e && e.stack || e)); }
  await browser.close();
  console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nOK — Capacidade G: delta exato, proposta só pela tela, textos novos e histórico intacto.');
  process.exit(falhas ? 1 : 0);
})();
