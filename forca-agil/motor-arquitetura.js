/* ============================================================
   Força Ágil — Motor de Classificação Arquitetural (P1-P16)
   window.faMotorArquitetura

   Mesmo padrão técnico do motor de squad (window.faMotorSquad, ver
   motor-squad.js, PR #240): respostas → conjunto de regras publicado →
   executor genérico e seguro → resultado. O código EXECUTA regras; a
   regra de negócio de cada classificação vive em CONFIGURAÇÃO (Firebase),
   nunca hardcoded em identificarCamada (que passa a ser um wrapper fino em
   avaliacao-produto.js, só compondo motivos/conflito/especialização/papel
   estrutural em cima do que este motor decide).

   MIGRAÇÃO SEM MUDANÇA DE RESULTADO — PADRAO_REGRAS abaixo é uma tradução
   LITERAL, condição por condição, do identificarCamada que existia em
   avaliacao-produto.js antes desta PR (main, PR #238/#239/#240): mesma
   precedência (0 a 12, primeira regra cujas condições batem decide),
   mesmas 16 perguntas por codigoEstavel (P1-P16, nunca por texto), mesmo
   fallback (A validar). Esta PR não redesenha a regra conceitual — ver os
   testes de equivalência (check-motor-arquitetura-equivalencia.js) que
   comparam o motor antigo (congelado ali como referência) contra este
   motor sobre as 65536 combinações possíveis das 16 respostas SIM/NÃO,
   exaustivamente, antes de identificarCamada passar a depender dele.

   NÃO EXISTEM PESOS — preservado do motor original: só condições lógicas
   (all/any/not/equals) com PRECEDÊNCIA explícita (ordem), nunca pontos,
   score, percentuais, votação ou contagem de SIM para escolher camada.

   P6 (jornada), P7 (medição) e P8 (gestão) são critérios complementares/
   informativos e NÃO entram em nenhuma condição das regras abaixo — mesmo
   comportamento do identificarCamada original. Uma versão futura poderia
   passar a usá-los, mas isso seria uma mudança de REGRA (nova
   motorVersionArquitetura), nunca uma alteração textual.

   IDENTIDADE x APRESENTAÇÃO — o código de cada camada (ex.:
   'produto-principal') é imutável, definido junto com a regra; o RÓTULO
   exibido (PADRAO_TEXTOS) é parametrizável e resolvido ao vivo, nunca um
   snapshot por resposta — mesmo princípio de motor-squad.js. A prosa mais
   elaborada (motivoJustificativa, relacaoArquitetural, interpretacaoSistema
   em avaliacao-produto.js) permanece hardcoded nesta PR: o pedido desta
   migração é sobre a LÓGICA de decisão (condições e precedência), não
   sobre reescrever cada frase gerada a partir da camada já identificada —
   e Part J proíbe explicitamente tocar em especializacaoPara/
   papelEstruturalPara, que dependem só de cadastro, nunca deste motor.

   Node no Firebase: motor-arquitetura-config = {
     versaoPublicada: número da versão vigente das REGRAS — é isto que
       avaliacao-produto.js grava como motorVersionArquitetura (eixo
       TOTALMENTE independente de motorVersion legado — ver nota em
       avaliacao-produto.js — e de questionnaireContentVersion),
     versoes: { "<n>": { regras: [...], publicadoEm, publicadoPor } },
     rascunho: { regras: [...], atualizadoEm, atualizadoPor } | null,
     textos: { <camadaId>: { rotulo } } — só o RÓTULO de cada camada é
       parametrizável por aqui (a lista de 11 camadas em si — identidade —
       continua fixa em código, CAMADAS em avaliacao-produto.js); publicado
       imediatamente, nunca versiona motorVersionArquitetura.
   }
   motor-arquitetura-auditoria/<pushKey> = mesmo formato de
   motor-squad-auditoria (tipo 'regra'|'texto', campo, valores, usuário,
   data, versão anterior/nova).

   GOVERNANÇA idêntica a motor-squad.js: RASCUNHO → SIMULAÇÃO → PUBLICAÇÃO,
   rollback (publicarVersaoAnterior), auditoria, validarRegras (bloqueia
   publicação com regra sem resultado, pergunta inexistente, operador
   inválido, precedência duplicada/ambígua, ou sem fallback — este último
   verificado EXAUSTIVAMENTE, testando a configuração candidata contra as
   65536 combinações possíveis das 16 respostas, nunca por amostragem). */
(function () {
  var NODE_CONFIG = 'motor-arquitetura-config';
  var NODE_AUDITORIA = 'motor-arquitetura-auditoria';
  var CAMPOS_VALIDOS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'P11', 'P12', 'P13', 'P14', 'P15', 'P16'];
  var CAMADAS_VALIDAS = [
    'produto-principal', 'unidade-valor-associada', 'modalidade-subproduto', 'funcionalidade-operacao',
    'componente', 'regra-condicao', 'processo-etapa', 'capacidade-organizacional', 'canal',
    'documento-informacao', 'a-validar'
  ];

  function db() { return firebase.database(); }

  /* ===================== REGRAS DE FÁBRICA (tradução literal do identificarCamada
     original — ver cabeçalho) ===================== */
  var PADRAO_REGRAS = {
    regras: [
      { codigo: 'INCOERENCIA', ordem: 0, resultado: 'a-validar', incoerencia: true, conflito: null,
        motivos: ['P16', 'P5'],
        condicoes: { all: [{ campo: 'P16', valor: 'SIM' }, { campo: 'P5', valor: 'SIM' }] } },
      { codigo: 'PRODUTO_SERVICO_PRINCIPAL', ordem: 1, resultado: 'produto-principal', incoerencia: false, conflito: null,
        motivos: ['P1', 'P2', 'P3', 'P4', 'P5'],
        condicoes: { all: [
          { campo: 'P1', valor: 'SIM' }, { campo: 'P2', valor: 'SIM' }, { campo: 'P3', valor: 'SIM' },
          { campo: 'P4', valor: 'SIM' }, { campo: 'P5', valor: 'SIM' },
          { not: { any: [
            { campo: 'P9', valor: 'SIM' }, { campo: 'P10', valor: 'SIM' }, { campo: 'P11', valor: 'SIM' }, { campo: 'P12', valor: 'SIM' },
            { campo: 'P13', valor: 'SIM' }, { campo: 'P14', valor: 'SIM' }, { campo: 'P15', valor: 'SIM' }, { campo: 'P16', valor: 'SIM' }
          ] } }
        ] } },
      { codigo: 'FUNCIONALIDADE_OPERACAO', ordem: 2, resultado: 'funcionalidade-operacao', incoerencia: false, conflito: null,
        motivos: ['P16', 'P5'],
        condicoes: { all: [{ campo: 'P16', valor: 'SIM' }, { campo: 'P5', valor: 'NAO' }] } },
      { codigo: 'CANAL', ordem: 3, resultado: 'canal', incoerencia: false, conflito: null,
        motivos: ['P9'], condicoes: { all: [{ campo: 'P9', valor: 'SIM' }] } },
      { codigo: 'DOCUMENTO_INFORMACAO', ordem: 4, resultado: 'documento-informacao', incoerencia: false, conflito: null,
        motivos: ['P10'], condicoes: { all: [{ campo: 'P10', valor: 'SIM' }] } },
      { codigo: 'UNIDADE_VALOR_ASSOCIADA', ordem: 5, resultado: 'unidade-valor-associada', incoerencia: false, conflito: null,
        motivos: ['P2', 'P4', 'P1', 'P5'],
        condicoes: { all: [
          { campo: 'P2', valor: 'SIM' }, { campo: 'P4', valor: 'SIM' }, { campo: 'P1', valor: 'SIM' },
          { campo: 'P5', valor: 'NAO' }, { campo: 'P16', valor: 'NAO' }
        ] } },
      { codigo: 'CONFLITO_PROCESSO_CAPACIDADE', ordem: 6, resultado: 'a-validar', incoerencia: false,
        conflito: ['processo-etapa', 'capacidade-organizacional'],
        motivos: ['P12', 'P11'],
        condicoes: { all: [
          { campo: 'P12', valor: 'SIM' }, { campo: 'P11', valor: 'SIM' }, { campo: 'P15', valor: 'NAO' },
          { campo: 'P2', valor: 'NAO' }, { campo: 'P16', valor: 'NAO' }
        ] } },
      { codigo: 'CAPACIDADE_ORGANIZACIONAL', ordem: 7, resultado: 'capacidade-organizacional', incoerencia: false, conflito: null,
        motivos: ['P11', 'P1', 'P15'],
        condicoes: { all: [{ campo: 'P11', valor: 'SIM' }, { campo: 'P1', valor: 'NAO' }, { campo: 'P15', valor: 'NAO' }] } },
      { codigo: 'COMPONENTE', ordem: 8, resultado: 'componente', incoerencia: false, conflito: null,
        motivos: ['P15', 'P13', 'P2'],
        condicoes: { all: [
          { any: [{ campo: 'P15', valor: 'SIM' }, { campo: 'P13', valor: 'SIM' }] },
          { campo: 'P5', valor: 'NAO' }, { campo: 'P16', valor: 'NAO' }, { campo: 'P2', valor: 'NAO' },
          { campo: 'P12', valor: 'NAO' }, { campo: 'P14', valor: 'NAO' }
        ] } },
      { codigo: 'MODALIDADE_SUBPRODUTO', ordem: 9, resultado: 'modalidade-subproduto', incoerencia: false, conflito: null,
        motivos: ['P13', 'P2', 'P16', 'P5'],
        condicoes: { all: [
          { campo: 'P13', valor: 'SIM' }, { campo: 'P2', valor: 'SIM' }, { campo: 'P16', valor: 'NAO' },
          { campo: 'P5', valor: 'NAO' }, { campo: 'P15', valor: 'NAO' }
        ] } },
      { codigo: 'REGRA_CONDICAO', ordem: 10, resultado: 'regra-condicao', incoerencia: false, conflito: null,
        motivos: ['P14', 'P16', 'P5'],
        condicoes: { all: [{ campo: 'P14', valor: 'SIM' }, { campo: 'P16', valor: 'NAO' }, { campo: 'P5', valor: 'NAO' }, { campo: 'P2', valor: 'NAO' }] } },
      { codigo: 'PROCESSO_ETAPA', ordem: 11, resultado: 'processo-etapa', incoerencia: false, conflito: null,
        motivos: ['P12', 'P16', 'P5'],
        condicoes: { all: [{ campo: 'P12', valor: 'SIM' }, { campo: 'P16', valor: 'NAO' }, { campo: 'P5', valor: 'NAO' }, { campo: 'P2', valor: 'NAO' }] } },
      /* Fallback EXPLÍCITO (tipo: 'FALLBACK'), sem condicoes: o executor
         aplica esta regra só quando nenhuma regra anterior bateu (mesmo
         princípio do fallback A_VALIDAR original: "nada sustentado" nunca é
         uma escolha forçada). Antes era {all:[]} — vacuamente verdadeiro —,
         mas o Firebase não grava lista nem objeto vazio: toda versão
         publicada voltava do banco SEM condicoes nesta regra, o diff
         acusava mudança lógica falsa e validarRegras rejeitava a própria
         versão vigente (travando o editor). Um tipo explícito não depende
         de estrutura vazia nenhuma. Versões já gravadas nesse formato
         antigo continuam legíveis — ver ehFallback (compatibilidade só
         para ESTE código, nunca para qualquer regra sem condicoes). */
      { codigo: 'FALLBACK_A_VALIDAR', tipo: 'FALLBACK', ordem: 12, resultado: 'a-validar', incoerencia: false, conflito: null,
        motivos: [] }
    ]
  };

  /* Só o RÓTULO de cada camada — identidade (CAMADAS, em
     avaliacao-produto.js) continua fixa em código; isto é só a redação
     exibida, parametrizável sem versionar motorVersionArquitetura. */
  var PADRAO_TEXTOS = {
    'produto-principal': { rotulo: 'Produto/Serviço principal' },
    'unidade-valor-associada': { rotulo: 'Unidade de valor associada' },
    'modalidade-subproduto': { rotulo: 'Modalidade/Subproduto' },
    'funcionalidade-operacao': { rotulo: 'Funcionalidade/Operação' },
    'componente': { rotulo: 'Componente' },
    'regra-condicao': { rotulo: 'Regra/Opção' },
    'processo-etapa': { rotulo: 'Processo/Etapa de processo' },
    'capacidade-organizacional': { rotulo: 'Capacidade organizacional' },
    'canal': { rotulo: 'Canal' },
    'documento-informacao': { rotulo: 'Informação/Documento' },
    'a-validar': { rotulo: 'A validar' }
  };

  /* ===================== INTÉRPRETE SEGURO (idêntico em espírito a
     motor-squad.js — all/any/not/equals, nunca eval; duplicado aqui de
     propósito: este projeto não tem bundler/import (ver CLAUDE.md), cada
     módulo é um <script> autocontido, e o intérprete é pequeno o bastante
     para não justificar uma terceira infraestrutura de "utils
     compartilhados" só para ~15 linhas — mesmo padrão já usado por
     avaliacao-produto.js/avaliacao-squad.js para esc()/fmtData()/modais). */
  function normalizarValor(v) { return String(v == null ? '' : v).trim().toUpperCase(); }
  /* "PELO MENOS N DE" — { atLeast: 2, of: [condições] }: verdadeiro quando
     pelo menos N das condições listadas são verdadeiras. Existe para a
     política geral de conflitos de natureza predominante ("pelo menos 2
     entre P11–P15 = SIM"): escrita com all/any, a mesma ideia viraria um
     QUALQUER de 10 pares (20 folhas soltas no editor). Continua sendo só um
     operador lógico sobre condições SIM/NÃO — não é peso, pontuação nem
     soma de respostas para escolher camada: só diz se há conflito. */
  function ehPeloMenos(cond) {
    return !!cond && typeof cond === 'object' && (cond.atLeast != null || cond.of != null);
  }
  function avaliarCondicao(cond, contexto) {
    if (!cond || typeof cond !== 'object') return false;
    if (Array.isArray(cond.all)) return cond.all.every(function (c) { return avaliarCondicao(c, contexto); });
    if (Array.isArray(cond.any)) return cond.any.some(function (c) { return avaliarCondicao(c, contexto); });
    if (ehPeloMenos(cond)) {
      if (!Array.isArray(cond.of) || typeof cond.atLeast !== 'number') return false;
      var verdadeiras = 0;
      for (var i = 0; i < cond.of.length; i++) if (avaliarCondicao(cond.of[i], contexto)) verdadeiras++;
      return verdadeiras >= cond.atLeast;
    }
    if (cond.not) return !avaliarCondicao(cond.not, contexto);
    if (cond.equals) return avaliarCondicao(cond.equals, contexto);
    var campo = cond.campo || cond.pergunta;
    var valor = cond.valor != null ? cond.valor : cond.resposta;
    if (!campo) return false;
    return normalizarValor(contexto[campo]) === normalizarValor(valor);
  }
  /* ===================== FALLBACK =====================
     tipo 'FALLBACK' é a ÚNICA forma de uma regra valer sem condicoes: é
     aplicada só quando nenhuma regra comum bateu, e validarRegras exige
     exatamente uma, com a maior precedência. Compatibilidade LEGADA,
     restrita ao código conhecido FALLBACK_A_VALIDAR sem tipo: versões
     publicadas antes desta correção guardaram {all:[]}, que o Firebase
     devolve como "sem condicoes" — as duas formas são lidas como o
     fallback. Qualquer OUTRA regra sem condicoes continua inválida (nunca
     vira "sempre verdadeira"): esconder uma configuração corrompida seria
     pior que rejeitá-la. */
  var TIPO_FALLBACK = 'FALLBACK';
  var CODIGO_FALLBACK_LEGADO = 'FALLBACK_A_VALIDAR';
  function ehCondicaoVaziaLegada(cond) {
    return !!cond && typeof cond === 'object' && Array.isArray(cond.all) && cond.all.length === 0 && Object.keys(cond).length === 1;
  }
  function ehFallback(regra) {
    if (!regra) return false;
    if (regra.tipo === TIPO_FALLBACK) return true;
    return regra.tipo == null && regra.codigo === CODIGO_FALLBACK_LEGADO &&
      (regra.condicoes == null || ehCondicaoVaziaLegada(regra.condicoes));
  }
  /* Converte o fallback legado para a forma explícita (cópia — nunca muda
     o objeto recebido). Usado ao abrir o editor e ao publicar, para que
     nenhuma versão NOVA volte a gravar a forma antiga; diffRegras trata as
     duas formas como iguais, então a conversão sozinha nunca cria versão. */
  function migrarFallbackLegado(regras) {
    return (regras || []).map(function (r) {
      var copia = JSON.parse(JSON.stringify(r));
      if (ehFallback(copia) && copia.tipo !== TIPO_FALLBACK) {
        copia.tipo = TIPO_FALLBACK;
        delete copia.condicoes;
      }
      return copia;
    });
  }

  function ordenarPorPrecedencia(regras) {
    return (regras || []).slice().sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0); });
  }
  function executarRegrasOrdenadas(ordenadas, contexto) {
    var fallback = null;
    for (var i = 0; i < ordenadas.length; i++) {
      if (ehFallback(ordenadas[i])) { if (!fallback) fallback = ordenadas[i]; continue; }
      if (avaliarCondicao(ordenadas[i].condicoes, contexto)) return ordenadas[i];
    }
    return fallback;
  }
  function executarRegras(regras, contexto) {
    return executarRegrasOrdenadas(ordenarPorPrecedencia(regras), contexto);
  }

  /* ===================== NORMALIZAÇÃO SEMÂNTICA PARA COMPARAÇÃO (diffRegras) =====================
     Robustez de versionamento, sem mudar NENHUMA regra de negócio (mesmas
     condições, mesma precedência, mesmos resultados, identificarCamada
     intocado): diffRegras precisa decidir "mudou de verdade" olhando o
     SIGNIFICADO da regra para avaliarCondicao/executarRegras, nunca a
     serialização. Duas fontes de diferença puramente estrutural que NUNCA
     podem gerar uma versão nova:
       (1) ordem das propriedades de um objeto — {codigo,ordem,resultado}
           e {resultado,codigo,ordem} são a mesma regra para o executor;
       (2) ordem dos elementos DENTRO de all/any — P1=SIM,P2=SIM é a MESMA
           condição que P2=SIM,P1=SIM (E/OU lógico não depende de ordem).
     A PRECEDÊNCIA ENTRE regras diferentes (o campo "ordem" de cada regra)
     continua tendo significado lógico — é um valor de campo comparado
     normalmente, nunca uma questão de ordem de array, então trocar a
     precedência entre duas regras continua sendo detectado.
     "motivos" fica FORA desta comparação: é só uma lista de códigos usada
     para compor o texto de justificativa em avaliacao-produto.js, nunca
     lida por avaliarCondicao/executarRegras/identificarCamada para decidir
     nada — metadado não usado pelo executor (mesmo critério de rotulo/
     interpretacao, que nem mora no objeto de regra). resultado/incoerencia/
     conflito continuam comparados: são parte do que a regra devolve quando
     bate, não apresentação. */
  function ordenarChavesProfundo(valor) {
    if (Array.isArray(valor)) return valor.map(ordenarChavesProfundo);
    if (valor && typeof valor === 'object') {
      var chaves = Object.keys(valor).sort();
      var out = {};
      chaves.forEach(function (k) { out[k] = ordenarChavesProfundo(valor[k]); });
      return out;
    }
    return valor;
  }
  /* Condição canônica: folha {campo,valor} com valor normalizado do MESMO
     jeito que avaliarCondicao compara (normalizarValor); all/any com os
     filhos ORDENADOS pela própria forma canônica (comutatividade — ordem
     visual dentro de all/any nunca é lógica); not/equals recursivos —
     equals é só um alias transparente do seu próprio conteúdo, nunca muda
     o que é avaliado. */
  function normalizarCondicaoParaComparacao(cond) {
    if (!cond || typeof cond !== 'object') return null;
    if (Array.isArray(cond.all)) {
      var filhosAll = cond.all.map(normalizarCondicaoParaComparacao);
      filhosAll.sort(function (a, b) {
        var sa = JSON.stringify(a), sb = JSON.stringify(b);
        return sa < sb ? -1 : (sa > sb ? 1 : 0);
      });
      return { all: filhosAll };
    }
    if (Array.isArray(cond.any)) {
      var filhosAny = cond.any.map(normalizarCondicaoParaComparacao);
      filhosAny.sort(function (a, b) {
        var sa = JSON.stringify(a), sb = JSON.stringify(b);
        return sa < sb ? -1 : (sa > sb ? 1 : 0);
      });
      return { any: filhosAny };
    }
    if (ehPeloMenos(cond)) {
      var filhosDe = (Array.isArray(cond.of) ? cond.of : []).map(normalizarCondicaoParaComparacao);
      filhosDe.sort(function (a, b) {
        var sa = JSON.stringify(a), sb = JSON.stringify(b);
        return sa < sb ? -1 : (sa > sb ? 1 : 0);
      });
      return { atLeast: cond.atLeast, of: filhosDe };
    }
    if (cond.not) return { not: normalizarCondicaoParaComparacao(cond.not) };
    if (cond.equals) return normalizarCondicaoParaComparacao(cond.equals);
    var campo = cond.campo || cond.pergunta;
    var valor = cond.valor != null ? cond.valor : cond.resposta;
    return { campo: campo || null, valor: normalizarValor(valor) };
  }
  /* Regra canônica: só os campos que o executor realmente usa ou devolve
     (ver comentário acima) — nunca motivos, nunca sensível à ordem das
     propriedades do objeto (ordenarChavesProfundo no final). */
  function normalizarRegraParaComparacao(regra) {
    if (!regra) return null;
    /* Fallback (explícito ou legado — ver ehFallback) tem UMA forma
       canônica só, sem condicoes: legado {all:[]}, legado sem condicoes
       (como o Firebase devolve) e tipo FALLBACK são a mesma regra. */
    if (ehFallback(regra)) {
      return ordenarChavesProfundo({
        codigo: regra.codigo || null,
        tipo: TIPO_FALLBACK,
        ordem: regra.ordem != null ? regra.ordem : null,
        resultado: regra.resultado || null,
        incoerencia: !!regra.incoerencia,
        conflito: regra.conflito || null
      });
    }
    var canonica = {
      codigo: regra.codigo || null,
      ordem: regra.ordem != null ? regra.ordem : null,
      resultado: regra.resultado || null,
      incoerencia: !!regra.incoerencia,
      conflito: regra.conflito || null,
      condicoes: normalizarCondicaoParaComparacao(regra.condicoes)
    };
    /* Só entra quando ligado: assim a forma canônica de toda regra que não
       usa conflito dinâmico (todas as versões já publicadas) continua
       exatamente a de antes — nenhuma versão antiga "muda" no diff. */
    if (regra.conflitoDinamico) canonica.conflitoDinamico = true;
    return ordenarChavesProfundo(canonica);
  }

  /* ===================== MOTOR PURO (sem Firebase, sem DOM) =====================
     respostasPorCodigo: mapa {P1:'SIM'|'NAO', ..., P16:'SIM'|'NAO'} — NUNCA
     os ids internos de avaliacao-produto.js (necessidade/resultado/...) nem
     o texto da pergunta; quem chama (identificarCamada, em
     avaliacao-produto.js) converte respostas internas para este formato
     antes de chamar, e traduz motivosCodigos de volta para os rótulos de
     apresentação depois — este módulo nunca conhece ROTULOS_SINAL nem
     nomes internos, só códigos P1-P16. */
  /* Retorno COMPLETO do motor para uma regra aplicada (ou nenhuma) — um
     único lugar monta este objeto, tanto para identificarCamada quanto para
     a prova exaustiva de equivalência entre versões (compararRegrasExaustivamente),
     para as duas nunca divergirem sobre "o que o motor devolve". */
  function retornoDoMotor(regra, contexto) {
    if (!regra) return { camada: 'a-validar', regraAplicada: null, motivosCodigos: [], conflito: null, incoerencia: false };
    if (regra.conflitoDinamico) {
      /* Conflito DINÂMICO: as categorias em conflito são só as naturezas
         efetivamente marcadas SIM nesta combinação (nunca uma lista fixa que
         cite o que ninguém marcou) — e os motivos são as mesmas perguntas. */
      var marcadas = naturezasMarcadas(regra, contexto || {});
      return {
        camada: regra.resultado, regraAplicada: regra.codigo || null,
        motivosCodigos: marcadas.map(function (m) { return m.campo; }),
        conflito: marcadas.map(function (m) { return m.camada; }),
        incoerencia: !!regra.incoerencia, conflitoNaturezas: true
      };
    }
    return {
      camada: regra.resultado, regraAplicada: regra.codigo || null, motivosCodigos: regra.motivos || [],
      conflito: regra.conflito || null, incoerencia: !!regra.incoerencia
    };
  }
  /* ===================== CONFLITO DE NATUREZAS PREDOMINANTES =====================
     P11–P15 perguntam, cada uma, se o item é PRINCIPALMENTE uma natureza
     arquitetural; as definições curadas não estabelecem hierarquia entre
     elas, então duas ou mais SIM são um conflito (A validar), nunca uma
     escolha pela ordem das regras. A correspondência pergunta → camada é
     IDENTIDADE (fixa em código, como CAMADAS_VALIDAS), nunca texto. */
  var CAMADA_POR_NATUREZA = {
    P11: 'capacidade-organizacional', P12: 'processo-etapa', P13: 'modalidade-subproduto',
    P14: 'regra-condicao', P15: 'componente'
  };
  /* Folhas de natureza (P11–P15 = SIM) dentro dos grupos "pelo menos N de"
     de uma regra — é delas, e só delas, que sai a lista dinâmica. */
  function folhasDeNatureza(regra) {
    var folhas = [];
    (function percorre(cond, dentroDePeloMenos) {
      if (!cond || typeof cond !== 'object') return;
      if (Array.isArray(cond.all)) { cond.all.forEach(function (c) { percorre(c, dentroDePeloMenos); }); return; }
      if (Array.isArray(cond.any)) { cond.any.forEach(function (c) { percorre(c, dentroDePeloMenos); }); return; }
      if (ehPeloMenos(cond)) { (Array.isArray(cond.of) ? cond.of : []).forEach(function (c) { percorre(c, true); }); return; }
      if (cond.not || cond.equals) return;
      var campo = cond.campo || cond.pergunta;
      var valor = cond.valor != null ? cond.valor : cond.resposta;
      if (dentroDePeloMenos && CAMADA_POR_NATUREZA[campo] && normalizarValor(valor) === 'SIM') folhas.push(campo);
    })(regra && regra.condicoes, false);
    return folhas;
  }
  /* Naturezas marcadas SIM nesta combinação, na ordem das perguntas (P11 →
     P15), sem repetição: [{ campo: 'P11', camada: 'capacidade-organizacional' }, ...]. */
  function naturezasMarcadas(regra, contexto) {
    var vistas = {};
    folhasDeNatureza(regra).forEach(function (campo) {
      if (normalizarValor(contexto[campo]) === 'SIM') vistas[campo] = true;
    });
    return Object.keys(CAMADA_POR_NATUREZA).filter(function (campo) { return vistas[campo]; })
      .map(function (campo) { return { campo: campo, camada: CAMADA_POR_NATUREZA[campo] }; });
  }
  function contextoNormalizado(respostasPorCodigo) {
    var contexto = {};
    Object.keys(respostasPorCodigo || {}).forEach(function (cod) { contexto[cod] = normalizarValor(respostasPorCodigo[cod]); });
    return contexto;
  }
  function identificarCamada(respostasPorCodigo, regrasConfig) {
    var regras = (regrasConfig && regrasConfig.regras) || PADRAO_REGRAS.regras;
    var contexto = contextoNormalizado(respostasPorCodigo);
    var regra = executarRegras(regras, contexto);
    if (!regra) console.error('[motor-arquitetura] nenhuma regra aplicável (nem o fallback) para o contexto:', contexto);
    return retornoDoMotor(regra, contexto);
  }

  /* ===================== PROVA DE EQUIVALÊNCIA ENTRE CONJUNTOS DE REGRAS =====================
     Exaustiva: as 2^16 = 65536 combinações de P1-P16, comparando o
     RETORNO COMPLETO do motor (camada, regra aplicada, motivos, conflito,
     incoerência) — nunca só a camada final. É a prova exigida antes de
     reconciliar uma avaliação carimbada numa versão antiga com a versão
     vigente sem recalcular nada (ver avaliacao-produto.js). */
  var TOTAL_COMBINACOES = 65536;
  function contextoDaCombinacao(n) {
    var contexto = {};
    for (var b = 0; b < 16; b++) contexto[CAMPOS_VALIDOS[b]] = (n & (1 << b)) ? 'SIM' : 'NAO';
    return contexto;
  }
  /* Espelho EXATO de avaliarCondicao, resolvido uma vez por condição em vez
     de a cada combinação (só usado pela prova exaustiva). O contexto aqui
     já chega normalizado ('SIM'/'NAO'); qualquer outro valor passa pelo
     mesmo normalizarValor do executor. */
  function compilarCondicao(cond) {
    if (!cond || typeof cond !== 'object') return function () { return false; };
    if (Array.isArray(cond.all)) {
      var filhosAll = cond.all.map(compilarCondicao);
      return function (ctx) { for (var i = 0; i < filhosAll.length; i++) if (!filhosAll[i](ctx)) return false; return true; };
    }
    if (Array.isArray(cond.any)) {
      var filhosAny = cond.any.map(compilarCondicao);
      return function (ctx) { for (var i = 0; i < filhosAny.length; i++) if (filhosAny[i](ctx)) return true; return false; };
    }
    if (ehPeloMenos(cond)) {
      if (!Array.isArray(cond.of) || typeof cond.atLeast !== 'number') return function () { return false; };
      var filhosDe = cond.of.map(compilarCondicao), minimo = cond.atLeast;
      return function (ctx) {
        var verdadeiras = 0;
        for (var i = 0; i < filhosDe.length; i++) if (filhosDe[i](ctx)) verdadeiras++;
        return verdadeiras >= minimo;
      };
    }
    if (cond.not) { var negado = compilarCondicao(cond.not); return function (ctx) { return !negado(ctx); }; }
    if (cond.equals) return compilarCondicao(cond.equals);
    var campo = cond.campo || cond.pergunta;
    if (!campo) return function () { return false; };
    var esperado = normalizarValor(cond.valor != null ? cond.valor : cond.resposta);
    return function (ctx) {
      var v = ctx[campo];
      return (v === 'SIM' || v === 'NAO' ? v : normalizarValor(v)) === esperado;
    };
  }
  /* Mesmo algoritmo de executarRegrasOrdenadas (precedência, fallback só
     quando nenhuma comum bate), devolvendo o ÍNDICE da regra aplicada
     (-1 = nenhuma) e a assinatura serializada do retorno de cada uma. */
  function compilarRegras(regras) {
    var ordenadas = ordenarPorPrecedencia(regras);
    var predicados = ordenadas.map(function (r) { return ehFallback(r) ? null : compilarCondicao(r.condicoes); });
    var idxFallback = -1;
    for (var i = 0; i < ordenadas.length; i++) if (predicados[i] === null) { idxFallback = i; break; }
    var assinaturas = {};
    ordenadas.forEach(function (r, i) { assinaturas[i] = r.conflitoDinamico ? null : JSON.stringify(retornoDoMotor(r)); });
    assinaturas[-1] = JSON.stringify(retornoDoMotor(null));
    return {
      regras: ordenadas,
      /* Uma regra de conflito dinâmico devolve uma lista que depende da
         combinação — a assinatura dela é calculada a cada combinação; a das
         outras regras continua serializada uma vez só. */
      assinatura: function (i, ctx) {
        return assinaturas[i] !== null ? assinaturas[i] : JSON.stringify(retornoDoMotor(ordenadas[i], ctx));
      },
      executar: function (ctx) {
        for (var j = 0; j < predicados.length; j++) if (predicados[j] !== null && predicados[j](ctx)) return j;
        return idxFallback;
      }
    };
  }
  function compararRegrasExaustivamente(regrasA, regrasB, maxExemplos) {
    var limite = maxExemplos == null ? 5 : maxExemplos;
    /* Desempenho sem mudar o que é comparado: as condições são
       "compiladas" uma vez (compilarCondicao — mesma semântica de
       avaliarCondicao) e o retorno de cada regra é serializado uma vez só;
       sem isso a prova levava ~0,6 s no computador (bem mais no celular),
       travando a tela. Os exemplos continuam vindo de retornoDoMotor. */
    var execA = compilarRegras(regrasA), execB = compilarRegras(regrasB);
    var diferencas = 0, exemplos = [];
    var contexto = {};
    for (var n = 0; n < TOTAL_COMBINACOES; n++) {
      for (var b = 0; b < 16; b++) contexto[CAMPOS_VALIDOS[b]] = (n & (1 << b)) ? 'SIM' : 'NAO';
      var ia = execA.executar(contexto), ib = execB.executar(contexto);
      if (execA.assinatura(ia, contexto) !== execB.assinatura(ib, contexto)) {
        diferencas++;
        if (exemplos.length < limite) {
          var respostas = contextoDaCombinacao(n);
          exemplos.push({ respostas: respostas, antes: retornoDoMotor(execA.regras[ia] || null, respostas), depois: retornoDoMotor(execB.regras[ib] || null, respostas) });
        }
      }
    }
    return { combinacoesAnalisadas: TOTAL_COMBINACOES, diferencas: diferencas, exemplos: exemplos, equivalentes: diferencas === 0 };
  }

  /* ===================== ASSINATURA SEMÂNTICA (só leitura) =====================
     Resume O QUE o motor decide nas 65.536 combinações — e só isso: para
     cada combinação, a camada resultante, o tipo de decisão (normal,
     fallback, incoerência, conflito de naturezas, conflito fixo ou nenhuma
     regra) e, nos conflitos, as camadas em conflito. Ficam de fora motivos,
     rótulos, códigos, textos e a forma como as condições estão escritas:
     duas versões com a mesma lógica e redação diferente têm a mesma
     sequência. A assinatura é o SHA-256 de uma codificação CANÔNICA e sem
     perda dessa sequência: as etiquetas distintas em ordem alfabética,
     separadas por "\n" (UTF-8), um byte 0, e então, para cada combinação na
     ordem 0..65535, o índice da sua etiqueta nessa lista em 2 bytes (big
     endian). Mesma informação que a sequência por extenso, ~130 KB em vez
     de ~1,8 MB — o fechamento não pesa na tela.
     Usa a mesma avaliação compilada da prova exaustiva (compilarRegras) e o
     mesmo retornoDoMotor de identificarCamada — não decide nada por conta
     própria, não altera nenhuma regra e não toca no motor em uso.
     criarVarreduraSemantica percorre em pedaços (avancar(n)) para quem
     precisa sem travar a tela; assinatura() devolve uma Promise com o
     SHA-256 (Web Crypto). assinaturaSemantica faz tudo de uma vez — só para
     testes e diagnóstico, nunca num caminho interativo. */
  function sha256Hex(bytes) {
    var c = (typeof window !== 'undefined' && window.crypto) || (typeof crypto !== 'undefined' ? crypto : null);
    if (!c || !c.subtle || typeof TextEncoder === 'undefined') return Promise.reject(new Error('SHA-256 (Web Crypto) indisponível'));
    return c.subtle.digest('SHA-256', bytes).then(function (buf) {
      var bytes = new Uint8Array(buf), hex = '';
      for (var i = 0; i < bytes.length; i++) hex += ('0' + bytes[i].toString(16)).slice(-2);
      return hex;
    });
  }
  function criarVarreduraSemantica(regrasOuConfig) {
    var lista = Array.isArray(regrasOuConfig) ? regrasOuConfig : ((regrasOuConfig && regrasOuConfig.regras) || []);
    var exec = compilarRegras(lista);
    function rotuloDecisao(i, ctx) {
      var regra = exec.regras[i] || null;
      var r = retornoDoMotor(regra, ctx);
      var tipo = !regra ? 'sem-regra' : r.incoerencia ? 'incoerencia' : r.conflitoNaturezas ? 'conflito-naturezas' :
        ehFallback(regra) ? 'fallback' : (r.conflito ? 'conflito' : 'normal');
      return r.camada + '|' + tipo + (r.conflito ? '|' + r.conflito.join(',') : '');
    }
    var fixos = {};
    exec.regras.forEach(function (r, i) { if (!r.conflitoDinamico) fixos[i] = rotuloDecisao(i); });
    fixos[-1] = rotuloDecisao(-1);
    var indices = new Uint16Array(TOTAL_COMBINACOES), dicionario = [], posicaoNoDicionario = {}, n = 0, contexto = {};
    /* por extenso — só para testes/diagnóstico (monta ~1,8 MB) */
    function sequencia() {
      if (n < TOTAL_COMBINACOES) return null;
      var linhas = new Array(TOTAL_COMBINACOES);
      for (var k = 0; k < TOTAL_COMBINACOES; k++) linhas[k] = dicionario[indices[k]];
      return linhas.join('\n');
    }
    function bytesCanonicos() {
      if (n < TOTAL_COMBINACOES) return null;
      var ordenadas = dicionario.slice().sort(), novaPosicao = {};
      ordenadas.forEach(function (rotulo, i) { novaPosicao[rotulo] = i; });
      var deAntigaParaNova = dicionario.map(function (rotulo) { return novaPosicao[rotulo]; });
      var cabecalho = new TextEncoder().encode(ordenadas.join('\n'));
      var bytes = new Uint8Array(cabecalho.length + 1 + TOTAL_COMBINACOES * 2);
      bytes.set(cabecalho, 0);
      bytes[cabecalho.length] = 0;
      for (var k = 0, o = cabecalho.length + 1; k < TOTAL_COMBINACOES; k++, o += 2) {
        var v = deAntigaParaNova[indices[k]];
        bytes[o] = v >>> 8; bytes[o + 1] = v & 255;
      }
      return bytes;
    }
    return {
      avancar: function (quantas) {
        var fim = Math.min(TOTAL_COMBINACOES, n + Math.max(1, quantas || TOTAL_COMBINACOES));
        for (; n < fim; n++) {
          for (var b = 0; b < 16; b++) contexto[CAMPOS_VALIDOS[b]] = (n & (1 << b)) ? 'SIM' : 'NAO';
          var i = exec.executar(contexto);
          var rotulo = fixos[i] !== undefined ? fixos[i] : rotuloDecisao(i, contexto);
          var p = posicaoNoDicionario[rotulo];
          if (p === undefined) { p = posicaoNoDicionario[rotulo] = dicionario.length; dicionario.push(rotulo); }
          indices[n] = p;
        }
        return n >= TOTAL_COMBINACOES;
      },
      concluida: function () { return n >= TOTAL_COMBINACOES; },
      sequencia: sequencia,
      bytesCanonicos: bytesCanonicos,
      assinatura: function () {
        if (n < TOTAL_COMBINACOES) return Promise.reject(new Error('varredura incompleta'));
        return sha256Hex(bytesCanonicos());
      }
    };
  }
  function assinaturaSemantica(regrasOuConfig) {
    var v = criarVarreduraSemantica(regrasOuConfig);
    v.avancar(TOTAL_COMBINACOES);
    return v.assinatura();
  }

  /* ===================== SIMULAÇÃO (item 20 do pedido) =====================
     Pura, só leitura — recebe as avaliações CONCLUÍDAS já carregadas por
     quem chama (avaliacao-produto.js já tem esse array em memória; este
     módulo nunca lê avaliacoes-produto sozinho). respostasPorCodigoFn é uma
     função fornecida por quem chama que converte item.respostas (ids
     internos) para o mapa P1-P16 — mantém este módulo agnóstico da
     estrutura interna de avaliacoes-produto. */
  function simular(regrasCandidatas, avaliacoesConcluidas, respostasPorCodigoFn) {
    var regrasAtuais = regrasDaVersao(versaoAtual());
    /* regrasCandidatas chega como ARRAY puro (mesma convenção de
       publicarRegras/salvarRascunhoRegras/iniciarOuObterRascunhoRegras) —
       identificarCamada espera {regras:[...]}; sem este wrap, o candidato
       nunca era realmente testado (caía sempre no fallback PADRAO_REGRAS
       dentro de identificarCamada, escondendo qualquer mudança de lógica
       da simulação). */
    var candidatoEmbrulhado = { regras: regrasCandidatas };
    var mudariam = [];
    (avaliacoesConcluidas || []).forEach(function (av) {
      var contexto = respostasPorCodigoFn(av);
      var atual = identificarCamada(contexto, regrasAtuais);
      var nova = identificarCamada(contexto, candidatoEmbrulhado);
      if (atual.camada !== nova.camada) {
        mudariam.push({ _key: av._key, itemNome: av.nome, atual: atual.camada, nova: nova.camada });
      }
    });
    var total = (avaliacoesConcluidas || []).length;
    return { totalAnalisadas: total, mantidas: total - mudariam.length, mudariam: mudariam };
  }

  /* ===================== VALIDAÇÃO (item 23 do pedido) =====================
     Bloqueia publicação de uma configuração que possa gerar erro de
     execução ou resultado indefinido. A checagem de fallback é EXAUSTIVA
     (65536 combinações das 16 perguntas, nunca amostragem) — computacionalmente
     trivial para 16 booleanos, e é a única forma de PROVAR que uma
     configuração sempre decide algo, em vez de confiar que "parece"
     completa. */
  function validarCondicao(cond, erros, caminho) {
    if (!cond || typeof cond !== 'object') { erros.push('Condição vazia ou inválida em ' + caminho); return; }
    /* Lista vazia nunca é aceita: "TODAS de nenhuma" seria verdade implícita
       (e o Firebase nem a grava — ver ehFallback). A única regra que vale
       sem condição é a de tipo FALLBACK, explicitamente. */
    if (Array.isArray(cond.all) && !cond.all.length) { erros.push('Grupo "TODAS as condições" vazio em ' + caminho + ' — use uma regra de fallback (tipo FALLBACK) para "sempre".'); return; }
    if (Array.isArray(cond.any) && !cond.any.length) { erros.push('Grupo "QUALQUER condição" vazio em ' + caminho + '.'); return; }
    if (Array.isArray(cond.all)) { cond.all.forEach(function (c, i) { validarCondicao(c, erros, caminho + '.all[' + i + ']'); }); return; }
    if (Array.isArray(cond.any)) { cond.any.forEach(function (c, i) { validarCondicao(c, erros, caminho + '.any[' + i + ']'); }); return; }
    if (ehPeloMenos(cond)) {
      if (!Array.isArray(cond.of) || !cond.of.length) { erros.push('Grupo "PELO MENOS" sem condições em ' + caminho + '.'); return; }
      var n = cond.atLeast;
      if (typeof n !== 'number' || Math.floor(n) !== n || n < 1 || n > cond.of.length) {
        erros.push('Grupo "PELO MENOS" com quantidade inválida (' + n + ') em ' + caminho + ' — precisa ser um número inteiro de 1 a ' + cond.of.length + '.');
      }
      cond.of.forEach(function (c, i) { validarCondicao(c, erros, caminho + '.of[' + i + ']'); });
      return;
    }
    if (cond.not) { validarCondicao(cond.not, erros, caminho + '.not'); return; }
    if (cond.equals) { validarCondicao(cond.equals, erros, caminho + '.equals'); return; }
    var campo = cond.campo || cond.pergunta;
    var valor = cond.valor != null ? cond.valor : cond.resposta;
    if (!campo) { erros.push('Condição sem campo/pergunta em ' + caminho); return; }
    if (CAMPOS_VALIDOS.indexOf(campo) === -1) erros.push('Pergunta desconhecida "' + campo + '" em ' + caminho);
    if (['SIM', 'NAO'].indexOf(normalizarValor(valor)) === -1) erros.push('Valor inválido "' + valor + '" em ' + caminho + ' (só SIM/NAO)');
  }
  function validarRegras(regrasConfig) {
    var erros = [];
    var regras = (regrasConfig && regrasConfig.regras) || [];
    if (!regras.length) { erros.push('Nenhuma regra configurada.'); return erros; }
    var ordens = {};
    var fallbacks = [], comuns = [];
    regras.forEach(function (r, i) {
      var nome = r.codigo || i;
      if (!r.resultado || CAMADAS_VALIDAS.indexOf(r.resultado) === -1) erros.push('Regra ' + nome + ' sem resultado válido.');
      if (r.ordem == null) erros.push('Regra ' + nome + ' sem precedência (ordem).');
      else if (ordens[r.ordem]) erros.push('Precedência ' + r.ordem + ' duplicada/ambígua entre "' + ordens[r.ordem] + '" e "' + r.codigo + '".');
      else ordens[r.ordem] = r.codigo;
      if (r.tipo != null && r.tipo !== TIPO_FALLBACK) erros.push('Regra ' + nome + ' com tipo desconhecido "' + r.tipo + '".');
      if (ehFallback(r)) {
        fallbacks.push(r);
        if (r.tipo === TIPO_FALLBACK && r.condicoes != null) erros.push('Regra de fallback ' + nome + ' não pode ter condições — ela vale sozinha quando nenhuma outra regra bate.');
        return;
      }
      comuns.push(r);
      if (r.condicoes == null) { erros.push('Regra ' + nome + ' sem condições — só a regra de fallback (tipo FALLBACK) pode não ter condições.'); return; }
      validarCondicao(r.condicoes, erros, 'regra ' + nome);
      /* Conflito dinâmico: a lista sai das naturezas (P11–P15 = SIM) de um
         grupo "PELO MENOS" — sem nenhuma, a regra citaria uma lista vazia; e
         só faz sentido levando a "A validar", nunca a uma camada. */
      if (r.conflitoDinamico) {
        if (r.resultado !== 'a-validar') erros.push('Regra ' + nome + ' de conflito dinâmico precisa classificar como "A validar".');
        if (r.conflito) erros.push('Regra ' + nome + ' de conflito dinâmico não pode ter também uma lista fixa de conflito.');
        if (!folhasDeNatureza(r).length) erros.push('Regra ' + nome + ' de conflito dinâmico precisa de um grupo "PELO MENOS" com naturezas P11–P15 = SIM.');
      }
    });
    if (!fallbacks.length) erros.push('Nenhuma regra de fallback (tipo FALLBACK) configurada — é ela que decide quando nenhuma outra regra bate.');
    else if (fallbacks.length > 1) erros.push('Mais de uma regra de fallback: ' + fallbacks.map(function (f) { return f.codigo; }).join(', ') + ' — deve existir exatamente uma.');
    else if (fallbacks[0].ordem != null) {
      var fb = fallbacks[0];
      var depois = comuns.filter(function (r) { return r.ordem != null && r.ordem >= fb.ordem; });
      if (depois.length) erros.push('A regra de fallback ' + fb.codigo + ' precisa ter a maior precedência (ser a última), mas ' +
        depois.map(function (r) { return r.codigo; }).join(', ') + ' vem depois dela.');
    }
    /* Fallback exaustivo: 2^16 = 65536 combinações — trivial de computar. */
    var semFallback = false;
    for (var n = 0; n < 65536 && !semFallback; n++) {
      var contexto = {};
      for (var b = 0; b < 16; b++) contexto[CAMPOS_VALIDOS[b]] = (n & (1 << b)) ? 'SIM' : 'NAO';
      if (!executarRegras(regras, contexto)) semFallback = true;
    }
    if (semFallback) erros.push('Configuração não cobre todas as combinações possíveis de respostas (falta um fallback) — testado exaustivamente sobre as 65536 combinações.');
    /* Regra INALCANÇÁVEL: com o editor podendo ACRESCENTAR condições, dá para
       tornar uma regra impossível de ser a primeira a valer sem perceber
       (ex.: uma condição que contradiz outra, ou uma regra anterior que já
       cobre todos os casos dela). Uma regra assim nunca classifica nada —
       quase certamente um engano — e por isso bloqueia simulação e
       publicação. Só roda numa configuração estruturalmente válida. */
    if (!erros.length) {
      regrasInalcancaveis(regras).forEach(function (codigo) {
        erros.push('A regra ' + codigo + ' nunca seria aplicada: em nenhuma das 65536 combinações de respostas ela é a primeira a valer. Revise as condições acrescentadas.');
      });
    }
    return erros;
  }
  /* Códigos das regras comuns (não fallback) que nunca são a primeira a
     valer em nenhuma das 65536 combinações. */
  function regrasInalcancaveis(regras) {
    var ordenadas = ordenarPorPrecedencia(regras || []);
    var alcancada = {};
    for (var n = 0; n < 65536; n++) {
      var contexto = {};
      for (var b = 0; b < 16; b++) contexto[CAMPOS_VALIDOS[b]] = (n & (1 << b)) ? 'SIM' : 'NAO';
      var r = executarRegrasOrdenadas(ordenadas, contexto);
      if (r) alcancada[r.codigo] = true;
    }
    return ordenadas.filter(function (r) { return !ehFallback(r) && !alcancada[r.codigo]; }).map(function (r) { return r.codigo; });
  }
  /* Todas as perguntas (P1-P16) usadas em qualquer ponto das condições de
     uma regra — inclusive dentro de grupos QUALQUER/NENHUMA. É o que o
     editor usa para não oferecer uma pergunta que a regra já usa. */
  function perguntasDaRegra(regra) {
    var usadas = {};
    (function percorre(cond) {
      if (!cond || typeof cond !== 'object') return;
      if (Array.isArray(cond.all)) { cond.all.forEach(percorre); return; }
      if (Array.isArray(cond.any)) { cond.any.forEach(percorre); return; }
      if (ehPeloMenos(cond)) { (Array.isArray(cond.of) ? cond.of : []).forEach(percorre); return; }
      if (cond.not) { percorre(cond.not); return; }
      if (cond.equals) { percorre(cond.equals); return; }
      var campo = cond.campo || cond.pergunta;
      if (campo) usadas[campo] = true;
    })(regra && regra.condicoes);
    return Object.keys(usadas);
  }
  /* Regras da versão-base EXATA de um rascunho, ou null se ela não está
     disponível (config ainda não carregada / versão inexistente) — nunca
     cai silenciosamente em outra versão: quem pergunta "o que é novo neste
     rascunho" precisa comparar com a base dele, não com a versão vigente. */
  function regrasDaVersaoBase(versao) { return regrasDaVersaoEstrita(Number(versao)); }

  /* ===================== GOVERNANÇA (RASCUNHO → SIMULAÇÃO → PUBLICAÇÃO) =====================
     Mesmo padrão de motor-squad.js — um único listener, cache local,
     versoes/<n> nunca sobrescritas, textos publicados imediatamente sem
     versionar. */
  var cache = null;
  var carregado = false;
  var listeners = [];

  function garantirSync() {
    if (carregado) return;
    carregado = true;
    db().ref(NODE_CONFIG).on('value', function (snap) {
      cache = snap.val();
      configRecebida = true;
      memoEquivalencia = {};
      listeners.slice().forEach(function (cb) { cb(); });
    });
  }
  function onMudanca(cb) { garantirSync(); listeners.push(cb); }
  /* true só depois da PRIMEIRA leitura de motor-arquitetura-config chegar.
     Antes disso versaoAtual() devolve 1 por falta de dado, não porque a
     versão vigente é 1 — nada que GRAVA uma versão (reconciliação) pode
     agir nessa janela, que em rede lenta de celular dura segundos. */
  var configRecebida = false;
  function configCarregada() { return configRecebida; }

  /* Regras de uma versão SEM o fallback silencioso de regrasDaVersao: a
     versão 1 sem registro gravado é, por definição, a configuração de
     fábrica (nunca houve publicação); qualquer outra versão ausente é
     "não sei" (null) — nunca pode ser tratada como fábrica numa prova de
     equivalência. */
  function regrasDaVersaoEstrita(versao) {
    if (cache && cache.versoes && cache.versoes[versao] && cache.versoes[versao].regras) return cache.versoes[versao].regras;
    if (versao === 1) return PADRAO_REGRAS.regras;
    return null;
  }
  /* Prova exaustiva entre duas versões publicadas (memorizada: versoes/<n>
     nunca são sobrescritas; o memo é zerado a cada leitura nova da config
     mesmo assim). Sem a config carregada ou sem alguma das versões, nunca
     afirma equivalência. */
  var memoEquivalencia = {};
  function equivalenciaEntreVersoes(versaoA, versaoB) {
    var a = Number(versaoA), b = Number(versaoB);
    var base = { versaoA: a, versaoB: b };
    if (!configRecebida) return Object.assign(base, { equivalentes: false, motivo: 'config-nao-carregada' });
    if (!(a >= 1) || !(b >= 1) || Math.floor(a) !== a || Math.floor(b) !== b) return Object.assign(base, { equivalentes: false, motivo: 'versao-invalida' });
    var chave = a + '|' + b;
    if (memoEquivalencia[chave]) return memoEquivalencia[chave];
    var regrasA = regrasDaVersaoEstrita(a), regrasB = regrasDaVersaoEstrita(b);
    if (!regrasA || !regrasB) return Object.assign(base, { equivalentes: false, motivo: 'versao-indisponivel' });
    var r = Object.assign(base, compararRegrasExaustivamente(regrasA, regrasB));
    memoEquivalencia[chave] = r;
    return r;
  }

  function versaoAtual() { return (cache && cache.versaoPublicada) || 1; }
  function regrasDaVersao(versao) {
    var v = versao || versaoAtual();
    if (cache && cache.versoes && cache.versoes[v] && cache.versoes[v].regras) return { regras: cache.versoes[v].regras };
    return PADRAO_REGRAS;
  }
  function textosAtuais() {
    var t = (cache && cache.textos) || {};
    var mesclado = {};
    Object.keys(PADRAO_TEXTOS).forEach(function (cod) { mesclado[cod] = PADRAO_TEXTOS[cod]; });
    Object.keys(t).forEach(function (cod) { mesclado[cod] = t[cod]; });
    return mesclado;
  }
  function conteudoTexto(codigo) { return textosAtuais()[codigo] || { rotulo: codigo }; }

  function rascunhoRegrasAtual() { return (cache && cache.rascunho) || null; }
  function iniciarOuObterRascunhoRegras() {
    var existente = rascunhoRegrasAtual();
    if (existente && existente.regras) return migrarFallbackLegado(existente.regras);
    return migrarFallbackLegado(regrasDaVersao(versaoAtual()).regras);
  }
  /* versaoBase: a versão publicada que estava vigente quando o rascunho
     começou a ser editado — gravada UMA VEZ (na primeira vez que este
     rascunho é salvo) e preservada em toda gravação seguinte do MESMO
     rascunho, mesmo que outra pessoa publique uma versão nova nesse
     meio-tempo: é contra ESSE número, não contra a versão vigente no
     momento do salvamento, que publicarRegras compara na hora de publicar
     (controle de concorrência otimista — ver publicarRegras). Quem chama
     pode passar versaoBase explicitamente (ex.: a tela já leu
     versaoBaseDoRascunho() quando abriu a edição); sem isso, cai no
     rascunho já existente ou, na ausência de qualquer um dos dois, na
     versão publicada atual (primeiro rascunho de todos). */
  function salvarRascunhoRegras(regras, usuario, cb, versaoBase) {
    var existente = rascunhoRegrasAtual();
    var base = versaoBase != null ? versaoBase
      : (existente && existente.versaoBase != null ? existente.versaoBase : versaoAtual());
    db().ref(NODE_CONFIG + '/rascunho').set(
      { regras: regras, atualizadoEm: new Date().toISOString(), atualizadoPor: usuario || null, versaoBase: base },
      function (err) { if (cb) cb(err || null); }
    );
  }
  function versaoBaseDoRascunho() {
    var r = rascunhoRegrasAtual();
    return (r && r.versaoBase != null) ? r.versaoBase : versaoAtual();
  }
  function descartarRascunhoRegras(cb) {
    db().ref(NODE_CONFIG + '/rascunho').remove(function (err) { if (cb) cb(err || null); });
  }

  /* Compara pelo CÓDIGO da regra, nunca pela posição no array — e sempre
     pela UNIÃO dos códigos dos dois lados, nunca só pelo lado novo: uma
     regra REMOVIDA (existia antes, sumiu no rascunho) é tão mudança lógica
     quanto uma adicionada ou modificada, e só aparece do lado "antigo".
     A comparação em si é SEMÂNTICA (normalizarRegraParaComparacao, ver
     acima) — nunca a serialização bruta: ordem das propriedades de um
     objeto e ordem dos elementos dentro de all/any nunca criam uma
     diferença aqui; precedência entre regras (campo "ordem"), inclusão/
     remoção de regra, mudança de condição/operador/pergunta/valor
     esperado, e mudança de resultado/incoerencia/conflito continuam
     detectados normalmente. alteradas guarda os objetos ORIGINAIS (não
     canônicos) de antigo/novo — é o que a auditoria mostra ao usuário. */
  function diffRegras(regrasAntigas, regrasNovas) {
    var porCodigoAntigo = {}, porCodigoNovo = {};
    (regrasAntigas || []).forEach(function (r) { porCodigoAntigo[r.codigo] = r; });
    (regrasNovas || []).forEach(function (r) { porCodigoNovo[r.codigo] = r; });
    var todosCodigos = {};
    Object.keys(porCodigoAntigo).forEach(function (c) { todosCodigos[c] = true; });
    Object.keys(porCodigoNovo).forEach(function (c) { todosCodigos[c] = true; });
    var alteradas = [];
    Object.keys(todosCodigos).forEach(function (codigo) {
      var antigo = porCodigoAntigo[codigo] || null;
      var novo = porCodigoNovo[codigo] || null;
      var antigoCanonico = normalizarRegraParaComparacao(antigo);
      var novoCanonico = normalizarRegraParaComparacao(novo);
      if (JSON.stringify(antigoCanonico) !== JSON.stringify(novoCanonico)) {
        alteradas.push({ codigo: codigo, antigo: antigo, novo: novo });
      }
    });
    return alteradas;
  }

  /* ===================== PROPOSTA DE REGRAS ENTREGUE PELO CÓDIGO =====================
     Política geral de conflitos de natureza predominante (versão 4). O
     editor só acrescenta condições — não tira uma condição publicada nem
     troca uma regra —, então a mudança aprovada vem pronta daqui, MAS entra
     pelo mesmo caminho de qualquer edição: a administradora carrega a
     proposta no editor (ação explícita), salva o rascunho, simula e só então
     decide publicar. Nada aqui grava, publica ou recalcula coisa alguma.

     Só fica disponível sobre a versão 3 EXATA que motivou a proposta
     (comparação semântica, a mesma de diffRegras): se a versão publicada não
     for a 3, ou se a 3 publicada não tiver a estrutura esperada, a proposta
     fica bloqueada e diz por quê — nunca é "adaptada" a outra base. */
  var PROPOSTA_CONFLITO_NATUREZAS = {
    id: 'politica-conflito-naturezas',
    versaoBase: 3,
    titulo: 'Política geral de conflitos de natureza predominante',
    mudancas: [
      'Nova regra CONFLITO_NATUREZAS (precedência 6): se pelo menos 2 entre P11, P12, P13, P14 e P15 forem SIM, o item vai para "A validar — conflito de naturezas predominantes", citando só as naturezas marcadas. Vale com P5 = SIM ou NÃO.',
      'A regra CONFLITO_PROCESSO_CAPACIDADE deixa de existir: o caso dela (P11 e P12 = SIM) passa a ser tratado pela política geral.',
      'COMPONENTE passa a ser identificado por P15 = SIM — P13 deixa de ser alternativa.',
      'MODALIDADE_SUBPRODUTO deixa de exigir P2 = SIM.',
      'Nenhuma outra regra muda; condições que ficaram redundantes continuam como estão.'
    ]
  };
  /* A versão 3 que motivou a proposta: fábrica + as condições acrescentadas
     à Unidade de valor associada nas versões 2 (P13, P15 = NÃO) e 3 (P3 =
     SIM; P11, P12, P14 = NÃO). */
  function regrasVersao3Esperadas() {
    var regras = migrarFallbackLegado(PADRAO_REGRAS.regras);
    regras.forEach(function (r) {
      if (r.codigo === 'UNIDADE_VALOR_ASSOCIADA') {
        r.condicoes.all.push(
          { campo: 'P13', valor: 'NAO' }, { campo: 'P15', valor: 'NAO' },
          { campo: 'P3', valor: 'SIM' }, { campo: 'P11', valor: 'NAO' }, { campo: 'P12', valor: 'NAO' }, { campo: 'P14', valor: 'NAO' });
      }
    });
    return regras;
  }
  function regraConflitoNaturezas(ordem) {
    return {
      codigo: 'CONFLITO_NATUREZAS', ordem: ordem, resultado: 'a-validar', incoerencia: false, conflito: null,
      conflitoDinamico: true, motivos: Object.keys(CAMADA_POR_NATUREZA),
      condicoes: { all: [{ atLeast: 2, of: Object.keys(CAMADA_POR_NATUREZA).map(function (campo) { return { campo: campo, valor: 'SIM' }; }) }] }
    };
  }
  function ehFolha(cond, campo) { return !!cond && (cond.campo || cond.pergunta) === campo; }
  /* Aplica as mudanças aprovadas sobre uma CÓPIA das regras da versão 3 —
     preserva tudo o que não muda (motivos, ordem, demais condições). */
  function construirPropostaConflitoNaturezas(regrasV3) {
    var ordemConflito = 6;
    var regras = migrarFallbackLegado(regrasV3).filter(function (r) {
      if (r.codigo !== 'CONFLITO_PROCESSO_CAPACIDADE') return true;
      ordemConflito = r.ordem;
      return false;
    });
    regras.forEach(function (r) {
      if (r.codigo === 'COMPONENTE') {
        r.condicoes.all = r.condicoes.all.map(function (c) {
          return (c && Array.isArray(c.any) && c.any.some(function (f) { return ehFolha(f, 'P13'); })) ? { campo: 'P15', valor: 'SIM' } : c;
        });
        r.motivos = (r.motivos || []).filter(function (m) { return m !== 'P13'; });
      }
      if (r.codigo === 'MODALIDADE_SUBPRODUTO') {
        r.condicoes.all = r.condicoes.all.filter(function (c) { return !ehFolha(c, 'P2'); });
        r.motivos = (r.motivos || []).filter(function (m) { return m !== 'P2'; });
      }
    });
    regras.push(regraConflitoNaturezas(ordemConflito));
    return ordenarPorPrecedencia(regras);
  }
  /* { id, titulo, mudancas, versaoBase, estado: 'disponivel'|'aplicada'|'bloqueada', motivo } */
  function situacaoPropostaRegras() {
    var p = PROPOSTA_CONFLITO_NATUREZAS;
    var base = { id: p.id, titulo: p.titulo, mudancas: p.mudancas.slice(), versaoBase: p.versaoBase };
    if (!configRecebida) return Object.assign(base, { estado: 'bloqueada', motivo: 'As regras publicadas ainda não foram carregadas. Aguarde e abra o editor de novo.' });
    var vigente = versaoAtual();
    var proposta = construirPropostaConflitoNaturezas(regrasVersao3Esperadas());
    var regrasVigentes = regrasDaVersaoEstrita(vigente);
    if (vigente !== p.versaoBase) {
      if (regrasVigentes && !diffRegras(proposta, regrasVigentes).length) return Object.assign(base, { estado: 'aplicada', motivo: 'Esta proposta já está publicada (versão ' + vigente + ').' });
      return Object.assign(base, { estado: 'bloqueada', motivo: 'A proposta foi preparada sobre a versão ' + p.versaoBase + ', mas a versão publicada agora é a ' + vigente + '. Nada foi carregado.' });
    }
    if (!regrasVigentes) return Object.assign(base, { estado: 'bloqueada', motivo: 'Não consegui ler as regras da versão ' + p.versaoBase + '. Nada foi carregado.' });
    var diferentes = diffRegras(regrasVersao3Esperadas(), regrasVigentes);
    if (diferentes.length) {
      return Object.assign(base, { estado: 'bloqueada', motivo: 'A versão ' + p.versaoBase + ' publicada não tem a estrutura esperada pela proposta (regras diferentes: ' +
        diferentes.map(function (d) { return d.codigo; }).join(', ') + '). Nada foi carregado.' });
    }
    return Object.assign(base, { estado: 'disponivel', motivo: null });
  }
  /* Regras da proposta, montadas sobre a versão 3 publicada — só quando a
     proposta está disponível; senão null. Uma cópia nova a cada chamada. */
  function regrasDaPropostaRegras() {
    if (situacaoPropostaRegras().estado !== 'disponivel') return null;
    return construirPropostaConflitoNaturezas(regrasDaVersaoEstrita(PROPOSTA_CONFLITO_NATUREZAS.versaoBase));
  }

  /* Registrada quando uma publicação é rejeitada por concorrência (ver
     publicarRegras) — nunca cria versão nova, só documenta a tentativa
     bloqueada: quem tentou publicar, contra que base, qual era a versão
     realmente vigente na hora, e se a tentativa PARECIA um no-op do ponto
     de vista de quem chamou (origem) — só diagnóstico, nunca decide nada:
     a decisão de verdade é sempre feita dentro da transaction. */
  function registrarConflitoPublicacao(versaoBase, versaoAtualServidor, usuario, origem, cb) {
    var agora = new Date().toISOString();
    var updates = {};
    updates[NODE_AUDITORIA + '/' + db().ref(NODE_AUDITORIA).push().key] = {
      tipo: 'conflito_publicacao', campo: null, valorAnterior: null, valorNovo: null,
      usuario: usuario || null, dataHora: agora, versaoBase: versaoBase, versaoAtual: versaoAtualServidor, origem: origem
    };
    db().ref().update(updates, function (err) { if (cb) cb(err || null); });
  }

  /* PUBLICAR: valida antes (validarRegras) — nunca publica uma configuração
     que possa gerar erro de execução ou deixar de cobrir alguma
     combinação. Cria versão NOVA (nunca sobrescreve), grava auditoria,
     limpa o rascunho.

     TUDO — decidir se é NO-OP ou mudança real, e gravar o resultado — é
     feito DENTRO de uma ÚNICA transaction() do Firebase sobre NODE_CONFIG,
     nunca em duas etapas separadas (nunca "ler versão / comparar / decidir
     no-op" e só DEPOIS, num passo à parte, "gravar/limpar rascunho"). Achado
     real (complementar ao de PR #243): o caminho de no-op, sozinho,
     comparava contra a versão do CACHE LOCAL e então fazia um update()
     incondicional — entre a comparação e a gravação, outra pessoa podia
     publicar uma mudança real, e o rascunho seria descartado mesmo
     deixando de ser, de fato, equivalente ao que passou a estar publicado.
     Agora o updateFn da transaction recebe o valor ATUAL do servidor no
     momento do commit, recalcula diffRegras contra as regras REALMENTE
     vigentes NESSE INSTANTE (nunca contra uma leitura anterior, seja do
     cache local, seja de um parâmetro) e só então decide:
       - diferença vazia (equivalente ao que está publicado AGORA, mesmo
         que a versão tenha mudado depois que o rascunho foi comparado da
         primeira vez) → NO-OP: limpa o rascunho, mantém a mesma
         versaoPublicada, nunca cria versão nova, nunca versiona
         motorVersionArquitetura — vale tanto no caso simples (ninguém mais
         publicou nada) quanto no caso em que outra pessoa publicou uma
         versão nova que, por coincidência, é semanticamente igual ao
         rascunho;
       - diferença real E versaoPublicada do servidor ainda bate com
         versaoBase (a versão vigente quando o rascunho começou a ser
         editado — ver salvarRascunhoRegras/versaoBaseDoRascunho) → publica
         de verdade: cria versão nova, grava auditoria tipo 'regra';
       - diferença real mas versaoPublicada do servidor NÃO bate mais com
         versaoBase → aborta (devolve undefined, não grava nada): outra
         publicação já mudou o que está vigente, e o rascunho ATUAL não é
         mais equivalente a isso — nunca descarta o rascunho nem sobrescreve
         a versão alheia; a chamada é rejeitada com
         cb('conflito', {versaoBase, versaoAtual}) e fica registrada uma
         auditoria tipo 'conflito_publicacao'.
     Isso fecha a janela de corrida tanto para publicação real (já corrigido
     em PR #243) quanto para o próprio caminho de no-op (esta correção). */
  function publicarRegras(regras, usuario, cb, versaoBase) {
    /* Nenhuma versão nova grava o fallback na forma legada (inclusive num
       rollback para uma versão antiga) — e, como diffRegras trata as duas
       formas como a mesma regra, a conversão sozinha nunca cria versão. */
    regras = migrarFallbackLegado(regras);
    var erros = validarRegras({ regras: regras });
    if (erros.length) { cb('validacao', erros); return; }
    var baseEsperada = versaoBase != null ? versaoBase : versaoAtual();
    /* Só para rotular a auditoria de conflito (nunca decide nada sozinha —
       quem decide é sempre o updateFn abaixo, contra o servidor): se o
       cache local, agora, já não vê diferença nenhuma entre o rascunho e o
       que está publicado, uma eventual rejeição por concorrência é
       diagnosticada como "eu achava que isso era um no-op"; senão, como
       tentativa de publicar uma mudança de verdade. */
    var pareciaNoOpLocalmente = diffRegras(regrasDaVersao(versaoAtual()).regras, regras).length === 0;
    var agora = new Date().toISOString();
    var alteradasReais = null;
    var eraNoOp = false;
    db().ref(NODE_CONFIG).transaction(function (atual) {
      var cfg = atual || {};
      var versaoServidor = cfg.versaoPublicada || 1;
      var regrasVigentes = (cfg.versoes && cfg.versoes[versaoServidor] && cfg.versoes[versaoServidor].regras) || PADRAO_REGRAS.regras;
      alteradasReais = diffRegras(regrasVigentes, regras);
      if (!alteradasReais.length) {
        eraNoOp = true;
        var cfgNoOp = Object.assign({}, cfg);
        cfgNoOp.versaoPublicada = versaoServidor;
        cfgNoOp.rascunho = null;
        return cfgNoOp;
      }
      eraNoOp = false;
      if (versaoServidor !== baseEsperada) return undefined;
      var novoCfg = Object.assign({}, cfg);
      novoCfg.versaoPublicada = versaoServidor + 1;
      novoCfg.versoes = Object.assign({}, cfg.versoes);
      novoCfg.versoes[novoCfg.versaoPublicada] = { regras: regras, publicadoEm: agora, publicadoPor: usuario || null };
      novoCfg.rascunho = null;
      return novoCfg;
    }, function (err, comprometido, snapshot) {
      if (err) { if (cb) cb(err); return; }
      var cfgFinal = (snapshot && snapshot.val()) || {};
      var versaoServidorFinal = cfgFinal.versaoPublicada || baseEsperada;
      if (!comprometido) {
        registrarConflitoPublicacao(baseEsperada, versaoServidorFinal, usuario, pareciaNoOpLocalmente ? 'tentativa_noop' : 'tentativa_publicacao', function () {
          if (cb) cb('conflito', { versaoBase: baseEsperada, versaoAtual: versaoServidorFinal });
        });
        return;
      }
      if (eraNoOp) {
        var updatesNoOp = {};
        updatesNoOp[NODE_AUDITORIA + '/' + db().ref(NODE_AUDITORIA).push().key] = {
          tipo: 'sem_alteracao', campo: null, valorAnterior: null, valorNovo: null,
          usuario: usuario || null, dataHora: agora, versaoAnterior: versaoServidorFinal, novaVersao: versaoServidorFinal
        };
        db().ref().update(updatesNoOp, function (errAud) {
          if (cb) cb(errAud || null, { novaVersao: versaoServidorFinal, alteradas: [], semMudanca: true });
        });
        return;
      }
      var updatesAuditoria = {};
      alteradasReais.forEach(function (alt) {
        var chave = db().ref(NODE_AUDITORIA).push().key;
        updatesAuditoria[NODE_AUDITORIA + '/' + chave] = {
          tipo: 'regra', campo: alt.codigo,
          valorAnterior: JSON.stringify(alt.antigo), valorNovo: JSON.stringify(alt.novo),
          usuario: usuario || null, dataHora: agora, versaoAnterior: baseEsperada, novaVersao: versaoServidorFinal
        };
      });
      db().ref().update(updatesAuditoria, function (errAud) {
        if (cb) cb(errAud || null, { novaVersao: versaoServidorFinal, alteradas: alteradasReais });
      });
    });
  }

  /* Rollback: sempre publicado contra a versão vigente AGORA (versaoAtual()
     no momento da chamada) — passada como versaoBase automaticamente, para
     que também fique protegido pela mesma transaction de concorrência sem
     exigir nenhuma mudança na tela que a aciona. */
  function publicarVersaoAnterior(versaoAlvo, usuario, cb) {
    var regras = regrasDaVersao(versaoAlvo).regras;
    if (!regras) { cb('versao-nao-encontrada'); return; }
    publicarRegras(JSON.parse(JSON.stringify(regras)), usuario, cb, versaoAtual());
  }

  function listarVersoes() {
    var numeros = (cache && cache.versoes) ? Object.keys(cache.versoes).map(Number) : [];
    if (numeros.indexOf(1) === -1) numeros.push(1);
    return numeros.sort(function (a, b) { return a - b; });
  }

  function salvarTextos(textosNovos, usuario, cb) {
    var textosAntigos = textosAtuais();
    var agora = new Date().toISOString();
    var updates = {};
    var alterados = [];
    Object.keys(textosNovos || {}).forEach(function (codigo) {
      var antigo = textosAntigos[codigo] || {};
      var novo = textosNovos[codigo];
      if (JSON.stringify(antigo) !== JSON.stringify(novo)) {
        updates[NODE_CONFIG + '/textos/' + codigo] = novo;
        alterados.push({ codigo: codigo, antigo: antigo, novo: novo });
      }
    });
    if (!alterados.length) { if (cb) cb(null, { alterados: [] }); return; }
    alterados.forEach(function (alt) {
      var chave = db().ref(NODE_AUDITORIA).push().key;
      updates[NODE_AUDITORIA + '/' + chave] = {
        tipo: 'texto', campo: alt.codigo,
        valorAnterior: JSON.stringify(alt.antigo), valorNovo: JSON.stringify(alt.novo),
        usuario: usuario || null, dataHora: agora, versaoAnterior: versaoAtual(), novaVersao: versaoAtual()
      };
    });
    db().ref().update(updates, function (err) { if (cb) cb(err || null, { alterados: alterados }); });
  }

  function situacao() {
    var v = versaoAtual();
    var infoVersao = cache && cache.versoes && cache.versoes[v];
    return {
      versaoPublicada: v,
      qtdRegras: regrasDaVersao(v).regras.length,
      temRascunho: !!rascunhoRegrasAtual(),
      ultimaAlteracaoEm: infoVersao ? infoVersao.publicadoEm : null,
      ultimaAlteracaoPor: infoVersao && infoVersao.publicadoPor ? (infoVersao.publicadoPor.name || infoVersao.publicadoPor.email) : null
    };
  }

  function auditoria(cb) {
    db().ref(NODE_AUDITORIA).once('value', function (snap) {
      var val = snap.val() || {};
      var lista = Object.keys(val).map(function (k) { return Object.assign({ _key: k }, val[k]); });
      lista.sort(function (a, b) { return (a.dataHora || '') < (b.dataHora || '') ? 1 : -1; });
      cb(lista);
    });
  }

  window.faMotorArquitetura = {
    CAMPOS_VALIDOS: CAMPOS_VALIDOS,
    CAMADAS_VALIDAS: CAMADAS_VALIDAS,
    PADRAO_REGRAS: PADRAO_REGRAS,
    PADRAO_TEXTOS: PADRAO_TEXTOS,
    TIPO_FALLBACK: TIPO_FALLBACK,
    avaliarCondicao: avaliarCondicao,
    ehFallback: ehFallback,
    migrarFallbackLegado: migrarFallbackLegado,
    identificarCamada: identificarCamada,
    compararRegrasExaustivamente: compararRegrasExaustivamente,
    criarVarreduraSemantica: criarVarreduraSemantica,
    assinaturaSemantica: assinaturaSemantica,
    equivalenciaEntreVersoes: equivalenciaEntreVersoes,
    configCarregada: configCarregada,
    simular: simular,
    validarRegras: validarRegras,
    regrasInalcancaveis: regrasInalcancaveis,
    perguntasDaRegra: perguntasDaRegra,
    regrasDaVersaoBase: regrasDaVersaoBase,
    CAMADA_POR_NATUREZA: CAMADA_POR_NATUREZA,
    situacaoPropostaRegras: situacaoPropostaRegras,
    regrasDaPropostaRegras: regrasDaPropostaRegras,
    /* Puras (sem Firebase): usadas pelos testes para provar a proposta sem banco. */
    regrasVersao3Esperadas: regrasVersao3Esperadas,
    construirPropostaConflitoNaturezas: construirPropostaConflitoNaturezas,
    onMudanca: onMudanca,
    versaoAtual: versaoAtual,
    regrasDaVersao: regrasDaVersao,
    textosAtuais: textosAtuais,
    conteudoTexto: conteudoTexto,
    rascunhoRegrasAtual: rascunhoRegrasAtual,
    iniciarOuObterRascunhoRegras: iniciarOuObterRascunhoRegras,
    salvarRascunhoRegras: salvarRascunhoRegras,
    versaoBaseDoRascunho: versaoBaseDoRascunho,
    descartarRascunhoRegras: descartarRascunhoRegras,
    diffRegras: diffRegras,
    normalizarRegraParaComparacao: normalizarRegraParaComparacao,
    publicarRegras: publicarRegras,
    publicarVersaoAnterior: publicarVersaoAnterior,
    listarVersoes: listarVersoes,
    salvarTextos: salvarTextos,
    situacao: situacao,
    auditoria: auditoria
  };
})();
