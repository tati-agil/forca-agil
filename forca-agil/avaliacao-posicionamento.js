/* ============================================================
   Força Ágil — Avaliação de POSICIONAMENTO ORGANIZACIONAL O1–O9 (window.faAvaliacaoPosicionamento) — PR E

   O que a tela faz: para um item que já tem Avaliação de Produto/Serviço concluída (qualquer classificação),
   responde O1–O9 e mostra o POSICIONAMENTO ORGANIZACIONAL RECOMENDADO — que tipo de estrutura deve sustentar,
   de forma permanente, a responsabilidade associada ao objeto. O objeto não "vira" Linha, Área ou CoE; nenhuma
   estrutura concreta é escolhida aqui (associação à estrutura concreta é etapa posterior); liberaSquad = true só
   quer dizer que a Adequação à Squad (S1–S8) pode ser realizada — não cria nem associa Squad.

   Fontes (contratos fechados, só lidos): faMotorPosicionamento (caminho e resultado — único autor do resultado),
   faQuestionarios (texto de O1–O9 e do diagnóstico, na versão fixada ao iniciar), faPosicionamentos (nome e
   definição atuais na Taxonomia Organizacional; o "nome registrado na conclusão" é feito AQUI).

   Endereços (dentro de #avaliacoes, como ?sq= da Squad):
     #avaliacoes?po=lista                 lista
     #avaliacoes?po=escolher[&item=<id>]  escolher o item (e o item escolhido)
     #avaliacoes?po=<avaliacaoId>         checklist (rascunho), resultado (concluída) ou descartada
   F5 e link direto reabrem a mesma tela; Voltar/Avançar andam entre elas.

   Banco (regras em database.rules.json; prova em teste-rules-posicionamento.js):
     avaliacoes-posicionamento/<id>              a avaliação (rascunho → concluido | descartado; os dois são finais)
     posicionamento-rascunho-por-item/<itemId>   = <id> enquanto há rascunho aberto do item (um só)
     posicionamento-vigente-por-item/<itemId>    = <id> do Posicionamento concluído do item (um só; PR F substitui)
     posicionamento-auditoria/<id>/<push>        criacao | conclusao | descarte (só acréscimo)
   Cada transição é UMA gravação multipath (ou entra tudo, ou nada). revisao: cada gravação = anterior + 1 — uma
   gravação feita sobre versão antiga é recusada, e a tela avisa e recarrega (nunca sobrescreve).

   Escrita (iniciar, salvar, concluir, descartar): só "Avaliação + Arquitetura" e admin geral
   (faAuth.podeArquitetura) — o perfil "Avaliação" só consulta. Leitura: os três.

   Caminho: só as perguntas que faMotorPosicionamento.perguntasDoCaminho() devolve aparecem; o diagnóstico
   DIAG_CONFLITO_RECORTE só no nível alcançado, completo e com exatamente 2 SIM. Mudar uma resposta que fecha um
   ramo descarta (com aviso e confirmação) as respostas, observações e diagnósticos que saíram do caminho — nada
   vira NAO. Concluir só com tudo o que o caminho exige respondido (falta de resposta ou diagnóstico pendente não
   conclui como "A validar").
   ============================================================ */
(function () {
  'use strict';
  var NODE = 'avaliacoes-posicionamento', RES = 'posicionamento-rascunho-por-item', VIG = 'posicionamento-vigente-por-item';
  var AUD = 'posicionamento-auditoria', PROD = 'avaliacoes-produto';
  var QCOD = 'POSICIONAMENTO_ORGANIZACIONAL', DIAG = 'DIAG_CONFLITO_RECORTE';
  var MAX_OBS = 2000, MAX_MOTIVO = 500, TEMPO_GRAVACAO = 12000;
  var NIVEIS = { N1: ['O1', 'O2', 'O3'], N2: ['O4', 'O5'], N3: ['O6', 'O7', 'O8', 'O9'] };
  var ORDEM_NIVEIS = ['N1', 'N2', 'N3'];
  var TITULO_NIVEL = { N1: 'Nível 1 — tipo de responsabilidade', N2: 'Nível 2 — Linha confirmada', N3: 'Nível 3 — ramo Plataforma' };
  var TIPO_TEXTO = { INCOERENCIA: 'incoerência nas respostas', CONFLITO: 'conflito de posicionamento', RECORTE: 'recorte do objeto', EVIDENCIA_INSUFICIENTE: 'evidência insuficiente' };
  var PAPEL = { O1: 'LINHA', O2: 'AREA_ESPECIALIZADA', O3: 'COE', O4: 'ESTRATEGIA_CLIENTES', O5: 'NEGOCIOS',
    O6: 'PLATAFORMA_CANAIS', O7: 'PLATAFORMA_HABILITADORA_NEGOCIOS', O8: 'PLATAFORMA_HABILITADORA_TECNOLOGIA', O9: 'PLATAFORMA_CORPORATIVA' };

  /* ===================== NÚCLEO (sem DOM: o mesmo código monta as gravações na tela e nos testes) ===================== */
  function motor() { return window.faMotorPosicionamento; }
  function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function simples(reg) {
    var r = {}, d = {};
    Object.keys((reg && reg.respostas) || {}).forEach(function (q) { var v = reg.respostas[q] && reg.respostas[q].resposta; if (v === 'SIM' || v === 'NAO') r[q] = v; });
    Object.keys((reg && reg.diagnosticos) || {}).forEach(function (n) { var v = reg.diagnosticos[n] && reg.diagnosticos[n].resposta; if (v === 'mesma' || v === 'distintas') d[n] = v; });
    return { respostas: r, diagnosticos: d };
  }
  function avaliar(reg) { var s = simples(reg); return motor().avaliar(s.respostas, s.diagnosticos); }
  function caminho(reg) { var s = simples(reg); return motor().perguntasDoCaminho(s.respostas, s.diagnosticos); }
  function simsDoNivel(reg, n) { var s = simples(reg).respostas; return NIVEIS[n].filter(function (q) { return s[q] === 'SIM'; }); }
  /* o diagnóstico do nível n faz parte da avaliação: nível alcançado, completo e com exatamente 2 SIM */
  function diagnosticoNecessario(reg, n) {
    var s = simples(reg).respostas, r = avaliar(reg);
    if (r.niveisAlcancados.indexOf(n) === -1) return false;
    if (NIVEIS[n].some(function (q) { return !s[q]; })) return false;
    return simsDoNivel(reg, n).length === 2;
  }
  function papeisDoPar(reg, n) { return simsDoNivel(reg, n).map(function (q) { return PAPEL[q]; }); }
  /* Tira da avaliação tudo o que não está no caminho: respostas (com as observações delas) e diagnósticos
     que deixaram de ser exigidos ou cujo par de papéis mudou. Devolve o que saiu, para o aviso. */
  function limparForaDoCaminho(reg) {
    var novo = clone(reg) || {}, removidas = [], obsRemovidas = [], diagsRemovidos = [];
    for (var volta = 0; volta < 4; volta++) {
      var mudou = false, cam = caminho(novo);
      Object.keys(novo.respostas || {}).forEach(function (q) {
        if (cam.indexOf(q) !== -1) return;
        removidas.push(q);
        if (novo.respostas[q] && novo.respostas[q].observacao) obsRemovidas.push(q);
        delete novo.respostas[q]; mudou = true;
      });
      Object.keys(novo.diagnosticos || {}).forEach(function (n) {
        var d = novo.diagnosticos[n];
        if (diagnosticoNecessario(novo, n) && JSON.stringify(d.papeis || []) === JSON.stringify(papeisDoPar(novo, n))) return;
        diagsRemovidos.push(n);
        if (d && d.observacao) obsRemovidas.push(n);
        delete novo.diagnosticos[n]; mudou = true;
      });
      if (!mudou) break;
    }
    if (novo.respostas && !Object.keys(novo.respostas).length) delete novo.respostas;
    if (novo.diagnosticos && !Object.keys(novo.diagnosticos).length) delete novo.diagnosticos;
    return { reg: novo, removidas: removidas, obsRemovidas: obsRemovidas, diagsRemovidos: diagsRemovidos };
  }
  /* O que ainda falta para concluir (null = completo). Nunca conclui incompleto: o motor representa a falta
     como A_VALIDAR/EVIDENCIA_INSUFICIENTE, mas isso não é um resultado da avaliação. */
  function falta(reg) {
    var r = avaliar(reg), s = simples(reg).respostas;
    if (/_RESPOSTA_FALTANDO$/.test(r.regra)) {
      var faltam = caminho(reg).filter(function (q) { return !s[q]; });
      return { texto: 'Falta responder: ' + faltam.join(', '), perguntas: faltam };
    }
    if (/_DIAGNOSTICO_PENDENTE$/.test(r.regra)) {
      var n = r.regra.slice(0, 2);
      return { texto: 'Falta responder o diagnóstico do Nível ' + n.slice(1), diagnostico: n };
    }
    if (r.regra === 'DEF_SIM_FORA_DO_CAMINHO') return { texto: 'Há resposta fora do caminho: revise as respostas' };
    return null;
  }
  function textoLimitado(s, n) { return typeof s === 'string' && s ? s.slice(0, n) : null; }
  function semVazios(o) { Object.keys(o).forEach(function (k) { if (o[k] === null || o[k] === undefined || o[k] === '') delete o[k]; }); return o; }
  function conteudo(q, versao) { return window.faQuestionarios.conteudoPergunta(QCOD, q, versao) || {}; }
  function snapshotResposta(q, v, versao, observacao, agora) {
    var c = conteudo(q, versao);
    return semVazios({ resposta: v, codigoPergunta: q, tituloNaEpoca: textoLimitado(c.titulo, 400), textoPerguntaNaEpoca: textoLimitado(c.texto, 4000),
      interpretacaoNaEpoca: textoLimitado(v === 'SIM' ? c.justSim : c.justNao, 4000), observacao: textoLimitado(observacao, MAX_OBS),
      questionnaireContentVersion: versao, dataResposta: agora });
  }
  function snapshotDiagnostico(v, papeis, versao, observacao, agora) {
    var c = conteudo(DIAG, versao);
    return semVazios({ resposta: v, papeis: papeis.slice(), tituloNaEpoca: textoLimitado(c.titulo, 400), textoPerguntaNaEpoca: textoLimitado(c.texto, 4000),
      rotuloNaEpoca: textoLimitado(v === 'mesma' ? c.rotuloMesma : c.rotuloDistintas, 400),
      interpretacaoNaEpoca: textoLimitado(v === 'mesma' ? c.interpretacaoMesma : c.interpretacaoDistintas, 4000),
      observacao: textoLimitado(observacao, MAX_OBS), questionnaireContentVersion: versao, dataResposta: agora });
  }
  /* O resultado do motor como o banco guarda (o Firebase não guarda null nem lista vazia). */
  function resultadoGravavel(res) {
    var out = {};
    Object.keys(res).forEach(function (k) {
      var v = res[k];
      if (v === null || v === undefined || (Array.isArray(v) && !v.length)) return;
      out[k] = Array.isArray(v) ? v.slice() : v;
    });
    return out;
  }
  function resultadoLido(ra) {
    ra = ra || {};
    return { codigoResultado: ra.codigoResultado || null, tipoAValidar: ra.tipoAValidar || null, motivo: ra.motivo || null, nivelConfirmado: ra.nivelConfirmado || null,
      papeisDetectados: ra.papeisDetectados || [], regra: ra.regra || null, versaoMotor: ra.versaoMotor || null, liberaSquad: ra.liberaSquad === true,
      niveisAlcancados: ra.niveisAlcancados || [], perguntasForaDoCaminho: ra.perguntasForaDoCaminho || [] };
  }
  /* Nome de cada código do resultado NO MOMENTO da conclusão (snapshot; nunca reescrito). */
  function nomesNaConclusao(res) {
    var P = window.faPosicionamentos, out = {};
    [res.codigoResultado, res.nivelConfirmado].concat(res.papeisDetectados || []).forEach(function (k) {
      if (!k || k === 'A_VALIDAR' || out[k]) return;
      out[k] = { nome: String((P && P.nome(k)) || k).slice(0, 120), contingencia: !!(P && P.usandoContingencia(k)) };
    });
    return out;
  }
  /* ---- gravações (multipath) ---- */
  function payloadCriacao(o) {
    var reg = { itemId: o.itemId, itemNome: String(o.itemNome || o.itemId).slice(0, 200), avaliacaoArquiteturalId: o.avaliacaoArquiteturalId, questionarioCodigo: QCOD,
      questionnaireContentVersion: o.versao, versao: 1, status: 'rascunho', revisao: 1, criadoPor: o.usuario, criadoEm: o.agora, atualizadoPor: o.usuario, atualizadoEm: o.agora,
      auditoriaCriacaoId: o.audId };
    var p = {};
    p[NODE + '/' + o.id] = reg;
    p[RES + '/' + o.itemId] = o.id;
    p[AUD + '/' + o.id + '/' + o.audId] = { tipo: 'criacao', itemId: o.itemId, avaliacaoArquiteturalId: o.avaliacaoArquiteturalId, usuario: o.usuario, dataHora: o.agora };
    return p;
  }
  function registroParaGravar(reg, usuario, agora, revisaoBase) {
    var r = clone(reg);
    delete r._key;
    r.revisao = revisaoBase + 1; r.atualizadoPor = usuario; r.atualizadoEm = agora;
    if (r.respostas && !Object.keys(r.respostas).length) delete r.respostas;
    if (r.diagnosticos && !Object.keys(r.diagnosticos).length) delete r.diagnosticos;
    return r;
  }
  function payloadSalvar(id, reg, usuario, agora, revisaoBase) {
    var p = {};
    p[NODE + '/' + id] = registroParaGravar(reg, usuario, agora, revisaoBase);
    return p;
  }
  function payloadConclusao(id, reg, usuario, agora, revisaoBase, audId) {
    var r = registroParaGravar(reg, usuario, agora, revisaoBase), res = avaliar(r);
    r.status = 'concluido'; r.resultadoAutomatico = resultadoGravavel(res);
    var nomes = nomesNaConclusao(res);
    if (Object.keys(nomes).length) r.nomesNaConclusao = nomes;
    r.concluidoPor = usuario; r.concluidoEm = agora; r.auditoriaConclusaoId = audId;
    var p = {};
    p[NODE + '/' + id] = r;
    p[RES + '/' + r.itemId] = null;
    p[VIG + '/' + r.itemId] = id;
    p[AUD + '/' + id + '/' + audId] = { tipo: 'conclusao', itemId: r.itemId, codigoResultado: res.codigoResultado, regra: res.regra, versaoMotor: res.versaoMotor,
      liberaSquad: res.liberaSquad, usuario: usuario, dataHora: agora };
    return { payload: p, resultado: res };
  }
  function payloadDescarte(id, reg, usuario, agora, revisaoBase, audId, motivo) {
    var r = registroParaGravar(reg, usuario, agora, revisaoBase);
    r.status = 'descartado'; r.motivoDescarte = motivo; r.descartadoPor = usuario; r.descartadoEm = agora; r.auditoriaDescarteId = audId;
    var p = {};
    p[NODE + '/' + id] = r;
    p[RES + '/' + r.itemId] = null;
    p[AUD + '/' + id + '/' + audId] = { tipo: 'descarte', itemId: r.itemId, motivo: motivo, usuario: usuario, dataHora: agora };
    return p;
  }
  window.faAvaliacaoPosicionamentoNucleo = {
    simples: simples, avaliar: avaliar, caminho: caminho, diagnosticoNecessario: diagnosticoNecessario, papeisDoPar: papeisDoPar,
    limparForaDoCaminho: limparForaDoCaminho, falta: falta, snapshotResposta: snapshotResposta, snapshotDiagnostico: snapshotDiagnostico,
    resultadoGravavel: resultadoGravavel, nomesNaConclusao: nomesNaConclusao,
    payloadCriacao: payloadCriacao, payloadSalvar: payloadSalvar, payloadConclusao: payloadConclusao, payloadDescarte: payloadDescarte,
    MAX_OBS: MAX_OBS, MAX_MOTIVO: MAX_MOTIVO
  };
  if (typeof document === 'undefined') return;

  /* ===================== TELA ===================== */
  function db() { return firebase.database(); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function agoraIso() { return new Date().toISOString(); }
  function fmtData(iso) { if (!iso) return '—'; var d = new Date(iso); return isNaN(d) ? iso : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); }
  function sessaoAtual() {
    var s = window.faAuth && window.faAuth.getSession && window.faAuth.getSession();
    if (!s || !s.email) return null;
    return { name: String(s.name || s.email).slice(0, 200), email: s.email };
  }
  function podeLer() { return !!(window.faAuth && window.faAuth.podeAvaliacao && window.faAuth.podeAvaliacao()); }
  function podeEscrever() { return !!(window.faAuth && window.faAuth.podeArquitetura && window.faAuth.podeArquitetura()); }
  function P() { return window.faPosicionamentos; }
  function nomeAtual(c) { return P() ? P().nome(c) : c; }
  function spanNome(c) { return P() ? P().spanNome(c, 'po-nome') : esc(c); }

  /* ---- modal próprio (aviso/confirmação) ---- */
  function modal(html, opcoes) {
    opcoes = opcoes || {};
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay po-modal-overlay';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9999';
    var box = document.createElement('div');
    box.className = 'modal-box po-modal';
    box.style.cssText = 'max-width:460px;width:92%;padding:24px;display:flex;flex-direction:column;gap:14px;max-height:90vh;overflow:auto';
    box.innerHTML = html + '<p class="avp-error-msg po-modal-erro" hidden></p><div class="po-modal-acoes">' +
      (opcoes.nao === false ? '' : '<button type="button" class="btn po-modal-nao">' + esc(opcoes.nao || 'Cancelar') + '</button>') +
      '<button type="button" class="btn btn--primary po-modal-sim">' + esc(opcoes.sim || 'OK') + '</button></div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function fechar() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
    var nao = box.querySelector('.po-modal-nao');
    if (nao) nao.addEventListener('click', function () { fechar(); if (opcoes.aoNao) opcoes.aoNao(); });
    box.querySelector('.po-modal-sim').addEventListener('click', function () {
      var erro = opcoes.aoSim ? opcoes.aoSim(box) : null;
      if (erro) { var e = box.querySelector('.po-modal-erro'); e.textContent = erro; e.hidden = false; return; }
      fechar();
    });
    return { fechar: fechar, box: box };
  }
  function aviso(msg) { modal('<p>' + esc(msg) + '</p>', { nao: false, sim: 'OK' }); }

  function montar() {
    var wrap = document.getElementById('avaliacoesPosicionamento');
    if (!wrap || wrap._poBound) return null;
    wrap._poBound = true;
    function byId(id) { return wrap.querySelector('#' + id); }
    function vizinho() { return document.getElementById('avaliacoesPainel'); }

    function novoEstado() { return {
      tela: 'lista', /* lista | escolher | checklist | resultado | descartado | carregando | nao-encontrada | sem-permissao */
      registros: {}, reservas: {}, vigentes: {}, produtos: {},
      carregou: { av: false, res: false, vig: false, prod: false }, erroLeitura: false,
      atual: null, chave: null, revisaoBase: 0, sujo: false, conflito: false, salvando: null, revisaoEmGravacao: null,
      itemEscolhido: null, busca: '', pendente: null, flash: null
    }; }
    var state = novoEstado();

    /* ---- painel e identidade da página ---- */
    var identidadeOriginal = null;
    function hero() { var s = wrap.closest('.page-section'); return s && s.querySelector('.page-hero'); }
    function trocarIdentidade(meu) {
      var h = hero();
      if (!h) return;
      var eyebrow = h.querySelector('.eyebrow'), h1 = h.querySelector('h1'), p = h.querySelector('p');
      if (meu && !identidadeOriginal) identidadeOriginal = { eyebrow: eyebrow ? eyebrow.textContent : '', h1: h1 ? h1.textContent : '', p: p ? p.textContent : '' };
      if (!meu && !identidadeOriginal) return;
      var t = meu ? { eyebrow: 'Posicionamento', h1: 'Posicionamento Organizacional',
        p: 'Posicionamento organizacional recomendado (O1–O9): que tipo de estrutura deve sustentar a responsabilidade associada a cada item.' } : identidadeOriginal;
      if (eyebrow) eyebrow.textContent = t.eyebrow;
      if (h1) h1.textContent = t.h1;
      if (p) p.textContent = t.p;
      h.classList.toggle('page-hero--posicionamento', !!meu);
    }
    function aberto() { return !wrap.hidden; }
    function mostrarPainel() {
      var v = vizinho(); if (v) v.hidden = true;
      var sq = document.getElementById('avaliacoesSquad'); if (sq) sq.hidden = true;
      wrap.hidden = false;
      trocarIdentidade(true);
    }
    /* Outros ouvintes do mesmo evento (a Squad fecha a si mesma e devolve a lista) podem rodar depois deste:
       reafirma o painel no fim da fila, enquanto o endereço for do Posicionamento. */
    function reafirmar() { setTimeout(function () { if (poDoEndereco().po && !wrap.hidden) mostrarPainel(); }, 0); }
    function fecharPainel() {
      if (wrap.hidden) return;
      wrap.hidden = true;
      var v = vizinho(); if (v) v.hidden = false;
      trocarIdentidade(false);
    }

    /* ---- endereço ---- */
    function poDoEndereco() {
      var h = location.hash || '';
      if (h.split('?')[0] !== '#avaliacoes') return {};
      var m = /[?&]po=([^&]*)/.exec(h), i = /[?&]item=([^&]*)/.exec(h);
      return { po: m ? decodeURIComponent(m[1]) : null, item: i ? decodeURIComponent(i[1]) : null };
    }
    function enderecoDesejado() {
      if (wrap.hidden || state.tela === 'nao-encontrada') return null;
      if (state.tela === 'lista') return '#avaliacoes?po=lista';
      if (state.tela === 'escolher' || state.tela === 'sem-permissao') return '#avaliacoes?po=escolher' + (state.itemEscolhido ? '&item=' + encodeURIComponent(state.itemEscolhido) : '');
      if (state.tela === 'carregando') return state.pendente ? '#avaliacoes?po=' + encodeURIComponent(state.pendente) : null;
      if (state.chave) return '#avaliacoes?po=' + encodeURIComponent(state.chave);
      return null;
    }
    var aplicando = false;
    function sincronizarEndereco() {
      if (aplicando) return;
      var desejado = enderecoDesejado();
      if (!desejado || location.hash === desejado) return;
      if ((location.hash || '').split('?')[0] !== '#avaliacoes') return;
      var st = history.state;
      if (st && st.poAnterior === desejado) { history.back(); return; }
      /* avp:1 — a entrada é reconhecida por avaliacao-produto.js (que não a reescreve) */
      history.pushState({ avp: 1, seq: Date.now(), origem: null, poAnterior: location.hash || '#avaliacoes' }, '', desejado);
    }
    function sairParaAvaliacoes() {
      if (!confirmarSaida()) return;
      var st = history.state;
      if (st && st.poAnterior && st.poAnterior.split('?')[0] === '#avaliacoes' && !/[?&](po|sq)=/.test(st.poAnterior)) { history.back(); return; }
      history.replaceState({ avp: 1, seq: Date.now(), origem: null }, '', '#avaliacoes');
      fecharPainel();
    }
    function confirmarSaida() {
      if (!(state.tela === 'checklist' && state.sujo)) return true;
      return window.confirm('Há respostas não salvas neste rascunho. Sair sem salvar?');
    }
    function aplicarEndereco(po, item) {
      if (!po) return;
      aplicando = true;
      try {
        mostrarPainel();
        if (po === 'lista') { limparAtual(); state.tela = 'lista'; }
        else if (po === 'escolher') { limparAtual(); state.itemEscolhido = item || null; state.tela = podeEscrever() ? 'escolher' : (autorizacaoResolvida() ? 'sem-permissao' : 'carregando'); }
        else if (state.chave === po && ['checklist', 'resultado', 'descartado'].indexOf(state.tela) !== -1) { /* já é esta */ }
        else if (!state.carregou.av) { limparAtual(); state.pendente = po; state.tela = 'carregando'; }
        else { state.pendente = null; abrirChave(po); }
        render();
      } finally { aplicando = false; }
      reafirmar();
    }
    function autorizacaoResolvida() { return !!(window.faAuth && (!window.faAuth.isAvaliacaoReady || window.faAuth.isAvaliacaoReady())); }
    function limparAtual() { state.atual = null; state.chave = null; state.sujo = false; state.conflito = false; state.flash = null; }
    function abrirChave(key) {
      var rec = state.registros[key];
      limparAtual();
      if (!rec) { state.tela = 'nao-encontrada'; state.pendente = key; return; }
      state.chave = key;
      state.atual = clone(rec);
      state.revisaoBase = rec.revisao || 0;
      state.tela = rec.status === 'concluido' ? 'resultado' : rec.status === 'descartado' ? 'descartado' : 'checklist';
    }
    function irParaChave(key) { state.pendente = null; abrirChave(key); render(); }

    /* ---- itens que podem ser avaliados: Produto/Serviço concluída e não excluída, a versão mais nova ---- */
    function itensAvaliaveis() {
      var por = {};
      Object.keys(state.produtos).forEach(function (k) {
        var it = state.produtos[k];
        if (!it || it.status !== 'concluido' || it.excluido === true) return;
        var id = it.itemId || k;
        var atual = por[id];
        if (!atual || (it.versao || 1) > (atual.versao || 1)) por[id] = { itemId: id, nome: it.nome || id, avaliacaoArquiteturalId: k, versao: it.versao || 1, camada: it.camadaSugerida || null };
      });
      return Object.keys(por).map(function (id) { return por[id]; }).sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome), 'pt-BR'); });
    }
    function tudoCarregado() { return state.carregou.av && state.carregou.res && state.carregou.vig && state.carregou.prod; }

    /* ===================== RENDER ===================== */
    function render() {
      if (wrap.hidden) return;
      var h = '';
      if (state.tela === 'lista') h = renderLista();
      else if (state.tela === 'escolher') h = renderEscolher();
      else if (state.tela === 'sem-permissao') h = '<div id="poSemPermissao" class="avp-form-card"><p>Iniciar uma avaliação de Posicionamento Organizacional é do perfil <strong>Avaliação + Arquitetura</strong> (e da administração geral). Com o seu acesso, você consulta as avaliações já feitas.</p></div>' + rodapeVoltar();
      else if (state.tela === 'checklist') h = renderChecklist();
      else if (state.tela === 'resultado') h = renderResultado();
      else if (state.tela === 'descartado') h = renderDescartado();
      else if (state.tela === 'carregando') h = '<p class="loading-msg">Carregando…</p>';
      else if (state.tela === 'nao-encontrada') h = '<p class="admin-empty" id="poNaoEncontrada">Avaliação de posicionamento não encontrada.</p>' + rodapeVoltar();
      wrap.innerHTML = '<button type="button" class="avp-voltar-link" id="poVoltar">← Voltar para Avaliações</button>' + h;
      bind();
      if (P()) P().atualizarDom(wrap);
      sincronizarEndereco();
    }
    function rodapeVoltar() { return '<div class="avp-actions-footer"><button type="button" class="btn btn--sm" id="poVoltarLista">← Voltar para a lista de posicionamentos</button></div>'; }
    function badge(status) {
      var t = { rascunho: 'Rascunho', concluido: 'Concluída', descartado: 'Descartada' }[status] || status;
      return '<span class="avp-badge po-badge po-badge--' + esc(status) + '">' + esc(t) + '</span>';
    }
    function rotuloResultado(ra) {
      if (!ra || !ra.codigoResultado) return '—';
      if (ra.codigoResultado === 'A_VALIDAR') return 'A validar — ' + esc(TIPO_TEXTO[ra.tipoAValidar] || ra.tipoAValidar || '');
      return spanNome(ra.codigoResultado);
    }

    function renderLista() {
      var h = '<div class="avp-form-card" id="poLista"><h3>Posicionamento Organizacional</h3>' +
        '<p class="avp-intro">Recomenda que tipo de estrutura organizacional deve sustentar a responsabilidade associada a cada item (O1–O9). Não escolhe uma estrutura concreta.</p>';
      if (state.flash) h += '<p class="avp-flash-success" id="poFlash">' + esc(state.flash) + '</p>';
      if (podeEscrever()) h += '<div class="avp-actions-bar"><button type="button" class="btn btn--primary" id="poNovoBtn">+ Avaliar posicionamento de um item</button></div>';
      if (!state.carregou.av) h += '<p class="loading-msg">Carregando…</p>';
      else if (state.erroLeitura) h += '<p class="avp-error-msg">Não foi possível ler as avaliações agora.</p>';
      else {
        var lista = Object.keys(state.registros).map(function (k) { return Object.assign({ _key: k }, state.registros[k]); })
          .sort(function (a, b) { return String(b.atualizadoEm || '') < String(a.atualizadoEm || '') ? -1 : 1; });
        if (!lista.length) h += '<p class="admin-empty">Nenhuma avaliação de posicionamento ainda.</p>';
        else {
          h += '<div class="table-scroll-wrap"><table class="admin-table po-tabela"><thead><tr><th>Item</th><th>Situação</th><th>Posicionamento recomendado</th><th>Atualizado em</th><th></th></tr></thead><tbody>';
          lista.forEach(function (r) {
            var acao = r.status === 'rascunho' && podeEscrever() ? 'Continuar' : 'Abrir';
            h += '<tr class="po-linha" data-key="' + esc(r._key) + '"><td data-label="Item">' + esc(r.itemNome) + '</td><td data-label="Situação">' + badge(r.status) + '</td>' +
              '<td data-label="Posicionamento recomendado">' + (r.status === 'concluido' ? rotuloResultado(r.resultadoAutomatico) : '—') + '</td>' +
              '<td data-label="Atualizado em">' + esc(fmtData(r.atualizadoEm)) + '</td>' +
              '<td><button type="button" class="btn btn--sm po-abrir" data-key="' + esc(r._key) + '">' + acao + '</button></td></tr>';
          });
          h += '</tbody></table></div>';
        }
      }
      return h + '</div>';
    }

    function renderEscolher() {
      var h = '<div class="avp-form-card" id="poEscolher"><h3>Escolher o item</h3>' +
        '<p class="avp-intro">Só itens com Avaliação de Produto/Serviço concluída (qualquer classificação). Cada item tem um Posicionamento por vez.</p>';
      if (!tudoCarregado() || !window.faQuestionarios.configCarregada(QCOD)) return h + '<p class="loading-msg">Carregando…</p></div>';
      var itens = itensAvaliaveis();
      if (state.itemEscolhido) {
        var it = itens.filter(function (x) { return x.itemId === state.itemEscolhido; })[0];
        if (!it) return h + '<p class="avp-error-msg" id="poItemIndisponivel">Este item não tem Avaliação de Produto/Serviço concluída e não pode ser avaliado aqui.</p>' +
          '<button type="button" class="btn btn--sm" id="poOutroItem">Escolher outro item</button></div>';
        h += '<div class="po-item-escolhido" id="poItemSelecionado"><p class="po-item-nome">' + esc(it.nome) + '</p>' +
          (it.camada ? '<p class="avp-ficha-meta">Avaliação de Produto/Serviço: ' + esc(it.camada.label || it.camada.id) + ' (v' + esc(it.versao) + ')</p>' : '');
        h += acoesDoItem(it, true) + '</div><button type="button" class="btn btn--sm" id="poOutroItem">Escolher outro item</button></div>';
        return h;
      }
      h += '<div class="avp-field"><label for="poBusca">Buscar item</label><input type="search" id="poBusca" value="' + esc(state.busca) + '" autocomplete="off"></div>';
      var filtro = state.busca.trim().toLowerCase();
      var filtrados = itens.filter(function (x) { return !filtro || String(x.nome).toLowerCase().indexOf(filtro) !== -1; });
      if (!filtrados.length) h += '<p class="admin-empty">Nenhum item encontrado.</p>';
      h += '<ul class="po-itens">' + filtrados.map(function (x) {
        return '<li class="po-item-opcao" data-item="' + esc(x.itemId) + '"><span class="po-item-nome">' + esc(x.nome) + '</span> ' + acoesDoItem(x, false) + '</li>';
      }).join('') + '</ul>';
      return h + '</div>';
    }
    /* item com Posicionamento concluído → só "Abrir"; com rascunho → "Continuar"; senão escolher/iniciar */
    function acoesDoItem(it, escolhido) {
      var vig = state.vigentes[it.itemId], res = state.reservas[it.itemId];
      if (vig) return '<span class="po-item-situacao">Posicionamento concluído</span> <button type="button" class="btn btn--sm po-item-abrir" data-key="' + esc(vig) + '">Abrir</button>';
      if (res) return '<span class="po-item-situacao">Rascunho em andamento</span> <button type="button" class="btn btn--sm po-item-abrir" data-key="' + esc(res) + '">Continuar</button>';
      if (escolhido) return '<button type="button" class="btn btn--primary" id="poIniciarBtn"' + (state.salvando ? ' disabled' : '') + '>' + (state.salvando ? 'INICIANDO…' : 'Iniciar avaliação') + '</button>';
      return '<button type="button" class="btn btn--sm po-item-escolher">Escolher</button>';
    }

    function respostaDe(q) { return state.atual && state.atual.respostas && state.atual.respostas[q]; }
    function renderChecklist() {
      var a = state.atual, edita = podeEscrever(), versao = a.questionnaireContentVersion;
      var h = '<div class="avp-form-card" id="poChecklist"><h3>' + esc(a.itemNome) + ' ' + badge(a.status) + '</h3>' +
        '<p class="avp-intro">Responda considerando a responsabilidade organizacional associada a este objeto. As perguntas de cada nível aparecem conforme o caminho.</p>';
      if (!edita) h += '<p class="avp-decisao-aviso" id="poSomenteLeitura">Somente consulta: responder, salvar e concluir são do perfil Avaliação + Arquitetura.</p>';
      if (state.conflito) h += '<div class="avp-error-msg" id="poConflito" role="alert">Outra pessoa alterou este rascunho depois que você o abriu. Para não sobrescrever o trabalho dela, recarregue antes de continuar. ' +
        '<button type="button" class="btn btn--sm" id="poRecarregarBtn">Recarregar</button></div>';
      if (state.flash) h += '<p class="avp-flash-success" id="poFlash">' + esc(state.flash) + '</p>';
      var cam = caminho(a);
      ORDEM_NIVEIS.forEach(function (n) {
        var qs = NIVEIS[n].filter(function (q) { return cam.indexOf(q) !== -1; });
        if (!qs.length) return;
        h += '<section class="po-nivel" data-nivel="' + n + '"><h4 class="po-nivel-titulo">' + esc(TITULO_NIVEL[n]) + '</h4>';
        qs.forEach(function (q) { h += renderPergunta(q, versao, edita); });
        if (diagnosticoNecessario(a, n)) h += renderDiagnostico(n, versao, edita);
        h += '</section>';
      });
      h += '</div>';
      if (edita) {
        var f = falta(a), bloq = !!state.salvando || state.conflito;
        h += '<div class="avp-actions-footer">' +
          '<button type="button" class="btn" id="poSalvarBtn"' + (bloq ? ' disabled' : '') + '>' + (state.salvando === 'rascunho' ? 'SALVANDO…' : 'SALVAR RASCUNHO') + '</button>' +
          '<button type="button" class="btn btn--primary" id="poConcluirBtn"' + (bloq || f ? ' disabled' : '') + '>' + (state.salvando === 'concluido' ? 'CONCLUINDO…' : f ? esc(f.texto) : 'CONCLUIR') + '</button>' +
          '<button type="button" class="btn btn--sm btn--danger" id="poDescartarBtn"' + (bloq ? ' disabled' : '') + '>Descartar rascunho</button></div>';
      }
      return h + rodapeVoltar();
    }
    function renderAjuda(c) {
      var ajuda = c.textoAjuda || {}, partes = [];
      if (ajuda.significado) partes.push('<p><strong>O que significa:</strong> ' + esc(ajuda.significado) + '</p>');
      if (ajuda.quandoSim) partes.push('<p><strong>Quando SIM:</strong> ' + esc(ajuda.quandoSim) + '</p>');
      if (ajuda.quandoNao) partes.push('<p><strong>Quando NÃO:</strong> ' + esc(ajuda.quandoNao) + '</p>');
      if (ajuda.quandoMesma) partes.push('<p><strong>Quando "' + esc(c.rotuloMesma || 'mesma') + '":</strong> ' + esc(ajuda.quandoMesma) + '</p>');
      if (ajuda.quandoDistintas) partes.push('<p><strong>Quando "' + esc(c.rotuloDistintas || 'distintas') + '":</strong> ' + esc(ajuda.quandoDistintas) + '</p>');
      if (c.ajudaExtra) partes.push('<p class="po-ajuda-extra">' + esc(c.ajudaExtra).replace(/\n/g, '<br>') + '</p>');
      return partes.length ? '<details class="avp-ajuda-det"><summary>Ajuda</summary>' + partes.join('') + '</details>' : '';
    }
    function renderPergunta(q, versao, edita) {
      var c = conteudo(q, versao), r = respostaDe(q), v = r && r.resposta;
      var h = '<div class="avp-question po-pergunta" data-q="' + q + '"><div class="avp-question-head"><span class="avp-question-num">' + q + '</span>' +
        '<p class="avp-question-text"><strong>' + esc(c.titulo || '') + '</strong><br>' + esc(c.texto || '') + '</p></div>' + renderAjuda(c);
      h += '<div class="avp-choice-group">' + ['SIM', 'NAO'].map(function (val) {
        return '<button type="button" class="avp-choice-btn avp-choice-btn--' + (val === 'SIM' ? 'sim' : 'nao') + ' po-resp' + (v === val ? ' active ativa' : '') + '" data-q="' + q + '" data-v="' + val + '"' + (edita ? '' : ' disabled') + '>' + (val === 'SIM' ? 'SIM' : 'NÃO') + '</button>';
      }).join('') + '</div>';
      if (v) {
        if (r.interpretacaoNaEpoca) h += '<p class="po-interpretacao">' + esc(r.interpretacaoNaEpoca) + '</p>';
        h += '<label class="po-obs-rotulo" for="poObs' + q + '">Observação (opcional)</label><textarea class="avp-observacao po-obs" id="poObs' + q + '" data-q="' + q + '" maxlength="' + MAX_OBS + '" rows="2"' + (edita ? '' : ' disabled') + '>' + esc(r.observacao || '') + '</textarea>';
      }
      return h + '</div>';
    }
    function renderDiagnostico(n, versao, edita) {
      var c = conteudo(DIAG, versao), d = state.atual.diagnosticos && state.atual.diagnosticos[n], v = d && d.resposta;
      var papeis = papeisDoPar(state.atual, n);
      var h = '<div class="avp-question po-diag" data-nivel="' + n + '"><div class="avp-question-head"><span class="avp-question-num">Diagnóstico</span>' +
        '<p class="avp-question-text"><strong>' + esc(c.titulo || 'Conflito ou recorte') + '</strong><br>' + esc(c.texto || '') + '</p></div>' +
        '<p class="po-diag-papeis">Papéis: ' + papeis.map(spanNome).join(' e ') + '</p>' + renderAjuda(c);
      h += '<div class="avp-choice-group">' + [['mesma', c.rotuloMesma || 'Mesma responsabilidade'], ['distintas', c.rotuloDistintas || 'Responsabilidades distintas']].map(function (o) {
        return '<button type="button" class="avp-choice-btn avp-choice-btn--' + (o[0] === 'mesma' ? 'sim' : 'nao') + ' po-diag-resp' + (v === o[0] ? ' active ativa' : '') + '" data-nivel="' + n + '" data-v="' + o[0] + '"' + (edita ? '' : ' disabled') + '>' + esc(o[1]) + '</button>';
      }).join('') + '</div>';
      if (v) {
        if (d.interpretacaoNaEpoca) h += '<p class="po-interpretacao">' + esc(d.interpretacaoNaEpoca) + '</p>';
        h += '<label class="po-obs-rotulo" for="poDiagObs' + n + '">Observação (opcional)</label><textarea class="avp-observacao po-diag-obs" id="poDiagObs' + n + '" data-nivel="' + n + '" maxlength="' + MAX_OBS + '" rows="2"' + (edita ? '' : ' disabled') + '>' + esc(d.observacao || '') + '</textarea>';
      }
      return h + '</div>';
    }

    function linhaNomes(cod, a) {
      var reg = (a.nomesNaConclusao || {})[cod];
      var h = '<p class="po-nome-atual" id="poNomeAtual">Nome atual na Taxonomia: ' + spanNome(cod) + '</p>';
      if (reg) h += '<p class="po-nome-conclusao" id="poNomeConclusao">Nome registrado na conclusão: ' + esc(reg.nome) + (reg.contingencia ? ' <em>(rótulo de contingência — a Taxonomia não respondeu na hora)</em>' : '') + '</p>';
      return h;
    }
    function renderResultado() {
      var a = state.atual, ra = resultadoLido(a.resultadoAutomatico);
      var h = '<div class="avp-form-card" id="poResultado"><h3>' + esc(a.itemNome) + ' ' + badge(a.status) + '</h3>';
      h += '<p class="po-recomendado-rotulo">Posicionamento organizacional recomendado</p>';
      if (ra.codigoResultado === 'A_VALIDAR') {
        h += '<p class="po-recomendado" id="poRecomendado">A validar — ' + esc(TIPO_TEXTO[ra.tipoAValidar] || ra.tipoAValidar || '') + '</p>';
        if (ra.papeisDetectados.length) h += '<p id="poPapeis">Papéis identificados: ' + ra.papeisDetectados.map(spanNome).join(', ') + '</p>';
        if (ra.nivelConfirmado) h += '<p id="poNivelConfirmado">Nível confirmado: ' + spanNome(ra.nivelConfirmado) + '</p>' + linhaNomes(ra.nivelConfirmado, a);
      } else {
        h += '<p class="po-recomendado" id="poRecomendado">Posicionamento organizacional recomendado: ' + spanNome(ra.codigoResultado) + '</p>';
        h += (P() ? P().definicaoHtml(ra.codigoResultado, 'poDefinicao', { comEstado: true }) : '') + linhaNomes(ra.codigoResultado, a);
      }
      var cods = [ra.codigoResultado, ra.nivelConfirmado].concat(ra.papeisDetectados).filter(function (c) { return c && c !== 'A_VALIDAR'; });
      if (P()) h += P().avisoHtml(cods, 'poAvisoContingencia');
      h += '<p class="po-libera" id="poLiberaSquad">' + (ra.liberaSquad ? 'A Adequação à Squad (S1–S8) pode ser realizada para este item. Isso não cria nem associa Squad, e não quer dizer que haverá uma Squad só para este objeto.'
        : 'Este resultado não libera a Adequação à Squad (S1–S8).') + '</p>';
      h += '<p class="avp-intro">O1–O9 recomenda o tipo de estrutura que deve sustentar, de forma permanente, a responsabilidade associada ao objeto. A associação a uma estrutura organizacional concreta é uma etapa posterior.</p>';
      h += '<p class="avp-ficha-meta">Concluída em ' + esc(fmtData(a.concluidoEm)) + (a.concluidoPor ? ' por ' + esc(a.concluidoPor.name || a.concluidoPor.email) : '') + ' · regra ' + esc(ra.regra) + ' · motor v' + esc(ra.versaoMotor) + '</p>';
      h += renderRespostasLidas(a) + '</div>';
      return h + rodapeVoltar();
    }
    function renderRespostasLidas(a) {
      var h = '<details class="avp-dados-item" id="poRespostas"><summary>Respostas</summary><ul class="po-respostas-lista">';
      ORDEM_NIVEIS.forEach(function (n) {
        NIVEIS[n].forEach(function (q) {
          var r = a.respostas && a.respostas[q];
          if (!r) return;
          h += '<li><strong>' + q + '</strong> — ' + esc(r.tituloNaEpoca || '') + ': <strong>' + (r.resposta === 'SIM' ? 'SIM' : 'NÃO') + '</strong>' + (r.observacao ? '<br><em>' + esc(r.observacao) + '</em>' : '') + '</li>';
        });
        var d = a.diagnosticos && a.diagnosticos[n];
        if (d) h += '<li><strong>Diagnóstico do Nível ' + n.slice(1) + '</strong>: ' + esc(d.rotuloNaEpoca || d.resposta) + (d.observacao ? '<br><em>' + esc(d.observacao) + '</em>' : '') + '</li>';
      });
      return h + '</ul></details>';
    }
    function renderDescartado() {
      var a = state.atual;
      return '<div class="avp-form-card" id="poDescartado"><h3>' + esc(a.itemNome) + ' ' + badge(a.status) + '</h3>' +
        '<p>Descartada em ' + esc(fmtData(a.descartadoEm)) + (a.descartadoPor ? ' por ' + esc(a.descartadoPor.name || a.descartadoPor.email) : '') + '.</p>' +
        '<p><strong>Motivo:</strong> ' + esc(a.motivoDescarte) + '</p>' + renderRespostasLidas(a) + '</div>' + rodapeVoltar();
    }

    /* ===================== AÇÕES ===================== */
    function bind() {
      var v = byId('poVoltar'); if (v) v.addEventListener('click', sairParaAvaliacoes);
      var vl = byId('poVoltarLista'); if (vl) vl.addEventListener('click', function () { if (confirmarSaida()) { limparAtual(); state.tela = 'lista'; render(); } });
      var novo = byId('poNovoBtn'); if (novo) novo.addEventListener('click', function () { state.itemEscolhido = null; state.busca = ''; state.tela = 'escolher'; render(); });
      wrap.querySelectorAll('.po-abrir, .po-item-abrir').forEach(function (b) { b.addEventListener('click', function () { irParaChave(b.dataset.key); }); });
      wrap.querySelectorAll('.po-item-escolher').forEach(function (b) {
        b.addEventListener('click', function () { state.itemEscolhido = b.closest('.po-item-opcao').dataset.item; render(); });
      });
      var outro = byId('poOutroItem'); if (outro) outro.addEventListener('click', function () { state.itemEscolhido = null; render(); });
      var busca = byId('poBusca');
      if (busca) busca.addEventListener('input', function () {
        state.busca = busca.value;
        var pos = busca.selectionStart;
        render();
        var b2 = byId('poBusca'); if (b2) { b2.focus(); try { b2.setSelectionRange(pos, pos); } catch (e) { /* tipo search sem seleção */ } }
      });
      var ini = byId('poIniciarBtn'); if (ini) ini.addEventListener('click', iniciar);
      wrap.querySelectorAll('.po-resp').forEach(function (b) { b.addEventListener('click', function () { responder(b.dataset.q, b.dataset.v); }); });
      wrap.querySelectorAll('.po-diag-resp').forEach(function (b) { b.addEventListener('click', function () { responderDiagnostico(b.dataset.nivel, b.dataset.v); }); });
      wrap.querySelectorAll('.po-obs').forEach(function (t) {
        t.addEventListener('input', function () { var r = state.atual.respostas[t.dataset.q]; if (!r) return; if (t.value) r.observacao = t.value.slice(0, MAX_OBS); else delete r.observacao; state.sujo = true; });
      });
      wrap.querySelectorAll('.po-diag-obs').forEach(function (t) {
        t.addEventListener('input', function () { var d = state.atual.diagnosticos[t.dataset.nivel]; if (!d) return; if (t.value) d.observacao = t.value.slice(0, MAX_OBS); else delete d.observacao; state.sujo = true; });
      });
      var sal = byId('poSalvarBtn'); if (sal) sal.addEventListener('click', salvar);
      var con = byId('poConcluirBtn'); if (con) con.addEventListener('click', concluir);
      var des = byId('poDescartarBtn'); if (des) des.addEventListener('click', pedirDescarte);
      var rec = byId('poRecarregarBtn'); if (rec) rec.addEventListener('click', recarregar);
    }

    /* Muda uma resposta; se isso fechar um ramo, avisa o que sai (respostas, observações, diagnósticos). */
    function aplicarMudanca(novo) {
      var limpo = limparForaDoCaminho(novo);
      var perde = limpo.removidas.filter(function (q) { return state.atual.respostas && state.atual.respostas[q]; });
      var diags = limpo.diagsRemovidos.filter(function (n) { return state.atual.diagnosticos && state.atual.diagnosticos[n]; });
      function confirmar() { state.atual = limpo.reg; state.sujo = true; render(); }
      if (!perde.length && !diags.length) { confirmar(); return; }
      var partes = [];
      if (perde.length) partes.push('as respostas ' + perde.join(', '));
      if (limpo.obsRemovidas.length) partes.push(limpo.obsRemovidas.length === 1 ? '1 observação' : limpo.obsRemovidas.length + ' observações');
      diags.forEach(function (n) { partes.push('o diagnóstico do Nível ' + n.slice(1)); });
      modal('<h4>Esta mudança fecha um ramo</h4><p>Com esta resposta, ' + esc(partes.join(', ').replace(/, ([^,]*)$/, ' e $1')) +
        ' deixam de fazer parte desta avaliação e serão descartados. Nada é marcado como NÃO.</p><p>Continuar?</p>',
        { sim: 'Continuar', nao: 'Cancelar', aoSim: function () { confirmar(); return null; }, aoNao: function () { render(); } });
    }
    function responder(q, v) {
      if (!podeEscrever() || state.salvando || state.conflito) return;
      var atual = respostaDe(q);
      if (atual && atual.resposta === v) return;
      var novo = clone(state.atual);
      novo.respostas = novo.respostas || {};
      novo.respostas[q] = snapshotResposta(q, v, novo.questionnaireContentVersion, atual && atual.observacao, agoraIso());
      aplicarMudanca(novo);
    }
    function responderDiagnostico(n, v) {
      if (!podeEscrever() || state.salvando || state.conflito) return;
      var d = state.atual.diagnosticos && state.atual.diagnosticos[n];
      if (d && d.resposta === v) return;
      var novo = clone(state.atual);
      novo.diagnosticos = novo.diagnosticos || {};
      novo.diagnosticos[n] = snapshotDiagnostico(v, papeisDoPar(novo, n), novo.questionnaireContentVersion, d && d.observacao, agoraIso());
      state.atual = novo; state.sujo = true; render();
    }

    /* ---- gravação com prazo: sem resposta não é "falhou" — confere o banco antes de liberar ---- */
    function gravar(payload, aoOk, aoErro) {
      var respondido = false;
      var relogio = setTimeout(function () { if (respondido) return; respondido = true; aoErro('sem-resposta'); }, TEMPO_GRAVACAO);
      try {
        db().ref().update(payload, function (err) {
          if (respondido) return;
          respondido = true; clearTimeout(relogio);
          if (err) aoErro(err); else aoOk();
        });
      } catch (e) { respondido = true; clearTimeout(relogio); aoErro(e); }
    }
    function novaChave(caminho) { return db().ref(caminho).push().key; }

    function iniciar() {
      if (!podeEscrever() || state.salvando) return;
      var it = itensAvaliaveis().filter(function (x) { return x.itemId === state.itemEscolhido; })[0];
      if (!it || !window.faQuestionarios.configCarregada(QCOD)) return;
      if (state.vigentes[it.itemId]) { irParaChave(state.vigentes[it.itemId]); return; }
      if (state.reservas[it.itemId]) { irParaChave(state.reservas[it.itemId]); return; }
      var usuario = sessaoAtual();
      if (!usuario) return;
      var id = novaChave(NODE), audId = novaChave(AUD + '/' + id);
      var payload = payloadCriacao({ id: id, audId: audId, itemId: it.itemId, itemNome: it.nome, avaliacaoArquiteturalId: it.avaliacaoArquiteturalId,
        versao: window.faQuestionarios.versaoAtual(QCOD), usuario: usuario, agora: agoraIso() });
      state.salvando = 'criacao'; render();
      gravar(payload, function () {
        state.salvando = null;
        state.registros[id] = payload[NODE + '/' + id];
        state.reservas[it.itemId] = id;
        irParaChave(id);
      }, function (err) {
        state.salvando = null;
        /* outra pessoa iniciou o mesmo item ao mesmo tempo: abre o rascunho dela, nunca cria outro */
        db().ref(RES + '/' + it.itemId).once('value').then(function (s) {
          var outro = s.val();
          if (outro && outro !== id) { state.flash = 'Este item já tinha um rascunho iniciado por outra pessoa: ele foi aberto.'; irParaChave(outro); return; }
          return db().ref(VIG + '/' + it.itemId).once('value').then(function (v) {
            if (v.val()) { irParaChave(v.val()); return; }
            render();
            aviso(err === 'sem-resposta' ? 'A conexão está demorando e não deu para confirmar o início. Confira a lista antes de tentar de novo.' : 'Não foi possível iniciar a avaliação. Tente novamente.');
          });
        }).catch(function () { render(); aviso('Não foi possível iniciar a avaliação. Tente novamente.'); });
      });
    }

    function aposErroDeGravacao(err, acao) {
      state.salvando = null;
      var id = state.chave;
      db().ref(NODE + '/' + id + '/revisao').once('value').then(function (s) {
        if (s.val() !== state.revisaoBase) { state.conflito = true; render(); return; }
        render();
        aviso(err === 'sem-resposta' ? 'A conexão está demorando e não deu para confirmar. Confira antes de tentar de novo.' : 'Não foi possível ' + acao + '. Tente novamente.');
      }).catch(function () { render(); aviso('Não foi possível ' + acao + '. Tente novamente.'); });
    }
    function salvar() {
      if (!podeEscrever() || state.salvando || state.conflito) return;
      var usuario = sessaoAtual(); if (!usuario) return;
      var limpo = limparForaDoCaminho(state.atual).reg;
      var payload = payloadSalvar(state.chave, limpo, usuario, agoraIso(), state.revisaoBase);
      state.salvando = 'rascunho'; state.revisaoEmGravacao = state.revisaoBase + 1; render();
      gravar(payload, function () {
        state.salvando = null; state.revisaoBase = state.revisaoEmGravacao; state.revisaoEmGravacao = null; state.sujo = false;
        state.atual = Object.assign(clone(payload[NODE + '/' + state.chave]), {});
        state.flash = '✓ Rascunho salvo.'; render();
      }, function (err) { state.revisaoEmGravacao = null; aposErroDeGravacao(err, 'salvar'); });
    }
    function concluir() {
      if (!podeEscrever() || state.salvando || state.conflito) return;
      var limpo = limparForaDoCaminho(state.atual).reg;
      if (falta(limpo)) { render(); return; }
      var usuario = sessaoAtual(); if (!usuario) return;
      var montado = payloadConclusao(state.chave, limpo, usuario, agoraIso(), state.revisaoBase, novaChave(AUD + '/' + state.chave));
      state.salvando = 'concluido'; state.revisaoEmGravacao = state.revisaoBase + 1; render();
      gravar(montado.payload, function () {
        var rec = montado.payload[NODE + '/' + state.chave];
        state.salvando = null; state.revisaoEmGravacao = null; state.sujo = false;
        state.registros[state.chave] = rec; state.vigentes[rec.itemId] = state.chave; delete state.reservas[rec.itemId];
        irParaChave(state.chave);
      }, function (err) {
        state.revisaoEmGravacao = null;
        var item = state.atual.itemId;
        db().ref(VIG + '/' + item).once('value').then(function (v) {
          if (v.val() && v.val() !== state.chave) { state.salvando = null; render(); aviso('Este item já tem um Posicionamento concluído. Abra-o pela lista.'); return; }
          aposErroDeGravacao(err, 'concluir');
        }).catch(function () { aposErroDeGravacao(err, 'concluir'); });
      });
    }
    function pedirDescarte() {
      if (!podeEscrever() || state.salvando || state.conflito) return;
      modal('<h4>Descartar este rascunho?</h4><p>O registro não é apagado: fica como descartado, com o motivo, e o item volta a poder ser avaliado.</p>' +
        '<label for="poMotivoDescarte">Motivo *</label><textarea id="poMotivoDescarte" rows="3" maxlength="' + MAX_MOTIVO + '"></textarea>',
        { sim: 'Descartar', nao: 'Cancelar', aoSim: function (box) {
          var motivo = String(box.querySelector('#poMotivoDescarte').value || '').trim();
          if (!motivo) return 'Informe o motivo do descarte.';
          if (motivo.length > MAX_MOTIVO) return 'O motivo pode ter até ' + MAX_MOTIVO + ' caracteres.';
          descartar(motivo);
          return null;
        } });
    }
    function descartar(motivo) {
      var usuario = sessaoAtual(); if (!usuario) return;
      var payload = payloadDescarte(state.chave, state.atual, usuario, agoraIso(), state.revisaoBase, novaChave(AUD + '/' + state.chave), motivo);
      state.salvando = 'descarte'; state.revisaoEmGravacao = state.revisaoBase + 1; render();
      gravar(payload, function () {
        var rec = payload[NODE + '/' + state.chave];
        state.salvando = null; state.revisaoEmGravacao = null; state.sujo = false;
        state.registros[state.chave] = rec; delete state.reservas[rec.itemId];
        irParaChave(state.chave);
      }, function (err) { state.revisaoEmGravacao = null; aposErroDeGravacao(err, 'descartar'); });
    }
    function recarregar() {
      var rec = state.registros[state.chave];
      state.conflito = false; state.sujo = false; state.flash = null;
      if (rec) irParaChave(state.chave); else render();
    }

    /* ===================== LEITURAS AO VIVO ===================== */
    var ouvintes = [];
    function ouvir(caminho, chaveCarga, aplicar) {
      var ref = db().ref(caminho);
      var cb = function (snap) { aplicar(snap.val() || {}); state.carregou[chaveCarga] = true; aoChegar(chaveCarga); };
      var erro = function (e) { console.error('[avaliacao-posicionamento] não foi possível ler ' + caminho + ':', e); state.carregou[chaveCarga] = true; if (chaveCarga === 'av') state.erroLeitura = true; aoChegar(chaveCarga); };
      ref.on('value', cb, erro);
      ouvintes.push({ ref: ref, cb: cb });
    }
    function aoChegar(qual) {
      if (qual === 'av' && state.atual && state.chave) {
        var rec = state.registros[state.chave];
        if (rec && (rec.revisao || 0) !== state.revisaoBase && rec.revisao !== state.revisaoEmGravacao) {
          /* outra pessoa gravou: sem alterações locais, só atualiza; com alterações, avisa e não sobrescreve */
          if (state.sujo && state.tela === 'checklist') state.conflito = true;
          else if (!state.salvando) { var flash = state.flash; abrirChave(state.chave); state.flash = flash; }
        }
      }
      if (state.tela === 'carregando' && state.pendente && state.carregou.av) { var k = state.pendente; state.pendente = null; aplicando = true; try { abrirChave(k); } finally { aplicando = false; } }
      if (state.tela === 'carregando' && !state.pendente && autorizacaoResolvida()) state.tela = podeEscrever() ? 'escolher' : 'sem-permissao';
      if (state.salvando) return; /* não redesenha no meio de uma gravação */
      if (state.tela === 'checklist' && state.sujo && !state.conflito) return; /* não apaga o que a pessoa está digitando */
      render();
    }
    var ligado = false;
    function ligar() {
      if (ligado || !podeLer()) return;
      ligado = true;
      ouvir(NODE, 'av', function (v) { state.registros = v; });
      ouvir(RES, 'res', function (v) { state.reservas = v; });
      ouvir(VIG, 'vig', function (v) { state.vigentes = v; });
      ouvir(PROD, 'prod', function (v) { state.produtos = v; });
      if (window.faQuestionarios) window.faQuestionarios.onMudanca(QCOD, function () { if (!wrap.hidden && !(state.tela === 'checklist' && state.sujo)) render(); });
      if (P()) P().onMudanca(function () { if (!wrap.hidden) P().atualizarDom(wrap); });
    }
    function desligar() {
      ouvintes.forEach(function (o) { try { o.ref.off('value', o.cb); } catch (e) { /* já cancelada */ } });
      ouvintes = []; ligado = false;
    }
    /* troca de pessoa sem recarregar: nada do estado anterior sobrevive */
    function emailDaSessao() { var s = sessaoAtual(); return s ? String(s.email).toLowerCase() : null; }
    var pessoa = emailDaSessao();
    function aoMudarSessao() {
      var agora = emailDaSessao();
      if (pessoa && pessoa !== agora) {
        desligar();
        var novo = novoEstado();
        Object.keys(state).forEach(function (k) { delete state[k]; });
        Object.assign(state, novo);
        fecharPainel(); wrap.innerHTML = '';
      }
      pessoa = agora;
      if (agora) ligar();
      if (!wrap.hidden) { var e = poDoEndereco(); if (e.po) aplicarEndereco(e.po, e.item); }
    }
    ['fa-auth-ready', 'fa-auth-change', 'fa-avaliacao-ready', 'fa-admin-ready'].forEach(function (ev) { window.addEventListener(ev, aoMudarSessao); });
    ligar();
    window.addEventListener('beforeunload', function (e) { if (state.tela === 'checklist' && state.sujo) { e.preventDefault(); e.returnValue = ''; } });
    window.addEventListener('hashchange', function () {
      var e = poDoEndereco();
      if (!e.po) { if (!wrap.hidden) fecharPainel(); return; }
      aplicarEndereco(e.po, e.item);
    });
    var api = {
      abrirLista: function () { aplicarEndereco('lista'); },
      aplicarEndereco: aplicarEndereco,
      fechar: function () { fecharPainel(); },
      aberto: aberto
    };
    var inicial = poDoEndereco();
    if (inicial.po) aplicarEndereco(inicial.po, inicial.item);
    return api;
  }

  window.faInitAvaliacaoPosicionamento = function () {
    if (window.faAvaliacaoPosicionamento) return;
    var api = montar();
    if (api) window.faAvaliacaoPosicionamento = api;
  };
})();
