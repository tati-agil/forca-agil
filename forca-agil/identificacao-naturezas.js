/* ============================================================
   IDENTIFICAÇÃO ORIENTADA DA NATUREZA INDIVIDUAL (window.faIdentificacaoNaturezas / module.exports) — puro: sem DOM, sem
   banco, sem relógio. Fonte ÚNICA do conteúdo da etapa que, DEPOIS do P1–P16 (o motor não muda), leva a pessoa da
   classificação técnica do motor até a natureza individual do objeto, quando a classificação admite mais de uma.

   Decisões aprovadas (19/10/2026):
   - Só para as classificações técnicas que admitem mais de uma natureza (modelo central naturezas-arquiteturais.js):
     Funcionalidade/Operação, Processo/Etapa, Informação/Documento, Modalidade/Subproduto (com Opção) e Regra/Opção (que
     admite só Regra: quem for de fato Opção é orientado a reavaliar o P1–P16, sem troca automática).
   - Cada pergunta mostra orientação, o que a distingue e quando marcar cada alternativa, a partir das definições
     oficiais da Taxonomia (lidas ao vivo e guardadas na identificação); justificativa sempre obrigatória.
   - Sem distinção além das definições: quando as evidências sustentam mais de uma natureza sem distinção suficiente, a
     identificação fica PENDENTE (recorte, evidência insuficiente ou reavaliação P1–P16 necessária) — nunca forçada.
   - Exemplos: só os validados (os do questionário oficial e o da definição de Opção); nenhum exemplo institucional novo.
   - VERSAO: o texto desta orientação é versionado; a identificação guarda a versão, a pergunta, a alternativa e as
     definições usadas, para que um texto novo nunca mude o fundamento de uma identificação antiga.
   ============================================================ */
(function (raiz) {
  'use strict';
  var VERSAO = 1;

  var PENDENCIAS = Object.freeze({
    recorte: Object.freeze({ rotulo: 'Recorte necessário', alternativa: 'O objeto reúne mais de um destes elementos, e cada um precisa ser avaliado como item próprio',
      diagnostico: 'Quais elementos estão reunidos e precisam ser separados?' }),
    'evidencia-insuficiente': Object.freeze({ rotulo: 'Evidência insuficiente', alternativa: 'As informações disponíveis não permitem decidir com segurança',
      diagnostico: 'O que ainda precisa ser esclarecido para decidir?' }),
    'reavaliacao-necessaria': Object.freeze({ rotulo: 'Reavaliação P1–P16 necessária', alternativa: '',
      diagnostico: 'Por que a classificação do motor não corresponde ao objeto?' })
  });

  /* alternativa: { valor, natureza | pendencia, rotulo, quando } — "quando" vem das definições oficiais (sem critério novo) */
  var DIFERENCIACOES = Object.freeze({
    'funcionalidade-operacao': {
      pergunta: 'O que exatamente está sendo avaliado: o recurso que o público encontra e usa dentro do Produto/Serviço, ou a ação delimitada e executável que realiza algo?',
      orientacao: 'Decida pelo que o objeto avaliado representa, não pela expressão usada no nome. Expressões como “consultar saldo” podem designar o recurso oferecido ao público ou a ação que é executada, conforme o objeto avaliado.',
      exemplos: 'Exemplos do questionário (P16): consultar saldo, alterar contribuição, executar uma operação dentro de uma solução maior — cada um pode ser recurso ou ação, conforme o objeto.',
      alternativas: [
        { valor: 'funcionalidade', natureza: 'funcionalidade', rotulo: 'Um recurso que o público usa dentro do Produto/Serviço',
          quando: 'Marque quando o objeto é o recurso disponibilizado ao público para consultar, solicitar, contratar, alterar ou administrar algo.' },
        { valor: 'operacao', natureza: 'operacao', rotulo: 'Uma ação delimitada e executável',
          quando: 'Marque quando o objeto é a ação que realiza algo dentro de uma solução maior, acionada por uma funcionalidade, por outra operação ou pela organização.' }
      ]
    },
    'processo-etapa': {
      pergunta: 'O objeto avaliado é um encadeamento de atividades que produz um resultado, ou é uma parte de um processo, com resultado intermediário próprio?',
      orientacao: 'Considere o encadeamento delimitado que constitui o objeto; ele não precisa cobrir toda a cadeia de valor. Etapa faz parte de um processo e não é um tipo de processo.',
      exemplos: 'Exemplos do questionário (P12): análise, cálculo, concessão, formalização, pagamento, habilitação — cada um pode ser processo ou etapa, conforme o recorte do objeto.',
      alternativas: [
        { valor: 'processo', natureza: 'processo', rotulo: 'Um encadeamento de atividades que produz um resultado',
          quando: 'Marque quando o encadeamento delimitado que constitui o objeto produz, ele mesmo, o seu resultado.' },
        { valor: 'etapa', natureza: 'etapa', rotulo: 'Uma parte de um processo, com resultado intermediário',
          quando: 'Marque quando o objeto só existe como parte de um processo e entrega a ele um resultado intermediário próprio.' }
      ]
    },
    'documento-informacao': {
      pergunta: 'O objeto avaliado é o conteúdo informacional disponibilizado ao público, ou o artefato com forma própria que materializa e entrega esse conteúdo?',
      orientacao: 'Distinga o conteúdo do artefato que o materializa. Um conteúdo apresentado dentro de um documento continua sendo Informação quando o objeto avaliado é o próprio conteúdo, qualquer que seja o meio (tela, documento ou outro canal).',
      exemplos: 'Exemplos do questionário (P10) de artefatos com forma própria: extrato, informe, contracheque.',
      alternativas: [
        { valor: 'informacao', natureza: 'informacao', rotulo: 'O conteúdo informacional, para consulta ou conhecimento',
          quando: 'Marque quando o objeto é o conteúdo disponibilizado ao público, independentemente do meio usado para apresentá-lo.' },
        { valor: 'documento', natureza: 'documento', rotulo: 'O artefato com forma própria entregue ao público',
          quando: 'Marque quando o objeto é o próprio artefato, com forma própria, que chega ao público.' }
      ]
    },
    'modalidade-subproduto': {
      pergunta: 'Em relação ao Produto/Serviço de origem, o que exatamente está sendo avaliado: uma forma específica de oferecer ou de utilizar o produto; um desdobramento identificável da oferta, vinculado ao produto; ou a escolha de um parâmetro entre as alternativas que uma regra permite?',
      orientacao: 'Não basta existir uma escolha: identifique o que o objeto é. Ter condições ou regras próprias, sozinho, não define Modalidade. Subproduto não é, por definição, um componente nem uma parte incompleta do produto. Se as evidências sustentam Modalidade e Subproduto sem distinção suficiente, registre a identificação como pendente, em vez de escolher.',
      exemplos: 'Exemplo da definição oficial de Opção: a opção tributária entre os regimes. Contraexemplo (P14): o regime tributário em si é Regra.',
      alternativas: [
        { valor: 'modalidade', natureza: 'modalidade', rotulo: 'Uma forma específica de oferecer ou de utilizar o produto',
          quando: 'Marque quando o objeto é uma forma específica de oferta ou de utilização do Produto/Serviço, que preserva a natureza essencial do produto de origem.' },
        { valor: 'subproduto', natureza: 'subproduto', rotulo: 'Um desdobramento identificável da oferta',
          quando: 'Marque quando o objeto é um desdobramento identificável da oferta, vinculado ao Produto/Serviço de origem e que preserva a sua natureza essencial.' },
        { valor: 'opcao', natureza: 'opcao', rotulo: 'A escolha de um parâmetro entre alternativas que uma regra permite',
          quando: 'Marque quando o objeto é a alternativa que o participante escolhe entre as que uma regra permite, ajustando um parâmetro do mesmo produto sem criar uma forma própria de oferta.' }
      ]
    },
    'regra-condicao': {
      pergunta: 'O objeto avaliado é uma norma ou condição imposta, que determina elegibilidade, prazo, limite ou comportamento de outro objeto, ou é uma alternativa que o participante escolhe entre as que uma regra permite?',
      orientacao: 'Regra/Opção é o nome histórico desta classificação do motor, que admite só Regra. Uma Opção corresponde à classificação Modalidade/Subproduto (P13): se o objeto for uma Opção, a classificação precisa ser revista por uma reavaliação do P1–P16, que preserva o histórico. Nada é trocado automaticamente.',
      exemplos: 'Exemplos do questionário (P14) de regra ou condição: elegibilidade, prazo, limite, carência, regime tributário. Contraexemplo: a opção tributária entre os regimes é Opção.',
      alternativas: [
        { valor: 'regra', natureza: 'regra', rotulo: 'Uma norma ou condição imposta',
          quando: 'Marque quando o objeto determina elegibilidade, prazo, limite ou comportamento de outro objeto e não é escolhido pelo participante.' },
        { valor: 'opcao-reavaliar', pendencia: 'reavaliacao-necessaria', rotulo: 'Uma alternativa escolhida pelo participante (Opção)',
          quando: 'Marque quando o objeto é a alternativa escolhida entre as que uma regra permite. A Opção não é registrada aqui: a identificação fica pendente até a reavaliação do P1–P16.' }
      ]
    }
  });

  /* as duas pendências comuns a todas as perguntas */
  var COMUNS = [
    { valor: 'recorte', pendencia: 'recorte', rotulo: PENDENCIAS.recorte.alternativa, quando: 'Marque quando o objeto reúne elementos de naturezas diferentes. Nada é atribuído: cada parte deve ser avaliada como item próprio.' },
    { valor: 'evidencia-insuficiente', pendencia: 'evidencia-insuficiente', rotulo: PENDENCIAS['evidencia-insuficiente'].alternativa, quando: 'Marque quando as evidências sustentam mais de uma alternativa sem distinção suficiente, ou faltam informações. Nada é atribuído.' }
  ];

  function diferenciacao(classificacao) {
    var d = DIFERENCIACOES[classificacao];
    if (!d) return null;
    return { classificacao: classificacao, versao: VERSAO, pergunta: d.pergunta, orientacao: d.orientacao, exemplos: d.exemplos, alternativas: d.alternativas.concat(COMUNS) };
  }
  function alternativa(classificacao, valor) {
    var d = diferenciacao(classificacao);
    return d ? d.alternativas.filter(function (a) { return a.valor === valor; })[0] || null : null;
  }

  var api = Object.freeze({ VERSAO: VERSAO, PENDENCIAS: PENDENCIAS, CLASSIFICACOES: Object.freeze(Object.keys(DIFERENCIACOES)), diferenciacao: diferenciacao, alternativa: alternativa });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (raiz) raiz.faIdentificacaoNaturezas = api;
})(typeof window !== 'undefined' ? window : null);
