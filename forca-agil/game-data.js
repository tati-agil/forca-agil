/* Força Ágil — Dados do Treinamento Jedi: dimensões, patentes e missões */
(function () {
  window.faGameData = {
    DIMS: [
      'Valores e princípios ágeis',
      'Foco no cliente e no valor',
      'Fluxo de trabalho (Kanban / WIP)',
      'Colaboração e times auto-organizados',
      'Liderança servidora',
      'Métricas e melhoria contínua'
    ],

    LEVELS: ['Já ouvi falar', 'Sei o que é', 'Domino', 'Ensino'],

    RANKS: [
      { name: 'Youngling', tag: '"Já ouvi falar"', sym: '#char-0', min: 0  },
      { name: 'Padawan',   tag: '"Sei o que é"',   sym: '#char-1', min: 25 },
      { name: 'Cavaleiro', tag: '"Domino"',         sym: '#char-2', min: 50 },
      { name: 'Mestre',    tag: '"Ensino"',         sym: '#char-3', min: 75 }
    ],

    MISSIONS: [
      {
        id: 'gelo',
        t: 'Quebre o gelo',
        d: 'Apresente-se sem crachá — pratique a horizontalização.',
        questions: [
          {
            q: 'Qual é o propósito principal de uma apresentação "sem crachá"?',
            opts: [
              'Economizar tempo na apresentação',
              'Criar segurança psicológica e igualdade entre os participantes',
              'Evitar exposição de dados pessoais',
              'É apenas uma formalidade da oficina'
            ],
            correct: 1
          },
          {
            q: 'O que significa "horizontalização" no contexto ágil?',
            opts: [
              'Reduzir o número de funcionários',
              'Trabalhar em escritório open space',
              'Diminuir barreiras hierárquicas para facilitar a colaboração',
              'Nivelar os salários da equipe'
            ],
            correct: 2
          },
          {
            q: 'Quando alguém se apresenta sem cargo numa reunião ágil, o que isso promove?',
            opts: [
              'Confusão sobre responsabilidades',
              'Conversas mais honestas e colaboração sem filtro de poder',
              'Falta de respeito entre os membros',
              'Perda de tempo desnecessária'
            ],
            correct: 1
          }
        ]
      },
      {
        id: 'csd',
        t: 'Monte a CSD',
        d: 'Liste Certezas, Suposições e Dúvidas do seu desafio.',
        questions: [
          {
            q: 'Para que serve a Matriz CSD?',
            opts: [
              'Documentar requisitos formais do projeto',
              'Mapear o que o time sabe, supõe e precisa validar sobre o problema',
              'Avaliar o desempenho individual dos membros',
              'Criar o backlog do produto'
            ],
            correct: 1
          },
          {
            q: 'O que vai na coluna "Suposições" da CSD?',
            opts: [
              'Fatos já confirmados por dados concretos',
              'Hipóteses que o time acredita serem verdade mas ainda não validou',
              'Perguntas que definitivamente não têm resposta',
              'Riscos mapeados no planejamento'
            ],
            correct: 1
          },
          {
            q: 'Qual é o benefício de identificar as "Dúvidas" na CSD?',
            opts: [
              'Mostrar que o time não está preparado',
              'Direcionar onde focar pesquisa e aprendizado antes de agir',
              'Justificar atrasos no projeto',
              'Transferir responsabilidade para outros times'
            ],
            correct: 1
          }
        ]
      },
      {
        id: 'forca',
        t: 'Empunhe a Força',
        d: 'Saiba explicar os 4 valores ágeis a um colega.',
        questions: [
          {
            q: 'Qual é o primeiro valor do Manifesto Ágil?',
            opts: [
              'Processos e ferramentas mais que indivíduos',
              'Documentação extensa mais que software funcionando',
              'Indivíduos e interações mais que processos e ferramentas',
              'Seguir um plano mais que responder a mudanças'
            ],
            correct: 2
          },
          {
            q: '"Colaboração com o cliente mais que negociação de contratos" significa:',
            opts: [
              'Não ter contratos formais com clientes',
              'Envolver o cliente continuamente ao longo do projeto, não só no início e fim',
              'O cliente decide tudo sem filtro da equipe',
              'Reduzir o valor cobrado no contrato'
            ],
            correct: 1
          },
          {
            q: 'Por que "responder a mudanças" é valorizado no ágil?',
            opts: [
              'Porque mudanças são sempre benéficas ao projeto',
              'Porque o plano inicial raramente reflete a realidade ao longo do tempo',
              'Porque planejamento não tem nenhum valor',
              'Porque clientes sempre mudam de ideia sem razão'
            ],
            correct: 1
          }
        ]
      },
      {
        id: 'sabre',
        t: 'Acenda o sabre',
        d: 'Facilite uma daily real — sem cobrança de status individual.',
        questions: [
          {
            q: 'Qual é o objetivo principal de uma daily de 15 minutos?',
            opts: [
              'Reportar status de cada tarefa para o gestor',
              'Sincronizar o time e identificar impedimentos coletivos',
              'Avaliar a produtividade individual de cada membro',
              'Planejar em detalhe as tarefas do dia'
            ],
            correct: 1
          },
          {
            q: 'O que caracteriza uma daily do "lado sombrio"?',
            opts: [
              'Durar exatamente 15 minutos sem exceção',
              'Ser realizada em pé para ser mais rápida',
              'Virar reunião de status onde cada um reporta para o gestor',
              'Ter somente três perguntas fixas'
            ],
            correct: 2
          },
          {
            q: 'Como facilitar uma daily saudável?',
            opts: [
              'Controlando o tempo de fala de cada pessoa',
              'Fazendo perguntas sobre bloqueios e oportunidades de colaboração',
              'Tomando notas para reportar à liderança depois',
              'Garantindo que todos falem exatamente o mesmo tempo'
            ],
            correct: 1
          }
        ]
      },
      {
        id: 'vieses',
        t: 'Caçador de vieses',
        d: 'Identifique um viés que afeta suas decisões.',
        questions: [
          {
            q: 'O que é um viés cognitivo?',
            opts: [
              'Um erro de sistema nos processos da empresa',
              'Um atalho mental que pode distorcer nossa percepção e decisões',
              'Uma opinião contrária à da maioria do time',
              'Uma falha técnica no produto desenvolvido'
            ],
            correct: 1
          },
          {
            q: 'O "viés de confirmação" faz com que a pessoa:',
            opts: [
              'Confie cegamente nas regras da empresa',
              'Busque apenas informações que confirmem o que já acredita',
              'Confirme todas as decisões do gestor sem questionar',
              'Documente tudo exaustivamente antes de agir'
            ],
            correct: 1
          },
          {
            q: 'Como times ágeis reduzem o impacto de vieses nas decisões?',
            opts: [
              'Delegando decisões para quem tem mais cargo hierárquico',
              'Usando dados, retrospectivas e diversidade de perspectivas',
              'Evitando discussões que possam gerar conflito no time',
              'Seguindo sempre o processo definido sem questionar'
            ],
            correct: 1
          }
        ]
      },
      {
        id: 'padawan',
        t: 'Treine um Padawan',
        d: 'Ensine um conceito ágil para outra pessoa.',
        questions: [
          {
            q: 'Por que ensinar um conceito ágil para outra pessoa consolida seu aprendizado?',
            opts: [
              'Porque você ganha reconhecimento e visibilidade na empresa',
              'Porque explicar obriga você a organizar e aprofundar o que sabe',
              'Porque reduz sua própria carga de trabalho',
              'Porque é obrigatório para obter certificação'
            ],
            correct: 1
          },
          {
            q: 'Qual é a melhor forma de explicar agilidade para um colega cético?',
            opts: [
              'Mostrar todos os frameworks e cerimônias de uma vez',
              'Começar com um problema real que ele já enfrenta e mostrar como o ágil ajuda',
              'Enviar um link com o Manifesto Ágil para ele ler',
              'Dizer que é uma obrigação da empresa adotar'
            ],
            correct: 1
          },
          {
            q: 'O que significa ser um "multiplicador" da Força Ágil?',
            opts: [
              'Fazer o trabalho de várias pessoas ao mesmo tempo',
              'Replicar e disseminar a mentalidade ágil para além da própria equipe',
              'Multiplicar o número de cerimônias no time',
              'Aumentar a velocidade das entregas a qualquer custo'
            ],
            correct: 1
          }
        ]
      }
    ]
  };
})();
