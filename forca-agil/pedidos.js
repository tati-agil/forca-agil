(function () {
  'use strict';

  /* A ordem é a da tela. "Outros" fica sempre por último: é a saída para o
     que não coube nas outras, e uma saída no meio da lista faz parar de ler
     as opções seguintes.

     A chave é o que fica GRAVADO no banco, então ela nunca muda depois de
     existir — pedido antigo continua apontando para ela. O rótulo é só o que
     se lê na tela e pode ser reescrito à vontade. */
  var TIPOS = [
    { key: 'tema',        label: 'Quero aprender sobre um tema', color: '#9b7fff' },
    { key: 'curso',       label: 'Quero sugerir um curso',       color: '#1ab2ae' },
    { key: 'material',    label: 'Preciso de material',          color: '#4caf7d' },
    { key: 'duvida',      label: 'Tenho uma dúvida',             color: '#f5a623' },
    { key: 'iniciativas', label: 'Quero fazer parte de iniciativas do Time Força Ágil', color: '#e05c7f' },
    { key: 'outros',      label: 'Outros',                       color: '#8a93a8' },
  ];

  /* Confirmação do envio. Ela SUBSTITUI o formulário de propósito — a
     confirmação tem que ser inconfundível, e um formulário vazio de volta na
     tela deixa dúvida se foi ou não foi. Mas quem manda um pedido muitas
     vezes quer mandar outro logo em seguida, e antes a única saída daqui era
     recarregar a página: o site tinha um beco sem saída no fim do caminho
     feliz. O botão abaixo refaz o formulário limpo, sem recarregar nada. */
  function mostrarSucesso(wrap) {
    wrap.innerHTML =
      '<div class="ped-sucesso">' +
        '<p class="ped-sucesso-msg">&#x2713; Pedido enviado! Obrigada &mdash; vamos analisar em breve.</p>' +
        '<p class="ped-sucesso-sub">Ele fica registrado em <strong>Minha &Aacute;rea &rarr; Meus pedidos</strong>, ' +
          'onde d&aacute; pra acompanhar se j&aacute; foi respondido.</p>' +
        '<button type="button" class="btn ped-outro-btn">+ Fazer outro pedido</button>' +
      '</div>';
    wrap.querySelector('.ped-outro-btn').addEventListener('click', function () {
      renderForm(wrap);
      /* Leva o foco pro primeiro tipo: no celular, o formulário reaparece
         acima da dobra e sem isto a pessoa não percebe que ele voltou. */
      var primeiro = wrap.querySelector('.ped-tipo-btn');
      if (primeiro && primeiro.focus) primeiro.focus();
      if (primeiro && primeiro.scrollIntoView) primeiro.scrollIntoView({ block: 'center' });
    });
  }

  /* ── Formulário público (página Ajuda) ── */
  function renderForm(wrap) {
    var tipoSel = null;
    var html = '<div class="ped-form">';
    html += '<div class="ped-tipos">';
    TIPOS.forEach(function (t) {
      html += '<button type="button" class="ped-tipo-btn" data-tipo="' + t.key + '" aria-pressed="false" style="--tc:' + t.color + '">' + t.label + '</button>';
    });
    html += '</div>';
    html += '<textarea class="ped-texto" id="pedTexto" placeholder="Descreva com mais detalhes… (opcional)" rows="4"></textarea>';
    html += '<div class="ped-actions">';
    /* O botão NÃO nasce desabilitado. Nasceu assim, e era esse o bug: sem
       estilo de :disabled, ele ficava idêntico a um botão vivo — tocar nele
       não dava mensagem, não dava erro, não fazia nada. Quem não tinha
       escolhido o tipo concluía que o site estava quebrado, e não havia como
       descobrir o contrário na tela. Agora ele sempre responde ao toque: se
       falta escolher o tipo, quem diz isso é uma frase, não um silêncio. */
    html += '<button type="button" class="btn" id="pedEnviar">Enviar pedido</button>';
    html += '<span class="ped-msg" id="pedMsg"></span>';
    html += '</div>';
    html += '</div>';
    wrap.innerHTML = html;

    var btnEnviar = wrap.querySelector('#pedEnviar');
    var msgEl     = wrap.querySelector('#pedMsg');

    wrap.querySelectorAll('.ped-tipo-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        wrap.querySelectorAll('.ped-tipo-btn').forEach(function (b) {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        tipoSel = btn.dataset.tipo;
        msgEl.textContent = '';
        msgEl.className = 'ped-msg';
      });
    });

    function erro(texto) {
      msgEl.textContent = texto;
      msgEl.className = 'ped-msg ped-msg--erro';
    }
    function destravar() {
      btnEnviar.disabled = false;
      btnEnviar.textContent = 'Enviar pedido';
    }

    btnEnviar.addEventListener('click', function () {
      /* Toda recusa daqui pra baixo FALA. Antes, a única recusa possível era
         o botão desabilitado, que não fala nada. */
      if (!tipoSel) {
        erro('Escolha primeiro o tipo do pedido, ali em cima.');
        var primeiro = wrap.querySelector('.ped-tipo-btn');
        if (primeiro && primeiro.focus) primeiro.focus();
        return;
      }
      var session = window.faAuth && window.faAuth.getSession();
      if (!session) {
        erro('Faça login para enviar um pedido.');
        return;
      }
      var texto = wrap.querySelector('#pedTexto').value.trim();
      btnEnviar.disabled = true;
      btnEnviar.textContent = 'Enviando…';
      msgEl.textContent = '';
      msgEl.className = 'ped-msg';

      /* Uma gravação que nunca responde não pode virar "Enviando…" pra
         sempre. No 4G da sala isso acontece, e calado é indistinguível de
         site quebrado — a mesma lição da tela preta (PR #116). Quem responde
         primeiro ganha: o Firebase ou o relógio. */
      var respondido = false;
      var relogio = setTimeout(function () {
        if (respondido) return;
        respondido = true;
        erro('A conexão está demorando e não deu para confirmar o envio. Toque em "Enviar pedido" de novo.');
        destravar();
      }, 12000);

      var ref = firebase.database().ref('pedidos').push();
      ref.set({
        tipo:        tipoSel,
        descricao:   texto,
        nomeEnviou:  session.name  || '',
        emailEnviou: session.email || '',
        dataEnvio:   new Date().toISOString(),
      }, function (err) {
        if (respondido) return;   /* o relógio já falou; não atropela a mensagem */
        respondido = true;
        clearTimeout(relogio);
        if (err) {
          erro('Erro ao enviar. Tente novamente.');
          destravar();
        } else {
          mostrarSucesso(wrap);
        }
      });
    });
  }

  /* ── Painel Admin ── */
  window.faInitPedidos = function () {
    var wrap = document.getElementById('adminPedidos');
    if (!wrap || wrap._pedidosBound) return;
    wrap._pedidosBound = true;

    var tipoFiltro = 'todos';
    var statusFiltro = 'pendentes'; /* 'pendentes' | 'respondidos' | 'excluidos' | 'todos' */
    var todosPedidos = [];
    var listaAdmins = [];  /* [{name, email}], carregada de fa-admins + super-admins */
    var abrindoAcao = null; /* { key, acao: 'responder' | 'excluir' } | null */

    /* Data em fim de semana conta como 8h da segunda-feira seguinte, pra fins de prazo */
    function normalizarParaDiaUtil(iso) {
      var d = new Date(iso);
      var dow = d.getDay();
      if (dow === 6) { d.setDate(d.getDate() + 2); d.setHours(8, 0, 0, 0); }      /* sábado → segunda 8h */
      else if (dow === 0) { d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); } /* domingo → segunda 8h */
      return d;
    }
    /* Conta dias úteis (seg–sex) estritamente entre duas datas — exclusivo do início, inclusivo do fim */
    function diasUteisEntre(iso1, iso2) {
      if (!iso1 || !iso2) return 0;
      var d1 = normalizarParaDiaUtil(iso1); d1.setHours(0, 0, 0, 0);
      var d2 = normalizarParaDiaUtil(iso2); d2.setHours(0, 0, 0, 0);
      if (d2 <= d1) return 0;
      var count = 0;
      var cur = new Date(d1);
      while (cur < d2) {
        cur.setDate(cur.getDate() + 1);
        var dow = cur.getDay();
        if (dow !== 0 && dow !== 6) count++;
      }
      return count;
    }
    function diasUteisLabel(n) {
      return n + ' dia' + (n !== 1 ? 's' : '') + ' útil' + (n !== 1 ? 'eis' : '');
    }
    /* Formato exigido pelo input datetime-local: YYYY-MM-DDTHH:mm, em horário local */
    function agoraParaDatetimeLocal() {
      var d = new Date();
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      return d.toISOString().slice(0, 16);
    }
    function isoParaDatetimeLocal(iso) {
      var d = new Date(iso);
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      return d.toISOString().slice(0, 16);
    }

    function carregarAdmins(cb) {
      var emailsSuper = window.faSuperAdmins || [];
      Promise.all([
        firebase.database().ref('fa-admins').once('value'),
        Promise.all(emailsSuper.map(function (e) {
          return firebase.database().ref('fa-users/' + e.toLowerCase().replace(/[@.]/g, '_')).once('value');
        })),
      ]).then(function (res) {
        var lista = Object.values(res[0].val() || {}).map(function (a) {
          return { name: a.name || a.email, email: a.email };
        });
        res[1].forEach(function (snap, i) {
          var u = snap.val();
          lista.push({ name: (u && u.name) || emailsSuper[i], email: emailsSuper[i] });
        });
        lista.sort(function (a, b) { return (a.name || '').localeCompare(b.name || '', 'pt'); });
        listaAdmins = lista;
        if (cb) cb();
      });
    }

    function tipoLabel(key) {
      var t = TIPOS.find(function (x) { return x.key === key; });
      return t ? t.label : key;
    }
    function tipoColor(key) {
      var t = TIPOS.find(function (x) { return x.key === key; });
      return t ? t.color : '#888';
    }
    function esc(s) {
      return String(s || '').replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
      });
    }
    function fmtData(iso) {
      if (!iso) return '—';
      var d = new Date(iso);
      return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    /* Nomes vêm gravados em CAIXA ALTA no cadastro — formata só pra saudação do e-mail */
    function primeiroNomeCapitalizado(nomeCompleto) {
      var primeiro = (nomeCompleto || '').trim().split(' ')[0];
      if (!primeiro) return '';
      return primeiro.charAt(0) + primeiro.slice(1).toLowerCase();
    }

    function render() {
      /* "Excluído" NÃO é um status irmão de pendente/respondido — é outra
         dimensão (um excluído era pendente ou respondido antes). Por isso a
         lixeira fica separada, como num cliente de e-mail: os filtros de
         status só operam sobre os ATIVOS, e "Todos" ali significa, sem
         ambiguidade, "todos os ativos". */
      var ativos    = todosPedidos.filter(function (p) { return !p.excluido; });
      var excluidos = todosPedidos.filter(function (p) { return !!p.excluido; });
      var naLixeira = statusFiltro === 'excluidos';

      var STATUS = [
        { key: 'pendentes',   label: 'Pendentes',   test: function (p) { return !p.respondido; } },
        { key: 'respondidos', label: 'Respondidos', test: function (p) { return !!p.respondido; } },
        { key: 'todos',       label: 'Todos',       test: function () { return true; } },
      ];
      var statusAtivo = STATUS.filter(function (s) { return s.key === statusFiltro; })[0] || STATUS[0];

      /* Base da listagem: lixeira ou ativos filtrados por status */
      var base = naLixeira ? excluidos : ativos.filter(statusAtivo.test);
      var filtrados = base.filter(function (p) {
        return tipoFiltro === 'todos' || p.tipo === tipoFiltro;
      });

      var html = '<div class="ped-admin-bar">';
      html += '<span class="ped-admin-total">' + ativos.length + ' pedido' + (ativos.length !== 1 ? 's' : '') + ' ativo' + (ativos.length !== 1 ? 's' : '') + '</span>';
      html += '<div class="ped-status-chips">';
      STATUS.forEach(function (s) {
        var ct = ativos.filter(s.test).length;
        html += '<button class="ped-status-chip' + (statusFiltro === s.key ? ' active' : '') + '" data-status="' + s.key + '">' + s.label + ' <span class="ped-chip-count">(' + ct + ')</span></button>';
      });
      html += '</div>';
      html += '<button class="ped-lixeira-chip' + (naLixeira ? ' active' : '') + '" data-status="excluidos">🗑 Lixeira <span class="ped-chip-count">(' + excluidos.length + ')</span></button>';
      html += '</div>';

      /* Contagens por tipo respeitam o recorte atual (lixeira ou status) */
      html += '<div class="ped-filter-chips ped-filter-chips--tipo">';
      [{ key: 'todos', label: 'Todos os tipos', color: '#aaa' }].concat(TIPOS).forEach(function (t) {
        var ct = t.key === 'todos' ? base.length : base.filter(function (p) { return p.tipo === t.key; }).length;
        html += '<button class="ped-filter-chip' + (tipoFiltro === t.key ? ' active' : '') + '" data-tipo="' + t.key + '" style="--tc:' + t.color + '">' + t.label + ' ';
        html += '<span class="ped-chip-count">(' + ct + ')</span></button>';
      });
      html += '</div>';

      if (naLixeira) {
        html += '<p class="ped-lixeira-aviso">🗑 Mostrando pedidos excluídos. Eles não são apagados do banco — use "↺ Restaurar" para trazer de volta.</p>';
      }

      if (filtrados.length === 0) {
        html += '<p style="color:var(--ink-3);margin-top:24px">Nenhum pedido nessa combinação de filtros.</p>';
      } else {
        html += '<div class="ped-admin-lista">';
        filtrados.slice().reverse().forEach(function (p) {
          var respondido = !!p.respondido;
          var excluido  = !!p.excluido;
          var acao = abrindoAcao && abrindoAcao.key === p._key ? abrindoAcao.acao : null;
          html += '<div class="ped-admin-item' + (respondido ? ' ped-admin-item--respondido' : '') + (excluido ? ' ped-admin-item--excluido' : '') + '">';
          html += '<div class="ped-admin-item-header">';
          html += '<span class="ped-admin-badge" style="--tc:' + tipoColor(p.tipo) + '">' + tipoLabel(p.tipo) + '</span>';
          if (respondido) html += '<span class="ped-admin-badge ped-admin-badge--ok">✓ Respondido</span>';
          if (excluido) html += '<span class="ped-admin-badge ped-admin-badge--excluido">🗑 Excluído</span>';
          html += '<span class="ped-admin-meta">' + (p.nomeEnviou || p.emailEnviou || 'Anônimo') + ' · ' + fmtData(p.dataEnvio) + '</span>';
          html += '</div>';
          if (p.descricao) html += '<p class="ped-admin-desc">' + p.descricao.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</p>';

          /* Reenquadramento fica à vista. Mudar o tipo de um pedido é mexer no
             que a PESSOA escolheu: ela marcou "Outros" e alguém decidiu que
             era outra coisa. Pode ser o certo (o tipo certo nem existia
             quando ela escreveu), mas não pode ser invisível — quem olhar a
             lista depois precisa saber que aquele selo foi posto pelo painel,
             não pela pessoa. */
          if (p.tipoAnterior) {
            html += '<p class="ped-admin-prazo ped-admin-reenquadrado">&#x21C4; Reenquadrado de "' + esc(tipoLabel(p.tipoAnterior)) +
              '" por <strong>' + esc((p.tipoAlteradoPor && p.tipoAlteradoPor.name) || '—') + '</strong> em ' + fmtData(p.tipoAlteradoEm) + '.</p>';
          }

          if (excluido) {
            html += '<p class="ped-admin-prazo ped-admin-prazo--excluido">Excluído por <strong>' + esc(p.excluidoPor && p.excluidoPor.name || '—') +
              '</strong> em ' + fmtData(p.excluidoEm) + '. Justificativa: "' + esc(p.justificativaExclusao || '') + '"</p>';
          } else if (respondido) {
            var dias = diasUteisEntre(p.dataEnvio, p.respondidoEm);
            html += '<p class="ped-admin-prazo ped-admin-prazo--ok">Respondido por <strong>' + esc(p.respondidoPor && p.respondidoPor.name || '—') +
              '</strong> em ' + fmtData(p.respondidoEm) + ' — ' + diasUteisLabel(dias) + ' depois do pedido.</p>';
          } else {
            var diasAberto = diasUteisEntre(p.dataEnvio, new Date().toISOString());
            html += '<p class="ped-admin-prazo' + (diasAberto >= 2 ? ' ped-admin-prazo--atraso' : '') + '">Em aberto há ' + diasUteisLabel(diasAberto) + '.</p>';
          }

          html += '<div class="ped-admin-item-actions">';

          if (acao === 'responder') {
            var emailAtual = (p.respondidoPor && p.respondidoPor.email) || '';
            var quandoAtual = p.respondidoEm ? isoParaDatetimeLocal(p.respondidoEm) : agoraParaDatetimeLocal();
            html += '<span class="ped-admin-select-wrap">';
            html += '<select class="ped-admin-select-quem" data-key="' + p._key + '">';
            html += '<option value="">— quem respondeu? —</option>';
            listaAdmins.forEach(function (a) {
              html += '<option value="' + esc(a.email) + '"' + (a.email === emailAtual ? ' selected' : '') + '>' + esc(a.name) + '</option>';
            });
            html += '</select>';
            html += '<input type="datetime-local" class="ped-admin-input-quando" data-key="' + p._key + '" value="' + quandoAtual + '" />';
            html += '<button class="btn btn--sm btn--primary ped-confirmar-btn" data-key="' + p._key + '">Confirmar</button>';
            html += '<button class="btn btn--sm ped-cancelar-btn">Cancelar</button>';
            html += '</span>';
          } else if (acao === 'excluir') {
            html += '<div class="ped-admin-excluir-form">';
            html += '<select class="ped-admin-select-quem-exclui" data-key="' + p._key + '">';
            html += '<option value="">— quem está excluindo? —</option>';
            listaAdmins.forEach(function (a) {
              html += '<option value="' + esc(a.email) + '">' + esc(a.name) + '</option>';
            });
            html += '</select>';
            html += '<textarea class="ped-admin-justificativa" data-key="' + p._key + '" placeholder="Justificativa da exclusão (obrigatória)…" rows="2"></textarea>';
            html += '<span class="ped-admin-select-wrap">';
            html += '<button class="btn btn--sm btn--danger ped-confirmar-exclusao-btn" data-key="' + p._key + '">🗑 Confirmar exclusão</button>';
            html += '<button class="btn btn--sm ped-cancelar-btn">Cancelar</button>';
            html += '</span>';
            html += '</div>';
          } else if (acao === 'tipo') {
            html += '<div class="ped-admin-tipo-form">';
            html += '<label class="ped-admin-tipo-label" for="pedTipoSel-' + p._key + '">Reenquadrar este pedido como:</label>';
            html += '<select class="ped-admin-select-tipo" id="pedTipoSel-' + p._key + '" data-key="' + p._key + '">';
            TIPOS.forEach(function (t) {
              html += '<option value="' + esc(t.key) + '"' + (t.key === p.tipo ? ' selected' : '') + '>' + esc(t.label) + '</option>';
            });
            html += '</select>';
            html += '<span class="ped-admin-select-wrap">';
            html += '<button class="btn btn--sm btn--primary ped-confirmar-tipo-btn" data-key="' + p._key + '">Salvar tipo</button>';
            html += '<button class="btn btn--sm ped-cancelar-btn">Cancelar</button>';
            html += '</span>';
            html += '</div>';
          } else if (excluido) {
            html += '<button class="btn btn--sm ped-restaurar-btn" data-key="' + p._key + '">↺ Restaurar</button>';
          } else {
            if (p.emailEnviou) {
              var assunto = 'Força Ágil — resposta ao seu pedido (' + tipoLabel(p.tipo) + ')';
              var corpo = 'Olá' + (p.nomeEnviou ? ' ' + primeiroNomeCapitalizado(p.nomeEnviou) : '') + ',\n\n' +
                'Sobre o seu pedido enviado em ' + fmtData(p.dataEnvio) + ' (' + tipoLabel(p.tipo) + '):\n' +
                (p.descricao ? '"' + p.descricao + '"\n\n' : '\n') +
                '---\n\n\n\n' +
                'Um abraço,\nEquipe Força Ágil';
              html += '<a class="btn btn--sm" href="mailto:' + encodeURIComponent(p.emailEnviou) +
                '?subject=' + encodeURIComponent(assunto) + '&body=' + encodeURIComponent(corpo) + '">✉ Responder por e-mail</a>';
            }
            if (respondido) {
              html += '<button class="btn btn--sm ped-editar-btn" data-key="' + p._key + '">✎ Editar</button>';
              html += '<button class="btn btn--sm ped-desmarcar-btn" data-key="' + p._key + '">✕ Desmarcar</button>';
            } else {
              html += '<button class="btn btn--sm ped-marcar-btn" data-key="' + p._key + '">✓ Marcar como respondido</button>';
            }
            html += '<button class="btn btn--sm ped-tipo-btn-admin" data-key="' + p._key + '">&#x21C4; Mudar tipo</button>';
            html += '<button class="btn btn--sm ped-excluir-btn" data-key="' + p._key + '">🗑 Excluir</button>';
          }
          html += '</div>';
          html += '</div>';
        });
        html += '</div>';
      }

      wrap.innerHTML = html;
      wrap.querySelectorAll('.ped-status-chip, .ped-lixeira-chip').forEach(function (btn) {
        btn.addEventListener('click', function () {
          statusFiltro = btn.dataset.status;
          render();
        });
      });
      wrap.querySelectorAll('.ped-filter-chip').forEach(function (btn) {
        btn.addEventListener('click', function () {
          tipoFiltro = btn.dataset.tipo;
          render();
        });
      });
      wrap.querySelectorAll('.ped-marcar-btn, .ped-editar-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          abrindoAcao = { key: btn.dataset.key, acao: 'responder' };
          render();
        });
      });
      wrap.querySelectorAll('.ped-tipo-btn-admin').forEach(function (btn) {
        btn.addEventListener('click', function () {
          abrindoAcao = { key: btn.dataset.key, acao: 'tipo' };
          render();
        });
      });
      wrap.querySelectorAll('.ped-confirmar-tipo-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var key = btn.dataset.key;
          var sel = wrap.querySelector('.ped-admin-select-tipo[data-key="' + key + '"]');
          var novo = sel ? sel.value : '';
          var pedido = todosPedidos.filter(function (x) { return x._key === key; })[0];
          if (!novo || !pedido) return;
          /* Mesmo tipo: fecha e não grava. Gravar aqui carimbaria um
             reenquadramento que não aconteceu, e a linha de histórico passaria
             a dizer que alguém mudou o tipo sem ter mudado nada. */
          if (novo === pedido.tipo) { abrindoAcao = null; render(); return; }
          /* Quem reenquadra é quem está logada. Os outros fluxos desta aba
             perguntam "quem respondeu?"/"quem está excluindo?" porque podem
             ser registrados em nome de outra pessoa, depois do fato.
             Reenquadrar não: é uma correção feita na hora, por quem está
             olhando a tela. */
          var sess = window.faAuth && window.faAuth.getSession();
          abrindoAcao = null;
          firebase.database().ref('pedidos/' + key).update({
            tipo: novo,
            /* Guarda o tipo ORIGINAL, não o imediatamente anterior: depois de
               dois reenquadramentos, o que interessa saber é o que a pessoa
               escolheu — o meio do caminho é história do painel. */
            tipoAnterior: pedido.tipoAnterior || pedido.tipo,
            tipoAlteradoEm: new Date().toISOString(),
            tipoAlteradoPor: sess ? { name: sess.name || sess.email, email: sess.email } : null,
          });
        });
      });
      wrap.querySelectorAll('.ped-excluir-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          abrindoAcao = { key: btn.dataset.key, acao: 'excluir' };
          render();
        });
      });
      wrap.querySelectorAll('.ped-cancelar-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          abrindoAcao = null;
          render();
        });
      });
      wrap.querySelectorAll('.ped-confirmar-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var key = btn.dataset.key;
          var sel = wrap.querySelector('.ped-admin-select-quem[data-key="' + key + '"]');
          var inputQuando = wrap.querySelector('.ped-admin-input-quando[data-key="' + key + '"]');
          var email = sel ? sel.value : '';
          if (!email) { sel.focus(); return; }
          if (!inputQuando || !inputQuando.value) { if (inputQuando) inputQuando.focus(); return; }
          var admin = listaAdmins.filter(function (a) { return a.email === email; })[0];
          var respondidoEm = new Date(inputQuando.value).toISOString();
          abrindoAcao = null;
          firebase.database().ref('pedidos/' + key).update({
            respondido: true,
            respondidoEm: respondidoEm,
            respondidoPor: { name: admin ? admin.name : email, email: email },
          });
        });
      });
      wrap.querySelectorAll('.ped-desmarcar-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          firebase.database().ref('pedidos/' + btn.dataset.key).update({
            respondido: false, respondidoEm: null, respondidoPor: null,
          });
        });
      });
      wrap.querySelectorAll('.ped-confirmar-exclusao-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var key = btn.dataset.key;
          var sel = wrap.querySelector('.ped-admin-select-quem-exclui[data-key="' + key + '"]');
          var textarea = wrap.querySelector('.ped-admin-justificativa[data-key="' + key + '"]');
          var email = sel ? sel.value : '';
          var justificativa = textarea ? textarea.value.trim() : '';
          if (!email) { sel.focus(); return; }
          if (!justificativa) { textarea.focus(); return; }
          var admin = listaAdmins.filter(function (a) { return a.email === email; })[0];
          abrindoAcao = null;
          firebase.database().ref('pedidos/' + key).update({
            excluido: true,
            excluidoEm: new Date().toISOString(),
            excluidoPor: { name: admin ? admin.name : email, email: email },
            justificativaExclusao: justificativa,
          });
        });
      });
      wrap.querySelectorAll('.ped-restaurar-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          firebase.database().ref('pedidos/' + btn.dataset.key).update({
            excluido: false, excluidoEm: null, excluidoPor: null, justificativaExclusao: null,
          });
        });
      });
    }

    carregarAdmins(function () {
      firebase.database().ref('pedidos').on('value', function (snap) {
        todosPedidos = [];
        snap.forEach(function (c) { todosPedidos.push(Object.assign({ _key: c.key }, c.val())); });
        render();
      });
    });
  };

  /* ── Init página Ajuda ── */
  document.addEventListener('DOMContentLoaded', function () {
    var wrap = document.getElementById('pedidosFormWrap');
    if (wrap) renderForm(wrap);
  });

})();
