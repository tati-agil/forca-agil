/* ============================================================
   Força Ágil — Avaliação de Adequação à Gestão por Squad (S1-S8)

   Eixo TOTALMENTE INDEPENDENTE da classificação arquitetural
   (avaliacao-produto.js):
     P1-P16 respondem O QUE o item É arquiteturalmente.
     S1-S8  respondem se FAZ SENTIDO organizar uma squad dedicada
            para cuidar desse item.
   Nunca existe regra "Produto/Serviço principal = squad" nem
   "Unidade de Valor = não squad" — a decisão sobre squad vem só das
   respostas S1-S8, quando um dia existir uma regra de interpretação
   (NÃO criada nesta versão — ver "SEM VEREDITO" abaixo).

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
     resultadoAutomatico, justificativaResultado, motorSquadVersion,
       decisaoFinal, formaDecisao: reservados para um motor de veredito
       FUTURO — sempre null nesta versão, nunca calculados, nunca
       exibidos como recomendação.

   SEM VEREDITO: esta tela nunca soma SIM, nunca calcula score, nunca
   decide Alta/Média/Baixa adequação nem "criar/não criar squad" — só
   coleta, persiste, versiona e apresenta as 8 respostas. A regra de
   interpretação fica para uma versão futura, definida separadamente. */
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
      flashLista: null,
      flashResultado: null,
      exportando: false,
      flashExportacao: null,
      filtroTexto: ''
    };

    function buscarItem(key) { return state.itens.filter(function (it) { return it._key === key; })[0]; }
    function clonarItem(it) { return JSON.parse(JSON.stringify(it)); }

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
        var emAndamento = state.itens.filter(function (it) {
          return !it.excluido && it.status === 'rascunho' && it.itemId === opts.itemId;
        })[0];
        if (emAndamento) { abrirExistente(emAndamento._key); return; }
        iniciarNovaAvaliacao(opts);
      }
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
      return '<p class="avp-decisao-aviso">Classificação arquitetural atual do item (somente leitura, não influencia esta avaliação): <strong>' +
        esc(c.label) + '</strong></p>';
    }

    /* ===================== FORM INICIAL ===================== */
    function renderFormInicial() {
      var a = state.atual;
      var html = '<button class="avp-voltar-link" id="sqVoltarListaInicial">‹ Adequação à Squad</button>';
      html += '<div class="avp-form-card">';
      html += '<h3>Avaliação de Adequação à Gestão por Squad</h3>';
      html += '<p class="avp-decisao-aviso">Esta avaliação não altera a classificação arquitetural do item. Seu objetivo é registrar evidências ' +
        'sobre demanda, evolução, autonomia, complexidade e ownership para apoiar a decisão organizacional sobre gestão por squad.</p>';
      html += '<div class="avp-field' + (state.erroForm ? ' avp-field--invalid' : '') + '">';
      html += '<label for="sqfNome">Nome do item *</label>';
      html += '<input type="text" id="sqfNome" value="' + esc(a.itemNome) + '">';
      if (state.erroForm) html += '<p class="avp-field-invalid-msg">' + esc(state.erroForm) + '</p>';
      html += '</div>';
      html += '</div>';
      html += '<div class="avp-actions-footer">';
      html += '<button class="btn btn--primary" id="sqIniciarBtn">INICIAR AVALIAÇÃO</button>';
      html += '<button class="btn" id="sqCancelarInicialBtn">CANCELAR</button>';
      html += '</div>';
      wrap.innerHTML = html;

      document.getElementById('sqVoltarListaInicial').addEventListener('click', function () { state.tela = 'lista'; state.atual = null; render(); });
      document.getElementById('sqfNome').addEventListener('input', function (e) { a.itemNome = e.target.value; });
      document.getElementById('sqCancelarInicialBtn').addEventListener('click', function () { state.tela = 'lista'; state.atual = null; render(); });
      document.getElementById('sqIniciarBtn').addEventListener('click', function () {
        if (!a.itemNome || !a.itemNome.trim()) { state.erroForm = 'Informe o nome do item.'; render(); return; }
        state.erroForm = null;
        state.tela = 'checklist';
        render();
        carregarContextoArquitetural();
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
    function salvarRegistro(status, cb, onErro) {
      var a = state.atual;
      var agora = new Date().toISOString();
      var key = a._key || db().ref(NODE).push().key;
      if (!a._key) a._key = key;
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
        /* Reservado para um motor de veredito FUTURO — nunca calculado
           nesta versão (item 16 do pedido: schema pronto, sem inventar
           valor nenhum). */
        resultadoAutomatico: null, justificativaResultado: null, motorSquadVersion: null,
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
      html += '<p class="avp-decisao-aviso">Avaliação concluída — interpretação organizacional ainda não definida.</p>';
      html += renderContextoArquitetural();
      html += '<p>Responsável: ' + esc((a.criadoPor && a.criadoPor.name) || '—') + ' · Concluída em: ' + fmtData(a.dataConclusao) +
        ' · Versão do questionário: ' + esc(a.questionnaireContentVersion || 1) + '</p>';
      html += '</div>';

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
      html += '</table>';
      html += '<h2 class="pdf-secao-titulo">Respostas S1-S8</h2>';
      perguntas.forEach(function (p) {
        var r = it.respostas[p.codigoEstavel] || {};
        html += '<div class="pdf-pergunta">' +
          '<p class="pdf-pergunta-texto">' + esc(p.codigoEstavel) + '. ' + esc(r.textoPerguntaNaEpoca || p.texto) + ' — <strong>' + (r.resposta === 'sim' ? 'SIM' : 'NÃO') + '</strong></p>' +
          '<p class="pdf-pergunta-campo"><strong>Justificativa:</strong> ' + (r.justificativaUsuario ? esc(r.justificativaUsuario) : '<em>Nenhuma observação registrada.</em>') + '</p>' +
          '</div>';
      });
      html += '<h2 class="pdf-secao-titulo">Resultado</h2>';
      html += '<p class="pdf-aviso">Avaliação registrada. Regra de interpretação de adequação à squad ainda não configurada.</p>';
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
  };
})();
