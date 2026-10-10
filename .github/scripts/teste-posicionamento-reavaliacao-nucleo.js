/* POSICIONAMENTO ORGANIZACIONAL — núcleo da DECISÃO e da REAVALIAÇÃO (PR F), sem navegador e sem rede (vm).
 *
 * Carrega o código real (questionarios-config, motor-arquitetura, avaliacao-produto — de onde vem o critério de
 * reavaliação —, motor-posicionamento e avaliacao-posicionamento) e troca só o conteúdo das versões do questionário
 * POSICIONAMENTO_ORGANIZACIONAL, para provar:
 *   1. herança de O1–O9 pelo MESMO critério de Produto/Serviço: texto igual → herda; texto mudou → não herda
 *      (responder de novo); só ajuda mudou → herda, com aviso 'ajuda'; snapshot refeito na versão nova, observação
 *      mantida; nada vira NAO;
 *   2. diagnóstico: herda só com o MESMO par de papéis e texto, rótulo "mesma" e rótulo "distintas" iguais;
 *      qualquer um deles mudou → não herda; só ajuda/interpretação mudou → herda com aviso;
 *   3. limparForaDoCaminho depois da herança (resposta que saiu do caminho não fica);
 *   4. versão = anterior + 1, avaliacaoAnteriorId, motivo, revisão 1; auditoria "criacao" com anterior e motivo;
 *   5. falha fechada: sem window.faCriterioReavaliacao, a reavaliação não é montada;
 *   6. decisão: tipo (CONFIRMACAO / DIVERGENCIA / RESOLUCAO_A_VALIDAR), justificativa obrigatória fora da
 *      confirmação, só os 8 firmes, liberaSquad do motor, nome na decisão com contingência, resultado automático
 *      intocado; conclusão de reavaliação grava vigenteAnterior na auditoria. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RAIZ = path.join(__dirname, '..', '..', 'forca-agil');

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

function carregar(comCriterio) {
  const ctx = { console, JSON, Object, Array, String, Math, Number, Date, RegExp, Error, Promise, setTimeout, clearTimeout, setInterval, clearInterval, parseFloat, parseInt, isNaN };
  ctx.window = ctx;
  const el = () => ({ addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, style: {}, classList: { add() {}, remove() {}, contains() { return false; } } });
  ctx.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, addEventListener() {}, body: el(), documentElement: el() };
  ctx.firebase = { database: () => ({ ref: () => ({ on() {}, off() {}, once() { return Promise.resolve({ val: () => null }); }, update() {}, child() { return this; }, push() { return { key: 'k' }; } }) }) };
  ctx.navigator = {}; ctx.location = { hash: '' }; ctx.localStorage = { getItem() { return null; }, setItem() {} };
  vm.createContext(ctx);
  const arqs = ['questionarios-config.js', 'motor-arquitetura.js'].concat(comCriterio ? ['avaliacao-produto.js'] : []).concat(['motor-posicionamento.js']);
  arqs.forEach((f) => vm.runInContext(fs.readFileSync(path.join(RAIZ, f), 'utf8'), ctx, { filename: f }));
  delete ctx.document; /* o núcleo de posicionamento para antes da tela */
  vm.runInContext(fs.readFileSync(path.join(RAIZ, 'avaliacao-posicionamento.js'), 'utf8'), ctx, { filename: 'avaliacao-posicionamento.js' });
  ctx.faPosicionamentos = { nome: (c) => 'Nome de ' + c, usandoContingencia: (c) => c === 'COE' };
  return ctx;
}

/* versões do questionário: a 1 é a de fábrica; na 2 mudam o texto de O5, a ajuda de O2, o rótulo "mesma" do diagnóstico
   (cenário B) ou só a interpretação dele (cenário A) */
function instalarVersoes(ctx, cenario) {
  const Q = ctx.faQuestionarios, original = Q.conteudoPergunta.bind(Q);
  Q.conteudoPergunta = function (codigo, q, versao) {
    const c = JSON.parse(JSON.stringify(original(codigo, q, 1) || {}));
    if (codigo !== 'POSICIONAMENTO_ORGANIZACIONAL' || versao !== 2) return c;
    if (q === 'O5') c.texto = c.texto + ' (redação nova)';
    if (q === 'O2') c.textoAjuda = 'Ajuda reescrita na versão 2';
    if (q === 'DIAG_CONFLITO_RECORTE') { if (cenario === 'B') c.rotuloMesma = 'Rótulo novo'; else c.interpretacaoMesma = 'Interpretação nova'; }
    return c;
  };
}

const QUANDO = '2026-10-10T12:00:00.000Z', quem = { name: 'Arquiteta', email: 'arquitetura@previ.com.br' };
function anterior(N, respostas, diagnosticos) {
  const reg = { itemId: 'p1', itemNome: 'Item p1', avaliacaoArquiteturalId: 'p1', questionnaireContentVersion: 1, versao: 1, status: 'concluido', respostas: {} };
  Object.keys(respostas).forEach((q) => { reg.respostas[q] = N.snapshotResposta(q, respostas[q], 1, 'Obs ' + q, '2026-09-01T10:00:00.000Z'); });
  Object.keys(diagnosticos || {}).forEach((n) => { reg.diagnosticos = reg.diagnosticos || {}; reg.diagnosticos[n] = N.snapshotDiagnostico(diagnosticos[n], N.papeisDoPar(reg, n), 1, 'Nota ' + n, '2026-09-01T10:00:00.000Z'); });
  reg.resultadoAutomatico = N.resultadoGravavel(N.avaliar(reg));
  return reg;
}
const reavaliar = (N, ant, versao) => N.payloadReavaliacao({ id: 'v2', audId: 'kc2', anteriorId: 'v1', anterior: ant, itemNome: ant.itemNome, avaliacaoArquiteturalId: 'p1b',
  versao, motivo: 'Mudou a estrutura', usuario: quem, agora: QUANDO });

console.log('\n== 1–4. Herança das respostas (cenário A: só a interpretação do diagnóstico muda) ==');
{
  const ctx = carregar(true), N = ctx.faAvaliacaoPosicionamentoNucleo;
  instalarVersoes(ctx, 'A');
  /* Linha com O4 SIM e O5 SIM + N2 mesma = CONFLITO */
  const ant = anterior(N, { O1: 'SIM', O2: 'NAO', O3: 'NAO', O4: 'SIM', O5: 'SIM' }, { N2: 'mesma' });
  afirma(N.situacaoResposta(ant.respostas.O1, 'O1', 2) === null, 'O1 (nada mudou): situação null');
  afirma(N.situacaoResposta(ant.respostas.O2, 'O2', 2) === 'ajuda', 'O2 (só ajuda mudou): situação "ajuda"');
  afirma(N.situacaoResposta(ant.respostas.O5, 'O5', 2) === 'pergunta', 'O5 (texto mudou): situação "pergunta"');
  afirma(N.situacaoResposta(ant.respostas.O5, 'O5', 1) === null, 'mesma versão do questionário: situação null');
  const p = reavaliar(N, ant, 2), r = p['avaliacoes-posicionamento/v2'];
  afirma(r.respostas.O1 && r.respostas.O1.resposta === 'SIM' && r.respostas.O1.questionnaireContentVersion === 2, 'O1 herdada, com snapshot refeito na versão 2');
  afirma(r.respostas.O2 && r.respostas.O2.resposta === 'NAO' && r.respostas.O2.observacao === 'Obs O2', 'O2 herdada (com a observação)');
  afirma(!r.respostas.O5, 'O5 NÃO herdada (responder de novo) — e não virou NAO');
  afirma(!r.diagnosticos, 'diagnóstico N2 não herdado: sem O5 o nível não está completo');
  afirma(r.versao === 2 && r.avaliacaoAnteriorId === 'v1' && r.motivoReavaliacao === 'Mudou a estrutura' && r.revisao === 1 && r.status === 'rascunho' && r.questionnaireContentVersion === 2,
    'versão 2, anterior v1, motivo, revisão 1, rascunho, questionário 2');
  afirma(r.avaliacaoArquiteturalId === 'p1b', 'usa a Avaliação de Produto informada (a concluída mais recente do item)');
  afirma(p['posicionamento-rascunho-por-item/p1'] === 'v2', 'reserva do item');
  const a = p['posicionamento-auditoria/v2/kc2'];
  afirma(a && a.tipo === 'criacao' && a.avaliacaoAnteriorId === 'v1' && a.motivo === 'Mudou a estrutura', 'auditoria "criacao" com anterior e motivo');
  afirma(!p['posicionamento-vigente-por-item/p1'], 'iniciar a reavaliação não toca no vigente');

  /* diagnóstico herdado quando o par é o mesmo e só a interpretação mudou */
  const ant2 = anterior(N, { O1: 'SIM', O2: 'SIM', O3: 'NAO' }, { N1: 'distintas' });
  afirma(N.situacaoDiagnostico(ant2.diagnosticos.N1, ['LINHA', 'AREA_ESPECIALIZADA'], 2) === 'ajuda', 'diagnóstico: só interpretação mudou → "ajuda"');
  afirma(N.situacaoDiagnostico(ant2.diagnosticos.N1, ['LINHA', 'COE'], 2) === 'pergunta', 'diagnóstico: outro par de papéis → "pergunta"');
  const r2 = reavaliar(N, ant2, 2)['avaliacoes-posicionamento/v2'];
  afirma(r2.diagnosticos && r2.diagnosticos.N1 && r2.diagnosticos.N1.resposta === 'distintas' && r2.diagnosticos.N1.questionnaireContentVersion === 2 && r2.diagnosticos.N1.observacao === 'Nota N1',
    'diagnóstico N1 herdado (mesmo par), refeito na versão 2, com a nota');

  /* limparForaDoCaminho depois da herança: anterior com resposta que não está mais no caminho */
  const ant3 = anterior(N, { O1: 'NAO', O2: 'SIM', O3: 'NAO' });
  ant3.respostas.O4 = N.snapshotResposta('O4', 'SIM', 1, 'fora', QUANDO); /* lixo fora do caminho */
  const r3 = reavaliar(N, ant3, 1)['avaliacoes-posicionamento/v2'];
  afirma(!r3.respostas.O4 && JSON.stringify(Object.keys(r3.respostas).sort()) === '["O1","O2","O3"]', 'resposta fora do caminho não é herdada');

  console.log('\n== 6. Decisão ==');
  const conc = anterior(N, { O1: 'NAO', O2: 'SIM', O3: 'NAO' });
  const resAntes = JSON.stringify(conc.resultadoAutomatico);
  afirma(N.tipoDecisao('AREA_ESPECIALIZADA', 'AREA_ESPECIALIZADA') === 'CONFIRMACAO' && N.tipoDecisao('AREA_ESPECIALIZADA', 'COE') === 'DIVERGENCIA' &&
    N.tipoDecisao('A_VALIDAR', 'COE') === 'RESOLUCAO_A_VALIDAR', 'tipos: mesmo código = CONFIRMACAO, outro = DIVERGENCIA, A_VALIDAR = RESOLUCAO_A_VALIDAR');
  const dec = (cod, just) => N.payloadDecisao({ id: 'v1', reg: conc, codigoFinal: cod, justificativa: just, usuario: quem, agora: QUANDO, audId: 'kd' });
  const d1 = dec('AREA_ESPECIALIZADA')['posicionamento-decisoes/v1'];
  afirma(d1.tipoDecisao === 'CONFIRMACAO' && !d1.justificativa && d1.liberaSquad === false && d1.codigoAutomatico === 'AREA_ESPECIALIZADA' && d1.versaoAvaliacao === 1 && d1.versaoMotor === 1,
    'CONFIRMACAO sem justificativa monta', JSON.stringify(d1));
  afirma(!('tipoAValidarAutomatico' in d1), 'resultado firme: sem tipoAValidarAutomatico');
  const confEspaco = dec('AREA_ESPECIALIZADA', '   ')['posicionamento-decisoes/v1'];
  afirma(!('justificativa' in confEspaco), 'CONFIRMACAO com justificativa só de espaço: não grava justificativa');
  let recusou = false; try { dec('COE', ' \t\n'); } catch (e) { recusou = /justificativa/.test(e.message); }
  afirma(recusou, 'DIVERGENCIA com justificativa só de espaço: recusada');
  const d2 = dec('NEGOCIOS', 'Porque sim')['posicionamento-decisoes/v1'];
  afirma(d2.tipoDecisao === 'DIVERGENCIA' && d2.liberaSquad === true && d2.justificativa === 'Porque sim', 'DIVERGENCIA para NEGOCIOS: liberaSquad true (do motor)');
  const d3 = dec('COE', 'x')['posicionamento-decisoes/v1'];
  afirma(d3.nomeNaDecisao.nome === 'Nome de COE' && d3.nomeNaDecisao.contingencia === true, 'nome na decisão com a contingência da hora');
  afirma(['LINHA', 'PLATAFORMA', 'A_VALIDAR', 'SQUAD', ''].every((c) => { try { dec(c, 'j'); return false; } catch (e) { return true; } }), 'LINHA, PLATAFORMA, A_VALIDAR, desconhecido e vazio: recusados');
  afirma(ctx.faMotorPosicionamento.CODIGOS_FIRMES.every((c) => dec(c, 'j')['posicionamento-decisoes/v1'].liberaSquad === ctx.faMotorPosicionamento.liberaSquadParaCodigoFirme(c)), 'os 8 firmes: liberaSquad = liberaSquadParaCodigoFirme');
  const audD = dec('COE', 'x')['posicionamento-auditoria/v1/kd'];
  afirma(audD.tipo === 'decisao' && audD.codigoFinal === 'COE' && audD.tipoDecisao === 'DIVERGENCIA' && audD.versaoAvaliacao === 1, 'auditoria "decisao"');
  afirma(audD.justificativa === 'x' && audD.liberaSquad === false, 'auditoria autocontida: justificativa e liberaSquad');
  const audC = dec('AREA_ESPECIALIZADA')['posicionamento-auditoria/v1/kd'];
  afirma(!('justificativa' in audC) && audC.liberaSquad === false, 'CONFIRMACAO sem justificativa: auditoria sem justificativa, com liberaSquad');
  afirma(JSON.stringify(conc.resultadoAutomatico) === resAntes && !Object.keys(dec('COE', 'x')).some((k) => k.indexOf('avaliacoes-posicionamento') === 0), 'o resultado automático não é tocado (a decisão é outro nó)');
  const av = anterior(N, { O1: 'NAO', O2: 'SIM', O3: 'SIM' }, { N1: 'mesma' });
  const dAv = N.payloadDecisao({ id: 'v1', reg: av, codigoFinal: 'COE', justificativa: 'Reunião', usuario: quem, agora: QUANDO, audId: 'kd' })['posicionamento-decisoes/v1'];
  afirma(dAv.tipoDecisao === 'RESOLUCAO_A_VALIDAR' && dAv.codigoAutomatico === 'A_VALIDAR' && dAv.tipoAValidarAutomatico === 'CONFLITO', 'RESOLUCAO_A_VALIDAR registra o tipo do A_VALIDAR');

  /* conclusão de reavaliação: auditoria com vigenteAnterior; primeira versão: sem */
  const v2 = Object.assign(JSON.parse(JSON.stringify(r3)), { revisao: 1 });
  const pz = N.payloadConclusao('v2', v2, quem, QUANDO, 1, 'kz').payload;
  afirma(pz['posicionamento-auditoria/v2/kz'].vigenteAnterior === 'v1' && pz['posicionamento-vigente-por-item/p1'] === 'v2', 'conclusão da reavaliação: vigente → v2, auditoria com vigenteAnterior v1');
  const pz1 = N.payloadConclusao('v1', Object.assign({}, conc, { status: 'rascunho', revisao: 1 }), quem, QUANDO, 1, 'kz').payload;
  afirma(!('vigenteAnterior' in pz1['posicionamento-auditoria/v1/kz']), 'conclusão da primeira versão: sem vigenteAnterior');
}

console.log('\n== 2. Diagnóstico: rótulo "mesma" mudou (cenário B) ==');
{
  const ctx = carregar(true), N = ctx.faAvaliacaoPosicionamentoNucleo;
  instalarVersoes(ctx, 'B');
  const ant = anterior(N, { O1: 'SIM', O2: 'SIM', O3: 'NAO' }, { N1: 'distintas' });
  afirma(N.situacaoDiagnostico(ant.diagnosticos.N1, ['LINHA', 'AREA_ESPECIALIZADA'], 2) === 'pergunta', 'rótulo "mesma" mudou → "pergunta" (mesmo tendo respondido "distintas")');
  const r = reavaliar(N, ant, 2)['avaliacoes-posicionamento/v2'];
  afirma(!r.diagnosticos && r.respostas.O1 && r.respostas.O2 && r.respostas.O3, 'diagnóstico não herdado; O1–O3 herdadas');
}

console.log('\n== 5. Falha fechada sem o critério ==');
{
  const ctx = carregar(false), N = ctx.faAvaliacaoPosicionamentoNucleo;
  afirma(!ctx.faCriterioReavaliacao, 'sem avaliacao-produto.js, não há faCriterioReavaliacao');
  const ant = anterior(N, { O1: 'NAO', O2: 'SIM', O3: 'NAO' });
  let erro = null; try { reavaliar(N, ant, 1); } catch (e) { erro = e.message; }
  afirma(erro === 'criterio-indisponivel', 'payloadReavaliacao recusa montar (nunca herda sem critério)', erro);
}

console.log('\n============================\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
process.exit(falhas ? 1 : 0);
