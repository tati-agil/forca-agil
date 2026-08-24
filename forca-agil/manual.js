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
    { key: 'minha-area',  label: 'Minha Área',          color: '#26a69a' },
    { key: 'repositorio', label: 'Repositório',          color: '#e8854a' },
    { key: 'quiz',        label: 'Treinamento Jedi',      color: '#e05c7f' },
    { key: 'turmas',      label: 'Turmas',              color: '#f5c542' },
  ];

  const PERSONAS = [
    { key: 'all',         label: 'Todas as personas',  color: 'var(--ink-2)' },
    { key: 'visitante',   label: 'Visitante',          color: '#888' },
    { key: 'logado',      label: 'Logado (sem turma confirmada)', color: '#1ab2ae' },
    { key: 'inscrito',    label: 'Inscrito (confirmado pelo admin)', color: '#4caf7d' },
    { key: 'admin',       label: 'Admin',              color: '#6b7a99' },
  ];

  const RULES = [
    /* ── CADASTRAR / ENTRAR ── */
    { section: 'menu', personas: ['visitante'],
      title: 'O que o visitante vê — só o modal de login',
      body: 'Quem ainda não fez login não vê nada do site — nem o menu, nem nenhuma página. A tela fica escura e aparece só a janela de login, que não pode ser fechada. Nessa janela ele consegue fazer três coisas: entrar, criar uma conta ou recuperar a senha. O site só aparece depois que ele entra.' },
    { section: 'menu', personas: ['logado', 'inscrito', 'admin'],
      title: 'Menu para usuário logado',
      body: 'Os botões ENTRAR e CADASTRAR somem. No lugar aparece o perfil com a inicial e o primeiro nome do usuário. O header exibe avatar, nome e botão Sair.' },
    { section: 'menu', personas: ['admin'],
      title: 'Link Admin no menu',
      body: 'O link "Admin" no menu só aparece para administradores e some imediatamente após o logout — inclusive no mobile com o menu aberto.' },
    { section: 'menu', personas: ['visitante', 'logado', 'inscrito', 'admin'],
      title: 'Perfis de acesso — quais existem e o que muda entre eles',
      body: 'São 4 perfis. VISITANTE: ainda não entrou — não vê nada do site, só a janela de login. LOGADO: entrou, mas ainda não foi confirmado em nenhuma turma — vê Início, Turmas, Ajuda e Repositório. INSCRITO: foi confirmado pelo admin em alguma turma — vê tudo o que o Logado vê, mais três páginas exclusivas: Conteúdos, Treinamento Jedi e Avaliação. ADMIN: vê tudo, incluindo o Painel Admin, e não precisa estar confirmado em turma nenhuma para ver as três páginas do Inscrito. Duas observações que costumam confundir: o Visitante não é o "primeiro degrau" dos outros perfis — a janela de login que ele vê some justamente quando a pessoa entra; e o Admin não é o degrau acima do Inscrito — é uma marcação à parte, que já dá o acesso do Inscrito de brinde.' },
    { section: 'menu', personas: ['logado', 'inscrito', 'admin'],
      title: 'Por que "interessado" não é um perfil de acesso',
      body: 'Clicar em "Tenho interesse" numa turma NÃO libera nenhuma página nova. Quem clicou vê exatamente as mesmas telas de quem nunca clicou — a única mudança é o botão daquele card passar a dizer "Remover interesse". Quem libera Conteúdos, Treinamento Jedi e Avaliação é o admin, quando confirma a pessoa na turma. Ou seja: demonstrar interesse não muda o acesso de ninguém; só a confirmação do admin muda. É por isso que "interessado" não aparece como um perfil separado aqui — ele teria exatamente o mesmo acesso do perfil Logado, o que só confundiria.' },
    { section: 'menu', personas: ['logado', 'inscrito', 'admin'],
      title: 'Como ler as etiquetas de persona nas regras',
      body: 'As etiquetas coloridas embaixo de cada regra mostram QUEM PODE fazer aquilo — nunca quem está proibido. Exemplo: a regra de acesso ao Treinamento Jedi tem as etiquetas "Inscrito" e "Admin", que são os que entram. Antes ela vinha marcada com "Visitante" e "Logado", que são justamente os que NÃO entram — batia o olho e parecia o contrário do que era. Quando alguém é barrado, isso fica escrito no texto da regra, mas não vira etiqueta. Também não existe regra só para dizer que o visitante não acessa alguma coisa: como ele não acessa nada, isso teria que ser repetido em toda página.' },
    { section: 'entrar', personas: ['visitante', 'logado', 'inscrito', 'admin'],
      title: 'Sessão que não pode ser renovada — o site se recupera sozinho',
      body: 'Em rede corporativa acontece de a sessão guardada no navegador não conseguir ser renovada. Quando isso ocorre, o site fica esperando uma confirmação que nunca chega: a pessoa vê a espera sem fim, e só voltava a funcionar limpando os cookies na mão — o que quase ninguém sabe fazer. Agora, se a verificação não terminar em 10 segundos E existir sessão guardada, o site apaga essa sessão e recarrega sozinho, UMA única vez por aba. Depois do recarregamento a tela de login aparece com o aviso "Entre novamente: sua sessão anterior não pôde ser renovada nesta rede" — para não parecer que o site deslogou por conta própria. Nada do histórico da pessoa se perde: o que é apagado fica só no navegador, nunca no servidor. Se travar de novo mesmo depois de limpo, o site não recarrega em laço: mostra o aviso com o botão "Limpar sessão e entrar de novo" e o botão de diagnóstico.' },
    { section: 'entrar', personas: ['visitante', 'logado', 'inscrito', 'admin'],
      title: 'Quando o servidor demora: o site não fica preto',
      body: 'Enquanto o site verifica quem você é, ele esconde tudo e mostra só a tela de login. Se o servidor não responder — rede lenta, proxy da empresa, internet ruim —, essa espera não pode durar para sempre: antes, a pessoa ficava diante de uma tela totalmente preta, sem login e sem explicação. Agora, passados 10 segundos sem resposta, a tela de login aparece assim mesmo, com o aviso "Demorando para conectar". Dá para tentar entrar normalmente; se o servidor responder depois, o site segue o fluxo normal e o aviso some.' },
    { section: 'entrar', personas: ['visitante', 'logado', 'inscrito', 'admin'],
      title: 'Botão "Testar conexão" — descobrir o que está travando',
      body: 'Dentro do aviso de demora existe o botão "Testar conexão". Ele verifica os quatro caminhos de que o site depende e diz, em português, quais responderam e quais estão barrados: o carregamento do sistema, o login e senha, os dados do site e a conexão permanente com o banco. Se algum estiver bloqueado, monta um texto pronto para você copiar e encaminhar à equipe de TI, nomeando exatamente o endereço a liberar. Se NENHUM estiver bloqueado e mesmo assim o site travar, o problema é lentidão e não acesso — nesse caso ele mostra quanto tempo cada parte levou, o que separa "demorou para baixar o sistema" de "o servidor demorou para responder". O teste não envia dado nenhum.' },
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
      body: '1. Site oculto: nada do site aparece até o sistema confirmar quem é a pessoa — quem não entrou vê só a janela de login, sem nada por baixo.\n2. Verificação de e-mail: auto-cadastro exige clicar no link de confirmação enviado ao @previ.com.br — garante que o e-mail existe. Admin pode criar conta diretamente (sem verificação), pois já sabe que o e-mail é real.\n3. Bloqueio pelo admin: se o cadastro estiver marcado como bloqueado, o sistema desloga a pessoa na hora e exibe "Acesso desativado". Admin pode bloquear/desbloquear na aba Cadastrados.\n4. Proteção no servidor: o banco de dados só entrega informação para quem está autenticado com e-mail @previ.com.br — nenhuma parte dele é pública. Mesmo quem tentar acessar o banco por fora, sem passar pelo site, é recusado.\n5. Confirmação obrigatória: Conteúdos e Treinamento Jedi só abrem para quem o admin confirmou numa turma — só demonstrar interesse não basta.' },
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
    { section: 'admin', personas: ['admin'],
      title: 'Lista de espera — data e hora de cada registro',
      body: 'A lista tem duas colunas de data, lado a lado: DATA INTERESSE (quando a pessoa manifestou interesse — é a que define a ordem da fila) e DATA REMOÇÃO (quando ela saiu da turma e entrou aqui). As duas trazem data E hora no formato brasileiro (por exemplo, 10/08/2026 12:26); a hora sempre esteve guardada, antes a tela mostrava só a data e ainda no formato do banco. Quem entrou direto pelo card do site não saiu de turma nenhuma, então aparece com traço na data de remoção. Antes a data da migração ficava dentro da célula de Origem, misturada com a turma e o motivo: dava para ler uma linha, não para varrer a coluna e comparar quem espera há mais tempo. Detalhe técnico que vale saber ao mexer em datas neste site: uma data guardada sem hora seria interpretada como meia-noite no fuso de Greenwich e apareceria como 21h do DIA ANTERIOR aqui — por isso esse caso é tratado à parte e exibido sem hora, em vez de exibir uma hora inventada e um dia errado.' },
    { section: 'turmas', personas: ['logado', 'inscrito', 'admin'],
      title: 'Lista de espera — entrar',
      body: 'Na página Turmas, o 4º card "Lista de Espera" aparece sempre (mesmo com turmas abertas), para capturar intenções contínuas. Logada pode clicar "Entrar na lista de espera" — dado salvo em fa-espera/ no Firebase. Quem está na lista mantém acesso de Logada (sem turma), não de Inscrita.' },
    { section: 'turmas', personas: ['logado', 'inscrito', 'admin'],
      title: 'Lista de espera — sair',
      body: 'Quem está na lista pode sair clicando "Na lista — Sair" no mesmo card. O registro é marcado como removed:true (não apagado, mantém histórico).' },
    { section: 'turmas', personas: ['admin'],
      title: 'Lista de espera — quem saiu da fila',
      body: 'Abaixo da lista há a seção recolhida "Saíram da fila", com quem já esteve na fila e não está mais: nome, área, data do interesse, origem, quando saiu, destino (foi para uma turma ou saiu de vez) e o motivo, com o nome de quem tirou quando houver. Sair da fila NUNCA apaga o registro — ele fica no banco marcado como removido —, mas até então não havia como enxergá-lo, e portanto não havia como responder "e a fulana, que estava aqui?" nem conferir se alguém saiu por engano. É a mesma ideia do filtro "Removidos" que as turmas já têm. Quem entrou pelo card do site aparece com a origem "Entrou pela lista", e o bloco de conferência conta essas entradas incluindo as que já saíram — porque a pergunta "alguém entrou direto pela lista?" não se responde olhando só quem continua esperando.' },
    { section: 'turmas', personas: ['admin'],
      title: 'Lista de espera — conferência da fila',
      body: 'Acima da Lista de Espera há um bloco que explica por que a soma dos filtros "Foram para a espera" das turmas NÃO bate com o tamanho da fila. São contagens diferentes por construção: a fila guarda uma entrada por PESSOA, e cada turma registra uma saída por TURMA — quem foi mandada para a fila a partir de duas turmas conta duas vezes lá e uma aqui. O bloco mostra os dois números lado a lado (saídas registradas nas turmas e pessoas distintas nelas) e reparte essas saídas em cinco situações: com entrada correspondente na fila, já foram da fila para uma turma, foram removidas da fila, engolidas por uma migração posterior, e sem rastro na fila. As duas últimas aparecem em vermelho porque são perda real: mandar alguém para a fila grava o registro inteiro por cima do anterior, apagando a turma de origem, o motivo e a data do primeiro interesse — que é justamente o que define a ordem de chegada. O detalhe embaixo nomeia essas pessoas, de qual turma saíram, e com que turma e data a fila ficou.' },
    { section: 'turmas', personas: ['admin'],
      title: 'Lista de espera — uma linha por turma de origem',
      body: 'A fila guarda um registro por PESSOA e por ORIGEM: a turma de onde ela saiu, ou "entrou pela lista" para quem se inscreveu pelo card do site. Quem passou por duas turmas aparece duas vezes, cada linha com a data do interesse daquela turma — é isso que responde há quanto tempo a pessoa vem tentando. Sair da MESMA turma duas vezes continua sendo um registro só, e fica com a data mais antiga das duas, para um segundo clique não custar o lugar dela na fila. Antes havia um registro por pessoa: a segunda migração escrevia por cima da primeira e levava junto a data do interesse original, que é o que ordena a fila. O selo do título conta PESSOAS; quando os dois números diferem, a linha ao lado abre "N pessoas · M registros". Tirar alguém da fila — pelo "Remover da lista", pelo "Mover para turma" ou pelo botão do próprio site — vale para TODAS as linhas dela: quem foi inscrita numa turma ou desistiu não está mais esperando por origem nenhuma, e deixar uma sobrando faria você chamá-la de novo.' },
    { section: 'turmas', personas: ['admin'],
      title: 'Lista de espera — mover para turma',
      body: 'Na aba Cadastrados do painel admin, a seção "Lista de Espera" mostra quem está aguardando. O admin escolhe a turma num select e clica "Mover para turma" — a pessoa é adicionada à turma já como Inscrita (confirmada) e sai da lista de espera automaticamente. Ela ganha o mesmo acesso de quem foi confirmado manualmente.' },
    { section: 'turmas', personas: ['admin'],
      title: 'Lista de espera — remover sem mover',
      body: 'Na seção Lista de Espera do painel admin, o botão "Remover da lista" tira a pessoa sem movê-la para turma nenhuma. Ao clicar, é obrigatório escolher o motivo: Desistiu / não tem mais interesse, Já participou de uma turma (aqui você escolhe QUAL turma ela já fez, igual à saída da turma — e se o sistema conhecer uma só, ela já vem escolhida), Não respondeu aos contatos, Evento encerrado, Registro duplicado ou Outro. Escolhendo "Outro", abre um campo de texto que também precisa ser preenchido — assim nunca fica registro sem justificativa. O motivo é gravado junto com a data e o nome de quem removeu.' },
    { section: 'admin', personas: ['admin'],
      title: 'Sair da turma — um caminho só, sempre com motivo',
      body: 'Existe um único botão para tirar alguém da turma: "Remover". Ele abre um modal que pede o MOTIVO e pergunta se a pessoa vai para a lista de espera. Antes eram dois botões para a mesma decisão — "→ Espera" e "Remover" — com listas de motivo que se sobrepunham; na prática, ir para a espera sempre foi remover por um motivo. Os motivos são: a pedido da própria pessoa; vai fazer em outra turma (aqui você escolhe QUAL, senão o registro não diz para onde ela foi); turma sem vagas; substituída por outra pessoa (aqui você escolhe QUEM ficou com a vaga); a data não serviu; já participou de uma turma (aqui você escolhe QUAL turma ela já fez — e se o sistema conhecer uma só, ela já vem escolhida); registro de teste;  não respondeu aos contatos; registro duplicado; evento encerrado; outro (com descrição obrigatória). O histórico de presença nunca é apagado.' },
    { section: 'admin', personas: ['admin'],
      title: 'Colocar na lista de espera é decisão sua',
      body: 'Dentro do modal de remoção existe a caixa "Colocar na lista de espera", que já vem MARCADA. A leitura é essa: quem sai da turma quase sempre continua querendo fazer, então o caminho normal é a fila — e quem não quer, desmarca. Antes a caixa vinha marcada só em alguns motivos, o que fazia a decisão depender de lembrar quais eram. Continua não sendo automático: a caixa está à vista e a palavra final é sua, uma pessoa por vez. A única exceção é o motivo "Vai fazer em outra turma": ali a caixa some, porque a turma de destino JÁ é o destino — pôr na fila ao mesmo tempo se contradiz e faria o registro da turma escolhida se perder. IMPORTANTE: a lista de espera recebe sempre a DATA E HORA DO INTERESSE ORIGINAL, nunca a data da remoção — é isso que preserva a ordem de chegada na fila.' },
    { section: 'admin', personas: ['admin'],
      title: 'Substituída — por quem entrou no lugar',
      body: 'Escolher o motivo "Substituída por outra pessoa" ao remover alguém abre uma segunda pergunta: QUEM entrou no lugar dela. Aparece a lista das pessoas da própria turma, e há a opção de digitar um nome para quem ainda não está cadastrada ali. Sem isso, o histórico não responde "quem entrou no lugar de quem", que é a pergunta que aparece depois — por isso cancelar essa pergunta desiste da remoção inteira, em vez de gravar meia informação. O nome de quem entrou fica gravado com a pessoa e aparece na lista de quem saiu: a coluna Destino mostra o selo "Substituída" e a coluna Motivo traz "Substituída por Fulana". Substituição é um caminho de SAÍDA, não uma marca em quem fica: quando outra pessoa assume a vaga, a decisão sobre a primeira já foi tomada. Como em qualquer remoção, a caixa "colocar na lista de espera" vem marcada — e dá para desmarcar.' },
    { section: 'admin', personas: ['admin'],
      title: 'Filtros da turma — cada pessoa em um grupo só',
      body: 'Os filtros acima da lista separam TODAS as pessoas que manifestaram interesse pela turma, e cada uma cai em exatamente um grupo: TODOS OS INTERESSADOS (o total, incluindo quem já saiu — é o número que responde quantas pessoas quiseram participar); CONFIRMADOS; AGUARDANDO DECISÃO (nem confirmada, nem removida: é o grupo que exige ação sua); FORAM PARA A ESPERA; FORAM PARA OUTRA TURMA (encaminhadas, com o nome da turma de destino); e REMOVIDOS (saíram de vez). Na lista de quem saiu existe uma coluna DESTINO, com um selo dizendo para onde a pessoa foi — antes essa informação ficava espremida dentro do texto do motivo, e não dava para responder de bate-pronto quem foi para outra turma e qual. Essa lista traz as DUAS datas: DATA INTERESSE (quando a pessoa manifestou interesse pela turma) e DATA REMOÇÃO (quando saiu). Só a data de saída não diz há quanto tempo ela esperava, que é o que pesa na hora de chamar alguém da fila ou montar a próxima turma. A soma dos grupos sempre fecha com o total. Antes, quem tinha saído ficava fora da conta, escondido num acordeão. A barra de filtros só aparece quando há mais de um grupo com gente.' },
    { section: 'turmas', personas: ['admin'],
      title: 'Lista de espera — migrar da turma',
      body: 'A ida para a lista de espera é uma caixa DENTRO do modal de "Remover" — "Colocar na lista de espera (mantém a data original do interesse)" —, não um botão próprio na linha. Marcando a caixa, a pessoa sai da turma e entra na fila; sem marcar, ela só sai. O motivo é o mesmo já escolhido para a remoção, e a caixa vem marcada por padrão em todos eles — menos em "vai fazer em outra turma", onde ela nem aparece, já que a turma de destino é o próprio destino. A data preservada na lista de espera é a data original em que ela manifestou interesse na turma — não o momento da migração. Na lista de espera, a coluna "Origem" mostra de qual turma a pessoa veio (ex: "↩ Turma 1 — Agosto") e, abaixo, o motivo escolhido na migração; a data da saída fica na coluna DATA REMOÇÃO, ao lado da data do interesse. Quem entrou direto pelo card do site aparece como "Entrou pela lista". Útil quando a turma está cheia e o admin precisa realocar pessoas para a próxima.' },
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
    { section: 'inicio', personas: ['logado', 'inscrito', 'admin'],
      title: 'Botão final da página — "Ver turmas"',
      body: 'A página termina com um único botão "Ver turmas →" que navega para a página Turmas. Funciona igual para todos os perfis autenticados — o objetivo é direcionar para inscrição.' },
    { section: 'inicio', personas: ['logado', 'inscrito', 'admin'],
      title: 'Botão "Conhecer a iniciativa"',
      body: 'Rola a página para a seção "O que é a Força Ágil". Funciona igual para todos os perfis autenticados.' },
    { section: 'inicio', personas: ['logado', 'inscrito', 'admin'],
      title: 'Crawl de abertura — animação',
      body: 'Texto introdutório em estilo Star Wars sobe lentamente ao entrar na Home. Aparece para qualquer pessoa devidamente logada — não precisa estar confirmada em turma nem ter manifestado interesse. Basta ter entrado com e-mail @previ.com.br já confirmado (pelo link enviado no cadastro ou pela liberação do admin). Visitante não vê, porque sem login o site inteiro fica oculto atrás da janela de autenticação.' },
    { section: 'inicio', personas: ['logado', 'inscrito', 'admin'],
      title: 'Crawl — botão "⏸ Pausar"',
      body: 'Pausa/retoma a animação. Equivalente a clicar na área da animação. Fica lado a lado com os outros dois botões de controle, logo abaixo da animação.' },
    { section: 'inicio', personas: ['logado', 'inscrito', 'admin'],
      title: 'Crawl — botão "≡ Ler texto"',
      body: 'Exibe o texto parado, sem efeito de profundidade. Botão "✕ Fechar texto" volta para a animação.' },
    { section: 'inicio', personas: ['logado', 'inscrito', 'admin'],
      title: 'Crawl — botão "↻ Repetir abertura"',
      body: 'Reinicia a animação do início.' },
    { section: 'inicio', personas: ['logado', 'inscrito', 'admin'],
      title: 'Card "Como funciona" → Conteúdos',
      body: 'Bloco informativo (sem link, sem hover, sem cursor de seleção) logo abaixo do topo da página — não navega para lugar nenhum ao clicar.' },
    { section: 'inicio', personas: ['logado', 'inscrito', 'admin'],
      title: 'Card "Como funciona" → Repositório',
      body: 'Bloco informativo (sem link, sem hover, sem cursor de seleção) logo abaixo do topo da página — não navega para lugar nenhum ao clicar.' },
    { section: 'inicio', personas: ['logado', 'inscrito', 'admin'],
      title: 'Card "Como funciona" → Treinamento Jedi',
      body: 'Bloco informativo (sem link, sem hover, sem cursor de seleção) logo abaixo do topo da página — não navega para lugar nenhum ao clicar.' },
    { section: 'inicio', personas: ['logado', 'inscrito', 'admin'],
      title: 'Link no rodapé para previ.com.br',
      body: 'Abre o site da Previ em nova aba (link externo). Visível para qualquer pessoa autenticada. Presente no rodapé de todas as páginas, não só Início.' },
    { section: 'inicio', personas: ['logado', 'inscrito', 'admin'],
      title: 'Botão do hero — "Ver turmas"',
      body: 'O botão grande no topo da Home diz "Ver turmas →" e leva para a página Turmas.' },

    /* ── TURMAS ── (ordem alinhada ao fluxo real da página e ao mapa.js) */
    { section: 'turmas', personas: ['logado', 'inscrito', 'admin'],
      title: 'Acesso geral — mesma página para todos os perfis',
      body: 'A página Turmas mostra as mesmas turmas para todo mundo que está autenticado (logado, inscrito ou admin) — nenhuma é escondida por perfil. Cada card mostra nome, mês, datas e horário (9h – 13h). O estado do card muda automaticamente conforme as datas e ações do admin — 4 estados possíveis: (1) interesse aberto: botão "Tenho interesse"; (2) interesse encerrado mas turma ainda não iniciou: "Inscrições encerradas — as vagas desta turma já foram preenchidas. Ela será realizada em [datas]. Acompanhe as próximas turmas para participar.", sem botão; (3) em andamento: a partir do primeiro dia da turma, o card troca automaticamente para "Turma em andamento · As aulas estão acontecendo", sem nenhum botão — independente de o interesse ter sido encerrado ou não; (4) realizada: após o último dia OU quando o admin clica "Encerrar turma", o card mostra "Turma realizada · Esta turma já foi concluída. Fique de olho nas próximas", sem botão. Abaixo dos cards (igual para todos os perfis): bloco "Como funciona a oficina" + Agenda D1–D5.' },
    { section: 'turmas', personas: ['logado', 'inscrito', 'admin'],
      title: 'Turma com interesse encerrado — inscrições encerradas (antes da turma iniciar)',
      body: 'Quando o admin encerra o interesse de uma turma e ela ainda não chegou ao primeiro dia, o card troca imediatamente para todo mundo: "Inscrições encerradas — As vagas desta turma já foram preenchidas. Ela será realizada em [datas]. Acompanhe as próximas turmas para participar." Sem botão. O card ANTES mandava a pessoa se inscrever no CMFlex, o que estava errado na prática: o interesse é encerrado justamente porque as vagas no CMFlex acabaram, então era mandar bater numa porta fechada. O CMFlex continua sendo indicado no momento certo — quando a pessoa registra interesse com a turma ainda aberta. Ninguém vira inscrita automaticamente: quem se inscreveu no CMFlex só passa a ter os privilégios de inscrita depois que o admin confirma manualmente.' },
    { section: 'turmas', personas: ['logado', 'inscrito', 'admin'],
      title: 'Turma em andamento — card automático a partir do primeiro dia',
      body: 'A partir da data do primeiro dia da turma, o card troca automaticamente — sem nenhuma ação do admin — para o estado "Em andamento": mostra "Turma em andamento" e a mensagem "As aulas estão acontecendo. Fique de olho nas próximas turmas!" Não há botão de interesse nem de CMFlex. Esse estado é detectado por data (hoje ≥ primeiro dia da turma) e acontece mesmo que o interesse ainda não tenha sido encerrado.' },
    { section: 'turmas', personas: ['logado', 'inscrito', 'admin'],
      title: 'Turma realizada — card automático após o último dia ou ação do admin',
      body: 'Há dois caminhos para o card mostrar "Turma realizada": (1) automaticamente, no dia seguinte ao último dia cadastrado da turma; (2) quando o admin clica "✓ Encerrar turma" (ver Admin). Em ambos os casos o card mostra "Turma realizada" e a mensagem "Esta turma já foi concluída. Fique de olho nas próximas!" sem nenhum botão. Essa é a última etapa — não há como "reabrir" uma turma já encerrada.' },
    { section: 'turmas', personas: ['logado', 'inscrito', 'admin'],
      title: 'Bloco "Como funciona a oficina"',
      body: 'Exibido antes da agenda D1–D5 para todos. Mostra 4 métricas (5 dias, 4h por encontro, dinâmicas práticas, participação opcional) e uma descrição geral.' },
    { section: 'turmas', personas: ['logado', 'inscrito', 'admin'],
      title: 'Agenda D1–D5 — itens estáticos',
      body: 'Os 5 dias da agenda são itens estáticos — nenhum perfil pode expandir. Mostram apenas os títulos dos dias, sem conteúdo interno.' },
    { section: 'turmas', personas: ['logado', 'inscrito', 'admin'],
      title: 'Se a sessão expirar com a página aberta',
      body: 'Se a pessoa ficar muito tempo com a página Turmas aberta e a sessão dela expirar, clicar em "Tenho interesse" não registra nada — aparece a mensagem "Faça login para registrar seu interesse." e a janela de login abre. Depois de entrar de novo, é preciso clicar no botão outra vez.' },
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
    { section: 'turmas', personas: ['logado', 'inscrito', 'admin'],
      title: 'Se a verificação inicial falhar, a pessoa não vê nenhum aviso',
      body: 'Ao abrir a página, o site checa se a pessoa já demonstrou interesse e se a turma já encerrou. Se a internet estiver instável ou lenta e essa checagem falhar, o card pode ficar desatualizado: continua mostrando "Tenho interesse" mesmo para quem já registrou, ou não avisa que a turma encerrou — e nenhum aviso de erro aparece na tela.' },
    { section: 'turmas', personas: ['logado', 'inscrito', 'admin'],
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
      body: 'Só acessa quem foi confirmado pelo admin em alguma turma, mais o próprio admin. Quem está logado mas ainda não foi confirmado não vê o link no menu, e também não entra digitando o endereço direto. As 7 seções numeradas (01 Mapa da Galáxia, 02 Os 4 Valores, 03 Os 12 Princípios, 04 A Força do Ágil, 05 Personagens, 06 Lado Sombrio, 07 A Trilogia) — cada uma ocupa a tela inteira, uma por vez.' },
    { section: 'conteudos', personas: ['inscrito', 'admin'],
      title: 'Navegação lateral por pontos',
      body: 'Barra lateral com 7 pontos (01–07), setas para cima/baixo e tooltip com o nome da seção. Ao clicar em um ponto, a página rola suavemente até a seção correspondente.' },
    { section: 'conteudos', personas: ['inscrito', 'admin'],
      title: 'Links externos "Ler na íntegra"',
      body: 'Nas seções dos 4 valores e dos 12 princípios, links abrem o Manifesto Ágil oficial (agilemanifesto.org) em nova aba.' },

    /* ── REPOSITÓRIO ── */
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
    { section: 'quiz', personas: ['inscrito', 'admin'],
      title: 'Acesso — apenas inscrito com turma confirmada',
      body: 'Só acessa quem foi confirmado pelo admin em alguma turma, mais o próprio admin (que entra mesmo sem estar em turma nenhuma). Quem está logado mas ainda não foi confirmado não vê o link no menu, e também não entra digitando o endereço direto.' },
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
    { section: 'ajuda', personas: ['logado', 'inscrito', 'admin'],
      title: 'Acesso',
      body: 'Página Ajuda visível para qualquer pessoa autenticada, sem exigir turma confirmada. No menu o link aparece como "Ajuda".' },
    { section: 'ajuda', personas: ['logado', 'inscrito', 'admin'],
      title: 'Acordeão de perguntas',
      body: 'A página tem perguntas frequentes exibidas em formato de acordeão: clicar no título expande ou recolhe a resposta, e cada pergunta abre de forma independente das outras. O texto acima do título é "Central de Ajuda" e o título principal é "Como podemos ajudar?". Abaixo do FAQ há a seção "Faça um pedido" — formulário para escolher o tipo (tema, curso, material, dúvida ou outros) e descrever o pedido.' },

    /* ── MINHA ÁREA ── */
    { section: 'minha-area', personas: ['admin'],
      title: 'Admin: ver a tela como o participante vê',
      body: 'O admin não participa das turmas, então a Minha Área dele mostra o estado de quem nunca interagiu — sem isso não havia como saber o que a tela mostra para quem fez o treinamento. No topo da página aparece, só para admin, o seletor "Ver esta tela como". Escolhendo uma pessoa, a tela inteira passa a mostrar exatamente o que ela vê: turmas, frequência, certificado, avaliação e pedidos, com um aviso deixando claro de quem é a tela. A lista traz todo mundo das turmas, sem repetir quem está em mais de uma, e mostra a situação ao lado do nome (confirmada, inscrita sem confirmação, interesse ou removida) — que é justamente o que se quer comparar. É SÓ VISUALIZAÇÃO: nada é gravado em nome da pessoa. Os botões de certificado funcionam de propósito, porque é o mesmo arquivo que o admin já emite na aba Certificados e vê-lo funcionando faz parte de conferir a tela.' },
    { section: 'minha-area', personas: ['logado', 'inscrito', 'admin'],
      title: 'Quem acessa a Minha Área',
      body: 'O link "Minha Área" aparece no menu para qualquer pessoa logada, mesmo sem estar confirmada em turma nenhuma. A página nunca fica vazia: sempre mostra o estado real da pessoa, e todo mundo consegue acompanhar os próprios pedidos por ali.' },
    { section: 'minha-area', personas: ['logado', 'inscrito', 'admin'],
      title: 'Os quatro estados da Minha Área',
      body: 'A página tem uma mensagem própria para cada situação, nesta ordem: (1) CONFIRMADA EM TURMA — os cartões das turmas, agrupados por fase; (2) INSCRIÇÕES EM ANÁLISE — a pessoa manifestou interesse mas a organização ainda não confirmou a vaga; o cartão diz desde quando o interesse está registrado e que a confirmação é feita pela organização. Se aquela turma já foi encerrada, o cartão avisa e orienta a procurar a organização pela página Ajuda; (3) LISTA DE ESPERA — a pessoa está na fila; o cartão diz desde quando espera e de qual turma veio, quando veio de alguma; (4) BOAS-VINDAS — quem nunca interagiu vê uma apresentação da área e a lista das turmas em que ainda dá para manifestar interesse, com botão para a página Turmas. Turma com o interesse já encerrado não entra nessa lista: ela está lotada, e convidar para ela seria mandar a pessoa a uma porta fechada. Também ficam de fora as que já começaram e as encerradas. Os três primeiros podem aparecer juntos: dá para estar confirmada numa turma, em análise em outra e na lista de espera ao mesmo tempo. O quarto só aparece quando não há nenhum dos outros.' },
    { section: 'minha-area', personas: ['inscrito', 'admin'],
      title: 'As três fases de uma turma',
      body: 'As turmas confirmadas vêm separadas em três grupos, nesta ordem — primeiro o que exige ação agora, depois o que vai acontecer, por último o histórico: EM ANDAMENTO (já começou e o admin ainda não encerrou), PROGRAMADAS (a data do primeiro encontro ainda não chegou) e CONCLUÍDAS (o admin encerrou a turma). Cada grupo mostra quantas turmas tem. A fase sai dos dados que já existem: turma encerrada pelo admin é concluída; senão, se a data do primeiro encontro é maior que hoje, é programada; fora isso, está em andamento.' },
    { section: 'minha-area', personas: ['inscrito', 'admin'],
      title: 'Turma programada não mostra frequência nem certificado',
      body: 'Uma turma que ainda não começou mostra, no lugar da barra de frequência e do bloco de certificado, a contagem para o início — "Faltam N dias", "Começa amanhã" ou "É hoje!" — junto da data do primeiro encontro e das datas de todos os encontros. O motivo: enquanto não há encontro nenhum, a frequência é necessariamente 0%, e exibir isso passaria a impressão de que a pessoa faltou a tudo. O aviso deixa claro que a frequência e o certificado aparecem ali assim que a turma começar.' },
    { section: 'minha-area', personas: ['inscrito', 'admin'],
      title: 'Minhas turmas e frequência',
      body: 'Para cada turma em andamento ou concluída, o cartão traz: o nome da turma e o selo da fase; o nome do evento e a carga horária; as datas dos encontros; e a frequência dela — uma barra de percentual, a contagem "X de Y encontros" e a lista dos dias, com ✓ nos que tiveram presença registrada. Junto vem o percentual mínimo exigido por aquele evento para ter direito ao certificado, para a pessoa saber sozinha se está dentro ou não.' },
    { section: 'minha-area', personas: ['inscrito', 'admin'],
      title: 'Baixar o próprio certificado',
      body: 'O certificado fica disponível para download (PNG ou PDF) quando duas condições se cumprem: a turma foi concluída pelo admin E a pessoa atingiu a frequência mínima do evento. Enquanto a turma não é concluída, aparece um aviso de que o certificado fica disponível ali depois. Se a turma acabou mas a frequência ficou abaixo do mínimo, a mensagem diz qual era a exigida e qual foi a dela — sem deixar a pessoa no escuro. O arquivo é gerado pelo mesmo mecanismo do painel Admin, então é idêntico ao que o admin emitiria.' },
    { section: 'minha-area', personas: ['inscrito', 'admin'],
      title: 'Situação da avaliação por turma',
      body: 'Cada cartão de turma mostra em que pé está a avaliação daquela turma: "Avaliação enviada" se a pessoa já respondeu; "Avaliação em aberto" com um botão para responder na hora, se o admin já liberou; ou um aviso de que ainda não foi liberada.' },
    { section: 'minha-area', personas: ['logado', 'inscrito', 'admin'],
      title: 'Meus pedidos',
      body: 'Lista os pedidos que a própria pessoa enviou pelo formulário "Faça um pedido" (página Ajuda), do mais recente para o mais antigo, com a data e o status: "Em análise" ou "Respondido". Pedidos excluídos pelo admin não aparecem. Quando está respondido, avisa que a resposta foi enviada por e-mail — o site não guarda o texto da resposta, já que ela é escrita e enviada pelo e-mail pessoal do admin.' },
    { section: 'minha-area', personas: ['logado', 'inscrito', 'admin'],
      title: 'Por que a Minha Área NÃO mostra o QR Code de check-in',
      body: 'Decisão deliberada de segurança. O QR Code do check-in é o mesmo todos os dias — o que controla se a presença vale é o admin abrir o dia no painel. Hoje ele funciona porque o admin projeta o QR na sala, então só quem está presente consegue escanear. Se cada pessoa tivesse esse QR na própria área, bastaria abri-lo de casa durante a janela de check-in para registrar presença sem ter comparecido. Como a frequência é justamente o critério que libera o certificado, isso corromperia o certificado que a mesma tela entrega.' },

    /* ── AVALIAÇÃO ── */
    { section: 'avaliacao', personas: ['inscrito', 'admin'],
      title: 'Uma resposta por pessoa, por turma — e quem pode ler',
      body: 'Cada pessoa responde uma única vez por turma. Isso é garantido pela própria forma como a resposta é guardada: ela fica sob a identificação da pessoa dentro da turma, então uma segunda resposta substituiria a primeira em vez de criar outra — duplicata é impossível. Na tela, assim que envia, o formulário dá lugar à mensagem de agradecimento, e continua assim se ela recarregar, voltar depois ou abrir em outro aparelho. Quem tem turmas diferentes com avaliação liberada responde uma para cada, usando o seletor de turma. LEITURA E GRAVAÇÃO: o banco só deixa a pessoa gravar na própria resposta — ninguém escreve por cima da avaliação de outro — e só administradores conseguem ler o conjunto das respostas. Cada participante lê apenas a sua. Antes, qualquer pessoa logada com e-mail da Previ conseguia, por fora da tela, ler todas as avaliações e sobrescrever qualquer uma; como as respostas anônimas ficam guardadas sob o e-mail de quem respondeu, isso valia inclusive para elas.' },
    { section: 'avaliacao', personas: ['inscrito', 'admin'],
      title: 'Quando o formulário avança sozinho de seção',
      body: 'O formulário só avança sozinho quando a nota é a ÚNICA pergunta da seção — o que hoje acontece apenas na seção 1. Nas seções que têm perguntas depois da nota (o motivo do NPS, o que mais gostou, o que gostaria de aprofundar, o que pretende aplicar), a seção fica aberta e quem decide quando sair é a pessoa, pelo cabeçalho de outra seção ou pelo botão \"Pular esta seção\". Antes ele avançava sempre que a nota principal era marcada: a pessoa dava a nota, a seção fechava sozinha 600ms depois e a tela pulava para a seguinte, obrigando a voltar para responder o resto — no celular era pior, porque a rolagem levava embora justamente o campo que ela ia preencher.' },
    { section: 'avaliacao', personas: ['inscrito', 'admin'],
      title: 'Quem vê a aba Avaliação',
      body: 'A aba "Avaliação" aparece no menu para quem foi confirmado numa turma E cuja turma teve a avaliação liberada pelo admin. Confirmado em turma que ainda não teve a avaliação liberada não vê a aba. O admin vê a aba sempre, mesmo sem ter liberado nada — para poder testar e revisar o formulário antes e depois de liberar para os inscritos. A visibilidade é verificada em tempo real ao carregar e a cada mudança de sessão.' },
    { section: 'avaliacao', personas: ['admin'],
      title: 'Admin navega por qualquer evento/turma na Avaliação',
      body: 'Ao abrir a aba Avaliação, o admin vê dois seletores no topo — "Evento" e "Turma" (mesmo padrão da aba Certificados) — em vez do fluxo de inscrito comum. Escolhendo evento e turma, o formulário daquela turma é carregado para revisão, mesmo que o admin não esteja pessoalmente inscrito e confirmado nela. Se o admin já tiver enviado uma resposta de teste para aquela turma antes, mostra a tela de agradecimento com um aviso de que é uma resposta de teste, que não afeta os dados reais dos inscritos. Se o admin preencher e enviar nesse modo, a resposta dele fica registrada como uma avaliação normal daquela turma — vale lembrar disso para não misturar respostas de teste com as reais.' },
    { section: 'avaliacao', personas: ['admin'],
      title: 'Admin libera e encerra a avaliação por turma',
      body: 'No painel Admin, aba Eventos, menu ⋯ de cada turma: o botão "📋 Liberar avaliação" abre o formulário para os confirmados daquela turma. Depois disso o botão vira "🔒 Encerrar avaliação", e clicar nele fecha de novo. A mudança aparece para a pessoa no próximo login ou quando ela recarregar a página.' },
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
      title: 'Rascunho automático — não perde o que já respondeu',
      body: 'O formulário salva sozinho o que a pessoa vai respondendo, sem precisar de botão de salvar. O rascunho fica guardado no próprio navegador dela e é separado por turma. Se ela fechar a aba, ou até fechar e reabrir o navegador, ao voltar encontra tudo como deixou. O rascunho só é apagado depois que ela envia a avaliação.' },
    { section: 'avaliacao', personas: ['inscrito', 'admin'],
      title: 'Identificação opcional',
      body: 'Antes do botão de envio há um checkbox "Quero me identificar nesta avaliação", desmarcado por padrão. Se marcado, o nome da pessoa é gravado junto com as respostas (campo nomeExibido) e fica visível para o admin. Se desmarcado (padrão), a avaliação é anônima — o admin não vê o nome, apenas as respostas e a turma.' },
    { section: 'avaliacao', personas: ['inscrito', 'admin'],
      title: 'Envio único por turma',
      body: 'Depois de enviar, aparece a tela de agradecimento e a pessoa não consegue responder de novo pela mesma turma. Se ela estiver confirmada em mais de uma turma com avaliação em aberto, o formulário da próxima turma carrega automaticamente logo após o envio.' },

    /* ── ADMIN ── */
    { section: 'admin', personas: ['admin'],
      title: 'Acesso — só quem está na lista de admins',
      body: 'O link "Admin" no menu e o painel só aparecem para quem é administrador — tanto os dois fixos do sistema quanto os cadastrados na aba Administradores. Logado e inscrito não veem o link; se acessarem #admin pela URL, recebem mensagem de acesso restrito com botão para voltar ao início.' },
    { section: 'admin', personas: ['admin'],
      title: 'Admin tem acesso total ao site, mesmo sem turma própria',
      body: 'Admin sempre vê e acessa Conteúdos e Treinamento Jedi no menu, mesmo sem estar inscrito em turma nenhuma. Ser admin já garante esse acesso por si só, independente de ela participar de alguma turma de verdade.' },
    { section: 'admin', personas: ['admin'],
      title: 'Navegação por abas — desktop e mobile',
      body: '11 abas no painel: Dashboard, Eventos, Certificados, Repositório, Cadastrados, Administradores, Manual, Mapa, Testes, Pedidos e Sorteios. No desktop ficam em linha única. No mobile podem quebrar em 2 linhas com fonte reduzida para todas ficarem visíveis sem scroll horizontal.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Dashboard — ler o que cada pessoa respondeu',
      body: 'No fim da aba, o bloco "Respostas individuais" mostra um cartão por avaliação, do mais recente para o mais antigo. Abrindo o cartão, aparecem TODAS as perguntas e o que foi registrado em cada uma: as notas, as escolhas múltiplas, os itens avaliados de organização e facilitadores, e os textos livres na íntegra. Há filtro por turma e por identificação (todas, só identificadas, só anônimas), a contagem do recorte e os botões abrir/fechar todas. Quem não marcou "Quero me identificar" aparece como Anônimo: as respostas aparecem completas, o nome e o e-mail não. A ordem das perguntas segue a do formulário, e um campo novo que ainda não esteja mapeado é listado no fim pelo próprio nome — assim uma pergunta acrescentada nunca fica invisível aqui.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Dashboard — como cada número é calculado',
      body: 'O próprio Dashboard traz um bloco retrátil "Como cada número desta tela é calculado", logo abaixo dos cards, com a memória de cálculo de tudo — para poder ser conferido na hora em que o número está sendo olhado. Os pontos que mais confundem: (1) MÉDIA GERAL e NPS vêm de PERGUNTAS DIFERENTES — a média é da nota da oficina (seção 1), o NPS é da pergunta de recomendação (seção 2); (2) o NPS não é média: é o percentual de quem deu 9 ou 10 menos o de quem deu de 0 a 6, vai de menos 100 a mais 100, e por isso não se compara com uma nota de 0 a 10; (3) o MEDIDOR de recomendação mostra a MÉDIA da pergunta de recomendação, não o NPS — são duas contas sobre a mesma pergunta, por isso os dois números diferem; (4) COMENTÁRIOS conta avaliações com pelo menos um dos três campos de texto preenchidos, não a quantidade de comentários escritos; (5) o percentual de participação é avaliações dividido por participantes confirmados — quem responde sem estar confirmado, como um admin testando, soma no primeiro número e não no segundo, então o percentual pode passar de 100 por cento; (6) PRINCIPAIS DESTAQUES sai só das notas por seção, nunca de texto livre, e a contagem de menções é quantas pessoas deram 8 ou mais naquela seção.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Dashboard',
      body: 'Primeira aba do painel — resumo das avaliações que as pessoas enviaram. No topo, cinco números: Participantes (total de gente confirmada em todas as turmas), Avaliações recebidas (com o percentual de quem respondeu), Média geral das notas, NPS de recomendação e quantidade de comentários escritos. Abaixo vêm os gráficos: a média de cada turma em barras, a distribuição das notas em cinco faixas de duas notas cada (0-2, 3-4, 5-6, 7-8 e 9-10 — a primeira carrega três porque a escala tem 11 pontos e não dá divisão exata; os cortes em 7 e em 9 são os mesmos do NPS ao lado) e um medidor com a média de recomendação. Sobre o NPS: ele não é uma média simples — é o percentual de quem deu nota 9 ou 10 menos o percentual de quem deu de 0 a 6, que é como esse indicador é calculado no mercado. Enquanto ninguém tiver respondido a avaliação, todos os cards e gráficos continuam aparecendo, zerados, com um aviso no topo explicando que ainda não chegou nenhuma resposta — assim fica claro que a tela funciona e só falta dado.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Dashboard — destaques e temas',
      body: '"Principais destaques dos feedbacks" sai das notas que as pessoas deram em cada parte da oficina (Organização, Conteúdo, Facilitadores, Dinâmicas e Aplicação prática). Cada uma mostra a média e quantas pessoas deram nota 8 ou mais, da mais bem avaliada para a menos. Ele NÃO lê os comentários escritos à mão — para transformar texto solto em categorias alguém teria que classificar um por um, ou o sistema teria que adivinhar por palavras-chave, o que erraria bastante. "Temas mais solicitados" vem da pergunta "Temas que você quer aprender" da avaliação, contando quantas vezes cada tema foi marcado, do mais pedido ao menos pedido. "Feedbacks em destaque" mostra os 3 comentários mais recentes da pergunta "O que devemos continuar fazendo", junto com a turma e o nome de quem escreveu — o nome só aparece se a pessoa marcou "Quero me identificar" ao responder; caso contrário aparece só "Participante".' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Eventos — visão geral',
      body: 'As turmas são organizadas por evento: cada evento é um container com título próprio e seus cards de turma dentro. Os containers de evento começam recolhidos (apenas o cabeçalho visível). As turmas dentro de cada evento também começam recolhidas (apenas o cabeçalho do card visível). Clicar no cabeçalho do evento expande/recolhe suas turmas; clicar no cabeçalho do card de turma expande/recolhe os participantes e ações. Turmas sem evento associado aparecem numa seção "TURMAS SEM EVENTO" ao final. Cada card de turma exibe: seta de toggle, selo ABERTA ou INTERESSE ENCERRADO, contagem "X interessados · Y confirmados · Z aguardando decisão", botões de ação e a lista de participantes ativos. "Interessados" é o total de pessoas que manifestaram interesse pela turma, incluindo quem já saiu; "confirmados" são as que têm status "inscrito"; "aguardando decisão" são as que continuam na turma sem confirmação — nem confirmadas, nem removidas. Quando há mais de um grupo com gente, aparece uma barra de filtros acima da tabela (Todos os interessados / Confirmados / Aguardando decisão / Foram para a espera / Foram para outra turma / Removidos, com a contagem de cada um) para exibir só o grupo escolhido. Cada pessoa cai em exatamente um grupo, e a soma dos cinco últimos fecha com "Todos". A lista é a mesma em qualquer estado; colunas de presença por dia aparecem quando o interesse já foi encerrado E há alguém confirmada na lista que está sendo exibida — num filtro só com gente não confirmada, como "Aguardando decisão", elas sairiam todas com traço e ainda empurrariam os botões para fora da tela. Quando elas aparecem, a coluna de ações fica colada na borda direita, para que Confirmar/Desconfirmar e Remover nunca fiquem escondidos atrás do rolamento horizontal.' },
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
      body: 'Botão global "↓ Histórico": exporta o log completo de ações em turmas-interesse-log — inclui ativos, removidos e todo histórico de interesse registrado/removido, adicionado/removido pelo admin, e confirmado/desconfirmado como inscrita. Coluna "Origem" preenchida com "Admin — nome" quando a ação foi executada por um admin; "Participante" quando a própria pessoa registrou ou removeu o interesse; "Não registrado" nas saídas antigas, que não guardaram o nome de quem removeu — antes essas linhas sumiam do arquivo. Há ainda as colunas "Motivo" e "Destino", preenchidas nas linhas de saída da turma.' },
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
      title: 'Aba: Sorteios — consulta de quem foi sorteado',
      body: 'Reúne todos os sorteios já feitos, de todas as turmas, do mais recente para o mais antigo. É onde se consulta depois quem foi sorteado, sem precisar abrir turma por turma. Cada linha traz quando foi, o evento, a turma, os nomes sorteados e quem fez o sorteio. Há dois filtros combináveis: por EVENTO e por TURMA — a lista de turmas se ajusta ao evento escolhido, e os filtros só oferecem eventos e turmas que realmente têm sorteio, para não levar a uma tela vazia. Acima da tabela aparece o resumo do filtro atual ("N sorteios · M pessoas sorteadas"). O botão "↓ Exportar CSV" baixa exatamente o que está filtrado, com uma linha por pessoa (e não vários nomes numa célula só), para poder filtrar e contar na planilha. ENSAIOS NÃO APARECEM AQUI: eles não são gravados. E o "Limpar histórico" feito na aba Eventos apaga os sorteios daquela turma também desta aba — por isso, quando o sorteio valer alguma coisa, convém exportar o CSV antes.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Eventos — sorteio da turma',
      body: 'No menu "⋯" de cada turma existe "🎲 Sorteio". QUEM ENTRA: apenas os participantes CONFIRMADOS daquela turma — exatamente as pessoas que aparecem no filtro "Confirmados" da tabela. Quem só manifestou interesse e ainda não foi confirmado nunca é sorteado, porque a confirmação é o que define quem de fato faz parte da turma. O botão fica desabilitado enquanto não houver nenhum confirmado. COMO FUNCIONA: escolhe-se quantas pessoas sortear de uma vez e se o sorteio deve pular quem já foi sorteado antes naquela turma (essa opção vem ligada). O modal mostra sempre quantas pessoas estão disponíveis para aquele sorteio. Ao sortear, os nomes passam girando na tela e param nos escolhidos. REGISTRO: cada sorteio fica gravado com os nomes sorteados, a data e a hora e quem fez o sorteio; o histórico aparece no próprio modal, do mais recente para o mais antigo. Dá para limpar o histórico — e aí todo mundo volta a poder ser sorteado. MODO VIGENTE SEMPRE DECLARADO: uma faixa no topo do modal diz o tempo todo o que vai acontecer — verde, "Sorteio para valer — o resultado será registrado no histórico desta turma e na aba Sorteios", ou âmbar, "Ensaio — nada será registrado e ninguém sai do sorteio de verdade". O botão acompanha ("Sortear para valer" / "Ensaiar (não vale)"), assim como o palco antes de sortear. Depois de um sorteio válido, a confirmação "✓ Registrado no histórico desta turma e na aba Sorteios" só aparece quando o banco confirmou a gravação; se falhar, avisa para anotar os nomes e repetir. ENSAIO: existe a opção "Ensaio — não registra no histórico e não vale como sorteio", para testar a mecânica antes de valer. Com ela marcada, o modal inteiro muda de cor, o botão passa a dizer "Ensaiar (não vale)", o resultado aparece marcado como ensaio e NADA é gravado — ninguém entra no histórico e ninguém deixa de concorrer no sorteio de verdade depois. A opção vem desmarcada: um sorteio só é ensaio se for pedido explicitamente. SORTEIO JUSTO: o embaralhamento usa a fonte de números aleatórios criptográfica do navegador, não o sorteio comum, para que o resultado não seja previsível.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Eventos — a tela não se recolhe a cada ação',
      body: 'Toda ação na aba Eventos (registrar ou remover presença, confirmar ou desconfirmar inscrição, remover alguém da turma, abrir e fechar check-in) recarrega os dados do banco e redesenha a aba. A tela guarda o que estava aberto e devolve tudo no lugar: quais eventos estavam expandidos, quais turmas estavam expandidas, o filtro de status escolhido em cada turma, o acordeão de "Removidos", o filtro "Ver evento" e o ponto exato da rolagem. Sem isso, registrar a presença de uma pessoa recolhia o evento e a turma e jogava a página para o topo — inviável para marcar presença de 20 pessoas seguidas. Só a primeira carga mostra "Carregando dados…"; nas recargas o conteúdo não pisca.' },
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
      title: 'Aba: Eventos — quem está aguardando decisão',
      body: 'Cada linha com status "Interessado" tem duas ações, e só duas: "Confirmar" e "Remover". Não existe um estado intermediário — alguém marcada como "não vai ser confirmada" mas ainda parada na turma. Se a turma lotou, se a pessoa já participou de outra turma, ou se outra pessoa ficou com a vaga dela, isso é razão para confirmar ou para remover, e o motivo é registrado na hora da remoção (ver "Saída da turma"). Enquanto nenhuma das duas ações acontece, a pessoa aparece no filtro "Aguardando decisão", que é justamente a lista do que ainda depende de você. Existiu aqui um seletor "Justificar…" que gravava o motivo sem tirar a pessoa da turma; registros anteriores a essa mudança ainda mostram o selo antigo ao lado do status, mas nada grava mais esse campo, e essas pessoas contam como aguardando decisão.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Eventos — remover participante',
      body: 'Botão "Remover" (disponível para linhas Interessado ou Inscrito, com a turma aberta ou com interesse encerrado): abre um modal de confirmação. Ao confirmar, registra quem e quando removeu, e a pessoa some da lista de participantes ativos imediatamente. Diferente de "faltou a um dia" — é uma remoção da turma, não uma ausência. Os check-ins já registrados não são apagados: a pessoa passa a aparecer na seção "Removidos" da própria turma, com o histórico de presença preservado quando ela era inscrita (ver regra abaixo).' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Eventos — pessoa removida pode ser readicionada',
      body: 'Não existe bloqueio pra impedir que alguém removido volte a ter um registro ativo na mesma turma: se o interesse ainda estiver aberto, a própria pessoa pode clicar em "Tenho interesse" de novo pelo site; em qualquer estado da turma, o admin pode readicioná-la pelo "＋ Participante" (escolhendo Interessada ou Inscrita). Em ambos os casos um novo registro substitui o antigo e ela some da seção "Removidos", voltando pra lista de participantes ativos — o evento de remoção anterior continua no CSV "Histórico" (turmas-interesse-log), que nunca é apagado.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Eventos — seção "Removidos"',
      body: 'Aparece em qualquer card de turma (interesse aberto ou encerrado) só quando há pelo menos uma pessoa removida. Mostra nome, e-mail, área, DATA INTERESSE, DATA REMOÇÃO, destino e o motivo — tudo só leitura, sem botões de ação. Abaixo do motivo vem quem tirou a pessoa da turma, e isso é dito só quando está gravado: "por Fulana" (o painel grava o nome de quem removeu) ou "pela própria pessoa" (tirar o interesse pelo site grava status "removido"; nenhum outro caminho grava). Sem nenhum dos dois, o motivo aparece como "motivo não registrado" e nada é afirmado sobre quem removeu — é o caso das remoções anteriores à exigência de motivo. Antes a tela escrevia "Removida pelo admin" sempre que o motivo estava vazio, o que atribuía ao admin remoções que a própria pessoa tinha feito. Quando o motivo está em branco aparece também um botão "+ registrar motivo": ele abre a mesma lista de motivos da remoção e preenche só esse campo — a saída, a data e o destino não mudam. Serve para as saídas anteriores à exigência de motivo e para quem saiu pelo site, que não pergunta nada. O que for preenchido assim fica marcado como "motivo registrado depois por Fulana", porque motivo anotado dias depois não é a mesma coisa que motivo capturado na hora. Existe uma segunda lacuna, e ela também ganha botão: três motivos pedem uma informação a mais — "já participou de uma turma" (qual), "vai fazer em outra turma" (qual) e "substituída" (quem) — e um registro antigo pode ter o motivo sem essa parte. Nesse caso aparece "+ completar motivo": o modal abre com o motivo já escolhido e TRAVADO, e você preenche só o que falta; a linha passa a dizer "motivo completado depois por Fulana". Fora essas duas lacunas não há botão nenhum: escolha já registrada e completa não se reescreve por aqui. Cada linha de quem saiu tem também "🗑 excluir registro", que é OUTRA coisa e não se confunde com remover: apaga de vez o registro daquela pessoa NAQUELA turma, junto com o histórico e as presenças dela ali. Ela some da lista de quem saiu e sai da contagem de interessados. Serve para o que nunca foi uma inscrição de verdade — registro de teste ou duplicado —, que a remoção comum não resolve, já que quem é removida continua contando no total e acaba inflando o número que você usa para planejar a próxima turma. Não pode ser desfeito, e por isso só aparece depois da remoção: excluir de vez exige duas decisões separadas. O cadastro da pessoa e os registros dela em outras turmas não são tocados. As colunas por dia e a de frequência só entram quando alguém do grupo de fato tem presença registrada: quem saiu sem nunca ter sido confirmada não tem check-in nenhum, e a tabela virava colunas de traço empurrando motivo e destino para fora da tela. Havendo presença, ela aparece com os mesmos selos "✓ qr" / "✓ adm" da lista de participantes — o histórico de quem participou e depois saiu não se perde.' },
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
      body: 'Os 6 campos dinâmicos e suas configurações atuais (sistema 1448×1086): (1) nomeParticipante — x:724 y:385 maxW:1041 fonte:55/28px italic branco centralizado; (2) nomeEvento — x:724 y:535 maxW:920 fonte:29/13px bold caixa-alta dourado espaçamento:3 centralizado; (3) identificacaoTurma — x:724 y:581 maxW:680 fonte:19/12px normal dourado-escuro centralizado — valor = turma.label exatamente como cadastrado pelo admin (sem acréscimo automático de mês/ano); (4) periodoTurma — x:598 y:658 maxW:400 fonte:24/13px normal branco-claro alinhado-esquerda; (5) cargaHoraria — x:613 y:757 maxW:160 fonte:48/24px bold dourado centralizado, com o "h" acrescentado pelo layout (o valor gravado no evento é só o número, ex: 20); (6) dataEmissao — x:1055 y:922 maxW:360 fonte:19/10px italic dourado alinhado-esquerda, prefixo fixo "Emitido em ". NÃO alterar estas coordenadas sem aprovação e atualização desta documentação.' },
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
      body: 'O painel só começa a buscar os dados depois que o sistema termina de confirmar quem está logado. Isso importa porque, ao abrir o endereço do Admin direto (link salvo, F5 ou digitando na barra), a página tentava carregar antes dessa confirmação ficar pronta — e aí TODAS as abas ficavam presas em "Carregando…" para sempre, sem nenhuma mensagem de erro. Entrar no Admin clicando pelo menu funcionava normalmente, porque nesse caminho a confirmação já tinha acontecido antes. Era justamente isso que fazia o problema aparecer só às vezes. Pelo mesmo motivo, o aviso "Acesso Restrito" começa oculto e só aparece depois que o sistema confirma que a pessoa não é administradora — antes ele ficava visível por padrão, e o próprio admin via o aviso piscando enquanto a página carregava.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Administradores — tratamento de erro na leitura',
      body: 'Se a busca da lista de administradores falhar (sem permissão, internet instável ou sessão expirada), a aba mostra "Erro ao carregar administradores. Recarregue a página ou verifique sua conexão." em vermelho, em vez de ficar travada indefinidamente em "Carregando administradores…" sem explicação.' },
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
      /* O subgrupo sai do prefixo do título: "Aba: Manual e Mapa — …" criava
         um subgrupo próprio "ADMIN · MANUAL E MAPA" com uma regra só, ao lado
         de MANUAL e de MAPA. A regra é sobre o Manual — fica nele. */
      title: 'Aba: Manual — subgrupos dentro da categoria ADMIN',
      body: 'A categoria ADMIN reúne itens de todas as 11 abas do painel — para não virar uma lista única confusa, é subagrupada automaticamente por aba a partir do prefixo "Aba X — " de cada título (regex: itens sem esse prefixo caem em "ADMIN · GERAL"). Cada subgrupo (ex: "ADMIN · EVENTOS") mostra sua própria contagem entre parênteses e é retrátil — clicar no subcabeçalho abre/fecha só aquele grupo, sem precisar abrir a categoria ADMIN inteira de uma vez. "Expandir tudo"/"Recolher tudo" também abrangem os subgrupos.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Mapa',
      body: 'Mostra cinco seções: (1) Hierarquia de Personas — o que cada perfil consegue fazer; (2) Acesso por Tipo de Pessoa — tabela com o que cada perfil vê/acessa em cada página; (3) Mapa do Site — 13 seções com suas funcionalidades e o perfil mínimo de cada uma. Atenção ao número: são as 9 páginas do menu (Início, Turmas, Conteúdos, Repositório, Treinamento Jedi, Avaliação, Minha Área, Ajuda e Admin) MAIS 4 seções que não são páginas do menu — Check-in (aberta pelo QR Code), Entrar e Cadastrar (abas do modal de login) e Menu / Sessão (a barra de navegação em si). Por isso o total não bate com a contagem de links do menu; (4) Arquitetura Técnica e Regras Operacionais — acordeão com tecnologias, módulos, padrões de código, padrões de UX, deploy e regras de governança; (5) Diagrama da Arquitetura — visão visual gerada automaticamente a partir dos dados da Arquitetura Técnica.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Mapa — estrutura dos dados em mapa.js',
      body: 'A aba Mapa é organizada em dois grupos de conteúdo: um descreve o que o sistema é — Linguagens, Tecnologias & Serviços, Estrutura de Arquivos, Padrões de Código, Padrões de UX, Glossário de UX/Design e Deploy — exibido como "Arquitetura Técnica" e usado no Diagrama. O outro descreve como o sistema deve ser mantido — Deploy (processo), Cache e Autonomia — exibido como "Regras Operacionais".' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Testes',
      body: 'Roda os testes automatizados (técnicos e de comportamento) e exibe o checklist de regras que exigem validação manual.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Pedidos',
      body: 'Mostra os pedidos que as pessoas enviaram pelo formulário "Faça um pedido" (página Ajuda), do mais recente para o mais antigo. Cada pedido exibe o tipo, o texto escrito, o nome e o e-mail de quem enviou. A aba abre já filtrada em "Pendentes". Há dois filtros que funcionam juntos: em cima, por situação (Pendentes, Respondidos, Todos) e, separado deles, um botão de Lixeira que mostra só os excluídos. "Todos" mostra todos os pedidos ativos e nunca inclui os excluídos — quem quiser vê-los precisa entrar na Lixeira. Embaixo, o filtro por tipo (tema, curso, material, dúvida, outros), cujos números acompanham o filtro de cima: se você está vendo só os Pendentes, cada tipo mostra quantos pendentes existem daquele tipo, não o total geral.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Pedidos — responder um pedido',
      body: 'O botão "✉ Responder por e-mail" abre o seu programa de e-mail (Gmail, Outlook, o que estiver configurado no computador) já com tudo preenchido: o endereço de quem fez o pedido, o assunto "Força Ágil — resposta ao seu pedido", uma saudação com o primeiro nome da pessoa, uma cópia do pedido original com a data, e a assinatura "Um abraço, Equipe Força Ágil" (genérica, porque qualquer administrador pode responder). Você escreve a resposta e envia pelo seu próprio e-mail — o site não manda nada sozinho. Atenção: a maioria dos programas de e-mail abre com o cursor no fim do texto, ou seja, DEPOIS da assinatura. É preciso clicar acima dela para escrever no lugar certo.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Pedidos — marcar como respondido e prazo em dias úteis',
      body: 'Como o e-mail é enviado por fora do site, ele não tem como saber que você respondeu — por isso a marcação é manual. Ao clicar em "✓ Marcar como respondido", aparecem duas coisas: uma lista para escolher qual administrador respondeu e um campo de data e hora. A data já vem preenchida com o momento atual, mas pode ser alterada — útil quando você respondeu ontem e só está registrando agora. Depois de marcado, o pedido ganha os botões "✎ Editar" (para corrigir quem respondeu ou a data) e "✕ Desmarcar" (para voltar atrás). Cada pedido também mostra o tempo de resposta em dias úteis: enquanto está pendente aparece "Em aberto há X dias úteis", que fica laranja a partir de 2 dias; depois de respondido aparece em verde quem respondeu, quando, e quantos dias úteis levou. Só contam segunda a sexta — e, se o pedido chegou ou foi respondido num fim de semana, a contagem considera as 8h da segunda-feira seguinte.' },
    { section: 'admin', personas: ['admin'],
      title: 'Aba: Pedidos — excluir com justificativa',
      body: 'O botão "🗑 Excluir" pede duas informações obrigatórias: qual administrador está excluindo e o motivo da exclusão. Sem preencher as duas, o botão de confirmar não faz nada. O pedido não é apagado de verdade — ele sai da lista normal e vai para a Lixeira, onde continua visível com o nome de quem excluiu, a data e a justificativa. De lá, o botão "↺ Restaurar" traz o pedido de volta, e ele reaparece como Pendente ou Respondido, conforme estava antes de ser excluído.' },
    { section: 'menu', personas: ['logado', 'inscrito', 'admin'],
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
