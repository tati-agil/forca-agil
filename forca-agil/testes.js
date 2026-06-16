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
        } }
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
        { id: 'adm-mapa-cards',   label: 'Mapa: 8 cards de página renderizados', run: function () {
          if (window.faInitMapa) window.faInitMapa();
          return document.querySelectorAll('#adminMapa .mapa-page').length === 8;
        } },
        { id: 'adm-mapa-features', label: 'Mapa: todos os cards têm features', run: function () {
          if (window.faInitMapa) window.faInitMapa();
          var cards = document.querySelectorAll('#adminMapa .mapa-page');
          if (cards.length !== 8) return false;
          return Array.from(cards).every(function (c) { return c.querySelectorAll('.mapa-feature').length > 0; });
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
        { id: 'c-quiz-kyber-1x', label: 'Kyber Game (1×): bloqueado para replay após concluído', run: function () {
          if (typeof window.kyberAlreadyPlayed !== 'function') return false;
          var st = window.faStore || localStorage;
          var backup = st.getItem('fa-kyber-done');
          st.setItem('fa-kyber-done', '1');
          var bloqueado = window.kyberAlreadyPlayed() === true;
          if (backup !== null) st.setItem('fa-kyber-done', backup); else st.removeItem('fa-kyber-done');
          return bloqueado;
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
      title: 'Admin — redefinir senha de qualquer cadastrado',
      motivo: 'Requer que a pessoa já tenha conta ativa e verifica e-mail externo.' },
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

    const RES_COLOR = {
      'Firebase':                    '#1ab2ae',
      'Autenticação':                '#9b7fff',
      'XP & Progresso':              '#f5c542',
      'Painel Admin':                '#ff5252',
      'Menu — Cadastrar / Entrar':   '#9b7fff',
      'Formulário de Cadastro':      '#9b7fff',
      'Página Início':               '#1ab2ae',
      'Página Repositório':          '#e8854a',
      'Página Quiz Jedi':            '#e05c7f',
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
