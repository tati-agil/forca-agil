/* ============================================================
   Força Ágil — CATÁLOGO PREPARATÓRIO DO MAPA DA FLORESTA (window.faMapaFloresta) — 1º incremento

   O que é: uma tela SÓ DE CONSULTA, dentro de #avaliacoes, que prepara o Mapa da Floresta com o que já existe
   gravado — as três categorias organizacionais (Linha com as suas especializações, Área Especializada, CoE) e o
   catálogo dos objetos avaliados com a PENDÊNCIA de cada um. Não é o Mapa visual.

   O que NÃO faz (decisão da responsável, 2026-10-11):
     - não grava nada (nenhuma escrita no banco, nenhuma regra nova);
     - não mostra estruturas concretas nem associações objeto × estrutura responsável: ainda não há fonte
       operacional delas no site. Isso é INFORMAÇÃO INDISPONÍVEL, nunca "nenhuma estrutura" nem "sem responsável" —
       por isso o núcleo de Estruturas é usado só no que não depende delas (posicionamentoEfetivo), e nunca recebe
       coleções vazias para concluir que um objeto não tem responsável;
     - não cria motor M1–M5, perguntas de Presença no Mapa nem estrutura a partir de resultado automático.

   Fontes (todas já existentes, só lidas — nenhuma regra repetida aqui):
     faBaseProdutoServico.baseDoItem  qual Avaliação de Produto/Serviço vale para o item (a ponta da cadeia)
     faAvaliacaoPosicionamentoNucleo.gateDoItem  o gate P1–P16 → O1–O9 (ponta válida + Motor atual)
     faEstruturasNucleo.posicionamentoEfetivo    decisão final; senão recomendação FIRME; A_VALIDAR sem decisão não é base
     faMotorPosicionamentoNucleo     os códigos firmes e o invariante Linha × Squad (liberaSquadParaCodigoFirme)
     faPosicionamentos               nome atual de cada código na Taxonomia Organizacional (contingência sinalizada)

   Banco (leitura, os três perfis da Avaliação já leem): avaliacoes-produto, avaliacoes-posicionamento,
   posicionamento-vigente-por-item, posicionamento-decisoes — pela interface de serviços (faServicosPosicionamento).

   Endereço: #avaliacoes?mf=catalogo (F5, link direto, Voltar/Avançar).

   MAPA VISUAL — versão DEMONSTRATIVA (#avaliacoes?mf=mapa, detalhe em &e=<id>), no desenho aprovado: blocos de cima
   para baixo (Estratégia de Clientes, Canais, Negócios com subagrupadores, Plataformas Habilitadoras, Áreas
   Especializadas por último) e a coluna de CoEs à direita; cada caixa pequena é uma estrutura concreta clicável; o
   detalhe mostra a estrutura e os produtos/serviços sob a responsabilidade dela (nunca como caixas do Mapa). Os dados vêm de mapa-floresta-demo.js —
   exemplos FICTÍCIOS em memória, com faixa de aviso fixa — lidos pelas consultas puras do núcleo de Estruturas
   (estruturasDoTipo, objetosDaEstrutura); nada é gravado nem lido do banco além dos nomes oficiais da Taxonomia.
   ============================================================ */
(function () {
  'use strict';
  var PROD = 'avaliacoes-produto', NODE = 'avaliacoes-posicionamento', VIG = 'posicionamento-vigente-por-item', DEC = 'posicionamento-decisoes';
  var TEMPO_DEMORA = 12000;

  /* ===================== NÚCLEO DO CATÁLOGO (puro: sem DOM, sem banco) ===================== */
  /* Situações de um objeto no catálogo, em ordem de avanço. 'verificando' = a resposta ainda não pode ser dada
     (o motor de P1–P16 não carregou): não é pendência nem avanço. */
  var SITUACOES = ['sem-base', 'sem-posicionamento', 'a-validar', 'firme'];
  var ROTULO_SITUACAO = {
    'sem-base': 'Sem Avaliação de Produto/Serviço válida ou atual',
    'sem-posicionamento': 'Sem Posicionamento Organizacional concluído',
    'a-validar': 'Posicionamento A VALIDAR sem decisão firme',
    firme: 'Posicionamento efetivo firme',
    verificando: 'Verificando…'
  };
  /* rótulo curto, para o filtro caber legível em 375 px; o completo fica na etiqueta de cada objeto */
  var ROTULO_CURTO = {
    'sem-base': 'Sem avaliação P1–P16 válida',
    'sem-posicionamento': 'Sem Posicionamento',
    'a-validar': 'A VALIDAR sem decisão',
    firme: 'Posicionamento firme',
    verificando: 'Verificando…'
  };

  /* As três categorias do Mapa, derivadas do motor (nada listado à mão): Linha = os códigos firmes que formam
     Squads (o ramo Linha, pela tabela fixa do invariante); Área Especializada e CoE = os que não formam. */
  function categorias(M) {
    var firmes = (M && M.CODIGOS_FIRMES) || [];
    var linha = firmes.filter(function (c) { return M.liberaSquadParaCodigoFirme(c) === true; });
    var cats = [{ id: 'LINHA', codigoNome: 'LINHA', codigos: linha, formaSquads: true }];
    firmes.filter(function (c) { return M.liberaSquadParaCodigoFirme(c) !== true; })
      .forEach(function (c) { cats.push({ id: c, codigoNome: c, codigos: [c], formaSquads: false }); });
    return cats;
  }
  function categoriaDoCodigo(cats, codigo) {
    for (var i = 0; i < cats.length; i++) if (cats[i].codigos.indexOf(codigo) !== -1) return cats[i].id;
    return null;
  }

  /* Um objeto do catálogo = um item (itemId agrupa as versões de P1–P16; nunca uma linha por versão).
     dados: { produtos, registros, vigentes, decisoes } — o que o banco devolveu.
     deps:  { B: faBaseProdutoServico, ctxMotor, gateDoItem, posicionamentoEfetivo, codigosFirmes, baseReprocessadaComImpacto? }.
     M5 (decisão E): baseRevisao = a base de P1–P16 do Posicionamento foi reprocessada depois da conclusão e mudou a
     classificação ou o resultado — sinal informativo, nada muda sozinho.
     Precedência: o Posicionamento gravado manda (vigente concluída → firme ou A VALIDAR); sem ele, o gate diz se
     o item já pode iniciar O1–O9 (sem-posicionamento) ou se falta uma Avaliação de Produto/Serviço válida e com
     Motor atual (sem-base). Quando há Posicionamento mas a base de P1–P16 mudou ou deixou de valer, isso aparece
     como ALERTA, sem esconder o Posicionamento que existe. */
  function situacaoDoItem(itemId, dados, deps) {
    var produtos = dados.produtos || {}, registros = dados.registros || {}, vigentes = dados.vigentes || {}, decisoes = dados.decisoes || {};
    var base = deps.B.baseDoItem(itemId, produtos);
    var gate = deps.gateDoItem(itemId, produtos, deps.B, deps.ctxMotor);
    var ponta = base.chave ? produtos[base.chave] : null;
    var r = { itemId: itemId, nome: nomeDoItem(itemId, produtos, ponta), chaveBase: base.chave || null, situacaoBase: base.situacao,
      statusBase: ponta ? ponta.status : null, gate: gate.situacao, situacao: null, motivo: null, posicionamento: null, efetivo: null, rascunhoId: null, alertaBase: null };
    /* rascunho de Posicionamento aberto do item (o mais novo), só como informação */
    Object.keys(registros).forEach(function (k) {
      var g = registros[k];
      if (g && g.itemId === itemId && g.status === 'rascunho' && (!r.rascunhoId || String(g.criadoEm || '') > String((registros[r.rascunhoId] || {}).criadoEm || ''))) r.rascunhoId = k;
    });
    var vid = vigentes[itemId], reg = vid ? registros[vid] : null;
    if (reg && reg.status === 'concluido' && reg.resultadoAutomatico) {
      var dec = decisoes[vid] || null, ra = reg.resultadoAutomatico;
      var p = { avaliacaoId: vid, recomendacao: { codigoResultado: ra.codigoResultado } };
      if (dec) p.decisao = { codigoFinal: dec.codigoFinal };
      var ef = deps.posicionamentoEfetivo(p, { codigosFirmes: deps.codigosFirmes });
      r.posicionamento = { avaliacaoId: vid, versao: reg.versao || 1, codigoAutomatico: ra.codigoResultado || null, tipoAValidar: ra.tipoAValidar || null,
        codigoDecisao: dec ? dec.codigoFinal : null, avaliacaoArquiteturalId: reg.avaliacaoArquiteturalId || null };
      var imp = deps.baseReprocessadaComImpacto ? deps.baseReprocessadaComImpacto(reg, produtos) : null;
      if (imp) r.baseRevisao = imp;
      if (ef.codigo) { r.situacao = 'firme'; r.efetivo = { codigo: ef.codigo, origem: ef.origem }; }
      else { r.situacao = 'a-validar'; r.motivo = ef.motivo; }
      if (gate.situacao !== 'verificando') {
        if (base.situacao !== 'valida') r.alertaBase = base.situacao;
        else if (gate.situacao !== 'atual') r.alertaBase = gate.situacao;
        else if (r.posicionamento.avaliacaoArquiteturalId && r.posicionamento.avaliacaoArquiteturalId !== base.chave) r.alertaBase = 'base-anterior';
      }
      return r;
    }
    if (gate.situacao === 'verificando') { r.situacao = 'verificando'; return r; }
    if (gate.libera) { r.situacao = 'sem-posicionamento'; return r; }
    r.situacao = 'sem-base'; r.motivo = gate.situacao;
    return r;
  }
  /* o nome que vale: o da ponta; sem ponta única (cadeia ambígua), o da versão mais alta */
  function nomeDoItem(itemId, produtos, ponta) {
    if (ponta && ponta.nome) return ponta.nome;
    var melhor = null;
    Object.keys(produtos).forEach(function (k) {
      var it = produtos[k];
      if (it && (it.itemId || k) === itemId && (!melhor || (it.versao || 1) > (melhor.versao || 1))) melhor = it;
    });
    return (melhor && melhor.nome) || itemId;
  }
  /* O catálogo inteiro: todos os itens que têm alguma Avaliação de Produto/Serviço, menos os que estão na Lixeira
     (a versão que vale está excluída — a mesma regra da lista de Produto/Serviço), em ordem de nome.
     Enquanto alguma das quatro leituras não chegou (undefined), não há catálogo: pronto = false. */
  function montarCatalogo(dados, deps) {
    if (!dados || dados.produtos === undefined || dados.registros === undefined || dados.vigentes === undefined || dados.decisoes === undefined) return { pronto: false, itens: [] };
    var ids = {};
    Object.keys(dados.produtos || {}).forEach(function (k) { var it = dados.produtos[k]; if (it) ids[it.itemId || k] = true; });
    var itens = Object.keys(ids)
      .filter(function (id) { return deps.B.baseDoItem(id, dados.produtos).situacao !== 'excluida'; })
      .map(function (id) { return situacaoDoItem(id, dados, deps); })
      .sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome), 'pt-BR') || (a.itemId < b.itemId ? -1 : 1); });
    return { pronto: true, itens: itens };
  }
  /* filtros: { situacao: '' | uma de SITUACOES | 'verificando', posicionamento: '' | id de categoria | código firme, busca } */
  function filtrar(itens, f, cats) {
    f = f || {};
    var busca = String(f.busca || '').trim().toLowerCase();
    return itens.filter(function (x) {
      if (f.situacao && x.situacao !== f.situacao) return false;
      if (f.posicionamento) {
        if (!x.efetivo) return false;
        if (x.efetivo.codigo !== f.posicionamento && categoriaDoCodigo(cats, x.efetivo.codigo) !== f.posicionamento) return false;
      }
      if (busca && String(x.nome).toLowerCase().indexOf(busca) === -1) return false;
      return true;
    });
  }
  function contarPorSituacao(itens) {
    var c = { verificando: 0 };
    SITUACOES.forEach(function (s) { c[s] = 0; });
    itens.forEach(function (x) { c[x.situacao] = (c[x.situacao] || 0) + 1; });
    return c;
  }

  window.faMapaFlorestaCatalogo = Object.freeze({
    SITUACOES: SITUACOES.slice(), ROTULO_SITUACAO: Object.freeze(Object.assign({}, ROTULO_SITUACAO)), ROTULO_CURTO: Object.freeze(Object.assign({}, ROTULO_CURTO)),
    categorias: categorias, categoriaDoCodigo: categoriaDoCodigo, situacaoDoItem: situacaoDoItem, montarCatalogo: montarCatalogo,
    filtrar: filtrar, contarPorSituacao: contarPorSituacao
  });
  if (typeof document === 'undefined') return;

  /* ===================== TELA ===================== */
  var C = window.faMapaFlorestaCatalogo;
  function S() { return window.faServicosPosicionamento; }
  /* o cadastro de estruturas só existe no ambiente de testes nesta etapa (window.faAmbiente, forca-agil/firebase.js) */
  function cadastroDisponivel() { return !!(window.faAmbiente && window.faAmbiente.testes && window.faEstruturasFirebase); }
  function P() { return window.faPosicionamentos; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function spanNome(c) { return P() ? P().spanNome(c, 'mf-nome') : esc(c); }
  /* definição oficial vigente do tipo (Taxonomia Organizacional, via faPosicionamentos): nunca texto próprio;
     sem definição, o próprio componente diz "Carregando…" ou "indisponível" */
  function definicaoTipoHtml(c) { return P() ? P().definicaoHtml(c, null, { comEstado: true, tag: 'span' }) : '<span class="fa-classif-def fa-classif-def--sem">Definição indisponível.</span>'; }
  function nomeTexto(c) { return P() ? P().nome(c) : c; }
  function podeLer() { return !!(window.faAuth && window.faAuth.podeAvaliacao && window.faAuth.podeAvaliacao()); }
  function autorizacaoResolvida() { return !!(window.faAuth && (!window.faAuth.isAvaliacaoReady || window.faAuth.isAvaliacaoReady())); }
  function sessaoEmail() { var s = window.faAuth && window.faAuth.getSession && window.faAuth.getSession(); return s && s.email ? String(s.email).toLowerCase() : null; }
  var TEXTO_ESTRUTURAS = 'O cadastro e a consulta delas serão disponibilizados em um incremento posterior. ' +
    'Até lá, este catálogo não mostra estruturas reais nem associações de objetos a estruturas responsáveis — o que não significa que elas não existam.';

  function montar() {
    var wrap = document.getElementById('avaliacoesMapa');
    if (!wrap || wrap._mfBound) return null;
    wrap._mfBound = true;
    function byId(id) { return wrap.querySelector('#' + id); }

    function novoEstado() { return {
      produtos: undefined, registros: undefined, vigentes: undefined, decisoes: undefined,
      erro: false, demorando: false, filtros: { situacao: '', posicionamento: '', busca: '' }, categoriasAbertas: null, posicionamentoAberto: null
    }; }
    var state = novoEstado();
    var modo = 'catalogo', selecionada = null; /* 'catalogo' | 'mapa'; selecionada = id da estrutura aberta no Mapa */
    var cenarioDemo = 'habitual'; /* cenário de demonstração do Mapa (mapa-floresta-demo.js): 'habitual' | 'populoso' */
    /* fonte do Mapa: 'cadastro' = estruturas cadastradas (só no AMBIENTE DE TESTES nesta etapa) | 'demo' = exemplos
       fictícios. As duas NUNCA se misturam: cada desenho usa uma só. Fora do ambiente de testes só existe 'demo'. */
    var fonte = cadastroDisponivel() ? 'cadastro' : 'demo';
    var cadastro = { estruturas: undefined, subagrupadores: undefined, associacoes: undefined, vinculos: undefined, refs: undefined, erro: null, desligar: null };

    /* ---- painel e identidade da página (como o Posicionamento e a Squad) ---- */
    var identidadeOriginal = null;
    function hero() { var s = wrap.closest('.page-section'); return s && s.querySelector('.page-hero'); }
    function trocarIdentidade(meu) {
      var h = hero();
      if (!h) return;
      var eyebrow = h.querySelector('.eyebrow'), h1 = h.querySelector('h1'), p = h.querySelector('p');
      if (meu && !identidadeOriginal) identidadeOriginal = { eyebrow: eyebrow ? eyebrow.textContent : '', h1: h1 ? h1.textContent : '', p: p ? p.textContent : '' };
      if (!meu && !identidadeOriginal) return;
      var t = !meu ? identidadeOriginal : modo === 'mapa'
        ? { eyebrow: 'Mapa da Floresta', h1: 'Mapa da Floresta', p: fonte === 'cadastro' ? 'As estruturas organizacionais concretas cadastradas: Linhas, Centros de Excelência e Áreas Especializadas.' : 'Demonstração com exemplos fictícios: as estruturas organizacionais e os produtos e serviços sob a responsabilidade de cada uma.' }
        : { eyebrow: 'Mapa da Floresta', h1: 'Catálogo preparatório do Mapa da Floresta', p: 'Os objetos avaliados e o que falta para cada um chegar ao Mapa. Ainda não é o Mapa visual.' };
      if (eyebrow) eyebrow.textContent = t.eyebrow;
      if (h1) h1.textContent = t.h1;
      if (p) p.textContent = t.p;
      h.classList.toggle('page-hero--mapa', !!meu);
      /* o Mapa é panorâmico: só nele a página usa a largura disponível e o cabeçalho fica compacto */
      var pagina = wrap.closest('.page-section'); if (pagina) pagina.classList.toggle('mf-mapa-largo', !!meu && modo === 'mapa');
    }
    function mostrarPainel() {
      ['avaliacoesPainel', 'avaliacoesSquad', 'avaliacoesPosicionamento'].forEach(function (id) { var el = document.getElementById(id); if (el) el.hidden = true; });
      wrap.hidden = false;
      trocarIdentidade(true);
    }
    function fecharPainel() {
      if (wrap.hidden) return;
      wrap.hidden = true;
      var v = document.getElementById('avaliacoesPainel'); if (v) v.hidden = false;
      trocarIdentidade(false);
    }

    /* ---- endereço ---- */
    function mfDoEndereco() {
      var h = location.hash || '';
      if (h.split('?')[0] !== '#avaliacoes') return null;
      var m = /[?&]mf=([^&]*)/.exec(h), e = /[?&]e=([^&]*)/.exec(h), cn = /[?&]cenario=([^&]*)/.exec(h), fo = /[?&]fonte=([^&]*)/.exec(h);
      return m ? { mf: decodeURIComponent(m[1]), e: e ? decodeURIComponent(e[1]) : null, cenario: cn ? decodeURIComponent(cn[1]) : null, fonte: fo ? decodeURIComponent(fo[1]) : null } : null;
    }
    function enderecoDesejado() {
      if (modo !== 'mapa') return '#avaliacoes?mf=catalogo';
      var deDemo = fonte === 'demo' && cadastroDisponivel();
      return '#avaliacoes?mf=mapa' + (deDemo ? '&fonte=demo' : '') + (fonte === 'demo' && cenarioDemo !== 'habitual' ? '&cenario=' + encodeURIComponent(cenarioDemo) : '') + (selecionada ? '&e=' + encodeURIComponent(selecionada) : '');
    }
    function sincronizarEndereco() {
      var desejado = enderecoDesejado();
      if (wrap.hidden || location.hash === desejado || (location.hash || '').split('?')[0] !== '#avaliacoes') return;
      /* avp:1 — a entrada é reconhecida por avaliacao-produto.js (que não a reescreve) */
      history.pushState({ avp: 1, seq: Date.now(), origem: null, mfAnterior: location.hash || '#avaliacoes' }, '', desejado);
    }
    function sairParaAvaliacoes() {
      var st = history.state;
      if (st && st.mfAnterior && st.mfAnterior.split('?')[0] === '#avaliacoes' && !/[?&](po|sq|mf)=/.test(st.mfAnterior)) { history.back(); return; }
      history.replaceState({ avp: 1, seq: Date.now(), origem: null }, '', '#avaliacoes');
      fecharPainel();
    }
    function aplicarEndereco() {
      var end = mfDoEndereco();
      if (end) {
        modo = end.mf === 'mapa' ? 'mapa' : 'catalogo';
        var DM = window.faMapaFlorestaDemo;
        cenarioDemo = DM && DM.CENARIOS && DM.CENARIOS.indexOf(end.cenario) !== -1 ? end.cenario : 'habitual';
        fonte = cadastroDisponivel() && end.fonte !== 'demo' ? 'cadastro' : 'demo';
        /* no cadastro a estrutura pode ainda estar chegando: a escolha fica, e o desenho confere quando os dados chegam */
        var D = dados();
        selecionada = modo === 'mapa' && end.e && (fonte === 'cadastro' || (D && D.estado.estruturas[end.e])) ? end.e : null;
      }
      mostrarPainel();
      if (modo === 'mapa') ligarNomes(); else ligar();
      render();
      sincronizarEndereco();
      /* outros ouvintes do mesmo evento podem rodar depois deste: reafirma o painel no fim da fila */
      setTimeout(function () { if (mfDoEndereco() && !wrap.hidden) mostrarPainel(); }, 0);
    }
    function irPara(novoModo, estruturaId) {
      modo = novoModo; selecionada = estruturaId || null;
      trocarIdentidade(true);
      if (modo === 'mapa') ligarNomes(); else ligar();
      render();
      sincronizarEndereco();
    }

    /* ---- dependências do núcleo ---- */
    function deps() {
      var B = window.faBaseProdutoServico;
      return { B: B, ctxMotor: B ? B.contextoMotorAtual() : null, gateDoItem: window.faAvaliacaoPosicionamentoNucleo.gateDoItem,
        posicionamentoEfetivo: window.faEstruturasNucleo.posicionamentoEfetivo, codigosFirmes: window.faMotorPosicionamentoNucleo.CODIGOS_FIRMES,
        baseReprocessadaComImpacto: window.faAvaliacaoPosicionamentoNucleo.baseReprocessadaComImpacto };
    }
    function modulosProntos() {
      return !!(window.faBaseProdutoServico && window.faAvaliacaoPosicionamentoNucleo && window.faEstruturasNucleo && window.faMotorPosicionamentoNucleo);
    }
    function cats() { return C.categorias(window.faMotorPosicionamentoNucleo); }

    /* ===================== RENDER ===================== */
    function render() {
      if (wrap.hidden) return;
      if (modo === 'mapa') { renderMapaTela(); return; }
      var ativo = document.activeElement, foco = null;
      if (ativo && ativo.id && wrap.contains(ativo) && /^(INPUT|SELECT)$/.test(ativo.tagName)) foco = { id: ativo.id, ini: ativo.selectionStart, fim: ativo.selectionEnd };
      var h = '<button type="button" class="avp-voltar-link" id="mfVoltar">← Voltar para Avaliações</button>';
      h += '<button type="button" class="btn btn--sm mf-ir-mapa" id="mfIrMapa">Ver o Mapa da Floresta (demonstração)</button>';
      h += '<div class="avp-form-card mf-card" id="mfCatalogo">' +
        '<p class="avp-intro">O Mapa da Floresta vai representar as estruturas organizacionais concretas de três categorias. Os produtos, serviços e demais objetos avaliados ' +
        'não viram nós do Mapa: aparecerão indiretamente, nos detalhes da estrutura responsável, quando essa associação for registrada. ' +
        'Este catálogo mostra, a partir das avaliações já gravadas, em que ponto cada objeto está. Nada aqui é gravado.</p>' +
        (cadastroDisponivel() ? '<div class="mf-aviso-estruturas" id="mfAvisoEstruturas" role="note"><strong>Ambiente de testes.</strong> As estruturas e os vínculos de estrutura responsável vêm do Firebase Emulator — não são dados do banco oficial.</div>'
          : '<div class="mf-aviso-estruturas" id="mfAvisoEstruturas" role="note"><strong>Estruturas Organizacionais Concretas: informação indisponível nesta versão.</strong> ' + esc(TEXTO_ESTRUTURAS) + '</div>');
      if (cadastroDisponivel() && podeLer()) ligarCadastro();
      if (!autorizacaoResolvida()) h += '<p class="loading-msg" role="status">Carregando…</p>';
      else if (!podeLer()) h += '<p class="avp-error-msg" id="mfSemAcesso">Este catálogo é consultado pelos perfis da Avaliação de Produto/Serviço (Avaliação, Avaliação + Configuração e administração geral). Seu acesso não inclui essa consulta.</p>';
      else if (state.erro) h += '<div class="mf-erro" id="mfErro" role="alert"><p class="avp-error-msg">Não foi possível ler as avaliações agora. Nada foi alterado.</p>' +
        '<button type="button" class="btn btn--sm" id="mfTentarDeNovo">Tentar de novo</button></div>';
      else {
        var cat = modulosProntos() ? C.montarCatalogo({ produtos: state.produtos, registros: state.registros, vigentes: state.vigentes, decisoes: state.decisoes }, deps()) : { pronto: false, itens: [] };
        if (!cat.pronto) {
          h += '<p class="loading-msg" id="mfCarregando" role="status">Carregando…</p>';
          if (state.demorando) h += '<div class="mf-erro" id="mfDemora"><p class="avp-error-msg">A leitura está demorando mais que o normal. A tela continua esperando.</p>' +
            '<button type="button" class="btn btn--sm" id="mfTentarDeNovo">Tentar de novo</button></div>';
        } else h += renderCategorias(cat.itens) + renderCatalogo(cat.itens);
      }
      h += '</div>';
      wrap.innerHTML = h;
      bind();
      if (P()) P().atualizarDom(wrap);
      if (foco) { var el = byId(foco.id); if (el) { el.focus(); try { if (foco.ini != null) el.setSelectionRange(foco.ini, foco.fim); } catch (e) { /* select sem seleção */ } } }
    }

    function renderCategorias(itens) {
      var cs = cats(), linha = cs.filter(function (c) { return c.id === 'LINHA'; })[0];
      if (state.categoriasAbertas === null) state.categoriasAbertas = !(window.matchMedia && window.matchMedia('(max-width: 720px)').matches);
      var resumo = cs.map(function (c) { return spanNome(c.codigoNome) + (c.id === 'LINHA' ? ' (' + linha.codigos.length + ' tipos firmes)' : ''); }).join(' · ');
      var h = '<details class="mf-secao mf-categorias-bloco" id="mfCategoriasBloco"' + (state.categoriasAbertas ? ' open' : '') + '>' +
        '<summary class="mf-categorias-resumo"><span class="mf-categorias-titulo" id="mfCategoriasTitulo">Categorias organizacionais do Mapa</span>' +
        '<span class="mf-categorias-lista" id="mfCategoriasResumo">' + resumo + '</span></summary>' +
        '<p class="mf-ajuda">Os tipos de estrutura vêm do Posicionamento Organizacional (O1–O9); os nomes, da Taxonomia Organizacional. A contagem é dos objetos cujo posicionamento efetivo está na categoria — não de estruturas.</p>' +
        '<ul class="mf-categorias" id="mfCategorias">';
      cs.forEach(function (c) {
        var n = itens.filter(function (x) { return x.efetivo && c.codigos.indexOf(x.efetivo.codigo) !== -1; }).length;
        h += '<li class="mf-categoria" data-categoria="' + esc(c.id) + '"><div class="mf-categoria-topo"><span class="mf-categoria-nome">' + spanNome(c.codigoNome) + '</span>' +
          '<span class="mf-squad" data-forma-squads="' + (c.formaSquads ? 'sim' : 'nao') + '">' + (c.formaSquads ? 'Pode organizar o trabalho por Squads, quando aplicável' : 'Não forma Squads') + '</span></div>';
        if (c.id === 'LINHA') h += '<ul class="mf-especializacoes">' + c.codigos.map(function (k) {
          var nk = itens.filter(function (x) { return x.efetivo && x.efetivo.codigo === k; }).length;
          return '<li data-codigo="' + esc(k) + '">' + spanNome(k) + ' <span class="mf-contagem">' + nk + ' objeto' + (nk === 1 ? '' : 's') + '</span></li>';
        }).join('') + '</ul>';
        h += '<p class="mf-categoria-rodape"><span class="mf-contagem" data-total="' + n + '">' + n + ' objeto' + (n === 1 ? '' : 's') + ' com posicionamento efetivo aqui</span>' +
          (n ? ' <button type="button" class="btn btn--sm mf-filtrar-categoria" data-categoria="' + esc(c.id) + '" aria-label="Filtrar o catálogo por ' + esc(nomeTexto(c.codigoNome)) + '">Ver no catálogo</button>' : '') + '</p></li>';
      });
      h += '</ul>';
      var cods = []; cs.forEach(function (c) { cods.push(c.codigoNome); c.codigos.forEach(function (k) { if (cods.indexOf(k) === -1) cods.push(k); }); });
      if (P() && P().precisaAviso(cods)) h += P().avisoHtml(cods, 'mfAvisoContingencia');
      return h + '</details>';
    }

    function renderCatalogo(itens) {
      var cs = cats(), f = state.filtros, cont = C.contarPorSituacao(itens), vis = C.filtrar(itens, f, cs);
      var h = '<section class="mf-secao" aria-labelledby="mfCatalogoTitulo"><h4 id="mfCatalogoTitulo">Objetos avaliados e pendências</h4>';
      if (!itens.length) return h + '<p class="admin-empty" id="mfVazio">Nenhum objeto avaliado no catálogo: não há Avaliação de Produto/Serviço registrada fora da Lixeira.</p></section>';
      h += '<div class="mf-filtros" id="mfFiltros">' +
        '<div class="avp-field"><label for="mfFiltroSituacao">Situação</label><select id="mfFiltroSituacao"><option value="">Todas (' + itens.length + ')</option>' +
        C.SITUACOES.concat(cont.verificando ? ['verificando'] : []).map(function (s) { return '<option value="' + s + '"' + (f.situacao === s ? ' selected' : '') + '>' + esc(C.ROTULO_CURTO[s]) + ' (' + (cont[s] || 0) + ')</option>'; }).join('') + '</select></div>' +
        '<div class="avp-field"><label for="mfBusca">Buscar pelo nome</label><input type="search" id="mfBusca" value="' + esc(f.busca) + '" autocomplete="off"></div>' +
        renderFiltroPosicionamento(cs, f) + '</div>';
      var recortado = !!(f.situacao || f.posicionamento || String(f.busca || '').trim());
      h += '<div class="mf-contador-linha"><span class="avp-total" id="mfContador" aria-live="polite">' + (recortado ? vis.length + ' de ' + itens.length : itens.length) + ' objeto' + (itens.length === 1 ? '' : 's') + '</span>' +
        (recortado ? ' <button type="button" class="btn btn--sm" id="mfLimparFiltros">Limpar filtros</button>' : '') + '</div>';
      if (!vis.length) return h + '<p class="admin-empty" id="mfNenhumFiltro">Nenhum objeto com esses filtros.</p></section>';
      h += '<ul class="mf-itens" id="mfItens">' + vis.map(renderItem).join('') + '</ul>';
      return h + '</section>';
    }

    /* "Posicionamento efetivo": opções de rádio com o nome oficial INTEIRO (o texto quebra linha, com qualquer fonte e
       qualquer tamanho de nome — uma lista suspensa cortava os nomes longos). O valor de cada opção é o CÓDIGO estável
       do motor (ou o id da categoria); o nome exibido vem da Taxonomia e pode mudar sem afetar o filtro. Recolhível:
       fechado no celular, aberto na tela larga; o resumo diz o que está escolhido. */
    function renderFiltroPosicionamento(cs, f) {
      if (state.posicionamentoAberto === null) state.posicionamentoAberto = !(window.matchMedia && window.matchMedia('(max-width: 720px)').matches);
      var opcoes = [{ valor: '', nome: 'Todos' }];
      cs.forEach(function (c) {
        if (c.id === 'LINHA') {
          opcoes.push({ valor: 'LINHA', nome: nomeTexto('LINHA') + ' (todas)' });
          c.codigos.forEach(function (k) { opcoes.push({ valor: k, nome: nomeTexto(k), sub: true }); });
        } else opcoes.push({ valor: c.id, nome: nomeTexto(c.codigoNome) });
      });
      var atual = opcoes.filter(function (o) { return o.valor === (f.posicionamento || ''); })[0] || opcoes[0];
      var h = '<details class="mf-filtro-posic" id="mfFiltroPosicionamentoBloco"' + (state.posicionamentoAberto ? ' open' : '') + '>' +
        '<summary class="mf-filtro-posic-resumo"><span class="mf-filtro-posic-titulo">Posicionamento efetivo</span> ' +
        '<span class="mf-filtro-posic-atual" id="mfFiltroPosicionamentoAtual">' + esc(atual.nome) + '</span></summary>' +
        '<fieldset class="mf-opcoes" id="mfFiltroPosicionamento"><legend class="mf-sr">Filtrar pelo posicionamento efetivo</legend>';
      opcoes.forEach(function (o) {
        var id = 'mfPosic-' + (o.valor || 'TODOS'), marcado = o.valor === (f.posicionamento || '');
        h += '<label class="mf-opcao' + (o.sub ? ' mf-opcao--sub' : '') + (marcado ? ' mf-opcao--ativa' : '') + '" for="' + id + '">' +
          '<input type="radio" name="mfPosic" id="' + id + '" value="' + esc(o.valor) + '"' + (marcado ? ' checked' : '') + '>' +
          '<span class="mf-opcao-nome">' + esc(o.nome) + '</span></label>';
      });
      return h + '</fieldset></details>';
    }

    var ROTULO_ALERTA = {
      'base-anterior': 'Este Posicionamento foi feito sobre uma versão anterior da Avaliação de Produto/Serviço deste item.',
      'reavaliacao-em-andamento': 'Há uma reavaliação de P1–P16 em andamento para este item.',
      'nao-concluida': 'A Avaliação de Produto/Serviço que vale para este item não está concluída.',
      indefinida: 'Não foi possível determinar qual versão da Avaliação de Produto/Serviço vale para este item.',
      desatualizado: 'A Avaliação de Produto/Serviço deste item está com o motor desatualizado.',
      equivalente: 'A Avaliação de Produto/Serviço deste item ainda precisa ser reconciliada com o motor atual.'
    };
    function renderItem(x) {
      var N = window.faAvaliacaoPosicionamentoNucleo, h = '<li class="mf-item" data-item="' + esc(x.itemId) + '" data-situacao="' + esc(x.situacao) + '">' +
        '<div class="mf-item-topo"><span class="mf-item-nome">' + esc(x.nome) + '</span>' +
        '<span class="avp-badge mf-badge mf-badge--' + esc(x.situacao) + '">' + esc(C.ROTULO_SITUACAO[x.situacao] || x.situacao) + '</span></div><dl class="mf-detalhes">';
      if (x.situacao === 'firme') {
        h += '<dt>Posicionamento efetivo</dt><dd class="mf-efetivo" data-codigo="' + esc(x.efetivo.codigo) + '" data-origem="' + esc(x.efetivo.origem) + '">' + spanNome(x.efetivo.codigo) +
          ' <span class="mf-origem">(' + (x.efetivo.origem === 'decisao' ? 'decisão final' : 'recomendação automática') + ')</span></dd>';
        if (x.efetivo.origem === 'decisao' && x.posicionamento.codigoAutomatico !== x.efetivo.codigo) h += '<dt>Recomendação automática</dt><dd>' + rotuloAutomatico(x.posicionamento) + '</dd>';
      } else if (x.situacao === 'a-validar') {
        h += '<dt>Recomendação automática</dt><dd>' + rotuloAutomatico(x.posicionamento) + '</dd>' +
          '<dt>Pendência</dt><dd>Falta a decisão final com um posicionamento firme. A VALIDAR não é exclusão: o objeto continua no catálogo.</dd>';
      } else if (x.situacao === 'sem-posicionamento') {
        h += '<dt>Pendência</dt><dd>' + (x.rascunhoId ? 'Posicionamento Organizacional em andamento (rascunho), ainda não concluído.' : 'A Avaliação de Produto/Serviço permite iniciar o Posicionamento Organizacional (O1–O9).') + '</dd>';
      } else if (x.situacao === 'sem-base') {
        h += '<dt>Pendência</dt><dd data-motivo="' + esc(x.motivo) + '">' + esc(N.textoGate(x.motivo, 'iniciar') || (N.ROTULO_GATE && N.ROTULO_GATE[x.motivo]) || x.motivo) + '</dd>';
        if (x.rascunhoId) h += '<dt>Posicionamento</dt><dd>Há um rascunho de Posicionamento Organizacional em andamento.</dd>';
      } else h += '<dt>Situação</dt><dd>Verificando a versão do motor da Avaliação de Produto/Serviço…</dd>';
      if (x.alertaBase) h += '<dt>Atenção</dt><dd class="mf-alerta" data-alerta="' + esc(x.alertaBase) + '">' + esc(ROTULO_ALERTA[x.alertaBase] || ((N.ROTULO_GATE && N.ROTULO_GATE[x.alertaBase]) || x.alertaBase)) + '</dd>';
      if (x.baseRevisao) h += '<dt>Precisa de revisão</dt><dd class="mf-base-revisao">' + esc(N.textoBaseRevisao(x.baseRevisao)) + ' Nada foi alterado automaticamente.</dd>';
      h += vinculoDoItemHtml(x);
      h += '</dl><div class="mf-item-acoes">';
      if (x.posicionamento) h += '<a class="btn btn--sm mf-abrir-po" href="#avaliacoes?po=' + encodeURIComponent(x.posicionamento.avaliacaoId) + '">Abrir Posicionamento</a>';
      else if (x.rascunhoId) h += '<a class="btn btn--sm mf-abrir-po" href="#avaliacoes?po=' + encodeURIComponent(x.rascunhoId) + '">Abrir rascunho do Posicionamento</a>';
      if (x.chaveBase) h += '<a class="btn btn--sm mf-abrir-avp" href="#avaliacoes?' + (x.statusBase === 'rascunho' ? 'editar=' : 'avp=') + encodeURIComponent(x.chaveBase) + '">Abrir Avaliação de Produto/Serviço</a>';
      return h + '</div></li>';
    }
    /* M4/M5: o vínculo do item com a estrutura responsável (só ambiente de testes, onde o cadastro existe) */
    function vinculosProntos() { return cadastroDisponivel() && !cadastro.erro && cadastro.estruturas !== undefined && cadastro.vinculos !== undefined && cadastro.refs !== undefined && !!window.faEstruturasAdmin; }
    function posicionamentoDe(x) {
      if (!x || !x.posicionamento) return null;
      var p = { avaliacaoId: x.posicionamento.avaliacaoId, recomendacao: { codigoResultado: x.posicionamento.codigoAutomatico } };
      if (x.posicionamento.codigoDecisao) p.decisao = { codigoFinal: x.posicionamento.codigoDecisao };
      return p;
    }
    function situacaoVinculo(itemId, x) { return Est().situacaoResponsavel({ estruturas: cadastro.estruturas, vinculos: cadastro.vinculos }, itemId, posicionamentoDe(x), cadastro.refs); }
    var TEXTO_AVISO_VINCULO = ' Isso não muda a situação do vínculo; confira o Posicionamento.';
    function vinculoDoItemHtml(x) {
      if (!cadastroDisponivel()) return '';
      if (cadastro.erro) return '<dt>Estrutura responsável</dt><dd class="mf-vinculo">Não foi possível ler as estruturas agora.</dd>';
      if (!vinculosProntos()) return '<dt>Estrutura responsável</dt><dd class="mf-vinculo">Carregando…</dd>';
      var s = situacaoVinculo(x.itemId, x);
      if (s.situacao === 'nao-aplicavel') return '';
      var est = s.vinculo ? cadastro.estruturas[s.vinculo.estruturaId] : null;
      return '<dt>Estrutura responsável</dt><dd class="mf-vinculo" data-situacao-vinculo="' + esc(s.situacao) + '">' + (est ? '<span class="mf-vinculo-estrutura">' + esc(est.nome) + '</span>' : '') +
        window.faEstruturasAdmin.situacaoVinculoHtml(s) + (s.vinculo && x.baseRevisao ? '<span class="mf-vinculo-aviso"> Aviso: a base do Posicionamento precisa de revisão.' + esc(TEXTO_AVISO_VINCULO) + '</span>' : '') + '</dd>';
    }
    function rotuloAutomatico(p) {
      if (!p || !p.codigoAutomatico) return '—';
      if (p.codigoAutomatico === 'A_VALIDAR') {
        var t = { INCOERENCIA: 'incoerência nas respostas', CONFLITO: 'conflito de posicionamento', RECORTE: 'recorte do objeto', EVIDENCIA_INSUFICIENTE: 'evidência insuficiente' }[p.tipoAValidar];
        return 'A validar' + (t ? ' — ' + esc(t) : '');
      }
      return spanNome(p.codigoAutomatico);
    }

    function bind() {
      var v = byId('mfVoltar'); if (v) v.addEventListener('click', sairParaAvaliacoes);
      var im = byId('mfIrMapa'); if (im) im.addEventListener('click', function () { irPara('mapa'); });
      var t = byId('mfTentarDeNovo'); if (t) t.addEventListener('click', function () { desligar(); ligar(); render(); });
      var fs = byId('mfFiltroSituacao'); if (fs) fs.addEventListener('change', function () { state.filtros.situacao = fs.value; render(); });
      Array.prototype.forEach.call(wrap.querySelectorAll('input[name="mfPosic"]'), function (r) {
        r.addEventListener('change', function () { if (r.checked) { state.filtros.posicionamento = r.value; render(); } });
      });
      var blocoPosic = byId('mfFiltroPosicionamentoBloco'); if (blocoPosic) blocoPosic.addEventListener('toggle', function () { state.posicionamentoAberto = blocoPosic.open; });
      var b = byId('mfBusca'); if (b) b.addEventListener('input', function () { state.filtros.busca = b.value; render(); });
      var l = byId('mfLimparFiltros'); if (l) l.addEventListener('click', function () { state.filtros = { situacao: '', posicionamento: '', busca: '' }; render(); var s = byId('mfFiltroSituacao'); if (s) s.focus(); });
      var bloco = byId('mfCategoriasBloco'); if (bloco) bloco.addEventListener('toggle', function () { state.categoriasAbertas = bloco.open; });
      Array.prototype.forEach.call(wrap.querySelectorAll('.mf-filtrar-categoria'), function (btn) {
        btn.addEventListener('click', function () {
          state.filtros = { situacao: 'firme', posicionamento: btn.getAttribute('data-categoria'), busca: '' };
          render();
          var alvo = byId('mfCatalogoTitulo'); if (alvo && alvo.scrollIntoView) alvo.scrollIntoView({ block: 'start' });
        });
      });
    }

    /* ===================== MAPA VISUAL (demonstração) ===================== */
    /* Nível 1 — BLOCOS do Mapa (desenho aprovado): título visual, cor, ícone e os códigos firmes do motor que cada bloco
       reúne. O título é só visual; o nome OFICIAL de cada código vem da Taxonomia (sub-blocos de Plataformas e detalhe).
       Nível 2 — subagrupadores (dados de exemplo, em Negócios) ou um sub-bloco por código (Plataformas). Nível 3 — as
       caixas: cada uma é uma estrutura concreta. A cor identifica o bloco, mas nunca sozinha: todo bloco tem título. */
    var BLOCOS = [
      { id: 'estrategia', titulo: 'Linhas de Estratégia de Clientes', cor: '#164EAA', icone: 'alvo', codigos: ['ESTRATEGIA_CLIENTES'], natureza: 'Linha' },
      { id: 'canais', titulo: 'Linhas de Canais', cor: '#307CED', icone: 'canais', codigos: ['PLATAFORMA_CANAIS'], natureza: 'Linha' },
      { id: 'negocios', titulo: 'Linhas de Negócios', cor: '#7435BB', icone: 'caixa', codigos: ['NEGOCIOS'], natureza: 'Linha', subagrupado: true },
      { id: 'plataformas', titulo: 'Linhas de Plataformas Habilitadoras', cor: '#06AFA7', icone: 'engrenagem', codigos: ['PLATAFORMA_HABILITADORA_NEGOCIOS', 'PLATAFORMA_HABILITADORA_TECNOLOGIA', 'PLATAFORMA_CORPORATIVA'], natureza: 'Linha', porCodigo: true },
      { id: 'coe', titulo: 'Centros de Excelência', cor: '#D99A12', icone: 'rede', codigos: ['COE'], natureza: 'Centro de Excelência' },
      { id: 'ae', titulo: 'Áreas Especializadas', cor: '#F25160', icone: 'lampada', codigos: ['AREA_ESPECIALIZADA'], natureza: 'Área Especializada' }
    ];
    /* ícones de traço (24×24), só de apresentação; aria-hidden — o texto ao lado é que identifica */
    var ICONES = {
      alvo: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
      canais: '<circle cx="12" cy="12" r="2"/><path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19.1 4.9a10 10 0 0 1 0 14.2M4.9 19.1a10 10 0 0 1 0-14.2"/>',
      caixa: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
      engrenagem: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/>',
      rede: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
      lampada: '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/>',
      'guarda-chuva': '<path d="M22 12a10 10 0 0 0-20 0z"/><path d="M12 12v7a2 2 0 0 0 4 0"/>',
      escudo: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
      moedas: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
      grafico: '<path d="M3 3v18h18"/><path d="M8 17v-6M13 17V7M18 17v-4"/>',
      nuvem: '<path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 0 0 4.5 12 4 4 0 0 0 6 19h11.5z"/>',
      organograma: '<rect x="9" y="2" width="6" height="5" rx="1"/><rect x="2" y="17" width="6" height="5" rx="1"/><rect x="16" y="17" width="6" height="5" rx="1"/><path d="M12 7v5M5 17v-3h14v3"/>',
      estrutura: '<path d="M3 21h18"/><path d="M5 21V8l7-5 7 5v13"/><path d="M9 21v-6h6v6"/>'
    };
    var ICONE_CODIGO = { PLATAFORMA_HABILITADORA_NEGOCIOS: 'grafico', PLATAFORMA_HABILITADORA_TECNOLOGIA: 'nuvem', PLATAFORMA_CORPORATIVA: 'organograma' };
    function icone(nome, cls) {
      return '<svg class="' + (cls || 'mfm-ic') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (ICONES[nome] || ICONES.estrutura) + '</svg>';
    }
    function Est() { return window.faEstruturasNucleo; }
    function Mot() { return window.faMotorPosicionamentoNucleo; }
    function demo() { return window.faMapaFlorestaDemo && window.faMapaFlorestaDemo.cenario(cenarioDemo); }
    /* os dados do desenho atual: a demonstração OU as estruturas cadastradas (sem subagrupadores nem associações de
       produtos ainda — Linhas de Negócios ficam em "Sem subagrupador"; nada é inventado) */
    function dados() {
      if (fonte !== 'cadastro') return demo();
      if (cadastro.estruturas === undefined || cadastro.subagrupadores === undefined || cadastro.associacoes === undefined || cadastro.erro) return null;
      return { estado: { estruturas: cadastro.estruturas, relacoes: {}, vinculos: {} }, subagrupadores: subagrupadoresCadastrados(), associacoesSubagrupador: associacoesCadastradas(), objetos: {}, ficticio: false };
    }
    /* Etapa 5: subagrupadores CADASTRADOS (agrupamento de apresentação das Linhas de Negócios), só os ativos, no formato
       que o desenho aprovado já usa; associações só as ativas e de subagrupador ativo — quem tem associação com um
       subagrupador encerrado fica em "Sem subagrupador" (situação calculada pelo núcleo, nada é alterado) */
    function estadoSubagrupadores() { return { estruturas: cadastro.estruturas, subagrupadores: cadastro.subagrupadores, associacoesSubagrupador: cadastro.associacoes }; }
    function subagrupadoresCadastrados() {
      var out = {};
      Est().subagrupadoresAtivos(estadoSubagrupadores()).forEach(function (g) { out[g.id] = { id: g.id, bloco: 'NEGOCIOS', nome: g.nome, ordem: g.ordem, situacao: 'ativo', icone: 'estrutura' }; });
      return out;
    }
    function associacoesCadastradas() {
      var E = estadoSubagrupadores();
      return Object.keys(cadastro.estruturas).map(function (id) { var s = Est().subagrupadorDaLinha(E, id); return s.situacao === 'associada' ? { estruturaId: id, subagrupadorId: s.subagrupador.id } : null; }).filter(Boolean);
    }
    function ligarCadastro() {
      if (!cadastroDisponivel() || cadastro.desligar) return; /* M4: o Catálogo também lê o cadastro (vínculos), em qualquer fonte do Mapa */
      /* marca ANTES de ouvir: com dado em cache o Firebase responde na hora, e essa resposta redesenha (e chamaria
         ligarCadastro de novo) antes de a ligação ser guardada */
      var desligarEsta = null;
      cadastro.desligar = function () { if (desligarEsta) desligarEsta(); };
      desligarEsta = window.faEstruturasFirebase.ouvir(null, ['registros', 'subagrupadores', 'associacoes', 'vinculos'], /* só leitura, pelo adaptador */ function (m) {
        if (m.estruturas) cadastro.estruturas = m.estruturas;
        if (m.subagrupadores) cadastro.subagrupadores = m.subagrupadores;
        if (m.associacoesSubagrupador) cadastro.associacoes = m.associacoesSubagrupador;
        if (m.vinculos) cadastro.vinculos = m.vinculos;
        cadastro.erro = null; if (!wrap.hidden) render();
      }, function (cod) { cadastro.erro = cod; if (!wrap.hidden) render(); });
      /* ligações oficiais para a situação do vínculo (null = o perfil não lê: a situação não confere o tipo) */
      if (window.faEstruturasAdmin && window.faEstruturasAdmin.lerLigacoes) window.faEstruturasAdmin.lerLigacoes(function (ref) { cadastro.refs = ref; if (!wrap.hidden) render(); });
    }
    function desligarCadastro() { if (cadastro.desligar) { cadastro.desligar(); cadastro.desligar = null; } cadastro.estruturas = cadastro.subagrupadores = cadastro.associacoes = cadastro.vinculos = cadastro.refs = undefined; cadastro.erro = null; }
    function blocoDoTipo(tipo) { return BLOCOS.filter(function (b) { return b.codigos.indexOf(tipo) !== -1; })[0] || null; }
    function estruturasDoBloco(b) {
      var D = dados();
      return b.codigos.reduce(function (acc, k) { return acc.concat(Est().estruturasDoTipo(D.estado, k)); }, []);
    }
    function subagrupadoresDe(b) {
      var D = dados();
      return Object.keys(D.subagrupadores).map(function (k) { return D.subagrupadores[k]; })
        .filter(function (s) { return s.bloco === b.id.toUpperCase() && s.situacao === 'ativo'; }).sort(function (x, y) { return x.ordem - y.ordem; });
    }
    function subagrupadorDaEstrutura(id) {
      var D = dados(), a = D.associacoesSubagrupador.filter(function (x) { return x.estruturaId === id; })[0];
      return a ? D.subagrupadores[a.subagrupadorId] : null;
    }
    function objetosDe(id) {
      var D = dados();
      return Est().objetosDaEstrutura(D.estado, id).map(function (v) { return Object.assign({ id: v.objetoId, papel: v.papel }, D.objetos[v.objetoId] || { nome: v.objetoId }); });
    }
    function caixasHtml(ests, vazio) {
      if (!ests.length) return '<p class="mfm-vazio">' + (vazio || (fonte === 'cadastro' ? 'Nenhuma estrutura cadastrada' : 'Sem estrutura de exemplo')) + '</p>';
      return '<ul class="mfm-caixas" data-quantidade="' + ests.length + '">' + ests.map(function (e) {
        var ativo = e.id === selecionada;
        return '<li><button type="button" class="mfm-caixa' + (ativo ? ' mfm-caixa--ativa' : '') + '" data-estrutura="' + esc(e.id) + '" id="mfmNo-' + esc(e.id) + '" aria-pressed="' + ativo + '">' +
          icone('estrutura', 'mfm-caixa-ic') + '<span class="mfm-caixa-nome">' + esc(e.nome).replace(/ — /g, '\u00a0— ') + '</span></button></li>'; /* o travessão não começa linha */
      }).join('') + '</ul>';
    }
    function subHtml(attrs, ic, tituloHtml, ests, n, vazio) {
      /* grupo com muitas estruturas ocupa a largura inteira do bloco (sem virar torre estreita); quantidade nunca é fixa */
      return '<div class="mfm-sub" ' + attrs + (n ? ' style="--n:' + n + '"' : '') + (ests.length >= 6 ? ' data-muitas=""' : '') + '><h4 class="mfm-sub-titulo">' + icone(ic, 'mfm-sub-ic') + '<span>' + tituloHtml + '</span></h4>' + caixasHtml(ests, vazio) + '</div>';
    }
    function blocoHtml(b) {
      var h = '<section class="mfm-bloco mfm-bloco--' + b.id + '" data-bloco="' + b.id + '" style="--cor:' + b.cor + '" aria-labelledby="mfmB-' + b.id + '">' +
        '<header class="mfm-bloco-topo"><span class="mfm-bloco-ic">' + icone(b.icone) + '</span><h3 class="mfm-bloco-titulo" id="mfmB-' + b.id + '">' + esc(b.titulo) + '</h3></header><div class="mfm-bloco-corpo">';
      if (b.subagrupado) {
        var todas = estruturasDoBloco(b), usadas = {};
        h += '<div class="mfm-subs">' + subagrupadoresDe(b).map(function (s) {
          var ests = todas.filter(function (e) { var sa = subagrupadorDaEstrutura(e.id); return sa && sa.id === s.id; });
          ests.forEach(function (e) { usadas[e.id] = true; });
          return subHtml('data-subagrupador="' + esc(s.id) + '"', s.icone, esc(s.nome), ests, Math.min(4, Math.max(1, ests.length)), fonte === 'cadastro' ? 'Nenhuma Linha associada' : null);
        }).join('');
        var soltas = todas.filter(function (e) { return !usadas[e.id]; });
        if (soltas.length) h += subHtml('data-subagrupador=""', 'estrutura', 'Sem subagrupador', soltas, Math.min(4, soltas.length));
        h += '</div>';
        if (!todas.length && !subagrupadoresDe(b).length) h += caixasHtml([]);
      } else if (b.porCodigo) {
        var D = dados();
        h += '<div class="mfm-subs">' + b.codigos.map(function (k) {
          return subHtml('data-codigo="' + esc(k) + '"', ICONE_CODIGO[k], spanNome(k), Est().estruturasDoTipo(D.estado, k), 0);
        }).join('') + '</div>';
      } else h += caixasHtml(estruturasDoBloco(b));
      return h + '</div></section>';
    }
    /* Squads: a POSSIBILIDADE vem da regra fixa Linha × Squad do motor (Áreas Especializadas e CoEs não formam
       Squads); a EXISTÊNCIA de Squads vinculados é outra informação, que ainda não existe — nunca inventada */
    function squadsHtml(tipo, exemplo) {
      if (Mot().liberaSquadParaCodigoFirme(tipo) !== true) return '<dt>Organização por Squads</dt><dd class="mfm-squads" data-forma-squads="nao">Não se aplica: Áreas Especializadas e Centros de Excelência não formam Squads.</dd>';
      return '<dt>Organização por Squads</dt><dd class="mfm-squads" data-forma-squads="sim">Admitida para este tipo de estrutura (Linha).</dd>' +
        '<dt>Squads vinculados</dt><dd class="mfm-squads-vinculados">' + (exemplo ? 'Nenhum nos exemplos fictícios.' : 'Informação ainda indisponível: a associação de Squads às estruturas não existe nesta versão.') + '</dd>';
    }
    function detalheHtml(id) {
      var e = dados().estado.estruturas[id], b = blocoDoTipo(e.tipo), sub = subagrupadorDaEstrutura(id), objs = objetosDe(id), M = Mot();
      if (fonte === 'cadastro') return detalheCadastroHtml(e, b);
      var linha = b && b.natureza === 'Linha';
      var h = '<aside class="mfm-detalhe" id="mfmDetalhe" style="--cor:' + (b ? b.cor : '#555') + '" aria-labelledby="mfmDetalheTitulo">' +
        '<button type="button" class="mfm-fechar" id="mfmFechar">← Voltar ao Mapa</button>' +
        '<p class="mfm-caminho">' + (b ? icone(b.icone, 'mfm-caminho-ic') : '') + esc(b ? b.titulo : '') + (sub ? ' › ' + esc(sub.nome) : linha && b.porCodigo ? ' › ' + spanNome(e.tipo) : '') + '</p>' +
        '<h3 id="mfmDetalheTitulo" tabindex="-1">' + esc(e.nome) + '</h3>' +
        '<span class="mfm-badge-exemplo">Exemplo fictício</span>' +
        '<dl class="mfm-ficha"><dt>Natureza</dt><dd>' + esc(b ? b.natureza : '—') + '</dd>' +
        (linha ? '<dt>Especialização</dt><dd>' + spanNome(e.tipo) + '</dd>' : '<dt>Tipo oficial</dt><dd>' + spanNome(e.tipo) + '</dd>') +
        '<dt>Definição oficial</dt><dd class="mfm-definicao">' + definicaoTipoHtml(e.tipo) + '</dd>' +
        (sub ? '<dt>Subagrupador</dt><dd>' + esc(sub.nome) + ' <span class="mfm-nota">(exemplo)</span></dd>' : '') +
        squadsHtml(e.tipo, true) + '</dl>' +
        '<h4 class="mfm-objetos-titulo">Produtos e serviços sob esta estrutura</h4>' +
        '<p class="mfm-ajuda">Eles não são caixas do Mapa: aparecem aqui, na estrutura responsável.</p>';
      h += objs.length ? '<ul class="mfm-objetos" id="mfmObjetos">' + objs.map(function (o) {
        return '<li class="mfm-objeto" data-objeto="' + esc(o.id) + '"><span class="mfm-objeto-nome">' + esc(o.nome) + '</span>' +
          (o.descricao ? '<span class="mfm-objeto-desc">' + esc(o.descricao) + '</span>' : '') + '<span class="mfm-objeto-papel">Responsável principal · exemplo</span></li>';
      }).join('') + '</ul>' : '<p class="mfm-sem-objetos" id="mfmSemObjetos">Nenhum produto ou serviço de exemplo sob esta estrutura.</p>';
      return h + '</aside>';
    }
    function dataHora(v) { var t = Est().instante(v); return t === null ? '—' : new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    function podeManterEstruturas() { var a = window.faAuth; return !!(a && ((a.isAdmin && a.isAdmin()) || (a.podeArquitetura && a.podeArquitetura()))); }
    function produtosDaEstruturaHtml(e) {
      var cat = modulosProntos() && state.produtos !== undefined && state.registros !== undefined && state.vigentes !== undefined && state.decisoes !== undefined
        ? C.montarCatalogo({ produtos: state.produtos, registros: state.registros, vigentes: state.vigentes, decisoes: state.decisoes }, deps()) : { pronto: false };
      if (state.erro) return '<p class="mfm-sem-objetos" id="mfmSemObjetos">Não foi possível ler as avaliações agora.</p>';
      if (!vinculosProntos() || !cat.pronto) return '<p class="mfm-sem-objetos" id="mfmCarregandoObjetos" role="status">Carregando…</p>';
      var objs = Est().objetosDaEstrutura({ estruturas: cadastro.estruturas, vinculos: cadastro.vinculos }, e.id);
      if (!objs.length) return '<p class="mfm-sem-objetos" id="mfmSemObjetos">Nenhum produto ou serviço vinculado a esta estrutura.</p>';
      var porItem = {}; cat.itens.forEach(function (x) { porItem[x.itemId] = x; });
      return '<ul class="mfm-objetos" id="mfmObjetos">' + objs.map(function (o) {
        var x = porItem[o.objetoId] || null, s = situacaoVinculo(o.objetoId, x), v = cadastro.vinculos[o.vinculoId];
        return '<li class="mfm-objeto" data-objeto="' + esc(o.objetoId) + '"><span class="mfm-objeto-nome">' + esc(x ? x.nome : o.objetoId) + '</span>' +
          '<span class="mfm-objeto-papel">Responsável principal ·' + window.faEstruturasAdmin.situacaoVinculoHtml(s) + '</span>' +
          (x && x.baseRevisao ? '<span class="mfm-objeto-desc mfm-objeto-aviso">Aviso: a base do Posicionamento precisa de revisão.' + esc(TEXTO_AVISO_VINCULO) + '</span>' : '') +
          '<a class="mfm-acao mfm-abrir-po" href="#avaliacoes?po=' + encodeURIComponent((x && x.posicionamento && x.posicionamento.avaliacaoId) || v.base.avaliacaoId) + '">Abrir Posicionamento</a></li>';
      }).join('') + '</ul>';
    }
    function detalheCadastroHtml(e, b) {
      var M = Mot(), linha = b && b.natureza === 'Linha', subCad = b && b.subagrupado ? subagrupadorDaEstrutura(e.id) : null;
      var h = '<aside class="mfm-detalhe" id="mfmDetalhe" style="--cor:' + (b ? b.cor : '#555') + '" aria-labelledby="mfmDetalheTitulo">' +
        '<button type="button" class="mfm-fechar" id="mfmFechar">← Voltar ao Mapa</button>' +
        '<p class="mfm-caminho">' + (b ? icone(b.icone, 'mfm-caminho-ic') : '') + esc(b ? b.titulo : '') + (b && b.subagrupado ? ' › ' + esc(subCad ? subCad.nome : 'Sem subagrupador') : linha && b.porCodigo ? ' › ' + spanNome(e.tipo) : '') + '</p>' +
        '<h3 id="mfmDetalheTitulo" tabindex="-1">' + esc(e.nome) + '</h3>' +
        '<span class="mfm-badge-cadastrada">Estrutura cadastrada</span>' +
        '<dl class="mfm-ficha"><dt>Natureza</dt><dd>' + esc(b ? b.natureza : '—') + '</dd>' +
        (linha ? '<dt>Especialização</dt><dd>' + spanNome(e.tipo) + '</dd>' : '<dt>Tipo oficial</dt><dd>' + spanNome(e.tipo) + '</dd>') +
        '<dt>Definição oficial</dt><dd class="mfm-definicao">' + definicaoTipoHtml(e.tipo) + '</dd>' +
        (b && b.subagrupado ? '<dt>Subagrupador</dt><dd id="mfmSubagrupador">' + (subCad ? esc(subCad.nome) : 'Sem subagrupador') + '</dd>' : '') +
        (e.sigla ? '<dt>Sigla</dt><dd>' + esc(e.sigla) + '</dd>' : '') +
        (e.descricao ? '<dt>Descrição</dt><dd class="mfm-descricao">' + esc(e.descricao) + '</dd>' : '') +
        squadsHtml(e.tipo, false) +
        '<dt>Cadastrada</dt><dd>' + dataHora(e.criadaEm) + (e.criadaPor ? ' · ' + esc(e.criadaPor.email || e.criadaPor.id) : '') + '</dd>' +
        (e.alteradaEm ? '<dt>Última alteração</dt><dd>' + dataHora(e.alteradaEm) + (e.alteradaPor ? ' · ' + esc(e.alteradaPor.email || e.alteradaPor.id) : '') + '</dd>' : '') + '</dl>' +
        '<h4 class="mfm-objetos-titulo">Produtos e serviços sob esta estrutura</h4>' +
        produtosDaEstruturaHtml(e) +
        (podeManterEstruturas() && window.faEstruturasAdmin && window.faEstruturasAdmin.disponivel() ? '<a class="mfm-acao mfm-abrir-cadastro" id="mfmAbrirCadastro" href="#admin?arq=estruturas&e=' + encodeURIComponent(e.id) + '">Abrir a ficha no cadastro (editar ou encerrar)</a>' : '');
      return h + '</aside>';
    }
    function renderMapaTela() {
      if (fonte === 'cadastro' && podeLer()) { ligarCadastro(); ligar(); } /* M4: os itens (nomes e Posicionamento) dos vínculos */
      var D = dados();
      if (selecionada && D && !D.estado.estruturas[selecionada]) selecionada = null; /* encerrada ou inexistente: volta ao Mapa */
      if (selecionada && D && D.estado.estruturas[selecionada].situacao !== 'ativa') selecionada = null;
      var pronto = autorizacaoResolvida() && podeLer() && D && Est() && Mot();
      /* um só painel claro: título, ações, aviso de demonstração e o quadro — o fundo do site fica só na margem */
      var h = '<div class="mfm-painel"><div class="mfm-cabecalho"><div class="mfm-cabecalho-texto"><h2 class="mfm-titulo">Mapa da Floresta</h2>' +
        '<p class="mfm-subtitulo">' + (fonte === 'cadastro' ? 'Visão organizacional · estruturas cadastradas' : 'Visão organizacional · demonstração com exemplos fictícios') + '</p></div>' +
        '<div class="mfm-acoes"><button type="button" class="mfm-acao" id="mfVoltar">← Voltar para Avaliações</button>' +
        (pronto ? '<button type="button" class="mfm-acao" id="mfmIrCatalogo">Ver o Catálogo e as pendências</button>' : '') + '</div></div>';
      if (cadastroDisponivel() && autorizacaoResolvida() && podeLer()) h += '<div class="mfm-cenarios mfm-fontes" role="group" aria-label="Dados do Mapa"><span class="mfm-cenarios-rotulo">Dados:</span>' +
        [['cadastro', 'Estruturas cadastradas'], ['demo', 'Demonstração (fictícia)']].map(function (o) {
          return '<button type="button" class="mfm-cenario mfm-fonte' + (fonte === o[0] ? ' mfm-cenario--ativo' : '') + '" data-fonte="' + o[0] + '" aria-pressed="' + (fonte === o[0]) + '">' + o[1] + '</button>';
        }).join('') + '</div>';
      if (pronto && fonte === 'demo') h += '<div class="mfm-cenarios" role="group" aria-label="Configuração de demonstração"><span class="mfm-cenarios-rotulo">Configuração de demonstração:</span>' +
        [['habitual', 'Habitual'], ['populoso', 'Populosa (teste de layout)']].map(function (o) {
          return '<button type="button" class="mfm-cenario' + (cenarioDemo === o[0] ? ' mfm-cenario--ativo' : '') + '" data-cenario="' + o[0] + '" aria-pressed="' + (cenarioDemo === o[0]) + '">' + o[1] + '</button>';
        }).join('') + '</div>';
      if (fonte === 'cadastro') h += '<div class="mfm-faixa mfm-faixa--cadastro" id="mfmFaixa" role="note"><strong>Ambiente de testes.</strong> Estruturas cadastradas no Firebase Emulator — não são dados do banco oficial.' +
        (pronto ? ' <span class="mfm-legenda">Cada caixa é uma estrutura cadastrada: clique para ver os detalhes.</span>' : '') +
        (podeManterEstruturas() && window.faEstruturasAdmin && window.faEstruturasAdmin.disponivel() ? ' <a class="mfm-link-cadastro" id="mfmIrCadastro" href="#admin?arq=estruturas">Cadastrar ou editar estruturas</a>' : '') + '</div>';
      else h += '<div class="mfm-faixa" id="mfmFaixa" role="note"><strong>Demonstração.</strong> ' + esc(demo() ? demo().AVISO : '') +
        (pronto ? ' <span class="mfm-legenda">Cada caixa é uma estrutura concreta de exemplo: clique para ver os detalhes.</span>' : '') + '</div>';
      if (!autorizacaoResolvida()) h += '<p class="mfm-msg" role="status">Carregando…</p>';
      else if (!podeLer()) h += '<p class="mfm-msg mfm-msg--erro" id="mfSemAcesso">O Mapa é consultado pelos perfis da Avaliação de Produto/Serviço (Avaliação, Avaliação + Configuração e administração geral). Seu acesso não inclui essa consulta.</p>';
      else if (fonte === 'cadastro' && cadastro.erro) h += '<p class="mfm-msg mfm-msg--erro" id="mfmErroCadastro" role="alert">' + (cadastro.erro === 'RECUSADA' ? 'Seu acesso não permite consultar as estruturas cadastradas.' : 'Não foi possível ler as estruturas cadastradas agora. Verifique se o ambiente de testes está aberto.') + '</p>';
      else if (fonte === 'cadastro' && cadastro.estruturas === undefined) h += '<p class="mfm-msg" role="status" id="mfmCarregandoCadastro">Carregando as estruturas cadastradas…</p>';
      else if (!D || !Est() || !Mot()) h += '<p class="mfm-msg mfm-msg--erro" id="mfmIndisponivel">O Mapa não carregou. Recarregue a página.</p>';
      else {
        var linhas = BLOCOS.filter(function (b) { return b.natureza === 'Linha'; });
        h += '<div class="mfm-quadro" id="mfmMapa" role="region" aria-label="Mapa da Floresta">' +
          '<div class="mfm-principal">' + linhas.map(blocoHtml).join('') + '</div>' +
          blocoHtml(BLOCOS.filter(function (b) { return b.id === 'coe'; })[0]) + blocoHtml(BLOCOS.filter(function (b) { return b.id === 'ae'; })[0]) + '</div>';
      }
      h += '</div>';
      if (pronto && selecionada) h += detalheHtml(selecionada);
      wrap.innerHTML = h;
      bindMapa();
      if (P()) P().atualizarDom(wrap);
    }
    function fecharDetalhe() {
      var antes = selecionada;
      irPara('mapa', null);
      var no = antes && byId('mfmNo-' + antes); if (no) { no.focus({ preventScroll: true }); if (no.scrollIntoView) no.scrollIntoView({ block: 'center' }); }
    }
    function bindMapa() {
      var v = byId('mfVoltar'); if (v) v.addEventListener('click', sairParaAvaliacoes);
      var ic = byId('mfmIrCatalogo'); if (ic) ic.addEventListener('click', function () { irPara('catalogo'); });
      Array.prototype.forEach.call(wrap.querySelectorAll('.mfm-fonte'), function (b) {
        b.addEventListener('click', function () {
          var fo = b.getAttribute('data-fonte');
          if (fo === fonte) return;
          fonte = fo; if (fonte !== 'cadastro') desligarCadastro();
          irPara('mapa', null);
          var novo = wrap.querySelector('.mfm-fonte[data-fonte="' + fo + '"]'); if (novo) novo.focus({ preventScroll: true });
        });
      });
      Array.prototype.forEach.call(wrap.querySelectorAll('.mfm-cenario:not(.mfm-fonte)'), function (b) {
        b.addEventListener('click', function () {
          var c = b.getAttribute('data-cenario');
          if (c === cenarioDemo) return;
          cenarioDemo = c;
          irPara('mapa', null);
          var novo = wrap.querySelector('.mfm-cenario[data-cenario="' + c + '"]'); if (novo) novo.focus({ preventScroll: true });
        });
      });
      Array.prototype.forEach.call(wrap.querySelectorAll('.mfm-caixa'), function (b) {
        b.addEventListener('click', function () {
          irPara('mapa', b.getAttribute('data-estrutura'));
          var t = byId('mfmDetalheTitulo'); if (t) t.focus({ preventScroll: true });
        });
      });
      var fe = byId('mfmFechar'); if (fe) fe.addEventListener('click', fecharDetalhe);
      if (!bindMapa._esc) {
        bindMapa._esc = true;
        document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && modo === 'mapa' && selecionada && !wrap.hidden) fecharDetalhe(); });
      }
    }
    function ligarNomes() {
      if (P() && !ligar._nomes) { ligar._nomes = true; P().onMudanca(function () { if (!wrap.hidden) render(); }); }
    }

    /* ===================== LEITURAS AO VIVO (só leitura) ===================== */
    var ouvintes = [], ligado = false, relogio = null;
    function ouvir(caminho, campo) {
      ouvintes.push(S().ouvir(caminho, function (v) { state[campo] = v || {}; aoChegar(); }, function (e) {
        console.error('[mapa-floresta] não foi possível ler ' + caminho + ':', e);
        state.erro = true; aoChegar(); /* leitura recusada não é "sem dados" */
      }));
    }
    function aoChegar() {
      if (state.produtos !== undefined && state.registros !== undefined && state.vigentes !== undefined && state.decisoes !== undefined) { clearTimeout(relogio); state.demorando = false; }
      render();
    }
    function ligar() {
      if (ligado || !podeLer() || !S()) return;
      ligado = true;
      state.erro = false; state.demorando = false;
      clearTimeout(relogio);
      relogio = setTimeout(function () { if (state.produtos === undefined || state.registros === undefined || state.vigentes === undefined || state.decisoes === undefined) { state.demorando = true; render(); } }, TEMPO_DEMORA);
      ouvir(PROD, 'produtos'); ouvir(NODE, 'registros'); ouvir(VIG, 'vigentes'); ouvir(DEC, 'decisoes');
      /* o gate precisa do motor de P1–P16 carregado (antes disso: "Verificando…", nunca "atual" nem "desatualizado") */
      if (window.faMotorArquitetura && !ligar._motor) { ligar._motor = true; window.faMotorArquitetura.onMudanca(function () { render(); }); }
      ligarNomes();
    }
    function desligar() {
      ouvintes.forEach(function (cancelar) { cancelar(); });
      ouvintes = []; ligado = false; clearTimeout(relogio);
      state.produtos = state.registros = state.vigentes = state.decisoes = undefined;
    }
    /* troca de pessoa sem recarregar: nada do estado anterior sobrevive */
    var pessoa = sessaoEmail();
    function aoMudarSessao() {
      var agora = sessaoEmail();
      if (pessoa && pessoa !== agora) { desligar(); desligarCadastro(); state = novoEstado(); }
      pessoa = agora;
      if (!wrap.hidden) { if (modo === 'mapa') ligarNomes(); else ligar(); render(); }
    }
    ['fa-auth-ready', 'fa-auth-change', 'fa-avaliacao-ready', 'fa-admin-ready'].forEach(function (ev) { window.addEventListener(ev, aoMudarSessao); });
    window.addEventListener('hashchange', function () {
      if (mfDoEndereco()) aplicarEndereco(); else if (!wrap.hidden) fecharPainel();
    });
    var api = { abrir: function () { aplicarEndereco(); }, aplicarEndereco: aplicarEndereco, fechar: function () { fecharPainel(); }, aberto: function () { return !wrap.hidden; } };
    if (mfDoEndereco()) aplicarEndereco();
    return api;
  }

  window.faInitCatalogoMapa = function () {
    if (window.faMapaFloresta) return;
    var api = montar();
    if (api) window.faMapaFloresta = api;
  };
  /* Carga direta em #avaliacoes?mf=… (F5, link): em máquina lenta a página pode abrir antes de este arquivo carregar */
  if (/^#avaliacoes\?(.*&)?mf=/.test(location.hash || '')) window.faInitCatalogoMapa();
})();
