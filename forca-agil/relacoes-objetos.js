/* ============================================================
   E4 — RELAÇÕES ENTRE OBJETOS: telas (window.faRelacoesObjetos). As regras de negócio são do núcleo
   (relacoes-objetos-nucleo.js) e as de gravação, do banco (database.rules.json, geradas da mesma matriz).

   Onde aparece (nada é editado em dois lugares):
     - REGISTRO DO OBJETO em Trabalhos (#arquitetura?tr=1&item=<id>), igual para item P1–P16 e para objeto da Porta 2:
       natureza individual (camadas conjuntas), relações agrupadas pela leitura a partir dele, "Relacionar com outro
       objeto" e "Encerrar" — o ÚNICO lugar de manutenção (montarHosts: [data-ro-secao]);
     - RESUMO "Relaciona-se com N objetos" nas fichas (P1–P16, Posicionamento) e no detalhe da estrutura (Mapa e
       cadastro): só leitura, com link para o registro ([data-ro-resumo]);
     - TAXONOMIA (Verificações do sistema, só administração geral): os conceitos oficiais das naturezas individuais —
       criados aqui, um a um, com o nome e a definição APROVADOS; nenhum conceito nasce sem definição. Isto é
       administração da Taxonomia e NÃO depende do marcador da E4 (C41): o cartão e a leitura dos conceitos funcionam
       com o marcador ausente, false ou true; só as relações entre objetos dependem dele.
   O Mapa da Floresta não muda: objetos não viram caixas e nenhuma linha entre objetos é desenhada.

   Liberação das RELAÇÕES: marcador relacoes-objetos-config/gravacaoHabilitada (ausente = relações desligadas, nada
   delas aparece; false = só consulta; true = manutenção; nenhum cliente o grava). Consultam os três perfis da Avaliação; mantêm admin geral e
   Avaliação + Configuração; os conceitos da Taxonomia, só a administração geral.
   ============================================================ */
(function () {
  'use strict';
  function N() { return window.faRelacoesObjetosNucleo; }
  function A() { return window.faAuth; }
  function db() { return window.firebase.database(); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var TS = { '.sv': 'timestamp' };
  var PRAZO = 20000;

  /* ---------- estado (dados ao vivo; undefined = lendo, null = indisponível) ---------- */
  var d = { marcador: undefined, registros: undefined, naturezas: undefined, produtos: undefined, objetos: undefined, conceitos: {}, vinculos: undefined, estruturas: undefined, pontas: undefined };
  var ligado = false, pessoa = null, desligadores = [];
  var ui = {}; /* por objeto: { modo: null|'natureza'|'relacionar'|'encerrar', form, erros, flash, salvando } */
  var tax = { aberto: null, form: {}, erros: [], flash: null, salvando: false };

  function sessao() { var a = A(); var s = a && a.getSession && a.getSession(); return (s && s.email) || null; }
  function usuario() { var u = window.firebase && window.firebase.auth && window.firebase.auth().currentUser; return u ? { id: u.uid, email: u.email } : null; }
  function perfilManter() { var a = A(); return !!(a && a.podeArquitetura && a.podeArquitetura()); }
  function podeManter() { return perfilManter() && d.marcador === true; }
  function adminGeral() { var a = A(), e = sessao(); return !!(a && e && a.isAdmin && a.isAdmin(e)); }
  function emTestes() { return !!(window.faAmbiente && window.faAmbiente.testes); }
  function ativo() { return d.marcador === true || d.marcador === false; }

  function ouvir(caminho, chave, tolerante) {
    var ref = db().ref(caminho);
    var cb = function (s) { d[chave] = s.val() || {}; avisar(); };
    var err = function () { d[chave] = tolerante ? {} : null; avisar(); };
    ref.on('value', cb, err);
    desligadores.push(function () { ref.off('value', cb); });
  }
  /* conceitos oficiais das naturezas individuais: lidos uma vez por sessão, por quem precisa deles (as relações, com o
     marcador; o cartão da Taxonomia, sempre) — nunca dependem do marcador */
  var conceitosLidos = false;
  function lerConceitos() {
    if (conceitosLidos) return;
    conceitosLidos = true;
    N().CODIGOS_INDIVIDUAIS.forEach(function (cod) {
      var base = 'taxonomia/arquitetural/conceitos/' + cod;
      var c = d.conceitos[cod] = { nome: undefined, ativo: undefined, naturezaDe: undefined, temDefinicao: undefined };
      ['nome', 'ativo', 'naturezaDe', 'definicao'].forEach(function (k) {
        var ref = db().ref(base + '/' + k);
        var cb = function (s) { var v = s.val(); if (k === 'definicao') c.temDefinicao = !!(v && v.texto); else c[k] = v; avisar(); };
        ref.on('value', cb, function () { if (k === 'definicao') c.temDefinicao = false; else c[k] = null; avisar(); });
        desligadores.push(function () { ref.off('value', cb); });
      });
    });
  }
  function ligar() {
    if (ligado || !sessao() || !window.firebase || !N()) return;
    ligado = true; pessoa = sessao();
    var ref = db().ref(N().MARCADOR);
    var cb = function (s) { var v = s.val(); var antes = d.marcador; d.marcador = v === true ? true : v === false ? false : null; if (d.marcador !== null && antes !== d.marcador && d.registros === undefined) ligarDados(); avisar(); };
    ref.on('value', cb, function () { d.marcador = null; avisar(); });
    desligadores.push(function () { ref.off('value', cb); });
  }
  var dadosLigados = false;
  function ligarDados() {
    if (dadosLigados) return;
    dadosLigados = true;
    ouvir(N().RAIZ + '/registros', 'registros');
    ouvir(N().NAT, 'naturezas');
    ouvir(N().PONTA, 'pontas'); /* versão vigente de cada item (o banco confere a base contra ela) */
    ouvir('avaliacoes-produto', 'produtos');
    ouvir('objetos-organizacionais', 'objetos', true);
    ouvir('estruturas-vinculos/registros', 'vinculos', true);
    ouvir('estruturas-concretas/registros', 'estruturas', true);
    lerConceitos();
  }
  function desligar() {
    desligadores.forEach(function (f) { try { f(); } catch (e) { /* já desligado */ } });
    desligadores = []; ligado = false; dadosLigados = false; conceitosLidos = false; pessoa = null;
    d = { marcador: undefined, registros: undefined, naturezas: undefined, produtos: undefined, objetos: undefined, conceitos: {}, vinculos: undefined, estruturas: undefined, pontas: undefined };
    ui = {}; tax = { aberto: null, form: {}, erros: [], flash: null, salvando: false };
  }
  function aoMudarSessao() { if (sessao() !== pessoa) { desligar(); } ligar(); avisar(); }
  ['fa-auth-ready', 'fa-auth-change', 'fa-avaliacao-ready', 'fa-admin-ready'].forEach(function (ev) { window.addEventListener(ev, aoMudarSessao); });

  /* redesenha o que está montado (sem tocar no resto da tela) */
  var avisoPendente = false;
  function avisar() {
    if (avisoPendente) return;
    avisoPendente = true;
    setTimeout(function () { avisoPendente = false; redesenharMontados(); }, 0);
  }
  var montados = []; /* { el, tipo: 'secao'|'resumo'|'tax', objetoId } */
  function redesenharMontados() {
    montados = montados.filter(function (m) { return m.el && m.el.isConnected; });
    montados.forEach(function (m) { desenhar(m); });
    montarPendentes();
  }
  /* pontos de encaixe que uma tela desenhou ANTES de este módulo chegar (rede lenta: o login, com a sessão guardada,
     termina antes do fim da lista de scripts, e a tela não se redesenha depois) — montados aqui, sem depender dela */
  function montarPendentes() {
    if (!N() || typeof document === 'undefined') return;
    var ja = montados.map(function (m) { return m.el; });
    var pend = function (sel, tipo, attr) {
      Array.prototype.forEach.call(document.querySelectorAll(sel), function (el) { if (ja.indexOf(el) === -1) montar(el, tipo, attr ? el.getAttribute(attr) : null); });
    };
    pend('[data-ro-secao]', 'secao', 'data-ro-secao'); pend('[data-ro-resumo]', 'resumo', 'data-ro-resumo'); pend('[data-ro-tax]', 'tax', null);
  }

  /* ---------- leitura dos objetos ---------- */
  function dadosProntos() { return d.registros !== undefined && d.naturezas !== undefined && d.pontas !== undefined && d.produtos !== undefined && d.objetos !== undefined && N().CODIGOS_INDIVIDUAIS.every(function (c) { return d.conceitos[c] && d.conceitos[c].ativo !== undefined && d.conceitos[c].naturezaDe !== undefined && d.conceitos[c].temDefinicao !== undefined; }); }
  function porta2(id) { var o = d.objetos && d.objetos[id]; return o && typeof o === 'object' && o.situacao ? o : null; }
  function gate(id) {
    var B = window.faBaseProdutoServico, P = window.faAvaliacaoPosicionamentoNucleo;
    if (!B || !P || !d.produtos) return { situacao: 'verificando', libera: false };
    return P.gateDoItem(id, d.produtos, B, B.contextoMotorAtual());
  }
  function natureza(id) {
    var o = porta2(id);
    if (o) return N().naturezaDoObjeto({ porta2: o });
    return N().naturezaDoObjeto({ gate: gate(id), registro: d.naturezas ? d.naturezas[id] : null, indice: d.pontas ? (d.pontas[id] || null) : null });
  }
  function nomeObjeto(id) {
    var o = porta2(id); if (o) return o.nome || id;
    var B = window.faBaseProdutoServico, b = B && d.produtos ? B.baseDoItem(id, d.produtos) : null, it = b && b.chave ? d.produtos[b.chave] : (d.produtos && d.produtos[id]);
    return (it && (it.nome || it.itemNome)) || id;
  }
  function conceitoInfo(cod) { var c = d.conceitos[cod]; return c ? { ativo: c.ativo, naturezaDe: c.naturezaDe, temDefinicao: c.temDefinicao } : null; }
  function rotuloNatureza(n) {
    var x = N().NATUREZAS[n]; if (!x) return n;
    if (x.individual) { var c = d.conceitos[n]; return (c && c.nome && N().conceitoValido(n, conceitoInfo(n))) ? c.nome : x.rotulo; }
    var C = window.faClassificacoes;
    /* natureza direta (inclui Produto/Serviço): a identidade é o conceito de mesmo código da classificação — um nome só */
    if (x.camada && C && C.nome) { var nm = C.nome(x.camada); if (nm) return nm; }
    return x.rotulo;
  }
  function ondeFicou(id) {
    var E = window.faEstruturasNucleo;
    if (!E || !d.vinculos || !d.estruturas) return null;
    var v = E.responsavelAtivo({ estruturas: d.estruturas, vinculos: d.vinculos }, id);
    if (!v) return 'sem estrutura responsável';
    var e = d.estruturas[v.estruturaId];
    return 'ficou em ' + (e ? e.nome : 'estrutura não encontrada');
  }
  function linkRegistro(id) { return '#arquitetura?tr=1&item=' + encodeURIComponent(id); }
  function atual(id) { return { origem: natureza(id) }; }
  function situacaoDe(r) { return N().situacaoRelacao(r, { origem: natureza(r.origem), destino: natureza(r.destino) }); }

  var MOTIVO_NAT = {
    VERIFICANDO: 'Verificando a Avaliação de Produto/Serviço…',
    SEM_AVALIACAO_VALIDA: 'Sem Avaliação de Produto/Serviço válida e com Motor atual: não pode ter relações ainda.',
    A_VALIDAR: 'A classificação está "a validar": não pode ter relações enquanto não houver decisão.',
    DECISAO_INCOERENTE: 'A decisão final ("não produto") não combina com a classificação Produto/Serviço principal: revise a avaliação antes de relacionar.',
    CAMADA_FORA_DA_E4: 'Esta classificação ainda não tem relações nesta etapa.',
    NATUREZA_NAO_REGISTRADA: 'Natureza individual ainda não registrada.',
    NATUREZA_A_CONFIRMAR: 'A natureza registrada é de outra classificação (a avaliação mudou): confirme a natureza.',
    OBJETO_ENCERRADO: 'Responsabilidade encerrada: não recebe novas relações.',
    VERSAO_VIGENTE_NAO_CONFIRMADA: 'A versão vigente deste item ainda não está registrada no banco (reconciliação pendente): não pode ter relações por enquanto.'
  };
  var MOTIVO_SIT = {
    REFERENCIA_INDISPONIVEL: 'não foi possível conferir agora',
    PONTA_ENCERRADA: 'um dos objetos foi encerrado ou excluído',
    NATUREZA_MUDOU_ORIGEM: 'a natureza de um dos objetos mudou', NATUREZA_MUDOU_DESTINO: 'a natureza de um dos objetos mudou',
    NATUREZA_INDISPONIVEL_ORIGEM: 'a natureza de um dos objetos não está confirmada', NATUREZA_INDISPONIVEL_DESTINO: 'a natureza de um dos objetos não está confirmada',
    PAR_NAO_ADMITIDO: 'o par deixou de ser admitido'
  };
  var ERRO = {
    TIPO_INVALIDO: 'Escolha como os objetos se relacionam.', PONTA_INVALIDA: 'Escolha o outro objeto.', AUTORRELACAO: 'Um objeto não se relaciona com ele mesmo.',
    NATUREZA_ORIGEM_INDISPONIVEL: 'A natureza de um dos objetos não está confirmada.', NATUREZA_DESTINO_INDISPONIVEL: 'A natureza de um dos objetos não está confirmada.',
    PAR_NAO_ADMITIDO: 'Essa relação não é admitida entre essas naturezas.', OBSERVACAO_LONGA: 'A observação tem no máximo 500 caracteres.',
    RELACAO_DUPLICADA: 'Essa relação já está registrada.', RELACAO_RECIPROCA: 'A relação inversa, do mesmo tipo, já está registrada.',
    CICLO_NA_COMPOSICAO: 'Isso criaria um ciclo de composição (um objeto faria parte dele mesmo).',
    MOTIVO_OBRIGATORIO: 'Informe o motivo do encerramento.', MOTIVO_LONGO: 'O motivo tem no máximo 500 caracteres.',
    RELACAO_JA_ENCERRADA: 'Essa relação já foi encerrada.', CONCEITO_SEM_DEFINICAO_OFICIAL: 'Essa natureza ainda não tem definição oficial na Taxonomia.',
    NATUREZA_FORA_DA_CAMADA: 'Essa natureza não pertence à classificação da avaliação.', NADA_MUDOU: 'Nada mudou.',
    NOME_OBRIGATORIO: 'Informe o nome.', DEFINICAO_OBRIGATORIA: 'Informe a definição aprovada.', CONFIRMACAO: 'Confirme que a definição foi aprovada.',
    RECUSADA: 'O banco recusou a gravação. Confira se a situação mudou e tente de novo.', SEM_RESPOSTA: 'Sem resposta do banco. Confira a conexão e tente de novo.',
    CONTEXTO_INCOMPLETO: 'Sessão não identificada. Entre de novo.'
  };
  function msgs(erros) { return (erros || []).map(function (e) { return ERRO[e.codigo] || e.codigo; }).filter(function (x, i, a) { return a.indexOf(x) === i; }); }

  /* ---------- gravação (com prazo; o banco é a última palavra) ---------- */
  function gravar(caminhos, ok, falha) {
    var feito = false, t = setTimeout(function () { if (feito) return; feito = true; falha('SEM_RESPOSTA'); }, PRAZO);
    db().ref().update(caminhos, function (e) { if (feito) return; feito = true; clearTimeout(t); if (e) falha('RECUSADA'); else ok(); });
  }
  function chave(p) { return db().ref().child(p).push().key; }

  /* ---------- seção no registro do objeto ---------- */
  function u(id) { return ui[id] || (ui[id] = { modo: null, form: {}, erros: [], flash: null, salvando: false }); }
  function secaoHtml(id) {
    if (!ativo()) return '';
    var h = '<section class="ro-secao" id="roSecao" data-objeto="' + esc(id) + '" aria-labelledby="roTitulo"><h5 class="mf-subtitulo ro-titulo" id="roTitulo">Relações com outros objetos</h5>';
    h += '<p class="ro-nota" id="roNota">Relação entre objetos não define classificação, posicionamento nem estrutura responsável.</p>';
    if (emTestes()) h += '<p class="avp-decisao-aviso ro-ambiente" role="note"><strong>Ambiente de testes.</strong> As relações ficam só no Firebase Emulator.' + (d.marcador === false ? ' <strong>Gravação suspensa:</strong> só consulta.' : '') + '</p>';
    else if (d.marcador === false) h += '<p class="avp-decisao-aviso ro-ambiente" role="note"><strong>Gravação suspensa.</strong> As relações estão disponíveis só para consulta.</p>';
    if (!dadosProntos()) return h + '<p class="loading-msg" role="status">Carregando…</p></section>';
    if (d.registros === null || d.naturezas === null || d.pontas === null || d.produtos === null) return h + '<p class="avp-error-msg" role="alert">Não foi possível ler as relações agora. Verifique a conexão e tente de novo.</p></section>';
    var st = u(id), nat = natureza(id), manter = podeManter();
    if (st.flash) h += '<p class="avp-flash-success ro-flash" id="roFlash" tabindex="-1">' + esc(st.flash) + '</p>';
    h += naturezaHtml(id, nat, st, manter);
    if (porta2(id)) h += '<p class="ro-nota" id="roNotaPorta2">"Atua sobre" não é alocação nem vínculo: cada objeto continua com a própria estrutura responsável.</p>';
    h += listaHtml(id, st, manter);
    if (manter && nat.natureza && st.modo !== 'relacionar' && st.modo !== 'natureza' && N().leiturasPossiveis(nat.natureza).length) h += '<div class="ro-acoes"><button type="button" class="btn btn--sm" id="roRelacionar">Relacionar com outro objeto</button></div>';
    if (st.modo === 'relacionar') h += formRelacionarHtml(id, nat, st);
    return h + '</section>';
  }
  function naturezaHtml(id, nat, st, manter) {
    if (porta2(id)) return '<p class="ro-natureza" id="roNatureza"><span class="ro-rot">Natureza:</span> Responsabilidade organizacional (Porta 2)</p>';
    var h = '';
    if (nat.natureza) {
      h = '<p class="ro-natureza" id="roNatureza" data-natureza="' + esc(nat.natureza) + '"><span class="ro-rot">Natureza:</span> ' + esc(rotuloNatureza(nat.natureza));
      if (nat.registrada && manter && st.modo !== 'natureza') h += ' <button type="button" class="avp-voltar-link ro-lnk" id="roCorrigirNatureza">Corrigir a natureza</button>';
      h += '</p>';
      if (st.modo !== 'natureza') return h;
    } else {
      h = '<p class="ro-natureza ro-natureza--pendente" id="roNatureza" data-motivo="' + esc(nat.motivo) + '">' + esc(MOTIVO_NAT[nat.motivo] || nat.motivo) + '</p>';
    }
    var possiveis = nat.possiveis || (nat.camada && N().INDIVIDUAIS_DA_CAMADA[nat.camada]) || (nat.registrada && N().NATUREZAS[nat.registrada] && N().INDIVIDUAIS_DA_CAMADA[gateCamada(id)]) || null;
    if (!possiveis && nat.natureza && nat.registrada) possiveis = N().INDIVIDUAIS_DA_CAMADA[N().NATUREZAS[nat.registrada].camada];
    if (!possiveis || (nat.motivo !== 'NATUREZA_NAO_REGISTRADA' && nat.motivo !== 'NATUREZA_A_CONFIRMAR' && st.modo !== 'natureza')) return h;
    var cam = nat.camada || (nat.registrada && N().NATUREZAS[nat.registrada].camada);
    h += '<div class="ro-form" id="roFormNatureza"><p class="ro-ajuda">Qual é a natureza individual deste objeto? Registrada uma vez, por quem mantém; nunca deduzida e nunca gravada na avaliação.</p>';
    var ori = window.faNaturezasArquiteturais && window.faNaturezasArquiteturais.orientacao(cam); /* texto único, do modelo central */
    if (ori) h += '<p class="ro-ajuda ro-orientacao" id="roAjudaOpcao" role="note">' + esc(ori.texto) + '</p>';
    if (cam === 'modalidade-subproduto') h += '<p class="ro-ajuda" id="roAjudaModalidade">Modalidade e Subproduto são naturezas distintas, com definição ainda pendente (E5): se o objeto for um deles, ele fica sem natureza individual por enquanto.</p>';
    if (!manter) return h + '<p class="ro-ajuda">Quem registra: Avaliação + Configuração ou administração geral.</p></div>';
    h += '<div class="ro-escolhas">' + possiveis.map(function (n) {
      var ok = N().conceitoValido(n, conceitoInfo(n));
      return ok ? '<button type="button" class="btn btn--sm ro-nat-btn" data-natureza="' + esc(n) + '"' + (st.salvando ? ' disabled' : '') + '>' + esc(rotuloNatureza(n)) + '</button>'
        : '<span class="ro-nat-indisp" data-natureza="' + esc(n) + '">' + esc(N().NATUREZAS[n].rotulo) + ' — ainda sem definição oficial na Taxonomia</span>';
    }).join('') + '</div>';
    if (st.erros.length && st.modo === 'natureza') h += erroHtml(st.erros);
    if (st.modo === 'natureza') h += '<button type="button" class="btn btn--sm" id="roCancelarNatureza">Cancelar</button>';
    return h + '</div>';
  }
  function gateCamada(id) { var g = gate(id); return g && g.avaliacao && g.avaliacao.camadaSugerida && g.avaliacao.camadaSugerida.id; }
  function erroHtml(erros) { return '<div class="avp-error-msg ro-erros" id="roErros" role="alert" tabindex="-1"><strong>Não foi salvo.</strong><ul>' + msgs(erros).map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul></div>'; }
  function listaHtml(id, st, manter) {
    var todas = N().relacoesDoObjeto(d.registros, id);
    var ativas = todas.filter(function (x) { return x.relacao.situacao === 'ativa'; }), encerradas = todas.filter(function (x) { return x.relacao.situacao !== 'ativa'; });
    if (!todas.length) return '<p class="ro-vazio" id="roVazio">Nenhuma relação registrada.</p>';
    var grupos = [];
    ativas.forEach(function (x) { var g = grupos.filter(function (y) { return y.leitura === x.leitura; })[0]; if (!g) grupos.push(g = { leitura: x.leitura, itens: [] }); g.itens.push(x); });
    var h = '<div class="ro-lista" id="roLista">';
    grupos.forEach(function (g) {
      h += '<p class="ro-grupo">' + esc(primeiraMaiuscula(g.leitura)) + '</p><ul class="ro-itens">' + g.itens.map(function (x) { return itemHtml(x, st, manter); }).join('') + '</ul>';
    });
    if (encerradas.length) h += '<details class="ro-encerradas" id="roEncerradas"><summary>Encerradas (' + encerradas.length + ')</summary><ul class="ro-itens">' + encerradas.map(function (x) {
      var r = x.relacao;
      return '<li class="ro-item ro-item--encerrada" data-relacao="' + esc(r.id) + '"><span class="ro-leitura">' + esc(x.leitura) + '</span> <a class="ro-link" href="' + linkRegistro(x.outro) + '">' + esc(nomeObjeto(x.outro)) + '</a>' +
        '<span class="ro-det">Encerrada: ' + esc((r.encerramento && r.encerramento.motivo) || '') + '</span></li>';
    }).join('') + '</ul></details>';
    return h + (activeVazio(ativas) ? '<p class="ro-vazio" id="roVazio">Nenhuma relação ativa.</p>' : '') + '</div>';
  }
  function activeVazio(a) { return !a.length; }
  function primeiraMaiuscula(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function itemHtml(x, st, manter) {
    var r = x.relacao, s = situacaoDe(r), n = natureza(x.outro), onde = ondeFicou(x.outro);
    var h = '<li class="ro-item" data-relacao="' + esc(r.id) + '" data-situacao="' + esc(s.situacao) + '"><a class="ro-link" href="' + linkRegistro(x.outro) + '">' + esc(nomeObjeto(x.outro)) + '</a>' +
      '<span class="ro-det">' + esc(n.natureza ? rotuloNatureza(n.natureza) : rotuloNatureza(x.sentido === 'saida' ? r.naturezaDestino : r.naturezaOrigem)) + (onde ? ' · ' + esc(onde) : '') + '</span>';
    if (s.situacao === 'a-revisar') h += ' <span class="est-situacao ro-sit ro-sit--revisar" data-situacao="a-revisar">A revisar</span><span class="ro-det">' + esc(s.motivos.map(function (m) { return MOTIVO_SIT[m] || m; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join('; ')) + '</span>';
    else if (s.situacao === 'nao-conferida') h += ' <span class="est-situacao ro-sit ro-sit--nao-conferida" data-situacao="nao-conferida">Não conferida</span>';
    if (r.observacao) h += '<span class="ro-obs">' + esc(r.observacao) + '</span>';
    if (manter && st.modo === 'encerrar' && st.form.relacaoId === r.id) {
      h += '<div class="ro-form ro-form-encerrar" id="roFormEncerrar"><label for="roMotivo">Motivo do encerramento <span class="est-obrig">(obrigatório)</span></label><textarea id="roMotivo" maxlength="500" rows="2">' + esc(st.form.motivo || '') + '</textarea>' +
        (st.erros.length ? erroHtml(st.erros) : '') +
        '<div class="ro-acoes"><button type="button" class="btn btn--primary btn--sm" id="roConfirmarEncerrar"' + (st.salvando ? ' disabled' : '') + '>' + (st.salvando ? 'Salvando…' : 'Encerrar a relação') + '</button><button type="button" class="btn btn--sm" id="roCancelarEncerrar">Cancelar</button></div></div>';
    } else if (manter && !st.modo) h += '<button type="button" class="avp-voltar-link ro-lnk ro-encerrar" data-relacao="' + esc(r.id) + '">Encerrar</button>';
    return h + '</li>';
  }
  /* candidatos da outra ponta: objetos com a natureza aceita, sem o próprio e sem os já relacionados do mesmo jeito */
  function candidatos(id, nat, leitura) {
    var aceitas = N().naturezasDaOutraPonta(nat, leitura.tipo, leitura.sentido), ids = {};
    Object.keys(d.produtos || {}).forEach(function (k) { var it = d.produtos[k]; ids[(it && it.itemId) || k] = true; });
    Object.keys(d.objetos || {}).forEach(function (k) { if (porta2(k)) ids[k] = true; });
    return Object.keys(ids).filter(function (o) { return o !== id; }).map(function (o) { return { id: o, n: natureza(o) }; })
      .filter(function (x) { return x.n.natureza && aceitas.indexOf(x.n.natureza) !== -1; })
      .map(function (x) { return { id: x.id, nome: nomeObjeto(x.id), natureza: x.n.natureza }; })
      .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
  }
  function formRelacionarHtml(id, nat, st) {
    var leituras = N().leiturasPossiveis(nat.natureza), f = st.form;
    var h = '<div class="ro-form" id="roFormRelacionar"><p class="ro-frase"><span class="ro-este">Este objeto</span> ' +
      '<label class="ro-sr" for="roLeitura">Como se relaciona</label><select id="roLeitura"><option value="">escolha…</option>' + leituras.map(function (l, i) {
        return '<option value="' + i + '"' + (String(f.leitura) === String(i) ? ' selected' : '') + '>' + esc(l.leitura) + '</option>';
      }).join('') + '</select></p>';
    if (f.leitura !== undefined && f.leitura !== '' && leituras[f.leitura]) {
      var cs = candidatos(id, nat.natureza, leituras[f.leitura]), q = String(f.busca || '').trim().toLowerCase();
      var vis = cs.filter(function (c) { return !q || c.nome.toLowerCase().indexOf(q) !== -1; }).slice(0, 20);
      h += '<div class="avp-field"><label for="roBusca">Outro objeto</label><input type="search" id="roBusca" value="' + esc(f.busca || '') + '" placeholder="Buscar pelo nome" autocomplete="off"></div>';
      if (!cs.length) h += '<p class="ro-vazio" id="roSemCandidatos">Nenhum objeto com natureza compatível para essa relação.</p>';
      else h += '<ul class="ro-candidatos" id="roCandidatos">' + vis.map(function (c) {
        return '<li><label class="ro-cand"><input type="radio" name="roOutro" value="' + esc(c.id) + '"' + (f.outro === c.id ? ' checked' : '') + '> <span class="ro-cand-nome">' + esc(c.nome) + '</span> <span class="ro-det">' + esc(rotuloNatureza(c.natureza)) + (ondeFicou(c.id) ? ' · ' + esc(ondeFicou(c.id)) : '') + '</span></label></li>';
      }).join('') + (cs.length > vis.length ? '<li class="ro-det">Mais ' + (cs.length - vis.length) + ': refine a busca.</li>' : '') + '</ul>';
      h += '<div class="avp-field"><label for="roObs">Observação <span class="est-opc">(opcional)</span></label><textarea id="roObs" maxlength="500" rows="2">' + esc(f.observacao || '') + '</textarea></div>';
    }
    if (st.erros.length) h += erroHtml(st.erros);
    return h + '<div class="ro-acoes"><button type="button" class="btn btn--primary btn--sm" id="roSalvarRelacao"' + (st.salvando ? ' disabled' : '') + '>' + (st.salvando ? 'Salvando…' : 'Salvar') + '</button><button type="button" class="btn btn--sm" id="roCancelarRelacao">Cancelar</button></div></div>';
  }
  function ligarSecao(el, id) {
    var st = u(id), q = function (s) { return el.querySelector(s); };
    var re = function () { desenharMontadosDoObjeto(id); };
    var b;
    if ((b = q('#roRelacionar'))) b.addEventListener('click', function () { st.modo = 'relacionar'; st.form = {}; st.erros = []; st.flash = null; re(); });
    if ((b = q('#roCancelarRelacao'))) b.addEventListener('click', function () { st.modo = null; st.form = {}; st.erros = []; re(); });
    var sl = q('#roLeitura'); if (sl) sl.addEventListener('change', function () { st.form.leitura = sl.value; st.form.outro = null; re(); var s = el.querySelector('#roLeitura'); if (s) s.focus({ preventScroll: true }); });
    var bu = q('#roBusca'); if (bu) bu.addEventListener('input', function () { var pos = bu.selectionStart; st.form.busca = bu.value; re(); var s = el.querySelector('#roBusca'); if (s) { s.focus({ preventScroll: true }); try { s.setSelectionRange(pos, pos); } catch (e) { /* sem seleção */ } } });
    Array.prototype.forEach.call(el.querySelectorAll('input[name="roOutro"]'), function (r) { r.addEventListener('change', function () { if (r.checked) st.form.outro = r.value; }); });
    var ob = q('#roObs'); if (ob) ob.addEventListener('input', function () { st.form.observacao = ob.value; });
    if ((b = q('#roSalvarRelacao'))) b.addEventListener('click', function () { salvarRelacao(id); });
    Array.prototype.forEach.call(el.querySelectorAll('.ro-encerrar'), function (x) { x.addEventListener('click', function () { st.modo = 'encerrar'; st.form = { relacaoId: x.getAttribute('data-relacao') }; st.erros = []; st.flash = null; re(); var m = el.querySelector('#roMotivo'); if (m) m.focus(); }); });
    var mo = q('#roMotivo'); if (mo) mo.addEventListener('input', function () { st.form.motivo = mo.value; });
    if ((b = q('#roCancelarEncerrar'))) b.addEventListener('click', function () { st.modo = null; st.form = {}; st.erros = []; re(); });
    if ((b = q('#roConfirmarEncerrar'))) b.addEventListener('click', function () { salvarEncerramento(id); });
    if ((b = q('#roCorrigirNatureza'))) b.addEventListener('click', function () { st.modo = 'natureza'; st.erros = []; st.flash = null; re(); });
    if ((b = q('#roCancelarNatureza'))) b.addEventListener('click', function () { st.modo = null; st.erros = []; re(); });
    Array.prototype.forEach.call(el.querySelectorAll('.ro-nat-btn'), function (x) { x.addEventListener('click', function () { salvarNatureza(id, x.getAttribute('data-natureza')); }); });
    /* ida e volta entre registros: a origem fica guardada (o "Voltar" do outro registro volta para este) */
    Array.prototype.forEach.call(el.querySelectorAll('a.ro-link'), function (a) {
      a.addEventListener('click', function (ev) {
        if (ev.button || ev.ctrlKey || ev.metaKey || ev.shiftKey || !window.faNav) return;
        ev.preventDefault(); window.faNav.ir(a.getAttribute('href'));
      });
    });
  }
  function salvarRelacao(id) {
    var st = u(id), f = st.form, nat = natureza(id), us = usuario();
    if (st.salvando) return;
    var leituras = nat.natureza ? N().leiturasPossiveis(nat.natureza) : [], l = leituras[f.leitura];
    if (!l) { st.erros = [{ codigo: 'TIPO_INVALIDO' }]; desenharMontadosDoObjeto(id); return; }
    if (!f.outro) { st.erros = [{ codigo: 'PONTA_INVALIDA' }]; desenharMontadosDoObjeto(id); return; }
    var origem = l.sentido === 'saida' ? id : f.outro, destino = l.sentido === 'saida' ? f.outro : id;
    st.salvando = true; st.erros = []; desenharMontadosDoObjeto(id);
    db().ref(N().RAIZ + '/versao-compoe').once('value').then(function (s) {
      var r = N().criarRelacao({ registros: d.registros }, { origem: origem, tipo: l.tipo, destino: destino, observacao: f.observacao },
        { origem: natureza(origem), destino: natureza(destino) }, { relacaoId: chave(N().RAIZ + '/registros'), operacaoId: chave(N().RAIZ + '/operacoes'), usuario: us, agora: TS, versaoCompoe: s.val() || 0 });
      if (!r.ok) { st.salvando = false; st.erros = r.erros; desenharMontadosDoObjeto(id); return; }
      gravar(r.caminhos, function () { st.salvando = false; st.modo = null; st.form = {}; st.flash = 'Relação registrada.'; desenharMontadosDoObjeto(id); },
        function (c) { st.salvando = false; st.erros = [{ codigo: c }]; desenharMontadosDoObjeto(id); });
    }, function () { st.salvando = false; st.erros = [{ codigo: 'SEM_RESPOSTA' }]; desenharMontadosDoObjeto(id); });
  }
  function salvarEncerramento(id) {
    var st = u(id), us = usuario();
    if (st.salvando) return;
    var r = N().encerrarRelacao({ registros: d.registros }, st.form.relacaoId, st.form.motivo, { operacaoId: chave(N().RAIZ + '/operacoes'), usuario: us, agora: TS });
    if (!r.ok) { st.erros = r.erros; desenharMontadosDoObjeto(id); return; }
    st.salvando = true; st.erros = []; desenharMontadosDoObjeto(id);
    gravar(r.caminhos, function () { st.salvando = false; st.modo = null; st.form = {}; st.flash = 'Relação encerrada. Ela continua registrada.'; desenharMontadosDoObjeto(id); },
      function (c) { st.salvando = false; st.erros = [{ codigo: c }]; desenharMontadosDoObjeto(id); });
  }
  function salvarNatureza(id, nat) {
    var st = u(id), us = usuario();
    if (st.salvando) return;
    var r = N().registrarNatureza(id, nat, gate(id), d.naturezas ? d.naturezas[id] : null, conceitoInfo(nat), { auditoriaId: chave(N().NAT_AUD + '/' + id), usuario: us, agora: TS });
    if (!r.ok) { st.modo = 'natureza'; st.erros = r.erros; desenharMontadosDoObjeto(id); return; }
    st.salvando = true; st.erros = []; desenharMontadosDoObjeto(id);
    gravar(r.caminhos, function () { st.salvando = false; st.modo = null; st.flash = 'Natureza registrada: ' + rotuloNatureza(nat) + '.'; desenharMontadosDoObjeto(id); },
      function (c) { st.salvando = false; st.modo = 'natureza'; st.erros = [{ codigo: c }]; desenharMontadosDoObjeto(id); });
  }

  /* ---------- resumo nas outras telas (só leitura) ---------- */
  function resumoHtml(id) {
    if (!ativo() || !dadosProntos() || !d.registros) return '';
    var n = N().relacoesDoObjeto(d.registros, id).filter(function (x) { return x.relacao.situacao === 'ativa'; }).length;
    if (!n) return '';
    return '<span class="ro-resumo" data-ro-total="' + n + '">Relaciona-se com ' + n + (n === 1 ? ' objeto' : ' objetos') + ' — <a class="ro-resumo-link" href="' + linkRegistro(id) + '">ver no registro</a></span>';
  }

  /* ---------- Taxonomia: conceitos oficiais das naturezas individuais (só administração geral) ---------- */
  function taxHtml() {
    if (!adminGeral()) return ''; /* administração da Taxonomia: independe do marcador da E4 */
    var h = '<section class="tax-integracao ro-tax" id="roTaxonomia" aria-labelledby="roTaxTitulo"><h4 class="tax-integracao-titulo" id="roTaxTitulo">Naturezas individuais — conceitos oficiais</h4>' +
      '<p class="tax-ajuda">Só Produto/Serviço é natureza conjunta. Cada natureza individual abaixo ganha aqui o seu conceito oficial, uma vez, com o nome e a definição <strong>aprovados</strong>. Nada é criado sozinho.</p>';
    if (tax.flash) h += '<p class="tax-flash" role="status" id="roTaxFlash">' + esc(tax.flash) + '</p>';
    if (!N().CODIGOS_INDIVIDUAIS.every(function (c) { return d.conceitos[c] && d.conceitos[c].ativo !== undefined; })) return h + '<p class="loading-msg" role="status">Conferindo os conceitos…</p></section>';
    h += '<ul class="ro-tax-lista" id="roTaxLista">' + N().CODIGOS_INDIVIDUAIS.map(function (cod) {
      var c = d.conceitos[cod] || {}, x = N().NATUREZAS[cod], sit;
      if (c.ativo === null || c.ativo === undefined) sit = 'sem conceito oficial';
      else if (c.naturezaDe !== x.camada) sit = 'conceito existe sem ligação à classificação ' + x.camada + ' — revisar na Taxonomia';
      else if (!c.temDefinicao) sit = 'sem definição publicada';
      else if (c.ativo !== true) sit = 'conceito inativo';
      else sit = 'pronto para uso';
      var pronto = sit === 'pronto para uso', sem = c.ativo === null || c.ativo === undefined;
      var li = '<li class="ro-tax-item" data-codigo="' + esc(cod) + '" data-pronto="' + (pronto ? '1' : '0') + '"><span class="ro-tax-nome">' + esc(pronto && c.nome ? c.nome : x.rotulo) + '</span> <code>' + esc(cod) + '</code> <span class="ro-det">em ' + esc(x.camada) + ' · ' + esc(sit) + '</span>';
      if (sem && tax.aberto !== cod) li += ' <button type="button" class="btn btn--sm ro-tax-criar" data-codigo="' + esc(cod) + '">Criar conceito</button>';
      if (tax.aberto === cod) {
        var f = tax.form;
        li += '<div class="ro-form" id="roTaxForm"><div class="avp-field"><label for="roTaxNome">Nome <span class="est-obrig">(obrigatório)</span></label><input type="text" id="roTaxNome" maxlength="200" value="' + esc(f.nome || '') + '"></div>' +
          '<div class="avp-field"><label for="roTaxDef">Definição aprovada <span class="est-obrig">(obrigatório)</span></label><textarea id="roTaxDef" rows="4" maxlength="8000">' + esc(f.definicao || '') + '</textarea></div>' +
          '<label class="ro-confirma"><input type="checkbox" id="roTaxAprovada"' + (f.aprovada ? ' checked' : '') + '> A definição foi aprovada para uso oficial.</label>' +
          (tax.erros.length ? '<div class="tax-aviso-erro" role="alert" id="roTaxErros"><strong>Não foi salvo.</strong> ' + esc(msgs(tax.erros).join(' ')) + '</div>' : '') +
          '<div class="tax-acoes"><button type="button" class="btn btn--primary btn--sm" id="roTaxSalvar"' + (tax.salvando ? ' disabled' : '') + '>' + (tax.salvando ? 'Salvando…' : 'Criar o conceito') + '</button><button type="button" class="btn btn--sm" id="roTaxCancelar">Cancelar</button></div></div>';
      }
      return li + '</li>';
    }).join('') + '</ul>';
    return h + '</section>';
  }
  function ligarTax(el) {
    var q = function (s) { return el.querySelector(s); }, b;
    Array.prototype.forEach.call(el.querySelectorAll('.ro-tax-criar'), function (x) { x.addEventListener('click', function () { tax.aberto = x.getAttribute('data-codigo'); tax.form = {}; tax.erros = []; tax.flash = null; redesenharMontados(); var n = document.getElementById('roTaxNome'); if (n) n.focus(); }); });
    var tn = q('#roTaxNome'); if (tn) tn.addEventListener('input', function () { tax.form.nome = tn.value; });
    var td = q('#roTaxDef'); if (td) td.addEventListener('input', function () { tax.form.definicao = td.value; });
    var ta = q('#roTaxAprovada'); if (ta) ta.addEventListener('change', function () { tax.form.aprovada = ta.checked; });
    if ((b = q('#roTaxCancelar'))) b.addEventListener('click', function () { tax.aberto = null; tax.form = {}; tax.erros = []; redesenharMontados(); });
    if ((b = q('#roTaxSalvar'))) b.addEventListener('click', salvarConceito);
  }
  function salvarConceito() {
    if (tax.salvando || !tax.aberto) return;
    var us = usuario(), f = tax.form, cod = tax.aberto;
    if (!f.aprovada) { tax.erros = [{ codigo: 'CONFIRMACAO' }]; redesenharMontados(); return; }
    var r = N().criarConceitoNatureza(cod, f.nome, f.definicao, { email: us && us.email, agoraIso: new Date().toISOString(), auditoriaKey: chave('taxonomia/arquitetural/auditoria/' + cod), ordem: 100 + N().CODIGOS_INDIVIDUAIS.indexOf(cod) });
    if (!r.ok) { tax.erros = r.erros; redesenharMontados(); return; }
    tax.salvando = true; tax.erros = []; redesenharMontados();
    gravar(r.caminhos, function () { tax.salvando = false; tax.aberto = null; tax.form = {}; tax.flash = 'Conceito criado com a definição aprovada.'; redesenharMontados(); },
      function (c) { tax.salvando = false; tax.erros = [{ codigo: c }]; redesenharMontados(); });
  }

  /* ---------- montagem nos pontos de encaixe ---------- */
  function desenhar(m) {
    if (m.tipo === 'secao') { m.el.innerHTML = secaoHtml(m.objetoId); ligarSecao(m.el, m.objetoId); }
    else if (m.tipo === 'resumo') {
      m.el.innerHTML = resumoHtml(m.objetoId);
      var a = m.el.querySelector('a.ro-resumo-link');
      if (a) a.addEventListener('click', function (ev) { if (ev.button || ev.ctrlKey || ev.metaKey || ev.shiftKey || !window.faNav) return; ev.preventDefault(); window.faNav.ir(a.getAttribute('href')); });
    } else if (m.tipo === 'tax') { m.el.innerHTML = taxHtml(); ligarTax(m.el); }
  }
  function desenharMontadosDoObjeto(id) { montados.filter(function (m) { return m.el.isConnected && m.objetoId === id; }).forEach(desenhar); }
  function montar(el, tipo, objetoId) {
    if (!el) return;
    ligar();
    if (ativo() && d.registros === undefined) ligarDados();
    if (tipo === 'tax' && sessao() && N()) lerConceitos(); /* o cartão da Taxonomia lê os conceitos mesmo sem o marcador */
    montados = montados.filter(function (m) { return m.el !== el && m.el.isConnected; });
    var m = { el: el, tipo: tipo, objetoId: objetoId || null };
    montados.push(m); desenhar(m);
  }
  /* raiz: monta toda seção [data-ro-secao] e todo resumo [data-ro-resumo] dentro dela */
  function montarHosts(raiz) {
    if (!raiz || !N()) return;
    Array.prototype.forEach.call(raiz.querySelectorAll('[data-ro-secao]'), function (el) { montar(el, 'secao', el.getAttribute('data-ro-secao')); });
    Array.prototype.forEach.call(raiz.querySelectorAll('[data-ro-resumo]'), function (el) { montar(el, 'resumo', el.getAttribute('data-ro-resumo')); });
  }
  function montarTaxonomia(el) { if (el) montar(el, 'tax', null); }

  window.faRelacoesObjetos = Object.freeze({
    montarHosts: montarHosts, montarTaxonomia: montarTaxonomia,
    /* para testes e diagnóstico: o que a tela calcula, sem gravar nada */
    naturezaDe: function (id) { return natureza(id); }, disponivel: function () { return ativo(); }
  });
  /* chegou depois do login? liga já (os eventos de sessão podem ter passado) e monta o que as telas já desenharam */
  aoMudarSessao();
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montarPendentes);
    else montarPendentes();
  }
})();
