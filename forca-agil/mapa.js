/* Força Ágil — Mapa do Site + Hierarquia de Personas */
(function () {
  'use strict';

  const PERSONAS = [
    { key: 'visitante',   label: 'Visitante',      color: '#888888', desc: 'Não cadastrado / não logado' },
    { key: 'logado',      label: 'Usuário logado', color: '#1ab2ae', desc: 'Cadastrado com @previ.com.br' },
    { key: 'colaborador', label: 'Colaborador',    color: '#f5c542', desc: 'Indicado como colaborador pelo Admin' },
    { key: 'admin',       label: 'Admin',          color: '#ff5252', desc: 'Colaborador com acesso administrativo' },
  ];

  const HIERARCHY = [
    { key: 'visitante',   label: 'Visitante',      color: '#888888',
      adds: ['Ver páginas públicas (Início, Turmas, Conteúdos, Repositório, Ranking)', 'Cadastrar conta (@previ.com.br)', 'Fazer login', 'Recuperar senha por e-mail (autoatendimento)'] },
    { key: 'logado',      label: 'Usuário logado', color: '#1ab2ae',
      adds: ['Acessar e jogar o Treinamento Jedi', 'Ganhar pontos de experiência por conteúdos lidos', 'Adicionar e remover conteúdos no Repositório', 'Registrar interesse em turmas', 'Revelar patente (resultado fixo, só seu)', 'Publicar no ranking (opcional, separado de revelar)'] },
    { key: 'colaborador', label: 'Colaborador',    color: '#f5c542',
      adds: ['Expandir Agenda D1–D5 na página Turmas'] },
    { key: 'admin',       label: 'Admin',          color: '#ff5252',
      adds: ['Acessar o Painel Admin', 'Gerenciar colaboradores e admins', 'Ver todos os cadastrados (não só colaboradores)', 'Ver interessados por turma', 'Moderar Repositório (ocultar/restaurar/deletar)', 'Resetar progresso de qualquer cadastrado', 'Enviar e-mail de redefinição de senha para qualquer cadastrado'] },
  ];

  const PAGES = [
    { label: 'INÍCIO', color: '#1ab2ae',
      features: [
        { label: 'Ver página completa',                  p: ['visitante','logado','colaborador','admin'] },
        { label: 'Subtítulo do hero: "Desenvolva sua agilidade na prática"', p: ['visitante','logado','colaborador','admin'] },
        { label: 'Botão "Criar conta" no CTA → abre modal de cadastro',   p: ['visitante'] },
        { label: 'Botão "Entrar" no CTA → abre modal de login',            p: ['visitante'] },
        { label: 'Botão "Conhecer a iniciativa" → rola até "O que é"',    p: ['visitante','logado','colaborador','admin'] },
        { label: 'Botão "Repetir abertura" → replay do crawl de intro',   p: ['visitante','logado','colaborador','admin'] },
        { label: 'Crawl: botões "≡ Ler texto" / "⏸ Pausar" / "↻ Repetir abertura" exibidos lado a lado (layout horizontal)', p: ['visitante','logado','colaborador','admin'] },
        { label: 'Crawl: clicar na área ou botão "⏸ Pausar" → pausa/retoma animação', p: ['visitante','logado','colaborador','admin'] },
        { label: 'Crawl: botão "≡ Ler texto" → exibe texto estático sem perspectiva; "✕ Fechar texto" retorna ao crawl', p: ['visitante','logado','colaborador','admin'] },
        { label: '3 cards "Como funciona" → links para Conteúdos / Repositório / Treinamento Jedi (sem hover — cards decorativos)', p: ['visitante','logado','colaborador','admin'] },
        { label: 'Seção "O que está acontecendo" (Destaques) removida',   p: [] },
        { label: 'CTA final simplificado: título + 1 frase + botões "Criar conta" e "Entrar"', p: ['visitante','logado','colaborador','admin'] },
        { label: 'Link no rodapé para previ.com.br (externo, presente em todas as páginas)', p: ['visitante','logado','colaborador','admin'] },
      ]
    },
    { label: 'TURMAS', color: '#f5c542',
      features: [
        { label: 'Ver turmas, datas e descrição',        p: ['visitante','logado','colaborador','admin'] },
        { label: 'Bloco "Como funciona a oficina" antes da agenda: 4 métricas (5 dias, 4h, Prática, Opcional) + descrição', p: ['visitante','logado','colaborador','admin'] },
        { label: '"Tenho interesse" sem login → exibe mensagem "Faça login para registrar seu interesse" + abre modal login', p: ['visitante'] },
        { label: 'Registrar interesse → botão vira "Remover interesse" (status: interessado)', p: ['logado','colaborador','admin'] },
        { label: 'Remover interesse → botão volta a "Tenho interesse" (log mantido)', p: ['logado','colaborador','admin'] },
        { label: 'Turma finalizada → botão vira "✓ Inscrita" (desabilitado)', p: ['logado','colaborador','admin'] },
        { label: 'Check-in via QR Code no dia do evento → botão vira "✓ Presente" (por dia)', p: ['logado','colaborador','admin'] },
        { label: 'Expandir Agenda D1–D5',                p: ['colaborador','admin'] },
      ]
    },
    { label: 'CONTEÚDOS', color: '#4caf7d',
      features: [
        { label: 'Ler as 6 seções numeradas (01 Mapa da Galáxia → 06 A Trilogia)',  p: ['visitante','logado','colaborador','admin'] },
        { label: 'Ganhar +5 pts por seção lida (badge "✓ +5 pts" aparece após leitura)', p: ['logado','colaborador','admin'] },
        { label: 'Link externo "Ler os 4 valores na íntegra" (agilemanifesto.org)', p: ['visitante','logado','colaborador','admin'] },
        { label: 'Link externo "Ler os 12 princípios na íntegra" (agilemanifesto.org)', p: ['visitante','logado','colaborador','admin'] },
      ]
    },
    { label: 'REPOSITÓRIO', color: '#e8854a',
      features: [
        { label: 'Ver todos os conteúdos',               p: ['visitante','logado','colaborador','admin'] },
        { label: 'Filtrar por tipo (Todos/Vídeos/Documentos/Ferramentas/Livros)', p: ['visitante','logado','colaborador','admin'] },
        { label: '"Adicionar" sem login → exibe mensagem "Faça login para contribuir com o repositório" + abre modal login', p: ['visitante'] },
        { label: 'Adicionar conteúdo ao Holocron',       p: ['logado','colaborador','admin'] },
        { label: 'Remover próprio conteúdo',             p: ['logado','colaborador','admin'] },
      ]
    },
    { label: 'TREINAMENTO JEDI', color: '#e05c7f',
      features: [
        { label: 'Welcome screen: texto explicativo (Marilia) + botão "Quero jogar" → abre modal login (visitante)', p: ['visitante'] },
        { label: 'Conteúdo do jogo oculto para visitantes (exibido apenas após login)',  p: ['visitante'] },
        { label: 'Autodiagnóstico (1×)',                   p: ['logado','colaborador','admin'] },
        { label: 'Missões (1×)',                          p: ['logado','colaborador','admin'] },
        { label: 'Kyber Game — minigame de perguntas e respostas sobre agilidade (1×)', p: ['logado','colaborador','admin'] },
        { label: 'Ver painel de patente em tempo real (pontos de experiência)', p: ['logado','colaborador','admin'] },
        { label: 'Revelar patente (fixa resultado, só para si — não publica)', p: ['logado','colaborador','admin'] },
        { label: 'Publicar no ranking (opcional, exige ter revelado)', p: ['logado','colaborador','admin'] },
      ]
    },
    { label: 'RANKING', color: '#57aaff',
      features: [
        { label: 'Ver ranking completo',                 p: ['visitante','logado','colaborador','admin'] },
        { label: 'Identificação da própria linha no ranking', p: ['logado','colaborador','admin'] },
        { label: 'Imagem da patente (personagem SVG: Youngling/Padawan/Cavaleiro/Mestre) exibida ao lado do nome da patente (coluna direita) em todas as listagens do ranking', p: ['visitante','logado','colaborador','admin'] },
        { label: 'Ver patente de todos',                 p: ['visitante','logado','colaborador','admin'] },
      ]
    },
    { label: 'ADMIN', color: '#ff5252',
      features: [
        { label: 'Aba Turmas — cards por turma com badge ABERTA/FINALIZADA e contagem de inscritos', p: ['admin'] },
        { label: 'Finalizar inscrição da turma — converte todos os interessados em inscritos e bloqueia novas inscrições', p: ['admin'] },
        { label: 'Reabrir turma — volta inscritos para interessado e permite novas inscrições', p: ['admin'] },
        { label: 'Abrir check-in do dia — select com os dias da turma + botão confirmar; admin escolhe qualquer dia (passado ou futuro); define diaAtivo em turmas-config', p: ['admin'] },
        { label: 'Fechar check-in do dia — limpa diaAtivo; impede novos check-ins', p: ['admin'] },
        { label: 'QR Code — gera QR único por turma (popup); participante escaneia no dia com check-in aberto', p: ['admin'] },
        { label: 'Tabela de presença por dia — colunas por data (✓ qr / ✓ adm / —), frequência X/5 colorida', p: ['admin'] },
        { label: 'Registrar presença retroativa — admin clica em "—" de qualquer pessoa/dia e confirma manualmente', p: ['admin'] },
        { label: 'Adicionar participante após inscrições fechadas — botão "＋ Participante" grava direto com status inscrito sem reabrir turma', p: ['admin'] },
        { label: 'Remover inscrito da turma finalizada — botão "Remover" na tabela de presença marca removed:true sem afetar demais inscritos', p: ['admin'] },
        { label: 'Critério de presença configurável — CRITERIO_PRESENCA = 0.75 (75%, default 4/5 dias)', p: ['admin'] },
        { label: 'Exportar CSV estado atual (com colunas de presença por dia e frequência)', p: ['admin'] },
        { label: 'Exportar CSV Histórico de ações (adicionou/removeu interesse)', p: ['admin'] },
        { label: 'Exportar CSV individual por turma', p: ['admin'] },
        { label: 'Gerar certificados de participação em lote — botão "Certificados" na turma finalizada; filtra quem atingiu ≥ 75%; abre nova aba com 1 certificado por página (A4 paisagem) prontos para imprimir/salvar como PDF', p: ['admin'] },
        { label: 'Moderar repositório — ocultar/restaurar seeds curados (fa-seeds-hidden)', p: ['admin'] },
        { label: 'Moderar repositório — deletar permanentemente seeds curados (fa-seeds-deleted, sem restauração)', p: ['admin'] },
        { label: 'Moderar repositório — ocultar/restaurar conteúdo de usuários (fa-holocron-hidden)', p: ['admin'] },
        { label: 'Moderar repositório — deletar permanentemente conteúdo de usuários (holocron)', p: ['admin'] },
        { label: 'Adicionar / remover colaboradores, com busca em tempo real por nome ou e-mail', p: ['admin'] },
        { label: 'Ver todos os cadastrados, com filtro de busca e coluna XP — basta ter feito qualquer atividade para o XP aparecer (amarelo = publicou no ranking, ciano = tem XP mas não publicou, "—" = sem XP)', p: ['admin'] },
        { label: 'Redefinir senha de qualquer cadastrado (e-mail)', p: ['admin'] },
        { label: 'Resetar progresso de qualquer cadastrado — apaga fa-progress, remove do ranking (players via query por email), escreve fa-reset-signal/<eKey> para notificar a pessoa logada; a página dela recarrega automaticamente — todos os jogos reabilitados sem ação da pessoa', p: ['admin'] },
        { label: 'Adicionar / remover admins',                p: ['admin'] },
        { label: 'Abas do painel — 8 abas (Turmas, Repositório, Colaboradores, Cadastrados, Administradores, Manual, Mapa, Testes); no mobile quebram em 2 linhas com fonte reduzida', p: ['admin'] },
        { label: 'Aba Manual — checklist de regras de comportamento + Expandir/Recolher tudo', p: ['admin'] },
        { label: 'Aba Mapa — mapa do site e hierarquia de personas + Expandir/Recolher tudo', p: ['admin'] },
        { label: 'Aba Testes — testes automatizados e checklist manual + Expandir/Recolher tudo', p: ['admin'] },
      ]
    },
    { label: 'CADASTRAR / ENTRAR', color: '#9b7fff',
      features: [
        { label: 'Ver botões no menu',                        p: ['visitante'] },
        { label: 'Cadastrar conta (@previ.com.br)',           p: ['visitante'] },
        { label: 'Fazer login',                               p: ['visitante'] },
        { label: 'Esqueci minha senha — link por e-mail',     p: ['visitante'] },
        { label: 'Inicial e nome no menu — no lugar dos botões Entrar/Cadastrar', p: ['logado','colaborador','admin'] },
        { label: 'Ver link "Admin" no menu de navegação (desktop sempre visível; mobile: aparece ao abrir o menu)', p: ['admin'] },
        { label: 'Botão Sair',                                p: ['logado','colaborador','admin'] },
      ]
    },
  ];

  /* Badge de nível mínimo para o mapa do site */
  const P_ORDER = ['visitante', 'logado', 'colaborador', 'admin'];
  const P_COLOR = { visitante: '#888888', logado: '#1ab2ae', colaborador: '#f5c542', admin: '#ff5252' };
  const P_LABEL = { visitante: 'Visitante', logado: 'Logado', colaborador: 'Colaborador', admin: 'Admin' };

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

    /* Botão export */
    html += '<div style="margin-bottom:28px">';
    html += '<button class="btn btn--sm" id="mapaExportBtn">⬇ Exportar Excel (mapa completo)</button>';
    html += '</div>';

    /* ── Hierarquia ── */
    html += '<h3 class="mapa-title">Hierarquia de Personas</h3>';
    html += '<p class="mapa-sub">Cada nível inclui tudo do anterior e acrescenta os itens abaixo.</p>';
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

    /* ── Mapa do site ── */
    html += '<h3 class="mapa-title" style="margin-top:48px">Mapa do Site</h3>';

    /* Legenda dos badges */
    html += '<div class="mapa-legend">';
    html += '<span class="mapa-legend-item"><span class="mapa-badge" style="--bc:#888">Visitante</span> não autenticado (exclusivo para quem não entrou)</span>';
    html += '<span class="mapa-legend-item"><span class="mapa-badge" style="--bc:#1ab2ae">Logado +</span> qualquer usuário autenticado — colaboradores e admins também são logados</span>';
    html += '<span class="mapa-legend-item"><span class="mapa-badge" style="--bc:#f5c542">Colaborador +</span> logado com perfil de colaborador — admins também são colaboradores</span>';
    html += '<span class="mapa-legend-item"><span class="mapa-badge" style="--bc:#ff5252">Admin</span> colaborador com acesso administrativo</span>';
    html += '</div>';

    /* Grid de páginas */
    html += '<div class="mapa-grid">';
    PAGES.forEach(function (page, idx) {
      html += '<div class="mapa-page" style="--pc:' + page.color + '">';
      html += '<div class="mapa-page-title"><span>' + page.label + '</span><span class="mapa-page-arrow">▾</span></div>';
      html += '<div class="mapa-page-body">';
      page.features.forEach(function (f) {
        html += '<div class="mapa-feature"><span class="mapa-feature-label">' + f.label + '</span>' + levelBadge(f.p) + '</div>';
      });
      html += '</div>';
      html += '</div>';
    });
    html += '</div>';

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
          { name: 'Firebase Authentication', desc: 'Login e cadastro por e-mail/senha. Redefinição de senha via link automático. Gratuito (Spark plan)' },
          { name: 'Firebase Realtime Database', desc: 'Armazena perfis (fa-users), progresso de XP, ranking, repositório (fa-holocron), colaboradores, admins e interesses por turma' },
          { name: 'Firebase Hosting',        desc: 'Hospedagem do site em kyber-agil.web.app. CDN global, HTTPS automático' },
          { name: 'GitHub',                  desc: 'Repositório do código-fonte. Branch principal: main' },
        ]
      },
      {
        label: 'Estrutura de Arquivos', color: '#f5c542',
        items: [
          { name: 'index.html',              desc: 'Entrada única da aplicação. Contém todo o HTML, carrega os scripts e gerencia as seções por hash (#inicio, #turmas…)' },
          { name: 'forca-agil/auth.js',      desc: 'Autenticação — login, cadastro, logout, redefinição de senha. API pública: window.faAuth' },
          { name: 'forca-agil/firebase.js',  desc: 'Progresso, XP e ranking — salva/carrega dados do Firebase. API: window.faLoadProgress, window.faSyncProgress, window.faSyncPlayer, window.faCleanRanking' },
          { name: 'forca-agil/router.js',    desc: 'Roteamento por hash — controla qual seção da página está visível. API: window.faRouter' },
          { name: 'forca-agil/app.js',       desc: 'Interações de UI — nav scroll, reveals, acordeões de agenda, rastreamento de XP de conteúdos, botões de interesse em turmas, crawl de abertura (pausar/retomar no clique, botão "Ler texto" para modo estático)' },
          { name: 'forca-agil/home-nav.js',  desc: 'Navegação assistida entre seções da Home — pontos laterais, botão Continuar animado, teclado ↑↓/Enter, IntersectionObserver para dot ativo' },
          { name: 'forca-agil/game-data.js',  desc: 'Dados do Treinamento Jedi — dimensões, patentes e missões (perguntas e respostas). Expõe window.faGameData' },
          { name: 'forca-agil/game.js',      desc: 'Treinamento Jedi — lógica de XP, autodiagnóstico, missões, painel de patente e revelar patente. Lê dados de window.faGameData' },
          { name: 'forca-agil/kyber.js',     desc: 'Kyber Game — 25 desafios com timer de 30s, cálculo de XP' },
          { name: 'forca-agil/repo.js',      desc: 'Repositório (Holocron) — listagem, adição, remoção de conteúdos, XP por contribuição' },
          { name: 'forca-agil/admin.js',     desc: 'Painel Admin — interessados, moderação de repositório, gestão de colaboradores e admins, XP de Cadastrados (publicado ou calculado de fa-progress), exportação CSV Windows-1252 via Uint8Array+URL.createObjectURL (window.faToXls — compartilhada por Manual e Testes; acentos e travessão corretos no Excel pt-BR sem BOM), barra expandir/recolher com botões por seção' },
          { name: 'forca-agil/manual.js',    desc: 'Manual interativo — regras filtráveis por seção e persona, botão exportar todas as regras em CSV. Dados declarativos em array RULES' },
          { name: 'forca-agil/mapa.js',      desc: 'Mapa do site e hierarquia de personas. Dados declarativos em arrays PAGES e HIERARCHY' },
          { name: 'forca-agil/testes.js',    desc: 'Testes automatizados de regressão — técnicos e de comportamento, lista de regras manuais pendentes, botão exportar todos os testes em CSV (automáticos e manuais)' },
          { name: 'forca-agil/stars.js',     desc: 'Animação de estrelas do fundo (canvas)' },
          { name: 'forca-agil/styles.css',   desc: 'Estilos globais — design tokens, layout, componentes, responsividade' },
          { name: 'forca-agil/pages.css',    desc: 'Estilos específicos de seções — Admin (inputs, tabelas, expand bar, badges), Mapa, Manual, Testes' },
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
        ]
      },
      {
        label: 'Deploy', color: '#e8854a',
        items: [
          { name: 'Processo',    desc: 'git push para o branch main no GitHub → Firebase Hosting atualiza automaticamente o site em segundos' },
          { name: 'Pre-commit hook', desc: 'Git hook em .git/hooks/pre-commit — roda node --check em todos os forca-agil/*.js antes de cada commit. Bloqueia o commit se houver erro de sintaxe, impedindo deploy de código quebrado' },
          { name: 'URL',         desc: 'https://kyber-agil.web.app (produção)' },
          { name: 'Hospedagem',  desc: 'Firebase Hosting — gratuito no Spark plan, CDN global, HTTPS automático, sem servidor para gerenciar' },
          { name: 'Banco',       desc: 'Firebase Realtime Database — gratuito até 1 GB de dados e 10 GB/mês de transferência (Spark plan)' },
          { name: 'Auth',        desc: 'Firebase Authentication — gratuito ilimitado para Email/Password no Spark plan' },
        ]
      },
    ];

    ARCH.forEach(function (section) {
      html += '<div class="arch-section">';
      html += '<div class="arch-section-label" style="--ac:' + section.color + '"><span>' + section.label + '</span><span class="arch-arrow">▾</span></div>';
      html += '<div class="arch-section-body"><div class="arch-grid">';
      section.items.forEach(function (item) {
        html += '<div class="arch-item">';
        html += '<div class="arch-item-name" style="--ac:' + section.color + '">' + item.name + '</div>';
        html += '<div class="arch-item-desc">' + item.desc + '</div>';
        html += '</div>';
      });
      html += '</div></div></div>';
    });

    html += '</div>';

    /* ── Regras Operacionais ── */
    html += '<h3 class="mapa-title" style="margin-top:56px">Regras Operacionais</h3>';
    html += '<p class="mapa-sub">Decisões e restrições registradas sobre como o projeto deve ser mantido.</p>';

    const REGRAS = [
      {
        label: 'Deploy', color: '#e8854a',
        items: [
          { name: 'Pasta de trabalho',  desc: 'Sempre usar "Design System (2)". Nunca usar "Design System (3)" ou qualquer outra.' },
          { name: 'Processo de deploy', desc: 'git push para o branch main — o Firebase Hosting atualiza automaticamente. Nunca publicar de outra forma.' },
        ]
      },
      {
        label: 'Cache', color: '#ff5252',
        items: [
          { name: 'Sempre no-cache',     desc: 'firebase.json deve ter Cache-Control: no-cache para JS, CSS e HTML. Usuária não sabe dar refresh manual — o site nunca pode depender de cache do browser.' },
          { name: 'Sem ?v=N nos scripts', desc: 'Não usar query string de versão como solução de cache. A configuração no firebase.json resolve de forma permanente e automática.' },
        ]
      },
      {
        label: 'Autonomia', color: '#1ab2ae',
        items: [
          { name: 'Usuária não executa nada', desc: 'Claude faz tudo — commits, deploys, edições. A usuária nunca roda comandos manualmente.' },
          { name: 'Sem alterações não autorizadas', desc: 'Nunca mudar funcionalidades existentes sem autorização explícita. Só implementar o que foi pedido.' },
        ]
      },
    ];

    REGRAS.forEach(function (section) {
      html += '<div class="arch-section">';
      html += '<div class="arch-section-label" style="--ac:' + section.color + '"><span>' + section.label + '</span><span class="arch-arrow">▾</span></div>';
      html += '<div class="arch-section-body"><div class="arch-grid">';
      section.items.forEach(function (item) {
        html += '<div class="arch-item">';
        html += '<div class="arch-item-name" style="--ac:' + section.color + '">' + item.name + '</div>';
        html += '<div class="arch-item-desc">' + item.desc + '</div>';
        html += '</div>';
      });
      html += '</div></div></div>';
    });

    html += '</div>';

    html += '</div>';
    container.innerHTML = html;

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
              const order = ['visitante', 'logado', 'colaborador', 'admin'];
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
      const archLabel = e.target.closest('.arch-section-label');
      if (archLabel) { archLabel.closest('.arch-section').classList.toggle('open'); return; }
      const levelHead = e.target.closest('.mapa-level-head');
      if (levelHead) { levelHead.closest('.mapa-level').classList.toggle('open'); }
    });
  };
})();
