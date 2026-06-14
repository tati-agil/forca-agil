/* Força Ágil — Mapa do Site + Hierarquia de Personas */
(function () {
  'use strict';

  var PERSONAS = [
    { key: 'visitante',   label: 'Visitante',      color: '#888888', desc: 'Não cadastrado / não logado' },
    { key: 'logado',      label: 'Usuário logado', color: '#1ab2ae', desc: 'Cadastrado com @previ.com.br' },
    { key: 'colaborador', label: 'Colaborador',    color: '#f5c542', desc: 'Indicado como colaborador pelo Admin' },
    { key: 'admin',       label: 'Admin',          color: '#ff5252', desc: 'Colaborador com acesso administrativo' },
  ];

  var HIERARCHY = [
    { key: 'visitante',   label: 'Visitante',      color: '#888888',
      adds: ['Ver páginas públicas (Início, Turmas, Conteúdos, Repositório, Ranking)', 'Cadastrar conta', 'Fazer login'] },
    { key: 'logado',      label: 'Usuário logado', color: '#1ab2ae',
      adds: ['Acessar e jogar o Quiz Jedi', 'Ganhar XP por conteúdos lidos', 'Adicionar e remover conteúdos no Repositório', 'Registrar interesse em turmas', 'Revelar patente e entrar no ranking'] },
    { key: 'colaborador', label: 'Colaborador',    color: '#f5c542',
      adds: ['Expandir Agenda D1–D5 na página Turmas'] },
    { key: 'admin',       label: 'Admin',          color: '#ff5252',
      adds: ['Acessar o Painel Admin', 'Gerenciar colaboradores e admins', 'Ver interessados por turma', 'Moderar Repositório (ocultar/restaurar/deletar)', 'Resetar progresso de qualquer colaborador'] },
  ];

  var PAGES = [
    { label: 'INÍCIO', color: '#1ab2ae',
      features: [
        { label: 'Ver página completa',                  p: ['visitante','logado','colaborador','admin'] },
        { label: 'Botão "Juntar-se" → abre cadastro',   p: ['visitante'] },
        { label: 'Botão "Juntar-se" → vai ao Quiz Jedi',p: ['logado','colaborador','admin'] },
        { label: 'Ranking mini em tempo real',           p: ['visitante','logado','colaborador','admin'] },
      ]
    },
    { label: 'TURMAS', color: '#f5c542',
      features: [
        { label: 'Ver turmas, datas e descrição',        p: ['visitante','logado','colaborador','admin'] },
        { label: '"Tenho interesse" → abre cadastro',    p: ['visitante'] },
        { label: 'Registrar interesse na turma',         p: ['logado','colaborador','admin'] },
        { label: 'Expandir Agenda D1–D5',                p: ['colaborador','admin'] },
      ]
    },
    { label: 'CONTEÚDOS', color: '#4caf7d',
      features: [
        { label: 'Ler as 5 seções',                      p: ['visitante','logado','colaborador','admin'] },
        { label: 'Ganhar +5 XP por seção lida',          p: ['logado','colaborador','admin'] },
      ]
    },
    { label: 'REPOSITÓRIO', color: '#e8854a',
      features: [
        { label: 'Ver todos os conteúdos',               p: ['visitante','logado','colaborador','admin'] },
        { label: '"Adicionar" → abre cadastro',          p: ['visitante'] },
        { label: 'Adicionar conteúdo ao Holocron',       p: ['logado','colaborador','admin'] },
        { label: 'Remover próprio conteúdo',             p: ['logado','colaborador','admin'] },
        { label: 'Ocultar/restaurar curados',            p: ['admin'] },
        { label: 'Deletar conteúdo de qualquer usuário',p: ['admin'] },
      ]
    },
    { label: 'QUIZ JEDI', color: '#e05c7f',
      features: [
        { label: 'Acessar (visitante → cadastro)',        p: ['visitante'] },
        { label: 'Autodiagnóstico (1×, não refaz)',       p: ['logado','colaborador','admin'] },
        { label: 'Missões (1× por missão)',               p: ['logado','colaborador','admin'] },
        { label: 'Kyber Game (1×)',                       p: ['logado','colaborador','admin'] },
        { label: 'Ver painel de patente em tempo real',  p: ['logado','colaborador','admin'] },
        { label: 'Revelar patente',                      p: ['logado','colaborador','admin'] },
        { label: 'Resetar progresso de outros',          p: ['admin'] },
      ]
    },
    { label: 'RANKING', color: '#57aaff',
      features: [
        { label: 'Ver ranking completo',                 p: ['visitante','logado','colaborador','admin'] },
        { label: 'Identificação da própria linha no ranking', p: ['logado','colaborador','admin'] },
        { label: 'Ver patente de todos',                 p: ['visitante','logado','colaborador','admin'] },
      ]
    },
    { label: 'ADMIN', color: '#ff5252',
      features: [
        { label: 'Ver link no menu',                     p: ['admin'] },
        { label: 'Interessados por turma',               p: ['admin'] },
        { label: 'Moderar repositório',                  p: ['admin'] },
        { label: 'Adicionar / remover colaboradores',    p: ['admin'] },
        { label: 'Resetar progresso de colaborador',     p: ['admin'] },
        { label: 'Adicionar / remover admins',           p: ['admin'] },
      ]
    },
    { label: 'CADASTRAR / ENTRAR', color: '#9b7fff',
      features: [
        { label: 'Ver botões no menu',                   p: ['visitante'] },
        { label: 'Cadastrar conta (@previ.com.br)',      p: ['visitante'] },
        { label: 'Fazer login',                          p: ['visitante'] },
        { label: 'Ver perfil no menu',                   p: ['logado','colaborador','admin'] },
        { label: 'Ver link Admin no menu',               p: ['admin'] },
        { label: 'Botão Sair',                           p: ['logado','colaborador','admin'] },
      ]
    },
  ];

  /* Badge de nível mínimo para o mapa do site */
  var P_ORDER = ['visitante', 'logado', 'colaborador', 'admin'];
  var P_COLOR = { visitante: '#888888', logado: '#1ab2ae', colaborador: '#f5c542', admin: '#ff5252' };
  var P_LABEL = { visitante: 'Visitante', logado: 'Logado', colaborador: 'Colaborador', admin: 'Admin' };

  function levelBadge(personas) {
    if (!personas || !personas.length) return '';
    var indices = personas.map(function (k) { return P_ORDER.indexOf(k); }).filter(function (i) { return i >= 0; });
    var minIdx = Math.min.apply(null, indices);
    var maxIdx = Math.max.apply(null, indices);
    /* herança contínua: do mínimo até o topo (admin = índice 3) */
    var isChain = (maxIdx === P_ORDER.length - 1) && (indices.length === P_ORDER.length - minIdx);
    var minKey  = P_ORDER[minIdx];
    var col     = P_COLOR[minKey];
    var lbl     = P_LABEL[minKey];
    var suffix  = (isChain && minIdx < P_ORDER.length - 1) ? ' +' : '';
    if (personas.length === P_ORDER.length) { lbl = 'Todos'; suffix = ''; col = '#ffffff'; }
    return '<span class="mapa-badge" style="--bc:' + col + '">' + lbl + suffix + '</span>';
  }

  function render() {
    var container = document.getElementById('adminMapa');
    if (!container) return;

    var html = '<div class="mapa-wrap">';

    /* ── Hierarquia ── */
    html += '<h3 class="mapa-title">Hierarquia de Personas</h3>';
    html += '<p class="mapa-sub">Cada nível inclui tudo do anterior e acrescenta os itens abaixo.</p>';
    html += '<div class="mapa-hierarchy">';

    HIERARCHY.forEach(function (level, i) {
      var prev = i > 0 ? HIERARCHY[i - 1] : null;
      html += '<div class="mapa-level" style="--lc:' + level.color + '">';
      if (prev) {
        html += '<div class="mapa-level-inherit">↳ tudo de <strong>' + prev.label + '</strong>, mais:</div>';
      }
      html += '<div class="mapa-level-head"><span class="mapa-level-name">' + level.label + '</span></div>';
      html += '<ul class="mapa-level-adds">';
      level.adds.forEach(function (a) { html += '<li>' + a + '</li>'; });
      html += '</ul></div>';
      if (i < HIERARCHY.length - 1) {
        html += '<div class="mapa-level-arrow">▲</div>';
      }
    });

    html += '</div>';

    /* ── Mapa do site ── */
    html += '<h3 class="mapa-title" style="margin-top:48px">Mapa do Site</h3>';

    /* Legenda dos badges */
    html += '<div class="mapa-legend">';
    html += '<span class="mapa-legend-item"><span class="mapa-badge" style="--bc:#888">Visitante</span> apenas visitantes</span>';
    html += '<span class="mapa-legend-item"><span class="mapa-badge" style="--bc:#1ab2ae">Logado +</span> logado, colaborador e admin</span>';
    html += '<span class="mapa-legend-item"><span class="mapa-badge" style="--bc:#f5c542">Colaborador +</span> colaborador e admin</span>';
    html += '<span class="mapa-legend-item"><span class="mapa-badge" style="--bc:#ff5252">Admin</span> somente admin</span>';
    html += '</div>';

    /* Grid de páginas */
    html += '<div class="mapa-grid">';
    PAGES.forEach(function (page) {
      html += '<div class="mapa-page" style="--pc:' + page.color + '">';
      html += '<div class="mapa-page-title">' + page.label + '</div>';
      page.features.forEach(function (f) {
        html += '<div class="mapa-feature"><span class="mapa-feature-label">' + f.label + '</span>' + levelBadge(f.p) + '</div>';
      });
      html += '</div>';
    });
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;
  }

  window.faInitMapa = render;
})();
