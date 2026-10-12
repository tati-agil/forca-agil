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
     deps:  { B: faBaseProdutoServico, ctxMotor, gateDoItem, posicionamentoEfetivo, codigosFirmes }.
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
  function P() { return window.faPosicionamentos; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function spanNome(c) { return P() ? P().spanNome(c, 'mf-nome') : esc(c); }
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

    /* ---- painel e identidade da página (como o Posicionamento e a Squad) ---- */
    var identidadeOriginal = null;
    function hero() { var s = wrap.closest('.page-section'); return s && s.querySelector('.page-hero'); }
    function trocarIdentidade(meu) {
      var h = hero();
      if (!h) return;
      var eyebrow = h.querySelector('.eyebrow'), h1 = h.querySelector('h1'), p = h.querySelector('p');
      if (meu && !identidadeOriginal) identidadeOriginal = { eyebrow: eyebrow ? eyebrow.textContent : '', h1: h1 ? h1.textContent : '', p: p ? p.textContent : '' };
      if (!meu && !identidadeOriginal) return;
      var t = meu ? { eyebrow: 'Mapa da Floresta', h1: 'Catálogo preparatório do Mapa da Floresta',
        p: 'Os objetos avaliados e o que falta para cada um chegar ao Mapa. Ainda não é o Mapa visual.' } : identidadeOriginal;
      if (eyebrow) eyebrow.textContent = t.eyebrow;
      if (h1) h1.textContent = t.h1;
      if (p) p.textContent = t.p;
      h.classList.toggle('page-hero--mapa', !!meu);
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
      var m = /[?&]mf=([^&]*)/.exec(h);
      return m ? decodeURIComponent(m[1]) : null;
    }
    var DESEJADO = '#avaliacoes?mf=catalogo';
    function sincronizarEndereco() {
      if (wrap.hidden || location.hash === DESEJADO || (location.hash || '').split('?')[0] !== '#avaliacoes') return;
      /* avp:1 — a entrada é reconhecida por avaliacao-produto.js (que não a reescreve) */
      history.pushState({ avp: 1, seq: Date.now(), origem: null, mfAnterior: location.hash || '#avaliacoes' }, '', DESEJADO);
    }
    function sairParaAvaliacoes() {
      var st = history.state;
      if (st && st.mfAnterior && st.mfAnterior.split('?')[0] === '#avaliacoes' && !/[?&](po|sq|mf)=/.test(st.mfAnterior)) { history.back(); return; }
      history.replaceState({ avp: 1, seq: Date.now(), origem: null }, '', '#avaliacoes');
      fecharPainel();
    }
    function aplicarEndereco() {
      mostrarPainel();
      ligar();
      render();
      sincronizarEndereco();
      /* outros ouvintes do mesmo evento podem rodar depois deste: reafirma o painel no fim da fila */
      setTimeout(function () { if (mfDoEndereco() && !wrap.hidden) mostrarPainel(); }, 0);
    }

    /* ---- dependências do núcleo ---- */
    function deps() {
      var B = window.faBaseProdutoServico;
      return { B: B, ctxMotor: B ? B.contextoMotorAtual() : null, gateDoItem: window.faAvaliacaoPosicionamentoNucleo.gateDoItem,
        posicionamentoEfetivo: window.faEstruturasNucleo.posicionamentoEfetivo, codigosFirmes: window.faMotorPosicionamentoNucleo.CODIGOS_FIRMES };
    }
    function modulosProntos() {
      return !!(window.faBaseProdutoServico && window.faAvaliacaoPosicionamentoNucleo && window.faEstruturasNucleo && window.faMotorPosicionamentoNucleo);
    }
    function cats() { return C.categorias(window.faMotorPosicionamentoNucleo); }

    /* ===================== RENDER ===================== */
    function render() {
      if (wrap.hidden) return;
      var ativo = document.activeElement, foco = null;
      if (ativo && ativo.id && wrap.contains(ativo) && /^(INPUT|SELECT)$/.test(ativo.tagName)) foco = { id: ativo.id, ini: ativo.selectionStart, fim: ativo.selectionEnd };
      var h = '<button type="button" class="avp-voltar-link" id="mfVoltar">← Voltar para Avaliações</button>';
      h += '<div class="avp-form-card mf-card" id="mfCatalogo">' +
        '<p class="avp-intro">O Mapa da Floresta vai representar as estruturas organizacionais concretas de três categorias. Os produtos, serviços e demais objetos avaliados ' +
        'não viram nós do Mapa: aparecerão indiretamente, nos detalhes da estrutura responsável, quando essa associação for registrada. ' +
        'Este catálogo mostra, a partir das avaliações já gravadas, em que ponto cada objeto está. Nada aqui é gravado.</p>' +
        '<div class="mf-aviso-estruturas" id="mfAvisoEstruturas" role="note"><strong>Estruturas Organizacionais Concretas: informação indisponível nesta versão.</strong> ' + esc(TEXTO_ESTRUTURAS) + '</div>';
      if (!autorizacaoResolvida()) h += '<p class="loading-msg" role="status">Carregando…</p>';
      else if (!podeLer()) h += '<p class="avp-error-msg" id="mfSemAcesso">Este catálogo é consultado pelos perfis da Avaliação de Produto/Serviço (Avaliação, Avaliação + Arquitetura e administração geral). Seu acesso não inclui essa consulta.</p>';
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
      h += '</dl><div class="mf-item-acoes">';
      if (x.posicionamento) h += '<a class="btn btn--sm mf-abrir-po" href="#avaliacoes?po=' + encodeURIComponent(x.posicionamento.avaliacaoId) + '">Abrir Posicionamento</a>';
      else if (x.rascunhoId) h += '<a class="btn btn--sm mf-abrir-po" href="#avaliacoes?po=' + encodeURIComponent(x.rascunhoId) + '">Abrir rascunho do Posicionamento</a>';
      if (x.chaveBase) h += '<a class="btn btn--sm mf-abrir-avp" href="#avaliacoes?' + (x.statusBase === 'rascunho' ? 'editar=' : 'avp=') + encodeURIComponent(x.chaveBase) + '">Abrir Avaliação de Produto/Serviço</a>';
      return h + '</div></li>';
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
      if (P() && !ligar._nomes) { ligar._nomes = true; P().onMudanca(function () { if (!wrap.hidden) render(); }); }
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
      if (pessoa && pessoa !== agora) { desligar(); state = novoEstado(); }
      pessoa = agora;
      if (!wrap.hidden) { ligar(); render(); }
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
