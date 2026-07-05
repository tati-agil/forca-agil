/* Força Ágil — Mapa do Site + Hierarquia de Personas */
(function () {
  'use strict';

  const PERSONAS = [
    { key: 'visitante',  label: 'Visitante',                      color: '#888888', desc: 'Não cadastrado / não logado' },
    { key: 'logado',     label: 'Usuário logado (sem turma)',      color: '#1ab2ae', desc: 'Cadastrado com @previ.com.br, sem turma confirmada' },
    { key: 'inscrito',   label: 'Usuário inscrito (turma confirmada)', color: '#4caf7d', desc: 'Logado e com turma confirmada pelo admin' },
    { key: 'admin',      label: 'Admin',                           color: '#ff5252', desc: 'Usuário com acesso administrativo' },
  ];

  const HIERARCHY = [
    { key: 'visitante',   label: 'Visitante',      color: '#888888',
      adds: ['Ver páginas públicas (Início, Turmas, Ajuda)', 'Cadastrar conta (@previ.com.br)', 'Fazer login', 'Recuperar senha por e-mail (autoatendimento)'] },
    { key: 'logado',  label: 'Usuário logado (sem turma)', color: '#1ab2ae',
      adds: ['Acessar o Repositório', 'Adicionar conteúdos e remover os próprios no Repositório', 'Manifestar interesse em até 3 turmas', 'Remover interesse em turmas'] },
    { key: 'inscrito', label: 'Usuário inscrito (turma confirmada)', color: '#4caf7d',
      adds: ['Acessar Conteúdos', 'Acessar Treinamento Jedi (autodiagnóstico 0–60)', 'Revelar patente (resultado fixo e bloqueado — não pode refazer sem reset do admin)', 'Vê apenas o card da própria turma na página Turmas — sem botões de interesse'] },
    { key: 'admin',   label: 'Admin',          color: '#ff5252',
      adds: ['Acessar o Painel Admin', 'Ver todos os cadastrados', 'Ver interessados por turma', 'Moderar Repositório (ocultar/restaurar/deletar)', 'Resetar progresso de qualquer cadastrado', 'Enviar e-mail de redefinição de senha para qualquer cadastrado', 'Gerenciar lista de admins (apenas tatianefdirene e danielfrazao — restrito por regra Firebase)'] },
  ];

  /* Ordem alfabética por label, igual ao Manual e às Regras */
  const PAGES = [
    { label: 'ADMIN', color: '#ff5252',
      features: [
        { label: '7 abas no total (Turmas, Repositório, Cadastrados, Administradores, Manual, Mapa, Testes); no mobile quebram em 2 linhas', p: ['admin'] },
        { label: 'Expandir tudo — abre de uma vez os itens retráteis da aba ativa', p: ['admin'] },
        { label: 'Recolher tudo — fecha de uma vez os itens retráteis da aba ativa', p: ['admin'] },
        { label: 'Aba Turmas — finalizar inscrição da turma', p: ['admin'] },
        { label: 'Aba Turmas — reabrir turma', p: ['admin'] },
        { label: 'Aba Turmas — abrir check-in do dia', p: ['admin'] },
        { label: 'Aba Turmas — fechar check-in do dia', p: ['admin'] },
        { label: 'Aba Turmas — gerar QR Code da turma', p: ['admin'] },
        { label: 'Aba Turmas — tabela de presença, registro manual', p: ['admin'] },
        { label: 'Aba Turmas — tabela de presença, remoção manual', p: ['admin'] },
        { label: 'Aba Turmas — adicionar participante manualmente', p: ['admin'] },
        { label: 'Aba Turmas — remover inscrito', p: ['admin'] },
        { label: 'Aba Turmas — gerar certificados de participação', p: ['admin'] },
        { label: 'Aba Turmas — exportar CSV Estado Atual (todas as turmas)', p: ['admin'] },
        { label: 'Aba Turmas — exportar CSV Histórico (todas as turmas)', p: ['admin'] },
        { label: 'Aba Turmas — exportar CSV individual de uma turma', p: ['admin'] },
        { label: 'Aba Turmas — consultar interessados/inscritos (nome, e-mail, área, data de registro)', p: ['admin'] },
        { label: 'Aba Turmas — consultar removidos, com histórico de presença preservado (turma finalizada)', p: ['admin'] },
        { label: 'Aba Repositório — listar todos os conteúdos (título, tipo/autor, indicado por ou data de envio)', p: ['admin'] },
        { label: 'Aba Repositório — ocultar conteúdo curado', p: ['admin'] },
        { label: 'Aba Repositório — restaurar conteúdo curado', p: ['admin'] },
        { label: 'Aba Repositório — deletar permanentemente conteúdo (curado ou de usuário)', p: ['admin'] },
        { label: 'Aba Cadastrados — listar todos os cadastrados (nome, e-mail, área, data de cadastro)', p: ['admin'] },
        { label: 'Aba Cadastrados — filtrar lista de cadastrados', p: ['admin'] },
        { label: 'Aba Cadastrados — redefinir senha de qualquer cadastrado', p: ['admin'] },
        { label: 'Aba Cadastrados — resetar progresso de qualquer cadastrado', p: ['admin'] },
        { label: 'Aba Administradores — consultar lista de administradores (nome, e-mail, admin desde)', p: ['admin'] },
        { label: 'Aba Administradores — adicionar admin', p: ['admin'] },
        { label: 'Aba Administradores — remover admin', p: ['admin'] },
        { label: 'Aba Manual — regras de comportamento do sistema', p: ['admin'] },
        { label: 'Aba Manual — filtrar por seção e persona', p: ['admin'] },
        { label: 'Aba Manual — exportar Excel (regras)', p: ['admin'] },
        { label: 'Aba Mapa — hierarquia de personas (níveis de acesso cumulativos)', p: ['admin'] },
        { label: 'Aba Mapa — mapa do site (páginas e funcionalidades por seção, com contagem)', p: ['admin'] },
        { label: 'Aba Mapa — arquitetura técnica (linguagens, tecnologias, padrões e deploy)', p: ['admin'] },
        { label: 'Aba Mapa — regras operacionais (cache, autonomia e processo de deploy)', p: ['admin'] },
        { label: 'Aba Mapa — diagrama visual da arquitetura, com caixas clicáveis que levam ao card correspondente em Arquitetura Técnica', p: ['admin'] },
        { label: 'Aba Mapa — exportar Excel (mapa completo)', p: ['admin'] },
        { label: 'Aba Testes — testes automatizados e checklist manual', p: ['admin'] },
        { label: 'Aba Testes — exportar Excel (testes automáticos e manuais)', p: ['admin'] },
      ]
    },
    { label: 'AJUDA', color: '#7ecbff',
      features: [
        { label: 'Ver página Ajuda com perguntas em acordeão — texto "Central de Ajuda" acima do título "Como podemos ajudar?"', p: ['visitante','logado','inscrito','admin'] },
        { label: 'Expandir/recolher cada pergunta clicando no título (comportamento nativo do browser)', p: ['visitante','logado','inscrito','admin'] },
        { label: 'Link "Ajuda" no menu de navegação', p: ['visitante','logado','inscrito','admin'] },
      ]
    },
    { label: 'CADASTRAR', color: '#9b7fff',
      features: [
        { label: 'Cadastrar conta (@previ.com.br)',           p: ['visitante'] },
        { label: 'Selecionar área/setor (lista de 20 opções)', p: ['visitante'] },
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
        { label: 'Ver botões no menu (Início, Turmas, Ajuda visíveis no menu para visitante)',  p: ['visitante'] },
        { label: 'Fazer login',                               p: ['visitante'] },
        { label: 'Mostrar/ocultar senha (botão "olhinho")',   p: ['visitante'] },
        { label: 'Esqueci minha senha — link por e-mail',     p: ['visitante'] },
      ]
    },
    { label: 'INÍCIO', color: '#1ab2ae',
      features: [
        { label: 'Botão "Conhecer a iniciativa" → rola até "O que é"',    p: ['visitante','logado','inscrito','admin'] },
        { label: 'Card "O que é" → Mindset ágil',   p: ['visitante','logado','inscrito','admin'] },
        { label: 'Card "O que é" → Colaboração real', p: ['visitante','logado','inscrito','admin'] },
        { label: 'Card "O que é" → Impacto sustentável', p: ['visitante','logado','inscrito','admin'] },
        { label: 'Crawl de abertura — texto em estilo Star Wars sobe a tela ao entrar na Home', p: ['visitante','logado','inscrito','admin'] },
        { label: 'Crawl — botão "⏸ Pausar" → pausa/retoma a animação', p: ['visitante','logado','inscrito','admin'] },
        { label: 'Crawl — clicar na área da animação → pausa/retoma (mesmo efeito do botão Pausar)', p: ['visitante','logado','inscrito','admin'] },
        { label: 'Crawl — botão "≡ Ler texto" → exibe texto estático sem perspectiva; "✕ Fechar texto" retorna ao crawl', p: ['visitante','logado','inscrito','admin'] },
        { label: 'Crawl — botão "↻ Repetir abertura" → reinicia a animação do início', p: ['visitante','logado','inscrito','admin'] },
        { label: 'Card "Como funciona" → Conteúdos (decorativo, sem hover)', p: ['visitante','logado','inscrito','admin'] },
        { label: 'Card "Como funciona" → Repositório (decorativo, sem hover)', p: ['visitante','logado','inscrito','admin'] },
        { label: 'Card "Como funciona" → Treinamento Jedi (decorativo, sem hover)', p: ['visitante','logado','inscrito','admin'] },
        { label: 'Botão hero deslogado: "Juntar-se à Força →" → abre modal de cadastro', p: ['visitante'] },
        { label: 'Botão hero logado: "Ver turmas →" → navega para a página Turmas', p: ['logado','inscrito','admin'] },
        { label: 'CTA final: único botão "Ver turmas →" direciona para a página Turmas (mesmo comportamento para todos os perfis)', p: ['visitante','logado','inscrito','admin'] },
        { label: 'Link no rodapé para previ.com.br (externo, presente em todas as páginas)', p: ['visitante','logado','inscrito','admin'] },
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
        { label: 'Welcome screen: botão "Quero jogar" → abre modal login (visitante sem login)', p: ['visitante'] },
        { label: 'Autodiagnóstico com 20 afirmações em 4 blocos — cada resposta vale de 0 a 3 pontos, total de 0 a 60', p: ['inscrito','admin'] },
        { label: 'Patente determinada exclusivamente pela pontuação do autodiagnóstico (Youngling 0–15 / Padawan 16–30 / Cavaleiro 31–45 / Mestre 46–60)', p: ['inscrito','admin'] },
        { label: 'Painel com a patente atual, que atualiza conforme a pessoa vai respondendo', p: ['inscrito','admin'] },
        { label: '4 cards mostrando as patentes possíveis, cada uma com personagem, faixa de pontuação e nome', p: ['inscrito','admin'] },
        { label: 'Botão "Revelar minha Patente →" aparece ao concluir as 20 afirmações (centralizado)', p: ['inscrito','admin'] },
        { label: 'Após revelar: botão desabilitado + card compacto com avatar, pontuação, nome da patente, descrição, características, próximos passos e frase Jedi', p: ['inscrito','admin'] },
        { label: 'Resultado bloqueado após revelar — mensagem "🔒 Para refazer, solicite ao admin o reset do seu progresso."', p: ['inscrito','admin'] },
        { label: 'Missões e Kyber Game removidos da v3', p: [] },
      ]
    },
    { label: 'TURMAS', color: '#f5c542',
      features: [
        { label: 'Lista de turmas disponíveis, com nome, mês, datas e descrição da oficina',  p: ['visitante','logado','admin'] },
        { label: 'Bloco "Como funciona a oficina" (métricas + descrição)', p: ['visitante','logado','inscrito','admin'] },
        { label: 'Agenda D1–D5 (itens estáticos)', p: ['visitante','logado','inscrito','admin'] },
        { label: 'Botão de interesse por turma ("Tenho interesse" / "Remover interesse")', p: ['logado','admin'] },
        { label: 'Card de turma confirmada, com nome, mês/período e dias', p: ['inscrito','admin'] },
      ]
    },
  ];

  function esc(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function slug(str) { return String(str).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }

  /* Badge de nível mínimo para o mapa do site */
  const P_ORDER = ['visitante', 'logado', 'inscrito', 'admin'];
  const P_COLOR = { visitante: '#888888', logado: '#1ab2ae', inscrito: '#4caf7d', admin: '#ff5252' };
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
    var totalPaginas = PAGES.length;
    var totalFeatures = PAGES.reduce(function (sum, p) { return sum + p.features.filter(function (f) { return f.p && f.p.length; }).length; }, 0);
    html += '<h3 class="mapa-title" style="margin-top:48px">Mapa do Site <span class="testes-group-count">(' + totalPaginas + ' páginas · ' + totalFeatures + ' features)</span></h3>';

    /* Legenda dos badges */
    html += '<div class="mapa-legend-box">';
    html += '<span class="mapa-legend-title">Legenda por persona</span>';
    html += '<div class="mapa-legend">';
    html += '<span class="mapa-legend-item"><span class="mapa-badge" style="--bc:#888">Visitante</span> não autenticado — vê Início, Turmas, Ajuda</span>';
    html += '<span class="mapa-legend-item"><span class="mapa-badge" style="--bc:#1ab2ae">Logado +</span> autenticado, sem turma confirmada</span>';
    html += '<span class="mapa-legend-item"><span class="mapa-badge" style="--bc:#4caf7d">Inscrito +</span> autenticado, com turma confirmada</span>';
    html += '<span class="mapa-legend-item"><span class="mapa-badge" style="--bc:#ff5252">Admin</span> acesso administrativo completo</span>';
    html += '</div>';
    html += '</div>';

    /* Grid de páginas */
    html += '<div class="mapa-grid">';
    PAGES.forEach(function (page, idx) {
      var featCount = page.features.filter(function (f) { return f.p && f.p.length; }).length;
      html += '<div class="mapa-page" style="--pc:' + page.color + '">';
      html += '<div class="mapa-page-title"><span>' + page.label + ' <span class="testes-group-count">(' + featCount + ')</span></span><span class="mapa-page-arrow">▾</span></div>';
      html += '<div class="mapa-page-body">';
      var renderFeature = function (f) {
        html += '<div class="mapa-feature"><span class="mapa-feature-label">' + esc(f.label) + '</span>' + levelBadge(f.p) + '</div>';
      };
      var visible = page.features.filter(function (f) { return f.p && f.p.length; });
      if (page.label === 'ADMIN') {
        /* Admin junta itens de 7 abas diferentes — agrupa por aba para não virar uma lista única confusa */
        var subgroups = [];
        var byTab = {};
        visible.forEach(function (f) {
          var m = /^Aba\s+([^—]+?)(?:\s—|$)/.exec(f.label);
          var tab = m ? m[1].trim() : 'Geral';
          if (!byTab[tab]) { byTab[tab] = []; subgroups.push(tab); }
          byTab[tab].push(f);
        });
        subgroups.forEach(function (tab) {
          html += '<div class="manual-admin-subhead">ADMIN · ' + esc(tab.toUpperCase()) + '</div>';
          byTab[tab].forEach(renderFeature);
        });
      } else {
        visible.forEach(renderFeature);
      }
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
          { name: 'Firebase Realtime Database', desc: '6 estruturas principais (equivalente a tabelas):\n• fa-users — perfil de cada cadastrado\n• fa-holocron — conteúdos enviados no Repositório\n• fa-admins — lista de quem é admin\n• turmas-interesse/<turma>/<emailKey> — interessados/inscritos de cada turma\n• turmas-config/<turma> — configuração da turma (finalizada, dia de check-in ativo)\n• turmas-checkin/<turma>/<data>/<emailKey> — presença registrada em cada dia\n\nRegras de segurança (4 regras):\n• Ninguém lê ou escreve na raiz do banco diretamente\n• Toda ação autenticada exige e-mail @previ.com.br — validado no servidor, não só na tela\n• Qualquer admin @previ.com.br pode fazer tudo no painel\n• Só tatianefdirene e danielfrazao podem adicionar/remover admins' },
          { name: 'Firebase Hosting',        desc: 'Hospedagem em kyber-agil.web.app (produção/main). Branch v3-quiz tem preview próprio em kyber-agil--v3quiz-*.web.app. CDN global, HTTPS automático' },
        ]
      },
      {
        label: 'Estrutura de Arquivos', color: '#f5c542',
        items: [
          { name: 'index.html',                  desc: 'Entrada única da aplicação. Contém todo o HTML, carrega os scripts e gerencia as seções por hash (#inicio, #turmas…)' },
          { name: 'forca-agil/head-init.js',     desc: 'Inicialização precoce — adiciona classe "js" ao <html> antes do body renderizar, evitando flash de conteúdo sem JS' },
          { name: 'forca-agil/firebase.js',      desc: 'Progresso e autodiagnóstico — salva/carrega dados do Firebase. API: window.faLoadProgress, window.faSyncProgress' },
          { name: 'forca-agil/router.js',        desc: 'Roteamento por hash — controla qual seção da página está visível. Rotas protegidas: #conteudos e #treinamento exigem nível "enrolled" (inscrito com turma confirmada); #repositorio exige nível "member" (logado). Nível detectado via window.faAuth.getAccessLevel(). API: window.faRouter' },
          { name: 'forca-agil/auth.js',          desc: 'Autenticação — login, cadastro, logout, redefinição de senha. Senha exige apenas dígitos numéricos (mín. 8). Verifica adminship lendo só o próprio registro em fa-admins. Detecta perfil de acesso via window.faAuth.getAccessLevel() → "guest" (visitante), "member" (logado sem turma), "enrolled" (inscrito com turma confirmada). API pública: window.faAuth' },
          { name: 'forca-agil/stars.js',         desc: 'Animação de estrelas do fundo (canvas)' },
          { name: 'forca-agil/app.js',           desc: 'Interações de UI — nav scroll, reveals, botões de interesse em turmas (perfil logado sem turma), controle de acesso por perfil via getAccessLevel(), crawl de abertura (pausar/retomar no clique, botão "Ler texto" para modo estático)' },
          { name: 'forca-agil/home-nav.js',      desc: 'Navegação assistida entre seções da Home — pontos laterais, botão Continuar animado, teclado ↑↓/Enter, IntersectionObserver para dot ativo' },
          { name: 'forca-agil/conteudos-nav.js', desc: 'Navegação lateral para a página Conteúdos — reutiliza estilos .hn-* do home-nav' },
          { name: 'forca-agil/repo.js',          desc: 'Repositório (Holocron) — listagem, adição, remoção de conteúdos' },
          { name: 'forca-agil/game-data.js',     desc: 'Dados do Treinamento Jedi — 4 blocos × 5 afirmações (BLOCOS), patentes (RANKS), níveis Likert (LEVELS). DIMS computado dinamicamente a partir de BLOCOS. MISSIONS existe no arquivo mas não é usada em v3. Expõe window.faGameData' },
          { name: 'forca-agil/game.js',          desc: 'Treinamento Jedi — autodiagnóstico, painel de patente e revelar patente. Acessível apenas com nível "enrolled". Lê dados de window.faGameData' },
          { name: 'forca-agil/kyber.js',         desc: 'Kyber Game (inativo em v3) — script carregado mas seção hidden; sem link de navegação em v3. Código do minigame de 25 desafios com timer' },
          { name: 'forca-agil/admin.js',         desc: 'Painel Admin — interessados, moderação de repositório, gestão de admins, exportação CSV UTF-8 BOM via URL.createObjectURL (window.faToXls — compartilhada por Manual e Testes; acentos corretos no Excel, arquivo sempre editável), barra expandir/recolher com botões por seção. Nenhuma informação de XP é exibida no painel.' },
          { name: 'forca-agil/checkin.js',       desc: 'Check-in por QR Code — registra presença por dia via leitura de QR Code' },
          { name: 'forca-agil/manual.js',        desc: 'Manual interativo — regras filtráveis por seção e persona, botão exportar todas as regras em CSV. Dados declarativos em array RULES' },
          { name: 'forca-agil/mapa.js',          desc: 'Mapa do site e hierarquia de personas. Dados declarativos em arrays PAGES e HIERARCHY' },
          { name: 'forca-agil/testes.js',        desc: 'Testes automatizados de regressão — técnicos e de comportamento, lista de regras manuais pendentes, botão exportar todos os testes em CSV (automáticos e manuais)' },
          { name: 'forca-agil/init.js',          desc: 'Inicialização pós-load — guarda de acesso ao painel admin; exibe adminGuard ou adminContent conforme sessão do usuário' },
          { name: 'forca-agil/styles.css',       desc: 'Estilos globais — design tokens, layout, componentes, responsividade' },
          { name: 'forca-agil/pages.css',        desc: 'Estilos específicos de seções — Admin (inputs, tabelas, expand bar, badges), Mapa, Manual, Testes' },
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
        ]
      },
      {
        label: 'Glossário de UX/Design', color: '#42a5f5',
        items: [
          { name: 'Abas / Tabs',                  desc: 'Navegação entre painéis diferentes dentro da mesma tela. Ex.: abas do painel Admin (Turmas, Repositório, Manual, Mapa, Testes...).' },
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
          { name: 'Folha de estilo de impressão (@media print)', desc: 'Regras de CSS que só valem quando a página é impressa/exportada em PDF. Ex.: certificados de participação, removendo fundo escuro e ajustando pro papel A4.' },
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
          { name: 'GitHub',      desc: 'Repositório tati-agil/forca-agil. Branch de desenvolvimento: v3-quiz. Branch de produção: main' },
          { name: 'Processo',    desc: 'git push para o branch v3-quiz no GitHub → Firebase Hosting atualiza automaticamente o preview em segundos. Para produção: merge em main.' },
          { name: 'Pre-commit hook', desc: 'Git hook em .git/hooks/pre-commit — roda node --check em todos os forca-agil/*.js antes de cada commit. Bloqueia o commit se houver erro de sintaxe, impedindo deploy de código quebrado' },
          { name: 'URL',         desc: 'https://kyber-agil--v3quiz-v0zbanfb.web.app (preview v3-quiz) · https://kyber-agil.web.app (produção/main)' },
          { name: 'Hospedagem',  desc: 'Firebase Hosting — gratuito no Spark plan, CDN global, HTTPS automático, sem servidor para gerenciar' },
          { name: 'Banco',       desc: 'Firebase Realtime Database — gratuito até 1 GB de dados e 10 GB/mês de transferência (Spark plan)' },
          { name: 'Auth',        desc: 'Firebase Authentication — gratuito ilimitado para Email/Password no Spark plan' },
        ]
      },
    ];

    console.log('[mapa] ARCH sections:', ARCH.map(function(s){ return s.label; }));
    ARCH.forEach(function (section) {
      html += '<div class="arch-section">';
      html += '<div class="arch-section-label" style="--ac:' + section.color + '"><span>' + section.label + '</span><span class="arch-arrow">▾</span></div>';
      html += '<div class="arch-section-body"><div class="arch-grid">';
      section.items.forEach(function (item) {
        html += '<div class="arch-item" id="arch-item-' + slug(section.label + '-' + item.name) + '">';
        html += '<div class="arch-item-name" style="--ac:' + section.color + '">' + esc(item.name) + '</div>';
        html += '<div class="arch-item-desc">' + esc(item.desc) + '</div>';
        html += '</div>';
      });
      html += '</div></div></div>';
    });

    html += '</div>';

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
        html += '<button type="button" class="arq-card arq-card--frontend" title="' + esc(item.desc) + '" data-arch-target="arch-item-' + slug(estrutura.label + '-' + item.name) + '">' + esc(item.name) + '</button>';
      });
      html += '</div></div>';
    }

    /* Camada 3 — Firebase serviços (de Tecnologias & Serviços) */
    var tecnologias = ARCH.find(function(s){ return s.label === 'Tecnologias & Serviços'; });
    if (tecnologias) {
      html += '<div class="arq-layer"><div class="arq-layer-label">Firebase — Spark</div><div class="arq-cards">';
      tecnologias.items.forEach(function(item) {
        html += '<button type="button" class="arq-card arq-card--firebase" title="' + esc(item.desc) + '" data-arch-target="arch-item-' + slug(tecnologias.label + '-' + item.name) + '">' + esc(item.name) + '</button>';
      });
      html += '</div></div>';
    }

    html += '</div>'; /* .arq-diagram */

    /* ── Regras Operacionais ── */
    html += '<h3 class="mapa-title" style="margin-top:56px">Regras Operacionais</h3>';
    html += '<p class="mapa-sub">Decisões e restrições registradas sobre como o projeto deve ser mantido.</p>';

    const REGRAS = [
      {
        label: 'Deploy', color: '#e8854a',
        items: [
          { name: 'Pasta de trabalho',  desc: 'Sempre usar "Design System (2)".' },
          { name: 'Processo de deploy', desc: 'git push para o branch main — o Firebase Hosting atualiza automaticamente. Nunca publicar de outra forma.' },
        ]
      },
      {
        label: 'Cache', color: '#ff5252',
        items: [
          { name: 'Sempre no-cache',     desc: 'firebase.json deve ter Cache-Control: no-cache para JS, CSS e HTML.' },
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
        html += '<div class="arch-item-desc">' + esc(item.desc) + '</div>';
        html += '</div>';
      });
      html += '</div></div></div>';
    });

    html += '</div>';

    html += '</div>';

    container.innerHTML = html;

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
        container.querySelectorAll('.mapa-page, .arch-section, .mapa-level, .mapa-site-page').forEach(function (el) { el.classList.add('open'); });
      });
    }
    var mapaCollapseAll = document.getElementById('mapaCollapseAll');
    if (mapaCollapseAll) {
      mapaCollapseAll.addEventListener('click', function () {
        container.querySelectorAll('.mapa-page, .arch-section, .mapa-level, .mapa-site-page').forEach(function (el) { el.classList.remove('open'); });
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
      const archLabel = e.target.closest('.arch-section-label');
      if (archLabel) { archLabel.closest('.arch-section').classList.toggle('open'); return; }
      const levelHead = e.target.closest('.mapa-level-head');
      if (levelHead) { levelHead.closest('.mapa-level').classList.toggle('open'); }
    });
  };
})();
