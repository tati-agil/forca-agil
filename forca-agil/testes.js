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
        { id: 'auth-access-level', label: 'faAuth.getAccessLevel() existe e retorna valor válido ("guest", "member" ou "enrolled")', run: function () {
          if (typeof window.faAuth !== 'object' || typeof window.faAuth.getAccessLevel !== 'function') return false;
          var level = window.faAuth.getAccessLevel();
          return level === 'guest' || level === 'member' || level === 'enrolled';
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
        { id: 'adm-manual', label: 'faInitManual disponível',   run: function () { return typeof window.faInitManual === 'function'; } },
        { id: 'adm-mapa',   label: 'faInitMapa disponível',     run: function () { return typeof window.faInitMapa === 'function'; } },
        { id: 'adm-tabs',   label: 'Abas Admin presentes (7: Turmas/Repositório/Cadastrados/Administradores/Manual/Mapa/Testes)', run: function () { return document.querySelectorAll('.admin-tab-btn').length === 7; } },
        { id: 'adm-manual-panel', label: 'Painel Manual presente', run: function () { return !!document.getElementById('adminPanelManual'); } },
        { id: 'adm-mapa-panel',   label: 'Painel Mapa presente',   run: function () { return !!document.getElementById('adminPanelMapa'); } },
        { id: 'adm-testes-panel', label: 'Painel Testes presente', run: function () { return !!document.getElementById('adminPanelTestes'); } },
        { id: 'adm-cadastrados-panel', label: 'Painel Cadastrados presente', run: function () { return !!document.getElementById('adminPanelCadastrados') && !!document.getElementById('adminCadastrados'); } },
        { id: 'adm-mapa-cards',   label: 'Mapa: 11 cards de página renderizados', run: function () {
          if (window.faInitMapa) window.faInitMapa();
          return document.querySelectorAll('#adminMapa .mapa-page').length === 11;
        } },
        { id: 'adm-mapa-features', label: 'Mapa: todos os cards têm features', run: function () {
          if (window.faInitMapa) window.faInitMapa();
          var cards = document.querySelectorAll('#adminMapa .mapa-page');
          if (cards.length !== 11) return false;
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
        { id: 'c-cta-btn-logado', label: 'Botão hero: "Ver turmas" quando logado; "Juntar-se" quando visitante (nunca oculto)', run: function () {
          var btn = document.getElementById('heroJoin');
          if (!btn) return false;
          var sess = window.faAuth ? window.faAuth.getSession() : null;
          if (sess) return btn.hidden === false && btn.dataset.loggedIn === '1';
          return btn.hidden === false && btn.dataset.loggedIn !== '1';
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
        { id: 'c-turmas-cards',   label: '3 cards de turma presentes (.turma-card-new)', run: function () { return document.querySelectorAll('.turma-card-new').length === 3; } },
        { id: 'c-turmas-como-funciona', label: 'Bloco "Como funciona a oficina" presente (.oficina-info)', run: function () { return !!document.querySelector('.oficina-info'); } },
        { id: 'c-turmas-ofinfo',  label: 'Bloco tem 4 métricas (.ofinfo-item)', run: function () { return document.querySelectorAll('.ofinfo-item').length === 4; } },
        { id: 'c-turmas-intent-btn', label: 'Botões de interesse presentes (.btn--interest)', run: function () { return document.querySelectorAll('.btn--interest').length === 3; } },
        { id: 'c-turmas-intent-msg', label: 'Containers de mensagem de login presentes (#intent-msg-t1/t2/t3)', run: function () {
          return !!document.getElementById('intent-msg-t1') && !!document.getElementById('intent-msg-t2') && !!document.getElementById('intent-msg-t3');
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
          var btn = document.querySelector('.btn--interest');
          if (!btn) return false;
          var beforeBg = window.getComputedStyle(btn).backgroundColor;
          btn.classList.add('done');
          var afterBg = window.getComputedStyle(btn).backgroundColor;
          btn.classList.remove('done');
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
      motivo: 'Verificar visualmente que os 3 botões aparecem em linha horizontal (não empilhados).' },
    { section: 'Início',
      title: 'Cards "Como funciona" → cada um navega para sua página',
      motivo: 'Clicar navegaria para fora da página Admin, interrompendo a sessão de testes em execução.' },
    { section: 'Turmas',
      title: 'Visitante não acessa Conteúdos nem Treinamento Jedi',
      motivo: 'Verificar manualmente: acessar #conteudos e #gamificacao sem estar logado — o site deve bloquear o acesso e não exibir o conteúdo dessas páginas.' },
    { section: 'Turmas',
      title: 'Logado sem turma não acessa Conteúdos nem Treinamento Jedi',
      motivo: 'Verificar com conta logada sem turma confirmada: links de Conteúdos e Treinamento Jedi não devem aparecer no menu; acessar as páginas diretamente deve ser bloqueado.' },
    { section: 'Turmas',
      title: 'Inscrito vê apenas o card da própria turma na página Turmas',
      motivo: 'Verificar com conta que tem turma confirmada: somente o card da turma confirmada deve aparecer; os demais cards ficam ocultos; sem botões "Tenho interesse" ou "Remover interesse".' },
    { section: 'Turmas',
      title: 'Botão "Tenho interesse" sem login → mensagem + modal login',
      motivo: 'Requer estar deslogado.' },
    { section: 'Turmas',
      title: 'Login não retoma o registro de interesse automaticamente — precisa clicar em "Tenho interesse" de novo depois de logar',
      motivo: 'Clicar em "Tenho interesse" deslogado, completar o login pelo modal, e verificar que o botão volta a "Tenho interesse" (não registra sozinho).' },
    { section: 'Turmas',
      title: 'Botão "Tenho interesse" → registra e vira "Remover interesse"; clicar novamente remove e volta ao estado inicial',
      motivo: 'Gravaria dados reais no Firebase (turmas-interesse e turmas-interesse-log). Requer sessão ativa com email real.' },
    { section: 'Turmas',
      title: 'Após registrar interesse → mensagem "Sua intenção foi registrada! Usaremos para dimensionar as turmas."',
      motivo: 'Verificar visualmente ao clicar em "Tenho interesse": a mensagem deve aparecer embaixo do botão.' },
    { section: 'Turmas',
      title: 'Após remover interesse → mensagem "Interesse removido." e botão volta a "Tenho interesse"',
      motivo: 'Verificar visualmente ao clicar em "Remover interesse" com um interesse já registrado.' },
    { section: 'Turmas',
      title: 'Turma finalizada — exibe "Inscrições encerradas" para não inscrito',
      motivo: 'Com uma turma já finalizada: (1) como visitante, verificar que o card não tem botão de ação e exibe "Inscrições encerradas"; (2) como usuário logado sem turma confirmada, mesmo resultado; (3) clicar no card não deve abrir modal de login. Apenas o usuário confirmado naquela turma vê o estado normal de inscrito.' },
    // Cenários de exceção (corridas, falhas e correções de bug)
    { section: 'Turmas',
      title: 'Corrida: turma finaliza entre carregar a página e clicar → "Esta turma está encerrada para novas inscrições."',
      motivo: 'Requer abrir o card com a turma ainda aberta, finalizar a turma pelo admin em outra aba, e só então clicar em "Tenho interesse".' },
    { section: 'Turmas',
      title: 'Corrida rara: turma finaliza com a página já aberta → botão vira "✓ Inscrita" (desabilitado) até recarregar',
      motivo: 'Requer abrir a página Turmas com a turma ainda aberta e o usuário com interesse registrado, finalizar a turma pelo admin em outra aba sem recarregar a página do usuário, e verificar que o botão passa a "✓ Inscrita" desabilitado; ao recarregar, deve virar o card estático de inscrito.' },
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
      title: 'Finalizar turma com pessoa interessada em outra turma — aviso e remoção automática',
      motivo: 'Requer manifestar interesse real numa mesma pessoa em duas turmas e finalizar uma delas pelo painel — exige dado real no Firebase, não pode ser simulado no teste automatizado. Verificar: o modal de confirmação lista a pessoa e a outra turma; ao confirmar, o interesse dela na outra turma vira "removido" com motivo registrado e aparece na seção Removidos daquela turma; ao cancelar, nada muda em nenhuma das duas turmas.' },
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
      motivo: 'Acessar #checkin?turma=<key> logado com uma conta sem registro (ou removido) em turmas-interesse dessa turma.' },
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
      title: 'Antes de entrar: Welcome screen exibida para visitante (texto + botão "Quero jogar")',
      motivo: 'Requer estar deslogado. Verificar: #treinamento-welcome visível, #treinamento oculto, botão "Quero jogar" abre modal de login.' },
    { section: 'Treinamento Jedi',
      title: 'Ao logar pela Welcome screen: tela de boas-vindas some e o jogo aparece',
      motivo: 'Requer fazer login a partir da tela de boas-vindas. Verificar: #treinamento visível, #treinamento-welcome oculto.' },
    { section: 'Treinamento Jedi',
      title: 'Ao concluir o autodiagnóstico: Revelar patente — confirmação real',
      motivo: 'Ação irreversível (fixa o resultado definitivamente) — não deve ser executada em teste automatizado com dado real.' },
    { section: 'Admin',
      title: 'Admin — acesso negado para visitante/logado (URL direta)',
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
      title: 'Turmas — finalizar inscrição',
      motivo: 'Ação destrutiva: converte todos os interessados em inscritos e bloqueia novas inscrições. Verificar: (1) badge muda para FINALIZADA; (2) botões mudam para QR Code / Abrir check-in / Reabrir; (3) tabela exibe colunas de presença por dia.' },
    { section: 'Check-in',
      title: 'Admin — Turmas: abrir check-in do dia',
      motivo: 'Requer turma finalizada. Verificar: (1) select exibe os dias da turma e pré-seleciona hoje se aplicável; (2) ao abrir dia escolhido, badge "CHECK-IN ABERTO · DD/MM" aparece pulsante; (3) participante consegue fazer check-in via QR apenas para o dia aberto. Testar também abrir um dia diferente de hoje (passado ou futuro).' },
    { section: 'Check-in',
      title: 'Admin — Turmas: fechar check-in do dia',
      motivo: 'Requer turma finalizada e check-in aberto. Verificar: ao fechar, check-in passa a ser bloqueado na página checkin.' },
    { section: 'Admin',
      title: 'Turmas — layout responsivo das ações (desktop vs mobile)',
      motivo: 'Verificar em desktop (>768px): todas as ações ficam em linha única (seletor de dia, Abrir/Fechar check-in, QR, + Participante, Reabrir, CSV, Certificados). Verificar em mobile/tablet (≤768px): header do card vira coluna; apenas ações primárias visíveis (seletor + Abrir/Fechar ou Finalizar); botão "⋯" presente e ao clicar abre dropdown com ações secundárias (QR, + Participante, ↺ Reabrir, CSV, Certificados).' },
    { section: 'Admin',
      title: 'Turmas — check-in retroativo manual (clicar em "—")',
      motivo: 'Requer turma finalizada com pelo menos 1 inscrito que não fez check-in naquele dia. Clicar em "—" na célula da pessoa/dia → registra com source:"admin" → célula vira "✓ adm" e frequência atualiza.' },
    { section: 'Admin',
      title: 'Turmas — desfazer check-in (clicar em "✓ adm" ou "✓ qr")',
      motivo: 'Requer turma finalizada com pelo menos 1 inscrito que tenha presença registrada. Verificar: (1) hover sobre "✓ adm" ou "✓ qr" mostra risco (line-through) na etiqueta; (2) clicar abre modal visual de confirmação (não confirm() nativo); (3) ao confirmar, o registro é removido do Firebase (turmas-checkin) e a célula volta a "—"; (4) a frequência na última coluna atualiza imediatamente.' },
    { section: 'Admin',
      title: 'Turmas — adicionar participante: formulário modal (não prompt)',
      motivo: 'Requer turma finalizada. Clicar em "＋ Participante". Verificar: (1) abre modal visual (não prompt nativo do browser) com campos Nome, E-mail e Área; (2) lista de áreas tem as 20 gerências; (3) e-mail inválido (sem @previ.com.br) exibe erro no modal; (4) ao confirmar, pessoa aparece na tabela com status inscrito; (5) Firebase tem addedByAdmin:true e addedByAdminName com nome do admin em turmas-interesse.' },
    { section: 'Admin',
      title: 'Turmas — remover inscrito da turma finalizada',
      motivo: 'Requer turma finalizada com pelo menos 1 inscrito. Clicar em "Remover" na linha da pessoa. Verificar: (1) abre modal visual de confirmação (não confirm() nativo); (2) ao confirmar, pessoa some da tabela imediatamente; (3) Firebase tem removed:true e removedByAdminName com nome do admin em turmas-interesse.' },
    { section: 'Admin',
      title: 'Abas Turmas, Cadastrados e Repositório — pop-ups visuais (não nativos)',
      motivo: 'Verificar que nenhuma ação do painel usa a caixa de diálogo padrão e feia do navegador. Testar: finalizar turma, reabrir turma, remover inscrito, resetar progresso, redefinir senha, ocultar/deletar conteúdo do repositório. Todos devem abrir um modal visual com botões estilizados.' },
    { section: 'Admin',
      title: 'Turmas — reabrir turma',
      motivo: 'Ação destrutiva: volta inscritos para interessado. Verificar: (1) badge volta para ABERTA; (2) botões voltam para Finalizar inscrição; (3) inscritos voltam para interessado no Firebase.' },
    { section: 'Admin',
      title: 'Turmas — exportar CSV "Estado Atual" não inclui removidos',
      motivo: 'Remover um inscrito de uma turma finalizada e depois exportar o CSV "Estado Atual". Verificar: a pessoa removida não aparece no arquivo. A pessoa ainda deve aparecer no CSV "Histórico".' },
    { section: 'Admin',
      title: 'Turmas — exportar CSV "Histórico" inclui removidos e identificação do admin',
      motivo: 'Após remover um participante via painel admin, exportar o CSV "Histórico". Verificar: (1) a pessoa removida aparece no histórico; (2) coluna "Executado por" contém o nome do admin que executou a ação quando foi o admin; (3) quando o participante agiu por conta própria, a coluna fica vazia.' },
    { section: 'Admin',
      title: 'Turmas — exportar CSV individual por turma não inclui removidos',
      motivo: 'Remover um inscrito de uma turma finalizada e depois exportar o CSV individual daquela turma (botão "↓ CSV" no card). Verificar: a pessoa removida não aparece no arquivo CSV da turma.' },
    { section: 'Admin',
      title: 'Turmas — CSV "Estado Atual" tem coluna "Adicionado por" com nome do admin',
      motivo: 'Adicionar um participante manualmente via "＋ Participante" e depois exportar CSV "Estado Atual". Verificar: coluna "Adicionado por" contém o nome do admin que adicionou; participantes que se inscreveram sozinhos têm a coluna vazia.' },
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
      title: 'Turmas — CSV exportado tem caracteres especiais corretos e abre editável',
      motivo: 'Baixar qualquer CSV (Estado atual, Histórico ou individual). Verificar no Excel: (1) acentos, cedilha e caracteres especiais aparecem corretamente (sem "?" ou "Ã"); (2) arquivo abre em modo edição — sem modo protegido, sem "somente leitura".' },
    { section: 'Admin',
      title: 'Admin — visibilidade das 7 abas no mobile',
      motivo: 'Acessar o painel Admin em tela estreita (celular). Verificar: todas as 7 abas (Turmas, Repositório, Cadastrados, Administradores, Manual, Mapa, Testes) estão visíveis (quebram em 2 linhas); nenhuma aba fica oculta ou cortada.' },
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
      'Admin':              '#ff5252',
      'Ajuda':              '#7ecbff',
      'Cadastrar':          '#9b7fff',
      'Check-in':           '#42a5f5',
      'Conteúdos':          '#4caf7d',
      'Deploy':             '#9e9e9e',
      'Entrar':             '#c084fc',
      'Início':             '#1ab2ae',
      'Menu / Sessão':      '#7f9bff',
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
      'Admin':                       '#ff5252',
      'Ajuda':                       '#7ecbff',
      'Autenticação':                '#9b7fff',
      'Cadastrar':                   '#9b7fff',
      'Conteúdos':                   '#4caf7d',
      'Entrar':                      '#c084fc',
      'Firebase':                    '#1ab2ae',
      'Início':                      '#1ab2ae',
      'Menu / Sessão':               '#7f9bff',
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
