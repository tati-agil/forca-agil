/* ============================================================
   Força Ágil — App UI interactions
   Nav, reveals, crawl, accordions, anchor navigation
   ============================================================ */
(function () {

  /* ---- Nav scroll + mobile toggle ---- */
  const nav    = document.querySelector('.nav');
  const onScr  = function () { nav && nav.classList.toggle('scrolled', window.scrollY > 40); };
  onScr();
  addEventListener('scroll', onScr, { passive: true });

  const toggle = document.querySelector('.nav-toggle');
  const links  = document.querySelector('.nav-links');
  function closeMenu() {
    if (!links) return;
    links.classList.remove('open');
    if (toggle) toggle.classList.remove('open');
  }
  if (toggle && links) {
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = links.classList.toggle('open');
      toggle.classList.toggle('open', isOpen);
    });
    links.querySelectorAll('a, button').forEach(function (el) {
      el.addEventListener('click', closeMenu);
    });
    document.addEventListener('click', function (e) {
      if (!nav.contains(e.target)) closeMenu();
    });
  }

  /* ---- Reveal on scroll (rAF-less scroll event, ultra-reliable) ---- */
  let reveals = [];
  function collectReveals() { reveals = Array.from(document.querySelectorAll('.reveal:not(.in)')); }
  function revealInView() {
    const vh = innerHeight || document.documentElement.clientHeight;
    for (let i = 0; i < reveals.length; i++) {
      const el = reveals[i];
      if (el.classList.contains('in')) continue;
      const r = el.getBoundingClientRect();
      if (r.top < vh * 1.05 && r.bottom > -80) el.classList.add('in');
    }
  }
  document.addEventListener('DOMContentLoaded', function () { collectReveals(); revealInView(); });
  addEventListener('scroll',  revealInView, { passive: true });
  addEventListener('resize',  revealInView);
  addEventListener('load', function () { collectReveals(); revealInView(); });
  /* Re-collect when a new page section becomes visible */
  window.addEventListener('hashchange', function () {
    setTimeout(function () { collectReveals(); revealInView(); }, 120);
  });

  /* ---- Opening crawl — visível para qualquer pessoa autenticada ---- */
  (function () {
    var crawlIniciado = false;

    function iniciarCrawl() {
      if (crawlIniciado) return;
      crawlIniciado = true;

      var crawl   = document.querySelector('.crawl-content');
      var stage   = document.querySelector('.crawl-stage');
      var replay  = document.querySelector('.crawl-replay');
      var reduce  = matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (crawl && !reduce) {
        var paused = false;
        var skipped = false;

        var startCrawl = function () {
          skipped = false; paused = false;
          crawl.classList.remove('run', 'crawl-static');
          stage.classList.remove('crawl-stage--static');
          void crawl.offsetWidth;
          crawl.classList.add('run');
          crawl.style.animationPlayState = 'running';
          if (pauseBtn) pauseBtn.textContent = '⏸ Pausar';
          if (skipBtn)  skipBtn.textContent  = '≡ Ler texto';
        };

        var crawlBtns = document.querySelector('.crawl-btns');
        var pauseBtn = document.createElement('button');
        pauseBtn.className = 'btn crawl-pause';
        pauseBtn.textContent = '⏸ Pausar';
        pauseBtn.setAttribute('aria-label', 'Pausar ou retomar a abertura');
        if (crawlBtns) crawlBtns.prepend(pauseBtn); else stage.parentNode.insertBefore(pauseBtn, stage.nextSibling);

        pauseBtn.addEventListener('click', function () {
          if (skipped) return;
          paused = !paused;
          crawl.style.animationPlayState = paused ? 'paused' : 'running';
          pauseBtn.textContent = paused ? '▶ Continuar' : '⏸ Pausar';
        });

        stage.addEventListener('click', function () {
          if (skipped) return;
          paused = !paused;
          crawl.style.animationPlayState = paused ? 'paused' : 'running';
          pauseBtn.textContent = paused ? '▶ Continuar' : '⏸ Pausar';
        });

        var skipBtn = document.createElement('button');
        skipBtn.className = 'btn crawl-skip';
        skipBtn.textContent = '≡ Ler texto';
        skipBtn.setAttribute('aria-label', 'Ver texto completo sem animação');
        if (crawlBtns) crawlBtns.prepend(skipBtn); else stage.parentNode.insertBefore(skipBtn, stage.nextSibling);

        skipBtn.addEventListener('click', function () {
          if (!skipped) {
            skipped = true; paused = false;
            crawl.classList.remove('run');
            crawl.classList.add('crawl-static');
            stage.classList.add('crawl-stage--static');
            crawl.style.animationPlayState = 'running';
            skipBtn.textContent = '✕ Fechar texto';
            pauseBtn.style.display = 'none';
          } else {
            startCrawl();
            pauseBtn.style.display = '';
          }
        });

        var crawlIO = new IntersectionObserver(function (es) {
          es.forEach(function (e) { if (e.isIntersecting) { startCrawl(); crawlIO.disconnect(); } });
        }, { threshold: 0.4 });
        var cs = document.querySelector('.crawl-section');
        if (cs) crawlIO.observe(cs);

        if (replay) replay.addEventListener('click', function () {
          pauseBtn.style.display = '';
          startCrawl();
        });

      } else if (replay) {
        replay.style.display = 'none';
      }
    }

    /* O crawl é para qualquer pessoa devidamente logada — não exige estar
       confirmada numa turma nem ter manifestado interesse. Basta haver
       sessão: quem não confirmou o e-mail não chega a ter uma (auth.js
       desloga e mostra o painel de verificação), e o visitante nunca vê o
       site, que fica oculto atrás do modal de login. */
    function aplicarAcesso() {
      var cs = document.querySelector('.crawl-section');
      if (!cs) return;
      var sess = window.faAuth && window.faAuth.getSession ? window.faAuth.getSession() : null;
      if (sess) {
        cs.style.display = '';
        iniciarCrawl();
      } else {
        cs.style.display = 'none';
      }
    }

    window.addEventListener('fa-auth-ready',  aplicarAcesso);
    window.addEventListener('fa-auth-change', aplicarAcesso);
  }());

  /* ---- Yoda episode accordions ---- */
  document.addEventListener('click', function (e) {
    var h = e.target.closest('.yep-head');
    if (h) h.parentElement.classList.toggle('open');
  });

  /* ---- Nav anchor links (scroll to element within page) ---- */
  document.addEventListener('click', function (e) {
    const link = e.target.closest('[data-anchor]');
    if (!link || !link.dataset.anchor) return;
    e.preventDefault();
    const page   = link.dataset.navPage || 'treinamento';
    const anchor = link.dataset.anchor;
    if (window.faRouter) window.faRouter.navigate(page, { anchor: anchor });
  });

  /* ---- Hero entrance failsafe ---- */
  addEventListener('load', function () {
    setTimeout(function () {
      document.querySelectorAll('.hero-kicker,.hero-sub,.hero-meta,.hero-actions,.scroll-cue,.hero-title span')
        .forEach(function (el) { el.style.opacity = '1'; });
    }, 1400);
  });

  /* ---- "Conhecer a iniciativa" scroll ---- */
  document.addEventListener('DOMContentLoaded', function () {
    const knowBtn = document.getElementById('heroKnow');
    if (knowBtn) knowBtn.addEventListener('click', function (e) {
      e.preventDefault();
      var target = document.getElementById('o-que-e');
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });

  });

  /* ---- Galaxy map "ver mais" ---- */
  document.addEventListener('DOMContentLoaded', function () {
    var galaxyBtn = document.getElementById('galaxyMoreBtn');
    var galaxyExtra = document.getElementById('galaxyExtra');
    if (galaxyBtn && galaxyExtra) {
      galaxyBtn.addEventListener('click', function () {
        galaxyExtra.classList.add('visible');
        galaxyBtn.style.display = 'none';
        /* força reveals nos cards recém-visíveis */
        galaxyExtra.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
      });
    }

    var principlesBtn = document.getElementById('principlesMoreBtn');
    var principlesExtra = document.getElementById('principlesExtra');
    if (principlesBtn && principlesExtra) {
      principlesBtn.addEventListener('click', function () {
        principlesExtra.classList.add('visible');
        principlesBtn.style.display = 'none';
        /* força reveals nos princípios recém-visíveis */
        principlesExtra.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
      });
    }

  });

  /* ---- Turma interest buttons ---- */
  document.addEventListener('DOMContentLoaded', function () {

    /* Turmas não são mais fixas — vêm de turmas/ no Firebase, criadas/editadas/
       excluídas pelo admin. A inscrição oficial agora acontece fora do portal,
       no CMFlex: quando o admin encerra o interesse de uma turma, o card dela
       passa a orientar pro CMFlex — igual pra todo mundo, sem distinguir quem
       já foi confirmado como inscrito (não existe mais um card único de
       "turma confirmada" substituindo o grid inteiro). */
    var _turmasList  = []; // [{ key, label, dias, cmflexLink, finalizada, eventoKey }]
    var _eventosList = []; // [{ key, nome, order, cargaHoraria, missaoTitulo, missaoTexto, topicos, itinerario, esperaAtiva, publicado, restritoADiretores, formato }]
    var _sess        = null; // sessão atual, usada por eventoNaVitrine para decidir eventos restritos
    /* Público restrito por turma (turmas-publico/<turma>/<chave do e-mail>).
       Lido junto com as turmas, antes de desenhar a grade: se viesse depois,
       a turma restrita apareceria por um instante para quem não pode vê-la —
       e um vislumbre já é o vazamento que a restrição existe para evitar. */
    var _publicoPorTurma = {};
    /* Público restrito por EVENTO (eventos-publico/<evento>/<chave do e-mail>):
       a mesma ideia um nível acima, valendo para todas as turmas do evento e
       para o card de lista de espera dele. Lido na mesma corrente, pelo mesmo
       motivo: chegar depois é piscar na tela o que não devia aparecer. */
    var _publicoPorEvento = {};
    /* "Ver esta tela como" (admin) — { email, name } de quem está sendo
       simulada, ou null quando é a própria sessão. Só afeta _sess (o que
       decide o que aparece na vitrine); interesse e lista de espera
       continuam lendo a sessão REAL de quem clica (ver initInterestButtons
       e renderEsperaCard), então o preview nunca grava nada em nome de
       outra pessoa. Fica fora de initTurmaInterest de propósito: essa
       função roda de novo a cada fa-admin-ready/fa-diretor-ready (a
       sessão real ainda resolvendo isAdmin/isDiretor), e resetar a
       escolha do admin a cada uma dessas rodadas derrubaria o preview
       sem ele mexer em nada. */
    var _verComoPessoa = null;
    /* O que a vitrine precisa saber de quem está vendo (_sess) para a visibilidade (faTurmasUtil.vitrineMostra*):
       se é gerente (null = ainda não sei → o cargo não esconde) e em quais turmas tem registro ATIVO (essas sempre
       aparecem). Lido por carregarVisao a cada pessoa — a real ou a do "Ver como". */
    var _visao = { email: '', gerente: null, registros: {}, vinculos: {} };

    /* Formato dos encontros do evento (eventos/<evento>/formato) — usado no
       chip "dia(s) de encontro(s)" do bloco "Como funciona". "hibrido" é os
       DOIS formatos ao mesmo tempo (parte presencial, parte pelo Teams no
       mesmo encontro), não dias alternados. Ausente/valor desconhecido cai
       em "presencial", o comportamento de sempre. */
    var FORMATO_TXT = {
      presencial: { singular: 'presencial', plural: 'presenciais' },
      remoto:     { singular: 'pelo Teams', plural: 'pelo Teams' },
      hibrido:    { singular: 'presencial e pelo Teams', plural: 'presenciais e pelo Teams' }
    };

    /* Quem participa do evento (eventos/<evento>/publicoDesc) — chip do bloco
       "Como funciona". O admin escolhe só a categoria (ver eventoFormPublicoDesc
       em admin.js); a frase "aberta a ... da Previ" é montada aqui, uma vez só,
       pra nunca ficar em desacordo do padrão. "Quadro próprio" concorda no
       singular ("todo o"), as demais no plural ("todos os"). Categoria
       desconhecida ou vazia cai em "empregados", o texto de sempre. */
    /* Cada categoria tem duas variantes: aberta (todo mundo daquela categoria)
       e restrita (evento marcado "público restrito" — só quem está na lista
       dele, mesmo sendo da categoria certa). Sem isso, um evento "Executivos"
       com público restrito dizia "aberta a todos os Executivos", o que é
       falso duas vezes: nem é aberta, nem é a todos — só a quem está na
       lista. */
    var PUBLICO_TXT = {
      '':               { aberta: 'aberta a todos os<br>empregados da Previ',        restrita: 'restrita a uma lista de<br>empregados da Previ' },
      'Diretores':      { aberta: 'aberta a todos os<br>Diretores da Previ',         restrita: 'restrita a uma lista de<br>Diretores da Previ' },
      'Executivos':     { aberta: 'aberta a todos os<br>Executivos da Previ',        restrita: 'restrita a uma lista de<br>Executivos da Previ' },
      'Gerentes':       { aberta: 'aberta a todos os<br>Gerentes da Previ',          restrita: 'restrita a uma lista de<br>Gerentes da Previ' },
      'Técnicos':       { aberta: 'aberta a todos os<br>Técnicos da Previ',          restrita: 'restrita a uma lista de<br>Técnicos da Previ' },
      'Cedidos':        { aberta: 'aberta a todos os<br>Cedidos da Previ',           restrita: 'restrita a uma lista de<br>Cedidos da Previ' },
      'Quadro próprio': { aberta: 'aberta a todo o<br>Quadro próprio da Previ',      restrita: 'restrita a uma lista do<br>Quadro próprio da Previ' }
    };

    function loadTurmas(cb) {
      var db = firebase.database();
      db.ref('turmas').once('value', function (snap) {
        var val = snap.val() || {};
        db.ref('turmas-config').once('value', function (cfgSnap) {
          var cfg = cfgSnap.val() || {};
          db.ref('eventos').once('value', function (evSnap) {
            var evVal = evSnap.val() || {};
            _eventosList = Object.keys(evVal).map(function (key) {
              var e = evVal[key] || {};
              return {
                key: key, nome: e.nome || key, order: e.order || 0,
                cargaHoraria: e.cargaHoraria || '',
                missaoTitulo: e.missaoTitulo || '', missaoTexto: e.missaoTexto || '',
                topicos: e.topicos || '', itinerario: e.itinerario || [],
                /* Ausente = ligada/publicado: evento de antes destes controles
                   existirem continua como sempre esteve, sem migração. */
                esperaAtiva: e.esperaAtiva !== false,
                publicado: e.publicado !== false,
                restritoADiretores: !!e.restritoADiretores,
                /* { <outroEvento>: true }: quem já participou de algum deles não manifesta interesse neste */
                bloqueiaParticipantesDe: e.bloqueiaParticipantesDe || null,
                /* uma turma por pessoa no grupo (este evento + umaTurmaComEventos) */
                umaTurmaPorPessoa: !!e.umaTurmaPorPessoa,
                /* evento que não usa o CMFlex: a vaga é confirmada só pelo admin, e o card não manda ninguém para lá */
                dispensaCmflex: !!e.dispensaCmflex,
                vagasPorTurma: e.vagasPorTurma || 0,
                publicoRestrito: !!e.publicoRestrito,
                /* quem VÊ o evento na vitrine (ausente = 'elegivel'): ver faTurmasUtil.visibilidadeDoEvento */
                visibilidade: window.faTurmasUtil.visibilidadeDoEvento(e),
                /* Chips do bloco "Como funciona" — vazio usa o texto padrão
                   (ver renderMissaoEventos), então evento antigo sem esses
                   campos continua mostrando exatamente o que sempre mostrou. */
                modalidadeLabel: e.modalidadeLabel || '', modalidadeDesc: e.modalidadeDesc || '',
                publicoLabel: e.publicoLabel || '', publicoDesc: e.publicoDesc || '',
                formato: e.formato || 'presencial'
              };
            }).sort(function (a, b) { return a.order - b.order; });
            _turmasList = Object.keys(val).map(function (key) {
              return {
                key: key,
                label: val[key].label || key.toUpperCase(),
                dias: val[key].dias || [],
                order: val[key].order || 0,
                eventoKey: val[key].eventoKey || '',
                cmflexLink: val[key].cmflexLink || '',
                finalizada: !!(cfg[key] && cfg[key].finalizada),
                encerrada:  !!(cfg[key] && cfg[key].encerrada),
                publicoRestrito: !!val[key].publicoRestrito,
                /* Ausente = 09:00–13:00: era o horário fixo do card antes
                   deste campo existir, então turma antiga não muda sozinha. */
                horarioInicio: val[key].horarioInicio || '09:00',
                horarioFim: val[key].horarioFim || '13:00',
                sala: val[key].sala || '',
                /* regras de entrada da própria turma (ausente = sem limite / todos): ver regrasDeEntrada em turmas-util.js */
                vagas: window.faTurmasUtil.vagasDaTurma(val[key]),
                publicoCargo: window.faTurmasUtil.cargoDaTurma(val[key])
              };
            }).sort(function (a, b) { return a.order - b.order; });
            Promise.all([
              db.ref('turmas-publico').once('value'),
              db.ref('eventos-publico').once('value')
            ]).then(function (pubSnaps) {
              _publicoPorTurma  = pubSnaps[0].val() || {};
              _publicoPorEvento = pubSnaps[1].val() || {};
              cb(_turmasList);
            }).catch(function () {
              /* Leitura falhou: trata como "não conheço lista nenhuma", e as
                 regras abaixo escondem toda turma e todo evento restrito.
                 Falhar escondendo é o lado seguro — o contrário mostraria
                 turma fechada a quem não devia ver. */
              _publicoPorTurma  = {};
              _publicoPorEvento = {};
              cb(_turmasList);
            });
          });
        });
      });
    }

    /* Quem vê o quê: a regra é uma só, em faTurmasUtil.vitrineMostraEvento/vitrineMostraTurma (turmas-util.js), e
       vale por PESSOA (não é o mesmo que despublicar). No padrão ('elegivel'), evento e turma só aparecem para quem
       atende às restrições deles — só diretores, lista de e-mails, cargo —, porque oferecer o que a pessoa não pode
       fazer é pior do que não oferecer; com "Mostrar para todos" ('todos') o evento aparece e o card diz o motivo.
       Admin vê tudo; quem tem registro ativo numa turma sempre a vê. Visibilidade NUNCA concede participação: o
       clique confere de novo (registerInterest) e o banco recusa quem está fora. */
    function eventoPorKey(k) { return k ? _eventosList.filter(function (e) { return e.key === k; })[0] || null : null; }
    function pessoaDaVitrine(sessao, eventoKey, turmaKey) {
      var email = sessao && sessao.email, k = email ? emailKey(email) : '';
      var mesma = !!email && _visao.email === email;
      return {
        admin: !!(email && window.faAuth && window.faAuth.isAdmin(email)),
        diretor: !!(email && window.faAuth && window.faAuth.isDiretor(email)),
        gerente: mesma ? _visao.gerente : null,
        naListaEvento: !!(k && eventoKey && (_publicoPorEvento[eventoKey] || {})[k]),
        naListaTurma: !!(k && turmaKey && (_publicoPorTurma[turmaKey] || {})[k]),
        temRegistro: !!(mesma && turmaKey && _visao.registros[turmaKey])
      };
    }
    function turmaVisivelPara(t) {
      return window.faTurmasUtil.vitrineMostraTurma(t, eventoPorKey(t.eventoKey), pessoaDaVitrine(_sess, t.eventoKey, t.key));
    }

    /* Lê, para quem está vendo (_sess), o que a visibilidade precisa: gerente ou não e os registros ativos nas
       turmas. Desenha quando chega — e, se a rede demorar, desenha antes com "ainda não sei" e redesenha quando
       chegar: esperar calado é a tela vazia no 4G da sala. "Ainda não sei" o cargo NÃO é "elegível": no padrão, o
       evento/turma de um cargo espera escondido (faTurmasUtil.cargoPendente) e a página avisa que está verificando;
       se a leitura falhar, continua escondido e o aviso diz para recarregar (gerenteFalhou). A resposta do cargo
       redesenha na hora, sem esperar as leituras dos registros. */
    function carregarVisao(desenhar) {
      var email = _sess && _sess.email;
      var v = { email: email || '', gerente: null, gerenteFalhou: false, registros: {}, vinculos: {} };
      _visao = v;
      if (!email) { desenhar(); return; }
      var db = firebase.database(), k = emailKey(email), pend = 1 + _turmasList.length, desenhou = false;
      var limite = setTimeout(function () { if (_visao === v && !desenhou) { desenhou = true; desenhar(); } }, 4000);
      function um(redesenharJa) {
        if (--pend > 0 || _visao !== v) {
          if (redesenharJa && desenhou && _visao === v) desenhar();
          return;
        }
        clearTimeout(limite);
        desenhou = true;
        desenhar();
      }
      db.ref('fa-gerentes/' + k).once('value', function (s) { v.gerente = !!s.val(); um(true); },
        function () { v.gerenteFalhou = true; um(true); });
      /* vínculo por turma (faTurmasUtil.vinculoNaTurma): na turma por vir, o registro ativo; na realizada, a
         participação comprovada — inscrição não removida ou presença no check-in. A presença só é lida (dia a dia,
         só a própria) quando o registro sozinho não decide. */
      var agora = new Date();
      var hoje = agora.getFullYear() + '-' + String(agora.getMonth() + 1).padStart(2, '0') + '-' + String(agora.getDate()).padStart(2, '0');
      var U = window.faTurmasUtil;
      _turmasList.forEach(function (t) {
        db.ref('turmas-interesse/' + t.key + '/' + k).once('value', function (s) {
          var r = s.val(), realizada = turmaRealizada(t, hoje);
          /* turma por vir: o tipo do vínculo (inscrição confirmada, como em regrasDeEntrada, ou interesse) — o card de
             inscrições encerradas o mostra */
          if (!realizada && U.registroAtivo(r)) v.vinculos[t.key] = r.status === 'inscrito' && r.confirmedByAdmin ? 'inscrita' : 'interesse';
          if (U.vinculoNaTurma(r, realizada, false)) { v.registros[t.key] = true; um(); return; }
          if (!realizada || (r && !U.registroAtivo(r)) || !(t.dias || []).length) { um(); return; }
          Promise.all(t.dias.map(function (d) {
            return db.ref('turmas-checkin/' + t.key + '/' + d + '/' + k).once('value').then(function (c) { return !!c.val(); }, function () { return false; });
          })).then(function (p) {
            if (U.vinculoNaTurma(r, true, p.indexOf(true) !== -1)) v.registros[t.key] = true;
            um();
          });
        }, function () { um(); });
      });
    }

    /* Critério único de "turma realizada": encerrada pelo admin OU já passou
       do último dia. É o card "Turma realizada" E a separação dos eventos já
       realizados na grade — os dois perguntam a mesma coisa. "Inscrições
       encerradas" (finalizada) NÃO entra: a turma ainda vai acontecer. */
    function turmaRealizada(t, hoje) {
      var dias = (t.dias || []).slice().sort();
      var ultimoDia = dias[dias.length - 1] || '';
      return !!(t.encerrada || (ultimoDia && hoje > ultimoDia));
    }
    /* Critério único de "turma aberta a novas manifestações de interesse": é a turma cujo card mostra "Tenho
       interesse" (turmaCardHtml) — não realizada, ainda não começou e sem inscrições encerradas (finalizada). Geral:
       não olha quem vê; lotação e restrições de público/participação são da pessoa e ficam no botão. */
    function turmaAbertaAInteresse(t, hoje) {
      var primeiroDia = (t.dias || []).slice().sort()[0] || '';
      return !turmaRealizada(t, hoje) && !(primeiroDia && hoje >= primeiroDia) && !t.finalizada;
    }

    function turmaCardHtml(t, hoje) {
      var fmt = window.faTurmasUtil.formatDias(t.dias);
      var diasOrdenados = t.dias.slice().sort();
      var primeiroDia = diasOrdenados[0] || '';
      /* "16" sozinho embaixo do mês não lê como dia nenhum — falta uma
         palavra que ancore o número; com 2+ dias a vírgula/"e" já dá essa
         pista ("11, 12 e 18"), mas com um só ("16") ele fica solto, parece
         perdido. "dia"/"dias" na frente resolve os dois casos com a mesma
         regra, sem tratar o singular como exceção. */
      var diasLabel = (diasOrdenados.length === 1 ? 'dia ' : 'dias ') + fmt.dates;
      var emDias = (diasOrdenados.length === 1 ? 'no dia ' : 'nos dias ') + fmt.dates;
      var horarioLabel = window.faTurmasUtil.formatHorario(t.horarioInicio, t.horarioFim);
      /* sala da turma (opcional): turma sem sala não mostra nada a mais */
      var salaHtml = t.sala ? '<div class="tc-horario tc-sala">&#x1F4CD; ' + esc(t.sala) + '</div>' : '';

      /* encerrada pelo admin OU já passou do último dia → Realizada */
      if (turmaRealizada(t, hoje)) {
        return (
          '<div data-turma-key="' + t.key + '" class="turma-card-new reveal in turma-card-realizada">' +
            '<span class="tc-label">' + t.label + '</span>' +
            '<div class="tc-month">' + fmt.mes + '</div>' +
            '<div class="tc-dates">' + diasLabel + '</div>' +
            '<div class="tc-horario">&#x23F0; ' + horarioLabel + '</div>' + salaHtml +
            '<div class="turma-status-msg turma-realizada-msg"><strong>Turma realizada</strong>Esta turma já foi concluída. Fique de olho nas próximas.</div>' +
          '</div>'
        );
      }

      /* a partir do primeiro dia e antes do fim → Em andamento */
      if (primeiroDia && hoje >= primeiroDia) {
        return (
          '<div data-turma-key="' + t.key + '" class="turma-card-new reveal in turma-card-andamento">' +
            '<span class="tc-label">' + t.label + '</span>' +
            '<div class="tc-month">' + fmt.mes + '</div>' +
            '<div class="tc-dates">' + diasLabel + '</div>' +
            '<div class="tc-horario">&#x23F0; ' + horarioLabel + '</div>' + salaHtml +
            '<div class="turma-status-msg turma-andamento-msg"><strong>Turma em andamento</strong>As aulas estão acontecendo. Acompanhe as próximas turmas.</div>' +
          '</div>'
        );
      }

      /* Interesse encerrado e turma ainda não começou → vai ser realizada.

         Aqui o card mandava a pessoa se inscrever no CMFlex. Mas o
         interesse é encerrado justamente porque as vagas no CMFlex já
         acabaram — mandar alguém para lá é mandar bater numa porta
         fechada. O card passa a dizer o que de fato acontece: as
         inscrições terminaram e a turma vai acontecer nas datas
         indicadas. Quem quiser participar olha as próximas. */
      if (t.finalizada) {
        /* quem já tem registro ativo nesta turma vê o próprio vínculo — o encerramento vale para interesse NOVO */
        var vinculo = _visao.email === (_sess && _sess.email) ? _visao.vinculos[t.key] : '';
        var vinculoHtml = vinculo
          ? '<div class="turma-intent-msg" data-vinculo="' + vinculo + '">' + (vinculo === 'inscrita'
            ? '&#x2713; Sua inscrição nesta turma está confirmada.' : 'Seu interesse nesta turma continua registrado.') + '</div>' : '';
        return (
          '<div data-turma-key="' + t.key + '" class="turma-card-new reveal in turma-card-lotada">' +
            '<span class="tc-label">' + t.label + '</span>' +
            '<div class="tc-month">' + fmt.mes + '</div>' +
            '<div class="tc-dates">' + diasLabel + '</div>' +
            '<div class="tc-horario">&#x23F0; ' + horarioLabel + '</div>' + salaHtml +
            /* sem afirmar a causa: o admin pode encerrar o interesse por outros motivos além das vagas */
            '<div class="turma-status-msg turma-lotada-msg"><strong>Inscrições encerradas</strong>' +
              'As manifestações de interesse para esta turma foram encerradas.' +
              (diasOrdenados.length ? ' Ela será realizada ' + emDias + '.' : '') + '</div>' + vinculoHtml +
          '</div>'
        );
      }

      /* interesse aberto → botão Tenho interesse */
      return (
        '<div data-turma-key="' + t.key + '" class="turma-card-new reveal in">' +
          '<span class="tc-label">' + t.label + '</span>' +
          '<div class="tc-month">' + fmt.mes + '</div>' +
          '<div class="tc-dates">' + diasLabel + '</div>' +
          '<div class="tc-horario">&#x23F0; ' + horarioLabel + '</div>' + salaHtml +
          '<button class="btn--interest" data-turma="' + t.key + '"><span class="btn-heart">&#x2661;</span>&nbsp; Tenho interesse</button>' +
          '<div class="turma-intent-msg" id="intent-msg-' + t.key + '"></div>' +
        '</div>'
      );
    }

    /* Turmas agrupadas por evento — cada grupo com o nome do evento acima da
       grade de cards, na mesma ordem do painel admin. Turma sem evento
       (não deveria existir, mas o admin permite deixar assim temporariamente)
       cai num grupo sem título, para não sumir da vitrine. */
    /* Um evento aparece na vitrine quando o admin o divulgou (publicado) E tem
       turma OU aceita lista de espera.

       "publicado" é a chave-mestra: desmarcada, o evento inteiro some da página
       das pessoas — turmas, card de espera e a Missão dele —, seja porque ainda
       está sendo preparado, seja porque já acabou. Não tira acesso de ninguém:
       quem está inscrita continua inscrita (o nível de acesso vem de
       turmas-interesse, ver auth.js) e a Minha Área dela continua mostrando a
       turma e o evento normalmente, porque lê o evento pela chave, não pela
       vitrine.

       Exigir turma invertia a utilidade da fila: é justamente ANTES de abrir
       turma que ela serve, medindo demanda para o admin saber quantas turmas
       abrir. Evento publicado, sem turma e com fila ligada aparece só com o
       título e o card de espera — o card em si é anexado por renderEsperaCard. */
    function eventoNaVitrine(ev, porEvento) {
      if (!ev.publicado) return false;
      /* Quem pode ver: faTurmasUtil.vitrineMostraEvento (só diretores, lista, cargo; "Mostrar para todos"). Aqui SIM
         há bypass para admin (ao contrário de !ev.publicado acima), porque o objetivo é "só quem deveria ver vê", e
         admin sempre deveria. Registro ativo numa turma do evento também mostra o evento (o vínculo nunca some). */
      var temRegistroNoEvento = (porEvento[ev.key] || []).some(function (t) { return _visao.email === (_sess && _sess.email) && _visao.registros[t.key]; });
      if (!window.faTurmasUtil.vitrineMostraEvento(ev, pessoaDaVitrine(_sess, ev.key, ''), temRegistroNoEvento)) return false;
      return !!(porEvento[ev.key] && porEvento[ev.key].length) || !!ev.esperaAtiva || semTurmaVisivelEmTodos(ev, porEvento);
    }
    /* "Mostrar para todos" e nenhuma turma visível para a pessoa (ex.: todas com lista própria): a apresentação do
       evento aparece assim mesmo — título, aviso e A Missão —, com um aviso no lugar da grade; as turmas continuam
       escondidas. Evento sem turma nenhuma (e sem fila) segue fora da vitrine, como sempre. */
    function semTurmaVisivelEmTodos(ev, porEvento) {
      return ev.visibilidade === 'todos' && !(porEvento[ev.key] || []).length &&
        _turmasList.some(function (t) { return t.eventoKey === ev.key; });
    }

    /* Ordem de exibição por quão exclusivo cada evento/turma é PARA QUEM
       está vendo a tela — não existia critério nenhum antes disto, então
       tudo saía só na ordem manual do admin (o campo "order"), mesmo quando
       a pessoa era destinatária de mais de uma oferta ao mesmo tempo. Pedido:
       uma diretora deve ver primeiro o que é feito especificamente para
       diretores, depois o que é restrito a uma lista da qual ela faz parte,
       e só por último o que é aberto a todo mundo — a oferta mais dirigida a
       ELA vem primeiro.

       Só entram aqui evento/turma já visíveis (eventoNaVitrine/turmaVisivelPara
       já filtraram antes). Com "Mostrar para todos" o evento de lista aparece
       também para quem está fora dela — por isso o nível 1 confere se a pessoa
       não está fora (foraDoPublicoDoEvento); a turma de lista só aparece para
       quem está nela (ou tem registro), então não precisa.
       "order" continua valendo como critério de desempate DENTRO do mesmo
       nível de exclusividade (Array.prototype.sort é estável), preservando
       a curadoria manual do admin onde não há motivo pra mudar.

       Não existe "só para diretores" no nível de turma (só de evento) — por
       isso a turma usa só dois níveis; o evento usa três. */
    function prioridadeEvento(ev, souDiretor) {
      if (ev.restritoADiretores && souDiretor) return 0;
      if (ev.publicoRestrito && window.faTurmasUtil.foraDoPublicoDoEvento(ev, pessoaDaVitrine(_sess, ev.key, '')) !== 'lista') return 1;
      return 2;
    }
    function prioridadeTurma(t) {
      return t.publicoRestrito ? 0 : 1;
    }

    function renderTurmasGrid() {
      var host = document.querySelector('.turmas-eventos');
      if (!host) return;
      var agora = new Date();
      var hoje = agora.getFullYear() + '-' + String(agora.getMonth() + 1).padStart(2, '0') + '-' + String(agora.getDate()).padStart(2, '0');
      var email = _sess && _sess.email;
      var souDiretor = !!(email && window.faAuth && window.faAuth.isDiretor(email));
      /* desempate SEMPRE pela ordem manual: a prioridade depende de quem vê ("Ver como" troca a pessoa), e ordenar a
         lista já reordenada por outra pessoa deixaria a ordem depender da visão anterior */
      _eventosList.sort(function (a, b) { return (prioridadeEvento(a, souDiretor) - prioridadeEvento(b, souDiretor)) || (a.order - b.order); });
      var porEvento = {};
      var semEvento = [];
      _turmasList.forEach(function (t) {
        if (!turmaVisivelPara(t)) return;
        if (t.eventoKey) (porEvento[t.eventoKey] = porEvento[t.eventoKey] || []).push(t);
        else semEvento.push(t);
      });
      Object.keys(porEvento).forEach(function (ek) {
        porEvento[ek].sort(function (a, b) { return prioridadeTurma(a) - prioridadeTurma(b); });
      });

      /* Três partes, cada uma depois de um título próprio — SÓ EXIBIÇÃO: nada
         some, nada é gravado, a ordem manual do painel (e a prioridade acima)
         continua valendo dentro de cada parte.
           1. inscrições abertas: alguma turma aberta a interesse novo
              (turmaAbertaAInteresse), mesmo com outras já realizadas ou
              encerradas; ou a fila de espera ligada com turma ainda por vir ou
              em andamento (também é interesse novo). Lotada continua aberta: a
              falta de vaga é dita no card, não encerra o interesse;
           2. próximas turmas, inscrições encerradas: nenhuma aberta, sem fila,
              mas alguma ainda por acontecer ou em andamento — encerrar o
              interesse NÃO é realizar o evento;
           3. realizados: todas as turmas realizadas (turmaRealizada, o critério
              do card), mesmo com a fila ligada.
         Critério geral, das turmas e das datas: não depende de quem vê poder
         participar. Evento sem turma (só fila) fica na parte 1. */
      var atuais = [], encerrados = [], realizados = [];
      _eventosList.forEach(function (ev) {
        if (!eventoNaVitrine(ev, porEvento)) return;
        var turmasEv = porEvento[ev.key] || [];
        /* sem turma visível em "Mostrar para todos": o período vem das turmas do evento (só a posição; nada delas aparece) */
        if (!turmasEv.length && semTurmaVisivelEmTodos(ev, porEvento)) turmasEv = _turmasList.filter(function (t) { return t.eventoKey === ev.key; });
        if (!turmasEv.length || turmasEv.some(function (t) { return turmaAbertaAInteresse(t, hoje); })) atuais.push(ev);
        else if (turmasEv.every(function (t) { return turmaRealizada(t, hoje); })) realizados.push(ev);
        else (ev.esperaAtiva ? atuais : encerrados).push(ev);
      });

      var html = '';
      function grupoHtml(ev, periodo) {
        var turmasEv = porEvento[ev.key] || [];
        /* "Mostrar para todos" e a pessoa fora do público: o público permitido dito logo no título, antes das turmas
           (sem lista, sem nomes — só a categoria). Quem tem registro no evento não recebe o aviso: já participa. */
        var motivo = ev.visibilidade === 'todos' ? window.faTurmasUtil.foraDoPublicoDoEvento(ev, pessoaDaVitrine(_sess, ev.key, '')) : '';
        var comRegistro = turmasEv.some(function (t) { return _visao.email === (_sess && _sess.email) && _visao.registros[t.key]; });
        var avisoPublico = motivo && !comRegistro
          ? '<p class="turmas-evento-publico" data-fora-do-publico="' + motivo + '">' + esc(window.faTurmasUtil.mensagemForaDoPublico(ev, motivo)) + '</p>' : '';
        /* cargo ainda não sabido (ou leitura falhou) em "Mostrar para todos": só o público do evento, sem dizer que a
           pessoa está dentro — os botões das turmas conferem o cargo antes de agir ("Verificando…") */
        if (!avisoPublico && !comRegistro && ev.visibilidade === 'todos' && window.faTurmasUtil.cargoDoEvento(ev) &&
            window.faTurmasUtil.cargoPendente(null, ev, pessoaDaVitrine(_sess, ev.key, ''))) {
          avisoPublico = '<p class="turmas-evento-publico" data-fora-do-publico="verificando">' + esc(window.faTurmasUtil.mensagemPublicoDoCargo(ev)) + '</p>';
        }
        var semTurma = !turmasEv.length && !ev.esperaAtiva
          ? '<p class="turmas-evento-publico" data-sem-turma-visivel="1">Não há turma deste evento disponível para você.</p>' : '';
        html +=
          '<div class="turmas-evento-grupo" data-evento-key="' + ev.key + '" data-evento-periodo="' + periodo + '">' +
            /* h2 do evento: ele é o container de tudo que vem abaixo. A Missão
               dele desce para h3 e as subseções dela para h4, mantendo o
               aninhamento — h1 da página > h2 do evento > h3 da missão > h4.
               Só a tag muda: .sec-title controla fonte, tamanho, espaçamento e
               margem, então nada se mexe na tela. */
            '<div class="turmas-evento-cab">' +
              '<span class="turmas-evento-eyebrow">Evento</span>' +
              '<h2 class="turmas-evento-titulo">' + ev.nome + '</h2>' + avisoPublico +
            '</div>' +
            /* A Missão (preenchida por renderMissaoEventos logo depois) vem
               ANTES da grade de turmas, não depois. Com vários cards de
               turma na grade — e mais o card de espera — o bloco de "Sobre
               o evento" sobrando embaixo de uma pilha de cards parecia uma
               tira solta, sem relação com nada; como resumo do evento, o
               lugar dele é junto do título, e a grade de turmas (o que tem
               ação) fica sendo o fim da seção, não o meio. */
            '<div class="turmas-evento-missao"></div>' + semTurma +
            '<div class="turmas-grid">' + turmasEv.map(function (t) { return turmaCardHtml(t, hoje); }).join('') + '</div>' +
          '</div>';
      }
      atuais.forEach(function (ev) { grupoHtml(ev, 'atual'); });
      if (encerrados.length) {
        html += '<h2 class="turmas-periodo-divisor">Próximas turmas — inscrições encerradas</h2>';
        encerrados.forEach(function (ev) { grupoHtml(ev, 'encerrado'); });
      }
      if (realizados.length) {
        html += '<h2 class="turmas-periodo-divisor">Eventos já realizados</h2>';
        realizados.forEach(function (ev) { grupoHtml(ev, 'realizado'); });
      }
      if (semEvento.length) {
        html +=
          '<div class="turmas-evento-grupo" data-evento-key="">' +
            '<div class="turmas-grid">' + semEvento.map(function (t) { return turmaCardHtml(t, hoje); }).join('') + '</div>' +
          '</div>';
      }
      /* Cargo ainda não sabido: eventos/turmas de um cargo esperam escondidos — a página diz que está verificando (ou
         que a leitura falhou), em vez de parecer que não há nada para a pessoa. Some quando o cargo chega. */
      var notaCargo = '';
      var esperaCargo = !!email && _visao.email === email && _turmasList.concat([null]).some(function (t) {
        return _eventosList.some(function (ev) {
          if (!ev.publicado || ev.visibilidade === 'todos' || (t && t.eventoKey !== ev.key)) return false;
          return window.faTurmasUtil.cargoPendente(t, ev, pessoaDaVitrine(_sess, ev.key, t ? t.key : ''));
        });
      });
      if (esperaCargo) {
        notaCargo = _visao.gerenteFalhou
          ? '<p class="turmas-evento-publico" role="status" data-cargo-pendente="falhou">Não foi possível confirmar o seu cargo agora. Eventos destinados a um cargo específico aparecem quando ele for confirmado — recarregue a página para tentar de novo.</p>'
          : '<p class="turmas-evento-publico" role="status" data-cargo-pendente="carregando">Verificando o seu cargo para mostrar os eventos destinados a ele…</p>';
      }
      /* Vazio de verdade: nem turma, nem evento aceitando fila. */
      host.innerHTML = html ? notaCargo + html : (notaCargo || '<p style="opacity:.7">Nenhuma turma aberta no momento.</p>');
    }

    /* "A Missão" / "Como funciona" / "Plano de Voo" — um bloco por evento que
       está na vitrine E tem conteúdo preenchido pelo admin (evento sem
       conteúdo não ganha bloco vazio). Reaproveita as classes do bloco
       estático que existia antes desta mudança (.section, .oficina-info,
       .agenda, .day day--static) — só que agora um bloco por evento, não um
       único global que descrevia certo só a Jornada de Imersão.

       "Na vitrine" é a MESMA condição da grade (eventoNaVitrine): tem turma
       ou aceita fila. Sem isso, um evento que aparece só com o card de espera
       ficaria sem uma linha explicando o que ele é — a pessoa veria "entre na
       fila" de algo que a página não descreve em lugar nenhum.

       Cada bloco é escrito DENTRO do grupo do seu evento (.turmas-evento-missao),
       não num container único no fim da página. Com um evento só dava na mesma;
       com dois, o antigo formato listava todas as grades e só depois todas as
       missões, e a missão ficava órfã do evento dela — a pessoa lia "A Missão"
       sem saber a qual dos eventos acima aquilo se referia. */
    function renderMissaoEventos() {
      var porEvento = {};
      _turmasList.forEach(function (t) {
        if (!turmaVisivelPara(t)) return;
        if (t.eventoKey) (porEvento[t.eventoKey] = porEvento[t.eventoKey] || []).push(t);
      });

      /* Todo bloco nasce ABERTO (pedido da dona, 01/11/2026): a pessoa lê o
         que é o evento antes das turmas. Antes, com dois ou mais eventos, eles
         nasciam fechados. A virada de um evento para outro continua marcada
         pelo cabeçalho do grupo, e o controle à direita diz em palavras o que
         o clique faz ("Ocultar informações" / "Ver informações do evento"). */
      _eventosList.forEach(function (ev) {
        var host = document.querySelector('.turmas-evento-grupo[data-evento-key="' + ev.key + '"] .turmas-evento-missao');
        if (!host) return;
        var html = '';
        if (!eventoNaVitrine(ev, porEvento)) return;
        var nDias = (ev.itinerario || []).length;
        if (!ev.missaoTexto && !ev.topicos && !nDias) return; /* evento sem conteúdo: nenhum bloco */

        var horasPorDia = '';
        if (nDias && ev.cargaHoraria) {
          var h = Number(ev.cargaHoraria) / nDias;
          horasPorDia = (Number.isInteger(h) ? h : h.toFixed(1)) + 'h';
        }

        html += '<details class="turmas-missao" open>';
        html += '<summary class="turmas-missao-summary">' +
          '<svg class="turmas-missao-summary-icone" width="14" height="14"><use href="#i-mark"/></svg>' +
          '<span class="turmas-missao-summary-texto">Sobre ' + ev.nome + '</span>' +
          '<span class="turmas-missao-acao">Ocultar informações</span>' +
          '<svg class="turmas-missao-chev" width="14" height="14" viewBox="0 0 14 14"><polyline points="2,4 7,10 12,4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          '</summary>';
        html += '<section class="section">';
        html += '<div class="reveal in"><span class="eyebrow">A Missão</span>' +
          '<h3 class="sec-title">' + (ev.missaoTitulo ? 'A <span class="glow-gold">' + ev.missaoTitulo + '</span>' : ev.nome) + '</h3>';
        if (ev.missaoTexto) html += '<p class="sec-lead">' + ev.missaoTexto + '</p>';
        html += '</div>';

        if (nDias || ev.topicos) {
          html += '<div class="oficina-info reveal in" style="margin-top:64px">' +
            '<h4 class="sec-title" style="font-size:clamp(1.3rem,3vw,2rem);letter-spacing:.12em">Como funciona</h4>' +
            '<div class="oficina-info-grid">';
          if (nDias) {
            /* "1 dia de encontro presencial" (singular) vs "N dias de encontros
               presenciais" — antes só o "dia/dias" concordava, deixando frases
               como "1 dia de encontros presenciais". Formato (presencial,
               remoto pelo Teams ou híbrido — os dois ao mesmo tempo) também
               era fixo em "presencial", errado pra evento que não é assim. */
            var fmt = FORMATO_TXT[ev.formato] || FORMATO_TXT.presencial;
            var diasLabel = nDias === 1
              ? 'dia de encontro<br>' + fmt.singular
              : 'dias de encontros<br>' + fmt.plural;
            html += '<div class="ofinfo-item"><span class="ofinfo-num">' + nDias + '</span><span class="ofinfo-label">' + diasLabel + '</span></div>';
          }
          if (horasPorDia) {
            /* Com um encontro só, "por encontro" sugere que há mais — a frase
               muda pra deixar claro que é um evento de um dia único. */
            var horasLabel = nDias === 1
              ? 'nesse único encontro,<br>no horário do expediente'
              : 'por encontro,<br>no horário do expediente';
            html += '<div class="ofinfo-item"><span class="ofinfo-num">' + horasPorDia +
              '</span><span class="ofinfo-label">' + horasLabel + '</span></div>';
          }
          /* Modalidade e público-alvo eram fixos ("Prática"/"aberta a todos os
             empregados da Previ") — errado pra um evento restrito a diretores
             (ver restritoADiretores), por exemplo. Agora são texto do evento,
             com o texto de sempre como valor padrão pra quem não preencheu. */
          var modalidadeLabel = ev.modalidadeLabel || 'Prática';
          var modalidadeDesc  = ev.modalidadeDesc  || 'dinâmicas, jogos e<br>exercícios em grupo';
          var publicoLabel    = ev.publicoLabel    || 'Opcional';
          var publicoVariante = (PUBLICO_TXT[ev.publicoDesc] || PUBLICO_TXT['']);
          var publicoDesc     = publicoVariante[ev.publicoRestrito ? 'restrita' : 'aberta'];
          html += '<div class="ofinfo-item"><span class="ofinfo-num">' + modalidadeLabel + '</span><span class="ofinfo-label">' + modalidadeDesc + '</span></div>' +
            '<div class="ofinfo-item"><span class="ofinfo-num">' + publicoLabel + '</span><span class="ofinfo-label">' + publicoDesc + '</span></div>' +
            '</div>';
          if (ev.topicos) html += '<p class="ofinfo-desc">' + ev.topicos + '</p>';
          html += '</div>';
        }

        if (nDias) {
          html += '<div class="reveal in" style="margin-top:72px">' +
            '<span class="eyebrow">Plano de Voo · ' + nDias + ' dia' + (nDias !== 1 ? 's' : '') + '</span>' +
            '<h4 class="sec-title" style="font-size:clamp(1.6rem,4vw,2.6rem)">A jornada dia a dia</h4></div>';
          html += '<div class="agenda">';
          ev.itinerario.forEach(function (titulo, i) {
            html += '<div class="day day--static reveal in"><div class="day-head"><span class="dnum">D' + (i + 1) +
              '</span><span class="dttl">' + titulo + '</span></div></div>';
          });
          html += '</div>';
        }

        html += '</section>';
        html += '</details>';
        host.innerHTML = html;
        var det = host.querySelector('.turmas-missao');
        det.addEventListener('toggle', function () {
          det.querySelector('.turmas-missao-acao').textContent = det.open ? 'Ocultar informações' : 'Ver informações do evento';
        });
      });
    }

    function esc(s) {
      return String(s || '').replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
      });
    }

    /* ══════════════════════════════════════════════════════════════════
       VER COMO — só admin. Mesmo recurso da Minha Área (aluno.js), agora
       também na vitrine: quem decide o que aparece aqui é a PESSOA
       (público restrito, só diretores, cargo, "Mostrar para todos" —
       eventoNaVitrine/turmaVisivelPara, todas por _sess.email), e essa
       regra já foi esquecida mais de uma vez por só existir no código, sem
       um jeito de o admin conferir na prática o que uma pessoa específica
       vê. Troca só _sess (o que decide visibilidade e ordem); os botões de
       interesse e lista de espera continuam lendo a sessão REAL de quem
       clica (initInterestButtons/renderEsperaCard recebem `sessReal`, não
       a pessoa escolhida), então o preview nunca grava nada em nome de
       outra pessoa — mesma garantia da Minha Área, com a mesma consulta
       (window.faTurmasUtil.listarPessoasVerComo, ver turmas-util.js). */
    function montarBarraVerComoTurmas(sessReal) {
      var host = document.querySelector('.turmas-eventos');
      if (!host || document.querySelector('.turmas-vercomo')) return;

      var barra = document.createElement('div');
      barra.className = 'aluno-vercomo turmas-vercomo';
      barra.innerHTML =
        '<span class="aluno-vercomo-tag">ADMIN</span>' +
        '<label class="aluno-vercomo-campo">Ver esta tela como ' +
          '<select class="aluno-vercomo-sel"><option value="">— eu mesma —</option></select>' +
        '</label>' +
        '<span class="aluno-vercomo-dica">Só muda o que aparece — interesse e lista de espera continuam em seu próprio nome.</span>';
      host.parentNode.insertBefore(barra, host);

      var aviso = document.createElement('div');
      aviso.className = 'aluno-vercomo-aviso';
      aviso.style.display = 'none';
      host.parentNode.insertBefore(aviso, host);

      var sel = barra.querySelector('.aluno-vercomo-sel');
      window.faTurmasUtil.listarPessoasVerComo(function (pessoas) {
        pessoas.forEach(function (p) {
          var opt = document.createElement('option');
          opt.value = p.uk;
          opt.dataset.email = p.email;
          opt.dataset.nome = p.nome;
          opt.textContent = p.nome + '  ·  ' + p.situacoes[0];
          sel.appendChild(opt);
        });
      });

      sel.addEventListener('change', function () {
        var opt = sel.options[sel.selectedIndex];
        barra.classList.toggle('aluno-vercomo--ativo', !!sel.value);
        if (!sel.value) {
          _verComoPessoa = null;
          aviso.style.display = 'none';
        } else {
          _verComoPessoa = { email: opt.dataset.email, name: opt.dataset.nome };
          aviso.innerHTML = '👁️ Você está vendo a vitrine como <strong>' + esc(opt.dataset.nome) +
            '</strong> veria. Tudo abaixo é o que aparece para essa pessoa.';
          aviso.style.display = '';
        }
        _sess = _verComoPessoa || sessReal;
        carregarVisao(function () {
          renderTurmasGrid();
          renderEsperaCard(sessReal);
          renderMissaoEventos();
          initInterestButtons(sessReal);
        });
      });
    }

    function initTurmaInterest() {
      var sess = window.faAuth && window.faAuth.getSession();
      _sess = _verComoPessoa || sess;
      loadTurmas(function () {
        carregarVisao(function () {
          renderTurmasGrid();
          renderEsperaCard(sess);
          renderMissaoEventos();
          initInterestButtons(sess);
          if (sess && window.faAuth.isAdmin && window.faAuth.isAdmin(sess.email)) montarBarraVerComoTurmas(sess);
        });
      });
    }

    /* ---- Lista de Espera ----
       A fila é do evento, não da conta: um card por evento, cada um
       escrevendo numa entrada própria em fa-espera (ver ORIGEM_DIRETA em
       turmas-util.js) — assim dá pra estar esperando por mais de um evento
       ao mesmo tempo, sem uma entrada sobrescrever a outra.

       A fila não depende de turma: o evento pode não ter nenhuma e mesmo
       assim ter fila — é assim que ela serve para medir demanda e dizer ao
       admin quantas turmas abrir. Quando o evento é criado, a fila já nasce
       junto; o que o admin escolhe é se ela aparece (esperaAtiva). Nem todo
       evento quer fila, e isso é decisão dele, não do sistema. Desligada, o
       card some do site e ninguém novo entra — mas quem já está na fila
       continua no painel, intacto: desligar não apaga ninguém. */

    function renderEsperaCard(sess) {
      document.querySelectorAll('.turma-card-espera').forEach(function (el) { el.remove(); });
      _eventosList.forEach(function (ev) {
        if (!ev.esperaAtiva) return; /* admin não quer fila neste evento */
        var grid = document.querySelector('.turmas-evento-grupo[data-evento-key="' + ev.key + '"] .turmas-grid');
        if (!grid) return; /* evento sem turma nenhuma na vitrine: nada para esperar ainda */
        var card = document.createElement('div');
        card.className = 'turma-card-new turma-card-espera reveal in';
        card.innerHTML =
          '<span class="tc-label tc-label-espera">Lista de Espera</span>' +
          '<div class="tc-espera-icon">&#x23F3;</div>' +
          '<div class="tc-espera-title">Pr&oacute;ximas turmas</div>' +
          '<div class="tc-espera-desc">Manifeste seu interesse em participar das pr&oacute;ximas turmas de ' + ev.nome + '. Quando uma nova turma for aberta, o admin poder&aacute; convidar quem est&aacute; na lista.</div>' +
          '<button class="btn--espera" type="button">&#x2661;&nbsp; Entrar na lista de espera</button>' +
          '<div class="turma-intent-msg"></div>';
        grid.appendChild(card);
        var btn = card.querySelector('.btn--espera');
        var foraEspera = foraDoPublicoParaAgir(sess, ev);
        if (sess && foraEspera) {
          /* fora do público (lista/diretores, só com "Mostrar para todos"): o motivo no lugar do botão; quem já está na fila pode sair */
          btn.disabled = true; btn.innerHTML = 'Verificando…';
          firebase.database().ref('fa-espera/' + emailKey(sess.email)).once('value', function (snap) {
            var naFila = window.faTurmasUtil.esperaAtivas(snap.val()).some(function (e) { return e.eventoKey === ev.key; });
            if (naFila) { setEsperaInitial(btn); setEsperaDone(btn); return; }
            btn.style.display = 'none';
            showEsperaMsg(btn, esc(window.faTurmasUtil.mensagemForaDoPublico(ev, foraEspera)));
          }, function () { btn.style.display = 'none'; showEsperaMsg(btn, esc(window.faTurmasUtil.mensagemForaDoPublico(ev, foraEspera))); });
        } else if (sess && (temBloqueioPorParticipacao(ev) || window.faTurmasUtil.cargoDoEvento(ev))) {
          /* o cargo do evento (Gerentes/Técnicos) também vale para a fila: regrasDeEntrada confere, como no card da turma */
          btn.disabled = true; btn.innerHTML = 'Verificando…';
          verificarParticipacaoAnterior(ev.key, sess.email, function (r) {
            if (r.estado === 'livre') { setEsperaInitial(btn); checkEsperaState(btn, sess.email, ev.key); return; }
            /* quem já está na fila continua podendo sair dela */
            firebase.database().ref('fa-espera/' + emailKey(sess.email)).once('value', function (snap) {
              var naFila = window.faTurmasUtil.esperaAtivas(snap.val()).some(function (e) { return e.eventoKey === ev.key; });
              if (naFila) { setEsperaInitial(btn); setEsperaDone(btn); return; }
              btn.style.display = 'none';
              showEsperaMsg(btn, esc(mensagemParticipacao(r)));
            }, function () { btn.style.display = 'none'; showEsperaMsg(btn, esc(mensagemParticipacao({ estado: 'erro' }))); });
          });
        } else if (sess) checkEsperaState(btn, sess.email, ev.key);
        btn.addEventListener('click', function () {
          var s = window.faAuth && window.faAuth.getSession();
          if (!s) {
            showEsperaMsg(btn, 'Fa&ccedil;a login para entrar na lista de espera.');
            if (window.faOpenAuthModal) window.faOpenAuthModal('login');
            return;
          }
          if (btn.dataset.state === 'done') removeEspera(btn, s, ev.key);
          else joinEspera(btn, s, ev.key);
        });
      });
    }

    function checkEsperaState(btn, email, eventoKey) {
      var key = emailKey(email);
      firebase.database().ref('fa-espera/' + key).once('value', function (snap) {
        var ativas = window.faTurmasUtil.esperaAtivas(snap.val());
        if (ativas.some(function (e) { return e.eventoKey === eventoKey; })) setEsperaDone(btn);
      });
    }

    function joinEspera(btn, sess, eventoKey) {
      btn.disabled = true;
      var key = emailKey(sess.email);
      var now = new Date().toISOString();
      /* A fila é do evento, então a lista do evento vale aqui igual: o card
         só aparece para quem está nela, mas a página pode estar aberta desde
         antes de o evento virar restrito — revalidar no clique é o mesmo
         cuidado do "Tenho interesse". */
      firebase.database().ref('eventos/' + eventoKey + '/publicoRestrito').once('value', function (restSnap) {
        if (!restSnap.val()) { conferirParticipacao(); return; }
        firebase.database().ref('eventos-publico/' + eventoKey + '/' + key).once('value', function (pubSnap) {
          if (!pubSnap.val()) {
            btn.disabled = false;
            showEsperaMsg(btn, 'Este evento &eacute; de p&uacute;blico restrito e voc&ecirc; n&atilde;o est&aacute; na lista dele.');
            return;
          }
          conferirParticipacao();
        });
      });
      /* participação nos eventos anteriores marcados neste evento — conferida no banco, agora */
      function conferirParticipacao() {
        verificarParticipacaoAnterior(eventoKey, sess.email, function (r) {
          if (r.estado === 'livre') { gravarEspera(); return; }
          btn.disabled = false;
          showEsperaMsg(btn, esc(mensagemParticipacao(r)));
        });
      }

      function gravarEspera() {
        /* Uma origem por evento — "lista:<eventoKey>" — para dar pra esperar
           por mais de um evento sem uma entrada escrever por cima da outra. */
        var origem = window.faTurmasUtil.ORIGEM_DIRETA + ':' + eventoKey;
        firebase.database().ref('fa-espera/' + key + '/' + origem).set({
          name: sess.name, email: sess.email, area: sess.area || '', date: now, removed: false,
          eventoKey: eventoKey
        }, function (err) {
          btn.disabled = false;
          if (err) { showEsperaMsg(btn, 'Erro ao registrar. Tente novamente.'); return; }
          setEsperaDone(btn);
        });
      }
    }

    function removeEspera(btn, sess, eventoKey) {
      btn.disabled = true;
      var key = emailKey(sess.email);
      var agora = new Date().toISOString();
      /* Sair da lista deste evento não mexe na espera por outro evento, se
         houver — são cards e decisões separadas agora. */
      firebase.database().ref('fa-espera/' + key).once('value', function (snap) {
        var updates = {};
        window.faTurmasUtil.esperaAtivas(snap.val()).forEach(function (e) {
          if (e.eventoKey !== eventoKey) return;
          updates['fa-espera/' + key + '/' + e._origem + '/removed']     = true;
          updates['fa-espera/' + key + '/' + e._origem + '/removedDate'] = agora;
          /* Marca que quem saiu foi a própria pessoa. A saída pelo painel
             grava o nome do admin; esta aqui não gravava nada, e o registro
             ficava sem dizer quem tirou — o painel então não podia afirmar
             nada, e mostrava a linha em branco. */
          updates['fa-espera/' + key + '/' + e._origem + '/removedBySelf'] = true;
        });
        firebase.database().ref().update(updates, function (err) {
          btn.disabled = false;
          if (err) { showEsperaMsg(btn, 'Erro ao remover. Tente novamente.'); return; }
          setEsperaInitial(btn);
          showEsperaMsg(btn, 'Você saiu da lista de espera.');
        });
      });
    }

    function setEsperaDone(btn) {
      btn.innerHTML = '&#x2713;&nbsp; Na lista &mdash; Sair';
      btn.classList.add('done');
      btn.dataset.state = 'done';
      btn.disabled = false;
      showEsperaMsg(btn, 'Você está na lista. Avisaremos quando houver vagas em novas turmas.');
    }

    function setEsperaInitial(btn) {
      btn.innerHTML = '&#x2661;&nbsp; Entrar na lista de espera';
      btn.classList.remove('done');
      btn.dataset.state = '';
      btn.disabled = false;
    }

    function showEsperaMsg(btn, msg) {
      var card = btn.closest('.turma-card-espera');
      var el = card && card.querySelector('.turma-intent-msg');
      if (el) el.innerHTML = msg;
    }

    function initInterestButtons(sess) {
      document.querySelectorAll('.btn--interest').forEach(function (btn) {
        const turmaKey = btn.dataset.turma;
        if (!turmaKey) return;

        if (sess) {
          var evB = eventoDaTurma(turmaKey), fora = foraDoPublicoParaAgir(sess, evB);
          if (fora) bloquearForaDoPublico(btn, turmaKey, sess.email, evB, fora);
          else if (temRegrasDeEntrada(turmaKey)) prepararBotaoComParticipacao(btn, turmaKey, sess.email);
          else checkInterestState(btn, turmaKey, sess.email);
        }

        /* Evita empilhar listeners duplicados quando initTurmaInterest roda de novo
           (revisita à página Turmas ou login/logout) — o botão é o mesmo elemento DOM */
        if (btn.dataset.wired) return;
        btn.dataset.wired = '1';

        btn.addEventListener('click', function () {
          if (btn.dataset.state === 'inscrito') return; /* já é inscrita — botão fica desabilitado, só o admin pode desconfirmar */
          const s = window.faAuth && window.faAuth.getSession();
          if (!s) {
            showMsg(turmaKey, 'Faça login para registrar seu interesse.');
            if (window.faOpenAuthModal) window.faOpenAuthModal('login');
            return;
          }
          if (btn.dataset.state === 'done') removeInterest(btn, turmaKey, s);
          else registerInterest(btn, turmaKey, s);
        });
      });
    }

    function checkInterestState(btn, turmaKey, email) {
      const key = emailKey(email);
      if (!firebase || !firebase.database) return;
      firebase.database().ref('turmas-interesse/' + turmaKey + '/' + key).once('value', function (snap) {
        const val = snap.val();
        if (!val || val.removed) return;
        /* Quem já é inscrita não pode se autorremover pelo "Remover interesse" —
           só o admin confirma quem de fato saiu do CMFlex (botão "Desconfirmar").
           Sem essa trava, a pessoa podia derrubar sozinha o próprio acesso a
           Conteúdos/Treinamento mesmo continuando inscrita de verdade no CMFlex. */
        if (val.status === 'inscrito') setInscrito(btn, turmaKey);
        else setDone(btn, turmaKey);
      });
    }

    function registerInterest(btn, turmaKey, sess) {
      /* Desabilita imediatamente para evitar clique duplo disparar 2 gravações antes da resposta do Firebase */
      btn.disabled = true;
      const key   = emailKey(sess.email);
      const now   = new Date().toISOString();
      const entry = { name: sess.name, email: sess.email, area: sess.area || '', date: now, removed: false, status: 'interessado' };
      /* Checagem de segurança — o botão só existe se a turma não estava fechada
         no último carregamento da grade, mas a página pode estar aberta há um
         tempo e o admin ter encerrado o interesse nesse meio-tempo */
      firebase.database().ref('turmas-config/' + turmaKey + '/finalizada').once('value', function (cfgSnap) {
        if (cfgSnap.val()) { btn.disabled = false; showMsg(turmaKey, 'Esta turma está encerrada para novas inscrições.'); return; }
        /* Mesma ideia da checagem acima: a turma (ou o evento dela) pode ter
           virado restrita, ou a pessoa pode ter saído da lista, depois de a
           página carregar. As duas restrições se somam: o evento é a mais
           ampla e por isso vem primeiro. */
        var evKey = (_turmasList.filter(function (t) { return t.key === turmaKey; })[0] || {}).eventoKey || '';
        checarPublicoRestrito('eventos/' + evKey, 'eventos-publico/' + evKey, evKey, function (okEvento) {
          if (!okEvento) {
            btn.disabled = false;
            showMsg(turmaKey, 'Este evento é de público restrito e você não está na lista dele.');
            return;
          }
          checarPublicoRestrito('turmas/' + turmaKey, 'turmas-publico/' + turmaKey, turmaKey, function (okTurma) {
            if (!okTurma) {
              btn.disabled = false;
              showMsg(turmaKey, 'Esta turma é de público restrito e você não está na lista dela.');
              return;
            }
            /* participação nos eventos anteriores marcados no evento desta turma — conferida no banco, agora */
            verificarParticipacaoAnterior(evKey, sess.email, function (r) {
              if (r.estado === 'livre') { gravarInteresse(); return; }
              btn.disabled = false;
              showMsg(turmaKey, mensagemParticipacao(r));
            }, turmaKey);
          });
        });

        /* Pergunta ao banco (não ao que a página leu quando abriu) se a
           restrição está ligada e, se estiver, se esta pessoa está na lista.
           Alvo inexistente — turma sem evento — nunca restringe nada. */
        function checarPublicoRestrito(refBase, refLista, alvoKey, done) {
          if (!alvoKey) { done(true); return; }
          firebase.database().ref(refBase + '/publicoRestrito').once('value', function (restSnap) {
            if (!restSnap.val()) { done(true); return; }
            firebase.database().ref(refLista + '/' + key).once('value', function (pubSnap) {
              done(!!pubSnap.val());
            }, function () { done(false); });
          }, function () { done(false); });
        }

        function gravarInteresse() {
          firebase.database().ref('turmas-interesse/' + turmaKey + '/' + key).set(entry, function (err) {
            if (err) { btn.disabled = false; showMsg(turmaKey, 'Erro ao registrar. Tente novamente.'); return; }
            firebase.database().ref('turmas-interesse-log/' + turmaKey + '/' + key).push(
              { name: sess.name, email: sess.email, area: sess.area || '', action: 'registrado', date: now }
            );
            setDone(btn, turmaKey);
            reconferirOutrosCards(turmaKey, sess.email);
          });
        }
      });
    }

    /* Registrar ou remover um interesse muda o que os OUTROS cards devem dizer ("uma turma por vez", "já participou",
       vagas). Antes só o card clicado se atualizava: removendo a turma A, a turma B continuava dizendo "você já tem
       interesse na A" até recarregar a página (visto em 23/10/2026). Os demais cards com regra conferem de novo no banco. */
    function reconferirOutrosCards(turmaKey, email) {
      document.querySelectorAll('.btn--interest').forEach(function (b) {
        var tk = b.dataset.turma;
        if (!tk || tk === turmaKey || !temRegrasDeEntrada(tk)) return;
        prepararBotaoComParticipacao(b, tk, email);
      });
    }

    function removeInterest(btn, turmaKey, sess) {
      /* Desabilita imediatamente para evitar clique duplo disparar 2 gravações antes da resposta do Firebase */
      btn.disabled = true;
      const key = emailKey(sess.email);
      const now = new Date().toISOString();
      firebase.database().ref('turmas-interesse/' + turmaKey + '/' + key).update({ removed: true, removedDate: now, status: 'removido' }, function (err) {
        if (err) { btn.disabled = false; showMsg(turmaKey, 'Erro ao remover. Tente novamente.'); return; }
        firebase.database().ref('turmas-interesse-log/' + turmaKey + '/' + key).push(
          { name: sess.name, email: sess.email, area: sess.area || '', action: 'removido', date: now }
        );
        setInitial(btn, turmaKey);
        reconferirOutrosCards(turmaKey, sess.email);
      });
    }

    function setDone(btn, turmaKey) {
      btn.innerHTML = '<span class="btn-heart">&#x2661;</span>&nbsp; Remover interesse';
      btn.classList.add('done');
      btn.dataset.state = 'done';
      btn.disabled = false;
      /* evento sem CMFlex (eventos/<ev>/dispensaCmflex): a confirmação é só do admin — não há para onde mandar a pessoa */
      var ev = eventoDaTurma(turmaKey);
      if (ev && ev.dispensaCmflex) showMsg(turmaKey, 'Interesse registrado. A organização confirma sua vaga — acompanhe pela Minha Área.');
      else showMsg(turmaKey, 'Interesse registrado — acompanhe pela Minha Área. Para confirmar sua vaga, realize a inscrição no CMFlex em: ', 'RH - Uso Pessoal | PREVI', 'https://plataforma.intra.previ.com.br/RhUsoPessoal/InscricaoEventoTreinamento');
    }

    function setInscrito(btn, turmaKey) {
      btn.innerHTML = '<span class="btn-heart">&#x2713;</span>&nbsp; Inscrita';
      btn.classList.remove('done');
      btn.classList.add('inscrito');
      btn.dataset.state = 'inscrito';
      btn.disabled = true;
      showMsg(turmaKey, 'Você já é inscrita nesta turma. Só o admin pode alterar sua inscrição.');
    }

    function setInitial(btn, turmaKey) {
      btn.innerHTML = '<span class="btn-heart">&#x2661;</span>&nbsp; Tenho interesse';
      btn.classList.remove('done');
      btn.dataset.state = '';
      btn.disabled = false;
      showMsg(turmaKey, 'Interesse removido.');
    }

    function showMsg(turmaKey, msg, linkText, linkHref) {
      const el = document.getElementById('intent-msg-' + turmaKey);
      if (!el) return;
      el.textContent = msg;
      if (linkText && linkHref) {
        const a = document.createElement('a');
        a.href = linkHref;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = linkText;
        el.appendChild(a);
      }
    }

    /* REGRAS DE ENTRADA (público gerentes/técnicos, participação anterior, uma turma por pessoa, vagas) — o critério é um
       só, em faTurmasUtil.regrasDeEntrada (turmas-util.js), o mesmo das portas do painel. Sempre lido do banco na hora,
       nunca do que a página carregou: o clique confere de novo. Enquanto não responde, o botão diz "Verificando…" (nunca
       libera nem barra por engano); se a leitura falhar, não deixa registrar.
       ORDEM DO CARD (uma mensagem só, a primeira que vale): Realizada → Em andamento → Inscrições encerradas (as três sem
       botão, em turmaCardHtml) → o registro da PRÓPRIA pessoa nesta turma (Inscrita / Remover interesse — nenhuma regra o
       esconde: na turma lotada quem está nela só pode remover) → a regra que barra (público → já participou → outra turma
       → lotada) → "Tenho interesse". */
    function temBloqueioPorParticipacao(ev) {
      return !!(ev && (ev.umaTurmaPorPessoa || (ev.bloqueiaParticipantesDe && Object.keys(ev.bloqueiaParticipantesDe).some(function (k) { return k !== ev.key && ev.bloqueiaParticipantesDe[k]; }))));
    }
    function temRegrasDeEntrada(turmaKey) {
      var t = _turmasList.filter(function (x) { return x.key === turmaKey; })[0];
      if (t && (t.vagas || t.publicoCargo)) return true;
      /* "Quem participa" do evento = Gerentes/Técnicos também é regra (cargoEfetivo, turmas-util.js) */
      var evT = eventoDaTurma(turmaKey);
      if (window.faTurmasUtil.cargoDoEvento(evT) || window.faTurmasUtil.vagasDoEvento(evT)) return true;
      return temBloqueioPorParticipacao(eventoDaTurma(turmaKey));
    }
    function eventoDaTurma(turmaKey) {
      var t = _turmasList.filter(function (x) { return x.key === turmaKey; })[0];
      return t && t.eventoKey ? _eventosList.filter(function (e) { return e.key === t.eventoKey; })[0] || null : null;
    }
    function mensagemParticipacao(r) { return window.faTurmasUtil.mensagemRegraPessoa(r); }
    function verificarParticipacaoAnterior(eventoKey, email, cb, turmaKey) {
      window.faTurmasUtil.regrasDeEntrada({ eventoKey: eventoKey, eKey: emailKey(email), turmaKey: turmaKey }, cb);
    }
    /* o botão da turma enquanto confere: livre → o estado de sempre; já participou → a explicação no lugar do botão
       (quem já tinha interesse nesta turma continua vendo o próprio registro e podendo removê-lo) */
    function prepararBotaoComParticipacao(btn, turmaKey, email) {
      btn.disabled = true;
      btn.style.display = '';
      btn.innerHTML = 'Verificando…';
      btn.dataset.verificando = '1';
      showMsg(turmaKey, '');  /* reconferindo (o card foi redesenhado): a mensagem de antes não vale até a resposta nova */
      marcarRestricao(turmaKey, null);
      var ev = eventoDaTurma(turmaKey);
      verificarParticipacaoAnterior(ev ? ev.key : '', email, function (r) {
        function pronto() { delete btn.dataset.verificando; consolidarAvisoDoEvento(turmaKey); }
        function botaoNormal() {
          btn.innerHTML = '<span class="btn-heart">&#x2661;</span>&nbsp; Tenho interesse';
          btn.disabled = false;
          checkInterestState(btn, turmaKey, email);
          pronto();
        }
        if (r.estado === 'livre') { botaoNormal(); return; }
        firebase.database().ref('turmas-interesse/' + turmaKey + '/' + emailKey(email)).once('value', function (snap) {
          var v = snap.val();
          if (v && !v.removed) { botaoNormal(); return; }
          btn.style.display = 'none';
          var msg = mensagemDoCard(r, email);
          showMsg(turmaKey, msg);
          marcarRestricao(turmaKey, r, msg);
          pronto();
        }, function () { btn.style.display = 'none'; showMsg(turmaKey, mensagemDoCard({ estado: 'erro' }, email)); pronto(); });
      }, turmaKey);
    }

    /* MENSAGEM DO CARD (só redação; a decisão vem pronta de regrasDeEntrada). Participação anterior cita TODOS os
       eventos bloqueadores em que a pessoa tem registro — pelo nome só os que ela PODE ver na vitrine (publicados, no
       público dela ou com vínculo dela, faTurmasUtil.vitrineMostraEvento); os outros viram "outro evento anterior". */
    function mensagemDoCard(r, email) {
      var sess = { email: email };
      return window.faTurmasUtil.mensagemRestricaoTurma(r, function (e) {
        var ev = eventoPorKey(e.key);
        if (!ev || !ev.publicado) return '';
        var temVinculo = _visao.email === email && _turmasList.some(function (t) { return t.eventoKey === e.key && _visao.registros[t.key]; });
        return window.faTurmasUtil.vitrineMostraEvento(ev, pessoaDaVitrine(sess, ev.key, ''), temVinculo) ? (ev.nome || e.nome || '') : '';
      });
    }

    /* UMA EXPLICAÇÃO POR EVENTO. Restrições que valem para o evento (participação anterior, uma turma por pessoa) dão a
       mesma mensagem em cada card. Quando DUAS ou mais turmas do evento terminam com a MESMA mensagem dessas, ela vai uma
       vez para o cabeçalho do evento (o aviso de público da #452) e os cards dizem só que estão indisponíveis. Só depois
       que TODAS as conferências do evento responderam (nada "Verificando…"): aviso nunca adianta o que não foi
       conferido. Mensagens de uma turma só (lotada, falha, o próprio vínculo) ficam no card. Só exibição. */
    var REGRAS_DO_EVENTO = { participacao: true, umaTurma: true };
    function marcarRestricao(turmaKey, r, msg) {
      var card = document.querySelector('.turma-card-new[data-turma-key="' + turmaKey + '"]');
      if (!card) return;
      if (r && r.estado === 'bloqueado' && REGRAS_DO_EVENTO[r.regra]) { card.dataset.restricaoMsg = msg; card.dataset.restricaoRegra = r.regra; }
      else { delete card.dataset.restricaoMsg; delete card.dataset.restricaoRegra; }
    }
    function consolidarAvisoDoEvento(turmaKey) {
      var card = document.querySelector('.turma-card-new[data-turma-key="' + turmaKey + '"]');
      var grupo = card && card.closest('.turmas-evento-grupo');
      if (!grupo || !grupo.getAttribute('data-evento-key')) return;
      if (grupo.querySelector('.btn--interest[data-verificando]')) return;
      Array.prototype.forEach.call(grupo.querySelectorAll('[data-restricao-evento]'), function (p) { p.parentNode.removeChild(p); });
      var porMsg = {}, ordem = [];
      Array.prototype.forEach.call(grupo.querySelectorAll('.turma-card-new[data-restricao-msg]'), function (c) {
        var m = c.dataset.restricaoMsg;
        if (!porMsg[m]) { porMsg[m] = []; ordem.push(m); }
        porMsg[m].push(c);
      });
      var cab = grupo.querySelector('.turmas-evento-cab');
      ordem.forEach(function (m) {
        var cards = porMsg[m];
        if (cards.length < 2 || !cab) {
          cards.forEach(function (c) { var el = c.querySelector('.turma-intent-msg'); if (el) el.textContent = m; });
          return;
        }
        var p = document.createElement('p');
        p.className = 'turmas-evento-publico';
        p.setAttribute('data-restricao-evento', cards[0].dataset.restricaoRegra);
        p.textContent = m;
        cab.appendChild(p);
        cards.forEach(function (c) { var el = c.querySelector('.turma-intent-msg'); if (el) el.textContent = 'Indisponível para você — veja o aviso do evento, acima.'; });
      });
    }

    /* Fora do público do evento por lista de e-mails ou "só diretores" — só alcançável com "Mostrar para todos" (no
       padrão o evento nem aparece). regrasDeEntrada não confere esses dois, então o card diz o motivo no lugar do
       botão: nunca um botão que parece disponível e só falha depois do clique (o banco recusaria). O cargo fica com
       regrasDeEntrada, como sempre. Quem já tem o próprio registro na turma continua com o botão (pode remover). */
    function foraDoPublicoParaAgir(sess, ev) {
      if (!ev || !sess) return '';
      var m = window.faTurmasUtil.foraDoPublicoDoEvento(ev, pessoaDaVitrine(sess, ev.key, ''));
      return m === 'diretores' || m === 'lista' ? m : '';
    }
    function bloquearForaDoPublico(btn, turmaKey, email, ev, motivo) {
      btn.disabled = true;
      btn.innerHTML = 'Verificando…';
      firebase.database().ref('turmas-interesse/' + turmaKey + '/' + emailKey(email)).once('value', function (snap) {
        var v = snap.val();
        if (v && !v.removed && v.status !== 'removido') {
          btn.innerHTML = '<span class="btn-heart">&#x2661;</span>&nbsp; Tenho interesse';
          btn.disabled = false;
          checkInterestState(btn, turmaKey, email);
          return;
        }
        btn.style.display = 'none';
        showMsg(turmaKey, window.faTurmasUtil.mensagemForaDoPublico(ev, motivo));
      }, function () { btn.style.display = 'none'; showMsg(turmaKey, window.faTurmasUtil.mensagemForaDoPublico(ev, motivo)); });
    }

    function emailKey(e) {
      return (e || '').toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
    }

    window.faInitTurmas = initTurmaInterest;
    if (window.faRouter) window.faRouter.onPageInit('turmas', initTurmaInterest);
    window.addEventListener('fa-auth-change', function () {
      if (window.faRouter && window.faRouter.current() === 'turmas') initTurmaInterest();
    });
    /* isDiretor() só resolve depois de uma leitura assíncrona própria (ver
       auth.js) — se ela terminar depois do fa-auth-change acima, a página já
       renderizou sem o evento restrito. Este segundo listener cobre esse
       atraso, sem re-executar nada enquanto ele não chegar. */
    window.addEventListener('fa-diretor-ready', function () {
      if (window.faRouter && window.faRouter.current() === 'turmas') initTurmaInterest();
    });
    /* Mesmo atraso, outra leitura: isAdmin() também só resolve depois de ler
       fa-admins, e é ele que dá à admin o passe livre nas turmas e eventos de
       público restrito. Sem este listener, a admin que não está na lista via
       a página sem eles até navegar de novo — e, no 4G da sala, esse "até"
       dura segundos. */
    window.addEventListener('fa-admin-ready', function () {
      if (window.faRouter && window.faRouter.current() === 'turmas') initTurmaInterest();
    });
  });

  /* ---- "Saiba mais" XP: navega para Ajuda, abre pergunta XP e rola até ela ---- */
  document.addEventListener('DOMContentLoaded', function () {
    var saibaMais = document.getElementById('saibaMaisXP');
    if (!saibaMais) return;
    saibaMais.addEventListener('click', function (e) {
      e.preventDefault();
      if (window.faRouter) window.faRouter.navigate('ajuda');
      setTimeout(function () {
        var details = document.getElementById('faq-xp');
        if (details) {
          details.open = true;
          details.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 200);
    });
  });

})();
