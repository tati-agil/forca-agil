/* ============================================================
   Força Ágil — Núcleo de Avaliação, Taxonomia e Mapa da Floresta
   ESTRUTURAS ORGANIZACIONAIS CONCRETAS — CASOS DE USO COMPARTILHADOS
   (window.faEstruturasCasosDeUso; em Node, module.exports)

   A orquestração ÚNICA do cadastro, usada pelo site (adaptador Firebase) e pelo backend (adaptador PostgreSQL):
     1. lê as referências oficiais (só para criar: tipo admitido e conceito ativo);
     2. lê o estado necessário;
     3. chama o NÚCLEO (estruturas-nucleo.js) — as regras de negócio são todas dele; aqui não há nenhuma;
     4. grava as mudanças e os eventos JUNTOS pela porta de persistência.
   Puro como o núcleo: sem Firebase, SQL, NestJS, DOM, relógio ou gerador de identificadores. Identificadores,
   autoria e horário chegam no ctx, fornecidos por quem executa (no Firebase, o adaptador grava o horário do
   SERVIDOR nos CAMPOS_DE_HORARIO; no backend, o servidor fornece o seu).

   CONTRATO DE PERSISTÊNCIA (as portas; cada uma devolve uma Promise):
     lerReferencias()          → { conceitos, relacoesConceituais, herancaPeloPai, ligacoes, conceitosTrabalho }
                                 lidas na MESMA fronteira de consistência da gravação; se o adaptador não conseguir
                                 garantir isso, recusa (codigo REFERENCIAS_FORA_DA_TRANSACAO) — nunca presume.
     lerEstado()               → { estruturas, relacoes, vinculos, subagrupadores, associacoesSubagrupador } (o recorte
                                 que a operação precisa)
     gravar(operacao)          → { situacao: 'gravada' }; operacao = { id: ctx.operacaoId, tipo, usuario, mudancas,
                                 eventos }. TUDO OU NADA; revisão de cada mudança conferida (CONFLITO_DE_REVISAO);
                                 eventos só por acréscimo; nada se apaga. Repetir a MESMA operação (mesmo id) não
                                 duplica nada: devolve { situacao: 'repetida' }.
                                 Falha: rejeita com { codigo } — 'CONFLITO_DE_REVISAO', 'RECUSADA' (o banco recusou)
                                 ou 'SEM_RESPOSTA' (o prazo acabou: NÃO quer dizer nem gravou nem falhou).
     conferirOperacao(id)      → { aplicada: true|false } — usado antes de decidir (operação repetida) e depois de
                                 SEM_RESPOSTA, antes de dizer qualquer coisa.
     lerEventos()              → [ evento … ] na ordem gravada — o histórico (a tela ordena com historico() do núcleo).

   RESULTADO de executar(): { ok: true, situacao: 'gravada'|'repetida', mudancas, eventos } ou { ok: false, erros }.
   Os códigos de erro são os do núcleo, mais os da persistência acima e GRAVACAO_NAO_CONFIRMADA.

   ESCOPO: os 8 tipos firmes do Posicionamento (seis do ramo Linha, Área Especializada e CoE) e, desde a Etapa 5, os
   subagrupadores das Linhas de Negócios e a associação Linha × subagrupador. Squad, Capítulo, relações e vínculos
   ficam fora (o núcleo já os conhece; os casos de uso não os expõem ainda).
   ============================================================ */
(function () {
  'use strict';

  var OPERACOES = ['criarEstrutura', 'alterarEstrutura', 'encerrarEstrutura',
    /* Etapa 5: subagrupadores das Linhas de Negócios (apresentação do Mapa) e a associação Linha × subagrupador */
    'criarSubagrupador', 'alterarSubagrupador', 'encerrarSubagrupador', 'associarLinha', 'substituirAssociacao', 'desassociarLinha'];
  /* onde o horário do contrato aparece (em milissegundos UTC): o adaptador Firebase grava o horário do SERVIDOR
     exatamente nesses campos — da estrutura e das cópias antes/depois guardadas no evento */
  var CAMPOS_DE_HORARIO = Object.freeze({
    estrutura: Object.freeze(['criadaEm', 'alteradaEm', 'encerramento.em']),
    evento: Object.freeze(['em', 'antes.criadaEm', 'antes.alteradaEm', 'antes.encerramento.em', 'depois.criadaEm', 'depois.alteradaEm', 'depois.encerramento.em'])
  });

  function falha(erros) { return { ok: false, erros: erros }; }
  function erro(codigo, extra) { var e = { codigo: codigo }; if (extra) Object.keys(extra).forEach(function (k) { e[k] = extra[k]; }); return e; }
  function codigoDe(e) { return (e && e.codigo) || 'RECUSADA'; }

  /* deps: { nucleo: estruturas-nucleo.js, codigosFirmes: os códigos firmes do motor de Posicionamento } */
  function criar(deps) {
    var N = deps && deps.nucleo, firmes = (deps && deps.codigosFirmes) || [];
    if (!N || !firmes.length) throw new Error('casos de uso: falta o núcleo ou os códigos firmes');

    /* 1º cadastro: só os 8 tipos firmes — Squad e Capítulo não são admitidos nesta entrega */
    function referenciasDoCadastro(ref) {
      return { conceitos: (ref && ref.conceitos) || {}, relacoesConceituais: (ref && ref.relacoesConceituais) || [], herancaPeloPai: !!(ref && ref.herancaPeloPai),
        ligacoes: (ref && ref.ligacoes) || {}, codigosFirmes: firmes.slice(), conceitosTrabalho: [] };
    }

    function decidir(operacao, entrada, estado, ref, ctx) {
      var d = entrada || {};
      if (operacao === 'criarEstrutura') return N.criarEstrutura(estado, { tipo: d.tipo, nome: d.nome, sigla: d.sigla, descricao: d.descricao }, ctx, ref);
      if (operacao === 'alterarEstrutura') return N.alterarEstrutura(estado, d.id, d.alteracoes, ctx, { justificativa: d.justificativa, revisaoEsperada: d.revisaoEsperada });
      if (operacao === 'encerrarEstrutura') return N.encerrarEstrutura(estado, d.id, d.motivo, ctx, { revisaoEsperada: d.revisaoEsperada });
      if (operacao === 'criarSubagrupador') return N.criarSubagrupador(estado, { nome: d.nome, ordem: d.ordem }, ctx);
      if (operacao === 'alterarSubagrupador') return N.alterarSubagrupador(estado, d.id, d.alteracoes, ctx, { justificativa: d.justificativa, revisaoEsperada: d.revisaoEsperada });
      if (operacao === 'encerrarSubagrupador') return N.encerrarSubagrupador(estado, d.id, d.motivo, ctx, { revisaoEsperada: d.revisaoEsperada });
      if (operacao === 'associarLinha') return N.associarLinha(estado, { estruturaId: d.estruturaId, subagrupadorId: d.subagrupadorId }, ctx, { justificativa: d.justificativa });
      if (operacao === 'substituirAssociacao') return N.substituirAssociacao(estado, d.associacaoId, d.subagrupadorId, ctx, { justificativa: d.justificativa });
      return N.desassociarLinha(estado, d.associacaoId, ctx, { justificativa: d.justificativa });
    }

    /* executa uma operação de ponta a ponta; portas = o adaptador de persistência (Firebase, PostgreSQL ou memória) */
    function executar(operacao, entrada, ctx, portas) {
      if (OPERACOES.indexOf(operacao) === -1) return Promise.resolve(falha([erro('OPERACAO_DESCONHECIDA', { operacao: operacao })]));
      /* a MESMA operação repetida (mesmo operacaoId — ex.: um reenvio depois de "sem resposta") é reconhecida antes de
         decidir de novo: nada é recalculado nem duplicado */
      var jaFeita = ctx && ctx.operacaoId ? portas.conferirOperacao(ctx.operacaoId) : Promise.resolve({ aplicada: false });
      return jaFeita.then(function (v) {
        if (v && v.aplicada) return { ok: true, situacao: 'repetida', mudancas: [], eventos: [] };
        return decidirEGravar(operacao, entrada, ctx, portas);
      }, function (e) { return falha([erro(codigoDe(e) === 'RECUSADA' ? 'LEITURA_INDISPONIVEL' : codigoDe(e))]); });
    }
    function decidirEGravar(operacao, entrada, ctx, portas) {
      var refP = operacao === 'criarEstrutura' ? portas.lerReferencias() : Promise.resolve(null);
      return Promise.all([refP, portas.lerEstado()]).then(function (lidos) {
        var ref = lidos[0] ? referenciasDoCadastro(lidos[0]) : referenciasDoCadastro(null);
        var r = decidir(operacao, entrada, lidos[1] || {}, ref, ctx);
        if (!r.ok) return falha(r.erros);
        var op = { id: ctx.operacaoId, tipo: operacao, usuario: ctx.usuario, mudancas: r.mudancas, eventos: r.eventos };
        return portas.gravar(op).then(function (g) {
          return { ok: true, situacao: (g && g.situacao) || 'gravada', mudancas: r.mudancas, eventos: r.eventos };
        }, function (e) {
          var c = codigoDe(e);
          if (c !== 'SEM_RESPOSTA') return falha([erro(c)]);
          /* prazo acabou: confere no banco antes de dizer qualquer coisa */
          return portas.conferirOperacao(ctx.operacaoId).then(function (v) {
            return v && v.aplicada ? { ok: true, situacao: 'gravada', mudancas: r.mudancas, eventos: r.eventos } : falha([erro('GRAVACAO_NAO_CONFIRMADA')]);
          }, function () { return falha([erro('GRAVACAO_NAO_CONFIRMADA')]); });
        });
      }, function (e) { return falha([erro(codigoDe(e) === 'RECUSADA' ? 'LEITURA_INDISPONIVEL' : codigoDe(e))]); });
    }

    return Object.freeze({ executar: executar, OPERACOES: OPERACOES.slice(), CAMPOS_DE_HORARIO: CAMPOS_DE_HORARIO });
  }

  /* ---------- REFERÊNCIA EM MEMÓRIA do contrato de persistência ----------
     É o que os adaptadores Firebase e PostgreSQL precisam reproduzir (e o executor de referência dos cenários
     usa): tudo ou nada pelo aplicar() do núcleo, revisão conferida, eventos só por acréscimo, operação repetida
     sem duplicar. inicial = { estado, referencias }. */
  function persistenciaEmMemoria(N, inicial) {
    var clone = function (v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); };
    var estado = clone((inicial && inicial.estado) || { estruturas: {}, relacoes: {}, vinculos: {} });
    var referencias = clone((inicial && inicial.referencias) || {});
    var eventos = [], operacoes = {};
    return {
      lerReferencias: function () { return Promise.resolve(clone(referencias)); },
      lerEstado: function () { return Promise.resolve(clone(estado)); },
      gravar: function (op) {
        if (operacoes[op.id]) return Promise.resolve({ situacao: 'repetida' });
        var r = N.aplicar(estado, op.mudancas);
        if (!r.ok) return Promise.reject({ codigo: r.erro === 'CONFLITO_DE_REVISAO' ? 'CONFLITO_DE_REVISAO' : 'RECUSADA' });
        /* unicidade garantida pela persistência sob concorrência (como o índice do banco): quem chegou depois perde */
        if (N.violacoesDeUnicidade && N.violacoesDeUnicidade(r.estado).length) return Promise.reject({ codigo: 'CONFLITO_DE_REVISAO' });
        estado = r.estado; operacoes[op.id] = { tipo: op.tipo, usuario: clone(op.usuario) };
        eventos = eventos.concat(clone(op.eventos));
        return Promise.resolve({ situacao: 'gravada' });
      },
      conferirOperacao: function (id) { return Promise.resolve({ aplicada: !!operacoes[id] }); },
      lerEventos: function () { return Promise.resolve(clone(eventos)); },
      /* só para inspeção nos testes */
      instantaneo: function () { return { estado: clone(estado), eventos: clone(eventos), operacoes: clone(operacoes) }; }
    };
  }

  var api = Object.freeze({ criar: criar, persistenciaEmMemoria: persistenciaEmMemoria, OPERACOES: OPERACOES.slice(), CAMPOS_DE_HORARIO: CAMPOS_DE_HORARIO });
  if (typeof window !== 'undefined') window.faEstruturasCasosDeUso = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
