/* Força Ágil — Mapa do Site + Hierarquia de Personas */
(function () {
  'use strict';

  const PERSONAS = [
    { key: 'visitante',  label: 'Visitante',                      color: '#888888', desc: 'Não cadastrado / não logado' },
    { key: 'logado',     label: 'Logado (sem turma confirmada)',      color: '#1ab2ae', desc: 'Cadastrado com @previ.com.br, sem inscrição confirmada pelo admin. Inclui quem já manifestou interesse — interesse não muda o acesso' },
    { key: 'inscrito',   label: 'Inscrito (turma confirmada pelo admin)', color: '#4caf7d', desc: 'Logado E confirmado pelo admin numa turma — destrava Conteúdos, Treinamento Jedi e Avaliação' },
    { key: 'admin',      label: 'Admin',                           color: '#6b7a99', desc: 'Usuário com acesso administrativo' },
  ];

  const HIERARCHY = [
    { key: 'visitante',   label: 'Visitante (antes de entrar)',      color: '#888888',
      adds: ['NÃO é um degrau da escada — é o estado ANTES de autenticar. Nada do que ele vê continua disponível depois: quem entra deixa de ver o modal de login.', 'Ver apenas o modal de login (site completamente oculto antes da autenticação)', 'Cadastrar conta (@previ.com.br) — recebe e-mail de verificação; acesso liberado só após clicar no link', 'Fazer login', 'Recuperar senha por e-mail (autoatendimento)'] },
    { key: 'logado',  label: 'Logado (sem turma confirmada)', color: '#1ab2ae',
      adds: ['Acessar Início, Turmas e Ajuda', 'Acessar o Repositório', 'Adicionar conteúdos e remover os próprios no Repositório', 'Manifestar interesse em quantas turmas existirem (sem limite fixo)', 'Remover interesse em turmas', 'Entrar na lista de espera para próximas turmas (acesso de Logado mantido enquanto aguarda)', '⚠️ Manifestar interesse NÃO muda o nível de acesso: quem clicou em "Tenho interesse" (status "interessado") vê exatamente as mesmas páginas de quem nunca clicou. A única diferença é o botão do card virar "Remover interesse". Por isso "interessado" não é uma persona separada — quem libera as páginas exclusivas é o admin confirmar a inscrição, não a pessoa manifestar interesse.'] },
    { key: 'inscrito', label: 'Inscrito (turma confirmada pelo admin)', color: '#4caf7d',
      adds: ['Acessar Conteúdos', 'Acessar Treinamento Jedi (autodiagnóstico 0–60)', 'Acessar Avaliação da Oficina (quando o admin libera a avaliação daquela turma)', 'Revelar patente (resultado fixo e bloqueado — não pode refazer sem reset do admin)', 'Exige status "inscrito" E o campo confirmedByAdmin preenchido — é isso que vira o nível "enrolled" no código e destrava as 3 páginas acima.'] },
    { key: 'admin',   label: 'Admin (marcação à parte, não é degrau)',          color: '#6b7a99',
      adds: ['NÃO é o degrau seguinte de Inscrito — é uma marcação paralela: quem é admin recebe o nível "enrolled" automaticamente, mesmo sem estar inscrito em turma nenhuma. Por isso enxerga Conteúdos, Treinamento e Avaliação sem precisar de confirmação de admin.', 'Acessar o Painel Admin (11 abas: Dashboard, Eventos, Certificados, Repositório, Cadastrados, Administradores, Manual, Mapa, Testes, Pedidos, Sorteios)', 'Criar, editar e excluir turmas; cadastrar link do CMFlex por turma', 'Confirmar/desconfirmar inscrição e adicionar/remover participantes manualmente', 'Abrir/fechar check-in, gerar QR Code e emitir certificados de participação', 'Exportar CSV (estado atual, histórico e por turma)', 'Moderar Repositório (ocultar, restaurar, deletar conteúdos)', 'Ver e gerenciar cadastrados (filtrar, redefinir senha, resetar progresso, criar conta diretamente com senha 12345678, confirmar cadastro manualmente para quem não recebeu o link de verificação de e-mail)', 'Gerenciar lista de espera: ver quem entrou, mover pessoa diretamente para uma turma como Inscrita ou remover da lista; migrar participante de uma turma para a lista de espera (caixa dentro do modal de "Remover" — data original de interesse é preservada)', 'Gerenciar lista de administradores (restrito a tatianefdirene e danielfrazao)', 'Consultar Manual, Mapa e Testes (documentação viva do sistema)'] },
  ];

  /* Diagrama de estados de turmas-interesse/<turma>/<emailKey> — ver regra
     "confirmar inscrição" e "adicionar participante" no Manual */
  const STATUS_DIAGRAM_SVG = `
    <svg viewBox="0 -110 900 500" xmlns="http://www.w3.org/2000/svg" style="width:900px;min-width:900px;height:auto;display:block;margin:0 auto" role="img" aria-label="Diagrama de estados de uma pessoa numa turma">
      <defs>
        <marker id="mapaArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#7f9bff"></path>
        </marker>
        <marker id="mapaArrowGold" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#f5c542"></path>
        </marker>
      </defs>

      <!-- Sem registro -> Interessada -->
      <line x1="196" y1="200" x2="308" y2="98" stroke="#7f9bff" stroke-width="2" marker-end="url(#mapaArrow)"></line>
      <text font-family="var(--font-mono)" font-size="11" fill="#7f9bff">
        <tspan x="120" y="141">"Tenho interesse" — Participante</tspan>
        <tspan x="120" y="156">"＋ Participante" → Interessada</tspan>
        <tspan x="120" y="171">— ação do Admin</tspan>
      </text>

      <!-- Sem registro -> Inscrita (atalho direto, admin) — passa alto, entra por cima da caixa Inscrita -->
      <path d="M108,178 C 300,-90 708,-90 708,50" fill="none" stroke="#f5c542" stroke-width="2" stroke-dasharray="6 5" marker-end="url(#mapaArrowGold)"></path>
      <text font-family="var(--font-mono)" font-size="11" fill="#f5c542">
        <tspan x="230" y="-98">"＋ Participante" → Inscrita — ação do Admin</tspan>
        <tspan x="230" y="-83">(atalho direto — checa outras turmas igual ao "Confirmar")</tspan>
      </text>

      <!-- Interessada -> Inscrita ("Confirmar") -->
      <line x1="496" y1="66" x2="616" y2="66" stroke="#4caf7d" stroke-width="2" marker-end="url(#mapaArrow)"></line>
      <text x="556" y="42" text-anchor="middle" font-family="var(--font-mono)" font-size="11" fill="#4caf7d">"Confirmar" — Admin</text>

      <!-- Inscrita -> Interessada ("Desconfirmar") -->
      <line x1="616" y1="100" x2="496" y2="100" stroke="#f5c542" stroke-width="2" marker-end="url(#mapaArrowGold)"></line>
      <text x="556" y="128" text-anchor="middle" font-family="var(--font-mono)" font-size="11" fill="#f5c542">"Desconfirmar" — Admin</text>

      <!-- Interessada -> Removida -->
      <line x1="402" y1="114" x2="500" y2="296" stroke="#7f9bff" stroke-width="2" marker-end="url(#mapaArrow)"></line>
      <text font-family="var(--font-mono)" font-size="11" fill="#7f9bff">
        <tspan x="330" y="198">"Remover interesse" — Participante</tspan>
        <tspan x="330" y="213">"Remover" — Admin</tspan>
      </text>

      <!-- Inscrita -> Removida -->
      <line x1="708" y1="114" x2="612" y2="296" stroke="#7f9bff" stroke-width="2" marker-end="url(#mapaArrow)"></line>
      <text font-family="var(--font-mono)" font-size="11" fill="#7f9bff">
        <tspan x="618" y="198">"Remover" — Admin (inclui automático</tspan>
        <tspan x="618" y="213">se confirmada ou adicionada como</tspan>
        <tspan x="618" y="228">Inscrita em outra turma)</tspan>
      </text>

      <!-- Removida -> Interessada (readicionada, direto) -->
      <path d="M480,296 Q 250,200 458,114" fill="none" stroke="#f5c542" stroke-width="2" stroke-dasharray="6 5" marker-end="url(#mapaArrowGold)"></path>
      <text font-family="var(--font-mono)" font-size="11" fill="#f5c542">
        <tspan x="70" y="360">Readicionada — "Tenho interesse" — Participante</tspan>
        <tspan x="70" y="375">(se turma aberta) ou "＋ Participante" → Interessada — Admin</tspan>
      </text>

      <!-- Removida -> Inscrita (readicionada, direto, admin) -->
      <path d="M636,296 Q 856,220 776,114" fill="none" stroke="#f5c542" stroke-width="2" stroke-dasharray="6 5" marker-end="url(#mapaArrowGold)"></path>
      <text font-family="var(--font-mono)" font-size="11" fill="#f5c542" text-anchor="end">
        <tspan x="895" y="360">Readicionada — "＋ Participante" → Inscrita — Admin</tspan>
        <tspan x="895" y="375">(mesma checagem de sobreposição do "Confirmar")</tspan>
      </text>

      <!-- Caixa: Sem registro -->
      <rect x="20" y="178" width="176" height="64" rx="10" fill="rgba(136,136,136,.1)" stroke="#888888" stroke-width="1.5"></rect>
      <text x="108" y="216" text-anchor="middle" font-family="var(--font-head)" font-size="13" letter-spacing="1" fill="#888888">SEM REGISTRO</text>

      <!-- Caixa: Interessada -->
      <rect x="308" y="50" width="188" height="64" rx="10" fill="rgba(26,178,174,.1)" stroke="#1ab2ae" stroke-width="1.5"></rect>
      <text x="402" y="88" text-anchor="middle" font-family="var(--font-head)" font-size="13" letter-spacing="1" fill="#1ab2ae">INTERESSADA</text>

      <!-- Caixa: Inscrita -->
      <rect x="616" y="50" width="184" height="64" rx="10" fill="rgba(76,175,125,.1)" stroke="#4caf7d" stroke-width="1.5"></rect>
      <text x="708" y="88" text-anchor="middle" font-family="var(--font-head)" font-size="13" letter-spacing="1" fill="#4caf7d">INSCRITA</text>

      <!-- Caixa: Removida -->
      <rect x="466" y="296" width="184" height="64" rx="10" fill="rgba(255,82,82,.1)" stroke="#ff5252" stroke-width="1.5"></rect>
      <text x="558" y="334" text-anchor="middle" font-family="var(--font-head)" font-size="13" letter-spacing="1" fill="#ff5252">REMOVIDA</text>
    </svg>
  `;

  /* Ordem alfabética por label, igual ao Manual e às Regras */
  const PAGES = [
    { label: 'ADMIN', color: '#6b7a99',
      features: [
        { label: '11 abas no total (Dashboard, Eventos, Certificados, Repositório, Cadastrados, Administradores, Manual, Mapa, Testes, Pedidos, Sorteios); no mobile quebram em 2 linhas', p: ['admin'] },
        { label: 'Aba Dashboard — bloco "Respostas individuais": um cartão retrátil por avaliação com TODAS as perguntas e o que foi registrado em cada uma (notas, escolhas múltiplas, sub-itens e textos na íntegra); filtros por turma e por identificação, contagem do recorte, abrir/fechar todas. Quem não se identificou aparece como Anônimo — as respostas aparecem, o nome não', p: ['admin'] },
        { label: 'Aba Dashboard — bloco retrátil "Como cada número desta tela é calculado", com a memória de cálculo de todos os indicadores na própria tela; explicita os que mais confundem: média geral e NPS vêm de perguntas diferentes, o medidor mostra a média da recomendação e não o NPS, e Comentários conta avaliações e não comentários', p: ['admin'] },
        { label: 'Aba Dashboard — visão geral das avaliações: cards de participantes, avaliações recebidas (%), média geral, NPS e comentários; gráfico de barras com média por turma; distribuição das notas da pergunta "que nota daria para a oficina" em 5 faixas regulares (0-2, 3-4, 5-6, 7-8, 9-10), com os mesmos cortes do NPS; gauge de recomendação; destaques por seção (calculado das notas estruturadas, não de texto livre); temas mais solicitados; amostra de feedbacks em destaque', p: ['admin'] },
        { label: 'Aba Eventos — turmas organizadas dentro de containers de evento; turmas sem evento ficam em "TURMAS SEM EVENTO"', p: ['admin'] },
        { label: 'Aba Eventos — criar evento (nome + carga horária + frequência mínima p/ certificado, padrão 75%)', p: ['admin'] },
        { label: 'Aba Eventos — editar evento (renomear, alterar carga horária, alterar percentual mínimo de frequência)', p: ['admin'] },
        { label: 'Aba Eventos — excluir evento (turmas dentro dele passam para "SEM EVENTO")', p: ['admin'] },
        { label: 'Aba Eventos — criar turma (nome + evento + datas dos encontros)', p: ['admin'] },
        { label: 'Aba Eventos — editar turma (renomear, incluir/excluir datas, trocar evento)', p: ['admin'] },
        { label: 'Aba Eventos — excluir turma (apaga turma e todos os dados ligados a ela)', p: ['admin'] },
        { label: 'Aba Eventos — containers de evento começam recolhidos; clique no cabeçalho expande/recolhe as turmas do evento', p: ['admin'] },
        { label: 'Aba Eventos — cards de turma começam recolhidos; clique no cabeçalho do card expande/recolhe participantes e ações', p: ['admin'] },
        { label: 'Aba Eventos — filtro "Ver evento:" no topo: exibe apenas o evento selecionado e o expande automaticamente; "Todos" restaura a visão geral', p: ['admin'] },
        { label: 'Expandir tudo — abre de uma vez todos os containers de evento e todos os cards de turma na aba Eventos (e itens retráteis nas demais abas)', p: ['admin'] },
        { label: 'Recolher tudo — fecha de uma vez todos os containers de evento e todos os cards de turma na aba Eventos (e itens retráteis nas demais abas)', p: ['admin'] },
        { label: 'Aba Eventos — cadastrar/editar link do CMFlex por turma (inscrição oficial externa)', p: ['admin'] },
        { label: 'Aba Eventos — encerrar interesse da turma (card público passa a exibir "Inscrições encerradas", quando a turma ainda não iniciou)', p: ['admin'] },
        { label: 'Aba Eventos — encerrar turma manualmente (marca como "Realizada" antes do prazo automático, grava dataConclusao e habilita downloads de certificado)', p: ['admin'] },
        { label: 'Aba Eventos — confirmar inscrição de um interessado a qualquer momento, turma aberta ou com interesse encerrado (marca como Inscrito, avisa e remove a inscrição em outra turma se ela já for inscrita lá — mero interesse em outra turma não é tocado)', p: ['admin'] },
        { label: 'Aba Eventos — desconfirmar inscrição de um inscrito a qualquer momento, turma aberta ou com interesse encerrado (volta a Interessado, perde acesso na hora)', p: ['admin'] },
        { label: 'Aba Eventos — reabrir interesse da turma (sem mexer em confirmações já feitas)', p: ['admin'] },
        { label: 'Aba Eventos — abrir check-in do dia (com confirmação do dia + aviso se diferente de hoje)', p: ['admin'] },
        { label: 'Aba Eventos — fechar check-in do dia', p: ['admin'] },
        { label: 'Aba Eventos — sortear pessoas na turma pelo menu "⋯" → "🎲 Sorteio". Só entram os participantes CONFIRMADOS: quem apenas manifestou interesse nunca é sorteado', p: ['admin'] },
        { label: 'Aba Eventos — no sorteio dá para escolher quantas pessoas sortear de uma vez e marcar "não repetir quem já foi sorteado nesta turma" (ligado por padrão)', p: ['admin'] },
        { label: 'Aba Eventos — o sorteio declara o tempo todo se vale ou é ensaio: faixa verde "Sorteio para valer — será registrado" ou faixa âmbar "Ensaio — nada será registrado", com o botão e o palco acompanhando; a confirmação "Registrado" só aparece depois que o banco gravou', p: ['admin'] },
        { label: 'Aba Eventos — modo "Ensaio" no sorteio: testa a mecânica sem registrar nada e sem tirar ninguém do sorteio de verdade; o modal muda de cor e o resultado aparece marcado como ensaio', p: ['admin'] },
        { label: 'Aba Eventos — cada sorteio fica registrado com os nomes, a data e hora e quem sorteou; o histórico aparece no próprio modal e pode ser limpo (aí todo mundo volta a poder ser sorteado)', p: ['admin'] },
        { label: 'Aba Eventos — o botão "🎲 Sorteio" fica desabilitado enquanto a turma não tiver nenhum participante confirmado', p: ['admin'] },
        { label: 'Aba Eventos — a tela não se recolhe a cada ação: depois de registrar presença, confirmar inscrição ou qualquer outra ação, o painel devolve os eventos e turmas que estavam expandidos, o filtro de status de cada turma, o acordeão de Removidos, o filtro "Ver evento" e o ponto da rolagem — dá para marcar presença de várias pessoas seguidas sem renavegar', p: ['admin'] },
        { label: 'Aba Eventos — gerar QR Code da turma', p: ['admin'] },
        { label: 'Aba Eventos — baixar QR Code de acesso ao site (com logotipo Força Ágil), para uso em cartazes/slides/materiais impressos', p: ['admin'] },
        { label: 'Aba Eventos — tabela de presença, registro manual', p: ['admin'] },
        { label: 'Aba Eventos — tabela de presença, remoção manual; as colunas de dia só entram quando a turma tem o interesse encerrado E há alguém confirmada na lista exibida, e a coluna de ações fica fixa na borda direita para não sumir atrás do rolamento', p: ['admin'] },
        { label: 'Aba Eventos — adicionar participante por busca em cadastros existentes, escolhendo o status (Interessada ou Inscrita); pessoa precisa ter cadastro prévio no site', p: ['admin'] },
        { label: 'Aba Eventos — quem não foi confirmada nem removida tem duas ações e só duas: "Confirmar" e "Remover". Não existe estado intermediário ("não vai ser confirmada, mas fica na turma") — turma lotada, já participou ou vaga assumida por outra pessoa são motivos de remoção, registrados na saída', p: ['admin'] },
        { label: 'Aba Eventos — remover participante (interessado ou inscrito), turma aberta ou com interesse encerrado', p: ['admin'] },
        { label: 'Aba Eventos — sair da turma tem UM caminho: o botão "Remover". O modal pede o motivo e pergunta se a pessoa vai para a lista de espera — antes eram dois botões ("→ Espera" e "Remover") para a mesma decisão, com listas de motivo que se sobrepunham', p: ['admin'] },
        { label: 'Aba Eventos — motivos de saída: A pedido da própria pessoa · Vai fazer em outra turma (escolhe QUAL) · Turma sem vagas · Substituída por outra pessoa (escolhe QUEM) · A data não serviu · Já participou de uma turma (escolhe QUAL ela já fez; turma já feita NÃO vira destino) · Registro de teste · Não respondeu · Registro duplicado · Evento encerrado · Outro', p: ['admin'] },
        { label: 'Aba Eventos — a ida para a lista de espera é uma caixa dentro da remoção, que vem MARCADA por padrão: quem sai da turma quase sempre continua querendo fazer, e quem não quer desmarca. Some no motivo "vai fazer em outra turma", que já é um destino. A fila recebe sempre a data e hora do interesse ORIGINAL, preservando a ordem de chegada', p: ['admin'] },
        { label: 'Aba Eventos — o motivo de saída "Substituída" pede dizer POR QUEM (lista as pessoas da turma ou aceita um nome digitado); cancelar essa pergunta desiste da remoção, para não gravar meia informação. O nome de quem entrou aparece na coluna Motivo de quem saiu', p: ['admin'] },
        { label: 'Aba Eventos — "🗑 excluir registro" nas linhas de quem saiu apaga de vez o registro da pessoa NAQUELA turma, com histórico e presenças dela ali; sai da contagem de interessados. É para teste e duplicado, não para saída normal — irreversível, e só aparece depois da remoção, exigindo duas decisões separadas. Cadastro e outras turmas não são tocados', p: ['admin'] },
        { label: 'Aba Eventos — quem saiu da turma tem coluna DESTINO com selo próprio (Lista de espera · nome da turma para onde foi · Substituída · Saiu), nas duas tabelas de quem saiu; antes o destino ia espremido dentro do texto do motivo e não dava para varrer a coluna', p: ['admin'] },
        { label: 'Aba Eventos — "Foram para outra turma" é um filtro separado de "Removidos": encaminhamento e saída de vez são situações diferentes', p: ['admin'] },
        { label: 'Aba Eventos — as tabelas de quem saiu mostram as DUAS datas: quando a pessoa manifestou interesse e quando foi removida; só a data de saída não diz há quanto tempo ela esperava', p: ['admin'] },
        { label: 'Aba Eventos — saída sem motivo gravado ganha o botão "+ registrar motivo", que preenche a lacuna depois sem mexer na saída, na data ou no destino; o que entra assim fica marcado como "motivo registrado depois por <nome>"', p: ['admin'] },
        { label: 'Aba Eventos — motivo registrado mas sem a informação que ele pede (qual turma já fez, para qual turma vai, quem substituiu) ganha "+ completar motivo": abre com o motivo travado e preenche só o que falta, marcando "motivo completado depois por <nome>". Motivo completo não tem botão — não se reescreve escolha registrada na saída', p: ['admin'] },
        { label: 'Aba Eventos — abaixo do motivo, quem saiu mostra a autoria só quando ela está gravada: "por <nome>" (remoção pelo painel) ou "pela própria pessoa" (status "removido", gravado só pela saída via site). Sem nenhum dos dois, diz "motivo não registrado" e não atribui autoria a ninguém', p: ['admin'] },
        { label: 'Aba Eventos — filtros por destino: Todos os interessados · Confirmados · Aguardando decisão · Foram para a espera · Foram para outra turma · Removidos. Cada pessoa cai em exatamente um grupo e a soma fecha com o total, então "Todos" responde quantas pessoas se interessaram pela turma, incluindo quem saiu', p: ['admin'] },
        { label: 'Aba Eventos — "Aguardando decisão" é quem ainda não foi confirmada E ainda não foi removida: é o grupo que exige ação sua. Já foi partido em dois botões, separados só por ter ou não um motivo anotado; com o motivo virando coisa de quem sai, virou um grupo só', p: ['admin'] },
        
        { label: 'Aba Certificados — escolher o evento e depois a turma; a lista de turmas só mostra as daquele evento', p: ['admin'] },
        { label: 'Aba Certificados — os 6 campos do certificado são preenchidos sozinhos (nome, evento, turma, período, carga horária e data de emissão) — não há digitação manual', p: ['admin'] },
        { label: 'Aba Certificados — turma ainda não encerrada: aviso laranja de "prévia" e downloads bloqueados; após encerrar a turma, os downloads liberam', p: ['admin'] },
        { label: 'Aba Certificados — badge de frequência por participante; só baixa certificado quem atingiu o percentual mínimo definido no evento (padrão 75%)', p: ['admin'] },
        { label: 'Aba Certificados — baixar individual em PNG ou PDF, ou baixar todos de uma vez (lote)', p: ['admin'] },
        { label: 'Aba Certificados — frequência calculada como dias com check-in ÷ total de dias da turma; o mínimo é configurado por evento em "Editar evento" (aba Eventos)', p: ['admin'] },
        { label: 'Aba Eventos — exportar CSV Estado Atual (todas as turmas)', p: ['admin'] },
        { label: 'Aba Eventos — exportar CSV Histórico (todas as turmas)', p: ['admin'] },
        { label: 'Aba Eventos — exportar CSV individual de uma turma', p: ['admin'] },
        { label: 'Aba Eventos — liberar avaliação da oficina por turma (grava avaliacaoHabilitada: true) — inscritos confirmados daquela turma passam a ver a aba Avaliação', p: ['admin'] },
        { label: 'Aba Eventos — encerrar avaliação da oficina por turma (grava avaliacaoHabilitada: false) — aba Avaliação some para os inscritos daquela turma', p: ['admin'] },
        { label: 'Aba Eventos — consultar participantes (nome, e-mail, área, data de registro); contagem no cabeçalho do card mostra "X interessados · Y confirmados · Z aguardando decisão"', p: ['admin'] },
        { label: 'Aba Eventos — a barra de filtros da tabela de participantes traz a contagem em cada botão e aparece só quando a turma tem mais de um grupo com gente', p: ['admin'] },
        { label: 'Aba Eventos — consultar removidos, com histórico de presença preservado quando eram inscritos (interesse encerrado)', p: ['admin'] },
        { label: 'Aba Repositório — listar todos os conteúdos (título, tipo/autor, indicado por ou data de envio)', p: ['admin'] },
        { label: 'Aba Repositório — ocultar conteúdo curado', p: ['admin'] },
        { label: 'Aba Repositório — restaurar conteúdo curado', p: ['admin'] },
        { label: 'Aba Repositório — deletar permanentemente conteúdo (curado ou de usuário)', p: ['admin'] },
        { label: 'Aba Cadastrados — listar todos os cadastrados (nome, e-mail, área, data de cadastro)', p: ['admin'] },
        { label: 'Aba Cadastrados — filtrar lista de cadastrados', p: ['admin'] },
        { label: 'Aba Cadastrados — redefinir senha de qualquer cadastrado', p: ['admin'] },
        { label: 'Aba Cadastrados — resetar progresso de qualquer cadastrado', p: ['admin'] },
        { label: 'Aba Cadastrados — criar conta diretamente para colaboradora (nome + e-mail + área + senha do admin; senha padrão 12345678; sem verificação de e-mail)', p: ['admin'] },
        { label: 'Aba Cadastrados — bloquear/desbloquear cadastro (bloqueado não consegue mais acessar o portal)', p: ['admin'] },
        { label: 'Aba Cadastrados — filtrar por status: Ativos / Bloqueados / Todos', p: ['admin'] },
        { label: 'Aba Cadastrados — bloco de conferência acima da Lista de Espera: mostra por que a soma dos "Foram para a espera" das turmas não bate com o tamanho da fila (uma entrada por PESSOA contra uma saída por TURMA) e separa o que é diferença esperada do que é registro engolido pela sobrescrita', p: ['admin'] },
        { label: 'Aba Cadastrados — Lista de Espera: duas colunas de data lado a lado — Data interesse (define a ordem da fila) e Data remoção (quando saiu da turma) —, ambas com data E hora no formato brasileiro (10/08/2026 12:26); a hora sempre esteve gravada, só não era exibida', p: ['admin'] },
        { label: 'Aba Cadastrados — Lista de Espera: coluna "Origem" mostra de qual turma a pessoa foi migrada e o motivo; quem entrou direto pelo card do site aparece como "Entrou pela lista", com traço na data de remoção', p: ['admin'] },
        { label: 'Aba Cadastrados — Lista de Espera: remover da lista exige escolher o motivo (Desistiu / Já participou / Não respondeu / Evento encerrado / Duplicado / Outro); "Outro" abre campo de texto obrigatório, e "Já participou" pede QUAL turma ela já fez, como na saída da turma', p: ['admin'] },
        { label: 'Aba Administradores — consultar lista de administradores (nome, e-mail, admin desde)', p: ['admin'] },
        { label: 'Aba Administradores — adicionar admin (só tatianefdirene e danielfrazao veem esse formulário)', p: ['admin'] },
        { label: 'Aba Administradores — remover admin (só tatianefdirene e danielfrazao veem esse botão)', p: ['admin'] },
        { label: 'Aba Administradores — se a leitura falhar (permissão, rede), mostra mensagem de erro em vermelho em vez de ficar travada em "Carregando administradores…" indefinidamente', p: ['admin'] },
        { label: 'Aba Manual — regras de comportamento do sistema', p: ['admin'] },
        { label: 'Aba Manual — filtrar por seção e persona', p: ['admin'] },
        { label: 'Aba Manual — exportar Excel (regras)', p: ['admin'] },
        { label: 'Aba Mapa — hierarquia de personas (níveis de acesso cumulativos)', p: ['admin'] },
        { label: 'Aba Mapa — acesso por tipo de pessoa (tabela: quem vê o quê em cada página)', p: ['admin'] },
        { label: 'Aba Mapa — diagrama de estados de uma pessoa numa turma (Sem Registro, Interessada, Inscrita, Removida e as ações que ligam cada uma)', p: ['admin'] },
        { label: 'Aba Mapa — mapa do site (páginas e funcionalidades por seção, com contagem)', p: ['admin'] },
        { label: 'Aba Mapa — arquitetura técnica (linguagens, tecnologias, padrões e deploy)', p: ['admin'] },
        { label: 'Aba Mapa — regras operacionais (cache, autonomia e processo de deploy)', p: ['admin'] },
        { label: 'Aba Mapa — diagrama visual da arquitetura, com caixas clicáveis que levam ao card correspondente em Arquitetura Técnica', p: ['admin'] },
        { label: 'Aba Mapa — exportar Excel (mapa completo)', p: ['admin'] },
        { label: 'Aba Testes — testes automatizados e checklist manual', p: ['admin'] },
        { label: 'Aba Testes — exportar Excel (testes automáticos e manuais)', p: ['admin'] },
        { label: 'Aba Pedidos — ver todos os pedidos enviados pelo site, com filtro por tipo (tema / curso / material / dúvida / outros) e contagem por tipo', p: ['admin'] },
        { label: 'Aba Pedidos — botão "Responder por e-mail" abre o cliente de e-mail do admin (mailto:) com destinatário, assunto e corpo pré-preenchidos citando o pedido; o envio em si acontece fora do site, no e-mail pessoal do admin', p: ['admin'] },
        { label: 'Aba Pedidos — botão "Marcar como respondido" abre um seletor pra escolher qual admin respondeu (lista de fa-admins + super-admins) e um campo de data/hora editável (não precisa ser "agora"); reversível pelo botão "Desmarcar"', p: ['admin'] },
        { label: 'Aba Pedidos — item já respondido tem botão "✎ Editar" que reabre o seletor pré-preenchido com o admin e a data/hora já gravados, pra corrigir sem precisar desmarcar e marcar de novo', p: ['admin'] },
        { label: 'Aba Pedidos — filtro por status só sobre ativos (Pendentes / Respondidos / Todos, com contagem); começa em "Pendentes" ao abrir a aba', p: ['admin'] },
        { label: 'Aba Pedidos — botão "🗑 Lixeira (N)" separado dos chips de status, mostra só os excluídos; "excluído" é outra dimensão, não um status irmão de pendente/respondido', p: ['admin'] },
        { label: 'Aba Pedidos — filtro por tipo (Todos os tipos / tema / curso / material / dúvida / outros) com contagens que refletem o recorte atual de status ou lixeira, não o total geral', p: ['admin'] },
        { label: 'Aba Pedidos — botão "🗑 Excluir" abre formulário com seletor de quem está excluindo + justificativa obrigatória (textarea); exclusão é reversível (soft-delete: excluido:true), aparece só no filtro "Excluídos" com quem excluiu, quando e a justificativa; botão "↺ Restaurar" desfaz', p: ['admin'] },
        { label: 'Aba Pedidos — prazo em dias úteis por pedido: "Em aberto há N dias úteis" (fica laranja com 2+ dias) ou "Respondido por X em DATA — N dias úteis depois"; data em fim de semana conta como 8h da segunda-feira seguinte no cálculo', p: ['admin'] },
        { label: 'Aba Sorteios — todos os sorteios já feitos, de todas as turmas, do mais recente para o mais antigo: quando, evento, turma, nomes sorteados e quem sorteou', p: ['admin'] },
        { label: 'Aba Sorteios — filtrar por evento e por turma (combináveis); a lista de turmas se ajusta ao evento escolhido e os filtros só oferecem o que tem sorteio', p: ['admin'] },
        { label: 'Aba Sorteios — resumo do filtro atual ("N sorteios · M pessoas sorteadas") acima da tabela', p: ['admin'] },
        { label: 'Aba Sorteios — exportar CSV do que está filtrado, com uma linha por pessoa sorteada (nome e e-mail), para guardar fora do site', p: ['admin'] },
        { label: 'Aba Sorteios — ensaios não aparecem (não são gravados); "Limpar histórico" na aba Eventos também remove os sorteios daquela turma daqui', p: ['admin'] },
      ]
    },
    { label: 'AJUDA', color: '#7ecbff',
      features: [
        { label: 'Ver página Ajuda com perguntas em acordeão — texto "Central de Ajuda" acima do título "Como podemos ajudar?"', p: ['logado','inscrito','admin'] },
        { label: 'Expandir/recolher cada pergunta clicando no título (comportamento nativo do browser)', p: ['logado','inscrito','admin'] },
        { label: 'Link "Ajuda" no menu de navegação', p: ['logado','inscrito','admin'] },
        { label: 'Formulário "Faça um pedido" — escolher tipo (Quero aprender sobre um tema / Quero sugerir um curso / Preciso de material / Tenho uma dúvida / Outros) e descrever com mais detalhes', p: ['logado','inscrito','admin'] },
        { label: 'Botão "Enviar pedido" — exige login; sem sessão, mostra "Faça login para enviar um pedido." em vez de enviar', p: ['logado','inscrito','admin'] },
      ]
    },
    { label: 'CADASTRAR', color: '#9b7fff',
      features: [
        { label: 'Cadastrar conta (@previ.com.br)',           p: ['visitante'] },
        { label: 'Selecionar área/setor — dropdown com campo de busca por digitação (20 gerências, filtra em tempo real)', p: ['visitante'] },
        { label: 'Mostrar/ocultar senha do campo "Senha" (botão "olhinho")', p: ['visitante'] },
        { label: 'Mostrar/ocultar senha do campo "Confirmar senha" (botão "olhinho")', p: ['visitante'] },
        { label: 'Aceitar termos de uso (checkbox obrigatório)', p: ['visitante'] },
        { label: 'Aceitar receber novidades (checkbox opcional)', p: ['visitante'] },
      ]
    },
    { label: 'CHECK-IN', color: '#42a5f5',
      features: [
        { label: 'Página de registro de presença, acessada escaneando um QR Code no dia do evento — ver seção Manual para as regras de cada situação (sucesso, bloqueios, mensagens)', p: ['inscrito','admin'] },
      ]
    },
    { label: 'CONTEÚDOS', color: '#4caf7d',
      features: [
        { label: 'Ler as 7 seções numeradas (01 Mapa da Galáxia → 07 A Trilogia) — cada uma ocupa 100vh, uma por vez', p: ['inscrito','admin'] },
        { label: 'Mapa da Galáxia: botão "Ver mais 6 elementos →" revela os 6 últimos cards (ocultos por padrão)', p: ['inscrito','admin'] },
        { label: '12 Princípios: primeiros 6 visíveis por padrão; botão "Ver os 6 princípios restantes →" revela os princípios 7–12', p: ['inscrito','admin'] },
        { label: 'Navegação lateral por pontos (01–07) — salta entre seções; tooltip com nome ao passar o mouse', p: ['inscrito','admin'] },
        { label: 'Link externo "Ler os 4 valores na íntegra" (agilemanifesto.org)', p: ['inscrito','admin'] },
        { label: 'Link externo "Ler os 12 princípios na íntegra" (agilemanifesto.org)', p: ['inscrito','admin'] },
        { label: '"A Força do Ágil" — 25 ensinamentos em 5 episódios; cada episódio expande/recolhe clicando no título', p: ['inscrito','admin'] },
        { label: '"A Trilogia" — 3 episódios em acordeão; cada um expande/recolhe clicando no título', p: ['inscrito','admin'] },
      ]
    },
    { label: 'ENTRAR', color: '#c084fc',
      features: [
        { label: 'Recuperação automática de sessão presa: se a verificação não terminar em 10s e houver sessão guardada, o site apaga essa sessão e recarrega sozinho (uma vez por aba), voltando com a tela de login e a explicação — antes só funcionava limpando cookies na mão', p: ['visitante','logado','inscrito','admin'] },
        { label: 'Botão manual "Limpar sessão e entrar de novo", para o caso de travar mesmo depois da limpeza automática (o site não recarrega em laço)', p: ['visitante','logado','inscrito','admin'] },
        { label: 'Rede de segurança: se o servidor não responder em 10 segundos, a tela de login aparece assim mesmo com o aviso "Demorando para conectar" — antes o site ficava totalmente preto, sem login e sem explicação', p: ['visitante','logado','inscrito','admin'] },
        { label: 'Botão "Testar conexão" dentro do aviso: verifica os quatro caminhos de que o site depende (carregamento do sistema, login e senha, dados do site e conexão permanente por WebSocket) e diz quais estão bloqueados, com texto pronto para encaminhar à TI', p: ['visitante','logado','inscrito','admin'] },
        { label: 'Se nada estiver bloqueado e mesmo assim travar, o diagnóstico mostra os tempos de cada parte — separa lentidão para baixar o sistema de lentidão do servidor', p: ['visitante','logado','inscrito','admin'] },
        { label: 'Fazer login',                               p: ['visitante'] },
        { label: 'Mostrar/ocultar senha (botão "olhinho")',   p: ['visitante'] },
        { label: 'Esqueci minha senha — link por e-mail',     p: ['visitante'] },
      ]
    },
    { label: 'INÍCIO', color: '#1ab2ae',
      features: [
        { label: 'Botão "Conhecer a iniciativa" → rola até "O que é"',    p: ['logado','inscrito','admin'] },
        { label: 'Card "O que é" → Mindset ágil',   p: ['logado','inscrito','admin'] },
        { label: 'Card "O que é" → Colaboração real', p: ['logado','inscrito','admin'] },
        { label: 'Card "O que é" → Impacto sustentável', p: ['logado','inscrito','admin'] },
        { label: 'Crawl de abertura — texto em estilo Star Wars sobe a tela ao entrar na Home; aparece para qualquer pessoa logada, sem exigir turma confirmada nem interesse manifestado', p: ['logado','inscrito','admin'] },
        { label: 'Crawl — botão "⏸ Pausar" → pausa/retoma a animação', p: ['logado','inscrito','admin'] },
        { label: 'Crawl — clicar na área da animação → pausa/retoma (mesmo efeito do botão Pausar)', p: ['logado','inscrito','admin'] },
        { label: 'Crawl — botão "≡ Ler texto" → exibe texto estático sem perspectiva; "✕ Fechar texto" retorna ao crawl', p: ['logado','inscrito','admin'] },
        { label: 'Crawl — botão "↻ Repetir abertura" → reinicia a animação do início', p: ['logado','inscrito','admin'] },
        { label: 'Card "Como funciona" → Conteúdos (decorativo, sem hover)', p: ['logado','inscrito','admin'] },
        { label: 'Card "Como funciona" → Repositório (decorativo, sem hover)', p: ['logado','inscrito','admin'] },
        { label: 'Card "Como funciona" → Treinamento Jedi (decorativo, sem hover)', p: ['logado','inscrito','admin'] },
        { label: 'Botão do hero: na prática sempre "Ver turmas →" — o rótulo "Juntar-se à Força →" só existiria sem sessão, estado inalcançável desde o login obrigatório', p: ['logado', 'inscrito', 'admin'] },
        { label: 'Botão hero logado: "Ver turmas →" → navega para a página Turmas', p: ['logado','inscrito','admin'] },
        { label: 'CTA final: único botão "Ver turmas →" direciona para a página Turmas (mesmo comportamento para todos os perfis)', p: ['logado','inscrito','admin'] },
        { label: 'Link no rodapé para previ.com.br (externo, presente em todas as páginas)', p: ['logado','inscrito','admin'] },
      ]
    },
    { label: 'MENU / SESSÃO', color: '#7f9bff',
      features: [
        { label: 'Inicial e nome no menu — no lugar dos botões Entrar/Cadastrar; header exibe avatar, nome e botão Sair', p: ['logado','inscrito','admin'] },
        { label: 'Menu para quem está logado mas ainda sem turma confirmada: Início, Turmas, Repositório, Ajuda (sem Conteúdos nem Treinamento Jedi)', p: ['logado'] },
        { label: 'Menu para quem está logado e já tem turma confirmada (inscrito): Início, Turmas, Repositório, Conteúdos, Treinamento Jedi, Ajuda', p: ['inscrito'] },
        { label: 'Ver link "Admin" no menu de navegação — visível apenas para admins, some imediatamente após logout (desktop e mobile, inclusive com menu aberto)', p: ['admin'] },
        { label: 'Botão Sair',                                p: ['logado','inscrito','admin'] },
      ]
    },
    { label: 'MINHA ÁREA', color: '#26a69a',
      features: [
        { label: 'Admin pode ver a tela como qualquer participante vê — seletor "Ver esta tela como" no topo, com a situação de cada pessoa ao lado do nome (confirmada, inscrita sem confirmação, interesse, removida); é só visualização, nada é gravado em nome da pessoa', p: ['admin'] },
        { label: 'Acessar "Minha Área" pelo menu — disponível para qualquer pessoa logada, mesmo sem turma confirmada', p: ['logado','inscrito','admin'] },
        { label: 'Ver as turmas em que está confirmada, agrupadas por fase e nesta ordem: Em andamento, Programadas e Concluídas — primeiro o que exige ação agora, depois o que vai acontecer, por último o histórico. Cada grupo mostra a quantidade de turmas', p: ['inscrito','admin'] },
        { label: 'Cada turma traz selo "Em andamento", "Programada" ou "Concluída", nome do evento, carga horária e datas dos encontros', p: ['inscrito','admin'] },
        { label: 'Turma programada (o primeiro encontro ainda não chegou) mostra "Faltam N dias" / "Começa amanhã" / "É hoje!" e a data do primeiro encontro, sem barra de frequência e sem bloco de certificado — cobrar frequência de quem ainda não começou daria a impressão de que a pessoa faltou a tudo', p: ['inscrito','admin'] },
        { label: 'Ver as turmas com interesse registrado mas ainda não confirmado, no bloco "Inscrições em análise" com selo "Em análise" e a data em que o interesse foi registrado', p: ['logado','inscrito','admin'] },
        { label: 'Se a turma em análise já foi encerrada, o cartão avisa e orienta a procurar a organização pela página Ajuda', p: ['logado','inscrito','admin'] },
        { label: 'Ver o bloco "Lista de espera" quando a pessoa está na fila, informando desde quando espera e de qual turma veio, se veio de alguma', p: ['logado','inscrito','admin'] },
        { label: 'Quem nunca interagiu vê uma tela de boas-vindas com as turmas em que ainda dá para manifestar interesse (exclui as com interesse encerrado, as já iniciadas e as encerradas) e um botão para a página Turmas — em vez de uma mensagem de "nada aqui"', p: ['logado','inscrito','admin'] },
        { label: 'Ver a própria frequência: barra de percentual, contagem "X de Y encontros" e a lista de dias com ✓ nos que teve presença registrada', p: ['inscrito','admin'] },
        { label: 'Ver o percentual mínimo exigido pelo evento para o certificado, ao lado da frequência atingida', p: ['inscrito','admin'] },
        { label: 'Baixar o próprio certificado em PNG ou PDF — liberado só quando a turma é concluída E a frequência mínima foi atingida; usa o mesmo gerador do painel admin, então o arquivo é idêntico', p: ['inscrito','admin'] },
        { label: 'Ver por que o certificado não está disponível: turma ainda não concluída, ou frequência abaixo do mínimo (mostra a sua e a exigida)', p: ['inscrito','admin'] },
        { label: 'Ver a situação da avaliação de cada turma: já enviada, em aberto (com atalho para responder) ou ainda não liberada pelo admin', p: ['inscrito','admin'] },
        { label: 'Ver os próprios pedidos enviados pelo "Faça um pedido", com status "Em análise" ou "Respondido" e a data de envio', p: ['logado','inscrito','admin'] },
        { label: 'NÃO mostra o QR Code de check-in — o QR é o mesmo todos os dias, então tê-lo em mãos permitiria registrar presença sem estar no encontro e corromperia a frequência que define o certificado', p: ['logado','inscrito','admin'] },
      ]
    },
    { label: 'AVALIAÇÃO', color: '#a78bfa',
      features: [
        { label: 'Uma resposta por pessoa por turma — garantido pela forma como o dado é guardado (a segunda substituiria a primeira, nunca duplicaria) e pela tela, que passa a mostrar o agradecimento', p: ['inscrito','admin'] },
        { label: 'No banco, cada pessoa só grava na própria resposta e só lê a sua; a leitura do conjunto das avaliações é restrita a administradores', p: ['inscrito','admin'] },
        { label: 'O formulário só avança de seção sozinho quando a nota é a única pergunta da seção (hoje, só a seção 1) — seções com perguntas depois da nota ficam abertas, quem decide quando sair é a pessoa', p: ['inscrito','admin'] },
        { label: 'Aba Avaliação: visível no menu para inscritos confirmados em turma com avaliação liberada pelo admin (flag avaliacaoHabilitada). Admin vê a aba sempre — independente do flag — para poder testar e revisar antes e depois de liberar', p: ['inscrito','admin'] },
        { label: 'Admin vê seletores de Evento e Turma no topo da Avaliação — pode revisar/testar o formulário de QUALQUER turma do sistema, mesmo sem estar pessoalmente inscrito nela (não fica restrito às próprias turmas confirmadas)', p: ['admin'] },
        { label: 'Formulário com 13 seções em accordion: seções recolhidas por padrão, seção 1 abre automaticamente ao carregar', p: ['inscrito','admin'] },
        { label: 'Seções 1 a 7 (todos os ratings) obrigatórias — badge dourado "Obrigatória"; seções 8–13 marcadas como "Opcional"', p: ['inscrito','admin'] },
        { label: 'Barra de progresso — "X de 13 seções respondidas" atualizada em tempo real conforme campos são respondidos', p: ['inscrito','admin'] },
        { label: 'Auto-avançar — ao selecionar nota 0–10 no campo principal de uma seção, a próxima abre automaticamente após 600ms', p: ['inscrito','admin'] },
        { label: 'Checkmark ✅ no cabeçalho da seção assim que o campo principal é respondido (mesmo com a seção recolhida)', p: ['inscrito','admin'] },
        { label: 'Rascunho automático — salva no localStorage a cada 800ms; restaura ao revisitar; apaga após envio com sucesso', p: ['inscrito','admin'] },
        { label: '"Pular esta seção →" — link discreto no rodapé de cada seção opcional', p: ['inscrito','admin'] },
        { label: '"⏱ ~5 minutos" — tempo estimado exibido no cabeçalho do formulário', p: ['inscrito','admin'] },
        { label: 'Identificação opcional — checkbox "Quero me identificar" antes do envio; desmarcado por padrão (anônimo); se marcado, grava nome visível para o admin', p: ['inscrito','admin'] },
        { label: 'Envio único por turma — após enviar, verifica automaticamente se há outra turma/oficina com avaliação pendente e carrega o próximo formulário; se não houver mais nenhuma, exibe a tela de agradecimento', p: ['inscrito','admin'] },
        { label: 'Múltiplas avaliações pendentes — se a pessoa está inscrita e confirmada em mais de uma turma (mesma oficina ou oficinas diferentes) com avaliação liberada, o campo "Turma" vira um seletor e um aviso indica quantas pendências existem; a pessoa pode trocar livremente qual está respondendo (cada turma mantém seu próprio rascunho)', p: ['inscrito','admin'] },
        { label: 'Validação no envio — seção obrigatória não respondida bloqueia o envio e abre aquela seção com aviso', p: ['inscrito','admin'] },
        { label: 'Avaliação não liberada — inscrito vê mensagem "A avaliação ainda não foi liberada para a sua turma"', p: ['inscrito'] },
        { label: 'Admin sempre acessa o formulário independente do flag de liberação da turma', p: ['admin'] },
      ]
    },
    { label: 'REPOSITÓRIO', color: '#e8854a',
      features: [
        { label: 'Ver todos os conteúdos — cards com descrição colapsada em 2 linhas; "ver mais" / "ver menos" só onde o texto transborda', p: ['logado','inscrito','admin'] },
        { label: 'Filtrar por tipo (Todos/Vídeos/Documentos/Ferramentas/Livros)', p: ['logado','inscrito','admin'] },
        { label: 'Adicionar conteúdo ao Holocron',       p: ['logado','inscrito','admin'] },
        { label: 'Remover próprio conteúdo do Holocron', p: ['logado','inscrito','admin'] },
      ]
    },
    { label: 'TREINAMENTO JEDI', color: '#e05c7f',
      features: [
        { label: 'Welcome screen: botão "Quero jogar" — checagem de sessão residual (com login obrigatório ninguém deslogado chega aqui)', p: ['logado', 'inscrito', 'admin'] },
        { label: 'Autodiagnóstico com 20 afirmações em 4 blocos — cada resposta vale de 0 a 3 pontos, total de 0 a 60', p: ['inscrito','admin'] },
        { label: 'Patente determinada exclusivamente pela pontuação do autodiagnóstico (Youngling 0–15 / Padawan 16–30 / Cavaleiro 31–45 / Mestre 46–60)', p: ['inscrito','admin'] },
        { label: 'Painel com a patente atual, que atualiza conforme a pessoa vai respondendo', p: ['inscrito','admin'] },
        { label: '4 cards mostrando as patentes possíveis, cada uma com personagem, faixa de pontuação e nome', p: ['inscrito','admin'] },
        { label: 'Botão "Revelar minha Patente →" aparece ao concluir as 20 afirmações (centralizado)', p: ['inscrito','admin'] },
        { label: 'Após revelar: botão desabilitado + card compacto com avatar, pontuação, nome da patente, descrição, características, próximos passos e frase Jedi', p: ['inscrito','admin'] },
        { label: 'Resultado bloqueado após revelar — mensagem "🔒 Para refazer, solicite ao admin o reset do seu progresso."', p: ['inscrito','admin'] },
      ]
    },
    { label: 'TURMAS', color: '#f5c542',
      features: [
        { label: 'Grid com um card por turma cadastrada — as mesmas turmas aparecem pra todos os perfis autenticados (logado, inscrito ou admin), nenhuma é escondida por perfil; cada card mostra nome, mês, datas e horário (9h – 13h); o estado do card muda automaticamente por data ou ação do admin', p: ['logado','inscrito','admin'] },
        { label: 'Card de turma com interesse aberto — botão "Tenho interesse" (estado padrão enquanto a turma não iniciou e o admin não encerrou o interesse)', p: ['logado','inscrito','admin'] },
        { label: 'Botão de interesse por turma ("Tenho interesse" / "Remover interesse") — exige login para registrar; após registrar, mensagem "Interesse registrado. Para confirmar sua vaga, realize a inscrição no CMFlex em: RH - Uso Pessoal | PREVI"', p: ['logado','inscrito','admin'] },
        { label: 'Quem já é Inscrita vê botão travado "✓ Inscrita" (verde, desabilitado) em vez do botão de interesse — só o admin pode desconfirmar', p: ['logado','inscrito','admin'] },
        { label: 'Card de turma com interesse encerrado (antes do primeiro dia) — "Inscrições encerradas: as vagas já foram preenchidas; a turma será realizada em [datas]". Sem botão e sem link para o CMFlex: o interesse é encerrado porque as vagas do CMFlex acabaram', p: ['logado','inscrito','admin'] },
        { label: 'Card de turma Em andamento — a partir do primeiro dia da turma, o card troca automaticamente para "Turma em andamento · As aulas estão acontecendo. Fique de olho nas próximas turmas!" sem nenhum botão', p: ['logado','inscrito','admin'] },
        { label: 'Card de turma Realizada — após o último dia OU quando o admin encerra manualmente, o card mostra "Turma realizada · Esta turma já foi concluída. Fique de olho nas próximas!" sem nenhum botão', p: ['logado','inscrito','admin'] },
        { label: 'Bloco "Como funciona a oficina" (métricas + descrição)', p: ['logado','inscrito','admin'] },
        { label: 'Agenda D1–D5 (itens estáticos)', p: ['logado','inscrito','admin'] },
      ]
    },
  ];

  function esc(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function slug(str) { return String(str).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }

  /* Converte a descrição em HTML estruturado. Antes era texto corrido com "•"
     e quebras de linha renderizadas por white-space:pre-line — descrições longas
     (ex: as 9 estruturas do banco + 5 regras de segurança) viravam um paredão
     onde não dava pra ver onde um item terminava e o próximo começava. */
  function formatDesc(txt) {
    var linhas = String(txt || '').split('\n');
    var html = '';
    var emLista = false;
    linhas.forEach(function (linha) {
      var t = linha.trim();
      if (!t) return;
      if (t.charAt(0) === '•') {
        if (!emLista) { html += '<ul class="arch-desc-list">'; emLista = true; }
        var item = t.slice(1).trim();
        /* "nome — explicação" vira nome em destaque + explicação */
        var m = item.match(/^([^—]{1,70})—\s*([\s\S]*)$/);
        if (m) html += '<li><strong>' + esc(m[1].trim()) + '</strong> — ' + esc(m[2]) + '</li>';
        else html += '<li>' + esc(item) + '</li>';
      } else {
        if (emLista) { html += '</ul>'; emLista = false; }
        /* Linha terminada em ":" é cabeçalho do bloco que vem abaixo */
        if (t.slice(-1) === ':') html += '<p class="arch-desc-head">' + esc(t) + '</p>';
        else html += '<p class="arch-desc-p">' + esc(t) + '</p>';
      }
    });
    if (emLista) html += '</ul>';
    return html;
  }

  /* Badge de nível mínimo para o mapa do site */
  const P_ORDER = ['visitante', 'logado', 'inscrito', 'admin'];
  const P_COLOR = { visitante: '#888888', logado: '#1ab2ae', inscrito: '#4caf7d', admin: '#6b7a99' };
  const P_LABEL = { visitante: 'Visitante', logado: 'Logado', inscrito: 'Inscrito', admin: 'Admin' };

  function levelBadge(personas) {
    if (!personas || !personas.length) return '';
    const indices = personas.map(function (k) { return P_ORDER.indexOf(k); }).filter(function (i) { return i >= 0; });
    const minIdx = Math.min.apply(null, indices);
    const maxIdx = Math.max.apply(null, indices);
    /* herança contínua: do mínimo até o topo (admin = índice 3) */
    const isChain = (maxIdx === P_ORDER.length - 1) && (indices.length === P_ORDER.length - minIdx);
    const minKey  = P_ORDER[minIdx];
    let col     = P_COLOR[minKey];
    let lbl     = P_LABEL[minKey];
    let suffix  = (isChain && minIdx < P_ORDER.length - 1) ? ' +' : '';
    if (personas.length === P_ORDER.length) { lbl = 'Todos'; suffix = ''; col = '#ffffff'; }
    return '<span class="mapa-badge" style="--bc:' + col + '">' + lbl + suffix + '</span>';
  }

  function render() {
    const container = document.getElementById('adminMapa');
    if (!container) return;

    let html = '<div class="mapa-wrap">';

    /* Toolbar única: exportar à esquerda, expandir/recolher à direita */
    html += '<div class="manual-toolbar" style="margin-bottom:28px">';
    html += '<div class="manual-toolbar-left">';
    html += '<button class="btn btn--sm" id="mapaExportBtn">⬇ Exportar Excel (mapa completo)</button>';
    html += '</div>';
    html += '<div class="manual-toolbar-right">';
    html += '<button class="btn btn--sm btn--ghost" id="mapaExpandAll">Expandir tudo</button>';
    html += '<button class="btn btn--sm btn--ghost" id="mapaCollapseAll">Recolher tudo</button>';
    html += '</div>';
    html += '</div>';

    /* ── Hierarquia ── */
    html += '<h3 class="mapa-title">Hierarquia de Personas</h3>';
    html += '<p class="mapa-sub">O acúmulo vale de <strong>Logado → Inscrito</strong>: o inscrito vê tudo do logado e mais Conteúdos, Treinamento Jedi e Avaliação. <strong>Visitante fica fora dessa escada</strong> — é o estado antes de autenticar, e o que ele vê (o modal de login) some justamente quando a pessoa entra. <strong>Admin também não é degrau</strong>: é uma marcação paralela que já concede o nível de Inscrito, mesmo sem turma confirmada. Só existem 2 níveis de acesso no código (member e enrolled) — "interessado" não é um deles.</p>';
    html += '<div class="mapa-hierarchy">';

    HIERARCHY.forEach(function (level, i) {
      const prev = i > 0 ? HIERARCHY[i - 1] : null;
      html += '<div class="mapa-level" style="--lc:' + level.color + '">';
      html += '<div class="mapa-level-head"><span class="mapa-level-name">' + level.label + '</span><span class="mapa-level-arrow">▾</span></div>';
      html += '<div class="mapa-level-body">';
      if (prev) {
        html += '<div class="mapa-level-inherit">↳ tudo de <strong>' + prev.label + '</strong>, mais:</div>';
      }
      html += '<ul class="mapa-level-adds">';
      level.adds.forEach(function (a) { html += '<li>' + a + '</li>'; });
      html += '</ul></div></div>';
      if (i < HIERARCHY.length - 1) {
        html += '<div class="mapa-hierarchy-arrow">▲</div>';
      }
    });

    html += '</div>';

    /* ── Acesso por tipo de pessoa ── */
    html += '<h3 class="mapa-title" style="margin-top:48px">Acesso por Tipo de Persona</h3>';
    html += '<p class="mapa-sub">O que cada perfil consegue ver e fazer no site.</p>';
    html += '<div class="table-scroll-wrap"><table class="admin-table"><thead><tr><th>Página / Feature</th>';
    P_ORDER.forEach(function (pk) {
      html += '<th style="text-align:center;color:' + P_COLOR[pk] + '">' + P_LABEL[pk] + '</th>';
    });
    html += '</tr></thead><tbody>';

    var ACESSO = [
      { label: 'Início',                     access: { visitante: false, logado: true,  inscrito: true,  admin: true  } },
      { label: 'Ajuda',                       access: { visitante: false, logado: true,  inscrito: true,  admin: true  } },
      { label: 'Turmas',                       access: { visitante: false, logado: true,  inscrito: true,  admin: true  } },
      { label: 'Repositório',                 access: { visitante: false, logado: true,  inscrito: true,  admin: true  } },
      { label: 'Conteúdos',                   access: { visitante: false, logado: false, inscrito: true,  admin: true  } },
      { label: 'Treinamento Jedi',            access: { visitante: false, logado: false, inscrito: true,  admin: true  } },
      { label: 'Avaliação',                   access: { visitante: false, logado: false, inscrito: true,  admin: true  } },
      { label: 'Minha Área',                  access: { visitante: false, logado: true,  inscrito: true,  admin: true  } },
      { label: 'Painel Admin',                access: { visitante: false, logado: false, inscrito: false, admin: true  } },
    ];

    ACESSO.forEach(function (row) {
      html += '<tr><td>' + esc(row.label) + '</td>';
      P_ORDER.forEach(function (pk) {
        var has = row.access[pk];
        html += '<td style="text-align:center;' + (has ? 'color:' + P_COLOR[pk] + ';font-weight:700' : 'color:var(--ink-3)') + '">' + (has ? '✓' : '—') + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    html += '<p class="mapa-sub" style="margin-top:10px">Visitante não logado não acessa NADA: com o login obrigatório, o site inteiro fica oculto e ele vê apenas o modal de autenticação (entrar, cadastrar, recuperar senha). "Turmas" mostra as mesmas turmas pra todos os perfis autenticados — nenhuma é escondida por perfil. O que muda de um card para outro é o estado da turma (interesse aberto, inscrições encerradas, em andamento ou realizada) e, dentro de uma turma aberta, o botão de interesse conforme o status da própria pessoa (Tenho interesse / Remover interesse / ✓ Inscrita travado). "Avaliação" marca inscrito como ✓ porque é o nível mínimo exigido, mas na prática só aparece pra quem está confirmado numa turma com avaliacaoHabilitada:true — admin vê sempre, independente do flag, pra poder revisar/testar.</p>';

    /* ── Estados de uma pessoa numa turma ── */
    html += '<h3 class="mapa-title" style="margin-top:48px">Estados de uma Persona numa Turma</h3>';
    html += '<p class="mapa-sub">Como o registro de alguém em <code>turmas-interesse</code> muda de status — pela própria pessoa (site) ou pelo admin (painel).</p>';
    html += '<div class="mapa-status-diagram">' + STATUS_DIAGRAM_SVG + '</div>';
    html += '<p class="mapa-sub" style="margin-top:12px">Interesse não tem limite — a mesma pessoa pode estar "Interessada" em quantas turmas quiser ao mesmo tempo, sem nenhuma checagem. Só "Inscrita" é exclusivo de uma turma por vez: se a pessoa já for Inscrita em outra turma, essa outra inscrição é removida automaticamente — tanto ao clicar em "Confirmar" quanto ao adicionar alguém direto como "Inscrita" pelo "＋ Participante", que avisa e pede confirmação antes de remover. Estar só interessada em outra turma nunca dispara esse aviso nem é tocado.</p>';
    html += '<p class="mapa-sub" style="margin-top:8px">O diagrama acima não mostra uma transição que não existe mais: uma vez Inscrita, a pessoa <strong>não consegue</strong> se autorremover pelo botão de interesse do site — ele fica travado ("✓ Inscrita", desabilitado). Só o "Desconfirmar" do admin tira esse status, porque só ele sabe de verdade se ela continua inscrita no CMFlex.</p>';
    html += '<p class="mapa-sub" style="margin-top:8px">Três casos ficam fora do diagrama por não serem transição de estado de uma pessoa numa turma: Visitante (sem sessão/e-mail) não tem registro em <code>turmas-interesse</code>, então não existe conceito de status pra ela; clicar em "Tenho interesse" já sendo Inscrita não muda nada (botão travado, mesmo caso do parágrafo acima); e "Excluir turma" não move ninguém de um estado a outro — apaga a turma inteira, com todo mundo junto.</p>';

    /* ── Mapa do site ── */
    var totalPaginas = PAGES.length;
    var totalFeatures = PAGES.reduce(function (sum, p) { return sum + p.features.filter(function (f) { return f.p && f.p.length; }).length; }, 0);
    html += '<h3 class="mapa-title" style="margin-top:48px">Mapa do Site <span class="testes-group-count">(' + totalPaginas + ' seções · ' + totalFeatures + ' features)</span></h3>';
    /* "Seções" e não "páginas": o menu tem 8 links, mas aqui também entram
       Check-in (página fora do menu, acessada por QR), Entrar e Cadastrar
       (abas do modal de login) e Menu/Sessão (a própria barra de navegação). */
    html += '<p class="mapa-sub">São 9 páginas do menu (Início, Turmas, Conteúdos, Repositório, Treinamento Jedi, Avaliação, Minha Área, Ajuda e Admin) mais 4 seções que não são páginas do menu: Check-in (aberta pelo QR Code), Entrar e Cadastrar (abas do modal de login) e Menu / Sessão (a barra de navegação em si).</p>';

    /* Legenda dos badges */
    html += '<div class="mapa-legend-box">';
    html += '<span class="mapa-legend-title">Legenda por persona</span>';
    html += '<div class="mapa-legend">';
    html += '<span class="mapa-legend-item"><span class="mapa-badge" style="--bc:#888">Visitante</span> não autenticado — vê Início, Turmas, Ajuda</span>';
    html += '<span class="mapa-legend-item"><span class="mapa-badge" style="--bc:#1ab2ae">Logado +</span> autenticado, sem turma confirmada</span>';
    html += '<span class="mapa-legend-item"><span class="mapa-badge" style="--bc:#4caf7d">Inscrito +</span> autenticado, com turma confirmada</span>';
    html += '<span class="mapa-legend-item"><span class="mapa-badge" style="--bc:#6b7a99">Admin</span> acesso administrativo completo</span>';
    html += '</div>';
    html += '</div>';

    /* Filtro por persona */
    html += '<div class="mapa-filter-bar" id="mapaFilterBar">';
    html += '<span class="mapa-filter-label">Filtrar por persona:</span>';
    [
      { key: 'todos',    label: 'Todos',     color: '#aaa' },
      { key: 'visitante',label: 'Visitante', color: '#888' },
      { key: 'logado',   label: 'Logado',    color: '#1ab2ae' },
      { key: 'inscrito', label: 'Inscrito',  color: '#4caf7d' },
      { key: 'admin',    label: 'Admin',     color: '#6b7a99' },
    ].forEach(function (p) {
      html += '<button class="mapa-filter-chip' + (p.key === 'todos' ? ' active' : '') + '" data-persona="' + p.key + '" style="--fc:' + p.color + '">' + p.label + '</button>';
    });
    html += '</div>';

    /* Grid de páginas */
    html += '<div class="mapa-grid" id="mapaGrid">';
    PAGES.forEach(function (page, idx) {
      var allFeats = page.features.filter(function (f) { return f.p && f.p.length; });
      var featCount = allFeats.length;
      html += '<div class="mapa-page" style="--pc:' + page.color + '" data-page-idx="' + idx + '">';
      html += '<div class="mapa-page-title"><span class="mapa-page-title-text">' + page.label + ' <span class="testes-group-count mapa-page-count">(' + featCount + ')</span></span><span class="mapa-page-arrow">▾</span></div>';
      html += '<div class="mapa-page-body">';
      var renderFeature = function (f) {
        var ps = (f.p || []).join(' ');
        html += '<div class="mapa-feature" data-personas="' + esc(ps) + '"><span class="mapa-feature-label">' + esc(f.label) + '</span>' + levelBadge(f.p) + '</div>';
      };
      if (page.label === 'ADMIN') {
        var subgroups = [];
        var byTab = {};
        allFeats.forEach(function (f) {
          var m = /^Aba\s+([^—]+?)(?:\s—|$)/.exec(f.label);
          var tab = m ? m[1].trim() : 'Geral';
          if (!byTab[tab]) { byTab[tab] = []; subgroups.push(tab); }
          byTab[tab].push(f);
        });
        subgroups.forEach(function (tab) {
          html += '<div class="mapa-admin-subgroup" data-tab="' + esc(tab) + '">';
          html += '<div class="manual-admin-subhead mapa-subhead"><span class="mapa-page-arrow mapa-subhead-arrow">▾</span>ADMIN · ' + esc(tab.toUpperCase()) + ' <span class="testes-group-count">(' + byTab[tab].length + ')</span></div>';
          html += '<div class="mapa-admin-subgroup-body">';
          byTab[tab].forEach(renderFeature);
          html += '</div></div>';
        });
      } else {
        allFeats.forEach(renderFeature);
      }
      html += '</div>';
      html += '</div>';
    });
    html += '</div>';

    /* ── Arquitetura Técnica ── */
    html += '<h3 class="mapa-title" style="margin-top:56px">Arquitetura Técnica</h3>';
    html += '<p class="mapa-sub">Visão geral das tecnologias, estrutura e processo de deploy do projeto.</p>';

    const ARCH = [
      {
        label: 'Linguagens', color: '#9b7fff',
        items: [
          { name: 'HTML5',       desc: 'Estrutura única — toda a aplicação está em um único index.html (SPA)' },
          { name: 'CSS3',        desc: 'Estilos em forca-agil/styles.css com variáveis CSS (custom properties)' },
          { name: 'JavaScript',  desc: 'ES6+ (const/let, arrow functions, Promises, IntersectionObserver) — Vanilla JS, sem framework' },
        ]
      },
      {
        label: 'Tecnologias & Serviços', color: '#1ab2ae',
        items: [
          { name: 'Firebase Authentication', desc: 'Login e cadastro por e-mail/senha. Gratuito (Spark plan).\n\nEnvio de e-mail automático em 3 situações — em todos o e-mail é gerado e enviado pelo próprio Firebase (não pelo código do projeto); templates configuráveis no Firebase Console → Authentication → Templates:\n• "Verificação de e-mail" (após auto-cadastro): enviado automaticamente assim que a conta é criada pela própria pessoa. O acesso ao site é bloqueado até a pessoa clicar no link. Admin pode criar conta diretamente (sem verificação) — conta fica marcada como adminApproved no banco.\n• "Esqueci minha senha" (tela de login): usuária digita o e-mail e recebe um link de redefinição. Se o e-mail não estiver cadastrado, a mensagem é genérica por segurança.\n• "Redefinir senha" (painel Admin → aba Cadastrados): admin dispara o mesmo link para qualquer pessoa cadastrada. Só funciona se a pessoa já tiver feito o primeiro login (conta ativa no Firebase Auth).\n\nNos casos de redefinição: a pessoa clica no link → abre página do Firebase com campos "Nova senha" / "Confirmar senha" → salva → na próxima entrada no site usa a nova senha.' },
          { name: 'Firebase Realtime Database', desc: '10 estruturas principais (equivalente a tabelas):\n• fa-users — perfil de cada cadastrado\n• fa-espera — lista de espera para próximas turmas; cada entrada tem name, email, area, date (data original de interesse — preservada ao migrar de uma turma), removed (soft-delete), migratedFrom (turma de origem, se veio de migração) e migratedAt (momento da migração)\n• fa-holocron — conteúdos enviados no Repositório\n• fa-admins — lista de quem é admin\n• turmas/<turma> — nome, datas dos encontros e link do CMFlex de cada turma; criada/editada/excluída pelo admin (não são mais fixas em código)\n• turmas-interesse/<turma>/<emailKey> — interessados/inscritos de cada turma; status vira "inscrito" quando o admin confirma alguém que já estava interessada, ou quando adiciona alguém direto como inscrita pelo "＋ Participante" (inclusive ao mover da lista de espera) — nunca automaticamente só por encerrar o interesse da turma\n• turmas-interesse-log/<turma>/<emailKey> — histórico de quem registrou/removeu interesse, e quando\n• turmas-config/<turma> — configuração da turma (finalizada, dia de check-in ativo)\n• turmas-checkin/<turma>/<data>/<emailKey> — presença registrada em cada dia\n• turmas-sorteio/<turma>/<sorteioKey> — sorteios feitos na turma; cada registro guarda os ganhadores (nome e e-mail), quando foi sorteado, quem sorteou e se o sorteio excluiu quem já havia sido sorteado\n\nRegras de segurança (5 regras — todas aplicadas no servidor Firebase, não no cliente):\n• Ninguém lê ou escreve na raiz do banco diretamente\n• Todos os nós exigem autenticação com e-mail @previ.com.br para leitura e escrita — não existe nenhum nó público; mesmo quem descobrir a URL do banco não lê nada sem autenticar\n• A verificação de domínio é feita no servidor (auth.token.email), não só na tela — impossível burlar pelo browser\n• Qualquer admin @previ.com.br pode fazer tudo no painel\n• Só tatianefdirene e danielfrazao podem adicionar/remover admins' },
          { name: 'Firebase Hosting',        desc: 'Hospedagem em kyber-agil.web.app (produção/main). CDN global, HTTPS automático' },
        ]
      },
      {
        label: 'Estrutura de Arquivos', color: '#f5c542',
        items: [
          { name: 'index.html',                  desc: 'Entrada única da aplicação. Contém todo o HTML, carrega os scripts e gerencia as seções por hash (#inicio, #turmas…). São 13 seções, entre elas #minha-area (área do participante) e o painel Admin com suas 11 abas — a última é Sorteios' },
          { name: 'forca-agil/head-init.js',     desc: 'Inicialização precoce — adiciona classe "js" ao <html> antes do body renderizar, evitando flash de conteúdo sem JS' },
          { name: 'forca-agil/firebase.js',      desc: 'Progresso e autodiagnóstico — salva/carrega dados do Firebase. API: window.faLoadProgress, window.faSyncProgress' },
          { name: 'forca-agil/turmas-util.js',   desc: 'Utilidade compartilhada de turmas — deriva mês e texto de datas ("Agosto", "11, 12, 18, 19 e 20") a partir do array de datas ISO de cada turma, usada por app.js, admin.js e checkin.js. API: window.faTurmasUtil' },
          { name: 'forca-agil/router.js',        desc: 'Roteamento por hash — controla qual seção da página está visível. Rede de segurança contra tela preta: se a autenticação não resolver em 10 segundos, o login é exibido assim mesmo com aviso e um diagnóstico que testa os quatro caminhos (gstatic, identitytoolkit, banco por HTTPS e banco por WebSocket) e, quando nada está bloqueado, mede os tempos de carregamento. Login obrigatório: o body inteiro fica oculto (class "aguardando-auth") até o Firebase confirmar a sessão via evento fa-auth-ready; visitante não autenticado vê apenas o modal de login com fundo totalmente opaco (sem botão de fechar, sem site por baixo). Após login, a classe é removida e o site é revelado. Rotas protegidas: #conteudos e #treinamento exigem nível "enrolled"; demais rotas exigem apenas "member" — #minha-area é deliberadamente uma delas, para quem ainda não tem turma confirmada poder acompanhar a própria situação. Nível detectado via window.faAuth.getAccessLevel(). API: window.faRouter' },
          { name: 'forca-agil/auth.js',          desc: 'Autenticação — login, cadastro, logout, redefinição de senha. Senha exige apenas dígitos numéricos (mín. 8). Verifica adminship lendo só o próprio registro em fa-admins. Detecta perfil de acesso via window.faAuth.getAccessLevel() → "member" (logado sem turma confirmada) ou "enrolled" (inscrito com turma confirmada pelo admin). "Enrolled" exige status="inscrito" E confirmedByAdmin preenchido — manifestar interesse (status="interessado") não concede acesso. Perfil "guest" removido — login é obrigatório. Admin sempre recebe "enrolled". Dispara evento fa-auth-ready ao concluir verificação inicial. API pública: window.faAuth' },
          { name: 'forca-agil/stars.js',         desc: 'Animação de estrelas do fundo (canvas)' },
          { name: 'forca-agil/app.js',           desc: 'Interações de UI — nav scroll, reveals, botões de interesse em turmas (perfil logado sem turma), card permanente de lista de espera (fa-espera/ no Firebase; entrar/sair sem alterar nível de acesso), controle de acesso por perfil via getAccessLevel(), crawl de abertura (exibido para qualquer sessão autenticada — não exige turma confirmada; pausar/retomar no clique, botão "Ler texto" para modo estático)' },
          { name: 'forca-agil/home-nav.js',      desc: 'Navegação assistida entre seções da Home — pontos laterais, botão Continuar animado, teclado ↑↓/Enter, IntersectionObserver para dot ativo' },
          { name: 'forca-agil/conteudos-nav.js', desc: 'Navegação lateral para a página Conteúdos — reutiliza estilos .hn-* do home-nav' },
          { name: 'forca-agil/repo.js',          desc: 'Repositório (Holocron) — listagem, adição, remoção de conteúdos' },
          { name: 'forca-agil/game-data.js',     desc: 'Dados do Treinamento Jedi — 4 blocos × 5 afirmações (BLOCOS), patentes (RANKS), níveis Likert (LEVELS). DIMS computado dinamicamente a partir de BLOCOS. MISSIONS existe no arquivo mas não é usada em v3. Expõe window.faGameData' },
          { name: 'forca-agil/game.js',          desc: 'Treinamento Jedi — autodiagnóstico, painel de patente e revelar patente. Acessível apenas com nível "enrolled". Lê dados de window.faGameData' },
          { name: 'forca-agil/admin.js',         desc: 'Painel Admin — turmas (criar/editar/excluir, com datas dinâmicas em turmas/ no Firebase — não são mais fixas em código), interessados, moderação de repositório, gestão de admins, Chave de e-mail: TODOS os módulos usam a mesma função — minúsculas, arroba e ponto viram sublinhado, o resto é descartado, corte em 64. A aba Certificados já teve uma variante própria (ponto virando vírgula) que nunca casava com a chave do check-in e mostrava 0% de frequência para todo mundo. exportação CSV UTF-8 BOM via URL.createObjectURL (window.faToXls — compartilhada por Manual e Testes; acentos corretos no Excel, arquivo sempre editável), barra expandir/recolher com botões por seção. Saída da turma por linha da tabela de participantes: um único botão "Remover" (modal adminConfirmComMotivo, lista MOTIVOS_REMOCAO_TURMA) grava removedMotivo/removedReason; uma caixa dentro desse modal migra a pessoa para fa-espera/ preservando a data original de interesse, gravando motivoEntrada/motivoEntradaDetalhe. O motivo "Substituída por outra pessoa" abre a escolha de quem ficou com a vaga (substituidaPor/substituidaPorNome). Remover da lista de espera também exige motivo (MOTIVOS_ESPERA_SAIDA), gravado em motivoSaida/motivoSaidaDetalhe. Ambas as listas incluem "Evento encerrado"; a opção "Outro" abre campo de texto obrigatório. Aba Cadastrados: coluna E-mail com badge Pendente/Verificado; botão "Confirmar cadastro" para quem ainda não clicou no link (seta adminApproved:true + registra quem aprovou); seção Lista de Espera com ações "Mover para turma" (adiciona como Inscrita) e "Remover da lista". Aba Eventos: botão "↓ QR de acesso ao site" baixa PNG estático com logotipo (forca-agil/assets/qrcode-acesso.png), para uso em materiais de divulgação. Geração de certificado NÃO está mais no menu ⋯ da turma — só existe na aba Certificados (window.faCertif, ver certif.js). Sorteio da turma (menu ⋯ → "🎲 Sorteio"): sorteia entre os participantes CONFIRMADOS (mesmo conjunto do filtro "Confirmados"), com quantidade configurável, opção de não repetir quem já saiu e modo Ensaio que não grava nada; embaralhamento Fisher-Yates com crypto.getRandomValues e descarte do resto para não enviesar; grava em turmas-sorteio/<turma>. O modal declara o modo vigente nos dois sentidos (faixa verde "vale" / âmbar "ensaio") e só confirma "Registrado" após o callback do banco. Aba Sorteios (11ª): consolida todos os sorteios de todas as turmas com filtros combináveis por evento e turma (os selects só oferecem o que tem sorteio) e exportação CSV com uma linha por pessoa. A aba Eventos preserva o estado da interface entre recargas (eventos e turmas expandidos, filtro de status por turma, acordeão de Removidos, filtro "Ver evento" e posição da rolagem) — sem isso, registrar presença recolhia tudo e voltava ao topo a cada pessoa. Datas: fmtDate exibe data + hora em pt-BR; uma data gravada SEM hora ("2026-08-10") seria lida como meia-noite em UTC e exibida como 21h do dia anterior no nosso fuso, então esse caso é montado na mão e sai sem hora. Nenhuma informação de XP é exibida no painel.' },
          { name: 'forca-agil/avaliacao.js',     desc: 'Avaliação da Oficina — formulário em accordion com 13 seções (7 obrigatórias de 0–10, 6 opcionais). Visível apenas para admin e inscritos confirmados em turma com avaliação habilitada pelo admin. Rascunho automático por turma, envio único, progresso por seção. Identificação opcional: checkbox anônimo por padrão; se marcado, grava nomeExibido e identificado:true em avaliacoes/<turmaKey>/<emailKey>. Inscrito com mais de uma avaliação pendente vê um seletor de turma para trocar entre elas; ao enviar uma, a próxima pendente carrega automaticamente. Admin não usa esse fluxo — vê seletores de Evento e Turma que dão acesso a QUALQUER turma do sistema, mesmo sem estar pessoalmente inscrito, para revisar/testar antes de liberar. API: window.faAvaliacao' },
          { name: 'forca-agil/dashboard.js',     desc: 'Aba Dashboard — agrega dados de avaliacoes/ (Firebase) em estatísticas: participantes (soma de inscritos confirmados em turmas-interesse), % participação, média geral e NPS (fórmula clássica: %promotores 9–10 menos %detratores 0–6), distribuição de notas (campo notaGeral) em 5 faixas de duas notas, com cortes em 7 e 9 alinhados ao NPS; a contagem exibida é a de quem respondeu essa pergunta, não o total de avaliações, média por turma (gráfico de barras em SVG inline), gauge semicircular de recomendação (SVG), temas mais solicitados (agregação de temasDesejados). "Destaques dos feedbacks" usa só as notas por seção (orgGeral, conteudoRelevancia, facilitadoresNota, dinamicasNota, aplicacaoPreparado) — nunca interpreta texto livre. API: window.faInitDashboard' },
          { name: 'forca-agil/aluno.js',          desc: 'Minha Área — página do participante. A página nunca fica vazia: tem um estado nomeado para cada situação — confirmada em turma (cards agrupados em Em andamento / Programadas / Concluídas), interesse ainda não confirmado ("Inscrições em análise"), lista de espera, e boas-vindas com as turmas abertas para quem nunca interagiu. Os três primeiros podem coexistir; o de boas-vindas só aparece quando não há nenhum dos outros. A fase da turma é derivada dos dados existentes: concluída = admin encerrou; programada = o primeiro encontro ainda não chegou; em andamento = o resto. Reúne o que antes só o admin via: turmas em que a pessoa está confirmada, frequência por encontro (dias presentes ÷ total, comparada ao mínimo do evento), certificado para download em PNG/PDF quando a turma é concluída e a frequência foi atingida (reaproveita window.faCertif, então o certificado é idêntico ao emitido pelo admin), situação da avaliação de cada turma e histórico dos próprios pedidos com status. NÃO expõe o QR Code de check-in — o QR é o mesmo todos os dias e daria para registrar presença sem estar no encontro, corrompendo a frequência que define o certificado. API: window.faMinhaArea' },
          { name: 'forca-agil/pedidos.js',       desc: 'Formulário público "Faça um pedido" (seção Ajuda) e painel admin Aba Pedidos. Público: seleção de tipo (tema/curso/material/dúvida/outros) + textarea + envio autenticado para Firebase pedidos/. Admin: lê node pedidos/, filtro por status sobre ativos (Pendentes/Respondidos/Todos) + botão de Lixeira separado para os excluídos (dimensões distintas, evita "Todos" ambíguo), combinados com filtro por tipo cujas contagens seguem o recorte atual; ordem mais recente primeiro. Cada item tem link mailto: (Responder por e-mail — abre o cliente de e-mail do admin, não envia pelo site), fluxo "Marcar como respondido"/"✎ Editar" com seletor de qual admin respondeu e data/hora editável (fa-admins + super-admins via fa-users), e fluxo "🗑 Excluir" com justificativa obrigatória — soft-delete (excluido:true), reversível via "↺ Restaurar". Calcula e exibe prazo em dias úteis (função diasUteisEntre — sábado/domingo contam como segunda-feira 8h) tanto para pedidos em aberto quanto respondidos.' },
          { name: 'forca-agil/checkin.js',       desc: 'Check-in por QR Code — registra presença por dia via leitura de QR Code; valida a turma consultando turmas/{turmaKey} no Firebase (não uma lista fixa)' },
          { name: 'forca-agil/manual.js',        desc: 'Manual interativo — regras filtráveis por seção e persona, botão exportar todas as regras em CSV. Dados declarativos em array RULES' },
          { name: 'forca-agil/mapa.js',          desc: 'Mapa do site e hierarquia de personas. Dados declarativos em arrays PAGES e HIERARCHY' },
          { name: 'forca-agil/testes.js',        desc: 'Testes automatizados de regressão — técnicos e de comportamento, lista de regras manuais pendentes, botão exportar todos os testes em CSV (automáticos e manuais)' },
          { name: 'forca-agil/init.js',          desc: 'Guarda de acesso ao painel admin — decide entre mostrar o aviso "Acesso Restrito" ou o conteúdo do painel, conforme a sessão. O aviso começa oculto no HTML e só aparece depois que a autenticação termina e confirma que a pessoa não é admin: escuta tanto fa-auth-ready quanto fa-auth-change. Escutar só o fa-auth-change (como era antes) abria uma janela em que o site já estava revelado — o que acontece no fa-auth-ready — mas o guarda ainda não tinha sido atualizado, e o próprio admin via "Acesso Restrito" piscando durante o carregamento.' },
          { name: 'forca-agil/styles.css',       desc: 'Estilos globais — design tokens, layout, componentes, responsividade. Inclui os estilos da Minha Área (.aluno-*): cartões de turma por fase, barra de frequência, cartões informativos de inscrição em análise, lista de espera e boas-vindas' },
          { name: 'forca-agil/pages.css',        desc: 'Estilos específicos de seções — Admin (inputs, tabelas, expand bar, badges), Mapa, Manual, Testes. Inclui o modal de Sorteio (.sorteio-*, com as variações de modo valendo/ensaio) e a aba Sorteios (.sorteios-*)' },
          { name: 'forca-agil/qrcode.min.js',    desc: 'Biblioteca de geração de QR Code (vendorizada localmente — a versão publicada no CDN jsdelivr parou de servir o arquivo build/qrcode.min.js a partir da 1.5.3, quebrando o QR Code do check-in). Usada pelo admin.js.' },
          { name: 'forca-agil/certif.js',        desc: 'Geração de certificados de participação — monta o layout com os 6 campos dinâmicos sobre o template PNG (cert-template-v3.png — a v3 é a v2 com o símbolo da Previ do cabeçalho trocado pelo mesmo do site, assets/previ-symbol.png; a arte é idêntica no restante e as posições dos campos não mudaram), calcula frequência e horas por participante elegível, aciona impressão. API: window.faCertif.' },
        ]
      },
      {
        label: 'Padrões de Código', color: '#4caf7d',
        items: [
          { name: 'IIFE + strict mode',      desc: 'Cada arquivo JS é um módulo isolado em (function(){ "use strict"; })() — sem poluição do escopo global' },
          { name: 'API pública via window',  desc: 'Comunicação entre módulos por window.faAuth, window.faRouter, window.faStore etc. — interface explícita e controlada' },
          { name: 'Dados declarativos',      desc: 'Manual, Mapa e Testes são arrays de objetos JS — fáceis de editar sem mexer na lógica de renderização' },
          { name: 'const/let',              desc: 'Sem var — variáveis imutáveis são const, mutáveis são let. Evita bugs de escopo de função' },
          { name: 'Sem bundler',             desc: 'Scripts carregados via tags <script> no HTML. Sem Node.js, npm ou build step — deploy direto' },
          { name: 'Atributo hidden controlado só por JS', desc: 'Elementos de nav controlados por auth.js (ex: link Admin) usam o atributo hidden para ocultar/exibir. CSS de layout nunca deve sobrescrever com display:block — causaria regressão de segurança (link visível após logout)' },
        ]
      },
      {
        label: 'Padrões de UX', color: '#e05c7f',
        items: [
          { name: 'Navegação por blocos (snap scroll)',       desc: 'Seções de 100vh com scroll-snap-type: y mandatory. Cada seção ocupa a viewport inteira — uma por vez. Teclado ↑↓/Enter navega entre seções. Aplicado em Home (5 seções) e Conteúdos (7 seções).' },
          { name: 'Pontos laterais de navegação',            desc: 'Sidebar com dots clicáveis e setas ↑↓. Tooltip com nome da seção ao passar o mouse. IntersectionObserver atualiza o dot ativo conforme a seção visível. Home: 01–05 (Início, O que é, Como funciona, Jornada, Junte-se). Conteúdos: 01–07.' },
          { name: 'Filtros: dropdown + chip ativo removível', desc: 'Filtros com muitas opções usam select (dropdown) para reduzir poluição visual. O filtro ativo aparece como chip colorido com × para remover. Aplicado no Manual (Seção + Persona).' },
          { name: '"Ver mais / ver menos" por overflow real', desc: 'Descrições exibem no máximo 2 linhas (-webkit-line-clamp). Botão "ver mais" só aparece se o texto realmente transborda — detectado por clone sem clamp comparado com altura clamped. Nunca aparece onde não há conteúdo extra.' },
          { name: 'Hover só em elementos funcionais',        desc: 'Cursor pointer e efeito hover apenas em botões e links reais. Cards decorativos (Como funciona, Repositório) não têm hover — evita confundir o usuário sobre o que é clicável.' },
          { name: 'Acordeão para listas longas',             desc: 'Listas com muitos itens (Ajuda, Manual, Mapa, Arquitetura) usam acordeão para não sobrecarregar a tela. Expandir/Recolher tudo disponível no Admin.' },
          { name: 'Mapa do site: lista vertical (acordeão)', desc: 'Cards de páginas no Mapa do Site em coluna única em vez de grid multi-coluna — facilita leitura sequencial e evita fragmentação da informação.' },
          { name: 'Stepper em linha única horizontal',       desc: 'O fluxo de 4 passos do Treinamento Jedi (login → explorar → ganhar experiência → patentes) fica em uma única linha com flex-wrap: nowrap e flex: 1 1 0 nos steps. Mobile quebra para coluna.' },
          { name: 'Crawl de abertura animado',               desc: 'Texto introdutório em estilo Star Wars sobe lentamente ao entrar na Home. Clique em qualquer ponto pausa/retoma a animação. Botão "Ler texto" alterna para modo estático (sem animação) para acessibilidade.' },
          { name: 'Menu mobile (≤ 600px)',                   desc: 'Media query ≤600px: logo compacto, botões menores, ícone hamburguer sempre visível sem sobreposição com outros elementos do header.' },
          { name: 'Cor de destaque (--accent) só na ação primária', desc: 'O dourado/accent do tema é reservado para UM botão de ação por tela — o que a pessoa mais precisa clicar (ex: "Enviar minha avaliação", "+ Novo evento"). Badges informativos (contagens, status neutros) usam --panel-2 + --line-strong (fundo neutro com borda), nunca --accent sólido — evita competir visualmente com o botão de ação e confundir "isso eu clico" com "isso eu só leio". Corrigido em 16/08/2026: .admin-badge usava --accent sólido para contagens simples (ex: "7 interessados · 20 confirmados"), competindo com os botões primários da mesma tela.' },
          { name: 'Vermelho reservado para erro/perigo, nunca identidade de categoria', desc: 'Vermelho (#ff5252) é universalmente lido como alerta/ação destrutiva/erro em qualquer interface — usá-lo como cor de identidade de uma categoria inteira (ex: badge "Admin", borda esquerda dos cards da categoria Admin no Manual/Mapa) faz todo item daquela categoria parecer um erro, mesmo sendo informação neutra. Com muitos itens repetindo a mesma cor, o sinal de alerta também se perde por repetição. Corrigido em 16/08/2026: badge/borda "Admin" trocado de #ff5252 (vermelho) para #6b7a99 (índigo-acinzentado/steel) em Manual, Mapa e Testes — mantém a categoria distinguível sem tomar emprestado o vocabulário visual de erro. Vermelho continua reservado para usos semanticamente corretos, como o estado "REMOVIDA" no diagrama de estados de turmas-interesse.' },
        ]
      },
      {
        label: 'Glossário de UX/Design', color: '#42a5f5',
        items: [
          { name: 'Abas / Tabs',                  desc: 'Navegação entre painéis diferentes dentro da mesma tela. Ex.: abas do painel Admin (Eventos, Certificados, Repositório, Manual, Mapa, Testes...).' },
          { name: 'Acessibilidade (aria/role)',    desc: 'Atributos que ajudam leitor de tela a entender modais e botões. Ex.: aria-label, role="dialog", aria-hidden nos modais de login e QR Code.' },
          { name: 'Acordeão',                      desc: 'Lista de itens que expandem/recolhem ao clicar. Ex.: perguntas da página Ajuda.' },
          { name: 'Alternar visibilidade de senha', desc: 'Ícone de olho que troca o campo entre texto oculto e visível. Ex.: campo de senha no login/cadastro.' },
          { name: 'Atalho de teclado',             desc: 'Interação por teclado, não só mouse. Ex.: tecla Esc fecha o modal de login/cadastro.' },
          { name: 'Avatar',                        desc: 'Imagem/ícone que representa a pessoa. Ex.: avatar no menu do usuário logado, avatar do resultado do Treinamento Jedi.' },
          { name: 'Badge',                         desc: 'Etiqueta pequena com uma palavra/status. Ex.: "CONFIRMADA" no card do inscrito; badges de perfil no Mapa/Manual.' },
          { name: 'Barra de progresso',            desc: 'Indicador visual de quanto falta para terminar algo. Ex.: progresso do autodiagnóstico no Treinamento Jedi.' },
          { name: 'Canvas',                        desc: 'Desenho feito via JavaScript direto num elemento <canvas>, não é imagem nem CSS. Ex.: fundo de estrelas animado (stars.js).' },
          { name: 'Card',                          desc: 'Caixa de conteúdo autocontida, com borda e fundo próprios. Ex.: cards de turma, cards de valores, cards do Repositório.' },
          { name: 'Checkbox customizado',          desc: 'Caixa de seleção com a cor da marca em vez do estilo padrão do navegador (accent-color). Ex.: aceite de termos no cadastro.' },
          { name: 'Chip',                          desc: 'Botão pequeno em formato de pílula, usado como filtro. Ex.: filtros de tipo no Repositório (Todos/Vídeos/Documentos...).' },
          { name: 'Color-mix()',                   desc: 'Função de CSS que mistura duas cores matematicamente (ex.: "ciano 10% + transparente"). Usada para variações mais claras/transparentes das cores principais sem precisar definir cor nova.' },
          { name: 'Confirmação customizada',       desc: 'Janela de confirmação com o visual da marca, no lugar do confirm()/alert() padrão (feio) do navegador. Usada em todas as ações do admin (remover, desfazer check-in...).' },
          { name: 'Crawl',                         desc: 'Animação de texto em perspectiva que sobe a tela, estilo abertura de Star Wars. Aparece na abertura da página Início.' },
          { name: 'CTA (Call to Action)',          desc: 'Botão de ação principal que leva a pessoa a fazer algo. Ex.: "Juntar-se à Força →", "Ver turmas →".' },
          { name: 'Design tokens',                 desc: 'Paleta central de cores, fontes e espaçamentos reaproveitada no site inteiro (--gold, --cyan, --ink, --font-display...). Mudar um valor atualiza tudo de uma vez.' },
          { name: 'Divider',                       desc: 'Linha ou ícone que separa visualmente duas seções. Ex.: entre os cards de turma e o bloco "A Oficina".' },
          { name: 'Drop-shadow em ícones/SVG',     desc: 'Sombra que segue o contorno real do desenho (não um retângulo). Ex.: brilho ao redor de ícones e do avatar de patente no Treinamento Jedi.' },
          { name: 'Estado ativo de navegação',     desc: 'Destaca visualmente em qual página/seção a pessoa está no menu. Classe .nav-active no menu superior.' },
          { name: 'Estado de validação (sucesso/erro)', desc: 'Cor dedicada para mensagem de sucesso (ciano) e erro no formulário de login/cadastro.' },
          { name: 'Estado vazio',                  desc: 'Mensagem exibida quando uma lista não tem nenhum item ainda. Ex.: painel do admin quando não há interessados numa turma.' },
          { name: 'Eyebrow',                       desc: 'Textinho pequeno acima do título principal, dá contexto antes dele. Ex.: "Esquadrões" acima de "Turmas da Oficina".' },
          { name: 'Folha de estilo de impressão (@media print)', desc: 'Regras de CSS que só valem quando a página é impressa/exportada em PDF. Ex.: certificados de participação, ajustando layout para papel A4 paisagem.' },
          { name: 'Geração de QR Code',            desc: 'Código QR desenhado dinamicamente via canvas. Ex.: botão "QR Code" do admin, aponta pra página de check-in.' },
          { name: 'Glassmorphism (desfoque de fundo)', desc: 'Efeito de vidro fosco/borrado atrás de elementos. Ex.: menu de navegação, modais de login e QR Code (backdrop-filter: blur).' },
          { name: 'Glow',                          desc: 'Efeito de brilho colorido aplicado a um texto ou título. Ex.: glow-gold, glow-cyan, glow-red em destaques de texto.' },
          { name: 'Guia / mascote',                desc: 'Personagem que acompanha e orienta a pessoa pela interface. Ex.: Previx, o droide-guia no Treinamento Jedi.' },
          { name: 'Hero',                          desc: 'Bloco de destaque no topo da página, com título grande, subtítulo e botão de ação. Ex.: topo do Início, topo de cada página interna.' },
          { name: 'Hover',                         desc: 'Reação visual quando o mouse passa por cima de um elemento (muda cor, brilha, etc.). Usado em botões, links do menu, ícones — só em elementos clicáveis de verdade.' },
          { name: 'HTML semântico',                desc: 'Uso das tags corretas de estrutura (header, nav, footer, section, article) em vez de só <div>. Ajuda acessibilidade e leitura por buscadores.' },
          { name: 'HUD',                           desc: 'Painel de status fixo na tela, estilo jogo. Ex.: painel de patente no Treinamento Jedi (rank-hud).' },
          { name: 'Ícones em sprite SVG',          desc: 'Um arquivo SVG único reaproveitado como fonte de todos os ícones, em vez de várias imagens soltas. 55 ícones no site inteiro.' },
          { name: 'IntersectionObserver',          desc: 'Técnica que detecta quando um elemento entra/sai da tela ao rolar. Aciona o "reveal", marca a seção ativa no menu, pausa o crawl fora da tela, conta pontos de leitura.' },
          { name: 'Line-clamp (truncamento de texto)', desc: 'Corta o texto em um número fixo de linhas (ex.: 2) e mostra "..." — o botão "ver mais" só aparece se o texto realmente for cortado. Ex.: descrições no Repositório.' },
          { name: 'localStorage',                  desc: 'Guarda dados no navegador da pessoa, sem precisar de internet. Ex.: progresso do Treinamento Jedi, cache de sessão.' },
          { name: 'Modal',                         desc: 'Janela sobreposta que aparece por cima da página (popup). Ex.: login/cadastro, QR Code do check-in, confirmações do admin.' },
          { name: 'Posicionamento fixo (sticky)',  desc: 'Elemento que gruda no topo da tela enquanto a página rola. Ex.: barra "Expandir/Recolher tudo" no Admin.' },
          { name: 'prefers-reduced-motion',        desc: 'Recurso de acessibilidade que respeita a preferência do sistema operacional de reduzir animação. Desativa o crawl, o "reveal" e a animação do droide-guia para quem ativou essa opção.' },
          { name: 'Reveal',                        desc: 'Animação de aparecer suavemente (fade/slide) quando o elemento entra na tela ao rolar. Aplicada a quase todo bloco de conteúdo.' },
          { name: 'Scroll customizado',            desc: 'Barra de rolagem fina e colorida, no lugar da padrão do navegador. Ex.: menu suspenso (select customizado).' },
          { name: 'Scroll horizontal de tabela',   desc: 'Tabela larga vira rolável de lado em vez de espremer as colunas. Ex.: tabelas do painel Admin em telas menores.' },
          { name: 'Sombra / profundidade (box-shadow)', desc: 'Sombra que dá sensação de elevação a cards e botões.' },
          { name: 'Timer com urgência escalonada', desc: 'Contador regressivo que muda de cor e passa a pulsar conforme o tempo acaba. Ex.: cronômetro dos desafios do Treinamento Jedi.' },
          { name: 'Tipografia fluida (clamp())',   desc: 'Tamanho de fonte/espaçamento que cresce e encolhe suavemente conforme a tela, sem quebrar em degraus (sem media query).' },
          { name: 'Tooltip',                       desc: 'Texto explicativo que aparece ao passar o mouse ou focar um ícone. Ex.: nome da seção nos pontos de navegação lateral.' },
          { name: 'Transição (transition)',        desc: 'Mudança suave entre dois estados (cor, tamanho, opacidade) em vez de trocar abruptamente.' },
          { name: 'Wordmark',                      desc: 'Nome da marca estilizado como texto/logo. Ex.: "FORÇA ÁGIL" no cabeçalho e no hero.' },
        ]
      },
      {
        label: 'Deploy', color: '#e8854a',
        items: [
          { name: 'GitHub',      desc: 'Repositório tati-agil/forca-agil. Branch única: main.' },
          { name: 'Processo',    desc: 'git push para o branch main no GitHub → Firebase Hosting atualiza produção automaticamente.' },
          { name: 'Pre-commit hook', desc: 'Git hook em .git/hooks/pre-commit — roda node --check em todos os forca-agil/*.js antes de cada commit. Bloqueia o commit se houver erro de sintaxe, impedindo deploy de código quebrado' },
          { name: 'URL',         desc: 'https://forca-agil.previ.com.br (domínio personalizado, produção) · https://kyber-agil.web.app (domínio Firebase padrão, mesmo conteúdo)' },
          { name: 'Hospedagem',  desc: 'Firebase Hosting — gratuito no Spark plan, CDN global, HTTPS automático, sem servidor para gerenciar' },
          { name: 'Retenção de versões', desc: 'Cada deploy guarda uma cópia completa do site (~23 MB) como uma nova "versão" no Hosting. O limite de armazenamento do Spark plan é 10 GB. Sem limite de retenção configurado, as versões se acumulam indefinidamente até estourar a cota — quando isso acontece, TODO deploy passa a falhar com erro HTTP 429 e o site congela na última versão publicada, mesmo com os commits chegando normalmente ao GitHub. Em 16/08/2026 isso ocorreu: 780 versões acumuladas somando 11,78 GB bloquearam 8 deploys seguidos. Correção aplicada: limpeza das versões antigas + limite de retenção fixado em 20 versões (site config maxVersions=20), que faz o Firebase apagar as antigas sozinho a cada deploy. Sintoma a reconhecer: alterações commitadas e enviadas que "não aparecem no site" por mais de um deploy — checar as execuções do workflow no GitHub Actions antes de investigar cache ou CSS.' },
          { name: 'Cache (firebase.json)', desc: 'Quatro regras de header: (1) **/*.js → no-cache; (2) **/*.css → no-cache; (3) /index.html → no-cache + Content-Security-Policy personalizada (restringe fontes permitidas de scripts, estilos, fontes e conexões); (4) / (raiz) → as mesmas regras de /index.html.\n\nA regra (4) é essencial e foi adicionada em 16/08/2026: as regras de header do Firebase Hosting casam com o caminho ORIGINAL da requisição, não com o destino do rewrite. Como a SPA usa rotas por hash, a pessoa navega sempre em "/" — que não casava com "/index.html" e por isso recebia o padrão do Hosting para rewrites, Cache-Control: max-age=3600. Resultado: o HTML ficava até 1 hora desatualizado no navegador enquanto JS e CSS chegavam novos, causando episódios de "publiquei mas nada mudou" e possíveis incompatibilidades entre HTML antigo e JS novo. Verificação: curl -sI https://forca-agil.previ.com.br/ deve responder Cache-Control: no-cache, não max-age=3600.' },
          { name: 'Banco',       desc: 'Firebase Realtime Database — gratuito até 1 GB de dados e 10 GB/mês de transferência (Spark plan). Nós principais: fa-users, fa-ranking, fa-progress, fa-admins, eventos (pai das turmas — nome e carga horária), turmas, turmas-interesse, turmas-interesse-log, turmas-config (encerrada, dataConclusao, checkins), turmas-checkin, holocron, pedidos, players, fa-espera.' },
          { name: 'Auth',        desc: 'Firebase Authentication — gratuito ilimitado para Email/Password no Spark plan' },
          { name: 'Regra — pasta de trabalho', desc: 'Sempre usar "Design System (2)". Nunca usar a pasta "(3)" ou qualquer outra.' },
          { name: 'Regra — sem arquivo morto', desc: 'Todo arquivo não carregado/linkado pelo index.html (scaffold, ferramenta externa, protótipo) deve ir pro ignore do firebase.json, não ser publicado por esquecimento.' },
          { name: 'Regra — sem ?v=N nos scripts', desc: 'Não usar query string de versão como cache busting. A configuração no firebase.json resolve de forma permanente e automática.' },
        ]
      },
    ];

    window.faMapaArch = ARCH;
    console.log('[mapa] ARCH sections:', ARCH.map(function(s){ return s.label; }));
    ARCH.forEach(function (section) {
      html += '<div class="arch-section">';
      html += '<div class="arch-section-label" style="--ac:' + section.color + '"><span>' + section.label + '</span><span class="arch-arrow">▾</span></div>';
      html += '<div class="arch-section-body"><div class="arch-grid">';
      section.items.forEach(function (item) {
        html += '<div class="arch-item" id="arch-item-' + slug(section.label + '-' + item.name) + '">';
        html += '<div class="arch-item-name" style="--ac:' + section.color + '">' + esc(item.name) + '</div>';
        html += '<div class="arch-item-desc">' + formatDesc(item.desc) + '</div>';
        html += '</div>';
      });
      html += '</div></div></div>';
    });

    /* ── Diagrama da Arquitetura ── */
    html += '<h3 class="mapa-title" style="margin-top:56px">Diagrama da Arquitetura</h3>';
    html += '<p class="mapa-sub">Gerado dinamicamente a partir da Arquitetura Técnica acima — atualiza automaticamente quando ela mudar.</p>';
    html += '<div class="arq-diagram">';

    /* Camada 1 — CI/CD Pipeline */
    var deployInfo = (ARCH.find(function(s){ return s.label === 'Deploy'; }) || { items: [] }).items;
    var urlDeploy = (deployInfo.find(function(i){ return i.name === 'URL'; }) || { desc: 'kyber-agil.web.app' }).desc;
    var preCommit = (deployInfo.find(function(i){ return i.name === 'Pre-commit hook'; }) || { desc: 'node --check' }).desc.split('—')[0].trim();
    html += '<div class="arq-layer"><div class="arq-layer-label">CI / CD</div><div class="arq-pipeline">';
    [
      { name: 'Local', sub: preCommit },
      { name: 'GitHub', sub: 'tati-agil/forca-agil' },
      { name: 'Actions', sub: 'ubuntu · Node 20' },
      { name: 'Firebase Hosting', sub: esc(urlDeploy) },
    ].forEach(function(step, i, arr) {
      html += '<div class="arq-pipe-step"><strong>' + esc(step.name) + '</strong><span>' + step.sub + '</span></div>';
      if (i < arr.length - 1) html += '<div class="arq-pipe-arrow">→</div>';
    });
    html += '</div></div>';

    /* Camada 2 — Frontend (módulos JS de Estrutura de Arquivos) */
    var estrutura = ARCH.find(function(s){ return s.label === 'Estrutura de Arquivos'; });
    if (estrutura) {
      html += '<div class="arq-layer"><div class="arq-layer-label">Frontend — SPA</div><div class="arq-cards">';
      estrutura.items.forEach(function(item) {
        html += '<button type="button" class="arq-card arq-card--frontend" data-arch-target="arch-item-' + slug(estrutura.label + '-' + item.name) + '">' + esc(item.name) + '</button>';
      });
      html += '</div></div>';
    }

    /* Camada 3 — Firebase serviços (de Tecnologias & Serviços) */
    var tecnologias = ARCH.find(function(s){ return s.label === 'Tecnologias & Serviços'; });
    if (tecnologias) {
      html += '<div class="arq-layer"><div class="arq-layer-label">Firebase — Spark</div><div class="arq-cards">';
      tecnologias.items.forEach(function(item) {
        html += '<button type="button" class="arq-card arq-card--firebase" data-arch-target="arch-item-' + slug(tecnologias.label + '-' + item.name) + '">' + esc(item.name) + '</button>';
      });
      html += '</div></div>';
    }

    html += '</div>'; /* .arq-diagram */

    /* ── Regras Operacionais ── */
    html += '<h3 class="mapa-title" style="margin-top:56px">Regras Operacionais</h3>';
    html += '<p class="mapa-sub">Decisões e restrições registradas sobre como o projeto deve ser mantido.</p>';

    const REGRAS = [
      {
        label: 'Autonomia', color: '#1ab2ae',
        items: [
          { name: 'Usuária não executa nada', desc: 'Claude faz tudo — commits, deploys, edições. A usuária nunca roda comandos manualmente.' },
          { name: 'Sem alterações não autorizadas', desc: 'Nunca mudar funcionalidades existentes sem autorização explícita. Só implementar o que foi pedido.' },
        ]
      },
      {
        label: 'CSS × JS', color: '#9b7fff',
        items: [
          { name: 'CSS não sobrescreve hidden de nav', desc: 'Elementos de navegação ocultados por auth.js via atributo hidden (ex: link Admin) nunca devem ter display:block forçado por CSS — causaria regressão de segurança: link visível após logout.' },
        ]
      },
      {
        label: 'CSV', color: '#26a69a',
        items: [
          { name: 'Encoding UTF-8 BOM', desc: 'Todos os CSVs usam UTF-8 BOM (\\uFEFF) via Blob. Nunca usar Windows-1252 (Uint8Array) nem sep=; como primeira linha — o sep= fazia Excel abrir em modo protegido/somente leitura.' },
          { name: 'Arquivo sempre editável', desc: 'CSV deve abrir normalmente no Excel em modo edição. Não usar extensão .xls — usar .csv para evitar conflito de formato.' },
        ]
      },
      {
        label: 'Tabelas', color: '#42a5f5',
        items: [
          { name: 'Scroll horizontal automático', desc: 'Toda tabela do admin é envolta em div.table-scroll-wrap (overflow-x:auto). Quando o conteúdo exceder o viewport, a tabela rola horizontalmente — sem comprimir colunas e sem breakpoint fixo.' },
        ]
      },
    ];

    REGRAS.forEach(function (section) {
      html += '<div class="arch-section">';
      html += '<div class="arch-section-label" style="--ac:' + section.color + '"><span>' + section.label + '</span><span class="arch-arrow">▾</span></div>';
      html += '<div class="arch-section-body"><div class="arch-grid">';
      section.items.forEach(function (item) {
        html += '<div class="arch-item" id="arch-item-' + slug(section.label + '-' + item.name) + '">';
        html += '<div class="arch-item-name" style="--ac:' + section.color + '">' + esc(item.name) + '</div>';
        html += '<div class="arch-item-desc">' + formatDesc(item.desc) + '</div>';
        html += '</div>';
      });
      html += '</div></div></div>';
    });

    html += '</div>';

    container.innerHTML = html;

    /* Acordeão dos blocos principais (h3.mapa-title) — recolhidos por padrão */
    Array.from(container.querySelectorAll('h3.mapa-title')).forEach(function (h3) {
      var acc = document.createElement('div');
      acc.className = 'mapa-top-acc';
      var hdr = document.createElement('div');
      hdr.className = 'mapa-top-acc-hdr';
      hdr.innerHTML = '<span class="mapa-top-acc-icon">▸</span><span class="mapa-top-acc-label">' + h3.innerHTML + '</span>';
      var body = document.createElement('div');
      body.className = 'mapa-top-acc-body';
      body.style.display = 'none';
      var sib = h3.nextElementSibling;
      while (sib && !sib.matches('h3.mapa-title')) {
        var nxt = sib.nextElementSibling;
        body.appendChild(sib);
        sib = nxt;
      }
      acc.appendChild(hdr);
      acc.appendChild(body);
      h3.parentNode.insertBefore(acc, h3);
      h3.parentNode.removeChild(h3);
      hdr.addEventListener('click', function () {
        var open = body.style.display !== 'none';
        body.style.display = open ? 'none' : '';
        hdr.querySelector('.mapa-top-acc-icon').textContent = open ? '▸' : '▾';
      });
    });

    /* Caixas do diagrama levam até o card correspondente em Arquitetura Técnica,
       em vez de só repetir o nome do arquivo/serviço */
    container.querySelectorAll('.arq-card[data-arch-target]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = document.getElementById(btn.dataset.archTarget);
        if (!target) return;
        var section = target.closest('.arch-section');
        if (section) section.classList.add('open');
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('arch-item--flash');
        setTimeout(function () { target.classList.remove('arch-item--flash'); }, 1600);
      });
    });

    /* Expandir / Recolher tudo no Mapa */
    var mapaExpandAll = document.getElementById('mapaExpandAll');
    if (mapaExpandAll) {
      mapaExpandAll.addEventListener('click', function () {
        container.querySelectorAll('.mapa-page, .arch-section, .mapa-level, .mapa-site-page, .mapa-admin-subgroup').forEach(function (el) { el.classList.add('open'); });
        container.querySelectorAll('.mapa-top-acc-body').forEach(function (b) { b.style.display = ''; });
        container.querySelectorAll('.mapa-top-acc-icon').forEach(function (i) { i.textContent = '▾'; });
      });
    }
    var mapaCollapseAll = document.getElementById('mapaCollapseAll');
    if (mapaCollapseAll) {
      mapaCollapseAll.addEventListener('click', function () {
        container.querySelectorAll('.mapa-page, .arch-section, .mapa-level, .mapa-site-page, .mapa-admin-subgroup').forEach(function (el) { el.classList.remove('open'); });
        container.querySelectorAll('.mapa-top-acc-body').forEach(function (b) { b.style.display = 'none'; });
        container.querySelectorAll('.mapa-top-acc-icon').forEach(function (i) { i.textContent = '▸'; });
      });
    }

    /* Export mapa para CSV */
    const exportBtn = document.getElementById('mapaExportBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        if (!window.faToXls) return;
        const rows = [];

        /* Hierarquia */
        HIERARCHY.forEach(function (level) {
          level.adds.forEach(function (a) {
            rows.push(['Hierarquia', level.label, a, '']);
          });
        });

        /* Mapa do site */
        PAGES.forEach(function (page) {
          page.features.forEach(function (f) {
            const minPersona = (function () {
              const order = ['visitante', 'logado', 'admin'];
              const idx = f.p.map(function (k) { return order.indexOf(k); }).filter(function (i) { return i >= 0; });
              return idx.length ? order[Math.min.apply(null, idx)] : '';
            })();
            rows.push(['Mapa do Site', page.label, f.label, minPersona]);
          });
        });

        /* Arquitetura técnica */
        var ARCH_LABELS = ['Linguagens', 'Tecnologias & Serviços', 'Estrutura de Arquivos', 'Padrões de Código', 'Deploy'];
        var archSections = container.querySelectorAll('.arch-section');
        archSections.forEach(function (sec, i) {
          var labelEl = sec.querySelector('.arch-section-label span');
          var sLabel = labelEl ? labelEl.textContent.trim() : ('Arquitetura ' + i);
          sec.querySelectorAll('.arch-item').forEach(function (item) {
            var name = item.querySelector('.arch-item-name');
            var desc = item.querySelector('.arch-item-desc');
            rows.push(['Arquitetura', sLabel, name ? name.textContent.trim() : '', desc ? desc.textContent.trim() : '']);
          });
        });

        window.faToXls(
          ['Categoria', 'Seção', 'Item', 'Nível mínimo / Detalhe'],
          rows,
          'mapa-forca-agil-' + new Date().toISOString().slice(0, 10) + '.csv'
        );
      });
    }
  }

  window.faMapaPages = PAGES;

  window.faInitMapa = function () {
    render();
    const container = document.getElementById('adminMapa');
    if (!container || container._mapaListenerBound) return;
    container._mapaListenerBound = true;
    container.addEventListener('click', function (e) {
      const pageTitle = e.target.closest('.mapa-page-title');
      if (pageTitle) { pageTitle.closest('.mapa-page').classList.toggle('open'); return; }
      const subhead = e.target.closest('.mapa-subhead');
      if (subhead) { subhead.closest('.mapa-admin-subgroup').classList.toggle('open'); return; }
      const archLabel = e.target.closest('.arch-section-label');
      if (archLabel) { archLabel.closest('.arch-section').classList.toggle('open'); return; }
      const levelHead = e.target.closest('.mapa-level-head');
      if (levelHead) { levelHead.closest('.mapa-level').classList.toggle('open'); return; }

      /* Filtro por persona */
      const chip = e.target.closest('.mapa-filter-chip');
      if (chip) {
        container.querySelectorAll('.mapa-filter-chip').forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        var persona = chip.dataset.persona;
        var grid = container.querySelector('#mapaGrid');
        if (!grid) return;
        grid.querySelectorAll('.mapa-feature').forEach(function (feat) {
          var ps = feat.dataset.personas || '';
          var show = persona === 'todos' || ps.indexOf(persona) !== -1;
          feat.style.display = show ? '' : 'none';
        });
        /* Subgrupos ADMIN · <aba>: mostrar só se tiver feature visível dentro */
        grid.querySelectorAll('.mapa-admin-subgroup').forEach(function (sub) {
          var hasVisible = Array.prototype.some.call(sub.querySelectorAll('.mapa-feature'), function (f) { return f.style.display !== 'none'; });
          sub.style.display = hasVisible ? '' : 'none';
        });
        /* Atualizar contagem de cada card */
        grid.querySelectorAll('.mapa-page').forEach(function (page) {
          var visible = page.querySelectorAll('.mapa-feature:not([style*="display: none"]):not([style*="display:none"])').length;
          var countEl = page.querySelector('.mapa-page-count');
          if (countEl) countEl.textContent = '(' + visible + ')';
          page.style.display = visible === 0 ? 'none' : '';
        });
      }
    });
  };
})();
