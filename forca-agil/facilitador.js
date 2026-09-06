/* ============================================================
   Força Ágil — Área do Facilitador ("Minhas Facilitações")

   Mostra, para quem está logado, só as turmas em que a pessoa está na
   equipe de facilitação (turmas-equipe) — nunca o painel administrativo
   inteiro (ver router.js: #facilitador é admin OU facilitador, mas esta
   tela em si não lista outras turmas além das da pessoa logada). Agrupa
   por fase do mesmo jeito que Minha Área agrupa as turmas do aluno
   (forca-agil/aluno.js): Em andamento → Programadas → Concluídas.

   "Abrir roteiro" reaproveita window.faRoteiro.renderRoteiroTurma — a
   mesma função que o admin usa dentro do painel — com editable=true só
   quando a pessoa é a RESPONSÁVEL daquela turma (facilitador de apoio
   vê o roteiro, mas não edita, conforme o papel definido na equipe).
   ============================================================ */
(function () {
  'use strict';

  function esc(s) {
    return String(s || '').replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function emailKey(e) {
    return (e || '').toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
  }
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function periodoTexto(dias) {
    if (!window.faTurmasUtil) return '';
    var f = window.faTurmasUtil.formatDias(dias);
    return f.dates && f.mes ? f.dates + ' de ' + f.mes : '';
  }

  function init() {
    var c = document.getElementById('facilitadorConteudo');
    if (!c) return;
    var sess = window.faAuth && window.faAuth.getSession();
    if (!sess) { c.innerHTML = '<p class="admin-empty">Entre para ver suas facilitações.</p>'; return; }

    /* Admin sem estar na equipe de nenhuma turma vê a mesma tela vazia
       que um facilitador cadastrado sem turma nenhuma ainda — a página
       nunca lista turmas fora das que a pessoa está associada. */
    if (window.faAuth.isAdminReady && !window.faAuth.isAdminReady()) {
      window.addEventListener('fa-admin-ready', function onAdm() { window.removeEventListener('fa-admin-ready', onAdm); init(); });
      return;
    }

    var minhaKey = emailKey(sess.email);
    var db = firebase.database();

    Promise.all([
      db.ref('turmas').once('value'),
      db.ref('eventos').once('value'),
      db.ref('turmas-config').once('value'),
      db.ref('turmas-equipe').once('value')
    ]).then(function (snaps) {
      var turmas = snaps[0].val() || {};
      var eventos = snaps[1].val() || {};
      var config = snaps[2].val() || {};
      var equipeTudo = snaps[3].val() || {};

      var minhas = [];
      Object.keys(equipeTudo).forEach(function (turmaKey) {
        var membro = (equipeTudo[turmaKey] || {})[minhaKey];
        if (!membro) return;
        var t = turmas[turmaKey];
        if (!t) return;
        var ev = t.eventoKey ? (eventos[t.eventoKey] || {}) : {};
        var cfg = config[turmaKey] || {};
        var diasOrd = (t.dias || []).slice().sort();
        var primeiro = diasOrd[0] || '';
        var fase = cfg.encerrada ? 'concluida' : (primeiro && primeiro > todayISO()) ? 'programada' : 'andamento';
        minhas.push({
          turmaKey: turmaKey, turma: Object.assign({ key: turmaKey }, t),
          eventoNome: ev.nome || 'Evento', papel: membro.papel,
          periodo: periodoTexto(t.dias), fase: fase, primeiro: primeiro
        });
      });

      render(c, minhas);
    }).catch(function (err) {
      console.error('[facilitador] erro ao carregar', err);
      c.innerHTML = '<p class="loading-msg" style="color:var(--red)">Erro ao carregar suas facilitações. Recarregue a página.</p>';
    });
  }

  function render(c, minhas) {
    c.innerHTML = '';
    if (!minhas.length) {
      c.innerHTML = '<p class="admin-empty">Você ainda não está na equipe de facilitação de nenhuma turma.</p>';
      return;
    }

    var GRUPOS = [['andamento', 'Em andamento'], ['programada', 'Programadas'], ['concluida', 'Concluídas']];
    GRUPOS.forEach(function (g) {
      var doGrupo = minhas.filter(function (m) { return m.fase === g[0]; })
        .sort(function (a, b) { return (a.primeiro || '').localeCompare(b.primeiro || ''); });
      if (!doGrupo.length) return;

      var h = document.createElement('h3');
      h.style.cssText = 'font-family:var(--font-head);letter-spacing:.06em;font-size:.85rem;color:var(--ink-2);margin:24px 0 12px';
      h.textContent = g[1] + ' (' + doGrupo.length + ')';
      c.appendChild(h);

      var grid = document.createElement('div');
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px';
      doGrupo.forEach(function (m) { grid.appendChild(card(m)); });
      c.appendChild(grid);
    });
  }

  function card(m) {
    var el = document.createElement('div');
    el.style.cssText = 'background:#1a2035;border:1px solid var(--line-strong);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:8px';
    el.innerHTML =
      '<span style="font-family:var(--font-head);letter-spacing:.06em;font-size:.72rem;color:var(--ink-3);text-transform:uppercase">' + esc(m.eventoNome) + '</span>' +
      '<strong style="color:var(--ink);font-size:1rem">' + esc(m.turma.label || m.turmaKey) + '</strong>' +
      (m.periodo ? '<span style="font-size:.82rem;color:var(--ink-2)">' + esc(m.periodo) + '</span>' : '') +
      '<span style="font-size:.82rem;color:' + (m.papel === 'responsavel' ? 'var(--gold)' : 'var(--ink-2)') + '">' +
        (m.papel === 'responsavel' ? '⭐ Você é o responsável por esta turma.' : 'Você participa como facilitador.') + '</span>';
    var btnWrap = document.createElement('div');
    btnWrap.style.cssText = 'margin-top:8px';
    var roteiroBtn = document.createElement('button');
    roteiroBtn.className = 'btn btn--sm btn--primary';
    roteiroBtn.style.cssText = 'padding:6px 12px;font-size:.75rem';
    roteiroBtn.textContent = 'Abrir roteiro';
    roteiroBtn.addEventListener('click', function () { abrirRoteiro(m); });
    btnWrap.appendChild(roteiroBtn);
    el.appendChild(btnWrap);
    return el;
  }

  function abrirRoteiro(m) {
    if (!window.faRoteiro) return;
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9999';
    var box = document.createElement('div');
    box.className = 'modal-box';
    box.style.cssText = 'max-width:880px;width:94%;padding:28px;display:flex;flex-direction:column;gap:12px;max-height:90vh;overflow:auto';
    box.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center">' +
        '<h3 style="font-size:1.05rem;font-family:var(--font-head);letter-spacing:.05em;color:var(--ink)">Roteiro — ' + esc(m.turma.label || '') + '</h3>' +
        '<button class="btn btn--sm rt-fac-fechar">Fechar</button></div>' +
      '<div id="rtFacBody"></div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function close() { document.body.removeChild(overlay); }
    box.querySelector('.rt-fac-fechar').addEventListener('click', close);
    var overlayMousedownFora = false;
    overlay.addEventListener('mousedown', function (e) { overlayMousedownFora = !box.contains(e.target); });
    overlay.addEventListener('click', function (e) { if (overlayMousedownFora && !box.contains(e.target)) close(); });

    window.faRoteiro.carregarEquipeTurma(m.turmaKey, function (err, equipe) {
      window.faRoteiro.renderRoteiroTurma(box.querySelector('#rtFacBody'), m.turma, {
        editable: m.papel === 'responsavel', equipe: equipe || []
      });
    });
  }

  window.faInitFacilitador = init;
  if (window.faRouter && window.faRouter.onPageInit) window.faRouter.onPageInit('facilitador', init);
})();
