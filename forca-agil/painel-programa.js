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
  var PUBS = { todos: 'Todos', tecnicos: 'Técnicos', gestores: 'Gestores', diretores: 'Diretores', assessores: 'Assessores' };
  /* pub = filtro de público (Gaps por diretoria e Diretorias e áreas); modo = o que o bloco de gaps mostra ('gap' pessoas a
     alcançar | 'cob' cobertura %). Sobrevivem a "Atualizar dados". */
  var st = { r: null, lidoEm: null, carregando: false, erro: null, base: null, pub: 'todos', modo: 'gap' };
  function recorte(r) { return (r.porPublico && r.porPublico[st.pub]) || r.porPublico.todos; }
  function filtroPublico() {
    return '<div class="pnl-ordem" role="group" aria-label="Público" data-pnl="filtro-publico">' + Object.keys(PUBS).map(function (k) {
      return '<button type="button" class="btn btn--sm" data-pnl-pub="' + k + '" aria-pressed="' + (st.pub === k) + '">' + PUBS[k] + '</button>'; }).join('') + '</div>';
  }

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
  /* Parâmetros do endereço: d = diretoria a abrir em Diretorias e áreas; foco = bloco (data-pnl) a mostrar; de = bloco da
     visão executiva de onde a pessoa veio (o "← Voltar ao painel" devolve a ela, não ao topo). */
  function params() {
    var o = {}; (String(location.hash || '').split('?')[1] || '').split('&').forEach(function (p) { var i = p.indexOf('='); if (i > 0) { try { o[p.slice(0, i)] = decodeURIComponent(p.slice(i + 1)); } catch (e) { /* parâmetro malformado: ignorado */ } } });
    return o;
  }
  function blocoValido(b) { return /^[a-z0-9-]+$/.test(b || '') ? b : ''; }
  /* Cada decisão leva à consulta onde se age sobre ela. Decisão sem destino aqui fica sem link (etiqueta neutra). */
  var DESTINO_DECISAO = {
    'abrir-turmas': ['capacidade', '', 'Ver capacidade e calendário'], prazo: ['capacidade', '', 'Ver capacidade e calendário'],
    'turma-outros-publicos': ['capacidade', '', 'Ver capacidade e calendário'], duplicadas: ['capacidade', '', 'Ver capacidade e vagas'],
    mobilizar: ['mobilizacao', 'mob-sem-cadastro', 'Ver quem falta'], converter: ['mobilizacao', 'mob-interessada', 'Ver as interessadas'],
    reconvocar: ['ausencias', 'aus-pendentes', 'Ver as ausências'], 'conferir-presenca': ['ausencias', '', 'Ver o registro de presença'],
    'encerrar-turmas': ['ausencias', '', 'Ver o registro de presença']
  };
  function hrefDecisao(x) { var d = DESTINO_DECISAO[x.tipo]; return d ? '#painel?v=' + d[0] + (d[1] ? '&foco=' + d[1] : '') + '&de=bloco-decisoes' : ''; }
  /* Depois de desenhar: abre a diretoria pedida (d) ou rola até o bloco pedido (foco). Uma vez por endereço, para que
     "Atualizar dados" e os filtros não puxem a tela de volta. */
  function aplicarFoco() {
    if (!st.r || st.focoAplicado === location.hash) return;
    var p = params(), alvo = null;
    if (p.d && vista() === 'diretorias') {
      [].some.call(document.querySelectorAll('#painelConteudo tr[data-pnl-dir-nome]'), function (tr) {
        if (tr.getAttribute('data-pnl-dir-nome') !== p.d) return false;
        var b = tr.querySelector('[data-pnl-abrir]'); if (b && b.getAttribute('aria-expanded') !== 'true') b.click();
        alvo = tr; return true;
      });
    } else if (blocoValido(p.foco)) alvo = document.querySelector('#painelConteudo [data-pnl="' + p.foco + '"]');
    st.focoAplicado = location.hash;
    /* Imediato (não suave): o site tem scroll-behavior: smooth e a troca de endereço sobe ao topo; no celular, com a
       página longa, as duas animações se atropelavam e o destino não aparecia. */
    if (alvo) setTimeout(function () { alvo.scrollIntoView({ block: 'center', behavior: 'instant' }); }, 0);
  }

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
    var r = st.r, h = '<div class="pnl-topo"><div class="pnl-topo-titulo">' + (comVoltar ? '<a class="avp-voltar-link" href="#painel' + (blocoValido(params().de) ? '?foco=' + params().de : '') + '">← Voltar ao painel</a>' : '') +
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
    /* Veredito em três tons: comporta (verde); depende de ações que cabem no calendário (dourado); depende de decisão sobre
       prazo ou formato, porque nem o calendário comporta (vermelho). Os números são os mesmos de antes. */
    var inviavel = r.realizou + r.maxPlanejado < r.meta, tom = !inviavel ? 'ok' : r.fatores.calendario ? 'decisao' : 'acao';
    var frase = r.indeterminado ? 'Não dá para estimar as turmas extras: falta o formato de turma (encontros, horário e vagas). Configure no ADMIN.'
      : r.fatores.calendario ? 'Seriam necessárias ' + nec + ' turmas extras, mas só ' + cabem + ' cabem no calendário até o prazo. Mesmo abrindo todas, ' + semTurma + ' pessoas para a meta ficam sem turma possível.'
      : inviavel ? 'Faltam ' + (r.meta - r.realizou - r.maxPlanejado) + ' vagas nas turmas planejadas, mesmo se todas lotarem' + (r.margem ? ' (com a margem de ' + r.margem + ')' : '') + '. ' + (nec === 1 ? 'A turma extra necessária cabe no calendário: atingir a meta depende de abri-la' : 'As ' + nec + ' turmas extras necessárias cabem no calendário: atingir a meta depende de abri-las') + ' e de garantir inscrição e presença.'
      : 'Se todas as turmas planejadas lotarem, elas comportam todo o público pendente. O desafio é inscrever e garantir presença.';
    var titV = { ok: r.margem ? 'As turmas planejadas comportam a meta' : 'As turmas planejadas comportam 100%', acao: 'Atingir a meta depende de ações', decisao: 'Meta depende de decisão sobre prazo ou formato' }[tom];
    h += '<article class="pnl-card" data-pnl="bloco-viabilidade"><h2>2 · Viabilidade até ' + br(r.prazo) + '</h2>' +
      '<div class="pnl-veredito' + (tom === 'decisao' ? '' : ' pnl-veredito--' + tom) + '" data-pnl="veredito" data-tom="' + tom + '"><strong>' + titV + '</strong><span>' + esc(frase) + '</span></div>' +
      '<p class="pnl-premissa" data-pnl="premissa-maximo"><b>Premissa:</b> cenário máximo — todas as turmas planejadas lotam e todos os inscritos comparecem' + (r.realista ? '. O cenário realista está logo abaixo.' : '. Para um cenário mais próximo do real, configure a ocupação esperada em ADMIN › Painel do Programa.') + '</p>' +
      regua(r) + '<p class="pnl-regua-texto">Realizado <b>' + f1(r.pct.realizado) + '%</b> · com as turmas planejadas <b>' + f1(r.pct.maxPlanejado) + '%</b> · com as que cabem no calendário <b>' + f1(r.pct.maxExpansao) + '%</b> · meta ' + f1(r.pctMeta) + '%</p>' +
      (r.realista ? '<p class="pnl-realista" data-pnl="realista"><b>Cenário realista</b> (ocupação esperada de ' + r.realista.ocupacao + '%): chega a <b>' + f1(r.realista.pctEsperado) + '%</b> com as turmas planejadas; faltariam <b>' + r.realista.falta + '</b> pessoas' + (r.realista.falta ? ' · turmas extras: <b>' + (r.realista.turmasExtras == null ? 'indeterminado' : r.realista.turmasExtras) + '</b>' + GRUPOS_TXT(r.realista) : '') + '.</p>' : '') +
      '<div class="pnl-linha"><span>Com as inscrições confirmadas: <b>' + f1(r.pct.potencial) + '%</b></span><span>Turmas extras: <b>' + (r.indeterminado ? 'indeterminado' : nec + (nec === 1 ? ' necessária · ' : ' necessárias · ') + cabem + (cabem === 1 ? ' cabe' : ' cabem') + ' até ' + br(r.prazo)) + '</b></span></div>' +
      '<div class="pnl-chips" data-pnl="fatores">' + (r.principal ? '<span class="pnl-sub">Impedimento principal:</span>' : '') +
      ['calendario', 'capacidade', 'mobilizacao'].filter(function (k) { return r.fatores[k]; }).map(function (k) { return '<span class="pnl-chip' + (k === r.principal ? ' pnl-chip--principal' : '') + '">' + FATOR[k] + '</span>'; }).join('') +
      '</div><p class="pnl-nota">O máximo com as turmas que cabem é um cenário, não capacidade autorizada.</p>' + linkVista('capacidade', 'Capacidade, calendário e premissas') + '</article>';
    /* 3. gaps */
    h += blocoGaps(r);
    /* 4. decisões */
    h += '<article class="pnl-card" data-pnl="bloco-decisoes"><h2>4 · Decisões necessárias</h2>' + (r.decisoes.length ? '<ol class="pnl-decisoes">' + r.decisoes.map(function (x) {
      /* O cartão inteiro leva à consulta da decisão; a etiqueta diz para onde. Sem destino, nada parece link. */
      var href = hrefDecisao(x), d = DESTINO_DECISAO[x.tipo];
      var miolo = '<b>' + esc(x.titulo) + '</b><span>' + esc(x.texto) + '</span><span class="pnl-decisao-pe"><span class="pnl-tag">' + esc(x.tag) + '</span>' + (href ? '<span class="pnl-decisao-ir">' + esc(d[2]) + ' →</span>' : '') + '</span>';
      return '<li data-pnl-decisao="' + x.tipo + '"' + (href ? ' class="pnl-decisao--link"><a class="pnl-decisao-link" href="' + href + '">' + miolo + '</a>' : '>' + miolo) + '</li>'; }).join('') + '</ol>'
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
  function bloco(titulo, valor, texto, chave, extra) { return '<div class="pnl-bloco"' + (chave ? ' data-pnl="' + chave + '"' : '') + '><h3>' + esc(titulo) + '</h3><div class="pnl-v">' + valor + '</div><p>' + esc(texto) + '</p>' + (extra || '') + '</div>'; }
  /* ---------- 3 · Gaps por diretoria (v3 aprovada em 10/11/2026) ----------
     Dois modos sobre o MESMO recorte do núcleo (porPublico[pub]); aqui nada é recalculado, só lido. A única conta da tela
     é participação potencial = projetados − realizado (inscrição ou interesse com vaga até o prazo), que o núcleo já soma.
     - Pessoas a alcançar: uma barra por diretoria, escala absoluta comum (0 a um limite redondo ≥ maior GAP do recorte),
       maior GAP primeiro; o total fica no resumo do topo (não cabe na mesma régua sem achatar as diretorias).
     - Cobertura (%): escala fixa 0–100%, realizado + participação potencial até a projetada, menor cobertura primeiro (a
       ordem do núcleo); um divisor marca, na lista, onde está a cobertura do recorte (no lugar de uma linha sobre as barras).
     Nenhuma diretoria é suprimida: as sem ninguém no recorte aparecem no fim, sem barra. A sigla leva às gerências. */
  var ENTRE = { todos: 'no programa', tecnicos: 'entre técnicos', gestores: 'entre gestores', diretores: 'entre diretores', assessores: 'entre assessores' };
  /* limite redondo da escala de pessoas: o menor de 2, 4, 5, 6, 8, 10 × 10^k ≥ m (o 5 só a partir de 50, para a metade ser inteira) */
  function escalaGap(m) {
    if (!(m > 0)) return 0;
    for (var p = 1; ; p *= 10) { var c = p > 1 ? [2, 4, 5, 6, 8, 10] : [2, 4, 6, 8, 10]; for (var i = 0; i < c.length; i++) if (c[i] * p >= m) return c[i] * p; }
  }
  function blocoGaps(r) {
    var rec = recorte(r), T = rec.total, modo = st.modo === 'cob' ? 'cob' : 'gap';
    var pot = function (o) { return o.projetados - o.realizou; };
    var dirs = rec.diretorias.map(function (d, iCob) { return { d: d, i: iCob }; });
    if (modo === 'gap') dirs.sort(function (a, b) { return (!a.d.total) - (!b.d.total) || b.d.gap - a.d.gap || a.i - b.i; });
    var sigla = function (d) { return '<a class="pnl-gaps-sig pnl-gp-link" href="#painel?v=diretorias&amp;d=' + encodeURIComponent(d.nome) + '&amp;de=bloco-gaps" aria-label="' + esc(d.nome) + ': ver as gerências">' + esc(d.nome) + '</a>'; };
    var abre = function (x, extra) { return '<div class="pnl-gaps-lin' + (extra || '') + '" data-pnl-dir="' + esc(x.d.nome) + '" data-gap="' + x.d.gap + '" data-ord-cob="' + x.i + '">'; };
    var vazia = function (x) { return abre(x, ' pnl-gaps-lin--vazia') + sigla(x.d) + '<span class="pnl-gaps-sem">sem pessoas neste público</span></div>'; };
    var h = '<article class="pnl-card pnl-gaps pnl-gaps--' + modo + '" data-pnl="bloco-gaps" data-modo="' + modo + '"><h2>3 · Gaps por diretoria</h2>' +
      '<div class="pnl-gaps-ctrl"><span class="pnl-gaps-rot">Público</span>' + filtroPublico() +
      '<span class="pnl-gaps-rot">Mostrar</span><div class="pnl-seg" role="group" aria-label="Mostrar">' + [['gap', 'Pessoas a alcançar'], ['cob', 'Cobertura (%)']].map(function (o) {
        return '<button type="button" data-pnl-modo="' + o[0] + '" aria-pressed="' + (modo === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div></div>';
    var fim = linkVista('diretorias', 'Todas as diretorias e gerências' + (st.pub === 'todos' ? '' : ' (' + PUBS[st.pub].toLowerCase() + ')')) + '</article>';
    if (!T.total) return h + '<p class="admin-empty" data-pnl="gaps-vazio">Nenhuma pessoa ' + (st.pub === 'todos' ? '' : 'do público ' + PUBS[st.pub] + ' ') + 'na base oficial.</p>' + fim;
    if (modo === 'gap') {
      var max = escalaGap(Math.max.apply(null, rec.diretorias.map(function (d) { return d.gap; }).concat([0])));
      /* espaço reservado para o número na ponta da barra, pelo tamanho do maior número */
      var res = (String(max).length * 0.62 + 0.8).toFixed(2) + 'rem';
      h += '<div class="pnl-gaps-resumo" data-pnl="gaps-total"><b>' + T.gap + '</b><span class="pnl-gaps-rt">' + (T.gap === 1 ? 'pessoa falta' : 'pessoas faltam') + ' alcançar ' + ENTRE[st.pub] + '</span>' +
        '<span class="pnl-gaps-rs">de ' + T.total + ' · ' + T.realizou + ' ' + (T.realizou === 1 ? 'realizou' : 'realizaram') + ' · ' + pot(T) + ' com participação potencial</span></div>' +
        '<div class="pnl-gaps-lista" data-pnl="gaps-linhas" data-escala="' + max + '" style="--pnl-res:' + res + '"><div class="pnl-gaps-lin pnl-gaps-cab" aria-hidden="true"><span>Diretoria</span><span>Falta alcançar (pessoas)' +
        (max ? '<span class="pnl-gaps-eixo" data-pnl="gaps-eixo"><span style="left:0">0</span><span style="left:50%">' + max / 2 + '</span><span style="left:100%">' + max + '</span></span>' : '') + '</span></div>' +
        dirs.map(function (x) {
          var d = x.d; if (!d.total) return vazia(x);
          return abre(x) + sigla(d) + '<span class="pnl-gaps-gbar" role="img" aria-label="' + esc(d.nome) + ': faltam alcançar ' + d.gap + ' de ' + d.total + '"><i style="width:calc((100% - var(--pnl-res)) * ' + (max ? d.gap / max : 0) + ')"></i><b>' + d.gap + '</b></span>' +
            '<span class="pnl-gaps-apoio">Realizado <strong>' + d.realizou + '</strong> · Participação potencial <strong>' + pot(d) + '</strong> · Público <strong>' + d.total + '</strong></span></div>';
        }).join('') + '</div>' +
        '<p class="pnl-nota" data-pnl="gaps-exemplo">Falta alcançar = público − realizado − participação potencial (inscrição ou interesse com vaga numa turma que termina até o prazo). Toque na sigla para ver as gerências.</p>';
      return h + fim;
    }
    /* divisor da cobertura do recorte: entre a última diretoria abaixo dela e a primeira no nível dela ou acima */
    var pos = -1;
    dirs.forEach(function (x, i) { if (pos < 0 && i > 0 && x.d.total && x.d.cobertura >= T.cobertura && dirs[i - 1].d.cobertura < T.cobertura) pos = i; });
    var ref = '<div class="pnl-gaps-ref" data-pnl="gaps-ref" data-cob="' + T.cobertura + '">' + (st.pub === 'todos' ? 'Programa' : PUBS[st.pub]) + ' ' + f1(T.cobertura) + '%</div>';
    h += '<div class="pnl-gaps-resumo" data-pnl="gaps-total"><b>' + f1(T.cobertura) + '%</b><span class="pnl-gaps-rt">realizado ' + ENTRE[st.pub] + '</span>' +
      '<span class="pnl-gaps-rs">projetada ' + f1(T.coberturaProjetada) + '% com a participação potencial · ' + T.realizou + ' de ' + T.total + '</span></div>' +
      '<div class="pnl-leg" data-pnl="gaps-legenda"><span><i class="pnl-leg-real"></i>Realizado</span><span><i class="pnl-leg-pot"></i>Participação potencial (até a projetada)</span></div>' +
      '<div class="pnl-gaps-lista" data-pnl="gaps-linhas"><div class="pnl-gaps-lin pnl-gaps-cab" aria-hidden="true"><span>Diretoria</span><span><span class="pnl-gaps-eixo pnl-gaps-eixo--pct"><span style="left:0">0</span><span style="left:50%">50</span><span style="left:100%">100%</span></span></span>' +
      '<span class="pnl-n">Realizado<span class="pnl-gaps-so-cel"> / Projetada</span></span><span class="pnl-n pnl-gaps-col-proj">Projetada</span></div>' +
      dirs.map(function (x, i) {
        var d = x.d; if (!d.total) return vazia(x);
        return (i === pos ? ref : '') + abre(x) + sigla(d) +
          '<span class="pnl-gaps-cbar" role="img" aria-label="' + esc(d.nome) + ': realizado ' + f1(d.cobertura) + '%, projetada ' + f1(d.coberturaProjetada) + '%">' +
          (d.coberturaProjetada > d.cobertura ? '<span class="pnl-gaps-pot" style="left:' + d.cobertura + '%;width:' + (d.coberturaProjetada - d.cobertura) + '%"></span>' : '') + '<span class="pnl-gaps-real" style="width:' + d.cobertura + '%"></span></span>' +
          '<span class="pnl-gaps-pct">' + f1(d.cobertura) + '%<small>' + f1(d.coberturaProjetada) + '%</small></span><span class="pnl-n pnl-gaps-col-proj">' + f1(d.coberturaProjetada) + '%</span></div>';
      }).join('') + '</div>' +
      '<p class="pnl-nota" data-pnl="gaps-exemplo">Realizado = concluiu com a frequência mínima. Projetada = realizado + participação potencial, que não garante a participação. Toque na sigla para ver as gerências.</p>';
    return h + fim;
  }
  /* Exportação com nomes: só o ADMIN geral vê o botão (convidados ficam com os números). */
  function podeExportar() { var A = window.faAuth, s = A && A.getSession(); return !!(s && A.isAdmin(s.email)); }
  /* pub: recorte da exportação (só Diretorias e áreas passa o filtro de público; as outras consultas exportam todos). */
  function rotuloExportar(pub) { return 'Exportar Excel com os nomes' + (pub && pub !== 'todos' ? ' (' + PUBS[pub].toLowerCase() + ')' : ''); }
  function botaoExportar(pub) {
    return podeExportar() ? '<div class="pnl-exportar"><button type="button" class="btn" data-pnl="exportar" data-pub="' + (pub || 'todos') + '">' + rotuloExportar(pub) + '</button><span class="pnl-nota" data-pnl="exportar-msg" role="status"></span></div>' : '';
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
  function planilhaExportacao(r, pub) {
    var cab = ['Nome', 'E-mail', 'Diretoria', 'Gerência', 'Público', 'Situação', 'Realizou em', 'Data da realização', 'Inscrição em', 'Interesse em', 'Vaga até o prazo', 'Cabe em vaga livre de', 'Ausências'];
    var linha = function (p) { return [p.nome, p.email, p.diretoria, p.gerencia, PUB_NOME[p.publico] || p.publico, SIT_NOME[p.situacao] || p.situacao, p.realizouEm, p.realizouData ? br(p.realizouData) + '/' + p.realizouData.slice(0, 4) : '', p.inscricoes, p.interesses, p.vagaAtePrazo, p.cabeEmVagaLivre, p.ausencias]; };
    var doRecorte = !pub || pub === 'todos' ? r.lista : r.lista.filter(function (p) { return p.publico === pub; });
    var so = function (f) { return doRecorte.filter(f).map(linha); };
    return [
      ['Todas', so(function () { return true; })],
      ['Sem cadastro', so(function (p) { return p.situacao === 'sem-cadastro'; })],
      ['Cadastradas sem engajamento', so(function (p) { return p.situacao === 'sem-engajamento'; })],
      ['Interessadas sem inscrição', so(function (p) { return p.situacao === 'interessada'; })],
      ['Inscritas, ainda não realizaram', so(function (p) { return p.situacao === 'inscrita'; })],
      ['Realizaram', so(function (p) { return p.situacao === 'realizou'; })],
      ['Faltaram e seguem pendentes', so(function (p) { return p.faltouPendente; })],
      ['Com ausência (histórico)', so(function (p) { return !!p.ausencias; })]
    ].map(function (a) { return { nome: a[0], cab: cab, linhas: a[1] }; });
  }
  function exportar(btn) {
    var msg = document.querySelector('[data-pnl="exportar-msg"]'), r = st.r, pub = btn.getAttribute('data-pub') || 'todos';
    var fim = function (t) { btn.disabled = false; btn.textContent = rotuloExportar(pub); if (msg) msg.textContent = t || ''; };
    if (!r || !r.lista || !podeExportar()) return;
    btn.disabled = true; btn.textContent = 'Gerando…'; if (msg) msg.textContent = '';
    carregarXlsx(function (erro) {
      if (erro || !window.XLSX) { fim('Não foi possível gerar o arquivo agora. Tente de novo.'); return; }
      try {
        var X = window.XLSX, wb = X.utils.book_new();
        planilhaExportacao(r, pub).forEach(function (a) {
          var ws = X.utils.aoa_to_sheet([a.cab].concat(a.linhas));
          ws['!cols'] = a.cab.map(function (c, i) { return { wch: Math.min(48, Math.max.apply(null, [String(c).length + 2].concat(a.linhas.map(function (l) { return String(l[i] == null ? '' : l[i]).length + 2; })))) }; });
          ws['!autofilter'] = { ref: X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: a.linhas.length, c: a.cab.length - 1 } }) };
          X.utils.book_append_sheet(wb, ws, a.nome);
        });
        X.writeFile(wb, 'painel-programa-pessoas-' + (pub === 'todos' ? '' : pub + '-') + r.hoje + '.xlsx');
        fim('Arquivo gerado com os dados lidos em ' + (st.lidoEm ? new Date(st.lidoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—') + '.');
      } catch (e) { fim('Não foi possível gerar o arquivo agora. Tente de novo.'); }
    });
  }
  function GRUPOS_TXT(re) {
    var p = ['tecnicos', 'gestores'].filter(function (g) { return re.porGrupo[g].turmasExtras; }).map(function (g) { return re.porGrupo[g].turmasExtras + ' de ' + (g === 'gestores' ? 'gestores' : 'técnicos'); });
    return p.length ? ' (' + p.join(' e ') + ')' : '';
  }
  function diretorias(r) {
    /* Filtro de público (o mesmo do bloco de gaps). Quem pode ver nomes (admin geral) vê cada gerência e, ao tocar nela,
       as pessoas com a situação; convidados veem só números, com as gerências de menos de 5 pessoas agrupadas. */
    /* colunas de situação: inscrita e interessada somadas numa só (as duas ainda precisam comparecer; a soma fecha o público) */
    var COLS = [['realizou', 'Realizou'], ['insInt', 'Inscrita ou interessada'], ['sem-engajamento', 'Cadastrada sem engajamento'], ['sem-cadastro', 'Sem cadastro']];
    var val = function (o, c) { return c === 'insInt' ? o.inscrita + o.interessada : o[c]; };
    var rec = recorte(r), nomes = podeExportar(), nCol = 2 + COLS.length + 3;
    var h = '<article class="pnl-card" data-pnl="diretorias"><h2>Situação por diretoria' + (st.pub === 'todos' ? '' : ' · ' + esc(PUBS[st.pub])) + '</h2>' + filtroPublico() +
      '<div class="table-scroll-wrap"><table class="admin-table pnl-tabela"><thead><tr><th>Diretoria</th><th class="pnl-n">Público</th>' +
      COLS.map(function (c) { return '<th class="pnl-n">' + c[1] + '</th>'; }).join('') + '<th class="pnl-n">Cobertura (realizado)</th><th class="pnl-n" title="Com inscritos e interessados">Projetada</th><th class="pnl-n" title="Pessoas sem inscrição nem interesse">Gap</th></tr></thead><tbody>';
    // A mesma linha serve para a diretoria, para cada gerência dela (que abre logo abaixo, com as mesmas colunas) e para o total.
    var linha = function (o, nome, attrs, neg) {
      var b = function (x) { return neg ? '<b>' + x + '</b>' : x; };
      var cor = !o.total || neg ? '' : ' style="background:' + (o.cobertura < 15 ? 'rgba(255,59,48,.30)' : o.cobertura < 30 ? 'rgba(246,190,123,.25)' : 'rgba(126,226,168,.18)') + '"';
      return '<tr' + attrs + '><td>' + nome + '</td><td class="pnl-n">' + b(o.total) + '</td>' + COLS.map(function (c) { return '<td class="pnl-n">' + b(val(o, c[0])) + '</td>'; }).join('') +
        '<td class="pnl-n"' + cor + '>' + b(o.total ? f1(o.cobertura) + '%' : '—') + '</td><td class="pnl-n"' + (neg ? ' data-pnl="proj-total"' : '') + '>' + b(o.total ? f1(o.coberturaProjetada) + '%' : '—') + '</td><td class="pnl-n"' + (neg ? ' data-pnl="gap-total"' : '') + '>' + b(o.gap) + '</td></tr>';
    };
    var ordemSit = Object.keys(ROT);
    var pessoasDe = function (dir, ger) {
      return r.lista.filter(function (p) { return p.diretoria === dir && p.gerencia === ger && (st.pub === 'todos' || p.publico === st.pub); })
        .sort(function (a, b) { return ordemSit.indexOf(a.situacao) - ordemSit.indexOf(b.situacao) || a.nome.localeCompare(b.nome, 'pt-BR'); });
    };
    rec.diretorias.forEach(function (d, i) {
      var gs = nomes ? d.gerenciasTodas : d.gerencias;
      h += linha(d, gs.length ? '<button type="button" class="pnl-dir-abrir" data-pnl-abrir="' + i + '" aria-expanded="false"><span aria-hidden="true">▸</span> ' + esc(d.nome) + '</button>' : '<span class="pnl-dir-vazia">' + esc(d.nome) + '</span>', ' class="pnl-dir" data-pnl-dir-nome="' + esc(d.nome) + '"');
      gs.forEach(function (g, j) {
        if (!nomes) { h += linha(g, '<span class="pnl-ger-nome">' + esc(g.nome) + '</span>', ' class="pnl-ger" data-pnl-ger="' + i + '" hidden'); return; }
        var id = i + '-' + j, ps = pessoasDe(d.nome, g.nome);
        h += linha(g, '<button type="button" class="pnl-ger-nome pnl-ger-abrir" data-pnl-nomes="' + id + '" aria-expanded="false"><span aria-hidden="true">▸</span> ' + esc(g.nome) + '</button>', ' class="pnl-ger" data-pnl-ger="' + i + '" hidden');
        h += '<tr class="pnl-nomes" data-pnl-nomes-de="' + id + '" data-pnl-nomes-dir="' + i + '" hidden><td colspan="' + nCol + '"><ul class="pnl-nomes-lista">' + ps.map(function (p) {
          return '<li data-sit="' + p.situacao + '"><span>' + esc(p.nome || p.email) + '</span><span class="pnl-nomes-sit" style="border-color:' + COR[p.situacao] + '">' + esc(SIT_NOME[p.situacao] || p.situacao) + (p.inscricoes || p.interesses ? ' · ' + esc(p.inscricoes || p.interesses) : '') + '</span></li>'; }).join('') + '</ul></td></tr>';
      });
    });
    h += linha(rec.total, '<b>Total</b>', '', true) + '</tbody></table></div>' +
      '<p class="pnl-nota">Cada pessoa aparece numa situação só; as linhas somam o público' + (st.pub === 'todos' ? '' : ' de ' + PUBS[st.pub].toLowerCase()) + '. Projetada = realizados + inscritos e interessados com vaga numa turma que termina até o prazo, se comparecerem com a frequência mínima (interesse ainda precisa da confirmação; inscrição em turma depois do prazo, em turma passada sem encerrar ou em andamento sem chance de atingir o mínimo não entra). Gap = público − projetados. Toque na diretoria para ver as gerências, com as mesmas colunas' +
      (nomes ? '; toque na gerência para ver as pessoas e a situação de cada uma.' : '; gerências com menos de 5 pessoas aparecem agrupadas.') + '</p>' + botaoExportar(st.pub) + '</article>';
    return h;
  }
  /* Mobilização: cada número leva às pessoas dele (só admin geral, como a exportação; convidados ficam com os números).
     Os mesmos critérios das abas da exportação, para a lista e o Excel nunca divergirem. */
  var MOB = {
    'sem-cadastro': ['Sem cadastro', function (p) { return p.situacao === 'sem-cadastro'; }],
    'sem-engajamento': ['Cadastradas sem engajamento', function (p) { return p.situacao === 'sem-engajamento'; }],
    interessada: ['Interessadas sem inscrição', function (p) { return p.situacao === 'interessada'; }],
    inscrita: ['Inscritas, ainda não realizaram', function (p) { return p.situacao === 'inscrita'; }],
    faltou: ['Faltaram e seguem pendentes', function (p) { return p.faltouPendente; }]
  };
  function verPessoas(cat, n) {
    return podeExportar() && n ? '<button type="button" class="pnl-ver-pessoas" data-pnl-ver="' + cat + '" aria-expanded="false" aria-controls="pnlMobLista">' + (n === 1 ? 'Ver a pessoa' : 'Ver as ' + n + ' pessoas') + ' <span aria-hidden="true">▸</span></button>' : '';
  }
  function listaMob(cat) {
    var r = st.r, m = MOB[cat]; if (!r || !r.lista || !m || !podeExportar()) return '';
    /* Agrupada por diretoria (um título por grupo), nomes em ordem alfabética dentro dela; o filtro Diretoria mostra um
       grupo só (só esconde; a lista e a contagem vêm do mesmo cálculo). */
    var nomeDe = function (p) { return p.nome || p.email || ''; };
    var ps = r.lista.filter(m[1]), grupos = {};
    ps.forEach(function (p) { var d = p.diretoria && p.diretoria !== '—' ? p.diretoria : ''; (grupos[d] = grupos[d] || []).push(p); });
    var dirs = Object.keys(grupos).sort(function (a, b) { return (!a) - (!b) || a.localeCompare(b, 'pt-BR'); });
    var rotDir = function (d) { return d || 'Sem diretoria na base'; };
    var qtd = function (n) { return n + (n === 1 ? ' pessoa' : ' pessoas'); };
    return '<h3>' + esc(m[0]) + ' · ' + qtd(ps.length) + '</h3><p class="pnl-nota">Por diretoria, em ordem alfabética. A mesma lista está na aba "' + esc(m[0]) + '" do Excel.</p>' +
      (dirs.length > 1 ? '<div class="avp-filters"><div class="avp-filtro"><label class="avp-filtro-rotulo" for="pnlMobDir">Diretoria</label><select class="avp-select" id="pnlMobDir" data-pnl-mob-dir>' +
        '<option value="">Todas (' + ps.length + ')</option>' + dirs.map(function (d) { return '<option value="' + esc(d || '-') + '">' + esc(rotDir(d)) + ' (' + grupos[d].length + ')</option>'; }).join('') + '</select></div></div>' : '') +
      dirs.map(function (d) {
        var gs = grupos[d].sort(function (a, b) { return nomeDe(a).localeCompare(nomeDe(b), 'pt-BR'); });
        return '<section class="pnl-mob-grupo" data-pnl-mob-grupo="' + esc(d || '-') + '"><h4>' + esc(rotDir(d)) + ' · ' + qtd(gs.length) + '</h4><ul class="pnl-nomes-lista pnl-nomes-lista--mob">' + gs.map(function (p) {
          var turma = p.inscricoes || p.interesses, ger = p.gerencia && p.gerencia !== '—' ? p.gerencia : 'sem gerência na base';
          return '<li data-sit="' + p.situacao + '"><span>' + esc(nomeDe(p)) + '</span><span class="pnl-nomes-sit" style="border-color:' + COR[p.situacao] + '">' + esc(ger) + (turma ? ' · ' + esc(turma) : '') + (cat === 'faltou' ? ' · ' + esc(SIT_NOME[p.situacao] || p.situacao) : '') + '</span></li>'; }).join('') + '</ul></section>';
      }).join('');
  }
  function mobilizacao(r) {
    var a = r.ausencias;
    return '<article class="pnl-card"><h2>Pendentes por situação</h2>' + barraSituacoes(r) + '<div class="pnl-blocos">' +
      bloco('Sem cadastro', r.porSit['sem-cadastro'], 'Estão na base oficial e não têm cadastro com o mesmo e-mail. Não prova desconhecimento do programa: pede investigação e comunicação.', 'mob-sem-cadastro', verPessoas('sem-cadastro', r.porSit['sem-cadastro'])) +
      bloco('Cadastradas sem engajamento', r.porSit['sem-engajamento'], 'Têm cadastro, nenhum interesse nem inscrição ativos, e nunca realizaram.', '', verPessoas('sem-engajamento', r.porSit['sem-engajamento'])) +
      bloco('Interessadas sem inscrição', r.porSit.interessada, 'Interesse ativo numa turma do programa, sem confirmação. Há ' + r.vagasLivres + ' vagas livres até o prazo.', 'mob-interessada', verPessoas('interessada', r.porSit.interessada)) +
      bloco('Inscritas, ainda não realizaram', r.porSit.inscrita, r.potencial + ' em turmas que terminam até o prazo e ainda podem realizar.', '', verPessoas('inscrita', r.porSit.inscrita)) +
      bloco('Faltaram e seguem pendentes', a.pendentes, a.pendentesComNovaInscricao + ' delas já têm nova inscrição.', '', verPessoas('faltou', a.pendentes)) +
      '</div>' + (podeExportar() ? '<div class="pnl-mob-lista" id="pnlMobLista" data-pnl="mob-lista" role="region" aria-label="Pessoas da situação escolhida" hidden></div>' : '') +
      '<p class="pnl-nota">A lista de espera não entra em nenhum número do painel.</p>' + botaoExportar() + '</article>';
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
    if (r.realista) [['Realista (' + r.realista.ocupacao + '%): realizam nas turmas planejadas', 'esperado'], ['Realista: faltariam', 'falta'], ['Realista: turmas extras', 'turmasExtras']].forEach(function (l) {
      h += '<tr class="pnl-realista-linha" data-pnl="realista-' + l[1] + '"><td>' + esc(l[0]) + '</td>' + ['tecnicos', 'gestores', 'diretores', 'assessores'].map(function (g) { var x = r.realista.porGrupo[g][l[1]]; return '<td class="pnl-n">' + ((g === 'diretores' || g === 'assessores') && l[1] === 'turmasExtras' ? '—' : x == null ? 'indeterminado' : x) + '</td>'; }).join('') + '</tr>';
    });
    var semPrev = ['diretores', 'assessores'].filter(function (g) { return c[g] && c[g].semTurmaPrevista > 0; });
    h += '</tbody></table></div><p class="pnl-nota">Vagas livres = vagas − registros ativos (interesse e inscrição, inclusive de quem está fora da base): nenhuma vaga ocupada no sistema é liberada pelo cálculo. ' + (r.vagasPresas ? r.vagasPresas + ' vagas estão presas por inscrição duplicada.' : '') + ' Diretores e assessores não entram em turma de técnicos nem de gestores: só em turma sem público de cargo; turma extra só é estimada para técnicos e gestores.' + (semPrev.length ? ' <b>Sem turma prevista: ' + semPrev.map(function (g) { return c[g].semTurmaPrevista + ' ' + NOMEG[g]; }).join(' e ') + '.</b>' : '') + '</p></article>';
    var sitDe = function (t) { return t.cancelada ? 'cancelada' : t.encerrada ? 'encerrada' : t.passadaAberta ? 'já aconteceu, sem encerrar' : !t.terminaAtePrazo ? 'termina depois do prazo' : t.comecou ? 'em andamento' : 'planejada'; };
    var pubDe = function (t) { return t.grupo === 'conflito' ? 'em conflito' : t.publico || (t.grupo ? NOMEG[t.grupo] : '—'); };   /* o próprio parâmetro do evento (Público-alvo); a restrição de cargo vem dele */
    var opcoes = function (vals) { return '<option value="">Todos</option>' + vals.filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); }).map(function (v) { return '<option>' + esc(v) + '</option>'; }).join(''); };
    var filtro = function (id, rot, campo, vals) { return '<div class="avp-filtro"><label class="avp-filtro-rotulo" for="pnlF' + id + '">' + rot + '</label><select class="avp-select" id="pnlF' + id + '" data-pnl-filtro="' + campo + '">' + opcoes(vals) + '</select></div>'; };
    h += '<article class="pnl-card" data-pnl="turmas-programa"><h2>Turmas do programa</h2><div class="avp-filters">' + filtro('Ev', 'Evento', 'ev', r.turmas.map(function (t) { return t.evento || '—'; })) + filtro('Pub', 'Público', 'pub', r.turmas.map(pubDe)) + filtro('Sit', 'Situação', 'sit', r.turmas.map(sitDe)) +
      '</div><p class="pnl-nota" data-pnl="turmas-contagem" aria-live="polite">' + r.turmas.length + ' de ' + r.turmas.length + ' turmas</p><div class="table-scroll-wrap"><table class="admin-table pnl-tabela"><thead><tr><th>Evento</th><th>Turma</th><th>Datas</th><th>Público</th><th class="pnl-n">Vagas</th><th class="pnl-n">Ocupação</th><th class="pnl-n">Livres</th><th>Situação</th></tr></thead><tbody>' +
      r.turmas.map(function (t) {
        var sit = sitDe(t);
        return '<tr data-ev="' + esc(t.evento || '—') + '" data-pub="' + esc(pubDe(t)) + '" data-sit="' + esc(sit) + '"><td data-pnl="turma-evento">' + esc(t.evento || '—') + '</td><td>' + esc(t.label) + '</td><td>' + t.dias.map(br).join(', ') + (t.horario ? ' · ' + esc(t.horario) : '') + '</td><td>' + esc(pubDe(t)) + '</td><td class="pnl-n">' + (t.vagas || '—') + '</td><td class="pnl-n">' + t.ocupacao + '</td><td class="pnl-n">' + (t.valida ? t.livres : '—') + '</td><td>' + sit + '</td></tr>';
      }).join('') + '</tbody></table></div></article>';
    h += calendario(r);
    var al = r.alertas.filter(function (a) { return /paralelismo|facilitacao|horario|indisponivel|vagas|lotacao|conflito|datas/.test(a.tipo); });
    if (al.length) h += '<article class="pnl-card"><h2>Alertas de planejamento</h2><ul class="pnl-lista">' + al.map(function (a) { return '<li>' + esc(textoAlerta(a)) + '</li>'; }).join('') + '</ul></article>';
    var f = r.formatos;
    h += '<article class="pnl-card"><h2>Premissas desta simulação</h2><ul class="pnl-lista">' +
      (r.facilitacao ? '<li data-pnl="premissa-facilitacao">Facilitadores disponíveis: <b>' + r.facilitacao.disponiveis + '</b> ao mesmo tempo. Turma de técnicos usa <b>' + r.facilitacao.tecnicos + '</b>, de gestores <b>' + r.facilitacao.gestores + '</b>, sem público de cargo <b>' + r.facilitacao.aberta + '</b>. Simultâneo = mesmo dia com horários que se sobrepõem.</li>' +
        '<li>Turmas extras de gestores são encaixadas primeiro; as de técnicos, no que sobra (técnicos e gestores disputam os mesmos facilitadores).</li>'
      : '<li>Turmas simultâneas: até <b>' + (r.limites.tecnicos || '—') + '</b> de técnicos e <b>' + (r.limites.gestores || '—') + '</b> de gestores. Simultâneo = mesmo dia com horários que se sobrepõem.</li>' +
        '<li>Premissa: turmas de técnicos e de gestores não disputam os mesmos facilitadores e salas (configure a facilitação compartilhada em ADMIN se disputam).</li>') +
      (r.margem ? '<li>Margem de ' + r.margem + ' pessoas: a meta é ' + r.meta + ' (público ' + r.N + ' − margem). A margem reduz primeiro o déficit do público que tem o maior déficit.</li>' : '') +
      ['tecnicos', 'gestores'].map(function (g) { var x = f[g]; return '<li>Turma nova de ' + NOMEG[g] + ': ' + (x ? x.encontros + ' encontros em dias úteis seguidos, ' + esc(x.horario) + ', ' + x.vagas + ' vagas (' + (x.origem === 'configurado' ? 'formato configurado no ADMIN' : 'como a turma mais recente, ' + esc(x.ref)) + ').' : 'sem formato: configure no ADMIN.') + '</li>'; }).join('') +
      '<li>Dias úteis: sem sábados, domingos e os dias sem expediente cadastrados. Primeira data para turma nova: ' + brAno(r.primeiraData) + ' (antecedência de ' + r.antecedencia + ' dias úteis).</li>' +
      '<li>Disponibilidade de facilitadores e salas não está cadastrada: o encaixe mostra o que o calendário comporta, nunca a garantia de execução.</li></ul></article>';
    return h;
  }
  function textoAlerta(a) {
    switch (a.tipo) {
      case 'facilitacao-excedida': return 'Já planejado: ' + a.usados + ' facilitadores necessários ao mesmo tempo em ' + brAno(a.dia) + ' (disponíveis: ' + a.disponiveis + ').';
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
    var marca = {}; function m(dia, txt, cls, qt, dica) { (marca[dia] = marca[dia] || []).push('<span class="pnl-t ' + cls + '" title="' + esc((qt ? qt.titulo + ' · ' : '') + (dica || txt)) + '">' + (qt ? '<b class="pnl-t-qt" data-pnl="cal-ocupacao">' + esc(qt.curto) + '</b> ' : '') + esc(txt) + '</span>'); }
    var temCancelada = false;
    r.turmas.forEach(function (t) {
      if (t.encerrada) return;
      // Turma cancelada continua no calendário, riscada e marcada, para não parecer dia livre nem turma que conta.
      if (t.cancelada) { (t.dias || []).forEach(function (d) { temCancelada = true; m(d, 'Cancelada · ' + t.label, 'pnl-t--cancel'); }); return; }
      // Interessados + inscritos (registros ativos) sobre as vagas, para ver de relance quanto cada turma já tem.
      var qt = { curto: t.ocupacao + (t.vagas ? '/' + t.vagas : ''), titulo: t.ocupacao + ' interessados e inscritos' + (t.vagas ? ' para ' + t.vagas + ' vagas' : '') };
      // Turma de vários encontros aparece em todos os dias (ocupa o calendário), mas o número só no 1º: os outros dizem
      // "2º de 5"… — assim somar os números do calendário dá as pessoas, sem contar a mesma turma várias vezes.
      var ds = t.dias.slice().sort(), n = ds.length, cls = t.grupo === 'gestores' ? 'pnl-t--g' : 'pnl-t--t';
      ds.forEach(function (d, i) {
        var enc = n > 1 ? ' · ' + (i + 1) + 'º de ' + n : '';
        m(d, t.label + enc + (t.horario ? ' · ' + t.horario : ''), cls + (i ? ' pnl-t--cont' : ''), i ? null : qt, (t.evento ? t.evento + ' · ' : '') + t.label + enc + (t.horario ? ' · ' + t.horario : '') + (i ? ' (mesmas pessoas do 1º encontro: ' + qt.curto + ')' : ''));
      });
    });
    ['tecnicos', 'gestores'].forEach(function (g) { (r.cap[g].turmasAbrir || []).forEach(function (dias, i) { dias.forEach(function (d) { m(d, 'Nova ' + (g === 'gestores' ? 'G' : 'T') + (i + 1), g === 'gestores' ? 'pnl-t--ng' : 'pnl-t--nt'); }); }); });
    var ini = new Date(+r.primeiraData.slice(0, 4), +r.primeiraData.slice(5, 7) - 1, +r.primeiraData.slice(8)); ini.setDate(ini.getDate() - ((ini.getDay() + 6) % 7));
    var h = '<article class="pnl-card" data-pnl="calendario"><h2>Calendário útil até ' + br(r.prazo) + ' (simulação)</h2>' +
      '<div class="pnl-cal-visao" role="group" aria-label="Turmas simuladas no calendário"><button type="button" class="btn btn--sm" data-pnl-sim="com" aria-pressed="true">Com simulação</button><button type="button" class="btn btn--sm" data-pnl-sim="sem" aria-pressed="false">Sem simulação</button></div>' +
      '<div class="table-scroll-wrap"><div class="pnl-cal">' + ['seg', 'ter', 'qua', 'qui', 'sex'].map(function (x) { return '<div class="pnl-cal-cab">' + x + '</div>'; }).join('');
    for (var x = new Date(ini); ; x.setDate(x.getDate() + 1)) {
      var w = x.getDay(), iso = x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
      if (iso > r.prazo && w === 1) break;
      if (w === 0 || w === 6) continue;
      var ind = r.indisponiveis[iso], fora = iso < r.primeiraData || iso > r.prazo;
      h += '<div class="pnl-dia' + (ind ? ' pnl-dia--ind' : '') + (fora ? ' pnl-dia--fora' : '') + '"><b>' + br(iso) + '</b>' + (ind ? '<span class="pnl-nota">' + esc(ind) + '</span>' : '') + (marca[iso] || []).join('') + '</div>';
    }
    return h + '</div></div><div class="pnl-leg"><span><i class="pnl-t--t"></i>Turma de técnicos</span><span><i class="pnl-t--g"></i>Turma de gestores</span><span class="pnl-leg-sim"><i class="pnl-t--nt"></i>Nova de técnicos (simulada)</span><span class="pnl-leg-sim"><i class="pnl-t--ng"></i>Nova de gestores (simulada)</span><span><i class="pnl-dia--ind"></i>Dia sem expediente</span><span><b class="pnl-t-qt">18/20</b>&nbsp;interessados + inscritos / vagas (só no 1º encontro; "2º de 5" = mesma turma, mesmas pessoas)</span>' + (temCancelada ? '<span data-pnl="leg-cancelada"><i class="pnl-t--cancel"></i>Turma cancelada (não conta)</span>' : '') + '</div></article>';
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
      if (r.composicao && !r.composicao.fecha) h += '<div class="pnl-alerta" role="alert" data-pnl="composicao"><b>A conta do público não fecha.</b> Total configurado: ' + r.composicao.total + '. Situação não ativa ' + r.composicao.situacaoInativa + ' + cargo não compatível ' + r.composicao.cargoIncompativel + ' + base importada ' + r.composicao.base + (r.composicao.facilitadores ? ' (público ' + r.composicao.publico + ' + ' + r.composicao.facilitadores + ' facilitador' + (r.composicao.facilitadores === 1 ? '' : 'es') + ')' : '') + ' = ' + r.composicao.soma + ' (diferença de ' + Math.abs(r.composicao.diferenca) + ' pessoa' + (Math.abs(r.composicao.diferenca) === 1 ? '' : 's') + '). Confira a base importada e os parâmetros em ADMIN › Painel do Programa.</div>';
      if (r.N) h += ({ executiva: executiva, diretorias: diretorias, mobilizacao: mobilizacao, ausencias: ausencias, capacidade: capacidade, evolucao: evolucao })[v](r);
    }
    el.innerHTML = h;
    aplicarFoco();
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-pnl="atualizar"]');
    if (b && $('page-painel') && !$('page-painel').hidden) { e.preventDefault(); atualizar(); return; }
    var sim = e.target.closest && e.target.closest('[data-pnl-sim]');
    if (sim) { var cal = sim.closest('[data-pnl="calendario"]'), sem = sim.getAttribute('data-pnl-sim') === 'sem'; if (cal) { cal.classList.toggle('pnl-cal--sem-sim', sem); cal.querySelectorAll('[data-pnl-sim]').forEach(function (b) { b.setAttribute('aria-pressed', (b.getAttribute('data-pnl-sim') === 'sem') === sem ? 'true' : 'false'); }); } return; }
    var ab = e.target.closest && e.target.closest('[data-pnl-abrir]');
    if (ab) {
      var aberto = ab.getAttribute('aria-expanded') !== 'true', di = ab.getAttribute('data-pnl-abrir'); ab.setAttribute('aria-expanded', aberto ? 'true' : 'false'); ab.firstChild.textContent = aberto ? '▾' : '▸';
      document.querySelectorAll('[data-pnl-ger="' + di + '"]').forEach(function (tr) { tr.hidden = !aberto; });
      /* fechar a diretoria fecha também os nomes abertos das gerências dela */
      if (!aberto) { document.querySelectorAll('[data-pnl-nomes-dir="' + di + '"]').forEach(function (tr) { tr.hidden = true; }); document.querySelectorAll('[data-pnl-ger="' + di + '"] [data-pnl-nomes]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); b.firstChild.textContent = '▸'; }); }
      return;
    }
    var nb = e.target.closest && e.target.closest('[data-pnl-nomes]');
    if (nb) { var ab2 = nb.getAttribute('aria-expanded') !== 'true', lin = document.querySelector('[data-pnl-nomes-de="' + nb.getAttribute('data-pnl-nomes') + '"]'); nb.setAttribute('aria-expanded', ab2 ? 'true' : 'false'); nb.firstChild.textContent = ab2 ? '▾' : '▸'; if (lin) lin.hidden = !ab2; return; }
    var vp = e.target.closest && e.target.closest('[data-pnl-ver]');
    if (vp) {
      /* um cartão aberto por vez: abrir outro troca a lista; tocar no aberto fecha */
      var painel = document.querySelector('[data-pnl="mob-lista"]'), abrir = vp.getAttribute('aria-expanded') !== 'true';
      document.querySelectorAll('[data-pnl-ver]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); b.lastChild.textContent = '▸'; });
      if (!painel) return;
      if (!abrir) { painel.hidden = true; painel.innerHTML = ''; return; }
      vp.setAttribute('aria-expanded', 'true'); vp.lastChild.textContent = '▾';
      painel.innerHTML = listaMob(vp.getAttribute('data-pnl-ver')); painel.hidden = false;
      if (painel.scrollIntoView) painel.scrollIntoView({ block: 'start', behavior: 'smooth' });
      return;
    }
    var pb = e.target.closest && e.target.closest('[data-pnl-pub]');
    if (pb) { st.pub = pb.getAttribute('data-pnl-pub'); render(); return; }
    var md = e.target.closest && e.target.closest('[data-pnl-modo]');
    if (md) {
      st.modo = md.getAttribute('data-pnl-modo') === 'cob' ? 'cob' : 'gap'; render();
      var nb = document.querySelector('[data-pnl-modo="' + st.modo + '"]'); if (nb) nb.focus({ preventScroll: true });
      return;
    }
    var ex = e.target.closest && e.target.closest('[data-pnl="exportar"]');
    if (ex) { e.preventDefault(); exportar(ex); return; }
    var a = e.target.closest && e.target.closest('[data-pnl-admin]');
    if (a) { e.preventDefault(); location.hash = '#admin'; setTimeout(function () { var t = document.querySelector('.admin-tab-btn[data-panel="adminPanelPainelPrograma"]'); if (t) t.click(); }, 300); }
  });
  /* Filtro Diretoria da lista de pessoas da Mobilização: mostra só o grupo escolhido (vazio = todos). */
  document.addEventListener('change', function (e) {
    var sel = e.target.closest && e.target.closest('[data-pnl-mob-dir]'); if (!sel) return;
    document.querySelectorAll('[data-pnl-mob-grupo]').forEach(function (g) { g.hidden = !!sel.value && g.getAttribute('data-pnl-mob-grupo') !== sel.value; });
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
  window.addEventListener('hashchange', function () { if (/^#painel/.test(location.hash)) { st.focoAplicado = null; window.scrollTo(0, 0); render(); } });
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
  window.faPainelPrograma = { atualizar: atualizar, _estado: function () { return st; }, _escalaGap: escalaGap, _evolucao: evolucao, _planilha: function (pub) { return st.r ? planilhaExportacao(st.r, pub) : null; } };
})();
