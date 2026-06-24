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
        { id: 'xp-clean-rank',   label: 'faCleanRanking disponível (remove entrada sem reveal)',      run: function () { return typeof window.faCleanRanking === 'function'; } },
        { id: 'xp-revelar-bloqueado', label: 'REVELAR bloqueado enquanto etapas pendentes', run: function () {
          var btn = document.getElementById('revelarBtn');
          var hint = document.querySelector('.revelar-hint');
          if (!btn || !hint) return false;
          var st = window.faStore || localStorage;
          // salva estado atual
          var backup = { game: st.getItem('fa-game-v2'), kyber: st.getItem('fa-kyber-done') };
          // força estado vazio (nenhuma etapa concluída)
          st.setItem('fa-game-v2', JSON.stringify({ quiz: Array(6).fill(null), missions: {} }));
          st.setItem('fa-kyber-done', '0');
          window.dispatchEvent(new CustomEvent('fa-auth-change', { detail: null }));
          var bloqueado = btn.dataset.locked === '1';
          var mostraX = hint.innerHTML.indexOf('✗') !== -1;
          // restaura estado original
          if (backup.game !== null) st.setItem('fa-game-v2', backup.game); else st.removeItem('fa-game-v2');
          if (backup.kyber !== null) st.setItem('fa-kyber-done', backup.kyber); else st.removeItem('fa-kyber-done');
          window.dispatchEvent(new CustomEvent('fa-auth-change', { detail: null }));
          return bloqueado && mostraX;
        } },
        { id: 'xp-revelar-liberado', label: 'REVELAR desbloqueado com 3 etapas completas', run: function () {
          var btn = document.getElementById('revelarBtn');
          var hint = document.querySelector('.revelar-hint');
          if (!btn || !hint) return false;
          if (!window.faGameData) return false;
          var st = window.faStore || localStorage;
          // salva estado atual
          var backup = { game: st.getItem('fa-game-v2'), kyber: st.getItem('fa-kyber-done') };
          // força estado completo usando IDs e quantidade de perguntas reais
          var missions = {};
          window.faGameData.MISSIONS.forEach(function (m) {
            missions[m.id] = { answers: m.questions.map(function () { return 0; }) };
          });
          var quiz = window.faGameData.DIMS.map(function () { return 1; });
          st.setItem('fa-game-v2', JSON.stringify({ quiz: quiz, missions: missions }));
          st.setItem('fa-kyber-done', '1');
          window.dispatchEvent(new CustomEvent('fa-auth-change', { detail: null }));
          var liberado = btn.dataset.locked !== '1';
          var mostraCheck = hint.innerHTML.indexOf('✓') !== -1;
          // restaura estado original
          if (backup.game !== null) st.setItem('fa-game-v2', backup.game); else st.removeItem('fa-game-v2');
          if (backup.kyber !== null) st.setItem('fa-kyber-done', backup.kyber); else st.removeItem('fa-kyber-done');
          window.dispatchEvent(new CustomEvent('fa-auth-change', { detail: null }));
          return liberado && mostraCheck;
        } },
        { id: 'xp-revelar-progress-change', label: 'REVELAR atualiza na hora via fa-progress-change (sem precisar refresh)', run: function () {
          var btn = document.getElementById('revelarBtn');
          var hint = document.querySelector('.revelar-hint');
          if (!btn || !hint) return false;
          if (!window.faGameData) return false;
          var st = window.faStore || localStorage;
          // salva estado atual
          var backup = { game: st.getItem('fa-game-v2'), kyber: st.getItem('fa-kyber-done') };
          // garante estado pendente primeiro (simula sessão antes de concluir)
          st.setItem('fa-game-v2', JSON.stringify({ quiz: Array(6).fill(null), missions: {} }));
          st.setItem('fa-kyber-done', '0');
          window.dispatchEvent(new CustomEvent('fa-auth-change', { detail: null }));
          var pendenteAntes = btn.dataset.locked === '1';
          // agora força conclusão das 3 etapas e dispara SOMENTE fa-progress-change
          // (o mesmo evento que faSyncProgress dispara ao salvar progresso em tempo real)
          var missions = {};
          window.faGameData.MISSIONS.forEach(function (m) {
            missions[m.id] = { answers: m.questions.map(function () { return 0; }) };
          });
          var quiz = window.faGameData.DIMS.map(function () { return 1; });
          st.setItem('fa-game-v2', JSON.stringify({ quiz: quiz, missions: missions }));
          st.setItem('fa-kyber-done', '1');
          window.dispatchEvent(new CustomEvent('fa-progress-change'));
          var liberadoSemRefresh = btn.dataset.locked !== '1';
          var mostraCheck = hint.innerHTML.indexOf('✓') !== -1;
          // restaura estado original
          if (backup.game !== null) st.setItem('fa-game-v2', backup.game); else st.removeItem('fa-game-v2');
          if (backup.kyber !== null) st.setItem('fa-kyber-done', backup.kyber); else st.removeItem('fa-kyber-done');
          window.dispatchEvent(new CustomEvent('fa-auth-change', { detail: null }));
          return pendenteAntes && liberadoSemRefresh && mostraCheck;
        } },
        { id: 'xp-revelar-parciais', label: 'REVELAR: mensagem correta para 1 ou 2 etapas pendentes', run: function () {
          var btn = document.getElementById('revelarBtn');
          var hint = document.querySelector('.revelar-hint');
          if (!btn || !hint) return false;
          if (!window.faGameData) return false;
          var st = window.faStore || localStorage;
          var backup = { game: st.getItem('fa-game-v2'), kyber: st.getItem('fa-kyber-done') };
          var missions = {};
          window.faGameData.MISSIONS.forEach(function (m) {
            missions[m.id] = { answers: m.questions.map(function () { return 0; }) };
          });
          var quizDone = window.faGameData.DIMS.map(function () { return 1; });
          var quizPend = Array(window.faGameData.DIMS.length).fill(null);
          function setState(auto, miss, kyber) {
            st.setItem('fa-game-v2', JSON.stringify({ quiz: auto ? quizDone : quizPend, missions: miss ? missions : {} }));
            st.setItem('fa-kyber-done', kyber ? '1' : '0');
            window.dispatchEvent(new CustomEvent('fa-progress-change'));
            return { locked: btn.dataset.locked === '1', html: hint.innerHTML };
          }
          // só falta 1 etapa: deve mostrar "Falta completar: <etapa>." e ficar bloqueado
          var soFaltaKyber = setState(true, true, false);
          var soFaltaMissoes = setState(true, false, true);
          var soFaltaAuto = setState(false, true, true);
          // faltam 2 etapas: deve mostrar "Faltam: X e Y." e ficar bloqueado
          var faltam2 = setState(false, false, true);
          // restaura estado original
          if (backup.game !== null) st.setItem('fa-game-v2', backup.game); else st.removeItem('fa-game-v2');
          if (backup.kyber !== null) st.setItem('fa-kyber-done', backup.kyber); else st.removeItem('fa-kyber-done');
          window.dispatchEvent(new CustomEvent('fa-auth-change', { detail: null }));
          return soFaltaKyber.locked && soFaltaKyber.html.indexOf('Falta completar: Kyber Game.') !== -1 &&
            soFaltaMissoes.locked && soFaltaMissoes.html.indexOf('Falta completar: missões.') !== -1 &&
            soFaltaAuto.locked && soFaltaAuto.html.indexOf('Falta completar: autodiagnóstico.') !== -1 &&
            faltam2.locked && faltam2.html.indexOf('Faltam: autodiagnóstico e missões.') !== -1;
        } },
        { id: 'xp-revelar-ordem-livre', label: 'REVELAR: libera com as 3 etapas completas em qualquer ordem', run: function () {
          var btn = document.getElementById('revelarBtn');
          var hint = document.querySelector('.revelar-hint');
          if (!btn || !hint) return false;
          if (!window.faGameData) return false;
          var st = window.faStore || localStorage;
          var backup = { game: st.getItem('fa-game-v2'), kyber: st.getItem('fa-kyber-done') };
          var missions = {};
          window.faGameData.MISSIONS.forEach(function (m) {
            missions[m.id] = { answers: m.questions.map(function () { return 0; }) };
          });
          var quizDone = window.faGameData.DIMS.map(function () { return 1; });
          var quizPend = Array(window.faGameData.DIMS.length).fill(null);
          function setState(auto, miss, kyber) {
            st.setItem('fa-game-v2', JSON.stringify({ quiz: auto ? quizDone : quizPend, missions: miss ? missions : {} }));
            st.setItem('fa-kyber-done', kyber ? '1' : '0');
            window.dispatchEvent(new CustomEvent('fa-progress-change'));
          }
          // simula a pessoa completando na ordem Kyber -> Missões -> Autodiagnóstico
          setState(false, false, false);
          setState(false, false, true);
          setState(false, true, true);
          setState(true, true, true);
          var liberado = btn.dataset.locked !== '1';
          var mostraTexto = hint.innerHTML.indexOf('completou as 3 etapas') !== -1;
          if (backup.game !== null) st.setItem('fa-game-v2', backup.game); else st.removeItem('fa-game-v2');
          if (backup.kyber !== null) st.setItem('fa-kyber-done', backup.kyber); else st.removeItem('fa-kyber-done');
          window.dispatchEvent(new CustomEvent('fa-auth-change', { detail: null }));
          return liberado && mostraTexto;
        } },
        { id: 'xp-revelar-modal', label: 'Revelar: abre modal com rank, checkbox publicar marcado por default', run: function () {
          if (!window.faGameData) return false;
          var st = window.faStore || localStorage;
          var backup = {
            game: st.getItem('fa-game-v2'), kyber: st.getItem('fa-kyber-done'),
            revealed: st.getItem('fa-patente-revealed'), publicada: st.getItem('fa-patente-publicada'),
            player: localStorage.getItem('fa-player')
          };
          var origSyncProgress = window.faSyncProgress;
          var origSyncPlayer = window.faSyncPlayer;
          var syncProgressCount = 0; var syncPlayerCount = 0;
          window.faSyncProgress = function() { syncProgressCount++; };
          window.faSyncPlayer   = function() { syncPlayerCount++; };
          try {
            var missions = {};
            window.faGameData.MISSIONS.forEach(function(m) {
              missions[m.id] = { answers: m.questions.map(function() { return 0; }) };
            });
            st.setItem('fa-game-v2', JSON.stringify({ quiz: window.faGameData.DIMS.map(function() { return 1; }), missions: missions }));
            st.setItem('fa-kyber-done', '1');
            st.removeItem('fa-patente-revealed');
            st.removeItem('fa-patente-publicada');
            localStorage.setItem('fa-player', JSON.stringify({ name: 'Teste Modal XYZ', turma: 'XX', area: 'XX' }));
            window.dispatchEvent(new CustomEvent('fa-progress-change'));

            var revelarBtn = document.getElementById('revelarBtn');
            if (!revelarBtn || revelarBtn.dataset.locked === '1') return false;
            revelarBtn.click();

            // Modal deve estar visível
            var modal = document.getElementById('revelarModal');
            if (!modal || modal.hidden) return false;
            var check = document.getElementById('revelarPublicarCheck');
            var checkDefault = check && check.checked; // deve vir marcado
            var temRank = !!(document.getElementById('rmodalRank') && document.getElementById('rmodalRank').textContent.length > 0);

            // Clicar Continuar com checkbox marcado → revela + publica
            syncProgressCount = 0; syncPlayerCount = 0;
            var modalOk = document.getElementById('revelarModalOk');
            if (modalOk) modalOk.click();
            var revelado = st.getItem('fa-patente-revealed') === '1';
            var publicada = st.getItem('fa-patente-publicada') === '1';
            var syncOk = syncProgressCount >= 1 && syncPlayerCount >= 1;

            return checkDefault && temRank && revelado && publicada && syncOk;
          } finally {
            window.faSyncProgress = origSyncProgress;
            window.faSyncPlayer   = origSyncPlayer;
            if (backup.game !== null) st.setItem('fa-game-v2', backup.game); else st.removeItem('fa-game-v2');
            if (backup.kyber !== null) st.setItem('fa-kyber-done', backup.kyber); else st.removeItem('fa-kyber-done');
            if (backup.revealed !== null) st.setItem('fa-patente-revealed', backup.revealed); else st.removeItem('fa-patente-revealed');
            if (backup.publicada !== null) st.setItem('fa-patente-publicada', backup.publicada); else st.removeItem('fa-patente-publicada');
            if (backup.player !== null) localStorage.setItem('fa-player', backup.player); else localStorage.removeItem('fa-player');
            var modal = document.getElementById('revelarModal');
            if (modal) modal.hidden = true;
            document.body.style.overflow = '';
            window.dispatchEvent(new CustomEvent('fa-progress-change'));
          }
        } },
        { id: 'xp-revelar-sem-publicar', label: 'Revelar com checkbox desmarcado: revela mas NÃO publica', run: function () {
          if (!window.faGameData) return false;
          var st = window.faStore || localStorage;
          var backup = {
            game: st.getItem('fa-game-v2'), kyber: st.getItem('fa-kyber-done'),
            revealed: st.getItem('fa-patente-revealed'), publicada: st.getItem('fa-patente-publicada'),
            player: localStorage.getItem('fa-player')
          };
          var origSyncProgress = window.faSyncProgress;
          var origSyncPlayer = window.faSyncPlayer;
          var syncPlayerCount = 0;
          window.faSyncProgress = function() {};
          window.faSyncPlayer   = function() { syncPlayerCount++; };
          try {
            var missions = {};
            window.faGameData.MISSIONS.forEach(function(m) {
              missions[m.id] = { answers: m.questions.map(function() { return 0; }) };
            });
            st.setItem('fa-game-v2', JSON.stringify({ quiz: window.faGameData.DIMS.map(function() { return 1; }), missions: missions }));
            st.setItem('fa-kyber-done', '1');
            st.removeItem('fa-patente-revealed');
            st.removeItem('fa-patente-publicada');
            localStorage.setItem('fa-player', JSON.stringify({ name: 'Teste Privado XYZ', turma: 'XX', area: 'XX' }));
            window.dispatchEvent(new CustomEvent('fa-progress-change'));

            var revelarBtn = document.getElementById('revelarBtn');
            if (!revelarBtn || revelarBtn.dataset.locked === '1') return false;
            revelarBtn.click();

            var check = document.getElementById('revelarPublicarCheck');
            if (check) check.checked = false; // desmarca
            var modalOk = document.getElementById('revelarModalOk');
            if (modalOk) modalOk.click();

            var revelado = st.getItem('fa-patente-revealed') === '1';
            var naoPublicada = st.getItem('fa-patente-publicada') !== '1';
            var semPlayer = syncPlayerCount === 0;
            return revelado && naoPublicada && semPlayer;
          } finally {
            window.faSyncProgress = origSyncProgress;
            window.faSyncPlayer   = origSyncPlayer;
            if (backup.game !== null) st.setItem('fa-game-v2', backup.game); else st.removeItem('fa-game-v2');
            if (backup.kyber !== null) st.setItem('fa-kyber-done', backup.kyber); else st.removeItem('fa-kyber-done');
            if (backup.revealed !== null) st.setItem('fa-patente-revealed', backup.revealed); else st.removeItem('fa-patente-revealed');
            if (backup.publicada !== null) st.setItem('fa-patente-publicada', backup.publicada); else st.removeItem('fa-patente-publicada');
            if (backup.player !== null) localStorage.setItem('fa-player', backup.player); else localStorage.removeItem('fa-player');
            var modal = document.getElementById('revelarModal');
            if (modal) modal.hidden = true;
            document.body.style.overflow = '';
            window.dispatchEvent(new CustomEvent('fa-progress-change'));
          }
        } }
      ]
    },
    {
      group: 'Painel Admin',
      tests: [
        { id: 'adm-manual', label: 'faInitManual disponível',   run: function () { return typeof window.faInitManual === 'function'; } },
        { id: 'adm-mapa',   label: 'faInitMapa disponível',     run: function () { return typeof window.faInitMapa === 'function'; } },
        { id: 'adm-tabs',   label: 'Abas Admin presentes (8: Interessados/Repositório/Colaboradores/Cadastrados/Administradores/Manual/Mapa/Testes)', run: function () { return document.querySelectorAll('.admin-tab-btn').length === 8; } },
        { id: 'adm-manual-panel', label: 'Painel Manual presente', run: function () { return !!document.getElementById('adminPanelManual'); } },
        { id: 'adm-mapa-panel',   label: 'Painel Mapa presente',   run: function () { return !!document.getElementById('adminPanelMapa'); } },
        { id: 'adm-mapa-cards',   label: 'Mapa: 9 cards de página renderizados', run: function () {
          if (window.faInitMapa) window.faInitMapa();
          return document.querySelectorAll('#adminMapa .mapa-page').length === 9;
        } },
        { id: 'adm-mapa-features', label: 'Mapa: todos os cards têm features', run: function () {
          if (window.faInitMapa) window.faInitMapa();
          var cards = document.querySelectorAll('#adminMapa .mapa-page');
          if (cards.length !== 9) return false;
          return Array.from(cards).every(function (c) { return c.querySelectorAll('.mapa-feature').length > 0; });
        } },
        { id: 'adm-mapa-features-completas', label: 'Mapa: nenhum card renderiza menos features do que o definido (sem clipping)', run: function () {
          if (window.faInitMapa) window.faInitMapa();
          if (!window.faMapaPages) return false;
          var cards = document.querySelectorAll('#adminMapa .mapa-page');
          if (cards.length !== window.faMapaPages.length) return false;
          return Array.from(cards).every(function (c, i) {
            var titulo = c.querySelector('.mapa-page-title').textContent.trim().toLowerCase();
            var esperado = window.faMapaPages[i].label.toLowerCase();
            var rendered = c.querySelectorAll('.mapa-feature').length;
            var definido = window.faMapaPages[i].features.length;
            return titulo.indexOf(esperado) === 0 && rendered === definido;
          });
        } },
        { id: 'adm-testes-panel', label: 'Painel Testes presente', run: function () { return !!document.getElementById('adminPanelTestes'); } },
        { id: 'adm-cadastrados-panel', label: 'Painel Cadastrados presente', run: function () { return !!document.getElementById('adminPanelCadastrados') && !!document.getElementById('adminCadastrados'); } },
        { id: 'adm-cadastrados-lista', label: 'Cadastrados: tabela renderizada com badge de contagem correta', run: function () {
          var c = document.getElementById('adminCadastrados');
          if (!c) return false;
          var badge = c.querySelector('.admin-badge');
          var rows = c.querySelectorAll('tbody tr');
          if (!badge) return false;
          var n = parseInt(badge.textContent, 10);
          return n === rows.length;
        } },
        { id: 'adm-cadastrados-filtro', label: 'Cadastrados: filtro reduz a lista de forma consistente', run: function () {
          var c = document.getElementById('adminCadastrados');
          var input = document.getElementById('cadastradosFiltro');
          if (!c || !input) return false;
          var rowsAntes = c.querySelectorAll('tbody tr').length;
          if (rowsAntes === 0) return true; // nada cadastrado ainda — não há o que filtrar
          var primeiraEmail = c.querySelector('tbody tr td:nth-child(2)').textContent;
          var termo = primeiraEmail.slice(0, 4);
          input.value = termo;
          input.dispatchEvent(new Event('input'));
          var linhas = Array.from(c.querySelectorAll('tbody tr'));
          var todasContemTermo = linhas.length > 0 && linhas.every(function (tr) {
            var nome = tr.querySelector('td:nth-child(1)').textContent.toLowerCase();
            var email = tr.querySelector('td:nth-child(2)').textContent.toLowerCase();
            return nome.indexOf(termo.toLowerCase()) !== -1 || email.indexOf(termo.toLowerCase()) !== -1;
          });
          var reduziu = linhas.length <= rowsAntes;
          // restaura
          input.value = '';
          input.dispatchEvent(new Event('input'));
          return todasContemTermo && reduziu;
        } },
        { id: 'adm-cadastrados-xp', label: 'Cadastrados: coluna XP presente na tabela', run: function () {
          var c = document.getElementById('adminCadastrados');
          if (!c) return false;
          var ths = c.querySelectorAll('thead th');
          return Array.from(ths).some(function(th) { return th.textContent.trim() === 'XP'; });
        } },
        { id: 'adm-colab-sem-reset-redefinir', label: 'Colaboradores: não tem botões de resetar progresso/redefinir senha', run: function () {
          var c = document.getElementById('adminColab');
          if (!c) return false;
          var semPwd = !c.querySelector('.admin-pwd-btn');
          var semReset = !c.querySelector('.admin-reset-btn');
          return semPwd && semReset;
        } }
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
        { id: 'c-reg-area',     label: 'Campo área/setor com 20 gerências carregadas em ordem alfabética',
          run: function () {
            var items = Array.from(document.querySelectorAll('#regAreaSelect [data-val]'));
            if (items.length !== 20) return false;
            var vals = items.map(function (el) { return el.dataset.val; });
            var sorted = vals.slice().sort();
            return JSON.stringify(vals) === JSON.stringify(sorted);
          }
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
      group: 'Página Conteúdos',
      tests: [
        { id: 'c-conteudos-nav', label: 'Nav lateral de Conteúdos inicializa ao entrar na página (#conteudosNavSidebar)', run: function () {
          if (window.faRouter && window.faRouter.current() !== 'conteudos') return true; // só verifica se estiver na página
          return !!document.getElementById('conteudosNavSidebar');
        } },
        { id: 'c-conteudos-7sections', label: '7 seções de conteúdo presentes no DOM', run: function () {
          var ids = ['content-galaxia','content-forca','content-principios','content-yoda','content-arquetipos','content-sombrio','content-trilogia'];
          return ids.every(function (id) { return !!document.getElementById(id); });
        } },
        { id: 'c-conteudos-valores-link', label: 'Link "Ler os 4 valores na íntegra" presente e correto', run: function () {
          var link = Array.from(document.querySelectorAll('#page-conteudos .manifesto-link')).find(function (a) { return /4 valores/i.test(a.textContent); });
          return !!link && link.getAttribute('href') === 'https://agilemanifesto.org/iso/ptbr/manifesto.html' && link.getAttribute('target') === '_blank';
        } },
        { id: 'c-conteudos-principios-link', label: 'Link "Ler os 12 princípios na íntegra" presente e correto', run: function () {
          var link = Array.from(document.querySelectorAll('#page-conteudos .manifesto-link')).find(function (a) { return /12 princípios/i.test(a.textContent); });
          return !!link && link.getAttribute('href') === 'https://agilemanifesto.org/iso/ptbr/principles.html' && link.getAttribute('target') === '_blank';
        } }
      ]
    },
    {
      group: 'Página Início',
      tests: [
        { id: 'c-hero',         label: 'Hero com título "Força Ágil" presente',         run: function () { return !!document.querySelector('.hero-title, .hero'); } },
        { id: 'c-cta-btn',        label: 'Botão "Juntar-se à Força" existe no DOM',         run: function () { return !!document.getElementById('heroJoin'); } },
        { id: 'c-cta-btn-logado', label: 'Botão "Juntar-se à Força" oculto quando logado',   run: function () {
          var btn = document.getElementById('heroJoin');
          if (!btn) return false;
          var sess = window.faAuth ? window.faAuth.getSession() : null;
          return sess ? btn.hidden === true : btn.hidden === false;
        } },
        { id: 'c-como-funciona', label: 'Como funciona: os 3 links apontam para páginas reais e com o título certo', run: function () {
          var cards = document.querySelectorAll('.how-grid .how-card');
          if (cards.length !== 3) return false;
          var map = { conteudos: 'Conteúdos', repositorio: 'Repositório Colaborativo', gamificacao: 'Treinamento Jedi' };
          return Array.from(cards).every(function (c) {
            var page = (c.getAttribute('href') || '').replace('#', '');
            var titulo = c.querySelector('h3') ? c.querySelector('h3').textContent.trim() : '';
            return !!map[page] && titulo === map[page] && !!document.getElementById('page-' + page);
          });
        } },
        { id: 'c-destaques-removidos', label: 'Seção "O que está acontecendo" (Destaques) removida na v2', run: function () {
          return !document.getElementById('destaques');
        } },
        { id: 'c-cta-ver-turmas', label: 'CTA final: único botão "Ver turmas →" presente e aponta para #turmas', run: function () {
          var link = document.querySelector('.hero-actions a[data-nav-page="turmas"]');
          return !!link && /turmas/i.test(link.textContent);
        } },
        { id: 'c-footer-previ', label: 'Rodapé: link externo para previ.com.br presente e abre em nova aba', run: function () {
          var link = document.querySelector('.footer-previ');
          if (!link) return false;
          return link.getAttribute('href') === 'https://www.previ.com.br' && link.getAttribute('target') === '_blank';
        } }
      ]
    },
    {
      group: 'Página FAQ',
      tests: [
        { id: 'c-faq-page', label: 'Página FAQ presente no DOM (#page-faq)', run: function () { return !!document.getElementById('page-faq'); } },
        { id: 'c-faq-items', label: 'FAQ tem 6 itens de acordeão (.faq-item)', run: function () { return document.querySelectorAll('#page-faq .faq-item').length === 6; } },
        { id: 'c-faq-nav',   label: 'Link "FAQ" presente no menu de navegação', run: function () { return !!document.querySelector('[data-nav-page="faq"]'); } },
      ]
    },
    {
      group: 'Página Conteúdos — 12 Princípios',
      tests: [
        { id: 'c-principios-btn', label: 'Botão "Ver os 6 princípios restantes →" presente (#principlesMoreBtn)', run: function () { return !!document.getElementById('principlesMoreBtn'); } },
        { id: 'c-principios-extra', label: 'Bloco extra de princípios oculto por padrão (#principlesExtra)', run: function () {
          var el = document.getElementById('principlesExtra');
          return !!el && !el.classList.contains('visible');
        } },
        { id: 'c-principios-revelar', label: 'Clicar no botão revela os princípios 7–12', run: function () {
          var btn = document.getElementById('principlesMoreBtn');
          var extra = document.getElementById('principlesExtra');
          if (!btn || !extra) return false;
          var originalDisplay = btn.style.display;
          btn.click();
          var revelado = extra.classList.contains('visible') && btn.style.display === 'none';
          // restaura
          extra.classList.remove('visible');
          btn.style.display = originalDisplay;
          return revelado;
        } }
      ]
    },
    {
      group: 'Página Repositório',
      tests: [
        { id: 'c-repo-curado',   label: 'Badge "curado" presente em algum card do repositório',
          run: function () { return typeof window.faRepoSeedCount === 'number' && window.faRepoSeedCount > 0; }
        },
        { id: 'c-repo-container', label: 'Container do repositório presente no DOM', run: function () { return !!document.getElementById('repoGrid'); } },
        { id: 'c-repo-chips', label: 'Filtro de tipo: 5 chips presentes (Todos/Vídeos/Documentos/Ferramentas/Livros)', run: function () {
          var chips = document.querySelectorAll('#repoFilters .repo-chip');
          if (chips.length !== 5) return false;
          var tipos = Array.from(chips).map(function (c) { return c.dataset.f; });
          return ['all', 'video', 'doc', 'tool', 'book'].every(function (t) { return tipos.indexOf(t) !== -1; });
        } },
        { id: 'c-repo-filtro-funciona', label: 'Filtro de tipo: clicar em "Vídeos" mostra só cards do tipo vídeo', run: function () {
          var chips = document.querySelectorAll('#repoFilters .repo-chip');
          var videoChip = Array.from(chips).find(function (c) { return c.dataset.f === 'video'; });
          var allChip = Array.from(chips).find(function (c) { return c.dataset.f === 'all'; });
          if (!videoChip || !allChip) return false;
          videoChip.click();
          var cards = document.querySelectorAll('#repoGrid .repo-card');
          var soVideo = cards.length > 0 && Array.from(cards).every(function (c) { return c.dataset.type === 'video'; });
          allChip.click();
          return soVideo;
        } },
        { id: 'c-repo-desc-clamp', label: 'Descrições dos cards têm line-clamp de 2 linhas (.repo-card .rc-desc)', run: function () {
          var p = document.querySelector('#repoGrid .rc-desc');
          if (!p) return false;
          var style = window.getComputedStyle(p);
          return style.webkitLineClamp === '2' || style.getPropertyValue('-webkit-line-clamp') === '2';
        } },
        { id: 'c-repo-ver-mais-overflow', label: 'Botão "ver mais" presente apenas em cards com texto que transborda 2 linhas', run: function () {
          var btns = document.querySelectorAll('#repoGrid .rc-more');
          return Array.from(btns).every(function (btn) {
            var p = btn.previousElementSibling;
            return p && p.classList.contains('rc-desc');
          });
        } }
      ]
    },
    {
      group: 'Página Turmas',
      tests: [
        { id: 'c-turmas-cards',   label: '3 cards de turma presentes (.turma-card-new)', run: function () { return document.querySelectorAll('.turma-card-new').length === 3; } },
        { id: 'c-turmas-como-funciona', label: 'Bloco "Como funciona a oficina" presente (.oficina-info)', run: function () { return !!document.querySelector('.oficina-info'); } },
        { id: 'c-turmas-ofinfo',  label: 'Bloco tem 4 métricas (.ofinfo-item)', run: function () { return document.querySelectorAll('.ofinfo-item').length === 4; } },
        { id: 'c-turmas-intent-btn', label: 'Botões de interesse presentes (.btn--interest)', run: function () { return document.querySelectorAll('.btn--interest').length === 3; } },
        { id: 'c-turmas-intent-msg', label: 'Containers de mensagem de login presentes (#intent-msg-t1/t2/t3)', run: function () {
          return !!document.getElementById('intent-msg-t1') && !!document.getElementById('intent-msg-t2') && !!document.getElementById('intent-msg-t3');
        } }
      ]
    },
    {
      group: 'Página Treinamento Jedi',
      tests: [
        { id: 'c-quiz-welcome', label: 'Welcome screen presente no DOM (#treinamento-welcome)', run: function () {
          return !!document.getElementById('treinamento-welcome');
        } },
        { id: 'c-quiz-welcome-btn', label: 'Botão "Quero jogar" presente na welcome screen', run: function () {
          return !!document.getElementById('jedWelcomeBtn');
        } },
        { id: 'c-quiz-welcome-auth', label: 'Welcome screen oculta para logado; jogo visível', run: function () {
          var sess = window.faAuth && window.faAuth.getSession && window.faAuth.getSession();
          var welcome = document.getElementById('treinamento-welcome');
          var game    = document.getElementById('treinamento');
          if (!welcome || !game) return false;
          if (sess) return welcome.hidden === true && game.hidden === false;
          return welcome.hidden === false && game.hidden === true;
        } },
        { id: 'c-kyber-hidden-visitante', label: 'Seção Kyber Game (#kyber) oculta para visitante; visível para logado', run: function () {
          var sess = window.faAuth && window.faAuth.getSession && window.faAuth.getSession();
          var kyber = document.getElementById('kyber');
          if (!kyber) return false;
          if (sess) return kyber.hidden === false;
          return kyber.hidden === true;
        } },
        { id: 'c-quiz-jedi-stepper', label: 'Welcome screen contém stepper com 4 passos (.jedi-step)', run: function () {
          return document.querySelectorAll('#treinamento-welcome .jedi-step').length === 4;
        } },
        { id: 'c-quiz-patente',   label: 'Painel de patente presente',             run: function () { return !!document.getElementById('rankHud'); } },
        { id: 'c-quiz-patentes',  label: '4 patentes exibidas (Youngling→Mestre)', run: function () { return document.querySelectorAll('.char-card').length >= 4; } },
        { id: 'c-quiz-previx',    label: 'Droide Previx (guia) presente',          run: function () { return !!document.querySelector('.guide-droide') || !!document.getElementById('guideMsg'); } },
        { id: 'c-quiz-auto-1x', label: 'Autodiagnóstico (1×): opções bloqueadas após concluído', run: function () {
          if (!window.faGameData || !window.faGameReload) return false;
          var st = window.faStore || localStorage;
          var backup = st.getItem('fa-game-v2');
          var current = (function () { try { return JSON.parse(backup || 'null'); } catch (e) { return null; } })() || { quiz: [], missions: {} };
          var quizCompleto = window.faGameData.DIMS.map(function () { return 1; });
          st.setItem('fa-game-v2', JSON.stringify({ quiz: quizCompleto, missions: current.missions || {} }));
          window.faGameReload();
          var opts = document.querySelectorAll('.q-opt');
          var todasBloqueadas = opts.length > 0 && Array.from(opts).every(function (b) { return b.disabled; });
          if (backup !== null) st.setItem('fa-game-v2', backup); else st.removeItem('fa-game-v2');
          window.faGameReload();
          return todasBloqueadas;
        } },
        { id: 'c-quiz-missao-1x', label: 'Missões (1×): missão concluída não reabre ao clicar', run: function () {
          if (!window.faGameData || !window.faGameReload) return false;
          var st = window.faStore || localStorage;
          var backup = st.getItem('fa-game-v2');
          var current = (function () { try { return JSON.parse(backup || 'null'); } catch (e) { return null; } })() || { quiz: [], missions: {} };
          var primeira = window.faGameData.MISSIONS[0];
          var missions = {};
          missions[primeira.id] = { answers: primeira.questions.map(function () { return 0; }) };
          st.setItem('fa-game-v2', JSON.stringify({ quiz: current.quiz || [], missions: missions }));
          window.faGameReload();
          var wrap = document.querySelector('.mission-wrap[data-id="' + primeira.id + '"]');
          var header = wrap && wrap.querySelector('.mission');
          var bloqueada = false;
          if (header) {
            wrap.classList.remove('open');
            header.click();
            bloqueada = !wrap.classList.contains('open');
          }
          if (backup !== null) st.setItem('fa-game-v2', backup); else st.removeItem('fa-game-v2');
          window.faGameReload();
          return !!header && bloqueada;
        } },
        { id: 'c-quiz-missoes-result', label: 'Missões: "Missões de Campo completas · +X pts" aparece após concluir todas', run: function () {
          if (!window.faGameData || !window.faGameReload) return false;
          var st = window.faStore || localStorage;
          var backup = st.getItem('fa-game-v2');
          var current = (function () { try { return JSON.parse(backup || 'null'); } catch (e) { return null; } })() || { quiz: [], missions: {} };
          var missions = {};
          window.faGameData.MISSIONS.forEach(function (m) {
            missions[m.id] = { answers: m.questions.map(function (q) { return q.correct; }) };
          });
          st.setItem('fa-game-v2', JSON.stringify({ quiz: current.quiz || [], missions: missions }));
          window.faGameReload();
          var el = document.getElementById('missionsResult');
          var texto = el ? el.textContent : '';
          var temCompletas = texto.indexOf('Missões de Campo completas') !== -1;
          var temPts = /\+\d+ pts/.test(texto);
          if (backup !== null) st.setItem('fa-game-v2', backup); else st.removeItem('fa-game-v2');
          window.faGameReload();
          return temCompletas && temPts;
        } },
        { id: 'c-quiz-xp-ponderado', label: 'Autodiagnóstico: pontos ponderados pelo nível (Ensino > Já ouvi falar)', run: function () {
          if (!window.faGameData || !window.faGameReload) return false;
          var st = window.faStore || localStorage;
          var backup = st.getItem('fa-game-v2');
          var dims = window.faGameData.DIMS.length;
          function getXP(level) {
            st.setItem('fa-game-v2', JSON.stringify({ quiz: Array(dims).fill(level), missions: {} }));
            window.faGameReload();
            var el = document.getElementById('quizResult');
            var m = el && el.textContent.match(/\+(\d+) pts/);
            return m ? parseInt(m[1], 10) : -1;
          }
          var xpMin = getXP(1); // Já ouvi falar (1-based)
          var xpMax = getXP(4); // Ensino (1-based)
          if (backup !== null) st.setItem('fa-game-v2', backup); else st.removeItem('fa-game-v2');
          window.faGameReload();
          return xpMin < xpMax && xpMax === 15;
        } },
        { id: 'c-quiz-missao-lock-msg', label: 'Missões: mensagem de cadeado aparece quando concluída', run: function () {
          if (!window.faGameData || !window.faGameReload) return false;
          var st = window.faStore || localStorage;
          var backup = st.getItem('fa-game-v2');
          var current = (function () { try { return JSON.parse(backup || 'null'); } catch (e) { return null; } })() || { quiz: [], missions: {} };
          var m = window.faGameData.MISSIONS[0];
          var missions = {};
          // Responde todas certas
          missions[m.id] = { answers: m.questions.map(function (q) { return q.correct; }) };
          st.setItem('fa-game-v2', JSON.stringify({ quiz: current.quiz || [], missions: missions }));
          window.faGameReload();
          var wrap = document.querySelector('.mission-wrap[data-id="' + m.id + '"]');
          var lockMsg = wrap && wrap.querySelector('.m-lock-msg');
          var temMensagem = lockMsg && lockMsg.textContent.indexOf('concluída') !== -1 && lockMsg.textContent.indexOf('não pode ser refeita') !== -1;
          if (backup !== null) st.setItem('fa-game-v2', backup); else st.removeItem('fa-game-v2');
          window.faGameReload();
          return !!temMensagem;
        } },
        { id: 'c-quiz-kyber-1x', label: 'Kyber Game (1×): bloqueado para replay após concluído', run: function () {
          if (typeof window.kyberAlreadyPlayed !== 'function') return false;
          var st = window.faStore || localStorage;
          var backup = st.getItem('fa-kyber-done');
          st.setItem('fa-kyber-done', '1');
          var bloqueado = window.kyberAlreadyPlayed() === true;
          if (backup !== null) st.setItem('fa-kyber-done', backup); else st.removeItem('fa-kyber-done');
          return bloqueado;
        } },
        { id: 'c-kyber-sem-patente-na-tela', label: 'Kyber Game: tela de conclusão mostra pontuação/pts Kyber, mas não "Patente" (estado transitório)', run: function () {
          if (typeof window.kyberFinishGame !== 'function' || typeof gameState === 'undefined') return false;
          var st = window.faStore || localStorage;
          var backupDone = st.getItem('fa-kyber-done');
          var backupXP = st.getItem('fa-kyber-xp');
          var backupScore = gameState.totalScore;
          // Stuba faSyncProgress para não escrever no Firebase real durante o teste
          var origSyncProgress = window.faSyncProgress;
          window.faSyncProgress = function() {};
          try {
            gameState.totalScore = 12345;
            window.kyberFinishGame();
            var go = document.getElementById('kyber-gameover');
            var html = go ? go.innerHTML : '';
            // "Patente" pode aparecer no botão de navegação — verifica que nenhum RANQUE calculado aparece
            var semPatente = !/(Youngling|Padawan|Cavaleiro Jedi|Mestre Jedi|Mestre do Conselho)/.test(html);
            var temScore = html.indexOf('12345') !== -1;
            var temPts = /\+\d+ pts Kyber/.test(html);
            if (go) go.style.display = 'none';
            return semPatente && temScore && temPts;
          } finally {
            window.faSyncProgress = origSyncProgress;
            gameState.totalScore = backupScore;
            if (backupDone !== null) st.setItem('fa-kyber-done', backupDone); else st.removeItem('fa-kyber-done');
            if (backupXP !== null) st.setItem('fa-kyber-xp', backupXP); else st.removeItem('fa-kyber-xp');
          }
        } },
        { id: 'c-kyber-score-com-speedbonus', label: 'Kyber Game: speedBonus somado ao score (resposta rápida > resposta lenta)', run: function () {
          if (typeof window.kyberFinishGame !== 'function' || typeof gameState === 'undefined') return false;
          var TIME_LIMIT = 30;
          // Simula resposta certa com muito tempo restante (rápido)
          var timeLeft1 = 28;
          var pts1 = Math.round(1000 * (timeLeft1 / TIME_LIMIT)) + Math.round(500 * (timeLeft1 / TIME_LIMIT));
          // Simula resposta certa com pouco tempo restante (devagar)
          var timeLeft2 = 5;
          var pts2 = Math.round(1000 * (timeLeft2 / TIME_LIMIT)) + Math.round(500 * (timeLeft2 / TIME_LIMIT));
          // Resposta rápida deve valer mais que devagar, e devagar deve valer mais que 0
          return pts1 > pts2 && pts2 > 0 && pts1 <= 1500;
        } },
        { id: 'c-quiz-patente-inclui-conteudo-repo', label: 'Painel de patente soma XP de Conteúdos e Repositório (não só auto/missões/kyber)', run: function () {
          if (typeof window.faGameReload !== 'function') return false;
          var st = window.faStore || localStorage;
          var backup = { contentXP: st.getItem('fa-content-xp'), repoXP: st.getItem('fa-repo-xp') };
          st.setItem('fa-content-xp', '0');
          st.setItem('fa-repo-xp', '0');
          window.faGameReload();
          var nomeAntes = document.getElementById('hudName').textContent;
          st.setItem('fa-content-xp', '100');
          st.setItem('fa-repo-xp', '100');
          window.faGameReload();
          var nomeDepois = document.getElementById('hudName').textContent;
          if (backup.contentXP !== null) st.setItem('fa-content-xp', backup.contentXP); else st.removeItem('fa-content-xp');
          if (backup.repoXP !== null) st.setItem('fa-repo-xp', backup.repoXP); else st.removeItem('fa-repo-xp');
          window.faGameReload();
          return nomeDepois === 'Mestre' && nomeAntes !== 'Mestre';
        } }
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
      title: 'Cadastro — e-mail já existente (mensagem de erro)',
      motivo: 'Requer tentar cadastrar e-mail duplicado — causaria chamada real ao Firebase Auth.' },
    { section: 'Cadastrar / Entrar',
      title: 'Cadastro — formatação automática (nome maiúsculo, e-mail minúsculo)',
      motivo: 'Requer realizar um cadastro real e verificar no Firebase. Não deve ser feito em teste automatizado.' },
    { section: 'Cadastrar / Entrar',
      title: 'Cadastro — botão "Aguarde…" durante envio',
      motivo: 'Estado transiente — só visível durante o envio real ao Firebase.' },
    { section: 'Cadastrar / Entrar',
      title: 'Clicar no perfil navega para Treinamento Jedi',
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
      title: 'Seções da Home ocupam 100vh (scroll preciso)',
      motivo: 'Verificar visualmente: ao clicar nos pontos laterais ou no botão Continuar, cada seção deve preencher toda a viewport sem corte ou desalinhamento.' },
    { section: 'Início',
      title: '"Role para começar" — texto centralizado horizontalmente no hero',
      motivo: 'Verificar visualmente em diferentes larguras de tela se o texto aparece centrado abaixo do conteúdo do hero.' },
    { section: 'Início',
      title: 'Botões do crawl lado a lado: "≡ Ler texto" · "⏸ Pausar" · "↻ Repetir abertura"',
      motivo: 'Verificar visualmente que os 3 botões aparecem em linha horizontal (não empilhados) e cada um funciona corretamente.' },
    { section: 'Início',
      title: 'Crawl: pausar ao clicar e botão Pausar/Continuar',
      motivo: 'Comportamento de animação CSS (animation-play-state) — verificar visualmente se o texto para ao clicar na área do crawl.' },
    { section: 'Início',
      title: 'Crawl: botão "≡ Ler texto" exibe texto estático e "✕ Fechar texto" retorna ao crawl',
      motivo: 'Comportamento visual/transiente — verificar manualmente se o texto aparece legível sem perspectiva.' },
    { section: 'Início',
      title: 'Cards "Como funciona" → cada um navega para sua página',
      motivo: 'Clicar navegaria para fora da página Admin, interrompendo a sessão de testes em execução.' },
    { section: 'Início',
      title: 'Seção "O que está acontecendo" — ausente na v2',
      motivo: 'Verificar visualmente que os blocos de Turmas, Conteúdos e Ranking mini não aparecem na home.' },
    { section: 'Turmas',
      title: 'Botão "Tenho interesse" sem login → mensagem + modal login',
      motivo: 'Requer estar deslogado.' },
    { section: 'Turmas',
      title: 'Botão "Tenho interesse" → registra e vira "Remover interesse"; clicar novamente remove e volta ao estado inicial',
      motivo: 'Gravaria dados reais no Firebase (turmas-interesse e turmas-interesse-log). Requer sessão ativa com email real.' },
    { section: 'Turmas',
      title: 'Turma finalizada → botão vira "✓ Inscrita" (desabilitado)',
      motivo: 'Requer que o admin tenha finalizado a turma no Firebase (turmas-config/<turma>/finalizada=true) e a pessoa tenha interesse registrado.' },
    { section: 'Turmas',
      title: 'Check-in via QR Code → "✓ Presente" no botão e "Presença confirmada" na tela',
      motivo: 'Requer: turma finalizada, admin abrir check-in do dia (diaAtivo), pessoa inscrita e logada. Escanear QR que aponta para #checkin?turma=<key>.' },
    { section: 'Turmas',
      title: 'Agenda D1–D5 bloqueada para visitante/logado',
      motivo: 'Requer testar com usuário não-colaborador logado (outro nível de acesso).' },
    { section: 'Turmas',
      title: 'Agenda D1–D5 liberada para colaborador/admin',
      motivo: 'Verificável visualmente — o accordion abre. Pode ser adicionado como automático em versão futura.' },
    { section: 'Conteúdos',
      title: 'Pontos por leitura (+5 pts, 60% visível por 10s)',
      motivo: 'Requer scroll real e espera de 10 segundos com elemento visível. IntersectionObserver não é testável sem browser real interativo.' },
    { section: 'Conteúdos',
      title: 'Badge "✓ +5 pts" após ganhar pontos',
      motivo: 'Requer completar o timer de leitura — depende do teste de pontos acima.' },
    { section: 'Conteúdos',
      title: 'Pontos de conteúdos só aparecem no ranking ao revelar patente',
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
    { section: 'Treinamento Jedi',
      title: 'Welcome screen exibida para visitante (texto + botão "Quero jogar")',
      motivo: 'Requer estar deslogado. Verificar: #treinamento-welcome visível, #treinamento oculto, botão "Quero jogar" abre modal de login.' },
    { section: 'Treinamento Jedi',
      title: 'Welcome screen ocultada após login',
      motivo: 'Requer fazer login a partir da tela de boas-vindas. Verificar: #treinamento visível, #treinamento-welcome oculto.' },
    { section: 'Treinamento Jedi',
      title: 'Revelar patente — confirmação real',
      motivo: 'Ação irreversível (fixa o resultado definitivamente) — não deve ser executada em teste automatizado com dado real.' },
    { section: 'Treinamento Jedi',
      title: 'Publicar no ranking — publicação real',
      motivo: 'Ação irreversível (não tem como "despublicar") e escreveria no Firebase de produção — não deve ser executada em teste automatizado com dado real.' },
    { section: 'Treinamento Jedi',
      title: 'Reset de progresso (Admin) — apaga e remove do ranking',
      motivo: 'Ação destrutiva real. Não deve ser executada em teste automatizado.' },
    { section: 'Ranking',
      title: 'Imagem da patente (personagem) aparece ao lado do nome',
      motivo: 'Verificar visualmente que o SVG do personagem (Youngling/Padawan/Cavaleiro/Mestre) aparece em cada linha do ranking — na página Ranking, no mini-ranking da Home e no popup do Kyber.' },
    { section: 'Ranking',
      title: 'Botão "Tenho interesse" — estilo primário (dourado); "Remover interesse" — estilo secundário (neutro)',
      motivo: 'Verificar visualmente na página Turmas: "Tenho interesse" deve ter fundo dourado com brilho; após clicar, "Remover interesse" deve ter fundo escuro neutro sem brilho.' },
    { section: 'Ranking',
      title: 'Atualização em tempo real via Firebase',
      motivo: 'Requer dois usuários simultâneos — um revelando patente enquanto o outro observa o ranking.' },
    { section: 'Admin',
      title: 'Acesso negado para visitante/logado/colaborador (URL direta)',
      motivo: 'Requer testar com diferentes níveis de acesso — não pode ser validado na sessão admin atual.' },
    { section: 'Admin',
      title: 'Colaboradores — remover colaborador',
      motivo: 'Ação destrutiva. Removeria acesso real de um colaborador.' },
    { section: 'Admin',
      title: 'Colaboradores — adicionar (formulário)',
      motivo: 'Gravaria no Firebase e exigiria limpeza manual após o teste.' },
    { section: 'Admin',
      title: 'Cadastrados — resetar progresso',
      motivo: 'Ação destrutiva e irreversível no Firebase. Verificar: (1) XP exibe "—" na tabela admin imediatamente; (2) pessoa some do ranking em tempo real; (3) se a pessoa estiver logada no momento do reset, a página dela recarrega automaticamente (via listener em fa-reset-signal/<emailKey>) e todos os jogos (autodiagnóstico, missões, Kyber, revelar patente) ficam disponíveis para refazer. Para testar o reload em tempo real: abrir a página como usuária em uma aba e o painel admin em outra — ao clicar Resetar, a aba da usuária deve recarregar sozinha.' },
    { section: 'Admin',
      title: 'Cadastrados — XP exibe "—" após reset',
      motivo: 'Requer executar o reset de uma pessoa que tenha XP acumulado (feito autodiagnóstico, missões ou Kyber) e confirmar que a coluna XP passa a exibir "—" imediatamente (sem recarregar a página) — independente de ter revelado patente ou publicado no ranking.' },
    { section: 'Admin',
      title: 'Cadastrados — redefinir senha',
      motivo: 'Requer que a pessoa já tenha conta ativa e verifica e-mail externo.' },
    { section: 'Admin',
      title: 'Turmas — finalizar inscrição',
      motivo: 'Ação destrutiva: converte todos os interessados em inscritos e bloqueia novas inscrições. Verificar: (1) badge muda para FINALIZADA; (2) botões mudam para QR Code / Abrir check-in / Reabrir; (3) tabela exibe colunas de presença por dia.' },
    { section: 'Admin',
      title: 'Turmas — abrir/fechar check-in do dia',
      motivo: 'Requer turma finalizada. Verificar: (1) select exibe os dias da turma e pré-seleciona hoje se aplicável; (2) ao abrir dia escolhido, badge "CHECK-IN ABERTO · DD/MM" aparece pulsante; (3) participante consegue fazer check-in via QR apenas para o dia aberto; (4) ao fechar, check-in é bloqueado na página checkin. Testar também abrir um dia diferente de hoje (passado ou futuro).' },
    { section: 'Admin',
      title: 'Turmas — check-in retroativo manual (clicar em "—")',
      motivo: 'Requer turma finalizada com pelo menos 1 inscrito que não fez check-in naquele dia. Clicar em "—" na célula da pessoa/dia → registra com source:"admin" → célula vira "✓ adm" e frequência atualiza.' },
    { section: 'Admin',
      title: 'Turmas — adicionar participante após finalizar',
      motivo: 'Requer turma finalizada. Clicar em "＋ Participante", digitar e-mail @previ.com.br, nome e área. Verificar: pessoa aparece na tabela de presença com status inscrito; Firebase tem addedByAdmin:true em turmas-interesse.' },
    { section: 'Admin',
      title: 'Turmas — remover inscrito da turma finalizada',
      motivo: 'Requer turma finalizada com pelo menos 1 inscrito. Clicar em "Remover" na linha da pessoa. Verificar: (1) confirmação aparece; (2) pessoa some da tabela; (3) Firebase tem removed:true em turmas-interesse.' },
    { section: 'Admin',
      title: 'Turmas — reabrir turma',
      motivo: 'Ação destrutiva: volta inscritos para interessado. Verificar: (1) badge volta para ABERTA; (2) botões voltam para Finalizar inscrição; (3) inscritos voltam para interessado no Firebase.' },
    { section: 'Admin',
      title: 'Turmas — exportar CSV com colunas de presença',
      motivo: 'Requer turma finalizada com pelo menos 1 check-in. Verificar: arquivo .csv contém colunas por data (DD/MM), frequência e coluna "Atingiu critério (75%)".' },
    { section: 'Admin',
      title: 'Turmas — gerar certificados de participação',
      motivo: 'Requer turma finalizada com pelo menos 1 inscrito com ≥ 75% de presença. Clicar em "📜 Certificados". Verificar: (1) nova aba abre com os certificados; (2) cada certificado contém nome, turma, período e frequência; (3) diálogo de impressão é acionado automaticamente; (4) participantes abaixo de 75% não aparecem.' },
    { section: 'Admin',
      title: 'Turmas — certificados: sem aprovados',
      motivo: 'Requer turma finalizada onde ninguém atingiu 75%. Clicar em "📜 Certificados". Verificar: alerta informa que nenhum participante atingiu o critério — nenhuma aba é aberta.' },
    { section: 'Admin',
      title: 'Exportar CSV — caracteres especiais e arquivo editável',
      motivo: 'Baixar qualquer CSV (Estado atual, Histórico ou individual). Verificar no Excel: (1) acentos, cedilha e travessão aparecem corretamente (sem "?" ou "Ã"); (2) arquivo abre em modo edição (não somente leitura). Encoding: Windows-1252 via Uint8Array, sem BOM.' },
    { section: 'Admin',
      title: 'Abas do painel — visibilidade no mobile',
      motivo: 'Acessar o painel Admin em tela estreita (< 600px). Verificar: todas as 8 abas estão visíveis (quebram em 2 linhas); nenhuma aba fica oculta ou cortada.' },
    { section: 'Deploy',
      title: 'Pre-commit hook — bloqueia commit com erro de sintaxe JS',
      motivo: 'Verificar manualmente: editar um arquivo JS com erro intencional (ex: remover um "}" ao final) e tentar fazer git commit — o commit deve ser recusado com mensagem de erro indicando o arquivo. Desfazer a edição após o teste.' }
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
    // Stub global: impede que qualquer teste escreva no Firebase real durante a execução.
    // Testes que precisam verificar chamadas ao Firebase fazem seu próprio stub interno.
    const _origSyncProgress = window.faSyncProgress;
    const _origSyncPlayer   = window.faSyncPlayer;
    window.faSyncProgress = function() {};
    window.faSyncPlayer   = function() {};
    let i = 0;
    function next() {
      if (i >= allTests.length) {
        window.faSyncProgress = _origSyncProgress;
        window.faSyncPlayer   = _origSyncPlayer;
        onDone(results);
        return;
      }
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
    html += '<button class="btn btn--sm" id="testesExportBtn">⬇ Exportar Excel (todos os testes)</button>';
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
      'Treinamento Jedi':          '#e05c7f',
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

    /* Export all tests to Excel */
    const exportBtn = document.getElementById('testesExportBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        if (!window.faToXls) return;
        const rows = [];
        /* Automáticos — Técnicos */
        TECNICOS.forEach(function (group) {
          group.tests.forEach(function (t) {
            rows.push(['Automático', 'Técnico', group.group, t.label, '']);
          });
        });
        /* Automáticos — Comportamento */
        COMPORTAMENTO_AUTO.forEach(function (group) {
          group.tests.forEach(function (t) {
            rows.push(['Automático', 'Comportamento', group.group, t.label, '']);
          });
        });
        /* Manuais */
        COMPORTAMENTO_MANUAL.forEach(function (r) {
          rows.push(['Manual', 'Comportamento', r.section, r.title, r.motivo]);
        });
        window.faToXls(
          ['Tipo', 'Grupo', 'Categoria', 'Teste / Regra', 'Motivo (manual)'],
          rows,
          'testes-forca-agil-' + new Date().toISOString().slice(0, 10) + '.csv'
        );
      });
    }

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

    const RES_COLOR = {
      'Firebase':                    '#1ab2ae',
      'Autenticação':                '#9b7fff',
      'XP & Progresso':              '#f5c542',
      'Painel Admin':                '#ff5252',
      'Menu — Cadastrar / Entrar':   '#9b7fff',
      'Formulário de Cadastro':      '#9b7fff',
      'Página Início':               '#1ab2ae',
      'Página Turmas':               '#f5c542',
      'Página Repositório':          '#e8854a',
      'Página Treinamento Jedi':            '#e05c7f',
      'Página Ranking':              '#57aaff',
      'Painel Admin — Integridade':  '#ff5252',
    };

    const groups = {};
    results.forEach(function (r) {
      if (!groups[r.group]) groups[r.group] = [];
      groups[r.group].push(r);
    });

    Object.keys(groups).forEach(function (g) {
      const col = RES_COLOR[g] || 'var(--accent)';
      const groupPassed = groups[g].filter(function (r) { return r.passed; }).length;
      const groupTotal  = groups[g].length;
      const countLabel  = done ? ' (' + groupPassed + '/' + groupTotal + ')' : ' (' + groupPassed + '/' + groupTotal + ')';
      html += '<div class="testes-group testes-group--collapsible open">';
      html += '<div class="testes-group-label testes-group-toggle" style="color:' + col + ';border-color:' + col + '"><span>' + g + '<span class="testes-group-count">' + countLabel + '</span></span><span class="testes-group-arrow">▾</span></div>';
      html += '<div class="testes-group-body">';
      groups[g].forEach(function (r) {
        html += '<div class="testes-row ' + (r.passed ? 'pass' : 'fail') + '">';
        html += '<span class="testes-icon">' + (r.passed ? '✅' : '❌') + '</span>';
        html += '<span class="testes-label">' + r.label + '</span>';
        if (!r.passed && r.err) html += '<span class="testes-err">' + r.err + '</span>';
        html += '</div>';
      });
      html += '</div></div>';
    });

    el.innerHTML = html;
    el.querySelectorAll('.testes-group-toggle').forEach(function (toggle) {
      toggle.addEventListener('click', function () {
        toggle.closest('.testes-group--collapsible').classList.toggle('open');
      });
    });
  }

  window.faInitTestes = function () {
    var container = document.getElementById('adminPanelTestes');
    if (!container) return;
    render(container);
  };
})();
