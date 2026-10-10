/* ============================================================
   CARGA INICIAL — redação do questionário de Posicionamento Organizacional para o MOTOR v2 (H1-B).

   SÓ DADOS (texto aprovado pela responsável), nunca lógica: o significado de cada código (O1 → Linha, opções de
   D2 → papéis, transições) está no núcleo do motor (motor-posicionamento-nucleo.js) e não muda aqui. Este arquivo
   não está no index.html e o motor nunca o lê: ADMIN › Arquitetura › Questionários e versões o carrega sob demanda
   para criar o RASCUNHO da redação v2 (faQuestionarios.importarConteudoInicial), que normaliza e prova a estrutura
   contra o contrato do motor (conteudoCompativel) e grava o vínculo motorCompativel pelo sistema. Depois de
   importada, a redação é conteúdo governado do questionário (versionado, editável, publicado só em par com o
   motor — H2); este arquivo não é fallback de nada.
   ============================================================ */
(function () {
  'use strict';
  window.faConteudoInicialPosicionamento = window.faConteudoInicialPosicionamento || {};
  window.faConteudoInicialPosicionamento[2] = {
    codigo: 'POSICIONAMENTO_ORGANIZACIONAL',
    perguntas: [
      { codigoEstavel: 'O1', titulo: 'Resultado integrado',
        texto: 'Essa responsabilidade exige integrar continuamente diferentes competências para sustentar um resultado, fluxo de valor ou capacidade em funcionamento pela qual a estrutura responde como um todo?',
        textoAjuda: { significado: 'Inclui o caso em que a própria estrutura opera uma capacidade para outras estruturas usarem.',
          quandoSim: 'Competências diferentes trabalham juntas e a estrutura responde pelo resultado final.',
          quandoNao: 'A responsabilidade se esgota numa especialidade.' },
        justSim: 'SIM — A resposta indica uma responsabilidade que integra continuamente diferentes competências e responde pelo resultado do conjunto.',
        justNao: 'NÃO — A resposta não indica uma responsabilidade que integre diferentes competências respondendo pelo resultado do conjunto.' },
      { codigoEstavel: 'O2', titulo: 'Execução especializada',
        texto: 'O principal valor dessa responsabilidade está no trabalho especializado que a própria estrutura executa diretamente?',
        textoAjuda: { significado: 'Atender várias áreas, ser transversal ou ter especialistas não muda a resposta. Se o trabalho é uma etapa de um resultado integrado maior pelo qual a estrutura responde, considere O1.' },
        justSim: 'SIM — A resposta indica que o principal valor está no trabalho especializado executado diretamente pela própria estrutura.',
        justNao: 'NÃO — A resposta não indica que o principal valor esteja no trabalho especializado executado diretamente pela própria estrutura.' },
      { codigoEstavel: 'O3', titulo: 'Capacidade desenvolvida nos outros',
        texto: 'O principal valor dessa responsabilidade está em desenvolver conhecimento, práticas, padrões ou competência em outras estruturas, que continuam responsáveis por executar o trabalho?',
        textoAjuda: { significado: 'Não basta ser transversal, estratégica ou ter especialistas. Se é a própria estrutura que executa, considere O2. Se ela opera algo que outras estruturas consomem, considere O1.' },
        justSim: 'SIM — A resposta indica que o principal valor está na capacidade desenvolvida em outras estruturas, que continuam executando o trabalho.',
        justNao: 'NÃO — A resposta não indica que o principal valor esteja na capacidade desenvolvida em outras estruturas.' },
      { codigoEstavel: 'O4', titulo: 'Estratégia para clientes ou participantes',
        texto: 'A responsabilidade principal é definir e sustentar a estratégia para clientes ou participantes — públicos, segmentos, proposta de valor, relacionamento e experiência — de forma transversal aos produtos e serviços?',
        textoAjuda: { significado: 'Definir a experiência pretendida para um público entra aqui. Operar o meio pelo qual o cliente interage, não.' },
        justSim: 'SIM — A resposta indica responsabilidade principal pela estratégia para clientes ou participantes, transversal aos produtos e serviços.',
        justNao: 'NÃO — A resposta não indica responsabilidade principal pela estratégia para clientes ou participantes.' },
      { codigoEstavel: 'O5', titulo: 'Resultado de negócio',
        texto: 'A responsabilidade principal é responder pelo resultado de negócio de um Produto/Serviço, ou de um conjunto coerente deles, entregue ao cliente de ponta a ponta?',
        textoAjuda: { significado: 'Usar capacidades compartilhadas não muda a resposta.' },
        justSim: 'SIM — A resposta indica responsabilidade principal pelo resultado de negócio entregue ao cliente de ponta a ponta.',
        justNao: 'NÃO — A resposta não indica responsabilidade principal pelo resultado de negócio entregue ao cliente.' },
      { codigoEstavel: 'O6', titulo: 'Meios de interação, acesso ou distribuição',
        texto: 'A responsabilidade principal é operar e evoluir meios reutilizáveis de interação, acesso ou distribuição pelos quais clientes ou participantes acessam produtos e serviços?',
        textoAjuda: { significado: 'É o meio de acesso, não o produto/serviço acessado por ele. Meios usados só internamente tendem a O8 ou O9.' },
        justSim: 'SIM — A resposta indica responsabilidade principal por meios reutilizáveis de interação, acesso ou distribuição.',
        justNao: 'NÃO — A resposta não indica responsabilidade principal por meios reutilizáveis de interação, acesso ou distribuição.' },
      { codigoEstavel: 'O7', titulo: 'Capacidade de negócio reutilizável',
        texto: 'A responsabilidade principal é operar e evoluir uma capacidade de negócio reutilizável consumida por diferentes estruturas que entregam produtos ou serviços?',
        textoAjuda: { significado: 'Não precisa ser previdenciária ou financeira. O que conta é ser uma capacidade de negócio usada por várias estruturas.' },
        justSim: 'SIM — A resposta indica responsabilidade principal por uma capacidade de negócio reutilizável consumida por diferentes estruturas.',
        justNao: 'NÃO — A resposta não indica responsabilidade principal por uma capacidade de negócio reutilizável.' },
      { codigoEstavel: 'O8', titulo: 'Capacidade tecnológica reutilizável',
        texto: 'A responsabilidade principal é operar e evoluir uma capacidade tecnológica reutilizável usada por diferentes estruturas para construir ou operar suas soluções?',
        textoAjuda: { significado: 'Exemplos: infraestrutura, dados, integração, automação, ferramentas.' },
        justSim: 'SIM — A resposta indica responsabilidade principal por uma capacidade tecnológica reutilizável usada por diferentes estruturas.',
        justNao: 'NÃO — A resposta não indica responsabilidade principal por uma capacidade tecnológica reutilizável.' },
      { codigoEstavel: 'O9', titulo: 'Capacidades internas da organização',
        texto: 'A responsabilidade principal é operar e evoluir capacidades internas de gestão e funcionamento da organização oferecidas às áreas internas?',
        textoAjuda: { significado: 'Exemplos: gestão de pessoas, finanças, suprimentos, administração. Para separar de O7: se a cadeia termina na entrega ao cliente, tende a O7; se é administração interna, tende a O9.' },
        justSim: 'SIM — A resposta indica responsabilidade principal por capacidades internas de gestão e funcionamento da organização.',
        justNao: 'NÃO — A resposta não indica responsabilidade principal por capacidades internas de gestão e funcionamento da organização.' },
      { codigoEstavel: 'DIAG_CONFLITO_RECORTE', titulo: 'Mesma responsabilidade ou responsabilidades distintas',
        texto: 'Esses sinais pertencem à mesma responsabilidade ou estamos misturando responsabilidades distintas?',
        textoAjuda: { quandoMesma: 'Os sinais descrevem a mesma responsabilidade organizacional.', quandoDistintas: 'O objeto está misturando responsabilidades que poderiam ser separadas.' },
        rotuloMesma: 'Mesma responsabilidade', interpretacaoMesma: 'Os sinais pertencem à mesma responsabilidade: falta saber qual natureza predomina.',
        rotuloDistintas: 'Responsabilidades distintas', interpretacaoDistintas: 'O objeto mistura responsabilidades distintas: o caso indica necessidade de recortar o objeto.' },
      { codigoEstavel: 'DIAG_PREDOMINANCIA_N1', titulo: 'Onde predomina o valor',
        texto: 'Onde acontece predominantemente o valor dessa responsabilidade?',
        opcoes: [
          { codigo: 'RESULTADO_INTEGRADO', rotulo: 'Resultado integrado e contínuo' },
          { codigo: 'EXECUCAO_ESPECIALIZADA', rotulo: 'Execução direta especializada' },
          { codigo: 'CAPACIDADE_NOS_OUTROS', rotulo: 'Capacidade desenvolvida nos outros' },
          { codigo: 'NAO_DETERMINAVEL', rotulo: 'Não é possível determinar' }
        ] },
      { codigoEstavel: 'DIAG_PREDOMINANCIA_N2', titulo: 'Pelo que responde predominantemente',
        texto: 'Pelo que essa responsabilidade responde predominantemente?',
        opcoes: [
          { codigo: 'ESTRATEGIA_PARA_CLIENTES', rotulo: 'Estratégia para clientes/participantes' },
          { codigo: 'RESULTADO_DE_NEGOCIO', rotulo: 'Resultado de negócio' },
          { codigo: 'NAO_DETERMINAVEL', rotulo: 'Não é possível determinar' }
        ] },
      { codigoEstavel: 'DIAG_PREDOMINANCIA_N3', titulo: 'Que capacidade opera predominantemente',
        texto: 'Que capacidade essa responsabilidade opera predominantemente para outras estruturas utilizarem?',
        opcoes: [
          { codigo: 'INTERACAO_ACESSO_DISTRIBUICAO', rotulo: 'Meio de interação, acesso ou distribuição' },
          { codigo: 'CAPACIDADE_DE_NEGOCIO', rotulo: 'Capacidade de negócio' },
          { codigo: 'CAPACIDADE_TECNOLOGICA', rotulo: 'Capacidade tecnológica' },
          { codigo: 'CAPACIDADE_INTERNA_CORPORATIVA', rotulo: 'Capacidade interna corporativa' },
          { codigo: 'NAO_DETERMINAVEL', rotulo: 'Não é possível determinar' }
        ] }
    ]
  };
})();
