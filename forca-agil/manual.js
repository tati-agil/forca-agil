/* Força Ágil — Manual Interativo */
(function () {
  'use strict';

  let activeSection = 'all';
  let activePersona = 'all';

  const SECTIONS = [
    { key: 'all',         label: 'Tudo',               color: 'var(--ink-2)' },
    { key: 'auth',        label: 'Cadastrar / Entrar',  color: '#9b7fff' },
    { key: 'inicio',      label: 'Início',              color: '#1ab2ae' },
    { key: 'turmas',      label: 'Turmas',              color: '#f5c542' },
    { key: 'conteudos',   label: 'Conteúdos',           color: '#4caf7d' },
    { key: 'repositorio', label: 'Repositório',          color: '#e8854a' },
    { key: 'quiz',        label: 'Treinamento Jedi',      color: '#e05c7f' },
    { key: 'ranking',     label: 'Ranking',              color: '#57aaff' },
    { key: 'admin',       label: 'Admin',               color: '#ff5252' },
  ];

  const PERSONAS = [
    { key: 'all',         label: 'Todas as personas',  color: 'var(--ink-2)' },
    { key: 'visitante',   label: 'Visitante',          color: '#888' },
    { key: 'logado',      label: 'Usuário logado',     color: '#1ab2ae' },
    { key: 'colaborador', label: 'Colaborador',        color: '#f5c542' },
    { key: 'admin',       label: 'Admin',              color: '#ff5252' },
  ];

  const RULES = [
    /* ── CADASTRAR / ENTRAR ── */
    { section: 'auth', personas: ['visitante'],
      title: 'Quem vê ENTRAR e CADASTRAR no menu',
      body: 'Somente visitantes (não logados) veem os botões ENTRAR e CADASTRAR no canto superior direito do menu.' },
    { section: 'auth', personas: ['logado', 'colaborador', 'admin'],
      title: 'Menu para usuário logado',
      body: 'Os botões ENTRAR e CADASTRAR somem. No lugar aparece o perfil com a inicial e o primeiro nome do usuário.' },
    { section: 'auth', personas: ['admin'],
      title: 'Link Admin no menu',
      body: 'O link "Admin" no menu só aparece para administradores.' },
    { section: 'auth', personas: ['visitante', 'logado', 'colaborador', 'admin'],
      title: 'Modal não fecha ao clicar fora',
      body: 'Evita perda do formulário preenchido. Fecha com o botão ✕ ou com ESC — mas só se todos os campos estiverem vazios.' },
    { section: 'auth', personas: ['visitante', 'logado', 'colaborador', 'admin'],
      title: 'Botão olhinho nos campos de senha',
      body: 'Disponível em todos os campos de senha. Alterna entre ocultar (👁) e mostrar (🙈) o texto digitado.' },
    { section: 'auth', personas: ['visitante'],
      title: 'Login — e-mail obrigatório @previ.com.br',
      body: 'Qualquer domínio diferente de @previ.com.br é rejeitado imediatamente, antes mesmo de consultar o banco.' },
    { section: 'auth', personas: ['visitante'],
      title: 'Login — erro de credenciais',
      body: 'Mensagem genérica: "E-mail ou senha inválidos." — não informa qual dos dois está errado (segurança).' },
    { section: 'auth', personas: ['visitante'],
      title: 'Login — botão durante autenticação',
      body: 'O botão vira "Aguarde…" e fica desabilitado enquanto a autenticação ocorre.' },
    { section: 'auth', personas: ['visitante'],
      title: 'Login — esqueci minha senha',
      body: 'Abre painel inline no modal. Usuário digita o e-mail @previ.com.br e o sistema exibe "Se este e-mail estiver cadastrado, você receberá o link de redefinição em breve." O Firebase envia o link apenas se o e-mail existir — por segurança, não revela se está cadastrado ou não. Se não for @previ.com.br, exibe "Use seu e-mail @previ.com.br." Autoatendimento — não depende do admin.' },
    { section: 'auth', personas: ['admin'],
      title: 'Admin — redefinir senha de qualquer cadastrado',
      body: 'Botão "Redefinir senha" na aba Cadastrados dispara o mesmo e-mail de redefinição do Firebase para o e-mail da pessoa. Disponível para qualquer cadastrado, não só colaboradores. Só funciona se a pessoa já tiver feito o primeiro cadastro/login.' },
    { section: 'auth', personas: ['visitante'],
      title: 'Cadastro — e-mail obrigatório @previ.com.br',
      body: 'Exige e-mail @previ.com.br. Outros domínios são rejeitados.' },
    { section: 'auth', personas: ['visitante'],
      title: 'Cadastro — senha',
      body: 'Mínimo 8 caracteres. O campo "Confirmar senha" deve ser idêntico — se divergir, exibe "As senhas não coincidem."' },
    { section: 'auth', personas: ['visitante'],
      title: 'Cadastro — área/setor',
      body: 'Lista suspensa com as gerências em ordem alfabética: ASJUR, AUDIT, CONIN, GABIN, GEBEN, GECAP, GECAT, GECON, GEINT, GEPAR, GEPRO, GERAI, GERAT, GEROP, GESOP, GETHO, INFOR, OUVIR, PNSEG, SECEX.' },
    { section: 'auth', personas: ['visitante'],
      title: 'Cadastro — checkbox de termos (obrigatório)',
      body: 'O usuário deve aceitar que seu nome apareça no ranking e no repositório. Sem marcar, bloqueia com "Aceite os termos para continuar."' },
    { section: 'auth', personas: ['visitante'],
      title: 'Cadastro — checkbox de opt-in (opcional)',
      body: 'Permite receber novidades sobre turmas e conteúdos. Não é obrigatório.' },
    { section: 'auth', personas: ['visitante'],
      title: 'Cadastro — e-mail já existente',
      body: 'Se o e-mail já estiver cadastrado, exibe: "E-mail já cadastrado. Faça login."' },
    { section: 'auth', personas: ['visitante'],
      title: 'Cadastro — formatação automática',
      body: 'Nome salvo em MAIÚSCULO. E-mail salvo em minúsculo.' },
    { section: 'auth', personas: ['visitante'],
      title: 'Cadastro — botão durante envio',
      body: 'O botão vira "Aguarde…" durante o cadastro. Ao concluir: modal fecha e o usuário permanece na página atual.' },
    { section: 'auth', personas: ['logado', 'colaborador', 'admin'],
      title: 'Clicar no perfil no menu',
      body: 'Clicar no perfil (fora do botão Sair) navega para o Treinamento Jedi.' },
    { section: 'auth', personas: ['logado', 'colaborador', 'admin'],
      title: 'Sair',
      body: 'Botão "Sair" visível no menu de perfil. Encerra a sessão e redireciona para o INÍCIO.' },

    /* ── INÍCIO ── */
    { section: 'inicio', personas: ['visitante', 'logado', 'colaborador', 'admin'],
      title: 'Acesso geral',
      body: 'Toda a página INÍCIO é visível para todos, inclusive visitantes. Nenhum conteúdo é bloqueado por login.' },
    { section: 'inicio', personas: ['visitante', 'logado', 'colaborador', 'admin'],
      title: 'CTA Final — botão "Ver turmas"',
      body: 'O CTA final tem um único botão "Ver turmas →" que navega para a página Turmas. Mesmo comportamento para todos os perfis — o objetivo é direcionar para inscrição.' },
    { section: 'inicio', personas: ['visitante', 'logado', 'colaborador', 'admin'],
      title: 'Botão "Conhecer a iniciativa"',
      body: 'Rola a página para a seção "O que é a Força Ágil". Funciona igual para todos.' },
    { section: 'inicio', personas: ['visitante', 'logado', 'colaborador', 'admin'],
      title: 'Crawl de abertura — botões de controle',
      body: 'Os três botões ficam lado a lado (layout horizontal) logo abaixo do crawl: "≡ Ler texto", "⏸ Pausar" e "↻ Repetir abertura". "Repetir abertura" reinicia a animação do início. "⏸ Pausar" pausa/retoma (equivalente a clicar na área do crawl). "≡ Ler texto" exibe o texto estático sem perspectiva; "✕ Fechar texto" retorna ao crawl animado.' },
    { section: 'inicio', personas: ['visitante', 'logado', 'colaborador', 'admin'],
      title: 'Cards "Como funciona" (Conteúdos / Repositório / Treinamento Jedi)',
      body: 'Três cards decorativos (sem hover) logo abaixo do hero, cada um navega direto para a página correspondente. Exibem pontos de experiência como incentivo. Visível e funcional para todos.' },
    { section: 'inicio', personas: ['visitante', 'logado', 'colaborador', 'admin'],
      title: 'Seção "O que está acontecendo" (Destaques)',
      body: 'Removida na v2. Os mini-blocos de Turmas, Conteúdos e Ranking não existem mais na página Início.' },
    { section: 'inicio', personas: ['visitante', 'logado', 'colaborador', 'admin'],
      title: 'Link no rodapé para previ.com.br',
      body: 'Abre o site da Previ em nova aba (link externo). Visível para todos. Presente no rodapé de todas as páginas, não só Início.' },

    /* ── TURMAS ── */
    { section: 'turmas', personas: ['visitante', 'logado', 'colaborador', 'admin'],
      title: 'Acesso geral',
      body: 'Toda a página Turmas é visível para todos — turmas, datas, descrição da oficina e agenda D1–D5.' },
    { section: 'turmas', personas: ['visitante', 'logado', 'colaborador', 'admin'],
      title: 'Bloco "Como funciona a oficina"',
      body: 'Exibido antes da agenda D1–D5 para todos. Mostra 4 métricas (5 dias, 4h por encontro, dinâmicas práticas, participação opcional) e uma descrição geral.' },
    { section: 'turmas', personas: ['visitante'],
      title: 'Botão "Tenho interesse" sem login',
      body: 'Ao clicar, exibe mensagem "Faça login para registrar seu interesse." embaixo do botão e abre o modal de login.' },
    { section: 'turmas', personas: ['logado', 'colaborador', 'admin'],
      title: 'Botão de interesse / status da turma',
      body: 'O botão reflete o status da pessoa na turma: "♡ Tenho interesse" — estilo primário (dourado sólido com brilho) → "♡ Remover interesse" — estilo secundário (fundo escuro, borda neutra) → após turma finalizada pelo admin vira "✓ Inscrita" (desabilitado, ciano) → após check-in no evento vira "✓ Presente" (desabilitado, verde). Se a turma estiver finalizada e a pessoa não estiver inscrita, exibe "Inscrições encerradas" (muted). Registros em turmas-interesse/<turma>/<emailKey> com campo status (interessado/inscrito). Log em turmas-interesse-log.' },
    { section: 'turmas', personas: ['logado', 'colaborador', 'admin'],
      title: 'Check-in no evento (QR Code)',
      body: 'Admin abre o check-in escolhendo um dia da turma (select com todos os dias — passado ou futuro) e clicando "Abrir check-in"; isso define diaAtivo em turmas-config. Participante escaneia o QR Code com a conta logada → página #checkin?turma=t1 → sistema valida (turma finalizada, check-in aberto, inscrita, não fez check-in naquele dia) → registra em turmas-checkin/<turma>/<data>/<emailKey> com source:"qr" → exibe "Presença confirmada com sucesso!". Se não estiver logada, redireciona para login e faz check-in automaticamente após autenticação.' },
    { section: 'turmas', personas: ['visitante', 'logado'],
      title: 'Agenda D1–D5 — bloqueada',
      body: 'Visitante e Usuário logado veem os títulos dos dias mas não conseguem expandir o conteúdo.' },
    { section: 'turmas', personas: ['colaborador', 'admin'],
      title: 'Agenda D1–D5 — liberada',
      body: 'Colaborador e Admin podem expandir e ver o conteúdo completo de cada dia.' },

    /* ── CONTEÚDOS ── */
    { section: 'conteudos', personas: ['visitante'],
      title: 'Acesso',
      body: 'Visitante vê todas as 7 seções numeradas (01 Mapa da Galáxia, 02 Os 4 Valores, 03 Os 12 Princípios, 04 A Força do Ágil, 05 Personagens, 06 Lado Sombrio, 07 A Trilogia) — somente leitura, sem pontos. Cada seção ocupa 100vh — uma por vez na tela.' },
    { section: 'conteudos', personas: ['visitante', 'logado', 'colaborador', 'admin'],
      title: 'Navegação lateral por pontos',
      body: 'Barra lateral com 7 pontos (01–07), setas para cima/baixo e tooltip com o nome da seção. Ao clicar em um ponto, a página rola suavemente até a seção correspondente. Funciona igual à navegação da página Início.' },
    { section: 'conteudos', personas: ['logado', 'colaborador', 'admin'],
      title: 'Pontos por leitura',
      body: '+5 pontos de experiência por seção lida. A seção precisa ficar 60% visível na tela por 10 segundos consecutivos para os pontos serem contabilizados.' },
    { section: 'conteudos', personas: ['logado', 'colaborador', 'admin'],
      title: 'Badge de leitura',
      body: 'Ao ganhar os pontos, a seção fica marcada com "✓ +5 pts". Em visitas futuras o badge já aparece marcado — não gera pontos novamente.' },
    { section: 'conteudos', personas: ['logado', 'colaborador', 'admin'],
      title: 'Publicação dos pontos',
      body: 'Os pontos de conteúdos só aparecem no ranking ao revelar a patente final.' },
    { section: 'conteudos', personas: ['visitante', 'logado', 'colaborador', 'admin'],
      title: 'Links externos "Ler na íntegra"',
      body: 'Nas seções dos 4 valores e dos 12 princípios, links abrem o Manifesto Ágil oficial (agilemanifesto.org) em nova aba. Não geram pontos, visível para todos.' },

    /* ── REPOSITÓRIO ── */
    { section: 'repositorio', personas: ['visitante'],
      title: 'Acesso',
      body: 'Visitante vê todos os conteúdos (curados e de usuários) — somente leitura. "Adicionar conteúdo" sem login → exibe mensagem "Faça login para contribuir com o repositório" + abre modal de login.' },
    { section: 'repositorio', personas: ['logado', 'colaborador', 'admin'],
      title: 'Adicionar conteúdo',
      body: 'Pode adicionar quantos conteúdos quiser ao Holocron.' },
    { section: 'repositorio', personas: ['logado', 'colaborador', 'admin'],
      title: 'Pontos por contribuição',
      body: '+10 pontos de experiência por contribuição, máximo de 20 pontos. Apenas as 2 primeiras contribuições feitas antes de revelar a patente contam para pontos.' },
    { section: 'repositorio', personas: ['logado', 'colaborador', 'admin'],
      title: 'Contribuições após revelar patente',
      body: 'Continuam aparecendo no Holocron para todos, mas não geram pontos.' },
    { section: 'repositorio', personas: ['logado', 'colaborador', 'admin'],
      title: 'Remover conteúdo próprio',
      body: 'O autor pode remover seus próprios conteúdos enviados. Não pode remover conteúdos curados.' },
    { section: 'repositorio', personas: ['admin'],
      title: 'Moderação (Admin)',
      body: 'Pode remover qualquer conteúdo enviado por usuários. Pode ocultar ou restaurar conteúdos curados.' },
    { section: 'repositorio', personas: ['visitante', 'logado', 'colaborador', 'admin'],
      title: 'Identificação dos conteúdos',
      body: 'Curados: marcados com badge "curado", sem autor. Enviados por usuários: exibem nome do autor e data de envio.' },
    { section: 'repositorio', personas: ['visitante', 'logado', 'colaborador', 'admin'],
      title: 'Descrição dos cards — ver mais / ver menos',
      body: 'Todos os cards exibem a descrição colapsada em 2 linhas por padrão (line-clamp CSS). O botão "ver mais" aparece somente quando o texto realmente transborda 2 linhas (detectado via scrollHeight > clientHeight após render). Clicar em "ver mais" expande o texto completo; "ver menos" recolhe para 2 linhas.' },
    { section: 'repositorio', personas: ['visitante', 'logado', 'colaborador', 'admin'],
      title: 'Filtrar por tipo',
      body: 'Chips "Todos / Vídeos / Documentos / Ferramentas / Livros" filtram a lista exibida. Não afeta pontos nem precisa de login.' },

    { section: 'repositorio', personas: ['visitante'],
      title: 'Formulário "Adicionar Conteúdo" — acesso',
      body: 'Visitante: ao clicar em "+ Adicionar Conteúdo", abre modal de cadastro. Após cadastrar, o formulário abre automaticamente.' },
    { section: 'repositorio', personas: ['logado', 'colaborador', 'admin'],
      title: 'Formulário "Adicionar Conteúdo" — campos',
      body: 'Campos: Título (obrigatório) · Tipo (Vídeo, Documento, Ferramenta, Livro) · Link/URL (obrigatório) · Descrição (opcional). Título e URL são obrigatórios — sem eles o formulário não envia.' },
    { section: 'repositorio', personas: ['logado', 'colaborador', 'admin'],
      title: 'Formulário "Adicionar Conteúdo" — URL',
      body: 'Se a URL não começar com http:// ou https://, o sistema adiciona "https://" automaticamente.' },
    { section: 'repositorio', personas: ['logado', 'colaborador', 'admin'],
      title: 'Formulário "Adicionar Conteúdo" — conteúdo duplicado',
      body: 'Antes de salvar, o sistema verifica se a URL já existe no Holocron. Se já foi adicionada, exibe "Este conteúdo já foi adicionado ao Holocron." e bloqueia o envio.' },
    { section: 'repositorio', personas: ['logado', 'colaborador', 'admin'],
      title: 'Formulário "Adicionar Conteúdo" — cancelar',
      body: 'Botão "Cancelar" fecha o formulário e limpa todos os campos.' },

    /* ── Treinamento Jedi ── */
    { section: 'quiz', personas: ['visitante'],
      title: 'Welcome screen (visitante)',
      body: 'Visitante vê uma tela de boas-vindas com título "Bem-vindo ao Treinamento Jedi" e um stepper visual com 4 passos: "Faça login → Explore atividades → Ganhe experiência → Desbloqueie patentes". Botão "Quero jogar" abre modal de login. O conteúdo do jogo (autodiagnóstico, missões, Kyber Game) fica oculto para visitantes.' },
    { section: 'quiz', personas: ['logado', 'colaborador', 'admin'],
      title: 'Acesso completo',
      body: 'Acesso a autodiagnóstico, missões, Kyber Game, painel de patente e revelar patente. A welcome screen é ocultada para usuários logados.' },
    { section: 'quiz', personas: ['logado', 'colaborador', 'admin'],
      title: 'Autodiagnóstico',
      body: 'Pode fazer uma vez apenas — não pode refazer. 6 dimensões, 4 níveis (Já ouvi falar → Sei o que é → Domino → Ensino). Pontos ponderados pelo nível escolhido: tudo "Já ouvi falar" = ~4 pts; tudo "Ensino" = 15 pts; combinações mistas ficam proporcionais. A granularidade é intencionalmente baixa (níveis vizinhos podem dar o mesmo valor após arredondamento): o autodiagnóstico é auto-avaliação, não prova — não deve ter peso alto no total. A baixa granularidade também desencoraja marcar tudo no nível máximo só para ganhar pontos, já que a diferença real é pequena. O que importa é a tendência geral dos níveis escolhidos. Única exceção para refazer: admin resetar o progresso.' },
    { section: 'quiz', personas: ['logado', 'colaborador', 'admin'],
      title: 'Missões',
      body: 'Cada missão pode ser feita uma vez — não pode refazer. 6 missões × 3 perguntas × 4 pts por acerto. Máximo total: 35 pts. Quando concluída, aparece "🔒 Missão concluída — não pode ser refeita. (X pts ganhos)" abaixo do header. Quando todas as 6 estão concluídas, aparece "Missões de Campo completas · +X pts" abaixo da lista (igual ao "Autodiagnóstico completo · +X pts de base"). Única exceção: se o admin resetar o progresso, a pessoa pode refazer.' },
    { section: 'quiz', personas: ['logado', 'colaborador', 'admin'],
      title: 'Kyber Game — minigame de perguntas e respostas sobre agilidade',
      body: 'Pode jogar uma vez apenas — não pode refazer. 25 desafios com timer de 30s cada. Pontos máximos: 50. Pontuação por questão: acerto = até 1000 pts × (tempo_restante/30) + bônus de velocidade = até 500 pts × (tempo_restante/30). Máximo por questão: 1500 pts. Quanto mais rápido responder certo, mais pontos — resposta errada ou tempo esgotado = 0 pts. Única exceção para refazer: admin resetar o progresso.' },
    { section: 'quiz', personas: ['logado', 'colaborador', 'admin'],
      title: 'Kyber Game — tela de conclusão',
      body: 'Mostra a pontuação do minigame e os pontos ganhos ("+X pts Kyber") e um botão "Revelar minha Patente Final" que leva à seção de revelar. Não mostra o ranque calculado (Youngling, Padawan, etc.) — a patente depende de 5 componentes e exibir um valor parcial aqui seria estado transitório confuso. Como os pts Kyber são calculados: Math.min(50, Math.round(pontuação / 20000 × 50)). Exemplo: 5734 pts → Math.round(5734/20000×50) = Math.round(14,3) = 14 pts. Pontuação máxima teórica que garante 50 pts: 20000 pts ou mais.' },
    { section: 'quiz', personas: ['logado', 'colaborador', 'admin'],
      title: 'Painel de patente',
      body: 'Visível em tempo real no Treinamento Jedi. Enquanto faltar etapa: "⚠ Patente provisória — faltam: X". Após revelar: mostra a patente definitiva.' },
    { section: 'quiz', personas: ['logado', 'colaborador', 'admin'],
      title: 'Revelar patente — pré-requisitos',
      body: 'Exige completar as 3 etapas: autodiagnóstico + todas as missões + Kyber Game, em qualquer ordem. Nenhuma pontuação aparece no ranking antes de publicar (revelar não publica — são 2 ações separadas).' },
    { section: 'quiz', personas: ['logado', 'colaborador', 'admin'],
      title: 'Revelar patente — mensagens de pendência',
      body: 'Enquanto bloqueado, o hint mostra ✓/✗ por etapa e o texto de pendência: 1 etapa faltando → "Falta completar: <etapa>."; 2 ou 3 etapas faltando → "Faltam: <etapa1>, <etapa2> e <etapa3>." (lista com vírgulas e "e" antes do último item).' },
    { section: 'quiz', personas: ['logado', 'colaborador', 'admin'],
      title: 'Revelar patente — status em tempo real',
      body: 'O botão REVELAR exibe ✓/✗ para cada uma das 3 etapas. O status é atualizado automaticamente após o login (o carregamento do progresso do Firebase é assíncrono — o botão aguarda o evento fa-auth-change para refletir o estado real). Além disso, ao concluir o autodiagnóstico, uma missão ou o Kyber Game na mesma sessão, o evento fa-progress-change é disparado (dentro de faSyncProgress) e o botão atualiza na hora, sem precisar recarregar a página.' },
    { section: 'quiz', personas: ['logado', 'colaborador', 'admin'],
      title: 'Revelar patente — o que acontece',
      body: 'Ao clicar em "Revelar minha Patente Final" (com as 3 etapas concluídas), abre um pop-up com: "Parabéns! Você completou o Treinamento Jedi.", a ilustração e o nome do rank alcançado, a pontuação total, e um checkbox "Quero publicar meu resultado no ranking" (marcado por default) com ícone (i) de aviso ("Seu nome, área e pontuação ficarão visíveis no ranking para todos. Esta ação não pode ser desfeita."). Botão "Continuar" executa: grava fa-patente-revealed=1 (faSyncProgress) e, se checkbox marcado, grava fa-patente-publicada=1 e publica no ranking (faSyncPlayer). O resultado é definitivo e não pode ser alterado.' },
    { section: 'quiz', personas: ['logado', 'colaborador', 'admin'],
      title: 'Publicar no ranking — comportamento do checkbox',
      body: 'O checkbox "Quero publicar meu resultado no ranking" vem marcado por default no pop-up de revelar. Se o usuário clicar "Continuar" sem desmarcar, o resultado é publicado automaticamente. Se desmarcar antes de clicar "Continuar", o resultado permanece privado (visível só para ele). Não tem como "despublicar" depois de publicado.' },
    { section: 'quiz', personas: ['admin'],
      title: 'Reset de progresso (Admin)',
      body: 'Admin pode resetar o progresso de qualquer colaborador. Apaga: autodiagnóstico, missões, Kyber, patente, pontos. Remove do ranking. Ação irreversível. Após o reset, a pessoa pode refazer as 3 etapas (autodiagnóstico, missões e Kyber Game) e revelar a patente novamente — essa é a única forma de refazer.' },

    /* ── RANKING ── */
    { section: 'ranking', personas: ['visitante', 'logado', 'colaborador', 'admin'],
      title: 'Acesso',
      body: 'Ranking visível para todos, inclusive visitantes. Sem restrição de acesso.' },
    { section: 'ranking', personas: ['visitante', 'logado', 'colaborador', 'admin'],
      title: 'Quem aparece no ranking',
      body: 'Só aparece quem revelou a patente final. Ordenado por pontuação total (máx 100 pts), do maior para o menor.' },
    { section: 'ranking', personas: ['visitante', 'logado', 'colaborador', 'admin'],
      title: 'Dados exibidos',
      body: 'Cada linha mostra: posição · imagem do personagem da patente (SVG miniatura) · nome · área · pontuação total.' },
    { section: 'ranking', personas: ['logado', 'colaborador', 'admin'],
      title: 'Destaque da própria linha',
      body: 'O usuário logado vê sua própria linha destacada visualmente.' },
    { section: 'ranking', personas: ['visitante', 'logado', 'colaborador', 'admin'],
      title: 'Patente no ranking',
      body: 'A patente de cada colaborador é exibida ao lado do nome para todos — incluindo visitantes. Não é informação restrita.' },
    { section: 'ranking', personas: ['visitante', 'logado', 'colaborador', 'admin'],
      title: 'Atualização em tempo real',
      body: 'O ranking atualiza automaticamente via Firebase — sem precisar recarregar a página.' },

    /* ── FAQ ── */
    { section: 'faq', personas: ['visitante', 'logado', 'colaborador', 'admin'],
      title: 'Acesso',
      body: 'Página FAQ visível para todos, inclusive visitantes. Sem restrição de acesso.' },
    { section: 'faq', personas: ['visitante', 'logado', 'colaborador', 'admin'],
      title: 'Acordeão de perguntas',
      body: 'A página tem 6 perguntas frequentes exibidas em acordeão com elemento HTML nativo <details>/<summary>. Clicar no título expande/recolhe a resposta — sem JavaScript. Cada pergunta pode ser aberta independentemente das demais.' },

    /* ── ADMIN ── */
    { section: 'admin', personas: ['visitante', 'logado', 'colaborador'],
      title: 'Acesso negado',
      body: 'Visitante, Usuário logado e Colaborador não veem o link "Admin" no menu. Se acessarem a URL diretamente, veem mensagem de acesso restrito e botão para voltar ao início.' },
    { section: 'admin', personas: ['admin'],
      title: 'Navegação por abas — desktop e mobile',
      body: '8 abas no painel: Turmas, Repositório, Colaboradores, Cadastrados, Administradores, Manual, Mapa e Testes. No desktop ficam em linha única. No mobile quebram em 2 linhas com fonte reduzida para todas ficarem visíveis sem scroll horizontal.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Turmas — visão geral',
      body: 'Cards por turma com badge ABERTA/FINALIZADA, contagem de inscritos/interessados e badge pulsante "CHECK-IN ABERTO · DD/MM" quando o check-in do dia está ativo. Botões globais "↓ Estado atual" e "↓ Histórico" exportam CSV (encoding Windows-1252 — acentos e travessão corretos no Excel pt-BR). Cada card tem botões de ação e tabela de participantes.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Turmas — finalizar inscrição',
      body: 'Botão "Finalizar inscrição" (turma ABERTA): converte todos os interessados para status inscrito em turmas-interesse e define turmas-config/<turma>/finalizada=true. Bloqueia novas inscrições na página de Turmas. Após finalizar, aparecem os botões QR Code, Abrir check-in e Reabrir turma.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Turmas — check-in do dia',
      body: 'Select com os dias da turma (pré-seleciona hoje se for um dia válido) + botão "Abrir check-in": define turmas-config/<turma>/diaAtivo com a data escolhida (ISO). Admin pode abrir para qualquer dia — passado ou futuro — sem precisar estar no dia exato. Participantes podem escanear o QR Code e registrar presença apenas enquanto um dia estiver aberto. Quando aberto, exibe "Check-in aberto: DD/MM" + botão "Fechar check-in" (limpa diaAtivo). Apenas 1 check-in por pessoa por dia é permitido.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Turmas — QR Code',
      body: 'Botão "⌘ QR Code" (disponível após finalizar): abre popup com QR gerado pela lib qrcode.js apontando para #checkin?turma=<key>. Um único QR por turma, reutilizado em todos os dias — a segurança vem do diaAtivo. A URL completa é exibida abaixo do QR.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Turmas — tabela de presença',
      body: 'Turma finalizada exibe tabela com colunas por dia (ex: 11/08, 12/08…). Cada célula mostra: "✓ qr" (check-in via QR, verde), "✓ adm" (registrado pelo admin, ciano) ou botão "—" clicável. Clicar em "—" registra presença retroativa (source:"admin") em turmas-checkin/<turma>/<data>/<emailKey> — disponível a qualquer hora, sem restrição de data. Última coluna mostra frequência X/5 em verde (≥ critério) ou vermelho (abaixo). Critério configurável: CRITERIO_PRESENCA = 0.75 em admin.js (default 75% = 4/5 dias).' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Turmas — adicionar participante após finalizar',
      body: 'Botão "＋ Participante" (disponível apenas com turma finalizada): abre sequência de prompts (e-mail @previ.com.br, nome, área). Grava diretamente em turmas-interesse/<turma>/<emailKey> com status:"inscrito" e addedByAdmin:true — sem precisar reabrir a turma. Se o e-mail já estiver na turma, exibe aviso. A tabela de presença atualiza automaticamente.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Turmas — remover inscrito da turma finalizada',
      body: 'Botão "Remover" (coluna extra na tabela de presença): marca removed:true e removedDate no registro da pessoa em turmas-interesse. Ela sai da lista de inscritos e da contagem. Diferente de "faltou a um dia" — é uma remoção da turma, não uma ausência. Os check-ins registrados não são apagados, mas a pessoa deixa de constar como inscrita.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Turmas — certificados de participação',
      body: 'Botão "📜 Certificados" (disponível apenas com turma finalizada): filtra automaticamente quem atingiu ≥ 75% de presença e abre nova aba com todos os certificados empilhados (1 por página, A4 paisagem). O navegador abre o diálogo de impressão — admin salva como PDF. Cada certificado contém: nome do participante, nome da turma, período (primeiro ao último dia), frequência atingida e assinatura da Coordenação Força Ágil. Se ninguém atingiu 75%, exibe aviso.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Turmas — reabrir turma',
      body: 'Botão "↺ Reabrir turma": reverte finalização — volta inscritos para interessado, limpa diaAtivo, permite novas inscrições. Não apaga registros de check-in já feitos.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Repositório — conteúdos curados',
      body: 'Botão "Ocultar" → some do repositório público. Botão "Restaurar" → volta a aparecer.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Repositório — conteúdos de usuários',
      body: 'Botão "Deletar" → remove permanentemente do Holocron.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Colaboradores — listar',
      body: 'Lista todos os colaboradores com nome, e-mail e data de adição. Controla apenas o papel/acesso de colaborador — não tem botões de resetar progresso ou redefinir senha (isso está na aba Cadastrados).' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Colaboradores — remover',
      body: 'Remove o colaborador. Perde acesso à agenda expandida e funcionalidades de colaborador. Não afeta o cadastro da pessoa nem seu progresso no jogo.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Colaboradores — adicionar',
      body: 'Formulário exige nome completo e e-mail @previ.com.br.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Cadastrados — listar',
      body: 'Lista TODAS as pessoas que já se cadastraram (fa-users), não só colaboradores — qualquer "logado" tem progresso possível. Mostra nome, e-mail, área, data de cadastro e XP (coluna XP). O XP aparece para qualquer pessoa que tenha feito alguma atividade (autodiagnóstico, missões, Kyber, conteúdo ou repositório) — independente de ter revelado patente ou publicado no ranking. Publicado no ranking aparece em amarelo-ouro; tem XP mas não publicou aparece em ciano; sem nenhum XP exibe "—". Fonte: players/<emailKey>.totalXP (publicados) ou calculado de fa-progress/<emailKey> (não publicados).' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Cadastrados — resetar progresso',
      body: 'Disponível para qualquer pessoa cadastrada, não só colaboradores. Apaga fa-progress/<emailKey>, remove do ranking (players — busca por email, pois a chave de players é name__turma, não emailKey) e escreve fa-reset-signal/<emailKey> = {at: serverTimestamp}. Ação irreversível — pede confirmação antes de executar. Após o reset: (1) a tabela admin recarrega e XP exibe "—"; (2) se a pessoa estiver logada, o listener contínuo em fa-reset-signal/<emailKey> detecta a mudança, limpa o localStorage e recarrega a página automaticamente — todos os jogos (autodiagnóstico, missões, Kyber, revelar patente) ficam disponíveis para refazer sem nenhuma ação da pessoa. Detalhe técnico: faLoadProgress usa .once() para carregar o progresso ao logar e mantém listener contínuo somente no nó fa-reset-signal (separado de fa-progress, para evitar conflito com faSyncProgress).' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Cadastrados — redefinir senha',
      body: 'Disponível para qualquer pessoa cadastrada, não só colaboradores. Dispara o e-mail de redefinição de senha do Firebase.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Administradores — super-admins fixos',
      body: 'tatianefdirene@previ.com.br e danielfrazao@previ.com.br são super-admins fixos — não removíveis via painel.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Administradores — admins adicionais',
      body: 'Podem ser adicionados e removidos via painel. Formulário exige nome completo e e-mail @previ.com.br.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Manual',
      body: 'Checklist de regras de comportamento do sistema, organizado por seção e por persona. Documentação viva — deve ser atualizada junto de qualquer mudança de comportamento.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Mapa',
      body: 'Mostra quatro seções: (1) Hierarquia de Personas — níveis de acesso cumulativos; (2) Mapa do Site — páginas e features com nível mínimo por persona; (3) Arquitetura Técnica e Regras Operacionais — acordeão com tecnologias, módulos, padrões de código, padrões de UX, deploy e regras de governança; (4) Diagrama da Arquitetura — visão visual gerada automaticamente a partir dos dados da Arquitetura Técnica.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Mapa — estrutura dos dados em mapa.js',
      body: 'Os dados da aba Mapa estão em dois arrays separados em forca-agil/mapa.js. ARCH contém o que o sistema é: Linguagens, Tecnologias & Serviços, Estrutura de Arquivos, Padrões de Código, Padrões de UX e Deploy — renderizado como "Arquitetura Técnica" e usado pelo Diagrama. REGRAS contém como o sistema deve ser mantido: Deploy (processo), Cache e Autonomia — renderizado como "Regras Operacionais". Para adicionar ou editar uma seção técnica, mexa em ARCH. Para adicionar ou editar uma regra de processo ou restrição, mexa em REGRAS.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Testes',
      body: 'Roda os testes automatizados (técnicos e de comportamento) e exibe o checklist de regras que exigem validação manual.' },
    { section: 'admin', personas: ['admin'],
      title: 'Deploy — pre-commit hook de sintaxe',
      body: 'Git hook em .git/hooks/pre-commit roda node --check em todos os forca-agil/*.js antes de cada commit. Se qualquer arquivo tiver erro de sintaxe, o commit é bloqueado com o nome do arquivo e o erro — impedindo que código quebrado chegue ao ar.' },
  ];

  function esc(s) {
    return String(s || '').replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function sectionColor(key) {
    const s = SECTIONS.find(function (x) { return x.key === key; });
    return s ? s.color : '#888';
  }

  function render() {
    const container = document.getElementById('adminManual');
    if (!container) return;

    const filtered = RULES.filter(function (r) {
      var secOk = activeSection === 'all' || r.section === activeSection;
      var perOk = activePersona === 'all' || r.personas.indexOf(activePersona) !== -1;
      return secOk && perOk;
    });

    /* Group by section preserving SECTIONS order */
    const grouped = {};
    SECTIONS.forEach(function (s) { if (s.key !== 'all') grouped[s.key] = []; });
    filtered.forEach(function (r) { if (grouped[r.section]) grouped[r.section].push(r); });

    /* Build HTML */
    let html = '<div class="manual-wrap">';
    html += '<h3 class="manual-title">Manual da Força Ágil</h3>';

    /* Dropdown filters */
    html += '<div class="manual-filter-bar">';

    html += '<div class="manual-select-wrap">';
    html += '<label class="manual-select-label">Seção</label>';
    html += '<select class="manual-select" id="manualSecSelect">';
    SECTIONS.forEach(function (s) {
      html += '<option value="' + s.key + '"' + (activeSection === s.key ? ' selected' : '') + '>' + s.label + '</option>';
    });
    html += '</select></div>';

    html += '<div class="manual-select-wrap">';
    html += '<label class="manual-select-label">Persona</label>';
    html += '<select class="manual-select" id="manualPerSelect">';
    PERSONAS.forEach(function (p) {
      html += '<option value="' + p.key + '"' + (activePersona === p.key ? ' selected' : '') + '>' + p.label + '</option>';
    });
    html += '</select></div>';

    html += '</div>';

    /* Active filter chips */
    var hasActiveChips = activeSection !== 'all' || activePersona !== 'all';
    if (hasActiveChips) {
      html += '<div class="manual-active-chips">';
      if (activeSection !== 'all') {
        const s = SECTIONS.find(function (x) { return x.key === activeSection; });
        html += '<span class="manual-active-chip" style="--chip-col:' + s.color + '" data-clear="section">' + s.label + ' <span class="manual-chip-x">×</span></span>';
      }
      if (activePersona !== 'all') {
        const p = PERSONAS.find(function (x) { return x.key === activePersona; });
        html += '<span class="manual-active-chip" style="--chip-col:' + p.color + '" data-clear="persona">' + p.label + ' <span class="manual-chip-x">×</span></span>';
      }
      html += '</div>';
    }

    /* Count + export button */
    html += '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:4px">';
    html += '<p class="manual-count" style="margin:0">' + filtered.length + ' regra' + (filtered.length !== 1 ? 's' : '') + ' encontrada' + (filtered.length !== 1 ? 's' : '') + '</p>';
    html += '<button class="btn btn--sm" id="manualExportBtn">⬇ Exportar Excel (todas as regras)</button>';
    html += '</div>';

    /* Rules */
    html += '<div class="manual-rules">';
    if (filtered.length === 0) {
      html += '<p style="color:var(--ink-3);padding:32px 0;font-family:var(--font-mono);font-size:.85rem">Nenhuma regra encontrada para esta combinação de filtros.</p>';
    } else {
      SECTIONS.forEach(function (s) {
        if (s.key === 'all') return;
        const items = grouped[s.key];
        if (!items || !items.length) return;

        if (activeSection === 'all') {
          html += '<details class="manual-section-group">';
          html += '<summary class="manual-section-header" style="border-color:' + s.color + ';color:' + s.color + '">' + s.label + '<svg class="manual-chev manual-sec-chev" width="14" height="14" viewBox="0 0 14 14"><polyline points="2,4 7,10 12,4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></summary>';
        }

        items.forEach(function (rule) {
          const col = sectionColor(rule.section);
          const badges = rule.personas.map(function (pk) {
            const p = PERSONAS.find(function (x) { return x.key === pk; });
            if (!p || p.key === 'all') return '';
            const isActive = activePersona === pk;
            return '<span class="manual-badge' + (isActive ? ' active' : '') + '" style="--badge-col:' + p.color + '">' + p.label + '</span>';
          }).join('');

          html += '<details class="manual-card" style="--card-col:' + col + '">';
          html += '<summary class="manual-card-summary"><span class="manual-card-title">' + esc(rule.title) + '</span><svg class="manual-chev" width="14" height="14" viewBox="0 0 14 14"><polyline points="2,4 7,10 12,4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></summary>';
          html += '<div class="manual-card-body">' + esc(rule.body) + '</div>';
          html += '<div class="manual-card-personas">' + badges + '</div>';
          html += '</details>';
        });

        if (activeSection === 'all') html += '</details>';
      });
    }
    html += '</div></div>';

    container.innerHTML = html;

    /* Wire dropdowns */
    var secSel = document.getElementById('manualSecSelect');
    if (secSel) secSel.addEventListener('change', function () { activeSection = this.value; render(); });
    var perSel = document.getElementById('manualPerSelect');
    if (perSel) perSel.addEventListener('change', function () { activePersona = this.value; render(); });

    /* Wire active chip × buttons */
    container.querySelectorAll('.manual-active-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        if (chip.dataset.clear === 'section') activeSection = 'all';
        else activePersona = 'all';
        render();
      });
    });

    /* Export all rules to Excel */
    const exportBtn = document.getElementById('manualExportBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        if (!window.faToXls) return;
        const rows = [];
        SECTIONS.forEach(function (s) {
          if (s.key === 'all') return;
          const sectionRules = RULES.filter(function (r) { return r.section === s.key; });
          sectionRules.forEach(function (r) {
            rows.push([
              s.label,
              r.title,
              r.body,
              r.personas.map(function (pk) {
                const p = PERSONAS.find(function (x) { return x.key === pk; });
                return p ? p.label : pk;
              }).join(', ')
            ]);
          });
        });
        window.faToXls(
          ['Seção', 'Regra', 'Descrição', 'Personas'],
          rows,
          'manual-forca-agil-' + new Date().toISOString().slice(0, 10) + '.csv'
        );
      });
    }
  }

  window.faInitManual = render;
})();
