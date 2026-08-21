/* ============================================================
   Força Ágil — Dashboard de Avaliações (Painel Admin)
   Visão Geral: estatísticas agregadas a partir de avaliacoes/ no
   Firebase. "Destaques dos feedbacks" usa só campos estruturados
   (notas 0–10 por seção) — não interpreta texto livre.
   ============================================================ */
(function () {
  'use strict';

  var SECOES_RATING = [
    { field: 'orgGeral',           icon: '🗓️', label: 'Organização e planejamento' },
    { field: 'conteudoRelevancia', icon: '⭐',  label: 'Conteúdo prático e aplicável' },
    { field: 'facilitadoresNota',  icon: '🧑‍🏫', label: 'Instrutores capacitados' },
    { field: 'dinamicasNota',      icon: '🎮',  label: 'Dinâmicas e atividades' },
    { field: 'aplicacaoPreparado', icon: '🚀',  label: 'Aplicação prática e preparo' },
  ];

  var BUCKETS = [
    { label: '0-1',  emoji: '😡', test: function (n) { return n <= 1; } },
    { label: '2',    emoji: '😠', test: function (n) { return n === 2; } },
    { label: '3-4',  emoji: '😞', test: function (n) { return n >= 3 && n <= 4; } },
    { label: '5-6',  emoji: '😐', test: function (n) { return n >= 5 && n <= 6; } },
    { label: '7-8',  emoji: '🙂', test: function (n) { return n >= 7 && n <= 8; } },
    { label: '9-10', emoji: '🤩', test: function (n) { return n >= 9; } },
  ];

  function esc(s) {
    return String(s || '').replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fmt1(n) {
    return (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');
  }
  function nums(arr, field) {
    return arr.map(function (a) { return a[field]; }).filter(function (v) { return typeof v === 'number'; });
  }
  function avg(arr, field) {
    var vals = nums(arr, field);
    if (!vals.length) return 0;
    return vals.reduce(function (s, v) { return s + v; }, 0) / vals.length;
  }

  function carregarDados(cb) {
    Promise.all([
      firebase.database().ref('avaliacoes').once('value'),
      firebase.database().ref('turmas').once('value'),
      firebase.database().ref('turmas-interesse').once('value'),
    ]).then(function (res) {
      var avaliacoesRaw = res[0].val() || {};
      var turmasData    = res[1].val() || {};
      var interesseData = res[2].val() || {};

      var avals = [];
      Object.keys(avaliacoesRaw).forEach(function (turmaKey) {
        Object.keys(avaliacoesRaw[turmaKey] || {}).forEach(function (uKey) {
          avals.push(Object.assign({ turmaKey: turmaKey, uKey: uKey }, avaliacoesRaw[turmaKey][uKey]));
        });
      });

      var participantes = 0;
      Object.keys(interesseData).forEach(function (turmaKey) {
        Object.keys(interesseData[turmaKey] || {}).forEach(function (uKey) {
          var e = interesseData[turmaKey][uKey];
          if (e && !e.removed && e.status === 'inscrito' && e.confirmedByAdmin) participantes++;
        });
      });

      cb(avals, turmasData, participantes);
    }).catch(function (err) {
      console.error('[dashboard]', err);
      cb(null);
    });
  }

  function calcular(avals, turmasData, participantes) {
    var total = avals.length;
    var mediaGeral = avg(avals, 'notaGeral');
    var mediaNps   = avg(avals, 'npsNota');

    var npsVals = nums(avals, 'npsNota');
    var promoters  = npsVals.filter(function (v) { return v >= 9; }).length;
    var detractors = npsVals.filter(function (v) { return v <= 6; }).length;
    var npsScore = npsVals.length ? Math.round((promoters / npsVals.length - detractors / npsVals.length) * 100) : 0;
    var pct7maisNps = npsVals.length ? Math.round((npsVals.filter(function (v) { return v >= 7; }).length / npsVals.length) * 1000) / 10 : 0;

    var comentarios = avals.filter(function (a) { return a.continuar || a.melhorar || a.espacoAberto; }).length;
    var pctParticipacao = participantes ? Math.round((total / participantes) * 1000) / 10 : 0;

    var notasValidas = nums(avals, 'notaGeral');
    var distrib = BUCKETS.map(function (b) {
      var n = notasValidas.filter(b.test).length;
      return { label: b.label, emoji: b.emoji, n: n, pct: notasValidas.length ? Math.round((n / notasValidas.length) * 1000) / 10 : 0 };
    });
    var pct7mais = notasValidas.length ? Math.round((notasValidas.filter(function (v) { return v >= 7; }).length / notasValidas.length) * 1000) / 10 : 0;

    var porTurma = {};
    avals.forEach(function (a) {
      if (!porTurma[a.turmaKey]) porTurma[a.turmaKey] = [];
      porTurma[a.turmaKey].push(a);
    });
    /* Mostra TODAS as turmas cadastradas (mesmo sem avaliação ainda) — barra em 0
       em vez de a turma simplesmente sumir do gráfico quando não há dado. */
    var turmasArr = Object.keys(turmasData).map(function (tk) {
      var label = turmasData[tk].label || tk;
      var arr = porTurma[tk] || [];
      return { key: tk, label: label, media: avg(arr, 'notaGeral'), n: arr.length };
    }).sort(function (a, b) { return a.label.localeCompare(b.label, 'pt'); });

    var destaques = SECOES_RATING.map(function (s) {
      var vals = nums(avals, s.field);
      return Object.assign({}, s, {
        media: avg(avals, s.field),
        mencoes: vals.filter(function (v) { return v >= 8; }).length,
      });
    }).sort(function (a, b) { return b.media - a.media; });

    var temasCount = {};
    avals.forEach(function (a) {
      (a.temasDesejados || []).forEach(function (t) { temasCount[t] = (temasCount[t] || 0) + 1; });
    });
    var temasArr = Object.keys(temasCount).map(function (t) { return { tema: t, n: temasCount[t] }; })
      .sort(function (a, b) { return b.n - a.n; });

    var feedbacks = avals.filter(function (a) { return a.continuar; })
      .sort(function (a, b) { return (b.timestamp || '').localeCompare(a.timestamp || ''); })
      .slice(0, 3);

    return {
      total: total, mediaGeral: mediaGeral, mediaNps: mediaNps, npsScore: npsScore, pct7maisNps: pct7maisNps,
      comentarios: comentarios, participantes: participantes, pctParticipacao: pctParticipacao,
      distrib: distrib, pct7mais: pct7mais, turmasArr: turmasArr, destaques: destaques,
      temasArr: temasArr, feedbacks: feedbacks,
    };
  }

  /* ── SVG: barras de média por turma ──
     viewBox mais estreito (perto da largura real da coluna) + fontes maiores —
     um viewBox largo (ex: 640) escalado pra caber numa coluna estreita do
     grid encolhe o texto proporcionalmente, ficando ilegível. */
  function svgBarras(turmasArr) {
    if (!turmasArr.length) return '<p class="dash-empty">Nenhuma avaliação registrada ainda.</p>';
    /* padT precisa caber o valor escrito ACIMA da barra (fonte 15, deslocada
       8px para cima). Com padT baixo, uma barra perto de 10 empurrava o
       número para fora do viewBox e ele aparecia cortado pela metade. */
    var W = 420, H = 240, padL = 30, padB = 40, padT = 32;
    var chartW = W - padL - 10, chartH = H - padT - padB;
    var barW = Math.min(64, chartW / turmasArr.length - 20);
    var cores = ['#9b7fff', '#4caf7d', '#42a5f5', '#f5c542', '#e8854a', '#e05c7f'];
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="dash-svg-barras" role="img" aria-label="Média por turma">';
    [0, 2, 4, 6, 8, 10].forEach(function (v) {
      var y = padT + chartH - (v / 10) * chartH;
      svg += '<line x1="' + padL + '" y1="' + y + '" x2="' + (W - 6) + '" y2="' + y + '" stroke="var(--line)" stroke-width="1"/>';
      svg += '<text x="' + (padL - 6) + '" y="' + (y + 4) + '" text-anchor="end" font-size="13" fill="var(--ink-2)">' + v + '</text>';
    });
    turmasArr.forEach(function (t, i) {
      var slotW = chartW / turmasArr.length;
      var x = padL + i * slotW + (slotW - barW) / 2;
      var h = (t.media / 10) * chartH;
      var y = padT + chartH - h;
      var cor = cores[i % cores.length];
      svg += '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + h + '" rx="4" fill="' + cor + '"/>';
      svg += '<text x="' + (x + barW / 2) + '" y="' + (y - 8) + '" text-anchor="middle" font-size="15" font-weight="700" fill="var(--ink)">' + fmt1(t.media) + '</text>';
      svg += '<text x="' + (x + barW / 2) + '" y="' + (H - padB + 18) + '" text-anchor="middle" font-size="12" fill="var(--ink-2)">' + esc(t.label) + '</text>';
      svg += '<text x="' + (x + barW / 2) + '" y="' + (H - padB + 32) + '" text-anchor="middle" font-size="11" fill="var(--ink-3)">(' + t.n + ' avaliaç' + (t.n !== 1 ? 'ões' : 'ão') + ')</text>';
    });
    svg += '</svg>';
    return svg;
  }

  /* ── SVG: gauge semicircular de recomendação ── */
  function svgGauge(media) {
    var cx = 100, cy = 100, r = 80;
    var pct = Math.max(0, Math.min(1, media / 10));
    var ang = Math.PI - pct * Math.PI; /* de 180° (esquerda) até 0° (direita) */
    var x2 = cx + r * Math.cos(ang), y2 = cy - r * Math.sin(ang);
    var largeArc = pct > 0.5 ? 1 : 0;
    var svg = '<svg viewBox="0 0 200 115" class="dash-svg-gauge" role="img" aria-label="Média de recomendação">';
    svg += '<path d="M ' + (cx - r) + ' ' + cy + ' A ' + r + ' ' + r + ' 0 1 1 ' + (cx + r) + ' ' + cy + '" fill="none" stroke="var(--line-strong)" stroke-width="16" stroke-linecap="round"/>';
    svg += '<path d="M ' + (cx - r) + ' ' + cy + ' A ' + r + ' ' + r + ' 0 ' + largeArc + ' 1 ' + x2 + ' ' + y2 + '" fill="none" stroke="#a78bfa" stroke-width="16" stroke-linecap="round"/>';
    svg += '</svg>';
    return svg;
  }

  function statCard(icon, label, value, sub, cor) {
    return '<div class="dash-stat-card" style="--sc:' + cor + '">' +
      '<div class="dash-stat-icon">' + icon + '</div>' +
      '<div class="dash-stat-body"><span class="dash-stat-label">' + esc(label) + '</span>' +
      '<span class="dash-stat-value">' + value + '</span>' +
      (sub ? '<span class="dash-stat-sub">' + sub + '</span>' : '') +
      '</div></div>';
  }

  function render(wrap, dados) {
    if (!dados) { wrap.innerHTML = '<p class="loading-msg" style="color:var(--red)">Erro ao carregar dashboard. Recarregue a página.</p>'; return; }

    var html = '';
    if (!dados.total) {
      html += '<div class="dash-aviso-vazio">📭 Nenhuma avaliação recebida ainda — os números abaixo estão zerados. Libere a avaliação de uma turma na aba Eventos (menu ⋯ → "Liberar avaliação") para começar a receber respostas.</div>';
    }

    html += '<div class="dash-stats-row">';
    html += statCard('👥', 'Participantes', dados.participantes, 'Total de inscritos', '#9b7fff');
    html += statCard('✅', 'Avaliações recebidas', dados.total, dados.pctParticipacao + '% de participação', '#4caf7d');
    html += statCard('⭐', 'Média geral', fmt1(dados.mediaGeral) + ' / 10', dados.mediaGeral >= 8 ? 'Ótimo 🚀' : (dados.mediaGeral >= 6 ? 'Bom' : 'Atenção'), '#f5c542');
    html += statCard('📈', 'NPS (recomendação)', (dados.npsScore >= 0 ? '+' : '') + dados.npsScore, dados.npsScore >= 50 ? 'Zona de excelência' : 'Acompanhar', '#e8854a');
    html += statCard('💬', 'Comentários', dados.comentarios, 'Feedbacks recebidos', '#e05c7f');
    html += '</div>';

    html += '<div class="dash-grid-3">';

    html += '<div class="dash-panel"><h4 class="dash-panel-title">Média por turma</h4>' + svgBarras(dados.turmasArr) + '</div>';

    html += '<div class="dash-panel"><h4 class="dash-panel-title">Distribuição das notas (geral)</h4>';
    html += '<div class="dash-distrib-row">';
    dados.distrib.forEach(function (b) {
      html += '<div class="dash-distrib-item"><span class="dash-distrib-emoji">' + b.emoji + '</span>' +
        '<span class="dash-distrib-range">' + b.label + '</span>' +
        '<span class="dash-distrib-n">' + b.n + '</span>' +
        '<span class="dash-distrib-pct">' + fmt1(b.pct) + '%</span></div>';
    });
    html += '</div>';
    html += '<div class="dash-distrib-bar">';
    dados.distrib.forEach(function (b, i) {
      var cores = ['#ff5252', '#f5a623', '#f5a623', '#8a93a8', '#4caf7d', '#4caf7d'];
      if (b.pct > 0) html += '<span style="width:' + b.pct + '%;background:' + cores[i] + '" title="' + b.label + ': ' + fmt1(b.pct) + '%"></span>';
    });
    html += '</div>';
    html += '<p class="dash-distrib-resumo">' + dados.total + ' avaliações — ' + fmt1(dados.pct7mais) + '% deram nota 7 ou acima ↑</p>';
    html += '</div>';

    html += '<div class="dash-panel dash-panel--center"><h4 class="dash-panel-title">Recomendaria a oficina a um colega?</h4>';
    html += svgGauge(dados.mediaNps);
    html += '<div class="dash-gauge-value">' + fmt1(dados.mediaNps) + ' <span>/ 10</span></div>';
    html += '<p class="dash-distrib-resumo">' + fmt1(dados.pct7maisNps) + '% dos participantes dariam nota 7 ou acima</p>';
    html += '</div>';

    html += '</div>'; /* dash-grid-3 */

    html += '<div class="dash-grid-2">';

    html += '<div class="dash-panel"><h4 class="dash-panel-title">Principais destaques dos feedbacks</h4>';
    html += '<p class="ped-admin-meta" style="margin-bottom:12px">Calculado a partir das notas por seção (não interpreta texto livre) — mostra as seções mais bem avaliadas.</p>';
    html += '<div class="dash-destaques-lista">';
    dados.destaques.forEach(function (d) {
      html += '<div class="dash-destaque-item"><span class="dash-destaque-icon">' + d.icon + '</span>' +
        '<span class="dash-destaque-label">' + esc(d.label) + '</span>' +
        '<span class="dash-destaque-media">' + fmt1(d.media) + '</span>' +
        '<span class="dash-destaque-mencoes">' + d.mencoes + ' menç' + (d.mencoes !== 1 ? 'ões' : 'ão') + '</span></div>';
    });
    html += '</div></div>';

    html += '<div class="dash-panel"><h4 class="dash-panel-title">Temas mais solicitados</h4>';
    if (!dados.temasArr.length) {
      html += '<p class="dash-empty">Ninguém marcou temas desejados ainda.</p>';
    } else {
      html += '<div class="dash-temas-lista">';
      dados.temasArr.slice(0, 8).forEach(function (t) {
        html += '<span class="dash-tema-chip">' + esc(t.tema) + ' <strong>' + t.n + '</strong></span>';
      });
      html += '</div>';
    }
    html += '</div>';

    html += '</div>'; /* dash-grid-2 */

    html += '<div class="dash-panel"><h4 class="dash-panel-title">Feedbacks em destaque</h4>';
    if (!dados.feedbacks.length) {
      html += '<p class="dash-empty">Nenhum comentário recebido ainda.</p>';
    } else {
      html += '<div class="dash-feedbacks-lista">';
      dados.feedbacks.forEach(function (f) {
        html += '<div class="dash-feedback-item">“' + esc(f.continuar) + '”' +
          '<span class="ped-admin-meta">— ' + (f.identificado ? esc(f.nomeExibido || 'Participante') : 'Participante') + ' · ' + esc(f.turmaLabel || '') + '</span></div>';
      });
      html += '</div>';
    }
    html += '</div>';

    wrap.innerHTML = html;
  }

  window.faInitDashboard = function () {
    var wrap = document.getElementById('adminDashboard');
    if (!wrap || wrap._dashboardBound) return;
    wrap._dashboardBound = true;
    carregarDados(function (avals, turmasData, participantes) {
      var dados = avals ? calcular(avals, turmasData, participantes) : null;
      render(wrap, dados);
    });
  };
})();
