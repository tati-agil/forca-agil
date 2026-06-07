/* Operação Kyber Ágil — Banco de Desafios */
const KYBER_CHALLENGES = [
  {
    id: 1,
    situation: "O Império lançou um ataque coordenado à base Rebelde. Os sensores detectam 3 frotas inimigas aproximando-se em direções diferentes. Você tem 2 horas para decidir.",
    context: "Você é o Comandante Rebelde. O que fazer?",
    options: [
      { text: "Reunir todas as lideranças, mapear todas as possibilidades e montar um plano perfeito em 90 minutos.", correct: false, agile: "Planejamento rígido e lento — exatamente o que o Império espera." },
      { text: "Dividir em 3 squads, cada um decide sua rota em 15 min, ajusta conforme o inimigo se move.", correct: true, agile: "Entrega rápida, adaptação contínua, decisão distribuída — ágil!" },
      { text: "Enviar mensagens de status a cada 10 min, mas não mexer em nada até saber a posição exata de todas as frotas.", correct: false, agile: "Overhead de comunicação sem ação — paralisia." },
      { text: "Esperar mais 30 min para ter TODAS as informações antes de fazer qualquer coisa.", correct: false, agile: "Perfeição da informação = derrota. Ágil é decidir com ~70% da info." }
    ]
  },
  {
    id: 2,
    situation: "Um novo droides defensor foi desenvolvido. Você pode esperar 3 meses pelos testes COMPLETOS e lançar perfeito, ou liberar uma versão MVP em 2 semanas.",
    context: "O que fazer para maximizar valor à Resistência?",
    options: [
      { text: "Esperar 3 meses. Um produto perfeito é melhor que um imperfeito.", correct: false, agile: "Modo waterfallzero — risco total. Pode vir defesa antes." },
      { text: "Lançar MVP em 2 semanas, recolher feedback real dos Rebeldes, iterar rapidamente.", correct: true, agile: "Produto funcionando, aprendizado real, adaptação rápida = ágil." },
      { text: "Lançar em 4 meses — meio termo que agrada ninguém.", correct: false, agile: "Nem rápido, nem bem testado. Pior dos dois mundos." },
      { text: "Fazer um piloto secreto por 1 mês sem contar a ninguém.", correct: false, agile: "Falta transparência e colaboração com o time." }
    ]
  },
  {
    id: 3,
    situation: "A Resistência tem 1 mês para defender uma base crítica. Você tem 15 pessoas. A lista de 'imprescindíveis' tem 45 tarefas.",
    context: "Como priorizar?",
    options: [
      { text: "Fazer tudo. Adicionar mais gente. Trabalhar 24h até terminar.", correct: false, agile: "Burnout, qualidade ruim, erros críticos. Desastre." },
      { text: "Colocar cliente (quem defende a base) sentado no time. Escolher top 12 tarefas que entregam máximo valor. Descartar o resto.", correct: true, agile: "Foco, simplicidade, valor real entregue = ágil puro." },
      { text: "Fazer as 45 tarefas em ordem, sem questionar prioridade.", correct: false, agile: "Sem pensar em valor. Modo 'lista de tarefas'." },
      { text: "Delegar todas as decisões para a liderança do Império. Eles sabem o que é importante.", correct: false, agile: "Sério? Isso é rendição, não agilidade." }
    ]
  },
  {
    id: 4,
    situation: "O seu squad Jedi identifica um erro crítico na arquitetura dos escudos. Corrigir leva 2 sprints. A liderança quer ignorar e continuar.",
    context: "Você é o Scrum Master. O que faz?",
    options: [
      { text: "Obedecer silenciosamente e deixar o problema crescer.", correct: false, agile: "Falta coragem. Facilitador que não facilita." },
      { text: "Levantar o problema com transparência, mostrar impacto, deixar liderança decidir com TODAS as informações.", correct: true, agile: "Liderança servidora, transparência, decisão informada = ágil." },
      { text: "Consertar em segredo sem avisar ninguém.", correct: false, agile: "Falta comunicação. Cria surpresas ruins depois." },
      { text: "Criar 47 documentos explicando o problema e enviar para aprovação em 5 níveis hierárquicos.", correct: false, agile: "Burocracia pura. Antágil." }
    ]
  },
  {
    id: 5,
    situation: "A daily de 15 min se transformou numa discussão de 1h sobre arquitetura de longo prazo. O time está frustrado.",
    context: "Como restaurar o foco?",
    options: [
      { text: "Deixar como está. Discussões longas são sinal de engajamento.", correct: false, agile: "Desperdício de tempo. Timebox é timebox." },
      { text: "Cortar a discussão, marcar uma reunião separada com os interessados, e voltar a dailies de 15 min focadas no dia.", correct: true, agile: "Respeito ao timebox, foco, reuniões com propósito = ágil." },
      { text: "Proibir qualquer discussão profunda. Só status de ontem/hoje/bloqueios.", correct: false, agile: "Perdeu aprendizado e colaboração." },
      { text: "Fazer duas dailies: uma de 15 min e outra 'real' de 1h.", correct: false, agile: "Duplicação, confusão, perda de tempo." }
    ]
  },
  {
    id: 6,
    situation: "O time terminou as tarefas da sprint com qualidade excelente. Ainda faltam 2 dias de sprint.",
    context: "O que fazer?",
    options: [
      { text: "Relaxar. Vocês já terminaram, aproveitam o tempo livre.", correct: false, agile: "Desperdiça oportunidade de aprender e melhorar." },
      { text: "Puxar mais tarefas do backlog, conversar com cliente sobre o que adiciona máximo valor nos 2 dias restantes.", correct: true, agile: "Entregar continuamente, colaboração com cliente, fluxo constante = ágil." },
      { text: "Criar mais tarefas fictícias pra parecer que o time está ocupado.", correct: false, agile: "Desonesto. Mata a confiança." },
      { text: "Forçar o time a fazer tarefas de 'débito técnico' que ninguém pediu.", correct: false, agile: "Sem validação do cliente. Pode ser desperdício." }
    ]
  }
];
