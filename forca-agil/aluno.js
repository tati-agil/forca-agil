/* ============================================================
   Força Ágil — Minha Área (área do participante)

   Reúne, para a pessoa logada, o que hoje só o admin conseguia
   consultar: em qual turma ela está, quantos dias compareceu, se
   atingiu a frequência mínima, o certificado (quando a turma é
   concluída), suas avaliações e seus pedidos.

   Deliberadamente NÃO mostra o QR Code de check-in: o QR é o mesmo
   todos os dias e quem controla a validade é o admin abrindo o dia.
   Se cada pessoa tivesse o QR em mãos, daria para registrar presença
   sem estar no encontro — e como a frequência define quem recebe
   certificado, isso corromperia justamente o critério.
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
  function fmtDia(iso) {
    if (!iso) return '—';
    var p = String(iso).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] : iso;
  }
  function fmtDataLonga(iso) {
    if (!iso) return '';
    var meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
    var d = new Date(iso + 'T12:00:00');
    if (isNaN(d)) return iso;
    return d.getDate() + ' de ' + meses[d.getMonth()] + ' de ' + d.getFullYear();
  }

  function carregar(uKey, email, cb) {
    var db = firebase.database();
    Promise.all([
      db.ref('turmas-interesse').once('value'),
      db.ref('turmas').once('value'),
      db.ref('turmas-config').once('value'),
      db.ref('turmas-checkin').once('value'),
      db.ref('eventos').once('value'),
      db.ref('avaliacoes').once('value'),
      db.ref('pedidos').once('value'),
    ]).then(function (r) {
      cb({
        interesse: r[0].val() || {},
        turmas:    r[1].val() || {},
        config:    r[2].val() || {},
        checkin:   r[3].val() || {},
        eventos:   r[4].val() || {},
        avaliacoes:r[5].val() || {},
        pedidos:   r[6].val() || {},
      });
    }).catch(function (err) {
      console.error('[minha-area]', err);
      cb(null);
    });
  }

  /* Monta a situação da pessoa em cada turma em que está confirmada */
  function minhasTurmas(d, uKey) {
    var out = [];
    Object.keys(d.interesse).forEach(function (tk) {
      var reg = (d.interesse[tk] || {})[uKey];
      if (!reg || reg.removed || reg.status !== 'inscrito' || !reg.confirmedByAdmin) return;

      var turma  = d.turmas[tk] || {};
      var cfg    = d.config[tk] || {};
      var evento = turma.eventoKey ? (d.eventos[turma.eventoKey] || {}) : {};
      var dias   = turma.dias || [];
      var ckT    = d.checkin[tk] || {};

      var presentes = dias.filter(function (dia) { return ckT[dia] && ckT[dia][uKey]; });
      var pctMin    = Number(evento.percentualMinimo || 75);
      var freq      = dias.length ? Math.round((presentes.length / dias.length) * 1000) / 10 : 0;

      out.push({
        key: tk,
        label: turma.label || tk,
        datas: turma.dates || '',
        dias: dias,
        presentes: presentes,
        freq: freq,
        pctMin: pctMin,
        atingiu: freq >= pctMin,
        encerrada: !!cfg.encerrada,
        dataConclusao: cfg.dataConclusao || null,
        evento: evento,
        avaliacaoLiberada: !!turma.avaliacaoHabilitada,
        avaliacaoRespondida: !!((d.avaliacoes[tk] || {})[uKey]),
      });
    });
    return out.sort(function (a, b) { return (a.label || '').localeCompare(b.label || '', 'pt'); });
  }

  function cardTurma(t, idx) {
    var h = '<div class="aluno-card">';
    h += '<div class="aluno-card-head">';
    h += '<h3 class="aluno-card-title">' + esc(t.label) + '</h3>';
    h += '<span class="aluno-badge ' + (t.encerrada ? 'aluno-badge--ok' : 'aluno-badge--andamento') + '">' +
         (t.encerrada ? 'Concluída' : 'Em andamento') + '</span>';
    h += '</div>';
    if (t.evento.nome) h += '<p class="aluno-card-sub">' + esc(t.evento.nome) + (t.evento.cargaHoraria ? ' · ' + esc(t.evento.cargaHoraria) + 'h' : '') + '</p>';
    if (t.datas) h += '<p class="aluno-card-sub">Encontros: ' + esc(t.datas) + '</p>';

    /* Frequência */
    h += '<div class="aluno-freq">';
    h += '<div class="aluno-freq-top"><span>Sua frequência</span><strong>' + String(t.freq).replace('.', ',') + '%</strong></div>';
    h += '<div class="aluno-freq-bar"><span style="width:' + Math.min(100, t.freq) + '%;background:' + (t.atingiu ? '#4caf7d' : '#f5a623') + '"></span></div>';
    h += '<p class="aluno-freq-info">' + t.presentes.length + ' de ' + t.dias.length + ' encontro' + (t.dias.length !== 1 ? 's' : '') +
         ' · mínimo para o certificado: ' + t.pctMin + '%</p>';
    if (t.dias.length) {
      h += '<div class="aluno-dias">';
      t.dias.forEach(function (dia) {
        var veio = t.presentes.indexOf(dia) !== -1;
        h += '<span class="aluno-dia ' + (veio ? 'aluno-dia--ok' : '') + '" title="' + (veio ? 'Presença registrada' : 'Sem registro de presença') + '">' +
             (veio ? '✓ ' : '') + fmtDia(dia) + '</span>';
      });
      h += '</div>';
    }
    h += '</div>';

    /* Certificado */
    h += '<div class="aluno-cert">';
    if (!t.encerrada) {
      h += '<p class="aluno-cert-msg">📜 O certificado fica disponível aqui depois que a turma for concluída.</p>';
    } else if (!t.atingiu) {
      h += '<p class="aluno-cert-msg aluno-cert-msg--alerta">📜 Certificado indisponível: a frequência mínima para esta turma é ' + t.pctMin + '% e a sua foi ' + String(t.freq).replace('.', ',') + '%.</p>';
    } else {
      h += '<p class="aluno-cert-msg aluno-cert-msg--ok">🎉 Certificado liberado!</p>';
      h += '<div class="aluno-cert-btns">' +
             '<button class="btn btn--sm btn--primary aluno-cert-png" data-turma="' + esc(t.key) + '">⬇ Baixar PNG</button>' +
             '<button class="btn btn--sm aluno-cert-pdf" data-turma="' + esc(t.key) + '">⬇ Baixar PDF</button>' +
           '</div>';
    }
    h += '</div>';

    /* Avaliação */
    h += '<div class="aluno-aval">';
    if (t.avaliacaoRespondida) {
      h += '<span class="aluno-aval-ok">✓ Avaliação enviada — obrigado!</span>';
    } else if (t.avaliacaoLiberada) {
      h += '<span class="aluno-aval-pend">📝 Avaliação em aberto</span>' +
           '<a class="btn btn--sm btn--primary" href="#avaliacao">Responder agora</a>';
    } else {
      h += '<span class="aluno-aval-msg">A avaliação desta turma ainda não foi liberada.</span>';
    }
    h += '</div>';

    h += '</div>';
    return h;
  }

  function blocoPedidos(d, email) {
    var meus = Object.keys(d.pedidos)
      .map(function (k) { return Object.assign({ _key: k }, d.pedidos[k]); })
      .filter(function (p) { return !p.excluido && (p.emailEnviou || '').toLowerCase() === (email || '').toLowerCase(); })
      .sort(function (a, b) { return (b.dataEnvio || '').localeCompare(a.dataEnvio || ''); });

    var h = '<h3 class="aluno-sec-title">Meus pedidos</h3>';
    if (!meus.length) {
      h += '<p class="aluno-vazio">Você ainda não enviou nenhum pedido. Pode sugerir temas, cursos ou materiais na página <a href="#ajuda">Ajuda</a>.</p>';
      return h;
    }
    h += '<div class="aluno-pedidos">';
    meus.forEach(function (p) {
      var data = p.dataEnvio ? new Date(p.dataEnvio).toLocaleDateString('pt-BR') : '';
      h += '<div class="aluno-pedido">' +
        '<div class="aluno-pedido-top">' +
          '<span class="aluno-pedido-status ' + (p.respondido ? 'aluno-pedido-status--ok' : '') + '">' +
            (p.respondido ? '✓ Respondido' : '⏳ Em análise') + '</span>' +
          '<span class="aluno-pedido-data">' + data + '</span>' +
        '</div>' +
        (p.descricao ? '<p class="aluno-pedido-texto">' + esc(p.descricao) + '</p>' : '') +
        (p.respondido ? '<p class="aluno-pedido-resp">Respondido por e-mail — confira sua caixa de entrada.</p>' : '') +
      '</div>';
    });
    h += '</div>';
    return h;
  }

  function render(wrap, d, uKey, nome, email) {
    if (!d) {
      wrap.innerHTML = '<p class="loading-msg" style="color:var(--red)">Erro ao carregar sua área. Recarregue a página.</p>';
      return;
    }
    var turmas = minhasTurmas(d, uKey);
    var html = '';

    html += '<h3 class="aluno-sec-title">Minhas turmas</h3>';
    if (!turmas.length) {
      html += '<p class="aluno-vazio">Você ainda não está confirmado em nenhuma turma. Manifeste interesse na página <a href="#turmas">Turmas</a> — quando o admin confirmar sua inscrição, sua turma aparece aqui com a frequência e o certificado.</p>';
    } else {
      html += '<div class="aluno-turmas">';
      turmas.forEach(function (t, i) { html += cardTurma(t, i); });
      html += '</div>';
    }

    html += blocoPedidos(d, email);
    wrap.innerHTML = html;

    /* Downloads do certificado — reaproveita o mesmo gerador do painel admin,
       então o certificado da pessoa é idêntico ao emitido pelo admin. */
    function dadosCert(t) {
      return {
        nomeParticipante:   nome,
        nomeEvento:         (t.evento && t.evento.nome) || '',
        identificacaoTurma: t.label,
        periodoTurma:       t.datas,
        cargaHoraria:       (t.evento && t.evento.cargaHoraria) || '20',
        dataEmissao:        fmtDataLonga(t.dataConclusao),
      };
    }
    function acharTurma(key) {
      return turmas.filter(function (t) { return t.key === key; })[0];
    }
    wrap.querySelectorAll('.aluno-cert-png').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = acharTurma(b.dataset.turma); if (!t || !window.faCertif) return;
        b.disabled = true; b.textContent = 'Gerando…';
        window.faCertif.download(dadosCert(t), 'Certificado_' + (nome || '').replace(/\s+/g, '_'))
          .then(function () { b.disabled = false; b.textContent = '⬇ Baixar PNG'; });
      });
    });
    wrap.querySelectorAll('.aluno-cert-pdf').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = acharTurma(b.dataset.turma); if (!t || !window.faCertif) return;
        b.disabled = true; b.textContent = 'Gerando…';
        window.faCertif.downloadPDF(dadosCert(t), 'Certificado_' + (nome || '').replace(/\s+/g, '_'))
          .then(function () { b.disabled = false; b.textContent = '⬇ Baixar PDF'; });
      });
    });
  }

  var _aguardandoAuth = false;

  function init() {
    var wrap = document.getElementById('minhaAreaContent');
    if (!wrap) return;

    var sess = window.faAuth && window.faAuth.getSession();
    /* Mesmo padrão das outras telas: ao abrir #minha-area direto (F5, link
       salvo), o router dispara antes da sessão existir. */
    if (!sess) {
      if (_aguardandoAuth) return;
      _aguardandoAuth = true;
      wrap.innerHTML = '<p class="loading-msg">Carregando…</p>';
      window.addEventListener('fa-auth-ready', function onReady() {
        window.removeEventListener('fa-auth-ready', onReady);
        _aguardandoAuth = false;
        init();
      });
      return;
    }

    wrap.innerHTML = '<p class="loading-msg">Carregando…</p>';
    var uKey = emailKey(sess.email);
    carregar(uKey, sess.email, function (d) {
      render(wrap, d, uKey, sess.name || sess.email, sess.email);
    });
  }

  if (window.faRouter && window.faRouter.onPageInit) window.faRouter.onPageInit('minha-area', init);
  window.faMinhaArea = { init: init };
})();
