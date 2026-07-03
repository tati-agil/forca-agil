/* Força Ágil — Mapa do Site + Hierarquia de Personas */
(function () {
  'use strict';

  const PERSONAS = [
    { key: 'visitante',  label: 'Visitante',                      color: '#888888', desc: 'Não cadastrado / não logado — getAccessLevel() retorna "guest"' },
    { key: 'logado',     label: 'Usuário logado (sem turma)',      color: '#1ab2ae', desc: 'Cadastrado com @previ.com.br, sem turma confirmada — getAccessLevel() retorna "member"' },
    { key: 'inscrito',   label: 'Usuário inscrito (turma confirmada)', color: '#4caf7d', desc: 'Logado e com turma confirmada pelo admin — getAccessLevel() retorna "enrolled"' },
    { key: 'admin',      label: 'Admin',                           color: '#ff5252', desc: 'Usuário com acesso administrativo' },
  ];

  const HIERARCHY = [
    { key: 'visitante',   label: 'Visitante',      color: '#888888',
      adds: ['Ver páginas públicas (Início, Turmas, Ajuda)', 'Cadastrar conta (@previ.com.br)', 'Fazer login', 'Recuperar senha por e-mail (autoatendimento)'] },
    { key: 'logado',  label: 'Usuário logado (sem turma)', color: '#1ab2ae',
      adds: ['Acessar o Repositório', 'Adicionar e remover conteúdos no Repositório', 'Manifestar interesse em até 3 turmas', 'Remover interesse em turmas'] },
    { key: 'inscrito', label: 'Usuário inscrito (turma confirmada)', color: '#4caf7d',
      adds: ['Acessar Conteúdos', 'Acessar Treinamento Jedi (autodiagnóstico quiz 0–60)', 'Revelar patente (resultado fixo e bloqueado — não pode refazer sem reset do admin)', 'Vê apenas o card da própria turma na página Turmas — sem botões de interesse'] },
    { key: 'admin',   label: 'Admin',          color: '#ff5252',
      adds: ['Acessar o Painel Admin', 'Ver todos os cadastrados', 'Ver interessados por turma', 'Moderar Repositório (ocultar/restaurar/deletar)', 'Resetar progresso de qualquer cadastrado', 'Enviar e-mail de redefinição de senha para qualquer cadastrado', 'Gerenciar lista de admins (apenas tatianefdirene e danielfrazao — restrito por regra Firebase)'] },
  ];

  const PAGES = [
    { label: 'INÍCIO', color: '#1ab2ae',
      features: [
        { label: 'Ver página completa',                  p: ['visitante','logado','inscrito','admin'] },
        { label: 'Subtítulo do hero: "Desenvolva sua agilidade na prática"', p: ['visitante','logado','inscrito','admin'] },
        { label: 'Botão "Conhecer a iniciativa" → rola até "O que é"',    p: ['visitante','logado','inscrito','admin'] },
        { label: 'Botão "Repetir abertura" → replay do crawl de intro',   p: ['visitante','logado','inscrito','admin'] },
        { label: 'Crawl: botões "≡ Ler texto" / "⏸ Pausar" / "↻ Repetir abertura" exibidos lado a lado (layout horizontal)', p: ['visitante','logado','inscrito','admin'] },
        { label: 'Crawl: clicar na área ou botão "⏸ Pausar" → pausa/retoma animação', p: ['visitante','logado','inscrito','admin'] },
        { label: 'Crawl: botão "≡ Ler texto" → exibe texto estático sem perspectiva; "✕ Fechar texto" retorna ao crawl', p: ['visitante','logado','inscrito','admin'] },
        { label: '3 cards "Como funciona" → links para Conteúdos / Repositório / Treinamento Jedi (sem hover — cards decorativos)', p: ['visitante','logado','inscrito','admin'] },
        { label: 'Botão hero deslogado: "Juntar-se à Força →" → abre modal de cadastro', p: ['visitante'] },
        { label: 'Botão hero logado: "Ver turmas →" → navega para a página Turmas', p: ['logado','inscrito','admin'] },
        { label: 'CTA final: único botão "Ver turmas →" direciona para a página Turmas (mesmo comportamento para todos os perfis)', p: ['visitante','logado','inscrito','admin'] },
        { label: 'Link no rodapé para previ.com.br (externo, presente em todas as páginas)', p: ['visitante','logado','inscrito','admin'] },
      ]
    },
    { label: 'TURMAS', color: '#f5c542',
      features: [
        { label: 'Ver turmas, datas e descrição (visitante e logado sem turma veem todas as turmas)',  p: ['visitante','logado','admin'] },
        { label: 'Inscrito vê apenas o card da própria turma confirmada (as demais ficam ocultas)',    p: ['inscrito'] },
        { label: 'Card da turma confirmada mostra: nome da turma, mês/período CONFIRMADA, dias — sem botões de interesse', p: ['inscrito'] },
        { label: 'Bloco "Como funciona a oficina" antes da agenda: 4 métricas (5 dias, 4h, Prática, Opcional) + descrição', p: ['visitante','logado','inscrito','admin'] },
        { label: 'Agenda D1–D5: itens estáticos (sem expansível — nenhum conteúdo interno)', p: ['visitante','logado','inscrito','admin'] },
        { label: '"Tenho interesse" sem login → exibe mensagem "Faça login para registrar seu interesse" + abre modal login', p: ['visitante'] },
        { label: 'Registrar interesse → botão vira "Remover interesse" (status: interessado) — disponível para logado sem turma confirmada', p: ['logado','admin'] },
        { label: 'Remover interesse → botão volta a "Tenho interesse" (log mantido) — disponível para logado sem turma confirmada', p: ['logado','admin'] },
        { label: 'Turma finalizada (inscrito) → botão vira "✓ Inscrita" (desabilitado)', p: ['inscrito','admin'] },
        { label: 'Check-in via QR Code no dia do evento → botão vira "✓ Presente" (por dia)', p: ['inscrito','admin'] },
      ]
    },
    { label: 'CONTEÚDOS', color: '#4caf7d',
      features: [
        { label: 'Ler as 7 seções numeradas (01 Mapa da Galáxia → 07 A Trilogia) — cada uma ocupa 100vh, uma por vez', p: ['inscrito','admin'] },
        { label: 'Mapa da Galáxia: botão "Ver mais 6 elementos →" revela os 6 últimos cards (ocultos por padrão)', p: ['inscrito','admin'] },
        { label: '12 Princípios: primeiros 6 visíveis por padrão; botão "Ver os 6 princípios restantes →" revela os princípios 7–12', p: ['inscrito','admin'] },
        { label: 'Navegação lateral por pontos (01–07) — salta entre seções; tooltip com nome ao passar o mouse', p: ['inscrito','admin'] },
        { label: 'Badge "+5 pts" em cards selecionados: "03 · A Força do Ágil" e "25 Ensinamentos do Mestre Yoda" (demais cards sem badge de pontos)', p: ['inscrito','admin'] },
        { label: 'Link externo "Ler os 4 valores na íntegra" (agilemanifesto.org)', p: ['inscrito','admin'] },
        { label: 'Link externo "Ler os 12 princípios na íntegra" (agilemanifesto.org)', p: ['inscrito','admin'] },
      ]
    },
    { label: 'REPOSITÓRIO', color: '#e8854a',
      features: [
        { label: 'Ver todos os conteúdos — cards com descrição colapsada em 2 linhas; "ver mais" / "ver menos" só onde o texto transborda', p: ['logado','inscrito','admin'] },
        { label: 'Filtrar por tipo (Todos/Vídeos/Documentos/Ferramentas/Livros)', p: ['logado','inscrito','admin'] },
        { label: 'Repositório não acessível para visitante — exige login', p: ['visitante'] },
        { label: 'Adicionar conteúdo ao Holocron',       p: ['logado','inscrito','admin'] },
        { label: 'Remover próprio conteúdo',             p: ['logado','inscrito','admin'] },
      ]
    },
    { label: 'TREINAMENTO JEDI', color: '#e05c7f',
      features: [
        { label: 'Página não acessível para visitante nem para logado sem turma confirmada — exige perfil inscrito', p: ['visitante','logado'] },
        { label: 'Welcome screen: botão "Quero jogar" → abre modal login (visitante sem login)', p: ['visitante'] },
        { label: 'Autodiagnóstico Likert — 20 afirmações em 4 blocos, escala 0–3, pontuação total 0–60', p: ['inscrito','admin'] },
        { label: 'Patente determinada exclusivamente pela pontuação do quiz (Youngling 0–15 / Padawan 16–30 / Cavaleiro 31–45 / Mestre 46–60)', p: ['inscrito','admin'] },
        { label: 'Ver painel HUD com avatar SVG e patente atual em tempo real conforme responde', p: ['inscrito','admin'] },
        { label: 'Ladder de patentes: 4 cards com personagens SVG, faixas de pontuação e nomes', p: ['inscrito','admin'] },
        { label: 'Botão "Revelar minha Patente →" aparece ao concluir as 20 afirmações (centralizado)', p: ['inscrito','admin'] },
        { label: 'Após revelar: botão desabilitado + card compacto com avatar, pontuação, nome da patente, descrição, características, próximos passos e frase Jedi', p: ['inscrito','admin'] },
        { label: 'Resultado bloqueado após revelar — mensagem "🔒 Para refazer, solicite ao admin o reset do seu progresso."', p: ['inscrito','admin'] },
        { label: 'Missões e Kyber Game removidos da v3', p: [] },
      ]
    },
    { label: 'AJUDA', color: '#9b7fff',
      features: [
        { label: 'Ver página Ajuda com perguntas em acordeão (<details>/<summary>) — eyebrow "Central de Ajuda", h1 "Como podemos ajudar?"', p: ['visitante','logado','inscrito','admin'] },
        { label: 'Expandir/recolher cada pergunta clicando no título (comportamento nativo do browser)', p: ['visitante','logado','inscrito','admin'] },
        { label: 'Link "Ajuda" no menu de navegação', p: ['visitante','logado','inscrito','admin'] },
      ]
    },
    { label: 'ADMIN', color: '#ff5252',
      features: [
        { label: 'Aba Turmas — cards por turma com badge ABERTA/FINALIZADA e contagem de inscritos; cards com fundo sólido (#1a2035), sem transparência; datas no formato "11, 12, 18, 19 e 20" (com vírgulas e "e")', p: ['admin'] },
        { label: 'Finalizar inscrição da turma — converte todos os interessados em inscritos e bloqueia novas inscrições', p: ['admin'] },
        { label: 'Reabrir turma — volta inscritos para interessado e permite novas inscrições', p: ['admin'] },
        { label: 'Abrir check-in do dia — select com os dias da turma + botão confirmar; admin escolhe qualquer dia (passado ou futuro); define diaAtivo em turmas-config', p: ['admin'] },
        { label: 'Fechar check-in do dia — limpa diaAtivo; impede novos check-ins', p: ['admin'] },
        { label: 'QR Code — gera QR único por turma (popup); participante escaneia no dia com check-in aberto', p: ['admin'] },
        { label: 'Tabela de presença por dia — colunas por data (✓ qr / ✓ adm / —), frequência X/5 colorida', p: ['admin'] },
        { label: 'Registrar presença retroativa — admin clica em "—" de qualquer pessoa/dia e confirma manualmente', p: ['admin'] },
        { label: 'Adicionar participante após inscrições fechadas — botão "＋ Participante" grava direto com status inscrito sem reabrir turma', p: ['admin'] },
        { label: 'Remover inscrito da turma finalizada — botão "Remover" na tabela de presença marca removed:true e removedDate (data+hora); removido some da tela mas aparece no CSV exportado', p: ['admin'] },
        { label: 'Critério de presença configurável — CRITERIO_PRESENCA = 0.75 (75%, default 4/5 dias)', p: ['admin'] },
        { label: 'Exportar CSV estado atual (com colunas de presença por dia e frequência)', p: ['admin'] },
        { label: 'Exportar CSV Histórico de ações (adicionou/removeu interesse)', p: ['admin'] },
        { label: 'Exportar CSV individual por turma', p: ['admin'] },
        { label: 'Gerar certificados de participação em lote — botão "Certificados" na turma finalizada; filtra quem atingiu ≥ 75%; abre nova aba com 1 certificado por página (A4 paisagem) prontos para imprimir/salvar como PDF', p: ['admin'] },
        { label: 'Moderar repositório — ocultar/restaurar seeds curados (fa-seeds-hidden)', p: ['admin'] },
        { label: 'Moderar repositório — deletar permanentemente seeds curados (fa-seeds-deleted, sem restauração)', p: ['admin'] },
        { label: 'Moderar repositório — ocultar/restaurar conteúdo de usuários (fa-holocron-hidden)', p: ['admin'] },
        { label: 'Moderar repositório — deletar permanentemente conteúdo de usuários (holocron)', p: ['admin'] },
        { label: 'Ver todos os cadastrados, com filtro de busca', p: ['admin'] },
        { label: 'Redefinir senha de qualquer cadastrado (e-mail)', p: ['admin'] },
        { label: 'Resetar progresso de qualquer cadastrado — apaga fa-progress, escreve fa-reset-signal/<eKey> para notificar a pessoa logada; a página dela recarrega automaticamente — quiz reabilitado sem ação da pessoa', p: ['admin'] },
        { label: 'Adicionar / remover admins',                p: ['admin'] },
        { label: 'Abas do painel — 8 abas (Turmas, Repositório, Colaboradores, Cadastrados, Administradores, Manual, Mapa, Testes); no mobile quebram em 2 linhas com fonte reduzida', p: ['admin'] },
        { label: 'Aba Manual — checklist de regras de comportamento + Expandir/Recolher tudo', p: ['admin'] },
        { label: 'Aba Mapa — mapa do site e hierarquia de personas + Expandir/Recolher tudo', p: ['admin'] },
        { label: 'Aba Testes — testes automatizados e checklist manual + Expandir/Recolher tudo', p: ['admin'] },
      ]
    },
    { label: 'CADASTRAR / ENTRAR', color: '#9b7fff',
      features: [
        { label: 'Ver botões no menu (Início, Turmas, Ajuda visíveis no menu para visitante)',  p: ['visitante'] },
        { label: 'Cadastrar conta (@previ.com.br)',           p: ['visitante'] },
        { label: 'Fazer login',                               p: ['visitante'] },
        { label: 'Esqueci minha senha — link por e-mail',     p: ['visitante'] },
        { label: 'Inicial e nome no menu — no lugar dos botões Entrar/Cadastrar; header exibe avatar, nome e botão Sair (sem badge XP)', p: ['logado','inscrito','admin'] },
        { label: 'Menu logado sem turma: Início, Turmas, Repositório, Ajuda (sem Conteúdos nem Treinamento Jedi)', p: ['logado'] },
        { label: 'Menu inscrito com turma: Início, Turmas, Repositório, Conteúdos, Treinamento Jedi, Ajuda', p: ['inscrito'] },
        { label: 'Ver link "Admin" no menu de navegação (desktop sempre visível; mobile: aparece ao abrir o menu)', p: ['admin'] },
        { label: 'Botão Sair',                                p: ['logado','inscrito','admin'] },
      ]
    },
  ];

  function esc(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

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
    html += '<h3 class="mapa-title" style="margin-top:48px">Mapa do Site</h3>';

    /* Legenda dos badges */
    html += '<div class="mapa-legend-box">';
    html += '<span class="mapa-legend-title">Legenda por persona</span>';
    html += '<div class="mapa-legend">';
    html += '<span class="mapa-legend-item"><span class="mapa-badge" style="--bc:#888">Visitante</span> não autenticado — vê Início, Turmas, Ajuda</span>';
    html += '<span class="mapa-legend-item"><span class="mapa-badge" style="--bc:#1ab2ae">Logado +</span> autenticado sem turma confirmada — getAccessLevel() = "member"</span>';
    html += '<span class="mapa-legend-item"><span class="mapa-badge" style="--bc:#4caf7d">Inscrito +</span> com turma confirmada — getAccessLevel() = "enrolled"</span>';
    html += '<span class="mapa-legend-item"><span class="mapa-badge" style="--bc:#ff5252">Admin</span> acesso administrativo completo</span>';
    html += '</div>';
    html += '</div>';

    /* Grid de páginas */
    html += '<div class="mapa-grid">';
    PAGES.forEach(function (page, idx) {
      html += '<div class="mapa-page" style="--pc:' + page.color + '">';
      html += '<div class="mapa-page-title"><span>' + page.label + '</span><span class="mapa-page-arrow">▾</span></div>';
      html += '<div class="mapa-page-body">';
      page.features.forEach(function (f) {
        if (!f.p || !f.p.length) return;
        html += '<div class="mapa-feature"><span class="mapa-feature-label">' + esc(f.label) + '</span>' + levelBadge(f.p) + '</div>';
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
          { name: 'Firebase Realtime Database', desc: 'Armazena: fa-users (perfis), fa-holocron (repositório), fa-admins, turmas-interesse/<turma>/<emailKey>, turmas-config/<turma> (finalizada, diaAtivo, turmaConfirmada por emailKey), turmas-checkin/<turma>/<data>/<emailKey>. Regras de segurança: raiz com .read/.write false; todas as escritas e leituras autenticadas exigem auth.token.email matches @previ.com.br (restrição no servidor, não apenas no front-end); leitura de coleções completas de fa-users, fa-progress e fa-admins restrita a tatianefdirene e danielfrazao' },
          { name: 'Firebase Hosting',        desc: 'Hospedagem em kyber-agil.web.app (produção/main). Branch v3-quiz tem preview próprio em kyber-agil--v3quiz-*.web.app. CDN global, HTTPS automático' },
        ]
      },
      {
        label: 'Estrutura de Arquivos', color: '#f5c542',
        items: [
          { name: 'index.html',                  desc: 'Entrada única da aplicação. Contém todo o HTML, carrega os scripts e gerencia as seções por hash (#inicio, #turmas…)' },
          { name: 'forca-agil/head-init.js',     desc: 'Inicialização precoce — adiciona classe "js" ao <html> antes do body renderizar, evitando flash de conteúdo sem JS' },
          { name: 'forca-agil/firebase.js',      desc: 'Progresso e quiz — salva/carrega dados do Firebase. Lê fa-game-v3 (quiz). API: window.faLoadProgress, window.faSyncProgress, window.faSyncPlayer, window.faGetTotalXP' },
          { name: 'forca-agil/router.js',        desc: 'Roteamento por hash — controla qual seção da página está visível. Rotas protegidas: #conteudos e #treinamento exigem nível "enrolled" (inscrito com turma confirmada); #repositorio exige nível "member" (logado). Nível detectado via window.faAuth.getAccessLevel(). API: window.faRouter' },
          { name: 'forca-agil/auth.js',          desc: 'Autenticação — login, cadastro, logout, redefinição de senha. Senha exige apenas dígitos numéricos (mín. 8). Verifica adminship lendo só o próprio registro em fa-admins. Detecta perfil de acesso via window.faAuth.getAccessLevel() → "guest" (visitante), "member" (logado sem turma), "enrolled" (inscrito com turma confirmada). API pública: window.faAuth' },
          { name: 'forca-agil/stars.js',         desc: 'Animação de estrelas do fundo (canvas)' },
          { name: 'forca-agil/app.js',           desc: 'Interações de UI — nav scroll, reveals, botões de interesse em turmas (perfil logado sem turma), controle de acesso por perfil via getAccessLevel(), crawl de abertura (pausar/retomar no clique, botão "Ler texto" para modo estático)' },
          { name: 'forca-agil/home-nav.js',      desc: 'Navegação assistida entre seções da Home — pontos laterais, botão Continuar animado, teclado ↑↓/Enter, IntersectionObserver para dot ativo' },
          { name: 'forca-agil/conteudos-nav.js', desc: 'Navegação lateral para a página Conteúdos — reutiliza estilos .hn-* do home-nav' },
          { name: 'forca-agil/repo.js',          desc: 'Repositório (Holocron) — listagem, adição, remoção de conteúdos, XP por contribuição' },
          { name: 'forca-agil/game-data.js',     desc: 'Dados do Treinamento Jedi — 4 blocos × 5 afirmações (BLOCOS), patentes (RANKS), níveis Likert (LEVELS). DIMS computado dinamicamente a partir de BLOCOS. MISSIONS existe no arquivo mas não é usada em v3. Expõe window.faGameData' },
          { name: 'forca-agil/game.js',          desc: 'Treinamento Jedi — autodiagnóstico (quiz), painel de patente e revelar patente. Acessível apenas com nível "enrolled". Lê dados de window.faGameData' },
          { name: 'forca-agil/kyber.js',         desc: 'Kyber Game (inativo em v3) — script carregado mas seção hidden; sem link de navegação em v3. Código do minigame de 25 desafios com timer' },
          { name: 'forca-agil/admin.js',         desc: 'Painel Admin — interessados, moderação de repositório, gestão de admins, XP de Cadastrados (publicado ou calculado de fa-progress), exportação CSV Windows-1252 via Uint8Array+URL.createObjectURL (window.faToXls — compartilhada por Manual e Testes; acentos e travessão corretos no Excel pt-BR sem BOM), barra expandir/recolher com botões por seção' },
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
          { name: 'Acordeão para listas longas',             desc: 'Listas com muitos itens (FAQ, Manual, Mapa, Arquitetura) usam acordeão para não sobrecarregar a tela. Expandir/Recolher tudo disponível no Admin.' },
          { name: 'Mapa do site: lista vertical (acordeão)', desc: 'Cards de páginas no Mapa do Site em coluna única em vez de grid multi-coluna — facilita leitura sequencial e evita fragmentação da informação.' },
          { name: 'Stepper em linha única horizontal',       desc: 'O fluxo de 4 passos do Treinamento Jedi (login → explorar → ganhar experiência → patentes) fica em uma única linha com flex-wrap: nowrap e flex: 1 1 0 nos steps. Mobile quebra para coluna.' },
          { name: 'Crawl de abertura animado',               desc: 'Texto introdutório em estilo Star Wars sobe lentamente ao entrar na Home. Clique em qualquer ponto pausa/retoma a animação. Botão "Ler texto" alterna para modo estático (sem animação) para acessibilidade.' },
          { name: 'Quiz travado ao completar (v3)',          desc: 'Opções do autodiagnóstico ficam desabilitadas assim que todas as afirmações são respondidas — não só após revelar a patente. Impede alteração de respostas após conclusão do quiz.' },
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
        html += '<div class="arch-item">';
        html += '<div class="arch-item-name" style="--ac:' + section.color + '">' + esc(item.name) + '</div>';
        html += '<div class="arch-item-desc">' + esc(item.desc) + '</div>';
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
        html += '<div class="arch-item-name" style="--ac:' + section.color + '">' + esc(item.name) + '</div>';
        html += '<div class="arch-item-desc">' + esc(item.desc) + '</div>';
        html += '</div>';
      });
      html += '</div></div></div>';
    });

    html += '</div>';

    html += '</div>';

    /* ── Diagrama da Arquitetura ── */
    html += '<h3 class="mapa-title" style="margin-top:56px">Diagrama da Arquitetura</h3>';
    html += '<p class="mapa-sub">Gerado dinamicamente a partir dos dados desta página — atualiza quando a Arquitetura Técnica ou Regras mudam.</p>';
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
        html += '<div class="arq-card arq-card--frontend" title="' + esc(item.desc) + '">' + esc(item.name) + '</div>';
      });
      html += '</div></div>';
    }

    /* Camada 3 — Firebase serviços (de Tecnologias & Serviços) */
    var tecnologias = ARCH.find(function(s){ return s.label === 'Tecnologias & Serviços'; });
    if (tecnologias) {
      html += '<div class="arq-layer"><div class="arq-layer-label">Firebase — Spark</div><div class="arq-cards">';
      tecnologias.items.forEach(function(item) {
        html += '<div class="arq-card arq-card--firebase" title="' + esc(item.desc) + '">' + esc(item.name) + '</div>';
      });
      html += '</div></div>';
    }

    /* Camada 4 — Padrões de UX */
    var uxPatterns = ARCH.find(function(s){ return s.label === 'Padrões de UX'; });
    if (uxPatterns) {
      html += '<div class="arq-layer"><div class="arq-layer-label">Padrões de UX</div><div class="arq-cards">';
      uxPatterns.items.forEach(function(item) {
        html += '<div class="arq-card arq-card--ux" title="' + esc(item.desc) + '">' + esc(item.name) + '</div>';
      });
      html += '</div></div>';
    }

    html += '</div>'; /* .arq-diagram */

    container.innerHTML = html;

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
