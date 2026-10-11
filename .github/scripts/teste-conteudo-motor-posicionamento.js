/* H1-Final — redação por versão do motor de Posicionamento e a tela entendendo v1/v2 (sem navegador, sem rede).
 *
 *   A. A carga inicial v2 (conteudo-inicial-posicionamento-v2.js) é SÓ dados: os códigos/tipos/opções exatamente os do
 *      contrato do núcleo, nenhum campo de lógica (papel, regra, liberaSquad, motorCompativel), e não está no site.
 *   B. questionarios-config.js — trilha motores/<v>:
 *      - normalizarConteudoMotor prova a estrutura contra o contrato (faltando, sobrando, tipo, opção a mais/menos,
 *        código duplicado → recusa) e tira das opções tudo o que não é editorial;
 *      - importarConteudoInicial grava SÓ motores/2/rascunho, com motorCompativel = 2 dado pelo SISTEMA (um
 *        motorCompativel na carga é ignorado), recusa com a config não carregada e com rascunho existente;
 *      - sem publicação, a redação v2 é null (sem fallback para v1 nem fábrica); v1 continua a de sempre;
 *      - a trilha principal (a do motor em vigor) recusa a estrutura v2 — não há como publicar v2 por ela.
 *   C. avaliacao-posicionamento.js (núcleo sem DOM) com registros v1 e v2:
 *      - sem versaoMotor = v1 (registro legado continua v1); v1 ignora predominâncias;
 *      - v2: D1 com 3 SIM, D2 com as opções dos papéis com SIM, pendência de D2 em falta(), "mesma"→"distintas"
 *        tira a D2 e o que veio depois dela (limparForaDoCaminho), opção inválida não fica;
 *      - redacaoDisponivel: v1 sempre; v2 só com a redação publicada (rascunho NÃO vale);
 *      - snapshotPredominancia guarda o código e o rótulo da época. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RAIZ = path.join(__dirname, '..', '..', 'forca-agil');
const N = require(path.join(RAIZ, 'motor-posicionamento-nucleo.js'));
const QCOD = 'POSICIONAMENTO_ORGANIZACIONAL';

let total = 0, falhas = 0;
function afirma(c, msg, det) { total++; console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det ? ' → ' + det : '')); if (!c) falhas++; }
const clone = (v) => JSON.parse(JSON.stringify(v));

/* firebase falso mínimo: um nó por caminho, um listener 'value' por caminho, gravações registradas */
function contexto(arquivos) {
  const gravacoes = [], listeners = {};
  const ctx = { console, JSON, Object, Array, String, Math, Number, Date, RegExp, Error, Promise, Set, setTimeout, clearTimeout };
  ctx.window = ctx;
  ctx.firebase = { database: () => ({ ref: (p) => ({
    on(ev, cb) { listeners[p] = cb; }, off() {}, once() { return Promise.resolve({ val: () => null }); },
    set(v, cb) { gravacoes.push({ op: 'set', caminho: p, valor: clone(v) }); if (cb) cb(null); },
    remove(cb) { gravacoes.push({ op: 'remove', caminho: p }); if (cb) cb(null); },
    update(v, cb) { gravacoes.push({ op: 'update', caminho: p, valor: clone(v) }); if (cb) cb(null); }
  }) }) };
  vm.createContext(ctx);
  arquivos.forEach((f) => vm.runInContext(fs.readFileSync(path.join(RAIZ, f), 'utf8'), ctx, { filename: f }));
  ctx.__gravacoes = gravacoes;
  ctx.__entregar = (codigo, valor) => { const cb = listeners['questionarios-config/' + codigo]; if (cb) cb({ val: () => clone(valor) }); };
  return ctx;
}

console.log('A. carga inicial v2 = só dados');
const cx0 = contexto(['motor-posicionamento-nucleo.js', 'conteudo-inicial-posicionamento-v2.js']);
const CARGA = clone(cx0.faConteudoInicialPosicionamento[2]);
const contrato = N.contratoDoQuestionario(N.definicao(2));
afirma(CARGA.codigo === QCOD && CARGA.perguntas.length === contrato.itens.length, 'a carga tem os ' + contrato.itens.length + ' itens do contrato v2');
afirma(contrato.itens.every((it) => { const p = CARGA.perguntas.find((x) => x.codigoEstavel === it.codigoEstavel);
  return p && (!it.opcoes || JSON.stringify(p.opcoes.map((o) => o.codigo)) === JSON.stringify(it.opcoes)); }), 'mesmos códigos e, em D2, exatamente as opções do núcleo');
const PROIBIDOS = ['papel', 'regra', 'liberaSquad', 'motorCompativel', 'desce', 'confirma', 'nivel'];
const chaves = []; (function andar(o) { if (o && typeof o === 'object') Object.keys(o).forEach((k) => { chaves.push(k); andar(o[k]); }); })(CARGA);
afirma(!chaves.some((k) => PROIBIDOS.includes(k)), 'nenhum campo de lógica nem o vínculo na carga', chaves.filter((k) => PROIBIDOS.includes(k)).join(','));
afirma(!/conteudo-inicial-posicionamento/.test(fs.readFileSync(path.join(RAIZ, '..', 'index.html'), 'utf8')), 'a carga não é carregada pelo site (só sob demanda no ADMIN)');
const fonteCarga = fs.readFileSync(path.join(RAIZ, 'conteudo-inicial-posicionamento-v2.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
afirma(!/function\s*\(\s*[a-z]/i.test(fonteCarga.replace(/\(function \(\) \{/, '')) && !/faMotor|firebase|if \(/.test(fonteCarga), 'o arquivo da carga não tem lógica (nem lê motor ou banco)');

console.log('B. trilha motores/<v> em questionarios-config.js');
const cx = contexto(['motor-posicionamento-nucleo.js', 'questionarios-config.js']);
const Q = cx.faQuestionarios;
const ok = Q.normalizarConteudoMotor(QCOD, CARGA.perguntas, 2);
afirma(!ok.erro && ok.perguntas.length === 13, 'a carga normaliza contra o contrato v2', JSON.stringify(ok.erro));
afirma(ok.perguntas.filter((p) => p.tipo === 'diagnostico-predominancia').length === 3 && ok.perguntas.find((p) => p.codigoEstavel === 'DIAG_CONFLITO_RECORTE').tipo === 'diagnostico-conflito-recorte' &&
  ok.perguntas.filter((p) => /^O\d$/.test(p.codigoEstavel)).every((p) => p.tipo === 'binaria'), 'os tipos vêm do contrato');
function adulterada(f) { const c = clone(CARGA.perguntas); f(c); return Q.normalizarConteudoMotor(QCOD, c, 2); }
afirma(!!adulterada((c) => c.pop()).erro, 'item faltando → recusa');
afirma(!!adulterada((c) => c.push({ codigoEstavel: 'O10', texto: 'x' })).erro, 'item sobrando → recusa');
afirma(!!adulterada((c) => c.push(clone(c[0]))).erro, 'código duplicado → recusa');
afirma(!!adulterada((c) => { c.find((p) => p.codigoEstavel === 'DIAG_PREDOMINANCIA_N2').opcoes.push({ codigo: 'OUTRA', rotulo: 'x' }); }).erro, 'opção a mais em D2 → recusa');
afirma(!!adulterada((c) => { c.find((p) => p.codigoEstavel === 'DIAG_PREDOMINANCIA_N3').opcoes.shift(); }).erro, 'opção a menos em D2 → recusa');
afirma(!!adulterada((c) => { c.find((p) => p.codigoEstavel === 'DIAG_PREDOMINANCIA_N1').opcoes[0].codigo = 'LINHA'; }).erro, 'código de opção trocado → recusa');
const extra = adulterada((c) => { const o = c.find((p) => p.codigoEstavel === 'DIAG_PREDOMINANCIA_N1').opcoes[0]; o.papel = 'COE'; o.regra = 'X'; c[0].tipo = 'diagnostico-predominancia'; });
afirma(!extra.erro && !extra.perguntas.find((p) => p.codigoEstavel === 'DIAG_PREDOMINANCIA_N1').opcoes[0].papel && extra.perguntas[0].tipo === 'binaria',
  'papel/regra numa opção e tipo trocado no conteúdo não entram (o significado é do núcleo)');
afirma(Q.normalizarConteudoMotor(QCOD, CARGA.perguntas, 1).erro === 'estrutura-divergente', 'a carga v2 não serve ao contrato v1');
afirma(Q.normalizarConteudoMotor(QCOD, CARGA.perguntas, 9).erro === 'sem-contrato', 'versão de motor inexistente → sem contrato');
afirma(Q.normalizarPerguntas(QCOD, CARGA.perguntas).erro === 'estrutura-divergente', 'a trilha principal (motor em vigor) recusa a estrutura v2: não há como publicá-la por ela');

let erroImp = 'nao-chamou';
Q.importarConteudoInicial(QCOD, 2, { email: 'a@b' }, (e) => { erroImp = e; });
afirma(erroImp === 'config-nao-carregada' && !cx.__gravacoes.length, 'importar com a config ainda carregando → recusa, nada gravado');
Q.onMudanca(QCOD, () => {});
cx.__entregar(QCOD, null);
cx.faConteudoInicialPosicionamento = { 2: Object.assign(clone(CARGA), { perguntas: CARGA.perguntas.map((p) => Object.assign(clone(p), {})) , motorCompativel: 7 }) };
Q.importarConteudoInicial(QCOD, 2, { email: 'a@b' }, (e) => { erroImp = e; });
const g = cx.__gravacoes;
afirma(erroImp === null && g.length === 1 && g[0].op === 'set' && g[0].caminho === 'questionarios-config/' + QCOD + '/motores/2/rascunho', 'importa: uma gravação, só em motores/2/rascunho', JSON.stringify(g.map((x) => x.caminho)));
afirma(g[0].valor.motorCompativel === 2 && g[0].valor.origem === 'carga-inicial' && g[0].valor.perguntas.length === 13, 'o vínculo motorCompativel = 2 é do sistema (o 7 da carga não entra)');
afirma(N.conteudoCompativel(N.definicao(2), { codigo: QCOD, motorCompativel: g[0].valor.motorCompativel, perguntas: g[0].valor.perguntas }).compativel, 'o rascunho gravado é compatível com o motor v2');
afirma(!N.conteudoCompativel(N.definicao(1), { codigo: QCOD, motorCompativel: 2, perguntas: g[0].valor.perguntas }).compativel, '... e não com o v1');
cx.__entregar(QCOD, { motores: { 2: { rascunho: g[0].valor } } });
Q.importarConteudoInicial(QCOD, 2, null, (e) => { erroImp = e; });
afirma(erroImp === 'ja-existe-rascunho' && g.length === 1, 'com rascunho existente, importar de novo é recusado');
const sit = Q.situacaoConteudoMotor(QCOD, 2);
afirma(sit.temRascunho && sit.compativel && sit.versaoPublicada === null && sit.emVigor === false, 'situação: rascunho compatível, nada publicado, motor v2 não está em vigor');
afirma(Q.perguntasDoConteudoMotor(QCOD, 2) === null && Q.conteudoPerguntaMotor(QCOD, 2, 'O1') === null, 'sem publicação, a redação v2 é null — rascunho não vale e não há fallback');
afirma(Q.conteudoPerguntaMotor(QCOD, 1, 'O1').texto === Q.conteudoPergunta(QCOD, 'O1').texto, 'v1: a redação de sempre');
Q.descartarRascunhoConteudoMotor(QCOD, 2, () => {});
afirma(g.length === 2 && g[1].op === 'remove' && g[1].caminho === 'questionarios-config/' + QCOD + '/motores/2/rascunho', 'descartar remove só o rascunho da trilha v2');
afirma(!g.some((x) => /versaoPublicada|versoes/.test(x.caminho) && !/motores/.test(x.caminho)), 'nada tocou a trilha principal (versaoPublicada/versoes)');

console.log('C. a tela (núcleo sem DOM) com registros v1 e v2');
const PUB = { 2: { versaoPublicada: 1, versoes: { 1: { perguntas: ok.perguntas } } } };
const cy = contexto(['motor-posicionamento-nucleo.js', 'questionarios-config.js', 'motor-posicionamento.js', 'avaliacao-posicionamento.js']);
cy.faQuestionarios.onMudanca(QCOD, () => {});
cy.__entregar(QCOD, null);
const T = cy.faAvaliacaoPosicionamentoNucleo;
const R = (resp, extra) => { const r = Object.assign({ respostas: {}, questionnaireContentVersion: 1 }, extra || {}); Object.keys(resp).forEach((q) => { r.respostas[q] = { resposta: resp[q] }; }); return r; };
const TRES = { O1: 'SIM', O2: 'SIM', O3: 'SIM' };
const v1 = R(TRES);
afirma(T.versaoMotorDo(v1) === 1 && T.avaliar(v1).versaoMotor === 1 && T.avaliar(v1).regra === 'N1_RECORTE' && T.avaliar(v1).tipoAValidar === 'RECORTE', 'registro sem versaoMotor = v1 (3 SIM → recorte direto, regra v1)', T.avaliar(v1).regra);
afirma(!T.diagnosticoNecessario(v1, 'N1'), 'v1: 3 SIM não pede D1');
const v1p = R({ O1: 'SIM', O2: 'SIM', O3: 'NAO' }, { diagnosticos: { N1: { resposta: 'mesma' } }, predominancias: { N1: { resposta: 'EXECUCAO_ESPECIALIZADA' } } });
afirma(T.avaliar(v1p).codigoResultado === 'A_VALIDAR' && T.avaliar(v1p).tipoAValidar === 'CONFLITO' && !T.predominanciaNecessaria(v1p, 'N1'), 'v1 ignora predominâncias (mesma = conflito)');
const v2 = R(TRES, { versaoMotor: 2 });
afirma(T.diagnosticoNecessario(v2, 'N1') && T.falta(v2) && T.falta(v2).diagnostico === 'N1', 'v2: 3 SIM pede D1');
v2.diagnosticos = { N1: { resposta: 'mesma', papeis: T.papeisDoPar(v2, 'N1') } };
const pn = T.predominanciaNecessaria(v2, 'N1');
afirma(pn && JSON.stringify(pn.opcoes) === JSON.stringify(['RESULTADO_INTEGRADO', 'EXECUCAO_ESPECIALIZADA', 'CAPACIDADE_NOS_OUTROS', 'NAO_DETERMINAVEL']), 'v2: D1 "mesma" pede D2 com as opções dos papéis com SIM + não determinável', pn && pn.opcoes.join(','));
afirma(T.falta(v2) && T.falta(v2).predominancia === 'N1' && /predominância do Nível 1/.test(T.falta(v2).texto), 'falta(): predominância pendente impede concluir');
v2.predominancias = { N1: { resposta: 'CAPACIDADE_NOS_OUTROS', papeis: T.papeisDoPar(v2, 'N1') } };
afirma(T.avaliar(v2).codigoResultado === 'COE' && T.avaliar(v2).liberaSquad === false && T.falta(v2) === null, 'v2: predominância → COE, sem Squad, completa');
const sem2 = clone(v2); sem2.diagnosticos.N1.resposta = 'distintas';
const lim = T.limparForaDoCaminho(sem2);
afirma(!lim.reg.predominancias && JSON.stringify(lim.predsRemovidas) === '["N1"]', '"mesma" → "distintas": a D2 sai (limparForaDoCaminho)');
const desce = R({ O1: 'SIM', O2: 'SIM', O3: 'NAO', O4: 'NAO', O5: 'SIM' }, { versaoMotor: 2, diagnosticos: { N1: { resposta: 'mesma', papeis: ['LINHA', 'AREA_ESPECIALIZADA'] } }, predominancias: { N1: { resposta: 'RESULTADO_INTEGRADO', papeis: ['LINHA', 'AREA_ESPECIALIZADA'] } } });
afirma(T.avaliar(desce).codigoResultado === 'NEGOCIOS' && T.avaliar(desce).liberaSquad === true, 'v2: predominância do resultado integrado desce para N2 → Negócios, libera Squad');
const desceD = clone(desce); desceD.diagnosticos.N1.resposta = 'distintas';
const lim2 = T.limparForaDoCaminho(desceD);
afirma(!lim2.reg.predominancias && !lim2.reg.respostas.O4 && !lim2.reg.respostas.O5 && lim2.removidas.includes('O4'), 'fechar a D1 fecha o ramo que a D2 abriu: O4/O5 e a D2 saem');
const inval = clone(v2); inval.predominancias.N1.resposta = 'CAPACIDADE_TECNOLOGICA';
afirma(!T.limparForaDoCaminho(inval).reg.predominancias && T.avaliar(inval).regra === 'N1_PREDOMINANCIA_PENDENTE', 'opção que não é deste nível não fica e conta como pendente');
const parMudou = clone(v2); parMudou.predominancias.N1.papeis = ['LINHA', 'COE'];
afirma(!T.limparForaDoCaminho(parMudou).reg.predominancias, 'D2 respondida para outro conjunto de papéis não fica');
afirma(T.redacaoDisponivel(v1) === true && T.redacaoDisponivel(v2) === false, 'redação: v1 sempre; v2 sem publicação → indisponível');
cy.__entregar(QCOD, { motores: { 2: { rascunho: { perguntas: ok.perguntas, motorCompativel: 2 } } } });
afirma(T.redacaoDisponivel(v2) === false, 'v2 com só um RASCUNHO da redação → continua indisponível');
cy.__entregar(QCOD, { motores: PUB });
afirma(T.redacaoDisponivel(v2) === true, 'v2 com a redação publicada na trilha → disponível');
const sp = T.snapshotPredominancia('N1', 'CAPACIDADE_NOS_OUTROS', ['LINHA', 'AREA_ESPECIALIZADA', 'COE'], 1, 'obs', '2026-10-10T00:00:00Z', 2);
afirma(sp.resposta === 'CAPACIDADE_NOS_OUTROS' && sp.rotuloNaEpoca === 'Capacidade desenvolvida nos outros' && /predominantemente o valor/.test(sp.textoPerguntaNaEpoca) && sp.questionnaireContentVersion === 1,
  'snapshotPredominancia: código + rótulo e texto da época');
const sr = T.snapshotResposta('O1', 'SIM', 1, null, 'x', 2);
afirma(/fluxo de valor ou capacidade em funcionamento/.test(sr.textoPerguntaNaEpoca), 'v2: a resposta guarda a redação da trilha v2, não a v1');
afirma(T.snapshotResposta('O1', 'SIM', 1, null, 'x').textoPerguntaNaEpoca === cy.faQuestionarios.conteudoPergunta(QCOD, 'O1', 1).texto, 'v1: a resposta guarda a redação v1 de sempre');

console.log('D. publicar a redação v2 (B2) — a gravação que a tela monta');
function contextoPub(user) {
  const updates = [], listeners = {};
  const ctx = { console, JSON, Object, Array, String, Math, Number, Date, RegExp, Error, Promise, Set, setTimeout, clearTimeout };
  ctx.window = ctx;
  let seq = 0;
  const database = () => ({ ref: (p) => ({
    on(ev, cb) { listeners[p] = cb; }, off() {}, once() { return Promise.resolve({ val: () => null }); },
    set(v, cb) { if (cb) cb(null); }, remove(cb) { if (cb) cb(null); },
    push() { return { key: 'k' + (++seq) }; },
    update(v, cb) { updates.push(clone(v)); ctx.__resposta(cb); }
  }) });
  database.ServerValue = { TIMESTAMP: { '.sv': 'timestamp' } };
  ctx.firebase = { database, auth: () => ({ currentUser: user }) };
  ctx.firebase.database.ServerValue = database.ServerValue;
  ctx.__resposta = (cb) => cb(null);
  vm.createContext(ctx);
  ['motor-posicionamento-nucleo.js', 'governanca-posicionamento.js', 'questionarios-config.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(RAIZ, f), 'utf8'), ctx, { filename: f }));
  ctx.faQuestionarios.onMudanca(QCOD, () => {});
  ctx.__entregar = (valor) => listeners['questionarios-config/' + QCOD]({ val: () => clone(valor) });
  return { Q: ctx.faQuestionarios, G: ctx.faGovernancaPosicionamento, updates, ctx };
}
const USER = { uid: 'u-ana', email: 'ana@previ.com.br' };
let cp = contextoPub(USER), res = 'nao-chamou';
cp.Q.publicarConteudoMotor(QCOD, 2, { name: 'Ana' }, (e) => { res = e; });
afirma(res === 'config-nao-carregada' && !cp.updates.length, 'config ainda carregando → não publica');
cp.__ = cp.ctx.__entregar({ motores: { 2: {} } });
cp.Q.publicarConteudoMotor(QCOD, 2, { name: 'Ana' }, (e) => { res = e; });
afirma(res === 'sem-rascunho' && !cp.updates.length, 'sem rascunho → não publica');
cp.ctx.__entregar({ motores: { 2: { rascunho: { perguntas: ok.perguntas.slice(1), motorCompativel: 2 } } } });
cp.Q.publicarConteudoMotor(QCOD, 2, { name: 'Ana' }, (e) => { res = e; });
afirma(res === 'estrutura-divergente' && !cp.updates.length, 'rascunho incompatível com o contrato → não publica');
cp.ctx.__entregar({ motores: { 2: { rascunho: { perguntas: ok.perguntas, motorCompativel: 2 }, publicacaoSuspensa: { ativa: true, motivo: 'm' } } } });
cp.Q.publicarConteudoMotor(QCOD, 2, { name: 'Ana' }, (e) => { res = e; });
afirma(res === 'publicacao-suspensa' && !cp.updates.length, 'publicação suspensa → não publica');
cp.ctx.__entregar({ motores: { 2: { rascunho: { perguntas: ok.perguntas, motorCompativel: 2 }, versaoPublicada: 1, versoes: { 1: { perguntas: ok.perguntas } }, publicacaoSuspensa: { ativa: false, motivo: 'm' } } } });
let info = null;
cp.Q.publicarConteudoMotor(QCOD, 2, { name: 'Ana' }, (e, i) => { res = e; info = i; });
const u = cp.updates[0] || {}, base = 'questionarios-config/' + QCOD + '/motores/2';
const ver = u[base + '/versoes/2'], audK = ver && ver.auditoriaId, aud = u['questionarios-motor-auditoria/' + QCOD + '/2/' + audK];
afirma(res === null && info.versao === 2 && cp.updates.length === 1, 'publica a versão seguinte (2), numa gravação só');
afirma(Object.keys(u).sort().join() === [base + '/rascunho', base + '/versaoPublicada', base + '/versoes/2', 'questionarios-motor-auditoria/' + QCOD + '/2/' + audK].sort().join(), 'a gravação é exatamente: versão + ponteiro + rascunho removido + auditoria');
afirma(u[base + '/versaoPublicada'] === 2 && u[base + '/rascunho'] === null, 'ponteiro = 2; rascunho sai');
afirma(ver.publicadoPor.uid === 'u-ana' && ver.publicadoPor.email === 'ana@previ.com.br' && ver.publicadoPor.name === 'Ana', 'autoria = UID e e-mail da sessão');
afirma(JSON.stringify(ver.publicadoEm) === '{".sv":"timestamp"}' && JSON.stringify(aud.dataHora) === '{".sv":"timestamp"}', 'horário = o do servidor (nunca o do aparelho)');
afirma(ver.motorCompativel === 2 && ver.digestRedacao === cp.G.digestRedacao(ok.perguntas) && aud.digestRedacao === ver.digestRedacao && aud.versao === 2 && aud.tipo === 'publicacao', 'vínculo do sistema, digest da redação e auditoria coerentes');
afirma(Object.keys(ver).sort().join() === 'auditoriaId,digestRedacao,motorCompativel,perguntas,publicadoEm,publicadoPor' && !('validadaParaAtivacao' in ver), 'a tela não marca a versão como validada');
afirma(cp.Q.versoesPublicadasConteudoMotor(QCOD, 2).every((x) => x.validadaParaAtivacao === false), 'leitura: publicada sempre "não validada" (só a fronteira confiável muda isso)');
const semSessao = contextoPub(null);
semSessao.ctx.__entregar({ motores: { 2: { rascunho: { perguntas: ok.perguntas, motorCompativel: 2 } } } });
semSessao.Q.publicarConteudoMotor(QCOD, 2, null, (e) => { res = e; });
afirma(res === 'sem-sessao' && !semSessao.updates.length, 'sem sessão autenticada (sem UID) → não publica');
const lento = contextoPub(USER);
lento.ctx.__resposta = () => {}; /* o banco nunca responde */
lento.ctx.__entregar({ motores: { 2: { rascunho: { perguntas: ok.perguntas, motorCompativel: 2 } } } });
const esperar = new Promise((fim) => lento.Q.publicarConteudoMotor(QCOD, 2, null, (e) => fim(e), 30));
esperar.then((e) => {
  afirma(e === 'sem-resposta', 'sem resposta do banco → "sem-resposta" (nunca "publicado" nem "falhou")');
  const sp = contextoPub(USER); let r2;
  sp.ctx.__entregar({ motores: { 2: {} } });
  sp.Q.definirSuspensaoPublicacao(QCOD, 2, true, '  ', null, (x) => { r2 = x; });
  afirma(r2 === 'sem-motivo' && !sp.updates.length, 'suspender sem motivo → recusado');
  sp.Q.definirSuspensaoPublicacao(QCOD, 2, false, 'm', null, (x) => { r2 = x; });
  afirma(r2 === 'sem-mudanca', 'retomar o que não está suspenso → sem mudança');
  sp.Q.definirSuspensaoPublicacao(QCOD, 2, true, 'Problema na redação', null, (x) => { r2 = x; });
  const us = sp.updates[0] || {}, s1 = us['questionarios-config/' + QCOD + '/motores/2/publicacaoSuspensa'];
  const a1 = s1 && us['questionarios-motor-auditoria/' + QCOD + '/2/' + s1.auditoriaId];
  afirma(r2 === null && s1.ativa === true && s1.motivo === 'Problema na redação' && s1.por.uid === 'u-ana' && JSON.stringify(s1.em) === '{".sv":"timestamp"}' && a1 && a1.tipo === 'suspensao', 'suspender: estado + auditoria "suspensao", UID e horário do servidor');
  afirma(Object.keys(us).length === 2 && !Object.keys(us).some((k) => /versoes|versaoPublicada/.test(k)), 'suspender não toca nas versões publicadas nem no ponteiro');
  console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
  process.exit(falhas ? 1 : 0);
});
