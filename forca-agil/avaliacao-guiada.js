/* AVALIAÇÃO GUIADA (versão 22) — a experiência de perguntas da Avaliação de Produto/Serviço.

   Módulo PURO (window.faAvaliacaoGuiada / module.exports): sem banco, sem DOM, sem relógio e SEM MOTOR. Traz as
   perguntas guiadas, uma por vez, com as condicionais, e só TRADUZ as respostas para os critérios P1–P16. Quem
   classifica continua sendo o motor oficial publicado (motor-arquitetura.js, chamado por avaliacao-produto.js);
   nenhuma regra ou precedência está aqui.

   Regras da tradução:
   - cada resposta guiada é gravada como foi escolhida (avaliacao.guiada.respostas); P1–P16 são derivados;
   - um critério só vira SIM ou NÃO quando a correspondência é direta (MAPA_RESPOSTAS, grupos de fatos); "Não sei",
     "mistura", duas naturezas no mesmo grupo e confirmações ausentes ficam '?' — nunca NÃO;
   - concluir exige SIM ou NÃO nos 16 critérios (a mesma exigência do sistema) e nenhuma pendência de confirmação.
   Origem: protótipo avaliacao_guiada_previ_v22.html (perguntas, condicionais, mapeamento e conferências). O motor
   simulado do protótipo (avaliarV7) não foi trazido. Prova: teste-avaliacao-guiada.js. */
(function () {
  'use strict';
  var VERSAO = 22;
  /* As 31 perguntas da v22, como estão no protótipo: etapa, pergunta, ajuda, por que perguntamos e alternativas
     [valor, rótulo, descrição]. Sem alternativas = Sim / Não / Não sei. */
  var PERGUNTAS = {
    P1: {
      stage: 'RESULTADO',
      q: 'Existe alguém que precisa do resultado deste item?',
      hint: 'Pense em quem precisa desse resultado e por quê. Pode ser um associado, pensionista, área da PREVI ou outro público.',
      why: 'P1 — necessidade e público identificável'
    },
    P2: {
      stage: 'RESULTADO',
      q: 'Ao utilizar este item, a pessoa obtém algum resultado que conseguimos identificar?',
      hint: 'O resultado pode ser proteção financeira (Capec), acesso a crédito (Empréstimo Simples), orientação (Assessoria Previdenciária) ou informação (Consulta de Contribuições). Não precisa ser algo físico.',
      why: 'P2 — resultado identificável; requer confirmação de atribuição'
    },
    C2: {
      stage: 'RESULTADO',
      q: 'O resultado que você identificou pertence ao próprio item que estamos avaliando ou a outro item que ele ajuda a funcionar?',
      hint: 'O empréstimo oferece crédito: esse é seu resultado. A análise de documentos ajuda a decidir um pedido, mas não é o benefício concedido. Já uma consulta tem como resultado mostrar informações, mesmo sendo uma funcionalidade.',
      why: 'Confirmação de P2 — resultado próprio do objeto ou de outro Produto/Serviço',
      opts: [['proprio', 'Do próprio item que estamos avaliando', 'Ele apresenta ou fornece o resultado descrito, mesmo que também faça parte de outra solução.'], ['outro', 'De outra entrega que este item ajuda a realizar', 'A atividade ou recurso contribui para um resultado oferecido por outro item.'], ['?', 'Não sei a qual item pertence o resultado', 'Ainda não consigo distinguir essas situações.']]
    },
    P3: {
      stage: 'RESULTADO',
      q: 'Você consegue explicar o que este item oferece ou realiza?',
      hint: 'Imagine explicar o item a alguém que não o conhece. Por exemplo: a Resenha PREVI apresenta informações; o Empréstimo Simples oferece crédito.',
      why: 'P3 — solução identificável'
    },
    P4: {
      stage: 'RESULTADO',
      q: 'Você consegue identificar o que este item inclui e o que fica fora dele?',
      hint: 'Pense no que está incluído e no que fica de fora. Por exemplo, consultar contribuições mostra os registros, mas não muda o valor da contribuição.',
      why: 'P4 — fronteira delimitada'
    },
    E1: {
      stage: 'AUTONOMIA',
      q: 'O item que estamos avaliando é uma tarefa, uma regra ou uma parte utilizada para realizar outra entrega?',
      hint: 'Pense no item, não em tudo o que é necessário para oferecê-lo. Analisar documentos é uma tarefa; um prazo de solicitação é uma regra; um mecanismo de cálculo é uma parte de uma solução. O Empréstimo Simples, por sua vez, é uma oferta de crédito.',
      why: 'Pista para P5; não determina autonomia automaticamente'
    },
    P5: {
      stage: 'ENTREGA',
      q: 'O item que você está avaliando é oferecido pela PREVI como uma solução própria para um público?',
      hint: 'Pense no item como um todo. Uma oferta pode utilizar atividades, regras, sistemas e outras partes para funcionar. Por exemplo, a Carteira de Pecúlios é uma oferta de proteção financeira; consultar contribuições é uma ação de consulta; o Perfil de Investimento é um elemento da gestão da reserva.',
      why: 'P5 — verificar se o objeto é uma oferta própria',
      opts: [['oferta', 'Sim, é uma oferta própria, com finalidade e resultado identificáveis.', 'Estou avaliando a oferta como um todo, não apenas as atividades que a fazem funcionar.'], ['parte', 'Não, é uma atividade, funcionalidade ou parte de outra oferta.', 'O próprio item é uma ação ou um elemento usado no funcionamento de outra entrega.'], ['mistura', 'O item mistura a oferta e partes dela. Preciso definir melhor o que estou avaliando.', 'Ainda não consigo separar a oferta completa de suas atividades ou componentes.'], ['?', 'Não sei responder.', 'Preciso de mais informações sobre o item.']]
    },
    C5: {
      stage: 'AUTONOMIA',
      q: 'Se este item deixasse de existir, o que desapareceria principalmente?',
      hint: 'Se o Empréstimo Simples deixasse de ser oferecido, a oferta de crédito desapareceria. Se o sistema usado para calcular suas parcelas mudasse, o empréstimo poderia continuar existindo.',
      why: 'Confirmação de P5 — entrega própria versus funcionamento de outros Produtos/Serviços',
      opts: [['entrega', 'Uma entrega oferecida às pessoas', 'Ex.: uma oferta de crédito ou uma cobertura de pecúlio.'], ['parte', 'Uma atividade, sistema, base de dados ou outra parte usada em entregas', 'Ex.: um mecanismo usado para calcular valores.'], ['?', 'Não sei dizer o que deixaria de existir', 'Ainda preciso entender melhor o papel do item.']]
    },
    P8: {
      stage: 'GESTÃO',
      q: 'A PREVI consegue verificar se as pessoas estão recebendo o resultado que este item se propõe a oferecer?',
      hint: 'Pense no resultado e no que cabe à PREVI acompanhar. No Empréstimo Simples, seria verificar a disponibilização do crédito aprovado; na Assessoria Previdenciária, a orientação prestada; na Resenha PREVI, a publicação disponibilizada. Se não tiver essa informação, responda “Não sei”.',
      why: 'P8 — acompanhamento do resultado oferecido, dentro da responsabilidade da PREVI',
      opts: [['S', 'Sim. A PREVI consegue verificar se o resultado está sendo oferecido conforme previsto.', 'Considere o que está sob a responsabilidade da PREVI.'], ['N', 'Não. Sei que a PREVI não realiza esse acompanhamento.', 'Escolha esta resposta apenas quando tiver essa informação.'], ['?', 'Não sei. Não tenho informações suficientes para responder.', 'Não é necessário adivinhar.']]
    },
    C8: {
      stage: 'GESTÃO',
      q: 'Existe alguém ou alguma área da PREVI responsável por acompanhar o resultado deste item?',
      hint: 'Não é necessário saber o nome da pessoa. Considere se existe uma responsabilidade definida por verificar se o item está cumprindo o que se propõe a fazer. Se não souber, responda “Não sei”.',
      why: 'Confirmação de P8 — responsabilidade pelo resultado oferecido, não pela venda de um parceiro',
      opts: [['entrega', 'Sim, há responsáveis na PREVI por acompanhar esse resultado.', 'Existe alguém ou alguma área encarregada de verificar a entrega.'], ['trabalho', 'Não, conheço somente os responsáveis por tarefas ou sistemas.', 'Não identifiquei quem acompanha o resultado do item como um todo.'], ['?', 'Não sei se existe essa responsabilidade definida.', 'Ainda preciso confirmar essa informação.']]
    },
    P9: {
      stage: 'NATUREZA',
      q: 'O item que estamos avaliando é o próprio meio de acesso, ou é algo que a pessoa encontra e utiliza por meio dele?',
      hint: 'Um aplicativo é um canal. O Empréstimo Simples é uma oferta que pode ser acessada por um canal. Consultar contribuições é uma ação que pode estar disponível nele.',
      why: 'P9 — distinguir Canal, Produto/Serviço e Funcionalidade sem presumir a classificação',
      opts: [['canal', 'É o próprio meio de acesso, como site, aplicativo, telefone ou atendimento presencial.', 'O item é o meio usado para acessar informações ou serviços.'], ['oferta', 'É uma oferta ou serviço acessado por algum canal.', 'Ex.: Empréstimo Simples.'], ['funcionalidade', 'É uma ação realizada por meio de um canal.', 'Ex.: consultar as contribuições.'], ['outro', 'É outro tipo de item.', 'Ex.: uma regra, publicação ou base de dados.'], ['?', 'Não sei qual dessas descrições corresponde ao item.', 'Preciso entender melhor o que está sendo avaliado.']]
    },
    F10I: {
      stage: 'INFORMAÇÃO',
      q: 'O próprio item é uma informação, como um dado ou valor que alguém precisa conhecer?',
      hint: 'Por exemplo, o valor de uma contribuição é uma informação. O extrato que mostra esse valor é um documento.',
      why: 'Investigação de P10: Informação'
    },
    F10D: {
      stage: 'DOCUMENTO',
      q: 'O próprio item é um documento ou uma publicação?',
      hint: 'Por exemplo, um extrato de contribuições ou a Resenha PREVI. Estamos falando do documento, e não da ação de consultá-lo.',
      why: 'Investigação de P10: Documento'
    },
    P11: {
      stage: 'DISTINGUIR',
      q: 'O que este item representa principalmente?',
      hint: 'Observe se estamos falando do que alguém recebe, de uma atividade específica ou de algo que a PREVI precisa saber fazer e manter ao longo do tempo.',
      why: 'P11 — investigar Capacidade sem confundi-la com tudo o que depende dela',
      opts: [['entrega', 'Algo oferecido ou disponibilizado a alguém', 'Ex.: orientação da Assessoria Previdenciária.'], ['tarefa', 'Uma atividade realizada para atender a uma necessidade', 'Ex.: analisar documentos de uma solicitação.'], ['capacidade', 'Algo que a PREVI precisa saber fazer e manter ao longo do tempo', 'Ex.: organizar e manter a gestão dos dados cadastrais.'], ['outro', 'Outro tipo de item', 'Ex.: um documento, um canal ou uma base de dados.'], ['?', 'Não sei identificar ainda', 'Preciso entender melhor o que o item representa.']]
    },
    P12: {
      stage: 'NATUREZA',
      q: 'Qual destas descrições combina melhor com o item que você está avaliando?',
      hint: 'Pense no próprio item. Empréstimo Simples é uma oferta de crédito; concessão de benefício é um processo; consultar contribuições é uma ação. Escolha a descrição que corresponde ao nome informado.',
      why: 'P12 — distinguir a oferta do Processo/Etapa, da ação e da responsabilidade organizacional',
      opts: [['entrega', 'Uma oferta, serviço ou vantagem disponibilizada às pessoas.', 'Ex.: Empréstimo Simples ou Carteira de Pecúlios.'], ['trabalho', 'O próprio processo de trabalho ou uma etapa dele.', 'Ex.: processo de concessão de benefício ou análise de documentos.'], ['acao', 'Uma ação específica realizada por uma pessoa ou pela PREVI.', 'Ex.: consultar contribuições ou conferir dados.'], ['gestao', 'Algo que a PREVI precisa saber organizar e manter continuamente.', 'Ex.: gestão dos dados cadastrais, não uma atualização isolada.'], ['outro', 'Um canal, documento, regra, base ou outro tipo de item.', 'Ex.: aplicativo, Resenha PREVI ou uma base cadastral.'], ['?', 'Não sei qual descrição corresponde ao item.', 'Preciso entender melhor o que o item é.']]
    },
    P12T: {
      stage: 'DISTINÇÃO',
      q: 'Esse item corresponde ao processo completo ou apenas a uma etapa?',
      hint: 'Concessão de benefício pode designar o processo completo. A análise de documentos é uma das etapas que podem fazer parte dele.',
      why: 'Detalhamento de P12 — Processo versus Etapa',
      opts: [['processo', 'O processo completo', 'Ex.: o conjunto de atividades para conceder um benefício.'], ['etapa', 'Uma etapa de um processo', 'Ex.: a análise dos documentos de um pedido.'], ['?', 'Não sei distinguir', 'Preciso verificar o alcance do trabalho.']]
    },
    F13M: {
      stage: 'TIPOS DE OFERTA',
      q: 'Este item é um dos tipos de um mesmo Produto/Serviço oferecido pela PREVI?',
      hint: 'Por exemplo, Capec Pleno é um dos tipos oferecidos na Carteira de Pecúlios. A Carteira de Pecúlios inteira não é apenas um desses tipos.',
      why: 'Investigação de P13: Modalidade',
      opts: [['tipo', 'Sim. Estou avaliando um dos tipos oferecidos dentro de um Produto/Serviço.', 'Ex.: Capec Pleno dentro da Carteira de Pecúlios.'], ['oferta', 'Não. Estou avaliando uma oferta por si só, e não um de seus tipos.', 'Ex.: Carteira de Pecúlios ou Empréstimo Simples.'], ['outro', 'Não se aplica. Estou avaliando uma atividade, documento, regra ou outro tipo de item.', 'Ex.: Consulta de Contribuições ou Resenha PREVI.'], ['?', 'Não sei identificar essa relação.', 'É preciso esclarecer o que o item representa.']]
    },
    F13O: {
      stage: 'DIFERENCIAR',
      q: 'O próprio item é uma escolha dentro de um Produto/Serviço, ou é algo que a pessoa pode contratar, acessar ou utilizar separadamente?',
      hint: 'Escolher uma alternativa dentro de um plano é diferente de decidir contratar outra oferta, como o Empréstimo Simples.',
      why: 'Investigação de Opção (P13) — escolha interna não é adesão facultativa',
      opts: [['alternativa', 'É uma alternativa dentro de um mesmo Produto/Serviço.', 'Ex.: uma opção de tributação dentro de um plano.'], ['facilidade', 'É a própria oferta ou serviço, que a pessoa pode decidir utilizar ou não.', 'Ex.: contratar o Empréstimo Simples.'], ['acao', 'É uma ação que a pessoa realiza para utilizar um Produto/Serviço.', 'Ex.: consultar o histórico de contribuições.'], ['condicao', 'É uma condição ou requisito para utilizar uma oferta.', 'Ex.: ser participante elegível para determinado benefício.'], ['outro', 'É outro tipo de item.', 'Ex.: uma publicação ou um sistema de cálculo.'], ['?', 'Não sei distinguir essas situações.', 'Preciso de mais informações sobre o item.']]
    },
    F13OC: {
      stage: 'CONFIRMAR',
      q: 'Essa escolha muda apenas uma alternativa interna de um Produto/Serviço que continua sendo o mesmo?',
      hint: 'Por exemplo, escolher um regime tributário dentro de um plano não é a mesma coisa que contratar um Produto/Serviço diferente.',
      why: 'Confirmação de F13O — escolha interna ou oferta distinta',
      opts: [['dentro', 'Sim, é uma escolha dentro do mesmo Produto/Serviço.', 'A oferta principal não muda.'], ['oferta', 'Não, a pessoa está escolhendo utilizar outra oferta.', 'Ex.: contratar outro serviço, em vez de escolher uma opção interna.'], ['?', 'Não sei confirmar essa relação.', 'Preciso saber onde essa escolha está prevista.']]
    },
    F13S: {
      stage: 'DIFERENCIAR',
      q: 'Qual é a relação deste item com outros Produtos/Serviços da PREVI?',
      hint: 'Uma oferta pode exigir que a pessoa tenha vínculo com a PREVI sem, por isso, fazer parte de um plano específico.',
      why: 'Investigação de Subproduto (P13) — pertencimento não é elegibilidade',
      opts: [['parte', 'É uma oferta que faz parte de outro Produto/Serviço específico.', 'Consigo identificar a oferta principal à qual pertence.'], ['propria', 'É uma oferta separada, mesmo que exija vínculo com a PREVI ou com um plano.', 'A condição para utilizar a oferta não significa que ela pertença a um plano.'], ['variacao', 'É apenas uma forma ou alternativa de utilizar outro Produto/Serviço.', 'Ex.: modalidade ou escolha disponível dentro de um plano.'], ['componente', 'É uma parte interna ou recurso usado em outros Produtos/Serviços.', 'Ex.: uma base de dados ou mecanismo de cálculo.'], ['outra', 'Não estamos avaliando uma oferta, mas outro tipo de item.', 'Ex.: processo, documento ou regra.'], ['?', 'Não sei qual é essa relação.', 'Preciso identificar como o item se relaciona a outras ofertas.']]
    },
    F13SP: {
      stage: 'CONFIRMAR',
      q: 'Dentro desse outro Produto/Serviço, o que este item representa?',
      hint: 'Verifique se o item é uma oferta identificável dentro de outro Produto/Serviço, ou somente uma escolha, atividade ou recurso usado nele.',
      why: 'Confirmação de F13S — não confundir Subproduto com Modalidade, Opção ou Componente',
      opts: [['oferta', 'Uma oferta identificável dentro do Produto/Serviço principal', 'Tem um resultado definido dentro da oferta principal.'], ['variacao', 'Uma forma de uso ou alternativa de escolha', 'Muda como a pessoa usa ou escolhe algo dentro da oferta.'], ['componente', 'Uma parte interna usada para a oferta funcionar', 'Ex.: um sistema ou conjunto de dados.'], ['?', 'Não sei distinguir', 'Preciso de mais informações sobre a relação.']]
    },
    F13SN: {
      stage: 'CONFIRMAR',
      q: 'Qual Produto/Serviço específico contém essa oferta?',
      hint: 'Informe o nome da oferta principal da qual este item faz parte. Não basta informar quem pode utilizá-lo.',
      why: 'Evidência de F13S — Produto/Serviço principal que contém a oferta',
      kind: 'text',
      placeholder: 'Nome do Produto/Serviço principal'
    },
    F13SV: {
      stage: 'DIFERENCIAR',
      q: 'Que tipo de forma ou alternativa você está avaliando?',
      hint: 'Escolha se o item é uma forma de uso, uma escolha dentro de um serviço ou uma ação que a pessoa realiza.',
      why: 'Desdobramento de F13S — conferir Modalidade, Opção ou Funcionalidade',
      opts: [['modalidade', 'Uma forma diferente de utilizar o mesmo Produto/Serviço', 'Ex.: uma modalidade prevista dentro de uma carteira.'], ['opcao', 'Uma escolha disponível dentro de um Produto/Serviço', 'Ex.: uma opção de tributação prevista no plano.'], ['funcionalidade', 'Uma ação disponível à pessoa', 'Ex.: consultar ou alterar informações.'], ['?', 'Não sei distinguir ainda', 'Preciso entender melhor o que o item permite escolher ou fazer.']]
    },
    F13SD: {
      stage: 'ESCLARECER',
      q: 'O que você precisa confirmar para entender essa relação?',
      hint: 'Escolha a informação que falta para entender a relação. Você poderá voltar e revisar a resposta.',
      why: 'Dúvida sobre F13S — manter evidência pendente sem supor SIM ou NÃO',
      opts: [['oferta', 'Se este item é uma oferta própria ou parte de outra', 'Preciso verificar o que está sendo oferecido.'], ['principal', 'De qual Produto/Serviço este item faria parte', 'Preciso identificar a oferta principal.'], ['natureza', 'Se estamos falando de escolha, atividade ou parte interna', 'Preciso esclarecer qual é o item.'], ['?', 'Ainda não sei o que preciso verificar', 'Vou manter a dúvida registrada.']]
    },
    F14R: {
      stage: 'REGRA',
      q: 'O próprio item é uma regra que determina o que é permitido, obrigatório ou proibido?',
      hint: 'Por exemplo, uma regra pode estabelecer um prazo para pedir um benefício ou definir como uma contribuição deve ser feita. Estamos avaliando a regra em si, não o serviço que a segue.',
      why: 'Investigação de P14: Regra'
    },
    F14C: {
      stage: 'CONDIÇÃO',
      q: 'O próprio item é uma condição que alguém precisa atender para ter acesso a algo?',
      hint: 'Por exemplo, estar vinculado a um plano pode ser uma condição para solicitar determinado serviço. Estamos avaliando o requisito, não o serviço oferecido.',
      why: 'Investigação de P14: Condição'
    },
    P15: {
      stage: 'NATUREZA',
      q: 'O item é uma parte ou base que ajuda um ou vários Produtos/Serviços a funcionar?',
      hint: 'Pense em algo usado para fazer outras entregas funcionarem, como um sistema de cálculo ou uma base de dados utilizada por diferentes serviços. Estamos avaliando essa parte, não o trabalho de mantê-la.',
      why: 'P15 — Componente específico ou compartilhado, distinto da oferta e do trabalho operacional',
      opts: [['componente', 'Sim, uma parte usada por um ou vários Produtos/Serviços', 'Ex.: sistema de cálculo ou base de dados.'], ['servico', 'Não, o item é o próprio Produto/Serviço oferecido', 'Estamos avaliando a oferta, não uma de suas partes.'], ['outro', 'Não, estamos avaliando outra coisa', 'Ex.: o trabalho realizado, uma regra ou um documento.'], ['?', 'Não sei distinguir', 'Preciso compreender melhor o item.']]
    },
    F16F: {
      stage: 'DIFERENCIAR',
      q: 'O item é uma ação que a pessoa faz para consultar, simular, pedir ou alterar algo?',
      hint: 'Consultar o histórico de contribuições é uma ação disponível à pessoa. O histórico consultado é outra coisa.',
      why: 'Investigação de Funcionalidade (P16)'
    },
    F16O: {
      stage: 'DIFERENCIAR',
      q: 'O item é uma tarefa específica realizada pela PREVI durante um trabalho maior?',
      hint: 'Conferir documentos de uma solicitação é uma tarefa dentro do trabalho de analisar o pedido.',
      why: 'Investigação de Operação (P16)'
    },
    P6: {
      stage: 'EVIDÊNCIAS',
      q: 'É possível identificar as etapas que uma pessoa percorre ao utilizar este item, desde o início até obter um resultado?',
      hint: 'Pense no caminho da pessoa, seja em atendimento ou por conta própria. Por exemplo: pedir uma orientação, receber o atendimento e obter uma resposta. Se não existir esse percurso para o item avaliado, responda Não.',
      why: 'P6 — jornada (informativo)'
    },
    P7: {
      stage: 'EVIDÊNCIAS',
      q: 'Existe algo que a PREVI poderia medir para saber se esse item está entregando o resultado esperado?',
      hint: 'Por exemplo, quantidade de solicitações atendidas, tempo de atendimento ou consultas realizadas, conforme o tipo de item.',
      why: 'P7 — medição (informativo)'
    }
  };

  /* Ordem das perguntas e condicionais (iguais às da v22). */
  var ORDEM = ['P1', 'P2', 'C2', 'P3', 'P4', 'E1', 'P5', 'C5', 'P8', 'C8', 'P9', 'F10I', 'F10D', 'P11', 'P12', 'P12T', 'F13M', 'F13O', 'F13OC',
    'F13S', 'F13SP', 'F13SN', 'F13SV', 'F13SD', 'F14R', 'F14C', 'P15', 'F16F', 'F16O', 'P6', 'P7'];
  var SIM_NAO = [['S', 'Sim', ''], ['N', 'Não', ''], ['?', 'Não sei / preciso verificar', '']];
  var CODIGOS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'P11', 'P12', 'P13', 'P14', 'P15', 'P16'];
  var FATOS10 = ['F10I', 'F10D'], FATOS13 = ['F13M', 'F13O', 'F13S'], FATOS14 = ['F14R', 'F14C'], FATOS16 = ['F16F', 'F16O'];
  var NATUREZAS = ['P9', 'P10', 'P11', 'P12', 'P13', 'P14', 'P15', 'P16'];

  /* Cada alternativa tem identidade própria e é gravada como foi escolhida. Só esta tabela a traduz para o SIM/NÃO
     técnico de P1–P16; o que não está aqui (inclusive "?") nunca vira NÃO. */
  var MAPA_RESPOSTAS = {
    P5: { oferta: 'S', parte: 'N', mistura: '?' },
    P9: { canal: 'S', oferta: 'N', funcionalidade: 'N', outro: 'N' },
    F13M: { tipo: 'S', oferta: 'N', outro: 'N' },
    P12: { trabalho: 'S', entrega: 'N', acao: 'N', gestao: 'N', outro: 'N' },
    F13O: { alternativa: 'S', facilidade: 'N', acao: 'N', condicao: 'N', outro: 'N' },
    F13S: { propria: 'N', componente: 'N', outra: 'N' },
    P15: { componente: 'S', servico: 'N', outro: 'N' }
  };
  /* De onde vem cada critério (as perguntas guiadas que o alimentam). */
  var FONTES = {
    P1: ['P1'], P2: ['P2', 'C2'], P3: ['P3'], P4: ['P4'], P5: ['E1', 'P5', 'C5'], P6: ['P6'], P7: ['P7'], P8: ['P8', 'C8'],
    P9: ['P9'], P10: ['F10I', 'F10D'], P11: ['P11'], P12: ['P12', 'P12T'],
    P13: ['F13M', 'F13O', 'F13OC', 'F13S', 'F13SP', 'F13SN', 'F13SV', 'F13SD'],
    P14: ['F14R', 'F14C'], P15: ['P15'], P16: ['F16F', 'F16O']
  };
  var CRITERIOS = {
    P1: ['Necessidade e público', 'Condição necessária para Produto/Serviço'],
    P2: ['Resultado próprio', 'Condição necessária para Produto/Serviço'],
    P3: ['Oferta identificável', 'Condição necessária para Produto/Serviço'],
    P4: ['Limites do item', 'Condição necessária para Produto/Serviço'],
    P5: ['Entrega própria', 'Condição necessária para Produto/Serviço'],
    P6: ['Jornada da pessoa', 'Informação complementar'],
    P7: ['Possibilidade de medir resultados', 'Informação complementar'],
    P8: ['Acompanhamento do resultado', 'Condição necessária para Produto/Serviço'],
    P9: ['Canal', 'Investigação de outra natureza'],
    P10: ['Informação e Documento', 'Duas investigações distintas consideradas pelo mesmo critério'],
    P11: ['Capacidade organizacional', 'Investigação de outra natureza'],
    P12: ['Processo e Etapa', 'Investigação do processo e, quando necessário, de suas etapas'],
    P13: ['Tipos de oferta investigados', 'Modalidade, Opção e Subproduto são investigados separadamente'],
    P14: ['Regras e condições', 'Duas investigações distintas consideradas pelo mesmo critério'],
    P15: ['Componente', 'Investigação de outra natureza'],
    P16: ['Ações investigadas', 'Funcionalidade e Operação são investigadas separadamente']
  };

  function tem(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function normalizar(k, v) { return tem(MAPA_RESPOSTAS[k] || {}, v) ? MAPA_RESPOSTAS[k][v] : v; }
  function respondida(r, k) {
    var v = r[k];
    if (PERGUNTAS[k] && PERGUNTAS[k].kind === 'text') return typeof v === 'string' && v.trim().length >= 3;
    return v !== undefined && v !== null && v !== '';
  }

  /* As perguntas do caminho, na ordem: as condicionais só entram quando a resposta anterior pede. */
  function passos(r) {
    r = r || {};
    return ORDEM.filter(function (x) {
      return (x !== 'C2' || r.P2 === 'S') && (x !== 'P12T' || normalizar('P12', r.P12) === 'S') && (x !== 'C5' || normalizar('P5', r.P5) === 'S') &&
        (x !== 'C8' || r.P8 === 'S') && (x !== 'F13OC' || r.F13O === 'alternativa') && (x !== 'F13SP' || r.F13S === 'parte') &&
        (x !== 'F13SN' || (r.F13S === 'parte' && r.F13SP === 'oferta')) && (x !== 'F13SV' || r.F13S === 'variacao') && (x !== 'F13SD' || r.F13S === '?');
    });
  }
  function opcoes(k) {
    var q = PERGUNTAS[k];
    if (!q || q.kind === 'text') return [];
    return (q.opts || SIM_NAO).map(function (o) { return { valor: o[0], rotulo: o[1], descricao: o[2] || '' }; });
  }
  function rotuloResposta(k, v) {
    if (v === undefined || v === null || v === '') return 'Sem resposta';
    var q = PERGUNTAS[k];
    if (q && q.kind === 'text') return String(v);
    var o = opcoes(k).filter(function (x) { return x.valor === v; })[0];
    if (o) return o.rotulo;
    return v === 'S' ? 'Sim' : v === 'N' ? 'Não' : v === '?' ? 'Não sei' : String(v);
  }
  /* Ao responder k, as respostas que dependiam da anterior deixam de valer (iguais às da v22). Devolve um objeto NOVO. */
  function responder(r, k, v) {
    var n = {};
    Object.keys(r || {}).forEach(function (x) { n[x] = r[x]; });
    n[k] = v;
    function tira(x) { delete n[x]; }
    if (k === 'F13O') tira('F13OC');
    if (k === 'F13S') { tira('F13SP'); tira('F13SN'); tira('F13SV'); tira('F13SD'); }
    if (k === 'F13SP' && v !== 'oferta') tira('F13SN');
    if (k === 'P2' && v !== 'S') tira('C2');
    if (k === 'P12' && normalizar('P12', v) !== 'S') tira('P12T');
    if (k === 'P5' && normalizar('P5', v) !== 'S') tira('C5');
    if (k === 'P8' && v !== 'S') tira('C8');
    /* respostas de perguntas que saíram do caminho não ficam gravadas */
    var caminho = passos(n);
    Object.keys(n).forEach(function (x) { if (caminho.indexOf(x) === -1) delete n[x]; });
    return n;
  }

  function grupo(r, ks) {
    var valores = ks.map(function (k) { return normalizar(k, r[k]); });
    if (valores.some(function (v) { return v === undefined || v === null || v === ''; })) return undefined;
    var n = valores.filter(function (v) { return v === 'S'; }).length;
    if (n > 1) return '?'; /* não escolher arbitrariamente a natureza predominante */
    if (n === 1) return 'S';
    return valores.indexOf('?') !== -1 ? '?' : 'N';
  }
  function respostaSubproduto(r) {
    if (r.F13S === undefined) return undefined;
    if (r.F13S === 'parte') return r.F13SP === 'oferta' && typeof r.F13SN === 'string' && r.F13SN.trim() ? 'S' : '?';
    if (r.F13S === 'variacao') return ['modalidade', 'opcao', 'funcionalidade'].indexOf(r.F13SV) !== -1 ? 'N' : '?';
    if (r.F13S === '?') return '?';
    return ['propria', 'componente', 'outra'].indexOf(r.F13S) !== -1 ? 'N' : '?';
  }
  /* AS RESPOSTAS GUIADAS → P1–P16 ('S', 'N', '?' ou ausente). Nunca inventa: "Não sei", mistura e dúvidas ficam '?'. */
  function criterios(r) {
    r = r || {};
    var m = {};
    ['P1', 'P3', 'P4', 'P6', 'P7', 'P8'].forEach(function (k) { m[k] = r[k]; });
    m.P2 = r.P2 === 'S' && r.C2 !== undefined ? (r.C2 === 'proprio' ? 'S' : r.C2 === 'outro' ? 'N' : '?') : r.P2;
    m.P5 = normalizar('P5', r.P5);
    m.P9 = normalizar('P9', r.P9);
    m.P10 = grupo(r, FATOS10);
    m.P11 = r.P11 === 'capacidade' ? 'S' : ['entrega', 'tarefa', 'outro'].indexOf(r.P11) !== -1 ? 'N' : r.P11;
    m.P12 = normalizar('P12', r.P12);
    var opcao = r.F13O === 'alternativa' && r.F13OC !== 'dentro' ? '?' : r.F13O;
    m.P13 = grupo({ F13M: r.F13M, F13O: opcao, F13S: respostaSubproduto(r) }, FATOS13);
    m.P14 = grupo(r, FATOS14);
    m.P15 = normalizar('P15', r.P15);
    m.P16 = grupo(r, FATOS16);
    var out = {};
    CODIGOS.forEach(function (k) { if (m[k] !== undefined && m[k] !== null && m[k] !== '') out[k] = m[k]; });
    return out;
  }

  /* Contradições entre descrições do MESMO item. Não são critérios do motor: só impedem uma conclusão firme quando a
     pessoa descreveu objetos incompatíveis (quem chama pode ignorá-las quando o motor já dá "A validar"). */
  function contradicoes(r) {
    r = r || {};
    var out = [];
    function add(chaves, texto) { out.push({ chaves: chaves, texto: texto }); }
    if (normalizar('P5', r.P5) === 'S') {
      if (r.P9 === 'funcionalidade') add(['P5', 'P9', 'F16F'], 'Uma resposta descreve uma oferta própria e outra descreve uma ação realizada em um canal. Confira se o item é a oferta ou a ação.');
      if (r.P9 === 'outro') add(['P5', 'P9'], 'Uma resposta descreve uma oferta própria e outra diz que estamos avaliando uma regra, publicação, base ou outro item.');
      if (['tarefa', 'outro'].indexOf(r.P11) !== -1) add(['P5', 'P11'], 'Uma resposta descreve uma oferta própria e outra descreve uma tarefa ou outro tipo de item.');
      if (['trabalho', 'acao', 'gestao', 'outro'].indexOf(r.P12) !== -1) add(['P5', 'P12'], 'Uma resposta descreve uma oferta própria e outra descreve um processo, ação, capacidade ou outro tipo de item.');
      if (r.F13M === 'outro') add(['P5', 'F13M'], 'Uma resposta descreve uma oferta própria, mas outra afirma que o item não é uma oferta.');
      if (['acao', 'condicao', 'outro'].indexOf(r.F13O) !== -1) add(['P5', 'F13O'], 'Uma resposta descreve uma oferta própria e outra descreve uma ação, condição ou outro objeto.');
      if (['variacao', 'componente', 'outra'].indexOf(r.F13S) !== -1) add(['P5', 'F13S'], 'Uma resposta descreve uma oferta própria e outra a descreve como escolha, parte interna ou item que não é uma oferta.');
      if (r.P15 === 'outro') add(['P5', 'P15'], 'Uma resposta descreve uma oferta própria e outra diz que estamos avaliando um item de outra natureza.');
    }
    if (r.P9 === 'funcionalidade' && r.F16F === 'N') add(['P9', 'F16F'], 'Uma resposta descreve uma ação realizada no canal, mas a pergunta sobre Funcionalidade foi respondida com Não.');
    return out;
  }
  /* Confirmações que faltam (iguais às da v22). Cada uma diz o que conferir; enquanto houver alguma, não se conclui. */
  function pendencias(r, opc) {
    r = r || {};
    opc = opc || {};
    var p = [];
    function add(chaves, texto) { p.push({ chaves: chaves, texto: texto }); }
    if (!opc.ignorarContradicoes) contradicoes(r).forEach(function (c) { p.push(c); });
    var oferta = normalizar('P5', r.P5) === 'S';
    if (r.F10I === 'S' && r.F10D === 'S') add(['F10I', 'F10D'], 'Informação e documento foram marcados juntos: identifique qual é o próprio item.');
    if (r.P2 === 'S' && ['proprio', 'outro'].indexOf(r.C2) === -1) add(['C2'], 'Falta confirmar a qual item pertence o resultado (pergunta sobre a origem do resultado).');
    if (oferta && r.P2 === 'S' && r.C2 === 'outro') add(['P5', 'C2'], 'O item foi descrito como oferta própria, mas o resultado pertence a outra entrega.');
    if (oferta && (r.C5 !== 'entrega' || r.E1 === 'S')) add(['E1', 'C5'], 'Falta confirmar a entrega própria: o que desapareceria precisa ser uma entrega oferecida às pessoas, e o item não pode ser só uma tarefa, regra ou parte.');
    if (r.P8 === 'S' && r.C8 !== 'entrega') add(['C8'], 'Falta confirmar quem acompanha o resultado do item como um todo.');
    if (r.P12 === 'acao' && r.F16F === 'N' && r.F16O === 'N') add(['P12', 'F16F', 'F16O'], 'Você descreveu uma ação, mas negou Funcionalidade e Operação.');
    if (r.P12 === 'gestao' && r.P11 !== undefined && r.P11 !== 'capacidade') add(['P12', 'P11'], 'Responsabilidade contínua da PREVI sem confirmação em Capacidade organizacional.');
    if (r.F13S === 'parte' && !(r.F13SP === 'oferta' && String(r.F13SN || '').trim())) add(['F13S', 'F13SP', 'F13SN'], 'Falta confirmar o Produto/Serviço principal e a oferta que faz parte dele.');
    if (r.F13O === 'alternativa' && r.F13OC !== 'dentro') add(['F13O', 'F13OC'], 'Falta confirmar que a escolha é interna ao mesmo Produto/Serviço.');
    if (r.F13O === 'acao' && r.F16F === 'N') add(['F13O', 'F16F'], 'O item foi descrito como uma ação, mas Funcionalidade foi negada.');
    if (r.F13O === 'condicao' && r.F14C === 'N') add(['F13O', 'F14C'], 'O item foi descrito como condição, mas a pergunta de Condição foi negada.');
    if (r.F14R === 'S' && r.F14C === 'S') add(['F14R', 'F14C'], 'Regra e Condição foram marcadas juntas: esclareça qual é o próprio item avaliado.');
    if (r.F13S === 'variacao') {
      var bate = (r.F13SV === 'modalidade' && normalizar('F13M', r.F13M) === 'S' && r.F13O !== 'alternativa') ||
        (r.F13SV === 'opcao' && r.F13O === 'alternativa' && normalizar('F13M', r.F13M) !== 'S') ||
        (r.F13SV === 'funcionalidade' && r.F16F === 'S' && normalizar('F13M', r.F13M) !== 'S' && r.F13O !== 'alternativa');
      if (!bate) add(['F13S', 'F13SV', 'F13M', 'F13O', 'F16F'], 'Revise Modalidade, Opção ou Funcionalidade: a forma ou alternativa indicada não confere com as outras respostas.');
    }
    if (r.F13S === 'componente' && r.P15 !== undefined && r.P15 !== 'componente') add(['F13S', 'P15'], 'Parte interna (relação com outros Produtos/Serviços) versus Componente: as duas respostas não conferem.');
    if (r.F13S === 'propria' && (normalizar('F13M', r.F13M) === 'S' || r.F13O === 'alternativa')) add(['F13S', 'F13M', 'F13O'], 'Oferta separada versus Modalidade/Opção: as respostas não conferem.');
    return p;
  }
  /* Pontos para a pessoa conferir (não bloqueiam por si: as que bloqueiam estão em pendencias). */
  function alertas(r) {
    r = r || {};
    var out = [], m = criterios(r), oferta = normalizar('P5', r.P5) === 'S';
    function sim(k) { return m[k] === 'S'; }
    if (oferta && ['P13', 'P14', 'P15', 'P16'].some(sim)) out.push('Autonomia (P5) = SIM, mas o item também foi descrito como parte de outra solução (P13–P16): o resultado fica "A validar" por incoerência.');
    if (r.E1 === 'S' && oferta) out.push('Você indicou que o item é só uma parte interna, mas também que é uma oferta própria. Revise o recorte.');
    if (oferta && normalizar('P12', r.P12) === 'S') out.push('Você indicou entrega própria e também que o próprio item é um Processo. Se está avaliando a oferta, reveja a pergunta sobre Processo; se está avaliando o processo, reveja a entrega própria e a origem do resultado. Nenhuma resposta é corrigida automaticamente.');
    if (FATOS13.filter(function (k) { return normalizar(k, r[k]) === 'S'; }).length > 1) out.push('Modalidade, Opção e Subproduto foram assinalados ao mesmo tempo: o critério P13 fica "Não sei" até o objeto ser distinguido.');
    if (FATOS16.filter(function (k) { return r[k] === 'S'; }).length > 1) out.push('Funcionalidade e Operação foram assinaladas juntas: o critério P16 fica "Não sei" até o objeto ser distinguido.');
    if (NATUREZAS.filter(sim).length > 1) out.push('Mais de uma natureza marcada em P9–P16: pode haver conflito ou mistura de objetos.');
    return out;
  }
  /* Situação do conjunto: faltando = perguntas do caminho sem resposta; indefinidos = critérios sem SIM/NÃO que impedem
     concluir; naoConfirmados = critérios sem SIM/NÃO que a conclusão pode deixar assim (opc.dispensaveis — quem chama
     decide, ex.: P6/P7 quando a regra publicada não os lê); pendencias = confirmações. */
  function situacao(r, opc) {
    r = r || {};
    opc = opc || {};
    var caminho = passos(r), m = criterios(r), dispensaveis = opc.dispensaveis || [];
    var faltando = caminho.filter(function (k) { return !respondida(r, k); });
    var semValor = CODIGOS.filter(function (k) { return m[k] !== 'S' && m[k] !== 'N'; });
    var indefinidos = semValor.filter(function (k) { return dispensaveis.indexOf(k) === -1; });
    var naoConfirmados = semValor.filter(function (k) { return dispensaveis.indexOf(k) !== -1; });
    var pend = pendencias(r, opc);
    return { caminho: caminho, faltando: faltando, criterios: m, indefinidos: indefinidos, naoConfirmados: naoConfirmados, pendencias: pend,
      podeConcluir: !faltando.length && !indefinidos.length && !pend.length };
  }
  function referencia(k) {
    if (/^P([1-9]|1[0-6])$/.test(k)) return 'Critério ' + k;
    for (var c in FONTES) if (FONTES[c].indexOf(k) !== -1) return 'Ajuda a responder ' + c;
    return k;
  }
  function criterioDe(k) { for (var c in FONTES) if (FONTES[c].indexOf(k) !== -1) return c; return null; }

  function congelar(o) { Object.keys(o).forEach(function (k) { if (o[k] && typeof o[k] === 'object') congelar(o[k]); }); return Object.freeze(o); }
  var api = congelar({
    VERSAO: VERSAO, PERGUNTAS: PERGUNTAS, ORDEM: ORDEM, CODIGOS: CODIGOS, FONTES: FONTES, CRITERIOS: CRITERIOS, MAPA_RESPOSTAS: MAPA_RESPOSTAS
  });
  api = Object.freeze(Object.assign({}, api, {
    passos: passos, opcoes: opcoes, rotuloResposta: rotuloResposta, responder: responder, respondida: respondida,
    criterios: criterios, contradicoes: contradicoes, pendencias: pendencias, alertas: alertas, situacao: situacao,
    referencia: referencia, criterioDe: criterioDe
  }));
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.faAvaliacaoGuiada = api;
})();
