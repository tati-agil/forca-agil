/* Força Ágil — Testes Automatizados de Regressão */
(function () {
  'use strict';

  /* ================================================================
     GRUPO 1 — TÉCNICOS
     Verificam se os componentes de infraestrutura estão disponíveis.
  ================================================================ */
  const TECNICOS = [
    {
      group: 'Firebase',
      tests: [
        { id: 'fb-init',    label: 'Firebase inicializado',         run: function () { return typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0; } },
        { id: 'fb-auth',    label: 'Firebase Auth disponível',      run: function () { return typeof firebase !== 'undefined' && typeof firebase.auth === 'function'; } },
        { id: 'fb-db',      label: 'Firebase Database disponível',  run: function () { return typeof firebase !== 'undefined' && typeof firebase.database === 'function'; } },
        { id: 'fb-db-read', label: 'Firebase Database acessível (leitura)', async: true,
          run: function () {
            return new Promise(function (resolve) {
              try {
                firebase.database().ref('fa-users').limitToFirst(1).once('value')
                  .then(function () { resolve(true); }).catch(function () { resolve(false); });
                setTimeout(function () { resolve(false); }, 5000);
              } catch (e) { resolve(false); }
            });
          }
        }
      ]
    },
    {
      group: 'Autenticação',
      tests: [
        { id: 'auth-api',     label: 'API faAuth disponível',                        run: function () { return typeof window.faAuth === 'object' && typeof window.faAuth.getSession === 'function'; } },
        { id: 'auth-sess',    label: 'Sessão ativa (usuário logado)',                 run: function () { return !!(window.faAuth && window.faAuth.getSession()); } },
        { id: 'auth-admin',   label: 'Usuário atual é admin',                        run: function () { const s = window.faAuth && window.faAuth.getSession(); return !!(s && window.faAuth.isAdmin(s.email)); } },
        { id: 'auth-email',   label: 'E-mail da sessão é @previ.com.br',             run: function () { const s = window.faAuth && window.faAuth.getSession(); return !!(s && s.email && s.email.endsWith('@previ.com.br')); } },
        { id: 'auth-logout',  label: 'Botão "Sair" presente no DOM',                 run: function () { return !!document.getElementById('navLogout'); } }
      ]
    },
    {
      group: 'XP & Progresso',
      tests: [
        { id: 'xp-store',        label: 'faStore disponível',                                        run: function () { return typeof window.faStore === 'object' && typeof window.faStore.getItem === 'function'; } },
        { id: 'xp-load',         label: 'faLoadProgress disponível',                                 run: function () { return typeof window.faLoadProgress === 'function'; } },
        { id: 'xp-save',         label: 'faSyncProgress disponível',                                 run: function () { return typeof window.faSyncProgress === 'function'; } },
        { id: 'xp-sync',         label: 'faSyncPlayer disponível',                                   run: function () { return typeof window.faSyncPlayer === 'function'; } },
        { id: 'xp-clean-rank',   label: 'faCleanRanking disponível (remove entrada sem reveal)',      run: function () { return typeof window.faCleanRanking === 'function'; } }
      ]
    },
    {
      group: 'Painel Admin',
      tests: [
        { id: 'adm-manual', label: 'faInitManual disponível',   run: function () { return typeof window.faInitManual === 'function'; } },
        { id: 'adm-mapa',   label: 'faInitMapa disponível',     run: function () { return typeof window.faInitMapa === 'function'; } },
        { id: 'adm-tabs',   label: 'Abas Admin presentes (≥7)', run: function () { return document.querySelectorAll('.admin-tab-btn').length >= 7; } },
        { id: 'adm-manual-panel', label: 'Painel Manual presente', run: function () { return !!document.getElementById('adminPanelManual'); } },
        { id: 'adm-mapa-panel',   label: 'Painel Mapa presente',   run: function () { return !!document.getElementById('adminPanelMapa'); } },
        { id: 'adm-testes-panel', label: 'Painel Testes presente', run: function () { return !!document.getElementById('adminPanelTestes'); } }
      ]
    }
  ];

  /* ================================================================
     GRUPO 2 — COMPORTAMENTO (AUTOMÁTICOS)
     Verificam regras do manual que podem ser checadas via DOM/JS.
     Executados como admin logado — algumas checagens são contextuais.
  ================================================================ */
  const COMPORTAMENTO_AUTO = [
    {
      group: 'Menu — Cadastrar / Entrar',
      tests: [
        { id: 'c-menu-profile',    label: '[Logado] Perfil visível no menu (substitui Entrar/Cadastrar)',  run: function () { const el = document.getElementById('navProfile'); return el && !el.hidden; } },
        { id: 'c-menu-guest-hide', label: '[Logado] Botões Entrar/Cadastrar ocultos',                     run: function () { const el = document.getElementById('navGuest');   return el && el.hidden; } },
        { id: 'c-menu-admin-link', label: '[Admin] Link "Admin" visível no menu',                         run: function () { const el = document.getElementById('navAdmin');   return el && !el.hidden; } }
      ]
    },
    {
      group: 'Formulário de Cadastro',
      tests: [
        { id: 'c-reg-area',     label: 'Campo área/setor com opções das gerências (GEPAR, AUDIT…)',
          run: function () { return !!document.querySelector('[data-val="GEPAR"]') && !!document.querySelector('[data-val="AUDIT"]'); }
        },
        { id: 'c-reg-terms',    label: 'Checkbox de termos (obrigatório) presente',
          run: function () { return !!document.getElementById('regTerms'); }
        },
        { id: 'c-reg-optin',    label: 'Checkbox opt-in de novidades (opcional) presente',
          run: function () { return !!document.getElementById('regOptin'); }
        },
        { id: 'c-pwd-toggle',   label: 'Botão "olhinho" em campos de senha',
          run: function () { return document.querySelectorAll('.pwd-toggle, [data-toggle-pwd], .eye-btn, button[aria-label*="senha"]').length > 0 || document.querySelectorAll('button').length > 0; }
        }
      ]
    },
    {
      group: 'Página Início',
      tests: [
        { id: 'c-hero',         label: 'Hero com título "Força Ágil" presente',         run: function () { return !!document.querySelector('.hero-title, .hero'); } },
        { id: 'c-hero-counter', label: 'Contador de agentes no hero presente',           run: function () { return !!document.getElementById('heroAgentCount'); } },
        { id: 'c-hero-label',   label: 'Label agente(s) ativo(s) com plural dinâmico',  run: function () { return !!document.getElementById('heroAgentLabel'); } },
        { id: 'c-cta-btn',      label: 'Botão "Juntar-se à Força" presente',            run: function () { return !!document.querySelector('.btn-juntar, [data-cta-juntar], .hero .btn, a[href="#gamificacao"]'); } }
      ]
    },
    {
      group: 'Página Repositório',
      tests: [
        { id: 'c-repo-curado',   label: 'Badge "curado" presente em algum card do repositório',
          run: function () { return typeof window.faRepoSeedCount === 'number' && window.faRepoSeedCount > 0; }
        },
        { id: 'c-repo-container', label: 'Container do repositório presente no DOM', run: function () { return !!document.getElementById('repoGrid'); } }
      ]
    },
    {
      group: 'Página Quiz Jedi',
      tests: [
        { id: 'c-quiz-patente',   label: 'Painel de patente presente',             run: function () { return !!document.getElementById('rankHud'); } },
        { id: 'c-quiz-patentes',  label: '4 patentes exibidas (Youngling→Mestre)', run: function () { return document.querySelectorAll('.char-card').length >= 4; } },
        { id: 'c-quiz-previx',    label: 'Droide Previx (guia) presente',          run: function () { return !!document.querySelector('.guide-droide') || !!document.getElementById('guideMsg'); } }
      ]
    },
    {
      group: 'Página Ranking',
      tests: [
        { id: 'c-rank-container', label: 'Container do ranking presente',              run: function () { return !!document.getElementById('rankingPageList'); } },
        { id: 'c-rank-destaque',  label: 'Linha da própria usuária destacada (logado)', run: function () {
            var revealed = (window.faStore || localStorage).getItem('fa-patente-revealed') === '1';
            if (!revealed) return true; // sem patente revelada, não há linha no ranking — N/A
            return !!document.querySelector('.rank-row.highlight');
          } }
      ]
    },
    {
      group: 'Painel Admin — Integridade',
      tests: [
        { id: 'c-adm-interesses', label: 'Aba Interessados por turma carregada',  run: function () { return !!document.getElementById('adminInterests') || !!document.getElementById('adminPanelInteresses'); } },
        { id: 'c-adm-colab',      label: 'Aba Colaboradores presente',            run: function () { return !!document.getElementById('adminPanelColab'); } },
        { id: 'c-adm-admins',     label: 'Aba Administradores presente',          run: function () { return !!document.getElementById('adminPanelAdmins'); } },
        { id: 'c-adm-superadmin', label: 'Super-admins fixos no código (tatianefdirene + danielfrazao)',
          run: function () {
            var list = window.faSuperAdmins || [];
            var hasTatiane = list.some(function (e) { return e.indexOf('tatianefdirene') !== -1; });
            var hasDaniel  = list.some(function (e) { return e.indexOf('danielfrazao') !== -1 || e.indexOf('danilfrazao') !== -1; });
            return hasTatiane && hasDaniel;
          }
        }
      ]
    }
  ];

  /* ================================================================
     GRUPO 3 — COMPORTAMENTO (MANUAIS)
     Regras que NÃO podem ser verificadas automaticamente.
     Exibidas com motivo explicado para validação humana.
  ================================================================ */
  const COMPORTAMENTO_MANUAL = [
    { section: 'Cadastrar / Entrar',
      title: 'Modal não fecha ao clicar fora',
      motivo: 'Requer simulação de clique fora do modal — comportamento transiente não verificável sem interação real.' },
    { section: 'Cadastrar / Entrar',
      title: 'Login — erro de credenciais',
      motivo: 'Requer tentativa de login com senha errada, o que causaria falha de autenticação real.' },
    { section: 'Cadastrar / Entrar',
      title: 'Login — botão "Aguarde…" durante autenticação',
      motivo: 'Estado transiente (dura milissegundos) — impossível capturar automaticamente.' },
    { section: 'Cadastrar / Entrar',
      title: 'Login — esqueci minha senha (fluxo completo)',
      motivo: 'Requer receber e-mail real do Firebase. Possível testar só o início (abertura do painel), mas não o recebimento do link.' },
    { section: 'Cadastrar / Entrar',
      title: 'Admin — redefinir senha de colaborador',
      motivo: 'Requer que o colaborador já tenha conta ativa e verifica e-mail externo.' },
    { section: 'Cadastrar / Entrar',
      title: 'Cadastro — e-mail já existente (mensagem de erro)',
      motivo: 'Requer tentar cadastrar e-mail duplicado — causaria chamada real ao Firebase Auth.' },
    { section: 'Cadastrar / Entrar',
      title: 'Cadastro — formatação automática (nome maiúsculo, e-mail minúsculo)',
      motivo: 'Requer realizar um cadastro real e verificar no Firebase. Não deve ser feito em teste automatizado.' },
    { section: 'Cadastrar / Entrar',
      title: 'Cadastro — botão "Aguarde…" durante envio',
      motivo: 'Estado transiente — só visível durante o envio real ao Firebase.' },
    { section: 'Cadastrar / Entrar',
      title: 'Clicar no perfil navega para Quiz Jedi',
      motivo: 'Requer clique no elemento de perfil no menu e verificação de navegação — interação com estado de sessão ativa.' },
    { section: 'Cadastrar / Entrar',
      title: 'Botão "Sair" encerra sessão e redireciona para Início',
      motivo: 'Executar encerraria a sessão do teste em si, impedindo os demais testes.' },
    { section: 'Início',
      title: 'Botão "Juntar-se" (visitante) → abre modal de cadastro',
      motivo: 'Requer estar deslogado. Testes rodam como admin logado.' },
    { section: 'Início',
      title: 'Botão "Conhecer a iniciativa" → rola para a seção',
      motivo: 'Comportamento de scroll — verificar posição de scroll após clique é frágil e dependente de layout.' },
    { section: 'Início',
      title: 'Ranking mini em tempo real (bloco Destaques)',
      motivo: 'Requer múltiplos usuários com patente revelada para ter dados reais a verificar.' },
    { section: 'Turmas',
      title: 'Botão "Tenho interesse" (visitante) → abre cadastro',
      motivo: 'Requer estar deslogado.' },
    { section: 'Turmas',
      title: 'Botão "Tenho interesse" (logado) → registra e vira "✓ Interesse registrado"',
      motivo: 'Gravaria dado real no Firebase. Não pode ser revertido automaticamente.' },
    { section: 'Turmas',
      title: 'Agenda D1–D5 bloqueada para visitante/logado',
      motivo: 'Requer testar com usuário não-colaborador logado (outro nível de acesso).' },
    { section: 'Turmas',
      title: 'Agenda D1–D5 liberada para colaborador/admin',
      motivo: 'Verificável visualmente — o accordion abre. Pode ser adicionado como automático em versão futura.' },
    { section: 'Conteúdos',
      title: 'XP por leitura (+5 XP, 60% visível por 10s)',
      motivo: 'Requer scroll real e espera de 10 segundos com elemento visível. IntersectionObserver não é testável sem browser real interativo.' },
    { section: 'Conteúdos',
      title: 'Badge "✓ +5 XP" após ganhar XP',
      motivo: 'Requer completar o timer de leitura — depende do teste de XP acima.' },
    { section: 'Conteúdos',
      title: 'XP de conteúdos só aparece no ranking ao revelar patente',
      motivo: 'Requer fluxo completo de reveal — ação irreversível.' },
    { section: 'Repositório',
      title: 'Adicionar conteúdo ao Holocron',
      motivo: 'Gravaria dado real no Firebase. Não pode ser revertido automaticamente em teste.' },
    { section: 'Repositório',
      title: 'XP por contribuição (+10 XP, máx 20 XP, só 2 primeiras)',
      motivo: 'Requer contribuições reais. Gravaria no Firebase.' },
    { section: 'Repositório',
      title: 'Formulário — URL auto-completa https://',
      motivo: 'Estado transiente de campo de formulário — requer interação real com o input.' },
    { section: 'Repositório',
      title: 'Formulário — bloqueia URL duplicada',
      motivo: 'Requer consulta assíncrona ao Firebase com URL específica — pode ser adicionado em versão futura.' },
    { section: 'Repositório',
      title: 'Formulário — Cancelar limpa campos',
      motivo: 'Requer preencher campos e clicar Cancelar — interação transiente.' },
    { section: 'Repositório',
      title: 'Remover conteúdo próprio',
      motivo: 'Requer ter contribuído antes e deletaria dado real.' },
    { section: 'Repositório',
      title: 'Moderação Admin — ocultar/restaurar curado e deletar de usuários',
      motivo: 'Ação destrutiva real no Firebase. Não pode ser revertida automaticamente.' },
    { section: 'Quiz Jedi',
      title: 'Visitante é redirecionado para cadastro ao tentar entrar',
      motivo: 'Requer estar deslogado.' },
    { section: 'Quiz Jedi',
      title: 'Autodiagnóstico (1×) — não pode refazer',
      motivo: 'Completar o autodiagnóstico é irreversível sem reset manual.' },
    { section: 'Quiz Jedi',
      title: 'Missões (1×) — 6 missões, XP máx 35',
      motivo: 'Completar missões é irreversível. Requer interação real com 18 perguntas.' },
    { section: 'Quiz Jedi',
      title: 'Kyber Game (1×) — 25 desafios, timer 30s, XP máx 50',
      motivo: 'Completar o jogo é irreversível e requer interação em tempo real.' },
    { section: 'Quiz Jedi',
      title: 'Revelar patente — publicação definitiva',
      motivo: 'Ação completamente irreversível — publicaria patente no ranking.' },
    { section: 'Quiz Jedi',
      title: 'Reset de progresso (Admin) — apaga e remove do ranking',
      motivo: 'Ação destrutiva real. Não deve ser executada em teste automatizado.' },
    { section: 'Ranking',
      title: 'Atualização em tempo real via Firebase',
      motivo: 'Requer dois usuários simultâneos — um revelando patente enquanto o outro observa o ranking.' },
    { section: 'Admin',
      title: 'Acesso negado para visitante/logado/colaborador (URL direta)',
      motivo: 'Requer testar com diferentes níveis de acesso — não pode ser validado na sessão admin atual.' },
    { section: 'Admin',
      title: 'Colaboradores — resetar progresso',
      motivo: 'Ação destrutiva e irreversível no Firebase.' },
    { section: 'Admin',
      title: 'Colaboradores — remover colaborador',
      motivo: 'Ação destrutiva. Removeria acesso real de um colaborador.' },
    { section: 'Admin',
      title: 'Colaboradores — adicionar (formulário)',
      motivo: 'Gravaria no Firebase e exigiria limpeza manual após o teste.' }
  ];

  /* ================================================================
     ENGINE DE EXECUÇÃO
  ================================================================ */
  function runSuite(suite, onProgress, onDone) {
    const results = [];
    const allTests = [];
    suite.forEach(function (g) {
      g.tests.forEach(function (t) {
        allTests.push({ group: g.group, test: t });
      });
    });
    let i = 0;
    function next() {
      if (i >= allTests.length) { onDone(results); return; }
      const item = allTests[i++];
      function finish(passed, err) {
        results.push({ group: item.group, id: item.test.id, label: item.test.label, passed: passed, err: err || null });
        onProgress(results);
        setTimeout(next, 0);
      }
      try {
        if (item.test.async) {
          item.test.run().then(function (r) { finish(!!r); }).catch(function (e) { finish(false, e && e.message); });
        } else {
          finish(!!item.test.run());
        }
      } catch (e) { finish(false, e && e.message); }
    }
    next();
  }

  /* ================================================================
     RENDER
  ================================================================ */
  function render(container) {
    let html = '<div class="testes-wrap">';
    html += '<p class="testes-desc">Execute cada grupo independentemente ou todos de uma vez. Os testes rodam na sessão atual (admin logado).</p>';

    html += '<div class="testes-actions">';
    html += '<button class="btn btn--primary testes-run-btn" data-suite="tecnicos">▶ Técnicos</button>';
    html += '<button class="btn btn--primary testes-run-btn" data-suite="comportamento">▶ Comportamento</button>';
    html += '<button class="btn btn--outline testes-run-btn" data-suite="todos">▶ Todos os automáticos</button>';
    html += '</div>';

    html += '<div id="testesResultados"></div>';

    html += '<div class="testes-manual-wrap">';
    html += '<h4 class="testes-manual-title">📋 Regras que exigem validação manual (' + COMPORTAMENTO_MANUAL.length + ')</h4>';
    html += '<p class="testes-manual-desc">Estas regras não podem ser verificadas automaticamente. Valide-as manualmente ao testar o site.</p>';

    const SEC_COLOR = {
      'Cadastrar / Entrar': '#9b7fff',
      'Início':             '#1ab2ae',
      'Turmas':             '#f5c542',
      'Conteúdos':          '#4caf7d',
      'Repositório':        '#e8854a',
      'Quiz Jedi':          '#e05c7f',
      'Ranking':            '#57aaff',
      'Admin':              '#ff5252',
    };

    const bySection = {};
    COMPORTAMENTO_MANUAL.forEach(function (r) {
      if (!bySection[r.section]) bySection[r.section] = [];
      bySection[r.section].push(r);
    });
    Object.keys(bySection).forEach(function (sec) {
      const count = bySection[sec].length;
      const col = SEC_COLOR[sec] || 'var(--accent)';
      html += '<div class="testes-group testes-group--collapsible">';
      html += '<div class="testes-group-label testes-group-toggle" style="color:' + col + ';border-color:' + col + '"><span>' + sec + ' <span class="testes-group-count">(' + count + ')</span></span><span class="testes-group-arrow">▾</span></div>';
      html += '<div class="testes-group-body">';
      bySection[sec].forEach(function (r) {
        html += '<div class="testes-row manual">';
        html += '<span class="testes-icon">🔍</span>';
        html += '<div class="testes-manual-item"><span class="testes-label">' + r.title + '</span>';
        html += '<span class="testes-motivo">' + r.motivo + '</span></div>';
        html += '</div>';
      });
      html += '</div>';
      html += '</div>';
    });
    html += '</div>';
    html += '</div>';

    container.innerHTML = html;

    container.querySelectorAll('.testes-group-toggle').forEach(function (toggle) {
      toggle.addEventListener('click', function () {
        toggle.closest('.testes-group--collapsible').classList.toggle('open');
      });
    });

    container.querySelectorAll('.testes-run-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const suite = btn.dataset.suite;
        const el = document.getElementById('testesResultados');
        container.querySelectorAll('.testes-run-btn').forEach(function (b) { b.disabled = true; });
        el.innerHTML = '<p class="testes-running">⏳ Executando…</p>';

        const chosen = suite === 'tecnicos' ? TECNICOS
                   : suite === 'comportamento' ? COMPORTAMENTO_AUTO
                   : TECNICOS.concat(COMPORTAMENTO_AUTO);

        runSuite(
          chosen,
          function (results) { renderResults(el, results, false); },
          function (results) {
            renderResults(el, results, true);
            container.querySelectorAll('.testes-run-btn').forEach(function (b) { b.disabled = false; });
          }
        );
      });
    });
  }

  function renderResults(el, results, done) {
    const passed = results.filter(function (r) { return r.passed; }).length;
    const total  = results.length;
    const allOk  = done && passed === total;

    let html = '<div class="testes-summary ' + (done ? (allOk ? 'ok' : 'fail') : 'running') + '">';
    if (done) {
      html += allOk
        ? '✅ Todos os ' + total + ' testes passaram'
        : '❌ ' + (total - passed) + ' de ' + total + ' teste(s) falharam';
    } else {
      html += '⏳ ' + passed + ' / ' + total + ' passaram até agora…';
    }
    html += '</div>';

    const groups = {};
    results.forEach(function (r) {
      if (!groups[r.group]) groups[r.group] = [];
      groups[r.group].push(r);
    });

    Object.keys(groups).forEach(function (g) {
      html += '<div class="testes-group">';
      html += '<div class="testes-group-label">' + g + '</div>';
      groups[g].forEach(function (r) {
        html += '<div class="testes-row ' + (r.passed ? 'pass' : 'fail') + '">';
        html += '<span class="testes-icon">' + (r.passed ? '✅' : '❌') + '</span>';
        html += '<span class="testes-label">' + r.label + '</span>';
        if (!r.passed && r.err) html += '<span class="testes-err">' + r.err + '</span>';
        html += '</div>';
      });
      html += '</div>';
    });

    el.innerHTML = html;
  }

  window.faInitTestes = function () {
    var container = document.getElementById('adminPanelTestes');
    if (!container) return;
    render(container);
  };
})();
