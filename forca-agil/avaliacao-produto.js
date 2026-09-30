/* ============================================================
   Força Ágil — Avaliação de Produto/Serviço (aba Arquitetura, admin)

   Checklist arquitetural para decidir se um item da organização deve
   ser classificado como Produto/Serviço. Node do Firebase:
   avaliacoes-produto/<key> = {
     nome, descricao, publico, necessidade, observacoesGerais,
     especializacaoCadastrada: texto livre opcional | null — metadado
       arquitetural CADASTRADO à parte (nunca inferido das 16 respostas nem
       de uma pergunta nova, ambas proibidas); quando presente, tem
       precedência sobre a especialização calculada pelo questionário para
       qualquer camada do eixo (ver CAMADAS_COM_ESPECIALIZACAO,
       especializacaoPara) — é assim que "Instituto previdenciário" aparece
       para uma Unidade de valor associada sem o motor precisar adivinhar
       isso das respostas, que não distinguem tipos de Unidade de Valor,
     papelEstruturalCadastrado: 'essencial' | 'opcional' | null — metadado
       CADASTRADO à parte (nunca inferido das respostas nem do nome do
       item), terceira dimensão independente de classificação/especialização,
       hoje só relevante para Componente (ver CAMADAS_COM_PAPEL_ESTRUTURAL,
       papelEstruturalPara) — "Essencial"/"Opcional" nunca são classificações
       à parte, só um atributo a mais sobre um Componente já identificado,
     respostas: { <criterioId|exclusaoId>: { valor:'sim'|'nao', justificativaAuto, observacao } },
     status: 'rascunho' | 'concluido',
     resultadoAutomatico: 'produto' | 'nao-produto' | 'a-validar' | null (null em rascunho),
     criteriosEssenciaisFalhos: [id...], exclusoesConflitantes: [id...],
     criteriosAtendidos: número de critérios (não exclusões) respondidos SIM,
     camadaSugerida: { id, label, motivos: [texto...], conflito: [label...]|null } | null,
     justificativaAutomatica: texto,
     decisaoFinal: 'produto' | 'nao-produto' | 'a-validar' (igual à automática até o admin discordar),
     decisaoManual, justificativaDecisao, alteradoPor: {name,email}, alteradoEm,
     naturezaComplementar: { id, rotulo } | null — informação MANUAL opcional
       (ex.: "Programa transversal") registrada só numa decisão manual; fora
       do motor (ver NATUREZAS_COMPLEMENTARES),
     decisaoConfirmada: boolean — só controla o botão "SALVAR DECISÃO"
       (jaSalvouAntes): true assim que alguém clica em salvar, seja aceitando
       a recomendação automática (decisaoManual fica false) seja divergindo
       dela (decisaoManual fica true) — sem isto, aceitar explicitamente a
       recomendação mostrava "✓ Decisão salva com sucesso." mas, ao recarregar
       a tela, o botão voltava a "SALVAR DECISÃO" como se nada tivesse sido
       salvo, porque jaSalvouAntes dependia só de decisaoManual (que
       continua false nesse caso, corretamente, para todo o resto: filtro
       "alterada manualmente", Excel, PDF, reprocessarMotor),
     responsavel: {name,email}, criadoEm, atualizadoEm,
     itemId: chave da 1ª versão (agrupa todas as versões do mesmo item),
     versao: número (1 na avaliação original, incrementa a cada reavaliação),
     versaoAnteriorKey: chave da versão da qual esta foi reavaliada, ou null,
     motorVersion: versão do motor (MOTOR_VERSION) vigente quando a
       recomendação automática atual foi calculada — ausente em avaliações
       concluídas antes deste campo existir (tratado como "motor antigo"),
     historicoMotor: [{ motorVersion, resultadoAutomatico, camadaSugerida,
       justificativaAutomatica, respostas, processadoEm }...] | ausente —
       cada recomendação automática SUBSTITUÍDA por "REPROCESSAR COM MOTOR
       ATUAL" (individual ou em lote), mais antiga primeiro; respostas é uma
       cópia de como cada pergunta estava calculada por aquela versão do
       motor (SIM/NÃO e observação nunca mudam, mas a "Interpretação do
       sistema" pode — essa cópia preserva a redação de antes),
     reprocessedAt: ISO string | null — quando a recomendação atual foi
       produzida por um reprocessamento (individual ou em lote); ausente/null
       numa avaliação que nunca foi reprocessada,
     reprocessedFromVersion: string | null — motorVersion de que ela veio
       antes do último reprocessamento; ausente/null se nunca reprocessada,
     bloqueadaParaReprocessamentoAutomatico: boolean | ausente — metadado
       cadastrado à parte (nunca inferido do nome do item) que impede só o
       reprocessamento EM LOTE ("REPROCESSAR TUDO COM MOTOR ATUAL") de tocar
       nesta avaliação — para casos cuja classificação arquitetural ainda
       está em definição conceitual. O botão INDIVIDUAL "REPROCESSAR COM
       MOTOR ATUAL" continua funcionando normalmente mesmo bloqueada: é uma
       ação explícita de quem está olhando aquela avaliação, diferente de um
       lote automático sobre avaliações que ninguém está revisando uma a uma
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

  /* IDENTIDADE/REGRA das 16 perguntas — nunca texto exibido ao usuário.
     id: chave interna usada por todo o motor (identificarCamada, respostas
     persistidas) — NUNCA renomeada, mesmo que a redação da pergunta mude,
     para não exigir migração de dados de avaliações já gravadas.
     codigoEstavel: identificador PÚBLICO e estável (P1..P16) usado pelo
     módulo de configuração (window.faQuestionarios), pelo snapshot de cada
     resposta e pela auditoria — é o "nome de fábrica" da pergunta, imutável
     por configuração (só existe em código).
     essencial/ordem/destaque: regra/peso da pergunta para o motor —
     também imutáveis por configuração. Título, texto da pergunta, ajuda,
     exemplo e as duas justificativas automáticas (SIM/NÃO) NÃO estão mais
     aqui: são conteúdo editorial, parametrizado e versionado por
     window.faQuestionarios (ver conteudoDe) — alterar essa redação nunca
     precisa de PR nem de deploy, e nunca muda o que está declarado nesta
     lista. */
  var CRITERIOS = [
    { id: 'necessidade', codigoEstavel: 'P1', essencial: true, ordem: 1 },
    { id: 'resultado', codigoEstavel: 'P2', essencial: true, ordem: 2, destaque: 'CRITÉRIO ESSENCIAL' },
    { id: 'solucao', codigoEstavel: 'P3', essencial: true, ordem: 3 },
    { id: 'fronteira', codigoEstavel: 'P4', essencial: true, ordem: 4 },
    { id: 'autonomia', codigoEstavel: 'P5', essencial: true, ordem: 5, destaque: 'CRITÉRIO DECISIVO' },
    { id: 'jornada', codigoEstavel: 'P6', essencial: false, ordem: 6 },
    { id: 'medicao', codigoEstavel: 'P7', essencial: false, ordem: 7 },
    { id: 'gestao', codigoEstavel: 'P8', essencial: false, ordem: 8 }
  ];

  var EXCLUSOES = [
    { id: 'canal', codigoEstavel: 'P9', ordem: 1, classificacao: 'Canal' },
    { id: 'artefato', codigoEstavel: 'P10', ordem: 2, classificacao: 'Artefato informacional' },
    { id: 'capacidade', codigoEstavel: 'P11', ordem: 3, classificacao: 'Capacidade' },
    { id: 'processo', codigoEstavel: 'P12', ordem: 4, classificacao: 'Processo/Etapa de processo' },
    { id: 'modalidade', codigoEstavel: 'P13', ordem: 5, classificacao: 'Modalidade/opção' },
    { id: 'regra', codigoEstavel: 'P14', ordem: 6, classificacao: 'Regra/condição' },
    { id: 'componente', codigoEstavel: 'P15', ordem: 7, classificacao: 'Componente' },
    { id: 'funcionalidade', codigoEstavel: 'P16', ordem: 8, classificacao: 'Funcionalidade/Operação' }
  ];

  /* Código do questionário no módulo de configuração (window.faQuestionarios)
     — CLASSIFICACAO_ARQUITETURAL é o único usado por este arquivo; o
     questionário ADEQUACAO_SQUAD (S1-S8) tem tela própria. */
  var CODIGO_QUESTIONARIO = 'CLASSIFICACAO_ARQUITETURAL';

  /* Única porta de leitura de conteúdo editorial (título/texto/ajuda/
     exemplo/justificativas) para qualquer pergunta de P1 a P16 — em
     código nenhum outro lugar lê essas propriedades de CRITERIOS/EXCLUSOES
     diretamente (elas não existem mais lá). versao ausente = versão atual
     publicada agora mesmo (uso típico: checklist em andamento, antes de
     responder); versao explícita = usada para reconstruir o texto de uma
     avaliação específica (a sua própria questionnaireContentVersion). */
  function conteudoDe(def, versao) {
    return window.faQuestionarios.conteudoPergunta(CODIGO_QUESTIONARIO, def.codigoEstavel, versao);
  }

  /* Para uma pergunta JÁ RESPONDIDA, prefere sempre o snapshot gravado na
     própria resposta (textoPerguntaNaEpoca/tituloNaEpoca — ver o clique de
     SIM/NÃO em renderChecklist) — é a única fonte fiel do que a pessoa viu
     no momento em que respondeu, mesmo que o conteúdo já tenha sido
     republicado depois. Só cai em conteudoDe (versão vigente na época da
     AVALIAÇÃO, nunca a mais recente) quando não existe snapshot — avaliação
     legada, de antes deste snapshot existir (ver item 21: nunca inventa,
     só usa o fallback de apresentação). */
  function conteudoSnapshotOuAtual(def, resposta, item) {
    if (resposta && resposta.textoPerguntaNaEpoca) {
      return { titulo: resposta.tituloNaEpoca || null, texto: resposta.textoPerguntaNaEpoca };
    }
    return conteudoDe(def, item && item.questionnaireContentVersion);
  }

  /* Replica o comportamento visual que já existia antes deste módulo (nunca
     um requisito novo): os 8 critérios principais (P1-P8) sempre tiveram um
     título curto próprio, mostrado no PDF e em "Como chegamos a essa
     conclusão"; os 8 testes de classificação (P9-P16) nunca tiveram título
     próprio nesses dois lugares, então sempre mostraram a pergunta inteira.
     Isso é uma decisão de APRESENTAÇÃO ligada à identidade da pergunta
     (é critério ou é teste de classificação?), não conteúdo editorial —
     por isso fica em código, e não é afetada por o admin cadastrar (ou não)
     um "título" para P9-P16 na tela de configuração. */
  function rotuloCompacto(def, conteudo) {
    return CRITERIOS.indexOf(def) !== -1 ? (conteudo.titulo || conteudo.texto) : conteudo.texto;
  }

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

  /* NATUREZA COMPLEMENTAR — informação MANUAL, opcional, registrada junto da
     decisão arquitetural. Não é uma camada: não entra em CAMADAS, não tem
     precedência, nunca é lida por identificarCamada/computeResultado nem
     por reprocessar/reconciliar, e nunca é inferida das respostas. Serve
     para dizer, por exemplo, que um item que o motor recomenda "A validar"
     (e que a pessoa decidiu tratar como "não Produto/Serviço principal") é
     um programa que reúne várias iniciativas — sem criar uma categoria
     automática nova só para encaixar esse caso.
     Lista ÚNICA, em um só lugar (não existe hoje uma infraestrutura de
     listas parametrizáveis para este tipo de dado; criá-la exigiria um nó
     novo no banco, regras e tela de administração). O registro guarda o id
     E o rótulo da época, então renomear/ajustar a lista depois nunca
     reescreve decisões já registradas. */
  var NATUREZAS_COMPLEMENTARES = [
    { id: 'programa-transversal', label: 'Programa transversal' },
    { id: 'programa', label: 'Programa' },
    { id: 'iniciativa', label: 'Iniciativa' },
    { id: 'agrupador', label: 'Agrupador' },
    { id: 'outro', label: 'Outro' }
  ];
  function naturezaPorId(id) { return NATUREZAS_COMPLEMENTARES.filter(function (n) { return n.id === id; })[0] || null; }
  /* Registro a gravar ({id, rotulo}) — null para vazio ou id desconhecido. */
  function registroNatureza(id) {
    var n = naturezaPorId(id);
    return n ? { id: n.id, rotulo: n.label } : null;
  }
  /* Rótulo a exibir de um item: o da época (snapshot), nunca o da lista atual. */
  function rotuloNaturezaDoItem(it) {
    var n = it && it.naturezaComplementar;
    if (!n) return '';
    return n.rotulo || (naturezaPorId(n.id) && naturezaPorId(n.id).label) || '';
  }

  /* Versão do motor de classificação (identificarCamada + motivoJustificativa/
     gerarJustificativaAutomatica). Incrementar SEMPRE que uma mudança nessas
     funções puder alterar o resultado, a camada, a especialização ou o texto
     da justificativa consolidada de respostas JÁ gravadas — nunca por uma
     mudança cosmética alheia ao motor (CSS, PDF, etc.).

     REDAÇÃO DA "INTERPRETAÇÃO DO SISTEMA" NÃO VERSIONA O MOTOR. Desde que
     título/texto/ajuda/justSim/justNao são parametrizados
     (questionarios-config.js), uma mudança apenas editorial cria uma versão
     NOVA DE CONTEÚDO do questionário (questionnaireContentVersion) — eixo
     independente deste. reprocessarMotor recalcula a interpretação de cada
     resposta pela versão de conteúdo JÁ FIXADA na própria avaliação
     (recalcularInterpretacoesRespostas), então corrigir um texto nunca
     muda o que uma avaliação antiga mostra e nunca exige incrementar esta
     constante nem motorVersionArquitetura: só quem é INICIADA depois da
     publicação (ou reavaliada) usa a redação nova. Incremente esta
     constante apenas quando a LÓGICA (identificarCamada) ou a prosa
     hardcoded que ela compõe (motivoJustificativa etc.) mudar de um jeito
     que altere o resultado ou a justificativa consolidada.

     Cada avaliação concluída grava a versão vigente no momento em que a
     recomendação automática foi calculada (item.motorVersion); a tela de
     resultado compara com esta constante para saber se existe uma versão
     mais nova do motor e oferecer "REPROCESSAR COM MOTOR ATUAL" — nunca
     reprocessa sozinha, e nunca exige responder o questionário de novo (ver
     reprocessarMotor). */
  var MOTOR_VERSION = '2026.09.29-2';

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
  /* papelEstruturalCadastrado só aceita os dois valores reais do cadastro —
     qualquer outra coisa (vazio, lixo digitado) vira null ("não determinado"
     na tela), nunca um valor inventado. */
  function normalizarPapelEstrutural(v) {
    var norm = String(v || '').trim().toLowerCase();
    return (norm === 'essencial' || norm === 'opcional') ? norm : null;
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
     classificação principal (ver especializacaoPara). Seis camadas com esse
     eixo hoje: Componente (opção/configuração — a única com um sinal real no
     questionário, "modalidade"), Unidade de valor associada (institutos/
     benefícios), Funcionalidade/Operação (formas de vinculação), Regra/Opção
     (políticas do plano), Informação/Documento (informações da reserva) e
     Produto/Serviço principal (Produto vs. Serviço — nenhuma pergunta do
     questionário distingue os dois, e a classificação em si já significa
     "tem autonomia estrutural", então a especialização aqui só pode vir de
     cadastro, nunca inferida). Sem pergunta nova para distinguir nenhuma
     delas (item explicitamente proibido: não alterar o questionário), todas
     sempre mostram "não determinada pelo questionário" até serem cadastradas
     — isso NUNCA vira A validar, é só uma informação a menos, não um
     conflito. Produto/Serviço principal entrou nesta lista só para permitir
     o CADASTRO (ex.: "Serviço", "Produto") a quem já sabe essa informação
     por outra fonte — identificarCamada continua decidindo QUAL camada o
     item é sem olhar para isso, e nenhuma avaliação já concluída precisa ser
     reprocessada por causa desta mudança (ver rotuloEspecializacaoApresentacao). */
  var CAMADAS_COM_ESPECIALIZACAO = ['componente', 'unidade-valor-associada', 'funcionalidade-operacao', 'regra-condicao', 'documento-informacao', 'produto-principal'];
  var ESPECIALIZACAO_NAO_DETERMINADA = 'não determinada pelo questionário';

  /* Terceira dimensão, independente de classificação e especialização —
     hoje só faz sentido para Componente (é a única camada em que "essencial
     vs. opcional" descreve algo concreto: um componente que falta impede a
     solução principal de funcionar, ou não). Essencial/Opcional NUNCA são
     classificações à parte ("Componente essencial" não existe como camada)
     — são só um atributo a mais sobre um Componente já identificado, e só
     vêm de metadado/cadastro confiável, nunca inferidos das respostas nem
     do nome do item (ex.: o fato de o participante poder escolher/alterar
     não basta para inferir "Opcional" sozinho). Continua só para Componente
     — nenhuma camada nova ganhou a possibilidade de CADASTRAR um papel
     estrutural neste ajuste; a linha "Papel estrutural" passou só a
     aparecer SEMPRE na apresentação (tela/PDF), com "não determinado" como
     texto para qualquer camada fora desta lista (ver
     rotuloPapelEstruturalApresentacao). */
  var CAMADAS_COM_PAPEL_ESTRUTURAL = ['componente'];
  var PAPEL_ESTRUTURAL_NAO_DETERMINADO = 'não determinado';

  /* Normalização de APRESENTAÇÃO (tela, PDF — nunca calcula, nunca persiste):
     a linha de Especialização/Papel estrutural aparece SEMPRE, para
     qualquer classificação arquitetural, nunca escondida por causa da
     camada (ajuste de consistência: antes, o `if (camada.especializacao)`/
     `if (camada.papelEstrutural)` em cada ponto de renderização escondia a
     linha inteira sempre que o valor vinha null — exatamente o caso de toda
     camada fora de CAMADAS_COM_ESPECIALIZACAO/CAMADAS_COM_PAPEL_ESTRUTURAL,
     inclusive Produto/Serviço principal antes desta mudança). O fallback é
     só de exibição — nunca grava nada em camadaSugerida nem exige
     reprocessamento para as avaliações já concluídas mostrarem o texto
     padrão no lugar de uma linha ausente. */
  function rotuloEspecializacaoApresentacao(camada) {
    return (camada && camada.especializacao) || ESPECIALIZACAO_NAO_DETERMINADA;
  }
  function rotuloPapelEstruturalApresentacao(camada) {
    return (camada && camada.papelEstrutural) || PAPEL_ESTRUTURAL_NAO_DETERMINADO;
  }

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
  /* Mapa id interno ↔ codigoEstavel (P1-P16), único ponto de tradução entre
     a estrutura interna de avaliacoes-produto (respostas por id: necessidade,
     resultado...) e o motor declarativo (window.faMotorArquitetura, que só
     conhece P1-P16 — nunca id interno, nunca texto). */
  var ID_POR_CODIGO = {};
  TODAS_PERGUNTAS.forEach(function (def) { ID_POR_CODIGO[def.codigoEstavel] = def.id; });

  /* identificarCamada é agora um WRAPPER FINO: a decisão de QUAL camada
     (e motivos/conflito/incoerência) vem de window.faMotorArquitetura —
     motor declarativo, versionado e auditável (ver motor-arquitetura.js),
     migrado a partir desta mesma função por tradução LITERAL condição por
     condição (equivalência comprovada exaustivamente sobre as 65536
     combinações possíveis das 16 respostas — ver
     check-motor-arquitetura-equivalencia.js — antes deste wrapper passar a
     depender dele). especializacaoPara/papelEstruturalPara continuam
     EXATAMENTE como antes — metadado de CADASTRO, nunca inferido das
     respostas nem tocado por esta migração (proibido por especificação). */
  function identificarCamada(atual) {
    var r = atual.respostas || {};
    function sim(id) { return !!(r[id] && r[id].valor === 'sim'); }
    var modalidade = sim('modalidade');

    var exclusoesSim = EXCLUSOES.filter(function (e) { return sim(e.id); }).map(function (e) { return e.id; });
    function motivo(id) { return ROTULOS_SINAL[id] + ': ' + (sim(id) ? 'SIM' : 'NÃO'); }

    function especializacaoPara(camadaId) {
      if (CAMADAS_COM_ESPECIALIZACAO.indexOf(camadaId) === -1) return null;
      var cadastrada = (atual.especializacaoCadastrada || '').trim();
      if (cadastrada) return cadastrada;
      if (camadaId === 'componente' && modalidade) return 'Opção/configuração de personalização';
      return ESPECIALIZACAO_NAO_DETERMINADA;
    }
    function papelEstruturalPara(camadaId) {
      if (CAMADAS_COM_PAPEL_ESTRUTURAL.indexOf(camadaId) === -1) return null;
      var cadastrado = (atual.papelEstruturalCadastrado || '').trim().toLowerCase();
      if (cadastrado === 'essencial') return 'Essencial';
      if (cadastrado === 'opcional') return 'Opcional';
      return PAPEL_ESTRUTURAL_NAO_DETERMINADO;
    }

    /* Contexto P1-P16 para o motor declarativo — nunca o inverso (o motor
       nunca vê id interno nem texto de pergunta). */
    var contexto = {};
    TODAS_PERGUNTAS.forEach(function (def) { contexto[def.codigoEstavel] = sim(def.id) ? 'SIM' : 'NAO'; });
    var regras = window.faMotorArquitetura.regrasDaVersao(window.faMotorArquitetura.versaoAtual());
    var decisao = window.faMotorArquitetura.identificarCamada(contexto, regras);

    var motivos = decisao.motivosCodigos.map(function (codigo) { return motivo(ID_POR_CODIGO[codigo]); });
    var conflito = decisao.conflito ? decisao.conflito.map(function (camId) { return camadaPorId(camId).label; }) : null;

    return {
      camada: decisao.camada, motivos: motivos, conflito: conflito, incoerencia: decisao.incoerencia,
      especializacao: especializacaoPara(decisao.camada), papelEstrutural: papelEstruturalPara(decisao.camada),
      exclusoesSim: exclusoesSim
    };
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
        return 'Pertence estruturalmente a um Produto/Serviço maior, mas constitui uma Unidade de Valor com resultado próprio, fronteira, jornada e mensuração identificáveis para o cliente.';
      case 'funcionalidade-operacao':
        var alvo = sim('modalidade') ? 'uma modalidade/opção/configuração' :
          sim('regra') ? 'uma regra/condição' :
          sim('processo') ? 'um processo' :
          sim('componente') ? 'um componente' : 'um elemento';
        return 'Atua sobre ' + alvo + ' pertencente a outro Produto/Serviço — não existe de forma independente dele.';
      case 'modalidade-subproduto':
        return 'É uma modalidade/opção/configuração pertencente a outro Produto/Serviço, e não uma ação sobre ela.';
      case 'componente':
        /* "elemento configurável" só descreve um componente de verdade
           configurável (sinal real: modalidade/opção/configuração = SIM,
           P13) — usá-la sempre, mesmo quando o único sinal foi "existe para
           outro Produto/Serviço entregar resultado" (P15), inventaria uma
           natureza de configuração que a resposta não sustenta. Sem esse
           sinal, a redação genérica de Componente ("elemento da solução")
           não afirma nada que as respostas não confirmem. */
        return sim('modalidade')
          ? 'Pertence estruturalmente a outro Produto/Serviço e funciona como elemento configurável da solução, sem autonomia para existir como solução independente.'
          : 'Pertence estruturalmente a outro Produto/Serviço e atua como elemento da solução, sem autonomia para existir como solução independente.';
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
    'componente': 'componente da solução',
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
    /* NÃO existe (mais) um texto especial para P15 = NÃO quando P5 = NÃO: ele
       afirmava "embora dependa estruturalmente de outro Produto/Serviço…"
       — uma conclusão tirada de OUTRA pergunta (P5) que contradizia a
       própria resposta dada em P15 (achado real: item respondido com P5 =
       NÃO e P15 = NÃO, com a justificativa de que o programa não está
       subordinado a outro Produto/Serviço, exibia dependência estrutural).
       Princípio: a interpretação de uma pergunta explica o significado
       DAQUELA resposta (justSim/justNao, parametrizados em
       questionarios-config.js), nunca infere respostas de outras perguntas.
       P5 = NÃO só diz que a autonomia estrutural não foi demonstrada — não
       quer dizer P15 = SIM, nem "depende de outro Produto/Serviço". */
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
        papelEstrutural: ident.papelEstrutural,
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
    /* Mesmo princípio da especialização: só entra na frase corrida quando é
       uma determinação real (cadastrada, nunca inferida das respostas) —
       "não determinado" já tem campo próprio na tela e não deve soar como
       ressalva dentro da justificativa. Só existe para Componente hoje (ver
       CAMADAS_COM_PAPEL_ESTRUTURAL), então só compõe a frase nessa camada. */
    var papelEstruturalReal = camada.papelEstrutural && camada.papelEstrutural !== PAPEL_ESTRUTURAL_NAO_DETERMINADO;
    var papelEstruturalFrase = papelEstruturalReal ? ' Papel estrutural: ' + camada.papelEstrutural + '.' : '';

    /* Componente tem um texto próprio (3 frases, em vez do template genérico
       "foi classificado como X, e não como Produto/Serviço principal, porque
       Y") porque a ausência de autonomia/jornada/resultado autônomo é, aqui,
       a própria evidência positiva da camada — não só a negação de
       Produto/Serviço. Continua vindo só da camada já identificada, nunca do
       nome do item: qualquer item com o mesmo padrão estrutural de respostas
       recebe o mesmo texto. "Funciona como elemento configurável dela" só
       descreve um componente de verdade configurável (sinal real: modalidade
       = SIM, P13) — sem esse sinal, mesmo quando o único sinal foi "existe
       para outro Produto/Serviço entregar resultado" (P15), afirmar
       "configurável" inventaria uma natureza que as respostas não sustentam;
       a redação genérica ("papel estrutural dentro dela") não afirma nada
       além do que o motor realmente verificou. */
    if (camada.id === 'componente') {
      var respostasComponente = atual.respostas || {};
      var configuravel = !!(respostasComponente.modalidade && respostasComponente.modalidade.valor === 'sim');
      var papelComponente = configuravel ? 'funciona como elemento configurável dela' : 'exerce um papel estrutural dentro dela';
      return 'O item não possui autonomia estrutural, jornada própria nem resultado autônomo suficiente para caracterizar Produto/Serviço principal. ' +
        'As respostas indicam que ele pertence estruturalmente a outra solução e ' + papelComponente + '. ' +
        'Por isso, sua classificação predominante é Componente.' + especializacaoFrase + papelEstruturalFrase;
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
    '.pdf-meta-versoes{font-size:9px;color:#888;font-style:italic;margin:0 0 8px}' +
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
    '.pdf-tabela-id tr{page-break-inside:avoid;break-inside:avoid}' +
    '.pdf-decisao-bloco{page-break-inside:avoid;break-inside:avoid}';

  function pdfLinhaTabela(rotulo, valor) {
    return '<tr><th>' + esc(rotulo) + '</th><td>' + esc(valor || '—') + '</td></tr>';
  }
  function pdfPergunta(def, resposta, it) {
    if (!resposta || !resposta.valor) return '';
    var valor = resposta.valor === 'sim' ? 'SIM' : 'NÃO';
    var obs = (resposta.observacao || '').trim();
    var conteudo = conteudoSnapshotOuAtual(def, resposta, it);
    /* pdf-pergunta-bloco é o bloco indivisível (pergunta + resposta +
       justificativa do usuário + interpretação do sistema) — nunca deve
       atravessar duas páginas do PDF. */
    return '' +
      '<div class="pdf-pergunta pdf-pergunta-bloco">' +
      '<p class="pdf-pergunta-texto">' + numeroGlobal(def) + '. ' + esc(rotuloCompacto(def, conteudo)) + ' — <strong>' + valor + '</strong></p>' +
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

    /* Metadados discretos (item 20 da parametrização de questionários):
       registram exatamente qual REDAÇÃO das perguntas (questionário) e qual
       REGRA de classificação (motor) produziram este resultado — os dois
       eixos são independentes, e cada avaliação preserva os dois números
       vigentes quando ela foi calculada, nunca os mais recentes. */
    html += '<p class="pdf-meta-versoes">Versão do questionário: ' + esc(it.questionnaireContentVersion || 1) +
      ' · Versão do motor: ' + esc(it.motorVersion || '—') + '</p>';

    var rotuloResultadoTxt = rotuloResultado(it.resultadoAutomatico);
    html += '<h2 class="pdf-secao-titulo">Resultado sobre Produto/Serviço</h2>';
    html += '<p class="pdf-resultado pdf-resultado--' + esc(it.resultadoAutomatico || 'a-validar') + '">' +
      esc(rotuloResultadoTxt) + '</p>';

    var camada = it.camadaSugerida;
    html += '<h2 class="pdf-secao-titulo">Classificação arquitetural sugerida</h2>';
    html += '<p>' + esc(camada && camada.label || '—') + '</p>';
    /* Especialização/Papel estrutural aparecem SEMPRE, para qualquer
       classificação — nunca escondidas por causa da camada (ver
       rotuloEspecializacaoApresentacao/rotuloPapelEstruturalApresentacao). */
    html += '<p><strong>Especialização:</strong> ' + esc(rotuloEspecializacaoApresentacao(camada)) + '</p>';
    html += '<p><strong>Papel estrutural:</strong> ' + esc(rotuloPapelEstruturalApresentacao(camada)) + '</p>';
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

    /* pdf-decisao-bloco (page-break-inside:avoid) — mesma proteção já usada
       em pdf-pergunta-bloco: sem envolver título+tabela num único bloco
       indivisível, html2pdf.js podia "prender" só o título à primeira linha
       (page-break-after:avoid no h2 é uma regra fraca, glue de dois
       elementos, não do bloco inteiro) e cortar as linhas seguintes da
       tabela na borda da página sem empurrar o resto pra uma página nova —
       confirmado renderizando o PDF de verdade (pixels, via pdf.js), não só
       inspecionando o HTML fonte antes de virar canvas/imagem, que sempre
       parecia completo mesmo quando o resultado final saía cortado. */
    html += '<div class="pdf-decisao-bloco">';
    html += '<h2 class="pdf-secao-titulo">Decisão arquitetural</h2>';
    html += '<table class="pdf-tabela-id">';
    html += pdfLinhaTabela('Recomendação do sistema', rotuloResultadoTxt);
    html += pdfLinhaTabela('Classificação sugerida', camada && camada.label);
    html += pdfLinhaTabela('Especialização', rotuloEspecializacaoApresentacao(camada));
    html += pdfLinhaTabela('Papel estrutural', rotuloPapelEstruturalApresentacao(camada));
    var decisaoTxt = rotuloResultado(it.decisaoFinal);
    html += pdfLinhaTabela('Decisão final', decisaoTxt);
    html += pdfLinhaTabela('Forma da decisão', it.decisaoManual ? 'Alterada manualmente' : 'Recomendação do sistema aceita');
    if (it.decisaoManual) {
      /* Registro MANUAL, dentro da área de decisão — nunca no bloco do
         resultado automático do questionário. */
      if (rotuloNaturezaDoItem(it)) html += pdfLinhaTabela('Natureza complementar', rotuloNaturezaDoItem(it));
      html += pdfLinhaTabela('Justificativa da decisão manual', it.justificativaDecisao);
      html += pdfLinhaTabela('Responsável pela decisão', it.alteradoPor && it.alteradoPor.name);
      html += pdfLinhaTabela('Data e hora da decisão', fmtData(it.alteradoEm));
    }
    html += '</table></div></section>';
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
              /* Ver comentário de causa raiz acima: zera o cálculo automático
                 de deslocamento do html2canvas, que é o que produzia o PDF em
                 branco em telas de resultado altas — nunca depende de scroll
                 nem de posição na página. width/height/windowWidth/
                 windowHeight NÃO entram aqui: são fixados só depois de
                 toContainer() (ver abaixo), porque medir antes cortava o fim
                 do documento sempre que o plugin de quebra de página
                 (pagebreak: avoid-all/css) precisava empurrar um bloco
                 protegido (ex.: a seção "Decisão arquitetural") para a
                 página seguinte. */
              x: 0, y: 0, scrollX: 0, scrollY: 0
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['css', 'avoid-all'] }
          }).from(container).toContainer().then(function () {
            /* CAUSA RAIZ do corte no fim do documento (ex.: a tabela "Decisão
               arquitetural" aparecendo cortada/em branco): o plugin de
               pagebreak do próprio html2pdf.js (mode: avoid-all/css) roda
               DENTRO de toContainer(), inserindo divs espaçadoras no CLONE
               interno (this.prop.container) para empurrar qualquer bloco que
               cairia dividido entre duas páginas — o que pode deixar o clone
               MAIS ALTO do que o container original. Se width/height/
               windowWidth/windowHeight do html2canvas já tivessem sido
               fixados ANTES dessa etapa (medidos no container original, sem
               os espaçadores), a janela de captura ficava presa no tamanho
               antigo, e qualquer conteúdo empurrado para além dele nunca era
               desenhado — sumia, mesmo estando corretamente no HTML/DOM (só
               não estava sendo fotografado). Por isso a medição de
               width/height só acontece agora, sobre o clone JÁ processado
               pelo pagebreak, exatamente como windowWidth/scrollX/scrollY já
               precisavam ser explícitos por um motivo parecido (ver acima). */
            var alturaClonada = this.prop.container.scrollHeight;
            var larguraClonada = this.prop.container.scrollWidth;
            this.opt.html2canvas.width = larguraClonada;
            this.opt.html2canvas.windowWidth = larguraClonada;
            this.opt.html2canvas.height = alturaClonada;
            this.opt.html2canvas.windowHeight = alturaClonada;
          }).toCanvas().toPdf().get('pdf').then(function (pdf) {
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
    { largura: 26, rotulo: 'Especialização' }, { largura: 16, rotulo: 'Papel estrutural' },
    { largura: 40, rotulo: 'Relação arquitetural' }, { largura: 20, rotulo: 'Decisão arquitetural final' },
    { largura: 14, rotulo: 'Tipo da decisão' }, { largura: 20, rotulo: 'Responsável pela decisão' },
    { largura: 16, rotulo: 'Data da decisão' }, { largura: 40, rotulo: 'Justificativa da decisão manual' },
    { largura: 24, rotulo: 'Natureza complementar (manual)' }
  ];
  function linhaResumoExcel(it) {
    var camada = it.camadaSugerida;
    return [
      it._key, it.nome || '', it.descricao || '', it.publico || '', it.necessidade || '',
      (it.responsavel && it.responsavel.name) || '', it.criadoEm ? new Date(it.criadoEm) : '',
      it.status === 'concluido' ? 'Concluído' : 'Rascunho', it.versao || 1,
      it.status === 'concluido' ? rotuloResultado(it.resultadoAutomatico) : '',
      (camada && camada.label) || '', (camada && camada.especializacao) || '', (camada && camada.papelEstrutural) || '',
      (camada && camada.relacao) || '',
      it.status === 'concluido' ? rotuloResultado(it.decisaoFinal) : '',
      it.status === 'concluido' ? (it.decisaoManual ? 'Manual' : 'Automática') : '',
      it.decisaoManual ? ((it.alteradoPor && it.alteradoPor.name) || '') : '',
      it.decisaoManual && it.alteradoEm ? new Date(it.alteradoEm) : '',
      it.decisaoManual ? (it.justificativaDecisao || '') : '',
      it.decisaoManual ? rotuloNaturezaDoItem(it) : ''
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
          idx + 1, rotuloCompacto(p, conteudoSnapshotOuAtual(p, r, it)), r.valor === 'sim' ? 'SIM' : 'NÃO',
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
      filtro: { resultado: 'todos', status: 'todos', alterado: 'todos', alternativa: 'todos', motor: 'todos' },
      lixeira: false,        /* alterna a lista entre ativos e excluídos — "excluído" é outra dimensão, não um status irmão de rascunho/concluído */
      atual: null,
      erroForm: null,
      camposInvalidos: [],
      pendenteId: null,
      salvando: null,       /* null | 'rascunho' | 'concluido' — trava os botões de salvar do checklist */
      salvandoDecisao: false,
      reprocessando: false, /* trava o botão REPROCESSAR COM MOTOR ATUAL enquanto grava */
      decisaoForm: null,
      salvandoEspecializacao: false, /* trava o botão SALVAR ESPECIALIZAÇÃO enquanto grava */
      especializacaoForm: null,
      flashLista: null,     /* confirmação persistente mostrada na lista após salvar rascunho */
      flashResultado: null, /* confirmação persistente mostrada no resultado após concluir */
      flashDecisao: null,   /* confirmação persistente mostrada após salvar a decisão arquitetural */
      flashEspecializacao: null, /* confirmação persistente mostrada após salvar a especialização cadastrada */
      reavaliacaoBase: null, /* fotografia da avaliação anterior, só durante uma reavaliação — usada para
                                mostrar "resposta alterada" e o resumo de alterações; nunca gravada */
      selecionados: {},      /* chaves marcadas na lista, para "PDF das selecionadas" — nunca persistido */
      menuExportarAberto: false,
      exportando: null,      /* null | 'pdf' | 'excel' — trava os botões de exportação durante a geração */
      flashExportacao: null, /* mensagem de sucesso/erro da última exportação, mostrada na lista */
      carregandoTravado: false, /* true quando a tela 'carregando' esperou demais pela leitura de avaliacoes-produto */
      reprocessamentoLote: null, /* null | { total, feitos, sucesso, erros:[{key,nome,mensagem}], emAndamento } —
                                    ver executarReprocessamentoEmLote; some quando fechado depois de concluído */
      reconciliacaoLote: null, /* null | { total, feitos, sucesso, ignoradas:[{nome,mensagem}], erros:[{nome,mensagem}],
                                   auditoria: null|'ok'|'erro', emAndamento, lento } — ver reconciliarAvaliacoes */
      aplicandoCorrecao: false, /* trava o botão APLICAR CORREÇÃO (questionarios-config) enquanto publica */
      reconciliando: false, /* trava o botão individual RECONCILIAR COM VERSÃO EQUIVALENTE enquanto grava */
      config: null, /* null fora da tela de configuração; ver abrirConfigQuestionarios — nunca persistido aqui,
                       só o rascunho gravado explicitamente em window.faQuestionarios */
      configMotores: null /* null fora da tela "⚙ Configuração dos Motores"; ver abrirConfigMotores */
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
      else if (state.tela === 'config-questionario') renderConfigQuestionarios();
      else if (state.tela === 'config-motores') renderConfigMotores();
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
      state.especializacaoForm = especializacaoFormInicial(it);
      state.flashLista = null;
      state.flashResultado = null;
      state.flashDecisao = null;
      state.flashEspecializacao = null;
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
      /* Motor só diz respeito a avaliações concluídas (rascunho não tem
         recomendação automática calculada) — "desatualizado" nunca inclui
         rascunho, e "atual" o inclui trivialmente (nada pra desatualizar),
         o que é aceitável: o filtro existe pra auditar concluídas. */
      var situacao = situacaoMotor(it);
      if (state.filtro.motor === 'desatualizado' && situacao !== 'desatualizado') return false;
      if (state.filtro.motor === 'equivalente' && situacao !== 'equivalente') return false;
      if (state.filtro.motor === 'atual' && (situacao === 'desatualizado' || situacao === 'equivalente')) return false;
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
      if (!state.lixeira) html += '<button class="btn btn--sm" id="avpConfigQuestionariosBtn">⚙ Configuração dos Questionários</button>';
      if (!state.lixeira) html += '<button class="btn btn--sm" id="avpConfigMotoresBtn">⚙ Configuração dos Motores</button>';
      if (!state.lixeira && window.faAvaliacaoSquad) html += '<button class="btn btn--sm" id="avpAdequacaoSquadListaBtn">🧭 Adequação à Squad</button>';
      html += '</div>';
      if (state.flashExportacao) {
        html += '<p class="avp-export-status' + (state.flashExportacao.erro ? ' avp-export-status--erro' : '') + '">' +
          esc(state.flashExportacao.texto) + '</p>';
      }

      /* Linha própria, separada da barra de ações principal (+ Avaliar novo
         item / Exportar / Lixeira) e dos filtros — pedido explícito de não
         competir visualmente com nenhum dos dois. Só existe fora da lixeira,
         igual ao resto das ações de lote. */
      if (!state.lixeira) {
        var concluidas = ativos.filter(function (it) { return it.status === 'concluido'; });
        var elegiveisLote = concluidas.filter(elegivelParaReprocessamentoEmLote);
        var elegiveisReconciliacao = concluidas.filter(elegivelParaReconciliacaoEmLote);
        html += renderBarraReconciliar(elegiveisReconciliacao);
        if (state.reconciliacaoLote) html += renderReconciliacaoLoteCard();
        html += renderBarraReprocessarTudo(elegiveisLote, elegiveisReconciliacao.length);
        if (state.reprocessamentoLote) html += renderReprocessamentoLoteCard();
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
        html += filtroSelect('avpFiltroMotor', state.filtro.motor, [
          ['todos', 'Motor: todas'], ['desatualizado', 'Motor desatualizado'], ['equivalente', 'Versão anterior equivalente'], ['atual', 'Motor atual']
        ]);
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
          html += '<td data-label="Decisão final">' + resultadoBadge(decisao) + (it.decisaoManual ? ' <span class="avp-tag-alterado">alterada</span>' : '') +
            (rotuloNaturezaDoItem(it) ? ' <span class="avp-tag-natureza">' + esc(rotuloNaturezaDoItem(it)) + '</span>' : '') + '</td>';
          html += '<td data-label="Classificação arquitetural">' + esc(camadaLabel) + '</td>';
          html += '<td data-label="Responsável">' + esc(it.responsavel && it.responsavel.name || '—') + '</td>';
          html += '<td data-label="Data">' + fmtData(it.atualizadoEm) + '</td>';
          html += '<td data-label="Status">' + statusBadge(it.status) + badgeMotor(it) + '</td>';
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

      var configBtn = document.getElementById('avpConfigQuestionariosBtn');
      if (configBtn) configBtn.addEventListener('click', abrirConfigQuestionarios);

      var configMotoresBtn = document.getElementById('avpConfigMotoresBtn');
      if (configMotoresBtn) configMotoresBtn.addEventListener('click', abrirConfigMotores);

      var squadListaBtn = document.getElementById('avpAdequacaoSquadListaBtn');
      if (squadListaBtn) squadListaBtn.addEventListener('click', function () { window.faAvaliacaoSquad.abrirLista(); });

      var reprocessarTudoBtn = document.getElementById('avpReprocessarTudoBtn');
      if (reprocessarTudoBtn) reprocessarTudoBtn.addEventListener('click', abrirModalReprocessarTudo);
      var loteFecharBtn = document.getElementById('avpLoteFechar');
      if (loteFecharBtn) loteFecharBtn.addEventListener('click', function () { state.reprocessamentoLote = null; render(); });
      var reconciliarTudoBtn = document.getElementById('avpReconciliarTudoBtn');
      if (reconciliarTudoBtn) reconciliarTudoBtn.addEventListener('click', abrirModalReconciliar);
      var reconciliacaoFecharBtn = document.getElementById('avpReconciliacaoFechar');
      if (reconciliacaoFecharBtn) reconciliacaoFecharBtn.addEventListener('click', function () { state.reconciliacaoLote = null; render(); });

      var novoBtn = document.getElementById('avpNovoBtn');
      if (novoBtn) novoBtn.addEventListener('click', function () {
        state.atual = { nome: '', descricao: '', publico: '', necessidade: '', observacoesGerais: '', respostas: {},
          questionnaireContentVersion: window.faQuestionarios.versaoAtual(CODIGO_QUESTIONARIO) };
        state.reavaliacaoBase = null;
        state.erroForm = null;
        state.camposInvalidos = [];
        state.flashLista = null;
        state.tela = 'form-inicial';
        render();
      });
      ['Resultado', 'Status', 'Alterado', 'Alternativa', 'Motor'].forEach(function (campo) {
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
    /* Indicador visual de auditoria — só existe para concluídas (rascunho não
       tem motorVersion nenhuma, então não entra nem como "atual" nem como
       "desatualizado" aqui, ao contrário do filtro em itemPassaFiltro). */
    function badgeMotor(it) {
      var situacao = situacaoMotor(it);
      if (!situacao) return '';
      if (situacao === 'desatualizado') return ' <span class="avp-tag-motor avp-tag-motor--desatualizado">Motor desatualizado</span>';
      if (situacao === 'equivalente') return ' <span class="avp-tag-motor avp-tag-motor--equivalente">Versão anterior equivalente</span>';
      return ' <span class="avp-tag-motor avp-tag-motor--atual">Motor atual</span>';
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

    /* jaSalvouAntes distingue "nunca mexi nisso" de "já cliquei em salvar
       antes" (decisaoConfirmada — vale tanto para aceitar a recomendação
       automática quanto para divergir dela) — só nesse segundo caso um novo
       ajuste deve dizer SALVAR ALTERAÇÃO em vez de SALVAR DECISÃO.
       decisaoManual sozinho não bastaria: ele fica false tanto para "nunca
       mexi" quanto para "cliquei salvar e aceitei a recomendação", e as duas
       situações precisam de rótulos diferentes no botão. ultimoSalvo é a
       fotografia do que está realmente gravado; comparar contra ela (não
       contra um booleano solto) é o que permite o botão voltar sozinho pro
       estado "✓ DECISÃO SALVA" se a pessoa desfizer a mudança na mão. */
    function decisaoFormInicial(it) {
      var naturezaSalva = it.decisaoManual && it.naturezaComplementar ? (it.naturezaComplementar.id || '') : '';
      var salvo = { opcao: it.decisaoManual ? it.decisaoFinal : 'auto', justificativa: it.justificativaDecisao || '', natureza: naturezaSalva };
      return { opcao: salvo.opcao, justificativa: salvo.justificativa, natureza: salvo.natureza, erro: null,
        jaSalvouAntes: !!(it.decisaoManual || it.decisaoConfirmada), ultimoSalvo: salvo };
    }
    function decisaoIguais(x, y) {
      if (x.opcao !== y.opcao) return false;
      if (x.opcao === 'auto') return true;
      return (x.justificativa || '').trim() === (y.justificativa || '').trim() && (x.natureza || '') === (y.natureza || '');
    }
    /* Mesmo princípio do decisaoForm: ultimoSalvo é a fotografia do que está
       realmente gravado (nunca um booleano solto), para o botão distinguir
       "nada digitado ainda" de "já salvo, sem mudança" de "mudou depois de
       salvo" só comparando o campo atual contra ela. */
    function especializacaoFormInicial(it) {
      var salvo = it.especializacaoCadastrada || '';
      var papelSalvo = it.papelEstruturalCadastrado || '';
      return { valor: salvo, ultimoSalvo: salvo, papel: papelSalvo, papelUltimoSalvo: papelSalvo, erro: null };
    }

    function abrirVisualizacao(key) {
      var it = buscarItem(key);
      if (!it) return;
      state.atual = clonarItem(it);
      state.decisaoForm = decisaoFormInicial(it);
      state.especializacaoForm = especializacaoFormInicial(it);
      state.flashLista = null;
      state.flashResultado = null;
      state.flashDecisao = null;
      state.flashEspecializacao = null;
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
      /* Uma reavaliação é uma NOVA rodada de respostas, feita agora — fixa a
         versão de conteúdo vigente NESTE momento (nunca a da avaliação
         anterior). Perguntas que a pessoa não tocar de novo mantêm o
         snapshot antigo (já gravado em cada resposta, herdado de it via
         clonarItem); só uma resposta CLICADA de novo é re-carimbada com
         esta versão (ver o clique de SIM/NÃO em renderChecklist). */
      state.atual.questionnaireContentVersion = window.faQuestionarios.versaoAtual(CODIGO_QUESTIONARIO);
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
        observacoesGerais: '', respostas: {},
        questionnaireContentVersion: window.faQuestionarios.versaoAtual(CODIGO_QUESTIONARIO)
      };
      state.reavaliacaoBase = null;
      state.erroForm = null;
      state.camposInvalidos = [];
      state.pendenteId = null;
      state.flashLista = null;
      state.tela = 'checklist';
      render();
    }

    /* ===================== CONFIGURAÇÃO DOS QUESTIONÁRIOS =====================
       Tela administrativa para editar a REDAÇÃO de P1-P16 (e, na sua própria
       aba, S1-S8 — ver ADEQUACAO_SQUAD) sem código/PR/deploy. Três sub-telas:
       'lista' (situação de cada questionário), 'editar' (rascunho de um
       questionário) e 'auditoria' (histórico de alterações já publicadas).
       Nunca edita a versão PUBLICADA diretamente — sempre um rascunho à
       parte (window.faQuestionarios.salvarRascunho), só efetivado em
       PUBLICAR NOVA VERSÃO. */
    function abrirConfigQuestionarios() {
      state.config = { sub: 'lista', codigo: null, rascunho: null, flash: null, salvando: false,
        confirmandoPublicacao: false, publicando: false, auditoria: null };
      state.tela = 'config-questionario';
      render();
    }
    function fecharConfigQuestionarios() {
      state.config = null;
      state.tela = 'lista';
      render();
    }
    function abrirEdicaoQuestionario(codigo) {
      state.config.sub = 'editar';
      state.config.codigo = codigo;
      state.config.rascunho = window.faQuestionarios.iniciarOuObterRascunho(codigo);
      state.config.flash = null;
      state.config.confirmandoPublicacao = false;
      render();
    }
    function abrirAuditoriaQuestionario(codigo) {
      state.config.sub = 'auditoria';
      state.config.codigo = codigo;
      state.config.auditoria = null;
      render();
      window.faQuestionarios.auditoria(codigo, function (lista) {
        state.config.auditoria = lista;
        render();
      });
    }

    function renderConfigQuestionarios() {
      var c = state.config;
      var html = '<div class="avp-config-questionarios">';
      html += '<button class="avp-voltar-link" id="avpConfigVoltar">‹ Avaliações de Produto/Serviço</button>';
      if (c.sub === 'lista') html += renderConfigLista();
      else if (c.sub === 'editar') html += renderConfigEditar();
      else if (c.sub === 'auditoria') html += renderConfigAuditoria();
      html += '</div>';
      wrap.innerHTML = html;

      document.getElementById('avpConfigVoltar').addEventListener('click', fecharConfigQuestionarios);
      if (c.sub === 'lista') bindConfigLista();
      else if (c.sub === 'editar') bindConfigEditar();
      else if (c.sub === 'auditoria') bindConfigAuditoria();
    }

    function renderConfigLista() {
      var html = '<div class="avp-form-card"><h3>Configuração dos Questionários</h3>';
      html += '<p class="avp-decisao-aviso">Altere título, texto, ajuda e exemplo das perguntas sem precisar de código, PR ou deploy. ' +
        'O identificador de cada pergunta (ex.: "P5") e a regra que ele representa para o motor de classificação nunca mudam por aqui.</p></div>';
      Object.keys(window.faQuestionarios.CODIGOS).forEach(function (chave) {
        var codigo = window.faQuestionarios.CODIGOS[chave];
        var sit = window.faQuestionarios.situacao(codigo);
        html += '<div class="avp-form-card avp-config-item-card">';
        html += '<h4>' + esc(sit.nome) + '</h4>';
        html += '<p>' + esc(sit.qtdPerguntas) + ' pergunta' + (sit.qtdPerguntas === 1 ? '' : 's') + ' · Versão publicada: ' + esc(sit.versaoPublicada) + '</p>';
        html += '<p>Situação: ' + (sit.temRascunho ? '<strong>há um rascunho não publicado</strong>' : 'sem alterações pendentes') + '</p>';
        html += '<p>Última publicação: ' + (sit.ultimaAlteracaoEm ? esc(fmtData(sit.ultimaAlteracaoEm)) + (sit.ultimaAlteracaoPor ? ' · ' + esc(sit.ultimaAlteracaoPor) : '') : 'nunca alterado (conteúdo de fábrica)') + '</p>';
        html += '<div class="avp-actions-footer">';
        html += '<button class="btn btn--sm avp-config-editar-btn" data-codigo="' + codigo + '">Editar perguntas</button>';
        html += '<button class="btn btn--sm avp-config-auditoria-btn" data-codigo="' + codigo + '">Ver histórico de alterações</button>';
        html += '</div></div>';
        window.faQuestionarios.listarCorrecoesEditoriais(codigo).forEach(function (corr) { html += renderCorrecaoEditorial(corr.id); });
      });
      return html;
    }
    /* Correção editorial entregue pelo código e aplicada pelo MESMO
       mecanismo de qualquer outra edição (vira uma versão nova do
       questionário, com auditoria por campo) — ver CORRECOES_EDITORIAIS em
       questionarios-config.js. Nunca aplicada sozinha. */
    function rotuloCampoEditorial(campo) {
      return campo === 'justSim' ? 'Interpretação automática quando a resposta é SIM'
        : campo === 'justNao' ? 'Interpretação automática quando a resposta é NÃO' : campo;
    }
    function renderCorrecaoEditorial(id) {
      var sit = window.faQuestionarios.situacaoCorrecaoEditorial(id);
      if (!sit) return '';
      var html = '<div class="avp-form-card avp-correcao-card" id="avpCorrecao-' + esc(id) + '">';
      html += '<h4>' + (sit.aplicada ? '✓ Correção editorial aplicada' : 'Correção editorial disponível') + ' — ' + esc(sit.titulo) + '</h4>';
      html += '<p>' + esc(sit.descricao) + '</p>';
      html += '<ul class="avp-correcao-lista">';
      sit.ajustes.forEach(function (aj) {
        var marca = aj.estado === 'aplicada' ? '✓ já aplicado' : aj.estado === 'pendente' ? 'pendente' : 'mantido — o texto atual foi editado por alguém e não será alterado';
        html += '<li><strong>' + esc(aj.pergunta) + '</strong> · ' + esc(rotuloCampoEditorial(aj.campo)) + ' <em>(' + esc(marca) + ')</em>';
        if (aj.estado === 'pendente') {
          html += '<br><span class="avp-correcao-antes">Antes: ' + esc(semPrefixo(aj.de)) + '</span>' +
            '<br><span class="avp-correcao-depois">Depois: ' + esc(semPrefixo(aj.para)) + '</span>';
        }
        html += '</li>';
      });
      html += '</ul>';
      if (!sit.aplicada) {
        html += '<p class="avp-decisao-aviso">Aplicar cria a versão ' + esc(sit.versaoAtual + 1) + ' deste questionário — o mesmo efeito de "Publicar". ' +
          'Não altera o motor nem as regras, não reprocessa nada e não muda avaliações já feitas (elas guardam a redação da época); ' +
          'só avaliações iniciadas depois, ou reavaliadas, usam a redação nova.</p>';
        var bloqueio = !sit.carregada ? 'Aguarde: a configuração ainda está carregando.'
          : sit.haRascunho ? 'Há um rascunho de edição em andamento. Publique ou descarte o rascunho antes — aplicar a correção o substituiria.'
          : !sit.pendentes ? 'Nada a aplicar: os textos atuais foram editados e são mantidos.' : '';
        if (bloqueio) html += '<p class="avp-error-msg">' + esc(bloqueio) + '</p>';
        html += '<button class="btn btn--primary avp-correcao-aplicar-btn" data-correcao="' + esc(id) + '"' + (bloqueio || state.aplicandoCorrecao ? ' disabled' : '') + '>' +
          (state.aplicandoCorrecao ? 'APLICANDO…' : 'APLICAR CORREÇÃO (CRIAR VERSÃO ' + esc(sit.versaoAtual + 1) + ')') + '</button>';
      }
      html += '</div>';
      return html;
    }
    function aplicarCorrecaoEditorialNaTela(id) {
      if (state.aplicandoCorrecao) return;
      var sit = window.faQuestionarios.situacaoCorrecaoEditorial(id);
      if (!sit) return;
      avpConfirm('Aplicar a correção "' + sit.titulo + '"? Isso cria a versão ' + (sit.versaoAtual + 1) + ' do questionário, ' +
        'sem alterar o motor e sem mudar avaliações já feitas.', function () {
        state.aplicandoCorrecao = true;
        render();
        var respondido = false;
        var relogio = setTimeout(function () {
          if (respondido) return;
          respondido = true;
          state.aplicandoCorrecao = false;
          render();
          avpAlert('A conexão está demorando e não deu para confirmar a aplicação. Confira a versão publicada antes de tentar de novo.');
        }, 15000);
        window.faQuestionarios.aplicarCorrecaoEditorial(id, sessaoAtual(), function (err, info) {
          if (respondido) return;
          respondido = true;
          clearTimeout(relogio);
          state.aplicandoCorrecao = false;
          render();
          if (err) {
            avpAlert(err === 'rascunho-em-andamento' ? 'Há um rascunho em andamento. Publique ou descarte o rascunho antes.'
              : err === 'config-nao-carregada' ? 'A configuração ainda está carregando. Tente de novo em alguns segundos.'
              : err === 'nada-a-aplicar' ? 'Nada a aplicar: os textos atuais já estão corretos ou foram editados.'
              : 'Não foi possível aplicar a correção. Tente novamente.');
            return;
          }
          avpAlert('✓ Correção aplicada: versão ' + info.novaVersao + ' do questionário publicada (' + info.aplicados.join(', ') + ').' +
            (info.ignorados.length ? ' Mantidos, por já terem sido editados: ' + info.ignorados.join(', ') + '.' : ''));
        });
      });
    }
    function bindConfigLista() {
      wrap.querySelectorAll('.avp-correcao-aplicar-btn').forEach(function (btn) {
        btn.addEventListener('click', function () { aplicarCorrecaoEditorialNaTela(btn.dataset.correcao); });
      });
      wrap.querySelectorAll('.avp-config-editar-btn').forEach(function (btn) {
        btn.addEventListener('click', function () { abrirEdicaoQuestionario(btn.dataset.codigo); });
      });
      wrap.querySelectorAll('.avp-config-auditoria-btn').forEach(function (btn) {
        btn.addEventListener('click', function () { abrirAuditoriaQuestionario(btn.dataset.codigo); });
      });
    }

    function renderConfigEditar() {
      var c = state.config;
      var sit = window.faQuestionarios.situacao(c.codigo);
      var html = '<div class="avp-form-card"><h3>Editar perguntas — ' + esc(sit.nome) + '</h3>';
      html += '<p class="avp-decisao-aviso">Atenção: altere a redação para melhorar clareza, sem modificar o significado do critério. ' +
        'Mudanças conceituais podem exigir alteração da regra do motor.</p></div>';
      c.rascunho.perguntas.forEach(function (p, idx) {
        html += '<div class="avp-form-card avp-config-pergunta-card">';
        html += '<p class="avp-alt-label">Código: <strong>' + esc(p.codigoEstavel) + '</strong> <span class="avp-config-readonly-tag">(somente leitura)</span></p>';
        html += '<div class="avp-field"><label for="avpCfgTitulo' + idx + '">Título</label>' +
          '<input type="text" id="avpCfgTitulo' + idx + '" data-idx="' + idx + '" data-campo="titulo" value="' + esc(p.titulo || '') + '"></div>';
        html += '<div class="avp-field"><label for="avpCfgTexto' + idx + '">Texto da pergunta</label>' +
          '<textarea id="avpCfgTexto' + idx + '" data-idx="' + idx + '" data-campo="texto" rows="2">' + esc(p.texto || '') + '</textarea></div>';
        if (p.textoAjuda) {
          html += '<div class="avp-field"><label for="avpCfgAjudaSig' + idx + '">Ajuda — o que significa</label>' +
            '<textarea id="avpCfgAjudaSig' + idx + '" data-idx="' + idx + '" data-campo="textoAjuda.significado" rows="2">' + esc(p.textoAjuda.significado || '') + '</textarea></div>';
          html += '<div class="avp-field"><label for="avpCfgAjudaSim' + idx + '">Ajuda — quando marcar SIM</label>' +
            '<textarea id="avpCfgAjudaSim' + idx + '" data-idx="' + idx + '" data-campo="textoAjuda.quandoSim" rows="2">' + esc(p.textoAjuda.quandoSim || '') + '</textarea></div>';
          html += '<div class="avp-field"><label for="avpCfgAjudaNao' + idx + '">Ajuda — quando marcar NÃO</label>' +
            '<textarea id="avpCfgAjudaNao' + idx + '" data-idx="' + idx + '" data-campo="textoAjuda.quandoNao" rows="2">' + esc(p.textoAjuda.quandoNao || '') + '</textarea></div>';
        }
        if ('exemplo' in p) {
          html += '<div class="avp-field"><label for="avpCfgExemplo' + idx + '">Exemplo</label>' +
            '<textarea id="avpCfgExemplo' + idx + '" data-idx="' + idx + '" data-campo="exemplo" rows="2">' + esc(p.exemplo || '') + '</textarea></div>';
        }
        /* justSim/justNao são a "Interpretação do sistema" registrada
           automaticamente quando alguém responde SIM/NÃO — também editorial,
           também parametrizado, nunca lido pelo motor (identificarCamada só
           usa o valor SIM/NÃO em si, nunca este texto). */
        html += '<div class="avp-field"><label for="avpCfgJustSim' + idx + '">Interpretação automática quando a resposta é SIM</label>' +
          '<textarea id="avpCfgJustSim' + idx + '" data-idx="' + idx + '" data-campo="justSim" rows="2">' + esc(p.justSim || '') + '</textarea></div>';
        html += '<div class="avp-field"><label for="avpCfgJustNao' + idx + '">Interpretação automática quando a resposta é NÃO</label>' +
          '<textarea id="avpCfgJustNao' + idx + '" data-idx="' + idx + '" data-campo="justNao" rows="2">' + esc(p.justNao || '') + '</textarea></div>';
        html += '<div class="avp-field"><label for="avpCfgObs' + idx + '">Observação administrativa (opcional, não aparece pra quem responde)</label>' +
          '<textarea id="avpCfgObs' + idx + '" data-idx="' + idx + '" data-campo="observacaoAdministrativa" rows="2">' + esc(p.observacaoAdministrativa || '') + '</textarea></div>';
        html += '</div>';
      });
      if (c.flash) html += '<p class="avp-flash-success">' + esc(c.flash) + '</p>';
      html += '<div class="avp-actions-footer">';
      html += '<button class="btn btn--sm" id="avpCfgSalvarRascunhoBtn"' + (c.salvando ? ' disabled' : '') + '>' + (c.salvando ? 'SALVANDO…' : 'SALVAR RASCUNHO') + '</button>';
      html += '<button class="btn btn--primary btn--sm" id="avpCfgPublicarBtn">PUBLICAR NOVA VERSÃO</button>';
      html += '<button class="btn btn--sm" id="avpCfgVoltarListaBtn">‹ Voltar</button>';
      html += '</div>';
      if (c.confirmandoPublicacao) html += renderConfigConfirmarPublicacao();
      return html;
    }
    function renderConfigConfirmarPublicacao() {
      var c = state.config;
      var atuais = window.faQuestionarios.perguntasDaVersao(c.codigo);
      var alteradas = window.faQuestionarios.diffPerguntas(atuais, c.rascunho.perguntas);
      var html = '<div class="avp-form-card avp-config-confirmar-card">';
      html += '<h4>Confirmar publicação</h4>';
      if (!alteradas.length) {
        html += '<p>Nenhum campo foi alterado em relação à versão publicada atual.</p>';
      } else {
        html += '<p>' + alteradas.length + ' pergunta' + (alteradas.length === 1 ? '' : 's') + ' alterada' + (alteradas.length === 1 ? '' : 's') + ':</p>';
        html += '<ul class="avp-motivos-list">';
        alteradas.forEach(function (a) { html += '<li>' + esc(a.codigoEstavel) + '</li>'; });
        html += '</ul>';
      }
      html += '<p class="avp-decisao-aviso">Você está alterando apenas o conteúdo da pergunta. A lógica de classificação não será modificada.</p>';
      html += '<div class="avp-actions-footer">';
      html += '<button class="btn btn--primary btn--sm" id="avpCfgConfirmarPublicarBtn"' + (c.publicando ? ' disabled' : '') + '>' + (c.publicando ? 'PUBLICANDO…' : 'CONFIRMAR E PUBLICAR') + '</button>';
      html += '<button class="btn btn--sm" id="avpCfgCancelarPublicarBtn">CANCELAR</button>';
      html += '</div></div>';
      return html;
    }
    function bindConfigEditar() {
      var c = state.config;
      wrap.querySelectorAll('[data-campo]').forEach(function (el) {
        el.addEventListener('input', function () {
          var p = c.rascunho.perguntas[Number(el.dataset.idx)];
          var campo = el.dataset.campo;
          if (campo.indexOf('.') !== -1) {
            var partes = campo.split('.');
            if (!p[partes[0]]) p[partes[0]] = {};
            p[partes[0]][partes[1]] = el.value;
          } else {
            p[campo] = el.value;
          }
        });
      });
      document.getElementById('avpCfgVoltarListaBtn').addEventListener('click', function () { c.sub = 'lista'; render(); });
      document.getElementById('avpCfgSalvarRascunhoBtn').addEventListener('click', function () {
        c.salvando = true;
        render();
        window.faQuestionarios.salvarRascunho(c.codigo, c.rascunho.perguntas, sessaoAtual(), function (err) {
          c.salvando = false;
          c.flash = err ? null : '✓ Rascunho salvo. Ainda não está visível para quem responde o questionário.';
          if (err) avpAlert('Não foi possível salvar o rascunho. Tente novamente.');
          render();
        });
      });
      document.getElementById('avpCfgPublicarBtn').addEventListener('click', function () {
        c.confirmandoPublicacao = true;
        render();
      });
      var confirmarBtn = document.getElementById('avpCfgConfirmarPublicarBtn');
      if (confirmarBtn) confirmarBtn.addEventListener('click', function () {
        if (c.publicando) return;
        c.publicando = true;
        render();
        /* Publica DIRETAMENTE o rascunho que está em memória na tela — nunca
           depende de reler o rascunho do cache local do Firebase entre
           salvá-lo e publicá-lo (a leitura do cache só atualiza quando o
           listener de onMudanca dispara, de forma assíncrona; encadear
           salvarRascunho → publicarRascunho conseguia publicar a versão
           ANTERIOR do rascunho, presa numa corrida). Grava o rascunho em
           paralelo só como registro (nunca bloqueia a publicação por ele). */
        window.faQuestionarios.salvarRascunho(c.codigo, c.rascunho.perguntas, sessaoAtual());
        window.faQuestionarios.publicarPerguntas(c.codigo, c.rascunho.perguntas, sessaoAtual(), function (err) {
          c.publicando = false;
          c.confirmandoPublicacao = false;
          if (err) {
            avpAlert('Não foi possível publicar. Tente novamente.');
            render();
            return;
          }
          c.sub = 'lista';
          render();
        });
      });
      var cancelarBtn = document.getElementById('avpCfgCancelarPublicarBtn');
      if (cancelarBtn) cancelarBtn.addEventListener('click', function () { c.confirmandoPublicacao = false; render(); });
    }

    function renderConfigAuditoria() {
      var c = state.config;
      var sit = window.faQuestionarios.situacao(c.codigo);
      var html = '<div class="avp-form-card"><h3>Histórico de alterações — ' + esc(sit.nome) + '</h3></div>';
      var versoes = window.faQuestionarios.listarVersoes(c.codigo);
      if (versoes.length > 1) {
        html += '<div class="avp-form-card"><h4>Versões publicadas</h4>';
        html += '<p class="avp-decisao-aviso">Restaurar uma versão anterior publica o CONTEÚDO dela como uma versão nova — nunca apaga ' +
          'nem reescreve nenhuma versão existente, e nunca altera avaliações já respondidas.</p>';
        versoes.slice().reverse().forEach(function (v) {
          html += '<p>Versão ' + esc(v) + (v === sit.versaoPublicada ? ' (vigente)' : '') +
            (v === sit.versaoPublicada ? '' : ' <button class="btn btn--sm avp-config-restaurar-btn" data-versao="' + v + '">Restaurar esta versão</button>') + '</p>';
        });
        html += '</div>';
      }
      if (c.auditoria === null) {
        html += '<p class="admin-empty">Carregando…</p>';
      } else if (!c.auditoria.length) {
        html += '<p class="admin-empty">Nenhuma alteração publicada ainda — o conteúdo em uso é o de fábrica.</p>';
      } else {
        html += '<div class="table-scroll-wrap"><table class="admin-table"><thead><tr>' +
          '<th>Pergunta</th><th>Campo</th><th>Versão anterior</th><th>Versão nova</th><th>Quando</th><th>Quem</th></tr></thead><tbody>';
        c.auditoria.forEach(function (a) {
          html += '<tr><td data-label="Pergunta">' + esc(a.pergunta) + '</td>' +
            '<td data-label="Campo">' + esc(a.campo) + '</td>' +
            '<td data-label="Versão anterior">' + esc(a.versaoAnterior) + '</td>' +
            '<td data-label="Versão nova">' + esc(a.novaVersao) + '</td>' +
            '<td data-label="Quando">' + fmtData(a.dataHora) + '</td>' +
            '<td data-label="Quem">' + esc(a.usuario && (a.usuario.name || a.usuario.email) || '—') + '</td></tr>';
        });
        html += '</tbody></table></div>';
      }
      html += '<div class="avp-actions-footer"><button class="btn btn--sm" id="avpCfgAuditoriaVoltarBtn">‹ Voltar</button></div>';
      return html;
    }
    function bindConfigAuditoria() {
      document.getElementById('avpCfgAuditoriaVoltarBtn').addEventListener('click', function () { state.config.sub = 'lista'; render(); });
      wrap.querySelectorAll('.avp-config-restaurar-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var versaoAlvo = Number(btn.dataset.versao);
          avpConfirm('Isso publica o conteúdo da versão ' + versaoAlvo + ' como uma versão NOVA — não apaga nem reescreve nenhuma versão existente, e não altera nenhuma avaliação já respondida. Deseja continuar?', function () {
            window.faQuestionarios.publicarVersaoAnterior(state.config.codigo, versaoAlvo, sessaoAtual(), function (err) {
              if (err) { avpAlert('Não foi possível restaurar esta versão. Tente novamente.'); return; }
              abrirAuditoriaQuestionario(state.config.codigo);
            });
          });
        });
      });
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
      if (it.status === 'concluido') {
        html += it.bloqueadaParaReprocessamentoAutomatico
          ? '<button class="btn avp-menu-item" data-acao="desbloquear">🔓 Desbloquear reprocessamento automático</button>'
          : '<button class="btn avp-menu-item" data-acao="bloquear">🔒 Bloquear reprocessamento automático</button>';
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
          else if (acao === 'bloquear') alternarBloqueioReprocessamento(key, true);
          else if (acao === 'desbloquear') alternarBloqueioReprocessamento(key, false);
        });
      });
    }
    /* Metadado cadastrado à parte (nunca pelo nome do item) que só afeta o
       "REPROCESSAR TUDO" em lote (ver elegivelParaReprocessamentoEmLote) —
       um único .update() na mesma chave, sem tocar em mais nada (respostas,
       resultadoAutomatico, justificativaAutomatica, decisão, historicoMotor
       ficam exatamente como estavam). */
    function alternarBloqueioReprocessamento(key, bloquear) {
      var it = buscarItem(key);
      if (!it) return;
      db().ref(NODE + '/' + key).update({ bloqueadaParaReprocessamentoAutomatico: bloquear }, function (err) {
        if (err) {
          console.error('[avaliacao-produto] erro ao alternar bloqueio de reprocessamento:', err);
          avpAlert('Não foi possível salvar. Tente novamente.');
          return;
        }
        it.bloqueadaParaReprocessamentoAutomatico = bloquear;
        state.itens = upsertItem(state.itens, clonarItem(it));
        state.flashLista = bloquear
          ? '✓ Avaliação bloqueada para reprocessamento automático em lote.'
          : '✓ Avaliação desbloqueada para reprocessamento automático em lote.';
        render();
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

    /* ===================== CONFIGURAÇÃO DOS MOTORES =====================
       Entrada ÚNICA e consolidada para os dois motores (item 16 do pedido)
       — NUNCA a mesma tela de "⚙ Configuração dos Questionários" acima
       (aquela edita REDAÇÃO das perguntas P1-P16/S1-S8; esta edita a
       LÓGICA de decisão de cada motor: condições e precedência). O motor
       arquitetural (P1-P16) é administrado aqui mesmo, com o mesmo padrão
       técnico de motor-squad.js (RASCUNHO → SIMULAÇÃO → PUBLICAÇÃO,
       versoes/<n> nunca sobrescritas, validação antes de publicar). O
       motor de squad continua com a tela já criada pela PR #240
       (avaliacao-squad.js) — não duplicada aqui, só alcançável por um
       botão que chama window.faAvaliacaoSquad.abrirMotorConfig(). */
    var CAMADAS_LABEL_POR_ID = {};
    CAMADAS.forEach(function (c) { CAMADAS_LABEL_POR_ID[c.id] = c.label; });
    function abrirConfigMotores() {
      state.configMotores = { sub: 'painel', flash: null };
      state.tela = 'config-motores';
      render();
    }
    function voltarPainelConfigMotores() {
      state.configMotores = { sub: 'painel', flash: state.configMotores && state.configMotores.flash };
      render();
    }
    function renderConfigMotores() {
      var c = state.configMotores;
      var html = '<button class="avp-voltar-link" id="avpMotoresVoltarLista">‹ Avaliações de Produto/Serviço</button>';
      html += '<div class="avp-config-motores">';
      if (c.sub === 'painel') html += renderMotoresPainel();
      else if (c.sub === 'editar-regras') html += renderMotorArqEditarRegras();
      else if (c.sub === 'simulacao') html += renderMotorArqSimulacao();
      else if (c.sub === 'conflito-publicacao') html += renderMotorArqConflitoPublicacao();
      else if (c.sub === 'comparar-alteracoes') html += renderMotorArqCompararAlteracoes();
      else if (c.sub === 'editar-textos') html += renderMotorArqEditarTextos();
      else if (c.sub === 'auditoria') html += renderMotorArqAuditoria();
      else if (c.sub === 'versoes') html += renderMotorArqVersoes();
      html += '</div>';
      wrap.innerHTML = html;
      document.getElementById('avpMotoresVoltarLista').addEventListener('click', function () { state.tela = 'lista'; state.configMotores = null; render(); });
      if (c.sub === 'painel') bindMotoresPainel();
      else if (c.sub === 'editar-regras') bindMotorArqEditarRegras();
      else if (c.sub === 'simulacao') bindMotorArqSimulacao();
      else if (c.sub === 'conflito-publicacao') bindMotorArqConflitoPublicacao();
      else if (c.sub === 'comparar-alteracoes') bindMotorArqCompararAlteracoes();
      else if (c.sub === 'editar-textos') bindMotorArqEditarTextos();
      else if (c.sub === 'auditoria') bindMotorArqAuditoria();
      else if (c.sub === 'versoes') bindMotorArqVersoes();
    }

    /* ---- PAINEL (visão geral dos dois motores) ---- */
    function renderMotoresPainel() {
      var c = state.configMotores;
      var sitArq = window.faMotorArquitetura.situacao();
      var html = '<div class="avp-form-card"><h3>⚙ Configuração dos Motores</h3>';
      html += '<p class="avp-decisao-aviso">Os dois motores decidem por condições lógicas e precedência — nunca peso, pontuação ou contagem de respostas SIM. Alterar a lógica cria uma versão nova; alterar só a redação nunca versiona o motor.</p></div>';
      if (c.flash) html += '<p class="avp-flash-success">' + esc(c.flash) + '</p>';

      html += '<div class="avp-form-card"><h4>Motor de Classificação Arquitetural (P1-P16)</h4>';
      html += '<p>Versão publicada: <strong>' + esc(sitArq.versaoPublicada) + '</strong> · Status: ' + (sitArq.temRascunho ? '<strong>há um rascunho não publicado</strong>' : 'Publicada') + ' · Regras: ' + esc(sitArq.qtdRegras) + '</p>';
      html += '<p>Última publicação: ' + (sitArq.ultimaAlteracaoEm ? esc(fmtData(sitArq.ultimaAlteracaoEm)) + (sitArq.ultimaAlteracaoPor ? ' · ' + esc(sitArq.ultimaAlteracaoPor) : '') : 'nunca alterado (regras de fábrica, migradas de identificarCamada)') + '</p>';
      html += '<div class="avp-actions-footer">';
      html += '<button class="btn btn--sm" id="avpMotorArqEditarBtn">Editar regras</button>';
      html += '<button class="btn btn--sm" id="avpMotorArqTextosBtn">Editar textos</button>';
      html += '<button class="btn btn--sm" id="avpMotorArqVersoesBtn">Versões publicadas</button>';
      html += '<button class="btn btn--sm" id="avpMotorArqAuditoriaBtn">Histórico de alterações</button>';
      html += '</div></div>';

      html += '<div class="avp-form-card"><h4>Motor de Adequação à Gestão por Squad (S1-S8)</h4>';
      if (window.faAvaliacaoSquad && window.faMotorSquad) {
        var sitSquad = window.faMotorSquad.situacao();
        html += '<p>Versão publicada: <strong>' + esc(sitSquad.versaoPublicada) + '</strong> · Status: ' + (sitSquad.temRascunho ? '<strong>há um rascunho não publicado</strong>' : 'Publicada') + '</p>';
        html += '<div class="avp-actions-footer"><button class="btn btn--sm" id="avpMotorSquadAbrirBtn">Abrir configuração do motor de squad</button></div>';
      } else {
        html += '<p class="admin-empty">Módulo de squad não carregado.</p>';
      }
      html += '</div>';
      return html;
    }
    function bindMotoresPainel() {
      document.getElementById('avpMotorArqEditarBtn').addEventListener('click', function () {
        state.configMotores = {
          sub: 'editar-regras', regras: window.faMotorArquitetura.iniciarOuObterRascunhoRegras(),
          versaoBase: window.faMotorArquitetura.versaoBaseDoRascunho(), erro: null, salvando: false
        };
        render();
      });
      document.getElementById('avpMotorArqTextosBtn').addEventListener('click', function () {
        state.configMotores = { sub: 'editar-textos', textos: JSON.parse(JSON.stringify(window.faMotorArquitetura.textosAtuais())), salvando: false };
        render();
      });
      document.getElementById('avpMotorArqVersoesBtn').addEventListener('click', function () {
        state.configMotores = { sub: 'versoes' };
        render();
      });
      document.getElementById('avpMotorArqAuditoriaBtn').addEventListener('click', function () {
        state.configMotores = { sub: 'auditoria', lista: null };
        render();
        window.faMotorArquitetura.auditoria(function (lista) {
          if (state.configMotores && state.configMotores.sub === 'auditoria') { state.configMotores.lista = lista; render(); }
        });
      });
      var squadBtn = document.getElementById('avpMotorSquadAbrirBtn');
      if (squadBtn) squadBtn.addEventListener('click', function () {
        state.tela = 'lista'; state.configMotores = null;
        window.faAvaliacaoSquad.abrirMotorConfig();
      });
    }

    /* ---- EDITAR REGRAS — lista ÚNICA e ordenada (diferente do squad, que
       tem 3 grupos eixoA/eixoB/combinacao): o motor arquitetural sempre foi
       UMA cadeia de precedência só, exatamente como identificarCamada. Só
       as FOLHAS (campo/valor) são editáveis — mesma restrição de squad
       (item 18 do pedido: P1-P16 nunca em texto livre, só listas
       controladas). */
    function renderCondicaoArqEditavel(cond, leafRefs, prefixo) {
      if (!cond || typeof cond !== 'object') return '<p class="avp-error-msg">' + prefixo + '(regra sem condições — configuração inválida)</p>';
      if (Array.isArray(cond.all)) {
        if (!cond.all.length) return '<p class="sq-cond-rotulo">' + prefixo + '(sempre — regra de encerramento/fallback)</p>';
        return '<div class="sq-cond-grupo"><p class="sq-cond-rotulo">' + prefixo + 'TODAS as condições:</p>' +
          cond.all.map(function (c) { return renderCondicaoArqEditavel(c, leafRefs, prefixo + '　'); }).join('') + '</div>';
      }
      if (Array.isArray(cond.any)) {
        return '<div class="sq-cond-grupo"><p class="sq-cond-rotulo">' + prefixo + 'QUALQUER uma destas condições:</p>' +
          cond.any.map(function (c) { return renderCondicaoArqEditavel(c, leafRefs, prefixo + '　'); }).join('') + '</div>';
      }
      if (cond.not) {
        return '<div class="sq-cond-grupo"><p class="sq-cond-rotulo">' + prefixo + 'NENHUMA destas condições:</p>' + renderCondicaoArqEditavel(cond.not, leafRefs, prefixo + '　') + '</div>';
      }
      var id = leafRefs.length;
      leafRefs.push(cond);
      var campo = cond.campo || cond.pergunta;
      var valorAtual = (cond.valor != null ? cond.valor : cond.resposta || 'SIM').toUpperCase();
      return '<p class="sq-cond-folha">' + prefixo + esc(campo) + ' | igual a | ' +
        '<select class="sq-cond-select" data-leaf-id="' + id + '">' +
        '<option value="SIM"' + (valorAtual === 'SIM' ? ' selected' : '') + '>SIM</option>' +
        '<option value="NAO"' + (valorAtual === 'NAO' ? ' selected' : '') + '>NÃO</option>' +
        '</select></p>';
    }
    function renderMotorArqEditarRegras() {
      var c = state.configMotores;
      c.leafRefs = [];
      var html = '<div class="avp-form-card"><h3>Editar regras do motor arquitetural</h3>';
      html += '<p class="avp-decisao-aviso">A ordem abaixo é a PRECEDÊNCIA: a primeira regra cujas condições baterem decide a camada — nunca uma votação. Mudar o valor esperado (SIM/NÃO) de uma condição muda a lógica do motor; ao publicar, isso cria uma versão nova e nunca recalcula avaliações já concluídas sozinho. É preciso simular o impacto antes de publicar.</p></div>';
      c.regras.slice().sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0); }).forEach(function (regra) {
        html += '<div class="avp-form-card sq-regra-card"><p class="sq-regra-codigo">Precedência ' + esc(regra.ordem) + ' — ' + esc(regra.codigo) +
          ' → <strong>' + esc(CAMADAS_LABEL_POR_ID[regra.resultado] || regra.resultado) + '</strong>' +
          (regra.incoerencia ? ' <em>(incoerência)</em>' : '') +
          (regra.conflito ? ' <em>(conflito: ' + regra.conflito.map(function (id) { return CAMADAS_LABEL_POR_ID[id] || id; }).join(' × ') + ')</em>' : '') + '</p>';
        /* Fallback (tipo FALLBACK, ou o legado sem condicoes que o Firebase
           devolve) não tem condição nenhuma para desenhar — antes, abrir o
           editor numa versão publicada quebrava aqui (regra.condicoes
           undefined). */
        html += window.faMotorArquitetura.ehFallback(regra)
          ? '<p class="sq-cond-rotulo">(sempre que nenhuma regra anterior bater — regra de fallback)</p>'
          : renderCondicaoArqEditavel(regra.condicoes, c.leafRefs, '');
        html += '</div>';
      });
      if (c.erro) html += '<div class="avp-form-card"><p class="avp-error-msg">' + esc(Array.isArray(c.erro) ? c.erro.join(' ') : c.erro) + '</p></div>';
      html += '<div class="avp-actions-footer">';
      html += '<button class="btn" id="avpMotorArqSalvarRascunhoBtn"' + (c.salvando ? ' disabled' : '') + '>SALVAR RASCUNHO</button>';
      html += '<button class="btn btn--primary" id="avpMotorArqSimularBtn"' + (c.salvando ? ' disabled' : '') + '>SIMULAR IMPACTO</button>';
      html += '<button class="btn" id="avpMotorArqCancelarBtn"' + (c.salvando ? ' disabled' : '') + '>‹ Voltar</button>';
      html += '</div>';
      return html;
    }
    function bindMotorArqEditarRegras() {
      var c = state.configMotores;
      wrap.querySelectorAll('.sq-cond-select').forEach(function (sel) {
        sel.addEventListener('change', function () { c.leafRefs[Number(sel.dataset.leafId)].valor = sel.value; });
      });
      document.getElementById('avpMotorArqCancelarBtn').addEventListener('click', voltarPainelConfigMotores);
      document.getElementById('avpMotorArqSalvarRascunhoBtn').addEventListener('click', function () {
        if (c.salvando) return;
        c.salvando = true;
        render();
        window.faMotorArquitetura.salvarRascunhoRegras(c.regras, sessaoAtual(), function (err) {
          c.salvando = false;
          if (err) { c.erro = 'Não foi possível salvar o rascunho. Tente novamente.'; render(); return; }
          state.configMotores.flash = '✓ Rascunho de regras salvo.';
          voltarPainelConfigMotores();
        }, c.versaoBase);
      });
      document.getElementById('avpMotorArqSimularBtn').addEventListener('click', function () {
        var erros = window.faMotorArquitetura.validarRegras({ regras: c.regras });
        if (erros.length) { c.erro = erros; render(); return; }
        var concluidas = state.itens.filter(function (it) { return !it.excluido && it.status === 'concluido'; });
        var simulacao = window.faMotorArquitetura.simular(c.regras, concluidas, respostasArqParaCodigo);
        state.configMotores = { sub: 'simulacao', regras: c.regras, versaoBase: c.versaoBase, simulacao: simulacao, salvando: false };
        render();
      });
    }
    /* Converte item.respostas (ids internos) para o mapa P1-P16 que o motor
       declarativo entende — usado só pela simulação (o motor NUNCA lê
       avaliacoes-produto nem conhece ids internos sozinho). */
    function respostasArqParaCodigo(item) {
      var r = item.respostas || {};
      var contexto = {};
      TODAS_PERGUNTAS.forEach(function (def) { contexto[def.codigoEstavel] = (r[def.id] && r[def.id].valor === 'sim') ? 'SIM' : 'NAO'; });
      return contexto;
    }

    /* ---- SIMULAÇÃO (item 20 do pedido) ---- */
    function renderMotorArqSimulacao() {
      var c = state.configMotores;
      var s = c.simulacao;
      var html = '<div class="avp-form-card"><h3>Simulação de impacto</h3>';
      html += '<p class="avp-decisao-aviso">Nenhuma avaliação foi alterada — isto só simula a regra candidata sobre as avaliações já concluídas.</p>';
      html += '<p>' + esc(s.totalAnalisadas) + ' avaliaç' + (s.totalAnalisadas === 1 ? 'ão analisada' : 'ões analisadas') + '</p>';
      html += '<p>' + esc(s.mantidas) + ' manteriam a classificação</p>';
      html += '<p>' + esc(s.mudariam.length) + ' mudariam</p></div>';
      if (s.mudariam.length) {
        html += '<div class="avp-form-card"><h4>Avaliações que mudariam</h4>';
        html += '<div class="table-scroll-wrap"><table class="admin-table"><thead><tr><th>Item</th><th>Resultado atual</th><th>Resultado proposto</th></tr></thead><tbody>';
        s.mudariam.forEach(function (m) {
          html += '<tr><td data-label="Item">' + esc(m.itemNome) + '</td>' +
            '<td data-label="Resultado atual">' + esc(CAMADAS_LABEL_POR_ID[m.atual] || m.atual) + '</td>' +
            '<td data-label="Resultado proposto">' + esc(CAMADAS_LABEL_POR_ID[m.nova] || m.nova) + '</td></tr>';
        });
        html += '</tbody></table></div></div>';
      }
      if (c.erro) html += '<div class="avp-form-card"><p class="avp-error-msg">' + esc(c.erro) + '</p></div>';
      html += '<div class="avp-actions-footer">';
      html += '<button class="btn" id="avpMotorArqVoltarEdicaoBtn"' + (c.salvando ? ' disabled' : '') + '>‹ VOLTAR PARA EDIÇÃO</button>';
      html += '<button class="btn btn--primary" id="avpMotorArqConfirmarPublicarBtn"' + (c.salvando ? ' disabled' : '') + '>' + (c.salvando ? 'PUBLICANDO…' : 'PUBLICAR NOVA VERSÃO') + '</button>';
      html += '</div>';
      return html;
    }
    function bindMotorArqSimulacao() {
      var c = state.configMotores;
      document.getElementById('avpMotorArqVoltarEdicaoBtn').addEventListener('click', function () {
        state.configMotores = { sub: 'editar-regras', regras: c.regras, versaoBase: c.versaoBase, salvando: false };
        render();
      });
      document.getElementById('avpMotorArqConfirmarPublicarBtn').addEventListener('click', function () {
        if (c.salvando) return;
        c.salvando = true;
        render();
        window.faMotorArquitetura.publicarRegras(c.regras, sessaoAtual(), function (err, info) {
          c.salvando = false;
          if (err === 'conflito') {
            state.configMotores = {
              sub: 'conflito-publicacao', regras: c.regras,
              versaoBase: info.versaoBase, versaoAtual: info.versaoAtual, salvando: false
            };
            render();
            return;
          }
          if (err) {
            c.erro = err === 'validacao' && Array.isArray(info) ? info.join(' ') : 'Não foi possível publicar. Tente novamente.';
            render();
            return;
          }
          state.configMotores = { sub: 'painel', flash: info && info.semMudanca
            ? 'As regras publicadas já são idênticas às do rascunho — nenhuma versão nova foi criada.'
            : '✓ Nova versão das regras publicada com sucesso.' };
          render();
        });
      });
    }

    /* ---- CONFLITO DE PUBLICAÇÃO (edição concorrente — item 8-10 do pedido) ----
       Nunca oferece sobrescrever silenciosamente: as três únicas saídas são
       recarregar a versão vigente (descarta o rascunho e recomeça a edição
       a partir dela), comparar as alterações do rascunho contra o que está
       publicado agora, ou descartar o rascunho de vez. */
    function renderMotorArqConflitoPublicacao() {
      var c = state.configMotores;
      var html = '<div class="avp-form-card"><h3>Conflito de publicação</h3>';
      html += '<p class="avp-error-msg">Não foi possível publicar porque o motor foi alterado por outro usuário desde que você iniciou esta edição.</p>';
      html += '<p>Sua versão base: <strong>' + esc(c.versaoBase) + '</strong></p>';
      html += '<p>Versão publicada atual: <strong>' + esc(c.versaoAtual) + '</strong></p>';
      html += '</div>';
      html += '<div class="avp-actions-footer">';
      html += '<button class="btn btn--primary" id="avpMotorArqConflitoRecarregarBtn">RECARREGAR VERSÃO ATUAL</button>';
      html += '<button class="btn" id="avpMotorArqConflitoCompararBtn">COMPARAR ALTERAÇÕES</button>';
      html += '<button class="btn" id="avpMotorArqConflitoDescartarBtn">DESCARTAR MEU RASCUNHO</button>';
      html += '</div>';
      return html;
    }
    function bindMotorArqConflitoPublicacao() {
      var c = state.configMotores;
      document.getElementById('avpMotorArqConflitoRecarregarBtn').addEventListener('click', function () {
        window.faMotorArquitetura.descartarRascunhoRegras(function () {
          state.configMotores = {
            sub: 'editar-regras', regras: window.faMotorArquitetura.iniciarOuObterRascunhoRegras(),
            versaoBase: window.faMotorArquitetura.versaoBaseDoRascunho(), erro: null, salvando: false
          };
          render();
        });
      });
      document.getElementById('avpMotorArqConflitoCompararBtn').addEventListener('click', function () {
        var atuais = window.faMotorArquitetura.regrasDaVersao(window.faMotorArquitetura.versaoAtual()).regras;
        var alteradas = window.faMotorArquitetura.diffRegras(atuais, c.regras);
        state.configMotores = {
          sub: 'comparar-alteracoes', regras: c.regras, versaoBase: c.versaoBase,
          versaoAtual: c.versaoAtual, alteradas: alteradas
        };
        render();
      });
      document.getElementById('avpMotorArqConflitoDescartarBtn').addEventListener('click', function () {
        window.faMotorArquitetura.descartarRascunhoRegras(function (err) {
          if (err) { avpAlert('Não foi possível descartar o rascunho. Tente novamente.'); return; }
          state.configMotores = { sub: 'painel', flash: 'Rascunho descartado.' };
          render();
        });
      });
    }

    /* ---- COMPARAR ALTERAÇÕES (rascunho vs. versão publicada agora) ---- */
    function renderMotorArqCompararAlteracoes() {
      var c = state.configMotores;
      var html = '<div class="avp-form-card"><h3>Comparação: seu rascunho × versão publicada atual</h3>';
      html += '<p class="avp-decisao-aviso">Sua versão base: ' + esc(c.versaoBase) + ' · Versão publicada atual: ' + esc(c.versaoAtual) + '</p></div>';
      if (!c.alteradas.length) {
        html += '<div class="avp-form-card"><p class="admin-empty">Nenhuma diferença lógica entre seu rascunho e a versão publicada atual.</p></div>';
      } else {
        c.alteradas.forEach(function (alt) {
          html += '<div class="avp-form-card sq-regra-card"><p class="sq-regra-codigo">Regra ' + esc(alt.codigo) + '</p>';
          html += '<p><strong>Publicada agora:</strong> ' + (alt.antigo ? esc(JSON.stringify(alt.antigo)) : '<em>(regra removida no seu rascunho)</em>') + '</p>';
          html += '<p><strong>No seu rascunho:</strong> ' + (alt.novo ? esc(JSON.stringify(alt.novo)) : '<em>(regra não existe no seu rascunho)</em>') + '</p></div>';
        });
      }
      html += '<div class="avp-actions-footer">';
      html += '<button class="btn" id="avpMotorArqCompararVoltarBtn">‹ Voltar ao conflito</button>';
      html += '</div>';
      return html;
    }
    function bindMotorArqCompararAlteracoes() {
      var c = state.configMotores;
      document.getElementById('avpMotorArqCompararVoltarBtn').addEventListener('click', function () {
        state.configMotores = { sub: 'conflito-publicacao', regras: c.regras, versaoBase: c.versaoBase, versaoAtual: c.versaoAtual, salvando: false };
        render();
      });
    }

    /* ---- EDITAR TEXTOS (só rótulos de camada — publicação imediata, nunca versiona) ---- */
    function renderMotorArqEditarTextos() {
      var c = state.configMotores;
      var html = '<div class="avp-form-card"><h3>Editar textos das classificações</h3>';
      html += '<p class="avp-decisao-aviso">Altera só o rótulo exibido para cada classificação — nunca muda a lógica do motor nem a versão publicada.</p></div>';
      CAMADAS.forEach(function (camada) {
        var t = c.textos[camada.id] || { rotulo: camada.label };
        html += '<div class="avp-form-card"><p class="avp-alt-label">Código: <strong>' + esc(camada.id) + '</strong> <span class="avp-config-readonly-tag">(somente leitura)</span></p>';
        html += '<div class="avp-field"><label>Rótulo</label><input type="text" class="sq-texto-rotulo" data-codigo="' + camada.id + '" value="' + esc(t.rotulo) + '"></div></div>';
      });
      if (c.flash) html += '<p class="avp-flash-success">' + esc(c.flash) + '</p>';
      if (c.erro) html += '<p class="avp-error-msg">' + esc(c.erro) + '</p>';
      html += '<div class="avp-actions-footer">';
      html += '<button class="btn btn--primary" id="avpMotorArqPublicarTextosBtn"' + (c.salvando ? ' disabled' : '') + '>' + (c.salvando ? 'PUBLICANDO…' : 'PUBLICAR TEXTOS') + '</button>';
      html += '<button class="btn" id="avpMotorArqCancelarTextosBtn"' + (c.salvando ? ' disabled' : '') + '>‹ Voltar</button>';
      html += '</div>';
      return html;
    }
    function bindMotorArqEditarTextos() {
      var c = state.configMotores;
      wrap.querySelectorAll('.sq-texto-rotulo').forEach(function (input) {
        input.addEventListener('input', function () {
          c.textos[input.dataset.codigo] = c.textos[input.dataset.codigo] || {};
          c.textos[input.dataset.codigo].rotulo = input.value;
        });
      });
      document.getElementById('avpMotorArqCancelarTextosBtn').addEventListener('click', voltarPainelConfigMotores);
      document.getElementById('avpMotorArqPublicarTextosBtn').addEventListener('click', function () {
        if (c.salvando) return;
        c.salvando = true;
        render();
        window.faMotorArquitetura.salvarTextos(c.textos, sessaoAtual(), function (err) {
          c.salvando = false;
          if (err) { c.erro = 'Não foi possível publicar os textos. Tente novamente.'; render(); return; }
          state.configMotores = { sub: 'painel', flash: '✓ Textos publicados com sucesso.' };
          render();
        });
      });
    }

    /* ---- AUDITORIA ---- */
    function renderMotorArqAuditoria() {
      var c = state.configMotores;
      var html = '<div class="avp-form-card"><h3>Histórico de alterações do motor arquitetural</h3></div>';
      if (!c.lista) { html += '<p class="loading-msg">Carregando…</p>'; return html; }
      if (!c.lista.length) { html += '<p class="admin-empty">Nenhuma alteração registrada ainda.</p>'; return html; }
      html += '<div class="table-scroll-wrap"><table class="admin-table"><thead><tr><th>Tipo</th><th>Campo</th><th>Usuário</th><th>Data</th><th>Versão</th></tr></thead><tbody>';
      c.lista.forEach(function (a) {
        var tipoLabel = a.tipo === 'regra' ? 'Regra' : a.tipo === 'texto' ? 'Texto'
          : a.tipo === 'conflito_publicacao' ? 'Conflito de publicação (bloqueado)'
          : a.tipo === 'reconciliacao_versao_equivalente' ? 'Reconciliação com versão equivalente' : 'Publicação sem alteração';
        var versaoCol = a.tipo === 'conflito_publicacao'
          ? 'tentativa com base ' + esc(a.versaoBase) + ' — vigente ' + esc(a.versaoAtual)
          : a.tipo === 'reconciliacao_versao_equivalente'
            ? esc(a.versaoAnterior) + ' → ' + esc(a.versaoAtual) + ' (equivalentes: ' + esc(a.diferencasSemanticas) + ' diferenças em ' + esc(fmtNumero(a.combinacoesAnalisadas)) + ' combinações; sem versão nova)'
            : (a.versaoAnterior === a.novaVersao ? 'sem versão nova (' + esc(a.versaoAnterior) + ')' : esc(a.versaoAnterior) + ' → ' + esc(a.novaVersao));
        var campoCol = a.campo ? esc(a.campo)
          : a.tipo === 'reconciliacao_versao_equivalente' ? esc(a.quantidade) + ' avaliaç' + (a.quantidade === 1 ? 'ão' : 'ões')
          : (a.tipo === 'conflito_publicacao' && a.origem ? esc(a.origem) : '—');
        html += '<tr><td data-label="Tipo">' + tipoLabel + '</td>' +
          '<td data-label="Campo">' + campoCol + '</td>' +
          '<td data-label="Usuário">' + esc((a.usuario && (a.usuario.name || a.usuario.email)) || '—') + '</td>' +
          '<td data-label="Data">' + fmtData(a.dataHora) + '</td>' +
          '<td data-label="Versão">' + versaoCol + '</td></tr>';
      });
      html += '</tbody></table></div>';
      html += '<div class="avp-actions-footer"><button class="btn" id="avpMotorArqVoltarAuditoriaBtn">‹ Voltar</button></div>';
      return html;
    }
    function bindMotorArqAuditoria() {
      var btn = document.getElementById('avpMotorArqVoltarAuditoriaBtn');
      if (btn) btn.addEventListener('click', voltarPainelConfigMotores);
    }

    /* ---- VERSÕES PUBLICADAS (rollback) ---- */
    function renderMotorArqVersoes() {
      var versoes = window.faMotorArquitetura.listarVersoes();
      var atual = window.faMotorArquitetura.versaoAtual();
      var html = '<div class="avp-form-card"><h3>Versões publicadas do motor arquitetural</h3>' +
        '<p class="avp-decisao-aviso">Restaurar uma versão anterior cria uma versão NOVA com aquele conjunto de regras — nunca reescreve o histórico nem toca em avaliações já concluídas.</p></div>';
      html += '<div class="table-scroll-wrap"><table class="admin-table"><thead><tr><th>Versão</th><th>Situação</th><th>Ações</th></tr></thead><tbody>';
      versoes.forEach(function (v) {
        html += '<tr><td data-label="Versão">' + esc(v) + '</td><td data-label="Situação">' + (v === atual ? 'Vigente' : '—') + '</td>' +
          '<td data-label="Ações">' + (v === atual ? '' : '<button class="btn btn--sm avp-motor-arq-restaurar-btn" data-versao="' + v + '">Restaurar como nova versão</button>') + '</td></tr>';
      });
      html += '</tbody></table></div>';
      html += '<div class="avp-actions-footer"><button class="btn" id="avpMotorArqVoltarVersoesBtn">‹ Voltar</button></div>';
      return html;
    }
    function bindMotorArqVersoes() {
      document.getElementById('avpMotorArqVoltarVersoesBtn').addEventListener('click', voltarPainelConfigMotores);
      wrap.querySelectorAll('.avp-motor-arq-restaurar-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          avpConfirm('Restaurar a versão ' + btn.dataset.versao + ' como uma versão nova das regras?', function () {
            window.faMotorArquitetura.publicarVersaoAnterior(Number(btn.dataset.versao), sessaoAtual(), function (err) {
              if (err) { avpAlert('Não foi possível restaurar. Tente novamente.'); return; }
              state.configMotores = { sub: 'painel', flash: '✓ Versão restaurada como uma versão nova.' };
              render();
            });
          });
        });
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
          var conteudo = conteudoDe(def, a.questionnaireContentVersion);
          var obsAnterior = (a.respostas[id] && a.respostas[id].observacao) || '';
          /* Snapshot gravado NO MOMENTO da resposta (item 7 da parametrização
             de questionários): preserva a redação exata que a pessoa viu,
             mesmo que a pergunta seja reescrita depois — nunca alterado
             retroativamente por uma republicação de conteúdo. */
          a.respostas[id] = {
            valor: valor,
            justificativaAuto: valor === 'sim' ? conteudo.justSim : conteudo.justNao,
            observacao: obsAnterior,
            codigoPergunta: def.codigoEstavel,
            textoPerguntaNaEpoca: conteudo.texto,
            tituloNaEpoca: conteudo.titulo || null,
            questionnaireContentVersion: a.questionnaireContentVersion
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
          state.especializacaoForm = especializacaoFormInicial(payload);
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
      var conteudo = conteudoDe(def, state.atual.questionnaireContentVersion);
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
      html += '<p class="avp-question-text">' + esc(conteudo.texto) + '</p>';
      html += '<span class="avp-question-progresso">' + numeroGlobal(def) + '/' + TODAS_PERGUNTAS.length + '</span>';
      html += '<button type="button" class="avp-help-btn" data-id="' + def.id + '" aria-label="Ajuda sobre este critério">?</button>';
      html += '</div>';
      if (conteudo.exemplos) {
        html += '<p class="avp-exemplos">Exemplos: ' + esc(conteudo.exemplos.join('; ')) + '.</p>';
      }
      html += '<div class="avp-help-box" id="avpHelp-' + def.id + '" hidden>';
      if (conteudo.textoAjuda) {
        html += '<p><strong>O que significa:</strong> ' + esc(conteudo.textoAjuda.significado) + '</p>';
        if (conteudo.textoAjuda.quandoSim) html += '<p><strong>Quando marcar SIM:</strong> ' + esc(conteudo.textoAjuda.quandoSim) + '</p>';
        if (conteudo.textoAjuda.quandoNao) html += '<p><strong>Quando marcar NÃO:</strong> ' + esc(conteudo.textoAjuda.quandoNao) + '</p>';
        if (conteudo.exemplo) html += '<p><strong>Exemplo:</strong> ' + esc(conteudo.exemplo) + '</p>';
      } else {
        if (conteudo.ajudaExtra) html += '<p>' + esc(conteudo.ajudaExtra) + '</p>';
        html += '<p><strong>Se SIM:</strong> ' + esc(semPrefixo(conteudo.justSim)) + '</p>';
        html += '<p><strong>Se NÃO:</strong> ' + esc(semPrefixo(conteudo.justNao)) + '</p>';
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
        especializacaoCadastrada: (a.especializacaoCadastrada || '').trim() || null,
        papelEstruturalCadastrado: normalizarPapelEstrutural(a.papelEstruturalCadastrado),
        respostas: a.respostas || {},
        /* Versão do CONTEÚDO do questionário (título/texto/ajuda/
           justificativas de P1-P16) vigente quando esta avaliação foi
           INICIADA — fixada uma única vez (ver novoBtn/abrirReavaliacao/
           duplicar) e nunca trocada sozinha, mesmo que uma nova versão seja
           publicada enquanto esta avaliação ainda está em rascunho (item 14
           da parametrização de questionários: avaliação em andamento nunca
           troca de questionário no meio). Eixo TOTALMENTE independente de
           motorVersion — nunca incrementado nem lido por precisaReprocessar. */
        questionnaireContentVersion: a.questionnaireContentVersion || window.faQuestionarios.versaoAtual(CODIGO_QUESTIONARIO),
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
        decisaoConfirmada: false,
        justificativaDecisao: null,
        naturezaComplementar: null, /* acompanha a decisão: nova conclusão = decisão zerada */
        alteradoPor: null,
        alteradoEm: null,
        motorVersion: null,
        /* motorVersionArquitetura: eixo de versionamento TOTALMENTE
           independente de motorVersion (constante de código, ainda usada
           para mudanças de prosa/lógica que não vivem na configuração
           declarativa — motivoJustificativa, relacaoArquitetural, etc.,
           deliberadamente não migradas nesta PR), de motorSquadVersion e de
           questionnaireContentVersion. É a versão de motor-arquitetura-config
           (window.faMotorArquitetura.versaoAtual()) vigente quando a
           recomendação automática foi calculada — só avança quando uma
           CONDIÇÃO LÓGICA das regras P1-P16 muda (publicação de nova
           versão), nunca por texto. precisaReprocessar considera os dois
           eixos: motor desatualizado em QUALQUER um dos dois já mostra o
           aviso "REPROCESSAR COM MOTOR ATUAL" (mesmo botão, mesmo fluxo). */
        motorVersionArquitetura: null,
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
        payload.motorVersionArquitetura = window.faMotorArquitetura.versaoAtual();
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
      } else if (podeReconciliar(a)) {
        /* Situação B: nunca oferece "reprocessar" — não há mudança lógica
           a recalcular (ver RECONCILIAR COM VERSÃO EQUIVALENTE). */
        var eqAtual = equivalenciaDoItem(a);
        html += '<div class="avp-form-card avp-motor-aviso avp-motor-aviso--equivalente" id="avpAvisoEquivalente">';
        html += '<p class="avp-motor-aviso-texto">ℹ Esta avaliação foi processada pela versão ' + esc(a.motorVersionArquitetura) +
          ' das regras, comprovadamente equivalente à versão vigente (' + esc(eqAtual.versaoB) + '). Nada precisa ser recalculado.</p>';
        html += '<p class="avp-decisao-aviso">' + esc(textoProvaEquivalencia(eqAtual)) + '</p>';
        html += '<button type="button" class="btn btn--sm" id="avpReconciliarBtn"' + (state.reconciliando ? ' disabled' : '') + '>' +
          (state.reconciliando ? 'Reconciliando…' : 'RECONCILIAR COM VERSÃO EQUIVALENTE') + '</button>';
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
      /* Especialização/Papel estrutural aparecem SEMPRE, para qualquer
         classificação — nunca escondidas por causa da camada (mesma regra
         do PDF, ver rotuloEspecializacaoApresentacao/
         rotuloPapelEstruturalApresentacao). */
      html += '<p class="avp-alt-label">Especialização: <strong>' + esc(rotuloEspecializacaoApresentacao(camada)) + '</strong></p>';
      html += '<p class="avp-alt-label">Papel estrutural: <strong>' + esc(rotuloPapelEstruturalApresentacao(camada)) + '</strong></p>';
      if (camada.conflito && camada.conflito.length) {
        html += '<p class="avp-alt-outras">Categorias em conflito nas respostas: ' + esc(camada.conflito.join(', ')) + '.</p>';
      }
      if (camada.incoerencia) {
        html += '<p class="avp-alt-outras avp-incoerencia-msg">⚠ Há respostas que indicam autonomia e outras que indicam dependência. Revise os critérios destacados.</p>';
      }
      html += '</div>';

      if (CAMADAS_COM_ESPECIALIZACAO.indexOf(camada.id) !== -1) {
        html += renderEspecializacaoCadastradaCard(camada.id);
      }

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
      if (window.faAvaliacaoSquad) html += '<button class="btn btn--sm" id="avpAvaliarSquadBtn">🧭 AVALIAR ADEQUAÇÃO À SQUAD</button>';
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

      var reconciliarBtn = document.getElementById('avpReconciliarBtn');
      if (reconciliarBtn) {
        reconciliarBtn.addEventListener('click', function () {
          if (state.reconciliando || !podeReconciliar(a)) return;
          avpConfirm(
            'Isso NÃO recalcula nada: respostas, justificativas e classificação continuam exatamente iguais, e o motor não roda de novo. ' +
            'Só o número da versão do motor gravado nesta avaliação passa de ' + a.motorVersionArquitetura + ' para ' +
            window.faMotorArquitetura.versaoAtual() + ', com a versão anterior preservada no histórico e um registro na auditoria do motor.\n\n' +
            textoProvaEquivalencia(equivalenciaDoItem(a)),
            function () {
              state.reconciliando = true;
              render();
              reconciliarAvaliacoes([a], function () {}, function (resumo) {
                state.reconciliando = false;
                var atualizado = buscarItem(a._key);
                if (resumo.sucesso && atualizado) state.atual = clonarItem(atualizado);
                state.reconciliacaoLote = null;
                state.flashResultado = resumo.sucesso
                  ? '✓ Avaliação reconciliada com a versão ' + resumo.versaoDestino + ' do motor (sem recálculo).'
                  : null;
                render();
                if (!resumo.sucesso) {
                  var problema = resumo.erros.concat(resumo.ignoradas)[0];
                  avpAlert('Não foi possível reconciliar esta avaliação' + (problema ? ': ' + problema.mensagem : '') + '.');
                }
              });
            });
        });
      }

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

      var especializacaoInput = document.getElementById('avpEspecializacaoCadastrada');
      if (especializacaoInput) {
        especializacaoInput.addEventListener('input', function () {
          state.especializacaoForm.valor = especializacaoInput.value;
          state.especializacaoForm.erro = null;
          state.flashEspecializacao = null;
          render();
        });
      }
      var papelEstruturalSelect = document.getElementById('avpPapelEstruturalCadastrado');
      if (papelEstruturalSelect) {
        papelEstruturalSelect.addEventListener('change', function () {
          state.especializacaoForm.papel = papelEstruturalSelect.value;
          state.especializacaoForm.erro = null;
          state.flashEspecializacao = null;
          render();
        });
      }
      var salvarEspecializacaoBtn = document.getElementById('avpSalvarEspecializacaoBtn');
      if (salvarEspecializacaoBtn) salvarEspecializacaoBtn.addEventListener('click', salvarEspecializacaoCadastrada);
      var flashEspecializacaoClose = document.getElementById('avpFlashEspecializacaoClose');
      if (flashEspecializacaoClose) flashEspecializacaoClose.addEventListener('click', function () { state.flashEspecializacao = null; render(); });

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
      var avaliarSquadBtn = document.getElementById('avpAvaliarSquadBtn');
      if (avaliarSquadBtn) {
        avaliarSquadBtn.addEventListener('click', function () {
          /* Adequação à squad é um eixo TOTALMENTE independente da
             classificação arquitetural (ver window.faAvaliacaoSquad) —
             este botão só entrega contexto (qual item, qual avaliação
             arquitetural estava aberta), nunca respostas nem classificação;
             a.itemId agrupa todas as reavaliações do mesmo item, então uma
             avaliação de squad iniciada aqui continua válida mesmo que o
             item seja reavaliado depois. */
          window.faAvaliacaoSquad.iniciarOuAbrirParaItem({ itemId: a.itemId || a._key, itemNome: a.nome, avaliacaoArquiteturalId: a._key });
        });
      }

      function voltarParaLista() {
        state.atual = null;
        state.flashResultado = null;
        state.flashDecisao = null;
        state.flashEspecializacao = null;
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
      var conteudo = conteudoSnapshotOuAtual(def, resposta, item);
      return '<div class="avp-reasoning-item">' +
        '<p class="avp-reasoning-q">' + numeroGlobal(def) + '. ' + esc(rotuloCompacto(def, conteudo)) + ' — ' + valor + '</p>' +
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
       época — nunca a atual, para não confundir qual era qual. Cada entrada
       também guarda uma cópia de respostas (h.respostas, com a
       "Interpretação do sistema" de cada pergunta como estava calculada por
       aquela versão do motor) — não tem tela própria para navegar isso hoje,
       mas o dado fica preservado, nunca perdido, caso vire necessário. */
    function renderHistoricoMotorCard(a) {
      if (!a.historicoMotor || !a.historicoMotor.length) return '';
      var html = '<div class="avp-form-card avp-historico-motor-card">';
      html += '<h4>Recomendações automáticas anteriores (motor desatualizado)</h4>';
      html += '<p class="avp-decisao-aviso">Substituídas ao reprocessar esta avaliação com uma versão mais nova do motor — a resposta SIM/NÃO e a observação do avaliador em cada pergunta nunca mudam; só a interpretação automática do sistema pode ser atualizada.</p>';
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

    /* Especialização CADASTRADA (metadado arquitetural, nunca inferido das
       respostas) — só faz sentido para camadas com eixo de especialização
       (ver especializacaoPara). Para Componente, o mesmo cartão também
       cadastra o Papel estrutural (Essencial/Opcional) — terceira dimensão
       independente, só relevante para essa camada (ver
       CAMADAS_COM_PAPEL_ESTRUTURAL). Editável a qualquer momento, mesmo
       depois de concluída, sem precisar de "Reavaliar": um único botão grava
       os dois campos cadastrados + os paths aninhados camadaSugerida/
       especializacao e camadaSugerida/papelEstrutural já recalculados (ver
       salvarEspecializacaoCadastrada) — nunca resultadoAutomatico, motivos,
       justificativaAutomatica ou decisão. */
    function renderEspecializacaoCadastradaCard(camadaId) {
      var f = state.especializacaoForm;
      var papelAplicavel = CAMADAS_COM_PAPEL_ESTRUTURAL.indexOf(camadaId) !== -1;
      var html = '<div class="avp-form-card avp-especializacao-cadastro-card">';
      html += '<h4>Especialização arquitetural (cadastro)</h4>';
      html += '<p class="avp-decisao-aviso">Metadado opcional, cadastrado à parte — nunca inferido das respostas do ' +
        'questionário. Preencha quando já se souber, por outra fonte, a natureza específica deste item (ex.: ' +
        '"Instituto previdenciário", "Benefício").</p>';
      html += '<div class="avp-field">';
      html += '<label for="avpEspecializacaoCadastrada">Especialização (opcional)</label>';
      html += '<input type="text" id="avpEspecializacaoCadastrada" value="' + esc(f.valor) + '" placeholder="Ex.: Instituto previdenciário">';
      html += '</div>';
      if (papelAplicavel) {
        html += '<div class="avp-field">';
        html += '<label for="avpPapelEstruturalCadastrado">Papel estrutural (opcional)</label>';
        html += '<select id="avpPapelEstruturalCadastrado">';
        html += '<option value=""' + (f.papel ? '' : ' selected') + '>Não determinado</option>';
        html += '<option value="essencial"' + (f.papel === 'essencial' ? ' selected' : '') + '>Essencial</option>';
        html += '<option value="opcional"' + (f.papel === 'opcional' ? ' selected' : '') + '>Opcional</option>';
        html += '</select>';
        html += '</div>';
      }
      if (f.erro) html += '<p class="avp-error-msg">' + esc(f.erro) + '</p>';
      if (state.flashEspecializacao) {
        html += '<p class="avp-flash-success avp-flash-success--inline" id="avpFlashEspecializacao">' + esc(state.flashEspecializacao) +
          ' <button type="button" class="avp-flash-close" id="avpFlashEspecializacaoClose" aria-label="Fechar">×</button></p>';
      }
      var estado = estadoBotaoEspecializacao(f, papelAplicavel);
      html += '<button class="btn btn--sm' + (estado.salva ? ' avp-btn-decisao--salva' : '') + '" id="avpSalvarEspecializacaoBtn"' +
        (estado.desabilitado ? ' disabled' : '') + '>' + esc(estado.label) + '</button>';
      html += '</div>';
      return html;
    }
    /* Mesmos três estados do botão de decisão, adaptados: nunca digitado/
       selecionado nada além do que já está salvo desabilita; mudar qualquer
       um dos dois campos aplicáveis habilita "SALVAR ESPECIALIZAÇÃO"; depois
       de salvo, sem mudança, mostra "✓ SALVO". papelAplicavel decide se o
       campo de papel estrutural entra na comparação de "sujo" — camadas sem
       esse eixo (tudo exceto Componente) nunca o consideram. */
    function estadoBotaoEspecializacao(f, papelAplicavel) {
      if (state.salvandoEspecializacao) return { label: 'SALVANDO…', desabilitado: true, salva: false };
      var dirtyEspec = (f.valor || '').trim() !== (f.ultimoSalvo || '').trim();
      var dirtyPapel = papelAplicavel && (f.papel || '') !== (f.papelUltimoSalvo || '');
      var dirty = dirtyEspec || dirtyPapel;
      if (dirty) return { label: 'SALVAR ESPECIALIZAÇÃO', desabilitado: false, salva: false };
      var jaSalvouAlgo = !!f.ultimoSalvo || (papelAplicavel && !!f.papelUltimoSalvo);
      return { label: jaSalvouAlgo ? '✓ SALVO' : 'SALVAR ESPECIALIZAÇÃO', desabilitado: true, salva: jaSalvouAlgo };
    }

    function renderDecisaoCard(a) {
      var f = state.decisaoForm;
      var html = '<div class="avp-form-card avp-decisao-card">';
      html += '<h4>Decisão arquitetural</h4>';
      html += '<p class="avp-decisao-aviso">Isto registra uma decisão sobre a CONCLUSÃO, sem alterar nenhuma resposta do questionário — ' +
        'a recomendação automática permanece intacta no histórico. Para mudar respostas ou justificativas, use "Reavaliar" na lista.</p>';
      if (a.decisaoManual) {
        /* Três informações SEPARADAS — a recomendação automática original
           nunca é escondida nem substituída pela decisão, e a natureza
           complementar (manual, fora do motor) nunca se confunde com a
           classificação. */
        html += '<dl class="avp-decisao-resumo" id="avpDecisaoResumo">';
        html += '<dt>Recomendação automática</dt><dd>' + esc(rotuloResultado(a.resultadoAutomatico)) + '</dd>';
        html += '<dt>Decisão arquitetural</dt><dd>' + esc(rotuloResultado(a.decisaoFinal)) + '</dd>';
        if (rotuloNaturezaDoItem(a)) html += '<dt>Natureza complementar</dt><dd>' + esc(rotuloNaturezaDoItem(a)) + '</dd>';
        html += '</dl>';
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
        /* Opcional, só em decisão manual; informação complementar, nunca a
           classificação (ver NATUREZAS_COMPLEMENTARES). */
        html += '<div class="avp-field">';
        html += '<label for="avpNaturezaComplementar">Natureza complementar <span class="avp-config-readonly-tag">(opcional — não altera a classificação nem o motor)</span></label>';
        html += '<select class="avp-select" id="avpNaturezaComplementar">';
        html += '<option value=""' + (!f.natureza ? ' selected' : '') + '>Nenhuma</option>';
        NATUREZAS_COMPLEMENTARES.forEach(function (n) {
          html += '<option value="' + esc(n.id) + '"' + (f.natureza === n.id ? ' selected' : '') + '>' + esc(n.label) + '</option>';
        });
        html += '</select></div>';
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
      var dirty = !decisaoIguais({ opcao: f.opcao, justificativa: f.justificativa, natureza: f.natureza }, f.ultimoSalvo);
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
      var naturezaSel = document.getElementById('avpNaturezaComplementar');
      if (naturezaSel) naturezaSel.addEventListener('change', function () {
        if (state.salvandoDecisao) return;
        state.decisaoForm.natureza = naturezaSel.value;
        state.flashDecisao = null;
        render();
      });
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
      var updates = { atualizadoEm: new Date().toISOString(), decisaoConfirmada: true };
      if (f.opcao === 'auto') {
        updates.decisaoFinal = a.resultadoAutomatico;
        updates.decisaoManual = false;
        updates.justificativaDecisao = null;
        updates.alteradoPor = null;
        updates.alteradoEm = null;
        updates.naturezaComplementar = null; /* só existe numa decisão manual */
      } else {
        var sess = sessaoAtual();
        updates.decisaoFinal = f.opcao;
        updates.decisaoManual = true;
        updates.justificativaDecisao = justificativa;
        updates.alteradoPor = sess;
        updates.alteradoEm = new Date().toISOString();
        updates.naturezaComplementar = registroNatureza(f.natureza);
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
        f.ultimoSalvo = { opcao: f.opcao, justificativa: f.justificativa, natureza: f.opcao === 'auto' ? '' : (f.natureza || '') };
        f.jaSalvouAntes = true;
        state.flashDecisao = '✓ Decisão salva com sucesso.';
        render();
      });
    }

    /* ===================== ESPECIALIZAÇÃO CADASTRADA =====================
       Metadado arquitetural cadastrado à parte (nunca inferido das 16
       respostas nem de uma pergunta nova — ambas proibidas): grava
       especializacaoCadastrada e, no mesmo update(), o valor já recalculado
       de camadaSugerida/especializacao (para a tela mostrar sem precisar de
       um reload) — usando o PRÓPRIO identificarCamada sobre as respostas já
       persistidas, então camada/resultadoAutomatico/motivos permanecem
       garantidamente os mesmos (dependem só de respostas, que não mudam
       aqui). Nunca toca em resultadoAutomatico, justificativaAutomatica,
       decisão arquitetural ou histórico. */
    function salvarEspecializacaoCadastrada() {
      if (state.salvandoEspecializacao) return;
      var a = state.atual;
      var f = state.especializacaoForm;
      var papelAplicavel = !!(a.camadaSugerida && CAMADAS_COM_PAPEL_ESTRUTURAL.indexOf(a.camadaSugerida.id) !== -1);
      if (estadoBotaoEspecializacao(f, papelAplicavel).desabilitado) return;
      var valor = (f.valor || '').trim();
      var papel = papelAplicavel ? (f.papel || '') : '';
      var itemRecalculo = Object.assign({}, a, { especializacaoCadastrada: valor, papelEstruturalCadastrado: papel || null });
      var identCalc = identificarCamada(itemRecalculo);
      var especializacaoRecalculada = identCalc.especializacao;
      var papelRecalculado = identCalc.papelEstrutural;
      var updates = {
        especializacaoCadastrada: valor || null,
        papelEstruturalCadastrado: papel || null,
        'camadaSugerida/especializacao': especializacaoRecalculada,
        'camadaSugerida/papelEstrutural': papelRecalculado,
        atualizadoEm: new Date().toISOString()
      };
      state.salvandoEspecializacao = true;
      render();

      var respondido = false;
      var relogio = setTimeout(function () {
        if (respondido) return;
        respondido = true;
        state.salvandoEspecializacao = false;
        f.erro = 'A conexão está demorando e não deu para confirmar o salvamento. Toque em "SALVAR ESPECIALIZAÇÃO" de novo.';
        render();
      }, 12000);

      db().ref(NODE + '/' + a._key).update(updates, function (err) {
        if (respondido) return;
        respondido = true;
        clearTimeout(relogio);
        state.salvandoEspecializacao = false;
        if (err) {
          console.error('[avaliacao-produto] erro ao salvar especialização arquitetural cadastrada:', err);
          render();
          avpAlert('Não foi possível salvar a especialização. Tente novamente.');
          return;
        }
        f.erro = null;
        a.especializacaoCadastrada = updates.especializacaoCadastrada;
        a.papelEstruturalCadastrado = updates.papelEstruturalCadastrado;
        a.atualizadoEm = updates.atualizadoEm;
        a.camadaSugerida = Object.assign({}, a.camadaSugerida, { especializacao: especializacaoRecalculada, papelEstrutural: papelRecalculado });
        state.itens = upsertItem(state.itens, clonarItem(a));
        f.ultimoSalvo = valor;
        f.papelUltimoSalvo = papel;
        state.flashEspecializacao = '✓ Especialização salva com sucesso.';
        render();
      });
    }

    /* ===================== REPROCESSAR COM MOTOR ATUAL =====================
       DIFERENTE de "Reavaliar": o dado do usuário nunca muda — nem a
       resposta SIM/NÃO, nem a observação que a pessoa digitou — só a SAÍDA
       do motor é recalculada com a versão ATUAL sobre as MESMAS respostas já
       persistidas: resultado, camada, especialização, papel estrutural,
       justificativa consolidada e, agora, também a "Interpretação do
       sistema" de cada uma das 16 perguntas (respostas[id].justificativaAuto
       — texto gerado pelo sistema a partir só de (pergunta, SIM/NÃO), nunca
       digitado por ninguém, então recalculá-lo não é reescrever histórico do
       usuário, é só atualizar uma saída do motor que ficou desatualizada).
       Nunca pede pra responder o questionário de novo, nunca abre o
       checklist, nunca cria uma versão nova (mesma chave, sem
       versao+1/versaoAnteriorKey) — é só a lógica automática que avança, não
       o conteúdo da avaliação. A recomendação automática anterior nunca é
       descartada: migra para historicoMotor (mais antiga primeiro, com uma
       cópia de respostas incluída, para nunca perder qual era a redação
       antiga) antes de ser substituída, o mesmo princípio de
       "resultadoAutomatico nunca é reescrito" que já vale pra decisão
       manual. Se a avaliação nunca teve decisão manual (decisaoManual=false,
       "aceita a recomendação do sistema"), decisaoFinal acompanha a nova
       recomendação — exatamente como já acontece ao concluir/aceitar;
       havendo decisão manual, ela e toda a sua auditoria (responsável, data,
       justificativa) ficam intocadas: reprocessar o motor nunca apaga nem
       reinterpreta uma decisão que um humano já tomou. */
    /* TRÊS situações do motor para uma avaliação concluída — nunca
       misturadas (rascunho não tem nenhuma: devolve null):
         'atual'       (A) mesma MOTOR_VERSION e mesma versão das regras;
         'equivalente' (B) mesma MOTOR_VERSION, versão das regras ANTERIOR,
                       mas COMPROVADAMENTE equivalente à vigente (prova
                       exaustiva das 65536 combinações sobre o retorno
                       completo do motor — ver
                       faMotorArquitetura.equivalenciaEntreVersoes). Não há
                       nada para recalcular: a ação é RECONCILIAR (só o
                       carimbo de versão muda), nunca reprocessar;
         'desatualizado' (C) qualquer outro caso — MOTOR_VERSION diferente
                       (código, não tem como provar equivalência), versão
                       das regras com mudança lógica real, versão ausente/
                       desconhecida, ou a configuração ainda não chegou
                       (sem prova, nunca se afirma equivalência). Ação:
                       REPROCESSAR COM MOTOR ATUAL, como sempre. */
    function situacaoMotor(it) {
      if (!it || it.status !== 'concluido') return null;
      if (it.motorVersion !== MOTOR_VERSION) return 'desatualizado';
      var vigente = window.faMotorArquitetura.versaoAtual();
      if (it.motorVersionArquitetura === vigente) return 'atual';
      var eq = equivalenciaDoItem(it);
      return eq && eq.equivalentes ? 'equivalente' : 'desatualizado';
    }
    function equivalenciaDoItem(it) {
      if (typeof it.motorVersionArquitetura !== 'number') return null;
      return window.faMotorArquitetura.equivalenciaEntreVersoes(it.motorVersionArquitetura, window.faMotorArquitetura.versaoAtual());
    }
    function precisaReprocessar(it) { return situacaoMotor(it) === 'desatualizado'; }
    function podeReconciliar(it) { return situacaoMotor(it) === 'equivalente'; }
    /* Só quem alimenta o "REPROCESSAR TUDO" em lote — o botão INDIVIDUAL
       continua obedecendo só precisaReprocessar, sem olhar pra esse
       bloqueio: bloquear é sobre não tocar sozinho num caso ainda em
       definição conceitual dentro de um lote automático, nunca sobre
       impedir uma ação explícita de quem já abriu aquela avaliação. */
    function elegivelParaReprocessamentoEmLote(it) {
      return precisaReprocessar(it) && !it.bloqueadaParaReprocessamentoAutomatico;
    }
    /* justificativaAuto é 100% determinado por (pergunta, SIM/NÃO) — olhe o
       clique de resposta no checklist, que grava exatamente
       "valor === 'sim' ? def.justSim : def.justNao" e nada mais. Por isso dá
       pra recalcular com segurança a qualquer momento a partir da definição
       ATUAL da pergunta (CRITERIOS/EXCLUSOES), sem precisar que ninguém
       clique de novo: nunca é um texto composto com dado do usuário. valor e
       observacao (a única coisa que a pessoa realmente escreveu) são
       copiados sem tocar. */
    function recalcularInterpretacoesRespostas(respostas, questionnaireContentVersion) {
      var novo = {};
      Object.keys(respostas || {}).forEach(function (id) {
        var r = respostas[id];
        var def = definicaoPorId(id);
        /* Usa a versão de CONTEÚDO já fixada nesta avaliação — reprocessar o
           MOTOR nunca migra uma avaliação pra uma redação de pergunta mais
           nova sozinho (isso é um eixo independente, nunca ligado a
           motorVersion — ver questionnaireContentVersion). */
        var conteudo = def ? conteudoDe(def, questionnaireContentVersion) : null;
        novo[id] = {
          valor: r.valor,
          justificativaAuto: conteudo ? (r.valor === 'sim' ? conteudo.justSim : conteudo.justNao) : r.justificativaAuto,
          observacao: r.observacao || '',
          codigoPergunta: def ? def.codigoEstavel : r.codigoPergunta,
          textoPerguntaNaEpoca: conteudo ? conteudo.texto : r.textoPerguntaNaEpoca,
          tituloNaEpoca: conteudo ? (conteudo.titulo || null) : (r.tituloNaEpoca || null),
          questionnaireContentVersion: questionnaireContentVersion || r.questionnaireContentVersion
        };
      });
      return novo;
    }
    /* Função PURA (sem Firebase, sem state) — a mesma rotina de cálculo usada
       tanto pelo botão individual "REPROCESSAR COM MOTOR ATUAL" quanto pelo
       "REPROCESSAR TUDO COM MOTOR ATUAL" em lote, para as duas nunca
       divergirem: um único lugar decide o que reprocessar significa. Recebe
       o item JÁ persistido e devolve só o objeto de updates a gravar — quem
       chama decide COMO gravar (um .update() com timeout/retry para o
       botão individual, vários em paralelo com tratamento de erro por item
       para o lote). */
    function construirAtualizacaoReprocessamento(a) {
      var calc = computeResultado(a);
      var novaJustificativa = gerarJustificativaAutomatica(a, calc);
      var entradaHistorico = {
        motorVersion: a.motorVersion || null,
        motorVersionArquitetura: a.motorVersionArquitetura || null,
        resultadoAutomatico: a.resultadoAutomatico,
        camadaSugerida: a.camadaSugerida,
        justificativaAutomatica: a.justificativaAutomatica,
        /* Cópia das respostas EXATAMENTE como estavam calculadas por esta
           versão do motor (incluindo a "Interpretação do sistema" antiga de
           cada pergunta) — nunca perde a redação anterior, mesmo depois de
           recalculada abaixo. */
        respostas: a.respostas,
        processadoEm: a.atualizadoEm || a.criadoEm
      };
      var agora = new Date().toISOString();
      var updates = {
        resultadoAutomatico: calc.resultadoAutomatico,
        criteriosEssenciaisFalhos: calc.essenciaisFalhos,
        exclusoesConflitantes: calc.exclusoesConflitantes,
        criteriosAtendidos: calc.criteriosAtendidos,
        camadaSugerida: calc.camadaSugerida,
        justificativaAutomatica: novaJustificativa,
        /* SIM/NÃO e a observação do avaliador seguem exatamente iguais —
           só a "Interpretação do sistema" de cada pergunta é atualizada
           para a redação vigente. Nunca abre o checklist, nunca pede pra
           responder de novo. */
        respostas: recalcularInterpretacoesRespostas(a.respostas, a.questionnaireContentVersion),
        motorVersion: MOTOR_VERSION,
        motorVersionArquitetura: window.faMotorArquitetura.versaoAtual(),
        reprocessedAt: agora,
        reprocessedFromVersion: a.motorVersion || null,
        historicoMotor: (a.historicoMotor || []).concat([entradaHistorico]),
        atualizadoEm: agora
      };
      /* "Aceitar recomendação do sistema" segue significando isso mesmo depois
         de reprocessado: decisaoFinal acompanha a nova recomendação. Uma
         decisão manual já registrada, ao contrário, não é uma opinião sobre O
         MOTOR — é uma divergência sobre a conclusão, e continua valendo até
         alguém trocá-la explicitamente em "Decisão arquitetural"; o motor
         pode divergir da decisão manual (fica visível comparando Resultado
         automático x Decisão final na tela/PDF/Excel), mas nunca a muda
         sozinho. */
      if (!a.decisaoManual) updates.decisaoFinal = calc.resultadoAutomatico;
      return updates;
    }
    function reprocessarMotor() {
      if (state.reprocessando) return;
      var a = state.atual;
      if (!precisaReprocessar(a)) return; /* já está na versão atual: nada a fazer */
      var updates = construirAtualizacaoReprocessamento(a);

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

    /* ===================== RECONCILIAR COM VERSÃO EQUIVALENTE =====================
       Para a situação B (ver situacaoMotor): a avaliação foi calculada numa
       versão anterior das regras que é COMPROVADAMENTE equivalente à
       vigente — nada novo para recalcular. Reprocessar aqui fingiria um
       recálculo que não existe (e reescreveria justificativas por nada);
       reconciliar só corrige o carimbo de versão, registrando o porquê.
       O que muda na avaliação: motorVersionArquitetura (versão antiga →
       vigente) e uma entrada nova em reconciliacoesVersao (histórico, com a
       versão anterior preservada e a prova). Nada mais: respostas,
       justificativas, resultado, classificação, decisão, atualizadoEm e
       historicoMotor ficam intactos, e o motor NÃO roda de novo.
       Segurança: nunca automática (sempre depois de uma confirmação
       explícita); a prova de equivalência é refeita na hora de gravar
       (bloqueia se houver qualquer diferença — use Reprocessar); cada
       avaliação é gravada numa transaction() que só aplica se ela AINDA
       estiver concluída, na mesma MOTOR_VERSION e na MESMA versão antiga
       provada (se alguém reprocessou/reavaliou no meio, ela é ignorada,
       nunca sobrescrita); nada age antes de a configuração do motor
       chegar do servidor (versaoAtual() valeria 1 por falta de dado). A
       auditoria do motor ganha uma entrada reconciliacao_versao_equivalente
       por par de versões, só com as avaliações efetivamente reconciliadas. */
    function elegivelParaReconciliacaoEmLote(it) {
      return podeReconciliar(it) && !it.bloqueadaParaReprocessamentoAutomatico;
    }
    function fmtNumero(n) { return Number(n).toLocaleString('pt-BR'); }
    function textoProvaEquivalencia(eq) {
      return 'Versão ' + eq.versaoA + ' × versão ' + eq.versaoB + ': ' + fmtNumero(eq.combinacoesAnalisadas) +
        ' combinações de respostas (P1-P16) comparadas pelo retorno completo do motor (camada, regra aplicada, motivos, conflito e incoerência) — ' +
        fmtNumero(eq.diferencas) + ' diferença' + (eq.diferencas === 1 ? '' : 's') + '.';
    }
    function renderBarraReconciliar(elegiveis) {
      if (!elegiveis.length) return '';
      var emAndamento = state.reconciliacaoLote && state.reconciliacaoLote.emAndamento;
      var html = '<div class="avp-form-card avp-reconciliar-bar" id="avpReconciliarBar">';
      html += '<p class="avp-reconciliar-texto">Existe' + (elegiveis.length === 1 ? '' : 'm') + ' ' + elegiveis.length + ' avaliaç' +
        (elegiveis.length === 1 ? 'ão' : 'ões') + ' em uma versão anterior semanticamente equivalente à versão atual. ' +
        'Nada precisa ser recalculado — só o registro da versão do motor.</p>';
      html += '<button class="btn btn--sm" id="avpReconciliarTudoBtn"' + (emAndamento ? ' disabled' : '') + '>RECONCILIAR ' +
        elegiveis.length + (elegiveis.length === 1 ? ' AVALIAÇÃO' : ' AVALIAÇÕES') + '</button>';
      html += '</div>';
      return html;
    }
    function renderReconciliacaoLoteCard() {
      var l = state.reconciliacaoLote;
      var html = '<div class="avp-form-card avp-lote-progresso-card" id="avpReconciliacaoCard">';
      if (l.emAndamento) {
        html += '<p class="avp-lote-progresso-texto" id="avpReconciliacaoProgresso">Reconciliando avaliações… ' + l.feitos + ' de ' + l.total + '</p>';
        if (l.lento) html += '<p class="avp-decisao-aviso">A rede está lenta — as gravações continuam em andamento. Não feche esta página.</p>';
      } else {
        html += '<h4>Reconciliação concluída</h4>';
        html += '<ul class="avp-lote-resumo-final" id="avpReconciliacaoResumo">';
        html += '<li>' + l.sucesso + ' avaliaç' + (l.sucesso === 1 ? 'ão reconciliada' : 'ões reconciliadas') + ' com a versão ' + esc(l.versaoDestino) + '</li>';
        if (l.ignoradas.length) html += '<li>' + l.ignoradas.length + ' ignorada' + (l.ignoradas.length === 1 ? '' : 's') + ' (mudou desde a confirmação)</li>';
        if (l.erros.length) html += '<li>' + l.erros.length + ' com erro</li>';
        if (l.sucesso) {
          html += '<li>' + (l.auditoria === 'ok' ? 'Registro na auditoria do motor gravado.' : 'Atenção: o registro na auditoria do motor NÃO foi gravado (as avaliações guardam o próprio histórico da reconciliação).') + '</li>';
        }
        html += '</ul>';
        var problemas = l.ignoradas.concat(l.erros);
        if (problemas.length) {
          html += '<div class="avp-lote-erros"><ul>';
          problemas.forEach(function (e) { html += '<li>' + esc(e.nome) + ' — ' + esc(e.mensagem) + '</li>'; });
          html += '</ul></div>';
        }
        html += '<button class="btn btn--sm" id="avpReconciliacaoFechar">Fechar</button>';
      }
      html += '</div>';
      return html;
    }
    /* Agrupa por versão de origem e prova CADA par (origem × vigente) —
       nunca reaproveita uma prova de outro par. */
    function provasPorOrigem(itens) {
      var destino = window.faMotorArquitetura.versaoAtual();
      var grupos = {};
      itens.forEach(function (it) {
        var origem = it.motorVersionArquitetura;
        if (!grupos[origem]) grupos[origem] = { origem: origem, destino: destino, itens: [], prova: window.faMotorArquitetura.equivalenciaEntreVersoes(origem, destino) };
        grupos[origem].itens.push(it);
      });
      return Object.keys(grupos).map(function (k) { return grupos[k]; });
    }
    function abrirModalReconciliar() {
      if (!window.faMotorArquitetura.configCarregada()) { avpAlert('A configuração do motor ainda está carregando. Tente de novo em alguns segundos.'); return; }
      var ativos = state.itens.filter(function (it) { return !it.excluido && !temVersaoMaisNova(it._key); });
      var elegiveis = ativos.filter(function (it) { return it.status === 'concluido'; }).filter(elegivelParaReconciliacaoEmLote);
      if (!elegiveis.length) return;
      var grupos = provasPorOrigem(elegiveis);

      var overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9999';
      var box = document.createElement('div');
      box.className = 'modal-box avp-lote-modal-box';
      box.style.cssText = 'max-width:480px;width:92%;padding:24px;display:flex;flex-direction:column;gap:14px;max-height:90vh;overflow-y:auto';
      var html = '<p class="avp-menu-acoes-titulo">Reconciliar com versão equivalente</p>';
      html += '<ul class="avp-lote-resumo-contagens" id="avpReconciliarProvas">';
      grupos.forEach(function (g) {
        html += '<li><strong>' + g.itens.length + ' avaliaç' + (g.itens.length === 1 ? 'ão' : 'ões') + ' na versão ' + esc(g.origem) + '.</strong> ' +
          esc(textoProvaEquivalencia(g.prova)) + ' <strong>Versões semanticamente equivalentes.</strong></li>';
      });
      html += '</ul>';
      html += '<p class="avp-decisao-aviso">Nada é recalculado: respostas, justificativas, interpretação e classificação ficam exatamente como estão, ' +
        'e o motor não roda de novo. Só o número da versão do motor gravado em cada avaliação passa para a versão ' +
        esc(window.faMotorArquitetura.versaoAtual()) + ', com a versão anterior preservada no histórico da avaliação e um registro na auditoria do motor.</p>';
      html += '<div class="avp-lote-modal-botoes">';
      html += '<button class="btn" id="avpReconciliarCancelar">CANCELAR</button>';
      html += '<button class="btn btn--primary" id="avpReconciliarConfirmar">RECONCILIAR ' + elegiveis.length +
        (elegiveis.length === 1 ? ' AVALIAÇÃO' : ' AVALIAÇÕES') + '</button>';
      html += '</div>';
      box.innerHTML = html;
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      function fechar() { if (overlay.parentNode) document.body.removeChild(overlay); }
      box.querySelector('#avpReconciliarCancelar').addEventListener('click', fechar);
      overlay.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); fechar(); } });
      box.querySelector('#avpReconciliarConfirmar').addEventListener('click', function () {
        fechar();
        reconciliarAvaliacoes(elegiveis, function () { render(); }, function () { render(); });
      });
    }
    /* Motor da reconciliação — usado pelo lote e pelo botão individual.
       onProgresso é chamado a cada item; onFim(resumo) uma vez só, depois
       da auditoria. */
    function reconciliarAvaliacoes(itens, onProgresso, onFim) {
      if (state.reconciliacaoLote && state.reconciliacaoLote.emAndamento) {
        /* Nunca some em silêncio: quem chamou (ex.: o botão individual, que
           travou em "Reconciliando…") precisa de um fim. */
        onFim({ total: itens.length, feitos: 0, sucesso: 0, ignoradas: [], auditoria: null, emAndamento: false,
          erros: itens.map(function (it) { return { nome: it.nome, mensagem: 'outra reconciliação ainda está em andamento' }; }) });
        return;
      }
      var usuario = sessaoAtual();
      var destino = window.faMotorArquitetura.versaoAtual();
      var l = state.reconciliacaoLote = {
        total: itens.length, feitos: 0, sucesso: 0, ignoradas: [], erros: [], auditoria: null,
        emAndamento: true, lento: false, versaoDestino: destino
      };
      if (!window.faMotorArquitetura.configCarregada()) {
        itens.forEach(function (it) { l.erros.push({ nome: it.nome, mensagem: 'configuração do motor ainda não carregada' }); });
        l.feitos = itens.length; l.emAndamento = false; onFim(l); return;
      }
      var reconciliadasPorOrigem = {};
      var provas = {};
      var fila = [];
      provasPorOrigem(itens).forEach(function (g) {
        provas[g.origem] = g.prova;
        g.itens.forEach(function (it) {
          /* A prova é refeita aqui, na hora de gravar — nunca confia só no
             que a lista mostrava. Qualquer diferença bloqueia: é caso de
             reprocessar, não de reconciliar. */
          if (!g.prova.equivalentes) {
            l.ignoradas.push({ nome: it.nome, mensagem: g.prova.diferencas
              ? 'a versão ' + g.origem + ' tem ' + fmtNumero(g.prova.diferencas) + ' diferença(s) lógica(s) em relação à ' + destino + ' — use Reprocessar'
              : 'equivalência não comprovada (' + (g.prova.motivo || 'sem prova') + ')' });
            l.feitos++;
          } else {
            fila.push(it);
          }
        });
      });
      var ultimoProgresso = Date.now();
      var vigia = setInterval(function () {
        if (!l.emAndamento) { clearInterval(vigia); return; }
        if (!l.lento && Date.now() - ultimoProgresso > 12000) { l.lento = true; onProgresso(l); }
      }, 3000);
      var CONCORRENCIA = 3;
      var workers = Math.min(CONCORRENCIA, fila.length);
      if (!workers) { concluir(); return; }
      onProgresso(l);
      for (var w = 0; w < workers; w++) proximo();

      function proximo() {
        var it = fila.shift();
        if (!it) { workers--; if (workers === 0) concluir(); return; }
        var origem = it.motorVersionArquitetura;
        var prova = provas[origem];
        var agora = new Date().toISOString();
        var motivoIgnorada = null;
        db().ref(NODE + '/' + it._key).transaction(function (atual) {
          /* null = cache local ainda vazio: devolver null é inofensivo (se
             o servidor tiver o item, rejeita e chama de novo com o valor
             real; se não tiver, não há nada a gravar). */
          if (atual === null) return null;
          if (atual.status !== 'concluido' || atual.excluido || atual.motorVersion !== MOTOR_VERSION ||
              atual.motorVersionArquitetura !== origem) {
            motivoIgnorada = 'mudou desde a confirmação (foi reprocessada, reavaliada ou excluída)';
            return undefined; /* aborta: nunca sobrescreve uma mudança feita por outra pessoa */
          }
          motivoIgnorada = null;
          var novo = Object.assign({}, atual);
          novo.motorVersionArquitetura = destino;
          novo.reconciliacoesVersao = (Array.isArray(atual.reconciliacoesVersao) ? atual.reconciliacoesVersao : []).concat([{
            versaoAnterior: origem, versaoAtual: destino, equivalenciaComprovada: true,
            diferencasSemanticas: prova.diferencas, combinacoesAnalisadas: prova.combinacoesAnalisadas,
            dataHora: agora, usuario: usuario
          }]);
          return novo;
        }, function (err, comprometido, snap) {
          ultimoProgresso = Date.now();
          l.feitos++;
          if (err) {
            console.error('[avaliacao-produto] erro ao reconciliar:', it._key, err);
            l.erros.push({ nome: it.nome, mensagem: 'não foi possível gravar' });
          } else if (!comprometido || !snap || !snap.val()) {
            l.ignoradas.push({ nome: it.nome, mensagem: motivoIgnorada || 'avaliação não encontrada' });
          } else {
            l.sucesso++;
            (reconciliadasPorOrigem[origem] = reconciliadasPorOrigem[origem] || {})[it._key] = it.nome || '';
            state.itens = upsertItem(state.itens, Object.assign({ _key: it._key }, snap.val()));
          }
          onProgresso(l);
          proximo();
        });
      }
      function concluir() {
        var origens = Object.keys(reconciliadasPorOrigem);
        if (!origens.length) { terminar(); return; }
        var agora = new Date().toISOString();
        var updates = {};
        origens.forEach(function (origem) {
          var prova = provas[origem];
          var avaliacoes = reconciliadasPorOrigem[origem];
          updates['motor-arquitetura-auditoria/' + db().ref('motor-arquitetura-auditoria').push().key] = {
            tipo: 'reconciliacao_versao_equivalente', campo: null, valorAnterior: null, valorNovo: null,
            versaoAnterior: Number(origem), versaoAtual: destino, novaVersao: destino,
            equivalenciaComprovada: true, diferencasSemanticas: prova.diferencas, combinacoesAnalisadas: prova.combinacoesAnalisadas,
            quantidade: Object.keys(avaliacoes).length, avaliacoes: avaliacoes,
            usuario: usuario, dataHora: agora
          };
        });
        db().ref().update(updates, function (err) {
          if (err) console.error('[avaliacao-produto] erro ao gravar auditoria da reconciliação:', err);
          l.auditoria = err ? 'erro' : 'ok';
          terminar();
        });
      }
      function terminar() {
        clearInterval(vigia);
        l.emAndamento = false;
        onFim(l);
      }
    }

    /* ===================== REPROCESSAR TUDO COM MOTOR ATUAL (LOTE) =====================
       Orquestra em lote a MESMA rotina do botão individual — nunca duplica a
       lógica de cálculo (construirAtualizacaoReprocessamento é a única fonte
       de verdade para os dois). Diferente do botão individual, o lote NUNCA
       toca numa avaliação com bloqueadaParaReprocessamentoAutomatico=true
       (ver elegivelParaReprocessamentoEmLote) — o bloqueio existe justamente
       para permitir "reprocessar tudo" com segurança mesmo havendo um caso
       ainda em discussão conceitual. */
    function renderBarraReprocessarTudo(elegiveisLote, qtdEquivalentes) {
      var html = '<div class="avp-lote-bar">';
      if (elegiveisLote.length) {
        html += '<button class="btn btn--sm" id="avpReprocessarTudoBtn"' +
          (state.reprocessamentoLote && state.reprocessamentoLote.emAndamento ? ' disabled' : '') + '>' +
          'REPROCESSAR TUDO COM MOTOR ATUAL (' + elegiveisLote.length + ')</button>';
      } else {
        /* Com avaliações em versão equivalente pendentes de reconciliação,
           "todas atualizadas" seria falso — só não há nada a REPROCESSAR. */
        html += '<button class="btn btn--sm" id="avpReprocessarTudoBtn" disabled>' +
          (qtdEquivalentes ? 'Nenhuma avaliação precisa ser reprocessada' : 'Todas as avaliações estão atualizadas') + '</button>';
      }
      html += '</div>';
      return html;
    }
    /* Progresso ("X de Y concluídas") enquanto roda, resumo final (com a
       lista de quem falhou, se houver) depois — o mesmo card muda de
       conteúdo conforme reprocessamentoLote.emAndamento, sem duas telas
       separadas para uma operação só. */
    function renderReprocessamentoLoteCard() {
      var l = state.reprocessamentoLote;
      var html = '<div class="avp-form-card avp-lote-progresso-card" id="avpLoteProgressoCard">';
      if (l.emAndamento) {
        html += '<p class="avp-lote-progresso-texto" id="avpLoteProgressoTexto">Reprocessando avaliações… ' +
          l.feitos + ' de ' + l.total + ' concluídas</p>';
      } else {
        html += '<h4>Reprocessamento concluído</h4>';
        html += '<ul class="avp-lote-resumo-final" id="avpLoteResumoFinal">';
        html += '<li>' + l.sucesso + ' avaliaç' + (l.sucesso === 1 ? 'ão atualizada' : 'ões atualizadas') + '</li>';
        html += '<li>' + l.jaAtualizadas + ' já estava' + (l.jaAtualizadas === 1 ? '' : 'm') + ' no motor atual</li>';
        if (l.bloqueadas) {
          html += '<li>' + l.bloqueadas + ' ignorada' + (l.bloqueadas === 1 ? '' : 's') + ' por estar bloqueada para atualização automática</li>';
        }
        if (l.erros.length) {
          html += '<li>' + l.erros.length + ' apresentou' + (l.erros.length === 1 ? '' : 'aram') + ' erro</li>';
        }
        html += '</ul>';
        if (l.erros.length) {
          html += '<div class="avp-lote-erros" id="avpLoteErros">';
          html += '<p class="avp-lote-erros-titulo">Não foi possível reprocessar:</p><ul>';
          l.erros.forEach(function (e) { html += '<li>' + esc(e.nome) + ' — ' + esc(e.mensagem) + '</li>'; });
          html += '</ul></div>';
        }
        html += '<button class="btn btn--sm" id="avpLoteFechar">Fechar</button>';
      }
      html += '</div>';
      return html;
    }
    /* Modal de confirmação — mostra a contagem ANTES de mexer em qualquer
       coisa, para nunca reprocessar tudo cegamente. As contagens são
       recalculadas na hora (nunca reaproveitadas de um render antigo), então
       refletem exatamente o estado atual da lista. */
    function abrirModalReprocessarTudo() {
      var ativos = state.itens.filter(function (it) { return !it.excluido && !temVersaoMaisNova(it._key); });
      var concluidas = ativos.filter(function (it) { return it.status === 'concluido'; });
      var elegiveis = concluidas.filter(elegivelParaReprocessamentoEmLote);
      var atualizadas = concluidas.filter(function (it) { return situacaoMotor(it) === 'atual'; });
      var equivalentes = concluidas.filter(podeReconciliar);
      var bloqueadas = concluidas.filter(function (it) { return precisaReprocessar(it) && it.bloqueadaParaReprocessamentoAutomatico; });
      if (!elegiveis.length) return; /* botão já vem desabilitado nesse caso — defesa dupla */

      var overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9999';
      var box = document.createElement('div');
      box.className = 'modal-box avp-lote-modal-box';
      box.style.cssText = 'max-width:440px;width:92%;padding:24px;display:flex;flex-direction:column;gap:14px';
      var html = '<p class="avp-menu-acoes-titulo">Reprocessar avaliações com o motor atual</p>';
      html += '<p>Encontramos:</p><ul class="avp-lote-resumo-contagens" id="avpLoteResumoContagens">';
      html += '<li>' + concluidas.length + ' avaliaç' + (concluidas.length === 1 ? 'ão concluída' : 'ões concluídas') + '</li>';
      html += '<li>' + elegiveis.length + ' precisa' + (elegiveis.length === 1 ? '' : 'm') + ' ser reprocessada' + (elegiveis.length === 1 ? '' : 's') + '</li>';
      html += '<li>' + atualizadas.length + ' já est' + (atualizadas.length === 1 ? 'á' : 'ão') + ' no motor atual</li>';
      if (equivalentes.length) {
        html += '<li>' + equivalentes.length + ' em versão anterior equivalente — não ser' + (equivalentes.length === 1 ? 'á reprocessada' : 'ão reprocessadas') + ' (use Reconciliar)</li>';
      }
      if (bloqueadas.length) {
        html += '<li>' + bloqueadas.length + ' não pode' + (bloqueadas.length === 1 ? '' : 'm') + ' ser reprocessada' + (bloqueadas.length === 1 ? '' : 's') + ' automaticamente</li>';
      }
      html += '</ul>';
      html += '<p class="avp-decisao-aviso">O reprocessamento não altera respostas nem justificativas fornecidas pelos usuários. ' +
        'O sistema recalculará apenas conteúdos gerados pelo motor e preservará todas as versões anteriores no histórico.</p>';
      html += '<div class="avp-lote-modal-botoes">';
      html += '<button class="btn" id="avpLoteCancelar">CANCELAR</button>';
      html += '<button class="btn btn--primary" id="avpLoteConfirmar">REPROCESSAR ' + elegiveis.length +
        (elegiveis.length === 1 ? ' AVALIAÇÃO' : ' AVALIAÇÕES') + '</button>';
      html += '</div>';
      box.innerHTML = html;
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      function fechar() { if (overlay.parentNode) document.body.removeChild(overlay); }
      box.querySelector('#avpLoteCancelar').addEventListener('click', fechar);
      overlay.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); fechar(); } });
      box.querySelector('#avpLoteConfirmar').addEventListener('click', function () {
        fechar();
        executarReprocessamentoEmLote(elegiveis);
      });
    }
    /* Processamento com concorrência limitada (nunca todas de uma vez): um
       pequeno número fixo de "workers" consome a fila um item de cada vez,
       cada .update() com seu próprio callback de sucesso/erro — uma falha
       NUNCA para as demais, nem desfaz o que já foi gravado com sucesso.
       Idempotente por construção: quem chama já filtrou por
       elegivelParaReprocessamentoEmLote, então rodar de novo sobre uma
       avaliação já no MOTOR_VERSION atual simplesmente não a inclui na fila
       — nenhuma versão nova é criada à toa. */
    function executarReprocessamentoEmLote(itens) {
      if (state.reprocessamentoLote && state.reprocessamentoLote.emAndamento) return;
      var ativosAgora = state.itens.filter(function (it) { return !it.excluido && !temVersaoMaisNova(it._key); });
      var concluidasAgora = ativosAgora.filter(function (it) { return it.status === 'concluido'; });
      var jaAtualizadas = concluidasAgora.filter(function (it) { return situacaoMotor(it) === 'atual'; }).length;
      var bloqueadas = concluidasAgora.filter(function (it) { return precisaReprocessar(it) && it.bloqueadaParaReprocessamentoAutomatico; }).length;

      var fila = itens.slice();
      var CONCORRENCIA = 3;
      state.reprocessamentoLote = {
        total: itens.length, feitos: 0, sucesso: 0, erros: [],
        jaAtualizadas: jaAtualizadas, bloqueadas: bloqueadas, emAndamento: true
      };
      render();

      var workersAtivos = 0;
      function terminouItem() {
        state.reprocessamentoLote.feitos++;
        render();
        worker();
      }
      function worker() {
        if (!fila.length) {
          workersAtivos--;
          if (workersAtivos === 0) {
            state.reprocessamentoLote.emAndamento = false;
            render();
          }
          return;
        }
        var it = fila.shift();
        var updates;
        try {
          updates = construirAtualizacaoReprocessamento(it);
        } catch (e) {
          console.error('[avaliacao-produto] erro ao calcular reprocessamento em lote:', it._key, e);
          state.reprocessamentoLote.erros.push({ key: it._key, nome: it.nome, mensagem: 'Não foi possível calcular a nova recomendação.' });
          terminouItem();
          return;
        }
        db().ref(NODE + '/' + it._key).update(updates, function (err) {
          if (err) {
            console.error('[avaliacao-produto] erro ao reprocessar em lote:', it._key, err);
            state.reprocessamentoLote.erros.push({ key: it._key, nome: it.nome, mensagem: 'Não foi possível gravar.' });
          } else {
            state.reprocessamentoLote.sucesso++;
            Object.assign(it, updates);
            state.itens = upsertItem(state.itens, clonarItem(it));
          }
          terminouItem();
        });
      }
      var n = Math.min(CONCORRENCIA, fila.length);
      workersAtivos = n;
      for (var i = 0; i < n; i++) worker();
    }

    /* Config de conteúdo dos questionários (window.faQuestionarios) —
       re-renderiza sempre que chega a primeira leitura ou uma nova versão é
       publicada (por esta aba ou por outra), do mesmo jeito que a leitura
       das próprias avaliações abaixo. Nunca precisa disso pra decidir SE
       reprocessar — é um eixo só de apresentação (ver questionnaireContentVersion). */
    window.faQuestionarios.onMudanca(CODIGO_QUESTIONARIO, function () { render(); });
    window.faQuestionarios.onMudanca(window.faQuestionarios.CODIGOS.ADEQUACAO_SQUAD, function () { render(); });
    /* Motor de classificação arquitetural (window.faMotorArquitetura) —
       este onMudanca é o que efetivamente liga a sincronização com o
       Firebase (ver garantirSync em motor-arquitetura.js: só se conecta na
       primeira chamada de onMudanca); sem ele, versaoAtual()/regrasDaVersao()
       nunca refletiam uma publicação (cache sempre null → sempre a versão 1
       de fábrica), exatamente como já valia para o motor de squad antes
       dele (ver window.faMotorSquad.onMudanca em avaliacao-squad.js). */
    window.faMotorArquitetura.onMudanca(function () { render(); });

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
