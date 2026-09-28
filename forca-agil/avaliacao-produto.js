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
     responsavel: {name,email}, criadoEm, atualizadoEm,
     itemId: chave da 1ª versão (agrupa todas as versões do mesmo item),
     versao: número (1 na avaliação original, incrementa a cada reavaliação),
     versaoAnteriorKey: chave da versão da qual esta foi reavaliada, ou null,
     motorVersion: versão do motor (MOTOR_VERSION) vigente quando a
       recomendação automática atual foi calculada — ausente em avaliações
       concluídas antes deste campo existir (tratado como "motor antigo"),
     historicoMotor: [{ motorVersion, resultadoAutomatico, camadaSugerida,
       justificativaAutomatica, processadoEm }...] | ausente — cada
       recomendação automática SUBSTITUÍDA por "REPROCESSAR COM MOTOR ATUAL"
       (nunca pelas respostas em si, que não mudam), mais antiga primeiro
   }

   resultadoAutomatico nunca é reescrito pela decisão manual — é o
   histórico que a seção 10 do pedido exige que nunca desapareça. Pela mesma
   razão, reprocessar com uma versão mais nova do motor NUNCA sobrescreve
   silenciosamente a recomendação automática anterior: ela migra para
   historicoMotor (ver reprocessarMotor) antes de ser substituída.

   Cada reavaliação (abrirReavaliacao) grava um registro NOVO — nunca
   sobrescreve o anterior — encadeado por versaoAnteriorKey; a lista mostra
   só a versão mais nova de cada item (temVersaoMaisNova) e "Ver histórico"
   percorre a cadeia inteira. Reavaliar começa com TODAS as respostas e
   justificativas da versão anterior já preenchidas — quem reavalia decide
   o que mantém, muda ou apaga; nada é limpo automaticamente (diferente de
   "Duplicar", que cria um item à parte com o checklist em branco).

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
      id: 'autonomia', essencial: true, ordem: 5, destaque: 'CRITÉRIO DECISIVO',
      titulo: 'Autonomia estrutural',
      pergunta: 'O item consegue existir e entregar seu resultado de forma independente, sem depender estruturalmente de outro Produto/Serviço?',
      ajuda: {
        significado: 'Resultado próprio, fronteira e mensuração não bastam: uma funcionalidade dentro de outro Produto/Serviço também pode ter tudo isso sem ser, ela mesma, uma solução independente. Este critério verifica a autonomia estrutural.',
        quandoSim: 'O item continuaria fazendo sentido como solução própria mesmo se o Produto/Serviço ao qual está relacionado deixasse de existir.',
        quandoNao: 'O item só existe, ou só faz sentido, porque outro Produto/Serviço existe — ele depende estruturalmente dessa outra solução.',
        exemplo: 'Um seguro de vida faz sentido como solução própria mesmo sem nenhum outro produto; "Alterar Perfil de Investimento" só existe porque o plano de previdência ao qual pertence existe.'
      },
      justSim: 'SIM — O item tem autonomia estrutural: existiria como solução própria mesmo sem outro Produto/Serviço.',
      justNao: 'NÃO — O item depende estruturalmente de outro Produto/Serviço para existir ou fazer sentido.'
    },
    {
      id: 'jornada', essencial: false, ordem: 6,
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
      id: 'medicao', essencial: false, ordem: 7,
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
      id: 'gestao', essencial: false, ordem: 8,
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
    },
    {
      id: 'funcionalidade', ordem: 8, classificacao: 'Funcionalidade/Operação',
      pergunta: 'O item é principalmente uma funcionalidade ou operação que permite consultar, escolher, solicitar, contratar, alterar, executar ou administrar algo dentro de outro Produto/Serviço?',
      exemplos: ['alterar uma configuração', 'solicitar uma opção', 'consultar saldo', 'alterar contribuição', 'executar uma operação dentro de uma solução maior'],
      justSim: 'SIM — O item apresenta características predominantes de funcionalidade/operação que atua dentro de outro Produto/Serviço.',
      justNao: 'NÃO — O item não se resume a uma funcionalidade ou operação executada dentro de outra solução.'
    }
  ];

  var TODAS_PERGUNTAS = CRITERIOS.concat(EXCLUSOES);

  /* Única fonte de numeração visível das perguntas (1 a 16): deriva da
     posição real em TODAS_PERGUNTAS, nunca de um número digitado à parte —
     evita duas numerações divergentes (uma no texto, outra na interface).
     Critérios principais ficam 1..CRITERIOS.length; Testes de classificação
     continuam a numeração a partir daí, nunca reiniciando em 1. */
  function numeroGlobal(def) { return TODAS_PERGUNTAS.indexOf(def) + 1; }

  /* Taxonomia arquitetural completa — o resultado de identificarCamada é
     sempre um destes 11 valores, a lista consolidada e aprovada do modelo
     (nunca introduzir categoria nova sem especificação explícita — "Ferramenta"
     foi removida daqui por não fazer parte dela: era uma inferência interna
     de uma reescrita anterior do motor, capacidade+componente juntos, nunca
     uma categoria vinda de fora; esse caso hoje cai em Componente). "produto"
     marca só a camada que conta como Produto/Serviço principal; todas as
     outras são camadas legítimas mas não-produto (ver RESULTADO_POR_CAMADA). */
  var CAMADAS = [
    { id: 'produto-principal', label: 'Produto/Serviço principal' },
    { id: 'unidade-valor-associada', label: 'Unidade de valor associada' },
    { id: 'modalidade-subproduto', label: 'Modalidade/Subproduto' },
    { id: 'funcionalidade-operacao', label: 'Funcionalidade/Operação' },
    { id: 'componente', label: 'Componente' },
    { id: 'regra-condicao', label: 'Regra/Opção' },
    { id: 'processo-etapa', label: 'Processo/Etapa de processo' },
    { id: 'capacidade-organizacional', label: 'Capacidade organizacional' },
    { id: 'canal', label: 'Canal' },
    { id: 'documento-informacao', label: 'Informação/Documento' },
    { id: 'a-validar', label: 'A validar' }
  ];
  function camadaPorId(id) { return CAMADAS.filter(function (c) { return c.id === id; })[0]; }

  /* Versão do motor de classificação (identificarCamada + motivoJustificativa/
     gerarJustificativaAutomatica). Incrementar SEMPRE que uma mudança nessas
     funções puder alterar o resultado, a camada, a especialização ou o texto
     da justificativa consolidada de respostas JÁ gravadas — nunca por uma
     mudança cosmética alheia ao motor (CSS, PDF, etc.). Cada avaliação
     concluída grava a versão vigente no momento em que a recomendação
     automática foi calculada (item.motorVersion); a tela de resultado compara
     com esta constante para saber se existe uma versão mais nova do motor e
     oferecer "REPROCESSAR COM MOTOR ATUAL" — nunca reprocessa sozinha, e
     nunca exige responder o questionário de novo (ver reprocessarMotor). */
  var MOTOR_VERSION = '2026.09.28-3';

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
    autonomia: 'Consegue existir e entregar resultado de forma independente de outro Produto/Serviço',
    jornada: 'Jornada própria com o cliente',
    medicao: 'Mensuração própria de resultado',
    gestao: 'Pode ser gerido de ponta a ponta como solução própria',
    canal: 'Funciona predominantemente como canal de acesso',
    artefato: 'Funciona predominantemente como documento/informação entregue',
    capacidade: 'Funciona predominantemente como capacidade organizacional',
    processo: 'Funciona predominantemente como processo/etapa de processo',
    modalidade: 'Funciona predominantemente como modalidade/opção/configuração',
    regra: 'Funciona predominantemente como regra/condição',
    componente: 'Existe para que outro Produto/Serviço entregue seu resultado',
    funcionalidade: 'Funciona predominantemente como funcionalidade/operação dentro de outro Produto/Serviço'
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

  /* Camadas que têm um eixo de especialização reconhecido pelo modelo — a
     especialização NUNCA é uma categoria concorrente, só detalha a
     classificação principal (ver especializacaoPara). As quatro únicas com
     esse eixo hoje: Componente (opção/configuração — a única com um sinal
     real no questionário, "modalidade"), Unidade de valor associada
     (institutos/benefícios), Funcionalidade/Operação (formas de vinculação)
     e Regra/Opção (políticas do plano). Sem pergunta nova para distinguir as
     três últimas (item explicitamente proibido: não alterar o
     questionário), elas sempre mostram "não determinada pelo questionário"
     — isso NUNCA vira A validar, é só uma informação a menos, não um
     conflito. */
  var CAMADAS_COM_ESPECIALIZACAO = ['componente', 'unidade-valor-associada', 'funcionalidade-operacao', 'regra-condicao'];
  var ESPECIALIZACAO_NAO_DETERMINADA = 'não determinada pelo questionário';

  /* ---- motor de decisão -------------------------------------------------
     identificarCamada NÃO conta quantos SIM existem — decide por PRECEDÊNCIA
     entre critérios estruturais (autonomia, resultado próprio, papel exercido
     dentro de outra solução) e só depois pela natureza indicada pelos testes
     de classificação, na ordem abaixo (a primeira condição satisfeita decide
     — nunca uma votação entre "candidatos" igualmente válidos, que era o que
     antes gerava A VALIDAR sempre que duas respostas relacionadas apareciam
     juntas, mesmo quando uma delas era só uma especialização da outra, nunca
     um conflito de verdade):

       0. Incoerência direta (funcionalidade E autonomia, ao mesmo tempo)
       1. Produto/Serviço principal   (núcleo essencial completo + autonomia)
       2. Funcionalidade/Operação     (é uma ação — sinal direto e decisivo)
       3. Canal / Informação-Documento (sinais diretos e explícitos — contam
          mesmo que o item também pareça ter algum resultado percebido, como
          "ver o saldo" é um resultado fraco demais para caracterizar
          Produto/Serviço; não dependem de !resultado)
       4. Unidade de valor associada  (resultado próprio, mas sem autonomia)
       5. Conflito real: Processo × Capacidade, sem nenhum outro sinal que
          desempate — aqui sim é ambiguidade de verdade, não hierarquia
       6. Capacidade organizacional
       7. Componente (também cobre "opção/configuração de personalização" —
          uma característica secundária do componente, nunca uma categoria
          concorrente: ver especializacaoPara)
       8. Modalidade/Subproduto       (só quando tem resultado próprio — uma
          variante reconhecível da oferta, não uma simples configuração)
       9. Regra/Opção
      10. Processo/Etapa de processo
      11. Evidência insuficiente → A validar (nunca força uma escolha)

     "autonomia" (o item existe e entrega resultado independentemente de
     outro Produto/Serviço?) e "funcionalidade" (o item é uma ação que atua
     dentro de outro Produto/Serviço?) continuam os dois sinais decisivos:
     resultado próprio, fronteira e mensuração sozinhos NUNCA bastam para
     Produto/Serviço principal. Nada aqui olha para nome/descrição do item —
     especializacaoPara também só usa uma resposta já existente (modalidade
     dentro de Componente), nunca inventa um valor. */
  function identificarCamada(atual) {
    var r = atual.respostas || {};
    function sim(id) { return !!(r[id] && r[id].valor === 'sim'); }

    var necessidade = sim('necessidade'), resultado = sim('resultado'), solucao = sim('solucao'),
      fronteira = sim('fronteira'), autonomia = sim('autonomia');
    var canal = sim('canal'), artefato = sim('artefato'), capacidade = sim('capacidade'), processo = sim('processo'),
      modalidade = sim('modalidade'), regra = sim('regra'), componente = sim('componente'), funcionalidade = sim('funcionalidade');

    var exclusoesSim = EXCLUSOES.filter(function (e) { return sim(e.id); }).map(function (e) { return e.id; });
    function motivo(id) { return ROTULOS_SINAL[id] + ': ' + (sim(id) ? 'SIM' : 'NÃO'); }
    /* Uma especialização real (hoje, só Componente+modalidade) vence; caso
       contrário, qualquer camada do eixo mostra "não determinada" em vez de
       simplesmente não ter o campo — nunca null para essas quatro. */
    function especializacaoPara(camadaId) {
      if (CAMADAS_COM_ESPECIALIZACAO.indexOf(camadaId) === -1) return null;
      if (camadaId === 'componente' && modalidade) return 'Opção/configuração de personalização';
      return ESPECIALIZACAO_NAO_DETERMINADA;
    }
    function resultadoFn(camada, sinais) {
      return {
        camada: camada, motivos: sinais.map(motivo), conflito: null, incoerencia: false,
        especializacao: especializacaoPara(camada), exclusoesSim: exclusoesSim
      };
    }

    /* 0. Contradição direta: "atua dentro de outro Produto/Serviço" e
       "existe de forma independente de outro Produto/Serviço" não podem ser
       SIM ao mesmo tempo sem incoerência. O sistema nunca resolve essa
       contradição escolhendo um lado silenciosamente. */
    if (funcionalidade && autonomia) {
      return {
        camada: 'a-validar', motivos: [motivo('funcionalidade'), motivo('autonomia')],
        conflito: null, incoerencia: true, especializacao: null, exclusoesSim: exclusoesSim
      };
    }

    var nucleoCompleto = necessidade && resultado && solucao && fronteira && autonomia;

    /* 1. Produto/Serviço principal: núcleo essencial completo, autonomia
       estrutural confirmada, e nenhum teste de exclusão se sustenta. Sem
       autonomia, mesmo com todos os outros critérios em SIM, o item não é
       recomendado como Produto/Serviço principal — é exatamente o caso de
       uma funcionalidade completa por fora, mas dependente por dentro. */
    if (nucleoCompleto && exclusoesSim.length === 0) {
      return resultadoFn('produto-principal', ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia']);
    }

    /* 2. Funcionalidade/Operação: sinal direto e explícito (a própria
       pergunta "é uma ação que atua dentro de outro Produto/Serviço?"),
       combinado com a ausência de autonomia — é uma ação sobre outra coisa,
       nunca a coisa em si. Tem precedência sobre "Unidade de valor
       associada" porque é mais específico (a pergunta captura a relação
       diretamente, sem depender do nome do item) — na prática as duas
       condições já são mutuamente exclusivas (uma exige funcionalidade=SIM,
       a outra funcionalidade=NÃO). */
    if (funcionalidade && !autonomia) {
      return resultadoFn('funcionalidade-operacao', ['funcionalidade', 'autonomia']);
    }

    /* 3. Canal / Informação-Documento: sinais diretos sobre a NATUREZA do
       item ("é principalmente um canal?", "é principalmente uma
       informação/documento?") — decisivos por si só, sem depender de
       "resultado" estar em NÃO. Um item como "Saldo de Conta" pode
       perfeitamente ter resultado=SIM (ver o saldo já é, num sentido frouxo,
       um resultado percebido) e ainda assim não ser Produto/Serviço nem
       Unidade de valor — é a NATUREZA informacional que decide, e essa
       pergunta já captura isso diretamente, sem olhar pro nome do item.
       Ficam antes de "Unidade de valor associada" por serem mais
       específicos: um "sim" explícito aqui pesa mais que um "resultado"
       genérico que poderia, sozinho, sugerir outra coisa. */
    if (canal) {
      return resultadoFn('canal', ['canal']);
    }
    if (artefato) {
      return resultadoFn('documento-informacao', ['artefato']);
    }

    /* 4. Unidade de valor associada: tem resultado próprio, fronteira e
       necessidade de cliente (como um produto), mas SEM autonomia
       estrutural — depende de um Produto/Serviço maior — e não é, ela
       mesma, a ação/funcionalidade que atua sobre outra coisa. Autonomia=NÃO
       não elimina esta camada — só impede que ela seja tratada como
       Produto/Serviço principal (a diferença entre as duas é só a
       autonomia). */
    if (resultado && fronteira && necessidade && !autonomia && !funcionalidade) {
      return resultadoFn('unidade-valor-associada', ['resultado', 'fronteira', 'necessidade', 'autonomia']);
    }

    /* 5. Conflito real (não hierárquico): processo e capacidade indicados ao
       mesmo tempo, sem nenhum outro sinal (componente, resultado próprio)
       para desempatar qual dos dois é a natureza predominante. Diferente de
       "Componente + opção/configuração" (item 7 abaixo), aqui as duas
       categorias são mutuamente exclusivas — nenhuma é especialização da
       outra — então A validar é a resposta honesta, não uma escolha forçada. */
    if (processo && capacidade && !componente && !resultado && !funcionalidade) {
      return {
        camada: 'a-validar', motivos: [motivo('processo'), motivo('capacidade')],
        conflito: [camadaPorId('processo-etapa').label, camadaPorId('capacidade-organizacional').label],
        incoerencia: false, especializacao: null, exclusoesSim: exclusoesSim
      };
    }

    /* 6. Capacidade organizacional: capacidade interna, sem necessidade de
       cliente identificável nem papel de componente de outra solução —
       "Componente pertence à solução; Capacidade pertence à organização". */
    if (capacidade && !necessidade && !componente) {
      return resultadoFn('capacidade-organizacional', ['capacidade', 'necessidade', 'componente']);
    }

    /* 7. Componente: pertence estruturalmente a outra solução, sem
       autonomia, sem ser a ação (funcionalidade) e sem resultado próprio
       autônomo. "Modalidade/opção/configuração" aqui NUNCA vira uma
       categoria concorrente à parte — é tratada como uma característica
       secundária do próprio componente (especialização), evitando o falso
       conflito que a resposta "é uma modalidade" costumava gerar quando
       aparecia ao lado de "existe para outro Produto/Serviço entregar
       resultado". Também é o destino padrão de uma modalidade/opção/
       configuração isolada, sem resultado próprio que a distinga como uma
       variante de verdade da oferta (ver item 8, Modalidade/Subproduto). */
    if ((componente || modalidade) && !autonomia && !funcionalidade && !resultado && !processo && !regra) {
      return resultadoFn('componente', ['componente', 'modalidade', 'resultado']);
    }

    /* 8. Modalidade/Subproduto: só quando o item tem resultado próprio
       perceptível — o que o diferencia de uma simples opção/configuração
       (que vira Componente, item 7) e o caracteriza como uma variante
       reconhecível da oferta principal, com identidade própria. */
    if (modalidade && resultado && !funcionalidade && !autonomia && !componente) {
      return resultadoFn('modalidade-subproduto', ['modalidade', 'resultado', 'funcionalidade', 'autonomia']);
    }

    if (regra && !funcionalidade && !autonomia && !resultado) {
      return resultadoFn('regra-condicao', ['regra', 'funcionalidade', 'autonomia']);
    }
    if (processo && !funcionalidade && !autonomia && !resultado) {
      return resultadoFn('processo-etapa', ['processo', 'funcionalidade', 'autonomia']);
    }

    /* Nada acima se sustentou: evidência insuficiente para recomendar
       qualquer categoria com segurança — nunca uma escolha forçada. */
    return { camada: 'a-validar', motivos: [], conflito: null, incoerencia: false, especializacao: null, exclusoesSim: exclusoesSim };
  }

  /* Descreve, numa frase própria, COMO o item se relaciona com o
     Produto/Serviço do qual depende — o terceiro bloco do resultado
     ("Relação arquitetural"). Produto/Serviço principal e A validar não têm
     relação de dependência a descrever (retornam null e o bloco não
     aparece). Para Funcionalidade/Operação, o alvo da ação é composto a
     partir de QUAL outra resposta de exclusão também está em SIM — nunca
     do nome do item. */
  function relacaoArquitetural(camadaId, atual) {
    var r = atual.respostas || {};
    function sim(id) { return !!(r[id] && r[id].valor === 'sim'); }
    switch (camadaId) {
      case 'unidade-valor-associada':
        return 'Depende estruturalmente de um Produto/Serviço maior, embora tenha resultado, fronteira e necessidade de cliente próprios.';
      case 'funcionalidade-operacao':
        var alvo = sim('modalidade') ? 'uma modalidade/opção/configuração' :
          sim('regra') ? 'uma regra/condição' :
          sim('processo') ? 'um processo' :
          sim('componente') ? 'um componente' : 'um elemento';
        return 'Atua sobre ' + alvo + ' pertencente a outro Produto/Serviço — não existe de forma independente dele.';
      case 'modalidade-subproduto':
        return 'É uma modalidade/opção/configuração pertencente a outro Produto/Serviço, e não uma ação sobre ela.';
      case 'componente':
        return sim('componente')
          ? 'Existe para que outro Produto/Serviço consiga entregar seu resultado — não tem resultado próprio perceptível.'
          : 'É um elemento configurável de outro Produto/Serviço, sem resultado próprio perceptível que o caracterize como uma oferta independente.';
      case 'regra-condicao':
        return 'É uma regra ou condição de outro Produto/Serviço.';
      case 'processo-etapa':
        return 'É um processo ou etapa de processo de outro Produto/Serviço.';
      case 'capacidade-organizacional':
        return 'É uma capacidade organizacional interna, sem necessidade de cliente identificável associada.';
      case 'canal':
        return 'É um canal de acesso ou relacionamento a um ou mais Produto/Serviço.';
      case 'documento-informacao':
        return 'É um documento ou informação entregue a partir de outro Produto/Serviço.';
      default:
        return null;
    }
  }

  /* Rótulo único do resultado/decisão em qualquer lugar do site — tela,
     PDF e Excel. "NÃO É PRODUTO/SERVIÇO" sozinho dava a entender que o
     item foi descartado; o "PRINCIPAL" deixa explícito que o sistema está
     avaliando autonomia/independência, não impedindo que o item seja, por
     exemplo, um Componente ou uma Funcionalidade/Operação legítimos. */
  function rotuloResultado(v) {
    if (v === 'produto') return 'É Produto/Serviço';
    if (v === 'a-validar') return 'A validar';
    return 'Não é Produto/Serviço Principal';
  }

  /* Cláusula "porque ..." da justificativa consolidada (gerarJustificativaAutomatica),
     uma por camada — nunca a partir do nome do item, sempre da camada já
     identificada pelo motor. Cada frase é hand-escrita para ler bem em
     português; o motor decide QUAL usar, nunca o texto em si. */
  function motivoJustificativa(camadaId) {
    switch (camadaId) {
      case 'unidade-valor-associada':
        return 'entrega um resultado próprio e perceptível para o cliente, mas depende estruturalmente de um Produto/Serviço maior para existir';
      case 'funcionalidade-operacao':
        return 'atua predominantemente dentro de outro Produto/Serviço e não possui autonomia estrutural para existir de forma independente';
      case 'modalidade-subproduto':
        return 'é predominantemente uma modalidade, opção ou configuração de outro Produto/Serviço, e não uma ação realizada sobre ela';
      case 'componente':
        return 'pertence estruturalmente a outra solução e contribui para que ela entregue seu resultado, sem ter, ele mesmo, um resultado próprio perceptível para o cliente';
      case 'regra-condicao':
        return 'funciona predominantemente como uma regra ou condição de outro Produto/Serviço';
      case 'processo-etapa':
        return 'funciona predominantemente como um processo ou etapa de processo de outro Produto/Serviço';
      case 'capacidade-organizacional':
        return 'funciona predominantemente como uma capacidade organizacional interna, sem necessidade de cliente identificável associada';
      case 'canal':
        return 'funciona predominantemente como um canal de acesso ou relacionamento, e não como uma solução com resultado próprio';
      case 'documento-informacao':
        return 'funciona predominantemente como um documento ou informação entregue ao cliente, e não como uma solução com resultado próprio';
      default:
        return null;
    }
  }

  /* Termo usado nas interpretações contextuais (fronteira, gestão) que
     precisam nomear "o que" foi identificado, sem chamar tudo de "solução"
     quando a camada final já diz que o item não é uma. Nunca o nome do
     item — sempre a camada já identificada. */
  var TERMO_CAMADA = {
    'produto-principal': 'a solução',
    'unidade-valor-associada': 'a solução',
    'modalidade-subproduto': 'a modalidade/opção',
    'funcionalidade-operacao': 'a funcionalidade/operação',
    'componente': 'o componente',
    'regra-condicao': 'a regra/condição',
    'processo-etapa': 'o processo/etapa de processo',
    'capacidade-organizacional': 'a capacidade organizacional',
    'canal': 'o canal',
    'documento-informacao': 'o documento/informação'
  };
  function termoCamada(camadaId) { return TERMO_CAMADA[camadaId] || 'o item'; }

  /* Só as camadas com um papel de suporte/execução reconhecível emprestam
     um termo para a interpretação de "gestão ponta a ponta = NÃO" — para as
     demais (produto-principal, unidade-valor-associada, a-validar) não há
     papel específico a apontar, então a interpretação cai num texto neutro
     em vez de inventar "processo/capacidade/suporte" sem evidência. */
  var TERMO_GESTAO_POR_CAMADA = {
    'funcionalidade-operacao': 'funcionalidade/operação',
    'modalidade-subproduto': 'modalidade/opção',
    'componente': 'componente de suporte',
    'regra-condicao': 'regra/condição',
    'processo-etapa': 'processo',
    'capacidade-organizacional': 'capacidade organizacional',
    'canal': 'canal',
    'documento-informacao': 'documento/informação'
  };

  /* Interpretação do sistema para uma pergunta já respondida, ajustada de
     acordo com a classificação FINAL já identificada (item.camadaSugerida)
     quando isso evita um texto incoerente — nunca a partir do nome do
     item, sempre da camada e das próprias respostas já gravadas. Fora de
     um resultado concluído (checklist em andamento, camada ainda
     desconhecida) ou para perguntas não afetadas, cai sempre na leitura
     fixa por pergunta (justificativaAuto), gravada no momento da resposta. */
  function interpretacaoSistema(def, resposta, item) {
    var base = semPrefixo(resposta && resposta.justificativaAuto);
    var camada = item && item.status === 'concluido' && item.camadaSugerida;
    if (!camada || !resposta || !resposta.valor) return base;
    var r = item.respostas || {};
    function sim(id) { return !!(r[id] && r[id].valor === 'sim'); }

    if (def.id === 'fronteira' && resposta.valor === 'sim') {
      return 'Existe uma fronteira coerente e identificável para ' + termoCamada(camada.id) + '.';
    }
    if (def.id === 'gestao' && resposta.valor === 'nao') {
      var termoGestao = TERMO_GESTAO_POR_CAMADA[camada.id];
      if (termoGestao) {
        return 'O item pode ser administrado como ' + termoGestao + ', mas não como uma solução autônoma independente do Produto/Serviço ao qual pertence.';
      }
      return 'Este critério, isoladamente, não determina se o item é gerido como processo, capacidade ou suporte compartilhado — a classificação final considera o conjunto das respostas.';
    }
    if (def.id === 'componente' && resposta.valor === 'nao' && !sim('autonomia')) {
      return 'Embora dependa estruturalmente de outro Produto/Serviço, o item entrega um resultado diretamente percebido pelo cliente e não existe apenas ' +
        'como suporte para que outra solução entregue seu resultado.';
    }
    return base;
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
        conflito: ident.conflito,
        incoerencia: ident.incoerencia,
        especializacao: ident.especializacao,
        relacao: relacaoArquitetural(ident.camada, atual)
      }
    };
  }

  /* Nunca um texto fixo: a frase muda com a camada encontrada e com os
     próprios motivos (pergunta + resposta real) que a sustentaram. */
  function gerarJustificativaAutomatica(atual, calc) {
    var camada = calc.camadaSugerida;
    if (camada.incoerencia) {
      return 'Há respostas que indicam autonomia e outras que indicam dependência. Revise os critérios destacados.';
    }
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
    /* A especialização só entra na frase corrida quando é uma determinação real
       (ex.: "Opção/configuração de personalização") — o texto de fallback
       ("não determinada pelo questionário") já tem seu próprio campo separado
       na tela (ver renderResultado) e não deve soar como ressalva ou dúvida
       dentro da justificativa da classificação principal. */
    var especializacaoReal = camada.especializacao && camada.especializacao !== ESPECIALIZACAO_NAO_DETERMINADA;
    var especializacaoFrase = especializacaoReal ? ' Especialização: ' + camada.especializacao + '.' : '';

    /* Componente tem um texto próprio (3 frases, em vez do template genérico
       "foi classificado como X, e não como Produto/Serviço principal, porque
       Y") porque a ausência de autonomia/jornada/resultado autônomo é, aqui,
       a própria evidência positiva da camada — não só a negação de
       Produto/Serviço. Continua vindo só da camada já identificada, nunca do
       nome do item: qualquer item com o mesmo padrão estrutural de respostas
       recebe o mesmo texto. */
    if (camada.id === 'componente') {
      return 'O item não possui autonomia estrutural, jornada própria nem resultado autônomo suficiente para caracterizar Produto/Serviço principal. ' +
        'As respostas indicam que ele pertence estruturalmente a outra solução e funciona como elemento configurável dela. ' +
        'Por isso, sua classificação predominante é Componente.' + especializacaoFrase;
    }

    /* Funcionalidade/Operação ganha uma segunda frase fixa descrevendo o
       papel típico da camada (consultar/escolher/solicitar/alterar/
       executar/administrar um elemento da solução principal) — é uma
       propriedade da PRÓPRIA camada, igual para qualquer item que caia nela,
       não uma inferência sobre este item específico. */
    var complemento = camada.id === 'funcionalidade-operacao'
      ? ' Sua função predominante é permitir que o cliente consulte, escolha, solicite, altere, execute ou administre um elemento pertencente à solução principal.'
      : '';

    return 'O item foi classificado como ' + camada.label + ', e não como Produto/Serviço principal, porque ' +
      motivoJustificativa(camada.id) + '.' + complemento + especializacaoFrase;
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
  /* Resumo de "o que mudou" numa reavaliação em andamento, comparando o
     rascunho atual (atual) contra a fotografia da avaliação anterior (base).
     Devolve null quando nada mudou ainda — o resumo só deve aparecer quando
     há alguma alteração real (ver pedido). */
  function calcularAlteracoesReavaliacao(atual, base) {
    if (!base) return null;
    var respostasAlteradas = 0, justificativasModificadas = 0;
    TODAS_PERGUNTAS.forEach(function (p) {
      var atualR = atual.respostas[p.id];
      if (!atualR) return;
      var baseR = base.respostas[p.id];
      if (baseR && baseR.valor !== atualR.valor) respostasAlteradas++;
      var obsAtual = (atualR.observacao || '').trim();
      var obsBase = ((baseR && baseR.observacao) || '').trim();
      if (obsAtual !== obsBase) justificativasModificadas++;
    });
    var camposCadastrais = ['nome', 'descricao', 'publico', 'necessidade', 'observacoesGerais'];
    var dadosAlterados = camposCadastrais.some(function (c) { return (atual[c] || '') !== (base[c] || ''); });
    if (!respostasAlteradas && !justificativasModificadas && !dadosAlterados) return null;
    return { respostasAlteradas: respostasAlteradas, justificativasModificadas: justificativasModificadas, dadosAlterados: dadosAlterados };
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

  /* ===================== EXPORTAÇÃO (PDF e Excel) =====================
     A exportação é só leitura: usa exclusivamente os dados já gravados
     (respostas, justificativas, resultadoAutomatico, camadaSugerida,
     decisaoFinal…) — nunca recalcula, reinterpreta ou inventa nada. As duas
     bibliotecas (html2pdf.js e SheetJS/xlsx) são vendorizadas localmente em
     forca-agil/ porque este projeto não tem build step/bundler/npm em
     produção (ver CLAUDE.md), e são carregadas SOB DEMANDA — nunca no
     carregamento inicial da página — para não pesar a experiência de quem
     nunca usa a aba Arquitetura (a maioria: participantes na oficina, no
     celular, muitas vezes em rede lenta). */
  function carregarScript(src, jaDisponivel, cb) {
    if (jaDisponivel()) { cb(); return; }
    var existente = document.querySelector('script[data-avp-lib="' + src + '"]');
    if (existente) {
      existente.addEventListener('load', function () { cb(); });
      existente.addEventListener('error', function () { cb(new Error('Falha ao carregar ' + src)); });
      return;
    }
    var s = document.createElement('script');
    s.src = src;
    s.setAttribute('data-avp-lib', src);
    s.onload = function () { cb(); };
    s.onerror = function () { cb(new Error('Falha ao carregar ' + src)); };
    document.head.appendChild(s);
  }
  function sanitizarNomeArquivo(s) {
    var t = String(s || 'item').normalize('NFD').replace(/[̀-ͯ]/g, '');
    t = t.replace(/[^A-Za-z0-9]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    return (t || 'item').slice(0, 80);
  }
  function dataParaNomeArquivo(iso) {
    var d = iso ? new Date(iso) : new Date();
    function p(n) { return String(n).length < 2 ? '0' + n : String(n); }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function nomeArquivoPdf(it) {
    return 'Avaliacao_Produto_Servico_' + sanitizarNomeArquivo(it.nome) + '_' + dataParaNomeArquivo() + '.pdf';
  }
  function nomeArquivoExcel(sufixo) {
    return 'Avaliacoes_Produto_Servico_' + sufixo + '_' + dataParaNomeArquivo() + '.xlsx';
  }

  var CSS_PDF = '' +
    '.pdf-doc{font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;background:#ffffff;font-size:11px;line-height:1.5;padding:4px 6px}' +
    '.pdf-header{text-align:center;border-bottom:2px solid #16306a;padding-bottom:10px;margin-bottom:16px}' +
    '.pdf-header-marca{font-size:12px;letter-spacing:.08em;color:#16306a;text-transform:uppercase}' +
    '.pdf-header-titulo{font-size:20px;margin:4px 0;color:#0e1f44}' +
    '.pdf-header-data{font-size:10px;color:#666;margin:0}' +
    '.pdf-versao{font-size:10px;color:#666;font-style:italic;margin:0 0 10px}' +
    '.pdf-secao-titulo{font-size:13px;color:#16306a;border-bottom:1px solid #ccc;padding-bottom:3px;margin:16px 0 8px;page-break-after:avoid}' +
    '.pdf-subsecao{font-size:12px;color:#333;margin:10px 0 6px;page-break-after:avoid}' +
    '.pdf-tabela-id{width:100%;border-collapse:collapse;margin-bottom:10px}' +
    '.pdf-tabela-id th{text-align:left;width:220px;padding:4px 8px;background:#f2f4f8;border:1px solid #ddd;vertical-align:top;font-weight:bold}' +
    '.pdf-tabela-id td{padding:4px 8px;border:1px solid #ddd;vertical-align:top}' +
    '.pdf-resultado{font-size:14px;font-weight:bold;padding:6px 10px;border-radius:4px;display:inline-block;margin:0}' +
    '.pdf-resultado--produto{background:#d7f3ef;color:#0b6b62}' +
    '.pdf-resultado--nao-produto{background:#fdf1cf;color:#8a6800}' +
    '.pdf-resultado--a-validar{background:#dfe9fb;color:#1f4e9c}' +
    '.pdf-aviso{color:#8a6800;font-style:italic;margin:4px 0}' +
    '.pdf-pergunta{border:1px solid #e2e2e2;border-radius:4px;padding:8px 10px;margin-bottom:6px;' +
      'page-break-inside:avoid;break-inside:avoid}' +
    '.pdf-pergunta-texto{margin:0 0 4px}' +
    '.pdf-pergunta-campo{margin:0 0 2px;font-size:10px}' +
    '.pdf-quebra{page-break-before:always}' +
    '.pdf-tabela-id tr{page-break-inside:avoid;break-inside:avoid}';

  function pdfLinhaTabela(rotulo, valor) {
    return '<tr><th>' + esc(rotulo) + '</th><td>' + esc(valor || '—') + '</td></tr>';
  }
  function pdfPergunta(def, resposta, it) {
    if (!resposta || !resposta.valor) return '';
    var valor = resposta.valor === 'sim' ? 'SIM' : 'NÃO';
    var obs = (resposta.observacao || '').trim();
    /* pdf-pergunta-bloco é o bloco indivisível (pergunta + resposta +
       justificativa do usuário + interpretação do sistema) — nunca deve
       atravessar duas páginas do PDF. */
    return '' +
      '<div class="pdf-pergunta pdf-pergunta-bloco">' +
      '<p class="pdf-pergunta-texto">' + numeroGlobal(def) + '. ' + esc(def.titulo || def.pergunta) + ' — <strong>' + valor + '</strong></p>' +
      '<p class="pdf-pergunta-campo"><strong>Justificativa do usuário:</strong> ' +
        (obs ? esc(obs) : '<em>Nenhuma observação registrada.</em>') + '</p>' +
      '<p class="pdf-pergunta-campo"><strong>Interpretação do sistema:</strong> ' + esc(interpretacaoSistema(def, resposta, it)) + '</p>' +
      '</div>';
  }
  function montarCabecalhoPdf() {
    return '' +
      '<div class="pdf-header">' +
      '<p class="pdf-header-marca">PREVI · Força Ágil</p>' +
      '<h1 class="pdf-header-titulo">Avaliação de Produto/Serviço</h1>' +
      '<p class="pdf-header-data">Documento gerado em ' + esc(fmtData(new Date().toISOString())) + '</p>' +
      '</div>';
  }
  /* Reflete só o que já está gravado no registro — nunca recalcula
     resultado/camada/decisão nem reformula uma justificativa. */
  function montarSecaoAvaliacaoPdf(it, primeira) {
    var html = '<section class="pdf-av' + (primeira ? '' : ' pdf-quebra') + '">';
    var rotuloVersao = it.versao > 1 ? ('Reavaliação — versão ' + it.versao) : 'Avaliação original — versão 1';
    html += '<p class="pdf-versao">' + esc(rotuloVersao) + ' · ' + esc(fmtData(it.criadoEm)) + ' · ' +
      esc(it.responsavel && it.responsavel.name || '—') + '</p>';

    html += '<h2 class="pdf-secao-titulo">Identificação da avaliação</h2>';
    html += '<table class="pdf-tabela-id">';
    html += pdfLinhaTabela('Nome do item', it.nome);
    html += pdfLinhaTabela('Descrição do item', it.descricao);
    html += pdfLinhaTabela('Público/cliente relacionado', it.publico);
    html += pdfLinhaTabela('Necessidade que o item pretende atender', it.necessidade);
    html += pdfLinhaTabela('Observações', it.observacoesGerais);
    html += pdfLinhaTabela('Responsável pela avaliação', it.responsavel && it.responsavel.name);
    html += pdfLinhaTabela('Data da avaliação', fmtData(it.criadoEm));
    html += pdfLinhaTabela('Status', it.status === 'concluido' ? 'Concluído' : 'Rascunho');
    html += '</table>';

    if (it.status !== 'concluido') {
      html += '<p class="pdf-aviso">Esta avaliação está em rascunho: ainda não há resultado, classificação ' +
        'nem decisão arquitetural calculados.</p></section>';
      return html;
    }

    var rotuloResultadoTxt = rotuloResultado(it.resultadoAutomatico);
    html += '<h2 class="pdf-secao-titulo">Resultado sobre Produto/Serviço</h2>';
    html += '<p class="pdf-resultado pdf-resultado--' + esc(it.resultadoAutomatico || 'a-validar') + '">' +
      esc(rotuloResultadoTxt) + '</p>';

    var camada = it.camadaSugerida;
    html += '<h2 class="pdf-secao-titulo">Classificação arquitetural sugerida</h2>';
    html += '<p>' + esc(camada && camada.label || '—') + '</p>';
    if (camada && camada.especializacao) {
      html += '<p><strong>Especialização:</strong> ' + esc(camada.especializacao) + '</p>';
    }
    if (camada && camada.conflito && camada.conflito.length) {
      html += '<p class="pdf-aviso">Categorias em conflito nas respostas: ' + esc(camada.conflito.join(', ')) + '.</p>';
    }
    if (camada && camada.incoerencia) {
      html += '<p class="pdf-aviso">Há respostas que indicam autonomia e outras que indicam dependência. Revise os critérios destacados.</p>';
    }

    if (camada && camada.relacao) {
      html += '<h2 class="pdf-secao-titulo">Relação arquitetural</h2>';
      html += '<p>' + esc(camada.relacao) + '</p>';
    }

    html += '<h2 class="pdf-secao-titulo">Justificativa da classificação</h2>';
    html += '<p>' + esc(it.justificativaAutomatica || '—') + '</p>';

    html += '<h2 class="pdf-secao-titulo">Como chegamos a essa conclusão</h2>';
    html += '<h3 class="pdf-subsecao">Critérios principais — perguntas 1 a ' + CRITERIOS.length + '</h3>';
    CRITERIOS.forEach(function (c) { html += pdfPergunta(c, it.respostas[c.id], it); });
    html += '<h3 class="pdf-subsecao">Testes de classificação — perguntas ' + (CRITERIOS.length + 1) + ' a ' + TODAS_PERGUNTAS.length + '</h3>';
    EXCLUSOES.forEach(function (e) { html += pdfPergunta(e, it.respostas[e.id], it); });

    html += '<h2 class="pdf-secao-titulo">Decisão arquitetural</h2>';
    html += '<table class="pdf-tabela-id">';
    html += pdfLinhaTabela('Recomendação do sistema', rotuloResultadoTxt);
    html += pdfLinhaTabela('Classificação sugerida', camada && camada.label);
    var decisaoTxt = rotuloResultado(it.decisaoFinal);
    html += pdfLinhaTabela('Decisão final', decisaoTxt);
    html += pdfLinhaTabela('Forma da decisão', it.decisaoManual ? 'Alterada manualmente' : 'Recomendação do sistema aceita');
    if (it.decisaoManual) {
      html += pdfLinhaTabela('Justificativa da decisão manual', it.justificativaDecisao);
      html += pdfLinhaTabela('Responsável pela decisão', it.alteradoPor && it.alteradoPor.name);
      html += pdfLinhaTabela('Data e hora da decisão', fmtData(it.alteradoEm));
    }
    html += '</table></section>';
    return html;
  }
  function montarDocumentoPdf(itens) {
    var corpo = montarCabecalhoPdf();
    itens.forEach(function (it, i) { corpo += montarSecaoAvaliacaoPdf(it, i === 0); });
    return '<div class="pdf-doc"><style>' + CSS_PDF + '</style>' + corpo + '</div>';
  }
  /* Espera determinística por: fontes carregadas (document.fonts.ready, quando
     existir) e layout assentado (dois requestAnimationFrame seguidos — o primeiro
     garante que o navegador processou o reflow do container recém-inserido, o
     segundo garante que esse reflow já foi pintado). Nunca usa setTimeout com
     prazo arbitrário: aguarda sinais reais de que o conteúdo está pronto. */
  function aguardarRenderizacaoCompleta(cb) {
    var fontesProntas = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    fontesProntas.then(function () {
      requestAnimationFrame(function () { requestAnimationFrame(cb); });
    }, function () { requestAnimationFrame(function () { requestAnimationFrame(cb); }); });
  }
  /* cbFim(erro|null). O container fica fora da tela (nunca visível) durante
     a geração e é removido ao final, sucesso ou erro.

     CAUSA RAIZ do PDF em branco (item individual, telas altas): o html2pdf.js
     clona o container num overlay próprio (position:fixed;overflow:hidden)
     que ele mesmo cria e anexa ao fim do <body>. Ao delegar para o html2canvas,
     a biblioteca tenta calcular sozinha o deslocamento (scrollX/scrollY/x/y) do
     elemento a capturar em relação à janela — e quando o container real está
     posicionado bem abaixo no documento (por estar no fim do <body>, atrás de
     todo o conteúdo já renderizado da aplicação), esse cálculo automático erra
     e produz um recorte deslocado para fora da área realmente desenhada: o
     canvas final sai com o tamanho e a paginação corretos, mas inteiramente em
     branco, porque o conteúdo foi desenhado fora da janela de recorte usada.
     Isso foi confirmado interceptando o canvas que o html2canvas realmente
     devolve: os fillText do conteúdo aconteciam com cor e texto corretos, mas
     a leitura de pixels do canvas final continuava em branco — até se passar
     explicitamente scrollX:0, scrollY:0, x:0, y:0, o que elimina o cálculo
     automático (dependente da posição/scroll da página) e faz o html2canvas
     recortar exatamente a partir da origem do próprio container. Por isso a
     geração de PDF não pode depender de posição de rolagem da tela — e, com
     esses valores fixos, não depende mesmo. */
  function gerarPdf(itens, nomeArquivo, cbFim) {
    carregarScript('forca-agil/html2pdf.bundle.min.js', function () { return typeof window.html2pdf === 'function'; }, function (erroCarga) {
      if (erroCarga) { cbFim(erroCarga); return; }
      var container = document.createElement('div');
      /* 186mm = largura A4 (210mm) menos as margens esquerda+direita definidas
         abaixo (12mm cada). Precisa bater exatamente com pageSize.inner.width
         do jsPDF — um container mais largo que a área imprimível fica cortado
         na borda direita (ficava mascarado pelo bug do PDF em branco, mas é um
         problema separado de largura, não de conteúdo ausente). */
      container.style.cssText = 'width:186mm;background:#fff;';
      container.innerHTML = montarDocumentoPdf(itens);
      document.body.appendChild(container);
      function limpar() { if (container.parentNode) document.body.removeChild(container); }
      aguardarRenderizacaoCompleta(function () {
        /* html2canvas às vezes falha em medir a altura de um container recém-
           inserido (mede 0 e produz um PDF em branco) quando ele não fica em
           fluxo normal visível — por isso mora no fim do <body> em fluxo
           normal (não fixed/absolute) enquanto gera, e a altura real
           (scrollHeight, já com o layout assentado) é passada explicitamente,
           em vez de deixar a biblioteca tentar adivinhar. */
        var alturaReal = container.scrollHeight;
        var larguraReal = container.scrollWidth;
        if (!alturaReal) { limpar(); cbFim(new Error('Container de exportação sem conteúdo renderizado.')); return; }
        try {
          window.html2pdf().set({
            margin: [14, 12, 16, 12],
            filename: nomeArquivo,
            image: { type: 'jpeg', quality: 0.95 },
            html2canvas: {
              scale: 2, backgroundColor: '#ffffff', useCORS: false,
              width: larguraReal, windowWidth: larguraReal,
              height: alturaReal, windowHeight: alturaReal,
              /* Ver comentário de causa raiz acima: zera o cálculo automático
                 de deslocamento do html2canvas, que é o que produzia o PDF em
                 branco em telas de resultado altas. windowWidth precisa do
                 mesmo tratamento que windowHeight já tinha: sem ele, o
                 html2canvas usa document.documentElement.clientWidth (a
                 largura REAL da tela de quem está gerando o PDF) como
                 "janela" interna de renderização — como o container tem
                 largura fixa (186mm), isso não altera seu tamanho, mas desloca
                 e corta o conteúdo capturado sempre que a tela é mais larga
                 que o container (ex.: um computador de escritório, 1280px):
                 o PDF saía com metade esquerda em branco e o conteúdo
                 comprimido contra a borda direita. Fixar windowWidth na
                 largura real do próprio container elimina essa dependência
                 da largura de tela de quem gera o PDF. */
              x: 0, y: 0, scrollX: 0, scrollY: 0
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['css', 'avoid-all'] }
          }).from(container).toPdf().get('pdf').then(function (pdf) {
            var total = pdf.internal.getNumberOfPages();
            var largura = pdf.internal.pageSize.getWidth();
            var altura = pdf.internal.pageSize.getHeight();
            for (var i = 1; i <= total; i++) {
              pdf.setPage(i);
              pdf.setFontSize(8);
              pdf.setTextColor(120);
              pdf.text('Página ' + i + ' de ' + total, largura / 2, altura - 6, { align: 'center' });
            }
          }).save().then(function () { limpar(); cbFim(null); }, function (erroSave) { limpar(); cbFim(erroSave); });
        } catch (erroGeral) {
          limpar();
          cbFim(erroGeral);
        }
      });
    });
  }

  var EXCEL_COLS_RESUMO = [
    { largura: 26, rotulo: 'ID da avaliação' }, { largura: 30, rotulo: 'Nome do item' },
    { largura: 34, rotulo: 'Descrição' }, { largura: 22, rotulo: 'Público/cliente' },
    { largura: 30, rotulo: 'Necessidade' }, { largura: 20, rotulo: 'Responsável' },
    { largura: 16, rotulo: 'Data' }, { largura: 12, rotulo: 'Status' }, { largura: 8, rotulo: 'Versão' },
    { largura: 20, rotulo: 'Resultado automático' }, { largura: 28, rotulo: 'Classificação arquitetural sugerida' },
    { largura: 40, rotulo: 'Relação arquitetural' }, { largura: 20, rotulo: 'Decisão arquitetural final' },
    { largura: 14, rotulo: 'Tipo da decisão' }, { largura: 20, rotulo: 'Responsável pela decisão' },
    { largura: 16, rotulo: 'Data da decisão' }, { largura: 40, rotulo: 'Justificativa da decisão manual' }
  ];
  function linhaResumoExcel(it) {
    var camada = it.camadaSugerida;
    return [
      it._key, it.nome || '', it.descricao || '', it.publico || '', it.necessidade || '',
      (it.responsavel && it.responsavel.name) || '', it.criadoEm ? new Date(it.criadoEm) : '',
      it.status === 'concluido' ? 'Concluído' : 'Rascunho', it.versao || 1,
      it.status === 'concluido' ? rotuloResultado(it.resultadoAutomatico) : '',
      (camada && camada.label) || '', (camada && camada.relacao) || '',
      it.status === 'concluido' ? rotuloResultado(it.decisaoFinal) : '',
      it.status === 'concluido' ? (it.decisaoManual ? 'Manual' : 'Automática') : '',
      it.decisaoManual ? ((it.alteradoPor && it.alteradoPor.name) || '') : '',
      it.decisaoManual && it.alteradoEm ? new Date(it.alteradoEm) : '',
      it.decisaoManual ? (it.justificativaDecisao || '') : ''
    ];
  }
  var EXCEL_COLS_RESPOSTAS = [
    { largura: 26 }, { largura: 30 }, { largura: 8 }, { largura: 18 }, { largura: 10 },
    { largura: 46 }, { largura: 10 }, { largura: 46 }, { largura: 46 }
  ];
  var EXCEL_HEAD_RESPOSTAS = ['ID da avaliação', 'Nome do item', 'Versão', 'Grupo da pergunta', 'Número da pergunta',
    'Pergunta', 'Resposta', 'Justificativa do usuário', 'Interpretação do sistema'];
  function linhasRespostasExcel(itens) {
    var linhas = [];
    itens.forEach(function (it) {
      if (it.status !== 'concluido' || !it.respostas) return;
      TODAS_PERGUNTAS.forEach(function (p, idx) {
        var r = it.respostas[p.id];
        if (!r || !r.valor) return;
        linhas.push([
          it._key, it.nome || '', it.versao || 1,
          criterioPorId(p.id) ? 'Critério principal' : 'Teste de classificação',
          idx + 1, p.titulo || p.pergunta, r.valor === 'sim' ? 'SIM' : 'NÃO',
          r.observacao || '', interpretacaoSistema(p, r, it)
        ]);
      });
    });
    return linhas;
  }
  var EXCEL_COLS_HISTORICO = [
    { largura: 26 }, { largura: 26 }, { largura: 8 }, { largura: 16 }, { largura: 20 },
    { largura: 20 }, { largura: 28 }, { largura: 20 }, { largura: 40 }
  ];
  var EXCEL_HEAD_HISTORICO = ['ID do item', 'ID da avaliação', 'Versão', 'Data', 'Responsável',
    'Resultado automático', 'Classificação sugerida', 'Decisão final', 'Justificativa de divergência'];
  /* Uma linha por versão de cada item incluído no export, mesmo quando essa
     versão já foi superada por uma reavaliação — é exatamente disso que o
     histórico trata. Nunca inventa uma versão anterior que não existe: se o
     item nunca foi reavaliado, aparece só a linha da própria versão 1. */
  function linhasHistoricoExcel(itensExportados, todosOsItens) {
    var idsIncluidos = {};
    itensExportados.forEach(function (it) { idsIncluidos[it.itemId || it._key] = true; });
    return todosOsItens.filter(function (it) { return !it.excluido && idsIncluidos[it.itemId || it._key]; })
      .sort(function (x, y) {
        var idA = x.itemId || x._key, idB = y.itemId || y._key;
        if (idA !== idB) return idA < idB ? -1 : 1;
        return (x.versao || 1) - (y.versao || 1);
      })
      .map(function (it) {
        return [
          it.itemId || it._key, it._key, it.versao || 1, it.criadoEm ? new Date(it.criadoEm) : '',
          (it.responsavel && it.responsavel.name) || '',
          it.status === 'concluido' ? rotuloResultado(it.resultadoAutomatico) : '',
          (it.camadaSugerida && it.camadaSugerida.label) || '',
          it.status === 'concluido' ? rotuloResultado(it.decisaoFinal) : '',
          it.decisaoManual ? (it.justificativaDecisao || '') : ''
        ];
      });
  }
  function planilhaComColunas(XLSXLib, cabecalho, linhas, colunas) {
    var ws = XLSXLib.utils.aoa_to_sheet([cabecalho].concat(linhas));
    ws['!cols'] = colunas.map(function (c) { return { wch: c.largura }; });
    var ultimaLinha = linhas.length; /* +1 do cabeçalho, -1 por ser índice 0 */
    ws['!autofilter'] = { ref: XLSXLib.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: ultimaLinha, c: cabecalho.length - 1 } }) };
    return ws;
  }
  /* cbFim(erro|null). itensExportados é o conjunto respeitando o filtro/
     seleção escolhida na tela; todosOsItens é state.itens completo, usado
     só para montar o histórico de versões desses mesmos itens. */
  function gerarExcel(itensExportados, todosOsItens, nomeArquivo, cbFim) {
    carregarScript('forca-agil/xlsx.mini.min.js', function () { return !!window.XLSX; }, function (erroCarga) {
      if (erroCarga) { cbFim(erroCarga); return; }
      try {
        var XLSXLib = window.XLSX;
        var wb = XLSXLib.utils.book_new();
        var wsResumo = planilhaComColunas(XLSXLib,
          EXCEL_COLS_RESUMO.map(function (c) { return c.rotulo; }),
          itensExportados.map(linhaResumoExcel), EXCEL_COLS_RESUMO);
        XLSXLib.utils.book_append_sheet(wb, wsResumo, 'Resumo');

        var wsRespostas = planilhaComColunas(XLSXLib, EXCEL_HEAD_RESPOSTAS,
          linhasRespostasExcel(itensExportados), EXCEL_COLS_RESPOSTAS);
        XLSXLib.utils.book_append_sheet(wb, wsRespostas, 'Respostas do questionário');

        var wsHistorico = planilhaComColunas(XLSXLib, EXCEL_HEAD_HISTORICO,
          linhasHistoricoExcel(itensExportados, todosOsItens), EXCEL_COLS_HISTORICO);
        XLSXLib.utils.book_append_sheet(wb, wsHistorico, 'Histórico');

        XLSXLib.writeFile(wb, nomeArquivo, { cellDates: true });
        cbFim(null);
      } catch (erroGeral) {
        cbFim(erroGeral);
      }
    });
  }

  window.faInitAvaliacaoProduto = function () {
    var wrap = document.getElementById('adminAvaliacaoProduto');
    if (!wrap || wrap._avpBound) return;
    wrap._avpBound = true;

    var state = {
      tela: 'lista', /* 'lista' | 'form-inicial' | 'checklist' | 'resultado' | 'nao-encontrada' | 'sem-permissao' | 'carregando' */
      itens: [],
      itensCarregados: false, /* true depois da primeira resposta (sucesso OU erro) do Firebase — evita
                                  mostrar "não encontrada" antes dos dados terem sequer chegado (ex.: F5) */
      erroCarga: null,        /* null | 'permissao' | 'geral' — motivo de itensCarregados nunca ter dados */
      filtro: { resultado: 'todos', status: 'todos', alterado: 'todos', alternativa: 'todos' },
      lixeira: false,        /* alterna a lista entre ativos e excluídos — "excluído" é outra dimensão, não um status irmão de rascunho/concluído */
      atual: null,
      erroForm: null,
      camposInvalidos: [],
      pendenteId: null,
      salvando: null,       /* null | 'rascunho' | 'concluido' — trava os botões de salvar do checklist */
      salvandoDecisao: false,
      reprocessando: false, /* trava o botão REPROCESSAR COM MOTOR ATUAL enquanto grava */
      decisaoForm: null,
      flashLista: null,     /* confirmação persistente mostrada na lista após salvar rascunho */
      flashResultado: null, /* confirmação persistente mostrada no resultado após concluir */
      flashDecisao: null,   /* confirmação persistente mostrada após salvar a decisão arquitetural */
      reavaliacaoBase: null, /* fotografia da avaliação anterior, só durante uma reavaliação — usada para
                                mostrar "resposta alterada" e o resumo de alterações; nunca gravada */
      selecionados: {},      /* chaves marcadas na lista, para "PDF das selecionadas" — nunca persistido */
      menuExportarAberto: false,
      exportando: null,      /* null | 'pdf' | 'excel' — trava os botões de exportação durante a geração */
      flashExportacao: null, /* mensagem de sucesso/erro da última exportação, mostrada na lista */
      carregandoTravado: false /* true quando a tela 'carregando' esperou demais pela leitura de avaliacoes-produto */
    };

    function temCampoInvalido(campo) {
      return !!(state.camposInvalidos && state.camposInvalidos.indexOf(campo) !== -1);
    }

    function render() {
      if (state.tela === 'lista') renderLista();
      else if (state.tela === 'form-inicial') renderFormInicial();
      else if (state.tela === 'checklist') renderChecklist();
      else if (state.tela === 'resultado') renderResultado();
      else if (state.tela === 'nao-encontrada') renderNaoEncontrada();
      else if (state.tela === 'sem-permissao') renderSemPermissao();
      else if (state.tela === 'carregando') renderCarregandoAvaliacao();
    }

    /* Tela de carregamento de #admin?avp=<chave> (F5, link direto, nova aba)
       enquanto a leitura de avaliacoes-produto ainda não respondeu. Sem isto,
       a primeira renderização (antes de qualquer dado chegar) caía no
       default 'lista' e mostrava "0 avaliações registradas" + "+ Avaliar
       novo item" — uma tela de LISTA VAZIA que parece a aplicação ter
       esquecido a URL e voltado para o início, exatamente o efeito relatado
       como "F5 não funciona" (a leitura era lenta o bastante, numa rede real,
       para essa janela ficar visível). Nunca mostra "não encontrada" nem
       volta pra lista aqui — só espera o dado chegar. Se a leitura nunca
       responder (rede travada — condição normal de 4G/rede corporativa,
       não um caso raro), carregandoTravado passa a true depois de um tempo
       e oferece uma saída em vez de deixar "Carregando…" para sempre. */
    function renderCarregandoAvaliacao() {
      if (!state.carregandoTravado) {
        wrap.innerHTML = '<div class="avp-form-card"><p class="admin-empty">Carregando avaliação…</p></div>';
        return;
      }
      wrap.innerHTML = '<div class="avp-form-card">' +
        '<p class="admin-empty">A conexão está demorando e não foi possível carregar esta avaliação. Verifique sua internet.</p>' +
        '<div class="avp-actions-footer">' +
        '<button class="btn btn--primary" id="avpRecarregarTravado">TENTAR NOVAMENTE</button>' +
        '<button class="btn" id="avpVoltarCarregandoTravado">VOLTAR PARA A LISTA</button>' +
        '</div></div>';
      document.getElementById('avpRecarregarTravado').addEventListener('click', function () { location.reload(); });
      document.getElementById('avpVoltarCarregandoTravado').addEventListener('click', function () {
        state.carregandoTravado = false;
        state.tela = 'lista';
        irParaListaNaHash();
        render();
      });
    }

    /* ===================== ROTA PERSISTENTE (#admin?avp=<key>) =====================
       A tela de resultado é um registro consultável, não uma página de
       transição — precisa sobreviver a F5, funcionar com link copiado/aberto
       em outra aba, e reagir ao botão voltar/avançar do navegador. O router
       central (router.js) só entende páginas fixas (#admin, #home…) e ignora
       tudo depois de "?" ao decidir qual página mostrar — por isso o `?avp=`
       vive dentro do MESMO hash de #admin, sem exigir nenhuma rota nova ali:
       o router mostra #admin normalmente, e este módulo lê o parâmetro para
       decidir se mostra a lista ou uma avaliação específica dela.
       form-inicial/checklist (edição em andamento, nunca salva) ficam DE
       PROPÓSITO fora dessa persistência — só a tela de RESULTADO (um
       registro já salvo) precisa sobreviver a F5/link/histórico. */
    function paramsDaHash() {
      var h = location.hash || '';
      var i = h.indexOf('?');
      var params = {};
      if (i === -1) return params;
      h.slice(i + 1).split('&').forEach(function (par) {
        var partes = par.split('=');
        if (partes[0]) params[decodeURIComponent(partes[0])] = decodeURIComponent(partes[1] || '');
      });
      return params;
    }
    function avpKeyDaHash() { return paramsDaHash().avp || null; }
    function irParaAvaliacaoNaHash(key) {
      var novo = '#admin?avp=' + encodeURIComponent(key);
      if (location.hash !== novo) location.hash = novo; /* empilha uma entrada nova no histórico — permite "voltar" do navegador */
    }
    function irParaListaNaHash() {
      if (location.hash !== '#admin') location.hash = '#admin';
    }
    /* CAUSA RAIZ (F5/link direto para uma avaliação específica, achada por
       instrumentação, não suposição): onPageInit('admin', initAdmin), em
       admin.js, chama initAdmin() de forma SÍNCRONA quando a página 'admin'
       já é a atual — o que é exatamente o caso de um F5 em #admin?avp=...,
       porque router.js já rodou show('admin') antes de admin.js registrar
       seu init. Se a sessão do Firebase Auth já tiver resolvido a essa
       altura (sessão "quente"/cache — comum, não hipotético: confirmado
       ocorrendo sob condições normais de mock local, e Firebase Auth real
       também pode resolver antes do DOMContentLoaded terminar de disparar
       para todos os scripts), essa chamada síncrona atravessa toda a cadeia
       initAdmin → faInitAvaliacaoProduto → sincronizarComHash →
       ativarAbaArquitetura ANTES de admin.js chegar às linhas seguintes da
       MESMA função, que são as que registram os addEventListener('click')
       dos botões de aba (inclusive o desta aba). Um btn.click() disparado
       aqui não tem NENHUM listener ainda — é um no-op silencioso: a
       avaliação carrega certinho por trás, mas a aba errada (a que já
       estava marcada 'active' no HTML estático) continua visível, e a
       pessoa vê a URL certa com o conteúdo errado. Por isso a ativação é
       feita diretamente aqui (mesma lógica do handler de clique em
       admin.js), em vez de depender de um listener que pode ainda não
       existir. */
    function ativarAbaArquitetura() {
      var btn = document.querySelector('.admin-tab-btn[data-panel="adminPanelArquitetura"]');
      if (!btn || btn.classList.contains('active')) return;
      document.querySelectorAll('.admin-tab-btn').forEach(function (b) { b.classList.remove('active'); });
      document.querySelectorAll('.admin-tab-panel').forEach(function (p) { p.classList.remove('active'); });
      btn.classList.add('active');
      var painel = document.getElementById('adminPanelArquitetura');
      if (painel) painel.classList.add('active');
    }
    /* Reage tanto à carga inicial quanto a QUALQUER mudança de hash (botão
       voltar/avançar do navegador, link colado). Deliberadamente não mexe
       em nada enquanto há um formulário em andamento (form-inicial/
       checklist) sem gravação: perder um rascunho por causa de uma mudança
       de hash que a própria pessoa não pediu seria pior do que ignorá-la. */
    function sincronizarComHash() {
      if (state.tela === 'form-inicial' || state.tela === 'checklist') return;
      var key = avpKeyDaHash();
      if (!key) {
        if (state.tela === 'resultado' || state.tela === 'nao-encontrada' || state.tela === 'sem-permissao') {
          state.atual = null;
          state.tela = 'lista';
          render();
        }
        return;
      }
      ativarAbaArquitetura();
      if (state.tela === 'resultado' && state.atual && state.atual._key === key) return; /* já é esta mesma avaliação — nada a fazer */
      if (!state.itensCarregados) return; /* os dados ainda não chegaram — a própria carga chama isto de novo ao terminar */
      if (state.erroCarga === 'permissao') { state.tela = 'sem-permissao'; render(); return; }
      if (state.erroCarga === 'geral') { state.tela = 'nao-encontrada'; state.atual = null; render(); return; }
      var it = buscarItem(key);
      if (!it || it.excluido) { state.tela = 'nao-encontrada'; state.atual = null; render(); return; }
      state.atual = clonarItem(it);
      state.decisaoForm = decisaoFormInicial(it);
      state.flashLista = null;
      state.flashResultado = null;
      state.flashDecisao = null;
      state.flashExportacao = null;
      state.tela = 'resultado';
      render();
    }
    window.addEventListener('hashchange', sincronizarComHash);

    function renderNaoEncontrada() {
      var msg = state.erroCarga === 'geral'
        ? 'Não foi possível carregar esta avaliação. Recarregue a página.'
        : 'Avaliação não encontrada.';
      wrap.innerHTML =
        '<div class="avp-form-card">' +
        '<p class="admin-empty">' + esc(msg) + '</p>' +
        '<div class="avp-actions-footer"><button class="btn btn--primary" id="avpVoltarNaoEncontrada">VOLTAR PARA A LISTA</button></div>' +
        '</div>';
      document.getElementById('avpVoltarNaoEncontrada').addEventListener('click', function () {
        state.tela = 'lista';
        irParaListaNaHash();
        render();
      });
    }
    function renderSemPermissao() {
      wrap.innerHTML =
        '<div class="avp-form-card">' +
        '<p class="admin-empty">Você não possui permissão para visualizar esta avaliação.</p>' +
        '<div class="avp-actions-footer"><button class="btn btn--primary" id="avpVoltarSemPermissao">VOLTAR PARA A LISTA</button></div>' +
        '</div>';
      document.getElementById('avpVoltarSemPermissao').addEventListener('click', function () {
        state.tela = 'lista';
        irParaListaNaHash();
        render();
      });
    }

    /* ===================== LISTA ===================== */
    function itemPassaFiltro(it) {
      if (temVersaoMaisNova(it._key)) return false;
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

      var ativos = state.itens.filter(function (it) { return !it.excluido && !temVersaoMaisNova(it._key); });
      var excluidos = state.itens.filter(function (it) { return !!it.excluido; });
      var chavesSelecionadas = Object.keys(state.selecionados).filter(function (k) { return state.selecionados[k]; });

      html += '<div class="avp-actions-bar">';
      html += '<span class="avp-total">' + ativos.length + ' avaliaç' + (ativos.length === 1 ? 'ão' : 'ões') + ' registrada' + (ativos.length === 1 ? '' : 's') + '</span>';
      if (!state.lixeira) html += '<button class="btn btn--primary" id="avpNovoBtn">+ Avaliar novo item</button>';
      if (!state.lixeira) {
        html += '<div class="avp-exportar-wrap">';
        html += '<button class="btn btn--sm" id="avpExportarBtn"' + (state.exportando ? ' disabled' : '') + '>' +
          (state.exportando ? 'Gerando arquivo…' : 'Exportar ▾') + '</button>';
        if (state.menuExportarAberto) {
          html += '<div class="avp-exportar-menu" id="avpExportarMenu">';
          html += '<button type="button" class="btn" id="avpExportarExcelFiltrados">📊 Excel — resultados filtrados (' + filtrados.length + ')</button>';
          html += '<button type="button" class="btn" id="avpExportarExcelTodas">📊 Excel — todas as avaliações (' + ativos.length + ')</button>';
          if (chavesSelecionadas.length) {
            html += '<button type="button" class="btn" id="avpExportarPdfSelecionadas">📄 PDF das selecionadas (' + chavesSelecionadas.length + ')</button>';
          }
          html += '</div>';
        }
        html += '</div>';
      }
      html += '<button class="btn btn--sm avp-lixeira-btn' + (state.lixeira ? ' active' : '') + '" id="avpLixeiraBtn">' +
        (state.lixeira ? '‹ Voltar' : '🗑 Lixeira (' + excluidos.length + ')') + '</button>';
      html += '</div>';
      if (state.flashExportacao) {
        html += '<p class="avp-export-status' + (state.flashExportacao.erro ? ' avp-export-status--erro' : '') + '">' +
          esc(state.flashExportacao.texto) + '</p>';
      }

      if (state.lixeira) {
        html += '<p class="avp-lixeira-aviso">🗑 Mostrando avaliações excluídas. Elas não são apagadas do banco — use "↺ Restaurar" para trazer de volta.</p>';
      } else {
        html += '<div class="avp-filters">';
        html += filtroSelect('avpFiltroResultado', state.filtro.resultado, [
          ['todos', 'Todos os resultados'], ['produto', 'É Produto/Serviço'], ['nao-produto', 'Não é Produto/Serviço Principal'], ['a-validar', 'A validar']
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
        var todosFiltradosSelecionados = filtrados.length > 0 && filtrados.every(function (it) { return !!state.selecionados[it._key]; });
        html += '<div class="table-scroll-wrap"><table class="admin-table avp-table"><thead><tr>' +
          '<th class="avp-check-col"><input type="checkbox" id="avpSelecionarTodos"' + (todosFiltradosSelecionados ? ' checked' : '') + ' aria-label="Selecionar todas as avaliações filtradas"></th>' +
          '<th>Item</th><th>Resultado automático</th><th>Decisão final</th><th>Classificação arquitetural</th>' +
          '<th>Responsável</th><th>Data</th><th>Status</th><th>Ações</th></tr></thead><tbody>';
        filtrados.forEach(function (it) {
          var decisao = it.decisaoFinal || it.resultadoAutomatico;
          var camadaLabel = (it.camadaSugerida && it.camadaSugerida.label) || '—';
          html += '<tr>';
          html += '<td class="avp-check-col"><input type="checkbox" class="avp-check-item" data-key="' + it._key + '"' +
            (state.selecionados[it._key] ? ' checked' : '') + ' aria-label="Selecionar ' + esc(it.nome) + '"></td>';
          html += '<td data-label="Item">' + esc(it.nome) + (it.versao > 1 ? ' <span class="avp-tag-versao">v' + it.versao + '</span>' : '') + '</td>';
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
        state.selecionados = {};
        state.menuExportarAberto = false;
        render();
      });

      var novoBtn = document.getElementById('avpNovoBtn');
      if (novoBtn) novoBtn.addEventListener('click', function () {
        state.atual = { nome: '', descricao: '', publico: '', necessidade: '', observacoesGerais: '', respostas: {} };
        state.reavaliacaoBase = null;
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

      wrap.querySelectorAll('.avp-check-item').forEach(function (chk) {
        chk.addEventListener('change', function () {
          if (chk.checked) state.selecionados[chk.dataset.key] = true;
          else delete state.selecionados[chk.dataset.key];
          render();
        });
      });
      var selecionarTodos = document.getElementById('avpSelecionarTodos');
      if (selecionarTodos) selecionarTodos.addEventListener('change', function () {
        filtrados.forEach(function (it) {
          if (selecionarTodos.checked) state.selecionados[it._key] = true;
          else delete state.selecionados[it._key];
        });
        render();
      });

      var exportarBtn = document.getElementById('avpExportarBtn');
      if (exportarBtn) exportarBtn.addEventListener('click', function () {
        state.menuExportarAberto = !state.menuExportarAberto;
        render();
      });
      var exportarExcelFiltrados = document.getElementById('avpExportarExcelFiltrados');
      if (exportarExcelFiltrados) exportarExcelFiltrados.addEventListener('click', function () {
        executarExportacaoExcel(filtrados, 'filtradas');
      });
      var exportarExcelTodas = document.getElementById('avpExportarExcelTodas');
      if (exportarExcelTodas) exportarExcelTodas.addEventListener('click', function () {
        executarExportacaoExcel(ativos, 'todas');
      });
      var exportarPdfSelecionadas = document.getElementById('avpExportarPdfSelecionadas');
      if (exportarPdfSelecionadas) exportarPdfSelecionadas.addEventListener('click', function () {
        var itensSelecionados = chavesSelecionadas.map(function (k) { return buscarItem(k); }).filter(Boolean);
        if (!itensSelecionados.length) return;
        executarExportacaoPdfLista(itensSelecionados);
      });
    }

    /* onde a exportação da LISTA de fato dispara a geração — nunca recalcula
       nada, só decide QUAIS itens (já carregados em state.itens) entram no
       arquivo, respeitando o filtro ou a seleção escolhida na tela. */
    function executarExportacaoExcel(itensParaExportar, sufixo) {
      if (state.exportando) return;
      state.exportando = 'excel';
      state.menuExportarAberto = false;
      state.flashExportacao = null;
      render();
      gerarExcel(itensParaExportar, state.itens, nomeArquivoExcel(sufixo), function (erro) {
        state.exportando = null;
        state.flashExportacao = erro
          ? { erro: true, texto: 'Não foi possível gerar o arquivo. Tente novamente.' }
          : { erro: false, texto: 'Arquivo gerado com sucesso.' };
        if (erro) console.error('[avaliacao-produto] erro ao gerar Excel:', erro);
        render();
      });
    }
    function executarExportacaoPdfLista(itensSelecionados) {
      if (state.exportando) return;
      state.exportando = 'pdf';
      state.menuExportarAberto = false;
      state.flashExportacao = null;
      render();
      var nome = itensSelecionados.length === 1 ? nomeArquivoPdf(itensSelecionados[0])
        : 'Avaliacoes_Produto_Servico_Selecionadas_' + dataParaNomeArquivo() + '.pdf';
      gerarPdf(itensSelecionados, nome, function (erro) {
        state.exportando = null;
        state.flashExportacao = erro
          ? { erro: true, texto: 'Não foi possível gerar o arquivo. Tente novamente.' }
          : { erro: false, texto: 'Arquivo gerado com sucesso.' };
        if (erro) console.error('[avaliacao-produto] erro ao gerar PDF da lista:', erro);
        render();
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
      if (v === 'nao-produto') return '<span class="avp-badge avp-badge--nao-produto">Não é Produto/Serviço Principal</span>';
      if (v === 'a-validar') return '<span class="avp-badge avp-badge--a-validar">A validar</span>';
      return '<span class="avp-badge">—</span>';
    }
    function statusBadge(v) {
      return v === 'concluido'
        ? '<span class="avp-badge avp-badge--concluido">Concluído</span>'
        : '<span class="avp-badge avp-badge--rascunho">Rascunho</span>';
    }

    function buscarItem(key) { return state.itens.filter(function (it) { return it._key === key; })[0]; }
    function clonarItem(it) { return JSON.parse(JSON.stringify(it)); }
    /* Uma versão "superada" (existe uma reavaliação mais nova apontando pra
       ela via versaoAnteriorKey) nunca aparece como linha própria na lista —
       nem ativa nem na Lixeira — só é alcançável pelo "Ver histórico" da
       versão atual. Isso é outra dimensão, à parte de excluído. */
    function temVersaoMaisNova(key) {
      return state.itens.some(function (o) { return o.versaoAnteriorKey === key; });
    }

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
      irParaAvaliacaoNaHash(key);
    }
    function abrirEdicao(key) {
      var it = buscarItem(key);
      if (!it) return;
      state.atual = clonarItem(it);
      if (!state.atual.respostas) state.atual.respostas = {};
      state.reavaliacaoBase = null;
      state.erroForm = null;
      state.camposInvalidos = [];
      state.pendenteId = null;
      state.flashLista = null;
      state.tela = 'checklist';
      render();
    }
    /* Reavaliar NÃO é duplicar nem começar do zero: reabre o MESMO item com
       a avaliação anterior inteira como ponto de partida — respostas e
       justificativas incluídas — e a pessoa decide o que mantém, muda ou
       apaga. Nada é limpo automaticamente. A avaliação anterior nunca é
       sobrescrita: a reavaliação vira um registro NOVO (chave nova,
       encadeado por itemId/versaoAnteriorKey em salvarRegistro), e o
       histórico completo continua acessível pelo "Ver histórico". */
    function abrirReavaliacao(key) {
      var it = buscarItem(key);
      if (!it) return;
      state.atual = clonarItem(it);
      delete state.atual._key;
      if (!state.atual.respostas) state.atual.respostas = {};
      state.atual.itemId = it.itemId || it._key;
      state.atual.versaoAnteriorKey = it._key;
      state.atual.versao = (it.versao || 1) + 1;
      /* criadoEm/responsavel são desta VERSÃO, não os da avaliação original
         — sem isto, salvarRegistro herdaria a data e a autoria de quem
         avaliou da primeira vez. */
      state.atual.criadoEm = null;
      state.atual.responsavel = null;
      state.atual.excluido = false;
      state.atual.excluidoEm = null;
      state.atual.excluidoPor = null;
      state.atual.justificativaExclusao = null;
      state.reavaliacaoBase = clonarItem(it);
      state.erroForm = null;
      state.camposInvalidos = [];
      state.pendenteId = null;
      state.flashLista = null;
      state.tela = 'checklist';
      render();
      irParaListaNaHash(); /* sai da rota da avaliação anterior — o rascunho da reavaliação não é persistente até ser concluído */
    }
    function duplicar(key) {
      var it = buscarItem(key);
      if (!it) return;
      state.atual = {
        nome: (it.nome || '') + ' (cópia)',
        descricao: it.descricao || '', publico: it.publico || '', necessidade: it.necessidade || '',
        observacoesGerais: '', respostas: {}
      };
      state.reavaliacaoBase = null;
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
      if (it.versaoAnteriorKey) {
        html += '<button class="btn avp-menu-item" data-acao="historico">🕘 Ver histórico</button>';
      }
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
          else if (acao === 'historico') abrirHistorico(key);
          else if (acao === 'excluir') abrirModalExcluir(key);
        });
      });
    }

    /* Percorre a cadeia de versaoAnteriorKey a partir de uma versão (sempre
       a mais nova, já que versões superadas não aparecem na lista) até a
       avaliação original, e mostra cada uma com data, resultado e
       responsável — sem alterar nada, só consulta. */
    function abrirHistorico(key) {
      var it = buscarItem(key);
      if (!it) return;
      var cadeia = [];
      var passo = it;
      var protecao = 0;
      while (passo && protecao < 50) {
        cadeia.unshift(passo);
        passo = passo.versaoAnteriorKey ? buscarItem(passo.versaoAnteriorKey) : null;
        protecao++;
      }
      var overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9999';
      var box = document.createElement('div');
      box.className = 'modal-box avp-historico-box';
      box.style.cssText = 'max-width:520px;width:92%;max-height:80vh;overflow:auto;padding:24px;display:flex;flex-direction:column;gap:14px';
      var html = '<p class="avp-menu-acoes-titulo">Histórico de "' + esc(it.nome) + '"</p>';
      html += '<div class="avp-historico-lista">';
      cadeia.forEach(function (versao) {
        var decisao = versao.decisaoFinal || versao.resultadoAutomatico;
        html += '<div class="avp-historico-item">';
        html += '<p class="avp-historico-cabecalho">' +
          '<strong>' + (versao.versao > 1 ? 'Reavaliação ' + versao.versao : 'Avaliação 1') + '</strong> — ' + fmtData(versao.criadoEm) + '</p>';
        html += '<p>' + resultadoBadge(decisao) + (versao.decisaoManual ? ' <span class="avp-tag-alterado">alterada</span>' : '') + ' · ' + statusBadge(versao.status) + '</p>';
        html += '<p class="avp-historico-resp">Por ' + esc(versao.responsavel && versao.responsavel.name || '—') + '</p>';
        html += '<button class="btn btn--sm avp-historico-ver" data-key="' + versao._key + '">Visualizar</button>';
        html += '</div>';
      });
      html += '</div>';
      html += '<button class="btn" id="avpHistoricoFechar">Fechar</button>';
      box.innerHTML = html;
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      function fechar() { if (overlay.parentNode) document.body.removeChild(overlay); }
      box.querySelector('#avpHistoricoFechar').addEventListener('click', fechar);
      overlay.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); fechar(); } });
      box.querySelectorAll('.avp-historico-ver').forEach(function (btn) {
        btn.addEventListener('click', function () { fechar(); abrirVisualizacao(btn.dataset.key); });
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
      var base = state.reavaliacaoBase;
      var reavaliando = !!base;
      var html = '<div class="avp-checklist">';
      html += '<button class="avp-voltar-link" id="avpVoltarLista">‹ Avaliações de Produto/Serviço</button>';
      html += '<div class="avp-form-card">';
      html += '<h3>' + esc(reavaliando ? 'Reavaliação — v' + a.versao : (a._key ? 'Editando avaliação' : 'Nova avaliação')) + '</h3>';
      if (reavaliando) {
        html += '<p class="avp-reavaliacao-intro">Esta reavaliação começa com as respostas e justificativas da avaliação anterior. ' +
          'Nada foi apagado — mantenha, altere ou apague o que quiser antes de concluir.</p>';
      }
      html += campoTexto('avpcNome', 'Nome do item', a.nome, true, false, temCampoInvalido('nome'));
      html += campoTexto('avpcDescricao', 'Descrição do item', a.descricao, false, true);
      html += campoTexto('avpcPublico', 'Público/cliente relacionado', a.publico, false, false);
      html += campoTexto('avpcNecessidade', 'Necessidade que o item pretende atender', a.necessidade, false, true);
      html += campoTexto('avpcObs', 'Observações (opcional)', a.observacoesGerais, false, true);
      html += '</div>';

      if (state.erroForm) html += '<p class="avp-error-msg">' + esc(state.erroForm) + '</p>';

      /* Progresso discreto (não muda o fluxo, é só um auxílio visual): quantas
         das 16 perguntas já têm resposta registrada nesta avaliação. */
      var respondidas = TODAS_PERGUNTAS.filter(function (p) { return a.respostas[p.id] && a.respostas[p.id].valor; }).length;
      html += '<p class="avp-progresso-perguntas">' + respondidas + ' de ' + TODAS_PERGUNTAS.length + ' perguntas respondidas</p>';

      /* "Atua dentro de outro Produto/Serviço" (funcionalidade) e "existe de
         forma independente de outro Produto/Serviço" (autonomia) não podem
         ser SIM ao mesmo tempo — quando isso acontece, destaca as duas
         perguntas em vez de deixar o resultado final ser a única pista. */
      var incoerenciaAtual = !!(a.respostas.autonomia && a.respostas.autonomia.valor === 'sim' &&
        a.respostas.funcionalidade && a.respostas.funcionalidade.valor === 'sim');

      html += '<h3 class="avp-secao-titulo">CRITÉRIOS PRINCIPAIS</h3>';
      html += '<p class="avp-secao-subtitulo">Perguntas 1 a ' + CRITERIOS.length + '</p>';
      html += '<div class="avp-criterios">';
      CRITERIOS.forEach(function (c) {
        html += renderPergunta(c, a.respostas[c.id], base && base.respostas[c.id], incoerenciaAtual && c.id === 'autonomia');
      });
      html += '</div>';

      html += '<div class="avp-exclusao-section">';
      html += '<h3 class="avp-exclusao-titulo">TESTES DE CLASSIFICAÇÃO</h3>';
      html += '<p class="avp-secao-subtitulo">Perguntas ' + (CRITERIOS.length + 1) + ' a ' + TODAS_PERGUNTAS.length + '</p>';
      html += '<p class="avp-exclusao-intro">Agora verifique se o item é, na realidade, outro tipo de elemento arquitetural.</p>';
      EXCLUSOES.forEach(function (e) {
        html += renderPergunta(e, a.respostas[e.id], base && base.respostas[e.id], incoerenciaAtual && e.id === 'funcionalidade');
      });
      html += '</div>';

      if (reavaliando) {
        var alteracoes = calcularAlteracoesReavaliacao(a, base);
        if (alteracoes) {
          html += '<div class="avp-form-card avp-alteracoes-card">';
          html += '<h4>Alterações nesta reavaliação</h4>';
          html += '<ul class="avp-alteracoes-list">';
          if (alteracoes.respostasAlteradas) {
            html += '<li>' + alteracoes.respostasAlteradas + ' resposta' + (alteracoes.respostasAlteradas === 1 ? '' : 's') +
              ' alterada' + (alteracoes.respostasAlteradas === 1 ? '' : 's') + '</li>';
          }
          if (alteracoes.justificativasModificadas) {
            html += '<li>' + alteracoes.justificativasModificadas + ' justificativa' + (alteracoes.justificativasModificadas === 1 ? '' : 's') +
              ' modificada' + (alteracoes.justificativasModificadas === 1 ? '' : 's') + '</li>';
          }
          html += '<li>Dados do item ' + (alteracoes.dadosAlterados ? 'alterados' : 'mantidos') + '</li>';
          html += '</ul></div>';
        }
      }

      html += '<div class="avp-actions-footer">';
      html += '<button class="btn" id="avpSalvarRascunhoBtn"' + (state.salvando ? ' disabled' : '') + '>' +
        (state.salvando === 'rascunho' ? 'SALVANDO…' : 'SALVAR RASCUNHO') + '</button>';
      html += '<button class="btn btn--primary" id="avpConcluirBtn"' + (state.salvando ? ' disabled' : '') + '>' +
        (state.salvando === 'concluido' ? 'SALVANDO…' : (reavaliando ? 'CONCLUIR REAVALIAÇÃO' : 'CONCLUIR AVALIAÇÃO')) + '</button>';
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
        /* Sem re-render a cada tecla (perderia o cursor); o resumo "Alterações
           nesta reavaliação" só precisa refletir o texto quando o campo perde
           o foco, e nesse ponto perder o foco não incomoda ninguém. */
        if (reavaliando) ta.addEventListener('blur', function () { render(); });
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
          state.reavaliacaoBase = null;
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
          state.reavaliacaoBase = null;
          state.flashResultado = '✓ Avaliação salva com sucesso.';
          state.tela = 'resultado';
          render();
          irParaAvaliacaoNaHash(key);
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
        state.reavaliacaoBase = null;
        state.tela = 'lista';
        render();
      });
    }

    function renderPergunta(def, resposta, respostaBase, incoerente) {
      var essencialClass = def.essencial ? ' avp-question--essencial' : '';
      var pendenteClass = state.pendenteId === def.id ? ' avp-question--pendente' : '';
      var incoerenteClass = incoerente ? ' avp-question--incoerente' : '';
      var html = '<div class="avp-question' + essencialClass + pendenteClass + incoerenteClass + '" id="avpQuestion-' + def.id + '">';
      if (pendenteClass) html += '<p class="avp-field-invalid-msg">Responda esta pergunta antes de concluir.</p>';
      if (incoerente) {
        html += '<p class="avp-field-invalid-msg avp-incoerencia-msg">⚠ Contradiz outra resposta do questionário (autonomia x funcionalidade). Revise.</p>';
      }
      html += '<div class="avp-question-head">';
      html += '<span class="avp-question-num">' + numeroGlobal(def) + '.</span>';
      if (def.destaque) html += '<span class="avp-badge avp-badge--essencial">' + esc(def.destaque) + '</span>';
      html += '<p class="avp-question-text">' + esc(def.pergunta) + '</p>';
      html += '<span class="avp-question-progresso">' + numeroGlobal(def) + '/' + TODAS_PERGUNTAS.length + '</span>';
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
        /* Reavaliação: a justificativa anterior nunca é apagada só porque a
           resposta mudou — só sinaliza, discretamente, que vale a pena
           revisar o texto (a pessoa decide manter, editar ou apagar). */
        if (respostaBase && respostaBase.valor && respostaBase.valor !== resposta.valor) {
          html += '<p class="avp-reavaliacao-alerta">↺ A resposta foi alterada. Revise a justificativa, se necessário.</p>';
        }
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
        /* itemId agrupa todas as versões do mesmo item; a primeira versão
           nunca teve reavaliação, então usa a própria chave. versao/
           versaoAnteriorKey (ambos ausentes fora de uma reavaliação) são
           quem monta a cadeia de histórico em abrirHistorico. */
        itemId: a.itemId || key,
        versao: a.versao || 1,
        versaoAnteriorKey: a.versaoAnteriorKey || null,
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
        alteradoEm: null,
        motorVersion: null,
        /* Uma reavaliação (chave nova) começa sem histórico de reprocessamento
           próprio — o historicoMotor pertence à recomendação automática desta
           versão específica, não é herdado da versão anterior (que mantém o
           seu, intacto, na sua própria chave). */
        historicoMotor: null
      };
      if (status === 'concluido') {
        var calc = computeResultado(a);
        payload.resultadoAutomatico = calc.resultadoAutomatico;
        payload.criteriosEssenciaisFalhos = calc.essenciaisFalhos;
        payload.exclusoesConflitantes = calc.exclusoesConflitantes;
        payload.criteriosAtendidos = calc.criteriosAtendidos;
        payload.camadaSugerida = calc.camadaSugerida;
        payload.justificativaAutomatica = gerarJustificativaAutomatica(a, calc);
        payload.motorVersion = MOTOR_VERSION;
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
        (resultado === 'a-validar' ? 'A VALIDAR' : 'NÃO É PRODUTO/SERVIÇO PRINCIPAL');
      var html = '<div class="avp-resultado">';
      html += '<button class="avp-voltar-link" id="avpVoltarListaResultado">‹ Avaliações de Produto/Serviço</button>';

      if (state.flashResultado) {
        html += '<div class="avp-flash-success" id="avpFlashResultado">' + esc(state.flashResultado) +
          ' <button type="button" class="avp-flash-close" id="avpFlashResultadoClose" aria-label="Fechar">×</button></div>';
      }

      html += '<div class="avp-result-card ' + cardClasse + '">';
      html += '<span class="avp-result-label">RESULTADO SOBRE PRODUTO/SERVIÇO</span>';
      html += '<h3 class="avp-result-nome">' + esc(a.nome) + (a.versao > 1 ? ' <span class="avp-tag-versao">v' + a.versao + '</span>' : '') + '</h3>';
      html += '<div class="avp-result-badge-grande">' + badgeTexto + '</div>';
      html += '<p class="avp-result-secundario">Critérios favoráveis a Produto/Serviço: ' + a.criteriosAtendidos + ' de ' + CRITERIOS.length + '</p>';
      if (a.versaoAnteriorKey) {
        html += '<button type="button" class="avp-historico-link" id="avpVerHistoricoResultado">🕘 Ver histórico de versões</button>';
      }
      html += '</div>';

      /* Aviso discreto — nunca bloqueia a leitura do resultado, só oferece a
         ação; ver reprocessarMotor/precisaReprocessar. Só para avaliação
         concluída (rascunho não tem recomendação automática nenhuma ainda). */
      if (precisaReprocessar(a)) {
        html += '<div class="avp-form-card avp-motor-aviso">';
        html += '<p class="avp-motor-aviso-texto">⚠ Esta avaliação foi processada por uma versão anterior do motor de classificação.</p>';
        html += '<button type="button" class="btn btn--sm" id="avpReprocessarBtn"' + (state.reprocessando ? ' disabled' : '') + '>' +
          (state.reprocessando ? 'Reprocessando…' : 'REPROCESSAR COM MOTOR ATUAL') + '</button>';
        html += '</div>';
      }

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
      if (camada.especializacao) {
        html += '<p class="avp-alt-label">Especialização: <strong>' + esc(camada.especializacao) + '</strong></p>';
      }
      if (camada.conflito && camada.conflito.length) {
        html += '<p class="avp-alt-outras">Categorias em conflito nas respostas: ' + esc(camada.conflito.join(', ')) + '.</p>';
      }
      if (camada.incoerencia) {
        html += '<p class="avp-alt-outras avp-incoerencia-msg">⚠ Há respostas que indicam autonomia e outras que indicam dependência. Revise os critérios destacados.</p>';
      }
      html += '</div>';

      if (camada.relacao) {
        html += '<div class="avp-form-card avp-relacao-card">';
        html += '<h4>Relação arquitetural</h4>';
        html += '<p>' + esc(camada.relacao) + '</p>';
        html += '</div>';
      }

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
      html += '<p class="avp-reasoning-sep avp-reasoning-sep--primeiro">Critérios principais — perguntas 1 a ' + CRITERIOS.length + '</p>';
      CRITERIOS.forEach(function (c) { html += renderRaciocinio(c, a.respostas[c.id], a); });
      html += '<p class="avp-reasoning-sep">Testes de classificação — perguntas ' + (CRITERIOS.length + 1) + ' a ' + TODAS_PERGUNTAS.length + '</p>';
      EXCLUSOES.forEach(function (e) { html += renderRaciocinio(e, a.respostas[e.id], a); });
      html += '</div></div>';

      html += renderHistoricoMotorCard(a);
      html += renderDecisaoCard(a);

      /* Ações organizadas num único grupo, sempre visível ao final da
         página: voltar para a lista, gerar PDF e reavaliar — em vez de um
         botão solto no topo sem relação clara com os demais. */
      html += '<div class="avp-actions-footer avp-result-actions-footer">';
      html += '<button class="btn" id="avpVoltarListaRodape">VOLTAR PARA A LISTA</button>';
      html += '<button class="btn btn--sm" id="avpGerarPdfBtn"' + (state.exportando ? ' disabled' : '') + '>' +
        (state.exportando === 'pdf' ? 'Gerando arquivo…' : '📄 GERAR PDF') + '</button>';
      html += '<button class="btn" id="avpReavaliarBtn">REAVALIAR</button>';
      html += '</div>';
      if (state.flashExportacao) {
        html += '<p class="avp-export-status' + (state.flashExportacao.erro ? ' avp-export-status--erro' : '') + '">' +
          esc(state.flashExportacao.texto) + '</p>';
      }

      html += '</div>';
      wrap.innerHTML = html;

      var flashResultadoClose = document.getElementById('avpFlashResultadoClose');
      if (flashResultadoClose) flashResultadoClose.addEventListener('click', function () { state.flashResultado = null; render(); });

      var verHistoricoResultado = document.getElementById('avpVerHistoricoResultado');
      if (verHistoricoResultado) verHistoricoResultado.addEventListener('click', function () { abrirHistorico(a._key); });

      var reprocessarBtn = document.getElementById('avpReprocessarBtn');
      if (reprocessarBtn) {
        reprocessarBtn.addEventListener('click', function () {
          if (state.reprocessando) return;
          avpConfirm(
            'Isso recalcula a recomendação automática (resultado, classificação, especialização e justificativa) ' +
            'usando a versão atual do motor de classificação, a partir das MESMAS respostas e justificativas já ' +
            'registradas — nenhuma resposta será alterada. A recomendação anterior fica preservada no histórico ' +
            'desta avaliação. Deseja continuar?',
            reprocessarMotor
          );
        });
      }

      document.getElementById('avpGerarPdfBtn').addEventListener('click', function () {
        if (state.exportando) return; /* clique repetido enquanto já está gerando: ignora */
        state.exportando = 'pdf';
        state.flashExportacao = null;
        render();
        gerarPdf([a], nomeArquivoPdf(a), function (erro) {
          state.exportando = null;
          state.flashExportacao = erro
            ? { erro: true, texto: 'Não foi possível gerar o arquivo. Tente novamente.' }
            : { erro: false, texto: 'Arquivo gerado com sucesso.' };
          if (erro) console.error('[avaliacao-produto] erro ao gerar PDF:', erro);
          render();
        });
      });

      document.getElementById('avpReavaliarBtn').addEventListener('click', function () { abrirReavaliacao(a._key); });

      function voltarParaLista() {
        state.atual = null;
        state.flashResultado = null;
        state.flashDecisao = null;
        state.flashExportacao = null;
        state.tela = 'lista';
        irParaListaNaHash();
        render();
      }
      document.getElementById('avpVoltarListaResultado').addEventListener('click', voltarParaLista);
      document.getElementById('avpVoltarListaRodape').addEventListener('click', voltarParaLista);
      bindDecisaoCard();
    }

    /* Mostra a resposta e as DUAS justificativas lado a lado, nunca uma no
       lugar da outra: a do avaliador (texto livre, digitado por quem
       preencheu) e a interpretação automática (contextualizada pela
       classificação final quando é o caso — ver interpretacaoSistema).
       Vale igualmente para os 7 critérios e para os 7 testes de exclusão —
       renderRaciocinio é a mesma função para as duas seções. */
    function renderRaciocinio(def, resposta, item) {
      if (!resposta) return '';
      var valor = resposta.valor === 'sim' ? 'SIM' : 'NÃO';
      var justificativaUsuario = (resposta.observacao || '').trim();
      return '<div class="avp-reasoning-item">' +
        '<p class="avp-reasoning-q">' + numeroGlobal(def) + '. ' + esc(def.titulo || def.pergunta) + ' — ' + valor + '</p>' +
        '<p class="avp-reasoning-user"><strong>Sua justificativa:</strong> ' +
          (justificativaUsuario ? esc(justificativaUsuario) : '<em>Nenhuma observação registrada pelo avaliador.</em>') + '</p>' +
        '<p class="avp-reasoning-auto"><strong>Interpretação do sistema:</strong> ' + esc(interpretacaoSistema(def, resposta, item)) + '</p>' +
        '</div>';
    }

    /* Recomendações automáticas SUBSTITUÍDAS por "REPROCESSAR COM MOTOR
       ATUAL" — nunca aparecem quando não há reprocessamento (historicoMotor
       ausente/vazio é o caso normal). Mostra a mais recente superada primeiro
       (a mais antiga fica lá embaixo), cada uma com a versão do motor que a
       produziu, o resultado/camada/especialização e a justificativa daquela
       época — nunca a atual, para não confundir qual era qual. */
    function renderHistoricoMotorCard(a) {
      if (!a.historicoMotor || !a.historicoMotor.length) return '';
      var html = '<div class="avp-form-card avp-historico-motor-card">';
      html += '<h4>Recomendações automáticas anteriores (motor desatualizado)</h4>';
      html += '<p class="avp-decisao-aviso">Substituídas ao reprocessar esta avaliação com uma versão mais nova do motor — as respostas do questionário nunca mudaram.</p>';
      a.historicoMotor.slice().reverse().forEach(function (h) {
        var camadaAntiga = h.camadaSugerida;
        html += '<div class="avp-historico-motor-item">';
        html += '<p class="avp-historico-motor-data">Calculada em ' + fmtData(h.processadoEm) +
          (h.motorVersion ? ' · motor ' + esc(h.motorVersion) : ' · motor sem versão registrada') + '</p>';
        html += '<p>' + esc(rotuloResultado(h.resultadoAutomatico)) +
          (camadaAntiga && camadaAntiga.label ? ' — ' + esc(camadaAntiga.label) : '') +
          (camadaAntiga && camadaAntiga.especializacao ? ' (' + esc(camadaAntiga.especializacao) + ')' : '') + '</p>';
        if (h.justificativaAutomatica) {
          html += '<p class="avp-historico-motor-justificativa">' + esc(h.justificativaAutomatica) + '</p>';
        }
        html += '</div>';
      });
      html += '</div>';
      return html;
    }

    function renderDecisaoCard(a) {
      var f = state.decisaoForm;
      var html = '<div class="avp-form-card avp-decisao-card">';
      html += '<h4>Decisão arquitetural</h4>';
      html += '<p class="avp-decisao-aviso">Isto registra uma decisão sobre a CONCLUSÃO, sem alterar nenhuma resposta do questionário — ' +
        'a recomendação automática permanece intacta no histórico. Para mudar respostas ou justificativas, use "Reavaliar" na lista.</p>';
      if (a.decisaoManual) {
        html += '<p class="avp-history-note">Alterado manualmente por <strong>' + esc(a.alteradoPor && a.alteradoPor.name || '—') +
          '</strong> em ' + fmtData(a.alteradoEm) + '. Justificativa registrada: "' + esc(a.justificativaDecisao || '') + '"</p>';
      }
      html += '<div class="avp-decisao-options">';
      html += decisaoOpcao('auto', 'Aceitar recomendação do sistema (' + rotuloResultado(a.resultadoAutomatico) + ')', f.opcao);
      html += decisaoOpcao('produto', 'Classificar manualmente como Produto/Serviço', f.opcao);
      html += decisaoOpcao('nao-produto', 'Classificar manualmente como não Produto/Serviço Principal', f.opcao);
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

    /* ===================== REPROCESSAR COM MOTOR ATUAL =====================
       DIFERENTE de "Reavaliar": aqui as respostas e as justificativas do
       avaliador não mudam em nada — só a recomendação automática (resultado,
       camada, especialização, justificativa consolidada) é recalculada com a
       versão ATUAL do motor sobre as MESMAS respostas já persistidas. Nunca
       pede pra responder o questionário de novo, nunca abre o checklist,
       nunca cria uma versão nova (mesma chave, sem versao+1/versaoAnteriorKey)
       — é só a lógica automática que avança, não o conteúdo da avaliação.
       A recomendação automática anterior nunca é descartada: migra para
       historicoMotor (mais antiga primeiro) antes de ser substituída, o
       mesmo princípio de "resultadoAutomatico nunca é reescrito" que já vale
       pra decisão manual. Se a avaliação nunca teve decisão manual
       (decisaoManual=false, "aceita a recomendação do sistema"), decisaoFinal
       acompanha a nova recomendação — exatamente como já acontece ao
       concluir/aceitar; havendo decisão manual, ela e toda a sua auditoria
       (responsável, data, justificativa) ficam intocadas: reprocessar o
       motor nunca apaga nem reinterpreta uma decisão que um humano já tomou. */
    function precisaReprocessar(it) {
      return !!it && it.status === 'concluido' && it.motorVersion !== MOTOR_VERSION;
    }
    function reprocessarMotor() {
      if (state.reprocessando) return;
      var a = state.atual;
      if (!precisaReprocessar(a)) return; /* já está na versão atual: nada a fazer */
      var calc = computeResultado(a);
      var novaJustificativa = gerarJustificativaAutomatica(a, calc);
      var entradaHistorico = {
        motorVersion: a.motorVersion || null,
        resultadoAutomatico: a.resultadoAutomatico,
        camadaSugerida: a.camadaSugerida,
        justificativaAutomatica: a.justificativaAutomatica,
        processadoEm: a.atualizadoEm || a.criadoEm
      };
      var updates = {
        resultadoAutomatico: calc.resultadoAutomatico,
        criteriosEssenciaisFalhos: calc.essenciaisFalhos,
        exclusoesConflitantes: calc.exclusoesConflitantes,
        criteriosAtendidos: calc.criteriosAtendidos,
        camadaSugerida: calc.camadaSugerida,
        justificativaAutomatica: novaJustificativa,
        motorVersion: MOTOR_VERSION,
        historicoMotor: (a.historicoMotor || []).concat([entradaHistorico]),
        atualizadoEm: new Date().toISOString()
      };
      /* "Aceitar recomendação do sistema" segue significando isso mesmo depois
         de reprocessado: decisaoFinal acompanha a nova recomendação. Uma
         decisão manual já registrada, ao contrário, não é uma opinião sobre O
         MOTOR — é uma divergência sobre a conclusão, e continua valendo até
         alguém trocá-la explicitamente em "Decisão arquitetural". */
      if (!a.decisaoManual) updates.decisaoFinal = calc.resultadoAutomatico;

      state.reprocessando = true;
      render();

      var respondido = false;
      var relogio = setTimeout(function () {
        if (respondido) return;
        respondido = true;
        state.reprocessando = false;
        avpAlert('A conexão está demorando e não deu para confirmar o reprocessamento. Toque em "REPROCESSAR COM MOTOR ATUAL" de novo.');
        render();
      }, 12000);

      db().ref(NODE + '/' + a._key).update(updates, function (err) {
        if (respondido) return;
        respondido = true;
        clearTimeout(relogio);
        state.reprocessando = false;
        if (err) {
          console.error('[avaliacao-produto] erro ao reprocessar com o motor atual:', err);
          render();
          avpAlert('Não foi possível reprocessar esta avaliação. Tente novamente.');
          return;
        }
        Object.assign(a, updates);
        state.itens = upsertItem(state.itens, clonarItem(a));
        state.flashResultado = '✓ Avaliação reprocessada com a versão atual do motor de classificação.';
        render();
      });
    }

    /* ===================== CARGA ===================== */
    db().ref(NODE).on('value', function (snap) {
      var arr = [];
      snap.forEach(function (c) { arr.push(Object.assign({ _key: c.key }, c.val())); });
      arr.sort(function (x, y) { return (y.atualizadoEm || '').localeCompare(x.atualizadoEm || ''); });
      state.itens = arr;
      state.itensCarregados = true;
      state.erroCarga = null;
      if (state.tela === 'lista') render();
      sincronizarComHash(); /* resolve um #admin?avp=<key> pendente (F5, link direto) assim que os dados chegarem */
    }, function (err) {
      state.itensCarregados = true;
      /* Todo o node avaliacoes-produto já exige admin de verdade nas regras
         do Firebase (ver database.rules.json) — chegar aqui sem ser admin só
         é alcançável na prática se a sessão mudar no meio da visita; ainda
         assim, distinguir os dois casos evita confundir "sem acesso" com
         "fora do ar" quando alguém abre um link direto de avaliação. */
      state.erroCarga = (err && err.code === 'PERMISSION_DENIED') ? 'permissao' : 'geral';
      if (state.tela === 'lista' && !avpKeyDaHash()) {
        wrap.innerHTML = '<p class="admin-empty" style="color:var(--red)">Erro ao carregar avaliações. Recarregue a página.</p>';
      }
      sincronizarComHash();
    });

    /* Na carga inicial (F5, link direto, nova aba), se a URL já pede uma
       avaliação específica, a PRIMEIRA renderização não pode cair no default
       'lista' — a leitura de avaliacoes-produto ainda nem começou a
       responder nesse instante, então mostrar a lista (vazia) aqui é
       mostrar um estado que nunca existiu de verdade. 'carregando' cobre
       exatamente essa janela; sincronizarComHash() (chamado tanto agora
       quanto de novo quando os dados chegarem) decide o destino final. */
    if (avpKeyDaHash()) {
      state.tela = 'carregando';
      /* Rede travada é condição normal (ver CLAUDE.md), não caso raro — sem
         este relógio, uma leitura que nunca responde deixava "Carregando
         avaliação…" para sempre, sem nenhuma saída (mesmo padrão já usado em
         salvarRegistro e no socorro de auth do router.js). */
      setTimeout(function () {
        if (state.tela === 'carregando' && !state.itensCarregados) {
          state.carregandoTravado = true;
          render();
        }
      }, 12000);
    }
    render();
    sincronizarComHash(); /* ativa a aba Arquitetura e tenta resolver um link direto já na carga inicial */
  };
})();
