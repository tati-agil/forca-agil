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
  /* H1-Final: o caminho e o resultado vêm do NÚCLEO declarativo (motor-posicionamento-nucleo.js), com a definição
     da versão do motor DO REGISTRO — reg.versaoMotor; ausente = 1 (todo registro anterior ao campo é v1, e
     continua v1 mesmo quando outra versão entrar em vigor). A v1 do núcleo é idêntica ao motor legado nos 531.441
     estados (teste-motor-posicionamento-nucleo.js); a v2 está inativa — nada aqui cria registro v2 (criar e
     reavaliar gravam sem versaoMotor, e o banco ainda recusa o campo: só o H2 abre essa porta). */
  function nucleo() { return window.faMotorPosicionamentoNucleo; }
  function versaoMotorDo(reg) { return reg && typeof reg.versaoMotor === 'number' ? reg.versaoMotor : 1; }
  function definicaoDo(reg) { return nucleo().definicao(versaoMotorDo(reg)); }
  /* H3-a: a identificação das versões usadas por uma classificação (motor e redação) — para a ficha, a lista e o
     histórico; registro sem versaoMotor é v1 (nada é regravado para mostrar isso) */
  function textoVersoes(reg) {
    var v = reg && reg.questionnaireContentVersion;
    return 'motor v' + versaoMotorDo(reg) + ' · redação v' + (typeof v === 'number' ? v : '—');
  }
  function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function simples(reg) {
    var r = {}, d = {}, p = {};
    Object.keys((reg && reg.respostas) || {}).forEach(function (q) { var v = reg.respostas[q] && reg.respostas[q].resposta; if (v === 'SIM' || v === 'NAO') r[q] = v; });
    Object.keys((reg && reg.diagnosticos) || {}).forEach(function (n) { var v = reg.diagnosticos[n] && reg.diagnosticos[n].resposta; if (v === 'mesma' || v === 'distintas') d[n] = v; });
    Object.keys((reg && reg.predominancias) || {}).forEach(function (n) { var v = reg.predominancias[n] && reg.predominancias[n].resposta; if (typeof v === 'string' && v) p[n] = v; });
    return { respostas: r, diagnosticos: d, predominancias: p };
  }
  function avaliar(reg) { var s = simples(reg); return nucleo().avaliar(definicaoDo(reg), s.respostas, s.diagnosticos, s.predominancias); }
  function caminho(reg) { var s = simples(reg); return nucleo().perguntasDoCaminho(definicaoDo(reg), s.respostas, s.diagnosticos, s.predominancias); }
  function simsDoNivel(reg, n) { var s = simples(reg).respostas; return NIVEIS[n].filter(function (q) { return s[q] === 'SIM'; }); }
  /* o diagnóstico do nível n faz parte da avaliação: nível alcançado, completo e com os SIM que a versão do motor
     exige (v1: exatamente 2; v2: 2 ou mais) */
  function diagnosticoNecessario(reg, n) {
    var s = simples(reg);
    return nucleo().diagnosticosNecessarios(definicaoDo(reg), s.respostas, s.diagnosticos, s.predominancias).indexOf(n) !== -1;
  }
  /* D2 (só em versão de motor com predominância): o nível e as opções que a tela pode oferecer, ou null */
  function predominanciaNecessaria(reg, n) {
    var s = simples(reg);
    return nucleo().predominanciasNecessarias(definicaoDo(reg), s.respostas, s.diagnosticos, s.predominancias).filter(function (x) { return x.nivel === n; })[0] || null;
  }
  function papeisDoPar(reg, n) { return simsDoNivel(reg, n).map(function (q) { return PAPEL[q]; }); }
  /* Tira da avaliação tudo o que não está no caminho: respostas (com as observações delas) e diagnósticos
     que deixaram de ser exigidos ou cujo par de papéis mudou. Devolve o que saiu, para o aviso. */
  function limparForaDoCaminho(reg) {
    var novo = clone(reg) || {}, removidas = [], obsRemovidas = [], diagsRemovidos = [], predsRemovidas = [];
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
      Object.keys(novo.predominancias || {}).forEach(function (n) {
        var p = novo.predominancias[n], pn = predominanciaNecessaria(novo, n);
        if (pn && pn.opcoes.indexOf(p && p.resposta) !== -1 && JSON.stringify(p.papeis || []) === JSON.stringify(papeisDoPar(novo, n))) return;
        predsRemovidas.push(n);
        if (p && p.observacao) obsRemovidas.push(n);
        delete novo.predominancias[n]; mudou = true;
      });
      if (!mudou) break;
    }
    if (novo.respostas && !Object.keys(novo.respostas).length) delete novo.respostas;
    if (novo.diagnosticos && !Object.keys(novo.diagnosticos).length) delete novo.diagnosticos;
    if (novo.predominancias && !Object.keys(novo.predominancias).length) delete novo.predominancias;
    return { reg: novo, removidas: removidas, obsRemovidas: obsRemovidas, diagsRemovidos: diagsRemovidos, predsRemovidas: predsRemovidas };
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
    if (/_PREDOMINANCIA_PENDENTE$/.test(r.regra)) {
      var np = r.regra.slice(0, 2);
      return { texto: 'Falta responder a predominância do Nível ' + np.slice(1), predominancia: np };
    }
    if (r.regra === 'DEF_SIM_FORA_DO_CAMINHO') return { texto: 'Há resposta fora do caminho: revise as respostas' };
    return null;
  }
  function textoLimitado(s, n) { return typeof s === 'string' && s ? s.slice(0, n) : null; }
  function semVazios(o) { Object.keys(o).forEach(function (k) { if (o[k] === null || o[k] === undefined || o[k] === '') delete o[k]; }); return o; }
  /* a redação de uma pergunta na versão do questionário — da trilha do motor do registro. v1: o questionário de
     sempre; versão ≥ 2: só a redação publicada para aquele motor, SEM fallback (ausente = null; a tela trava). */
  function conteudoMotor(q, versao, versaoMotor) {
    var Q = window.faQuestionarios;
    if (!versaoMotor || versaoMotor === 1) return Q.conteudoPergunta(QCOD, q, versao) || {};
    return (typeof Q.conteudoPerguntaMotor === 'function' && Q.conteudoPerguntaMotor(QCOD, versaoMotor, q, versao)) || null;
  }
  function conteudo(q, versao, versaoMotor) { return conteudoMotor(q, versao, versaoMotor) || {}; }
  /* a redação de TUDO o que a versão do motor pede existe? (v1: sempre; v2: o contrato inteiro do núcleo) */
  function redacaoDisponivel(reg) {
    var vm = versaoMotorDo(reg);
    if (vm === 1) return true;
    return nucleo().contratoDoQuestionario(nucleo().definicao(vm)).itens.every(function (it) { return !!conteudoMotor(it.codigoEstavel, reg.questionnaireContentVersion, vm); });
  }
  function snapshotResposta(q, v, versao, observacao, agora, versaoMotor) {
    var c = conteudo(q, versao, versaoMotor);
    return semVazios({ resposta: v, codigoPergunta: q, tituloNaEpoca: textoLimitado(c.titulo, 400), textoPerguntaNaEpoca: textoLimitado(c.texto, 4000),
      interpretacaoNaEpoca: textoLimitado(v === 'SIM' ? c.justSim : c.justNao, 4000), observacao: textoLimitado(observacao, MAX_OBS),
      questionnaireContentVersion: versao, dataResposta: agora });
  }
  function snapshotDiagnostico(v, papeis, versao, observacao, agora, versaoMotor) {
    var c = conteudo(DIAG, versao, versaoMotor);
    return semVazios({ resposta: v, papeis: papeis.slice(), tituloNaEpoca: textoLimitado(c.titulo, 400), textoPerguntaNaEpoca: textoLimitado(c.texto, 4000),
      rotuloNaEpoca: textoLimitado(v === 'mesma' ? c.rotuloMesma : c.rotuloDistintas, 400),
      interpretacaoNaEpoca: textoLimitado(v === 'mesma' ? c.interpretacaoMesma : c.interpretacaoDistintas, 4000),
      observacao: textoLimitado(observacao, MAX_OBS), questionnaireContentVersion: versao, dataResposta: agora });
  }  /* D2: a resposta é o CÓDIGO da opção (fixo, do núcleo); rótulo e interpretação são a redação da época */
  function snapshotPredominancia(n, v, papeis, versao, observacao, agora, versaoMotor) {
    var c = conteudo(nucleo().D2_POR_NIVEL[n], versao, versaoMotor);
    var op = (c.opcoes || []).filter(function (o) { return o.codigo === v; })[0] || {};
    return semVazios({ resposta: v, papeis: papeis.slice(), tituloNaEpoca: textoLimitado(c.titulo, 400), textoPerguntaNaEpoca: textoLimitado(c.texto, 4000),
      rotuloNaEpoca: textoLimitado(op.rotulo, 400), interpretacaoNaEpoca: textoLimitado(op.interpretacao, 4000),
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
    if (r.predominancias && !Object.keys(r.predominancias).length) delete r.predominancias;
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
    var M = nucleo(), ra = o.reg.resultadoAutomatico || {}, Pz = window.faPosicionamentos;
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
  function situacaoResposta(resp, q, versaoNova, vm) {
    var C = criterio();
    if (!resp || !resp.resposta) return null;
    var vr = resp.questionnaireContentVersion || null;
    if (vr === versaoNova) return null;
    var antes = vr ? conteudo(q, vr, vm) : null, agora = conteudo(q, versaoNova, vm);
    return C.situacao(resp.textoPerguntaNaEpoca || (antes && antes.texto) || null, antes, agora);
  }
  /* Diagnóstico: herda só se o par de papéis é o mesmo E texto, rótulo "mesma" e rótulo "distintas" não mudaram;
     mudou só ajuda/interpretação → 'ajuda'. */
  var CAMPOS_DIAG_PERGUNTA = ['texto', 'rotuloMesma', 'rotuloDistintas'];
  function situacaoDiagnostico(diag, papeisAgora, versaoNova, vm) {
    var C = criterio();
    if (!diag || !diag.resposta) return null;
    if (JSON.stringify(diag.papeis || []) !== JSON.stringify(papeisAgora || [])) return 'pergunta';
    var vr = diag.questionnaireContentVersion || null;
    if (vr === versaoNova) return null;
    if (!vr) return 'pergunta';
    var antes = conteudo(DIAG, vr, vm), agora = conteudo(DIAG, versaoNova, vm);
    if (!diag.textoPerguntaNaEpoca || !C.mesmoConteudo(diag.textoPerguntaNaEpoca, agora.texto)) return 'pergunta';
    if (CAMPOS_DIAG_PERGUNTA.some(function (k) { return !C.mesmoConteudo(antes[k], agora[k]); })) return 'pergunta';
    var ajuda = C.CAMPOS_AJUDA_COMPARADOS.concat(['interpretacaoMesma', 'interpretacaoDistintas']);
    return ajuda.some(function (k) { return !C.mesmoConteudo(antes[k], agora[k]); }) ? 'ajuda' : null;
  }
  /* o: { id, audId, anteriorId, anterior (registro vigente), itemNome, avaliacaoArquiteturalId (a Avaliação de Produto
     concluída mais recente do item), versao (questionário vigente agora), motivo, usuario, agora } */
  function payloadReavaliacao(o) {
    criterio();
    /* H3-a: reavaliar não troca a versão do motor — um registro v2 reavaliado continua v2 (nunca volta a v1); a D2 nunca
       é herdada (só respostas e D1), e a decisão humana fica na versão anterior */
    var ant = o.anterior || {}, vn = o.versao, respostas = {}, diagnosticos = {}, vm = versaoMotorDo(ant);
    Object.keys(ant.respostas || {}).forEach(function (q) {
      var r = ant.respostas[q];
      if (!r || (r.resposta !== 'SIM' && r.resposta !== 'NAO') || situacaoResposta(r, q, vn, vm) === 'pergunta') return;
      respostas[q] = snapshotResposta(q, r.resposta, vn, r.observacao, r.dataResposta || o.agora, vm);
    });
    var reg = { itemId: ant.itemId, itemNome: String(o.itemNome || ant.itemNome || ant.itemId).slice(0, 200), avaliacaoArquiteturalId: o.avaliacaoArquiteturalId,
      questionarioCodigo: QCOD, questionnaireContentVersion: vn, versao: (ant.versao || 1) + 1, avaliacaoAnteriorId: o.anteriorId,
      motivoReavaliacao: String(o.motivo || '').slice(0, MAX_MOTIVO), status: 'rascunho', revisao: 1, criadoPor: o.usuario, criadoEm: o.agora,
      atualizadoPor: o.usuario, atualizadoEm: o.agora, auditoriaCriacaoId: o.audId };
    if (vm !== 1) reg.versaoMotor = vm;
    if (Object.keys(respostas).length) reg.respostas = respostas;
    ORDEM_NIVEIS.forEach(function (n) {
      var d = ant.diagnosticos && ant.diagnosticos[n];
      if (!d || !diagnosticoNecessario(reg, n)) return;
      var papeis = papeisDoPar(reg, n);
      if (situacaoDiagnostico(d, papeis, vn, vm) === 'pergunta') return;
      diagnosticos[n] = snapshotDiagnostico(d.resposta, papeis, vn, d.observacao, d.dataResposta || o.agora, vm);
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
  /* H3-a — "Atualizar com motor atual" (DORMENTE: só é oferecido quando a versão em vigor do motor é maior que a do
     registro, o que hoje nunca acontece — a v1 está em vigor). Cria a vN+1 no motor de destino, com
     origemReavaliacao 'motor'. A herança é a da governança (faGovernancaPosicionamento.herdarEntreVersoes): só o que é
     comprovadamente a mesma pergunta com os mesmos critérios; D1 recalculada no destino; D2 e decisão nunca herdadas.
     o: { id, audId, anteriorId, anterior, itemNome, avaliacaoArquiteturalId, versaoMotorDestino, versaoRedacaoDestino,
          motivo, usuario, agora } */
  function payloadAtualizacaoMotor(o) {
    var C = criterio(), G = window.faGovernancaPosicionamento;
    if (!G) throw new Error('governanca-indisponivel');
    var ant = o.anterior || {}, vo = versaoMotorDo(ant), vd = o.versaoMotorDestino, vr = o.versaoRedacaoDestino;
    if (!(vd > vo)) throw new Error('destino-nao-e-mais-novo');
    var defD = nucleo().definicao(vd);
    var h = G.herdarEntreVersoes(nucleo(), { origem: { def: nucleo().definicao(vo), reg: ant }, destino: { def: defD },
      conteudoOrigem: function (c, v) { return conteudoMotor(c, v, vo); }, conteudoDestino: function (c) { return conteudoMotor(c, vr, vd); },
      mesmoConteudo: C.mesmoConteudo });
    var reg = { itemId: ant.itemId, itemNome: String(o.itemNome || ant.itemNome || ant.itemId).slice(0, 200), avaliacaoArquiteturalId: o.avaliacaoArquiteturalId,
      questionarioCodigo: QCOD, questionnaireContentVersion: vr, versao: (ant.versao || 1) + 1, avaliacaoAnteriorId: o.anteriorId, origemReavaliacao: 'motor',
      motivoReavaliacao: String(o.motivo || '').slice(0, MAX_MOTIVO), status: 'rascunho', revisao: 1, criadoPor: o.usuario, criadoEm: o.agora,
      atualizadoPor: o.usuario, atualizadoEm: o.agora, auditoriaCriacaoId: o.audId };
    if (vd !== 1) reg.versaoMotor = vd;
    var respostas = {}, diagnosticos = {};
    Object.keys(h.respostas).forEach(function (q) { var r = h.respostas[q]; respostas[q] = snapshotResposta(q, r.resposta, vr, r.observacao, r.dataResposta || o.agora, vd); });
    if (Object.keys(respostas).length) reg.respostas = respostas;
    Object.keys(h.diagnosticos).forEach(function (n) { var d = h.diagnosticos[n]; diagnosticos[n] = snapshotDiagnostico(d.resposta, papeisDoPar(reg, n), vr, d.observacao, d.dataResposta || o.agora, vd); });
    if (Object.keys(diagnosticos).length) reg.diagnosticos = diagnosticos;
    reg = limparForaDoCaminho(reg).reg;
    var p = {};
    p[NODE + '/' + o.id] = reg;
    p[RES + '/' + reg.itemId] = o.id;
    p[AUD + '/' + o.id + '/' + o.audId] = { tipo: 'criacao', itemId: reg.itemId, avaliacaoArquiteturalId: o.avaliacaoArquiteturalId, avaliacaoAnteriorId: o.anteriorId,
      motivo: reg.motivoReavaliacao, origemReavaliacao: 'motor', versaoMotorAnterior: vo, versaoMotor: vd, usuario: o.usuario, dataHora: o.agora };
    return { payload: p, novas: h.novas };
  }
  /* a atualização só existe quando há motor em vigor MAIS NOVO que o do registro e a redação publicada dele */
  function atualizacaoDisponivel(reg) {
    var vd = nucleo().versaoEmVigor(), vo = versaoMotorDo(reg), Q = window.faQuestionarios;
    if (!(vd > vo)) return null;
    var sit = typeof Q.situacaoConteudoMotor === 'function' ? Q.situacaoConteudoMotor(QCOD, vd) : null;
    if (!sit || !sit.versaoPublicada) return null;
    return { de: vo, para: vd, versaoRedacao: sit.versaoPublicada };
  }
  /* ---- GATE P1–P16 → O1–O9 (puro): iniciar ou reavaliar só sobre a Avaliação de Produto/Serviço que VALE para o
     item — a ponta da cadeia, concluída e não excluída (faBaseProdutoServico.baseDoItem, a mesma regra da lista de
     Produto/Serviço) — e com Motor atual (situacaoMotorDe, a mesma de diagnosticoMotor). Só 'atual' libera:
     'verificando' (o motor ainda não chegou) e 'equivalente' (falta reconciliar) bloqueiam. Nenhuma lógica de
     Produto/Serviço é repetida aqui. B = faBaseProdutoServico, ctx = o contexto do motor; sem B, bloqueia. */
  function gateDoItem(itemId, produtos, B, ctx) {
    if (!B || !ctx) return { libera: false, situacao: 'verificando', chave: null };
    var base = B.baseDoItem(itemId, produtos);
    if (base.situacao !== 'valida') return { libera: false, situacao: base.situacao, chave: base.chave || null };
    var m = B.situacaoMotorDe(base.avaliacao, ctx);
    var s = m ? m.situacao : 'verificando';
    return { libera: s === 'atual', situacao: s, chave: base.chave, avaliacao: base.avaliacao, motivo: (m && m.motivo) || null };
  }
  var ROTULO_GATE = {
    verificando: 'Verificando motor…', desatualizado: 'Motor de P1–P16 desatualizado', equivalente: 'P1–P16 a reconciliar',
    'reavaliacao-em-andamento': 'Reavaliação de P1–P16 em andamento', excluida: 'P1–P16 excluída', 'nao-concluida': 'P1–P16 não concluída',
    'sem-avaliacao': 'Sem Avaliação de Produto/Serviço', indefinida: 'Versão de P1–P16 não resolvida'
  };
  /* acao: 'iniciar' | 'reavaliar' */
  function textoGate(situacao, acao) {
    var fim = ' antes de ' + (acao === 'reavaliar' || acao === 'concluir' ? acao : 'iniciar') + ' o Posicionamento Organizacional.';
    switch (situacao) {
      case 'verificando': return 'Verificando a versão do motor da Avaliação de Produto/Serviço…';
      case 'desatualizado': return 'Motor da Avaliação de Produto/Serviço desatualizado. Atualize P1–P16' + fim;
      case 'equivalente': return 'A Avaliação de Produto/Serviço deste item foi calculada por uma versão anterior do motor, logicamente equivalente à atual, ' +
        'mas ainda não reconciliada. Reconcilie-a em Produto/Serviço, para que fique formalmente com Motor atual,' + fim;
      case 'reavaliacao-em-andamento': return 'Existe uma versão mais nova da Avaliação de Produto/Serviço deste item em andamento (reavaliação de P1–P16). ' +
        'Conclua ou resolva essa versão em Produto/Serviço' + fim;
      case 'excluida': return 'A versão mais recente da Avaliação de Produto/Serviço deste item está excluída (na Lixeira). Restaure-a ou resolva em Produto/Serviço' + fim;
      case 'nao-concluida': return 'A Avaliação de Produto/Serviço deste item ainda não foi concluída. Conclua P1–P16' + fim;
      case 'sem-avaliacao': return 'Este item não tem Avaliação de Produto/Serviço. Avalie P1–P16' + fim;
      case 'base-mudou': return 'A Avaliação de Produto/Serviço que vale hoje para este item não é a usada neste rascunho (existe uma versão mais nova). ' +
        'Para não trocar a base em silêncio, este rascunho não pode ser concluído: descarte-o e inicie um novo Posicionamento sobre a versão atual.';
      case 'indefinida': return 'Não foi possível determinar qual versão da Avaliação de Produto/Serviço deste item é a vigente: há mais de uma versão mais recente. ' +
        'Resolva em Produto/Serviço' + fim;
      default: return '';
    }
  }

  window.faAvaliacaoPosicionamentoNucleo = {
    gateDoItem: gateDoItem, textoGate: textoGate, ROTULO_GATE: ROTULO_GATE,
    simples: simples, avaliar: avaliar, caminho: caminho, diagnosticoNecessario: diagnosticoNecessario, papeisDoPar: papeisDoPar,
    predominanciaNecessaria: predominanciaNecessaria, versaoMotorDo: versaoMotorDo, textoVersoes: textoVersoes, payloadAtualizacaoMotor: payloadAtualizacaoMotor, atualizacaoDisponivel: atualizacaoDisponivel, redacaoDisponivel: redacaoDisponivel, snapshotPredominancia: snapshotPredominancia,
    limparForaDoCaminho: limparForaDoCaminho, falta: falta, snapshotResposta: snapshotResposta, snapshotDiagnostico: snapshotDiagnostico,
    resultadoGravavel: resultadoGravavel, nomesNaConclusao: nomesNaConclusao,
    payloadCriacao: payloadCriacao, payloadSalvar: payloadSalvar, payloadConclusao: payloadConclusao, payloadDescarte: payloadDescarte,
    tipoDecisao: tipoDecisao, exigeJustificativa: exigeJustificativa, emBranco: emBranco, payloadDecisao: payloadDecisao,
    situacaoResposta: situacaoResposta, situacaoDiagnostico: situacaoDiagnostico, payloadReavaliacao: payloadReavaliacao,
    MAX_OBS: MAX_OBS, MAX_MOTIVO: MAX_MOTIVO, MAX_JUSTIFICATIVA: MAX_JUSTIFICATIVA
  };
  if (typeof document === 'undefined') return;

  /* ===================== TELA ===================== */
  /* B1: a tela não chama o Firebase — tudo passa pela interface de serviços (posicionamento-servicos.js) */
  function S() { return window.faServicosPosicionamento; }
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

    /* ---- gate P1–P16 → O1–O9: a situação de cada item vem do núcleo puro (gateDoItem), com o motor carregado ---- */
    function B() { return window.faBaseProdutoServico; }
    function gateAtual(itemId) { return gateDoItem(itemId, state.produtos, B(), B() ? B().contextoMotorAtual() : null); }
    /* itens listados para escolher: os que já tiveram alguma Avaliação de Produto/Serviço concluída, menos os que estão
       na Lixeira de Produto/Serviço (lá também saem da lista); cada um com o seu gate (só 'atual' deixa iniciar) e o
       motivo quando bloqueia. O nome e a base vêm da versão que vale (a ponta da cadeia). */
    function itensDoGate() {
      var ids = {};
      Object.keys(state.produtos).forEach(function (k) { var it = state.produtos[k]; if (it && it.status === 'concluido') ids[it.itemId || k] = true; });
      return Object.keys(ids).map(itemDoGate).filter(function (x) { return x.gate.situacao !== 'excluida'; }).sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome), 'pt-BR'); });
    }
    /* conclusão de um rascunho já aberto: o gate do item tem de liberar E a base que vale hoje tem de ser exatamente a
       gravada no rascunho; senão devolve { situacao, texto } (o rascunho não é tocado) */
    function travaConclusao(a) {
      if (!a || a.status !== 'rascunho') return null;
      var g = gateAtual(a.itemId);
      if (!g.libera) return { situacao: g.situacao, texto: textoGate(g.situacao, 'concluir') };
      if (g.chave !== a.avaliacaoArquiteturalId) return { situacao: 'base-mudou', texto: textoGate('base-mudou', 'concluir') };
      return null;
    }
    function itemDoGate(itemId) {
      var g = gateAtual(itemId), ponta = g.chave && state.produtos[g.chave];
      return { itemId: itemId, nome: (ponta && ponta.nome) || itemId, gate: g, avaliacaoArquiteturalId: g.libera ? g.chave : null,
        versao: (ponta && ponta.versao) || 1, camada: (ponta && ponta.camadaSugerida) || null };
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
          h += '<div class="table-scroll-wrap"><table class="admin-table po-tabela"><thead><tr><th>Item</th><th>Versão</th><th>Motor e redação</th><th>Situação</th><th>Recomendação automática</th><th>Decisão final</th><th>Atualizado em</th><th></th></tr></thead><tbody>';
          lista.forEach(function (r) {
            var acao = r.status === 'rascunho' && podeEscrever() ? 'Continuar' : 'Abrir';
            h += '<tr class="po-linha" data-key="' + esc(r._key) + '" data-situacao="' + esc(r._sit) + '"><td data-label="Item">' + esc(r.itemNome) + '</td>' +
              '<td data-label="Versão">v' + esc(r.versao || 1) + '</td><td data-label="Motor e redação" class="po-versoes-usadas">' + textoVersoes(r) + '</td><td data-label="Situação">' + badgeSituacao(r._sit) + '</td>' +
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
        '<p class="avp-intro">Só itens cuja Avaliação de Produto/Serviço vigente está concluída e com Motor atual (qualquer classificação). Cada item tem um Posicionamento por vez.</p>';
      if (!tudoCarregado() || !window.faQuestionarios.configCarregada(QCOD)) return h + '<p class="loading-msg">Carregando…</p></div>';
      if (state.itemEscolhido) {
        var it = itemDoGate(state.itemEscolhido);
        var temPos = state.vigentes[it.itemId] || state.reservas[it.itemId];
        if (!temPos && it.gate.situacao === 'sem-avaliacao') return h + '<p class="avp-error-msg" id="poItemIndisponivel">Este item não tem Avaliação de Produto/Serviço e não pode ser avaliado aqui.</p>' +
          '<button type="button" class="btn btn--sm" id="poOutroItem">Escolher outro item</button></div>';
        h += '<div class="po-item-escolhido" id="poItemSelecionado"><p class="po-item-nome">' + esc(it.nome) + '</p>' +
          (it.camada ? '<p class="avp-ficha-meta">Avaliação de Produto/Serviço: ' + esc(it.camada.label || it.camada.id) + ' (v' + esc(it.versao) + ')</p>' : '');
        if (!temPos && !it.gate.libera) h += avisoGate(it.gate, 'iniciar');
        h += acoesDoItem(it, true) + '</div><button type="button" class="btn btn--sm" id="poOutroItem">Escolher outro item</button></div>';
        return h;
      }
      var itens = itensDoGate();
      h += '<div class="avp-field"><label for="poBusca">Buscar item</label><input type="search" id="poBusca" value="' + esc(state.busca) + '" autocomplete="off"></div>';
      var filtro = state.busca.trim().toLowerCase();
      var filtrados = itens.filter(function (x) { return !filtro || String(x.nome).toLowerCase().indexOf(filtro) !== -1; });
      if (!filtrados.length) h += '<p class="admin-empty">Nenhum item encontrado.</p>';
      h += '<ul class="po-itens">' + filtrados.map(function (x) {
        return '<li class="po-item-opcao" data-item="' + esc(x.itemId) + '" data-gate="' + esc(x.gate.situacao) + '"><span class="po-item-nome">' + esc(x.nome) + '</span> ' + acoesDoItem(x, false) + '</li>';
      }).join('') + '</ul>';
      return h + '</div>';
    }
    /* o motivo do bloqueio, por extenso; 'verificando' é espera, não erro */
    function avisoGate(g, acao) {
      var cls = g.situacao === 'verificando' ? 'loading-msg' : 'avp-error-msg';
      return '<p class="' + cls + ' po-gate" id="poGate" data-gate="' + esc(g.situacao) + '" role="status">' + esc(textoGate(g.situacao, acao)) + '</p>';
    }
    /* item com Posicionamento concluído → só "Abrir"; com rascunho → "Continuar"; bloqueado pelo gate → o motivo
       (Ver motivo abre o item); senão escolher/iniciar */
    function acoesDoItem(it, escolhido) {
      var vig = state.vigentes[it.itemId], res = state.reservas[it.itemId];
      if (vig) return '<span class="po-item-situacao">Posicionamento concluído</span> <button type="button" class="btn btn--sm po-item-abrir" data-key="' + esc(vig) + '">Abrir</button>';
      if (res) return '<span class="po-item-situacao">Rascunho em andamento</span> <button type="button" class="btn btn--sm po-item-abrir" data-key="' + esc(res) + '">Continuar</button>';
      if (!it.gate.libera) return escolhido ? '' : '<span class="po-item-situacao po-item-bloqueado">' + esc(ROTULO_GATE[it.gate.situacao] || it.gate.situacao) + '</span> <button type="button" class="btn btn--sm po-item-escolher">Ver motivo</button>';
      if (escolhido) return '<button type="button" class="btn btn--primary" id="poIniciarBtn"' + (state.salvando ? ' disabled' : '') + '>' + (state.salvando ? 'INICIANDO…' : 'Iniciar avaliação') + '</button>';
      return '<button type="button" class="btn btn--sm po-item-escolher">Escolher</button>';
    }

    function respostaDe(q) { return state.atual && state.atual.respostas && state.atual.respostas[q]; }
    function renderChecklist() {
      var a = state.atual, edita = podeEscrever(), versao = a.questionnaireContentVersion, vm = versaoMotorDo(a);
      var h = '<div class="avp-form-card" id="poChecklist"><h3>' + esc(a.itemNome) + ' ' + badge(a.status) + '</h3>' +
        '<p class="avp-intro">Responda considerando a responsabilidade organizacional associada a este objeto. As perguntas de cada nível aparecem conforme o caminho.</p>';
      /* versão de motor sem a redação publicada que ela exige: nada de texto de outra versão nem de fábrica — trava */
      if (!redacaoDisponivel(a)) {
        return h + '<p class="avp-error-msg" id="poRedacaoIndisponivel" role="alert">Redação desta versão do motor (v' + esc(vm) + ') indisponível: ' +
          'as perguntas não podem ser mostradas nem respondidas até a redação compatível ser publicada. Nada foi alterado nesta avaliação.</p></div>' + rodapeVoltar();
      }
      if (!edita) h += '<p class="avp-decisao-aviso" id="poSomenteLeitura">Somente consulta: responder, salvar e concluir são do perfil Avaliação + Arquitetura.</p>';
      if (state.conflito) h += '<div class="avp-error-msg" id="poConflito" role="alert">Outra pessoa alterou este rascunho depois que você o abriu. Para não sobrescrever o trabalho dela, recarregue antes de continuar. ' +
        '<button type="button" class="btn btn--sm" id="poRecarregarBtn">Recarregar</button></div>';
      if (state.flash) h += '<p class="avp-flash-success" id="poFlash">' + esc(state.flash) + '</p>';
      if (a.avaliacaoAnteriorId) h += '<div class="po-reavaliacao-info" id="poReavaliacaoInfo"><p><strong>Reavaliação — versão ' + esc(a.versao) + '.</strong> A versão ' + esc((a.versao || 2) - 1) +
        ' continua vigente até esta ser concluída; descartar esta reavaliação não muda nada nela.</p><p><strong>Motivo:</strong> ' + esc(a.motivoReavaliacao) + '</p>' +
        '<p class="avp-ficha-meta">As respostas da versão anterior vieram preenchidas; perguntas cuja redação mudou precisam ser respondidas de novo.</p></div>';
      h += '<p class="avp-ficha-meta" id="poVersoesUsadas">' + textoVersoes(a) + '</p>';
      var cam = caminho(a);
      ORDEM_NIVEIS.forEach(function (n) {
        var qs = NIVEIS[n].filter(function (q) { return cam.indexOf(q) !== -1; });
        if (!qs.length) return;
        h += '<section class="po-nivel" data-nivel="' + n + '"><h4 class="po-nivel-titulo">' + esc(TITULO_NIVEL[n]) + '</h4>';
        qs.forEach(function (q) { h += renderPergunta(q, versao, edita, vm); });
        if (diagnosticoNecessario(a, n)) h += renderDiagnostico(n, versao, edita, vm);
        var pn = predominanciaNecessaria(a, n);
        if (pn) h += renderPredominancia(n, pn.opcoes, versao, edita, vm);
        h += '</section>';
      });
      h += '</div>';
      if (edita) {
        var f = falta(a), bloq = !!state.salvando || state.conflito, tc = travaConclusao(a);
        /* a base P1–P16 deixou de valer: o rascunho continua salvável e descartável, só não conclui */
        if (tc) h += '<p class="' + (tc.situacao === 'verificando' ? 'loading-msg' : 'avp-error-msg') + ' po-gate" id="poGate" data-gate="' + esc(tc.situacao) + '" role="status">' + esc(tc.texto) + '</p>';
        h += '<div class="avp-actions-footer">' +
          '<button type="button" class="btn" id="poSalvarBtn"' + (bloq ? ' disabled' : '') + '>' + (state.salvando === 'rascunho' ? 'SALVANDO…' : 'SALVAR RASCUNHO') + '</button>' +
          '<button type="button" class="btn btn--primary" id="poConcluirBtn"' + (bloq || f || tc ? ' disabled' : '') + '>' + (state.salvando === 'concluido' ? 'CONCLUINDO…' : f ? esc(f.texto) : 'CONCLUIR') + '</button>' +
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
    function renderPergunta(q, versao, edita, vm) {
      var c = conteudo(q, versao, vm), r = respostaDe(q), v = r && r.resposta;
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
      try { sit = q ? situacaoResposta(antes, q, a.questionnaireContentVersion, versaoMotorDo(a)) : situacaoDiagnostico(antes, papeisDoPar(a, n), a.questionnaireContentVersion, versaoMotorDo(a)); } catch (e) { return ''; }
      var rotulo = q ? (antes.resposta === 'SIM' ? 'SIM' : 'NÃO') : (antes.rotuloNaEpoca || antes.resposta);
      if (sit === 'pergunta' && !agora) return '<p class="po-heranca po-heranca--pergunta" data-heranca="pergunta">' + (q ? 'A redação desta pergunta mudou' : 'O diagnóstico mudou (texto, rótulos ou par de papéis)') +
        ' desde a versão anterior (resposta lá: ' + esc(rotulo) + '). Responda de novo.</p>';
      if (sit === 'ajuda' && agora) return '<p class="po-heranca" data-heranca="ajuda">A ajuda ' + (q ? 'desta pergunta' : 'deste diagnóstico') + ' mudou desde a versão anterior: confira a resposta trazida.</p>';
      return '';
    }
    function renderDiagnostico(n, versao, edita, vm) {
      var c = conteudo(DIAG, versao, vm), d = state.atual.diagnosticos && state.atual.diagnosticos[n], v = d && d.resposta;
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
    /* D2 (só em versão de motor com predominância): as opções são as do núcleo para os papéis que receberam SIM,
       mais "não determinável"; o texto de cada uma é a redação publicada daquela versão */
    function renderPredominancia(n, opcoes, versao, edita, vm) {
      var c = conteudo(nucleo().D2_POR_NIVEL[n], versao, vm), d = state.atual.predominancias && state.atual.predominancias[n], v = d && d.resposta;
      var rot = {};
      (c.opcoes || []).forEach(function (o) { rot[o.codigo] = o; });
      var h = '<div class="avp-question po-pred" data-nivel="' + n + '"><div class="avp-question-head"><span class="avp-question-num">Predominância</span>' +
        '<p class="avp-question-text"><strong>' + esc(c.titulo || '') + '</strong><br>' + esc(c.texto || '') + '</p></div>' +
        '<p class="po-diag-papeis">Papéis: ' + papeisDoPar(state.atual, n).map(spanNome).join(', ') + '</p>' + renderAjuda(c);
      h += '<div class="avp-choice-group po-pred-opcoes">' + opcoes.map(function (oc) {
        return '<button type="button" class="avp-choice-btn po-pred-resp' + (v === oc ? ' active ativa' : '') + '" data-nivel="' + n + '" data-v="' + esc(oc) + '"' + (edita ? '' : ' disabled') + '>' + esc((rot[oc] && rot[oc].rotulo) || oc) + '</button>';
      }).join('') + '</div>';
      if (v) {
        if (d.interpretacaoNaEpoca) h += '<p class="po-interpretacao">' + esc(d.interpretacaoNaEpoca) + '</p>';
        h += '<label class="po-obs-rotulo" for="poPredObs' + n + '">Observação (opcional)</label><textarea class="avp-observacao po-pred-obs" id="poPredObs' + n + '" data-nivel="' + n + '" maxlength="' + MAX_OBS + '" rows="2"' + (edita ? '' : ' disabled') + '>' + esc(d.observacao || '') + '</textarea>';
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
      h += '<p class="avp-ficha-meta">Concluída em ' + esc(fmtData(a.concluidoEm)) + (a.concluidoPor ? ' por ' + esc(a.concluidoPor.name || a.concluidoPor.email) : '') + ' · regra ' + esc(ra.regra) + '</p><p class="avp-ficha-meta" id="poVersoesUsadas">' + textoVersoes(a) + '</p>';
      h += renderRespostasLidas(a) + '</section>';
      h += '<section class="po-bloco" id="poBlocoDecisao"><h4 class="po-bloco-titulo">Decisão final</h4>' + renderDecisao(a, key, sit) + '</section>';
      h += '<section class="po-bloco" id="poBlocoHistorico"><h4 class="po-bloco-titulo">Histórico de versões</h4>' + renderHistorico(a, key) + '</section>';
      var podeReav = sit === 'vigente' && podeEscrever() && !resv, prontoPdf = prontoParaExportar();
      /* H3-a: dormente — só aparece com um motor em vigor mais novo que o deste registro e a redação publicada dele */
      var atu = podeReav ? atualizacaoDisponivel(a) : null;
      /* reavaliar passa pelo MESMO gate de iniciar: sem a base P1–P16 vigente e com Motor atual, o botão fica travado e diz por quê */
      var gReav = podeReav ? itemDoGate(a.itemId).gate : null, travaReav = !!(gReav && !gReav.libera);
      if (travaReav) h += avisoGate(gReav, 'reavaliar');
      h += '<div class="avp-actions-footer po-ficha-acoes">' +
        (podeReav ? '<button type="button" class="btn" id="poReavaliarBtn"' + (state.salvando || travaReav ? ' disabled' : '') + '>' + (state.salvando === 'reavaliacao' ? 'INICIANDO…' : 'Reavaliar') + '</button>' : '') +
        (atu ? '<button type="button" class="btn" id="poAtualizarMotorBtn"' + (state.salvando || travaReav ? ' disabled' : '') + '>Atualizar com motor atual (v' + esc(atu.de) + ' → v' + esc(atu.para) + ')</button>' : '') +
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
      var M = nucleo(), auto = a.resultadoAutomatico && a.resultadoAutomatico.codigoResultado;
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
          '<div class="avp-ficha-meta po-versoes-usadas">' + textoVersoes(r) + '</div>' +
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
        var pd = a.predominancias && a.predominancias[n];
        if (pd) h += '<li><strong>Predominância do Nível ' + n.slice(1) + '</strong>: ' + esc(pd.rotuloNaEpoca || pd.resposta) + (pd.observacao ? '<br><em>' + esc(pd.observacao) + '</em>' : '') + '</li>';
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
      wrap.querySelectorAll('.po-pred-resp').forEach(function (b) { b.addEventListener('click', function () { responderPredominancia(b.dataset.nivel, b.dataset.v); }); });
      wrap.querySelectorAll('.po-pred-obs').forEach(function (t) {
        t.addEventListener('input', function () { var d = state.atual.predominancias[t.dataset.nivel]; if (!d) return; if (t.value) d.observacao = t.value.slice(0, MAX_OBS); else delete d.observacao; state.sujo = true; });
      });
      var sal = byId('poSalvarBtn'); if (sal) sal.addEventListener('click', salvar);
      var con = byId('poConcluirBtn'); if (con) con.addEventListener('click', concluir);
      var des = byId('poDescartarBtn'); if (des) des.addEventListener('click', pedirDescarte);
      var rec = byId('poRecarregarBtn'); if (rec) rec.addEventListener('click', recarregar);
      var hist = byId('poMostrarHistorico'); if (hist) hist.addEventListener('change', function () { state.mostrarHistorico = hist.checked; render(); });
      var reav = byId('poReavaliarBtn'); if (reav) reav.addEventListener('click', pedirReavaliacao);
      var atuM = byId('poAtualizarMotorBtn'); if (atuM) atuM.addEventListener('click', pedirAtualizacaoMotor);
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
      var preds = (limpo.predsRemovidas || []).filter(function (n) { return state.atual.predominancias && state.atual.predominancias[n]; });
      function confirmar() { state.atual = limpo.reg; state.sujo = true; render(); }
      if (!perde.length && !diags.length && !preds.length) { confirmar(); return; }
      var partes = [];
      if (perde.length) partes.push('as respostas ' + perde.join(', '));
      if (limpo.obsRemovidas.length) partes.push(limpo.obsRemovidas.length === 1 ? '1 observação' : limpo.obsRemovidas.length + ' observações');
      diags.forEach(function (n) { partes.push('o diagnóstico do Nível ' + n.slice(1)); });
      preds.forEach(function (n) { partes.push('a predominância do Nível ' + n.slice(1)); });
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
      novo.respostas[q] = snapshotResposta(q, v, novo.questionnaireContentVersion, atual && atual.observacao, agoraIso(), versaoMotorDo(novo));
      aplicarMudanca(novo);
    }
    function responderDiagnostico(n, v) {
      if (!podeEscrever() || state.salvando || state.conflito) return;
      var d = state.atual.diagnosticos && state.atual.diagnosticos[n];
      if (d && d.resposta === v) return;
      var novo = clone(state.atual);
      novo.diagnosticos = novo.diagnosticos || {};
      novo.diagnosticos[n] = snapshotDiagnostico(v, papeisDoPar(novo, n), novo.questionnaireContentVersion, d && d.observacao, agoraIso(), versaoMotorDo(novo));
      /* na v1 o diagnóstico não abre nem fecha ramo (nada sai); na v2, "distintas" fecha a predominância e o que veio depois dela */
      aplicarMudanca(novo);
    }
    function responderPredominancia(n, v) {
      if (!podeEscrever() || state.salvando || state.conflito) return;
      var pn = predominanciaNecessaria(state.atual, n);
      if (!pn || pn.opcoes.indexOf(v) === -1) return;
      var d = state.atual.predominancias && state.atual.predominancias[n];
      if (d && d.resposta === v) return;
      var novo = clone(state.atual);
      novo.predominancias = novo.predominancias || {};
      novo.predominancias[n] = snapshotPredominancia(n, v, papeisDoPar(novo, n), novo.questionnaireContentVersion, d && d.observacao, agoraIso(), versaoMotorDo(novo));
      aplicarMudanca(novo);
    }

    /* ---- gravação com prazo: sem resposta não é "falhou" — confere o banco antes de liberar ---- */
    function gravar(payload, aoOk, aoErro) {
      S().gravar(payload, TEMPO_GRAVACAO, function (err) { if (err) aoErro(err); else aoOk(); });
    }
    function novaChave(caminho) { return S().novaChave(caminho); }

    function iniciar() {
      if (!podeEscrever() || state.salvando) return;
      if (!state.itemEscolhido || !window.faQuestionarios.configCarregada(QCOD)) return;
      var it = itemDoGate(state.itemEscolhido);
      if (state.vigentes[it.itemId]) { irParaChave(state.vigentes[it.itemId]); return; }
      if (state.reservas[it.itemId]) { irParaChave(state.reservas[it.itemId]); return; }
      /* o gate é recalculado no clique: a base pode ter mudado desde que a tela foi desenhada */
      if (!it.gate.libera) { render(); return; }
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
        S().lerUmaVez(RES + '/' + it.itemId).then(function (outro) {
          if (outro && outro !== id) { state.flash = 'Este item já tinha um rascunho iniciado por outra pessoa: ele foi aberto.'; irParaChave(outro); return; }
          return S().lerUmaVez(VIG + '/' + it.itemId).then(function (v) {
            if (v) { irParaChave(v); return; }
            render();
            aviso(err === 'sem-resposta' ? 'A conexão está demorando e não deu para confirmar o início. Confira a lista antes de tentar de novo.' : 'Não foi possível iniciar a avaliação. Tente novamente.');
          });
        }).catch(function () { render(); aviso('Não foi possível iniciar a avaliação. Tente novamente.'); });
      });
    }

    function aposErroDeGravacao(err, acao) {
      state.salvando = null;
      var id = state.chave;
      S().lerUmaVez(NODE + '/' + id + '/revisao').then(function (rev) {
        if (rev !== state.revisaoBase) { state.conflito = true; render(); return; }
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
      /* o gate vale também na conclusão: a base P1–P16 pode ter mudado depois que o rascunho foi aberto. Bloqueia sem
         mexer no rascunho (continua salvo) e nunca troca a base em silêncio */
      var trava = travaConclusao(state.atual);
      if (trava) { render(); aviso(trava.texto); return; }
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
        S().lerUmaVez(VIG + '/' + item).then(function (v) {
          if (v && v !== state.chave) { state.salvando = null; render(); aviso('Este item já tem um Posicionamento concluído. Abra-o pela lista.'); return; }
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
      var libera = nucleo().liberaSquadParaCodigoFirme(f.codigo);
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
        Promise.all([S().lerUmaVez(DEC + '/' + key), S().lerUmaVez(RES + '/' + a.itemId)]).then(function (r) {
          state.salvando = null;
          if (r[0]) { state.decisoes[key] = r[0]; state.formDecisao = null; render(); aviso('Já havia uma decisão registrada para esta versão: ela foi mantida.'); return; }
          if (r[1]) { state.reservas[a.itemId] = r[1]; render(); aviso('Há uma reavaliação em andamento. Conclua ou descarte essa reavaliação antes de registrar uma decisão para esta versão.'); return; }
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
      var it = itemDoGate(a.itemId);
      if (!it.gate.libera) { aviso(textoGate(it.gate.situacao, 'reavaliar')); return; }
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
    function pedirAtualizacaoMotor() {
      if (!podeEscrever() || state.salvando) return;
      var a = state.atual, key = state.chave, atu = atualizacaoDisponivel(a);
      if (!atu || state.vigentes[a.itemId] !== key) return;
      if (state.reservas[a.itemId]) { irParaChave(state.reservas[a.itemId]); return; }
      var it = itemDoGate(a.itemId);
      if (!it.gate.libera) { aviso(textoGate(it.gate.situacao, 'reavaliar')); return; }
      modal('<h4>Atualizar com o motor atual?</h4><p>Cria a versão ' + esc((a.versao || 1) + 1) + ' como rascunho no motor v' + esc(atu.para) + ' (esta foi calculada no motor v' + esc(atu.de) + ').</p>' +
        '<p>Só vêm preenchidas as respostas cuja pergunta e critérios são comprovadamente os mesmos; as demais precisam ser respondidas de novo. ' +
        'A decisão final desta versão não é copiada. Esta versão continua vigente até a nova ser concluída.</p>' +
        '<label for="poMotivoReavaliacaoInput">Motivo *</label><textarea id="poMotivoReavaliacaoInput" rows="3" maxlength="' + MAX_MOTIVO + '">Atualização para o motor v' + esc(atu.para) + '</textarea>',
        { sim: 'Atualizar', nao: 'Cancelar', aoSim: function (box) {
          var motivo = String(box.querySelector('#poMotivoReavaliacaoInput').value || '').trim();
          if (!motivo) return 'Informe o motivo da atualização.';
          iniciarReavaliacao(it, key, motivo, atu);
          return null;
        } });
    }
    function iniciarReavaliacao(it, anteriorId, motivo, atualizacao) {
      var usuario = sessaoAtual(); if (!usuario) return;
      /* o modal pode ter ficado aberto enquanto a base P1–P16 mudou: o gate é conferido de novo, e a base tem de ser a mesma */
      var agora = itemDoGate(it.itemId);
      if (!agora.gate.libera) { render(); aviso(textoGate(agora.gate.situacao, 'reavaliar')); return; }
      if (agora.avaliacaoArquiteturalId !== it.avaliacaoArquiteturalId) { render(); aviso('A Avaliação de Produto/Serviço deste item mudou enquanto a reavaliação era preparada. Confira e tente de novo.'); return; }
      var id = novaChave(NODE), audId = novaChave(AUD + '/' + id), payload;
      try {
        var ant0 = state.registros[anteriorId], vm0 = versaoMotorDo(ant0);
        if (atualizacao) {
          payload = payloadAtualizacaoMotor({ id: id, audId: audId, anteriorId: anteriorId, anterior: clone(ant0), itemNome: it.nome, avaliacaoArquiteturalId: it.avaliacaoArquiteturalId,
            versaoMotorDestino: atualizacao.para, versaoRedacaoDestino: atualizacao.versaoRedacao, motivo: motivo, usuario: usuario, agora: agoraIso() }).payload;
        } else {
          /* a redação da reavaliação é a publicada para o motor DO REGISTRO (v1: o questionário de sempre) */
          var vRed = vm0 === 1 ? window.faQuestionarios.versaoAtual(QCOD) : (window.faQuestionarios.situacaoConteudoMotor(QCOD, vm0) || {}).versaoPublicada;
          if (!vRed) throw new Error('sem-redacao');
          payload = payloadReavaliacao({ id: id, audId: audId, anteriorId: anteriorId, anterior: clone(ant0), itemNome: it.nome,
            avaliacaoArquiteturalId: it.avaliacaoArquiteturalId, versao: vRed, motivo: motivo, usuario: usuario, agora: agoraIso() });
        }
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
        S().lerUmaVez(RES + '/' + it.itemId).then(function (outro) {
          state.salvando = null;
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
      try { S().lerUmaVez(caminho).then(function (v) { fim({ ok: true, valor: v || {} }); }, function () { fim({ ok: false }); }); }
      catch (e) { fim({ ok: false }); }
    }
    function nomesAtuais() {
      var out = {}, M = nucleo();
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
      var cb = function (v) { aplicar(v || {}); state.carregou[chaveCarga] = true; aoChegar(chaveCarga); };
      var erro = function (e) {
        console.error('[avaliacao-posicionamento] não foi possível ler ' + caminho + ':', e); state.carregou[chaveCarga] = true;
        if (chaveCarga === 'av') state.erroLeitura = true;
        if (chaveCarga === 'dec') state.erroDec = true; /* leitura recusada não é "sem decisão" */
        aoChegar(chaveCarga);
      };
      ouvintes.push(S().ouvir(caminho, cb, erro));
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
      /* o gate precisa do motor de Produto/Serviço carregado: este onMudanca liga a leitura (garantirSync) e redesenha
         quando ela chega — antes disso o gate diz "Verificando…", nunca "atual" nem "desatualizado" */
      if (window.faMotorArquitetura) window.faMotorArquitetura.onMudanca(function () { if (!wrap.hidden && !state.salvando && !(state.tela === 'checklist' && state.sujo)) render(); });
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
      ouvintes.forEach(function (cancelar) { cancelar(); });
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
