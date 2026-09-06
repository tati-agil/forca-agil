/* ============================================================
   Força Ágil — Roteiro de Facilitação

   Dados e telas do roteiro de cada evento (roteiro-base, por dia) e da
   personalização de cada turma sobre esse roteiro-base. Carregado antes
   de admin.js e de facilitador.js — os dois usam window.faRoteiro, o
   primeiro para editar o roteiro-base e o roteiro de qualquer turma, o
   segundo para o facilitador ver (e, sendo responsável, editar) o
   roteiro das turmas em que atua. A mesma função de desenho serve os
   dois lugares (renderRoteiroTurma), só muda o `editable` que cada um
   passa — nenhuma tela reimplementa a mesclagem base+customização.

   ── Modelo de dados (Firebase Realtime Database) ──────────────────

     roteiros-evento/<eventoKey>/dias/<diaKey>       = { ordem, titulo, createdAt }
     roteiros-evento/<eventoKey>/atividades/<atvKey> = {
       diaKey, ordem, titulo, tipo,
       horaInicio, horaFim, duracaoMinutos,
       descricao, objetivo, passoAPasso, dicasFacilitador, conexaoAgilidade,
       perguntasDebrief: [..], materiais: [..], preparacaoPrevia, observacoes,
       createdAt, updatedAt
     }

     turmas-equipe/<turmaKey>/<facKey>  = { email, name, papel: 'responsavel'|'facilitador', addedAt, addedBy }
     turmas/<turmaKey>/responsavelFacilitadorKey  = <facKey> — único responsável, por construção
       (campo já existe no mesmo node de "turmas"; ver admin.js openTurmaFormModal)

     turmas-roteiro/<turmaKey>/customizacoes/<atvKey> = { <só os campos alterados>, removida?:true, updatedAt }
     turmas-roteiro/<turmaKey>/exclusivas/<atvKey>    = mesma forma de uma atividade base, + diaKey
     turmas-roteiro/<turmaKey>/facilitacao/<atvKey>   = { principal: facKey|'', apoio: [facKey,...] }

   ── Por que "ordem" no roteiro-base e horário na turma ─────────────
   O roteiro-base usa um campo "ordem" com ▲▼ (like o itinerário do
   evento): faz sentido enquanto o roteiro ainda está em rascunho, sem
   horários definidos. Já a visão da turma (mistura base + customização
   + atividades exclusivas, cada uma podendo ter mudado de horário)
   ordena sempre pelo horário de início. Isso evita ter que decidir "que
   posição ocupa uma atividade exclusiva no meio de atividades base" —
   pergunta que o próprio pedido reconhece como possivelmente complexa
   demais para uma granularidade por posição; pelo relógio, a pergunta
   nem precisa existir: quem decide a ordem é o horário escolhido.
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
  function linhas(txt) {
    return String(txt || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
  }
  function db() { return firebase.database(); }

  /* ---- Diálogos (mesmo visual do admin, duplicado aqui: roteiro.js é
     carregado antes de admin.js e usado também por facilitador.js, então
     não pode depender das funções internas do módulo admin) ---- */
  function alertDialog(mensagem) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:10000';
    var box = document.createElement('div');
    box.className = 'modal-box';
    box.style.cssText = 'max-width:420px;width:90%;padding:28px;display:flex;flex-direction:column;gap:18px';
    box.innerHTML =
      '<p style="font-size:.95rem;line-height:1.6;color:var(--ink);white-space:pre-line">' + esc(mensagem) + '</p>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn btn--primary roteiro-dlg-ok">OK</button></div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function close() { document.body.removeChild(overlay); }
    box.querySelector('.roteiro-dlg-ok').addEventListener('click', close);
    var overlayMousedownFora = false;
    overlay.addEventListener('mousedown', function (e) { overlayMousedownFora = !box.contains(e.target); });
    overlay.addEventListener('click', function (e) { if (overlayMousedownFora && !box.contains(e.target)) close(); });
    overlay.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); close(); } });
  }
  function confirmDialog(mensagem, onYes) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:10000';
    var box = document.createElement('div');
    box.className = 'modal-box';
    box.style.cssText = 'max-width:420px;width:90%;padding:28px;display:flex;flex-direction:column;gap:18px';
    box.innerHTML =
      '<p style="font-size:.95rem;line-height:1.6;color:var(--ink);white-space:pre-line">' + esc(mensagem) + '</p>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px">' +
        '<button class="btn roteiro-dlg-cancel">Cancelar</button>' +
        '<button class="btn btn--primary roteiro-dlg-confirm">Confirmar</button></div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function close() { document.body.removeChild(overlay); }
    box.querySelector('.roteiro-dlg-cancel').addEventListener('click', close);
    var overlayMousedownFora = false;
    overlay.addEventListener('mousedown', function (e) { overlayMousedownFora = !box.contains(e.target); });
    overlay.addEventListener('click', function (e) { if (overlayMousedownFora && !box.contains(e.target)) close(); });
    overlay.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); close(); } });
    box.querySelector('.roteiro-dlg-confirm').addEventListener('click', function () { close(); onYes(); });
  }

  /* Diálogo de duas escolhas reais (não "confirmar/cancelar"): as duas
     opções seguem em frente, cada uma do seu jeito — diferente do
     confirmDialog, cujo Cancelar simplesmente não chama nada. Usado no
     recálculo de horários: "Manter horários" não é desistir, é uma
     decisão válida que também precisa liberar o chamador. */
  function escolhaDialog(mensagem, opcaoA, onA, opcaoB, onB) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:10000';
    var box = document.createElement('div');
    box.className = 'modal-box';
    box.style.cssText = 'max-width:440px;width:90%;padding:28px;display:flex;flex-direction:column;gap:18px';
    box.innerHTML =
      '<p style="font-size:.95rem;line-height:1.6;color:var(--ink);white-space:pre-line">' + esc(mensagem) + '</p>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap">' +
        '<button class="btn roteiro-dlg-b">' + esc(opcaoB) + '</button>' +
        '<button class="btn btn--primary roteiro-dlg-a">' + esc(opcaoA) + '</button></div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function close() { document.body.removeChild(overlay); }
    box.querySelector('.roteiro-dlg-a').addEventListener('click', function () { close(); onA(); });
    box.querySelector('.roteiro-dlg-b').addEventListener('click', function () { close(); onB(); });
    overlay.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); close(); onB(); } });
  }

  /* ══════════════════════════════════════════════════════════════
     DADOS — roteiro-base do evento
     ══════════════════════════════════════════════════════════════ */

  function carregarRoteiroEvento(eventoKey, cb) {
    db().ref('roteiros-evento/' + eventoKey).once('value', function (snap) {
      var val = snap.val() || {};
      var dias = Object.keys(val.dias || {}).map(function (k) {
        return Object.assign({ key: k }, val.dias[k]);
      }).sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0); });
      var atividades = Object.keys(val.atividades || {}).map(function (k) {
        return Object.assign({ key: k }, val.atividades[k]);
      });
      cb(null, { dias: dias, atividades: atividades });
    }, function (err) { cb(err); });
  }

  function atividadesDoDia(atividades, diaKey) {
    return atividades.filter(function (a) { return a.diaKey === diaKey; })
      .sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0); });
  }

  function proximaOrdem(lista) {
    return lista.length ? Math.max.apply(null, lista.map(function (x) { return x.ordem || 0; })) + 10 : 10;
  }

  function criarDia(eventoKey, dias, cb) {
    var ref = db().ref('roteiros-evento/' + eventoKey + '/dias').push();
    ref.set({ ordem: proximaOrdem(dias), titulo: '', createdAt: new Date().toISOString() }, function (err) {
      cb(err, ref.key);
    });
  }
  function renomearDia(eventoKey, diaKey, titulo, cb) {
    db().ref('roteiros-evento/' + eventoKey + '/dias/' + diaKey + '/titulo').set(titulo || '', cb);
  }
  function excluirDia(eventoKey, diaKey, atividadesDesteDia, cb) {
    var updates = {};
    updates['roteiros-evento/' + eventoKey + '/dias/' + diaKey] = null;
    atividadesDesteDia.forEach(function (a) { updates['roteiros-evento/' + eventoKey + '/atividades/' + a.key] = null; });
    db().ref().update(updates, function (err) {
      if (err) return cb(err);
      limparReferenciasOrfas(atividadesDesteDia.map(function (a) { return a.key; }), function () { cb(null); });
    });
  }

  function criarAtividade(eventoKey, diaKey, dados, atividadesDoMesmoDia, cb) {
    var ref = db().ref('roteiros-evento/' + eventoKey + '/atividades').push();
    var payload = Object.assign({}, dados, {
      diaKey: diaKey, ordem: proximaOrdem(atividadesDoMesmoDia),
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    });
    ref.set(payload, function (err) { cb(err, ref.key); });
  }
  function editarAtividade(eventoKey, atividadeKey, dados, cb) {
    var payload = Object.assign({}, dados, { updatedAt: new Date().toISOString() });
    db().ref('roteiros-evento/' + eventoKey + '/atividades/' + atividadeKey).update(payload, cb);
  }
  function excluirAtividade(eventoKey, atividadeKey, cb) {
    db().ref('roteiros-evento/' + eventoKey + '/atividades/' + atividadeKey).remove(function (err) {
      if (err) return cb(err);
      limparReferenciasOrfas([atividadeKey], function () { cb(null); });
    });
  }
  function moverAtividade(eventoKey, atividadeKey, direcao, atividadesDoMesmoDia, cb) {
    var idx = atividadesDoMesmoDia.findIndex(function (a) { return a.key === atividadeKey; });
    var vizinho = direcao === 'up' ? atividadesDoMesmoDia[idx - 1] : atividadesDoMesmoDia[idx + 1];
    if (idx === -1 || !vizinho) return cb(null);
    var atual = atividadesDoMesmoDia[idx];
    var updates = {};
    updates['roteiros-evento/' + eventoKey + '/atividades/' + atual.key + '/ordem'] = vizinho.ordem;
    updates['roteiros-evento/' + eventoKey + '/atividades/' + vizinho.key + '/ordem'] = atual.ordem;
    db().ref().update(updates, cb);
  }
  function duplicarAtividade(eventoKey, atividade, atividadesDoMesmoDia, cb) {
    var ref = db().ref('roteiros-evento/' + eventoKey + '/atividades').push();
    var copia = Object.assign({}, atividade);
    delete copia.key;
    copia.titulo = (copia.titulo || '') + ' (cópia)';
    copia.ordem = proximaOrdem(atividadesDoMesmoDia);
    copia.createdAt = new Date().toISOString();
    copia.updatedAt = copia.createdAt;
    ref.set(copia, function (err) { cb(err, ref.key); });
  }

  /* Turma-roteiro guarda referências a atividadeKey (base). Ao excluir a
     atividade base, ou o dia inteiro, os apontamentos de customização,
     remoção e facilitação que sobrariam órfãos em QUALQUER turma são
     limpos junto — sem isso, a atividade excluída "renasceria" como um
     objeto vazio assim que uma turma tivesse uma customização apontando
     para uma chave que não existe mais. */
  function limparReferenciasOrfas(atividadeKeys, cb) {
    if (!atividadeKeys.length) return cb();
    db().ref('turmas-roteiro').once('value', function (snap) {
      var val = snap.val() || {};
      var updates = {};
      Object.keys(val).forEach(function (turmaKey) {
        var t = val[turmaKey] || {};
        atividadeKeys.forEach(function (ak) {
          if (t.customizacoes && t.customizacoes[ak] !== undefined) updates['turmas-roteiro/' + turmaKey + '/customizacoes/' + ak] = null;
          if (t.facilitacao && t.facilitacao[ak] !== undefined) updates['turmas-roteiro/' + turmaKey + '/facilitacao/' + ak] = null;
        });
      });
      if (!Object.keys(updates).length) return cb();
      db().ref().update(updates, function () { cb(); });
    }, function () { cb(); });
  }

  /* ══════════════════════════════════════════════════════════════
     DADOS — personalização por turma
     ══════════════════════════════════════════════════════════════ */

  function carregarRoteiroTurma(turmaKey, cb) {
    db().ref('turmas-roteiro/' + turmaKey).once('value', function (snap) {
      var val = snap.val() || {};
      cb(null, {
        customizacoes: val.customizacoes || {},
        exclusivas: Object.keys(val.exclusivas || {}).map(function (k) { return Object.assign({ key: k }, val.exclusivas[k]); }),
        facilitacao: val.facilitacao || {}
      });
    }, function (err) { cb(err); });
  }

  /* Só grava os campos que de fato mudaram em relação ao valor atual do
     roteiro-base — é o que faz uma atualização futura do roteiro-base
     continuar aparecendo nos campos que esta turma nunca tocou. */
  function customizarAtividade(turmaKey, atividadeBase, valoresForm, cb) {
    var diff = {};
    Object.keys(valoresForm).forEach(function (campo) {
      var novo = valoresForm[campo];
      var base = atividadeBase[campo];
      var mudou = Array.isArray(novo) ? JSON.stringify(novo) !== JSON.stringify(base || []) : novo !== (base || (typeof novo === 'number' ? 0 : ''));
      if (mudou) diff[campo] = novo;
    });
    if (!Object.keys(diff).length) {
      return db().ref('turmas-roteiro/' + turmaKey + '/customizacoes/' + atividadeBase.key).remove(cb);
    }
    diff.updatedAt = new Date().toISOString();
    db().ref('turmas-roteiro/' + turmaKey + '/customizacoes/' + atividadeBase.key).set(diff, cb);
  }
  function restaurarAtividade(turmaKey, atividadeKey, cb) {
    db().ref('turmas-roteiro/' + turmaKey + '/customizacoes/' + atividadeKey).remove(cb);
  }
  function removerAtividadeDaTurma(turmaKey, atividadeKey, cb) {
    db().ref('turmas-roteiro/' + turmaKey + '/customizacoes/' + atividadeKey).update(
      { removida: true, updatedAt: new Date().toISOString() }, cb);
  }

  function criarAtividadeExclusiva(turmaKey, diaKey, dados, cb) {
    var ref = db().ref('turmas-roteiro/' + turmaKey + '/exclusivas').push();
    var payload = Object.assign({}, dados, { diaKey: diaKey, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    ref.set(payload, function (err) { cb(err, ref.key); });
  }
  function editarAtividadeExclusiva(turmaKey, atividadeKey, dados, cb) {
    db().ref('turmas-roteiro/' + turmaKey + '/exclusivas/' + atividadeKey).update(
      Object.assign({}, dados, { updatedAt: new Date().toISOString() }), cb);
  }
  function excluirAtividadeExclusiva(turmaKey, atividadeKey, cb) {
    var updates = {};
    updates['turmas-roteiro/' + turmaKey + '/exclusivas/' + atividadeKey] = null;
    updates['turmas-roteiro/' + turmaKey + '/facilitacao/' + atividadeKey] = null;
    db().ref().update(updates, cb);
  }
  function salvarFacilitacaoAtividade(turmaKey, atividadeKey, principal, apoio, cb) {
    db().ref('turmas-roteiro/' + turmaKey + '/facilitacao/' + atividadeKey).set(
      { principal: principal || '', apoio: apoio || [] }, cb);
  }

  /* ══════════════════════════════════════════════════════════════
     DADOS — equipe de facilitação da turma
     ══════════════════════════════════════════════════════════════ */

  function carregarEquipeTurma(turmaKey, cb) {
    db().ref('turmas-equipe/' + turmaKey).once('value', function (snap) {
      var val = snap.val() || {};
      var lista = Object.keys(val).map(function (k) { return Object.assign({ key: k }, val[k]); });
      lista.sort(function (a, b) {
        if ((a.papel === 'responsavel') !== (b.papel === 'responsavel')) return a.papel === 'responsavel' ? -1 : 1;
        return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR', { sensitivity: 'base' });
      });
      cb(null, lista);
    }, function (err) { cb(err); });
  }

  /* Ler turmas-equipe inteiro de uma vez (usado pela ficha "Ver" de um
     facilitador no admin e pela Área do Facilitador) — o nó é pequeno
     (uma linha por pessoa por turma), então ler tudo e filtrar no
     cliente é mais simples que indexar por facilitador no banco. */
  function carregarEquipeGlobal(cb) {
    db().ref('turmas-equipe').once('value', function (snap) { cb(null, snap.val() || {}); }, function (err) { cb(err); });
  }

  function definirResponsavel(turmaKey, facilitador, responsavelAnteriorKey, cb) {
    var updates = {};
    updates['turmas/' + turmaKey + '/responsavelFacilitadorKey'] = facilitador.key;
    updates['turmas-equipe/' + turmaKey + '/' + facilitador.key] = {
      email: facilitador.email, name: facilitador.name, papel: 'responsavel', addedAt: new Date().toISOString()
    };
    if (responsavelAnteriorKey && responsavelAnteriorKey !== facilitador.key) {
      updates['turmas-equipe/' + turmaKey + '/' + responsavelAnteriorKey + '/papel'] = 'facilitador';
    }
    db().ref().update(updates, cb);
  }
  function adicionarFacilitadorApoio(turmaKey, facilitador, cb) {
    db().ref('turmas-equipe/' + turmaKey + '/' + facilitador.key).set(
      { email: facilitador.email, name: facilitador.name, papel: 'facilitador', addedAt: new Date().toISOString() }, cb);
  }
  function removerDaEquipe(turmaKey, facilitadorKey, eraResponsavel, cb) {
    var updates = {};
    updates['turmas-equipe/' + turmaKey + '/' + facilitadorKey] = null;
    if (eraResponsavel) updates['turmas/' + turmaKey + '/responsavelFacilitadorKey'] = null;
    db().ref().update(updates, cb);
  }

  /* ══════════════════════════════════════════════════════════════
     MESCLAGEM — roteiro efetivo de uma turma (base + customização)
     ══════════════════════════════════════════════════════════════ */

  /* dia N do roteiro-base -> data real da turma, reaproveitando o array
     turma.dias (já existe, já é o que qualquer outra tela usa pra saber
     as datas de encontro) em vez de guardar uma data por dia do roteiro. */
  function dataDoDia(turma, indice) {
    var dias = (turma.dias || []).slice().sort();
    return dias[indice] || '';
  }

  function carregarRoteiroEfetivoTurma(turma, cb) {
    carregarRoteiroEvento(turma.eventoKey, function (err, base) {
      if (err) return cb(err);
      carregarRoteiroTurma(turma.key, function (err2, custom) {
        if (err2) return cb(err2);
        var out = base.dias.map(function (dia, i) {
          var atividadesBase = atividadesDoDia(base.atividades, dia.key);
          var efetivas = [];
          var removidas = [];
          atividadesBase.forEach(function (a) {
            var c = custom.customizacoes[a.key];
            if (c && c.removida) { removidas.push(a); return; }
            var efetiva = c ? Object.assign({}, a, c) : a;
            efetivas.push(Object.assign({}, efetiva, { key: a.key, _status: c ? 'alterada' : 'padrao', _facilitacao: custom.facilitacao[a.key] || null, _base: a }));
          });
          custom.exclusivas.filter(function (x) { return x.diaKey === dia.key; }).forEach(function (x) {
            efetivas.push(Object.assign({}, x, { _status: 'exclusiva', _facilitacao: custom.facilitacao[x.key] || null }));
          });
          efetivas.sort(function (a, b) {
            if (a.horaInicio && b.horaInicio && a.horaInicio !== b.horaInicio) return a.horaInicio < b.horaInicio ? -1 : 1;
            if (a.horaInicio && !b.horaInicio) return -1;
            if (!a.horaInicio && b.horaInicio) return 1;
            return (a.ordem || 0) - (b.ordem || 0);
          });
          return { key: dia.key, ordem: dia.ordem, titulo: dia.titulo, numero: i + 1, data: dataDoDia(turma, i), atividades: efetivas, removidas: removidas };
        });
        cb(null, out);
      });
    });
  }

  /* ══════════════════════════════════════════════════════════════
     UI — form de atividade (compartilhado: base, customização, exclusiva)
     ══════════════════════════════════════════════════════════════ */

  var TIPOS = ['Abertura', 'Conteúdo', 'Dinâmica', 'Discussão', 'Atividade em grupo', 'Exercício', 'Debrief', 'Intervalo', 'Fechamento', 'Outro'];

  function bloco(titulo, innerHtml) {
    return '<div class="roteiro-form-bloco">' +
      '<h5 style="margin:18px 0 10px;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);font-family:var(--font-head)">' + esc(titulo) + '</h5>' +
      innerHtml + '</div>';
  }
  function campoTexto(id, label, valor, placeholder) {
    return '<label class="auth-label">' + esc(label) +
      '<input type="text" id="' + id + '" placeholder="' + esc(placeholder || '') + '" value="' + esc(valor || '') + '" autocomplete="off" /></label>';
  }
  function campoArea(id, label, valor, placeholder, linhasMin) {
    return '<label class="auth-label">' + esc(label) +
      '<textarea id="' + id + '" rows="' + (linhasMin || 3) + '" placeholder="' + esc(placeholder || '') +
      '" style="width:100%;padding:8px 10px;background:var(--panel-2);border:1px solid var(--line-strong);border-radius:6px;color:var(--ink);font-family:var(--font-body);resize:vertical">' +
      esc(valor || '') + '</textarea></label>';
  }

  function abrirFormAtividade(opts) {
    /* opts: { titulo, existente, onSalvar(dados), onExcluir? } */
    var a = opts.existente || {};
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9999';
    var box = document.createElement('div');
    box.className = 'modal-box';
    box.style.cssText = 'max-width:640px;width:92%;padding:28px;display:flex;flex-direction:column;gap:4px;max-height:88vh;overflow:auto';

    var tipoOpts = TIPOS.map(function (t) { return '<option value="' + esc(t) + '"' + (a.tipo === t ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('');

    box.innerHTML =
      '<h3 style="font-size:1.1rem;font-family:var(--font-head);letter-spacing:.05em;color:var(--ink)">' + esc(opts.titulo) + '</h3>' +
      bloco('Identificação',
        campoTexto('rfTitulo', 'Título', a.titulo, 'Ex: Dinâmica VUCA/BANI') +
        '<label class="auth-label">Tipo de atividade<select id="rfTipo" style="width:100%;padding:8px 10px;background:var(--panel-2);border:1px solid var(--line-strong);border-radius:6px;color:var(--ink)"><option value="">—</option>' + tipoOpts + '</select></label>') +
      bloco('Tempo',
        '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
          '<label class="auth-label" style="flex:1;min-width:110px">Início<input type="time" id="rfInicio" value="' + esc(a.horaInicio || '') + '" /></label>' +
          '<label class="auth-label" style="flex:1;min-width:110px">Fim<input type="time" id="rfFim" value="' + esc(a.horaFim || '') + '" /></label>' +
          '<label class="auth-label" style="flex:1;min-width:110px">Duração (min)<input type="number" min="0" id="rfDuracao" value="' + esc(a.duracaoMinutos || '') + '" /></label>' +
        '</div>' +
        '<p style="font-size:.72rem;color:var(--ink-3);margin-top:4px">Preencha início + duração, início + fim, ou fim + duração — o terceiro campo se completa sozinho.</p>') +
      bloco('Sub-etapas (opcional)',
        '<p style="font-size:.72rem;color:var(--ink-3);margin:0 0 8px">Transforma esta atividade numa seção: as sub-etapas aparecem recuadas por baixo dela, e a duração da seção passa a ser a soma das sub-etapas.</p>' +
        '<div id="rfSubList" style="display:flex;flex-direction:column;gap:6px"></div>' +
        '<button type="button" class="btn btn--sm" id="rfSubAddBtn" style="margin-top:8px;padding:5px 12px;font-size:.72rem">+ Sub-etapa</button>' +
        '<p id="rfSubTotal" style="font-size:.72rem;color:var(--ink-3);margin-top:6px"></p>') +
      bloco('Propósito',
        campoArea('rfDescricao', 'Descrição', a.descricao, 'O que acontece nesta atividade') +
        campoArea('rfObjetivo', 'Objetivo', a.objetivo, 'O que queremos que os participantes percebam, aprendam ou experimentem?') +
        campoArea('rfConexao', 'Conexão com a mentalidade ágil', a.conexaoAgilidade, 'Por que esta atividade existe')) +
      bloco('Como conduzir',
        campoArea('rfPasso', 'Passo a passo (uma linha por passo)', (a.passoAPasso || ''), '1. Explique a missão...', 5) +
        campoArea('rfDicas', 'Dicas para o facilitador', a.dicasFacilitador, 'O que evitar, o que reforçar') +
        campoArea('rfDebrief', 'Perguntas para o debrief (uma por linha)', (a.perguntasDebrief || []).join('\n'), 'O que mudou quando...?', 4)) +
      bloco('Recursos',
        campoArea('rfMateriais', 'Materiais necessários (um por linha)', (a.materiais || []).join('\n'), '30 cartões\npost-its', 3) +
        campoArea('rfPreparacao', 'Preparação prévia', a.preparacaoPrevia, 'O que preparar antes de começar')) +
      bloco('Observações', campoArea('rfObs', 'Observações', a.observacoes, '')) +
      '<p id="rfErr" style="color:var(--red,#ff3b30);font-size:.85rem;display:none;margin-top:10px"></p>' +
      '<div style="display:flex;justify-content:space-between;gap:8px;margin-top:16px">' +
        (opts.onExcluir ? '<button class="btn roteiro-form-excluir" style="border-color:rgba(255,80,80,.5);color:#ff8080">Excluir</button>' : '<span></span>') +
        '<div style="display:flex;gap:8px">' +
          '<button class="btn roteiro-form-cancelar">Cancelar</button>' +
          '<button class="btn btn--primary roteiro-form-salvar">Salvar</button>' +
        '</div>' +
      '</div>';

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    var $ = function (sel) { return box.querySelector(sel); };
    var inicioEl = $('#rfInicio'), fimEl = $('#rfFim'), duracaoEl = $('#rfDuracao');

    [inicioEl, fimEl, duracaoEl].forEach(function (el) {
      el.addEventListener('change', function () {
        var i = hhmmParaMin(inicioEl.value), f = hhmmParaMin(fimEl.value), d = duracaoEl.value ? Number(duracaoEl.value) : null;
        if (el === duracaoEl && i !== null && d !== null) fimEl.value = minParaHhmm(i + d);
        else if (el === duracaoEl && f !== null && d !== null) inicioEl.value = minParaHhmm(f - d);
        else if (el === inicioEl && d !== null) fimEl.value = minParaHhmm(i + d);
        else if (el === inicioEl && f !== null) duracaoEl.value = Math.max(0, f - i);
        else if (el === fimEl && i !== null) duracaoEl.value = Math.max(0, f - i);
        else if (el === fimEl && d !== null) inicioEl.value = minParaHhmm(f - d);
      });
    });

    /* Sub-etapas: cada uma é só título + duração (spec: filhas não têm
       horário próprio, só a seção-pai tem início/fim). A duração da seção
       vira somada e travada assim que existe pelo menos uma sub-etapa —
       é o que garante "TOTAL DO BLOCO" nunca diferir da soma das filhas. */
    var subList = $('#rfSubList'), subTotalEl = $('#rfSubTotal'), subAddBtn = $('#rfSubAddBtn');
    function recalcularSub() {
      var linhasEl = Array.prototype.slice.call(subList.querySelectorAll('.rf-sub-row'));
      var total = linhasEl.reduce(function (s, row) { return s + (Number(row.querySelector('.rf-sub-dur').value) || 0); }, 0);
      if (linhasEl.length) {
        duracaoEl.value = total; duracaoEl.readOnly = true; duracaoEl.style.opacity = '.6';
        subTotalEl.textContent = 'Total das sub-etapas: ' + total + ' min (duração da seção, calculada automaticamente).';
        var i = hhmmParaMin(inicioEl.value);
        if (i !== null) fimEl.value = minParaHhmm(i + total);
      } else {
        duracaoEl.readOnly = false; duracaoEl.style.opacity = ''; subTotalEl.textContent = '';
      }
    }
    function addSubRow(sub) {
      var row = document.createElement('div');
      row.className = 'rf-sub-row';
      row.style.cssText = 'display:flex;gap:8px;align-items:center';
      row.innerHTML =
        '<input type="text" class="rf-sub-titulo" placeholder="Título da sub-etapa" value="' + esc((sub && sub.titulo) || '') + '" style="flex:1;padding:6px 10px;background:var(--panel-2);border:1px solid var(--line-strong);border-radius:6px;color:var(--ink)" />' +
        '<input type="number" min="0" class="rf-sub-dur" placeholder="min" value="' + esc((sub && sub.duracaoMinutos) || '') + '" style="width:70px;padding:6px 8px;background:var(--panel-2);border:1px solid var(--line-strong);border-radius:6px;color:var(--ink)" />' +
        '<button type="button" class="btn btn--sm rf-sub-remove" style="padding:4px 8px">✕</button>';
      row.querySelector('.rf-sub-dur').addEventListener('input', recalcularSub);
      row.querySelector('.rf-sub-remove').addEventListener('click', function () { row.remove(); recalcularSub(); });
      subList.appendChild(row);
    }
    (a.subatividades || []).forEach(addSubRow);
    recalcularSub();
    subAddBtn.addEventListener('click', function () { addSubRow(); recalcularSub(); });

    function closeModal() { document.body.removeChild(overlay); }
    $('.roteiro-form-cancelar').addEventListener('click', closeModal);
    var overlayMousedownFora = false;
    overlay.addEventListener('mousedown', function (e) { overlayMousedownFora = !box.contains(e.target); });
    overlay.addEventListener('click', function (e) { if (overlayMousedownFora && !box.contains(e.target)) closeModal(); });
    overlay.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); closeModal(); } });
    if (opts.onExcluir) {
      $('.roteiro-form-excluir').addEventListener('click', function () {
        confirmDialog('Excluir esta atividade? Não é possível desfazer.', function () { opts.onExcluir(); closeModal(); });
      });
    }
    $('.roteiro-form-salvar').addEventListener('click', function () {
      var titulo = $('#rfTitulo').value.trim();
      var errEl = $('#rfErr');
      errEl.style.display = 'none';
      if (!titulo) { errEl.textContent = 'Dê um título à atividade.'; errEl.style.display = ''; return; }
      var i = hhmmParaMin(inicioEl.value), f = hhmmParaMin(fimEl.value);
      if (i !== null && f !== null && f < i) { errEl.textContent = 'O horário final não pode ser antes do inicial.'; errEl.style.display = ''; return; }
      var subatividades = Array.prototype.map.call(subList.querySelectorAll('.rf-sub-row'), function (row) {
        return { titulo: row.querySelector('.rf-sub-titulo').value.trim(), duracaoMinutos: Math.max(0, Number(row.querySelector('.rf-sub-dur').value) || 0) };
      }).filter(function (s) { return s.titulo; });
      var dados = {
        titulo: titulo, tipo: $('#rfTipo').value,
        horaInicio: inicioEl.value || '', horaFim: fimEl.value || '',
        duracaoMinutos: duracaoEl.value ? Math.max(0, Number(duracaoEl.value)) : 0,
        subatividades: subatividades,
        descricao: $('#rfDescricao').value.trim(), objetivo: $('#rfObjetivo').value.trim(),
        passoAPasso: $('#rfPasso').value.trim(), dicasFacilitador: $('#rfDicas').value.trim(),
        conexaoAgilidade: $('#rfConexao').value.trim(),
        perguntasDebrief: linhas($('#rfDebrief').value), materiais: linhas($('#rfMateriais').value),
        preparacaoPrevia: $('#rfPreparacao').value.trim(), observacoes: $('#rfObs').value.trim()
      };
      opts.onSalvar(dados, duracaoEfetiva(a));
      closeModal();
    });
  }

  /* ══════════════════════════════════════════════════════════════
     MÉTRICAS DO DIA — janela, tempo programado, facilitação líquida,
     pausas, lacunas. Usado pelo roteiro-base (admin) e pelo roteiro
     efetivo da turma — mesma conta nos dois lugares.

     INTERVALO x LACUNA (não confundir): intervalo é uma atividade do
     tipo "Intervalo", cadastrada de propósito — conta como tempo
     programado e como pausa, mas não como facilitação líquida. Lacuna
     é o buraco entre duas atividades vizinhas sem nada cadastrado no
     meio — não é atividade, não conta como programado nem como pausa,
     só soma na janela do dia. Por isso sempre vale:
       janela = programado + lacunas
       programado = facilitação líquida + pausas
     ══════════════════════════════════════════════════════════════ */

  function hhmmParaMin(hhmm) {
    if (!hhmm) return null;
    var p = String(hhmm).split(':');
    return (+p[0]) * 60 + (+p[1]);
  }
  function minParaHhmm(min) {
    min = ((min % 1440) + 1440) % 1440;
    return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
  }
  function fmtDuracao(min) {
    min = Math.round(min || 0);
    if (min <= 0) return '0 min';
    var h = Math.floor(min / 60), m = min % 60;
    if (!h) return m + ' min';
    return h + 'h' + (m ? String(m).padStart(2, '0') : '');
  }
  function duracaoEfetiva(a) {
    if (a && a.subatividades && a.subatividades.length) {
      return a.subatividades.reduce(function (s, x) { return s + (Number(x.duracaoMinutos) || 0); }, 0);
    }
    return (a && Number(a.duracaoMinutos)) || 0;
  }

  function calcularResumoDia(atividadesTopo) {
    var comHorario = atividadesTopo.filter(function (a) { return a.horaInicio; })
      .slice().sort(function (a, b) { return hhmmParaMin(a.horaInicio) - hhmmParaMin(b.horaInicio); });
    var programadoMin = atividadesTopo.reduce(function (s, a) { return s + duracaoEfetiva(a); }, 0);
    var pausasMin = atividadesTopo.filter(function (a) { return a.tipo === 'Intervalo'; })
      .reduce(function (s, a) { return s + duracaoEfetiva(a); }, 0);
    var gaps = [];
    for (var i = 1; i < comHorario.length; i++) {
      var fimAnterior = hhmmParaMin(comHorario[i - 1].horaFim) != null ? hhmmParaMin(comHorario[i - 1].horaFim) : hhmmParaMin(comHorario[i - 1].horaInicio) + duracaoEfetiva(comHorario[i - 1]);
      var inicioAtual = hhmmParaMin(comHorario[i].horaInicio);
      if (inicioAtual > fimAnterior) gaps.push({ inicioMin: fimAnterior, fimMin: inicioAtual, min: inicioAtual - fimAnterior });
    }
    var lacunasMin = gaps.reduce(function (s, g) { return s + g.min; }, 0);
    var janelaInicioMin = comHorario.length ? hhmmParaMin(comHorario[0].horaInicio) : null;
    var ultimo = comHorario[comHorario.length - 1];
    var janelaFimMin = ultimo ? (hhmmParaMin(ultimo.horaFim) != null ? hhmmParaMin(ultimo.horaFim) : hhmmParaMin(ultimo.horaInicio) + duracaoEfetiva(ultimo)) : null;
    return {
      janelaInicioMin: janelaInicioMin, janelaFimMin: janelaFimMin,
      janelaMin: (janelaInicioMin != null && janelaFimMin != null) ? (janelaFimMin - janelaInicioMin) : null,
      programadoMin: programadoMin, pausasMin: pausasMin, facilitacaoMin: programadoMin - pausasMin,
      gaps: gaps, lacunasMin: lacunasMin, atividadesCount: atividadesTopo.length
    };
  }

  /* Compara a ordem de exibição atual (por "ordem", que é o que o
     roteiro-base usa) com a ordem cronológica (por horaInicio) —
     só entre quem tem horário definido. Diverge = a pessoa mexeu no
     horário sem reordenar, ou vice-versa. */
  function ordemDivergeDoHorario(atividadesEmOrdem) {
    var comHorario = atividadesEmOrdem.filter(function (a) { return a.horaInicio; });
    var porHorario = comHorario.slice().sort(function (a, b) { return hhmmParaMin(a.horaInicio) - hhmmParaMin(b.horaInicio); });
    for (var i = 0; i < comHorario.length; i++) if (comHorario[i].key !== porHorario[i].key) return true;
    return false;
  }

  function resumoDiaHtml(resumo, idPrefix) {
    function item(label, valor, cor, tooltip, extra) {
      return '<div style="flex:1;min-width:110px" title="' + esc(tooltip || '') + '">' +
        '<div style="font-size:.64rem;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3)">' + esc(label) + '</div>' +
        '<div style="font-size:1.05rem;font-weight:700;color:' + cor + '">' + esc(valor) + '</div>' +
        (extra ? '<div style="font-size:.68rem;color:var(--ink-3)">' + esc(extra) + '</div>' : '') + '</div>';
    }
    var janelaTxt = resumo.janelaMin != null ? minParaHhmm(resumo.janelaInicioMin) + ' → ' + minParaHhmm(resumo.janelaFimMin) : '—';
    return '<div id="' + idPrefix + '" style="display:flex;flex-wrap:wrap;gap:16px;padding:14px 16px;background:var(--panel-2);border:1px solid var(--line-strong);border-radius:12px;margin-bottom:14px">' +
      item('Janela do dia', janelaTxt, 'var(--gold)', 'Do início da primeira à conclusão da última atividade com horário definido.', resumo.janelaMin != null ? fmtDuracao(resumo.janelaMin) : '') +
      item('Tempo programado', fmtDuracao(resumo.programadoMin), 'var(--blue-glow)', 'Soma das durações de todas as atividades planejadas (inclui pausas).') +
      item('Tempo de facilitação', fmtDuracao(resumo.facilitacaoMin), '#4caf7d', 'Tempo programado descontando pausas e intervalos.', resumo.pausasMin ? '' : 'sem pausas') +
      item('Pausas / intervalos', fmtDuracao(resumo.pausasMin), '#ffb347', 'Soma das atividades do tipo Intervalo.') +
      item('Lacunas', fmtDuracao(resumo.lacunasMin), resumo.lacunasMin ? '#ff8a5c' : 'var(--ink-3)', 'Períodos entre atividades sem nada programado — não conta como tempo programado.') +
      item('Atividades', String(resumo.atividadesCount), 'var(--blue-glow)', 'Quantidade de atividades principais do dia (sub-etapas não contam à parte).') +
      '</div>';
  }

  function gapRowHtml(gap) {
    return '<div style="border:1px dashed rgba(255,138,92,.5);background:rgba(255,138,92,.08);border-radius:8px;padding:8px 14px;font-size:.8rem;color:#ff8a5c;margin:2px 0">' +
      '⚠ Lacuna no planejamento: ' + esc(minParaHhmm(gap.inicioMin)) + '–' + esc(minParaHhmm(gap.fimMin)) +
      ' <span style="color:var(--ink-3)">(' + esc(fmtDuracao(gap.min)) + ' sem atividade programada)</span></div>';
  }

  /* Exportar = imprimir/salvar como PDF pelo diálogo nativo do navegador,
     mesmo padrão já usado em admin.js (imprimirListaPresenca): abre uma
     janela nova com um documento HTML/CSS de impressão montado só em
     memória (window.open + document.write), sem depender de nenhuma
     biblioteca de PDF/DOCX. */
  function imprimirRoteiroDia(tituloContexto, dia, atividadesTopo, resumo) {
    var geradoEm = new Date().toLocaleString('pt-BR');
    var linhasHtml = '';
    atividadesTopo.forEach(function (a, i) {
      var gapAntes = resumo.gaps.filter(function (g) { return g.fimMin === hhmmParaMin(a.horaInicio); })[0];
      if (gapAntes) linhasHtml += '<tr class="rp-gap"><td colspan="5">⚠ Lacuna: ' + esc(minParaHhmm(gapAntes.inicioMin)) + '–' + esc(minParaHhmm(gapAntes.fimMin)) + ' (' + esc(fmtDuracao(gapAntes.min)) + ')</td></tr>';
      var horario = (a.horaInicio || '—') + (a.horaFim ? '–' + a.horaFim : '');
      linhasHtml += '<tr><td>' + (i + 1) + '</td><td>' + esc(horario) + '</td><td>' + esc(a.titulo) + '</td><td>' + esc(a.tipo || '') + '</td><td>' + esc(fmtDuracao(duracaoEfetiva(a))) + '</td></tr>';
      (a.subatividades || []).forEach(function (sub, j) {
        linhasHtml += '<tr class="rp-sub"><td>' + (i + 1) + '.' + (j + 1) + '</td><td></td><td>' + esc(sub.titulo) + '</td><td></td><td>' + esc(fmtDuracao(sub.duracaoMinutos)) + '</td></tr>';
      });
    });

    var html = '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(tituloContexto) + ' — ' + esc(dia.titulo || '') + '</title>' +
      '<style>' +
      'body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px;}' +
      'h1{font-size:1.3rem;margin:0 0 4px;}' +
      '.rp-meta{font-size:.85rem;color:#444;margin-bottom:16px;}' +
      '.rp-resumo{display:flex;flex-wrap:wrap;gap:18px;margin-bottom:16px;font-size:.8rem;}' +
      '.rp-resumo b{display:block;font-size:1rem;}' +
      'table{border-collapse:collapse;width:100%;font-size:.82rem;}' +
      'th,td{border:1px solid #999;padding:4px 8px;text-align:left;}' +
      'th{background:#eee;}' +
      '.rp-gap td{background:#fff3e0;font-style:italic;}' +
      '.rp-sub td:nth-child(3){padding-left:22px;color:#444;}' +
      '.rp-actions{margin-bottom:16px;}' +
      '@media print{.rp-actions{display:none;} body{margin:10px;}}' +
      '@page{size:A4 portrait;margin:14mm;}' +
      '</style></head><body>' +
      '<div class="rp-actions"><button id="rp-print-btn">Imprimir / salvar como PDF</button></div>' +
      '<h1>' + esc(tituloContexto) + (dia.titulo ? ' — ' + esc(dia.titulo) : '') + '</h1>' +
      '<div class="rp-meta">Gerado em ' + esc(geradoEm) + '</div>' +
      '<div class="rp-resumo">' +
        '<div>Janela do dia<b>' + (resumo.janelaMin != null ? esc(minParaHhmm(resumo.janelaInicioMin) + ' → ' + minParaHhmm(resumo.janelaFimMin)) : '—') + '</b></div>' +
        '<div>Programado<b>' + esc(fmtDuracao(resumo.programadoMin)) + '</b></div>' +
        '<div>Facilitação<b>' + esc(fmtDuracao(resumo.facilitacaoMin)) + '</b></div>' +
        '<div>Pausas<b>' + esc(fmtDuracao(resumo.pausasMin)) + '</b></div>' +
        '<div>Lacunas<b>' + esc(fmtDuracao(resumo.lacunasMin)) + '</b></div>' +
        '<div>Atividades<b>' + resumo.atividadesCount + '</b></div>' +
      '</div>' +
      '<table><thead><tr><th>#</th><th>Horário</th><th>Atividade</th><th>Tipo</th><th>Duração</th></tr></thead>' +
      '<tbody>' + linhasHtml + '</tbody></table>' +
      '</body></html>';

    var win = window.open('', '_blank');
    if (!win) { alertDialog('Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.'); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
    var printBtn = win.document.getElementById('rp-print-btn');
    if (printBtn) printBtn.addEventListener('click', function () { win.print(); });
  }

  /* ══════════════════════════════════════════════════════════════
     UI — roteiro-base do evento (editor completo, só admin)
     ══════════════════════════════════════════════════════════════ */

  var _secoesRecolhidas = {}; /* { [atividadeKey]: true } — estado de UI, sobrevive a redesenhos */

  function colunasHeaderHtml() {
    return '<div style="display:flex;align-items:center;gap:10px;padding:4px 14px;font-size:.66rem;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3)">' +
      '<span style="width:26px">#</span><span style="min-width:96px">Horário</span><span style="flex:1">Atividade</span>' +
      '<span style="width:120px">Tipo</span><span style="width:64px">Duração</span><span style="margin-left:auto">Ações</span></div>';
  }

  function renderRoteiroBaseEditor(container, eventoKey) {
    var diaAtivoKey = null;

    function reload() { carregarRoteiroEvento(eventoKey, function (err, roteiro) { desenhar(roteiro); }); }

    /* Duração mudou numa atividade com horário definido — oferece deslocar
       em cadeia as atividades seguintes DO MESMO DIA (por ordem) que também
       têm horário, sem fazer isso silenciosamente. */
    function ofereceRecalculo(dia, atividade, dadosNovos, duracaoAnterior, todasDoDia, cb) {
      var delta = duracaoEfetiva(dadosNovos) - duracaoAnterior;
      if (!delta || !dadosNovos.horaInicio) return cb();
      var idx = todasDoDia.findIndex(function (x) { return x.key === atividade.key; });
      var seguintes = todasDoDia.slice(idx + 1).filter(function (x) { return x.horaInicio; });
      if (!seguintes.length) return cb();
      escolhaDialog(
        'A duração desta atividade foi alterada em ' + (delta > 0 ? '+' : '') + delta + ' min.\n\n' +
        'Deseja recalcular automaticamente o horário das ' + seguintes.length + ' atividade(s) seguinte(s) deste dia?',
        'Recalcular', function () {
          var updates = {};
          seguintes.forEach(function (s) {
            var novoInicio = hhmmParaMin(s.horaInicio) + delta;
            updates[s.key] = { horaInicio: minParaHhmm(novoInicio), horaFim: s.horaFim ? minParaHhmm(hhmmParaMin(s.horaFim) + delta) : s.horaFim };
          });
          var chamadas = Object.keys(updates).length;
          Object.keys(updates).forEach(function (k) {
            editarAtividade(eventoKey, k, updates[k], function () { if (!--chamadas) cb(); });
          });
        },
        'Manter horários', cb
      );
    }

    function desenhar(roteiro) {
      container.innerHTML = '';
      if (!diaAtivoKey || !roteiro.dias.some(function (d) { return d.key === diaAtivoKey; })) {
        diaAtivoKey = roteiro.dias.length ? roteiro.dias[0].key : null;
      }

      var tabsWrap = document.createElement('div');
      tabsWrap.style.cssText = 'position:sticky;top:0;background:var(--panel,#0c1528);z-index:2;padding-bottom:8px';
      var tabs = document.createElement('div');
      tabs.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;align-items:center';
      roteiro.dias.forEach(function (dia, i) {
        var b = document.createElement('button');
        b.className = 'btn btn--sm' + (dia.key === diaAtivoKey ? ' btn--primary' : '');
        b.style.cssText = 'padding:6px 12px;font-size:.75rem';
        b.textContent = 'DIA ' + (i + 1) + (dia.titulo ? ' — ' + dia.titulo : '');
        b.addEventListener('click', function () { diaAtivoKey = dia.key; desenhar(roteiro); });
        tabs.appendChild(b);
      });
      var addDiaBtn = document.createElement('button');
      addDiaBtn.className = 'btn btn--sm';
      addDiaBtn.style.cssText = 'padding:6px 12px;font-size:.75rem';
      addDiaBtn.textContent = '+ Dia';
      addDiaBtn.addEventListener('click', function () {
        criarDia(eventoKey, roteiro.dias, function (err, key) { if (!err) { diaAtivoKey = key; reload(); } });
      });
      tabs.appendChild(addDiaBtn);
      tabsWrap.appendChild(tabs);
      container.appendChild(tabsWrap);

      if (!roteiro.dias.length) {
        var vazio = document.createElement('p');
        vazio.className = 'admin-empty';
        vazio.textContent = 'Nenhum dia cadastrado neste roteiro. Clique em "+ Dia" para começar.';
        container.appendChild(vazio);
        return;
      }

      var dia = roteiro.dias.filter(function (d) { return d.key === diaAtivoKey; })[0];
      var atividades = atividadesDoDia(roteiro.atividades, dia.key);
      var resumo = calcularResumoDia(atividades);

      var diaHdr = document.createElement('div');
      diaHdr.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap';
      var renameInput = document.createElement('input');
      renameInput.type = 'text';
      renameInput.placeholder = 'Título do dia (opcional)';
      renameInput.value = dia.titulo || '';
      renameInput.style.cssText = 'flex:1;min-width:180px;padding:6px 10px;background:var(--panel-2);border:1px solid var(--line-strong);border-radius:6px;color:var(--ink)';
      renameInput.addEventListener('change', function () { renomearDia(eventoKey, dia.key, renameInput.value.trim(), function () { reload(); }); });
      var imprimirBtn = document.createElement('button');
      imprimirBtn.className = 'btn btn--sm';
      imprimirBtn.style.cssText = 'padding:6px 10px;font-size:.72rem';
      imprimirBtn.innerHTML = '&#x1F5A8; Imprimir';
      imprimirBtn.addEventListener('click', function () { imprimirRoteiroDia('Roteiro-base', dia, atividades, resumo); });
      var delDiaBtn = document.createElement('button');
      delDiaBtn.className = 'btn btn--sm';
      delDiaBtn.style.cssText = 'padding:6px 10px;font-size:.72rem;border-color:rgba(255,80,80,.5);color:#ff8080';
      delDiaBtn.textContent = '🗑 Excluir dia';
      delDiaBtn.addEventListener('click', function () {
        var msg = atividades.length
          ? 'Excluir este dia e suas ' + atividades.length + ' atividade(s)? Personalizações feitas por turmas nessas atividades também serão apagadas. Não é possível desfazer.'
          : 'Excluir este dia?';
        confirmDialog(msg, function () { excluirDia(eventoKey, dia.key, atividades, function () { diaAtivoKey = null; reload(); }); });
      });
      diaHdr.appendChild(renameInput);
      diaHdr.appendChild(imprimirBtn);
      diaHdr.appendChild(delDiaBtn);
      container.appendChild(diaHdr);

      container.insertAdjacentHTML('beforeend', resumoDiaHtml(resumo, 'rbResumoTopo'));

      if (ordemDivergeDoHorario(atividades)) {
        var bannerOrdem = document.createElement('div');
        bannerOrdem.style.cssText = 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;background:rgba(255,179,71,.08);border:1px solid rgba(255,179,71,.35);border-radius:8px;margin-bottom:12px;font-size:.82rem;color:#ffb347';
        bannerOrdem.innerHTML = '<span>⚠ Existem atividades fora da ordem cronológica.</span>';
        var ordenarBtn = document.createElement('button');
        ordenarBtn.className = 'btn btn--sm';
        ordenarBtn.style.cssText = 'padding:4px 10px;font-size:.72rem;margin-left:auto';
        ordenarBtn.textContent = 'Ordenar por horário';
        ordenarBtn.addEventListener('click', function () {
          var comHorario = atividades.filter(function (a) { return a.horaInicio; }).slice()
            .sort(function (a, b) { return hhmmParaMin(a.horaInicio) - hhmmParaMin(b.horaInicio); });
          var updates = {};
          comHorario.forEach(function (a, i) { updates[a.key] = (i + 1) * 10; });
          var pend = comHorario.length;
          if (!pend) return;
          comHorario.forEach(function (a) {
            db().ref('roteiros-evento/' + eventoKey + '/atividades/' + a.key + '/ordem').set(updates[a.key], function () { if (!--pend) reload(); });
          });
        });
        bannerOrdem.appendChild(ordenarBtn);
        container.appendChild(bannerOrdem);
      }

      var lista = document.createElement('div');
      lista.style.cssText = 'display:flex;flex-direction:column;gap:6px';
      lista.insertAdjacentHTML('beforeend', colunasHeaderHtml());
      if (!atividades.length) {
        lista.insertAdjacentHTML('beforeend', '<p class="admin-empty">Nenhuma atividade neste dia.</p>');
      }

      atividades.forEach(function (a, i) {
        /* Lacuna antes desta atividade, se ela é a próxima na ordem
           cronológica logo depois de um "buraco" detectado no resumo. */
        var gapAntes = resumo.gaps.filter(function (g) { return g.fimMin === hhmmParaMin(a.horaInicio); })[0];
        if (gapAntes) lista.insertAdjacentHTML('beforeend', gapRowHtml(gapAntes));

        lista.appendChild(linhaAtividadeBase(a, i + 1, atividades));

        var recolhida = !!_secoesRecolhidas[a.key];
        if (a.subatividades && a.subatividades.length && !recolhida) {
          a.subatividades.forEach(function (sub, j) {
            lista.appendChild(linhaSubEtapa(i + 1, j + 1, sub));
          });
        }
      });
      container.appendChild(lista);

      container.insertAdjacentHTML('beforeend', resumoDiaHtml(resumo, 'rbResumoRodape'));

      var addAtvBtn = document.createElement('button');
      addAtvBtn.className = 'btn btn--sm btn--primary';
      addAtvBtn.style.cssText = 'margin-top:4px;padding:6px 14px;font-size:.75rem';
      addAtvBtn.textContent = '+ Adicionar atividade';
      addAtvBtn.addEventListener('click', function () {
        abrirFormAtividade({
          titulo: 'Nova atividade',
          onSalvar: function (dados) { criarAtividade(eventoKey, dia.key, dados, atividades, function () { reload(); }); }
        });
      });
      container.appendChild(addAtvBtn);

      function linhaAtividadeBase(a, numero, todasDoDia) {
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--panel-2);border:1px solid var(--line-strong);border-radius:8px;flex-wrap:wrap';
        var horario = (a.horaInicio || '—') + (a.horaFim ? '–' + a.horaFim : '');
        var ehSecao = a.subatividades && a.subatividades.length;
        var recolhida = !!_secoesRecolhidas[a.key];
        row.innerHTML =
          '<span style="width:26px;text-align:center;font-family:var(--font-mono);font-size:.72rem;color:var(--ink-3);background:var(--panel);border-radius:4px;padding:2px 0">' + numero + '</span>' +
          '<span style="font-family:var(--font-mono);font-size:.78rem;color:var(--gold);min-width:96px">' + esc(horario) + '</span>' +
          '<span style="flex:1;min-width:140px;color:var(--ink)">' + esc(a.titulo) +
            (ehSecao ? ' <span style="font-size:.7rem;color:var(--ink-3)">· ' + a.subatividades.length + ' etapa' + (a.subatividades.length !== 1 ? 's' : '') + '</span>' : '') + '</span>' +
          (a.tipo ? '<span class="turma-status-badge" style="background:var(--panel);color:' + (a.tipo === 'Intervalo' ? '#ffb347' : 'var(--ink-3)') + ';border:1px solid var(--line-strong)">' + esc(a.tipo) + '</span>' : '') +
          '<span style="font-size:.75rem;color:var(--ink-3);width:64px">' + fmtDuracao(duracaoEfetiva(a)) + '</span>';
        var acoes = document.createElement('div');
        acoes.style.cssText = 'display:flex;gap:4px;margin-left:auto;flex-wrap:wrap';
        if (ehSecao) {
          var toggleBtn = document.createElement('button');
          toggleBtn.className = 'btn btn--sm'; toggleBtn.style.cssText = 'padding:4px 8px;font-size:.72rem';
          toggleBtn.textContent = recolhida ? '▼ Ver etapas' : '▲ Recolher';
          toggleBtn.addEventListener('click', function () { _secoesRecolhidas[a.key] = !recolhida; desenhar(roteiro); });
          acoes.appendChild(toggleBtn);
        }
        var upBtn = document.createElement('button'); upBtn.className = 'btn btn--sm'; upBtn.style.cssText = 'padding:4px 8px'; upBtn.textContent = '▲'; upBtn.disabled = numero === 1;
        upBtn.addEventListener('click', function () { moverAtividade(eventoKey, a.key, 'up', todasDoDia, function () { reload(); }); });
        var downBtn = document.createElement('button'); downBtn.className = 'btn btn--sm'; downBtn.style.cssText = 'padding:4px 8px'; downBtn.textContent = '▼'; downBtn.disabled = numero === todasDoDia.length;
        downBtn.addEventListener('click', function () { moverAtividade(eventoKey, a.key, 'down', todasDoDia, function () { reload(); }); });
        var dupBtn = document.createElement('button'); dupBtn.className = 'btn btn--sm'; dupBtn.style.cssText = 'padding:4px 8px;font-size:.72rem'; dupBtn.textContent = 'Duplicar';
        dupBtn.addEventListener('click', function () { duplicarAtividade(eventoKey, a, todasDoDia, function () { reload(); }); });
        var editBtn = document.createElement('button'); editBtn.className = 'btn btn--sm'; editBtn.style.cssText = 'padding:4px 8px;font-size:.72rem'; editBtn.textContent = 'Editar';
        editBtn.addEventListener('click', function () {
          abrirFormAtividade({
            titulo: 'Editar atividade', existente: a,
            onSalvar: function (dados, duracaoAnterior) {
              editarAtividade(eventoKey, a.key, dados, function () {
                ofereceRecalculo(dia, a, dados, duracaoAnterior, todasDoDia, function () { reload(); });
              });
            },
            onExcluir: function () { excluirAtividade(eventoKey, a.key, function () { reload(); }); }
          });
        });
        acoes.appendChild(upBtn); acoes.appendChild(downBtn); acoes.appendChild(dupBtn); acoes.appendChild(editBtn);
        row.appendChild(acoes);
        return row;
      }

      function linhaSubEtapa(numeroPai, numeroFilho, sub) {
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:6px 14px 6px 34px;margin-left:20px;border-left:2px solid var(--line-strong);background:rgba(255,255,255,.02);border-radius:0 6px 6px 0';
        row.innerHTML =
          '<span style="font-family:var(--font-mono);font-size:.7rem;color:var(--ink-3);min-width:96px">' + numeroPai + '.' + numeroFilho + '</span>' +
          '<span style="flex:1;color:var(--ink-2);font-size:.85rem">' + esc(sub.titulo) + '</span>' +
          '<span style="font-size:.72rem;color:var(--ink-3);width:64px">' + fmtDuracao(sub.duracaoMinutos) + '</span>';
        return row;
      }
    }

    reload();
  }

  /* ══════════════════════════════════════════════════════════════
     UI — roteiro da turma (leitura para todos; edição se opts.editable)
     ══════════════════════════════════════════════════════════════ */

  function nomeFacilitador(equipe, key) {
    var f = (equipe || []).filter(function (x) { return x.key === key; })[0];
    return f ? f.name : '';
  }

  function renderRoteiroTurma(container, turma, opts) {
    opts = opts || {};
    var editable = !!opts.editable;
    var equipe = opts.equipe || [];
    var diaAtivoIdx = 0;

    function reload() { carregarRoteiroEfetivoTurma(turma, function (err, dias) { desenhar(dias); }); }

    function badgeDe(status) {
      if (status === 'alterada') return '<span class="turma-status-badge badge-roteiro-alterada">Alterado nesta turma</span>';
      if (status === 'exclusiva') return '<span class="turma-status-badge badge-roteiro-exclusiva">Exclusivo desta turma</span>';
      return '';
    }

    function desenhar(dias) {
      container.innerHTML = '';
      if (!dias.length) {
        container.innerHTML = '<p class="admin-empty">Esta turma ainda não tem um roteiro — o evento não tem roteiro-base cadastrado.</p>';
        return;
      }
      if (diaAtivoIdx >= dias.length) diaAtivoIdx = 0;

      var tabsWrap = document.createElement('div');
      tabsWrap.style.cssText = 'position:sticky;top:0;background:var(--panel,#0c1528);z-index:2;padding-bottom:8px';
      var tabs = document.createElement('div');
      tabs.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap';
      dias.forEach(function (dia, i) {
        var b = document.createElement('button');
        b.className = 'btn btn--sm' + (i === diaAtivoIdx ? ' btn--primary' : '');
        b.style.cssText = 'padding:6px 12px;font-size:.75rem';
        b.textContent = 'DIA ' + dia.numero + (dia.data ? ' (' + dia.data.split('-').reverse().slice(0, 2).join('/') + ')' : '');
        b.addEventListener('click', function () { diaAtivoIdx = i; desenhar(dias); });
        tabs.appendChild(b);
      });
      tabsWrap.appendChild(tabs);
      container.appendChild(tabsWrap);

      var dia = dias[diaAtivoIdx];
      var resumo = calcularResumoDia(dia.atividades);

      var imprimirBtn = document.createElement('button');
      imprimirBtn.className = 'btn btn--sm';
      imprimirBtn.style.cssText = 'padding:5px 10px;font-size:.72rem;margin-bottom:12px';
      imprimirBtn.innerHTML = '&#x1F5A8; Imprimir';
      imprimirBtn.addEventListener('click', function () { imprimirRoteiroDia('Roteiro — ' + (turma.label || ''), { titulo: 'Dia ' + dia.numero }, dia.atividades, resumo); });
      container.appendChild(imprimirBtn);

      container.insertAdjacentHTML('beforeend', resumoDiaHtml(resumo, 'rtResumoTopo'));

      var lista = document.createElement('div');
      lista.style.cssText = 'display:flex;flex-direction:column;gap:8px';
      lista.insertAdjacentHTML('beforeend', colunasHeaderHtml());

      if (!dia.atividades.length) {
        lista.insertAdjacentHTML('beforeend', '<p class="admin-empty">Nenhuma atividade neste dia.</p>');
      }

      dia.atividades.forEach(function (a, i) {
        var gapAntes = resumo.gaps.filter(function (g) { return g.fimMin === hhmmParaMin(a.horaInicio); })[0];
        if (gapAntes) lista.insertAdjacentHTML('beforeend', gapRowHtml(gapAntes));
        lista.appendChild(renderAtividadeAcc(a, dia, i + 1));
      });
      container.appendChild(lista);

      container.insertAdjacentHTML('beforeend', resumoDiaHtml(resumo, 'rtResumoRodape'));

      if (editable) {
        var addExclusivaBtn = document.createElement('button');
        addExclusivaBtn.className = 'btn btn--sm';
        addExclusivaBtn.style.cssText = 'margin-top:12px;padding:6px 14px;font-size:.75rem';
        addExclusivaBtn.textContent = '+ Adicionar atividade somente nesta turma';
        addExclusivaBtn.addEventListener('click', function () {
          abrirFormAtividade({
            titulo: 'Nova atividade exclusiva desta turma',
            onSalvar: function (dados) { criarAtividadeExclusiva(turma.key, dia.key, dados, function () { reload(); }); }
          });
        });
        container.appendChild(addExclusivaBtn);

        if (dia.removidas.length) {
          var det = document.createElement('details');
          det.style.cssText = 'margin-top:16px';
          det.innerHTML = '<summary style="cursor:pointer;color:var(--ink-2);font-size:.8rem">Atividades removidas desta turma (' + dia.removidas.length + ')</summary>';
          var remWrap = document.createElement('div');
          remWrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-top:8px';
          dia.removidas.forEach(function (a) {
            var row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--panel-2);border:1px solid rgba(255,59,48,.25);border-radius:8px';
            row.innerHTML = '<span class="turma-status-badge badge-roteiro-removida">Removida desta turma</span><span style="flex:1;color:var(--ink-2)">' + esc(a.titulo) + '</span>';
            var restBtn = document.createElement('button');
            restBtn.className = 'btn btn--sm'; restBtn.style.cssText = 'padding:4px 10px;font-size:.72rem'; restBtn.textContent = 'Restaurar';
            restBtn.addEventListener('click', function () { restaurarAtividade(turma.key, a.key, function () { reload(); }); });
            row.appendChild(restBtn);
            remWrap.appendChild(row);
          });
          det.appendChild(remWrap);
          container.appendChild(det);
        }
      }
    }

    function renderAtividadeAcc(a, dia, numero) {
      var acc = document.createElement('div');
      acc.className = 'aval-acc';
      var hdr = document.createElement('div');
      hdr.className = 'aval-acc-hdr';
      var horario = (a.horaInicio || '—') + (a.horaFim ? '–' + a.horaFim : '');
      var ehSecao = a.subatividades && a.subatividades.length;
      hdr.innerHTML =
        '<span style="width:22px;text-align:center;font-family:var(--font-mono);font-size:.7rem;color:var(--ink-3)">' + numero + '</span>' +
        '<span style="font-family:var(--font-mono);font-size:.78rem;color:var(--gold);min-width:96px">' + esc(horario) + '</span>' +
        '<div class="aval-acc-hdr-text"><strong style="color:var(--ink)">' + esc(a.titulo) +
          (ehSecao ? ' <span style="font-size:.7rem;color:var(--ink-3);font-weight:400">· ' + a.subatividades.length + ' etapa' + (a.subatividades.length !== 1 ? 's' : '') + '</span>' : '') + '</strong>' +
        '<span style="font-size:.72rem;color:var(--ink-3)">' + esc(fmtDuracao(duracaoEfetiva(a))) + (a.tipo ? ' · ' + esc(a.tipo) : '') + '</span>' +
        (a._facilitacao && a._facilitacao.principal ? '<span style="font-size:.72rem;color:var(--ink-3)">Condução: ' + esc(nomeFacilitador(equipe, a._facilitacao.principal)) + '</span>' : '') +
        '</div><div class="aval-acc-hdr-right">' + badgeDe(a._status) + '<span class="aval-acc-arrow">▾</span></div>';
      var body = document.createElement('div');
      body.className = 'aval-acc-body';
      body.style.cssText = 'display:none;padding:14px 16px;background:var(--panel)';
      hdr.addEventListener('click', function () {
        var abrir = body.style.display === 'none';
        body.style.display = abrir ? '' : 'none';
        acc.classList.toggle('aval-acc--open', abrir);
        if (abrir && !body.dataset.montado) { montarCorpo(body, a, dia); body.dataset.montado = '1'; }
      });
      acc.appendChild(hdr);
      acc.appendChild(body);
      return acc;
    }

    function campoDetalhe(label, valor) {
      if (!valor || (Array.isArray(valor) && !valor.length)) return '';
      var conteudo = Array.isArray(valor)
        ? '<ul style="margin:4px 0 0 18px;padding:0">' + valor.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>'
        : '<p style="margin:4px 0 0;white-space:pre-line">' + esc(valor) + '</p>';
      return '<div style="margin-bottom:12px"><strong style="font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3)">' + esc(label) + '</strong>' + conteudo + '</div>';
    }

    function montarCorpo(body, a, dia) {
      if (a.subatividades && a.subatividades.length) {
        var subHtml = '<div style="margin-bottom:14px"><strong style="font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3)">Etapas desta seção</strong>' +
          '<div style="display:flex;flex-direction:column;gap:4px;margin-top:6px">' +
          a.subatividades.map(function (sub, j) {
            return '<div style="display:flex;gap:10px;padding:5px 10px;border-left:2px solid var(--line-strong);background:rgba(255,255,255,.02)">' +
              '<span style="color:var(--ink-3);font-size:.78rem">' + (j + 1) + '.</span>' +
              '<span style="flex:1;color:var(--ink-2);font-size:.85rem">' + esc(sub.titulo) + '</span>' +
              '<span style="color:var(--ink-3);font-size:.78rem">' + esc(fmtDuracao(sub.duracaoMinutos)) + '</span></div>';
          }).join('') + '</div></div>';
        body.insertAdjacentHTML('beforeend', subHtml);
      }
      var detalhes = document.createElement('div');
      detalhes.innerHTML =
        campoDetalhe('Objetivo', a.objetivo) +
        campoDetalhe('Descrição', a.descricao) +
        campoDetalhe('Passo a passo', a.passoAPasso) +
        campoDetalhe('Dicas para o facilitador', a.dicasFacilitador) +
        campoDetalhe('Conexão com a agilidade', a.conexaoAgilidade) +
        campoDetalhe('Perguntas para o debrief', a.perguntasDebrief) +
        campoDetalhe('Materiais necessários', a.materiais) +
        campoDetalhe('Preparação prévia', a.preparacaoPrevia) +
        campoDetalhe('Observações', a.observacoes);
      body.appendChild(detalhes);

      /* Facilitação — leitura sempre; seleção só quando editable e há
         gente na equipe da turma (só quem está na equipe pode conduzir). */
      var facWrap = document.createElement('div');
      facWrap.style.cssText = 'margin-top:8px;padding-top:12px;border-top:1px solid var(--line-strong)';
      if (editable && equipe.length) {
        var principalAtual = (a._facilitacao && a._facilitacao.principal) || '';
        var apoioAtual = (a._facilitacao && a._facilitacao.apoio) || [];
        var opts1 = '<option value="">— ninguém definido —</option>' + equipe.map(function (f) {
          return '<option value="' + esc(f.key) + '"' + (f.key === principalAtual ? ' selected' : '') + '>' + esc(f.name) + '</option>';
        }).join('');
        var checks = equipe.map(function (f) {
          return '<label style="display:flex;align-items:center;gap:6px;font-size:.82rem;color:var(--ink-2)"><input type="checkbox" class="rt-apoio-chk" value="' + esc(f.key) + '"' + (apoioAtual.indexOf(f.key) !== -1 ? ' checked' : '') + ' />' + esc(f.name) + '</label>';
        }).join('');
        facWrap.innerHTML =
          '<label class="auth-label">Condução principal<select class="rt-principal-sel" style="width:100%;padding:8px 10px;background:var(--panel-2);border:1px solid var(--line-strong);border-radius:6px;color:var(--ink)">' + opts1 + '</select></label>' +
          '<div style="margin-top:8px"><span class="auth-label" style="display:block;margin-bottom:6px">Apoio</span><div style="display:flex;flex-direction:column;gap:4px">' + checks + '</div></div>';
        body.appendChild(facWrap);
        var salvarFacBtn = document.createElement('button');
        salvarFacBtn.className = 'btn btn--sm'; salvarFacBtn.style.cssText = 'margin-top:10px;padding:5px 12px;font-size:.72rem'; salvarFacBtn.textContent = 'Salvar condução';
        salvarFacBtn.addEventListener('click', function () {
          var principal = body.querySelector('.rt-principal-sel').value;
          var apoio = Array.prototype.map.call(body.querySelectorAll('.rt-apoio-chk:checked'), function (c) { return c.value; });
          if (principal && apoio.indexOf(principal) !== -1) { alertDialog('A mesma pessoa não pode ser condução principal e apoio na mesma atividade.'); return; }
          salvarFacilitacaoAtividade(turma.key, a.key, principal, apoio, function () { reload(); });
        });
        body.appendChild(salvarFacBtn);
      } else if (a._facilitacao && (a._facilitacao.principal || (a._facilitacao.apoio || []).length)) {
        var linhasHtml = '';
        if (a._facilitacao.principal) linhasHtml += '<p style="margin:0"><strong>Condução:</strong> ' + esc(nomeFacilitador(equipe, a._facilitacao.principal)) + '</p>';
        if ((a._facilitacao.apoio || []).length) linhasHtml += '<p style="margin:4px 0 0"><strong>Apoio:</strong> ' + a._facilitacao.apoio.map(function (k) { return esc(nomeFacilitador(equipe, k)); }).join(', ') + '</p>';
        facWrap.innerHTML = linhasHtml;
        body.appendChild(facWrap);
      }

      if (!editable) return;

      var acoes = document.createElement('div');
      acoes.style.cssText = 'display:flex;gap:8px;margin-top:14px;flex-wrap:wrap';
      if (a._status === 'exclusiva') {
        var editExclBtn = document.createElement('button');
        editExclBtn.className = 'btn btn--sm'; editExclBtn.style.cssText = 'padding:5px 12px;font-size:.72rem'; editExclBtn.textContent = 'Editar';
        editExclBtn.addEventListener('click', function () {
          abrirFormAtividade({
            titulo: 'Editar atividade exclusiva', existente: a,
            onSalvar: function (dados) { editarAtividadeExclusiva(turma.key, a.key, dados, function () { reload(); }); },
            onExcluir: function () { excluirAtividadeExclusiva(turma.key, a.key, function () { reload(); }); }
          });
        });
        acoes.appendChild(editExclBtn);
      } else {
        var editBtn = document.createElement('button');
        editBtn.className = 'btn btn--sm'; editBtn.style.cssText = 'padding:5px 12px;font-size:.72rem'; editBtn.textContent = 'Editar apenas nesta turma';
        editBtn.addEventListener('click', function () {
          abrirFormAtividade({
            titulo: 'Personalizar atividade nesta turma', existente: a,
            onSalvar: function (dados) { customizarAtividade(turma.key, a._base, dados, function () { reload(); }); }
          });
        });
        acoes.appendChild(editBtn);

        if (a._status === 'alterada') {
          var restBtn = document.createElement('button');
          restBtn.className = 'btn btn--sm'; restBtn.style.cssText = 'padding:5px 12px;font-size:.72rem'; restBtn.textContent = 'Restaurar padrão do evento';
          restBtn.addEventListener('click', function () {
            confirmDialog('Esta ação descartará as personalizações desta atividade para esta turma e restaurará os dados definidos no roteiro-base do evento. Deseja continuar?',
              function () { restaurarAtividade(turma.key, a.key, function () { reload(); }); });
          });
          acoes.appendChild(restBtn);
        }
        var remBtn = document.createElement('button');
        remBtn.className = 'btn btn--sm'; remBtn.style.cssText = 'padding:5px 12px;font-size:.72rem;border-color:rgba(255,80,80,.5);color:#ff8080'; remBtn.textContent = 'Remover desta turma';
        remBtn.addEventListener('click', function () {
          confirmDialog('Remover "' + a.titulo + '" apenas desta turma? A atividade continua no roteiro-base do evento e nas demais turmas.',
            function () { removerAtividadeDaTurma(turma.key, a.key, function () { reload(); }); });
        });
        acoes.appendChild(remBtn);
      }
      body.appendChild(acoes);
    }

    reload();
  }

  window.faRoteiro = {
    carregarRoteiroEvento: carregarRoteiroEvento,
    carregarRoteiroEfetivoTurma: carregarRoteiroEfetivoTurma,
    carregarEquipeTurma: carregarEquipeTurma,
    carregarEquipeGlobal: carregarEquipeGlobal,
    definirResponsavel: definirResponsavel,
    adicionarFacilitadorApoio: adicionarFacilitadorApoio,
    removerDaEquipe: removerDaEquipe,
    renderRoteiroBaseEditor: renderRoteiroBaseEditor,
    renderRoteiroTurma: renderRoteiroTurma,
    alertDialog: alertDialog,
    confirmDialog: confirmDialog
  };
})();
