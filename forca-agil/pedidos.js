(function () {
  'use strict';

  var TIPOS = [
    { key: 'tema',     label: 'Quero aprender sobre um tema', color: '#9b7fff' },
    { key: 'curso',    label: 'Quero sugerir um curso',       color: '#1ab2ae' },
    { key: 'material', label: 'Preciso de material',          color: '#4caf7d' },
    { key: 'duvida',   label: 'Tenho uma dúvida',             color: '#f5a623' },
    { key: 'outros',   label: 'Outros',                       color: '#8a93a8' },
  ];

  /* ── Formulário público (página Ajuda) ── */
  function renderForm(wrap) {
    var tipoSel = null;
    var html = '<div class="ped-form">';
    html += '<div class="ped-tipos">';
    TIPOS.forEach(function (t) {
      html += '<button class="ped-tipo-btn" data-tipo="' + t.key + '" style="--tc:' + t.color + '">' + t.label + '</button>';
    });
    html += '</div>';
    html += '<textarea class="ped-texto" id="pedTexto" placeholder="Descreva com mais detalhes… (opcional)" rows="4"></textarea>';
    html += '<div class="ped-actions">';
    html += '<button class="btn btn--gold" id="pedEnviar" disabled>Enviar pedido</button>';
    html += '<span class="ped-msg" id="pedMsg"></span>';
    html += '</div>';
    html += '</div>';
    wrap.innerHTML = html;

    var btnEnviar = wrap.querySelector('#pedEnviar');
    var msgEl     = wrap.querySelector('#pedMsg');

    wrap.querySelectorAll('.ped-tipo-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        wrap.querySelectorAll('.ped-tipo-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        tipoSel = btn.dataset.tipo;
        btnEnviar.disabled = false;
      });
    });

    btnEnviar.addEventListener('click', function () {
      var session = window.faAuth && window.faAuth.getSession();
      if (!session) {
        msgEl.textContent = 'Faça login para enviar um pedido.';
        msgEl.className = 'ped-msg ped-msg--erro';
        return;
      }
      var texto = wrap.querySelector('#pedTexto').value.trim();
      btnEnviar.disabled = true;
      btnEnviar.textContent = 'Enviando…';
      var ref = firebase.database().ref('pedidos').push();
      ref.set({
        tipo:        tipoSel,
        descricao:   texto,
        nomeEnviou:  session.name  || '',
        emailEnviou: session.email || '',
        dataEnvio:   new Date().toISOString(),
      }, function (err) {
        if (err) {
          msgEl.textContent = 'Erro ao enviar. Tente novamente.';
          msgEl.className = 'ped-msg ped-msg--erro';
          btnEnviar.disabled = false;
          btnEnviar.textContent = 'Enviar pedido';
        } else {
          wrap.innerHTML = '<div class="ped-sucesso">✓ Pedido enviado! Obrigada — vamos analisar em breve.</div>';
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
    var todosPedidos = [];

    function tipoLabel(key) {
      var t = TIPOS.find(function (x) { return x.key === key; });
      return t ? t.label : key;
    }
    function tipoColor(key) {
      var t = TIPOS.find(function (x) { return x.key === key; });
      return t ? t.color : '#888';
    }
    function fmtData(iso) {
      if (!iso) return '—';
      var d = new Date(iso);
      return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    function render() {
      var filtrados = tipoFiltro === 'todos'
        ? todosPedidos
        : todosPedidos.filter(function (p) { return p.tipo === tipoFiltro; });

      var html = '<div class="ped-admin-bar">';
      html += '<span class="ped-admin-total">' + todosPedidos.length + ' pedido' + (todosPedidos.length !== 1 ? 's' : '') + ' no total</span>';
      html += '<div class="ped-filter-chips">';
      [{ key: 'todos', label: 'Todos', color: '#aaa' }].concat(TIPOS).forEach(function (t) {
        html += '<button class="ped-filter-chip' + (tipoFiltro === t.key ? ' active' : '') + '" data-tipo="' + t.key + '" style="--tc:' + t.color + '">' + t.label + ' ';
        var ct = t.key === 'todos' ? todosPedidos.length : todosPedidos.filter(function (p) { return p.tipo === t.key; }).length;
        html += '<span class="ped-chip-count">(' + ct + ')</span></button>';
      });
      html += '</div></div>';

      if (filtrados.length === 0) {
        html += '<p style="color:var(--ink-3);margin-top:24px">Nenhum pedido' + (tipoFiltro !== 'todos' ? ' deste tipo' : '') + '.</p>';
      } else {
        html += '<div class="ped-admin-lista">';
        filtrados.slice().reverse().forEach(function (p) {
          var respondido = !!p.respondido;
          html += '<div class="ped-admin-item' + (respondido ? ' ped-admin-item--respondido' : '') + '">';
          html += '<div class="ped-admin-item-header">';
          html += '<span class="ped-admin-badge" style="--tc:' + tipoColor(p.tipo) + '">' + tipoLabel(p.tipo) + '</span>';
          if (respondido) html += '<span class="ped-admin-badge ped-admin-badge--ok">✓ Respondido</span>';
          html += '<span class="ped-admin-meta">' + (p.nomeEnviou || p.emailEnviou || 'Anônimo') + ' · ' + fmtData(p.dataEnvio) + '</span>';
          html += '</div>';
          if (p.descricao) html += '<p class="ped-admin-desc">' + p.descricao.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</p>';
          html += '<div class="ped-admin-item-actions">';
          if (p.emailEnviou) {
            var assunto = 'Força Ágil — resposta ao seu pedido (' + tipoLabel(p.tipo) + ')';
            var corpo = 'Olá' + (p.nomeEnviou ? ' ' + p.nomeEnviou.split(' ')[0] : '') + ',\n\n' +
              'Sobre o seu pedido enviado em ' + fmtData(p.dataEnvio) + ' (' + tipoLabel(p.tipo) + '):\n' +
              (p.descricao ? '"' + p.descricao + '"\n\n' : '\n') +
              '---\n\n';
            html += '<a class="btn btn--sm" href="mailto:' + encodeURIComponent(p.emailEnviou) +
              '?subject=' + encodeURIComponent(assunto) + '&body=' + encodeURIComponent(corpo) + '">✉ Responder por e-mail</a>';
          }
          html += '<button class="btn btn--sm ped-marcar-btn" data-key="' + p._key + '" data-respondido="' + (respondido ? '1' : '0') + '">' +
            (respondido ? '✕ Desmarcar' : '✓ Marcar como respondido') + '</button>';
          html += '</div>';
          html += '</div>';
        });
        html += '</div>';
      }

      wrap.innerHTML = html;
      wrap.querySelectorAll('.ped-filter-chip').forEach(function (btn) {
        btn.addEventListener('click', function () {
          tipoFiltro = btn.dataset.tipo;
          render();
        });
      });
      wrap.querySelectorAll('.ped-marcar-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var key = btn.dataset.key;
          var jaRespondido = btn.dataset.respondido === '1';
          var updates = jaRespondido
            ? { respondido: false, respondidoEm: null }
            : { respondido: true, respondidoEm: new Date().toISOString() };
          firebase.database().ref('pedidos/' + key).update(updates);
        });
      });
    }

    firebase.database().ref('pedidos').on('value', function (snap) {
      todosPedidos = [];
      snap.forEach(function (c) { todosPedidos.push(Object.assign({ _key: c.key }, c.val())); });
      render();
    });
  };

  /* ── Init página Ajuda ── */
  document.addEventListener('DOMContentLoaded', function () {
    var wrap = document.getElementById('pedidosFormWrap');
    if (wrap) renderForm(wrap);
  });

})();
