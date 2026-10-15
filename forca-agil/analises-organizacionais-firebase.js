/* ============================================================
   Força Ágil — Porta 2 · ANÁLISE ORGANIZACIONAL — adaptador de persistência (Realtime Database)
   (window.faAnalisesFirebase; em Node, module.exports)

   Só TRADUZ o resultado do núcleo (analises-organizacionais-nucleo.js) em uma gravação multipath — tudo ou nada — e o
   que o banco devolve no estado que o núcleo espera. Nenhuma regra de negócio aqui; nenhuma chamada ao Firebase (quem
   grava é a porta faServicosPosicionamento, na tela). As regras do banco (database.rules.json, montadas por
   .github/scripts/montar-regras-analises-organizacionais.js) são a garantia de verdade: marcador de homologação,
   perfis, revisão + 1, horário do servidor, autoria do token, auditoria só de acréscimo, origem única das atuações e
   aprovação só pelo admin geral.

   Nós:
     analises-organizacionais/<id>                      a análise (escopo, entregas, comparações, recortes, fatos)
     analises-organizacionais-auditoria/<id>/<evento>   histórico, só acréscimo
     analises-propostas/<id>/v<n>                       propostas de composição, imutáveis
     analises-aprovacoes/<id>/v<n>                      referência a ato externo de aprovação (admin geral)
     analises-por-objeto/<objetoId>                     origem única de cada atuação criada por uma análise
     analises-organizacionais-config                    marcador de homologação (admin geral) + auditoria própria
     analises-organizacionais-excluidas/<id>            registro mínimo de cada análise excluída (a análise sai na mesma gravação)
   O nó das atuações (objetos-organizacionais) NÃO muda: uma atuação criada a partir de um recorte usa o mesmo payload
   de objetos-organizacionais-nucleo.js, na MESMA gravação que liga o recorte e o índice de origem.
   ============================================================ */
(function () {
  'use strict';
  var NOS = Object.freeze({
    analises: 'analises-organizacionais', auditoria: 'analises-organizacionais-auditoria', propostas: 'analises-propostas',
    aprovacoes: 'analises-aprovacoes', porObjeto: 'analises-por-objeto', config: 'analises-organizacionais-config',
    configAuditoria: 'analises-organizacionais-config-auditoria', excluidas: 'analises-organizacionais-excluidas'
  });
  var ID = /^[A-Za-z0-9_-]{1,60}$/;
  function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
  /* o banco descarta null e objetos/listas vazios: tira-os antes (evita "undefined" e diferença entre o que se grava e o
     que se lê) */
  function semVazios(v) {
    if (Array.isArray(v)) return v.map(semVazios).filter(function (x) { return x !== null && x !== undefined; });
    if (v && typeof v === 'object') {
      var o = {};
      Object.keys(v).forEach(function (k) { var x = semVazios(v[k]); if (x === null || x === undefined) return; if (typeof x === 'object' && !Array.isArray(x) && !Object.keys(x).length) return; if (Array.isArray(x) && !x.length) return; o[k] = x; });
      return o;
    }
    return v;
  }
  function pessoa(u) {
    if (!u || !ID.test(String(u.uid || '')) || !u.email) throw new Error('análise organizacional: usuário sem uid ou e-mail');
    return { uid: u.uid, email: u.email };
  }
  function exigirId(x, nome) { if (typeof x !== 'string' || !ID.test(x)) throw new Error('análise organizacional: ' + nome + ' inválido'); }
  function chaveProposta(versao) { return 'v' + versao; }

  /* resultado do núcleo → multipath. o: { audId, usuario: { uid, email }, agora (marca do servidor) }
     Cada operação do núcleo produz exatamente UM evento: ele vai para a auditoria com a mesma chave que a análise aponta
     (auditoriaId), na mesma gravação. */
  function payloadOperacao(resultado, o) {
    if (!resultado || !resultado.ok) throw new Error('análise organizacional: operação recusada pelo núcleo');
    exigirId(o.audId, 'audId');
    var por = pessoa(o.usuario), p = {}, analiseId = null;
    (resultado.mudancas || []).forEach(function (m) {
      var d = clone(m.depois);
      if (m.entidade === 'analise') {
        analiseId = m.id;
        if (m.antes === null) { d.criadaEm = o.agora; d.criadaPor = { id: por.uid, email: por.email }; }
        d.atualizadoEm = o.agora; d.atualizadoPor = por; d.auditoriaId = o.audId;
        p[NOS.analises + '/' + m.id] = semVazios(d);
      } else if (m.entidade === 'proposta') {
        analiseId = d.analiseId;
        d.registradaEm = o.agora; d.registradaPor = { id: por.uid, email: por.email };
        p[NOS.propostas + '/' + d.analiseId + '/' + chaveProposta(d.versao)] = semVazios(d);
      } else if (m.entidade === 'aprovacao') {
        analiseId = d.analiseId;
        d.registradoEm = o.agora; d.registradoPor = { id: por.uid, email: por.email }; d.auditoriaId = o.audId;
        p[NOS.aprovacoes + '/' + d.analiseId + '/' + chaveProposta(d.versaoProposta)] = semVazios(d);
      } else if (m.entidade === 'exclusao-analise') {
        analiseId = m.id;
        p[NOS.analises + '/' + m.id] = null;
        d.excluidaEm = o.agora; d.excluidaPor = por; d.auditoriaId = o.audId;
        p[NOS.excluidas + '/' + m.id] = semVazios(d);
      } else throw new Error('análise organizacional: entidade desconhecida ' + m.entidade);
    });
    var ev = (resultado.eventos || [])[0];
    if (!ev || !analiseId) throw new Error('análise organizacional: operação sem evento');
    p[NOS.auditoria + '/' + analiseId + '/' + o.audId] = semVazios({ tipo: ev.tipo, operacaoId: ev.operacaoId, em: o.agora, por: por, detalhe: ev.detalhe || {} });
    return p;
  }
  /* atuação criada a partir de um recorte: objeto (payload do núcleo das atuações) + recorte ligado + índice de origem +
     auditoria da análise — uma gravação só. o: { objetoPayload, associacao (resultado do núcleo), analiseId, recorteId,
     objetoId, audId, usuario, agora } */
  function payloadCriarAtuacao(o) {
    exigirId(o.objetoId, 'objetoId'); exigirId(o.recorteId, 'recorteId'); exigirId(o.analiseId, 'analiseId');
    var p = payloadOperacao(o.associacao, o);
    Object.keys(o.objetoPayload).forEach(function (k) { p[k] = o.objetoPayload[k]; });
    p[NOS.porObjeto + '/' + o.objetoId] = { analiseId: o.analiseId, recorteId: o.recorteId };
    return p;
  }
  /* marcador de homologação: o: { anterior, nova, motivo, audId, usuario, agora } */
  function payloadHabilitacao(o) {
    exigirId(o.audId, 'audId');
    var por = pessoa(o.usuario), motivo = typeof o.motivo === 'string' ? o.motivo.trim() : '';
    if (!motivo) throw new Error('análise organizacional: motivo obrigatório');
    var p = {};
    p[NOS.config] = { habilitacao: o.nova, alteradoEm: o.agora, alteradoPor: por, motivo: motivo, auditoriaId: o.audId };
    p[NOS.configAuditoria + '/' + o.audId] = { habilitacao: o.nova, anterior: o.anterior || 'DESLIGADO', motivo: motivo, usuario: por, dataHora: o.agora };
    return p;
  }

  /* banco → estado do núcleo (devolve o que o banco descartou: mapas e listas vazios, campos nulos) */
  function normalizarAnalise(a) {
    if (!a) return a;
    var n = clone(a);
    ['respostas', 'entregas', 'comparacoes', 'recortes', 'referencias'].forEach(function (k) { if (!n[k] || typeof n[k] !== 'object') n[k] = {}; });
    if (!Array.isArray(n.capacidades)) n.capacidades = n.capacidades && typeof n.capacidades === 'object' ? Object.keys(n.capacidades).map(function (k) { return n.capacidades[k]; }) : [];
    ['descricao', 'estruturaReferidaId', 'objetoAmploId'].forEach(function (k) { if (n[k] === undefined) n[k] = null; });
    Object.keys(n.entregas).forEach(function (k) { var e = n.entregas[k]; if (!e.respostas) e.respostas = {}; if (e.exemplo === undefined) e.exemplo = null; });
    Object.keys(n.recortes).forEach(function (k) {
      var r = n.recortes[k];
      if (!Array.isArray(r.entregas)) r.entregas = r.entregas && typeof r.entregas === 'object' ? Object.keys(r.entregas).map(function (x) { return r.entregas[x]; }) : [];
      if (!Array.isArray(r.capacidades)) r.capacidades = [];
      if (r.objetoId === undefined) r.objetoId = null;
      if (r.fatos === undefined) r.fatos = null;
      if (r.fatos && !Array.isArray(r.fatos.execucao)) r.fatos.execucao = r.fatos.execucao && typeof r.fatos.execucao === 'object' ? Object.keys(r.fatos.execucao).map(function (x) { return r.fatos.execucao[x]; }) : [];
    });
    Object.keys(n.comparacoes).forEach(function (k) { var c = n.comparacoes[k]; if (c.justificativa === undefined) c.justificativa = null; });
    return n;
  }
  /* { analises: {id: analise}, propostas: {id: {v1: …}}, aprovacoes: {id: {v1: …}} } → estado do núcleo */
  function estadoDoBanco(bruto) {
    bruto = bruto || {};
    var est = { analises: {}, propostas: {}, aprovacoes: {} };
    Object.keys(bruto.analises || {}).forEach(function (id) { est.analises[id] = normalizarAnalise(bruto.analises[id]); });
    Object.keys(bruto.propostas || {}).forEach(function (id) {
      Object.keys(bruto.propostas[id] || {}).forEach(function (k) {
        var p = clone(bruto.propostas[id][k]);
        if (!Array.isArray(p.recortes)) p.recortes = p.recortes && typeof p.recortes === 'object' ? Object.keys(p.recortes).map(function (x) { return p.recortes[x]; }) : [];
        if (p.pendencia === undefined) p.pendencia = null;
        est.propostas[id + '~' + p.versao] = p;
      });
    });
    Object.keys(bruto.aprovacoes || {}).forEach(function (id) {
      Object.keys(bruto.aprovacoes[id] || {}).forEach(function (k) { var a = clone(bruto.aprovacoes[id][k]); est.aprovacoes[id + '~' + a.versaoProposta] = a; });
    });
    return est;
  }

  var api = Object.freeze({ NOS: NOS, chaveProposta: chaveProposta, payloadOperacao: payloadOperacao, payloadCriarAtuacao: payloadCriarAtuacao,
    payloadHabilitacao: payloadHabilitacao, normalizarAnalise: normalizarAnalise, estadoDoBanco: estadoDoBanco, semVazios: semVazios });
  if (typeof window !== 'undefined') window.faAnalisesFirebase = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
