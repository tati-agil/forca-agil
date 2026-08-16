/* Força Ágil — Manual Interativo */
(function () {
  'use strict';

  let activeSection = 'all';
  let activePersona = 'all';

  /* Ordem alfabética por label (exceto "Tudo", que fica sempre primeiro) */
  const SECTIONS = [
    { key: 'all',         label: 'Tudo',               color: 'var(--ink-2)' },
    { key: 'admin',       label: 'Admin',               color: '#6b7a99' },
    { key: 'ajuda',       label: 'Ajuda',               color: '#7ecbff' },
    { key: 'avaliacao',   label: 'Avaliação',           color: '#a78bfa' },
    { key: 'cadastrar',   label: 'Cadastrar',           color: '#9b7fff' },
    { key: 'checkin',     label: 'Check-in',            color: '#42a5f5' },
    { key: 'conteudos',   label: 'Conteúdos',           color: '#4caf7d' },
    { key: 'entrar',      label: 'Entrar',              color: '#c084fc' },
    { key: 'inicio',      label: 'Início',              color: '#1ab2ae' },
    { key: 'menu',        label: 'Menu / Sessão',       color: '#7f9bff' },
    { key: 'repositorio', label: 'Repositório',          color: '#e8854a' },
    { key: 'quiz',        label: 'Treinamento Jedi',      color: '#e05c7f' },
    { key: 'turmas',      label: 'Turmas',              color: '#f5c542' },
  ];

  const PERSONAS = [
    { key: 'all',         label: 'Todas as personas',  color: 'var(--ink-2)' },
    { key: 'visitante',   label: 'Visitante',          color: '#888' },
    { key: 'logado',      label: 'Usuário logado (sem turma)', color: '#1ab2ae' },
    { key: 'inscrito',    label: 'Inscrito (turma confirmada)', color: '#4caf7d' },
    { key: 'admin',       label: 'Admin',              color: '#6b7a99' },
  ];

  const RULES = [
    /* ── CADASTRAR / ENTRAR ── */
    { section: 'menu', personas: ['visitante'],
      title: 'Quem vê ENTRAR e CADASTRAR no menu',
      body: 'Somente visitantes (não logados) veem os botões ENTRAR e CADASTRAR no canto superior direito do menu.' },
    { section: 'menu', personas: ['logado', 'inscrito', 'admin'],
      title: 'Menu para usuário logado',
      body: 'Os botões ENTRAR e CADASTRAR somem. No lugar aparece o perfil com a inicial e o primeiro nome do usuário. O header exibe avatar, nome e botão Sair.' },
    { section: 'menu', personas: ['admin'],
      title: 'Link Admin no menu',
      body: 'O link "Admin" no menu só aparece para administradores e some imediatamente após o logout — inclusive no mobile com o menu aberto.' },
    { section: 'menu', personas: ['visitante', 'logado', 'inscrito', 'admin'],
      title: 'Três perfis de acesso',
      body: 'O sistema detecta automaticamente o perfil da pessoa: visitante não logado (vê apenas o modal de login — site completamente oculto antes da autenticação); logado sem turma confirmada (vê Início, Turmas, Repositório, Ajuda; pode manifestar interesse em turmas); logado com turma confirmada (vê + Conteúdos e Treinamento Jedi, sem botões de interesse em turmas). Admin vê tudo.' },
    { section: 'entrar', personas: ['visitante', 'logado', 'inscrito', 'admin'],
      title: 'Modal não fecha ao clicar fora',
      body: 'Evita perda do formulário preenchido. Fecha com o botão ✕ ou com ESC — mas só se todos os campos estiverem vazios.' },
    { section: 'entrar', personas: ['visitante'],
      title: 'Botão olhinho no campo de senha',
      body: 'Disponível no campo de senha do login. Alterna entre ocultar (👁) e mostrar (🙈) o texto digitado.' },
    { section: 'cadastrar', personas: ['visitante'],
      title: 'Botão olhinho nos campos de senha',
      body: 'Disponível nos dois campos de senha do cadastro (senha e confirmar senha). Alterna entre ocultar (👁) e mostrar (🙈) o texto digitado.' },
    { section: 'entrar', personas: ['visitante'],
      title: 'Login — e-mail obrigatório @previ.com.br',
      body: 'Qualquer domínio diferente de @previ.com.br é rejeitado imediatamente, antes mesmo de consultar o banco.' },
    { section: 'entrar', personas: ['visitante', 'logado', 'inscrito', 'admin'],
      title: 'Segurança — cinco camadas de proteção',
      body: '1. Site oculto: o body inteiro fica invisível até o Firebase confirmar autenticação — visitante vê só o modal de login, sem nada por baixo.\n2. Verificação de e-mail: auto-cadastro exige clicar no link de confirmação enviado ao @previ.com.br — garante que o e-mail existe. Admin pode criar conta diretamente (sem verificação), pois já sabe que o e-mail é real.\n3. Bloqueio pelo admin: se o cadastro estiver marcado como bloqueado, o sistema desloga a pessoa na hora e exibe "Acesso desativado". Admin pode bloquear/desbloquear na aba Cadastrados.\n4. Regras do banco (servidor): todos os nós do Firebase exigem autenticação com @previ.com.br para leitura e escrita — não existe nenhum nó público. Mesmo acesso direto ao banco sem autenticação é recusado pelo servidor.\n5. Nível enrolled: acesso a Conteúdos e Treinamento Jedi exige confirmação explícita pelo admin (campo confirmedByAdmin no banco) — manifestar interesse não basta.' },
    { section: 'entrar', personas: ['visitante'],
      title: 'Login — erro de credenciais',
      body: 'Mensagem genérica: "E-mail ou senha inválidos." — não informa qual dos dois está errado (segurança).' },
    { section: 'entrar', personas: ['visitante'],
      title: 'Login — botão durante autenticação',
      body: 'O botão vira "Aguarde…" e fica desabilitado enquanto a autenticação ocorre.' },
    { section: 'entrar', personas: ['visitante'],
      title: 'Login — e-mail não verificado',
      body: 'Se a pessoa se cadastrou sozinha mas ainda não clicou no link de verificação e tenta fazer login: a senha é aceita, mas o site não abre. O modal exibe automaticamente o painel "Confirme seu e-mail", com o endereço @previ.com.br de destino e o botão "Reenviar e-mail". O acesso só é liberado após clicar no link na caixa de entrada. "Voltar para o login" desloga e retorna à tela de login.' },
    { section: 'entrar', personas: ['visitante'],
      title: 'Login — esqueci minha senha',
      body: 'Abre painel inline no modal. Usuário digita o e-mail @previ.com.br e o sistema exibe "Se este e-mail estiver cadastrado, você receberá o link de redefinição em breve." O Firebase envia o link apenas se o e-mail existir — por segurança, não revela se está cadastrado ou não. Se não for @previ.com.br, exibe "Use seu e-mail @previ.com.br." Autoatendimento — não depende do admin.' },
    { section: 'cadastrar', personas: ['visitante'],
      title: 'Cadastro — e-mail obrigatório @previ.com.br',
      body: 'Exige e-mail @previ.com.br. Outros domínios são rejeitados já na tela — e o banco de dados também recusa, mesmo que alguém tente criar a conta driblando a tela e escrevendo direto no banco.' },
    { section: 'cadastrar', personas: ['visitante'],
      title: 'Cadastro — senha',
      body: 'Apenas números, mínimo 8 dígitos. O teclado numérico abre automaticamente em celular. O campo "Confirmar senha" deve ser idêntico — se divergir, exibe "As senhas não coincidem." Se contiver letras ou símbolos, exibe "Senha deve conter apenas números e ter mínimo 8 dígitos."' },
    { section: 'cadastrar', personas: ['visitante'],
      title: 'Cadastro — área/setor',
      body: 'Dropdown customizado com campo de busca por digitação no topo. Ao abrir, o foco vai direto para o campo de busca — a pessoa digita parte do nome da gerência e a lista filtra em tempo real. As 20 opções em ordem alfabética: ASJUR, AUDIT, CONIN, GABIN, GEBEN, GECAP, GECAT, GECON, GEINT, GEPAR, GEPRO, GERAI, GERAT, GEROP, GESOP, GETHO, INFOR, OUVIR, PNSEG, SECEX.' },
    { section: 'cadastrar', personas: ['visitante'],
      title: 'Cadastro — checkbox de termos (obrigatório)',
      body: 'O usuário deve aceitar os termos de uso antes de concluir o cadastro. Sem marcar, bloqueia com "Aceite os termos para continuar."' },
    { section: 'cadastrar', personas: ['visitante'],
      title: 'Cadastro — checkbox de opt-in (opcional)',
      body: 'Permite receber novidades sobre turmas e conteúdos. Não é obrigatório.' },
    { section: 'cadastrar', personas: ['visitante'],
      title: 'Cadastro — e-mail já existente',
      body: 'Se o e-mail já estiver cadastrado, exibe: "E-mail já cadastrado. Faça login."' },
    { section: 'cadastrar', personas: ['visitante'],
      title: 'Cadastro — formatação automática',
      body: 'Nome salvo em MAIÚSCULO. E-mail salvo em minúsculo.' },
    { section: 'cadastrar', personas: ['visitante'],
      title: 'Cadastro — botão durante envio',
      body: 'O botão vira "Aguarde…" durante o cadastro. Ao concluir: exibe painel de verificação de e-mail pedindo para acessar a caixa de entrada @previ.com.br e clicar no link. Após verificar, a pessoa faz login normalmente.' },
    { section: 'cadastrar', personas: ['visitante'],
      title: 'Cadastro — verificação de e-mail obrigatória',
      body: 'Após cadastro próprio, a pessoa recebe e-mail de verificação no @previ.com.br. Acesso ao portal é bloqueado até clicar no link. No painel de verificação há botão "Reenviar e-mail" caso não tenha recebido. Botão "Voltar para o login" desloga e volta à tela de login.' },
    { section: 'cadastrar', personas: ['admin'],
      title: 'Cadastro pelo admin — conta direta sem verificação de e-mail',
      body: 'Na aba Cadastrados do painel admin, o admin pode criar conta para uma colaboradora sem que ela precise verificar e-mail (o admin já sabe que o e-mail @previ.com.br existe). Campos: nome completo, e-mail, área/setor, senha do admin (confirmação). Senha criada: 12345678. A colaboradora deve trocar pelo "Esqueci minha senha" no primeiro acesso.' },
    { section: 'cadastrar', personas: ['admin'],
      title: 'Cadastrados — confirmar cadastro manualmente',
      body: 'Na aba Cadastrados, pessoas que se cadastraram pelo site e ainda não clicaram no link de verificação de e-mail aparecem com badge "Pendente" na coluna E-mail e botão "Confirmar cadastro". Ao confirmar: a flag adminApproved é setada em fa-users/ — mesmo efeito de clicar no link — e o acesso é liberado imediatamente. Útil quando há problema no recebimento do e-mail. Registra quem aprovou e quando (approvedByAdmin, approvedAt). Contas criadas diretamente pelo admin já nascem verificadas e não têm esse botão.' },
    { section: 'cadastrar', personas: ['admin'],
      title: 'Cadastrados — bloquear/desbloquear acesso',
      body: 'Cada linha da aba Cadastrados tem o botão "Bloquear". Ao bloquear: a pessoa é deslogada imediatamente na próxima verificação de sessão e vê a mensagem "Acesso desativado". O botão vira "Desbloquear" para reverter. O bloqueio não apaga a conta — apenas impede o acesso.' },
    { section: 'cadastrar', personas: ['admin'],
      title: 'Cadastrados — filtro por status',
      body: 'Três filtros no topo da aba Cadastrados: "Ativos" (padrão), "Bloqueados" e "Todos". Combinável com a busca por nome ou e-mail.' },
    { section: 'turmas', personas: ['logado', 'inscrito', 'admin'],
      title: 'Lista de espera — entrar',
      body: 'Na página Turmas, o 4º card "Lista de Espera" aparece sempre (mesmo com turmas abertas), para capturar intenções contínuas. Logada pode clicar "Entrar na lista de espera" — dado salvo em fa-espera/ no Firebase. Quem está na lista mantém acesso de Logada (sem turma), não de Inscrita.' },
    { section: 'turmas', personas: ['logado', 'inscrito', 'admin'],
      title: 'Lista de espera — sair',
      body: 'Quem está na lista pode sair clicando "Na lista — Sair" no mesmo card. O registro é marcado como removed:true (não apagado, mantém histórico).' },
    { section: 'turmas', personas: ['admin'],
      title: 'Lista de espera — mover para turma',
      body: 'Na aba Cadastrados do painel admin, a seção "Lista de Espera" mostra quem está aguardando. O admin escolhe a turma num select e clica "Mover para turma" — a pessoa é adicionada à turma como Inscrita (status=inscrito + confirmedByAdmin) e removida da lista de espera automaticamente. Essa ação dispara o mesmo fluxo de acesso que a confirmação manual.' },
    { section: 'turmas', personas: ['admin'],
      title: 'Lista de espera — remover sem mover',
      body: 'Na seção Lista de Espera do painel admin, o admin pode remover uma pessoa da lista sem movê-la para turma alguma (ex: pessoa que saiu da empresa ou desistiu).' },
    { section: 'turmas', personas: ['admin'],
      title: 'Lista de espera — migrar da turma',
      body: 'Na tabela de participantes de cada turma, cada linha (interessada ou inscrita) tem o botão "→ Espera". Ao clicar, o admin confirma e a pessoa é removida da turma e adicionada à lista de espera. A data preservada na lista de espera é a data original em que ela manifestou interesse na turma — não o momento da migração. Útil quando a turma está cheia e o admin precisa realocar pessoas para a próxima.' },
    { section: 'menu', personas: ['inscrito', 'admin'],
      title: 'Clicar no avatar/nome no menu',
      body: 'Clicar no avatar/nome exibido no menu (fora do botão Sair) navega para o Treinamento Jedi.' },
    { section: 'menu', personas: ['logado'],
      title: 'Clicar no avatar/nome no menu — sem turma confirmada',
      body: 'Clicar no avatar/nome tenta navegar para o Treinamento Jedi, mas a pessoa é redirecionada de volta para o Início com a mensagem "Disponível após confirmação em uma turma." — não chega a ver a página.' },
    { section: 'menu', personas: ['logado', 'inscrito', 'admin'],
      title: 'Sair',
      body: 'Botão "Sair" visível no menu de perfil. Encerra a sessão e redireciona para o INÍCIO.' },

    /* ── INÍCIO ── */
    { section: 'inicio', personas: ['logado', 'inscrito', 'admin'],
      title: 'Acesso geral',
      body: 'A página INÍCIO é visível apenas para usuários autenticados. Visitantes não logados veem apenas o modal de login — o site fica completamente oculto até a autenticação ser confirmada pelo Firebase.' },
    { section: 'inicio', personas: ['visitante', 'logado', 'inscrito', 'admin'],
      title: 'Botão final da página — "Ver turmas"',
      body: 'A página termina com um único botão "Ver turmas →" que navega para a página Turmas. Funciona igual para todos os perfis — o objetivo é direcionar para inscrição.' },
    { section: 'inicio', personas: ['visitante', 'logado', 'inscrito', 'admin'],
      title: 'Botão "Conhecer a iniciativa"',
      body: 'Rola a página para a seção "O que é a Força Ágil". Funciona igual para todos os perfis.' },
    { section: 'inicio', personas: ['inscrito', 'admin'],
      title: 'Crawl de abertura — animação',
      body: 'Texto introdutório em estilo Star Wars sobe lentamente ao entrar na Home. Visível apenas para inscrito (turma confirmada) e admin. Logado sem turma confirmada não vê a seção — ela é ocultada via display:none após autenticação.' },
    { section: 'inicio', personas: ['inscrito', 'admin'],
      title: 'Crawl — botão "⏸ Pausar"',
      body: 'Pausa/retoma a animação. Equivalente a clicar na área da animação. Fica lado a lado com os outros dois botões de controle, logo abaixo da animação.' },
    { section: 'inicio', personas: ['inscrito', 'admin'],
      title: 'Crawl — botão "≡ Ler texto"',
      body: 'Exibe o texto parado, sem efeito de profundidade. Botão "✕ Fechar texto" volta para a animação.' },
    { section: 'inicio', personas: ['inscrito', 'admin'],
      title: 'Crawl — botão "↻ Repetir abertura"',
      body: 'Reinicia a animação do início.' },
    { section: 'inicio', personas: ['visitante', 'logado', 'inscrito', 'admin'],
      title: 'Card "Como funciona" → Conteúdos',
      body: 'Bloco informativo (sem link, sem hover, sem cursor de seleção) logo abaixo do topo da página — não navega para lugar nenhum ao clicar.' },
    { section: 'inicio', personas: ['visitante', 'logado', 'inscrito', 'admin'],
      title: 'Card "Como funciona" → Repositório',
      body: 'Bloco informativo (sem link, sem hover, sem cursor de seleção) logo abaixo do topo da página — não navega para lugar nenhum ao clicar.' },
    { section: 'inicio', personas: ['visitante', 'logado', 'inscrito', 'admin'],
      title: 'Card "Como funciona" → Treinamento Jedi',
      body: 'Bloco informativo (sem link, sem hover, sem cursor de seleção) logo abaixo do topo da página — não navega para lugar nenhum ao clicar.' },
    { section: 'inicio', personas: ['visitante', 'logado', 'inscrito', 'admin'],
      title: 'Link no rodapé para previ.com.br',
      body: 'Abre o site da Previ em nova aba (link externo). Visível para todos. Presente no rodapé de todas as páginas, não só Início.' },
    { section: 'inicio', personas: ['visitante'],
      title: 'Botão do hero — "Juntar-se à Força" (visitante)',
      body: 'Abre o modal de cadastro. Some assim que a pessoa loga, dando lugar ao botão "Ver turmas".' },
    { section: 'inicio', personas: ['logado', 'inscrito', 'admin'],
      title: 'Botão do hero — "Ver turmas" (logado, inscrito ou admin)',
      body: 'Navega para a página Turmas. O botão nunca fica oculto — troca de "Juntar-se à Força" para "Ver turmas" assim que a pessoa loga.' },

    /* ── TURMAS ── (ordem alinhada ao fluxo real da página e ao mapa.js) */
    { section: 'turmas', personas: ['visitante', 'logado', 'inscrito', 'admin'],
      title: 'Acesso geral — mesma página para todos os perfis',
      body: 'A página Turmas mostra as mesmas turmas para todo mundo (visitante, logado, inscrito ou admin) — nenhuma é escondida por perfil. Cada card mostra nome, mês, datas e horário (9h – 13h). O estado do card muda automaticamente conforme as datas e ações do admin — 4 estados possíveis: (1) interesse aberto: botão "Tenho interesse"; (2) interesse encerrado mas turma ainda não iniciou: orientação para o CMFlex com botão "Ir para o CMFlex"; (3) em andamento: a partir do primeiro dia da turma, o card troca automaticamente para "Turma em andamento · As aulas estão acontecendo", sem nenhum botão — independente de o interesse ter sido encerrado ou não; (4) realizada: após o último dia OU quando o admin clica "Encerrar turma", o card mostra "Turma realizada · Esta turma já foi concluída. Fique de olho nas próximas", sem botão. Abaixo dos cards (igual para todos os perfis): bloco "Como funciona a oficina" + Agenda D1–D5.' },
    { section: 'turmas', personas: ['visitante', 'logado', 'inscrito', 'admin'],
      title: 'Turma com interesse encerrado — card do CMFlex (antes da turma iniciar)',
      body: 'Quando o admin encerra o interesse de uma turma (botão "Encerrar interesse" no Admin) e a turma ainda não chegou ao primeiro dia, o card daquela turma troca imediatamente para todo mundo: mostra o título "Faça sua inscrição no CMFlex" e o texto "Sua inscrição deve ser feita na Plataforma de Gestão, em RH Uso Pessoal > Solicitação de curso, após a aprovação do seu gestor." e um botão "Ir para o CMFlex →" que abre, em nova aba, o link cadastrado pelo admin para aquela turma específica. Se a turma ainda não tem link cadastrado, mostra "Link ainda não disponível. Consulte a organização." no lugar do botão. Ninguém vira inscrita automaticamente nesse momento — quem de fato se inscreveu no CMFlex só passa a ter os privilégios de inscrita depois que o admin confirma essa pessoa manualmente.' },
    { section: 'turmas', personas: ['visitante', 'logado', 'inscrito', 'admin'],
      title: 'Turma em andamento — card automático a partir do primeiro dia',
      body: 'A partir da data do primeiro dia da turma, o card troca automaticamente — sem nenhuma ação do admin — para o estado "Em andamento": mostra "Turma em andamento" e a mensagem "As aulas estão acontecendo. Fique de olho nas próximas turmas!" Não há botão de interesse nem de CMFlex. Esse estado é detectado por data (hoje ≥ primeiro dia da turma) e acontece mesmo que o interesse ainda não tenha sido encerrado.' },
    { section: 'turmas', personas: ['visitante', 'logado', 'inscrito', 'admin'],
      title: 'Turma realizada — card automático após o último dia ou ação do admin',
      body: 'Há dois caminhos para o card mostrar "Turma realizada": (1) automaticamente, no dia seguinte ao último dia cadastrado da turma; (2) quando o admin clica "✓ Encerrar turma" (ver Admin). Em ambos os casos o card mostra "Turma realizada" e a mensagem "Esta turma já foi concluída. Fique de olho nas próximas!" sem nenhum botão. Essa é a última etapa — não há como "reabrir" uma turma já encerrada.' },
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
      title: 'Registrar interesse → botão vira "Remover interesse" + mensagem sobre CMFlex',
      body: 'Disponível para qualquer usuário logado, em qualquer turma com interesse aberto — inclusive quem já está inscrita (confirmada) em outra turma. Ao clicar em "♡ Tenho interesse" (estilo primário, dourado sólido), o botão vira "♡ Remover interesse" (estilo secundário, fundo escuro) e exibe a mensagem "Interesse registrado. Para confirmar sua vaga, realize a inscrição no CMFlex em: RH - Uso Pessoal | PREVI" embaixo do botão. É possível manifestar interesse em quantas turmas existirem ao mesmo tempo — não há limite fixo, o número de turmas depende do que o admin cadastrou; só a confirmação como inscrita é exclusiva de uma turma (ver regra "confirmar inscrição" no Admin).' },
    { section: 'turmas', personas: ['logado', 'admin'],
      title: 'Remover interesse → botão volta a "Tenho interesse"',
      body: 'Ao clicar em "♡ Remover interesse", o botão volta ao estado inicial "♡ Tenho interesse" e exibe a mensagem "Interesse removido." embaixo do botão.' },
    { section: 'turmas', personas: ['logado', 'admin'],
      title: 'Quem já é Inscrita não pode se autorremover — botão fica travado',
      body: 'Se a pessoa já foi confirmada como Inscrita (pelo admin) e a turma ainda estiver com interesse aberto (ex.: turma reaberta depois da confirmação), o card não mostra mais "♡ Tenho interesse"/"♡ Remover interesse" — mostra um botão verde desabilitado "✓ Inscrita" e a mensagem "Você já é inscrita nesta turma. Só o admin pode alterar sua inscrição." Isso existe porque só o admin sabe de verdade se a pessoa continua inscrita no CMFlex — se ela pudesse se autorremover pelo site, o portal ficaria com um status errado (achando que ela saiu) sem ninguém perceber, mesmo ela continuando inscrita de fato lá fora. Só o botão "Desconfirmar" do admin pode tirar o status de Inscrita.' },
    /* ── Cenários de exceção (corridas, falhas e correções de bug) ── */
    { section: 'turmas', personas: ['logado', 'admin'],
      title: 'Corrida: turma encerra interesse entre carregar a página e clicar em "Tenho interesse"',
      body: 'Se o admin encerrar o interesse da turma no intervalo entre o carregamento do card e o clique no botão, o registro é recusado e exibe "Esta turma está encerrada para novas inscrições." (mensagem diferente da do card já mostrando CMFlex desde o carregamento).' },
    { section: 'turmas', personas: ['logado', 'admin'],
      title: 'Corrida rara: turma encerra interesse com a página já aberta',
      body: 'Se o admin encerrar o interesse enquanto o usuário já está com a página Turmas aberta (sem recarregar), o card antigo (com o botão de interesse) continua na tela até a próxima visita/recarregamento — não troca sozinho para o card do CMFlex. Um clique em "Tenho interesse" nesse card desatualizado cai na regra da corrida acima.' },
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
      body: 'Se o admin ainda não clicou em "Encerrar interesse" para essa turma, exibe "Esta turma ainda não teve as inscrições finalizadas."' },
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
      body: 'A página tem perguntas frequentes exibidas em formato de acordeão: clicar no título expande ou recolhe a resposta, e cada pergunta abre de forma independente das outras. O texto acima do título é "Central de Ajuda" e o título principal é "Como podemos ajudar?". Abaixo do FAQ há a seção "Faça um pedido" — formulário visível e preenchível por qualquer visitante (escolher tipo: tema, curso, material, dúvida ou outros, e descrever); só o envio exige login — sem sessão, mostra "Faça login para enviar um pedido." em vez de gravar.' },

    /* ── AVALIAÇÃO ── */
    { section: 'avaliacao', personas: ['inscrito', 'admin'],
      title: 'Quem vê a aba Avaliação',
      body: 'A aba "Avaliação" aparece no menu para inscritos confirmados em turma onde o admin liberou a avaliação (campo avaliacaoHabilitada: true na turma). Inscritos sem turma liberada não veem a aba. O admin vê a aba sempre, independente do flag — para poder testar e revisar o formulário antes e depois de liberar para os inscritos. A visibilidade é verificada em tempo real ao carregar e a cada mudança de sessão.' },
    { section: 'avaliacao', personas: ['admin'],
      title: 'Admin navega por qualquer evento/turma na Avaliação',
      body: 'Ao abrir a aba Avaliação, o admin vê dois seletores no topo — "Evento" e "Turma" (mesmo padrão da aba Certificados) — em vez do fluxo de inscrito comum. Escolhendo evento e turma, o formulário daquela turma é carregado para revisão, mesmo que o admin não esteja pessoalmente inscrito e confirmado nela. Se o admin já tiver enviado uma resposta de teste para aquela turma antes, mostra a tela de agradecimento com um aviso de que é uma resposta de teste, que não afeta os dados reais dos inscritos. Envios feitos nesse modo gravam normalmente em avaliacoes/<turmaKey>/<emailKey do admin>.' },
    { section: 'avaliacao', personas: ['admin'],
      title: 'Admin libera e encerra a avaliação por turma',
      body: 'No painel Admin, aba Eventos, menu ⋯ de cada turma: botão "📋 Liberar avaliação" ativa o formulário para os inscritos daquela turma (grava avaliacaoHabilitada: true em turmas/<key>). O botão vira "🔒 Encerrar avaliação" — clicar desativa o acesso. Efeito visível no próximo login ou recarregamento da página pelo inscrito.' },
    { section: 'avaliacao', personas: ['inscrito', 'admin'],
      title: 'Seções obrigatórias e opcionais',
      body: 'O formulário tem 13 seções. Seções 1 a 7 (todos os campos de rating) são obrigatórias — badge dourado "Obrigatória" no cabeçalho. Seções 8 a 13 são marcadas como "Opcional". O envio só é bloqueado se alguma das seções obrigatórias não tiver o campo principal respondido; ao bloquear, a seção faltante abre automaticamente.' },
    { section: 'avaliacao', personas: ['inscrito', 'admin'],
      title: 'Accordion — seções colapsadas por padrão',
      body: 'Ao abrir o formulário, apenas a seção 1 está expandida. As demais estão recolhidas. Clicar no cabeçalho de qualquer seção expande ou recolhe aquela seção. Seções com campo principal respondido exibem ✅ no cabeçalho mesmo quando recolhidas.' },
    { section: 'avaliacao', personas: ['inscrito', 'admin'],
      title: 'Auto-avançar após nota',
      body: 'Ao selecionar qualquer nota 0–10 no campo principal de uma seção, a seção atual fecha e a próxima abre automaticamente após 600ms. O comportamento só se aplica ao campo principal (nota geral da seção) — não dispara ao preencher sub-itens.' },
    { section: 'avaliacao', personas: ['inscrito', 'admin'],
      title: 'Rascunho automático (localStorage)',
      body: 'O formulário salva automaticamente as respostas no localStorage a cada 800ms de inatividade. A chave do rascunho é única por usuária + turma. Ao voltar à aba Avaliação (mesmo após fechar e reabrir o browser), as respostas são restauradas. O rascunho é apagado definitivamente após o envio com sucesso.' },
    { section: 'avaliacao', personas: ['inscrito', 'admin'],
      title: 'Identificação opcional',
      body: 'Antes do botão de envio há um checkbox "Quero me identificar nesta avaliação", desmarcado por padrão. Se marcado, o nome da pessoa é gravado junto com as respostas (campo nomeExibido) e fica visível para o admin. Se desmarcado (padrão), a avaliação é anônima — o admin não vê o nome, apenas as respostas e a turma.' },
    { section: 'avaliacao', personas: ['inscrito', 'admin'],
      title: 'Envio único por turma',
      body: 'Após enviar a avaliação, a tela de agradecimento é exibida e o formulário não pode ser preenchido novamente para aquela turma. O dado é gravado em avaliacoes/<turmaKey>/<emailKey> no Firebase. Se houver mais de uma turma pendente, o formulário aparece para a próxima turma após enviar.' },

    /* ── ADMIN ── */
    { section: 'admin', personas: ['visitante', 'logado', 'inscrito'],
      title: 'Acesso negado',
      body: 'Visitante, usuário logado e inscrito não veem o link "Admin" no menu. Se acessarem a URL diretamente, veem mensagem de acesso restrito e botão para voltar ao início.' },
    { section: 'admin', personas: ['admin'],
      title: 'Admin tem acesso total ao site, mesmo sem turma própria',
      body: 'Admin sempre vê e acessa Conteúdos e Treinamento Jedi no menu, mesmo que não esteja pessoalmente inscrito em nenhuma turma — o nível de acesso "enrolled" é garantido para qualquer admin, independente da inscrição real dela.' },
    { section: 'admin', personas: ['admin'],
      title: 'Navegação por abas — desktop e mobile',
      body: '10 abas no painel: Dashboard, Eventos, Certificados, Repositório, Cadastrados, Administradores, Manual, Mapa, Testes e Pedidos. No desktop ficam em linha única. No mobile podem quebrar em 2 linhas com fonte reduzida para todas ficarem visíveis sem scroll horizontal.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Dashboard',
      body: 'Primeira aba do painel — visão geral das avaliações recebidas, lida direto de avaliacoes/ no Firebase. Cinco cards no topo: Participantes (soma de inscritos confirmados em todas as turmas), Avaliações recebidas (com % de participação), Média geral (0–10), NPS — recomendação (fórmula clássica: % de notas 9–10 menos % de notas 0–6 no campo npsNota, não é uma simples média), Comentários (quantidade de avaliações com pelo menos um dos três campos de texto livre preenchido). Abaixo: gráfico de barras com a média por turma; distribuição das notas gerais em 6 faixas (0-1, 2, 3-4, 5-6, 7-8, 9-10) com barra de proporção colorida; gauge semicircular mostrando a média de recomendação (0–10). Se ainda não houver nenhuma avaliação recebida, a estrutura inteira (cards, gráficos, painéis) continua visível com valores zerados — em vez de esconder tudo atrás de uma mensagem única, mostra um aviso no topo ("Nenhuma avaliação recebida ainda...") e cada gráfico exibe todas as turmas reais cadastradas com barra em 0, deixando claro que a funcionalidade existe e só falta dado chegar.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Dashboard — destaques e temas',
      body: '"Principais destaques dos feedbacks" é calculado só a partir das 5 notas estruturadas por seção (Organização, Conteúdo, Facilitadores, Dinâmicas, Aplicação prática) — nunca interpreta o texto livre dos campos "O que devemos continuar fazendo", "O que devemos melhorar" ou "Espaço aberto", porque categorizar texto exigiria alguém rotular manualmente ou uma lógica de palavras-chave pouco confiável. Cada seção mostra a média (0–10) e quantas pessoas deram nota 8 ou mais ("menções"), ordenadas da mais bem avaliada pra baixo. "Temas mais solicitados" agrega o campo temasDesejados (checkbox de "Temas que você quer aprender" na Avaliação) em chips com contagem, do mais pedido pro menos pedido. "Feedbacks em destaque" mostra até 3 comentários do campo "continuar" mais recentes, com o nome (só se a pessoa marcou "Quero me identificar" na Avaliação — senão aparece "Participante") e a turma.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Eventos — visão geral',
      body: 'As turmas são organizadas por evento: cada evento é um container com título próprio e seus cards de turma dentro. Os containers de evento começam recolhidos (apenas o cabeçalho visível). As turmas dentro de cada evento também começam recolhidas (apenas o cabeçalho do card visível). Clicar no cabeçalho do evento expande/recolhe suas turmas; clicar no cabeçalho do card de turma expande/recolhe os participantes e ações. Turmas sem evento associado aparecem numa seção "TURMAS SEM EVENTO" ao final. Cada card de turma exibe: seta de toggle, selo ABERTA ou INTERESSE ENCERRADO, contagem "X não confirmados · Y confirmados" (sempre os dois números), botões de ação e a lista de participantes ativos. As duas contagens são exclusivas e somam o total de ativos: "confirmados" são os que têm status "inscrito"; "não confirmados" são todos os demais (status "interessado"). O rótulo evita dizer "interessados" porque todo inscrito também manifestou interesse um dia — sugeriria um subconjunto que não existe na contagem. Quando existem os dois grupos na turma, aparece um filtro acima da tabela (Todos / Confirmados / Não confirmados, com a contagem de cada um) para exibir só o grupo escolhido. A lista é a mesma em qualquer estado; colunas de presença por dia aparecem exclusivamente quando o interesse já foi encerrado.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Eventos — filtro e expand/collapse',
      body: 'Barra de controle no topo da aba Eventos, abaixo dos botões globais: seletor "Ver evento:" filtra a exibição para um único evento (oculta os demais e expande o selecionado automaticamente); opção "Todos" restaura todos os containers. Botões "↕ Expandir tudo" e "↕ Recolher tudo" atuam em todos os containers de evento e todos os cards de turma simultaneamente. Os botões e o filtro interagem: expandir tudo mostra tudo, depois filtrar mostra só o evento escolhido expandido.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Eventos — Eventos (entidade pai das turmas)',
      body: 'Botão "+ Novo evento" (topo da aba): cria um evento com três campos — nome, carga horária (horas) e frequência mínima para certificado (%, padrão 75). Eventos são os containers pai das turmas — um evento pode ter múltiplas turmas. Os dados do evento (nomeEvento, cargaHoraria, percentualMinimo) são herdados automaticamente pelo certificado de cada turma vinculada. Editar ou excluir evento: ações disponíveis via botões no cabeçalho de cada container de evento. Excluir evento não exclui as turmas dentro dele — elas passam para a seção "TURMAS SEM EVENTO".' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Eventos — criar turma',
      body: 'Botão "+ Nova turma" (dentro de um container de evento ou no topo da aba): abre modal com campo de nome, seletor de evento (pré-preenchido quando aberto dentro de um evento), lista de datas com seletor de calendário (+ Adicionar data / ✕ remover) e campo opcional "Link do CMFlex". Ao salvar, a turma aparece no container do evento correspondente — ou em "TURMAS SEM EVENTO" se nenhum evento for selecionado. O admin decide quantas turmas existem por evento.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Eventos — editar turma (nome, datas e link do CMFlex)',
      body: 'Botão "✎ Editar turma" no menu "⋯" de cada card: abre o mesmo modal de criação, já preenchido com o nome, as datas e o link do CMFlex atuais. Permite renomear a turma, incluir ou excluir datas individuais dos encontros, e cadastrar/trocar o link do CMFlex a qualquer momento — inclusive depois do interesse já encerrado (o card público atualiza o botão "Ir para o CMFlex" assim que o link é salvo). Alterar as datas não apaga check-ins já registrados nos dias que continuarem na lista; remover uma data cuja presença já foi registrada não apaga o histórico de presença, apenas tira aquele dia das tabelas/certificados a partir da próxima geração.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Eventos — excluir turma',
      body: 'Botão "🗑 Excluir turma" no menu "⋯" de cada card: pede confirmação informando quantas pessoas ativas e removidas serão afetadas. Ao confirmar, apaga a turma e todos os dados ligados a ela — interessados/inscritos, configuração (aberta/finalizada), check-ins e histórico de log. Ação permanente, sem desfazer.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Eventos — exportar CSV Estado Atual',
      body: 'Botão global "↓ Estado atual": exporta todas as turmas em um único arquivo CSV. Inclui apenas usuários ativos — removidos não aparecem. Coluna "Adicionado por" preenchida com nome do admin quando o participante foi adicionado manualmente; vazia quando o participante se inscreveu por conta própria.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Eventos — exportar CSV Histórico',
      body: 'Botão global "↓ Histórico": exporta o log completo de ações em turmas-interesse-log — inclui ativos, removidos e todo histórico de interesse registrado/removido, adicionado/removido pelo admin, e confirmado/desconfirmado como inscrita. Coluna "Origem" preenchida com "Admin — nome" quando a ação foi executada por um admin; "Participante" quando a própria pessoa registrou ou removeu o interesse.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Eventos — exportar CSV individual por turma',
      body: 'Botão "↓ CSV" em cada card de turma: exporta apenas os participantes ativos daquela turma. Para turmas finalizadas inclui colunas de presença por dia, frequência e critério atingido. Inclui coluna "Adicionado por" quando aplicável.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Eventos — encerrar interesse',
      body: 'Botão "Encerrar interesse" (turma ABERTA): fecha a captação de interesse — o card público daquela turma troca imediatamente para todo mundo, mostrando a orientação de inscrição no CMFlex em vez do botão "Tenho interesse". Ninguém vira inscrita automaticamente nesse momento; cada pessoa só passa a ter status Inscrito quando o admin a confirma manualmente (ver regra "confirmar inscrição" abaixo). Após encerrar, aparecem os botões QR Code, Abrir check-in e Reabrir.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Eventos — encerrar turma (marcar como realizada)',
      body: 'Botão "✓ Encerrar turma" (disponível no menu ⋯ quando o interesse já foi encerrado — ou seja, "finalizada: true" no banco e ainda não encerrada). Ao clicar, pede confirmação, marca a turma como encerrada no banco e grava automaticamente a dataConclusao (data do dia da ação, em ISO) em turmas-config/{key}/dataConclusao — essa data aparece como data de emissão nos certificados. O card público passa imediatamente para o estado "Turma realizada" para todos. Esse botão também habilita os downloads definitivos de certificados na aba Certificados. Se o admin não clicar, o sistema detecta automaticamente o fim da turma no dia seguinte ao último dia cadastrado (mas nesse caso dataConclusao não é gravada automaticamente, e os downloads de certificado ficam bloqueados até que o admin clique).' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Eventos — confirmar inscrição (CMFlex)',
      body: 'Toda interessada ganha um botão "Confirmar" na sua linha da lista, com a turma aberta ou com interesse encerrado — a inscrição real no CMFlex não espera o portal fechar a captação de interesse. O admin usa esse botão quando sabe que a pessoa de fato se inscreveu no CMFlex — ao confirmar, ela passa a ter status Inscrito e libera na hora o acesso a Conteúdos, Treinamento Jedi e o registro de presença/certificado (presença só pode ser registrada de verdade depois que o check-in é aberto, o que continua exigindo turma com interesse encerrado). Se a pessoa já for Inscrita em outra turma, o modal de confirmação avisa e, ao continuar, remove automaticamente essa outra inscrição (ninguém pode ficar inscrita em mais de uma turma; isso é o único ponto do sistema que garante essa regra — registrar interesse não tem esse limite). Só uma inscrição em outra turma dispara esse aviso — se ela só estiver interessada (não inscrita) em outra turma, nada acontece: interesse em várias turmas ao mesmo tempo é normal e não é tocado. A remoção aparece na seção "Removidos" da outra turma, com o motivo registrado.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Eventos — desconfirmar inscrição',
      body: 'Toda pessoa com status Inscrito ganha um botão "Desconfirmar" na sua linha, com a turma aberta ou com interesse encerrado. Usado quando a pessoa desiste ou sai do CMFlex depois de confirmada: ela volta a ser só "Interessada", perde na hora o acesso a Conteúdos, Treinamento Jedi e não pode mais registrar presença — mas continua na lista da turma (não é removida) e pode ser confirmada de novo depois.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Eventos — check-in do dia',
      body: 'Uma lista com os dias da turma (já vem com hoje marcado, se for um dia válido) + botão "Abrir check-in": escolhe qual dia fica liberado para registrar presença. Ao clicar em "Abrir check-in", aparece uma confirmação mostrando o dia exato que será aberto — se o dia selecionado for diferente de hoje, a confirmação inclui um aviso ⚠️. O admin pode abrir qualquer dia — passado ou futuro — sem precisar estar no dia exato. Participantes só conseguem escanear o QR Code e registrar presença enquanto um dia estiver aberto. Quando aberto, aparece "Check-in aberto: DD/MM" + botão "Fechar check-in". Cada pessoa só pode registrar presença uma vez por dia.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Eventos — QR Code',
      body: 'Botão "⌘ QR Code" (disponível após finalizar): gera de verdade um QR Code, que aponta para a página de check-in daquela turma. É o mesmo QR todos os dias — não precisa gerar um novo, porque quem decide se o check-in vale naquele momento é o botão "Abrir/Fechar check-in", não o QR em si. A URL também aparece em texto abaixo do QR, caso prefira copiar em vez de escanear. A geração usa uma biblioteca própria do projeto (forca-agil/qrcode.min.js) — não depende de nenhum site externo; se algum dia falhar, exibe um aviso claro em vez de deixar o quadro em branco.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Eventos — QR de acesso ao site',
      body: 'Botão "↓ QR de acesso ao site" no topo da aba (junto de Novo evento / Estado atual / Histórico): baixa uma imagem PNG pronta com um QR Code apontando para forca-agil.previ.com.br, com o logotipo da Força Ágil (ícone + texto + Previ) no centro. Diferente do QR de check-in (que é gerado dinamicamente por turma), este é um arquivo estático em forca-agil/assets/qrcode-acesso.png — feito para uso em cartazes, slides de apresentação ou qualquer material impresso de divulgação. Para trocar a imagem (outra paleta, outro tamanho), é preciso gerar um novo PNG e substituir o arquivo — não há geração dinâmica no navegador.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Eventos — layout responsivo das ações',
      body: 'Desktop: todas as ações ficam em linha única — seletor de dia + botão "Abrir check-in" (ou "Fechar check-in") sempre visíveis; QR Code, + Participante, Reabrir e CSV também na mesma linha. Celular/tablet: o cabeçalho do card vira coluna; só as ações principais ficam visíveis (seletor de dia + Abrir/Fechar check-in para turma com interesse encerrado, ou "Encerrar interesse" para turma aberta); o botão "⋯" abre um menu com as ações secundárias (QR Code, + Participante, ↺ Reabrir, CSV). Geração de certificado não está mais no menu da turma — é feita exclusivamente pela aba Certificados (ver seção "Aba: Certificados"). O menu "⋯" funciona com o card de turma recolhido OU expandido — não depende de expandir o card primeiro (corrigido em 16/08/2026: o card tinha overflow:hidden, cortando o menu quando recolhido, porque ele é posicionado abaixo do cabeçalho e "vazava" da altura do card recolhido). O menu também detecta se há espaço suficiente abaixo do botão "⋯" antes de abrir — se o card estiver perto do rodapé da página, abre para CIMA em vez de para baixo, para nunca ficar cortado pela borda da tela (também corrigido em 16/08/2026). Esse mesmo problema existia em DOIS níveis: além do card da turma, o container do evento (ex: "FORÇA ÁGIL · JORNADA DE IMERSÃO") e o bloco "TURMAS SEM EVENTO" também tinham overflow:hidden, cortando o menu mesmo com o card já corrigido — corrigidos os três ao mesmo tempo.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Eventos — tabela de presença',
      body: 'A lista de participantes (Nome, E-mail, Área, Status) é a mesma com a turma aberta ou com interesse encerrado — só que com o interesse encerrado ganha colunas extras por dia (ex: 11/08, 12/08…) e uma coluna Freq., já que é aí que o check-in passa a existir de verdade. Linhas "Interessado" mostram traço em todas as colunas de dia e frequência (ainda não confirmadas — não registram presença). Linhas "Inscrito" mostram, em cada dia, um selo verde "✓ qr" (registrado pelo próprio QR Code — ver seção Check-in), um selo ciano "✓ adm" (admin registrou manualmente pelo botão "—") ou o botão "—" clicável para lançar presença retroativa a qualquer hora — as duas formas contam igual para a frequência, exibida na última coluna como X/5 em verde (atingiu o critério) ou vermelho (não atingiu). Critério padrão: 75% de presença (4 de 5 dias). Com a turma ainda aberta, a lista mostra só Nome/E-mail/Área/Status/Data de registro — sem colunas de dia, já que check-in ainda não pode acontecer.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Eventos — desfazer check-in',
      body: 'As etiquetas "✓ adm" e "✓ qr" nas células da tabela de presença são botões clicáveis. Passar o mouse mostra um risco no texto, sinalizando remoção. Clicar abre um modal de confirmação. Ao confirmar, remove aquele registro de presença e recarrega a tabela com a frequência atualizada. Funciona tanto para presenças registradas pelo admin quanto por QR Code.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Eventos — adicionar participante (busca em cadastros)',
      body: 'Botão "＋ Participante" (disponível com a turma aberta ou com interesse encerrado): abre um modal com campo de busca por nome ou e-mail. O admin digita e o sistema filtra em tempo real os cadastros existentes (fa-users) — ao clicar numa pessoa da lista, nome, e-mail e área são preenchidos automaticamente. O admin só precisa escolher o status: "Interessada" ou "Inscrita". A pessoa precisa ter cadastro prévio no site para aparecer na busca — sem cadastro ela não consegue acessar o sistema, então o admin deve orientá-la a se cadastrar primeiro. Se a pessoa não aparecer na busca, o modal exibe esse aviso. Escolher "Inscrita" adiciona direto com esse status (sem precisar de "Confirmar" depois); se ela já for Inscrita em outra turma, o modal avisa e ao continuar remove automaticamente essa outra inscrição. Escolher "Interessada" registra só o interesse, sem essa checagem. Se o e-mail já estiver na turma, exibe aviso. A tabela atualiza automaticamente. Nomes são sempre normalizados para maiúsculas ao salvar.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Eventos — justificativa para interessados não confirmados',
      body: 'Cada linha com status "Interessado" tem um seletor "Justificar…" na coluna de ações. O admin escolhe entre três motivos: "Sem vagas" (a turma lotou), "Substituída" (outra pessoa foi no lugar) ou "Já participou" (pessoa inscrita em mais de uma turma que já foi confirmada em outra anteriormente — possível porque registrar interesse não tem limite). Badge colorido ao lado do badge "Interessado": laranja para "Sem vagas", lilás para "Substituída", verde-claro para "Já participou". Para desfazer, selecionar "Justificar…" de volta — limpa o motivo. Disponível com a turma aberta ou encerrada.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Eventos — remover participante',
      body: 'Botão "Remover" (disponível para linhas Interessado ou Inscrito, com a turma aberta ou com interesse encerrado): abre um modal de confirmação. Ao confirmar, registra quem e quando removeu, e a pessoa some da lista de participantes ativos imediatamente. Diferente de "faltou a um dia" — é uma remoção da turma, não uma ausência. Os check-ins já registrados não são apagados: a pessoa passa a aparecer na seção "Removidos" da própria turma, com o histórico de presença preservado quando ela era inscrita (ver regra abaixo).' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Eventos — pessoa removida pode ser readicionada',
      body: 'Não existe bloqueio pra impedir que alguém removido volte a ter um registro ativo na mesma turma: se o interesse ainda estiver aberto, a própria pessoa pode clicar em "Tenho interesse" de novo pelo site; em qualquer estado da turma, o admin pode readicioná-la pelo "＋ Participante" (escolhendo Interessada ou Inscrita). Em ambos os casos um novo registro substitui o antigo e ela some da seção "Removidos", voltando pra lista de participantes ativos — o evento de remoção anterior continua no CSV "Histórico" (turmas-interesse-log), que nunca é apagado.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Eventos — seção "Removidos"',
      body: 'Aparece em qualquer card de turma (interesse aberto ou encerrado) só quando há pelo menos uma pessoa removida. Mostra nome, e-mail, área, data de remoção e o motivo (manual pelo admin, ou automático por ter sido confirmada em outra turma); com o interesse encerrado mostra também o histórico de presença de quem era inscrita (mesmas colunas por dia, com os mesmos selos "✓ qr" / "✓ adm") — tudo só leitura, sem botões de ação.' },
    { section: 'admin', personas: ['admin'],
      title: 'Pop-ups do admin — modais visuais (não nativos)',
      body: 'Todas as confirmações e avisos do painel usam janelas com o mesmo visual dos modais de cadastro/login — nenhuma ação usa aquelas caixas de diálogo padrão do navegador.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Certificados — Gerador v1.0',
      body: 'Painel de geração de certificados. Fluxo: (1) selecionar Evento — popula o seletor de Turmas filtrado por aquele evento; (2) selecionar Turma — carrega dados do Firebase (nomeEvento, cargaHoraria, percentualMinimo, dataConclusao, check-ins). Os 6 campos dinâmicos são preenchidos sem entrada manual: nome do participante, nome do evento, identificação da turma, período, carga horária e data de emissão ("Emitido em"). Canvas fixo 1448 × 1086 px; prévia escala 4:3. Textos longos reduzem fonte por campo de forma independente. Nomes de arquivo: Certificado_NOME.png / Certificado_NOME.pdf.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Certificados — estados: Prévia Administrativa vs. Emissão',
      body: 'TURMA NÃO ENCERRADA (estado Prévia): banner laranja "PRÉVIA DO CERTIFICADO — TURMA AINDA NÃO CONCLUÍDA" aparece acima do canvas; botões ⬇ PNG e ⬇ PDF por participante desabilitados (tooltip: "Disponível após a conclusão da turma."); botões de lote também desabilitados; dataEmissao vazia. Qualquer participante pode ser selecionado para visualizar a prévia — nenhum badge de frequência é exibido ainda. TURMA ENCERRADA (estado Emissão): banner oculto; cada participante exibe badge de frequência (% de presença calculado sobre os dias da turma) — verde se atingiu o percentual mínimo do evento, vermelho se não atingiu. Downloads PNG/PDF e lote habilitados somente para quem atingiu o mínimo; os demais ficam bloqueados com tooltip explicativo ("Frequência insuficiente — X% < Y% exigido"). "Baixar todos" gera certificados apenas dos elegíveis. dataConclusao da turma é usada como dataEmissao.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Certificados — frequência mínima para certificado',
      body: 'Configurada por evento no campo "Frequência mínima p/ certificado" (padrão 75%, editável de 1% a 100% via "✎ Editar evento" na aba Eventos). A frequência de cada participante é calculada como: (dias com check-in registrado) ÷ (total de dias da turma) × 100. Quem atingiu o mínimo: badge verde, downloads liberados. Quem não atingiu: badge vermelho, downloads bloqueados. A prévia (👁) permanece disponível para todos independente da frequência, tanto antes quanto depois de encerrar.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Certificados — o que pertence ao template (não alterar)',
      body: 'O template PNG contém todos os elementos visuais fixos: fundo espacial, estrelas, galáxias, planeta, moldura dourada, ornamentos, logos (Força Ágil e Previ), símbolo circular, textos "UMA GALÁXIA MAIS ÁGIL", "CERTIFICADO DE PARTICIPAÇÃO", "A Força reconhece que", "concluiu sua jornada na", ícone de calendário, badge da carga horária, texto "DE IMERSÃO EM AGILIDADE", identificação institucional, frase institucional inferior, símbolo central, "QUE A AGILIDADE ESTEJA COM VOCÊ." e demais decorações. NENHUM desses elementos é redesenhado pelo código — vêm diretamente da imagem-base. Qualquer alteração neles exige substituição do template e versionamento do gerador.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Certificados — campos dinâmicos e coordenadas aprovadas',
      body: 'Os 6 campos dinâmicos e suas configurações atuais (sistema 1448×1086): (1) nomeParticipante — x:724 y:385 maxW:1041 fonte:55/28px italic branco centralizado; (2) nomeEvento — x:724 y:535 maxW:920 fonte:29/13px bold caixa-alta dourado espaçamento:3 centralizado; (3) identificacaoTurma — x:724 y:581 maxW:680 fonte:19/12px normal dourado-escuro centralizado — valor = turma.label exatamente como cadastrado pelo admin (sem acréscimo automático de mês/ano); (4) periodoTurma — x:598 y:658 maxW:400 fonte:24/13px normal branco-claro alinhado-esquerda; (5) cargaHoraria — x:613 y:757 maxW:160 fonte:48/24px bold dourado centralizado; (6) dataEmissao — x:1055 y:922 maxW:360 fonte:19/10px italic dourado alinhado-esquerda, prefixo fixo "Emitido em ". NÃO alterar estas coordenadas sem aprovação e atualização desta documentação.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Eventos — reabrir turma',
      body: 'Botão "↺ Reabrir": volta a turma para o estado ABERTA — o card público volta a aceitar novas manifestações de interesse, e fecha o check-in do dia se estiver aberto. Não mexe em nenhuma confirmação já feita: quem já foi confirmada como inscrita continua inscrita, quem está só interessada continua interessada. Não apaga registros de check-in já feitos.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Repositório — listar todos os conteúdos',
      body: 'Lista os conteúdos curados (seed) e os enviados por usuários, separados em duas seções, com o total no cabeçalho. Curados mostram título, tipo e quem indicou; enviados por usuários mostram título, autor e data de envio.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Repositório — ocultar conteúdo',
      body: 'Botão "Ocultar" (disponível tanto em curados quanto em conteúdos enviados por usuários) → some do repositório público, sem apagar o registro.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Repositório — restaurar conteúdo',
      body: 'Botão "Restaurar" (disponível apenas para conteúdos já ocultos) → volta a aparecer no repositório público.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Repositório — deletar permanentemente',
      body: 'Botão "Deletar" (disponível tanto em curados quanto em conteúdos enviados por usuários) → remove definitivamente o conteúdo. Ação irreversível.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Cadastrados — listar',
      body: 'Lista todas as pessoas que já se cadastraram. Mostra nome, e-mail, área e data de cadastro.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Cadastrados — resetar progresso',
      body: 'Disponível para qualquer pessoa cadastrada. Ação irreversível — pede confirmação antes de executar. Após o reset: se a pessoa estiver logada, a página dela recarrega automaticamente — o autodiagnóstico fica disponível para refazer sem nenhuma ação da pessoa.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Cadastrados — redefinir senha',
      body: 'Botão "Redefinir senha": dispara o e-mail de redefinição de senha do Firebase para qualquer pessoa cadastrada. Só funciona se a pessoa já tiver feito o primeiro cadastro/login.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Administradores — consultar lista',
      body: 'Lista todos os admins do painel, mostrando nome, e-mail e desde quando é admin.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Administradores — super-admins fixos',
      body: 'tatianefdirene@previ.com.br e danielfrazao@previ.com.br são super-admins fixos — não removíveis via painel.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Administradores — admins adicionais',
      body: 'Podem ser adicionados e removidos via painel. Formulário exige nome completo e e-mail @previ.com.br. Apenas tatianefdirene@previ.com.br e danielfrazao@previ.com.br podem adicionar ou remover admins — restrição garantida no banco de dados, não só na tela. Qualquer pessoa na lista vê a aba Admin mas não gerencia a lista. A lista de admins não é visível para usuários comuns.' },
    { section: 'admin', personas: ['admin'],
      title: 'Painel Admin — carregamento ao abrir #admin direto',
      body: 'O painel espera o Firebase resolver a sessão (evento fa-auth-ready) antes de carregar os dados. Isso é necessário porque ao abrir forca-agil.previ.com.br/#admin direto — link salvo, F5 ou endereço digitado — o router dispara a inicialização antes da sessão existir. Sem essa espera, a inicialização retornava em silêncio e TODAS as abas (Eventos, Certificados, Repositório, Cadastrados, Administradores) ficavam presas em "Carregando…" para sempre, sem nenhum erro no console. Navegar para o Admin clicando no menu funcionava, porque nesse caso a sessão já estava resolvida — o que tornava o bug intermitente e confuso.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Administradores — tratamento de erro na leitura',
      body: 'Se a leitura de fa-admins falhar (permissão negada, rede instável, sessão expirando), a aba exibe "Erro ao carregar administradores. Recarregue a página ou verifique sua conexão." em vermelho, em vez de ficar travada indefinidamente em "Carregando administradores…" sem explicação.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Manual',
      body: 'Checklist de regras de comportamento do sistema, organizado por seção e por persona. Documentação viva — deve ser atualizada junto de qualquer mudança de comportamento.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Manual — filtrar por seção e persona',
      body: 'Dois seletores no topo (Seção e Persona) filtram as regras exibidas. Podem ser combinados; o contador de regras encontradas atualiza junto.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Manual — expandir/recolher tudo',
      body: 'Botões "Expandir tudo" e "Recolher tudo" abrem ou fecham de uma vez todas as regras visíveis na combinação de filtros atual.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Manual e Mapa — subgrupos dentro de ADMIN',
      body: 'A categoria ADMIN reúne itens de todas as 10 abas do painel — para não virar uma lista única confusa, é subagrupada automaticamente por aba a partir do prefixo "Aba X — " de cada título (regex: itens sem esse prefixo caem em "ADMIN · GERAL"). Cada subgrupo (ex: "ADMIN · EVENTOS") mostra sua própria contagem entre parênteses e é retrátil — clicar no subcabeçalho abre/fecha só aquele grupo, sem precisar abrir a categoria ADMIN inteira de uma vez. "Expandir tudo"/"Recolher tudo" também abrangem os subgrupos.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Mapa',
      body: 'Mostra cinco seções: (1) Hierarquia de Personas — níveis de acesso cumulativos; (2) Acesso por Tipo de Pessoa — tabela com o que cada perfil vê/acessa em cada página; (3) Mapa do Site — páginas e features com nível mínimo por persona; (4) Arquitetura Técnica e Regras Operacionais — acordeão com tecnologias, módulos, padrões de código, padrões de UX, deploy e regras de governança; (5) Diagrama da Arquitetura — visão visual gerada automaticamente a partir dos dados da Arquitetura Técnica.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Mapa — estrutura dos dados em mapa.js',
      body: 'A aba Mapa é organizada em dois grupos de conteúdo: um descreve o que o sistema é — Linguagens, Tecnologias & Serviços, Estrutura de Arquivos, Padrões de Código, Padrões de UX, Glossário de UX/Design e Deploy — exibido como "Arquitetura Técnica" e usado no Diagrama. O outro descreve como o sistema deve ser mantido — Deploy (processo), Cache e Autonomia — exibido como "Regras Operacionais".' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Testes',
      body: 'Roda os testes automatizados (técnicos e de comportamento) e exibe o checklist de regras que exigem validação manual.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Pedidos',
      body: 'Lista os pedidos enviados pelo formulário público "Faça um pedido" (página Ajuda), mais recente primeiro. Dois níveis de filtro combináveis: por status (Pendentes / Respondidos / Excluídos / Todos, com contagem — a aba abre em "Pendentes" por padrão) e por tipo (tema, curso, material, dúvida, outros, também com contagem). Cada item exibe tipo, descrição, nome e e-mail de quem enviou.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Pedidos — responder um pedido',
      body: 'Cada item tem "✉ Responder por e-mail" — abre o programa de e-mail padrão do admin (Gmail, Outlook etc.) com o destinatário, assunto ("Força Ágil — resposta ao seu pedido (tipo)") e corpo pré-preenchidos: saudação com o primeiro nome formatado (o nome vem em CAIXA ALTA no cadastro; só a primeira letra fica maiúscula na saudação), citação do pedido original com data e tipo, e assinatura genérica "Um abraço, Equipe Força Ágil" (sem nome de admin específico, porque qualquer administrador pode responder). Limitação do link mailto: — não dá pra posicionar o cursor automaticamente antes da assinatura; a maioria dos programas de e-mail abre com o cursor no final do texto, então é preciso clicar manualmente ACIMA da assinatura para escrever a resposta. A resposta em si é escrita e enviada pelo e-mail pessoal do admin, o site não manda nada sozinho.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Pedidos — marcar como respondido e prazo em dias úteis',
      body: 'Clicar "✓ Marcar como respondido" abre um seletor "— quem respondeu? —" com a lista de administradores (fa-admins + os 2 super-admins fixos, nomes buscados em fa-users) e um campo de data/hora (pré-preenchido com o momento atual, mas editável — útil quando a resposta por e-mail já foi enviada antes e só agora está sendo registrada no site). Escolher um nome, ajustar a data/hora se necessário e clicar "Confirmar" grava respondido:true, respondidoEm e respondidoPor {name, email} em pedidos/<key>. Item já respondido tem "✎ Editar" (reabre o mesmo seletor pré-preenchido com o que já foi gravado, pra corrigir admin ou data/hora) e "✕ Desmarcar" (reverte tudo: respondido:false, limpa respondidoEm/respondidoPor). Cada pedido mostra o prazo em dias úteis: pendente exibe "Em aberto há N dias úteis" (fica laranja a partir de 2 dias); respondido exibe "Respondido por NOME em DATA — N dias úteis depois do pedido" em verde. Regra de cálculo: dias úteis são segunda a sexta; se o pedido chegou ou foi respondido num sábado ou domingo, a data conta como se fosse 8h da segunda-feira seguinte, tanto para o início quanto para o fim da contagem.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Pedidos — excluir com justificativa',
      body: 'Botão "🗑 Excluir" (visível em pedidos pendentes ou respondidos, não excluídos) abre um formulário com seletor "— quem está excluindo? —" (mesma lista de admins) e uma caixa de texto obrigatória para a justificativa. Sem escolher o admin ou sem preencher a justificativa, "🗑 Confirmar exclusão" não faz nada (o foco volta pro campo vazio). É soft-delete, não apaga o dado: grava excluido:true, excluidoEm, excluidoPor {name, email} e justificativaExclusao em pedidos/<key> — o pedido original continua no banco. Item excluído só aparece no filtro de status "Excluídos", com opacidade reduzida, badge "🗑 Excluído" em vermelho, e uma linha mostrando quem excluiu, quando e a justificativa. Botão "↺ Restaurar" reverte tudo (excluido:false, limpa excluidoEm/excluidoPor/justificativaExclusao) e o pedido volta a aparecer em Pendentes ou Respondidos, conforme seu estado antes de ser excluído.' },
    { section: 'menu', personas: ['visitante', 'logado', 'inscrito', 'admin'],
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
          html += '<summary class="manual-section-header"><span class="manual-sec-icon">▸</span><span class="manual-sec-label">' + s.label + ' <span class="testes-group-count">(' + items.length + ')</span></span></summary>';
        }

        const renderCard = function (rule) {
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
        };

        if (s.key === 'admin') {
          /* A categoria Admin junta itens de 7 abas diferentes — agrupa por aba para não virar uma lista única confusa */
          const subgroups = [];
          const byTab = {};
          items.forEach(function (rule) {
            const m = /^Aba:\s*([^—]+?)(?:\s—|$)/.exec(rule.title);
            const tab = m ? m[1].trim() : 'Geral';
            if (!byTab[tab]) { byTab[tab] = []; subgroups.push(tab); }
            byTab[tab].push(rule);
          });
          subgroups.forEach(function (tab) {
            html += '<details class="manual-admin-subgroup">';
            html += '<summary class="manual-admin-subhead"><span class="manual-sec-icon">▸</span>ADMIN · ' + esc(tab.toUpperCase()) + ' <span class="testes-group-count">(' + byTab[tab].length + ')</span></summary>';
            byTab[tab].forEach(renderCard);
            html += '</details>';
          });
        } else {
          items.forEach(renderCard);
        }

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
