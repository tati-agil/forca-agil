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

  /* Faixas da distribuição de notas.

     Eram irregulares — "0-1", "2" sozinho, "3-4" — o que dava a impressão
     de uma escala regular que não existia e fazia a barra do "2" parecer
     tão importante quanto a de duas notas juntas.

     Agora são todas de duas notas, com os cortes em 7 e em 9 — os mesmos
     limites usados pelo NPS ao lado (detratores até 6, neutros 7-8,
     promotores 9-10) e pela linha "nota 7 ou acima". A primeira faixa
     carrega três notas porque a escala tem 11 pontos (0 a 10) e não há
     divisão exata; ficou na ponta que quase nunca é usada. */
  var BUCKETS = [
    { label: '0-2',  emoji: '😡', cor: '#ff5252', test: function (n) { return n <= 2; } },
    { label: '3-4',  emoji: '😞', cor: '#f5a623', test: function (n) { return n >= 3 && n <= 4; } },
    { label: '5-6',  emoji: '😐', cor: '#8a93a8', test: function (n) { return n >= 5 && n <= 6; } },
    { label: '7-8',  emoji: '🙂', cor: '#7cb342', test: function (n) { return n >= 7 && n <= 8; } },
    { label: '9-10', emoji: '🤩', cor: '#4caf7d', test: function (n) { return n >= 9; } },
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
      return { label: b.label, emoji: b.emoji, cor: b.cor, n: n, pct: notasValidas.length ? Math.round((n / notasValidas.length) * 1000) / 10 : 0 };
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
      distrib: distrib, pct7mais: pct7mais, notasContadas: notasValidas.length, turmasArr: turmasArr, destaques: destaques,
      temasArr: temasArr, feedbacks: feedbacks,
      /* Dados brutos, para o bloco de respostas individuais */
      avals: avals, turmasData: turmasData,
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

  /* ══════════════════════════════════════════════════════════════════
     COMO É CALCULADO — a memória de cálculo de cada número da tela.

     Sem isso, o painel pede confiança cega: dois números de 0 a 10 lado
     a lado (9,8 e 9,9) vêm de perguntas diferentes, e "NPS +100" não é
     média de nada. Fica no próprio Dashboard, e não só no Manual, para
     poder ser conferido na hora em que o número está sendo olhado.
     ══════════════════════════════════════════════════════════════════ */
  function blocoComoCalcula(d) {
    var itens = [
      ['👥 Participantes',
       'Quantas pessoas estão confirmadas em alguma turma — somando todas as turmas. Conta quem tem inscrição confirmada pela organização e não foi removida. Quem só manifestou interesse não entra.'],
      ['✅ Avaliações recebidas',
       'Quantas avaliações foram enviadas, somando todas as turmas. O percentual ao lado é esse número dividido pelo de Participantes. Atenção: quem responde sem estar confirmado — um admin testando, por exemplo — soma no primeiro número e não no segundo, então o percentual pode passar de 100%.'],
      ['⭐ Média geral',
       'Média simples das notas da pergunta “De 0 a 10, qual nota você daria para a oficina?” (seção 1). Só entra quem respondeu essa pergunta.'],
      ['📈 NPS (recomendação)',
       'NÃO é média. Usa a pergunta “quanto você indicaria esta Oficina para um colega?” (seção 2) e aplica a fórmula de mercado: percentual de quem deu 9 ou 10 MENOS percentual de quem deu de 0 a 6. Quem deu 7 ou 8 não conta para nenhum dos lados. O resultado vai de −100 a +100 — por isso não se compara com as notas de 0 a 10.'],
      ['💬 Comentários',
       'Quantas avaliações têm pelo menos um dos três campos de texto preenchidos: o que devemos continuar fazendo, o que devemos melhorar, ou o espaço aberto. É por avaliação, não por comentário — quem escreveu nos três conta uma vez.'],
      ['📊 Média por turma',
       'A mesma nota da Média geral, separada por turma. Todas as turmas cadastradas aparecem, inclusive as que ainda não têm avaliação — essas ficam com barra em zero, para não sumirem do gráfico.'],
      ['😐 Distribuição das notas',
       'Também a nota da oficina (seção 1), agrupada em cinco faixas de duas notas: 0-2, 3-4, 5-6, 7-8 e 9-10. A primeira carrega três notas porque a escala tem 11 pontos e não há divisão exata. Os cortes em 7 e em 9 são os mesmos usados pelo NPS. Os percentuais são sobre quem respondeu essa pergunta.'],
      ['🎯 Recomendaria a um colega?',
       'O medidor mostra a MÉDIA da pergunta de recomendação (seção 2) — não o NPS. Por isso ele marca ' + fmt1(d.mediaNps) + ' e o card de NPS marca ' + (d.npsScore >= 0 ? '+' : '') + d.npsScore + ': são contas diferentes sobre a mesma pergunta.'],
      ['🏅 Principais destaques',
       'Sai só das notas por seção — organização, conteúdo, facilitadores, dinâmicas e aplicação prática. Nunca de texto livre: o sistema não interpreta o que foi escrito. A média ordena a lista, e “N menções” é quantas pessoas deram 8 ou mais naquela seção.'],
      ['💡 Temas mais solicitados',
       'Contagem de quantas vezes cada tema foi marcado na seção 8 do formulário. Uma pessoa pode marcar vários, então a soma passa do número de avaliações.'],
      ['🗣️ Feedbacks em destaque',
       'Amostra dos três mais recentes que responderam “o que devemos continuar fazendo”. É uma amostra por data, não uma seleção dos melhores — para ler todos, use o bloco Respostas individuais no fim da página.'],
    ];
    var h = '<details class="dash-como"><summary class="dash-como-head">🧮 Como cada número desta tela é calculado</summary>' +
            '<div class="dash-como-body">';
    itens.forEach(function (it) {
      h += '<div class="dash-como-item"><p class="dash-como-titulo">' + it[0] + '</p>' +
           '<p class="dash-como-texto">' + esc(it[1]) + '</p></div>';
    });
    h += '</div></details>';
    return h;
  }

  function statCard(icon, label, value, sub, cor) {
    return '<div class="dash-stat-card" style="--sc:' + cor + '">' +
      '<div class="dash-stat-icon">' + icon + '</div>' +
      '<div class="dash-stat-body"><span class="dash-stat-label">' + esc(label) + '</span>' +
      '<span class="dash-stat-value">' + value + '</span>' +
      (sub ? '<span class="dash-stat-sub">' + sub + '</span>' : '') +
      '</div></div>';
  }

  /* ══════════════════════════════════════════════════════════════════
     RESPOSTAS INDIVIDUAIS — o que cada pessoa respondeu, pergunta a
     pergunta. Os cards de cima são médias; aqui está o dado bruto.

     Sobre a identificação: o formulário promete que o nome só aparece
     para o admin se a pessoa marcar "Quero me identificar". Esta tela
     honra isso — quem não marcou aparece como "Anônimo", com as
     respostas completas mas sem nome nem e-mail.
     ══════════════════════════════════════════════════════════════════ */
  var PERGUNTAS = {
    notaGeral:            'De 0 a 10, qual nota você daria para a oficina?',
    npsNota:              'De 0 a 10, quanto você indicaria esta Oficina para um colega?',
    npsMotivo:            'O que fez você dar essa nota?',
    orgGeral:             'Avaliação geral da organização (0 a 10)',
    orgItens:             'Organização — itens avaliados',
    conteudoRelevancia:   'O conteúdo apresentado foi relevante para você? (0 a 10)',
    conteudoAplicacao:    'O conteúdo foi aplicável ao seu trabalho? (0 a 10)',
    conteudoProfundidade: 'Profundidade do conteúdo',
    conteudoGostou:       'Qual conteúdo você mais gostou?',
    conteudoAprofundar:   'Qual conteúdo você gostaria que fosse aprofundado?',
    facilitadoresNota:    'Avaliação geral dos facilitadores (0 a 10)',
    facItens:             'Facilitadores — itens avaliados',
    facilitadoresGostou:  'O que você mais gostou na condução da oficina?',
    dinamicasNota:        'As dinâmicas ajudaram você a compreender os conceitos? (0 a 10)',
    dinamicasMarcou:      'Qual atividade ou dinâmica mais marcou você?',
    aplicacaoPreparado:   'Você se sente mais preparado para aplicar Agilidade? (0 a 10)',
    aplicacaoPlanos:      'O que você pretende aplicar no seu trabalho?',
    aplicacaoOque:        'Se sim, o quê?',
    temasDesejados:       'Sobre quais temas de Agilidade você gostaria de aprender mais?',
    materiaisDesejados:   'Que materiais você gostaria de encontrar na Força Ágil?',
    materiaisEspecifico:  'Existe algum material específico que você gostaria?',
    ferramentasDesejadas: 'Quais ferramentas você gostaria de aprender a utilizar?',
    ferramentasEspecifica:'Existe alguma ferramenta que você gostaria de ver numa próxima oficina?',
    continuar:            'O que você mais gostou na Oficina de Agilidade?',
    melhorar:             'O que poderia ser melhor na próxima oficina?',
    espacoAberto:         'Tem algo que não perguntamos e você gostaria de compartilhar?',
  };
  /* Campos de controle — não são perguntas, não entram na listagem */
  var NAO_PERGUNTA = ['turmaKey','uKey','turmaLabel','timestamp','userEmail','identificado','nomeExibido'];

  var ORG_LABEL = { planejamento:'Organização e planejamento', horarios:'Cumprimento dos horários',
    comunicacao:'Comunicação antes e durante', clareza:'Clareza da programação',
    estrutura:'Estrutura e ambiente', atividades:'Organização das atividades' };
  var FAC_LABEL = { clareza:'Clareza das explicações', dominio:'Domínio do assunto',
    duvidas:'Capacidade de responder dúvidas', interacao:'Interação com os participantes',
    dinamicas:'Condução das dinâmicas', pratica:'Conexão entre teoria e prática' };

  function valorHtml(campo, v) {
    if (v === null || v === undefined || v === '') return '<span class="resp-vazio">— não respondeu</span>';
    if (Array.isArray(v)) {
      return '<span class="resp-chips">' + v.map(function (x) {
        return '<span class="resp-chip">' + esc(x) + '</span>';
      }).join('') + '</span>';
    }
    if (typeof v === 'object') {
      var mapa = campo === 'orgItens' ? ORG_LABEL : campo === 'facItens' ? FAC_LABEL : null;
      return '<span class="resp-subitens">' + Object.keys(v).map(function (k) {
        return '<span class="resp-subitem"><span>' + esc((mapa && mapa[k]) || k) + '</span>' +
               '<strong>' + esc(String(v[k])) + '</strong></span>';
      }).join('') + '</span>';
    }
    if (typeof v === 'number') return '<span class="resp-nota">' + String(v).replace('.', ',') + '</span>';
    return '<span class="resp-texto">' + esc(String(v)) + '</span>';
  }

  function cardResposta(a, idx) {
    var quem = a.identificado
      ? esc(a.nomeExibido || a.userEmail || 'Participante')
      : 'Anônimo';
    var quando = a.timestamp ? new Date(a.timestamp).toLocaleString('pt-BR') : '';

    /* Ordem das perguntas: a do formulário (a ordem do mapa), e no fim
       qualquer campo novo que ainda não esteja mapeado — assim uma
       pergunta acrescentada ao formulário nunca fica invisível aqui. */
    var ordem = Object.keys(PERGUNTAS).filter(function (k) { return k in a; });
    Object.keys(a).forEach(function (k) {
      if (NAO_PERGUNTA.indexOf(k) === -1 && ordem.indexOf(k) === -1) ordem.push(k);
    });

    var h = '<details class="resp-card"><summary class="resp-head">' +
      '<span class="resp-quem' + (a.identificado ? '' : ' resp-quem--anon') + '">' +
        (a.identificado ? '👤 ' : '🕶️ ') + quem + '</span>' +
      '<span class="resp-turma">' + esc(a.turmaLabel || a.turmaKey || '') + '</span>' +
      '<span class="resp-nota-topo">' + (typeof a.notaGeral === 'number' ? 'nota ' + String(a.notaGeral).replace('.', ',') : '—') + '</span>' +
      '<span class="resp-data">' + esc(quando) + '</span>' +
    '</summary><div class="resp-body">';

    ordem.forEach(function (k) {
      h += '<div class="resp-linha">' +
             '<p class="resp-pergunta">' + esc(PERGUNTAS[k] || k) + '</p>' +
             '<div class="resp-valor">' + valorHtml(k, a[k]) + '</div>' +
           '</div>';
    });
    h += '</div></details>';
    return h;
  }

  function blocoRespostas(avals, turmasData) {
    var h = '<div class="dash-panel dash-panel--full">' +
      '<h4 class="dash-panel-title">Respostas individuais</h4>' +
      '<p class="dash-panel-sub">Tudo o que foi registrado em cada avaliação, pergunta a pergunta. ' +
      'Quem não marcou “Quero me identificar” aparece como Anônimo — as respostas aparecem, o nome não.</p>';

    if (!avals.length) {
      h += '<p class="dash-empty">Nenhuma avaliação recebida ainda.</p></div>';
      return h;
    }

    /* Filtro por turma — as turmas que têm avaliação */
    var turmasComAval = {};
    avals.forEach(function (a) { turmasComAval[a.turmaKey] = a.turmaLabel || (turmasData[a.turmaKey] || {}).label || a.turmaKey; });

    h += '<div class="resp-filtros">' +
      '<label class="resp-filtro">Turma <select class="resp-f-turma"><option value="">Todas as turmas</option>' +
        Object.keys(turmasComAval).map(function (k) {
          return '<option value="' + esc(k) + '">' + esc(turmasComAval[k]) + '</option>';
        }).join('') +
      '</select></label>' +
      '<label class="resp-filtro">Identificação <select class="resp-f-ident">' +
        '<option value="">Todas</option>' +
        '<option value="sim">Só identificadas</option>' +
        '<option value="nao">Só anônimas</option>' +
      '</select></label>' +
      '<span class="resp-contagem"></span>' +
      '<button class="btn btn--sm resp-abrir" type="button">Abrir todas</button>' +
      '<button class="btn btn--sm resp-fechar" type="button">Fechar todas</button>' +
    '</div>';

    h += '<div class="resp-lista"></div></div>';
    return h;
  }

  /* Liga os filtros depois que o HTML foi inserido */
  function ligarRespostas(wrap, avals) {
    var lista = wrap.querySelector('.resp-lista');
    if (!lista) return;
    var selT = wrap.querySelector('.resp-f-turma');
    var selI = wrap.querySelector('.resp-f-ident');
    var cont = wrap.querySelector('.resp-contagem');

    var ordenadas = avals.slice().sort(function (a, b) {
      return String(b.timestamp || '').localeCompare(String(a.timestamp || ''));
    });

    function desenhar() {
      var fs = ordenadas.filter(function (a) {
        if (selT.value && a.turmaKey !== selT.value) return false;
        if (selI.value === 'sim' && !a.identificado) return false;
        if (selI.value === 'nao' && a.identificado) return false;
        return true;
      });
      cont.textContent = fs.length + ' avaliaç' + (fs.length !== 1 ? 'ões' : 'ão');
      lista.innerHTML = fs.length
        ? fs.map(cardResposta).join('')
        : '<p class="dash-empty">Nenhuma avaliação neste filtro.</p>';
    }
    selT.addEventListener('change', desenhar);
    selI.addEventListener('change', desenhar);
    wrap.querySelector('.resp-abrir').addEventListener('click', function () {
      lista.querySelectorAll('details').forEach(function (d) { d.open = true; });
    });
    wrap.querySelector('.resp-fechar').addEventListener('click', function () {
      lista.querySelectorAll('details').forEach(function (d) { d.open = false; });
    });
    desenhar();
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

    html += blocoComoCalcula(dados);

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
    dados.distrib.forEach(function (b) {
      /* Cor vem da própria faixa, não da posição na lista: assim mudar as
         faixas não desalinha as cores silenciosamente. */
      if (b.pct > 0) html += '<span style="width:' + b.pct + '%;background:' + b.cor + '" title="' + b.label + ': ' + fmt1(b.pct) + '%"></span>';
    });
    html += '</div>';
    /* A contagem é a de quem respondeu ESTA pergunta — pode ser menor que o
       total de avaliações, e é sobre ela que os percentuais são calculados. */
    html += '<p class="dash-distrib-resumo">' + dados.notasContadas + ' avaliaç' + (dados.notasContadas !== 1 ? 'ões' : 'ão') +
            ' — ' + fmt1(dados.pct7mais) + '% deram nota 7 ou acima ↑</p>';
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

    html += blocoRespostas(dados.avals || [], dados.turmasData || {});

    wrap.innerHTML = html;
    ligarRespostas(wrap, dados.avals || []);
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
