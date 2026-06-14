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
        { label: 'Ver própria linha destacada',          p: ['logado','colaborador','admin'] },
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

  function dots(personas) {
    return PERSONAS.map(function (p) {
      var has = personas.indexOf(p.key) !== -1;
      return '<span class="mapa-dot" title="' + p.label + '" style="background:' + (has ? p.color : 'rgba(255,255,255,.08)') + ';box-shadow:' + (has ? '0 0 6px ' + p.color + '66' : 'none') + '"></span>';
    }).join('');
  }

  function render() {
    var container = document.getElementById('adminMapa');
    if (!container) return;

    var html = '<div class="mapa-wrap">';

    /* ── Hierarquia ── */
    html += '<h3 class="mapa-title">Hierarquia de Personas</h3>';
    html += '<p class="mapa-sub">Cada nível herda tudo do anterior e ganha os acessos abaixo.</p>';
    html += '<div class="mapa-hierarchy">';

    HIERARCHY.forEach(function (level) {
      html += '<div class="mapa-level" style="--lc:' + level.color + '">';
      html += '<div class="mapa-level-head"><span class="mapa-level-name">' + level.label + '</span></div>';
      html += '<ul class="mapa-level-adds">';
      level.adds.forEach(function (a) { html += '<li>' + a + '</li>'; });
      html += '</ul></div>';
    });

    html += '</div>';

    /* ── Mapa do site ── */
    html += '<h3 class="mapa-title" style="margin-top:48px">Mapa do Site</h3>';

    /* Legenda */
    html += '<div class="mapa-legend">';
    PERSONAS.forEach(function (p) {
      html += '<span class="mapa-legend-item"><span class="mapa-dot" style="background:' + p.color + '"></span>' + p.label + '</span>';
    });
    html += '</div>';

    /* Grid de páginas */
    html += '<div class="mapa-grid">';
    PAGES.forEach(function (page) {
      html += '<div class="mapa-page" style="--pc:' + page.color + '">';
      html += '<div class="mapa-page-title">' + page.label + '</div>';
      page.features.forEach(function (f) {
        html += '<div class="mapa-feature"><span class="mapa-feature-label">' + f.label + '</span><span class="mapa-dots">' + dots(f.p) + '</span></div>';
      });
      html += '</div>';
    });
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;
  }

  window.faInitMapa = render;
})();
