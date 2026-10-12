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

   Regras (delimitação funcional aprovada): E1–E6, R1–R7, V1–V8, S1–S3. Nada aqui decide cardinalidades ainda em
   aberto (quantas Linhas uma Squad compõe), unicidade de nome/sigla, carga inicial ou infraestrutura.
   ============================================================ */
(function () {
  'use strict';

  var TIPOS_RELACAO = ['compoe', 'aloca-em', 'atende', 'desenvolve-disciplina', 'pertence-a-disciplina'];
  /* só "compõe" é hierarquia de composição (sem ciclos); "pertence à disciplina" NÃO é tratada como composição */
  var RELACAO_HIERARQUICA = 'compoe';
  var PAPEIS_VINCULO = ['responsavel-principal']; /* outros papéis entram aqui no futuro (M3: atuação em Squad) */
  var SITUACAO = { ATIVA: 'ativa', ENCERRADA: 'encerrada' };
  var MAX = { nome: 200, sigla: 30, descricao: 4000, motivo: 500, justificativa: 2000 };

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
  function responsavelAtivo(estado, objetoId) { return vinculosAtivos(estado, objetoId, 'responsavel-principal')[0] || null; }
  function validarVinculoNovo(estado, d, p, ref, ignorarVinculoId) {
    var e = [], papel = d.papel || 'responsavel-principal';
    if (PAPEIS_VINCULO.indexOf(papel) === -1) return [erro('PAPEL_NAO_SUPORTADO', { papel: papel })];
    if (vazio(d.objetoId)) e.push(erro('CAMPO_OBRIGATORIO', { campo: 'objetoId' }));
    var est = colecao(estado, 'estruturas')[d.estruturaId];
    if (!est) e.push(erro('ESTRUTURA_INEXISTENTE', { id: d.estruturaId }));
    else if (est.situacao !== SITUACAO.ATIVA) e.push(erro('ESTRUTURA_ENCERRADA', { id: d.estruturaId }));
    if (d.justificativa !== undefined && d.justificativa !== null) checarTexto(e, 'justificativa', d.justificativa, false);
    if (e.length) return e;
    var outro = vinculosAtivos(estado, d.objetoId, papel).filter(function (v) { return v.id !== ignorarVinculoId; })[0];
    if (outro) e.push(erro('RESPONSAVEL_PRINCIPAL_JA_EXISTE', { vinculoId: outro.id }));         /* V1 */
    var ef = posicionamentoEfetivo(p, ref);
    if (!ef.codigo) { e.push(erro('SEM_POSICIONAMENTO_EFETIVO', { motivo: ef.motivo })); return e; } /* V2 */
    var conc = ref && ref.ligacoes ? ref.ligacoes[ef.codigo] : undefined;
    if (!conc) e.push(erro('LIGACAO_OFICIAL_AUSENTE', { codigoEfetivo: ef.codigo }));
    else if (est.tipo !== conc) e.push(erro('TIPO_INCOMPATIVEL', { tipoEstrutura: est.tipo, esperado: conc, codigoEfetivo: ef.codigo })); /* V3 */
    return e;
  }
  function novoVinculo(d, ef, id, ctx) {
    return { id: id, objetoId: d.objetoId, estruturaId: d.estruturaId, papel: d.papel || 'responsavel-principal',
      base: { avaliacaoId: ef.avaliacaoId, codigo: ef.codigo, origem: ef.origem },                      /* V4 */
      justificativa: textoOuNulo(d.justificativa), situacao: SITUACAO.ATIVA, criadoEm: ctx.agora, criadoPor: autor(ctx), revisao: 1 };
  }
  function vincularResponsavel(estado, dados, posicionamento, ctx, ref) {
    var e = validarCtx(ctx, true), d = dados || {};
    if (e.length) return falha(e);
    if (colecao(estado, 'vinculos')[ctx.novoId]) return falha([erro('IDENTIFICADOR_JA_USADO', { id: ctx.novoId })]);
    e = validarVinculoNovo(estado, d, posicionamento, ref, null);
    if (e.length) return falha(e);
    var v = novoVinculo(d, posicionamentoEfetivo(posicionamento, ref), ctx.novoId, ctx);
    return sucesso([mudanca('vinculo', v.id, null, v)], [evento(ctx, 1, 'vinculo.criado', 'vinculo', v.id, null, v)]);
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
    if (colecao(estado, 'vinculos')[ctx.novoId]) return falha([erro('IDENTIFICADOR_JA_USADO', { id: ctx.novoId })]);
    motivoValido(e, motivo);
    var nd = { objetoId: atual.objetoId, estruturaId: d.estruturaId, papel: atual.papel, justificativa: d.justificativa };
    e = e.concat(validarVinculoNovo(estado, nd, posicionamento, ref, vinculoId));
    if (e.length) return falha(e);
    var fim = encerrada(atual, motivo, ctx, { substituidoPor: ctx.novoId }), v = novoVinculo(nd, posicionamentoEfetivo(posicionamento, ref), ctx.novoId, ctx);
    v.substitui = vinculoId;
    return sucesso([mudanca('vinculo', vinculoId, atual, fim), mudanca('vinculo', v.id, null, v)],
      [evento(ctx, 1, 'vinculo.encerrado', 'vinculo', vinculoId, atual, fim, { motivo: texto(motivo) }), evento(ctx, 2, 'vinculo.criado', 'vinculo', v.id, null, v, { motivo: texto(motivo) })]);
  }
  /* V6/V7: situação CALCULADA do responsável principal de um objeto — nada é alterado quando o Posicionamento muda.
     válido: vínculo ativo, estrutura ativa e do tipo oficial do código efetivo ATUAL, igual ao da base (uma
       reavaliação que mantém o mesmo código efetivo continua válida; a base original fica preservada);
     ausente: há posicionamento efetivo firme e nenhum vínculo ativo;
     precisa de revisão: há vínculo ativo, mas o código efetivo mudou, deixou de existir, a estrutura foi encerrada
       ou a ligação oficial do código deixou de apontar para o tipo dela;
     não aplicável: sem posicionamento efetivo e sem vínculo ativo.
     V8: a liberação para Squad (I2) não entra aqui — é outra informação, calculada à parte. */
  function situacaoResponsavel(estado, objetoId, posicionamento, ref) {
    var v = responsavelAtivo(estado, objetoId), ef = posicionamentoEfetivo(posicionamento, ref);
    if (!v) return { situacao: ef.codigo ? 'ausente' : 'nao-aplicavel', vinculo: null, efetivo: ef, motivos: ef.codigo ? [] : [ef.motivo] };
    var m = [], est = colecao(estado, 'estruturas')[v.estruturaId];
    if (!ef.codigo) m.push(ef.motivo === 'SEM_POSICIONAMENTO_VIGENTE' ? 'POSICIONAMENTO_DEIXOU_DE_VALER' : 'POSICIONAMENTO_SEM_CODIGO_FIRME');
    else if (ef.codigo !== v.base.codigo) m.push('CODIGO_EFETIVO_MUDOU');
    if (!est || est.situacao !== SITUACAO.ATIVA) m.push('ESTRUTURA_ENCERRADA');
    if (ef.codigo && est && ref && ref.ligacoes && ref.ligacoes[ef.codigo] !== est.tipo) m.push('TIPO_NAO_CORRESPONDE');
    var r = { situacao: m.length ? 'precisa-revisao' : 'valido', vinculo: clone(v), efetivo: ef, motivos: m.filter(function (x, i) { return m.indexOf(x) === i; }) };
    if (!m.length && ef.avaliacaoId !== v.base.avaliacaoId) r.baseEmOutraAvaliacao = true; /* mesmo código, outra versão: continua válido */
    return r;
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

  /* ---------------- aplicar (contrato de persistência, em memória) ----------------
     Aplica TODAS as mudanças de uma operação ou nenhuma: cada mudança exige que a entidade esteja na revisão
     anterior informada (ou não exista, numa criação). É o mesmo contrato que um adaptador de banco cumpre. */
  var COLECAO_DA = { estrutura: 'estruturas', relacao: 'relacoes', vinculo: 'vinculos' };
  function aplicar(estado, mudancas) {
    var novo = { estruturas: clone(colecao(estado, 'estruturas')), relacoes: clone(colecao(estado, 'relacoes')), vinculos: clone(colecao(estado, 'vinculos')) };
    for (var i = 0; i < (mudancas || []).length; i++) {
      var m = mudancas[i], col = COLECAO_DA[m.entidade];
      if (!col) return { ok: false, erro: 'ENTIDADE_DESCONHECIDA' };
      var atual = novo[col][m.id];
      if (m.antes === null ? !!atual : (!atual || atual.revisao !== m.revisaoAnterior)) return { ok: false, erro: 'CONFLITO_DE_REVISAO', id: m.id };
      novo[col][m.id] = clone(m.depois);
    }
    return { ok: true, estado: novo };
  }

  var api = {
    TIPOS_RELACAO: TIPOS_RELACAO.slice(), RELACAO_HIERARQUICA: RELACAO_HIERARQUICA, PAPEIS_VINCULO: PAPEIS_VINCULO.slice(), SITUACAO: clone(SITUACAO), MAX: clone(MAX),
    tiposAdmitidos: tiposAdmitidos, relacaoConceitualAdmite: relacaoConceitualAdmite,
    criarEstrutura: criarEstrutura, alterarEstrutura: alterarEstrutura, encerrarEstrutura: encerrarEstrutura,
    criarRelacao: criarRelacao, encerrarRelacao: encerrarRelacao, alterarRelacao: alterarRelacao, situacaoRelacao: situacaoRelacao,
    posicionamentoEfetivo: posicionamentoEfetivo, vincularResponsavel: vincularResponsavel, encerrarVinculo: encerrarVinculo,
    substituirResponsavel: substituirResponsavel, situacaoResponsavel: situacaoResponsavel, responsavelAtivo: responsavelAtivo,
    estruturasDoTipo: estruturasDoTipo, relacoesDaEstrutura: relacoesDaEstrutura, objetosDaEstrutura: objetosDaEstrutura,
    relacoesPossiveis: relacoesPossiveis, historico: historico, aplicar: aplicar, instante: instante
  };
  congelar(api);
  if (typeof window !== 'undefined') window.faEstruturasNucleo = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
