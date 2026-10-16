/* ============================================================
   Força Ágil — TAXONOMIA · definição oficial versionada (window.faTaxonomiaDefinicao; em Node, module.exports)

   MODELO SIMPLIFICADO (aprovado em 2026-10-15), igual nos dois domínios (arquitetural e organizacional):
     taxonomia/<dom>/conceitos/<c>/definicao   = { texto, versao, publicadaEm, publicadaPor }   a ÚNICA definição vigente
     taxonomia/<dom>/definicoes/<c>/v<n>       = { texto, versao, publicadaEm, publicadaPor, origem, motivo? }  histórico
   Publicar = versão anterior + 1, com a entrada do histórico e o evento de auditoria NA MESMA gravação. As regras do
   banco conferem a sequência (compare-and-set): duas publicações sobre a mesma versão → só uma entra; clique repetido →
   recusado. Não existe mais escolha entre fontes nem promoção manual de vigência.

   PURO: sem Firebase, sem DOM, sem relógio. Quem chama passa usuário, horário e a chave da auditoria.
   ============================================================ */
(function () {
  'use strict';
  var LIMITE_TEXTO = 8000, LIMITE_MOTIVO = 500;
  function texto(v) { return typeof v === 'string' ? v.trim() : ''; }

  /* o: { dom, codigo, atual (definição vigente ou null), novoTexto, motivo?, email, agora, audKey }
     → { ok: true, caminhos } | { ok: false, erro } */
  function payloadPublicacao(o) {
    var t = texto(o.novoTexto), m = texto(o.motivo);
    if (!t) return { ok: false, erro: 'Escreva o texto da definição.' };
    if (t.length > LIMITE_TEXTO) return { ok: false, erro: 'A definição tem no máximo ' + LIMITE_TEXTO + ' caracteres.' };
    if (m.length > LIMITE_MOTIVO) return { ok: false, erro: 'O motivo tem no máximo ' + LIMITE_MOTIVO + ' caracteres.' };
    if (o.atual && texto(o.atual.texto) === t) return { ok: false, erro: 'O texto proposto é igual à definição vigente: nada a publicar.' };
    var versao = o.atual && typeof o.atual.versao === 'number' ? o.atual.versao + 1 : 1;
    var base = 'taxonomia/' + o.dom, def = { texto: t, versao: versao, publicadaEm: o.agora, publicadaPor: o.email };
    var hist = { texto: t, versao: versao, publicadaEm: o.agora, publicadaPor: o.email, origem: 'publicacao' };
    if (m) hist.motivo = m;
    var c = {};
    c[base + '/conceitos/' + o.codigo + '/definicao'] = def;
    c[base + '/definicoes/' + o.codigo + '/v' + versao] = hist;
    c[base + '/conceitos/' + o.codigo + '/atualizadoEm'] = o.agora;
    c[base + '/conceitos/' + o.codigo + '/atualizadoPor'] = o.email;
    c[base + '/auditoria/' + o.codigo + '/' + o.audKey] = { tipo: 'definicao_publicada', conceito: o.codigo, campo: 'definição',
      valorAnterior: o.atual ? o.atual.texto : null, valorNovo: t, versao: versao, motivo: m || null, usuario: { email: o.email }, dataHora: o.agora };
    return { ok: true, caminhos: c, versao: versao };
  }

  /* histórico para a tela: as versões publicadas (definicoes/<c>), da mais nova para a mais antiga, cada uma com o
     texto anterior; e, à parte, as trocas de definição anteriores à simplificação (auditoria 'definicao_vigente' do
     modelo antigo, com os textos resolvidos pelo arquivo da migração quando houver). Nada é inventado. */
  function historico(versoes, auditoria, arquivoFontes) {
    var vs = Object.keys(versoes || {}).map(function (k) { return versoes[k]; }).filter(function (x) { return x && typeof x.versao === 'number'; })
      .sort(function (a, b) { return a.versao - b.versao; });
    var porVersao = {}; vs.forEach(function (x) { porVersao[x.versao] = x; });
    var publicacoes = vs.map(function (x) { var ant = porVersao[x.versao - 1]; return Object.assign({}, x, { textoAnterior: ant ? ant.texto : null }); }).reverse();
    var fontes = arquivoFontes || {};
    var txt = function (id) { return id && fontes[id] && typeof fontes[id].texto === 'string' ? fontes[id].texto : null; };
    var legado = Object.keys(auditoria || {}).map(function (k) { return auditoria[k]; }).filter(function (e) { return e && e.tipo === 'definicao_vigente'; })
      .map(function (e) { return { dataHora: e.dataHora, por: e.usuario && e.usuario.email, textoAnterior: txt(e.fonteAnteriorId), textoNovo: txt(e.fonteNovaId), rotuloAnterior: e.valorAnterior, rotuloNovo: e.valorNovo }; })
      .sort(function (a, b) { return String(b.dataHora || '').localeCompare(String(a.dataHora || '')); });
    /* "alterações" = publicações que substituíram uma definição anterior (a versão 1 é o registro inicial) */
    var alteracoes = publicacoes.filter(function (p) { return p.versao > 1; }).length + legado.length;
    return { publicacoes: publicacoes, legado: legado, alteracoes: alteracoes };
  }

  var api = { LIMITE_TEXTO: LIMITE_TEXTO, LIMITE_MOTIVO: LIMITE_MOTIVO, payloadPublicacao: payloadPublicacao, historico: historico };
  Object.freeze(api);
  if (typeof window !== 'undefined') window.faTaxonomiaDefinicao = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
