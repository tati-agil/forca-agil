/* ============================================================
   GOVERNANÇA DA EVOLUÇÃO DO MOTOR DE POSICIONAMENTO (window.faGovernancaPosicionamento / module.exports) — H2-a / H3-a

   Módulo PURO: sem DOM, sem Firebase, sem autenticação, sem rede. Recebe o núcleo do motor (faMotorPosicionamentoNucleo)
   e os dados já lidos; devolve orientações. NÃO é fronteira confiável — nada aqui autoriza gravação nem põe versão em
   vigor: quem executa (hoje ninguém; na fase b, a fronteira confiável — Cloud Function ou backend corporativo) usa estas
   mesmas funções como regra de negócio, sem depender da interface nem do Firebase.

   O que decide:
     prontidao(N, def, o)        → a versão está TECNICAMENTE pronta? (definição válida, redação publicada e compatível,
                                    simulação sem violação de Linha × Squad, impacto calculado). Pronta ≠ autorizada.
     autorizacao(alvo, proposta, aprovacoes, o) → há aprovação EXPLÍCITA, vinculada à versão exata do motor e da redação
                                    (digests), com quem propõe ≠ quem aprova e aprovadores distintos (dupla por padrão), e
                                    com reconhecimento explícito do impacto (inclusive dos incomparáveis)?
     decisaoDeVigencia(…)        → só "pode" com prontidão + autorização + fronteira confiável (hoje sempre não).
     herdarEntreVersoes(N, o)    → reavaliação entre versões: o que pode ser herdado SEM DÚVIDA (mesmo código, mesmo
                                    significado fixo, mesma pergunta, mesmos critérios de resposta) e o que exige nova
                                    resposta. D1 é recalculada (só reaproveitada se exigida no destino para os mesmos papéis
                                    e com a mesma redação); D2 e decisão humana nunca são herdadas.
     classificarImpacto(N, o)    → registros concluídos: iguais / alterados / incomparáveis (com motivo — nunca contados
                                    como iguais) / violações de Linha × Squad.
     digest(v)                   → identificador determinístico do conteúdo (vínculo da aprovação à versão exata). Não é
                                    criptográfico: serve para "é exatamente esta versão?", não para segurança.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- invariante Linha × Squad, literal (conferência independente do núcleo) ---------- */
  var LIBERA_FIRME = { AREA_ESPECIALIZADA: false, COE: false, ESTRATEGIA_CLIENTES: true, NEGOCIOS: true, PLATAFORMA_CANAIS: true,
    PLATAFORMA_HABILITADORA_NEGOCIOS: true, PLATAFORMA_HABILITADORA_TECNOLOGIA: true, PLATAFORMA_CORPORATIVA: true };
  function liberaSquadEsperado(codigo, nivelConfirmado) {
    if (codigo === 'A_VALIDAR') return nivelConfirmado === 'LINHA' || nivelConfirmado === 'PLATAFORMA';
    return Object.prototype.hasOwnProperty.call(LIBERA_FIRME, codigo) ? LIBERA_FIRME[codigo] : null;
  }
  function violaLinhaSquad(res) {
    if (!res) return false;
    var e = liberaSquadEsperado(res.codigoResultado, res.nivelConfirmado || null);
    return e === null || res.liberaSquad !== e;
  }

  /* ---------- digest determinístico (JSON canônico + cyrb53) ---------- */
  function canonico(v) {
    if (v === undefined || v === null || v === '') return null;
    if (Array.isArray(v)) return v.map(canonico);
    if (typeof v === 'object') {
      var r = {};
      Object.keys(v).sort().forEach(function (k) { var c = canonico(v[k]); if (c !== null) r[k] = c; });
      return r;
    }
    return v;
  }
  function digest(v) {
    var s = JSON.stringify(canonico(v)), h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0; i < s.length; i++) {
      var ch = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return ('0000000' + (h2 >>> 0).toString(16)).slice(-8) + ('0000000' + (h1 >>> 0).toString(16)).slice(-8);
  }
  function digestRedacao(perguntas) {
    /* só o que a pessoa lê e responde; nunca metadados de gravação */
    return digest((perguntas || []).map(function (p) {
      var c = {};
      Object.keys(p || {}).forEach(function (k) { if (['atualizadoEm', 'atualizadoPor', 'publicadoEm', 'publicadoPor'].indexOf(k) === -1) c[k] = p[k]; });
      return c;
    }));
  }

  /* ---------- herança entre versões ---------- */
  var CAMPOS_CRITERIO_BINARIA = ['textoAjuda', 'justSim', 'justNao', 'ajudaExtra', 'exemplo', 'exemplos'];
  var CAMPOS_CRITERIO_D1 = ['textoAjuda', 'rotuloMesma', 'rotuloDistintas', 'interpretacaoMesma', 'interpretacaoDistintas'];
  function papelNaDefinicao(def, q) {
    for (var i = 0; i < def.niveis.length; i++) {
      for (var j = 0; j < def.niveis[i].perguntas.length; j++) {
        var p = def.niveis[i].perguntas[j];
        if (p.codigo === q) return { nivel: def.niveis[i].id, papel: p.papel };
      }
    }
    return null;
  }
  function papeisSim(def, respostas, n) {
    var N = def.niveis.filter(function (x) { return x.id === n; })[0];
    return N ? N.perguntas.filter(function (p) { return respostas[p.codigo] === 'SIM'; }).map(function (p) { return p.papel; }) : [];
  }
  /* uma resposta binária só passa se NÃO houver dúvida de que é a mesma pergunta com o mesmo critério */
  function motivoBinaria(q, resp, defO, defD, conteudoOrigem, conteudoDestino, mesmo) {
    var a = papelNaDefinicao(defO, q), b = papelNaDefinicao(defD, q);
    if (!a || !b || a.papel !== b.papel || a.nivel !== b.nivel) return 'significado-diferente';
    if (!resp || (resp.resposta !== 'SIM' && resp.resposta !== 'NAO')) return 'sem-resposta';
    var cd = conteudoDestino(q);
    if (!cd) return 'sem-redacao-destino';
    if ((cd.tipo || 'binaria') !== 'binaria') return 'tipo-diferente';
    if (!resp.textoPerguntaNaEpoca) return 'sem-texto-da-epoca';
    if (!mesmo(resp.textoPerguntaNaEpoca, cd.texto)) return 'pergunta-diferente';
    var co = conteudoOrigem(q, resp.questionnaireContentVersion);
    if (!co) return 'sem-prova-do-criterio';
    if (!mesmo(co.texto, resp.textoPerguntaNaEpoca)) return 'sem-prova-do-criterio';
    for (var i = 0; i < CAMPOS_CRITERIO_BINARIA.length; i++) if (!mesmo(co[CAMPOS_CRITERIO_BINARIA[i]], cd[CAMPOS_CRITERIO_BINARIA[i]])) return 'criterio-diferente';
    return null;
  }
  function motivoD1(n, d, papeisDestino, defD, conteudoOrigem, conteudoDestino, mesmo) {
    if (!d || (d.resposta !== 'mesma' && d.resposta !== 'distintas')) return 'sem-resposta';
    if (JSON.stringify((d.papeis || []).slice().sort()) !== JSON.stringify(papeisDestino.slice().sort())) return 'papeis-diferentes';
    var cod = defD.diagnostico.codigo, cd = conteudoDestino(cod);
    if (!cd) return 'sem-redacao-destino';
    if (!d.textoPerguntaNaEpoca || !mesmo(d.textoPerguntaNaEpoca, cd.texto)) return 'pergunta-diferente';
    var co = conteudoOrigem(cod, d.questionnaireContentVersion);
    if (!co || !mesmo(co.texto, d.textoPerguntaNaEpoca)) return 'sem-prova-do-criterio';
    for (var i = 0; i < CAMPOS_CRITERIO_D1.length; i++) if (!mesmo(co[CAMPOS_CRITERIO_D1[i]], cd[CAMPOS_CRITERIO_D1[i]])) return 'criterio-diferente';
    return null;
  }
  /* o: { origem: { def, reg }, destino: { def }, conteudoOrigem(codigo, versaoRedacao), conteudoDestino(codigo), mesmoConteudo(a, b) }
     → { respostas: {q: obj original}, diagnosticos: {n: obj original}, novas: [{ codigo, motivo }], d2Descartadas: [n],
         completo: bool (o destino conclui só com o herdado) } */
  function herdarEntreVersoes(N, o) {
    if (typeof o.mesmoConteudo !== 'function') throw new Error('herdarEntreVersoes exige o critério de conteúdo (mesmoConteudo)');
    var defO = o.origem.def, defD = o.destino.def, reg = o.origem.reg || {}, mesmo = o.mesmoConteudo;
    var rejeitadas = {}, cand = {};
    Object.keys(reg.respostas || {}).forEach(function (q) {
      var m = motivoBinaria(q, reg.respostas[q], defO, defD, o.conteudoOrigem, o.conteudoDestino, mesmo);
      if (m) rejeitadas[q] = m; else cand[q] = reg.respostas[q].resposta;
    });
    /* só fica o que está no caminho do DESTINO (iterando: tirar uma resposta pode fechar um ramo) */
    var diags = {}, diagsObj = {};
    for (var volta = 0; volta < 6; volta++) {
      var cam = N.perguntasDoCaminho(defD, cand, diags, {}), mudou = false;
      Object.keys(cand).forEach(function (q) { if (cam.indexOf(q) === -1) { delete cand[q]; mudou = true; } });
      /* D1 recalculada no destino */
      var precisa = N.diagnosticosNecessarios(defD, cand, {}, {});
      var novos = {};
      precisa.forEach(function (n) {
        var d = (reg.diagnosticos || {})[n];
        var m = motivoD1(n, d, papeisSim(defD, cand, n), defD, o.conteudoOrigem, o.conteudoDestino, mesmo);
        if (!m) { novos[n] = d.resposta; diagsObj[n] = d; } else rejeitadas['D1:' + n] = m;
      });
      if (JSON.stringify(novos) !== JSON.stringify(diags)) { diags = novos; mudou = true; }
      if (!mudou) break;
    }
    Object.keys(diagsObj).forEach(function (n) { if (!diags[n]) delete diagsObj[n]; });
    var novas = [];
    N.perguntasDoCaminho(defD, cand, diags, {}).forEach(function (q) { if (!cand[q]) novas.push({ codigo: q, motivo: rejeitadas[q] || 'sem-resposta' }); });
    N.diagnosticosNecessarios(defD, cand, diags, {}).forEach(function (n) {
      if (!diags[n]) novas.push({ codigo: defD.diagnostico.codigo + ':' + n, motivo: rejeitadas['D1:' + n] || 'sem-resposta' });
    });
    N.predominanciasNecessarias(defD, cand, diags, {}).forEach(function (x) { novas.push({ codigo: 'DIAG_PREDOMINANCIA_' + x.nivel, motivo: 'd2-nunca-herdada' }); });
    var respostasObj = {};
    Object.keys(cand).forEach(function (q) { respostasObj[q] = reg.respostas[q]; });
    var res = N.avaliar(defD, cand, diags, {});
    var completo = !novas.length && !/_(RESPOSTA_FALTANDO|DIAGNOSTICO_PENDENTE|PREDOMINANCIA_PENDENTE)$/.test(res.regra);
    return { respostas: respostasObj, diagnosticos: diagsObj, novas: novas, d2Descartadas: Object.keys(reg.predominancias || {}),
      completo: completo, resultado: completo ? res : null };
  }

  /* ---------- impacto sobre registros reais (só leitura) ---------- */
  function simplesDe(reg) {
    var r = {}, d = {}, p = {};
    Object.keys(reg.respostas || {}).forEach(function (q) { var v = reg.respostas[q] && reg.respostas[q].resposta; if (v === 'SIM' || v === 'NAO') r[q] = v; });
    Object.keys(reg.diagnosticos || {}).forEach(function (n) { var v = reg.diagnosticos[n] && reg.diagnosticos[n].resposta; if (v === 'mesma' || v === 'distintas') d[n] = v; });
    Object.keys(reg.predominancias || {}).forEach(function (n) { var v = reg.predominancias[n] && reg.predominancias[n].resposta; if (typeof v === 'string' && v) p[n] = v; });
    return { r: r, d: d, p: p };
  }
  function mesmoResultado(a, b) {
    return a.codigoResultado === b.codigoResultado && (a.tipoAValidar || null) === (b.tipoAValidar || null) && a.liberaSquad === b.liberaSquad;
  }
  /* o: { destino: def, registros: [{ id, reg, decisao? }], conteudoOrigem(reg, codigo, versao), conteudoDestino(codigo),
          mesmoConteudo, destinoRotulo? }
     Só avaliações CONCLUÍDAS entram; rascunho e descartada ficam em foraDoEscopo. */
  function classificarImpacto(N, o) {
    var out = { iguais: [], alterados: [], incomparaveis: [], violacoes: [], foraDoEscopo: [], total: 0 };
    (o.registros || []).forEach(function (x) {
      var reg = x.reg || {};
      if (reg.status !== 'concluido') { out.foraDoEscopo.push({ id: x.id, status: reg.status || null }); return; }
      out.total++;
      var vo = typeof reg.versaoMotor === 'number' ? reg.versaoMotor : 1, defO;
      try { defO = N.definicao(vo); } catch (e) { out.incomparaveis.push({ id: x.id, motivo: 'versao-desconhecida' }); return; }
      var ra = reg.resultadoAutomatico;
      if (!ra || !ra.codigoResultado || !reg.respostas) { out.incomparaveis.push({ id: x.id, motivo: 'dados-incompletos' }); return; }
      var s = simplesDe(reg), recalc = N.avaliar(defO, s.r, s.d, s.p);
      var gravado = { codigoResultado: ra.codigoResultado, tipoAValidar: ra.tipoAValidar || null, liberaSquad: ra.liberaSquad === true, nivelConfirmado: ra.nivelConfirmado || null };
      if (violaLinhaSquad(gravado)) out.violacoes.push({ id: x.id, onde: 'gravado' });
      if (!mesmoResultado(recalc, gravado) || recalc.regra !== ra.regra) { out.incomparaveis.push({ id: x.id, motivo: 'resultado-gravado-diverge' }); return; }
      var h;
      try {
        h = herdarEntreVersoes(N, { origem: { def: defO, reg: reg }, destino: { def: o.destino },
          conteudoOrigem: function (c, v) { return o.conteudoOrigem(reg, c, v); }, conteudoDestino: o.conteudoDestino, mesmoConteudo: o.mesmoConteudo });
      } catch (e) { out.incomparaveis.push({ id: x.id, motivo: 'erro-na-comparacao' }); return; }
      if (!h.completo) { out.incomparaveis.push({ id: x.id, motivo: 'exige-novas-respostas', novas: h.novas }); return; }
      if (violaLinhaSquad(h.resultado)) out.violacoes.push({ id: x.id, onde: 'destino' });
      var linha = { id: x.id, de: gravado.codigoResultado, para: h.resultado.codigoResultado, liberaSquadDe: gravado.liberaSquad, liberaSquadPara: h.resultado.liberaSquad,
        comDecisao: !!x.decisao };
      if (mesmoResultado(h.resultado, gravado)) out.iguais.push(linha); else out.alterados.push(linha);
    });
    out.digest = digest({ iguais: out.iguais.map(function (l) { return l.id; }).sort(), alterados: out.alterados.map(function (l) { return l.id + '>' + l.para; }).sort(),
      incomparaveis: out.incomparaveis.map(function (l) { return l.id + ':' + l.motivo; }).sort(), violacoes: out.violacoes.map(function (l) { return l.id + ':' + l.onde; }).sort() });
    return out;
  }

  /* ---------- prontidão técnica (não é autorização) ---------- */
  /* o: { emVigor: def em vigor, redacoesPublicadas: [conteúdos publicados com {publicado, versao, codigo, motorCompativel, perguntas}],
          redacaoValidada: true só quando a fronteira confiável validou a redação publicada (nunca a tela),
          simulacao?: resultado de N.simular(emVigor, def), impacto?: classificarImpacto(...) } */
  function prontidao(N, def, o) {
    o = o || {};
    var itens = [];
    function item(codigo, ok, detalhe) { itens.push({ codigo: codigo, ok: !!ok, detalhe: detalhe || null }); }
    var v = N.validarDefinicao(def);
    item('DEFINICAO_VALIDA', v.valida, v.valida ? null : v.erros.map(function (e) { return e.codigo; }).join(', '));
    var emVigor = o.emVigor && o.emVigor.versao === def.versao;
    item('VERSAO_DIFERENTE_DA_EM_VIGOR', !emVigor, emVigor ? 'já é a versão em vigor' : null);
    var pv = N.podeEntrarEmVigor(def, o.redacoesPublicadas || []);
    item('REDACAO_PUBLICADA_COMPATIVEL', pv.pode, pv.pode ? 'redação v' + pv.conteudo : pv.motivo);
    /* B2: publicada não é validada — só a fronteira confiável (fase b, B4) confirma, no servidor, que a redação
       publicada é íntegra e compatível; sem isso a versão não está apta a entrar em vigor */
    item('REDACAO_VALIDADA_FRONTEIRA', o.redacaoValidada === true, o.redacaoValidada === true ? null : 'pendente da fronteira confiável');
    var sim = o.simulacao;
    item('SIMULACAO_EXECUTADA', !!sim, sim ? sim.totalEstados + ' estados' : 'não executada');
    item('SIMULACAO_SEM_VIOLACAO_LINHA_SQUAD', !!sim && sim.violacoesLinhaSquad === 0, sim ? String(sim.violacoesLinhaSquad) : null);
    var imp = o.impacto;
    item('IMPACTO_CALCULADO', !!imp, imp ? imp.total + ' concluídas' : 'não calculado');
    item('IMPACTO_SEM_VIOLACAO_LINHA_SQUAD', !!imp && imp.violacoes.length === 0, imp ? String(imp.violacoes.length) : null);
    return { pronta: itens.every(function (i) { return i.ok; }), itens: itens, autorizada: false,
      aviso: 'Prontidão técnica não é autorização: a entrada em vigor exige aprovação explícita e registrada, vinculada à versão exata.' };
  }

  /* ---------- autorização explícita (vinculada à versão exata) ---------- */
  function emailNorm(p) { return p && typeof p.email === 'string' ? p.email.trim().toLowerCase() : null; }
  /* alvo: { versaoMotor, digestDefinicao, versaoRedacao, digestRedacao, digestImpacto }
     proposta: { alvo, propostoPor: {email} }
     aprovacoes: [{ alvo, aprovadoPor: {email}, reconhecimento: { digestImpacto, incomparaveis, alterados } }]
     o: { minimoAprovadores (padrão 2), impacto (classificarImpacto atual) } */
  function mesmoAlvo(a, b) {
    return !!a && !!b && ['versaoMotor', 'digestDefinicao', 'versaoRedacao', 'digestRedacao', 'digestImpacto'].every(function (k) { return a[k] !== undefined && a[k] !== null && a[k] === b[k]; });
  }
  function autorizacao(alvo, proposta, aprovacoes, o) {
    o = o || {};
    var minimo = typeof o.minimoAprovadores === 'number' && o.minimoAprovadores >= 1 ? o.minimoAprovadores : 2;
    var motivos = [];
    if (!proposta || !mesmoAlvo(proposta.alvo, alvo)) motivos.push('PROPOSTA_DE_OUTRA_VERSAO');
    var proponente = proposta && emailNorm(proposta.propostoPor);
    if (!proponente) motivos.push('PROPOSTA_SEM_AUTOR');
    var imp = o.impacto;
    if (!imp || imp.digest !== alvo.digestImpacto) motivos.push('IMPACTO_DESATUALIZADO');
    var validos = {}, recusadas = [];
    (aprovacoes || []).forEach(function (a, i) {
      var quem = emailNorm(a && a.aprovadoPor);
      if (!quem) { recusadas.push({ i: i, motivo: 'SEM_AUTOR' }); return; }
      if (quem === proponente) { recusadas.push({ i: i, motivo: 'PROPONENTE_NAO_APROVA' }); return; }
      if (!mesmoAlvo(a.alvo, alvo)) { recusadas.push({ i: i, motivo: 'APROVACAO_DE_OUTRA_VERSAO' }); return; }
      var rec = a.reconhecimento || {};
      if (!imp || rec.digestImpacto !== imp.digest || rec.incomparaveis !== imp.incomparaveis.length || rec.alterados !== imp.alterados.length) {
        recusadas.push({ i: i, motivo: 'SEM_RECONHECIMENTO_DO_IMPACTO' }); return;
      }
      if (validos[quem]) { recusadas.push({ i: i, motivo: 'APROVADOR_REPETIDO' }); return; }
      validos[quem] = true;
    });
    var n = Object.keys(validos).length;
    if (n < minimo) motivos.push('APROVACOES_INSUFICIENTES');
    return { autorizada: !motivos.length, motivos: motivos, aprovadores: Object.keys(validos), recusadas: recusadas, minimo: minimo };
  }
  /* a única resposta que "pode": prontidão + autorização + fronteira confiável (hoje inexistente: sempre não) */
  function decisaoDeVigencia(prontidaoRes, autorizacaoRes, fronteiraConfiavel) {
    var motivos = [];
    if (!prontidaoRes || !prontidaoRes.pronta) motivos.push('NAO_PRONTA');
    if (!autorizacaoRes || !autorizacaoRes.autorizada) motivos.push('NAO_AUTORIZADA');
    if (fronteiraConfiavel !== true) motivos.push('SEM_FRONTEIRA_CONFIAVEL');
    return { pode: !motivos.length, motivos: motivos };
  }

  var api = {
    digest: digest, digestRedacao: digestRedacao, liberaSquadEsperado: liberaSquadEsperado, violaLinhaSquad: violaLinhaSquad,
    herdarEntreVersoes: herdarEntreVersoes, classificarImpacto: classificarImpacto,
    prontidao: prontidao, autorizacao: autorizacao, decisaoDeVigencia: decisaoDeVigencia,
    CAMPOS_CRITERIO_BINARIA: CAMPOS_CRITERIO_BINARIA.slice(), CAMPOS_CRITERIO_D1: CAMPOS_CRITERIO_D1.slice()
  };
  Object.freeze(api.CAMPOS_CRITERIO_BINARIA); Object.freeze(api.CAMPOS_CRITERIO_D1); Object.freeze(api);
  if (typeof window !== 'undefined') window.faGovernancaPosicionamento = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
