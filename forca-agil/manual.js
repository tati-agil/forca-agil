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
    { key: 'checkin',     label: 'Check-in',            color: '#42a5f5' },
    { key: 'conteudos',   label: 'Conteúdos',           color: '#4caf7d' },
    { key: 'repositorio', label: 'Repositório',          color: '#e8854a' },
    { key: 'quiz',        label: 'Treinamento Jedi',      color: '#e05c7f' },
    { key: 'ajuda',       label: 'Ajuda',               color: '#7ecbff' },
    { key: 'admin',       label: 'Admin',               color: '#ff5252' },
  ];

  const PERSONAS = [
    { key: 'all',         label: 'Todas as personas',  color: 'var(--ink-2)' },
    { key: 'visitante',   label: 'Visitante',          color: '#888' },
    { key: 'logado',      label: 'Usuário logado (sem turma)', color: '#1ab2ae' },
    { key: 'inscrito',    label: 'Inscrito (turma confirmada)', color: '#4caf7d' },
    { key: 'admin',       label: 'Admin',              color: '#ff5252' },
  ];

  const RULES = [
    /* ── CADASTRAR / ENTRAR ── */
    { section: 'auth', personas: ['visitante'],
      title: 'Quem vê ENTRAR e CADASTRAR no menu',
      body: 'Somente visitantes (não logados) veem os botões ENTRAR e CADASTRAR no canto superior direito do menu.' },
    { section: 'auth', personas: ['logado', 'inscrito', 'admin'],
      title: 'Menu para usuário logado',
      body: 'Os botões ENTRAR e CADASTRAR somem. No lugar aparece o perfil com a inicial e o primeiro nome do usuário. O header exibe avatar, nome e botão Sair.' },
    { section: 'auth', personas: ['admin'],
      title: 'Link Admin no menu',
      body: 'O link "Admin" no menu só aparece para administradores e some imediatamente após o logout — inclusive no mobile com o menu aberto.' },
    { section: 'auth', personas: ['visitante', 'logado', 'inscrito', 'admin'],
      title: 'Três perfis de acesso',
      body: 'O sistema detecta automaticamente o perfil da pessoa: visitante não logado (vê Início, Turmas, Ajuda no menu); logado sem turma confirmada (vê + Repositório, pode manifestar interesse em turmas); logado com turma confirmada (vê + Conteúdos e Treinamento Jedi, sem botões de interesse em turmas). Admin vê tudo.' },
    { section: 'auth', personas: ['visitante', 'logado', 'inscrito', 'admin'],
      title: 'Modal não fecha ao clicar fora',
      body: 'Evita perda do formulário preenchido. Fecha com o botão ✕ ou com ESC — mas só se todos os campos estiverem vazios.' },
    { section: 'auth', personas: ['visitante', 'logado', 'inscrito', 'admin'],
      title: 'Botão olhinho nos campos de senha',
      body: 'Disponível em todos os campos de senha. Alterna entre ocultar (👁) e mostrar (🙈) o texto digitado.' },
    { section: 'auth', personas: ['visitante'],
      title: 'Login — e-mail obrigatório @previ.com.br',
      body: 'Qualquer domínio diferente de @previ.com.br é rejeitado imediatamente, antes mesmo de consultar o banco.' },
    { section: 'auth', personas: ['visitante', 'logado', 'inscrito', 'admin'],
      title: 'Segurança — restrição de domínio nas regras do banco',
      body: 'Além da validação na tela, o banco de dados também exige e-mail @previ.com.br em qualquer leitura ou escrita. Mesmo que alguém tente burlar a validação da tela e acessar o banco diretamente com outro domínio, o acesso é recusado.' },
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
      body: 'Botão "Redefinir senha" na aba Cadastrados envia o mesmo e-mail de redefinição para a pessoa. Disponível para qualquer cadastrado. Só funciona se a pessoa já tiver feito o primeiro cadastro/login.' },
    { section: 'auth', personas: ['visitante'],
      title: 'Cadastro — e-mail obrigatório @previ.com.br',
      body: 'Exige e-mail @previ.com.br. Outros domínios são rejeitados.' },
    { section: 'auth', personas: ['visitante'],
      title: 'Cadastro — senha',
      body: 'Apenas números, mínimo 8 dígitos. O teclado numérico abre automaticamente em celular. O campo "Confirmar senha" deve ser idêntico — se divergir, exibe "As senhas não coincidem." Se contiver letras ou símbolos, exibe "Senha deve conter apenas números e ter mínimo 8 dígitos."' },
    { section: 'auth', personas: ['visitante'],
      title: 'Cadastro — área/setor',
      body: 'Lista suspensa com as gerências em ordem alfabética: ASJUR, AUDIT, CONIN, GABIN, GEBEN, GECAP, GECAT, GECON, GEINT, GEPAR, GEPRO, GERAI, GERAT, GEROP, GESOP, GETHO, INFOR, OUVIR, PNSEG, SECEX.' },
    { section: 'auth', personas: ['visitante'],
      title: 'Cadastro — checkbox de termos (obrigatório)',
      body: 'O usuário deve aceitar os termos de uso antes de concluir o cadastro. Sem marcar, bloqueia com "Aceite os termos para continuar."' },
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
    { section: 'auth', personas: ['inscrito', 'admin'],
      title: 'Clicar no perfil no menu',
      body: 'Clicar no perfil (fora do botão Sair) navega para o Treinamento Jedi.' },
    { section: 'auth', personas: ['logado'],
      title: 'Clicar no perfil no menu — sem turma confirmada',
      body: 'Clicar no perfil tenta navegar para o Treinamento Jedi, mas a pessoa é redirecionada de volta para o Início com a mensagem "Disponível após confirmação em uma turma." — não chega a ver a página.' },
    { section: 'auth', personas: ['logado', 'inscrito', 'admin'],
      title: 'Sair',
      body: 'Botão "Sair" visível no menu de perfil. Encerra a sessão e redireciona para o INÍCIO.' },

    /* ── INÍCIO ── */
    { section: 'inicio', personas: ['visitante', 'logado', 'inscrito', 'admin'],
      title: 'Acesso geral',
      body: 'Toda a página INÍCIO é visível para todos, inclusive visitantes. Nenhum conteúdo é bloqueado por login.' },
    { section: 'inicio', personas: ['visitante', 'logado', 'inscrito', 'admin'],
      title: 'Botão final da página — "Ver turmas"',
      body: 'A página termina com um único botão "Ver turmas →" que navega para a página Turmas. Mesmo comportamento para todos os perfis — o objetivo é direcionar para inscrição.' },
    { section: 'inicio', personas: ['visitante', 'logado', 'inscrito', 'admin'],
      title: 'Botão "Conhecer a iniciativa"',
      body: 'Rola a página para a seção "O que é a Força Ágil". Funciona igual para todos.' },
    { section: 'inicio', personas: ['visitante', 'logado', 'inscrito', 'admin'],
      title: 'Animação de abertura — botões de controle',
      body: 'Os três botões ficam lado a lado logo abaixo da animação: "≡ Ler texto", "⏸ Pausar" e "↻ Repetir abertura". "Repetir abertura" reinicia a animação do início. "⏸ Pausar" pausa/retoma (equivalente a clicar na área da animação). "≡ Ler texto" exibe o texto parado, sem efeito de profundidade; "✕ Fechar texto" volta para a animação.' },
    { section: 'inicio', personas: ['visitante', 'logado', 'inscrito', 'admin'],
      title: 'Blocos "Como funciona" (Conteúdos / Repositório / Treinamento Jedi)',
      body: 'Três blocos decorativos (sem efeito ao passar o mouse) logo abaixo do topo da página, cada um navega direto para a página correspondente. Visível e funcional para todos.' },
    { section: 'inicio', personas: ['visitante', 'logado', 'inscrito', 'admin'],
      title: 'Link no rodapé para previ.com.br',
      body: 'Abre o site da Previ em nova aba (link externo). Visível para todos. Presente no rodapé de todas as páginas, não só Início.' },
    { section: 'inicio', personas: ['visitante', 'logado', 'inscrito', 'admin'],
      title: 'Botão principal do topo — comportamento por login',
      body: 'Visitante: botão "Juntar-se à Força →" que abre o modal de cadastro. Logado/inscrito/admin: botão "Ver turmas →" que navega para a página Turmas. O botão nunca fica oculto — só muda texto e ação conforme o estado de login.' },

    /* ── TURMAS ── (ordem alinhada ao fluxo real da página e ao mapa.js) */
    { section: 'turmas', personas: ['visitante', 'logado', 'admin'],
      title: 'Acesso geral (visitante e logado sem turma)',
      body: 'Cards: vê os 3 cards de turma completos, cada um com nome, mês, datas e botão de interesse — visitante (sem turma) e logado (sem turma confirmada). Abaixo dos cards (igual para todos os perfis): bloco "Como funciona a oficina" + Agenda D1–D5.' },
    { section: 'turmas', personas: ['inscrito', 'admin'],
      title: 'Acesso para inscrito (turma confirmada)',
      body: 'Cards: vê só o card da própria turma confirmada — nome, mês/período com label CONFIRMADA, dias, sem botões "Tenho interesse"/"Remover interesse"; as demais turmas ficam ocultas. Abaixo do card (igual para todos os perfis): bloco "Como funciona a oficina" + Agenda D1–D5. Estar inscrito e a turma estar finalizada são a mesma coisa — só existe status inscrito depois que o admin finaliza a turma (não há "turma finalizada para inscrito" separado desta regra).' },
    { section: 'turmas', personas: ['visitante', 'logado', 'inscrito', 'admin'],
      title: 'Bloco "Como funciona a oficina"',
      body: 'Exibido antes da agenda D1–D5 para todos. Mostra 4 métricas (5 dias, 4h por encontro, dinâmicas práticas, participação opcional) e uma descrição geral.' },
    { section: 'turmas', personas: ['visitante', 'logado', 'inscrito', 'admin'],
      title: 'Agenda D1–D5 — itens estáticos',
      body: 'Os 5 dias da agenda são itens estáticos — nenhum perfil pode expandir. Mostram apenas os títulos dos dias, sem conteúdo interno.' },
    { section: 'turmas', personas: ['visitante'],
      title: 'Botão "Tenho interesse" sem login',
      body: 'Ao clicar, exibe mensagem "Faça login para registrar seu interesse." embaixo do botão e abre o modal de login.' },
    { section: 'turmas', personas: ['visitante'],
      title: 'Login não retoma o registro de interesse automaticamente',
      body: 'Se um visitante (deslogado) clica em "Tenho interesse", o site abre a tela de login em vez de registrar o interesse na hora. Depois que a pessoa termina o login, o interesse NÃO é registrado sozinho — o botão só volta ao normal ("Tenho interesse"), e ela precisa clicar de novo para registrar.' },
    { section: 'turmas', personas: ['logado', 'admin'],
      title: 'Registrar interesse → botão vira "Remover interesse"',
      body: 'Disponível para usuário logado sem turma confirmada. Ao clicar em "♡ Tenho interesse" (estilo primário, dourado sólido), o botão vira "♡ Remover interesse" (estilo secundário, fundo escuro) e exibe a mensagem "Sua intenção foi registrada! Usaremos para dimensionar as turmas." embaixo do botão. É possível manifestar interesse em até 3 turmas ao mesmo tempo.' },
    { section: 'turmas', personas: ['logado', 'admin'],
      title: 'Remover interesse → botão volta a "Tenho interesse"',
      body: 'Ao clicar em "♡ Remover interesse", o botão volta ao estado inicial "♡ Tenho interesse" e exibe a mensagem "Interesse removido." embaixo do botão.' },
    { section: 'turmas', personas: ['visitante', 'logado', 'admin'],
      title: 'Turma finalizada para não inscrito — "Inscrições encerradas"',
      body: 'Quando uma turma está finalizada e o usuário NÃO está confirmado nela: o botão de interesse desaparece e o card exibe "Inscrições encerradas" (estado bloqueado, sem ação disponível). Não abre modal de login ao clicar. Válido para visitante, usuário logado ou admin que não está inscrito nessa turma. (Para quem JÁ está confirmado nessa turma, ver a regra "Acesso para inscrito" acima — turma finalizada é justamente o que confirma a inscrição.)' },

    /* ── Cenários de exceção (corridas, falhas e correções de bug) ── */
    { section: 'turmas', personas: ['logado', 'admin'],
      title: 'Corrida: turma finaliza entre carregar a página e clicar em "Tenho interesse"',
      body: 'Se o admin finalizar a turma no intervalo entre o carregamento do card e o clique no botão, o registro é recusado e exibe "Esta turma está encerrada para novas inscrições." (mensagem diferente da do card já bloqueado no carregamento).' },
    { section: 'turmas', personas: ['logado', 'admin'],
      title: 'Corrida rara: turma finaliza com a página já aberta',
      body: 'Se o admin finalizar a turma enquanto o usuário já está com a página Turmas aberta (sem recarregar), o botão passa a exibir "✓ Inscrita" (desabilitado) — um estado transitório. Só na próxima visita/recarregamento é que a página passa a mostrar o card estático de inscrito (grade substituída, sem botões).' },
    { section: 'turmas', personas: ['logado', 'admin'],
      title: 'Falha ao gravar no Firebase',
      body: 'Se a escrita em turmas-interesse falhar, exibe "Erro ao registrar. Tente novamente." (ao registrar interesse) ou "Erro ao remover. Tente novamente." (ao remover interesse) — o botão mantém o estado anterior.' },
    { section: 'turmas', personas: ['visitante', 'logado', 'admin'],
      title: 'Se a verificação inicial falhar, a pessoa não vê nenhum aviso',
      body: 'Ao abrir a página, o site checa se a pessoa já demonstrou interesse e se a turma já encerrou. Se a internet estiver instável ou lenta e essa checagem falhar, o card pode ficar desatualizado: continua mostrando "Tenho interesse" mesmo para quem já registrou, ou não avisa que a turma encerrou — e nenhum aviso de erro aparece na tela.' },
    { section: 'turmas', personas: ['visitante', 'logado', 'admin'],
      title: 'Botão "Tenho interesse"/"Remover interesse" não duplica ações ao sair e voltar da página',
      body: 'Sair da página Turmas e voltar (ou fazer login/logout nela) não afeta o botão "Tenho interesse"/"Remover interesse" — ele continua respondendo normalmente a um clique de cada vez, mesmo depois de várias idas e vindas.' },
    { section: 'turmas', personas: ['logado', 'admin'],
      title: 'Botão "Tenho interesse"/"Remover interesse" fica desabilitado durante a gravação no Firebase',
      body: 'Ao clicar em "Tenho interesse" ou "Remover interesse", o botão fica desabilitado até a resposta do Firebase chegar (sucesso ou erro) — um clique duplo rápido não dispara duas gravações.' },

    /* ── CHECK-IN ── (mesma ordem do mapa.js, bloco contíguo — antes eram intercaladas com Turmas) */
    { section: 'checkin', personas: ['inscrito'],
      title: 'Como funciona e quem acessa',
      body: 'O check-in é feito escaneando com o celular um QR Code que o admin mostra presencialmente no dia do evento — não existe link para essa página em nenhum lugar do site. O QR aponta para essa página específica (#checkin?turma=t1, por exemplo). Só funciona de verdade para quem está logado com a conta cadastrada como inscrita naquela turma exata — qualquer outra pessoa que abrir o link (mesmo por engano) esbarra em algum dos avisos de bloqueio abaixo, sem conseguir registrar presença. Não altera o card da pessoa na página Turmas (que continua estático). Se a turma na URL não existir, exibe "QR Code inválido ou turma não encontrada".' },
    { section: 'checkin', personas: ['inscrito'],
      title: 'Sem login',
      body: 'Exibe "Faça login para registrar sua presença" com botão "Entrar". Após autenticar, o check-in é completado automaticamente sem precisar escanear de novo.' },
    { section: 'checkin', personas: ['inscrito'],
      title: 'Turma ainda não finalizada',
      body: 'Se o admin ainda não clicou em "Finalizar inscrição" para essa turma, exibe "Esta turma ainda não teve as inscrições finalizadas."' },
    { section: 'checkin', personas: ['inscrito'],
      title: 'Check-in do dia não aberto',
      body: 'Se o admin ainda não abriu o check-in do dia, exibe "O check-in não está aberto no momento. Aguarde a organização abrir o check-in do dia."' },
    { section: 'checkin', personas: ['inscrito'],
      title: 'Pessoa não inscrita nessa turma',
      body: 'Se o e-mail logado não tem registro com status inscrito (ou foi removido) na turma da URL, exibe "Você não está inscrita nesta turma."' },
    { section: 'checkin', personas: ['inscrito'],
      title: 'Já fez check-in no dia',
      body: 'Se a pessoa já registrou presença nesse dia, exibe "Presença já registrada" com nome da turma e a data do dia aberto.' },
    { section: 'checkin', personas: ['inscrito'],
      title: 'Sucesso',
      body: 'Quando turma finalizada, check-in do dia aberto, pessoa inscrita e sem check-in prévio nesse dia: registra a presença e exibe "Presença confirmada com sucesso!" com nome, turma e dia.' },

    /* ── CONTEÚDOS ── */
    { section: 'conteudos', personas: ['inscrito', 'admin'],
      title: 'Acesso',
      body: 'Página Conteúdos acessível apenas para usuário inscrito (turma confirmada) e admin. Visitante e logado sem turma não acessam esta página. As 7 seções numeradas (01 Mapa da Galáxia, 02 Os 4 Valores, 03 Os 12 Princípios, 04 A Força do Ágil, 05 Personagens, 06 Lado Sombrio, 07 A Trilogia) — cada uma ocupa a tela inteira, uma por vez.' },
    { section: 'conteudos', personas: ['inscrito', 'admin'],
      title: 'Navegação lateral por pontos',
      body: 'Barra lateral com 7 pontos (01–07), setas para cima/baixo e tooltip com o nome da seção. Ao clicar em um ponto, a página rola suavemente até a seção correspondente.' },
    { section: 'conteudos', personas: ['inscrito', 'admin'],
      title: 'Links externos "Ler na íntegra"',
      body: 'Nas seções dos 4 valores e dos 12 princípios, links abrem o Manifesto Ágil oficial (agilemanifesto.org) em nova aba.' },

    /* ── REPOSITÓRIO ── */
    { section: 'repositorio', personas: ['visitante'],
      title: 'Acesso — visitante',
      body: 'Visitante não acessa o Repositório — a página exige login.' },
    { section: 'repositorio', personas: ['logado', 'inscrito', 'admin'],
      title: 'Acesso — logado e inscrito',
      body: 'Usuário logado (com ou sem turma confirmada) e admin veem todos os conteúdos (curados e de usuários).' },
    { section: 'repositorio', personas: ['logado', 'inscrito', 'admin'],
      title: 'Adicionar conteúdo',
      body: 'Pode adicionar quantos conteúdos quiser ao Holocron.' },
    { section: 'repositorio', personas: ['logado', 'inscrito', 'admin'],
      title: 'Remover conteúdo próprio',
      body: 'O autor pode remover seus próprios conteúdos enviados. Não pode remover conteúdos curados.' },
    { section: 'repositorio', personas: ['admin'],
      title: 'Moderação (Admin)',
      body: 'Pode remover qualquer conteúdo enviado por usuários. Pode ocultar ou restaurar conteúdos curados.' },
    { section: 'repositorio', personas: ['logado', 'inscrito', 'admin'],
      title: 'Identificação dos conteúdos',
      body: 'Curados: marcados com badge "curado", sem autor. Enviados por usuários: exibem nome do autor e data de envio.' },
    { section: 'repositorio', personas: ['logado', 'inscrito', 'admin'],
      title: 'Descrição dos cards — ver mais / ver menos',
      body: 'Todos os cards exibem a descrição cortada em 2 linhas por padrão. O botão "ver mais" só aparece quando o texto realmente não cabe nessas 2 linhas. Clicar em "ver mais" expande o texto completo; "ver menos" recolhe para 2 linhas de novo.' },
    { section: 'repositorio', personas: ['logado', 'inscrito', 'admin'],
      title: 'Filtrar por tipo',
      body: 'Chips "Todos / Vídeos / Documentos / Ferramentas / Livros" filtram a lista exibida.' },

    { section: 'repositorio', personas: ['logado', 'inscrito', 'admin'],
      title: 'Formulário "Adicionar Conteúdo" — campos',
      body: 'Campos: Título (obrigatório) · Tipo (Vídeo, Documento, Ferramenta, Livro) · Link/URL (obrigatório) · Descrição (opcional). Título e URL são obrigatórios — sem eles o formulário não envia.' },
    { section: 'repositorio', personas: ['logado', 'inscrito', 'admin'],
      title: 'Formulário "Adicionar Conteúdo" — URL',
      body: 'Se a URL não começar com http:// ou https://, o sistema adiciona "https://" automaticamente.' },
    { section: 'repositorio', personas: ['logado', 'inscrito', 'admin'],
      title: 'Formulário "Adicionar Conteúdo" — conteúdo duplicado',
      body: 'Antes de salvar, o sistema verifica se a URL já existe no Holocron. Se já foi adicionada, exibe "Este conteúdo já foi adicionado ao Holocron." e bloqueia o envio.' },
    { section: 'repositorio', personas: ['logado', 'inscrito', 'admin'],
      title: 'Formulário "Adicionar Conteúdo" — cancelar',
      body: 'Botão "Cancelar" fecha o formulário e limpa todos os campos.' },

    /* ── Treinamento Jedi (v3 — apenas quiz) ── */
    { section: 'quiz', personas: ['visitante', 'logado'],
      title: 'Acesso restrito — apenas inscrito com turma confirmada',
      body: 'O Treinamento Jedi só é acessível para usuário inscrito (turma confirmada) e admin. Visitante e logado sem turma confirmada não acessam esta página.' },
    { section: 'quiz', personas: ['inscrito', 'admin'],
      title: 'Acesso completo',
      body: 'Acesso ao autodiagnóstico, painel de patente e revelar patente.' },
    { section: 'quiz', personas: ['inscrito', 'admin'],
      title: 'Autodiagnóstico',
      body: 'Pode fazer uma vez apenas — não pode refazer. A soma de todas as respostas vai de 0 a 60 pontos. Após concluir, as opções ficam desabilitadas. Única exceção para refazer: admin resetar o progresso.' },
    { section: 'quiz', personas: ['inscrito', 'admin'],
      title: 'Painel de patente',
      body: 'Visível em tempo real no Treinamento Jedi. Enquanto o autodiagnóstico não estiver concluído: exibe patente provisória. Após revelar: mostra a patente definitiva. 4 patentes possíveis (Youngling → Padawan → Cavaleiro Jedi → Mestre Jedi) com base na pontuação do autodiagnóstico.' },
    { section: 'quiz', personas: ['inscrito', 'admin'],
      title: 'Revelar patente — pré-requisito',
      body: 'Exige completar o autodiagnóstico. O botão "Revelar minha Patente →" só aparece ao concluir as 20 afirmações.' },
    { section: 'quiz', personas: ['inscrito', 'admin'],
      title: 'Revelar patente — bloqueado enquanto autodiagnóstico pendente',
      body: 'Enquanto bloqueado, o aviso mostra "autodiagnóstico pendente". Ao concluir o autodiagnóstico, o botão atualiza sozinho, sem precisar recarregar a página.' },
    { section: 'quiz', personas: ['inscrito', 'admin'],
      title: 'Revelar patente — o que acontece',
      body: 'Ao clicar em "Revelar minha Patente Final" (com o autodiagnóstico concluído), abre pop-up com ilustração, nome do rank alcançado e pontuação total. O resultado é definitivo e não pode ser alterado.' },
    { section: 'quiz', personas: ['admin'],
      title: 'Reset de progresso (Admin)',
      body: 'Admin pode resetar o progresso de qualquer cadastrado. Apaga: autodiagnóstico, patente. Ação irreversível. Após o reset, a pessoa pode refazer o autodiagnóstico e revelar a patente novamente — essa é a única forma de refazer.' },

    /* ── AJUDA ── */
    { section: 'ajuda', personas: ['visitante', 'logado', 'inscrito', 'admin'],
      title: 'Acesso',
      body: 'Página Ajuda visível para todos, inclusive visitantes. Sem restrição de acesso. No menu o link aparece como "Ajuda".' },
    { section: 'ajuda', personas: ['visitante', 'logado', 'inscrito', 'admin'],
      title: 'Acordeão de perguntas',
      body: 'A página tem perguntas frequentes exibidas em formato de acordeão: clicar no título expande ou recolhe a resposta, e cada pergunta abre de forma independente das outras. O texto acima do título é "Central de Ajuda" e o título principal é "Como podemos ajudar?".' },

    /* ── ADMIN ── */
    { section: 'admin', personas: ['visitante', 'logado', 'inscrito'],
      title: 'Acesso negado',
      body: 'Visitante, usuário logado e inscrito não veem o link "Admin" no menu. Se acessarem a URL diretamente, veem mensagem de acesso restrito e botão para voltar ao início.' },
    { section: 'admin', personas: ['admin'],
      title: 'Navegação por abas — desktop e mobile',
      body: '7 abas no painel: Turmas, Repositório, Cadastrados, Administradores, Manual, Mapa e Testes. No desktop ficam em linha única. No mobile podem quebrar em 2 linhas com fonte reduzida para todas ficarem visíveis sem scroll horizontal.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Turmas — visão geral',
      body: 'Cada turma aparece como um card, com um selo ABERTA ou FINALIZADA e a contagem de inscritos/interessados. Quando o check-in do dia está ativo, aparece também um selo piscando "CHECK-IN ABERTO · DD/MM". Dentro de cada card: botões de ação, uma tabela de participantes e um botão "↓ CSV" para baixar só aquela turma — se a tabela tiver muitas colunas, ela ganha rolagem horizontal. No topo da aba, dois botões exportam todas as turmas de uma vez: "↓ Estado atual" e "↓ Histórico". Os arquivos sempre abrem editáveis no Excel, com os acentos corretos.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Turmas — exportar CSV Estado Atual',
      body: 'Botão global "↓ Estado atual": exporta todas as turmas em um único arquivo CSV. Inclui apenas usuários ativos — removidos não aparecem. Coluna "Adicionado por" preenchida com nome do admin quando o participante foi adicionado manualmente; vazia quando o participante se inscreveu por conta própria.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Turmas — exportar CSV Histórico',
      body: 'Botão global "↓ Histórico": exporta o log completo de ações em turmas-interesse-log — inclui ativos, removidos e todo histórico de adição/remoção. Coluna "Executado por" preenchida com nome do admin quando a ação foi executada por um admin; vazia quando o participante realizou a ação por conta própria.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Turmas — exportar CSV individual por turma',
      body: 'Botão "↓ CSV" em cada card de turma: exporta apenas os participantes ativos daquela turma. Para turmas finalizadas inclui colunas de presença por dia, frequência e critério atingido. Inclui coluna "Adicionado por" quando aplicável.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Turmas — finalizar inscrição',
      body: 'Botão "Finalizar inscrição" (turma ABERTA): confirma todos os interessados como inscritos e bloqueia novas inscrições na página de Turmas. Após finalizar, aparecem os botões QR Code, Abrir check-in e Reabrir turma.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Turmas — check-in do dia',
      body: 'Uma lista com os dias da turma (já vem com hoje marcado, se for um dia válido) + botão "Abrir check-in": escolhe qual dia fica liberado para registrar presença. O admin pode abrir qualquer dia — passado ou futuro — sem precisar estar no dia exato. Participantes só conseguem escanear o QR Code e registrar presença enquanto um dia estiver aberto. Quando aberto, aparece "Check-in aberto: DD/MM" + botão "Fechar check-in". Cada pessoa só pode registrar presença uma vez por dia.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Turmas — QR Code',
      body: 'Botão "⌘ QR Code" (disponível após finalizar): gera de verdade um QR Code, que aponta para a página de check-in daquela turma. É o mesmo QR todos os dias — não precisa gerar um novo, porque quem decide se o check-in vale naquele momento é o botão "Abrir/Fechar check-in", não o QR em si. A URL também aparece em texto abaixo do QR, caso prefira copiar em vez de escanear.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Turmas — layout responsivo das ações',
      body: 'Desktop: todas as ações ficam em linha única — seletor de dia + botão "Abrir check-in" (ou "Fechar check-in") sempre visíveis; QR Code, + Participante, Reabrir, CSV e Certificados também na mesma linha. Celular/tablet: o cabeçalho do card vira coluna; só as ações principais ficam visíveis (seletor de dia + Abrir/Fechar check-in para turma finalizada, ou "Finalizar inscrição" para turma aberta); o botão "⋯" abre um menu com as ações secundárias (QR Code, + Participante, ↺ Reabrir, CSV, Certificados).' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Turmas — tabela de presença',
      body: 'Turma finalizada exibe tabela com colunas por dia (ex: 11/08, 12/08…). Cada célula mostra: "✓ qr" (check-in via QR, verde), "✓ adm" (registrado pelo admin, ciano) ou botão "—" clicável. Clicar em "—" registra presença retroativa a qualquer hora, sem restrição de data. Última coluna mostra frequência X/5 em verde (atingiu o critério) ou vermelho (não atingiu). Critério padrão: 75% de presença (4 de 5 dias).' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Turmas — desfazer check-in',
      body: 'As etiquetas "✓ adm" e "✓ qr" nas células da tabela de presença são botões clicáveis. Passar o mouse mostra um risco no texto, sinalizando remoção. Clicar abre um modal de confirmação. Ao confirmar, remove aquele registro de presença e recarrega a tabela com a frequência atualizada. Funciona tanto para presenças registradas pelo admin quanto por QR Code.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Turmas — adicionar participante após finalizar',
      body: 'Botão "＋ Participante" (disponível apenas com turma finalizada): abre um modal com campos Nome, E-mail e Área (mesma lista de 20 áreas do cadastro). Valida e-mail @previ.com.br antes de salvar, e registra o nome do admin que adicionou a pessoa — sem precisar reabrir a turma. Se o e-mail já estiver na turma, exibe aviso no modal. A tabela de presença atualiza automaticamente.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Turmas — remover inscrito da turma finalizada',
      body: 'Botão "Remover" (coluna extra na tabela de presença): abre um modal de confirmação. Ao confirmar, registra quem e quando removeu, e a pessoa some da tela imediatamente. Diferente de "faltou a um dia" — é uma remoção da turma, não uma ausência. Os check-ins registrados não são apagados, mas a pessoa deixa de constar como inscrita.' },
    { section: 'admin', personas: ['admin'],
      title: 'Pop-ups do admin — modais visuais (não nativos)',
      body: 'Todas as confirmações e avisos do painel usam janelas com o mesmo visual dos modais de cadastro/login — nenhuma ação usa aquelas caixas de diálogo feias e padrão do navegador.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Turmas — certificados de participação',
      body: 'Botão "📜 Certificados" (disponível apenas com turma finalizada): filtra automaticamente quem atingiu ≥ 75% de presença e abre nova aba com todos os certificados empilhados (1 por página, A4 paisagem). O navegador abre o diálogo de impressão — admin salva como PDF. Cada certificado contém: nome do participante, nome da turma, período (primeiro ao último dia), frequência atingida e assinatura da Coordenação Força Ágil. Se ninguém atingiu 75%, exibe aviso.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Turmas — reabrir turma',
      body: 'Botão "↺ Reabrir turma": reverte a finalização — volta inscritos para interessados, fecha o check-in do dia se estiver aberto, e permite novas inscrições. Não apaga registros de check-in já feitos.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Repositório — conteúdos curados',
      body: 'Botão "Ocultar" → some do repositório público. Botão "Restaurar" → volta a aparecer.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Repositório — conteúdos de usuários',
      body: 'Botão "Deletar" → remove permanentemente do Holocron.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Cadastrados — listar',
      body: 'Lista todas as pessoas que já se cadastraram. Mostra nome, e-mail, área e data de cadastro.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Cadastrados — resetar progresso',
      body: 'Disponível para qualquer pessoa cadastrada. Ação irreversível — pede confirmação antes de executar. Após o reset: se a pessoa estiver logada, a página dela recarrega automaticamente — o autodiagnóstico fica disponível para refazer sem nenhuma ação da pessoa.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Cadastrados — redefinir senha',
      body: 'Disponível para qualquer pessoa cadastrada, disponível para todos. Dispara o e-mail de redefinição de senha do Firebase.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Administradores — super-admins fixos',
      body: 'tatianefdirene@previ.com.br e danielfrazao@previ.com.br são super-admins fixos — não removíveis via painel.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Administradores — admins adicionais',
      body: 'Podem ser adicionados e removidos via painel. Formulário exige nome completo e e-mail @previ.com.br. Apenas tatianefdirene@previ.com.br e danielfrazao@previ.com.br podem adicionar ou remover admins — restrição garantida no banco de dados, não só na tela. Qualquer pessoa na lista vê a aba Admin mas não gerencia a lista. A lista de admins não é visível para usuários comuns.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Manual',
      body: 'Checklist de regras de comportamento do sistema, organizado por seção e por persona. Documentação viva — deve ser atualizada junto de qualquer mudança de comportamento.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Mapa',
      body: 'Mostra quatro seções: (1) Hierarquia de Personas — níveis de acesso cumulativos; (2) Mapa do Site — páginas e features com nível mínimo por persona; (3) Arquitetura Técnica e Regras Operacionais — acordeão com tecnologias, módulos, padrões de código, padrões de UX, deploy e regras de governança; (4) Diagrama da Arquitetura — visão visual gerada automaticamente a partir dos dados da Arquitetura Técnica.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Mapa — estrutura dos dados em mapa.js',
      body: 'A aba Mapa é organizada em dois grupos de conteúdo: um descreve o que o sistema é — Linguagens, Tecnologias & Serviços, Estrutura de Arquivos, Padrões de Código, Padrões de UX, Glossário de UX/Design e Deploy — exibido como "Arquitetura Técnica" e usado no Diagrama. O outro descreve como o sistema deve ser mantido — Deploy (processo), Cache e Autonomia — exibido como "Regras Operacionais".' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Testes',
      body: 'Roda os testes automatizados (técnicos e de comportamento) e exibe o checklist de regras que exigem validação manual.' },
    { section: 'auth', personas: ['visitante', 'logado', 'inscrito', 'admin'],
      title: 'Menu mobile (≤ 600px) — hamburguer sempre visível',
      body: 'Em telas pequenas (celular): logo exibido em versão compacta, botões do menu reduzidos, ícone hamburguer sempre visível e sem sobreposição com outros elementos do cabeçalho.' },
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

    /* Single toolbar line: dropdowns left | count + actions right */
    html += '<div class="manual-toolbar">';

    html += '<div class="manual-toolbar-left">';
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

    html += '<div class="manual-toolbar-right">';
    html += '<span class="manual-count">' + filtered.length + ' regra' + (filtered.length !== 1 ? 's' : '') + ' encontrada' + (filtered.length !== 1 ? 's' : '') + '</span>';
    html += '<button class="btn btn--sm" id="manualExportBtn">⬇ Exportar Regras</button>';
    html += '<button class="btn btn--sm btn--ghost" id="manualExpandAll">Expandir tudo</button>';
    html += '<button class="btn btn--sm btn--ghost" id="manualCollapseAll">Recolher tudo</button>';
    html += '</div>';

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

    /* Expandir / Recolher all details in manual */
    var expandAllBtn = document.getElementById('manualExpandAll');
    if (expandAllBtn) {
      expandAllBtn.addEventListener('click', function () {
        container.querySelectorAll('details').forEach(function (d) { d.open = true; });
      });
    }
    var collapseAllBtn = document.getElementById('manualCollapseAll');
    if (collapseAllBtn) {
      collapseAllBtn.addEventListener('click', function () {
        container.querySelectorAll('details').forEach(function (d) { d.open = false; });
      });
    }

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
