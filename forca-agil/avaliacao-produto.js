/* ============================================================
   Força Ágil — Avaliação de Produto/Serviço (aba Arquitetura, admin)

   Checklist arquitetural para decidir se um item da organização deve
   ser classificado como Produto/Serviço. Node do Firebase:
   avaliacoes-produto/<key> = {
     nome, descricao, publico, necessidade, observacoesGerais,
     respostas: { <criterioId|exclusaoId>: { valor:'sim'|'nao', justificativaAuto, observacao } },
     status: 'rascunho' | 'concluido',
     resultadoAutomatico: 'produto' | 'nao-produto' | 'a-validar' | null (null em rascunho),
     criteriosEssenciaisFalhos: [id...], exclusoesConflitantes: [id...],
     criteriosAtendidos: número de critérios (não exclusões) respondidos SIM,
     camadaSugerida: { id, label, motivos: [texto...], conflito: [label...]|null } | null,
     justificativaAutomatica: texto,
     decisaoFinal: 'produto' | 'nao-produto' | 'a-validar' (igual à automática até o admin discordar),
     decisaoManual, justificativaDecisao, alteradoPor: {name,email}, alteradoEm,
     responsavel: {name,email}, criadoEm, atualizadoEm
   }

   resultadoAutomatico nunca é reescrito pela decisão manual — é o
   histórico que a seção 10 do pedido exige que nunca desapareça.

   O motor (identificarCamada, mais abaixo) primeiro descobre a camada
   arquitetural mais provável a partir do CONJUNTO das 14 respostas — nunca
   de uma resposta isolada, e nunca do nome/descrição do item — e só depois
   traduz essa camada em "é/não é Produto/Serviço" por um mapa fixo
   (RESULTADO_POR_CAMADA). Isso evita que duas coisas que respondem "sim"
   para a mesma pergunta de exclusão (ex.: modalidade/opção/configuração)
   sejam necessariamente classificadas do mesmo jeito — outras respostas do
   mesmo questionário (resultado próprio, gestão ponta a ponta, fronteira)
   decidem se aquele "sim" descreve a própria opção ou uma funcionalidade
   que age sobre ela.
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

  /* Taxonomia arquitetural completa — o resultado de identificarCamada é
     sempre um destes 12 valores. "produto" marca só a camada que conta como
     Produto/Serviço principal; todas as outras são camadas legítimas mas
     não-produto (ver RESULTADO_POR_CAMADA). */
  var CAMADAS = [
    { id: 'produto-principal', label: 'Produto/Serviço principal' },
    { id: 'unidade-valor-associada', label: 'Unidade de valor associada' },
    { id: 'modalidade-subproduto', label: 'Modalidade/Subproduto' },
    { id: 'funcionalidade-operacao', label: 'Funcionalidade/Operação' },
    { id: 'componente', label: 'Componente' },
    { id: 'regra-condicao', label: 'Regra/Condição' },
    { id: 'processo-etapa', label: 'Processo/Etapa de processo' },
    { id: 'capacidade-organizacional', label: 'Capacidade organizacional' },
    { id: 'ferramenta', label: 'Ferramenta' },
    { id: 'canal', label: 'Canal' },
    { id: 'documento-informacao', label: 'Documento/Informação' },
    { id: 'a-validar', label: 'A validar' }
  ];
  function camadaPorId(id) { return CAMADAS.filter(function (c) { return c.id === id; })[0]; }

  /* Mapa fixo e simples: só decide se a camada JÁ IDENTIFICADA conta como
     Produto/Serviço. Nunca o inverso — o motor não tenta primeiro decidir
     "é/não é produto" e só depois adivinhar uma camada alternativa. */
  var RESULTADO_POR_CAMADA = { 'produto-principal': 'produto', 'a-validar': 'a-validar' };
  function resultadoDaCamada(camadaId) { return RESULTADO_POR_CAMADA[camadaId] || 'nao-produto'; }

  /* Rótulo de cada uma das 14 perguntas, para compor dinamicamente a lista
     "Por que o sistema chegou a essa conclusão" com a resposta real dada
     (nunca uma reformulação silenciosa dela). */
  var ROTULOS_SINAL = {
    necessidade: 'Necessidade de cliente identificável',
    resultado: 'Resultado próprio perceptível para o cliente',
    solucao: 'Reconhecível como solução/oferta própria',
    fronteira: 'Fronteira coerente e delimitável',
    jornada: 'Jornada própria com o cliente',
    medicao: 'Mensuração própria de resultado',
    gestao: 'Pode ser gerido de ponta a ponta como solução própria',
    canal: 'Funciona predominantemente como canal de acesso',
    artefato: 'Funciona predominantemente como documento/informação entregue',
    capacidade: 'Funciona predominantemente como capacidade organizacional',
    processo: 'Funciona predominantemente como processo/etapa de processo',
    modalidade: 'Funciona predominantemente como modalidade/opção/configuração',
    regra: 'Funciona predominantemente como regra/condição',
    componente: 'Existe para que outro Produto/Serviço entregue seu resultado'
  };

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

  /* ---- motor de decisão -------------------------------------------------
     identificarCamada nunca decide por uma resposta isolada: cada camada
     candidata exige pelo menos duas respostas convergentes (nunca "SIM em
     modalidade ⇒ é Modalidade"), e as sete respostas de exclusão são
     sempre cruzadas com sinais de autonomia/resultado próprio dos sete
     critérios, nunca lidas como testes independentes. Quando duas ou mais
     camadas ficam igualmente sustentadas pelas respostas, ou nenhuma
     encontra sustentação suficiente, o resultado é 'a-validar' — o motor
     nunca força uma escolha. Nada aqui olha para nome/descrição do item. */
  function identificarCamada(atual) {
    var r = atual.respostas || {};
    function sim(id) { return !!(r[id] && r[id].valor === 'sim'); }

    var necessidade = sim('necessidade'), resultado = sim('resultado'), solucao = sim('solucao'),
      fronteira = sim('fronteira'), jornada = sim('jornada'), gestao = sim('gestao');
    var canal = sim('canal'), artefato = sim('artefato'), capacidade = sim('capacidade'), processo = sim('processo'),
      modalidade = sim('modalidade'), regra = sim('regra'), componente = sim('componente');

    var nucleoCompleto = necessidade && resultado && solucao && fronteira;
    var exclusoesSim = EXCLUSOES.filter(function (e) { return sim(e.id); }).map(function (e) { return e.id; });

    var candidatos = [];
    function candidata(id, sinais) { candidatos.push({ camada: id, sinais: sinais }); }

    /* Produto/Serviço principal: núcleo essencial completo e nenhum teste
       de exclusão se sustenta — nada nas respostas contradiz a
       independência da solução. */
    if (nucleoCompleto && exclusoesSim.length === 0) {
      candidata('produto-principal', ['necessidade', 'resultado', 'solucao', 'fronteira']);
    }

    /* Unidade de valor associada: tem resultado próprio, fronteira e
       necessidade de cliente (como um produto), mas não passa no teste de
       gestão ponta a ponta E também se autodeclara modalidade/componente de
       algo maior — ou seja, tem valor próprio mas continua subordinada. */
    if (resultado && fronteira && necessidade && !gestao && (modalidade || componente)) {
      candidata('unidade-valor-associada', ['resultado', 'fronteira', 'necessidade', modalidade ? 'modalidade' : 'componente', 'gestao']);
    }

    /* Modalidade/opção SIM sem resultado próprio marcante nem gestão ponta a
       ponta: é a própria opção/configuração, não uma ação sobre ela. */
    if (modalidade && !resultado && !gestao) {
      candidata('modalidade-subproduto', ['modalidade', 'resultado', 'gestao']);
    }

    /* Funcionalidade/Operação: a mesma resposta de modalidade/regra/processo
       SIM, mas agora COM sinal de autonomia (resultado próprio ou gestão
       ponta a ponta) e SEM o par fronteira+solução que caracterizaria uma
       oferta independente — é uma ação que atua sobre outra coisa, não a
       coisa em si nem um produto à parte. Este é o sinal que separa, por
       exemplo, a opção em si da ação que a altera, usando só respostas do
       questionário, nunca o nome do item. */
    if ((modalidade || regra || processo) && (resultado || gestao) && !(fronteira && solucao)) {
      var gatilhoFuncional = modalidade ? 'modalidade' : (regra ? 'regra' : 'processo');
      candidata('funcionalidade-operacao', [gatilhoFuncional, resultado ? 'resultado' : 'gestao', fronteira ? 'solucao' : 'fronteira']);
    }

    /* Ferramenta: instrumento de apoio interno reutilizável — capacidade E
       componente ao mesmo tempo (mais específico que qualquer um sozinho),
       sem necessidade de cliente nem resultado próprio. Por ser mais
       específica, prevalece sobre "Capacidade organizacional" e sobre
       "Componente" quando as três respostas coincidem — nunca por ordem
       fixa de prioridade, e sim porque exige mais evidência convergente. */
    var ehFerramenta = capacidade && componente && !necessidade && !resultado;
    if (ehFerramenta) {
      candidata('ferramenta', ['capacidade', 'componente', 'necessidade', 'resultado']);
    } else if (capacidade && !necessidade && !componente) {
      candidata('capacidade-organizacional', ['capacidade', 'necessidade', 'componente']);
    }
    if (componente && !resultado && !ehFerramenta) {
      candidata('componente', ['componente', 'resultado']);
    }

    if (regra && !resultado && !gestao) {
      candidata('regra-condicao', ['regra', 'resultado', 'gestao']);
    }
    if (processo && !jornada && !gestao) {
      candidata('processo-etapa', ['processo', 'jornada', 'gestao']);
    }
    if (canal && !resultado) {
      candidata('canal', ['canal', 'resultado']);
    }
    if (artefato && !resultado) {
      candidata('documento-informacao', ['artefato', 'resultado']);
    }

    var camadaEscolhida, motivos = [], conflito = null;
    if (candidatos.length === 1) {
      camadaEscolhida = candidatos[0].camada;
      motivos = candidatos[0].sinais.map(function (id) { return ROTULOS_SINAL[id] + ': ' + (sim(id) ? 'SIM' : 'NÃO'); });
    } else if (candidatos.length === 0) {
      camadaEscolhida = 'a-validar';
    } else {
      camadaEscolhida = 'a-validar';
      conflito = candidatos.map(function (c) { return camadaPorId(c.camada).label; });
      var vistos = {};
      candidatos.forEach(function (c) {
        c.sinais.forEach(function (id) {
          if (vistos[id]) return;
          vistos[id] = true;
          motivos.push(ROTULOS_SINAL[id] + ': ' + (sim(id) ? 'SIM' : 'NÃO'));
        });
      });
    }

    return { camada: camadaEscolhida, motivos: motivos, conflito: conflito, exclusoesSim: exclusoesSim };
  }

  function computeResultado(atual) {
    var respostas = atual.respostas || {};
    var essenciaisFalhos = CRITERIOS.filter(function (c) {
      return c.essencial && respostas[c.id] && respostas[c.id].valor === 'nao';
    }).map(function (c) { return c.id; });
    var criteriosAtendidos = CRITERIOS.filter(function (c) {
      return respostas[c.id] && respostas[c.id].valor === 'sim';
    }).length;

    var ident = identificarCamada(atual);

    return {
      essenciaisFalhos: essenciaisFalhos,
      criteriosAtendidos: criteriosAtendidos,
      exclusoesConflitantes: ident.exclusoesSim,
      resultadoAutomatico: resultadoDaCamada(ident.camada),
      camadaSugerida: {
        id: ident.camada,
        label: camadaPorId(ident.camada).label,
        motivos: ident.motivos,
        conflito: ident.conflito
      }
    };
  }

  /* Nunca um texto fixo: a frase muda com a camada encontrada e com os
     próprios motivos (pergunta + resposta real) que a sustentaram. */
  function gerarJustificativaAutomatica(atual, calc) {
    var camada = calc.camadaSugerida;
    if (camada.id === 'a-validar') {
      if (camada.conflito && camada.conflito.length > 1) {
        return 'As respostas indicam características de mais de uma categoria arquitetural (' + listaComE(camada.conflito) +
          ') e não há evidência suficiente para recomendar uma classificação única.';
      }
      return 'As respostas não reúnem evidência suficiente para indicar com segurança nenhuma das categorias arquiteturais previstas. ' +
        'Revise as respostas do questionário ou registre uma decisão manual com a justificativa correspondente.';
    }
    if (camada.id === 'produto-principal') {
      return 'O item foi classificado como Produto/Serviço principal porque as respostas confirmam ' + listaComE(camada.motivos) +
        ', sem nenhum sinal de que exerça predominantemente outro papel arquitetural.';
    }
    return 'O item foi classificado como ' + camada.label + ', e não como Produto/Serviço principal, porque as respostas indicam ' +
      listaComE(camada.motivos) + '.';
  }

  function todasRespondidas(atual) {
    return primeiraPerguntaFaltando(atual) === null;
  }
  /* Devolve o id da primeira pergunta sem resposta (para focar/destacar),
     ou null se todas as 14 já foram respondidas. */
  function primeiraPerguntaFaltando(atual) {
    var r = atual.respostas || {};
    var faltante = TODAS_PERGUNTAS.filter(function (p) {
      return !(r[p.id] && (r[p.id].valor === 'sim' || r[p.id].valor === 'nao'));
    });
    return faltante.length ? faltante[0].id : null;
  }
  function upsertItem(itens, item) {
    var copia = itens.filter(function (it) { return it._key !== item._key; });
    copia.unshift(item);
    copia.sort(function (x, y) { return (y.atualizadoEm || '').localeCompare(x.atualizadoEm || ''); });
    return copia;
  }
  function focarCampo(id) {
    setTimeout(function () {
      var el = document.getElementById(id);
      if (el && el.focus) { el.focus(); if (el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    }, 30);
  }

  window.faInitAvaliacaoProduto = function () {
    var wrap = document.getElementById('adminAvaliacaoProduto');
    if (!wrap || wrap._avpBound) return;
    wrap._avpBound = true;

    var state = {
      tela: 'lista', /* 'lista' | 'form-inicial' | 'checklist' | 'resultado' */
      itens: [],
      filtro: { resultado: 'todos', status: 'todos', alterado: 'todos', alternativa: 'todos' },
      lixeira: false,        /* alterna a lista entre ativos e excluídos — "excluído" é outra dimensão, não um status irmão de rascunho/concluído */
      atual: null,
      erroForm: null,
      camposInvalidos: [],
      pendenteId: null,
      salvando: null,       /* null | 'rascunho' | 'concluido' — trava os botões de salvar do checklist */
      salvandoDecisao: false,
      decisaoForm: null,
      flashLista: null,     /* confirmação persistente mostrada na lista após salvar rascunho */
      flashResultado: null, /* confirmação persistente mostrada no resultado após concluir */
      flashDecisao: null    /* confirmação persistente mostrada após salvar a decisão arquitetural */
    };

    function temCampoInvalido(campo) {
      return !!(state.camposInvalidos && state.camposInvalidos.indexOf(campo) !== -1);
    }

    function render() {
      if (state.tela === 'lista') renderLista();
      else if (state.tela === 'form-inicial') renderFormInicial();
      else if (state.tela === 'checklist') renderChecklist();
      else if (state.tela === 'resultado') renderResultado();
    }

    /* ===================== LISTA ===================== */
    function itemPassaFiltro(it) {
      if (state.lixeira) return !!it.excluido;
      if (it.excluido) return false;
      if (state.filtro.resultado !== 'todos') {
        var decisao = it.decisaoFinal || it.resultadoAutomatico;
        if (decisao !== state.filtro.resultado) return false;
      }
      if (state.filtro.status !== 'todos' && it.status !== state.filtro.status) return false;
      if (state.filtro.alterado === 'sim' && !it.decisaoManual) return false;
      if (state.filtro.alternativa !== 'todos') {
        var camadaLabel = it.camadaSugerida && it.camadaSugerida.label;
        if (camadaLabel !== state.filtro.alternativa) return false;
      }
      return true;
    }

    function renderLista() {
      var filtrados = state.itens.filter(itemPassaFiltro);
      var html = '';
      if (state.flashLista) {
        html += '<div class="avp-flash-success" id="avpFlashLista">' + esc(state.flashLista) +
          ' <button type="button" class="avp-flash-close" id="avpFlashListaClose" aria-label="Fechar">×</button></div>';
      }
      html += '<div class="avp-intro">';
      html += '<p><strong>Conceito-base:</strong> Produto ou Serviço é uma solução que gera valor perceptível para o cliente ao atender a uma necessidade identificável. ' +
        'Uma solução deve possuir uma fronteira coerente: seus elementos pertencem ao mesmo propósito e contribuem para um resultado de cliente identificável.</p>';
      html += '<p class="avp-intro-principio">Nem tudo que gera valor precisa ser um Produto/Serviço. Um componente, processo, capacidade, canal ou documento pode ser essencial ' +
        'para a entrega sem constituir uma solução independente para o cliente.</p>';
      html += '</div>';

      var ativos = state.itens.filter(function (it) { return !it.excluido; });
      var excluidos = state.itens.filter(function (it) { return !!it.excluido; });

      html += '<div class="avp-actions-bar">';
      html += '<span class="avp-total">' + ativos.length + ' avaliaç' + (ativos.length === 1 ? 'ão' : 'ões') + ' registrada' + (ativos.length === 1 ? '' : 's') + '</span>';
      if (!state.lixeira) html += '<button class="btn btn--primary" id="avpNovoBtn">+ Avaliar novo item</button>';
      html += '<button class="btn btn--sm avp-lixeira-btn' + (state.lixeira ? ' active' : '') + '" id="avpLixeiraBtn">' +
        (state.lixeira ? '‹ Voltar' : '🗑 Lixeira (' + excluidos.length + ')') + '</button>';
      html += '</div>';

      if (state.lixeira) {
        html += '<p class="avp-lixeira-aviso">🗑 Mostrando avaliações excluídas. Elas não são apagadas do banco — use "↺ Restaurar" para trazer de volta.</p>';
      } else {
        html += '<div class="avp-filters">';
        html += filtroSelect('avpFiltroResultado', state.filtro.resultado, [
          ['todos', 'Todos os resultados'], ['produto', 'É Produto/Serviço'], ['nao-produto', 'Não é Produto/Serviço'], ['a-validar', 'A validar']
        ]);
        html += filtroSelect('avpFiltroStatus', state.filtro.status, [
          ['todos', 'Todos os status'], ['rascunho', 'Rascunho'], ['concluido', 'Concluído']
        ]);
        html += filtroSelect('avpFiltroAlterado', state.filtro.alterado, [
          ['todos', 'Decisão automática ou manual'], ['sim', 'Alterado manualmente']
        ]);
        html += filtroSelect('avpFiltroAlternativa', state.filtro.alternativa, [['todos', 'Todas as classificações arquiteturais']].concat(
          CAMADAS.map(function (c) { return [c.label, c.label]; })
        ));
        html += '</div>';
      }

      if (!filtrados.length) {
        html += '<p class="admin-empty">' + (state.lixeira ? 'Nenhuma avaliação excluída.' : 'Nenhuma avaliação nessa combinação de filtros.') + '</p>';
      } else if (state.lixeira) {
        html += '<div class="table-scroll-wrap"><table class="admin-table avp-table"><thead><tr>' +
          '<th>Item</th><th>Excluído por</th><th>Quando</th><th>Justificativa</th><th>Ações</th></tr></thead><tbody>';
        filtrados.forEach(function (it) {
          html += '<tr>';
          html += '<td data-label="Item">' + esc(it.nome) + '</td>';
          html += '<td data-label="Excluído por">' + esc(it.excluidoPor && it.excluidoPor.name || '—') + '</td>';
          html += '<td data-label="Quando">' + fmtData(it.excluidoEm) + '</td>';
          html += '<td data-label="Justificativa">' + esc(it.justificativaExclusao || '—') + '</td>';
          html += '<td data-label="Ações"><button class="btn btn--sm avp-act-restaurar" data-key="' + it._key + '">↺ Restaurar</button></td>';
          html += '</tr>';
        });
        html += '</tbody></table></div>';
      } else {
        html += '<div class="table-scroll-wrap"><table class="admin-table avp-table"><thead><tr>' +
          '<th>Item</th><th>Resultado automático</th><th>Decisão final</th><th>Classificação arquitetural</th>' +
          '<th>Responsável</th><th>Data</th><th>Status</th><th>Ações</th></tr></thead><tbody>';
        filtrados.forEach(function (it) {
          var decisao = it.decisaoFinal || it.resultadoAutomatico;
          var camadaLabel = (it.camadaSugerida && it.camadaSugerida.label) || '—';
          html += '<tr>';
          html += '<td data-label="Item">' + esc(it.nome) + '</td>';
          html += '<td data-label="Resultado automático">' + resultadoBadge(it.resultadoAutomatico) + '</td>';
          html += '<td data-label="Decisão final">' + resultadoBadge(decisao) + (it.decisaoManual ? ' <span class="avp-tag-alterado">alterada</span>' : '') + '</td>';
          html += '<td data-label="Classificação arquitetural">' + esc(camadaLabel) + '</td>';
          html += '<td data-label="Responsável">' + esc(it.responsavel && it.responsavel.name || '—') + '</td>';
          html += '<td data-label="Data">' + fmtData(it.atualizadoEm) + '</td>';
          html += '<td data-label="Status">' + statusBadge(it.status) + '</td>';
          html += '<td data-label="Ações"><div class="avp-row-actions">';
          if (it.status === 'concluido') {
            html += '<button class="btn btn--sm btn--primary avp-act-ver" data-key="' + it._key + '">Visualizar</button>';
          } else {
            html += '<button class="btn btn--sm btn--primary avp-act-editar" data-key="' + it._key + '">Continuar</button>';
          }
          html += '<button class="btn btn--sm avp-act-mais" data-key="' + it._key + '" aria-label="Mais ações">⋯</button>';
          html += '</div></td>';
          html += '</tr>';
        });
        html += '</tbody></table></div>';
      }

      wrap.innerHTML = html;

      var flashListaClose = document.getElementById('avpFlashListaClose');
      if (flashListaClose) flashListaClose.addEventListener('click', function () { state.flashLista = null; render(); });

      document.getElementById('avpLixeiraBtn').addEventListener('click', function () {
        state.lixeira = !state.lixeira;
        state.flashLista = null;
        render();
      });

      var novoBtn = document.getElementById('avpNovoBtn');
      if (novoBtn) novoBtn.addEventListener('click', function () {
        state.atual = { nome: '', descricao: '', publico: '', necessidade: '', observacoesGerais: '', respostas: {} };
        state.erroForm = null;
        state.camposInvalidos = [];
        state.flashLista = null;
        state.tela = 'form-inicial';
        render();
      });
      ['Resultado', 'Status', 'Alterado', 'Alternativa'].forEach(function (campo) {
        var sel = document.getElementById('avpFiltro' + campo);
        if (sel) sel.addEventListener('change', function () {
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
      wrap.querySelectorAll('.avp-act-mais').forEach(function (btn) {
        btn.addEventListener('click', function () { abrirMenuAcoes(btn.dataset.key); });
      });
      wrap.querySelectorAll('.avp-act-restaurar').forEach(function (btn) {
        btn.addEventListener('click', function () { restaurarItem(btn.dataset.key); });
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
      if (v === 'a-validar') return '<span class="avp-badge avp-badge--a-validar">A validar</span>';
      return '<span class="avp-badge">—</span>';
    }
    function rotuloResultado(v) {
      if (v === 'produto') return 'É Produto/Serviço';
      if (v === 'a-validar') return 'A validar';
      return 'Não é Produto/Serviço';
    }
    function statusBadge(v) {
      return v === 'concluido'
        ? '<span class="avp-badge avp-badge--concluido">Concluído</span>'
        : '<span class="avp-badge avp-badge--rascunho">Rascunho</span>';
    }

    function buscarItem(key) { return state.itens.filter(function (it) { return it._key === key; })[0]; }
    function clonarItem(it) { return JSON.parse(JSON.stringify(it)); }

    /* jaSalvouAntes distingue "nunca mexi nisso" de "já tem uma decisão
       manual salva antes" — só nesse segundo caso um novo ajuste deve dizer
       SALVAR ALTERAÇÃO em vez de SALVAR DECISÃO. ultimoSalvo é a fotografia
       do que está realmente gravado; comparar contra ela (não contra um
       booleano solto) é o que permite o botão voltar sozinho pro estado
       "✓ DECISÃO SALVA" se a pessoa desfizer a mudança na mão. */
    function decisaoFormInicial(it) {
      var salvo = { opcao: it.decisaoManual ? it.decisaoFinal : 'auto', justificativa: it.justificativaDecisao || '' };
      return { opcao: salvo.opcao, justificativa: salvo.justificativa, erro: null, jaSalvouAntes: !!it.decisaoManual, ultimoSalvo: salvo };
    }
    function decisaoIguais(x, y) {
      if (x.opcao !== y.opcao) return false;
      if (x.opcao === 'auto') return true;
      return (x.justificativa || '').trim() === (y.justificativa || '').trim();
    }

    function abrirVisualizacao(key) {
      var it = buscarItem(key);
      if (!it) return;
      state.atual = clonarItem(it);
      state.decisaoForm = decisaoFormInicial(it);
      state.flashLista = null;
      state.flashResultado = null;
      state.flashDecisao = null;
      state.tela = 'resultado';
      render();
    }
    function abrirEdicao(key) {
      var it = buscarItem(key);
      if (!it) return;
      state.atual = clonarItem(it);
      if (!state.atual.respostas) state.atual.respostas = {};
      state.erroForm = null;
      state.camposInvalidos = [];
      state.pendenteId = null;
      state.flashLista = null;
      state.tela = 'checklist';
      render();
    }
    function abrirReavaliacao(key) {
      var it = buscarItem(key);
      if (!it) return;
      state.atual = clonarItem(it);
      state.atual.respostas = {};
      state.erroForm = null;
      state.camposInvalidos = [];
      state.pendenteId = null;
      state.flashLista = null;
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
      state.camposInvalidos = [];
      state.pendenteId = null;
      state.flashLista = null;
      state.tela = 'checklist';
      render();
    }

    /* ---- menu "⋯" (ações secundárias) e exclusão lógica ----
       Mesmo padrão da aba Cadastrados do admin: uma ação principal visível
       por linha e um menu à parte para o resto, em vez de empilhar botões —
       aqui como modal, não dropdown, pelo mesmo motivo de lá (nada de
       posicionamento/clique-fora para acertar). */
    function abrirMenuAcoes(key) {
      var it = buscarItem(key);
      if (!it) return;
      var overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9999';
      var box = document.createElement('div');
      box.className = 'modal-box avp-menu-acoes-box';
      box.style.cssText = 'max-width:360px;width:90%;padding:24px;display:flex;flex-direction:column;gap:14px';
      var html = '<p class="avp-menu-acoes-titulo">' + esc(it.nome) + '</p>';
      html += '<div class="avp-menu-acoes-lista">';
      if (it.status === 'concluido') {
        html += '<button class="btn avp-menu-item" data-acao="reavaliar">Reavaliar</button>';
      } else {
        html += '<button class="btn avp-menu-item" data-acao="editar">Editar</button>';
      }
      html += '<button class="btn avp-menu-item" data-acao="duplicar">Duplicar</button>';
      html += '<button class="btn avp-menu-item avp-menu-item--perigo" data-acao="excluir">🗑 Excluir</button>';
      html += '</div>';
      html += '<button class="btn" id="avpMenuAcoesFechar">Cancelar</button>';
      box.innerHTML = html;
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      function fechar() { if (overlay.parentNode) document.body.removeChild(overlay); }
      box.querySelector('#avpMenuAcoesFechar').addEventListener('click', fechar);
      overlay.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); fechar(); } });
      box.querySelectorAll('.avp-menu-item').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var acao = btn.dataset.acao;
          fechar();
          if (acao === 'editar') abrirEdicao(key);
          else if (acao === 'reavaliar') abrirReavaliacao(key);
          else if (acao === 'duplicar') duplicar(key);
          else if (acao === 'excluir') abrirModalExcluir(key);
        });
      });
    }

    function abrirModalExcluir(key) {
      var it = buscarItem(key);
      if (!it) return;
      var overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9999';
      var box = document.createElement('div');
      box.className = 'modal-box avp-excluir-box';
      box.style.cssText = 'max-width:440px;width:90%;padding:28px;display:flex;flex-direction:column;gap:14px';
      box.innerHTML =
        '<p class="avp-excluir-alerta">⚠ Excluir avaliação</p>' +
        '<p class="avp-excluir-texto">Tem certeza que deseja excluir <strong>"' + esc(it.nome) + '"</strong>? ' +
          'Ela sai da lista, mas não é apagada do banco — dá para recuperar pela Lixeira.</p>' +
        '<div class="avp-field">' +
          '<label for="avpExcluirJustificativa">Justificativa da exclusão *</label>' +
          '<textarea id="avpExcluirJustificativa" rows="3" placeholder="Explique por que esta avaliação está sendo excluída…"></textarea>' +
        '</div>' +
        '<p class="avp-error-msg" id="avpExcluirErro" hidden></p>' +
        '<div style="display:flex;justify-content:flex-end;gap:8px">' +
          '<button class="btn" id="avpExcluirCancelar">Cancelar</button>' +
          '<button class="btn btn--danger" id="avpExcluirConfirmar" disabled>Confirmar exclusão</button>' +
        '</div>';
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      var salvando = false;
      function fechar() { if (salvando) return; if (overlay.parentNode) document.body.removeChild(overlay); }
      overlay.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); fechar(); } });
      box.querySelector('#avpExcluirCancelar').addEventListener('click', fechar);

      var textarea = box.querySelector('#avpExcluirJustificativa');
      var btnConfirmar = box.querySelector('#avpExcluirConfirmar');
      var erroEl = box.querySelector('#avpExcluirErro');
      textarea.addEventListener('input', function () {
        btnConfirmar.disabled = !textarea.value.trim();
      });
      textarea.focus();

      btnConfirmar.addEventListener('click', function () {
        var justificativa = textarea.value.trim();
        if (!justificativa || salvando) return;
        salvando = true;
        erroEl.hidden = true;
        btnConfirmar.disabled = true;
        btnConfirmar.textContent = 'EXCLUINDO…';
        box.querySelector('#avpExcluirCancelar').disabled = true;

        var updates = {
          excluido: true,
          excluidoEm: new Date().toISOString(),
          excluidoPor: sessaoAtual(),
          justificativaExclusao: justificativa,
          atualizadoEm: new Date().toISOString()
        };
        var respondido = false;
        var relogio = setTimeout(function () {
          if (respondido) return;
          respondido = true;
          salvando = false;
          btnConfirmar.disabled = false;
          btnConfirmar.textContent = 'Confirmar exclusão';
          box.querySelector('#avpExcluirCancelar').disabled = false;
          erroEl.hidden = false;
          erroEl.textContent = 'A conexão está demorando e não deu para confirmar a exclusão. Toque em "Confirmar exclusão" de novo.';
        }, 12000);

        db().ref(NODE + '/' + key).update(updates, function (err) {
          if (respondido) return;
          respondido = true;
          clearTimeout(relogio);
          if (err) {
            console.error('[avaliacao-produto] erro ao excluir avaliação:', err);
            salvando = false;
            btnConfirmar.disabled = false;
            btnConfirmar.textContent = 'Confirmar exclusão';
            box.querySelector('#avpExcluirCancelar').disabled = false;
            erroEl.hidden = false;
            erroEl.textContent = 'Não foi possível excluir a avaliação. Tente novamente.';
            return;
          }
          var atualizado = Object.assign(clonarItem(it), updates);
          state.itens = upsertItem(state.itens, atualizado);
          salvando = false; /* libera fechar() — senão a guarda que impede fechar DURANTE o salvamento também bloqueia o fechamento de sucesso */
          fechar();
          state.flashLista = '✓ Avaliação excluída. Ela continua disponível na Lixeira.';
          render();
        });
      });
    }

    function restaurarItem(key) {
      var it = buscarItem(key);
      if (!it) return;
      var updates = { excluido: false, excluidoEm: null, excluidoPor: null, justificativaExclusao: null, atualizadoEm: new Date().toISOString() };
      db().ref(NODE + '/' + key).update(updates, function (err) {
        if (err) {
          console.error('[avaliacao-produto] erro ao restaurar avaliação:', err);
          avpAlert('Não foi possível restaurar a avaliação. Tente novamente.');
          return;
        }
        state.itens = upsertItem(state.itens, Object.assign(clonarItem(it), updates));
        state.flashLista = '✓ Avaliação restaurada.';
        render();
      });
    }

    /* ===================== FORM INICIAL ===================== */
    function renderFormInicial() {
      var a = state.atual;
      var html = '<div class="avp-form-card">';
      html += '<h3>Avaliar novo item</h3>';
      if (state.erroForm) html += '<p class="avp-error-msg">' + esc(state.erroForm) + '</p>';
      html += campoTexto('avpfNome', 'Nome do item', a.nome, true, false, temCampoInvalido('nome'));
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
          state.camposInvalidos = ['nome'];
          render();
          focarCampo('avpfNome');
          return;
        }
        state.erroForm = null;
        state.camposInvalidos = [];
        state.tela = 'checklist';
        render();
      });
      document.getElementById('avpCancelarInicialBtn').addEventListener('click', function () {
        state.atual = null;
        state.tela = 'lista';
        render();
      });
    }

    function campoTexto(id, label, valor, obrigatorio, textarea, invalido) {
      var html = '<div class="avp-field' + (invalido ? ' avp-field--invalid' : '') + '">';
      html += '<label for="' + id + '">' + esc(label) + (obrigatorio ? ' *' : '') + '</label>';
      if (textarea) html += '<textarea id="' + id + '" rows="3">' + esc(valor) + '</textarea>';
      else html += '<input type="text" id="' + id + '" value="' + esc(valor) + '">';
      if (invalido) html += '<p class="avp-field-invalid-msg">Campo obrigatório.</p>';
      html += '</div>';
      return html;
    }
    function bindCampoTexto(id, campo) {
      var el = document.getElementById(id);
      el.addEventListener('input', function () {
        state.atual[campo] = el.value;
        if (state.camposInvalidos && state.camposInvalidos.length) {
          state.camposInvalidos = state.camposInvalidos.filter(function (c) { return c !== campo; });
        }
      });
    }

    /* ===================== CHECKLIST ===================== */
    function renderChecklist() {
      var a = state.atual;
      var html = '<div class="avp-checklist">';
      html += '<button class="avp-voltar-link" id="avpVoltarLista">‹ Avaliações de Produto/Serviço</button>';
      html += '<div class="avp-form-card">';
      html += '<h3>' + (a._key ? 'Editando avaliação' : 'Nova avaliação') + '</h3>';
      html += campoTexto('avpcNome', 'Nome do item', a.nome, true, false, temCampoInvalido('nome'));
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
      html += '<button class="btn" id="avpSalvarRascunhoBtn"' + (state.salvando ? ' disabled' : '') + '>' +
        (state.salvando === 'rascunho' ? 'SALVANDO…' : 'SALVAR RASCUNHO') + '</button>';
      html += '<button class="btn btn--primary" id="avpConcluirBtn"' + (state.salvando ? ' disabled' : '') + '>' +
        (state.salvando === 'concluido' ? 'SALVANDO…' : 'CONCLUIR AVALIAÇÃO') + '</button>';
      html += '<button class="btn" id="avpCancelarChecklistBtn"' + (state.salvando ? ' disabled' : '') + '>CANCELAR</button>';
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
          if (state.pendenteId === id) state.pendenteId = null;
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
        if (state.salvando) return; /* clique repetido enquanto já está salvando: ignora */
        if (!a.nome || !a.nome.trim()) {
          state.erroForm = 'Informe o nome do item.';
          state.camposInvalidos = ['nome'];
          render();
          focarCampo('avpcNome');
          return;
        }
        state.erroForm = null;
        state.camposInvalidos = [];
        state.salvando = 'rascunho';
        render();
        salvarRegistro('rascunho', function (payload, key) {
          state.salvando = null;
          state.itens = upsertItem(state.itens, Object.assign({ _key: key }, payload));
          state.atual = null;
          state.flashLista = '✓ Rascunho salvo com sucesso.';
          state.tela = 'lista';
          render();
        }, function (tipo) {
          state.salvando = null;
          if (tipo === 'timeout') {
            state.erroForm = 'A conexão está demorando e não deu para confirmar o salvamento. Toque em "SALVAR RASCUNHO" de novo.';
            render();
          } else {
            render();
            avpAlert('Não foi possível salvar a avaliação. Tente novamente.');
          }
        });
      });
      document.getElementById('avpConcluirBtn').addEventListener('click', function () {
        if (state.salvando) return; /* clique repetido enquanto já está salvando: ignora */
        if (!a.nome || !a.nome.trim()) {
          state.erroForm = 'Informe o nome do item.';
          state.camposInvalidos = ['nome'];
          render();
          focarCampo('avpcNome');
          return;
        }
        var faltando = primeiraPerguntaFaltando(a);
        if (faltando) {
          state.erroForm = 'Responda SIM ou NÃO em todas as perguntas antes de concluir a avaliação.';
          state.pendenteId = faltando;
          render();
          focarCampo('avpQuestion-' + faltando);
          return;
        }
        state.erroForm = null;
        state.camposInvalidos = [];
        state.pendenteId = null;
        state.salvando = 'concluido';
        render();
        salvarRegistro('concluido', function (payload, key) {
          state.salvando = null;
          state.itens = upsertItem(state.itens, Object.assign({ _key: key }, payload));
          state.decisaoForm = decisaoFormInicial(payload);
          state.flashResultado = '✓ Avaliação salva com sucesso.';
          state.tela = 'resultado';
          render();
        }, function (tipo) {
          state.salvando = null;
          if (tipo === 'timeout') {
            state.erroForm = 'A conexão está demorando e não deu para confirmar o salvamento. Toque em "CONCLUIR AVALIAÇÃO" de novo.';
            render();
          } else {
            render();
            avpAlert('Não foi possível salvar a avaliação. Tente novamente.');
          }
        });
      });
      document.getElementById('avpCancelarChecklistBtn').addEventListener('click', function () { cancelarChecklist(); });
    }

    function cancelarChecklist() {
      if (state.salvando) return; /* não deixa sair no meio de um salvamento em andamento */
      avpConfirm('Descartar esta avaliação sem salvar?', function () {
        state.atual = null;
        state.tela = 'lista';
        render();
      });
    }

    function renderPergunta(def, resposta) {
      var essencialClass = def.essencial ? ' avp-question--essencial' : '';
      var pendenteClass = state.pendenteId === def.id ? ' avp-question--pendente' : '';
      var html = '<div class="avp-question' + essencialClass + pendenteClass + '" id="avpQuestion-' + def.id + '">';
      if (pendenteClass) html += '<p class="avp-field-invalid-msg">Responda esta pergunta antes de concluir.</p>';
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
    /* onErro(tipo, err) — tipo é 'timeout' (nunca respondeu) ou 'erro' (o
       Firebase recusou/falhou). Nos dois casos os dados digitados por quem
       avalia permanecem intocados em state.atual: só quem chama decide o
       que fazer com o formulário. */
    function salvarRegistro(status, cb, onErro) {
      var a = state.atual;
      var agora = new Date().toISOString();
      /* Reserva a chave ANTES de escrever, e prende ela em a._key na hora —
         não só depois do sucesso. Assim, se a escrita nunca responder (rede
         travada) e a pessoa tocar em SALVAR de novo, o retry grava na MESMA
         chave em vez de criar um registro duplicado. */
      var key = a._key || db().ref(NODE).push().key;
      if (!a._key) a._key = key;
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
        camadaSugerida: null,
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
        payload.camadaSugerida = calc.camadaSugerida;
        payload.justificativaAutomatica = gerarJustificativaAutomatica(a, calc);
        payload.decisaoFinal = calc.resultadoAutomatico;
      }
      var ref = db().ref(NODE + '/' + key);
      var respondido = false;
      /* Rede lenta é condição normal de celular (ver CLAUDE.md) — sem este
         relógio, "Salvando…" ficava preso para sempre e o clique parecia
         não ter feito nada, exatamente o defeito relatado. */
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
          console.error('[avaliacao-produto] erro ao salvar avaliação (' + status + '):', err);
          if (onErro) onErro('erro', err);
          return;
        }
        state.atual = Object.assign({ _key: key }, payload);
        if (cb) cb(payload, key);
      });
    }

    /* ===================== RESULTADO ===================== */
    function renderResultado() {
      var a = state.atual;
      var resultado = a.resultadoAutomatico;
      var cardClasse = resultado === 'produto' ? 'avp-result-card--produto' :
        (resultado === 'a-validar' ? 'avp-result-card--a-validar' : 'avp-result-card--nao-produto');
      var badgeTexto = resultado === 'produto' ? 'É PRODUTO/SERVIÇO' :
        (resultado === 'a-validar' ? 'A VALIDAR' : 'NÃO É PRODUTO/SERVIÇO');
      var html = '<div class="avp-resultado">';
      html += '<button class="avp-voltar-link" id="avpVoltarListaResultado">‹ Avaliações de Produto/Serviço</button>';

      if (state.flashResultado) {
        html += '<div class="avp-flash-success" id="avpFlashResultado">' + esc(state.flashResultado) +
          ' <button type="button" class="avp-flash-close" id="avpFlashResultadoClose" aria-label="Fechar">×</button></div>';
      }

      html += '<div class="avp-result-card ' + cardClasse + '">';
      html += '<span class="avp-result-label">RESULTADO DA AVALIAÇÃO</span>';
      html += '<h3 class="avp-result-nome">' + esc(a.nome) + '</h3>';
      html += '<div class="avp-result-badge-grande">' + badgeTexto + '</div>';
      html += '<p class="avp-result-secundario">Critérios atendidos: ' + a.criteriosAtendidos + ' de ' + CRITERIOS.length + '</p>';
      html += '</div>';

      html += '<div class="avp-form-card">';
      html += '<h4>Justificativa da classificação</h4>';
      html += '<p>' + esc(a.justificativaAutomatica) + '</p>';
      html += '</div>';

      /* Classificação arquitetural sugerida — sempre mostrada, não só quando
         o resultado é "não é produto" (a camada é útil mesmo quando o item
         É o Produto/Serviço principal, e obrigatória quando a evidência é
         insuficiente/contraditória). */
      var camada = a.camadaSugerida || camadaPorId('a-validar');
      html += '<div class="avp-form-card avp-alt-card">';
      html += '<h4>Classificação arquitetural sugerida</h4>';
      html += '<p class="avp-alt-label">Camada identificada: <strong>' + esc(camada.label) + '</strong></p>';
      if (camada.conflito && camada.conflito.length) {
        html += '<p class="avp-alt-outras">Categorias em conflito nas respostas: ' + esc(camada.conflito.join(', ')) + '.</p>';
      }
      html += '</div>';

      if (camada.motivos && camada.motivos.length) {
        html += '<div class="avp-form-card">';
        html += '<h4>Por que o sistema chegou a essa conclusão</h4>';
        html += '<ul class="avp-motivos-list">';
        camada.motivos.forEach(function (m) { html += '<li>' + esc(m) + '</li>'; });
        html += '</ul>';
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

      var flashResultadoClose = document.getElementById('avpFlashResultadoClose');
      if (flashResultadoClose) flashResultadoClose.addEventListener('click', function () { state.flashResultado = null; render(); });

      document.getElementById('avpVoltarListaResultado').addEventListener('click', function () {
        state.atual = null;
        state.flashResultado = null;
        state.flashDecisao = null;
        state.tela = 'lista';
        render();
      });
      bindDecisaoCard();
    }

    /* Mostra a resposta e as DUAS justificativas lado a lado, nunca uma no
       lugar da outra: a do avaliador (texto livre, digitado por quem
       preencheu) e a interpretação automática (fixa, gerada pelo sistema).
       Vale igualmente para os 7 critérios e para os 7 testes de exclusão —
       renderRaciocinio é a mesma função para as duas seções. */
    function renderRaciocinio(def, resposta) {
      if (!resposta) return '';
      var valor = resposta.valor === 'sim' ? 'SIM' : 'NÃO';
      var justificativaUsuario = (resposta.observacao || '').trim();
      return '<div class="avp-reasoning-item">' +
        '<p class="avp-reasoning-q">' + esc(def.titulo || def.pergunta) + ' — ' + valor + '</p>' +
        '<p class="avp-reasoning-user"><strong>Sua justificativa:</strong> ' +
          (justificativaUsuario ? esc(justificativaUsuario) : '<em>Nenhuma observação registrada pelo avaliador.</em>') + '</p>' +
        '<p class="avp-reasoning-auto"><strong>Interpretação do sistema:</strong> ' + esc(semPrefixo(resposta.justificativaAuto)) + '</p>' +
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
      html += decisaoOpcao('auto', 'Aceitar recomendação do sistema (' + rotuloResultado(a.resultadoAutomatico) + ')', f.opcao);
      html += decisaoOpcao('produto', 'Classificar manualmente como Produto/Serviço', f.opcao);
      html += decisaoOpcao('nao-produto', 'Classificar manualmente como não Produto/Serviço', f.opcao);
      html += '</div>';
      if (f.opcao !== 'auto') {
        html += '<div class="avp-field' + (f.erro && !justificativaPreenchida(f) ? ' avp-field--invalid' : '') + '">';
        html += '<label for="avpJustificativaDecisao">Justificativa da decisão arquitetural *</label>';
        html += '<textarea id="avpJustificativaDecisao" rows="3">' + esc(f.justificativa) + '</textarea>';
        html += '</div>';
      }
      if (f.erro) html += '<p class="avp-error-msg">' + esc(f.erro) + '</p>';
      if (state.flashDecisao) {
        html += '<p class="avp-flash-success avp-flash-success--inline" id="avpFlashDecisao">' + esc(state.flashDecisao) +
          ' <button type="button" class="avp-flash-close" id="avpFlashDecisaoClose" aria-label="Fechar">×</button></p>';
      }
      var estado = estadoBotaoDecisao(f);
      html += '<button class="btn btn--primary avp-btn-decisao' + (estado.salva ? ' avp-btn-decisao--salva' : '') + '" id="avpSalvarDecisaoBtn"' +
        (estado.desabilitado ? ' disabled' : '') + '>' + esc(estado.label) + '</button>';
      html += '</div>';
      return html;
    }
    /* Os três estados que a seção pede: nunca salvo (ativo, "SALVAR
       DECISÃO"), salvo e sem mudança (desabilitado, "✓ DECISÃO SALVA") e
       alterado depois de já ter salvo (ativo de novo, "SALVAR ALTERAÇÃO").
       jaSalvouAntes é o que decide entre o primeiro rótulo e o terceiro —
       sem ele, desfazer e refazer a mesma escolha não teria como saber se
       aquilo já foi salvo uma vez ou nunca. */
    function estadoBotaoDecisao(f) {
      if (state.salvandoDecisao) return { label: 'SALVANDO…', desabilitado: true, salva: false };
      var dirty = !decisaoIguais({ opcao: f.opcao, justificativa: f.justificativa }, f.ultimoSalvo);
      if (!f.jaSalvouAntes) return { label: 'SALVAR DECISÃO', desabilitado: false, salva: false };
      if (dirty) return { label: 'SALVAR ALTERAÇÃO', desabilitado: false, salva: false };
      return { label: '✓ DECISÃO SALVA', desabilitado: true, salva: true };
    }
    function justificativaPreenchida(f) { return !!(f.justificativa || '').trim(); }
    function decisaoOpcao(valor, label, atual) {
      return '<label class="avp-decisao-option"><input type="radio" name="avpDecisao" value="' + valor + '"' +
        (valor === atual ? ' checked' : '') + '> ' + esc(label) + '</label>';
    }
    function bindDecisaoCard() {
      wrap.querySelectorAll('input[name="avpDecisao"]').forEach(function (radio) {
        radio.addEventListener('change', function () {
          if (state.salvandoDecisao) return;
          state.decisaoForm.opcao = radio.value;
          state.decisaoForm.erro = null;
          state.flashDecisao = null;
          render();
        });
      });
      var ta = document.getElementById('avpJustificativaDecisao');
      if (ta) ta.addEventListener('input', function () { state.decisaoForm.justificativa = ta.value; });
      var btn = document.getElementById('avpSalvarDecisaoBtn');
      if (btn) btn.addEventListener('click', salvarDecisao);
      var flashDecisaoClose = document.getElementById('avpFlashDecisaoClose');
      if (flashDecisaoClose) flashDecisaoClose.addEventListener('click', function () { state.flashDecisao = null; render(); });
    }
    function salvarDecisao() {
      if (state.salvandoDecisao) return; /* clique repetido enquanto já está salvando: ignora */
      var a = state.atual;
      var f = state.decisaoForm;
      if (estadoBotaoDecisao(f).salva) return; /* nada mudou desde o último salvamento: não há o que salvar */
      var justificativa = (f.justificativa || '').trim();
      if (f.opcao !== 'auto' && !justificativa) {
        f.erro = 'Justificativa obrigatória para decisão manual.';
        render();
        focarCampo('avpJustificativaDecisao');
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
      f.erro = null;
      state.salvandoDecisao = true;
      render();

      var respondido = false;
      var relogio = setTimeout(function () {
        if (respondido) return;
        respondido = true;
        state.salvandoDecisao = false;
        f.erro = 'A conexão está demorando e não deu para confirmar o salvamento. Toque em "Salvar decisão" de novo.';
        render();
      }, 12000);

      db().ref(NODE + '/' + a._key).update(updates, function (err) {
        if (respondido) return;
        respondido = true;
        clearTimeout(relogio);
        state.salvandoDecisao = false;
        if (err) {
          console.error('[avaliacao-produto] erro ao salvar decisão arquitetural:', err);
          render();
          avpAlert('Não foi possível salvar a decisão. Tente novamente.');
          return;
        }
        Object.assign(a, updates);
        state.itens = upsertItem(state.itens, clonarItem(a));
        f.ultimoSalvo = { opcao: f.opcao, justificativa: f.justificativa };
        f.jaSalvouAntes = true;
        state.flashDecisao = '✓ Decisão salva com sucesso.';
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
