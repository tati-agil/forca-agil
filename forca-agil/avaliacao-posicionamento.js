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
     posicionamento-vigente-por-item/<itemId>    = <id> do Posicionamento concluído e VIGENTE do item (um só; a conclusão de uma
                                                 reavaliação troca por compare-and-set — só se ainda é a anterior)
     posicionamento-decisoes/<id>                decisão humana daquela versão (PR F): uma, só da vigente, imutável
     posicionamento-auditoria/<id>/<push>        criacao | conclusao | descarte | decisao (só acréscimo)
   Cada transição é UMA gravação multipath (ou entra tudo, ou nada). revisao: cada gravação = anterior + 1 — uma
   gravação feita sobre versão antiga é recusada, e a tela avisa e recarrega (nunca sobrescreve).

   Escrita (iniciar, salvar, concluir, descartar): só "Avaliação + Arquitetura" e admin geral
   (faAuth.podeArquitetura) — o perfil "Avaliação" só consulta. Leitura: os três.

   Caminho: só as perguntas que faMotorPosicionamento.perguntasDoCaminho() devolve aparecem; o diagnóstico
   DIAG_CONFLITO_RECORTE só no nível alcançado, completo e com exatamente 2 SIM. Mudar uma resposta que fecha um
   ramo descarta (com aviso e confirmação) as respostas, observações e diagnósticos que saíram do caminho — nada
   vira NAO. Concluir só com tudo o que o caminho exige respondido (falta de resposta ou diagnóstico pendente não
   conclui como "A validar").

   PR F — decisão humana e reavaliação (prova: teste-rules-posicionamento-decisao.js, teste-posicionamento-decisao.js):
   a ficha tem três blocos — Recomendação automática (resultadoAutomatico, nunca reescrito) / Decisão final / Histórico
   de versões. Decidir: só os 8 CODIGOS_FIRMES; CONFIRMACAO (mesmo código; justificativa opcional), DIVERGENCIA ou
   RESOLUCAO_A_VALIDAR (justificativa obrigatória); liberaSquad da decisão = liberaSquadParaCodigoFirme. Com
   reavaliação em andamento, a vigente não recebe decisão. Reavaliar: versão seguinte da vigente, com motivo; as
   respostas vêm pelo critério de Produto/Serviço (faCriterioReavaliacao — sem ele, nada é montado) e passam por
   limparForaDoCaminho; a anterior continua vigente até a nova ser concluída; descartar não muda nada nela.
   ============================================================ */
(function () {
  'use strict';
  var NODE = 'avaliacoes-posicionamento', RES = 'posicionamento-rascunho-por-item', VIG = 'posicionamento-vigente-por-item';
  var AUD = 'posicionamento-auditoria', PROD = 'avaliacoes-produto', DEC = 'posicionamento-decisoes';
  var QCOD = 'POSICIONAMENTO_ORGANIZACIONAL', DIAG = 'DIAG_CONFLITO_RECORTE';
  var MAX_OBS = 2000, MAX_MOTIVO = 500, MAX_JUSTIFICATIVA = 2000, TEMPO_GRAVACAO = 12000;
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
    /* reavaliação: o banco só aceita a troca se o vigente ainda é a anterior (compare-and-set) */
    p[VIG + '/' + r.itemId] = id;
    p[AUD + '/' + id + '/' + audId] = semVazios({ tipo: 'conclusao', itemId: r.itemId, codigoResultado: res.codigoResultado, regra: res.regra, versaoMotor: res.versaoMotor,
      liberaSquad: res.liberaSquad, vigenteAnterior: r.avaliacaoAnteriorId || null, usuario: usuario, dataHora: agora });
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
  /* ---- PR F: decisão humana ---- */
  /* só espaço, tabulação, quebra de linha e retorno — os mesmos que o banco ignora */
  function emBranco(s) { return typeof s !== 'string' || !s.replace(/[ \t\n\r]/g, '').length; }
  function tipoDecisao(codAuto, codFinal) {
    if (codAuto === 'A_VALIDAR') return 'RESOLUCAO_A_VALIDAR';
    return codAuto === codFinal ? 'CONFIRMACAO' : 'DIVERGENCIA';
  }
  function exigeJustificativa(tipo) { return tipo !== 'CONFIRMACAO'; }
  /* o: { id (a avaliação concluída e vigente), reg, codigoFinal, justificativa, usuario, agora, audId }. O resultado
     automático não é tocado: a decisão é outro nó. liberaSquad vem do motor (mesma regra do resultado). */
  function payloadDecisao(o) {
    var M = motor(), ra = o.reg.resultadoAutomatico || {}, Pz = window.faPosicionamentos;
    if (M.CODIGOS_FIRMES.indexOf(o.codigoFinal) === -1) throw new Error('codigo-nao-firme');
    var tipo = tipoDecisao(ra.codigoResultado, o.codigoFinal);
    var just = emBranco(o.justificativa) ? null : String(o.justificativa).slice(0, MAX_JUSTIFICATIVA);
    if (exigeJustificativa(tipo) && !just) throw new Error('justificativa-obrigatoria');
    var dec = semVazios({ itemId: o.reg.itemId, versaoAvaliacao: o.reg.versao, versaoMotor: ra.versaoMotor, codigoAutomatico: ra.codigoResultado,
      tipoAValidarAutomatico: ra.tipoAValidar || null, codigoFinal: o.codigoFinal, tipoDecisao: tipo, justificativa: just,
      nomeNaDecisao: { nome: String((Pz && Pz.nome(o.codigoFinal)) || o.codigoFinal).slice(0, 120), contingencia: !!(Pz && Pz.usandoContingencia(o.codigoFinal)) },
      liberaSquad: M.liberaSquadParaCodigoFirme(o.codigoFinal), decididoPor: o.usuario, decididoEm: o.agora, auditoriaId: o.audId });
    var p = {};
    p[DEC + '/' + o.id] = dec;
    /* auditoria autocontida: o banco confere cada campo contra a decisão da mesma gravação */
    p[AUD + '/' + o.id + '/' + o.audId] = semVazios({ tipo: 'decisao', itemId: o.reg.itemId, codigoAutomatico: ra.codigoResultado, codigoFinal: o.codigoFinal,
      tipoDecisao: tipo, versaoAvaliacao: o.reg.versao, justificativa: just, liberaSquad: dec.liberaSquad, usuario: o.usuario, dataHora: o.agora });
    return p;
  }
  /* ---- PR F: reavaliação ----
     Critério de herança: o MESMO de Produto/Serviço (faCriterioReavaliacao, de avaliacao-produto.js). Sem ele, a
     reavaliação não é montada (falha fechada: nunca herda resposta sem saber se a pergunta mudou).
       'pergunta' → não herda (responder de novo); 'ajuda' → herda, com aviso; null → herda. */
  function criterio() {
    var C = window.faCriterioReavaliacao;
    if (!C || typeof C.situacao !== 'function' || typeof C.mesmoConteudo !== 'function') throw new Error('criterio-indisponivel');
    return C;
  }
  function situacaoResposta(resp, q, versaoNova) {
    var C = criterio();
    if (!resp || !resp.resposta) return null;
    var vr = resp.questionnaireContentVersion || null;
    if (vr === versaoNova) return null;
    var antes = vr ? conteudo(q, vr) : null, agora = conteudo(q, versaoNova);
    return C.situacao(resp.textoPerguntaNaEpoca || (antes && antes.texto) || null, antes, agora);
  }
  /* Diagnóstico: herda só se o par de papéis é o mesmo E texto, rótulo "mesma" e rótulo "distintas" não mudaram;
     mudou só ajuda/interpretação → 'ajuda'. */
  var CAMPOS_DIAG_PERGUNTA = ['texto', 'rotuloMesma', 'rotuloDistintas'];
  function situacaoDiagnostico(diag, papeisAgora, versaoNova) {
    var C = criterio();
    if (!diag || !diag.resposta) return null;
    if (JSON.stringify(diag.papeis || []) !== JSON.stringify(papeisAgora || [])) return 'pergunta';
    var vr = diag.questionnaireContentVersion || null;
    if (vr === versaoNova) return null;
    if (!vr) return 'pergunta';
    var antes = conteudo(DIAG, vr), agora = conteudo(DIAG, versaoNova);
    if (!diag.textoPerguntaNaEpoca || !C.mesmoConteudo(diag.textoPerguntaNaEpoca, agora.texto)) return 'pergunta';
    if (CAMPOS_DIAG_PERGUNTA.some(function (k) { return !C.mesmoConteudo(antes[k], agora[k]); })) return 'pergunta';
    var ajuda = C.CAMPOS_AJUDA_COMPARADOS.concat(['interpretacaoMesma', 'interpretacaoDistintas']);
    return ajuda.some(function (k) { return !C.mesmoConteudo(antes[k], agora[k]); }) ? 'ajuda' : null;
  }
  /* o: { id, audId, anteriorId, anterior (registro vigente), itemNome, avaliacaoArquiteturalId (a Avaliação de Produto
     concluída mais recente do item), versao (questionário vigente agora), motivo, usuario, agora } */
  function payloadReavaliacao(o) {
    criterio();
    var ant = o.anterior || {}, vn = o.versao, respostas = {}, diagnosticos = {};
    Object.keys(ant.respostas || {}).forEach(function (q) {
      var r = ant.respostas[q];
      if (!r || (r.resposta !== 'SIM' && r.resposta !== 'NAO') || situacaoResposta(r, q, vn) === 'pergunta') return;
      respostas[q] = snapshotResposta(q, r.resposta, vn, r.observacao, r.dataResposta || o.agora);
    });
    var reg = { itemId: ant.itemId, itemNome: String(o.itemNome || ant.itemNome || ant.itemId).slice(0, 200), avaliacaoArquiteturalId: o.avaliacaoArquiteturalId,
      questionarioCodigo: QCOD, questionnaireContentVersion: vn, versao: (ant.versao || 1) + 1, avaliacaoAnteriorId: o.anteriorId,
      motivoReavaliacao: String(o.motivo || '').slice(0, MAX_MOTIVO), status: 'rascunho', revisao: 1, criadoPor: o.usuario, criadoEm: o.agora,
      atualizadoPor: o.usuario, atualizadoEm: o.agora, auditoriaCriacaoId: o.audId };
    if (Object.keys(respostas).length) reg.respostas = respostas;
    ORDEM_NIVEIS.forEach(function (n) {
      var d = ant.diagnosticos && ant.diagnosticos[n];
      if (!d || !diagnosticoNecessario(reg, n)) return;
      var papeis = papeisDoPar(reg, n);
      if (situacaoDiagnostico(d, papeis, vn) === 'pergunta') return;
      diagnosticos[n] = snapshotDiagnostico(d.resposta, papeis, vn, d.observacao, d.dataResposta || o.agora);
    });
    if (Object.keys(diagnosticos).length) reg.diagnosticos = diagnosticos;
    reg = limparForaDoCaminho(reg).reg;
    var p = {};
    p[NODE + '/' + o.id] = reg;
    p[RES + '/' + reg.itemId] = o.id;
    p[AUD + '/' + o.id + '/' + o.audId] = { tipo: 'criacao', itemId: reg.itemId, avaliacaoArquiteturalId: o.avaliacaoArquiteturalId, avaliacaoAnteriorId: o.anteriorId,
      motivo: reg.motivoReavaliacao, usuario: o.usuario, dataHora: o.agora };
    return p;
  }
  window.faAvaliacaoPosicionamentoNucleo = {
    simples: simples, avaliar: avaliar, caminho: caminho, diagnosticoNecessario: diagnosticoNecessario, papeisDoPar: papeisDoPar,
    limparForaDoCaminho: limparForaDoCaminho, falta: falta, snapshotResposta: snapshotResposta, snapshotDiagnostico: snapshotDiagnostico,
    resultadoGravavel: resultadoGravavel, nomesNaConclusao: nomesNaConclusao,
    payloadCriacao: payloadCriacao, payloadSalvar: payloadSalvar, payloadConclusao: payloadConclusao, payloadDescarte: payloadDescarte,
    tipoDecisao: tipoDecisao, exigeJustificativa: exigeJustificativa, emBranco: emBranco, payloadDecisao: payloadDecisao,
    situacaoResposta: situacaoResposta, situacaoDiagnostico: situacaoDiagnostico, payloadReavaliacao: payloadReavaliacao,
    MAX_OBS: MAX_OBS, MAX_MOTIVO: MAX_MOTIVO, MAX_JUSTIFICATIVA: MAX_JUSTIFICATIVA
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
      registros: {}, reservas: {}, vigentes: {}, produtos: {}, decisoes: {},
      carregou: { av: false, res: false, vig: false, prod: false, dec: false }, erroLeitura: false, erroDec: false,
      mostrarHistorico: false, formDecisao: null, exportando: null, flashExportacao: null, menuExportarAberto: false,
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
      /* aberto pela API (botão da lista, ficha): o endereço passa a ser o desta tela; vindo do endereço, já é */
      sincronizarEndereco();
      reafirmar();
    }
    function autorizacaoResolvida() { return !!(window.faAuth && (!window.faAuth.isAvaliacaoReady || window.faAuth.isAvaliacaoReady())); }
    function limparAtual() { state.atual = null; state.chave = null; state.sujo = false; state.conflito = false; state.flash = null; state.formDecisao = null; state.flashExportacao = null; state.menuExportarAberto = false; }
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
      /* um ouvinte ao vivo pode redesenhar enquanto a pessoa digita (justificativa, filtro): o foco volta ao campo */
      var ativo = document.activeElement, foco = null;
      if (ativo && ativo.id && wrap.contains(ativo) && /^(TEXTAREA|INPUT|SELECT)$/.test(ativo.tagName)) {
        foco = { id: ativo.id, ini: ativo.selectionStart, fim: ativo.selectionEnd };
      }
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
      if (foco) { var el = byId(foco.id); if (el && !el.disabled) { el.focus(); try { if (foco.ini != null) el.setSelectionRange(foco.ini, foco.fim); } catch (e) { /* select e search sem seleção */ } } }
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

    /* situação de uma avaliação na cadeia de versões do item */
    function situacaoDe(key, r) {
      if (!r) return null;
      if (r.status === 'rascunho') return r.avaliacaoAnteriorId ? 'reavaliacao' : 'rascunho';
      if (r.status === 'descartado') return 'descartado';
      return state.vigentes[r.itemId] === key ? 'vigente' : 'historica';
    }
    var ROTULO_SITUACAO = { vigente: 'Vigente', historica: 'Histórica', rascunho: 'Rascunho', reavaliacao: 'Reavaliação em andamento', descartado: 'Descartada' };
    function badgeSituacao(sit) { return '<span class="avp-badge po-badge po-badge--' + esc(sit) + '">' + esc(ROTULO_SITUACAO[sit] || sit) + '</span>'; }
    var ROTULO_TIPO_DECISAO = { CONFIRMACAO: 'Confirmação da recomendação automática', DIVERGENCIA: 'Divergência da recomendação automática', RESOLUCAO_A_VALIDAR: 'Resolução do "A validar"' };
    /* decisão de uma versão concluída, em texto curto: "Carregando…" enquanto a leitura não chegou (não saber ≠ não ter) */
    function textoDecisao(key, r) {
      if (!r || r.status !== 'concluido') return '—';
      if (state.erroDec) return 'Não foi possível ler';
      if (!state.carregou.dec) return 'Carregando…';
      var d = state.decisoes[key];
      return d ? spanNome(d.codigoFinal) : 'Sem decisão registrada';
    }
    function cadeiaDoItem(itemId) {
      return Object.keys(state.registros).filter(function (k) { return state.registros[k] && state.registros[k].itemId === itemId; })
        .map(function (k) { return Object.assign({ _key: k }, state.registros[k]); })
        .sort(function (x, y) { return ((y.versao || 1) - (x.versao || 1)) || (String(y.criadoEm || '') < String(x.criadoEm || '') ? -1 : 1); });
    }

    /* o que a lista mostra — a mesma conta para a tela e para "Excel — lista atual" */
    function conjuntosDaLista() {
      var todas = Object.keys(state.registros).map(function (k) { return Object.assign({ _key: k, _sit: situacaoDe(k, state.registros[k]) }, state.registros[k]); })
        .sort(function (a, b) { return String(b.atualizadoEm || '') < String(a.atualizadoEm || '') ? -1 : 1; });
      /* padrão: o que vale hoje (vigente) e o que está em andamento; histórico e descartadas no filtro */
      var antigas = todas.filter(function (r) { return r._sit === 'historica' || r._sit === 'descartado'; });
      var lista = state.mostrarHistorico ? todas : todas.filter(function (r) { return r._sit !== 'historica' && r._sit !== 'descartado'; });
      return { todas: todas, antigas: antigas, lista: lista };
    }
    /* ---- exportação (G1): só leitura; o conteúdo vem de exportacoes-posicionamento.js (puro) ---- */
    /* não saber ≠ não ter: sem as decisões lidas, nenhum arquivo pode dizer "Sem decisão registrada" */
    function prontoParaExportar() { return state.carregou.av && state.carregou.vig && state.carregou.dec && state.carregou.prod && !state.erroDec && !state.erroLeitura; }
    function avisoExportacao() {
      if (state.erroDec) return '<p class="avp-error-msg" id="poExportarBloqueado">Não foi possível ler as decisões agora: a exportação fica indisponível para não registrar "Sem decisão" por engano. Recarregue a página e tente de novo.</p>';
      return '';
    }
    function statusExportacao() {
      if (!state.flashExportacao) return '';
      return '<p class="avp-export-status' + (state.flashExportacao.erro ? ' avp-export-status--erro' : '') + '" id="poExportarStatus">' + esc(state.flashExportacao.texto) + '</p>';
    }
    function renderExportarLista(conj) {
      if (!conj.todas.length) return '';
      var pronto = prontoParaExportar(), ocupado = !!state.exportando;
      var h = '<div class="avp-actions-bar po-exportar-barra"><div class="avp-exportar-wrap">' +
        '<button type="button" class="btn btn--sm" id="poExportarBtn"' + (!pronto || ocupado ? ' disabled' : '') + '>' +
        (ocupado ? 'Gerando arquivo…' : !pronto && !state.erroDec ? 'Carregando…' : 'Exportar ▾') + '</button>';
      if (state.menuExportarAberto && pronto && !ocupado) {
        h += '<div class="avp-exportar-menu" id="poExportarMenu">' +
          '<p class="avp-exportar-escopo">Lista atual: <strong>' + conj.lista.length + '</strong> avaliaç' + (conj.lista.length === 1 ? 'ão' : 'ões') +
          (state.mostrarHistorico ? ' (com históricas e descartadas)' : ' (vigentes e em andamento)') + '</p>' +
          '<button type="button" class="btn" id="poExportarExcelLista">📊 Excel — lista atual (' + conj.lista.length + ')</button>' +
          '<button type="button" class="btn" id="poExportarExcelTodas">📊 Excel — todas as avaliações (' + conj.todas.length + ')</button>' +
          '<p class="avp-exportar-nota">O Excel traz as abas Resumo, Respostas O1–O9, Histórico e Trilha. O PDF de uma avaliação concluída fica na ficha dela.</p></div>';
      }
      return h + '</div></div>' + avisoExportacao() + statusExportacao();
    }

    function renderLista() {
      var h = '<div class="avp-form-card" id="poLista"><h3>Posicionamento Organizacional</h3>' +
        '<p class="avp-intro">Recomenda que tipo de estrutura organizacional deve sustentar a responsabilidade associada a cada item (O1–O9). Não escolhe uma estrutura concreta.</p>';
      if (state.flash) h += '<p class="avp-flash-success" id="poFlash">' + esc(state.flash) + '</p>';
      if (podeEscrever()) h += '<div class="avp-actions-bar"><button type="button" class="btn btn--primary" id="poNovoBtn">+ Avaliar posicionamento de um item</button></div>';
      /* sem o índice de vigentes, toda concluída pareceria histórica: espera os dois */
      if (!state.carregou.av || !state.carregou.vig) h += '<p class="loading-msg">Carregando…</p>';
      else if (state.erroLeitura) h += '<p class="avp-error-msg">Não foi possível ler as avaliações agora.</p>';
      else {
        var conj = conjuntosDaLista(), todas = conj.todas, antigas = conj.antigas, lista = conj.lista;
        h += renderExportarLista(conj);
        if (antigas.length) h += '<label class="avp-decisao-option po-filtro-historico"><input type="checkbox" id="poMostrarHistorico"' + (state.mostrarHistorico ? ' checked' : '') + '> ' +
          'Mostrar versões históricas e descartadas (' + antigas.length + ')</label>';
        if (!todas.length) h += '<p class="admin-empty">Nenhuma avaliação de posicionamento ainda.</p>';
        else if (!lista.length) h += '<p class="admin-empty">Nenhuma avaliação vigente ou em andamento.</p>';
        else {
          h += '<div class="table-scroll-wrap"><table class="admin-table po-tabela"><thead><tr><th>Item</th><th>Versão</th><th>Situação</th><th>Recomendação automática</th><th>Decisão final</th><th>Atualizado em</th><th></th></tr></thead><tbody>';
          lista.forEach(function (r) {
            var acao = r.status === 'rascunho' && podeEscrever() ? 'Continuar' : 'Abrir';
            h += '<tr class="po-linha" data-key="' + esc(r._key) + '" data-situacao="' + esc(r._sit) + '"><td data-label="Item">' + esc(r.itemNome) + '</td>' +
              '<td data-label="Versão">v' + esc(r.versao || 1) + '</td><td data-label="Situação">' + badgeSituacao(r._sit) + '</td>' +
              '<td data-label="Recomendação automática">' + (r.status === 'concluido' ? rotuloResultado(r.resultadoAutomatico) : '—') + '</td>' +
              '<td data-label="Decisão final" class="po-col-decisao">' + textoDecisao(r._key, r) + '</td>' +
              '<td data-label="Atualizado em">' + esc(fmtData(r.atualizadoEm)) + '</td>' +
              '<td data-label="Ações"><button type="button" class="btn btn--sm po-abrir" data-key="' + esc(r._key) + '">' + acao + '</button></td></tr>';
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
      if (a.avaliacaoAnteriorId) h += '<div class="po-reavaliacao-info" id="poReavaliacaoInfo"><p><strong>Reavaliação — versão ' + esc(a.versao) + '.</strong> A versão ' + esc((a.versao || 2) - 1) +
        ' continua vigente até esta ser concluída; descartar esta reavaliação não muda nada nela.</p><p><strong>Motivo:</strong> ' + esc(a.motivoReavaliacao) + '</p>' +
        '<p class="avp-ficha-meta">As respostas da versão anterior vieram preenchidas; perguntas cuja redação mudou precisam ser respondidas de novo.</p></div>';
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
        '<p class="avp-question-text"><strong>' + esc(c.titulo || '') + '</strong><br>' + esc(c.texto || '') + '</p></div>' + avisoHeranca(q, null) + renderAjuda(c);
      h += '<div class="avp-choice-group">' + ['SIM', 'NAO'].map(function (val) {
        return '<button type="button" class="avp-choice-btn avp-choice-btn--' + (val === 'SIM' ? 'sim' : 'nao') + ' po-resp' + (v === val ? ' active ativa' : '') + '" data-q="' + q + '" data-v="' + val + '"' + (edita ? '' : ' disabled') + '>' + (val === 'SIM' ? 'SIM' : 'NÃO') + '</button>';
      }).join('') + '</div>';
      if (v) {
        if (r.interpretacaoNaEpoca) h += '<p class="po-interpretacao">' + esc(r.interpretacaoNaEpoca) + '</p>';
        h += '<label class="po-obs-rotulo" for="poObs' + q + '">Observação (opcional)</label><textarea class="avp-observacao po-obs" id="poObs' + q + '" data-q="' + q + '" maxlength="' + MAX_OBS + '" rows="2"' + (edita ? '' : ' disabled') + '>' + esc(r.observacao || '') + '</textarea>';
      }
      return h + '</div>';
    }
    /* reavaliação: o que mudou desde a versão anterior, pelo MESMO critério que decidiu a herança */
    function avisoHeranca(q, n) {
      var a = state.atual, ant = a && a.avaliacaoAnteriorId && state.registros[a.avaliacaoAnteriorId];
      if (!ant) return '';
      var antes = q ? ant.respostas && ant.respostas[q] : ant.diagnosticos && ant.diagnosticos[n];
      if (!antes) return '';
      var agora = q ? respostaDe(q) : a.diagnosticos && a.diagnosticos[n], sit;
      try { sit = q ? situacaoResposta(antes, q, a.questionnaireContentVersion) : situacaoDiagnostico(antes, papeisDoPar(a, n), a.questionnaireContentVersion); } catch (e) { return ''; }
      var rotulo = q ? (antes.resposta === 'SIM' ? 'SIM' : 'NÃO') : (antes.rotuloNaEpoca || antes.resposta);
      if (sit === 'pergunta' && !agora) return '<p class="po-heranca po-heranca--pergunta" data-heranca="pergunta">' + (q ? 'A redação desta pergunta mudou' : 'O diagnóstico mudou (texto, rótulos ou par de papéis)') +
        ' desde a versão anterior (resposta lá: ' + esc(rotulo) + '). Responda de novo.</p>';
      if (sit === 'ajuda' && agora) return '<p class="po-heranca" data-heranca="ajuda">A ajuda ' + (q ? 'desta pergunta' : 'deste diagnóstico') + ' mudou desde a versão anterior: confira a resposta trazida.</p>';
      return '';
    }
    function renderDiagnostico(n, versao, edita) {
      var c = conteudo(DIAG, versao), d = state.atual.diagnosticos && state.atual.diagnosticos[n], v = d && d.resposta;
      var papeis = papeisDoPar(state.atual, n);
      var h = '<div class="avp-question po-diag" data-nivel="' + n + '"><div class="avp-question-head"><span class="avp-question-num">Diagnóstico</span>' +
        '<p class="avp-question-text"><strong>' + esc(c.titulo || 'Conflito ou recorte') + '</strong><br>' + esc(c.texto || '') + '</p></div>' +
        '<p class="po-diag-papeis">Papéis: ' + papeis.map(spanNome).join(' e ') + '</p>' + avisoHeranca(null, n) + renderAjuda(c);
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
      var a = state.atual, key = state.chave, ra = resultadoLido(a.resultadoAutomatico), sit = situacaoDe(key, a);
      var h = '<div class="avp-form-card" id="poResultado"><h3>' + esc(a.itemNome) + ' · v' + esc(a.versao || 1) + ' ' + (state.carregou.vig ? badgeSituacao(sit) : badge(a.status)) + '</h3>';
      if (state.flash) h += '<p class="avp-flash-success" id="poFlash">' + esc(state.flash) + '</p>';
      if (state.carregou.vig && sit === 'historica') {
        var vg = state.vigentes[a.itemId], vgr = vg && state.registros[vg];
        h += '<p class="avp-decisao-aviso po-aviso-historica" id="poHistorica">Versão histórica: substituída' + (vgr ? ' pela versão ' + esc(vgr.versao || 1) : '') + '. Só consulta — não recebe decisão nem reavaliação.' +
          (vg ? ' <button type="button" class="btn btn--sm po-abrir" data-key="' + esc(vg) + '">Abrir a vigente</button>' : '') + '</p>';
      }
      var resv = sit === 'vigente' && state.reservas[a.itemId], resr = resv && state.registros[resv];
      if (resv) h += '<div class="po-reavaliacao-info" id="poReavaliacaoAndamento"><p>Há uma reavaliação em andamento' + (resr ? ' (versão ' + esc(resr.versao || '') + ')' : '') +
        '. Esta versão continua vigente até ela ser concluída.</p><button type="button" class="btn btn--sm po-abrir" data-key="' + esc(resv) + '">' + (podeEscrever() ? 'Continuar a reavaliação' : 'Abrir a reavaliação') + '</button></div>';
      if (a.avaliacaoAnteriorId) h += '<p class="avp-ficha-meta" id="poMotivoReavaliacao">Reavaliação da versão ' + esc((a.versao || 2) - 1) + ' — motivo: ' + esc(a.motivoReavaliacao) + '</p>';
      h += '<section class="po-bloco" id="poBlocoRecomendacao"><h4 class="po-bloco-titulo">Recomendação automática</h4>';
      if (ra.codigoResultado === 'A_VALIDAR') {
        h += '<p class="po-recomendado" id="poRecomendado">Posicionamento organizacional recomendado: A validar — ' + esc(TIPO_TEXTO[ra.tipoAValidar] || ra.tipoAValidar || '') + '</p>';
        if (ra.papeisDetectados.length) h += '<p id="poPapeis">Papéis identificados: ' + ra.papeisDetectados.map(spanNome).join(', ') + '</p>';
        if (ra.nivelConfirmado) h += '<p id="poNivelConfirmado">Nível confirmado: ' + spanNome(ra.nivelConfirmado) + '</p>' + linhaNomes(ra.nivelConfirmado, a);
      } else {
        h += '<p class="po-recomendado" id="poRecomendado">Posicionamento organizacional recomendado: ' + spanNome(ra.codigoResultado) + '</p>';
        h += (P() ? P().definicaoHtml(ra.codigoResultado, 'poDefinicao', { comEstado: true }) : '') + linhaNomes(ra.codigoResultado, a);
      }
      var cods = [ra.codigoResultado, ra.nivelConfirmado].concat(ra.papeisDetectados).filter(function (c) { return c && c !== 'A_VALIDAR'; });
      if (P()) h += P().avisoHtml(cods, 'poAvisoContingencia');
      h += '<p class="po-libera" id="poLiberaSquad">' + (ra.liberaSquad ? 'Pela recomendação automática, a Adequação à Squad (S1–S8) pode ser realizada para este item. Isso não cria nem associa Squad, e não quer dizer que haverá uma Squad só para este objeto.'
        : 'Pela recomendação automática, este resultado não libera a Adequação à Squad (S1–S8).') + '</p>';
      h += '<p class="avp-intro">O1–O9 recomenda o tipo de estrutura que deve sustentar, de forma permanente, a responsabilidade associada ao objeto. A associação a uma estrutura organizacional concreta é uma etapa posterior.</p>';
      h += '<p class="avp-ficha-meta">Concluída em ' + esc(fmtData(a.concluidoEm)) + (a.concluidoPor ? ' por ' + esc(a.concluidoPor.name || a.concluidoPor.email) : '') + ' · regra ' + esc(ra.regra) + ' · motor v' + esc(ra.versaoMotor) + '</p>';
      h += renderRespostasLidas(a) + '</section>';
      h += '<section class="po-bloco" id="poBlocoDecisao"><h4 class="po-bloco-titulo">Decisão final</h4>' + renderDecisao(a, key, sit) + '</section>';
      h += '<section class="po-bloco" id="poBlocoHistorico"><h4 class="po-bloco-titulo">Histórico de versões</h4>' + renderHistorico(a, key) + '</section>';
      var podeReav = sit === 'vigente' && podeEscrever() && !resv, prontoPdf = prontoParaExportar();
      h += '<div class="avp-actions-footer po-ficha-acoes">' +
        (podeReav ? '<button type="button" class="btn" id="poReavaliarBtn"' + (state.salvando ? ' disabled' : '') + '>' + (state.salvando === 'reavaliacao' ? 'INICIANDO…' : 'Reavaliar') + '</button>' : '') +
        '<button type="button" class="btn btn--sm" id="poGerarPdfBtn"' + (!prontoPdf || state.exportando ? ' disabled' : '') + '>' +
        (state.exportando === 'pdf' ? 'Gerando arquivo…' : !prontoPdf && !state.erroDec ? 'Carregando…' : '📄 GERAR PDF') + '</button></div>' + avisoExportacao() + statusExportacao();
      h += '</div>';
      return h + rodapeVoltar();
    }
    function renderDecisao(a, key, sit) {
      if (state.erroDec) return '<p class="avp-error-msg" id="poDecisaoErroLeitura">Não foi possível ler a decisão agora.</p>';
      if (!state.carregou.dec || !state.carregou.vig) return '<p class="loading-msg" id="poDecisaoCarregando">Carregando…</p>';
      var d = state.decisoes[key], h;
      if (d) {
        h = '<p class="po-decisao-final" id="poDecisaoFinal">Posicionamento organizacional decidido: ' + spanNome(d.codigoFinal) + '</p>' +
          '<p id="poTipoDecisao">' + esc(ROTULO_TIPO_DECISAO[d.tipoDecisao] || d.tipoDecisao) + '</p>';
        if (d.nomeNaDecisao) h += '<p class="po-nome-conclusao" id="poNomeDecisao">Nome registrado na decisão: ' + esc(d.nomeNaDecisao.nome) + (d.nomeNaDecisao.contingencia ? ' <em>(rótulo de contingência — a Taxonomia não respondeu na hora)</em>' : '') + '</p>';
        if (d.justificativa) h += '<p id="poJustificativa"><strong>Justificativa:</strong> ' + esc(d.justificativa) + '</p>';
        h += '<p class="po-libera" id="poLiberaSquadDecisao">' + (d.liberaSquad ? 'Pela decisão final, a Adequação à Squad (S1–S8) pode ser realizada para este item. Isso não cria nem associa Squad.'
          : 'Pela decisão final, a Adequação à Squad (S1–S8) não é liberada para este item.') + '</p>';
        return h + '<p class="avp-ficha-meta">Decidida em ' + esc(fmtData(d.decididoEm)) + (d.decididoPor ? ' por ' + esc(d.decididoPor.name || d.decididoPor.email) : '') +
          ' · a decisão não muda; para corrigir, faça uma reavaliação.</p>';
      }
      h = '<p class="po-sem-decisao" id="poSemDecisao">Sem decisão registrada.</p>';
      if (sit !== 'vigente') return h;
      if (!podeEscrever()) return h;
      if (state.reservas[a.itemId]) return h + '<p class="avp-decisao-aviso" id="poDecisaoBloqueada" role="status">Há uma reavaliação em andamento. Conclua ou descarte essa reavaliação antes de registrar uma decisão para esta versão.</p>';
      var M = motor(), auto = a.resultadoAutomatico && a.resultadoAutomatico.codigoResultado;
      var f = state.formDecisao || (state.formDecisao = { codigo: M.CODIGOS_FIRMES.indexOf(auto) !== -1 ? auto : '', justificativa: '' });
      var salvando = state.salvando === 'decisao';
      if (auto === 'A_VALIDAR') h += '<p class="avp-decisao-aviso" id="poOrientacaoAValidar">Se houver elementos suficientes, escolha um posicionamento firme e justifique. Se ainda não houver base para decidir, use Reavaliar.</p>';
      h += '<div class="po-decisao-form" id="poDecisaoForm"><div class="avp-field"><label for="poCodigoFinal">Posicionamento final *</label><select id="poCodigoFinal" class="avp-select"' + (salvando ? ' disabled' : '') + '>' +
        '<option value="">Escolha…</option>' + M.CODIGOS_FIRMES.map(function (c) {
          return '<option value="' + esc(c) + '"' + (f.codigo === c ? ' selected' : '') + '>' + esc(nomeAtual(c)) + (c === auto ? ' — recomendação automática' : '') + '</option>';
        }).join('') + '</select></div>' +
        '<p class="avp-ficha-meta" id="poTipoPrevisto">' + textoTipoPrevisto(auto, f.codigo) + '</p>' +
        '<div class="avp-field"><label for="poJustificativaInput" id="poJustificativaRotulo">' + rotuloJustificativa(auto, f.codigo) + '</label>' +
        '<textarea id="poJustificativaInput" class="avp-observacao" rows="3" maxlength="' + MAX_JUSTIFICATIVA + '"' + (salvando ? ' disabled' : '') + '>' + esc(f.justificativa) + '</textarea></div>' +
        '<p class="avp-error-msg" id="poDecisaoErro"' + (f.erro ? '' : ' hidden') + '>' + esc(f.erro || '') + '</p>' +
        '<p class="avp-ficha-meta">A decisão não pode ser alterada depois: para corrigir, faça uma reavaliação. Só os posicionamentos firmes podem ser escolhidos (não Linha, Plataforma nem "A validar").</p>' +
        '<div class="avp-actions-footer"><button type="button" class="btn btn--primary" id="poDecidirBtn"' + (state.salvando ? ' disabled' : '') + '>' + (salvando ? 'REGISTRANDO…' : 'Registrar decisão') + '</button></div></div>';
      return h;
    }
    function textoTipoPrevisto(auto, cod) {
      if (!cod) return 'Escolha o posicionamento final.';
      var t = tipoDecisao(auto, cod);
      return esc(ROTULO_TIPO_DECISAO[t]) + (exigeJustificativa(t) ? ' — justificativa obrigatória.' : ' — justificativa opcional.');
    }
    function rotuloJustificativa(auto, cod) { return cod && exigeJustificativa(tipoDecisao(auto, cod)) ? 'Justificativa *' : 'Justificativa (opcional)'; }
    function renderHistorico(a, key) {
      var cadeia = cadeiaDoItem(a.itemId);
      var h = '<details class="avp-dados-item" id="poHistoricoVersoes"><summary>Histórico de versões — ' + cadeia.length + (cadeia.length === 1 ? ' versão' : ' versões') + '</summary><ul class="po-versoes">';
      cadeia.forEach(function (r) {
        var sit = situacaoDe(r._key, r);
        h += '<li class="po-versao' + (r._key === key ? ' po-versao--atual' : '') + '" data-key="' + esc(r._key) + '"><div><strong>v' + esc(r.versao || 1) + '</strong> ' + badgeSituacao(sit) + '</div>' +
          '<div>Recomendação automática: ' + (r.status === 'concluido' ? rotuloResultado(r.resultadoAutomatico) : '—') + '</div>' +
          '<div>Decisão final: ' + textoDecisao(r._key, r) + '</div>' +
          (r.motivoReavaliacao ? '<div class="avp-ficha-meta">Motivo da reavaliação: ' + esc(r.motivoReavaliacao) + '</div>' : '') +
          (r.motivoDescarte ? '<div class="avp-ficha-meta">Motivo do descarte: ' + esc(r.motivoDescarte) + '</div>' : '') +
          '<div class="avp-ficha-meta">' + esc(fmtData(r.concluidoEm || r.descartadoEm || r.atualizadoEm)) + '</div>' +
          (r._key === key ? '<div class="avp-ficha-meta">(esta versão)</div>' : '<button type="button" class="btn btn--sm po-abrir" data-key="' + esc(r._key) + '">Abrir</button>') + '</li>';
      });
      return h + '</ul></details>';
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
        '<p><strong>Motivo:</strong> ' + esc(a.motivoDescarte) + '</p>' + renderRespostasLidas(a) +
        (a.avaliacaoAnteriorId ? '<p class="avp-ficha-meta">Era a reavaliação (versão ' + esc(a.versao) + ') — a versão anterior continua como estava.</p>' : '') +
        '<section class="po-bloco" id="poBlocoHistorico"><h4 class="po-bloco-titulo">Histórico de versões</h4>' + renderHistorico(a, state.chave) + '</section></div>' + rodapeVoltar();
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
      var hist = byId('poMostrarHistorico'); if (hist) hist.addEventListener('change', function () { state.mostrarHistorico = hist.checked; render(); });
      var reav = byId('poReavaliarBtn'); if (reav) reav.addEventListener('click', pedirReavaliacao);
      var exp = byId('poExportarBtn'); if (exp) exp.addEventListener('click', function () { state.menuExportarAberto = !state.menuExportarAberto; render(); });
      var exL = byId('poExportarExcelLista'); if (exL) exL.addEventListener('click', function () { exportarExcel('lista'); });
      var exT = byId('poExportarExcelTodas'); if (exT) exT.addEventListener('click', function () { exportarExcel('todas'); });
      var pdf = byId('poGerarPdfBtn'); if (pdf) pdf.addEventListener('click', exportarPdf);
      var cod = byId('poCodigoFinal');
      if (cod) cod.addEventListener('change', function () {
        var f = state.formDecisao, auto = state.atual.resultadoAutomatico && state.atual.resultadoAutomatico.codigoResultado;
        f.codigo = cod.value; f.erro = null;
        /* atualiza só os textos que dependem do código: a justificativa digitada fica onde está */
        byId('poTipoPrevisto').innerHTML = textoTipoPrevisto(auto, f.codigo);
        byId('poJustificativaRotulo').textContent = rotuloJustificativa(auto, f.codigo);
        byId('poDecisaoErro').hidden = true;
      });
      var just = byId('poJustificativaInput'); if (just) just.addEventListener('input', function () { state.formDecisao.justificativa = just.value.slice(0, MAX_JUSTIFICATIVA); });
      var dec = byId('poDecidirBtn'); if (dec) dec.addEventListener('click', pedirDecisao);
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

    /* ---- decisão humana: uma por versão, só da vigente, sem reavaliação em andamento ---- */
    function erroDecisao(msg) { state.formDecisao.erro = msg; var e = byId('poDecisaoErro'); if (e) { e.textContent = msg; e.hidden = false; } }
    function pedirDecisao() {
      if (!podeEscrever() || state.salvando || state.tela !== 'resultado') return;
      var a = state.atual, f = state.formDecisao, auto = a.resultadoAutomatico && a.resultadoAutomatico.codigoResultado;
      if (!f || !f.codigo) { erroDecisao('Escolha o posicionamento final.'); return; }
      var tipo = tipoDecisao(auto, f.codigo);
      if (exigeJustificativa(tipo) && emBranco(f.justificativa)) { erroDecisao('Informe a justificativa: ela é obrigatória para ' + (tipo === 'DIVERGENCIA' ? 'divergir da recomendação automática.' : 'resolver um "A validar".')); return; }
      if (state.reservas[a.itemId]) { render(); return; }
      var libera = motor().liberaSquadParaCodigoFirme(f.codigo);
      modal('<h4>Registrar a decisão?</h4><p>Posicionamento final: <strong>' + esc(nomeAtual(f.codigo)) + '</strong> (' + esc(ROTULO_TIPO_DECISAO[tipo]) + ').</p>' +
        '<p id="poModalLiberaSquad">' + (libera ? 'Pela decisão final, a Adequação à Squad (S1–S8) poderá ser realizada para este item (isso não cria nem associa Squad).'
          : 'Pela decisão final, a Adequação à Squad (S1–S8) não será liberada para este item.') + '</p>' +
        '<p>A decisão não pode ser alterada nem apagada depois. Para corrigir, faça uma reavaliação.</p>',
        { sim: 'Registrar', nao: 'Cancelar', aoSim: function () { decidir(f.codigo, f.justificativa); return null; } });
    }
    function decidir(codigo, justificativa) {
      var usuario = sessaoAtual(); if (!usuario) return;
      var key = state.chave, a = state.atual, payload;
      try { payload = payloadDecisao({ id: key, reg: a, codigoFinal: codigo, justificativa: justificativa, usuario: usuario, agora: agoraIso(), audId: novaChave(AUD + '/' + key) }); }
      catch (e) { erroDecisao('Não foi possível montar a decisão. Confira o posicionamento e a justificativa.'); return; }
      state.salvando = 'decisao'; render();
      gravar(payload, function () {
        state.salvando = null; state.decisoes[key] = payload[DEC + '/' + key]; state.formDecisao = null;
        state.flash = '✓ Decisão registrada.'; render();
      }, function (err) {
        /* por que não entrou? quem chegou antes: outra decisão ou uma reavaliação */
        Promise.all([db().ref(DEC + '/' + key).once('value'), db().ref(RES + '/' + a.itemId).once('value')]).then(function (r) {
          state.salvando = null;
          if (r[0].val()) { state.decisoes[key] = r[0].val(); state.formDecisao = null; render(); aviso('Já havia uma decisão registrada para esta versão: ela foi mantida.'); return; }
          if (r[1].val()) { state.reservas[a.itemId] = r[1].val(); render(); aviso('Há uma reavaliação em andamento. Conclua ou descarte essa reavaliação antes de registrar uma decisão para esta versão.'); return; }
          render();
          aviso(err === 'sem-resposta' ? 'A conexão está demorando e não deu para confirmar a decisão. Confira a ficha antes de tentar de novo.' : 'Não foi possível registrar a decisão. Tente novamente.');
        }).catch(function () { state.salvando = null; render(); aviso('Não foi possível registrar a decisão. Tente novamente.'); });
      });
    }
    /* ---- reavaliação: versão seguinte da vigente; a vigente fica até a nova ser concluída ---- */
    function pedirReavaliacao() {
      if (!podeEscrever() || state.salvando) return;
      var a = state.atual, key = state.chave;
      if (state.vigentes[a.itemId] !== key) return;
      if (state.reservas[a.itemId]) { irParaChave(state.reservas[a.itemId]); return; }
      var it = itensAvaliaveis().filter(function (x) { return x.itemId === a.itemId; })[0];
      if (!it) { aviso('Este item não tem Avaliação de Produto/Serviço concluída: não pode ser reavaliado agora.'); return; }
      if (!window.faQuestionarios.configCarregada(QCOD)) { aviso('O questionário ainda está carregando. Tente de novo em instantes.'); return; }
      modal('<h4>Reavaliar este posicionamento?</h4><p>Cria a versão ' + esc((a.versao || 1) + 1) + ' como rascunho, com as respostas desta versão já preenchidas (pergunta cuja redação mudou precisa ser respondida de novo).</p>' +
        '<p>Esta versão continua vigente até a nova ser concluída. Descartar a reavaliação não muda nada nela.</p>' +
        '<label for="poMotivoReavaliacaoInput">Motivo *</label><textarea id="poMotivoReavaliacaoInput" rows="3" maxlength="' + MAX_MOTIVO + '"></textarea>',
        { sim: 'Reavaliar', nao: 'Cancelar', aoSim: function (box) {
          var motivo = String(box.querySelector('#poMotivoReavaliacaoInput').value || '').trim();
          if (!motivo) return 'Informe o motivo da reavaliação.';
          if (motivo.length > MAX_MOTIVO) return 'O motivo pode ter até ' + MAX_MOTIVO + ' caracteres.';
          iniciarReavaliacao(it, key, motivo);
          return null;
        } });
    }
    function iniciarReavaliacao(it, anteriorId, motivo) {
      var usuario = sessaoAtual(); if (!usuario) return;
      var id = novaChave(NODE), audId = novaChave(AUD + '/' + id), payload;
      try {
        payload = payloadReavaliacao({ id: id, audId: audId, anteriorId: anteriorId, anterior: clone(state.registros[anteriorId]), itemNome: it.nome,
          avaliacaoArquiteturalId: it.avaliacaoArquiteturalId, versao: window.faQuestionarios.versaoAtual(QCOD), motivo: motivo, usuario: usuario, agora: agoraIso() });
      } catch (e) {
        /* sem o critério de reavaliação não se monta nada (nunca herda resposta sem saber se a pergunta mudou) */
        aviso('Não foi possível preparar a reavaliação agora. Recarregue a página e tente de novo.'); return;
      }
      state.salvando = 'reavaliacao'; render();
      gravar(payload, function () {
        state.salvando = null;
        state.registros[id] = payload[NODE + '/' + id];
        state.reservas[it.itemId] = id;
        irParaChave(id);
        state.flash = 'Reavaliação iniciada. A versão anterior continua vigente até esta ser concluída.'; render();
      }, function (err) {
        db().ref(RES + '/' + it.itemId).once('value').then(function (s) {
          state.salvando = null;
          var outro = s.val();
          if (outro && outro !== id) { state.reservas[it.itemId] = outro; render(); aviso('Outra pessoa iniciou uma reavaliação deste item ao mesmo tempo: abra-a pela ficha.'); return; }
          render();
          aviso(err === 'sem-resposta' ? 'A conexão está demorando e não deu para confirmar a reavaliação. Confira a ficha antes de tentar de novo.' : 'Não foi possível iniciar a reavaliação. Tente novamente.');
        }).catch(function () { state.salvando = null; render(); aviso('Não foi possível iniciar a reavaliação. Tente novamente.'); });
      });
    }

    /* ---- exportação: lê a trilha na hora (com limite), monta pelo módulo puro e baixa ---- */
    function E() { return window.faExportacoesPosicionamento; }
    function carregarScript(src, jaDisponivel, cb) {
      if (jaDisponivel()) { cb(); return; }
      var existente = document.querySelector('script[data-avp-lib="' + src + '"]');
      if (existente) { existente.addEventListener('load', function () { cb(); }); existente.addEventListener('error', function () { cb(new Error('Falha ao carregar ' + src)); }); return; }
      var s = document.createElement('script');
      s.src = src; s.setAttribute('data-avp-lib', src);
      s.onload = function () { cb(); };
      s.onerror = function () { cb(new Error('Falha ao carregar ' + src)); };
      document.head.appendChild(s);
    }
    /* Trilha: falha ou demora (TEMPO_TRILHA) → { ok: false } — o arquivo sai com "Trilha indisponível", nunca "sem eventos" */
    var TEMPO_TRILHA = 6000;
    function lerTrilha(caminho, cb) {
      var feito = false;
      var relogio = setTimeout(function () { if (feito) return; feito = true; cb({ ok: false }); }, TEMPO_TRILHA);
      function fim(r) { if (feito) return; feito = true; clearTimeout(relogio); cb(r); }
      try { db().ref(caminho).once('value').then(function (s) { fim({ ok: true, valor: s.val() || {} }); }, function () { fim({ ok: false }); }); }
      catch (e) { fim({ ok: false }); }
    }
    function nomesAtuais() {
      var out = {}, M = motor();
      (M ? M.CODIGOS_INTERMEDIARIOS.concat(M.CODIGOS_FIRMES) : []).forEach(function (c) { out[c] = { nome: nomeAtual(c), contingencia: !!(P() && P().usandoContingencia(c)) }; });
      return out;
    }
    function contextoExportacao(trilha) {
      return { registros: clone(state.registros), decisoes: clone(state.decisoes), decisoesConhecidas: prontoParaExportar(), vigentes: clone(state.vigentes),
        produtos: state.produtos, nomesAtuais: nomesAtuais(), trilha: trilha, geradoEm: agoraIso(),
        textoQuestionario: function (codigo, versao) { return conteudo(codigo, versao); } };
    }
    function terminarExportacao(erro, origem) {
      state.exportando = null;
      state.flashExportacao = erro ? { erro: true, texto: 'Não foi possível gerar o arquivo. Tente novamente.' } : { erro: false, texto: 'Arquivo gerado com sucesso.' };
      if (erro) console.error('[avaliacao-posicionamento] erro ao exportar ' + origem + ':', erro);
      render();
    }
    function exportarPdf() {
      if (state.exportando || !prontoParaExportar() || state.tela !== 'resultado' || !E()) return;
      var id = state.chave;
      if (!window.faPdfEmBlocos) { terminarExportacao(new Error('Motor de PDF indisponível.'), 'PDF'); return; }
      state.exportando = 'pdf'; state.flashExportacao = null; render();
      lerTrilha(AUD + '/' + id, function (t) {
        var por = {}; if (t.ok) por[id] = t.valor;
        var ctx, atomos;
        try { ctx = contextoExportacao({ ok: t.ok, porAvaliacao: por }); atomos = E().atomosPdf(id, ctx); }
        catch (e) { terminarExportacao(e, 'PDF'); return; }
        window.faPdfEmBlocos.gerar({
          nomeArquivo: E().nomeArquivoPdf(id, ctx, ctx.geradoEm),
          planejar: function (medidor) { return window.faPdfEmBlocos.planejar([atomos], medidor, function (html) { return E().documentoPdf(html, false); }); },
          envolver: function (bloco, indice) { return E().documentoPdf(bloco, indice === 0, ctx.geradoEm); }
        }, function (erro) { terminarExportacao(erro, 'PDF'); });
      });
    }
    function exportarExcel(escopo) {
      if (state.exportando || !prontoParaExportar() || !E()) return;
      var conj = conjuntosDaLista(), ids = (escopo === 'todas' ? conj.todas : conj.lista).map(function (r) { return r._key; });
      state.menuExportarAberto = false; state.exportando = 'excel'; state.flashExportacao = null; render();
      lerTrilha(AUD, function (t) {
        carregarScript('forca-agil/xlsx.mini.min.js', function () { return !!window.XLSX; }, function (erroCarga) {
          if (erroCarga) { terminarExportacao(erroCarga, 'Excel'); return; }
          try {
            var X = window.XLSX, ctx = contextoExportacao({ ok: t.ok, porAvaliacao: t.ok ? t.valor : {} }), wb = X.utils.book_new();
            E().abasExcel(ids, ctx).forEach(function (a) {
              var ws = X.utils.aoa_to_sheet([a.cabecalho].concat(a.linhas));
              ws['!cols'] = a.larguras.map(function (w) { return { wch: w }; });
              ws['!autofilter'] = { ref: X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: a.linhas.length, c: a.cabecalho.length - 1 } }) };
              X.utils.book_append_sheet(wb, ws, a.nome);
            });
            X.writeFile(wb, E().nomeArquivoExcel(escopo === 'todas' ? 'Todas' : 'Lista_atual', ctx.geradoEm), { cellDates: true });
            terminarExportacao(null, 'Excel');
          } catch (e) { terminarExportacao(e, 'Excel'); }
        });
      });
    }

    /* ===================== LEITURAS AO VIVO ===================== */
    var ouvintes = [];
    function ouvir(caminho, chaveCarga, aplicar) {
      var ref = db().ref(caminho);
      var cb = function (snap) { aplicar(snap.val() || {}); state.carregou[chaveCarga] = true; aoChegar(chaveCarga); };
      var erro = function (e) {
        console.error('[avaliacao-posicionamento] não foi possível ler ' + caminho + ':', e); state.carregou[chaveCarga] = true;
        if (chaveCarga === 'av') state.erroLeitura = true;
        if (chaveCarga === 'dec') state.erroDec = true; /* leitura recusada não é "sem decisão" */
        aoChegar(chaveCarga);
      };
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
      ouvir(DEC, 'dec', function (v) { state.decisoes = v; state.erroDec = false; });
      if (window.faQuestionarios) window.faQuestionarios.onMudanca(QCOD, function () { if (!wrap.hidden && !(state.tela === 'checklist' && state.sujo)) render(); });
      if (P()) P().onMudanca(function () {
        if (wrap.hidden) return;
        P().atualizarDom(wrap);
        /* as opções do seletor da decisão são texto puro: o nome que chegou da Taxonomia entra nelas no lugar */
        var sel = byId('poCodigoFinal'), auto = state.atual && state.atual.resultadoAutomatico && state.atual.resultadoAutomatico.codigoResultado;
        if (sel) Array.prototype.forEach.call(sel.options, function (o) { if (o.value) o.textContent = nomeAtual(o.value) + (o.value === auto ? ' — recomendação automática' : ''); });
      });
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
  /* Carga direta em #avaliacoes?po=… (F5, link, Voltar/Avançar que atravessa um F5): em máquina lenta o roteador
     pode abrir a página antes de este arquivo carregar, e aí ninguém o monta — monta-se sozinho. */
  if (/^#avaliacoes\?(.*&)?po=/.test(location.hash || '')) window.faInitAvaliacaoPosicionamento();
})();
