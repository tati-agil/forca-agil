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
   Etapa 5 — subagrupadores das Linhas de Negócios (agrupamento de APRESENTAÇÃO do Mapa): aba própria
   (#admin?arq=estruturas&sg=lista e &sg=<id>) para criar, renomear, ordenar e encerrar; na ficha de uma Linha de
   Negócios, associar, trocar ou tirar do subagrupador, com o histórico junto ao da estrutura.
   M3 do Mapa — montarResponsavel(el, { itemId, posicionamento }): o bloco "Estrutura responsável" da ficha do Posicionamento
   (vincular, substituir e encerrar, com motivo; situação calculada pelo núcleo).
   M6/M7 — o Squad é estrutura cadastrável (conceito da camada "Organização do trabalho" que a Taxonomia admite compor
   uma Linha) e a ficha tem "Relações com outras estruturas": só as combinações que a Taxonomia admite; "compõe" só de
   Squad para Linha (C2) e no máximo uma Linha ativa por Squad (C3, trocar = substituir com motivo).
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
  function nomeTipo(c) {
    var t = taxRel && taxRel.conceitos && taxRel.conceitos[c];
    if (t && t.nome) return t.nome;
    return P() ? P().nome(c) : c;
  }
  function ehTrabalho(tipo) { return !!(taxRel && taxRel.conceitosTrabalho && taxRel.conceitosTrabalho.indexOf(tipo) !== -1); }
  function LINHA() { return MOT() ? MOT().CODIGOS_FIRMES.filter(function (c) { return MOT().liberaSquadParaCodigoFirme(c) === true; }) : []; }
  /* M6/M7: relações conceituais e Squad (adaptador; os três perfis da Avaliação leem): undefined = lendo; null = falhou */
  var taxRel, lendoTaxRel = false, aoLerTaxRel = [], geracaoTaxRel = 0;
  function lerTaxRel(cb) {
    if (taxRel !== undefined) { cb(); return; }
    aoLerTaxRel.push(cb);
    if (lendoTaxRel || !disponivel()) return;
    lendoTaxRel = true;
    var g = geracaoTaxRel;
    FB().lerRelacoesConceituais(window.firebase.database(), LINHA()).then(function (t) {
      if (g !== geracaoTaxRel) return;
      taxRel = t; lendoTaxRel = false; var fs = aoLerTaxRel; aoLerTaxRel = []; fs.forEach(function (fn) { fn(); });
    });
  }
  var ROTULO_RELACAO = { compoe: 'compõe', 'aloca-em': 'aloca em', atende: 'atende', 'desenvolve-disciplina': 'desenvolve a disciplina', 'pertence-a-disciplina': 'pertence à disciplina' };
  function disponivel() { return !!(window.faAmbiente && window.faAmbiente.testes && N() && U() && FB() && MOT() && window.firebase); }
  function podeManter() { var a = A(); return !!(a && ((a.isAdmin && a.isAdmin()) || (a.podeArquitetura && a.podeArquitetura()))); }
  function natureza(tipo) {
    if (tipo === 'AREA_ESPECIALIZADA') return 'Área Especializada';
    if (tipo === 'COE') return 'Centro de Excelência';
    if (ehTrabalho(tipo)) return 'Organização do trabalho';
    /* a regra fixa do motor só vale para códigos firmes (o Squad não é um deles) */
    return MOT() && MOT().CODIGOS_FIRMES.indexOf(tipo) !== -1 && MOT().liberaSquadParaCodigoFirme(tipo) === true ? 'Linha' : '—';
  }
  function dataHora(v) {
    var t = N() ? N().instante(v) : null;
    return t === null ? '—' : new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function quem(p) { return p ? esc(p.email || p.id) : '—'; }

  /* tradução dos códigos do núcleo e da persistência (o que aconteceu e o que fazer) */
  var CAMPO = { nome: 'Nome', sigla: 'Sigla', descricao: 'Descrição', tipo: 'Tipo', motivo: 'Motivo', justificativa: 'Justificativa', ordem: 'Ordem', subagrupador: 'Subagrupador' };
  function mensagem(e, contexto) {
    var c = e && e.codigo;
    if (c === 'NADA_A_ALTERAR' && contexto === 'subagrupador') return 'Nada mudou. Informe um nome diferente do atual.';
    if (c === 'NADA_A_ALTERAR' && contexto === 'associacao') return 'A Linha já está neste subagrupador.';
    if (c === 'NADA_A_ALTERAR' && contexto === 'relacao') return 'Escolha uma Linha diferente da atual.';
    if (c === 'CAMPO_OBRIGATORIO' && contexto === 'relacao') return e.campo === 'motivo' ? 'Informe o motivo.' : 'Escolha a relação.';
    if (c === 'MOTIVO_OBRIGATORIO' && contexto === 'relacao') return 'Informe o motivo.';
    if ((c === 'REVISAO_DESATUALIZADA' || c === 'CONFLITO_DE_REVISAO') && contexto === 'relacao') return 'Outra pessoa mudou as relações desta estrutura enquanto você trabalhava. A tela já mostra a situação atual: confira e faça de novo, se ainda for o caso.';
    if ((c === 'REVISAO_DESATUALIZADA' || c === 'CONFLITO_DE_REVISAO') && contexto === 'associacao') return 'Outra pessoa mudou o subagrupador desta Linha enquanto você trabalhava. A tela já mostra a situação atual: confira e faça de novo, se ainda for o caso.';
    if ((c === 'REVISAO_DESATUALIZADA' || c === 'CONFLITO_DE_REVISAO') && contexto === 'subagrupador') return 'Outra pessoa alterou este subagrupador enquanto você trabalhava. A tela já mostra a versão atual: confira e faça de novo, se ainda for o caso.';
    switch (c) {
      case 'SUBAGRUPADOR_INEXISTENTE': return 'Este subagrupador não foi encontrado.';
      case 'COMPOSICAO_ATIVA_JA_EXISTE': return 'Este Squad já compõe uma Linha. Para mudar, use "Trocar de Linha".';
      case 'RELACAO_DUPLICADA': return 'Esta relação já existe e está ativa.';
      case 'RELACAO_NAO_ADMITIDA_PELA_TAXONOMIA': return 'A Taxonomia não admite esta relação entre esses tipos de estrutura.';
      case 'AUTORRELACAO': return 'Uma estrutura não se relaciona com ela mesma.';
      case 'CICLO_NA_COMPOSICAO': return 'Esta composição formaria um ciclo.';
      case 'RELACAO_INEXISTENTE': return 'Esta relação não foi encontrada.';
      case 'RELACAO_ENCERRADA': return 'Esta relação já foi encerrada.';
      case 'TIPO_RELACAO_INVALIDO': return 'Escolha a relação.';
      case 'SUBAGRUPADOR_ENCERRADO': return 'Este subagrupador está encerrado: não pode ser alterado nem receber Linhas.';
      case 'ESTRUTURA_NAO_ADMITE_SUBAGRUPADOR': return 'Só Linhas de Negócios podem ficar num subagrupador.';
      case 'LINHA_JA_ASSOCIADA': return 'Esta Linha já está num subagrupador. Use "Trocar de subagrupador".';
      case 'ASSOCIACAO_INEXISTENTE': return 'A associação não foi encontrada.';
      case 'ASSOCIACAO_ENCERRADA': return 'Esta associação já foi encerrada.';
      case 'CAMPO_NAO_ALTERAVEL': return 'Este dado não pode ser alterado.';
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
      form: null, sujo: false, salvando: false, erros: [], flash: null, op: null, mostrarEncerradas: false, historicoAberto: false,
      /* Etapa 5 */
      subagrupadores: undefined, associacoes: undefined, eventosSg: undefined, mostrarSgEncerrados: false, assoc: null, contextoErro: null,
      /* M4 */
      vinculos: undefined, itensVinculados: {},
      /* M6/M7 */
      relacoes: undefined, rel: null }; }

    /* ---------- banco: leitura ao vivo e portas ---------- */
    var desligar = null, offset = 0, offsetLigado = false;
    function db() { return window.firebase.database(); }
    function ligar() {
      if (desligar || !disponivel()) return;
      desligar = FB().ouvir(db(), ['registros', 'eventos', 'subagrupadores', 'associacoes', 'eventosSubagrupadores', 'vinculos', 'relacoes'], function (m) {
        if (m.estruturas) st.estruturas = m.estruturas;
        if (m.eventos) st.eventos = m.eventos;
        if (m.subagrupadores) st.subagrupadores = m.subagrupadores;
        if (m.associacoesSubagrupador) st.associacoes = m.associacoesSubagrupador;
        if (m.eventosSubagrupadores) st.eventosSg = m.eventosSubagrupadores;
        if (m.vinculos) { st.vinculos = m.vinculos; st.itensVinculados = {}; if (st.vista !== 'detalhe') return; }
        if (m.relacoes) { st.relacoes = m.relacoes; if (st.vista !== 'detalhe') return; } /* M6/M7: só a ficha mostra as relações */ /* M4: só a ficha mostra os vínculos (nenhum redesenho num formulário aberto) */
        st.erroLeitura = null; render();
      }, function (c) { st.erroLeitura = c; render(); });
      if (!offsetLigado) { offsetLigado = true; db().ref('.info/serverTimeOffset').on('value', function (s) { offset = s.val() || 0; }); }
      lerLigacoes(function () { if (!wrap.hidden && st.vista === 'detalhe') render(); });
      lerTaxRel(function () { if (!wrap.hidden && (st.vista === 'detalhe' || st.vista === 'lista')) render(); });
      if (P()) { P().iniciar(); if (!ligar._nomes) { ligar._nomes = true; P().onMudanca(function () { if (!wrap.hidden) render(); }); } }
    }
    function desligarTudo() { if (desligar) { desligar(); desligar = null; } }
    function portas() { return FB().criarPortas({ db: db(), codigosFirmes: MOT().CODIGOS_FIRMES, codigosLinha: LINHA() }); }
    function casos() { return U().criar({ nucleo: N(), codigosFirmes: MOT().CODIGOS_FIRMES, codigosLinha: LINHA() }); }
    function lerRefs() {
      st.refs = undefined; st.refsErro = false;
      portas().lerReferencias().then(function (r) { st.refs = r; render(); }, function () { st.refs = null; st.refsErro = true; render(); });
    }
    function chaveNova() { return db().ref().push().key; }

    /* ---------- endereço ---------- */
    function idDoEndereco() { var m = /^#admin\?arq=estruturas(?:&e=([^&]*))?/.exec(location.hash || ''); return m ? (m[1] ? decodeURIComponent(m[1]) : '') : null; }
    function sgDoEndereco() { if (!/^#admin\?arq=estruturas/.test(location.hash || '')) return null; var m = /[?&]sg=([^&]*)/.exec(location.hash || ''); return m ? decodeURIComponent(m[1]) : null; }
    var VISTAS_SG = { subagrupadores: 1, subagrupador: 1, 'sg-novo': 1, 'sg-renomear': 1, 'sg-encerrar': 1 };
    function sincronizar() {
      if (wrap.hidden) return;
      var alvo = VISTAS_SG[st.vista] ? RAIZ_ROTA + '&sg=' + (st.vista === 'subagrupadores' || st.vista === 'sg-novo' || !st.id ? 'lista' : encodeURIComponent(st.id))
        : RAIZ_ROTA + (st.id && st.vista !== 'lista' && st.vista !== 'nova' ? '&e=' + encodeURIComponent(st.id) : '');
      if (location.hash !== alvo && /^#admin\?arq=estruturas/.test(location.hash || '')) history.replaceState(history.state, '', alvo);
    }
    window.addEventListener('hashchange', function () {
      if (wrap.hidden) return;
      var sg = sgDoEndereco();
      if (sg !== null) { if (st.sujo) return; if (sg === 'lista' && st.vista !== 'subagrupadores') irPara('subagrupadores'); else if (sg !== 'lista' && (st.vista !== 'subagrupador' || st.id !== sg)) irPara('subagrupador', sg); return; }
      var id = idDoEndereco(); if (id === null) return;
      if (id && id !== st.id) { if (st.sujo) return; irPara('detalhe', id); } else if (!id && st.vista !== 'lista' && st.vista !== 'nova' && !st.sujo) irPara('lista');
    });

    /* ---------- navegação ---------- */
    function irPara(vista, id) {
      st.vista = vista; st.id = id || null; st.erros = []; st.sujo = false; st.salvando = false; st.op = null; st.historicoAberto = false; st.contextoErro = null;
      st.flash = null; /* a confirmação é de UMA ação: nunca reaparece em outra tela (quem salva define a sua logo depois) */
      st.assoc = vista === 'detalhe' ? { subagrupadorId: '', justificativa: '' } : null;
      st.rel = null;
      /* M6/M7: a Taxonomia pode ter mudado — relações conceituais e Squad relidos a cada ficha ou cadastro aberto */
      if (vista === 'detalhe' || vista === 'nova') { taxRel = undefined; lendoTaxRel = false; aoLerTaxRel = []; geracaoTaxRel++; lerTaxRel(function () { if (!wrap.hidden && st.vista === 'detalhe') render(); }); }
      var sgAtual = id && st.subagrupadores ? st.subagrupadores[id] : null;
      var e = id && st.estruturas ? st.estruturas[id] : null;
      if (vista === 'nova') { st.form = { tipo: '', nome: '', sigla: '', descricao: '' }; lerRefs(); }
      else if (vista === 'editar' && e) st.form = { nome: e.nome || '', sigla: e.sigla || '', descricao: e.descricao || '', justificativa: '', revisao: e.revisao };
      else if (vista === 'encerrar' && e) st.form = { motivo: '', revisao: e.revisao };
      else if (vista === 'sg-novo') st.form = { nome: '' };
      else if (vista === 'sg-renomear' && sgAtual) st.form = { nome: sgAtual.nome, justificativa: '', revisao: sgAtual.revisao };
      else if (vista === 'sg-encerrar' && sgAtual) st.form = { motivo: '', revisao: sgAtual.revisao };
      else st.form = null;
      render(); sincronizar();
      var t = byId('estTitulo'); if (t) t.focus({ preventScroll: true });
      window.scrollTo({ top: Math.max(0, wrap.getBoundingClientRect().top + window.pageYOffset - 80), behavior: 'instant' });
    }
    function confirmarDescarte() { return !st.sujo || window.confirm('Há alterações que ainda não foram salvas. Sair mesmo assim?'); }

    /* ---------- salvar (sempre pelo caso de uso compartilhado) ---------- */
    var COM_NOVO_ID = { criarEstrutura: 1, criarSubagrupador: 1, associarLinha: 1, substituirAssociacao: 1, criarRelacao: 1, alterarRelacao: 1 };
    function salvar(operacao, entrada, contexto, aoGravar) {
      if (st.salvando) return;
      var u = window.firebase.auth().currentUser;
      if (!u) { st.erros = [{ codigo: 'CONTEXTO_SEM_USUARIO' }]; render(); return; }
      /* a MESMA tentativa reaproveita o identificador da operação: reenviar depois de "sem resposta" não duplica */
      st.op = st.op || { operacaoId: chaveNova(), novoId: chaveNova() };
      var ctx = { operacaoId: st.op.operacaoId, usuario: { id: u.uid, email: u.email }, agora: Date.now() + offset };
      if (COM_NOVO_ID[operacao]) ctx.novoId = st.op.novoId;
      st.salvando = true; st.erros = []; st.contextoErro = contexto || null; render();
      casos().executar(operacao, entrada, ctx, portas()).then(function (r) {
        st.salvando = false;
        if (r.ok && aoGravar) {
          var novoId = st.op.novoId; st.op = null; st.sujo = false;
          aoGravar(novoId);
          var fl = byId('estFlash'); if (fl) fl.focus({ preventScroll: true });
          return;
        }
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
          var atual = contexto === 'subagrupador' ? st.subagrupadores && st.subagrupadores[entrada.id] : st.estruturas && st.estruturas[entrada.id];
          if (atual && st.form && 'revisao' in st.form) st.form.revisao = atual.revisao; /* a próxima tentativa parte da versão que está na tela */
        }
        st.erros = r.erros; render();
        var al = byId('estErros'); if (al) al.focus({ preventScroll: true });
      }, function (e) { st.salvando = false; st.erros = [{ codigo: (e && e.codigo) || 'RECUSADA' }]; render(); });
    }

    /* ---------- desenho ---------- */
    function errosHtml() {
      if (!st.erros.length) return '';
      return '<div class="avp-error-msg est-erros" id="estErros" role="alert" tabindex="-1"><strong>Não foi salvo.</strong><ul>' +
        st.erros.map(function (e) { return '<li>' + esc(mensagem(e, st.contextoErro)) + '</li>'; }).join('') + '</ul></div>';
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
      var h = cabecalho('Estruturas Organizacionais', 'Voltar para ' + ((origem && origem.rotulo) || 'Avaliação e Mapa'), 'estVoltarOrigem') + abas('estruturas') + aviso();
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
        /* o cartão inteiro é o botão; a situação aparece na etiqueta E na faixa lateral/tom do cartão (data-situacao) */
        return '<li><button type="button" class="est-item est-item--' + esc(e.situacao) + '" data-estrutura="' + esc(e.id) + '" data-situacao="' + esc(e.situacao) + '">' +
          '<span class="est-item-nome">' + esc(e.nome) + (e.sigla ? ' <span class="est-sigla">' + esc(e.sigla) + '</span>' : '') + '</span>' +
          '<span class="est-item-tipo">' + esc(natureza(e.tipo)) + (natureza(e.tipo) === 'Linha' ? ' · ' + esc(nomeTipo(e.tipo)) : '') + '</span>' +
          '<span class="est-situacao est-situacao--' + esc(e.situacao) + '">' + (e.situacao === 'ativa' ? 'Ativa' : 'Encerrada') + '</span>' +
          '<span class="est-item-seta" aria-hidden="true">›</span></button></li>';
      }).join('') + '</ul>';
    }
    function opcoesTipo() {
      var firmes = MOT().CODIGOS_FIRMES, refs = st.refs;
      var linha = firmes.filter(function (c) { return MOT().liberaSquadParaCodigoFirme(c) === true; });
      var outros = firmes.filter(function (c) { return linha.indexOf(c) === -1; });
      var trabalho = (refs && refs.conceitosTrabalho) || [];
      function situacaoRef(c) {
        if (!refs) return null;
        if (trabalho.indexOf(c) !== -1) return refs.conceitos && refs.conceitos[c] && refs.conceitos[c].ativo === true ? null : 'conceito inativo na Taxonomia';
        if (!refs.ligacoes || !refs.ligacoes[c]) return 'ligação oficial não registrada';
        if (!refs.conceitos || !refs.conceitos[c] || refs.conceitos[c].ativo !== true) return 'conceito inativo na Taxonomia';
        return null;
      }
      function opcao(c) {
        var motivo = situacaoRef(c), marcado = st.form.tipo === c;
        return '<label class="est-tipo' + (motivo ? ' est-tipo--indisponivel' : '') + '"><input type="radio" name="estTipo" value="' + esc(c) + '"' + (marcado ? ' checked' : '') + (motivo ? ' disabled' : '') + '> ' +
          '<span>' + esc((trabalho.indexOf(c) !== -1 && refs.conceitos[c] && refs.conceitos[c].nome) || nomeTipo(c)) + (motivo ? ' <em class="est-tipo-motivo">— indisponível: ' + esc(motivo) + '</em>' : '') + '</span></label>';
      }
      var h = '<fieldset class="est-tipos" id="estTipos"' + (invalido('tipo') ? ' aria-invalid="true"' : '') + '><legend>Tipo <span class="est-obrig">(obrigatório)</span></legend>';
      if (refs === undefined) h += '<p class="loading-msg" role="status">Conferindo as referências oficiais…</p>';
      if (st.refsErro) h += '<p class="avp-error-msg" id="estRefsErro">Não foi possível conferir as referências oficiais agora. Você pode escolher o tipo; a conferência é refeita ao salvar.</p>';
      h += '<p class="est-grupo-tipo">Linha (especialização)</p>' + linha.map(opcao).join('');
      h += '<p class="est-grupo-tipo">Outras categorias</p>' + outros.map(opcao).join('');
      if (trabalho.length) h += '<p class="est-grupo-tipo">Organização do trabalho</p>' + trabalho.map(opcao).join('');
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
    function dado(rotulo, valor, largo) {
      return '<div class="est-dado' + (largo ? ' est-dado--largo' : '') + '"><dt>' + esc(rotulo) + '</dt><dd>' + valor + '</dd></div>';
    }
    function quando(em, por) { return '<span class="est-quando">' + dataHora(em) + '</span><span class="est-autor">' + quem(por) + '</span>'; }
    function situacaoHtml(e) { return '<span class="est-situacao est-situacao--' + esc(e.situacao) + '">' + (e.situacao === 'ativa' ? 'Ativa' : 'Encerrada') + '</span>'; }
    /* ficha em dois grupos (o terceiro, o histórico, vem logo abaixo): Identificação e Situação e controle */
    /* M4 (decisão G): os produtos e serviços sob esta estrutura — só consulta, com atalho para o Posicionamento (onde
       o vínculo é administrado); situação calculada pelo núcleo com o Posicionamento VIGENTE de cada item */
    function itemVinculado(objetoId, v) {
      var x = st.itensVinculados[objetoId];
      if (x) return x;
      x = st.itensVinculados[objetoId] = { carregado: false };
      Promise.all([portas().lerPosicionamento(objetoId), db().ref('avaliacoes-posicionamento/' + v.base.avaliacaoId + '/itemNome').once('value').then(function (sn) { return sn.val(); })]).then(function (r) {
        x.p = r[0]; x.nome = r[1]; x.carregado = true; render();
      }, function () { x.erro = true; x.carregado = true; render(); });
      return x;
    }
    function produtosHtml(e) {
      var h = '<section class="est-secao" aria-labelledby="estSecProdutos"><h5 class="est-secao-titulo" id="estSecProdutos">Produtos e serviços sob esta estrutura</h5>';
      garantirLeituras();
      if (st.vinculos === undefined || ligacoesLidas === undefined) return h + '<p class="loading-msg" role="status">Carregando…</p></section>';
      var estado = { estruturas: st.estruturas, vinculos: st.vinculos }, objs = N().objetosDaEstrutura(estado, e.id);
      if (!objs.length) return h + '<p class="est-vazio" id="estSemProdutos">Nenhum produto ou serviço vinculado a esta estrutura.</p></section>';
      return h + '<ul class="est-produtos" id="estProdutos">' + objs.map(function (o) {
        var v = st.vinculos[o.vinculoId], x = itemVinculado(o.objetoId, v);
        if (!x.carregado) return '<li class="est-produto" data-objeto="' + esc(o.objetoId) + '"><span class="loading-msg">Carregando…</span></li>';
        var sit = N().situacaoResponsavel(estado, o.objetoId, x.p || null, refsDaTela());
        return '<li class="est-produto" data-objeto="' + esc(o.objetoId) + '"><span class="est-produto-nome">' + esc(x.nome || o.objetoId) + '</span>' + situacaoVinculoHtml(sit) +
          '<a class="btn btn--sm est-abrir-po" href="#avaliacoes?po=' + encodeURIComponent((x.p && x.p.avaliacaoId) || v.base.avaliacaoId) + '">Abrir Posicionamento</a></li>';
      }).join('') + '</ul></section>';
    }
    function fichaHtml(e) {
      var linha = natureza(e.tipo) === 'Linha';
      return '<div class="est-ficha" id="estFicha">' +
        '<section class="est-secao" aria-labelledby="estSecIdentificacao"><h5 class="est-secao-titulo" id="estSecIdentificacao">Identificação</h5><dl class="est-dados">' +
          dado('Natureza', esc(natureza(e.tipo))) +
          dado(linha ? 'Especialização' : 'Tipo oficial', esc(nomeTipo(e.tipo))) +
          /* definição oficial vigente do tipo, da Taxonomia (faPosicionamentos); nunca texto próprio */
          dado('Definição oficial', P() ? P().definicaoHtml(e.tipo, 'estDefinicaoTipo', { comEstado: true, tag: 'span' }) : '<span class="fa-classif-def fa-classif-def--sem">Definição indisponível.</span>', true) +
          dado('Sigla', e.sigla ? esc(e.sigla) : '<span class="est-vazio">não informada</span>') +
          dado('Descrição', e.descricao ? '<span class="est-descricao">' + esc(e.descricao) + '</span>' : '<span class="est-vazio">não informada</span>', true) +
        '</dl></section>' +
        '<section class="est-secao" aria-labelledby="estSecControle"><h5 class="est-secao-titulo" id="estSecControle">Situação e controle</h5><dl class="est-dados">' +
          dado('Situação', situacaoHtml(e)) +
          dado('Revisão', esc(e.revisao)) +
          dado('Cadastrada', quando(e.criadaEm, e.criadaPor)) +
          (e.alteradaEm ? dado('Última alteração', quando(e.alteradaEm, e.alteradaPor)) : '') +
          (e.encerramento ? dado('Encerrada', quando(e.encerramento.em, e.encerramento.por)) +
            dado('Motivo do encerramento', '<span class="est-destaque est-destaque--motivo">' + esc(e.encerramento.motivo) + '</span>', true) : '') +
        '</dl></section></div>';
    }
    var ROTULO_EVENTO = { 'estrutura.criada': 'Cadastrada', 'estrutura.alterada': 'Alterada', 'estrutura.encerrada': 'Encerrada', 'associacao.criada': 'Subagrupador', 'associacao.encerrada': 'Subagrupador' };
    var CLASSE_EVENTO = { 'estrutura.criada': 'criada', 'estrutura.alterada': 'alterada', 'estrutura.encerrada': 'encerrada', 'associacao.criada': 'alterada', 'associacao.encerrada': 'alterada' };
    function valorHist(v) { return v ? esc(v) : '<span class="est-vazio">(vazio)</span>'; }
    function historicoHtml(id) {
      if (st.eventos === undefined) return '<p class="loading-msg">Carregando histórico…</p>';
      /* a estrutura e as associações dela a subagrupadores (Etapa 5), na mesma linha do tempo */
      var evs = N().historico(st.eventos, 'estrutura', id).concat(eventosAssociacaoDa(id))
        .sort(function (a, b) { var x = N().instante(a.em), y = N().instante(b.em); return x !== y ? x - y : (a.id < b.id ? -1 : 1); });
      var h = '<details class="est-secao est-historico" id="estHistorico"' + (st.historicoAberto ? ' open' : '') + '><summary class="est-secao-titulo">Histórico — ' + evs.length + ' alteraç' + (evs.length === 1 ? 'ão' : 'ões') + '</summary>' +
        '<p class="est-historico-ordem">Do registro mais recente para o mais antigo.</p><ol class="est-eventos">';
      h += evs.slice().reverse().map(function (ev) {
        var corpo = '';
        if (ev.entidade === 'associacao-subagrupador') corpo = '<p class="est-evento-resumo">' + (ev.tipo === 'associacao.criada'
          ? (ev.depois.substitui ? 'Passou para o subagrupador ' : 'Associada ao subagrupador ') + '<strong>' + esc(nomeSg(ev.depois.subagrupadorId)) + '</strong>.'
          : (ev.depois.encerramento && ev.depois.encerramento.substituidaPor ? 'Saiu do subagrupador <strong>' + esc(nomeSg(ev.depois.subagrupadorId)) + '</strong> (troca).' : 'Saiu do subagrupador <strong>' + esc(nomeSg(ev.depois.subagrupadorId)) + '</strong>; aparece em "Sem subagrupador".')) + '</p>';
        if (ev.tipo === 'estrutura.criada' && ev.depois) corpo = '<p class="est-evento-resumo">Cadastrada como ' + esc(natureza(ev.depois.tipo)) + ' · ' + esc(nomeTipo(ev.depois.tipo)) + ', com o nome <strong>' + esc(ev.depois.nome) + '</strong>' + (ev.depois.sigla ? ' (sigla ' + esc(ev.depois.sigla) + ')' : '') + '.</p>';
        if (ev.tipo === 'estrutura.alterada' && ev.antes) corpo = (ev.campos || []).map(function (c) {
          return '<div class="est-mudanca" data-campo="' + esc(c) + '"><p class="est-mudanca-campo">' + esc(CAMPO[c] || c) + '</p><div class="est-antes-depois">' +
            '<div class="est-valor est-valor--antes"><span class="est-valor-rotulo">Antes</span><span class="est-valor-texto">' + valorHist(ev.antes[c]) + '</span></div>' +
            '<div class="est-valor est-valor--depois"><span class="est-valor-rotulo">Depois</span><span class="est-valor-texto">' + valorHist(ev.depois[c]) + '</span></div></div></div>';
        }).join('');
        return '<li class="est-evento est-evento--' + (CLASSE_EVENTO[ev.tipo] || 'outro') + '" data-tipo="' + esc(ev.tipo) + '">' +
          '<div class="est-evento-topo"><span class="est-evento-tipo">' + esc(ROTULO_EVENTO[ev.tipo] || ev.tipo) + '</span>' +
          '<span class="est-evento-meta">' + dataHora(ev.em) + ' · ' + quem(ev.usuario) + '</span></div>' + corpo +
          (ev.justificativa ? '<div class="est-destaque"><span class="est-destaque-rotulo">Justificativa</span>' + esc(ev.justificativa) + '</div>' : '') +
          (ev.motivo ? '<div class="est-destaque est-destaque--motivo"><span class="est-destaque-rotulo">Motivo do encerramento</span>' + esc(ev.motivo) + '</div>' : '') + '</li>';
      }).join('');
      return h + '</ol></details>';
    }
    function detalheHtml() {
      var e = st.estruturas && st.estruturas[st.id];
      var h = cabecalho(e ? e.nome : 'Estrutura', 'Voltar para a lista de estruturas', 'estVoltarLista');
      if (st.estruturas === undefined) return h + '<p class="loading-msg" role="status">Carregando…</p>';
      if (!e) return h + '<p class="avp-error-msg" id="estNaoEncontrada">Esta estrutura não foi encontrada.</p>';
      if (st.flash) h += '<div class="avp-flash-success est-flash" id="estFlash" role="status" tabindex="-1"><p>' + esc(st.flash.texto) + '</p>' +
        '<div class="est-flash-acoes">' + (!st.flash.encerrada ? '<a class="btn btn--sm btn--primary" id="estFlashMapa" href="#avaliacoes?mf=mapa&e=' + encodeURIComponent(e.id) + '">Ver no Mapa da Floresta</a>' : '') +
        (st.flash.nova && podeManter() ? '<button type="button" class="btn btn--sm" id="estFlashOutra">Cadastrar outra</button>' : '') + '</div></div>';
      h += fichaHtml(e) + produtosHtml(e) + relacoesHtml(e) + associacaoHtml(e);
      h += '<div class="est-acoes">';
      if (e.situacao === 'ativa') h += '<a class="btn" id="estVerNoMapa" href="#avaliacoes?mf=mapa&e=' + encodeURIComponent(e.id) + '">Ver no Mapa da Floresta</a>';
      if (e.situacao === 'ativa' && podeManter()) h += '<button type="button" class="btn" id="estEditar">Editar</button><button type="button" class="btn btn--danger" id="estEncerrar">Encerrar</button>';
      h += '</div>';
      if (e.situacao !== 'ativa') h += '<p class="est-aviso-encerrada" id="estEncerradaAviso">Estrutura encerrada: não aparece no Mapa da Floresta e não pode ser alterada nem reativada. A ficha e o histórico continuam disponíveis para consulta. Para voltar a representá-la, cadastre uma nova.</p>';
      return h + historicoHtml(e.id) + aviso();
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
    /* ===== Etapa 5: subagrupadores das Linhas de Negócios ===== */
    function abas(atual) {
      return '<div class="est-abas" role="group" aria-label="O que você quer manter">' +
        '<button type="button" class="est-aba' + (atual === 'estruturas' ? ' est-aba--ativa' : '') + '" id="estAbaEstruturas" aria-pressed="' + (atual === 'estruturas') + '">Estruturas</button>' +
        '<button type="button" class="est-aba' + (atual === 'subagrupadores' ? ' est-aba--ativa' : '') + '" id="estAbaSubagrupadores" aria-pressed="' + (atual === 'subagrupadores') + '">Subagrupadores das Linhas de Negócios</button></div>';
    }
    function estadoSg() { return { estruturas: st.estruturas || {}, subagrupadores: st.subagrupadores || {}, associacoesSubagrupador: st.associacoes || {} }; }
    function nomeSg(id) { var g = st.subagrupadores && st.subagrupadores[id]; return g ? g.nome : '(subagrupador removido da leitura)'; }
    function flashHtml(acoes) {
      if (!st.flash) return '';
      return '<div class="avp-flash-success est-flash" id="estFlash" role="status" tabindex="-1"><p>' + esc(st.flash.texto) + '</p>' + (acoes ? '<div class="est-flash-acoes">' + acoes + '</div>' : '') + '</div>';
    }
    var INTRO_SG = 'Agrupamentos de apresentação do Mapa da Floresta, só para Linhas de Negócios: organizam onde cada Linha aparece no Mapa. Não são estruturas organizacionais nem conceitos da Taxonomia.';
    function subagrupadoresHtml() {
      var h = cabecalho('Subagrupadores das Linhas de Negócios', 'Voltar para ' + ((origem && origem.rotulo) || 'Avaliação e Mapa'), 'estVoltarOrigem') + abas('subagrupadores') + aviso() + flashHtml() + errosHtml();
      h += '<p class="est-intro">' + esc(INTRO_SG) + '</p>';
      h += '<div class="est-acoes">' + (podeManter() ? '<button type="button" class="btn btn--primary" id="sgNovo">Novo subagrupador</button>' : '') + '<a class="btn" href="#avaliacoes?mf=mapa">Ver o Mapa da Floresta</a></div>';
      if (st.erroLeitura) return h + '<div class="avp-error-msg" role="alert">Não foi possível ler os subagrupadores agora.</div>';
      if (st.subagrupadores === undefined || st.estruturas === undefined || st.associacoes === undefined) return h + '<p class="loading-msg" role="status">Carregando subagrupadores…</p>';
      var E = estadoSg(), ativos = N().subagrupadoresAtivos(E);
      var encerrados = Object.keys(st.subagrupadores).map(function (k) { return st.subagrupadores[k]; }).filter(function (g) { return g.situacao !== 'ativo'; })
        .sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome), 'pt-BR'); });
      h += '<div class="est-filtro"><label><input type="checkbox" id="sgMostrarEncerrados"' + (st.mostrarSgEncerrados ? ' checked' : '') + '> Mostrar encerrados (' + encerrados.length + ')</label>' +
        '<span class="est-contagem" id="sgContagem">' + ativos.length + ' ativo' + (ativos.length === 1 ? '' : 's') + '</span></div>';
      if (!ativos.length && !(st.mostrarSgEncerrados && encerrados.length)) return h + '<p class="admin-empty" id="sgVazio">Nenhum subagrupador ativo.' + (podeManter() ? ' Use "Novo subagrupador" para criar o primeiro.' : '') + ' Enquanto isso, as Linhas de Negócios aparecem em "Sem subagrupador" no Mapa.</p>';
      h += '<p class="est-historico-ordem">A ordem desta lista é a ordem em que os subagrupadores aparecem no bloco Linhas de Negócios do Mapa.</p>';
      h += '<ol class="est-lista sg-lista" id="sgLista">' + ativos.map(function (g, i) {
        var n = N().linhasDoSubagrupador(E, g.id).length;
        return '<li class="sg-linha"><button type="button" class="est-item est-item--ativa sg-item" data-subagrupador="' + esc(g.id) + '">' +
          '<span class="est-item-nome">' + esc(g.nome) + '</span><span class="est-item-tipo">' + n + ' Linha' + (n === 1 ? '' : 's') + ' de Negócios associada' + (n === 1 ? '' : 's') + '</span>' +
          '<span class="est-situacao est-situacao--ativa">Ativo</span><span class="est-item-seta" aria-hidden="true">›</span></button>' +
          (podeManter() ? '<span class="sg-mover"><button type="button" class="btn btn--sm sg-subir" data-subagrupador="' + esc(g.id) + '" aria-label="Subir ' + esc(g.nome) + '"' + (i === 0 || st.salvando ? ' disabled' : '') + '>↑</button>' +
            '<button type="button" class="btn btn--sm sg-descer" data-subagrupador="' + esc(g.id) + '" aria-label="Descer ' + esc(g.nome) + '"' + (i === ativos.length - 1 || st.salvando ? ' disabled' : '') + '>↓</button></span>' : '') + '</li>';
      }).join('') + '</ol>';
      if (st.mostrarSgEncerrados && encerrados.length) h += '<ul class="est-lista" id="sgEncerrados">' + encerrados.map(function (g) {
        return '<li><button type="button" class="est-item est-item--encerrada sg-item" data-subagrupador="' + esc(g.id) + '"><span class="est-item-nome">' + esc(g.nome) + '</span>' +
          '<span class="est-item-tipo">Encerrado em ' + dataHora(g.encerramento && g.encerramento.em) + '</span><span class="est-situacao est-situacao--encerrada">Encerrado</span><span class="est-item-seta" aria-hidden="true">›</span></button></li>';
      }).join('') + '</ul>';
      return h;
    }
    /* nova posição entre os vizinhos (só a ordem do próprio subagrupador muda; empate de ordem é desfeito pelo nome) */
    function novaOrdem(id, direcao) {
      var lista = N().subagrupadoresAtivos(estadoSg()), i = lista.map(function (g) { return g.id; }).indexOf(id);
      if (direcao < 0) { if (i <= 0) return null; var hi = lista[i - 1].ordem, lo = i >= 2 ? lista[i - 2].ordem : hi - 20; return lo === hi ? hi - 0.001 : (lo + hi) / 2; }
      if (i < 0 || i >= lista.length - 1) return null;
      var lo2 = lista[i + 1].ordem, hi2 = i + 2 < lista.length ? lista[i + 2].ordem : lo2 + 20; return lo2 === hi2 ? lo2 + 0.001 : (lo2 + hi2) / 2;
    }
    function mover(id, direcao) {
      var g = st.subagrupadores[id], o = novaOrdem(id, direcao);
      if (!g || o === null) return;
      salvar('alterarSubagrupador', { id: id, alteracoes: { ordem: o }, revisaoEsperada: g.revisao }, 'subagrupador', function () {
        st.flash = { texto: 'Ordem atualizada: "' + g.nome + '" ' + (direcao < 0 ? 'subiu' : 'desceu') + ' uma posição no Mapa.' }; st.vista = 'subagrupadores'; render();
      });
    }
    var ROTULO_EVENTO_SG = { 'subagrupador.criado': 'Criado', 'subagrupador.alterado': 'Alterado', 'subagrupador.encerrado': 'Encerrado' };
    var CLASSE_EVENTO_SG = { 'subagrupador.criado': 'criada', 'subagrupador.alterado': 'alterada', 'subagrupador.encerrado': 'encerrada' };
    function historicoSgHtml(id) {
      if (st.eventosSg === undefined) return '<p class="loading-msg">Carregando histórico…</p>';
      var evs = N().historico(st.eventosSg, 'subagrupador', id);
      var h = '<details class="est-secao est-historico" id="estHistorico"' + (st.historicoAberto ? ' open' : '') + '><summary class="est-secao-titulo">Histórico — ' + evs.length + ' alteraç' + (evs.length === 1 ? 'ão' : 'ões') + '</summary>' +
        '<p class="est-historico-ordem">Do registro mais recente para o mais antigo.</p><ol class="est-eventos">';
      h += evs.slice().reverse().map(function (ev) {
        var corpo = '';
        if (ev.tipo === 'subagrupador.criado' && ev.depois) corpo = '<p class="est-evento-resumo">Criado com o nome <strong>' + esc(ev.depois.nome) + '</strong>.</p>';
        if (ev.tipo === 'subagrupador.alterado' && ev.antes) corpo = (ev.campos || []).map(function (c) {
          if (c === 'ordem') return '<div class="est-mudanca" data-campo="ordem"><p class="est-mudanca-campo">Ordem no Mapa</p><p class="est-evento-resumo">Posição alterada (a ordem completa está na lista de subagrupadores).</p></div>';
          return '<div class="est-mudanca" data-campo="' + esc(c) + '"><p class="est-mudanca-campo">' + esc(CAMPO[c] || c) + '</p><div class="est-antes-depois">' +
            '<div class="est-valor est-valor--antes"><span class="est-valor-rotulo">Antes</span><span class="est-valor-texto">' + valorHist(ev.antes[c]) + '</span></div>' +
            '<div class="est-valor est-valor--depois"><span class="est-valor-rotulo">Depois</span><span class="est-valor-texto">' + valorHist(ev.depois[c]) + '</span></div></div></div>';
        }).join('');
        return '<li class="est-evento est-evento--' + (CLASSE_EVENTO_SG[ev.tipo] || 'outro') + '" data-tipo="' + esc(ev.tipo) + '"><div class="est-evento-topo"><span class="est-evento-tipo">' + esc(ROTULO_EVENTO_SG[ev.tipo] || ev.tipo) + '</span>' +
          '<span class="est-evento-meta">' + dataHora(ev.em) + ' · ' + quem(ev.usuario) + '</span></div>' + corpo +
          (ev.justificativa ? '<div class="est-destaque"><span class="est-destaque-rotulo">Justificativa</span>' + esc(ev.justificativa) + '</div>' : '') +
          (ev.motivo ? '<div class="est-destaque est-destaque--motivo"><span class="est-destaque-rotulo">Motivo do encerramento</span>' + esc(ev.motivo) + '</div>' : '') + '</li>';
      }).join('');
      return h + '</ol></details>';
    }
    function subagrupadorHtml() {
      var g = st.subagrupadores && st.subagrupadores[st.id];
      var h = cabecalho(g ? g.nome : 'Subagrupador', 'Voltar para os subagrupadores', 'sgVoltarLista');
      if (st.subagrupadores === undefined || st.estruturas === undefined || st.associacoes === undefined) return h + '<p class="loading-msg" role="status">Carregando…</p>';
      if (!g) return h + '<p class="avp-error-msg" id="sgNaoEncontrado">Este subagrupador não foi encontrado.</p>';
      var E = estadoSg(), ativos = N().subagrupadoresAtivos(E), pos = ativos.map(function (x) { return x.id; }).indexOf(g.id), linhas = N().linhasDoSubagrupador(E, g.id);
      h += flashHtml(g.situacao === 'ativo' ? '<a class="btn btn--sm btn--primary" href="#avaliacoes?mf=mapa">Ver no Mapa da Floresta</a>' : '');
      h += '<div class="est-ficha" id="sgFicha"><section class="est-secao"><h5 class="est-secao-titulo">Identificação</h5><dl class="est-dados">' +
        dado('Nome', esc(g.nome)) + dado('Aplica-se a', 'Linhas de Negócios') +
        dado('Posição no Mapa', g.situacao === 'ativo' ? (pos + 1) + 'º de ' + ativos.length : '<span class="est-vazio">fora do Mapa (encerrado)</span>') +
        dado('Linhas associadas', linhas.length ? '<span class="sg-linhas">' + linhas.map(function (l) { return '<a href="#admin?arq=estruturas&e=' + encodeURIComponent(l.id) + '">' + esc(l.nome) + '</a>'; }).join('') + '</span>' : '<span class="est-vazio">nenhuma</span>', true) +
        '</dl></section><section class="est-secao"><h5 class="est-secao-titulo">Situação e controle</h5><dl class="est-dados">' +
        dado('Situação', '<span class="est-situacao est-situacao--' + (g.situacao === 'ativo' ? 'ativa' : 'encerrada') + '">' + (g.situacao === 'ativo' ? 'Ativo' : 'Encerrado') + '</span>') +
        dado('Revisão', esc(g.revisao)) + dado('Criado', quando(g.criadoEm, g.criadoPor)) +
        (g.alteradoEm ? dado('Última alteração', quando(g.alteradoEm, g.alteradoPor)) : '') +
        (g.encerramento ? dado('Encerrado', quando(g.encerramento.em, g.encerramento.por)) + dado('Motivo do encerramento', '<span class="est-destaque est-destaque--motivo">' + esc(g.encerramento.motivo) + '</span>', true) : '') +
        '</dl></section></div>';
      if (g.situacao === 'ativo' && podeManter()) h += '<div class="est-acoes"><button type="button" class="btn" id="sgRenomear">Renomear</button><button type="button" class="btn btn--danger" id="sgEncerrar">Encerrar</button></div>';
      if (g.situacao !== 'ativo') h += '<p class="est-aviso-encerrada" id="sgEncerradoAviso">Subagrupador encerrado: não aparece no Mapa, não recebe Linhas e não pode ser alterado nem reativado. As Linhas que estavam nele aparecem em "Sem subagrupador" até serem associadas a outro; o histórico continua aqui.</p>';
      return h + historicoSgHtml(g.id) + aviso();
    }
    function formSgHtml(titulo, voltarId, voltarRotulo, campos, botao, perigo, confirmacao) {
      return cabecalho(titulo, voltarRotulo, voltarId) + aviso() + errosHtml() + '<form class="avp-form-card est-form" id="sgForm" novalidate>' + (confirmacao || '') + campos +
        '<div class="avp-actions-footer"><button type="submit" class="btn ' + (perigo ? 'btn--danger' : 'btn--primary') + '" id="sgSalvar"' + (st.salvando ? ' disabled' : '') + '>' + (st.salvando ? 'Salvando…' : botao) + '</button>' +
        '<button type="button" class="btn" id="sgCancelar">Cancelar</button></div></form>';
    }
    function formSgNovoHtml() {
      return formSgHtml('Novo subagrupador', 'sgVoltarLista', 'Voltar para os subagrupadores', '<p class="est-intro">' + esc(INTRO_SG) + '</p>' +
        campoTexto('sgNome', 'nome', 'Nome', st.form.nome, N().MAX.nome, { obrigatorio: true, ajuda: 'Ex.: Previdência, Proteção, Crédito (exemplos).' }) +
        '<p class="avp-natureza-ajuda">Ele entra no fim da lista; a posição pode ser mudada depois.</p>', 'Salvar subagrupador');
    }
    function formSgRenomearHtml() {
      var g = st.subagrupadores && st.subagrupadores[st.id];
      if (!g) return cabecalho('Renomear', 'Voltar para os subagrupadores', 'sgVoltarLista') + '<p class="avp-error-msg">Este subagrupador não foi encontrado.</p>';
      return formSgHtml('Renomear: ' + g.nome, 'sgVoltarFicha', 'Voltar para o subagrupador',
        campoTexto('sgNome', 'nome', 'Novo nome', st.form.nome, N().MAX.nome, { obrigatorio: true }) +
        campoTexto('sgJustificativa', 'justificativa', 'Justificativa', st.form.justificativa, N().MAX.justificativa, { area: true, linhas: 2, ajuda: 'Fica registrada no histórico.' }), 'Salvar novo nome');
    }
    function formSgEncerrarHtml() {
      var g = st.subagrupadores && st.subagrupadores[st.id];
      if (!g) return cabecalho('Encerrar', 'Voltar para os subagrupadores', 'sgVoltarLista') + '<p class="avp-error-msg">Este subagrupador não foi encontrado.</p>';
      var n = N().linhasDoSubagrupador(estadoSg(), g.id).length;
      return formSgHtml('Encerrar: ' + g.nome, 'sgVoltarFicha', 'Voltar para o subagrupador',
        campoTexto('sgMotivo', 'motivo', 'Motivo do encerramento', st.form.motivo, N().MAX.motivo, { area: true, linhas: 3, obrigatorio: true, ajuda: 'Fica registrado no histórico.' }), 'Confirmar encerramento', true,
        '<div class="avp-reavaliacao-alerta est-confirmacao" role="note"><strong>Confirme o encerramento.</strong> O subagrupador sai do Mapa e não pode ser alterado nem reativado depois. ' +
        (n ? 'As ' + n + ' Linha' + (n === 1 ? '' : 's') + ' associada' + (n === 1 ? '' : 's') + ' passa' + (n === 1 ? '' : 'm') + ' a aparecer em "Sem subagrupador"; as associações ficam no histórico. ' : '') + 'Nada é apagado.</div>');
    }
    /* na ficha de uma Linha de Negócios: onde ela aparece no Mapa e como mudar */
    /* M6/M7: relações com outras estruturas — situação calculada pelo núcleo; criar só o que o núcleo aceita (as mesmas
       referências do caso de uso, com o recorte C2); trocar de Linha (C3) = substituir com motivo; encerrar com motivo */
    /* uma troca de pessoa zera as leituras em andamento: a ficha as dispara de novo (uma vez cada), com um só redesenho ao chegar */
    function garantirLeituras() {
      var redesenhar = function () { if (!wrap.hidden && st.vista === 'detalhe') render(); };
      if (ligacoesLidas === undefined && !lendoLigacoes) lerLigacoes(redesenhar);
      if (taxRel === undefined && !lendoTaxRel) lerTaxRel(redesenhar);
    }
    function estadoRel() { return { estruturas: st.estruturas, relacoes: st.relacoes, vinculos: {} }; }
    function nomeEst(id) { var x = st.estruturas && st.estruturas[id]; return x ? x.nome : id; }
    function refsRel() { return st.refs ? casos().referencias(st.refs) : null; }
    var CTX_PREVIA = { operacaoId: 'previa', novoId: 'previa', usuario: { id: 'previa' }, agora: 1 };
    function linhasParaTroca(r) {
      var ref = refsRel(); if (!ref) return [];
      return Object.keys(st.estruturas || {}).map(function (k) { return st.estruturas[k]; })
        .filter(function (x) { return x.situacao === 'ativa' && x.id !== r.destino && N().alterarRelacao(estadoRel(), r.id, { destino: x.id }, 'previa', CTX_PREVIA, ref).ok; })
        .sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome), 'pt-BR'); });
    }
    function itemRelacao(r, dir, e, manter) {
      var sit = taxRel ? N().situacaoRelacao(estadoRel(), r.id, { relacoesConceituais: taxRel.relacoesConceituais }) : null;
      var texto = dir === 'saida' ? esc(ROTULO_RELACAO[r.tipo] || r.tipo) + ' <strong>' + esc(nomeEst(r.destino)) + '</strong>' : '<strong>' + esc(nomeEst(r.origem)) + '</strong> ' + esc(ROTULO_RELACAO[r.tipo] || r.tipo) + ' esta estrutura';
      var h = '<li class="est-relacao" data-relacao="' + esc(r.id) + '" data-tipo="' + esc(r.tipo) + '"><span class="est-relacao-texto">' + texto + '</span>' +
        (sit ? ' <span class="est-situacao est-relacao-situacao est-relacao-situacao--' + esc(sit.situacao) + '" data-situacao="' + esc(sit.situacao) + '">' + (sit.situacao === 'valida' ? 'Válida' : 'A revisar') + '</span>' : '') +
        (sit && sit.motivos && sit.motivos.length ? ' <span class="po-resp-motivos">' + esc(sit.motivos.map(function (m) { return { ORIGEM_ENCERRADA: 'a origem foi encerrada', DESTINO_ENCERRADO: 'o destino foi encerrado', TAXONOMIA_NAO_ADMITE_MAIS: 'a Taxonomia não admite mais' }[m] || m; }).join('; ')) + '</span>' : '');
      if (manter) {
        h += '<span class="est-relacao-acoes">' + (dir === 'saida' && r.tipo === 'compoe' && ehTrabalho(e.tipo) ? '<button type="button" class="btn btn--sm est-rel-trocar" data-relacao="' + esc(r.id) + '">Trocar de Linha</button>' : '') +
          '<button type="button" class="btn btn--sm est-rel-encerrar" data-relacao="' + esc(r.id) + '">Encerrar</button></span>';
      }
      return h + '</li>';
    }
    function relacoesHtml(e) {
      var h = '<section class="est-secao est-relacoes" id="estRelacoes" aria-labelledby="estSecRelacoes"><h5 class="est-secao-titulo" id="estSecRelacoes">Relações com outras estruturas</h5>';
      garantirLeituras();
      if (st.relacoes === undefined || taxRel === undefined) return h + '<p class="loading-msg" role="status">Carregando…</p></section>';
      var estado = estadoRel(), ativas = N().relacoesDaEstrutura(estado, e.id), todas = N().relacoesDaEstrutura(estado, e.id, { incluirEncerradas: true });
      var manter = podeManter() && e.situacao === 'ativa', sr = st.rel || {};
      var itens = ativas.saida.map(function (r) { return itemRelacao(r, 'saida', e, manter && !sr.modo); }).concat(ativas.entrada.map(function (r) { return itemRelacao(r, 'entrada', e, manter && !sr.modo); }));
      h += itens.length ? '<ul class="est-relacoes-lista" id="estRelacoesLista">' + itens.join('') + '</ul>' : '<p class="est-vazio" id="estSemRelacoes">Nenhuma relação ativa.</p>';
      var enc = todas.saida.concat(todas.entrada).filter(function (r, i, l) { return r.situacao !== 'ativa' && l.indexOf(r) === i; });
      if (enc.length) h += '<details class="est-relacoes-encerradas" id="estRelacoesEncerradas"><summary>Relações encerradas — ' + enc.length + '</summary><ul>' + enc.map(function (r) {
        return '<li>' + esc(nomeEst(r.origem)) + ' ' + esc(ROTULO_RELACAO[r.tipo] || r.tipo) + ' ' + esc(nomeEst(r.destino)) + ' — encerrada em ' + dataHora(r.encerramento && r.encerramento.em) + (r.encerramento && r.encerramento.motivo ? ': ' + esc(r.encerramento.motivo) : '') + '</li>';
      }).join('') + '</ul></details>';
      if (!manter) return h + '</section>';
      if (!sr.modo) return h + '<div class="est-acoes"><button type="button" class="btn" id="estRelNova">Nova relação</button></div></section>';
      var erros = st.contextoErro === 'relacao' ? errosHtml() : '';
      if (sr.modo === 'nova') {
        var ref = refsRel();
        if (st.refs === undefined) return h + '<p class="loading-msg" role="status">Conferindo as referências oficiais…</p></section>';
        var poss = ref ? N().relacoesPossiveis(estado, e.id, ref) : [];
        h += '<div class="est-rel-form" id="estRelForm"><h6 class="est-secao-titulo">Nova relação</h6>';
        h += poss.length ? '<div class="avp-field est-campo"><label for="estRelEscolha">Relação <span class="est-obrig">(obrigatório)</span></label><select id="estRelEscolha" class="avp-select"><option value="">Escolha…</option>' +
          poss.map(function (p) { var v = p.tipo + '|' + p.destino; return '<option value="' + esc(v) + '"' + (sr.escolha === v ? ' selected' : '') + '>' + esc((ROTULO_RELACAO[p.tipo] || p.tipo) + ' ' + nomeEst(p.destino)) + '</option>'; }).join('') + '</select></div>'
          : '<p class="admin-empty" id="estRelSemOpcoes">' + (st.refsErro ? 'Não foi possível conferir as referências oficiais agora.' : 'Nenhuma relação admitida pela Taxonomia a partir desta estrutura (ou todas as possíveis já existem).') + '</p>';
        h += '<div class="avp-field est-campo"><label for="estRelJustificativa">Justificativa <span class="est-opc">(opcional)</span></label><textarea id="estRelJustificativa" maxlength="' + N().MAX.justificativa + '" rows="2">' + esc(sr.justificativa || '') + '</textarea></div>';
      } else {
        var r = st.relacoes[sr.relacaoId];
        h += '<div class="est-rel-form" id="estRelForm"><h6 class="est-secao-titulo">' + (sr.modo === 'trocar' ? 'Trocar de Linha' : 'Encerrar a relação') + '</h6>' +
          '<p class="est-intro">' + esc(nomeEst(r.origem)) + ' ' + esc(ROTULO_RELACAO[r.tipo] || r.tipo) + ' ' + esc(nomeEst(r.destino)) + '</p>';
        if (sr.modo === 'trocar') {
          if (st.refs === undefined) return h + '<p class="loading-msg" role="status">Conferindo as referências oficiais…</p></div></section>';
          var op = linhasParaTroca(r);
          h += op.length ? '<div class="avp-field est-campo"><label for="estRelEscolha">Nova Linha <span class="est-obrig">(obrigatório)</span></label><select id="estRelEscolha" class="avp-select"><option value="">Escolha…</option>' +
            op.map(function (x) { return '<option value="' + esc(x.id) + '"' + (sr.escolha === x.id ? ' selected' : '') + '>' + esc(x.nome) + '</option>'; }).join('') + '</select></div>'
            : '<p class="admin-empty" id="estRelSemOpcoes">Nenhuma outra Linha admitida pela Taxonomia para este Squad.</p>';
        }
        h += '<div class="avp-field est-campo"><label for="estRelMotivo">Motivo <span class="est-obrig">(obrigatório)</span></label><textarea id="estRelMotivo" maxlength="' + N().MAX.motivo + '" rows="2">' + esc(sr.motivo || '') + '</textarea></div>';
      }
      return h + erros + '<div class="est-acoes"><button type="button" class="btn btn--primary" id="estRelSalvar"' + (st.salvando ? ' disabled' : '') + '>' + (st.salvando ? 'Salvando…' : sr.modo === 'encerrar' ? 'Encerrar relação' : 'Salvar') + '</button>' +
        '<button type="button" class="btn" id="estRelCancelar">Cancelar</button></div></div></section>';
    }
    function associacaoHtml(e) {
      if (e.tipo !== N().TIPO_COM_SUBAGRUPADOR) return '';
      if (st.subagrupadores === undefined || st.associacoes === undefined) return '<section class="est-secao est-sg" id="estSubagrupador"><p class="loading-msg">Carregando subagrupador…</p></section>';
      var E = estadoSg(), sit = N().subagrupadorDaLinha(E, e.id), ativos = N().subagrupadoresAtivos(E);
      var atualTxt = sit.situacao === 'associada' ? '<strong>' + esc(sit.subagrupador.nome) + '</strong>'
        : sit.situacao === 'subagrupador-encerrado' ? 'Sem subagrupador <span class="est-vazio">(o subagrupador "' + esc(sit.subagrupador ? sit.subagrupador.nome : '') + '" foi encerrado)</span>' : 'Sem subagrupador';
      var h = '<section class="est-secao est-sg" id="estSubagrupador" aria-labelledby="estSecSg"><h5 class="est-secao-titulo" id="estSecSg">Subagrupador no Mapa</h5>' +
        '<p class="est-sg-atual" id="estSgAtual">' + atualTxt + '</p>';
      if (e.situacao !== 'ativa' || !podeManter()) return h + '</section>';
      var opcoes = ativos.filter(function (g) { return !(sit.situacao === 'associada' && g.id === sit.subagrupador.id); });
      if (!opcoes.length && sit.situacao !== 'associada') return h + '<p class="avp-natureza-ajuda" id="estSgSemOpcoes">Nenhum subagrupador ativo. Crie um na aba "Subagrupadores das Linhas de Negócios".</p></section>';
      var troca = !!sit.associacao;
      h += '<div class="est-sg-form">' + (opcoes.length ? '<div class="avp-field est-campo"><label for="estSgEscolha">' + (troca ? 'Trocar para' : 'Associar a') + '</label><select id="estSgEscolha" class="avp-select">' +
        '<option value="">Escolha um subagrupador…</option>' + opcoes.map(function (g) { return '<option value="' + esc(g.id) + '"' + (st.assoc && st.assoc.subagrupadorId === g.id ? ' selected' : '') + '>' + esc(g.nome) + '</option>'; }).join('') + '</select></div>' : '') +
        campoTexto('estSgJustificativa', 'justificativa', 'Justificativa', (st.assoc && st.assoc.justificativa) || '', N().MAX.justificativa, { area: true, linhas: 2, ajuda: 'Fica registrada no histórico.' }) +
        (st.contextoErro === 'associacao' ? errosHtml() : '') +
        '<div class="est-acoes">' + (opcoes.length ? '<button type="button" class="btn btn--primary" id="estSgAssociar"' + (st.salvando ? ' disabled' : '') + '>' + (troca ? 'Trocar de subagrupador' : 'Associar') + '</button>' : '') +
        (troca ? '<button type="button" class="btn" id="estSgTirar"' + (st.salvando ? ' disabled' : '') + '>Tirar do subagrupador</button>' : '') + '</div></div></section>';
      return h;
    }
    /* eventos de associação desta Linha, para o histórico da estrutura */
    function eventosAssociacaoDa(id) {
      return (st.eventosSg || []).filter(function (ev) { return ev.entidade === 'associacao-subagrupador' && ev.depois && ev.depois.estruturaId === id; });
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
      else if (st.vista === 'subagrupadores') h = subagrupadoresHtml();
      else if (st.vista === 'subagrupador') h = subagrupadorHtml();
      else if (st.vista === 'sg-novo') h = podeManter() ? formSgNovoHtml() : subagrupadoresHtml();
      else if (st.vista === 'sg-renomear') h = podeManter() ? formSgRenomearHtml() : subagrupadorHtml();
      else if (st.vista === 'sg-encerrar') h = podeManter() ? formSgEncerrarHtml() : subagrupadorHtml();
      else h = listaHtml();
      /* painel claro, na linguagem do Mapa da Floresta: texto escuro sobre fundo claro (o fundo estrelado fica na margem) */
      wrap.innerHTML = '<div class="est-tela est-painel" data-vista="' + st.vista + '">' + h + '</div>';
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
      /* Etapa 5 */
      em('estAbaEstruturas', 'click', function () { if (st.vista !== 'lista') irPara('lista'); });
      em('estAbaSubagrupadores', 'click', function () { if (st.vista !== 'subagrupadores') irPara('subagrupadores'); });
      em('sgNovo', 'click', function () { irPara('sg-novo'); });
      em('sgMostrarEncerrados', 'change', function (ev) { st.mostrarSgEncerrados = ev.target.checked; render(); });
      em('sgVoltarLista', 'click', function () { if (confirmarDescarte()) irPara('subagrupadores'); });
      em('sgVoltarFicha', 'click', function () { if (confirmarDescarte()) irPara('subagrupador', st.id); });
      em('sgCancelar', 'click', function () { if (!confirmarDescarte()) return; if (st.vista === 'sg-novo') irPara('subagrupadores'); else irPara('subagrupador', st.id); });
      em('sgRenomear', 'click', function () { irPara('sg-renomear', st.id); });
      em('sgEncerrar', 'click', function () { irPara('sg-encerrar', st.id); });
      Array.prototype.forEach.call(wrap.querySelectorAll('.sg-item'), function (b) { b.addEventListener('click', function () { irPara('subagrupador', b.getAttribute('data-subagrupador')); }); });
      Array.prototype.forEach.call(wrap.querySelectorAll('.sg-subir'), function (b) { b.addEventListener('click', function () { mover(b.getAttribute('data-subagrupador'), -1); }); });
      Array.prototype.forEach.call(wrap.querySelectorAll('.sg-descer'), function (b) { b.addEventListener('click', function () { mover(b.getAttribute('data-subagrupador'), 1); }); });
      em('sgForm', 'submit', function (ev) {
        ev.preventDefault();
        var f = st.form, id = st.id;
        if (st.vista === 'sg-novo') salvar('criarSubagrupador', { nome: f.nome }, 'subagrupador', function (novoId) { irPara('subagrupador', novoId); st.flash = { texto: 'Subagrupador criado. Ele já aparece no bloco Linhas de Negócios do Mapa; associe Linhas a ele na ficha de cada Linha.' }; render(); });
        else if (st.vista === 'sg-renomear') salvar('alterarSubagrupador', { id: id, alteracoes: { nome: f.nome }, justificativa: f.justificativa, revisaoEsperada: f.revisao }, 'subagrupador', function () { irPara('subagrupador', id); st.flash = { texto: 'Nome alterado.' }; render(); });
        else if (st.vista === 'sg-encerrar') salvar('encerrarSubagrupador', { id: id, motivo: f.motivo, revisaoEsperada: f.revisao }, 'subagrupador', function () { irPara('subagrupador', id); st.flash = { texto: 'Subagrupador encerrado. As Linhas que estavam nele aparecem em "Sem subagrupador" no Mapa; o histórico continua aqui.' }; render(); });
      });
      var esc2 = byId('estSgEscolha'); if (esc2) esc2.addEventListener('change', function () { st.assoc.subagrupadorId = esc2.value; });
      var jus = byId('estSgJustificativa'); if (jus) jus.addEventListener('input', function () { st.assoc.justificativa = jus.value; });
      em('estSgAssociar', 'click', function () {
        var e = st.estruturas[st.id], sit = N().subagrupadorDaLinha(estadoSg(), st.id), alvo = st.assoc.subagrupadorId, idE = st.id;
        if (!alvo) { st.contextoErro = 'associacao'; st.erros = [{ codigo: 'CAMPO_OBRIGATORIO', campo: 'subagrupador' }]; render(); return; }
        var depois = function () { irPara('detalhe', idE); st.flash = { texto: e.nome + ' agora aparece no subagrupador "' + nomeSg(alvo) + '" do Mapa.' }; render(); };
        if (sit.associacao) salvar('substituirAssociacao', { associacaoId: sit.associacao.id, subagrupadorId: alvo, justificativa: st.assoc.justificativa }, 'associacao', depois);
        else salvar('associarLinha', { estruturaId: idE, subagrupadorId: alvo, justificativa: st.assoc.justificativa }, 'associacao', depois);
      });
      em('estSgTirar', 'click', function () {
        var sit = N().subagrupadorDaLinha(estadoSg(), st.id), idE = st.id, e = st.estruturas[idE];
        if (!sit.associacao || !window.confirm('Tirar "' + e.nome + '" do subagrupador? Ela passa a aparecer em "Sem subagrupador" no Mapa. A associação fica no histórico.')) return;
        salvar('desassociarLinha', { associacaoId: sit.associacao.id, justificativa: st.assoc.justificativa }, 'associacao', function () { irPara('detalhe', idE); st.flash = { texto: e.nome + ' saiu do subagrupador e aparece em "Sem subagrupador" no Mapa.' }; render(); });
      });
      /* M6/M7: relações */
      /* a confirmação é de UMA ação: abrir outro formulário a tira da tela */
      var abrirRel = function (modo, relacaoId) { st.rel = { modo: modo, relacaoId: relacaoId || null, escolha: '', motivo: '', justificativa: '' }; st.erros = []; st.contextoErro = null; st.op = null; st.flash = null; if (modo !== 'encerrar' && st.refs === undefined) lerRefs(); render(); };
      em('estRelNova', 'click', function () { abrirRel('nova'); });
      Array.prototype.forEach.call(wrap.querySelectorAll('.est-rel-trocar'), function (b) { b.addEventListener('click', function () { abrirRel('trocar', b.getAttribute('data-relacao')); }); });
      Array.prototype.forEach.call(wrap.querySelectorAll('.est-rel-encerrar'), function (b) { b.addEventListener('click', function () { abrirRel('encerrar', b.getAttribute('data-relacao')); }); });
      em('estRelCancelar', 'click', function () { st.rel = null; st.erros = []; st.contextoErro = null; st.op = null; render(); });
      [['estRelEscolha', 'escolha', 'change'], ['estRelMotivo', 'motivo', 'input'], ['estRelJustificativa', 'justificativa', 'input']].forEach(function (x) { em(x[0], x[2], function (ev) { if (st.rel) st.rel[x[1]] = ev.target.value; }); });
      em('estRelSalvar', 'click', function () {
        var sr = st.rel, idE = st.id, depois = function (texto) { return function () { irPara('detalhe', idE); st.flash = { texto: texto }; render(); }; };
        if (!sr) return;
        if (sr.modo === 'nova') {
          var p = (sr.escolha || '').split('|');
          if (!sr.escolha) { st.contextoErro = 'relacao'; st.erros = [{ codigo: 'CAMPO_OBRIGATORIO', campo: 'relacao' }]; render(); return; }
          salvar('criarRelacao', { origem: idE, tipo: p[0], destino: p[1], justificativa: sr.justificativa }, 'relacao', depois('Relação registrada.'));
        } else if (sr.modo === 'trocar') {
          if (!sr.escolha) { st.contextoErro = 'relacao'; st.erros = [{ codigo: 'CAMPO_OBRIGATORIO', campo: 'relacao' }]; render(); return; }
          salvar('alterarRelacao', { relacaoId: sr.relacaoId, novos: { destino: sr.escolha, justificativa: sr.justificativa }, motivo: sr.motivo }, 'relacao', depois('Squad trocado de Linha. A composição anterior continua registrada, encerrada.'));
        } else salvar('encerrarRelacao', { relacaoId: sr.relacaoId, motivo: sr.motivo }, 'relacao', depois('Relação encerrada. Ela continua registrada.'));
      });
      Array.prototype.forEach.call(wrap.querySelectorAll('.est-item'), function (b) { b.addEventListener('click', function () { irPara('detalhe', b.getAttribute('data-estrutura')); }); });
      Array.prototype.forEach.call(wrap.querySelectorAll('[data-campo]'), function (el) {
        if (el.closest('#estSubagrupador')) return; /* a justificativa da associação tem tratamento próprio (st.assoc), fora dos formulários */
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
      var id = idDoEndereco(), sg = sgDoEndereco();
      st.vista = sg ? (sg === 'lista' ? 'subagrupadores' : 'subagrupador') : id ? 'detalhe' : 'lista'; st.id = sg && sg !== 'lista' ? sg : id || null;
      st.form = null; st.erros = []; st.flash = null; st.sujo = false; st.assoc = st.vista === 'detalhe' ? { subagrupadorId: '', justificativa: '' } : null;
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
    /* recarregar ou fechar a página no meio de uma edição: o navegador pergunta antes (o endereço já guarda a estrutura) */
    window.addEventListener('beforeunload', function (ev) { if (!wrap.hidden && st.sujo) { ev.preventDefault(); ev.returnValue = ''; } });
    ['fa-admin-ready', 'fa-avaliacao-ready'].forEach(function (ev) { window.addEventListener(ev, function () { if (!wrap.hidden) render(); }); });

    return { abrir: abrir, fechar: fechar, disponivel: disponivel, temAlteracaoNaoSalva: function () { return !wrap.hidden && !!st.sujo; } };
  }

  /* ============================================================
     M3 do Mapa — bloco "Estrutura responsável" na ficha do Posicionamento (decisão G)
     A ficha do Posicionamento só reserva o lugar e entrega { itemId, posicionamento } (ela não fala com o Firebase —
     B1); aqui ficam a leitura, a decisão (núcleo, pelo caso de uso compartilhado) e a gravação (adaptador; o banco
     confere tudo de novo). Manter = admin geral e avaliacao-arquitetura; avaliacao só consulta. Situação calculada
     pelo núcleo (situacaoResponsavel) — nada muda sozinho. Como o cadastro, só existe no AMBIENTE DE TESTES.
     ============================================================ */
  var SITUACAO_VINCULO = { valido: 'Válido', 'precisa-revisao': 'Precisa de revisão', ausente: 'Sem estrutura responsável', 'nao-aplicavel': 'Não se aplica' };
  var MOTIVO_REVISAO = {
    CODIGO_EFETIVO_MUDOU: 'o posicionamento efetivo do item mudou desde o vínculo',
    POSICIONAMENTO_DEIXOU_DE_VALER: 'o item não tem mais Posicionamento vigente',
    POSICIONAMENTO_SEM_CODIGO_FIRME: 'o Posicionamento vigente não tem mais um posicionamento firme (decisão final ou recomendação firme)',
    ESTRUTURA_ENCERRADA: 'a estrutura responsável foi encerrada',
    TIPO_NAO_CORRESPONDE: 'o tipo da estrutura não corresponde mais ao posicionamento efetivo'
  };
  function mensagemVinculo(e) {
    switch (e && e.codigo) {
      case 'RESPONSAVEL_PRINCIPAL_JA_EXISTE': return 'Este item já tem uma estrutura responsável principal ativa. Use "Substituir" ou encerre a atual.';
      case 'SEM_POSICIONAMENTO_EFETIVO': return 'O item não tem posicionamento efetivo firme (decisão final ou recomendação firme): o vínculo não pode ser registrado.';
      case 'LIGACAO_OFICIAL_AUSENTE': return 'A ligação oficial entre o código do Posicionamento e o conceito da Taxonomia não está registrada.';
      case 'TIPO_INCOMPATIVEL': return 'A estrutura escolhida não é do tipo do posicionamento efetivo do item.';
      case 'ESTRUTURA_ENCERRADA': return 'A estrutura escolhida está encerrada.';
      case 'ESTRUTURA_INEXISTENTE': case 'CAMPO_OBRIGATORIO': return 'Escolha a estrutura responsável.';
      case 'VINCULO_INEXISTENTE': return 'Este vínculo não foi encontrado.';
      case 'VINCULO_ENCERRADO': return 'Este vínculo já foi encerrado.';
      case 'MOTIVO_OBRIGATORIO': return 'Informe o motivo.';
      case 'CONFLITO_DE_REVISAO': return 'Outra pessoa mudou a estrutura responsável deste item enquanto você trabalhava. O bloco já mostra a situação atual: confira e faça de novo, se ainda for o caso.';
      case 'RECUSADA': return 'O banco recusou a gravação. Seu perfil pode não ter permissão para manter vínculos, ou os dados mudaram. Nada foi gravado.';
      default: return mensagem(e);
    }
  }
  /* ligações oficiais (código do motor → conceito): undefined = lendo; null = não foi possível ler (o perfil avaliacao
     não lê) — aí a situação é calculada sem conferir o tipo ("não sei" nunca vira "tipo não corresponde") */
  var ligacoesLidas, lendoLigacoes = false, aoLerLigacoes = [], geracaoLigacoes = 0;
  function lerLigacoes(cb) {
    if (ligacoesLidas !== undefined) { cb(); return; }
    aoLerLigacoes.push(cb);
    if (lendoLigacoes || !disponivel()) return;
    lendoLigacoes = true;
    var g = geracaoLigacoes;
    FB().lerLigacoes(window.firebase.database(), MOT().CODIGOS_FIRMES).then(function (l) {
      if (g !== geracaoLigacoes) return; /* resposta da sessão anterior */
      ligacoesLidas = l; lendoLigacoes = false; var fs = aoLerLigacoes; aoLerLigacoes = []; fs.forEach(function (f) { f(); });
    });
  }
  function refsDaTela() { var r = { codigosFirmes: MOT().CODIGOS_FIRMES.slice() }; if (ligacoesLidas) r.ligacoes = ligacoesLidas; return r; }
  /* a situação do vínculo (etiqueta + motivos de revisão), igual na ficha, no bloco e no Mapa */
  function situacaoVinculoHtml(s) {
    var h = ' <span class="est-situacao po-resp-situacao po-resp-situacao--' + esc(s.situacao) + '" data-situacao="' + esc(s.situacao) + '">' + esc(SITUACAO_VINCULO[s.situacao] || s.situacao) + '</span>';
    if (s.situacao === 'precisa-revisao') h += ' <span class="po-resp-motivos">' + s.motivos.map(function (m) { return esc(MOTIVO_REVISAO[m] || m); }).join('; ') + '</span>';
    return h;
  }
  var bloco = { itemId: null, el: null, posicionamento: null, estruturas: undefined, vinculos: undefined, refs: undefined, erroLeitura: null,
    modo: null, form: null, salvando: false, erros: [], op: null, flash: null, ligado: false, offset: 0 };
  function blocoDb() { return window.firebase.database(); }
  function ligarBloco() {
    if (bloco.ligado || !disponivel()) return;
    bloco.ligado = true;
    bloco.desligar = FB().ouvir(blocoDb(), ['registros', 'vinculos'], function (m) {
      if (m.estruturas) bloco.estruturas = m.estruturas;
      if (m.vinculos) bloco.vinculos = m.vinculos;
      bloco.erroLeitura = null; desenharBloco();
    }, function (c) { bloco.erroLeitura = c; desenharBloco(); });
    blocoDb().ref('.info/serverTimeOffset').on('value', function (s) { bloco.offset = s.val() || 0; });
    lerLigacoes(function () { bloco.refs = ligacoesLidas; desenharBloco(); });
  }
  function refsBloco() { return refsDaTela(); }
  function rotuloEstrutura(e) { return e ? esc(e.nome) + ' <span class="est-sigla">' + esc(natureza(e.tipo)) + ' · ' + esc(nomeTipo(e.tipo)) + '</span>' : '<span class="est-vazio">estrutura não encontrada</span>'; }
  function htmlBloco() {
    if (bloco.erroLeitura) return '<div class="avp-error-msg" role="alert">' + (bloco.erroLeitura === 'RECUSADA' ? 'Seu acesso não permite consultar a estrutura responsável.' : 'Não foi possível ler a estrutura responsável agora. Verifique se o ambiente de testes está aberto.') + '</div>';
    if (bloco.estruturas === undefined || bloco.vinculos === undefined || bloco.refs === undefined) return '<p class="loading-msg" role="status">Carregando a estrutura responsável…</p>';
    var estado = { estruturas: bloco.estruturas, vinculos: bloco.vinculos }, ref = refsBloco();
    var s = N().situacaoResponsavel(estado, bloco.itemId, bloco.posicionamento, ref), v = s.vinculo, ef = s.efetivo, manter = podeManter();
    var h = '<p class="avp-decisao-aviso est-ambiente" role="note"><strong>Ambiente de testes.</strong> O vínculo fica só no Firebase Emulator.</p>';
    if (bloco.flash) h += '<p class="avp-flash-success" id="poRespFlash" tabindex="-1">' + esc(bloco.flash) + '</p>';
    h += '<dl class="est-dados" id="poRespDados">' +
      '<div class="est-dado"><dt>Situação</dt><dd><span class="est-situacao po-resp-situacao po-resp-situacao--' + esc(s.situacao) + '" id="poRespSituacao" data-situacao="' + esc(s.situacao) + '">' + esc(SITUACAO_VINCULO[s.situacao] || s.situacao) + '</span></dd></div>';
    if (v) {
      var est = bloco.estruturas[v.estruturaId];
      h += '<div class="est-dado"><dt>Estrutura responsável principal</dt><dd id="poRespEstrutura">' + rotuloEstrutura(est) + '</dd></div>' +
        '<div class="est-dado"><dt>Base do vínculo</dt><dd>' + esc(nomeTipo(v.base.codigo)) + ' · ' + (v.base.origem === 'decisao' ? 'decisão final' : 'recomendação automática') + '</dd></div>' +
        '<div class="est-dado"><dt>Registrado</dt><dd><span class="est-quando">' + dataHora(v.criadoEm) + '</span><span class="est-autor">' + quem(v.criadoPor) + '</span></dd></div>' +
        (v.justificativa ? '<div class="est-dado est-dado--largo"><dt>Justificativa</dt><dd>' + esc(v.justificativa) + '</dd></div>' : '');
    }
    h += '</dl>';
    if (s.situacao === 'precisa-revisao') h += '<p class="avp-decisao-aviso po-resp-revisao" id="poRespRevisao" role="status"><strong>Precisa de revisão:</strong> ' + s.motivos.map(function (m) { return esc(MOTIVO_REVISAO[m] || m); }).join('; ') + '. O vínculo continua registrado até alguém substituí-lo ou encerrá-lo.</p>';
    if (v && bloco.avisoBase) h += '<p class="avp-decisao-aviso po-resp-base" id="poRespBase" role="status"><strong>Aviso:</strong> ' + esc(bloco.avisoBase) + ' Isso não muda a situação do vínculo; confira o Posicionamento.</p>';
    if (s.situacao === 'ausente') h += '<p class="est-intro" id="poRespAusente">Nenhuma estrutura responsável registrada. O posicionamento efetivo do item é ' + esc(nomeTipo(ef.codigo)) + ' (' + (ef.origem === 'decisao' ? 'decisão final' : 'recomendação automática') + ').</p>';
    if (s.situacao === 'nao-aplicavel') h += '<p class="est-intro" id="poRespNaoAplicavel">O item não tem posicionamento efetivo firme (decisão final ou recomendação firme): ainda não cabe registrar a estrutura responsável.</p>';
    if (bloco.erros.length) h += '<div class="avp-error-msg est-erros" id="poRespErros" role="alert" tabindex="-1"><strong>Não foi salvo.</strong><ul>' + bloco.erros.map(function (e) { return '<li>' + esc(mensagemVinculo(e)) + '</li>'; }).join('') + '</ul></div>';
    if (!manter) return h;
    var tipo = ef.codigo && ref.ligacoes ? ref.ligacoes[ef.codigo] : null;
    var opcoes = tipo ? Object.keys(bloco.estruturas).map(function (k) { return bloco.estruturas[k]; }).filter(function (e) { return e.situacao === 'ativa' && e.tipo === tipo && (!v || e.id !== v.estruturaId); })
      .sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome), 'pt-BR'); }) : [];
    var f = bloco.form || {};
    if (bloco.modo === 'vincular' || bloco.modo === 'substituir') {
      h += '<form class="est-form po-resp-form" id="poRespForm" novalidate><h5 class="est-secao-titulo">' + (bloco.modo === 'vincular' ? 'Vincular estrutura responsável' : 'Substituir a estrutura responsável') + '</h5>';
      if (!opcoes.length) h += '<p class="admin-empty" id="poRespSemOpcoes">Nenhuma estrutura ativa do tipo ' + esc(nomeTipo(tipo)) + (v ? ' além da atual' : '') + ' está cadastrada. Cadastre-a em Estruturas Organizacionais.</p>';
      else h += '<div class="avp-field est-campo"><label for="poRespEstruturaSel">Estrutura (' + esc(nomeTipo(tipo)) + ') <span class="est-obrig">(obrigatório)</span></label><select id="poRespEstruturaSel"><option value="">Escolha…</option>' +
        opcoes.map(function (e) { return '<option value="' + esc(e.id) + '"' + (f.estruturaId === e.id ? ' selected' : '') + '>' + esc(e.nome) + (e.sigla ? ' (' + esc(e.sigla) + ')' : '') + '</option>'; }).join('') + '</select></div>';
      if (bloco.modo === 'substituir') h += '<div class="avp-field est-campo"><label for="poRespMotivo">Motivo da substituição <span class="est-obrig">(obrigatório)</span></label><textarea id="poRespMotivo" maxlength="' + N().MAX.motivo + '" rows="2">' + esc(f.motivo || '') + '</textarea></div>';
      h += '<div class="avp-field est-campo"><label for="poRespJustificativa">Justificativa <span class="est-opc">(opcional)</span></label><textarea id="poRespJustificativa" maxlength="' + N().MAX.justificativa + '" rows="2">' + esc(f.justificativa || '') + '</textarea></div>' +
        '<div class="avp-actions-footer"><button type="submit" class="btn btn--primary" id="poRespSalvar"' + (bloco.salvando || !opcoes.length ? ' disabled' : '') + '>' + (bloco.salvando ? 'Salvando…' : 'Salvar') + '</button><button type="button" class="btn" id="poRespCancelar">Cancelar</button></div></form>';
      return h;
    }
    if (bloco.modo === 'encerrar') {
      return h + '<form class="est-form po-resp-form" id="poRespForm" novalidate><h5 class="est-secao-titulo">Encerrar o vínculo</h5><p class="est-intro">O item fica sem estrutura responsável; o vínculo encerrado continua registrado.</p>' +
        '<div class="avp-field est-campo"><label for="poRespMotivo">Motivo do encerramento <span class="est-obrig">(obrigatório)</span></label><textarea id="poRespMotivo" maxlength="' + N().MAX.motivo + '" rows="2">' + esc(f.motivo || '') + '</textarea></div>' +
        '<div class="avp-actions-footer"><button type="submit" class="btn btn--primary" id="poRespSalvar"' + (bloco.salvando ? ' disabled' : '') + '>' + (bloco.salvando ? 'Salvando…' : 'Encerrar vínculo') + '</button><button type="button" class="btn" id="poRespCancelar">Cancelar</button></div></form>';
    }
    h += '<div class="avp-actions-footer po-resp-acoes">';
    if (s.situacao === 'ausente') h += '<button type="button" class="btn btn--primary" id="poRespVincular">Vincular estrutura responsável</button>';
    if (v && ef.codigo) h += '<button type="button" class="btn" id="poRespSubstituir">Substituir</button>';
    if (v) h += '<button type="button" class="btn" id="poRespEncerrar">Encerrar vínculo</button>';
    return h + '</div>';
  }
  function desenharBloco() {
    var el = bloco.el;
    if (!el || !el.isConnected) return;
    el.innerHTML = htmlBloco();
    var q = function (id) { return el.querySelector('#' + id); };
    var abrirModo = function (modo) { bloco.modo = modo; bloco.form = { estruturaId: '', motivo: '', justificativa: '' }; bloco.erros = []; bloco.flash = null; bloco.op = null; desenharBloco(); };
    [['poRespVincular', 'vincular'], ['poRespSubstituir', 'substituir'], ['poRespEncerrar', 'encerrar']].forEach(function (b) { var x = q(b[0]); if (x) x.addEventListener('click', function () { abrirModo(b[1]); }); });
    var c = q('poRespCancelar'); if (c) c.addEventListener('click', function () { bloco.modo = null; bloco.form = null; bloco.erros = []; bloco.op = null; desenharBloco(); });
    [['poRespEstruturaSel', 'estruturaId', 'change'], ['poRespMotivo', 'motivo', 'input'], ['poRespJustificativa', 'justificativa', 'input']].forEach(function (b) {
      var x = q(b[0]); if (x) x.addEventListener(b[2], function () { bloco.form[b[1]] = x.value; });
    });
    var form = q('poRespForm');
    if (form) form.addEventListener('submit', function (ev) { ev.preventDefault(); salvarBloco(); });
  }
  function salvarBloco() {
    if (bloco.salvando) return;
    var u = window.firebase.auth().currentUser;
    if (!u) { bloco.erros = [{ codigo: 'CONTEXTO_SEM_USUARIO' }]; desenharBloco(); return; }
    var estado = { estruturas: bloco.estruturas, vinculos: bloco.vinculos };
    var v = N().responsavelAtivo(estado, bloco.itemId), f = bloco.form || {}, modo = bloco.modo, operacao, entrada;
    if (modo === 'vincular') { operacao = 'vincularResponsavel'; entrada = { objetoId: bloco.itemId, estruturaId: f.estruturaId, justificativa: f.justificativa }; }
    else if (modo === 'substituir') { operacao = 'substituirResponsavel'; entrada = { vinculoId: v && v.id, estruturaId: f.estruturaId, motivo: f.motivo, justificativa: f.justificativa }; }
    else { operacao = 'encerrarVinculo'; entrada = { vinculoId: v && v.id, motivo: f.motivo }; }
    /* a MESMA tentativa reaproveita o identificador da operação: reenviar depois de "sem resposta" não duplica */
    bloco.op = bloco.op || { operacaoId: blocoDb().ref().push().key, novoId: blocoDb().ref().push().key };
    var ctx = { operacaoId: bloco.op.operacaoId, usuario: { id: u.uid, email: u.email }, agora: Date.now() + bloco.offset };
    if (modo !== 'encerrar') ctx.novoId = bloco.op.novoId;
    bloco.salvando = true; bloco.erros = []; desenharBloco();
    U().criar({ nucleo: N(), codigosFirmes: MOT().CODIGOS_FIRMES }).executar(operacao, entrada, ctx, FB().criarPortas({ db: blocoDb(), codigosFirmes: MOT().CODIGOS_FIRMES })).then(function (r) {
      bloco.salvando = false;
      if (r.ok) {
        bloco.op = null; bloco.modo = null; bloco.form = null;
        bloco.flash = modo === 'vincular' ? 'Estrutura responsável registrada.' : modo === 'substituir' ? 'Estrutura responsável substituída. O vínculo anterior continua registrado, encerrado.' : 'Vínculo encerrado. Ele continua registrado.';
        desenharBloco(); var fl = bloco.el && bloco.el.querySelector('#poRespFlash'); if (fl) fl.focus({ preventScroll: true });
        return;
      }
      if (!r.erros.some(function (e) { return e.codigo === 'SEM_RESPOSTA' || e.codigo === 'GRAVACAO_NAO_CONFIRMADA'; })) bloco.op = null;
      bloco.erros = r.erros; desenharBloco();
      var al = bloco.el && bloco.el.querySelector('#poRespErros'); if (al) al.focus({ preventScroll: true });
    }, function (e) { bloco.salvando = false; bloco.erros = [{ codigo: (e && e.codigo) || 'RECUSADA' }]; desenharBloco(); });
  }
  /* chamado pela ficha do Posicionamento a cada desenho: el = o lugar reservado; dados = { itemId, posicionamento } */
  function montarResponsavel(el, dados) {
    if (!el || !disponivel()) return;
    if (bloco.itemId !== dados.itemId) { bloco.itemId = dados.itemId; bloco.modo = null; bloco.form = null; bloco.erros = []; bloco.op = null; bloco.flash = null; }
    bloco.el = el; bloco.posicionamento = dados.posicionamento || null; bloco.avisoBase = dados.avisoBase || null;
    ligarBloco();
    if (P()) P().iniciar();
    desenharBloco();
  }
  /* troca de pessoa: nada do estado anterior sobrevive; a leitura recomeça com a sessão nova no próximo desenho */
  window.addEventListener('fa-auth-change', function () {
    if (bloco.desligar) bloco.desligar();
    ligacoesLidas = undefined; lendoLigacoes = false; aoLerLigacoes = []; geracaoLigacoes++;
    taxRel = undefined; lendoTaxRel = false; aoLerTaxRel = []; geracaoTaxRel++; /* outro perfil pode ler outras coisas */
    bloco.desligar = null; bloco.ligado = false; bloco.estruturas = undefined; bloco.vinculos = undefined; bloco.refs = undefined; bloco.erroLeitura = null;
    bloco.modo = null; bloco.form = null; bloco.erros = []; bloco.op = null; bloco.flash = null;
  });


  /* o contêiner está no index.html antes deste arquivo; disponivel() é false fora do ambiente de testes */
  var api = null;
  function garantir() { if (!api) api = montar(); return api; }
  window.faEstruturasAdmin = {
    disponivel: disponivel,
    abrir: function (o) { var a = garantir(); if (a) a.abrir(o); },
    fechar: function () { if (api) api.fechar(); },
    temAlteracaoNaoSalva: function () { return !!(api && api.temAlteracaoNaoSalva()); },
    /* M3: bloco Estrutura responsável na ficha do Posicionamento */
    montarResponsavel: montarResponsavel,
    /* M4: o Mapa e o Catálogo mostram a situação do vínculo com os mesmos textos e as mesmas ligações */
    situacaoVinculoHtml: situacaoVinculoHtml,
    lerLigacoes: function (cb) { lerLigacoes(function () { cb(refsDaTela()); }); },
    /* M6/M7: o rótulo de cada tipo de relação (o Mapa mostra as relações só para consulta) */
    rotuloRelacao: function (tipo) { return ROTULO_RELACAO[tipo] || tipo; }
  };
})();
