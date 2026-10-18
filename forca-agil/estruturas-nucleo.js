/* ============================================================
   Força Ágil — Núcleo de Avaliação, Taxonomia e Mapa da Floresta
   ESTRUTURAS ORGANIZACIONAIS CONCRETAS — domínio puro
   (window.faEstruturasNucleo; em Node, module.exports)

   Três níveis que não se misturam:
     - CONCEITO organizacional (Taxonomia): o que PODE existir — um tipo (ex.: Negócios, CoE, Squad);
     - ESTRUTURA concreta: o que EXISTE na organização — uma unidade real, com nome, de um tipo;
     - OBJETO avaliado: o item do Núcleo de Avaliação (itemId). Não é criado aqui.

   PURO E INDEPENDENTE DE INFRAESTRUTURA: sem Firebase, sem SQL, sem NestJS, sem DOM, sem autenticação, sem rede,
   sem relógio e sem gerador de identificadores. Tudo o que vem de fora entra como parâmetro:
     - estado: { estruturas, relacoes, vinculos } — objetos por identificador (o que a persistência leu);
     - ref (referências OFICIAIS, lidas por quem chama — o núcleo nunca consulta a Taxonomia nem o motor):
         conceitos:          { <codigo>: { ativo, pai? } }          — conceitos da Taxonomia Organizacional
         relacoesConceituais:[ { de, tipo, para, ativa } ]          — relações oficiais entre conceitos
         herancaPeloPai:     boolean (padrão false)                 — só true se as regras oficiais da Taxonomia
                                                                      previrem herança de relações pelo conceito pai
         ligacoes:           { <codigoMotor>: <codigoConceito> }    — correspondência OFICIAL código do motor ↔ conceito
         codigosFirmes:      [ <codigoMotor> … ]                    — os posicionamentos firmes do motor
         conceitosTrabalho:  [ <codigoConceito> … ]                 — os conceitos oficiais de Squad e Capítulo
     - ctx (quem executa): { operacaoId, novoId?, usuario: { id, email? }, agora } — identificadores, autoria
       e horário são fornecidos por quem chama; o núcleo não gera nenhum. agora: instante em MILISSEGUNDOS UTC desde
       a época Unix (inteiro positivo; formato canônico do contrato, sempre do servidor) ou, por compatibilidade com
       os registros e o backend já existentes, texto ISO 8601. O núcleo só REGISTRA o horário (nunca decide nada com
       ele); historico() ordena pelo instante real, com os dois formatos misturados.
   Cada operação devolve { ok: true, mudancas, eventos } ou { ok: false, erros: [{ codigo, ... }] }, sem alterar o
   estado recebido. mudancas = [{ entidade, id, antes, depois, revisaoAnterior }] (semânticas, sem caminho de banco);
   eventos = o histórico/auditoria da operação (só acréscimo). aplicar(estado, mudancas) devolve o estado novo —
   o mesmo contrato que um adaptador de persistência cumpre gravando as mudanças de uma vez (tudo ou nada).

   Regras (delimitação funcional aprovada): E1–E6, R1–R7, V1–V8, S1–S3 e, desde a M6/M7 do Mapa, C3: uma estrutura da
   organização do trabalho (Squad) compõe no máximo UMA estrutura de tipo de posicionamento (a Linha) ativa — trocar é
   substituir (alterarRelacao), com motivo. Nada aqui decide unicidade de nome/sigla, carga inicial ou infraestrutura.
   ============================================================ */
(function () {
  'use strict';

  var TIPOS_RELACAO = ['compoe', 'aloca-em', 'atende', 'desenvolve-disciplina', 'pertence-a-disciplina'];
  /* só "compõe" é hierarquia de composição (sem ciclos); "pertence à disciplina" NÃO é tratada como composição */
  var RELACAO_HIERARQUICA = 'compoe';
  /* E3: a colaboradora é o MESMO registro de vínculo com outro papel (nunca vira principal sozinha) */
  var PAPEIS_VINCULO = ['responsavel-principal', 'colaboradora'];
  var PRINCIPAL = 'responsavel-principal', COLABORADORA = 'colaboradora';
  /* E2: motivos organizacionais de uma alocação em estrutura de tipo diferente do posicionamento efetivo */
  var MOTIVOS_DIVERGENCIA = ['pessoas', 'escala', 'custo', 'afinidade', 'prioridade', 'viabilidade', 'outro'];
  var SITUACAO = { ATIVA: 'ativa', ENCERRADA: 'encerrada' };
  var MAX = { nome: 200, sigla: 30, descricao: 4000, motivo: 500, justificativa: 2000, autoridade: 200, referencia: 500 };

  /* ---------------- utilitários puros ---------------- */
  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  function congelar(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.keys(o).forEach(function (k) { congelar(o[k]); }); }
    return o;
  }
  function texto(v) { return typeof v === 'string' ? v.trim() : ''; }
  function vazio(v) { return !texto(v); }
  function erro(codigo, extra) { var e = {}; if (extra) Object.keys(extra).forEach(function (k) { e[k] = extra[k]; }); e.codigo = codigo; return e; } /* o código do erro nunca é sobrescrito */
  function falha(erros) { return congelar({ ok: false, erros: erros }); }
  function sucesso(mudancas, eventos) { return congelar({ ok: true, mudancas: mudancas, eventos: eventos }); }
  function colecao(estado, nome) { return (estado && estado[nome]) || {}; }
  function valores(obj) { return Object.keys(obj || {}).map(function (k) { return obj[k]; }); }

  function validarCtx(ctx, precisaNovoId) {
    var e = [];
    if (!ctx || typeof ctx !== 'object') return [erro('CONTEXTO_INVALIDO')];
    if (vazio(ctx.operacaoId)) e.push(erro('CONTEXTO_SEM_OPERACAO'));
    if (!ctx.usuario || vazio(ctx.usuario.id)) e.push(erro('CONTEXTO_SEM_USUARIO'));
    if (instante(ctx.agora) === null) e.push(erro('CONTEXTO_SEM_HORARIO'));
    if (precisaNovoId && vazio(ctx.novoId)) e.push(erro('CONTEXTO_SEM_IDENTIFICADOR'));
    return e;
  }
  /* instante de um horário do contrato: milissegundos UTC (inteiro positivo) ou ISO 8601; null se inválido */
  function instante(v) {
    if (typeof v === 'number') return Number.isInteger(v) && v > 0 ? v : null;
    if (typeof v === 'string' && !vazio(v)) { var t = Date.parse(v); return isNaN(t) ? null : t; }
    return null;
  }
  function autor(ctx) { var u = { id: ctx.usuario.id }; if (ctx.usuario.email) u.email = ctx.usuario.email; return u; }
  function evento(ctx, n, tipo, entidade, id, antes, depois, extra) {
    var ev = { id: ctx.operacaoId + ':' + n, operacaoId: ctx.operacaoId, tipo: tipo, entidade: entidade, entidadeId: id,
      antes: clone(antes) || null, depois: clone(depois) || null, usuario: autor(ctx), em: ctx.agora };
    if (extra) Object.keys(extra).forEach(function (k) { if (extra[k] !== undefined && extra[k] !== null) ev[k] = extra[k]; });
    return ev;
  }
  function mudanca(entidade, id, antes, depois) {
    return { entidade: entidade, id: id, antes: clone(antes) || null, depois: clone(depois), revisaoAnterior: antes ? antes.revisao : null };
  }
  function checarTexto(e, campo, v, obrigatorio) {
    if (v === undefined || v === null || v === '') { if (obrigatorio) e.push(erro('CAMPO_OBRIGATORIO', { campo: campo })); return; }
    if (typeof v !== 'string') { e.push(erro('CAMPO_INVALIDO', { campo: campo })); return; }
    if (obrigatorio && vazio(v)) e.push(erro('CAMPO_OBRIGATORIO', { campo: campo }));
    if (v.length > MAX[campo]) e.push(erro('CAMPO_LONGO_DEMAIS', { campo: campo, maximo: MAX[campo] }));
  }
  function motivoValido(e, motivo) {
    if (vazio(motivo)) e.push(erro('MOTIVO_OBRIGATORIO'));
    else if (motivo.length > MAX.motivo) e.push(erro('CAMPO_LONGO_DEMAIS', { campo: 'motivo', maximo: MAX.motivo }));
  }
  function textoOuNulo(v) { return vazio(v) ? null : texto(v); }

  /* ---------------- referências oficiais ---------------- */
  function conceito(ref, codigo) { return ref && ref.conceitos ? ref.conceitos[codigo] : undefined; }
  function conceitoAtivo(ref, codigo) { var c = conceito(ref, codigo); return !!(c && c.ativo === true); }
  /* E1: tipos admitidos = os conceitos oficialmente ligados aos posicionamentos firmes + os conceitos de Squad e
     Capítulo informados pela Taxonomia. Nada é presumido: sem a ligação oficial, o tipo não é admitido. */
  function tiposAdmitidos(ref) {
    var t = {};
    ((ref && ref.codigosFirmes) || []).forEach(function (c) { var conc = ref.ligacoes && ref.ligacoes[c]; if (conc) t[conc] = 'posicionamento'; });
    ((ref && ref.conceitosTrabalho) || []).forEach(function (c) { t[c] = 'trabalho'; });
    return t;
  }
  function ancestrais(ref, codigo) {
    var lista = [codigo], visto = {}; visto[codigo] = true;
    if (!(ref && ref.herancaPeloPai === true)) return lista;
    var c = conceito(ref, codigo);
    while (c && c.pai && !visto[c.pai]) { lista.push(c.pai); visto[c.pai] = true; c = conceito(ref, c.pai); }
    return lista;
  }
  /* R2: existe relação conceitual ATIVA do mesmo tipo entre os conceitos (ou ancestrais, só com herança oficial) */
  function relacaoConceitualAdmite(ref, tipoOrigem, tipo, tipoDestino) {
    var de = ancestrais(ref, tipoOrigem), para = ancestrais(ref, tipoDestino);
    return ((ref && ref.relacoesConceituais) || []).some(function (r) {
      return r && r.ativa === true && r.tipo === tipo && de.indexOf(r.de) !== -1 && para.indexOf(r.para) !== -1;
    });
  }

  /* ---------------- ESTRUTURAS (E1–E6) ---------------- */
  function criarEstrutura(estado, dados, ctx, ref) {
    var e = validarCtx(ctx, true), d = dados || {};
    if (e.length) return falha(e);
    if (colecao(estado, 'estruturas')[ctx.novoId]) e.push(erro('IDENTIFICADOR_JA_USADO', { id: ctx.novoId })); /* E1: nunca reaproveitado */
    checarTexto(e, 'nome', d.nome, true);
    checarTexto(e, 'sigla', d.sigla, false);
    checarTexto(e, 'descricao', d.descricao, false);
    var adm = tiposAdmitidos(ref);
    if (vazio(d.tipo)) e.push(erro('CAMPO_OBRIGATORIO', { campo: 'tipo' }));
    else if (!adm[d.tipo]) e.push(erro('TIPO_NAO_ADMITIDO', { tipo: d.tipo }));
    else if (!conceitoAtivo(ref, d.tipo)) e.push(erro('CONCEITO_INATIVO_OU_INEXISTENTE', { tipo: d.tipo }));
    if (e.length) return falha(e);
    var est = { id: ctx.novoId, tipo: d.tipo, nome: texto(d.nome), sigla: textoOuNulo(d.sigla), descricao: textoOuNulo(d.descricao),
      situacao: SITUACAO.ATIVA, criadaEm: ctx.agora, criadaPor: autor(ctx), revisao: 1 };
    return sucesso([mudanca('estrutura', est.id, null, est)], [evento(ctx, 1, 'estrutura.criada', 'estrutura', est.id, null, est)]);
  }
  /* E3: nome, sigla e descrição mudam com histórico; o tipo é imutável (corrigir = encerrar e cadastrar outra) */
  function alterarEstrutura(estado, id, alteracoes, ctx, opcoes) {
    var e = validarCtx(ctx, false), a = alteracoes || {}, o = opcoes || {};
    if (e.length) return falha(e);
    var atual = colecao(estado, 'estruturas')[id];
    if (!atual) return falha([erro('ESTRUTURA_INEXISTENTE', { id: id })]);
    if (atual.situacao !== SITUACAO.ATIVA) return falha([erro('ESTRUTURA_ENCERRADA', { id: id })]);
    if (o.revisaoEsperada !== undefined && o.revisaoEsperada !== atual.revisao) return falha([erro('REVISAO_DESATUALIZADA', { esperada: o.revisaoEsperada, atual: atual.revisao })]);
    Object.keys(a).forEach(function (k) {
      if (k === 'tipo') { if (a.tipo !== atual.tipo) e.push(erro('TIPO_IMUTAVEL')); }
      else if (['nome', 'sigla', 'descricao'].indexOf(k) === -1) e.push(erro('CAMPO_NAO_ALTERAVEL', { campo: k }));
    });
    if ('nome' in a) checarTexto(e, 'nome', a.nome, true);
    if ('sigla' in a) checarTexto(e, 'sigla', a.sigla, false);
    if ('descricao' in a) checarTexto(e, 'descricao', a.descricao, false);
    if (o.justificativa !== undefined && o.justificativa !== null) checarTexto(e, 'justificativa', o.justificativa, false);
    if (e.length) return falha(e);
    var depois = clone(atual), mudou = [];
    ['nome', 'sigla', 'descricao'].forEach(function (k) {
      if (!(k in a)) return;
      var v = k === 'nome' ? texto(a[k]) : textoOuNulo(a[k]);
      if (v !== atual[k]) { depois[k] = v; mudou.push(k); }
    });
    if (!mudou.length) return falha([erro('NADA_A_ALTERAR')]);
    depois.revisao = atual.revisao + 1; depois.alteradaEm = ctx.agora; depois.alteradaPor = autor(ctx);
    return sucesso([mudanca('estrutura', id, atual, depois)],
      [evento(ctx, 1, 'estrutura.alterada', 'estrutura', id, atual, depois, { campos: mudou, justificativa: textoOuNulo(o.justificativa) })]);
  }
  /* E2: encerra (nunca apaga), com motivo. Não reativa. Não encerra nada em cascata: relações e vínculos dela passam
     a aparecer como "a revisar" / "precisa de revisão" (situações calculadas). */
  function encerrarEstrutura(estado, id, motivo, ctx, opcoes) {
    var e = validarCtx(ctx, false), o = opcoes || {};
    if (e.length) return falha(e);
    var atual = colecao(estado, 'estruturas')[id];
    if (!atual) return falha([erro('ESTRUTURA_INEXISTENTE', { id: id })]);
    if (atual.situacao !== SITUACAO.ATIVA) return falha([erro('ESTRUTURA_ENCERRADA', { id: id })]);
    if (o.revisaoEsperada !== undefined && o.revisaoEsperada !== atual.revisao) return falha([erro('REVISAO_DESATUALIZADA', { esperada: o.revisaoEsperada, atual: atual.revisao })]);
    motivoValido(e, motivo);
    if (e.length) return falha(e);
    var depois = clone(atual);
    depois.situacao = SITUACAO.ENCERRADA; depois.revisao = atual.revisao + 1;
    depois.encerramento = { motivo: texto(motivo), em: ctx.agora, por: autor(ctx) };
    return sucesso([mudanca('estrutura', id, atual, depois)], [evento(ctx, 1, 'estrutura.encerrada', 'estrutura', id, atual, depois, { motivo: texto(motivo) })]);
  }

  /* ---------------- RELAÇÕES ENTRE ESTRUTURAS (R1–R7) ---------------- */
  function relacoesAtivas(estado) { return valores(colecao(estado, 'relacoes')).filter(function (r) { return r.situacao === SITUACAO.ATIVA; }); }
  /* R4: adicionar origem —compõe→ destino cria ciclo se destino já alcança origem pelas composições ativas */
  function criaCiclo(estado, origem, destino, ignorarId) {
    var arestas = {};
    relacoesAtivas(estado).forEach(function (r) {
      if (r.tipo !== RELACAO_HIERARQUICA || r.id === ignorarId) return;
      (arestas[r.origem] = arestas[r.origem] || []).push(r.destino);
    });
    var pilha = [destino], visto = {};
    while (pilha.length) {
      var n = pilha.pop();
      if (n === origem) return true;
      if (visto[n]) continue; visto[n] = true;
      (arestas[n] || []).forEach(function (m) { pilha.push(m); });
    }
    return false;
  }
  /* C3: a outra composição ATIVA de uma estrutura de trabalho com uma estrutura de tipo de posicionamento (ou null) */
  function composicaoDeTrabalhoAtiva(estado, d, ref, ignorarId) {
    var ests = colecao(estado, 'estruturas'), o = ests[d.origem], de = ests[d.destino], adm = tiposAdmitidos(ref);
    if (d.tipo !== RELACAO_HIERARQUICA || !o || !de || adm[o.tipo] !== 'trabalho' || adm[de.tipo] !== 'posicionamento') return null;
    return relacoesAtivas(estado).filter(function (r) {
      var x = ests[r.destino];
      return r.id !== ignorarId && r.origem === d.origem && r.tipo === RELACAO_HIERARQUICA && x && adm[x.tipo] === 'posicionamento';
    })[0] || null;
  }
  function validarRelacao(estado, d, ref, ignorarId) {
    var e = [], ests = colecao(estado, 'estruturas');
    if (TIPOS_RELACAO.indexOf(d.tipo) === -1) e.push(erro('TIPO_RELACAO_INVALIDO', { tipo: d.tipo }));
    if (vazio(d.origem) || vazio(d.destino)) { e.push(erro('CAMPO_OBRIGATORIO', { campo: vazio(d.origem) ? 'origem' : 'destino' })); return e; }
    if (d.origem === d.destino) e.push(erro('AUTORRELACAO'));
    var o = ests[d.origem], de = ests[d.destino];
    if (!o) e.push(erro('ESTRUTURA_INEXISTENTE', { id: d.origem })); else if (o.situacao !== SITUACAO.ATIVA) e.push(erro('ESTRUTURA_ENCERRADA', { id: d.origem }));
    if (!de) e.push(erro('ESTRUTURA_INEXISTENTE', { id: d.destino })); else if (de.situacao !== SITUACAO.ATIVA) e.push(erro('ESTRUTURA_ENCERRADA', { id: d.destino }));
    if (e.length) return e;
    if (!relacaoConceitualAdmite(ref, o.tipo, d.tipo, de.tipo)) e.push(erro('RELACAO_NAO_ADMITIDA_PELA_TAXONOMIA', { de: o.tipo, tipo: d.tipo, para: de.tipo }));
    if (relacoesAtivas(estado).some(function (r) { return r.id !== ignorarId && r.origem === d.origem && r.tipo === d.tipo && r.destino === d.destino; })) e.push(erro('RELACAO_DUPLICADA'));
    if (d.tipo === RELACAO_HIERARQUICA && criaCiclo(estado, d.origem, d.destino, ignorarId)) e.push(erro('CICLO_NA_COMPOSICAO'));
    /* C3: Squad (camada da organização do trabalho) compõe no máximo uma Linha (tipo de posicionamento) ativa */
    var outraComposicao = composicaoDeTrabalhoAtiva(estado, d, ref, ignorarId);
    if (outraComposicao) e.push(erro('COMPOSICAO_ATIVA_JA_EXISTE', { relacaoId: outraComposicao.id }));
    if (d.justificativa !== undefined && d.justificativa !== null) checarTexto(e, 'justificativa', d.justificativa, false);
    return e;
  }
  function novaRelacao(d, id, ctx) {
    return { id: id, origem: d.origem, tipo: d.tipo, destino: d.destino, justificativa: textoOuNulo(d.justificativa),
      situacao: SITUACAO.ATIVA, criadaEm: ctx.agora, criadaPor: autor(ctx), revisao: 1 };
  }
  function encerrada(atual, motivo, ctx, extra) {
    var depois = clone(atual);
    depois.situacao = SITUACAO.ENCERRADA; depois.revisao = atual.revisao + 1;
    depois.encerramento = Object.assign({ motivo: texto(motivo), em: ctx.agora, por: autor(ctx) }, extra || {});
    return depois;
  }
  function criarRelacao(estado, dados, ctx, ref) {
    var e = validarCtx(ctx, true), d = dados || {};
    if (e.length) return falha(e);
    if (colecao(estado, 'relacoes')[ctx.novoId]) return falha([erro('IDENTIFICADOR_JA_USADO', { id: ctx.novoId })]);
    e = validarRelacao(estado, d, ref, null);
    if (e.length) return falha(e);
    var r = novaRelacao(d, ctx.novoId, ctx);
    return sucesso([mudanca('relacao', r.id, null, r)], [evento(ctx, 1, 'relacao.criada', 'relacao', r.id, null, r)]);
  }
  function encerrarRelacao(estado, id, motivo, ctx) {
    var e = validarCtx(ctx, false);
    if (e.length) return falha(e);
    var atual = colecao(estado, 'relacoes')[id];
    if (!atual) return falha([erro('RELACAO_INEXISTENTE', { id: id })]);
    if (atual.situacao !== SITUACAO.ATIVA) return falha([erro('RELACAO_ENCERRADA', { id: id })]);
    motivoValido(e, motivo);
    if (e.length) return falha(e);
    var depois = encerrada(atual, motivo, ctx);
    return sucesso([mudanca('relacao', id, atual, depois)], [evento(ctx, 1, 'relacao.encerrada', 'relacao', id, atual, depois, { motivo: texto(motivo) })]);
  }
  /* R6: alterar = encerrar a relação e criar outra, numa só operação (as duas mudanças vão juntas) */
  function alterarRelacao(estado, id, novos, motivo, ctx, ref) {
    var e = validarCtx(ctx, true);
    if (e.length) return falha(e);
    var atual = colecao(estado, 'relacoes')[id];
    if (!atual) return falha([erro('RELACAO_INEXISTENTE', { id: id })]);
    if (atual.situacao !== SITUACAO.ATIVA) return falha([erro('RELACAO_ENCERRADA', { id: id })]);
    if (colecao(estado, 'relacoes')[ctx.novoId]) return falha([erro('IDENTIFICADOR_JA_USADO', { id: ctx.novoId })]);
    motivoValido(e, motivo);
    var n = novos || {}, d = { origem: n.origem || atual.origem, tipo: n.tipo || atual.tipo, destino: n.destino || atual.destino, justificativa: n.justificativa };
    if (d.origem === atual.origem && d.tipo === atual.tipo && d.destino === atual.destino) e.push(erro('NADA_A_ALTERAR'));
    e = e.concat(validarRelacao(estado, d, ref, id));
    if (e.length) return falha(e);
    var fim = encerrada(atual, motivo, ctx, { substituidaPor: ctx.novoId }), r = novaRelacao(d, ctx.novoId, ctx);
    r.substitui = id;
    return sucesso([mudanca('relacao', id, atual, fim), mudanca('relacao', r.id, null, r)],
      [evento(ctx, 1, 'relacao.encerrada', 'relacao', id, atual, fim, { motivo: texto(motivo) }), evento(ctx, 2, 'relacao.criada', 'relacao', r.id, null, r, { motivo: texto(motivo) })]);
  }
  /* R7: a relação continua válida enquanto a Taxonomia a admitir e as duas pontas estiverem ativas; nada é
     encerrado sozinho — só a situação calculada muda */
  function situacaoRelacao(estado, id, ref) {
    var r = colecao(estado, 'relacoes')[id], ests = colecao(estado, 'estruturas');
    if (!r) return null;
    if (r.situacao !== SITUACAO.ATIVA) return { situacao: 'encerrada', motivos: [] };
    var m = [], o = ests[r.origem], d = ests[r.destino];
    if (!o || o.situacao !== SITUACAO.ATIVA) m.push('ORIGEM_ENCERRADA');
    if (!d || d.situacao !== SITUACAO.ATIVA) m.push('DESTINO_ENCERRADO');
    if (o && d && !relacaoConceitualAdmite(ref, o.tipo, r.tipo, d.tipo)) m.push('TAXONOMIA_NAO_ADMITE_MAIS');
    return { situacao: m.length ? 'a-revisar' : 'valida', motivos: m };
  }

  /* ---------------- POSICIONAMENTO EFETIVO (lido do que está registrado) ----------------
     p = { avaliacaoId, recomendacao: { codigoResultado }, decisao?: { codigoFinal } } — a avaliação VIGENTE do objeto
     (quem chama lê; null = sem Posicionamento vigente). Decisão final quando existe; senão, recomendação FIRME.
     A_VALIDAR sem decisão final nunca é base. */
  function posicionamentoEfetivo(p, ref) {
    var firmes = (ref && ref.codigosFirmes) || [];
    if (!p || vazio(p.avaliacaoId)) return { codigo: null, motivo: 'SEM_POSICIONAMENTO_VIGENTE' };
    if (p.decisao && firmes.indexOf(p.decisao.codigoFinal) !== -1) return { codigo: p.decisao.codigoFinal, origem: 'decisao', avaliacaoId: p.avaliacaoId };
    var rec = p.recomendacao && p.recomendacao.codigoResultado;
    if (firmes.indexOf(rec) !== -1) return { codigo: rec, origem: 'recomendacao', avaliacaoId: p.avaliacaoId };
    return { codigo: null, motivo: 'SEM_POSICIONAMENTO_FIRME' };
  }

  /* ---------------- VÍNCULO OBJETO × ESTRUTURA RESPONSÁVEL (V1–V8) ---------------- */
  function vinculosAtivos(estado, objetoId, papel) {
    return valores(colecao(estado, 'vinculos')).filter(function (v) { return v.situacao === SITUACAO.ATIVA && v.objetoId === objetoId && (!papel || v.papel === papel); });
  }
  function responsavelAtivo(estado, objetoId) { return vinculosAtivos(estado, objetoId, PRINCIPAL)[0] || null; }
  function colaboradorasAtivas(estado, objetoId) { return vinculosAtivos(estado, objetoId, COLABORADORA); }
  /* só os tipos de POSICIONAMENTO recebem responsabilidade (Linhas, Área Especializada, CoE); o Squad compõe uma Linha */
  function tipoAlocavel(ref, tipo) { return tiposAdmitidos(ref)[tipo] === 'posicionamento'; }
  /* E2 (R-E2-3): { motivo, justificativa, autoridade?, referencia? } — quem decidiu (autoridade) e o documento
     (referencia) são opcionais; quem REGISTROU é sempre o autor do vínculo, nunca apresentado como quem decidiu */
  function validarDivergencia(e, div) {
    if (!div || typeof div !== 'object') { e.push(erro('DIVERGENCIA_SEM_JUSTIFICATIVA')); return; }
    if (vazio(div.motivo)) e.push(erro('CAMPO_OBRIGATORIO', { campo: 'divergencia.motivo' }));
    else if (MOTIVOS_DIVERGENCIA.indexOf(div.motivo) === -1) e.push(erro('MOTIVO_DIVERGENCIA_INVALIDO', { motivo: div.motivo }));
    if (vazio(div.justificativa)) e.push(erro('DIVERGENCIA_SEM_JUSTIFICATIVA'));
    else checarTexto(e, 'justificativa', div.justificativa, true);
    checarTexto(e, 'autoridade', div.autoridade, false);
    checarTexto(e, 'referencia', div.referencia, false);
  }
  function divergenciaGravada(div) {
    var o = { motivo: div.motivo, justificativa: texto(div.justificativa) };
    if (!vazio(div.autoridade)) o.autoridade = texto(div.autoridade);
    if (!vazio(div.referencia)) o.referencia = texto(div.referencia);
    return o;
  }
  function temDivergencia(d) { return d.divergencia !== undefined && d.divergencia !== null; }
  function validarVinculoNovo(estado, d, p, ref, ignorarVinculoId) {
    var e = [], papel = d.papel || PRINCIPAL;
    if (PAPEIS_VINCULO.indexOf(papel) === -1) return [erro('PAPEL_NAO_SUPORTADO', { papel: papel })];
    if (vazio(d.objetoId)) e.push(erro('CAMPO_OBRIGATORIO', { campo: 'objetoId' }));
    var est = colecao(estado, 'estruturas')[d.estruturaId];
    if (!est) e.push(erro('ESTRUTURA_INEXISTENTE', { id: d.estruturaId }));
    else if (est.situacao !== SITUACAO.ATIVA) e.push(erro('ESTRUTURA_ENCERRADA', { id: d.estruturaId }));
    else if (!tipoAlocavel(ref, est.tipo)) e.push(erro('TIPO_NAO_ALOCAVEL', { tipo: est.tipo }));
    checarTexto(e, 'justificativa', d.justificativa, papel === COLABORADORA);  /* R-E3-2: a colaboração é sempre explicada */
    if (e.length) return e;
    var principal = vinculosAtivos(estado, d.objetoId, PRINCIPAL).filter(function (v) { return v.id !== ignorarVinculoId; })[0];
    if (papel === PRINCIPAL) {
      if (principal) e.push(erro('RESPONSAVEL_PRINCIPAL_JA_EXISTE', { vinculoId: principal.id }));     /* V1 */
      if (colaboradorasAtivas(estado, d.objetoId).some(function (c) { return c.estruturaId === d.estruturaId; })) e.push(erro('COLABORADORA_E_PRINCIPAL'));
    } else {
      if (temDivergencia(d)) e.push(erro('DIVERGENCIA_INDEVIDA'));                                   /* colaboradora não é posicionada */
      if (!principal) e.push(erro('SEM_RESPONSAVEL_PRINCIPAL'));                                    /* R-E3-2 */
      else if (principal.estruturaId === d.estruturaId) e.push(erro('COLABORADORA_E_PRINCIPAL'));
      if (colaboradorasAtivas(estado, d.objetoId).some(function (c) { return c.estruturaId === d.estruturaId; })) e.push(erro('COLABORADORA_JA_EXISTE'));
    }
    var ef = posicionamentoEfetivo(p, ref);
    if (!ef.codigo) { e.push(erro('SEM_POSICIONAMENTO_EFETIVO', { motivo: ef.motivo })); return e; } /* V2 */
    var conc = ref && ref.ligacoes ? ref.ligacoes[ef.codigo] : undefined;
    if (!conc) { e.push(erro('LIGACAO_OFICIAL_AUSENTE', { codigoEfetivo: ef.codigo })); return e; }
    if (papel !== PRINCIPAL) return e;
    /* V3 revisado (E2): tipo igual = compatível, sem dados de divergência; tipo diferente = divergência deliberada,
       só com motivo e justificativa organizacional. A base continua sendo o posicionamento efetivo (nunca alterado). */
    if (est.tipo === conc) { if (temDivergencia(d)) e.push(erro('DIVERGENCIA_INDEVIDA', { tipoEstrutura: est.tipo, esperado: conc })); }
    else validarDivergencia(e, d.divergencia);
    return e;
  }
  function novoVinculo(d, ef, id, ctx) {
    var v = { id: id, objetoId: d.objetoId, estruturaId: d.estruturaId, papel: d.papel || PRINCIPAL,
      base: { avaliacaoId: ef.avaliacaoId, codigo: ef.codigo, origem: ef.origem },                      /* V4 */
      justificativa: textoOuNulo(d.justificativa), situacao: SITUACAO.ATIVA, criadoEm: ctx.agora, criadoPor: autor(ctx), revisao: 1 };
    if (temDivergencia(d)) v.divergencia = divergenciaGravada(d.divergencia);          /* só existe quando o tipo difere */
    return v;
  }
  function criarVinculo(estado, d, posicionamento, ctx, ref) {
    var e = validarCtx(ctx, true);
    if (e.length) return falha(e);
    if (colecao(estado, 'vinculos')[ctx.novoId]) return falha([erro('IDENTIFICADOR_JA_USADO', { id: ctx.novoId })]);
    e = validarVinculoNovo(estado, d, posicionamento, ref, null);
    if (e.length) return falha(e);
    var v = novoVinculo(d, posicionamentoEfetivo(posicionamento, ref), ctx.novoId, ctx);
    return sucesso([mudanca('vinculo', v.id, null, v)], [evento(ctx, 1, 'vinculo.criado', 'vinculo', v.id, null, v)]);
  }
  function vincularResponsavel(estado, dados, posicionamento, ctx, ref) {
    var d = dados || {};
    return criarVinculo(estado, { objetoId: d.objetoId, estruturaId: d.estruturaId, justificativa: d.justificativa, divergencia: d.divergencia, papel: PRINCIPAL }, posicionamento, ctx, ref);
  }
  /* E3 (R-E3-1/2): colaboradora — mesmo registro, outro papel; exige responsável principal ativo e justificativa */
  function vincularColaboradora(estado, dados, posicionamento, ctx, ref) {
    var d = dados || {};
    return criarVinculo(estado, { objetoId: d.objetoId, estruturaId: d.estruturaId, justificativa: d.justificativa, divergencia: d.divergencia, papel: COLABORADORA }, posicionamento, ctx, ref);
  }
  function encerrarVinculo(estado, id, motivo, ctx) {
    var e = validarCtx(ctx, false);
    if (e.length) return falha(e);
    var atual = colecao(estado, 'vinculos')[id];
    if (!atual) return falha([erro('VINCULO_INEXISTENTE', { id: id })]);
    if (atual.situacao !== SITUACAO.ATIVA) return falha([erro('VINCULO_ENCERRADO', { id: id })]);
    motivoValido(e, motivo);
    if (e.length) return falha(e);
    var depois = encerrada(atual, motivo, ctx);
    return sucesso([mudanca('vinculo', id, atual, depois)], [evento(ctx, 1, 'vinculo.encerrado', 'vinculo', id, atual, depois, { motivo: texto(motivo) })]);
  }
  /* V5: substituir = encerrar o vínculo atual e criar o novo, numa só operação, com motivo */
  function substituirResponsavel(estado, vinculoId, dados, motivo, posicionamento, ctx, ref) {
    var e = validarCtx(ctx, true), d = dados || {};
    if (e.length) return falha(e);
    var atual = colecao(estado, 'vinculos')[vinculoId];
    if (!atual) return falha([erro('VINCULO_INEXISTENTE', { id: vinculoId })]);
    if (atual.situacao !== SITUACAO.ATIVA) return falha([erro('VINCULO_ENCERRADO', { id: vinculoId })]);
    if (atual.papel !== PRINCIPAL) return falha([erro('SUBSTITUICAO_SO_DO_PRINCIPAL', { id: vinculoId })]); /* colaboradora: encerrar e criar outra */
    if (colecao(estado, 'vinculos')[ctx.novoId]) return falha([erro('IDENTIFICADOR_JA_USADO', { id: ctx.novoId })]);
    motivoValido(e, motivo);
    /* R-E2-9: substituir pela MESMA estrutura = reconfirmar a alocação sobre a base nova (com justificativa nova, se divergir) */
    var nd = { objetoId: atual.objetoId, estruturaId: d.estruturaId, papel: atual.papel, justificativa: d.justificativa, divergencia: d.divergencia };
    e = e.concat(validarVinculoNovo(estado, nd, posicionamento, ref, vinculoId));
    if (e.length) return falha(e);
    var fim = encerrada(atual, motivo, ctx, { substituidoPor: ctx.novoId }), v = novoVinculo(nd, posicionamentoEfetivo(posicionamento, ref), ctx.novoId, ctx);
    v.substitui = vinculoId;
    return sucesso([mudanca('vinculo', vinculoId, atual, fim), mudanca('vinculo', v.id, null, v)],
      [evento(ctx, 1, 'vinculo.encerrado', 'vinculo', vinculoId, atual, fim, { motivo: texto(motivo) }), evento(ctx, 2, 'vinculo.criado', 'vinculo', v.id, null, v, { motivo: texto(motivo) })]);
  }
  /* V6/V7 + E2 (R-E2-7/8): situação CALCULADA do responsável principal de um objeto — nada é alterado quando o
     Posicionamento muda e a base do vínculo nunca é reescrita.
     válido: estrutura ativa e do tipo oficial do código efetivo ATUAL (uma reavaliação que mantém o mesmo código
       continua válida; a que passa a coincidir com o tipo de uma alocação divergente também — divergenciaResolvida
       diz qual avaliação e qual código tornaram o vínculo compatível, e a divergência original continua registrada);
     divergencia-deliberada: estrutura ativa, mesmo código efetivo da base e tipo diferente, com a divergência
       registrada (motivo e justificativa organizacional) — decisão organizacional, não erro;
     ausente: há posicionamento efetivo firme e nenhum vínculo ativo;
     precisa de revisão: a estrutura foi encerrada, o posicionamento deixou de valer ou de ser firme, ou o código
       efetivo mudou e o tipo da estrutura não corresponde ao novo código (TIPO_NAO_CORRESPONDE: tipo diferente
       sem divergência registrada, p. ex. quando a ligação oficial mudou);
     não aplicável: sem posicionamento efetivo e sem vínculo ativo.
     V8: a liberação para Squad (I2) não entra aqui — é outra informação, calculada à parte. */
  function situacaoResponsavel(estado, objetoId, posicionamento, ref) {
    var v = responsavelAtivo(estado, objetoId), ef = posicionamentoEfetivo(posicionamento, ref);
    if (!v) return { situacao: ef.codigo ? 'ausente' : 'nao-aplicavel', vinculo: null, efetivo: ef, motivos: ef.codigo ? [] : [ef.motivo] };
    var m = [], est = colecao(estado, 'estruturas')[v.estruturaId], divergente = false, resolvida = null;
    var tipoAtual = ef.codigo && ref && ref.ligacoes ? ref.ligacoes[ef.codigo] : undefined;
    if (!ef.codigo) m.push(ef.motivo === 'SEM_POSICIONAMENTO_VIGENTE' ? 'POSICIONAMENTO_DEIXOU_DE_VALER' : 'POSICIONAMENTO_SEM_CODIGO_FIRME');
    else if (ef.codigo !== v.base.codigo) {
      if (est && tipoAtual === est.tipo && v.divergencia) resolvida = { codigoAtual: ef.codigo, avaliacaoId: ef.avaliacaoId, origem: ef.origem };
      else m.push('CODIGO_EFETIVO_MUDOU');
    }
    if (!est || est.situacao !== SITUACAO.ATIVA) m.push('ESTRUTURA_ENCERRADA');
    /* sem as ligações oficiais (perfil que não as lê, leitura pendente) o tipo não é conferido — nunca um falso "não
       corresponde"; a divergência registrada no vínculo, sobre a mesma base, continua à vista */
    if (ef.codigo && est && !(ref && ref.ligacoes)) { if (ef.codigo === v.base.codigo && v.divergencia) divergente = true; }
    else if (ef.codigo && est && tipoAtual !== est.tipo) {
      if (ef.codigo === v.base.codigo && v.divergencia) divergente = true;
      else if (!resolvida) m.push('TIPO_NAO_CORRESPONDE');
    }
    var r = { situacao: m.length ? 'precisa-revisao' : (divergente ? 'divergencia-deliberada' : 'valido'), vinculo: clone(v), efetivo: ef,
      motivos: m.filter(function (x, i) { return m.indexOf(x) === i; }) };
    if (!m.length && ef.avaliacaoId !== v.base.avaliacaoId) r.baseEmOutraAvaliacao = true; /* mesmo código (ou compatível), outra versão */
    if (resolvida && !m.length) r.divergenciaResolvida = resolvida;
    return r;
  }
  /* E3 (R-E3-4): situação CALCULADA de cada colaboradora ativa do objeto — a mudança de código efetivo não a afeta
     (colaboradora não é posicionada); fica para revisão sem estrutura ativa, sem principal ativo ou sem posicionamento */
  function situacaoColaboradoras(estado, objetoId, posicionamento, ref) {
    var ef = posicionamentoEfetivo(posicionamento, ref), principal = responsavelAtivo(estado, objetoId), ests = colecao(estado, 'estruturas');
    return colaboradorasAtivas(estado, objetoId).map(function (c) {
      var m = [], est = ests[c.estruturaId];
      if (!est || est.situacao !== SITUACAO.ATIVA) m.push('ESTRUTURA_ENCERRADA');
      if (!principal) m.push('SEM_RESPONSAVEL_PRINCIPAL');
      if (!ef.codigo) m.push(ef.motivo === 'SEM_POSICIONAMENTO_VIGENTE' ? 'POSICIONAMENTO_DEIXOU_DE_VALER' : 'POSICIONAMENTO_SEM_CODIGO_FIRME');
      return { situacao: m.length ? 'precisa-revisao' : 'ativa', vinculo: clone(c), motivos: m };
    }).sort(function (a, b) { var ta = instante(a.vinculo.criadoEm), tb = instante(b.vinculo.criadoEm); return ta - tb || (a.vinculo.id < b.vinculo.id ? -1 : 1); });
  }

  /* ---------------- consultas puras ---------------- */
  function estruturasDoTipo(estado, tipo, opcoes) {
    var incluirEncerradas = !!(opcoes && opcoes.incluirEncerradas);
    return valores(colecao(estado, 'estruturas')).filter(function (s) { return s.tipo === tipo && (incluirEncerradas || s.situacao === SITUACAO.ATIVA); });
  }
  function relacoesDaEstrutura(estado, id, opcoes) {
    var todas = !!(opcoes && opcoes.incluirEncerradas);
    var rs = valores(colecao(estado, 'relacoes')).filter(function (r) { return todas || r.situacao === SITUACAO.ATIVA; });
    return { saida: rs.filter(function (r) { return r.origem === id; }), entrada: rs.filter(function (r) { return r.destino === id; }) };
  }
  function objetosDaEstrutura(estado, estruturaId) {
    return valores(colecao(estado, 'vinculos')).filter(function (v) { return v.situacao === SITUACAO.ATIVA && v.estruturaId === estruturaId; })
      .map(function (v) { return { objetoId: v.objetoId, papel: v.papel, vinculoId: v.id }; });
  }
  /* histórico de uma entidade a partir dos eventos já registrados (a persistência guarda os eventos; o núcleo ordena) */
  function historico(eventos, entidade, id) {
    return (eventos || []).filter(function (ev) { return ev && ev.entidade === entidade && ev.entidadeId === id; })
      .slice().sort(function (a, b) { var ta = instante(a.em), tb = instante(b.em); return ta < tb ? -1 : ta > tb ? 1 : (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); });
  }
  /* relações ativas possíveis a partir de uma estrutura, segundo a Taxonomia (para oferecer só o que é válido) */
  function relacoesPossiveis(estado, origemId, ref) {
    var o = colecao(estado, 'estruturas')[origemId], out = [];
    if (!o || o.situacao !== SITUACAO.ATIVA) return out;
    valores(colecao(estado, 'estruturas')).forEach(function (d) {
      if (d.id === origemId || d.situacao !== SITUACAO.ATIVA) return;
      TIPOS_RELACAO.forEach(function (t) { if (!validarRelacao(estado, { origem: origemId, tipo: t, destino: d.id }, ref, null).length) out.push({ tipo: t, destino: d.id }); });
    });
    return out;
  }

  /* ---------------- SUBAGRUPADORES DAS LINHAS DE NEGÓCIOS (Etapa 5) ----------------
     Agrupamento de APRESENTAÇÃO do Mapa da Floresta — não é estrutura organizacional concreta nem conceito da
     Taxonomia. Só para estruturas do tipo Linha de Negócios. Criar, renomear, ordenar (ordem numérica própria;
     empate pelo nome), encerrar com motivo (nunca apagar, nunca reativar, identificador nunca reaproveitado).
     A ASSOCIAÇÃO Linha × subagrupador é registro próprio, com histórico: no máximo uma ativa por Linha; trocar =
     encerrar a atual e criar outra, numa só operação. Encerrar um subagrupador NÃO encerra associações em cascata
     (como nas estruturas): a Linha passa a aparecer em "Sem subagrupador" pela situação CALCULADA. */
  var TIPO_COM_SUBAGRUPADOR = 'NEGOCIOS';
  var SUBAGRUPADOR = { ATIVO: 'ativo', ENCERRADO: 'encerrado' };
  function subagrupadorAtivo(estado, id) { var s = colecao(estado, 'subagrupadores')[id]; return s && s.situacao === SUBAGRUPADOR.ATIVO ? s : null; }
  function subagrupadoresAtivos(estado) {
    return valores(colecao(estado, 'subagrupadores')).filter(function (s) { return s.situacao === SUBAGRUPADOR.ATIVO; })
      .sort(function (a, b) { return a.ordem !== b.ordem ? a.ordem - b.ordem : String(a.nome).localeCompare(String(b.nome), 'pt-BR') || (a.id < b.id ? -1 : 1); });
  }
  function associacaoAtivaDaLinha(estado, estruturaId) {
    return valores(colecao(estado, 'associacoesSubagrupador')).filter(function (a) { return a.situacao === SITUACAO.ATIVA && a.estruturaId === estruturaId; })[0] || null;
  }
  function checarOrdem(e, v) { if (v !== undefined && (typeof v !== 'number' || !isFinite(v))) e.push(erro('CAMPO_INVALIDO', { campo: 'ordem' })); }
  function checarJustificativa(e, j) { if (j !== undefined && j !== null) checarTexto(e, 'justificativa', j, false); }
  function criarSubagrupador(estado, dados, ctx) {
    var e = validarCtx(ctx, true), d = dados || {};
    if (e.length) return falha(e);
    if (colecao(estado, 'subagrupadores')[ctx.novoId]) e.push(erro('IDENTIFICADOR_JA_USADO', { id: ctx.novoId }));
    checarTexto(e, 'nome', d.nome, true);
    checarOrdem(e, d.ordem);
    if (e.length) return falha(e);
    var ativos = subagrupadoresAtivos(estado);
    var ordem = d.ordem !== undefined ? d.ordem : (ativos.length ? ativos[ativos.length - 1].ordem + 10 : 10); /* sem ordem: vai para o fim */
    var s = { id: ctx.novoId, bloco: TIPO_COM_SUBAGRUPADOR, nome: texto(d.nome), ordem: ordem, situacao: SUBAGRUPADOR.ATIVO, criadoEm: ctx.agora, criadoPor: autor(ctx), revisao: 1 };
    return sucesso([mudanca('subagrupador', s.id, null, s)], [evento(ctx, 1, 'subagrupador.criado', 'subagrupador', s.id, null, s)]);
  }
  /* renomear e/ou ordenar (nome, ordem); nada mais muda */
  function alterarSubagrupador(estado, id, alteracoes, ctx, opcoes) {
    var e = validarCtx(ctx, false), a = alteracoes || {}, o = opcoes || {};
    if (e.length) return falha(e);
    var atual = colecao(estado, 'subagrupadores')[id];
    if (!atual) return falha([erro('SUBAGRUPADOR_INEXISTENTE', { id: id })]);
    if (atual.situacao !== SUBAGRUPADOR.ATIVO) return falha([erro('SUBAGRUPADOR_ENCERRADO', { id: id })]);
    if (o.revisaoEsperada !== undefined && o.revisaoEsperada !== atual.revisao) return falha([erro('REVISAO_DESATUALIZADA', { esperada: o.revisaoEsperada, atual: atual.revisao })]);
    Object.keys(a).forEach(function (k) { if (k !== 'nome' && k !== 'ordem') e.push(erro('CAMPO_NAO_ALTERAVEL', { campo: k })); });
    if ('nome' in a) checarTexto(e, 'nome', a.nome, true);
    if ('ordem' in a) { if (a.ordem === undefined || a.ordem === null) e.push(erro('CAMPO_INVALIDO', { campo: 'ordem' })); else checarOrdem(e, a.ordem); }
    checarJustificativa(e, o.justificativa);
    if (e.length) return falha(e);
    var depois = clone(atual), mudou = [];
    if ('nome' in a && texto(a.nome) !== atual.nome) { depois.nome = texto(a.nome); mudou.push('nome'); }
    if ('ordem' in a && a.ordem !== atual.ordem) { depois.ordem = a.ordem; mudou.push('ordem'); }
    if (!mudou.length) return falha([erro('NADA_A_ALTERAR')]);
    depois.revisao = atual.revisao + 1; depois.alteradoEm = ctx.agora; depois.alteradoPor = autor(ctx);
    return sucesso([mudanca('subagrupador', id, atual, depois)],
      [evento(ctx, 1, 'subagrupador.alterado', 'subagrupador', id, atual, depois, { campos: mudou, justificativa: textoOuNulo(o.justificativa) })]);
  }
  function encerrarSubagrupador(estado, id, motivo, ctx, opcoes) {
    var e = validarCtx(ctx, false), o = opcoes || {};
    if (e.length) return falha(e);
    var atual = colecao(estado, 'subagrupadores')[id];
    if (!atual) return falha([erro('SUBAGRUPADOR_INEXISTENTE', { id: id })]);
    if (atual.situacao !== SUBAGRUPADOR.ATIVO) return falha([erro('SUBAGRUPADOR_ENCERRADO', { id: id })]);
    if (o.revisaoEsperada !== undefined && o.revisaoEsperada !== atual.revisao) return falha([erro('REVISAO_DESATUALIZADA', { esperada: o.revisaoEsperada, atual: atual.revisao })]);
    motivoValido(e, motivo);
    if (e.length) return falha(e);
    var depois = clone(atual);
    depois.situacao = SUBAGRUPADOR.ENCERRADO; depois.revisao = atual.revisao + 1;
    depois.encerramento = { motivo: texto(motivo), em: ctx.agora, por: autor(ctx) };
    return sucesso([mudanca('subagrupador', id, atual, depois)], [evento(ctx, 1, 'subagrupador.encerrado', 'subagrupador', id, atual, depois, { motivo: texto(motivo) })]);
  }
  function validarAssociacaoNova(estado, estruturaId, subagrupadorId, ignorarId) {
    var e = [], est = colecao(estado, 'estruturas')[estruturaId];
    if (!est) e.push(erro('ESTRUTURA_INEXISTENTE', { id: estruturaId }));
    else if (est.situacao !== SITUACAO.ATIVA) e.push(erro('ESTRUTURA_ENCERRADA', { id: estruturaId }));
    else if (est.tipo !== TIPO_COM_SUBAGRUPADOR) e.push(erro('ESTRUTURA_NAO_ADMITE_SUBAGRUPADOR', { tipo: est.tipo }));
    if (!colecao(estado, 'subagrupadores')[subagrupadorId]) e.push(erro('SUBAGRUPADOR_INEXISTENTE', { id: subagrupadorId }));
    else if (!subagrupadorAtivo(estado, subagrupadorId)) e.push(erro('SUBAGRUPADOR_ENCERRADO', { id: subagrupadorId }));
    var outra = associacaoAtivaDaLinha(estado, estruturaId);
    if (outra && outra.id !== ignorarId) e.push(erro('LINHA_JA_ASSOCIADA', { associacaoId: outra.id }));
    return e;
  }
  function novaAssociacao(estruturaId, subagrupadorId, ctx) {
    return { id: ctx.novoId, estruturaId: estruturaId, subagrupadorId: subagrupadorId, situacao: SITUACAO.ATIVA, criadaEm: ctx.agora, criadaPor: autor(ctx), revisao: 1 };
  }
  function associarLinha(estado, dados, ctx, opcoes) {
    var e = validarCtx(ctx, true), d = dados || {}, o = opcoes || {};
    if (e.length) return falha(e);
    if (colecao(estado, 'associacoesSubagrupador')[ctx.novoId]) e.push(erro('IDENTIFICADOR_JA_USADO', { id: ctx.novoId }));
    e = e.concat(validarAssociacaoNova(estado, d.estruturaId, d.subagrupadorId, null));
    checarJustificativa(e, o.justificativa);
    if (e.length) return falha(e);
    var a = novaAssociacao(d.estruturaId, d.subagrupadorId, ctx);
    return sucesso([mudanca('associacao-subagrupador', a.id, null, a)],
      [evento(ctx, 1, 'associacao.criada', 'associacao-subagrupador', a.id, null, a, { justificativa: textoOuNulo(o.justificativa) })]);
  }
  function associacaoEncerrada(atual, ctx, extra) {
    var depois = clone(atual);
    depois.situacao = SITUACAO.ENCERRADA; depois.revisao = atual.revisao + 1;
    depois.encerramento = { em: ctx.agora, por: autor(ctx) };
    if (extra && extra.substituidaPor) depois.encerramento.substituidaPor = extra.substituidaPor;
    return depois;
  }
  /* trocar o subagrupador de uma Linha: encerra a associação atual e cria a nova, numa só operação */
  function substituirAssociacao(estado, associacaoId, subagrupadorId, ctx, opcoes) {
    var e = validarCtx(ctx, true), o = opcoes || {};
    if (e.length) return falha(e);
    var atual = colecao(estado, 'associacoesSubagrupador')[associacaoId];
    if (!atual) return falha([erro('ASSOCIACAO_INEXISTENTE', { id: associacaoId })]);
    if (atual.situacao !== SITUACAO.ATIVA) return falha([erro('ASSOCIACAO_ENCERRADA', { id: associacaoId })]);
    if (colecao(estado, 'associacoesSubagrupador')[ctx.novoId]) e.push(erro('IDENTIFICADOR_JA_USADO', { id: ctx.novoId }));
    if (subagrupadorId === atual.subagrupadorId) e.push(erro('NADA_A_ALTERAR'));
    e = e.concat(validarAssociacaoNova(estado, atual.estruturaId, subagrupadorId, associacaoId));
    checarJustificativa(e, o.justificativa);
    if (e.length) return falha(e);
    var fim = associacaoEncerrada(atual, ctx, { substituidaPor: ctx.novoId }), a = novaAssociacao(atual.estruturaId, subagrupadorId, ctx);
    a.substitui = associacaoId;
    var j = textoOuNulo(o.justificativa);
    return sucesso([mudanca('associacao-subagrupador', associacaoId, atual, fim), mudanca('associacao-subagrupador', a.id, null, a)],
      [evento(ctx, 1, 'associacao.encerrada', 'associacao-subagrupador', associacaoId, atual, fim, { justificativa: j }),
       evento(ctx, 2, 'associacao.criada', 'associacao-subagrupador', a.id, null, a, { justificativa: j })]);
  }
  /* tirar a Linha do subagrupador (ela passa a "Sem subagrupador") */
  function desassociarLinha(estado, associacaoId, ctx, opcoes) {
    var e = validarCtx(ctx, false), o = opcoes || {};
    if (e.length) return falha(e);
    var atual = colecao(estado, 'associacoesSubagrupador')[associacaoId];
    if (!atual) return falha([erro('ASSOCIACAO_INEXISTENTE', { id: associacaoId })]);
    if (atual.situacao !== SITUACAO.ATIVA) return falha([erro('ASSOCIACAO_ENCERRADA', { id: associacaoId })]);
    checarJustificativa(e, o.justificativa);
    if (e.length) return falha(e);
    var fim = associacaoEncerrada(atual, ctx);
    return sucesso([mudanca('associacao-subagrupador', associacaoId, atual, fim)],
      [evento(ctx, 1, 'associacao.encerrada', 'associacao-subagrupador', associacaoId, atual, fim, { justificativa: textoOuNulo(o.justificativa) })]);
  }
  /* situação CALCULADA de uma Linha no Mapa: 'associada' | 'subagrupador-encerrado' (fica em "Sem subagrupador") |
     'sem-subagrupador' | 'nao-se-aplica' (não é Linha de Negócios) */
  function subagrupadorDaLinha(estado, estruturaId) {
    var est = colecao(estado, 'estruturas')[estruturaId];
    if (!est || est.tipo !== TIPO_COM_SUBAGRUPADOR) return { situacao: 'nao-se-aplica', associacao: null, subagrupador: null };
    var a = associacaoAtivaDaLinha(estado, estruturaId);
    if (!a) return { situacao: 'sem-subagrupador', associacao: null, subagrupador: null };
    var s = colecao(estado, 'subagrupadores')[a.subagrupadorId] || null;
    return { situacao: s && s.situacao === SUBAGRUPADOR.ATIVO ? 'associada' : 'subagrupador-encerrado', associacao: clone(a), subagrupador: clone(s) };
  }
  /* as Linhas (ativas) que aparecem DENTRO de um subagrupador ativo no Mapa */
  function linhasDoSubagrupador(estado, subagrupadorId) {
    if (!subagrupadorAtivo(estado, subagrupadorId)) return [];
    return estruturasDoTipo(estado, TIPO_COM_SUBAGRUPADOR).filter(function (s) { var a = associacaoAtivaDaLinha(estado, s.id); return a && a.subagrupadorId === subagrupadorId; });
  }

  /* unicidades que dependem de OUTROS registros e que a persistência garante sob concorrência (no Firebase, um
     índice conferido pelas regras; no PostgreSQL, índice único parcial): no máximo uma associação ATIVA por Linha;
     um responsável principal ativo por item; nenhuma relação ativa duplicada; com ref, C3 (um Squad compõe no máximo
     uma Linha ativa). Devolve as violações (vazio = ok). Usada pela referência em memória do contrato. */
  function violacoesDeUnicidade(estado, ref) {
    var vistas = {}, v = [];
    valores(colecao(estado, 'associacoesSubagrupador')).forEach(function (a) {
      if (a.situacao !== SITUACAO.ATIVA) return;
      if (vistas[a.estruturaId]) v.push({ codigo: 'LINHA_JA_ASSOCIADA', estruturaId: a.estruturaId });
      vistas[a.estruturaId] = true;
    });
    /* M3 do Mapa: no máximo um responsável principal ATIVO por item (V1 sob concorrência) */
    var itens = {};
    valores(colecao(estado, 'vinculos')).forEach(function (x) {
      if (x.situacao !== SITUACAO.ATIVA || x.papel !== 'responsavel-principal') return;
      if (itens[x.objetoId]) v.push({ codigo: 'RESPONSAVEL_PRINCIPAL_JA_EXISTE', objetoId: x.objetoId });
      itens[x.objetoId] = x.estruturaId;
    });
    /* E3: no máximo uma colaboradora ATIVA por (item, estrutura), e nunca a mesma estrutura do principal ativo */
    var colabs = {};
    valores(colecao(estado, 'vinculos')).forEach(function (x) {
      if (x.situacao !== SITUACAO.ATIVA || x.papel !== COLABORADORA) return;
      var ch = x.objetoId + '|' + x.estruturaId;
      if (colabs[ch]) v.push({ codigo: 'COLABORADORA_JA_EXISTE', objetoId: x.objetoId, estruturaId: x.estruturaId });
      colabs[ch] = true;
      if (itens[x.objetoId] === x.estruturaId) v.push({ codigo: 'COLABORADORA_E_PRINCIPAL', objetoId: x.objetoId, estruturaId: x.estruturaId });
    });
    /* M6/M7: relação ativa duplicada e, com as referências, C3 */
    var chaves = {};
    relacoesAtivas(estado).forEach(function (r) {
      var ch = r.origem + '|' + r.tipo + '|' + r.destino;
      if (chaves[ch]) v.push({ codigo: 'RELACAO_DUPLICADA', relacaoId: r.id });
      chaves[ch] = true;
      if (ref && composicaoDeTrabalhoAtiva(estado, r, ref, r.id)) v.push({ codigo: 'COMPOSICAO_ATIVA_JA_EXISTE', origem: r.origem });
    });
    return v;
  }

  /* ---------------- aplicar (contrato de persistência, em memória) ----------------
     Aplica TODAS as mudanças de uma operação ou nenhuma: cada mudança exige que a entidade esteja na revisão
     anterior informada (ou não exista, numa criação). É o mesmo contrato que um adaptador de banco cumpre. */
  var COLECAO_DA = { estrutura: 'estruturas', relacao: 'relacoes', vinculo: 'vinculos', subagrupador: 'subagrupadores', 'associacao-subagrupador': 'associacoesSubagrupador' };
  function aplicar(estado, mudancas) {
    var novo = { estruturas: clone(colecao(estado, 'estruturas')), relacoes: clone(colecao(estado, 'relacoes')), vinculos: clone(colecao(estado, 'vinculos')) };
    /* coleções da Etapa 5: só aparecem no estado devolvido quando já existiam ou quando a operação as toca */
    ['subagrupadores', 'associacoesSubagrupador'].forEach(function (c) { if (estado && estado[c]) novo[c] = clone(estado[c]); });
    for (var i = 0; i < (mudancas || []).length; i++) {
      var m = mudancas[i], col = COLECAO_DA[m.entidade];
      if (!col) return { ok: false, erro: 'ENTIDADE_DESCONHECIDA' };
      if (!novo[col]) novo[col] = {};
      var atual = novo[col][m.id];
      if (m.antes === null ? !!atual : (!atual || atual.revisao !== m.revisaoAnterior)) return { ok: false, erro: 'CONFLITO_DE_REVISAO', id: m.id };
      novo[col][m.id] = clone(m.depois);
    }
    return { ok: true, estado: novo };
  }

  var api = {
    TIPOS_RELACAO: TIPOS_RELACAO.slice(), RELACAO_HIERARQUICA: RELACAO_HIERARQUICA, PAPEIS_VINCULO: PAPEIS_VINCULO.slice(), SITUACAO: clone(SITUACAO), MAX: clone(MAX),
    MOTIVOS_DIVERGENCIA: MOTIVOS_DIVERGENCIA.slice(), tipoAlocavel: tipoAlocavel,
    vincularColaboradora: vincularColaboradora, colaboradorasAtivas: colaboradorasAtivas, situacaoColaboradoras: situacaoColaboradoras,
    tiposAdmitidos: tiposAdmitidos, relacaoConceitualAdmite: relacaoConceitualAdmite,
    criarEstrutura: criarEstrutura, alterarEstrutura: alterarEstrutura, encerrarEstrutura: encerrarEstrutura,
    criarRelacao: criarRelacao, encerrarRelacao: encerrarRelacao, alterarRelacao: alterarRelacao, situacaoRelacao: situacaoRelacao,
    posicionamentoEfetivo: posicionamentoEfetivo, vincularResponsavel: vincularResponsavel, encerrarVinculo: encerrarVinculo,
    substituirResponsavel: substituirResponsavel, situacaoResponsavel: situacaoResponsavel, responsavelAtivo: responsavelAtivo,
    estruturasDoTipo: estruturasDoTipo, relacoesDaEstrutura: relacoesDaEstrutura, objetosDaEstrutura: objetosDaEstrutura,
    relacoesPossiveis: relacoesPossiveis, historico: historico, aplicar: aplicar, instante: instante,
    TIPO_COM_SUBAGRUPADOR: TIPO_COM_SUBAGRUPADOR, SITUACAO_SUBAGRUPADOR: clone(SUBAGRUPADOR),
    criarSubagrupador: criarSubagrupador, alterarSubagrupador: alterarSubagrupador, encerrarSubagrupador: encerrarSubagrupador,
    associarLinha: associarLinha, substituirAssociacao: substituirAssociacao, desassociarLinha: desassociarLinha,
    subagrupadoresAtivos: subagrupadoresAtivos, subagrupadorDaLinha: subagrupadorDaLinha, linhasDoSubagrupador: linhasDoSubagrupador,
    violacoesDeUnicidade: violacoesDeUnicidade
  };
  congelar(api);
  if (typeof window !== 'undefined') window.faEstruturasNucleo = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
