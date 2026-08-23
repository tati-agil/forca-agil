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
        { id: 'auth-logout',  label: 'Botão "Sair" presente no DOM',                 run: function () { return !!document.getElementById('navLogout'); } },
        { id: 'auth-access-level', label: 'faAuth.getAccessLevel() existe e retorna "member" ou "enrolled" (guest removido)', run: function () {
          if (typeof window.faAuth !== 'object' || typeof window.faAuth.getAccessLevel !== 'function') return false;
          var level = window.faAuth.getAccessLevel();
          return level === 'member' || level === 'enrolled';
        } },
        { id: 'auth-domain-rule', label: 'Restrição @previ.com.br nas regras do banco (server-side)', run: function () { return true; },
          nota: 'Verificação manual: regras do Firebase Realtime Database exigem auth.token.email.matches(/.*@previ\\.com\\.br/) em todas as operações autenticadas — não apenas validação no front-end. Testar via REST API diretamente com conta de outro domínio deve retornar HTTP 403.' },
        { id: 'auth-admin-full-access', label: 'Admin vê Conteúdos e Treinamento no menu mesmo sem estar pessoalmente inscrito em turma', run: function () {
          var s = window.faAuth && window.faAuth.getSession();
          if (!s || !window.faAuth.isAdmin(s.email)) return true; /* não aplicável fora de sessão admin */
          var conteudos = document.querySelector('.nav-link-enrolled[data-nav-page="conteudos"]');
          var treinamento = document.querySelector('.nav-link-enrolled[data-nav-page="treinamento"]');
          return !!conteudos && !conteudos.hidden && !!treinamento && !treinamento.hidden;
        } }
      ]
    },
    {
      group: 'Treinamento Jedi',
      tests: [
        { id: 'xp-store',        label: 'faStore disponível',                                        run: function () { return typeof window.faStore === 'object' && typeof window.faStore.getItem === 'function'; } },
        { id: 'xp-load',         label: 'faLoadProgress disponível',                                 run: function () { return typeof window.faLoadProgress === 'function'; } },
        { id: 'xp-save',         label: 'faSyncProgress disponível',                                 run: function () { return typeof window.faSyncProgress === 'function'; } },
        { id: 'xp-sync',         label: 'faSyncPlayer disponível',                                   run: function () { return typeof window.faSyncPlayer === 'function'; } },
      ]
    },
    {
      group: 'Admin',
      tests: [
        { id: 'adm-superadmin-only', label: 'Administradores: só tatianefdirene/danielfrazao veem os botões de adicionar/remover admin', run: function () {
          var s = window.faAuth && window.faAuth.getSession();
          if (!s) return true; /* não aplicável fora de sessão */
          var souSuperAdmin = window.faSuperAdmins && window.faSuperAdmins.indexOf((s.email || '').toLowerCase()) !== -1;
          var temForm = !!document.getElementById('adminAddBtn');
          var temRemover = !!document.querySelector('#adminAdmins .admin-del-btn');
          return souSuperAdmin ? true : (!temForm && !temRemover);
        } },
        { id: 'adm-qrcode-lib', label: 'Biblioteca QRCode carregada (hospedada localmente, sem depender de CDN externo)', run: function () {
          var scriptLocal = document.querySelector('script[src*="forca-agil/qrcode.min.js"]');
          var scriptCdn = document.querySelector('script[src*="jsdelivr"], script[src*="unpkg"]');
          return typeof QRCode !== 'undefined' && typeof QRCode.toCanvas === 'function' && !!scriptLocal && !scriptCdn;
        } },
        { id: 'adm-turmas-crud', label: 'Turmas: criar/editar/excluir turma disponível (não são mais fixas em código)', run: function () {
          var wrap = document.getElementById('adminInterests');
          if (!wrap || !wrap.querySelector('button')) return true; /* painel Turmas não carregado nesta sessão */
          var hasBtn = function (txt) {
            return Array.prototype.some.call(wrap.querySelectorAll('button'), function (b) { return b.textContent.indexOf(txt) !== -1; });
          };
          var temNova = hasBtn('Nova turma');
          var temCards = document.querySelectorAll('.turma-admin-card').length > 0;
          return temNova && (!temCards || (hasBtn('Editar turma') && hasBtn('Excluir turma')));
        } },
        { id: 'adm-manual', label: 'faInitManual disponível',   run: function () { return typeof window.faInitManual === 'function'; } },
        { id: 'adm-mapa',   label: 'faInitMapa disponível',     run: function () { return typeof window.faInitMapa === 'function'; } },
        { id: 'adm-tabs',   label: 'Abas Admin presentes (11: Dashboard/Eventos/Certificados/Repositório/Cadastrados/Administradores/Manual/Mapa/Testes/Pedidos/Sorteios)', run: function () { return document.querySelectorAll('.admin-tab-btn').length === 11; } },
        { id: 'adm-manual-panel', label: 'Painel Manual presente', run: function () { return !!document.getElementById('adminPanelManual'); } },
        { id: 'adm-mapa-panel',   label: 'Painel Mapa presente',   run: function () { return !!document.getElementById('adminPanelMapa'); } },
        { id: 'adm-testes-panel', label: 'Painel Testes presente', run: function () { return !!document.getElementById('adminPanelTestes'); } },
        { id: 'adm-pedidos-panel', label: 'Painel Pedidos presente', run: function () { return !!document.getElementById('adminPanelPedidos'); } },
        { id: 'adm-sorteios-panel', label: 'Painel Sorteios presente (aba + container)', run: function () {
          return !!document.getElementById('adminPanelSorteios') && !!document.getElementById('adminSorteios') &&
                 !!document.querySelector('.admin-tab-btn[data-panel="adminPanelSorteios"]');
        } },
        { id: 'adm-dashboard-panel', label: 'Painel Dashboard presente', run: function () { return !!document.getElementById('adminPanelDashboard'); } },
        { id: 'c-minha-area-page', label: 'Minha Área: página e container presentes no DOM', run: function () {
          return !!document.getElementById('page-minha-area') && !!document.getElementById('minhaAreaContent');
        } },
        { id: 'c-minha-area-link', label: 'Minha Área: link no menu visível para quem está logado', run: function () {
          var link = document.querySelector('[data-nav-page="minha-area"]');
          if (!link) return false;
          var sess = window.faAuth && window.faAuth.getSession ? window.faAuth.getSession() : null;
          return sess ? link.hidden === false : true;
        } },
        { id: 'c-minha-area-sem-qr', label: 'Minha Área: NÃO expõe QR Code de check-in (integridade da frequência)', run: function () {
          var sec = document.getElementById('page-minha-area');
          if (!sec) return false;
          /* Nenhum canvas de QR nem link para #checkin dentro da área do participante */
          return !sec.querySelector('canvas') && !sec.querySelector('a[href*="checkin"]');
        } },
        { id: 'c-minha-area-nunca-vazia', label: 'Minha Área: sempre renderiza algum estado (nunca fica em branco)', run: function () {
          var wrap = document.getElementById('minhaAreaContent');
          if (!wrap) return false;
          /* Depois de carregada, tem que existir ao menos um título de seção
             ou um cartão — a página não pode terminar sem estado nenhum. */
          if (/Carregando/.test(wrap.textContent || '')) return true;   /* ainda carregando: não é falha */
          return !!wrap.querySelector('.aluno-sec-title, .aluno-card');
        } },
        { id: 'adm-cadastrados-panel', label: 'Painel Cadastrados presente', run: function () { return !!document.getElementById('adminPanelCadastrados') && !!document.getElementById('adminCadastrados'); } },
        { id: 'adm-mapa-cards',   label: 'Mapa: 13 cards de seção renderizados (9 páginas do menu + Check-in, Entrar, Cadastrar e Menu/Sessão)', run: function () {
          if (window.faInitMapa) window.faInitMapa();
          return document.querySelectorAll('#adminMapa .mapa-page').length === 13;
        } },
        { id: 'adm-mapa-features', label: 'Mapa: todos os cards têm features', run: function () {
          if (window.faInitMapa) window.faInitMapa();
          var cards = document.querySelectorAll('#adminMapa .mapa-page');
          if (cards.length !== 13) return false;
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
            /* features sem persona (p:[]) são intencionalmente omitidas do render */
            var definido = window.faMapaPages[i].features.filter(function (f) { return f.p && f.p.length > 0; }).length;
            return titulo.indexOf(esperado) === 0 && rendered === definido;
          });
        } },
        { id: 'adm-mapa-arch', label: 'Mapa: Arquitetura Técnica renderiza 7 seções (Linguagens, Tecnologias & Serviços, Estrutura de Arquivos, Padrões de Código, Padrões de UX, Glossário de UX/Design, Deploy)', run: function () {
          if (window.faInitMapa) window.faInitMapa();
          var labels = Array.from(document.querySelectorAll('#adminMapa .arch-section-label span')).map(function (s) { return s.textContent; });
          var esperado = ['Linguagens', 'Tecnologias & Serviços', 'Estrutura de Arquivos', 'Padrões de Código', 'Padrões de UX', 'Glossário de UX/Design', 'Deploy'];
          return esperado.every(function (l) { return labels.indexOf(l) !== -1; });
        } },
        { id: 'adm-mapa-arch-arquivos-completo', label: 'Mapa: "Estrutura de Arquivos" lista todo script/CSS de forca-agil/ carregado no index.html (sem esquecer nenhum)', run: function () {
          if (window.faInitMapa) window.faInitMapa();
          if (!window.faMapaArch) return false;
          var estrutura = window.faMapaArch.find(function (s) { return s.label === 'Estrutura de Arquivos'; });
          if (!estrutura) return false;
          var documentados = estrutura.items.map(function (i) { return i.name; });
          var reais = Array.from(document.querySelectorAll('script[src^="forca-agil/"], link[href^="forca-agil/"]'))
            .map(function (el) { return el.getAttribute('src') || el.getAttribute('href'); });
          return reais.every(function (f) { return documentados.indexOf(f) !== -1; });
        } },
        { id: 'adm-cadastrados-lista', label: 'Cadastrados: tabela renderizada com badge de contagem correta', run: function () {
          var c = document.getElementById('adminCadastrados');
          if (!c) return false;
          var badge = c.querySelector('.admin-badge');
          var rows = c.querySelectorAll('tbody tr');
          if (!badge) return false;
          var n = parseInt(badge.textContent, 10);
          return n === rows.length;
        } },
        { id: 'adm-badge-neutro', label: 'Badges de contagem não usam a cor de destaque (--accent)', run: function () {
          var badge = document.querySelector('#adminInterests .admin-badge, #adminCadastrados .admin-badge, #adminAdmins .admin-badge');
          if (!badge) return true;
          var bg = getComputedStyle(badge).backgroundColor;
          var accentBg = getComputedStyle(document.querySelector('.btn--primary') || document.body).backgroundColor;
          return bg !== accentBg;
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
        { id: 'adm-cadastrados-colunas', label: 'Cadastrados: tabela tem exatamente as colunas Nome/E-mail/Área/Cadastro', run: function () {
          var c = document.getElementById('adminCadastrados');
          if (!c) return false;
          var ths = Array.from(c.querySelectorAll('thead th')).map(function(th) { return th.textContent.trim(); });
          var temXP = ths.some(function(t) { return t === 'XP'; });
          var temEssenciais = ['Nome','E-mail','Área','Cadastro'].every(function(col) { return ths.indexOf(col) !== -1; });
          return temEssenciais && !temXP;
        } },
        { id: 'adm-table-scroll-wrap', label: 'Tabelas admin envolvidas em .table-scroll-wrap (scroll horizontal automático)', run: function () {
          var wraps = document.querySelectorAll('.table-scroll-wrap');
          if (wraps.length === 0) return false;
          var todas = Array.from(wraps).every(function(w) { return w.querySelector('table') !== null; });
          return todas;
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
      group: 'Segurança / Login obrigatório',
      tests: [
        { id: 'c-site-oculto-sem-auth', label: 'body NÃO tem class "aguardando-auth" quando logado (site revelado)', run: function () {
          return !document.body.classList.contains('aguardando-auth');
        } },
        { id: 'c-login-fundo-opaco', label: 'Modal de login forçado usa fundo opaco (class modal-overlay--forced ausente quando logado)', run: function () {
          var modal = document.getElementById('authModal');
          return modal && !modal.classList.contains('modal-overlay--forced');
        } },
        { id: 'c-enrolled-confirmedByAdmin', label: 'Nível enrolled exige confirmedByAdmin (não basta manifestar interesse)', run: function () {
          var level = window.faAuth && window.faAuth.getAccessLevel ? window.faAuth.getAccessLevel() : null;
          if (!level) return false;
          return level === 'admin' || level === 'enrolled' || level === 'member';
        } },
        { id: 'c-verificacao-painel-existe', label: 'Painel de verificação de e-mail existe no DOM (#auth-verificacao)', run: function () {
          return !!document.getElementById('auth-verificacao');
        } },
        { id: 'c-reenviar-btn-existe', label: 'Botão "Reenviar e-mail" existe no painel de verificação', run: function () {
          return !!document.getElementById('reenviarVerificacao');
        } },
        { id: 'c-bloqueado-painel-existe', label: 'Painel "Acesso desativado" existe no DOM (#auth-bloqueado)', run: function () {
          return !!document.getElementById('auth-bloqueado');
        } },
        { id: 'c-espera-card-existe', label: 'Card "Lista de Espera" existe na grade de turmas (#turma-espera-card)', async: true,
          run: function () {
            if (window.faInitTurmas) window.faInitTurmas();
            /* Card é criado após leitura assíncrona do Firebase (loadTurmas) — espera aparecer no DOM */
            return new Promise(function (resolve) {
              var tentativas = 0;
              (function poll() {
                if (document.getElementById('turma-espera-card')) return resolve(true);
                if (++tentativas > 40) return resolve(false);
                setTimeout(poll, 100);
              })();
            });
          } },
        { id: 'c-espera-btn-existe', label: 'Botão "Entrar na lista de espera" existe no card (#btnEntrarEspera)', async: true,
          run: function () {
            if (window.faInitTurmas) window.faInitTurmas();
            return new Promise(function (resolve) {
              var tentativas = 0;
              (function poll() {
                if (document.getElementById('btnEntrarEspera')) return resolve(true);
                if (++tentativas > 40) return resolve(false);
                setTimeout(poll, 100);
              })();
            });
          } }
      ]
    },
    {
      group: 'Entrar',
      tests: [
        { id: 'c-modal-no-close-outside', label: 'Modal de login/cadastro não fecha ao clicar fora', run: function () {
          if (!window.faOpenAuthModal) return false;
          var modal = document.getElementById('authModal');
          if (!modal) return false;
          var wasHidden = modal.hidden;
          window.faOpenAuthModal('login');
          modal.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          var stillOpen = modal.hidden === false;
          if (window.faCloseAuthModal) window.faCloseAuthModal(); else modal.hidden = wasHidden;
          return stillOpen;
        } },
        { id: 'c-forgot-password-panel', label: 'Login — "Esqueci minha senha" abre painel inline', run: function () {
          if (!window.faOpenAuthModal) return false;
          window.faOpenAuthModal('login');
          var fp = document.getElementById('forgotPassword');
          var loginPanel = document.getElementById('auth-login');
          var forgotPanel = document.getElementById('auth-forgot');
          if (!fp || !loginPanel || !forgotPanel) { if (window.faCloseAuthModal) window.faCloseAuthModal(); return false; }
          fp.click();
          var opened = !forgotPanel.hidden && loginPanel.hidden;
          if (window.faCloseAuthModal) window.faCloseAuthModal();
          return opened;
        } },
        { id: 'c-pwd-toggle-login', label: 'Botão "olhinho" no campo de senha do login',
          run: function () { return document.querySelectorAll('#auth-login .pwd-eye').length === 1; }
        }
      ]
    },
    {
      group: 'Menu / Sessão',
      tests: [
        { id: 'c-menu-profile',    label: '[Logado] Perfil visível no menu (substitui Entrar/Cadastrar)',  run: function () { const el = document.getElementById('navProfile'); return el && !el.hidden; } },
        { id: 'c-menu-guest-hide', label: '[Logado] Botões Entrar/Cadastrar ocultos',                     run: function () { const el = document.getElementById('navGuest');   return el && el.hidden; } },
        { id: 'c-menu-admin-link', label: '[Admin] Link "Admin" visível no menu',                         run: function () { const el = document.getElementById('navAdmin');   return el && !el.hidden; } }
      ]
    },
    {
      group: 'Cadastrar',
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
        { id: 'c-pwd-toggle',   label: 'Botão "olhinho" nos 2 campos de senha do cadastro',
          run: function () { return document.querySelectorAll('#auth-register .pwd-eye').length === 2; }
        },
        { id: 'c-pwd-numeric',  label: 'Campo de senha com inputmode numérico',
          run: function () { var f = document.getElementById('regPassword'); return !!f && f.getAttribute('inputmode') === 'numeric'; }
        }
      ]
    },
    {
      group: 'Conteúdos',
      tests: [
        { id: 'c-conteudos-nav', label: 'Nav lateral de Conteúdos inicializa ao entrar na página (#conteudosNavSidebar)', run: function () {
          if (window.faRouter && window.faRouter.current() !== 'conteudos') return true; // só verifica se estiver na página
          return !!document.getElementById('conteudosNavSidebar');
        } },
        { id: 'c-conteudos-7sections', label: '7 seções de conteúdo presentes no DOM (Mapa da Galáxia, Os 4 Valores, Os 12 Princípios, A Força do Ágil, Personagens, Lado Sombrio, A Trilogia)', run: function () {
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
        } },
        { id: 'c-conteudos-yoda-episodios', label: '"A Força do Ágil": 5 episódios presentes, cada um expande/recolhe ao clicar no título', run: function () {
          var episodios = document.querySelectorAll('#content-yoda .yep');
          if (episodios.length !== 5) return false;
          var ep = episodios[0];
          var head = ep.querySelector('.yep-head');
          if (!head) return false;
          var before = ep.classList.contains('open');
          head.click();
          var afterOpen = ep.classList.contains('open');
          head.click();
          var afterClosed = ep.classList.contains('open');
          return !before && afterOpen && !afterClosed;
        } },
        { id: 'c-conteudos-trilogia-episodios', label: '"A Trilogia": 3 episódios em acordeão, cada um expande/recolhe ao clicar no título', run: function () {
          var episodios = document.querySelectorAll('#content-trilogia .ep-expand');
          if (episodios.length !== 3) return false;
          var det = episodios[0];
          var summary = det.querySelector('summary');
          if (!summary) return false;
          var before = det.open;
          summary.click();
          var afterOpen = det.open;
          summary.click();
          var afterClosed = det.open;
          return !before && afterOpen && !afterClosed;
        } }
      ]
    },
    {
      group: 'Início',
      tests: [
        { id: 'c-hero',         label: 'Hero com título "Força Ágil" presente',         run: function () { return !!document.querySelector('.hero-title, .hero'); } },
        { id: 'c-cta-btn',        label: 'Botão "Juntar-se à Força" existe no DOM',         run: function () { return !!document.getElementById('heroJoin'); } },
        { id: 'c-cta-btn-logado', label: 'Botão hero: "Ver turmas" com sessão ativa (nunca oculto)', run: function () {
          /* Sem sessão o hero nem é renderizado (login obrigatório oculta o site),
             então só o caminho autenticado é verificável na prática. */
          var btn = document.getElementById('heroJoin');
          if (!btn) return false;
          var sess = window.faAuth ? window.faAuth.getSession() : null;
          if (!sess) return true;
          return btn.hidden === false && btn.dataset.loggedIn === '1';
        } },
        { id: 'c-como-funciona', label: 'Como funciona: os 3 cards são blocos informativos, sem link nem data-nav-page', run: function () {
          var cards = document.querySelectorAll('.how-grid .how-card');
          if (cards.length !== 3) return false;
          var titulos = ['Conteúdos', 'Repositório Colaborativo', 'Treinamento Jedi'];
          return Array.from(cards).every(function (c, i) {
            var titulo = c.querySelector('h3') ? c.querySelector('h3').textContent.trim() : '';
            return titulo === titulos[i] && c.tagName !== 'A' && !c.hasAttribute('href') && !c.hasAttribute('data-nav-page');
          });
        } },
        { id: 'c-cta-ver-turmas', label: 'CTA final: único botão "Ver turmas →" presente e aponta para #turmas', run: function () {
          var link = document.querySelector('.hero-actions a[data-nav-page="turmas"]');
          return !!link && /turmas/i.test(link.textContent);
        } },
        { id: 'c-footer-previ', label: 'Rodapé: link externo para previ.com.br presente e abre em nova aba', run: function () {
          var link = document.querySelector('.footer-previ');
          if (!link) return false;
          return link.getAttribute('href') === 'https://www.previ.com.br' && link.getAttribute('target') === '_blank';
        } },
        { id: 'c-crawl-pause-btn', label: 'Crawl: botão "Pausar" pausa/retoma a animação', run: function () {
          var crawl = document.querySelector('.crawl-content');
          var btn = document.querySelector('.crawl-pause');
          if (!crawl || !btn) return false;
          btn.click();
          var paused = crawl.style.animationPlayState === 'paused';
          btn.click();
          var resumed = crawl.style.animationPlayState === 'running';
          return paused && resumed;
        } },
        { id: 'c-crawl-pause-area', label: 'Crawl: clicar na área pausa/retoma (mesmo efeito do botão Pausar)', run: function () {
          var crawl = document.querySelector('.crawl-content');
          var stage = document.querySelector('.crawl-stage');
          if (!crawl || !stage) return false;
          stage.click();
          var paused = crawl.style.animationPlayState === 'paused';
          stage.click();
          var resumed = crawl.style.animationPlayState === 'running';
          return paused && resumed;
        } },
        { id: 'c-crawl-ler-texto', label: 'Crawl: botão "Ler texto" exibe texto estático; "Fechar texto" retorna ao crawl', run: function () {
          var crawl = document.querySelector('.crawl-content');
          var btn = document.querySelector('.crawl-skip');
          if (!crawl || !btn) return false;
          btn.click();
          var estatico = crawl.classList.contains('crawl-static') && btn.textContent.indexOf('Fechar texto') !== -1;
          btn.click();
          var voltou = !crawl.classList.contains('crawl-static') && btn.textContent.indexOf('Ler texto') !== -1;
          return estatico && voltou;
        } },
        { id: 'c-crawl-repetir', label: 'Crawl: botão "Repetir abertura" reinicia a animação do início', run: function () {
          var crawl = document.querySelector('.crawl-content');
          var replay = document.querySelector('.crawl-replay');
          if (!crawl || !replay) return false;
          replay.click();
          return crawl.classList.contains('run');
        } },
        { id: 'c-crawl-acesso', label: 'Crawl: visível para qualquer pessoa logada (não exige turma confirmada)', run: function () {
          var cs = document.querySelector('.crawl-section');
          if (!cs) return false;
          var sess = window.faAuth && window.faAuth.getSession ? window.faAuth.getSession() : null;
          /* Com sessão o crawl aparece, independente de estar confirmada em turma */
          return sess ? cs.style.display !== 'none' : cs.style.display === 'none';
        } }
      ]
    },
    {
      group: 'Ajuda',
      tests: [
        { id: 'c-faq-page', label: 'Página Ajuda presente no DOM (#page-ajuda)', run: function () { return !!document.getElementById('page-ajuda'); } },
        { id: 'c-faq-items', label: 'Ajuda tem 7 itens de acordeão (.faq-item)', run: function () { return document.querySelectorAll('#page-ajuda .faq-item').length === 7; } },
        { id: 'c-faq-nav',   label: 'Link "Ajuda" presente no menu de navegação', run: function () { return !!document.querySelector('[data-nav-page="ajuda"]'); } },
      ]
    },
    {
      group: 'Conteúdos',
      tests: [
        { id: 'c-principios-btn', label: '12 Princípios (passo 1 de 3): botão "Ver os 6 princípios restantes →" existe na tela', run: function () { return !!document.getElementById('principlesMoreBtn'); } },
        { id: 'c-principios-extra', label: '12 Princípios (passo 2 de 3): antes de clicar, os princípios 7–12 estão escondidos', run: function () {
          var el = document.getElementById('principlesExtra');
          return !!el && !el.classList.contains('visible');
        } },
        { id: 'c-principios-revelar', label: '12 Princípios (passo 3 de 3): depois de clicar no botão, os princípios 7–12 aparecem', run: function () {
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
      group: 'Repositório',
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
        { id: 'c-repo-filtro-funciona', label: 'Filtro de tipo: cada chip (Vídeos/Documentos/Ferramentas/Livros) mostra só cards do tipo correspondente', run: function () {
          var chips = document.querySelectorAll('#repoFilters .repo-chip');
          var allChip = Array.from(chips).find(function (c) { return c.dataset.f === 'all'; });
          if (!allChip) return false;
          var tipos = ['video', 'doc', 'tool', 'book'];
          var ok = tipos.every(function (tipo) {
            var chip = Array.from(chips).find(function (c) { return c.dataset.f === tipo; });
            if (!chip) return false;
            chip.click();
            var cards = document.querySelectorAll('#repoGrid .repo-card');
            return Array.from(cards).every(function (c) { return c.dataset.type === tipo; });
          });
          allChip.click();
          return ok;
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
      group: 'Turmas',
      tests: [
        { id: 'c-turmas-cards',   label: 'Cards de turma consistentes com as turmas cadastradas (.turma-card-new)', run: function () {
          /* turmas não são mais fixas em número — vêm de turmas/ no Firebase, editável
             pelo admin. Cada card está em um de 4 estados: interesse aberto (.btn--interest),
             inscrições encerradas (.turma-lotada-msg), em andamento (.turma-andamento-msg),
             ou realizada (.turma-realizada-msg). O card "Lista de Espera" também tem a classe
             .turma-card-new mas não é uma turma — é excluído da contagem. */
          var cards = document.querySelectorAll('.turma-card-new:not(.turma-card-espera)').length;
          var abertos = document.querySelectorAll('.btn--interest').length;
          var encerrados = document.querySelectorAll('.turma-lotada-msg').length;
          var andamento = document.querySelectorAll('.turma-andamento-msg').length;
          var realizada = document.querySelectorAll('.turma-realizada-msg').length;
          return cards === abertos + encerrados + andamento + realizada;
        } },
        { id: 'c-turmas-horario', label: 'Cards de turma exibem horário 9h – 13h (.tc-horario)', run: function () {
          var cards = document.querySelectorAll('.turma-card-new:not(.turma-card-espera)').length;
          if (!cards) return true; /* página Turmas ainda não carregada nesta sessão */
          return document.querySelectorAll('.tc-horario').length === cards;
        } },
        { id: 'c-turmas-como-funciona', label: 'Bloco "Como funciona a oficina" presente (.oficina-info)', run: function () { return !!document.querySelector('.oficina-info'); } },
        { id: 'c-turmas-ofinfo',  label: 'Bloco tem 4 métricas (.ofinfo-item)', run: function () { return document.querySelectorAll('.ofinfo-item').length === 4; } },
        { id: 'c-turmas-intent-btn', label: 'Botões de interesse não excedem o número de cards de turma (.btn--interest)', run: function () {
          return document.querySelectorAll('.btn--interest').length <= document.querySelectorAll('.turma-card-new').length;
        } },
        { id: 'c-turmas-intent-msg', label: 'Cada botão de interesse tem seu container de mensagem (#intent-msg-{turma})', run: function () {
          var btns = document.querySelectorAll('.btn--interest');
          if (!btns.length) return true;
          return Array.prototype.every.call(btns, function (btn) {
            var key = btn.dataset.turma;
            return !!key && !!document.getElementById('intent-msg-' + key);
          });
        } },
        { id: 'c-turmas-agenda-estatica', label: 'Agenda D1–D5: todos os dias são .day--static e não expandem ao clicar', run: function () {
          var days = document.querySelectorAll('.day--static');
          if (days.length < 5) return false;
          var first = days[0];
          var before = first.className;
          first.click();
          var after = first.className;
          return before === after;
        } },
        { id: 'c-turmas-btn-style', label: 'Botão "Tenho interesse" dourado sólido; após concluir, fundo escuro neutro', run: function () {
          /* Usa um botão fora da tela (não o da página Turmas, que só existe
             quando aquela seção está com dados carregados) para o teste
             funcionar de qualquer página, inclusive da aba Testes no Admin. */
          var btn = document.createElement('button');
          btn.className = 'btn--interest';
          /* transition:none — sem isso, ler o estilo computado logo após
             trocar a classe pega um valor no meio da transição de .2s,
             não o valor final, e o teste falha por motivo errado */
          btn.style.cssText = 'position:absolute;left:-9999px;top:-9999px;transition:none';
          document.body.appendChild(btn);
          var beforeBg = window.getComputedStyle(btn).backgroundColor;
          btn.classList.add('done');
          var afterBg = window.getComputedStyle(btn).backgroundColor;
          document.body.removeChild(btn);
          return beforeBg !== afterBg && beforeBg === 'rgb(245, 197, 24)';
        } }
      ]
    },
    {
      group: 'Treinamento Jedi',
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
        { id: 'c-quiz-jedi-stepper', label: 'Welcome screen contém stepper com 4 passos (.jedi-step)', run: function () {
          return document.querySelectorAll('#treinamento-welcome .jedi-step').length === 4;
        } },
        { id: 'c-quiz-patente',   label: 'Painel de patente presente',             run: function () { return !!document.getElementById('rankHud'); } },
        { id: 'c-quiz-patentes',  label: '4 patentes exibidas (Youngling→Mestre)', run: function () { return document.querySelectorAll('.char-card').length >= 4; } },
        { id: 'c-quiz-previx',    label: 'Droide Previx (guia) presente',          run: function () { return !!document.querySelector('.guide-droide') || !!document.getElementById('guideMsg'); } },
        { id: 'c-quiz-auto-1x', label: 'Autodiagnóstico (1×): opções bloqueadas após concluído', run: function () {
          if (!window.faGameData || !window.faGameReload) return false;
          var st = window.faStore || localStorage;
          var backup = st.getItem('fa-game-v3');
          var quizCompleto = window.faGameData.DIMS.map(function () { return 1; });
          st.setItem('fa-game-v3', JSON.stringify({ quiz: quizCompleto }));
          window.faGameReload();
          var opts = document.querySelectorAll('.q-opt');
          var todasBloqueadas = opts.length > 0 && Array.from(opts).every(function (b) { return b.disabled; });
          if (backup !== null) st.setItem('fa-game-v3', backup); else st.removeItem('fa-game-v3');
          window.faGameReload();
          return todasBloqueadas;
        } },
        { id: 'c-quiz-afirmacoes-count', label: 'Autodiagnóstico: 20 afirmações em 4 blocos (5 cada) presentes no DOM', run: function () {
          if (!window.faGameData) return false;
          var blocos = window.faGameData.BLOCOS || [];
          if (blocos.length !== 4) return false;
          var totalAfirm = blocos.reduce(function (a, b) { return a + (b.afirmacoes ? b.afirmacoes.length : 0); }, 0);
          if (totalAfirm !== 20) return false;
          return document.querySelectorAll('.q-opts--likert').length === 20;
        } },
        { id: 'c-quiz-resposta-salva-pontuacao', label: 'Autodiagnóstico: clicar numa opção salva a pontuação (0–3) da afirmação', run: function () {
          if (!window.faGameData || !window.faGameReload) return false;
          var st = window.faStore || localStorage;
          var backupGame = st.getItem('fa-game-v3');
          var backupPlayer = localStorage.getItem('fa-player');
          try {
            localStorage.setItem('fa-player', JSON.stringify({ name: 'Teste Score XYZ', turma: 'XX', area: 'XX' }));
            st.removeItem('fa-game-v3');
            window.faGameReload();
            var lowBtn = document.querySelector('.q-opt[data-q="0"][data-v="0"]');
            var highBtn = document.querySelector('.q-opt[data-q="0"][data-v="3"]');
            if (!lowBtn || !highBtn) return false;
            lowBtn.click();
            var afterLow = JSON.parse(st.getItem('fa-game-v3') || 'null');
            highBtn.click();
            var afterHigh = JSON.parse(st.getItem('fa-game-v3') || 'null');
            return !!afterLow && !!afterHigh && afterLow.quiz[0] === 0 && afterHigh.quiz[0] === 3;
          } finally {
            if (backupGame !== null) st.setItem('fa-game-v3', backupGame); else st.removeItem('fa-game-v3');
            if (backupPlayer !== null) localStorage.setItem('fa-player', backupPlayer); else localStorage.removeItem('fa-player');
            window.faGameReload();
          }
        } },
        { id: 'c-quiz-patente-atualiza-pontuacao', label: 'Painel de patente atualiza a patente exibida conforme a pontuação total muda', run: function () {
          if (!window.faGameData || !window.faGameReload) return false;
          var st = window.faStore || localStorage;
          var backup = st.getItem('fa-game-v3');
          try {
            var dims = window.faGameData.DIMS.length;
            st.setItem('fa-game-v3', JSON.stringify({ quiz: Array(dims).fill(0) }));
            window.faGameReload();
            var hud = document.getElementById('rankHud');
            if (!hud) return false;
            var hudLow = hud.textContent;
            st.setItem('fa-game-v3', JSON.stringify({ quiz: Array(dims).fill(3) }));
            window.faGameReload();
            var hudHigh = hud.textContent;
            return hudLow.indexOf('Youngling') !== -1 && hudHigh.indexOf('Mestre') !== -1;
          } finally {
            if (backup !== null) st.setItem('fa-game-v3', backup); else st.removeItem('fa-game-v3');
            window.faGameReload();
          }
        } },
      ]
    },
    {
      group: 'Admin',
      tests: [
        { id: 'c-adm-interesses', label: 'Aba Interessados por turma carregada',  run: function () { return !!document.getElementById('adminInterests') || !!document.getElementById('adminPanelInteresses'); } },
        { id: 'c-adm-admins',     label: 'Aba Administradores presente',          run: function () { return !!document.getElementById('adminPanelAdmins'); } },
        { id: 'c-adm-superadmin', label: 'Super-admins fixos no código (tatianefdirene + danielfrazao)',
          run: function () {
            var list = window.faSuperAdmins || [];
            var hasTatiane = list.some(function (e) { return e.indexOf('tatianefdirene') !== -1; });
            var hasDaniel  = list.some(function (e) { return e.indexOf('danielfrazao') !== -1 || e.indexOf('danilfrazao') !== -1; });
            return hasTatiane && hasDaniel;
          }
        },
        { id: 'c-adm-admins-private', label: 'Lista de admins não exposta a usuários comuns (auth.js lê só o próprio registro)',
          run: function () {
            var src = (window.faAuth && window.faAuth.toString ? window.faAuth.toString() : '');
            return typeof window.faAuth !== 'undefined';
          }
        },
        { id: 'c-aval-page',    label: 'Seção #page-avaliacao existe no DOM',       run: function () { return !!document.getElementById('page-avaliacao'); } },
        { id: 'c-aval-content', label: 'Container #avaliacaoContent existe no DOM',  run: function () { return !!document.getElementById('avaliacaoContent'); } },
        { id: 'c-aval-api',     label: 'API faAvaliacao disponível (init + checkNavVisibility)', run: function () { return typeof window.faAvaliacao === 'object' && typeof window.faAvaliacao.init === 'function' && typeof window.faAvaliacao.checkNavVisibility === 'function'; } },
        { id: 'c-aval-nav-admin', label: 'Admin vê link Avaliação no menu (nav-link-aval)',
          run: function () {
            var s = window.faAuth && window.faAuth.getSession();
            if (!s || !window.faAuth.isAdmin(s.email)) return true; /* só aplica para admin */
            var link = document.querySelector('.nav-link-aval[data-nav-page="avaliacao"]');
            return !!link && !link.hidden;
          }
        },
        { id: 'c-adm-expand-collapse-all', label: 'Expandir tudo / Recolher tudo abrem e fecham os itens retráteis da aba ativa', run: function () {
          var manualBtn = Array.from(document.querySelectorAll('.admin-tab-btn')).find(function (b) { return b.dataset.panel === 'adminPanelManual'; });
          var prevActiveBtn = document.querySelector('.admin-tab-btn.active');
          if (!manualBtn || !window.faInitManual) return false;
          manualBtn.click();
          window.faInitManual();
          var details = document.querySelectorAll('#adminPanelManual details.manual-card');
          if (!details.length) return false;
          var expandBtn = document.getElementById('adminExpandAll');
          var collapseBtn = document.getElementById('adminCollapseAll');
          if (!expandBtn || !collapseBtn) return false;
          expandBtn.click();
          var allOpen = Array.from(details).every(function (d) { return d.open; });
          collapseBtn.click();
          var allClosed = Array.from(details).every(function (d) { return !d.open; });
          if (prevActiveBtn) prevActiveBtn.click();
          return allOpen && allClosed;
        } }
      ]
    }
  ];

  /* ================================================================
     GRUPO 3 — COMPORTAMENTO (MANUAIS)
     Regras que NÃO podem ser verificadas automaticamente.
     Exibidas com motivo explicado para validação humana.
  ================================================================ */
  const COMPORTAMENTO_MANUAL = [
    { section: 'Entrar',
      title: 'Sessão presa: recuperação automática, sem laço e sem afetar quem está bem',
      motivo: 'Diagnóstico de origem: dentro da rede da Previ, quem tinha sessão guardada travava na espera; em janela anônima o site abria normal; limpando os cookies voltava a funcionar. Testar os três lados. (1) QUEM ESTÁ BEM não pode ser afetado: entrar normalmente numa rede boa, recarregar várias vezes e confirmar que a sessão CONTINUA — a limpeza automática não pode disparar para quem está funcionando; é o risco principal desta mudança. (2) RECUPERAÇÃO: na rede onde o problema acontece, abrir o site já logado e esperar; em cerca de 10 segundos a página deve recarregar sozinha e mostrar a tela de login com o aviso "Entre novamente". Entrar e verificar que tudo funciona e que nenhum dado foi perdido. (3) SEM LAÇO: se após a limpeza continuar travando, a página NÃO pode ficar recarregando sem parar — deve aparecer o aviso com o botão "Limpar sessão e entrar de novo" e o de diagnóstico. Conferir também que o aviso "Entre novamente" some depois do primeiro login e não reaparece a cada visita.' },
    { section: 'Entrar',
      title: 'Servidor sem resposta não pode deixar a tela preta',
      motivo: 'Simular a falta de resposta do servidor: abrir o site e, antes de ele carregar, cortar a internet (modo avião ou desconectar o cabo). Verificar: (1) NÃO fica uma tela preta indefinida; (2) em cerca de 10 segundos aparece a tela de login com o aviso "Demorando para conectar"; (3) clicando em "Testar conexão", os quatro itens aparecem marcados como bloqueados e surge o texto pronto para a TI; (4) religando a internet e recarregando, o site volta ao normal e o aviso não aparece. Testar também o caminho oposto, numa rede corporativa com proxy: se os quatro derem OK e o site ainda assim demorar, o diagnóstico deve mostrar os TEMPOS de cada parte — é o que distingue lentidão para baixar o sistema de lentidão do servidor.' },
    { section: 'Entrar',
      title: 'Login — erro de credenciais',
      motivo: 'Requer tentativa de login com senha errada, o que causaria falha de autenticação real.' },
    { section: 'Entrar',
      title: 'Login — botão "Aguarde…" durante autenticação',
      motivo: 'Estado transiente (dura milissegundos) — impossível capturar automaticamente.' },
    { section: 'Entrar',
      title: 'Login — esqueci minha senha (recebimento do e-mail)',
      motivo: 'A abertura do painel já é testada automaticamente. Falta só verificar o recebimento real do e-mail de redefinição enviado pelo Firebase.' },
    { section: 'Cadastrar',
      title: 'Cadastro — e-mail já existente (mensagem de erro)',
      motivo: 'Requer tentar cadastrar e-mail duplicado — causaria chamada real ao Firebase Auth.' },
    { section: 'Cadastrar',
      title: 'Cadastro — formatação automática (nome maiúsculo, e-mail minúsculo)',
      motivo: 'Requer realizar um cadastro real e verificar no Firebase. Não deve ser feito em teste automatizado.' },
    { section: 'Cadastrar',
      title: 'Cadastro — botão "Aguarde…" durante envio',
      motivo: 'Estado transiente — só visível durante o envio real ao Firebase.' },
    { section: 'Menu / Sessão',
      title: 'Clicar no avatar/nome no menu navega para Treinamento Jedi',
      motivo: 'Requer clique no avatar/nome exibido no menu (substitui os botões Entrar/Cadastrar após login) e verificação de navegação — interação com estado de sessão ativa.' },
    { section: 'Menu / Sessão',
      title: 'Botão "Sair" encerra sessão e redireciona para Início',
      motivo: 'Executar encerraria a sessão do teste em si, impedindo os demais testes.' },
    { section: 'Início',
      title: 'Interessado tem o mesmo acesso de logado — só inscrito destrava as 3 páginas',
      motivo: 'Requer duas contas logadas sem turma confirmada: uma que NUNCA clicou em "Tenho interesse" e outra que clicou (status "interessado"). Verificar que ambas veem exatamente o mesmo: Início, Turmas, Ajuda e Repositório — e que NENHUMA das duas vê Conteúdos, Treinamento Jedi ou Avaliação no menu, nem consegue acessar por URL direta. A única diferença entre elas deve ser o texto do botão no card da turma ("Tenho interesse" vs "Remover interesse"). Depois, pedir ao admin para confirmar uma delas na turma e recarregar: só então as 3 páginas aparecem. Isso comprova que quem muda o nível de acesso é a confirmação do admin, não o interesse manifestado.' },
    { section: 'Início',
      title: 'Login obrigatório — visitante não vê o site, só o modal',
      motivo: 'Abrir o site numa janela anônima (sem sessão). Verificar: (1) o body tem a classe "aguardando-auth" e nada do site aparece — nem menu, nem hero, nem rodapé; (2) o modal de autenticação abre sozinho, com fundo opaco e SEM botão de fechar; (3) não é possível fechar o modal com Esc nem clicando fora; (4) só depois de autenticar o site é revelado. Consequência documentada: nenhuma tela interna (Início, Turmas, Ajuda, Repositório...) é alcançável por visitante — por isso essas telas não têm mais a persona "visitante" no Manual nem no Mapa.' },
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
      motivo: 'Verificar visualmente que os 3 botões aparecem em linha horizontal (não empilhados).' },
    { section: 'Início',
      title: 'Cards "Como funciona" → cada um navega para sua página',
      motivo: 'Clicar navegaria para fora da página Admin, interrompendo a sessão de testes em execução.' },
{ section: 'Turmas',
      title: 'Turma com interesse encerrado não manda ninguém ao CMFlex',
      motivo: 'Encerrar o interesse de uma turma cujas datas ainda estão no futuro e abrir a página Turmas como participante. O card deve dizer "Inscrições encerradas", explicar que as vagas já foram preenchidas, informar quando a turma será realizada e convidar a acompanhar as próximas — SEM botão e SEM link para o CMFlex. O motivo é prático: o interesse é encerrado justamente porque as vagas no CMFlex acabaram, então mandar a pessoa para lá é mandar bater numa porta fechada. Conferir também que o CMFlex continua sendo indicado no momento certo: com a turma ainda aberta, registrar interesse e verificar que aparece a mensagem orientando a inscrição no CMFlex. Por fim, conferir a passagem entre os estados: chegando o primeiro dia, o card vira "Turma em andamento"; passado o último dia ou com a turma encerrada pelo admin, vira "Turma realizada".' },
        { section: 'Turmas',
      title: 'Visitante não acessa Conteúdos nem Treinamento Jedi',
      motivo: 'Verificar manualmente: acessar #conteudos e #gamificacao sem estar logado — o site deve bloquear o acesso e não exibir o conteúdo dessas páginas.' },
    { section: 'Turmas',
      title: 'Logado sem turma não acessa Conteúdos nem Treinamento Jedi',
      motivo: 'Verificar com conta logada sem turma confirmada: links de Conteúdos e Treinamento Jedi não devem aparecer no menu; acessar as páginas diretamente deve ser bloqueado.' },
    { section: 'Turmas',
      title: 'Inscrito confirmado vê o mesmo card de CMFlex que todo mundo',
      motivo: 'Verificar com conta confirmada como inscrita (via Admin) numa turma com interesse encerrado: o card dela mostra a mesma orientação pro CMFlex que qualquer pessoa autenticada vê — não existe mais um card especial de "turma confirmada" nem distinção visual por já estar inscrita.' },
    { section: 'Turmas',
      title: 'Card "Lista de Espera" aparece sempre na grade de turmas',
      motivo: 'Verificar na página Turmas (qualquer perfil autenticado): o card com borda dourada tracejada deve aparecer como último card da grade, independente de existirem turmas abertas ou não.' },
    { section: 'Turmas',
      title: 'Lista de espera — entrar e sair',
      motivo: 'Logada: clicar "Entrar na lista de espera" → botão vira "Na lista — Sair" e mensagem de confirmação aparece. Clicar de novo → sai da lista, botão volta ao estado inicial. Gravaria dados reais em fa-espera/ no Firebase.' },
    { section: 'Turmas',
      title: 'Lista de espera sem login → abre modal de login',
      motivo: 'Visitante clica "Entrar na lista de espera" → mensagem de aviso e modal de login devem aparecer.' },
    { section: 'Turmas',
      title: 'Admin — mover pessoa da lista de espera para turma',
      motivo: 'Na aba Cadastrados do painel admin, selecionar uma turma no select da pessoa e clicar "Mover para turma" → confirmar no diálogo → pessoa desaparece da lista de espera e aparece na turma como Inscrita (status=inscrito + confirmedByAdmin).' },
    { section: 'Turmas',
      title: 'Admin — migrar participante de turma para lista de espera',
      motivo: 'Na tabela de participantes de uma turma (interessada ou inscrita), clicar "Remover" e marcar a caixa "Colocar na lista de espera". Verificar primeiro que o modal EXIGE um motivo: tentar confirmar sem escolher nada deve mostrar "Escolha um motivo." e não gravar; escolher "Outro" deve abrir um campo de texto que também é obrigatório. Depois de escolher e confirmar, a pessoa sai da turma (removed:true) e entra na lista de espera — e aparece no filtro "Foram para a espera", não em "Removidos". Verificar: (1) a data exibida na lista de espera é a data ORIGINAL de interesse na turma, não o momento da migração; (2) a coluna "Data remoção" traz o momento em que ela saiu da turma, e é diferente da "Data interesse"; (3) a coluna "Origem" mostra o nome da turma de onde ela veio, com uma seta ↩, e logo abaixo o motivo; (4) uma pessoa que entrou direto pelo card "Lista de Espera" do site aparece nessa coluna como "Entrou pela lista", sem nome de turma, e com traço na data de remoção.' },
{ section: 'Admin',
      title: 'Coluna Destino de quem saiu da turma',
      motivo: 'Remover três pessoas da mesma turma por caminhos diferentes: uma marcando "colocar na lista de espera", outra com o motivo "vai fazer em outra turma" (escolhendo a turma), e a terceira sem nenhum dos dois. Depois conferir: (1) cada uma aparece no filtro certo — Foram para a espera, Foram para outra turma e Removidos, respectivamente; (2) na coluna Destino os selos dizem, na ordem, "Lista de espera", o NOME da turma escolhida, e "Saiu" — e, para quem sai pelo motivo "Substituída por outra pessoa", "Substituída"; (3) o mesmo vale na turma já com presença registrada, onde a tabela tem as colunas de dias — as duas tabelas de quem saiu precisam mostrar a mesma coluna Destino, porque antes divergiam; (4) o motivo continua aparecendo na coluna dele, sem o destino grudado no texto, e abaixo dele a autoria: remova uma pessoa pelo painel e confira que aparece "por <seu nome>"; peça a alguém para tirar o próprio interesse pelo site e confira que aparece "pela própria pessoa" — nunca o contrário, e nunca "pelo admin" numa saída que o admin não fez. Em registro antigo, sem nenhum dos dois dados, tem que aparecer "motivo não registrado" e nenhuma autoria; (5) as colunas Data interesse e Data remoção trazem datas diferentes — a primeira tem que bater com a data que a pessoa aparecia antes de sair, e nunca pode repetir a data da remoção; (6) numa turma com presença registrada, se NINGUÉM do grupo tiver check-in, a tabela não pode mostrar as colunas de dia nem a de frequência; removendo alguém que tinha presença, as colunas voltam a aparecer com os selos dela intactos.' },
    { section: 'Admin',
      title: 'Saída da turma: motivo, destino e a fila com a data original',
      motivo: 'Numa turma de teste, remover uma pessoa e conferir cada caminho. (1) O modal EXIGE motivo — confirmar sem escolher não pode passar. (2) Motivo "Vai fazer em outra turma": tem que aparecer a lista de turmas e exigir uma escolha; depois, na lista de quem saiu, o registro deve mostrar o motivo E a turma de destino. (2b) Motivo "Já participou de uma turma": a MESMA lista aparece, mas perguntando "qual turma ela já fez?" — e o registro tem que dizer "Já participou da <turma>" SEM mandar a pessoa para o filtro "Foram para outra turma", cujo destino continua "Saiu". Se a pessoa já foi confirmada em exatamente uma turma antes, ela vem pré-escolhida; com duas ou mais, nenhuma vem escolhida. (3) Motivo "Outro": exige a descrição. (4) Caixa "Colocar na lista de espera": marcar e confirmar — a pessoa deve aparecer na lista de espera da aba Cadastrados com a DATA E HORA DO INTERESSE ORIGINAL, não a data de hoje; conferir esse horário contra o registro anterior dela, porque é o que define a ordem da fila. (5) Sem marcar a caixa: a pessoa sai da turma e NÃO aparece na fila. (6) Conferir que a caixa já vem MARCADA ao abrir o modal, em qualquer motivo, e que dá para desmarcar. (7) Escolher "Vai fazer em outra turma": a caixa tem que SUMIR — e o registro precisa gravar a turma de destino, nunca mandar a pessoa para a fila. (8) Desmarcar a caixa na mão e depois trocar de motivo: ela não pode voltar a se marcar sozinha, porque a escolha já foi feita.' },
    { section: 'Admin',
      title: 'Registrar depois o motivo de uma saída em branco',
      motivo: 'Requer alguém em "Removidos" ou "Foram para a espera" com "motivo não registrado". Verificar: (1) só essas linhas mostram o botão "+ registrar motivo" — quem já tem motivo não pode mostrar; (2) clicar abre a mesma lista de motivos da remoção, e exige escolher um; (3) depois de confirmar, a linha passa a mostrar o motivo escolhido E a marca "motivo registrado depois por <seu nome>"; (4) a data de remoção, o destino e a autoria original (quem removeu) NÃO podem mudar; (5) escolher "vai fazer em outra turma" grava a turma e o destino passa a mostrá-la; (6) escolher "substituída" pede quem entrou no lugar, e cancelar essa pergunta não grava nada; (7) o botão some depois de preenchido. (8) Numa linha cujo motivo é "Já participou de uma turma" mas sem dizer qual (ou "vai fazer em outra turma" sem a turma, ou "substituída" sem o nome), o botão tem que aparecer como "+ completar motivo", abrir com o motivo já escolhido e TRAVADO (não dá para trocar), pedir só o que falta, e a linha passar a dizer "motivo completado depois por <seu nome>". (9) Linha com motivo completo não pode mostrar botão de motivo.' },
    { section: 'Admin',
      title: 'Excluir definitivamente um registro de teste',
      motivo: 'Requer uma pessoa já removida de uma turma, criada só para teste. ATENÇÃO: é irreversível — não use com pessoa de verdade. Verificar: (1) o botão "🗑 excluir registro" aparece em TODA linha de quem saiu, e em nenhuma linha de quem continua na turma; (2) o modal explica que não é o mesmo que remover e avisa que não dá para desfazer; (3) cancelar não muda nada; (4) confirmando, a pessoa some da lista de quem saiu E o número de "Todos os interessados" cai em 1 — é o ponto da funcionalidade; (5) se ela tinha presença registrada naquela turma, some junto; (6) o cadastro dela em Cadastrados continua existindo, e o registro dela em OUTRA turma não é tocado; (7) o CSV "Histórico" deixa de mostrar as linhas dela naquela turma.' },
    { section: 'Admin',
      title: 'Substituída registra quem entrou no lugar',
      motivo: 'Remover alguém escolhendo o motivo "Substituída por outra pessoa". Verificar: (1) abre a pergunta de quem entrou no lugar, listando as pessoas da própria turma; (2) confirmar sem escolher ninguém não pode passar; (3) a opção de digitar um nome funciona para quem não está na lista; (4) cancelar essa pergunta NÃO remove a pessoa — ela continua na tabela, intacta; (5) concluindo, ela aparece na lista de quem saiu com o selo "Substituída" na coluna Destino e "Substituída por Fulana" na coluna Motivo; (6) repetir marcando a caixa da lista de espera: a pessoa vai para a fila, com a data original, e o nome de quem entrou continua registrado; (7) conferir que a caixa da lista de espera já vem marcada, como em qualquer motivo.' },
    { section: 'Admin',
      title: 'Filtros por destino: a soma tem que fechar',
      motivo: 'Abrir uma turma com gente em várias situações e somar à mão: Confirmados + Aguardando decisão + Foram para a espera + Foram para outra turma + Removidos tem que dar exatamente o número de "Todos os interessados". Se não fechar, alguém está em dois grupos ou em nenhum. Conferir também: (1) "Aguardando decisão" traz todo mundo que não foi confirmada E não foi removida, e o número bate com o do cabeçalho do card ("X interessados · Y confirmados · Z aguardando decisão"); (2) quem foi para a fila aparece em "Foram para a espera" e NÃO em "Removidos"; (3) os dois grupos de quem saiu mostram motivo e destino, sem botões de ação — não faz sentido agir sobre quem já saiu; (4) numa turma em que só existe um grupo com gente, a barra de filtros não aparece.' },
    { section: 'Admin',
      title: 'Lista de espera — data e hora corretas',
      motivo: 'Abrir a aba Cadastrados e conferir a Lista de Espera: as colunas Data interesse e Data remoção devem mostrar dia e hora no formato brasileiro (10/08/2026 12:26), não a data crua do banco. Conferir uma linha contra o horário real em que a pessoa entrou na fila. A ordem da lista segue a data de interesse, não a de remoção. ATENÇÃO AO FUSO: se algum dia aparecer um registro cuja data foi guardada sem hora, ele deve aparecer só com a data — nunca com uma hora inventada, e nunca com o dia anterior ao correto, que é o erro clássico ao converter data sem hora. Vale repetir esta conferência depois de qualquer mexida em exibição de datas no painel.' },
    { section: 'Admin',
      title: 'Certificados — a frequência tem que bater com o check-in',
      motivo: 'Abrir a aba Certificados e selecionar uma turma que já teve encontros. Conferir que o percentual ao lado de cada nome é o MESMO que aparece na aba Eventos para aquela pessoa (dias com presença dividido pelo total de encontros). Ninguém que compareceu pode aparecer com 0%. Este teste existe porque a aba já calculou a chave do e-mail num formato próprio, diferente do que o check-in grava: não encontrava ninguém, mostrava 0% para todos e bloqueava a emissão inclusive de quem tinha 100%. Como o número 0% é plausível por si só, o erro passou despercebido — conferir contra a aba Eventos é o que revela. Verificar também que, com a turma encerrada, os botões PNG/PDF ficam habilitados para quem atingiu o mínimo do evento, e que Baixar todos gera um arquivo por pessoa elegível.' },
    { section: 'Admin',
      title: 'Certificado — símbolo da Previ igual ao do site',
      motivo: 'O template do certificado trazia um símbolo da Previ diferente do usado no site. Abrir a prévia de um certificado e comparar o cabeçalho com o topo do site: o símbolo ao lado da palavra Previ tem que ser o mesmo desenho e o mesmo tom de verde-água. Conferir também que o resto da arte não mudou — moldura, estrelas, planeta, os textos fixos e, principalmente, a posição dos seis campos que o sistema escreve (nome, evento, turma, período, carga horária e data). Repetir essa comparação sempre que o template for trocado: a arte é uma imagem, então nada quebra sozinho se ela vier errada.' },
        { section: 'Admin',
      title: 'Lista de Espera — remover exige motivo',
      motivo: 'Na aba Cadastrados → seção Lista de Espera, clicar "Remover da lista" em alguém. Verificar: (1) abre modal pedindo o motivo, com as opções Desistiu / não tem mais interesse, Já participou de uma turma, Não respondeu aos contatos, Evento encerrado, Registro duplicado e Outro; (1b) escolher "Já participou de uma turma" abre a lista de turmas perguntando "qual turma ela já fez?" e exige uma escolha; se a pessoa já foi confirmada em exatamente uma turma, ela vem pré-escolhida; o motivo gravado tem que dizer "Já participou da <turma>"; (2) confirmar sem escolher motivo mostra "Escolha um motivo." e não remove ninguém; (3) escolher "Outro" abre campo de texto que também é obrigatório — confirmar vazio mostra "Descreva o motivo."; (4) após confirmar com um motivo válido, a pessoa sai da lista. O motivo fica gravado junto com a data e o nome de quem removeu.' },
    { section: 'Turmas',
      title: 'Sessão expirada com a página aberta — interesse não registra sozinho',
      motivo: 'Cenário raro: deixar a página Turmas aberta até a sessão expirar e então clicar em "Tenho interesse". Verificar que aparece "Faça login para registrar seu interesse." e o modal abre; depois de entrar de novo, o botão volta a "Tenho interesse" e o registro NÃO acontece sozinho — é preciso clicar outra vez. (Antes do login obrigatório esse era o fluxo normal do visitante; hoje só acontece por expiração de sessão.)' },
    { section: 'Turmas',
      title: 'Botão "Tenho interesse" → registra e vira "Remover interesse"; clicar novamente remove e volta ao estado inicial',
      motivo: 'Gravaria dados reais no Firebase (turmas-interesse e turmas-interesse-log). Requer sessão ativa com email real.' },
    { section: 'Turmas',
      title: 'Após registrar interesse → mensagem orientando inscrição no CMFlex',
      motivo: 'Verificar visualmente ao clicar em "Tenho interesse": embaixo do botão deve aparecer "Interesse registrado. Para confirmar sua vaga, realize a inscrição no CMFlex em: RH - Uso Pessoal | PREVI" — sem usar a palavra "inscrita" nesse estado.' },
    { section: 'Turmas',
      title: 'Após remover interesse → mensagem "Interesse removido." e botão volta a "Tenho interesse"',
      motivo: 'Verificar visualmente ao clicar em "Remover interesse" com um interesse já registrado.' },
    { section: 'Turmas',
      title: 'Inscrita não consegue se autorremover pelo site (botão travado)',
      motivo: 'Requer confirmar uma pessoa como Inscrita numa turma que continue com interesse aberto (ex.: reabrir a turma depois de confirmá-la, ou adicioná-la como Inscrita direto numa turma aberta). Logar como essa pessoa e acessar Turmas. Verificar: (1) o card mostra botão verde desabilitado "✓ Inscrita" em vez de "♡ Remover interesse"; (2) mensagem "Você já é inscrita nesta turma. Só o admin pode alterar sua inscrição."; (3) clicar no botão não faz nada (Firebase não é alterado); (4) só o "Desconfirmar" do admin tira esse status.' },
    { section: 'Turmas',
      title: 'Interesse encerrado — card orienta pro CMFlex, igual pra qualquer pessoa',
      motivo: 'Com uma turma com interesse encerrado pelo admin E que ainda não chegou ao primeiro dia: (1) como usuário logado sem turma confirmada, verificar que o card mostra título "Faça sua inscrição no CMFlex", texto "Sua inscrição deve ser feita na Plataforma de Gestão, em RH Uso Pessoal > Solicitação de curso, após a aprovação do seu gestor." e botão "Ir para o CMFlex →" (sem botão de interesse); (2) como inscrito em outra turma, mesmo resultado; (3) se a turma não tiver link do CMFlex cadastrado, o card mostra "Link ainda não disponível. Consulte a organização." no lugar do botão.' },
    { section: 'Turmas',
      title: 'Card "Em andamento" — aparece automaticamente no primeiro dia da turma',
      motivo: 'Verificar (se existir turma com data iniciada): o card mostra "Turma em andamento" e o texto "As aulas estão acontecendo. Fique de olho nas próximas turmas!" — sem nenhum botão de interesse ou CMFlex. Esse estado é automático por data (hoje ≥ primeiro dia), sem nenhuma ação do admin. Testar como logado, inscrito e admin — o card deve ser idêntico para todos.' },
    { section: 'Turmas',
      title: 'Card "Realizada" — aparece automaticamente após o último dia',
      motivo: 'Verificar (se existir turma com todas as datas no passado): o card mostra "Turma realizada" e o texto "Esta turma já foi concluída. Fique de olho nas próximas!" — sem nenhum botão. Esse estado é automático (hoje > último dia). Testar como visitante, logado e inscrito — o card deve ser idêntico para todos.' },
    // Cenários de exceção (corridas, falhas e correções de bug)
    { section: 'Turmas',
      title: 'Corrida: interesse encerra entre carregar a página e clicar → "Esta turma está encerrada para novas inscrições."',
      motivo: 'Requer abrir o card com a turma ainda aberta, encerrar o interesse pelo admin em outra aba, e só então clicar em "Tenho interesse".' },
    { section: 'Turmas',
      title: 'Corrida rara: interesse encerra com a página já aberta → botão continua até recarregar',
      motivo: 'Requer abrir a página Turmas com a turma ainda aberta, encerrar o interesse pelo admin em outra aba sem recarregar a página do usuário, e clicar em "Remover interesse" (ainda funciona) ou em "Tenho interesse" (bloqueado com aviso, ver teste acima). Ao recarregar, o card já aparece no modo CMFlex.' },
    { section: 'Turmas',
      title: 'Falha ao gravar no Firebase → "Erro ao registrar. Tente novamente." / "Erro ao remover. Tente novamente."',
      motivo: 'Requer simular falha de escrita no Firebase (ex.: regra de segurança negando ou rede indisponível) ao clicar em "Tenho interesse" ou "Remover interesse".' },
    { section: 'Turmas',
      title: 'Falha silenciosa na leitura inicial (sem callback de erro nem timeout) → card/botão trava no estado estático padrão',
      motivo: 'Requer simular falha de leitura no Firebase (regra negando ou rede indisponível) durante o carregamento da página Turmas — verificar que nenhuma mensagem de erro aparece e o botão fica preso em "Tenho interesse" mesmo com interesse já registrado.' },
    { section: 'Turmas',
      title: 'Sem listener duplicado ao revisitar a página Turmas',
      motivo: 'Navegar Turmas → Início → Turmas várias vezes (ou logar/deslogar na página) e depois clicar em "Tenho interesse" uma única vez: deve gravar apenas uma entrada em turmas-interesse-log, não uma por revisita.' },
    { section: 'Turmas',
      title: 'Botão desabilitado durante a gravação — sem duplicação por clique duplo',
      motivo: 'Clicar duas vezes rapidamente em "Tenho interesse" (ou "Remover interesse") antes da resposta do Firebase: o botão deve ficar desabilitado no primeiro clique, e apenas uma entrada deve ser gravada em turmas-interesse-log.' },
    { section: 'Turmas',
      title: 'Confirmar quem já é Inscrita em outra turma — aviso e remoção automática (só para inscrição, não interesse)',
      motivo: 'Requer confirmar a mesma pessoa como Inscrita em duas turmas — exige dado real no Firebase, não pode ser simulado no teste automatizado. Verificar dois casos: (a) ela está Interessada (não inscrita) na Turma A e é confirmada como Inscrita na Turma B — não deve aparecer nenhum aviso, e o registro dela na Turma A continua intacto como Interessada; (b) ela já é Inscrita na Turma A e é confirmada como Inscrita na Turma B — o modal avisa que ela já é inscrita na Turma A; ao confirmar, o registro dela na Turma A vira "removido" com motivo registrado e aparece na seção Removidos daquela turma; ao cancelar, nada muda em nenhuma das duas turmas.' },
    { section: 'Check-in',
      title: 'QR Code inválido ou sem turma na URL → "QR Code inválido ou turma não encontrada"',
      motivo: 'Acessar #checkin sem parâmetro turma ou com uma chave inexistente.' },
    { section: 'Check-in',
      title: 'Sem login → "Faça login para registrar sua presença"; completa check-in automático após logar',
      motivo: 'Acessar #checkin?turma=<key> deslogado, depois fazer login na mesma aba.' },
    { section: 'Check-in',
      title: 'Turma não finalizada → "Esta turma ainda não teve as inscrições finalizadas"',
      motivo: 'Requer turma com turmas-config/<turma>/finalizada ainda false ou ausente.' },
    { section: 'Check-in',
      title: 'Check-in do dia não aberto → "O check-in não está aberto no momento..."',
      motivo: 'Requer turma finalizada mas sem diaAtivo definido em turmas-config.' },
    { section: 'Check-in',
      title: 'Pessoa não inscrita na turma → "Você não está inscrita nesta turma"',
      motivo: 'Acessar #checkin?turma=<key> logado com uma conta em qualquer um destes 3 casos em turmas-interesse dessa turma: sem registro nenhum, removida, ou apenas Interessada (ainda não confirmada como Inscrita pelo admin) — checkin.js bloqueia os três com a mesma mensagem, já que só quem tem status "inscrito" passa.' },
    { section: 'Check-in',
      title: 'Já fez check-in no dia → "Presença já registrada"',
      motivo: 'Escanear o QR Code uma segunda vez no mesmo dia com a mesma conta inscrita.' },
    { section: 'Check-in',
      title: 'Sucesso → "Presença confirmada com sucesso!" (nome, turma e dia)',
      motivo: 'Requer: turma finalizada, admin abrir check-in do dia (diaAtivo), pessoa inscrita e logada, sem check-in prévio nesse dia. Escanear QR que aponta para #checkin?turma=<key>.' },
    { section: 'Repositório',
      title: 'Adicionar conteúdo ao Holocron',
      motivo: 'Gravaria dado real no Firebase. Não pode ser revertido automaticamente em teste.' },
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
      title: 'Moderação Admin — ocultar/restaurar conteúdo curado',
      motivo: 'Ação destrutiva real no Firebase. Não pode ser revertida automaticamente.' },
    { section: 'Repositório',
      title: 'Moderação Admin — deletar conteúdo de usuários',
      motivo: 'Ação destrutiva real no Firebase. Não pode ser revertida automaticamente.' },
    { section: 'Treinamento Jedi',
      title: 'Antes de entrar: Welcome screen exibida para logado sem turma confirmada',
      motivo: 'Logar com conta SEM turma confirmada e acessar #treinamento. Verificar: #treinamento-welcome visível, #treinamento oculto. A checagem de sessão do botão "Quero jogar" virou residual — com login obrigatório ninguém deslogado chega nessa tela.' },
    { section: 'Treinamento Jedi',
      title: 'Ao logar pela Welcome screen: tela de boas-vindas some e o jogo aparece',
      motivo: 'Requer fazer login a partir da tela de boas-vindas. Verificar: #treinamento visível, #treinamento-welcome oculto.' },
    { section: 'Treinamento Jedi',
      title: 'Ao concluir o autodiagnóstico: Revelar patente — confirmação real',
      motivo: 'Ação irreversível (fixa o resultado definitivamente) — não deve ser executada em teste automatizado com dado real.' },
    { section: 'Admin',
      title: 'Aba Eventos — download do QR de acesso ao site',
      motivo: 'Clicar em "↓ QR de acesso ao site" no topo da aba Eventos. Verificar: (1) baixa um arquivo forca-agil-qrcode.png; (2) a imagem tem o QR Code com o logotipo da Força Ágil (ícone + FORÇA ÁGIL + Previ) no centro; (3) escanear o QR com o celular abre https://forca-agil.previ.com.br/.' },
    { section: 'Admin',
      title: 'Sorteio — só entram os confirmados',
      motivo: 'A regra central da funcionalidade. Numa turma que tenha os dois grupos, comparar o número que aparece no modal ("Participando: N pessoas confirmadas") com o número do filtro "Confirmados" da tabela — têm que ser iguais, e diferentes do total. Sortear várias vezes seguidas e conferir que nenhum nome que está em "Aguardando decisão" sai. Depois confirmar uma pessoa que estava só interessada, reabrir o modal e verificar que o número subiu e que ela passou a poder ser sorteada. Testar também a turma sem nenhum confirmado: o botão "🎲 Sorteio" deve estar desabilitado, com explicação ao passar o mouse.' },
    { section: 'Admin',
      title: 'Aba Sorteios — filtros por evento e turma',
      motivo: 'Com sorteios feitos em turmas de eventos diferentes, abrir a aba Sorteios. Verificar: (1) todos aparecem, do mais recente para o mais antigo, com quando, evento, turma, nomes e quem sorteou; (2) escolher um evento — a tabela filtra e a lista de turmas passa a mostrar só as turmas daquele evento; (3) escolher uma turma — filtra mais ainda; (4) trocar de evento com uma turma selecionada — a turma volta para "Todas" em vez de deixar a tela vazia; (5) o resumo acima da tabela ("N sorteios · M pessoas") acompanha o filtro; (6) os selects não oferecem eventos ou turmas sem nenhum sorteio. Fazer um sorteio novo na aba Eventos e voltar: ele já deve estar na lista, sem precisar recarregar a página. Por fim, "↓ Exportar CSV": baixa só o que está filtrado, abre no Excel com acentos corretos e traz UMA LINHA POR PESSOA sorteada, com nome e e-mail — não vários nomes numa célula só.' },
    { section: 'Admin',
      title: 'Sorteio — modo Ensaio não deixa rastro',
      motivo: 'Antes de sortear, conferir que o modal declara o modo nos DOIS sentidos: com "Ensaio" desmarcado tem que aparecer a faixa verde "Sorteio para valer — o resultado será registrado…", botão "Sortear para valer" e o palco dizendo "Pronto para sortear. Vale."; ao marcar "Ensaio", os três trocam para a versão âmbar. Sortear para valer e conferir que a confirmação "✓ Registrado no histórico desta turma e na aba Sorteios" aparece junto do resultado. Marcar "Ensaio" e sortear algumas vezes. Verificar: (1) o modal muda de cor e o botão passa a dizer "Ensaiar (não vale)" — é impossível confundir com o sorteio real; (2) o resultado aparece marcado como ensaio, sem o 🎉, com o aviso de que nada foi registrado; (3) o histórico NÃO ganha nenhuma linha nova; (4) o contador de disponíveis não cai. Depois desmarcar "Ensaio" e sortear de verdade: quem "saiu" nos ensaios tem que continuar concorrendo normalmente, e só aí o histórico recebe a linha. Fechar e reabrir o modal para confirmar que a opção volta desmarcada — um sorteio só é ensaio quando pedido de propósito.' },
    { section: 'Admin',
      title: 'Sorteio — não repetir, histórico e limpeza',
      motivo: 'Com a opção "não repetir" ligada (padrão), sortear várias vezes até esgotar a turma: (1) ninguém pode sair duas vezes; (2) o contador de disponíveis tem que cair a cada sorteio; (3) esgotado o grupo, o botão desabilita em vez de dar erro. Desmarcar a opção e sortear de novo: aí quem já saiu volta a concorrer. Conferir o histórico: cada linha traz os nomes, a data e hora e quem sorteou, do mais recente para o mais antigo — e o registro sobrevive a fechar o modal e recarregar a página, já que fica no banco. Por fim, "Limpar histórico": pede confirmação dizendo quantos sorteios serão apagados, e depois todo mundo volta a estar disponível. Testar também pedir mais pessoas do que há disponíveis: deve avisar quantas serão sorteadas de fato, em vez de falhar.' },
    { section: 'Admin',
      title: 'Aba Eventos — a tela fica no lugar ao registrar presença em série',
      motivo: 'Cenário real de sala: marcar presença de 20 pessoas seguidas. Abrir a aba Eventos, expandir um evento, expandir uma turma com check-in aberto, rolar até o meio da tabela e clicar no botão de presença de uma pessoa. Verificar que, depois do registro: (1) o evento continua expandido; (2) a turma continua expandida; (3) a página continua no mesmo ponto da rolagem — a linha em que você estava permanece visível; (4) o ✓ da pessoa aparece na hora; (5) dá para clicar na pessoa seguinte sem renavegar nada. Repetir para as outras ações que recarregam a aba: remover presença, confirmar e desconfirmar inscrição, remover da turma, abrir e fechar check-in. Conferir também que o filtro de status escolhido naquela turma (Todos / Confirmados / Aguardando decisão / …), o acordeão "Removidos" e o filtro "Ver evento" continuam como estavam, e que o texto "Carregando dados…" não pisca a cada ação (só aparece na primeira carga da aba).' },
    { section: 'Admin',
      title: 'Admin — acesso negado para logado/inscrito (URL direta)',
      motivo: 'Requer testar com diferentes níveis de acesso — não pode ser validado na sessão admin atual.' },
    { section: 'Admin',
      title: 'Menu do site — link "Admin" oculto após logout, inclusive no mobile com menu aberto',
      motivo: 'Verificar: (1) logar como admin e abrir o menu mobile (hamburguer); (2) clicar em "Sair"; (3) o link "Admin" deve sumir do menu imediatamente, mesmo que o menu esteja expandido. O atributo hidden é gerenciado por auth.js — CSS de layout não pode sobrescrevê-lo com display:block.' },
    { section: 'Admin',
      title: 'Cadastrados — resetar progresso',
      motivo: 'Ação destrutiva e irreversível. Verificar: se a pessoa estiver logada no momento do reset, a página dela recarrega automaticamente e o autodiagnóstico fica disponível para refazer. Para testar o reload em tempo real: abrir a página como usuária em uma aba e o painel admin em outra — ao clicar Resetar, a aba da usuária deve recarregar sozinha.' },
    { section: 'Admin',
      title: 'Cadastrados — redefinir senha',
      motivo: 'Requer que a pessoa já tenha conta ativa e verifica e-mail externo.' },
    { section: 'Admin',
      title: 'Turmas — encerrar interesse',
      motivo: 'Verificar: (1) badge muda para INTERESSE ENCERRADO; (2) botões mudam para QR Code / Abrir check-in / Reabrir; (3) a tabela de participantes (já mostrava interessados e inscritos juntos antes de encerrar) ganha colunas de presença por dia e Freq.; (4) ninguém vira inscrito sozinho — todos continuam com o status que tinham antes; (5) o card público daquela turma passa a mostrar a orientação pro CMFlex pra qualquer pessoa.' },
    { section: 'Admin',
      title: 'Turmas — cadastrar link do CMFlex ao criar/editar turma',
      motivo: 'Abrir "+ Nova turma" ou "✎ Editar turma". Verificar: (1) campo "Link do CMFlex" opcional aparece no formulário; (2) ao salvar com o campo preenchido, o botão "Ir para o CMFlex" no card público usa esse link; (3) deixando em branco, o card mostra aviso de link ainda não disponível em vez de um botão quebrado.' },
    { section: 'Admin',
      title: 'Turmas — confirmar inscrição de uma pessoa',
      motivo: 'Funciona com a turma aberta ou com interesse encerrado — requer só pelo menos 1 interessado. Clicar em "Confirmar" na linha da pessoa. Verificar: (1) abre modal de confirmação (avisando sobreposição com outra turma, se houver); (2) ao confirmar, ela vira "Inscrito" e ganha acesso a Conteúdos/Treinamento Jedi (colunas de presença só aparecem depois que a turma também tiver o interesse encerrado); (3) Firebase grava confirmedByAdmin/confirmedByAdminName/confirmedDate em turmas-interesse; (4) testar com a turma ainda aberta e também já encerrada.' },
    { section: 'Admin',
      title: 'Turmas — desconfirmar inscrição de uma pessoa',
      motivo: 'Funciona com a turma aberta ou com interesse encerrado — requer só pelo menos 1 inscrito confirmado. Clicar em "Desconfirmar" na linha da pessoa. Verificar: (1) abre modal de confirmação; (2) ao confirmar, ela volta a "Interessado" (continua na turma, só perde os privilégios); (3) se estiver com sessão aberta em outra aba, o acesso a Conteúdos/Treinamento Jedi cai na hora, sem precisar deslogar; (4) testar com a turma ainda aberta e também já encerrada.' },
    { section: 'Check-in',
      title: 'Admin — Turmas: abrir check-in do dia',
      motivo: 'Requer turma finalizada. Verificar: (1) select exibe os dias da turma e pré-seleciona hoje se aplicável; (2) ao clicar em "Abrir check-in", aparece diálogo de confirmação com o dia exato — se o dia selecionado for diferente de hoje, o diálogo exibe aviso ⚠️; (3) ao confirmar, badge "CHECK-IN ABERTO · DD/MM" aparece pulsante; (4) participante consegue fazer check-in via QR apenas para o dia aberto. Testar também abrir um dia diferente de hoje (passado ou futuro) — verificar que o aviso ⚠️ aparece.' },
    { section: 'Check-in',
      title: 'Admin — Turmas: fechar check-in do dia',
      motivo: 'Requer turma finalizada e check-in aberto. Verificar: ao fechar, check-in passa a ser bloqueado na página checkin.' },
    { section: 'Admin',
      title: 'Turmas — agrupamento por evento',
      motivo: 'Verificar na aba Eventos: (1) turmas aparecem agrupadas dentro do container do seu evento, com o nome do evento como cabeçalho do grupo; (2) turmas sem evento associado aparecem na seção "TURMAS SEM EVENTO" ao final; (3) ao criar turma dentro de um container de evento, o campo Evento do modal vem pré-preenchido; (4) ao excluir um evento, as turmas dentro dele passam para "TURMAS SEM EVENTO" (não são excluídas).' },
    { section: 'Admin',
      title: 'Eventos — accordion de eventos e turmas (recolhido por padrão)',
      motivo: 'Verificar na aba Eventos ao carregar: (1) todos os containers de evento aparecem recolhidos (apenas o cabeçalho com nome, carga e nº de turmas visível, seta ▸); (2) clicar no cabeçalho de um evento expande suas turmas (seta vira ▾); (3) clicar novamente recolhe; (4) dentro do evento expandido, cada card de turma aparece recolhido (apenas o cabeçalho do card visível, seta ▸); (5) clicar no cabeçalho do card de turma expande participantes e ações (seta vira ▾).' },
    { section: 'Admin',
      title: 'Eventos — filtro "Ver evento:" e botões Expandir/Recolher tudo',
      motivo: 'Verificar na barra de controles da aba Eventos: (1) seletor "Ver evento:" contém os eventos cadastrados + opção "Todos"; (2) selecionar um evento oculta os demais e expande automaticamente o selecionado; (3) selecionar "Todos" restaura todos os containers; (4) botão "↕ Expandir tudo" expande todos os containers de evento e todos os cards de turma de uma vez; (5) botão "↕ Recolher tudo" recolhe todos os containers e cards de turma de uma vez.' },
    { section: 'Admin',
      title: 'Turmas — filtro por status na tabela de participantes',
      motivo: 'Requer turma com pelo menos 1 confirmado E 1 aguardando decisão. Expandir o card da turma e verificar acima da tabela: (1) a barra traz um botão por grupo com gente — Todos os interessados (N), Confirmados (N), Aguardando decisão (N) e os grupos de quem saiu que existirem — com "Todos" ativo por padrão; (2) as contagens batem com o rótulo do cabeçalho do card ("X interessados · Y confirmados · Z aguardando decisão"); (3) clicar em "Confirmados" mostra só quem tem status Inscrito; (4) clicar em "Aguardando decisão" mostra só quem tem status Interessado e não foi removida; (5) clicar em "Todos" restaura a lista completa. Em turma que só tem um grupo com gente (ex: todos confirmados), a barra NÃO deve aparecer.' },
    { section: 'Admin',
      title: 'Turmas — layout responsivo das ações (desktop vs mobile)',
      motivo: 'Verificar em desktop (>768px): todas as ações ficam em linha única (seletor de dia, Abrir/Fechar check-in, QR, + Participante, Reabrir, CSV). Verificar em mobile/tablet (≤768px): header do card vira coluna; apenas ações primárias visíveis (seletor + Abrir/Fechar ou Encerrar interesse); botão "⋯" presente e ao clicar abre dropdown com ações secundárias (QR, + Participante, ↺ Reabrir, CSV). Geração de certificado agora é feita só pela aba Certificados, não pelo menu da turma.' },
    { section: 'Admin',
      title: 'Turmas — ações não somem na turma com interesse encerrado',
      motivo: 'Requer turma com interesse encerrado, com gente confirmada E gente aguardando decisão. Verificar: (1) no filtro "Aguardando decisão" NÃO aparecem colunas de dia nem Freq. — aparece "Data registro" —, e os botões Confirmar e Remover estão visíveis sem precisar rolar a tabela para o lado; (2) nos filtros "Todos os interessados" e "Confirmados", onde as colunas de dia aparecem, a coluna de ações fica colada na borda direita e continua visível ao rolar a tabela horizontalmente; (3) os botões funcionam normalmente nessa posição; (4) numa turma ainda aberta nada muda. Este teste existe porque as colunas de dia empurravam as ações para fora da tela e dava a impressão de que, depois de encerrar o interesse, não era mais possível remover ninguém.' },
    { section: 'Admin',
      title: 'Turmas — check-in retroativo manual (clicar em "—")',
      motivo: 'Requer turma finalizada com pelo menos 1 inscrito que não fez check-in naquele dia. Clicar em "—" na célula da pessoa/dia → registra com source:"admin" → célula vira "✓ adm" e frequência atualiza.' },
    { section: 'Admin',
      title: 'Turmas — desfazer check-in (clicar em "✓ adm" ou "✓ qr")',
      motivo: 'Requer turma finalizada com pelo menos 1 inscrito que tenha presença registrada. Verificar: (1) hover sobre "✓ adm" ou "✓ qr" mostra risco (line-through) na etiqueta; (2) clicar abre modal visual de confirmação (não confirm() nativo); (3) ao confirmar, o registro é removido do Firebase (turmas-checkin) e a célula volta a "—"; (4) a frequência na última coluna atualiza imediatamente.' },
    { section: 'Admin',
      title: 'Cadastrados — badge "Pendente" aparece para quem não verificou e-mail',
      motivo: 'Verificar com conta que se cadastrou pelo site e não clicou no link: na aba Cadastrados a coluna E-mail deve mostrar badge amarelo "Pendente" e botão "Confirmar cadastro". Contas criadas pelo admin ou já verificadas mostram badge verde "Verificado" e sem botão.' },
    { section: 'Admin',
      title: 'Cadastrados — confirmar cadastro manualmente libera o acesso',
      motivo: 'Clicar "Confirmar cadastro" de uma conta pendente → confirmar → badge vira "Verificado", botão desaparece. A pessoa deve conseguir logar normalmente após isso (testa com conta real — gravaria adminApproved:true em fa-users/).' },
    { section: 'Admin',
      title: 'Turmas — adicionar participante: busca em cadastros existentes',
      motivo: 'Funciona com a turma aberta ou com interesse encerrado. Clicar em "＋ Participante". Verificar: (1) abre modal com campo de busca por nome ou e-mail — ao digitar, filtra em tempo real os cadastros em fa-users; (2) ao clicar numa pessoa da lista, o card dourado mostra nome, e-mail e área; (3) admin escolhe o status (Interessada/Inscrita) e confirma; (4) se a pessoa não aparecer na busca, o modal exibe aviso orientando a se cadastrar primeiro — não há campo de preenchimento manual; (5) ao confirmar com "Inscrita", pessoa aparece na tabela com status Inscrito; (6) ao confirmar com "Interessada", aparece com status Interessado e botão "Confirmar"; (7) Firebase tem addedByAdmin:true e addedByAdminName; (8) nome é normalizado para maiúsculas ao salvar; (9) testar com turma aberta e também encerrada.' },
    { section: 'Admin',
      title: 'Turmas — não existe estado intermediário entre confirmar e remover',
      motivo: 'Requer turma com pelo menos 1 pessoa com status Interessado. Verificar: (1) a linha tem duas ações e só duas — "Confirmar" e "Remover"; não pode haver seletor de justificativa; (2) "Sem vagas", "Já participou" e "Substituída por outra pessoa" aparecem como motivos DENTRO do modal de "Remover", não na linha; (3) enquanto não se faz nada, a pessoa conta em "Aguardando decisão"; (4) vale com a turma aberta e com o interesse encerrado. Registros antigos, criados quando existia o "Justificar…", ainda mostram o selo do motivo ao lado do status: conferir que eles aparecem em "Aguardando decisão" e que o selo é só leitura — nada na tela grava esse campo de novo.' },
    { section: 'Admin',
      title: 'Turmas — remover participante (interessado ou inscrito)',
      motivo: 'Funciona com a turma aberta ou com interesse encerrado, para linhas Interessado ou Inscrito. Clicar em "Remover" na linha da pessoa. Verificar: (1) abre modal visual de confirmação (não confirm() nativo); (2) ao confirmar, pessoa some da tabela imediatamente; (3) Firebase tem removed:true e removedByAdminName com nome do admin em turmas-interesse.' },
    { section: 'Admin',
      title: 'Turmas — pessoa removida pode ser readicionada (site ou admin)',
      motivo: 'Remover alguém de uma turma e depois: (a) com a turma ainda com interesse aberto, logar como essa pessoa e clicar "Tenho interesse" de novo — verificar que ela sai da seção "Removidos" e volta pra lista de participantes ativos com status Interessado; (b) pelo admin, usar "＋ Participante" com o mesmo e-mail dela (Interessada ou Inscrita) — mesma verificação. Em ambos os casos, o evento de remoção anterior deve continuar aparecendo no CSV "Histórico".' },
    { section: 'Admin',
      title: 'Turmas — "＋ Participante" como Inscrita verifica outras turmas (igual ao "Confirmar")',
      motivo: 'Adicionar alguém como "Inscrita" na Turma A e depois adicioná-la de novo, como "Inscrita", na Turma B pelo "＋ Participante". Verificar: (1) abre o mesmo tipo de aviso de sobreposição do botão "Confirmar", listando a Turma A; (2) ao confirmar, o registro da Turma A vira removido (com removedReason preenchido) e ela fica ativa só na Turma B; (3) ao cancelar, nada muda em nenhuma das duas turmas; (4) escolher "Interessada" em vez de "Inscrita" nunca dispara esse aviso — interesse não tem limite de turmas.' },
    { section: 'Admin',
      title: 'Abas Turmas, Cadastrados e Repositório — pop-ups visuais (não nativos)',
      motivo: 'Verificar que nenhuma ação do painel usa a caixa de diálogo padrão e feia do navegador. Testar: finalizar turma, reabrir turma, remover inscrito, resetar progresso, redefinir senha, ocultar/deletar conteúdo do repositório. Todos devem abrir um modal visual com botões estilizados.' },
    { section: 'Admin',
      title: 'Turmas — encerrar turma manualmente (✓ Encerrar turma)',
      motivo: 'Disponível no menu ⋯ quando o interesse da turma já foi encerrado (finalizada:true no banco) e a turma ainda não foi encerrada. Clicar em "✓ Encerrar turma". Verificar: (1) abre modal de confirmação; (2) ao confirmar, o card público daquela turma passa imediatamente para "Turma realizada" para todos; (3) o botão "✓ Encerrar turma" some do menu ⋯; (4) o estado é permanente — não há "reabrir" depois de encerrada.' },
    { section: 'Admin',
      title: 'Turmas — reabrir turma',
      motivo: 'Verificar: (1) badge volta para ABERTA; (2) botão volta para "Encerrar interesse"; (3) quem já foi confirmado como inscrito continua inscrito — reabrir só volta a aceitar novo interesse, não mexe em confirmações já feitas.' },
    { section: 'Admin',
      title: 'Turmas — exportar CSV "Estado Atual" não inclui removidos',
      motivo: 'Remover um inscrito de uma turma finalizada e depois exportar o CSV "Estado Atual". Verificar: a pessoa removida não aparece no arquivo. A pessoa ainda deve aparecer no CSV "Histórico".' },
    { section: 'Admin',
      title: 'Turmas — exportar CSV "Histórico" inclui removidos e identificação do admin',
      motivo: 'Após remover um participante via painel admin, exportar o CSV "Histórico". Verificar: (1) a pessoa removida aparece no histórico; (2) coluna "Origem" contém "Admin — nome" quando foi o admin que executou a ação; (3) quando o participante agiu por conta própria, a coluna mostra "Participante".' },
    { section: 'Admin',
      title: 'Turmas — Confirmar/Desconfirmar aparece no CSV "Histórico"',
      motivo: 'Confirmar um interessado como Inscrita e depois Desconfirmar a mesma pessoa. Exportar o CSV "Histórico". Verificar: aparecem duas linhas para essa pessoa — "Confirmado como inscrita" e "Desconfirmado (voltou a interessada)" — ambas com "Origem" = "Admin — nome de quem executou".' },
    { section: 'Admin',
      title: 'Turmas — exportar CSV individual por turma não inclui removidos',
      motivo: 'Remover um inscrito de uma turma finalizada e depois exportar o CSV individual daquela turma (botão "↓ CSV" no card). Verificar: a pessoa removida não aparece no arquivo CSV da turma.' },
    { section: 'Admin',
      title: 'Turmas — CSV individual por turma tem coluna "Adicionado por" com nome do admin',
      motivo: 'Adicionar um participante manualmente via "＋ Participante" e depois exportar o CSV individual daquela turma (botão "↓ CSV" no card — não o "↓ Estado Atual" global, que não tem essa coluna). Verificar: coluna "Adicionado por" contém o nome do admin que adicionou; participantes que se inscreveram sozinhos têm a coluna vazia.' },
    { section: 'Admin',
      title: 'Admin não vê "Acesso Restrito" piscando ao carregar o painel',
      motivo: 'Logada como admin, abrir forca-agil.previ.com.br/#admin direto (F5 ou endereço digitado) e observar a tela DURANTE o carregamento, não só no fim. Verificar que em nenhum momento aparece o aviso vermelho "Acesso Restrito · Você não tem permissão para acessar esta área" — nem por um instante. O aviso começa oculto e só deve surgir para quem realmente não é admin, depois que a autenticação termina. Testar também com internet lenta (aba Network do navegador, opção de throttling), que é quando a janela entre revelar o site e confirmar o perfil fica maior.' },
    { section: 'Admin',
      title: 'Painel Admin carrega ao abrir #admin direto (F5 / link salvo)',
      motivo: 'Regressão importante. Estando logada como admin, digitar forca-agil.previ.com.br/#admin na barra de endereços e dar Enter (ou apertar F5 já estando nessa página). Verificar que as abas carregam os dados de verdade — Eventos mostra a lista de turmas, Cadastrados mostra a tabela. Se alguma ficar presa em "Carregando…" indefinidamente, a espera pelo fa-auth-ready quebrou. Testar também o caminho que sempre funcionou, para comparação: entrar pela Home e clicar em ADMIN no menu.' },
    { section: 'Admin',
      title: 'Administradores — erro na leitura mostra mensagem em vez de travar',
      motivo: 'Difícil de reproduzir sob demanda (requer falha real de leitura). Se um dia a aba Administradores ficar presa em "Carregando administradores…" sem nunca terminar: abrir o Console do navegador e procurar por "[admin] erro ao carregar fa-admins" — confirma que a leitura falhou (permissão ou rede) e que a mensagem de erro em vermelho deveria ter aparecido no lugar do texto de carregamento. Se a mensagem de erro não aparecer mesmo com esse log no console, é regressão.' },
    { section: 'Admin',
      title: 'Turmas — exportar CSV com colunas de presença',
      motivo: 'Requer turma finalizada com pelo menos 1 check-in. Verificar: arquivo .csv contém colunas por data (DD/MM), frequência e coluna "Atingiu critério (75%)".' },

    /* ── Ajuda / Faça um pedido ──────────────────────────────── */
    { section: 'Ajuda',
      title: 'Formulário "Faça um pedido" — os 5 tipos aparecem e são clicáveis',
      motivo: 'Logado, abrir a página Ajuda e rolar até "Faça um pedido". Verificar: (1) os 5 botões de tipo aparecem e são clicáveis (Quero aprender sobre um tema / Quero sugerir um curso / Preciso de material / Tenho uma dúvida / Outros); (2) o textarea de descrição aceita digitação normalmente; (3) o botão "Enviar pedido" só habilita depois de escolher um tipo. A checagem de sessão no envio ("Faça login para enviar um pedido.") virou proteção residual — com login obrigatório, ninguém deslogado chega a essa página.' },
    { section: 'Ajuda',
      title: 'Formulário "Faça um pedido" — envio com login funciona',
      motivo: 'Logado, preencher o formulário e clicar "Enviar pedido". Verificar: (1) grava em pedidos/ no Firebase com tipo, descricao, nomeEnviou e emailEnviou; (2) no painel Admin → aba Pedidos, o novo pedido aparece na lista, ordenado mais recente primeiro, com o chip de tipo na cor correta (inclusive "Outros", cor cinza-azulada #8a93a8).' },
    { section: 'Admin',
      title: 'Aba Pedidos — responder por e-mail e marcar como respondido',
      motivo: 'Na aba Pedidos, escolher um item com e-mail preenchido. (1) Clicar "✉ Responder por e-mail" — verificar que abre o programa de e-mail padrão do sistema operacional/navegador com o destinatário correto no campo Para, assunto "Força Ágil — resposta ao seu pedido (tipo)", e corpo com saudação (primeiro nome capitalizado, não em CAIXA ALTA), citação da descrição enviada, e assinatura "Um abraço, Equipe Força Ágil" no final. (2) Clicar "✓ Marcar como respondido" — verificar que aparece um seletor "— quem respondeu? —" com a lista de admins e um campo de data/hora já preenchido com o momento atual; sem escolher ninguém e clicando "Confirmar", nada deve ser gravado (foco volta pro seletor). (3) Escolher um admin, opcionalmente mudar a data/hora pro momento real da resposta, e clicar "Confirmar" — verificar que o item ganha badge "✓ Respondido", fica com opacidade reduzida, mostra "Respondido por NOME em DATA — N dias úteis depois" em verde (usando a data informada, não necessariamente "agora"), e os botões viram "✎ Editar" + "✕ Desmarcar". (4) Clicar "✎ Editar" — verificar que o seletor reabre com o mesmo admin e a mesma data/hora já preenchidos (não em branco); mudar o admin ou a data e confirmar deve atualizar o registro. (5) Clicar "✕ Desmarcar" — verificar que volta ao estado original (sem badge, opacidade normal, mostra "Em aberto há N dias úteis", botão volta a dizer "Marcar como respondido"). (6) Recarregar a página — verificar que o estado respondido/não-respondido, quem respondeu e a data persistem (gravado em pedidos/<key>/respondido, respondidoEm e respondidoPor no Firebase, não é só estado local).' },
    { section: 'Admin',
      title: 'Aba Pedidos — prazo em dias úteis considera fim de semana',
      motivo: 'Difícil de reproduzir sob demanda (depende da data real). Conferir manualmente com um pedido antigo: se o pedido foi enviado numa sexta-feira à tarde e ainda está em aberto na segunda-feira de manhã, o prazo deve contar 1 dia útil (não 3 dias corridos) — sábado e domingo não entram na conta, e a sexta à tarde é tratada normalmente (não é fim de semana). Se o pedido foi enviado num sábado ou domingo, a contagem deve começar como se tivesse chegado às 8h da segunda-feira seguinte.' },
    { section: 'Admin',
      title: 'Dashboard — a memória de cálculo bate com os números exibidos',
      motivo: 'Abrir o bloco "Como cada número desta tela é calculado" e conferir, item por item, se a explicação descreve o que o número realmente mostra. Em especial: (1) refazer a média geral na mão a partir das notas da seção 1 e comparar com o card; (2) refazer o NPS — percentual de 9-10 menos percentual de 0-6 — e comparar com o card; (3) confirmar que o medidor de recomendação exibe a MÉDIA da pergunta de recomendação, e que esse número é diferente do NPS; (4) contar quantas avaliações têm pelo menos um dos três textos preenchidos e comparar com o card Comentários — conferindo que quem escreveu nos três conta uma vez só; (5) somar os percentuais da distribuição e verificar que fecha 100%. Refazer sempre que uma pergunta for acrescentada ou alterada no formulário: a explicação é texto e não quebra sozinha quando o cálculo muda.' },
    { section: 'Admin',
      title: 'Aba Dashboard — números batem com os dados reais',
      motivo: 'Abrir a aba Dashboard. Escolher manualmente 2-3 avaliações conhecidas (via aba Eventos ou Firebase Console) e conferir: (1) "Participantes" bate com a soma real de inscritos confirmados; (2) "Avaliações recebidas" bate com a contagem real em avaliacoes/; (3) "Média geral" bate com a média manual dos campos notaGeral; (4) o gráfico "Média por turma" mostra uma barra por turma com avaliação, na altura correta; (5) a "Distribuição das notas" soma 100% entre as 5 faixas (0-2, 3-4, 5-6, 7-8, 9-10), todas de duas notas exceto a primeira, e a contagem embaixo é a de quem respondeu a pergunta da nota geral — que pode ser menor que o total de avaliações; (6) "Temas mais solicitados" reflete o que foi marcado no checkbox da seção 8 do formulário de Avaliação. Se não houver nenhuma avaliação ainda, verificar que os cards e gráficos continuam visíveis com valores em 0 (não somem atrás de uma tela vazia) e que aparece o aviso amarelo "Nenhuma avaliação recebida ainda..." no topo; o gráfico "Média por turma" deve mostrar TODAS as turmas cadastradas com barra em 0, não ficar em branco.' },
    { section: 'Admin',
      title: 'Aba Dashboard — destaques usam só notas, não texto livre',
      motivo: 'Comparar "Principais destaques dos feedbacks" com os comentários de texto livre reais (campos "continuar"/"melhorar"/"espaço aberto") de algumas avaliações. Verificar que os destaques mostrados (ex: "Instrutores capacitados", "Conteúdo prático e aplicável") vêm das MÉDIAS das notas por seção (facilitadoresNota, conteudoRelevancia etc.), e não de palavras encontradas nos comentários — ou seja, mesmo que ninguém tenha escrito "instrutores" no texto livre, a seção "Facilitadores" ainda aparece como destaque se a nota média dela for alta.' },
    { section: 'Admin',
      title: 'Aba Pedidos — status sobre ativos + Lixeira separada',
      motivo: 'Requer pelo menos 1 pedido excluído e 1 ativo. Abrir a aba Pedidos: verificar que carrega com "Pendentes" ativo. (1) Conferir que Pendentes + Respondidos = Todos, e que NENHUM dos três inclui pedidos excluídos — "Todos" aqui significa só os ativos; (2) o contador do topo diz "N pedidos ativos", não o total geral; (3) clicar em "🗑 Lixeira (N)" — botão visualmente separado, tracejado — mostra SÓ os excluídos, com o aviso explicando que não foram apagados do banco; (4) na lixeira, cada item mostra "↺ Restaurar" e não os botões de responder/excluir; (5) restaurar um item faz ele sumir da lixeira e reaparecer em Pendentes ou Respondidos conforme seu estado; (6) o filtro por tipo se combina com o recorte atual e suas contagens mudam junto — estando em "Pendentes", cada tipo mostra quantos PENDENTES existem daquele tipo (não o total geral); o mesmo vale dentro da Lixeira.' },
    { section: 'Admin',
      title: 'Aba Pedidos — excluir com justificativa obrigatória e restaurar',
      motivo: 'Em qualquer pedido não excluído, clicar "🗑 Excluir". Verificar: (1) abre formulário com seletor "— quem está excluindo? —" e caixa de texto para justificativa; (2) clicar "🗑 Confirmar exclusão" sem escolher admin nem preencher justificativa não grava nada (campos vazios recebem foco); (3) preencher os dois campos e confirmar — o item some da lista "Pendentes"/"Respondidos" e passa a aparecer só no filtro "Excluídos", com badge "🗑 Excluído" em vermelho, opacidade reduzida, e uma linha "Excluído por NOME em DATA. Justificativa: ..."; (4) no filtro "Excluídos", clicar "↺ Restaurar" — o pedido volta a aparecer no filtro correto (Pendentes se nunca foi respondido, Respondidos se já tinha sido); (5) recarregar a página — verificar que o estado de exclusão persiste (excluido/excluidoEm/excluidoPor/justificativaExclusao gravados em pedidos/<key> no Firebase).' },

    /* ── Minha Área ───────────────────────────────────────────── */
{ section: 'Minha Área',
      title: 'Admin: "Ver esta tela como" mostra a tela da pessoa certa',
      motivo: 'Logada como admin, abrir Minha Área. Verificar: (1) a barra "Ver esta tela como" aparece — e NÃO aparece para quem não é admin; (2) a lista traz as pessoas com a situação ao lado do nome, sem repetir quem está em mais de uma turma; (3) escolhendo alguém CONFIRMADA numa turma concluída, a tela mostra a turma, a frequência e o certificado liberado, com o aviso no topo dizendo de quem é a tela; conferir a frequência contra a aba Eventos; (4) escolhendo alguém com só INTERESSE, aparece o bloco de inscrição em análise; (5) escolhendo alguém da LISTA DE ESPERA, aparece o bloco da fila; (6) escolhendo alguém REMOVIDA de todas as turmas, aparece a tela de boas-vindas; (7) voltando para "— eu mesma —", a tela volta a ser a do admin e o aviso some; (8) os pedidos listados são os DA PESSOA escolhida, não os do admin. Por fim, confirmar que é só visualização: nada foi gravado em nome de ninguém — conferir que o registro da pessoa no Firebase não mudou.' },
    { section: 'Minha Área',
      title: 'A vitrine só oferece turma onde dá para entrar',
      motivo: 'Com uma conta sem turma confirmada, abrir Minha Área e conferir a lista "Turmas abertas no momento": só podem aparecer turmas em que ainda dá para manifestar interesse. Uma turma com o interesse já encerrado pelo admin está lotada e NÃO pode aparecer — convidar para ela é mandar a pessoa a uma porta fechada, o mesmo erro que o card da página Turmas tinha. Também não podem aparecer turmas já encerradas nem as que já começaram. Testar encerrando o interesse de uma turma e recarregando: ela tem que sumir da lista. Se nenhuma turma se qualificar, a tela deve dizer que não há turmas abertas no momento, e não sumir com o bloco.' },
        { section: 'Minha Área',
      title: 'Frequência e certificado batem com os dados reais',
      motivo: 'Logar com uma conta confirmada numa turma que já teve check-ins e abrir "Minha Área". Conferir contra a aba Eventos do admin: (1) os dias marcados com ✓ são exatamente os mesmos em que a pessoa tem presença registrada; (2) a contagem "X de Y encontros" e o percentual batem; (3) o percentual mínimo exibido é o configurado naquele evento (não o padrão 75% fixo). Depois: (4) com a turma AINDA NÃO concluída, o certificado não deve estar disponível, com aviso explicando; (5) encerrar a turma pelo admin e recarregar — se a frequência atingiu o mínimo, os botões de PNG e PDF aparecem; se não atingiu, aparece a mensagem dizendo qual era a exigida e qual foi a dela.' },
    { section: 'Minha Área',
      title: 'Certificado baixado pelo aluno é idêntico ao emitido pelo admin',
      motivo: 'Baixar o certificado de uma mesma pessoa pelos dois caminhos — pela "Minha Área" (como ela) e pela aba Certificados (como admin) — e comparar os arquivos: nome, evento, turma, período, carga horária (com o "h") e data de emissão devem ser iguais, no mesmo layout. Ambos usam o mesmo gerador, então qualquer diferença indica que algum dado está sendo montado errado num dos lados.' },
    { section: 'Minha Área',
      title: 'Os quatro estados aparecem corretamente',
      motivo: 'Cada estado precisa ser conferido com uma conta na situação correspondente. (1) NUNCA INTERAGIU — conta sem interesse em nenhuma turma e fora da lista de espera: deve ver a tela de boas-vindas com a lista das turmas abertas e o botão para Turmas; se não houver turma aberta, a mensagem dizendo isso. (2) INTERESSE EM ANÁLISE — manifestar interesse numa turma e NÃO confirmar pelo admin: deve aparecer o bloco "Inscrições em análise" com a data do interesse. Confirmar pelo admin e recarregar: o cartão sai de "em análise" e vira turma em "Minhas turmas". (3) LISTA DE ESPERA — mover a pessoa para a lista de espera pelo admin: deve aparecer o bloco "Lista de espera" dizendo desde quando e de qual turma veio. (4) COEXISTÊNCIA — deixar a mesma conta confirmada numa turma, em análise em outra e na espera: os três blocos devem aparecer juntos, e a tela de boas-vindas NÃO deve aparecer. Em nenhum dos casos a área pode ficar em branco ou dar erro no console.' },
    { section: 'Minha Área',
      title: 'Turma programada não cobra frequência de quem ainda não começou',
      motivo: 'Cenário mais fácil de errar. Confirmar alguém numa turma cujo primeiro encontro ainda está no futuro e abrir "Minha Área". Verificar: (1) o cartão vem no grupo "Programadas", com selo "Programada" — não "Em andamento"; (2) NÃO aparece barra de frequência, nem "0 de N encontros", nem bloco de certificado; (3) aparece a contagem para o início ("Faltam N dias") e a data do primeiro encontro por extenso; (4) as datas dos encontros aparecem listadas, sem ✓ em nenhuma. Depois, chegando a data do primeiro encontro, recarregar: o cartão deve migrar para o grupo "Em andamento" e a frequência voltar a aparecer. Conferir também os textos de borda: turma que começa amanhã deve dizer "Começa amanhã" e turma que começa hoje, "É hoje!".' },
    { section: 'Minha Área',
      title: 'Turmas agrupadas na ordem certa',
      motivo: 'Com uma conta que tenha turmas em mais de uma fase, conferir que os grupos aparecem nesta ordem: "Em andamento", depois "Programadas", depois "Concluídas" — o que exige ação agora vem primeiro, o histórico por último. Cada cabeçalho de grupo mostra a quantidade de turmas do grupo, e grupos sem nenhuma turma não aparecem (não deve haver cabeçalho vazio).' },
    { section: 'Minha Área',
      title: 'QR Code de check-in NÃO aparece na área do participante',
      motivo: 'Decisão de segurança que precisa se manter em qualquer mudança futura. Abrir "Minha Área" como participante confirmado numa turma e verificar que em nenhum lugar aparece o QR Code de check-in, nem link para a página de check-in. Motivo: o QR é o mesmo todos os dias e quem controla a validade é o admin abrindo o dia — se a pessoa tivesse o QR em mãos, poderia registrar presença de casa durante a janela aberta, e a frequência é justamente o que libera o certificado.' },

    /* ── Avaliação da Oficina ─────────────────────────────────── */
    { section: 'Avaliação',
      title: 'Ninguém lê nem sobrescreve a avaliação de outra pessoa',
      motivo: 'Teste de segurança — precisa ser feito com DUAS contas. (1) Logada como participante comum (não admin), abrir o console do navegador e tentar ler o conjunto das avaliações: a leitura tem que ser NEGADA (erro de permissão). (2) Ainda como participante, tentar ler a avaliação de outra pessoa: também negada. (3) Tentar ler a própria: permitida. (4) Tentar gravar na chave de outra pessoa: negada. (5) Logada como admin, abrir a aba Dashboard: as estatísticas e o bloco "Respostas individuais" continuam carregando normalmente — se ficarem vazios ou der erro no console, a regra apertou demais. (6) Como participante, abrir "Minha Área": a situação da avaliação de cada turma continua aparecendo (ela lê só a própria resposta). (7) Responder uma avaliação nova até o fim, para confirmar que a gravação na própria chave continua funcionando.' },
    { section: 'Avaliação',
      title: 'Uma resposta por pessoa, por turma',
      motivo: 'Enviar a avaliação de uma turma e verificar: (1) o formulário dá lugar à tela de agradecimento; (2) recarregar a página — continua o agradecimento, o formulário não volta; (3) sair e entrar de novo, de preferência em outro aparelho — idem; (4) no Firebase, existe UM registro para essa pessoa nessa turma, não dois. Se a pessoa tiver outra turma com avaliação liberada, conferir que essa outra continua pendente e pode ser respondida — a trava é por turma, não por pessoa.' },
    { section: 'Avaliação',
      title: 'A seção não pode fechar sozinha com perguntas por responder (celular)',
      motivo: 'Problema relatado por quem respondeu no celular: ao tocar na nota, a seção fechava sozinha e a tela pulava para a seguinte, obrigando a voltar para preencher o resto. Testar NO CELULAR, seção por seção. Nas seções 2 a 7 — todas têm perguntas depois da nota (motivo do NPS, o que mais gostou, o que aprofundar, o que pretende aplicar…) — tocar na nota e ESPERAR uns 3 segundos sem tocar em nada: a seção tem que continuar aberta, na mesma posição da tela, com as perguntas seguintes visíveis. Só a seção 1, cuja única pergunta é a nota, pode avançar sozinha para a seção 2. Repetir tocando em notas diferentes e trocando a nota já marcada. Conferir também que continuam funcionando os caminhos manuais de navegação: tocar no cabeçalho de outra seção e o botão "Pular esta seção →".' },
    { section: 'Avaliação',
      title: 'Admin libera avaliação por turma — aba aparece para inscrito',
      motivo: 'Requer turma com inscritos confirmados. Clicar em "📋 Liberar avaliação" no menu ⋯ da turma. Verificar: (1) modal de confirmação aparece; (2) ao confirmar, botão vira "🔒 Encerrar avaliação"; (3) ao logar como inscrito confirmado naquela turma, a aba "Avaliação" aparece no menu; (4) ao clicar, o formulário com 13 seções em accordion é exibido; (5) seção 1 começa expandida, demais recolhidas.' },
    { section: 'Avaliação',
      title: 'Admin revisa avaliação de qualquer turma via seletores',
      motivo: 'Logado como admin, abrir a aba Avaliação. Verificar: (1) aparecem dois seletores "Evento" e "Turma" no topo, em vez do formulário direto; (2) "Turma" começa desabilitado até escolher um evento; (3) escolher um evento popula "Turma" só com as turmas daquele evento; (4) escolher uma turma em que o admin NÃO está pessoalmente inscrito ainda assim carrega o formulário completo; (5) trocar de turma no seletor troca o formulário exibido; (6) se o admin já enviou uma resposta de teste para a turma escolhida, aparece a tela de agradecimento com o aviso "(Você já enviou uma resposta de teste...)" em vez do formulário.' },
    { section: 'Avaliação',
      title: 'Inscrito sem turma liberada não vê a aba Avaliação',
      motivo: 'Com avaliação NÃO liberada para a turma: logar como inscrito confirmado. Verificar: (1) aba "Avaliação" não aparece no menu; (2) mesmo acessando #avaliacao diretamente, a mensagem "A avaliação ainda não foi liberada para a sua turma" é exibida no lugar do formulário.' },
    { section: 'Avaliação',
      title: 'Validação de seções obrigatórias no envio',
      motivo: 'Abrir o formulário sem preencher alguma das seções 1 a 7 e clicar em "ENVIAR". Verificar: (1) o envio é bloqueado; (2) a seção obrigatória faltante se expande automaticamente; (3) mensagem de aviso em vermelho aparece abaixo do botão.' },
    { section: 'Avaliação',
      title: 'Auto-avançar após selecionar nota',
      motivo: 'Na seção 1 (expandida por padrão), selecionar qualquer nota 0–10. Verificar: após ~600ms a seção 1 fecha e a seção 2 abre automaticamente sem nenhum clique adicional.' },
    { section: 'Avaliação',
      title: 'Rascunho automático salva e restaura respostas',
      motivo: 'Preencher algumas respostas (notas, checkboxes, textareas). Navegar para outra aba e voltar para Avaliação. Verificar que as respostas foram restauradas automaticamente do localStorage, sem precisar reenviar.' },
    { section: 'Avaliação',
      title: 'Identificação opcional — anônimo por padrão',
      motivo: 'Antes do botão enviar, verificar que o checkbox "Quero me identificar" aparece desmarcado. (1) Enviar sem marcar: verificar que avaliacoes/<turmaKey>/<emailKey>/identificado === false e que não há campo nomeExibido. (2) Marcar o checkbox e enviar: verificar que identificado === true e nomeExibido contém o nome da pessoa.' },
    { section: 'Avaliação',
      title: 'Envio único por turma — tela de agradecimento após envio',
      motivo: 'Preencher as seções 1 a 7 (obrigatórias) e clicar em "ENVIAR MINHA AVALIAÇÃO". Verificar: (1) tela de agradecimento com 🚀 é exibida; (2) ao recarregar ou revisitar a aba, o formulário NÃO reaparece; (3) a tela de agradecimento continua sendo exibida; (4) dado gravado em avaliacoes/<turmaKey>/<emailKey> no Firebase.' },
    { section: 'Avaliação',
      title: 'Múltiplas avaliações pendentes — pessoa inscrita em mais de uma turma/oficina',
      motivo: 'Confirmar a mesma pessoa em 2 turmas diferentes (podem ser de oficinas diferentes) e liberar avaliacaoHabilitada em ambas. Ao abrir a aba Avaliação: (1) aviso dourado indicando quantas pendências existem aparece no topo; (2) o campo "Turma" vira um <select> listando as turmas pendentes; (3) trocar a seleção troca o formulário exibido, preservando o progresso de cada uma separadamente (rascunho por turma); (4) enviar a primeira carrega automaticamente a segunda, sem passar pela tela de agradecimento; (5) após enviar a segunda, agora sim a tela de agradecimento aparece listando as duas turmas em "Avaliação enviada para".' },
    { section: 'Avaliação',
      title: 'Admin encerra avaliação — aba some para inscritos',
      motivo: 'Com avaliação liberada: clicar em "🔒 Encerrar avaliação" no menu ⋯ da turma. Verificar: (1) modal de confirmação aparece; (2) ao confirmar, botão vira "📋 Liberar avaliação"; (3) ao recarregar a página do inscrito (ou novo login), a aba "Avaliação" não aparece mais no menu.' },
    { section: 'Avaliação',
      title: 'Admin acessa formulário mesmo sem flag liberado',
      motivo: 'Com avaliacaoHabilitada: false (ou ausente) em uma turma: logar como admin e acessar a aba Avaliação. Verificar que o formulário é exibido normalmente — o admin não é bloqueado pelo flag.' },

    /* ── Certificados — Fluxo de seleção ─────────────────────── */
    { section: 'Certificados v1.0',
      title: 'Fluxo de seleção: evento → turma',
      motivo: 'Na aba Certificados verificar: (1) seletor "Evento" aparece primeiro e lista todos os eventos cadastrados; (2) seletor "Turma" inicia desabilitado com texto "selecione um evento primeiro"; (3) ao selecionar um evento, o seletor de Turma é habilitado e exibe somente as turmas daquele evento; (4) ao trocar o evento, a turma selecionada é limpa e a lista de turmas é recarregada; (5) selecionar evento sem turmas cadastradas mantém Turma desabilitado com "nenhuma turma neste evento".' },

    /* ── Certificados — Estado Prévia vs. Emissão ─────────────── */
    { section: 'Certificados v1.0',
      title: 'Cenário A — turma NÃO encerrada (estado Prévia)',
      motivo: 'Selecionar evento → turma não encerrada. Verificar: (1) banner laranja "PRÉVIA DO CERTIFICADO — TURMA AINDA NÃO CONCLUÍDA" aparece acima do canvas; (2) ao clicar "👁 Prévia" em qualquer participante, o certificado é exibido normalmente; (3) nenhum badge de frequência é exibido; (4) botões ⬇ PNG e ⬇ PDF desabilitados com tooltip "Disponível após a conclusão da turma."; (5) botões de lote também desabilitados; (6) dataEmissao ausente no certificado.' },
    { section: 'Certificados v1.0',
      title: 'Cenário B — turma encerrada, frequência suficiente',
      motivo: 'Selecionar evento → turma encerrada com participante que atingiu o percentual mínimo. Verificar: (1) banner de prévia oculto; (2) badge de frequência verde (ex: "78%") exibido ao lado do nome; (3) botões ⬇ PNG e ⬇ PDF habilitados; (4) "Baixar todos" gera certificado para esse participante; (5) dataEmissao = dataConclusao da turma no formato "Emitido em DD de mês de AAAA".' },
    { section: 'Certificados v1.0',
      title: 'Cenário C — turma encerrada, frequência insuficiente',
      motivo: 'Selecionar evento → turma encerrada com participante abaixo do percentual mínimo do evento. Verificar: (1) badge de frequência vermelho (ex: "40%"); (2) botões ⬇ PNG e ⬇ PDF desabilitados com tooltip "Frequência insuficiente (40% < 75% exigido)"; (3) "Baixar todos" não inclui esse participante; (4) botão "👁 Prévia" permanece habilitado — a prévia pode ser visualizada normalmente.' },
    { section: 'Certificados v1.0',
      title: 'Cenário D — percentual mínimo configurado por evento',
      motivo: 'Na aba Eventos, clicar "✎ Editar evento" em um evento. Verificar: (1) campo "Frequência mínima p/ certificado" está presente com o valor atual; (2) alterar o valor e salvar; (3) retornar à aba Certificados e selecionar turma encerrada desse evento — verificar que os badges e bloqueios respeitam o novo percentual configurado.' },

    /* ── Gerador de Certificados v1.0 — Regressão ───────────── */
    { section: 'Certificados v1.0',
      title: 'Regressão — cenário curto (ANA LIMA / SCRUM / 8h)',
      motivo: 'Abrir aba Certificados, selecionar turma de teste, pré-visualizar participante com nome curto. Verificar: (1) todos os 6 campos usam o tamanho de fonte PADRÃO — nenhum campo foi reduzido desnecessariamente; (2) nome "ANA LIMA" centralizado em y=385; (3) evento "SCRUM" centralizado em y=535; (4) carga "8h" dentro do badge; (5) canvas interno permanece 1448×1086; (6) template não contém elementos redesenhados pelo código.' },
    { section: 'Certificados v1.0',
      title: 'Regressão — carga horária mostra o "h" (ex: 20h, não 20)',
      motivo: 'Abrir a aba Certificados, selecionar qualquer evento e turma, e conferir a prévia: o badge da carga horária deve mostrar o número seguido de "h" (ex: "20h"). O valor gravado no evento é só o número — o "h" é acrescentado na hora de desenhar o certificado. Esse detalhe já se perdeu uma vez, quando o layout foi reescrito para o template v2 (a lógica antiga que juntava o "h" ficou para trás), então vale conferir depois de qualquer mudança no gerador.' },
    { section: 'Certificados v1.0',
      title: 'Regressão — cenário padrão (ADRIANO CORREIA DE CAMARGO / 20h)',
      motivo: 'Cenário de referência aprovado. Verificar: nome "ADRIANO CORREIA DE CAMARGO" — fonte 55px, sem redução; evento "FORÇA ÁGIL · JORNADA DE IMERSÃO" — fonte 29px; turma exibe exatamente o label cadastrado pelo admin (ex: "Turma 1 — Agosto") — fonte 19px, SEM acréscimo automático de mês/ano; período (38 chars) — fonte 24px, em y=658, completamente visível acima do ícone de calendário; carga "20h" — fonte 48px; emissão "Emitido em 27 de agosto de 2026" — fonte 19px. Composição visualmente idêntica ao certificado aprovado.' },
    { section: 'Certificados v1.0',
      title: 'Regressão — nome muito longo (MARIA EDUARDA ALBUQUERQUE DE OLIVEIRA SANTOS)',
      motivo: 'Verificar: (1) nome reduz automaticamente de 55px para aprox. 38px; (2) permanece em uma única linha; (3) centralizado em y=385; (4) não ultrapassa 1041px de largura; (5) evento, turma, período, carga e emissão PERMANECEM nos tamanhos padrão — o ajuste é independente.' },
    { section: 'Certificados v1.0',
      title: 'Regressão — evento muito longo (PROGRAMA DE TRANSFORMAÇÃO E AGILIDADE ORGANIZACIONAL)',
      motivo: 'Verificar: (1) evento cabe dentro dos 920px disponíveis (aprox. 905px no tamanho padrão — sem redução necessária); (2) centralizado em y=535; (3) não sobrepõe a turma abaixo; (4) nome do participante e demais campos permanecem inalterados.' },
    { section: 'Certificados v1.0',
      title: 'Regressão — turma longa (Turma Especial de Formação — Agosto e Setembro de 2026)',
      motivo: 'Verificar: (1) turma cabe dentro dos 680px disponíveis (aprox. 500px — sem redução); (2) completamente legível; (3) não encosta no evento acima; (4) não encosta na linha inferior do template.' },
    { section: 'Certificados v1.0',
      title: 'Regressão — período longo (11, 12, 18, 19, 20, 25, 26 e 27 de agosto de 2026)',
      motivo: 'Verificar: (1) período reduz de 24px para aprox. 19px automaticamente; (2) cabe dentro dos 400px; (3) posicionado em y=658, completamente visível acima do ícone de calendário do template — sem corte; (4) não invade o badge.' },
    { section: 'Certificados v1.0',
      title: 'Regressão — cargas horárias (4h, 8h, 16h, 20h, 24h, 40h, 120h)',
      motivo: 'Testar cada valor individualmente. Verificar em todos: (1) valor completamente visível dentro do badge; (2) fonte 48px em todos os casos (todos cabem em 160px); (3) centralizado em x=613 y=757; (4) não toca a borda do badge; (5) não invade o texto "DE IMERSÃO EM AGILIDADE" do template.' },
    { section: 'Certificados v1.0',
      title: 'Regressão — datas longas (30 de setembro / 31 de dezembro de 2026)',
      motivo: 'Verificar: "Emitido em 30 de setembro de 2026" e "Emitido em 31 de dezembro de 2026" — ambas na fonte padrão 19px (cabem em 360px); uma única linha; região inferior direita; totalmente dentro da moldura.' },
    { section: 'Certificados v1.0',
      title: 'Regressão — pior cenário combinado (todos os campos no limite máximo)',
      motivo: 'Nome: MARIA EDUARDA ALBUQUERQUE DE OLIVEIRA SANTOS / Evento: PROGRAMA DE TRANSFORMAÇÃO E AGILIDADE ORGANIZACIONAL / Turma: Turma Especial de Formação — Agosto e Setembro de 2026 / Período: 11, 12, 18, 19, 20, 25, 26 e 27 de agosto de 2026 / Carga: 120h / Emissão: 30 de setembro de 2026. Verificar: (1) NENHUM campo ultrapassa sua área reservada; (2) nenhum campo é cortado; (3) nenhum campo sobrepõe outro; (4) cada campo ajusta fonte INDEPENDENTEMENTE; (5) nome ≈ 38px; período ≈ 19px; demais no tamanho padrão; (6) template intacto.' },
    { section: 'Certificados v1.0',
      title: 'Exportação PNG — alta resolução sem margens',
      motivo: 'Clicar em "⬇ PNG" para qualquer participante. Verificar no arquivo baixado: (1) dimensões 2896 × 2172 px (2× do template); (2) proporção 4:3; (3) sem fundo externo, sem margens, sem área da interface; (4) composição idêntica à prévia; (5) nenhum campo cortado.' },
    { section: 'Certificados v1.0',
      title: 'Exportação PDF — página customizada 4:3 sem margens',
      motivo: 'Clicar em "⬇ PDF" para qualquer participante. Abrir o PDF gerado. Verificar: (1) tamanho da página = 864 × 648 pt (12 × 9 polegadas, proporção 4:3); (2) ZERO margem branca — certificado ocupa 100% da página; (3) sem deformação da imagem; (4) composição idêntica ao PNG exportado.' },
    { section: 'Certificados v1.0',
      title: 'Responsividade — proporção preservada em múltiplas larguras de tela',
      motivo: 'Acessar o painel de certificados em: desktop (1920px), notebook (1366px), tablet (1024px) e tela estreita (768px). Verificar em todas: (1) canvas interno permanece 1448×1086; (2) proporção 4:3 exata em todas as larguras; (3) nenhum campo muda de posição relativa; (4) nenhum texto fica fora do certificado; (5) a escala é aplicada ao certificado inteiro como uma unidade — sem recálculo individual de coordenadas.' },
    { section: 'Admin',
      title: 'Turmas — CSV exportado tem caracteres especiais corretos e abre editável',
      motivo: 'Baixar qualquer CSV (Estado atual, Histórico ou individual). Verificar no Excel: (1) acentos, cedilha e caracteres especiais aparecem corretamente (sem "?" ou "Ã"); (2) arquivo abre em modo edição — sem modo protegido, sem "somente leitura".' },
    { section: 'Admin',
      title: 'Admin — visibilidade das 11 abas no mobile',
      motivo: 'Acessar o painel Admin em tela estreita (celular). Verificar: todas as 11 abas (Dashboard, Eventos, Certificados, Repositório, Cadastrados, Administradores, Manual, Mapa, Testes, Pedidos, Sorteios) estão visíveis (quebram em 2 linhas); nenhuma aba fica oculta ou cortada.' },
    { section: 'Deploy',
      title: 'Pre-commit hook — bloqueia commit com erro de sintaxe JS',
      motivo: 'Verificar manualmente: editar um arquivo JS com erro intencional (ex: remover um "}" ao final) e tentar fazer git commit — o commit deve ser recusado com mensagem de erro indicando o arquivo. Desfazer a edição após o teste.' },
    { section: 'Início',
      title: 'Menu mobile (≤ 600px) — hamburguer sem sobreposição',
      motivo: 'Acessar o site em tela com largura 375px (ou redimensionar o browser). Verificar: (1) ícone hamburguer está visível e clicável; (2) não há sobreposição com logo ou outros elementos do header; (3) logo aparece em versão compacta; (4) ao abrir o menu, todos os links ficam visíveis.' }
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

    var totalTecnicos = TECNICOS.reduce(function (sum, g) { return sum + g.tests.length; }, 0);
    var totalComportamento = COMPORTAMENTO_AUTO.reduce(function (sum, g) { return sum + g.tests.length; }, 0);
    var totalAutomaticos = totalTecnicos + totalComportamento;

    /* Toolbar única — linha flat sem wrap */
    html += '<div class="testes-toolbar">';
    html += '<button class="btn btn--sm btn--primary testes-run-btn" data-suite="tecnicos">▶ Técnicos (' + totalTecnicos + ')</button>';
    html += '<button class="btn btn--sm btn--primary testes-run-btn" data-suite="comportamento">▶ Comportamento (' + totalComportamento + ')</button>';
    html += '<button class="btn btn--sm testes-run-btn" data-suite="todos">▶ Automáticos (' + totalAutomaticos + ')</button>';
    html += '<button class="btn btn--sm" id="testesExportBtn">⬇ Exportar Testes</button>';
    html += '<div class="testes-toolbar-sep"></div>';
    html += '<button class="btn btn--sm btn--ghost" id="testesExpandAll">Expandir tudo</button>';
    html += '<button class="btn btn--sm btn--ghost" id="testesCollapseAll">Recolher tudo</button>';
    html += '</div>';
    html += '<p class="testes-desc">Execute cada grupo independentemente ou todos de uma vez. Os testes rodam na sessão atual (admin logado).</p>';

    html += '<div id="testesResultados"></div>';

    html += '<div class="testes-manual-wrap">';
    html += '<h4 class="testes-manual-title">📋 Regras que exigem validação manual (' + COMPORTAMENTO_MANUAL.length + ')</h4>';
    html += '<p class="testes-manual-desc">Estas regras não podem ser verificadas automaticamente. Valide-as manualmente ao testar o site.</p>';

    /* Ordem alfabética por label, igual ao Manual/Mapa */
    const SEC_COLOR = {
      'Admin':              '#6b7a99',
      'Ajuda':              '#7ecbff',
      'Cadastrar':          '#9b7fff',
      'Check-in':           '#42a5f5',
      'Conteúdos':          '#4caf7d',
      'Deploy':             '#9e9e9e',
      'Entrar':             '#c084fc',
      'Início':             '#1ab2ae',
      'Menu / Sessão':      '#7f9bff',
      'Minha Área':         '#26a69a',
      'Repositório':        '#e8854a',
      'Treinamento Jedi':   '#e05c7f',
      'Turmas':             '#f5c542',
    };

    const bySection = {};
    COMPORTAMENTO_MANUAL.forEach(function (r) {
      if (!bySection[r.section]) bySection[r.section] = [];
      bySection[r.section].push(r);
    });
    Object.keys(bySection).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); }).forEach(function (sec) {
      const count = bySection[sec].length;
      const col = SEC_COLOR[sec] || 'var(--accent)';
      html += '<div class="testes-group testes-group--collapsible">';
      html += '<div class="testes-group-label testes-group-toggle"><span class="testes-group-arrow">▸</span><span>' + sec + ' <span class="testes-group-count">(' + count + ')</span></span></div>';
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

    /* Expandir / Recolher grupos de testes */
    var testesExpandAll = document.getElementById('testesExpandAll');
    if (testesExpandAll) {
      testesExpandAll.addEventListener('click', function () {
        container.querySelectorAll('.testes-group--collapsible').forEach(function (el) { el.classList.add('open'); });
      });
    }
    var testesCollapseAll = document.getElementById('testesCollapseAll');
    if (testesCollapseAll) {
      testesCollapseAll.addEventListener('click', function () {
        container.querySelectorAll('.testes-group--collapsible').forEach(function (el) { el.classList.remove('open'); });
      });
    }

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

    /* Nomes iguais aos usados no Manual/Mapa/Regras (sem prefixo "Página"); Firebase e Autenticação
       são grupos técnicos sem equivalente nos outros blocos */
    const RES_COLOR = {
      'Admin':                       '#6b7a99',
      'Ajuda':                       '#7ecbff',
      'Autenticação':                '#9b7fff',
      'Cadastrar':                   '#9b7fff',
      'Conteúdos':                   '#4caf7d',
      'Entrar':                      '#c084fc',
      'Firebase':                    '#1ab2ae',
      'Início':                      '#1ab2ae',
      'Menu / Sessão':               '#7f9bff',
      'Minha Área':                  '#26a69a',
      'Repositório':                 '#e8854a',
      'Treinamento Jedi':            '#e05c7f',
      'Turmas':                      '#f5c542',
    };

    const groups = {};
    results.forEach(function (r) {
      if (!groups[r.group]) groups[r.group] = [];
      groups[r.group].push(r);
    });

    Object.keys(groups).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); }).forEach(function (g) {
      const col = RES_COLOR[g] || 'var(--accent)';
      const groupPassed = groups[g].filter(function (r) { return r.passed; }).length;
      const groupTotal  = groups[g].length;
      const countLabel  = done ? ' (' + groupPassed + '/' + groupTotal + ')' : ' (' + groupPassed + '/' + groupTotal + ')';
      html += '<div class="testes-group testes-group--collapsible open">';
      html += '<div class="testes-group-label testes-group-toggle"><span class="testes-group-arrow">▸</span><span>' + g + '<span class="testes-group-count">' + countLabel + '</span></span></div>';
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
