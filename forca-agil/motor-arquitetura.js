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
      /* Fallback: {all:[]} é vacuamente verdadeiro (Array.every de lista
         vazia = true) — bate sempre que nenhuma regra anterior bateu, sem
         precisar de nenhum caso especial no executor (mesmo princípio do
         fallback A_VALIDAR original: "nada sustentado" nunca é uma escolha
         forçada). */
      { codigo: 'FALLBACK_A_VALIDAR', ordem: 12, resultado: 'a-validar', incoerencia: false, conflito: null,
        motivos: [], condicoes: { all: [] } }
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
  function avaliarCondicao(cond, contexto) {
    if (!cond || typeof cond !== 'object') return false;
    if (Array.isArray(cond.all)) return cond.all.every(function (c) { return avaliarCondicao(c, contexto); });
    if (Array.isArray(cond.any)) return cond.any.some(function (c) { return avaliarCondicao(c, contexto); });
    if (cond.not) return !avaliarCondicao(cond.not, contexto);
    if (cond.equals) return avaliarCondicao(cond.equals, contexto);
    var campo = cond.campo || cond.pergunta;
    var valor = cond.valor != null ? cond.valor : cond.resposta;
    if (!campo) return false;
    return normalizarValor(contexto[campo]) === normalizarValor(valor);
  }
  function executarRegras(regras, contexto) {
    var ordenadas = (regras || []).slice().sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0); });
    for (var i = 0; i < ordenadas.length; i++) {
      if (avaliarCondicao(ordenadas[i].condicoes, contexto)) return ordenadas[i];
    }
    return null;
  }

  /* ===================== MOTOR PURO (sem Firebase, sem DOM) =====================
     respostasPorCodigo: mapa {P1:'SIM'|'NAO', ..., P16:'SIM'|'NAO'} — NUNCA
     os ids internos de avaliacao-produto.js (necessidade/resultado/...) nem
     o texto da pergunta; quem chama (identificarCamada, em
     avaliacao-produto.js) converte respostas internas para este formato
     antes de chamar, e traduz motivosCodigos de volta para os rótulos de
     apresentação depois — este módulo nunca conhece ROTULOS_SINAL nem
     nomes internos, só códigos P1-P16. */
  function identificarCamada(respostasPorCodigo, regrasConfig) {
    var regras = (regrasConfig && regrasConfig.regras) || PADRAO_REGRAS.regras;
    var contexto = {};
    Object.keys(respostasPorCodigo || {}).forEach(function (cod) { contexto[cod] = normalizarValor(respostasPorCodigo[cod]); });
    var regra = executarRegras(regras, contexto);
    if (!regra) {
      console.error('[motor-arquitetura] nenhuma regra aplicável (nem o fallback) para o contexto:', contexto);
      return { camada: 'a-validar', motivosCodigos: [], conflito: null, incoerencia: false };
    }
    return { camada: regra.resultado, motivosCodigos: regra.motivos || [], conflito: regra.conflito || null, incoerencia: !!regra.incoerencia };
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
    if (Array.isArray(cond.all)) { cond.all.forEach(function (c, i) { validarCondicao(c, erros, caminho + '.all[' + i + ']'); }); return; }
    if (Array.isArray(cond.any)) { cond.any.forEach(function (c, i) { validarCondicao(c, erros, caminho + '.any[' + i + ']'); }); return; }
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
    regras.forEach(function (r, i) {
      if (!r.resultado || CAMADAS_VALIDAS.indexOf(r.resultado) === -1) erros.push('Regra ' + (r.codigo || i) + ' sem resultado válido.');
      if (r.ordem == null) erros.push('Regra ' + (r.codigo || i) + ' sem precedência (ordem).');
      else if (ordens[r.ordem]) erros.push('Precedência ' + r.ordem + ' duplicada/ambígua entre "' + ordens[r.ordem] + '" e "' + r.codigo + '".');
      else ordens[r.ordem] = r.codigo;
      validarCondicao(r.condicoes, erros, 'regra ' + (r.codigo || i));
    });
    /* Fallback exaustivo: 2^16 = 65536 combinações — trivial de computar. */
    var semFallback = false;
    for (var n = 0; n < 65536 && !semFallback; n++) {
      var contexto = {};
      for (var b = 0; b < 16; b++) contexto[CAMPOS_VALIDOS[b]] = (n & (1 << b)) ? 'SIM' : 'NAO';
      if (!executarRegras(regras, contexto)) semFallback = true;
    }
    if (semFallback) erros.push('Configuração não cobre todas as combinações possíveis de respostas (falta um fallback) — testado exaustivamente sobre as 65536 combinações.');
    return erros;
  }

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
      listeners.slice().forEach(function (cb) { cb(); });
    });
  }
  function onMudanca(cb) { garantirSync(); listeners.push(cb); }

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
    if (existente && existente.regras) return JSON.parse(JSON.stringify(existente.regras));
    return JSON.parse(JSON.stringify(regrasDaVersao(versaoAtual()).regras));
  }
  function salvarRascunhoRegras(regras, usuario, cb) {
    db().ref(NODE_CONFIG + '/rascunho').set(
      { regras: regras, atualizadoEm: new Date().toISOString(), atualizadoPor: usuario || null },
      function (err) { if (cb) cb(err || null); }
    );
  }
  function descartarRascunhoRegras(cb) {
    db().ref(NODE_CONFIG + '/rascunho').remove(function (err) { if (cb) cb(err || null); });
  }

  function diffRegras(regrasAntigas, regrasNovas) {
    var porCodigoAntigo = {};
    (regrasAntigas || []).forEach(function (r) { porCodigoAntigo[r.codigo] = r; });
    var alteradas = [];
    (regrasNovas || []).forEach(function (novo) {
      var antigo = porCodigoAntigo[novo.codigo] || {};
      if (JSON.stringify(antigo) !== JSON.stringify(novo)) alteradas.push({ codigo: novo.codigo, antigo: antigo, novo: novo });
    });
    return alteradas;
  }

  /* PUBLICAR: valida antes (validarRegras) — nunca publica uma configuração
     que possa gerar erro de execução ou deixar de cobrir alguma
     combinação. Cria versão NOVA (nunca sobrescreve), grava auditoria,
     limpa o rascunho — um único update() atômico.

     SEM MUDANÇA NENHUMA (alteradas.length === 0) é NO-OP de propósito —
     nunca cria uma versão nova, nunca versiona motorVersionArquitetura.
     Achado real: publicar um rascunho idêntico ao publicado (ex.: abrir
     "Editar regras" só para olhar, sem mudar nada, e clicar em PUBLICAR)
     incrementava versaoPublicada mesmo sem diferença alguma — o que
     marcava de novo como "Motor desatualizado" TODA avaliação que
     acabara de ser reprocessada com a versão anterior, sem que a
     classificação de ninguém tivesse mudado. Só limpa o rascunho
     pendente (ele já é idêntico ao publicado, não há por que mantê-lo
     como pendente) e devolve a MESMA versão em info.novaVersao. */
  function publicarRegras(regras, usuario, cb) {
    var erros = validarRegras({ regras: regras });
    if (erros.length) { cb('validacao', erros); return; }
    var versaoAntiga = versaoAtual();
    var regrasAntigas = regrasDaVersao(versaoAntiga).regras;
    var alteradas = diffRegras(regrasAntigas, regras);
    if (!alteradas.length) {
      db().ref(NODE_CONFIG + '/rascunho').remove(function (err) {
        if (cb) cb(err || null, { novaVersao: versaoAntiga, alteradas: [], semMudanca: true });
      });
      return;
    }
    var novaVersao = versaoAntiga + 1;
    var agora = new Date().toISOString();
    var updates = {};
    updates[NODE_CONFIG + '/versaoPublicada'] = novaVersao;
    updates[NODE_CONFIG + '/versoes/' + novaVersao] = { regras: regras, publicadoEm: agora, publicadoPor: usuario || null };
    updates[NODE_CONFIG + '/rascunho'] = null;
    alteradas.forEach(function (alt) {
      var chave = db().ref(NODE_AUDITORIA).push().key;
      updates[NODE_AUDITORIA + '/' + chave] = {
        tipo: 'regra', campo: alt.codigo,
        valorAnterior: JSON.stringify(alt.antigo), valorNovo: JSON.stringify(alt.novo),
        usuario: usuario || null, dataHora: agora, versaoAnterior: versaoAntiga, novaVersao: novaVersao
      };
    });
    db().ref().update(updates, function (err) {
      if (cb) cb(err || null, { novaVersao: novaVersao, alteradas: alteradas });
    });
  }

  function publicarVersaoAnterior(versaoAlvo, usuario, cb) {
    var regras = regrasDaVersao(versaoAlvo).regras;
    if (!regras) { cb('versao-nao-encontrada'); return; }
    publicarRegras(JSON.parse(JSON.stringify(regras)), usuario, cb);
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
    avaliarCondicao: avaliarCondicao,
    identificarCamada: identificarCamada,
    simular: simular,
    validarRegras: validarRegras,
    onMudanca: onMudanca,
    versaoAtual: versaoAtual,
    regrasDaVersao: regrasDaVersao,
    textosAtuais: textosAtuais,
    conteudoTexto: conteudoTexto,
    rascunhoRegrasAtual: rascunhoRegrasAtual,
    iniciarOuObterRascunhoRegras: iniciarOuObterRascunhoRegras,
    salvarRascunhoRegras: salvarRascunhoRegras,
    descartarRascunhoRegras: descartarRascunhoRegras,
    diffRegras: diffRegras,
    publicarRegras: publicarRegras,
    publicarVersaoAnterior: publicarVersaoAnterior,
    listarVersoes: listarVersoes,
    salvarTextos: salvarTextos,
    situacao: situacao,
    auditoria: auditoria
  };
})();
