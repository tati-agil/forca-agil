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
     lerPosicionamento(objeto) → { avaliacaoId, recomendacao: { codigoResultado }, decisao?: { codigoFinal } } ou null —
                                 o Posicionamento VIGENTE do item (M3: só para vincular e substituir o responsável).

   RESULTADO de executar(): { ok: true, situacao: 'gravada'|'repetida', mudancas, eventos } ou { ok: false, erros }.
   Os códigos de erro são os do núcleo, mais os da persistência acima e GRAVACAO_NAO_CONFIRMADA.

   ESCOPO: os 8 tipos firmes do Posicionamento (seis do ramo Linha, Área Especializada e CoE) e, desde a Etapa 5, os
   subagrupadores das Linhas de Negócios e a associação Linha × subagrupador; desde a M3 do Mapa, o vínculo do item com
   a estrutura responsável principal (V1–V8 do núcleo); desde a M6/M7, as relações entre estruturas (R1–R7 e C3) e o
   Squad como tipo de estrutura (conceito da camada "Organização do trabalho" que a Taxonomia admite compor uma Linha).
   Capítulo fica fora. RECORTE DO SITE (C2, paridade Firebase × PostgreSQL): "compõe" só é entregue ao núcleo como
   admitido quando vai de um conceito de trabalho (Squad) para um código de Linha — todo "compõe" geral continua
   bloqueado no site (as regras do banco garantem o mesmo).
   ============================================================ */
(function () {
  'use strict';

  var OPERACOES = ['criarEstrutura', 'alterarEstrutura', 'encerrarEstrutura',
    /* Etapa 5: subagrupadores das Linhas de Negócios (apresentação do Mapa) e a associação Linha × subagrupador */
    'criarSubagrupador', 'alterarSubagrupador', 'encerrarSubagrupador', 'associarLinha', 'substituirAssociacao', 'desassociarLinha',
    /* M3 do Mapa: vínculo item × estrutura responsável principal; E3: estruturas colaboradoras (mesmo registro, outro papel) */
    'vincularResponsavel', 'substituirResponsavel', 'encerrarVinculo', 'vincularColaboradora',
    /* M6/M7 do Mapa: relações entre estruturas */
    'criarRelacao', 'alterarRelacao', 'encerrarRelacao'];
  /* operações que precisam das referências oficiais (ligações) e, as de vínculo, do Posicionamento vigente do item */
  var COM_REFERENCIAS = { criarEstrutura: 1, vincularResponsavel: 1, substituirResponsavel: 1, vincularColaboradora: 1, criarRelacao: 1, alterarRelacao: 1 };
  var COM_POSICIONAMENTO = { vincularResponsavel: 1, substituirResponsavel: 1, vincularColaboradora: 1 };
  /* onde o horário do contrato aparece (em milissegundos UTC): o adaptador Firebase grava o horário do SERVIDOR
     exatamente nesses campos — da estrutura e das cópias antes/depois guardadas no evento */
  var CAMPOS_DE_HORARIO = Object.freeze({
    estrutura: Object.freeze(['criadaEm', 'alteradaEm', 'encerramento.em']),
    evento: Object.freeze(['em', 'antes.criadaEm', 'antes.alteradaEm', 'antes.encerramento.em', 'depois.criadaEm', 'depois.alteradaEm', 'depois.encerramento.em'])
  });

  function falha(erros) { return { ok: false, erros: erros }; }
  function erro(codigo, extra) { var e = { codigo: codigo }; if (extra) Object.keys(extra).forEach(function (k) { e[k] = extra[k]; }); return e; }
  function codigoDe(e) { return (e && e.codigo) || 'RECUSADA'; }

  /* deps: { nucleo: estruturas-nucleo.js, codigosFirmes: os códigos firmes do motor de Posicionamento,
            codigosLinha: os códigos firmes do ramo Linha (motor; sem eles, nenhum "compõe" é admitido no site) } */
  function criar(deps) {
    var N = deps && deps.nucleo, firmes = (deps && deps.codigosFirmes) || [], linha = (deps && deps.codigosLinha) || [];
    if (!N || !firmes.length) throw new Error('casos de uso: falta o núcleo ou os códigos firmes');

    /* os 8 tipos firmes e o Squad (conceitosTrabalho informados pela persistência); relações conceituais com o recorte
       do site (C2): "compõe" só de conceito de trabalho para código de Linha */
    function referenciasDoCadastro(ref) {
      var trabalho = (ref && ref.conceitosTrabalho) || [];
      var rel = ((ref && ref.relacoesConceituais) || []).filter(function (r) { return r && (r.tipo !== 'compoe' || (trabalho.indexOf(r.de) !== -1 && linha.indexOf(r.para) !== -1)); });
      return { conceitos: (ref && ref.conceitos) || {}, relacoesConceituais: rel, herancaPeloPai: !!(ref && ref.herancaPeloPai),
        ligacoes: (ref && ref.ligacoes) || {}, codigosFirmes: firmes.slice(), conceitosTrabalho: trabalho.slice() };
    }

    function decidir(operacao, entrada, estado, ref, ctx, posicionamento) {
      var d = entrada || {};
      /* E2: divergencia = { motivo, justificativa, autoridade?, referencia? } quando o tipo da estrutura difere do posicionamento efetivo */
      if (operacao === 'vincularResponsavel') return N.vincularResponsavel(estado, { objetoId: d.objetoId, estruturaId: d.estruturaId, justificativa: d.justificativa, divergencia: d.divergencia }, posicionamento, ctx, ref);
      if (operacao === 'substituirResponsavel') return N.substituirResponsavel(estado, d.vinculoId, { estruturaId: d.estruturaId, justificativa: d.justificativa, divergencia: d.divergencia }, d.motivo, posicionamento, ctx, ref);
      if (operacao === 'vincularColaboradora') return N.vincularColaboradora(estado, { objetoId: d.objetoId, estruturaId: d.estruturaId, justificativa: d.justificativa, divergencia: d.divergencia }, posicionamento, ctx, ref);
      if (operacao === 'encerrarVinculo') return N.encerrarVinculo(estado, d.vinculoId, d.motivo, ctx);
      if (operacao === 'criarRelacao') return N.criarRelacao(estado, { origem: d.origem, tipo: d.tipo, destino: d.destino, justificativa: d.justificativa }, ctx, ref);
      if (operacao === 'alterarRelacao') return N.alterarRelacao(estado, d.relacaoId, d.novos, d.motivo, ctx, ref);
      if (operacao === 'encerrarRelacao') return N.encerrarRelacao(estado, d.relacaoId, d.motivo, ctx);
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
      var refP = COM_REFERENCIAS[operacao] ? portas.lerReferencias() : Promise.resolve(null);
      return Promise.all([refP, portas.lerEstado()]).then(function (lidos) {
        var ref = lidos[0] ? referenciasDoCadastro(lidos[0]) : referenciasDoCadastro(null);
        if (!COM_POSICIONAMENTO[operacao]) return [ref, lidos[1], null];
        /* o item da substituição é o do vínculo atual (o núcleo recusa vínculo inexistente) */
        var v = operacao === 'substituirResponsavel' ? ((lidos[1] && lidos[1].vinculos) || {})[(entrada || {}).vinculoId] : null;
        var objeto = operacao === 'substituirResponsavel' ? v && v.objetoId : (entrada || {}).objetoId;
        if (!objeto || !portas.lerPosicionamento) return [ref, lidos[1], null];
        return portas.lerPosicionamento(objeto).then(function (p) { return [ref, lidos[1], p]; });
      }).then(function (lidos) {
        var ref = lidos[0];
        var r = decidir(operacao, entrada, lidos[1] || {}, ref, ctx, lidos[2]);
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

    /* referencias: as mesmas referências que o núcleo recebe (com o recorte do site, C2) — para a tela oferecer só o que o núcleo aceita */
    return Object.freeze({ executar: executar, referencias: referenciasDoCadastro, OPERACOES: OPERACOES.slice(), CAMPOS_DE_HORARIO: CAMPOS_DE_HORARIO });
  }

  /* ---------- REFERÊNCIA EM MEMÓRIA do contrato de persistência ----------
     É o que os adaptadores Firebase e PostgreSQL precisam reproduzir (e o executor de referência dos cenários
     usa): tudo ou nada pelo aplicar() do núcleo, revisão conferida, eventos só por acréscimo, operação repetida
     sem duplicar. inicial = { estado, referencias }. */
  function persistenciaEmMemoria(N, inicial) {
    var clone = function (v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); };
    var estado = clone((inicial && inicial.estado) || { estruturas: {}, relacoes: {}, vinculos: {} });
    var referencias = clone((inicial && inicial.referencias) || {});
    var posicionamentos = clone((inicial && inicial.posicionamentos) || {}); /* M3: o Posicionamento vigente de cada item */
    /* C3 sob concorrência precisa saber quem é Squad e quem é Linha: as mesmas referências */
    var refUnicidade = Object.assign({ codigosFirmes: Object.keys(referencias.ligacoes || {}) }, referencias);
    var eventos = [], operacoes = {};
    return {
      lerReferencias: function () { return Promise.resolve(clone(referencias)); },
      lerEstado: function () { return Promise.resolve(clone(estado)); },
      gravar: function (op) {
        if (operacoes[op.id]) return Promise.resolve({ situacao: 'repetida' });
        var r = N.aplicar(estado, op.mudancas);
        if (!r.ok) return Promise.reject({ codigo: r.erro === 'CONFLITO_DE_REVISAO' ? 'CONFLITO_DE_REVISAO' : 'RECUSADA' });
        /* unicidade garantida pela persistência sob concorrência (como o índice do banco): quem chegou depois perde */
        if (N.violacoesDeUnicidade && N.violacoesDeUnicidade(r.estado, refUnicidade).length) return Promise.reject({ codigo: 'CONFLITO_DE_REVISAO' });
        estado = r.estado; operacoes[op.id] = { tipo: op.tipo, usuario: clone(op.usuario) };
        eventos = eventos.concat(clone(op.eventos));
        return Promise.resolve({ situacao: 'gravada' });
      },
      conferirOperacao: function (id) { return Promise.resolve({ aplicada: !!operacoes[id] }); },
      lerEventos: function () { return Promise.resolve(clone(eventos)); },
      lerPosicionamento: function (objetoId) { return Promise.resolve(clone(posicionamentos[objetoId] || null)); },
      /* só para inspeção nos testes */
      instantaneo: function () { return { estado: clone(estado), eventos: clone(eventos), operacoes: clone(operacoes) }; }
    };
  }

  var api = Object.freeze({ criar: criar, persistenciaEmMemoria: persistenciaEmMemoria, OPERACOES: OPERACOES.slice(), CAMPOS_DE_HORARIO: CAMPOS_DE_HORARIO });
  if (typeof window !== 'undefined') window.faEstruturasCasosDeUso = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
