/* ============================================================
   Força Ágil — ADMIN › PAINEL DO PROGRAMA
   Quatro seções, todas de edição de verdade para quem vê a aba (qualquer admin geral) — as mesmas pessoas que as regras do
   banco deixam gravar (fa-painel-convidados, programa-config, programa-calendario, programa-publico-alvo,
   programa-config-auditoria; teste-rules-programa-painel.js):
     1. Convidados: quem vê o painel além do admin geral (só consulta).
     2. Configuração: data-limite, eventos do programa, facilitadores fora do público, antecedência, limites de turmas
        simultâneas e formato de turma nova — cada alteração vai para a auditoria (só acréscimo).
     3. Dias sem expediente: o calendário útil do painel.
     4. Base oficial: importação da planilha com PRÉVIA e confirmação; cada importação é uma versão nova (a anterior fica).
   Toda gravação confere o erro do Firebase e mostra o resultado; nada fecha como se tivesse dado certo.
   ============================================================ */
(function () {
  'use strict';
  var NUC = window.faProgramaCobertura;
  var GR = { tecnicos: 'Técnicos', gestores: 'Gestores' };
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function sessao() { return window.faAuth && window.faAuth.getSession(); }
  function eu() { var s = sessao(); return s ? String(s.email || '').toLowerCase() : ''; }
  function db() { return firebase.database(); }
  function TS() { return firebase.database.ServerValue.TIMESTAMP; }
  function brAno(iso) { if (!iso) return '—'; var p = String(iso).slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function quando(ms) { if (!ms) return '—'; var d = new Date(ms); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
  function msg(el, texto, erro) { if (!el) return; el.textContent = texto; el.className = 'pnla-msg' + (erro ? ' pnla-msg--erro' : ' pnla-msg--ok'); el.setAttribute('role', erro ? 'alert' : 'status'); }
  function auditoria(campo, antes, depois, motivo) {
    var r = { campo: campo, antes: String(antes == null ? '' : antes).slice(0, 4000), depois: String(depois == null ? '' : depois).slice(0, 4000), em: TS(), por: eu() };
    if (motivo) r.motivo = String(motivo).slice(0, 500);
    return r;
  }
  function chaveAud() { return db().ref('programa-config-auditoria').push().key; }

  function init() {
    var c = $('adminPainelPrograma'); if (!c) return;
    c.innerHTML =
      '<p class="admin-empty pnla-intro">O Painel do Programa (menu <b>Painel</b>) mostra cobertura, capacidade e viabilidade da meta. Só o admin geral e os convidados abaixo o veem. Os números são calculados na hora a partir das turmas, inscrições e presenças do site — aqui ficam só os parâmetros e a base oficial.</p>' +
      '<section class="pnla-secao" id="pnlaConvidados"><h4>Convidados</h4><p class="loading-msg">Carregando…</p></section>' +
      '<section class="pnla-secao" id="pnlaConfig"><h4>Configuração do programa</h4><p class="loading-msg">Carregando…</p></section>' +
      '<section class="pnla-secao" id="pnlaCalendario"><h4>Dias sem expediente</h4><p class="loading-msg">Carregando…</p></section>' +
      '<section class="pnla-secao" id="pnlaBase"><h4>Base oficial do público-alvo</h4><p class="loading-msg">Carregando…</p></section>';
    convidados(); configuracao(); calendario(); base();
  }

  /* ---------- 1. convidados ---------- */
  function convidados() {
    var el = $('pnlaConvidados');
    Promise.all([db().ref('fa-painel-convidados').once('value'), db().ref('fa-users').once('value')]).then(function (s) {
      var lista = s[0].val() || {}, users = s[1].val() || {};
      var ks = Object.keys(lista).sort(function (a, b) { return String(lista[a].name || '').localeCompare(String(lista[b].name || ''), 'pt'); });
      var h = '<h4>Convidados <span class="admin-badge">' + ks.length + '</span></h4><p class="pnla-ajuda">Convidado só consulta o painel: não vê o ADMIN e não grava nada. Precisa de conta no site com e-mail @previ.com.br. Como o cálculo acontece no navegador, ele recebe os dados de inscrição e presença necessários — inclua só pessoas de confiança.</p>';
      h += ks.length ? '<div class="table-scroll-wrap"><table class="admin-table"><thead><tr><th>Nome</th><th>E-mail</th><th>Conta no site</th><th>Incluído em</th><th></th></tr></thead><tbody>' + ks.map(function (k) {
        var p = lista[k];
        return '<tr data-conv="' + esc(k) + '"><td>' + esc(p.name) + '</td><td>' + esc(p.email) + '</td><td>' + (users[k] ? 'Sim' : '<span class="pnla-atencao">Ainda não</span>') + '</td><td>' + brAno(p.addedAt) + ' · ' + esc(p.addedBy || '') + '</td>' +
          '<td class="pnla-acoes"><button type="button" class="admin-del-btn" data-conv-rem="' + esc(k) + '">Remover</button></td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="admin-empty">Nenhum convidado. O admin geral já vê o painel.</p>';
      h += '<div class="admin-colab-form"><div class="admin-colab-row"><input id="pnlaConvNome" type="text" placeholder="Nome completo" aria-label="Nome do convidado" />' +
        '<input id="pnlaConvEmail" type="email" placeholder="e-mail @previ.com.br" aria-label="E-mail do convidado" /><button type="button" class="btn btn--primary" id="pnlaConvAdd">Incluir convidado</button></div><p id="pnlaConvMsg" class="pnla-msg"></p></div>';
      el.innerHTML = h;
      if (window.faAuth && window.faAuth.autoPreviDominio) window.faAuth.autoPreviDominio($('pnlaConvEmail'));
      $('pnlaConvAdd').addEventListener('click', function () {
        var nome = window.faTurmasUtil.nomePessoa($('pnlaConvNome').value), email = String($('pnlaConvEmail').value || '').trim().toLowerCase(), m = $('pnlaConvMsg');
        if (!nome || !email) { msg(m, 'Preencha nome e e-mail.', true); return; }
        if (!/^[^\s@]+@previ\.com\.br$/.test(email)) { msg(m, 'Use um e-mail @previ.com.br.', true); return; }
        var k = NUC.emailKey(email);
        if (lista[k]) { msg(m, 'Essa pessoa já é convidada.', true); return; }
        db().ref('fa-painel-convidados/' + k).set({ email: email, name: nome, addedAt: new Date().toISOString(), addedBy: eu() }, function (err) {
          if (err) { msg(m, 'Não foi possível incluir (' + (err.code || err.message || 'erro') + '). Nada foi gravado.', true); return; }
          convidados(); setTimeout(function () { msg($('pnlaConvMsg'), nome + ' incluído(a). Ele(a) passa a ver o menu Painel no próximo acesso.'); }, 50);
        });
      });
      el.querySelectorAll('[data-conv-rem]').forEach(function (b) {
        b.addEventListener('click', function () {
          var k = b.getAttribute('data-conv-rem'), td = b.parentNode;
          td.innerHTML = '<span class="pnla-confirma">Remover o acesso ao painel?</span> <button type="button" class="admin-del-btn" data-sim>Confirmar remoção</button> <button type="button" class="btn btn--sm" data-nao>Cancelar</button>';
          td.querySelector('[data-nao]').addEventListener('click', convidados);
          td.querySelector('[data-sim]').addEventListener('click', function () {
            db().ref('fa-painel-convidados/' + k).remove(function (err) {
              if (err) { td.innerHTML = '<span class="pnla-msg pnla-msg--erro" role="alert">Não foi possível remover (' + esc(err.code || err.message) + ').</span>'; return; }
              convidados();
            });
          });
        });
      });
    }, function (e) { el.innerHTML = '<h4>Convidados</h4><p class="pnla-msg pnla-msg--erro" role="alert">Não foi possível carregar os convidados (' + esc(e && (e.code || e.message)) + '). Recarregue a página.</p>'; });
  }

  /* ---------- 2. configuração ---------- */
  function configuracao() {
    var el = $('pnlaConfig');
    Promise.all([db().ref('programa-config').once('value'), db().ref('eventos').once('value'), db().ref('programa-publico-alvo/vigente').once('value')]).then(function (s) {
      var cfg = s[0].val() || {}, eventos = s[1].val() || {}, vigente = s[2].val();
      return (vigente ? db().ref('programa-publico-alvo/versoes/' + vigente + '/total').once('value').then(function (t) { return t.val(); }, function () { return null; }) : Promise.resolve(null)).then(function (totalBase) { desenharConfig(el, cfg, eventos, totalBase); });
    }, function (e) { el.innerHTML = '<h4>Configuração do programa</h4><p class="pnla-msg pnla-msg--erro" role="alert">Não foi possível carregar a configuração (' + esc(e && (e.code || e.message)) + ').</p>'; });
  }
  function desenharConfig(el, cfg, eventos, totalBase) {
    (function () {
      var evs = Object.keys(eventos).sort(function (a, b) { return (eventos[a].order || 0) - (eventos[b].order || 0); });
      var lim = cfg.limiteParalelo || {}, fmt = cfg.formatos || {}, comp = cfg.composicao || {}, fac = cfg.facilitacao || {};
      var facil = Object.keys(cfg.facilitadores || {}).map(function (k) { return cfg.facilitadores[k]; }).join('\n');
      var campoFmt = function (g) { var f = fmt[g] || {}; return '<fieldset class="pnla-fmt"><legend>Turma nova de ' + GR[g].toLowerCase() + '</legend>' +
        '<label>Encontros<input type="number" min="1" max="20" step="1" data-pnla-fmt="' + g + '" data-pnla-campo="encontros" value="' + esc(f.encontros || '') + '" /></label>' +
        '<label>Início<input type="time" data-pnla-fmt="' + g + '" data-pnla-campo="horarioInicio" value="' + esc(f.horarioInicio || '') + '" /></label>' +
        '<label>Término<input type="time" data-pnla-fmt="' + g + '" data-pnla-campo="horarioFim" value="' + esc(f.horarioFim || '') + '" /></label>' +
        '<label>Vagas<input type="number" min="1" max="500" step="1" data-pnla-fmt="' + g + '" data-pnla-campo="vagas" value="' + esc(f.vagas || '') + '" /></label></fieldset>'; };
      var h = '<h4>Configuração do programa</h4>' + (cfg.atualizadoEm ? '<p class="pnla-ajuda">Última alteração: ' + quando(cfg.atualizadoEm) + ' · ' + esc(cfg.atualizadoPor || '') + '</p>' : '<p class="pnla-ajuda">Ainda não configurado: o painel avisa o que falta.</p>') +
        '<div class="pnla-campos">' +
        '<label class="pnla-campo"><span>Data-limite da meta</span><input type="date" id="pnlaPrazo" value="' + esc(cfg.prazo || '') + '" /><small>Até quando 100% do público precisa ter realizado. Turmas que terminam depois não contam na viabilidade.</small></label>' +
        '<label class="pnla-campo"><span>Antecedência mínima de turma nova (dias úteis)</span><input type="number" id="pnlaAntecedencia" min="0" max="60" step="1" value="' + esc(cfg.antecedenciaDiasUteis == null ? '' : cfg.antecedenciaDiasUteis) + '" /><small>Quantos dias úteis depois de hoje uma turma extra poderia começar (convocação e inscrição). 0 = a partir do próximo dia útil.</small></label>' +
        '<label class="pnla-campo"><span>Turmas simultâneas de técnicos (máximo)</span><input type="number" id="pnlaLimT" min="1" max="10" step="1" value="' + esc(lim.tecnicos || '') + '" /></label>' +
        '<label class="pnla-campo"><span>Turmas simultâneas de gestores (máximo)</span><input type="number" id="pnlaLimG" min="1" max="10" step="1" value="' + esc(lim.gestores || '') + '" /><small>Simultâneas = no mesmo dia com horários que se sobrepõem.</small></label>' +
        '</div><fieldset class="pnla-eventos" data-pnla="facilitacao"><legend>Facilitação compartilhada (opcional)</legend><div class="pnla-campos">' +
        '<label class="pnla-campo"><span>Facilitadores disponíveis ao mesmo tempo</span><input type="number" id="pnlaFacDisp" min="1" max="20" step="1" value="' + esc(fac.disponiveis || '') + '" /></label>' +
        '<label class="pnla-campo"><span>Facilitadores por turma de técnicos</span><input type="number" id="pnlaFacTec" min="1" max="20" step="1" value="' + esc(fac.tecnicos || '') + '" /></label>' +
        '<label class="pnla-campo"><span>Facilitadores por turma de gestores</span><input type="number" id="pnlaFacGes" min="1" max="20" step="1" value="' + esc(fac.gestores || '') + '" /></label>' +
        '<label class="pnla-campo"><span>Facilitadores por turma sem público de cargo</span><input type="number" id="pnlaFacAberta" min="1" max="20" step="1" value="' + esc(fac.aberta || '') + '" /></label>' +
        '</div><small>Preenchido, substitui os limites de turmas simultâneas: no mesmo dia e horário, a soma dos facilitadores das turmas não passa do disponível (ex.: 2 disponíveis; técnicos 1, gestores 2, sem público de cargo 2 = ou duas de técnicos ou uma de gestores). Em branco = usa os limites acima.</small></fieldset>' +
        '<fieldset class="pnla-eventos"><legend>Eventos que fazem parte do programa</legend>' + (evs.length ? evs.map(function (k) {
          return '<label class="pnla-check"><input type="checkbox" data-pnla-evento="' + esc(k) + '"' + ((cfg.eventos || {})[k] ? ' checked' : '') + ' /> ' + esc(eventos[k].nome || k) + '</label>'; }).join('') : '<p class="admin-empty">Nenhum evento cadastrado.</p>') +
        '<small>Só turmas desses eventos contam na cobertura e na capacidade. Realizar um deles basta para a pessoa contar como atendida.</small></fieldset>' +
        '<label class="pnla-campo pnla-campo--largo"><span>Facilitadores fora do público (um e-mail por linha)</span><textarea id="pnlaFacil" rows="5" placeholder="nome@previ.com.br">' + esc(facil) + '</textarea><small>Saem do denominador, da cobertura e das pendências, mesmo que estejam na base oficial.</small></label>' +
        '<fieldset class="pnla-eventos" data-pnla="composicao"><legend>Composição do público e margem</legend><div class="pnla-campos">' +
        '<label class="pnla-campo"><span>Total de pessoas</span><input type="number" id="pnlaCompTotal" min="1" step="1" value="' + esc(comp.total || '') + '" /></label>' +
        '<label class="pnla-campo"><span>Situação não ativa (fora do público)</span><input type="number" id="pnlaCompInativa" min="0" step="1" value="' + esc(comp.situacaoInativa == null ? '' : comp.situacaoInativa) + '" /></label>' +
        '<label class="pnla-campo"><span>Cargo não compatível (fora do público)</span><input type="number" id="pnlaCompCargo" min="0" step="1" value="' + esc(comp.cargoIncompativel == null ? '' : comp.cargoIncompativel) + '" /></label>' +
        '<label class="pnla-campo"><span>Margem (dentro do público)</span><input type="number" id="pnlaMargem" min="0" step="1" value="' + esc(cfg.margem == null ? '' : cfg.margem) + '" /><small>Quantas pessoas do público podem não realizar sem comprometer a meta. Meta = público − margem.</small></label>' +
        '<label class="pnla-campo"><span>Ocupação esperada das turmas (%)</span><input type="number" id="pnlaOcupacao" min="1" max="100" step="1" value="' + esc(cfg.ocupacaoEsperada == null ? '' : cfg.ocupacaoEsperada) + '" /><small>Opcional. Cenário realista ao lado do máximo: de quem tem lugar nas turmas, quantos % realizam (nas turmas já feitas: realizados ÷ vagas). Em branco = sem cenário realista.</small></label>' +
        '</div><p class="pnla-ajuda" id="pnlaCompConta" aria-live="polite"></p><small>A conta precisa fechar: total = situação não ativa + cargo não compatível + público da base vigente' + (totalBase ? ' (' + totalBase + ')' : ' (nenhuma base importada)') + '.</small></fieldset>' +
        '<p class="pnla-ajuda">Formato de turma extra (opcional): deixe em branco para usar o da turma mais recente de cada público. Os encontros são simulados em dias úteis seguidos.</p>' +
        '<div class="pnla-fmts">' + campoFmt('tecnicos') + campoFmt('gestores') + '</div>' +
        '<label class="pnla-campo pnla-campo--largo"><span>Motivo da alteração (opcional, fica na auditoria)</span><input type="text" id="pnlaMotivo" maxlength="500" /></label>' +
        '<button type="button" class="btn btn--primary" id="pnlaSalvarCfg">Salvar configuração</button><p id="pnlaCfgMsg" class="pnla-msg"></p>' +
        '<details class="pnla-aud"><summary>Histórico de alterações</summary><div id="pnlaAud"><p class="loading-msg">Carregando…</p></div></details>';
      el.innerHTML = h;
      var conta = function () {
        var t = Number($('pnlaCompTotal').value), i = Number($('pnlaCompInativa').value) || 0, c = Number($('pnlaCompCargo').value) || 0, m = Number($('pnlaMargem').value) || 0, p = $('pnlaCompConta');
        if (!($('pnlaCompTotal').value) || !totalBase) { p.textContent = totalBase ? 'Informe o total para conferir a conta.' + (m ? ' Meta: ' + (totalBase - m) + ' pessoas.' : '') : 'Importe a base oficial para conferir a conta.'; p.className = 'pnla-ajuda'; return; }
        var soma = i + c + totalBase, fecha = soma === t;
        p.textContent = i + ' + ' + c + ' + ' + totalBase + ' = ' + soma + (fecha ? ' — a conta fecha com o total (' + t + ').' : ' — NÃO fecha com o total ' + t + ' (diferença de ' + Math.abs(t - soma) + ').') + (m ? ' Meta: ' + (totalBase - m) + ' pessoas (público ' + totalBase + ' − margem ' + m + ').' : '');
        p.className = 'pnla-msg ' + (fecha ? 'pnla-msg--ok' : 'pnla-msg--erro');
      };
      ['pnlaCompTotal', 'pnlaCompInativa', 'pnlaCompCargo', 'pnlaMargem'].forEach(function (id) { $(id).addEventListener('input', conta); });
      conta();
      el.querySelector('details.pnla-aud').addEventListener('toggle', function (e) { if (e.target.open) carregarAuditoria(); });
      $('pnlaSalvarCfg').addEventListener('click', function () { salvarConfig(cfg, eventos); });
    })();
  }
  function salvarConfig(atual, eventos) {
    var m = $('pnlaCfgMsg'), erros = [];
    var prazo = $('pnlaPrazo').value, ant = $('pnlaAntecedencia').value, limT = $('pnlaLimT').value, limG = $('pnlaLimG').value;
    var int = function (v, a, b) { var n = Number(v); return v !== '' && n % 1 === 0 && n >= a && n <= b ? n : null; };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(prazo)) erros.push('a data-limite');
    var antN = ant === '' ? 0 : int(ant, 0, 60); if (antN === null) erros.push('a antecedência (0 a 60 dias úteis)');
    var lt = int(limT, 1, 10), lg = int(limG, 1, 10); if (lt === null || lg === null) erros.push('os limites de turmas simultâneas (1 a 10)');
    var facV = ['pnlaFacDisp', 'pnlaFacTec', 'pnlaFacGes', 'pnlaFacAberta'].map(function (id) { return $(id).value; }), facilitacao = null;
    if (facV.some(function (v) { return v !== ''; })) { var fn = facV.map(function (v) { return int(v, 1, 20); }); if (fn.some(function (v) { return v === null; })) erros.push('a facilitação compartilhada (os quatro campos, números inteiros de 1 a 20)'); else facilitacao = { disponiveis: fn[0], tecnicos: fn[1], gestores: fn[2], aberta: fn[3] }; }
    var evSel = {}; document.querySelectorAll('#pnlaConfig [data-pnla-evento]').forEach(function (c) { if (c.checked && eventos[c.getAttribute('data-pnla-evento')]) evSel[c.getAttribute('data-pnla-evento')] = true; });
    if (!Object.keys(evSel).length) erros.push('pelo menos um evento do programa');
    var facil = {}, invalidos = [];
    String($('pnlaFacil').value || '').split(/[\s,;]+/).map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean).forEach(function (e) { if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) facil[NUC.emailKey(e)] = e; else invalidos.push(e); });
    if (invalidos.length) erros.push('os e-mails de facilitadores (' + invalidos.join(', ') + ')');
    var formatos = {};
    ['tecnicos', 'gestores'].forEach(function (g) {
      var v = {}; document.querySelectorAll('#pnlaConfig [data-pnla-fmt="' + g + '"]').forEach(function (i) { v[i.getAttribute('data-pnla-campo')] = i.value; });
      var preenchidos = Object.keys(v).filter(function (k) { return v[k] !== ''; }).length;
      if (!preenchidos) return;
      var enc = int(v.encontros, 1, 20), vag = int(v.vagas, 1, 500);
      if (preenchidos < 4 || enc === null || vag === null || !/^\d{2}:\d{2}$/.test(v.horarioInicio) || !/^\d{2}:\d{2}$/.test(v.horarioFim) || v.horarioFim <= v.horarioInicio) { erros.push('o formato de turma de ' + GR[g].toLowerCase() + ' (preencha os quatro campos, término depois do início)'); return; }
      formatos[g] = { encontros: enc, horarioInicio: v.horarioInicio, horarioFim: v.horarioFim, vagas: vag };
    });
    var compT = $('pnlaCompTotal').value, compI = $('pnlaCompInativa').value, compC = $('pnlaCompCargo').value, margemV = $('pnlaMargem').value, composicao = null, margemN = null, ocupV = $('pnlaOcupacao').value, ocupN = null;
    if (compT !== '' || compI !== '' || compC !== '') {
      var ct = int(compT, 1, 1000000), ci = compI === '' ? 0 : int(compI, 0, 1000000), cc = compC === '' ? 0 : int(compC, 0, 1000000);
      if (ct === null || ci === null || cc === null) erros.push('a composição do público (números inteiros; o total é obrigatório quando houver composição)'); else composicao = { total: ct, situacaoInativa: ci, cargoIncompativel: cc };
    }
    if (margemV !== '') { margemN = int(margemV, 0, 100000); if (margemN === null) erros.push('a margem (número inteiro, 0 ou mais)'); }
    if (ocupV !== '') { ocupN = int(ocupV, 1, 100); if (ocupN === null) erros.push('a ocupação esperada (número inteiro de 1 a 100)'); }
    if (erros.length) { msg(m, 'Confira: ' + erros.join('; ') + '. Nada foi gravado.', true); return; }
    var novo = { prazo: prazo, eventos: evSel, antecedenciaDiasUteis: antN, limiteParalelo: { tecnicos: lt, gestores: lg }, atualizadoEm: TS(), atualizadoPor: eu() };
    if (Object.keys(facil).length) novo.facilitadores = facil;
    if (Object.keys(formatos).length) novo.formatos = formatos;
    if (composicao) novo.composicao = composicao;
    if (margemN !== null) novo.margem = margemN;
    if (ocupN !== null) novo.ocupacaoEsperada = ocupN;
    if (facilitacao) novo.facilitacao = facilitacao;
    var motivo = $('pnlaMotivo').value, upd = { 'programa-config': novo }, mudou = 0;
    ['prazo', 'eventos', 'facilitadores', 'antecedenciaDiasUteis', 'limiteParalelo', 'formatos', 'composicao', 'margem', 'ocupacaoEsperada', 'facilitacao'].forEach(function (k) {
      var a = JSON.stringify(atual[k] == null ? null : atual[k]), b = JSON.stringify(novo[k] == null ? null : novo[k]);
      if (a !== b) { mudou++; upd['programa-config-auditoria/' + chaveAud()] = auditoria(k, a === 'null' ? '' : a, b === 'null' ? '' : b, motivo); }
    });
    if (!mudou) { msg(m, 'Nenhuma alteração para salvar.'); return; }
    $('pnlaSalvarCfg').disabled = true;
    db().ref().update(upd, function (err) {
      $('pnlaSalvarCfg').disabled = false;
      if (err) { msg(m, 'Não foi possível salvar (' + (err.code || err.message || 'erro') + '). Nada foi gravado.', true); return; }
      configuracao(); setTimeout(function () { msg($('pnlaCfgMsg'), 'Configuração salva (' + mudou + ' alteração' + (mudou > 1 ? 'ões' : '') + ' na auditoria). O painel usa os valores novos no próximo "Atualizar dados".'); }, 50);
    });
  }
  function carregarAuditoria() {
    var el = $('pnlaAud');
    db().ref('programa-config-auditoria').once('value').then(function (s) {
      var v = s.val() || {}, ks = Object.keys(v).sort(function (a, b) { return (v[b].em || 0) - (v[a].em || 0); });
      el.innerHTML = ks.length ? '<div class="table-scroll-wrap"><table class="admin-table"><thead><tr><th>Quando</th><th>Quem</th><th>O quê</th><th>Antes</th><th>Depois</th><th>Motivo</th></tr></thead><tbody>' + ks.map(function (k) { var x = v[k];
        return '<tr><td>' + quando(x.em) + '</td><td>' + esc(x.por) + '</td><td>' + esc(x.campo) + '</td><td class="pnla-valor">' + esc(x.antes) + '</td><td class="pnla-valor">' + esc(x.depois) + '</td><td>' + esc(x.motivo || '') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="admin-empty">Nenhuma alteração registrada.</p>';
    }, function (e) { el.innerHTML = '<p class="pnla-msg pnla-msg--erro" role="alert">Não foi possível carregar o histórico (' + esc(e && (e.code || e.message)) + ').</p>'; });
  }

  /* ---------- 3. dias sem expediente ---------- */
  function calendario() {
    var el = $('pnlaCalendario');
    db().ref('programa-calendario').once('value').then(function (s) {
      var v = s.val() || {}, ks = Object.keys(v).sort();
      var h = '<h4>Dias sem expediente <span class="admin-badge">' + ks.length + '</span></h4><p class="pnla-ajuda">Sábados e domingos já não contam. Cadastre aqui feriados nacionais, estaduais e municipais e os dias sem expediente da PREVI. Ponto facultativo só entra se não houver expediente. Nenhuma turma extra é simulada nesses dias.</p>';
      h += ks.length ? '<div class="table-scroll-wrap"><table class="admin-table"><thead><tr><th>Data</th><th>Motivo</th><th>Cadastrado por</th><th></th></tr></thead><tbody>' + ks.map(function (k) {
        return '<tr><td>' + brAno(k) + '</td><td>' + esc(v[k].motivo) + '</td><td>' + esc(v[k].por || '') + '</td><td class="pnla-acoes"><button type="button" class="admin-del-btn" data-dia-rem="' + esc(k) + '">Remover</button></td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="admin-empty">Nenhum dia cadastrado.</p>';
      h += '<div class="admin-colab-form"><div class="admin-colab-row"><input id="pnlaDia" type="date" aria-label="Data sem expediente" /><input id="pnlaDiaMotivo" type="text" maxlength="200" placeholder="Motivo (ex.: Dia da Consciência Negra)" aria-label="Motivo" /><button type="button" class="btn btn--primary" id="pnlaDiaAdd">Cadastrar dia</button></div><p id="pnlaDiaMsg" class="pnla-msg"></p></div>';
      el.innerHTML = h;
      $('pnlaDiaAdd').addEventListener('click', function () {
        var d = $('pnlaDia').value, mo = String($('pnlaDiaMotivo').value || '').trim(), m = $('pnlaDiaMsg');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !mo) { msg(m, 'Preencha a data e o motivo.', true); return; }
        var w = new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8)).getDay();
        if (w === 0 || w === 6) { msg(m, 'Essa data cai no fim de semana, que já não conta. Nada foi gravado.', true); return; }
        if (v[d]) { msg(m, 'Esse dia já está cadastrado.', true); return; }
        var upd = {}; upd['programa-calendario/' + d] = { motivo: mo.slice(0, 200), em: TS(), por: eu() }; upd['programa-config-auditoria/' + chaveAud()] = auditoria('calendario', '', d + ' ' + mo);
        db().ref().update(upd, function (err) {
          if (err) { msg(m, 'Não foi possível cadastrar (' + (err.code || err.message) + '). Nada foi gravado.', true); return; }
          calendario(); setTimeout(function () { msg($('pnlaDiaMsg'), brAno(d) + ' cadastrado.'); }, 50);
        });
      });
      el.querySelectorAll('[data-dia-rem]').forEach(function (b) {
        b.addEventListener('click', function () {
          var d = b.getAttribute('data-dia-rem'), td = b.parentNode;
          td.innerHTML = '<span class="pnla-confirma">Retirar este dia?</span> <button type="button" class="admin-del-btn" data-sim>Confirmar</button> <button type="button" class="btn btn--sm" data-nao>Cancelar</button>';
          td.querySelector('[data-nao]').addEventListener('click', calendario);
          td.querySelector('[data-sim]').addEventListener('click', function () {
            var upd = {}; upd['programa-calendario/' + d] = null; upd['programa-config-auditoria/' + chaveAud()] = auditoria('calendario', d + ' ' + (v[d].motivo || ''), '');
            db().ref().update(upd, function (err) { if (err) { td.innerHTML = '<span class="pnla-msg pnla-msg--erro" role="alert">Não foi possível retirar (' + esc(err.code || err.message) + ').</span>'; return; } calendario(); });
          });
        });
      });
    }, function (e) { el.innerHTML = '<h4>Dias sem expediente</h4><p class="pnla-msg pnla-msg--erro" role="alert">Não foi possível carregar (' + esc(e && (e.code || e.message)) + ').</p>'; });
  }

  /* ---------- 4. base oficial (prévia + confirmação) ---------- */
  var COLUNAS = { nome: ['ANNOME', 'NOME'], email: ['ANEMAIL', 'EMAIL', 'E-MAIL'], gerencia: ['GERENCIA'], diretoria: ['DIRETORIA'] };
  var OPCIONAIS = { nivel: ['NIVEL', 'PUBLICO'] };   /* técnico, gerente, diretor ou assessor; sem a coluna, gestor = lista de Gerentes do site */
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase(); }
  function carregarXlsx(cb) {
    if (window.XLSX) { cb(); return; }
    var src = 'forca-agil/xlsx.mini.min.js', ex = document.querySelector('script[data-avp-lib="' + src + '"]');
    if (ex) { ex.addEventListener('load', function () { cb(); }); ex.addEventListener('error', function () { cb(new Error('falha')); }); return; }
    var sc = document.createElement('script'); sc.src = src; sc.setAttribute('data-avp-lib', src);
    sc.onload = function () { cb(); }; sc.onerror = function () { cb(new Error('falha')); }; document.head.appendChild(sc);
  }
  function linhasDaPlanilha(matriz) {
    var cab = -1, idx = {};
    for (var i = 0; i < Math.min(matriz.length, 10) && cab < 0; i++) {
      var r = (matriz[i] || []).map(norm), achou = {};
      Object.keys(COLUNAS).forEach(function (c) { var j = r.findIndex(function (x) { return COLUNAS[c].indexOf(x) !== -1; }); if (j !== -1) achou[c] = j; });
      if (Object.keys(achou).length === 4) { cab = i; idx = achou; Object.keys(OPCIONAIS).forEach(function (c) { var j = r.findIndex(function (x) { return OPCIONAIS[c].indexOf(x) !== -1; }); if (j !== -1) idx[c] = j; }); }
    }
    if (cab < 0) return null;
    return matriz.slice(cab + 1).filter(function (r) { return r && r.some(function (x) { return String(x == null ? '' : x).trim(); }); })
      .map(function (r) { return { nome: String(r[idx.nome] == null ? '' : r[idx.nome]).trim(), email: String(r[idx.email] == null ? '' : r[idx.email]).trim(), gerencia: String(r[idx.gerencia] == null ? '' : r[idx.gerencia]).trim(), diretoria: String(r[idx.diretoria] == null ? '' : r[idx.diretoria]).trim(), nivel: idx.nivel == null ? '' : String(r[idx.nivel] == null ? '' : r[idx.nivel]).trim() }; });
  }
  function base() {
    var el = $('pnlaBase');
    db().ref('programa-publico-alvo').once('value').then(function (s) {
      var v = s.val() || {}, vig = v.vigente, ver = vig && (v.versoes || {})[vig];
      var h = '<h4>Base oficial do público-alvo</h4>' + (ver ? '<p class="pnla-ajuda">Vigente: <b>versão ' + vig + '</b> · ' + ver.total + ' pessoas · importada em ' + quando(ver.importadaEm) + ' por ' + esc(ver.importadaPor) + ' · ' + esc(ver.origem) + '. Versões anteriores ficam guardadas.</p>' : '<p class="pnla-ajuda">Nenhuma base importada: o painel não calcula sem ela.</p>') +
        '<p class="pnla-ajuda">Planilha (.xlsx ou .csv) com as colunas <b>nome</b> (ou ANNOME), <b>e-mail</b> (ou ANEMAIL), <b>gerência</b> e <b>diretoria</b>, na primeira aba. Primeiro aparece a prévia; nada é gravado até você confirmar. Nada é corrigido nem excluído: os pontos estranhos são só sinalizados.</p>' +
        '<label class="pnla-arquivo">Escolher planilha<input type="file" id="pnlaArquivo" accept=".xlsx,.csv" /></label><p id="pnlaBaseMsg" class="pnla-msg"></p><div id="pnlaPrevia"></div>';
      el.innerHTML = h;
      $('pnlaArquivo').addEventListener('change', function (e) { var f = e.target.files && e.target.files[0]; if (f) ler(f, v); });
    }, function (e) { el.innerHTML = '<h4>Base oficial do público-alvo</h4><p class="pnla-msg pnla-msg--erro" role="alert">Não foi possível carregar (' + esc(e && (e.code || e.message)) + ').</p>'; });
  }
  function ler(arquivo, atual) {
    var m = $('pnlaBaseMsg'), alvo = $('pnlaPrevia'); alvo.innerHTML = ''; msg(m, 'Lendo a planilha…');
    carregarXlsx(function (falha) {
      if (falha) { msg(m, 'Não foi possível carregar o leitor de planilhas. Recarregue a página.', true); return; }
      var fr = new FileReader();
      fr.onerror = function () { msg(m, 'Não foi possível ler o arquivo.', true); };
      fr.onload = function () {
        var linhas;
        try { var wb = window.XLSX.read(new Uint8Array(fr.result), { type: 'array' }); linhas = linhasDaPlanilha(window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' })); }
        catch (e) { msg(m, 'O arquivo não parece uma planilha válida.', true); return; }
        if (!linhas) { msg(m, 'Não encontrei as quatro colunas (nome, e-mail, gerência, diretoria) nas primeiras linhas da primeira aba.', true); return; }
        if (!linhas.length) { msg(m, 'A planilha não tem linhas de dados.', true); return; }
        msg(m, 'Conferindo com os cadastros do site…');
        var op = db().ref('fa-outros-publicos').once('value').then(function (s) { return s.val() || {}; }, function () { return null; });
        Promise.all([db().ref('fa-users').once('value'), db().ref('fa-gerentes').once('value'), db().ref('programa-config/facilitadores').once('value'), op]).then(function (s) {
          var vig = atual.vigente && (atual.versoes || {})[atual.vigente];
          var pr = NUC.previaBase(linhas, { users: s[0].val() || {}, gerentes: s[1].val() || {}, facilitadores: s[2].val() || {}, outrosPublicos: s[3], vigente: vig || null });
          msg(m, ''); m.textContent = '';
          previa(pr, arquivo.name, atual, s[3] === null);
        }, function (e) { msg(m, 'Não foi possível ler os cadastros para a conferência (' + (e && (e.code || e.message)) + '). Nada foi gravado.', true); });
      };
      fr.readAsArrayBuffer(arquivo);
    });
  }
  function previa(pr, nomeArq, atual, semOutros) {
    var alvo = $('pnlaPrevia'), P = pr.problemas;
    var lista = function (titulo, itens, fmt) { return itens.length ? '<li><b>' + titulo + ' (' + itens.length + '):</b> ' + itens.slice(0, 30).map(fmt).map(esc).join(' · ') + (itens.length > 30 ? ' …' : '') + '</li>' : ''; };
    var probs = lista('E-mail repetido — só a primeira linha entra', P.emailRepetido, function (x) { return 'linha ' + x.linha + ' (' + x.email + ', igual à linha ' + x.primeira + ')'; }) +
      lista('E-mail inválido — linha não entra', P.emailInvalido, function (x) { return 'linha ' + x.linha + ' (' + x.email + ')'; }) +
      lista('Sem e-mail — linha não entra', P.semEmail, function (x) { return 'linha ' + x; }) +
      lista('E-mail fora de @previ.com.br — entra, sinalizado (não terá cadastro no site, que só aceita @previ)', P.foraDoDominio, function (x) { return x.email; }) +
      lista('Mesmo nome em linhas diferentes — entram as duas, conferir', P.nomeRepetido, function (x) { return x.nome + ' (linhas ' + x.linhas.join(', ') + ')'; }) +
      lista('Sem diretoria', P.semDiretoria, function (x) { return 'linha ' + x; }) + lista('Sem gerência', P.semGerencia, function (x) { return 'linha ' + x; }) +
      lista('Cadastradas em Outros públicos — conferir o nível', pr.outrosPublicos, function (x) { return x; }) +
      lista('Nível que o painel não reconhece (use técnico, gerente, diretor ou assessor)', P.nivelDesconhecido || [], function (x) { return 'linha ' + x.linha + ' (' + x.nivel + ')'; }) +
      lista('Gerente na planilha e fora da lista de Gerentes do site (as regras de inscrição não a tratam como gerente)', pr.gerenteForaDaLista, function (x) { return x; }) +
      lista('Na lista de Gerentes do site, mas com outro nível na planilha', pr.naListaNaoGerente, function (x) { return x; });
    var d = pr.diferenca, dirs = Object.keys(pr.diretorias).sort();
    var h = '<div class="pnla-previa" data-pnla="previa"><h5>Prévia de ' + esc(nomeArq) + '</h5><div class="pnla-numeros">' +
      [['Linhas lidas', pr.total], ['Pessoas válidas', pr.validas], ['Com cadastro no site', pr.cadastrados], ['Sem cadastro', pr.semCadastro], ['Técnicos', pr.porPublico.tecnicos], ['Gestores', pr.porPublico.gestores], ['Diretores', pr.porPublico.diretores], ['Assessores', pr.porPublico.assessores], ['Facilitadores na base', pr.facilitadoresNaBase.length], ['Público do painel', pr.publicoEfetivo]]
        .map(function (x) { return '<div><small>' + x[0] + '</small><b>' + x[1] + '</b></div>'; }).join('') + '</div>' +
      (probs ? '<ul class="pnla-problemas">' + probs + '</ul>' : '<p class="pnla-msg pnla-msg--ok">Nenhum ponto a conferir.</p>') +
      '<p class="pnla-ajuda">' + (pr.comNivel ? 'Público de cada pessoa pela coluna nível da planilha (' + pr.comNivel + ' de ' + pr.validas + ' com nível).' : 'Sem a coluna nível: gestor = está na lista de Gerentes do site; o resto conta como técnico.') + '</p>' +
      (semOutros ? '<p class="pnla-ajuda">A lista de Outros públicos só os super-admins leem: ela não foi conferida nesta prévia.</p>' : '') +
      (d ? '<p class="pnla-ajuda">Em relação à versão vigente: ' + d.entram.length + ' entram, ' + d.saem.length + ' saem, ' + d.mudam.length + ' mudam de nome, gerência ou diretoria.</p>' : '') +
      '<details><summary>Pessoas por diretoria (' + dirs.length + ')</summary><div class="table-scroll-wrap"><table class="admin-table"><tbody>' + dirs.map(function (k) { return '<tr><td>' + esc(k) + '</td><td>' + pr.diretorias[k] + '</td></tr>'; }).join('') + '</tbody></table></div></details>' +
      (probs ? '<label class="pnla-check"><input type="checkbox" id="pnlaConferi" /> Conferi os pontos sinalizados e quero importar assim mesmo.</label>' : '') +
      '<div class="pnla-botoes"><button type="button" class="btn btn--primary" id="pnlaImportar"' + (pr.validas ? '' : ' disabled') + '>Confirmar importação</button><button type="button" class="btn" id="pnlaDescartar">Descartar</button></div><p id="pnlaImpMsg" class="pnla-msg"></p></div>';
    alvo.innerHTML = h;
    $('pnlaDescartar').addEventListener('click', function () { alvo.innerHTML = ''; $('pnlaArquivo').value = ''; });
    $('pnlaImportar').addEventListener('click', function () {
      var m = $('pnlaImpMsg');
      if ($('pnlaConferi') && !$('pnlaConferi').checked) { msg(m, 'Marque que conferiu os pontos sinalizados.', true); return; }
      var nums = Object.keys(atual.versoes || {}).map(Number).filter(function (x) { return x > 0; }), n = (nums.length ? Math.max.apply(null, nums) : 0) + 1;
      var pessoas = {}; Object.keys(pr.pessoas).forEach(function (k) { var p = pr.pessoas[k]; pessoas[k] = { email: p.email.slice(0, 200), nome: p.nome.slice(0, 200), gerencia: p.gerencia.slice(0, 60), diretoria: p.diretoria.slice(0, 60) }; if (p.nivel) pessoas[k].nivel = p.nivel; });
      var upd = {};
      upd['programa-publico-alvo/versoes/' + n] = { importadaEm: TS(), importadaPor: eu(), total: pr.validas, origem: (nomeArq + ' (' + pr.total + ' linhas)').slice(0, 200), pessoas: pessoas };
      upd['programa-publico-alvo/vigente'] = n;
      upd['programa-config-auditoria/' + chaveAud()] = auditoria('base', atual.vigente ? 'versão ' + atual.vigente : '', 'versão ' + n + ' (' + pr.validas + ' pessoas, ' + nomeArq + ')');
      $('pnlaImportar').disabled = true; msg(m, 'Gravando…');
      db().ref().update(upd, function (err) {
        if (err) { $('pnlaImportar').disabled = false; msg(m, 'Não foi possível gravar (' + (err.code || err.message || 'erro') + '). Nada foi gravado.', true); return; }
        base(); setTimeout(function () { msg($('pnlaBaseMsg'), 'Versão ' + n + ' importada e vigente (' + pr.validas + ' pessoas).'); }, 50);
      });
    });
  }

  window.faInitPainelAdmin = init;
  window.faPainelAdminInterno = { linhasDaPlanilha: linhasDaPlanilha };
})();
