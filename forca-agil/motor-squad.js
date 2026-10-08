/* ============================================================
   Força Ágil — Motor de Interpretação da Adequação à Gestão por Squad
   (window.faMotorSquad)

   Interpreta as respostas S1–S8 (ver avaliacao-squad.js/questionarios-config.js)
   e produz uma INDICAÇÃO ORGANIZACIONAL de apoio à decisão — nunca uma
   decisão automática de criar, manter ou extinguir uma squad.

   Dois eixos, sempre calculados e preservados SEPARADAMENTE, e só depois
   combinados numa terceira regra:
     Eixo A — necessidadeCapacidadeDedicada: há trabalho contínuo, evolução,
       priorização e relevância suficientes para justificar capacidade
       dedicada? (S1, S2, S4, S5)
     Eixo B — condicoesParaSquad: existem indicadores, conhecimento,
       autonomia e ownership suficientes para uma squad atuar efetivamente?
       (S3, S6, S7, S8)
     indicacaoOrganizacional: combina os dois eixos acima — nunca lê S1-S8
       diretamente.

   PRINCÍPIO FUNDAMENTAL — este motor NÃO usa peso numérico, pontuação,
   score, percentual, soma de respostas SIM, maioria nem votação. Usa só
   CONDIÇÕES LÓGICAS + PRECEDÊNCIA EXPLÍCITA (a primeira regra, na ordem
   configurada, cujas condições sejam satisfeitas, decide — exatamente o
   mesmo princípio de identificarCamada em avaliacao-produto.js, nunca
   compartilhando regras com ele: só o formato de "precedência sobre
   condições booleanas" é comum às duas ideias, não o código).

   INDEPENDÊNCIA DA ARQUITETURA — este motor nunca lê nem escreve
   identificarCamada, motorVersion, classificacaoArquitetural,
   especializacaoPara ou papelEstruturalPara. Nunca existe regra
   "Produto/Serviço principal = squad" nem "Unidade de Valor = não squad".
   A classificação arquitetural pode aparecer como CONTEXTO na tela (ver
   avaliacao-squad.js), mas nunca entra numa condição deste motor.

   Perguntas usadas por CÓDIGO ESTÁVEL, nunca por texto (mesmo princípio de
   codigoEstavel em questionarios-config.js — o texto da pergunta pode ser
   reescrito livremente sem afetar nenhuma condição aqui):
     Eixo A: S1 (demanda contínua), S2 (backlog próprio de evolução),
       S4 (decisões próprias de priorização), S5 (volume/complexidade/
       criticidade).
     Eixo B: S3 (indicadores próprios), S6 (conhecimento/capacidades
       estáveis), S7 (autonomia da equipe — tratamento estrutural
       explícito, com PRECEDÊNCIA sobre as demais regras do eixo: S7=NÃO
       decide sozinho, antes de olhar pra qualquer outra pergunta do
       eixo), S8 (ownership claro).

   REGRAS DECLARATIVAS, NUNCA JAVASCRIPT ARBITRÁRIO — as 10 regras (A1-A3,
   B1-B3, C1-C5) são dados (JSON), não código: cada uma tem um código de
   IDENTIDADE (ex.: 'A1'), uma ORDEM (precedência) e uma CONDIÇÃO montada só
   com os operadores seguros all/any/not/equals (ver avaliarCondicao) — nunca
   eval, nunca new Function, nunca string executada como script. O
   INTÉRPRETE (avaliarCondicao/executarRegras) é o único código que decide o
   que uma condição significa; a regra em si é só dado, podendo vir de
   configuração publicada no Firebase (ver "GOVERNANÇA" abaixo).

   IDENTIDADE x APRESENTAÇÃO — assim como P1-P16 separam codigoEstavel do
   texto editorial (PR #238), aqui o CÓDIGO do veredito (ex.:
   'FORTE_ADERENCIA_SQUAD_DEDICADA') é imutável e nunca muda sozinho; o
   RÓTULO e a INTERPRETAÇÃO exibidos para esse código são parametrizáveis
   (ver textosAtuais/conteudoTexto) e podem ser reescritos livremente, A
   QUALQUER MOMENTO, sem criar nova motorSquadVersion e sem recalcular
   nenhum resultado já persistido — o texto é sempre resolvido AO VIVO pelo
   código já gravado na avaliação, nunca fixado num snapshot por resposta
   (diferença deliberada em relação ao texto das PERGUNTAS S1-S8, que É
   snapshotado por resposta em avaliacao-squad.js: o código do veredito, ao
   contrário do texto de uma pergunta, só muda quando a REGRA muda — e isso
   sim cria uma motorSquadVersion nova).

   GOVERNANÇA (RASCUNHO → SIMULAÇÃO → PUBLICAÇÃO) — Node no Firebase:
   motor-squad-config = {
     versaoPublicada: número da versão vigente das REGRAS — é isto que
       avaliacao-squad.js grava como motorSquadVersion em cada avaliação
       concluída/reprocessada; TOTALMENTE independente de motorVersion (do
       motor arquitetural) e de questionnaireContentVersion (do texto das
       perguntas S1-S8): mudar só a redação de uma pergunta NUNCA muda isto;
       mudar uma condição lógica das regras SEMPRE cria uma versão nova,
     versoes: { "<n>": { regras: {eixoA:[...], eixoB:[...], combinacao:[...]},
       publicadoEm, publicadoPor } } — cada publicação cria uma entrada NOVA,
       nenhuma é sobrescrita ou apagada (mesmo padrão de
       questionarios-config.js),
     rascunho: { regras, atualizadoEm, atualizadoPor } | null — edição de
       REGRAS em andamento; só passa a valer depois de simulada e publicada,
     textos: { <codigoVeredito>: {rotulo, interpretacao} } — conteúdo
       editorial dos vereditos, editável e publicado IMEDIATAMENTE (nunca
       precisa de simulação, porque não muda nenhum resultado já calculado,
       só a redação exibida) — eixo TOTALMENTE separado de versaoPublicada.
   }
   motor-squad-auditoria/<pushKey> = { tipo: 'regra'|'texto', campo,
     valorAnterior, valorNovo, usuario, dataHora, versaoAnterior, novaVersao }
     — uma entrada por alteração, nunca apagável por esta aplicação.

   Quando o node ainda não existe (instalação nova, nenhuma publicação
   feita), versaoAtual/regrasDaVersao/textosAtuais caem no conteúdo de
   FÁBRICA definido em PADRAO_REGRAS/PADRAO_TEXTOS abaixo — literalmente as
   10 regras e os textos especificados no pedido original, nunca inventados.

   SIMULAÇÃO — antes de publicar uma nova versão de regras, simular(...)
   roda a REGRA CANDIDATA (ainda não publicada) e a REGRA JÁ PUBLICADA sobre
   as MESMAS avaliações já concluídas (a função é pura: recebe as
   avaliações como parâmetro, nunca lê nem grava nada no Firebase, nunca
   modifica nenhuma avaliação histórica) e devolve só o impacto — quantas
   manteriam o mesmo resultado, quantas mudariam, e quais.

   REPROCESSAMENTO — ação explícita, feita por avaliacao-squad.js (que tem
   acesso a avaliacoes-squad no Firebase; este módulo nunca lê esse node):
   preserva respostas/justificativas/snapshot e o resultado histórico
   anterior (historicoMotorSquad), grava o novo resultado + nova
   motorSquadVersion + auditoria. Nunca acontece sozinho quando uma nova
   versão é publicada — só quando alguém aciona "REPROCESSAR COM MOTOR DE
   SQUAD ATUAL" numa avaliação específica. */
(function () {
  var NODE_CONFIG = 'motor-squad-config';
  var NODE_AUDITORIA = 'motor-squad-auditoria';

  function db() { return firebase.database(); }

  /* ===================== REGRAS E TEXTOS DE FÁBRICA ===================== */
  /* Literalmente as 10 regras do pedido original — nunca uma aproximação.
     Cada condição usa só os operadores seguros do interpretador
     (all/any/not/equals — ver avaliarCondicao); "campo" identifica ou uma
     pergunta (S1-S8) ou um resultado de eixo já calculado
     (necessidadeCapacidadeDedicada/condicoesParaSquad), nunca um texto de
     pergunta. */
  var PADRAO_REGRAS = {
    eixoA: [
      { codigo: 'A1', ordem: 1, resultado: 'DEMONSTRADA', condicoes: { all: [
        { campo: 'S1', valor: 'SIM' }, { campo: 'S2', valor: 'SIM' },
        { campo: 'S4', valor: 'SIM' }, { campo: 'S5', valor: 'SIM' }
      ] } },
      { codigo: 'A2', ordem: 2, resultado: 'PARCIALMENTE_DEMONSTRADA', condicoes: { all: [
        { campo: 'S1', valor: 'SIM' }, { campo: 'S2', valor: 'SIM' },
        { any: [{ campo: 'S4', valor: 'NAO' }, { campo: 'S5', valor: 'NAO' }] }
      ] } },
      { codigo: 'A3', ordem: 3, resultado: 'NAO_DEMONSTRADA', condicoes: { any: [
        { campo: 'S1', valor: 'NAO' }, { campo: 'S2', valor: 'NAO' }
      ] } }
    ],
    /* B1 primeiro na ordem: tratamento ESTRUTURAL explícito de S7 (item 6 do
       pedido) — precedência sobre B2/B3, nunca um peso a mais somado com os
       outros três sinais do eixo. */
    eixoB: [
      { codigo: 'B1', ordem: 1, resultado: 'LIMITADAS_PELA_AUTONOMIA', condicoes: { all: [
        { campo: 'S7', valor: 'NAO' }
      ] } },
      { codigo: 'B2', ordem: 2, resultado: 'PRESENTES', condicoes: { all: [
        { campo: 'S7', valor: 'SIM' }, { campo: 'S3', valor: 'SIM' },
        { campo: 'S6', valor: 'SIM' }, { campo: 'S8', valor: 'SIM' }
      ] } },
      { codigo: 'B3', ordem: 3, resultado: 'PARCIAIS', condicoes: { all: [
        { campo: 'S7', valor: 'SIM' },
        { any: [{ campo: 'S3', valor: 'NAO' }, { campo: 'S6', valor: 'NAO' }, { campo: 'S8', valor: 'NAO' }] }
      ] } }
    ],
    /* Nunca lê S1-S8 diretamente — só os dois resultados de eixo já
       calculados (contrato explícito de executarMotor abaixo). */
    combinacao: [
      { codigo: 'C1', ordem: 1, resultado: 'FORTE_ADERENCIA_SQUAD_DEDICADA', condicoes: { all: [
        { campo: 'necessidadeCapacidadeDedicada', valor: 'DEMONSTRADA' },
        { campo: 'condicoesParaSquad', valor: 'PRESENTES' }
      ] } },
      { codigo: 'C2', ordem: 2, resultado: 'JUSTIFICA_CAPACIDADE_COM_CONDICOES_A_DESENVOLVER', condicoes: { all: [
        { campo: 'necessidadeCapacidadeDedicada', valor: 'DEMONSTRADA' },
        { campo: 'condicoesParaSquad', valor: 'PARCIAIS' }
      ] } },
      { codigo: 'C3', ordem: 3, resultado: 'JUSTIFICA_CAPACIDADE_MAS_AUTONOMIA_PRECISA_SER_TRATADA', condicoes: { all: [
        { campo: 'necessidadeCapacidadeDedicada', valor: 'DEMONSTRADA' },
        { campo: 'condicoesParaSquad', valor: 'LIMITADAS_PELA_AUTONOMIA' }
      ] } },
      { codigo: 'C4', ordem: 4, resultado: 'AVALIAR_MODELO_GESTAO_ANTES_DE_SQUAD_EXCLUSIVA', condicoes: { all: [
        { campo: 'necessidadeCapacidadeDedicada', valor: 'PARCIALMENTE_DEMONSTRADA' }
      ] } },
      { codigo: 'C5', ordem: 5, resultado: 'NECESSIDADE_SQUAD_DEDICADA_NAO_DEMONSTRADA', condicoes: { all: [
        { campo: 'necessidadeCapacidadeDedicada', valor: 'NAO_DEMONSTRADA' }
      ] } }
    ]
  };

  var PADRAO_TEXTOS = {
    DEMONSTRADA: { rotulo: 'Demonstrada',
      interpretacao: 'Há evidências de demanda contínua, evolução própria, necessidade recorrente de priorização e volume, complexidade ou criticidade suficientes para sustentar capacidade dedicada.' },
    PARCIALMENTE_DEMONSTRADA: { rotulo: 'Parcialmente demonstrada',
      interpretacao: 'Há demanda contínua e evolução própria, mas ainda faltam evidências suficientes de priorização recorrente e/ou volume, complexidade ou criticidade para sustentar dedicação exclusiva.' },
    NAO_DEMONSTRADA: { rotulo: 'Não demonstrada',
      interpretacao: 'As respostas não demonstram simultaneamente demanda contínua e backlog próprio de evolução suficientes para justificar capacidade dedicada.' },
    LIMITADAS_PELA_AUTONOMIA: { rotulo: 'Limitadas pela autonomia',
      interpretacao: 'A equipe teria dependência relevante de outras estruturas para conseguir melhorar seus resultados. A autonomia precisa ser tratada para que o modelo de squad funcione efetivamente.' },
    PRESENTES: { rotulo: 'Presentes',
      interpretacao: 'Existem indicadores próprios, conhecimentos relativamente estáveis, autonomia e ownership suficientes para sustentar a atuação de uma squad.' },
    PARCIAIS: { rotulo: 'Parciais',
      interpretacao: 'Há autonomia para atuação, mas existem condições organizacionais que ainda precisam ser desenvolvidas.' },
    FORTE_ADERENCIA_SQUAD_DEDICADA: { rotulo: 'Forte aderência à gestão por squad dedicada',
      interpretacao: 'A avaliação demonstra necessidade de capacidade dedicada e condições organizacionais favoráveis para atuação de uma squad.' },
    JUSTIFICA_CAPACIDADE_COM_CONDICOES_A_DESENVOLVER: { rotulo: 'Há justificativa para capacidade dedicada, com condições organizacionais a desenvolver',
      interpretacao: 'A demanda e a evolução justificam capacidade dedicada, mas algumas condições necessárias para o funcionamento efetivo de uma squad ainda precisam ser desenvolvidas.' },
    JUSTIFICA_CAPACIDADE_MAS_AUTONOMIA_PRECISA_SER_TRATADA: { rotulo: 'Há justificativa para capacidade dedicada, mas a autonomia precisa ser tratada',
      interpretacao: 'Existe justificativa para dedicação de capacidade, porém a dependência de outras estruturas limita o funcionamento efetivo de uma squad.' },
    AVALIAR_MODELO_GESTAO_ANTES_DE_SQUAD_EXCLUSIVA: { rotulo: 'Avaliar o modelo de gestão antes de dedicar uma squad exclusiva',
      interpretacao: 'Há sinais de demanda e evolução, mas a necessidade de capacidade exclusiva ainda não está suficientemente demonstrada.' },
    NECESSIDADE_SQUAD_DEDICADA_NAO_DEMONSTRADA: { rotulo: 'A necessidade de uma squad dedicada não está demonstrada',
      interpretacao: 'A avaliação atual não demonstra simultaneamente demanda contínua e backlog próprio de evolução suficientes para justificar dedicação exclusiva.' }
  };

  /* ===================== INTÉRPRETE SEGURO (SEM eval) =====================
     Só 4 operadores, todos fechados: all (E lógico de uma lista), any (OU
     lógico), not (negação), e a folha {campo, valor} (equivalente a um
     "equals" — aceita também {equals:{campo,valor}} e o sinônimo
     {pergunta,resposta}, só para casar com a notação do pedido original).
     Nunca interpreta string como código; nunca chama eval/new Function;
     "campo" é sempre uma chave já normalizada do contexto (S1-S8 ou um
     resultado de eixo), nunca um caminho arbitrário. */
  function normalizarValor(v) {
    return String(v == null ? '' : v).trim().toUpperCase();
  }
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

  /* Executa uma lista de regras ORDENADAS (precedência: a primeira cujas
     condições batem decide, nunca uma votação entre as que baterem) —
     usado igualmente para eixoA, eixoB e combinacao. Nunca lança exceção
     mesmo com uma configuração mal formada (regras vindas de edição
     administrativa) — sem nenhuma regra aplicável, devolve INDETERMINADO e
     registra no console, em vez de travar a avaliação. */
  function executarRegras(regras, contexto, silencioso) {
    var ordenadas = (Array.isArray(regras) ? regras : []).slice().sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0); });
    for (var i = 0; i < ordenadas.length; i++) {
      if (avaliarCondicao(ordenadas[i].condicoes, contexto)) return ordenadas[i].resultado;
    }
    if (!silencioso) console.error('[motor-squad] nenhuma regra aplicável para o contexto:', contexto);
    return 'INDETERMINADO';
  }

  /* ===================== NORMALIZAÇÃO SEMÂNTICA PARA COMPARAÇÃO (diffRegras) =====================
     Mesmo princípio de motor-arquitetura.js (robustez de versionamento,
     nenhuma mudança de regra de negócio — mesmas condições S1-S8, mesma
     precedência, mesmos resultados A1-A3/B1-B3/C1-C5 intocados): diffRegras
     precisa comparar o SIGNIFICADO da regra para avaliarCondicao/
     executarRegras, nunca a serialização. Ordem das propriedades de um
     objeto e ordem dos elementos dentro de all/any nunca criam diferença
     aqui; precedência entre regras (campo "ordem"), inclusão/remoção de
     regra, e mudança de condição/operador/pergunta/valor esperado/
     resultado continuam detectados normalmente. */
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
    if (cond.not) return { not: normalizarCondicaoParaComparacao(cond.not) };
    if (cond.equals) return normalizarCondicaoParaComparacao(cond.equals);
    var campo = cond.campo || cond.pergunta;
    var valor = cond.valor != null ? cond.valor : cond.resposta;
    return { campo: campo || null, valor: normalizarValor(valor) };
  }
  /* Regra canônica: código, ordem (precedência), resultado e condicoes —
     todo o conteúdo lógico de uma regra deste motor (não há motivos/
     incoerencia/conflito aqui, ao contrário de motor-arquitetura.js). */
  function normalizarRegraParaComparacao(regra) {
    if (!regra) return null;
    return ordenarChavesProfundo({
      codigo: regra.codigo || null,
      ordem: regra.ordem != null ? regra.ordem : null,
      resultado: regra.resultado || null,
      condicoes: normalizarCondicaoParaComparacao(regra.condicoes)
    });
  }

  /* Contexto plano usado pelo intérprete: S1..S8 em 'SIM'/'NAO' (nunca o
     texto da pergunta — código estável só). Perguntas sem resposta (nunca
     deveria acontecer numa avaliação concluída, ver checklist obrigando as
     8) entram como '' — não bate com nenhuma condição SIM/NAO, então cai
     com segurança no braço "any NAO"/"all…" apropriado em vez de travar. */
  function construirContextoPerguntas(respostas) {
    var contexto = {};
    ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'].forEach(function (cod) {
      var r = respostas && respostas[cod];
      contexto[cod] = r && r.resposta ? normalizarValor(r.resposta) : '';
    });
    return contexto;
  }

  /* ===================== MOTOR PURO (sem Firebase, sem DOM) =====================
     Função central, testável isoladamente: dadas as respostas S1-S8 de UMA
     avaliação e um conjunto de regras (publicado ou candidato — quem chama
     decide qual), devolve os dois eixos, a recomendação de gestão por Squad
     (campo indicacaoOrganizacional) e as
     evidências/pontos a desenvolver — SEMPRE derivados das respostas reais,
     nunca de texto livre ou heurística fora das regras. */
  function identificarAdequacaoSquad(respostas, regras, silencioso) {
    var r = regras || PADRAO_REGRAS;
    var contextoPerguntas = construirContextoPerguntas(respostas);

    var necessidadeCapacidadeDedicada = executarRegras(r.eixoA, contextoPerguntas, silencioso);
    var condicoesParaSquad = executarRegras(r.eixoB, contextoPerguntas, silencioso);

    var contextoCombinacao = {
      necessidadeCapacidadeDedicada: necessidadeCapacidadeDedicada,
      condicoesParaSquad: condicoesParaSquad
    };
    var indicacaoOrganizacional = executarRegras(r.combinacao, contextoCombinacao, silencioso);

    var evidenciasFavoraveis = [];
    var pontosADesenvolver = [];
    ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'].forEach(function (cod) {
      if (contextoPerguntas[cod] === 'SIM') evidenciasFavoraveis.push(cod);
      else if (contextoPerguntas[cod] === 'NAO') pontosADesenvolver.push(cod);
    });

    return {
      necessidadeCapacidadeDedicada: necessidadeCapacidadeDedicada,
      condicoesParaSquad: condicoesParaSquad,
      indicacaoOrganizacional: indicacaoOrganizacional,
      evidenciasFavoraveis: evidenciasFavoraveis,
      pontosADesenvolver: pontosADesenvolver
    };
  }

  /* ===================== VALIDAÇÃO EXAUSTIVA (trava de publicação) =====================
     O editor deixa trocar o SIM/NÃO esperado de cada condição sobre S1-S8 —
     e QUALQUER uma dessas trocas, sozinha, pode deixar combinações completas
     de respostas sem regra aplicável (INDETERMINADO). A simulação só olha as
     avaliações já concluídas, então não pegava isso. Aqui o conjunto de
     regras candidato é rodado sobre as 256 combinações possíveis de S1-S8
     (2^8, todas respondidas) e cada uma precisa chegar a um código CONHECIDO
     em cada etapa: Eixo A, Eixo B e recomendação de gestão por Squad. Pura, sem
     Firebase: publicarRegras recusa publicar se ela não passar, e a tela de
     simulação mostra as combinações que falharam antes do botão. Os códigos
     válidos são os resultados das regras de fábrica — o editor muda QUAIS
     respostas levam a cada resultado, nunca cria um resultado novo. */
  var PERGUNTAS = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'];
  function resultadosDe(grupo) {
    var lista = PADRAO_REGRAS[grupo].map(function (r) { return r.resultado; });
    return lista;
  }
  var RESULTADOS_VALIDOS = {
    eixoA: resultadosDe('eixoA'),
    eixoB: resultadosDe('eixoB'),
    combinacao: resultadosDe('combinacao')
  };
  function combinacaoNumero(n) {
    var respostas = {};
    PERGUNTAS.forEach(function (cod, i) {
      respostas[cod] = { resposta: ((n >> (7 - i)) & 1) ? 'sim' : 'nao' };
    });
    return respostas;
  }
  function descreverCombinacao(respostas) {
    return PERGUNTAS.map(function (cod) { return cod + ' ' + (respostas[cod].resposta === 'sim' ? 'SIM' : 'NÃO'); }).join(' · ');
  }
  /* Campos que cada grupo pode ler — validação ESTRUTURAL, não regra de
     negócio. Os eixos leem só S1–S8; a combinação lê só os dois resultados
     de eixo. Qualquer outro nome (P1–P16, classificação arquitetural, Linha,
     Squad, CoE, Área Especializada, erro de digitação) é recusado: o
     executor o leria como vazio e a condição nunca valeria, escondendo o
     engano. Mesma proteção que o validador do motor arquitetural já tem
     (CAMPOS_VALIDOS em motor-arquitetura.js). */
  var CAMPOS_COMBINACAO = { necessidadeCapacidadeDedicada: 'eixoA', condicoesParaSquad: 'eixoB' };
  var PERGUNTAS_ARQUITETURAIS = /^P([1-9]|1[0-6])$/;
  var CAMPOS_DE_OUTRO_EIXO = ['CLASSIFICACAO', 'LINHA', 'SQUAD', 'COE', 'AREA_ESPECIALIZADA'];
  function motivoCampoInvalido(campo) {
    if (PERGUNTAS_ARQUITETURAIS.test(campo)) return '"' + campo + '" é pergunta do motor arquitetural (P1–P16), não do motor de squad';
    if (CAMPOS_DE_OUTRO_EIXO.indexOf(String(campo).toUpperCase()) !== -1) return '"' + campo + '" é classificação arquitetural ou estrutura organizacional, e nunca entra no motor de squad';
    return '"' + campo + '" não existe no motor de squad';
  }
  function validarCamposDaCondicao(cond, grupo, nomeRegra, erros) {
    if (!cond || typeof cond !== 'object') { erros.push('A regra ' + nomeRegra + ' (' + grupo + ') tem uma condição vazia ou inválida.'); return; }
    if (Array.isArray(cond.all) || Array.isArray(cond.any)) {
      var lista = cond.all || cond.any;
      if (!lista.length) erros.push('A regra ' + nomeRegra + ' (' + grupo + ') tem um grupo de condições vazio.');
      lista.forEach(function (c) { validarCamposDaCondicao(c, grupo, nomeRegra, erros); });
      return;
    }
    if (cond.not) { validarCamposDaCondicao(cond.not, grupo, nomeRegra, erros); return; }
    if (cond.equals) { validarCamposDaCondicao(cond.equals, grupo, nomeRegra, erros); return; }
    var campo = cond.campo || cond.pergunta;
    var valor = normalizarValor(cond.valor != null ? cond.valor : cond.resposta);
    if (!campo) { erros.push('A regra ' + nomeRegra + ' (' + grupo + ') tem uma condição sem pergunta.'); return; }
    if (grupo === 'combinacao') {
      var eixo = CAMPOS_COMBINACAO[campo];
      if (!eixo) {
        var porque = PERGUNTAS.indexOf(campo) !== -1 ? '"' + campo + '", que é pergunta (as perguntas só entram nos eixos A e B)' : motivoCampoInvalido(campo);
        erros.push('A regra ' + nomeRegra + ' (combinacao) usa ' + porque + ' — a combinação só lê os resultados dos eixos A e B.');
        return;
      }
      if (RESULTADOS_VALIDOS[eixo].indexOf(valor) === -1) erros.push('A regra ' + nomeRegra + ' (combinacao) compara ' + campo + ' com um resultado que não existe: ' + valor + '.');
      return;
    }
    if (PERGUNTAS.indexOf(campo) === -1) { erros.push('A regra ' + nomeRegra + ' (' + grupo + ') usa ' + motivoCampoInvalido(campo) + ' — só S1 a S8 são aceitas.'); return; }
    if (valor !== 'SIM' && valor !== 'NAO') erros.push('A regra ' + nomeRegra + ' (' + grupo + ') compara ' + campo + ' com "' + valor + '" — só SIM ou NÃO.');
  }
  function validarRegrasCompletas(regras) {
    var estrutura = [];
    if (!regras || typeof regras !== 'object') {
      estrutura.push('Não há conjunto de regras.');
    } else {
      ['eixoA', 'eixoB', 'combinacao'].forEach(function (grupo) {
        var lista = regras[grupo];
        if (!Array.isArray(lista) || !lista.length) { estrutura.push('O grupo ' + grupo + ' não tem regras.'); return; }
        lista.forEach(function (r) {
          if (!r || RESULTADOS_VALIDOS[grupo].indexOf(r.resultado) === -1) {
            estrutura.push('A regra ' + ((r && r.codigo) || '?') + ' (' + grupo + ') tem um resultado desconhecido: ' + (r && r.resultado));
          }
          if (!r || !r.condicoes || typeof r.condicoes !== 'object') {
            estrutura.push('A regra ' + ((r && r.codigo) || '?') + ' (' + grupo + ') não tem condições.');
          } else {
            validarCamposDaCondicao(r.condicoes, grupo, r.codigo || '?', estrutura);
          }
        });
      });
    }
    var invalidas = [];
    if (!estrutura.length) {
      for (var n = 0; n < 256; n++) {
        var respostas = combinacaoNumero(n);
        var r = identificarAdequacaoSquad(respostas, regras, true);
        var falhou = [];
        if (RESULTADOS_VALIDOS.eixoA.indexOf(r.necessidadeCapacidadeDedicada) === -1) falhou.push('Eixo A');
        if (RESULTADOS_VALIDOS.eixoB.indexOf(r.condicoesParaSquad) === -1) falhou.push('Eixo B');
        if (RESULTADOS_VALIDOS.combinacao.indexOf(r.indicacaoOrganizacional) === -1) falhou.push('Recomendação de gestão por Squad');
        if (falhou.length) {
          invalidas.push({
            respostas: descreverCombinacao(respostas), semResultadoEm: falhou,
            necessidadeCapacidadeDedicada: r.necessidadeCapacidadeDedicada,
            condicoesParaSquad: r.condicoesParaSquad,
            indicacaoOrganizacional: r.indicacaoOrganizacional
          });
        }
      }
    }
    return { valida: !estrutura.length && !invalidas.length, totalCombinacoes: 256, estrutura: estrutura, invalidas: invalidas };
  }

  /* ===================== SIMULAÇÃO (item 15 do pedido) =====================
     Pura, só leitura: recebe as avaliações CONCLUÍDAS já carregadas por
     quem chama (avaliacao-squad.js já tem esse array em memória — este
     módulo nunca lê avaliacoes-squad sozinho) e a regra CANDIDATA (ainda
     não publicada); recalcula cada uma com a regra já publicada e com a
     candidata, e devolve só o IMPACTO — nunca modifica nada. */
  function simular(regrasCandidatas, avaliacoesConcluidas) {
    var regrasAtuais = regrasDaVersao(versaoAtual());
    var mudariam = [];
    (avaliacoesConcluidas || []).forEach(function (av) {
      var atual = identificarAdequacaoSquad(av.respostas, regrasAtuais);
      var nova = identificarAdequacaoSquad(av.respostas, regrasCandidatas);
      if (atual.indicacaoOrganizacional !== nova.indicacaoOrganizacional) {
        mudariam.push({
          _key: av._key, itemNome: av.itemNome,
          atual: atual.indicacaoOrganizacional, nova: nova.indicacaoOrganizacional
        });
      }
    });
    var total = (avaliacoesConcluidas || []).length;
    return { totalAnalisadas: total, mantidas: total - mudariam.length, mudariam: mudariam };
  }

  /* ===================== GOVERNANÇA (RASCUNHO → SIMULAÇÃO → PUBLICAÇÃO) =====================
     Mesmo padrão de questionarios-config.js, adaptado para um único
     conjunto de regras (não há "código de questionário" aqui — só um
     motor). cache/carregado/listeners: um único listener no Firebase,
     nunca duplicado mesmo com várias telas interessadas. */
  var cache = null;
  var carregado = false;
  var listeners = [];
  /* Estado da LEITURA de motor-squad-config — "ainda não sei" nunca é "não
     há nada publicado": enquanto a primeira resposta não chega, versaoAtual()
     cairia na versão 1 de fábrica, e uma avaliação concluída nesse intervalo
     (rede lenta, celular na sala) seria interpretada com regras que podem já
     não valer e carimbada com a versão errada, sem aviso. Por isso quem
     INTERPRETA (avaliacao-squad.js) pergunta antes estadoCarga():
       'carregando' — pedido feito, nenhuma resposta ainda;
       'carregado'  — resposta recebida (com ou sem versão publicada; só
                      AGORA "nada publicado" significa de fato a versão 1);
       'erro'       — a leitura foi recusada/falhou; recarregar() tenta de novo.
     carregandoDesde: quando o pedido atual começou — a tela usa para avisar
     que está demorando e oferecer "Tentar novamente". */
  var estado = 'carregando';
  var carregandoDesde = Date.now();
  var refOuvinte = null, cbOuvinte = null;

  function avisar() { listeners.slice().forEach(function (cb) { cb(); }); }
  function ligarOuvinte() {
    estado = 'carregando';
    carregandoDesde = Date.now();
    refOuvinte = db().ref(NODE_CONFIG);
    cbOuvinte = refOuvinte.on('value', function (snap) {
      cache = snap.val();
      estado = 'carregado';
      avisar();
    }, function (err) {
      console.error('[motor-squad] não foi possível ler as regras do motor de squad:', err);
      estado = 'erro';
      avisar();
    });
  }
  function garantirSync() {
    if (carregado) return;
    carregado = true;
    ligarOuvinte();
  }
  /* Tentar de novo depois de um erro (ou de uma leitura que não volta):
     desliga o ouvinte anterior e pede de novo. O cache já recebido, se
     houver, continua valendo até a nova resposta. */
  function recarregar() {
    if (!carregado) { garantirSync(); return; }
    if (refOuvinte) refOuvinte.off('value', cbOuvinte);
    ligarOuvinte();
    avisar();
  }
  function estadoCarga() { return estado; }
  function msCarregando() { return estado === 'carregando' ? Date.now() - carregandoDesde : 0; }
  function onMudanca(cb) {
    garantirSync();
    listeners.push(cb);
  }

  function versaoAtual() {
    return (cache && cache.versaoPublicada) || 1;
  }
  function regrasDaVersao(versao) {
    var v = versao || versaoAtual();
    if (cache && cache.versoes && cache.versoes[v] && cache.versoes[v].regras) return cache.versoes[v].regras;
    /* v1 de fábrica nunca é gravada explicitamente — mesmo princípio de
       questionarios-config.js (PADRAO como fallback de leitura, nunca
       inventado). */
    return PADRAO_REGRAS;
  }
  function textosAtuais() {
    var t = (cache && cache.textos) || {};
    /* Mescla com o padrão: um texto ainda não customizado continua
       mostrando a redação de fábrica, nunca um campo vazio. */
    var mesclado = {};
    Object.keys(PADRAO_TEXTOS).forEach(function (cod) { mesclado[cod] = PADRAO_TEXTOS[cod]; });
    Object.keys(t).forEach(function (cod) { mesclado[cod] = t[cod]; });
    return mesclado;
  }
  function conteudoTexto(codigo) {
    return textosAtuais()[codigo] || { rotulo: codigo, interpretacao: '' };
  }

  function rascunhoRegrasAtual() {
    return (cache && cache.rascunho) || null;
  }
  function iniciarOuObterRascunhoRegras() {
    var existente = rascunhoRegrasAtual();
    if (existente && existente.regras) return JSON.parse(JSON.stringify(existente.regras));
    return JSON.parse(JSON.stringify(regrasDaVersao(versaoAtual())));
  }
  /* versaoBase: mesmo mecanismo de motor-arquitetura.js — a versão
     publicada vigente quando o rascunho começou a ser editado, gravada UMA
     VEZ e preservada em toda gravação seguinte do MESMO rascunho, usada
     por publicarRegras para detectar concorrência (ver lá). */
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

  /* Diff para auditoria de REGRAS: compara o SIGNIFICADO de cada regra (por
     código, por grupo) entre a versão antiga e a nova — via
     normalizarRegraParaComparacao (ver acima), nunca a serialização bruta,
     então ordem das propriedades de um objeto e ordem dos elementos dentro
     de all/any nunca geram uma entrada; qualquer mudança real de condição,
     ordem (precedência) ou resultado continua gerando uma. Sempre pela
     UNIÃO dos códigos dos dois lados, nunca só pelo lado novo — uma regra
     REMOVIDA (existia antes, sumiu no rascunho) é tão mudança lógica quanto
     uma adicionada ou modificada. rotulo/interpretacao de cada veredito
     nunca moram aqui — vivem em textos/PADRAO_TEXTOS, publicados por
     salvarTextos (função separada que nunca chama publicarRegras nem toca
     em versaoPublicada), então uma edição textual nunca aparece neste
     diff. alteradas guarda os objetos ORIGINAIS (não canônicos) de
     antigo/novo — é o que a auditoria mostra ao usuário. */
  function diffRegras(regrasAntigas, regrasNovas) {
    var alteradas = [];
    ['eixoA', 'eixoB', 'combinacao'].forEach(function (grupo) {
      var porCodigoAntigo = {}, porCodigoNovo = {};
      (regrasAntigas[grupo] || []).forEach(function (r) { porCodigoAntigo[r.codigo] = r; });
      (regrasNovas[grupo] || []).forEach(function (r) { porCodigoNovo[r.codigo] = r; });
      var todosCodigos = {};
      Object.keys(porCodigoAntigo).forEach(function (c) { todosCodigos[c] = true; });
      Object.keys(porCodigoNovo).forEach(function (c) { todosCodigos[c] = true; });
      Object.keys(todosCodigos).forEach(function (codigo) {
        var antigo = porCodigoAntigo[codigo] || null;
        var novo = porCodigoNovo[codigo] || null;
        var antigoCanonico = normalizarRegraParaComparacao(antigo);
        var novoCanonico = normalizarRegraParaComparacao(novo);
        if (JSON.stringify(antigoCanonico) !== JSON.stringify(novoCanonico)) {
          alteradas.push({ grupo: grupo, codigo: codigo, antigo: antigo, novo: novo });
        }
      });
    });
    return alteradas;
  }

  /* Registrada quando uma publicação é rejeitada por concorrência (ver
     publicarRegras) — nunca cria versão nova, só documenta a tentativa
     bloqueada, incluindo se ela PARECIA um no-op do ponto de vista de quem
     chamou (origem) — só diagnóstico, nunca decide nada. */
  function registrarConflitoPublicacao(versaoBase, versaoAtualServidor, usuario, origem, cb) {
    var agora = new Date().toISOString();
    var updates = {};
    updates[NODE_AUDITORIA + '/' + db().ref(NODE_AUDITORIA).push().key] = {
      tipo: 'conflito_publicacao', campo: null, valorAnterior: null, valorNovo: null,
      usuario: usuario || null, dataHora: agora, versaoBase: versaoBase, versaoAtual: versaoAtualServidor, origem: origem
    };
    db().ref().update(updates, function (err) { if (cb) cb(err || null); });
  }

  /* PUBLICAR REGRAS: cria uma versão NOVA (nunca sobrescreve), aponta
     versaoPublicada pra ela, limpa o rascunho e grava auditoria. É isto, e
     só isto, que avança motorSquadVersion; nunca chamado por uma edição de
     textos.

     TUDO — decidir se é NO-OP ou mudança real, e gravar o resultado — é
     feito DENTRO de uma ÚNICA transaction() do Firebase sobre NODE_CONFIG,
     mesmo mecanismo de motor-arquitetura.js (correção complementar à PR
     #243): o caminho de no-op, sozinho, comparava contra a versão do CACHE
     LOCAL e fazia um update() incondicional — entre a comparação e a
     gravação, outra pessoa podia publicar uma mudança real, e o rascunho
     seria descartado mesmo deixando de ser, de fato, equivalente ao que
     passou a estar publicado. Agora o updateFn recebe o valor ATUAL do
     servidor no momento do commit, recalcula diffRegras contra as regras
     REALMENTE vigentes NESSE INSTANTE e só então decide:
       - diferença vazia (equivalente ao que está publicado AGORA, mesmo
         que a versão tenha mudado depois da primeira comparação) → NO-OP:
         limpa o rascunho, mantém a mesma versaoPublicada, nunca cria
         versão nova, nunca avança motorSquadVersion — vale tanto se
         ninguém mais publicou nada quanto se outra pessoa publicou algo
         que, por coincidência, é semanticamente igual ao rascunho;
       - diferença real E versaoPublicada do servidor ainda bate com
         versaoBase → publica de verdade: cria versão nova, grava
         auditoria tipo 'regra';
       - diferença real mas versaoPublicada do servidor NÃO bate mais com
         versaoBase → aborta sem gravar nada — nunca descarta o rascunho
         nem sobrescreve a versão alheia; rejeitado com
         cb('conflito', {versaoBase, versaoAtual}) e uma auditoria tipo
         'conflito_publicacao'. */
  function publicarRegras(regras, usuario, cb, versaoBase) {
    /* Trava antes de qualquer gravação: um conjunto de regras que deixe
       alguma das 256 combinações completas sem resultado nunca vira versão
       publicada (nem nova versão, nem auditoria, nem rascunho apagado). */
    var validacao = validarRegrasCompletas(regras);
    if (!validacao.valida) { if (cb) cb('regras-invalidas', validacao); return; }
    var baseEsperada = versaoBase != null ? versaoBase : versaoAtual();
    var pareciaNoOpLocalmente = diffRegras(regrasDaVersao(versaoAtual()), regras).length === 0;
    var agora = new Date().toISOString();
    var alteradasReais = null;
    var eraNoOp = false;
    db().ref(NODE_CONFIG).transaction(function (atual) {
      var cfg = atual || {};
      var versaoServidor = cfg.versaoPublicada || 1;
      var regrasVigentes = (cfg.versoes && cfg.versoes[versaoServidor] && cfg.versoes[versaoServidor].regras) || PADRAO_REGRAS;
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
          tipo: 'regra', campo: alt.grupo + '.' + alt.codigo,
          valorAnterior: JSON.stringify(alt.antigo), valorNovo: JSON.stringify(alt.novo),
          usuario: usuario || null, dataHora: agora, versaoAnterior: baseEsperada, novaVersao: versaoServidorFinal
        };
      });
      db().ref().update(updatesAuditoria, function (errAud) {
        if (cb) cb(errAud || null, { novaVersao: versaoServidorFinal, alteradas: alteradasReais });
      });
    });
  }

  /* "Rollback": publica o CONJUNTO DE REGRAS de uma versão antiga como uma
     versão NOVA — nunca apaga nem reescreve versões existentes, e nunca
     toca em avaliações já concluídas (elas continuam com o
     motorSquadVersion e o resultado que já tinham). Sempre publicado
     contra a versão vigente AGORA — passada como versaoBase automaticamente
     — para ficar protegido pela mesma transaction de concorrência. */
  function publicarVersaoAnterior(versaoAlvo, usuario, cb) {
    var regras = regrasDaVersao(versaoAlvo);
    if (!regras) { cb('versao-nao-encontrada'); return; }
    publicarRegras(JSON.parse(JSON.stringify(regras)), usuario, cb, versaoAtual());
  }

  function listarVersoes() {
    var numeros = (cache && cache.versoes) ? Object.keys(cache.versoes).map(Number) : [];
    if (numeros.indexOf(1) === -1) numeros.push(1);
    return numeros.sort(function (a, b) { return a - b; });
  }

  /* TEXTOS: publicação IMEDIATA (sem rascunho/simulação — não muda nenhum
     resultado já calculado, só a redação exibida) — nunca toca em
     versaoPublicada/motorSquadVersion. Grava auditoria por código alterado,
     no MESMO node de auditoria das regras (tipo:'texto' distingue). */
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
        usuario: usuario || null, dataHora: agora,
        versaoAnterior: versaoAtual(), novaVersao: versaoAtual() /* textos não avançam versão */
      };
    });
    db().ref().update(updates, function (err) { if (cb) cb(err || null, { alterados: alterados }); });
  }

  function situacao() {
    var v = versaoAtual();
    var infoVersao = cache && cache.versoes && cache.versoes[v];
    return {
      versaoPublicada: v,
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

  window.faMotorSquad = {
    PADRAO_REGRAS: PADRAO_REGRAS,
    PADRAO_TEXTOS: PADRAO_TEXTOS,
    avaliarCondicao: avaliarCondicao,
    identificarAdequacaoSquad: identificarAdequacaoSquad,
    simular: simular,
    validarRegrasCompletas: validarRegrasCompletas,
    onMudanca: onMudanca,
    estadoCarga: estadoCarga,
    msCarregando: msCarregando,
    recarregar: recarregar,
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
