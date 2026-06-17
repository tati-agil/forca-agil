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
    { section: 'inicio', personas: ['visitante'],
      title: 'Botão "Juntar-se à Força →" (Hero e CTA Final)',
      body: 'Aparece em dois lugares. Para visitante: abre modal de cadastro.' },
    { section: 'inicio', personas: ['logado', 'colaborador', 'admin'],
      title: 'Botão "Juntar-se à Força →" (Hero e CTA Final)',
      body: 'Aparece em dois lugares. Para usuário logado: navega direto para o Treinamento Jedi.' },
    { section: 'inicio', personas: ['visitante', 'logado', 'colaborador', 'admin'],
      title: 'Botão "Conhecer a iniciativa"',
      body: 'Rola a página para a seção "O que é a Força Ágil". Funciona igual para todos.' },
    { section: 'inicio', personas: ['visitante', 'logado', 'colaborador', 'admin'],
      title: 'Botão "Repetir abertura"',
      body: 'Reinicia a animação do crawl de abertura ("Episódio I — O Despertar da Agilidade"). Funciona igual para todos, não depende de login.' },
    { section: 'inicio', personas: ['visitante', 'logado', 'colaborador', 'admin'],
      title: 'Cards "Como funciona" (Conteúdos / Repositório / Treinamento Jedi)',
      body: 'Três cards clicáveis logo abaixo do hero, cada um navega direto para a página correspondente (Conteúdos, Repositório, Treinamento Jedi). Visível e funcional para todos.' },
    { section: 'inicio', personas: ['visitante', 'logado', 'colaborador', 'admin'],
      title: 'Mini Próximas Turmas (bloco Destaques)',
      body: 'Lista as turmas curadas (estático, não vem do Firebase). Link "Ver turmas e demonstrar interesse" navega para a página Turmas. Visível para todos.' },
    { section: 'inicio', personas: ['visitante', 'logado', 'colaborador', 'admin'],
      title: 'Mini Conteúdos (bloco Destaques)',
      body: 'Lista os 5 conteúdos curados. Clicar em qualquer item navega para a página Conteúdos. Link "Explorar conteúdos" faz o mesmo. Visível para todos.' },
    { section: 'inicio', personas: ['visitante', 'logado', 'colaborador', 'admin'],
      title: 'Ranking mini (bloco Destaques)',
      body: 'Carrega os dados reais do Firebase em tempo real. Link "Ver ranking completo" navega para a página Ranking. Visível para todos.' },
    { section: 'inicio', personas: ['visitante', 'logado', 'colaborador', 'admin'],
      title: 'Link no rodapé para previ.com.br',
      body: 'Abre o site da Previ em nova aba (link externo). Visível para todos. Presente no rodapé de todas as páginas, não só Início.' },

    /* ── TURMAS ── */
    { section: 'turmas', personas: ['visitante', 'logado', 'colaborador', 'admin'],
      title: 'Acesso geral',
      body: 'Toda a página Turmas é visível para todos — turmas, datas, descrição da oficina, temas e agenda D1–D5.' },
    { section: 'turmas', personas: ['visitante'],
      title: 'Botão "Tenho interesse"',
      body: 'Para visitante: ao clicar, abre modal de cadastro.' },
    { section: 'turmas', personas: ['logado', 'colaborador', 'admin'],
      title: 'Botão "Tenho interesse"',
      body: 'Registra o interesse no Firebase. Botão vira "✓ Interesse registrado". Não pode registrar interesse duas vezes na mesma turma.' },
    { section: 'turmas', personas: ['visitante', 'logado'],
      title: 'Agenda D1–D5 — bloqueada',
      body: 'Visitante e Usuário logado veem os títulos dos dias mas não conseguem expandir o conteúdo.' },
    { section: 'turmas', personas: ['colaborador', 'admin'],
      title: 'Agenda D1–D5 — liberada',
      body: 'Colaborador e Admin podem expandir e ver o conteúdo completo de cada dia.' },

    /* ── CONTEÚDOS ── */
    { section: 'conteudos', personas: ['visitante'],
      title: 'Acesso',
      body: 'Visitante vê todas as 5 seções (Galáxia, Força, Arquétipos, Lado Sombrio, Trilogia) — somente leitura, sem XP.' },
    { section: 'conteudos', personas: ['logado', 'colaborador', 'admin'],
      title: 'XP por leitura',
      body: '+5 XP por seção lida. A seção precisa ficar 60% visível na tela por 10 segundos consecutivos para o XP ser contabilizado.' },
    { section: 'conteudos', personas: ['logado', 'colaborador', 'admin'],
      title: 'Badge de leitura',
      body: 'Ao ganhar o XP, a seção fica marcada com "✓ +5 XP". Em visitas futuras o badge já aparece marcado — não gera XP novamente.' },
    { section: 'conteudos', personas: ['logado', 'colaborador', 'admin'],
      title: 'Publicação do XP',
      body: 'O XP de conteúdos só aparece no ranking ao revelar a patente final.' },
    { section: 'conteudos', personas: ['visitante', 'logado', 'colaborador', 'admin'],
      title: 'Links externos "Ler na íntegra"',
      body: 'Nas seções dos 4 valores e dos 12 princípios, links abrem o Manifesto Ágil oficial (agilemanifesto.org) em nova aba. Não geram XP, visível para todos.' },

    /* ── REPOSITÓRIO ── */
    { section: 'repositorio', personas: ['visitante'],
      title: 'Acesso',
      body: 'Visitante vê todos os conteúdos (curados e de usuários) — somente leitura. Botão "Adicionar ao Holocron" → abre modal de cadastro.' },
    { section: 'repositorio', personas: ['logado', 'colaborador', 'admin'],
      title: 'Adicionar conteúdo',
      body: 'Pode adicionar quantos conteúdos quiser ao Holocron.' },
    { section: 'repositorio', personas: ['logado', 'colaborador', 'admin'],
      title: 'XP por contribuição',
      body: '+10 XP por contribuição, máximo de 20 XP. Apenas as 2 primeiras contribuições feitas antes de revelar a patente contam para XP.' },
    { section: 'repositorio', personas: ['logado', 'colaborador', 'admin'],
      title: 'Contribuições após revelar patente',
      body: 'Continuam aparecendo no Holocron para todos, mas não geram XP.' },
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
      title: 'Filtrar por tipo',
      body: 'Chips "Todos / Vídeos / Documentos / Ferramentas / Livros" filtram a lista exibida. Não afeta XP nem precisa de login.' },

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
      title: 'Acesso negado',
      body: 'Visitante não acessa o Treinamento Jedi. Ao tentar entrar, é redirecionado para o modal de cadastro.' },
    { section: 'quiz', personas: ['logado', 'colaborador', 'admin'],
      title: 'Acesso completo',
      body: 'Acesso a autodiagnóstico, missões, Kyber Game, painel de patente e revelar patente.' },
    { section: 'quiz', personas: ['logado', 'colaborador', 'admin'],
      title: 'Autodiagnóstico',
      body: 'Pode fazer uma vez apenas — não pode refazer. 6 dimensões, 4 níveis (Já ouvi falar → Sei o que é → Domino → Ensino). XP ponderado pelo nível escolhido: tudo "Já ouvi falar" = ~4 XP; tudo "Ensino" = 15 XP; combinações mistas ficam proporcionais. A granularidade é intencionalmente baixa (níveis vizinhos podem dar o mesmo XP após arredondamento): o autodiagnóstico é auto-avaliação, não prova — não deve ter peso alto no total. A baixa granularidade também desencoraja marcar tudo no nível máximo só para ganhar XP, já que a diferença real é pequena. O que importa é a tendência geral dos níveis escolhidos. Única exceção para refazer: admin resetar o progresso.' },
    { section: 'quiz', personas: ['logado', 'colaborador', 'admin'],
      title: 'Missões',
      body: 'Cada missão pode ser feita uma vez — não pode refazer. 6 missões × 3 perguntas × 4 XP por acerto. XP máximo total: 35 XP. Quando concluída, aparece "🔒 Missão concluída — não pode ser refeita. (X XP ganhos)" abaixo do header. Quando todas as 6 estão concluídas, aparece "Missões de Campo completas · +X XP" abaixo da lista (igual ao "Autodiagnóstico completo · +X XP de base"). Única exceção: se o admin resetar o progresso, a pessoa pode refazer.' },
    { section: 'quiz', personas: ['logado', 'colaborador', 'admin'],
      title: 'Kyber Game',
      body: 'Pode jogar uma vez apenas — não pode refazer. 25 desafios com timer de 30s cada. XP máximo: 50 XP. Pontuação por questão: acerto = até 1000 pts × (tempo_restante/30) + bônus de velocidade = até 500 pts × (tempo_restante/30). Máximo por questão: 1500 pts. Quanto mais rápido responder certo, mais pontos — resposta errada ou tempo esgotado = 0 pts. Única exceção para refazer: admin resetar o progresso.' },
    { section: 'quiz', personas: ['logado', 'colaborador', 'admin'],
      title: 'Kyber Game — tela de conclusão',
      body: 'Mostra a pontuação do minigame e o XP ganho ("+X XP Kyber") e um botão "Revelar minha Patente Final" que leva à seção de revelar. Não mostra o ranque calculado (Youngling, Padawan, etc.) — a patente depende de 5 componentes e exibir um valor parcial aqui seria estado transitório confuso. Como o XP Kyber é calculado: Math.min(50, Math.round(pontuação / 20000 × 50)). Exemplo: 5734 pts → Math.round(5734/20000×50) = Math.round(14,3) = 14 XP. Pontuação máxima teórica que garante 50 XP: 20000 pts ou mais.' },
    { section: 'quiz', personas: ['logado', 'colaborador', 'admin'],
      title: 'Painel de patente',
      body: 'Visível em tempo real no Treinamento Jedi. Enquanto faltar etapa: "⚠ Patente provisória — faltam: X". Após revelar: mostra a patente definitiva.' },
    { section: 'quiz', personas: ['logado', 'colaborador', 'admin'],
      title: 'Revelar patente — pré-requisitos',
      body: 'Exige completar as 3 etapas: autodiagnóstico + todas as missões + Kyber Game, em qualquer ordem. Nenhum XP aparece no ranking antes de publicar (revelar não publica — são 2 ações separadas).' },
    { section: 'quiz', personas: ['logado', 'colaborador', 'admin'],
      title: 'Revelar patente — mensagens de pendência',
      body: 'Enquanto bloqueado, o hint mostra ✓/✗ por etapa e o texto de pendência: 1 etapa faltando → "Falta completar: <etapa>."; 2 ou 3 etapas faltando → "Faltam: <etapa1>, <etapa2> e <etapa3>." (lista com vírgulas e "e" antes do último item).' },
    { section: 'quiz', personas: ['logado', 'colaborador', 'admin'],
      title: 'Revelar patente — status em tempo real',
      body: 'O botão REVELAR exibe ✓/✗ para cada uma das 3 etapas. O status é atualizado automaticamente após o login (o carregamento do progresso do Firebase é assíncrono — o botão aguarda o evento fa-auth-change para refletir o estado real). Além disso, ao concluir o autodiagnóstico, uma missão ou o Kyber Game na mesma sessão, o evento fa-progress-change é disparado (dentro de faSyncProgress) e o botão atualiza na hora, sem precisar recarregar a página.' },
    { section: 'quiz', personas: ['logado', 'colaborador', 'admin'],
      title: 'Revelar patente — o que acontece',
      body: 'Ao clicar em "Revelar minha Patente Final" (com as 3 etapas concluídas), abre um pop-up com: "Parabéns! Você completou o Treinamento Jedi.", a ilustração e o nome do rank alcançado, o XP total, e um checkbox "Quero publicar meu resultado no ranking" (marcado por default) com ícone (i) de aviso ("Seu nome, área e pontuação ficarão visíveis no ranking para todos. Esta ação não pode ser desfeita."). Botão "Continuar" executa: grava fa-patente-revealed=1 (faSyncProgress) e, se checkbox marcado, grava fa-patente-publicada=1 e publica no ranking (faSyncPlayer). O resultado é definitivo e não pode ser alterado.' },
    { section: 'quiz', personas: ['logado', 'colaborador', 'admin'],
      title: 'Publicar no ranking — comportamento do checkbox',
      body: 'O checkbox "Quero publicar meu resultado no ranking" vem marcado por default no pop-up de revelar. Se o usuário clicar "Continuar" sem desmarcar, o resultado é publicado automaticamente. Se desmarcar antes de clicar "Continuar", o resultado permanece privado (visível só para ele). Não tem como "despublicar" depois de publicado.' },
    { section: 'quiz', personas: ['admin'],
      title: 'Reset de progresso (Admin)',
      body: 'Admin pode resetar o progresso de qualquer colaborador. Apaga: autodiagnóstico, missões, Kyber, patente, XP. Remove do ranking. Ação irreversível. Após o reset, a pessoa pode refazer as 3 etapas (autodiagnóstico, missões e Kyber Game) e revelar a patente novamente — essa é a única forma de refazer.' },

    /* ── RANKING ── */
    { section: 'ranking', personas: ['visitante', 'logado', 'colaborador', 'admin'],
      title: 'Acesso',
      body: 'Ranking visível para todos, inclusive visitantes. Sem restrição de acesso.' },
    { section: 'ranking', personas: ['visitante', 'logado', 'colaborador', 'admin'],
      title: 'Quem aparece no ranking',
      body: 'Só aparece quem revelou a patente final. Ordenado por XP total (máx 100 XP), do maior para o menor.' },
    { section: 'ranking', personas: ['visitante', 'logado', 'colaborador', 'admin'],
      title: 'Dados exibidos',
      body: 'Cada linha mostra: posição · nome · área · XP total.' },
    { section: 'ranking', personas: ['logado', 'colaborador', 'admin'],
      title: 'Destaque da própria linha',
      body: 'O usuário logado vê sua própria linha destacada visualmente.' },
    { section: 'ranking', personas: ['visitante', 'logado', 'colaborador', 'admin'],
      title: 'Patente no ranking',
      body: 'A patente de cada colaborador é exibida ao lado do nome para todos — incluindo visitantes. Não é informação restrita.' },
    { section: 'ranking', personas: ['visitante', 'logado', 'colaborador', 'admin'],
      title: 'Atualização em tempo real',
      body: 'O ranking atualiza automaticamente via Firebase — sem precisar recarregar a página.' },

    /* ── ADMIN ── */
    { section: 'admin', personas: ['visitante', 'logado', 'colaborador'],
      title: 'Acesso negado',
      body: 'Visitante, Usuário logado e Colaborador não veem o link "Admin" no menu. Se acessarem a URL diretamente, veem mensagem de acesso restrito e botão para voltar ao início.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Interessados por turma',
      body: 'Lista todos que clicaram "Tenho interesse" em cada turma, com nome, e-mail, área e data.' },
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
      body: 'Lista TODAS as pessoas que já se cadastraram (fa-users), não só colaboradores — qualquer "logado" tem progresso possível. Mostra nome, e-mail, área e data de cadastro. Tem campo de filtro por nome ou e-mail (lista pode ficar longa).' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Cadastrados — resetar progresso',
      body: 'Disponível para qualquer pessoa cadastrada, não só colaboradores. Apaga autodiagnóstico, missões, Kyber Game, patente, XP e remove do ranking. Ação irreversível — pede confirmação antes de executar.' },
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
      body: 'Mostra a hierarquia de personas (Visitante → Logado → Colaborador → Admin) e o mapa de todas as páginas do site com suas features e o nível mínimo de acesso de cada uma.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Testes',
      body: 'Roda os testes automatizados (técnicos e de comportamento) e exibe o checklist de regras que exigem validação manual.' },
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

    /* Section chips */
    html += '<div class="manual-filter-row"><span class="manual-filter-label">Seção</span><div class="manual-chips">';
    SECTIONS.forEach(function (s) {
      const active = activeSection === s.key;
      html += '<button class="manual-chip' + (active ? ' active' : '') + '" data-type="section" data-key="' + s.key + '" style="--chip-col:' + s.color + '">' + s.label + '</button>';
    });
    html += '</div></div>';

    /* Persona chips */
    html += '<div class="manual-filter-row"><span class="manual-filter-label">Persona</span><div class="manual-chips">';
    PERSONAS.forEach(function (p) {
      const active = activePersona === p.key;
      html += '<button class="manual-chip' + (active ? ' active' : '') + '" data-type="persona" data-key="' + p.key + '" style="--chip-col:' + p.color + '">' + p.label + '</button>';
    });
    html += '</div></div>';

    /* Count */
    html += '<p class="manual-count">' + filtered.length + ' regra' + (filtered.length !== 1 ? 's' : '') + ' encontrada' + (filtered.length !== 1 ? 's' : '') + '</p>';

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

    /* Wire filter chips */
    container.querySelectorAll('.manual-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.dataset.type === 'section') activeSection = btn.dataset.key;
        else activePersona = btn.dataset.key;
        render();
      });
    });
  }

  window.faInitManual = render;
})();
