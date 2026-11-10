/* ============================================================
   Força Ágil — PAINEL DO PROGRAMA (#painel)

   Visão executiva (4 blocos: cobertura, viabilidade, principais gaps, decisões) e consultas (#painel?v=diretorias |
   mobilizacao | ausencias | capacidade | evolucao). Só para o admin geral e os convidados (fa-painel-convidados; router.js
   e as regras do banco). Convidado só consulta: nada aqui grava no banco.

   Atualização: os dados são lidos do Firebase UMA vez ao abrir e de novo a cada "Atualizar dados" — sem ouvintes
   permanentes, sem agendamento. O horário mostrado é o da última LEITURA concluída (relógio do servidor), nunca o da
   abertura da página. Falha de leitura mantém os números anteriores, com o horário deles e o aviso.

   Todo número vem de faProgramaCobertura.calcular (programa-cobertura-nucleo.js). Nada é calculado aqui.
   ============================================================ */
(function () {
  'use strict';
  var NUC = window.faProgramaCobertura;
  var NOS = ['eventos', 'turmas', 'turmas-config', 'turmas-interesse', 'turmas-checkin', 'fa-users', 'fa-gerentes', 'fa-diretores',
    'eventos-publico', 'turmas-publico', 'programa-config', 'programa-calendario'];
  var VISTAS = { diretorias: 'Diretorias e áreas', mobilizacao: 'Mobilização', ausencias: 'Ausências e registros de presença', capacidade: 'Capacidade e calendário', evolucao: 'Evolução' };
  var ROT = { realizou: 'Realizou', inscrita: 'Inscrita', interessada: 'Interessada', 'sem-engajamento': 'Cadastrada sem engajamento', 'sem-cadastro': 'Sem cadastro' };
  var COR = { realizou: '#7ee2a8', inscrita: '#7af0e8', interessada: '#5aa0ee', 'sem-engajamento': '#f6be7b', 'sem-cadastro': '#ffa39b' };
  var FATOR = { capacidade: 'Capacidade insuficiente', mobilizacao: 'Mobilização insuficiente', calendario: 'Calendário insuficiente' };
  var NOMEG = { tecnicos: 'técnicos', gestores: 'gestores', diretores: 'diretores', assessores: 'assessores' };
  var st = { r: null, lidoEm: null, carregando: false, erro: null, base: null };

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function f1(v) { return (Math.round(v * 10) / 10).toFixed(1).replace('.', ','); }
  function pct(a, b) { return b ? f1(a / b * 100) + '%' : '—'; }
  function br(iso) { if (!iso) return '—'; var p = iso.split('-'); return p[2] + '/' + p[1]; }
  function brAno(iso) { if (!iso) return '—'; var p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function hojeLocal() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function hora(ms) { var d = new Date(ms); return brAno(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')) + ', ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function vista() { var m = /[?&]v=([a-z]+)/.exec(location.hash || ''); return m && VISTAS[m[1]] ? m[1] : 'executiva'; }
  function linkVista(v, txt) { return '<a class="avp-voltar-link pnl-nav" href="#painel?v=' + v + '">' + esc(txt) + ' →</a>'; }

  /* ---------- leitura (uma passada; nenhum ouvinte fica aberto) ---------- */
  function ler() {
    var db = firebase.database();
    var umaVez = function (p) { return db.ref(p).once('value').then(function (s) { return s.val(); }, function (e) { var x = new Error('leitura'); x.no = p; x.causa = e; throw x; }); };
    var offset = db.ref('.info/serverTimeOffset').once('value').then(function (s) { return Number(s.val()) || 0; }, function () { return 0; });
    var ativo = db.ref('publicos-config/ativo').once('value').then(function (s) { return s.val() === true; }, function () { return null; });
    var base = umaVez('programa-publico-alvo/vigente').then(function (v) {
      if (!v) return null;
      return umaVez('programa-publico-alvo/versoes/' + v).then(function (ver) { return ver ? { versao: v, importadaEm: ver.importadaEm, origem: ver.origem, total: ver.total, pessoas: ver.pessoas || {} } : null; });
    });
    return Promise.all([Promise.all(NOS.map(umaVez)), base, ativo, offset]).then(function (x) {
      var d = {}; NOS.forEach(function (n, i) { d[n] = x[0][i] || {}; });
      return { dados: d, base: x[1], ativo: x[2], offset: x[3] };
    });
  }
  function montarEntrada(l) {
    var d = l.dados;
    return { hoje: hojeLocal(), eventos: d.eventos, turmas: d.turmas, config: d['turmas-config'], interesse: d['turmas-interesse'], checkin: d['turmas-checkin'],
      users: d['fa-users'], gerentes: d['fa-gerentes'], diretores: d['fa-diretores'], eventosPublico: d['eventos-publico'], turmasPublico: d['turmas-publico'],
      publicosAtivo: l.ativo, programa: d['programa-config'] || {}, calendario: d['programa-calendario'] || {}, base: l.base };
  }
  function atualizar() {
    if (st.carregando) return;
    st.carregando = true; st.erro = null; render();
    ler().then(function (l) {
      var r = NUC.calcular(montarEntrada(l), window.faTurmasUtil, window.faPublicosNucleo);
      st.r = r; st.base = l.base; st.lidoEm = Date.now() + l.offset;
    }).catch(function (e) {
      console.warn('[painel] leitura falhou', e && e.no, e && e.causa);
      st.erro = e && e.no ? 'Não foi possível ler os dados agora (' + e.no + ').' : 'Não foi possível calcular os indicadores agora.';
    }).then(function () { st.carregando = false; render(); });
  }

  /* ---------- cabeçalho ---------- */
  function cabecalho(titulo, sub, comVoltar) {
    var r = st.r, h = '<div class="pnl-topo"><div class="pnl-topo-titulo">' + (comVoltar ? '<a class="avp-voltar-link" href="#painel">← Voltar ao painel</a>' : '') +
      '<span class="eyebrow">Painel do Programa</span><h1>' + esc(titulo) + '</h1>' + (sub ? '<p class="pnl-sub">' + esc(sub) + '</p>' : '') + '</div>';
    h += '<div class="pnl-estado" aria-live="polite">';
    if (r && r.prazo) h += '<span class="pnl-prazo">Data-limite da meta: <b>' + brAno(r.prazo) + '</b></span>';
    h += '<span class="pnl-lido" data-pnl="lido">' + (st.lidoEm ? 'Dados lidos em ' + hora(st.lidoEm) : 'Dados ainda não lidos') + '</span>';
    h += '<button type="button" class="btn btn--sm" data-pnl="atualizar"' + (st.carregando ? ' disabled aria-busy="true"' : '') + '>' + (st.carregando ? 'Atualizando…' : 'Atualizar dados') + '</button>';
    if (st.erro) h += '<span class="pnl-erro" role="alert" data-pnl="erro">' + esc(st.erro) + (st.lidoEm ? ' Os números exibidos são de ' + hora(st.lidoEm) + '.' : '') + '</span>';
    return h + '</div></div>';
  }
  function avisoPendencias(r) {
    var faltam = r.pendencias.map(function (p) { return { prazo: 'a data-limite', eventos: 'os eventos que fazem parte do programa', base: 'a base oficial do público-alvo' }[p]; });
    var admin = window.faAuth && window.faAuth.getSession() && window.faAuth.isAdmin(window.faAuth.getSession().email);
    return '<div class="pnl-alerta" data-pnl="pendencias"><b>Configuração incompleta.</b> Falta definir ' + faltam.join(', ') + '. ' +
      (admin ? '<a class="avp-mapa-link" href="#admin" data-pnl-admin>Configurar em ADMIN › Painel do Programa</a>' : 'Peça à administração do programa.') + '</div>';
  }

  /* ---------- visão executiva ---------- */
  function regua(r) {
    var W = 640, x = function (v) { return Math.max(0, Math.min(W, v / 100 * W)); }, p = r.pct;
    return '<svg class="pnl-regua" viewBox="0 0 640 104" role="img" aria-label="Realizado ' + f1(p.realizado) + '%; máximo com as turmas planejadas ' + f1(p.maxPlanejado) + '%; máximo com as turmas que cabem no calendário ' + f1(p.maxExpansao) + '%; meta 100%">' +
      '<defs><pattern id="pnlHach" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="#ff3b30" stroke-width="3" opacity=".55"/></pattern></defs>' +
      '<rect x="0" y="40" width="640" height="24" rx="12" fill="rgba(255,255,255,.07)"/>' +
      '<rect x="0" y="40" width="' + x(p.maxExpansao) + '" height="24" rx="12" fill="rgba(122,240,232,.10)" stroke="#7af0e8" stroke-dasharray="4 3"/>' +
      '<rect x="0" y="40" width="' + x(p.maxPlanejado) + '" height="24" rx="12" fill="rgba(122,240,232,.35)"/>' +
      '<rect x="0" y="40" width="' + x(p.realizado) + '" height="24" rx="12" fill="#7ee2a8"/>' +
      (p.maxExpansao < 100 ? '<rect x="' + x(p.maxExpansao) + '" y="40" width="' + (W - x(p.maxExpansao)) + '" height="24" fill="url(#pnlHach)"/>' : '') +
      '<line x1="' + Math.min(638, x(r.pctMeta)) + '" y1="30" x2="' + Math.min(638, x(r.pctMeta)) + '" y2="74" stroke="#f5c518" stroke-width="3"/>' +
      '<g font-family="Oswald, sans-serif" font-size="14">' +
      '<text x="' + Math.max(40, x(p.realizado)) + '" y="26" fill="#7ee2a8" text-anchor="middle">Realizado ' + f1(p.realizado) + '%</text>' +
      '<text x="' + Math.min(560, Math.max(90, x(p.maxPlanejado))) + '" y="86" fill="#b8c6e4" text-anchor="middle">Planejadas ' + f1(p.maxPlanejado) + '%</text>' +
      '<text x="' + Math.min(540, Math.max(120, x(p.maxExpansao))) + '" y="26" fill="#7af0e8" text-anchor="middle">Com as que cabem ' + f1(p.maxExpansao) + '%</text>' +
      '<text x="' + Math.min(634, x(r.pctMeta)) + '" y="100" fill="#f5c518" text-anchor="end">Meta ' + f1(r.pctMeta) + '%</text></g></svg>';
  }
  function executiva(r) {
    var c = r.cap, nec = (c.tecnicos.necessarias || 0) + (c.gestores.necessarias || 0), cabem = (c.tecnicos.abrir || 0) + (c.gestores.abrir || 0);
    var semTurma = Math.max(0, r.meta - r.realizou - r.maxExpansao), ang = r.N ? r.realizou / r.N * 314.16 : 0;
    var h = '<div class="pnl-grade">';
    /* 1. cobertura */
    h += '<article class="pnl-card" data-pnl="bloco-cobertura"><h2>1 · Cobertura</h2><div class="pnl-cob">' +
      '<svg class="pnl-anel" viewBox="0 0 120 120" role="img" aria-label="' + pct(r.realizou, r.N) + ' realizado"><circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="14"/>' +
      '<circle cx="60" cy="60" r="50" fill="none" stroke="#7ee2a8" stroke-width="14" stroke-linecap="round" stroke-dasharray="' + ang + ' 314.2" transform="rotate(-90 60 60)"/>' +
      '<text x="60" y="64" text-anchor="middle" fill="#eaf1ff" font-family="Anton, sans-serif" font-size="24">' + pct(r.realizou, r.N) + '</text></svg>' +
      '<div><div class="pnl-big"><span data-pnl="realizou">' + r.realizou + '</span> <small>de <span data-pnl="publico">' + r.N + '</span></small></div><p class="pnl-sub">pessoas do público-alvo realizaram</p>' +
      '<p class="pnl-pend"><span data-pnl="pendentes">' + r.pendentes + '</span> pendentes</p>' + (r.margem ? '<p class="pnl-sub" data-pnl="meta">Meta: <b>' + r.meta + '</b> (público − margem de ' + r.margem + ') · ' + (r.metaAtingida ? '<b class="pnl-ouro">meta atingida</b>' : 'faltam <b>' + r.faltamParaMeta + '</b>') + '</p>' : '') + '<p class="pnl-sub">Data-limite: <b class="pnl-ouro">' + brAno(r.prazo) + '</b></p></div></div>';
    if (r.qualidade.alertaExecutivo) h += '<div class="pnl-alerta" data-pnl="alerta-qualidade"><b>Registro de presença:</b> ' + r.qualidade.naoVerificaveisPendentes + ' pessoas estão em turma sem check-in completo; a realização delas não pode ser verificada.</div>';
    h += linkVista('mobilizacao', 'Quem falta e em que situação') + '</article>';
    /* 2. viabilidade */
    var inviavel = r.realizou + r.maxPlanejado < r.meta;
    var frase = r.indeterminado ? 'Não dá para estimar as turmas extras: falta o formato de turma (encontros, horário e vagas). Configure no ADMIN.'
      : r.fatores.calendario ? 'Seriam necessárias ' + nec + ' turmas extras, mas só ' + cabem + ' cabem no calendário até o prazo. Mesmo abrindo todas, ' + semTurma + ' pessoas para a meta ficam sem turma possível.'
      : inviavel ? 'Faltam ' + (r.meta - r.realizou - r.maxPlanejado) + ' vagas nas turmas planejadas para a meta' + (r.margem ? ' (com a margem de ' + r.margem + ')' : '') + '. ' + (nec === 1 ? 'A turma extra necessária cabe' : 'As ' + nec + ' turmas extras necessárias cabem') + ' no calendário.'
      : 'As turmas planejadas comportam todo o público pendente. O desafio é inscrever e garantir presença.';
    h += '<article class="pnl-card" data-pnl="bloco-viabilidade"><h2>2 · Viabilidade até ' + br(r.prazo) + '</h2>' +
      '<div class="pnl-veredito' + (inviavel ? '' : ' pnl-veredito--ok') + '"><strong>' + (inviavel ? 'Meta inviável com a capacidade atualmente planejada' : r.margem ? 'As turmas planejadas comportam a meta' : 'As turmas planejadas comportam 100%') + '</strong><span>' + esc(frase) + '</span></div>' +
      regua(r) + '<p class="pnl-regua-texto">Realizado <b>' + f1(r.pct.realizado) + '%</b> · com as turmas planejadas <b>' + f1(r.pct.maxPlanejado) + '%</b> · com as que cabem no calendário <b>' + f1(r.pct.maxExpansao) + '%</b> · meta ' + f1(r.pctMeta) + '%</p>' +
      '<div class="pnl-linha"><span>Com as inscrições confirmadas: <b>' + f1(r.pct.potencial) + '%</b></span><span>Turmas extras: <b>' + (r.indeterminado ? 'indeterminado' : nec + (nec === 1 ? ' necessária · ' : ' necessárias · ') + cabem + (cabem === 1 ? ' cabe' : ' cabem') + ' até ' + br(r.prazo)) + '</b></span></div>' +
      '<div class="pnl-chips" data-pnl="fatores">' + (r.principal ? '<span class="pnl-sub">Impedimento principal:</span>' : '') +
      ['calendario', 'capacidade', 'mobilizacao'].filter(function (k) { return r.fatores[k]; }).map(function (k) { return '<span class="pnl-chip' + (k === r.principal ? ' pnl-chip--principal' : '') + '">' + FATOR[k] + '</span>'; }).join('') +
      '</div><p class="pnl-nota">O máximo com as turmas que cabem é um cenário, não capacidade autorizada.</p>' + linkVista('capacidade', 'Capacidade, calendário e premissas') + '</article>';
    /* 3. gaps */
    h += '<article class="pnl-card" data-pnl="bloco-gaps"><h2>3 · Gaps por diretoria</h2><div class="pnl-rank">' + r.diretorias.map(function (d) {
      return '<div class="pnl-rk" data-pnl-dir="' + esc(d.nome) + '"><span class="pnl-rk-nome">' + esc(d.nome) + '</span><span class="pnl-trilho" role="img" aria-label="' + f1(d.cobertura) + '% realizado; ' + f1(d.coberturaProjetada) + '% com inscritos e interessados"><span style="width:' + d.cobertura + '%"></span><span class="pnl-trilho-proj" style="width:' + Math.max(0, d.coberturaProjetada - d.cobertura) + '%"></span></span><span class="pnl-rk-info"><b>' + f1(d.cobertura) + '%</b> → ' + f1(d.coberturaProjetada) + '% · gap ' + d.gap + '</span></div>';
    }).join('') + '</div><div class="pnl-leg" data-pnl="gaps-legenda"><span><i class="pnl-leg-real"></i>Realizado</span><span><i class="pnl-leg-proj"></i>Inscritos e interessados (se comparecerem)</span><span><i class="pnl-leg-gap"></i>Gap: sem nenhum dos dois</span></div>' +
      (r.diretorias[0] ? '<p class="pnl-nota" data-pnl="gaps-exemplo">Como ler: ' + esc(r.diretorias[0].nome) + ' tem <b>' + f1(r.diretorias[0].cobertura) + '%</b> realizado hoje; chegaria a ' + f1(r.diretorias[0].coberturaProjetada) + '% se todos os inscritos e interessados comparecerem; ainda faltariam ' + r.diretorias[0].gap + (r.diretorias[0].gap === 1 ? ' pessoa' : ' pessoas') + ' (gap). Menor cobertura primeiro; empate, mais pendências.</p>' : '') + linkVista('diretorias', 'Todas as diretorias e gerências') + '</article>';
    /* 4. decisões */
    h += '<article class="pnl-card" data-pnl="bloco-decisoes"><h2>4 · Decisões necessárias</h2>' + (r.decisoes.length ? '<ol class="pnl-decisoes">' + r.decisoes.map(function (x) {
      return '<li data-pnl-decisao="' + x.tipo + '"><b>' + esc(x.titulo) + '</b><span>' + esc(x.texto) + '</span><span class="pnl-tag">' + esc(x.tag) + '</span></li>'; }).join('') + '</ol>'
      : '<p class="admin-empty">Nenhuma decisão pendente pelos dados atuais.</p>') + '</article>';
    h += '</div><nav class="pnl-consultas" aria-label="Consultas"><span class="pnl-sub">Consultas:</span>' + Object.keys(VISTAS).map(function (v) { return linkVista(v, VISTAS[v]); }).join('') + '</nav>';
    return h;
  }

  /* ---------- consultas ---------- */
  function barraSituacoes(r) {
    var s = '<div class="pnl-barra" role="img" aria-label="Situação das ' + r.N + ' pessoas">';
    Object.keys(ROT).forEach(function (k) { if (r.porSit[k]) s += '<span style="width:' + (r.porSit[k] / r.N * 100) + '%;background:' + COR[k] + '"></span>'; });
    s += '</div><div class="pnl-leg">'; Object.keys(ROT).forEach(function (k) { s += '<span><i style="background:' + COR[k] + '"></i>' + ROT[k] + ' <b>' + r.porSit[k] + '</b></span>'; });
    return s + '</div>';
  }
  function bloco(titulo, valor, texto, chave) { return '<div class="pnl-bloco"' + (chave ? ' data-pnl="' + chave + '"' : '') + '><h3>' + esc(titulo) + '</h3><div class="pnl-v">' + valor + '</div><p>' + esc(texto) + '</p></div>'; }
  /* Exportação com nomes: só o ADMIN geral vê o botão (convidados ficam com os números). */
  function podeExportar() { var A = window.faAuth, s = A && A.getSession(); return !!(s && A.isAdmin(s.email)); }
  function botaoExportar() {
    return podeExportar() ? '<div class="pnl-exportar"><button type="button" class="btn" data-pnl="exportar">Exportar Excel com os nomes</button><span class="pnl-nota" data-pnl="exportar-msg" role="status"></span></div>' : '';
  }
  var SIT_NOME = { realizou: 'Realizou', inscrita: 'Inscrita', interessada: 'Interessada', 'sem-engajamento': 'Cadastrada sem engajamento', 'sem-cadastro': 'Sem cadastro' };
  var PUB_NOME = { tecnicos: 'Técnico', gestores: 'Gestor', diretores: 'Diretor', assessores: 'Assessor' };
  function carregarXlsx(cb) {
    if (window.XLSX) { cb(); return; }
    var src = 'forca-agil/xlsx.mini.min.js', ex = document.querySelector('script[data-avp-lib="' + src + '"]');
    if (ex) { ex.addEventListener('load', function () { cb(); }); ex.addEventListener('error', function () { cb(new Error('falha')); }); return; }
    var sc = document.createElement('script'); sc.src = src; sc.setAttribute('data-avp-lib', src);
    sc.onload = function () { cb(); }; sc.onerror = function () { cb(new Error('falha')); }; document.head.appendChild(sc);
  }
  /* Abas: Todas + uma por categoria do painel. Devolvida pronta para gravar (e conferível nos testes). */
  function planilhaExportacao(r) {
    var cab = ['Nome', 'E-mail', 'Diretoria', 'Gerência', 'Público', 'Situação', 'Realizou em', 'Data da realização', 'Inscrição em', 'Interesse em', 'Vaga até o prazo', 'Cabe em vaga livre de', 'Ausências'];
    var linha = function (p) { return [p.nome, p.email, p.diretoria, p.gerencia, PUB_NOME[p.publico] || p.publico, SIT_NOME[p.situacao] || p.situacao, p.realizouEm, p.realizouData ? br(p.realizouData) + '/' + p.realizouData.slice(0, 4) : '', p.inscricoes, p.interesses, p.vagaAtePrazo, p.cabeEmVagaLivre, p.ausencias]; };
    var so = function (f) { return r.lista.filter(f).map(linha); };
    return [
      ['Todas', so(function () { return true; })],
      ['Sem cadastro', so(function (p) { return p.situacao === 'sem-cadastro'; })],
      ['Cadastradas sem engajamento', so(function (p) { return p.situacao === 'sem-engajamento'; })],
      ['Interessadas sem inscrição', so(function (p) { return p.situacao === 'interessada'; })],
      ['Inscritas sem realização', so(function (p) { return p.situacao === 'inscrita'; })],
      ['Realizaram', so(function (p) { return p.situacao === 'realizou'; })],
      ['Faltaram e seguem pendentes', so(function (p) { return p.faltouPendente; })],
      ['Com ausência (histórico)', so(function (p) { return !!p.ausencias; })]
    ].map(function (a) { return { nome: a[0], cab: cab, linhas: a[1] }; });
  }
  function exportar(btn) {
    var msg = document.querySelector('[data-pnl="exportar-msg"]'), r = st.r;
    var fim = function (t) { btn.disabled = false; btn.textContent = 'Exportar Excel com os nomes'; if (msg) msg.textContent = t || ''; };
    if (!r || !r.lista || !podeExportar()) return;
    btn.disabled = true; btn.textContent = 'Gerando…'; if (msg) msg.textContent = '';
    carregarXlsx(function (erro) {
      if (erro || !window.XLSX) { fim('Não foi possível gerar o arquivo agora. Tente de novo.'); return; }
      try {
        var X = window.XLSX, wb = X.utils.book_new();
        planilhaExportacao(r).forEach(function (a) {
          var ws = X.utils.aoa_to_sheet([a.cab].concat(a.linhas));
          ws['!cols'] = a.cab.map(function (c, i) { return { wch: Math.min(48, Math.max.apply(null, [String(c).length + 2].concat(a.linhas.map(function (l) { return String(l[i] == null ? '' : l[i]).length + 2; })))) }; });
          ws['!autofilter'] = { ref: X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: a.linhas.length, c: a.cab.length - 1 } }) };
          X.utils.book_append_sheet(wb, ws, a.nome);
        });
        X.writeFile(wb, 'painel-programa-pessoas-' + r.hoje + '.xlsx');
        fim('Arquivo gerado com os dados lidos em ' + (st.lidoEm ? new Date(st.lidoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—') + '.');
      } catch (e) { fim('Não foi possível gerar o arquivo agora. Tente de novo.'); }
    });
  }
  function diretorias(r) {
    var h = '<article class="pnl-card"><h2>Situação por diretoria</h2><div class="table-scroll-wrap"><table class="admin-table pnl-tabela"><thead><tr><th>Diretoria</th><th class="pnl-n">Público</th>' +
      Object.keys(ROT).map(function (k) { return '<th class="pnl-n">' + ROT[k] + '</th>'; }).join('') + '<th class="pnl-n">Cobertura</th><th class="pnl-n">Projetada (com inscritos e interessados)</th><th class="pnl-n">Gap (pessoas)</th></tr></thead><tbody>';
    // A mesma linha serve para a diretoria e para cada gerência dela (que abre logo abaixo, com as mesmas colunas).
    var linha = function (o, nome, attrs) {
      var cor = o.cobertura < 15 ? 'rgba(255,59,48,.30)' : o.cobertura < 30 ? 'rgba(246,190,123,.25)' : 'rgba(126,226,168,.18)';
      return '<tr' + attrs + '><td>' + nome + '</td><td class="pnl-n">' + o.total + '</td>' + Object.keys(ROT).map(function (k) { return '<td class="pnl-n">' + o[k] + '</td>'; }).join('') +
        '<td class="pnl-n" style="background:' + cor + '">' + f1(o.cobertura) + '%</td><td class="pnl-n">' + f1(o.coberturaProjetada) + '%</td><td class="pnl-n">' + o.gap + '</td></tr>';
    };
    r.diretorias.forEach(function (d, i) {
      h += linha(d, '<button type="button" class="pnl-dir-abrir" data-pnl-abrir="' + i + '" aria-expanded="false"><span aria-hidden="true">▸</span> ' + esc(d.nome) + '</button>', ' class="pnl-dir"');
      d.gerencias.forEach(function (g) { h += linha(g, '<span class="pnl-ger-nome">' + esc(g.nome) + '</span>', ' class="pnl-ger" data-pnl-ger="' + i + '" hidden'); });
    });
    h += '<tr><td><b>Total</b></td><td class="pnl-n"><b>' + r.N + '</b></td>' + Object.keys(ROT).map(function (k) { return '<td class="pnl-n"><b>' + r.porSit[k] + '</b></td>'; }).join('') + '<td class="pnl-n"><b>' + pct(r.realizou, r.N) + '</b></td><td class="pnl-n" data-pnl="proj-total"><b>' + f1(r.pct.comVaga) + '%</b></td><td class="pnl-n" data-pnl="gap-total"><b>' + r.gapProjetado + '</b></td></tr></tbody></table></div>' +
      '<p class="pnl-nota">Cada pessoa aparece numa situação só; as linhas somam o público. Projetada = realizados + inscritos e interessados com vaga numa turma que termina até o prazo, se comparecerem com a frequência mínima (interesse ainda precisa da confirmação; inscrição em turma depois do prazo, em turma passada sem encerrar ou em andamento sem chance de atingir o mínimo não entra). Gap = público − projetados. Toque na diretoria para ver as gerências, com as mesmas colunas; gerências com menos de 5 pessoas aparecem agrupadas.</p></article>';
    return h;
  }
  function mobilizacao(r) {
    var a = r.ausencias;
    return '<article class="pnl-card"><h2>Pendentes por situação</h2>' + barraSituacoes(r) + '<div class="pnl-blocos">' +
      bloco('Sem cadastro', r.porSit['sem-cadastro'], 'Estão na base oficial e não têm cadastro com o mesmo e-mail. Não prova desconhecimento do programa: pede investigação e comunicação.') +
      bloco('Cadastradas sem engajamento', r.porSit['sem-engajamento'], 'Têm cadastro, nenhum interesse nem inscrição ativos, e nunca realizaram.') +
      bloco('Interessadas sem inscrição', r.porSit.interessada, 'Interesse ativo numa turma do programa, sem confirmação. Há ' + r.vagasLivres + ' vagas livres até o prazo.') +
      bloco('Inscritas sem realização', r.porSit.inscrita, r.potencial + ' em turmas que terminam até o prazo e ainda podem realizar.') +
      bloco('Faltaram e seguem pendentes', a.pendentes, a.pendentesComNovaInscricao + ' delas já têm nova inscrição.') +
      '</div><p class="pnl-nota">A lista de espera não entra em nenhum número do painel.</p>' + botaoExportar() + '</article>';
  }
  function ausencias(r) {
    var a = r.ausencias, q = r.qualidade;
    var h = '<article class="pnl-card"><h2>Qualidade do registro de presença</h2>';
    if (q.turmasSemRegistro.length) h += '<div class="pnl-alerta"><b>Turma encerrada sem nenhum check-in:</b> ' + esc(q.turmasSemRegistro.join(', ')) + '. Quem estava inscrito nela não conta como realizado nem como ausente: fica como realização não verificável até a presença ser conferida.</div>';
    if (q.turmasParciais.length) h += '<div class="pnl-alerta"><b>Check-in incompleto</b> (algum encontro sem nenhum registro): ' + esc(q.turmasParciais.join(', ')) + '.</div>';
    if (q.turmasPassadasAbertas.length) h += '<div class="pnl-alerta"><b>Turma que já aconteceu e não foi encerrada:</b> ' + esc(q.turmasPassadasAbertas.join(', ')) + '. Sem o encerramento, ninguém dela aparece como realizado.</div>';
    if (!q.turmasSemRegistro.length && !q.turmasParciais.length && !q.turmasPassadasAbertas.length) h += '<p class="pnl-nota">Todas as turmas encerradas do programa têm check-in em todos os encontros.</p>';
    h += '<div class="pnl-blocos">' + bloco('Realização confirmada', r.realizou, 'Frequência igual ou acima do mínimo do evento numa turma encerrada.') +
      bloco('Não comparecimento confirmado', a.naoCompareceu, 'Inscrição confirmada, nenhuma presença, check-in registrado.') +
      bloco('Frequência insuficiente', a.frequenciaInsuficiente, 'Esteve presente, abaixo do mínimo do evento.') +
      bloco('Realização não verificável', q.naoVerificaveisPendentes, 'Encontros sem nenhum registro: não é presença nem ausência.', 'nao-verificaveis') + '</div>' +
      (q.historicoIncerto ? '<p class="pnl-nota">' + q.historicoIncerto + ' inscrições removidas sem data de remoção: o histórico delas não pôde ser avaliado.</p>' : '') +
      (q.realizacoesComInscricaoRemovida ? '<p class="pnl-nota">' + q.realizacoesComInscricaoRemovida + ' pessoas realizaram com a inscrição removida depois; contam como realizadas no painel. Os certificados seguem a regra deles, sem mudança.</p>' : '') + '</article>';
    h += '<article class="pnl-card"><h2>Ausências (o histórico nunca some)</h2><div class="pnl-blocos">' +
      bloco('Ocorrências', a.ocorrencias, 'Uma por inscrição confirmada em turma encerrada sem a frequência mínima.', 'aus-ocorrencias') + bloco('Pessoas únicas', a.pessoas, 'Quem teve pelo menos uma ausência.', 'aus-pessoas') +
      bloco('Recuperadas', a.recuperadas, 'Faltaram e depois realizaram; a falta continua no histórico.', 'aus-recuperadas') + bloco('Ainda pendentes', a.pendentes, a.pendentesComNovaInscricao + ' com nova inscrição.', 'aus-pendentes') + '</div>';
    if (r.ausenciasPorTurma.length) h += '<div class="table-scroll-wrap"><table class="admin-table pnl-tabela"><thead><tr><th>Turma</th><th class="pnl-n">Ausências</th><th>Registro de presença</th></tr></thead><tbody>' +
      r.ausenciasPorTurma.map(function (x) { return '<tr><td>' + esc(x.turma) + '</td><td class="pnl-n">' + x.ausencias + '</td><td>' + ({ completo: 'completo', parcial: 'incompleto', 'sem-registro': 'sem check-in' }[x.qualidade] || '—') + '</td></tr>'; }).join('') + '</tbody></table></div>';
    return h + botaoExportar() + '</article>';
  }
  function capacidade(r) {
    var c = r.cap, h = '<article class="pnl-card"><h2>Do déficit de vagas ao déficit de calendário</h2><div class="table-scroll-wrap"><table class="admin-table pnl-tabela"><thead><tr><th></th><th class="pnl-n">Técnicos</th><th class="pnl-n">Gestores</th><th class="pnl-n">Diretores</th><th class="pnl-n">Assessores</th></tr></thead><tbody>';
    var L = [['Pendentes', 'pendentes'], ['Com vaga por inscrição confirmada', 'comInscricao'], ['Com vaga própria (inscrição ou interesse)', 'comVaga'], ['Cabem nas vagas livres (pelas regras de entrada)', 'alocaveis'],
      ['Máximo nas turmas planejadas', 'maximo'], ['Déficit de vagas (para 100%)', 'deficitVagas'], ['Margem aplicada', 'margemUsada'], ['Déficit para a meta', 'deficitMeta'], ['Turmas extras necessárias (para a meta)', 'necessarias'], ['Turmas novas que cabem no calendário', 'cabem'], ['Turmas a abrir (necessárias que cabem)', 'abrir'], ['Déficit de calendário (turmas)', 'deficitCalendario']];
    L.forEach(function (l) { var v = function (g) { var x = c[g][l[1]]; return x == null ? 'indeterminado' : x + (l[1] === 'cabem' && x != null && !c[g].cabemExato ? ' (pelo menos)' : ''); }; h += '<tr><td>' + l[0] + '</td>' + ['tecnicos', 'gestores', 'diretores', 'assessores'].map(function (g) { return '<td class="pnl-n">' + ((g === 'diretores' || g === 'assessores') && /necessarias|cabem|abrir|deficitCalendario/.test(l[1]) ? '—' : v(g)) + '</td>'; }).join('') + '</tr>'; });
    var semPrev = ['diretores', 'assessores'].filter(function (g) { return c[g] && c[g].semTurmaPrevista > 0; });
    h += '</tbody></table></div><p class="pnl-nota">Vagas livres = vagas − registros ativos (interesse e inscrição, inclusive de quem está fora da base): nenhuma vaga ocupada no sistema é liberada pelo cálculo. ' + (r.vagasPresas ? r.vagasPresas + ' vagas estão presas por inscrição duplicada.' : '') + ' Diretores e assessores não entram em turma de técnicos nem de gestores: só em turma sem público de cargo; turma extra só é estimada para técnicos e gestores.' + (semPrev.length ? ' <b>Sem turma prevista: ' + semPrev.map(function (g) { return c[g].semTurmaPrevista + ' ' + NOMEG[g]; }).join(' e ') + '.</b>' : '') + '</p></article>';
    var sitDe = function (t) { return t.cancelada ? 'cancelada' : t.encerrada ? 'encerrada' : t.passadaAberta ? 'já aconteceu, sem encerrar' : !t.terminaAtePrazo ? 'termina depois do prazo' : t.comecou ? 'em andamento' : 'planejada'; };
    var pubDe = function (t) { return t.grupo === 'conflito' ? 'em conflito' : t.grupo ? NOMEG[t.grupo] : 'aberto'; };
    var opcoes = function (vals) { return '<option value="">Todos</option>' + vals.filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); }).map(function (v) { return '<option>' + esc(v) + '</option>'; }).join(''); };
    var filtro = function (id, rot, campo, vals) { return '<div class="avp-filtro"><label class="avp-filtro-rotulo" for="pnlF' + id + '">' + rot + '</label><select class="avp-select" id="pnlF' + id + '" data-pnl-filtro="' + campo + '">' + opcoes(vals) + '</select></div>'; };
    h += '<article class="pnl-card" data-pnl="turmas-programa"><h2>Turmas do programa</h2><div class="avp-filters">' + filtro('Ev', 'Evento', 'ev', r.turmas.map(function (t) { return t.evento || '—'; })) + filtro('Pub', 'Público', 'pub', r.turmas.map(pubDe)) + filtro('Sit', 'Situação', 'sit', r.turmas.map(sitDe)) +
      '</div><p class="pnl-nota" data-pnl="turmas-contagem" aria-live="polite">' + r.turmas.length + ' de ' + r.turmas.length + ' turmas</p><div class="table-scroll-wrap"><table class="admin-table pnl-tabela"><thead><tr><th>Evento</th><th>Turma</th><th>Datas</th><th>Público</th><th class="pnl-n">Vagas</th><th class="pnl-n">Ocupação</th><th class="pnl-n">Livres</th><th>Situação</th></tr></thead><tbody>' +
      r.turmas.map(function (t) {
        var sit = sitDe(t);
        return '<tr data-ev="' + esc(t.evento || '—') + '" data-pub="' + esc(pubDe(t)) + '" data-sit="' + esc(sit) + '"><td data-pnl="turma-evento">' + esc(t.evento || '—') + '</td><td>' + esc(t.label) + '</td><td>' + t.dias.map(br).join(', ') + (t.horario ? ' · ' + esc(t.horario) : '') + '</td><td>' + (t.grupo === 'conflito' ? 'em conflito' : t.grupo ? NOMEG[t.grupo] : 'aberto') + '</td><td class="pnl-n">' + (t.vagas || '—') + '</td><td class="pnl-n">' + t.ocupacao + '</td><td class="pnl-n">' + (t.valida ? t.livres : '—') + '</td><td>' + sit + '</td></tr>';
      }).join('') + '</tbody></table></div></article>';
    h += calendario(r);
    var al = r.alertas.filter(function (a) { return /paralelismo|horario|indisponivel|vagas|lotacao|conflito|datas/.test(a.tipo); });
    if (al.length) h += '<article class="pnl-card"><h2>Alertas de planejamento</h2><ul class="pnl-lista">' + al.map(function (a) { return '<li>' + esc(textoAlerta(a)) + '</li>'; }).join('') + '</ul></article>';
    var f = r.formatos;
    h += '<article class="pnl-card"><h2>Premissas desta simulação</h2><ul class="pnl-lista">' +
      '<li>Turmas simultâneas: até <b>' + (r.limites.tecnicos || '—') + '</b> de técnicos e <b>' + (r.limites.gestores || '—') + '</b> de gestores. Simultâneo = mesmo dia com horários que se sobrepõem.</li>' +
      '<li>Premissa: turmas de técnicos e de gestores não disputam os mesmos facilitadores e salas.</li>' +
      (r.margem ? '<li>Margem de ' + r.margem + ' pessoas: a meta é ' + r.meta + ' (público ' + r.N + ' − margem). A margem reduz primeiro o déficit do público que tem o maior déficit.</li>' : '') +
      ['tecnicos', 'gestores'].map(function (g) { var x = f[g]; return '<li>Turma nova de ' + NOMEG[g] + ': ' + (x ? x.encontros + ' encontros em dias úteis seguidos, ' + esc(x.horario) + ', ' + x.vagas + ' vagas (' + (x.origem === 'configurado' ? 'formato configurado no ADMIN' : 'como a turma mais recente, ' + esc(x.ref)) + ').' : 'sem formato: configure no ADMIN.') + '</li>'; }).join('') +
      '<li>Dias úteis: sem sábados, domingos e os dias sem expediente cadastrados. Primeira data para turma nova: ' + brAno(r.primeiraData) + ' (antecedência de ' + r.antecedencia + ' dias úteis).</li>' +
      '<li>Disponibilidade de facilitadores e salas não está cadastrada: o encaixe mostra o que o calendário comporta, nunca a garantia de execução.</li></ul></article>';
    return h;
  }
  function textoAlerta(a) {
    switch (a.tipo) {
      case 'paralelismo-excedido': return 'Já planejado: ' + a.simultaneas + ' turmas de ' + NOMEG[a.grupo] + ' ao mesmo tempo em ' + brAno(a.dia) + ' (limite ' + a.limite + ').';
      case 'turma-sem-horario': return a.turma + ': sem horário registrado (conta como o dia inteiro ocupado).';
      case 'encontro-em-dia-indisponivel': return a.turma + ': encontro em ' + brAno(a.dia) + ', dia sem expediente cadastrado.';
      case 'turma-sem-vagas': return a.turma + ': sem número de vagas (não entra na capacidade).';
      case 'turma-acima-da-lotacao': return a.turma + ': ' + a.ocupacao + ' registros para ' + a.vagas + ' vagas.';
      case 'turma-publico-conflito': return a.turma + ': o público da turma contradiz o do evento; ninguém pode entrar.';
      case 'turma-sem-datas': return a.turma + ': sem datas.';
      default: return a.turma || a.tipo;
    }
  }
  function calendario(r) {
    if (!r.uteis.length) return '<article class="pnl-card"><h2>Calendário útil</h2><p class="pnl-nota">Sem dias úteis entre a primeira data possível e o prazo.</p></article>';
    var marca = {}; function m(dia, txt, cls, qt) { (marca[dia] = marca[dia] || []).push('<span class="pnl-t ' + cls + '" title="' + esc((qt ? qt.titulo + ' · ' : '') + txt) + '">' + (qt ? '<b class="pnl-t-qt" data-pnl="cal-ocupacao">' + esc(qt.curto) + '</b> ' : '') + esc(txt) + '</span>'); }
    var temCancelada = false;
    r.turmas.forEach(function (t) {
      if (t.encerrada) return;
      // Turma cancelada continua no calendário, riscada e marcada, para não parecer dia livre nem turma que conta.
      if (t.cancelada) { (t.dias || []).forEach(function (d) { temCancelada = true; m(d, 'Cancelada · ' + t.label, 'pnl-t--cancel'); }); return; }
      // Interessados + inscritos (registros ativos) sobre as vagas, para ver de relance quanto cada turma já tem.
      var qt = { curto: t.ocupacao + (t.vagas ? '/' + t.vagas : ''), titulo: t.ocupacao + ' interessados e inscritos' + (t.vagas ? ' para ' + t.vagas + ' vagas' : '') };
      t.dias.forEach(function (d) { m(d, t.label + (t.horario ? ' ' + t.horario : ''), t.grupo === 'gestores' ? 'pnl-t--g' : 'pnl-t--t', qt); });
    });
    ['tecnicos', 'gestores'].forEach(function (g) { (r.cap[g].turmasAbrir || []).forEach(function (dias, i) { dias.forEach(function (d) { m(d, 'Nova ' + (g === 'gestores' ? 'G' : 'T') + (i + 1), g === 'gestores' ? 'pnl-t--ng' : 'pnl-t--nt'); }); }); });
    var ini = new Date(+r.primeiraData.slice(0, 4), +r.primeiraData.slice(5, 7) - 1, +r.primeiraData.slice(8)); ini.setDate(ini.getDate() - ((ini.getDay() + 6) % 7));
    var h = '<article class="pnl-card"><h2>Calendário útil até ' + br(r.prazo) + ' (simulação)</h2><div class="table-scroll-wrap"><div class="pnl-cal">' + ['seg', 'ter', 'qua', 'qui', 'sex'].map(function (x) { return '<div class="pnl-cal-cab">' + x + '</div>'; }).join('');
    for (var x = new Date(ini); ; x.setDate(x.getDate() + 1)) {
      var w = x.getDay(), iso = x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
      if (iso > r.prazo && w === 1) break;
      if (w === 0 || w === 6) continue;
      var ind = r.indisponiveis[iso], fora = iso < r.primeiraData || iso > r.prazo;
      h += '<div class="pnl-dia' + (ind ? ' pnl-dia--ind' : '') + (fora ? ' pnl-dia--fora' : '') + '"><b>' + br(iso) + '</b>' + (ind ? '<span class="pnl-nota">' + esc(ind) + '</span>' : '') + (marca[iso] || []).join('') + '</div>';
    }
    return h + '</div></div><div class="pnl-leg"><span><i class="pnl-t--t"></i>Turma de técnicos</span><span><i class="pnl-t--g"></i>Turma de gestores</span><span><i class="pnl-t--nt"></i>Nova de técnicos (simulada)</span><span><i class="pnl-t--ng"></i>Nova de gestores (simulada)</span><span><i class="pnl-dia--ind"></i>Dia sem expediente</span><span><b class="pnl-t-qt">18/20</b>&nbsp;interessados + inscritos / vagas</span>' + (temCancelada ? '<span data-pnl="leg-cancelada"><i class="pnl-t--cancel"></i>Turma cancelada (não conta)</span>' : '') + '</div></article>';
  }
  function evolucao(r) {
    if (!r.evolucao.length) return '<article class="pnl-card"><h2>Realizado acumulado</h2><p class="pnl-nota">Ainda não há turma encerrada com realização.</p></article>';
    var W = 860, H = 230, x0 = 50, ini = r.evolucao[0].data, fim = r.prazo > r.hoje ? r.prazo : r.hoje;
    var t = function (iso) { return new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8)).getTime(); };
    var dx = function (iso) { return x0 + (t(iso) - t(ini)) / Math.max(1, t(fim) - t(ini)) * (W - x0 - 30); }, dy = function (v) { return 20 + (1 - v / r.N) * (H - 40); };
    var pts = [[dx(ini), dy(0)]]; r.evolucao.forEach(function (p) { pts.push([dx(p.data), pts[pts.length - 1][1]]); pts.push([dx(p.data), dy(p.acumulado)]); }); pts.push([dx(r.hoje), dy(r.realizou)]);
    var s = '<svg class="pnl-evo" viewBox="0 0 900 260" role="img" aria-label="Realizado acumulado e limites até o prazo"><g font-family="Oswald, sans-serif" font-size="13" fill="#8fa0c4">';
    [0, 25, 50, 75, 100].forEach(function (p) { var y = dy(r.N * p / 100); s += '<line x1="' + x0 + '" y1="' + y + '" x2="' + (W - 30) + '" y2="' + y + '" stroke="rgba(120,160,220,.16)"/><text x="' + (x0 - 6) + '" y="' + (y + 4) + '" text-anchor="end">' + p + '%</text>'; });
    s += '<text x="' + dx(ini) + '" y="250">' + br(ini) + '</text><text x="' + dx(r.hoje) + '" y="250" fill="#eaf1ff">hoje</text><text x="' + dx(fim) + '" y="250" text-anchor="end" fill="#f5c518">' + br(r.prazo) + '</text></g>';
    s += '<line x1="' + x0 + '" y1="' + dy(r.N) + '" x2="' + (W - 30) + '" y2="' + dy(r.N) + '" stroke="#f5c518" stroke-width="2"/><polyline fill="none" stroke="#7ee2a8" stroke-width="3" points="' + pts.map(function (p) { return p.join(','); }).join(' ') + '"/>';
    if (r.prazo > r.hoje) {
      var lim = [[r.realizou + r.comVaga, '7 5', 'Com inscritos e interessados'], [r.realizou + r.maxPlanejado, '2 4', 'Planejadas'], [r.realizou + r.maxExpansao, '10 3 2 3', 'Com as que cabem']];
      lim.forEach(function (l) { s += '<line x1="' + dx(r.hoje) + '" y1="' + dy(r.realizou) + '" x2="' + dx(fim) + '" y2="' + dy(l[0]) + '" stroke="#7af0e8" stroke-width="2" stroke-dasharray="' + l[1] + '"/>'; });
    }
    s += '</svg>';
    // Legenda fora do gráfico: com valores próximos, rótulos dentro do desenho encostam nas linhas e uns nos outros.
    var amostra = function (cor, tr, larg) { return '<svg class="pnl-evo-amostra" viewBox="0 0 34 10" aria-hidden="true"><line x1="1" y1="5" x2="33" y2="5" stroke="' + cor + '" stroke-width="' + (larg || 2) + '"' + (tr ? ' stroke-dasharray="' + tr + '"' : '') + '/></svg>'; };
    var item = function (sv, txt, v) { return '<span data-pnl="evo-leg">' + sv + txt + ' <b>' + v + '</b></span>'; };
    var leg = item(amostra('#7ee2a8', '', 3), 'Realizado', pct(r.realizou, r.N));
    if (r.prazo > r.hoje) leg += item(amostra('#7af0e8', '7 5'), 'Com inscritos e interessados', pct(r.realizou + r.comVaga, r.N)) + item(amostra('#7af0e8', '2 4'), 'Planejadas', pct(r.realizou + r.maxPlanejado, r.N)) + item(amostra('#7af0e8', '10 3 2 3'), 'Com as que cabem', pct(r.realizou + r.maxExpansao, r.N));
    leg += item(amostra('#f5c518', ''), '100% do público', r.margem ? '(meta ' + f1(r.pctMeta) + '%)' : '= meta');
    var legenda = '<div class="pnl-leg pnl-evo-leg" data-pnl="evo-legenda">' + leg + '</div>';
    return '<article class="pnl-card"><h2>Realizado acumulado e limites até o prazo</h2><div class="table-scroll-wrap">' + s + '</div>' + legenda + '<p class="pnl-nota">À esquerda de "hoje": o realizado, pela data de conclusão de cada turma. À direita: limites, não tendência — se todos os inscritos e interessados com vaga realizarem, o teto das turmas planejadas e o teto com as turmas que cabem no calendário.</p></article>';
  }

  /* ---------- desenho ---------- */
  function render() {
    var el = $('painelConteudo'); if (!el) return;
    var A = window.faAuth, s = A && A.getSession();
    if (!s || !A.isPainelReady || !A.isPainelReady()) { el.innerHTML = '<p class="loading-msg">Verificando acesso…</p>'; return; }
    if (A.painelLeituraFalhou && A.painelLeituraFalhou() && !A.isAdmin(s.email)) { el.innerHTML = '<div class="pnl-alerta" role="alert">Não foi possível verificar seu acesso ao painel agora. Recarregue a página para tentar de novo.</div>'; return; }
    if (!A.podePainel()) { el.innerHTML = '<p class="loading-msg">Verificando acesso…</p>'; return; }
    var v = vista(), r = st.r;
    var titulo = v === 'executiva' ? 'Programa Força Ágil' : VISTAS[v];
    var h = cabecalho(titulo, v === 'executiva' ? 'Quanto realizamos, se chegaremos a 100% até o prazo, o que impede e o que decidir agora.' : '', v !== 'executiva');
    if (!r) h += st.erro ? '' : '<p class="loading-msg">Lendo os dados…</p>';
    else if (r.inconsistencias.length) h += '<div class="pnl-alerta" role="alert" data-pnl="inconsistencia"><b>Os números não fecharam</b> (' + esc(r.inconsistencias.join(', ')) + ') e não são exibidos. Use "Atualizar dados"; se continuar, avise a administração.</div>';
    else {
      if (r.pendencias.length) h += avisoPendencias(r);
      if (r.composicao && !r.composicao.fecha) h += '<div class="pnl-alerta" role="alert" data-pnl="composicao"><b>A conta do público não fecha.</b> Total configurado: ' + r.composicao.total + '. Situação não ativa ' + r.composicao.situacaoInativa + ' + cargo não compatível ' + r.composicao.cargoIncompativel + ' + público da base ' + r.composicao.publico + ' = ' + r.composicao.soma + ' (diferença de ' + Math.abs(r.composicao.diferenca) + ' pessoa' + (Math.abs(r.composicao.diferenca) === 1 ? '' : 's') + '). Confira a base importada e os parâmetros em ADMIN › Painel do Programa.</div>';
      if (r.N) h += ({ executiva: executiva, diretorias: diretorias, mobilizacao: mobilizacao, ausencias: ausencias, capacidade: capacidade, evolucao: evolucao })[v](r);
    }
    el.innerHTML = h;
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-pnl="atualizar"]');
    if (b && $('page-painel') && !$('page-painel').hidden) { e.preventDefault(); atualizar(); return; }
    var ab = e.target.closest && e.target.closest('[data-pnl-abrir]');
    if (ab) { var aberto = ab.getAttribute('aria-expanded') !== 'true'; ab.setAttribute('aria-expanded', aberto ? 'true' : 'false'); ab.firstChild.textContent = aberto ? '▾' : '▸'; document.querySelectorAll('[data-pnl-ger="' + ab.getAttribute('data-pnl-abrir') + '"]').forEach(function (tr) { tr.hidden = !aberto; }); return; }
    var ex = e.target.closest && e.target.closest('[data-pnl="exportar"]');
    if (ex) { e.preventDefault(); exportar(ex); return; }
    var a = e.target.closest && e.target.closest('[data-pnl-admin]');
    if (a) { e.preventDefault(); location.hash = '#admin'; setTimeout(function () { var t = document.querySelector('.admin-tab-btn[data-panel="adminPanelPainelPrograma"]'); if (t) t.click(); }, 300); }
  });
  /* Filtros da tabela Turmas do programa: só escondem linhas (os números do painel não mudam). */
  document.addEventListener('change', function (e) {
    var sel = e.target.closest && e.target.closest('[data-pnl-filtro]'); if (!sel) return;
    var card = sel.closest('[data-pnl="turmas-programa"]'); if (!card) return;
    var f = {}; card.querySelectorAll('[data-pnl-filtro]').forEach(function (x) { if (x.value) f[x.getAttribute('data-pnl-filtro')] = x.value; });
    var linhas = card.querySelectorAll('tbody tr'), vis = 0;
    linhas.forEach(function (tr) { var ok = Object.keys(f).every(function (k) { return tr.getAttribute('data-' + k) === f[k]; }); tr.hidden = !ok; if (ok) vis++; });
    var c = card.querySelector('[data-pnl="turmas-contagem"]'); if (c) c.textContent = vis + ' de ' + linhas.length + ' turmas';
  });
  window.addEventListener('hashchange', function () { if (/^#painel/.test(location.hash)) { render(); window.scrollTo(0, 0); } });
  /* A primeira leitura sai assim que o acesso está decidido — a sessão, a lista de admins e o registro de convidado chegam
     em qualquer ordem (no celular, em segundos), então qualquer um dos três sinais tenta de novo. */
  function primeiraLeitura() {
    if (!/^#painel/.test(location.hash)) return;
    render();
    var A = window.faAuth;
    if (!st.r && !st.carregando && !st.erro && A && A.getSession() && A.isPainelReady && A.isPainelReady() && A.podePainel()) atualizar();
  }
  ['fa-painel-ready', 'fa-admin-ready', 'fa-auth-ready', 'fa-auth-change'].forEach(function (ev) { window.addEventListener(ev, primeiraLeitura); });

  function init() { primeiraLeitura(); }
  if (window.faRouter && window.faRouter.onPageInit) window.faRouter.onPageInit('painel', init);
  window.faPainelPrograma = { atualizar: atualizar, _estado: function () { return st; }, _evolucao: evolucao, _planilha: function () { return st.r ? planilhaExportacao(st.r) : null; } };
})();
