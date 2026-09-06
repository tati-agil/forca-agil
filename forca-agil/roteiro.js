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
    box.querySelector('.roteiro-dlg-confirm').addEventListener('click', function () { close(); onYes(); });
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

    function paraMin(hhmm) {
      if (!hhmm) return null;
      var p = hhmm.split(':'); return (+p[0]) * 60 + (+p[1]);
    }
    function paraHora(min) {
      min = ((min % 1440) + 1440) % 1440;
      return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
    }
    [inicioEl, fimEl, duracaoEl].forEach(function (el) {
      el.addEventListener('change', function () {
        var i = paraMin(inicioEl.value), f = paraMin(fimEl.value), d = duracaoEl.value ? Number(duracaoEl.value) : null;
        if (el === duracaoEl && i !== null && d !== null) fimEl.value = paraHora(i + d);
        else if (el === duracaoEl && f !== null && d !== null) inicioEl.value = paraHora(f - d);
        else if (el === inicioEl && d !== null) fimEl.value = paraHora(i + d);
        else if (el === inicioEl && f !== null) duracaoEl.value = Math.max(0, f - i);
        else if (el === fimEl && i !== null) duracaoEl.value = Math.max(0, f - i);
        else if (el === fimEl && d !== null) inicioEl.value = paraHora(f - d);
      });
    });

    function closeModal() { document.body.removeChild(overlay); }
    $('.roteiro-form-cancelar').addEventListener('click', closeModal);
    var overlayMousedownFora = false;
    overlay.addEventListener('mousedown', function (e) { overlayMousedownFora = !box.contains(e.target); });
    overlay.addEventListener('click', function (e) { if (overlayMousedownFora && !box.contains(e.target)) closeModal(); });
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
      var i = paraMin(inicioEl.value), f = paraMin(fimEl.value);
      if (i !== null && f !== null && f < i) { errEl.textContent = 'O horário final não pode ser antes do inicial.'; errEl.style.display = ''; return; }
      var dados = {
        titulo: titulo, tipo: $('#rfTipo').value,
        horaInicio: inicioEl.value || '', horaFim: fimEl.value || '',
        duracaoMinutos: duracaoEl.value ? Math.max(0, Number(duracaoEl.value)) : 0,
        descricao: $('#rfDescricao').value.trim(), objetivo: $('#rfObjetivo').value.trim(),
        passoAPasso: $('#rfPasso').value.trim(), dicasFacilitador: $('#rfDicas').value.trim(),
        conexaoAgilidade: $('#rfConexao').value.trim(),
        perguntasDebrief: linhas($('#rfDebrief').value), materiais: linhas($('#rfMateriais').value),
        preparacaoPrevia: $('#rfPreparacao').value.trim(), observacoes: $('#rfObs').value.trim()
      };
      opts.onSalvar(dados);
      closeModal();
    });
  }

  /* ══════════════════════════════════════════════════════════════
     UI — roteiro-base do evento (editor completo, só admin)
     ══════════════════════════════════════════════════════════════ */

  function renderRoteiroBaseEditor(container, eventoKey) {
    var diaAtivoKey = null;

    function reload() { carregarRoteiroEvento(eventoKey, function (err, roteiro) { desenhar(roteiro); }); }

    function desenhar(roteiro) {
      container.innerHTML = '';
      if (!diaAtivoKey || !roteiro.dias.some(function (d) { return d.key === diaAtivoKey; })) {
        diaAtivoKey = roteiro.dias.length ? roteiro.dias[0].key : null;
      }

      var tabs = document.createElement('div');
      tabs.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:14px';
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
      container.appendChild(tabs);

      if (!roteiro.dias.length) {
        var vazio = document.createElement('p');
        vazio.className = 'admin-empty';
        vazio.textContent = 'Nenhum dia cadastrado neste roteiro. Clique em "+ Dia" para começar.';
        container.appendChild(vazio);
        return;
      }

      var dia = roteiro.dias.filter(function (d) { return d.key === diaAtivoKey; })[0];
      var atividades = atividadesDoDia(roteiro.atividades, dia.key);

      var diaHdr = document.createElement('div');
      diaHdr.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap';
      var renameInput = document.createElement('input');
      renameInput.type = 'text';
      renameInput.placeholder = 'Título do dia (opcional)';
      renameInput.value = dia.titulo || '';
      renameInput.style.cssText = 'flex:1;min-width:180px;padding:6px 10px;background:var(--panel-2);border:1px solid var(--line-strong);border-radius:6px;color:var(--ink)';
      renameInput.addEventListener('change', function () { renomearDia(eventoKey, dia.key, renameInput.value.trim(), function () { reload(); }); });
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
      diaHdr.appendChild(delDiaBtn);
      container.appendChild(diaHdr);

      var lista = document.createElement('div');
      lista.style.cssText = 'display:flex;flex-direction:column;gap:8px';
      if (!atividades.length) {
        lista.innerHTML = '<p class="admin-empty">Nenhuma atividade neste dia.</p>';
      }
      atividades.forEach(function (a, i) {
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--panel-2);border:1px solid var(--line-strong);border-radius:8px;flex-wrap:wrap';
        var horario = (a.horaInicio || '—') + (a.horaFim ? '–' + a.horaFim : '');
        row.innerHTML =
          '<span style="font-family:var(--font-mono);font-size:.78rem;color:var(--accent);min-width:96px">' + esc(horario) + '</span>' +
          '<span style="flex:1;min-width:140px;color:var(--ink)">' + esc(a.titulo) + '</span>' +
          (a.tipo ? '<span class="turma-status-badge" style="background:var(--panel);color:var(--ink-3);border:1px solid var(--line-strong)">' + esc(a.tipo) + '</span>' : '') +
          (a.duracaoMinutos ? '<span style="font-size:.75rem;color:var(--ink-3)">' + a.duracaoMinutos + ' min</span>' : '');
        var acoes = document.createElement('div');
        acoes.style.cssText = 'display:flex;gap:4px;margin-left:auto';
        var upBtn = document.createElement('button'); upBtn.className = 'btn btn--sm'; upBtn.style.cssText = 'padding:4px 8px'; upBtn.textContent = '▲'; upBtn.disabled = i === 0;
        upBtn.addEventListener('click', function () { moverAtividade(eventoKey, a.key, 'up', atividades, function () { reload(); }); });
        var downBtn = document.createElement('button'); downBtn.className = 'btn btn--sm'; downBtn.style.cssText = 'padding:4px 8px'; downBtn.textContent = '▼'; downBtn.disabled = i === atividades.length - 1;
        downBtn.addEventListener('click', function () { moverAtividade(eventoKey, a.key, 'down', atividades, function () { reload(); }); });
        var dupBtn = document.createElement('button'); dupBtn.className = 'btn btn--sm'; dupBtn.style.cssText = 'padding:4px 8px;font-size:.72rem'; dupBtn.textContent = 'Duplicar';
        dupBtn.addEventListener('click', function () { duplicarAtividade(eventoKey, a, atividades, function () { reload(); }); });
        var editBtn = document.createElement('button'); editBtn.className = 'btn btn--sm'; editBtn.style.cssText = 'padding:4px 8px;font-size:.72rem'; editBtn.textContent = 'Editar';
        editBtn.addEventListener('click', function () {
          abrirFormAtividade({
            titulo: 'Editar atividade', existente: a,
            onSalvar: function (dados) { editarAtividade(eventoKey, a.key, dados, function () { reload(); }); },
            onExcluir: function () { excluirAtividade(eventoKey, a.key, function () { reload(); }); }
          });
        });
        acoes.appendChild(upBtn); acoes.appendChild(downBtn); acoes.appendChild(dupBtn); acoes.appendChild(editBtn);
        row.appendChild(acoes);
        lista.appendChild(row);
      });
      container.appendChild(lista);

      var addAtvBtn = document.createElement('button');
      addAtvBtn.className = 'btn btn--sm btn--primary';
      addAtvBtn.style.cssText = 'margin-top:12px;padding:6px 14px;font-size:.75rem';
      addAtvBtn.textContent = '+ Atividade';
      addAtvBtn.addEventListener('click', function () {
        abrirFormAtividade({
          titulo: 'Nova atividade',
          onSalvar: function (dados) { criarAtividade(eventoKey, dia.key, dados, atividades, function () { reload(); }); }
        });
      });
      container.appendChild(addAtvBtn);
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

      var tabs = document.createElement('div');
      tabs.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px';
      dias.forEach(function (dia, i) {
        var b = document.createElement('button');
        b.className = 'btn btn--sm' + (i === diaAtivoIdx ? ' btn--primary' : '');
        b.style.cssText = 'padding:6px 12px;font-size:.75rem';
        b.textContent = 'DIA ' + dia.numero + (dia.data ? ' (' + dia.data.split('-').reverse().slice(0, 2).join('/') + ')' : '');
        b.addEventListener('click', function () { diaAtivoIdx = i; desenhar(dias); });
        tabs.appendChild(b);
      });
      container.appendChild(tabs);

      var dia = dias[diaAtivoIdx];
      var lista = document.createElement('div');
      lista.style.cssText = 'display:flex;flex-direction:column;gap:10px';

      if (!dia.atividades.length) {
        lista.innerHTML = '<p class="admin-empty">Nenhuma atividade neste dia.</p>';
      }

      dia.atividades.forEach(function (a) {
        lista.appendChild(renderAtividadeAcc(a, dia, false));
      });
      container.appendChild(lista);

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

    function renderAtividadeAcc(a, dia) {
      var acc = document.createElement('div');
      acc.className = 'aval-acc';
      var hdr = document.createElement('div');
      hdr.className = 'aval-acc-hdr';
      var horario = (a.horaInicio || '—') + (a.horaFim ? '–' + a.horaFim : '');
      hdr.innerHTML =
        '<span style="font-family:var(--font-mono);font-size:.78rem;color:var(--accent);min-width:96px">' + esc(horario) + '</span>' +
        '<div class="aval-acc-hdr-text"><strong style="color:var(--ink)">' + esc(a.titulo) + '</strong>' +
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
