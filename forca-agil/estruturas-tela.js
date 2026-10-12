/* ============================================================
   Força Ágil — Núcleo de Avaliação, Taxonomia e Mapa da Floresta
   ESTRUTURAS ORGANIZACIONAIS — TELA DE CADASTRO (ADMIN › Avaliação e Mapa › Estruturas Organizacionais)
   (window.faEstruturasAdmin)

   Criar, consultar, alterar e encerrar as estruturas organizacionais concretas dos 8 tipos firmes (as seis
   especializações de Linha, Área Especializada e Centro de Excelência), com histórico. É SÓ apresentação:
     - quem decide é o núcleo, pelo caso de uso compartilhado (estruturas-casos-de-uso.js);
     - quem lê e grava é o adaptador Firebase (estruturas-firebase.js), e o banco confere tudo de novo
       (database.rules.json › estruturas-concretas).
   Os textos de erro só traduzem os códigos do núcleo e da persistência; nenhuma regra é repetida aqui.

   NESTA ETAPA: só existe no AMBIENTE DE TESTES (Firebase Emulator — window.faAmbiente.testes). Fora dele,
   disponivel() é false e o cartão nem aparece na área.

   Endereço: #admin?arq=estruturas (lista) e #admin?arq=estruturas&e=<id> (ficha) — F5 reabre a mesma tela.
   ============================================================ */
(function () {
  'use strict';

  var RAIZ_ROTA = '#admin?arq=estruturas';
  function N() { return window.faEstruturasNucleo; }
  function U() { return window.faEstruturasCasosDeUso; }
  function FB() { return window.faEstruturasFirebase; }
  function MOT() { return window.faMotorPosicionamentoNucleo; }
  function P() { return window.faPosicionamentos; }
  function A() { return window.faAuth; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function nomeTipo(c) { return P() ? P().nome(c) : c; }
  function disponivel() { return !!(window.faAmbiente && window.faAmbiente.testes && N() && U() && FB() && MOT() && window.firebase); }
  function podeManter() { var a = A(); return !!(a && ((a.isAdmin && a.isAdmin()) || (a.podeArquitetura && a.podeArquitetura()))); }
  function natureza(tipo) {
    if (tipo === 'AREA_ESPECIALIZADA') return 'Área Especializada';
    if (tipo === 'COE') return 'Centro de Excelência';
    return MOT() && MOT().liberaSquadParaCodigoFirme(tipo) === true ? 'Linha' : '—';
  }
  function dataHora(v) {
    var t = N() ? N().instante(v) : null;
    return t === null ? '—' : new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function quem(p) { return p ? esc(p.email || p.id) : '—'; }

  /* tradução dos códigos do núcleo e da persistência (o que aconteceu e o que fazer) */
  var CAMPO = { nome: 'Nome', sigla: 'Sigla', descricao: 'Descrição', tipo: 'Tipo', motivo: 'Motivo', justificativa: 'Justificativa' };
  function mensagem(e) {
    var c = e && e.codigo;
    switch (c) {
      case 'CAMPO_OBRIGATORIO': return e.campo === 'tipo' ? 'Escolha o tipo da estrutura.' : 'Preencha o campo ' + (CAMPO[e.campo] || e.campo) + '.';
      case 'CAMPO_LONGO_DEMAIS': return 'O campo ' + (CAMPO[e.campo] || e.campo) + ' aceita até ' + e.maximo + ' caracteres.';
      case 'CAMPO_INVALIDO': return 'O campo ' + (CAMPO[e.campo] || e.campo) + ' tem um valor inválido.';
      case 'TIPO_NAO_ADMITIDO': return 'Este tipo não pode ser cadastrado: a ligação oficial entre o código do Posicionamento e o conceito da Taxonomia não está registrada.';
      case 'CONCEITO_INATIVO_OU_INEXISTENTE': return 'Este tipo não pode ser cadastrado: o conceito correspondente está inativo ou não existe na Taxonomia.';
      case 'NADA_A_ALTERAR': return 'Nada mudou. Altere o nome, a sigla ou a descrição antes de salvar.';
      case 'REVISAO_DESATUALIZADA': case 'CONFLITO_DE_REVISAO': return 'Outra pessoa alterou esta estrutura enquanto você trabalhava. A tela já mostra a versão atual: confira e faça de novo, se ainda for o caso.';
      case 'ESTRUTURA_INEXISTENTE': return 'Esta estrutura não foi encontrada.';
      case 'ESTRUTURA_ENCERRADA': return 'Esta estrutura já está encerrada e não pode mais ser alterada.';
      case 'MOTIVO_OBRIGATORIO': return 'Informe o motivo do encerramento.';
      case 'TIPO_IMUTAVEL': return 'O tipo não muda. Para corrigir o tipo, encerre esta estrutura e cadastre outra.';
      case 'RECUSADA': return 'O banco recusou a gravação. Seu perfil pode não ter permissão para manter estruturas, ou os dados mudaram. Nada foi gravado.';
      case 'SEM_RESPOSTA': case 'GRAVACAO_NAO_CONFIRMADA': return 'O banco não confirmou a gravação a tempo. Clique em salvar de novo: se ela já tiver entrado, nada será duplicado.';
      case 'LEITURA_INDISPONIVEL': return 'Não foi possível ler os dados necessários agora. Verifique a conexão e tente de novo.';
      case 'IDENTIFICADOR_JA_USADO': return 'Este identificador já foi usado. Tente salvar de novo.';
      case 'CONTEXTO_SEM_USUARIO': case 'CONTEXTO_INVALIDO': return 'Sua sessão não foi identificada. Entre novamente.';
      default: return 'Não foi possível concluir (' + c + ').';
    }
  }

  function montar() {
    var wrap = document.getElementById('adminEstruturas');
    if (!wrap) return null;
    function byId(id) { return wrap.querySelector('#' + id); }
    var origem = null; /* { rotulo, voltar } — quem abriu (a área Avaliação e Mapa) */
    var st = novo();
    function novo() { return { vista: 'lista', id: null, estruturas: undefined, eventos: undefined, erroLeitura: null, refs: undefined, refsErro: false,
      form: null, sujo: false, salvando: false, erros: [], flash: null, op: null, mostrarEncerradas: false, historicoAberto: false }; }

    /* ---------- banco: leitura ao vivo e portas ---------- */
    var desligar = null, offset = 0, offsetLigado = false;
    function db() { return window.firebase.database(); }
    function ligar() {
      if (desligar || !disponivel()) return;
      desligar = FB().ouvir(db(), ['registros', 'eventos'], function (m) {
        if (m.estruturas) st.estruturas = m.estruturas;
        if (m.eventos) st.eventos = m.eventos;
        st.erroLeitura = null; render();
      }, function (c) { st.erroLeitura = c; render(); });
      if (!offsetLigado) { offsetLigado = true; db().ref('.info/serverTimeOffset').on('value', function (s) { offset = s.val() || 0; }); }
      if (P()) { P().iniciar(); if (!ligar._nomes) { ligar._nomes = true; P().onMudanca(function () { if (!wrap.hidden) render(); }); } }
    }
    function desligarTudo() { if (desligar) { desligar(); desligar = null; } }
    function portas() { return FB().criarPortas({ db: db(), codigosFirmes: MOT().CODIGOS_FIRMES }); }
    function casos() { return U().criar({ nucleo: N(), codigosFirmes: MOT().CODIGOS_FIRMES }); }
    function lerRefs() {
      st.refs = undefined; st.refsErro = false;
      portas().lerReferencias().then(function (r) { st.refs = r; render(); }, function () { st.refs = null; st.refsErro = true; render(); });
    }
    function chaveNova() { return db().ref().push().key; }

    /* ---------- endereço ---------- */
    function idDoEndereco() { var m = /^#admin\?arq=estruturas(?:&e=([^&]*))?/.exec(location.hash || ''); return m ? (m[1] ? decodeURIComponent(m[1]) : '') : null; }
    function sincronizar() {
      if (wrap.hidden) return;
      var alvo = RAIZ_ROTA + (st.id && st.vista !== 'lista' && st.vista !== 'nova' ? '&e=' + encodeURIComponent(st.id) : '');
      if (location.hash !== alvo && /^#admin\?arq=estruturas/.test(location.hash || '')) history.replaceState(history.state, '', alvo);
    }
    window.addEventListener('hashchange', function () {
      if (wrap.hidden) return;
      var id = idDoEndereco(); if (id === null) return;
      if (id && id !== st.id) { if (st.sujo) return; irPara('detalhe', id); } else if (!id && st.vista !== 'lista' && st.vista !== 'nova' && !st.sujo) irPara('lista');
    });

    /* ---------- navegação ---------- */
    function irPara(vista, id) {
      st.vista = vista; st.id = id || null; st.erros = []; st.sujo = false; st.salvando = false; st.op = null; st.historicoAberto = false;
      if (vista !== 'detalhe') st.flash = null;
      var e = id && st.estruturas ? st.estruturas[id] : null;
      if (vista === 'nova') { st.form = { tipo: '', nome: '', sigla: '', descricao: '' }; lerRefs(); }
      else if (vista === 'editar' && e) st.form = { nome: e.nome || '', sigla: e.sigla || '', descricao: e.descricao || '', justificativa: '', revisao: e.revisao };
      else if (vista === 'encerrar' && e) st.form = { motivo: '', revisao: e.revisao };
      else st.form = null;
      render(); sincronizar();
      var t = byId('estTitulo'); if (t) t.focus({ preventScroll: true });
      window.scrollTo({ top: Math.max(0, wrap.getBoundingClientRect().top + window.pageYOffset - 80), behavior: 'instant' });
    }
    function confirmarDescarte() { return !st.sujo || window.confirm('Há alterações que ainda não foram salvas. Sair mesmo assim?'); }

    /* ---------- salvar (sempre pelo caso de uso compartilhado) ---------- */
    function salvar(operacao, entrada) {
      if (st.salvando) return;
      var u = window.firebase.auth().currentUser;
      if (!u) { st.erros = [{ codigo: 'CONTEXTO_SEM_USUARIO' }]; render(); return; }
      /* a MESMA tentativa reaproveita o identificador da operação: reenviar depois de "sem resposta" não duplica */
      st.op = st.op || { operacaoId: chaveNova(), novoId: chaveNova() };
      var ctx = { operacaoId: st.op.operacaoId, usuario: { id: u.uid, email: u.email }, agora: Date.now() + offset };
      if (operacao === 'criarEstrutura') ctx.novoId = st.op.novoId;
      st.salvando = true; st.erros = []; render();
      casos().executar(operacao, entrada, ctx, portas()).then(function (r) {
        st.salvando = false;
        if (r.ok) {
          var id = operacao === 'criarEstrutura' ? st.op.novoId : entrada.id;
          var texto = operacao === 'criarEstrutura' ? 'Estrutura cadastrada.' : operacao === 'alterarEstrutura' ? 'Alterações salvas.' : 'Estrutura encerrada. Ela sai do Mapa da Floresta e continua aqui, com o histórico.';
          st.op = null; st.sujo = false;
          irPara('detalhe', id);
          st.flash = { texto: texto, nova: operacao === 'criarEstrutura', encerrada: operacao === 'encerrarEstrutura' };
          render();
          var f = byId('estFlash'); if (f) f.focus({ preventScroll: true });
          return;
        }
        var transitorio = r.erros.some(function (e) { return e.codigo === 'SEM_RESPOSTA' || e.codigo === 'GRAVACAO_NAO_CONFIRMADA'; });
        if (!transitorio) st.op = null;
        if (r.erros.some(function (e) { return e.codigo === 'REVISAO_DESATUALIZADA' || e.codigo === 'CONFLITO_DE_REVISAO'; })) {
          var atual = st.estruturas && st.estruturas[entrada.id];
          if (atual && st.form) st.form.revisao = atual.revisao; /* a próxima tentativa parte da versão que está na tela */
        }
        st.erros = r.erros; render();
        var al = byId('estErros'); if (al) al.focus({ preventScroll: true });
      }, function (e) { st.salvando = false; st.erros = [{ codigo: (e && e.codigo) || 'RECUSADA' }]; render(); });
    }

    /* ---------- desenho ---------- */
    function errosHtml() {
      if (!st.erros.length) return '';
      return '<div class="avp-error-msg est-erros" id="estErros" role="alert" tabindex="-1"><strong>Não foi salvo.</strong><ul>' +
        st.erros.map(function (e) { return '<li>' + esc(mensagem(e)) + '</li>'; }).join('') + '</ul></div>';
    }
    function invalido(campo) { return st.erros.some(function (e) { return e.campo === campo || (campo === 'motivo' && e.codigo === 'MOTIVO_OBRIGATORIO') || (campo === 'tipo' && /TIPO_NAO_ADMITIDO|CONCEITO_INATIVO/.test(e.codigo)); }); }
    function campoTexto(id, campo, rotulo, valor, max, opc) {
      opc = opc || {};
      var ajuda = (opc.ajuda ? opc.ajuda + ' ' : '') + 'Até ' + max + ' caracteres.';
      var attrs = ' id="' + id + '" data-campo="' + campo + '" maxlength="' + max + '"' + (invalido(campo) ? ' aria-invalid="true"' : '') + ' aria-describedby="' + id + 'Ajuda"' + (opc.obrigatorio ? ' required' : '');
      return '<div class="avp-field est-campo"><label for="' + id + '">' + esc(rotulo) + (opc.obrigatorio ? ' <span class="est-obrig">(obrigatório)</span>' : ' <span class="est-opc">(opcional)</span>') + '</label>' +
        (opc.area ? '<textarea' + attrs + ' rows="' + (opc.linhas || 3) + '">' + esc(valor) + '</textarea>' : '<input type="text"' + attrs + ' value="' + esc(valor) + '">') +
        '<p class="avp-natureza-ajuda" id="' + id + 'Ajuda">' + esc(ajuda) + '</p></div>';
    }
    function cabecalho(titulo, voltarRotulo, voltarId) {
      return '<button type="button" class="avp-voltar-link" id="' + voltarId + '">← ' + esc(voltarRotulo) + '</button>' +
        '<h4 class="est-titulo" id="estTitulo" tabindex="-1">' + esc(titulo) + '</h4>';
    }
    function aviso() {
      return '<p class="avp-decisao-aviso est-ambiente" id="estAmbiente" role="note"><strong>Ambiente de testes.</strong> O que for cadastrado aqui fica só no Firebase Emulator — não vai para o banco oficial.</p>';
    }
    function listaHtml() {
      var h = cabecalho('Estruturas Organizacionais', 'Voltar para ' + ((origem && origem.rotulo) || 'Avaliação e Mapa'), 'estVoltarOrigem') + aviso();
      h += '<p class="est-intro">As estruturas organizacionais concretas — Linhas, Áreas Especializadas e Centros de Excelência — que aparecem no Mapa da Floresta. O tipo de cada uma é um dos oito posicionamentos firmes.</p>';
      h += '<div class="est-acoes">' + (podeManter() ? '<button type="button" class="btn btn--primary" id="estNova">Cadastrar estrutura</button>' : '') +
        '<a class="btn" id="estVerMapa" href="#avaliacoes?mf=mapa">Ver o Mapa da Floresta</a></div>';
      if (st.erroLeitura) return h + '<div class="avp-error-msg" id="estErroLeitura" role="alert">' + (st.erroLeitura === 'RECUSADA' ? 'Seu acesso não permite consultar as estruturas.' : 'Não foi possível ler as estruturas agora. Verifique se o ambiente de testes está aberto.') + '</div>';
      if (st.estruturas === undefined) return h + '<p class="loading-msg" role="status">Carregando estruturas…</p>';
      var todas = Object.keys(st.estruturas).map(function (k) { return st.estruturas[k]; });
      var encerradas = todas.filter(function (e) { return e.situacao !== 'ativa'; }).length;
      var vis = todas.filter(function (e) { return st.mostrarEncerradas || e.situacao === 'ativa'; })
        .sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome), 'pt-BR'); });
      h += '<div class="est-filtro"><label><input type="checkbox" id="estMostrarEncerradas"' + (st.mostrarEncerradas ? ' checked' : '') + '> Mostrar encerradas (' + encerradas + ')</label>' +
        '<span class="est-contagem" id="estContagem">' + (todas.length - encerradas) + ' ativa' + (todas.length - encerradas === 1 ? '' : 's') + '</span></div>';
      if (!todas.length) return h + '<p class="admin-empty" id="estVazio">Nenhuma estrutura cadastrada ainda.' + (podeManter() ? ' Use "Cadastrar estrutura" para criar a primeira.' : '') + '</p>';
      if (!vis.length) return h + '<p class="admin-empty" id="estVazio">Nenhuma estrutura ativa. Marque "Mostrar encerradas" para ver o histórico.</p>';
      return h + '<ul class="est-lista" id="estLista">' + vis.map(function (e) {
        return '<li><button type="button" class="est-item" data-estrutura="' + esc(e.id) + '">' +
          '<span class="est-item-nome">' + esc(e.nome) + (e.sigla ? ' <span class="est-sigla">(' + esc(e.sigla) + ')</span>' : '') + '</span>' +
          '<span class="est-item-tipo">' + esc(natureza(e.tipo)) + (natureza(e.tipo) === 'Linha' ? ' · ' + esc(nomeTipo(e.tipo)) : '') + '</span>' +
          '<span class="est-situacao est-situacao--' + esc(e.situacao) + '">' + (e.situacao === 'ativa' ? 'Ativa' : 'Encerrada') + '</span></button></li>';
      }).join('') + '</ul>';
    }
    function opcoesTipo() {
      var firmes = MOT().CODIGOS_FIRMES, refs = st.refs;
      var linha = firmes.filter(function (c) { return MOT().liberaSquadParaCodigoFirme(c) === true; });
      var outros = firmes.filter(function (c) { return linha.indexOf(c) === -1; });
      function situacaoRef(c) {
        if (!refs) return null;
        if (!refs.ligacoes || !refs.ligacoes[c]) return 'ligação oficial não registrada';
        if (!refs.conceitos || !refs.conceitos[c] || refs.conceitos[c].ativo !== true) return 'conceito inativo na Taxonomia';
        return null;
      }
      function opcao(c) {
        var motivo = situacaoRef(c), marcado = st.form.tipo === c;
        return '<label class="est-tipo' + (motivo ? ' est-tipo--indisponivel' : '') + '"><input type="radio" name="estTipo" value="' + esc(c) + '"' + (marcado ? ' checked' : '') + (motivo ? ' disabled' : '') + '> ' +
          '<span>' + esc(nomeTipo(c)) + (motivo ? ' <em class="est-tipo-motivo">— indisponível: ' + esc(motivo) + '</em>' : '') + '</span></label>';
      }
      var h = '<fieldset class="est-tipos" id="estTipos"' + (invalido('tipo') ? ' aria-invalid="true"' : '') + '><legend>Tipo <span class="est-obrig">(obrigatório)</span></legend>';
      if (refs === undefined) h += '<p class="loading-msg" role="status">Conferindo as referências oficiais…</p>';
      if (st.refsErro) h += '<p class="avp-error-msg" id="estRefsErro">Não foi possível conferir as referências oficiais agora. Você pode escolher o tipo; a conferência é refeita ao salvar.</p>';
      h += '<p class="est-grupo-tipo">Linha (especialização)</p>' + linha.map(opcao).join('');
      h += '<p class="est-grupo-tipo">Outras categorias</p>' + outros.map(opcao).join('');
      return h + '<p class="avp-natureza-ajuda">O tipo não poderá ser alterado depois. Os tipos e nomes vêm do Posicionamento Organizacional e da Taxonomia.</p></fieldset>';
    }
    function formNovaHtml() {
      var M = N().MAX;
      var h = cabecalho('Cadastrar estrutura', 'Voltar para a lista', 'estVoltarLista') + aviso() + errosHtml();
      h += '<form class="avp-form-card est-form" id="estForm" novalidate>' + opcoesTipo() +
        campoTexto('estNome', 'nome', 'Nome', st.form.nome, M.nome, { obrigatorio: true }) +
        campoTexto('estSigla', 'sigla', 'Sigla', st.form.sigla, M.sigla) +
        campoTexto('estDescricao', 'descricao', 'Descrição', st.form.descricao, M.descricao, { area: true, linhas: 4 }) +
        '<div class="avp-actions-footer"><button type="submit" class="btn btn--primary" id="estSalvar"' + (st.salvando ? ' disabled' : '') + '>' + (st.salvando ? 'Salvando…' : 'Salvar estrutura') + '</button>' +
        '<button type="button" class="btn" id="estCancelar">Cancelar</button></div></form>';
      return h;
    }
    function fichaHtml(e) {
      var linha = natureza(e.tipo) === 'Linha';
      return '<dl class="avp-ficha-meta est-ficha" id="estFicha">' +
        '<dt>Natureza</dt><dd>' + esc(natureza(e.tipo)) + '</dd>' +
        '<dt>' + (linha ? 'Especialização' : 'Tipo oficial') + '</dt><dd>' + esc(nomeTipo(e.tipo)) + '</dd>' +
        '<dt>Sigla</dt><dd>' + (e.sigla ? esc(e.sigla) : '—') + '</dd>' +
        '<dt>Descrição</dt><dd class="est-descricao">' + (e.descricao ? esc(e.descricao) : '—') + '</dd>' +
        '<dt>Situação</dt><dd><span class="est-situacao est-situacao--' + esc(e.situacao) + '">' + (e.situacao === 'ativa' ? 'Ativa' : 'Encerrada') + '</span></dd>' +
        '<dt>Cadastrada</dt><dd>' + dataHora(e.criadaEm) + ' · ' + quem(e.criadaPor) + '</dd>' +
        (e.alteradaEm ? '<dt>Última alteração</dt><dd>' + dataHora(e.alteradaEm) + ' · ' + quem(e.alteradaPor) + '</dd>' : '') +
        (e.encerramento ? '<dt>Encerramento</dt><dd>' + dataHora(e.encerramento.em) + ' · ' + quem(e.encerramento.por) + '<br><span class="est-motivo">Motivo: ' + esc(e.encerramento.motivo) + '</span></dd>' : '') +
        '<dt>Revisão</dt><dd>' + esc(e.revisao) + '</dd></dl>';
    }
    var ROTULO_EVENTO = { 'estrutura.criada': 'Cadastrada', 'estrutura.alterada': 'Alterada', 'estrutura.encerrada': 'Encerrada' };
    function historicoHtml(id) {
      if (st.eventos === undefined) return '<p class="loading-msg">Carregando histórico…</p>';
      var evs = N().historico(st.eventos, 'estrutura', id);
      var h = '<details class="avp-historico-recolhido est-historico" id="estHistorico"' + (st.historicoAberto ? ' open' : '') + '><summary>Histórico — ' + evs.length + ' alteraç' + (evs.length === 1 ? 'ão' : 'ões') + '</summary><ol class="est-eventos">';
      h += evs.slice().reverse().map(function (ev) {
        var linhas = '';
        if (ev.tipo === 'estrutura.alterada' && ev.antes) linhas = (ev.campos || []).map(function (c) {
          return '<li>' + esc(CAMPO[c] || c) + ': <span class="est-antes">' + (ev.antes[c] ? esc(ev.antes[c]) : '(vazio)') + '</span> → <span class="est-depois">' + (ev.depois[c] ? esc(ev.depois[c]) : '(vazio)') + '</span></li>';
        }).join('');
        return '<li class="est-evento" data-tipo="' + esc(ev.tipo) + '"><strong>' + esc(ROTULO_EVENTO[ev.tipo] || ev.tipo) + '</strong> · ' + dataHora(ev.em) + ' · ' + quem(ev.usuario) +
          (linhas ? '<ul class="est-mudancas">' + linhas + '</ul>' : '') +
          (ev.justificativa ? '<p class="est-just">Justificativa: ' + esc(ev.justificativa) + '</p>' : '') +
          (ev.motivo ? '<p class="est-motivo">Motivo: ' + esc(ev.motivo) + '</p>' : '') + '</li>';
      }).join('');
      return h + '</ol></details>';
    }
    function detalheHtml() {
      var e = st.estruturas && st.estruturas[st.id];
      var h = cabecalho(e ? e.nome : 'Estrutura', 'Voltar para a lista', 'estVoltarLista');
      if (st.estruturas === undefined) return h + '<p class="loading-msg" role="status">Carregando…</p>';
      if (!e) return h + '<p class="avp-error-msg" id="estNaoEncontrada">Esta estrutura não foi encontrada.</p>';
      if (st.flash) h += '<div class="avp-flash-success est-flash" id="estFlash" role="status" tabindex="-1"><p>' + esc(st.flash.texto) + '</p>' +
        '<div class="est-flash-acoes">' + (!st.flash.encerrada ? '<a class="btn btn--sm btn--primary" id="estFlashMapa" href="#avaliacoes?mf=mapa&e=' + encodeURIComponent(e.id) + '">Ver no Mapa da Floresta</a>' : '') +
        (st.flash.nova && podeManter() ? '<button type="button" class="btn btn--sm" id="estFlashOutra">Cadastrar outra</button>' : '') + '</div></div>';
      h += aviso() + fichaHtml(e);
      h += '<div class="est-acoes">';
      if (e.situacao === 'ativa') h += '<a class="btn" id="estVerNoMapa" href="#avaliacoes?mf=mapa&e=' + encodeURIComponent(e.id) + '">Ver no Mapa da Floresta</a>';
      if (e.situacao === 'ativa' && podeManter()) h += '<button type="button" class="btn" id="estEditar">Editar</button><button type="button" class="btn btn--danger" id="estEncerrar">Encerrar</button>';
      h += '</div>';
      if (e.situacao !== 'ativa') h += '<p class="avp-decisao-aviso" id="estEncerradaAviso">Estrutura encerrada: não aparece no Mapa da Floresta e não pode ser alterada nem reativada. Para voltar a representá-la, cadastre uma nova.</p>';
      return h + historicoHtml(e.id);
    }
    function formEditarHtml() {
      var e = st.estruturas && st.estruturas[st.id], M = N().MAX;
      var h = cabecalho('Editar: ' + (e ? e.nome : ''), 'Voltar para a ficha', 'estVoltarFicha') + aviso() + errosHtml();
      if (!e) return h + '<p class="avp-error-msg">Esta estrutura não foi encontrada.</p>';
      if (e.revisao !== st.form.revisao) h += '<p class="avp-decisao-aviso" id="estMudouNoBanco" role="status">Esta estrutura foi alterada por outra pessoa depois que você abriu a edição. Ao salvar, o banco vai recusar; volte à ficha para ver a versão atual.</p>';
      h += '<form class="avp-form-card est-form" id="estForm" novalidate>' +
        '<p class="est-tipo-fixo"><strong>Tipo:</strong> ' + esc(nomeTipo(e.tipo)) + ' <span class="avp-natureza-ajuda">— não pode ser alterado (para corrigir, encerre e cadastre outra).</span></p>' +
        campoTexto('estNome', 'nome', 'Nome', st.form.nome, M.nome, { obrigatorio: true }) +
        campoTexto('estSigla', 'sigla', 'Sigla', st.form.sigla, M.sigla) +
        campoTexto('estDescricao', 'descricao', 'Descrição', st.form.descricao, M.descricao, { area: true, linhas: 4 }) +
        campoTexto('estJustificativa', 'justificativa', 'Justificativa da alteração', st.form.justificativa, M.justificativa, { area: true, linhas: 2, ajuda: 'Fica registrada no histórico.' }) +
        '<div class="avp-actions-footer"><button type="submit" class="btn btn--primary" id="estSalvar"' + (st.salvando ? ' disabled' : '') + '>' + (st.salvando ? 'Salvando…' : 'Salvar alterações') + '</button>' +
        '<button type="button" class="btn" id="estCancelar">Cancelar</button></div></form>';
      return h;
    }
    function formEncerrarHtml() {
      var e = st.estruturas && st.estruturas[st.id], M = N().MAX;
      var h = cabecalho('Encerrar: ' + (e ? e.nome : ''), 'Voltar para a ficha', 'estVoltarFicha') + aviso() + errosHtml();
      if (!e) return h + '<p class="avp-error-msg">Esta estrutura não foi encontrada.</p>';
      h += '<form class="avp-form-card est-form" id="estForm" novalidate>' +
        '<div class="avp-reavaliacao-alerta est-confirmacao" role="note"><strong>Confirme o encerramento.</strong> A estrutura sai do Mapa da Floresta e não pode ser alterada nem reativada depois. Nada é apagado: ela continua na lista (em "Mostrar encerradas") com todo o histórico.</div>' +
        campoTexto('estMotivo', 'motivo', 'Motivo do encerramento', st.form.motivo, M.motivo, { area: true, linhas: 3, obrigatorio: true, ajuda: 'Fica registrado no histórico.' }) +
        '<div class="avp-actions-footer"><button type="submit" class="btn btn--danger" id="estSalvar"' + (st.salvando ? ' disabled' : '') + '>' + (st.salvando ? 'Encerrando…' : 'Confirmar encerramento') + '</button>' +
        '<button type="button" class="btn" id="estCancelar">Cancelar</button></div></form>';
      return h;
    }
    function render() {
      if (wrap.hidden) return;
      var ativo = document.activeElement, foco = ativo && ativo.id && wrap.contains(ativo) && /^(INPUT|TEXTAREA)$/.test(ativo.tagName) ? { id: ativo.id, ini: ativo.selectionStart, fim: ativo.selectionEnd } : null;
      var h;
      if (!disponivel()) h = '<p class="avp-error-msg" id="estIndisponivel">O cadastro de estruturas só está disponível no ambiente de testes nesta etapa.</p>';
      else if (st.vista === 'nova') h = podeManter() ? formNovaHtml() : listaHtml();
      else if (st.vista === 'detalhe') h = detalheHtml();
      else if (st.vista === 'editar') h = podeManter() ? formEditarHtml() : detalheHtml();
      else if (st.vista === 'encerrar') h = podeManter() ? formEncerrarHtml() : detalheHtml();
      else h = listaHtml();
      wrap.innerHTML = '<div class="est-tela" data-vista="' + st.vista + '">' + h + '</div>';
      bind();
      if (P()) P().atualizarDom && P().atualizarDom(wrap);
      if (foco) { var el = byId(foco.id); if (el) { el.focus({ preventScroll: true }); try { el.setSelectionRange(foco.ini, foco.fim); } catch (x) { /* rádio */ } } }
    }
    function bind() {
      function em(id, ev, fn) { var el = byId(id); if (el) el.addEventListener(ev, fn); }
      em('estVoltarOrigem', 'click', function () { if (confirmarDescarte()) sair(); });
      em('estVoltarLista', 'click', function () { if (confirmarDescarte()) irPara('lista'); });
      em('estVoltarFicha', 'click', function () { if (confirmarDescarte()) irPara('detalhe', st.id); });
      em('estCancelar', 'click', function () { if (!confirmarDescarte()) return; if (st.vista === 'nova') irPara('lista'); else irPara('detalhe', st.id); });
      em('estNova', 'click', function () { irPara('nova'); });
      em('estFlashOutra', 'click', function () { irPara('nova'); });
      em('estEditar', 'click', function () { irPara('editar', st.id); });
      em('estEncerrar', 'click', function () { irPara('encerrar', st.id); });
      em('estMostrarEncerradas', 'change', function (ev) { st.mostrarEncerradas = ev.target.checked; render(); });
      em('estHistorico', 'toggle', function (ev) { st.historicoAberto = ev.target.open; });
      Array.prototype.forEach.call(wrap.querySelectorAll('.est-item'), function (b) { b.addEventListener('click', function () { irPara('detalhe', b.getAttribute('data-estrutura')); }); });
      Array.prototype.forEach.call(wrap.querySelectorAll('[data-campo]'), function (el) {
        el.addEventListener('input', function () { st.form[el.getAttribute('data-campo')] = el.value; st.sujo = true; });
      });
      Array.prototype.forEach.call(wrap.querySelectorAll('input[name="estTipo"]'), function (r) {
        r.addEventListener('change', function () { if (r.checked) { st.form.tipo = r.value; st.sujo = true; } });
      });
      em('estForm', 'submit', function (ev) {
        ev.preventDefault();
        var f = st.form;
        if (st.vista === 'nova') salvar('criarEstrutura', { tipo: f.tipo, nome: f.nome, sigla: f.sigla, descricao: f.descricao });
        else if (st.vista === 'editar') salvar('alterarEstrutura', { id: st.id, alteracoes: { nome: f.nome, sigla: f.sigla, descricao: f.descricao }, justificativa: f.justificativa, revisaoEsperada: f.revisao });
        else if (st.vista === 'encerrar') salvar('encerrarEstrutura', { id: st.id, motivo: f.motivo, revisaoEsperada: f.revisao });
      });
    }

    /* ---------- abrir / fechar (chamado pela área Avaliação e Mapa) ---------- */
    function vizinhos(esconder) {
      ['adminAvaliacaoProduto', 'adminAvaliacaoSquad'].forEach(function (id) { var el = document.getElementById(id); if (el && esconder) el.hidden = true; });
      if (!esconder) { var p = document.getElementById('adminAvaliacaoProduto'); if (p) p.hidden = false; }
    }
    function abrir(o) {
      origem = o || null;
      vizinhos(true); wrap.hidden = false;
      ligar();
      var id = idDoEndereco();
      st.vista = id ? 'detalhe' : 'lista'; st.id = id || null; st.form = null; st.erros = []; st.flash = null; st.sujo = false;
      render(); sincronizar();
    }
    function fechar() { if (wrap.hidden) return; wrap.hidden = true; st.sujo = false; vizinhos(false); }
    function sair() { fechar(); if (origem && origem.voltar) origem.voltar(); }
    /* troca de pessoa: nada do estado anterior sobrevive */
    var pessoa = null;
    window.addEventListener('fa-auth-change', function () {
      var s = A() && A().getSession && A().getSession(), agora = s && s.email || null;
      if (pessoa && pessoa !== agora) { desligarTudo(); st = novo(); if (!wrap.hidden) { ligar(); render(); } }
      pessoa = agora;
    });
    ['fa-admin-ready', 'fa-avaliacao-ready'].forEach(function (ev) { window.addEventListener(ev, function () { if (!wrap.hidden) render(); }); });

    return { abrir: abrir, fechar: fechar, disponivel: disponivel, temAlteracaoNaoSalva: function () { return !wrap.hidden && !!st.sujo; } };
  }

  /* o contêiner está no index.html antes deste arquivo; disponivel() é false fora do ambiente de testes */
  var api = null;
  function garantir() { if (!api) api = montar(); return api; }
  window.faEstruturasAdmin = {
    disponivel: disponivel,
    abrir: function (o) { var a = garantir(); if (a) a.abrir(o); },
    fechar: function () { if (api) api.fechar(); },
    temAlteracaoNaoSalva: function () { return !!(api && api.temAlteracaoNaoSalva()); }
  };
})();
