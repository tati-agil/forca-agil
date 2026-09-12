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

  var SEM_EVENTO = '__sem_evento__';

  /* Quantas pessoas estão confirmadas em CADA turma. Antes era um número só,
     somando tudo; com o escopo por evento/turma ele precisa ser por turma,
     senão o "% de participação" de uma turma seria dividido pelo total de
     inscritos do programa inteiro. */
  function participantesPorTurma(interesseData) {
    var out = {};
    Object.keys(interesseData).forEach(function (turmaKey) {
      var n = 0;
      Object.keys(interesseData[turmaKey] || {}).forEach(function (uKey) {
        var e = interesseData[turmaKey][uKey];
        if (e && !e.removed && e.status === 'inscrito' && e.confirmedByAdmin) n++;
      });
      out[turmaKey] = n;
    });
    return out;
  }

  /* Catálogo de turmas e eventos que alimenta o filtro de escopo.

     Uma avaliação de turma que não existe mais em turmas/ não pode sumir da
     conta: antes ela entrava no total porque nada era filtrado por turma, e
     com o escopo passaria a ser descartada em silêncio — o total mudaria sem
     explicação. Então ela entra no catálogo como turma órfã, no grupo "sem
     evento", com o rótulo que ficou gravado na própria avaliação. */
  function montarCatalogo(turmasData, eventosData, interesseData, avals) {
    var porTurma = participantesPorTurma(interesseData);
    var turmas = Object.keys(turmasData).map(function (tk) {
      var t = turmasData[tk] || {};
      var evKey = t.eventoKey || SEM_EVENTO;
      var ev = eventosData[evKey] || {};
      return {
        key: tk,
        label: t.label || tk,
        eventoKey: evKey,
        eventoNome: ev.nome || (evKey === SEM_EVENTO ? 'Sem evento' : evKey),
        eventoOrder: typeof ev.order === 'number' ? ev.order : 1e9,
        participantes: porTurma[tk] || 0,
        orfa: false,
      };
    });

    var conhecidas = {};
    turmas.forEach(function (t) { conhecidas[t.key] = true; });
    avals.forEach(function (a) {
      if (conhecidas[a.turmaKey]) return;
      conhecidas[a.turmaKey] = true;
      turmas.push({
        key: a.turmaKey,
        label: (a.turmaLabel || a.turmaKey) + ' (turma excluída)',
        eventoKey: SEM_EVENTO,
        eventoNome: 'Sem evento',
        eventoOrder: 1e9,
        participantes: porTurma[a.turmaKey] || 0,
        orfa: true,
      });
    });

    turmas.sort(function (a, b) {
      if (a.eventoOrder !== b.eventoOrder) return a.eventoOrder - b.eventoOrder;
      if (a.eventoNome !== b.eventoNome) return a.eventoNome.localeCompare(b.eventoNome, 'pt');
      return a.label.localeCompare(b.label, 'pt');
    });

    var eventos = [];
    var vistos = {};
    turmas.forEach(function (t) {
      if (!vistos[t.eventoKey]) {
        vistos[t.eventoKey] = { key: t.eventoKey, nome: t.eventoNome, turmas: [] };
        eventos.push(vistos[t.eventoKey]);
      }
      vistos[t.eventoKey].turmas.push(t.key);
    });

    return { turmas: turmas, eventos: eventos };
  }

  function carregarDados(cb) {
    Promise.all([
      firebase.database().ref('avaliacoes').once('value'),
      firebase.database().ref('turmas').once('value'),
      firebase.database().ref('turmas-interesse').once('value'),
      firebase.database().ref('eventos').once('value'),
    ]).then(function (res) {
      var avaliacoesRaw = res[0].val() || {};
      var turmasData    = res[1].val() || {};
      var interesseData = res[2].val() || {};
      var eventosData   = res[3].val() || {};

      var avals = [];
      Object.keys(avaliacoesRaw).forEach(function (turmaKey) {
        Object.keys(avaliacoesRaw[turmaKey] || {}).forEach(function (uKey) {
          avals.push(Object.assign({ turmaKey: turmaKey, uKey: uKey }, avaliacoesRaw[turmaKey][uKey]));
        });
      });

      var cat = montarCatalogo(turmasData, eventosData, interesseData, avals);
      cb({ avals: avals, turmas: cat.turmas, eventos: cat.eventos });
    }).catch(function (err) {
      console.error('[dashboard]', err);
      cb(null);
    });
  }

  function calcular(avals, turmasEscopo, participantes) {
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
    /* Mostra todas as turmas DO ESCOPO, mesmo as que ainda não têm avaliação:
       sumir do gráfico esconderia que a turma existe e não respondeu. Mas elas
       ficam com média nula, não com média zero — zero é uma nota péssima, e
       "ninguém respondeu" não é nota nenhuma. */
    var turmasArr = turmasEscopo.map(function (t) {
      var arr = porTurma[t.key] || [];
      return {
        key: t.key, label: t.label, eventoKey: t.eventoKey, eventoNome: t.eventoNome,
        media: arr.length ? avg(arr, 'notaGeral') : null,
        n: arr.length, participantes: t.participantes,
      };
    });

    /* Mesmas médias agrupadas por evento — é a visão que responde "como foi
       ESTE evento", e cada grupo traz a média do evento inteiro, que não é a
       média das médias das turmas: é calculada sobre todas as avaliações
       dele, senão uma turma de 2 respostas pesaria igual a uma de 30. */
    var gruposArr = [];
    var porEvento = {};
    turmasArr.forEach(function (t) {
      if (!porEvento[t.eventoKey]) {
        porEvento[t.eventoKey] = { key: t.eventoKey, nome: t.eventoNome, turmas: [], avals: [], participantes: 0 };
        gruposArr.push(porEvento[t.eventoKey]);
      }
      porEvento[t.eventoKey].turmas.push(t);
      porEvento[t.eventoKey].avals = porEvento[t.eventoKey].avals.concat(porTurma[t.key] || []);
      porEvento[t.eventoKey].participantes += t.participantes;
    });
    gruposArr.forEach(function (g) {
      g.n = g.avals.length;
      g.media = g.n ? avg(g.avals, 'notaGeral') : null;
      delete g.avals;
    });

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
      distrib: distrib, pct7mais: pct7mais, notasContadas: notasValidas.length,
      turmasArr: turmasArr, gruposArr: gruposArr, destaques: destaques,
      temasArr: temasArr, feedbacks: feedbacks,
      /* Dados brutos, para o bloco de respostas individuais */
      avals: avals,
    };
  }

  /* ── Médias por evento e por turma ──
     Era um gráfico de barras verticais em SVG, com o nome da turma escrito
     embaixo de cada barra. Com uma turma funcionava; com cinco, os nomes se
     sobrepunham e viravam um borrão ilegível ("...ATIVIDADE-Agilidade2 —
     SeTembac3 — Novemb"), e com mais de um evento não havia como saber qual
     barra era de qual evento. Barras horizontais resolvem o problema pela
     forma: o nome tem uma linha inteira para si e a lista cresce para baixo,
     quantas turmas houver. O evento vira o cabeçalho do grupo, com a média
     dele ao lado — a visão por evento e a visão por turma na mesma leitura. */
  var CORES_BARRA = ['#9b7fff', '#4caf7d', '#42a5f5', '#f5c542', '#e8854a', '#e05c7f'];

  function linhaMedia(t, cor) {
    var semDado = t.media === null;
    var pct = semDado ? 0 : Math.max(0, Math.min(100, (t.media / 10) * 100));
    /* Nome em cima, barra embaixo: o painel é a coluna estreita do grid, e
       nome ao lado da barra obrigava a cortar o nome com reticências
       ("TURMA 1 — ..."), que é o mesmo problema de legibilidade de antes
       numa embalagem nova. */
    return '<div class="dash-media-linha' + (semDado ? ' dash-media-linha--vazia' : '') + '">' +
      '<span class="dash-media-nome">' + esc(t.label) + '</span>' +
      '<span class="dash-media-valor">' + (semDado ? '—' : fmt1(t.media)) + '</span>' +
      '<span class="dash-media-trilho"><i style="width:' + pct + '%;background:' + cor + '"></i></span>' +
      '<span class="dash-media-n">' + (semDado ? 'sem avaliação' : t.n + ' avaliaç' + (t.n !== 1 ? 'ões' : 'ão')) + '</span>' +
      '</div>';
  }

  function barrasMedias(gruposArr) {
    if (!gruposArr.length) return '<p class="dash-empty">Nenhuma turma neste escopo.</p>';
    var mostrarGrupo = gruposArr.length > 1;
    var h = '<div class="dash-medias">';
    gruposArr.forEach(function (g, gi) {
      h += '<div class="dash-media-grupo">';
      if (mostrarGrupo) {
        h += '<p class="dash-media-evento">' + esc(g.nome) +
             '<span>' + (g.media === null ? 'sem avaliação' : fmt1(g.media) + ' · ' + g.n + ' avaliaç' + (g.n !== 1 ? 'ões' : 'ão')) + '</span></p>';
      }
      g.turmas.forEach(function (t, ti) {
        h += linhaMedia(t, CORES_BARRA[(mostrarGrupo ? gi : ti) % CORES_BARRA.length]);
      });
      h += '</div>';
    });
    h += '</div>';
    return h;
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
      ['🔍 O escopo (evento e turma)',
       'Os filtros no topo decidem de quais eventos e turmas são TODOS os números desta tela — cards, gráficos, destaques, temas e respostas individuais. Dá para marcar mais de um evento e mais de uma turma ao mesmo tempo, para comparar. Sem nada marcado, a tela mostra tudo junto, como sempre mostrou.'],
      ['👥 Participantes',
       'Quantas pessoas estão confirmadas nas turmas do escopo. Conta quem tem inscrição confirmada pela organização e não foi removida. Quem só manifestou interesse não entra.'],
      ['✅ Avaliações recebidas',
       'Quantas avaliações foram enviadas, somando todas as turmas. O percentual ao lado é esse número dividido pelo de Participantes. Atenção: quem responde sem estar confirmado — um admin testando, por exemplo — soma no primeiro número e não no segundo, então o percentual pode passar de 100%.'],
      ['⭐ Média geral',
       'Média simples das notas da pergunta “De 0 a 10, qual nota você daria para a oficina?” (seção 1). Só entra quem respondeu essa pergunta.'],
      ['📈 NPS (recomendação)',
       'NÃO é média. Usa a pergunta “quanto você indicaria esta Oficina para um colega?” (seção 2) e aplica a fórmula de mercado: percentual de quem deu 9 ou 10 MENOS percentual de quem deu de 0 a 6. Quem deu 7 ou 8 não conta para nenhum dos lados. O resultado vai de −100 a +100 — por isso não se compara com as notas de 0 a 10.'],
      ['💬 Comentários',
       'Quantas avaliações têm pelo menos um dos três campos de texto preenchidos: o que devemos continuar fazendo, o que devemos melhorar, ou o espaço aberto. É por avaliação, não por comentário — quem escreveu nos três conta uma vez.'],
      ['📊 Média por evento e turma',
       'A mesma nota da Média geral, separada por turma e agrupada pelo evento de cada uma. Todas as turmas do escopo aparecem, inclusive as que ainda não têm avaliação — essas mostram um travessão (—) e "sem avaliação", nunca zero: zero é a pior nota possível, e ninguém ter respondido não é nota nenhuma. A média do evento no cabeçalho do grupo é calculada sobre todas as avaliações dele, não é a média das médias das turmas — senão uma turma com 2 respostas pesaria igual a uma com 30.'],
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

  function htmlConteudo(dados) {
    var html = '';
    if (!dados.total) {
      html += '<div class="dash-aviso-vazio">' + (dados.filtrando
        ? '🔍 Nenhuma avaliação neste escopo — os números abaixo estão zerados. Escolha outro evento ou turma no filtro acima.'
        : '📭 Nenhuma avaliação recebida ainda — os números abaixo estão zerados. Libere a avaliação de uma turma na aba Eventos (menu ⋯ → "Liberar avaliação") para começar a receber respostas.') +
        '</div>';
    }

    html += '<div class="dash-stats-row">';
    html += statCard('👥', 'Participantes', dados.participantes, 'Total de inscritos', '#9b7fff');
    /* fmt1 aqui também: este era o único percentual da tela que saía com
       ponto ("27.8%") no meio de outros que já saíam com vírgula. */
    html += statCard('✅', 'Avaliações recebidas', dados.total, fmt1(dados.pctParticipacao) + '% de participação', '#4caf7d');
    html += statCard('⭐', 'Média geral', fmt1(dados.mediaGeral) + ' / 10', dados.mediaGeral >= 8 ? 'Ótimo 🚀' : (dados.mediaGeral >= 6 ? 'Bom' : 'Atenção'), '#f5c542');
    html += statCard('📈', 'NPS (recomendação)', (dados.npsScore >= 0 ? '+' : '') + dados.npsScore, dados.npsScore >= 50 ? 'Zona de excelência' : 'Acompanhar', '#e8854a');
    html += statCard('💬', 'Comentários', dados.comentarios, 'Feedbacks recebidos', '#e05c7f');
    html += '</div>';

    html += blocoComoCalcula(dados);

    html += '<div class="dash-grid-3">';

    html += '<div class="dash-panel"><h4 class="dash-panel-title">' +
            (dados.gruposArr.length > 1 ? 'Média por evento e turma' : 'Média por turma') + '</h4>' +
            barrasMedias(dados.gruposArr) + '</div>';

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

    /* O bloco de respostas monta o próprio filtro de turma a partir das
       avaliações; o mapa serve só de reserva para o rótulo. */
    var rotulos = {};
    dados.turmasArr.forEach(function (t) { rotulos[t.key] = { label: t.label }; });
    html += blocoRespostas(dados.avals || [], rotulos);

    return html;
  }

  /* ══════════════════════════════════════════════════════════════════
     ESCOPO — de quais eventos e turmas são os números da tela.

     Antes o Dashboard só sabia somar tudo: um número só, de todas as
     turmas de todos os eventos juntos. Isso serve enquanto existe uma
     oficina; a partir da segunda, "média 9,8" deixa de responder a
     pergunta que se faz de verdade — como foi ESTA turma, como foi
     ESTE evento, um comparado com o outro.

     A seleção é múltipla de propósito: comparar duas turmas de um mesmo
     evento, ou dois eventos inteiros, é o uso normal. Nenhum chip
     marcado significa "tudo" — é o estado em que a tela abre, igual ao
     que ela mostrava antes.
     ══════════════════════════════════════════════════════════════════ */
  function chip(tipo, key, rotulo, extra, ligado) {
    return '<button type="button" class="dash-chip' + (ligado ? ' is-on' : '') + '"' +
      ' data-tipo="' + tipo + '" data-key="' + esc(key) + '"' +
      ' aria-pressed="' + (ligado ? 'true' : 'false') + '">' + esc(rotulo) +
      (extra ? '<span class="dash-chip-n">' + esc(extra) + '</span>' : '') + '</button>';
  }

  function htmlEscopo(ctx, dados) {
    var evSel = ctx.escopoEv, tuSel = ctx.escopoTu;
    var h = '';

    if (ctx.eventos.length > 1) {
      h += '<div class="dash-escopo-linha"><span class="dash-escopo-rotulo">Evento</span><div class="dash-escopo-chips">';
      h += chip('evento', '', 'Todos', '', !evSel.length);
      ctx.eventos.forEach(function (ev) {
        h += chip('evento', ev.key, ev.nome, ev.turmas.length + (ev.turmas.length !== 1 ? ' turmas' : ' turma'),
                  evSel.indexOf(ev.key) !== -1);
      });
      h += '</div></div>';
    }

    /* As turmas oferecidas são só as dos eventos escolhidos: oferecer uma
       turma que o filtro de cima já excluiu é oferecer um caminho para
       "nenhum resultado". */
    var turmasOferecidas = ctx.turmas.filter(function (t) {
      return !evSel.length || evSel.indexOf(t.eventoKey) !== -1;
    });
    if (turmasOferecidas.length > 1) {
      h += '<div class="dash-escopo-linha"><span class="dash-escopo-rotulo">Turma</span><div class="dash-escopo-chips">';
      h += chip('turma', '', 'Todas', '', !tuSel.length);
      turmasOferecidas.forEach(function (t) {
        h += chip('turma', t.key, t.label,
                  ctx.eventos.length > 1 ? t.eventoNome : '',
                  tuSel.indexOf(t.key) !== -1);
      });
      h += '</div></div>';
    }

    if (h) {
      h += '<p class="dash-escopo-resumo">' + esc(dados.resumoEscopo) +
           (evSel.length || tuSel.length
             ? ' <button type="button" class="dash-escopo-limpar" data-tipo="limpar" data-key="">limpar filtro</button>'
             : '') +
           '</p>';
    }
    return h;
  }

  function resumoDoEscopo(ctx, turmasEscopo, avalsEscopo, participantes) {
    var eventosNoEscopo = {};
    turmasEscopo.forEach(function (t) { eventosNoEscopo[t.eventoKey] = true; });
    var nEv = Object.keys(eventosNoEscopo).length;
    var nTu = turmasEscopo.length;
    var partes = [];
    if (ctx.eventos.length > 1) partes.push(nEv + (nEv !== 1 ? ' eventos' : ' evento'));
    partes.push(nTu + (nTu !== 1 ? ' turmas' : ' turma'));
    partes.push(avalsEscopo.length + (avalsEscopo.length !== 1 ? ' avaliações' : ' avaliação'));
    partes.push(participantes + (participantes !== 1 ? ' inscritos' : ' inscrito'));
    return 'Mostrando: ' + partes.join(' · ');
  }

  function render(wrap, ctx) {
    if (!ctx) { wrap.innerHTML = '<p class="loading-msg" style="color:var(--red)">Erro ao carregar dashboard. Recarregue a página.</p>'; return; }

    wrap.innerHTML = '';
    var barra = document.createElement('div');
    barra.className = 'dash-escopo';
    var conteudo = document.createElement('div');
    conteudo.className = 'dash-conteudo';
    wrap.appendChild(barra);
    wrap.appendChild(conteudo);

    function desenhar() {
      /* Uma turma escolhida que não pertence a nenhum evento escolhido não
         pode continuar filtrando em silêncio. */
      if (ctx.escopoEv.length) {
        ctx.escopoTu = ctx.escopoTu.filter(function (tk) {
          var t = ctx.turmas.filter(function (x) { return x.key === tk; })[0];
          return t && ctx.escopoEv.indexOf(t.eventoKey) !== -1;
        });
      }

      var turmasEscopo = ctx.turmas.filter(function (t) {
        if (ctx.escopoEv.length && ctx.escopoEv.indexOf(t.eventoKey) === -1) return false;
        if (ctx.escopoTu.length && ctx.escopoTu.indexOf(t.key) === -1) return false;
        return true;
      });
      var dentro = {};
      turmasEscopo.forEach(function (t) { dentro[t.key] = true; });
      var avalsEscopo = ctx.avals.filter(function (a) { return dentro[a.turmaKey]; });
      var participantes = turmasEscopo.reduce(function (n, t) { return n + t.participantes; }, 0);

      var dados = calcular(avalsEscopo, turmasEscopo, participantes);
      dados.resumoEscopo = resumoDoEscopo(ctx, turmasEscopo, avalsEscopo, participantes);
      dados.filtrando = !!(ctx.escopoEv.length || ctx.escopoTu.length);

      barra.innerHTML = htmlEscopo(ctx, dados);
      conteudo.innerHTML = htmlConteudo(dados);
      ligarRespostas(conteudo, dados.avals || []);
    }

    barra.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-tipo]');
      if (!btn) return;
      var tipo = btn.dataset.tipo, key = btn.dataset.key;
      if (tipo === 'limpar')      { ctx.escopoEv = []; ctx.escopoTu = []; }
      else if (tipo === 'evento') { ctx.escopoEv = alterna(ctx.escopoEv, key); }
      else if (tipo === 'turma')  { ctx.escopoTu = alterna(ctx.escopoTu, key); }
      else return;
      desenhar();
    });

    desenhar();
  }

  /* Chip sem chave é o "Todos": limpa a dimensão inteira. */
  function alterna(lista, key) {
    if (!key) return [];
    var i = lista.indexOf(key);
    if (i === -1) return lista.concat([key]);
    return lista.slice(0, i).concat(lista.slice(i + 1));
  }

  window.faInitDashboard = function () {
    var wrap = document.getElementById('adminDashboard');
    if (!wrap || wrap._dashboardBound) return;
    wrap._dashboardBound = true;
    carregarDados(function (dados) {
      if (!dados) { render(wrap, null); return; }
      render(wrap, {
        avals: dados.avals, turmas: dados.turmas, eventos: dados.eventos,
        escopoEv: [], escopoTu: [],
      });
    });
  };
})();
