/* ============================================================
   Força Ágil — Admin Module
   Área restrita: tatianefdirene@previ.com.br | danilfrazao@previ.com.br
   ============================================================ */
(function () {
  'use strict';

  /* Painéis com conteúdo expansível */
  const EXPANDABLE_PANELS = [];

  function activePanel() {
    return document.querySelector('.admin-tab-panel.active');
  }

  function expandAll(panel) {
    /* details elements (Manual) */
    panel.querySelectorAll('details').forEach(function (d) { d.open = true; });
    /* class-based (Mapa: mapa-page / arch-section / mapa-level; Testes: testes-group--collapsible) */
    panel.querySelectorAll('.mapa-page, .arch-section, .mapa-level, .testes-group--collapsible').forEach(function (el) {
      el.classList.add('open');
    });
  }

  function collapseAll(panel) {
    panel.querySelectorAll('details').forEach(function (d) { d.open = false; });
    panel.querySelectorAll('.mapa-page, .arch-section, .mapa-level, .testes-group--collapsible').forEach(function (el) {
      el.classList.remove('open');
    });
  }

  function buildSectionButtons(panel) {
    const bar = document.getElementById('adminExpandBar');
    if (!bar) return;
    bar.querySelectorAll('.admin-expand-sec-btn, .admin-expand-sep').forEach(function (b) { b.remove(); });
  }

  function updateExpandBar(panelId) {
    const bar = document.getElementById('adminExpandBar');
    if (!bar) return;
    const isExpandable = EXPANDABLE_PANELS.indexOf(panelId) !== -1;
    bar.classList.toggle('visible', isExpandable);
    if (isExpandable) {
      var panel = document.getElementById(panelId);
      if (panel) setTimeout(function () { buildSectionButtons(panel); }, 50);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (window.faRouter) window.faRouter.onPageInit('admin', initAdmin);

    /* Tab switching inside admin */
    document.querySelectorAll('.admin-tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const target = btn.dataset.panel;
        document.querySelectorAll('.admin-tab-btn').forEach(function (b) { b.classList.remove('active'); });
        document.querySelectorAll('.admin-tab-panel').forEach(function (p) { p.classList.remove('active'); });
        btn.classList.add('active');
        const panel = document.getElementById(target);
        if (panel) panel.classList.add('active');
        updateExpandBar(target);
      });
    });

    /* Expandir / Recolher tudo */
    const expandBtn   = document.getElementById('adminExpandAll');
    const collapseBtn = document.getElementById('adminCollapseAll');
    if (expandBtn)   expandBtn.addEventListener('click',   function () { const p = activePanel(); if (p) expandAll(p); });
    if (collapseBtn) collapseBtn.addEventListener('click', function () { const p = activePanel(); if (p) collapseAll(p); });
  });

  function emailKey(e) {
    return (e || '').toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
  }

  const SUPER_ADMINS = ['tatianefdirene@previ.com.br', 'danielfrazao@previ.com.br'];
  window.faSuperAdmins = SUPER_ADMINS;

  var _aguardandoAuth = false;

  function initAdmin() {
    var sess = window.faAuth && window.faAuth.getSession();
    /* Ao abrir #admin direto (link salvo, F5, endereço digitado), o router
       dispara este init ANTES do Firebase resolver a sessão. Sem esperar o
       fa-auth-ready, a função retornava em silêncio e o painel inteiro ficava
       preso nos "Carregando…" estáticos do HTML, sem erro no console. */
    if (!sess) {
      if (_aguardandoAuth) return;
      _aguardandoAuth = true;
      window.addEventListener('fa-auth-ready', function onReady() {
        window.removeEventListener('fa-auth-ready', onReady);
        _aguardandoAuth = false;
        initAdmin();
      });
      return;
    }
    if (!window.faAuth.isAdmin(sess.email)) return;
    migrateNameCase();
    migrarEsperaPorOrigem();
    migrarEsperaEventoKey();
    seedMissaoJornadaImersao();
    /* Cria o treinamento que já existia (ligado aos eventos de hoje) antes de
       desenhar a aba, senão a primeira carga a mostraria vazia. */
    seedTreinamentoPadrao(function () { loadTreinamentos(); });
    loadInterests();
    loadRepoAdmin();
    loadCadastrados();
    loadAdmins();
    loadDiretores();
    loadSorteios();
    if (window.faInitManual) window.faInitManual();
    if (window.faInitMapa) window.faInitMapa();
    if (window.faInitTestes) window.faInitTestes();
    if (window.faInitPedidos) window.faInitPedidos();
    if (window.faInitDashboard) window.faInitDashboard();
    initCertificados();
  }

  /* fa-espera guardava UMA entrada por pessoa. Agora guarda uma por pessoa e
     por origem — fa-espera/<eKey>/<turma ou "lista"> —, porque a estrutura
     antiga fazia a segunda migração escrever por cima da primeira e levar
     junto a data do interesse original, que é o que ordena a fila.

     Esta conversão é mecânica: cada registro antigo desce um nível, para
     debaixo da origem que ele já declarava. Nenhum dado é inventado, e as
     entradas que já se perderam na sobrescrita continuam perdidas — a
     informação para recriá-las não está mais aqui. Roda a cada carga do
     painel e não faz nada quando não há o que converter. */
  function migrarEsperaPorOrigem() {
    firebase.database().ref('fa-espera').once('value', function (snap) {
      var data = snap.val() || {};
      var updates = {};
      Object.keys(data).forEach(function (eKey) {
        var v = data[eKey];
        /* Formato novo já não tem os campos da pessoa na raiz do nó. */
        if (!v || typeof v !== 'object' || !v.email) return;
        var origem = v.migratedFrom || (window.faTurmasUtil && window.faTurmasUtil.ORIGEM_DIRETA) || 'lista';
        var novo = {};
        novo[origem] = v;
        /* Substitui o nó inteiro: escrever o filho e apagar o pai no mesmo
           update seriam caminhos sobrepostos, que o Firebase recusa. */
        updates['fa-espera/' + eKey] = novo;
      });
      if (Object.keys(updates).length) firebase.database().ref().update(updates);
    });
  }

  /* Preenche o eventoKey que falta em registros ANTIGOS da fila. Não é uma
     regra permanente do sistema: daqui em diante ninguém entra na fila sem
     evento, porque o card de espera é de UM evento e a pessoa escolhe em
     qual entrar (renderEsperaCard em app.js). O sistema não adivinha nada —
     quem entra, diz.

     O que sobrou para consertar é dado de antes disso existir, e vem de dois
     lugares:

     1. Migrado de uma turma (fa-espera/<eKey>/<turmaKey>): a turma já sabe o
        evento dela, em turmas/<turmaKey>/eventoKey. Basta copiar.

     2. Entrado direto pelo card do site, quando o card ainda era um só e não
        perguntava o evento. Naquela época o card exigia que o evento tivesse
        turma, então esses registros são todos do único evento que chegou a
        ter turma — nenhum outro podia ter fila. Por isso a conta aqui é de
        eventos COM TURMA, e não de eventos: um evento cadastrado e ainda
        vazio não muda nada, e não pode fazer estes registros voltarem para o
        limbo.

        Atenção ao ler isto: a fila HOJE não depende mais de turma — evento
        sem turma nenhuma pode ter fila. Isso não invalida a conta acima, que
        é sobre registros antigos, gravados sob a regra antiga; só quer dizer
        que "evento com turma" aqui é uma marca de época, não a regra atual.

     Se algum dia dois eventos tiverem turma E ainda houver registro sem
     dono, esta função não escolhe por conta própria: deixa como está, na
     seção "sem evento" do painel, para o admin resolver.

     Roda a cada carga do painel e só grava o que ainda falta — idempotente. */
  function migrarEsperaEventoKey() {
    firebase.database().ref('fa-espera').once('value', function (espSnap) {
      var esp = espSnap.val() || {};
      firebase.database().ref('turmas').once('value', function (tSnap) {
        var turmasVal = tSnap.val() || {};
        firebase.database().ref('eventos').once('value', function (evSnap) {
          var eventosVal = evSnap.val() || {};
          /* Evento sem turma nunca teve card de espera, então nunca teve fila:
             fica fora da conta de "quem poderia ser o dono destas órfãs". */
          var comTurma = [];
          Object.keys(turmasVal).forEach(function (tk) {
            var ek = turmasVal[tk] && turmasVal[tk].eventoKey;
            if (ek && eventosVal[ek] && comTurma.indexOf(ek) === -1) comTurma.push(ek);
          });
          var evUnico = comTurma.length === 1 ? comTurma[0] : '';
          var updates = {};
          Object.keys(esp).forEach(function (eKey) {
            var pessoa = esp[eKey];
            if (!pessoa || typeof pessoa !== 'object' || pessoa.email) return; /* formato antigo, ainda não convertido */
            Object.keys(pessoa).forEach(function (origem) {
              var entry = pessoa[origem];
              if (!entry || typeof entry !== 'object' || entry.eventoKey) return;
              var turma = turmasVal[origem];
              var destino = (turma && turma.eventoKey) || evUnico;
              if (destino) {
                updates['fa-espera/' + eKey + '/' + origem + '/eventoKey'] = destino;
              }
            });
          });
          if (Object.keys(updates).length) firebase.database().ref().update(updates);
        });
      });
    });
  }

  /* O bloco "A Missão / Como funciona / Plano de Voo" era HTML fixo na
     página Turmas, descrevendo só a Jornada de Imersão. Virou conteúdo por
     evento (missaoTitulo/missaoTexto/topicos/itinerario) — sem esta
     migração, o evento que já existe em produção ficaria sem esse conteúdo
     até alguém preencher no painel, e o texto sumiria do site público de uma
     hora pra outra. Roda uma vez: só grava se o nome bater exatamente com o
     que já está em produção E o evento ainda não tiver itinerário — não
     sobrescreve o que o admin já tiver editado. Não inventa texto novo, só
     transporta o que já existia na página, agora editável. */
  function seedMissaoJornadaImersao() {
    var NOME_ALVO = 'FORÇA ÁGIL · JORNADA DE IMERSÃO';
    firebase.database().ref('eventos').once('value', function (snap) {
      var val = snap.val() || {};
      var updates = {};
      Object.keys(val).forEach(function (key) {
        var e = val[key] || {};
        if ((e.nome || '').trim().toUpperCase() !== NOME_ALVO) return;
        if (e.itinerario && e.itinerario.length) return;
        updates['eventos/' + key + '/missaoTitulo'] = 'Oficina de Agilidade Organizacional';
        updates['eventos/' + key + '/missaoTexto']  =
          'Eficiência com foco no futuro: trabalhar de forma mais simples, colaborativa e com propósito — para que cada entrega faça diferença na vida dos associados.';
        updates['eventos/' + key + '/topicos'] =
          'Serão abordados: fundamentos ágeis, OKR, Scrum, Design Thinking, leitura de cenário, resolução de problemas, liderança e prototipação. Não é necessário nenhum conhecimento prévio.';
        updates['eventos/' + key + '/itinerario'] = [
          'O Despertar da Força', 'A Postura do Guardião', 'Prova da Força', 'O Confronto Interior', 'O Julgamento Jedi'
        ];
      });
      if (Object.keys(updates).length) firebase.database().ref().update(updates);
    });
  }

  function migrateNameCase() {
    /* fa-admins: estrutura plana { key: { name, email } } */
    ['fa-admins'].forEach(function (path) {
      firebase.database().ref(path).once('value', function (snap) {
        const data = snap.val() || {};
        const updates = {};
        Object.entries(data).forEach(function (entry) {
          const key = entry[0], p = entry[1];
          const newName  = (p.name  || '').toUpperCase();
          const newEmail = (p.email || '').toLowerCase();
          if (p.name !== newName || p.email !== newEmail) {
            updates[path + '/' + key + '/name']  = newName;
            updates[path + '/' + key + '/email'] = newEmail;
          }
        });
        if (Object.keys(updates).length) firebase.database().ref().update(updates);
      });
    });

    /* turmas-interesse: estrutura { turmaKey: { eKey: { name, email } } } */
    firebase.database().ref('turmas-interesse').once('value', function (snap) {
      const data = snap.val() || {};
      const updates = {};
      Object.entries(data).forEach(function (tEntry) {
        const turmaKey = tEntry[0], pessoas = tEntry[1] || {};
        Object.entries(pessoas).forEach(function (pEntry) {
          const eKey = pEntry[0], p = pEntry[1];
          if (!p || typeof p !== 'object') return;
          const newName = (p.name || '').toUpperCase();
          if (p.name && p.name !== newName) {
            updates['turmas-interesse/' + turmaKey + '/' + eKey + '/name'] = newName;
          }
        });
      });
      if (Object.keys(updates).length) firebase.database().ref().update(updates);
    });
  }

  /* Critério de presença mínima (0.75 = 75% dos dias) */
  var CRITERIO_PRESENCA = 0.75;

  /* Turmas não são mais fixas — vêm de turmas/ no Firebase, editável pelo admin
     (criar, excluir, adicionar/remover datas). loadTurmasList() repopula isto
     antes de qualquer tela do admin que precise da lista. */
  var TURMAS_LIST = [];

  function loadTurmasList(cb) {
    firebase.database().ref('turmas').once('value', function (snap) {
      var val = snap.val() || {};
      TURMAS_LIST = Object.keys(val).map(function (key) {
        var t = val[key] || {};
        var dias = (t.dias || []).slice().sort();
        var fmt = window.faTurmasUtil.formatDias(dias);
        return { key: key, label: t.label || key.toUpperCase(), dates: fmt.dates, dias: dias, order: t.order || 0, cmflexLink: t.cmflexLink || '', eventoKey: t.eventoKey || '', avaliacaoHabilitada: !!t.avaliacaoHabilitada };
      }).sort(function (a, b) { return a.order - b.order; });
      cb();
    });
  }

  /* Eventos — entidade que agrupa turmas. Armazena nome e carga horária
     para que múltiplas turmas do mesmo evento compartilhem esses dados. */
  var EVENTOS_LIST = [];

  function loadEventosList(cb) {
    firebase.database().ref('eventos').once('value', function (snap) {
      var val = snap.val() || {};
      EVENTOS_LIST = Object.keys(val).map(function (key) {
        var e = val[key] || {};
        return {
          key: key, nome: e.nome || '', cargaHoraria: e.cargaHoraria || '20',
          percentualMinimo: Number(e.percentualMinimo || 75), order: e.order || 0,
          missaoTitulo: e.missaoTitulo || '', missaoTexto: e.missaoTexto || '',
          topicos: e.topicos || '', itinerario: e.itinerario || [],
          /* Ausente = ligada/publicado. Evento criado antes destes controles
             existirem continua como sempre esteve, sem migração. */
          esperaAtiva: e.esperaAtiva !== false,
          publicado: e.publicado !== false,
          restritoADiretores: !!e.restritoADiretores,
          modalidadeLabel: e.modalidadeLabel || '', modalidadeDesc: e.modalidadeDesc || '',
          publicoLabel: e.publicoLabel || '', publicoDesc: e.publicoDesc || '',
          formato: e.formato || 'presencial'
        };
      }).sort(function (a, b) { return a.order - b.order; });
      cb();
    });
  }

  function eventoLabel(key) {
    var ev = EVENTOS_LIST.filter(function (x) { return x.key === key; })[0];
    return ev ? ev.nome : key;
  }

  function turmaLabel(key) {
    var t = TURMAS_LIST.filter(function (x) { return x.key === key; })[0];
    return t ? t.label : key;
  }

  function turmaEventoKey(key) {
    var t = TURMAS_LIST.filter(function (x) { return x.key === key; })[0];
    return (t && t.eventoKey) || '';
  }

  function fmtDia(iso) {
    /* "2026-08-11" → "11/08" */
    var p = iso.split('-');
    return p[2] + '/' + p[1];
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  /* Ordem de exibição das pessoas: alfabética pelo nome. O Firebase devolve
     os registros na ordem das chaves (que são derivadas do e-mail), então
     sem isto a lista sai ordenada por e-mail — parece alfabética no começo
     e desanda logo em seguida. localeCompare com 'pt-BR' e sensitivity
     'base' faz acento e caixa não mudarem a posição (ANDRÉA junto de
     ANDREA); empate cai no e-mail, que é único. */
  function cmpNome(a, b) {
    var n = String((a && a.name) || '').trim();
    var m = String((b && b.name) || '').trim();
    /* registro sem nome (importação incompleta) vai para o fim, não para o topo */
    if (!n !== !m) return n ? -1 : 1;
    var r = n.localeCompare(m, 'pt-BR', { sensitivity: 'base' });
    if (r) return r;
    return String((a && a.email) || '').localeCompare(String((b && b.email) || ''), 'pt-BR', { sensitivity: 'base' });
  }

  /* ---- Turmas tab ---- */
  /* Estado da interface da aba Eventos, preservado entre recargas.
     loadInterests() reconstrói a aba inteira do zero — é chamada depois de
     cada ação (registrar presença, confirmar inscrição, remover…). Sem isto,
     registrar a presença de uma pessoa recolhia o evento e a turma e jogava a
     rolagem para o topo, obrigando a navegar tudo de novo a cada pessoa. */
  var _uiEventosAbertos   = {};   /* { [eventoKey]: true } */
  var _uiTurmasAbertas    = {};   /* { [turmaKey]:  true } */
  var _uiRemovidosAbertos = {};   /* { [turmaKey]:  true } */
  var _uiFiltroStatus     = {};   /* { [turmaKey]: 'todos' | 'confirmados' | 'nao_confirmados' } */
  var _uiFiltroEvento     = '';   /* valor do select "Ver evento" */

  function loadInterests() {
    var c = document.getElementById('adminInterests');
    if (!c) return;
    /* Guarda a rolagem para devolver a pessoa ao mesmo ponto depois do
       redesenho. E só mostra "Carregando" na primeira vez: numa recarga o
       conteúdo sumir e voltar faz a página saltar. */
    var scrollAntes = window.scrollY;
    var primeiraVez = !c.querySelector('[data-ev-key]');
    if (primeiraVez) c.innerHTML = '<p class="loading-msg">Carregando dados…</p>';

    loadTurmasList(function () {
    loadEventosList(function () {
    var db = firebase.database();
    db.ref('turmas-interesse').once('value', function (snapI) {
      db.ref('turmas-config').once('value', function (snapC) {
        db.ref('turmas-checkin').once('value', function (snapCk) {
          var data    = snapI.val()  || {};
          var config  = snapC.val()  || {};
          var checkin = snapCk.val() || {};
          /* Precisa vir antes de desenhar qualquer turma: é daqui que sai
             o "Já participou · Turma 1 — Agosto". */
          registrarTurmasConfirmadas(data, TURMAS_LIST.reduce(function (acc, t) {
            acc[t.key] = { label: t.label }; return acc;
          }, {}));
          c.innerHTML = '';

          /* ── Botões globais ────────────────────────────────────────────── */
          var globalBtnWrap = document.createElement('div');
          globalBtnWrap.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px';
          var newEventoBtn = document.createElement('button');
          newEventoBtn.className = 'btn btn--sm btn--primary';
          newEventoBtn.innerHTML = '+ Novo evento';
          newEventoBtn.addEventListener('click', function () { openEventoFormModal(null); });
          var exportBtn = document.createElement('button');
          exportBtn.className = 'btn btn--sm';
          exportBtn.innerHTML = '&#x2193; Estado atual';
          exportBtn.addEventListener('click', function () { exportAllInterests(data, config, checkin); });
          var exportLogBtn = document.createElement('button');
          exportLogBtn.className = 'btn btn--sm';
          exportLogBtn.innerHTML = '&#x2193; Histórico';
          exportLogBtn.addEventListener('click', function () { exportInterestLog(); });
          var qrAcessoBtn = document.createElement('a');
          qrAcessoBtn.className = 'btn btn--sm';
          qrAcessoBtn.innerHTML = '&#x2193; QR de acesso ao site';
          qrAcessoBtn.href = 'forca-agil/assets/qrcode-acesso.png';
          qrAcessoBtn.download = 'forca-agil-qrcode.png';
          qrAcessoBtn.title = 'Baixa o QR Code (com o logotipo da Força Ágil) que leva para forca-agil.previ.com.br — use em cartazes, slides ou materiais impressos';
          globalBtnWrap.appendChild(newEventoBtn);
          globalBtnWrap.appendChild(exportBtn);
          globalBtnWrap.appendChild(exportLogBtn);
          globalBtnWrap.appendChild(qrAcessoBtn);
          c.appendChild(globalBtnWrap);

          /* ── Barra de filtro e expand/collapse ───────────────────────────── */
          var filterBar = document.createElement('div');
          filterBar.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:18px;width:100%;box-sizing:border-box;min-width:0';
          var filterLabel = document.createElement('span');
          filterLabel.style.cssText = 'color:var(--ink-2);font-size:.82rem;white-space:nowrap;flex-shrink:0';
          filterLabel.textContent = 'Ver evento:';
          var filterSel = document.createElement('select');
          filterSel.style.cssText = 'background:var(--panel-2);border:1px solid var(--line-strong);border-radius:4px;color:var(--ink);padding:4px 8px;font-size:.82rem;cursor:pointer;max-width:240px;min-width:0;flex-shrink:1';
          var allOpt = document.createElement('option');
          allOpt.value = ''; allOpt.textContent = 'Todos';
          filterSel.appendChild(allOpt);
          EVENTOS_LIST.forEach(function (ev) {
            var opt = document.createElement('option');
            opt.value = ev.key; opt.textContent = ev.nome;
            filterSel.appendChild(opt);
          });
          var expandAllBtn = document.createElement('button');
          expandAllBtn.className = 'btn btn--sm';
          expandAllBtn.style.cssText = 'padding:4px 10px;font-size:.72rem;margin-left:auto;white-space:nowrap;flex-shrink:0';
          expandAllBtn.textContent = '↕ Expandir tudo';
          var collapseAllBtn = document.createElement('button');
          collapseAllBtn.className = 'btn btn--sm';
          collapseAllBtn.style.cssText = 'padding:4px 10px;font-size:.72rem;white-space:nowrap;flex-shrink:0';
          collapseAllBtn.textContent = '↕ Recolher tudo';
          filterBar.appendChild(filterLabel);
          filterBar.appendChild(filterSel);
          filterBar.appendChild(expandAllBtn);
          filterBar.appendChild(collapseAllBtn);
          c.appendChild(filterBar);

          if (!EVENTOS_LIST.length) {
            var noEventoMsg = document.createElement('p');
            noEventoMsg.className = 'admin-empty';
            noEventoMsg.textContent = 'Nenhum evento cadastrado. Clique em "+ Novo evento" para começar.';
            c.appendChild(noEventoMsg);
          }

          /* ── Função auxiliar: constrói e retorna o card de uma turma ───── */
          function buildTurmaCard(t) {
            var cfg        = config[t.key] || {};
            var finalizada = !!cfg.finalizada;
            var encerrada  = !!cfg.encerrada;
            var diaAtivo   = cfg.diaAtivo || null;
            var all        = (data[t.key] ? Object.values(data[t.key]) : []).sort(cmpNome);
            var active     = all.filter(function (r) { return !r.removed; });
            var removed    = all.filter(function (r) { return r.removed; });
            var checkinT   = checkin[t.key] || {};
            var inscritos    = active.filter(function (r) { return r.status === 'inscrito'; });
            var interessados = active.filter(function (r) { return r.status !== 'inscrito'; });
            /* O cabeçalho fala a mesma língua dos filtros logo abaixo: quem
               não foi removida nem confirmada está aguardando uma decisão sua,
               e é o número que se procura ao planejar a próxima turma. */
            var aguardandoHdr = interessados.length;
            var countLabel = all.length + ' interessado' + (all.length !== 1 ? 's' : '') +
              ' · ' + inscritos.length + ' confirmado' + (inscritos.length !== 1 ? 's' : '') +
              (aguardandoHdr ? ' · ' + aguardandoHdr + ' aguardando decisão' : '');

            var card = document.createElement('div');
            card.className = 'turma-admin-card';
            card.id = 'turma-card-' + t.key;
            card.style.background = '#1a2035';

            var hdr = document.createElement('div');
            hdr.className = 'turma-admin-header';
            hdr.style.background = '#1a2035';

            var checkinBadge = '';
            if (finalizada && diaAtivo) {
              checkinBadge = '<span class="turma-status-badge badge-checkin-aberto">CHECK-IN ABERTO · ' + fmtDia(diaAtivo) + '</span>';
            }
            hdr.innerHTML =
              '<div class="turma-admin-title" style="cursor:pointer;user-select:none">' +
                '<span class="turma-toggle-icon" style="color:var(--ink-2);font-size:.8rem;flex-shrink:0;margin-right:6px">▸</span>' +
                '<span class="turma-admin-name">' + esc(t.label) + '</span>' +
                '<span class="turma-admin-dates">(' + t.dates + ')</span>' +
                '<span class="turma-status-badge ' + (finalizada ? 'badge-finalizada' : 'badge-aberta') + '">' +
                  (finalizada ? 'INTERESSE ENCERRADO' : 'ABERTA') + '</span>' +
                '<span class="admin-badge">' + countLabel + '</span>' +
                checkinBadge +
              '</div>' +
              '<div class="turma-admin-actions" id="turma-actions-' + t.key + '"></div>';
            card.appendChild(hdr);

            var actWrap = hdr.querySelector('#turma-actions-' + t.key);
            var primaryWrap = document.createElement('div');
            primaryWrap.className = 'taa-primary';
            var moreBtn = document.createElement('button');
            moreBtn.className = 'btn btn--sm taa-more-btn';
            moreBtn.innerHTML = '&#x22EF;';
            moreBtn.setAttribute('aria-label', 'Mais ações');
            var moreMenu = document.createElement('div');
            moreMenu.className = 'taa-dropdown';

            if (!finalizada) {
              var finBtn = document.createElement('button');
              finBtn.className = 'btn btn--sm btn--primary';
              finBtn.style.cssText = 'padding:6px 12px;box-shadow:none;font-size:.72rem';
              finBtn.textContent = 'Encerrar interesse';
              finBtn.addEventListener('click', (function (tk) {
                return function () { finalizeTurma(tk); };
              })(t.key));
              primaryWrap.appendChild(finBtn);
            } else {
              if (!diaAtivo) {
                var dSel = document.createElement('select');
                dSel.className = 'checkin-dia-select';
                var firstUnused = t.dias.find(function (d) { return !checkinT[d] || Object.keys(checkinT[d]).length === 0; }) || todayISO();
                t.dias.forEach(function (d) {
                  var opt = document.createElement('option');
                  opt.value = d; opt.textContent = fmtDia(d);
                  if (d === firstUnused) opt.selected = true;
                  dSel.appendChild(opt);
                });
                var openBtn = document.createElement('button');
                openBtn.className = 'btn btn--sm btn--primary';
                openBtn.style.cssText = 'padding:6px 12px;box-shadow:none;font-size:.72rem';
                openBtn.textContent = 'Abrir check-in';
                openBtn.addEventListener('click', (function (tk, s) {
                  return function () { openCheckin(tk, s.value); };
                })(t.key, dSel));
                primaryWrap.appendChild(dSel);
                primaryWrap.appendChild(openBtn);
              } else {
                var diaAtivoLabel = document.createElement('span');
                diaAtivoLabel.className = 'checkin-dia-aberto';
                diaAtivoLabel.textContent = fmtDia(diaAtivo);
                var closeBtn2 = document.createElement('button');
                closeBtn2.className = 'btn btn--sm';
                closeBtn2.style.cssText = 'padding:6px 10px;font-size:.72rem;border-color:rgba(255,80,80,.5);color:#ff8080';
                closeBtn2.textContent = 'Fechar check-in';
                closeBtn2.addEventListener('click', (function (tk) {
                  return function () { closeCheckin(tk); };
                })(t.key));
                primaryWrap.appendChild(diaAtivoLabel);
                primaryWrap.appendChild(closeBtn2);
              }
              var qrBtn = document.createElement('button');
              qrBtn.className = 'btn btn--sm';
              qrBtn.style.cssText = 'padding:6px 10px;font-size:.72rem';
              qrBtn.innerHTML = '&#x2318; QR';
              qrBtn.addEventListener('click', (function (tt) { return function () { openQrModal(tt); }; })(t));
              var reopenBtn = document.createElement('button');
              reopenBtn.className = 'btn btn--sm';
              reopenBtn.style.cssText = 'padding:6px 10px;font-size:.72rem';
              reopenBtn.textContent = '↺ Reabrir';
              reopenBtn.addEventListener('click', (function (tk) { return function () { reopenTurma(tk); }; })(t.key));
              moreMenu.appendChild(qrBtn);
              moreMenu.appendChild(reopenBtn);
            }

            var addBtn = document.createElement('button');
            addBtn.className = 'btn btn--sm';
            addBtn.style.cssText = 'padding:6px 10px;font-size:.72rem';
            addBtn.textContent = '＋ Participante';
            addBtn.addEventListener('click', (function (tk) { return function () { addParticipante(tk); }; })(t.key));
            moreMenu.appendChild(addBtn);

            var csvTurmaBtn = document.createElement('button');
            csvTurmaBtn.className = 'btn btn--sm';
            csvTurmaBtn.style.cssText = 'padding:6px 10px;font-size:.72rem';
            csvTurmaBtn.innerHTML = '&#x2193; CSV';
            csvTurmaBtn.addEventListener('click', (function (tt, a, f, ck) {
              return function () { exportTurmaCSV(tt, a, f, ck); };
            })(t, all, finalizada, checkinT));
            moreMenu.appendChild(csvTurmaBtn);

            var listaPresencaBtn = document.createElement('button');
            listaPresencaBtn.className = 'btn btn--sm';
            listaPresencaBtn.style.cssText = 'padding:6px 10px;font-size:.72rem';
            listaPresencaBtn.innerHTML = '&#x1F5A8; Lista de presença';
            listaPresencaBtn.addEventListener('click', (function (tt, a, f, ck) {
              return function () { imprimirListaPresenca(tt, a, f, ck); };
            })(t, all, finalizada, checkinT));
            moreMenu.appendChild(listaPresencaBtn);

            var avalBtn = document.createElement('button');
            avalBtn.className = 'btn btn--sm';
            avalBtn.style.cssText = 'padding:6px 10px;font-size:.72rem;' + (t.avaliacaoHabilitada ? 'border-color:rgba(26,178,174,.5);color:var(--cyan)' : 'border-color:rgba(245,197,66,.4);color:var(--accent)');
            avalBtn.textContent = t.avaliacaoHabilitada ? '🔒 Encerrar avaliação' : '📋 Liberar avaliação';
            avalBtn.addEventListener('click', (function (tk, tl, habilitada) {
              return function () {
                var msg = habilitada
                  ? 'Encerrar a avaliação da turma "' + tl + '"?\n\nOs inscritos não verão mais a aba Avaliação.'
                  : 'Liberar a avaliação da turma "' + tl + '"?\n\nOs inscritos confirmados passarão a ver a aba Avaliação.';
                adminConfirm(msg, function () {
                  firebase.database().ref('turmas/' + tk + '/avaliacaoHabilitada').set(!habilitada, function (err) {
                    if (!err) loadInterests();
                  });
                });
              };
            })(t.key, t.label, t.avaliacaoHabilitada));
            moreMenu.appendChild(avalBtn);

            if (finalizada && !encerrada) {
              var encerrarBtn = document.createElement('button');
              encerrarBtn.className = 'btn btn--sm';
              encerrarBtn.style.cssText = 'padding:6px 10px;font-size:.72rem;border-color:rgba(255,165,0,.4);color:#ffb347';
              encerrarBtn.textContent = '✓ Encerrar turma';
              encerrarBtn.addEventListener('click', (function (tk, tl) {
                return function () {
                  adminConfirm('Marcar a turma "' + tl + '" como encerrada?\n\nO card público passará a exibir "Turma realizada" — sem botão de inscrição.', function () {
                    var db = firebase.database();
                    db.ref('turmas-config/' + tk + '/dataConclusao').once('value', function (snap) {
                      var updates = {};
                      updates['turmas-config/' + tk + '/encerrada'] = true;
                      if (!snap.val()) updates['turmas-config/' + tk + '/dataConclusao'] = todayISO();
                      db.ref().update(updates, function (err) {
                        if (err) { adminAlert('Erro ao encerrar. Tente novamente.'); return; }
                        loadInterests();
                      });
                    });
                  });
                };
              })(t.key, t.label));
              moreMenu.appendChild(encerrarBtn);
            }

            /* Sorteio — só entra quem está confirmado na turma */
            var sorteioBtn = document.createElement('button');
            sorteioBtn.className = 'btn btn--sm';
            sorteioBtn.style.cssText = 'padding:6px 10px;font-size:.72rem';
            sorteioBtn.innerHTML = '&#x1F3B2; Sorteio';
            sorteioBtn.title = inscritos.length
              ? 'Sortear entre os ' + inscritos.length + ' participantes confirmados'
              : 'Nenhum participante confirmado nesta turma ainda';
            sorteioBtn.disabled = !inscritos.length;
            sorteioBtn.addEventListener('click', (function (tt, conf) {
              return function () { openSorteioModal(tt, conf); };
            })(t, inscritos));
            moreMenu.appendChild(sorteioBtn);

            var editTurmaBtn = document.createElement('button');
            editTurmaBtn.className = 'btn btn--sm';
            editTurmaBtn.style.cssText = 'padding:6px 10px;font-size:.72rem';
            editTurmaBtn.innerHTML = '&#x270E; Editar turma';
            editTurmaBtn.addEventListener('click', (function (tt) { return function () { openTurmaFormModal(tt); }; })(t));
            moreMenu.appendChild(editTurmaBtn);

            var delTurmaBtn = document.createElement('button');
            delTurmaBtn.className = 'btn btn--sm';
            delTurmaBtn.style.cssText = 'padding:6px 10px;font-size:.72rem;border-color:rgba(255,80,80,.5);color:#ff8080';
            delTurmaBtn.innerHTML = '&#x1F5D1; Excluir turma';
            delTurmaBtn.addEventListener('click', (function (tt, act, rem) {
              return function () { deleteTurma(tt, act, rem); };
            })(t, active, removed));
            moreMenu.appendChild(delTurmaBtn);

            moreBtn.addEventListener('click', function (e) {
              e.stopPropagation();
              var willOpen = !moreMenu.classList.contains('open');
              moreMenu.classList.toggle('open');
              if (willOpen) {
                /* Abre pra cima se não houver espaço suficiente embaixo
                   (ex: card perto do rodapé da página) */
                moreMenu.classList.remove('taa-dropdown--up');
                var rect = moreMenu.getBoundingClientRect();
                var espacoEmbaixo = window.innerHeight - rect.bottom;
                if (espacoEmbaixo < 0) moreMenu.classList.add('taa-dropdown--up');
              }
            });
            document.addEventListener('click', function () { moreMenu.classList.remove('open'); });

            actWrap.appendChild(primaryWrap);
            actWrap.appendChild(moreBtn);
            actWrap.appendChild(moreMenu);

            var body = document.createElement('div');
            body.className = 'turma-admin-body';
            if (!active.length) {
              body.innerHTML = '<p class="admin-empty">Nenhum participante ativo.</p>';
            } else {
              /* ── Filtros por DESTINO ─────────────────────────────────────
                 Antes havia só "ativos" contra "removidos", e "não
                 confirmado" juntava quem ainda não foi analisada com quem
                 já teve destino decidido. Agora cada pessoa que manifestou
                 interesse está em exatamente um grupo, e "Todos" mostra o
                 total real de interessados na turma — incluindo quem saiu.

                 Aguardando decisão = ainda não confirmada E ainda sem
                 destino: é o que de fato exige ação sua. */
              var naEspera   = removed.filter(function (r) { return r.movedToEspera; });
              var outraTurma = removed.filter(function (r) { return !r.movedToEspera && r.removedParaTurma; });
              var saiu       = removed.filter(function (r) { return !r.movedToEspera && !r.removedParaTurma; });
              /* "Aguardando decisão" é quem ainda não foi removida E ainda
                 não foi confirmada. Antes esse conjunto vinha partido em dois
                 botões ("Aguardando decisão" e "Não confirmados"), separados
                 só por ter ou não um motivo anotado no "Justificar…". Com o
                 motivo virando coisa de quem sai, sobrou um grupo só — e o
                 nome que diz o que falta: decidir. */
              var aguardando = interessados;

              var GRUPOS = [
                { key: 'todos',       label: 'Todos os interessados', lista: all,        removida: false },
                { key: 'confirmados', label: 'Confirmados',           lista: inscritos,  removida: false },
                { key: 'aguardando',  label: 'Aguardando decisão',    lista: aguardando, removida: false },
                { key: 'espera',      label: 'Foram para a espera',   lista: naEspera,   removida: true  },
                { key: 'outra_turma', label: 'Foram para outra turma', lista: outraTurma, removida: true  },
                { key: 'removidos',   label: 'Removidos',             lista: saiu,       removida: true  },
              ];

              var filtroStatus = _uiFiltroStatus[t.key] || 'todos';
              var tabelaWrap = document.createElement('div');

              function grupoAtual() {
                for (var i = 0; i < GRUPOS.length; i++) if (GRUPOS[i].key === filtroStatus) return GRUPOS[i];
                return GRUPOS[0];
              }

              var redesenharTabela = function () {
                var g = grupoAtual();
                tabelaWrap.innerHTML = '';
                if (!g.lista.length) {
                  tabelaWrap.innerHTML = '<p class="admin-empty">Ninguém neste grupo.</p>';
                  return;
                }
                /* Quem já saiu da turma não tem ação possível — a tabela de
                   quem saiu mostra o motivo e o destino, não botões. */
                if (g.removida) {
                  /* As colunas de dia só entram aqui quando alguém do grupo
                     realmente tem presença registrada. Quem saiu sem nunca ter
                     sido confirmada — o caso comum — não tem check-in nenhum,
                     e a tabela virava cinco colunas de traço empurrando motivo
                     e destino para fora da tela. Quando existe presença, ela
                     continua aparecendo: o histórico de quem participou e
                     depois saiu é justamente o que não pode se perder. */
                  tabelaWrap.appendChild(finalizada && algumTemPresenca(t, g.lista, checkinT)
                    ? buildRemovedPresencaTable(t, g.lista, checkinT)
                    : buildRemovedInteressadosTable(t, g.lista));
                  return;
                }
                if (g.key === 'todos') {
                  tabelaWrap.appendChild(buildParticipantesTable(t, active, checkinT, finalizada));
                  if (removed.length) {
                    var nota = document.createElement('p');
                    nota.className = 'admin-empty';
                    nota.style.marginTop = '10px';
                    nota.textContent = '+ ' + removed.length + ' que já saíram da turma — veja em "Foram para a espera" e "Removidos".';
                    tabelaWrap.appendChild(nota);
                  }
                  return;
                }
                tabelaWrap.appendChild(buildParticipantesTable(t, g.lista, checkinT, finalizada));
              };

              /* A barra some quando há um grupo só: filtro de uma coisa
                 apenas é ruído. */
              if (GRUPOS.filter(function (g) { return g.lista.length; }).length > 1) {
                var filtroBar = document.createElement('div');
                filtroBar.className = 'turma-status-filtro';
                GRUPOS.forEach(function (g) {
                  if (!g.lista.length && g.key !== 'todos') return;
                  var b = document.createElement('button');
                  b.type = 'button';
                  b.className = 'turma-status-filtro-btn' + (g.key === filtroStatus ? ' active' : '');
                  b.textContent = g.label + ' (' + g.lista.length + ')';
                  b.addEventListener('click', function () {
                    filtroStatus = g.key;
                    _uiFiltroStatus[t.key] = g.key;
                    filtroBar.querySelectorAll('.turma-status-filtro-btn').forEach(function (x) { x.classList.remove('active'); });
                    b.classList.add('active');
                    redesenharTabela();
                  });
                  filtroBar.appendChild(b);
                });
                body.appendChild(filtroBar);
              }

              redesenharTabela();
              body.appendChild(tabelaWrap);
            }
            /* O acordeão "Removidos" saiu: quem saiu da turma agora aparece
               nos filtros por destino, separado entre "Foram para a espera" e
               "Removidos" — que diz mais do que a lista única de antes. */
            var turmaAberta = !!_uiTurmasAbertas[t.key];
            body.style.display = turmaAberta ? '' : 'none';
            card.appendChild(body);
            var titleDiv = hdr.querySelector('.turma-admin-title');
            var turmaToggleIcon = hdr.querySelector('.turma-toggle-icon');
            turmaToggleIcon.textContent = turmaAberta ? '▾' : '▸';
            titleDiv.addEventListener('click', function () {
              var collapsed = body.style.display === 'none';
              body.style.display = collapsed ? '' : 'none';
              turmaToggleIcon.textContent = collapsed ? '▾' : '▸';
              _uiTurmasAbertas[t.key] = collapsed;
            });
            return card;
          }

          /* ── Renderizar eventos com turmas agrupadas ────────────────────── */
          EVENTOS_LIST.forEach(function (ev) {
            var turmasEvento = TURMAS_LIST.filter(function (t) { return t.eventoKey === ev.key; });

            var evSection = document.createElement('div');
            /* overflow:visible — não pode ser hidden: os cards de turma dentro
               têm menu "⋯" posicionado absoluto, que corta se um ancestral
               qualquer clipar o conteúdo. Arredondamento replicado no header/
               body abaixo em vez de depender do clip (mesmo motivo do fix em
               .turma-admin-card). */
            evSection.style.cssText = 'border:1px solid var(--line-strong);border-radius:8px;margin-bottom:24px;overflow:visible';
            evSection.setAttribute('data-ev-key', ev.key);

            /* cabeçalho do evento — clicável para expandir/recolher */
            var evHdr = document.createElement('div');
            evHdr.style.cssText = 'display:flex;align-items:center;gap:12px;padding:14px 18px;background:var(--panel-2);border-bottom:1px solid var(--line-strong);cursor:pointer;user-select:none;border-radius:8px 8px 0 0';
            var evToggleIcon = document.createElement('span');
            evToggleIcon.className = 'ev-toggle-icon';
            evToggleIcon.style.cssText = 'color:var(--ink-2);font-size:.85rem;flex-shrink:0;transition:transform .15s';
            evToggleIcon.textContent = '▸';
            var evNome = document.createElement('span');
            evNome.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--font-head);letter-spacing:.06em;font-size:.9rem;color:var(--ink)';
            evNome.textContent = ev.nome;
            var evMeta = document.createElement('span');
            evMeta.style.cssText = 'color:var(--ink-2);font-size:.85rem;white-space:nowrap';
            evMeta.textContent = ev.cargaHoraria + 'h · ' + turmasEvento.length + ' turma' + (turmasEvento.length !== 1 ? 's' : '');
            var evEditBtn = document.createElement('button');
            evEditBtn.className = 'btn btn--sm';
            evEditBtn.style.cssText = 'padding:4px 10px;font-size:.72rem';
            evEditBtn.innerHTML = '&#x270E; Editar evento';
            evEditBtn.addEventListener('click', function (e) { e.stopPropagation(); openEventoFormModal(ev); });
            var evNewTurmaBtn = document.createElement('button');
            evNewTurmaBtn.className = 'btn btn--sm btn--primary';
            evNewTurmaBtn.style.cssText = 'padding:4px 10px;font-size:.72rem';
            evNewTurmaBtn.innerHTML = '+ Nova turma';
            evNewTurmaBtn.addEventListener('click', function (e) { e.stopPropagation(); openTurmaFormModal(null, ev.key); });
            evHdr.appendChild(evToggleIcon);
            evHdr.appendChild(evNome);
            evHdr.appendChild(evMeta);
            /* Evento fora do ar continua INTEIRO aqui: turmas, participantes,
               fila, presença, certificado — tudo se gerencia igual. Some só da
               página das pessoas. Sem este selo, não haveria como saber olhando
               o painel que ele não está sendo divulgado. Entra depois do meta e
               antes dos botões, com evEditBtn já filho do cabeçalho. */
            if (!ev.publicado) {
              var evOff = document.createElement('span');
              evOff.textContent = 'fora da página';
              evOff.title = 'Este evento não aparece na página Turmas. Ninguém foi removido: inscritas, fila e acessos continuam iguais.';
              evOff.style.cssText = 'flex-shrink:0;font-family:var(--font-mono);font-size:.62rem;letter-spacing:.08em;' +
                'text-transform:uppercase;color:var(--ink-2);border:1px solid var(--line-strong);' +
                'border-radius:99px;padding:3px 9px;white-space:nowrap';
              evHdr.appendChild(evOff);
            }
            /* Restrito a diretores: mesmo raciocínio do selo acima — sem ele,
               não dá pra saber olhando o painel que o resto das pessoas não
               vê este evento na página Turmas. */
            if (ev.restritoADiretores) {
              var evRestrito = document.createElement('span');
              evRestrito.textContent = 'só diretores/admin';
              evRestrito.title = 'Este evento só aparece na página Turmas para quem está na aba Diretores ou é administrador. Para os demais, some da vitrine como se estivesse fora da página.';
              evRestrito.style.cssText = 'flex-shrink:0;font-family:var(--font-mono);font-size:.62rem;letter-spacing:.08em;' +
                'text-transform:uppercase;color:var(--gold);border:1px solid rgba(245,197,24,.5);' +
                'border-radius:99px;padding:3px 9px;white-space:nowrap';
              evHdr.appendChild(evRestrito);
            }
            evHdr.appendChild(evEditBtn);
            evHdr.appendChild(evNewTurmaBtn);
            evSection.appendChild(evHdr);

            /* turmas do evento — começa recolhido */
            var turmasWrap = document.createElement('div');
            turmasWrap.className = 'ev-turmas-wrap';
            var evAberto = !!_uiEventosAbertos[ev.key];
            turmasWrap.style.cssText = 'padding:16px;display:' + (evAberto ? 'flex' : 'none') + ';flex-direction:column;gap:16px';
            evToggleIcon.textContent = evAberto ? '▾' : '▸';
            evHdr.addEventListener('click', function () {
              var collapsed = turmasWrap.style.display === 'none';
              turmasWrap.style.display = collapsed ? 'flex' : 'none';
              evToggleIcon.textContent = collapsed ? '▾' : '▸';
              _uiEventosAbertos[ev.key] = collapsed;
            });
            if (!turmasEvento.length) {
              var tEmpty = document.createElement('p');
              tEmpty.className = 'admin-empty';
              tEmpty.style.marginBottom = '0';
              tEmpty.textContent = 'Nenhuma turma neste evento. Clique em "+ Nova turma" para criar.';
              turmasWrap.appendChild(tEmpty);
            } else {
              turmasEvento.forEach(function (t) { turmasWrap.appendChild(buildTurmaCard(t)); });
            }
            evSection.appendChild(turmasWrap);
            c.appendChild(evSection);
          });

          /* ── Turmas sem evento ──────────────────────────────────────────── */
          var semEvento = TURMAS_LIST.filter(function (t) { return !t.eventoKey; });
          if (semEvento.length) {
            var semEventoSection = document.createElement('div');
            semEventoSection.style.cssText = 'border:1px solid rgba(255,165,0,.3);border-radius:8px;margin-bottom:24px;overflow:visible';
            var semEventoHdr = document.createElement('div');
            semEventoHdr.style.cssText = 'display:flex;align-items:center;gap:10px;padding:12px 18px;background:var(--panel-2);border-bottom:1px solid rgba(255,165,0,.3);border-radius:8px 8px 0 0';
            semEventoHdr.innerHTML = '<span style="color:#ffb347;font-size:.8rem;font-family:var(--font-head);letter-spacing:.08em">⚠ TURMAS SEM EVENTO</span>' +
              '<span style="color:var(--ink-2);font-size:.82rem;flex:1">Edite cada turma e vincule a um evento.</span>';
            semEventoSection.appendChild(semEventoHdr);
            var semEventoWrap = document.createElement('div');
            semEventoWrap.style.cssText = 'padding:16px;display:flex;flex-direction:column;gap:16px';
            semEvento.forEach(function (t) { semEventoWrap.appendChild(buildTurmaCard(t)); });
            semEventoSection.appendChild(semEventoWrap);
            c.appendChild(semEventoSection);
          }

          /* Lista de Espera entra dentro do card de cada evento — precisa dos
             containers `.ev-turmas-wrap` já no DOM, por isso só depois de
             todos os c.appendChild(evSection) acima. */
          loadEspera();

          /* ── Callbacks: filtro e expand/collapse ─────────────────────────── */
          function setEvExpanded(evSec, expanded) {
            var tw = evSec.querySelector('.ev-turmas-wrap');
            var icon = evSec.querySelector('.ev-toggle-icon');
            if (tw) tw.style.display = expanded ? 'flex' : 'none';
            if (icon) icon.textContent = expanded ? '▾' : '▸';
            _uiEventosAbertos[evSec.getAttribute('data-ev-key')] = expanded;
          }
          function setTurmaExpanded(cardEl, expanded) {
            var b = cardEl.querySelector('.turma-admin-body');
            var icon = cardEl.querySelector('.turma-toggle-icon');
            if (b) b.style.display = expanded ? '' : 'none';
            if (icon) icon.textContent = expanded ? '▾' : '▸';
            _uiTurmasAbertas[cardEl.id.replace('turma-card-', '')] = expanded;
          }
          expandAllBtn.addEventListener('click', function () {
            Array.from(c.querySelectorAll('[data-ev-key]')).forEach(function (sec) { setEvExpanded(sec, true); });
            Array.from(c.querySelectorAll('.turma-admin-card')).forEach(function (cd) { setTurmaExpanded(cd, true); });
          });
          collapseAllBtn.addEventListener('click', function () {
            Array.from(c.querySelectorAll('[data-ev-key]')).forEach(function (sec) { setEvExpanded(sec, false); });
            Array.from(c.querySelectorAll('.turma-admin-card')).forEach(function (cd) { setTurmaExpanded(cd, false); });
          });
          function aplicarFiltroEvento(expandirEscolhido) {
            var chosen = filterSel.value;
            Array.from(c.querySelectorAll('[data-ev-key]')).forEach(function (sec) {
              var matches = !chosen || sec.getAttribute('data-ev-key') === chosen;
              sec.style.display = matches ? '' : 'none';
              if (matches && chosen && expandirEscolhido) setEvExpanded(sec, true);
            });
          }
          filterSel.addEventListener('change', function () {
            _uiFiltroEvento = filterSel.value;
            aplicarFiltroEvento(true);
          });
          /* Reaplica o filtro escolhido antes do redesenho — sem expandir de
             novo, para não desfazer o que a pessoa recolheu na mão. */
          if (_uiFiltroEvento) {
            filterSel.value = _uiFiltroEvento;
            if (filterSel.value !== _uiFiltroEvento) _uiFiltroEvento = '';  /* evento apagado nesse meio-tempo */
            else aplicarFiltroEvento(false);
          }

          /* Devolve a rolagem ao ponto onde a pessoa estava. */
          if (!primeiraVez && scrollAntes) {
            requestAnimationFrame(function () { window.scrollTo(0, scrollAntes); });
          }
        });
      });
    });
    });
    });
  }

  /* Tabela única de participantes — usada em qualquer estado da turma (aberta
     ou com interesse encerrado). Confirmar/Desconfirmar/Adicionar/Remover não
     dependem de a turma estar encerrada: a inscrição real acontece no CMFlex,
     que não espera o portal fechar a captação de interesse. As colunas de
     presença/frequência exigem duas coisas: turma com interesse encerrado,
     porque o check-in em si (abrir dia, escanear QR) só existe aí, E alguém
     confirmada na lista, porque só ela pode ter presença. */
  function buildParticipantesTable(t, records, checkinT, finalizada) {
    var minDias = Math.ceil(t.dias.length * CRITERIO_PRESENCA);
    var wrap = document.createElement('div');
    wrap.className = 'table-scroll-wrap';

    /* Presença só existe para quem foi confirmada. Numa lista em que ninguém
       é — o filtro "Aguardando decisão" — as colunas de dia sairiam todas com
       traço e ainda empurrariam a coluna de ações para fora da tela, fazendo
       parecer que não dá mais para confirmar ou remover. Mesma regra já usada
       na lista de quem saiu. */
    var comPresenca = finalizada && records.some(function (r) { return r.status === 'inscrito'; });

    var tbl = '<table class="admin-table participantes-table' + (comPresenca ? ' presenca-table' : '') + '"><thead><tr>' +
      '<th>Nome</th><th>E-mail</th><th>Área</th><th>Status</th>';
    if (comPresenca) {
      t.dias.forEach(function (d) { tbl += '<th class="dia-th">' + fmtDia(d) + '</th>'; });
      tbl += '<th>Freq.</th>';
    } else {
      tbl += '<th>Data registro</th>';
    }
    tbl += '<th></th></tr></thead><tbody>';

    records.forEach(function (r) {
      var eKey = emailKeyFromEmail(r.email);
      var isInscrito = r.status === 'inscrito';
      /* Registros anteriores ao fim do "Justificar…" ainda carregam
         motivoNaoConfirmado. O selo continua sendo desenhado para não
         apagar da tela o que já foi anotado — mas nada grava esse campo
         hoje, e essas pessoas voltaram a aparecer como aguardando decisão,
         que é o que de fato falta nelas. */
      var motivoBadge = '';
      if (!isInscrito && r.motivoNaoConfirmado) {
        var ondeFez = r.motivoNaoConfirmado === 'ja_participou' ? ondeJaParticipou(eKey, t.key) : [];
        var motivoLabel = r.motivoNaoConfirmado === 'sem_vagas' ? 'Sem vagas'
          : r.motivoNaoConfirmado === 'ja_participou'
              ? ('Já participou' + (ondeFez.length ? ' · ' + ondeFez.map(function (x) { return x.label; }).join(', ') : ''))
          : 'Substituída';
        var motivoCls = r.motivoNaoConfirmado === 'sem_vagas' ? 'motivo-sem-vagas'
          : r.motivoNaoConfirmado === 'ja_participou' ? 'motivo-ja-participou'
          : 'motivo-substituida';
        var porQuem = (r.motivoNaoConfirmado === 'substituida' && r.substituidaPorNome)
          ? ' por ' + r.substituidaPorNome : '';
        motivoBadge = '<span class="motivo-badge ' + motivoCls + '" title="' + esc(motivoLabel + porQuem) + '">' +
          motivoLabel + (porQuem ? ' <span class="motivo-porquem">' + esc(r.substituidaPorNome) + '</span>' : '') + '</span>';
      }
      var statusCell = '<td><span class="status-badge ' + (isInscrito ? 'status-inscrito">Inscrito' : 'status-interessado">Interessado') + '</span>' + motivoBadge + '</td>';

      var midCells;
      if (comPresenca) {
        if (!isInscrito) {
          midCells = t.dias.map(function () { return '<td class="dia-cell">—</td>'; }).join('') + '<td>—</td>';
        } else {
          var diasPresente = 0;
          var cells = t.dias.map(function (d) {
            var ck = checkinT[d] && checkinT[d][eKey];
            if (ck) {
              diasPresente++;
              var ra = 'data-turma="' + t.key + '" data-dia="' + d + '" data-ekey="' + eKey + '" data-name="' + esc(r.name) + '"';
              var badge = ck.source === 'admin'
                ? '<button class="ck-badge ck-adm ck-undo-btn" title="Remover presença (admin)" ' + ra + '>✓ adm</button>'
                : '<button class="ck-badge ck-qr ck-undo-btn" title="Remover presença (QR)" ' + ra + '>✓ qr</button>';
              return '<td class="dia-cell">' + badge + '</td>';
            }
            /* botão para registrar retroativo */
            return '<td class="dia-cell"><button class="ck-manual-btn" ' +
              'data-turma="' + t.key + '" data-dia="' + d + '" ' +
              'data-ekey="' + eKey + '" data-name="' + esc(r.name) + '" ' +
              'data-email="' + esc(r.email) + '" data-area="' + esc(r.area || '') + '"' +
              '>—</button></td>';
          });
          var freq = diasPresente + '/' + t.dias.length;
          var atingiu = diasPresente >= minDias;
          var freqClass = atingiu ? 'freq-ok' : 'freq-nok';
          midCells = cells.join('') + '<td><span class="' + freqClass + '">' + freq + '</span></td>';
        }
      } else {
        midCells = '<td>' + fmtDate(r.date) + '</td>';
      }

      /* O seletor "Justificar…" saiu daqui. Ele criava um terceiro estado —
         "não confirmada, com um motivo, mas ainda na turma" — que não existe
         na prática: sem vagas, já participou ou substituída são razões para
         confirmar ou remover, não para deixar a pessoa parada na lista. Os
         três motivos viraram motivos de remoção. */
      var actionBtn = isInscrito
        ? '<button class="cf-unconfirm-btn" data-turma="' + t.key + '" data-ekey="' + eKey + '" data-name="' + esc(r.name) + '" data-email="' + esc(r.email) + '" data-area="' + esc(r.area || '') + '">Desconfirmar</button>'
        : '<button class="cf-confirm-btn" data-turma="' + t.key + '" data-ekey="' + eKey + '" data-name="' + esc(r.name) + '" data-email="' + esc(r.email) + '" data-area="' + esc(r.area || '') + '">Confirmar</button>';

      var dateOriginal = r.date || new Date().toISOString();
      tbl += '<tr><td>' + esc(r.name) + '</td><td>' + esc(r.email) + '</td><td>' +
        esc(r.area || '—') + '</td>' + statusCell + midCells +
        '<td class="turma-row-actions">' + actionBtn +
          /* Um caminho só: sair da turma. Ir para a lista de espera virou
             uma escolha DENTRO da remoção — na prática sempre foi a mesma
             decisão, com dois botões e duas listas de motivo que se
             sobrepunham ("sem vagas" e "a pedido" estavam nas duas). */
          '<button class="ck-remove-btn" data-turma="' + t.key + '" data-ekey="' + eKey + '" data-name="' + esc(r.name) + '" data-email="' + esc(r.email) + '" data-area="' + esc(r.area || '') + '" data-date="' + esc(dateOriginal) + '">Remover</button>' +
        '</td></tr>';
    });

    tbl += '</tbody></table>';
    wrap.innerHTML = tbl;

    /* delegação de eventos: confirmar/desconfirmar, desfazer check-in, check-in manual, remoção */
    wrap.addEventListener('click', function (e) {
      var confirmBtn = e.target.closest('.cf-confirm-btn');
      if (confirmBtn) {
        confirmarInscrito(confirmBtn.dataset.turma, confirmBtn.dataset.ekey, { name: confirmBtn.dataset.name, email: confirmBtn.dataset.email, area: confirmBtn.dataset.area });
        return;
      }
      var unconfirmBtn = e.target.closest('.cf-unconfirm-btn');
      if (unconfirmBtn) {
        desconfirmarInscrito(unconfirmBtn.dataset.turma, unconfirmBtn.dataset.ekey, { name: unconfirmBtn.dataset.name, email: unconfirmBtn.dataset.email, area: unconfirmBtn.dataset.area });
        return;
      }
      var undoBtn = e.target.closest('.ck-undo-btn');
      if (undoBtn) {
        adminConfirm('Remover presença de ' + undoBtn.dataset.name + ' em ' + fmtDia(undoBtn.dataset.dia) + '?', function () {
          firebase.database().ref('turmas-checkin/' + undoBtn.dataset.turma + '/' + undoBtn.dataset.dia + '/' + undoBtn.dataset.ekey).remove(function (err) {
            if (err) { adminAlert('Erro ao remover presença.'); return; }
            loadInterests();
          });
        });
        return;
      }
      var btn = e.target.closest('.ck-manual-btn');
      if (btn) {
        adminCheckin(btn.dataset.turma, btn.dataset.dia, btn.dataset.ekey, {
          name: btn.dataset.name, email: btn.dataset.email, area: btn.dataset.area
        });
        return;
      }
      /* O botão "→ Espera" deixou de existir: ir para a fila virou uma
         opção dentro de "Remover". O tratador dele saiu junto para não
         ficar código apontando para um botão que ninguém mais desenha. */
      var remBtn = e.target.closest('.ck-remove-btn');
      if (remBtn) {
        var sess2 = window.faAuth && window.faAuth.getSession();
        /* Remover passou a exigir motivo, como já acontece na lista de
           espera: sem isso a tabela de Removidos dizia só "Removida pelo
           admin", e o porquê se perdia — inclusive o caso mais comum, que
           é a própria pessoa ter pedido para sair. */
        adminConfirmComMotivo(
          'Remover ' + remBtn.dataset.name + ' da turma?\n\nEla sairá da lista de participantes. O histórico de presença é preservado.',
          MOTIVOS_REMOCAO_TURMA,
          function (motivo, detalhe, turmaDestino, paraEspera) {
            var pessoa = {
              name:  remBtn.dataset.name,
              email: remBtn.dataset.email,
              area:  remBtn.dataset.area || '',
              /* A fila respeita a ordem de chegada: vai sempre a data e hora
                 do interesse ORIGINAL, nunca a data da remoção. */
              date:  remBtn.dataset.date
            };

            function aplicar(subst) {
              var razao = subst ? ('Substituída por ' + subst.name) : (detalhe || motivoEsperaLabel(motivo));
              if (paraEspera) {
                migrarParaEspera(remBtn.dataset.turma, remBtn.dataset.ekey, pessoa, motivo, razao, subst);
                return;
              }
              /* "Já participou" também escolhe uma turma, mas a que ela JÁ
                 FEZ — guardar isso como destino a mandaria para o filtro
                 "Foram para outra turma", que é outra situação. */
              var destino = (turmaDestino && !turmaDestino.jaFeita) ? turmaDestino : null;
              var updates = {
                removed: true,
                removedParaTurma:      destino ? destino.key   : null,
                removedParaTurmaLabel: destino ? destino.label : null,
                removedDate: new Date().toISOString(),
                removedReason: razao,
                removedMotivo: motivo || null
              };
              if (turmaDestino && turmaDestino.jaFeita) {
                updates.jaParticipouTurma      = turmaDestino.key;
                updates.jaParticipouTurmaLabel = turmaDestino.label;
              }
              if (subst) {
                updates.substituidaPor      = subst.email || null;
                updates.substituidaPorNome  = subst.name  || null;
                updates.substituidaEm       = new Date().toISOString();
                updates.substituidaPorAdmin = sess2 ? (sess2.name || sess2.email) : null;
              }
              if (sess2) { updates.removedByAdmin = sess2.email; updates.removedByAdminName = sess2.name || sess2.email; }
              firebase.database().ref('turmas-interesse/' + remBtn.dataset.turma + '/' + remBtn.dataset.ekey).update(updates, function (err) {
                if (!err) loadInterests();
              });
            }

            /* "Substituída" é o único motivo que precisa de uma segunda
               pergunta: sem dizer QUEM ficou com a vaga, o registro não
               responde o que se pergunta depois. Cancelar aí desiste da
               remoção inteira — melhor do que gravar meia informação. */
            if (motivo === 'substituida') {
              escolherSubstituta(remBtn.dataset.turma, remBtn.dataset.ekey, remBtn.dataset.name, function (quem) {
                if (quem) aplicar(quem);
              });
              return;
            }
            aplicar(null);
          },
          { label: 'Colocar na lista de espera (mantém a data original do interesse)' },
          ondeJaParticipou(remBtn.dataset.ekey, remBtn.dataset.turma));
      }
    });

    return wrap;
  }

  /* Removidos de uma turma ainda aberta — só leitura, com o motivo quando houver */
  /* Para onde a pessoa foi ao sair da turma. Antes isso ficava espremido
     dentro da célula de motivo, então não dava para varrer a coluna e
     responder "quem foi para outra turma, e qual?". */
  function destinoDeQuemSaiu(r) {
    if (r.movedToEspera)        return '<span class="destino-badge destino-espera">Lista de espera</span>';
    if (r.removedParaTurmaLabel) return '<span class="destino-badge destino-turma">' + esc(r.removedParaTurmaLabel) + '</span>';
    /* Quem saiu porque outra pessoa ficou com a vaga não é a mesma coisa que
       "saiu": o motivo aparece na coluna ao lado com o nome de quem entrou,
       mas a coluna Destino é a que se varre com o olho. */
    if (r.removedMotivo === 'substituida') return '<span class="destino-badge destino-substituida">Substituída</span>';
    return '<span class="destino-badge destino-saiu">Saiu</span>';
  }

  /* Quem tirou a pessoa da turma. A tela escrevia "Removida pelo admin"
     sempre que o motivo estava vazio — afirmando uma autoria que ela não
     conhecia: quem tira o próprio interesse pelo site também deixa o motivo
     vazio e aparecia como removida pelo admin. Agora só se afirma o que está
     gravado — o nome de quem removeu (só a remoção pelo painel grava), o
     status "removido" (só a saída pelo site grava), ou nada. */
  /* Três motivos pedem uma segunda resposta. Quando ela falta, o motivo
     está incompleto — não errado: "Já participou de uma turma" sem dizer
     qual, "Vai fazer em outra turma" sem a turma, "Substituída" sem quem.
     Isso é lacuna, e lacuna se preenche. */
  function motivoIncompleto(r) {
    if (!r.removedReason) return false;
    if (r.removedMotivo === 'ja_participou') return !r.jaParticipouTurmaLabel;
    if (r.removedMotivo === 'outra_turma')   return !r.removedParaTurmaLabel;
    if (r.removedMotivo === 'substituida')   return !r.substituidaPorNome;
    return false;
  }

  function motivoDeQuemSaiu(t, r) {
    var motivo = r.removedReason
      ? esc(r.removedReason)
      : '<span class="removido-sem-motivo">motivo não registrado</span>';
    var notas = [];
    if (r.removedByAdminName)         notas.push('por ' + r.removedByAdminName);
    else if (r.status === 'removido') notas.push('pela própria pessoa');
    /* O motivo preenchido depois não é a mesma coisa que o motivo capturado
       na hora da saída — o registro diz qual dos dois é. */
    if (r.motivoCompletadoPor)      notas.push('motivo completado depois por ' + r.motivoCompletadoPor);
    else if (r.motivoRegistradoPor) notas.push('motivo registrado depois por ' + r.motivoRegistradoPor);
    var linha = notas.length ? '<span class="removido-por">' + esc(notas.join(' · ')) + '</span>' : '';
    /* O botão aparece nas duas lacunas — motivo ausente e motivo sem o
       complemento — e em mais nada: escolha já registrada e completa não se
       reescreve por aqui. */
    var falta = !r.removedReason ? 'registrar' : (motivoIncompleto(r) ? 'completar' : '');
    var botao = !falta ? '' :
      '<button class="motivo-add-btn" data-turma="' + t.key + '" data-ekey="' + emailKeyFromEmail(r.email) +
      '" data-name="' + esc(r.name) + '" data-quando="' + esc(r.removedDate || '') +
      '" data-motivo="' + esc(falta === 'completar' ? (r.removedMotivo || '') : '') + '">+ ' + falta + ' motivo</button>';
    /* Sair da turma é reversível e fica no histórico; isto aqui não. Só
       aparece depois da remoção, então excluir de vez exige duas decisões
       separadas — é o que se quer numa ação que não dá para desfazer. */
    var excluir =
      '<button class="registro-del-btn" data-turma="' + t.key + '" data-ekey="' + emailKeyFromEmail(r.email) +
      '" data-name="' + esc(r.name) + '">&#x1F5D1; excluir registro</button>';
    return motivo + linha + botao + excluir;
  }

  /* Preenche o motivo de uma saída que ficou em branco — os casos anteriores
     à exigência de motivo, e os de quem saiu pelo site, que não pergunta
     nada. Não desfaz nem refaz a remoção: mexe apenas no motivo. */
  function registrarMotivoDepois(turmaKey, eKey, nome, quando, motivoAtual) {
    var sess = window.faAuth && window.faAuth.getSession();
    var completando = !!motivoAtual;
    adminConfirmComMotivo(
      completando
        ? ('Completar o motivo da saída de ' + nome + '?\n\nO motivo já está registrado, mas falta a informação que ele pede. Isto acrescenta só ela — o motivo, a saída, a data e o destino não mudam.')
        : ('Registrar o motivo da saída de ' + nome + '?\n\nEla saiu da turma em ' + fmtDate(quando) +
           ' e o motivo ficou em branco. Isto preenche só o motivo — a saída, a data e o destino não mudam.'),
      MOTIVOS_REMOCAO_TURMA,
      function (motivo, detalhe, turmaDestino) {
        function gravar(subst) {
          var base = 'turmas-interesse/' + turmaKey + '/' + eKey + '/';
          var u = {};
          u[base + 'removedMotivo'] = motivo;
          u[base + 'removedReason'] = subst ? ('Substituída por ' + subst.name) : (detalhe || motivoEsperaLabel(motivo));
          if (turmaDestino && !turmaDestino.jaFeita) {
            u[base + 'removedParaTurma']      = turmaDestino.key;
            u[base + 'removedParaTurmaLabel'] = turmaDestino.label;
          }
          if (turmaDestino && turmaDestino.jaFeita) {
            u[base + 'jaParticipouTurma']      = turmaDestino.key;
            u[base + 'jaParticipouTurmaLabel'] = turmaDestino.label;
          }
          if (subst) {
            u[base + 'substituidaPor']     = subst.email || null;
            u[base + 'substituidaPorNome'] = subst.name  || null;
          }
          var quemAgora = sess ? (sess.name || sess.email) : null;
          if (completando) {
            u[base + 'motivoCompletadoEm']  = new Date().toISOString();
            u[base + 'motivoCompletadoPor'] = quemAgora;
          } else {
            u[base + 'motivoRegistradoEm']  = new Date().toISOString();
            u[base + 'motivoRegistradoPor'] = quemAgora;
          }
          firebase.database().ref().update(u, function (err) {
            if (err) { adminAlert('Erro ao registrar o motivo. Tente novamente.'); return; }
            loadInterests();
          });
        }
        if (motivo === 'substituida') {
          escolherSubstituta(turmaKey, eKey, nome, function (quem) { if (quem) gravar(quem); });
          return;
        }
        gravar(null);
      },
      null,
      ondeJaParticipou(eKey, turmaKey),
      motivoAtual);
  }

  /* Delegação usada pelas duas tabelas de quem saiu. */
  function ligarBotaoMotivo(wrap) {
    wrap.addEventListener('click', function (e) {
      var b = e.target.closest('.motivo-add-btn');
      if (b) {
        registrarMotivoDepois(b.dataset.turma, b.dataset.ekey, b.dataset.name, b.dataset.quando, b.dataset.motivo || '');
        return;
      }
      var d = e.target.closest('.registro-del-btn');
      if (d) excluirRegistro(d.dataset.turma, d.dataset.ekey, d.dataset.name);
    });
  }

  /* Apaga de vez o registro de uma pessoa numa turma. Existe para o que
     nunca foi uma inscrição de verdade — teste e duplicado —, que a remoção
     comum não resolve: quem é removida continua contando em "Todos os
     interessados", e um registro de teste inflando esse número atrapalha
     justamente a conta que se usa para planejar a próxima turma.

     Some tudo o que aquela pessoa tem NAQUELA turma: o registro, o histórico
     e as presenças. Nas outras turmas e no cadastro dela, nada é tocado. */
  function excluirRegistro(turmaKey, eKey, nome) {
    var t = TURMAS_LIST.filter(function (x) { return x.key === turmaKey; })[0];
    adminConfirm(
      'Excluir definitivamente o registro de ' + nome + ' nesta turma?\n\n' +
      'Não é o mesmo que remover: some da lista de quem saiu, sai da contagem de interessados e leva junto o histórico e as presenças dela nesta turma.\n\n' +
      'Use para registro de teste ou duplicado. Essa ação não pode ser desfeita.',
      function () {
        var updates = {};
        updates['turmas-interesse/' + turmaKey + '/' + eKey] = null;
        updates['turmas-interesse-log/' + turmaKey + '/' + eKey] = null;
        (t && t.dias ? t.dias : []).forEach(function (d) {
          updates['turmas-checkin/' + turmaKey + '/' + d + '/' + eKey] = null;
        });
        firebase.database().ref().update(updates, function (err) {
          if (err) { adminAlert('Erro ao excluir. Tente novamente.'); return; }
          loadInterests();
        });
      });
  }

  function buildRemovedInteressadosTable(t, records) {
    var wrap = document.createElement('div');
    wrap.className = 'table-scroll-wrap';
    /* As duas datas juntas: quando ela manifestou interesse e quando saiu.
       Só a data de saída não responde há quanto tempo a pessoa esperava —
       que é o que pesa na hora de chamar alguém da fila ou de decidir quem
       entra na próxima turma. */
    var tbl = '<table class="admin-table"><thead><tr><th>Nome</th><th>E-mail</th><th>Área</th><th>Data interesse</th><th>Data remoção</th><th>Destino</th><th>Motivo</th></tr></thead><tbody>';
    records.forEach(function (r) {
      /* O motivo sozinho não conta a história toda: para onde ela foi e por
         quem foi substituída são justamente o que se pergunta depois. */
      var extra = '';
      /* Só para registro antigo: hoje o nome de quem entrou já vem dentro de
         removedReason ("Substituída por Fulana"), e repetir viraria eco. */
      if (!r.removedMotivo && r.motivoNaoConfirmado === 'substituida') {
        extra += '<span class="motivo-badge motivo-substituida">Substituída' +
          (r.substituidaPorNome ? ' <span class="motivo-porquem">' + esc(r.substituidaPorNome) + '</span>' : '') + '</span>';
      }
      tbl += '<tr><td>' + esc(r.name) + '</td><td>' + esc(r.email) + '</td><td>' +
        esc(r.area || '—') + '</td><td>' + fmtDate(r.date) + '</td><td>' + fmtDate(r.removedDate) + '</td><td>' +
        destinoDeQuemSaiu(r) + '</td><td>' +
        motivoDeQuemSaiu(t, r) + extra + '</td></tr>';
    });
    wrap.innerHTML = tbl + '</tbody></table>';
    ligarBotaoMotivo(wrap);
    return wrap;
  }

  /* Alguém deste grupo tem presença em algum dia da turma? Decide se a
     tabela de quem saiu vale a pena carregar as colunas de dia. */
  function algumTemPresenca(t, lista, checkinT) {
    return lista.some(function (r) {
      var eKey = emailKeyFromEmail(r.email);
      return t.dias.some(function (d) { return !!(checkinT[d] && checkinT[d][eKey]); });
    });
  }

  /* Tabela de removidos — só leitura, com o histórico de presença preservado
     (os registros em turmas-checkin não são apagados ao remover alguém da turma) */
  function buildRemovedPresencaTable(t, removed, checkinT) {
    var minDias = Math.ceil(t.dias.length * CRITERIO_PRESENCA);
    var wrap = document.createElement('div');
    wrap.className = 'table-scroll-wrap';

    var tbl = '<table class="admin-table presenca-table"><thead><tr>' +
      '<th>Nome</th><th>E-mail</th><th>Área</th><th>Data interesse</th><th>Data remoção</th><th>Destino</th><th>Motivo</th>';
    t.dias.forEach(function (d) {
      tbl += '<th class="dia-th">' + fmtDia(d) + '</th>';
    });
    tbl += '<th>Freq.</th></tr></thead><tbody>';

    removed.forEach(function (r) {
      var eKey = emailKeyFromEmail(r.email);
      var diasPresente = 0;
      var cells = t.dias.map(function (d) {
        var ck = checkinT[d] && checkinT[d][eKey];
        if (ck) {
          diasPresente++;
          var badge = ck.source === 'admin'
            ? '<span class="ck-badge ck-adm" title="Registrado pelo admin">✓ adm</span>'
            : '<span class="ck-badge ck-qr" title="Registrado pelo próprio QR Code">✓ qr</span>';
          return '<td class="dia-cell">' + badge + '</td>';
        }
        return '<td class="dia-cell">—</td>';
      });

      var freq = diasPresente + '/' + t.dias.length;
      var atingiu = diasPresente >= minDias;
      var freqClass = atingiu ? 'freq-ok' : 'freq-nok';

      tbl += '<tr><td>' + esc(r.name) + '</td><td>' + esc(r.email) + '</td><td>' +
        esc(r.area || '—') + '</td><td>' + fmtDate(r.date) + '</td><td>' + fmtDate(r.removedDate) + '</td><td>' + destinoDeQuemSaiu(r) + '</td><td>' + motivoDeQuemSaiu(t, r) + '</td>' + cells.join('') +
        '<td><span class="' + freqClass + '">' + freq + '</span></td></tr>';
    });

    tbl += '</tbody></table>';
    wrap.innerHTML = tbl;
    ligarBotaoMotivo(wrap);
    return wrap;
  }

  function emailKeyFromEmail(email) {
    return (email || '').toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
  }

  function getStatus(r) {
    return r.status === 'inscrito' ? 'inscrito' : 'interessado';
  }

  /* ---- Check-in actions ---- */
  function openCheckin(turmaKey, dia) {
    var partes = dia.split('-');
    var diaLabel = partes[2] + '/' + partes[1] + '/' + partes[0];
    var hoje = todayISO();
    var aviso = dia !== hoje
      ? '\n\n⚠️ ATENÇÃO: este dia (' + diaLabel + ') é diferente de hoje (' + hoje.split('-').reverse().join('/') + ')!'
      : '';
    if (!confirm('Abrir check-in para o dia ' + diaLabel + '?' + aviso)) return;
    firebase.database().ref('turmas-config/' + turmaKey + '/diaAtivo').set(dia, function (err) {
      if (err) { adminAlert('Erro ao abrir check-in.'); return; }
      loadInterests();
    });
  }

  function closeCheckin(turmaKey) {
    firebase.database().ref('turmas-config/' + turmaKey + '/diaAtivo').set(null, function (err) {
      if (err) { adminAlert('Erro ao fechar check-in.'); return; }
      loadInterests();
    });
  }

  function adminCheckin(turmaKey, dia, eKey, person) {
    var ref = firebase.database().ref('turmas-checkin/' + turmaKey + '/' + dia + '/' + eKey);
    ref.set({
      name: person.name, email: person.email, area: person.area || '',
      checkinAt: new Date().toISOString(), source: 'admin'
    }, function (err) {
      if (err) { adminAlert('Erro ao registrar presença.'); return; }
      loadInterests();
    });
  }

  /* ---- Helpers: modais visuais (substituem confirm/alert/prompt nativos) ---- */
  var AREAS_LIST = ['ASJUR','AUDIT','CONIN','GABIN','GEBEN','GECAP','GECAT','GECON',
    'GEINT','GEPAR','GEPRO','GERAI','GERAT','GEROP','GESOP','GETHO','INFOR','OUVIR','PNSEG','SECEX'];

  function adminAlert(mensagem, callbackOk) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9999';
    var box = document.createElement('div');
    box.className = 'modal-box';
    box.style.cssText = 'max-width:420px;width:90%;padding:28px;display:flex;flex-direction:column;gap:18px';
    box.innerHTML =
      '<p style="font-size:.95rem;line-height:1.6;color:var(--ink);white-space:pre-line">' + esc(mensagem) + '</p>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px">' +
        '<button class="btn btn--primary admin-modal-ok-btn">OK</button>' +
      '</div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function closeAlert() { document.body.removeChild(overlay); if (callbackOk) callbackOk(); }
    box.querySelector('.admin-modal-ok-btn').addEventListener('click', closeAlert);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeAlert(); });
  }

  function adminConfirm(mensagem, callbackSim) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9999';
    var box = document.createElement('div');
    box.className = 'modal-box';
    box.style.cssText = 'max-width:420px;width:90%;padding:28px;display:flex;flex-direction:column;gap:18px';
    box.innerHTML =
      '<p style="font-size:.95rem;line-height:1.6;color:var(--ink);white-space:pre-line">' + esc(mensagem) + '</p>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px">' +
        '<button class="btn admin-modal-cancel-btn">Cancelar</button>' +
        '<button class="btn btn--primary admin-modal-confirm-btn">Confirmar</button>' +
      '</div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function closeConfirm() { document.body.removeChild(overlay); }
    box.querySelector('.admin-modal-cancel-btn').addEventListener('click', closeConfirm);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeConfirm(); });
    box.querySelector('.admin-modal-confirm-btn').addEventListener('click', function () {
      closeConfirm();
      if (callbackSim) callbackSim();
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     SORTEIO DA TURMA

     Sorteia pessoas entre os participantes CONFIRMADOS de uma turma —
     mesmo conjunto que o filtro "Confirmados" da tabela mostra. Quem só
     manifestou interesse e ainda não foi confirmado nunca entra no
     sorteio: a confirmação é o que define quem de fato faz parte da
     turma.

     Cada sorteio fica gravado em turmas-sorteio/<turma>, com quem saiu,
     quando e quem sorteou. Isso serve a duas coisas: dá para provar
     depois quem foi sorteado, e permite não repetir ganhador.

     O embaralhamento usa crypto.getRandomValues quando disponível —
     Math.random() é previsível o bastante para que, num sorteio com
     plateia, a lisura seja questionável.
     ══════════════════════════════════════════════════════════════════ */

  /* Fisher-Yates com fonte aleatória criptográfica quando existir */
  function sortearAleatorio(lista, quantos) {
    var arr = lista.slice();
    function randInt(max) {
      if (window.crypto && window.crypto.getRandomValues) {
        var buf = new Uint32Array(1);
        var limite = Math.floor(4294967296 / max) * max;   /* descarta o resto para não enviesar */
        do { window.crypto.getRandomValues(buf); } while (buf[0] >= limite);
        return buf[0] % max;
      }
      return Math.floor(Math.random() * max);
    }
    for (var i = arr.length - 1; i > 0; i--) {
      var j = randInt(i + 1);
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr.slice(0, quantos);
  }

  function openSorteioModal(t, confirmados) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9999';
    var box = document.createElement('div');
    box.className = 'modal-box sorteio-box';
    box.innerHTML =
      '<h3 class="sorteio-titulo">🎲 Sorteio — ' + esc(t.label) + '</h3>' +
      '<p class="sorteio-pool">Participando: <strong>' + confirmados.length + '</strong> pessoa' +
        (confirmados.length !== 1 ? 's' : '') + ' confirmada' + (confirmados.length !== 1 ? 's' : '') +
        ' nesta turma. Quem ainda não foi confirmado não entra no sorteio.</p>' +
      '<div class="sorteio-opcoes">' +
        '<label class="sorteio-campo">Quantas pessoas sortear' +
          '<input type="number" class="sorteio-qtd" min="1" value="1">' +
        '</label>' +
        '<label class="sorteio-check">' +
          '<input type="checkbox" class="sorteio-sem-repetir" checked>' +
          '<span>Não repetir quem já foi sorteado nesta turma</span>' +
        '</label>' +
        '<label class="sorteio-check sorteio-check--teste">' +
          '<input type="checkbox" class="sorteio-teste">' +
          '<span>Ensaio — não registra no histórico e não vale como sorteio</span>' +
        '</label>' +
      '</div>' +
      /* O modo vigente é declarado o tempo todo, nos dois sentidos — o
         ensaio avisava que não valia, mas o sorteio real não afirmava
         que valia, e ficava por conta de notar a ausência do aviso. */
      '<p class="sorteio-modo sorteio-modo--vale">✅ Sorteio para valer — o resultado será registrado no histórico desta turma e na aba Sorteios.</p>' +
      '<div class="sorteio-palco"><p class="sorteio-placeholder">Pronto para sortear. Vale.</p></div>' +
      '<div class="sorteio-hist-wrap"></div>' +
      '<div class="sorteio-acoes">' +
        '<button class="btn sorteio-fechar">Fechar</button>' +
        '<button class="btn btn--primary sorteio-btn">🎲 Sortear para valer</button>' +
      '</div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    var qtdInput  = box.querySelector('.sorteio-qtd');
    var semRepInp = box.querySelector('.sorteio-sem-repetir');
    var testeInp  = box.querySelector('.sorteio-teste');
    var palco     = box.querySelector('.sorteio-palco');
    var histWrap  = box.querySelector('.sorteio-hist-wrap');
    var btnSortear= box.querySelector('.sorteio-btn');
    qtdInput.max = String(Math.max(1, confirmados.length));

    function fechar() {
      if (document.body.contains(overlay)) document.body.removeChild(overlay);
    }
    box.querySelector('.sorteio-fechar').addEventListener('click', fechar);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) fechar(); });

    var refSorteios = firebase.database().ref('turmas-sorteio/' + t.key);
    var historico   = [];   /* [{ _key, ganhadores:[], quando, sorteadoPorNome }] */

    function jaSorteados() {
      var set = {};
      historico.forEach(function (s) {
        (s.ganhadores || []).forEach(function (g) { set[(g.email || '').toLowerCase()] = true; });
      });
      return set;
    }

    function elegiveis() {
      if (!semRepInp.checked) return confirmados;
      var ja = jaSorteados();
      return confirmados.filter(function (p) { return !ja[(p.email || '').toLowerCase()]; });
    }

    function renderHistorico() {
      if (!historico.length) {
        histWrap.innerHTML = '<p class="sorteio-hist-vazio">Nenhum sorteio realizado nesta turma ainda.</p>';
        return;
      }
      var h = '<div class="sorteio-hist-head">' +
        '<span>Sorteios anteriores (' + historico.length + ')</span>' +
        '<button class="sorteio-limpar" type="button">Limpar histórico</button>' +
      '</div><ul class="sorteio-hist">';
      historico.forEach(function (s) {
        var quando = s.quando ? new Date(s.quando).toLocaleString('pt-BR') : '';
        h += '<li><span class="sorteio-hist-nomes">' +
             esc((s.ganhadores || []).map(function (g) { return g.name; }).join(', ')) +
             '</span><span class="sorteio-hist-meta">' + esc(quando) +
             (s.sorteadoPorNome ? ' · por ' + esc(s.sorteadoPorNome) : '') + '</span></li>';
      });
      h += '</ul>';
      histWrap.innerHTML = h;
      histWrap.querySelector('.sorteio-limpar').addEventListener('click', function () {
        adminConfirm('Limpar o histórico de sorteios da turma "' + t.label + '"?\n\nOs ' + historico.length +
          ' sorteio(s) já realizados serão apagados e todo mundo volta a poder ser sorteado.', function () {
          refSorteios.remove(function () { carregarHistorico(); loadSorteios(); });
        });
      });
    }

    function carregarHistorico() {
      refSorteios.once('value', function (snap) {
        var v = snap.val() || {};
        historico = Object.keys(v).map(function (k) {
          return Object.assign({ _key: k }, v[k]);
        }).sort(function (a, b) { return (b.quando || '').localeCompare(a.quando || ''); });
        renderHistorico();
        atualizarDisponivel();
      });
    }

    function atualizarDisponivel() {
      var pool = elegiveis();
      var aviso = box.querySelector('.sorteio-disponivel');
      if (!aviso) {
        aviso = document.createElement('p');
        aviso.className = 'sorteio-disponivel';
        box.querySelector('.sorteio-opcoes').appendChild(aviso);
      }
      aviso.textContent = semRepInp.checked
        ? 'Disponíveis para este sorteio: ' + pool.length + ' de ' + confirmados.length + '.'
        : 'Disponíveis para este sorteio: ' + confirmados.length + ' (todos, inclusive quem já foi sorteado).';
      btnSortear.disabled = pool.length === 0;
    }
    semRepInp.addEventListener('change', atualizarDisponivel);
    /* O modo ensaio muda o rótulo do botão e marca o modal inteiro — a
       ideia é ser impossível ensaiar achando que valeu, ou valer achando
       que era ensaio. */
    var faixaModo = box.querySelector('.sorteio-modo');
    testeInp.addEventListener('change', function () {
      var teste = testeInp.checked;
      box.classList.toggle('sorteio-box--teste', teste);
      btnSortear.textContent = teste ? '🎲 Ensaiar (não vale)' : '🎲 Sortear para valer';
      faixaModo.className = 'sorteio-modo ' + (teste ? 'sorteio-modo--teste' : 'sorteio-modo--vale');
      faixaModo.textContent = teste
        ? '⚠️ Ensaio — nada será registrado e ninguém sai do sorteio de verdade.'
        : '✅ Sorteio para valer — o resultado será registrado no histórico desta turma e na aba Sorteios.';
      palco.innerHTML = '<p class="sorteio-placeholder">' +
        (teste ? 'Modo ensaio: o resultado não será registrado.' : 'Pronto para sortear. Vale.') + '</p>';
    });

    btnSortear.addEventListener('click', function () {
      var pool = elegiveis();
      var qtd  = Math.max(1, Math.min(Number(qtdInput.value) || 1, pool.length));
      if (!pool.length) { adminAlert('Não há ninguém disponível para sortear.'); return; }
      if (Number(qtdInput.value) > pool.length) {
        adminAlert('Só há ' + pool.length + ' pessoa(s) disponível(is). Serão sorteadas ' + qtd + '.');
      }
      var ganhadores = sortearAleatorio(pool, qtd);
      var ehTeste    = testeInp.checked;

      /* Animação: passa nomes aleatórios na tela antes de parar no
         resultado. É teatro, mas é o que faz o sorteio parecer sorteio
         para quem está assistindo — o resultado já foi definido acima. */
      btnSortear.disabled = true;
      var giros = 0;
      var timer = setInterval(function () {
        var qualquer = pool[Math.floor(Math.random() * pool.length)];
        palco.innerHTML = '<p class="sorteio-girando">' + esc(qualquer.name || '') + '</p>';
        if (++giros > 18) {
          clearInterval(timer);
          /* No ensaio o resultado aparece marcado e não vai para o banco:
             ninguém "ganhou" nada, e o próximo sorteio de verdade continua
             com todo mundo concorrendo. */
          if (ehTeste) {
            palco.innerHTML = '<p class="sorteio-resultado-label sorteio-label-teste">Ensaio — não vale</p>' +
              '<ul class="sorteio-resultado sorteio-resultado--teste">' +
              ganhadores.map(function (g) { return '<li>' + esc(g.name || '') + '</li>'; }).join('') +
              '</ul>' +
              '<p class="sorteio-teste-obs">Nada foi registrado. Desmarque "Ensaio" para valer.</p>';
            btnSortear.disabled = false;
            return;
          }
          palco.innerHTML = '<p class="sorteio-resultado-label">' +
            (ganhadores.length > 1 ? 'Sorteados' : 'Sorteada(o)') + '</p>' +
            '<ul class="sorteio-resultado">' +
            ganhadores.map(function (g) { return '<li>🎉 ' + esc(g.name || '') + '</li>'; }).join('') +
            '</ul>';
          var sess = window.faAuth && window.faAuth.getSession();
          refSorteios.push({
            ganhadores: ganhadores.map(function (g) { return { name: g.name || '', email: g.email || '' }; }),
            quando: new Date().toISOString(),
            sorteadoPorNome: sess ? (sess.name || sess.email) : null,
            semRepetir: !!semRepInp.checked,
          }, function (errPush) {
            /* Só afirma "registrado" depois que o banco confirmou — dizer
               antes seria a mesma armadilha do ensaio parecendo real. */
            palco.insertAdjacentHTML('beforeend', errPush
              ? '<p class="sorteio-teste-obs">⚠️ O sorteio saiu, mas não foi possível registrar. Anote os nomes e tente de novo.</p>'
              : '<p class="sorteio-vale-obs">✓ Registrado no histórico desta turma e na aba Sorteios.</p>');
            carregarHistorico(); loadSorteios(); btnSortear.disabled = false;
          });
        }
      }, 70);
    });

    carregarHistorico();
  }

  /* ══════════════════════════════════════════════════════════════════
     ABA SORTEIOS — todos os sorteios, de todas as turmas, num lugar só

     O histórico dentro do modal só mostra a turma aberta. Esta aba
     reúne tudo, com filtro por evento e por turma, para consultar
     depois quem foi sorteado sem precisar entrar turma por turma.
     Ensaios nunca chegam aqui: eles não são gravados.
     ══════════════════════════════════════════════════════════════════ */
  function loadSorteios() {
    var c = document.getElementById('adminSorteios');
    if (!c) return;
    c.innerHTML = '<p class="loading-msg">Carregando sorteios…</p>';

    loadTurmasList(function () {
    loadEventosList(function () {
      firebase.database().ref('turmas-sorteio').once('value', function (snap) {
        var raw = snap.val() || {};
        /* Achata para uma lista única, já com evento e turma resolvidos */
        var linhas = [];
        Object.keys(raw).forEach(function (tk) {
          var turma  = TURMAS_LIST.filter(function (t) { return t.key === tk; })[0];
          var evento = turma && turma.eventoKey
            ? EVENTOS_LIST.filter(function (e) { return e.key === turma.eventoKey; })[0]
            : null;
          Object.keys(raw[tk] || {}).forEach(function (sk) {
            var s = raw[tk][sk] || {};
            linhas.push({
              turmaKey:   tk,
              turmaLabel: (turma && turma.label) || tk,
              eventoKey:  (turma && turma.eventoKey) || '',
              eventoNome: (evento && evento.nome) || '(sem evento)',
              ganhadores: s.ganhadores || [],
              quando:     s.quando || '',
              porNome:    s.sorteadoPorNome || '',
            });
          });
        });
        linhas.sort(function (a, b) { return (b.quando || '').localeCompare(a.quando || ''); });
        renderSorteios(c, linhas);
      }, function (err) {
        console.error('[sorteios]', err);
        c.innerHTML = '<p class="admin-empty">Erro ao carregar os sorteios. Recarregue a página.</p>';
      });
    });
    });
  }

  function renderSorteios(c, linhas) {
    var fEvento = '';
    var fTurma  = '';

    c.innerHTML = '';

    var barra = document.createElement('div');
    barra.className = 'sorteios-filtros';
    barra.innerHTML =
      '<label class="sorteios-filtro">Evento <select class="sorteios-f-evento"></select></label>' +
      '<label class="sorteios-filtro">Turma <select class="sorteios-f-turma"></select></label>' +
      '<button class="btn btn--sm sorteios-export" type="button">&#x2193; Exportar CSV</button>';
    c.appendChild(barra);

    var resumo = document.createElement('p');
    resumo.className = 'sorteios-resumo';
    c.appendChild(resumo);

    var lista = document.createElement('div');
    lista.className = 'sorteios-lista';
    c.appendChild(lista);

    var selEv = barra.querySelector('.sorteios-f-evento');
    var selTu = barra.querySelector('.sorteios-f-turma');

    /* Só oferece nos filtros o que realmente tem sorteio — um filtro que
       leva a "nenhum resultado" só faz perder tempo. */
    function opcoesEvento() {
      var vistos = {};
      linhas.forEach(function (l) { vistos[l.eventoKey] = l.eventoNome; });
      selEv.innerHTML = '<option value="">Todos os eventos</option>';
      Object.keys(vistos).forEach(function (k) {
        selEv.innerHTML += '<option value="' + esc(k) + '">' + esc(vistos[k]) + '</option>';
      });
    }
    function opcoesTurma() {
      var vistos = {};
      linhas.filter(function (l) { return !fEvento || l.eventoKey === fEvento; })
            .forEach(function (l) { vistos[l.turmaKey] = l.turmaLabel; });
      selTu.innerHTML = '<option value="">Todas as turmas</option>';
      Object.keys(vistos).forEach(function (k) {
        selTu.innerHTML += '<option value="' + esc(k) + '">' + esc(vistos[k]) + '</option>';
      });
      if (fTurma && !vistos[fTurma]) fTurma = '';   /* turma some ao trocar de evento */
      selTu.value = fTurma;
    }

    function filtradas() {
      return linhas.filter(function (l) {
        return (!fEvento || l.eventoKey === fEvento) && (!fTurma || l.turmaKey === fTurma);
      });
    }

    function desenhar() {
      var ls = filtradas();
      var pessoas = ls.reduce(function (n, l) { return n + l.ganhadores.length; }, 0);
      resumo.textContent = ls.length
        ? ls.length + ' sorteio' + (ls.length !== 1 ? 's' : '') + ' · ' +
          pessoas + ' pessoa' + (pessoas !== 1 ? 's' : '') + ' sorteada' + (pessoas !== 1 ? 's' : '')
        : '';

      if (!ls.length) {
        lista.innerHTML = '<p class="admin-empty">' +
          (linhas.length ? 'Nenhum sorteio neste filtro.'
                         : 'Nenhum sorteio realizado ainda. Os sorteios são feitos na aba Eventos, no menu “⋯” de cada turma. Ensaios não aparecem aqui.') +
          '</p>';
        return;
      }
      var h = '<table class="admin-table"><thead><tr>' +
        '<th>Quando</th><th>Evento</th><th>Turma</th><th>Sorteada(s)</th><th>Sorteado por</th>' +
        '</tr></thead><tbody>';
      ls.forEach(function (l) {
        h += '<tr>' +
          '<td class="sorteios-quando">' + esc(l.quando ? new Date(l.quando).toLocaleString('pt-BR') : '—') + '</td>' +
          '<td>' + esc(l.eventoNome) + '</td>' +
          '<td>' + esc(l.turmaLabel) + '</td>' +
          '<td class="sorteios-nomes">' + esc(l.ganhadores.map(function (g) { return g.name; }).join(', ')) + '</td>' +
          '<td class="sorteios-por">' + esc(l.porNome || '—') + '</td>' +
        '</tr>';
      });
      h += '</tbody></table>';
      lista.innerHTML = h;
    }

    selEv.addEventListener('change', function () {
      fEvento = selEv.value;
      opcoesTurma();
      desenhar();
    });
    selTu.addEventListener('change', function () { fTurma = selTu.value; desenhar(); });

    barra.querySelector('.sorteios-export').addEventListener('click', function () {
      var ls = filtradas();
      if (!ls.length) { adminAlert('Não há sorteios neste filtro para exportar.'); return; }
      var rows = [];
      ls.forEach(function (l) {
        /* Uma linha por pessoa — planilha com vários nomes numa célula
           não dá para filtrar nem contar. */
        (l.ganhadores.length ? l.ganhadores : [{ name: '', email: '' }]).forEach(function (g) {
          rows.push([
            l.quando ? new Date(l.quando).toLocaleString('pt-BR') : '',
            l.eventoNome, l.turmaLabel, g.name || '', g.email || '', l.porNome || '',
          ]);
        });
      });
      toXls(['Quando', 'Evento', 'Turma', 'Nome sorteado', 'E-mail', 'Sorteado por'],
        rows, 'sorteios-' + new Date().toISOString().slice(0, 10) + '.csv');
    });

    opcoesEvento();
    opcoesTurma();
    desenhar();
  }

  /* Motivos usados nos dois fluxos da lista de espera. "evento_encerrado"
     serve para limpar a lista quando o evento inteiro acabou e não haverá
     mais turmas — não é falha da pessoa nem escolha dela. */
  /* Mantida só para traduzir o motivo de quem JÁ está na lista de espera:
     esses registros foram gravados com estas chaves. A entrada na fila hoje
     usa MOTIVOS_REMOCAO_TURMA, pelo caminho único de remoção. */
  var MOTIVOS_ESPERA_ENTRADA = [
    { key: 'sem_vagas',        label: 'Turma sem vagas' },
    { key: 'turma_encerrada',  label: 'Turma já encerrada' },
    { key: 'remanejada',       label: 'Remanejada para próxima turma' },
    { key: 'a_pedido',         label: 'A pedido da pessoa' },
    { key: 'evento_encerrado', label: 'Evento encerrado' },
    { key: 'outro',            label: 'Outro' },
  ];
  var MOTIVOS_ESPERA_SAIDA = [
    { key: 'desistiu',         label: 'Desistiu / não tem mais interesse' },
    /* Mesma pergunta da saída da turma: dizer QUAL turma ela já fez. Aqui a
       fila não tem destino nenhum, então a turma vive só no motivo. */
    { key: 'ja_participou',    label: 'Já participou de uma turma', pedeTurma: true, turmaJaFeita: true },
    { key: 'nao_responde',     label: 'Não respondeu aos contatos' },
    { key: 'evento_encerrado', label: 'Evento encerrado' },
    { key: 'duplicado',        label: 'Registro duplicado' },
    { key: 'outro',            label: 'Outro' },
  ];
  /* Em quais turmas cada pessoa já foi confirmada. Preenchido a cada
     carga da aba Eventos e usado para o selo "Já participou" dizer DE QUAL
     turma — a informação existe no sistema, não faz sentido exigir que o
     admin lembre. */
  var _turmasConfirmadas = {};
  function registrarTurmasConfirmadas(data, turmasVal) {
    _turmasConfirmadas = {};
    Object.keys(data || {}).forEach(function (tk) {
      var label = (turmasVal[tk] && turmasVal[tk].label) || tk;
      Object.keys(data[tk] || {}).forEach(function (k) {
        var r = data[tk][k];
        if (!r || r.removed || r.status !== 'inscrito' || !r.confirmedByAdmin) return;
        (_turmasConfirmadas[k] = _turmasConfirmadas[k] || []).push({ tk: tk, label: label });
      });
    });
  }
  function ondeJaParticipou(eKey, turmaAtual) {
    return (_turmasConfirmadas[eKey] || []).filter(function (x) { return x.tk !== turmaAtual; });
  }

  /* Motivos de saída da turma. "Substituída" é um deles: quando outra
     pessoa fica com a vaga, quem saiu não continua na turma esperando uma
     decisão que já foi tomada — ou é confirmada, ou sai. Por isso a
     substituição deixou de ser um selo em quem fica e virou motivo de
     remoção, como os outros. */
  var MOTIVOS_REMOCAO_TURMA = [
    { key: 'a_pedido',         label: 'A pedido da própria pessoa' },
    /* pedeTurma: o modal troca o campo de texto por uma lista de turmas —
       sem dizer PARA ONDE a pessoa foi, o registro não serve de nada. */
    { key: 'outra_turma',      label: 'Vai fazer em outra turma', pedeTurma: true },
    { key: 'sem_vagas',        label: 'Turma sem vagas' },
    /* O tratador da remoção abre uma segunda pergunta neste motivo, para
       saber quem entrou no lugar. */
    { key: 'substituida',      label: 'Substituída por outra pessoa' },
    { key: 'data_nao_serviu',  label: 'A data não serviu' },
    /* Também pede uma turma, mas a que ela JÁ FEZ — não um destino. Sem a
       marca turmaJaFeita o registro trataria a turma antiga como para onde
       ela foi, e a pessoa cairia em "Foram para outra turma". */
    { key: 'ja_participou',    label: 'Já participou de uma turma', pedeTurma: true, turmaJaFeita: true },
    { key: 'nao_responde',     label: 'Não respondeu aos contatos' },
    { key: 'duplicado',        label: 'Registro duplicado' },
    { key: 'teste',            label: 'Registro de teste' },
    { key: 'evento_encerrado', label: 'Evento encerrado' },
    { key: 'outro',            label: 'Outro' },
  ];
  function motivoEsperaLabel(key) {
    var todos = MOTIVOS_ESPERA_ENTRADA.concat(MOTIVOS_ESPERA_SAIDA).concat(MOTIVOS_REMOCAO_TURMA);
    for (var i = 0; i < todos.length; i++) if (todos[i].key === key) return todos[i].label;
    return key || '';
  }

  /* Confirmação com escolha de motivo obrigatória. Quando "Outro" é escolhido,
     abre um campo de texto — também obrigatório, para não gravar motivo vazio. */
  /* Quem entrou no lugar de quem saiu. Oferece as pessoas da própria turma
     (a substituta normalmente já está lá, confirmada) e aceita digitar um
     nome, para o caso de ser alguém ainda não cadastrada na turma. */
  function escolherSubstituta(turmaKey, eKeySaiu, nomeSaiu, callback) {
    firebase.database().ref('turmas-interesse/' + turmaKey).once('value', function (snap) {
      var dados = snap.val() || {};
      var candidatas = Object.keys(dados)
        .filter(function (k) { return k !== eKeySaiu && dados[k] && !dados[k].removed && dados[k].email; })
        .map(function (k) { return dados[k]; })
        .sort(function (a, b) { return (a.name || '').localeCompare(b.name || '', 'pt'); });

      var overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9999';
      var box = document.createElement('div');
      box.className = 'modal-box';
      box.style.cssText = 'max-width:460px;width:90%;padding:28px;display:flex;flex-direction:column;gap:16px';
      box.innerHTML =
        '<p style="margin:0;line-height:1.6;color:var(--ink-2);font-size:.9rem">' +
          'Quem entrou no lugar de <strong>' + esc(nomeSaiu) + '</strong>?' +
        '</p>' +
        '<select class="admin-motivo-select subst-sel">' +
          '<option value="">— selecione —</option>' +
          candidatas.map(function (p) {
            return '<option value="' + esc(p.email) + '" data-nome="' + esc(p.name || p.email) + '">' +
                   esc(p.name || p.email) + (p.status === 'inscrito' ? ' · confirmada' : '') + '</option>';
          }).join('') +
          '<option value="__outra">Outra pessoa (digitar o nome)</option>' +
        '</select>' +
        '<input class="admin-motivo-outro subst-outra" type="text" placeholder="Nome de quem entrou" hidden>' +
        '<div style="display:flex;gap:10px;justify-content:flex-end">' +
          '<button class="btn subst-cancelar">Cancelar</button>' +
          '<button class="btn btn--primary subst-ok">Confirmar</button>' +
        '</div>';
      overlay.appendChild(box);
      document.body.appendChild(overlay);

      var selP  = box.querySelector('.subst-sel');
      var outra = box.querySelector('.subst-outra');
      function fechar(res) { document.body.removeChild(overlay); callback(res); }

      selP.addEventListener('change', function () {
        outra.hidden = selP.value !== '__outra';
        if (!outra.hidden) outra.focus();
      });
      box.querySelector('.subst-cancelar').addEventListener('click', function () { fechar(null); });
      box.querySelector('.subst-ok').addEventListener('click', function () {
        if (!selP.value) { adminAlert('Escolha quem entrou no lugar.'); return; }
        if (selP.value === '__outra') {
          var nome = (outra.value || '').trim();
          if (!nome) { adminAlert('Digite o nome de quem entrou.'); return; }
          fechar({ name: nome, email: '' });
          return;
        }
        var opt = selP.options[selP.selectedIndex];
        fechar({ name: opt.dataset.nome, email: selP.value });
      });
    });
  }

  function adminConfirmComMotivo(mensagem, motivos, callbackSim, pergunta, jaFezTurmas, motivoInicial) {
    /* Turmas que a pessoa já fez, quando o chamador souber — vem de
       ondeJaParticipou(), a mesma fonte do selo "Já participou". */
    var jaFez = jaFezTurmas || [];
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9999';
    var box = document.createElement('div');
    box.className = 'modal-box';
    box.style.cssText = 'max-width:460px;width:90%;padding:28px;display:flex;flex-direction:column;gap:16px';
    box.innerHTML =
      '<p style="font-size:.95rem;line-height:1.6;color:var(--ink);white-space:pre-line">' + esc(mensagem) + '</p>' +
      '<label class="admin-field-label">Motivo' +
        '<select class="admin-motivo-select">' +
          '<option value="">— selecione o motivo —</option>' +
          motivos.map(function (m) { return '<option value="' + esc(m.key) + '">' + esc(m.label) + '</option>'; }).join('') +
        '</select>' +
      '</label>' +
      '<input type="text" class="admin-motivo-outro" placeholder="Descreva o motivo" hidden />' +
      '<select class="admin-motivo-select admin-motivo-turma" hidden>' +
        '<option value="">— para qual turma? —</option>' +
        TURMAS_LIST.map(function (t) {
          return '<option value="' + esc(t.key) + '" data-label="' + esc(t.label) + '">' + esc(t.label) + (t.dates ? ' (' + esc(t.dates) + ')' : '') + '</option>';
        }).join('') +
      '</select>' +
      /* A caixa vem MARCADA: quem sai da turma quase sempre continua
         querendo fazer, e a fila preserva a data original do interesse.
         Antes vinha marcada só em alguns motivos, o que fazia a escolha
         depender de lembrar quais eram. Quem não quer, desmarca. */
      (pergunta ? '<label class="admin-motivo-check"><input type="checkbox" class="admin-motivo-extra" checked> ' + esc(pergunta.label) + '</label>' : '') +
      '<p class="admin-motivo-erro" style="color:var(--red);font-size:.8rem;margin:0" hidden></p>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px">' +
        '<button class="btn admin-modal-cancel-btn">Cancelar</button>' +
        '<button class="btn btn--primary admin-modal-confirm-btn">Confirmar</button>' +
      '</div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    var sel   = box.querySelector('.admin-motivo-select');
    var outro = box.querySelector('.admin-motivo-outro');
    var selTurma = box.querySelector('.admin-motivo-turma');
    function pedeTurma(k) { for (var i = 0; i < motivos.length; i++) if (motivos[i].key === k) return !!motivos[i].pedeTurma; return false; }
    function turmaJaFeita(k) { for (var i = 0; i < motivos.length; i++) if (motivos[i].key === k) return !!motivos[i].turmaJaFeita; return false; }
    var erro  = box.querySelector('.admin-motivo-erro');
    var chk     = box.querySelector('.admin-motivo-extra');
    var chkWrap = box.querySelector('.admin-motivo-check');
    /* Depois que a pessoa mexe na caixa, a escolha dela manda — a tela não
       volta a marcar sozinha ao trocar de motivo. */
    var chkTocado = false;
    if (chk) chk.addEventListener('change', function () { chkTocado = true; });

    function fechar() { document.body.removeChild(overlay); }
    sel.addEventListener('change', function () {
      outro.hidden = sel.value !== 'outro';
      selTurma.hidden = !pedeTurma(sel.value);
      /* A mesma lista serve às duas perguntas — o rótulo é que diz qual
         delas está sendo feita, senão "qual turma?" fica ambíguo. */
      if (!selTurma.hidden) {
        selTurma.options[0].textContent = turmaJaFeita(sel.value) ? '— qual turma ela já fez? —' : '— para qual turma? —';
        /* Quando o sistema já sabe de UMA turma que a pessoa fez, ela vem
           escolhida: o dado existe, não faz sentido exigir que você lembre.
           Com mais de uma, a escolha é sua. */
        selTurma.value = (turmaJaFeita(sel.value) && jaFez.length === 1) ? jaFez[0].tk : '';
      }
      /* "Vai fazer em outra turma" já É o destino: mandar para a fila ao
         mesmo tempo se contradiz, e o registro da turma escolhida seria
         descartado. Nesse motivo a caixa some e não vale. */
      if (chkWrap) {
        var conflita = pedeTurma(sel.value);
        chkWrap.hidden = conflita;
        if (chk) {
          if (conflita) chk.checked = false;
          else if (!chkTocado) chk.checked = true;
        }
      }
      erro.hidden = true;
      if (!outro.hidden) outro.focus();
      else if (!selTurma.hidden) selTurma.focus();
    });
    box.querySelector('.admin-modal-cancel-btn').addEventListener('click', fechar);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) fechar(); });
    box.querySelector('.admin-modal-confirm-btn').addEventListener('click', function () {
      if (!sel.value) { erro.textContent = 'Escolha um motivo.'; erro.hidden = false; sel.focus(); return; }
      if (sel.value === 'outro' && !outro.value.trim()) {
        erro.textContent = 'Descreva o motivo.'; erro.hidden = false; outro.focus(); return;
      }
      if (pedeTurma(sel.value) && !selTurma.value) {
        erro.textContent = turmaJaFeita(sel.value) ? 'Escolha a turma que ela já fez.' : 'Escolha a turma em que ela vai fazer.';
        erro.hidden = false; selTurma.focus(); return;
      }
      var motivo = sel.value;
      var detalhe = sel.value === 'outro' ? outro.value.trim() : '';
      var turmaEscolhida = null;
      if (pedeTurma(sel.value) && selTurma.value) {
        var o = selTurma.options[selTurma.selectedIndex];
        var jaFeita = turmaJaFeita(sel.value);
        turmaEscolhida = { key: selTurma.value, label: o.dataset.label, jaFeita: jaFeita };
        detalhe = (jaFeita ? 'Já participou da ' : 'Vai fazer na ') + o.dataset.label;
      }
      var extra = !!(chk && chk.checked && chkWrap && !chkWrap.hidden);
      fechar();
      if (callbackSim) callbackSim(motivo, detalhe, turmaEscolhida, extra);
    });
    /* Completar um motivo já escolhido abre com ele selecionado e travado:
       trocar de motivo aqui seria reescrever a decisão, não preencher a
       lacuna. O foco vai direto para o campo que falta. */
    if (motivoInicial) {
      sel.value = motivoInicial;
      sel.dispatchEvent(new Event('change'));
      sel.disabled = true;
      sel.title = 'O motivo já foi registrado na saída e não muda aqui';
    } else {
      sel.focus();
    }
  }

  /* ---- Adicionar participante manualmente (turma aberta ou com interesse
     encerrado) — modal visual. O admin escolhe o status na hora: Interessada
     (uso típico: alguém que avisou o interesse fora do site) ou Inscrita
     (uso típico: alguém que já se inscreveu direto no CMFlex). */
  function addParticipante(turmaKey) {
    var sess = window.faAuth && window.faAuth.getSession();
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9999';

    var areasOptions = AREAS_LIST.map(function (a) {
      return '<option value="' + a + '">' + a + '</option>';
    }).join('');

    var box = document.createElement('div');
    box.className = 'modal-box';
    box.style.cssText = 'max-width:460px;width:90%;padding:28px;display:flex;flex-direction:column;gap:14px';
    box.innerHTML =
      '<h3 style="font-size:1.1rem;font-family:var(--font-head);letter-spacing:.05em;color:var(--ink)">Adicionar Participante</h3>' +

      /* busca */
      '<div id="addPartSearchWrap">' +
        '<label class="auth-label" style="margin:0">Buscar pelo nome ou e-mail' +
          '<input type="text" id="addPartSearch" placeholder="Digite para buscar…" autocomplete="off" />' +
        '</label>' +
        '<ul id="addPartResults" style="margin:4px 0 0;padding:0;list-style:none;max-height:180px;overflow-y:auto;border:1px solid var(--line-strong);border-radius:6px;background:var(--panel-2);display:none"></ul>' +
      '</div>' +

      /* pessoa selecionada */
      '<div id="addPartSelected" style="display:none;background:rgba(255,255,255,.05);border:1px solid var(--accent);border-radius:8px;padding:10px 14px;font-size:.88rem;line-height:1.5">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
          '<div id="addPartSelectedInfo"></div>' +
          '<button id="addPartClearSel" style="background:none;border:none;color:var(--ink-3);font-size:.85rem;cursor:pointer;padding:0 0 0 8px;white-space:nowrap">✕ Trocar</button>' +
        '</div>' +
      '</div>' +

      /* aviso quando não encontrar */
      '<p style="font-size:.8rem;color:var(--ink-3);margin:0">Não encontrou a pessoa? Peça que ela faça o cadastro no site primeiro — após isso, ela aparecerá aqui na busca.</p>' +

      '<label class="auth-label" style="margin:0">Status<select id="addPartStatus" style="width:100%;padding:10px 12px;background:var(--panel-2);border:1px solid var(--line-strong);border-radius:6px;color:var(--ink);font-family:var(--font-body)">' +
        '<option value="">Selecione o status…</option>' +
        '<option value="interessado">Interessada</option>' +
        '<option value="inscrito">Inscrita</option>' +
      '</select></label>' +

      '<p id="addPartErr" style="color:var(--red,#ff3b30);font-size:.85rem;display:none;margin:0"></p>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:4px">' +
        '<button class="btn admin-modal-cancel-btn">Cancelar</button>' +
        '<button class="btn btn--primary admin-modal-add-btn">Adicionar</button>' +
      '</div>';

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    var errEl       = box.querySelector('#addPartErr');
    var searchInput = box.querySelector('#addPartSearch');
    var resultsList = box.querySelector('#addPartResults');
    var selectedDiv = box.querySelector('#addPartSelected');
    var selectedInfo= box.querySelector('#addPartSelectedInfo');
    var clearSelBtn = box.querySelector('#addPartClearSel');

    var allUsers = [];   /* carregados do Firebase */
    var selected = null; /* { name, email, area } */

    firebase.database().ref('fa-users').once('value', function (snap) {
      var data = snap.val() || {};
      allUsers = Object.values(data).filter(function (u) { return u.email && u.name; });
    });

    function selectUser(u) {
      selected = u;
      selectedInfo.innerHTML = '<strong>' + esc(u.name) + '</strong><br>' + esc(u.email) + ' · ' + esc(u.area || '—');
      selectedDiv.style.display = '';
      resultsList.style.display = 'none';
      searchInput.value = '';
      showManual(false);
      box.querySelector('#addPartStatus').focus();
    }

    clearSelBtn.addEventListener('click', function () {
      selected = null;
      selectedDiv.style.display = 'none';
      searchInput.value = '';
      searchInput.focus();
    });

    searchInput.addEventListener('input', function () {
      var q = searchInput.value.trim().toLowerCase();
      if (!q) { resultsList.style.display = 'none'; return; }
      var matches = allUsers.filter(function (u) {
        return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      }).slice(0, 8);
      resultsList.innerHTML = '';
      if (!matches.length) {
        var li = document.createElement('li');
        li.style.cssText = 'padding:10px 14px;font-size:.83rem;color:var(--ink-3)';
        li.textContent = 'Nenhum cadastro encontrado.';
        resultsList.appendChild(li);
      } else {
        matches.forEach(function (u) {
          var li = document.createElement('li');
          li.style.cssText = 'padding:9px 14px;font-size:.83rem;cursor:pointer;border-bottom:1px solid var(--line);display:flex;flex-direction:column;gap:2px';
          li.innerHTML = '<span style="color:var(--ink);font-weight:600">' + esc(u.name) + '</span>' +
            '<span style="color:var(--ink-3);font-size:.78rem">' + esc(u.email) + ' · ' + esc(u.area || '—') + '</span>';
          li.addEventListener('mouseenter', function () { li.style.background = 'rgba(255,255,255,.06)'; });
          li.addEventListener('mouseleave', function () { li.style.background = ''; });
          li.addEventListener('click', function () { selectUser(u); });
          resultsList.appendChild(li);
        });
      }
      resultsList.style.display = '';
    });

    function closeModal() { document.body.removeChild(overlay); }

    box.querySelector('.admin-modal-cancel-btn').addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });

    box.querySelector('.admin-modal-add-btn').addEventListener('click', function () {
      var name, email, area;

      if (!selected) {
        errEl.textContent = 'Busque e selecione uma pessoa da lista.';
        errEl.style.display = ''; return;
      }
      name  = selected.name.toUpperCase();
      email = selected.email.toLowerCase();
      area  = selected.area || '';

      var status = (box.querySelector('#addPartStatus').value || '').trim();

      errEl.style.display = 'none';
      if (!status) { errEl.textContent = 'Selecione o status.'; errEl.style.display = ''; return; }

      var eKey = emailKeyFromEmail(email);
      var ref  = firebase.database().ref('turmas-interesse/' + turmaKey + '/' + eKey);
      ref.once('value', function (snap) {
        if (snap.val() && !snap.val().removed) {
          errEl.textContent = 'Este participante já está na turma.'; errEl.style.display = ''; return;
        }

        function save(overlaps) {
          var adminName = sess ? (sess.name || sess.email) : 'Admin';
          var updates = {};
          updates['turmas-interesse/' + turmaKey + '/' + eKey] = {
            name: name, email: email, area: area,
            date: new Date().toISOString(),
            status: status, addedByAdmin: true,
            addedByAdminName: adminName
          };
          var now = new Date().toISOString();
          overlaps.forEach(function (o) {
            updates['turmas-interesse/' + o.turma + '/' + o.eKey + '/removed'] = true;
            updates['turmas-interesse/' + o.turma + '/' + o.eKey + '/removedDate'] = now;
            updates['turmas-interesse/' + o.turma + '/' + o.eKey + '/removedReason'] = 'Inscrita automaticamente na turma "' + turmaLabel(turmaKey) + '"';
          });
          firebase.database().ref().update(updates, function (err) {
            if (err) { errEl.textContent = 'Erro ao adicionar. Tente novamente.'; errEl.style.display = ''; return; }
            closeModal();
            loadInterests();
          });
        }

        /* Adicionar direto como Inscrita exige a mesma exclusividade que o
           "Confirmar" já garante — ninguém pode ficar inscrita em mais de
           uma turma. Como "Interessada" não tem esse limite, só checa
           sobreposição quando o status escolhido é "inscrito". */
        if (status === 'inscrito') {
          checkOutrasTurmas(turmaKey, [eKey], function (overlaps) {
            if (!overlaps.length) { save(overlaps); return; }
            var lista = overlaps.map(function (o) { return '• já está inscrita na "' + turmaLabel(o.turma) + '"'; }).join('\n');
            adminConfirm(
              'Adicionar ' + name + ' como Inscrita em "' + turmaLabel(turmaKey) + '"?\n\n' +
              'Ela já é inscrita em outra turma. Se continuar, essa outra inscrição será removida automaticamente (ninguém pode ficar inscrita em mais de uma):\n\n' + lista,
              function () { save(overlaps); }
            );
          });
        } else {
          save([]);
        }
      });
    });
  }

  /* ---- Criar / Editar evento ---- */
  function openEventoFormModal(existing) {
    var isEdit = !!existing;
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9999';

    var box = document.createElement('div');
    box.className = 'modal-box';
    box.style.cssText = 'max-width:480px;width:90%;padding:28px;display:flex;flex-direction:column;gap:16px;max-height:85vh;overflow:auto';
    box.innerHTML =
      '<h3 style="font-size:1.1rem;font-family:var(--font-head);letter-spacing:.05em;color:var(--ink)">' + (isEdit ? 'Editar Evento' : 'Novo Evento') + '</h3>' +
      '<label class="auth-label">Nome do evento<input type="text" id="eventoFormNome" placeholder="Ex: FORÇA ÁGIL · JORNADA DE IMERSÃO" autocomplete="off" /></label>' +
      '<label class="auth-label" style="flex-direction:row;align-items:center;gap:10px">Carga horária<input type="number" id="eventoFormCarga" placeholder="20" min="1" max="999" style="width:80px" /><span style="opacity:.7">horas</span></label>' +
      '<label class="auth-label" style="flex-direction:row;align-items:center;gap:10px">Frequência mínima p/ certificado<input type="number" id="eventoFormPercentual" placeholder="75" min="1" max="100" style="width:80px" /><span style="opacity:.7">%</span></label>' +
      '<label class="auth-label" style="flex-direction:row;align-items:center;gap:10px"><input type="checkbox" id="eventoFormPublicado" style="width:auto;margin:0" />Divulgar este evento na página Turmas</label>' +
      '<p style="font-size:.78rem;color:var(--ink-2);margin:-8px 0 0">Desmarcado, o evento inteiro some da página das pessoas — turmas, lista de espera e a Missão dele. Use para preparar um evento antes de divulgar, ou para tirar do ar um que já acabou. Não muda nada para quem já está inscrita: o acesso dela e a Minha Área continuam iguais, e aqui no painel o evento segue completo.</p>' +
      '<label class="auth-label" style="flex-direction:row;align-items:center;gap:10px"><input type="checkbox" id="eventoFormEspera" style="width:auto;margin:0" />Aceitar lista de espera neste evento</label>' +
      '<p style="font-size:.78rem;color:var(--ink-2);margin:-8px 0 0">Desmarcado, o card "Lista de Espera" não aparece na página Turmas e ninguém novo entra na fila deste evento. Quem já está na fila continua aqui no painel — nada é apagado.</p>' +
      '<label class="auth-label" style="flex-direction:row;align-items:center;gap:10px"><input type="checkbox" id="eventoFormRestritoDiretores" style="width:auto;margin:0" />Visível só para diretores e administradores</label>' +
      '<p style="font-size:.78rem;color:var(--ink-2);margin:-8px 0 0">Marcado, este evento some da página Turmas para quem não está na aba Diretores nem é admin — mesmo efeito de "fora da página", mas só pra elas. Quem tem acesso vê e se inscreve normalmente. Gerencie quem é diretor na aba Diretores.</p>' +
      '<hr style="border:none;border-top:1px solid var(--line-strong);margin:4px 0">' +
      '<p style="font-size:.78rem;color:var(--ink-2);margin:0">Conteúdo público da página Turmas — aparece abaixo dos cards deste evento, só quando preenchido. Deixe em branco pra não mostrar nada.</p>' +
      '<label class="auth-label">Missão (título curto)<input type="text" id="eventoFormMissaoTitulo" placeholder="Ex: Oficina de Agilidade Organizacional" autocomplete="off" /></label>' +
      '<label class="auth-label">Missão (texto)<textarea id="eventoFormMissaoTexto" rows="2" placeholder="Ex: Eficiência com foco no futuro: trabalhar de forma mais simples, colaborativa e com propósito..." style="resize:vertical;font-family:var(--font-body)"></textarea></label>' +
      '<label class="auth-label">Tópicos abordados<textarea id="eventoFormTopicos" rows="2" placeholder="Ex: Serão abordados: fundamentos ágeis, OKR, Scrum..." style="resize:vertical;font-family:var(--font-body)"></textarea></label>' +
      '<label class="auth-label">Formato dos encontros<select id="eventoFormFormato" style="padding:8px 10px;background:var(--panel-2);border:1px solid var(--line-strong);border-radius:6px;color:var(--ink);font-family:var(--font-body);width:100%">' +
        '<option value="presencial">Presencial</option>' +
        '<option value="remoto">Remoto (Teams)</option>' +
        '<option value="hibrido">Híbrido (presencial e Teams, ao mesmo tempo)</option>' +
      '</select></label>' +
      '<div>' +
        '<span class="auth-label" style="display:block;margin-bottom:8px">Itinerário — jornada dia a dia</span>' +
        '<div id="eventoItinerarioList" style="display:flex;flex-direction:column;gap:8px;"></div>' +
        '<button type="button" class="btn btn--sm" id="eventoAddDiaBtn" style="margin-top:8px">+ Adicionar dia</button>' +
      '</div>' +
      '<p style="font-size:.78rem;color:var(--ink-2);margin:8px 0 0">Os dois últimos chips do bloco "Como funciona" (abaixo do itinerário, na página Turmas). Os quatro campos são listas fechadas, pra não ter "Híbrido"/"hibrido" escrito diferente em cada evento — "— usar padrão —" mantém o texto de sempre.</p>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
        '<label class="auth-label" style="flex:1;min-width:140px">Modalidade (chip curto)<select id="eventoFormModalidadeLabel" style="padding:8px 10px;background:var(--panel-2);border:1px solid var(--line-strong);border-radius:6px;color:var(--ink);font-family:var(--font-body);width:100%">' +
          '<option value="">— usar padrão (Prática) —</option>' +
          '<option value="Prática">Prática</option>' +
          '<option value="Teórica">Teórica</option>' +
          '<option value="Mista">Mista</option>' +
        '</select></label>' +
        '<label class="auth-label" style="flex:2;min-width:220px">Modalidade (descrição)<input type="text" id="eventoFormModalidadeDesc" placeholder="dinâmicas, jogos e exercícios em grupo" autocomplete="off" /></label>' +
      '</div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
        '<label class="auth-label" style="flex:1;min-width:140px">Participação (chip curto)<select id="eventoFormPublicoLabel" style="padding:8px 10px;background:var(--panel-2);border:1px solid var(--line-strong);border-radius:6px;color:var(--ink);font-family:var(--font-body);width:100%">' +
          '<option value="">— usar padrão (Opcional) —</option>' +
          '<option value="Opcional">Opcional</option>' +
          '<option value="Obrigatória">Obrigatória</option>' +
        '</select></label>' +
        '<label class="auth-label" style="flex:2;min-width:220px">Quem participa (descrição)<select id="eventoFormPublicoDesc" style="padding:8px 10px;background:var(--panel-2);border:1px solid var(--line-strong);border-radius:6px;color:var(--ink);font-family:var(--font-body);width:100%">' +
          '<option value="">— usar padrão (todos os empregados da Previ) —</option>' +
          '<option value="Diretores">Diretores</option>' +
          '<option value="Executivos">Executivos</option>' +
          '<option value="Cedidos">Cedidos</option>' +
          '<option value="Quadro próprio">Quadro próprio</option>' +
        '</select></label>' +
      '</div>' +
      '<p id="eventoFormErr" style="color:var(--red,#ff3b30);font-size:.85rem;display:none"></p>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:4px">' +
        '<button class="btn admin-modal-cancel-btn">Cancelar</button>' +
        '<button class="btn btn--primary admin-modal-save-btn">' + (isEdit ? 'Salvar' : 'Criar evento') + '</button>' +
      '</div>';

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    var nomeInput         = box.querySelector('#eventoFormNome');
    var cargaInput        = box.querySelector('#eventoFormCarga');
    var percentualInput   = box.querySelector('#eventoFormPercentual');
    var missaoTituloInput = box.querySelector('#eventoFormMissaoTitulo');
    var missaoTextoInput  = box.querySelector('#eventoFormMissaoTexto');
    var topicosInput      = box.querySelector('#eventoFormTopicos');
    var esperaInput       = box.querySelector('#eventoFormEspera');
    var publicadoInput    = box.querySelector('#eventoFormPublicado');
    var restritoInput     = box.querySelector('#eventoFormRestritoDiretores');
    var formatoInput      = box.querySelector('#eventoFormFormato');
    var modalidadeLabelInput = box.querySelector('#eventoFormModalidadeLabel');
    var modalidadeDescInput  = box.querySelector('#eventoFormModalidadeDesc');
    var publicoLabelInput    = box.querySelector('#eventoFormPublicoLabel');
    var publicoDescInput     = box.querySelector('#eventoFormPublicoDesc');
    var itinerarioList    = box.querySelector('#eventoItinerarioList');
    var errEl             = box.querySelector('#eventoFormErr');

    nomeInput.value         = isEdit ? existing.nome : '';
    cargaInput.value        = isEdit ? existing.cargaHoraria : '20';
    percentualInput.value   = isEdit ? (existing.percentualMinimo || '75') : '75';
    missaoTituloInput.value = isEdit ? (existing.missaoTitulo || '') : '';
    missaoTextoInput.value  = isEdit ? (existing.missaoTexto || '') : '';
    topicosInput.value      = isEdit ? (existing.topicos || '') : '';
    /* Evento novo já nasce aceitando espera: é o comportamento que sempre
       valeu, e desmarcar é a decisão consciente. */
    esperaInput.checked     = isEdit ? existing.esperaAtiva !== false : true;
    publicadoInput.checked  = isEdit ? existing.publicado !== false : true;
    restritoInput.checked   = isEdit ? !!existing.restritoADiretores : false;
    formatoInput.value      = isEdit ? (existing.formato || 'presencial') : 'presencial';
    modalidadeLabelInput.value = isEdit ? (existing.modalidadeLabel || '') : '';
    modalidadeDescInput.value  = isEdit ? (existing.modalidadeDesc  || '') : '';
    publicoLabelInput.value    = isEdit ? (existing.publicoLabel    || '') : '';
    publicoDescInput.value     = isEdit ? (existing.publicoDesc     || '') : '';

    /* Renumera os rótulos "D1", "D2"... depois de qualquer adição/remoção —
       a ordem é só a posição na lista, sem arrastar/reordenar. */
    function renumerarDias() {
      itinerarioList.querySelectorAll('.evento-dia-num').forEach(function (el, i) {
        el.textContent = 'D' + (i + 1);
      });
    }
    function addDiaRow(value) {
      var row = document.createElement('div');
      row.className = 'evento-dia-row';
      row.style.cssText = 'display:flex;gap:8px;align-items:center;';
      row.innerHTML =
        '<span class="evento-dia-num" style="font-family:var(--font-mono);font-size:.8rem;color:var(--accent);min-width:24px">D1</span>' +
        '<input type="text" placeholder="Ex: O Despertar da Força" style="flex:1;padding:8px 10px;background:var(--panel-2);border:1px solid var(--line-strong);border-radius:6px;color:var(--ink);font-family:var(--font-body)" />' +
        '<button type="button" class="btn btn--sm evento-dia-remove" style="padding:6px 10px">✕</button>';
      row.querySelector('input').value = value || '';
      row.querySelector('.evento-dia-remove').addEventListener('click', function () { row.remove(); renumerarDias(); });
      itinerarioList.appendChild(row);
      renumerarDias();
    }
    (isEdit && existing.itinerario && existing.itinerario.length ? existing.itinerario : []).forEach(function (d) { addDiaRow(d); });
    box.querySelector('#eventoAddDiaBtn').addEventListener('click', function () { addDiaRow(''); });

    function closeModal() { document.body.removeChild(overlay); }
    box.querySelector('.admin-modal-cancel-btn').addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });

    box.querySelector('.admin-modal-save-btn').addEventListener('click', function () {
      var nome       = (nomeInput.value || '').trim();
      var carga      = (cargaInput.value || '').trim();
      var percentual = (percentualInput.value || '75').trim();
      var itinerario = Array.prototype.map.call(itinerarioList.querySelectorAll('input[type=text]'), function (i) { return i.value.trim(); })
        .filter(Boolean);
      errEl.style.display = 'none';
      if (!nome) { errEl.textContent = 'Dê um nome ao evento.'; errEl.style.display = ''; return; }
      if (!carga || isNaN(Number(carga)) || Number(carga) < 1) {
        errEl.textContent = 'Informe a carga horária (mín. 1 hora).'; errEl.style.display = ''; return;
      }
      if (!percentual || isNaN(Number(percentual)) || Number(percentual) < 1 || Number(percentual) > 100) {
        errEl.textContent = 'Frequência mínima deve ser entre 1 e 100%.'; errEl.style.display = ''; return;
      }
      var eventData = {
        nome: nome, cargaHoraria: carga, percentualMinimo: percentual,
        missaoTitulo: (missaoTituloInput.value || '').trim(),
        missaoTexto: (missaoTextoInput.value || '').trim(),
        topicos: (topicosInput.value || '').trim(),
        itinerario: itinerario,
        esperaAtiva: !!esperaInput.checked,
        publicado: !!publicadoInput.checked,
        restritoADiretores: !!restritoInput.checked,
        formato: formatoInput.value || 'presencial',
        modalidadeLabel: (modalidadeLabelInput.value || '').trim(),
        modalidadeDesc: (modalidadeDescInput.value || '').trim(),
        publicoLabel: (publicoLabelInput.value || '').trim(),
        publicoDesc: (publicoDescInput.value || '').trim()
      };
      if (isEdit) {
        firebase.database().ref('eventos/' + existing.key).update(eventData, function (err) {
          if (err) { errEl.textContent = 'Erro ao salvar. Tente novamente.'; errEl.style.display = ''; return; }
          closeModal();
          loadInterests();
        });
      } else {
        eventData.order = Date.now();
        eventData.createdAt = new Date().toISOString();
        firebase.database().ref('eventos').push().set(eventData, function (err) {
          if (err) { errEl.textContent = 'Erro ao criar. Tente novamente.'; errEl.style.display = ''; return; }
          closeModal();
          loadInterests();
        });
      }
    });
  }

  /* ---- Criar / Editar turma — modal com nome + datas dos encontros ---- */
  function openTurmaFormModal(existing, defaultEventoKey) {
    var isEdit = !!existing;
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9999';

    var box = document.createElement('div');
    box.className = 'modal-box';
    box.style.cssText = 'max-width:460px;width:90%;padding:28px;display:flex;flex-direction:column;gap:16px;max-height:85vh;overflow:auto';
    var eventoOpts = '<option value="">— sem evento —</option>' +
      EVENTOS_LIST.map(function (ev) {
        return '<option value="' + esc(ev.key) + '">' + esc(ev.nome) + ' (' + ev.cargaHoraria + 'h)</option>';
      }).join('');

    box.innerHTML =
      '<h3 style="font-size:1.1rem;font-family:var(--font-head);letter-spacing:.05em;color:var(--ink)">' + (isEdit ? 'Editar Turma' : 'Nova Turma') + '</h3>' +
      '<label class="auth-label">Evento<select id="turmaFormEvento" style="padding:8px 10px;background:var(--panel-2);border:1px solid var(--line-strong);border-radius:6px;color:var(--ink);font-family:var(--font-body);width:100%">' + eventoOpts + '</select></label>' +
      '<label class="auth-label">Nome da turma<input type="text" id="turmaFormLabel" placeholder="Ex: Turma 4 — Janeiro" autocomplete="off" /></label>' +
      '<label class="auth-label">Link do CMFlex <span style="opacity:.6;font-weight:400">(opcional)</span><input type="url" id="turmaFormCmflex" placeholder="https://..." autocomplete="off" /></label>' +
      '<div>' +
        '<span class="auth-label" style="display:block;margin-bottom:8px">Datas dos encontros</span>' +
        '<div id="turmaDatesList" style="display:flex;flex-direction:column;gap:8px;"></div>' +
        '<button type="button" class="btn btn--sm" id="turmaAddDateBtn" style="margin-top:8px">+ Adicionar data</button>' +
      '</div>' +
      '<p id="turmaFormErr" style="color:var(--red,#ff3b30);font-size:.85rem;display:none"></p>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:4px">' +
        '<button class="btn admin-modal-cancel-btn">Cancelar</button>' +
        '<button class="btn btn--primary admin-modal-save-btn">' + (isEdit ? 'Salvar' : 'Criar turma') + '</button>' +
      '</div>';

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    var eventoSel   = box.querySelector('#turmaFormEvento');
    var labelInput  = box.querySelector('#turmaFormLabel');
    var cmflexInput = box.querySelector('#turmaFormCmflex');
    var datesList   = box.querySelector('#turmaDatesList');
    var errEl       = box.querySelector('#turmaFormErr');

    eventoSel.value   = isEdit ? (existing.eventoKey || '') : (defaultEventoKey || '');
    labelInput.value  = isEdit ? existing.label : '';
    cmflexInput.value = isEdit ? (existing.cmflexLink || '') : '';

    function addDateRow(value) {
      var row = document.createElement('div');
      row.className = 'turma-date-row';
      row.style.cssText = 'display:flex;gap:8px;align-items:center;';
      row.innerHTML =
        '<input type="date" style="flex:1;padding:8px 10px;background:var(--panel-2);border:1px solid var(--line-strong);border-radius:6px;color:var(--ink);font-family:var(--font-body)" />' +
        '<button type="button" class="btn btn--sm turma-date-remove" style="padding:6px 10px">✕</button>';
      row.querySelector('input').value = value || '';
      row.querySelector('.turma-date-remove').addEventListener('click', function () { row.remove(); });
      datesList.appendChild(row);
    }

    if (isEdit && existing.dias.length) {
      existing.dias.forEach(function (d) { addDateRow(d); });
    } else {
      addDateRow('');
    }

    box.querySelector('#turmaAddDateBtn').addEventListener('click', function () { addDateRow(''); });

    function closeModal() { document.body.removeChild(overlay); }
    box.querySelector('.admin-modal-cancel-btn').addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });

    box.querySelector('.admin-modal-save-btn').addEventListener('click', function () {
      var label = (labelInput.value || '').trim();
      var cmflexLink = (cmflexInput.value || '').trim();
      var dias = Array.prototype.map.call(datesList.querySelectorAll('input[type=date]'), function (i) { return i.value; })
        .filter(Boolean).sort();

      errEl.style.display = 'none';
      if (!label) { errEl.textContent = 'Dê um nome pra turma.'; errEl.style.display = ''; return; }
      if (!dias.length) { errEl.textContent = 'Adicione pelo menos uma data.'; errEl.style.display = ''; return; }

      var data = { label: label, dias: dias, cmflexLink: cmflexLink, eventoKey: eventoSel.value || '' };
      if (isEdit) {
        firebase.database().ref('turmas/' + existing.key).update(data, function (err) {
          if (err) { errEl.textContent = 'Erro ao salvar. Tente novamente.'; errEl.style.display = ''; return; }
          closeModal();
          loadInterests();
        });
      } else {
        data.order = Date.now();
        data.createdAt = new Date().toISOString();
        firebase.database().ref('turmas').push().set(data, function (err) {
          if (err) { errEl.textContent = 'Erro ao criar. Tente novamente.'; errEl.style.display = ''; return; }
          closeModal();
          loadInterests();
        });
      }
    });
  }

  /* ---- Excluir turma — apaga a turma e todos os dados ligados a ela ---- */
  function deleteTurma(t, active, removed) {
    var msg = 'Excluir a turma "' + t.label + '"?\n\nIsso apaga permanentemente a turma e todos os dados ligados a ela';
    if (active.length || removed.length) {
      msg += ' — incluindo ' + active.length + ' participante' + (active.length !== 1 ? 's' : '') + ' ativo' + (active.length !== 1 ? 's' : '') +
        (removed.length ? ' e ' + removed.length + ' removido' + (removed.length !== 1 ? 's' : '') : '') + ', presenças e histórico';
    }
    msg += '.\n\nEssa ação não pode ser desfeita.';
    adminConfirm(msg, function () {
      var updates = {};
      updates['turmas/' + t.key] = null;
      updates['turmas-interesse/' + t.key] = null;
      updates['turmas-config/' + t.key] = null;
      updates['turmas-checkin/' + t.key] = null;
      updates['turmas-interesse-log/' + t.key] = null;
      firebase.database().ref().update(updates, function (err) {
        if (err) { adminAlert('Erro ao excluir. Tente novamente.'); return; }
        loadInterests();
      });
    });
  }

  /* ---- Finalizar / Reabrir turma ---- */

  /* Verifica se algum dos candidatos a inscrito também está interessado (não removido)
     em outra turma — precisa saber ANTES de finalizar, para avisar o admin */
  /* Só existe conflito de verdade quando a pessoa já é Inscrita em outra
     turma — interesse (status "interessado") em quantas turmas quiser não é
     problema, então não entra aqui. Ao confirmar/adicionar como Inscrita
     numa turma, só a inscrição já existente em outra é removida. */
  function checkOutrasTurmas(turmaKey, candidatos, cb) {
    var outras = TURMAS_LIST.map(function (t) { return t.key; }).filter(function (k) { return k !== turmaKey; });
    var pending = candidatos.length * outras.length;
    if (!pending) { cb([]); return; }
    var overlaps = [];
    outras.forEach(function (t) {
      candidatos.forEach(function (eKey) {
        firebase.database().ref('turmas-interesse/' + t + '/' + eKey).once('value', function (snap) {
          pending--;
          var val = snap.val();
          if (val && !val.removed && val.status === 'inscrito') overlaps.push({ eKey: eKey, name: val.name || eKey, turma: t });
          if (pending === 0) cb(overlaps);
        });
      });
    });
  }

  /* Encerrar interesse só fecha a captação pro público e libera check-in/certificados —
     não promove mais ninguém a inscrito automaticamente. A inscrição oficial agora
     acontece no CMFlex, fora do portal; quem de fato se inscreveu lá é confirmado
     manualmente, pessoa por pessoa (ver confirmarInscrito). */
  function finalizeTurma(turmaKey) {
    adminConfirm(
      'Encerrar o interesse da turma "' + turmaLabel(turmaKey) + '"?\n\n' +
      'O card público vai parar de aceitar novo interesse e passa a orientar as pessoas pra se inscreverem no CMFlex. ' +
      'Ninguém vira inscrita automaticamente — você confirma cada pessoa manualmente depois, quando souber que ela se inscreveu de fato no CMFlex.',
      function () {
        firebase.database().ref('turmas-config/' + turmaKey + '/finalizada').set(true, function (err) {
          if (err) { adminAlert('Erro ao encerrar. Tente novamente.'); return; }
          loadInterests();
        });
      }
    );
  }

  function reopenTurma(turmaKey) {
    adminConfirm('Reabrir o interesse da turma "' + turmaLabel(turmaKey) + '"?\n\nO card volta a aceitar novas manifestações de interesse. Quem já foi confirmado como inscrito continua inscrito.', function () {
      var updates = {};
      updates['turmas-config/' + turmaKey + '/finalizada'] = false;
      updates['turmas-config/' + turmaKey + '/diaAtivo']   = null;
      firebase.database().ref().update(updates, function (err) {
        if (err) { adminAlert('Erro ao reabrir. Tente novamente.'); return; }
        loadInterests();
      });
    });
  }

  /* ---- Confirmar / Desconfirmar inscrição no CMFlex (por pessoa) ---- */
  function confirmarInscrito(turmaKey, eKey, pessoa) {
    checkOutrasTurmas(turmaKey, [eKey], function (overlaps) {
      var msg = 'Confirmar que ' + pessoa.name + ' se inscreveu no CMFlex para "' + turmaLabel(turmaKey) + '"?\n\nEla passa a ter acesso a Conteúdos, Treinamento Jedi e pode registrar presença.';
      if (overlaps.length) {
        var lista = overlaps.map(function (o) { return '• já está inscrita na "' + turmaLabel(o.turma) + '"'; }).join('\n');
        msg += '\n\nEla já é inscrita em outra turma. Se continuar, essa outra inscrição será removida automaticamente (ninguém pode ficar inscrita em mais de uma):\n\n' + lista;
      }
      adminConfirm(msg, function () {
        var sess = window.faAuth && window.faAuth.getSession();
        var updates = {};
        updates['turmas-interesse/' + turmaKey + '/' + eKey + '/status'] = 'inscrito';
        updates['turmas-interesse/' + turmaKey + '/' + eKey + '/confirmedByAdmin'] = sess ? sess.email : null;
        updates['turmas-interesse/' + turmaKey + '/' + eKey + '/confirmedByAdminName'] = sess ? (sess.name || sess.email) : null;
        updates['turmas-interesse/' + turmaKey + '/' + eKey + '/confirmedDate'] = new Date().toISOString();
        var now = new Date().toISOString();
        overlaps.forEach(function (o) {
          updates['turmas-interesse/' + o.turma + '/' + o.eKey + '/removed'] = true;
          updates['turmas-interesse/' + o.turma + '/' + o.eKey + '/removedDate'] = now;
          updates['turmas-interesse/' + o.turma + '/' + o.eKey + '/removedReason'] = 'Inscrita automaticamente na turma "' + turmaLabel(turmaKey) + '"';
        });
        firebase.database().ref().update(updates, function (err) {
          if (err) { adminAlert('Erro ao confirmar. Tente novamente.'); return; }
          firebase.database().ref('turmas-interesse-log/' + turmaKey + '/' + eKey).push({
            name: pessoa.name, email: pessoa.email, area: pessoa.area || '',
            action: 'confirmado', date: now,
            adminName: sess ? (sess.name || sess.email) : 'Admin'
          });
          loadInterests();
        });
      });
    });
  }

  function desconfirmarInscrito(turmaKey, eKey, pessoa) {
    adminConfirm('Desconfirmar a inscrição de ' + pessoa.name + ' em "' + turmaLabel(turmaKey) + '"?\n\nEla perde na hora o acesso a Conteúdos, Treinamento Jedi e não poderá mais registrar presença. Continua como interessada na turma.', function () {
      var sess = window.faAuth && window.faAuth.getSession();
      var now = new Date().toISOString();
      var updates = {};
      updates['turmas-interesse/' + turmaKey + '/' + eKey + '/status'] = 'interessado';
      updates['turmas-interesse/' + turmaKey + '/' + eKey + '/confirmedByAdmin'] = null;
      updates['turmas-interesse/' + turmaKey + '/' + eKey + '/confirmedByAdminName'] = null;
      updates['turmas-interesse/' + turmaKey + '/' + eKey + '/confirmedDate'] = null;
      firebase.database().ref().update(updates, function (err) {
        if (err) { adminAlert('Erro ao desconfirmar. Tente novamente.'); return; }
        firebase.database().ref('turmas-interesse-log/' + turmaKey + '/' + eKey).push({
          name: pessoa.name, email: pessoa.email, area: pessoa.area || '',
          action: 'desconfirmado', date: now,
          adminName: sess ? (sess.name || sess.email) : 'Admin'
        });
        loadInterests();
      });
    });
  }

  /* ---- QR Code modal ---- */
  function openQrModal(t) {
    var modal   = document.getElementById('qrModal');
    var canvas  = document.getElementById('qrCanvas');
    var errEl   = document.getElementById('qrModalError');
    var turmaEl = document.getElementById('qrModalTurma');
    var urlEl   = document.getElementById('qrModalUrl');
    if (!modal || !canvas) return;
    var url = window.location.origin + window.location.pathname + '#checkin?turma=' + t.key;
    turmaEl.textContent = t.label + ' (' + t.dates + ')';
    urlEl.textContent   = url;
    canvas.hidden = false;
    if (errEl) errEl.hidden = true;
    if (typeof QRCode !== 'undefined') {
      QRCode.toCanvas(canvas, url, { width: 220, color: { dark: '#ffffff', light: '#0d1b2a' } }, function (err) {
        if (err) {
          console.warn('QR error:', err);
          canvas.hidden = true;
          if (errEl) errEl.hidden = false;
        }
      });
    } else {
      /* Biblioteca externa (CDN) não carregou — evita deixar o quadro em branco sem explicação */
      canvas.hidden = true;
      if (errEl) errEl.hidden = false;
    }
    modal.hidden = false;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var closeBtn = document.getElementById('qrModalClose');
    var modal    = document.getElementById('qrModal');
    if (closeBtn && modal) {
      closeBtn.addEventListener('click', function () { modal.hidden = true; });
      modal.addEventListener('click', function (e) { if (e.target === modal) modal.hidden = true; });
    }
  });

  /* ---- CSV exports ---- */
  function exportTurmaCSV(t, all, finalizada, checkinT) {
    var minDias = Math.ceil(t.dias.length * CRITERIO_PRESENCA);
    var rows = [];
    /* MUDANÇA 1: exportar apenas não-removidos */
    var active = all.filter(function (r) { return r.removed !== true; });
    active.forEach(function (r) {
      var eKey = emailKeyFromEmail(r.email);
      var st = getStatus(r);
      var addedBy = r.addedByAdmin === true ? (r.addedByAdminName || 'Admin') : '';
      var row = [t.label, r.name||'', r.email||'', r.area||'', st,
        r.date ? new Date(r.date).toLocaleString('pt-BR') : '', addedBy];
      if (finalizada) {
        var diasPresente = 0;
        t.dias.forEach(function (d) {
          var ck = checkinT[d] && checkinT[d][eKey];
          row.push(ck ? (ck.source === 'admin' ? 'adm' : 'qr') : '');
          if (ck) diasPresente++;
        });
        row.push(diasPresente + '/' + t.dias.length);
        row.push(diasPresente >= minDias ? 'Sim' : 'Não');
      }
      rows.push(row);
    });
    var headers = ['Turma','Nome','E-mail','Área','Status','Data Registro','Adicionado por'];
    if (finalizada) {
      t.dias.forEach(function (d) { headers.push(fmtDia(d)); });
      headers.push('Frequência', 'Atingiu critério (' + Math.round(CRITERIO_PRESENCA * 100) + '%)');
    }
    toXls(headers, rows, 'turma-' + t.key + '-' + new Date().toISOString().slice(0,10) + '.csv');
  }

  /* ---- Lista de presença (documento para impressão/PDF, ex.: envio ao RH) ---- */
  function imprimirListaPresenca(t, all, finalizada, checkinT) {
    /* só quem confirmou presença (inscrito) pode ter check-in — ver checkin.js */
    var inscritos = all.filter(function (r) { return r.removed !== true && r.status === 'inscrito'; });
    if (!inscritos.length) { adminAlert('Não há inscritos confirmados nesta turma para gerar a lista de presença.'); return; }

    var minDias = Math.ceil(t.dias.length * CRITERIO_PRESENCA);
    var geradoEm = new Date().toLocaleString('pt-BR');

    var diaCols = t.dias.map(function (d) { return '<th>' + esc(fmtDia(d)) + '</th>'; }).join('');
    var rowsHtml = inscritos.map(function (r, i) {
      var eKey = emailKeyFromEmail(r.email);
      var diasPresente = 0;
      var diaCells = t.dias.map(function (d) {
        var ck = checkinT[d] && checkinT[d][eKey];
        if (ck) diasPresente++;
        return '<td class="lp-dia">' + (ck ? '&#x2713;' : '') + '</td>';
      }).join('');
      var freqCell = finalizada
        ? '<td>' + diasPresente + '/' + t.dias.length + '</td><td>' + (diasPresente >= minDias ? 'Sim' : 'Não') + '</td>'
        : '';
      return '<tr><td>' + (i + 1) + '</td><td>' + esc(r.name || '') + '</td><td>' + esc(r.email || '') +
        '</td><td>' + esc(r.area || '') + '</td>' + diaCells + freqCell + '</tr>';
    }).join('');

    var freqHead = finalizada
      ? '<th>Frequência</th><th>Atingiu critério (' + Math.round(CRITERIO_PRESENCA * 100) + '%)</th>'
      : '';

    var html = '<!doctype html><html><head><meta charset="utf-8"><title>Lista de presença — ' + esc(t.label) + '</title>' +
      '<style>' +
      'body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px;}' +
      'h1{font-size:1.3rem;margin:0 0 4px;}' +
      '.lp-meta{font-size:.85rem;color:#444;margin-bottom:16px;}' +
      'table{border-collapse:collapse;width:100%;font-size:.78rem;}' +
      'th,td{border:1px solid #999;padding:4px 6px;text-align:left;}' +
      'th{background:#eee;}' +
      '.lp-dia{text-align:center;min-width:28px;}' +
      '.lp-assinaturas{margin-top:40px;display:flex;gap:60px;}' +
      '.lp-assinatura{flex:1;border-top:1px solid #333;padding-top:6px;font-size:.8rem;}' +
      '.lp-actions{margin-bottom:16px;}' +
      '@media print{.lp-actions{display:none;} body{margin:10px;}}' +
      '@page{size:A4 landscape;margin:14mm;}' +
      '</style></head><body>' +
      '<div class="lp-actions"><button id="lp-print-btn">Imprimir / salvar como PDF</button></div>' +
      '<h1>Lista de presença — ' + esc(t.label) + '</h1>' +
      '<div class="lp-meta">Período: ' + esc(t.dates || '—') + ' · Gerado em ' + esc(geradoEm) + '</div>' +
      '<table><thead><tr><th>#</th><th>Nome</th><th>E-mail</th><th>Área</th>' + diaCols + freqHead + '</tr></thead>' +
      '<tbody>' + rowsHtml + '</tbody></table>' +
      '<div class="lp-assinaturas"><div class="lp-assinatura">Responsável pela turma</div><div class="lp-assinatura">RH</div></div>' +
      '</body></html>';

    var win = window.open('', '_blank');
    if (!win) { adminAlert('Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.'); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
    var printBtn = win.document.getElementById('lp-print-btn');
    if (printBtn) printBtn.addEventListener('click', function () { win.print(); });
  }

  function exportAllInterests(data, config, checkin) {
    var rows = [];
    TURMAS_LIST.forEach(function (t) {
      var finalizada = !!(config[t.key] && config[t.key].finalizada);
      var checkinT   = checkin[t.key] || {};
      var all = (data[t.key] ? Object.values(data[t.key]) : []).sort(cmpNome);
      /* MUDANÇA 1: exportar apenas não-removidos */
      var active = all.filter(function (r) { return r.removed !== true; });
      active.forEach(function (r) {
        var eKey = emailKeyFromEmail(r.email);
        var st = getStatus(r);
        var diasPresente = 0;
        t.dias.forEach(function (d) { if (checkinT[d] && checkinT[d][eKey]) diasPresente++; });
        rows.push([t.label, r.name||'', r.email||'', r.area||'', st,
          r.date ? new Date(r.date).toLocaleString('pt-BR') : '',
          finalizada ? diasPresente + '/' + t.dias.length : '']);
      });
    });
    toXls(['Turma','Nome','E-mail','Área','Status','Data Registro','Frequência'],
      rows, 'turmas-estado-' + new Date().toISOString().slice(0,10) + '.csv');
  }

  function exportInterestLog() {
    var db = firebase.database();
    db.ref('turmas-interesse-log').once('value', function (snapLog) {
      db.ref('turmas-interesse').once('value', function (snapI) {
        var logData      = snapLog.val() || {};
        var interestData = snapI.val()   || {};
        var rows = [];

        function fmtData(iso) { if (!iso) return ''; var d = new Date(iso); return d.toLocaleDateString('pt-BR'); }
        function fmtHora(iso) { if (!iso) return ''; var d = new Date(iso); return d.toLocaleTimeString('pt-BR'); }

        TURMAS_LIST.forEach(function (t) {
          var entries = [];

          /* Ações de usuário (log) */
          var turmaLog = logData[t.key] || {};
          Object.values(turmaLog).forEach(function (userLog) {
            Object.values(userLog).forEach(function (entry) {
              var ACAO_LABELS = {
                registrado: 'Interesse registrado', removido: 'Interesse removido',
                confirmado: 'Confirmado como inscrita', desconfirmado: 'Desconfirmado (voltou a interessada)'
              };
              var acao = ACAO_LABELS[entry.action] || entry.action;
              var origem = entry.adminName ? 'Admin — ' + entry.adminName : 'Participante';
              entries.push({ ts: entry.date || '', row: [t.label, entry.name||'', entry.email||'', entry.area||'', fmtData(entry.date), fmtHora(entry.date), acao, origem, '', ''] });
            });
          });

          /* Ações do admin lidas diretamente de turmas-interesse (add e remove) */
          var turmaI = interestData[t.key] || {};
          Object.values(turmaI).forEach(function (r) {
            if (r.addedByAdmin && r.addedByAdminName) {
              entries.push({ ts: r.date || '', row: [t.label, r.name||'', r.email||'', r.area||'', fmtData(r.date), fmtHora(r.date), 'Adicionado pelo admin', 'Admin — ' + r.addedByAdminName, '', ''] });
            }
            /* Quem tirou o próprio interesse já entrou pelo log acima (é o
               único caminho que grava status "removido"), então aqui só entra
               a saída pelo painel — inclusive a antiga, que não guardou o nome
               de quem removeu e antes sumia do histórico. */
            if (r.removed && r.status !== 'removido') {
              var autor = r.removedByAdminName ? 'Admin — ' + r.removedByAdminName : 'Não registrado';
              var destino = r.movedToEspera ? 'Lista de espera' : (r.removedParaTurmaLabel || 'Saiu');
              entries.push({ ts: r.removedDate || '', row: [t.label, r.name||'', r.email||'', r.area||'', fmtData(r.removedDate), fmtHora(r.removedDate), 'Removido da turma', autor, r.removedReason || '', destino] });
            }
          });

          entries.sort(function (a, b) { return (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0); });
          entries.forEach(function (e) { rows.push(e.row); });
        });

        toXls(['Turma','Nome','E-mail','Área','Data','Hora','Ação','Origem','Motivo','Destino'],
          rows, 'historico-' + new Date().toISOString().slice(0,10) + '.csv');
      });
    });
  }

  function toXls(headers, rows, filename) {
    function csvCell(v) {
      var s = String(v == null ? '' : v).replace(/"/g, '""');
      return /["\n\r;]/.test(s) ? '"' + s + '"' : s;
    }
    var lines = [headers.map(csvCell).join(';')].concat(
      rows.map(function (row) { return row.map(csvCell).join(';'); })
    );
    var csvFilename = filename.replace(/\.xls$/i, '.csv');
    /* BOM UTF-8 (﻿) garante que Excel abra com encoding correto e em modo editável */
    var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = csvFilename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(function() { URL.revokeObjectURL(url); }, 100);
  }
  window.faToXls = toXls;

  const REPO_SEEDS = [
    { type: 'doc',   title: 'The Scrum Guide',                       url: 'https://scrumguides.org/',                                                                                                                                              desc: '' },
    { type: 'video', title: 'Agile Product Ownership in a Nutshell', url: 'https://www.youtube.com/results?search_query=agile+product+ownership+in+a+nutshell+kniberg',                                                                           desc: '' },
    { type: 'video', title: 'O que é Agilidade? (busca)',            url: 'https://www.youtube.com/results?search_query=o+que+%C3%A9+agilidade+business+agility',                                                                                  desc: '' },
    { type: 'tool',  title: 'OKR — Objetivos e Key Results',         url: 'https://www.youtube.com/results?search_query=como+escrever+okr+objetivo+key+results',                                                                                   desc: '' },
    { type: 'tool',  title: 'Design Thinking & Duplo Diamante',      url: 'https://www.youtube.com/results?search_query=duplo+diamante+design+thinking',                                                                                            desc: '' },
    { type: 'book',  title: 'Team OKR em Ação',                      url: 'https://caroli.org/livro/team-okr/',                                                                                                                                      desc: '' },
    { type: 'book',  title: 'O Poder da Simplicidade no Mundo Ágil — Susanne Andrade', url: 'https://susanneandrade.com.br/livros-2',                                                                                                               desc: 'Indicado por Maira Prado.' },
    { type: 'video', title: 'MBA em Liderança Exponencial e Transformação Digital (Udemy)', url: 'https://www.udemy.com/course/xba-em-lideranca-exponencial-e-transformacao-digital/',                                                              desc: 'Indicado por Vanisa Miksucas.' },
    { type: 'book',  title: 'Kanban: Mudança Evolucionária de Sucesso — David J. Anderson', url: 'https://shop.leankanban.com/collections/kanban-mudanca-evolucionaria-de-sucesso-para-seu-negocio-de-tecnologia-david-j-anderson-portuguese/david-anderson', desc: 'Indicado por Pedro Ferrari.' },
    { type: 'video', title: 'Fome de Poder — Processos (Lean com analogias a Star Wars)', url: 'https://www.youtube.com/watch?v=8Xt63PHuMqU',                                                                                                      desc: 'Indicado por Daniel Frazão.' },
    { type: 'video', title: 'Desdobramento de OKR na prática',       url: 'https://www.youtube.com/watch?v=jP35UFXDnzA',                                                                                                                            desc: 'Indicado por Rodolfo Credi.' }
  ];

  const TYPE_LABEL = { doc: 'documento', video: 'vídeo', book: 'livro', tool: 'ferramenta', link: 'link' };

  function seedKey(url) {
    return (url || '').toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 80);
  }

  /* ---- Repo items for admin ---- */
  function loadRepoAdmin() {
    const c = document.getElementById('adminRepo');
    if (!c) return;
    c.innerHTML = '<p class="loading-msg">Carregando repositório…</p>';

    Promise.all([
      firebase.database().ref('fa-seeds-hidden').once('value'),
      firebase.database().ref('fa-seeds-deleted').once('value'),
      firebase.database().ref('fa-holocron-hidden').once('value'),
      firebase.database().ref('holocron').once('value')
    ]).then(function (snaps) {
      const hidden      = snaps[0].val() || {};
      const deleted     = snaps[1].val() || {};
      const hiddenHolo  = snaps[2].val() || {};
      const holoData    = snaps[3].val() || {};
      const fbEntries   = Object.entries(holoData);

      c.innerHTML = '';

      const visibleSeeds = REPO_SEEDS.filter(function (s) { return !deleted[seedKey(s.url)]; });
      const total = visibleSeeds.length + fbEntries.length;
      const h4 = document.createElement('h4');
      h4.innerHTML = 'Todos os conteúdos <span class="admin-badge">' + total + '</span>';
      c.appendChild(h4);

      /* Seeds curados */
      const seedSec = document.createElement('div');
      seedSec.innerHTML = '<p style="font-size:.75rem;color:var(--ink-3);margin:16px 0 8px;text-transform:uppercase;letter-spacing:.1em">Curados (seed)</p>';
      c.appendChild(seedSec);

      visibleSeeds.forEach(function (item) {
        const sk  = seedKey(item.url);
        const isHidden = !!hidden[sk];
        const row = document.createElement('div');
        row.className = 'admin-repo-row';
        if (isHidden) row.style.opacity = '.45';

        const by = (function () {
          var m = (item.desc || '').match(/Indicado por ([^.]+)/);
          return m ? ' · Indicado por ' + esc(m[1].trim()) : '';
        })();

        const actionBtns = isHidden
          ? '<button class="admin-del-btn admin-restore-btn">Restaurar</button>'
          : '<button class="admin-del-btn admin-hide-btn">Ocultar</button>';

        row.innerHTML =
          '<div class="admin-repo-info">' +
            '<span class="admin-repo-title">' + esc(item.title) + '</span>' +
            '<span class="admin-repo-by">curado · ' + esc(TYPE_LABEL[item.type] || item.type) + by + (isHidden ? ' · <em>oculto</em>' : '') + '</span>' +
          '</div>' +
          '<div style="display:flex;gap:6px">' + actionBtns + '<button class="admin-del-btn admin-perm-del-btn">Deletar</button></div>';

        row.querySelector('.admin-hide-btn, .admin-restore-btn').addEventListener('click', function () {
          if (isHidden) {
            adminConfirm('Restaurar "' + item.title + '" no repositório público?', function () {
              firebase.database().ref('fa-seeds-hidden/' + sk).remove(function () { loadRepoAdmin(); });
            });
          } else {
            adminConfirm('Ocultar "' + item.title + '" do repositório público?', function () {
              firebase.database().ref('fa-seeds-hidden/' + sk).set(true, function () { loadRepoAdmin(); });
            });
          }
        });

        row.querySelector('.admin-perm-del-btn').addEventListener('click', function () {
          adminConfirm('Deletar permanentemente "' + item.title + '"? Esta ação não pode ser desfeita.', function () {
            const updates = {};
            updates['fa-seeds-deleted/' + sk] = true;
            updates['fa-seeds-hidden/' + sk]  = true;
            firebase.database().ref().update(updates, function () { loadRepoAdmin(); });
          });
        });

        seedSec.appendChild(row);
      });

      /* Itens enviados por usuários */
      const userSec = document.createElement('div');
      userSec.innerHTML = '<p style="font-size:.75rem;color:var(--ink-3);margin:24px 0 8px;text-transform:uppercase;letter-spacing:.1em">Enviados por usuários</p>';
      c.appendChild(userSec);

      if (!fbEntries.length) {
        userSec.innerHTML += '<p class="admin-empty">Nenhum item enviado ainda.</p>';
      } else {
        fbEntries.forEach(function (e) {
          const key = e[0], item = e[1];
          const isHiddenHolo = !!hiddenHolo[key];
          const row = document.createElement('div');
          row.className = 'admin-repo-row';
          if (isHiddenHolo) row.style.opacity = '.45';

          row.innerHTML =
            '<div class="admin-repo-info">' +
              '<span class="admin-repo-title">' + esc(item.title || '—') + (isHiddenHolo ? ' <em style="color:var(--ink-3);font-size:.78rem">(oculto)</em>' : '') + '</span>' +
              '<span class="admin-repo-by">' + esc(item.authorName || '—') + (item.createdAt ? ' · ' + fmtDate(item.createdAt) : '') + '</span>' +
            '</div>' +
            '<div style="display:flex;gap:6px">' +
              (isHiddenHolo
                ? '<button class="admin-del-btn admin-restore-btn" data-key="' + esc(key) + '">Restaurar</button>'
                : '<button class="admin-del-btn admin-hide-btn" data-key="' + esc(key) + '">Ocultar</button>') +
              '<button class="admin-del-btn admin-perm-del-btn" data-key="' + esc(key) + '">Deletar</button>' +
            '</div>';

          row.querySelector('.admin-hide-btn, .admin-restore-btn').addEventListener('click', function () {
            if (isHiddenHolo) {
              adminConfirm('Restaurar "' + (item.title || '') + '" no repositório público?', function () {
                firebase.database().ref('fa-holocron-hidden/' + key).remove(function () { loadRepoAdmin(); });
              });
            } else {
              adminConfirm('Ocultar "' + (item.title || '') + '" do repositório público?', function () {
                firebase.database().ref('fa-holocron-hidden/' + key).set(true, function () { loadRepoAdmin(); });
              });
            }
          });

          row.querySelector('.admin-perm-del-btn').addEventListener('click', function () {
            adminConfirm('Deletar "' + esc(item.title || '') + '" do repositório? Esta ação não pode ser desfeita.', function () {
              firebase.database().ref('holocron/' + key).remove(function (err) {
                if (!err) { firebase.database().ref('fa-holocron-hidden/' + key).remove(); row.remove(); }
                else adminAlert('Erro ao deletar. Tente novamente.');
              });
            });
          });

          userSec.appendChild(row);
        });
      }
    });
  }

  function handlePwdReset(btn) {
    const email = btn.dataset.email;
    const name  = btn.dataset.name;
    adminConfirm('Enviar e-mail de redefinição de senha para ' + name + ' (' + email + ')?', function () {
      firebase.auth().sendPasswordResetEmail(email)
        .then(function () {
          adminAlert('E-mail enviado para ' + email + '.\n' + name + ' receberá o link em alguns minutos para definir uma nova senha.');
        })
        .catch(function (err) {
          if (err.code === 'auth/user-not-found') {
            adminAlert(name + ' ainda não tem cadastro ativo. A pessoa precisa fazer o primeiro login no sistema antes de poder redefinir a senha.');
          } else {
            adminAlert('Erro ao enviar: ' + err.message);
          }
        });
    });
  }

  /* ---- Lista de Espera ---- */
  /* A fila é do evento da turma de origem (eventoKey, gravado na migração —
     ver migrarParaEsperaGravar e migrarEsperaEventoKey). Filtra o nó inteiro
     de fa-espera para as entradas de UM evento (evKey === null pega as
     órfãs: sem eventoKey, de antes desta separação existir). Mantém
     removidas junto com ativas — "Saíram da fila" precisa delas. */
  function filtrarEsperaPorEvento(dataEspera, evKey) {
    var out = {};
    Object.keys(dataEspera).forEach(function (eKeyPessoa) {
      var pessoa = dataEspera[eKeyPessoa];
      if (!pessoa || typeof pessoa !== 'object') return;
      var filtradas = {};
      Object.keys(pessoa).forEach(function (origem) {
        var entry = pessoa[origem];
        if (!entry || typeof entry !== 'object') return;
        var pertence = evKey === null ? !entry.eventoKey : entry.eventoKey === evKey;
        if (pertence) filtradas[origem] = entry;
      });
      if (Object.keys(filtradas).length) out[eKeyPessoa] = filtradas;
    });
    return out;
  }

  function filtrarInteressePorEvento(interesse, turmasVal, evKey) {
    var out = {};
    Object.keys(interesse).forEach(function (tk) {
      if (turmasVal[tk] && turmasVal[tk].eventoKey === evKey) out[tk] = interesse[tk];
    });
    return out;
  }

  function loadEspera() {
    firebase.database().ref('fa-espera').once('value', function (espSnap) {
      firebase.database().ref('turmas').once('value', function (tSnap) {
        firebase.database().ref('turmas-config').once('value', function (cfgSnap) {
          firebase.database().ref('turmas-interesse').once('value', function (iSnap) {
            renderEsperaTudo(espSnap.val() || {}, tSnap.val() || {}, cfgSnap.val() || {}, iSnap.val() || {});
          });
        });
      });
    });
  }

  /* Uma seção de Lista de Espera por evento, dentro do card recolhível dele
     — ao lado das turmas, não mais flutuando abaixo de todos. Evento sem
     ninguém esperando (ativo ou já saído) não ganha seção: ruído. Quem não
     tem eventoKey — registro de antes desta mudança, entrado direto pelo
     card do site, sem dizer para qual evento — cai numa seção à parte,
     abaixo de todos os eventos: não dá para adivinhar, e não pode sumir.
     Enquanto só um evento tiver turma isso não acontece: a migração
     adota essas entradas (ver migrarEsperaEventoKey), então esta seção fica
     vazia até um segundo evento ganhar turma e uma entrada nova nascer sem
     dono. */
  function renderEsperaTudo(dataEspera, turmasVal, cfgVal, interesse) {
    document.querySelectorAll('.ev-espera-section').forEach(function (el) { el.remove(); });

    EVENTOS_LIST.forEach(function (ev) {
      var evWrap = document.querySelector('[data-ev-key="' + ev.key + '"] .ev-turmas-wrap');
      if (!evWrap) return;
      var dataEv = filtrarEsperaPorEvento(dataEspera, ev.key);
      if (!Object.keys(dataEv).length) return;
      var interesseEv = filtrarInteressePorEvento(interesse, turmasVal, ev.key);
      var section = document.createElement('div');
      section.className = 'ev-espera-section';
      /* Fila desligada com gente dentro: sem este aviso, a lista aparece no
         painel e o card não aparece no site, e não dá pra saber por quê.
         Ninguém é escondido — desligar impede entrada nova, não apaga
         quem já entrou. */
      if (!ev.esperaAtiva) {
        var aviso = document.createElement('p');
        aviso.className = 'admin-empty';
        aviso.textContent = 'Lista de espera desligada neste evento: o card não aparece na página Turmas e ninguém novo entra. Quem já estava na fila continua abaixo — para voltar a aceitar, marque "Aceitar lista de espera" ao editar o evento.';
        section.appendChild(aviso);
      }
      section.appendChild(buildEsperaBlock(dataEv, turmasVal, cfgVal, interesseEv, ev.key));
      evWrap.appendChild(section);
    });

    var c = document.getElementById('adminEspera');
    if (!c) return;
    c.innerHTML = '';
    var orfaos = filtrarEsperaPorEvento(dataEspera, null);
    if (Object.keys(orfaos).length) {
      var hdrOrf = document.createElement('h4');
      hdrOrf.textContent = 'Lista de Espera — sem evento';
      c.appendChild(hdrOrf);
      var descOrf = document.createElement('p');
      descOrf.className = 'admin-empty';
      descOrf.textContent = 'Registros entrados direto pelo card do site sem dizer para qual evento, num momento em que havia mais de um evento com turma aberta. Não dá para adivinhar — mova para a turma certa manualmente.';
      c.appendChild(descOrf);
      c.appendChild(buildEsperaBlock(orfaos, turmasVal, cfgVal, interesse, null));
    }
  }

  /* Monta a Lista de Espera de UM grupo (um evento, ou as órfãs). dataEv já
     vem filtrado a esse grupo — inclusive "Remover da lista" só tira a
     pessoa das origens DESTE grupo: se ela também espera por outro evento,
     essa espera não é tocada aqui. interesseEv já vem restrito às turmas
     deste evento (ou, nas órfãs, sem restrição — não tem evento para
     restringir a). evKeyOrNull é a chave do evento, ou null para as órfãs. */
  function buildEsperaBlock(dataEv, turmasVal, cfgVal, interesseEv, evKeyOrNull) {
    var box = document.createElement('div');

    /* Uma linha por pessoa E por origem: quem passou por duas turmas aparece
       duas vezes, com a data do interesse de cada uma. A ordem da fila
       continua sendo a data do interesse, não a da saída. */
    var list = [];
    Object.keys(dataEv).forEach(function (eKey) {
      window.faTurmasUtil.esperaAtivas(dataEv[eKey]).forEach(function (e) {
        e._key = eKey;
        list.push(e);
      });
    });
    list.sort(function (a, b) { return (a.date || '').localeCompare(b.date || ''); });

    var pessoas = {};
    list.forEach(function (p) { pessoas[p._key] = true; });
    var nPessoas = Object.keys(pessoas).length;

    var hdr = document.createElement('h4');
    /* O selo conta PESSOAS — é quantas cabeças estão esperando, o número que
       se usa para planejar. A linha ao lado abre os dois, porque uma pessoa
       que espera desde três turmas é uma informação diferente de três
       pessoas esperando. */
    hdr.innerHTML = 'Lista de Espera <span class="admin-badge">' + nPessoas + '</span>' +
      (list.length !== nPessoas
        ? '<span class="espera-hdr-det">' + nPessoas + ' pessoa' + (nPessoas !== 1 ? 's' : '') +
          ' · ' + list.length + ' registros (quem passou por mais de uma turma aparece uma vez por turma)</span>'
        : '');
    box.appendChild(hdr);
    box.appendChild(resumoEspera(dataEv, interesseEv, turmasVal));

    if (!list.length) {
      box.insertAdjacentHTML('beforeend', '<p class="admin-empty">Ninguém esperando ativamente agora.</p>');
      box.appendChild(saidosDaFila(dataEv, turmasVal));
      return box;
    }

    /* dropdown "Mover para turma" — só turmas DESTE evento (órfã: qualquer
       turma aberta, já que não sabemos para qual evento ela espera) */
    var turmaOpts = Object.keys(turmasVal).filter(function (k) {
      return evKeyOrNull === null || turmasVal[k].eventoKey === evKeyOrNull;
    }).map(function (k) {
      var cfg = cfgVal[k] || {};
      return { key: k, label: turmasVal[k].label || k.toUpperCase(), encerrada: !!(cfg.encerrada) };
    }).filter(function (t) { return !t.encerrada; });

    var optsHtml = '<option value="">Selecione a turma…</option>' +
      turmaOpts.map(function (t) { return '<option value="' + esc(t.key) + '">' + esc(t.label) + '</option>'; }).join('');
    var semTurmas = !turmaOpts.length;

    var wrap = document.createElement('div');
    wrap.className = 'table-scroll-wrap';
    var table = document.createElement('table');
    table.className = 'admin-table';
    table.innerHTML =
      '<thead><tr>' +
        '<th>Nome</th><th>E-mail</th><th>Área</th><th>Data interesse</th><th>Data remoção</th><th>Origem</th><th>Ações</th>' +
      '</tr></thead>';
    var tbody = document.createElement('tbody');

    list.forEach(function (p) {
      var tr = document.createElement('tr');
      /* A data vinha crua do banco ("2026-08-10"), sem hora e fora do
         formato brasileiro usado no resto do painel. A hora está
         gravada junto desde sempre — só não era exibida. */
      var dataFmt = fmtDate(p.date);
      /* A data da saída da turma ganhou coluna própria, ao lado da data
         do interesse. Antes ficava dentro da célula de Origem, misturada
         com o nome da turma e o motivo — dava para ler uma linha, não
         para varrer a coluna e comparar quem espera há mais tempo. Quem
         entrou direto pelo card do site não saiu de turma nenhuma, então
         não tem data de remoção. */
      var veioDeTurma = p._origem && !window.faTurmasUtil.ehOrigemDireta(p._origem);
      var remocaoFmt = veioDeTurma ? fmtDate(p.migratedAt) : '—';
      /* Quem veio de uma turma tem migratedFrom gravado na migração —
         mostra de qual turma saiu, em vez de deixar o dado invisível
         no banco. */
      var origem = '<span style="color:var(--ink-3)">Entrou pela lista</span>';
      if (veioDeTurma) {
        var tLabel = (turmasVal[p._origem] && turmasVal[p._origem].label) || p._origem.toUpperCase();
        var motivoTxt = p.motivoEntradaDetalhe || motivoEsperaLabel(p.motivoEntrada);
        origem = '<span class="espera-origem">↩ ' + esc(tLabel) + '</span>' +
          (motivoTxt ? '<span class="espera-origem-motivo">' + esc(motivoTxt) + '</span>' : '');
      }
      tr.innerHTML =
        '<td>' + esc(p.name || '—') + '</td>' +
        '<td>' + esc(p.email || '—') + '</td>' +
        '<td>' + esc(p.area || '—') + '</td>' +
        '<td>' + dataFmt + '</td>' +
        '<td>' + remocaoFmt + '</td>' +
        '<td>' + origem + '</td>' +
        '<td></td>';

      var tdAcoes = tr.querySelector('td:last-child');
      tdAcoes.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap';

      /* Select turma */
      if (semTurmas) {
        tdAcoes.insertAdjacentHTML('beforeend', '<span style="font-size:.75rem;color:var(--ink-3)">Sem turmas abertas</span>');
      } else {
        var sel = document.createElement('select');
        sel.className = 'admin-status-btn';
        sel.style.cssText = 'padding:5px 8px;font-size:.75rem;background:var(--panel-2);border:1px solid var(--line-strong);border-radius:6px;color:var(--ink);cursor:pointer';
        sel.innerHTML = optsHtml;
        tdAcoes.appendChild(sel);

        var moverBtn = document.createElement('button');
        moverBtn.className = 'btn btn--sm btn--primary';
        moverBtn.style.cssText = 'padding:5px 10px;font-size:.75rem';
        moverBtn.textContent = 'Mover para turma';
        moverBtn.addEventListener('click', (function (person, selectEl) {
          return function () {
            var turmaKey = selectEl.value;
            if (!turmaKey) { adminAlert('Selecione uma turma primeiro.'); return; }
            var turmaLabelSel = selectEl.options[selectEl.selectedIndex].text;
            adminConfirm(
              'Mover ' + person.name + ' para a turma ' + turmaLabelSel + ' como Inscrita?',
              function () { moverParaTurma(person, turmaKey); }
            );
          };
        })(p, sel));
        tdAcoes.appendChild(moverBtn);
      }

      /* Remover da lista */
      var remBtn = document.createElement('button');
      remBtn.className = 'btn btn--sm';
      remBtn.style.cssText = 'padding:5px 10px;font-size:.75rem';
      remBtn.textContent = 'Remover da lista';
      remBtn.addEventListener('click', (function (person) {
        return function () {
          var sessRem = window.faAuth && window.faAuth.getSession();
          var registrosPessoa = window.faTurmasUtil.esperaAtivas(dataEv[person._key]).length;
          adminConfirmComMotivo(
            'Remover ' + person.name + ' da lista de espera?' +
              (registrosPessoa > 1
                ? '\n\nEla tem ' + registrosPessoa +
                  ' registros na fila deste evento, um por turma de origem — e sai de todos eles.'
                : ''),
            MOTIVOS_ESPERA_SAIDA,
            function (motivo, detalhe, turmaEscolhida) {
              var agora = new Date().toISOString();
              /* Tirar da fila é sobre a pessoa NESTE evento — não sobre a
                 linha, mas também não sobre TODOS os eventos: se ela também
                 espera por outro evento, essa espera não é tocada aqui. */
              firebase.database().ref('fa-espera/' + person._key).once('value', function (snapF) {
                var updates = {};
                window.faTurmasUtil.esperaAtivas(snapF.val()).forEach(function (e) {
                  var pertence = evKeyOrNull === null ? !e.eventoKey : e.eventoKey === evKeyOrNull;
                  if (!pertence) return;
                  var b = 'fa-espera/' + person._key + '/' + e._origem + '/';
                  updates[b + 'removed']            = true;
                  updates[b + 'removedDate']        = agora;
                  updates[b + 'motivoSaida']        = motivo;
                  updates[b + 'motivoSaidaDetalhe'] = detalhe || null;
                  updates[b + 'removedByName']      = sessRem ? (sessRem.name || sessRem.email) : null;
                  if (turmaEscolhida && turmaEscolhida.jaFeita) {
                    updates[b + 'jaParticipouTurma']      = turmaEscolhida.key;
                    updates[b + 'jaParticipouTurmaLabel'] = turmaEscolhida.label;
                  }
                });
                firebase.database().ref().update(updates, function (err) {
                  if (err) { adminAlert('Erro ao remover. Tente novamente.'); return; }
                  loadEspera();
                });
              });
            },
            null,
            /* A chave da fila é a mesma chave de e-mail usada nas turmas,
               então dá para sugerir a turma que ela já fez. A sugestão
               depende da aba Eventos ter carregado; sem isso a lista
               aparece igual, só sem nada pré-escolhido. */
            ondeJaParticipou(person._key, '')
          );
        };
      })(p));
      tdAcoes.appendChild(remBtn);

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    box.appendChild(wrap);
    box.appendChild(saidosDaFila(dataEv, turmasVal));
    return box;
  }

  /* Quem saiu da fila. A lista mostra só quem está esperando agora, então
     não havia como responder "e a fulana, que estava aqui?" — nem conferir
     se alguém saiu por engano. Sair da fila nunca apaga nada: o registro
     continua no banco marcado como removido, e é isso que esta seção lê.
     Mesma ideia do filtro "Removidos" que as turmas já têm. */
  function saidosDaFila(dataEspera, turmasVal) {
    var U = window.faTurmasUtil;
    var box = document.createElement('div');

    var saidos = [];
    Object.keys(dataEspera).forEach(function (eKey) {
      U.esperaEntradas(dataEspera[eKey]).forEach(function (e) {
        if (e.removed) { e._key = eKey; saidos.push(e); }
      });
    });
    if (!saidos.length) return box;
    saidos.sort(function (a, b) { return String(b.removedDate || '').localeCompare(String(a.removedDate || '')); });

    var nomeTurma = function (tk) { return (turmasVal[tk] && turmasVal[tk].label) || tk; };
    var linhas = saidos.map(function (p) {
      var veioDeTurma = p._origem && !U.ehOrigemDireta(p._origem);
      var origem = veioDeTurma
        ? '<span class="espera-origem">↩ ' + esc(nomeTurma(p._origem)) + '</span>'
        : '<span class="espera-origem-card">Entrou pela lista</span>';
      var destino = p.movedToTurma
        ? '<span class="destino-badge destino-turma">' + esc(nomeTurma(p.movedToTurma)) + '</span>'
        : '<span class="destino-badge destino-saiu">Saiu da fila</span>';
      var motivo = p.motivoSaidaDetalhe || (p.motivoSaida ? motivoEsperaLabel(p.motivoSaida) : '') ||
        (p.movedToTurma ? 'Movida para turma' : '<span class="removido-sem-motivo">motivo não registrado</span>');
      /* Só se afirma o que está gravado: o nome de quem tirou (saída pelo
         painel) ou a marca de saída pelo site. Sem nenhum dos dois, nada é
         dito — mesma regra da tabela de quem saiu das turmas. */
      var quem = p.removedByName ? 'por ' + p.removedByName
        : p.removedBySelf        ? 'pela própria pessoa'
        : '';
      quem = quem ? '<span class="removido-por">' + esc(quem) + '</span>' : '';
      /* Sair da fila é reversível e fica no histórico; isto aqui não. Só
         aparece em quem já saiu, então excluir de vez exige duas decisões
         separadas — mesma regra da exclusão de registro nas turmas. */
      var excluir = '<button class="registro-del-btn" data-ekey="' + p._key +
        '" data-origem="' + esc(p._origem) + '" data-name="' + esc(p.name || p.email) + '">&#x1F5D1; excluir registro</button>';
      return '<tr><td>' + esc(p.name || '—') + '</td><td>' + esc(p.email || '—') + '</td><td>' +
        esc(p.area || '—') + '</td><td>' + fmtDate(p.date) + '</td><td>' + origem + '</td><td>' +
        fmtDate(p.removedDate) + '</td><td>' + destino + '</td><td>' + motivo + quem + excluir + '</td></tr>';
    }).join('');

    box.innerHTML =
      '<details class="espera-saidos"><summary>Saíram da fila (' + saidos.length + ')</summary>' +
      '<div class="table-scroll-wrap"><table class="admin-table"><thead><tr>' +
      '<th>Nome</th><th>E-mail</th><th>Área</th><th>Data interesse</th><th>Origem</th>' +
      '<th>Saiu em</th><th>Destino</th><th>Motivo</th>' +
      '</tr></thead><tbody>' + linhas + '</tbody></table></div></details>';

    box.addEventListener('click', function (e) {
      var b = e.target.closest('.registro-del-btn');
      if (b) excluirRegistroDaFila(b.dataset.ekey, b.dataset.origem, b.dataset.name);
    });
    return box;
  }

  /* Apaga de vez um registro da fila. Existe para o que nunca foi uma espera
     de verdade — teste e duplicado. Sair da fila só marca como removido, e o
     registro continua aparecendo em "Saíram da fila" para sempre; um teste
     não deveria ocupar essa lista. Some só a entrada daquela origem: o
     cadastro da pessoa e os registros dela nas turmas não são tocados. */
  function excluirRegistroDaFila(eKey, origem, nome) {
    adminConfirm(
      'Excluir definitivamente o registro de ' + nome + ' na lista de espera?\n\n' +
      'Não é o mesmo que remover da fila: ele some de "Saíram da fila" e do banco, sem deixar histórico.\n\n' +
      'Use para registro de teste ou duplicado. Essa ação não pode ser desfeita.',
      function () {
        /* Registro antigo, anterior à separação por origem, mora na raiz do
           nó da pessoa — nesse caso é o nó inteiro que sai. */
        firebase.database().ref('fa-espera/' + eKey).once('value', function (snap) {
          var v = snap.val();
          var alvo = (v && v.email) ? ('fa-espera/' + eKey) : ('fa-espera/' + eKey + '/' + origem);
          firebase.database().ref(alvo).remove(function (err) {
            if (err) { adminAlert('Erro ao excluir. Tente novamente.'); return; }
            loadEspera();
          });
        });
      });
  }

  /* ── Conferência da fila ────────────────────────────────────────────────
     Dois números que nunca fecham por construção: fa-espera guarda uma
     entrada POR PESSOA, e cada turma registra uma saída POR TURMA. Quem foi
     mandada para a fila a partir de duas turmas conta duas vezes lá e uma
     aqui.

     Só que parte dessa diferença é perda de verdade: mandar alguém para a
     fila grava o registro inteiro por cima do anterior, então a segunda
     migração apaga a turma de origem, o motivo e — o que mais dói — a DATA
     do primeiro interesse, que é justamente o que define a ordem de chegada.
     Este bloco mede isso antes de qualquer conserto: separa o que é
     diferença esperada do que é registro engolido. */
  function resumoEspera(dataEspera, interesse, turmasVal) {
    var box = document.createElement('div');
    box.className = 'espera-resumo';
    var U = window.faTurmasUtil;

    /* Linhas ativas na fila (uma por pessoa E origem) e quantas cabeças são. */
    var linhas = [], pessoasNaFila = {};
    Object.keys(dataEspera).forEach(function (eKey) {
      U.esperaAtivas(dataEspera[eKey]).forEach(function (e) {
        e._key = eKey; linhas.push(e); pessoasNaFila[eKey] = true;
      });
    });
    /* Conta TODAS as entradas pelo card, inclusive as que já saíram: a
       pergunta "alguém entrou direto pela lista?" não se responde olhando só
       quem continua esperando. */
    var diretasTotal = 0;
    Object.keys(dataEspera).forEach(function (eKey) {
      U.esperaEntradas(dataEspera[eKey]).forEach(function (e) {
        if (U.ehOrigemDireta(e._origem)) diretasTotal++;
      });
    });

    /* Uma saída por pessoa E por turma — é o que os filtros das turmas somam. */
    var saidas = [];
    Object.keys(interesse).forEach(function (tk) {
      Object.keys(interesse[tk] || {}).forEach(function (k) {
        var r = interesse[tk][k];
        if (r && r.removed && r.movedToEspera) {
          saidas.push({ eKey: k, turma: tk, nome: r.name || k, desde: r.date, quando: r.removedDate });
        }
      });
    });
    var pessoasSaidas = {};
    saidas.forEach(function (x) { pessoasSaidas[x.eKey] = true; });

    function entradaDa(eKey, turma) {
      var todas = U.esperaEntradas(dataEspera[eKey]);
      for (var i = 0; i < todas.length; i++) if (todas[i]._origem === turma) return todas[i];
      return null;
    }

    var naFila = [], saiuDaFila = [], foiParaTurma = [], engolidas = [], semRastro = [];
    saidas.forEach(function (x) {
      var e = entradaDa(x.eKey, x.turma);
      if (!e) {
        (U.esperaEntradas(dataEspera[x.eKey]).length ? engolidas : semRastro).push(x);
        return;
      }
      if (e.movedToTurma) { foiParaTurma.push(x); return; }
      if (e.removed)      { saiuDaFila.push(x);   return; }
      naFila.push(x);
    });

    var nomeTurma = function (tk) { return (turmasVal[tk] && turmasVal[tk].label) || tk; };
    var item = function (rot, n, cls) {
      return '<span class="espera-resumo-item' + (cls ? ' ' + cls : '') + '"><strong>' + n + '</strong> ' + esc(rot) + '</span>';
    };

    var html = '<div class="espera-resumo-titulo">Conferência da fila</div><div class="espera-resumo-linha">' +
      item('pessoas na fila', Object.keys(pessoasNaFila).length) +
      item('registros na fila (um por turma de origem)', linhas.length) +
      item('saídas para a espera registradas nas turmas', saidas.length) +
      item('pessoas distintas nessas saídas', Object.keys(pessoasSaidas).length) +
      '</div>';

    html += '<div class="espera-resumo-linha">' +
      item('com registro próprio na fila', naFila.length) +
      item('já foram da fila para uma turma', foiParaTurma.length) +
      item('foram removidas da fila', saiuDaFila.length) +
      item('registros vindos do card do site', diretasTotal) +
      /* "Sem rastro" é o único que continua sendo alarme: se aparecer, é
         coisa nova e inexplicada. Vermelho só quando houver. */
      item('sem rastro na fila', semRastro.length, semRastro.length ? 'ruim' : '') +
      '</div>';

    /* As saídas engolidas são de antes da separação por origem — número
       fechado, que não cresce mais. Ficavam em vermelho na linha principal e
       pareciam alarme pendente todo dia; viraram nota de rodapé, que é o que
       são: história registrada, não pendência. */
    if (engolidas.length) {
      html += '<p class="espera-resumo-nota">' + engolidas.length + ' saída' + (engolidas.length !== 1 ? 's' : '') +
        ' de antes da separação por turma não tem registro próprio na fila: naquela época uma segunda migração' +
        ' escrevia por cima da primeira. É um número fechado — a estrutura atual não produz mais nenhum.</p>';
    }

    var problemas = engolidas.concat(semRastro);
    if (problemas.length) {
      html += '<details class="espera-resumo-det"><summary>Ver quais são</summary><ul>';
      problemas.sort(function (a, b) { return (a.nome || '').localeCompare(b.nome || '', 'pt-BR'); })
        .forEach(function (x) {
          html += '<li>' + esc(x.nome) + ' — saiu da <strong>' + esc(nomeTurma(x.turma)) + '</strong> em ' + fmtDate(x.quando) +
            ', com interesse desde ' + fmtDate(x.desde) + '.</li>';
        });
      html += '</ul></details>';
    } else {
      html += '<p class="espera-resumo-nota">Toda saída para a espera tem o seu registro na fila.</p>';
    }

    box.innerHTML = html;
    return box;
  }

  function migrarParaEspera(turmaKey, eKey, person, motivo, detalhe, subst) {
    var sess = window.faAuth && window.faAuth.getSession();
    var now  = new Date().toISOString();
    var alvo = 'fa-espera/' + eKey + '/' + turmaKey;
    /* Lê o que já existe NESTA origem antes de gravar: sair da mesma turma
       duas vezes tem que continuar sendo um registro só, e com a data mais
       antiga das duas. Sem isso a pessoa perderia lugar na fila por um
       segundo clique. */
    firebase.database().ref(alvo).once('value', function (snapAtual) {
      migrarParaEsperaGravar(turmaKey, eKey, person, motivo, detalhe, subst, sess, now, alvo, snapAtual.val());
    });
  }

  function migrarParaEsperaGravar(turmaKey, eKey, person, motivo, detalhe, subst, sess, now, alvo, atual) {
    var updates = {};
    /* Remove da turma (soft-delete) */
    updates['turmas-interesse/' + turmaKey + '/' + eKey + '/removed']            = true;
    updates['turmas-interesse/' + turmaKey + '/' + eKey + '/removedDate']        = now;
    updates['turmas-interesse/' + turmaKey + '/' + eKey + '/removedReason']      = 'Movida para lista de espera — ' + (detalhe || motivoEsperaLabel(motivo));
    updates['turmas-interesse/' + turmaKey + '/' + eKey + '/movedToEspera']      = true;
    updates['turmas-interesse/' + turmaKey + '/' + eKey + '/removedMotivo']      = motivo || null;
    if (subst) {
      updates['turmas-interesse/' + turmaKey + '/' + eKey + '/substituidaPor']      = subst.email || null;
      updates['turmas-interesse/' + turmaKey + '/' + eKey + '/substituidaPorNome']  = subst.name  || null;
      updates['turmas-interesse/' + turmaKey + '/' + eKey + '/substituidaEm']       = now;
      updates['turmas-interesse/' + turmaKey + '/' + eKey + '/substituidaPorAdmin'] = sess ? (sess.name || sess.email) : null;
    }
    updates['turmas-interesse/' + turmaKey + '/' + eKey + '/removedByAdmin']     = sess ? sess.email : null;
    updates['turmas-interesse/' + turmaKey + '/' + eKey + '/removedByAdminName'] = sess ? (sess.name || sess.email) : null;
    /* Entra na fila sob a ORIGEM, preservando a data original de interesse —
       e, se já houver registro desta mesma turma, fica a mais antiga. */
    var dataFila = person.date;
    if (atual && atual.date && (!dataFila || atual.date < dataFila)) dataFila = atual.date;
    updates[alvo] = {
      name: person.name, email: person.email, area: person.area || '',
      date: dataFila,             /* data original — não a data de migração */
      migratedAt: (atual && atual.migratedAt) || now,
      migratedFrom: turmaKey,
      /* A fila é do evento da turma de origem — sem isso, a pessoa some da
         Lista de Espera desse evento e não dá pra oferecer "mover para
         turma" só dentro do mesmo evento que ela realmente está esperando. */
      eventoKey: turmaEventoKey(turmaKey) || null,
      motivoEntrada: motivo || null,
      motivoEntradaDetalhe: detalhe || null,
      migratedByName: sess ? (sess.name || sess.email) : null,
      removed: false
    };
    firebase.database().ref().update(updates, function (err) {
      if (err) { adminAlert('Erro ao migrar. Tente novamente.'); return; }
      loadInterests();
    });
  }

  function moverParaTurma(person, turmaKey) {
    var sess = window.faAuth && window.faAuth.getSession();
    var eKey = emailKeyFromEmail(person.email);
    var now  = new Date().toISOString();
    var destEventoKey = turmaEventoKey(turmaKey);
    var updates = {};
    updates['turmas-interesse/' + turmaKey + '/' + eKey] = {
      name: person.name, email: person.email, area: person.area || '',
      date: now, removed: false, status: 'inscrito',
      confirmedByAdmin: sess ? sess.email : null,
      confirmedByAdminName: sess ? (sess.name || sess.email) : null,
      confirmedDate: now,
      fromEspera: true
    };
    /* Inscrita numa turma, ela não está mais esperando por ESTE evento —
       sai de todas as origens desse evento (e das órfãs, sem evento
       definido, já que arranjar vaga resolve a ambiguidade). Se ela também
       espera por outro evento, essa espera continua — são coisas diferentes. */
    firebase.database().ref('fa-espera/' + eKey).once('value', function (snapF) {
      window.faTurmasUtil.esperaAtivas(snapF.val()).forEach(function (e) {
        if (e.eventoKey && e.eventoKey !== destEventoKey) return;
        var b = 'fa-espera/' + eKey + '/' + e._origem + '/';
        updates[b + 'removed']      = true;
        updates[b + 'removedDate']  = now;
        updates[b + 'movedToTurma'] = turmaKey;
      });
      firebase.database().ref().update(updates, function (err) {
        if (err) { adminAlert('Erro ao mover. Tente novamente.'); return; }
        loadInterests();
      });
    });
  }

  /* ---- Treinamentos ------------------------------------------------------
     Um treinamento pertence a UM OU MAIS eventos, e quem está inscrita numa
     turma de qualquer um desses eventos tem acesso a ele. Antes o Treinamento
     era uma página só, liberada para qualquer pessoa "enrolled" — o que
     funcionava por acidente, enquanto existia um treinamento só: no dia em que
     existisse um segundo, quem fez o evento A veria o treinamento do evento B.

     O registro guarda nome e a quais eventos pertence; o conteúdo (afirmações
     e patentes) vem do catálogo em game-data.js pela chave conteudoKey. */
  var TREINAMENTOS_LIST = [];

  function conteudosDisponiveis() {
    var cat = window.faGameConteudos || {};
    return Object.keys(cat).map(function (k) {
      return { key: k, nome: (cat[k] && cat[k].NOME) || k };
    });
  }

  function loadTreinamentosList(cb) {
    firebase.database().ref('treinamentos').once('value', function (snap) {
      var val = snap.val() || {};
      TREINAMENTOS_LIST = Object.keys(val).map(function (key) {
        var t = val[key] || {};
        return {
          key: key, nome: t.nome || key, conteudoKey: t.conteudoKey || '',
          eventos: t.eventos || {}, order: t.order || 0
        };
      }).sort(function (a, b) { return a.order - b.order; });
      cb();
    });
  }

  /* O treinamento existente nunca esteve no banco: era a página aberta a
     qualquer pessoa inscrita. Sem esta migração, o deploy tiraria o acesso de
     todo mundo de uma vez. Ela cria o registro já ligado a TODOS os eventos
     que existem hoje — preservando exatamente quem enxerga o treinamento
     agora. Evento criado depois não entra sozinho: é justamente a decisão que
     passa a ser sua. Roda uma vez; havendo qualquer treinamento, não faz nada. */
  function seedTreinamentoPadrao(cb) {
    firebase.database().ref('treinamentos').once('value', function (snap) {
      if (snap.exists() && Object.keys(snap.val() || {}).length) { cb && cb(); return; }
      firebase.database().ref('eventos').once('value', function (evSnap) {
        var eventos = {};
        Object.keys(evSnap.val() || {}).forEach(function (k) { eventos[k] = true; });
        var cat = conteudosDisponiveis()[0];
        firebase.database().ref('treinamentos').push().set({
          nome: (cat && cat.nome) || 'Treinamento',
          conteudoKey: (cat && cat.key) || '',
          eventos: eventos,
          order: Date.now(),
          createdAt: new Date().toISOString()
        }, function () { cb && cb(); });
      });
    });
  }

  function loadTreinamentos() {
    var c = document.getElementById('adminTreinamentos');
    if (!c) return;
    loadEventosList(function () {
      loadTreinamentosList(function () { renderTreinamentos(c); });
    });
  }

  function renderTreinamentos(c) {
    c.innerHTML = '';

    var btnWrap = document.createElement('div');
    btnWrap.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px';
    var novoBtn = document.createElement('button');
    novoBtn.className = 'btn btn--sm btn--primary';
    novoBtn.innerHTML = '+ Novo treinamento';
    novoBtn.addEventListener('click', function () { openTreinamentoFormModal(null); });
    btnWrap.appendChild(novoBtn);
    c.appendChild(btnWrap);

    var intro = document.createElement('p');
    intro.className = 'admin-empty';
    intro.style.marginBottom = '18px';
    intro.textContent = 'Cada treinamento pertence a um ou mais eventos. Quem está inscrita numa turma de qualquer um desses eventos passa a ver esse treinamento — e só ele.';
    c.appendChild(intro);

    if (!TREINAMENTOS_LIST.length) {
      c.insertAdjacentHTML('beforeend', '<p class="admin-empty">Nenhum treinamento cadastrado. Clique em "+ Novo treinamento" para criar.</p>');
      return;
    }

    TREINAMENTOS_LIST.forEach(function (t) {
      var evKeys = Object.keys(t.eventos || {}).filter(function (k) { return t.eventos[k]; });
      var card = document.createElement('div');
      card.style.cssText = 'border:1px solid var(--line-strong);border-radius:8px;margin-bottom:14px;padding:16px 18px';

      var chips = evKeys.length
        ? evKeys.map(function (k) {
            return '<span class="destino-badge destino-turma">' + esc(eventoLabel(k)) + '</span>';
          }).join(' ')
        : '<span class="removido-sem-motivo">nenhum evento associado — ninguém vê este treinamento</span>';

      var conteudo = conteudosDisponiveis().filter(function (x) { return x.key === t.conteudoKey; })[0];

      card.innerHTML =
        '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px">' +
          '<span style="flex:1;min-width:180px;font-family:var(--font-head);letter-spacing:.05em;color:var(--ink)">' + esc(t.nome) + '</span>' +
        '</div>' +
        '<div style="font-size:.8rem;color:var(--ink-2);margin-bottom:8px">Conteúdo: ' +
          (conteudo ? esc(conteudo.nome) : '<span class="removido-sem-motivo">conteúdo "' + esc(t.conteudoKey) + '" não existe no catálogo</span>') +
        '</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">' + chips + '</div>';

      var acoes = document.createElement('div');
      acoes.style.cssText = 'display:flex;gap:8px;margin-top:14px;flex-wrap:wrap';
      var editBtn = document.createElement('button');
      editBtn.className = 'btn btn--sm';
      editBtn.style.cssText = 'padding:4px 10px;font-size:.72rem';
      editBtn.innerHTML = '&#x270E; Editar';
      editBtn.addEventListener('click', function () { openTreinamentoFormModal(t); });
      var delBtn = document.createElement('button');
      delBtn.className = 'btn btn--sm';
      delBtn.style.cssText = 'padding:4px 10px;font-size:.72rem;border-color:rgba(255,80,80,.5);color:#ff8080';
      delBtn.textContent = '🗑 Excluir';
      delBtn.addEventListener('click', function () { excluirTreinamento(t); });
      acoes.appendChild(editBtn);
      acoes.appendChild(delBtn);
      card.appendChild(acoes);
      c.appendChild(card);
    });
  }

  function openTreinamentoFormModal(existing) {
    var isEdit = !!existing;
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9999';

    var box = document.createElement('div');
    box.className = 'modal-box';
    box.style.cssText = 'max-width:480px;width:90%;padding:28px;display:flex;flex-direction:column;gap:16px;max-height:85vh;overflow:auto';

    var conteudoOpts = conteudosDisponiveis().map(function (x) {
      return '<option value="' + esc(x.key) + '">' + esc(x.nome) + '</option>';
    }).join('');

    var eventosHtml = EVENTOS_LIST.length
      ? EVENTOS_LIST.map(function (ev) {
          return '<label style="display:flex;align-items:center;gap:8px;font-size:.85rem;color:var(--ink-2);cursor:pointer">' +
            '<input type="checkbox" class="treino-ev" value="' + esc(ev.key) + '" style="cursor:pointer" />' +
            '<span>' + esc(ev.nome) + '</span></label>';
        }).join('')
      : '<p class="admin-empty" style="margin:0">Nenhum evento cadastrado ainda. Crie um evento na aba Eventos primeiro.</p>';

    box.innerHTML =
      '<h3 style="font-size:1.1rem;font-family:var(--font-head);letter-spacing:.05em;color:var(--ink)">' + (isEdit ? 'Editar Treinamento' : 'Novo Treinamento') + '</h3>' +
      '<label class="auth-label">Nome do treinamento<input type="text" id="treinoFormNome" placeholder="Ex: Treinamento Jedi" autocomplete="off" /></label>' +
      '<label class="auth-label">Conteúdo<select id="treinoFormConteudo" style="padding:8px 10px;background:var(--panel-2);border:1px solid var(--line-strong);border-radius:6px;color:var(--ink);font-family:var(--font-body);width:100%">' + conteudoOpts + '</select></label>' +
      '<p style="font-size:.76rem;color:var(--ink-3);margin:-8px 0 0">O conteúdo (afirmações e patentes) vem do código. Um treinamento com conteúdo novo precisa de um conjunto novo cadastrado lá.</p>' +
      '<div>' +
        '<span class="auth-label" style="display:block;margin-bottom:8px">Eventos com acesso a este treinamento</span>' +
        '<div style="display:flex;flex-direction:column;gap:8px">' + eventosHtml + '</div>' +
        '<p style="font-size:.76rem;color:var(--ink-3);margin:8px 0 0">Quem está inscrita numa turma de um evento marcado vê este treinamento. Sem nenhum marcado, ninguém vê.</p>' +
      '</div>' +
      '<p id="treinoFormErr" style="color:var(--red,#ff3b30);font-size:.85rem;display:none"></p>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:4px">' +
        '<button class="btn admin-modal-cancel-btn">Cancelar</button>' +
        '<button class="btn btn--primary admin-modal-save-btn">' + (isEdit ? 'Salvar' : 'Criar treinamento') + '</button>' +
      '</div>';

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    var nomeInput     = box.querySelector('#treinoFormNome');
    var conteudoSel   = box.querySelector('#treinoFormConteudo');
    var errEl         = box.querySelector('#treinoFormErr');

    nomeInput.value = isEdit ? existing.nome : '';
    if (isEdit && existing.conteudoKey) conteudoSel.value = existing.conteudoKey;
    if (isEdit) {
      box.querySelectorAll('.treino-ev').forEach(function (cb) {
        cb.checked = !!(existing.eventos || {})[cb.value];
      });
    }

    function closeModal() { document.body.removeChild(overlay); }
    box.querySelector('.admin-modal-cancel-btn').addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });

    box.querySelector('.admin-modal-save-btn').addEventListener('click', function () {
      var nome = (nomeInput.value || '').trim();
      errEl.style.display = 'none';
      if (!nome) { errEl.textContent = 'Dê um nome ao treinamento.'; errEl.style.display = ''; return; }

      var eventos = {};
      box.querySelectorAll('.treino-ev').forEach(function (cb) { if (cb.checked) eventos[cb.value] = true; });

      var data = { nome: nome, conteudoKey: conteudoSel.value || '', eventos: eventos };
      var ref = isEdit
        ? firebase.database().ref('treinamentos/' + existing.key)
        : firebase.database().ref('treinamentos').push();
      if (!isEdit) { data.order = Date.now(); data.createdAt = new Date().toISOString(); }

      (isEdit ? ref.update(data, done) : ref.set(data, done));
      function done(err) {
        if (err) { errEl.textContent = 'Erro ao salvar. Tente novamente.'; errEl.style.display = ''; return; }
        closeModal();
        loadTreinamentos();
      }
    });
  }

  function excluirTreinamento(t) {
    adminConfirm(
      'Excluir o treinamento "' + t.nome + '"?\n\n' +
      'Quem tem acesso a ele pelos eventos associados deixa de vê-lo. O conteúdo em si não é apagado (ele vive no código) e o progresso de quem já respondeu continua guardado.\n\n' +
      'Essa ação não pode ser desfeita.',
      function () {
        firebase.database().ref('treinamentos/' + t.key).remove(function (err) {
          if (err) { adminAlert('Erro ao excluir. Tente novamente.'); return; }
          loadTreinamentos();
        });
      });
  }

  /* ---- Cadastrados (todos que fizeram cadastro) ---- */
  function loadCadastrados() {
    const c = document.getElementById('adminCadastrados');
    if (!c) return;
    c.innerHTML = '<p class="loading-msg">Carregando…</p>';

    firebase.database().ref('fa-users').once('value').then(function (snap) {
      renderCadastrados(c, snap.val() || {});
    });
  }

  function renderCadastrados(c, data) {
    const list = Object.entries(data)
      .map(function (entry) { return Object.assign({ _key: entry[0] }, entry[1]); })
      .sort(function (a, b) { return (a.name || '').localeCompare(b.name || '', 'pt'); });
    c.innerHTML = '';

    const hdr = document.createElement('h4');
    hdr.innerHTML = 'Cadastrados <span class="admin-badge" id="cadastradosBadge">' + list.length + '</span>';
    c.appendChild(hdr);

    /* ---- Criar conta pelo admin ---- */
    const criarBox = document.createElement('div');
    criarBox.className = 'admin-criar-conta-box';
    criarBox.innerHTML =
      '<details class="admin-details">' +
      '<summary>+ Criar conta para colaboradora</summary>' +
      '<div class="admin-criar-conta-form">' +
      '<p style="font-size:.8rem;color:var(--text-muted);margin-bottom:12px">A conta é criada com senha padrão <strong>12345678</strong>. A pessoa deve trocar pelo "Esqueci minha senha".</p>' +
      '<div class="admin-field-row">' +
      '<label class="admin-field-label">Nome completo<input type="text" id="criarNome" placeholder="Nome completo" /></label>' +
      '<label class="admin-field-label">E-mail @previ.com.br<input type="email" id="criarEmail" placeholder="nome@previ.com.br" /></label>' +
      '<label class="admin-field-label">Área / Setor<input type="text" id="criarArea" placeholder="Ex: GETHO" /></label>' +
      '<label class="admin-field-label">Sua senha (confirmação)<input type="password" id="criarAdminPwd" placeholder="Sua senha de admin" /></label>' +
      '</div>' +
      '<p class="admin-msg" id="criarMsg" style="margin-top:8px" hidden></p>' +
      '<button type="button" class="btn btn--sm" id="criarContaBtn">Criar conta</button>' +
      '</div>' +
      '</details>';
    c.appendChild(criarBox);

    document.getElementById('criarContaBtn').addEventListener('click', function () {
      const btn  = this;
      const msg  = document.getElementById('criarMsg');
      msg.hidden = true; msg.style.color = '';
      btn.disabled = true; btn.textContent = 'Aguarde…';
      window.faAuth.criarContaPorAdmin(
        {
          name:  document.getElementById('criarNome').value,
          email: document.getElementById('criarEmail').value,
          area:  document.getElementById('criarArea').value
        },
        document.getElementById('criarAdminPwd').value,
        function (r) {
          btn.disabled = false; btn.textContent = 'Criar conta';
          if (r.error) {
            msg.textContent = r.error; msg.style.color = 'var(--danger, #f87171)'; msg.hidden = false;
          } else {
            msg.textContent = 'Conta criada com sucesso! Senha padrão: 12345678'; msg.style.color = 'var(--accent)'; msg.hidden = false;
            document.getElementById('criarNome').value = '';
            document.getElementById('criarEmail').value = '';
            document.getElementById('criarArea').value = '';
            document.getElementById('criarAdminPwd').value = '';
            loadCadastrados();
          }
        }
      );
    });

    /* ---- Filtros de status + busca ---- */
    var statusFiltro = 'ativos';
    const controlsWrap = document.createElement('div');
    controlsWrap.className = 'admin-colab-row';
    controlsWrap.style.cssText = 'margin-bottom:12px;gap:8px;flex-wrap:wrap;align-items:center;';
    controlsWrap.innerHTML =
      '<div class="admin-status-btns">' +
      '<button class="admin-status-btn active" data-status="ativos">Ativos</button>' +
      '<button class="admin-status-btn" data-status="bloqueados">Bloqueados</button>' +
      '<button class="admin-status-btn" data-status="todos">Todos</button>' +
      '</div>' +
      '<input id="cadastradosFiltro" type="text" placeholder="Filtrar por nome ou e-mail…" style="flex:1;min-width:180px" />';
    c.appendChild(controlsWrap);

    const tbl = document.createElement('table');
    tbl.className = 'admin-table';
    tbl.innerHTML = '<thead><tr><th>Nome</th><th>E-mail</th><th>Área</th><th>Cadastro</th><th>Status</th><th>E-mail</th><th></th><th></th><th></th></tr></thead>';
    const tbody = document.createElement('tbody');

    function applyFilters() {
      const q = (document.getElementById('cadastradosFiltro').value || '').trim().toLowerCase();
      var filtered = list.filter(function (p) {
        var bloqueado = !!p.blocked;
        if (statusFiltro === 'ativos'     && bloqueado)  return false;
        if (statusFiltro === 'bloqueados' && !bloqueado) return false;
        if (!q) return true;
        return (p.name || '').toLowerCase().indexOf(q) !== -1 || (p.email || '').toLowerCase().indexOf(q) !== -1;
      });
      tbody.innerHTML = '';
      var badgeEl = document.getElementById('cadastradosBadge');
      if (badgeEl) badgeEl.textContent = filtered.length;
      filtered.forEach(function (p) {
        var bloqueado = !!p.blocked;
        var precisaVerificacao = !!(p.emailVerificationRequired && !p.adminApproved);
        var emailBadge = precisaVerificacao
          ? '<span class="admin-badge" style="background:rgba(245,197,66,.18);color:var(--accent)" title="Cadastro próprio — e-mail ainda não verificado">Pendente</span>'
          : '<span class="admin-badge" style="background:rgba(26,178,174,.18);color:var(--cyan)">Verificado</span>';
        var confirmBtn = precisaVerificacao
          ? '<td><button class="admin-del-btn admin-confirm-email-btn" data-key="' + esc(p._key) + '" data-name="' + esc(p.name || p.email) + '" title="Confirmar cadastro manualmente — libera o acesso sem precisar clicar no link de e-mail">Confirmar</button></td>'
          : '<td></td>';
        var tr = document.createElement('tr');
        if (bloqueado) tr.style.opacity = '0.55';
        tr.innerHTML =
          '<td>' + esc(p.name || '—') + '</td>' +
          '<td>' + esc(p.email || '—') + '</td>' +
          '<td>' + esc(p.area || '—') + '</td>' +
          '<td>' + fmtDate(p.createdAt) + '</td>' +
          '<td><span class="admin-badge" style="background:' + (bloqueado ? 'rgba(255,59,48,.18)' : 'rgba(26,178,174,.18)') + ';color:' + (bloqueado ? 'var(--red)' : 'var(--cyan)') + '">' + (bloqueado ? 'Bloqueado' : 'Ativo') + '</span></td>' +
          '<td>' + emailBadge + '</td>' +
          '<td><button class="admin-del-btn admin-pwd-btn" data-key="' + esc(p._key) + '" data-email="' + esc(p.email || '') + '" data-name="' + esc(p.name || p.email) + '" title="Redefinir senha">Redef. senha</button></td>' +
          '<td><button class="admin-del-btn admin-reset-btn" data-key="' + esc(p._key) + '" data-email="' + esc(p.email || '') + '" data-name="' + esc(p.name || p.email) + '" title="Resetar progresso">Resetar</button></td>' +
          '<td><button class="admin-del-btn admin-block-btn" data-key="' + esc(p._key) + '" data-name="' + esc(p.name || p.email) + '" data-blocked="' + (bloqueado ? '1' : '0') + '">' + (bloqueado ? 'Desbloquear' : 'Bloquear') + '</button></td>' +
          confirmBtn;
        tbody.appendChild(tr);
      });
    }
    applyFilters();
    tbl.appendChild(tbody);
    var tblWrap = document.createElement('div');
    tblWrap.className = 'table-scroll-wrap';
    tblWrap.appendChild(tbl);
    c.appendChild(tblWrap);

    /* Filtro por status */
    controlsWrap.querySelectorAll('.admin-status-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        controlsWrap.querySelectorAll('.admin-status-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        statusFiltro = btn.dataset.status;
        applyFilters();
      });
    });

    /* Busca por texto */
    document.getElementById('cadastradosFiltro').addEventListener('input', applyFilters);

    /* Delegação de eventos */
    tbody.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;

      if (btn.classList.contains('admin-pwd-btn')) {
        handlePwdReset(btn);
        return;
      }

      if (btn.classList.contains('admin-reset-btn')) {
        const eKey  = btn.dataset.key;
        const email = btn.dataset.email;
        const name  = btn.dataset.name;
        adminConfirm('Resetar TODO o progresso do jogo de ' + name + '?\n\nIsso apaga autodiagnóstico e patente. Essa ação não pode ser desfeita.', function () {
          const updates = {};
          updates['fa-progress/' + eKey]     = null;
          updates['fa-reset-signal/' + eKey] = { at: firebase.database.ServerValue.TIMESTAMP };
          firebase.database().ref('players').orderByChild('email').equalTo(email).once('value', function (snap) {
            snap.forEach(function (child) { updates['players/' + child.key] = null; });
            firebase.database().ref().update(updates, function (err) {
              if (err) { adminAlert('Erro ao resetar. Tente novamente.'); return; }
              loadCadastrados();
            });
          });
        });
        return;
      }

      if (btn.classList.contains('admin-block-btn')) {
        const eKey     = btn.dataset.key;
        const name     = btn.dataset.name;
        const blocking = btn.dataset.blocked === '0';
        const msg      = blocking
          ? 'Bloquear ' + name + '?\n\nA pessoa não conseguirá mais acessar o portal.'
          : 'Desbloquear ' + name + '?\n\nA pessoa voltará a conseguir acessar o portal.';
        adminConfirm(msg, function () {
          firebase.database().ref('fa-users/' + eKey + '/blocked').set(blocking ? true : null, function (err) {
            if (err) { adminAlert('Erro ao atualizar. Tente novamente.'); return; }
            loadCadastrados();
          });
        });
        return;
      }

      if (btn.classList.contains('admin-confirm-email-btn')) {
        const eKey = btn.dataset.key;
        const name = btn.dataset.name;
        adminConfirm(
          'Confirmar cadastro de ' + name + ' manualmente?\n\nO acesso ao portal será liberado sem que ela precise clicar no link de e-mail.',
          function () {
            var sess = window.faAuth && window.faAuth.getSession();
            var updates = {};
            updates['fa-users/' + eKey + '/adminApproved']           = true;
            updates['fa-users/' + eKey + '/approvedByAdmin']         = sess ? sess.email : null;
            updates['fa-users/' + eKey + '/approvedByAdminName']     = sess ? (sess.name || sess.email) : null;
            updates['fa-users/' + eKey + '/approvedAt']              = new Date().toISOString();
            firebase.database().ref().update(updates, function (err) {
              if (err) { adminAlert('Erro ao confirmar. Tente novamente.'); return; }
              loadCadastrados();
            });
          }
        );
        return;
      }
    });
  }

  /* ---- Administradores ---- */
  function loadAdmins() {
    const c = document.getElementById('adminAdmins');
    if (!c) return;

    const sess = window.faAuth && window.faAuth.getSession();
    const souSuperAdmin = !!(sess && SUPER_ADMINS.indexOf((sess.email || '').toLowerCase()) !== -1);

    function render() {
      firebase.database().ref('fa-admins').once('value', function (snap) {
        const data = snap.val() || {};
        const dbList = Object.values(data).sort(function (a, b) { return (a.name || '').localeCompare(b.name || '', 'pt'); });
        c.innerHTML = '';

        /* Aviso sobre super-admins fixos */
        const info = document.createElement('p');
        info.className = 'admin-empty';
        info.style.marginBottom = '20px';
        info.innerHTML = '<b>Super-admins fixos</b> (não removíveis via painel): ' +
          SUPER_ADMINS.map(function (e) { return esc(e); }).join(', ');
        c.appendChild(info);

        const hdr = document.createElement('h4');
        hdr.innerHTML = 'Administradores adicionais <span class="admin-badge">' + dbList.length + '</span>';
        c.appendChild(hdr);

        if (!dbList.length) {
          const empty = document.createElement('p');
          empty.className = 'admin-empty';
          empty.textContent = 'Nenhum administrador adicional cadastrado.';
          c.appendChild(empty);
        } else {
          const tbl = document.createElement('table');
          tbl.className = 'admin-table';
          tbl.innerHTML = '<thead><tr><th>Nome</th><th>E-mail</th><th>Desde</th>' + (souSuperAdmin ? '<th></th>' : '') + '</tr></thead>';
          const tbody = document.createElement('tbody');
          dbList.forEach(function (p) {
            const tr = document.createElement('tr');
            tr.innerHTML =
              '<td>' + esc(p.name || '—') + '</td>' +
              '<td>' + esc(p.email || '—') + '</td>' +
              '<td>' + fmtDate(p.addedAt) + '</td>' +
              (souSuperAdmin ? '<td><button class="admin-del-btn" data-key="' + esc(emailKey(p.email)) + '" data-name="' + esc(p.name || p.email) + '">Remover</button></td>' : '');
            tbody.appendChild(tr);
          });
          tbl.appendChild(tbody);
          const admTblWrap = document.createElement('div');
          admTblWrap.className = 'table-scroll-wrap';
          admTblWrap.appendChild(tbl);
          c.appendChild(admTblWrap);

          if (souSuperAdmin) {
            tbody.addEventListener('click', function (e) {
              const btn = e.target.closest('.admin-del-btn');
              if (!btn) return;
              adminConfirm('Remover ' + btn.dataset.name + ' dos administradores?', function () {
                firebase.database().ref('fa-admins/' + btn.dataset.key).remove(function () { render(); });
              });
            });
          }
        }

        if (!souSuperAdmin) {
          const aviso = document.createElement('p');
          aviso.className = 'admin-empty';
          aviso.style.marginTop = '20px';
          aviso.textContent = 'Só tatianefdirene e danielfrazao podem adicionar ou remover administradores.';
          c.appendChild(aviso);
          return;
        }

        /* Formulário de adição — só para super-admins */
        const form = document.createElement('div');
        form.className = 'admin-colab-form';
        form.innerHTML =
          '<h4 style="margin-top:32px">Adicionar administrador</h4>' +
          '<div class="admin-colab-row">' +
            '<input id="adminName"  type="text"  placeholder="Nome completo" />' +
            '<input id="adminEmail" type="email" placeholder="e-mail" />' +
            '<button class="btn btn--primary" id="adminAddBtn">Adicionar</button>' +
          '</div>' +
          '<p id="adminMsg" style="margin-top:8px;font-size:.8rem;color:var(--cyan)"></p>';
        c.appendChild(form);

        document.getElementById('adminAddBtn').addEventListener('click', function () {
          const name  = (document.getElementById('adminName').value  || '').trim().toUpperCase();
          const email = (document.getElementById('adminEmail').value || '').trim().toLowerCase();
          const msg   = document.getElementById('adminMsg');
          if (!name || !email) { msg.style.color = 'var(--accent)'; msg.textContent = 'Preencha nome e e-mail.'; return; }
          if (!/^[^\s@]+@previ\.com\.br$/i.test(email)) { msg.style.color = 'var(--accent)'; msg.textContent = 'Use um e-mail @previ.com.br.'; return; }
          firebase.database().ref('fa-admins/' + emailKey(email)).set(
            { email: email, name: name, addedAt: new Date().toISOString() },
            function (err) {
              if (err) { msg.style.color = 'var(--accent)'; msg.textContent = 'Erro ao salvar.'; return; }
              document.getElementById('adminName').value  = '';
              document.getElementById('adminEmail').value = '';
              msg.style.color = 'var(--cyan)'; msg.textContent = name + ' adicionado(a) como administrador(a).';
              render();
            }
          );
        });
      }, function (err) {
        console.error('[admin] erro ao carregar fa-admins', err);
        c.innerHTML = '<p class="loading-msg" style="color:var(--red)">Erro ao carregar administradores. Recarregue a página ou verifique sua conexão.</p>';
      });
    }

    render();
  }

  /* ---- Diretores ----
     Lista separada de fa-admins: marca quem enxerga um evento marcado
     "Visível só para diretores e administradores" (ver openEventoFormModal
     e eventoNaVitrine em app.js). Não dá acesso de admin nenhum — só essa
     visibilidade. Qualquer admin pode gerenciar (regra em fa-diretores),
     ao contrário de Administradores, que só os dois super-admins editam. */
  function loadDiretores() {
    const c = document.getElementById('adminDiretores');
    if (!c) return;

    function render() {
      firebase.database().ref('fa-diretores').once('value', function (snap) {
        const data = snap.val() || {};
        const dbList = Object.values(data).sort(function (a, b) { return (a.name || '').localeCompare(b.name || '', 'pt'); });
        c.innerHTML = '';

        const info = document.createElement('p');
        info.className = 'admin-empty';
        info.style.marginBottom = '20px';
        info.textContent = 'Quem estiver aqui enxerga na página Turmas qualquer evento marcado "Visível só para diretores e administradores" — sem isso, ele some da vitrine dela como se estivesse fora da página. Não muda mais nada: continua sem acesso ao painel admin.';
        c.appendChild(info);

        const hdr = document.createElement('h4');
        hdr.innerHTML = 'Diretores <span class="admin-badge">' + dbList.length + '</span>';
        c.appendChild(hdr);

        if (!dbList.length) {
          const empty = document.createElement('p');
          empty.className = 'admin-empty';
          empty.textContent = 'Nenhum diretor cadastrado.';
          c.appendChild(empty);
        } else {
          const tbl = document.createElement('table');
          tbl.className = 'admin-table';
          tbl.innerHTML = '<thead><tr><th>Nome</th><th>E-mail</th><th>Desde</th><th></th></tr></thead>';
          const tbody = document.createElement('tbody');
          dbList.forEach(function (p) {
            const tr = document.createElement('tr');
            tr.innerHTML =
              '<td>' + esc(p.name || '—') + '</td>' +
              '<td>' + esc(p.email || '—') + '</td>' +
              '<td>' + fmtDate(p.addedAt) + '</td>' +
              '<td><button class="admin-del-btn" data-key="' + esc(emailKey(p.email)) + '" data-name="' + esc(p.name || p.email) + '">Remover</button></td>';
            tbody.appendChild(tr);
          });
          tbl.appendChild(tbody);
          const dirTblWrap = document.createElement('div');
          dirTblWrap.className = 'table-scroll-wrap';
          dirTblWrap.appendChild(tbl);
          c.appendChild(dirTblWrap);

          tbody.addEventListener('click', function (e) {
            const btn = e.target.closest('.admin-del-btn');
            if (!btn) return;
            adminConfirm('Remover ' + btn.dataset.name + ' dos diretores?', function () {
              firebase.database().ref('fa-diretores/' + btn.dataset.key).remove(function () { render(); });
            });
          });
        }

        const form = document.createElement('div');
        form.className = 'admin-colab-form';
        form.innerHTML =
          '<h4 style="margin-top:32px">Adicionar diretor</h4>' +
          '<div class="admin-colab-row">' +
            '<input id="diretorName"  type="text"  placeholder="Nome completo" />' +
            '<input id="diretorEmail" type="email" placeholder="e-mail" />' +
            '<button class="btn btn--primary" id="diretorAddBtn">Adicionar</button>' +
          '</div>' +
          '<p id="diretorMsg" style="margin-top:8px;font-size:.8rem;color:var(--cyan)"></p>';
        c.appendChild(form);

        document.getElementById('diretorAddBtn').addEventListener('click', function () {
          const name  = (document.getElementById('diretorName').value  || '').trim().toUpperCase();
          const email = (document.getElementById('diretorEmail').value || '').trim().toLowerCase();
          const msg   = document.getElementById('diretorMsg');
          if (!name || !email) { msg.style.color = 'var(--accent)'; msg.textContent = 'Preencha nome e e-mail.'; return; }
          if (!/^[^\s@]+@previ\.com\.br$/i.test(email)) { msg.style.color = 'var(--accent)'; msg.textContent = 'Use um e-mail @previ.com.br.'; return; }
          firebase.database().ref('fa-diretores/' + emailKey(email)).set(
            { email: email, name: name, addedAt: new Date().toISOString() },
            function (err) {
              if (err) { msg.style.color = 'var(--accent)'; msg.textContent = 'Erro ao salvar.'; return; }
              document.getElementById('diretorName').value  = '';
              document.getElementById('diretorEmail').value = '';
              msg.style.color = 'var(--cyan)'; msg.textContent = name + ' adicionado(a) como diretor(a).';
              render();
            }
          );
        });
      }, function (err) {
        console.error('[admin] erro ao carregar fa-diretores', err);
        c.innerHTML = '<p class="loading-msg" style="color:var(--red)">Erro ao carregar diretores. Recarregue a página ou verifique sua conexão.</p>';
      });
    }

    render();
  }

  /* ---- Helpers ---- */
  function esc(s) {
    return String(s || '').replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fmtDate(d) {
    if (!d) return '—';
    try {
      /* Data sem hora ("2026-08-10") é lida pelo navegador como meia-noite
         em UTC e, no nosso fuso, volta como as 21h do DIA ANTERIOR. Nesse
         caso monta a data na mão e não inventa hora nenhuma. */
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(d))) {
        var p = String(d).split('-');
        return p[2] + '/' + p[1] + '/' + p[0];
      }
      var dt = new Date(d);
      if (isNaN(dt)) return '—';
      return dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch(e) { return '—'; }
  }

  /* ── Certificados ────────────────────────────────────────────────────── */

  function initCertificados() {
    if (!window.faCertif) return;

    var certif     = window.faCertif;
    var selEv      = document.getElementById('certEventoSelect');
    var sel        = document.getElementById('certTurmaSelect');
    var infoEl     = document.getElementById('certInfoDisplay');
    var wrap       = document.getElementById('certParticipantesWrap');
    var listEl     = document.getElementById('certParticipantesList');
    var hint       = document.getElementById('certPreviewHint');
    var dlTodos    = document.getElementById('certBaixarTodos');
    var dlTodosPDF = document.getElementById('certBaixarTodosPDF');

    if (!sel) return;

    /* estado carregado do Firebase para a turma selecionada */
    var _evento          = null;  /* { key, nome, cargaHoraria, percentualMinimo } */
    var _dataConclusao   = null;  /* 'YYYY-MM-DD' ou null */
    var _encerrada       = false; /* turma concluída → emissão habilitada */
    var _checkinTurma    = {};    /* { [dia]: { [emailKey]: true } } */
    var _diasTurma       = [];    /* array de ISO dates da turma */

    var MESES = ['janeiro','fevereiro','março','abril','maio','junho',
                 'julho','agosto','setembro','outubro','novembro','dezembro'];

    function fmtData(iso) {
      if (!iso) return '';
      var d = new Date(iso + 'T12:00:00');
      return isNaN(d) ? iso : d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear();
    }

    var TOOLTIP_BLOQUEADO = 'Disponível após a conclusão da turma.';

    function updatePreviaBanner(turmaKey) {
      var banner = document.getElementById('certPreviaBanner');
      if (!banner) return;
      if (!turmaKey) { banner.style.display = 'none'; return; }
      if (_encerrada) { banner.style.display = 'none'; return; }
      banner.style.cssText = 'background:rgba(255,165,0,.1);border:1px solid rgba(255,165,0,.45);border-radius:6px;padding:12px 16px;margin-bottom:14px;text-align:center;display:block';
      banner.innerHTML =
        '<div style="font-family:var(--font-head);letter-spacing:.08em;font-size:.8rem;color:#ffb347;margin-bottom:6px">PRÉVIA DO CERTIFICADO — TURMA AINDA NÃO CONCLUÍDA</div>' +
        '<div style="font-size:.78rem;color:var(--ink-2)">Visualização administrativa para conferência. O certificado só poderá ser emitido após a conclusão da turma.</div>';
    }

    function updateLoteButtons() {
      if (dlTodos)    { dlTodos.disabled    = !_encerrada; dlTodos.title    = _encerrada ? '' : TOOLTIP_BLOQUEADO; }
      if (dlTodosPDF) { dlTodosPDF.disabled = !_encerrada; dlTodosPDF.title = _encerrada ? '' : TOOLTIP_BLOQUEADO; }
    }

    function updateInfoDisplay(turmaKey) {
      if (!infoEl) return;
      if (!turmaKey) { infoEl.style.display = 'none'; return; }
      var parts = [];
      if (_evento && _evento.nome) {
        parts.push('<strong>' + esc(_evento.nome) + '</strong>');
        parts.push(_evento.cargaHoraria + 'h');
      } else {
        parts.push('<span style="color:var(--amber,#ffb347)">⚠ Turma sem evento vinculado — vincule um evento na aba Turmas</span>');
      }
      if (_dataConclusao) {
        parts.push('Concluída em ' + fmtData(_dataConclusao));
      } else {
        parts.push('<span style="color:var(--amber,#ffb347)">⚠ Turma ainda não encerrada — data de emissão não definida</span>');
      }
      infoEl.style.cssText = 'padding:10px 14px;background:var(--panel-2);border-radius:6px;font-size:.88rem;color:var(--ink-2);margin-bottom:16px;display:flex;flex-wrap:wrap;gap:8px;align-items:center';
      infoEl.innerHTML = parts.join('<span style="opacity:.4">·</span>');
    }

    /* popular seletor de eventos */
    function populateEventoSelect() {
      if (!selEv) return;
      selEv.innerHTML = '<option value="">— selecionar evento —</option>';
      EVENTOS_LIST.forEach(function (ev) {
        var opt = document.createElement('option');
        opt.value = ev.key;
        opt.textContent = ev.nome || ev.key;
        selEv.appendChild(opt);
      });
    }

    /* popular seletor de turmas filtrado pelo evento */
    function populateTurmaSelect(eventoKey) {
      sel.innerHTML = '';
      var turmasFiltradas = eventoKey
        ? TURMAS_LIST.filter(function (t) { return t.eventoKey === eventoKey; })
        : [];
      if (!turmasFiltradas.length) {
        var ph = document.createElement('option');
        ph.value = '';
        ph.textContent = eventoKey ? '— nenhuma turma neste evento —' : '— selecione um evento primeiro —';
        sel.appendChild(ph);
        sel.disabled = true;
        return;
      }
      var ph = document.createElement('option');
      ph.value = '';
      ph.textContent = '— selecionar turma —';
      sel.appendChild(ph);
      turmasFiltradas.forEach(function (t) {
        var opt = document.createElement('option');
        opt.value = t.key;
        opt.textContent = t.label + (t.dates ? '  (' + t.dates + ')' : '');
        sel.appendChild(opt);
      });
      sel.disabled = false;
    }

    function initSelects() {
      populateEventoSelect();
      populateTurmaSelect('');
    }

    if (EVENTOS_LIST.length && TURMAS_LIST.length) {
      initSelects();
    } else if (TURMAS_LIST.length) {
      loadEventosList(initSelects);
    } else {
      loadTurmasList(function () {
        loadEventosList(initSelects);
      });
    }

    if (selEv) {
      selEv.addEventListener('change', function () {
        /* resetar estado da turma ao trocar evento */
        _evento        = null;
        _dataConclusao = null;
        _encerrada     = false;
        _checkinTurma  = {};
        _diasTurma     = [];
        sel.value      = '';
        if (infoEl) infoEl.style.display = 'none';
        updatePreviaBanner('');
        updateLoteButtons();
        if (wrap) wrap.style.display = 'none';
        if (hint) hint.style.display = '';
        populateTurmaSelect(selEv.value);
      });
    }

    function buildData(participant, turma) {
      return {
        nomeParticipante:   participant.name || '',
        nomeEvento:         _evento ? (_evento.nome || '') : '',
        identificacaoTurma: turma.label,
        periodoTurma:       turma.dates || '',
        cargaHoraria:       _evento ? (_evento.cargaHoraria || '20') : '20',
        dataEmissao:        fmtData(_dataConclusao)
      };
    }

    function renderPreview(participant, turma) {
      var data = buildData(participant, turma);
      certif.preview('certPreviewCanvas', data);
      if (hint) hint.style.display = 'none';
    }

    function renderLista(turma, inscritos) {
      if (!wrap || !listEl) return;
      wrap.style.display = '';
      var title = document.getElementById('certListTitle');
      if (title) title.textContent = 'Participantes inscritos — ' + turma.label + ' (' + inscritos.length + ')';

      /* garantir que hint esteja visível até alguém ser selecionado */
      if (hint) {
        hint.textContent = 'Selecione um participante para visualizar a prévia do certificado.';
        hint.style.display = '';
      }

      listEl.innerHTML = '';
      if (!inscritos.length) {
        listEl.innerHTML = '<p class="cert-empty">Nenhum participante inscrito nesta turma.</p>';
        return;
      }

      var minPct = _evento ? (_evento.percentualMinimo || 75) : 75;

      inscritos.forEach(function (p) {
        var freq      = calcFreq(p.email);              /* null se sem dias cadastrados */
        var atingiu   = freq === null || !_encerrada || freq >= minPct;
        var tooltipBloq = !_encerrada
          ? TOOLTIP_BLOQUEADO
          : 'Frequência insuficiente (' + freq + '% < ' + minPct + '% exigido).';

        var row = document.createElement('div');
        row.className = 'cert-participant-row';

        var nameSpan = document.createElement('span');
        nameSpan.className = 'cert-p-name';
        nameSpan.textContent = p.name || p.email;

        /* badge de frequência (só quando encerrada e há dias cadastrados) */
        if (_encerrada && freq !== null) {
          var freqBadge = document.createElement('span');
          freqBadge.style.cssText = 'font-size:.72rem;font-family:var(--font-mono);padding:2px 7px;border-radius:4px;white-space:nowrap;' +
            (atingiu
              ? 'background:rgba(80,200,100,.15);color:#6dbd7a;border:1px solid rgba(80,200,100,.3)'
              : 'background:rgba(255,80,80,.13);color:#e05c5c;border:1px solid rgba(255,80,80,.28)');
          freqBadge.textContent = freq + '%';
          freqBadge.title = (atingiu ? 'Frequência suficiente' : 'Frequência abaixo do mínimo') + ' (' + minPct + '% exigido)';
          row.appendChild(nameSpan);
          row.appendChild(freqBadge);
        } else {
          row.appendChild(nameSpan);
        }

        var btnPrev = document.createElement('button');
        btnPrev.className = 'btn btn--sm cert-btn-prev';
        btnPrev.textContent = '👁 Prévia';
        btnPrev.addEventListener('click', function () {
          document.querySelectorAll('.cert-participant-row').forEach(function (r) { r.classList.remove('cert-active'); });
          row.classList.add('cert-active');
          renderPreview(p, turma);
        });

        var btnDl = document.createElement('button');
        btnDl.className = 'btn btn--sm cert-btn-dl';
        btnDl.textContent = '⬇ PNG';
        if (_encerrada && atingiu) {
          btnDl.addEventListener('click', function () {
            certif.download(buildData(p, turma), 'certificado_' + (p.name || p.email).replace(/\s+/g, '_').toLowerCase());
          });
        } else {
          btnDl.disabled = true;
          btnDl.title = tooltipBloq;
        }

        var btnPdf = document.createElement('button');
        btnPdf.className = 'btn btn--sm cert-btn-dl';
        btnPdf.textContent = '⬇ PDF';
        if (_encerrada && atingiu) {
          btnPdf.addEventListener('click', function () {
            certif.downloadPDF(buildData(p, turma), 'certificado_' + (p.name || p.email).replace(/\s+/g, '_').toLowerCase());
          });
        } else {
          btnPdf.disabled = true;
          btnPdf.title = tooltipBloq;
        }

        row.appendChild(btnPrev);
        row.appendChild(btnDl);
        row.appendChild(btnPdf);
        listEl.appendChild(row);
      });
      /* sem auto-seleção — usuário escolhe o participante */
    }

    /* calcula frequência de um participante (0–100)

       A chave TEM de ser a mesma que o check-in grava — emailKey(), com
       "@" e "." virando "_". Aqui havia um formato próprio, trocando "."
       por ",", que não existe em lugar nenhum do resto do sistema: nunca
       encontrava ninguém e por isso todo mundo aparecia com 0%, com os
       botões de emissão bloqueados mesmo para quem tinha 100%. */
    function calcFreq(email) {
      if (!_diasTurma.length) return null;
      var eKey = emailKey(email);
      var presentes = _diasTurma.filter(function (d) {
        return _checkinTurma[d] && _checkinTurma[d][eKey];
      }).length;
      return Math.round((presentes / _diasTurma.length) * 100);
    }

    function loadInscritos(turmaKey, cb) {
      firebase.database().ref('turmas-interesse/' + turmaKey).once('value', function (snap) {
        var val = snap.val() || {};
        var inscritos = Object.values(val).filter(function (r) {
          return r && !r.removed && r.status === 'inscrito';
        }).sort(function (a, b) { return (a.name || '').localeCompare(b.name || '', 'pt-BR'); });
        cb(inscritos);
      });
    }

    function loadEventoParaTurma(turma, cb) {
      _evento = null;
      if (!turma.eventoKey) { cb(); return; }
      var ev = EVENTOS_LIST.filter(function (e) { return e.key === turma.eventoKey; })[0];
      if (ev) { _evento = ev; cb(); return; }
      firebase.database().ref('eventos/' + turma.eventoKey).once('value', function (snap) {
        var v = snap.val();
        _evento = v ? { key: turma.eventoKey, nome: v.nome || '', cargaHoraria: v.cargaHoraria || '20' } : null;
        cb();
      });
    }

    sel.addEventListener('change', function () {
      var key = sel.value;
      _evento        = null;
      _dataConclusao = null;
      _encerrada     = false;
      _checkinTurma  = {};
      _diasTurma     = [];
      updateInfoDisplay(key);
      updatePreviaBanner(key);
      updateLoteButtons();

      if (!key) {
        if (wrap) wrap.style.display = 'none';
        if (hint) hint.style.display = '';
        return;
      }

      var turma = TURMAS_LIST.filter(function (t) { return t.key === key; })[0];
      if (!turma) return;

      _diasTurma = turma.dias || [];

      var pending = 3;
      function done() {
        pending--;
        if (pending > 0) return;
        updateInfoDisplay(key);
        updatePreviaBanner(key);
        updateLoteButtons();
        loadInscritos(key, function (inscritos) { renderLista(turma, inscritos); });
      }

      loadEventoParaTurma(turma, done);
      firebase.database().ref('turmas-config/' + key).once('value', function (snap) {
        var cfg = snap.val() || {};
        _dataConclusao = cfg.dataConclusao || null;
        _encerrada     = !!cfg.encerrada;
        done();
      });
      firebase.database().ref('turmas-checkin/' + key).once('value', function (snap) {
        _checkinTurma = snap.val() || {};
        done();
      });
    });

    /* baixar todos — apenas participantes que atingiram o percentual mínimo */
    function baixarTodos(usePDF) {
      if (!_encerrada) return;
      var key = sel.value;
      if (!key) { alert('Selecione uma turma primeiro.'); return; }
      var turma = TURMAS_LIST.filter(function (t) { return t.key === key; })[0];
      if (!turma) return;
      var minPct = _evento ? (_evento.percentualMinimo || 75) : 75;
      loadInscritos(key, function (inscritos) {
        var elegiveis = inscritos.filter(function (p) {
          var freq = calcFreq(p.email);
          return freq === null || freq >= minPct;
        });
        if (!elegiveis.length) { adminAlert('Nenhum participante atingiu o percentual mínimo de ' + minPct + '% de presença.'); return; }
        var i = 0;
        function next() {
          if (i >= elegiveis.length) return;
          var p = elegiveis[i++];
          var slug = (p.name || p.email).replace(/\s+/g, '_').toLowerCase();
          if (usePDF) certif.downloadPDF(buildData(p, turma), 'certificado_' + slug);
          else certif.download(buildData(p, turma), 'certificado_' + slug);
          setTimeout(next, 800);
        }
        next();
      });
    }

    if (dlTodos)    dlTodos.addEventListener('click',    function () { baixarTodos(false); });
    if (dlTodosPDF) dlTodosPDF.addEventListener('click', function () { baixarTodos(true); });
  }

})();
