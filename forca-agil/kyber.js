/* ============================================================
   Operação Kyber Ágil — Lógica do jogo
   Desafios, timer, pontuação. Firebase em firebase.js.
   ============================================================ */

const CHALLENGES = [
  // ===== MANIFESTO ÁGIL =====
  {
    situation: "O Império lançou um ataque à base. Você tem 2 horas para decidir como reagir.",
    context: "Como proceder?",
    options: [
      { text: "Dividir em 3 squads, cada um decide sua rota em 15 min, ajusta conforme o inimigo se move.", correct: true, agile: "Entrega rápida, adaptação contínua, decisão distribuída — ágil!" },
      { text: "Reunir lideranças, mapear tudo e montar plano perfeito em 90 min.", correct: false, agile: "Planejamento rígido — exatamente o que o Império espera." },
      { text: "Enviar mensagens de status a cada 10 min, mas não mexer em nada.", correct: false, agile: "Overhead de comunicação sem ação — paralisia." },
      { text: "Esperar mais 30 min para ter TODAS as informações antes de agir.", correct: false, agile: "Perfeição da informação = derrota. Ágil é decidir com ~70% da info." }
    ]
  },
  {
    situation: "Um novo droide defensor foi desenvolvido. Teste completo em 3 meses ou MVP em 2 semanas?",
    context: "Como maximizar valor à Resistência?",
    options: [
      { text: "Esperar 3 meses. Um produto perfeito é melhor.", correct: false, agile: "Modo waterfall — risco total. Defesa pode chegar antes." },
      { text: "Lançar MVP em 2 semanas, recolher feedback dos Rebeldes, iterar rapidamente.", correct: true, agile: "Produto funcionando, aprendizado real, adaptação rápida = ágil." },
      { text: "Lançar em 4 meses — meio termo que agrada ninguém.", correct: false, agile: "Nem rápido, nem bem testado. Pior dos dois mundos." },
      { text: "Fazer piloto secreto por 1 mês sem contar a ninguém.", correct: false, agile: "Falta transparência e colaboração com o time." }
    ]
  },
  {
    situation: "1 mês para defender uma base. 15 pessoas. Lista de 'imprescindíveis' tem 45 tarefas.",
    context: "Como priorizar?",
    options: [
      { text: "Fazer tudo. Adicionar mais gente. Trabalhar 24h.", correct: false, agile: "Burnout, qualidade ruim, erros. Desastre." },
      { text: "Fazer as 45 em ordem, sem questionar prioridade.", correct: false, agile: "Sem pensar em valor. Modo 'lista de tarefas'." },
      { text: "Cliente sentado no time. Escolher top 12 tarefas que entregam máximo valor. Descartar o resto.", correct: true, agile: "Foco, simplicidade, valor real = ágil puro." },
      { text: "Delegar todas as decisões para o Império.", correct: false, agile: "Rendição, não agilidade." }
    ]
  },
  {
    situation: "Squad encontra erro crítico nos escudos. Corrigir leva 2 sprints. Liderança quer ignorar.",
    context: "Você é o Scrum Master. O que faz?",
    options: [
      { text: "Obedecer silenciosamente.", correct: false, agile: "Falta coragem. Facilitador que não facilita." },
      { text: "Consertar em segredo sem avisar ninguém.", correct: false, agile: "Falta comunicação. Surpresas ruins depois." },
      { text: "Criar 47 documentos explicando e enviar pra 5 níveis de aprovação.", correct: false, agile: "Burocracia pura. Antágil." },
      { text: "Levantar o problema com transparência, mostrar impacto, deixar liderança decidir.", correct: true, agile: "Liderança servidora, transparência, decisão informada = ágil." }
    ]
  },
  {
    situation: "Daily de 15 min virou discussão de 1h sobre arquitetura. Time frustrado.",
    context: "Como restaurar o foco?",
    options: [
      { text: "Cortar a discussão, marcar reunião separada, volta a 15 min.", correct: true, agile: "Respeito ao timebox, foco, reuniões com propósito = ágil." },
      { text: "Deixar como está. Discussões longas são sinal de engajamento.", correct: false, agile: "Desperdício de tempo. Timebox é timebox." },
      { text: "Proibir qualquer discussão profunda.", correct: false, agile: "Perdeu aprendizado e colaboração." },
      { text: "Fazer duas dailies: uma de 15 min e outra 'real' de 1h.", correct: false, agile: "Duplicação, confusão, perda de tempo." }
    ]
  },
  {
    situation: "Time terminou tarefas com qualidade excelente. Faltam 2 dias de sprint.",
    context: "O que fazer?",
    options: [
      { text: "Relaxar. Vocês já terminaram.", correct: false, agile: "Desperdiça oportunidade de aprender e melhorar." },
      { text: "Puxar mais tarefas do backlog. Conversar com cliente sobre máximo valor.", correct: true, agile: "Entregar continuamente, colaboração com cliente, fluxo constante = ágil." },
      { text: "Criar tarefas fictícias para parecer ocupado.", correct: false, agile: "Desonesto. Mata confiança." },
      { text: "Forçar tarefas de débito técnico que ninguém pediu.", correct: false, agile: "Sem validação do cliente. Pode ser desperdício." }
    ]
  },

  // ===== KANBAN =====
  {
    situation: "O quadro Kanban mostra: 15 tarefas em 'A Fazer', 30 em 'Em Andamento', 5 em 'Pronto'.",
    context: "Qual é o problema?",
    options: [
      { text: "Não há problema. Quanto mais trabalho em andamento, melhor a produtividade.", correct: false, agile: "WIP alto = gargalos, contexto switching, qualidade ruim." },
      { text: "Adicionar mais coluna 'Em Análise' pra melhor organização.", correct: false, agile: "Mais colunas = mais complexidade, não resolve WIP." },
      { text: "WIP está muito alto! Limitar a 6-8 tarefas em andamento simultaneamente.", correct: true, agile: "WIP limitado = fluxo fluido, qualidade melhor, menos desperdício." },
      { text: "Pedir para o time trabalhar mais rápido.", correct: false, agile: "Pressão pura. Não resolve o gargalo." }
    ]
  },
  {
    situation: "Tarefas em 'Em Andamento' nunca saem porque sempre surge algo urgente.",
    context: "Como fluir melhor?",
    options: [
      { text: "Criar uma coluna 'Urgências' separada para não bagunçar o fluxo.", correct: false, agile: "Só esconde o problema. Urgências entram de qualquer jeito." },
      { text: "Aumentar o time pra fazer tudo simultaneamente.", correct: false, agile: "Mais gente = mais caos se não controlar WIP." },
      { text: "Esperar até 'Em Andamento' vazio pra puxar tudo de uma vez.", correct: false, agile: "Batch grande = atraso. Kanban é fluxo, não lotes." },
      { text: "Proteger o fluxo: não puxar nova tarefa enquanto não termina a atual.", correct: true, agile: "Fluxo contínuo, cumprimento de prazos, menos contexto switching." }
    ]
  },
  {
    situation: "O time puxa 40 tarefas por sprint, mas entrega só 25. Cliente frustrado.",
    context: "Como melhorar previsibilidade?",
    options: [
      { text: "Usar histórico para ajustar WIP e ser mais realista com capacidade.", correct: true, agile: "Dados → WIP realista → previsibilidade → cliente feliz." },
      { text: "Puxar 50 tarefas pra compensar as que não terminam.", correct: false, agile: "Piora WIP, piora a situação." },
      { text: "Culpar o time por ser lento.", correct: false, agile: "Culpa não muda fluxo. Dados mudam." },
      { text: "Usar diferentes cores de post-its pra tarefas 'fáceis' e 'difíceis'.", correct: false, agile: "Cosmético. Não resolve capacidade." }
    ]
  },
  {
    situation: "Descoberta: 60% do tempo do time é gasto em reuniões, não em trabalho real.",
    context: "Kanban deveria revelar isso?",
    options: [
      { text: "Não, Kanban é só para tarefas. Reuniões são 'fora do quadro'.", correct: false, agile: "Errado! Se tira tempo, entra no quadro." },
      { text: "Sim! Adicionar 'Reuniões' como coluna ou bloqueador pra visualizar desperdício.", correct: true, agile: "Visualizar tudo = encontrar ineficiências = melhorar fluxo." },
      { text: "Continuar ignorando e esperar que passe.", correct: false, agile: "Desperdício invisível = desperdício permanente." },
      { text: "Proibir todas as reuniões.", correct: false, agile: "Nem todas são desperdício. Medir, depois otimizar." }
    ]
  },

  // ===== LEAN =====
  {
    situation: "O processo tem 15 etapas. Cliente espera o resultado da etapa 3, mas só recebe após a etapa 15.",
    context: "Qual valor é gerado nas etapas 3-14?",
    options: [
      { text: "Qualidade. Etapas 3-14 garantem perfeição.", correct: false, agile: "Perfeição desnecessária = desperdício Lean." },
      { text: "Tempo para corrigir erros que surgem nas etapas 3-14.", correct: false, agile: "Se há erros, o processo está quebrado, não é valor." },
      { text: "Nenhum valor direto ao cliente! Isso é desperdício puro que pode ser eliminado.", correct: true, agile: "Lean: elimine o que cliente não paga. Valor rápido > perfeição lenta." },
      { text: "Documentação que ninguém lê depois.", correct: false, agile: "Documentação sem uso = desperdício Lean clássico." }
    ]
  },
  {
    situation: "Time gasta 2 semanas revisando código. Código depois é commitado em 2 minutos.",
    context: "Qual é o desperdício Lean?",
    options: [
      { text: "Nenhum. Review é essencial para qualidade.", correct: false, agile: "Review tem valor, mas 2 semanas > 2 minutos commit = ineficiência." },
      { text: "Aumentar o time de review.", correct: false, agile: "Mais gente no gargalo não o elimina." },
      { text: "Ignorar review completamente.", correct: false, agile: "Perder qualidade também é desperdício." },
      { text: "Review automático com ferramentas + review humana ágil = qualidade rápida.", correct: true, agile: "Eliminar tempo ocioso, manter valor = Lean." }
    ]
  },
  {
    situation: "Processo antigo: Requisição → Análise (4 semanas) → Desenvolvimento (2 semanas).",
    context: "Problema Lean?",
    options: [
      { text: "Análise paralela ao desenvolvimento reduz tempo total e gera valor mais rápido.", correct: true, agile: "Fluxo Lean: reduzir espera, maximizar valor, eliminar ineficiência." },
      { text: "Nenhum. Análise profunda garante bom desenvolvimento.", correct: false, agile: "Gargalo! 4 semanas análise = cliente esperando valor." },
      { text: "Análise é essencial, não pode reduzir.", correct: false, agile: "Pode otimizar sem perder qualidade." },
      { text: "Aumentar analistas.", correct: false, agile: "Mais gente num gargalo = custo maior, mesmo tempo." }
    ]
  },
  {
    situation: "Relatório mensal de despesas: 40 horas para dados que ninguém usa depois.",
    context: "Ação Lean?",
    options: [
      { text: "Continuar — é tradição da empresa.", correct: false, agile: "Tradição sem valor = desperdício Lean." },
      { text: "Eliminar completamente. Se ninguém usa, não gera valor.", correct: true, agile: "Lean: elimine o que ninguém paga ou usa." },
      { text: "Fazer relatório a cada semana em vez de mês.", correct: false, agile: "Ainda é desperdício, só mais frequente." },
      { text: "Automatizar para 5 horas.", correct: false, agile: "Se é desperdício, automatizar não é solução." }
    ]
  },

  // ===== KAIZEN =====
  {
    situation: "Time demora 1 hora para fazer deploy. Ninguém reclama — 'sempre foi assim'.",
    context: "Oportunidade de Kaizen?",
    options: [
      { text: "Não. Se ninguém reclama, está bom.", correct: false, agile: "Kaizen busca melhoria contínua, não apenas resolver crises." },
      { text: "Só mexer se virar crise (deploy cai).", correct: false, agile: "Kaizen é proativo, não reativo." },
      { text: "Sim! Kaizen: pequenos passos. Entender o fluxo, remover 10 min por semana.", correct: true, agile: "Melhoria contínua = 1h → 30min → 15min ao longo de meses." },
      { text: "Contratar especialista para redesenhar tudo de uma vez.", correct: false, agile: "Kaizen é incremental, não revolução." }
    ]
  },
  {
    situation: "Reunião diária leva 40 minutos. 'Sempre levou, é o padrão'.",
    context: "Como Kaizen?",
    options: [
      { text: "Continuar — padrões não se mexem.", correct: false, agile: "Padrões ruins = oportunidade de melhoria." },
      { text: "Eliminá-la completamente.", correct: false, agile: "Daily tem valor. Otimize, não elimine." },
      { text: "Aumentar para 1h pra mais discussão.", correct: false, agile: "Oposto de melhoria contínua." },
      { text: "Reduzir 5 min/mês: cortar tangentes, foco no essencial. Meta: 15 min em 6 meses.", correct: true, agile: "Pequenos passos = 40min → 35 → 30 → 20 → 15 com envolvimento do time." }
    ]
  },
  {
    situation: "Bug recorrente: toda sprint aparece a mesma falha em validação. Time 'já acostumou'.",
    context: "Postura Kaizen?",
    options: [
      { text: "Investigar por que bug volta, corrigir raiz. Retrospectiva identifica padrão.", correct: true, agile: "Melhoria contínua elimina recorrências." },
      { text: "Acostumar-se é normal em software.", correct: false, agile: "Kaizen: problema recorrente = investigar raiz, melhorar." },
      { text: "Aumentar testes (solução grande).", correct: false, agile: "Kaizen começa pequeno: entender → pequena mudança → verificar." },
      { text: "Ignorar e pedir ao cliente para aceitar.", correct: false, agile: "Pior postura contra melhoria contínua." }
    ]
  },
  {
    situation: "Planilha Excel que ninguém entende, mas todos usam — 'ninguém quer mexer'.",
    context: "Kaizen aqui?",
    options: [
      { text: "Deixar. Funciona, mesmo que confuso.", correct: false, agile: "Ineficiência invisível = oportunidade Kaizen." },
      { text: "Mês 1: documentar. Mês 2: remover coluna confusa. Mês 3: automatizar. Incremental.", correct: true, agile: "Pequenos passos = mudança sem trauma, todo time aprende." },
      { text: "Reescrever tudo em sistema novo (grande investimento).", correct: false, agile: "Kaizen é incremental, não big bang." },
      { text: "Treinar todo mundo melhor.", correct: false, agile: "Problema é a ferramenta, não as pessoas." }
    ]
  },

  // ===== SCRUM =====
  {
    situation: "Sprint com 5 dias. Time termina tudo no dia 3. Dias 4-5 ficam ociosos.",
    context: "Problema?",
    options: [
      { text: "Não. Time descansou, bom para saúde mental.", correct: false, agile: "Desperdício de capacidade. Melhor validar e iterar." },
      { text: "Aumentar escopo pra 10 dias de trabalho.", correct: false, agile: "Forçar barra = qualidade ruim." },
      { text: "Converter em 3-dia sprint com 2 dias de validação com cliente.", correct: true, agile: "Fluxo contínuo, feedback rápido, valor real." },
      { text: "Manter 5 dias mas adicionar burocracia.", correct: false, agile: "Piora a coisa." }
    ]
  },
  {
    situation: "Retrospectiva: mesmo problema aparece 5 sprints seguidas. Ninguém muda nada.",
    context: "O que falta?",
    options: [
      { text: "Retros não funcionam. Eliminar cerimônia.", correct: false, agile: "Retro funciona se há ação real." },
      { text: "Pedir pra todo mundo 'melhorar' vaguamente.", correct: false, agile: "Vago = nada muda." },
      { text: "Responsabilizar o ScrumMaster por tudo.", correct: false, agile: "Mudança é coletiva." },
      { text: "Atribuir proprietário por ação: 'João muda X até sprint 10'. Rastrear progresso.", correct: true, agile: "Ação → responsabilidade → resultado → real melhoria." }
    ]
  },
  {
    situation: "Velocidade do time: Sprint 1=40pts, 2=35pts, 3=50pts, 4=38pts.",
    context: "Como interpretar?",
    options: [
      { text: "Média ~40pts. Usar isso para planejar futuras sprints. Investigar outliers.", correct: true, agile: "Dados históricos = previsibilidade realista." },
      { text: "Time é inconsistente. Precisa de disciplina.", correct: false, agile: "Variação pequena é normal. Ver padrão antes de julgar." },
      { text: "Aumentar velocidade forçando horas extras.", correct: false, agile: "Qualidade cai, não rende." },
      { text: "Ignorar e achar que dá pra rodar 100pts.", correct: false, agile: "Fantasy planning = falhas garantidas." }
    ]
  },
  {
    situation: "Sprint 1 tem 3 tarefas 'críticas' de outros times que entram no meio.",
    context: "Proteção do sprint?",
    options: [
      { text: "Aceitar tudo. Nunca se sabe quando é realmente crítico.", correct: false, agile: "Sprint sem foco = nada termina bem." },
      { text: "Buffer 20%: planejar 80% de capacidade, deixar 20% para emergências reais.", correct: true, agile: "Foco protegido + flexibilidade = melhor resultado." },
      { text: "Rejeitar tudo — 'sprint é sagrado'.", correct: false, agile: "Nem sempre é possível; buffer é mais realista." },
      { text: "Criar backlog infinito de 'críticas' e executar em ordem.", correct: false, agile: "Sem prioridade = caos." }
    ]
  },

  // ===== VALORES LEAN / WASTES =====
  {
    situation: "Produto leva 6 meses pra chegar ao cliente. Destes, 5.5 meses aguardam aprovação de stakeholders.",
    context: "Qual Lean waste?",
    options: [
      { text: "Defeitos. Precisa de mais testes.", correct: false, agile: "Não é defeito, é gargalo de aprovação." },
      { text: "Movimento. Time se mexe pouco.", correct: false, agile: "Time está parado, não é movimento." },
      { text: "Espera (waiting). Tempo sem agregar valor. Paralisar produção.", correct: true, agile: "Principais 7 wastes Lean: espera é um dos piores." },
      { text: "Transporte. Aprovações demoram pra chegar.", correct: false, agile: "Transporte é movimento físico/dados, não fluxo de aprovação." }
    ]
  },
  {
    situation: "Spec document tem 200 páginas. Dev lê 30 e começa. Depois descobre erros.",
    context: "Waste Lean?",
    options: [
      { text: "Superprodução. Especificação demais ninguém lê toda.", correct: true, agile: "Over-documentation = waste clássico Lean." },
      { text: "Movimento. Muita gente mexendo no documento.", correct: false, agile: "Não é movimento." },
      { text: "Transporte. Enviar documento pro dev.", correct: false, agile: "Enviar é comunicação, não é waste se bem feito." },
      { text: "Talento subutilizado. Dev não lê tudo.", correct: false, agile: "Não é esse o problema neste caso." }
    ]
  },
  {
    situation: "Dev passa 1 dia reescrevendo código porque arquitetura mudou e ninguém avisou.",
    context: "Qual waste?",
    options: [
      { text: "Defeitos. Código estava errado.", correct: false, agile: "Código estava bom. Problema foi comunicação." },
      { text: "Espera. Dev esperou arquitetura mudar.", correct: false, agile: "Dev não esperou, trabalhou sem saber." },
      { text: "Talento subutilizado. Dev não era bom.", correct: false, agile: "Dev era competente. Sistema falhou." },
      { text: "Retrabalho (defects). Fazer algo de novo porque foi mal comunicado.", correct: true, agile: "Retrabalho não é defeito, é comunicação ruim = waste." }
    ]
  }
];

// ---- Estado do jogo ----
const gameState = {
  currentChallenge: 0,
  totalScore: 0,
  playerName: '',
  playerArea: '',
  playerTurma: '',
  answered: false,
  timeLeft: 30,
  timerInterval: null
};

function kyberGetPlayer() {
  try { return JSON.parse(localStorage.getItem('fa-player') || 'null') || null; } catch(e) { return null; }
}

function kyberStartGame() {
  // bloqueia replay
  if (typeof window.kyberAlreadyPlayed === 'function' && window.kyberAlreadyPlayed()) {
    const setupEl = document.getElementById('kyber-setup');
    if (setupEl) {
      setupEl.innerHTML =
        '<div class="kyber-already-played">' +
          '<p>⚔️ Você já completou o Kyber Game!</p>' +
          '<p style="font-size:.9rem;opacity:.7">Sua pontuação será contabilizada no ranking ao revelar sua patente final.</p>' +
        '</div>';
    }
    return;
  }

  // requer cadastro — abre modal direto
  const p = kyberGetPlayer();
  if (!p || !p.name) {
    const btn = document.getElementById('openRegister');
    if (btn) btn.click();
    return;
  }

  gameState.playerName  = p.name;
  gameState.playerArea  = p.area  || '';
  gameState.playerTurma = p.turma || '';
  gameState.totalScore  = 0;
  gameState.currentChallenge = 0;

  document.getElementById('kyber-setup').style.display    = 'none';
  document.getElementById('kyber-challenge').style.display = 'block';
  kyberShowChallenge();
}

function kyberShowChallenge() {
  if (gameState.currentChallenge >= CHALLENGES.length) {
    kyberFinishGame(); return;
  }
  gameState.answered = false;
  gameState.timeLeft = 30;
  clearInterval(gameState.timerInterval);

  const ch = CHALLENGES[gameState.currentChallenge];
  document.getElementById('kyber-situation').textContent = ch.situation;
  document.getElementById('kyber-context').textContent   = ch.context;
  document.getElementById('kyber-progress').textContent  =
    'Desafio ' + (gameState.currentChallenge + 1) + '/' + CHALLENGES.length;
  document.getElementById('kyber-score').textContent = 'Pontuação: ' + gameState.totalScore + ' pts';

  const fb = document.getElementById('kyber-feedback');
  fb.className = 'kyber-feedback'; fb.textContent = '';

  document.getElementById('kyber-next').style.display = 'none';

  const opts = document.getElementById('kyber-options');
  opts.innerHTML = '';
  ch.options.forEach(function(opt, idx) {
    const btn = document.createElement('button');
    btn.className = 'kyber-option';
    btn.innerHTML =
      '<span class="opt-letter">' + String.fromCharCode(65 + idx) + '</span>' +
      '<span class="opt-text">'   + opt.text + '</span>';
    btn.onclick = function() { kyberAnswerQuestion(idx, opt); };
    opts.appendChild(btn);
  });

  kyberUpdateTimer();
  gameState.timerInterval = setInterval(kyberUpdateTimer, 1000);
}

function kyberUpdateTimer() {
  const el = document.getElementById('kyber-timer');
  if (!el) return;
  el.textContent = gameState.timeLeft + 's';
  el.classList.remove('warning', 'danger');
  if (gameState.timeLeft <= 10) el.classList.add('warning');
  if (gameState.timeLeft <= 5)  el.classList.add('danger');
  gameState.timeLeft--;
  if (gameState.timeLeft < 0) {
    clearInterval(gameState.timerInterval);
    if (!gameState.answered) kyberAnswerQuestion(-1, null);
  }
}

function kyberAnswerQuestion(idx, option) {
  if (gameState.answered) return;
  gameState.answered = true;
  clearInterval(gameState.timerInterval);

  const fb = document.getElementById('kyber-feedback');
  fb.classList.add('show');

  if (option === null) {
    fb.classList.add('wrong');
    fb.innerHTML =
      '<div class="fb-result">⏱ TEMPO ESGOTADO</div>' +
      '<div class="fb-agile">Rápida decisão é essencial na agilidade!</div>';
  } else {
    const ch     = CHALLENGES[gameState.currentChallenge];
    const points = option.correct ? Math.round(1000 * (gameState.timeLeft / 30)) : 0;
    gameState.totalScore += points;
    fb.classList.add(option.correct ? 'correct' : 'wrong');
    fb.innerHTML =
      '<div class="fb-result">' + (option.correct ? '✓ CORRETO' : '✗ ERRADO') + '</div>' +
      '<div class="fb-points">' + (points > 0 ? '+' + points + ' XP' : '0 XP') + '</div>' +
      '<div class="fb-agile">'  + option.agile + '</div>';

    document.querySelectorAll('.kyber-option').forEach(function(el, i) {
      if (i === idx) el.classList.add(option.correct ? 'selected-correct' : 'selected-wrong');
      else if (ch.options[i].correct) el.classList.add('correct-answer');
    });
  }

  document.getElementById('kyber-score').textContent = 'Pontuação: ' + gameState.totalScore + ' pts';
  document.getElementById('kyber-next').style.display = 'inline-block';
}

function kyberNextChallenge() {
  gameState.currentChallenge++;
  if (gameState.currentChallenge >= CHALLENGES.length) {
    kyberFinishGame();
  } else {
    kyberShowChallenge();
  }
}

// Botões — aguarda DOM
document.addEventListener('DOMContentLoaded', function() {
  const btnStart = document.getElementById('kyber-start');
  const btnNext  = document.getElementById('kyber-next');
  if (btnStart) btnStart.onclick = kyberStartGame;
  if (btnNext)  btnNext.onclick  = kyberNextChallenge;
});
