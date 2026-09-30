/* ============================================================
   Força Ágil — Avaliação de Adequação à Gestão por Squad (S1-S8)

   Eixo TOTALMENTE INDEPENDENTE da classificação arquitetural
   (avaliacao-produto.js):
     P1-P16 respondem O QUE o item É arquiteturalmente.
     S1-S8  respondem se FAZ SENTIDO organizar uma squad dedicada
            para cuidar desse item.
   Nunca existe regra "Produto/Serviço principal = squad" nem
   "Unidade de Valor = não squad" — a decisão sobre squad vem só das
   respostas S1-S8, interpretadas por window.faMotorSquad (ver
   motor-squad.js) — um motor SEPARADO, sem nenhuma regra compartilhada
   com identificarCamada, e com seu próprio eixo de versionamento
   (motorSquadVersion, nunca motorVersion).

   A interpretação (ver motor-squad.js) nunca é um placar: não soma SIM,
   não calcula score/percentual, não classifica Alta/Média/Baixa adequação
   nem decide sozinha "criar/não criar squad" — produz uma INDICAÇÃO
   ORGANIZACIONAL de apoio à decisão, sempre a partir de condições lógicas
   com precedência explícita sobre dois eixos preservados separadamente
   (necessidade de capacidade dedicada / condições para a squad funcionar).
   A ferramenta apoia a decisão; quem decide continua sendo a organização.

   Reutiliza inteiramente a fundação de parametrização de questionários
   (window.faQuestionarios, ver questionarios-config.js e a PR que a
   introduziu): as 8 perguntas (código estável S1-S8, título, texto,
   ajuda, exemplo) vêm de window.faQuestionarios.conteudoPergunta('ADEQUACAO_SQUAD', ...),
   nunca hardcoded aqui — só o texto de fábrica dentro do próprio módulo
   de configuração serve de fallback. A tela "⚙ Configuração dos
   Questionários" (avaliacao-produto.js) já administra os dois
   questionários (CLASSIFICACAO_ARQUITETURAL e ADEQUACAO_SQUAD) sem
   nenhuma tela nova — nada aqui duplica essa administração.

   Node do Firebase: avaliacoes-squad/<key> = {
     itemId: agrupa avaliações de squad do MESMO item (quando vinda de um
       item arquitetural, é o itemId daquele item — estável mesmo que o
       item seja reavaliado depois; sem vínculo, é a própria chave),
     itemNome, avaliacaoArquiteturalId: chave da avaliação arquitetural
       específica que estava aberta quando esta avaliação começou (só
       contexto/referência, nunca usada para decidir nada aqui),
     questionarioCodigo: sempre 'ADEQUACAO_SQUAD',
     questionnaireContentVersion: fixada ao iniciar, nunca trocada sozinha
       enquanto a avaliação está em andamento (mesmo princípio de
       avaliacao-produto.js),
     status: 'rascunho' | 'concluido' — MESMO padrão já usado em
       avaliacoes-produto, nunca EM_ANDAMENTO/CONCLUIDA (não inventar
       nomenclatura nova onde já existe uma),
     criadoEm, atualizadoEm, dataConclusao,
     criadoPor, atualizadoPor: {name, email},
     respostas: { <codigoEstavel>: { codigoPergunta, tituloNaEpoca,
       textoPerguntaNaEpoca, resposta: 'sim'|'nao', justificativaUsuario,
       questionnaireContentVersion, dataResposta } } — snapshot completo
       gravado no momento de CADA resposta, pelo mesmo motivo de P1-P16:
       se S5 mudar de redação amanhã, esta avaliação continua mostrando a
       redação de quando foi respondida,
     excluido/excluidoEm/excluidoPor/justificativaExclusao: soft-delete,
       mesmo padrão de avaliacoes-produto,
     motorSquadVersion: versão das REGRAS do motor de squad (ver
       motor-squad.js) vigente quando esta avaliação foi CONCLUÍDA/
       reprocessada — eixo TOTALMENTE independente de
       questionnaireContentVersion (texto das perguntas) e de motorVersion
       (motor arquitetural); gravada só ao concluir/reprocessar, nunca ao
       salvar rascunho,
     necessidadeCapacidadeDedicada: 'DEMONSTRADA' | 'PARCIALMENTE_DEMONSTRADA'
       | 'NAO_DEMONSTRADA' — Eixo A do motor (S1/S2/S4/S5),
     condicoesParaSquad: 'PRESENTES' | 'PARCIAIS' | 'LIMITADAS_PELA_AUTONOMIA'
       — Eixo B do motor (S3/S6/S7/S8; S7 tem precedência estrutural),
     indicacaoOrganizacional: um dos 5 códigos que combinam os dois eixos
       acima (ver motor-squad.js) — nunca lê S1-S8 diretamente,
     evidenciasFavoraveis, pontosADesenvolver: arrays de códigos S1-S8
       (nunca texto), derivados diretamente das respostas SIM/NÃO,
     historicoMotorSquad: [{ motorSquadVersion, necessidadeCapacidadeDedicada,
       condicoesParaSquad, indicacaoOrganizacional, evidenciasFavoraveis,
       pontosADesenvolver, processadoEm }] — a interpretação anterior migra
       pra cá (mais antiga primeiro) sempre que REPROCESSAR COM MOTOR DE
       SQUAD ATUAL substitui o resultado; nunca reescrita nem apagada,
     resultadoAutomatico, justificativaResultado, decisaoFinal,
       formaDecisao: reservados para uma FUTURA decisão organizacional
       explícita (registrar concordância/divergência com a indicação, como
       "Decisão arquitetural" faz para P1-P16) — sempre null nesta versão,
       nunca calculados: esta PR entrega a INDICAÇÃO, não a decisão.

   A interpretação (necessidadeCapacidadeDedicada/condicoesParaSquad/
   indicacaoOrganizacional) NUNCA recalcula sozinha quando uma nova versão
   do motor é publicada — uma avaliação concluída continua mostrando,
   para sempre, o resultado que o motor produziu na sua própria
   motorSquadVersion, exatamente como o histórico de P1-P16 preserva
   motorVersion; só "REPROCESSAR COM MOTOR DE SQUAD ATUAL" (ação explícita)
   atualiza. */
(function () {
  var NODE = 'avaliacoes-squad';
  var NODE_ARQUITETURA = 'avaliacoes-produto';
  var CODIGO_QUESTIONARIO = 'ADEQUACAO_SQUAD';
  var ORDEM_CODIGOS = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'];

  function db() { return firebase.database(); }
  function esc(s) {
    return String(s || '').replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fmtData(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  function sessaoAtual() {
    var sess = window.faAuth && window.faAuth.getSession();
    return sess ? { name: sess.name || sess.email, email: sess.email } : null;
  }
  function conteudoDe(codigoEstavel, versao) {
    return window.faQuestionarios.conteudoPergunta(CODIGO_QUESTIONARIO, codigoEstavel, versao);
  }
  function perguntasOrdenadas(versao) {
    var lista = window.faQuestionarios.perguntasDaVersao(CODIGO_QUESTIONARIO, versao);
    var porCodigo = {};
    lista.forEach(function (p) { porCodigo[p.codigoEstavel] = p; });
    return ORDEM_CODIGOS.map(function (c) { return porCodigo[c] || conteudoDe(c, versao); });
  }

  /* ---- modais próprios (mesmo padrão visual do resto do admin, sem
     depender de outro módulo) ---- */
  function sqAlert(mensagem, callbackOk) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9999';
    var box = document.createElement('div');
    box.className = 'modal-box';
    box.style.cssText = 'max-width:420px;width:90%;padding:28px;display:flex;flex-direction:column;gap:18px';
    box.innerHTML =
      '<p style="font-size:.95rem;line-height:1.6;color:var(--ink);white-space:pre-line">' + esc(mensagem) + '</p>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn btn--primary sq-modal-ok-btn">OK</button></div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function fechar() { document.body.removeChild(overlay); if (callbackOk) callbackOk(); }
    box.querySelector('.sq-modal-ok-btn').addEventListener('click', fechar);
  }
  function sqConfirm(mensagem, callbackSim) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9999';
    var box = document.createElement('div');
    box.className = 'modal-box';
    box.style.cssText = 'max-width:460px;width:90%;padding:28px;display:flex;flex-direction:column;gap:18px';
    box.innerHTML =
      '<p style="font-size:.95rem;line-height:1.6;color:var(--ink);white-space:pre-line">' + esc(mensagem) + '</p>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px">' +
      '<button class="btn sq-modal-cancelar-btn">Cancelar</button>' +
      '<button class="btn btn--primary sq-modal-confirm-btn">Sim</button></div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function fechar() { document.body.removeChild(overlay); }
    box.querySelector('.sq-modal-cancelar-btn').addEventListener('click', fechar);
    box.querySelector('.sq-modal-confirm-btn').addEventListener('click', function () { fechar(); callbackSim(); });
  }

  function carregarScript(src, jaDisponivel, cb) {
    if (jaDisponivel()) { cb(null); return; }
    var el = document.querySelector('script[data-sq-lib="' + src + '"]');
    if (el) { el.addEventListener('load', function () { cb(null); }); el.addEventListener('error', function () { cb(new Error('falha ao carregar ' + src)); }); return; }
    var script = document.createElement('script');
    script.src = src;
    script.setAttribute('data-sq-lib', src);
    script.onload = function () { cb(null); };
    script.onerror = function () { cb(new Error('falha ao carregar ' + src)); };
    document.body.appendChild(script);
  }

  window.faInitAvaliacaoSquad = function () {
    var wrap = document.getElementById('adminAvaliacaoSquad');
    if (!wrap || wrap._sqBound) return;
    wrap._sqBound = true;

    var state = {
      tela: 'lista', /* 'lista' | 'form-inicial' | 'checklist' | 'resultado' | 'carregando' | 'nao-encontrada' */
      itens: [],
      itensCarregados: false,
      atual: null,
      contextoArquitetural: null, /* { label, resultadoAutomatico } | null | 'carregando' — só leitura, ver renderContextoArquitetural */
      erroForm: null,
      salvando: null,      /* null | 'rascunho' | 'concluido' */
      reprocessando: false,
      flashLista: null,
      flashResultado: null,
      exportando: false,
      flashExportacao: null,
      filtroTexto: '',
      motorConfig: null, /* null fora da tela de configuração do motor; ver abrirMotorConfig */
      itensArquitetura: [],
      itensArquiteturaCarregados: false
    };

    function buscarItem(key) { return state.itens.filter(function (it) { return it._key === key; })[0]; }
    function clonarItem(it) { return JSON.parse(JSON.stringify(it)); }
    /* Mesmo critério de "versão superada" de avaliacao-produto.js
       (temVersaoMaisNova): uma versão arquitetural só entra na busca de
       item quando nenhuma reavaliação mais nova aponta pra ela via
       versaoAnteriorKey — a busca sempre mostra a classificação ATUAL do
       item, nunca uma versão antiga dele. */
    function temVersaoMaisNovaArquitetura(key) {
      return state.itensArquitetura.some(function (o) { return o.versaoAnteriorKey === key; });
    }
    /* Combina os itens "buscáveis" pra Parte A (seleção de item já
       cadastrado, em vez de digitar o nome de novo): itens arquiteturais
       (avaliacoes-produto, só a versão mais nova de cada itemId, com a
       classificação atual pra mostrar como contexto) + itens "só de squad"
       (avaliacoes-squad sem avaliacaoArquiteturalId — nunca passaram por
       classificação arquitetural). Nunca cria um cadastro de item paralelo:
       lê os dois nodes que já existem. */
    function itensDisponiveisParaBusca() {
      var porItemId = {};
      state.itensArquitetura.forEach(function (it) {
        if (it.excluido) return;
        if (temVersaoMaisNovaArquitetura(it._key)) return;
        var id = it.itemId || it._key;
        porItemId[id] = {
          itemId: id,
          itemNome: it.nome,
          avaliacaoArquiteturalId: it._key,
          classificacaoLabel: (it.status === 'concluido' && it.camadaSugerida && it.camadaSugerida.label) || null
        };
      });
      state.itens.forEach(function (it) {
        if (it.excluido || it.avaliacaoArquiteturalId) return;
        var id = it.itemId || it._key;
        if (porItemId[id]) return;
        porItemId[id] = { itemId: id, itemNome: it.itemNome, avaliacaoArquiteturalId: null, classificacaoLabel: null };
      });
      return Object.keys(porItemId).map(function (id) { return porItemId[id]; });
    }
    /* Dedup por itemId (item 8/12 do pedido original + Parte A): nunca cria
       uma segunda avaliação de squad EM ANDAMENTO para o mesmo item, venha
       a seleção de onde vier (busca aqui ou botão "AVALIAR ADEQUAÇÃO À
       SQUAD" em avaliacao-produto.js). */
    function buscarEmAndamentoPorItemId(itemId) {
      return state.itens.filter(function (it) { return !it.excluido && it.status === 'rascunho' && it.itemId === itemId; })[0];
    }
    function selecionarItemParaAvaliacao(item) {
      if (item.itemId) {
        var emAndamento = buscarEmAndamentoPorItemId(item.itemId);
        if (emAndamento) { abrirExistente(emAndamento._key); return; }
      }
      state.atual.itemId = item.itemId || null;
      state.atual.itemNome = item.itemNome;
      state.atual.avaliacaoArquiteturalId = item.avaliacaoArquiteturalId || null;
      state.erroForm = null;
      state.tela = 'checklist';
      render();
      carregarContextoArquitetural();
    }

    function mostrarPainel() {
      var arqWrap = document.getElementById('adminAvaliacaoProduto');
      if (arqWrap) arqWrap.hidden = true;
      wrap.hidden = false;
    }
    function voltarParaArquitetura() {
      wrap.hidden = true;
      var arqWrap = document.getElementById('adminAvaliacaoProduto');
      if (arqWrap) arqWrap.hidden = false;
    }

    function render() {
      if (state.tela === 'lista') renderLista();
      else if (state.tela === 'form-inicial') renderFormInicial();
      else if (state.tela === 'checklist') renderChecklist();
      else if (state.tela === 'resultado') renderResultadoSquad();
      else if (state.tela === 'motor-config') renderMotorConfig();
      else if (state.tela === 'carregando') { wrap.innerHTML = '<p class="loading-msg">Carregando…</p>'; }
      else if (state.tela === 'nao-encontrada') {
        wrap.innerHTML = '<p class="admin-empty">Avaliação de squad não encontrada.</p>' +
          '<button class="btn" id="sqVoltarNaoEncontrada">‹ Adequação à Squad</button>';
        document.getElementById('sqVoltarNaoEncontrada').addEventListener('click', function () { state.tela = 'lista'; render(); });
      }
    }

    /* ===================== LISTA ===================== */
    function renderLista() {
      var ativos = state.itens.filter(function (it) { return !it.excluido; });
      var filtro = (state.filtroTexto || '').trim().toLowerCase();
      var filtrados = filtro ? ativos.filter(function (it) { return (it.itemNome || '').toLowerCase().indexOf(filtro) !== -1; }) : ativos;

      var html = '<button class="avp-voltar-link" id="sqVoltarArquitetura">‹ Avaliações de Produto/Serviço</button>';
      html += '<div class="avp-intro"><p><strong>Adequação à gestão por Squad:</strong> registra evidências (S1 a S8) sobre demanda, evolução, ' +
        'autonomia, complexidade e ownership de um item — completamente independente da classificação arquitetural (P1-P16) do mesmo item. ' +
        'Nenhuma das duas decide a outra.</p></div>';
      if (state.flashLista) {
        html += '<div class="avp-flash-success" id="sqFlashLista">' + esc(state.flashLista) +
          ' <button type="button" class="avp-flash-close" id="sqFlashListaClose" aria-label="Fechar">×</button></div>';
      }
      html += '<div class="avp-actions-bar">';
      html += '<span class="avp-total">' + ativos.length + ' avaliaç' + (ativos.length === 1 ? 'ão' : 'ões') + ' de squad registrada' + (ativos.length === 1 ? '' : 's') + '</span>';
      html += '<button class="btn btn--primary" id="sqNovaBtn">+ Nova avaliação de squad</button>';
      html += '<button class="btn btn--sm" id="sqMotorConfigBtn">⚙ Configuração do Motor de Squad</button>';
      html += '</div>';
      html += '<div class="avp-filters"><input type="text" id="sqFiltroTexto" placeholder="Filtrar por nome do item…" value="' + esc(state.filtroTexto) + '"></div>';

      if (!filtrados.length) {
        html += '<p class="admin-empty">' + (ativos.length ? 'Nenhuma avaliação de squad para esse filtro.' : 'Nenhuma avaliação de squad registrada ainda.') + '</p>';
      } else {
        html += '<div class="table-scroll-wrap"><table class="admin-table avp-table"><thead><tr>' +
          '<th>Item</th><th>Status</th><th>Versão do questionário</th><th>Responsável</th><th>Data</th><th>Ações</th></tr></thead><tbody>';
        filtrados.slice().sort(function (a, b) { return (b.atualizadoEm || '').localeCompare(a.atualizadoEm || ''); }).forEach(function (it) {
          html += '<tr>';
          html += '<td data-label="Item">' + esc(it.itemNome) + '</td>';
          html += '<td data-label="Status">' + (it.status === 'concluido' ? 'Concluída' : 'Rascunho') + '</td>';
          html += '<td data-label="Versão do questionário">' + esc(it.questionnaireContentVersion || 1) + '</td>';
          html += '<td data-label="Responsável">' + esc((it.criadoPor && it.criadoPor.name) || '—') + '</td>';
          html += '<td data-label="Data">' + fmtData(it.criadoEm) + '</td>';
          html += '<td data-label="Ações"><button class="btn btn--sm sq-act-abrir" data-key="' + it._key + '">' +
            (it.status === 'concluido' ? 'Visualizar' : 'Continuar') + '</button></td>';
          html += '</tr>';
        });
        html += '</tbody></table></div>';
      }
      wrap.innerHTML = html;

      document.getElementById('sqVoltarArquitetura').addEventListener('click', voltarParaArquitetura);
      var flashClose = document.getElementById('sqFlashListaClose');
      if (flashClose) flashClose.addEventListener('click', function () { state.flashLista = null; render(); });
      document.getElementById('sqFiltroTexto').addEventListener('input', function (e) { state.filtroTexto = e.target.value; render(); });
      document.getElementById('sqNovaBtn').addEventListener('click', function () {
        iniciarNovaAvaliacao({ itemId: null, itemNome: '', avaliacaoArquiteturalId: null });
      });
      document.getElementById('sqMotorConfigBtn').addEventListener('click', abrirMotorConfig);
      wrap.querySelectorAll('.sq-act-abrir').forEach(function (btn) {
        btn.addEventListener('click', function () { abrirExistente(btn.dataset.key); });
      });
    }

    /* ===================== INÍCIO / RETOMADA (dedup por itemId) ===================== */
    function iniciarNovaAvaliacao(opts) {
      state.atual = {
        itemId: opts.itemId || null, itemNome: opts.itemNome || '',
        avaliacaoArquiteturalId: opts.avaliacaoArquiteturalId || null,
        respostas: {}, questionnaireContentVersion: window.faQuestionarios.versaoAtual(CODIGO_QUESTIONARIO)
      };
      state.erroForm = null;
      state.contextoArquitetural = null;
      /* Item já identificado (ex.: veio do botão "AVALIAR ADEQUAÇÃO À SQUAD"
         de um item arquitetural aberto) — nunca pergunta o nome de novo
         (Parte A do pedido): pula direto pro checklist. */
      if (opts.itemId && opts.itemNome) {
        state.tela = 'checklist';
        render();
        carregarContextoArquitetural();
        return;
      }
      state.tela = 'form-inicial';
      render();
    }
    function abrirExistente(key) {
      var it = buscarItem(key);
      if (!it) { state.tela = 'nao-encontrada'; render(); return; }
      state.atual = clonarItem(it);
      state.contextoArquitetural = null;
      state.tela = it.status === 'concluido' ? 'resultado' : 'checklist';
      render();
      carregarContextoArquitetural();
    }
    /* Ponto de entrada chamado por avaliacao-produto.js (botão "AVALIAR
       ADEQUAÇÃO À SQUAD" no resultado de um item arquitetural) — nunca cria
       uma segunda avaliação de squad em andamento para o MESMO itemId
       (item 8/12 do pedido: retomar nunca duplica). */
    window.faAvaliacaoSquad = {
      abrirLista: function () { mostrarPainel(); state.tela = 'lista'; state.filtroTexto = ''; render(); },
      iniciarOuAbrirParaItem: function (opts) {
        mostrarPainel();
        var emAndamento = buscarEmAndamentoPorItemId(opts.itemId);
        if (emAndamento) { abrirExistente(emAndamento._key); return; }
        iniciarNovaAvaliacao(opts);
      },
      abrirMotorConfig: abrirMotorConfig
    };

    /* Contexto arquitetural (item 11) — SOMENTE LEITURA, nunca usado para
       decidir nada aqui; uma leitura avulsa (não reativa) da avaliação
       arquitetural referenciada, só para mostrar "Classificação
       arquitetural atual" ao lado das perguntas de squad. */
    function carregarContextoArquitetural() {
      var id = state.atual && state.atual.avaliacaoArquiteturalId;
      if (!id) { state.contextoArquitetural = null; return; }
      state.contextoArquitetural = 'carregando';
      db().ref(NODE_ARQUITETURA + '/' + id).once('value', function (snap) {
        var v = snap.val();
        state.contextoArquitetural = v ? {
          label: (v.camadaSugerida && v.camadaSugerida.label) || '—',
          resultado: v.resultadoAutomatico
        } : null;
        render();
      }, function () { state.contextoArquitetural = null; render(); });
    }
    function renderContextoArquitetural() {
      var c = state.contextoArquitetural;
      if (!c || c === 'carregando') return '';
      return '<div class="avp-form-card sq-contexto-arquitetural">' +
        '<p>Classificação arquitetural: <strong>' + esc(c.label) + '</strong></p>' +
        '<p class="avp-decisao-aviso">A classificação arquitetural e a avaliação de adequação à gestão por Squad são análises independentes. ' +
        'Esta informação é só contexto de leitura e nunca entra no cálculo desta avaliação.</p></div>';
    }

    /* ===================== FORM INICIAL (busca de item já cadastrado) =====================
       Parte A do pedido: nunca mais um campo de texto livre como única
       identificação do item — busca/seleciona um item JÁ cadastrado
       (arquitetural ou só de squad, ver itensDisponiveisParaBusca) pra
       nunca duplicar o mesmo item por variação de grafia do nome
       ("Regularização de Dívida Previdenciária" vs "Regularização Dívida
       Previdenciária"). Um item genuinamente novo (nunca avaliado, nem
       arquiteturalmente nem por squad) continua podendo ser cadastrado —
       o problema que esta tela resolve é o de RETIPAR um item que já
       existe, não o de impedir cadastro de item novo. A busca manipula só
       a lista de resultados diretamente no DOM (nunca o render() inteiro do
       módulo a cada tecla) pra nunca perder o foco do campo — mesmo padrão
       já usado em admin.js (＋ Participante / Incluir pessoa). */
    function renderFormInicial() {
      var html = '<button class="avp-voltar-link" id="sqVoltarListaInicial">‹ Adequação à Squad</button>';
      html += '<div class="avp-form-card">';
      html += '<h3>Avaliação de Adequação à Gestão por Squad</h3>';
      html += '<p class="avp-decisao-aviso">Esta avaliação não altera a classificação arquitetural do item. Seu objetivo é registrar evidências ' +
        'sobre demanda, evolução, autonomia, complexidade e ownership para apoiar a decisão organizacional sobre gestão por squad.</p>';
      html += '<div class="avp-field' + (state.erroForm ? ' avp-field--invalid' : '') + '">';
      html += '<label for="sqfBusca">Buscar item já cadastrado *</label>';
      html += '<input type="text" id="sqfBusca" placeholder="Digite o nome do item…" autocomplete="off">';
      html += '<ul class="sq-busca-resultados" id="sqfBuscaResultados" hidden></ul>';
      if (state.erroForm) html += '<p class="avp-field-invalid-msg">' + esc(state.erroForm) + '</p>';
      html += '</div>';
      html += '<p class="sq-busca-ajuda">Não encontrou o item na busca? ' +
        '<button type="button" class="link-btn" id="sqfNovoItemBtn">+ Cadastrar como item novo</button></p>';
      html += '<div class="avp-field" id="sqfNovoItemWrap" hidden>';
      html += '<label for="sqfNovoItemNome">Nome do novo item *</label>';
      html += '<input type="text" id="sqfNovoItemNome" autocomplete="off">';
      html += '<button type="button" class="btn btn--sm" id="sqfNovoItemConfirmar">Usar este nome e continuar</button>';
      html += '</div>';
      html += '</div>';
      html += '<div class="avp-actions-footer">';
      html += '<button class="btn" id="sqCancelarInicialBtn">CANCELAR</button>';
      html += '</div>';
      wrap.innerHTML = html;

      document.getElementById('sqVoltarListaInicial').addEventListener('click', function () { state.tela = 'lista'; state.atual = null; render(); });
      document.getElementById('sqCancelarInicialBtn').addEventListener('click', function () { state.tela = 'lista'; state.atual = null; render(); });

      var itensDisponiveis = itensDisponiveisParaBusca();
      var buscaInput = document.getElementById('sqfBusca');
      var resultsList = document.getElementById('sqfBuscaResultados');
      function renderResultados(query) {
        var q = query.trim().toLowerCase();
        if (!q) { resultsList.hidden = true; resultsList.innerHTML = ''; return; }
        var matches = itensDisponiveis.filter(function (it) {
          return (it.itemNome || '').toLowerCase().indexOf(q) !== -1;
        }).slice(0, 8);
        resultsList.innerHTML = '';
        if (!matches.length) {
          var li0 = document.createElement('li');
          li0.className = 'sq-busca-item sq-busca-item--vazio';
          li0.textContent = 'Nenhum item cadastrado encontrado para esse termo.';
          resultsList.appendChild(li0);
        } else {
          matches.forEach(function (it) {
            var li = document.createElement('li');
            li.className = 'sq-busca-item';
            li.innerHTML = '<span class="sq-busca-item-nome">' + esc(it.itemNome) + '</span>' +
              '<span class="sq-busca-item-classif">' + (it.classificacaoLabel ? esc(it.classificacaoLabel) : 'Sem avaliação arquitetural') + '</span>';
            li.addEventListener('click', function () { selecionarItemParaAvaliacao(it); });
            resultsList.appendChild(li);
          });
        }
        resultsList.hidden = false;
      }
      buscaInput.addEventListener('input', function () { renderResultados(buscaInput.value); });

      var novoItemBtn = document.getElementById('sqfNovoItemBtn');
      var novoItemWrap = document.getElementById('sqfNovoItemWrap');
      novoItemBtn.addEventListener('click', function () {
        novoItemWrap.hidden = false;
        novoItemBtn.parentNode.hidden = true;
        document.getElementById('sqfNovoItemNome').focus();
      });
      document.getElementById('sqfNovoItemConfirmar').addEventListener('click', function () {
        var nome = document.getElementById('sqfNovoItemNome').value.trim();
        if (!nome) { state.erroForm = 'Informe o nome do novo item.'; render(); return; }
        selecionarItemParaAvaliacao({ itemId: null, itemNome: nome, avaliacaoArquiteturalId: null });
      });
    }

    /* ===================== CHECKLIST S1-S8 ===================== */
    function renderChecklist() {
      var a = state.atual;
      var perguntas = perguntasOrdenadas(a.questionnaireContentVersion);
      var html = '<button class="avp-voltar-link" id="sqVoltarListaChecklist">‹ Adequação à Squad</button>';
      html += '<div class="avp-form-card"><h3>' + esc(a.itemNome) + '</h3>';
      html += '<p class="avp-decisao-aviso">Esta avaliação não altera a classificação arquitetural do item. Seu objetivo é registrar evidências ' +
        'sobre demanda, evolução, autonomia, complexidade e ownership para apoiar a decisão organizacional sobre gestão por squad.</p>';
      html += renderContextoArquitetural();
      html += '</div>';

      if (state.erroForm) html += '<p class="avp-error-msg">' + esc(state.erroForm) + '</p>';

      var respondidas = ORDEM_CODIGOS.filter(function (c) { return a.respostas[c] && a.respostas[c].resposta; }).length;
      html += '<p class="avp-progresso-perguntas">' + respondidas + ' de ' + ORDEM_CODIGOS.length + ' perguntas respondidas</p>';

      html += '<div class="avp-criterios">';
      perguntas.forEach(function (p) { html += renderPerguntaSquad(p, a.respostas[p.codigoEstavel]); });
      html += '</div>';

      html += '<div class="avp-actions-footer">';
      html += '<button class="btn" id="sqSalvarRascunhoBtn"' + (state.salvando ? ' disabled' : '') + '>' +
        (state.salvando === 'rascunho' ? 'SALVANDO…' : 'SALVAR E SAIR') + '</button>';
      html += '<button class="btn btn--primary" id="sqConcluirBtn"' + (state.salvando ? ' disabled' : '') + '>' +
        (state.salvando === 'concluido' ? 'SALVANDO…' : 'CONCLUIR AVALIAÇÃO') + '</button>';
      html += '<button class="btn" id="sqCancelarChecklistBtn"' + (state.salvando ? ' disabled' : '') + '>CANCELAR</button>';
      html += '</div>';
      wrap.innerHTML = html;

      document.getElementById('sqVoltarListaChecklist').addEventListener('click', function () { cancelarChecklist(); });
      wrap.querySelectorAll('.sq-help-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var box = document.getElementById('sqHelp-' + btn.dataset.id);
          if (box) box.hidden = !box.hidden;
        });
      });
      wrap.querySelectorAll('.sq-choice-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var codigo = btn.closest('.sq-choice-group').dataset.codigo;
          var valor = btn.dataset.valor;
          var def = perguntas.filter(function (p) { return p.codigoEstavel === codigo; })[0];
          var justAnterior = (a.respostas[codigo] && a.respostas[codigo].justificativaUsuario) || '';
          /* Snapshot gravado NO MOMENTO da resposta (item 5 do pedido) —
             preserva a redação exata que a pessoa viu, mesmo que a pergunta
             seja republicada depois. */
          a.respostas[codigo] = {
            codigoPergunta: codigo,
            tituloNaEpoca: def.titulo || null,
            textoPerguntaNaEpoca: def.texto,
            resposta: valor,
            justificativaUsuario: justAnterior,
            questionnaireContentVersion: a.questionnaireContentVersion,
            dataResposta: new Date().toISOString()
          };
          state.erroForm = null;
          render();
        });
      });
      wrap.querySelectorAll('.sq-justificativa').forEach(function (ta) {
        ta.addEventListener('input', function () {
          var codigo = ta.dataset.codigo;
          if (a.respostas[codigo]) a.respostas[codigo].justificativaUsuario = ta.value;
        });
      });

      document.getElementById('sqSalvarRascunhoBtn').addEventListener('click', function () {
        if (state.salvando) return;
        if (!a.itemNome || !a.itemNome.trim()) { state.erroForm = 'Informe o nome do item.'; render(); return; }
        state.salvando = 'rascunho';
        render();
        salvarRegistro('rascunho', function () {
          state.salvando = null;
          state.tela = 'lista';
          state.flashLista = '✓ Rascunho salvo — "Continuar" na lista para retomar de onde parou.';
          render();
        }, function (tipo) {
          state.salvando = null;
          render();
          sqAlert(tipo === 'timeout'
            ? 'A conexão está demorando e não deu para confirmar o salvamento. Toque em "SALVAR E SAIR" de novo.'
            : 'Não foi possível salvar. Tente novamente.');
        });
      });
      document.getElementById('sqConcluirBtn').addEventListener('click', function () {
        if (state.salvando) return;
        var faltando = ORDEM_CODIGOS.filter(function (c) { return !a.respostas[c] || !a.respostas[c].resposta; });
        if (faltando.length) { state.erroForm = 'Responda todas as 8 perguntas antes de concluir.'; render(); return; }
        state.salvando = 'concluido';
        render();
        salvarRegistro('concluido', function (key) {
          state.salvando = null;
          state.atual._key = key;
          state.tela = 'resultado';
          state.flashResultado = '✓ Avaliação de squad concluída com sucesso.';
          render();
        }, function (tipo) {
          state.salvando = null;
          render();
          sqAlert(tipo === 'timeout'
            ? 'A conexão está demorando e não deu para confirmar a conclusão. Toque em "CONCLUIR AVALIAÇÃO" de novo.'
            : 'Não foi possível concluir. Tente novamente.');
        });
      });
      document.getElementById('sqCancelarChecklistBtn').addEventListener('click', function () { cancelarChecklist(); });
    }
    function cancelarChecklist() {
      if (state.salvando) return;
      sqConfirm('Sair sem salvar as alterações desta visita?', function () {
        state.atual = null;
        state.tela = 'lista';
        render();
      });
    }
    function renderPerguntaSquad(def, resposta) {
      var html = '<div class="avp-question" id="sqQuestion-' + def.codigoEstavel + '">';
      html += '<div class="avp-question-head">';
      html += '<span class="avp-question-num">' + def.codigoEstavel + '.</span>';
      html += '<p class="avp-question-text">' + esc(def.texto) + '</p>';
      html += '<button type="button" class="avp-help-btn sq-help-btn" data-id="' + def.codigoEstavel + '" aria-label="Ajuda sobre esta pergunta">?</button>';
      html += '</div>';
      html += '<div class="avp-help-box" id="sqHelp-' + def.codigoEstavel + '" hidden>';
      if (def.textoAjuda && def.textoAjuda.significado) html += '<p><strong>O que significa:</strong> ' + esc(def.textoAjuda.significado) + '</p>';
      if (def.exemplo) html += '<p><strong>Exemplo:</strong> ' + esc(def.exemplo) + '</p>';
      if (!def.textoAjuda && !def.exemplo) html += '<p><em>Sem ajuda adicional cadastrada para esta pergunta.</em></p>';
      html += '</div>';
      html += '<div class="avp-choice-group sq-choice-group" data-codigo="' + def.codigoEstavel + '">';
      html += '<button type="button" class="avp-choice-btn sq-choice-btn avp-choice-btn--sim' + (resposta && resposta.resposta === 'sim' ? ' active' : '') + '" data-valor="sim">SIM</button>';
      html += '<button type="button" class="avp-choice-btn sq-choice-btn avp-choice-btn--nao' + (resposta && resposta.resposta === 'nao' ? ' active' : '') + '" data-valor="nao">NÃO</button>';
      html += '</div>';
      if (resposta && resposta.resposta) {
        html += '<textarea class="avp-observacao sq-justificativa" data-codigo="' + def.codigoEstavel + '" placeholder="Justificativa (opcional)">' + esc(resposta.justificativaUsuario) + '</textarea>';
      }
      html += '</div>';
      return html;
    }

    /* ===================== SALVAR ===================== */
    /* Roda o motor de squad (window.faMotorSquad, ver motor-squad.js) só ao
       CONCLUIR — nunca sobre um rascunho parcialmente respondido — usando
       sempre a versão de regras PUBLICADA no momento (nunca um rascunho de
       regras ainda não publicado). O resultado gravado é definitivo até uma
       ação explícita de reprocessamento (ver reprocessarMotorSquad); nunca
       recalculado sozinho depois. */
    function interpretarComMotorAtual(respostas) {
      var versao = window.faMotorSquad.versaoAtual();
      var regras = window.faMotorSquad.regrasDaVersao(versao);
      var resultado = window.faMotorSquad.identificarAdequacaoSquad(respostas, regras);
      resultado.motorSquadVersion = versao;
      return resultado;
    }
    function salvarRegistro(status, cb, onErro) {
      var a = state.atual;
      var agora = new Date().toISOString();
      var key = a._key || db().ref(NODE).push().key;
      if (!a._key) a._key = key;
      var interpretacao = status === 'concluido'
        ? interpretarComMotorAtual(a.respostas)
        : { motorSquadVersion: null, necessidadeCapacidadeDedicada: null, condicoesParaSquad: null, indicacaoOrganizacional: null, evidenciasFavoraveis: null, pontosADesenvolver: null };
      var payload = {
        itemId: a.itemId || key, /* sem vínculo arquitetural, a própria chave agrupa (mesmo padrão de avaliacoes-produto) */
        itemNome: a.itemNome.trim(),
        avaliacaoArquiteturalId: a.avaliacaoArquiteturalId || null,
        questionarioCodigo: CODIGO_QUESTIONARIO,
        questionnaireContentVersion: a.questionnaireContentVersion || window.faQuestionarios.versaoAtual(CODIGO_QUESTIONARIO),
        status: status,
        criadoEm: a.criadoEm || agora,
        atualizadoEm: agora,
        dataConclusao: status === 'concluido' ? (a.dataConclusao || agora) : null,
        criadoPor: a.criadoPor || sessaoAtual(),
        atualizadoPor: sessaoAtual(),
        respostas: a.respostas || {},
        excluido: false, excluidoEm: null, excluidoPor: null, justificativaExclusao: null,
        motorSquadVersion: interpretacao.motorSquadVersion,
        necessidadeCapacidadeDedicada: interpretacao.necessidadeCapacidadeDedicada,
        condicoesParaSquad: interpretacao.condicoesParaSquad,
        indicacaoOrganizacional: interpretacao.indicacaoOrganizacional,
        evidenciasFavoraveis: interpretacao.evidenciasFavoraveis,
        pontosADesenvolver: interpretacao.pontosADesenvolver,
        historicoMotorSquad: a.historicoMotorSquad || [],
        /* Reservados para uma FUTURA decisão organizacional explícita —
           nunca calculados nesta versão: esta PR entrega a INDICAÇÃO, não
           uma decisão automática de criar/manter/extinguir squad. */
        resultadoAutomatico: null, justificativaResultado: null,
        decisaoFinal: null, formaDecisao: null
      };
      var ref = db().ref(NODE + '/' + key);
      var respondido = false;
      var relogio = setTimeout(function () {
        if (respondido) return;
        respondido = true;
        if (onErro) onErro('timeout');
      }, 12000);
      ref.set(payload, function (err) {
        if (respondido) return;
        respondido = true;
        clearTimeout(relogio);
        if (err) {
          console.error('[avaliacao-squad] erro ao salvar avaliação (' + status + '):', err);
          if (onErro) onErro('erro', err);
          return;
        }
        Object.assign(a, payload);
        if (cb) cb(key);
      });
    }

    /* ===================== REPROCESSAMENTO (motor de squad) =====================
       Ação EXPLÍCITA, nunca automática — publicar uma motorSquadVersion nova
       nunca recalcula avaliações já concluídas sozinho (item 16 do pedido).
       Estruturalmente idêntico ao reprocessarMotor de avaliacao-produto.js:
       preserva respostas/justificativas/snapshot e migra o resultado
       ANTERIOR para historicoMotorSquad antes de gravar o novo. */
    function precisaReprocessarMotorSquad(it) {
      return !!it && it.status === 'concluido' && it.motorSquadVersion !== window.faMotorSquad.versaoAtual();
    }
    function construirAtualizacaoReprocessamentoSquad(a) {
      var nova = interpretarComMotorAtual(a.respostas);
      var entradaHistorico = {
        motorSquadVersion: a.motorSquadVersion || null,
        necessidadeCapacidadeDedicada: a.necessidadeCapacidadeDedicada || null,
        condicoesParaSquad: a.condicoesParaSquad || null,
        indicacaoOrganizacional: a.indicacaoOrganizacional || null,
        evidenciasFavoraveis: a.evidenciasFavoraveis || null,
        pontosADesenvolver: a.pontosADesenvolver || null,
        processadoEm: a.atualizadoEm || a.criadoEm
      };
      var agora = new Date().toISOString();
      return {
        motorSquadVersion: nova.motorSquadVersion,
        necessidadeCapacidadeDedicada: nova.necessidadeCapacidadeDedicada,
        condicoesParaSquad: nova.condicoesParaSquad,
        indicacaoOrganizacional: nova.indicacaoOrganizacional,
        evidenciasFavoraveis: nova.evidenciasFavoraveis,
        pontosADesenvolver: nova.pontosADesenvolver,
        historicoMotorSquad: (a.historicoMotorSquad || []).concat([entradaHistorico]),
        reprocessedAt: agora,
        reprocessedFromVersion: a.motorSquadVersion || null,
        atualizadoEm: agora
      };
    }
    function reprocessarMotorSquad() {
      if (state.reprocessando) return;
      var a = state.atual;
      if (!precisaReprocessarMotorSquad(a)) return;
      var updates = construirAtualizacaoReprocessamentoSquad(a);
      state.reprocessando = true;
      render();
      var respondido = false;
      var relogio = setTimeout(function () {
        if (respondido) return;
        respondido = true;
        state.reprocessando = false;
        render();
        sqAlert('A conexão está demorando e não deu para confirmar o reprocessamento. Toque em "REPROCESSAR COM MOTOR DE SQUAD ATUAL" de novo.');
      }, 12000);
      db().ref(NODE + '/' + a._key).update(updates, function (err) {
        if (respondido) return;
        respondido = true;
        clearTimeout(relogio);
        state.reprocessando = false;
        if (err) {
          console.error('[avaliacao-squad] erro ao reprocessar motor de squad:', err);
          render();
          sqAlert('Não foi possível reprocessar. Tente novamente.');
          return;
        }
        Object.assign(a, updates);
        render();
      });
    }

    /* ===================== VEREDITO (Eixo A / Eixo B / Indicação) =====================
       Só apresentação: nunca recalcula nada aqui, sempre lê os códigos JÁ
       gravados na avaliação (necessidadeCapacidadeDedicada/condicoesParaSquad/
       indicacaoOrganizacional) e resolve rótulo/interpretação AO VIVO pelo
       texto publicado agora (window.faMotorSquad.conteudoTexto) — mudar só a
       redação de um veredito nunca precisa reprocessar nada (item 13). */
    function rotuloPergunta(a, codigo) {
      var r = a.respostas[codigo];
      return codigo + (r && (r.tituloNaEpoca || r.textoPerguntaNaEpoca) ? ' — ' + (r.tituloNaEpoca || r.textoPerguntaNaEpoca) : '');
    }
    function renderVeredito(a) {
      if (!a.indicacaoOrganizacional) return '';
      var textoA = window.faMotorSquad.conteudoTexto(a.necessidadeCapacidadeDedicada);
      var textoB = window.faMotorSquad.conteudoTexto(a.condicoesParaSquad);
      var textoC = window.faMotorSquad.conteudoTexto(a.indicacaoOrganizacional);
      var html = '<div class="avp-form-card sq-veredito">';
      html += '<h4>Necessidade de capacidade dedicada</h4>';
      html += '<p class="avp-result-badge-grande">' + esc(textoA.rotulo) + '</p>';
      html += '<p>' + esc(textoA.interpretacao) + '</p>';
      html += '<h4>Condições para funcionar como squad</h4>';
      html += '<p class="avp-result-badge-grande">' + esc(textoB.rotulo) + '</p>';
      html += '<p>' + esc(textoB.interpretacao) + '</p>';
      html += '<h4>Indicação organizacional</h4>';
      html += '<p class="avp-result-badge-grande">' + esc(textoC.rotulo) + '</p>';
      html += '<p>' + esc(textoC.interpretacao) + '</p>';
      html += '</div>';

      html += '<div class="avp-form-card">';
      html += '<h4>Evidências favoráveis</h4>';
      if ((a.evidenciasFavoraveis || []).length) {
        html += '<ul class="sq-lista-evidencias">' + a.evidenciasFavoraveis.map(function (c) {
          return '<li>' + esc(rotuloPergunta(a, c)) + '</li>';
        }).join('') + '</ul>';
      } else {
        html += '<p><em>Nenhuma resposta SIM registrada.</em></p>';
      }
      html += '<h4>Pontos a desenvolver</h4>';
      if ((a.pontosADesenvolver || []).length) {
        html += '<ul class="sq-lista-evidencias">' + a.pontosADesenvolver.map(function (c) {
          return '<li>' + esc(rotuloPergunta(a, c)) + '</li>';
        }).join('') + '</ul>';
      } else {
        html += '<p><em>Nenhuma resposta NÃO registrada.</em></p>';
      }
      html += '</div>';

      html += '<p class="avp-decisao-aviso">Esta avaliação fornece uma indicação para apoio à decisão organizacional. ' +
        'O resultado não determina automaticamente a criação, manutenção ou extinção de uma squad.</p>';
      return html;
    }

    /* ===================== RESULTADO (concluída) ===================== */
    function renderResultadoSquad() {
      var a = state.atual;
      var perguntas = perguntasOrdenadas(a.questionnaireContentVersion);
      var html = '<button class="avp-voltar-link" id="sqVoltarListaResultado">‹ Adequação à Squad</button>';
      if (state.flashResultado) {
        html += '<div class="avp-flash-success" id="sqFlashResultado">' + esc(state.flashResultado) +
          ' <button type="button" class="avp-flash-close" id="sqFlashResultadoClose" aria-label="Fechar">×</button></div>';
      }
      html += '<div class="avp-form-card"><h3>' + esc(a.itemNome) + '</h3>';
      html += renderContextoArquitetural();
      html += '<p>Responsável: ' + esc((a.criadoPor && a.criadoPor.name) || '—') + ' · Concluída em: ' + fmtData(a.dataConclusao) +
        ' · Versão do questionário: ' + esc(a.questionnaireContentVersion || 1) +
        ' · Versão do motor de squad: ' + esc(a.motorSquadVersion || 1) + '</p>';
      html += '</div>';

      if (precisaReprocessarMotorSquad(a)) {
        html += '<div class="avp-form-card avp-motor-aviso">';
        html += '<p class="avp-motor-aviso-texto">⚠ Esta avaliação foi processada por uma versão anterior do motor de adequação à squad.</p>';
        html += '<button type="button" class="btn btn--sm" id="sqReprocessarBtn"' + (state.reprocessando ? ' disabled' : '') + '>' +
          (state.reprocessando ? 'REPROCESSANDO…' : 'REPROCESSAR COM MOTOR DE SQUAD ATUAL') + '</button>';
        html += '</div>';
      }

      html += renderVeredito(a);

      html += '<div class="avp-form-card"><h4>8 de 8 perguntas respondidas</h4>';
      html += '<div class="table-scroll-wrap"><table class="admin-table"><thead><tr><th>Pergunta</th><th>Resposta</th><th>Justificativa</th></tr></thead><tbody>';
      perguntas.forEach(function (p) {
        var r = a.respostas[p.codigoEstavel] || {};
        html += '<tr><td data-label="Pergunta">' + esc(p.codigoEstavel) + '. ' + esc(r.textoPerguntaNaEpoca || p.texto) + '</td>' +
          '<td data-label="Resposta">' + (r.resposta === 'sim' ? 'SIM' : 'NÃO') + '</td>' +
          '<td data-label="Justificativa">' + (r.justificativaUsuario ? esc(r.justificativaUsuario) : '<em>Nenhuma observação registrada.</em>') + '</td></tr>';
      });
      html += '</tbody></table></div></div>';

      html += '<div class="avp-actions-footer avp-result-actions-footer">';
      html += '<button class="btn" id="sqVoltarListaRodape">VOLTAR PARA A LISTA</button>';
      html += '<button class="btn btn--sm" id="sqGerarPdfBtn"' + (state.exportando ? ' disabled' : '') + '>' +
        (state.exportando ? 'Gerando arquivo…' : '📄 GERAR PDF') + '</button>';
      html += '</div>';
      if (state.flashExportacao) {
        html += '<p class="avp-export-status' + (state.flashExportacao.erro ? ' avp-export-status--erro' : '') + '">' + esc(state.flashExportacao.texto) + '</p>';
      }
      wrap.innerHTML = html;

      function voltar() { state.tela = 'lista'; state.atual = null; state.flashResultado = null; render(); }
      document.getElementById('sqVoltarListaResultado').addEventListener('click', voltar);
      document.getElementById('sqVoltarListaRodape').addEventListener('click', voltar);
      var flashClose = document.getElementById('sqFlashResultadoClose');
      if (flashClose) flashClose.addEventListener('click', function () { state.flashResultado = null; render(); });
      var reprocessarBtn = document.getElementById('sqReprocessarBtn');
      if (reprocessarBtn) reprocessarBtn.addEventListener('click', reprocessarMotorSquad);
      document.getElementById('sqGerarPdfBtn').addEventListener('click', function () {
        if (state.exportando) return;
        state.exportando = true;
        state.flashExportacao = null;
        render();
        gerarPdf(a, function (erro) {
          state.exportando = false;
          state.flashExportacao = erro
            ? { erro: true, texto: 'Não foi possível gerar o arquivo. Tente novamente.' }
            : { erro: false, texto: 'Arquivo gerado com sucesso.' };
          if (erro) console.error('[avaliacao-squad] erro ao gerar PDF:', erro);
          render();
        });
      });
    }

    /* ===================== PDF ===================== */
    var CSS_PDF_SQUAD = '' +
      '.pdf-doc{font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;background:#fff;width:186mm;padding:0}' +
      '.pdf-header{border-bottom:2px solid #16306a;margin-bottom:14px;padding-bottom:8px}' +
      '.pdf-header-marca{font-size:11px;color:#666;margin:0}' +
      '.pdf-header-titulo{font-size:18px;color:#16306a;margin:2px 0}' +
      '.pdf-header-data{font-size:10px;color:#888;margin:0}' +
      '.pdf-secao-titulo{font-size:13px;color:#16306a;border-bottom:1px solid #ccc;padding-bottom:3px;margin:16px 0 8px;page-break-after:avoid}' +
      '.pdf-tabela-id{width:100%;border-collapse:collapse;margin-bottom:10px}' +
      '.pdf-tabela-id th{text-align:left;width:180px;padding:4px 8px;background:#f2f4f8;border:1px solid #ddd;vertical-align:top;font-weight:bold}' +
      '.pdf-tabela-id td{padding:4px 8px;border:1px solid #ddd;vertical-align:top}' +
      '.pdf-tabela-id tr{page-break-inside:avoid;break-inside:avoid}' +
      '.pdf-pergunta{border:1px solid #e2e2e2;border-radius:4px;padding:8px 10px;margin-bottom:6px;page-break-inside:avoid;break-inside:avoid}' +
      '.pdf-pergunta-texto{margin:0 0 4px}' +
      '.pdf-pergunta-campo{margin:0 0 2px;font-size:10px}' +
      '.pdf-aviso{color:#8a6800;font-style:italic;margin:4px 0}';

    function pdfLinhaTabela(rotulo, valor) {
      return '<tr><th>' + esc(rotulo) + '</th><td>' + esc(valor || '—') + '</td></tr>';
    }
    function montarDocumentoPdfSquad(it) {
      var perguntas = perguntasOrdenadas(it.questionnaireContentVersion);
      var html = '<div class="pdf-doc"><style>' + CSS_PDF_SQUAD + '</style>';
      html += '<div class="pdf-header">';
      html += '<p class="pdf-header-marca">PREVI · Força Ágil</p>';
      html += '<h1 class="pdf-header-titulo">Avaliação de Adequação à Gestão por Squad</h1>';
      html += '<p class="pdf-header-data">Documento gerado em ' + esc(fmtData(new Date().toISOString())) + '</p>';
      html += '</div>';
      html += '<h2 class="pdf-secao-titulo">Identificação</h2>';
      html += '<table class="pdf-tabela-id">';
      html += pdfLinhaTabela('Nome do item', it.itemNome);
      html += pdfLinhaTabela('Data', fmtData(it.dataConclusao || it.criadoEm));
      html += pdfLinhaTabela('Responsável', it.criadoPor && it.criadoPor.name);
      html += pdfLinhaTabela('Versão do questionário', it.questionnaireContentVersion || 1);
      html += pdfLinhaTabela('Versão do motor de squad', it.motorSquadVersion || 1);
      html += '</table>';
      html += '<h2 class="pdf-secao-titulo">Respostas S1-S8</h2>';
      perguntas.forEach(function (p) {
        var r = it.respostas[p.codigoEstavel] || {};
        html += '<div class="pdf-pergunta">' +
          '<p class="pdf-pergunta-texto">' + esc(p.codigoEstavel) + '. ' + esc(r.textoPerguntaNaEpoca || p.texto) + ' — <strong>' + (r.resposta === 'sim' ? 'SIM' : 'NÃO') + '</strong></p>' +
          '<p class="pdf-pergunta-campo"><strong>Justificativa:</strong> ' + (r.justificativaUsuario ? esc(r.justificativaUsuario) : '<em>Nenhuma observação registrada.</em>') + '</p>' +
          '</div>';
      });
      if (it.indicacaoOrganizacional && window.faMotorSquad) {
        var textoA = window.faMotorSquad.conteudoTexto(it.necessidadeCapacidadeDedicada);
        var textoB = window.faMotorSquad.conteudoTexto(it.condicoesParaSquad);
        var textoC = window.faMotorSquad.conteudoTexto(it.indicacaoOrganizacional);
        html += '<h2 class="pdf-secao-titulo">Necessidade de capacidade dedicada</h2>';
        html += '<p class="pdf-pergunta-texto"><strong>' + esc(textoA.rotulo) + '</strong></p><p class="pdf-pergunta-campo">' + esc(textoA.interpretacao) + '</p>';
        html += '<h2 class="pdf-secao-titulo">Condições para funcionar como squad</h2>';
        html += '<p class="pdf-pergunta-texto"><strong>' + esc(textoB.rotulo) + '</strong></p><p class="pdf-pergunta-campo">' + esc(textoB.interpretacao) + '</p>';
        html += '<h2 class="pdf-secao-titulo">Indicação organizacional</h2>';
        html += '<p class="pdf-pergunta-texto"><strong>' + esc(textoC.rotulo) + '</strong></p><p class="pdf-pergunta-campo">' + esc(textoC.interpretacao) + '</p>';
        var pontos = it.pontosADesenvolver || [];
        html += '<h2 class="pdf-secao-titulo">Pontos a desenvolver</h2>';
        html += pontos.length
          ? '<p class="pdf-pergunta-campo">' + pontos.map(function (c) { return esc(c); }).join(', ') + '</p>'
          : '<p class="pdf-pergunta-campo"><em>Nenhum ponto a desenvolver identificado.</em></p>';
        html += '<p class="pdf-aviso">Esta avaliação fornece uma indicação para apoio à decisão organizacional. O resultado não determina automaticamente a criação, manutenção ou extinção de uma squad.</p>';
      } else {
        html += '<h2 class="pdf-secao-titulo">Resultado</h2>';
        html += '<p class="pdf-aviso">Avaliação registrada. Regra de interpretação de adequação à squad ainda não configurada.</p>';
      }
      html += '</div>';
      return html;
    }
    function nomeArquivoPdfSquad(it) {
      var nome = String(it.itemNome || 'item').trim().replace(/[^a-zA-Z0-9À-ÿ ]/g, '').replace(/\s+/g, '-');
      var data = (it.dataConclusao || it.criadoEm || new Date().toISOString()).slice(0, 10);
      return 'Avaliacao_Adequacao_Squad_' + nome + '_' + data + '.pdf';
    }
    /* Mesmo pipeline (e mesma causa raiz já corrigida) do PDF de
       avaliacao-produto.js: mede altura/largura do container SÓ depois de
       toContainer() resolver — é só nesse ponto que o plugin de pagebreak
       do html2pdf.js já cresceu o container clonado com os espaçadores que
       empurram blocos protegidos (page-break-inside:avoid) para a página
       seguinte; medir antes disso corta qualquer conteúdo empurrado para
       além do tamanho antigo (não repetir aqui o bug já resolvido lá). */
    function gerarPdf(it, cbFim) {
      carregarScript('forca-agil/html2pdf.bundle.min.js', function () { return typeof window.html2pdf === 'function'; }, function (erroCarga) {
        if (erroCarga) { cbFim(erroCarga); return; }
        var container = document.createElement('div');
        container.style.cssText = 'position:static;width:186mm;background:#fff';
        container.innerHTML = montarDocumentoPdfSquad(it);
        document.body.appendChild(container);

        function limpar() { if (container.parentNode) document.body.removeChild(container); }

        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            if (!container.scrollHeight) { limpar(); cbFim(new Error('container vazio')); return; }
            window.html2pdf().set({
              margin: [14, 12, 16, 12],
              filename: nomeArquivoPdfSquad(it),
              image: { type: 'jpeg', quality: 0.95 },
              html2canvas: { scale: 2, backgroundColor: '#ffffff', useCORS: false, x: 0, y: 0, scrollX: 0, scrollY: 0 },
              jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
              pagebreak: { mode: ['css', 'avoid-all'] }
            }).from(container).toContainer().then(function () {
              var altura = this.prop.container.scrollHeight;
              var largura = this.prop.container.scrollWidth;
              this.opt.html2canvas.width = largura;
              this.opt.html2canvas.windowWidth = largura;
              this.opt.html2canvas.height = altura;
              this.opt.html2canvas.windowHeight = altura;
            }).toCanvas().toPdf().get('pdf').then(function (pdf) {
              var total = pdf.internal.getNumberOfPages();
              var larguraPag = pdf.internal.pageSize.getWidth();
              var alturaPag = pdf.internal.pageSize.getHeight();
              for (var i = 1; i <= total; i++) {
                pdf.setPage(i);
                pdf.setFontSize(8);
                pdf.setTextColor(120);
                pdf.text('Página ' + i + ' de ' + total, larguraPag / 2, alturaPag - 6, { align: 'center' });
              }
            }).save().then(function () { limpar(); cbFim(null); }, function (erroSave) { limpar(); cbFim(erroSave); });
          });
        });
      });
    }

    /* ===================== CONFIGURAÇÃO DO MOTOR DE SQUAD =====================
       Governança RASCUNHO → SIMULAÇÃO → PUBLICAÇÃO das REGRAS (item 14/15 do
       pedido) — nunca a mesma tela de "⚙ Configuração dos Questionários"
       (avaliacao-produto.js), que edita só a REDAÇÃO das perguntas S1-S8;
       aqui se edita a LÓGICA do motor (condições, sempre via os operadores
       seguros all/any/not/equals — nunca um campo de texto livre nem eval)
       e os TEXTOS dos vereditos (rotulo/interpretacao, publicados
       imediatamente, sem afetar motorSquadVersion). */
    var CODIGOS_TEXTO_MOTOR = [
      'DEMONSTRADA', 'PARCIALMENTE_DEMONSTRADA', 'NAO_DEMONSTRADA',
      'LIMITADAS_PELA_AUTONOMIA', 'PRESENTES', 'PARCIAIS',
      'FORTE_ADERENCIA_SQUAD_DEDICADA', 'JUSTIFICA_CAPACIDADE_COM_CONDICOES_A_DESENVOLVER',
      'JUSTIFICA_CAPACIDADE_MAS_AUTONOMIA_PRECISA_SER_TRATADA',
      'AVALIAR_MODELO_GESTAO_ANTES_DE_SQUAD_EXCLUSIVA', 'NECESSIDADE_SQUAD_DEDICADA_NAO_DEMONSTRADA'
    ];
    function abrirMotorConfig() {
      state.tela = 'motor-config';
      state.motorConfig = { sub: 'painel', flash: null };
      render();
    }
    function voltarPainelMotorConfig() {
      state.motorConfig = { sub: 'painel', flash: state.motorConfig && state.motorConfig.flash };
      render();
    }
    function renderMotorConfig() {
      var c = state.motorConfig;
      var html = '<button class="avp-voltar-link" id="sqMotorVoltarLista">‹ Adequação à Squad</button>';
      html += '<div class="sq-motor-config">';
      if (c.sub === 'painel') html += renderMotorPainel();
      else if (c.sub === 'editar-regras') html += renderMotorEditarRegras();
      else if (c.sub === 'simulacao') html += renderMotorSimulacao();
      else if (c.sub === 'conflito-publicacao') html += renderMotorConflitoPublicacao();
      else if (c.sub === 'comparar-alteracoes') html += renderMotorCompararAlteracoes();
      else if (c.sub === 'editar-textos') html += renderMotorEditarTextos();
      else if (c.sub === 'auditoria') html += renderMotorAuditoria();
      else if (c.sub === 'versoes') html += renderMotorVersoes();
      html += '</div>';
      wrap.innerHTML = html;
      document.getElementById('sqMotorVoltarLista').addEventListener('click', function () { state.tela = 'lista'; state.motorConfig = null; render(); });
      if (c.sub === 'painel') bindMotorPainel();
      else if (c.sub === 'editar-regras') bindMotorEditarRegras();
      else if (c.sub === 'simulacao') bindMotorSimulacao();
      else if (c.sub === 'conflito-publicacao') bindMotorConflitoPublicacao();
      else if (c.sub === 'comparar-alteracoes') bindMotorCompararAlteracoes();
      else if (c.sub === 'editar-textos') bindMotorEditarTextos();
      else if (c.sub === 'auditoria') bindMotorAuditoria();
      else if (c.sub === 'versoes') bindMotorVersoes();
    }

    /* ---- PAINEL (visão geral) ---- */
    function renderMotorPainel() {
      var c = state.motorConfig;
      var sit = window.faMotorSquad.situacao();
      var html = '<div class="avp-form-card"><h3>Motor de Interpretação da Adequação à Squad</h3>';
      html += '<p class="avp-decisao-aviso">Interpreta as respostas S1-S8 por condições lógicas e precedência — nunca por soma de respostas SIM, pontuação ou percentual. ' +
        'Totalmente independente do motor de classificação arquitetural.</p>';
      html += '<p>Versão de regras publicada: <strong>' + esc(sit.versaoPublicada) + '</strong></p>';
      html += '<p>Situação: ' + (sit.temRascunho ? '<strong>há um rascunho de regras não publicado</strong>' : 'sem alterações pendentes') + '</p>';
      html += '<p>Última publicação: ' + (sit.ultimaAlteracaoEm ? esc(fmtData(sit.ultimaAlteracaoEm)) + (sit.ultimaAlteracaoPor ? ' · ' + esc(sit.ultimaAlteracaoPor) : '') : 'nunca alterado (regras de fábrica)') + '</p>';
      html += '</div>';
      if (c.flash) html += '<p class="avp-flash-success">' + esc(c.flash) + '</p>';
      html += '<div class="avp-actions-footer">';
      html += '<button class="btn btn--sm" id="sqMotorEditarRegrasBtn">Editar regras (Eixo A / Eixo B / Combinação)</button>';
      html += '<button class="btn btn--sm" id="sqMotorEditarTextosBtn">Editar textos dos vereditos</button>';
      html += '<button class="btn btn--sm" id="sqMotorVersoesBtn">Versões publicadas</button>';
      html += '<button class="btn btn--sm" id="sqMotorAuditoriaBtn">Ver histórico de alterações</button>';
      html += '</div>';
      return html;
    }
    function bindMotorPainel() {
      document.getElementById('sqMotorEditarRegrasBtn').addEventListener('click', function () {
        state.motorConfig = {
          sub: 'editar-regras', regras: window.faMotorSquad.iniciarOuObterRascunhoRegras(),
          versaoBase: window.faMotorSquad.versaoBaseDoRascunho(), salvando: false
        };
        render();
      });
      document.getElementById('sqMotorEditarTextosBtn').addEventListener('click', function () {
        state.motorConfig = { sub: 'editar-textos', textos: JSON.parse(JSON.stringify(window.faMotorSquad.textosAtuais())), salvando: false };
        render();
      });
      document.getElementById('sqMotorVersoesBtn').addEventListener('click', function () {
        state.motorConfig = { sub: 'versoes' };
        render();
      });
      document.getElementById('sqMotorAuditoriaBtn').addEventListener('click', function () {
        state.motorConfig = { sub: 'auditoria', lista: null };
        render();
        window.faMotorSquad.auditoria(function (lista) {
          if (state.motorConfig && state.motorConfig.sub === 'auditoria') { state.motorConfig.lista = lista; render(); }
        });
      });
    }

    /* ---- EDITAR REGRAS (rascunho → simulação → publicação) ----
       Cada condição é renderizada recursivamente; só as FOLHAS (campo/valor)
       ganham um <select> SIM/NÃO editável — a ESTRUTURA (all/any/not, quais
       perguntas/eixos cada regra usa, a ordem de precedência) não é editável
       por aqui nesta versão, só o valor esperado de cada condição. Nunca
       eval, nunca string executada: o <select> só grava 'SIM'/'NAO' de volta
       no MESMO objeto de condição (por referência, via leafRefs). */
    function renderCondicaoEditavel(cond, leafRefs, prefixo) {
      if (Array.isArray(cond.all)) {
        return '<div class="sq-cond-grupo"><p class="sq-cond-rotulo">' + prefixo + 'TODAS as condições:</p>' +
          cond.all.map(function (c) { return renderCondicaoEditavel(c, leafRefs, prefixo + '　'); }).join('') + '</div>';
      }
      if (Array.isArray(cond.any)) {
        return '<div class="sq-cond-grupo"><p class="sq-cond-rotulo">' + prefixo + 'QUALQUER uma destas condições:</p>' +
          cond.any.map(function (c) { return renderCondicaoEditavel(c, leafRefs, prefixo + '　'); }).join('') + '</div>';
      }
      if (cond.not) {
        return '<div class="sq-cond-grupo"><p class="sq-cond-rotulo">' + prefixo + 'NÃO:</p>' + renderCondicaoEditavel(cond.not, leafRefs, prefixo + '　') + '</div>';
      }
      var id = leafRefs.length;
      leafRefs.push(cond);
      var campo = cond.campo || cond.pergunta;
      var valorAtual = (cond.valor != null ? cond.valor : cond.resposta || 'SIM').toUpperCase();
      return '<p class="sq-cond-folha">' + prefixo + esc(campo) + ' = ' +
        '<select class="sq-cond-select" data-leaf-id="' + id + '">' +
        '<option value="SIM"' + (valorAtual === 'SIM' ? ' selected' : '') + '>SIM</option>' +
        '<option value="NAO"' + (valorAtual === 'NAO' ? ' selected' : '') + '>NÃO</option>' +
        '</select></p>';
    }
    function renderGrupoRegras(titulo, regras, leafRefs) {
      var html = '<div class="avp-form-card"><h4>' + esc(titulo) + '</h4>';
      regras.slice().sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0); }).forEach(function (regra) {
        html += '<div class="sq-regra-card"><p class="sq-regra-codigo">' + esc(regra.codigo) + ' (ordem ' + esc(regra.ordem) + ') → <strong>' + esc(regra.resultado) + '</strong></p>';
        html += renderCondicaoEditavel(regra.condicoes, leafRefs, '');
        html += '</div>';
      });
      html += '</div>';
      return html;
    }
    function renderMotorEditarRegras() {
      var c = state.motorConfig;
      c.leafRefs = []; /* recriado a cada render — os <select> abaixo indexam nele por posição */
      var html = '<div class="avp-form-card"><h3>Editar regras do motor de squad</h3>';
      html += '<p class="avp-decisao-aviso">Alterar o valor esperado (SIM/NÃO) de qualquer condição muda a LÓGICA do motor — ao publicar, isso cria uma motorSquadVersion nova ' +
        'e não afeta avaliações já concluídas. Antes de publicar, é preciso simular o impacto sobre as avaliações já concluídas.</p></div>';
      html += renderGrupoRegras('Eixo A — Necessidade de capacidade dedicada', c.regras.eixoA, c.leafRefs);
      html += renderGrupoRegras('Eixo B — Condições para funcionar como squad', c.regras.eixoB, c.leafRefs);
      html += renderGrupoRegras('Combinação — Indicação organizacional', c.regras.combinacao, c.leafRefs);
      if (c.erro) html += '<p class="avp-error-msg">' + esc(c.erro) + '</p>';
      html += '<div class="avp-actions-footer">';
      html += '<button class="btn" id="sqMotorSalvarRascunhoBtn"' + (c.salvando ? ' disabled' : '') + '>SALVAR RASCUNHO</button>';
      html += '<button class="btn btn--primary" id="sqMotorSimularBtn"' + (c.salvando ? ' disabled' : '') + '>SIMULAR IMPACTO</button>';
      html += '<button class="btn" id="sqMotorCancelarEdicaoBtn"' + (c.salvando ? ' disabled' : '') + '>‹ Voltar</button>';
      html += '</div>';
      return html;
    }
    function bindMotorEditarRegras() {
      var c = state.motorConfig;
      wrap.querySelectorAll('.sq-cond-select').forEach(function (sel) {
        sel.addEventListener('change', function () {
          c.leafRefs[Number(sel.dataset.leafId)].valor = sel.value;
        });
      });
      document.getElementById('sqMotorCancelarEdicaoBtn').addEventListener('click', voltarPainelMotorConfig);
      document.getElementById('sqMotorSalvarRascunhoBtn').addEventListener('click', function () {
        if (c.salvando) return;
        c.salvando = true;
        render();
        window.faMotorSquad.salvarRascunhoRegras(c.regras, sessaoAtual(), function (err) {
          c.salvando = false;
          if (err) { c.erro = 'Não foi possível salvar o rascunho. Tente novamente.'; render(); return; }
          state.motorConfig.flash = '✓ Rascunho de regras salvo.';
          voltarPainelMotorConfig();
        }, c.versaoBase);
      });
      document.getElementById('sqMotorSimularBtn').addEventListener('click', function () {
        var concluidas = state.itens.filter(function (it) { return !it.excluido && it.status === 'concluido'; });
        var simulacao = window.faMotorSquad.simular(c.regras, concluidas);
        state.motorConfig = { sub: 'simulacao', regras: c.regras, versaoBase: c.versaoBase, simulacao: simulacao, salvando: false };
        render();
      });
    }

    /* ---- SIMULAÇÃO (item 15) ---- */
    function renderMotorSimulacao() {
      var c = state.motorConfig;
      var s = c.simulacao;
      var html = '<div class="avp-form-card"><h3>Simulação de impacto</h3>';
      html += '<p class="avp-decisao-aviso">Nenhuma avaliação histórica foi alterada — isto é só uma simulação sobre as avaliações já concluídas, com a regra candidata.</p>';
      html += '<p>' + esc(s.totalAnalisadas) + ' avaliaç' + (s.totalAnalisadas === 1 ? 'ão analisada' : 'ões analisadas') + '</p>';
      html += '<p>' + esc(s.mantidas) + ' manteriam o mesmo resultado</p>';
      html += '<p>' + esc(s.mudariam.length) + ' mudariam de resultado</p>';
      html += '</div>';
      if (s.mudariam.length) {
        html += '<div class="avp-form-card"><h4>Avaliações que mudariam</h4>';
        html += '<div class="table-scroll-wrap"><table class="admin-table"><thead><tr><th>Item</th><th>Atual</th><th>Nova regra</th></tr></thead><tbody>';
        s.mudariam.forEach(function (m) {
          html += '<tr><td data-label="Item">' + esc(m.itemNome) + '</td>' +
            '<td data-label="Atual">' + esc(window.faMotorSquad.conteudoTexto(m.atual).rotulo) + '</td>' +
            '<td data-label="Nova regra">' + esc(window.faMotorSquad.conteudoTexto(m.nova).rotulo) + '</td></tr>';
        });
        html += '</tbody></table></div></div>';
      }
      if (c.erro) html += '<p class="avp-error-msg">' + esc(c.erro) + '</p>';
      html += '<div class="avp-actions-footer">';
      html += '<button class="btn" id="sqMotorVoltarEdicaoBtn"' + (c.salvando ? ' disabled' : '') + '>‹ VOLTAR PARA EDIÇÃO</button>';
      html += '<button class="btn btn--primary" id="sqMotorConfirmarPublicarBtn"' + (c.salvando ? ' disabled' : '') + '>' +
        (c.salvando ? 'PUBLICANDO…' : 'CONFIRMAR PUBLICAÇÃO') + '</button>';
      html += '</div>';
      return html;
    }
    function bindMotorSimulacao() {
      var c = state.motorConfig;
      document.getElementById('sqMotorVoltarEdicaoBtn').addEventListener('click', function () {
        state.motorConfig = { sub: 'editar-regras', regras: c.regras, versaoBase: c.versaoBase, salvando: false };
        render();
      });
      document.getElementById('sqMotorConfirmarPublicarBtn').addEventListener('click', function () {
        if (c.salvando) return;
        c.salvando = true;
        render();
        window.faMotorSquad.publicarRegras(c.regras, sessaoAtual(), function (err, info) {
          c.salvando = false;
          if (err === 'conflito') {
            state.motorConfig = {
              sub: 'conflito-publicacao', regras: c.regras,
              versaoBase: info.versaoBase, versaoAtual: info.versaoAtual, salvando: false
            };
            render();
            return;
          }
          if (err) { c.erro = 'Não foi possível publicar. Tente novamente.'; render(); return; }
          state.motorConfig = { sub: 'painel', flash: info && info.semMudanca
            ? 'As regras publicadas já são idênticas às do rascunho — nenhuma versão nova foi criada.'
            : '✓ Nova versão das regras publicada com sucesso.' };
          render();
        });
      });
    }

    /* ---- CONFLITO DE PUBLICAÇÃO (edição concorrente — mesmo mecanismo de
       avaliacao-produto.js/motor-arquitetura.js) — nunca oferece
       sobrescrever silenciosamente. */
    function renderMotorConflitoPublicacao() {
      var c = state.motorConfig;
      var html = '<div class="avp-form-card"><h3>Conflito de publicação</h3>';
      html += '<p class="avp-error-msg">Não foi possível publicar porque o motor foi alterado por outro usuário desde que você iniciou esta edição.</p>';
      html += '<p>Sua versão base: <strong>' + esc(c.versaoBase) + '</strong></p>';
      html += '<p>Versão publicada atual: <strong>' + esc(c.versaoAtual) + '</strong></p>';
      html += '</div>';
      html += '<div class="avp-actions-footer">';
      html += '<button class="btn btn--primary" id="sqMotorConflitoRecarregarBtn">RECARREGAR VERSÃO ATUAL</button>';
      html += '<button class="btn" id="sqMotorConflitoCompararBtn">COMPARAR ALTERAÇÕES</button>';
      html += '<button class="btn" id="sqMotorConflitoDescartarBtn">DESCARTAR MEU RASCUNHO</button>';
      html += '</div>';
      return html;
    }
    function bindMotorConflitoPublicacao() {
      var c = state.motorConfig;
      document.getElementById('sqMotorConflitoRecarregarBtn').addEventListener('click', function () {
        window.faMotorSquad.descartarRascunhoRegras(function () {
          state.motorConfig = {
            sub: 'editar-regras', regras: window.faMotorSquad.iniciarOuObterRascunhoRegras(),
            versaoBase: window.faMotorSquad.versaoBaseDoRascunho(), salvando: false
          };
          render();
        });
      });
      document.getElementById('sqMotorConflitoCompararBtn').addEventListener('click', function () {
        var atuais = window.faMotorSquad.regrasDaVersao(window.faMotorSquad.versaoAtual());
        var alteradas = window.faMotorSquad.diffRegras(atuais, c.regras);
        state.motorConfig = {
          sub: 'comparar-alteracoes', regras: c.regras, versaoBase: c.versaoBase,
          versaoAtual: c.versaoAtual, alteradas: alteradas
        };
        render();
      });
      document.getElementById('sqMotorConflitoDescartarBtn').addEventListener('click', function () {
        window.faMotorSquad.descartarRascunhoRegras(function (err) {
          if (err) { sqAlert('Não foi possível descartar o rascunho. Tente novamente.'); return; }
          state.motorConfig = { sub: 'painel', flash: 'Rascunho descartado.' };
          render();
        });
      });
    }

    /* ---- COMPARAR ALTERAÇÕES (rascunho vs. versão publicada agora) ---- */
    function renderMotorCompararAlteracoes() {
      var c = state.motorConfig;
      var html = '<div class="avp-form-card"><h3>Comparação: seu rascunho × versão publicada atual</h3>';
      html += '<p class="avp-decisao-aviso">Sua versão base: ' + esc(c.versaoBase) + ' · Versão publicada atual: ' + esc(c.versaoAtual) + '</p></div>';
      if (!c.alteradas.length) {
        html += '<div class="avp-form-card"><p class="admin-empty">Nenhuma diferença lógica entre seu rascunho e a versão publicada atual.</p></div>';
      } else {
        c.alteradas.forEach(function (alt) {
          html += '<div class="avp-form-card sq-regra-card"><p class="sq-regra-codigo">' + esc(alt.grupo) + ' — Regra ' + esc(alt.codigo) + '</p>';
          html += '<p><strong>Publicada agora:</strong> ' + (alt.antigo ? esc(JSON.stringify(alt.antigo)) : '<em>(regra removida no seu rascunho)</em>') + '</p>';
          html += '<p><strong>No seu rascunho:</strong> ' + (alt.novo ? esc(JSON.stringify(alt.novo)) : '<em>(regra não existe no seu rascunho)</em>') + '</p></div>';
        });
      }
      html += '<div class="avp-actions-footer">';
      html += '<button class="btn" id="sqMotorCompararVoltarBtn">‹ Voltar ao conflito</button>';
      html += '</div>';
      return html;
    }
    function bindMotorCompararAlteracoes() {
      var c = state.motorConfig;
      document.getElementById('sqMotorCompararVoltarBtn').addEventListener('click', function () {
        state.motorConfig = { sub: 'conflito-publicacao', regras: c.regras, versaoBase: c.versaoBase, versaoAtual: c.versaoAtual, salvando: false };
        render();
      });
    }

    /* ---- EDITAR TEXTOS (publicação imediata, nunca versiona o motor) ---- */
    function renderMotorEditarTextos() {
      var c = state.motorConfig;
      var html = '<div class="avp-form-card"><h3>Editar textos dos vereditos</h3>';
      html += '<p class="avp-decisao-aviso">Alterar só a redação exibida — nunca muda a lógica do motor nem a versão publicada, e é aplicado imediatamente a todas as avaliações que já tiverem esse código.</p></div>';
      CODIGOS_TEXTO_MOTOR.forEach(function (codigo) {
        var t = c.textos[codigo] || { rotulo: '', interpretacao: '' };
        html += '<div class="avp-form-card"><p class="avp-alt-label">Código: <strong>' + esc(codigo) + '</strong> <span class="avp-config-readonly-tag">(somente leitura)</span></p>';
        html += '<div class="avp-field"><label>Rótulo</label><input type="text" class="sq-texto-rotulo" data-codigo="' + codigo + '" value="' + esc(t.rotulo) + '"></div>';
        html += '<div class="avp-field"><label>Interpretação</label><textarea class="sq-texto-interpretacao" data-codigo="' + codigo + '" rows="2">' + esc(t.interpretacao) + '</textarea></div>';
        html += '</div>';
      });
      if (c.flash) html += '<p class="avp-flash-success">' + esc(c.flash) + '</p>';
      if (c.erro) html += '<p class="avp-error-msg">' + esc(c.erro) + '</p>';
      html += '<div class="avp-actions-footer">';
      html += '<button class="btn btn--primary" id="sqMotorPublicarTextosBtn"' + (c.salvando ? ' disabled' : '') + '>' +
        (c.salvando ? 'PUBLICANDO…' : 'PUBLICAR TEXTOS') + '</button>';
      html += '<button class="btn" id="sqMotorCancelarTextosBtn"' + (c.salvando ? ' disabled' : '') + '>‹ Voltar</button>';
      html += '</div>';
      return html;
    }
    function bindMotorEditarTextos() {
      var c = state.motorConfig;
      wrap.querySelectorAll('.sq-texto-rotulo').forEach(function (input) {
        input.addEventListener('input', function () {
          c.textos[input.dataset.codigo] = c.textos[input.dataset.codigo] || {};
          c.textos[input.dataset.codigo].rotulo = input.value;
        });
      });
      wrap.querySelectorAll('.sq-texto-interpretacao').forEach(function (ta) {
        ta.addEventListener('input', function () {
          c.textos[ta.dataset.codigo] = c.textos[ta.dataset.codigo] || {};
          c.textos[ta.dataset.codigo].interpretacao = ta.value;
        });
      });
      document.getElementById('sqMotorCancelarTextosBtn').addEventListener('click', voltarPainelMotorConfig);
      document.getElementById('sqMotorPublicarTextosBtn').addEventListener('click', function () {
        if (c.salvando) return;
        c.salvando = true;
        render();
        window.faMotorSquad.salvarTextos(c.textos, sessaoAtual(), function (err) {
          c.salvando = false;
          if (err) { c.erro = 'Não foi possível publicar os textos. Tente novamente.'; render(); return; }
          state.motorConfig = { sub: 'painel', flash: '✓ Textos publicados com sucesso.' };
          render();
        });
      });
    }

    /* ---- AUDITORIA ---- */
    function renderMotorAuditoria() {
      var c = state.motorConfig;
      var html = '<div class="avp-form-card"><h3>Histórico de alterações do motor de squad</h3></div>';
      if (!c.lista) { html += '<p class="loading-msg">Carregando…</p>'; return html; }
      if (!c.lista.length) { html += '<p class="admin-empty">Nenhuma alteração registrada ainda.</p>'; return html; }
      html += '<div class="table-scroll-wrap"><table class="admin-table"><thead><tr><th>Tipo</th><th>Campo</th><th>Usuário</th><th>Data</th><th>Versão</th></tr></thead><tbody>';
      c.lista.forEach(function (a) {
        var tipoLabel = a.tipo === 'regra' ? 'Regra' : a.tipo === 'texto' ? 'Texto'
          : a.tipo === 'conflito_publicacao' ? 'Conflito de publicação (bloqueado)' : 'Publicação sem alteração';
        var versaoCol = a.tipo === 'conflito_publicacao'
          ? 'tentativa com base ' + esc(a.versaoBase) + ' — vigente ' + esc(a.versaoAtual)
          : (a.versaoAnterior === a.novaVersao ? 'sem versão nova (' + esc(a.versaoAnterior) + ')' : esc(a.versaoAnterior) + ' → ' + esc(a.novaVersao));
        var campoCol = a.campo ? esc(a.campo) : (a.tipo === 'conflito_publicacao' && a.origem ? esc(a.origem) : '—');
        html += '<tr><td data-label="Tipo">' + tipoLabel + '</td>' +
          '<td data-label="Campo">' + campoCol + '</td>' +
          '<td data-label="Usuário">' + esc((a.usuario && (a.usuario.name || a.usuario.email)) || '—') + '</td>' +
          '<td data-label="Data">' + fmtData(a.dataHora) + '</td>' +
          '<td data-label="Versão">' + versaoCol + '</td></tr>';
      });
      html += '</tbody></table></div>';
      html += '<div class="avp-actions-footer"><button class="btn" id="sqMotorVoltarAuditoriaBtn">‹ Voltar</button></div>';
      return html;
    }
    function bindMotorAuditoria() {
      var btn = document.getElementById('sqMotorVoltarAuditoriaBtn');
      if (btn) btn.addEventListener('click', voltarPainelMotorConfig);
    }

    /* ---- VERSÕES PUBLICADAS (rollback) ---- */
    function renderMotorVersoes() {
      var versoes = window.faMotorSquad.listarVersoes();
      var atual = window.faMotorSquad.versaoAtual();
      var html = '<div class="avp-form-card"><h3>Versões publicadas do motor de squad</h3>' +
        '<p class="avp-decisao-aviso">Restaurar uma versão anterior cria uma versão NOVA com aquele conjunto de regras — nunca reescreve o histórico nem toca em avaliações já concluídas.</p></div>';
      html += '<div class="table-scroll-wrap"><table class="admin-table"><thead><tr><th>Versão</th><th>Situação</th><th>Ações</th></tr></thead><tbody>';
      versoes.forEach(function (v) {
        html += '<tr><td data-label="Versão">' + esc(v) + '</td><td data-label="Situação">' + (v === atual ? 'Vigente' : '—') + '</td>' +
          '<td data-label="Ações">' + (v === atual ? '' : '<button class="btn btn--sm sq-motor-restaurar-btn" data-versao="' + v + '">Restaurar como nova versão</button>') + '</td></tr>';
      });
      html += '</tbody></table></div>';
      html += '<div class="avp-actions-footer"><button class="btn" id="sqMotorVoltarVersoesBtn">‹ Voltar</button></div>';
      return html;
    }
    function bindMotorVersoes() {
      document.getElementById('sqMotorVoltarVersoesBtn').addEventListener('click', voltarPainelMotorConfig);
      wrap.querySelectorAll('.sq-motor-restaurar-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          sqConfirm('Restaurar a versão ' + btn.dataset.versao + ' como uma versão nova das regras?', function () {
            window.faMotorSquad.publicarVersaoAnterior(Number(btn.dataset.versao), sessaoAtual(), function (err) {
              if (err) { sqAlert('Não foi possível restaurar. Tente novamente.'); return; }
              state.motorConfig = { sub: 'painel', flash: '✓ Versão restaurada como uma versão nova.' };
              render();
            });
          });
        });
      });
    }

    /* Config de conteúdo — re-renderiza quando uma nova versão de S1-S8 é
       publicada (mesmo princípio de avaliacao-produto.js: eixo só de
       apresentação, nunca decide se reprocessa nada). onMudanca chama o
       callback também na primeira leitura (mesmo sem nenhuma publicação
       ainda) — sem o guard !wrap.hidden, isso preenchia a #adminAvaliacaoSquad
       inteira (inclusive .avp-total e outras classes reaproveitadas de
       avaliacao-produto.js) por trás do hidden, ambíguo pra qualquer consulta
       por essas classes fora deste módulo; as funções públicas (abrirLista/
       iniciarOuAbrirParaItem) já chamam render() de novo ao mostrar o painel,
       então pular aqui enquanto está oculto não perde nenhuma atualização. */
    window.faQuestionarios.onMudanca(CODIGO_QUESTIONARIO, function () { if (!wrap.hidden) render(); });
    /* Idem para o motor de squad — republicar regras/textos só reflete na
       tela enquanto ela está de fato visível (mesmo guard, mesmo motivo). */
    window.faMotorSquad.onMudanca(function () { if (!wrap.hidden) render(); });

    /* ===================== CARGA ===================== */
    db().ref(NODE).on('value', function (snap) {
      var arr = [];
      snap.forEach(function (c) { arr.push(Object.assign({ _key: c.key }, c.val())); });
      state.itens = arr;
      state.itensCarregados = true;
      if (state.tela === 'lista' && !wrap.hidden) render();
    }, function (err) {
      state.itensCarregados = true;
      console.error('[avaliacao-squad] erro ao carregar avaliacoes-squad:', err);
    });
    /* Leitura ao vivo de avaliacoes-produto só pra alimentar a busca de item
       já cadastrado (Parte A) — nunca usada pra decidir nada de squad, só
       pra listar itens existentes e mostrar a classificação atual como
       contexto. Reagir só na tela form-inicial (mesmo guard de !wrap.hidden
       das outras leituras), pra não custar render fora dela. */
    db().ref(NODE_ARQUITETURA).on('value', function (snap) {
      var arr = [];
      snap.forEach(function (c) { arr.push(Object.assign({ _key: c.key }, c.val())); });
      state.itensArquitetura = arr;
      state.itensArquiteturaCarregados = true;
      if (state.tela === 'form-inicial' && !wrap.hidden) render();
    }, function (err) {
      state.itensArquiteturaCarregados = true;
      console.error('[avaliacao-squad] erro ao carregar avaliacoes-produto (busca de item):', err);
    });
  };
})();
