/* ============================================================
   Força Ágil — Configuração de Questionários (window.faQuestionarios)

   Objetivo: permitir que a REDAÇÃO das perguntas dos questionários
   (título, texto da pergunta, ajuda, exemplo, justificativas automáticas)
   seja alterada por configuração — sem editar código, sem PR, sem deploy —
   mantendo a REGRA de cada pergunta (o que ela significa para o motor de
   classificação) inteiramente fora do alcance dessa edição.

   Separação central deste módulo:
   - codigoEstavel (ex.: 'P5', 'S3'): identificador IMUTÁVEL, definido em
     código (ver CODIGOS_ESTAVEIS em avaliacao-produto.js), nunca editável
     por aqui. É o único identificador que a lógica de negócio pode usar.
   - conteúdo editorial (titulo/texto/textoAjuda/exemplo/justSim/justNao/
     observacaoAdministrativa e, no diagnóstico conflito × recorte,
     rotuloMesma/rotuloDistintas/interpretacaoMesma/interpretacaoDistintas):
     só isso é parametrizável, versionado e auditável por este módulo. Nunca
     usado como chave de nada.
   - tipo da pergunta ('binaria' | 'diagnostico-conflito-recorte', ausente =
     'binaria') e os códigos de resposta (SIM/NAO, mesma/distintas): estrutura,
     definidos em código (ver TIPOS_PERGUNTA), nunca editáveis.

   Node no Firebase:
   questionarios-config/<codigo> = {
     nome, descricao,
     versaoPublicada: número da versão vigente (perguntas NOVAS/em
       andamento usam esta versão — ver questionnaireContentVersion em
       avaliacao-produto.js),
     versoes: { "<n>": { perguntas: [...], publicadoEm, publicadoPor } , ... }
       — cada publicação cria uma entrada NOVA; nenhuma entrada existente é
       sobrescrita ou apagada (histórico completo sempre preservado, mesmo
       depois de um "rollback" — ver publicarVersaoAnterior),
     rascunho: { perguntas: [...], atualizadoEm, atualizadoPor } | null
       — edições em andamento, nunca usadas por avaliações reais até
       PUBLICAR; várias perguntas podem ser editadas sem afetar quem está
       respondendo o questionário agora.
   }
   questionarios-auditoria/<codigo>/<pushKey> = {
     pergunta (codigoEstavel), campo, valorAnterior, valorNovo,
     usuario, dataHora, versaoAnterior, novaVersao
   } — uma entrada por CAMPO alterado em cada pergunta, nunca apagável por
   esta aplicação (não existe função de exclusão aqui).

   Quando o node ainda não existe no Firebase (instalação nova, ou nenhuma
   edição feita ainda), versaoAtual/perguntasDaVersao caem no conteúdo de
   FÁBRICA definido em PADRAO abaixo — a mesma redação que já existia
   hardcoded no código antes deste módulo existir. Isso garante que a
   aplicação funciona sem exigir uma primeira publicação manual, e que
   avaliações antigas (sem questionnaireContentVersion nenhum) sempre têm
   uma redação de fallback coerente, nunca um campo vazio ou inventado. */
(function () {
  var NODE_CONFIG = 'questionarios-config';
  var NODE_AUDITORIA = 'questionarios-auditoria';

  function db() { return firebase.database(); }

  /* Único conjunto de campos que PUBLICAR/rascunho tocam — tudo que não
     está aqui (codigoEstavel, ordem, grupo, obrigatoriedade, o próprio
     código do questionário) é identidade/regra, nunca editorial. */
  var CAMPOS_EDITORIAVEIS = ['titulo', 'texto', 'textoAjuda', 'exemplo', 'exemplos', 'ajudaExtra', 'justSim', 'justNao', 'observacaoAdministrativa',
    'rotuloMesma', 'interpretacaoMesma', 'rotuloDistintas', 'interpretacaoDistintas', 'opcoes'];

  /* TIPO DE PERGUNTA — estrutural, nunca editorial. Define quais respostas a
     pergunta admite e quais campos editoriais ela tem; não está em
     CAMPOS_EDITORIAVEIS, não aparece no formulário e não muda por publicação
     (ver normalizarPerguntas: em toda gravação vem da definição em código).
     - 'binaria': respostas SIM/NAO; interpretação em justSim/justNao. Tipo
       AUSENTE = 'binaria' — P1–P16 e S1–S8 nunca tiveram o campo e não são
       migrados (ver tipoPergunta).
     - 'diagnostico-conflito-recorte': respostas 'mesma'/'distintas' (nunca
       SIM/NAO); campos editoriais próprios — rotuloMesma/rotuloDistintas,
       interpretacaoMesma/interpretacaoDistintas, textoAjuda.quandoMesma/
       textoAjuda.quandoDistintas —, nunca justSim/justNao. */
  /* - 'diagnostico-predominancia' (D2 do motor de Posicionamento v2, H1-B): respostas = os CÓDIGOS das opções
       (fixos, do núcleo do motor: OPCOES_PREDOMINANCIA + NAO_DETERMINAVEL); o editorial é o texto da pergunta e,
       por opção, rotulo/interpretacao (campo opcoes: [{ codigo, rotulo, interpretacao }]). Só existe no conteúdo
       de uma versão de motor que tem D2 (trilha motores/<v>), nunca no questionário v1. */
  var TIPOS_PERGUNTA = Object.freeze({ BINARIA: 'binaria', DIAGNOSTICO_CONFLITO_RECORTE: 'diagnostico-conflito-recorte',
    DIAGNOSTICO_PREDOMINANCIA: 'diagnostico-predominancia' });
  /* Códigos de resposta: regra/identidade (o motor de posicionamento lê
     exatamente 'mesma'/'distintas' — ver RESPOSTAS_DIAGNOSTICO em
     motor-posicionamento.js), nunca conteúdo editorial: vêm do TIPO, não
     são gravados na pergunta e não são editáveis. */
  var RESPOSTAS_DIAGNOSTICO = Object.freeze({ MESMA: 'mesma', DISTINTAS: 'distintas' });
  var RESPOSTAS_POR_TIPO = Object.freeze({
    binaria: Object.freeze(['SIM', 'NAO']),
    'diagnostico-conflito-recorte': Object.freeze([RESPOSTAS_DIAGNOSTICO.MESMA, RESPOSTAS_DIAGNOSTICO.DISTINTAS]),
    'diagnostico-predominancia': Object.freeze([])   /* as respostas são os códigos das opções da própria pergunta */
  });
  /* Campos editoriais que só fazem sentido num tipo: numa gravação, os do
     OUTRO tipo saem da pergunta (o diagnóstico nunca leva justSim/justNao;
     uma binária nunca leva os rótulos de mesma/distintas). */
  var CAMPOS_SO_DO_TIPO = {
    binaria: { raiz: ['justSim', 'justNao'], ajuda: ['quandoSim', 'quandoNao'] },
    'diagnostico-conflito-recorte': { raiz: ['rotuloMesma', 'interpretacaoMesma', 'rotuloDistintas', 'interpretacaoDistintas'], ajuda: ['quandoMesma', 'quandoDistintas'] },
    'diagnostico-predominancia': { raiz: ['opcoes'], ajuda: [] }
  };

  var PADRAO = {
    CLASSIFICACAO_ARQUITETURAL: {
      nome: 'Classificação arquitetural (Produto/Serviço)',
      descricao: 'Checklist de 16 perguntas para decidir a classificação arquitetural de um item — 8 critérios principais (P1–P8) e 8 testes de classificação (P9–P16).',
      perguntas: [
        { codigoEstavel: 'P1', titulo: 'Necessidade do cliente',
          texto: 'Este item atende a uma necessidade identificável de um cliente ou público específico?',
          textoAjuda: {
            significado: 'Este critério verifica se existe alguém para quem a solução faz sentido e uma necessidade que justifica sua existência.',
            quandoSim: 'Existe um cliente/público identificável e uma necessidade concreta atendida pelo item.',
            quandoNao: 'O item existe principalmente por uma necessidade interna, administrativa, tecnológica ou operacional, sem uma necessidade de cliente claramente identificável.'
          },
          exemplo: 'Um participante quer se preparar para se aposentar com mais segurança financeira — essa é uma necessidade de cliente identificável.',
          justSim: 'SIM — Existe uma necessidade de cliente identificável associada ao item.',
          justNao: 'NÃO — Não foi identificada uma necessidade de cliente suficientemente clara para caracterizar uma oferta.' },
        { codigoEstavel: 'P2', titulo: 'Resultado próprio para o cliente',
          texto: 'O item entrega um resultado próprio e perceptível para o cliente?',
          textoAjuda: {
            significado: 'Este é o principal critério da avaliação. Um Produto/Serviço precisa produzir um resultado que faça sentido para o cliente por si só.',
            quandoSim: 'O cliente consegue reconhecer o benefício ou resultado obtido ao utilizar a solução — por exemplo: receber uma renda; obter proteção; adquirir um imóvel financiado; receber crédito; obter uma orientação estruturada.',
            quandoNao: 'O item apenas ajuda outra solução a produzir seu resultado — por exemplo: cadastro; cálculo; folha; autenticação; documento; cobrança; análise interna.'
          },
          exemplo: 'Um empréstimo consignado entrega um resultado próprio (o crédito recebido); a análise de crédito que o viabiliza, sozinha, não entrega um resultado independente ao cliente.',
          justSim: 'SIM — O item produz um resultado próprio e perceptível para o cliente.',
          justNao: 'NÃO — O item contribui para uma entrega, mas não apresenta resultado de cliente suficientemente independente.' },
        { codigoEstavel: 'P3', titulo: 'Solução identificável',
          texto: 'O item pode ser entendido pelo cliente como uma solução ou oferta identificável?',
          textoAjuda: {
            significado: 'Avalie se o item representa algo que o cliente consegue reconhecer como uma solução, e não apenas uma parte invisível da operação.',
            quandoSim: 'O item possui identidade e propósito próprios na relação com o cliente.',
            quandoNao: 'O item é apenas uma atividade, mecanismo ou elemento interno de outra solução.'
          },
          exemplo: 'Um plano de previdência é reconhecido pelo participante como uma oferta própria; a rotina interna que atualiza saldo mensalmente não é.',
          justSim: 'SIM — O item pode ser reconhecido como uma solução/oferta com propósito próprio.',
          justNao: 'NÃO — O item parece representar uma parte da operação ou de outra solução, e não uma oferta independente.' },
        { codigoEstavel: 'P4', titulo: 'Fronteira coerente',
          texto: 'É possível delimitar claramente onde essa solução começa e termina?',
          textoAjuda: {
            significado: 'Uma solução deve ter uma fronteira coerente. Seus elementos devem pertencer ao mesmo propósito e contribuir para o mesmo resultado.',
            quandoSim: 'É possível identificar o que faz e o que não faz parte da solução.',
            quandoNao: 'O item é excessivamente genérico, transversal ou misturado com diversas outras soluções.'
          },
          exemplo: 'Um seguro de vida tem escopo claro (o que cobre, quem cobre, por quanto tempo); "atendimento ao participante" em geral atravessa vários produtos e não tem essa fronteira.',
          justSim: 'SIM — Existe uma fronteira coerente e identificável para a solução.',
          justNao: 'NÃO — A fronteira do item não está suficientemente clara para caracterizá-lo como uma solução autônoma.' },
        { codigoEstavel: 'P5', titulo: 'Autonomia estrutural',
          texto: 'O item consegue existir e entregar seu resultado de forma independente, sem depender estruturalmente de outro Produto/Serviço?',
          textoAjuda: {
            significado: 'Resultado próprio, fronteira e mensuração não bastam: uma funcionalidade dentro de outro Produto/Serviço também pode ter tudo isso sem ser, ela mesma, uma solução independente. Este critério verifica a autonomia estrutural.',
            quandoSim: 'O item continuaria fazendo sentido como solução própria mesmo se o Produto/Serviço ao qual está relacionado deixasse de existir.',
            quandoNao: 'O item só existe, ou só faz sentido, porque outro Produto/Serviço existe — ele depende estruturalmente dessa outra solução.'
          },
          exemplo: 'Um seguro de vida faz sentido como solução própria mesmo sem nenhum outro produto; "Alterar Perfil de Investimento" só existe porque o plano de previdência ao qual pertence existe.',
          justSim: 'SIM — O item tem autonomia estrutural: existiria como solução própria mesmo sem outro Produto/Serviço.',
          justNao: 'NÃO — O item depende estruturalmente de outro Produto/Serviço para existir ou fazer sentido.' },
        { codigoEstavel: 'P6', titulo: 'Jornada própria',
          texto: 'Existe uma jornada ou ciclo de vida identificável para esse item na relação com o cliente?',
          textoAjuda: {
            significado: 'Verifique se é possível reconhecer uma sequência coerente como contratar, utilizar, manter, alterar ou encerrar a solução.',
            quandoSim: 'Existe uma jornada identificável associada à solução.',
            quandoNao: 'O item ocorre somente como uma atividade dentro da jornada de outro produto.'
          },
          exemplo: 'Contratar, acompanhar e resgatar um plano de previdência é uma jornada própria; preencher um cadastro não é.',
          justSim: 'SIM — O item possui uma jornada ou ciclo de vida identificável.',
          justNao: 'NÃO — O item aparece principalmente como parte da jornada de outra solução.' },
        { codigoEstavel: 'P7', titulo: 'Medição de resultado',
          texto: 'É possível medir o resultado desse item de forma própria?',
          textoAjuda: {
            significado: 'O objetivo não é apenas medir quantidade de tarefas ou volume operacional. Deve ser possível medir se a solução está gerando seu resultado.',
            quandoSim: 'Existem ou podem existir indicadores próprios relacionados ao resultado da solução.',
            quandoNao: 'Os indicadores disponíveis medem somente atividades internas ou desempenho de outro produto.'
          },
          exemplo: 'Taxa de satisfação de quem recebeu o benefício é um indicador de resultado; volume de cadastros processados por dia é um indicador operacional.',
          justSim: 'SIM — O item admite mensuração própria de resultado.',
          justNao: 'NÃO — A mensuração parece depender essencialmente de outro produto ou de indicadores puramente operacionais.' },
        { codigoEstavel: 'P8', titulo: 'Gestão ponta a ponta',
          texto: 'Este item poderia ser gerido de ponta a ponta como uma solução?',
          textoAjuda: {
            significado: 'Avalie se seria possível atribuir responsabilidade sobre a evolução da solução, seu resultado, suas regras, sua experiência e seu desempenho.',
            quandoSim: 'Existe uma unidade coerente passível de gestão ponta a ponta.',
            quandoNao: 'O item é tão transversal ou fragmentado que funciona melhor como capacidade, processo ou componente de outras soluções.'
          },
          exemplo: 'Um cartão consignado pode ter um dono responsável pela sua evolução; "processamento de pagamentos" em geral é transversal demais para isso.',
          justSim: 'SIM — O item possui coerência suficiente para gestão ponta a ponta.',
          justNao: 'NÃO — O item parece exercer papel de suporte, processo ou capacidade compartilhada.' },
        { codigoEstavel: 'P9', titulo: 'Canal',
          texto: 'O item é principalmente um canal de acesso ou relacionamento?',
          exemplos: ['portal', 'aplicativo', 'telefone', 'atendimento', 'agência', 'chatbot'],
          justSim: 'SIM — O item apresenta características predominantes de canal, e não de Produto/Serviço.',
          justNao: 'NÃO — O item não se resume a um canal de acesso ou relacionamento.' },
        { codigoEstavel: 'P10', titulo: 'Artefato informacional',
          texto: 'O item é principalmente um documento, relatório ou informação entregue ao cliente?',
          exemplos: ['contracheque', 'demonstrativo', 'informe', 'extrato', 'relatório'],
          justSim: 'SIM — O item apresenta características predominantes de artefato informacional, e não de Produto/Serviço independente.',
          justNao: 'NÃO — O item não se limita a uma saída informacional entregue ao cliente.' },
        { codigoEstavel: 'P11', titulo: 'Capacidade',
          texto: 'O item é principalmente uma capacidade que a organização precisa possuir?',
          exemplos: ['gestão de dados', 'gestão atuarial', 'segurança', 'tecnologia', 'cobrança', 'cadastro'],
          justSim: 'SIM — O item apresenta características predominantes de capacidade organizacional.',
          justNao: 'NÃO — O item não se resume a uma capacidade organizacional interna.' },
        { codigoEstavel: 'P12', titulo: 'Processo/Etapa de processo',
          texto: 'O item é principalmente um processo ou uma etapa de processo?',
          exemplos: ['análise', 'cálculo', 'concessão', 'formalização', 'pagamento', 'habilitação'],
          justSim: 'SIM — O item apresenta características predominantes de processo ou etapa operacional.',
          justNao: 'NÃO — O item não se limita a um processo ou etapa operacional.' },
        { codigoEstavel: 'P13', titulo: 'Modalidade/opção',
          texto: 'O item é principalmente uma modalidade, opção ou configuração de outro produto?',
          exemplos: ['perfil', 'modalidade', 'forma de recebimento', 'opção tributária'],
          justSim: 'SIM — O item apresenta características predominantes de modalidade ou configuração de uma solução maior.',
          justNao: 'NÃO — O item não se resume a uma modalidade ou configuração de outra solução.' },
        { codigoEstavel: 'P14', titulo: 'Regra/condição',
          texto: 'O item é principalmente uma regra ou condição de outro produto?',
          exemplos: ['elegibilidade', 'prazo', 'limite', 'carência', 'regime tributário'],
          justSim: 'SIM — O item apresenta características predominantes de regra ou condição de outra solução.',
          justNao: 'NÃO — O item não se limita a uma regra ou condição de outra solução.' },
        { codigoEstavel: 'P15', titulo: 'Componente',
          texto: 'O item existe principalmente para que outro Produto/Serviço consiga entregar seu resultado?',
          ajudaExtra: 'Pergunte: se o produto principal deixasse de existir, este item ainda faria sentido como uma solução independente para o cliente?',
          justSim: 'SIM — O item apresenta características de componente ou elemento pertencente a outra solução.',
          justNao: 'NÃO — O item demonstra maior independência em relação a outras soluções.' },
        { codigoEstavel: 'P16', titulo: 'Funcionalidade/Operação',
          texto: 'O item é principalmente uma funcionalidade ou operação que permite consultar, escolher, solicitar, contratar, alterar, executar ou administrar algo dentro de outro Produto/Serviço?',
          exemplos: ['alterar uma configuração', 'solicitar uma opção', 'consultar saldo', 'alterar contribuição', 'executar uma operação dentro de uma solução maior'],
          justSim: 'SIM — O item apresenta características predominantes de funcionalidade/operação que atua dentro de outro Produto/Serviço.',
          justNao: 'NÃO — O item não se resume a uma funcionalidade ou operação executada dentro de outra solução.' }
      ]
    },
    ADEQUACAO_SQUAD: {
      nome: 'Adequação à gestão por Squad',
      descricao: 'Checklist de 8 perguntas, independente da classificação arquitetural (ver P1–P16) — responde se faz sentido organizar o cuidado deste item com uma squad dedicada, nunca se o item é ou não Produto/Serviço.',
      perguntas: [
        { codigoEstavel: 'S1', titulo: 'Demanda contínua',
          texto: 'Existe demanda contínua e relevante para essa solução?',
          textoAjuda: { significado: 'Avalia se existe fluxo contínuo e relevante de demanda para a solução.' },
          justSim: 'SIM — Existe demanda contínua e relevante para esta solução.',
          justNao: 'NÃO — A demanda não é contínua nem relevante o suficiente.' },
        { codigoEstavel: 'S2', titulo: 'Backlog próprio de evolução',
          texto: 'Existe backlog próprio de evolução, além da operação cotidiana?',
          textoAjuda: { significado: 'Avalia se existe trabalho de evolução contínua, e não apenas operação ou tratamento de casos.' },
          justSim: 'SIM — Existe backlog próprio de evolução além da operação cotidiana.',
          justNao: 'NÃO — Não há backlog próprio de evolução, só operação cotidiana.' },
        { codigoEstavel: 'S3', titulo: 'Indicadores próprios',
          texto: 'Há indicadores de resultado próprios que uma squad conseguiria influenciar diretamente?',
          textoAjuda: { significado: 'Avalia se a equipe conseguiria influenciar diretamente indicadores de resultado próprios.' },
          justSim: 'SIM — Há indicadores de resultado próprios influenciáveis diretamente.',
          justNao: 'NÃO — Não há indicadores de resultado próprios influenciáveis diretamente.' },
        { codigoEstavel: 'S4', titulo: 'Decisões próprias de priorização',
          texto: 'Existem decisões frequentes de priorização próprias desse domínio?',
          textoAjuda: { significado: 'Avalia se há necessidade frequente de decidir o que evoluir, melhorar ou priorizar naquele domínio.' },
          justSim: 'SIM — Existem decisões frequentes de priorização próprias deste domínio.',
          justNao: 'NÃO — Não há decisões frequentes de priorização próprias deste domínio.' },
        { codigoEstavel: 'S5', titulo: 'Volume, complexidade e criticidade',
          texto: 'O volume, a complexidade e a criticidade justificam capacidade dedicada?',
          textoAjuda: { significado: 'Avalia se o tamanho e a importância do trabalho justificam capacidade dedicada.' },
          justSim: 'SIM — Volume, complexidade e criticidade justificam capacidade dedicada.',
          justNao: 'NÃO — Volume, complexidade e criticidade não justificam capacidade dedicada.' },
        { codigoEstavel: 'S6', titulo: 'Conhecimento/capacidades relativamente estáveis',
          texto: 'Existe um conjunto relativamente estável de conhecimentos e capacidades necessário para evoluir essa solução?',
          textoAjuda: { significado: 'Avalia se existe um conjunto de conhecimentos e especialidades que faça sentido manter em um time relativamente estável.' },
          justSim: 'SIM — Existe um conjunto relativamente estável de conhecimentos e capacidades necessário.',
          justNao: 'NÃO — Não existe um conjunto relativamente estável de conhecimentos e capacidades necessário.' },
        { codigoEstavel: 'S7', titulo: 'Autonomia da equipe',
          texto: 'Uma equipe teria autonomia suficiente para melhorar o resultado sem depender continuamente de múltiplas outras squads?',
          textoAjuda: { significado: 'Avalia se uma squad conseguiria melhorar o resultado sem depender continuamente de outras squads para praticamente todas as decisões ou entregas.' },
          justSim: 'SIM — Uma equipe teria autonomia suficiente sem depender continuamente de outras squads.',
          justNao: 'NÃO — Uma equipe dependeria continuamente de múltiplas outras squads.' },
        { codigoEstavel: 'S8', titulo: 'Ownership claro',
          texto: 'Existe um responsável claro pelo resultado dessa solução?',
          textoAjuda: { significado: 'Avalia se existe alguém ou uma estrutura de responsabilidade clara pelo resultado da solução.' },
          justSim: 'SIM — Existe um responsável claro pelo resultado desta solução.',
          justNao: 'NÃO — Não existe um responsável claro pelo resultado desta solução.' }
      ]
    },
    /* Posicionamento Organizacional: O1–O9 (binárias, tipo EXPLÍCITO) e o
       diagnóstico conflito × recorte — uma pergunta só, usada pelo fluxo em
       qualquer nível (N1, N2 ou N3) quando dois papéis aparecem juntos; não é
       "O10". Só conteúdo: quem decide é window.faMotorPosicionamento, pelos
       códigos (O1…O9, DIAG_CONFLITO_RECORTE) e pelas respostas SIM/NAO e
       mesma/distintas — nunca por esta redação. Nenhuma tela responde este
       questionário ainda. */
    POSICIONAMENTO_ORGANIZACIONAL: {
      nome: 'Posicionamento Organizacional',
      descricao: 'Questionário hierárquico O1–O9 para recomendar o tipo de estrutura organizacional que deve sustentar permanentemente a responsabilidade associada ao objeto. O diagnóstico conflito × recorte é acionado posteriormente pelo fluxo quando dois papéis aparecem no mesmo nível.',
      perguntas: [
        { codigoEstavel: 'O1', tipo: 'binaria', titulo: 'Propósito e resultado',
          texto: 'Considerando a responsabilidade organizacional associada a este objeto, ela corresponde a uma responsabilidade permanente organizada em torno de um propósito ou proposta de valor comum, com responsabilidade contínua por objetivos, entregas e resultados — e não predominantemente pela produção de respostas técnicas especializadas nem pela evolução de uma disciplina?',
          textoAjuda: {
            significado: 'Identifica se a responsabilidade tem característica de Linha: propósito contínuo, entregas e resultados.',
            quandoSim: 'Há responsabilidade permanente por propósito/proposta de valor e por objetivos, entregas e resultados.',
            quandoNao: 'A responsabilidade não se caracteriza predominantemente dessa forma.'
          },
          justSim: 'SIM — A resposta indica uma responsabilidade permanente organizada em torno de propósito ou proposta de valor, com responsabilidade contínua por objetivos, entregas e resultados.',
          justNao: 'NÃO — A resposta não indica predominantemente uma responsabilidade organizada por propósito ou proposta de valor com responsabilidade contínua por objetivos, entregas e resultados.' },
        { codigoEstavel: 'O2', tipo: 'binaria', titulo: 'Resposta técnica especializada',
          texto: 'Considerando a responsabilidade organizacional associada a este objeto, ela é predominantemente responsável pela qualidade técnica de análises, pareceres, validações ou orientações especializadas, aplicando conhecimento técnico, normativo, regulatório ou metodológico — e não pela entrega contínua de uma solução, capacidade ou serviço compartilhado em escala, nem pela evolução de uma disciplina?',
          textoAjuda: { significado: 'Identifica responsabilidade típica de Área Especializada.' },
          ajudaExtra: 'Se a entrega principal é um julgamento/resposta técnica cuja qualidade essa estrutura assume, tende a ser SIM, mesmo quando ocorre com frequência.\n' +
            'Se é uma etapa de um serviço entregue continuamente ou um serviço padronizado em escala, não classifique como Área apenas porque exige conhecimento especializado.',
          justSim: 'SIM — A resposta indica responsabilidade predominante pela qualidade técnica de análises, pareceres, validações ou orientações especializadas.',
          justNao: 'NÃO — A responsabilidade não se caracteriza predominantemente pela produção e qualidade de respostas técnicas especializadas.' },
        { codigoEstavel: 'O3', tipo: 'binaria', titulo: 'Evolução da disciplina',
          texto: 'Considerando a responsabilidade organizacional associada a este objeto, ela é predominantemente responsável por desenvolver, manter e disseminar padrões, métodos, práticas, competências e maturidade de uma disciplina, promovendo sua evolução transversal — e não pela execução dos casos dessa disciplina nem pela entrega contínua de uma solução ou serviço?',
          textoAjuda: { significado: 'Identifica responsabilidade típica de Centro de Excelência (CoE).' },
          ajudaExtra: 'CoE evolui a disciplina. Não é simplesmente a estrutura que executa os casos que exigem aquela disciplina.',
          justSim: 'SIM — A resposta indica responsabilidade predominante pela evolução transversal de uma disciplina, incluindo padrões, métodos, práticas, competências e maturidade.',
          justNao: 'NÃO — A responsabilidade não se caracteriza predominantemente pela evolução transversal de uma disciplina.' },
        { codigoEstavel: 'O4', tipo: 'binaria', titulo: 'Estratégia de Clientes',
          texto: 'Considerando a responsabilidade organizacional associada a este objeto, ela consiste predominantemente em compreender necessidades, comportamentos e experiência de públicos, organizá-los em segmentos e, a partir disso, orientar decisões, portfólio e atuação da organização — sem ser dedicada à entrega de uma solução específica nem disponibilizar capacidade compartilhada?',
          textoAjuda: { significado: 'Identifica uma responsabilidade típica de Estratégia de Clientes: compreender necessidades, comportamentos e experiência dos públicos, estruturá-los em segmentos e usar esse conhecimento para orientar decisões, portfólio e atuação da organização.' },
          justSim: 'SIM — A resposta indica responsabilidade predominante por compreender públicos e segmentos e orientar, a partir disso, decisões, portfólio e atuação da organização.',
          justNao: 'NÃO — A responsabilidade não se caracteriza predominantemente por compreender públicos e segmentos para orientar decisões, portfólio e atuação da organização.' },
        { codigoEstavel: 'O5', tipo: 'binaria', titulo: 'Entrega de negócio dedicada',
          texto: 'Considerando a responsabilidade organizacional associada a este objeto, ela está predominantemente dedicada à entrega e evolução de um Produto/Serviço, ou conjunto coerente de Produtos/Serviços, ou resultado de negócio específico para o cliente, em vez de disponibilizar uma capacidade, serviço, solução ou meio compartilhado para diferentes Linhas?',
          ajudaExtra: 'Uma função ou canal exclusivo de determinada solução pode responder SIM. Atender cliente externo, isoladamente, não basta.\n' +
            'Utilizar plataformas compartilhadas também não transforma uma Linha de Negócios em Plataforma.',
          justSim: 'SIM — A resposta indica responsabilidade dedicada à entrega e evolução de Produto/Serviço, conjunto coerente de Produtos/Serviços ou resultado específico de negócio para o cliente.',
          justNao: 'NÃO — A responsabilidade não se caracteriza predominantemente pela entrega dedicada de Produto/Serviço ou resultado específico de negócio para o cliente.' },
        { codigoEstavel: 'O6', tipo: 'binaria', titulo: 'Canais',
          texto: 'Considerando a responsabilidade organizacional associada a este objeto, ela consiste em disponibilizar meios e capacidades transversais de interação por canais, buscando experiência integrada, contínua e consistente para quem os usa — clientes ou funcionários —, e não em ser a solução ou o serviço acessado por eles?',
          ajudaExtra: 'O Canal é o meio de interação, não necessariamente o serviço consumido naquele meio.\n' +
            'Pode atender clientes externos ou empregados.',
          justSim: 'SIM — A resposta indica responsabilidade por disponibilizar meios e capacidades transversais de interação por canais, buscando uma experiência integrada e consistente.',
          justNao: 'NÃO — A responsabilidade não se caracteriza predominantemente como meio ou capacidade transversal de interação por canais.' },
        { codigoEstavel: 'O7', tipo: 'binaria', titulo: 'Habilitadora de Negócios',
          texto: 'Considerando a responsabilidade organizacional associada a este objeto, ela consiste em desenvolver e fornecer capacidades, serviços ou soluções de negócio compartilhados, consumidos em escala por diferentes Linhas e times?',
          textoAjuda: { significado: 'Identifica uma responsabilidade típica de Plataforma Habilitadora de Negócios: desenvolver e fornecer capacidades, serviços ou soluções de negócio compartilhados e consumidos em escala por diferentes Linhas e times. Não é necessário que o objeto seja previdenciário ou financeiro.' },
          justSim: 'SIM — A resposta indica responsabilidade por capacidades, serviços ou soluções de negócio compartilhados e consumidos em escala por diferentes Linhas e times.',
          justNao: 'NÃO — A responsabilidade não se caracteriza predominantemente pelo fornecimento compartilhado, em escala, de capacidades, serviços ou soluções de negócio.' },
        { codigoEstavel: 'O8', tipo: 'binaria', titulo: 'Habilitadora de Tecnologia',
          texto: 'Considerando a responsabilidade organizacional associada a este objeto, ela consiste em fornecer infraestrutura, serviços técnicos compartilhados, automação, ferramentas ou capacidades tecnológicas utilizadas em escala para sustentar o desenvolvimento e a operação de diferentes Linhas e times?',
          textoAjuda: { significado: 'Identifica uma Plataforma Habilitadora de Tecnologia.' },
          justSim: 'SIM — A resposta indica responsabilidade por infraestrutura, serviços técnicos, automação, ferramentas ou capacidades tecnológicas compartilhadas em escala.',
          justNao: 'NÃO — A responsabilidade não se caracteriza predominantemente pelo fornecimento compartilhado de capacidades ou serviços tecnológicos em escala.' },
        { codigoEstavel: 'O9', tipo: 'binaria', titulo: 'Gestão Corporativa',
          texto: 'Considerando a responsabilidade organizacional associada a este objeto, ela consiste em oferecer serviços corporativos ao cliente interno, preferencialmente por soluções digitais e autosserviço padronizados, buscando escala e previsibilidade?',
          ajudaExtra: 'Para diferenciar de O7, observar onde termina a cadeia de valor e de quem são as regras:\n' +
            '- capacidades/regras ligadas à entrega de valor previdenciário ou financeiro às Linhas tendem a O7;\n' +
            '- serviços ligados à administração interna da organização tendem a O9.',
          justSim: 'SIM — A resposta indica responsabilidade por serviços corporativos ao cliente interno, buscando padronização, escala e previsibilidade.',
          justNao: 'NÃO — A responsabilidade não se caracteriza predominantemente pela oferta de serviços corporativos padronizados ao cliente interno.' },
        { codigoEstavel: 'DIAG_CONFLITO_RECORTE', tipo: 'diagnostico-conflito-recorte', titulo: 'Conflito ou recorte do objeto',
          texto: 'Esses dois papéis descrevem a mesma responsabilidade ou responsabilidades distintas agrupadas no mesmo objeto?',
          textoAjuda: {
            quandoMesma: 'Os dois papéis realmente descrevem a mesma responsabilidade organizacional.',
            quandoDistintas: 'O objeto está agrupando duas responsabilidades que poderiam ser separadas.'
          },
          rotuloMesma: 'Mesma responsabilidade',
          interpretacaoMesma: 'Os dois papéis recaem sobre a mesma responsabilidade. O caso indica um conflito de posicionamento que precisa ser validado.',
          rotuloDistintas: 'Responsabilidades distintas',
          interpretacaoDistintas: 'Os dois papéis representam responsabilidades diferentes agrupadas no mesmo objeto. O caso indica necessidade de recortar o objeto.' }
      ]
    }
  };

  /* Tipo estrutural de uma pergunta. Pergunta conhecida em código: o tipo da
     definição CANÔNICA (PADRAO), nunca o gravado no banco — um "tipo" mexido
     por fora (devtools) não transforma O1 em diagnóstico nem o diagnóstico em
     binária. Sem tipo canônico (P1–P16, S1–S8, que nunca tiveram o campo):
     'binaria'. Pergunta desconhecida: o que ela traz, ou 'binaria'. */
  var CANONICA = {};
  Object.keys(PADRAO).forEach(function (codigo) {
    PADRAO[codigo].perguntas.forEach(function (p) { CANONICA[p.codigoEstavel] = { codigo: codigo, tipo: p.tipo || null }; });
  });
  function tipoPergunta(pergunta) {
    if (!pergunta) return TIPOS_PERGUNTA.BINARIA;
    var canon = CANONICA[pergunta.codigoEstavel];
    if (canon) return canon.tipo || TIPOS_PERGUNTA.BINARIA;
    return pergunta.tipo || TIPOS_PERGUNTA.BINARIA;
  }
  /* true só para perguntas cujo tipo vem EXPLÍCITO na definição em código
     (O1–O9 e o diagnóstico). P/S não: o editor deles fica exatamente como era. */
  function tipoExplicito(codigoEstavel) { return !!(CANONICA[codigoEstavel] && CANONICA[codigoEstavel].tipo); }
  function respostasDoTipo(tipo) { return RESPOSTAS_POR_TIPO[tipo] || RESPOSTAS_POR_TIPO.binaria; }

  /* Proteção estrutural em TODA gravação (rascunho e publicação, inclusive
     rollback e correção editorial): o conjunto de perguntas precisa ser
     exatamente o da definição em código (nenhum código desconhecido, repetido
     ou faltando — senão a gravação é recusada com 'estrutura-divergente'), e
     o "tipo" de cada uma é reposto a partir do código: o canônico quando há
     (O1–O9, diagnóstico), nenhum quando não há (P/S continuam sem o campo —
     ausência = binária). Campos editoriais do OUTRO tipo saem. Conteúdo
     editorial nunca é tocado. Devolve { perguntas } ou { erro }. */
  function normalizarPerguntas(codigo, perguntas) {
    var padrao = PADRAO[codigo];
    if (!padrao) return { perguntas: perguntas };
    if (!Array.isArray(perguntas)) return { erro: 'estrutura-divergente' };
    var esperados = padrao.perguntas.map(function (p) { return p.codigoEstavel; });
    var vistos = {};
    for (var i = 0; i < perguntas.length; i++) {
      var cod = perguntas[i] && perguntas[i].codigoEstavel;
      if (esperados.indexOf(cod) === -1 || vistos[cod]) return { erro: 'estrutura-divergente' };
      vistos[cod] = true;
    }
    if (perguntas.length !== esperados.length) return { erro: 'estrutura-divergente' };
    return { perguntas: perguntas.map(function (original) {
      var p = JSON.parse(JSON.stringify(original));
      var canon = CANONICA[p.codigoEstavel];
      if (canon.tipo) p.tipo = canon.tipo; else delete p.tipo;
      var tipo = canon.tipo || TIPOS_PERGUNTA.BINARIA;
      Object.keys(CAMPOS_SO_DO_TIPO).forEach(function (outro) {
        if (outro === tipo) return;
        CAMPOS_SO_DO_TIPO[outro].raiz.forEach(function (campo) { delete p[campo]; });
        if (p.textoAjuda && typeof p.textoAjuda === 'object') {
          CAMPOS_SO_DO_TIPO[outro].ajuda.forEach(function (campo) { delete p.textoAjuda[campo]; });
          if (!Object.keys(p.textoAjuda).length) delete p.textoAjuda;
        }
      });
      return p;
    }) };
  }

  function perguntaPadrao(codigo, codigoEstavel) {
    var q = PADRAO[codigo];
    if (!q) return null;
    return q.perguntas.filter(function (p) { return p.codigoEstavel === codigoEstavel; })[0] || null;
  }

  /* cache[codigo]: snapshot mais recente do Firebase (null = ainda não
     chegou nenhum, ou node inexistente — nesse caso cai sempre no PADRAO).
     Um único listener por código, nunca duplicado mesmo com várias telas
     interessadas (ver onMudanca). */
  var cache = {};
  var carregado = {};
  var listeners = {};
  /* true só depois da PRIMEIRA leitura de questionarios-config/<codigo>
     chegar. Antes disso versaoAtual() devolve 1 e perguntasDaVersao() o
     conteúdo de fábrica por falta de dado — não porque a versão vigente é
     a 1. Qualquer PUBLICAÇÃO nessa janela (rede lenta de celular: segundos)
     criaria "versão 2" em cima de uma versão 2 já existente, e voltaria
     versaoPublicada para 2. */
  var recebido = {};
  function configCarregada(codigo) { return !!recebido[codigo]; }

  function garantirSync(codigo) {
    if (carregado[codigo]) return;
    carregado[codigo] = true;
    db().ref(NODE_CONFIG + '/' + codigo).on('value', function (snap) {
      cache[codigo] = snap.val();
      recebido[codigo] = true;
      (listeners[codigo] || []).slice().forEach(function (cb) { cb(); });
    });
  }

  /* Registra cb para ser chamado a cada mudança da config (inclusive a
     primeira leitura, que pode chegar depois do primeiro render — quem
     chama deve re-renderizar dentro de cb, do mesmo jeito que já faz com
     db().ref(NODE).on('value', ...) para as avaliações em si). */
  function onMudanca(codigo, cb) {
    garantirSync(codigo);
    listeners[codigo] = listeners[codigo] || [];
    listeners[codigo].push(cb);
  }

  function versaoAtual(codigo) {
    var cfg = cache[codigo];
    return (cfg && cfg.versaoPublicada) || 1;
  }

  function perguntasDaVersao(codigo, versao) {
    var cfg = cache[codigo];
    var v = versao || versaoAtual(codigo);
    if (cfg && cfg.versoes && cfg.versoes[v] && cfg.versoes[v].perguntas) return cfg.versoes[v].perguntas;
    /* Nunca inventa: sem nada gravado para esta versão (instalação nova,
       ou v1 nunca publicada explicitamente), usa o conteúdo de fábrica —
       é exatamente a mesma redação que era hardcoded antes deste módulo. */
    return (PADRAO[codigo] && PADRAO[codigo].perguntas) || [];
  }

  function conteudoPergunta(codigo, codigoEstavel, versao) {
    var achou = perguntasDaVersao(codigo, versao).filter(function (p) { return p.codigoEstavel === codigoEstavel; })[0];
    return achou || perguntaPadrao(codigo, codigoEstavel) ||
      { codigoEstavel: codigoEstavel, titulo: codigoEstavel, texto: '(pergunta ' + codigoEstavel + ' — conteúdo não encontrado)', justSim: 'SIM', justNao: 'NÃO' };
  }

  function rascunhoAtual(codigo) {
    var cfg = cache[codigo];
    return (cfg && cfg.rascunho) || null;
  }

  /* ===================== CORREÇÕES EDITORIAIS ===================== *
     Uma correção de REDAÇÃO conhecida (nunca de regra) entregue pelo código
     mas aplicada pelo MESMO mecanismo de qualquer outra edição: uma
     administradora a aplica (um clique, com confirmação) e ela vira uma
     versão NOVA do questionário (publicarConteudo — versão +1, auditoria
     por campo, rascunho intocado). O conteúdo de fábrica (PADRAO) NÃO é
     alterado: ele é a versão 1 de quem nunca publicou nada, e é o que
     avaliações antigas sem snapshot continuam lendo — reescrevê-lo
     mudaria o histórico. Nada aqui toca em motorVersion,
     motorVersionArquitetura, regras do motor ou avaliações já feitas.

     Cada ajuste só é aplicado se o texto VIGENTE ainda for exatamente um
     texto anterior CONHECIDO: o "de" do ajuste ou um texto que outra
     correção desta lista, ANTERIOR a ela, deu ou tirou daquele mesmo campo
     (ex.: P15 justSim — o de fábrica ou o de 'interpretacoes-p5-p15', valha
     qual estiver em vigor). Se alguém já editou aquele campo por conta
     própria, a edição dela é respeitada e o ajuste é ignorado (situação
     'divergente', mostrada lado a lado no ADMIN); se já estiver igual ao
     novo ("para"), nada a fazer ('aplicada'); se uma correção POSTERIOR já
     levou o campo ao texto dela, o ajuste desta foi 'substituida'.
     Idempotente.

     campo com ponto ('textoAjuda.significado') = subcampo de um objeto.
     de: null = o campo NÃO existe hoje (ajuste cria o campo);
     para: ''  = o campo é RETIRADO (ajuste remove; um objeto de ajuda que
     fica vazio também sai). */
  var CORRECOES_EDITORIAIS = [
    {
      id: 'interpretacoes-p5-p15',
      codigo: 'CLASSIFICACAO_ARQUITETURAL',
      titulo: 'Interpretações automáticas de P5 e P15',
      descricao: 'A interpretação de cada resposta passa a explicar só o significado daquela resposta, sem afirmar dependência estrutural que não decorre dela: ' +
        'P5 = NÃO significa apenas que a autonomia estrutural não foi demonstrada; P15 = NÃO não afirma dependência; P15 = SIM descreve a associação a outra solução.',
      ajustes: [
        { pergunta: 'P5', campo: 'justNao',
          de: 'NÃO — O item depende estruturalmente de outro Produto/Serviço para existir ou fazer sentido.',
          para: 'NÃO — O item não demonstra autonomia estrutural suficiente para ser tratado como uma solução principal independente.' },
        { pergunta: 'P15', campo: 'justSim',
          de: 'SIM — O item apresenta características de componente ou elemento pertencente a outra solução.',
          para: 'SIM — O item existe de forma estruturalmente associada a outra solução e contribui para que essa solução entregue seu resultado.' },
        { pergunta: 'P15', campo: 'justNao',
          de: 'NÃO — O item demonstra maior independência em relação a outras soluções.',
          para: 'NÃO — O item não existe principalmente como suporte estrutural para que outro Produto/Serviço entregue seu resultado.' }
      ]
    },
    /* Os 29 textos aprovados pela responsável (P1–P16 e S1–S8), na redação
       literal da proposta revisada — ver teste-correcao-editorial-29-textos.js,
       que confere cada "de" contra o conteúdo de fábrica (PADRAO) ou contra
       a correção anterior e cada "para" contra a lista aprovada. */
    {
      id: 'semantica-p1-p16',
      codigo: 'CLASSIFICACAO_ARQUITETURAL',
      titulo: 'Textos aprovados de P1–P16 (natureza do objeto)',
      descricao: 'Redação aprovada para P1, P5, P7, P8 e P15: as perguntas falam só da natureza do objeto, e não da equipe, da demanda ou do responsável (isso é a Adequação à Squad). P15 passa a perguntar se o item é um elemento estrutural que compõe outro Produto/Serviço, ganha ajuda e exemplo próprios e perde a ajuda extra antiga, que repetia o teste de P5. Nenhuma regra do motor muda.',
      ajustes: [
        { pergunta: 'P1', campo: 'textoAjuda.significado',
          de: 'Este critério verifica se existe alguém para quem a solução faz sentido e uma necessidade que justifica sua existência.',
          para: 'Verifica se existe um cliente ou público identificável com uma necessidade concreta que o item atende. O destinatário pode ser externo (participantes, assistidos, patrocinadores) ou interno à PREVI (áreas, empregados). Ter um destinatário identificável não determina onde o item fica na organização nem qual estrutura cuida dele.' },
        { pergunta: 'P1', campo: 'textoAjuda.quandoSim',
          de: 'Existe um cliente/público identificável e uma necessidade concreta atendida pelo item.',
          para: 'É possível dizer quem é o público, externo ou interno, e qual necessidade dele o item atende.' },
        { pergunta: 'P1', campo: 'textoAjuda.quandoNao',
          de: 'O item existe principalmente por uma necessidade interna, administrativa, tecnológica ou operacional, sem uma necessidade de cliente claramente identificável.',
          para: 'Não há cliente ou público identificável com uma necessidade concreta atendida pelo item; ele existe apenas por exigência técnica ou operacional. Se o item entrega resultado próprio a algum público, isso é avaliado em P2.' },
        { pergunta: 'P5', campo: 'textoAjuda.significado',
          de: 'Resultado próprio, fronteira e mensuração não bastam: uma funcionalidade dentro de outro Produto/Serviço também pode ter tudo isso sem ser, ela mesma, uma solução independente. Este critério verifica a autonomia estrutural.',
          para: 'Resultado próprio, fronteira e mensuração não bastam: uma funcionalidade dentro de outro Produto/Serviço também pode ter tudo isso sem ser, ela mesma, uma solução independente. Este critério verifica a autonomia estrutural. Avalie o objeto, não a equipe que cuida dele: se essa equipe depende de outras squads, isso é a Autonomia da equipe (S7), na Adequação à Squad.' },
        { pergunta: 'P7', campo: 'textoAjuda.significado',
          de: 'O objetivo não é apenas medir quantidade de tarefas ou volume operacional. Deve ser possível medir se a solução está gerando seu resultado.',
          para: 'O objetivo não é apenas medir quantidade de tarefas ou volume operacional. Deve ser possível medir se o item está produzindo o resultado que lhe é próprio. Não é necessário que o indicador exista atualmente nem que alguma equipe seja responsável por acompanhá-lo; isso é avaliado em Indicadores próprios (S3), na Adequação à Squad.' },
        { pergunta: 'P8', campo: 'textoAjuda.significado',
          de: 'Avalie se seria possível atribuir responsabilidade sobre a evolução da solução, seu resultado, suas regras, sua experiência e seu desempenho.',
          para: 'Avalie a coerência do objeto: se propósito, regras, experiência e resultado pertencem a um mesmo todo, a ponto de o item poder ser tratado como uma solução completa. Não avalie se existe hoje um responsável, uma equipe ou uma Squad; isso é tratado na Adequação à Squad.' },
        { pergunta: 'P8', campo: 'textoAjuda.quandoSim',
          de: 'Existe uma unidade coerente passível de gestão ponta a ponta.',
          para: 'Propósito, regras, experiência e resultado do item formam uma unidade coerente, que pode ser tratada como uma solução.' },
        { pergunta: 'P8', campo: 'exemplo',
          de: 'Um cartão consignado pode ter um dono responsável pela sua evolução; "processamento de pagamentos" em geral é transversal demais para isso.',
          para: 'Um cartão consignado reúne contratação, regras, uso e resultado num mesmo todo; "processamento de pagamentos" atravessa várias soluções e não forma um todo próprio.' },
        { pergunta: 'P15', campo: 'texto',
          de: 'O item existe principalmente para que outro Produto/Serviço consiga entregar seu resultado?',
          para: 'O item é principalmente um elemento estrutural que compõe outro Produto/Serviço?' },
        { pergunta: 'P15', campo: 'textoAjuda.significado',
          de: null,
          para: 'Responda SIM quando o item fizer sentido principalmente como um elemento que compõe outro Produto/Serviço, e não como uma oferta independente. Avalie o que o objeto é, e não apenas o fato de estar relacionado a outro Produto/Serviço. Componente é um elemento estrutural que integra ou sustenta a composição do Produto/Serviço ao qual está associado, sem constituir por si uma solução independente (P5). Não basta ser estrutural para a empresa: uma infraestrutura técnica geral, como servidores ou rede, só é Componente quando integra a composição daquele Produto/Serviço.' },
        { pergunta: 'P15', campo: 'textoAjuda.quandoSim',
          de: null,
          para: 'O item é um elemento estrutural que compõe ou sustenta uma ou mais soluções e não constitui, por si, uma solução independente. Exemplos: o motor de cálculo de um benefício; uma integração que leva dados do plano ao sistema de pagamento; uma base de dados específica que sustenta a entrega de um produto.' },
        { pergunta: 'P15', campo: 'textoAjuda.quandoNao',
          de: null,
          para: 'O item é uma solução por si (P5) ou se descreve melhor por outra natureza: um meio de interação é Canal (P9); um artefato informacional é Informação/Documento (P10); algo que a organização precisa saber ou fazer é Capacidade (P11); um encadeamento de atividades é Processo (P12); uma forma ou opção é Modalidade (P13); uma norma ou condição é Regra (P14); algo que se faz ou se opera dentro do produto é Funcionalidade (P16). Nesses casos responda NÃO aqui e SIM na pergunta correspondente.' },
        { pergunta: 'P15', campo: 'exemplo',
          de: null,
          para: 'É componente: o motor de cálculo do benefício do plano. Não são componentes: a concessão do benefício (Processo), o perfil de investimento (Modalidade), a carência (Regra), "Simular benefício" (Funcionalidade), a capacidade de análise atuarial (Capacidade), o aplicativo (Canal) e o extrato (Informação/Documento).' },
        { pergunta: 'P15', campo: 'ajudaExtra',
          de: 'Pergunte: se o produto principal deixasse de existir, este item ainda faria sentido como uma solução independente para o cliente?',
          para: '' },
        { pergunta: 'P15', campo: 'justSim',
          de: 'SIM — O item existe de forma estruturalmente associada a outra solução e contribui para que essa solução entregue seu resultado.',
          para: 'SIM — O item é principalmente um elemento estrutural que compõe outra solução, sem ser ele próprio uma solução independente nem outra das naturezas avaliadas.' },
        { pergunta: 'P15', campo: 'justNao',
          de: 'NÃO — O item não existe principalmente como suporte estrutural para que outro Produto/Serviço entregue seu resultado.',
          para: 'NÃO — O item não é principalmente um elemento estrutural que compõe outra solução: é uma solução por si ou se descreve melhor por outra natureza.' }
      ]
    },
    {
      id: 'semantica-s1-s8',
      codigo: 'ADEQUACAO_SQUAD',
      titulo: 'Textos aprovados de S1–S8 (trabalho e equipe)',
      descricao: 'Redação aprovada para S1, S3, S6, S7 e S8: as perguntas falam do trabalho e da equipe que cuida do item, e não do que o item é (isso é a classificação P1–P16). Nenhuma regra do motor muda.',
      ajustes: [
        { pergunta: 'S1', campo: 'texto',
          de: 'Existe demanda contínua e relevante para essa solução?',
          para: 'Existe demanda contínua e relevante de trabalho sobre este item ou domínio?' },
        { pergunta: 'S1', campo: 'textoAjuda.significado',
          de: 'Avalia se existe fluxo contínuo e relevante de demanda para a solução.',
          para: 'Avalia se há fluxo contínuo e relevante de trabalho (mudanças, melhorias, solicitações) sobre o item ou domínio. Não é a necessidade do cliente, avaliada em P1.' },
        { pergunta: 'S1', campo: 'justSim',
          de: 'SIM — Existe demanda contínua e relevante para esta solução.',
          para: 'SIM — Existe demanda contínua e relevante de trabalho sobre este item ou domínio.' },
        { pergunta: 'S3', campo: 'textoAjuda.significado',
          de: 'Avalia se a equipe conseguiria influenciar diretamente indicadores de resultado próprios.',
          para: 'Avalia se a equipe conseguiria influenciar diretamente indicadores de resultado próprios. Este critério não define a natureza arquitetural do item: um resultado pode existir e ser mensurável (P2, P7) sem um indicador que uma squad consiga mover.' },
        { pergunta: 'S6', campo: 'titulo',
          de: 'Conhecimento/capacidades relativamente estáveis',
          para: 'Conhecimentos e especialidades relativamente estáveis' },
        { pergunta: 'S6', campo: 'texto',
          de: 'Existe um conjunto relativamente estável de conhecimentos e capacidades necessário para evoluir essa solução?',
          para: 'Existe um conjunto relativamente estável de conhecimentos e especialidades necessário para evoluir este item ou domínio?' },
        { pergunta: 'S6', campo: 'justSim',
          de: 'SIM — Existe um conjunto relativamente estável de conhecimentos e capacidades necessário.',
          para: 'SIM — Existe um conjunto relativamente estável de conhecimentos e especialidades necessário.' },
        { pergunta: 'S6', campo: 'justNao',
          de: 'NÃO — Não existe um conjunto relativamente estável de conhecimentos e capacidades necessário.',
          para: 'NÃO — Não existe um conjunto relativamente estável de conhecimentos e especialidades necessário.' },
        { pergunta: 'S7', campo: 'textoAjuda.significado',
          de: 'Avalia se uma squad conseguiria melhorar o resultado sem depender continuamente de outras squads para praticamente todas as decisões ou entregas.',
          para: 'Avalia se uma squad conseguiria melhorar o resultado sem depender continuamente de outras squads para praticamente todas as decisões ou entregas. Avalie a equipe, não o objeto: um item sem autonomia estrutural (P5 = NÃO), como um Componente, pode ser cuidado por uma equipe autônoma, e um Produto/Serviço autônomo pode ser cuidado por uma equipe que depende de outras squads.' },
        { pergunta: 'S8', campo: 'texto',
          de: 'Existe um responsável claro pelo resultado dessa solução?',
          para: 'Existe um responsável claro pelo resultado deste item ou domínio?' },
        { pergunta: 'S8', campo: 'textoAjuda.significado',
          de: 'Avalia se existe alguém ou uma estrutura de responsabilidade clara pelo resultado da solução.',
          para: 'Avalia se existe hoje alguém ou uma estrutura de responsabilidade clara pelo resultado do item ou domínio. Não confunda com P8, que pergunta se o objeto forma uma solução coerente: um Produto/Serviço pode estar sem responsável claro.' },
        { pergunta: 'S8', campo: 'justSim',
          de: 'SIM — Existe um responsável claro pelo resultado desta solução.',
          para: 'SIM — Existe um responsável claro pelo resultado deste item ou domínio.' },
        { pergunta: 'S8', campo: 'justNao',
          de: 'NÃO — Não existe um responsável claro pelo resultado desta solução.',
          para: 'NÃO — Não existe um responsável claro pelo resultado deste item ou domínio.' }
      ]
    }
  ];
  function correcaoPorId(id) { return CORRECOES_EDITORIAIS.filter(function (c) { return c.id === id; })[0] || null; }
  function listarCorrecoesEditoriais(codigo) {
    return CORRECOES_EDITORIAIS.filter(function (c) { return !codigo || c.codigo === codigo; });
  }
  /* Campo com ponto = subcampo (textoAjuda.significado). Ausente, null e ''
     são a mesma coisa: "o campo não existe". */
  function lerCampo(p, campo) {
    var partes = campo.split('.');
    var v = p;
    for (var i = 0; i < partes.length; i++) {
      if (v == null || typeof v !== 'object') return undefined;
      v = v[partes[i]];
    }
    return v;
  }
  function vazio(v) { return v == null || v === ''; }
  /* Grava (ou, com valor vazio, retira) o campo na pergunta. Um objeto de
     ajuda que fica sem nenhum subcampo também sai, para não publicar "{}". */
  function gravarCampo(p, campo, valor) {
    var partes = campo.split('.');
    var alvo = p;
    for (var i = 0; i < partes.length - 1; i++) {
      if (alvo[partes[i]] == null || typeof alvo[partes[i]] !== 'object') {
        if (vazio(valor)) return;
        alvo[partes[i]] = {};
      }
      alvo = alvo[partes[i]];
    }
    var folha = partes[partes.length - 1];
    if (vazio(valor)) delete alvo[folha]; else alvo[folha] = valor;
    if (partes.length > 1 && !Object.keys(alvo).length) delete p[partes[0]];
  }
  function valorVigente(codigo, pergunta, campo) {
    var p = perguntasDaVersao(codigo, versaoAtual(codigo)).filter(function (x) { return x.codigoEstavel === pergunta; })[0];
    return p ? lerCampo(p, campo) : undefined;
  }
  /* Textos que o campo pode ter SEM que ninguém o tenha editado à mão: o "de"
     do próprio ajuste e o que correções ANTERIORES da lista deram ou tiraram
     daquele campo. Nunca o "para" de uma correção posterior (ver 'substituida'). */
  function textosConhecidos(corr, aj) {
    var conhecidos = [aj.de];
    for (var i = 0; i < CORRECOES_EDITORIAIS.length && CORRECOES_EDITORIAIS[i] !== corr; i++) {
      var outra = CORRECOES_EDITORIAIS[i];
      if (outra.codigo !== corr.codigo) continue;
      outra.ajustes.forEach(function (o) {
        if (o.pergunta === aj.pergunta && o.campo === aj.campo) conhecidos.push(o.de, o.para);
      });
    }
    return conhecidos;
  }
  function textosPosteriores(corr, aj) {
    var depois = [], passou = false;
    CORRECOES_EDITORIAIS.forEach(function (outra) {
      if (outra === corr) { passou = true; return; }
      if (!passou || outra.codigo !== corr.codigo) return;
      outra.ajustes.forEach(function (o) {
        if (o.pergunta === aj.pergunta && o.campo === aj.campo) depois.push(o.para);
      });
    });
    return depois;
  }
  function mesmoTexto(a, b) { return vazio(a) ? vazio(b) : a === b; }
  function contem(lista, v) { return lista.some(function (x) { return mesmoTexto(x, v); }); }
  /* Situação de cada ajuste contra o conteúdo VIGENTE agora:
     'pendente' (o campo ainda tem um texto anterior conhecido — ou não
     existe, quando o ajuste o cria), 'aplicada' (já é o novo),
     'substituida' (uma correção posterior já o levou ao texto dela),
     'divergente' (outro texto — edição própria, respeitada e nunca
     sobrescrita). tipo: 'alterar' | 'criar' (de null) | 'remover' (para ''). */
  function situacaoCorrecaoEditorial(id) {
    var corr = correcaoPorId(id);
    if (!corr) return null;
    var ajustes = corr.ajustes.map(function (aj) {
      var atual = valorVigente(corr.codigo, aj.pergunta, aj.campo);
      var estado = mesmoTexto(atual, aj.para) ? 'aplicada'
        : contem(textosConhecidos(corr, aj), atual) ? 'pendente'
        : contem(textosPosteriores(corr, aj), atual) ? 'substituida' : 'divergente';
      var tipo = aj.de === null ? 'criar' : vazio(aj.para) ? 'remover' : 'alterar';
      return { pergunta: aj.pergunta, campo: aj.campo, de: aj.de, para: aj.para, atual: vazio(atual) ? null : atual, estado: estado, tipo: tipo };
    });
    var conta = function (campo, valor) { return ajustes.filter(function (a) { return a[campo] === valor; }).length; };
    var pendentes = conta('estado', 'pendente');
    var divergentes = conta('estado', 'divergente');
    var pendentesDo = function (tipo) { return ajustes.filter(function (a) { return a.estado === 'pendente' && a.tipo === tipo; }).length; };
    return {
      id: corr.id, codigo: corr.codigo, titulo: corr.titulo, descricao: corr.descricao, ajustes: ajustes,
      pendentes: pendentes, divergentes: divergentes,
      aAlterar: pendentesDo('alterar'), aCriar: pendentesDo('criar'), aRemover: pendentesDo('remover'),
      jaAplicados: conta('estado', 'aplicada'), substituidos: conta('estado', 'substituida'),
      aplicada: pendentes === 0 && divergentes === 0,
      haRascunho: !!rascunhoAtual(corr.codigo),
      carregada: configCarregada(corr.codigo),
      versaoAtual: versaoAtual(corr.codigo)
    };
  }
  /* Publica a correção como uma versão NOVA (publicarConteudo). Nunca às
     cegas: exige a config do servidor carregada e nenhum rascunho em
     andamento (publicar limpa o rascunho — descartaria o trabalho de outra
     pessoa). Só os ajustes 'pendente' entram; 'divergente' nunca é tocado.
     cb(erro|null, {novaVersao, aplicados, ignorados}). */
  function aplicarCorrecaoEditorial(id, usuario, cb) {
    var corr = correcaoPorId(id);
    if (!corr) { cb('correcao-desconhecida'); return; }
    if (!configCarregada(corr.codigo)) { cb('config-nao-carregada'); return; }
    if (rascunhoAtual(corr.codigo)) { cb('rascunho-em-andamento'); return; }
    var situacaoAntes = situacaoCorrecaoEditorial(id);
    if (!situacaoAntes.pendentes) { cb('nada-a-aplicar', { divergentes: situacaoAntes.divergentes }); return; }
    var perguntas = JSON.parse(JSON.stringify(perguntasDaVersao(corr.codigo, versaoAtual(corr.codigo))));
    var aplicados = [], ignorados = [];
    situacaoAntes.ajustes.forEach(function (aj) {
      if (aj.estado !== 'pendente') { if (aj.estado === 'divergente') ignorados.push(aj.pergunta + '.' + aj.campo); return; }
      var p = perguntas.filter(function (x) { return x.codigoEstavel === aj.pergunta; })[0];
      gravarCampo(p, aj.campo, aj.para);
      aplicados.push(aj.pergunta + '.' + aj.campo);
    });
    publicarConteudo(corr.codigo, perguntas, usuario, function (err, info) {
      if (err) { cb(err); return; }
      cb(null, { novaVersao: info.novaVersao, aplicados: aplicados, ignorados: ignorados, alteradas: info.alteradas });
    });
  }

  /* Ponto de partida pra tela de edição: reaproveita um rascunho já
     existente (outra sessão pode ter começado a editar), ou clona a versão
     publicada atual — nunca edita os objetos em cache diretamente. */
  function iniciarOuObterRascunho(codigo) {
    var existente = rascunhoAtual(codigo);
    if (existente && existente.perguntas) return JSON.parse(JSON.stringify(existente));
    return { perguntas: JSON.parse(JSON.stringify(perguntasDaVersao(codigo, versaoAtual(codigo)))) };
  }

  function salvarRascunho(codigo, perguntas, usuario, cb) {
    var norm = normalizarPerguntas(codigo, perguntas);
    if (norm.erro) { if (cb) cb(norm.erro); return; }
    perguntas = norm.perguntas;
    db().ref(NODE_CONFIG + '/' + codigo + '/rascunho').set(
      { perguntas: perguntas, atualizadoEm: new Date().toISOString(), atualizadoPor: usuario || null },
      function (err) { if (cb) cb(err || null); }
    );
  }

  function descartarRascunho(codigo, cb) {
    db().ref(NODE_CONFIG + '/' + codigo + '/rascunho').remove(function (err) { if (cb) cb(err || null); });
  }

  /* Compara só os CAMPOS_EDITORIAVEIS — qualquer diferença em identidade/
     regra (codigoEstavel, ordem…) nunca chega até aqui, porque a tela de
     edição não permite alterá-los (ver questionarios-admin em
     avaliacao-produto.js). */
  function diffPerguntas(perguntasAntigas, perguntasNovas) {
    var porCodigo = {};
    (perguntasAntigas || []).forEach(function (p) { porCodigo[p.codigoEstavel] = p; });
    var alteradas = [];
    (perguntasNovas || []).forEach(function (novo) {
      var antigo = porCodigo[novo.codigoEstavel] || {};
      var campos = CAMPOS_EDITORIAVEIS.filter(function (campo) {
        return JSON.stringify(antigo[campo] || null) !== JSON.stringify(novo[campo] || null);
      });
      if (campos.length) alteradas.push({ codigoEstavel: novo.codigoEstavel, campos: campos, antigo: antigo, novo: novo });
    });
    return alteradas;
  }

  /* PUBLICAR: cria uma versão NOVA (nunca sobrescreve nenhuma anterior),
     aponta versaoPublicada pra ela, limpa o rascunho e grava uma entrada de
     auditoria por CAMPO alterado em cada pergunta — tudo num update()
     atômico só. Nunca mexe em avaliações já respondidas: elas continuam
     lendo, pra sempre, o snapshot gravado na própria resposta (ver
     avaliacao-produto.js) ou, na falta dele, a versão que estava vigente
     quando a avaliação foi iniciada (questionnaireContentVersion). */
  function publicarRascunho(codigo, usuario, cb) {
    var rascunho = rascunhoAtual(codigo);
    if (!rascunho || !rascunho.perguntas) { cb('sem-rascunho'); return; }
    publicarConteudo(codigo, rascunho.perguntas, usuario, cb);
  }

  function publicarConteudo(codigo, perguntas, usuario, cb) {
    /* Sem a config do servidor, versaoAtual() não é confiável (ver
       configCarregada) — nunca publica às cegas. */
    if (!configCarregada(codigo)) { cb('config-nao-carregada'); return; }
    var norm = normalizarPerguntas(codigo, perguntas);
    if (norm.erro) { cb(norm.erro); return; }
    perguntas = norm.perguntas;
    var versaoAntiga = versaoAtual(codigo);
    var perguntasAntigas = perguntasDaVersao(codigo, versaoAntiga);
    var alteradas = diffPerguntas(perguntasAntigas, perguntas);
    var novaVersao = versaoAntiga + 1;
    var agora = new Date().toISOString();
    var updates = {};
    updates[NODE_CONFIG + '/' + codigo + '/versaoPublicada'] = novaVersao;
    updates[NODE_CONFIG + '/' + codigo + '/versoes/' + novaVersao] = { perguntas: perguntas, publicadoEm: agora, publicadoPor: usuario || null };
    updates[NODE_CONFIG + '/' + codigo + '/rascunho'] = null;
    updates[NODE_CONFIG + '/' + codigo + '/nome'] = (PADRAO[codigo] && PADRAO[codigo].nome) || codigo;
    alteradas.forEach(function (alt) {
      alt.campos.forEach(function (campo) {
        var chave = db().ref(NODE_AUDITORIA + '/' + codigo).push().key;
        updates[NODE_AUDITORIA + '/' + codigo + '/' + chave] = {
          pergunta: alt.codigoEstavel, campo: campo,
          valorAnterior: alt.antigo[campo] != null ? alt.antigo[campo] : null,
          valorNovo: alt.novo[campo] != null ? alt.novo[campo] : null,
          usuario: usuario || null, dataHora: agora, versaoAnterior: versaoAntiga, novaVersao: novaVersao
        };
      });
    });
    db().ref().update(updates, function (err) {
      if (cb) cb(err || null, { novaVersao: novaVersao, alteradas: alteradas });
    });
  }

  /* "Rollback": publica o CONTEÚDO de uma versão antiga como uma versão
     NOVA (novaVersao = versaoAtual + 1) — nunca apaga nem reescreve as
     versões existentes, e nunca toca no histórico das avaliações (elas
     continuam com seus próprios snapshots/questionnaireContentVersion,
     intocados). */
  function publicarVersaoAnterior(codigo, versaoAlvo, usuario, cb) {
    var perguntas = perguntasDaVersao(codigo, versaoAlvo);
    if (!perguntas || !perguntas.length) { cb('versao-nao-encontrada'); return; }
    publicarConteudo(codigo, JSON.parse(JSON.stringify(perguntas)), usuario, cb);
  }

  /* A versão 1 (conteúdo de fábrica, PADRAO) nunca é gravada explicitamente
     em versoes/1 — só existe como fallback de leitura (ver perguntasDaVersao)
     — mas continua sendo uma versão real, restaurável (rollback) e listável,
     então entra sempre aqui mesmo sem uma entrada própria no Firebase. */
  function listarVersoes(codigo) {
    var cfg = cache[codigo];
    var numeros = (cfg && cfg.versoes) ? Object.keys(cfg.versoes).map(Number) : [];
    if (numeros.indexOf(1) === -1) numeros.push(1);
    return numeros.sort(function (a, b) { return a - b; });
  }

  function situacao(codigo) {
    var cfg = cache[codigo] || {};
    var v = versaoAtual(codigo);
    var infoVersao = cfg.versoes && cfg.versoes[v];
    return {
      nome: cfg.nome || (PADRAO[codigo] && PADRAO[codigo].nome) || codigo,
      descricao: cfg.descricao || (PADRAO[codigo] && PADRAO[codigo].descricao) || '',
      qtdPerguntas: perguntasDaVersao(codigo, v).length,
      versaoPublicada: v,
      temRascunho: !!rascunhoAtual(codigo),
      ultimaAlteracaoEm: infoVersao ? infoVersao.publicadoEm : null,
      ultimaAlteracaoPor: infoVersao && infoVersao.publicadoPor ? infoVersao.publicadoPor.name || infoVersao.publicadoPor.email : null
    };
  }

  function auditoria(codigo, cb) {
    db().ref(NODE_AUDITORIA + '/' + codigo).once('value', function (snap) {
      var val = snap.val() || {};
      var lista = Object.keys(val).map(function (k) { return Object.assign({ _key: k }, val[k]); });
      lista.sort(function (a, b) { return (a.dataHora || '') < (b.dataHora || '') ? 1 : -1; });
      cb(lista);
    });
  }

  /* ===================== CONTEÚDO POR VERSÃO DO MOTOR (H1-B) =====================
     O questionário de cima (versaoPublicada/versoes/rascunho) é o conteúdo do motor EM VIGOR — hoje o v1, com a
     estrutura de PADRAO. A redação de uma versão NOVA do motor (que muda a estrutura: D2) fica numa trilha à parte,
     questionarios-config/<codigo>/motores/<versão do motor>/{ rascunho, versoes, versaoPublicada }, para não
     trocar o texto que o site usa enquanto o motor dele está em vigor.
       - A estrutura exigida vem do NÚCLEO do motor (contratoDoQuestionario: códigos, tipos e opções exatos); o
         texto é livre. conteudoCompativel prova o par, e o vínculo motorCompativel é gravado AQUI, pelo sistema,
         com a versão para a qual o conteúdo foi montado — nunca um campo do editor nem da carga inicial.
       - Nesta etapa só existe RASCUNHO: importar a carga inicial (arquivo de dados separado, carregado sob
         demanda; não é lógica e não é fallback), ler e descartar. Publicar o par motor + conteúdo é governança
         (H2) — nada aqui muda versaoPublicada nem o texto que o site usa.
       - Sem fallback: conteúdo de uma versão de motor ≥ 2 que não existe é null (nunca o texto v1 ou de fábrica). */
  function nucleoMotor() { return window.faMotorPosicionamentoNucleo || null; }
  function trilha(codigo, versaoMotor) {
    var cfg = cache[codigo];
    return (cfg && cfg.motores && cfg.motores[versaoMotor]) || null;
  }
  function normalizarConteudoMotor(codigo, perguntas, versaoMotor) {
    var N = nucleoMotor(), def;
    try { def = N && N.definicao(versaoMotor); } catch (e) { def = null; }
    if (!def || def.questionario !== codigo) return { erro: 'sem-contrato' };
    if (!Array.isArray(perguntas)) return { erro: 'estrutura-divergente' };
    var contrato = N.contratoDoQuestionario(def), porCodigo = {};
    for (var i = 0; i < perguntas.length; i++) {
      var c = perguntas[i] && perguntas[i].codigoEstavel;
      if (!c || porCodigo[c]) return { erro: 'estrutura-divergente' };
      porCodigo[c] = perguntas[i];
    }
    if (perguntas.length !== contrato.itens.length) return { erro: 'estrutura-divergente' };
    var out = [];
    for (var j = 0; j < contrato.itens.length; j++) {
      var it = contrato.itens[j], orig = porCodigo[it.codigoEstavel];
      if (!orig) return { erro: 'estrutura-divergente' };
      var p = JSON.parse(JSON.stringify(orig));
      p.tipo = it.tipo;   /* o tipo vem do contrato, nunca do conteúdo */
      Object.keys(CAMPOS_SO_DO_TIPO).forEach(function (outro) {
        if (outro === it.tipo) return;
        CAMPOS_SO_DO_TIPO[outro].raiz.forEach(function (campo) { delete p[campo]; });
        if (p.textoAjuda && typeof p.textoAjuda === 'object') {
          CAMPOS_SO_DO_TIPO[outro].ajuda.forEach(function (campo) { delete p.textoAjuda[campo]; });
          if (!Object.keys(p.textoAjuda).length) delete p.textoAjuda;
        }
      });
      if (it.opcoes) {
        var dadas = {};
        (Array.isArray(p.opcoes) ? p.opcoes : []).forEach(function (o) { if (o && o.codigo) dadas[o.codigo] = o; });
        if (Object.keys(dadas).length !== it.opcoes.length || it.opcoes.some(function (oc) { return !dadas[oc]; })) return { erro: 'estrutura-divergente' };
        /* os códigos e a ordem vêm do contrato; de cada opção, só o editorial */
        p.opcoes = it.opcoes.map(function (oc) {
          var o = dadas[oc], n = { codigo: oc };
          if (typeof o.rotulo === 'string') n.rotulo = o.rotulo;
          if (typeof o.interpretacao === 'string') n.interpretacao = o.interpretacao;
          return n;
        });
      }
      out.push(p);
    }
    var prova = N.conteudoCompativel(def, { codigo: codigo, motorCompativel: versaoMotor, perguntas: out });
    if (!prova.compativel) return { erro: 'incompativel', detalhes: prova.erros };
    return { perguntas: out };
  }
  function rascunhoConteudoMotor(codigo, versaoMotor) {
    var t = trilha(codigo, versaoMotor);
    return (t && t.rascunho) || null;
  }
  /* conteúdo PUBLICADO de uma versão de motor (o 1 é o questionário de cima); null quando não existe */
  function perguntasDoConteudoMotor(codigo, versaoMotor, versaoConteudo) {
    if (versaoMotor === 1) return perguntasDaVersao(codigo, versaoConteudo);
    var t = trilha(codigo, versaoMotor);
    var v = versaoConteudo || (t && t.versaoPublicada);
    return (t && t.versoes && v && t.versoes[v] && t.versoes[v].perguntas) || null;
  }
  function conteudoPerguntaMotor(codigo, versaoMotor, codigoEstavel, versaoConteudo) {
    if (versaoMotor === 1) return conteudoPergunta(codigo, codigoEstavel, versaoConteudo);
    var ps = perguntasDoConteudoMotor(codigo, versaoMotor, versaoConteudo);
    return (ps && ps.filter(function (p) { return p.codigoEstavel === codigoEstavel; })[0]) || null;
  }
  function situacaoConteudoMotor(codigo, versaoMotor) {
    var N = nucleoMotor(), r = rascunhoConteudoMotor(codigo, versaoMotor), t = trilha(codigo, versaoMotor), prova = null;
    if (r && N) {
      try { prova = N.conteudoCompativel(N.definicao(versaoMotor), { codigo: codigo, motorCompativel: r.motorCompativel, perguntas: r.perguntas }); } catch (e) { prova = { compativel: false, erros: [{ codigo: 'sem-contrato' }] }; }
    }
    return { carregada: configCarregada(codigo), temRascunho: !!r, rascunho: r, compativel: !!(prova && prova.compativel), erros: prova ? prova.erros : [],
      versaoPublicada: (t && t.versaoPublicada) || null, emVigor: !!(N && N.versaoEmVigor() === versaoMotor) };
  }
  /* a carga inicial da redação de uma versão de motor: arquivo de DADOS separado
     (conteudo-inicial-posicionamento-v<N>.js → window.faConteudoInicialPosicionamento[<N>]) */
  function importarConteudoInicial(codigo, versaoMotor, usuario, cb) {
    if (!configCarregada(codigo)) { cb('config-nao-carregada'); return; }
    if (rascunhoConteudoMotor(codigo, versaoMotor)) { cb('ja-existe-rascunho'); return; }
    var carga = window.faConteudoInicialPosicionamento && window.faConteudoInicialPosicionamento[versaoMotor];
    if (!carga || carga.codigo !== codigo || !Array.isArray(carga.perguntas)) { cb('sem-carga-inicial'); return; }
    var norm = normalizarConteudoMotor(codigo, carga.perguntas, versaoMotor);
    if (norm.erro) { cb(norm.erro, norm.detalhes); return; }
    db().ref(NODE_CONFIG + '/' + codigo + '/motores/' + versaoMotor + '/rascunho').set(
      { perguntas: norm.perguntas, motorCompativel: versaoMotor, origem: 'carga-inicial', atualizadoEm: new Date().toISOString(), atualizadoPor: usuario || null },
      function (err) { cb(err || null); }
    );
  }
  /* H2-a: editar o RASCUNHO da redação de uma versão nova do motor — só o texto: a estrutura (códigos, tipos, opções)
     é refeita pelo contrato do núcleo e o vínculo motorCompativel continua do sistema. Recusa se o rascunho mudou
     desde que foi aberto (outra pessoa salvou): nunca sobrescreve em silêncio. */
  function salvarRascunhoConteudoMotor(codigo, versaoMotor, perguntas, usuario, baseAtualizadoEm, cb) {
    if (!configCarregada(codigo)) { cb('config-nao-carregada'); return; }
    var atual = rascunhoConteudoMotor(codigo, versaoMotor);
    if (!atual) { cb('sem-rascunho'); return; }
    if ((atual.atualizadoEm || null) !== (baseAtualizadoEm || null)) { cb('rascunho-mudou'); return; }
    var norm = normalizarConteudoMotor(codigo, perguntas, versaoMotor);
    if (norm.erro) { cb(norm.erro, norm.detalhes); return; }
    db().ref(NODE_CONFIG + '/' + codigo + '/motores/' + versaoMotor + '/rascunho').set(
      { perguntas: norm.perguntas, motorCompativel: versaoMotor, origem: atual.origem === 'carga-inicial' ? 'carga-inicial-editada' : (atual.origem || 'edicao'),
        atualizadoEm: new Date().toISOString(), atualizadoPor: usuario || null },
      function (err) { cb(err || null); }
    );
  }
  /* versões PUBLICADAS da redação de uma versão de motor (≥ 2), da mais nova para a mais antiga */
  function versoesPublicadasConteudoMotor(codigo, versaoMotor) {
    var t = trilha(codigo, versaoMotor), out = [];
    Object.keys((t && t.versoes) || {}).forEach(function (v) {
      var x = t.versoes[v];
      if (x) out.push({ versao: Number(v), perguntas: x.perguntas || [], motorCompativel: x.motorCompativel, publicadoEm: x.publicadoEm || null, publicadoPor: x.publicadoPor || null,
        digestRedacao: x.digestRedacao || null, auditoriaId: x.auditoriaId || null,
        /* B2: publicada NÃO é validada — só a fronteira confiável (B4) poderá marcar uma redação como apta a entrar em
           vigor; as regras do banco não deixam a tela gravar esse campo */
        validadaParaAtivacao: false });
    });
    return out.sort(function (a, b) { return b.versao - a.versao; });
  }
  /* B2 — PUBLICAR a redação de um motor novo. A garantia é do BANCO (database.rules.json, provada no emulador em
     teste-rules-redacao-motor.js), não da tela: versão publicada só é criada (nunca alterada nem apagada), o ponteiro
     versaoPublicada só avança de 1 em 1 na mesma gravação que cria a versão, a auditoria é obrigatória e só de
     acréscimo, autoria = UID e e-mail da sessão, horário = o do servidor. Publicar NÃO valida para ativação nem põe o
     motor em vigor. Em caso de problema, admin geral SUSPENDE novas publicações (publicacaoSuspensa) — o histórico
     continua protegido; nunca se volta a deixar versão publicada mutável. */
  var PUBLICACAO_CONTEUDO_MOTOR = Object.freeze({ liberada: true, garantidaPeloBanco: true,
    aviso: 'A versão publicada não poderá ser alterada nem apagada. Publicar não põe o motor em vigor e não muda nenhuma avaliação; a redação ainda precisará ser validada pela fronteira confiável antes de qualquer ativação.' });
  var NODE_AUD_MOTOR = 'questionarios-motor-auditoria';
  function servidorAgora() { return firebase.database.ServerValue.TIMESTAMP; }
  function identidade(usuario) {
    var u = null;
    try { u = firebase.auth().currentUser; } catch (e) { u = null; }
    if (!u || !u.uid || !u.email) return null;
    return { uid: u.uid, email: u.email, name: String((usuario && usuario.name) || u.email).slice(0, 200) };
  }
  function suspensaoPublicacao(codigo, versaoMotor) {
    var t = trilha(codigo, versaoMotor), s = t && t.publicacaoSuspensa;
    return s && s.ativa === true ? s : null;
  }
  /* Publica o RASCUNHO como a versão seguinte. Uma gravação só (entra tudo ou nada): a versão, o ponteiro, a
     auditoria e a remoção do rascunho. cb(null, {versao}) | cb('sem-resposta') — nunca "falhou" nem "publicou":
     quem chama confere o banco | cb(motivo) */
  function publicarConteudoMotor(codigo, versaoMotor, usuario, cb, prazoMs) {
    if (!configCarregada(codigo)) { cb('config-nao-carregada'); return; }
    if (suspensaoPublicacao(codigo, versaoMotor)) { cb('publicacao-suspensa'); return; }
    var r = rascunhoConteudoMotor(codigo, versaoMotor);
    if (!r || !r.perguntas) { cb('sem-rascunho'); return; }
    var norm = normalizarConteudoMotor(codigo, r.perguntas, versaoMotor);
    if (norm.erro) { cb(norm.erro, norm.detalhes); return; }
    var G = window.faGovernancaPosicionamento;
    if (!G) { cb('governanca-indisponivel'); return; }
    var quem = identidade(usuario);
    if (!quem) { cb('sem-sessao'); return; }
    var t = trilha(codigo, versaoMotor), n = ((t && t.versaoPublicada) || 0) + 1, digest = G.digestRedacao(norm.perguntas);
    var base = NODE_CONFIG + '/' + codigo + '/motores/' + versaoMotor, audId = db().ref(NODE_AUD_MOTOR + '/' + codigo + '/' + versaoMotor).push().key;
    var u = {};
    u[base + '/versoes/' + n] = { perguntas: norm.perguntas, motorCompativel: versaoMotor, publicadoEm: servidorAgora(), publicadoPor: quem, auditoriaId: audId, digestRedacao: digest };
    u[base + '/versaoPublicada'] = n;
    u[base + '/rascunho'] = null;
    u[NODE_AUD_MOTOR + '/' + codigo + '/' + versaoMotor + '/' + audId] = { tipo: 'publicacao', versao: n, digestRedacao: digest, usuario: { uid: quem.uid, email: quem.email }, dataHora: servidorAgora() };
    gravarComPrazo(u, prazoMs, function (err) { cb(err, err ? undefined : { versao: n, digestRedacao: digest }); });
  }
  /* Suspender (ativa = true) ou retomar (false) novas publicações — só admin geral (as regras conferem); motivo obrigatório */
  function definirSuspensaoPublicacao(codigo, versaoMotor, ativa, motivo, usuario, cb, prazoMs) {
    if (!configCarregada(codigo)) { cb('config-nao-carregada'); return; }
    motivo = String(motivo || '').trim();
    if (!motivo) { cb('sem-motivo'); return; }
    if (!!suspensaoPublicacao(codigo, versaoMotor) === !!ativa) { cb('sem-mudanca'); return; }
    var quem = identidade(usuario);
    if (!quem) { cb('sem-sessao'); return; }
    var audId = db().ref(NODE_AUD_MOTOR + '/' + codigo + '/' + versaoMotor).push().key, u = {};
    u[NODE_CONFIG + '/' + codigo + '/motores/' + versaoMotor + '/publicacaoSuspensa'] = { ativa: !!ativa, motivo: motivo.slice(0, 500), por: quem, em: servidorAgora(), auditoriaId: audId };
    u[NODE_AUD_MOTOR + '/' + codigo + '/' + versaoMotor + '/' + audId] = { tipo: ativa ? 'suspensao' : 'retomada', motivo: motivo.slice(0, 500), usuario: { uid: quem.uid, email: quem.email }, dataHora: servidorAgora() };
    gravarComPrazo(u, prazoMs, cb);
  }
  function gravarComPrazo(payload, prazoMs, cb) {
    var respondido = false;
    var relogio = setTimeout(function () { if (respondido) return; respondido = true; cb('sem-resposta'); }, prazoMs || 15000);
    try {
      db().ref().update(payload, function (err) { if (respondido) return; respondido = true; clearTimeout(relogio); cb(err || null); });
    } catch (e) { if (respondido) return; respondido = true; clearTimeout(relogio); cb(e); }
  }
  function descartarRascunhoConteudoMotor(codigo, versaoMotor, cb) {
    db().ref(NODE_CONFIG + '/' + codigo + '/motores/' + versaoMotor + '/rascunho').remove(function (err) { if (cb) cb(err || null); });
  }

  window.faQuestionarios = {
    CODIGOS: { CLASSIFICACAO_ARQUITETURAL: 'CLASSIFICACAO_ARQUITETURAL', ADEQUACAO_SQUAD: 'ADEQUACAO_SQUAD',
      POSICIONAMENTO_ORGANIZACIONAL: 'POSICIONAMENTO_ORGANIZACIONAL' },
    CAMPOS_EDITORIAVEIS: CAMPOS_EDITORIAVEIS,
    TIPOS_PERGUNTA: TIPOS_PERGUNTA,
    RESPOSTAS_DIAGNOSTICO: RESPOSTAS_DIAGNOSTICO,
    tipoPergunta: tipoPergunta,
    tipoExplicito: tipoExplicito,
    respostasDoTipo: respostasDoTipo,
    normalizarPerguntas: normalizarPerguntas,
    normalizarConteudoMotor: normalizarConteudoMotor,
    rascunhoConteudoMotor: rascunhoConteudoMotor,
    perguntasDoConteudoMotor: perguntasDoConteudoMotor,
    conteudoPerguntaMotor: conteudoPerguntaMotor,
    situacaoConteudoMotor: situacaoConteudoMotor,
    importarConteudoInicial: importarConteudoInicial,
    descartarRascunhoConteudoMotor: descartarRascunhoConteudoMotor,
    salvarRascunhoConteudoMotor: salvarRascunhoConteudoMotor,
    versoesPublicadasConteudoMotor: versoesPublicadasConteudoMotor,
    PUBLICACAO_CONTEUDO_MOTOR: PUBLICACAO_CONTEUDO_MOTOR,
    publicarConteudoMotor: publicarConteudoMotor,
    definirSuspensaoPublicacao: definirSuspensaoPublicacao,
    suspensaoPublicacao: suspensaoPublicacao,
    PADRAO: PADRAO,
    onMudanca: onMudanca,
    versaoAtual: versaoAtual,
    perguntasDaVersao: perguntasDaVersao,
    conteudoPergunta: conteudoPergunta,
    rascunhoAtual: rascunhoAtual,
    configCarregada: configCarregada,
    listarCorrecoesEditoriais: listarCorrecoesEditoriais,
    situacaoCorrecaoEditorial: situacaoCorrecaoEditorial,
    aplicarCorrecaoEditorial: aplicarCorrecaoEditorial,
    iniciarOuObterRascunho: iniciarOuObterRascunho,
    salvarRascunho: salvarRascunho,
    descartarRascunho: descartarRascunho,
    diffPerguntas: diffPerguntas,
    publicarRascunho: publicarRascunho,
    /* Publica um conjunto de perguntas dado diretamente por quem chama (ex.:
       o rascunho ainda em memória na tela de edição) — evita depender de um
       round-trip de leitura do Firebase entre salvar o rascunho e publicá-lo
       (o cache local só é atualizado quando o listener de onMudanca dispara,
       de forma assíncrona; ler rascunhoAtual() logo após salvarRascunho()
       pode ver o valor ANTERIOR ainda). Nunca lê o cache: sempre publica
       exatamente o que foi passado. */
    publicarPerguntas: publicarConteudo,
    publicarVersaoAnterior: publicarVersaoAnterior,
    listarVersoes: listarVersoes,
    situacao: situacao,
    auditoria: auditoria
  };
})();
