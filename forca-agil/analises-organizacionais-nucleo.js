/* ============================================================
   Força Ágil — Porta 2 · ANÁLISE ORGANIZACIONAL — domínio puro
   (window.faAnalisesOrganizacionaisNucleo; em Node, module.exports)

   Ajuda a pessoa a entender um escopo amplo (uma estrutura, uma grande área, um conjunto, uma capacidade), a
   descobrir as responsabilidades que existem ali e a registrar uma proposta de composição — SEM classificar nada.
   Capacidade ≠ responsabilidade ≠ estrutura ≠ pessoa:
     - capacidade: só REFERÊNCIA estável ({ tipo, chave, rotulo }), preparada para N:N; nenhum catálogo aqui;
     - responsabilidade: um RECORTE da análise; depois de delimitada, é avaliada como uma atuação organizacional da
       Porta 2 (objetos-organizacionais), que continua sendo a única coisa que recebe o O1–O9;
     - estrutura: só LIDA (tipo e situação) para calcular a situação formal; o núcleo nunca a cria nem a altera;
     - pessoa: fora deste núcleo.

   Fronteiras (especificação aprovada, revisão 3):
     - nenhum código de posicionamento é produzido, sugerido ou citado aqui: classificar é papel exclusivo do motor
       O1–O9 (motor-posicionamento-nucleo.js), que este arquivo não importa nem reproduz; a v2 não é tocada;
     - agrupar entregas nunca é automático: semelhança de forma, destinatário ou responsável só SUGERE comparar, e a
       identidade é investigada por sete critérios (finalidade, resultado, objeto, limites e autonomia, riscos,
       obrigação de responder, governança ou especialização); a conclusão é da pessoa e fica registrada;
     - "quem executa" e "quem responde formalmente" são FATOS DESCRITIVOS da análise (com caráter, fonte e data),
       nunca vínculos: o vínculo principal (estruturas-nucleo.js, V1–V4) continua o único registro formal;
     - uma proposta de composição nunca reclassifica uma responsabilidade nem força vínculo (N3), e nunca produz
       mudança em estrutura, vínculo, Taxonomia ou Mapa;
     - a aprovação do desenho é REFERÊNCIA A UM ATO EXTERNO (autoridade, referência, data, objeto aprovado), com a
       autoria só do registro (N1).

   PURO E INDEPENDENTE DE INFRAESTRUTURA, no mesmo contrato de estruturas-nucleo.js: sem Firebase, SQL, DOM, rede,
   relógio ou gerador de identificadores. Entra por parâmetro:
     - estado: { analises, propostas, aprovacoes } — objetos por identificador;
     - ctx: { operacaoId, novoId?, usuario: { id, email? }, agora } — agora em milissegundos UTC (ou ISO 8601).
   Cada operação devolve { ok: true, mudancas, eventos } ou { ok: false, erros: [{ codigo, ... }] }, sem alterar o
   estado recebido; aplicar(estado, mudancas) devolve o estado novo (tudo ou nada, com conferência de revisão).
   ============================================================ */
(function () {
  'use strict';

  var TIPOS_ESCOPO = ['responsabilidade', 'estrutura', 'grande-area', 'conjunto', 'capacidade', 'atuacao-informal'];
  var FORMAS = ['julgamento-tecnico', 'padrao-capacitacao', 'servico-operado', 'solucao-construida', 'politica-norma', 'decisao-estrategica', 'outra'];
  var DESTINATARIOS = ['diversas-linhas', 'cliente-externo', 'cliente-interno', 'linha-especifica', 'toda-organizacao', 'outro'];
  var RESPONDE = ['esta-estrutura', 'outra-estrutura', 'ninguem', 'nao-sei'];
  /* N5: o responsável formal pode ser conhecido, provável ou ainda não definido — nenhum deles bloqueia o O1–O9 */
  var CERTEZA_RESPONSAVEL = ['conhecido', 'provavel', 'nao-definido'];
  /* N4: hipótese nunca é apresentada como fato */
  var CARATER = ['confirmado', 'declarado', 'hipotese'];
  var CRITERIOS_IDENTIDADE = ['finalidade', 'resultado', 'objeto', 'limitesAutonomia', 'riscos', 'obrigacaoResponder', 'governancaEspecializacao'];
  /* os critérios cuja diferença indica, por si, responsabilidades distintas */
  var CRITERIOS_NUCLEARES = ['finalidade', 'resultado', 'objeto', 'obrigacaoResponder'];
  var VALORES_CRITERIO = ['igual', 'diferente', 'nao-sei'];
  var CONCLUSOES = ['mesma', 'distintas', 'integradas', 'nao-sei'];
  var ALTERNATIVAS = ['manter-consciente', 'rever-delimitacao', 'integrar-recortes', 'distribuir-existentes', 'propor-estrutura', 'pendente'];
  /* N3: nenhuma alternativa de desenho troca a classificação nem contorna a compatibilidade do vínculo */
  var ALTERNATIVAS_RECUSADAS = ['reclassificar', 'alterar-classificacao', 'forcar-vinculo', 'vinculo-incompativel'];
  var SITUACAO_FORMAL = ['sem-classificacao', 'classificacao-a-validar', 'compativel', 'vinculo-a-revisar',
    'executada-sem-vinculo-formal', 'exercida-sem-responsavel-formal-compativel', 'sem-estrutura'];
  /* "esta estrutura" só existe quando o escopo é uma estrutura, uma responsabilidade ou uma atuação */
  var ESCOPOS_COM_ESTRUTURA_PROPRIA = ['estrutura', 'responsabilidade', 'atuacao-informal'];
  var CATEGORIAS = ['completa', 'diagnostico-concluido-pendente', 'funcionalidade-futura'];
  var MAX = { nome: 200, texto: 2000, motivo: 500, chave: 80, lote: 100 };
  /* "Essa descrição reúne trabalhos diferentes que precisam ser avaliados separadamente?" — nao (não precisa separar:
     pronta para o O1–O9) | sim (precisa separar: a pessoa informa as partes) | nao-sei (pendente) */
  var SEPARACAO = ['nao', 'sim', 'nao-sei'];
  /* marcador de homologação (aprovado): ausente = DESLIGADO. As regras do banco aplicam o MESMO mapa — a tela só o
     espelha para não oferecer o que o banco recusaria (a autorização nunca depende de esconder botão) */
  var HABILITACAO = ['DESLIGADO', 'SOMENTE_ADMIN_GERAL', 'LIBERADO_PARA_PERFIS_AUTORIZADOS'];
  function acessoPelaHabilitacao(habilitacao, perfil) {
    perfil = perfil || {};
    var h = HABILITACAO.indexOf(habilitacao) !== -1 ? habilitacao : 'DESLIGADO';
    var geral = !!perfil.adminGeral, arq = !!perfil.arquitetura, aval = !!perfil.avaliacao;
    if (h === 'SOMENTE_ADMIN_GERAL') return { habilitacao: h, ler: geral, gravar: geral, registrarAprovacao: geral };
    if (h === 'LIBERADO_PARA_PERFIS_AUTORIZADOS') return { habilitacao: h, ler: geral || arq || aval, gravar: geral || arq, registrarAprovacao: geral };
    return { habilitacao: h, ler: false, gravar: false, registrarAprovacao: false };
  }

  /* ---------- matriz progressiva de navegação (F1–F17) ----------
     Só formas de entrega, destinatários e responsáveis: nenhuma resposta é um tipo organizacional. "alvo" diz onde a
     resposta fica (análise, entrega, par de entregas, recorte); "regra" é passo sem pergunta. */
  var MATRIZ = [
    { id: 'F1', etapa: 1, alvo: 'analise', pergunta: 'O que você vai analisar?', valores: TIPOS_ESCOPO, porque: 'Define o escopo, sem classificar.' },
    { id: 'F2a', etapa: 1, alvo: 'analise', pergunta: 'Ela tem um único resultado principal e um destinatário claro?', valores: ['sim', 'nao', 'nao-sei'], porque: 'Com mais de um resultado, há indício de mais de uma responsabilidade.' },
    { id: 'F2b', etapa: 1, alvo: 'analise', pergunta: 'Essa estrutura está cadastrada? Qual o tipo?', valores: ['cadastrada', 'nao-cadastrada', 'informal'], porque: 'A composição precisa saber o que já existe.' },
    { id: 'F2c', etapa: 1, alvo: 'analise', pergunta: 'Que responsabilidades sustentam essa capacidade, e onde estão hoje?', valores: ['listadas', 'nao-sei'], porque: 'Capacidade costuma ser distribuída e não vira estrutura.' },
    { id: 'F3', etapa: 2, alvo: 'analise', pergunta: 'Quais entregas concretas saem daqui e alguém usa?', valores: ['listadas', 'nenhuma'], porque: 'Uma responsabilidade se reconhece pelo que entrega.' },
    { id: 'F4', etapa: 2, alvo: 'entrega', pergunta: 'Que forma tem essa entrega?', valores: FORMAS, porque: 'Formas diferentes sugerem responsabilidades diferentes.' },
    { id: 'F5', etapa: 2, alvo: 'entrega', pergunta: 'Quem recebe ou usa?', valores: DESTINATARIOS, porque: 'Destinatários diferentes sugerem recortes diferentes.' },
    { id: 'F6', etapa: 2, alvo: 'entrega', pergunta: 'Quem responde se essa entrega falhar ou atrasar?', valores: RESPONDE, porque: 'Separa responsabilidade própria de execução para terceiros.' },
    { id: 'F7', etapa: 2, alvo: 'entrega', pergunta: 'Esta estrutura executa conforme as regras e prioridades de quem responde?', valores: ['sim', 'nao', 'em-parte'], porque: 'Receber demandas não define responsabilidade.' },
    { id: 'F8', etapa: 2, alvo: 'entrega', pergunta: 'Que evidência sustenta essas respostas?', valores: ['evidencia', 'sem-evidencia'], porque: 'Sem evidência, a resposta vale como hipótese, não como fato.' },
    { id: 'F9', etapa: 2, alvo: 'regra', pergunta: null, valores: [], porque: 'Semelhança de forma, destinatário ou responsável só sugere comparar; nunca funde.' },
    { id: 'F10', etapa: 2, alvo: 'par', pergunta: 'Comparando as duas entregas, os critérios de identidade são iguais ou diferentes? Elas precisam acontecer juntas?', valores: CONCLUSOES, porque: 'Juntar exige fundamento; separar conceitualmente não separa equipes.' },
    { id: 'F11', etapa: 2, alvo: 'analise', pergunta: 'Quem define precisa ser independente de quem opera ou executa?', valores: ['exigencia-normativa', 'boa-pratica', 'nao'], porque: 'Critério de composição (segregação), não de classificação.' },
    { id: 'F12', etapa: 2, alvo: 'entrega', pergunta: 'O foco é desenvolver a competência das outras equipes ou aplicar padrões nos próprios casos?', valores: ['outras-equipes', 'proprios-casos', 'ambos'], porque: 'Desenvolver uma disciplina é diferente de executar os seus casos.' },
    { id: 'F13', etapa: 2, alvo: 'entrega', pergunta: 'De quem são as regras e o resultado de negócio do que é entregue?', valores: ['desta-estrutura', 'de-uma-linha', 'de-outra-estrutura', 'administracao-interna', 'tecnicas-compartilhadas'], porque: 'Construir tecnologia não transfere a responsabilidade de negócio ou corporativa.' },
    { id: 'F14', etapa: 3, alvo: 'recorte', pergunta: 'Confirme cada responsabilidade: nome, resultado e entregas.', valores: [], porque: 'Revisão do recorte, com histórico.' },
    { id: 'F15', etapa: 4, alvo: 'regra', pergunta: null, valores: [], porque: 'Só avalia o que já foi entendido; a falta de responsável formal não bloqueia.' },
    { id: 'F16', etapa: 6, alvo: 'regra', pergunta: null, valores: [], porque: 'Mostra onde a realidade não cabe no vínculo principal.' },
    { id: 'F17', etapa: 7, alvo: 'analise', pergunta: 'Qual alternativa de composição você propõe?', valores: ALTERNATIVAS, porque: 'Proposta, nunca cadastro.' }
  ];
  var PERGUNTA = {}; MATRIZ.forEach(function (q) { PERGUNTA[q.id] = q; });

  /* ---------- utilitários ---------- */
  function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
  function congelar(o) { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.keys(o).forEach(function (k) { congelar(o[k]); }); } return o; }
  function texto(v, max) { return typeof v === 'string' && v.trim().length > 0 && v.length <= max; }
  function textoOpcional(v, max) { return v === undefined || v === null || (typeof v === 'string' && v.length <= max); }
  function dentro(v, lista) { return lista.indexOf(v) !== -1; }
  function erro(codigo, extra) { var e = { codigo: codigo }; if (extra) Object.keys(extra).forEach(function (k) { e[k] = extra[k]; }); return { ok: false, erros: [e] }; }
  function instante(v) {
    if (typeof v === 'number') return Number.isInteger(v) && v > 0 ? v : null;
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(v)) { var t = Date.parse(v); return isNaN(t) ? null : t; }
    return null;
  }
  function validarCtx(ctx, precisaId) {
    if (!ctx || !texto(ctx.operacaoId, MAX.chave)) return 'CTX_OPERACAO_AUSENTE';
    if (!ctx.usuario || !texto(ctx.usuario.id, MAX.chave)) return 'CTX_USUARIO_AUSENTE';
    if (instante(ctx.agora) === null) return 'CTX_HORARIO_INVALIDO';
    if (precisaId && !texto(ctx.novoId, MAX.chave)) return 'CTX_ID_AUSENTE';
    return null;
  }
  function autor(ctx) { var a = { id: ctx.usuario.id }; if (ctx.usuario.email) a.email = ctx.usuario.email; return a; }
  function evento(tipo, analiseId, ctx, detalhe) {
    return { tipo: tipo, analiseId: analiseId, operacaoId: ctx.operacaoId, em: ctx.agora, por: autor(ctx), detalhe: detalhe || {} };
  }
  function chavePar(a, b) { return a < b ? a + '|' + b : b + '|' + a; }
  function lerAnalise(estado, id) { return estado && estado.analises ? estado.analises[id] : undefined; }
  /* abre uma alteração de análise: confere existência, situação e revisão esperada; devolve [antes, depois] */
  function abrirAlteracao(estado, analiseId, dados) {
    var a = lerAnalise(estado, analiseId);
    if (!a) return { erro: erro('ANALISE_INEXISTENTE', { analiseId: analiseId }) };
    if (a.situacao === 'descartada') return { erro: erro('ANALISE_DESCARTADA', { analiseId: analiseId }) };
    if (dados && dados.revisaoEsperada !== undefined && dados.revisaoEsperada !== a.revisao) return { erro: erro('REVISAO_DESATUALIZADA', { atual: a.revisao }) };
    var d = clone(a); d.revisao = a.revisao + 1;
    normalizarEstruturaReferida(d);
    return { antes: a, depois: d };
  }
  /* F2b: a estrutura cadastrada só existe com a resposta "Está cadastrada". Registro legado incoerente (resposta
     diferente com estrutura gravada) é corrigido só neste ponto, na próxima gravação da própria análise — fica no
     antes/depois da mudança; nada é limpo em lote nem sem uma operação da pessoa */
  function normalizarEstruturaReferida(d) {
    var f2b = d.respostas && d.respostas.F2b;
    if (!f2b) return;
    if (f2b.valor !== 'cadastrada') { if (f2b.estruturaId !== undefined) delete f2b.estruturaId; if (d.estruturaReferidaId) d.estruturaReferidaId = null; }
  }
  /* leitura coerente para as telas: a estrutura referida só vale com F2b = "Está cadastrada" */
  function cadastroReferido(a) {
    var f2b = a && a.respostas && a.respostas.F2b;
    if (f2b && f2b.valor !== 'cadastrada') return null;
    return (a && a.estruturaReferidaId) || null;
  }
  function mudancaAnalise(antes, depois) { return { entidade: 'analise', id: depois.id, antes: clone(antes), depois: depois, revisaoAnterior: antes.revisao }; }

  /* ---------- capacidade: referência estável, sem catálogo (D2) ---------- */
  function validarCapacidades(lista, ref) {
    if (lista === undefined) return null;
    if (!Array.isArray(lista)) return 'CAPACIDADE_INVALIDA';
    var fontes = (ref && ref.fontesCapacidade) || [];
    var chaves = {};
    for (var i = 0; i < lista.length; i++) {
      var c = lista[i];
      if (!c || !texto(c.chave, MAX.chave) || !texto(c.rotulo, MAX.nome)) return 'CAPACIDADE_INVALIDA';
      if (c.tipo === 'fonte-oficial') { if (!texto(c.fonte, MAX.chave) || fontes.indexOf(c.fonte) === -1) return 'CAPACIDADE_FONTE_OFICIAL_INEXISTENTE'; }
      else if (c.tipo !== 'texto') return 'CAPACIDADE_INVALIDA';
      var k = c.tipo + ':' + (c.fonte || '') + ':' + c.chave;
      if (chaves[k]) return 'CAPACIDADE_REPETIDA';
      chaves[k] = true;
    }
    return null;
  }

  /* ---------- fatos descritivos (N2/N4) ---------- */
  function validarFato(f, exigeAlvo) {
    if (!f || !dentro(f.carater, CARATER) || !texto(f.fonte, MAX.texto)) return false;
    if (exigeAlvo && !texto(f.estruturaId, MAX.chave) && !texto(f.texto, MAX.texto)) return false;
    return true;
  }

  /* ==================== operações ==================== */
  function criarAnalise(estado, dados, ctx, ref) {
    var c = validarCtx(ctx, true); if (c) return erro(c);
    dados = dados || {};
    if (!texto(dados.nome, MAX.nome)) return erro('NOME_OBRIGATORIO');
    if (!dentro(dados.tipoEscopo, TIPOS_ESCOPO)) return erro('TIPO_ESCOPO_INVALIDO');
    if (!textoOpcional(dados.descricao, MAX.texto)) return erro('DESCRICAO_INVALIDA');
    var cap = validarCapacidades(dados.capacidades, ref); if (cap) return erro(cap);
    if (lerAnalise(estado, ctx.novoId)) return erro('ID_JA_USADO');
    var a = {
      id: ctx.novoId, nome: dados.nome.trim(), tipoEscopo: dados.tipoEscopo, descricao: dados.descricao || null,
      estruturaReferidaId: dados.estruturaReferidaId || null, objetoAmploId: dados.objetoAmploId || null,
      capacidades: clone(dados.capacidades || []), respostas: {}, entregas: {}, comparacoes: {}, recortes: {}, referencias: {},
      situacao: 'aberta', revisao: 1, criadaEm: ctx.agora, criadaPor: autor(ctx)
    };
    return { ok: true, mudancas: [{ entidade: 'analise', id: a.id, antes: null, depois: a, revisaoAnterior: null }],
      eventos: [evento('analise.criada', a.id, ctx, { tipoEscopo: a.tipoEscopo })] };
  }

  /* resposta a uma pergunta da matriz (análise ou entrega); o histórico guarda antes e depois */
  function responder(estado, analiseId, dados, ctx) {
    var c = validarCtx(ctx); if (c) return erro(c);
    dados = dados || {};
    var q = PERGUNTA[dados.pergunta];
    if (!q || (q.alvo !== 'analise' && q.alvo !== 'entrega') || q.id === 'F1' || q.id === 'F17') return erro('PERGUNTA_INVALIDA', { pergunta: dados.pergunta });
    var al = abrirAlteracao(estado, analiseId, dados); if (al.erro) return al.erro;
    var v = dados.valor, valor = v && typeof v === 'object' ? v.valor : v;
    if (!dentro(valor, q.valores)) return erro('RESPOSTA_INVALIDA', { pergunta: q.id });
    var registro = { valor: valor, em: ctx.agora, por: autor(ctx) };
    if (q.id === 'F6') {
      /* N5: certeza do responsável; "outra estrutura" pede qual */
      var cert = v && v.certeza;
      if (!dentro(cert, CERTEZA_RESPONSAVEL)) return erro('CERTEZA_RESPONSAVEL_INVALIDA');
      if (valor === 'outra-estrutura' && !texto(v.estruturaId, MAX.chave) && !texto(v.texto, MAX.texto)) return erro('OUTRA_ESTRUTURA_SEM_IDENTIFICACAO');
      registro.certeza = cert; if (v.estruturaId) registro.estruturaId = v.estruturaId; if (v.texto) registro.texto = v.texto;
    }
    if (q.id === 'F8' && valor === 'evidencia') {
      if (!v || !texto(v.texto, MAX.texto)) return erro('EVIDENCIA_SEM_DESCRICAO');
      registro.texto = v.texto;
    }
    if (q.id === 'F11' && valor === 'exigencia-normativa') {
      if (!v || !texto(v.texto, MAX.texto)) return erro('NORMA_NAO_CITADA');
      registro.texto = v.texto;
    }
    if (q.id === 'F2b' && valor === 'cadastrada') {
      if (!v || !texto(v.estruturaId, MAX.chave)) return erro('ESTRUTURA_NAO_INFORMADA');
      registro.estruturaId = v.estruturaId;
    }
    /* "Existe, mas não está cadastrada" e "É informal" não apontam estrutura do cadastro */
    if (q.id === 'F2b' && valor !== 'cadastrada' && v && typeof v === 'object' && v.estruturaId) return erro('ESTRUTURA_INCOMPATIVEL_COM_RESPOSTA');
    var depois = al.depois, alvo, antesResp;
    if (q.alvo === 'entrega') {
      var ent = depois.entregas[dados.entregaId];
      if (!ent) return erro('ENTREGA_INEXISTENTE', { entregaId: dados.entregaId });
      if (ent.situacao === 'descartada') return erro('ENTREGA_DESCARTADA');
      alvo = ent.respostas;
    } else {
      if (q.id === 'F2a' && depois.tipoEscopo !== 'responsabilidade') return erro('PERGUNTA_FORA_DO_CAMINHO', { pergunta: q.id });
      if (q.id === 'F2b' && depois.tipoEscopo !== 'estrutura') return erro('PERGUNTA_FORA_DO_CAMINHO', { pergunta: q.id });
      if (q.id === 'F2c' && depois.tipoEscopo !== 'capacidade') return erro('PERGUNTA_FORA_DO_CAMINHO', { pergunta: q.id });
      alvo = depois.respostas;
    }
    antesResp = alvo[q.id] ? clone(alvo[q.id]) : null;
    alvo[q.id] = registro;
    if (q.id === 'F2b') depois.estruturaReferidaId = valor === 'cadastrada' ? registro.estruturaId : null;
    return { ok: true, mudancas: [mudancaAnalise(al.antes, depois)],
      eventos: [evento('resposta.registrada', analiseId, ctx, { pergunta: q.id, entregaId: dados.entregaId || null, antes: antesResp, depois: clone(registro) })] };
  }

  function adicionarEntrega(estado, analiseId, dados, ctx) {
    var c = validarCtx(ctx, true); if (c) return erro(c);
    dados = dados || {};
    if (!texto(dados.descricao, MAX.texto)) return erro('ENTREGA_SEM_DESCRICAO');
    if (!textoOpcional(dados.exemplo, MAX.texto)) return erro('EXEMPLO_INVALIDO');
    var al = abrirAlteracao(estado, analiseId, dados); if (al.erro) return al.erro;
    if (al.depois.entregas[ctx.novoId]) return erro('ID_JA_USADO');
    al.depois.entregas[ctx.novoId] = { id: ctx.novoId, descricao: dados.descricao.trim(), exemplo: dados.exemplo || null, respostas: {}, situacao: 'ativa', criadaEm: ctx.agora };
    return { ok: true, mudancas: [mudancaAnalise(al.antes, al.depois)], eventos: [evento('entrega.adicionada', analiseId, ctx, { entregaId: ctx.novoId })] };
  }

  /* editar uma entrega: só o texto (descrição e exemplo). Entrega de uma responsabilidade que já virou atuação não
     muda — a avaliação O1–O9 foi feita sobre aquele texto; para rever, descarte a responsabilidade e delimite de novo */
  function entregaEmRecorte(a, entregaId, soAvaliados) {
    return Object.keys(a.recortes).some(function (k) { var r = a.recortes[k]; return r.situacao === 'ativo' && r.entregas.indexOf(entregaId) !== -1 && (!soAvaliados || !!r.objetoId); });
  }
  function editarEntrega(estado, analiseId, entregaId, dados, ctx) {
    var c = validarCtx(ctx); if (c) return erro(c);
    dados = dados || {};
    if (!texto(dados.descricao, MAX.texto)) return erro('ENTREGA_SEM_DESCRICAO');
    if (!textoOpcional(dados.exemplo, MAX.texto)) return erro('EXEMPLO_INVALIDO');
    var al = abrirAlteracao(estado, analiseId, dados); if (al.erro) return al.erro;
    var e = al.depois.entregas[entregaId];
    if (!e) return erro('ENTREGA_INEXISTENTE', { entregaId: entregaId });
    if (e.situacao !== 'ativa') return erro('ENTREGA_DESCARTADA');
    if (entregaEmRecorte(al.depois, entregaId, true)) return erro('ENTREGA_EM_RESPONSABILIDADE_AVALIADA');
    var antes = { descricao: e.descricao, exemplo: e.exemplo || null };
    e.descricao = dados.descricao.trim(); e.exemplo = dados.exemplo ? dados.exemplo : null;
    return { ok: true, mudancas: [mudancaAnalise(al.antes, al.depois)], eventos: [evento('entrega.editada', analiseId, ctx, { entregaId: entregaId, antes: antes, depois: { descricao: e.descricao, exemplo: e.exemplo } })] };
  }
  /* descartar uma entrega: fica no histórico (situacao "descartada"), nunca é apagada; entrega dentro de uma
     responsabilidade delimitada não sai sozinha — descarte ou reveja a responsabilidade antes */
  function descartarEntrega(estado, analiseId, entregaId, dados, ctx) {
    var c = validarCtx(ctx); if (c) return erro(c);
    dados = dados || {};
    if (!textoOpcional(dados.motivo, MAX.motivo)) return erro('MOTIVO_INVALIDO');
    var al = abrirAlteracao(estado, analiseId, dados); if (al.erro) return al.erro;
    var e = al.depois.entregas[entregaId];
    if (!e) return erro('ENTREGA_INEXISTENTE', { entregaId: entregaId });
    if (e.situacao !== 'ativa') return erro('ENTREGA_DESCARTADA');
    if (entregaEmRecorte(al.depois, entregaId, false)) return erro('ENTREGA_EM_RESPONSABILIDADE');
    e.situacao = 'descartada'; e.descarte = { em: ctx.agora, por: autor(ctx) }; if (dados.motivo) e.descarte.motivo = dados.motivo;
    return { ok: true, mudancas: [mudancaAnalise(al.antes, al.depois)], eventos: [evento('entrega.descartada', analiseId, ctx, { entregaId: entregaId, motivo: dados.motivo || null })] };
  }

  /* F10: a pessoa compara duas entregas pelos sete critérios; o núcleo só interpreta os indícios */
  function interpretarComparacao(criterios) {
    var diferentes = [], naoSei = [], iguais = 0;
    CRITERIOS_IDENTIDADE.forEach(function (k) {
      if (criterios[k] === 'diferente') diferentes.push(k); else if (criterios[k] === 'nao-sei') naoSei.push(k); else if (criterios[k] === 'igual') iguais++;
    });
    var nuclearDif = diferentes.some(function (k) { return dentro(k, CRITERIOS_NUCLEARES); });
    var indicacao = nuclearDif ? 'indicios-de-distincao' : (iguais === CRITERIOS_IDENTIDADE.length ? 'indicios-de-identidade' : (naoSei.length ? 'inconclusivo' : 'indicios-parciais'));
    return { indicacao: indicacao, criteriosDiferentes: diferentes, criteriosNaoSei: naoSei };
  }
  function compararEntregas(estado, analiseId, dados, ctx) {
    var c = validarCtx(ctx); if (c) return erro(c);
    dados = dados || {};
    var al = abrirAlteracao(estado, analiseId, dados); if (al.erro) return al.erro;
    var ents = al.depois.entregas;
    if (!ents[dados.a] || !ents[dados.b] || dados.a === dados.b) return erro('PAR_INVALIDO');
    var crit = dados.criterios || {};
    for (var i = 0; i < CRITERIOS_IDENTIDADE.length; i++) if (!dentro(crit[CRITERIOS_IDENTIDADE[i]], VALORES_CRITERIO)) return erro('CRITERIO_SEM_RESPOSTA', { criterio: CRITERIOS_IDENTIDADE[i] });
    if (!dentro(dados.conclusao, CONCLUSOES)) return erro('CONCLUSAO_INVALIDA');
    var ind = interpretarComparacao(crit);
    var diverge = (dados.conclusao === 'mesma' || dados.conclusao === 'integradas') && ind.indicacao === 'indicios-de-distincao';
    if (diverge && !texto(dados.justificativa, MAX.texto)) return erro('CONCLUSAO_CONTRA_OS_INDICIOS_SEM_JUSTIFICATIVA', { criteriosDiferentes: ind.criteriosDiferentes });
    var k = chavePar(dados.a, dados.b), antesComp = al.depois.comparacoes[k] ? clone(al.depois.comparacoes[k]) : null;
    al.depois.comparacoes[k] = { a: dados.a < dados.b ? dados.a : dados.b, b: dados.a < dados.b ? dados.b : dados.a, criterios: clone(crit), conclusao: dados.conclusao,
      indicacao: ind.indicacao, divergeDosIndicios: diverge, justificativa: dados.justificativa || null, em: ctx.agora, por: autor(ctx) };
    return { ok: true, mudancas: [mudancaAnalise(al.antes, al.depois)], eventos: [evento('comparacao.registrada', analiseId, ctx, { par: k, antes: antesComp, conclusao: dados.conclusao, indicacao: ind.indicacao })] };
  }

  /* entrega executada para a responsabilidade de outra estrutura (F7 "sim") não abre recorte próprio */
  function execucaoParaOutra(ent) { return !!(ent.respostas.F7 && ent.respostas.F7.valor === 'sim'); }
  function validarEntregasDoRecorte(a, ids, recorteId) {
    if (!Array.isArray(ids) || ids.length === 0) return erro('RECORTE_SEM_ENTREGA');
    var vistos = {};
    for (var i = 0; i < ids.length; i++) {
      var e = a.entregas[ids[i]];
      if (!e || e.situacao === 'descartada') return erro('ENTREGA_INEXISTENTE', { entregaId: ids[i] });
      if (vistos[ids[i]]) return erro('ENTREGA_REPETIDA', { entregaId: ids[i] });
      vistos[ids[i]] = true;
      if (execucaoParaOutra(e)) return erro('ENTREGA_E_EXECUCAO_PARA_OUTRA', { entregaId: ids[i] });
      var ocupada = Object.keys(a.recortes).filter(function (r) { return r !== recorteId && a.recortes[r].situacao === 'ativo' && a.recortes[r].entregas.indexOf(ids[i]) !== -1; });
      if (ocupada.length) return erro('ENTREGA_JA_EM_OUTRO_RECORTE', { entregaId: ids[i], recorteId: ocupada[0] });
    }
    /* nunca funde sem fundamento: duas entregas juntas exigem comparação concluída como mesma ou integradas */
    for (var x = 0; x < ids.length; x++) for (var y = x + 1; y < ids.length; y++) {
      var comp = a.comparacoes[chavePar(ids[x], ids[y])];
      if (!comp || (comp.conclusao !== 'mesma' && comp.conclusao !== 'integradas')) return erro('AGRUPAMENTO_SEM_COMPARACAO', { a: ids[x], b: ids[y], conclusao: comp ? comp.conclusao : null });
    }
    return null;
  }
  /* Responsabilidade Organizacional (o "recorte"), no modelo simples: a pessoa informa a DESCRIÇÃO — pode ser o texto
     literal de uma atribuição da área — e responde "Essa descrição reúne trabalhos diferentes que precisam ser avaliados
     separadamente?" (separacao: nao | sim | nao-sei). Nada é reescrito nem inferido: `nome` repete a descrição (campo
     técnico usado pelas listas) e não há resultado, finalidade nem entregas obrigatórios. Qualquer resposta é salva; só
     "nao" (não precisa separar) deixa avaliar pelo O1–O9 (prontaParaO1O9). A resposta é uma confirmação da pessoa, não
     prova: o O1–O9 continua podendo indicar situações a validar. Sem `separacao` (registros anteriores e o caminho
     antigo) vale a regra de antes: nome, resultado, justificativa e entregas comparadas */
  function validarSeparacao(d) { return d && typeof d === 'object' && dentro(d.valor, SEPARACAO) && textoOpcional(d.observacao, MAX.texto); }
  function registroSeparacao(d, ctx) { var x = { valor: d.valor, em: ctx.agora, por: autor(ctx) }; if (d.observacao && d.observacao.trim()) x.observacao = d.observacao.trim(); return x; }
  function proximaOrdem(a) { var m = -1; Object.keys(a.recortes).forEach(function (k) { var o = a.recortes[k].ordem; if (typeof o === 'number' && o > m) m = o; }); return Math.max(m + 1, Object.keys(a.recortes).length); }
  function novaResponsabilidade(id, descricao, separacao, ctx, extra) {
    var r = { id: id, descricao: descricao.trim(), nome: descricao.trim(), resultado: null, justificativa: null, entregas: [], capacidades: [], objetoId: null, fatos: null,
      separacao: separacao ? registroSeparacao(separacao, ctx) : null, situacao: 'ativo', versao: 1, criadoEm: ctx.agora, criadoPor: autor(ctx) };
    if (extra) Object.keys(extra).forEach(function (k) { r[k] = extra[k]; });
    return r;
  }
  /* modelo simples = tem a descrição informada pela pessoa (os registros anteriores não têm) */
  function modeloSimples(r) { return !!r && typeof r.descricao === 'string'; }
  function definirRecorte(estado, analiseId, dados, ctx, ref) {
    var c = validarCtx(ctx, true); if (c) return erro(c);
    dados = dados || {};
    var simples = dados.descricao !== undefined && dados.descricao !== null;
    var sep = dados.separacao !== undefined && dados.separacao !== null;
    if (simples) {
      if (!texto(dados.descricao, MAX.texto)) return erro('DESCRICAO_OBRIGATORIA');
      if (sep && !validarSeparacao(dados.separacao)) return erro('SEPARACAO_INVALIDA');
    } else {
      if (!texto(dados.nome, MAX.nome)) return erro('NOME_OBRIGATORIO');
      if (!texto(dados.resultado, MAX.texto)) return erro('RESULTADO_OBRIGATORIO');
      if (!texto(dados.justificativa, MAX.texto)) return erro('JUSTIFICATIVA_DO_RECORTE_OBRIGATORIA');
    }
    var cap = validarCapacidades(dados.capacidades, ref); if (cap) return erro(cap);
    var al = abrirAlteracao(estado, analiseId, dados); if (al.erro) return al.erro;
    if (al.depois.recortes[ctx.novoId]) return erro('ID_JA_USADO');
    var ents = Array.isArray(dados.entregas) ? dados.entregas : [];
    if (!simples || ents.length) { var inv = validarEntregasDoRecorte(al.depois, ents, ctx.novoId); if (inv) return inv; }
    var r;
    if (simples) { r = novaResponsabilidade(ctx.novoId, dados.descricao, sep ? dados.separacao : null, ctx, { ordem: proximaOrdem(al.depois) }); r.entregas = ents.slice(); r.capacidades = clone(dados.capacidades || []); }
    else r = { id: ctx.novoId, nome: dados.nome.trim(), resultado: dados.resultado.trim(), justificativa: dados.justificativa.trim(),
      entregas: ents.slice(), capacidades: clone(dados.capacidades || []), objetoId: null, fatos: null, situacao: 'ativo', versao: 1, criadoEm: ctx.agora, criadoPor: autor(ctx) };
    al.depois.recortes[ctx.novoId] = r;
    var det = { recorteId: ctx.novoId, entregas: ents.slice() }; if (simples) { det.descricao = r.descricao; det.separacao = r.separacao ? r.separacao.valor : null; }
    return { ok: true, mudancas: [mudancaAnalise(al.antes, al.depois)], eventos: [evento('recorte.definido', analiseId, ctx, det)] };
  }
  /* revisar uma responsabilidade ainda não avaliada: a descrição e a resposta sobre separar, explicitamente, com antes e
     depois no histórico (é assim que "Não sei" vira "Não" — nunca por outro caminho, nem pelo detalhamento) */
  function revisarResponsabilidade(estado, analiseId, recorteId, dados, ctx) {
    var c = validarCtx(ctx); if (c) return erro(c);
    dados = dados || {};
    if (!texto(dados.descricao, MAX.texto)) return erro('DESCRICAO_OBRIGATORIA');
    if (!validarSeparacao(dados.separacao)) return erro('SEPARACAO_INVALIDA');
    var al = abrirAlteracao(estado, analiseId, dados); if (al.erro) return al.erro;
    var r = al.depois.recortes[recorteId];
    if (!r || r.situacao !== 'ativo') return erro('RECORTE_INEXISTENTE', { recorteId: recorteId });
    if (r.objetoId) return erro('RECORTE_JA_AVALIADO_DEFINA_OUTRO', { recorteId: recorteId, objetoId: r.objetoId });
    var antesR = clone(r);
    r.descricao = dados.descricao.trim(); r.nome = r.descricao; r.separacao = registroSeparacao(dados.separacao, ctx);
    r.versao = (antesR.versao || 1) + 1;
    return { ok: true, mudancas: [mudancaAnalise(al.antes, al.depois)], eventos: [evento('recorte.revisado', analiseId, ctx, { recorteId: recorteId,
      antes: { descricao: typeof antesR.descricao === 'string' ? antesR.descricao : antesR.nome, separacao: antesR.separacao ? antesR.separacao.valor : null },
      depois: { descricao: r.descricao, separacao: r.separacao.valor, observacao: r.separacao.observacao || null } })] };
  }
  /* separar ("Sim, precisa separar"): a pessoa informa as partes — duas ou mais, cada uma com a sua resposta. A original
     fica como "desdobrada", com o vínculo às partes, e nunca é avaliada como responsabilidade agregada; cada parte guarda
     a origem. Nada é inventado: os textos são os da pessoa. ctx.novosIds traz um identificador por parte */
  function desdobrarResponsabilidade(estado, analiseId, recorteId, dados, ctx) {
    var c = validarCtx(ctx); if (c) return erro(c);
    dados = dados || {};
    var partes = Array.isArray(dados.partes) ? dados.partes : [];
    if (partes.length < 2) return erro('PARTES_INSUFICIENTES');
    for (var p = 0; p < partes.length; p++) {
      if (!partes[p] || !texto(partes[p].descricao, MAX.texto)) return erro('DESCRICAO_OBRIGATORIA', { parte: p });
      if (!validarSeparacao(partes[p].separacao)) return erro('SEPARACAO_INVALIDA', { parte: p });
    }
    var ids = Array.isArray(ctx.novosIds) ? ctx.novosIds : [];
    if (ids.length !== partes.length || ids.some(function (x) { return !texto(x, MAX.chave); })) return erro('CTX_IDS_AUSENTES');
    var al = abrirAlteracao(estado, analiseId, dados); if (al.erro) return al.erro;
    var r = al.depois.recortes[recorteId];
    if (!r || r.situacao !== 'ativo') return erro('RECORTE_INEXISTENTE', { recorteId: recorteId });
    if (r.objetoId) return erro('RECORTE_JA_AVALIADO_DEFINA_OUTRO', { recorteId: recorteId, objetoId: r.objetoId });
    if (!r.separacao || r.separacao.valor !== 'sim') return erro('SEPARAR_SO_COM_SIM');
    if (ids.some(function (x) { return al.depois.recortes[x]; })) return erro('ID_JA_USADO');
    var base = proximaOrdem(al.depois);
    ids.forEach(function (id, n) { al.depois.recortes[id] = novaResponsabilidade(id, partes[n].descricao, partes[n].separacao, ctx, { origemRecorteId: recorteId, ordem: base + n }); });
    r.situacao = 'desdobrado'; r.desdobramento = { partes: ids.slice(), em: ctx.agora, por: autor(ctx) };
    return { ok: true, mudancas: [mudancaAnalise(al.antes, al.depois)], eventos: [evento('recorte.desdobrado', analiseId, ctx, { recorteId: recorteId,
      partes: ids.map(function (id, n) { return { id: id, descricao: al.depois.recortes[id].descricao, separacao: partes[n].separacao.valor }; }) })] };
  }
  /* várias responsabilidades de uma vez (uma por linha, coladas pela pessoa): numa ÚNICA gravação — ou entram todas,
     ou nenhuma (sem importação parcial nem duplicada por repetição do envio, que é recusada pela revisão). Os textos
     são gravados como vieram (só sem espaços nas pontas), na ordem informada, sem resposta sobre separar: cada uma
     começa "pendente de delimitação". Nada é dividido, juntado nem associado a núcleo */
  function registrarResponsabilidadesEmLote(estado, analiseId, dados, ctx) {
    var c = validarCtx(ctx); if (c) return erro(c);
    dados = dados || {};
    var lista = Array.isArray(dados.descricoes) ? dados.descricoes : [];
    if (!lista.length) return erro('LOTE_VAZIO');
    if (lista.length > MAX.lote) return erro('LOTE_GRANDE_DEMAIS', { maximo: MAX.lote });
    for (var i = 0; i < lista.length; i++) if (!texto(lista[i], MAX.texto)) return erro('DESCRICAO_OBRIGATORIA', { indice: i });
    var ids = Array.isArray(ctx.novosIds) ? ctx.novosIds : [];
    if (ids.length !== lista.length || ids.some(function (x) { return !texto(x, MAX.chave); })) return erro('CTX_IDS_AUSENTES');
    var al = abrirAlteracao(estado, analiseId, dados); if (al.erro) return al.erro;
    if (ids.some(function (x) { return al.depois.recortes[x]; })) return erro('ID_JA_USADO');
    var base = proximaOrdem(al.depois);
    ids.forEach(function (id, n) { al.depois.recortes[id] = novaResponsabilidade(id, lista[n], null, ctx, { ordem: base + n }); });
    return { ok: true, mudancas: [mudancaAnalise(al.antes, al.depois)], eventos: [evento('recortes.registrados-em-lote', analiseId, ctx, { quantidade: ids.length,
      recortes: ids.map(function (id) { return { id: id, descricao: al.depois.recortes[id].descricao }; }) })] };
  }
  /* "Qual núcleo ou quais núcleos exercem esta responsabilidade atualmente?" — opcional, um ou vários, corrigível a
     qualquer momento (também depois do O1–O9: não influencia a classificação). Fica em fatos.execucao — a mesma
     informação descritiva de "quem executa hoje", com caráter "declarado", fonte e data —, nunca vínculo formal nem
     estrutura nova: o núcleo do cadastro do ADMIN vai por estruturaId; o que não está no cadastro, por texto */
  function informarNucleosAtuais(estado, analiseId, recorteId, dados, ctx) {
    var c = validarCtx(ctx); if (c) return erro(c);
    dados = dados || {};
    var lista = Array.isArray(dados.nucleos) ? dados.nucleos : [], vistos = {};
    for (var i = 0; i < lista.length; i++) {
      var x = lista[i] || {}, chave = x.estruturaId ? 'e:' + x.estruturaId : 't:' + String(x.texto || '').trim().toLowerCase();
      if (!texto(x.estruturaId, MAX.chave) && !texto(x.texto, MAX.nome)) return erro('NUCLEO_INVALIDO', { indice: i });
      if (vistos[chave]) return erro('NUCLEO_REPETIDO', { indice: i });
      vistos[chave] = true;
    }
    if (!textoOpcional(dados.fonte, MAX.texto)) return erro('FONTE_INVALIDA');
    var al = abrirAlteracao(estado, analiseId, dados); if (al.erro) return al.erro;
    var r = al.depois.recortes[recorteId];
    if (!r || r.situacao !== 'ativo') return erro('RECORTE_INEXISTENTE', { recorteId: recorteId });
    var fonte = dados.fonte && dados.fonte.trim() ? dados.fonte.trim() : 'Declaração registrada na análise organizacional';
    var antesF = r.fatos ? clone(r.fatos.execucao) : [];
    var exec = lista.map(function (x) { var f = { carater: 'declarado', fonte: fonte, informadoEm: ctx.agora, informadoPor: autor(ctx) }; if (x.estruturaId) f.estruturaId = x.estruturaId; else f.texto = String(x.texto).trim(); return f; });
    r.fatos = { execucao: exec, responsavelFormal: r.fatos && r.fatos.responsavelFormal ? r.fatos.responsavelFormal : null };
    return { ok: true, mudancas: [mudancaAnalise(al.antes, al.depois)], eventos: [evento('nucleos.informados', analiseId, ctx, { recorteId: recorteId, antes: antesF, depois: clone(exec) })] };
  }
  /* rever a delimitação (M2 da revisão 3): nova versão do recorte, com motivo; o histórico guarda antes e depois.
     Se o recorte já foi avaliado (tem atuação), a revisão não mexe na classificação: o recorte novo é avaliado de novo */
  function ajustarRecorte(estado, analiseId, recorteId, dados, ctx) {
    var c = validarCtx(ctx); if (c) return erro(c);
    dados = dados || {};
    if (!texto(dados.motivo, MAX.motivo)) return erro('MOTIVO_OBRIGATORIO');
    var al = abrirAlteracao(estado, analiseId, dados); if (al.erro) return al.erro;
    var r = al.depois.recortes[recorteId];
    if (!r || r.situacao !== 'ativo') return erro('RECORTE_INEXISTENTE', { recorteId: recorteId });
    if (r.objetoId) return erro('RECORTE_JA_AVALIADO_DEFINA_OUTRO', { recorteId: recorteId, objetoId: r.objetoId });
    var antesR = clone(r);
    if (dados.nome !== undefined) { if (!texto(dados.nome, MAX.nome)) return erro('NOME_OBRIGATORIO'); r.nome = dados.nome.trim(); }
    if (dados.resultado !== undefined) { if (!texto(dados.resultado, MAX.texto)) return erro('RESULTADO_OBRIGATORIO'); r.resultado = dados.resultado.trim(); }
    if (dados.justificativa !== undefined) { if (!texto(dados.justificativa, MAX.texto)) return erro('JUSTIFICATIVA_DO_RECORTE_OBRIGATORIA'); r.justificativa = dados.justificativa.trim(); }
    if (dados.entregas !== undefined) { var inv = validarEntregasDoRecorte(al.depois, dados.entregas, recorteId); if (inv) return inv; r.entregas = dados.entregas.slice(); }
    r.versao = antesR.versao + 1;
    return { ok: true, mudancas: [mudancaAnalise(al.antes, al.depois)], eventos: [evento('recorte.ajustado', analiseId, ctx, { recorteId: recorteId, motivo: dados.motivo, antes: antesR, depois: clone(r) })] };
  }
  function descartarRecorte(estado, analiseId, recorteId, dados, ctx) {
    var c = validarCtx(ctx); if (c) return erro(c);
    dados = dados || {};
    if (!texto(dados.motivo, MAX.motivo)) return erro('MOTIVO_OBRIGATORIO');
    var al = abrirAlteracao(estado, analiseId, dados); if (al.erro) return al.erro;
    var r = al.depois.recortes[recorteId];
    if (!r || r.situacao !== 'ativo') return erro('RECORTE_INEXISTENTE', { recorteId: recorteId });
    r.situacao = 'descartado'; r.descarte = { motivo: dados.motivo, em: ctx.agora, por: autor(ctx) };
    return { ok: true, mudancas: [mudancaAnalise(al.antes, al.depois)], eventos: [evento('recorte.descartado', analiseId, ctx, { recorteId: recorteId, motivo: dados.motivo })] };
  }

  /* N2: quem executa e quem responde formalmente — fatos descritivos da análise, com caráter, fonte e data */
  function registrarFatos(estado, analiseId, recorteId, dados, ctx) {
    var c = validarCtx(ctx); if (c) return erro(c);
    dados = dados || {};
    var al = abrirAlteracao(estado, analiseId, dados); if (al.erro) return al.erro;
    var r = al.depois.recortes[recorteId];
    if (!r || r.situacao !== 'ativo') return erro('RECORTE_INEXISTENTE', { recorteId: recorteId });
    var exec = dados.execucao || [];
    if (!Array.isArray(exec)) return erro('EXECUCAO_INVALIDA');
    for (var i = 0; i < exec.length; i++) if (!validarFato(exec[i], true)) return erro('EXECUCAO_INVALIDA', { indice: i });
    var rf = dados.responsavelFormal;
    if (!rf || !dentro(rf.certeza, CERTEZA_RESPONSAVEL)) return erro('CERTEZA_RESPONSAVEL_INVALIDA');
    if (rf.certeza === 'nao-definido') { if (rf.estruturaId || rf.texto) return erro('RESPONSAVEL_NAO_DEFINIDO_COM_ESTRUTURA'); if (!validarFato(rf, false)) return erro('RESPONSAVEL_FORMAL_INVALIDO'); }
    else if (!validarFato(rf, true)) return erro('RESPONSAVEL_FORMAL_INVALIDO');
    var carimbo = function (f) { var x = clone(f); x.informadoEm = ctx.agora; x.informadoPor = autor(ctx); return x; };
    var antesF = r.fatos ? clone(r.fatos) : null;
    r.fatos = { execucao: exec.map(carimbo), responsavelFormal: carimbo(rf) };
    return { ok: true, mudancas: [mudancaAnalise(al.antes, al.depois)], eventos: [evento('fatos.registrados', analiseId, ctx, { recorteId: recorteId, antes: antesF, depois: clone(r.fatos) })] };
  }

  /* D7: predominância investigada como EVIDÊNCIA QUALITATIVA (texto e exemplo) para a decisão humana — nunca uma escolha
     entre códigos nem uma regra equivalente à v2; não muda a classificação */
  function registrarEvidenciaQualitativa(estado, analiseId, recorteId, dados, ctx) {
    var c = validarCtx(ctx); if (c) return erro(c);
    dados = dados || {};
    if (!texto(dados.texto, MAX.texto)) return erro('EVIDENCIA_SEM_TEXTO');
    if (!textoOpcional(dados.exemplo, MAX.texto)) return erro('EXEMPLO_INVALIDO');
    var al = abrirAlteracao(estado, analiseId, dados); if (al.erro) return al.erro;
    var r = al.depois.recortes[recorteId];
    if (!r || r.situacao !== 'ativo') return erro('RECORTE_INEXISTENTE', { recorteId: recorteId });
    var lista = Array.isArray(r.evidenciasQualitativas) ? r.evidenciasQualitativas : [];
    var item = { texto: dados.texto.trim(), em: ctx.agora, por: autor(ctx) };
    if (dados.exemplo) item.exemplo = dados.exemplo;
    r.evidenciasQualitativas = lista.concat([item]);
    return { ok: true, mudancas: [mudancaAnalise(al.antes, al.depois)], eventos: [evento('evidencia.registrada', analiseId, ctx, { recorteId: recorteId, texto: item.texto })] };
  }
  /* origem única e imutável: uma atuação nasce de no máximo um recorte, em toda a base */
  function origemDoObjeto(estado, objetoId) {
    var as = (estado && estado.analises) || {};
    for (var id in as) {
      if (!Object.prototype.hasOwnProperty.call(as, id)) continue;
      var rs = as[id].recortes || {};
      for (var r in rs) if (Object.prototype.hasOwnProperty.call(rs, r) && rs[r].objetoId === objetoId) return { analiseId: id, recorteId: r };
    }
    return null;
  }
  function associarAtuacao(estado, analiseId, recorteId, objetoId, ctx) {
    var c = validarCtx(ctx); if (c) return erro(c);
    if (!texto(objetoId, MAX.chave)) return erro('ATUACAO_INVALIDA');
    var al = abrirAlteracao(estado, analiseId); if (al.erro) return al.erro;
    var r = al.depois.recortes[recorteId];
    if (!r || r.situacao !== 'ativo') return erro('RECORTE_INEXISTENTE', { recorteId: recorteId });
    if (r.objetoId) return erro('RECORTE_JA_TEM_ATUACAO', { objetoId: r.objetoId });
    var o = origemDoObjeto(estado, objetoId);
    if (o) return erro('ATUACAO_JA_TEM_ORIGEM', o);
    if (al.depois.objetoAmploId === objetoId) return erro('ATUACAO_E_O_OBJETO_AMPLO');
    var pronta = prontaParaO1O9(al.antes, recorteId);
    if (!pronta.pronta) return erro('RECORTE_NAO_PRONTO', { faltas: pronta.faltas });
    r.objetoId = objetoId;
    return { ok: true, mudancas: [mudancaAnalise(al.antes, al.depois)], eventos: [evento('recorte.atuacao-associada', analiseId, ctx, { recorteId: recorteId, objetoId: objetoId })] };
  }
  /* N:N por referência: outra análise cita uma responsabilidade já delimitada, sem mudar a origem dela */
  function referenciarResponsabilidade(estado, analiseId, objetoId, ctx) {
    var c = validarCtx(ctx); if (c) return erro(c);
    if (!texto(objetoId, MAX.chave)) return erro('ATUACAO_INVALIDA');
    var al = abrirAlteracao(estado, analiseId); if (al.erro) return al.erro;
    var o = origemDoObjeto(estado, objetoId);
    if (o && o.analiseId === analiseId) return erro('REFERENCIA_A_PROPRIA_ORIGEM');
    if (al.depois.referencias[objetoId]) return erro('REFERENCIA_REPETIDA');
    al.depois.referencias[objetoId] = { em: ctx.agora, por: autor(ctx), origem: o };
    return { ok: true, mudancas: [mudancaAnalise(al.antes, al.depois)], eventos: [evento('responsabilidade.referenciada', analiseId, ctx, { objetoId: objetoId })] };
  }
  function descartarAnalise(estado, analiseId, dados, ctx) {
    var c = validarCtx(ctx); if (c) return erro(c);
    dados = dados || {};
    if (!texto(dados.motivo, MAX.motivo)) return erro('MOTIVO_OBRIGATORIO');
    var al = abrirAlteracao(estado, analiseId, dados); if (al.erro) return al.erro;
    al.depois.situacao = 'descartada'; al.depois.descarte = { motivo: dados.motivo, em: ctx.agora, por: autor(ctx) };
    return { ok: true, mudancas: [mudancaAnalise(al.antes, al.depois)], eventos: [evento('analise.descartada', analiseId, ctx, { motivo: dados.motivo })] };
  }

  /* ---------- proposta de composição (F17) e aprovação institucional (N1) ---------- */
  function propostasDaAnalise(estado, analiseId) {
    var ps = (estado && estado.propostas) || {}, lista = [];
    Object.keys(ps).forEach(function (k) { if (ps[k].analiseId === analiseId) lista.push(ps[k]); });
    return lista.sort(function (x, y) { return x.versao - y.versao; });
  }
  function propostaVigente(estado, analiseId) { var l = propostasDaAnalise(estado, analiseId); return l.length ? l[l.length - 1] : null; }
  function registrarProposta(estado, analiseId, dados, ctx) {
    var c = validarCtx(ctx); if (c) return erro(c);
    dados = dados || {};
    if (dentro(dados.alternativa, ALTERNATIVAS_RECUSADAS)) return erro('ALTERNATIVA_RECUSADA_NAO_RECLASSIFICA', { alternativa: dados.alternativa });
    if (!dentro(dados.alternativa, ALTERNATIVAS)) return erro('ALTERNATIVA_INVALIDA');
    if (!texto(dados.justificativa, MAX.texto)) return erro('JUSTIFICATIVA_OBRIGATORIA');
    /* a proposta também atualiza a análise (versão vigente + revisão): duas propostas simultâneas não entram juntas */
    var al = abrirAlteracao(estado, analiseId, dados); if (al.erro) return al.erro;
    var a = al.antes;
    var recortes = dados.recortes || [];
    if (!Array.isArray(recortes) || recortes.length === 0) return erro('PROPOSTA_SEM_RECORTE');
    for (var i = 0; i < recortes.length; i++) if (!a.recortes[recortes[i]] || a.recortes[recortes[i]].situacao !== 'ativo') return erro('RECORTE_INEXISTENTE', { recorteId: recortes[i] });
    if (dados.alternativa === 'pendente') {
      var p = dados.pendencia || {};
      if (!texto(p.falta, MAX.texto) || !texto(p.proximaAcao, MAX.texto) || !texto(p.quemDecide, MAX.nome)) return erro('PENDENCIA_INCOMPLETA');
    }
    var anterior = propostaVigente(estado, analiseId), versao = anterior ? anterior.versao + 1 : 1;
    if ((a.propostaVigente || 0) !== (anterior ? anterior.versao : 0)) return erro('PROPOSTA_DESATUALIZADA', { vigente: a.propostaVigente || 0 });
    if (dados.versaoAnteriorEsperada !== undefined && dados.versaoAnteriorEsperada !== (anterior ? anterior.versao : 0)) return erro('PROPOSTA_DESATUALIZADA', { vigente: anterior ? anterior.versao : 0 });
    var id = analiseId + '~' + versao;
    var prop = { id: id, analiseId: analiseId, versao: versao, alternativa: dados.alternativa, recortes: recortes.slice(), justificativa: dados.justificativa,
      criterios: clone(dados.criterios || {}), pendencia: dados.alternativa === 'pendente' ? clone(dados.pendencia) : null,
      situacao: dados.alternativa === 'pendente' ? 'pendente' : 'proposta', registradaEm: ctx.agora, registradaPor: autor(ctx), revisao: 1 };
    al.depois.propostaVigente = versao;
    return { ok: true, mudancas: [mudancaAnalise(al.antes, al.depois), { entidade: 'proposta', id: id, antes: null, depois: prop, revisaoAnterior: null }],
      eventos: [evento('proposta.registrada', analiseId, ctx, { versao: versao, alternativa: prop.alternativa, situacao: prop.situacao })] };
  }
  function registrarAprovacao(estado, analiseId, versao, dados, ctx) {
    var c = validarCtx(ctx); if (c) return erro(c);
    dados = dados || {};
    if (!texto(dados.autoridade, MAX.nome)) return erro('AUTORIDADE_OBRIGATORIA');
    if (!texto(dados.referencia, MAX.texto)) return erro('REFERENCIA_DO_ATO_OBRIGATORIA');
    if (instante(dados.dataDoAto) === null) return erro('DATA_DO_ATO_INVALIDA');
    if (!texto(dados.objetoAprovado, MAX.texto)) return erro('OBJETO_APROVADO_OBRIGATORIO');
    var vig = propostaVigente(estado, analiseId);
    if (!vig || vig.versao !== versao) return erro('PROPOSTA_NAO_VIGENTE', { vigente: vig ? vig.versao : null });
    if (vig.situacao !== 'proposta') return erro('PROPOSTA_PENDENTE_NAO_SE_APROVA');
    var id = analiseId + '~' + versao;
    if (estado.aprovacoes && estado.aprovacoes[id]) return erro('PROPOSTA_JA_TEM_APROVACAO');
    var ap = { id: id, analiseId: analiseId, versaoProposta: versao, natureza: 'referencia-a-ato-externo', autoridade: dados.autoridade, referencia: dados.referencia,
      dataDoAto: dados.dataDoAto, objetoAprovado: dados.objetoAprovado, registradoEm: ctx.agora, registradoPor: autor(ctx), revisao: 1 };
    return { ok: true, mudancas: [{ entidade: 'aprovacao', id: id, antes: null, depois: ap, revisaoAnterior: null }],
      eventos: [evento('aprovacao.registrada', analiseId, ctx, { versao: versao, natureza: ap.natureza, autoridade: ap.autoridade })] };
  }

  /* ==================== consultas ==================== */
  /* F9: pares de entregas parecidas na superfície (mesma forma ou mesmo destinatário; o mesmo responsável só reforça)
     — só sugestão de comparar, nunca fusão */
  function sugestoesDeComparacao(a) {
    var ids = Object.keys(a.entregas).filter(function (k) { return a.entregas[k].situacao === 'ativa' && !execucaoParaOutra(a.entregas[k]); }).sort();
    var lista = [];
    for (var i = 0; i < ids.length; i++) for (var j = i + 1; j < ids.length; j++) {
      var x = a.entregas[ids[i]].respostas, y = a.entregas[ids[j]].respostas, sinais = [];
      if (x.F4 && y.F4 && x.F4.valor === y.F4.valor) sinais.push('mesma-forma');
      if (x.F5 && y.F5 && x.F5.valor === y.F5.valor) sinais.push('mesmo-destinatario');
      if (x.F6 && y.F6 && x.F6.valor === y.F6.valor && x.F6.valor !== 'nao-sei') sinais.push('mesmo-responsavel');
      /* F12 "nos próprios casos": a disciplina pode ser parte da execução técnica — vale comparar */
      var pr = function (e1, e2) { return e1.F12 && e1.F12.valor === 'proprios-casos' && e2.F4 && e2.F4.valor === 'julgamento-tecnico'; };
      if (pr(x, y) || pr(y, x)) sinais.push('padrao-aplicado-nos-proprios-casos');
      /* o mesmo responsável sozinho não basta (quase todas as entregas de uma estrutura o compartilham): só reforça */
      var basta = sinais.some(function (z) { return z !== 'mesmo-responsavel'; });
      if (basta && !a.comparacoes[chavePar(ids[i], ids[j])]) lista.push({ a: ids[i], b: ids[j], sinais: sinais });
    }
    return lista;
  }
  /* próximas perguntas, em ordem, cada uma com o motivo de aparecer (regras de avanço e aprofundamento) */
  function proximasPerguntas(a) {
    var lista = [], r = a.respostas;
    function q(id, motivo, extra) { var o = { pergunta: id, motivo: motivo }; if (extra) Object.keys(extra).forEach(function (k) { o[k] = extra[k]; }); lista.push(o); }
    if (a.situacao === 'descartada') return lista;
    if (a.tipoEscopo === 'responsabilidade') {
      if (!r.F2a) q('F2a', 'escopo-responsabilidade'); /* a F2a não esconde as outras perguntas (é opcional na tela) */
      else if (r.F2a.valor === 'sim') return lista;
    }
    if (a.tipoEscopo === 'estrutura' && !r.F2b) q('F2b', 'escopo-estrutura');
    if (a.tipoEscopo === 'capacidade' && !r.F2c) q('F2c', 'escopo-capacidade');
    var ents = Object.keys(a.entregas).filter(function (k) { return a.entregas[k].situacao === 'ativa'; }).sort();
    /* sem entregas: só pergunta por elas enquanto nenhuma responsabilidade foi registrada (entregas são opcionais) */
    var temRecorte = Object.keys(a.recortes).some(function (k) { return a.recortes[k].situacao === 'ativo'; });
    if (!ents.length && !temRecorte && !(r.F3 && r.F3.valor === 'nenhuma')) q('F3', 'sem-entregas');
    ents.forEach(function (k) {
      var x = a.entregas[k].respostas, f4 = x.F4 && x.F4.valor;
      if (!x.F4) q('F4', 'entrega-sem-forma', { entregaId: k });
      if (!x.F5) q('F5', 'entrega-sem-destinatario', { entregaId: k });
      if (!x.F6) q('F6', 'entrega-sem-responsavel', { entregaId: k });
      var regrasDeOutra = x.F13 && (x.F13.valor === 'de-uma-linha' || x.F13.valor === 'de-outra-estrutura');
      if (!x.F7 && dentro(a.tipoEscopo, ESCOPOS_COM_ESTRUTURA_PROPRIA) && ((x.F6 && x.F6.valor === 'outra-estrutura') || regrasDeOutra)) q('F7', regrasDeOutra ? 'regras-de-outra-estrutura' : 'outra-estrutura-responde', { entregaId: k });
      if (f4 === 'padrao-capacitacao' && !x.F12) q('F12', 'padrao-ou-capacitacao', { entregaId: k });
      if ((f4 === 'servico-operado' || f4 === 'solucao-construida') && !x.F13) q('F13', 'servico-ou-solucao', { entregaId: k });
      if (!x.F8) q('F8', 'sem-evidencia-registrada', { entregaId: k });
    });
    var formas = ents.map(function (k) { var x = a.entregas[k].respostas; return x.F4 && x.F4.valor; });
    var temPolitica = formas.indexOf('politica-norma') !== -1;
    var temOperacao = formas.indexOf('servico-operado') !== -1 || formas.indexOf('solucao-construida') !== -1;
    var temReferencia = Object.keys(a.referencias).length > 0;
    var pedeSegregacao = (temPolitica && (temOperacao || a.tipoEscopo === 'capacidade' || temReferencia)) || (a.tipoEscopo === 'capacidade' && temReferencia && temOperacao);
    if (pedeSegregacao && !r.F11) q('F11', 'politica-e-operacao');
    sugestoesDeComparacao(a).forEach(function (p) { q('F10', 'semelhanca-de-superficie', { par: [p.a, p.b], sinais: p.sinais }); });
    return lista;
  }
  /* lacunas: o que ficou como "não sei", sem evidência ou sem conclusão — nunca bloqueiam, ficam listadas */
  function lacunas(a) {
    var l = [], r = a.respostas;
    if (r.F2c && r.F2c.valor === 'nao-sei') l.push({ tipo: 'responsabilidades-da-capacidade-desconhecidas' });
    if (r.F3 && r.F3.valor === 'nenhuma') l.push({ tipo: 'sem-entrega-identificada' });
    Object.keys(a.entregas).sort().forEach(function (k) {
      var e = a.entregas[k]; if (e.situacao !== 'ativa') return;
      var x = e.respostas;
      if (x.F6 && x.F6.valor === 'nao-sei') l.push({ tipo: 'responsavel-desconhecido', entregaId: k });
      if (x.F8 && x.F8.valor === 'sem-evidencia') l.push({ tipo: 'hipotese-sem-evidencia', entregaId: k });
    });
    Object.keys(a.comparacoes).sort().forEach(function (k) {
      var p = k.split('|'), ativa = function (id) { return a.entregas[id] && a.entregas[id].situacao === 'ativa'; };
      if (a.comparacoes[k].conclusao === 'nao-sei' && ativa(p[0]) && ativa(p[1])) l.push({ tipo: 'identidade-nao-concluida', par: k });
    });
    var semRecorte = Object.keys(a.entregas).filter(function (k) {
      var e = a.entregas[k]; if (e.situacao !== 'ativa' || execucaoParaOutra(e)) return false;
      return !Object.keys(a.recortes).some(function (r2) { return a.recortes[r2].situacao === 'ativo' && a.recortes[r2].entregas.indexOf(k) !== -1; });
    }).sort();
    semRecorte.forEach(function (k) { l.push({ tipo: 'entrega-sem-recorte', entregaId: k }); });
    Object.keys(a.recortes).sort().forEach(function (k) { var x = a.recortes[k]; if (x.situacao === 'ativo' && modeloSimples(x) && !x.objetoId && (!x.separacao || x.separacao.valor !== 'nao')) l.push({ tipo: 'separacao-pendente', recorteId: k, valor: x.separacao ? x.separacao.valor : null }); });
    return l;
  }
  /* F15 (N5): delimitação suficiente. No modelo simples: descrição e "não precisa separar" (entregas, evidência,
     destinatário, resultado e finalidade não são pré-requisito). Sem ele (registros anteriores): nome, resultado e
     entregas com forma, destinatário e evidência ou hipótese. O responsável formal NÃO é exigido (conhecido, provável ou ainda não definido) */
  function prontaParaO1O9(a, recorteId) {
    var r = a && a.recortes ? a.recortes[recorteId] : null, faltas = [];
    if (!r || r.situacao !== 'ativo') return { pronta: false, faltas: ['RECORTE_INEXISTENTE'] };
    if (modeloSimples(r)) {
      if (!texto(r.descricao, MAX.texto)) faltas.push('DESCRICAO');
      if (!r.separacao) faltas.push('SEPARACAO_NAO_RESPONDIDA');
      else if (r.separacao.valor !== 'nao') faltas.push('SEPARACAO_PENDENTE');
      return { pronta: faltas.length === 0, faltas: faltas, separacao: r.separacao ? r.separacao.valor : null, hipotese: false };
    }
    if (!texto(r.nome, MAX.nome)) faltas.push('NOME');
    if (!texto(r.resultado, MAX.texto)) faltas.push('RESULTADO');
    r.entregas.forEach(function (k) {
      var x = (a.entregas[k] || {}).respostas || {};
      if (!x.F4) faltas.push('FORMA:' + k);
      if (!x.F5) faltas.push('DESTINATARIO:' + k);
      if (!x.F8) faltas.push('EVIDENCIA_OU_HIPOTESE:' + k);
    });
    return { pronta: faltas.length === 0, faltas: faltas, hipotese: r.entregas.some(function (k) { var x = (a.entregas[k] || {}).respostas || {}; return x.F8 && x.F8.valor === 'sem-evidencia'; }) };
  }
  /* F16: situação formal de uma responsabilidade, confrontando a natureza (código efetivo, vindo do Posicionamento)
     com o vínculo principal e com a execução declarada. O núcleo não conhece códigos: compara pela ligação oficial
     código → conceito (ref.ligacoes), a mesma regra V3 de estruturas-nucleo.js */
  function situacaoFormal(entrada) {
    entrada = entrada || {};
    var lig = (entrada.ref && entrada.ref.ligacoes) || {}, est = entrada.estruturas || {};
    var tipoEsperado = entrada.codigoEfetivo ? lig[entrada.codigoEfetivo] : undefined;
    var compativel = function (id) { var e = est[id]; return !!(e && e.situacao === 'ativa' && tipoEsperado && e.tipo === tipoEsperado); };
    if (!entrada.codigoEfetivo) return entrada.aValidar ? 'classificacao-a-validar' : 'sem-classificacao';
    var v = entrada.vinculoPrincipal;
    if (v && v.situacao === 'ativo') return compativel(v.estruturaId) ? 'compativel' : 'vinculo-a-revisar';
    var exec = ((entrada.fatos && entrada.fatos.execucao) || []).filter(function (f) { return f.estruturaId && est[f.estruturaId] && est[f.estruturaId].situacao === 'ativa'; });
    if (exec.some(function (f) { return compativel(f.estruturaId); })) return 'executada-sem-vinculo-formal';
    if (exec.length) return 'exercida-sem-responsavel-formal-compativel';
    return 'sem-estrutura';
  }
  /* alternativas de desenho para cada situação, com a consequência; nunca reclassificar (N3) */
  var ALTERNATIVAS_POR_SITUACAO = {
    'compativel': [['manter-consciente', 'Nada muda no cadastro.']],
    'executada-sem-vinculo-formal': [['manter-consciente', 'Registrar o vínculo principal com a estrutura que já executa, no Posicionamento.'], ['pendente', 'Registrar o que falta e quem decide.']],
    'exercida-sem-responsavel-formal-compativel': [
      ['manter-consciente', 'A estrutura continua exercendo sem responder formalmente; a pendência fica visível.'],
      ['rever-delimitacao', 'Se houver evidência de que é só atividade complementar, refazer o recorte e avaliar o novo recorte com o O1–O9.'],
      ['integrar-recortes', 'Juntar com outro recorte, se a comparação concluir que é a mesma responsabilidade ou que são integradas.'],
      ['distribuir-existentes', 'Atribuir a uma estrutura existente do tipo da natureza recomendada.'],
      ['propor-estrutura', 'Constituir uma estrutura do tipo, com aprovação institucional e cadastro por quem pode; as pessoas podem ser compartilhadas.'],
      ['pendente', 'Registrar o que falta e quem decide.']],
    'sem-estrutura': [['distribuir-existentes', 'Atribuir a uma estrutura existente do tipo.'], ['propor-estrutura', 'Constituir uma estrutura do tipo, com aprovação institucional.'], ['pendente', 'Registrar o que falta e quem decide.']],
    'vinculo-a-revisar': [['pendente', 'O vínculo existente não corresponde mais à natureza; revisar no Posicionamento.']],
    'classificacao-a-validar': [['rever-delimitacao', 'Aprofundar o "A validar" (recorte, conflito, evidência ou incoerência).'], ['pendente', 'Registrar o que falta e quem decide.']],
    'sem-classificacao': [['pendente', 'Concluir o O1–O9 deste recorte.']]
  };
  function alternativasPara(situacao) { return (ALTERNATIVAS_POR_SITUACAO[situacao] || []).map(function (x) { return { alternativa: x[0], consequencia: x[1] }; }); }
  /* categoria de um caso (matriz de cenários da especificação) */
  function categoriaDoCaso(situacoes, opcoes) {
    if (opcoes && opcoes.funcionalidadeFutura) return 'funcionalidade-futura';
    if (!situacoes.length) return 'diagnostico-concluido-pendente';
    return situacoes.every(function (s) { return s === 'compativel'; }) ? 'completa' : 'diagnostico-concluido-pendente';
  }
  /* situação da análise (calculada, nunca gravada) */
  function situacaoDaAnalise(estado, analiseId, info) {
    var a = lerAnalise(estado, analiseId); if (!a) return null;
    if (a.situacao === 'descartada') return 'descartada';
    var ativos = Object.keys(a.recortes).filter(function (k) { return a.recortes[k].situacao === 'ativo'; });
    if (proximasPerguntas(a).length || !ativos.length) return 'em-descoberta';
    var pos = (info && info.posicionamentos) || {};
    var naoAvaliado = ativos.some(function (k) { var o = a.recortes[k].objetoId; return !o || !pos[o]; });
    if (naoAvaliado) return 'em-avaliacao';
    var vig = propostaVigente(estado, analiseId);
    if (!vig) return ativos.some(function (k) { return !pos[a.recortes[k].objetoId].codigoEfetivo; }) ? 'com-pendencia' : 'classificada';
    if (vig.situacao === 'pendente') return 'com-pendencia';
    return estado.aprovacoes && estado.aprovacoes[vig.id] ? 'aprovada' : 'proposta';
  }
  /* N4: o que a estrutura exerce segundo as análises — com fonte, caráter e data; separado do vínculo formal */
  function exercidasPelaEstrutura(estado, estruturaId) {
    var l = [], as = (estado && estado.analises) || {};
    Object.keys(as).sort().forEach(function (id) {
      var a = as[id]; if (a.situacao === 'descartada') return;
      Object.keys(a.recortes).sort().forEach(function (k) {
        var r = a.recortes[k]; if (r.situacao !== 'ativo' || !r.fatos) return;
        r.fatos.execucao.forEach(function (f) {
          if (f.estruturaId === estruturaId) l.push({ analiseId: id, analiseNome: a.nome, recorteId: k, responsabilidade: r.nome, objetoId: r.objetoId, carater: f.carater, fonte: f.fonte, informadoEm: f.informadoEm });
        });
      });
    });
    return l;
  }
  /* D6: o objeto amplo delimitado é agrupador e sai das contagens de pendência; nada é contado duas vezes */
  function objetoAmploDelimitado(estado, objetoId) {
    var as = (estado && estado.analises) || {};
    for (var id in as) {
      if (!Object.prototype.hasOwnProperty.call(as, id)) continue;
      var a = as[id];
      if (a.situacao === 'descartada' || a.objetoAmploId !== objetoId) continue;
      var n = Object.keys(a.recortes).filter(function (k) { return a.recortes[k].situacao === 'ativo'; }).length;
      if (n) return { delimitado: true, analiseId: id, responsabilidades: n };
    }
    return { delimitado: false };
  }
  function contagens(estado) {
    var as = (estado && estado.analises) || {}, resp = {}, agrupadores = 0;
    Object.keys(as).forEach(function (id) {
      var a = as[id]; if (a.situacao === 'descartada') return;
      var ativos = Object.keys(a.recortes).filter(function (k) { return a.recortes[k].situacao === 'ativo'; });
      if (a.objetoAmploId && ativos.length) agrupadores++;
      ativos.forEach(function (k) { resp[a.recortes[k].objetoId || (id + '/' + k)] = true; });
      Object.keys(a.referencias).forEach(function (o) { resp[o] = true; }); /* referência não conta de novo */
    });
    return { responsabilidades: Object.keys(resp).length, agrupadores: agrupadores };
  }
  function historico(eventos, analiseId) {
    return (eventos || []).filter(function (e) { return !analiseId || e.analiseId === analiseId; })
      .slice().sort(function (x, y) { return instante(x.em) - instante(y.em); });
  }
  var COLECAO_DA = { analise: 'analises', proposta: 'propostas', aprovacao: 'aprovacoes' };
  function aplicar(estado, mudancas) {
    var novo = clone(estado || {}) || {};
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
    TIPOS_ESCOPO: TIPOS_ESCOPO.slice(), FORMAS: FORMAS.slice(), DESTINATARIOS: DESTINATARIOS.slice(), RESPONDE: RESPONDE.slice(),
    CERTEZA_RESPONSAVEL: CERTEZA_RESPONSAVEL.slice(), CARATER: CARATER.slice(), CRITERIOS_IDENTIDADE: CRITERIOS_IDENTIDADE.slice(),
    CRITERIOS_NUCLEARES: CRITERIOS_NUCLEARES.slice(), CONCLUSOES: CONCLUSOES.slice(), ALTERNATIVAS: ALTERNATIVAS.slice(),
    ALTERNATIVAS_RECUSADAS: ALTERNATIVAS_RECUSADAS.slice(), SITUACAO_FORMAL: SITUACAO_FORMAL.slice(), CATEGORIAS: CATEGORIAS.slice(),
    MAX: clone(MAX), MATRIZ: clone(MATRIZ), HABILITACAO: HABILITACAO.slice(), acessoPelaHabilitacao: acessoPelaHabilitacao,
    registrarEvidenciaQualitativa: registrarEvidenciaQualitativa,
    criarAnalise: criarAnalise, responder: responder, adicionarEntrega: adicionarEntrega, editarEntrega: editarEntrega, descartarEntrega: descartarEntrega,
    compararEntregas: compararEntregas, cadastroReferido: cadastroReferido,
    definirRecorte: definirRecorte, revisarResponsabilidade: revisarResponsabilidade, desdobrarResponsabilidade: desdobrarResponsabilidade, registrarResponsabilidadesEmLote: registrarResponsabilidadesEmLote, informarNucleosAtuais: informarNucleosAtuais, modeloSimples: modeloSimples, SEPARACAO: SEPARACAO.slice(), ajustarRecorte: ajustarRecorte, descartarRecorte: descartarRecorte, registrarFatos: registrarFatos,
    associarAtuacao: associarAtuacao, referenciarResponsabilidade: referenciarResponsabilidade, descartarAnalise: descartarAnalise,
    registrarProposta: registrarProposta, registrarAprovacao: registrarAprovacao,
    interpretarComparacao: interpretarComparacao, sugestoesDeComparacao: sugestoesDeComparacao, proximasPerguntas: proximasPerguntas,
    lacunas: lacunas, prontaParaO1O9: prontaParaO1O9, situacaoFormal: situacaoFormal, alternativasPara: alternativasPara,
    categoriaDoCaso: categoriaDoCaso, situacaoDaAnalise: situacaoDaAnalise, exercidasPelaEstrutura: exercidasPelaEstrutura,
    objetoAmploDelimitado: objetoAmploDelimitado, contagens: contagens, origemDoObjeto: origemDoObjeto,
    propostaVigente: propostaVigente, historico: historico, aplicar: aplicar, instante: instante
  };
  congelar(api);
  if (typeof window !== 'undefined') window.faAnalisesOrganizacionaisNucleo = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
