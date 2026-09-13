/* Força Ágil — Dados do Treinamento Jedi: dimensões, patentes e missões */
(function () {
  var _data = {
    /* Autodiagnóstico: 20 afirmações em 4 blocos, escala Likert 0-3 (total 0-60) */
    BLOCOS: [
      {
        id: 'mentalidade',
        label: 'Bloco 1 — Mentalidade (A Força Interior)',
        icon: '🧠',
        afirmacoes: [
          'Consigo mudar de opinião quando surgem novas informações',
          'Vejo erros como oportunidade de aprendizado',
          'Me sinto confortável com mudanças ao longo do trabalho',
          'Busco entender o problema antes de propor solução',
          'Prefiro testar hipóteses do que planejar tudo no detalhe'
        ]
      },
      {
        id: 'colaboracao',
        label: 'Bloco 2 — Colaboração (A Força Entre Nós)',
        icon: '🤝',
        afirmacoes: [
          'Peço ajuda quando preciso',
          'Compartilho informações com o time de forma transparente',
          'Escuto de verdade antes de responder',
          'Consigo dar e receber feedbacks com abertura',
          'Me preocupo com o sucesso do time, não só com o meu'
        ]
      },
      {
        id: 'praticas',
        label: 'Bloco 3 — Práticas Ágeis (Técnicas Jedi)',
        icon: '⚙️',
        afirmacoes: [
          'Já participei de rituais como daily, retrospectiva ou planning',
          'Consigo priorizar atividades com base em valor',
          'Trabalho com entregas pequenas e frequentes',
          'Uso algum tipo de visualização do trabalho (kanban, backlog)',
          'Reviso e ajusto minha forma de trabalhar com frequência'
        ]
      },
      {
        id: 'valor',
        label: 'Bloco 4 — Entrega de Valor (Missões Jedi)',
        icon: '🚀',
        afirmacoes: [
          'Penso no cliente ao executar minhas atividades',
          'Busco entregar valor mesmo que incompleto (incremental)',
          'Evito perfeccionismo que atrasa entregas',
          'Consigo lidar com mudanças de prioridade',
          'Me preocupo em gerar impacto real, não só "entregar tarefas"'
        ]
      }
    ],

    LEVELS: ['Nunca', 'Raramente', 'Às vezes', 'Frequentemente'],

    /* RANKS baseados na pontuação do autodiagnóstico (0-60) */
    RANKS: [
      {
        id: 'youngling', name: 'Youngling', tag: 'Iniciado na Força', sym: '#char-0', icon: '🟢',
        minDiag: 0, maxDiag: 15,
        desc: 'Você está começando sua jornada.',
        carac: ['Mentalidade ainda tradicional', 'Pouco contato com práticas ágeis', 'Busca segurança em controle e previsibilidade'],
        proximo: ['Entender o "porquê" da agilidade', 'Experimentar pequenas mudanças'],
        frase: '"A Força já está em você… só precisa ser despertada."'
      },
      {
        id: 'padawan', name: 'Padawan', tag: 'Aprendiz Jedi', sym: '#char-1', icon: '🔵',
        minDiag: 16, maxDiag: 30,
        desc: 'Você já entrou na jornada!',
        carac: ['Já conhece alguns conceitos', 'Oscila entre velho e novo modelo', 'Começa a experimentar práticas'],
        proximo: ['Ganhar consistência', 'Trabalhar desapego do controle'],
        frase: '"Muito ainda precisa aprender… mas o caminho está correto."'
      },
      {
        id: 'cavaleiro', name: 'Cavaleiro', tag: 'Cavaleiro Jedi', sym: '#char-2', icon: '🟡',
        minDiag: 31, maxDiag: 45,
        desc: 'Você já aplica agilidade com confiança.',
        carac: ['Boa mentalidade adaptativa', 'Usa práticas no dia a dia', 'Colabora bem com o time'],
        proximo: ['Influenciar outros', 'Refinar tomada de decisão baseada em valor'],
        frase: '"A Força flui naturalmente através de você."'
      },
      {
        id: 'mestre', name: 'Mestre', tag: 'Mestre Jedi', sym: '#char-3', icon: '🟣',
        minDiag: 46, maxDiag: 60,
        desc: 'Você vive e respira agilidade.',
        carac: ['Alta adaptabilidade', 'Liderança pelo exemplo', 'Forte foco em valor e pessoas'],
        proximo: ['Desenvolver outros', 'Sustentar cultura ágil'],
        frase: '"Ensinar, você deve. A nova geração guiará."'
      }
    ],

    DIMS: [], /* preenchido automaticamente abaixo a partir de BLOCOS */
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

  _data.DIMS = _data.BLOCOS.reduce(function (acc, b) {
    return acc.concat(b.afirmacoes || []);
  }, []);

  /* Catálogo de conteúdos de treinamento.
     Um treinamento cadastrado no painel (nó "treinamentos" no Firebase) guarda
     nome e a quais eventos pertence — e aponta para um conteúdo daqui pela
     chave. O conteúdo em si (afirmações e patentes) continua no código: dá para
     ligar/desligar um treinamento e mudar seus eventos sem deploy, mas um
     treinamento com conteúdo NOVO ainda precisa de um conjunto novo aqui. */
  _data.CONTEUDO_KEY = 'jedi';
  _data.NOME = 'Treinamento Jedi';

  window.faGameConteudos = { jedi: _data };

  /* Mantido: game.js e os testes já liam daqui, e enquanto só existe o
     conteúdo "jedi" isto continua sendo ele. */
  window.faGameData = _data;

  /* ══════════════════════════════════════════════════════════════════
     CONTEÚDO DE TREINAMENTO GUARDADO NO BANCO

     Um treinamento pode ter conteúdo PRÓPRIO, criado no painel e gravado
     em treinamentos-conteudo/<treinoKey>, em vez de apontar para um
     conjunto daqui do código. É o que permite criar um treinamento novo
     sem deploy.

     Este módulo é o contrato entre os dois lados: o painel usa para
     validar e mostrar o que falta, a página usa para decidir se dá para
     responder. Um critério só — se cada lado tivesse o seu, o painel
     diria "pronto" numa tela onde a pessoa vê um quiz quebrado, que é
     exatamente a falha silenciosa que a skill criterio-de-estado existe
     para impedir.
     ══════════════════════════════════════════════════════════════════ */
  var LEVELS_PADRAO = ['Nunca', 'Raramente', 'Às vezes', 'Frequentemente'];

  function texto(v) { return typeof v === 'string' ? v.trim() : ''; }
  function lista(v) {
    if (!Array.isArray(v)) return [];
    return v.map(texto).filter(function (x) { return !!x; });
  }

  /* O banco devolve objetos com chaves numéricas quando um array tem
     buracos (o Firebase não guarda array esparso), então tudo que deveria
     ser lista passa por aqui antes de ser usado. */
  function paraLista(v) {
    if (Array.isArray(v)) return v;
    if (v && typeof v === 'object') {
      return Object.keys(v).sort(function (a, b) { return Number(a) - Number(b); })
        .map(function (k) { return v[k]; });
    }
    return [];
  }

  function normalizar(raw) {
    var r = raw || {};
    var blocos = paraLista(r.blocos).map(function (b, i) {
      b = b || {};
      return {
        id: texto(b.id) || ('bloco' + (i + 1)),
        label: texto(b.label) || ('Bloco ' + (i + 1)),
        icon: texto(b.icon) || '🔹',
        afirmacoes: lista(paraLista(b.afirmacoes)),
      };
    });
    var levels = lista(paraLista(r.levels));
    if (levels.length < 2) levels = LEVELS_PADRAO.slice();
    var ranks = paraLista(r.ranks).map(function (k, i) {
      k = k || {};
      return {
        id: texto(k.id) || ('patente' + (i + 1)),
        name: texto(k.name) || ('Patente ' + (i + 1)),
        tag: texto(k.tag),
        icon: texto(k.icon) || '⭐',
        sym: texto(k.sym) || ('#char-' + (i % 4)),
        minDiag: Number(k.minDiag) || 0,
        maxDiag: Number(k.maxDiag) || 0,
        desc: texto(k.desc),
        carac: lista(paraLista(k.carac)),
        proximo: lista(paraLista(k.proximo)),
        frase: texto(k.frase),
      };
    }).sort(function (a, b) { return a.minDiag - b.minDiag; });

    return {
      BLOCOS: blocos,
      LEVELS: levels,
      RANKS: ranks,
      /* Quem responde dá de 0 a (levels-1) por afirmação. */
      PONTO_MAX: Math.max(0, levels.length - 1),
    };
  }

  function totalAfirmacoes(c) {
    return (c.BLOCOS || []).reduce(function (n, b) { return n + (b.afirmacoes || []).length; }, 0);
  }

  /* O que IMPEDE alguém de responder. Lista vazia = pronto para usar.
     Não é capricho de validação: cada item aqui é uma tela quebrada do
     lado de quem responde — sem afirmação não há o que perguntar, sem
     patente o resultado sai em branco, e faixa que não cobre a pontuação
     faz a pessoa terminar o quiz e não receber patente nenhuma. */
  function problemas(c) {
    var out = [];
    var total = totalAfirmacoes(c);
    var max = total * c.PONTO_MAX;
    if (!total) out.push('não tem nenhuma afirmação para responder');
    if (!(c.RANKS || []).length) out.push('não tem nenhuma patente');

    if (total && (c.RANKS || []).length) {
      var faixas = c.RANKS.slice().sort(function (a, b) { return a.minDiag - b.minDiag; });
      var invertida = faixas.filter(function (k) { return k.maxDiag < k.minDiag; });
      if (invertida.length) {
        out.push('patente com faixa invertida (fim menor que o início): ' +
          invertida.map(function (k) { return k.name; }).join(', '));
      }
      if (faixas[0].minDiag > 0) out.push('nenhuma patente cobre a pontuação 0');
      if (faixas[faixas.length - 1].maxDiag < max) {
        out.push('nenhuma patente cobre a pontuação máxima (' + max + ')');
      }
      for (var i = 1; i < faixas.length; i++) {
        if (faixas[i].minDiag > faixas[i - 1].maxDiag + 1) {
          out.push('faixa sem patente entre ' + (faixas[i - 1].maxDiag + 1) + ' e ' + (faixas[i].minDiag - 1) + ' pontos');
        } else if (faixas[i].minDiag <= faixas[i - 1].maxDiag) {
          out.push('faixas de "' + faixas[i - 1].name + '" e "' + faixas[i].name + '" se sobrepõem');
        }
      }
    }
    return out;
  }

  /* Não impede ninguém de responder, mas quase certamente não é o que se
     quis dizer. Patente cuja faixa começa acima da pontuação máxima nunca
     vai ser alcançada por ninguém — acontece ao copiar patentes de um
     treinamento com mais afirmações que o novo. Fica como AVISO, não como
     problema: esconder o treinamento por causa disso seria pior que o
     defeito. */
  function avisos(c) {
    var out = [];
    var max = totalAfirmacoes(c) * c.PONTO_MAX;
    var inalcancaveis = (c.RANKS || []).filter(function (k) { return k.minDiag > max; });
    if (inalcancaveis.length) {
      out.push('patente que ninguém consegue alcançar (a faixa começa acima de ' + max + ' pontos): ' +
        inalcancaveis.map(function (k) { return k.name; }).join(', '));
    }
    return out;
  }

  window.faTreinoConteudo = {
    LEVELS_PADRAO: LEVELS_PADRAO,
    normalizar: normalizar,
    problemas: problemas,
    avisos: avisos,
    totalAfirmacoes: totalAfirmacoes,
    /* Personagens que existem no SVG embutido do index.html: conteúdo novo
       escolhe entre eles, porque desenho novo exige deploy. */
    PERSONAGENS: ['#char-0', '#char-1', '#char-2', '#char-3'],
  };
})();
