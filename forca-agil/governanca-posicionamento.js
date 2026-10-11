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
   B3 (governança persistida — as regras do banco garantem o mesmo; nada aqui põe versão em vigor):
     alvoAtual / podePropor / situacaoProposta / podeAprovar / podeRetirar → proposta vinculada à definição, à redação
                                    PUBLICADA e ao impacto de agora; dois aprovadores de UIDs distintos, ao menos um admin
                                    geral, quem propõe não aprova; "desatualizada" quando o alvo de agora não é o da proposta.
     montarProposta / montarAprovacao / montarRetirada → as gravações (multipath) que a tela envia pela interface de
                                    serviços e que o B4 reutilizará no servidor.
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
  function uidDe(p) { return p && typeof p.uid === 'string' && p.uid ? p.uid : null; }
  /* B3: a identidade é o UID autenticado (o e-mail também é conferido: nenhum dos dois pode repetir) */
  function mesmaPessoa(a, b) {
    var ua = uidDe(a), ub = uidDe(b), ea = emailNorm(a), eb = emailNorm(b);
    return (!!ua && ua === ub) || (!!ea && ea === eb);
  }
  /* alvo: { versaoMotor, digestDefinicao, versaoRedacao, digestRedacao, digestImpacto }
     proposta: { alvo, propostoPor: {uid, email} }
     aprovacoes: [{ alvo, aprovadoPor: {uid, email}, adminGeral, reconhecimento: { digestImpacto, incomparaveis, alterados } }]
     o: { minimoAprovadores (padrão 2), minimoAdminGeral (padrão 1), impacto (classificarImpacto atual) } */
  function mesmoAlvo(a, b) {
    return !!a && !!b && ['versaoMotor', 'digestDefinicao', 'versaoRedacao', 'digestRedacao', 'digestImpacto'].every(function (k) { return a[k] !== undefined && a[k] !== null && a[k] === b[k]; });
  }
  function autorizacao(alvo, proposta, aprovacoes, o) {
    o = o || {};
    var minimo = typeof o.minimoAprovadores === 'number' && o.minimoAprovadores >= 1 ? o.minimoAprovadores : 2;
    var minimoAdm = typeof o.minimoAdminGeral === 'number' && o.minimoAdminGeral >= 0 ? o.minimoAdminGeral : 1;
    var motivos = [];
    if (!proposta || !mesmoAlvo(proposta.alvo, alvo)) motivos.push('PROPOSTA_DE_OUTRA_VERSAO');
    var proponente = proposta && proposta.propostoPor;
    if (!uidDe(proponente) && !emailNorm(proponente)) motivos.push('PROPOSTA_SEM_AUTOR');
    var imp = o.impacto;
    if (!imp || imp.digest !== alvo.digestImpacto) motivos.push('IMPACTO_DESATUALIZADO');
    var validos = [], recusadas = [];
    (aprovacoes || []).forEach(function (a, i) {
      var quem = a && a.aprovadoPor;
      if (!uidDe(quem) && !emailNorm(quem)) { recusadas.push({ i: i, motivo: 'SEM_AUTOR' }); return; }
      if (mesmaPessoa(quem, proponente)) { recusadas.push({ i: i, motivo: 'PROPONENTE_NAO_APROVA' }); return; }
      if (!mesmoAlvo(a.alvo, alvo)) { recusadas.push({ i: i, motivo: 'APROVACAO_DE_OUTRA_VERSAO' }); return; }
      var rec = a.reconhecimento || {};
      if (!imp || rec.digestImpacto !== imp.digest || rec.incomparaveis !== imp.incomparaveis.length || rec.alterados !== imp.alterados.length) {
        recusadas.push({ i: i, motivo: 'SEM_RECONHECIMENTO_DO_IMPACTO' }); return;
      }
      if (validos.some(function (v) { return mesmaPessoa(v.quem, quem); })) { recusadas.push({ i: i, motivo: 'APROVADOR_REPETIDO' }); return; }
      validos.push({ quem: quem, adminGeral: a.adminGeral === true });
    });
    if (validos.length < minimo) motivos.push('APROVACOES_INSUFICIENTES');
    if (validos.filter(function (v) { return v.adminGeral; }).length < minimoAdm) motivos.push('SEM_ADMIN_GERAL');
    return { autorizada: !motivos.length, motivos: motivos, aprovadores: validos.map(function (v) { return uidDe(v.quem) || emailNorm(v.quem); }), recusadas: recusadas, minimo: minimo, minimoAdminGeral: minimoAdm };
  }
  /* a única resposta que "pode": prontidão + autorização + fronteira confiável (hoje inexistente: sempre não) */
  function decisaoDeVigencia(prontidaoRes, autorizacaoRes, fronteiraConfiavel) {
    var motivos = [];
    if (!prontidaoRes || !prontidaoRes.pronta) motivos.push('NAO_PRONTA');
    if (!autorizacaoRes || !autorizacaoRes.autorizada) motivos.push('NAO_AUTORIZADA');
    if (fronteiraConfiavel !== true) motivos.push('SEM_FRONTEIRA_CONFIAVEL');
    return { pode: !motivos.length, motivos: motivos };
  }


  /* ---------- B3: governança persistida (proposta → aprovação dupla → aprovada | retirada) ----------
     Regra de negócio pura e montadores das gravações; as regras do banco garantem o mesmo (identidade por UID,
     horário do servidor, separação de papéis, admin geral, imutabilidade, auditoria). Nada aqui põe versão em vigor:
     quem consome uma proposta aprovada é a fronteira confiável (B4), que recalcula definição e impacto no servidor. */
  var NOS = Object.freeze({ propostas: 'posicionamento-motor-propostas', aberta: 'posicionamento-motor-proposta-aberta',
    auditoria: 'posicionamento-motor-governanca-auditoria', vigencia: 'posicionamento-motor-vigencia' });
  /* ausente = 1 (nada grava este nó antes do B4) */
  function versaoEmVigorRegistrada(vigencia) {
    var v = vigencia && vigencia.versaoEmVigor;
    return typeof v === 'number' && v >= 1 && v % 1 === 0 ? v : 1;
  }
  /* o alvo exato de uma proposta: definição do motor, redação PUBLICADA e impacto calculados agora */
  function alvoAtual(o) {
    if (!o || !o.definicao || !o.redacao || !o.impacto) return null;
    var im = o.impacto;
    return { digestDefinicao: digest(o.definicao), versaoRedacao: o.redacao.versao, digestRedacao: digestRedacao(o.redacao.perguntas),
      digestImpacto: im.digest, impacto: { total: im.total, iguais: im.iguais.length, alterados: im.alterados.length, incomparaveis: im.incomparaveis.length, violacoes: im.violacoes.length } };
  }
  function mesmoAlvoPersistido(a, b) {
    return !!a && !!b && ['digestDefinicao', 'versaoRedacao', 'digestRedacao', 'digestImpacto'].every(function (k) { return a[k] !== undefined && a[k] !== null && a[k] === b[k]; });
  }
  /* pode propor? tudo da prontidão técnica, menos a validação pela fronteira confiável (é do B4, na ativação) */
  function podePropor(prontidaoRes, o) {
    o = o || {};
    var faltando = ((prontidaoRes && prontidaoRes.itens) || []).filter(function (i) { return !i.ok && i.codigo !== 'REDACAO_VALIDADA_FRONTEIRA'; }).map(function (i) { return i.codigo; });
    if (!prontidaoRes) faltando.push('PRONTIDAO_NAO_AVALIADA');
    if (!o.alvo) faltando.push('ALVO_NAO_CALCULADO');
    else if (o.alvo.impacto.violacoes !== 0) faltando.push('IMPACTO_COM_VIOLACAO');
    if (o.propostaAberta) faltando.push('JA_HA_PROPOSTA_ABERTA');
    if (!o.podeGravar) faltando.push('SEM_PERMISSAO');
    return { pode: !faltando.length, faltando: faltando };
  }
  function aprovacoesDe(prop) {
    var a = (prop && prop.aprovacoes) || {};
    return ['a1', 'a2'].filter(function (k) { return a[k]; }).map(function (k) { return { posicao: k, uid: a[k].uid, email: a[k].email, adminGeral: a[k].adminGeral === true, em: a[k].em, reconhecimento: a[k].reconhecimento }; });
  }
  /* situação de uma proposta gravada; "desatualizada" = o alvo calculado agora não é o da proposta (nada é gravado) */
  function situacaoProposta(prop, alvoDeAgora) {
    var sit = prop && prop.situacao, aps = aprovacoesDe(prop);
    var desatualizada = sit !== 'retirada' && !!alvoDeAgora && !mesmoAlvoPersistido(prop.alvo, alvoDeAgora);
    var r = { situacao: sit, aprovacoes: aps, desatualizada: desatualizada, conferida: !!alvoDeAgora, proximaPosicao: sit === 'aberta' ? (aps.length ? 'a2' : 'a1') : null };
    if (sit === 'aprovada') {
      var alvoAut = Object.assign({ versaoMotor: prop.versaoMotor }, prop.alvo);
      var impFake = { digest: prop.alvo.digestImpacto, incomparaveis: { length: prop.alvo.impacto.incomparaveis }, alterados: { length: prop.alvo.impacto.alterados } };
      r.autorizacao = autorizacao(alvoAut, { alvo: alvoAut, propostoPor: prop.propostoPor },
        aps.map(function (a) { return { alvo: alvoAut, aprovadoPor: { uid: a.uid, email: a.email }, adminGeral: a.adminGeral, reconhecimento: a.reconhecimento }; }), { impacto: impFake });
    }
    return r;
  }
  /* usuario: { uid, email, adminGeral, podeGravar } */
  function podeAprovar(prop, usuario, alvoDeAgora) {
    var st = situacaoProposta(prop, alvoDeAgora);
    if (st.situacao !== 'aberta') return { pode: false, motivo: 'NAO_ABERTA' };
    if (!usuario || !usuario.uid || !usuario.podeGravar) return { pode: false, motivo: 'SEM_PERMISSAO' };
    if (mesmaPessoa(usuario, prop.propostoPor)) return { pode: false, motivo: 'PROPONENTE_NAO_APROVA' };
    if (st.aprovacoes.some(function (a) { return mesmaPessoa(usuario, a); })) return { pode: false, motivo: 'JA_APROVOU' };
    if (!st.conferida) return { pode: false, motivo: 'CONFERIR_IMPACTO' };
    if (st.desatualizada) return { pode: false, motivo: 'DESATUALIZADA' };
    if (st.proximaPosicao === 'a2' && !usuario.adminGeral && !st.aprovacoes[0].adminGeral) return { pode: false, motivo: 'PRECISA_ADMIN_GERAL' };
    return { pode: true, posicao: st.proximaPosicao };
  }
  function podeRetirar(prop, usuario) {
    if (!prop || prop.situacao !== 'aberta') return { pode: false, motivo: 'NAO_ABERTA' };
    if (!usuario || !usuario.uid) return { pode: false, motivo: 'SEM_PERMISSAO' };
    if (usuario.adminGeral || (usuario.podeGravar && uidDe(prop.propostoPor) === usuario.uid)) return { pode: true };
    return { pode: false, motivo: 'SO_PROPONENTE_OU_ADMIN_GERAL' };
  }
  function quemGrava(u) { return { uid: u.uid, email: u.email }; }
  /* o: { propostaId, auditoriaId, versaoMotor, alvo, justificativa, usuario {uid,email}, agora (marca do horário do servidor) } */
  function montarProposta(o) {
    var u = {}, quem = quemGrava(o.usuario);
    u[NOS.propostas + '/' + o.propostaId] = { versaoMotor: o.versaoMotor, alvo: o.alvo, justificativa: String(o.justificativa || '').trim().slice(0, 1000),
      propostoPor: quem, propostoEm: o.agora, situacao: 'aberta', auditoriaId: o.auditoriaId };
    u[NOS.aberta + '/' + o.versaoMotor] = o.propostaId;
    u[NOS.auditoria + '/' + o.auditoriaId] = { tipo: 'proposta', propostaId: o.propostaId, versaoMotor: o.versaoMotor, usuario: quem, dataHora: o.agora };
    return u;
  }
  /* o: { propostaId, proposta, auditoriaId, usuario {uid,email}, adminGeral, agora }; na 2ª aprovação a mesma gravação
     marca "aprovada" e libera o índice de proposta aberta */
  function montarAprovacao(o) {
    var st = situacaoProposta(o.proposta, null), pos = st.proximaPosicao, u = {}, quem = quemGrava(o.usuario), base = NOS.propostas + '/' + o.propostaId;
    if (!pos) return null;
    u[base + '/aprovacoes/' + pos] = { uid: quem.uid, email: quem.email, em: o.agora, adminGeral: o.adminGeral === true, auditoriaId: o.auditoriaId,
      reconhecimento: { digestImpacto: o.proposta.alvo.digestImpacto, alterados: o.proposta.alvo.impacto.alterados, incomparaveis: o.proposta.alvo.impacto.incomparaveis } };
    if (pos === 'a2') { u[base + '/situacao'] = 'aprovada'; u[NOS.aberta + '/' + o.proposta.versaoMotor] = null; }
    u[NOS.auditoria + '/' + o.auditoriaId] = { tipo: 'aprovacao', propostaId: o.propostaId, versaoMotor: o.proposta.versaoMotor, posicao: pos, usuario: quem, dataHora: o.agora };
    return u;
  }
  /* o: { propostaId, proposta, auditoriaId, motivo, usuario {uid,email}, agora }; libera o índice na mesma gravação */
  function montarRetirada(o) {
    var u = {}, quem = quemGrava(o.usuario), base = NOS.propostas + '/' + o.propostaId, motivo = String(o.motivo || '').trim().slice(0, 500);
    if (!motivo) return null;
    u[base + '/situacao'] = 'retirada';
    u[base + '/retirada'] = { motivo: motivo, por: quem, em: o.agora, auditoriaId: o.auditoriaId };
    u[NOS.aberta + '/' + o.proposta.versaoMotor] = null;
    u[NOS.auditoria + '/' + o.auditoriaId] = { tipo: 'retirada', propostaId: o.propostaId, versaoMotor: o.proposta.versaoMotor, motivo: motivo, usuario: quem, dataHora: o.agora };
    return u;
  }

  /* H3-b — a redação da v1 é a da TRILHA PRINCIPAL do questionário (não tem versões próprias do motor nem identificador
     gravado): monta-se pelo contrato do motor v1 com o conteúdo daquela versão; o digest é recalculado (tela e servidor). */
  function redacaoDaTrilhaPrincipal(N, conteudoPergunta, versao) {
    var def = N.definicao(1);
    return { versao: versao, motorCompativel: 1, perguntas: N.contratoDoQuestionario(def).itens.map(function (it) {
      var c = conteudoPergunta(it.codigoEstavel, versao) || {};
      var p = {};
      Object.keys(c).forEach(function (k) { p[k] = c[k]; });
      p.codigoEstavel = it.codigoEstavel; p.tipo = it.tipo;
      return p;
    }) };
  }

  var api = {
    digest: digest, digestRedacao: digestRedacao, liberaSquadEsperado: liberaSquadEsperado, violaLinhaSquad: violaLinhaSquad,
    herdarEntreVersoes: herdarEntreVersoes, classificarImpacto: classificarImpacto,
    prontidao: prontidao, autorizacao: autorizacao, decisaoDeVigencia: decisaoDeVigencia,
    NOS: NOS, versaoEmVigorRegistrada: versaoEmVigorRegistrada, redacaoDaTrilhaPrincipal: redacaoDaTrilhaPrincipal, alvoAtual: alvoAtual, podePropor: podePropor, situacaoProposta: situacaoProposta,
    podeAprovar: podeAprovar, podeRetirar: podeRetirar, montarProposta: montarProposta, montarAprovacao: montarAprovacao, montarRetirada: montarRetirada,
    CAMPOS_CRITERIO_BINARIA: CAMPOS_CRITERIO_BINARIA.slice(), CAMPOS_CRITERIO_D1: CAMPOS_CRITERIO_D1.slice()
  };
  Object.freeze(api.CAMPOS_CRITERIO_BINARIA); Object.freeze(api.CAMPOS_CRITERIO_D1); Object.freeze(api);
  if (typeof window !== 'undefined') window.faGovernancaPosicionamento = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
