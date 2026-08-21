/* ============================================================
   Força Ágil — Minha Área (área do participante)

   Reúne, para a pessoa logada, o que hoje só o admin conseguia
   consultar: em qual turma ela está, quantos dias compareceu, se
   atingiu a frequência mínima, o certificado (quando a turma é
   concluída), suas avaliações e seus pedidos.

   A página nunca fica vazia: existe um estado nomeado para cada
   situação possível, na seguinte ordem de precedência —

     1. Confirmada em turma   → cards da turma, agrupados por fase
                                (Em andamento / Programadas / Concluídas)
     2. Interesse em análise  → cartão informando que a confirmação
                                é feita pela organização
     3. Lista de espera       → cartão informando desde quando espera
     4. Nunca interagiu       → boas-vindas + turmas abertas no momento

   Os quatro podem coexistir: alguém pode estar confirmada na Turma 1,
   com interesse em análise na Turma 2 e na espera de um outro evento.
   Só o estado 4 é exclusivo — ele aparece justamente quando não há
   nenhum dos outros.

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

  /* Texto das datas dos encontros ("11, 12, 18, 19 e 20").

     O banco guarda só o array de dias; o campo "dates" NÃO existe lá — é
     calculado na hora pelo faTurmasUtil, que é o que o painel Admin faz.
     Esta tela lia turma.dates direto do banco, ou seja, lia um campo que
     nunca existiu: o resultado era vazio no card e, pior, no certificado
     baixado aqui, que saía sem o período. O mesmo certificado emitido
     pelo painel vinha correto — daí a divergência entre as duas telas. */
  function textoDatas(dias) {
    if (!dias || !dias.length) return '';
    if (window.faTurmasUtil && window.faTurmasUtil.formatDias) {
      var f = window.faTurmasUtil.formatDias(dias.slice().sort());
      if (f && f.dates) return f.dates;
    }
    /* Reserva: se o utilitário não estiver disponível, ainda é melhor
       mostrar os dias do que deixar o certificado sem período. */
    return dias.slice().sort().map(function (d) { return String(d).split('-')[2]; }).join(', ');
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  /* Dias inteiros entre hoje e uma data ISO (positivo = no futuro) */
  function diasAte(iso) {
    var a = new Date(todayISO() + 'T12:00:00');
    var b = new Date(iso + 'T12:00:00');
    if (isNaN(b)) return null;
    return Math.round((b - a) / 86400000);
  }

  function carregar(uKey, email, cb) {
    var db = firebase.database();
    Promise.all([
      db.ref('turmas-interesse').once('value'),
      db.ref('turmas').once('value'),
      db.ref('turmas-config').once('value'),
      db.ref('turmas-checkin').once('value'),
      db.ref('eventos').once('value'),
      db.ref('pedidos').once('value'),
      db.ref('fa-espera').once('value'),
    ]).then(function (r) {
      var d = {
        interesse: r[0].val() || {},
        turmas:    r[1].val() || {},
        config:    r[2].val() || {},
        checkin:   r[3].val() || {},
        eventos:   r[4].val() || {},
        pedidos:   r[5].val() || {},
        espera:    r[6].val() || {},
        avaliacoes: {},
      };
      /* As avaliações são lidas UMA A UMA, só a da própria pessoa em cada
         turma. Ler o nó inteiro exporia as respostas de todo mundo — e as
         regras do banco agora reservam essa leitura para os admins. Aqui
         só interessa saber se ela já respondeu, não o que respondeu. */
      var tks = Object.keys(d.turmas);
      return Promise.all(tks.map(function (tk) {
        return db.ref('avaliacoes/' + tk + '/' + uKey).once('value')
          .then(function (s) { return { tk: tk, respondeu: !!s.val() }; })
          .catch(function () { return { tk: tk, respondeu: false }; });
      })).then(function (res) {
        res.forEach(function (x) {
          if (!x.respondeu) return;
          d.avaliacoes[x.tk] = {};
          d.avaliacoes[x.tk][uKey] = true;
        });
        cb(d);
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

      /* Três fases, nesta ordem de decisão:
         concluída  — o admin encerrou a turma (só aqui existe certificado)
         programada — ainda não chegou a data do primeiro encontro; não faz
                      sentido cobrar frequência de quem ainda não começou
         andamento  — o resto */
      var ordenados = dias.slice().sort();
      var primeiro  = ordenados[0] || '';
      var fase = cfg.encerrada ? 'concluida'
               : (primeiro && primeiro > todayISO()) ? 'programada'
               : 'andamento';

      out.push({
        fase: fase,
        inicio: primeiro,
        faltam: fase === 'programada' ? diasAte(primeiro) : null,
        key: tk,
        label: turma.label || tk,
        datas: textoDatas(turma.dias),
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

  /* Turmas em que a pessoa manifestou interesse mas que ainda não foram
     confirmadas pela organização. Cobre os dois casos: quem clicou em
     "Tenho interesse" (status 'interessado') e quem já foi marcada como
     inscrita mas ainda sem o aval do admin. */
  function interessesPendentes(d, uKey) {
    var out = [];
    Object.keys(d.interesse).forEach(function (tk) {
      var reg = (d.interesse[tk] || {})[uKey];
      if (!reg || reg.removed) return;
      if (reg.status === 'inscrito' && reg.confirmedByAdmin) return;  /* já é turma confirmada */
      if (reg.status === 'removido') return;

      var turma  = d.turmas[tk] || {};
      var cfg    = d.config[tk] || {};
      var evento = turma.eventoKey ? (d.eventos[turma.eventoKey] || {}) : {};
      out.push({
        key: tk,
        label: turma.label || tk,
        datas: textoDatas(turma.dias),
        evento: evento,
        desde: reg.date || '',
        encerrada: !!cfg.encerrada,
      });
    });
    return out.sort(function (a, b) { return (a.label || '').localeCompare(b.label || '', 'pt'); });
  }

  /* Registro da pessoa na lista de espera, se houver */
  function meuRegistroEspera(d, uKey) {
    var reg = d.espera[uKey];
    if (!reg || reg.removed) return null;
    return {
      desde: reg.date || reg.migratedAt || '',
      veioDe: reg.migratedFrom ? ((d.turmas[reg.migratedFrom] || {}).label || reg.migratedFrom) : '',
    };
  }

  /* Turmas em que ainda dá para manifestar interesse — a vitrine de quem
     nunca interagiu convida a fazer justamente isso, então só pode listar
     turma onde o convite tem efeito. Não basta "não encerrada": uma turma
     com o interesse já encerrado pelo admin (finalizada) está lotada, e
     uma que já começou não aceita mais entrada. */
  function turmasAbertas(d) {
    var hoje = todayISO();
    return Object.keys(d.turmas).map(function (tk) {
      var turma = d.turmas[tk] || {};
      var cfg   = d.config[tk] || {};
      var dias  = (turma.dias || []).slice().sort();
      return {
        key: tk,
        label: turma.label || tk,
        datas: textoDatas(turma.dias),
        inicio: dias[0] || '',
        encerrada: !!cfg.encerrada,
        interesseEncerrado: !!cfg.finalizada,
        jaComecou: !!(dias[0] && dias[0] <= hoje),
        evento: turma.eventoKey ? (d.eventos[turma.eventoKey] || {}) : {},
      };
    }).filter(function (t) {
      return !t.encerrada && !t.interesseEncerrado && !t.jaComecou;
    }).sort(function (a, b) { return (a.inicio || '').localeCompare(b.inicio || ''); });
  }

  function cardTurma(t, idx) {
    var h = '<div class="aluno-card">';
    h += '<div class="aluno-card-head">';
    h += '<h3 class="aluno-card-title">' + esc(t.label) + '</h3>';
    var selo = { concluida:  ['aluno-badge--ok',        'Concluída'],
                 programada: ['aluno-badge--programada', 'Programada'],
                 andamento:  ['aluno-badge--andamento',  'Em andamento'] }[t.fase];
    h += '<span class="aluno-badge ' + selo[0] + '">' + selo[1] + '</span>';
    h += '</div>';
    if (t.evento.nome) h += '<p class="aluno-card-sub">' + esc(t.evento.nome) + (t.evento.cargaHoraria ? ' · ' + esc(t.evento.cargaHoraria) + 'h' : '') + '</p>';
    if (t.datas) h += '<p class="aluno-card-sub">Encontros: ' + esc(t.datas) + '</p>';

    /* Turma programada: ainda não começou. Mostrar frequência 0% aqui daria
       a impressão de que a pessoa faltou a tudo — então o bloco de
       frequência e o de certificado dão lugar à contagem para o início. */
    if (t.fase === 'programada') {
      var falta = t.faltam;
      var quando = falta === 0 ? 'É hoje!'
                 : falta === 1 ? 'Começa amanhã'
                 : 'Faltam ' + falta + ' dias';
      h += '<div class="aluno-prox">' +
             '<p class="aluno-prox-msg">🗓️ <strong>' + quando + '</strong> — primeiro encontro em ' + esc(fmtDataLonga(t.inicio)) + '.</p>' +
             '<p class="aluno-prox-info">Sua frequência e o certificado aparecem aqui assim que a turma começar.</p>' +
           '</div>';
      if (t.dias.length) {
        h += '<div class="aluno-dias">';
        t.dias.forEach(function (dia) { h += '<span class="aluno-dia">' + fmtDia(dia) + '</span>'; });
        h += '</div>';
      }
      h += '</div>';
      return h;
    }

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
    var turmas    = minhasTurmas(d, uKey);
    var pendentes = interessesPendentes(d, uKey);
    var espera    = meuRegistroEspera(d, uKey);
    var html = '';

    if (turmas.length) {
      html += '<h3 class="aluno-sec-title">Minhas turmas</h3>';
      /* Ordem pensada pela ação que cada grupo exige: primeiro o que
         está acontecendo agora, depois o que vai acontecer, por último
         o histórico. */
      [['andamento',  'Em andamento'],
       ['programada', 'Programadas'],
       ['concluida',  'Concluídas']].forEach(function (g) {
        var doGrupo = turmas.filter(function (t) { return t.fase === g[0]; });
        if (!doGrupo.length) return;
        html += '<h4 class="aluno-grupo">' + g[1] + ' <span class="aluno-grupo-qtd">' + doGrupo.length + '</span></h4>';
        html += '<div class="aluno-turmas">';
        doGrupo.forEach(function (t, i) { html += cardTurma(t, i); });
        html += '</div>';
      });
    }

    if (pendentes.length) {
      html += '<h3 class="aluno-sec-title">Inscrições em análise</h3>';
      html += '<div class="aluno-turmas">';
      pendentes.forEach(function (p) {
        html += '<div class="aluno-card aluno-card--info">' +
          '<div class="aluno-card-head">' +
            '<h3 class="aluno-card-title">' + esc(p.label) + '</h3>' +
            '<span class="aluno-badge aluno-badge--analise">Em análise</span>' +
          '</div>' +
          (p.evento.nome ? '<p class="aluno-card-sub">' + esc(p.evento.nome) + '</p>' : '') +
          (p.datas ? '<p class="aluno-card-sub">Encontros: ' + esc(p.datas) + '</p>' : '') +
          '<p class="aluno-info-msg">⏳ Interesse registrado' +
            (p.desde ? ' em ' + new Date(p.desde).toLocaleDateString('pt-BR') : '') +
            '. A confirmação da vaga é feita pela organização — quando ela sair, esta turma passa para “Minhas turmas” com sua frequência e o certificado.</p>' +
          (p.encerrada ? '<p class="aluno-info-obs">Esta turma já foi encerrada. Se você não foi confirmado, procure a organização pela página <a href="#ajuda">Ajuda</a>.</p>' : '') +
        '</div>';
      });
      html += '</div>';
    }

    if (espera) {
      html += '<h3 class="aluno-sec-title">Lista de espera</h3>';
      html += '<div class="aluno-card aluno-card--info">' +
        '<div class="aluno-card-head">' +
          '<h3 class="aluno-card-title">Você está na lista de espera</h3>' +
          '<span class="aluno-badge aluno-badge--espera">Na fila</span>' +
        '</div>' +
        '<p class="aluno-info-msg">🕒 Registrado' +
          (espera.desde ? ' desde ' + new Date(espera.desde).toLocaleDateString('pt-BR') : '') +
          (espera.veioDe ? ', vindo da ' + esc(espera.veioDe) : '') +
          '. Assim que abrir vaga em uma próxima turma, a organização entra em contato.</p>' +
      '</div>';
    }

    /* Nada em nenhum dos três estados acima: a pessoa nunca interagiu.
       Em vez de uma frase de "nada aqui", mostra por onde começar. */
    if (!turmas.length && !pendentes.length && !espera) {
      var abertas = turmasAbertas(d);
      html += '<h3 class="aluno-sec-title">Bem-vindo!</h3>';
      html += '<div class="aluno-card aluno-card--info">' +
        '<p class="aluno-info-msg">👋 Esta é a sua área. Assim que você participar de uma turma, é aqui que ficam sua frequência, seu certificado e suas avaliações.</p>';
      if (abertas.length) {
        html += '<p class="aluno-info-obs">Turmas abertas no momento:</p><ul class="aluno-abertas">';
        abertas.forEach(function (t) {
          html += '<li><strong>' + esc(t.label) + '</strong>' +
                  (t.evento.nome ? ' — ' + esc(t.evento.nome) : '') +
                  (t.datas ? ' <span class="aluno-abertas-data">(' + esc(t.datas) + ')</span>' : '') + '</li>';
        });
        html += '</ul>';
      } else {
        html += '<p class="aluno-info-obs">Não há turmas abertas neste momento. Acompanhe a página Turmas — as próximas são anunciadas por lá.</p>';
      }
      html += '<p class="aluno-cta"><a class="btn btn--sm btn--primary" href="#turmas">Ver turmas e manifestar interesse</a></p>';
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

  /* ══════════════════════════════════════════════════════════════════
     VER COMO — só admin.

     O admin não participa das turmas, então a própria Minha Área dele
     mostra o estado de "nunca interagiu". Sem isto, não há como saber
     o que a tela mostra para quem fez o treinamento — nem conferir se
     o certificado está liberado, se a frequência bate, se a avaliação
     aparece. Mesmo padrão de seletores que a Avaliação já usa.

     É só visualização: nada é gravado em nome de outra pessoa. Os
     botões de certificado funcionam, e isso é deliberado — é o mesmo
     arquivo que o admin já emite na aba Certificados, e ver o botão
     funcionando faz parte de conferir a tela.
     ══════════════════════════════════════════════════════════════════ */
  function montarBarraVerComo(wrap, sess) {
    var barra = document.createElement('div');
    barra.className = 'aluno-vercomo';
    barra.innerHTML =
      '<span class="aluno-vercomo-tag">ADMIN</span>' +
      '<label class="aluno-vercomo-campo">Ver esta tela como ' +
        '<select class="aluno-vercomo-sel"><option value="">— eu mesma —</option></select>' +
      '</label>' +
      '<span class="aluno-vercomo-dica">Só visualização — nada é gravado em nome da pessoa.</span>';
    wrap.parentNode.insertBefore(barra, wrap);

    var sel = barra.querySelector('.aluno-vercomo-sel');

    /* Lista todo mundo que aparece nas turmas, com o rótulo dizendo em
       que situação a pessoa está — é justamente isso que o admin quer
       comparar (confirmada, em análise, removida). */
    firebase.database().ref('turmas-interesse').once('value', function (snap) {
      var dados = snap.val() || {};
      firebase.database().ref('turmas').once('value', function (snapT) {
        var turmas = snapT.val() || {};
        var pessoas = {};
        Object.keys(dados).forEach(function (tk) {
          var rotuloTurma = (turmas[tk] || {}).label || tk;
          Object.keys(dados[tk] || {}).forEach(function (uk) {
            var r = dados[tk][uk] || {};
            if (!r.email) return;
            var situacao = r.removed ? 'removida de ' + rotuloTurma
              : (r.status === 'inscrito' && r.confirmedByAdmin) ? 'confirmada em ' + rotuloTurma
              : r.status === 'inscrito' ? 'inscrita sem confirmação em ' + rotuloTurma
              : 'interesse em ' + rotuloTurma;
            if (!pessoas[uk]) pessoas[uk] = { nome: r.name || r.email, email: r.email, situacoes: [] };
            /* Confirmada é a situação mais relevante: vai para a frente */
            if (situacao.indexOf('confirmada') === 0) pessoas[uk].situacoes.unshift(situacao);
            else pessoas[uk].situacoes.push(situacao);
          });
        });
        Object.keys(pessoas)
          .map(function (uk) { return Object.assign({ uk: uk }, pessoas[uk]); })
          .sort(function (a, b) { return (a.nome || '').localeCompare(b.nome || '', 'pt'); })
          .forEach(function (p) {
            var opt = document.createElement('option');
            opt.value = p.uk;
            opt.dataset.email = p.email;
            opt.dataset.nome = p.nome;
            opt.textContent = p.nome + '  ·  ' + p.situacoes[0];
            sel.appendChild(opt);
          });
      });
    });

    sel.addEventListener('change', function () {
      var opt = sel.options[sel.selectedIndex];
      barra.classList.toggle('aluno-vercomo--ativo', !!sel.value);
      if (!sel.value) { carregarE(wrap, emailKey(sess.email), sess.email, sess.name || sess.email, null); return; }
      carregarE(wrap, sel.value, opt.dataset.email, opt.dataset.nome, opt.dataset.nome);
    });
  }

  /* Carrega e desenha a tela para uma pessoa. `verComo` preenchido = o
     admin está olhando a tela de outra pessoa. */
  function carregarE(wrap, uKey, email, nome, verComo) {
    wrap.innerHTML = '<p class="loading-msg">Carregando…</p>';
    carregar(uKey, email, function (d) {
      render(wrap, d, uKey, nome, email);
      if (verComo) {
        wrap.insertAdjacentHTML('afterbegin',
          '<div class="aluno-vercomo-aviso">👁️ Você está vendo a tela como <strong>' + esc(verComo) +
          '</strong> veria. Tudo abaixo é o que aparece para essa pessoa.</div>');
      }
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

    var ehAdmin = window.faAuth.isAdmin && window.faAuth.isAdmin(sess.email);
    if (ehAdmin && !document.querySelector('.aluno-vercomo')) montarBarraVerComo(wrap, sess);

    carregarE(wrap, emailKey(sess.email), sess.email, sess.name || sess.email, null);
  }

  if (window.faRouter && window.faRouter.onPageInit) window.faRouter.onPageInit('minha-area', init);
  window.faMinhaArea = { init: init };
})();
