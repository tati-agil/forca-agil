/* ============================================================
   Força Ágil — Avaliação de Produto/Serviço (aba Arquitetura, admin)

   Checklist arquitetural para decidir se um item da organização deve
   ser classificado como Produto/Serviço. Node do Firebase:
   avaliacoes-produto/<key> = {
     nome, descricao, publico, necessidade, observacoesGerais,
     respostas: { <criterioId|exclusaoId>: { valor:'sim'|'nao', justificativaAuto, observacao } },
     status: 'rascunho' | 'concluido',
     resultadoAutomatico: 'produto' | 'nao-produto' | null (null em rascunho),
     criteriosEssenciaisFalhos: [id...], exclusoesConflitantes: [id...],
     criteriosAtendidos: número de critérios (não exclusões) respondidos SIM,
     classificacaoAlternativa: { label, motivo, outras: [label...] } | null,
     justificativaAutomatica: texto,
     decisaoFinal: 'produto' | 'nao-produto' (igual à automática até o admin discordar),
     decisaoManual, justificativaDecisao, alteradoPor: {name,email}, alteradoEm,
     responsavel: {name,email}, criadoEm, atualizadoEm
   }

   resultadoAutomatico nunca é reescrito pela decisão manual — é o
   histórico que a seção 10 do pedido exige que nunca desapareça.
   ============================================================ */
(function () {
  'use strict';

  var NODE = 'avaliacoes-produto';

  var CRITERIOS = [
    {
      id: 'necessidade', essencial: true, ordem: 1,
      titulo: 'Necessidade do cliente',
      pergunta: 'Este item atende a uma necessidade identificável de um cliente ou público específico?',
      ajuda: {
        significado: 'Este critério verifica se existe alguém para quem a solução faz sentido e uma necessidade que justifica sua existência.',
        quandoSim: 'Existe um cliente/público identificável e uma necessidade concreta atendida pelo item.',
        quandoNao: 'O item existe principalmente por uma necessidade interna, administrativa, tecnológica ou operacional, sem uma necessidade de cliente claramente identificável.',
        exemplo: 'Um participante quer se preparar para se aposentar com mais segurança financeira — essa é uma necessidade de cliente identificável.'
      },
      justSim: 'SIM — Existe uma necessidade de cliente identificável associada ao item.',
      justNao: 'NÃO — Não foi identificada uma necessidade de cliente suficientemente clara para caracterizar uma oferta.'
    },
    {
      id: 'resultado', essencial: true, ordem: 2, destaque: 'CRITÉRIO ESSENCIAL',
      titulo: 'Resultado próprio para o cliente',
      pergunta: 'O item entrega um resultado próprio e perceptível para o cliente?',
      ajuda: {
        significado: 'Este é o principal critério da avaliação. Um Produto/Serviço precisa produzir um resultado que faça sentido para o cliente por si só.',
        quandoSim: 'O cliente consegue reconhecer o benefício ou resultado obtido ao utilizar a solução — por exemplo: receber uma renda; obter proteção; adquirir um imóvel financiado; receber crédito; obter uma orientação estruturada.',
        quandoNao: 'O item apenas ajuda outra solução a produzir seu resultado — por exemplo: cadastro; cálculo; folha; autenticação; documento; cobrança; análise interna.',
        exemplo: 'Um empréstimo consignado entrega um resultado próprio (o crédito recebido); a análise de crédito que o viabiliza, sozinha, não entrega um resultado independente ao cliente.'
      },
      justSim: 'SIM — O item produz um resultado próprio e perceptível para o cliente.',
      justNao: 'NÃO — O item contribui para uma entrega, mas não apresenta resultado de cliente suficientemente independente.'
    },
    {
      id: 'solucao', essencial: true, ordem: 3,
      titulo: 'Solução identificável',
      pergunta: 'O item pode ser entendido pelo cliente como uma solução ou oferta identificável?',
      ajuda: {
        significado: 'Avalie se o item representa algo que o cliente consegue reconhecer como uma solução, e não apenas uma parte invisível da operação.',
        quandoSim: 'O item possui identidade e propósito próprios na relação com o cliente.',
        quandoNao: 'O item é apenas uma atividade, mecanismo ou elemento interno de outra solução.',
        exemplo: 'Um plano de previdência é reconhecido pelo participante como uma oferta própria; a rotina interna que atualiza saldo mensalmente não é.'
      },
      justSim: 'SIM — O item pode ser reconhecido como uma solução/oferta com propósito próprio.',
      justNao: 'NÃO — O item parece representar uma parte da operação ou de outra solução, e não uma oferta independente.'
    },
    {
      id: 'fronteira', essencial: true, ordem: 4,
      titulo: 'Fronteira coerente',
      pergunta: 'É possível delimitar claramente onde essa solução começa e termina?',
      ajuda: {
        significado: 'Uma solução deve ter uma fronteira coerente. Seus elementos devem pertencer ao mesmo propósito e contribuir para o mesmo resultado.',
        quandoSim: 'É possível identificar o que faz e o que não faz parte da solução.',
        quandoNao: 'O item é excessivamente genérico, transversal ou misturado com diversas outras soluções.',
        exemplo: 'Um seguro de vida tem escopo claro (o que cobre, quem cobre, por quanto tempo); "atendimento ao participante" em geral atravessa vários produtos e não tem essa fronteira.'
      },
      justSim: 'SIM — Existe uma fronteira coerente e identificável para a solução.',
      justNao: 'NÃO — A fronteira do item não está suficientemente clara para caracterizá-lo como uma solução autônoma.'
    },
    {
      id: 'jornada', essencial: false, ordem: 5,
      titulo: 'Jornada própria',
      pergunta: 'Existe uma jornada ou ciclo de vida identificável para esse item na relação com o cliente?',
      ajuda: {
        significado: 'Verifique se é possível reconhecer uma sequência coerente como contratar, utilizar, manter, alterar ou encerrar a solução.',
        quandoSim: 'Existe uma jornada identificável associada à solução.',
        quandoNao: 'O item ocorre somente como uma atividade dentro da jornada de outro produto.',
        exemplo: 'Contratar, acompanhar e resgatar um plano de previdência é uma jornada própria; preencher um cadastro não é.'
      },
      justSim: 'SIM — O item possui uma jornada ou ciclo de vida identificável.',
      justNao: 'NÃO — O item aparece principalmente como parte da jornada de outra solução.'
    },
    {
      id: 'medicao', essencial: false, ordem: 6,
      titulo: 'Medição de resultado',
      pergunta: 'É possível medir o resultado desse item de forma própria?',
      ajuda: {
        significado: 'O objetivo não é apenas medir quantidade de tarefas ou volume operacional. Deve ser possível medir se a solução está gerando seu resultado.',
        quandoSim: 'Existem ou podem existir indicadores próprios relacionados ao resultado da solução.',
        quandoNao: 'Os indicadores disponíveis medem somente atividades internas ou desempenho de outro produto.',
        exemplo: 'Taxa de satisfação de quem recebeu o benefício é um indicador de resultado; volume de cadastros processados por dia é um indicador operacional.'
      },
      justSim: 'SIM — O item admite mensuração própria de resultado.',
      justNao: 'NÃO — A mensuração parece depender essencialmente de outro produto ou de indicadores puramente operacionais.'
    },
    {
      id: 'gestao', essencial: false, ordem: 7,
      titulo: 'Gestão ponta a ponta',
      pergunta: 'Este item poderia ser gerido de ponta a ponta como uma solução?',
      ajuda: {
        significado: 'Avalie se seria possível atribuir responsabilidade sobre a evolução da solução, seu resultado, suas regras, sua experiência e seu desempenho.',
        quandoSim: 'Existe uma unidade coerente passível de gestão ponta a ponta.',
        quandoNao: 'O item é tão transversal ou fragmentado que funciona melhor como capacidade, processo ou componente de outras soluções.',
        exemplo: 'Um cartão consignado pode ter um dono responsável pela sua evolução; "processamento de pagamentos" em geral é transversal demais para isso.'
      },
      justSim: 'SIM — O item possui coerência suficiente para gestão ponta a ponta.',
      justNao: 'NÃO — O item parece exercer papel de suporte, processo ou capacidade compartilhada.'
    }
  ];

  var EXCLUSOES = [
    {
      id: 'canal', ordem: 1, classificacao: 'Canal',
      pergunta: 'O item é principalmente um canal de acesso ou relacionamento?',
      exemplos: ['portal', 'aplicativo', 'telefone', 'atendimento', 'agência', 'chatbot'],
      justSim: 'SIM — O item apresenta características predominantes de canal, e não de Produto/Serviço.',
      justNao: 'NÃO — O item não se resume a um canal de acesso ou relacionamento.'
    },
    {
      id: 'artefato', ordem: 2, classificacao: 'Artefato informacional',
      pergunta: 'O item é principalmente um documento, relatório ou informação entregue ao cliente?',
      exemplos: ['contracheque', 'demonstrativo', 'informe', 'extrato', 'relatório'],
      justSim: 'SIM — O item apresenta características predominantes de artefato informacional, e não de Produto/Serviço independente.',
      justNao: 'NÃO — O item não se limita a uma saída informacional entregue ao cliente.'
    },
    {
      id: 'capacidade', ordem: 3, classificacao: 'Capacidade',
      pergunta: 'O item é principalmente uma capacidade que a organização precisa possuir?',
      exemplos: ['gestão de dados', 'gestão atuarial', 'segurança', 'tecnologia', 'cobrança', 'cadastro'],
      justSim: 'SIM — O item apresenta características predominantes de capacidade organizacional.',
      justNao: 'NÃO — O item não se resume a uma capacidade organizacional interna.'
    },
    {
      id: 'processo', ordem: 4, classificacao: 'Processo/Etapa de processo',
      pergunta: 'O item é principalmente um processo ou uma etapa de processo?',
      exemplos: ['análise', 'cálculo', 'concessão', 'formalização', 'pagamento', 'habilitação'],
      justSim: 'SIM — O item apresenta características predominantes de processo ou etapa operacional.',
      justNao: 'NÃO — O item não se limita a um processo ou etapa operacional.'
    },
    {
      id: 'modalidade', ordem: 5, classificacao: 'Modalidade/opção',
      pergunta: 'O item é principalmente uma modalidade, opção ou configuração de outro produto?',
      exemplos: ['perfil', 'modalidade', 'forma de recebimento', 'opção tributária'],
      justSim: 'SIM — O item apresenta características predominantes de modalidade ou configuração de uma solução maior.',
      justNao: 'NÃO — O item não se resume a uma modalidade ou configuração de outra solução.'
    },
    {
      id: 'regra', ordem: 6, classificacao: 'Regra/condição',
      pergunta: 'O item é principalmente uma regra ou condição de outro produto?',
      exemplos: ['elegibilidade', 'prazo', 'limite', 'carência', 'regime tributário'],
      justSim: 'SIM — O item apresenta características predominantes de regra ou condição de outra solução.',
      justNao: 'NÃO — O item não se limita a uma regra ou condição de outra solução.'
    },
    {
      id: 'componente', ordem: 7, classificacao: 'Componente',
      pergunta: 'O item existe principalmente para que outro Produto/Serviço consiga entregar seu resultado?',
      ajudaExtra: 'Pergunte: se o produto principal deixasse de existir, este item ainda faria sentido como uma solução independente para o cliente?',
      justSim: 'SIM — O item apresenta características de componente ou elemento de suporte de outra solução.',
      justNao: 'NÃO — O item demonstra maior independência em relação a outras soluções.'
    }
  ];

  var TODAS_PERGUNTAS = CRITERIOS.concat(EXCLUSOES);
  var ALTERNATIVAS_LABELS = EXCLUSOES.map(function (e) { return e.classificacao; }).concat(['a validar']);

  function criterioPorId(id) { return CRITERIOS.filter(function (c) { return c.id === id; })[0]; }
  function exclusaoPorId(id) { return EXCLUSOES.filter(function (e) { return e.id === id; })[0]; }
  function definicaoPorId(id) { return criterioPorId(id) || exclusaoPorId(id); }

  function esc(s) {
    return String(s || '').replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function semPrefixo(s) { return String(s || '').replace(/^(SIM|NÃO)\s*—\s*/, ''); }
  function fmtData(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  function listaComE(arr) {
    if (!arr.length) return '';
    if (arr.length === 1) return arr[0];
    return arr.slice(0, -1).join(', ') + ' e ' + arr[arr.length - 1];
  }
  function sessaoAtual() {
    var sess = window.faAuth && window.faAuth.getSession();
    return sess ? { name: sess.name || sess.email, email: sess.email } : null;
  }

  /* ---- modais próprios (mesmo padrão visual de admin.js, sem depender dele) ---- */
  function avpAlert(mensagem, callbackOk) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9999';
    var box = document.createElement('div');
    box.className = 'modal-box';
    box.style.cssText = 'max-width:420px;width:90%;padding:28px;display:flex;flex-direction:column;gap:18px';
    box.innerHTML =
      '<p style="font-size:.95rem;line-height:1.6;color:var(--ink);white-space:pre-line">' + esc(mensagem) + '</p>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn btn--primary avp-modal-ok-btn">OK</button></div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function close() { document.body.removeChild(overlay); if (callbackOk) callbackOk(); }
    box.querySelector('.avp-modal-ok-btn').addEventListener('click', close);
    overlay.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); close(); } });
  }
  function avpConfirm(mensagem, callbackSim) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9999';
    var box = document.createElement('div');
    box.className = 'modal-box';
    box.style.cssText = 'max-width:420px;width:90%;padding:28px;display:flex;flex-direction:column;gap:18px';
    box.innerHTML =
      '<p style="font-size:.95rem;line-height:1.6;color:var(--ink);white-space:pre-line">' + esc(mensagem) + '</p>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px">' +
        '<button class="btn avp-modal-cancel-btn">Cancelar</button>' +
        '<button class="btn btn--primary avp-modal-confirm-btn">Confirmar</button></div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function close() { document.body.removeChild(overlay); }
    box.querySelector('.avp-modal-cancel-btn').addEventListener('click', close);
    overlay.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); close(); } });
    box.querySelector('.avp-modal-confirm-btn').addEventListener('click', function () { close(); if (callbackSim) callbackSim(); });
  }

  function db() { return firebase.database(); }

  /* ---- motor de decisão ---- */
  function computeResultado(atual) {
    var respostas = atual.respostas || {};
    var essenciaisFalhos = CRITERIOS.filter(function (c) {
      return c.essencial && respostas[c.id] && respostas[c.id].valor === 'nao';
    }).map(function (c) { return c.id; });
    var criteriosAtendidos = CRITERIOS.filter(function (c) {
      return respostas[c.id] && respostas[c.id].valor === 'sim';
    }).length;
    var exclusoesConflitantes = EXCLUSOES.filter(function (e) {
      return respostas[e.id] && respostas[e.id].valor === 'sim';
    }).map(function (e) { return e.id; });

    /* Regra de decisão (seção 5 do pedido): um NÃO essencial já decide;
       sem isso, um SIM predominante num teste de exclusão ainda derruba a
       classificação — é o item se autodeclarar "principalmente" outra
       coisa mesmo tendo passado nos critérios essenciais isoladamente. */
    var resultadoAutomatico = 'produto';
    if (essenciaisFalhos.length > 0 || exclusoesConflitantes.length > 0) resultadoAutomatico = 'nao-produto';

    var classificacaoAlternativa = null;
    if (resultadoAutomatico === 'nao-produto' && exclusoesConflitantes.length > 0) {
      var ordenadas = exclusoesConflitantes.slice().sort(function (a, b) {
        return exclusaoPorId(a).ordem - exclusaoPorId(b).ordem;
      });
      var principal = exclusaoPorId(ordenadas[0]);
      classificacaoAlternativa = {
        label: principal.classificacao,
        motivo: semPrefixo(principal.justSim),
        outras: ordenadas.slice(1).map(function (id) { return exclusaoPorId(id).classificacao; })
      };
    }

    return {
      essenciaisFalhos: essenciaisFalhos,
      criteriosAtendidos: criteriosAtendidos,
      exclusoesConflitantes: exclusoesConflitantes,
      resultadoAutomatico: resultadoAutomatico,
      classificacaoAlternativa: classificacaoAlternativa
    };
  }

  function gerarJustificativaAutomatica(atual, calc) {
    if (calc.resultadoAutomatico === 'produto') {
      var texto = 'O item foi classificado como Produto/Serviço porque atende a uma necessidade identificável, ' +
        'entrega resultado próprio para o cliente, possui fronteira coerente e pode ser reconhecido como uma solução independente.';
      var complementares = CRITERIOS.filter(function (c) {
        return !c.essencial && atual.respostas[c.id] && atual.respostas[c.id].valor === 'sim';
      }).map(function (c) { return c.titulo.toLowerCase(); });
      if (complementares.length) texto += ' Também apresenta ' + listaComE(complementares) + '.';
      return texto;
    }
    if (calc.essenciaisFalhos.length > 0) {
      var nomes = calc.essenciaisFalhos.map(function (id) { return criterioPorId(id).titulo.toLowerCase(); });
      return 'O item não foi classificado como Produto/Serviço porque não atende a um ou mais critérios essenciais: ' + listaComE(nomes) + '.';
    }
    var alt = calc.classificacaoAlternativa;
    return 'O item não foi classificado como Produto/Serviço porque, embora atenda isoladamente aos critérios essenciais, ' +
      'as respostas do teste de classificação indicam que ele exerce principalmente o papel de ' +
      (alt ? alt.label.toLowerCase() : 'outro elemento arquitetural') + ', e não de uma solução independente para o cliente.';
  }

  function todasRespondidas(atual) {
    var r = atual.respostas || {};
    return TODAS_PERGUNTAS.every(function (p) { return r[p.id] && (r[p.id].valor === 'sim' || r[p.id].valor === 'nao'); });
  }

  window.faInitAvaliacaoProduto = function () {
    var wrap = document.getElementById('adminAvaliacaoProduto');
    if (!wrap || wrap._avpBound) return;
    wrap._avpBound = true;

    var state = {
      tela: 'lista', /* 'lista' | 'form-inicial' | 'checklist' | 'resultado' */
      itens: [],
      filtro: { resultado: 'todos', status: 'todos', alterado: 'todos', alternativa: 'todos' },
      atual: null,
      erroForm: null,
      decisaoForm: null
    };

    function render() {
      if (state.tela === 'lista') renderLista();
      else if (state.tela === 'form-inicial') renderFormInicial();
      else if (state.tela === 'checklist') renderChecklist();
      else if (state.tela === 'resultado') renderResultado();
    }

    /* ===================== LISTA ===================== */
    function itemPassaFiltro(it) {
      if (state.filtro.resultado !== 'todos') {
        var decisao = it.decisaoFinal || it.resultadoAutomatico;
        if (decisao !== state.filtro.resultado) return false;
      }
      if (state.filtro.status !== 'todos' && it.status !== state.filtro.status) return false;
      if (state.filtro.alterado === 'sim' && !it.decisaoManual) return false;
      if (state.filtro.alternativa !== 'todos') {
        var alt = (it.classificacaoAlternativa && it.classificacaoAlternativa.label) ||
          (it.status === 'concluido' && it.resultadoAutomatico === 'nao-produto' ? 'a validar' : null);
        if (alt !== state.filtro.alternativa) return false;
      }
      return true;
    }

    function renderLista() {
      var filtrados = state.itens.filter(itemPassaFiltro);
      var html = '';
      html += '<div class="avp-intro">';
      html += '<p><strong>Conceito-base:</strong> Produto ou Serviço é uma solução que gera valor perceptível para o cliente ao atender a uma necessidade identificável. ' +
        'Uma solução deve possuir uma fronteira coerente: seus elementos pertencem ao mesmo propósito e contribuem para um resultado de cliente identificável.</p>';
      html += '<p class="avp-intro-principio">Nem tudo que gera valor precisa ser um Produto/Serviço. Um componente, processo, capacidade, canal ou documento pode ser essencial ' +
        'para a entrega sem constituir uma solução independente para o cliente.</p>';
      html += '</div>';

      html += '<div class="avp-actions-bar">';
      html += '<span class="avp-total">' + state.itens.length + ' avaliaç' + (state.itens.length === 1 ? 'ão' : 'ões') + ' registrada' + (state.itens.length === 1 ? '' : 's') + '</span>';
      html += '<button class="btn btn--primary" id="avpNovoBtn">+ Avaliar novo item</button>';
      html += '</div>';

      html += '<div class="avp-filters">';
      html += filtroSelect('avpFiltroResultado', state.filtro.resultado, [
        ['todos', 'Todos os resultados'], ['produto', 'É Produto/Serviço'], ['nao-produto', 'Não é Produto/Serviço']
      ]);
      html += filtroSelect('avpFiltroStatus', state.filtro.status, [
        ['todos', 'Todos os status'], ['rascunho', 'Rascunho'], ['concluido', 'Concluído']
      ]);
      html += filtroSelect('avpFiltroAlterado', state.filtro.alterado, [
        ['todos', 'Decisão automática ou manual'], ['sim', 'Alterado manualmente']
      ]);
      html += filtroSelect('avpFiltroAlternativa', state.filtro.alternativa, [['todos', 'Todas as classificações alternativas']].concat(
        ALTERNATIVAS_LABELS.map(function (l) { return [l, l]; })
      ));
      html += '</div>';

      if (!filtrados.length) {
        html += '<p class="admin-empty">Nenhuma avaliação nessa combinação de filtros.</p>';
      } else {
        html += '<div class="table-scroll-wrap"><table class="admin-table avp-table"><thead><tr>' +
          '<th>Item</th><th>Resultado automático</th><th>Decisão final</th><th>Classificação alternativa</th>' +
          '<th>Responsável</th><th>Data</th><th>Status</th><th>Ações</th></tr></thead><tbody>';
        filtrados.forEach(function (it) {
          var decisao = it.decisaoFinal || it.resultadoAutomatico;
          var alt = (it.classificacaoAlternativa && it.classificacaoAlternativa.label) ||
            (it.status === 'concluido' && it.resultadoAutomatico === 'nao-produto' ? 'a validar' : '—');
          html += '<tr>';
          html += '<td data-label="Item">' + esc(it.nome) + '</td>';
          html += '<td data-label="Resultado automático">' + resultadoBadge(it.resultadoAutomatico) + '</td>';
          html += '<td data-label="Decisão final">' + resultadoBadge(decisao) + (it.decisaoManual ? ' <span class="avp-tag-alterado">alterada</span>' : '') + '</td>';
          html += '<td data-label="Classificação alternativa">' + esc(alt) + '</td>';
          html += '<td data-label="Responsável">' + esc(it.responsavel && it.responsavel.name || '—') + '</td>';
          html += '<td data-label="Data">' + fmtData(it.atualizadoEm) + '</td>';
          html += '<td data-label="Status">' + statusBadge(it.status) + '</td>';
          html += '<td data-label="Ações"><div class="avp-row-actions">';
          if (it.status === 'concluido') {
            html += '<button class="btn btn--sm avp-act-ver" data-key="' + it._key + '">Visualizar</button>';
            html += '<button class="btn btn--sm avp-act-editar" data-key="' + it._key + '">Editar</button>';
            html += '<button class="btn btn--sm avp-act-reavaliar" data-key="' + it._key + '">Reavaliar</button>';
          } else {
            html += '<button class="btn btn--sm btn--primary avp-act-editar" data-key="' + it._key + '">Continuar</button>';
          }
          html += '<button class="btn btn--sm avp-act-duplicar" data-key="' + it._key + '">Duplicar</button>';
          html += '</div></td>';
          html += '</tr>';
        });
        html += '</tbody></table></div>';
      }

      wrap.innerHTML = html;

      document.getElementById('avpNovoBtn').addEventListener('click', function () {
        state.atual = { nome: '', descricao: '', publico: '', necessidade: '', observacoesGerais: '', respostas: {} };
        state.erroForm = null;
        state.tela = 'form-inicial';
        render();
      });
      ['Resultado', 'Status', 'Alterado', 'Alternativa'].forEach(function (campo) {
        var sel = document.getElementById('avpFiltro' + campo);
        sel.addEventListener('change', function () {
          state.filtro[campo.toLowerCase()] = sel.value;
          render();
        });
      });
      wrap.querySelectorAll('.avp-act-ver').forEach(function (btn) {
        btn.addEventListener('click', function () { abrirVisualizacao(btn.dataset.key); });
      });
      wrap.querySelectorAll('.avp-act-editar').forEach(function (btn) {
        btn.addEventListener('click', function () { abrirEdicao(btn.dataset.key); });
      });
      wrap.querySelectorAll('.avp-act-reavaliar').forEach(function (btn) {
        btn.addEventListener('click', function () { abrirReavaliacao(btn.dataset.key); });
      });
      wrap.querySelectorAll('.avp-act-duplicar').forEach(function (btn) {
        btn.addEventListener('click', function () { duplicar(btn.dataset.key); });
      });
    }

    function filtroSelect(id, valorAtual, opcoes) {
      var html = '<select class="avp-select" id="' + id + '">';
      opcoes.forEach(function (o) {
        html += '<option value="' + esc(o[0]) + '"' + (o[0] === valorAtual ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
      });
      html += '</select>';
      return html;
    }
    function resultadoBadge(v) {
      if (v === 'produto') return '<span class="avp-badge avp-badge--produto">É Produto/Serviço</span>';
      if (v === 'nao-produto') return '<span class="avp-badge avp-badge--nao-produto">Não é Produto/Serviço</span>';
      return '<span class="avp-badge">—</span>';
    }
    function statusBadge(v) {
      return v === 'concluido'
        ? '<span class="avp-badge avp-badge--concluido">Concluído</span>'
        : '<span class="avp-badge avp-badge--rascunho">Rascunho</span>';
    }

    function buscarItem(key) { return state.itens.filter(function (it) { return it._key === key; })[0]; }
    function clonarItem(it) { return JSON.parse(JSON.stringify(it)); }

    function abrirVisualizacao(key) {
      var it = buscarItem(key);
      if (!it) return;
      state.atual = clonarItem(it);
      state.decisaoForm = { opcao: it.decisaoManual ? it.decisaoFinal : 'auto', justificativa: it.justificativaDecisao || '', erro: null };
      state.tela = 'resultado';
      render();
    }
    function abrirEdicao(key) {
      var it = buscarItem(key);
      if (!it) return;
      state.atual = clonarItem(it);
      if (!state.atual.respostas) state.atual.respostas = {};
      state.erroForm = null;
      state.tela = 'checklist';
      render();
    }
    function abrirReavaliacao(key) {
      var it = buscarItem(key);
      if (!it) return;
      state.atual = clonarItem(it);
      state.atual.respostas = {};
      state.erroForm = null;
      state.tela = 'checklist';
      render();
    }
    function duplicar(key) {
      var it = buscarItem(key);
      if (!it) return;
      state.atual = {
        nome: (it.nome || '') + ' (cópia)',
        descricao: it.descricao || '', publico: it.publico || '', necessidade: it.necessidade || '',
        observacoesGerais: '', respostas: {}
      };
      state.erroForm = null;
      state.tela = 'checklist';
      render();
    }

    /* ===================== FORM INICIAL ===================== */
    function renderFormInicial() {
      var a = state.atual;
      var html = '<div class="avp-form-card">';
      html += '<h3>Avaliar novo item</h3>';
      if (state.erroForm) html += '<p class="avp-error-msg">' + esc(state.erroForm) + '</p>';
      html += campoTexto('avpfNome', 'Nome do item', a.nome, true, false);
      html += campoTexto('avpfDescricao', 'Descrição do item', a.descricao, false, true);
      html += campoTexto('avpfPublico', 'Público/cliente relacionado', a.publico, false, false);
      html += campoTexto('avpfNecessidade', 'Necessidade que o item pretende atender', a.necessidade, false, true);
      html += campoTexto('avpfObs', 'Observações (opcional)', a.observacoesGerais, false, true);
      html += '<div class="avp-actions-footer">';
      html += '<button class="btn btn--primary" id="avpIniciarBtn">INICIAR AVALIAÇÃO</button>';
      html += '<button class="btn" id="avpCancelarInicialBtn">CANCELAR</button>';
      html += '</div></div>';
      wrap.innerHTML = html;

      bindCampoTexto('avpfNome', 'nome');
      bindCampoTexto('avpfDescricao', 'descricao');
      bindCampoTexto('avpfPublico', 'publico');
      bindCampoTexto('avpfNecessidade', 'necessidade');
      bindCampoTexto('avpfObs', 'observacoesGerais');

      document.getElementById('avpIniciarBtn').addEventListener('click', function () {
        if (!state.atual.nome || !state.atual.nome.trim()) {
          state.erroForm = 'Informe o nome do item.';
          render();
          return;
        }
        state.erroForm = null;
        state.tela = 'checklist';
        render();
      });
      document.getElementById('avpCancelarInicialBtn').addEventListener('click', function () {
        state.atual = null;
        state.tela = 'lista';
        render();
      });
    }

    function campoTexto(id, label, valor, obrigatorio, textarea) {
      var html = '<div class="avp-field">';
      html += '<label for="' + id + '">' + esc(label) + (obrigatorio ? ' *' : '') + '</label>';
      if (textarea) html += '<textarea id="' + id + '" rows="3">' + esc(valor) + '</textarea>';
      else html += '<input type="text" id="' + id + '" value="' + esc(valor) + '">';
      html += '</div>';
      return html;
    }
    function bindCampoTexto(id, campo) {
      var el = document.getElementById(id);
      el.addEventListener('input', function () { state.atual[campo] = el.value; });
    }

    /* ===================== CHECKLIST ===================== */
    function renderChecklist() {
      var a = state.atual;
      var html = '<div class="avp-checklist">';
      html += '<button class="avp-voltar-link" id="avpVoltarLista">‹ Avaliações de Produto/Serviço</button>';
      html += '<div class="avp-form-card">';
      html += '<h3>' + (a._key ? 'Editando avaliação' : 'Nova avaliação') + '</h3>';
      html += campoTexto('avpcNome', 'Nome do item', a.nome, true, false);
      html += campoTexto('avpcDescricao', 'Descrição do item', a.descricao, false, true);
      html += campoTexto('avpcPublico', 'Público/cliente relacionado', a.publico, false, false);
      html += campoTexto('avpcNecessidade', 'Necessidade que o item pretende atender', a.necessidade, false, true);
      html += campoTexto('avpcObs', 'Observações (opcional)', a.observacoesGerais, false, true);
      html += '</div>';

      if (state.erroForm) html += '<p class="avp-error-msg">' + esc(state.erroForm) + '</p>';

      html += '<div class="avp-criterios">';
      CRITERIOS.forEach(function (c) { html += renderPergunta(c, a.respostas[c.id]); });
      html += '</div>';

      html += '<div class="avp-exclusao-section">';
      html += '<h3 class="avp-exclusao-titulo">TESTE DE CLASSIFICAÇÃO</h3>';
      html += '<p class="avp-exclusao-intro">Agora verifique se o item é, na realidade, outro tipo de elemento arquitetural.</p>';
      EXCLUSOES.forEach(function (e) { html += renderPergunta(e, a.respostas[e.id]); });
      html += '</div>';

      html += '<div class="avp-actions-footer">';
      html += '<button class="btn" id="avpSalvarRascunhoBtn">SALVAR RASCUNHO</button>';
      html += '<button class="btn btn--primary" id="avpConcluirBtn">CONCLUIR AVALIAÇÃO</button>';
      html += '<button class="btn" id="avpCancelarChecklistBtn">CANCELAR</button>';
      html += '</div>';
      html += '</div>';
      wrap.innerHTML = html;

      document.getElementById('avpVoltarLista').addEventListener('click', function () { cancelarChecklist(); });
      bindCampoTexto('avpcNome', 'nome');
      bindCampoTexto('avpcDescricao', 'descricao');
      bindCampoTexto('avpcPublico', 'publico');
      bindCampoTexto('avpcNecessidade', 'necessidade');
      bindCampoTexto('avpcObs', 'observacoesGerais');

      wrap.querySelectorAll('.avp-help-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var box = document.getElementById('avpHelp-' + btn.dataset.id);
          if (box) box.hidden = !box.hidden;
        });
      });
      wrap.querySelectorAll('.avp-choice-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.closest('.avp-choice-group').dataset.id;
          var valor = btn.dataset.valor;
          var def = definicaoPorId(id);
          var obsAnterior = (a.respostas[id] && a.respostas[id].observacao) || '';
          a.respostas[id] = {
            valor: valor,
            justificativaAuto: valor === 'sim' ? def.justSim : def.justNao,
            observacao: obsAnterior
          };
          state.erroForm = null;
          render();
        });
      });
      wrap.querySelectorAll('.avp-observacao').forEach(function (ta) {
        ta.addEventListener('input', function () {
          var id = ta.dataset.id;
          if (a.respostas[id]) a.respostas[id].observacao = ta.value;
        });
      });

      document.getElementById('avpSalvarRascunhoBtn').addEventListener('click', function () {
        if (!a.nome || !a.nome.trim()) { state.erroForm = 'Informe o nome do item.'; render(); return; }
        salvarRegistro('rascunho', function () {
          state.atual = null;
          state.tela = 'lista';
          render();
        });
      });
      document.getElementById('avpConcluirBtn').addEventListener('click', function () {
        if (!a.nome || !a.nome.trim()) { state.erroForm = 'Informe o nome do item.'; render(); return; }
        if (!todasRespondidas(a)) {
          state.erroForm = 'Responda SIM ou NÃO em todas as perguntas antes de concluir a avaliação.';
          render();
          window.scrollTo({ top: wrap.offsetTop, behavior: 'smooth' });
          return;
        }
        salvarRegistro('concluido', function () {
          state.decisaoForm = { opcao: 'auto', justificativa: '', erro: null };
          state.tela = 'resultado';
          render();
        });
      });
      document.getElementById('avpCancelarChecklistBtn').addEventListener('click', function () { cancelarChecklist(); });
    }

    function cancelarChecklist() {
      avpConfirm('Descartar esta avaliação sem salvar?', function () {
        state.atual = null;
        state.tela = 'lista';
        render();
      });
    }

    function renderPergunta(def, resposta) {
      var essencialClass = def.essencial ? ' avp-question--essencial' : '';
      var html = '<div class="avp-question' + essencialClass + '">';
      html += '<div class="avp-question-head">';
      if (def.destaque) html += '<span class="avp-badge avp-badge--essencial">' + esc(def.destaque) + '</span>';
      html += '<p class="avp-question-text">' + esc(def.pergunta) + '</p>';
      html += '<button type="button" class="avp-help-btn" data-id="' + def.id + '" aria-label="Ajuda sobre este critério">?</button>';
      html += '</div>';
      if (def.exemplos) {
        html += '<p class="avp-exemplos">Exemplos: ' + esc(def.exemplos.join('; ')) + '.</p>';
      }
      html += '<div class="avp-help-box" id="avpHelp-' + def.id + '" hidden>';
      if (def.ajuda) {
        html += '<p><strong>O que significa:</strong> ' + esc(def.ajuda.significado) + '</p>';
        html += '<p><strong>Quando marcar SIM:</strong> ' + esc(def.ajuda.quandoSim) + '</p>';
        html += '<p><strong>Quando marcar NÃO:</strong> ' + esc(def.ajuda.quandoNao) + '</p>';
        html += '<p><strong>Exemplo:</strong> ' + esc(def.ajuda.exemplo) + '</p>';
      } else {
        if (def.ajudaExtra) html += '<p>' + esc(def.ajudaExtra) + '</p>';
        html += '<p><strong>Se SIM:</strong> ' + esc(semPrefixo(def.justSim)) + '</p>';
        html += '<p><strong>Se NÃO:</strong> ' + esc(semPrefixo(def.justNao)) + '</p>';
      }
      html += '</div>';
      html += '<div class="avp-choice-group" data-id="' + def.id + '">';
      html += '<button type="button" class="avp-choice-btn avp-choice-btn--sim' + (resposta && resposta.valor === 'sim' ? ' active' : '') + '" data-valor="sim">SIM</button>';
      html += '<button type="button" class="avp-choice-btn avp-choice-btn--nao' + (resposta && resposta.valor === 'nao' ? ' active' : '') + '" data-valor="nao">NÃO</button>';
      html += '</div>';
      if (resposta && resposta.valor) {
        html += '<p class="avp-justificativa avp-justificativa--' + resposta.valor + '">' + esc(resposta.justificativaAuto) + '</p>';
        html += '<textarea class="avp-observacao" data-id="' + def.id + '" placeholder="Observação do avaliador (opcional)">' + esc(resposta.observacao) + '</textarea>';
      }
      html += '</div>';
      return html;
    }

    /* ===================== SALVAR ===================== */
    function salvarRegistro(status, cb) {
      var a = state.atual;
      var agora = new Date().toISOString();
      var payload = {
        nome: a.nome.trim(),
        descricao: a.descricao || '',
        publico: a.publico || '',
        necessidade: a.necessidade || '',
        observacoesGerais: a.observacoesGerais || '',
        respostas: a.respostas || {},
        status: status,
        responsavel: a.responsavel || sessaoAtual(),
        criadoEm: a.criadoEm || agora,
        atualizadoEm: agora,
        resultadoAutomatico: null,
        criteriosEssenciaisFalhos: null,
        exclusoesConflitantes: null,
        criteriosAtendidos: null,
        classificacaoAlternativa: null,
        justificativaAutomatica: null,
        decisaoFinal: null,
        decisaoManual: false,
        justificativaDecisao: null,
        alteradoPor: null,
        alteradoEm: null
      };
      if (status === 'concluido') {
        var calc = computeResultado(a);
        payload.resultadoAutomatico = calc.resultadoAutomatico;
        payload.criteriosEssenciaisFalhos = calc.essenciaisFalhos;
        payload.exclusoesConflitantes = calc.exclusoesConflitantes;
        payload.criteriosAtendidos = calc.criteriosAtendidos;
        payload.classificacaoAlternativa = calc.classificacaoAlternativa;
        payload.justificativaAutomatica = gerarJustificativaAutomatica(a, calc);
        payload.decisaoFinal = calc.resultadoAutomatico;
      }
      var ref = a._key ? db().ref(NODE + '/' + a._key) : db().ref(NODE).push();
      ref.set(payload, function (err) {
        if (err) { avpAlert('Erro ao salvar. Tente novamente.'); return; }
        state.atual = Object.assign({ _key: ref.key }, payload);
        if (cb) cb();
      });
    }

    /* ===================== RESULTADO ===================== */
    function renderResultado() {
      var a = state.atual;
      var produto = a.resultadoAutomatico === 'produto';
      var html = '<div class="avp-resultado">';
      html += '<button class="avp-voltar-link" id="avpVoltarListaResultado">‹ Avaliações de Produto/Serviço</button>';

      html += '<div class="avp-result-card ' + (produto ? 'avp-result-card--produto' : 'avp-result-card--nao-produto') + '">';
      html += '<span class="avp-result-label">RESULTADO DA AVALIAÇÃO</span>';
      html += '<h3 class="avp-result-nome">' + esc(a.nome) + '</h3>';
      html += '<div class="avp-result-badge-grande">' + (produto ? 'É PRODUTO/SERVIÇO' : 'NÃO É PRODUTO/SERVIÇO') + '</div>';
      html += '<p class="avp-result-secundario">Critérios atendidos: ' + a.criteriosAtendidos + ' de ' + CRITERIOS.length + '</p>';
      html += '</div>';

      html += '<div class="avp-form-card">';
      html += '<h4>Justificativa da classificação</h4>';
      html += '<p>' + esc(a.justificativaAutomatica) + '</p>';
      html += '</div>';

      if (!produto) {
        html += '<div class="avp-form-card avp-alt-card">';
        html += '<h4>O que este item parece ser?</h4>';
        if (a.classificacaoAlternativa) {
          html += '<p class="avp-alt-label">Classificação sugerida: <strong>' + esc(a.classificacaoAlternativa.label) + '</strong></p>';
          html += '<p><strong>Motivo:</strong> ' + esc(a.classificacaoAlternativa.motivo) + '</p>';
          if (a.classificacaoAlternativa.outras && a.classificacaoAlternativa.outras.length) {
            html += '<p class="avp-alt-outras">Também apresenta sinais de: ' + esc(a.classificacaoAlternativa.outras.join(', ')) + '.</p>';
          }
        } else {
          html += '<p class="avp-alt-label">Classificação alternativa: <em>a validar</em></p>';
        }
        html += '</div>';
      }

      html += '<div class="avp-form-card">';
      html += '<h4>Como chegamos a essa conclusão?</h4>';
      html += '<div class="avp-reasoning-list">';
      CRITERIOS.forEach(function (c) { html += renderRaciocinio(c, a.respostas[c.id]); });
      html += '<p class="avp-reasoning-sep">Testes de classificação</p>';
      EXCLUSOES.forEach(function (e) { html += renderRaciocinio(e, a.respostas[e.id]); });
      html += '</div></div>';

      html += renderDecisaoCard(a);

      html += '</div>';
      wrap.innerHTML = html;

      document.getElementById('avpVoltarListaResultado').addEventListener('click', function () {
        state.atual = null;
        state.tela = 'lista';
        render();
      });
      bindDecisaoCard();
    }

    function renderRaciocinio(def, resposta) {
      if (!resposta) return '';
      var valor = resposta.valor === 'sim' ? 'SIM' : 'NÃO';
      return '<div class="avp-reasoning-item">' +
        '<p class="avp-reasoning-q">' + esc(def.titulo || def.pergunta) + ' — ' + valor + '</p>' +
        '<p class="avp-reasoning-a">✓ ' + esc(semPrefixo(resposta.justificativaAuto)) + '</p>' +
        '</div>';
    }

    function renderDecisaoCard(a) {
      var f = state.decisaoForm;
      var html = '<div class="avp-form-card avp-decisao-card">';
      html += '<h4>Decisão arquitetural</h4>';
      if (a.decisaoManual) {
        html += '<p class="avp-history-note">Alterado manualmente por <strong>' + esc(a.alteradoPor && a.alteradoPor.name || '—') +
          '</strong> em ' + fmtData(a.alteradoEm) + '. Justificativa registrada: "' + esc(a.justificativaDecisao || '') + '"</p>';
      }
      html += '<div class="avp-decisao-options">';
      html += decisaoOpcao('auto', 'Aceitar recomendação do sistema (' + (a.resultadoAutomatico === 'produto' ? 'É Produto/Serviço' : 'Não é Produto/Serviço') + ')', f.opcao);
      html += decisaoOpcao('produto', 'Classificar manualmente como Produto/Serviço', f.opcao);
      html += decisaoOpcao('nao-produto', 'Classificar manualmente como não Produto/Serviço', f.opcao);
      html += '</div>';
      if (f.opcao !== 'auto') {
        html += '<div class="avp-field">';
        html += '<label for="avpJustificativaDecisao">Justificativa da decisão arquitetural *</label>';
        html += '<textarea id="avpJustificativaDecisao" rows="3">' + esc(f.justificativa) + '</textarea>';
        html += '</div>';
      }
      if (f.erro) html += '<p class="avp-error-msg">' + esc(f.erro) + '</p>';
      html += '<button class="btn btn--primary" id="avpSalvarDecisaoBtn">Salvar decisão</button>';
      html += '</div>';
      return html;
    }
    function decisaoOpcao(valor, label, atual) {
      return '<label class="avp-decisao-option"><input type="radio" name="avpDecisao" value="' + valor + '"' +
        (valor === atual ? ' checked' : '') + '> ' + esc(label) + '</label>';
    }
    function bindDecisaoCard() {
      wrap.querySelectorAll('input[name="avpDecisao"]').forEach(function (radio) {
        radio.addEventListener('change', function () {
          state.decisaoForm.opcao = radio.value;
          state.decisaoForm.erro = null;
          render();
        });
      });
      var ta = document.getElementById('avpJustificativaDecisao');
      if (ta) ta.addEventListener('input', function () { state.decisaoForm.justificativa = ta.value; });
      var btn = document.getElementById('avpSalvarDecisaoBtn');
      if (btn) btn.addEventListener('click', salvarDecisao);
    }
    function salvarDecisao() {
      var a = state.atual;
      var f = state.decisaoForm;
      var justificativa = (f.justificativa || '').trim();
      if (f.opcao !== 'auto' && !justificativa) {
        f.erro = 'Justificativa obrigatória para decisão manual.';
        render();
        return;
      }
      var updates = { atualizadoEm: new Date().toISOString() };
      if (f.opcao === 'auto') {
        updates.decisaoFinal = a.resultadoAutomatico;
        updates.decisaoManual = false;
        updates.justificativaDecisao = null;
        updates.alteradoPor = null;
        updates.alteradoEm = null;
      } else {
        var sess = sessaoAtual();
        updates.decisaoFinal = f.opcao;
        updates.decisaoManual = true;
        updates.justificativaDecisao = justificativa;
        updates.alteradoPor = sess;
        updates.alteradoEm = new Date().toISOString();
      }
      db().ref(NODE + '/' + a._key).update(updates, function (err) {
        if (err) { avpAlert('Erro ao salvar a decisão. Tente novamente.'); return; }
        Object.assign(a, updates);
        f.erro = null;
        render();
      });
    }

    /* ===================== CARGA ===================== */
    db().ref(NODE).on('value', function (snap) {
      var arr = [];
      snap.forEach(function (c) { arr.push(Object.assign({ _key: c.key }, c.val())); });
      arr.sort(function (x, y) { return (y.atualizadoEm || '').localeCompare(x.atualizadoEm || ''); });
      state.itens = arr;
      if (state.tela === 'lista') render();
    }, function () {
      if (state.tela === 'lista') {
        wrap.innerHTML = '<p class="admin-empty" style="color:var(--red)">Erro ao carregar avaliações. Recarregue a página.</p>';
      }
    });

    render();
  };
})();
