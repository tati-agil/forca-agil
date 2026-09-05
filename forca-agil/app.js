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
    var _eventosList = []; // [{ key, nome, order, cargaHoraria, missaoTitulo, missaoTexto, topicos, itinerario, esperaAtiva, publicado, restritoADiretores }]
    var _sess        = null; // sessão atual, usada por eventoNaVitrine para decidir eventos restritos

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
                /* Chips do bloco "Como funciona" — vazio usa o texto padrão
                   (ver renderMissaoEventos), então evento antigo sem esses
                   campos continua mostrando exatamente o que sempre mostrou. */
                modalidadeLabel: e.modalidadeLabel || '', modalidadeDesc: e.modalidadeDesc || '',
                publicoLabel: e.publicoLabel || '', publicoDesc: e.publicoDesc || ''
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
                encerrada:  !!(cfg[key] && cfg[key].encerrada)
              };
            }).sort(function (a, b) { return a.order - b.order; });
            cb(_turmasList);
          });
        });
      });
    }

    function turmaCardHtml(t, hoje) {
      var fmt = window.faTurmasUtil.formatDias(t.dias);
      var diasOrdenados = t.dias.slice().sort();
      var primeiroDia = diasOrdenados[0] || '';
      var ultimoDia   = diasOrdenados[diasOrdenados.length - 1] || '';

      /* encerrada pelo admin OU já passou do último dia → Realizada */
      if (t.encerrada || (ultimoDia && hoje > ultimoDia)) {
        return (
          '<div class="turma-card-new reveal in turma-card-realizada">' +
            '<span class="tc-label">' + t.label + '</span>' +
            '<div class="tc-month">' + fmt.mes + '</div>' +
            '<div class="tc-dates">' + fmt.dates + '</div>' +
            '<div class="tc-horario">&#x23F0; 9h &ndash; 13h</div>' +
            '<div class="turma-status-msg turma-realizada-msg"><strong>Turma realizada</strong>Esta turma já foi concluída. Fique de olho nas próximas.</div>' +
          '</div>'
        );
      }

      /* a partir do primeiro dia e antes do fim → Em andamento */
      if (primeiroDia && hoje >= primeiroDia) {
        return (
          '<div class="turma-card-new reveal in turma-card-andamento">' +
            '<span class="tc-label">' + t.label + '</span>' +
            '<div class="tc-month">' + fmt.mes + '</div>' +
            '<div class="tc-dates">' + fmt.dates + '</div>' +
            '<div class="tc-horario">&#x23F0; 9h &ndash; 13h</div>' +
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
        return (
          '<div class="turma-card-new reveal in turma-card-lotada">' +
            '<span class="tc-label">' + t.label + '</span>' +
            '<div class="tc-month">' + fmt.mes + '</div>' +
            '<div class="tc-dates">' + fmt.dates + '</div>' +
            '<div class="tc-horario">&#x23F0; 9h &ndash; 13h</div>' +
            '<div class="turma-status-msg turma-lotada-msg"><strong>Inscrições encerradas</strong>' +
              'As vagas desta turma já foram preenchidas. Ela será realizada em ' + fmt.dates + '. ' +
              'Acompanhe as próximas turmas para participar.</div>' +
          '</div>'
        );
      }

      /* interesse aberto → botão Tenho interesse */
      return (
        '<div class="turma-card-new reveal in">' +
          '<span class="tc-label">' + t.label + '</span>' +
          '<div class="tc-month">' + fmt.mes + '</div>' +
          '<div class="tc-dates">' + fmt.dates + '</div>' +
          '<div class="tc-horario">&#x23F0; 9h &ndash; 13h</div>' +
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
      /* Evento marcado "restritoADiretores" (aba Diretores no painel): some
         da vitrine de quem não é diretor nem admin — mesmo efeito de
         "fora da página", mas condicionado à pessoa, não a todo mundo.
         Aqui SIM há bypass para admin (ao contrário de !ev.publicado acima),
         porque o objetivo é "só quem deveria ver vê", e admin sempre deveria. */
      if (ev.restritoADiretores) {
        var email = _sess && _sess.email;
        var podeVer = !!(email && window.faAuth && (window.faAuth.isAdmin(email) || window.faAuth.isDiretor(email)));
        if (!podeVer) return false;
      }
      return !!(porEvento[ev.key] && porEvento[ev.key].length) || !!ev.esperaAtiva;
    }

    function renderTurmasGrid() {
      var host = document.querySelector('.turmas-eventos');
      if (!host) return;
      var hoje = new Date().toISOString().slice(0, 10);
      var porEvento = {};
      var semEvento = [];
      _turmasList.forEach(function (t) {
        if (t.eventoKey) (porEvento[t.eventoKey] = porEvento[t.eventoKey] || []).push(t);
        else semEvento.push(t);
      });

      var html = '';
      _eventosList.forEach(function (ev) {
        if (!eventoNaVitrine(ev, porEvento)) return;
        var turmasEv = porEvento[ev.key] || [];
        html +=
          '<div class="turmas-evento-grupo" data-evento-key="' + ev.key + '">' +
            /* h2 do evento: ele é o container de tudo que vem abaixo. A Missão
               dele desce para h3 e as subseções dela para h4, mantendo o
               aninhamento — h1 da página > h2 do evento > h3 da missão > h4.
               Só a tag muda: .sec-title controla fonte, tamanho, espaçamento e
               margem, então nada se mexe na tela. */
            '<div class="turmas-evento-cab">' +
              '<span class="turmas-evento-eyebrow">Evento</span>' +
              '<h2 class="turmas-evento-titulo">' + ev.nome + '</h2>' +
            '</div>' +
            '<div class="turmas-grid">' + turmasEv.map(function (t) { return turmaCardHtml(t, hoje); }).join('') + '</div>' +
            /* A Missão deste evento entra aqui, preenchida por
               renderMissaoEventos logo depois. */
            '<div class="turmas-evento-missao"></div>' +
          '</div>';
      });
      if (semEvento.length) {
        html +=
          '<div class="turmas-evento-grupo" data-evento-key="">' +
            '<div class="turmas-grid">' + semEvento.map(function (t) { return turmaCardHtml(t, hoje); }).join('') + '</div>' +
          '</div>';
      }
      /* Vazio de verdade: nem turma, nem evento aceitando fila. */
      host.innerHTML = html || '<p style="opacity:.7">Nenhuma turma aberta no momento.</p>';
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
        if (t.eventoKey) (porEvento[t.eventoKey] = porEvento[t.eventoKey] || []).push(t);
      });

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

        html += '<div class="divider"><svg width="14" height="14"><use href="#i-mark"/></svg></div>';
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
               como "1 dia de encontros presenciais". */
            var diasLabel = nDias === 1
              ? 'dia de encontro<br>presencial'
              : 'dias de encontros<br>presenciais';
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
          var publicoDesc     = ev.publicoDesc     || 'aberta a todos os<br>empregados da Previ';
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
        host.innerHTML = html;
      });
    }

    function initTurmaInterest() {
      var sess = window.faAuth && window.faAuth.getSession();
      _sess = sess;
      loadTurmas(function () {
        renderTurmasGrid();
        renderEsperaCard(sess);
        renderMissaoEventos();
        initInterestButtons(sess);
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
        if (sess) checkEsperaState(btn, sess.email, ev.key);
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

        if (sess) checkInterestState(btn, turmaKey, sess.email);

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
        firebase.database().ref('turmas-interesse/' + turmaKey + '/' + key).set(entry, function (err) {
          if (err) { btn.disabled = false; showMsg(turmaKey, 'Erro ao registrar. Tente novamente.'); return; }
          firebase.database().ref('turmas-interesse-log/' + turmaKey + '/' + key).push(
            { name: sess.name, email: sess.email, area: sess.area || '', action: 'registrado', date: now }
          );
          setDone(btn, turmaKey);
        });
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
      });
    }

    function setDone(btn, turmaKey) {
      btn.innerHTML = '<span class="btn-heart">&#x2661;</span>&nbsp; Remover interesse';
      btn.classList.add('done');
      btn.dataset.state = 'done';
      btn.disabled = false;
      showMsg(turmaKey, 'Interesse registrado. Para confirmar sua vaga, realize a inscrição no CMFlex em: ', 'RH - Uso Pessoal | PREVI', 'https://plataforma.intra.previ.com.br/RhUsoPessoal/InscricaoEventoTreinamento');
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
