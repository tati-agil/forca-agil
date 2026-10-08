/* ============================================================
   Força Ágil — Avaliação de Produto/Serviço (aba Arquitetura, admin)

   Checklist arquitetural para decidir se um item da organização deve
   ser classificado como Produto/Serviço. Node do Firebase:
   avaliacoes-produto/<key> = {
     nome, descricao, publico, necessidade, observacoesGerais,
     especializacaoCadastrada: texto livre opcional | null — CURADORIA: metadado
       arquitetural REGISTRADO por uma pessoa à parte (não confundir com a
       "especialização identificada pelo questionário", que o motor DERIVA
       sozinho — ex.: Componente com P13 = SIM — e NÃO é curadoria; nenhuma
       pergunta nova distingue tipos); quando presente e vigente, tem
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
     camadaSugerida: { id, label, motivos: [texto...], conflito: [label...]|null } | null —
       id é o CÓDIGO (decide tudo); label é o nome resolvido da Taxonomia Arquitetural NA CONCLUSÃO
       (window.faClassificacoes; rótulo de contingência se ela não respondeu) — nunca reescrito; a tela
       mostra o nome ATUAL pelo código e "na conclusão: <label>" quando difere,
     justificativaAutomatica: texto,
     decisaoFinal: 'produto' | 'nao-produto' | 'a-validar' (igual à automática até o admin discordar),
     decisaoManual, justificativaDecisao, alteradoPor: {name,email}, alteradoEm,
     naturezaComplementarCodigo / NomeNaEpoca / DescricaoNaEpoca / DefinidaPor /
       DefinidaEm: informação MANUAL opcional (ex.: "Programa transversal"),
       INDEPENDENTE da decisão — existe com a recomendação aceita ou com
       decisão manual, e pode ser alterada depois sem reavaliar nem
       reprocessar; tudo null quando não há. Fora do motor e fora do
       motorVersion (ver naturezaDoItem e window.faNaturezas). O formato
       antigo { naturezaComplementar: { id, rotulo } } (só numa decisão
       manual) ainda é lido, e é limpo na próxima gravação,
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
  /* Auditoria da Curadoria e da Decisão final: curadoria-auditoria/<avaliacaoId>/<pushKey>
     (só acrescenta linhas). A natureza complementar mantém a auditoria própria que
     já tinha (naturezas-complementares-auditoria). */
  var NODE_CURADORIA_AUDITORIA = 'curadoria-auditoria';

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
  /* Texto HISTÓRICO de uma pergunta já respondida — única porta usada pela
     ficha, pelo PDF e pelo Excel. Nunca devolve o texto vigente para uma
     resposta antiga: a origem fica explícita em `origem`.
       'registrado'  — cópia gravada na própria resposta, no clique de SIM/NÃO;
       'versao'      — sem cópia, mas a versão do questionário está registrada
                       (na resposta ou na avaliação): o texto dessa versão;
       'reconstruido'— avaliação LEGADA (anterior a 29/09/2026, sem versão nem
                       cópia): texto da versão 1, só para perguntas cuja
                       equivalência histórica está comprovada (LEGADO_*);
       'indisponivel'— legada sem prova: nada é inventado. */
  function conteudoSnapshotOuAtual(def, resposta, item) {
    if (resposta && resposta.textoPerguntaNaEpoca) {
      return { titulo: resposta.tituloNaEpoca || null, texto: resposta.textoPerguntaNaEpoca, origem: 'registrado' };
    }
    var versao = (resposta && resposta.questionnaireContentVersion) || (item && item.questionnaireContentVersion);
    if (versao) {
      var c = conteudoDe(def, versao);
      return { titulo: c.titulo || null, texto: c.texto, origem: 'versao', versao: versao };
    }
    return conteudoLegado(def);
  }

  /* AVALIAÇÕES LEGADAS — concluídas antes de existir questionnaireContentVersion
     e a cópia da pergunta em cada resposta (commit c3a9de3, 29/09/2026,
     "Parametriza as 16 perguntas P1-P16"). Sem prova, mostrar o texto vigente
     ao lado de uma resposta antiga seria falsificar o histórico; por isso a
     reconstrução só vale para o que foi COMPROVADO no histórico do git, em
     TODAS as versões do código anteriores à parametrização (ea1a051 a
     c3a9de3^): ver .github/scripts/dados/textos-pre-parametrizacao.json e
     teste-versionamento-historico.js, que confere estas listas contra ela.
       - texto da pergunta: P1–P16, iguais à versão 1 (texto de fábrica);
       - título: P1–P8 iguais à versão 1; P9–P16 não tinham título (ficam sem);
       - ajuda (textoAjuda, exemplo, exemplos, ajudaExtra): P1–P16 iguais à
         versão 1 — usada só para decidir o aviso da reavaliação.
     Pergunta fora da lista → 'indisponivel', com TEXTO_NAO_RECONSTRUIVEL. */
  var VERSAO_LEGADA_COMPROVADA = 1;
  var LEGADO_TEXTO_COMPROVADO = { P1: true, P2: true, P3: true, P4: true, P5: true, P6: true, P7: true, P8: true,
    P9: true, P10: true, P11: true, P12: true, P13: true, P14: true, P15: true, P16: true };
  var LEGADO_TITULO_COMPROVADO = { P1: true, P2: true, P3: true, P4: true, P5: true, P6: true, P7: true, P8: true };
  var LEGADO_AJUDA_COMPROVADA = { P1: true, P2: true, P3: true, P4: true, P5: true, P6: true, P7: true, P8: true,
    P9: true, P10: true, P11: true, P12: true, P13: true, P14: true, P15: true, P16: true };
  var TEXTO_NAO_RECONSTRUIVEL = 'Texto histórico da pergunta não pôde ser reconstruído com segurança.';
  var NOTA_TEXTO_RECONSTRUIDO = 'Texto das perguntas reconstruído a partir da primeira versão disponível do questionário: esta avaliação é anterior ao registro do texto em cada resposta.';
  var NOTA_TEXTO_INDISPONIVEL = 'O texto de algumas perguntas não pôde ser reconstruído com segurança: esta avaliação é anterior ao registro do texto em cada resposta.';
  function conteudoLegado(def) {
    if (!LEGADO_TEXTO_COMPROVADO[def.codigoEstavel]) return { titulo: null, texto: TEXTO_NAO_RECONSTRUIVEL, origem: 'indisponivel' };
    var c = conteudoDe(def, VERSAO_LEGADA_COMPROVADA);
    return { titulo: LEGADO_TITULO_COMPROVADO[def.codigoEstavel] ? (c.titulo || null) : null, texto: c.texto, origem: 'reconstruido' };
  }
  /* Nota única (ficha e PDF) quando alguma pergunta respondida usou texto
     reconstruído ou indisponível; '' quando tudo veio do registro da época. */
  function notaTextoHistorico(item) {
    var origens = {};
    TODAS_PERGUNTAS.forEach(function (def) {
      var r = item && item.respostas && item.respostas[def.id];
      if (r && r.valor) origens[conteudoSnapshotOuAtual(def, r, item).origem] = true;
    });
    if (origens.indisponivel) return NOTA_TEXTO_INDISPONIVEL;
    if (origens.reconstruido) return NOTA_TEXTO_RECONSTRUIDO;
    return '';
  }
  var ROTULO_ORIGEM_TEXTO = {
    registrado: 'Registrado na resposta', versao: 'Versão do questionário da avaliação',
    reconstruido: 'Reconstruído da primeira versão', indisponivel: 'Não reconstruível'
  };

  /* REAVALIAÇÃO — resposta trazida de outra versão do questionário (herdada da
     avaliação anterior e ainda não clicada de novo). Devolve:
       'pergunta' — o TEXTO da pergunta mudou (ou não há como saber): a resposta
                    antiga é só referência e não conta como resposta à pergunta
                    nova — é preciso clicar SIM/NÃO de novo para concluir;
       'ajuda'    — só ajuda/exemplo/título mudou: aviso discreto, sem bloquear;
       null       — respondida nesta versão, ou nada mudou. */
  var CAMPOS_AJUDA_COMPARADOS = ['titulo', 'textoAjuda', 'exemplo', 'exemplos', 'ajudaExtra'];
  /* Comparação pelo CONTEÚDO, nunca pela forma: o Firebase devolve as chaves
     de um objeto em ordem alfabética (textoAjuda vinda do banco ≠ a mesma
     textoAjuda de fábrica numa comparação de texto) e ausente, null e ''
     são a mesma coisa — sem isso, pergunta que não mudou recebia aviso. */
  function conteudoNormalizado(v) {
    if (v == null || v === '') return null;
    if (Array.isArray(v)) return v.map(conteudoNormalizado);
    if (typeof v === 'object') {
      var r = {};
      Object.keys(v).sort().forEach(function (k) { var n = conteudoNormalizado(v[k]); if (n !== null) r[k] = n; });
      return Object.keys(r).length ? r : null;
    }
    return v;
  }
  function mesmoConteudo(a, b) { return JSON.stringify(conteudoNormalizado(a)) === JSON.stringify(conteudoNormalizado(b)); }
  function situacaoRespostaHerdada(def, resposta, versaoAvaliacao) {
    if (!resposta || !resposta.valor || !versaoAvaliacao) return null;
    var versaoResposta = resposta.questionnaireContentVersion || null;
    if (versaoResposta === versaoAvaliacao) return null;
    var agora = conteudoDe(def, versaoAvaliacao);
    /* Legada (sem versão na resposta): a ajuda da época só é comparada onde a
       evidência prova que era a da versão 1 (LEGADO_AJUDA_COMPROVADA). */
    var antes = versaoResposta ? conteudoDe(def, versaoResposta)
      : (LEGADO_AJUDA_COMPROVADA[def.codigoEstavel] ? conteudoDe(def, VERSAO_LEGADA_COMPROVADA) : null);
    var textoAntes = resposta.textoPerguntaNaEpoca || (versaoResposta && antes && antes.texto) ||
      (function () { var l = conteudoLegado(def); return l.origem === 'reconstruido' ? l.texto : null; })();
    if (!textoAntes || textoAntes !== agora.texto) return 'pergunta';
    if (!antes) return 'ajuda'; /* legada sem prova da ajuda da época — avisa, sem bloquear */
    var mudou = CAMPOS_AJUDA_COMPARADOS.some(function (campo) { return !mesmoConteudo(antes[campo], agora[campo]); });
    return mudou ? 'ajuda' : null;
  }
  /* Resposta que vale para concluir — o MESMO critério do contador de
     progresso e de primeiraPerguntaFaltando: SIM/NÃO dado à pergunta desta
     versão (a herdada de pergunta cujo texto mudou ainda não vale). */
  function respostaValida(def, atual) {
    var r = (atual.respostas || {})[def.id];
    if (!(r && (r.valor === 'sim' || r.valor === 'nao'))) return false;
    return situacaoRespostaHerdada(def, r, atual.questionnaireContentVersion) !== 'pergunta';
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
  /* NOME de uma classificação: vem SEMPRE da Taxonomia Arquitetural (window.faClassificacoes, conceito de
     mesmo código). O label de CAMADAS acima é só o código de fábrica para CONTINGÊNCIA (Taxonomia lenta,
     recusada ou sem o conceito) — nunca mais uma segunda lista editável de nomes. O motor
     (identificarCamada, resultadoDaCamada…) só usa o id; o nome nunca decide nada. Sem o módulo
     (cálculo isolado, fora do site) vale o rótulo de fábrica. */
  var SUFIXO_CONFLITO_NATUREZAS = ' — conflito de naturezas predominantes';
  if (window.faClassificacoes) {
    window.faClassificacoes.registrarCatalogo(CAMADAS, { sufixoConflito: SUFIXO_CONFLITO_NATUREZAS });
    window.faClassificacoes.iniciar();
  }
  function nomeClassificacao(id) {
    if (window.faClassificacoes) return window.faClassificacoes.nome(id);
    var c = camadaPorId(id);
    return c ? c.label : (id || '');
  }
  /* Nome ATUAL de uma classificação gravada (camadaSugerida), com o sufixo do conflito de naturezas. */
  function rotuloCamadaAtual(camada) {
    if (!camada) return '';
    if (window.faClassificacoes) return window.faClassificacoes.rotulo(camada);
    return camada.label || camada.id || '';
  }
  /* Nome REGISTRADO na conclusão (camadaSugerida.label, nunca reescrito) quando difere do atual; senão ''. */
  function rotuloCamadaNaConclusao(camada) {
    return window.faClassificacoes ? window.faClassificacoes.rotuloNaConclusao(camada) : '';
  }
  /* HTML do nome atual (se atualiza sozinho quando a Taxonomia muda) e da nota "na conclusão: X". */
  function htmlNomeCamada(camada, classe, idElemento) {
    if (window.faClassificacoes) return window.faClassificacoes.spanNome(camada, classe, idElemento);
    return esc(rotuloCamadaAtual(camada));
  }
  function htmlNaConclusao(camada, formato, idElemento) {
    return window.faClassificacoes ? window.faClassificacoes.spanNaConclusao(camada, formato, idElemento) : '';
  }
  function htmlAvisoContingencia(ids, idElemento) {
    return window.faClassificacoes ? window.faClassificacoes.avisoHtml(ids, idElemento) : '';
  }

  /* NATUREZA COMPLEMENTAR — descrição MANUAL e OPCIONAL de que tipo de item é
     uma avaliação (ex.: "Programa transversal" para um item que o motor deixa
     "A validar" e que a pessoa decidiu tratar como não Produto/Serviço
     principal; "Plataforma/estrutura de benefícios e parcerias" para um
     Canal). Não é uma camada: não entra em CAMADAS, não tem precedência,
     nunca é lida por identificarCamada/computeResultado nem por
     reprocessar/reconciliar, nunca é inferida das respostas e NÃO depende da
     decisão (existe com a recomendação do sistema aceita). Alterá-la nunca
     muda respostas, classificação, motorVersion nem marca "Motor
     desatualizado".
     A LISTA de opções vive em window.faNaturezas (naturezas-complementares-
     config, com os dois casos reais como padrão de fábrica) — nunca aqui. A
     avaliação guarda o código E o nome/descrição DA ÉPOCA, então renomear ou
     desativar uma opção depois nunca reescreve o que já foi registrado. */
  /* { codigo, nome, descricao, definidaPor, definidaEm } | null. Lê o formato
     novo e o antigo ({id, rotulo}, só existia numa decisão manual). */
  /* Aviso do catálogo de naturezas quando ele não chegou: demora (rede lenta, depois de
     ~12 s) ou erro — os dois com "Tentar novamente" (faNaturezas.recarregar descarta a leitura
     anterior; nunca há duas disputando a tela). Mesmo aviso no seletor da avaliação e no
     catálogo do Admin. */
  function avisoCatalogoNaturezas(idBotao) {
    var N = window.faNaturezas, est = N.estado();
    var texto = est === 'erro' ? 'Não foi possível carregar as opções de natureza complementar.' :
      (est === 'carregando' && N.demorando && N.demorando()) ? 'As opções de natureza complementar estão demorando para carregar (conexão lenta).' : '';
    if (!texto) return '';
    return '<div class="avp-natureza-aviso" role="alert"><p class="avp-error-msg">' + esc(texto) + '</p>' +
      '<button type="button" class="btn btn--sm" id="' + idBotao + '">Tentar novamente</button></div>';
  }
  function naturezaDoItem(it) {
    if (!it) return null;
    if (it.naturezaComplementarCodigo) {
      return {
        codigo: it.naturezaComplementarCodigo,
        nome: it.naturezaComplementarNomeNaEpoca || it.naturezaComplementarCodigo,
        descricao: it.naturezaComplementarDescricaoNaEpoca || '',
        definidaPor: it.naturezaComplementarDefinidaPor || null,
        definidaEm: it.naturezaComplementarDefinidaEm || null
      };
    }
    var legado = it.naturezaComplementar;
    if (legado && (legado.rotulo || legado.id)) {
      return { codigo: legado.id || null, nome: legado.rotulo || legado.id, descricao: '',
        definidaPor: it.alteradoPor || null, definidaEm: it.alteradoEm || null };
    }
    return null;
  }
  /* Nome a exibir: o da época (snapshot), nunca o do catálogo de hoje. */
  /* CURADORIA = só o que alguém REGISTROU e que VALE para a classificação atual.
     O que o questionário/motor deriva (ex.: "Opção/configuração de
     personalização" num Componente) é saída do motor, NÃO curadoria: nunca
     entra no bloco Curadoria, nunca conta como "complementação" e é mostrado à
     parte (especializacaoDerivada). Única fonte para tela, PDF, Excel e para a
     "Forma da decisão".

     Um cadastro (especializacaoCadastrada / papelEstruturalCadastrado) tem TRÊS
     situações, calculadas na hora de exibir — nenhuma leitura grava nada:
       vigente   a camada atual admite o campo E o cadastro vale para ela:
                 não há marcador (registro LEGADO) ou o marcador é a camada atual;
       sem efeito  a camada atual NÃO admite o campo (a camada mudou): o valor
                 continua gravado, não conta e aparece só em bloco informativo;
       a revisar   a camada admite o campo de novo, mas o cadastro foi
                 confirmado para OUTRA classificação (ou perdeu o vínculo ao
                 ficar sem efeito): não volta sozinho a valer — só depois de uma
                 confirmação humana (ou de um valor novo) na ficha.
     O registro não guardava para qual camada o cadastro foi feito, então o
     marcador (especializacaoCamadaConfirmada / papelEstruturalCamadaConfirmada)
     diz em qual camada ele foi confirmado: o id da camada, ou 'sem-vinculo'
     (a camada mudou para uma que não admite o campo). Ausente = registro legado:
     vale enquanto a camada admite, exatamente como antes. Nunca se inventa a
     camada de um registro legado: o marcador nasce quando a camada MUDA
     (reprocessar/reavaliar, ver vinculosAoMudarCamada) ou numa confirmação/
     alteração humana. */
  var VINCULO_PERDIDO = 'sem-vinculo';
  function admiteEspecializacao(camadaId) { return CAMADAS_COM_ESPECIALIZACAO.indexOf(camadaId) !== -1; }
  function admitePapelEstrutural(camadaId) { return CAMADAS_COM_PAPEL_ESTRUTURAL.indexOf(camadaId) !== -1; }
  /* O cadastro vale para esta camada? (não olha se a camada admite o campo) */
  function vinculoVale(marcador, camadaId) { return !marcador || marcador === camadaId; }
  function camadaDoItem(it) { return (it && it.camadaSugerida && it.camadaSugerida.id) || null; }
  /* Estado de um campo de curadoria cadastrado: 'vigente' | 'sem-efeito' | 'a-revisar' | null (nada cadastrado). */
  function situacaoCadastro(valor, marcador, camadaId, admite) {
    if (!valor || !camadaId) return null;
    if (!admite) return 'sem-efeito';
    return vinculoVale(marcador, camadaId) ? 'vigente' : 'a-revisar';
  }
  function papelCadastrado(it) { return normalizarPapelEstrutural(it && it.papelEstruturalCadastrado); }
  function rotuloPapel(v) { return v === 'essencial' ? 'Essencial' : (v === 'opcional' ? 'Opcional' : ''); }
  function especializacaoCadastradaDe(it) { return String((it && it.especializacaoCadastrada) || '').trim(); }
  function temCuradoria(it) {
    var c = curadoriaRegistrada(it);
    return !!(c.especializacao || c.papelEstrutural || c.natureza);
  }
  /* Só o VIGENTE (é o que conta, aparece na Curadoria, no PDF e no Excel). */
  function curadoriaRegistrada(it) {
    var camadaId = camadaDoItem(it);
    var esp = especializacaoCadastradaDe(it), papel = papelCadastrado(it);
    var espVigente = situacaoCadastro(esp, it && it.especializacaoCamadaConfirmada, camadaId, admiteEspecializacao(camadaId)) === 'vigente';
    var papelVigente = situacaoCadastro(papel, it && it.papelEstruturalCamadaConfirmada, camadaId, admitePapelEstrutural(camadaId)) === 'vigente';
    return {
      especializacao: espVigente ? esp : '',
      papelEstruturalValor: papelVigente ? papel : '',
      papelEstrutural: papelVigente ? rotuloPapel(papel) : '',
      natureza: naturezaDoItem(it)
    };
  }
  /* O que está cadastrado e NÃO é vigente, por campo: { valor, rotulo, situacao }.
     Natureza nunca entra (não depende da camada); rascunho (sem camada) também não. */
  function curadoriaAnterior(it) {
    var camadaId = camadaDoItem(it);
    var out = { camada: camadaId ? rotuloCamadaAtual(it.camadaSugerida) : '', especializacao: null, papelEstrutural: null };
    var esp = especializacaoCadastradaDe(it), papel = papelCadastrado(it);
    var sEsp = situacaoCadastro(esp, it && it.especializacaoCamadaConfirmada, camadaId, admiteEspecializacao(camadaId));
    var sPapel = situacaoCadastro(papel, it && it.papelEstruturalCamadaConfirmada, camadaId, admitePapelEstrutural(camadaId));
    if (sEsp && sEsp !== 'vigente') out.especializacao = { valor: esp, rotulo: esp, situacao: sEsp };
    if (sPapel && sPapel !== 'vigente') out.papelEstrutural = { valor: papel, rotulo: rotuloPapel(papel), situacao: sPapel };
    return out;
  }
  /* Quando a camada MUDA numa gravação (reprocessar, reavaliar/concluir), fixa o
     vínculo do cadastro: perdeu o vínculo se a camada nova não admite o campo;
     senão (registro legado, sem marcador) guarda a camada ANTERIOR — não vale
     para a nova sem confirmação. Devolve só os marcadores a gravar. */
  function vinculosAoMudarCamada(it, camadaAntigaId, camadaNovaId) {
    var out = {};
    if (!camadaAntigaId || !camadaNovaId || camadaAntigaId === camadaNovaId) return out;
    function campo(valor, marcador, admiteNova, chave) {
      if (!valor) return;
      if (!admiteNova) out[chave] = VINCULO_PERDIDO;
      else if (!marcador) out[chave] = camadaAntigaId;
    }
    campo(especializacaoCadastradaDe(it), it.especializacaoCamadaConfirmada, admiteEspecializacao(camadaNovaId), 'especializacaoCamadaConfirmada');
    campo(papelCadastrado(it), it.papelEstruturalCamadaConfirmada, admitePapelEstrutural(camadaNovaId), 'papelEstruturalCamadaConfirmada');
    return out;
  }
  /* Especialização que o motor deriva das respostas, quando NÃO há cadastro vigente. */
  function especializacaoDerivada(it) {
    if (curadoriaRegistrada(it).especializacao) return '';
    return valorEspecializacao(it && it.camadaSugerida);
  }
  /* "Forma da decisão" é texto DERIVADO dos campos que já existem — não é campo — e fala SÓ da decisão:
       decisão alterada à mão   → "Decisão manual";
       recomendação aceita      → "Recomendação do sistema aceita".
     Curadoria e Decisão são dimensões independentes: a existência de curadoria NUNCA entra aqui (ela é
     exibida no bloco próprio). Mesmo texto na tela, no PDF e no Excel. */
  function formaDaDecisao(it) {
    if (semDecisaoRegistrada(it)) return 'Sem decisão registrada';
    return it.decisaoManual ? 'Decisão manual' : 'Recomendação do sistema aceita';
  }
  /* Versão criada por reavaliação que ainda não recebeu decisão (nem manual, nem "aceitar a recomendação"):
     vale a recomendação do sistema, mas NINGUÉM a aceitou — por isso não pode parecer "recomendação aceita".
     Mesma condição do aviso da ficha (textoDecisaoPendenteReavaliacao). */
  function semDecisaoRegistrada(it) {
    return !!(it && it.versaoAnteriorKey && !it.decisaoConfirmada && !it.decisaoManual);
  }
  function rotuloNaturezaDoItem(it) {
    var n = naturezaDoItem(it);
    return n ? n.nome : '';
  }
  /* Os campos que uma avaliação NOVA (reavaliação) herda da anterior — a
     natureza descreve o item, não uma rodada de respostas, então não some
     quando ele é reavaliado. Migra o formato antigo para o novo e limpa o
     antigo. Sempre todas as chaves (null quando não há): o Firebase recusa
     undefined. */
  function camposNaturezaDoItem(it) {
    var n = naturezaDoItem(it);
    return {
      naturezaComplementarCodigo: n ? n.codigo : null,
      naturezaComplementarNomeNaEpoca: n ? n.nome : null,
      naturezaComplementarDescricaoNaEpoca: n && n.descricao ? n.descricao : null,
      naturezaComplementarDefinidaPor: n ? n.definidaPor : null,
      naturezaComplementarDefinidaEm: n ? n.definidaEm : null,
      naturezaComplementar: null
    };
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
     reprocessarMotor).

     EXCEÇÃO DECIDIDA (30/09/2026): a redação de relacaoArquitetural e da
     justificativa consolidada de Informação/Documento (e a do Canal com
     P2 = SIM) foi corrigida sem incrementar esta constante, por decisão
     explícita da responsável — é uma correção INTERPRETATIVA, não lógica
     (nenhuma regra, precedência, camada ou resultado mudou; ver o teste
     teste-textos-informacao-documento.js, que fixa a classificação das 65.536
     combinações). Consequência assumida: avaliações já concluídas guardam a
     relação e a justificativa da época (item.camadaSugerida.relacao e
     item.justificativaAutomatica, nunca recalculadas ao exibir) e seguem
     "Motor atual"; só avaliações NOVAS ou reavaliadas usam o texto novo.
     MESMO TRATAMENTO (05/10/2026), também por decisão explícita da
     responsável: a Relação arquitetural de Unidade de valor associada
     deixou de afirmar "jornada e mensuração identificáveis" (P6/P7 são
     auxiliares, não exigidas pela regra) — ver teste-texto-unidade-valor.js,
     que fixa todo o resto das 65.536 combinações. Idem (05/10/2026) para a
     justificativa de Componente, que deixou de negar "jornada própria" (a
     regra não verifica P6) — ver teste-texto-componente.js. Idem
     (05/10/2026) para o "A validar" em que P8 = NÃO é comprovadamente a
     única condição que impede Produto/Serviço principal ou Unidade de valor
     associada: justificativa, motivo e interpretação de P8 específicos, com a
     marca camadaSugerida.impedidaPorGestao gravada só em avaliações novas ou
     reprocessadas (metadado explicativo — nunca lido pelo motor) — ver
     teste-a-validar-gestao.js. Idem (05/10/2026) para o "A validar" com
     autonomia estrutural (P5 = SIM) e uma única natureza predominante em que
     uma troca isolada de resposta resolveria a classificação: justificativa e
     interpretação específicas, com a marca camadaSugerida.bloqueioNatureza
     (metadado explicativo — nunca lido pelo motor) — ver
     teste-a-validar-natureza.js. */
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
    componente: 'É principalmente um elemento estrutural que compõe outro Produto/Serviço',
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
  /* opcoes (todas opcionais): sim/nao = rótulos dos botões (padrão Confirmar/Cancelar), aoNao = o que fazer ao recusar,
     classe = marca o modal (evita abrir o mesmo aviso duas vezes). */
  function avpConfirm(mensagem, callbackSim, opcoes) {
    opcoes = opcoes || {};
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay' + (opcoes.classe ? ' ' + opcoes.classe : '');
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9999';
    var box = document.createElement('div');
    box.className = 'modal-box';
    box.style.cssText = 'max-width:420px;width:90%;padding:28px;display:flex;flex-direction:column;gap:18px';
    box.innerHTML =
      '<p style="font-size:.95rem;line-height:1.6;color:var(--ink);white-space:pre-line">' + esc(mensagem) + '</p>' +
      '<div style="display:flex;justify-content:flex-end;flex-wrap:wrap;gap:8px">' +
        '<button class="btn avp-modal-cancel-btn">' + esc(opcoes.nao || 'Cancelar') + '</button>' +
        '<button class="btn btn--primary avp-modal-confirm-btn">' + esc(opcoes.sim || 'Confirmar') + '</button></div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function close() { document.body.removeChild(overlay); }
    function recusar() { close(); if (opcoes.aoNao) opcoes.aoNao(); }
    box.querySelector('.avp-modal-cancel-btn').addEventListener('click', recusar);
    overlay.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); recusar(); } });
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
     só mostram a especialização depois de cadastrada (antes disso a linha nem aparece)
     — isso NUNCA vira A validar, é só uma informação a menos, não um
     conflito. Produto/Serviço principal entrou nesta lista só para permitir
     o CADASTRO (ex.: "Serviço", "Produto") a quem já sabe essa informação
     por outra fonte — identificarCamada continua decidindo QUAL camada o
     item é sem olhar para isso, e nenhuma avaliação já concluída precisa ser
     reprocessada por causa desta mudança (ver valorEspecializacao). */
  var CAMADAS_COM_ESPECIALIZACAO = ['componente', 'unidade-valor-associada', 'funcionalidade-operacao', 'regra-condicao', 'documento-informacao', 'produto-principal'];
  /* Texto ANTIGO: só reconhecido para NÃO ser exibido (ver valorEspecializacao). */
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
     estrutural neste ajuste. A linha "Papel estrutural" só aparece quando
     há valor (ver valorPapelEstrutural). */
  var CAMADAS_COM_PAPEL_ESTRUTURAL = ['componente'];
  /* Texto ANTIGO: só reconhecido para NÃO ser exibido (ver valorPapelEstrutural). */
  var PAPEL_ESTRUTURAL_NAO_DETERMINADO = 'não determinado';

  /* Especialização e Papel estrutural só existem quando têm VALOR REAL (um
     cadastro, ou o sinal automático de Componente com P13 = SIM). "Não
     determinada pelo questionário" / "não determinado" NÃO são valores: eram
     placeholders gravados em camadaSugerida e pareciam erro ou lacuna no
     resultado. Hoje o cálculo devolve null (nada é gravado) e a apresentação
     (tela, PDF, Excel, histórico) trata os textos antigos, já gravados em
     avaliações existentes, como AUSÊNCIA de valor — só não os exibe; nenhum
     dado é migrado nem apagado. */
  function valorEspecializacao(camada) {
    var v = camada && camada.especializacao;
    return (v && v !== ESPECIALIZACAO_NAO_DETERMINADA) ? v : '';
  }
  function valorPapelEstrutural(camada) {
    var v = camada && camada.papelEstrutural;
    return (v && v !== PAPEL_ESTRUTURAL_NAO_DETERMINADO) ? v : '';
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
      /* Só o cadastro VIGENTE para esta camada entra (ver curadoriaRegistrada): um cadastro
         que perdeu o vínculo ou foi confirmado para outra camada não volta sozinho. */
      var cadastrada = vinculoVale(atual.especializacaoCamadaConfirmada, camadaId) ? (atual.especializacaoCadastrada || '').trim() : '';
      if (cadastrada) return cadastrada;
      if (camadaId === 'componente' && modalidade) return 'Opção/configuração de personalização';
      return null;
    }
    function papelEstruturalPara(camadaId) {
      if (CAMADAS_COM_PAPEL_ESTRUTURAL.indexOf(camadaId) === -1) return null;
      var cadastrado = vinculoVale(atual.papelEstruturalCamadaConfirmada, camadaId) ? (atual.papelEstruturalCadastrado || '').trim().toLowerCase() : '';
      if (cadastrado === 'essencial') return 'Essencial';
      if (cadastrado === 'opcional') return 'Opcional';
      return null;
    }

    /* Contexto P1-P16 para o motor declarativo — nunca o inverso (o motor
       nunca vê id interno nem texto de pergunta). */
    var contexto = {};
    TODAS_PERGUNTAS.forEach(function (def) { contexto[def.codigoEstavel] = sim(def.id) ? 'SIM' : 'NAO'; });
    var regras = window.faMotorArquitetura.regrasDaVersao(window.faMotorArquitetura.versaoAtual());
    var decisao = window.faMotorArquitetura.identificarCamada(contexto, regras);

    var motivos = decisao.motivosCodigos.map(function (codigo) { return motivo(ID_POR_CODIGO[codigo]); });
    var conflito = decisao.conflito ? decisao.conflito.map(function (camId) { return nomeClassificacao(camId); }) : null;
    /* Conflito de naturezas predominantes (política geral P11–P15): o motor
       já devolve SÓ as naturezas marcadas SIM; o motivo é uma frase só,
       com essas mesmas naturezas — nunca "Componente: NÃO" de uma que ninguém
       marcou. */
    if (decisao.conflitoNaturezas) motivos = [textoNaturezasIndicadas(conflito)];
    /* Calculada DEPOIS da decisão e nunca devolvida ao motor: só explica um
       "A validar" que já foi decidido. */
    var impedidaPorGestao = camadaImpedidaPorGestao(contexto, regras, decisao);
    if (impedidaPorGestao) motivos = [MOTIVO_GESTAO_NAO];
    var bloqueioNatureza = impedidaPorGestao ? null : bloqueioPorNatureza(contexto, regras, decisao);

    var ident = {
      camada: decisao.camada, motivos: motivos, conflito: conflito, incoerencia: decisao.incoerencia,
      especializacao: especializacaoPara(decisao.camada), papelEstrutural: papelEstruturalPara(decisao.camada),
      exclusoesSim: exclusoesSim
    };
    if (decisao.conflitoNaturezas) ident.conflitoNaturezas = true;
    if (impedidaPorGestao) ident.impedidaPorGestao = impedidaPorGestao;
    if (bloqueioNatureza) ident.bloqueioNatureza = bloqueioNatureza;
    return ident;
  }
  /* "A validar" por gestão ponta a ponta (P8): o fallback valeu, P8 = NÃO e,
     com as MESMAS regras e só P8 trocada para SIM, o motor classificaria como
     Produto/Serviço principal ou Unidade de valor associada — ou seja, P8 era
     a única condição que faltava. Não depende de como as regras estão
     escritas: numa versão em que P8 não é requisito (fábrica, 3, 4), trocar
     P8 nunca muda o resultado e nada é marcado. Devolve a camada impedida ou
     null. */
  var CAMADAS_COM_REQUISITO_GESTAO = ['produto-principal', 'unidade-valor-associada'];
  var MOTIVO_GESTAO_NAO = 'Gestão ponta a ponta como solução: NÃO';
  function camadaImpedidaPorGestao(contexto, regras, decisao) {
    if (decisao.camada !== 'a-validar' || contexto.P8 !== 'NAO') return null;
    var M = window.faMotorArquitetura;
    var aplicada = ((regras && regras.regras) || []).filter(function (r) { return r.codigo === decisao.regraAplicada; })[0];
    if (!aplicada || !M.ehFallback(aplicada)) return null;
    var comGestao = M.identificarCamada(Object.assign({}, contexto, { P8: 'SIM' }), regras);
    return CAMADAS_COM_REQUISITO_GESTAO.indexOf(comGestao.camada) !== -1 ? comGestao.camada : null;
  }
  function justificativaImpedidaPorGestao(camadaId) {
    var rotulo = nomeClassificacao(camadaId);
    return 'As respostas atendem às demais condições exigidas para ' + rotulo + ', mas indicam que o item não poderia ser gerido de ponta a ponta como uma solução. ' +
      'Como esse é um requisito obrigatório para essa classificação, o item permanece como ' + nomeClassificacao('a-validar') + ' para análise.';
  }
  /* "A validar" por autonomia estrutural (P5 = SIM) × UMA natureza
     predominante (P11–P15): o fallback valeu, P5 = SIM e exatamente uma
     natureza está marcada. Com as MESMAS regras, troca-se uma resposta por vez:
       - só P5 para NÃO → o motor classificaria como aquela natureza: a
         autonomia é a única condição que impede a natureza ('autonomia');
       - só a natureza para NÃO → o motor classificaria como Produto/Serviço
         principal: a natureza é a única que o impede ('natureza');
       - as duas trocas resolvem → os sinais apontam para critérios
         incompatíveis, e nenhuma das duas é forçada ('ambiguo').
     Se nenhuma troca isolada resolve, falta mais de uma condição: nada é
     marcado e fica o texto genérico. Calculado DEPOIS da decisão, nunca lido
     pelo motor. Devolve { tipo, natureza (camada), pergunta (P11–P15) } ou null. */
  var TIPOS_BLOQUEIO_NATUREZA = ['autonomia', 'natureza', 'ambiguo'];
  function bloqueioPorNatureza(contexto, regras, decisao) {
    if (decisao.camada !== 'a-validar' || contexto.P5 !== 'SIM') return null;
    var M = window.faMotorArquitetura;
    var aplicada = ((regras && regras.regras) || []).filter(function (r) { return r.codigo === decisao.regraAplicada; })[0];
    if (!aplicada || !M.ehFallback(aplicada)) return null;
    var marcadas = Object.keys(M.CAMADA_POR_NATUREZA).filter(function (campo) { return contexto[campo] === 'SIM'; });
    if (marcadas.length !== 1) return null;
    /* Só para a lógica revisada (ver logicaDaVersao5Aprovada): versões
       antigas restauradas e a fábrica mantêm o texto da época. */
    if (!logicaDaVersao5Aprovada(regras)) return null;
    var pergunta = marcadas[0], natureza = M.CAMADA_POR_NATUREZA[pergunta];
    var trocada = {}; trocada[pergunta] = 'NAO';
    var semAutonomia = M.identificarCamada(Object.assign({}, contexto, { P5: 'NAO' }), regras).camada === natureza;
    var semNatureza = M.identificarCamada(Object.assign({}, contexto, trocada), regras).camada === 'produto-principal';
    if (!semAutonomia && !semNatureza) return null;
    return { tipo: semAutonomia && semNatureza ? 'ambiguo' : (semAutonomia ? 'autonomia' : 'natureza'), natureza: natureza, pergunta: pergunta };
  }
  /* LÓGICA DA VERSÃO 5 APROVADA — por comportamento, nunca pelo número da
     versão (uma restauração ou republicação idêntica ganha outro número) e
     nunca por texto (uma versão que só melhore redação continua valendo).
     A comparação usa a assinatura semântica do motor
     (faMotorArquitetura.criarVarreduraSemantica): o SHA-256 do que o motor
     DECIDE nas 65.536 combinações (camada, tipo de decisão e camadas em
     conflito — sem motivos, rótulos, códigos ou forma de escrita). Este arquivo não avalia condição nenhuma: só compara a
     assinatura das regras ativas com a da versão 5 aprovada. Qualquer
     diferença lógica desliga o tratamento (texto genérico, comportamento
     histórico).
     ASSINATURA_LOGICA_VERSAO5 é a assinatura da versão 5 aprovada (versão 3
     esperada + proposta de conflito de naturezas + P8 = SIM em
     Produto/Serviço principal e em Unidade de valor associada);
     teste-a-validar-natureza.js reconstrói essa versão e confere o valor —
     se a lógica dela mudar, o teste falha.
     Custo: a varredura roda em segundo plano, em pedaços curtos, assim que
     as regras carregam (prepararCompatibilidade), uma vez por conjunto de
     regras (cache pela referência do array, que o motor só troca quando a
     configuração muda). NUNCA há varredura síncrona num caminho de uso:
     Concluir, Reprocessar e Reprocessar em lote esperam por ela
     (quandoCompatibilidadePronta), então o resultado nunca depende da pressa
     de quem respondeu. Compatibilidade ainda desconhecida (só fora desses
     caminhos — ex.: cálculo de teste) = tratamento desligado; sem Web Crypto,
     idem (texto genérico, nunca uma explicação não verificada). */
  var ASSINATURA_LOGICA_VERSAO5 = '340b872a940376d927685b2e7537cbbcbd21416038d0642c0ce6db35b6c9bfd5';
  var equivalenciaPorRegras = typeof WeakMap === 'function' ? new WeakMap() : null;
  function guardarEquivalencia(lista, assinatura) {
    var equivalente = assinatura === ASSINATURA_LOGICA_VERSAO5;
    if (equivalenciaPorRegras) equivalenciaPorRegras.set(lista, equivalente);
    return equivalente;
  }
  function equivalenciaConhecida(lista) { return !!(equivalenciaPorRegras && equivalenciaPorRegras.has(lista)); }
  function logicaDaVersao5Aprovada(regrasCfg) {
    var lista = regrasCfg && regrasCfg.regras;
    if (!Array.isArray(lista)) return false;
    return equivalenciaConhecida(lista) ? equivalenciaPorRegras.get(lista) : false;
  }
  var varreduraEmCurso = null;
  var FATIA_MS = 8, COMBINACOES_POR_PASSO = 512;
  function agoraMs() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }
  function regrasAtivas() {
    var M = window.faMotorArquitetura;
    return M.regrasDaVersao(M.versaoAtual()).regras;
  }
  /* Chama cb quando a compatibilidade das regras ATIVAS já estiver
     conhecida: na hora, se já estiver; senão, ao fim da varredura em
     pedaços (que começa aqui, se ainda não começou). */
  function quandoCompatibilidadePronta(cb) {
    var lista = regrasAtivas();
    if (!Array.isArray(lista) || !equivalenciaPorRegras || equivalenciaConhecida(lista)) { cb(); return; }
    iniciarVarredura(lista).esperando.push(cb);
  }
  function prepararCompatibilidade() { quandoCompatibilidadePronta(function () {}); }
  function iniciarVarredura(lista) {
    if (varreduraEmCurso && varreduraEmCurso.lista === lista) return varreduraEmCurso;
    var anterior = varreduraEmCurso;
    var atual = varreduraEmCurso = {
      lista: lista, varredura: window.faMotorArquitetura.criarVarreduraSemantica(lista),
      esperando: anterior ? anterior.esperando : []
    };
    if (anterior) anterior.esperando = [];
    function passo() {
      if (varreduraEmCurso !== atual) return; /* as regras mudaram: outra varredura assumiu */
      var inicio = agoraMs(), terminou = false, falhou = false;
      try {
        do { terminou = atual.varredura.avancar(COMBINACOES_POR_PASSO); } while (!terminou && agoraMs() - inicio < FATIA_MS);
      } catch (e) {
        console.error('[avaliacao-produto] não foi possível comparar as regras com a versão 5 aprovada:', e);
        falhou = true;
      }
      if (!terminou && !falhou) { setTimeout(passo, 0); return; }
      function encerrar(assinatura) {
        if (varreduraEmCurso !== atual) return;
        guardarEquivalencia(lista, assinatura);
        varreduraEmCurso = null;
        var fila = atual.esperando;
        atual.esperando = [];
        /* de novo pelas regras ATIVAS: se mudaram durante a varredura, espera a delas */
        fila.forEach(function (cb) { quandoCompatibilidadePronta(cb); });
      }
      if (falhou) { encerrar(null); return; }
      atual.varredura.assinatura().then(encerrar, function (e) {
        console.error('[avaliacao-produto] não foi possível calcular a assinatura das regras (SHA-256):', e);
        encerrar(null);
      });
    }
    setTimeout(passo, 0);
    return atual;
  }
  /* Marca gravada e reconhecível (registro antigo sem ela, ou com valor
     desconhecido, segue o comportamento histórico). */
  function bloqueioNaturezaValido(b) {
    return !!(b && TIPOS_BLOQUEIO_NATUREZA.indexOf(b.tipo) !== -1 && camadaPorId(b.natureza) &&
      window.faMotorArquitetura.CAMADA_POR_NATUREZA[b.pergunta] === b.natureza);
  }
  function justificativaBloqueioNatureza(b) {
    var rotulo = nomeClassificacao(b.natureza);
    var principal = nomeClassificacao('produto-principal'), aValidar = nomeClassificacao('a-validar');
    if (b.tipo === 'autonomia') {
      return 'As respostas indicam ' + rotulo + ' como natureza predominante, mas também indicam autonomia estrutural. ' +
        'Como a classificação como ' + rotulo + ' exige que o item não tenha autonomia estrutural, o item permanece como ' + aValidar + ' para análise.';
    }
    if (b.tipo === 'natureza') {
      return 'As respostas atendem às demais condições exigidas para ' + principal + ', mas indicam ' + rotulo + ' como natureza predominante. ' +
        'Como ' + principal + ' não pode ter outra natureza arquitetural predominante, o item permanece como ' + aValidar + ' para análise.';
    }
    return 'As respostas indicam simultaneamente autonomia estrutural e ' + rotulo + '. ' +
      'Esses sinais conduzem a critérios incompatíveis entre ' + principal + ' e ' + rotulo + '. Por isso, o item permanece como ' + aValidar + ' para análise.';
  }
  /* Os três textos do conflito de naturezas predominantes — o mesmo em tela,
     justificativa e PDF, sempre a partir da lista dinâmica (rótulos das
     camadas marcadas, na ordem P11 → P15). */
  function textoNaturezasIndicadas(rotulos) { return 'Naturezas predominantes indicadas: ' + listaComE(rotulos || []); }
  function justificativaConflitoNaturezas(rotulos) {
    return 'As respostas indicam mais de uma natureza arquitetural como predominante: ' + listaComE(rotulos || []) + '. ' +
      'Como essas classificações representam naturezas distintas do item, não é possível determinar uma classificação arquitetural única com segurança. ' +
      'O caso requer análise antes da classificação definitiva.';
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
        /* Só o que a regra EXIGE (versão 5 do motor): "reconhecível" = P3/P4,
           "gerenciável" = P8, "resultado próprio" = P1/P2, "depende
           estruturalmente" = P5 NÃO — os termos da definição curada. Jornada
           (P6) e mensuração (P7) são evidências auxiliares e ficam de fora:
           a redação anterior as afirmava mesmo quando a resposta era NÃO. */
        return 'Depende estruturalmente de um ' + nomeClassificacao('produto-principal') + ', mas constitui uma unidade reconhecível e gerenciável, com resultado próprio para o cliente.';
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
        /* NÃO afirma "entregue a partir de outro Produto/Serviço": um item
           Informação/Documento pode existir de forma transversal, e nenhuma
           resposta do questionário sustenta essa dependência. Só descreve a
           natureza da entrega. */
        return 'É uma entrega cuja natureza predominante é informacional, documental ou de conteúdo.';
      default:
        return null;
    }
  }

  /* Rótulo único do resultado/decisão em qualquer lugar do site — tela,
     PDF e Excel. "NÃO É PRODUTO/SERVIÇO" sozinho dava a entender que o
     item foi descartado; o "PRINCIPAL" deixa explícito que o sistema está
     avaliando autonomia/independência, não impedindo que o item seja, por
     exemplo, um Componente ou uma Funcionalidade/Operação legítimos. */
  /* Rótulo de um resultado conhecido; ausente ou desconhecido devolve '' (quem
     exibe põe "—") — NUNCA vira "Não é Produto/Serviço principal" por omissão. */
  function rotuloResultado(v) {
    /* o nome da classificação vem da Taxonomia (faClassificacoes); só o molde "É / Não é" fica aqui */
    if (v === 'produto') return 'É ' + nomeClassificacao('produto-principal');
    if (v === 'nao-produto') return 'Não é ' + nomeClassificacao('produto-principal');
    if (v === 'a-validar') return nomeClassificacao('a-validar');
    return '';
  }
  /* DECISÃO FINAL — única regra, usada por tela, lista, PDF, Excel, histórico e
     auditoria: vale decisaoFinal; registro legado SEM decisaoFinal usa o
     resultadoAutomatico; qualquer outra coisa (ausente nos dois, ou um valor
     desconhecido gravado em decisaoFinal) é null, nunca um palpite. */
  function decisaoFinalDe(it) {
    if (!it) return null;
    var d = it.decisaoFinal;
    if (d === 'produto' || d === 'nao-produto' || d === 'a-validar') return d;
    if (d !== undefined && d !== null && d !== '') return null;
    var r = it.resultadoAutomatico;
    return (r === 'produto' || r === 'nao-produto' || r === 'a-validar') ? r : null;
  }
  function rotuloDecisaoFinal(it) { return rotuloResultado(decisaoFinalDe(it)); }

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
        return 'tem natureza predominantemente informacional, documental ou de conteúdo';
      default:
        return null;
    }
  }

  /* Oração "sua ... predominante é ..." do molde neutro da justificativa
     consolidada (ver gerarJustificativaAutomatica). Só camadas cujo papel
     descreve uma NATUREZA/FUNÇÃO do item, e não uma dependência de outro
     Produto/Serviço. */
  var NATUREZA_PREDOMINANTE_POR_CAMADA = {
    'documento-informacao': 'sua natureza predominante é informacional, documental ou de conteúdo',
    'canal': 'sua função predominante é a de canal de acesso ou relacionamento'
  };

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
    /* Também só com a marca gravada: a resposta que, sozinha, impediu a classificação. */
    var bloqueio = bloqueioNaturezaValido(camada.bloqueioNatureza) ? camada.bloqueioNatureza : null;
    if (bloqueio && resposta.valor === 'sim') {
      if (bloqueio.tipo === 'autonomia' && def.id === 'autonomia') {
        return 'Esta resposta impediu a classificação como ' + nomeClassificacao(bloqueio.natureza) +
          ', porque essa classificação exige ausência de autonomia estrutural e as demais condições foram atendidas.';
      }
      if (bloqueio.tipo === 'natureza' && def.codigoEstavel === bloqueio.pergunta) {
        return 'Esta resposta impediu a classificação como ' + nomeClassificacao('produto-principal') + ', porque as demais condições foram atendidas e esta natureza foi indicada como predominante.';
      }
    }
    if (def.id === 'gestao' && resposta.valor === 'nao') {
      /* Só com a marca gravada no cálculo — nunca deduzida de novo ao exibir
         (uma avaliação antiga mostraria uma explicação que não era a dela). */
      if (camada.impedidaPorGestao && CAMADAS_COM_REQUISITO_GESTAO.indexOf(camada.impedidaPorGestao) !== -1) {
        return 'Esta resposta impediu a classificação como ' + nomeClassificacao(camada.impedidaPorGestao) +
          ', porque a gestão ponta a ponta é um requisito obrigatório para essa classificação e as demais condições foram atendidas.';
      }
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
      camadaSugerida: camadaSugeridaDe(ident, atual)
    };
  }
  function camadaSugeridaDe(ident, atual) {
    var camadaSugerida = {
      id: ident.camada,
      label: nomeClassificacao(ident.camada),
      motivos: ident.motivos,
      conflito: ident.conflito,
      incoerencia: ident.incoerencia,
      especializacao: ident.especializacao,
      papelEstrutural: ident.papelEstrutural,
      relacao: relacaoArquitetural(ident.camada, atual)
    };
    /* Só existe neste caso (nas demais classificações o objeto gravado fica
       exatamente como antes). O rótulo diz o tipo de "A validar" em todo
       lugar que mostra a classificação — tela, PDF, lista e Excel. */
    if (ident.conflitoNaturezas) {
      camadaSugerida.conflitoNaturezas = true;
      camadaSugerida.label = nomeClassificacao(ident.camada) + SUFIXO_CONFLITO_NATUREZAS;
    }
    /* Também só neste caso, e o rótulo continua "A validar": a marca só
       escolhe a explicação (justificativa e interpretação de P8). Avaliações
       gravadas antes não a têm e continuam como eram. */
    if (ident.impedidaPorGestao) camadaSugerida.impedidaPorGestao = ident.impedidaPorGestao;
    if (ident.bloqueioNatureza) camadaSugerida.bloqueioNatureza = ident.bloqueioNatureza;
    return camadaSugerida;
  }

  /* Nunca um texto fixo: a frase muda com a camada encontrada e com os
     próprios motivos (pergunta + resposta real) que a sustentaram. */
  function gerarJustificativaAutomatica(atual, calc) {
    var camada = calc.camadaSugerida;
    if (camada.incoerencia) {
      return 'Há respostas que indicam autonomia e outras que indicam dependência. Revise os critérios destacados.';
    }
    if (camada.id === 'a-validar') {
      if (camada.conflitoNaturezas) return justificativaConflitoNaturezas(camada.conflito);
      if (camada.impedidaPorGestao) return justificativaImpedidaPorGestao(camada.impedidaPorGestao);
      if (bloqueioNaturezaValido(camada.bloqueioNatureza)) return justificativaBloqueioNatureza(camada.bloqueioNatureza);
      if (camada.conflito && camada.conflito.length > 1) {
        return 'As respostas indicam características de mais de uma categoria arquitetural (' + listaComE(camada.conflito) +
          ') e não há evidência suficiente para recomendar uma classificação única.';
      }
      return 'As respostas não reúnem evidência suficiente para indicar com segurança nenhuma das categorias arquiteturais previstas. ' +
        'Revise as respostas do questionário ou registre uma decisão manual com a justificativa correspondente.';
    }
    var principal = nomeClassificacao('produto-principal');
    if (camada.id === 'produto-principal') {
      return 'O item foi classificado como ' + principal + ' porque as respostas confirmam ' + listaComE(camada.motivos) +
        ', sem nenhum sinal de que exerça predominantemente outro papel arquitetural.';
    }
    /* A justificativa AUTOMÁTICA só leva o que o questionário/motor produziu. Especialização e Papel
       estrutural CADASTRADOS por uma pessoa são curadoria: aparecem só na Curadoria (senão uma explicação
       do motor passaria a conter dado humano e ficaria desatualizada quando a curadoria mudasse).
       A especialização que o questionário DERIVA sozinho (ex.: "Opção/configuração de personalização")
       entra, dita explicitamente como identificada pelo questionário. O texto de fallback
       ("não determinada pelo questionário") continua fora da frase. */
    var especializacaoDoQuestionario = valorEspecializacao({ especializacao: identificarCamada(Object.assign({}, atual, {
      especializacaoCadastrada: null, papelEstruturalCadastrado: null, especializacaoCamadaConfirmada: null, papelEstruturalCamadaConfirmada: null })).especializacao });
    var especializacaoFrase = especializacaoDoQuestionario ? ' Especialização identificada pelo questionário: ' + especializacaoDoQuestionario + '.' : '';
    var papelEstruturalFrase = ''; /* o Papel estrutural só vem de cadastro: nunca entra na justificativa automática */

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
      /* Só o que a regra de Componente exige: autonomia (P5 NÃO) e resultado
         autônomo (P2 NÃO). Jornada (P6) não é verificada — a frase anterior
         negava "jornada própria" mesmo quando a resposta era SIM. */
      return 'O item não possui autonomia estrutural nem resultado autônomo suficiente para caracterizar ' + principal + '. ' +
        'As respostas indicam que ele pertence estruturalmente a outra solução e ' + papelComponente + '. ' +
        'Por isso, sua classificação predominante é ' + nomeClassificacao('componente') + '.' + especializacaoFrase + papelEstruturalFrase;
    }

    /* Informação/Documento — e Canal quando P2 = SIM — ganham um molde próprio,
       neutro: "não como uma solução com resultado próprio" CONTRADIZ P2 = SIM
       (achado real: item com P2 = SIM e P10 = SIM, corretamente classificado
       como Informação/Documento, recebia uma justificativa que negava o
       resultado próprio que a própria pessoa afirmou). Regra editorial geral:
       com P2 = SIM nenhum texto automático nega resultado próprio. Ser
       informacional/de canal descreve a NATUREZA PREDOMINANTE do item, não a
       ausência de identidade ou de resultado percebido. Continua vindo só da
       camada e de P2 — nunca do nome do item. */
    var naturezaPredominante = NATUREZA_PREDOMINANTE_POR_CAMADA[camada.id];
    var p2Sim = !!(atual.respostas && atual.respostas.resultado && atual.respostas.resultado.valor === 'sim');
    if (naturezaPredominante && (camada.id === 'documento-informacao' || p2Sim)) {
      return 'Embora o item possa possuir identidade e produzir resultado percebido pelo usuário, ' + naturezaPredominante + '. ' +
        'Por isso, foi classificado como ' + nomeClassificacao(camada.id) + ', e não como ' + principal + '.' + especializacaoFrase;
    }

    /* Funcionalidade/Operação ganha uma segunda frase fixa descrevendo o
       papel típico da camada (consultar/escolher/solicitar/alterar/
       executar/administrar um elemento da solução principal) — é uma
       propriedade da PRÓPRIA camada, igual para qualquer item que caia nela,
       não uma inferência sobre este item específico. */
    var complemento = camada.id === 'funcionalidade-operacao'
      ? ' Sua função predominante é permitir que o cliente consulte, escolha, solicite, altere, execute ou administre um elemento pertencente à solução principal.'
      : '';

    return 'O item foi classificado como ' + nomeClassificacao(camada.id) + ', e não como ' + principal + ', porque ' +
      motivoJustificativa(camada.id) + '.' + complemento + especializacaoFrase;
  }

  function todasRespondidas(atual) {
    return primeiraPerguntaFaltando(atual) === null;
  }
  /* Devolve o id da primeira pergunta sem resposta (para focar/destacar),
     ou null se todas as 14 já foram respondidas. */
  function primeiraPerguntaFaltando(atual) {
    /* resposta herdada de uma pergunta cujo texto mudou não conta como resposta à pergunta nova */
    var faltante = TODAS_PERGUNTAS.filter(function (p) { return !respostaValida(p, atual); });
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
  /* Foco inicial de um campo recém-desenhado. Era um setTimeout de 30 ms: se nesse meio-tempo a
     pessoa já tivesse escolhido outro campo (ex.: Descrição logo depois de "+ Nova opção"), o foco
     atrasado a puxava de volta e o texto caía no campo errado. Todos os chamadores desenham antes
     (render síncrono), então o campo já existe: foca na hora. Se ainda não existir, tenta uma única
     vez depois — e só se ninguém mexeu no foco nesse meio-tempo. */
  function focarCampo(id) {
    function aplicar(el) { el.focus(); if (el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    var el = document.getElementById(id);
    if (el && el.focus) { aplicar(el); return; }
    var focoAntes = document.activeElement;
    setTimeout(function () {
      if (document.activeElement !== focoAntes) return;
      var tarde = document.getElementById(id);
      if (tarde && tarde.focus) aplicar(tarde);
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
    '.pdf-decisao-bloco{page-break-inside:avoid;break-inside:avoid}' +
    '.pdf-nota{color:#555;font-size:10px;font-style:italic;margin:4px 0}' +
    '.pdf-tabela-versoes{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:9px}' +
    '.pdf-tabela-versoes th{text-align:left;padding:3px 5px;background:#f2f4f8;border:1px solid #ddd;font-weight:bold}' +
    '.pdf-tabela-versoes td{padding:3px 5px;border:1px solid #ddd;vertical-align:top}' +
    '.pdf-tabela-versoes tr{page-break-inside:avoid;break-inside:avoid}' +
    '.pdf-trilha-item{border-left:3px solid #c8d2e8;padding:2px 0 2px 8px;margin:0 0 6px;font-size:10px;page-break-inside:avoid;break-inside:avoid}' +
    '.pdf-trilha-item span{color:#666}';

  /* ---------- Trilha da curadoria e da decisão ----------
     UM só lugar para os textos: a ficha, o PDF e o Excel descrevem cada linha de auditoria e cada
     mudança entre versões com as mesmas funções — nenhuma segunda interpretação. */
  function rotuloValorAuditoria(tipo, v) {
    if (v === null || v === undefined || v === '') return '—';
    if (tipo === 'alteracao_decisao_final') {
      if (v.pendente) return 'ainda sem decisão — a versão começa pela recomendação do sistema';
      var t = rotuloResultado(v.decisaoFinal) || '—';
      return t + (v.decisaoManual ? ' (manual)' : (v.confirmada ? ' (recomendação aceita)' : ''));
    }
    if (tipo === 'alteracao_natureza_complementar') return v.nome || '—';
    if (tipo === 'alteracao_papel_estrutural') return v === 'essencial' ? 'Essencial' : (v === 'opcional' ? 'Opcional' : String(v));
    return String(v);
  }
  var ROTULO_TIPO_AUDITORIA = {
    alteracao_especializacao: 'Especialização',
    alteracao_papel_estrutural: 'Papel estrutural',
    alteracao_natureza_complementar: 'Natureza complementar',
    alteracao_decisao_final: 'Decisão final'
  };
  /* Uma linha de auditoria em TEXTO PURO (quem escreve em HTML faz o esc):
     { titulo, anterior, novo, valores, quem, origem, detalhe }. */
  function descreverLinhaAuditoria(e, paraExportacao) {
    /* Exportações nunca levam e-mail: sem nome, "—". A ficha (tela interna) mantém o e-mail como último recurso. */
    var quem = (e.usuario && (e.usuario.name || (paraExportacao ? '' : e.usuario.email))) || '—';
    /* Reprocessamento automático NÃO é decisão de uma pessoa: a origem, o motor que
       provocou a mudança e quem DISPAROU o reprocessamento aparecem explícitos. */
    var origem = e.reavaliacao
      ? 'Nova versão criada por reavaliação da v' + (e.reavaliacao.deVersao || '—') + ' (v' + (e.reavaliacao.paraVersao || '—') + ') por ' + quem
      : e.origem === 'reprocessamento-automatico'
      ? 'Reprocessamento automático' + (e.reprocessamento === 'lote' ? ' em lote' : '') + ' — motor ' + (e.motorVersion || '—') +
        (e.motorVersionArquitetura ? ' (regras v' + e.motorVersionArquitetura + ')' : '') + ' · disparado por ' + quem
      : 'por ' + quem;
    /* Nome ATUAL da classificação (pelo código); o gravado na época vem junto quando difere. */
    var camadaTxt = e.camada && (e.camada.id || e.camada.label) ? rotuloCamadaAtual(e.camada) : '';
    var camadaEpoca = e.camada ? rotuloCamadaNaConclusao(e.camada) : '';
    if (camadaTxt && camadaEpoca) camadaTxt += ' (na época: ' + camadaEpoca + ')';
    var detalhe = [];
    if (e.justificativa) detalhe.push('Justificativa: "' + e.justificativa + '"');
    if (e.confirmacao) detalhe.push('confirmada para a classificação “' + camadaTxt + '”');
    else if (e.valorSemEfeitoSubstituido) detalhe.push('substituiu o valor anterior sem efeito “' + e.valorSemEfeitoSubstituido + '”');
    /* Confirmação NÃO é alteração de texto: o valor é o mesmo, só passou a valer para a classificação
       atual. O histórico diz "confirmada", sem a seta anterior → novo (que sugeriria uma mudança). */
    var titulo = e.confirmacao && e.tipo === 'alteracao_especializacao' ? 'Especialização confirmada'
      : e.confirmacao && e.tipo === 'alteracao_papel_estrutural' ? 'Papel estrutural confirmado'
      : (ROTULO_TIPO_AUDITORIA[e.tipo] || e.tipo);
    var anterior = e.confirmacao ? '' : rotuloValorAuditoria(e.tipo, e.valorAnterior);
    var novo = rotuloValorAuditoria(e.tipo, e.valorNovo);
    /* Evento = o que aconteceu; Campo = sobre o quê (o mesmo rótulo de campo, sem "confirmada"). */
    var evento = e.reavaliacao ? 'Criação por reavaliação'
      : e.origem === 'reprocessamento-automatico' ? 'Reprocessamento automático'
      : e.confirmacao ? 'Confirmação' : 'Alteração';
    return { titulo: titulo, campo: ROTULO_TIPO_AUDITORIA[e.tipo] || e.tipo, evento: evento, anterior: anterior, novo: novo,
      valores: e.confirmacao ? novo : anterior + ' → ' + novo, quem: quem, origem: origem, detalhe: detalhe.join(' · ') };
  }
  /* Todas as versões do MESMO item, da mais antiga para a mais nova: anda para trás por
     versaoAnteriorKey e para a frente pelas reavaliações que apontam para a versão atual da
     cadeia. Nunca agrupa por nome. `todos` = a lista completa de avaliações carregadas. */
  function cadeiaDe(a, todos) {
    function buscar(key) { return todos.filter(function (it) { return it._key === key; })[0]; }
    var cadeia = [];
    var visto = {};
    var atras = buscar(a._key) || a;
    while (atras && !visto[atras._key] && cadeia.length < 60) {
      visto[atras._key] = true;
      cadeia.unshift(atras);
      atras = atras.versaoAnteriorKey ? buscar(atras.versaoAnteriorKey) : null;
    }
    var frente = cadeia[cadeia.length - 1];
    for (var guarda = 0; frente && guarda < 60; guarda++) {
      var proxima = todos.filter(function (o) { return o.versaoAnteriorKey === frente._key && !visto[o._key]; })[0];
      if (!proxima) break;
      visto[proxima._key] = true;
      cadeia.push(proxima);
      frente = proxima;
    }
    return cadeia;
  }
  /* Versão criada por reavaliação que ainda não teve decisão registrada: diz o que vale
     (a recomendação do sistema) e onde ficou a decisão manual anterior. '' quando não se aplica. */
  function textoDecisaoPendenteReavaliacao(a, todos) {
    if (!semDecisaoRegistrada(a)) return '';
    var ant = todos.filter(function (o) { return o._key === a.versaoAnteriorKey; })[0];
    var vAnt = (ant && ant.versao) || ((a.versao || 2) - 1);
    var txt = 'Esta versão (v' + (a.versao || vAnt + 1) + ') foi criada por reavaliação e ainda não tem decisão arquitetural registrada: ' +
      'vale a recomendação do sistema até alguém decidir.';
    if (ant && ant.decisaoManual) txt += ' A decisão manual da v' + vAnt + ' continua preservada na v' + vAnt + ' e não foi herdada.';
    return txt;
  }
  /* Curadoria de uma versão em texto: o que vale (vigente) e o que existe só como nota
     (a revisar / sem efeito) — nunca o valor antigo. */
  function contagemCuradoria(it) {
    var cur = curadoriaRegistrada(it), ant = curadoriaAnterior(it);
    function n(campo, situacao) { return ant[campo] && ant[campo].situacao === situacao ? 1 : 0; }
    return {
      nCur: (cur.especializacao ? 1 : 0) + (cur.papelEstrutural ? 1 : 0) + (cur.natureza ? 1 : 0),
      nRev: n('especializacao', 'a-revisar') + n('papelEstrutural', 'a-revisar'),
      nSem: n('especializacao', 'sem-efeito') + n('papelEstrutural', 'sem-efeito')
    };
  }
  /* Texto da faixa-resumo da ficha ("2 campos registrados · 1 para revisar"). */
  function resumoCuradoria(it) {
    var c = contagemCuradoria(it);
    var txt = c.nCur ? c.nCur + (c.nCur === 1 ? ' campo registrado' : ' campos registrados') : 'nenhuma registrada';
    if (c.nRev) txt += ' · ' + c.nRev + ' para revisar';
    return txt;
  }
  /* Coluna "Situação da curadoria" do Excel: o mesmo resumo (com inicial maiúscula) + os sem efeito. */
  function situacaoCuradoria(it) {
    var c = contagemCuradoria(it);
    var txt = resumoCuradoria(it) + (c.nSem ? ' · ' + c.nSem + ' sem efeito' : '');
    return txt.charAt(0).toUpperCase() + txt.slice(1);
  }
  /* Notas secundárias do PDF: dizem que EXISTE informação anterior, sem repetir o conteúdo dela. */
  function notasCuradoriaAnterior(it) {
    var c = contagemCuradoria(it), notas = [];
    if (c.nRev) notas.push('Há informações anteriores disponíveis para revisão.');
    if (c.nSem) notas.push('Há informação de curadoria anterior sem efeito nesta versão.');
    return notas;
  }
  /* O QUE FOI GRAVADO em uma versão, em texto — a base de "o que mudou" (PDF e Excel). */
  function retratoDaVersao(it) {
    var concluido = it.status === 'concluido';
    return {
      resultado: concluido ? rotuloResultado(it.resultadoAutomatico) : '',
      classificacao: rotuloCamadaAtual(it.camadaSugerida),
      decisao: concluido ? rotuloDecisaoFinal(it) : '',
      forma: concluido ? formaDaDecisao(it) : ''
    };
  }
  function descreverMudanca(anterior, atual) {
    if (!atual) return '';
    if (!anterior) return atual.versao > 1 ? 'Versão anterior indisponível' : 'Versão inicial';
    var a = retratoDaVersao(anterior), b = retratoDaVersao(atual), partes = [];
    [['Resultado', 'resultado'], ['Classificação', 'classificacao'], ['Decisão final', 'decisao'], ['Forma da decisão', 'forma']].forEach(function (c) {
      if (a[c[1]] !== b[c[1]]) partes.push(c[0] + ': ' + (a[c[1]] || '—') + ' → ' + (b[c[1]] || '—'));
    });
    return partes.length ? partes.join('; ') : 'Sem mudança no resultado, na classificação nem na decisão';
  }
  /* Leitura da auditoria de uma versão (curadoria-auditoria + a da natureza complementar), em ordem
     cronológica. Rede lenta é condição normal: a espera tem limite, e falha OU demora viram
     { ok: false } — o documento diz "Trilha indisponível", nunca finge uma trilha vazia. */
  var TEMPO_TRILHA_MS = 6000;
  function lerTrilhaDe(chave, cb) {
    var encerrada = false, pend = 2, linhas = [], falhou = false, timer = null;
    function encerrar(erro) {
      if (encerrada) return;
      encerrada = true;
      clearTimeout(timer);
      linhas.sort(function (x, y) { return String(x.dataHora || '').localeCompare(String(y.dataHora || '')); });
      cb({ ok: !erro, linhas: erro ? [] : linhas });
    }
    timer = setTimeout(function () { encerrar(true); }, TEMPO_TRILHA_MS);
    function ler(no) {
      function fim(erro) { if (erro) falhou = true; if (--pend === 0) encerrar(falhou); }
      try {
        db().ref(no + '/' + chave).once('value', function (snap) {
          var v = snap.val() || {};
          Object.keys(v).forEach(function (k) { if (v[k]) linhas.push(Object.assign({ _key: k }, v[k])); });
          fim(false);
        }, function (err) {
          console.error('[avaliacao-produto] erro ao ler a trilha da exportação:', err);
          fim(true);
        });
      } catch (e) { console.error('[avaliacao-produto] erro ao ler a trilha da exportação:', e); fim(true); }
    }
    ler(NODE_CURADORIA_AUDITORIA);
    ler(window.faNaturezas.NODE_AUDITORIA);
  }
  /* cb({ <chave>: { ok, linhas } }) — todas em paralelo. */
  function lerTrilhas(chaves, cb) {
    var unicas = [], vistas = {};
    chaves.forEach(function (k) { if (k && !vistas[k]) { vistas[k] = true; unicas.push(k); } });
    var mapa = {}, pend = unicas.length;
    if (!pend) { cb(mapa); return; }
    unicas.forEach(function (k) {
      lerTrilhaDe(k, function (r) { mapa[k] = r; if (--pend === 0) cb(mapa); });
    });
  }

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
  function montarSecaoAvaliacaoPdf(it, primeira, ctx) {
    var html = '<section class="pdf-av' + (primeira ? '' : ' pdf-quebra') + '">';
    var rotuloVersao = it.versao > 1 ? ('Reavaliação — versão ' + it.versao + ' (versões anteriores preservadas)') : 'Avaliação original preservada — versão 1';
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

    /* A ordem é a da ficha (tela): Identificação → O que o sistema concluiu → O que uma pessoa
       complementou → O que uma pessoa decidiu → Como chegamos até aqui → Respostas e evidências.
       Resultado automático, curadoria, decisão e histórico nunca se misturam. */
    var rotuloResultadoTxt = rotuloResultado(it.resultadoAutomatico) || '—';
    var camada = it.camadaSugerida;
    html += '<h2 class="pdf-secao-titulo">O que o sistema concluiu</h2>';
    html += '<h3 class="pdf-subsecao">Resultado sobre Produto/Serviço</h3>';
    html += '<p class="pdf-resultado pdf-resultado--' + esc(it.resultadoAutomatico || 'a-validar') + '">' +
      esc(rotuloResultadoTxt) + '</p>';
    html += '<h3 class="pdf-subsecao">Justificativa da classificação</h3>';
    html += '<p>' + esc(it.justificativaAutomatica || '—') + '</p>';

    /* Classificação arquitetural: bloco PRÓPRIO e indivisível (título + conteúdo na mesma página). A
       especialização identificada pelo questionário é saída do motor e fica aqui, nunca na Curadoria. */
    html += '<h2 class="pdf-secao-titulo">Classificação arquitetural</h2>';
    html += '<div class="pdf-decisao-bloco">';
    html += '<p>' + esc(rotuloCamadaAtual(camada) || '—') + '</p>';
    /* Nome atual (Taxonomia) e, quando difere, o nome registrado na conclusão — que nunca é reescrito. */
    var camadaNaConclusaoPdf = rotuloCamadaNaConclusao(camada);
    if (camadaNaConclusaoPdf) html += '<p class="pdf-meta-versoes">Nome registrado na conclusão: ' + esc(camadaNaConclusaoPdf) + '</p>';
    var espDerivada = especializacaoDerivada(it);
    if (espDerivada) html += '<p>Especialização identificada pelo questionário: ' + esc(espDerivada) + '</p>';
    if (camada && camada.conflitoNaturezas) {
      html += '<p class="pdf-aviso">' + esc(textoNaturezasIndicadas(camada.conflito)) + '.</p>';
    } else if (camada && camada.conflito && camada.conflito.length) {
      html += '<p class="pdf-aviso">Categorias em conflito nas respostas: ' + esc(camada.conflito.join(', ')) + '.</p>';
    }
    if (camada && camada.incoerencia) {
      html += '<p class="pdf-aviso">Há respostas que indicam autonomia e outras que indicam dependência. Revise os critérios destacados.</p>';
    }
    if (camada && camada.relacao) html += '<p><strong>Relação arquitetural:</strong> ' + esc(camada.relacao) + '</p>';
    html += '</div>';

    /* pdf-decisao-bloco (page-break-inside:avoid) — mesma proteção já usada
       em pdf-pergunta-bloco: sem envolver a tabela num único bloco
       indivisível, html2pdf.js podia cortar as linhas da tabela na borda da
       página sem empurrar o resto pra uma página nova — confirmado
       renderizando o PDF de verdade (pixels, via pdf.js), não só inspecionando
       o HTML fonte antes de virar canvas/imagem. */
    html += '<h2 class="pdf-secao-titulo">O que uma pessoa complementou</h2>';
    var curReg = curadoriaRegistrada(it);
    var curEsp = curReg.especializacao, curPapel = curReg.papelEstrutural, curNat = rotuloNaturezaDoItem(it);
    if (curEsp || curPapel || curNat) {
      html += '<div class="pdf-decisao-bloco"><table class="pdf-tabela-id">';
      if (curEsp) html += pdfLinhaTabela('Especialização', curEsp);
      if (curPapel) html += pdfLinhaTabela('Papel estrutural', curPapel);
      if (curNat) html += pdfLinhaTabela('Natureza complementar', curNat);
      html += '</table></div>';
    } else {
      html += '<p>Nenhuma informação de curadoria registrada nesta versão.</p>';
    }
    notasCuradoriaAnterior(it).forEach(function (n) { html += '<p class="pdf-nota">' + esc(n) + '</p>'; });

    html += '<h2 class="pdf-secao-titulo">O que uma pessoa decidiu</h2>';
    html += '<div class="pdf-decisao-bloco"><table class="pdf-tabela-id">';
    html += pdfLinhaTabela('Recomendação do sistema', rotuloResultadoTxt);
    html += pdfLinhaTabela('Decisão final', rotuloDecisaoFinal(it));
    html += pdfLinhaTabela('Forma da decisão', formaDaDecisao(it));
    if (it.decisaoManual) {
      html += pdfLinhaTabela('Justificativa da decisão manual', it.justificativaDecisao);
      html += pdfLinhaTabela('Responsável pela decisão', it.alteradoPor && it.alteradoPor.name);
      html += pdfLinhaTabela('Data e hora da decisão', fmtData(it.alteradoEm));
    }
    html += '</table></div>';
    var todos = (ctx && ctx.todos) || [];
    var pendente = textoDecisaoPendenteReavaliacao(it, todos);
    if (pendente) html += '<p class="pdf-nota">' + esc(pendente) + '</p>';

    /* Quebra de página: o html2pdf trata page-break-after:avoid em h2/h3 como regra fraca — o título
       podia ficar sozinho no fim da página e o conteúdo começar na seguinte. O que segura título e
       conteúdo juntos é o bloco indivisível (pdf-decisao-bloco), o mesmo da Curadoria e da Decisão:
       cada título/subtítulo vai junto do seu PRIMEIRO conteúdo. Só a estrutura muda; texto e ordem não. */
    var cadeia = cadeiaDe(it, todos);
    var trilhaConteudo = [];
    var trilha = ctx && ctx.trilhas && ctx.trilhas[it._key];
    if (!trilha || !trilha.ok) {
      trilhaConteudo.push('<p class="pdf-aviso">Trilha indisponível: não foi possível ler o registro de alterações desta versão agora. ' +
        'O histórico de versões acima vem dos dados gravados e está completo.</p>');
    } else if (!trilha.linhas.length) {
      trilhaConteudo.push('<p>Nenhuma alteração registrada para esta versão. O registro vale a partir da introdução da auditoria; alterações anteriores não foram registradas.</p>');
    } else {
      trilha.linhas.slice().reverse().forEach(function (e) {
        var d = descreverLinhaAuditoria(e, true);
        trilhaConteudo.push('<div class="pdf-trilha-item"><strong>' + esc(d.titulo) + '</strong>: ' + esc(d.valores) +
          '<br><span>' + esc(d.origem) + ' em ' + esc(fmtData(e.dataHora)) + (d.detalhe ? esc(' · ' + d.detalhe) : '') + '</span></div>');
      });
    }
    var tituloTrilha = '<h3 class="pdf-subsecao">Trilha da curadoria e da decisão</h3>';
    html += '<div class="pdf-decisao-bloco"><h2 class="pdf-secao-titulo">Como chegamos até aqui</h2>';
    if (cadeia.length >= 2) {
      html += '<h3 class="pdf-subsecao">Histórico de versões</h3>';
      html += '<table class="pdf-tabela-versoes"><thead><tr><th>Versão</th><th>Data</th><th>Responsável</th><th>Resultado</th><th>Classificação</th><th>Decisão final</th><th>Forma da decisão</th><th>O que mudou</th></tr></thead><tbody>';
      cadeia.forEach(function (v, i) {
        var r = retratoDaVersao(v);
        html += '<tr><td>v' + esc(v.versao || 1) + (v._key === it._key ? ' (esta)' : '') + '</td><td>' + esc(fmtData(v.criadoEm)) + '</td><td>' +
          esc(v.responsavel && v.responsavel.name || '—') + '</td><td>' + esc(r.resultado || (v.status === 'concluido' ? '—' : 'Em andamento')) +
          '</td><td>' + esc(r.classificacao || '—') + '</td><td>' + esc(r.decisao || '—') + '</td><td>' + esc(r.forma || '—') +
          '</td><td>' + esc(descreverMudanca(cadeia[i - 1], v)) + '</td></tr>';
      });
      html += '</tbody></table></div>';
      html += '<div class="pdf-decisao-bloco">' + tituloTrilha + trilhaConteudo[0] + '</div>';
    } else {
      /* versão única: o título da seção, o subtítulo da trilha e o 1º conteúdo ficam juntos */
      html += tituloTrilha + trilhaConteudo[0] + '</div>';
    }
    trilhaConteudo.slice(1).forEach(function (el) { html += el; });

    html += '<h2 class="pdf-secao-titulo">Respostas e evidências</h2>';
    var notaHistoricaPdf = notaTextoHistorico(it);
    if (notaHistoricaPdf) html += '<p class="pdf-meta-versoes pdf-nota-texto-historico">' + esc(notaHistoricaPdf) + '</p>';
    html += '<h3 class="pdf-subsecao">Critérios principais — perguntas 1 a ' + CRITERIOS.length + '</h3>';
    CRITERIOS.forEach(function (c) { html += pdfPergunta(c, it.respostas[c.id], it); });
    html += '<h3 class="pdf-subsecao">Testes de classificação — perguntas ' + (CRITERIOS.length + 1) + ' a ' + TODAS_PERGUNTAS.length + '</h3>';
    EXCLUSOES.forEach(function (e) { html += pdfPergunta(e, it.respostas[e.id], it); });
    html += '</section>';
    return html;
  }
  /* Documento PDF de UM bloco: o <style> + (opcionalmente) o cabeçalho do
     relatório + o conteúdo já pronto. Cada bloco vira o seu próprio canvas. */
  function envolverBlocoPdf(conteudo, comCabecalho) {
    return '<div class="pdf-doc"><style>' + CSS_PDF + '</style>' + (comCabecalho ? montarCabecalhoPdf() : '') + conteudo + '</div>';
  }
  /* "Átomos" de uma avaliação: os filhos diretos da <section>, com cada título
     (h2/h3) colado ao elemento que vem depois dele — nunca separar um título do
     seu conteúdo na fronteira entre dois blocos. */
  function atomosDaAvaliacao(it, ctx) {
    var tmp = document.createElement('div');
    tmp.innerHTML = montarSecaoAvaliacaoPdf(it, true, ctx);
    var secao = tmp.firstElementChild;
    var atomos = [];
    var titulos = '';
    Array.prototype.forEach.call(secao.children, function (el) {
      if (el.tagName === 'H2' || el.tagName === 'H3') { titulos += el.outerHTML; return; }
      atomos.push(titulos + el.outerHTML);
      titulos = '';
    });
    if (titulos) atomos.push(titulos);
    return atomos;
  }
  /* Altura (px CSS) máxima de um bloco. O navegador limita o tamanho de um
     canvas — no Chrome ~65 mil px de altura, no Safari do iPhone ~16,7 milhões
     de px de ÁREA — e acima disso devolve um canvas todo em branco, sem erro.
     Com a escala 2 usada na captura e 186 mm (~703 px) de largura, 4400 px CSS
     dão uma imagem de ~1406 x 8800 = 12,4 milhões de px: cabe no pior caso
     conhecido, e a qualidade (escala 2) não muda. O que cresce com o volume é o
     NÚMERO de blocos, nunca o tamanho de cada canvas. */
  var ALTURA_MAX_BLOCO_PDF = 4400;
  /* Divide as avaliações em blocos: cada avaliação começa um bloco novo (e,
     portanto, uma página nova), e uma avaliação longa continua em novos blocos
     quando passar da altura máxima. `medidor` é um contêiner já no DOM, com a
     largura real do documento. */
  function planejarBlocosPdf(itens, medidor, ctx) {
    return planejarBlocosDeAtomos(itens.map(function (it) { return atomosDaAvaliacao(it, ctx); }), medidor, function (html) {
      return envolverBlocoPdf('<section class="pdf-av">' + html + '</section>', false);
    });
  }
  /* Núcleo genérico (compartilhado com a Adequação à Squad): recebe, para cada
     item, a lista de "átomos" já prontos e uma função que monta o documento de
     MEDIÇÃO de um conjunto de átomos. */
  function planejarBlocosDeAtomos(atomosPorItem, medidor, documentoParaMedir) {
    var blocos = [];
    function altura(html) { medidor.innerHTML = documentoParaMedir(html); return medidor.scrollHeight; }
    atomosPorItem.forEach(function (atomos) {
      var atual = [];
      atomos.forEach(function (atomo) {
        if (atual.length && altura(atual.join('') + atomo) > ALTURA_MAX_BLOCO_PDF) {
          blocos.push(atual.join(''));
          atual = [];
        }
        atual.push(atomo);
      });
      if (atual.length) blocos.push(atual.join(''));
    });
    medidor.innerHTML = '';
    return blocos;
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
  function gerarPdf(itens, nomeArquivo, cbFim, todosOsItens) {
    /* A trilha (quem/quando/anterior → novo) vem da auditoria: uma leitura extra, com limite de espera;
       se falhar ou demorar, o PDF sai igual e marca "Trilha indisponível". */
    lerTrilhas(itens.map(function (it) { return it._key; }), function (trilhas) {
      var ctx = { todos: todosOsItens || itens, trilhas: trilhas };
      gerarPdfPorBlocos({
        nomeArquivo: nomeArquivo,
        planejar: function (medidor) { return planejarBlocosPdf(itens, medidor, ctx); },
        envolver: function (htmlBloco, indice) { return envolverBlocoPdf('<section class="pdf-av">' + htmlBloco + '</section>', indice === 0); }
      }, cbFim);
    });
  }
  /* cfg = { nomeArquivo, planejar(medidor) → [htmlDeCadaBloco], envolver(htmlBloco, indice) → documento }.
     É o MESMO motor de blocos do PDF consolidado (altura limitada por canvas,
     jsPDF compartilhado, "Página X de N" no fim); quem muda é só o conteúdo. */
  function gerarPdfPorBlocos(cfg, cbFim) {
    var nomeArquivo = cfg.nomeArquivo;
    carregarScript('forca-agil/html2pdf.bundle.min.js', function () { return typeof window.html2pdf === 'function'; }, function (erroCarga) {
      if (erroCarga) { cbFim(erroCarga); return; }
      /* 186mm = largura A4 (210mm) menos as margens esquerda+direita definidas
         abaixo (12mm cada). Precisa bater exatamente com pageSize.inner.width
         do jsPDF — um container mais largo que a área imprimível fica cortado
         na borda direita. */
      var ESTILO_CONTAINER = 'width:186mm;background:#fff;';
      var medidor = document.createElement('div');
      medidor.style.cssText = ESTILO_CONTAINER;
      document.body.appendChild(medidor);
      var container = null;
      function limpar() {
        if (container && container.parentNode) document.body.removeChild(container);
        if (medidor.parentNode) document.body.removeChild(medidor);
      }
      var compartilhado = { pdf: null, ultimo: null };
      function concluir(erro) { limpar(); cbFim(erro || null); }

      /* Um bloco = um canvas pequeno, desenhado no MESMO jsPDF (compartilhado):
         o PDF cresce página a página e nenhum canvas depende do total. */
      function renderizarBloco(htmlBloco, indice, fim) {
        container = document.createElement('div');
        container.style.cssText = ESTILO_CONTAINER;
        container.innerHTML = cfg.envolver(htmlBloco, indice);
        document.body.appendChild(container);
        aguardarRenderizacaoCompleta(function () {
          /* A altura real (scrollHeight, já com o layout assentado) é passada
             explicitamente, em vez de deixar a biblioteca adivinhar. */
          if (!container.scrollHeight) { fim(new Error('Container de exportação sem conteúdo renderizado.')); return; }
          try {
            var trabalho = window.html2pdf().set({
              margin: [14, 12, 16, 12],
              filename: nomeArquivo,
              image: { type: 'jpeg', quality: 0.95 },
              /* CAUSA RAIZ do PDF em branco (item individual, telas altas): o
                 html2pdf.js clona o container num overlay próprio e o html2canvas
                 calculava sozinho o deslocamento do elemento em relação à janela,
                 errando quando o container real estava bem abaixo no documento —
                 o canvas saía com o tamanho certo, mas todo em branco. Passar
                 scrollX/scrollY/x/y = 0 elimina esse cálculo: nunca depende de
                 rolagem nem de posição na página. width/height/windowWidth/
                 windowHeight só são fixados DEPOIS de toContainer() (abaixo). */
              html2canvas: { scale: 2, backgroundColor: '#ffffff', useCORS: false, x: 0, y: 0, scrollX: 0, scrollY: 0 },
              jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
              pagebreak: { mode: ['css', 'avoid-all'] }
            });
            trabalho.from(container).toContainer().then(function () {
              /* CAUSA RAIZ do corte no fim do bloco: o plugin de pagebreak
                 (avoid-all/css) roda DENTRO de toContainer(), inserindo
                 espaçadores no CLONE interno, que pode ficar mais alto que o
                 original. Medir width/height só agora, sobre o clone já
                 processado, evita fixar uma janela de captura menor que o
                 conteúdo empurrado para a página seguinte. */
              var alturaClonada = this.prop.container.scrollHeight;
              var larguraClonada = this.prop.container.scrollWidth;
              this.opt.html2canvas.width = larguraClonada;
              this.opt.html2canvas.windowWidth = larguraClonada;
              this.opt.html2canvas.height = alturaClonada;
              this.opt.html2canvas.windowHeight = alturaClonada;
            }).toCanvas().then(function () {
              /* Continua o MESMO PDF: o jsPDF criado pelo primeiro bloco é
                 reaproveitado, e cada bloco seguinte começa em página nova. */
              if (compartilhado.pdf) { this.prop.pdf = compartilhado.pdf; this.prop.pdf.addPage(); }
            }).toPdf().then(function () {
              /* Página-sobra em branco: quando o conteúdo do bloco passa da
                 altura útil de uma página por uma fração de pixel (acontece
                 com blocos curtos que quase enchem a página), a biblioteca
                 fatia o canvas em n+1 páginas e a última é só a sobra, toda
                 branca. Se a fatia final não tem nenhum pixel de conteúdo,
                 essa página é descartada — nunca sobra página em branco no
                 fim de um bloco. Só atua com mais de uma página no bloco. */
              try {
                var cv = this.prop.canvas, doc = this.prop.pdf;
                var mm = doc.internal.pageSize;
                var pxPagina = Math.floor(cv.width * (mm.getHeight() - 14 - 16) / (mm.getWidth() - 12 - 12));
                var nPag = Math.ceil(cv.height / pxPagina);
                var restoY = (nPag - 1) * pxPagina;
                if (nPag > 1 && cv.height - restoY > 0) {
                  var px = cv.getContext('2d').getImageData(0, restoY, cv.width, cv.height - restoY).data, branco = true;
                  for (var k = 0; k < px.length; k += 4) { if (px[k] < 250 || px[k + 1] < 250 || px[k + 2] < 250) { branco = false; break; } }
                  if (branco) doc.deletePage(doc.internal.getNumberOfPages());
                }
              } catch (erroSobra) { /* só higiene: na dúvida, mantém a página */ }
              compartilhado.pdf = this.prop.pdf;
              compartilhado.ultimo = trabalho;
              if (container.parentNode) document.body.removeChild(container);
              container = null;
              fim(null);
            }, function (erroBloco) { fim(erroBloco); });
          } catch (erroGeral) { fim(erroGeral); }
        });
      }

      aguardarRenderizacaoCompleta(function () {
        var blocos;
        try { blocos = cfg.planejar(medidor); } catch (erroPlano) { concluir(erroPlano); return; }
        if (!blocos.length) { concluir(new Error('Nenhuma avaliação para exportar.')); return; }
        var i = 0;
        (function proximo(erro) {
          if (erro) { concluir(erro); return; }
          if (i >= blocos.length) {
            /* "Página X de N" no rodapé, só depois que o total é conhecido. */
            compartilhado.ultimo.get('pdf').then(function (pdf) {
              var total = pdf.internal.getNumberOfPages();
              var largura = pdf.internal.pageSize.getWidth();
              var altura = pdf.internal.pageSize.getHeight();
              for (var p = 1; p <= total; p++) {
                pdf.setPage(p);
                pdf.setFontSize(8);
                pdf.setTextColor(120);
                pdf.text('Página ' + p + ' de ' + total, largura / 2, altura - 6, { align: 'center' });
              }
            }).save().then(function () { concluir(null); }, function (erroSave) { concluir(erroSave); });
            return;
          }
          renderizarBloco(blocos[i], i, function (e) { i++; proximo(e); });
        })();
      });
    });
  }

  /* Motor de PDF em blocos, também usado pelas exportações da Adequação à
     Squad (avaliacao-squad.js) — um só lugar para o limite de altura do canvas. */
  window.faPdfEmBlocos = { gerar: gerarPdfPorBlocos, planejar: planejarBlocosDeAtomos, ALTURA_MAX: ALTURA_MAX_BLOCO_PDF };

  /* Ordem das colunas = a sequência da tela e do PDF: Recomendação do sistema →
     Classificação arquitetural (a camada; a especialização só derivada do
     questionário fica aqui, em coluna própria) → Curadoria arquitetural (Especialização,
     Papel estrutural, Natureza complementar) → Decisão final. */
  var EXCEL_COLS_RESUMO = [
    { largura: 26, rotulo: 'ID da avaliação' }, { largura: 30, rotulo: 'Nome do item' },
    { largura: 34, rotulo: 'Descrição' }, { largura: 22, rotulo: 'Público/cliente' },
    { largura: 30, rotulo: 'Necessidade' }, { largura: 24, rotulo: 'Responsável pela avaliação' },
    { largura: 18, rotulo: 'Data da avaliação' }, { largura: 12, rotulo: 'Status' }, { largura: 8, rotulo: 'Versão' },
    { largura: 18, rotulo: 'Versão do motor' },
    { largura: 22, rotulo: 'Recomendação do sistema' }, { largura: 28, rotulo: 'Classificação arquitetural' },
    { largura: 28, rotulo: 'Rótulo registrado na conclusão' },
    { largura: 40, rotulo: 'Relação arquitetural' }, { largura: 30, rotulo: 'Especialização identificada pelo questionário' },
    { largura: 26, rotulo: 'Especialização' }, { largura: 16, rotulo: 'Papel estrutural' },
    { largura: 30, rotulo: 'Natureza complementar' }, { largura: 30, rotulo: 'Situação da curadoria' },
    { largura: 20, rotulo: 'Decisão final' }, { largura: 34, rotulo: 'Forma da decisão' },
    { largura: 20, rotulo: 'Responsável pela decisão' }, { largura: 16, rotulo: 'Data da decisão' },
    { largura: 40, rotulo: 'Justificativa da decisão manual' }
  ];
  function linhaResumoExcel(it) {
    var camada = it.camadaSugerida;
    var concluido = it.status === 'concluido';
    return [
      it._key, it.nome || '', it.descricao || '', it.publico || '', it.necessidade || '',
      (it.responsavel && it.responsavel.name) || '', it.criadoEm ? new Date(it.criadoEm) : '',
      concluido ? 'Concluído' : 'Rascunho', it.versao || 1, concluido ? (it.motorVersion || '') : '',
      concluido ? rotuloResultado(it.resultadoAutomatico) : '',
      rotuloCamadaAtual(camada), (camada && camada.label) || '', (camada && camada.relacao) || '',
      especializacaoDerivada(it), curadoriaRegistrada(it).especializacao, curadoriaRegistrada(it).papelEstrutural, rotuloNaturezaDoItem(it),
      situacaoCuradoria(it),
      concluido ? rotuloDecisaoFinal(it) : '',
      concluido ? formaDaDecisao(it) : '',
      it.decisaoManual ? ((it.alteradoPor && it.alteradoPor.name) || '') : '',
      it.decisaoManual && it.alteradoEm ? new Date(it.alteradoEm) : '',
      it.decisaoManual ? (it.justificativaDecisao || '') : ''
    ];
  }
  var EXCEL_COLS_RESPOSTAS = [
    { largura: 26 }, { largura: 30 }, { largura: 8 }, { largura: 18 }, { largura: 10 },
    { largura: 46 }, { largura: 10 }, { largura: 46 }, { largura: 46 }, { largura: 30 }
  ];
  var EXCEL_HEAD_RESPOSTAS = ['ID da avaliação', 'Nome do item', 'Versão', 'Grupo da pergunta', 'Número da pergunta',
    'Pergunta', 'Resposta', 'Justificativa do usuário', 'Interpretação do sistema', 'Origem do texto da pergunta'];
  function linhasRespostasExcel(itens) {
    var linhas = [];
    itens.forEach(function (it) {
      if (it.status !== 'concluido' || !it.respostas) return;
      TODAS_PERGUNTAS.forEach(function (p, idx) {
        var r = it.respostas[p.id];
        if (!r || !r.valor) return;
        var conteudoHistorico = conteudoSnapshotOuAtual(p, r, it);
        linhas.push([
          it._key, it.nome || '', it.versao || 1,
          criterioPorId(p.id) ? 'Critério principal' : 'Teste de classificação',
          idx + 1, rotuloCompacto(p, conteudoHistorico), r.valor === 'sim' ? 'SIM' : 'NÃO',
          r.observacao || '', interpretacaoSistema(p, r, it), ROTULO_ORIGEM_TEXTO[conteudoHistorico.origem] || ''
        ]);
      });
    });
    return linhas;
  }
  var EXCEL_COLS_HISTORICO = [
    { largura: 26 }, { largura: 26 }, { largura: 8 }, { largura: 18 }, { largura: 24 },
    { largura: 30 }, { largura: 26 }, { largura: 16 }, { largura: 30 }, { largura: 30 },
    { largura: 22 }, { largura: 22 }, { largura: 28 }, { largura: 28 }, { largura: 22 }, { largura: 22 },
    { largura: 30 }, { largura: 30 }, { largura: 22 }, { largura: 18 }, { largura: 60 }, { largura: 40 }
  ];
  var EXCEL_HEAD_HISTORICO = ['ID do item', 'ID da avaliação', 'Versão', 'Data da avaliação', 'Responsável pela avaliação',
    'Especialização identificada pelo questionário', 'Especialização', 'Papel estrutural', 'Natureza complementar', 'Situação da curadoria',
    'Resultado anterior', 'Resultado atual', 'Classificação anterior', 'Classificação atual', 'Decisão anterior', 'Decisão atual',
    'Forma anterior', 'Forma atual', 'Responsável pela decisão', 'Data da decisão', 'Resumo da mudança', 'Justificativa de divergência'];
  /* Uma linha por versão de cada item incluído no export, mesmo quando essa
     versão já foi superada por uma reavaliação — é exatamente disso que o
     histórico trata. Nunca inventa uma versão anterior que não existe: se o
     item nunca foi reavaliado, aparece só a linha da própria versão 1. */
  function versoesDoHistorico(itensExportados, todosOsItens) {
    var idsIncluidos = {};
    itensExportados.forEach(function (it) { idsIncluidos[it.itemId || it._key] = true; });
    return todosOsItens.filter(function (it) { return !it.excluido && idsIncluidos[it.itemId || it._key]; })
      .sort(function (x, y) {
        var idA = x.itemId || x._key, idB = y.itemId || y._key;
        if (idA !== idB) return idA < idB ? -1 : 1;
        return (x.versao || 1) - (y.versao || 1);
      });
  }
  function linhasHistoricoExcel(itensExportados, todosOsItens) {
    return versoesDoHistorico(itensExportados, todosOsItens).map(function (it) {
      var ant = it.versaoAnteriorKey ? todosOsItens.filter(function (o) { return o._key === it.versaoAnteriorKey; })[0] : null;
      var a = ant ? retratoDaVersao(ant) : { resultado: '', classificacao: '', decisao: '', forma: '' };
      var b = retratoDaVersao(it);
      var cur = curadoriaRegistrada(it);
      return [
        it.itemId || it._key, it._key, it.versao || 1, it.criadoEm ? new Date(it.criadoEm) : '',
        (it.responsavel && it.responsavel.name) || '',
        especializacaoDerivada(it), cur.especializacao, cur.papelEstrutural, rotuloNaturezaDoItem(it), situacaoCuradoria(it),
        a.resultado, b.resultado, a.classificacao, b.classificacao, a.decisao, b.decisao, a.forma, b.forma,
        it.decisaoManual ? ((it.alteradoPor && it.alteradoPor.name) || '') : '',
        it.decisaoManual && it.alteradoEm ? new Date(it.alteradoEm) : '',
        descreverMudanca(ant, it),
        it.decisaoManual ? (it.justificativaDecisao || '') : ''
      ];
    });
  }
  var EXCEL_COLS_TRILHA = [
    { largura: 26 }, { largura: 26 }, { largura: 8 }, { largura: 18 }, { largura: 26 }, { largura: 24 },
    { largura: 36 }, { largura: 36 }, { largura: 26 }, { largura: 56 }, { largura: 50 }
  ];
  var EXCEL_HEAD_TRILHA = ['ID do item', 'ID da avaliação', 'Versão', 'Data e hora', 'Evento', 'Campo',
    'Valor anterior', 'Valor novo', 'Responsável pela alteração', 'Origem', 'Observação'];
  /* Uma linha por alteração registrada nas duas auditorias. Versão cuja leitura falhou ou demorou
     ganha UMA linha "Trilha indisponível" — nunca some como se não tivesse alteração. */
  function linhasTrilhaExcel(itensExportados, todosOsItens, trilhas) {
    var linhas = [];
    versoesDoHistorico(itensExportados, todosOsItens).forEach(function (it) {
      var id = it.itemId || it._key, v = it.versao || 1;
      var t = trilhas && trilhas[it._key];
      if (!t || !t.ok) {
        linhas.push([id, it._key, v, '', 'Trilha indisponível', '', '', '', '', '',
          'Não foi possível ler o registro de alterações desta versão. O histórico de versões segue completo.']);
        return;
      }
      t.linhas.forEach(function (e) {
        var d = descreverLinhaAuditoria(e, true);
        linhas.push([id, it._key, v, e.dataHora ? new Date(e.dataHora) : '', d.evento, d.campo, d.anterior, d.novo, d.quem, d.origem, d.detalhe]);
      });
    });
    return linhas;
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
  function gerarExcel(itensExportados, todosOsItens, nomeArquivo, cbFim, trilhas) {
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

        var wsTrilha = planilhaComColunas(XLSXLib, EXCEL_HEAD_TRILHA,
          linhasTrilhaExcel(itensExportados, todosOsItens, trilhas), EXCEL_COLS_TRILHA);
        XLSXLib.utils.book_append_sheet(wb, wsTrilha, 'Trilha');

        XLSXLib.writeFile(wb, nomeArquivo, { cellDates: true });
        cbFim(null);
      } catch (erroGeral) {
        cbFim(erroGeral);
      }
    });
  }

  /* ---------- Exportação dos questionários para Excel ----------
     Uma linha por pergunta, da versão PUBLICADA no momento (rascunho nunca
     entra: não vale para ninguém ainda). Só leitura — não existe importação:
     a edição continua sendo feita nesta tela, com versão e auditoria. A build
     "mini" do SheetJS não grava estilo de célula nem congela painéis; largura
     das colunas e autofiltro funcionam, e os textos saem inteiros (com
     acentos) em células de largura fixa. */
  var EXCEL_QUESTIONARIO_COLS = [
    { rotulo: 'Questionário', largura: 28 }, { rotulo: 'Versão publicada', largura: 10 }, { rotulo: 'Código', largura: 9 },
    { rotulo: 'Título', largura: 30 }, { rotulo: 'Pergunta', largura: 60 }, { rotulo: 'O que significa', largura: 60 },
    { rotulo: 'Quando responder SIM', largura: 50 }, { rotulo: 'Quando responder NÃO', largura: 50 },
    { rotulo: 'Exemplo', largura: 50 }, { rotulo: 'Palavras-exemplo', largura: 36 }, { rotulo: 'Orientação extra', largura: 50 },
    { rotulo: 'Interpretação quando SIM', largura: 56 }, { rotulo: 'Interpretação quando NÃO', largura: 56 },
    { rotulo: 'Observação administrativa', largura: 40 }
  ];
  var ABA_QUESTIONARIO = { CLASSIFICACAO_ARQUITETURAL: 'Classificação arquitetural', ADEQUACAO_SQUAD: 'Adequação à Squad' };
  function linhasQuestionarioExcel(codigo) {
    var fq = window.faQuestionarios;
    var sit = fq.situacao(codigo);
    return fq.perguntasDaVersao(codigo).map(function (q) {
      var ajuda = q.textoAjuda && typeof q.textoAjuda === 'object' ? q.textoAjuda : { significado: q.textoAjuda || '' };
      return [
        sit.nome, sit.versaoPublicada, q.codigoEstavel || '', q.titulo || '', q.texto || '',
        ajuda.significado || '', ajuda.quandoSim || '', ajuda.quandoNao || '',
        q.exemplo || '', Array.isArray(q.exemplos) ? q.exemplos.join(', ') : (q.exemplos || ''), q.ajudaExtra || '',
        q.justSim || '', q.justNao || '', q.observacaoAdministrativa || ''
      ];
    });
  }
  function nomeArquivoQuestionarios(codigos) {
    var fq = window.faQuestionarios;
    var base = codigos.length === 1
      ? sanitizarNomeArquivo(fq.situacao(codigos[0]).nome) + '_v' + fq.situacao(codigos[0]).versaoPublicada
      : 'Todos';
    return 'Questionarios_' + base + '_' + dataParaNomeArquivo() + '.xlsx';
  }
  function gerarExcelQuestionarios(codigos, cbFim) {
    carregarScript('forca-agil/xlsx.mini.min.js', function () { return !!window.XLSX; }, function (erroCarga) {
      if (erroCarga) { cbFim(erroCarga); return; }
      try {
        var XLSXLib = window.XLSX;
        var wb = XLSXLib.utils.book_new();
        codigos.forEach(function (codigo) {
          var ws = planilhaComColunas(XLSXLib, EXCEL_QUESTIONARIO_COLS.map(function (c) { return c.rotulo; }),
            linhasQuestionarioExcel(codigo), EXCEL_QUESTIONARIO_COLS);
          XLSXLib.utils.book_append_sheet(wb, ws, ABA_QUESTIONARIO[codigo] || codigo);
        });
        XLSXLib.writeFile(wb, nomeArquivoQuestionarios(codigos));
        cbFim(null);
      } catch (erroGeral) {
        cbFim(erroGeral);
      }
    });
  }

  /* DUAS INSTÂNCIAS do mesmo módulo, cada uma no seu contêiner e com o seu
     estado:
       modo 'operacional' — a área AVALIAÇÃO (#avaliacoesPainel): consultar,
         avaliar, reavaliar. Quem entra: admin geral ou quem está
         em fa-avaliacao-autorizados (qualquer dos dois tipos);
       modo 'admin' — o bloco de parametrização dentro do ADMIN
         (#adminAvaliacaoProduto): configuração de questionários, de motores,
         das naturezas e dos usuários autorizados. Admin geral chega aqui
         inteiro; "Avaliação + Arquitetura" só sem o cartão de usuários.
     Nenhuma configuração aparece na tela operacional e vice-versa. */
  window.faInitAvaliacaoProduto = function (opcoes) {
    var modo = opcoes && opcoes.modo === 'admin' ? 'admin' : 'operacional';
    var wrap = document.getElementById(modo === 'admin' ? 'adminAvaliacaoProduto' : 'avaliacoesPainel');
    if (!wrap || wrap._avpBound) return;
    wrap._avpBound = true;

    /* O que a pessoa pode fazer aqui. Só decide o que MOSTRAR — quem barra de
       verdade são as regras do banco (database.rules.json, provadas em
       teste-rules-avaliacoes.js). */
    function pode() { return !!(window.faAuth && window.faAuth.podeAvaliacao && window.faAuth.podeAvaliacao()); }
    /* Curadoria (especialização, papel estrutural, natureza complementar) e
       decisão final são da Arquitetura: "Avaliação" avalia; "Avaliação +
       Arquitetura" (e o admin geral) também cura e decide. O banco barra do
       mesmo jeito: em avaliacoes-produto, quem não é da Arquitetura não muda
       nenhum campo de curadoria/decisão (numa versão nova, só herda os da
       anterior) e, em curadoria-auditoria, só grava a linha de reavaliação e
       a do reprocessamento automático. */
    function podeDecidir() { return !!(window.faAuth && window.faAuth.podeArquitetura && window.faAuth.podeArquitetura()); }
    function telaInicial() { return modo === 'admin' ? 'admin-inicio' : 'lista'; }

    /* Navegação hierárquica do Admin: toda subtela abre com um "← Voltar para
       <tela pai>" explícito (nunca um rótulo genérico que pula níveis). Quem
       sai de uma tela de EDIÇÃO com alteração ainda não salva é avisado antes
       — c.sujo é ligado pelo próprio campo editado e desligado ao salvar. */
    var ROTULO_ADMIN = 'Arquitetura';
    function linkVoltar(id, destino) {
      return '<button type="button" class="avp-voltar-link" id="' + id + '">← Voltar para ' + esc(destino) + '</button>';
    }
    /* O mesmo "← Voltar", repetido no rodapé das telas longas (no celular o do topo fica longe). */
    function rodapeVoltar(id, destino) {
      return '<div class="avp-actions-footer avp-voltar-rodape"><button type="button" class="btn" id="' + id + '">← Voltar para ' + esc(destino) + '</button></div>';
    }
    function sairComAviso(c, acao) {
      if (c && c.sujo) {
        avpConfirm('Há alterações que ainda não foram salvas. Se sair agora, elas não serão salvas como rascunho nem publicadas.\n\nSair mesmo assim?', acao);
      } else {
        acao();
      }
    }

    /* O estado é uma FÁBRICA: a tela mora na página inteira e a pessoa pode sair e outra
       entrar sem recarregar. Trocar de sessão recria o estado do zero (resetarPorSessao),
       em vez de herdar a tela, os dados e os rascunhos de quem estava antes. */
    function novoEstado() { return {
      tela: telaInicial(), /* 'lista' | 'form-inicial' | 'checklist' | 'resultado' | 'nao-encontrada' | 'sem-permissao' | 'carregando'
                              (operacional) · 'admin-inicio' | 'config-*' | 'admin-usuarios' (admin) */
      itens: [],
      itensCarregados: false, /* true depois da primeira resposta (sucesso OU erro) do Firebase — evita
                                  mostrar "não encontrada" antes dos dados terem sequer chegado (ex.: F5) */
      erroCarga: null,        /* null | 'permissao' | 'geral' — motivo de itensCarregados nunca ter dados */
      filtro: { resultado: 'todos', status: 'todos', alterado: 'todos', alternativa: 'todos', motor: 'todos' },
      busca: '',              /* pesquisa por nome/descrição do item */
      filtrosAbertos: false,  /* painel "Filtros (n)" */
      lixeira: false,        /* alterna a lista entre ativos e excluídos — "excluído" é outra dimensão, não um status irmão de rascunho/concluído */
      atual: null,
      snapshotEdicao: null,   /* assinatura dos campos editáveis ao abrir o formulário/checklist — detecta alteração não salva */
      erroForm: null,
      camposInvalidos: [],
      pendenteId: null,
      salvando: null,       /* null | 'rascunho' | 'concluido' — trava os botões de salvar do checklist */
      salvandoDecisao: false,
      reprocessando: false, /* trava o botão REPROCESSAR COM MOTOR ATUAL enquanto grava */
      decisaoForm: null,
      salvandoNatureza: false, /* trava o botão SALVAR NATUREZA enquanto grava */
      naturezaForm: null,      /* { codigo, ultimoSalvo, erro } — iniciado sob demanda por renderNaturezaBloco */
      flashNatureza: null,     /* confirmação persistente mostrada após salvar a natureza complementar */
      salvandoEspecializacao: false, /* trava o botão SALVAR ESPECIALIZAÇÃO enquanto grava */
      especializacaoForm: null,
      curadoriaHist: null,  /* { chave, carregando, erro, itens } — histórico da curadoria e da decisão final desta avaliação */
      flashLista: null,     /* confirmação persistente mostrada na lista após salvar rascunho */
      flashResultado: null, /* confirmação persistente mostrada no resultado após concluir */
      flashDecisao: null,   /* confirmação persistente mostrada após salvar a decisão arquitetural */
      flashEspecializacao: null, /* confirmação persistente mostrada após salvar a especialização cadastrada */
      detAbertos: {},       /* <details> recolhíveis da ficha que a pessoa abriu (sobrevivem aos redesenhos) */
      reavAuditadas: {},    /* chaves de reavaliações cuja linha de auditoria "criada por reavaliação" já foi gravada */
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
      usuarios: null, /* null fora da tela "Usuários autorizados" (admin); ver abrirAdminUsuarios */
      configNaturezas: null, /* null fora da tela "⚙ Naturezas complementares"; ver abrirConfigNaturezas */
      configMotores: null /* null fora da tela "⚙ Configuração dos Motores"; ver abrirConfigMotores */
    }; }
    var state = novoEstado();

    function temCampoInvalido(campo) {
      return !!(state.camposInvalidos && state.camposInvalidos.indexOf(campo) !== -1);
    }

    /* Sair da lista para uma tela de detalhe guarda onde a página estava; voltar
       restaura (filtros e pesquisa já vivem em state.filtro e não se perdem). Ir
       para o detalhe começa no topo, não no meio da rolagem da lista. */
    function render() {
      if (modo === 'operacional') {
        if (state.telaRenderizada === 'lista' && state.tela !== 'lista') {
          state.rolagemLista = window.pageYOffset || 0;
          state.restaurarRolagem = false;
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        } else if (state.telaRenderizada && state.telaRenderizada !== 'lista' && state.tela === 'lista') {
          state.restaurarRolagem = true;
        }
        state.telaRenderizada = state.tela;
      }
      /* ADMIN › Arquitetura: entrar numa subtela (ou trocar de subtela) começa no topo dela — no
         celular a tela anterior podia estar rolada até o meio, e o "← Voltar" do topo ficava fora
         da tela; voltar ao início devolve a posição de onde a pessoa saiu. */
      if (modo === 'admin') {
        var assinatura = state.tela + '|' + subtelaAdmin();
        if (state.assinaturaAdmin && assinatura !== state.assinaturaAdmin) {
          if (state.assinaturaAdmin.split('|')[0] === 'admin-inicio') state.rolagemInicio = window.pageYOffset || 0;
          state.rolarPara = state.tela === 'admin-inicio' ? (state.rolagemInicio || 0) : 'topo';
        }
        state.assinaturaAdmin = assinatura;
      }
      /* Todo histórico começa recolhido: o que a pessoa abriu vale só enquanto ela continua na mesma
         tela e no mesmo item — outra tela, outra avaliação ou outra versão começam com tudo fechado. */
      var assinaturaDet = state.tela + '|' + (modo === 'admin' ? subtelaAdmin() : ((state.atual && state.atual._key) || ''));
      if (state.assinaturaDet !== assinaturaDet) { state.detAbertos = {}; state.assinaturaDet = assinaturaDet; }
      renderTela();
      if (modo === 'admin' && state.rolarPara != null) {
        var alvoRolagem = state.rolarPara;
        state.rolarPara = null;
        rolarAdmin(alvoRolagem);
      }
      if (modo === 'admin') sincronizarEnderecoAdmin();
      /* <details data-det> (históricos recolhidos etc.) lembram se estavam abertos entre um redesenho e outro */
      wrap.querySelectorAll('details[data-det]').forEach(function (det) {
        if (det._detLigado) return;
        det._detLigado = true;
        det.addEventListener('toggle', function () { state.detAbertos = state.detAbertos || {}; state.detAbertos[det.dataset.det] = det.open; });
      });
      if (modo === 'operacional' && state.restaurarRolagem && state.tela === 'lista') {
        state.restaurarRolagem = false;
        var y = state.rolagemLista || 0;
        window.requestAnimationFrame(function () { window.scrollTo({ top: y, left: 0, behavior: 'instant' }); });
      }
    }
    /* ===================== ENDEREÇO DO ADMIN › ARQUITETURA =====================
       Solução mínima, sem roteador novo: cada ÁREA da Arquitetura tem endereço próprio
       (#admin?arq=<área>). F5 reabre a mesma área; o Voltar/Avançar do navegador anda entre as
       áreas visitadas em vez de sair do ADMIN. As subtelas de dentro de uma área (histórico,
       versões, editar…) continuam com o "← Voltar" da própria tela. Sair por endereço de uma
       edição com alteração não salva pergunta antes (mesmo aviso do "← Voltar"). */
    var AREAS_ADMIN = {
      'admin-inicio': 'inicio', 'config-questionario': 'questionarios', 'config-motores': 'motores',
      'config-naturezas': 'naturezas', 'admin-usuarios': 'usuarios', 'admin-documentacao': 'documentacao'
    };
    var aplicandoEnderecoAdmin = false;
    function areaAtualAdmin() {
      var sq = document.getElementById('adminAvaliacaoSquad');
      if (sq && !sq.hidden) return 'motor-squad';
      return AREAS_ADMIN[state.tela] || 'inicio';
    }
    function areaDoEndereco() {
      var h = location.hash || '';
      if (h.split('?')[0] !== '#admin') return null;
      var m = /[?&]arq=([a-z-]+)/.exec(h);
      return m ? m[1] : null;
    }
    function painelArquiteturaAtivo() {
      var p = document.getElementById('adminPanelArquitetura');
      return !!p && !p.hidden && p.classList.contains('active');
    }
    function sincronizarEnderecoAdmin() {
      if (modo !== 'admin' || aplicandoEnderecoAdmin) return;
      if ((location.hash || '').split('?')[0] !== '#admin' || !painelArquiteturaAtivo()) return;
      /* Só com alguém logado e o ADMIN de fato na tela: redesenhar por troca de sessão (sair,
         trocar de pessoa) não pode mexer no histórico — um recuo atrasado devolvia o navegador
         ao #admin depois do redirecionamento e o router não reiniciava o ADMIN da pessoa nova. */
      var paginaAdmin = document.getElementById('page-admin');
      if (!sessaoAtual() || !paginaAdmin || paginaAdmin.hidden) return;
      var area = areaAtualAdmin();
      var desejado = '#admin?arq=' + area;
      if (location.hash === desejado) return;
      /* chegar à Arquitetura (sem área no endereço) não cria uma entrada a mais no histórico */
      if (!areaDoEndereco()) { history.replaceState({ arq: area, seqArq: seqArqAtual() }, '', desejado); politicaRolagemAdmin(); return; }
      /* "← Voltar" da tela para a área de onde a pessoa veio = o Voltar do navegador (não empilha
         uma entrada nova; o Avançar continua funcionando). */
      var anterior = history.state && history.state.anteriorArq;
      if (anterior === area) {
        /* o recuo do histórico faz o navegador restaurar a rolagem DELE — a posição certa é a
           desta tela (ver rolarAdmin), reaplicada depois que o recuo termina */
        var yVolta = state.tela === 'admin-inicio' ? (state.rolagemInicio || 0) : null;
        window.addEventListener('popstate', function aposRecuo() {
          window.removeEventListener('popstate', aposRecuo);
          if (yVolta != null) rolarAdmin(yVolta);
        });
        history.back();
        return;
      }
      history.pushState({ arq: area, anteriorArq: areaDoEndereco() }, '', desejado);
      politicaRolagemAdmin();
    }
    /* Quem posiciona a rolagem nas áreas da Arquitetura (#admin?arq=…) é esta tela (rolarAdmin, e o
       router sobe ao topo a cada troca de endereço) — não o navegador. A restauração automática do
       navegador é guardada POR ENTRADA do histórico: vale o modo da entrada para onde se volta, não
       o da que se deixa. E, com a página recarregada ainda carregando (F5 em rede lenta), ela só é
       aplicada no fim do carregamento: rolava a tela de volta para a posição antiga por cima da
       escolhida aqui — e por cima de onde a pessoa já tinha rolado. Por isso toda entrada ?arq=
       fica 'manual'; ao sair para outro endereço, a entrada nova volta a 'auto' (o modo é copiado
       para a entrada seguinte, e as outras telas contam com a restauração do navegador). */
    function politicaRolagemAdmin() {
      if (modo !== 'admin' || !('scrollRestoration' in history)) return;
      var desejada = areaDoEndereco() ? 'manual' : 'auto';
      if (history.scrollRestoration !== desejada) history.scrollRestoration = desejada;
    }
    function seqArqAtual() { return history.state && history.state.seqArq || 0; }
    function edicaoSujaAdmin() {
      return !!((state.config && state.config.sujo) || (state.configMotores && state.configMotores.sujo) ||
        (state.configNaturezas && state.configNaturezas.sujo) || (state.documentacao && state.documentacao.sujo) ||
        (window.faAvaliacaoSquadAdmin && window.faAvaliacaoSquadAdmin.temAlteracaoNaoSalva && window.faAvaliacaoSquadAdmin.temAlteracaoNaoSalva()));
    }
    function abrirAreaAdmin(area) {
      if (window.faAdminAbrirAba) window.faAdminAbrirAba('adminPanelArquitetura');
      if (window.faAvaliacaoSquadAdmin && area !== 'motor-squad') window.faAvaliacaoSquadAdmin.fechar();
      state.config = null; state.configMotores = null; state.configNaturezas = null; state.documentacao = null;
      if (area === 'questionarios') abrirConfigQuestionarios();
      else if (area === 'motores') abrirConfigMotores();
      else if (area === 'naturezas') abrirConfigNaturezas();
      else if (area === 'usuarios' && souAdminGeral()) abrirAdminUsuarios();
      else if (area === 'documentacao') abrirDocumentacao();
      else if (area === 'motor-squad' && window.faAvaliacaoSquadAdmin) { state.tela = 'admin-inicio'; render(); abrirMotorSquadDoInicio(); }
      else { state.tela = 'admin-inicio'; render(); }
    }
    /* Voltar/Avançar do navegador, link colado ou F5 com #admin?arq=<área>. */
    function aplicarEnderecoAdmin() {
      politicaRolagemAdmin();
      var area = areaDoEndereco();
      if (!area || area === areaAtualAdmin()) return;
      if (edicaoSujaAdmin()) {
        var atual = areaAtualAdmin();
        history.pushState({ arq: atual }, '', '#admin?arq=' + atual); /* desfaz até a pessoa decidir */
        politicaRolagemAdmin();
        avpConfirm('Há alterações que ainda não foram salvas. Se sair agora, elas não serão salvas como rascunho nem publicadas.\n\nSair mesmo assim?', function () {
          abrirAreaAdmin(area);
        });
        return;
      }
      aplicandoEnderecoAdmin = true;
      try { abrirAreaAdmin(area); } finally { aplicandoEnderecoAdmin = false; }
    }
    function abrirMotorSquadDoInicio() {
      state.rolagemInicio = window.pageYOffset || 0;
      window.faAvaliacaoSquadAdmin.abrirMotorConfig({ rotulo: 'Arquitetura', voltar: function () {
        state.tela = telaInicial(); render(); rolarAdmin(state.rolagemInicio || 0);
      } });
      sincronizarEnderecoAdmin();
    }
    function subtelaAdmin() {
      if (state.tela === 'config-questionario' && state.config) return state.config.sub + (state.config.codigo ? ':' + state.config.codigo : '');
      if (state.tela === 'config-motores' && state.configMotores) return state.configMotores.sub;
      return '';
    }
    /* 'topo' = começo da área da Arquitetura (com o "← Voltar" à vista, sem esconder sob o
       cabeçalho fixo); número = posição exata (volta ao início). Só sobe — nunca desce a página
       para mostrar o topo de uma tela que já está à vista. */
    function rolarAdmin(alvo) {
      window.requestAnimationFrame(function () {
        if (alvo === 'topo') {
          var topo = Math.max(0, wrap.getBoundingClientRect().top + (window.pageYOffset || 0) - 90);
          if ((window.pageYOffset || 0) > topo) window.scrollTo({ top: topo, left: 0, behavior: 'instant' });
        } else {
          window.scrollTo({ top: alvo, left: 0, behavior: 'instant' });
        }
      });
    }
    function renderTela() {
      /* Enquanto o perfil da pessoa não voltou do banco não dá para decidir o
         que mostrar (e "ainda não sei" nunca vira "sem acesso"). */
      if (modo === 'operacional' && window.faAuth.isAvaliacaoReady && !window.faAuth.isAvaliacaoReady()) {
        wrap.innerHTML = '<p class="loading-msg">Carregando…</p>';
        return;
      }
      /* Mesma regra no bloco do Admin: o cartão "Usuários autorizados" depende de a sessão e da
         lista de admins já terem chegado. Sem elas a decisão é "ainda não sei" — nunca vira "não"
         (era isto que escondia o cartão do admin geral até um F5 forçado). Quando chegam,
         aoMudarSessao redesenha. */
      if (modo === 'admin' && acessoAdminIndefinido()) {
        wrap.innerHTML = '<p class="loading-msg">Carregando…</p>';
        return;
      }
      /* "Usuários autorizados" é só do admin geral. Quem não é (ou deixou de ser) não vê o cartão
         nem uma tela de aviso: volta ao início da Arquitetura. */
      if (modo === 'admin' && state.tela === 'admin-usuarios' && (!souAdminGeral() || !state.usuarios)) {
        state.tela = 'admin-inicio';
        state.usuarios = null;
      }
      if (modo === 'operacional' && !pode()) { renderSemAcessoArea(); return; }
      if (state.tela === 'admin-inicio') renderAdminInicio();
      else if (state.tela === 'admin-usuarios') renderAdminUsuarios();
      else if (state.tela === 'admin-documentacao') renderDocumentacao();
      else if (state.tela === 'lista') renderLista();
      else if (state.tela === 'form-inicial') renderFormInicial();
      else if (state.tela === 'checklist') renderChecklist();
      else if (state.tela === 'resultado') renderResultado();
      else if (state.tela === 'nao-encontrada') renderNaoEncontrada();
      else if (state.tela === 'sem-permissao') renderSemPermissao();
      else if (state.tela === 'carregando') renderCarregandoAvaliacao();
      else if (state.tela === 'config-questionario') renderConfigQuestionarios();
      else if (state.tela === 'config-motores') renderConfigMotores();
      else if (state.tela === 'config-naturezas') renderConfigNaturezas();
    }

    /* Tela de carregamento de #avaliacoes?avp=<chave> (F5, link direto, nova aba)
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
        '<button class="btn" id="avpVoltarCarregandoTravado">← Voltar para avaliações</button>' +
        '</div></div>';
      document.getElementById('avpRecarregarTravado').addEventListener('click', function () { location.reload(); });
      document.getElementById('avpVoltarCarregandoTravado').addEventListener('click', function () {
        state.carregandoTravado = false;
        irPara(hashLista(), { replace: true });
      });
    }

    /* ===================== ROTA PERSISTENTE (#avaliacoes?avp=<key>) =====================
       A tela de resultado é um registro consultável, não uma página de
       transição — precisa sobreviver a F5, funcionar com link copiado/aberto
       em outra aba, e reagir ao botão voltar/avançar do navegador. O router
       central (router.js) só entende páginas fixas (#avaliacoes, #home…) e ignora
       tudo depois de "?" ao decidir qual página mostrar — por isso o `?avp=`
       vive dentro do MESMO hash de #avaliacoes: o router mostra a página
       normalmente, e este módulo lê o parâmetro para decidir se mostra a
       lista ou uma avaliação específica dela. Links antigos (#admin?avp=…,
       de quando isto morava no Admin) são redirecionados pelo router.
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

    /* ===================== NAVEGAÇÃO: A URL É A FONTE DE VERDADE =====================
       A tela exibida SEMPRE decorre da URL (sincronizarComHash); o histórico do navegador guarda só o CONTEXTO
       DE ORIGEM (history.state) para o "Voltar" saber para onde ir. Endereços:
         #avaliacoes                      lista
         #avaliacoes?avp=<chave>          avaliação (vigente ou versão anterior — a chave identifica a versão)
         #avaliacoes?nova=1               nova avaliação (formulário inicial / checklist)
         #avaliacoes?editar=<chave>       continuar um rascunho
         #avaliacoes?reavaliar=<chave>    reavaliação da versão <chave>
       Nova/editar/reavaliar não persistem a edição: o F5 recomeça do estado salvo (sem autosave) e o navegador
       avisa antes de recarregar se houver alteração não salva (beforeunload).
       Cada entrada criada por esta tela carrega { avp:1, seq, origem } — origem = { t:'lista' } ou
       { t:'avaliacao', key, v } (de onde a pessoa veio). "Voltar" usa history.back() quando a entrada tem origem
       (nunca empilha entrada nova: sem laço) e, sem contexto (link direto, F5 sem marcador), vai a um destino
       seguro e determinístico, SUBSTITUINDO a entrada. */
    var navSeq = 0;
    var urlAplicada = null;        /* a URL que a tela desenhada representa */
    var navRevertendo = false;     /* true enquanto desfazemos uma saída interrompida (Voltar do navegador com alteração) */
    var navSeqDaEdicao = null;     /* seq da entrada do histórico em que a edição está aberta */
    function proximoSeq() { navSeq = Math.max(navSeq + 1, Date.now()); return navSeq; }
    function estadoDaEntrada() { var e = history.state; return (e && e.avp === 1) ? e : null; }
    function marcarEntradaAtual() {
      if (!estadoDaEntrada()) history.replaceState({ avp: 1, seq: proximoSeq(), origem: null }, '', location.href);
    }
    function hashLista() { return '#avaliacoes'; }
    function hashAvaliacao(key) { return '#avaliacoes?avp=' + encodeURIComponent(key); }
    function hashNova() { return '#avaliacoes?nova=1'; }
    function hashEditar(key) { return '#avaliacoes?editar=' + encodeURIComponent(key); }
    function hashReavaliar(key) { return '#avaliacoes?reavaliar=' + encodeURIComponent(key); }
    function destinoDaUrl() {
      var h = location.hash || '';
      if (h.split('?')[0] !== '#avaliacoes') return { t: 'fora' };
      var p = paramsDaHash();
      if (p.sq) return { t: 'squad', sq: p.sq }; /* Adequação à Squad: o endereço é dela (avaliacao-squad.js) */
      if (p.avp) return { t: 'avaliacao', key: p.avp };
      if (p.reavaliar) return { t: 'reavaliar', key: p.reavaliar };
      if (p.editar) return { t: 'editar', key: p.editar };
      if (p.nova) return { t: 'nova' };
      return { t: 'lista' };
    }
    /* O que a tela de AGORA é, para virar a origem da próxima entrada. */
    function origemAtual() {
      if (state.tela === 'lista') return { t: 'lista' };
      if (state.tela === 'resultado' && state.atual && state.atual._key) return { t: 'avaliacao', key: state.atual._key, v: state.atual.versao || 1 };
      return null;
    }
    /* Navega para uma URL: empilha uma entrada (padrão) ou SUBSTITUI a atual ({replace:true}) e redesenha a tela
       a partir da URL. opts.origem fixa a origem da entrada (capturada ANTES de a tela mudar). */
    function irPara(hash, opts) {
      if (modo !== 'operacional') return;
      opts = opts || {};
      var atualEntrada = estadoDaEntrada();
      if (opts.replace) {
        history.replaceState({ avp: 1, seq: atualEntrada ? atualEntrada.seq : proximoSeq(),
          origem: opts.origem !== undefined ? opts.origem : (atualEntrada ? atualEntrada.origem : null) }, '', hash);
      } else if (location.hash !== hash) {
        history.pushState({ avp: 1, seq: proximoSeq(), origem: opts.origem !== undefined ? opts.origem : origemAtual() }, '', hash);
      }
      sincronizarComHash();
    }
    /* Para onde o "Voltar" desta tela vai, e como. Com origem registrada nesta entrada, é o histórico real;
       sem ela, um destino seguro (reavaliação → a avaliação de origem; o resto → a lista). */
    function destinoDeVoltar() {
      var e = estadoDaEntrada();
      var o = e && e.origem;
      if (o && o.t === 'lista') return { historico: true, hash: hashLista(), rotulo: 'avaliações' };
      if (o && o.t === 'avaliacao') return { historico: true, hash: hashAvaliacao(o.key), rotulo: 'a avaliação (v' + (o.v || 1) + ')' };
      var d = destinoDaUrl();
      if (d.t === 'reavaliar') {
        var it = buscarItem(d.key);
        return { historico: false, hash: hashAvaliacao(d.key), rotulo: 'a avaliação (v' + ((it && it.versao) || 1) + ')' };
      }
      return { historico: false, hash: hashLista(), rotulo: 'avaliações' };
    }
    function rotuloVoltar() { return '← Voltar para ' + destinoDeVoltar().rotulo; }
    function voltar() {
      var d = destinoDeVoltar();
      if (d.historico) history.back();
      else irPara(d.hash, { replace: true });
    }
    /* Abrir uma avaliação: se ela é justamente a ORIGEM desta entrada ("Abrir a versão vigente" de uma versão anterior
       aberta a partir dela), volta no histórico em vez de empilhar — a pilha não cresce a cada vai-e-volta. */
    function abrirAvaliacaoNaUrl(key) {
      var e = estadoDaEntrada();
      if (e && e.origem && e.origem.t === 'avaliacao' && e.origem.key === key && history.length > 1) { history.back(); return; }
      irPara(hashAvaliacao(key));
    }

    /* ---- alterações não salvas ---- */
    function assinaturaEdicao(a) {
      if (!a) return '';
      var r = {};
      Object.keys(a.respostas || {}).forEach(function (k) { var x = a.respostas[k] || {}; r[k] = [x.valor || '', x.observacao || '']; });
      return JSON.stringify([a.nome || '', a.descricao || '', a.publico || '', a.necessidade || '', a.observacoesGerais || '', r]);
    }
    function marcarPontoDeEdicao() { state.snapshotEdicao = assinaturaEdicao(state.atual); navSeqDaEdicao = (estadoDaEntrada() || {}).seq || null; }
    function emEdicao() { return modo === 'operacional' && (state.tela === 'form-inicial' || state.tela === 'checklist'); }
    function edicaoSuja() {
      return emEdicao() && state.snapshotEdicao != null && state.snapshotEdicao !== assinaturaEdicao(state.atual);
    }
    function perguntarDescarte(aoDescartar, aoContinuar) {
      if (document.querySelector('.avp-modal-descarte')) return;
      avpConfirm('Há alterações que ainda não foram salvas. Se sair agora, elas serão perdidas.', aoDescartar,
        { sim: 'Descartar alterações', nao: 'Continuar editando', aoNao: aoContinuar, classe: 'avp-modal-descarte' });
    }
    /* Botões de sair de uma edição (Voltar, CANCELAR): sem alteração sai direto; com alteração pergunta. */
    function sairDaEdicao() {
      if (state.salvando) return; /* não deixa sair no meio de um salvamento em andamento */
      if (edicaoSuja()) perguntarDescarte(function () { state.snapshotEdicao = null; voltar(); });
      else { state.snapshotEdicao = null; voltar(); }
    }
    /* Depois de SALVAR RASCUNHO: volta à lista sem criar entrada nova (se veio da lista, usa o histórico). */
    function irParaListaDepoisDeSalvar() {
      state.snapshotEdicao = null;
      var e = estadoDaEntrada();
      if (e && e.origem && e.origem.t === 'lista') history.back();
      else irPara(hashLista(), { replace: true });
    }
    /* Voltar/Avançar do navegador, link colado, F5. Saída de uma edição com alteração é INTERROMPIDA: desfaz a
       navegação (mantém a URL da edição) e pergunta. Eventos repetidos (popstate + hashchange) são inofensivos. */
    function aoTrocarHistorico() {
      if (modo !== 'operacional') return;
      var h = location.hash || '';
      if (navRevertendo) { if (h === urlAplicada) navRevertendo = false; return; }
      if (h === urlAplicada) return;
      if (edicaoSuja()) {
        var e = estadoDaEntrada();
        var delta = (e && navSeqDaEdicao != null) ? (e.seq - navSeqDaEdicao) : null;
        var origem = (e && e.origem) || null;
        navRevertendo = true;
        setTimeout(function () { navRevertendo = false; }, 1500);
        if (delta) history.go(delta < 0 ? 1 : -1);
        else history.pushState({ avp: 1, seq: proximoSeq(), origem: origem }, '', urlAplicada);
        perguntarDescarte(function () {
          state.snapshotEdicao = null;
          if (delta) history.go(delta < 0 ? -1 : 1); else location.hash = h;
        });
        return;
      }
      sincronizarComHash();
    }
    function novaAvaliacaoVazia() {
      return { nome: '', descricao: '', publico: '', necessidade: '', observacoesGerais: '', respostas: {},
        questionnaireContentVersion: window.faQuestionarios.versaoAtual(CODIGO_QUESTIONARIO) };
    }
    function construirNova() {
      state.atual = novaAvaliacaoVazia();
      state.reavaliacaoBase = null;
      state.erroForm = null;
      state.camposInvalidos = [];
      state.flashLista = null;
      state.tela = 'form-inicial';
      marcarPontoDeEdicao();
      render();
    }
    function construirVisualizacao(it) {
      state.atual = clonarItem(it);
      state.decisaoForm = decisaoFormInicial(it);
      state.naturezaForm = null;
      state.flashNatureza = null;
      state.especializacaoForm = especializacaoFormInicial(it);
      state.curadoriaHist = null;
      state.reavaliacaoBase = null;
      state.snapshotEdicao = null;
      state.flashLista = null;
      state.flashResultado = null;
      state.flashDecisao = null;
      state.flashEspecializacao = null;
      state.flashExportacao = null;
      state.tela = 'resultado';
      render();
    }
    /* Deriva a tela da URL (carga inicial, F5, link, Voltar/Avançar, ou depois de irPara). Idempotente: se a tela
       já é a da URL, não mexe — nunca apaga uma edição em andamento por causa de um evento repetido. */
    function sincronizarComHash() {
      if (modo !== 'operacional') return; /* o bloco do Admin não tem rota própria */
      var d = destinoDaUrl();
      if (d.t === 'fora') return;         /* outra página do site: esta tela não mexe */
      marcarEntradaAtual();
      function fim() { urlAplicada = location.hash || ''; }
      if (d.t === 'lista') {
        /* 'carregando' também sai daqui: ele só existe enquanto a URL pede uma avaliação; se a URL
           deixou de pedir (a pessoa saiu e o endereço voltou ao início), esperar não leva a nada. */
        if (state.tela !== 'lista' && state.tela.indexOf('config') !== 0 && state.tela.indexOf('admin') !== 0) {
          state.atual = null;
          state.reavaliacaoBase = null;
          state.snapshotEdicao = null;
          state.carregandoTravado = false;
          state.tela = 'lista';
          render();
        }
        fim();
        return;
      }
      if (d.t === 'squad') {
        /* por baixo fica a lista (é para onde o "← Voltar para Avaliações" leva) */
        if (state.tela !== 'lista' && state.tela.indexOf('config') !== 0 && state.tela.indexOf('admin') !== 0) {
          state.atual = null; state.reavaliacaoBase = null; state.snapshotEdicao = null; state.carregandoTravado = false;
          state.tela = 'lista'; render();
        }
        if (!window.faAvaliacaoSquad && window.faInitAvaliacaoSquad) window.faInitAvaliacaoSquad({ modo: 'operacional' });
        if (window.faAvaliacaoSquad) window.faAvaliacaoSquad.aplicarEndereco(d.sq);
        fim();
        return;
      }
      if (d.t === 'nova') {
        var jaNaNova = state.tela === 'form-inicial' || (state.tela === 'checklist' && state.atual && !state.atual._key && !state.reavaliacaoBase);
        if (!jaNaNova) construirNova();
        fim();
        return;
      }
      var key = d.key;
      if (state.tela === 'resultado' && d.t === 'avaliacao' && state.atual && state.atual._key === key) { fim(); return; } /* já é esta mesma avaliação */
      if (state.tela === 'checklist' && d.t === 'editar' && state.atual && state.atual._key === key && !state.reavaliacaoBase) { fim(); return; }
      if (state.tela === 'checklist' && d.t === 'reavaliar' && state.reavaliacaoBase && state.reavaliacaoBase._key === key) { fim(); return; }
      if (!state.itensCarregados) return; /* os dados ainda não chegaram — a própria carga chama isto de novo ao terminar */
      if (state.erroCarga === 'permissao') { state.tela = 'sem-permissao'; render(); fim(); return; }
      if (state.erroCarga === 'geral') { state.tela = 'nao-encontrada'; state.atual = null; render(); fim(); return; }
      var it = buscarItem(key);
      if (!it || it.excluido) { state.tela = 'nao-encontrada'; state.atual = null; state.snapshotEdicao = null; render(); fim(); return; }
      if (d.t === 'editar') {
        /* só rascunho se edita; uma avaliação concluída abre como avaliação */
        if (it.status !== 'rascunho' || !pode()) { irPara(hashAvaliacao(key), { replace: true }); return; }
        construirEdicao(it);
        fim();
        return;
      }
      if (d.t === 'reavaliar') {
        /* só a versão vigente de uma avaliação concluída se reavalia */
        if (it.status !== 'concluido' || temVersaoMaisNova(key) || !pode()) { irPara(hashAvaliacao(key), { replace: true }); return; }
        construirReavaliacao(it);
        fim();
        return;
      }
      construirVisualizacao(it);
      fim();
    }
    if (modo === 'operacional') {
      window.addEventListener('popstate', aoTrocarHistorico);
      window.addEventListener('hashchange', aoTrocarHistorico);
      /* F5/fechar a aba com alteração não salva: o navegador avisa (nunca sem alteração). */
      window.addEventListener('beforeunload', function (ev) {
        if (!edicaoSuja()) return;
        ev.preventDefault();
        ev.returnValue = '';
        return '';
      });
    }

    /* O catálogo de naturezas complementares chega (ou muda) depois do
       primeiro render: quem está olhando um resultado precisa ver o seletor
       sair de "Carregando opções…". */
    window.faNaturezas.aoMudar(function () { if (state.tela === 'resultado' || state.tela === 'config-naturezas') render(); });

    function renderNaoEncontrada() {
      var msg = state.erroCarga === 'geral'
        ? 'Não foi possível carregar esta avaliação. Recarregue a página.'
        : 'Avaliação não encontrada.';
      wrap.innerHTML =
        '<div class="avp-form-card">' +
        '<p class="admin-empty">' + esc(msg) + '</p>' +
        '<div class="avp-actions-footer"><button class="btn btn--primary" id="avpVoltarNaoEncontrada">← Voltar para avaliações</button></div>' +
        '</div>';
      document.getElementById('avpVoltarNaoEncontrada').addEventListener('click', function () {
        irPara(hashLista(), { replace: true });
      });
    }
    function renderSemPermissao() {
      wrap.innerHTML =
        '<div class="avp-form-card">' +
        '<p class="admin-empty">Você não possui permissão para visualizar esta avaliação.</p>' +
        '<div class="avp-actions-footer"><button class="btn btn--primary" id="avpVoltarSemPermissao">← Voltar para avaliações</button></div>' +
        '</div>';
      document.getElementById('avpVoltarSemPermissao').addEventListener('click', function () {
        irPara(hashLista(), { replace: true });
      });
    }

    /* ===================== LISTA ===================== */
    /* Quantos filtros do painel estão fora de "todos" (a pesquisa é à parte). */
    function numFiltrosAtivos() {
      var f = state.filtro;
      return ['resultado', 'status', 'alterado', 'alternativa', 'motor'].filter(function (k) { return f[k] !== 'todos'; }).length;
    }
    function filtrosAtivos() { return numFiltrosAtivos() > 0; }
    function buscaAtiva() { return !!(state.busca || '').trim(); }
    /* Pesquisa sem acento e sem diferenciar maiúsculas, no nome e na descrição do item. */
    function passaBusca(it) {
      var q = semAcento(state.busca).trim();
      if (!q) return true;
      return semAcento(it.nome).indexOf(q) !== -1 || semAcento(it.descricao).indexOf(q) !== -1;
    }
    function itemPassaFiltro(it) {
      if (temVersaoMaisNova(it._key)) return false;
      if (state.lixeira) return !!it.excluido && passaBusca(it);
      if (it.excluido) return false;
      if (!passaBusca(it)) return false;
      if (state.filtro.resultado !== 'todos') {
        var decisao = decisaoFinalDe(it);
        if (decisao !== state.filtro.resultado) return false;
      }
      if (state.filtro.status !== 'todos' && it.status !== state.filtro.status) return false;
      if (state.filtro.alterado === 'sim' && !it.decisaoManual) return false;
      if (state.filtro.alternativa !== 'todos') {
        /* pelo CÓDIGO — o nome muda na Taxonomia, o código não */
        if (camadaDoItem(it) !== state.filtro.alternativa) return false;
      }
      /* Motor só diz respeito a avaliações concluídas (rascunho não tem
         recomendação automática calculada) — "desatualizado" nunca inclui
         rascunho, e "atual" o inclui trivialmente (nada pra desatualizar),
         o que é aceitável: o filtro existe pra auditar concluídas. */
      var situacao = situacaoMotor(it);
      if (state.filtro.motor === 'desatualizado' && situacao !== 'desatualizado') return false;
      if (state.filtro.motor === 'equivalente' && situacao !== 'equivalente') return false;
      if (state.filtro.motor === 'atual' && (situacao === 'desatualizado' || situacao === 'equivalente' || situacao === 'verificando')) return false;
      return true;
    }

    /* A página inteira rola (a tabela NÃO tem rolagem própria). O cabeçalho das
       colunas fica fixo logo abaixo do menu do site, que é fixo e tem altura
       variável (celular, menu aberto…) — por isso a medida vem do próprio menu
       e vai para o CSS como --avp-sticky-top. */
    function ajustarTopoCabecalho() {
      var painel = document.getElementById('avaliacoesPainel');
      if (!painel) return;
      var nav = document.querySelector('.nav');
      var h = nav ? nav.offsetHeight : 0;
      /* O menu pode estar escondido (altura 0) quando a lista renderiza — por
         exemplo enquanto a página ainda espera o login. Nesse caso NÃO grava 0
         (o cabeçalho ficaria por baixo do menu quando ele aparecer): sem a
         variável vale o padrão do CSS, e o observador abaixo atualiza assim que
         o menu ganhar altura. */
      if (h > 0) painel.style.setProperty('--avp-sticky-top', h + 'px');
      else painel.style.removeProperty('--avp-sticky-top');
    }
    window.addEventListener('resize', ajustarTopoCabecalho);
    var navParaObservar = document.querySelector('.nav');
    if (navParaObservar && typeof ResizeObserver === 'function') new ResizeObserver(ajustarTopoCabecalho).observe(navParaObservar);

    function renderLista() {
      var filtrados = state.itens.filter(itemPassaFiltro);
      var html = '';
      if (state.flashLista) {
        html += '<div class="avp-flash-success" id="avpFlashLista">' + esc(state.flashLista) +
          ' <button type="button" class="avp-flash-close" id="avpFlashListaClose" aria-label="Fechar">×</button></div>';
      }
      html += '<div class="avp-intro">';
      /* Conceito-base: nome e definição vigente do conceito produto-principal da Taxonomia Arquitetural
         (fonte única — nenhum texto conceitual aqui; sem definição, "Carregando…" ou "indisponível"). */
      html += '<p id="avpConceitoBase"><strong>Conceito-base — ' + htmlNomeCamada({ id: 'produto-principal' }) + ':</strong> ' +
        (window.faClassificacoes ? window.faClassificacoes.definicaoHtml('produto-principal', 'avpConceitoBaseDef', { comEstado: true, tag: 'span' }) : '') + '</p>' +
        htmlAvisoContingencia(['produto-principal'], 'avpConceitoBaseContingencia');
      html += '<p class="avp-intro-principio">Nem tudo que gera valor precisa ser ' + htmlNomeCamada({ id: 'produto-principal' }) + '. Um componente, processo, capacidade, canal ou documento pode ser essencial ' +
        'para a entrega sem constituir uma solução independente para o cliente.</p>';
      html += '</div>';

      var ativos = state.itens.filter(function (it) { return !it.excluido && !temVersaoMaisNova(it._key); });
      var excluidos = state.itens.filter(function (it) { return !!it.excluido; });
      var chavesSelecionadas = Object.keys(state.selecionados).filter(function (k) { return state.selecionados[k]; });

      html += '<div class="avp-actions-bar">';
      var baseContagem = state.lixeira ? excluidos : ativos;
      var recortado = filtrosAtivos() || buscaAtiva();
      html += '<span class="avp-total" id="avpContador">' + (recortado ? filtrados.length + ' de ' + baseContagem.length : baseContagem.length) +
        ' avaliaç' + (baseContagem.length === 1 ? 'ão' : 'ões') + (state.lixeira ? ' na lixeira' : '') + '</span>';
      if (!state.lixeira && pode()) html += '<button class="btn btn--primary" id="avpNovoBtn">+ Avaliar novo item</button>';
      /* Adequação à Squad: outra avaliação, independente desta (S1–S8), feita aqui mesmo na área Avaliação. */
      if (!state.lixeira && pode() && modo === 'operacional') html += '<button class="btn btn--sm" id="avpSquadBtn">Adequação à Squad</button>';
      if (!state.lixeira && pode()) {
        html += '<div class="avp-exportar-wrap">';
        html += '<button class="btn btn--sm" id="avpExportarBtn"' + (state.exportando ? ' disabled' : '') + '>' +
          (state.exportando ? 'Gerando arquivo…' : 'Exportar ▾') + '</button>';
        if (state.menuExportarAberto) {
          html += '<div class="avp-exportar-menu" id="avpExportarMenu">';
          /* "Resultados filtrados" = o que a tela mostra agora (pesquisa e filtros aplicados). */
          var concluidasFiltradas = filtrados.filter(function (it) { return it.status === 'concluido'; });
          var concluidasSelecionadas = chavesSelecionadas.map(function (k) { return buscarItem(k); }).filter(function (it) { return it && it.status === 'concluido'; });
          html += '<p class="avp-exportar-escopo">Consulta atual: <strong>' + filtrados.length + '</strong> avaliaç' + (filtrados.length === 1 ? 'ão' : 'ões') +
            (filtrosAtivos() ? ' (com os filtros aplicados)' : ' (sem filtros)') + '</p>';
          html += '<button type="button" class="btn" id="avpExportarExcelFiltrados">📊 Excel — resultados filtrados (' + filtrados.length + ')</button>';
          html += '<button type="button" class="btn" id="avpExportarExcelTodas">📊 Excel — todas as avaliações (' + ativos.length + ')</button>';
          if (concluidasFiltradas.length) {
            html += '<button type="button" class="btn" id="avpExportarPdfFiltrados">📄 PDFs — todas do resultado atual (' + concluidasFiltradas.length + ' concluída' + (concluidasFiltradas.length === 1 ? '' : 's') + ')</button>';
          }
          if (concluidasSelecionadas.length) {
            html += '<button type="button" class="btn" id="avpExportarPdfSelecionadas">📄 PDFs — só as selecionadas (' + concluidasSelecionadas.length + ')</button>';
          }
          html += '<p class="avp-exportar-nota">Os PDFs saem num único arquivo, uma avaliação após a outra, no mesmo formato do PDF individual. Rascunhos não entram (ainda não têm resultado).</p>';
          html += '</div>';
        }
        html += '</div>';
      }
      /* Lixeira: só o gestor exclui/restaura. As configurações (questionários,
         motores, naturezas, adequação à squad) NÃO aparecem mais aqui — ficam
         exclusivamente no Admin. */
      if (pode()) {
        html += '<button class="btn btn--sm avp-lixeira-btn' + (state.lixeira ? ' active' : '') + '" id="avpLixeiraBtn">' +
          (state.lixeira ? '← Voltar para avaliações' : '🗑 Lixeira (' + excluidos.length + ')') + '</button>';
      }
      html += '</div>';
      if (state.flashExportacao) {
        html += '<p class="avp-export-status' + (state.flashExportacao.erro ? ' avp-export-status--erro' : '') + '">' +
          esc(state.flashExportacao.texto) + '</p>';
      }

      /* Linha própria, separada da barra de ações principal (+ Avaliar novo
         item / Exportar / Lixeira) e dos filtros — pedido explícito de não
         competir visualmente com nenhum dos dois. Só existe fora da lixeira,
         igual ao resto das ações de lote. */
      if (!state.lixeira && pode()) {
        var concluidas = ativos.filter(function (it) { return it.status === 'concluido'; });
        var elegiveisLote = concluidas.filter(elegivelParaReprocessamentoEmLote);
        var elegiveisReconciliacao = concluidas.filter(elegivelParaReconciliacaoEmLote);
        var verificandoMotor = concluidas.some(function (it) { return situacaoMotor(it) === 'verificando'; });
        html += renderBarraReconciliar(elegiveisReconciliacao);
        if (state.reconciliacaoLote) html += renderReconciliacaoLoteCard();
        html += renderBarraReprocessarTudo(elegiveisLote, elegiveisReconciliacao.length, verificandoMotor);
        if (state.reprocessamentoLote) html += renderReprocessamentoLoteCard();
      }

      /* Pesquisa + painel "Filtros (n)": a pesquisa vale dentro da lixeira também. */
      var nFiltros = numFiltrosAtivos();
      html += '<div class="avp-busca-barra">';
      html += '<input type="search" id="avpBusca" class="avp-busca" placeholder="Pesquisar por nome ou item..." aria-label="Pesquisar por nome ou item" value="' + esc(state.busca) + '" autocomplete="off">';
      if (!state.lixeira) {
        html += '<button type="button" class="btn btn--sm avp-filtros-btn' + (nFiltros ? ' avp-filtros-btn--ativo' : '') + '" id="avpFiltrosBtn" aria-expanded="' + (state.filtrosAbertos ? 'true' : 'false') + '">Filtros' + (nFiltros ? ' (' + nFiltros + ')' : '') + '</button>';
      }
      if (recortado) html += '<button type="button" class="avp-limpar-link" id="avpLimparFiltros">Limpar filtros</button>';
      html += '</div>';

      if (state.lixeira) {
        html += '<p class="avp-lixeira-aviso">🗑 Mostrando avaliações excluídas. Elas não são apagadas do banco — use "↺ Restaurar" para trazer de volta.</p>';
      } else if (state.filtrosAbertos) {
        /* Cada filtro com o PRÓPRIO rótulo visível: "Resultado Produto/Serviço"
           (se o item É ou não Produto/Serviço — decisão final) e "Classificação
           arquitetural" (a camada identificada, ex.: Componente, Canal) são
           conceitos diferentes e não podem parecer o mesmo filtro. Os valores
           são só os que o sistema realmente grava. */
        html += '<div class="avp-filtros-painel" id="avpFiltrosPainel"><div class="avp-filters">';
        html += filtroSelect('avpFiltroResultado', state.filtro.resultado, [
          ['todos', 'Todos'], ['produto', rotuloResultado('produto')], ['nao-produto', rotuloResultado('nao-produto')], ['a-validar', rotuloResultado('a-validar')]
        ], 'Resultado Produto/Serviço');
        html += filtroSelect('avpFiltroAlternativa', state.filtro.alternativa, [['todos', 'Todas']].concat(
          CAMADAS.map(function (c) { return [c.id, nomeClassificacao(c.id), c.id]; })
        ), 'Classificação arquitetural');
        html += filtroSelect('avpFiltroStatus', state.filtro.status, [
          ['todos', 'Todos'], ['rascunho', 'Em andamento'], ['concluido', 'Concluída']
        ], 'Status');
        html += filtroSelect('avpFiltroAlterado', state.filtro.alterado, [
          ['todos', 'Automática ou manual'], ['sim', 'Alterada manualmente']
        ], 'Decisão final');
        if (pode()) {
          html += filtroSelect('avpFiltroMotor', state.filtro.motor, [
            ['todos', 'Todas'], ['desatualizado', 'Motor desatualizado'], ['equivalente', 'Versão anterior equivalente'], ['atual', 'Motor atual']
          ], 'Versão do motor');
        }
        html += '</div>';
        html += '<p class="avp-filtros-ajuda">O <strong>resultado Produto/Serviço</strong> diz se o item é ou não ' + esc(nomeClassificacao('produto-principal')) + '; a ' +
          '<strong>classificação arquitetural</strong> diz que camada ele ocupa (' + esc(nomeClassificacao('componente')) + ', ' + esc(nomeClassificacao('canal')) + ', ' + esc(nomeClassificacao('processo-etapa')) + '…). São coisas diferentes e podem ser combinadas.</p>';
        html += '</div>';
      }

      if (!filtrados.length) {
        if (state.lixeira) {
          html += '<p class="admin-empty">' + (buscaAtiva() ? 'Nenhuma avaliação excluída encontrada para essa pesquisa.' : 'Nenhuma avaliação excluída.') + '</p>';
        } else if (recortado) {
          html += '<div class="avp-vazio" id="avpVazioBusca"><p>Nenhuma avaliação encontrada para ' + (buscaAtiva() && filtrosAtivos() ? 'essa pesquisa com esses filtros' : (buscaAtiva() ? 'essa pesquisa' : 'esses filtros')) + '.</p>' +
            '<button type="button" class="btn btn--sm" id="avpLimparFiltrosVazio">Limpar filtros</button></div>';
        } else {
          html += '<div class="avp-vazio" id="avpVazioLista"><p>Ainda não há avaliações. Comece avaliando o primeiro item.</p></div>';
        }
      } else if (state.lixeira) {
        html += '<div class="avp-tabela-wrap avp-tabela-wrap--lixeira"><table class="admin-table avp-table"><thead><tr>' +
          '<th class="avp-col-item">Item</th><th>Excluído por</th><th>Quando</th><th class="avp-col-justificativa">Justificativa</th><th class="avp-col-acoes">Ações</th></tr></thead><tbody>';
        filtrados.forEach(function (it) {
          html += '<tr>';
          html += '<td class="avp-col-item" data-label="Item">' + esc(it.nome) + '</td>';
          html += '<td data-label="Excluído por">' + esc(it.excluidoPor && it.excluidoPor.name || '—') + '</td>';
          html += '<td data-label="Quando">' + fmtData(it.excluidoEm) + '</td>';
          html += '<td class="avp-col-justificativa" data-label="Justificativa" title="' + esc(it.justificativaExclusao || '') + '">' + esc(it.justificativaExclusao || '—') + '</td>';
          html += '<td class="avp-col-acoes" data-label="Ações"><button class="btn btn--sm avp-act-restaurar" data-key="' + it._key + '">↺ Restaurar</button></td>';
          html += '</tr>';
        });
        html += '</tbody></table></div>';
      } else {
        var todosFiltradosSelecionados = filtrados.length > 0 && filtrados.every(function (it) { return !!state.selecionados[it._key]; });
        /* Seleção em lote serve à exportação (gestor); "⋯" só tem ações de
           quem avalia ou gere — consulta só abre. */
        var podeSelecionar = pode();
        var podeMais = pode();
        /* Aviso discreto (só aparece se algum nome da lista caiu no rótulo de contingência). */
        var idsNaLista = [];
        filtrados.forEach(function (it) { var cid = camadaDoItem(it); if (cid && idsNaLista.indexOf(cid) === -1) idsNaLista.push(cid); });
        if (idsNaLista.length) html += htmlAvisoContingencia(idsNaLista, 'avpListaClassifContingencia');
        html += '<div class="avp-tabela-wrap"><table class="admin-table avp-table"><thead><tr>' +
          (podeSelecionar ? '<th class="avp-check-col"><input type="checkbox" id="avpSelecionarTodos"' + (todosFiltradosSelecionados ? ' checked' : '') + ' aria-label="Selecionar todas as avaliações filtradas"></th>' : '') +
          '<th class="avp-col-item">Item</th><th class="avp-col-camada">Classificação</th><th class="avp-col-status">Status</th>' +
          '<th class="avp-col-data">Atualizado em</th><th class="avp-col-resp">Responsável</th><th class="avp-col-acoes">Ações</th></tr></thead><tbody>';
        filtrados.forEach(function (it) {
          var camadaHtml = it.camadaSugerida ? htmlNomeCamada(it.camadaSugerida, 'avp-camada-nome') : '—';
          var natureza = rotuloNaturezaDoItem(it);
          html += '<tr>';
          if (podeSelecionar) {
            html += '<td class="avp-check-col"><input type="checkbox" class="avp-check-item" data-key="' + it._key + '"' +
              (state.selecionados[it._key] ? ' checked' : '') + ' aria-label="Selecionar ' + esc(it.nome) + '"></td>';
          }
          /* Natureza complementar não ganha coluna própria (a lista ficaria larga
             demais): aparece como etiqueta sob o nome do item; o resto do detalhe
             (resultado automático, justificativas) fica na tela da avaliação. */
          html += '<td class="avp-col-item" data-label="Item"><span class="avp-item-nome">' + esc(it.nome) + '</span>' +
            (it.versao > 1 ? ' <span class="avp-tag-versao">v' + it.versao + '</span>' : '') +
            (natureza ? '<span class="avp-item-natureza" title="Natureza complementar"><span class="avp-tag-natureza">' + esc(natureza) + '</span></span>' : '') + '</td>';
          /* "Resultado final" não tem coluna na lista (era redundante com a Classificação);
             resultado automático e decisão final ficam na ficha. Só a marca de decisão
             alterada à mão continua visível, junto da classificação. */
          html += '<td class="avp-col-camada" data-label="Classificação">' + camadaHtml + (it.decisaoManual ? ' <span class="avp-tag-alterado">decisão alterada</span>' : '') + '</td>';
          html += '<td class="avp-col-status" data-label="Status">' + statusBadge(it.status) + badgeMotor(it) + '</td>';
          html += '<td class="avp-col-data" data-label="Atualizado em">' + fmtData(it.atualizadoEm) + '</td>';
          html += '<td class="avp-col-resp" data-label="Responsável">' + esc(it.responsavel && it.responsavel.name || '—') + '</td>';
          html += '<td class="avp-col-acoes" data-label="Ações"><div class="avp-row-actions">';
          if (it.status === 'concluido') {
            html += '<button class="btn btn--sm avp-act-principal avp-act-ver" data-key="' + it._key + '">Abrir</button>';
          } else if (podeMais) {
            html += '<button class="btn btn--sm avp-act-principal avp-act-editar" data-key="' + it._key + '">Continuar</button>';
          }
          if (podeMais) html += '<button class="btn btn--sm avp-act-mais" data-key="' + it._key + '" aria-label="Mais ações">⋯</button>';
          html += '</div></td>';
          html += '</tr>';
        });
        html += '</tbody></table></div>';
      }

      wrap.innerHTML = html;
      ajustarTopoCabecalho();

      var flashListaClose = document.getElementById('avpFlashListaClose');
      if (flashListaClose) flashListaClose.addEventListener('click', function () { state.flashLista = null; render(); });

      var lixeiraBtnEl = document.getElementById('avpLixeiraBtn');
      if (lixeiraBtnEl) lixeiraBtnEl.addEventListener('click', function () {
        state.lixeira = !state.lixeira;
        state.flashLista = null;
        state.selecionados = {};
        state.menuExportarAberto = false;
        render();
      });

      var reprocessarTudoBtn = document.getElementById('avpReprocessarTudoBtn');
      if (reprocessarTudoBtn) reprocessarTudoBtn.addEventListener('click', abrirModalAtualizarMotor);
      var loteFecharBtn = document.getElementById('avpLoteFechar');
      if (loteFecharBtn) loteFecharBtn.addEventListener('click', function () { state.reprocessamentoLote = null; render(); });
      var reconciliarTudoBtn = document.getElementById('avpReconciliarTudoBtn');
      if (reconciliarTudoBtn) reconciliarTudoBtn.addEventListener('click', abrirModalAtualizarMotor);
      var reconciliacaoFecharBtn = document.getElementById('avpReconciliacaoFechar');
      if (reconciliacaoFecharBtn) reconciliacaoFecharBtn.addEventListener('click', function () { state.reconciliacaoLote = null; render(); });

      var novoBtn = document.getElementById('avpNovoBtn');
      if (novoBtn) novoBtn.addEventListener('click', function () { irPara(hashNova()); }); /* a URL faz a tela (construirNova) */
      var squadAbrirBtn = document.getElementById('avpSquadBtn');
      /* O módulo do Squad é montado aqui se ainda não estiver: quando a página já abre em
         #avaliacoes, esta lista nasce antes de avaliacao-squad.js terminar de carregar. */
      if (squadAbrirBtn) squadAbrirBtn.addEventListener('click', function () {
        if (!window.faAvaliacaoSquad && window.faInitAvaliacaoSquad) window.faInitAvaliacaoSquad({ modo: 'operacional' });
        if (window.faAvaliacaoSquad) window.faAvaliacaoSquad.abrirLista();
        else avpAlert('A Adequação à Squad não carregou. Recarregue a página e tente de novo.');
      });
      var buscaEl = document.getElementById('avpBusca');
      if (buscaEl) {
        var compondo = false;
        function aplicarBusca() {
          var pos = buscaEl.selectionStart;
          state.busca = buscaEl.value;
          render();
          var novo = document.getElementById('avpBusca');
          if (novo) { novo.focus(); try { novo.setSelectionRange(pos, pos); } catch (e) {} }
        }
        buscaEl.addEventListener('compositionstart', function () { compondo = true; });
        buscaEl.addEventListener('compositionend', function () { compondo = false; aplicarBusca(); });
        buscaEl.addEventListener('input', function () { if (!compondo) aplicarBusca(); });
      }
      var filtrosBtn = document.getElementById('avpFiltrosBtn');
      if (filtrosBtn) filtrosBtn.addEventListener('click', function () { state.filtrosAbertos = !state.filtrosAbertos; render(); });
      function limparFiltros() {
        state.busca = '';
        state.filtro = { resultado: 'todos', status: 'todos', alterado: 'todos', alternativa: 'todos', motor: 'todos' };
        render();
      }
      ['avpLimparFiltros', 'avpLimparFiltrosVazio'].forEach(function (id) {
        var b = document.getElementById(id);
        if (b) b.addEventListener('click', limparFiltros);
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
        var itensSelecionados = chavesSelecionadas.map(function (k) { return buscarItem(k); })
          .filter(function (it) { return it && it.status === 'concluido'; });
        if (!itensSelecionados.length) return;
        executarExportacaoPdfLista(itensSelecionados, 'Selecionadas');
      });
      var exportarPdfFiltrados = document.getElementById('avpExportarPdfFiltrados');
      if (exportarPdfFiltrados) exportarPdfFiltrados.addEventListener('click', function () {
        var itensFiltrados = filtrados.filter(function (it) { return it.status === 'concluido'; });
        if (!itensFiltrados.length) return;
        executarExportacaoPdfLista(itensFiltrados, filtrosAtivos() ? 'Filtradas' : 'Todas');
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
      var todos = state.itens;
      lerTrilhas(versoesDoHistorico(itensParaExportar, todos).map(function (it) { return it._key; }), function (trilhas) {
        gerarExcel(itensParaExportar, todos, nomeArquivoExcel(sufixo), function (erro) {
          state.exportando = null;
          state.flashExportacao = erro
            ? { erro: true, texto: 'Não foi possível gerar o arquivo. Tente novamente.' }
            : { erro: false, texto: 'Arquivo gerado com sucesso.' };
          if (erro) console.error('[avaliacao-produto] erro ao gerar Excel:', erro);
          render();
        }, trilhas);
      });
    }
    function executarExportacaoPdfLista(itensSelecionados, escopo) {
      if (state.exportando) return;
      state.exportando = 'pdf';
      state.menuExportarAberto = false;
      state.flashExportacao = null;
      render();
      var nome = itensSelecionados.length === 1 ? nomeArquivoPdf(itensSelecionados[0])
        : 'Avaliacoes_Produto_Servico_' + (escopo || 'Selecionadas') + '_' + dataParaNomeArquivo() + '.pdf';
      gerarPdf(itensSelecionados, nome, function (erro) {
        state.exportando = null;
        state.flashExportacao = erro
          ? { erro: true, texto: 'Não foi possível gerar o arquivo. Tente novamente.' }
          : { erro: false, texto: 'Arquivo gerado com sucesso.' };
        if (erro) console.error('[avaliacao-produto] erro ao gerar PDF da lista:', erro);
        render();
      }, state.itens);
    }

    function filtroSelect(id, valorAtual, opcoes, rotulo) {
      var html = '<div class="avp-filtro"><label class="avp-filtro-rotulo" for="' + id + '">' + esc(rotulo) + '</label>';
      html += '<select class="avp-select" id="' + id + '">';
      opcoes.forEach(function (o) {
        /* o[2] = código de classificação: o rótulo da opção acompanha a Taxonomia sem redesenhar */
        html += '<option value="' + esc(o[0]) + '"' + (o[0] === valorAtual ? ' selected' : '') +
          (o[2] ? ' data-fa-classif="' + esc(o[2]) + '"' : '') + '>' + esc(o[1]) + '</option>';
      });
      html += '</select></div>';
      return html;
    }
    function resultadoBadge(v) {
      if (v === 'produto') return '<span class="avp-badge avp-badge--produto">É ' + htmlNomeCamada({ id: 'produto-principal' }) + '</span>';
      if (v === 'nao-produto') return '<span class="avp-badge avp-badge--nao-produto">Não é ' + htmlNomeCamada({ id: 'produto-principal' }) + '</span>';
      if (v === 'a-validar') return '<span class="avp-badge avp-badge--a-validar">' + htmlNomeCamada({ id: 'a-validar' }) + '</span>';
      return '<span class="avp-badge">—</span>';
    }
    function statusBadge(v) {
      return v === 'concluido'
        ? '<span class="avp-badge avp-badge--concluido">Concluída</span>'
        : '<span class="avp-badge avp-badge--rascunho">Em andamento</span>';
    }
    /* Indicador visual de auditoria — só existe para concluídas (rascunho não
       tem motorVersion nenhuma, então não entra nem como "atual" nem como
       "desatualizado" aqui, ao contrário do filtro em itemPassaFiltro). */
    function badgeMotor(it) {
      var d = diagnosticoMotor(it);
      if (!d) return '';
      var situacao = d.situacao;
      if (situacao === 'verificando') return ' <span class="avp-tag-motor avp-tag-motor--verificando">Verificando motor…</span>';
      if (situacao === 'desatualizado') return ' <span class="avp-tag-motor avp-tag-motor--desatualizado" title="' + esc(textoMotivoMotor(d.motivo)) + '">Motor desatualizado</span>';
      if (situacao === 'equivalente') return ' <span class="avp-tag-motor avp-tag-motor--equivalente">Versão anterior equivalente</span>';
      return ' <span class="avp-tag-motor avp-tag-motor--atual">Motor atual</span>';
    }

    function buscarItem(key) { return state.itens.filter(function (it) { return it._key === key; })[0]; }
    function clonarItem(it) { return JSON.parse(JSON.stringify(it)); }
    /* Uma versão "superada" (existe uma reavaliação mais nova apontando pra
       ela via versaoAnteriorKey) nunca aparece como linha própria na lista —
       nem ativa nem na Lixeira — só é alcançável pelo "Ver histórico" da
       versão atual. Isso é outra dimensão, à parte de excluído. */
    /* Todas as versões do MESMO item, da mais antiga para a mais nova: anda para
       trás por versaoAnteriorKey e para a frente pelas reavaliações que apontam
       para a versão atual da cadeia. Nunca agrupa por nome. */
    function cadeiaDeVersoes(a) { return cadeiaDe(a, state.itens); }
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
      var salvo = { opcao: it.decisaoManual ? it.decisaoFinal : 'auto', justificativa: it.justificativaDecisao || '' };
      return { opcao: salvo.opcao, justificativa: salvo.justificativa, erro: null,
        jaSalvouAntes: !!(it.decisaoManual || it.decisaoConfirmada), ultimoSalvo: salvo };
    }
    function decisaoIguais(x, y) {
      if (x.opcao !== y.opcao) return false;
      if (x.opcao === 'auto') return true;
      return (x.justificativa || '').trim() === (y.justificativa || '').trim();
    }
    /* Mesmo princípio do decisaoForm: ultimoSalvo é a fotografia do que está
       realmente gravado (nunca um booleano solto), para o botão distinguir
       "nada digitado ainda" de "já salvo, sem mudança" de "mudou depois de
       salvo" só comparando o campo atual contra ela. */
    function especializacaoFormInicial(it) {
      /* O formulário parte do cadastro VIGENTE: o que está sem efeito ou a revisar fica
         nos blocos próprios da ficha e não pode ser apagado por um salvamento. */
      var vigente = curadoriaRegistrada(it);
      var salvo = vigente.especializacao || '';
      var papelSalvo = vigente.papelEstruturalValor || '';
      return { valor: salvo, ultimoSalvo: salvo, papel: papelSalvo, papelUltimoSalvo: papelSalvo, erro: null };
    }

    function abrirVisualizacao(key) {
      if (!buscarItem(key)) return;
      abrirAvaliacaoNaUrl(key);
    }
    function abrirEdicao(key) {
      if (!buscarItem(key)) return;
      irPara(hashEditar(key));
    }
    function construirEdicao(it) {
      state.atual = clonarItem(it);
      if (!state.atual.respostas) state.atual.respostas = {};
      state.reavaliacaoBase = null;
      state.erroForm = null;
      state.camposInvalidos = [];
      state.pendenteId = null;
      state.flashLista = null;
      state.tela = 'checklist';
      marcarPontoDeEdicao();
      render();
    }
    /* Reavaliar NÃO é duplicar nem começar do zero: reabre o MESMO item com
       a avaliação anterior inteira como ponto de partida — respostas e
       justificativas incluídas — e a pessoa decide o que mantém, muda ou
       apaga. Nada é limpo automaticamente. A avaliação anterior nunca é
       sobrescrita: a reavaliação vira um registro NOVO (chave nova,
       encadeado por itemId/versaoAnteriorKey em salvarRegistro), e o
       histórico completo continua acessível pelo "Ver histórico". */
    /* Ponto de entrada ÚNICO da reavaliação (botão da ficha e menu da lista).
       Se a versão atual tem DECISÃO MANUAL, avisa antes — ela não vai para a
       nova versão (fica preservada, intacta, na versão em que foi tomada). Sem
       decisão manual não há o que descartar: abre direto. */
    function pedirReavaliacao(key) {
      var it = buscarItem(key);
      if (!it) return;
      if (!it.decisaoManual) { abrirReavaliacao(key); return; }
      var v = it.versao || 1;
      avpConfirm('Reavaliar cria uma nova versão deste item (v' + (v + 1) + ').\n\n' +
        'A decisão manual da v' + v + ' continua preservada na v' + v + ', sem alteração.\n\n' +
        'A nova versão não herda essa decisão: começa com a recomendação do sistema e exigirá uma nova decisão arquitetural.',
        function () { abrirReavaliacao(key); });
    }
    function abrirReavaliacao(key) {
      if (!buscarItem(key)) return;
      irPara(hashReavaliar(key)); /* a URL faz a tela (construirReavaliacao); a origem (avaliação ou lista) fica na entrada */
    }
    function construirReavaliacao(it) {
      state.atual = clonarItem(it);
      delete state.atual._key;
      /* A decisão manual NÃO é herdada: a nova versão parte da recomendação do sistema. */
      state.atual.decisaoFinal = null;
      state.atual.decisaoManual = false;
      state.atual.decisaoConfirmada = false;
      state.atual.justificativaDecisao = null;
      state.atual.alteradoPor = null;
      state.atual.alteradoEm = null;
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
      marcarPontoDeEdicao();
      render();
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
      /* A cópia entra como "nova avaliação" (?nova=1): o F5 recomeça do formulário vazio. O que já vem preenchido
         não conta como alteração — só o que a pessoa mudar depois. */
      irPara(hashNova(), { origem: { t: 'lista' } });
      marcarPontoDeEdicao();
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
      state.tela = telaInicial();
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
      html += linkVoltar('avpConfigVoltar', c.sub === 'lista' ? ROTULO_ADMIN : 'Questionários e versões');
      if (c.sub === 'lista') html += renderConfigLista();
      else if (c.sub === 'editar') html += renderConfigEditar();
      else if (c.sub === 'auditoria') html += renderConfigAuditoria();
      html += '</div>';
      wrap.innerHTML = html;

      document.getElementById('avpConfigVoltar').addEventListener('click', function () {
        if (c.sub === 'lista') fecharConfigQuestionarios();
        else sairComAviso(c, function () { c.sub = 'lista'; c.sujo = false; render(); });
      });
      if (c.sub === 'lista') bindConfigLista();
      else if (c.sub === 'editar') bindConfigEditar();
      else if (c.sub === 'auditoria') bindConfigAuditoria();
    }

    function renderConfigLista() {
      var c = state.config;
      var html = '<div class="avp-form-card"><h3>Questionários e versões</h3>';
      html += '<p class="avp-intro-questionarios" id="avpIntroQuestionarios">Aqui são mantidas as perguntas e os textos usados nas avaliações. ' +
        'Alterações publicadas geram nova versão e não modificam avaliações já concluídas.</p>';
      html += '<p class="avp-decisao-aviso">Altere título, texto, ajuda e exemplo das perguntas sem precisar de código, PR ou deploy. ' +
        'O identificador de cada pergunta (ex.: "P5") e a regra que ele representa para o motor de classificação nunca mudam por aqui.</p>';
      html += '<div class="avp-actions-footer"><button type="button" class="btn btn--sm" id="avpCfgExportarTodosBtn"' + (c.exportando ? ' disabled' : '') + '>' +
        (c.exportando ? 'Gerando…' : '📊 Exportar todos os questionários (Excel)') + '</button></div>';
      if (c.flashExportacao) html += '<p class="avp-export-status' + (c.flashExportacao.erro ? ' avp-export-status--erro' : '') + '" id="avpCfgExportStatus">' + esc(c.flashExportacao.texto) + '</p>';
      html += '</div>';
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
        html += '<button class="btn btn--sm avp-config-exportar-btn" data-codigo="' + codigo + '"' + (c.exportando ? ' disabled' : '') + '>📊 Exportar Excel</button>';
        html += '</div></div>';
        window.faQuestionarios.listarCorrecoesEditoriais(codigo).forEach(function (corr) { html += renderCorrecaoEditorial(corr.id); });
      });
      return html;
    }
    /* Correção editorial entregue pelo código e aplicada pelo MESMO
       mecanismo de qualquer outra edição (vira uma versão nova do
       questionário, com auditoria por campo) — ver CORRECOES_EDITORIAIS em
       questionarios-config.js. Nunca aplicada sozinha. */
    var ROTULO_CAMPO_EDITORIAL = {
      titulo: 'Título', texto: 'Texto da pergunta', exemplo: 'Exemplo', exemplos: 'Exemplos', ajudaExtra: 'Ajuda extra',
      'textoAjuda.significado': 'Ajuda — o que significa', 'textoAjuda.quandoSim': 'Ajuda — quando marcar SIM',
      'textoAjuda.quandoNao': 'Ajuda — quando marcar NÃO',
      justSim: 'Interpretação automática quando a resposta é SIM', justNao: 'Interpretação automática quando a resposta é NÃO'
    };
    function rotuloCampoEditorial(campo) { return ROTULO_CAMPO_EDITORIAL[campo] || campo; }
    var ROTULO_TIPO_AJUSTE = { alterar: 'alterar texto', criar: 'campo novo', remover: 'retirar campo' };
    function renderCorrecaoEditorial(id) {
      var sit = window.faQuestionarios.situacaoCorrecaoEditorial(id);
      if (!sit) return '';
      var html = '<div class="avp-form-card avp-correcao-card" id="avpCorrecao-' + esc(id) + '">';
      html += '<p class="avp-correcao-tag">Manutenção pontual — não faz parte do uso diário desta tela</p>';
      html += '<h4>' + (sit.aplicada ? '✓ Correção editorial aplicada' : 'Correção editorial disponível') + ' — ' + esc(sit.titulo) + '</h4>';
      html += '<p>' + esc(sit.descricao) + '</p>';
      if (!sit.aplicada) {
        var partes = [];
        if (sit.aAlterar) partes.push(sit.aAlterar + ' a alterar');
        if (sit.aCriar) partes.push(sit.aCriar + ' campo' + (sit.aCriar === 1 ? '' : 's') + ' a criar');
        if (sit.aRemover) partes.push(sit.aRemover + ' campo' + (sit.aRemover === 1 ? '' : 's') + ' a retirar');
        if (sit.jaAplicados + sit.substituidos) partes.push((sit.jaAplicados + sit.substituidos) + ' já em vigor');
        if (sit.divergentes) partes.push(sit.divergentes + (sit.divergentes === 1 ? ' divergente (não será alterado)' : ' divergentes (não serão alterados)'));
        html += '<p class="avp-correcao-resumo"><strong>' + esc(sit.ajustes.length) + ' ajustes:</strong> ' + esc(partes.join(' · ')) + '.</p>';
      }
      if (sit.divergentes) {
        html += '<p class="avp-error-msg avp-correcao-divergencia">⚠ ' + esc(sit.divergentes) + ' campo' + (sit.divergentes === 1 ? ' está' : 's estão') +
          ' com um texto diferente do esperado — alguém editou por conta própria. Esse texto é mantido e não será sobrescrito: compare abaixo e decida caso a caso.</p>';
      }
      html += '<ul class="avp-correcao-lista">';
      sit.ajustes.forEach(function (aj) {
        var marca = aj.estado === 'aplicada' ? '✓ já aplicado'
          : aj.estado === 'substituida' ? '✓ substituído por uma correção posterior'
          : aj.estado === 'pendente' ? 'pendente — ' + ROTULO_TIPO_AJUSTE[aj.tipo]
          : 'divergente — mantido, não será alterado';
        html += '<li class="avp-correcao-ajuste avp-correcao-ajuste--' + esc(aj.estado) + '" data-ajuste="' + esc(aj.pergunta + '.' + aj.campo) + '">' +
          '<strong>' + esc(aj.pergunta) + '</strong> · ' + esc(rotuloCampoEditorial(aj.campo)) + ' <em>(' + esc(marca) + ')</em>';
        if (aj.estado === 'pendente') {
          if (aj.tipo === 'criar') html += '<br><span class="avp-correcao-depois">Novo: ' + esc(semPrefixo(aj.para)) + '</span>';
          else if (aj.tipo === 'remover') html += '<br><span class="avp-correcao-antes">Será retirado: ' + esc(semPrefixo(aj.atual)) + '</span>';
          else html += '<br><span class="avp-correcao-antes">Antes: ' + esc(semPrefixo(aj.atual)) + '</span>' +
            '<br><span class="avp-correcao-depois">Depois: ' + esc(semPrefixo(aj.para)) + '</span>';
        } else if (aj.estado === 'divergente') {
          html += '<br><span class="avp-correcao-atual">Texto atual (mantido): ' + (aj.atual == null ? '<em>campo vazio</em>' : esc(semPrefixo(aj.atual))) + '</span>' +
            '<br><span class="avp-correcao-proposto">Proposto: ' + (aj.tipo === 'remover' ? '<em>retirar o campo</em>' : esc(semPrefixo(aj.para))) + '</span>';
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
      avpConfirm('Aplicar a correção "' + sit.titulo + '"? Isso cria a versão ' + (sit.versaoAtual + 1) + ' do questionário com ' +
        sit.pendentes + ' ajuste' + (sit.pendentes === 1 ? '' : 's') + ', sem alterar o motor e sem mudar avaliações já feitas.' +
        (sit.divergentes ? ' ' + sit.divergentes + (sit.divergentes === 1 ? ' campo divergente fica como está.' : ' campos divergentes ficam como estão.') : ''), function () {
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
      wrap.querySelectorAll('.avp-config-exportar-btn').forEach(function (btn) {
        btn.addEventListener('click', function () { exportarQuestionarios([btn.dataset.codigo]); });
      });
      document.getElementById('avpCfgExportarTodosBtn').addEventListener('click', function () {
        exportarQuestionarios(Object.keys(window.faQuestionarios.CODIGOS).map(function (k) { return window.faQuestionarios.CODIGOS[k]; }));
      });
    }
    function exportarQuestionarios(codigos) {
      var c = state.config;
      if (!c || c.exportando) return;
      c.exportando = true;
      c.flashExportacao = null;
      render();
      gerarExcelQuestionarios(codigos, function (erro) {
        c.exportando = false;
        c.flashExportacao = erro
          ? { erro: true, texto: 'Não foi possível gerar o arquivo. Tente novamente.' }
          : { erro: false, texto: 'Arquivo gerado com sucesso (versão publicada de cada questionário).' };
        if (erro) console.error('[avaliacao-produto] erro ao gerar Excel dos questionários:', erro);
        if (state.config === c && state.tela === 'config-questionario') render();
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
      html += '<button class="btn btn--sm" id="avpCfgVoltarListaBtn">← Voltar para Questionários e versões</button>';
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
          c.sujo = true;
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
      document.getElementById('avpCfgVoltarListaBtn').addEventListener('click', function () {
        sairComAviso(c, function () { c.sub = 'lista'; c.sujo = false; render(); });
      });
      document.getElementById('avpCfgSalvarRascunhoBtn').addEventListener('click', function () {
        c.salvando = true;
        render();
        window.faQuestionarios.salvarRascunho(c.codigo, c.rascunho.perguntas, sessaoAtual(), function (err) {
          c.salvando = false;
          if (!err) c.sujo = false;
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
        /* histórico recolhido (padrão único da Arquitetura): o valor anterior e o novo, que já
           estavam gravados mas não apareciam, ficam em "Ver detalhes" */
        html += renderHistoricoRecolhido('avpCfgHistorico', c.auditoria.map(function (a) {
          return { data: a.dataHora, autor: autorDe(a.usuario), tipo: 'Pergunta ' + a.pergunta + ' · ' + a.campo,
            resumo: 'Versão ' + a.versaoAnterior + ' → ' + a.novaVersao, anterior: a.valorAnterior, novo: a.valorNovo };
        }), { titulo: 'Histórico de alterações' });
      }
      html += '<div class="avp-actions-footer"><button class="btn btn--sm" id="avpCfgAuditoriaVoltarBtn">← Voltar para Questionários e versões</button></div>';
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
      /* Só as ações que o PERFIL permite (o banco também recusa o resto):
         avaliador reavalia/edita/duplica e vê o histórico; o gestor também
         bloqueia reprocessamento e exclui. */
      if (pode()) {
        if (it.status === 'concluido') {
          html += '<button class="btn avp-menu-item" data-acao="reavaliar">Reavaliar</button>';
        } else {
          html += '<button class="btn avp-menu-item" data-acao="editar">Editar</button>';
        }
        html += '<button class="btn avp-menu-item" data-acao="duplicar">Duplicar</button>';
        if (it.versaoAnteriorKey) {
          html += '<button class="btn avp-menu-item" data-acao="historico">🕘 Ver histórico</button>';
        }
      }
      if (it.status === 'concluido' && pode()) {
        html += it.bloqueadaParaReprocessamentoAutomatico
          ? '<button class="btn avp-menu-item" data-acao="desbloquear">🔓 Desbloquear reprocessamento automático</button>'
          : '<button class="btn avp-menu-item" data-acao="bloquear">🔒 Bloquear reprocessamento automático</button>';
      }
      if (pode()) html += '<button class="btn avp-menu-item avp-menu-item--perigo" data-acao="excluir">🗑 Excluir</button>';
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
          else if (acao === 'reavaliar') pedirReavaliacao(key);
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
        var decisao = decisaoFinalDe(versao);
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
       — NUNCA a mesma tela de "⚙ Questionários e versões" acima
       (aquela edita REDAÇÃO das perguntas P1-P16/S1-S8; esta edita a
       LÓGICA de decisão de cada motor: condições e precedência). O motor
       arquitetural (P1-P16) é administrado aqui mesmo, com o mesmo padrão
       técnico de motor-squad.js (RASCUNHO → SIMULAÇÃO → PUBLICAÇÃO,
       versoes/<n> nunca sobrescritas, validação antes de publicar). O
       motor de squad continua com a tela já criada pela PR #240
       (avaliacao-squad.js) — não duplicada aqui, só alcançável por um
       botão que chama window.faAvaliacaoSquadAdmin.abrirMotorConfig(origem). */
    /* Nome de uma classificação nas telas do motor: o atual da Taxonomia (código desconhecido: o próprio código). */
    function nomeCamadaMotor(id) { return camadaPorId(id) ? nomeClassificacao(id) : id; }
    /* ===================== ÁREA OPERACIONAL: SEM ACESSO ===================== */
    function renderSemAcessoArea() {
      wrap.innerHTML = '<div class="avp-form-card"><p class="admin-empty">Você não tem acesso à Avaliação de Produto/Serviço. ' +
        'Peça a um administrador para liberar o seu acesso.</p></div>';
    }

    /* ===================== ADMIN: INÍCIO DO BLOCO "AVALIAÇÃO DE PRODUTO/SERVIÇO" =====================
       Só parametrização e governança — nada de avaliar aqui. O trabalho do dia
       a dia (consultar, avaliar, reavaliar) fica na área AVALIAÇÃO do menu. */
    function renderAdminInicio() {
      /* Três grupos, só de organização visual — cada cartão leva à mesma tela
         de antes. Rótulos dos grupos descrevem o que o administrador faz ali. */
      function grupo(titulo, descricao, cartoes) {
        var h = '<section class="avp-form-card avp-admin-inicio avp-admin-grupo" aria-label="' + esc(titulo) + '">';
        h += '<h4>' + esc(titulo) + '</h4>';
        h += '<p class="avp-admin-grupo-desc">' + esc(descricao) + '</p>';
        h += '<div class="avp-admin-cards">' + cartoes + '</div></section>';
        return h;
      }
      function cartao(id, titulo, texto) {
        return '<button type="button" class="avp-admin-card" id="' + id + '"><strong>' + esc(titulo) + '</strong><span>' + esc(texto) + '</span></button>';
      }
      var html = '<div class="avp-form-card avp-admin-inicio">';
      html += '<p class="avp-decisao-aviso">Parametrização e governança da Avaliação de Produto/Serviço e da Adequação à Squad. Consultar e realizar avaliações (inclusive as de Squad) é feito na área <strong>Avaliação</strong> do menu principal.</p>';
      html += '</div>';
      html += grupo('Regras e conceitos', 'O que as perguntas dizem e como as respostas viram uma classificação.',
        cartao('avpConfigQuestionariosBtn', 'Questionários e versões', 'Redação das perguntas e justificativas, com versões e auditoria.') +
        cartao('avpConfigMotoresBtn', 'Configuração dos Motores', 'Regras que classificam os itens, com simulação e versões.'));
      /* A avaliação de Squad em si mora na área AVALIAÇÃO do menu (junto das demais avaliações);
         aqui fica só a governança dela: o motor de squad. */
      html += grupo('Governança arquitetural', 'Opções de descrição dos itens e as regras da adequação à gestão por squad.',
        cartao('avpConfigNaturezasBtn', 'Naturezas complementares', 'Opções do campo opcional de descrição do item.') +
        (window.faAvaliacaoSquadAdmin ? cartao('avpMotorSquadInicioBtn', 'Motor de Squad', 'Regras da adequação à gestão por squad (S1–S8), com simulação e versões. As avaliações de squad ficam na área Avaliação.') : ''));
      html += grupo('Referências', 'Artefatos da Arquitetura, como o Mapa da Floresta.',
        cartao('avpDocumentacaoBtn', 'Documentação e mapas de Arquitetura', 'Mapa da Floresta e outros artefatos: título, descrição, link, autor e data.'));
      if (souAdminGeral()) {
        html += grupo('Acesso', 'Quem entra na aba Avaliação e, se for o caso, na Arquitetura.',
          cartao('avpUsuariosBtn', 'Usuários autorizados', 'Quem usa a Avaliação (e quem também acessa a Arquitetura), com histórico.'));
      }
      wrap.innerHTML = html;
      document.getElementById('avpConfigQuestionariosBtn').addEventListener('click', abrirConfigQuestionarios);
      document.getElementById('avpConfigMotoresBtn').addEventListener('click', abrirConfigMotores);
      document.getElementById('avpConfigNaturezasBtn').addEventListener('click', abrirConfigNaturezas);
      var squadBtn = document.getElementById('avpMotorSquadInicioBtn');
      if (squadBtn) squadBtn.addEventListener('click', abrirMotorSquadDoInicio);
      var usuariosBtn = document.getElementById('avpUsuariosBtn');
      if (usuariosBtn) usuariosBtn.addEventListener('click', abrirAdminUsuarios);
      document.getElementById('avpDocumentacaoBtn').addEventListener('click', abrirDocumentacao);
    }

    /* ===================== HISTÓRICO RECOLHIDO (padrão único) =====================
       Toda trilha de alterações do ADMIN › Arquitetura usa este formato: fechada por padrão,
       com o tamanho no cabeçalho ("Histórico — N alterações"); aberta, uma linha por alteração
       com data, autor e tipo, e o conteúdo longo (valor anterior/novo) atrás de "Ver detalhes".
       Nada é apagado — é só a apresentação. linhas: [{ data, autor, tipo, resumo, anterior,
       novo }] (anterior/novo opcionais, texto ou objeto). total: quando a lista mostrada é só
       um recorte das mais recentes, o total real (o cabeçalho diz "últimas X de N"). */
    function textoDetalhe(v) {
      if (v == null || v === '') return '—';
      if (typeof v === 'string') {
        try { var j = JSON.parse(v); if (j && typeof j === 'object') return JSON.stringify(j, null, 2); } catch (e) { /* texto puro */ }
        return v;
      }
      return JSON.stringify(v, null, 2);
    }
    function renderHistoricoRecolhido(id, linhas, opts) {
      opts = opts || {};
      var n = linhas.length;
      var titulo = opts.titulo || 'Histórico';
      var cab = titulo + ' — ' + (opts.total && opts.total > n ? 'últimas ' + n + ' de ' + opts.total + ' alterações' : n + (n === 1 ? ' alteração' : ' alterações'));
      var h = '<details class="avp-historico-recolhido" id="' + id + '" data-det="' + id + '"' + detAberto(id) + '><summary>' + esc(cab) + '</summary>';
      if (!n) h += '<p class="admin-empty">Nenhuma alteração registrada ainda.</p>';
      else {
        h += '<ul class="avp-historico-lista">';
        linhas.forEach(function (l) {
          h += '<li class="avp-historico-linha"><div class="avp-historico-meta"><span class="avp-historico-data">' + esc(l.data ? fmtData(l.data) : '—') + '</span>' +
            '<span class="avp-historico-autor">' + esc(l.autor || '—') + '</span><span class="avp-historico-tipo">' + esc(l.tipo || '') + '</span></div>';
          if (l.resumo) h += '<p class="avp-historico-resumo">' + esc(l.resumo) + '</p>';
          if (l.anterior !== undefined || l.novo !== undefined) {
            h += '<details class="avp-historico-detalhe"><summary>Ver detalhes</summary>' +
              '<div class="avp-historico-valores"><div><strong>Antes</strong><pre>' + esc(textoDetalhe(l.anterior)) + '</pre></div>' +
              '<div><strong>Depois</strong><pre>' + esc(textoDetalhe(l.novo)) + '</pre></div></div></details>';
          }
          h += '</li>';
        });
        h += '</ul>';
      }
      return h + '</details>';
    }
    function autorDe(u) { return u ? (u.name || u.email || (typeof u === 'string' ? u : '')) : ''; }

    /* ===================== ADMIN: DOCUMENTAÇÃO E MAPAS DE ARQUITETURA =====================
       Artefatos da Arquitetura (o primeiro é o Mapa da Floresta) — NÃO são conceitos da
       Taxonomia e não têm nada a ver com o Mapa da Aposta (resultado da dinâmica de turma).
       Formato inicial, sem upload, miniatura nem versionamento de arquivo: título, descrição,
       link externo (https), autor e data. Editar e arquivar nunca apagam: o registro fica, e
       cada mudança grava uma linha em arquitetura-documentos-auditoria (só acréscimo).
       Mesmo público da Arquitetura na tela e nas regras do banco (admin geral e
       "Avaliação + Arquitetura"). */
    var NODE_DOCS = 'arquitetura-documentos';
    var NODE_DOCS_AUD = 'arquitetura-documentos-auditoria';
    /* Definições de artefatos da Arquitetura (não são conceitos da Taxonomia): cada uma tem uma chave
       estável e o conteúdo — título, definição, nota, link — é DADO, editável aqui e auditado em
       arquitetura-definicoes-auditoria (só acréscimo). O card mostra SEMPRE o que está no banco; o valor
       de fábrica abaixo só aparece enquanto o nó ainda não existe (deploy novo, antes da primeira
       gravação), marcado como tal — nunca por cima de uma configuração gravada, e nunca no lugar de
       uma leitura que falhou ou ainda não voltou (aí a tela diz que não carregou). */
    var NODE_DEF = 'arquitetura-definicoes';
    var NODE_DEF_AUD = 'arquitetura-definicoes-auditoria';
    var ID_MAPA_FLORESTA = 'MAPA_FLORESTA';
    var ROTULO_ACAO_DEF = { criada: 'Definição registrada', alterada: 'Definição alterada' };
    var PADRAO_MAPA_FLORESTA = {
      titulo: 'Mapa da Floresta',
      definicao: 'É uma representação visual organizada pela lógica de geração de valor. Mostra como a PREVI se organiza em Linhas, ' +
        'Centros de Excelência (CoE) e Áreas Especializadas e como essas estruturas contribuem para a entrega de produtos e serviços aos clientes.',
      nota: 'Não é um conceito da Taxonomia e não tem relação com o Mapa da Aposta.',
      link: null
    };
    function abrirDocumentacao() {
      state.documentacao = { carregando: true, erro: null, itens: {}, historico: [], editando: null, salvando: false, erroForm: null, flash: null, sujo: false, verArquivados: false,
        mapa: null, mapaHistorico: [], editandoMapa: null, salvandoMapa: false, erroMapa: null, flashMapa: null };
      state.tela = 'admin-documentacao';
      render();
      carregarDocumentacao();
    }
    function carregarDocumentacao() {
      var d = state.documentacao;
      var pend = 4, falhou = false;
      var relogio = setTimeout(function () {
        if (state.documentacao !== d || !d.carregando) return;
        d.carregando = false; d.erro = 'A leitura está demorando mais que o normal.';
        if (state.tela === 'admin-documentacao') render();
      }, 12000);
      function fim() {
        if (--pend > 0 || state.documentacao !== d) return;
        clearTimeout(relogio);
        d.carregando = false;
        if (state.tela === 'admin-documentacao') render();
      }
      function erro(e) {
        console.error('[documentação de arquitetura] erro ao ler:', e);
        if (falhou || state.documentacao !== d) return;
        falhou = true; clearTimeout(relogio);
        d.carregando = false; d.erro = 'Não foi possível carregar a documentação.';
        if (state.tela === 'admin-documentacao') render();
      }
      db().ref(NODE_DOCS).once('value', function (snap) { d.itens = snap.val() || {}; fim(); }, erro);
      db().ref(NODE_DEF + '/' + ID_MAPA_FLORESTA).once('value', function (snap) { d.mapa = snap.val() || null; fim(); }, erro);
      db().ref(NODE_DEF_AUD).once('value', function (snap) {
        var v = snap.val() || {};
        d.mapaHistorico = Object.keys(v).map(function (k) { return v[k]; }).filter(function (l) { return l && l.definicaoId === ID_MAPA_FLORESTA; })
          .sort(function (a, b) { return (b.dataHora || '').localeCompare(a.dataHora || ''); });
        fim();
      }, erro);
      db().ref(NODE_DOCS_AUD).once('value', function (snap) {
        var v = snap.val() || {};
        d.historico = Object.keys(v).map(function (k) { return v[k]; }).sort(function (a, b) { return (b.dataHora || '').localeCompare(a.dataHora || ''); });
        fim();
      }, erro);
    }
    function linkValido(l) { return /^https:\/\/[^\s]{3,1000}$/.test(String(l || '').trim()); }
    var ROTULO_ACAO_DOC = { criado: 'Documento adicionado', alterado: 'Documento alterado', arquivado: 'Documento arquivado', restaurado: 'Documento restaurado' };
    function renderDocumentacao() {
      var d = state.documentacao;
      var html = linkVoltar('avpDocsVoltar', ROTULO_ADMIN);
      html += '<div class="avp-form-card avp-docs"><h3>Documentação e mapas de Arquitetura</h3>';
      html += '<p class="avp-docs-intro">Artefatos de referência da Arquitetura, guardados como link para o arquivo (SharePoint, Drive ou outro).</p>';
      /* Definição do Mapa da Floresta: lida do banco (arquitetura-definicoes/MAPA_FLORESTA), em destaque */
      if (!d.carregando && !d.erro) html += renderDefinicaoMapa(d);
      if (d.flash) html += '<p class="avp-flash-success avp-flash-success--inline" id="avpDocsFlash">' + esc(d.flash) + '</p>';
      if (d.carregando) html += '<p class="loading-msg">Carregando documentação…</p>';
      if (d.erro) html += '<p class="avp-error-msg" id="avpDocsErro">' + esc(d.erro) + ' <button type="button" class="btn btn--sm" id="avpDocsTentar">Tentar novamente</button></p>';
      if (!d.carregando && !d.erro) {
        var chaves = Object.keys(d.itens).sort(function (a, b) { return String(d.itens[a].titulo || '').localeCompare(String(d.itens[b].titulo || ''), 'pt-BR'); });
        var ativos = chaves.filter(function (k) { return !d.itens[k].arquivado; });
        var arquivados = chaves.filter(function (k) { return d.itens[k].arquivado; });
        if (!d.editando) html += '<div class="avp-aut-barra"><button type="button" class="btn btn--primary" id="avpDocsNovoBtn">+ Adicionar documento ou mapa</button></div>';
        if (d.editando) html += renderFormDocumento(d);
        html += '<div class="avp-docs-lista" id="avpDocsLista">';
        if (!ativos.length) html += '<p class="admin-empty">Nenhum documento registrado ainda.</p>';
        ativos.forEach(function (k) { html += cartaoDocumento(k, d.itens[k], false); });
        html += '</div>';
        if (arquivados.length) {
          html += '<details class="avp-docs-arquivados" id="avpDocsArquivados" data-det="docsArq"' + detAberto('docsArq') + '><summary>Arquivados (' + arquivados.length + ')</summary>';
          arquivados.forEach(function (k) { html += cartaoDocumento(k, d.itens[k], true); });
          html += '</details>';
        }
        html += renderHistoricoRecolhido('avpDocsHistorico', d.historico.map(function (l) {
          return { data: l.dataHora, autor: autorDe(l.usuario), tipo: ROTULO_ACAO_DOC[l.tipo] || l.tipo, resumo: l.titulo || '',
            anterior: l.valorAnterior === undefined ? undefined : l.valorAnterior, novo: l.valorNovo === undefined ? undefined : l.valorNovo };
        }));
      }
      html += '</div>';
      html += rodapeVoltar('avpDocsVoltarRodape', ROTULO_ADMIN);
      wrap.innerHTML = html;
      ['avpDocsVoltar', 'avpDocsVoltarRodape'].forEach(function (id) {
        document.getElementById(id).addEventListener('click', function () {
          sairComAviso(d, function () { state.tela = telaInicial(); state.documentacao = null; render(); });
        });
      });
      var tentar = document.getElementById('avpDocsTentar');
      if (tentar) tentar.addEventListener('click', abrirDocumentacao);
      var novo = document.getElementById('avpDocsNovoBtn');
      if (novo) novo.addEventListener('click', function () { d.editando = { key: null, titulo: '', descricao: '', link: '' }; d.erroForm = null; d.flash = null; render(); });
      wrap.querySelectorAll('.avp-doc-editar').forEach(function (b) {
        b.addEventListener('click', function () {
          var it = d.itens[b.dataset.key];
          d.editando = { key: b.dataset.key, titulo: it.titulo || '', descricao: it.descricao || '', link: it.link || '' };
          d.erroForm = null; d.flash = null; render();
        });
      });
      wrap.querySelectorAll('.avp-doc-arquivar').forEach(function (b) {
        b.addEventListener('click', function () {
          var it = d.itens[b.dataset.key];
          var arquivar = b.dataset.acao === 'arquivar';
          avpConfirm((arquivar ? 'Arquivar' : 'Restaurar') + ' "' + it.titulo + '"?' + (arquivar ? '\n\nO registro não é apagado: fica em "Arquivados", com o histórico.' : ''), function () {
            gravarDocumento(b.dataset.key, Object.assign({}, it, { arquivado: arquivar }), arquivar ? 'arquivado' : 'restaurado', it);
          });
        });
      });
      if (d.editando) bindFormDocumento(d);
      bindDefinicaoMapa(d);
      wrap.querySelectorAll('details[data-det]').forEach(function (det) {
        det.addEventListener('toggle', function () { state.detAbertos = state.detAbertos || {}; state.detAbertos[det.dataset.det] = det.open; });
      });
    }
    function renderDefinicaoMapa(d) {
      var m = d.mapa, e = d.editandoMapa;
      var h = '<section class="avp-docs-definicao" id="avpDocsMapaFloresta" aria-labelledby="avpDocsMapaFlorestaTitulo">';
      if (d.flashMapa) h += '<p class="avp-flash-success avp-flash-success--inline" id="avpMapaFlash">' + esc(d.flashMapa) + '</p>';
      if (e) {
        h += '<h4 id="avpDocsMapaFlorestaTitulo">' + (m ? 'Editar definição' : 'Registrar definição') + ' <span class="avp-docs-definicao-id">' + esc(ID_MAPA_FLORESTA) + '</span></h4>';
        h += '<div class="avp-field"><label for="avpMapaTitulo">Título *</label><input type="text" id="avpMapaTitulo" maxlength="120" value="' + esc(e.titulo) + '"></div>';
        h += '<div class="avp-field"><label for="avpMapaDefinicao">Definição *</label><textarea id="avpMapaDefinicao" rows="5" maxlength="4000">' + esc(e.definicao) + '</textarea></div>';
        h += '<div class="avp-field"><label for="avpMapaNota">Nota auxiliar</label><textarea id="avpMapaNota" rows="2" maxlength="1000">' + esc(e.nota) + '</textarea></div>';
        h += '<div class="avp-field"><label for="avpMapaLink">Link do mapa (opcional, começa com https://)</label><input type="url" id="avpMapaLink" maxlength="1000" placeholder="https://" value="' + esc(e.link) + '"></div>';
        if (d.erroMapa) h += '<p class="avp-error-msg" id="avpMapaErro">' + esc(d.erroMapa) + '</p>';
        h += '<div class="avp-actions-footer"><button type="button" class="btn btn--primary" id="avpMapaSalvar"' + (d.salvandoMapa ? ' disabled' : '') + '>' + (d.salvandoMapa ? 'SALVANDO…' : 'SALVAR') + '</button>' +
          '<button type="button" class="btn" id="avpMapaCancelar"' + (d.salvandoMapa ? ' disabled' : '') + '>Cancelar</button></div>';
      } else if (m) {
        h += '<h4 id="avpDocsMapaFlorestaTitulo">' + esc(m.titulo) + '</h4>';
        h += '<p class="avp-docs-definicao-texto">' + esc(m.definicao) + '</p>';
        if (m.nota) h += '<p class="avp-docs-definicao-nota">' + esc(m.nota) + '</p>';
        if (m.link) h += '<p class="avp-doc-link"><a href="' + esc(m.link) + '" target="_blank" rel="noopener noreferrer">Abrir o mapa ↗</a></p>';
        h += '<p class="avp-doc-meta">Registrada por ' + esc(autorDe(m.criadoPor) || '—') + ' em ' + esc(fmtData(m.criadoEm)) +
          (m.atualizadoEm && m.atualizadoEm !== m.criadoEm ? ' · Atualizada em ' + esc(fmtData(m.atualizadoEm)) + ' por ' + esc(autorDe(m.atualizadoPor) || '—') : '') + '</p>';
        h += '<div class="avp-doc-acoes"><button type="button" class="btn btn--sm" id="avpMapaEditarBtn">Editar definição</button></div>';
      } else {
        /* nó ainda não existe: valor inicial de fábrica, dito como tal */
        var f = PADRAO_MAPA_FLORESTA;
        h += '<h4 id="avpDocsMapaFlorestaTitulo">' + esc(f.titulo) + '</h4>';
        h += '<p class="avp-docs-definicao-texto">' + esc(f.definicao) + '</p>';
        h += '<p class="avp-docs-definicao-nota">' + esc(f.nota) + '</p>';
        h += '<p class="avp-doc-meta" id="avpMapaFabrica">Valor inicial — ainda não salvo no banco. Ao editar e salvar, passa a valer a versão gravada, com histórico.</p>';
        h += '<div class="avp-doc-acoes"><button type="button" class="btn btn--sm" id="avpMapaEditarBtn">Editar definição</button></div>';
      }
      h += renderHistoricoRecolhido('avpMapaHistorico', d.mapaHistorico.map(function (l) {
        return { data: l.dataHora, autor: autorDe(l.usuario), tipo: ROTULO_ACAO_DEF[l.tipo] || l.tipo, resumo: l.titulo || '',
          anterior: l.valorAnterior === undefined ? undefined : l.valorAnterior, novo: l.valorNovo === undefined ? undefined : l.valorNovo };
      }));
      return h + '</section>';
    }
    function bindDefinicaoMapa(d) {
      var editar = document.getElementById('avpMapaEditarBtn');
      if (editar) editar.addEventListener('click', function () {
        var m = d.mapa || PADRAO_MAPA_FLORESTA;
        d.editandoMapa = { titulo: m.titulo || '', definicao: m.definicao || '', nota: m.nota || '', link: m.link || '' };
        d.erroMapa = null; d.flashMapa = null; render();
      });
      var e = d.editandoMapa;
      if (!e) return;
      [['avpMapaTitulo', 'titulo'], ['avpMapaDefinicao', 'definicao'], ['avpMapaNota', 'nota'], ['avpMapaLink', 'link']].forEach(function (par) {
        document.getElementById(par[0]).addEventListener('input', function (ev) { e[par[1]] = ev.target.value; d.sujo = true; });
      });
      document.getElementById('avpMapaCancelar').addEventListener('click', function () {
        sairComAviso(d, function () { d.editandoMapa = null; d.sujo = false; d.erroMapa = null; render(); });
      });
      document.getElementById('avpMapaSalvar').addEventListener('click', function () {
        if (d.salvandoMapa) return;
        var titulo = String(e.titulo || '').trim(), definicao = String(e.definicao || '').trim(), nota = String(e.nota || '').trim(), link = String(e.link || '').trim();
        if (!titulo) { d.erroMapa = 'Informe o título.'; render(); return; }
        if (!definicao) { d.erroMapa = 'Informe a definição.'; render(); return; }
        if (link && !linkValido(link)) { d.erroMapa = 'O link precisa ser completo, começando com https:// (ou deixe em branco).'; render(); return; }
        gravarDefinicaoMapa(d, { titulo: titulo, definicao: definicao, nota: nota || null, link: link || null });
      });
    }
    function gravarDefinicaoMapa(d, novo) {
      var agora = new Date().toISOString();
      var eu = sessaoAtual();
      var anterior = d.mapa;
      var reg = {
        titulo: novo.titulo, definicao: novo.definicao, nota: novo.nota, link: novo.link,
        criadoEm: (anterior && anterior.criadoEm) || agora, criadoPor: (anterior && anterior.criadoPor) || eu,
        atualizadoEm: agora, atualizadoPor: eu
      };
      var antes = anterior ? {} : null, depois = {};
      ['titulo', 'definicao', 'nota', 'link'].forEach(function (c) {
        var a = anterior && anterior[c] != null ? anterior[c] : null;
        if (!anterior || a !== reg[c]) { if (antes) antes[c] = a; depois[c] = reg[c]; }
      });
      if (anterior && !Object.keys(depois).length) { d.editandoMapa = null; d.sujo = false; d.flashMapa = 'Nada mudou — a definição continua a mesma.'; render(); return; }
      var linha = { tipo: anterior ? 'alterada' : 'criada', definicaoId: ID_MAPA_FLORESTA, titulo: reg.titulo,
        valorAnterior: antes ? JSON.stringify(antes) : null, valorNovo: JSON.stringify(depois), usuario: eu, dataHora: agora };
      var updates = {};
      updates[NODE_DEF + '/' + ID_MAPA_FLORESTA] = reg;
      updates[NODE_DEF_AUD + '/' + db().ref(NODE_DEF_AUD).push().key] = linha;
      d.salvandoMapa = true; d.erroMapa = null; render();
      var respondido = false;
      var relogio = setTimeout(function () {
        if (respondido) return; respondido = true;
        d.salvandoMapa = false;
        d.erroMapa = 'A conexão está demorando e não deu para confirmar o salvamento. Tente de novo.';
        if (state.tela === 'admin-documentacao') render();
      }, 12000);
      db().ref().update(updates, function (err) {
        if (respondido) return; respondido = true; clearTimeout(relogio);
        d.salvandoMapa = false;
        if (err) {
          console.error('[definição do Mapa da Floresta] erro ao gravar:', err);
          d.erroMapa = 'Não foi possível salvar. Tente novamente.';
          if (state.tela === 'admin-documentacao') render();
          return;
        }
        d.mapa = reg;
        d.mapaHistorico.unshift(linha);
        d.editandoMapa = null; d.sujo = false;
        d.flashMapa = '✓ ' + ROTULO_ACAO_DEF[linha.tipo] + '.';
        if (state.tela === 'admin-documentacao') render();
      });
    }
    function cartaoDocumento(k, it, arquivado) {
      var h = '<div class="avp-doc-item' + (arquivado ? ' avp-doc-item--arquivado' : '') + '" data-key="' + esc(k) + '">';
      h += '<p class="avp-doc-titulo"><strong>' + esc(it.titulo) + '</strong></p>';
      if (it.descricao) h += '<p class="avp-doc-descricao">' + esc(it.descricao) + '</p>';
      h += '<p class="avp-doc-link"><a href="' + esc(it.link) + '" target="_blank" rel="noopener noreferrer">Abrir o arquivo ↗</a></p>';
      h += '<p class="avp-doc-meta">Autor: ' + esc(autorDe(it.autor) || '—') + ' · ' + esc(fmtData(it.criadoEm)) +
        (it.atualizadoEm && it.atualizadoEm !== it.criadoEm ? ' · Atualizado em ' + esc(fmtData(it.atualizadoEm)) + (it.atualizadoPor ? ' por ' + esc(autorDe(it.atualizadoPor)) : '') : '') + '</p>';
      h += '<div class="avp-doc-acoes">' + (arquivado ? '' : '<button type="button" class="btn btn--sm avp-doc-editar" data-key="' + esc(k) + '">Editar</button>') +
        '<button type="button" class="btn btn--sm avp-doc-arquivar" data-key="' + esc(k) + '" data-acao="' + (arquivado ? 'restaurar' : 'arquivar') + '">' + (arquivado ? 'Restaurar' : 'Arquivar') + '</button></div>';
      return h + '</div>';
    }
    function renderFormDocumento(d) {
      var e = d.editando;
      var h = '<div class="avp-form-card avp-doc-form" id="avpDocForm"><h4>' + (e.key ? 'Editar documento' : 'Novo documento ou mapa') + '</h4>';
      h += '<div class="avp-field"><label for="avpDocTitulo">Título *</label><input type="text" id="avpDocTitulo" maxlength="120" value="' + esc(e.titulo) + '"></div>';
      h += '<div class="avp-field"><label for="avpDocDescricao">Descrição</label><textarea id="avpDocDescricao" rows="3" maxlength="2000">' + esc(e.descricao) + '</textarea></div>';
      h += '<div class="avp-field"><label for="avpDocLink">Link do arquivo * (começa com https://)</label><input type="url" id="avpDocLink" maxlength="1000" placeholder="https://" value="' + esc(e.link) + '"></div>';
      if (d.erroForm) h += '<p class="avp-error-msg" id="avpDocErro">' + esc(d.erroForm) + '</p>';
      h += '<div class="avp-actions-footer"><button type="button" class="btn btn--primary" id="avpDocSalvar"' + (d.salvando ? ' disabled' : '') + '>' + (d.salvando ? 'SALVANDO…' : 'SALVAR') + '</button>' +
        '<button type="button" class="btn" id="avpDocCancelar"' + (d.salvando ? ' disabled' : '') + '>Cancelar</button></div>';
      return h + '</div>';
    }
    function bindFormDocumento(d) {
      var e = d.editando;
      [['avpDocTitulo', 'titulo'], ['avpDocDescricao', 'descricao'], ['avpDocLink', 'link']].forEach(function (par) {
        document.getElementById(par[0]).addEventListener('input', function (ev) { e[par[1]] = ev.target.value; d.sujo = true; });
      });
      document.getElementById('avpDocCancelar').addEventListener('click', function () {
        sairComAviso(d, function () { d.editando = null; d.sujo = false; d.erroForm = null; render(); });
      });
      document.getElementById('avpDocSalvar').addEventListener('click', function () {
        if (d.salvando) return;
        var titulo = String(e.titulo || '').trim(), link = String(e.link || '').trim(), descricao = String(e.descricao || '').trim();
        if (!titulo) { d.erroForm = 'Informe o título.'; render(); return; }
        if (!linkValido(link)) { d.erroForm = 'Informe o link completo do arquivo, começando com https://.'; render(); return; }
        var anterior = e.key ? d.itens[e.key] : null;
        var novo = Object.assign({}, anterior || {}, { titulo: titulo, descricao: descricao || null, link: link });
        gravarDocumento(e.key, novo, e.key ? 'alterado' : 'criado', anterior);
      });
    }
    function gravarDocumento(key, dado, acao, anterior) {
      var d = state.documentacao;
      var agora = new Date().toISOString();
      var eu = sessaoAtual();
      key = key || db().ref(NODE_DOCS).push().key;
      var reg = {
        titulo: dado.titulo, descricao: dado.descricao || null, link: dado.link,
        autor: (anterior && anterior.autor) || eu, criadoEm: (anterior && anterior.criadoEm) || agora,
        atualizadoEm: agora, atualizadoPor: eu, arquivado: !!dado.arquivado
      };
      var campos = ['titulo', 'descricao', 'link', 'arquivado'];
      var antes = anterior ? {} : null, depois = {};
      campos.forEach(function (c) { if (!anterior || anterior[c] !== reg[c]) { if (antes) antes[c] = anterior[c] == null ? null : anterior[c]; depois[c] = reg[c]; } });
      var updates = {};
      updates[NODE_DOCS + '/' + key] = reg;
      updates[NODE_DOCS_AUD + '/' + db().ref(NODE_DOCS_AUD).push().key] = {
        tipo: acao, documentoId: key, titulo: reg.titulo,
        valorAnterior: antes ? JSON.stringify(antes) : null, valorNovo: JSON.stringify(depois),
        usuario: eu, dataHora: agora
      };
      d.salvando = true; d.erroForm = null; render();
      var respondido = false;
      var relogio = setTimeout(function () {
        if (respondido) return; respondido = true;
        d.salvando = false;
        d.erroForm = 'A conexão está demorando e não deu para confirmar o salvamento. Tente de novo.';
        if (!d.editando) d.flash = null;
        if (state.tela === 'admin-documentacao') { render(); if (!d.editando) avpAlert(d.erroForm); }
      }, 12000);
      db().ref().update(updates, function (err) {
        if (respondido) return; respondido = true; clearTimeout(relogio);
        d.salvando = false;
        if (err) {
          console.error('[documentação de arquitetura] erro ao gravar:', err);
          d.erroForm = 'Não foi possível salvar. Tente novamente.';
          if (state.tela === 'admin-documentacao') { render(); if (!d.editando) avpAlert(d.erroForm); }
          return;
        }
        d.itens[key] = reg;
        d.historico.unshift(updates[Object.keys(updates)[1]]);
        d.editando = null; d.sujo = false;
        d.flash = '✓ ' + (ROTULO_ACAO_DOC[acao] || 'Salvo') + '.';
        if (state.tela === 'admin-documentacao') render();
      });
    }

    /* ===================== ADMIN: USUÁRIOS AUTORIZADOS =====================
       Lista própria (fa-avaliacao-autorizados) de quem usa a aba AVALIAÇÃO e,
       opcionalmente, o ADMIN > ARQUITETURA. Só os autorizados aparecem aqui —
       nunca todos os usuários do site. Quem entra na lista vem de fa-users
       (as pessoas que já existem; nenhuma base paralela de pessoas).
       Dois tipos, sem relação com o perfil antigo (Consulta/Avaliador/Gestor):
         avaliacao             — aba AVALIAÇÃO;
         avaliacao-arquitetura — aba AVALIAÇÃO + somente ADMIN > ARQUITETURA.
       Remover só retira a autorização; não apaga a pessoa nem outros acessos.
       Toda mudança grava o registro e uma linha de histórico NA MESMA
       gravação (update multi-caminho, atômico) e só é dada como feita depois
       da resposta do banco. Só admin geral grava (regras do banco). */
    var TIPOS_AUTORIZADO = [
      { id: 'avaliacao', rotulo: 'Avaliação', desc: 'Usa a aba AVALIAÇÃO. Não entra em ADMIN > ARQUITETURA.' },
      { id: 'avaliacao-arquitetura', rotulo: 'Avaliação + Arquitetura', desc: 'Usa a aba AVALIAÇÃO e acessa somente ADMIN > ARQUITETURA — não é administrador geral.' }
    ];
    function rotuloTipo(id) { var t = TIPOS_AUTORIZADO.filter(function (x) { return x.id === id; })[0]; return t ? t.rotulo : '—'; }
    function semAcento(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
    function chaveEmailAut(e) { return String(e || '').toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64); }
    function souAdminGeral() {
      var sess = window.faAuth && window.faAuth.getSession();
      return !!(sess && window.faAuth.isAdmin && window.faAuth.isAdmin(sess.email));
    }
    /* "Ainda não sei se sou admin geral": sem sessão, ou com a lista de admins ainda por chegar.
       souAdminGeral() responde false nesses dois casos por NÃO SABER; quem desenha a decisão
       (renderTela) não pode tratar isso como "não sou". */
    function acessoAdminIndefinido() {
      var sess = window.faAuth && window.faAuth.getSession();
      if (!sess) return true;
      return !!(window.faAuth.isAdminReady && !window.faAuth.isAdminReady());
    }
    /* Sair guarda a pesquisa entre os autorizados: voltar para a tela devolve a mesma busca. */
    function sairDeUsuarios() {
      state.buscaUsuarios = state.usuarios ? state.usuarios.busca : '';
      state.tela = 'admin-inicio'; state.usuarios = null; render();
    }
    function abrirAdminUsuarios() {
      if (!souAdminGeral()) return; /* o cartão nem existe para quem não é admin geral */
      state.usuarios = { carregando: true, erro: null, lento: false, usuarios: [], autorizados: {}, historico: [], busca: state.buscaUsuarios || '', buscaAdd: '', adicionando: false, tiposAdd: {}, salvando: {}, avisos: {}, flash: null };
      state.tela = 'admin-usuarios';
      render();
      carregarUsuarios();
    }
    function carregarUsuarios() {
      var u = state.usuarios;
      var dados = { users: null, aut: null, hist: null };
      var falhou = false;
      var relogio = setTimeout(function () { if (u.carregando) { u.lento = true; if (state.tela === 'admin-usuarios') render(); } }, 10000);
      function fim() {
        if (falhou || dados.users === null || dados.aut === null || dados.hist === null) return;
        clearTimeout(relogio);
        u.usuarios = Object.keys(dados.users).map(function (k) {
          var v = dados.users[k] || {};
          return { email: v.email || '', nome: v.name || '' };
        }).filter(function (x) { return x.email; })
          .sort(function (a, b) { return (a.nome || a.email).localeCompare(b.nome || b.email, 'pt'); });
        u.autorizados = dados.aut;
        u.historico = Object.keys(dados.hist).map(function (k) { return Object.assign({ _key: k }, dados.hist[k]); })
          .sort(function (a, b) { return String(b.em || '').localeCompare(String(a.em || '')); });
        u.carregando = false;
        if (state.tela === 'admin-usuarios') render();
      }
      function falha(err) {
        if (falhou) return;
        falhou = true;
        clearTimeout(relogio);
        console.error('[avaliacao-produto] erro ao carregar usuários autorizados:', err);
        u.carregando = false;
        u.erro = 'Não foi possível carregar os usuários autorizados. Recarregue a página.';
        if (state.tela === 'admin-usuarios') render();
      }
      db().ref('fa-users').once('value', function (snap) { dados.users = snap.val() || {}; fim(); }, falha);
      db().ref('fa-avaliacao-autorizados').once('value', function (snap) { dados.aut = snap.val() || {}; fim(); }, falha);
      /* histórico inteiro (antes limitToLast(100): o contador parava em 100 sem avisar) */
      db().ref('fa-avaliacao-autorizados-auditoria').once('value', function (snap) { dados.hist = snap.val() || {}; fim(); }, falha);
    }
    function listaAutorizados() {
      var u = state.usuarios;
      return Object.keys(u.autorizados).map(function (k) { return Object.assign({ key: k }, u.autorizados[k]); })
        .sort(function (a, b) { return (a.nome || a.email || '').localeCompare(b.nome || b.email || '', 'pt'); });
    }
    function seletorTipo(valor, extra) {
      return '<select class="avp-select ' + extra.classe + '" ' + extra.attrs + '>' + TIPOS_AUTORIZADO.map(function (t) {
        return '<option value="' + t.id + '"' + (t.id === valor ? ' selected' : '') + '>' + esc(t.rotulo) + '</option>';
      }).join('') + '</select>';
    }
    function linhasAutorizados() {
      var u = state.usuarios;
      var q = semAcento(u.busca).trim();
      var total = listaAutorizados();
      var lista = total.filter(function (x) { return !q || semAcento(x.nome).indexOf(q) !== -1 || semAcento(x.email).indexOf(q) !== -1; });
      if (!total.length) return '<p class="admin-empty" id="avpAutVazio">Ninguém está autorizado ainda. Use <strong>+ ADICIONAR USUÁRIO</strong> para liberar o primeiro acesso.</p>';
      if (!lista.length) return '<p class="admin-empty">Nenhum usuário autorizado encontrado para essa busca.</p>';
      return lista.map(function (x) {
        var ocupado = !!u.salvando[x.key];
        var aviso = u.avisos[x.key];
        var h = '<div class="avp-aut-item" data-key="' + esc(x.key) + '">';
        h += '<div class="avp-aut-quem"><strong>' + esc(x.nome || x.email) + '</strong><span class="avp-usuario-email">' + esc(x.email) + '</span>';
        h += '<span class="avp-usuario-aviso">Concedido por ' + esc(x.concedidoPorNome || x.concedidoPor || '—') + ' em ' + esc(fmtData(x.concedidoEm)) + '</span>';
        if (x.alteradoEm) h += '<span class="avp-usuario-aviso">Alterado por ' + esc(x.alteradoPorNome || x.alteradoPor || '—') + ' em ' + esc(fmtData(x.alteradoEm)) + '</span>';
        h += '</div>';
        h += '<div class="avp-aut-tipo"><label class="avp-aut-rotulo" for="avpAutTipo-' + esc(x.key) + '">Tipo de acesso</label>' +
          seletorTipo(x.tipo, { classe: 'avp-aut-tipo-sel', attrs: 'id="avpAutTipo-' + esc(x.key) + '" data-key="' + esc(x.key) + '"' + (ocupado ? ' disabled' : '') + ' aria-label="Tipo de acesso de ' + esc(x.nome || x.email) + '"' });
        if (aviso) h += '<span class="avp-usuario-aviso' + (aviso.erro ? ' avp-usuario-aviso--erro' : '') + '">' + esc(aviso.texto) + '</span>';
        h += '</div>';
        h += '<div class="avp-aut-acoes"><button type="button" class="btn btn--sm avp-aut-remover" data-key="' + esc(x.key) + '"' + (ocupado ? ' disabled' : '') + '>Remover acesso</button></div>';
        return h + '</div>';
      }).join('');
    }
    function resultadosAdicionar() {
      var u = state.usuarios;
      var q = semAcento(u.buscaAdd).trim();
      if (q.length < 2) return '<p class="avp-natureza-ajuda">Digite pelo menos 2 letras do nome ou do e-mail.</p>';
      var achados = u.usuarios.filter(function (x) {
        return !u.autorizados[chaveEmailAut(x.email)] && (semAcento(x.nome).indexOf(q) !== -1 || semAcento(x.email).indexOf(q) !== -1);
      });
      if (!achados.length) return '<p class="admin-empty">Nenhum usuário encontrado (quem já está autorizado não aparece aqui).</p>';
      return achados.slice(0, 20).map(function (x) {
        var key = chaveEmailAut(x.email);
        var ocupado = !!u.salvando[key];
        var aviso = u.avisos[key];
        var h = '<div class="avp-aut-item avp-aut-item--add" data-key="' + esc(key) + '">';
        h += '<div class="avp-aut-quem"><strong>' + esc(x.nome || x.email) + '</strong><span class="avp-usuario-email">' + esc(x.email) + '</span></div>';
        h += '<div class="avp-aut-tipo"><label class="avp-aut-rotulo" for="avpAutNovoTipo-' + esc(key) + '">Tipo de acesso</label>' +
          seletorTipo(u.tiposAdd[key] || 'avaliacao', { classe: 'avp-aut-novo-tipo', attrs: 'id="avpAutNovoTipo-' + esc(key) + '" data-key="' + esc(key) + '"' + (ocupado ? ' disabled' : '') });
        if (aviso) h += '<span class="avp-usuario-aviso' + (aviso.erro ? ' avp-usuario-aviso--erro' : '') + '">' + esc(aviso.texto) + '</span>';
        h += '</div>';
        h += '<div class="avp-aut-acoes"><button type="button" class="btn btn--sm btn--primary avp-aut-autorizar" data-key="' + esc(key) + '" data-email="' + esc(x.email) + '"' + (ocupado ? ' disabled' : '') + '>Autorizar</button></div>';
        return h + '</div>';
      }).join('');
    }
    function linhasHistorico() {
      var u = state.usuarios;
      if (!u.historico.length) return '<p class="admin-empty">Nenhuma alteração registrada ainda.</p>';
      var ROTULO_ACAO = { concedido: 'Concedido', alterado: 'Alterado', removido: 'Removido' };
      return u.historico.map(function (h) {
        var tipo = h.acao === 'alterado' ? rotuloTipo(h.tipoAnterior) + ' → ' + rotuloTipo(h.tipoNovo)
          : h.acao === 'removido' ? rotuloTipo(h.tipoAnterior) : rotuloTipo(h.tipoNovo);
        return '<div class="avp-aut-hist"><strong>' + esc(ROTULO_ACAO[h.acao] || h.acao) + '</strong> · ' + esc(h.nome || h.email) +
          ' <span class="avp-usuario-email">' + esc(h.email) + '</span><br><span class="avp-usuario-aviso">' + esc(tipo) +
          ' · por ' + esc(h.porNome || h.por || '—') + ' em ' + esc(fmtData(h.em)) + '</span></div>';
      }).join('');
    }
    function renderAdminUsuarios() {
      var u = state.usuarios;
      var html = linkVoltar('avpUsuariosVoltar', ROTULO_ADMIN);
      html += '<div class="avp-form-card"><h3>Usuários autorizados</h3>';
      if (!souAdminGeral()) { /* rede de segurança: renderTela já tira quem não é admin geral daqui */
        state.tela = 'admin-inicio';
        state.usuarios = null;
        renderAdminInicio();
        return;
      }
      html += '<p class="avp-decisao-aviso">Quem não está nesta lista não tem acesso à Avaliação nem à Arquitetura. Administradores gerais continuam com acesso total por serem administradores. ' +
        'Os perfis antigos (Consulta, Avaliador e Gestor) não valem mais para nada.</p>';
      html += '<div class="table-scroll-wrap"><table class="admin-table avp-table avp-aut-matriz"><thead><tr><th>O que a pessoa acessa</th>' +
        TIPOS_AUTORIZADO.map(function (t) { return '<th>' + esc(t.rotulo) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        '<tr><td data-label="Acesso">Aba AVALIAÇÃO (avaliar, reavaliar, exportar, Adequação à Squad)</td><td>Sim</td><td>Sim</td></tr>' +
        '<tr><td data-label="Acesso">Curadoria e decisão arquitetural (especialização, papel estrutural, natureza complementar, decisão final)</td><td>Não</td><td>Sim</td></tr>' +
        '<tr><td data-label="Acesso">ADMIN › Arquitetura (questionários, motores, naturezas, motor de Squad, documentação e mapas)</td><td>Não</td><td>Sim</td></tr>' +
        '<tr><td data-label="Acesso">Demais áreas do ADMIN</td><td>Não</td><td>Não</td></tr>' +
        '<tr><td data-label="Acesso">Gerenciar esta lista</td><td>Não</td><td>Não</td></tr></tbody></table></div>';
      if (u.carregando) {
        html += '<p class="loading-msg">' + (u.lento ? 'A conexão está demorando… aguardando os usuários.' : 'Carregando usuários…') + '</p></div>';
        wrap.innerHTML = html;
        document.getElementById('avpUsuariosVoltar').addEventListener('click', sairDeUsuarios);
        return;
      }
      if (u.erro) {
        html += '<p class="avp-error-msg">' + esc(u.erro) + '</p></div>';
        wrap.innerHTML = html;
        document.getElementById('avpUsuariosVoltar').addEventListener('click', sairDeUsuarios);
        return;
      }
      if (u.flash) html += '<p class="avp-flash-success avp-flash-success--inline" id="avpUsuariosFlash">' + esc(u.flash) + '</p>';
      var euSess = sessaoAtual();
      if (euSess && euSess.email && !u.autorizados[chaveEmailAut(euSess.email)]) {
        var chaveEu = chaveEmailAut(euSess.email);
        var avisoEu = u.avisos[chaveEu];
        html += '<div class="avp-aut-eu" id="avpAutEu"><p class="avp-decisao-aviso">Você entra em tudo por ser administradora geral, mas o seu acesso ainda não está <strong>registrado nesta lista</strong>. ' +
          'A lista mostra quem foi autorizado explicitamente para a Avaliação e a Arquitetura.</p>' +
          '<button type="button" class="btn" id="avpAutAdicionarEuBtn"' + (u.salvando[chaveEu] ? ' disabled' : '') + '>Adicionar a mim como Avaliação + Arquitetura</button>' +
          '<span class="avp-usuario-aviso' + (avisoEu && avisoEu.erro ? ' avp-usuario-aviso--erro' : '') + '" id="avpAutEuAviso">' + (avisoEu ? esc(avisoEu.texto) : '') + '</span></div>';
      }
      html += '<div class="avp-aut-barra"><button type="button" class="btn btn--primary" id="avpAutAdicionarBtn" aria-expanded="' + (u.adicionando ? 'true' : 'false') + '">+ ADICIONAR USUÁRIO</button></div>';
      if (u.adicionando) {
        html += '<div class="avp-aut-adicionar" id="avpAutAdicionar"><div class="avp-field"><label for="avpAutBuscaAdd">Procurar usuário cadastrado</label>' +
          '<input type="search" id="avpAutBuscaAdd" placeholder="Nome ou e-mail" value="' + esc(u.buscaAdd) + '" autocomplete="off"></div>' +
          '<div id="avpAutResultados">' + resultadosAdicionar() + '</div></div>';
      }
      html += '<h4 class="avp-aut-subtitulo">Autorizados (' + listaAutorizados().length + ')</h4>';
      html += '<div class="avp-field"><label for="avpUsuariosBusca">Pesquisar entre os autorizados</label>' +
        '<input type="search" id="avpUsuariosBusca" placeholder="Nome ou e-mail" value="' + esc(u.busca) + '" autocomplete="off"></div>';
      html += '<div id="avpAutLista" class="avp-aut-lista">' + linhasAutorizados() + '</div>';
      /* padrão único: recolhido, "Histórico — N alterações" (concessões, alterações e remoções) */
      html += '<details class="avp-aut-historico avp-historico-recolhido" id="avpAutHistoricoDet" data-det="histAut"' + detAberto('histAut') + '><summary>Histórico — ' + u.historico.length + (u.historico.length === 1 ? ' alteração' : ' alterações') + ' (concessões, alterações e remoções)</summary><div id="avpAutHistorico">' + linhasHistorico() + '</div></details>';
      html += '</div>';
      html += rodapeVoltar('avpUsuariosVoltarRodape', ROTULO_ADMIN);
      wrap.innerHTML = html;
      ['avpUsuariosVoltar', 'avpUsuariosVoltarRodape'].forEach(function (id) {
        document.getElementById(id).addEventListener('click', sairDeUsuarios);
      });
      var euBtn = document.getElementById('avpAutAdicionarEuBtn');
      if (euBtn) euBtn.addEventListener('click', autorizarEu);
      document.getElementById('avpAutAdicionarBtn').addEventListener('click', function () { u.adicionando = !u.adicionando; u.buscaAdd = ''; renderAdminUsuarios(); });
      var buscaAdd = document.getElementById('avpAutBuscaAdd');
      if (buscaAdd) {
        buscaAdd.focus();
        buscaAdd.addEventListener('input', function () { u.buscaAdd = buscaAdd.value; document.getElementById('avpAutResultados').innerHTML = resultadosAdicionar(); ligarLinhasUsuarios(); });
      }
      var busca = document.getElementById('avpUsuariosBusca');
      busca.addEventListener('input', function () { u.busca = busca.value; document.getElementById('avpAutLista').innerHTML = linhasAutorizados(); ligarLinhasUsuarios(); });
      ligarLinhasUsuarios();
    }
    function atualizarListasUsuarios() {
      var l = document.getElementById('avpAutLista'); if (l) l.innerHTML = linhasAutorizados();
      var r = document.getElementById('avpAutResultados'); if (r) r.innerHTML = resultadosAdicionar();
      var euSess2 = sessaoAtual();
      if (euSess2 && euSess2.email) {
        var k2 = chaveEmailAut(euSess2.email), av2 = state.usuarios.avisos[k2];
        var euAv = document.getElementById('avpAutEuAviso');
        if (euAv) { euAv.textContent = av2 ? av2.texto : ''; euAv.classList.toggle('avp-usuario-aviso--erro', !!(av2 && av2.erro)); }
        var euB = document.getElementById('avpAutAdicionarEuBtn');
        if (euB) euB.disabled = !!state.usuarios.salvando[k2];
      }
      ligarLinhasUsuarios();
    }
    function ligarLinhasUsuarios() {
      var u = state.usuarios;
      wrap.querySelectorAll('.avp-aut-tipo-sel').forEach(function (sel) {
        sel.addEventListener('change', function () { alterarTipoAutorizado(sel.dataset.key, sel.value); });
      });
      wrap.querySelectorAll('.avp-aut-novo-tipo').forEach(function (sel) {
        sel.addEventListener('change', function () { u.tiposAdd[sel.dataset.key] = sel.value; });
      });
      wrap.querySelectorAll('.avp-aut-autorizar').forEach(function (btn) {
        btn.addEventListener('click', function () { autorizarUsuario(btn.dataset.key, btn.dataset.email); });
      });
      wrap.querySelectorAll('.avp-aut-remover').forEach(function (btn) {
        btn.addEventListener('click', function () { removerAutorizado(btn.dataset.key); });
      });
    }
    /* Grava registro + histórico numa única gravação. Só confirma depois da
       resposta do banco; sem resposta em 12 s, ou com erro, nada é dado como
       feito (e o seletor volta ao valor de antes). */
    function gravarAcesso(key, registro, linhaHistorico, aoSalvar) {
      var u = state.usuarios;
      if (u.salvando[key]) return;
      u.salvando[key] = true;
      u.avisos[key] = { texto: 'Salvando…' };
      atualizarListasUsuarios();
      var respondido = false;
      var relogio = setTimeout(function () { concluir(new Error('sem confirmação do servidor')); }, 12000);
      function concluir(err) {
        if (respondido) return;
        respondido = true;
        clearTimeout(relogio);
        delete u.salvando[key];
        if (err) {
          console.error('[avaliacao-produto] erro ao gravar acesso à Avaliação:', err);
          u.avisos[key] = { erro: true, texto: 'Não foi possível salvar. Tente novamente.' };
        } else {
          delete u.avisos[key];
          aoSalvar();
          u.historico.unshift(Object.assign({ _key: 'novo-' + Date.now() }, linhaHistorico));
          var h = document.getElementById('avpAutHistorico'); if (h) h.innerHTML = linhasHistorico();
        }
        if (state.tela === 'admin-usuarios') {
          if (!err) renderAdminUsuarios(); else atualizarListasUsuarios();
        }
      }
      try {
        var updates = {};
        updates['fa-avaliacao-autorizados/' + key] = registro;
        updates['fa-avaliacao-autorizados-auditoria/' + db().ref('fa-avaliacao-autorizados-auditoria').push().key] = linhaHistorico;
        db().ref().update(updates, concluir);
      } catch (e) { concluir(e); }
    }
    function concederAcesso(key, email, nomePessoa, tipo) {
      var u = state.usuarios;
      if (!email || u.autorizados[key]) return;
      var eu = sessaoAtual() || {};
      var agora = new Date().toISOString();
      var nome = nomePessoa || email;
      var registro = { email: email, nome: nome, tipo: tipo, concedidoPor: eu.email || '', concedidoPorNome: eu.name || '', concedidoEm: agora };
      var linha = { acao: 'concedido', email: email, nome: nome, tipoNovo: tipo, por: eu.email || '', porNome: eu.name || '', em: agora };
      gravarAcesso(key, registro, linha, function () {
        u.autorizados[key] = registro;
        u.flash = '✓ ' + nome + ' agora tem acesso: ' + rotuloTipo(tipo) + '.';
      });
    }
    function autorizarUsuario(key, email) {
      var u = state.usuarios;
      var x = u.usuarios.filter(function (p) { return p.email === email; })[0];
      if (!x) return;
      concederAcesso(key, x.email, x.nome, u.tiposAdd[key] || 'avaliacao');
    }
    /* Admin geral entra em tudo por ser admin, mas esta lista mostra quem foi AUTORIZADO
       explicitamente. Registrar a si mesma é uma ação explícita (um clique), nunca uma
       gravação automática: o tipo é "Avaliação + Arquitetura". */
    function autorizarEu() {
      var eu = sessaoAtual();
      if (!eu || !eu.email) return;
      concederAcesso(chaveEmailAut(eu.email), eu.email, eu.name, 'avaliacao-arquitetura');
    }
    function alterarTipoAutorizado(key, tipo) {
      var u = state.usuarios;
      var atual = u.autorizados[key];
      if (!atual || atual.tipo === tipo) return;
      var eu = sessaoAtual() || {};
      var agora = new Date().toISOString();
      var registro = Object.assign({}, atual, { tipo: tipo, alteradoPor: eu.email || '', alteradoPorNome: eu.name || '', alteradoEm: agora });
      var linha = { acao: 'alterado', email: atual.email, nome: atual.nome || atual.email, tipoAnterior: atual.tipo, tipoNovo: tipo, por: eu.email || '', porNome: eu.name || '', em: agora };
      gravarAcesso(key, registro, linha, function () {
        u.autorizados[key] = registro;
        u.flash = '✓ Tipo de acesso de ' + (atual.nome || atual.email) + ' alterado para ' + rotuloTipo(tipo) + '.';
      });
    }
    function removerAutorizado(key) {
      var u = state.usuarios;
      var atual = u.autorizados[key];
      if (!atual || u.salvando[key]) return;
      avpConfirm('Remover o acesso de ' + (atual.nome || atual.email) + '?\n\nIsso só retira a autorização desta lista: a pessoa continua cadastrada no site e com os outros acessos que já tinha.', function () {
        var eu = sessaoAtual() || {};
        var linha = { acao: 'removido', email: atual.email, nome: atual.nome || atual.email, tipoAnterior: atual.tipo, por: eu.email || '', porNome: eu.name || '', em: new Date().toISOString() };
        gravarAcesso(key, null, linha, function () {
          delete u.autorizados[key];
          u.flash = '✓ Acesso de ' + (atual.nome || atual.email) + ' removido.';
        });
      });
    }

    /* ===================== CONFIGURAÇÃO DAS NATUREZAS COMPLEMENTARES =====================
       Catálogo das opções do campo "Natureza complementar" (ver
       window.faNaturezas): qualquer admin cria, renomeia, descreve, reordena,
       ativa e desativa opções — sem código, sem PR, sem deploy. Quem abre esta
       tela consegue gravar (naturezas-complementares-config/auditoria usam a
       mesma regra de "qualquer admin" do resto do painel). Nunca apaga uma
       opção (desativar é ativo:false) e nunca mexe em avaliações já
       registradas: elas guardam o nome/descrição DA ÉPOCA. Código da opção:
       gerado do nome na criação e imutável depois. */
    function abrirConfigNaturezas() {
      state.configNaturezas = { editando: null, erro: null, flash: null, salvando: false, historico: null, erroHistorico: false };
      state.tela = 'config-naturezas';
      render();
      carregarHistoricoNaturezas();
    }
    /* Auditoria do catálogo (naturezas-complementares-auditoria/catalogo): gravada desde sempre, mas
       não aparecia em lugar nenhum. Leitura avulsa ao abrir a tela e depois de cada gravação. */
    function carregarHistoricoNaturezas() {
      var c = state.configNaturezas;
      db().ref('naturezas-complementares-auditoria/catalogo').once('value', function (snap) {
        if (state.configNaturezas !== c) return;
        var v = snap.val() || {};
        c.historico = Object.keys(v).map(function (k) { return v[k]; }).sort(function (x, y) { return (y.dataHora || '').localeCompare(x.dataHora || ''); });
        if (state.tela === 'config-naturezas') render();
      }, function (err) {
        console.error('[naturezas] erro ao ler o histórico do catálogo:', err);
        if (state.configNaturezas !== c) return;
        c.erroHistorico = true;
        if (state.tela === 'config-naturezas') render();
      });
    }
    var ROTULO_CAMPO_NATUREZA = { nome: 'Nome', descricao: 'Descrição', ativo: 'Ativa', ordem: 'Ordem' };
    function renderConfigNaturezas() {
      var c = state.configNaturezas;
      var catalogo = window.faNaturezas.estado();
      var todas = window.faNaturezas.todas();
      var html = linkVoltar('avpNaturezasVoltar', ROTULO_ADMIN);
      html += '<div class="avp-form-card"><h3>⚙ Naturezas complementares</h3>';
      html += '<p class="avp-decisao-aviso">Opções oferecidas no campo "Natureza complementar" de cada avaliação. É só uma descrição manual do item: não entra no motor, não muda respostas nem classificação e não exige reprocessamento. Renomear ou desativar uma opção não altera as avaliações que já a usam — elas guardam o nome da época.</p>';
      if (catalogo === 'carregando') html += '<p class="loading-msg">Carregando opções…</p>';
      html += avisoCatalogoNaturezas('avpNaturezasTentarNovamente');
      if (c.flash) html += '<p class="avp-flash-success avp-flash-success--inline" id="avpNaturezasFlash">' + esc(c.flash) + '</p>';
      if (c.erro) html += '<p class="avp-error-msg" id="avpNaturezasErro">' + esc(c.erro) + '</p>';
      if (catalogo === 'ok') {
        html += '<div class="table-scroll-wrap"><table class="admin-table avp-table"><thead><tr>' +
          '<th>Ordem</th><th>Nome</th><th>Descrição</th><th>Código</th><th>Situação</th><th>Ações</th></tr></thead><tbody>';
        todas.forEach(function (o) {
          html += '<tr data-codigo="' + esc(o.codigoEstavel) + '">';
          html += '<td data-label="Ordem">' + esc(o.ordem) + '</td>';
          html += '<td data-label="Nome">' + esc(o.nome) + '</td>';
          html += '<td data-label="Descrição" style="white-space:normal">' + esc(o.descricao || '—') + '</td>';
          html += '<td data-label="Código"><code>' + esc(o.codigoEstavel) + '</code></td>';
          html += '<td data-label="Situação">' + (o.ativo ? 'Ativa' : 'Desativada') + '</td>';
          html += '<td data-label="Ações"><div class="avp-row-actions">' +
            '<button class="btn btn--sm avp-natureza-editar" data-codigo="' + esc(o.codigoEstavel) + '"' + (c.salvando ? ' disabled' : '') + '>Editar</button>' +
            '<button class="btn btn--sm avp-natureza-alternar" data-codigo="' + esc(o.codigoEstavel) + '"' + (c.salvando ? ' disabled' : '') + '>' + (o.ativo ? 'Desativar' : 'Ativar') + '</button>' +
            '</div></td>';
          html += '</tr>';
        });
        html += '</tbody></table></div>';
        if (!c.editando) html += '<div class="avp-actions-footer"><button class="btn btn--primary" id="avpNaturezaNova"' + (c.salvando ? ' disabled' : '') + '>+ Nova opção</button></div>';
      }
      html += '</div>';
      if (catalogo === 'ok' && c.editando) {
        var e = c.editando;
        html += '<div class="avp-form-card" id="avpNaturezaForm"><h4>' + (e.novo ? 'Nova opção' : 'Editar opção') + '</h4>';
        html += '<div class="avp-field"><label for="avpNaturezaNome">Nome *</label><input type="text" id="avpNaturezaNome" value="' + esc(e.nome) + '" maxlength="80"></div>';
        html += '<div class="avp-field"><label for="avpNaturezaDescricaoEd">Descrição</label><textarea id="avpNaturezaDescricaoEd" rows="3">' + esc(e.descricao) + '</textarea></div>';
        html += '<div class="avp-field"><label for="avpNaturezaOrdem">Ordem</label><input type="number" id="avpNaturezaOrdem" value="' + esc(e.ordem) + '" min="0" step="1"></div>';
        html += '<div class="avp-field"><label>Código</label><p class="avp-natureza-ajuda"><code id="avpNaturezaCodigo">' + esc(e.novo ? (window.faNaturezas.codigoDeNome(e.nome) || '—') : e.codigoEstavel) + '</code> ' +
          (e.novo ? '(gerado do nome; não muda depois)' : '(não pode ser alterado)') + '</p></div>';
        html += '<div class="avp-actions-footer">' +
          '<button class="btn btn--primary" id="avpNaturezaSalvar"' + (c.salvando ? ' disabled' : '') + '>' + (c.salvando ? 'SALVANDO…' : 'SALVAR OPÇÃO') + '</button>' +
          '<button class="btn" id="avpNaturezaCancelar"' + (c.salvando ? ' disabled' : '') + '>Cancelar</button></div>';
        html += '</div>';
      }
      if (c.erroHistorico) html += '<p class="avp-natureza-ajuda" id="avpNaturezasHistoricoErro">Não foi possível carregar o histórico do catálogo agora.</p>';
      else if (c.historico) {
        html += renderHistoricoRecolhido('avpNaturezasHistorico', c.historico.map(function (l) {
          return { data: l.dataHora, autor: autorDe(l.usuario), tipo: (ROTULO_CAMPO_NATUREZA[l.campo] || l.campo) + ' · ' + l.codigo,
            resumo: l.valorAnterior == null ? 'opção criada' : '', anterior: l.valorAnterior, novo: l.valorNovo };
        }), { titulo: 'Histórico do catálogo' });
      }
      html += rodapeVoltar('avpNaturezasVoltarRodape', ROTULO_ADMIN);
      wrap.innerHTML = html;

      ['avpNaturezasVoltar', 'avpNaturezasVoltarRodape'].forEach(function (id) {
        document.getElementById(id).addEventListener('click', function () {
          sairComAviso(c, function () { state.tela = telaInicial(); state.configNaturezas = null; render(); });
        });
      });
      var tentarCatalogo = document.getElementById('avpNaturezasTentarNovamente');
      if (tentarCatalogo) tentarCatalogo.addEventListener('click', function () { window.faNaturezas.recarregar(); });
      wrap.querySelectorAll('.avp-natureza-editar').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var o = window.faNaturezas.porCodigo(btn.dataset.codigo);
          if (!o) return;
          c.sujo = false;
          c.editando = { novo: false, codigoEstavel: o.codigoEstavel, nome: o.nome, descricao: o.descricao, ordem: o.ordem, ativo: o.ativo };
          c.erro = null; c.flash = null;
          render();
        });
      });
      wrap.querySelectorAll('.avp-natureza-alternar').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var o = window.faNaturezas.porCodigo(btn.dataset.codigo);
          if (!o) return;
          gravarOpcaoNatureza(Object.assign({}, o, { ativo: !o.ativo }), o.ativo ? 'Opção desativada.' : 'Opção ativada.');
        });
      });
      var nova = document.getElementById('avpNaturezaNova');
      if (nova) nova.addEventListener('click', function () {
        var maior = todas.reduce(function (m, o) { return Math.max(m, o.ordem); }, 0);
        c.sujo = false;
        c.editando = { novo: true, codigoEstavel: '', nome: '', descricao: '', ordem: maior + 1, ativo: true };
        c.erro = null; c.flash = null;
        render();
        focarCampo('avpNaturezaNome');
      });
      var nome = document.getElementById('avpNaturezaNome');
      if (nome) nome.addEventListener('input', function () {
        c.sujo = true;
        c.editando.nome = nome.value;
        var cod = document.getElementById('avpNaturezaCodigo');
        if (cod && c.editando.novo) cod.textContent = window.faNaturezas.codigoDeNome(nome.value) || '—';
      });
      var desc = document.getElementById('avpNaturezaDescricaoEd');
      if (desc) desc.addEventListener('input', function () { c.sujo = true; c.editando.descricao = desc.value; });
      var ordem = document.getElementById('avpNaturezaOrdem');
      if (ordem) ordem.addEventListener('input', function () { c.sujo = true; c.editando.ordem = ordem.value; });
      var cancelar = document.getElementById('avpNaturezaCancelar');
      if (cancelar) cancelar.addEventListener('click', function () { c.editando = null; c.sujo = false; c.erro = null; render(); });
      var salvar = document.getElementById('avpNaturezaSalvar');
      if (salvar) salvar.addEventListener('click', function () {
        var e = c.editando;
        var nomeLimpo = String(e.nome || '').trim();
        if (!nomeLimpo) { c.erro = 'Informe o nome da opção.'; render(); focarCampo('avpNaturezaNome'); return; }
        var duplicada = window.faNaturezas.todas().some(function (o) {
          return o.codigoEstavel !== e.codigoEstavel && o.nome.toLowerCase() === nomeLimpo.toLowerCase();
        });
        if (duplicada) { c.erro = 'Já existe uma opção com esse nome.'; render(); focarCampo('avpNaturezaNome'); return; }
        var codigo = e.novo ? window.faNaturezas.codigoDeNome(nomeLimpo) : e.codigoEstavel;
        if (!window.faNaturezas.codigoValido(codigo)) { c.erro = 'Não foi possível gerar um código a partir desse nome. Use letras ou números.'; render(); return; }
        if (e.novo && window.faNaturezas.porCodigo(codigo)) { c.erro = 'Já existe uma opção com o código ' + codigo + '. Use um nome diferente.'; render(); return; }
        gravarOpcaoNatureza({ codigoEstavel: codigo, nome: nomeLimpo, descricao: e.descricao, ordem: e.ordem, ativo: e.ativo }, e.novo ? 'Opção criada.' : 'Opção salva.');
      });
    }
    /* Mesmo cuidado do salvamento da natureza: só o envio mais recente mexe na tela, e uma
       confirmação que chega depois do relógio não é descartada. A lista em si vem do ouvinte do
       catálogo (faNaturezas), nunca daqui. */
    var envioCatalogoNaturezas = 0;
    function gravarOpcaoNatureza(opcao, mensagemOk) {
      var c = state.configNaturezas;
      if (!c || c.salvando) return;
      var meu = ++envioCatalogoNaturezas, atrasou = false;
      c.salvando = true; c.erro = null; c.flash = null;
      render();
      var relogio = setTimeout(function () {
        if (meu !== envioCatalogoNaturezas || state.configNaturezas !== c) return;
        atrasou = true;
        c.salvando = false;
        c.erro = 'A conexão está demorando e ainda não deu para confirmar o salvamento. Ele continua pendente: a tela avisa quando a confirmação chegar.';
        render();
      }, 12000);
      window.faNaturezas.salvarOpcao(opcao, sessaoAtual(), function (err) {
        clearTimeout(relogio);
        if (meu !== envioCatalogoNaturezas || state.configNaturezas !== c) return; /* resposta antiga, ou outra tela */
        c.salvando = false;
        if (err) {
          console.error('[avaliacao-produto] erro ao salvar opção de natureza complementar:', err);
          c.erro = 'Não foi possível salvar a opção. Tente novamente.';
        } else {
          c.erro = null;
          if (!atrasou) { c.editando = null; c.sujo = false; }
          c.flash = '✓ ' + mensagemOk + (atrasou ? ' (A confirmação chegou com atraso.)' : '');
          carregarHistoricoNaturezas();
        }
        if (state.tela === 'config-naturezas') render();
      });
    }

    function abrirConfigMotores() {
      state.configMotores = { sub: 'painel', flash: null };
      state.tela = 'config-motores';
      render();
    }
    function voltarPainelConfigMotores() {
      state.configMotores = { sub: 'painel', flash: state.configMotores && state.configMotores.flash };
      render();
    }
    function voltarParaEditarRegras(c) {
      state.configMotores = { sub: 'editar-regras', regras: c.regras, versaoBase: c.versaoBase, salvando: false, sujo: true };
      render();
    }
    function voltarParaConflito(c) {
      state.configMotores = { sub: 'conflito-publicacao', regras: c.regras, versaoBase: c.versaoBase, versaoAtual: c.versaoAtual, salvando: false };
      render();
    }
    function renderConfigMotores() {
      var c = state.configMotores;
      var destinoVoltar = c.sub === 'painel' ? ROTULO_ADMIN
        : c.sub === 'simulacao' || c.sub === 'conflito-publicacao' ? 'Editar regras'
        : c.sub === 'comparar-alteracoes' ? 'o conflito de publicação'
        : 'Configuração dos Motores';
      var html = linkVoltar('avpMotoresVoltarLista', destinoVoltar);
      html += '<div class="avp-config-motores">';
      if (c.sub === 'painel') html += renderMotoresPainel();
      else if (c.sub === 'editar-regras') html += renderMotorArqEditarRegras();
      else if (c.sub === 'simulacao') html += renderMotorArqSimulacao();
      else if (c.sub === 'conflito-publicacao') html += renderMotorArqConflitoPublicacao();
      else if (c.sub === 'comparar-alteracoes') html += renderMotorArqCompararAlteracoes();
      else if (c.sub === 'auditoria') html += renderMotorArqAuditoria();
      else if (c.sub === 'versoes') html += renderMotorArqVersoes();
      html += '</div>';
      if (c.sub === 'painel') html += rodapeVoltar('avpMotoresVoltarRodape', ROTULO_ADMIN);
      wrap.innerHTML = html;
      var rodapeMotores = document.getElementById('avpMotoresVoltarRodape');
      if (rodapeMotores) rodapeMotores.addEventListener('click', function () { state.tela = telaInicial(); state.configMotores = null; render(); });
      document.getElementById('avpMotoresVoltarLista').addEventListener('click', function () {
        if (c.sub === 'painel') { state.tela = telaInicial(); state.configMotores = null; render(); }
        else if (c.sub === 'simulacao' || c.sub === 'conflito-publicacao') voltarParaEditarRegras(c);
        else if (c.sub === 'comparar-alteracoes') voltarParaConflito(c);
        else sairComAviso(c, voltarPainelConfigMotores);
      });
      if (c.sub === 'painel') bindMotoresPainel();
      else if (c.sub === 'editar-regras') bindMotorArqEditarRegras();
      else if (c.sub === 'simulacao') bindMotorArqSimulacao();
      else if (c.sub === 'conflito-publicacao') bindMotorArqConflitoPublicacao();
      else if (c.sub === 'comparar-alteracoes') bindMotorArqCompararAlteracoes();
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
      html += renderComoOMotorDecide(false);

      html += '<div class="avp-form-card"><h4>Motor de Classificação Arquitetural (P1-P16)</h4>';
      html += '<p>Versão publicada: <strong>' + esc(sitArq.versaoPublicada) + '</strong> · Status: ' + (sitArq.temRascunho ? '<strong>há um rascunho não publicado</strong>' : 'Publicada') + ' · Regras: ' + esc(sitArq.qtdRegras) + '</p>';
      html += '<p>Última publicação: ' + (sitArq.ultimaAlteracaoEm ? esc(fmtData(sitArq.ultimaAlteracaoEm)) + (sitArq.ultimaAlteracaoPor ? ' · ' + esc(sitArq.ultimaAlteracaoPor) : '') : 'nunca alterado (regras de fábrica, migradas de identificarCamada)') + '</p>';
      html += '<div class="avp-actions-footer">';
      html += '<button class="btn btn--sm" id="avpMotorArqEditarBtn">Editar regras</button>';
      html += '<button class="btn btn--sm" id="avpMotorArqVersoesBtn">Versões publicadas</button>';
      html += '<button class="btn btn--sm" id="avpMotorArqAuditoriaBtn">Histórico de alterações</button>';
      html += '</div>';
      /* O antigo "Editar textos" deste motor gravava um rótulo de classificação que nada exibia (cópia
         morta). O NOME e a DEFINIÇÃO das classificações vêm só da Taxonomia Arquitetural; o que já foi
         gravado em motor-arquitetura-config/textos e o histórico dessas edições continuam guardados. */
      html += '<p class="avp-natureza-ajuda" id="avpMotorArqNomesTaxonomia">Os nomes e as definições das classificações vêm da Taxonomia Arquitetural (ADMIN › Taxonomia), pelo código de cada classificação — não são editados aqui.</p>';
      html += '</div>';

      html += '<div class="avp-form-card"><h4>Motor de Adequação à Gestão por Squad (S1-S8)</h4>';
      if (window.faAvaliacaoSquadAdmin && window.faMotorSquad) {
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
      /* Abre o motor de squad (instância admin de avaliacao-squad.js) por cima desta tela e,
         no "← Voltar" do painel dele, volta exatamente para Configuração dos Motores. */
      if (squadBtn) squadBtn.addEventListener('click', function () {
        window.faAvaliacaoSquadAdmin.abrirMotorConfig({ rotulo: 'Configuração dos Motores', voltar: function () { render(); } });
        sincronizarEnderecoAdmin();
      });
    }

    /* ---- EDITAR REGRAS — lista ÚNICA e ordenada (diferente do squad, que
       tem 3 grupos eixoA/eixoB/combinacao): o motor arquitetural sempre foi
       UMA cadeia de precedência só, exatamente como identificarCamada. Só
       as FOLHAS (campo/valor) são editáveis — mesma restrição de squad
       (item 18 do pedido: P1-P16 nunca em texto livre, só listas
       controladas). */
    /* opts (só no grupo principal SE TODAS de uma regra): { codigo, novas: { P13: true } } — as
       condições NOVAS (acrescentadas neste rascunho, ausentes da versão-base) ganham o selo e o
       único botão "Remover" da tela; as que vieram da versão-base nunca são removíveis aqui. */
    function renderCondicaoArqEditavel(cond, leafRefs, prefixo, opts) {
      if (!cond || typeof cond !== 'object') return '<p class="avp-error-msg">' + prefixo + '(regra sem condições — configuração inválida)</p>';
      if (Array.isArray(cond.all)) {
        if (!cond.all.length) return '<p class="sq-cond-rotulo">' + prefixo + '(sempre — regra de encerramento/fallback)</p>';
        return '<div class="sq-cond-grupo"><p class="sq-cond-rotulo">' + prefixo + 'SE TODAS estas condições forem verdadeiras:</p>' +
          cond.all.map(function (c) { return renderCondicaoArqEditavel(c, leafRefs, prefixo + '　', opts ? { codigo: opts.codigo, novas: opts.novas, folhaDoTopo: true } : null); }).join('') + '</div>';
      }
      if (Array.isArray(cond.any)) {
        return '<div class="sq-cond-grupo"><p class="sq-cond-rotulo">' + prefixo + 'SE QUALQUER uma destas condições for verdadeira:</p>' +
          cond.any.map(function (c) { return renderCondicaoArqEditavel(c, leafRefs, prefixo + '　'); }).join('') + '</div>';
      }
      if (cond.not) {
        return '<div class="sq-cond-grupo"><p class="sq-cond-rotulo">' + prefixo + 'SE NENHUMA destas condições for verdadeira:</p>' + renderCondicaoArqEditavel(cond.not, leafRefs, prefixo + '　') + '</div>';
      }
      /* "PELO MENOS N DE" (política geral de conflitos): as perguntas do grupo
         aparecem só para leitura — trocar uma delas para NÃO desmontaria a
         política sem que a tela deixasse isso claro; a estrutura da política
         não é editada aqui (mesmo limite do editor para regras inteiras). */
      if (cond.atLeast != null || cond.of != null) {
        var filhos = Array.isArray(cond.of) ? cond.of : [];
        return '<div class="sq-cond-grupo sq-cond-grupo--pelo-menos"><p class="sq-cond-rotulo">' + prefixo + 'SE PELO MENOS ' + esc(cond.atLeast) + ' destas condições forem verdadeiras:</p>' +
          filhos.map(function (f) {
            var campoF = f && (f.campo || f.pergunta);
            var qF = perguntaDoMotor(campoF);
            var valorF = String((f && (f.valor != null ? f.valor : f.resposta)) || '').toUpperCase() === 'NAO' ? 'NÃO' : 'SIM';
            return '<div class="sq-cond-folha sq-cond-folha--legivel sq-cond-folha--fixa">' +
              '<p class="sq-cond-pergunta"><strong>' + esc(campoF) + '</strong>' + (qF.titulo ? ' — ' + esc(qF.titulo) : '') + '</p>' +
              '<p class="sq-cond-resposta">a resposta é <strong>' + valorF + '</strong> <span class="avp-config-readonly-tag">(fixa nesta política)</span></p>' +
              '</div>';
          }).join('') + '</div>';
      }
      var id = leafRefs.length;
      leafRefs.push(cond);
      var campo = cond.campo || cond.pergunta;
      var valorAtual = (cond.valor != null ? cond.valor : cond.resposta || 'SIM').toUpperCase();
      var q = perguntaDoMotor(campo);
      var nova = !!(opts && opts.folhaDoTopo && opts.novas && opts.novas[campo]);
      /* "P14 — Regra/condição: a resposta é [SIM]" — o código sozinho não diz
         nada a quem edita; o título e o texto vêm do questionário publicado,
         nunca de uma lista escrita aqui. A lógica (campo/valor) é a mesma. */
      return '<div class="sq-cond-folha sq-cond-folha--legivel' + (nova ? ' sq-cond-folha--nova' : '') + '"' + (nova ? ' data-nova="' + esc(campo) + '"' : '') + '>' +
        (nova ? '<p class="sq-cond-selo-nova">NOVA — ainda não publicada</p>' : '') +
        '<p class="sq-cond-pergunta"><strong>' + esc(campo) + '</strong>' + (q.titulo ? ' — ' + esc(q.titulo) : '') + '</p>' +
        '<label class="sq-cond-resposta">a resposta é ' +
        '<select class="sq-cond-select" data-leaf-id="' + id + '" aria-label="Resposta esperada em ' + esc(campo) + (q.titulo ? ' — ' + esc(q.titulo) : '') + '">' +
        '<option value="SIM"' + (valorAtual === 'SIM' ? ' selected' : '') + '>SIM</option>' +
        '<option value="NAO"' + (valorAtual === 'NAO' ? ' selected' : '') + '>NÃO</option>' +
        '</select></label>' +
        (q.texto ? '<p class="sq-cond-texto">' + esc(q.texto) + '</p>' : '') +
        (nova ? '<button type="button" class="btn btn--sm sq-cond-remover" data-regra="' + esc(opts.codigo) + '" data-campo="' + esc(campo) + '">Remover</button>' : '') +
        '</div>';
    }
    function perguntaDoMotor(codigo) {
      var q = window.faQuestionarios && window.faQuestionarios.conteudoPergunta
        ? window.faQuestionarios.conteudoPergunta('CLASSIFICACAO_ARQUITETURAL', codigo) : null;
      return { titulo: q && q.titulo && q.titulo !== codigo ? q.titulo : '', texto: q && q.texto && !/conteúdo não encontrado/.test(q.texto) ? q.texto : '' };
    }
    /* Explicação fixa, em linguagem de quem administra — descreve o que o
       motor JÁ faz (precedência, fallback, simulação, rascunho × publicação),
       não define regra nenhuma. */
    function renderComoOMotorDecide(abertoPorPadrao) {
      var h = '<details class="avp-form-card avp-motor-explica"' + (abertoPorPadrao ? ' open' : '') + '><summary><strong>Como este motor decide</strong></summary>';
      h += '<ul class="avp-motor-explica-lista">';
      h += '<li><strong>Precedência:</strong> as regras são lidas de cima para baixo. A <em>primeira</em> cujas condições forem todas verdadeiras define a classificação — nunca uma votação nem uma soma de respostas.</li>';
      /* nomes das classificações vêm da Taxonomia (nomeCamadaMotor → faClassificacoes); o texto da ajuda fica aqui */
      var nAValidar = esc(nomeCamadaMotor('a-validar'));
      h += '<li><strong>Fallback ("' + nAValidar + '"):</strong> se nenhuma regra anterior bater, o item fica como "' + nAValidar + '" para análise humana. É a última regra e sempre existe.</li>';
      h += '<li><strong>O que você pode mudar aqui:</strong> a resposta esperada (SIM ou NÃO) de cada condição e, com "+ Adicionar condição", acrescentar uma pergunta P1–P16 ao grupo "SE TODAS" de uma regra (nunca uma pergunta que a regra já usa). A ordem de precedência não é editada nesta tela.</li>';
      h += '<li><strong>Limite desta versão do editor:</strong> só dá para remover uma condição acrescentada no rascunho, antes de publicar. Depois de publicada, ela passa a fazer parte da regra e esta tela não a remove — o editor não edita a estrutura inteira das regras.</li>';
      h += '<li><strong>Proposta de regras:</strong> uma mudança de estrutura já aprovada (como a política geral de conflitos de natureza predominante) chega pronta e aparece no topo de "Editar regras". "Carregar proposta no editor" só troca as regras da tela — depois é o mesmo caminho: salvar o rascunho, simular e decidir se publica.</li>';
      h += '<li><strong>Conflito de naturezas predominantes:</strong> P11 a P15 perguntam se o item é <em>principalmente</em> ' + ['capacidade-organizacional', 'processo-etapa', 'modalidade-subproduto', 'regra-condicao'].map(function (id) { return esc(nomeCamadaMotor(id)); }).join(', ') + ' ou ' + esc(nomeCamadaMotor('componente')) + '. Quando a regra de conflito existe, duas ou mais SIM levam a "' + nAValidar + '", citando só as naturezas marcadas — nunca uma escolha pela ordem das regras.</li>';
      h += '<li><strong>Simular impacto:</strong> recalcula, só na tela, as avaliações já concluídas com as regras que você está editando e mostra quais mudariam de classificação. Não grava nada e não altera nenhuma avaliação.</li>';
      h += '<li><strong>Rascunho × publicação:</strong> "Salvar rascunho" guarda a edição sem efeito nenhum para quem avalia. Só "Publicar nova versão" faz as regras valerem — para as próximas avaliações. As já concluídas continuam como estão até alguém pedir o reprocessamento.</li>';
      h += '</ul></details>';
      return h;
    }
    /* ---- ACRESCENTAR CONDIÇÃO (só no grupo principal SE TODAS de uma regra comum) ----
       O que é NOVO é sempre calculado contra a versão-BASE do rascunho (c.versaoBase),
       nunca contra a versão publicada agora: se alguém publicou nesse meio-tempo, a
       tela não reinterpreta o rascunho — o conflito continua sendo tratado na
       publicação, como sempre (nada é sobrescrito nem reconciliado em silêncio).
       Nada novo é gravado além das próprias condições, no MESMO formato das existentes
       ({ campo, valor }): motor, validação, diff, simulação e auditoria não mudam. */
    function regrasBaseDoEditor(c) {
      var base = window.faMotorArquitetura.regrasDaVersaoBase(c.versaoBase);
      return Array.isArray(base) ? base : null;
    }
    function regraBasePorCodigo(base, codigo) {
      return base ? (base.filter(function (r) { return r.codigo === codigo; })[0] || null) : null;
    }
    /* { P13: true } — perguntas do grupo principal que a regra-base não usa em lugar nenhum. */
    function condicoesNovasDaRegra(regra, regraBase, base) {
      var novas = {};
      if (!base || !regra || !regra.condicoes || !Array.isArray(regra.condicoes.all)) return novas;
      var usadasBase = regraBase ? window.faMotorArquitetura.perguntasDaRegra(regraBase) : [];
      regra.condicoes.all.forEach(function (cond) {
        var campo = cond && (cond.campo || cond.pergunta);
        if (campo && usadasBase.indexOf(campo) === -1) novas[campo] = true;
      });
      return novas;
    }
    function aceitaNovaCondicao(regra) {
      return !!regra && !window.faMotorArquitetura.ehFallback(regra) && !!regra.condicoes && Array.isArray(regra.condicoes.all);
    }
    function regraDiferenteDaBase(regra, regraBase) {
      if (!regraBase) return false;
      return window.faMotorArquitetura.diffRegras([regraBase], [regra]).length > 0;
    }
    function renderAdicionarCondicao(c, regra) {
      if (c.adicionando !== regra.codigo) {
        return '<button type="button" class="btn btn--sm sq-cond-add-btn" data-regra="' + esc(regra.codigo) + '">+ Adicionar condição</button>';
      }
      var usadas = window.faMotorArquitetura.perguntasDaRegra(regra);
      var n = c.novaCond || { campo: '', valor: '' };
      var h = '<div class="sq-cond-add" data-regra="' + esc(regra.codigo) + '">';
      h += '<p class="sq-cond-add-titulo">Nova condição em ' + esc(regra.codigo) + ' (grupo "SE TODAS")</p>';
      h += '<label class="sq-cond-add-campo">Pergunta<select class="sq-cond-add-pergunta" aria-label="Pergunta da nova condição">' +
        '<option value="">— escolha a pergunta —</option>' +
        window.faMotorArquitetura.CAMPOS_VALIDOS.map(function (cod) {
          var q = perguntaDoMotor(cod), ja = usadas.indexOf(cod) !== -1;
          return '<option value="' + esc(cod) + '"' + (ja ? ' disabled' : '') + (n.campo === cod ? ' selected' : '') + '>' +
            esc(cod + (q.titulo ? ' — ' + q.titulo : '') + (ja ? ' (já usada nesta regra)' : '')) + '</option>';
        }).join('') + '</select></label>';
      h += '<label class="sq-cond-add-campo">A resposta é<select class="sq-cond-add-valor" aria-label="Resposta esperada da nova condição">' +
        '<option value="">— escolha —</option>' +
        '<option value="SIM"' + (n.valor === 'SIM' ? ' selected' : '') + '>SIM</option>' +
        '<option value="NAO"' + (n.valor === 'NAO' ? ' selected' : '') + '>NÃO</option></select></label>';
      if (c.erroAdicionar) h += '<p class="avp-error-msg" role="alert">' + esc(c.erroAdicionar) + '</p>';
      h += '<div class="sq-cond-add-acoes"><button type="button" class="btn btn--sm btn--primary sq-cond-add-confirmar"' + (n.campo && n.valor ? '' : ' disabled') + '>Adicionar</button>' +
        '<button type="button" class="btn btn--sm sq-cond-add-cancelar">Cancelar</button></div>';
      return h + '</div>';
    }
    /* ---- PROPOSTA DE REGRAS entregue pelo código (política geral de conflitos) ----
       Só aparece enquanto não está publicada. Carregar é uma ação explícita e
       só troca as regras DESTE editor — nada é gravado: o caminho continua o
       de sempre (SALVAR RASCUNHO → SIMULAR IMPACTO → PUBLICAR). Nunca se
       mistura com outra edição: com alterações em andamento, fica bloqueada. */
    function estadoPropostaNoEditor(c) {
      var m = window.faMotorArquitetura;
      var sit = m.situacaoPropostaRegras();
      if (sit.estado !== 'disponivel') return { sit: sit, estado: sit.estado, motivo: sit.motivo };
      var proposta = m.regrasDaPropostaRegras();
      if (proposta && !m.diffRegras(proposta, c.regras).length) return { sit: sit, estado: 'no-editor' };
      if (Number(c.versaoBase) !== sit.versaoBase) return { sit: sit, estado: 'bloqueada', motivo: 'Este rascunho foi iniciado sobre a versão ' + c.versaoBase + ', e a proposta só vale sobre a versão ' + sit.versaoBase + '. Nada foi carregado.' };
      /* Bloqueia só quando as regras DESTE editor diferem da versão publicada
         (edição em andamento, salva ou não) — nunca por um clique que, no fim,
         deixou tudo igual à versão publicada. */
      var publicadas = m.regrasDaVersaoBase(sit.versaoBase);
      var pendentes = publicadas ? m.diffRegras(publicadas, c.regras) : [];
      if (pendentes.length) {
        var quais = ' (regras: ' + pendentes.map(function (d) { return d.codigo; }).join(', ') + ')';
        return { sit: sit, estado: 'bloqueada', motivo: c.sujo
          ? 'Há alterações não salvas neste editor' + quais + '. Volte sem salvar (ou desfaça-as) antes de carregar a proposta — ela nunca é misturada com outra edição.'
          : 'Já existe um rascunho com alterações em relação à versão ' + sit.versaoBase + ' publicada' + quais + '. Desfaça essas alterações antes de carregar a proposta — ela nunca é misturada com outra edição.' };
      }
      return { sit: sit, estado: 'disponivel' };
    }
    function renderPropostaRegras(c) {
      var e = estadoPropostaNoEditor(c);
      if (e.estado === 'aplicada') return '';
      var html = '<div class="avp-form-card avp-proposta-regras" id="avpPropostaRegras" data-estado="' + esc(e.estado) + '">';
      html += '<h4>Proposta de regras: ' + esc(e.sit.titulo) + '</h4>';
      if (e.estado === 'no-editor') {
        html += '<p class="avp-flash-success" id="avpPropostaNoEditor">As regras deste editor são as da proposta — ainda não publicadas. Salve o rascunho e simule o impacto antes de decidir.</p>';
      } else {
        html += '<p>Proposta sobre a versão ' + esc(e.sit.versaoBase) + ' publicada. Carregar só troca as regras deste editor: nada é gravado, nada é publicado e nenhuma avaliação muda.</p>';
      }
      html += '<ul class="avp-proposta-mudancas">' + e.sit.mudancas.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
      if (e.estado === 'disponivel') html += '<button type="button" class="btn btn--sm btn--primary" id="avpCarregarPropostaBtn">Carregar proposta no editor</button>';
      else if (e.estado === 'no-editor') html += '<button type="button" class="btn btn--sm" id="avpDescartarPropostaBtn">Voltar às regras da versão ' + esc(e.sit.versaoBase) + ' publicada</button>';
      else html += '<p class="avp-decisao-aviso" id="avpPropostaBloqueada">' + esc(e.motivo) + '</p>';
      return html + '</div>';
    }
    function bindPropostaRegras(c) {
      var carregar = document.getElementById('avpCarregarPropostaBtn');
      if (carregar) carregar.addEventListener('click', function () {
        avpConfirm('Carregar a proposta no editor? As regras exibidas passam a ser as da proposta. Nada é gravado: para guardar, use SALVAR RASCUNHO; para ver o efeito, SIMULAR IMPACTO.', function () {
          var e = estadoPropostaNoEditor(c);
          var regras = e.estado === 'disponivel' ? window.faMotorArquitetura.regrasDaPropostaRegras() : null;
          if (!regras) { c.erro = e.motivo || 'A proposta não está disponível agora. Nada foi carregado.'; render(); return; }
          c.regras = regras; c.sujo = true; c.erro = null; c.adicionando = null; c.novaCond = null;
          render();
        });
      });
      var descartar = document.getElementById('avpDescartarPropostaBtn');
      if (descartar) descartar.addEventListener('click', function () {
        avpConfirm('Voltar às regras da versão publicada? A proposta sai deste editor (um rascunho já salvo só muda quando você salvar de novo).', function () {
          var base = window.faMotorArquitetura.regrasDaVersaoBase(window.faMotorArquitetura.situacaoPropostaRegras().versaoBase);
          if (!base) return;
          c.regras = window.faMotorArquitetura.migrarFallbackLegado(base); c.sujo = true; c.erro = null;
          render();
        });
      });
    }
    function renderMotorArqEditarRegras() {
      var c = state.configMotores;
      c.leafRefs = [];
      var base = regrasBaseDoEditor(c);
      var versaoAgora = window.faMotorArquitetura.versaoAtual();
      var html = '<div class="avp-form-card"><h3>Editar regras do motor arquitetural</h3>';
      if (!base) html += '<p class="avp-error-msg" id="avpMotorArqSemBase">Não consegui carregar a versão-base ' + esc(c.versaoBase) + ' deste rascunho. Por segurança, nenhuma condição é marcada como NOVA e nenhuma pode ser removida por aqui.</p>';
      else if (c.versaoBase != null && Number(c.versaoBase) !== Number(versaoAgora)) html += '<p class="avp-decisao-aviso" id="avpMotorArqBaseAntiga">Este rascunho foi iniciado sobre a versão ' + esc(c.versaoBase) + '; a versão publicada agora é a ' + esc(versaoAgora) + '. O que aparece como NOVA é comparado com a versão ' + esc(c.versaoBase) + '. Ao publicar, o conflito entre versões é tratado como sempre — nada é sobrescrito em silêncio.</p>';
      html += '<p class="avp-decisao-aviso">A ordem abaixo é a PRECEDÊNCIA: a primeira regra cujas condições baterem decide a camada — nunca uma votação. Mudar o valor esperado (SIM/NÃO) de uma condição muda a lógica do motor; ao publicar, isso cria uma versão nova e nunca recalcula avaliações já concluídas sozinho. É preciso simular o impacto antes de publicar.</p></div>';
      html += renderPropostaRegras(c);
      html += renderComoOMotorDecide(false);
      c.regras.slice().sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0); }).forEach(function (regra) {
        html += '<div class="avp-form-card sq-regra-card"><p class="sq-regra-codigo">Precedência ' + esc(regra.ordem) + ' — ' + esc(regra.codigo) +
          ' → classifica como <strong>' + esc(nomeCamadaMotor(regra.resultado)) + '</strong>' +
          (regra.incoerencia ? ' <em>(incoerência)</em>' : '') +
          (regra.conflito ? ' <em>(conflito: ' + regra.conflito.map(function (id) { return nomeCamadaMotor(id); }).join(' × ') + ')</em>' : '') +
          (regra.conflitoDinamico ? ' <em>(conflito de naturezas predominantes: cita só as naturezas marcadas SIM)</em>' : '') + '</p>';
        /* Fallback (tipo FALLBACK, ou o legado sem condicoes que o Firebase
           devolve) não tem condição nenhuma para desenhar — antes, abrir o
           editor numa versão publicada quebrava aqui (regra.condicoes
           undefined). */
        var regraBase = regraBasePorCodigo(base, regra.codigo);
        var novas = condicoesNovasDaRegra(regra, regraBase, base);
        var qtdNovas = Object.keys(novas).length;
        if (qtdNovas) html += '<p class="sq-regra-novas">' + qtdNovas + (qtdNovas === 1 ? ' condição acrescentada' : ' condições acrescentadas') + ' neste rascunho — ainda não publicada' + (qtdNovas === 1 ? '' : 's') + '</p>';
        html += window.faMotorArquitetura.ehFallback(regra)
          ? '<p class="sq-cond-rotulo">Esta é a regra de fallback: vale sempre que nenhuma regra anterior bater — o item fica como "' + esc(nomeCamadaMotor('a-validar')) + '" para análise humana.</p>'
          : renderCondicaoArqEditavel(regra.condicoes, c.leafRefs, '', { codigo: regra.codigo, novas: novas });
        if (aceitaNovaCondicao(regra)) {
          html += '<div class="sq-regra-acoes">' + renderAdicionarCondicao(c, regra);
          if (regraDiferenteDaBase(regra, regraBase)) html += '<button type="button" class="btn btn--sm sq-regra-desfazer" data-regra="' + esc(regra.codigo) + '">Desfazer alterações desta regra</button>';
          html += '</div>';
        }
        html += '</div>';
      });
      if (c.erro) html += '<div class="avp-form-card"><p class="avp-error-msg">' + esc(Array.isArray(c.erro) ? c.erro.join(' ') : c.erro) + '</p></div>';
      html += '<div class="avp-actions-footer">';
      html += '<button class="btn" id="avpMotorArqSalvarRascunhoBtn"' + (c.salvando ? ' disabled' : '') + '>SALVAR RASCUNHO</button>';
      html += '<button class="btn btn--primary" id="avpMotorArqSimularBtn"' + (c.salvando ? ' disabled' : '') + '>SIMULAR IMPACTO</button>';
      html += '<button class="btn" id="avpMotorArqCancelarBtn"' + (c.salvando ? ' disabled' : '') + '>← Voltar para Configuração dos Motores</button>';
      html += '</div>';
      return html;
    }
    function bindMotorArqEditarRegras() {
      var c = state.configMotores;
      bindPropostaRegras(c);
      wrap.querySelectorAll('.sq-cond-select').forEach(function (sel) {
        sel.addEventListener('change', function () { c.sujo = true; c.leafRefs[Number(sel.dataset.leafId)].valor = sel.value; });
      });
      function regraPorCodigo(codigo) { return c.regras.filter(function (r) { return r.codigo === codigo; })[0] || null; }
      wrap.querySelectorAll('.sq-cond-add-btn').forEach(function (b) {
        b.addEventListener('click', function () {
          c.adicionando = b.dataset.regra; c.novaCond = { campo: '', valor: '' }; c.erroAdicionar = null; render();
          var sel = wrap.querySelector('.sq-cond-add-pergunta'); if (sel && sel.focus) sel.focus();
        });
      });
      var addBox = wrap.querySelector('.sq-cond-add');
      if (addBox) {
        var selP = addBox.querySelector('.sq-cond-add-pergunta'), selV = addBox.querySelector('.sq-cond-add-valor'), ok = addBox.querySelector('.sq-cond-add-confirmar');
        var atualizaOk = function () { c.novaCond = { campo: selP.value, valor: selV.value }; c.erroAdicionar = null; ok.disabled = !(selP.value && selV.value); };
        selP.addEventListener('change', atualizaOk); selV.addEventListener('change', atualizaOk);
        addBox.querySelector('.sq-cond-add-cancelar').addEventListener('click', function () { c.adicionando = null; c.novaCond = null; c.erroAdicionar = null; render(); });
        ok.addEventListener('click', function () {
          var regra = regraPorCodigo(addBox.dataset.regra), n = c.novaCond || {};
          /* Mesmas regras do formulário, conferidas de novo no clique: pergunta P1-P16,
             que a regra ainda não usa, resposta SIM/NÃO, regra comum com grupo SE TODAS. */
          var erro = !aceitaNovaCondicao(regra) ? 'Esta regra não aceita novas condições.'
            : window.faMotorArquitetura.CAMPOS_VALIDOS.indexOf(n.campo) === -1 ? 'Escolha uma pergunta de P1 a P16.'
            : window.faMotorArquitetura.perguntasDaRegra(regra).indexOf(n.campo) !== -1 ? 'A pergunta ' + n.campo + ' já é usada nesta regra.'
            : (n.valor !== 'SIM' && n.valor !== 'NAO') ? 'Escolha a resposta esperada: SIM ou NÃO.' : null;
          if (erro) { c.erroAdicionar = erro; render(); return; }
          regra.condicoes.all.push({ campo: n.campo, valor: n.valor });
          c.sujo = true; c.adicionando = null; c.novaCond = null; c.erroAdicionar = null;
          render();
        });
      }
      wrap.querySelectorAll('.sq-cond-remover').forEach(function (b) {
        b.addEventListener('click', function () {
          var regra = regraPorCodigo(b.dataset.regra), base = regrasBaseDoEditor(c);
          if (!regra || !base) return;
          /* Só remove o que é NOVO em relação à versão-base — uma condição original nunca sai por aqui. */
          if (!condicoesNovasDaRegra(regra, regraBasePorCodigo(base, regra.codigo), base)[b.dataset.campo]) return;
          regra.condicoes.all = regra.condicoes.all.filter(function (cond) { return (cond.campo || cond.pergunta) !== b.dataset.campo; });
          c.sujo = true; render();
        });
      });
      wrap.querySelectorAll('.sq-regra-desfazer').forEach(function (b) {
        b.addEventListener('click', function () {
          avpConfirm('Desfazer todas as alterações da regra ' + b.dataset.regra + ' neste rascunho? Ela volta a ficar exatamente como na versão ' + c.versaoBase + '.', function () {
            var base = regrasBaseDoEditor(c), original = regraBasePorCodigo(base, b.dataset.regra);
            if (!original) return;
            var i = c.regras.map(function (r) { return r.codigo; }).indexOf(b.dataset.regra);
            if (i === -1) return;
            c.regras[i] = JSON.parse(JSON.stringify(original));
            c.sujo = true; if (c.adicionando === b.dataset.regra) { c.adicionando = null; c.novaCond = null; }
            render();
          });
        });
      });
      document.getElementById('avpMotorArqCancelarBtn').addEventListener('click', function () { sairComAviso(c, voltarPainelConfigMotores); });
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
      html += '<p class="avp-motor-sim-explica">Estas regras ainda são um rascunho: nada do que está abaixo vale para ninguém. Se você publicar, as regras passam a valer para as próximas avaliações; as já concluídas só mudam se alguém pedir o reprocessamento.</p>';
      html += '<p>' + esc(s.totalAnalisadas) + ' avaliaç' + (s.totalAnalisadas === 1 ? 'ão analisada' : 'ões analisadas') + '</p>';
      html += '<p>' + esc(s.mantidas) + ' manteriam a classificação</p>';
      html += '<p>' + esc(s.mudariam.length) + ' mudariam</p></div>';
      if (s.mudariam.length) {
        html += '<div class="avp-form-card"><h4>Avaliações que mudariam</h4>';
        html += '<div class="table-scroll-wrap"><table class="admin-table"><thead><tr><th>Item</th><th>Resultado atual</th><th>Resultado proposto</th></tr></thead><tbody>';
        s.mudariam.forEach(function (m) {
          html += '<tr><td data-label="Item">' + esc(m.itemNome) + '</td>' +
            '<td data-label="Resultado atual">' + esc(nomeCamadaMotor(m.atual)) + '</td>' +
            '<td data-label="Resultado proposto">' + esc(nomeCamadaMotor(m.nova)) + '</td></tr>';
        });
        html += '</tbody></table></div></div>';
      }
      if (c.erro) html += '<div class="avp-form-card"><p class="avp-error-msg">' + esc(c.erro) + '</p></div>';
      html += '<div class="avp-actions-footer">';
      html += '<button class="btn" id="avpMotorArqVoltarEdicaoBtn"' + (c.salvando ? ' disabled' : '') + '>← Voltar para Editar regras</button>';
      html += '<button class="btn btn--primary" id="avpMotorArqConfirmarPublicarBtn"' + (c.salvando ? ' disabled' : '') + '>' + (c.salvando ? 'PUBLICANDO…' : 'PUBLICAR NOVA VERSÃO') + '</button>';
      html += '</div>';
      return html;
    }
    function bindMotorArqSimulacao() {
      var c = state.configMotores;
      document.getElementById('avpMotorArqVoltarEdicaoBtn').addEventListener('click', function () { voltarParaEditarRegras(c); });
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
      html += '<button class="btn" id="avpMotorArqCompararVoltarBtn">← Voltar para o conflito de publicação</button>';
      html += '</div>';
      return html;
    }
    function bindMotorArqCompararAlteracoes() {
      var c = state.configMotores;
      document.getElementById('avpMotorArqCompararVoltarBtn').addEventListener('click', function () { voltarParaConflito(c); });
    }

    /* ---- AUDITORIA ---- */
    function rotuloAuditoriaMotor(a) {
      return a.tipo === 'regra' ? 'Regra' : a.tipo === 'texto' ? 'Texto'
        : a.tipo === 'conflito_publicacao' ? 'Conflito de publicação (bloqueado)'
        : a.tipo === 'reconciliacao_versao_equivalente' ? 'Reconciliação com versão equivalente' : 'Publicação sem alteração';
    }
    function resumoAuditoriaMotor(a) {
      var versao = a.tipo === 'conflito_publicacao'
        ? 'tentativa com base ' + a.versaoBase + ' — vigente ' + a.versaoAtual
        : a.tipo === 'reconciliacao_versao_equivalente'
          ? a.versaoAnterior + ' → ' + (a.versaoNova != null ? a.versaoNova : a.versaoAtual) + ' (equivalentes: ' + a.diferencasSemanticas + ' diferenças em ' + fmtNumero(a.combinacoesAnalisadas) + ' combinações; motor não executado)'
          : (a.versaoAnterior === a.novaVersao ? 'sem versão nova (' + a.versaoAnterior + ')' : 'versão ' + a.versaoAnterior + ' → ' + a.novaVersao);
      var campo = a.campo ? a.campo
        : a.tipo === 'reconciliacao_versao_equivalente' ? (a.avaliacaoNome ? a.avaliacaoNome : (a.quantidade != null ? a.quantidade + ' avaliaç' + (a.quantidade === 1 ? 'ão' : 'ões') : ''))
        : (a.tipo === 'conflito_publicacao' && a.origem ? a.origem : '');
      return (campo ? campo + ' · ' : '') + versao;
    }
    function linhasAuditoriaMotor(lista) {
      return lista.map(function (a) {
        return { data: a.dataHora, autor: autorDe(a.usuario), tipo: rotuloAuditoriaMotor(a), resumo: resumoAuditoriaMotor(a),
          anterior: a.valorAnterior === undefined ? undefined : a.valorAnterior, novo: a.valorNovo === undefined ? undefined : a.valorNovo };
      });
    }
    /* Exposto para o motor de squad (avaliacao-squad.js) mostrar o histórico no mesmo formato. */
    window.faHistoricoArquitetura = { render: renderHistoricoRecolhido, linhasMotor: linhasAuditoriaMotor };
    function renderMotorArqAuditoria() {
      var c = state.configMotores;
      var html = '<div class="avp-form-card"><h3>Histórico de alterações do motor arquitetural</h3></div>';
      /* o "← Voltar" do rodapé existe também enquanto carrega e quando não há nada a mostrar */
      if (!c.lista) { html += '<p class="loading-msg">Carregando…</p>' + '<div class="avp-actions-footer"><button class="btn" id="avpMotorArqVoltarAuditoriaBtn">← Voltar para Configuração dos Motores</button></div>'; return html; }
      html += renderHistoricoRecolhido('avpMotorArqHistorico', linhasAuditoriaMotor(c.lista), { titulo: 'Histórico de alterações' });
      html += '<div class="avp-actions-footer"><button class="btn" id="avpMotorArqVoltarAuditoriaBtn">← Voltar para Configuração dos Motores</button></div>';
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
      html += '<div class="avp-actions-footer"><button class="btn" id="avpMotorArqVoltarVersoesBtn">← Voltar para Configuração dos Motores</button></div>';
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
      var html = '<button class="avp-voltar-link" id="avpVoltarFormInicial">' + esc(rotuloVoltar()) + '</button>';
      html += '<div class="avp-form-card">';
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
      document.getElementById('avpCancelarInicialBtn').addEventListener('click', sairDaEdicao);
      document.getElementById('avpVoltarFormInicial').addEventListener('click', sairDaEdicao);
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
      html += '<button class="avp-voltar-link" id="avpVoltarLista">' + esc(rotuloVoltar()) + '</button>';
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
         das 16 perguntas já têm resposta VÁLIDA — o mesmo critério da conclusão
         (respostaValida): na reavaliação, a herdada de pergunta cujo texto
         mudou ainda não conta. */
      var respondidas = TODAS_PERGUNTAS.filter(function (p) { return respostaValida(p, a); }).length;
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

      document.getElementById('avpVoltarLista').addEventListener('click', sairDaEdicao);
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
          irParaListaDepoisDeSalvar();
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
        /* Espera a checagem de compatibilidade das regras (em segundo plano,
           normalmente já pronta) — o texto gravado não pode depender da pressa. */
        quandoCompatibilidadePronta(function () { salvarRegistro('concluido', function (payload, key) {
          state.salvando = null;
          state.itens = upsertItem(state.itens, Object.assign({ _key: key }, payload));
          state.decisaoForm = decisaoFormInicial(payload);
          state.naturezaForm = null;
          state.flashNatureza = null;
          state.especializacaoForm = especializacaoFormInicial(payload);
          state.reavaliacaoBase = null;
          state.flashResultado = '✓ Avaliação salva com sucesso.';
          state.snapshotEdicao = null;
          state.tela = 'resultado';
          /* SUBSTITUI a entrada do checklist pela da avaliação criada: o Voltar do navegador nunca reabre um
             checklist já encerrado. */
          irPara(hashAvaliacao(key), { replace: true });
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
        }); });
      });
      document.getElementById('avpCancelarChecklistBtn').addEventListener('click', sairDaEdicao);
    }

    function renderPergunta(def, resposta, respostaBase, incoerente) {
      var conteudo = conteudoDe(def, state.atual.questionnaireContentVersion);
      /* Reavaliação: resposta trazida de outra versão do questionário (ver situacaoRespostaHerdada).
         'pergunta' → a resposta antiga é só referência: nenhum botão marcado, e a conclusão exige um
         novo SIM/NÃO; 'ajuda' → aviso discreto, sem bloquear. */
      var herdada = situacaoRespostaHerdada(def, resposta, state.atual.questionnaireContentVersion);
      var respostaMarcada = herdada === 'pergunta' ? null : resposta;
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
      html += '<button type="button" class="avp-choice-btn avp-choice-btn--sim' + (respostaMarcada && respostaMarcada.valor === 'sim' ? ' active' : '') + '" data-valor="sim">SIM</button>';
      html += '<button type="button" class="avp-choice-btn avp-choice-btn--nao' + (respostaMarcada && respostaMarcada.valor === 'nao' ? ' active' : '') + '" data-valor="nao">NÃO</button>';
      html += '</div>';
      if (herdada === 'pergunta') {
        var versaoAntiga = resposta.questionnaireContentVersion;
        html += '<p class="avp-reavaliacao-alerta avp-herdada avp-herdada--pergunta">↺ Resposta trazida da versão anterior: <strong>' +
          (resposta.valor === 'sim' ? 'SIM' : 'NÃO') + '</strong>, dada à pergunta ' +
          (versaoAntiga ? 'da versão ' + esc(versaoAntiga) + ' do questionário' : 'de uma versão anterior do questionário') +
          (resposta.textoPerguntaNaEpoca ? ' ("' + esc(resposta.textoPerguntaNaEpoca) + '")' : '') +
          '. A pergunta mudou — responda SIM ou NÃO de novo.</p>';
        if (resposta.observacao) html += '<textarea class="avp-observacao" data-id="' + def.id + '" placeholder="Observação do avaliador (opcional)">' + esc(resposta.observacao) + '</textarea>';
      } else if (resposta && resposta.valor) {
        if (herdada === 'ajuda') html += '<p class="avp-reavaliacao-alerta avp-herdada avp-herdada--ajuda">↺ Resposta trazida da versão anterior — revise e confirme.</p>';
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
      var jaTinhaChave = !!a._key;
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
        especializacaoCamadaConfirmada: a.especializacaoCamadaConfirmada || null,
        papelEstruturalCamadaConfirmada: a.papelEstruturalCamadaConfirmada || null,
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
      /* A natureza complementar descreve o ITEM, não uma rodada de respostas:
         uma reavaliação herda a da versão anterior (a.* veio do clone), um item
         novo não tem. Nunca é calculada aqui. */
      Object.assign(payload, camposNaturezaDoItem(a));
      if (status === 'concluido') {
        var calc = computeResultado(a);
        /* A camada mudou (reavaliação ou edição)? Fixa o vínculo do cadastro de curadoria na hora
           e recalcula com ele — o cadastro não passa a valer sozinho na camada nova. A camada
           anterior é a gravada na avaliação, ou, num rascunho de reavaliação, a da versão anterior. */
        var versaoAnterior = a.versaoAnteriorKey ? buscarItem(a.versaoAnteriorKey) : null;
        var vinculos = vinculosAoMudarCamada(a, camadaDoItem(a) || camadaDoItem(state.reavaliacaoBase) || camadaDoItem(versaoAnterior), calc.camadaSugerida && calc.camadaSugerida.id);
        if (Object.keys(vinculos).length) {
          Object.assign(payload, vinculos);
          calc = computeResultado(Object.assign({}, a, vinculos));
        }
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
      var reavAuditadas = state.reavAuditadas || (state.reavAuditadas = {});
      function terminou(err, gravouAuditoria) {
        if (respondido) return;
        respondido = true;
        clearTimeout(relogio);
        if (err) {
          console.error('[avaliacao-produto] erro ao salvar avaliação (' + status + '):', err);
          if (onErro) onErro('erro', err);
          return;
        }
        if (gravouAuditoria) reavAuditadas[key] = true;
        state.atual = Object.assign({ _key: key }, payload);
        if (cb) cb(payload, key);
      }
      /* Reavaliação: a nova versão nasce COM a linha de auditoria "criada por
         reavaliação da vN", na MESMA gravação (nunca uma sem a outra). */
      function gravar(linhaReavaliacao) {
        if (respondido) return;
        if (!linhaReavaliacao) { ref.set(payload, function (err) { terminou(err, false); }); return; }
        var tudo = {};
        var chaveAud = NODE_CURADORIA_AUDITORIA + '/' + key;
        tudo[NODE + '/' + key] = payload;
        tudo[chaveAud + '/' + db().ref(chaveAud).push().key] = linhaReavaliacao;
        db().ref().update(tudo, function (err) { terminou(err, true); });
      }
      if (!a.versaoAnteriorKey || reavAuditadas[key]) {
        gravar(null);
      } else if (!jaTinhaChave) {
        gravar(linhaAuditoriaReavaliacao(a, key, agora));
      } else {
        /* A chave já existia (rascunho salvo antes, ou nova tentativa depois de uma
           gravação sem resposta): a auditoria só é gravada UMA vez — o banco recusa
           reescrever uma linha, então olha antes se ela já está lá. */
        db().ref(NODE_CURADORIA_AUDITORIA + '/' + key).once('value', function (snap) {
          var v = snap.val() || {};
          var existe = Object.keys(v).some(function (k) { return v[k] && v[k].reavaliacao; });
          if (existe) { reavAuditadas[key] = true; gravar(null); } else gravar(linhaAuditoriaReavaliacao(a, key, agora));
        }, function (err) { terminou(err, false); });
      }
    }
    function linhaAuditoriaReavaliacao(a, key, agora) {
      var base = state.reavaliacaoBase || buscarItem(a.versaoAnteriorKey) || {};
      var vAnterior = base.versao || ((a.versao || 2) - 1);
      return semUndefined({
        tipo: 'alteracao_decisao_final', avaliacaoId: key, avaliacaoNome: a.nome || null,
        valorAnterior: { decisaoFinal: decisaoFinalDe(base), decisaoManual: !!base.decisaoManual,
          justificativa: base.justificativaDecisao || null, confirmada: !!base.decisaoConfirmada },
        valorNovo: { decisaoFinal: null, decisaoManual: false, justificativa: null, confirmada: false, pendente: true },
        origem: 'usuario',
        reavaliacao: { deKey: a.versaoAnteriorKey, deVersao: vAnterior, paraVersao: a.versao || (vAnterior + 1) },
        usuario: sessaoAtual(), dataHora: agora
      });
    }
    /* Versão criada por reavaliação que ainda não teve decisão registrada: diz o que vale
       (a recomendação do sistema) e onde ficou a decisão manual anterior. */
    function avisoDecisaoPendenteReavaliacao(a) {
      var txt = textoDecisaoPendenteReavaliacao(a, state.itens);
      return txt ? '<p class="avp-decisao-aviso" id="avpDecisaoPendenteReav">' + esc(txt) + '</p>' : '';
    }

    /* ===================== RESULTADO ===================== */
    /* "Identificação": o que é o item e quem avaliou — dados do cadastro da
       avaliação, nada calculado. Campos vazios não ocupam linha. */
    /* <details> recolhíveis lembram se estavam abertos entre um render e outro (a tela se redesenha a cada clique). */
    function detAberto(id) { return state.detAbertos && state.detAbertos[id] ? ' open' : ''; }
    /* CABEÇALHO DO ITEM: qual item (nome), qual versão, quem/quando, as AÇÕES DO ITEM INTEIRO (Reavaliar e
       GERAR PDF) e uma faixa-resumo curta e só de leitura do estado vigente. A descrição, o público, a
       necessidade e as observações continuam na ficha, recolhidos em "Dados do item" — para não empurrar o
       Resultado para baixo. Os blocos abaixo são a fonte detalhada; a faixa não repete justificativa,
       formulário nem histórico. */
    function renderCabecalhoFicha(a, vigente) {
      var linhas = [];
      function linha(rotulo, valor) { if (valor) linhas.push('<dt>' + esc(rotulo) + '</dt><dd>' + esc(valor) + '</dd>'); }
      linha('Descrição', (a.descricao || '').trim());
      linha('Público/cliente relacionado', (a.publico || '').trim());
      linha('Necessidade que pretende atender', (a.necessidade || '').trim());
      linha('Observações', (a.observacoesGerais || '').trim());
      var meta = [];
      var quem = a.responsavel && (a.responsavel.name || a.responsavel.email);
      if (quem) meta.push('Avaliado por ' + quem);
      if (a.criadoEm) meta.push('iniciada em ' + fmtData(a.criadoEm));
      if (a.atualizadoEm) meta.push('última atualização ' + fmtData(a.atualizadoEm));
      var html = '<section class="avp-form-card avp-ficha-cabecalho" id="avpCabecalhoFicha">';
      html += '<div class="avp-identificacao-card avp-ficha-identificacao" id="avpIdentificacao">';
      html += '<h3 class="avp-ficha-nome">' + esc(a.nome) + ' <span class="avp-tag-versao">v' + (a.versao || 1) + '</span> ' +
        statusBadge(a.status) + (vigente ? '' : ' <span class="avp-tag-anterior">versão anterior</span>') + '</h3>';
      if (meta.length) html += '<p class="avp-ficha-meta">' + esc(meta.join(' · ')) + '</p>';
      if (linhas.length) {
        html += '<details class="avp-dados-item" data-det="dados"' + detAberto('dados') + '><summary>Dados do item</summary>' +
          '<dl class="avp-identificacao-lista">' + linhas.join('') + '</dl></details>';
      }
      html += '</div>';
      html += '<div class="avp-ficha-acoes" id="avpAcoesFicha">';
      if (pode() && vigente) html += '<button class="btn btn--sm" id="avpReavaliarBtn">Reavaliar</button>';
      if (pode()) {
        html += '<button class="btn btn--sm" id="avpGerarPdfBtn"' + (state.exportando ? ' disabled' : '') + '>' +
          (state.exportando === 'pdf' ? 'Gerando arquivo…' : '📄 GERAR PDF') + '</button>';
      }
      if (pode() && vigente) {
        html += '<p class="avp-reavaliar-texto">Reavaliar cria a versão v' + ((a.versao || 1) + 1) + '; esta avaliação continua guardada, sem alteração.</p>';
      }
      html += '</div>';
      if (state.flashExportacao) {
        html += '<p class="avp-export-status' + (state.flashExportacao.erro ? ' avp-export-status--erro' : '') + '">' + esc(state.flashExportacao.texto) + '</p>';
      }
      /* faixa-resumo: estado VIGENTE, só leitura */
      var txtCur = resumoCuradoria(a);
      html += '<dl class="avp-resumo-ficha" id="avpResumoFicha" aria-label="Resumo do estado vigente">';
      html += '<div><dt>Resultado</dt><dd>' + esc(rotuloResultado(a.resultadoAutomatico) || '—') + '</dd></div>';
      html += '<div><dt>Classificação</dt><dd>' + (a.camadaSugerida ? htmlNomeCamada(a.camadaSugerida) : '—') + '</dd></div>';
      html += '<div><dt>Decisão final</dt><dd>' + esc(rotuloDecisaoFinal(a) || '—') + (a.decisaoManual ? ' (manual)' : '') + '</dd></div>';
      html += '<div><dt>Curadoria</dt><dd>' + esc(txtCur) + '</dd></div>';
      html += '</dl>';
      html += '</section>';
      return html;
    }
    /* "Histórico de versões": v1, v2, v3… do mesmo item. A mais recente é a
       situação VIGENTE; as anteriores continuam guardadas, sem alteração, e se
       abrem aqui. */
    function renderHistoricoVersoes(a, cadeia) {
      if (cadeia.length < 2) return '';
      var vigenteKey = cadeia[cadeia.length - 1]._key;
      var html = '<div class="avp-form-card avp-hist-versoes" id="avpHistoricoVersoes">';
      /* recolhido por padrão (padrão único dos históricos), com o tamanho no cabeçalho */
      html += '<details class="avp-historico-recolhido avp-hist-versoes-det" id="avpHistoricoVersoesLista" data-det="histVersoes"' + detAberto('histVersoes') + '>' +
        '<summary>Histórico de versões — ' + cadeia.length + ' versões</summary>';
      html += '<p class="avp-natureza-ajuda">A mais recente é a situação vigente do item. As anteriores ficam guardadas sem alteração.</p>';
      html += '<ul class="avp-hist-lista">';
      cadeia.slice().reverse().forEach(function (v) {
        var camada = v.camadaSugerida && (v.camadaSugerida.id || v.camadaSugerida.label) ? v.camadaSugerida : null;
        var ehVigente = v._key === vigenteKey;
        var estaAberta = v._key === a._key;
        html += '<li class="avp-hist-item' + (estaAberta ? ' avp-hist-item--aberta' : '') + '" data-key="' + esc(v._key) + '">';
        html += '<div class="avp-hist-cab"><strong>v' + (v.versao || 1) + '</strong>' +
          (ehVigente ? ' <span class="avp-tag-vigente">vigente</span>' : '') + (estaAberta ? ' <span class="avp-tag-aberta">você está vendo</span>' : '') +
          ' <span class="avp-hist-data">' + fmtData(v.criadoEm || v.atualizadoEm) + '</span></div>';
        html += '<div class="avp-hist-corpo">' + esc(v.status === 'concluido' ? (rotuloDecisaoFinal(v) || '—') : 'Em andamento') +
          (camada && v.status === 'concluido' ? ' — ' + htmlNomeCamada(camada) + ' ' + htmlNaConclusao(camada, '(na conclusão: {})') : '') +
          ' · por ' + esc(v.responsavel && (v.responsavel.name || v.responsavel.email) || '—') + '</div>';
        if (!estaAberta) html += '<button type="button" class="btn btn--sm avp-hist-abrir" data-key="' + esc(v._key) + '">Abrir</button>';
        html += '</li>';
      });
      html += '</ul></details></div>';
      return html;
    }

    function renderResultado() {
      var a = state.atual;
      var cadeia = cadeiaDeVersoes(a);
      var vigente = cadeia[cadeia.length - 1]._key === a._key;
      var resultado = a.resultadoAutomatico;
      var cardClasse = resultado === 'produto' ? 'avp-result-card--produto' :
        (resultado === 'a-validar' ? 'avp-result-card--a-validar' : 'avp-result-card--nao-produto');
      /* nome atual da Taxonomia, que se atualiza sozinho (o caixa-alta é do CSS) */
      var badgeTexto = resultado === 'produto' ? 'É ' + htmlNomeCamada({ id: 'produto-principal' }) :
        (resultado === 'a-validar' ? htmlNomeCamada({ id: 'a-validar' }) : 'Não é ' + htmlNomeCamada({ id: 'produto-principal' }));
      var html = '<div class="avp-resultado">';
      html += '<button class="avp-voltar-link" id="avpVoltarListaResultado">' + esc(rotuloVoltar()) + '</button>';

      if (state.flashResultado) {
        html += '<div class="avp-flash-success" id="avpFlashResultado">' + esc(state.flashResultado) +
          ' <button type="button" class="avp-flash-close" id="avpFlashResultadoClose" aria-label="Fechar">×</button></div>';
      }

      if (!vigente) {
        var cabecaVigente = cadeia[cadeia.length - 1];
        html += '<div class="avp-form-card avp-aviso-anterior" id="avpAvisoVersaoAnterior"><p><strong>Você está vendo a versão v' + (a.versao || 1) + ', uma avaliação anterior deste item.</strong> ' +
          'Ela está guardada sem alteração, só para consulta. A situação vigente é a v' + (cabecaVigente.versao || 1) + '.</p>' +
          '<button type="button" class="btn btn--sm" id="avpAbrirVigente" data-key="' + esc(cabecaVigente._key) + '">Abrir a versão vigente (v' + (cabecaVigente.versao || 1) + ')</button></div>';
      }
      html += renderCabecalhoFicha(a, vigente);

      var camada = a.camadaSugerida || camadaPorId('a-validar');
      var editavel = podeDecidir() && vigente;

      /* 1 — O QUE O SISTEMA CONCLUIU: Resultado (a conclusão Produto/Serviço) e Classificação arquitetural
         (a camada) — dois conceitos, dois cartões, uma seção. Só o que o questionário/motor produziu. */
      html += '<section class="avp-secao" id="avpSecaoSistema">';
      html += '<h3 class="avp-secao-titulo">O que o sistema concluiu</h3>';
      html += '<div class="avp-result-card ' + cardClasse + '">';
      html += '<span class="avp-result-label">RESULTADO SOBRE PRODUTO/SERVIÇO</span>';
      html += '<div class="avp-result-badge-grande avp-result-badge-grande--resultado">' + badgeTexto + '</div>';
      html += '<p class="avp-result-secundario">Critérios favoráveis a Produto/Serviço: ' + a.criteriosAtendidos + ' de ' + CRITERIOS.length + '</p>';
      html += '</div>';

      /* Aviso discreto — nunca bloqueia a leitura do resultado, só oferece a
         ação; ver reprocessarMotor/precisaReprocessar. Só para avaliação
         concluída (rascunho não tem recomendação automática nenhuma ainda). */
      /* Reprocessar/reconciliar é governança da avaliação: só o gestor (o banco
         também recusa a gravação de quem é só avaliador). */
      if (pode() && vigente && precisaReprocessar(a)) {
        html += '<div class="avp-form-card avp-motor-aviso">';
        html += '<p class="avp-motor-aviso-texto">⚠ Esta avaliação foi processada por uma versão anterior do motor de classificação.</p>';
        html += '<button type="button" class="btn btn--sm" id="avpReprocessarBtn"' + (state.reprocessando ? ' disabled' : '') + '>' +
          (state.reprocessando ? 'Reprocessando…' : 'REPROCESSAR COM MOTOR ATUAL') + '</button>';
        html += '</div>';
      } else if (pode() && vigente && podeReconciliar(a)) {
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

      /* Classificação arquitetural — sempre mostrada, não só quando o resultado é "não é produto" (a camada
         é útil mesmo quando o item É o Produto/Serviço principal, e obrigatória quando a evidência é
         insuficiente/contraditória). Contém a Relação arquitetural, a Especialização IDENTIFICADA PELO
         QUESTIONÁRIO (derivada — não é curadoria) e, recolhido, o "por quê" do sistema. */
      html += '<div class="avp-form-card avp-alt-card">';
      html += '<h4>Classificação arquitetural</h4>';
      /* Nome ATUAL (Taxonomia Arquitetural, pelo código) — se atualiza sozinho; o nome registrado na
         conclusão aparece ao lado só quando difere; a definição é a vigente da Taxonomia. */
      html += '<p class="avp-alt-label">Camada identificada: <strong>' + htmlNomeCamada(camada, 'fa-classif', 'avpCamadaNome') + '</strong>' +
        (a.camadaSugerida ? ' ' + htmlNaConclusao(camada, 'na conclusão: {}', 'avpCamadaNaConclusao') : '') + '</p>';
      if (window.faClassificacoes && camada.id) html += window.faClassificacoes.definicaoHtml(camada.id, 'avpCamadaDefinicao');
      if (camada.id) html += htmlAvisoContingencia([camada.id], 'avpClassifContingencia');
      var espDerivadaTela = especializacaoDerivada(a);
      if (espDerivadaTela) html += '<p class="avp-alt-outras" id="avpEspecializacaoDerivada">Especialização identificada pelo questionário: <strong>' + esc(espDerivadaTela) + '</strong></p>';
      if (camada.conflitoNaturezas) {
        html += '<p class="avp-alt-outras" id="avpNaturezasIndicadas">' + esc(textoNaturezasIndicadas(camada.conflito)) + '.</p>';
      } else if (camada.conflito && camada.conflito.length) {
        html += '<p class="avp-alt-outras">Categorias em conflito nas respostas: ' + esc(camada.conflito.join(', ')) + '.</p>';
      }
      if (camada.incoerencia) {
        html += '<p class="avp-alt-outras avp-incoerencia-msg">⚠ Há respostas que indicam autonomia e outras que indicam dependência. Revise os critérios destacados.</p>';
      }
      if (camada.relacao) {
        html += '<div class="avp-relacao-card avp-alt-relacao"><h5>Relação arquitetural</h5><p>' + esc(camada.relacao) + '</p></div>';
      }
      html += '<details class="avp-por-que" id="avpPorQueDet" data-det="porque"' + detAberto('porque') + '><summary>Por que o sistema chegou a essa conclusão</summary>';
      html += '<h5>Justificativa da classificação</h5>';
      html += '<p>' + esc(a.justificativaAutomatica) + '</p>';
      if (camada.motivos && camada.motivos.length) {
        html += '<h5>Motivos</h5><ul class="avp-motivos-list">';
        camada.motivos.forEach(function (m) { html += '<li>' + esc(m) + '</li>'; });
        html += '</ul>';
      }
      html += '</details>';
      html += '</div>';
      html += '</section>';

      /* 2 — O QUE UMA PESSOA COMPLEMENTOU: Curadoria (só informação humana). */
      html += '<section class="avp-secao" id="avpSecaoCuradoria">';
      html += '<h3 class="avp-secao-titulo">O que uma pessoa complementou</h3>';
      html += renderCuradoriaCard(a, camada, editavel);
      html += '</section>';

      /* 3 — O QUE UMA PESSOA DECIDIU: Decisão final (age só sobre a conclusão Produto/Serviço). */
      html += '<section class="avp-secao" id="avpSecaoDecisao">';
      html += '<h3 class="avp-secao-titulo">O que uma pessoa decidiu</h3>';
      html += editavel ? renderDecisaoCard(a) : renderDecisaoSomenteLeitura(a);
      html += '</section>';

      /* 4 — COMO CHEGAMOS ATÉ AQUI: históricos e, por último, o questionário (a evidência). */
      html += '<section class="avp-secao" id="avpSecaoHistorico">';
      html += '<h3 class="avp-secao-titulo">Como chegamos até aqui</h3>';
      html += renderHistoricoVersoes(a, cadeia);
      html += renderHistoricosCuradoriaDecisao(a);
      if (pode()) html += renderHistoricoMotorCard(a);

      html += '<div class="avp-form-card" id="avpQuestionarioCard">';
      html += '<h4>Avaliação, pergunta por pergunta</h4>';
      html += '<p class="avp-natureza-ajuda"><strong>Sua justificativa</strong> é o que a pessoa que avaliou escreveu em cada resposta; ' +
        '<strong>Interpretação do sistema</strong> é o texto que o sistema gera a partir do SIM/NÃO marcado.</p>';
      var notaHistorica = notaTextoHistorico(a);
      if (notaHistorica) html += '<p class="avp-decisao-aviso avp-nota-texto-historico">' + esc(notaHistorica) + '</p>';
      html += '<div class="avp-reasoning-list">';
      html += '<p class="avp-reasoning-sep avp-reasoning-sep--primeiro">Critérios principais — perguntas 1 a ' + CRITERIOS.length + '</p>';
      CRITERIOS.forEach(function (c) { html += renderRaciocinio(c, a.respostas[c.id], a); });
      html += '<p class="avp-reasoning-sep">Testes de classificação — perguntas ' + (CRITERIOS.length + 1) + ' a ' + TODAS_PERGUNTAS.length + '</p>';
      EXCLUSOES.forEach(function (e) { html += renderRaciocinio(e, a.respostas[e.id], a); });
      html += '</div></div>';
      html += '</section>';

      /* Rodapé: só a navegação. Reavaliar e GERAR PDF são ações do item e ficam no cabeçalho. */
      html += '<div class="avp-actions-footer avp-result-actions-footer">';
      html += '<button class="btn" id="avpVoltarListaRodape">' + esc(rotuloVoltar()) + '</button>';
      html += '</div>';

      html += '</div>';
      wrap.innerHTML = html;

      wrap.querySelectorAll('details[data-det]').forEach(function (d) {
        d.addEventListener('toggle', function () { state.detAbertos[d.getAttribute('data-det')] = d.open; });
      });
      var flashResultadoClose = document.getElementById('avpFlashResultadoClose');
      if (flashResultadoClose) flashResultadoClose.addEventListener('click', function () { state.flashResultado = null; render(); });

      wrap.querySelectorAll('.avp-hist-abrir').forEach(function (btn) {
        btn.addEventListener('click', function () { abrirVisualizacao(btn.dataset.key); });
      });
      var abrirVigente = document.getElementById('avpAbrirVigente');
      if (abrirVigente) abrirVigente.addEventListener('click', function () { abrirVisualizacao(abrirVigente.dataset.key); });
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
      var confirmarEspBtn = document.getElementById('avpConfirmarEspecializacaoBtn');
      if (confirmarEspBtn) confirmarEspBtn.addEventListener('click', function () { confirmarCuradoriaAnterior('especializacao'); });
      var confirmarPapelBtn = document.getElementById('avpConfirmarPapelBtn');
      if (confirmarPapelBtn) confirmarPapelBtn.addEventListener('click', function () { confirmarCuradoriaAnterior('papelEstrutural'); });
      var flashEspecializacaoClose = document.getElementById('avpFlashEspecializacaoClose');
      if (flashEspecializacaoClose) flashEspecializacaoClose.addEventListener('click', function () { state.flashEspecializacao = null; render(); });

      var gerarPdfBtn = document.getElementById('avpGerarPdfBtn');
      if (gerarPdfBtn) gerarPdfBtn.addEventListener('click', function () {
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
        }, state.itens);
      });

      var reavaliarBtn = document.getElementById('avpReavaliarBtn');
      if (reavaliarBtn) reavaliarBtn.addEventListener('click', function () { pedirReavaliacao(a._key); });

      document.getElementById('avpVoltarListaResultado').addEventListener('click', voltar);
      document.getElementById('avpVoltarListaRodape').addEventListener('click', voltar);
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
      /* recolhido por padrão, com o tamanho no cabeçalho (padrão único dos históricos) */
      var html = '<details class="avp-form-card avp-historico-motor-card avp-historico-recolhido" id="avpHistoricoMotorDet" data-det="histMotor"' + detAberto('histMotor') + '>';
      html += '<summary>Recomendações automáticas anteriores (motor desatualizado) — ' + a.historicoMotor.length + '</summary>';
      html += '<p class="avp-decisao-aviso">Substituídas ao reprocessar esta avaliação com uma versão mais nova do motor — a resposta SIM/NÃO e a observação do avaliador em cada pergunta nunca mudam; só a interpretação automática do sistema pode ser atualizada.</p>';
      a.historicoMotor.slice().reverse().forEach(function (h) {
        var camadaAntiga = h.camadaSugerida;
        html += '<div class="avp-historico-motor-item">';
        html += '<p class="avp-historico-motor-data">Calculada em ' + fmtData(h.processadoEm) +
          (h.motorVersion ? ' · motor ' + esc(h.motorVersion) : ' · motor sem versão registrada') + '</p>';
        html += '<p>' + esc(rotuloResultado(h.resultadoAutomatico) || '—') +
          (camadaAntiga && (camadaAntiga.id || camadaAntiga.label) ? ' — ' + htmlNomeCamada(camadaAntiga) + ' ' + htmlNaConclusao(camadaAntiga, '(na conclusão: {})') : '') +
          (valorEspecializacao(camadaAntiga) ? ' (' + esc(valorEspecializacao(camadaAntiga)) + ')' : '') + '</p>';
        if (h.justificativaAutomatica) {
          html += '<p class="avp-historico-motor-justificativa">' + esc(h.justificativaAutomatica) + '</p>';
        }
        html += '</div>';
      });
      html += '</details>';
      return html;
    }

    /* Especialização CADASTRADA (curadoria: metadado registrado por uma pessoa;
       diferente da "identificada pelo questionário", derivada pelo motor e
       mostrada na Classificação arquitetural) — só faz sentido para camadas com eixo de especialização
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
      var html = '<div class="avp-curadoria-sub avp-especializacao-cadastro-card" id="avpEspecializacaoBloco">';
      html += '<h5>Especialização' + (papelAplicavel ? ' e papel estrutural' : '') + '</h5>';
      html += '<p class="avp-decisao-aviso">Informação opcional, registrada por uma pessoa (curadoria): o tipo específico deste item, ' +
        'quando já se souber por outra fonte (ex.: "Instituto previdenciário", "Benefício"). Não altera o resultado nem a classificação ' +
        'arquitetural: só os complementa. Não é a "Especialização identificada pelo questionário", que o sistema deriva sozinho e aparece em ' +
        'Classificação arquitetural — essa não é curadoria; ao registrar um valor aqui, ele passa a ser o exibido no lugar dela.</p>';
      html += '<p class="avp-natureza-ajuda" id="avpEspecializacaoAjuda">Aplica-se às classificações que admitem especialização (' +
        CAMADAS_COM_ESPECIALIZACAO.map(function (id) { return nomeClassificacao(id); }).join(', ') + ')' +
        (papelAplicavel ? '. O papel estrutural (essencial ou opcional) vale só para ' + nomeClassificacao('componente') + '.' : '. O papel estrutural vale só para ' + nomeClassificacao('componente') + ', e esta classificação não o usa.') + '</p>';
      html += '<div class="avp-field">';
      html += '<label for="avpEspecializacaoCadastrada">Especialização (opcional)</label>';
      html += '<input type="text" id="avpEspecializacaoCadastrada" value="' + esc(f.valor) + '" placeholder="Ex.: Instituto previdenciário">';
      html += '</div>';
      if (papelAplicavel) {
        html += '<div class="avp-field">';
        html += '<label for="avpPapelEstruturalCadastrado">Papel estrutural (opcional)</label>';
        html += '<select id="avpPapelEstruturalCadastrado">';
        html += '<option value=""' + (f.papel ? '' : ' selected') + '>Não informado</option>';
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
      html += '<button class="btn btn--primary avp-btn-decisao' + (estado.salva ? ' avp-btn-decisao--salva' : '') + '" id="avpSalvarEspecializacaoBtn"' +
        (estado.desabilitado ? ' disabled' : '') + '>' + esc(estado.label) + '</button>';
      html += '</div>';
      return html;
    }

    /* ===================== CURADORIA ARQUITETURAL =====================
       Bloco único que REÚNE o que a avaliação já tinha em lugares separados —
       Especialização, Papel estrutural (só Componente) e Natureza complementar —
       sem criar campo nem conceito novo e sem mexer na Classificação
       arquitetural (a camada, decidida pelo motor; só muda por reavaliação,
       reprocessamento ou nova versão do motor). A recomendação do sistema
       nunca é apagada nem substituída por nada daqui. Cada alteração grava
       uma linha de auditoria (valor anterior, novo, quem, quando) NA MESMA
       gravação: especialização/papel em curadoria-auditoria, natureza na
       auditoria própria que ela já tinha. */
    function renderCuradoriaCard(a, camada, editavel) {
      var html = '<div class="avp-form-card avp-curadoria-card' + (editavel ? '' : ' avp-curadoria-card--leitura') + '" id="' + (editavel ? 'avpCuradoriaCard' : 'avpCuradoriaLeitura') + '">';
      html += '<h4>Curadoria arquitetural</h4>';
      if (editavel) {
        html += '<p class="avp-decisao-aviso">Complementa a avaliação com informações opcionais do item. Não altera a recomendação do sistema nem a ' +
          'classificação arquitetural (a camada vem do motor). Cada alteração fica registrada: valor anterior, novo valor, quem e quando.</p>';
        html += renderCuradoriaRevisao(a, true);
        if (CAMADAS_COM_ESPECIALIZACAO.indexOf(camada.id) !== -1) html += renderEspecializacaoCadastradaCard(camada.id);
        html += renderNaturezaBloco(a);
        html += renderCuradoriaSemEfeito(a);
      } else {
        var nat = naturezaDoItem(a);
        var reg = curadoriaRegistrada(a);
        var esp = reg.especializacao, papel = reg.papelEstrutural;
        if (!esp && !papel && !nat) {
          html += '<p class="avp-natureza-ajuda">Nenhuma informação de curadoria registrada nesta versão.</p>';
        } else {
          html += '<dl class="avp-decisao-resumo" id="avpCuradoriaResumo">';
          if (esp) html += '<dt>Especialização</dt><dd>' + esc(esp) + '</dd>';
          if (papel) html += '<dt>Papel estrutural</dt><dd>' + esc(papel) + '</dd>';
          if (nat) html += '<dt>Natureza complementar</dt><dd>' + esc(nat.nome) + '</dd>';
          html += '</dl>';
        }
        html += renderCuradoriaRevisao(a, false);
        html += renderCuradoriaSemEfeito(a);
      }
      html += '</div>';
      return html;
    }

    /* Cadastro de curadoria que voltou a ser compatível com a classificação atual, mas foi
       confirmado para OUTRA (ou perdeu o vínculo): NÃO conta como vigente até alguém confirmar
       ou digitar um valor novo. Só informa; a confirmação é por campo e só em modo editável. */
    function renderCuradoriaRevisao(a, editavel) {
      var ant = curadoriaAnterior(a);
      var itens = [];
      if (ant.especializacao && ant.especializacao.situacao === 'a-revisar') itens.push({ rotulo: 'Especialização anterior', valor: ant.especializacao.rotulo, id: 'avpConfirmarEspecializacaoBtn', botao: 'Confirmar especialização' });
      if (ant.papelEstrutural && ant.papelEstrutural.situacao === 'a-revisar') itens.push({ rotulo: 'Papel estrutural anterior', valor: ant.papelEstrutural.rotulo, id: 'avpConfirmarPapelBtn', botao: 'Confirmar papel estrutural' });
      if (!itens.length) return '';
      var html = '<div class="avp-curadoria-aviso avp-curadoria-revisao" id="avpCuradoriaRevisao">';
      html += '<h5>Curadoria anterior disponível para revisão</h5>';
      html += '<p class="avp-natureza-ajuda">Este valor foi cadastrado anteriormente e voltou a ser compatível com a classificação atual. Confirme se ele continua válido para esta classificação.</p>';
      itens.forEach(function (i) {
        html += '<div class="avp-curadoria-aviso-linha"><p>' + esc(i.rotulo) + ': <strong>' + esc(i.valor) + '</strong></p>';
        if (editavel) html += '<button type="button" class="btn btn--sm" id="' + i.id + '"' + (state.salvandoEspecializacao ? ' disabled' : '') + '>' + esc(i.botao) + '</button>';
        html += '</div>';
      });
      if (editavel) html += '<p class="avp-natureza-ajuda">Para usar outro valor em vez deste, preencha o campo correspondente abaixo e salve.</p>';
      html += '</div>';
      return html;
    }
    /* Cadastro de curadoria que a classificação atual NÃO admite: continua gravado, nunca conta
       como curadoria vigente, e aparece só aqui — informativo, sem ação, visualmente secundário. */
    function renderCuradoriaSemEfeito(a) {
      var ant = curadoriaAnterior(a);
      var itens = [];
      if (ant.especializacao && ant.especializacao.situacao === 'sem-efeito') itens.push({ rotulo: 'Especialização anteriormente cadastrada', valor: ant.especializacao.rotulo });
      if (ant.papelEstrutural && ant.papelEstrutural.situacao === 'sem-efeito') itens.push({ rotulo: 'Papel estrutural anteriormente cadastrado', valor: ant.papelEstrutural.rotulo });
      if (!itens.length) return '';
      var html = '<div class="avp-curadoria-aviso avp-curadoria-sem-efeito" id="avpCuradoriaSemEfeito">';
      html += '<h5>Curadoria anterior sem efeito nesta classificação</h5>';
      html += '<p class="avp-natureza-ajuda">Existe informação de curadoria registrada anteriormente que não se aplica à classificação arquitetural atual. O valor permanece preservado no histórico, mas não conta como curadoria vigente.</p>';
      itens.forEach(function (i) {
        html += '<p class="avp-curadoria-aviso-item">' + esc(i.rotulo) + ': <strong>' + esc(i.valor) + '</strong><br>' +
          '<span class="avp-natureza-ajuda">A classificação atual “' + esc(ant.camada) + '” não admite este campo.</span></p>';
      });
      html += '</div>';
      return html;
    }

    /* Histórico da curadoria e da decisão: lê as duas auditorias desta avaliação
       (curadoria-auditoria e a da natureza), junta e ordena. Só vale a partir
       da introdução da auditoria — nada anterior é reconstruído. A leitura é
       informativa e nunca trava a tela (rede lenta: "Carregando…"). */
    /* `daDecisao` true → só as linhas da Decisão final; false → só as da Curadoria (especialização, papel, natureza). */
    function linhasHistoricoCuradoria(daDecisao) {
      var h = state.curadoriaHist;
      if (!h) return '';
      if (h.erro) return '<p class="avp-natureza-ajuda">Não foi possível carregar o histórico agora.</p>';
      if (h.carregando) return '<p class="loading-msg">Carregando histórico…</p>';
      var itens = h.itens.filter(function (e) { return (e.tipo === 'alteracao_decisao_final') === !!daDecisao; });
      if (!itens.length) return '<p class="avp-natureza-ajuda">Nenhuma alteração registrada ainda. O histórico vale a partir desta funcionalidade; alterações anteriores não foram registradas.</p>';
      return itens.map(function (e) {
        var d = descreverLinhaAuditoria(e);
        return '<div class="avp-aut-hist"><strong>' + esc(d.titulo) + '</strong>: ' + esc(d.valores) +
          '<br><span class="avp-usuario-aviso">' + esc(d.origem) + ' em ' + esc(fmtData(e.dataHora)) + (d.detalhe ? esc(' · ' + d.detalhe) : '') + '</span></div>';
      }).join('');
    }
    /* Históricos da seção "Como chegamos até aqui": o da CURADORIA (especialização, papel, natureza) e o da
       DECISÃO FINAL são listas separadas — o histórico não pertence à Curadoria atual nem à Decisão atual. */
    /* "— N alterações" no cabeçalho (padrão único dos históricos); vazio enquanto carrega. */
    function contagemHistoricoCuradoria(daDecisao) {
      var h = state.curadoriaHist;
      if (!h || h.carregando) return ' — carregando…';
      if (h.erro) return ' — não foi possível carregar';
      var n = h.itens.filter(function (e) { return (e.tipo === 'alteracao_decisao_final') === !!daDecisao; }).length;
      return ' — ' + n + (n === 1 ? ' alteração' : ' alterações');
    }
    function renderHistoricosCuradoriaDecisao(a) {
      if (!state.curadoriaHist || state.curadoriaHist.chave !== a._key) carregarHistoricoCuradoria(a);
      return '<details class="avp-form-card avp-aut-historico" id="avpCuradoriaHistoricoDet" data-det="histCuradoria"' + detAberto('histCuradoria') + '><summary>Histórico da Curadoria<span id="avpCuradoriaHistoricoN">' + contagemHistoricoCuradoria(false) + '</span></summary>' +
        '<div id="avpCuradoriaHistorico">' + linhasHistoricoCuradoria(false) + '</div></details>' +
        '<details class="avp-form-card avp-aut-historico" id="avpDecisaoHistoricoDet" data-det="histDecisao"' + detAberto('histDecisao') + '><summary>Histórico da Decisão final<span id="avpDecisaoHistoricoN">' + contagemHistoricoCuradoria(true) + '</span></summary>' +
        '<div id="avpDecisaoHistorico">' + linhasHistoricoCuradoria(true) + '</div></details>';
    }
    function atualizarHistoricoCuradoria() {
      var el = document.getElementById('avpCuradoriaHistorico');
      if (el) el.innerHTML = linhasHistoricoCuradoria(false);
      var ed = document.getElementById('avpDecisaoHistorico');
      if (ed) ed.innerHTML = linhasHistoricoCuradoria(true);
      var nc = document.getElementById('avpCuradoriaHistoricoN');
      if (nc) nc.textContent = contagemHistoricoCuradoria(false);
      var nd = document.getElementById('avpDecisaoHistoricoN');
      if (nd) nd.textContent = contagemHistoricoCuradoria(true);
    }
    function carregarHistoricoCuradoria(a) {
      var chave = a._key;
      var h = state.curadoriaHist = { chave: chave, carregando: true, erro: false, itens: [] };
      var pend = 2, lidos = [];
      function fim() {
        if (--pend > 0) return;
        if (state.curadoriaHist !== h) return;
        h.carregando = false;
        h.itens = lidos.concat(h.itens).sort(function (x, y) { return String(y.dataHora || '').localeCompare(String(x.dataHora || '')); });
        atualizarHistoricoCuradoria();
      }
      function ler(no) {
        db().ref(no + '/' + chave).once('value', function (snap) {
          var v = snap.val() || {};
          Object.keys(v).forEach(function (k) { lidos.push(Object.assign({ _key: k }, v[k])); });
          fim();
        }, function (err) {
          console.error('[avaliacao-produto] erro ao ler histórico da curadoria:', err);
          h.erro = true;
          fim();
        });
      }
      ler(NODE_CURADORIA_AUDITORIA);
      ler(window.faNaturezas.NODE_AUDITORIA);
    }
    /* Linha de auditoria nova, para gravar junto com a alteração (mesmo update). */
    function linhaAuditoriaCuradoria(a, tipo, anterior, novo, extra) {
      return Object.assign({
        tipo: tipo, avaliacaoId: a._key, avaliacaoNome: a.nome || null,
        valorAnterior: anterior === undefined ? null : anterior, valorNovo: novo === undefined ? null : novo,
        usuario: sessaoAtual(), dataHora: new Date().toISOString()
      }, extra || {});
    }
    function adicionarAoHistoricoLocal(linhas) {
      var h = state.curadoriaHist;
      if (!h || h.carregando) return;
      h.itens = linhas.concat(h.itens);
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
      /* O rótulo diz o que o botão REALMENTE salva: Especialização, e também o Papel quando a camada o admite. */
      var escopo = papelAplicavel ? 'ESPECIALIZAÇÃO E PAPEL' : 'ESPECIALIZAÇÃO';
      if (dirty) return { label: 'SALVAR ' + escopo, desabilitado: false, salva: false };
      var jaSalvouAlgo = !!f.ultimoSalvo || (papelAplicavel && !!f.papelUltimoSalvo);
      return { label: jaSalvouAlgo ? (papelAplicavel ? '✓ ESPECIALIZAÇÃO E PAPEL SALVOS' : '✓ ESPECIALIZAÇÃO SALVA') : 'SALVAR ' + escopo, desabilitado: true, salva: jaSalvouAlgo };
    }

    /* Mesmo registro do card de decisão, sem formulário (versões anteriores):
       Recomendação do sistema, Decisão final e a forma da decisão. */
    function renderDecisaoSomenteLeitura(a) {
      var html = '<div class="avp-form-card avp-decisao-card avp-decisao-card--leitura" id="avpDecisaoLeitura">';
      html += '<h4>Decisão final</h4>';
      html += '<dl class="avp-decisao-resumo" id="avpDecisaoResumo">';
      html += '<dt>Recomendação do sistema</dt><dd>' + esc(rotuloResultado(a.resultadoAutomatico) || '—') + '</dd>';
      html += '<dt>Decisão final</dt><dd>' + esc(rotuloDecisaoFinal(a) || '—') + '</dd>';
      html += '<dt>Forma da decisão</dt><dd>' + esc(formaDaDecisao(a)) + '</dd>';
      html += '</dl>';
      html += avisoDecisaoPendenteReavaliacao(a);
      if (a.decisaoManual) {
        html += '<p class="avp-history-note">Alterado manualmente por <strong>' + esc(a.alteradoPor && a.alteradoPor.name || '—') +
          '</strong> em ' + fmtData(a.alteradoEm) + '. Justificativa registrada: "' + esc(a.justificativaDecisao || '') + '"</p>';
      }
      html += '</div>';
      return html;
    }

    function renderDecisaoCard(a) {
      var f = state.decisaoForm;
      var html = '<div class="avp-form-card avp-decisao-card">';
      html += '<h4>Decisão final</h4>';
      html += '<p class="avp-decisao-aviso">Decisão sobre a CONCLUSÃO Produto/Serviço. Não altera respostas, resultado automático, classificação arquitetural nem Curadoria. ' +
        'Para mudar respostas, use "Reavaliar" (nas ações do item, no topo).</p>';
      /* A recomendação do sistema, a decisão final e a forma da decisão ficam
         SEPARADAS e sempre visíveis — a recomendação original nunca é escondida
         nem substituída pela decisão, e a curadoria (bloco acima) nunca se
         confunde com a classificação. */
      html += '<dl class="avp-decisao-resumo" id="avpDecisaoResumo">';
      html += '<dt>Recomendação do sistema</dt><dd>' + esc(rotuloResultado(a.resultadoAutomatico) || '—') + '</dd>';
      html += '<dt>Decisão final</dt><dd>' + esc(rotuloDecisaoFinal(a) || '—') + '</dd>';
      html += '<dt>Forma da decisão</dt><dd>' + esc(formaDaDecisao(a)) + '</dd>';
      html += '</dl>';
      html += avisoDecisaoPendenteReavaliacao(a);
      if (a.decisaoManual) {
        html += '<p class="avp-history-note">Alterado manualmente por <strong>' + esc(a.alteradoPor && a.alteradoPor.name || '—') +
          '</strong> em ' + fmtData(a.alteradoEm) + '. Justificativa registrada: "' + esc(a.justificativaDecisao || '') + '"</p>';
      }
      html += '<div class="avp-decisao-options">';
      html += decisaoOpcao('auto', 'Aceitar recomendação do sistema (' + (rotuloResultado(a.resultadoAutomatico) || '—') + ')', f.opcao);
      html += decisaoOpcao('produto', 'Classificar manualmente como ' + nomeClassificacao('produto-principal'), f.opcao);
      html += decisaoOpcao('nao-produto', 'Classificar manualmente como não ' + nomeClassificacao('produto-principal'), f.opcao);
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
      /* Só descreve o que o código faz (ver salvarDecisao): a decisão manual tem exatamente estas duas
         saídas e exige justificativa; grava só a decisão final. Recolhida e DEPOIS do botão, para o
         botão ficar junto do formulário que controla. */
      html += '<details class="avp-ajuda-det" id="avpDecisaoAjuda" data-det="ajudaDecisao"' + detAberto('ajudaDecisao') + '><summary>Como funciona a decisão</summary>' +
        '<p class="avp-natureza-ajuda">Use quando concordar ou discordar do resultado calculado. A decisão manual tem duas possibilidades — ' +
        esc(nomeClassificacao('produto-principal')) + ' ou não ' + esc(nomeClassificacao('produto-principal')) + ' — e exige justificativa. Aceitar a recomendação mantém o resultado calculado pelo sistema (inclusive "A validar"). ' +
        'Em qualquer caso só a decisão final é registrada: respostas, classificação arquitetural, resultado automático e Curadoria não mudam.</p></details>';
      html += '</div>';
      return html;
    }

    /* ===================== NATUREZA COMPLEMENTAR =====================
       Bloco dentro da "Curadoria arquitetural": tem o seu próprio
       botão e o seu próprio salvamento, independente da decisão (existe com a
       recomendação aceita ou com decisão manual) e independente do motor —
       salvar aqui grava só os campos naturezaComplementar* da avaliação e uma
       linha de auditoria, nunca respostas, classificação, motorVersion nem
       atualizadoEm. Disponível também numa avaliação já concluída: alterar a
       natureza não exige reavaliar, reprocessar nem criar nova avaliação. */
    function naturezaFormDe(a) {
      var f = state.naturezaForm;
      if (f && f.chave === a._key) return f;
      var atual = naturezaDoItem(a);
      var cod = atual && atual.codigo ? atual.codigo : '';
      state.naturezaForm = { chave: a._key, codigo: cod, ultimoSalvo: cod, erro: null };
      return state.naturezaForm;
    }
    function estadoBotaoNatureza(f, catalogo) {
      if (state.salvandoNatureza) return { label: 'SALVANDO…', desabilitado: true, salva: false };
      if (catalogo !== 'ok') return { label: 'SALVAR NATUREZA', desabilitado: true, salva: false };
      if ((f.codigo || '') !== (f.ultimoSalvo || '')) return { label: 'SALVAR NATUREZA', desabilitado: false, salva: false };
      return { label: f.ultimoSalvo ? '✓ NATUREZA SALVA' : 'SALVAR NATUREZA', desabilitado: true, salva: !!f.ultimoSalvo };
    }
    function renderNaturezaBloco(a) {
      var f = naturezaFormDe(a);
      var catalogo = window.faNaturezas.estado();
      var atual = naturezaDoItem(a);
      var opcoes = window.faNaturezas.opcoesParaSelecao(atual && atual.codigo);
      /* Natureza registrada no formato antigo, cujo código já não existe no
         catálogo (ex.: 'programa'): continua aparecendo no seletor, pelo nome
         da época, para não parecer que a avaliação ficou sem natureza. */
      if (atual && atual.codigo && !opcoes.some(function (o) { return o.codigoEstavel === atual.codigo; })) {
        opcoes = opcoes.concat([{ codigoEstavel: atual.codigo, nome: atual.nome, descricao: atual.descricao }]);
      }
      var escolhida = f.codigo ? opcoes.filter(function (o) { return o.codigoEstavel === f.codigo; })[0] : null;
      var html = '<div class="avp-natureza-bloco avp-curadoria-sub" id="avpNaturezaBloco">';
      html += '<h5>Natureza complementar</h5>';
      html += '<div class="avp-field">';
      html += '<label for="avpNaturezaComplementar">Natureza complementar <span class="avp-config-readonly-tag">(opcional)</span></label>';
      html += '<p class="avp-natureza-ajuda">Descrição adicional do item. Não altera respostas, classificação, camada, motor nem exige reprocessamento — pode ser mudada a qualquer momento.</p>';
      html += '<select class="avp-select" id="avpNaturezaComplementar"' + (catalogo !== 'ok' || state.salvandoNatureza ? ' disabled' : '') + '>';
      html += '<option value=""' + (!f.codigo ? ' selected' : '') + '>' + (catalogo === 'carregando' ? 'Carregando opções…' : 'Nenhuma') + '</option>';
      opcoes.forEach(function (o) {
        html += '<option value="' + esc(o.codigoEstavel) + '"' + (f.codigo === o.codigoEstavel ? ' selected' : '') + '>' + esc(o.nome) + '</option>';
      });
      html += '</select>';
      if (escolhida && escolhida.descricao) html += '<p class="avp-natureza-descricao" id="avpNaturezaDescricao">' + esc(escolhida.descricao) + '</p>';
      html += '</div>';
      html += avisoCatalogoNaturezas('avpNaturezaTentarNovamente');
      if (atual) {
        html += '<p class="avp-history-note" id="avpNaturezaRegistro">Registrada: <strong>' + esc(atual.nome) + '</strong>' +
          (atual.definidaPor ? ' por ' + esc(atual.definidaPor.name || atual.definidaPor.email || '—') : '') +
          (atual.definidaEm ? ' em ' + fmtData(atual.definidaEm) : '') + '.</p>';
      }
      if (f.erro) html += '<p class="avp-error-msg">' + esc(f.erro) + '</p>';
      if (state.flashNatureza) {
        html += '<p class="avp-flash-success avp-flash-success--inline" id="avpFlashNatureza">' + esc(state.flashNatureza) +
          ' <button type="button" class="avp-flash-close" id="avpFlashNaturezaClose" aria-label="Fechar">×</button></p>';
      }
      var estado = estadoBotaoNatureza(f, catalogo);
      html += '<button class="btn btn--primary avp-btn-decisao' + (estado.salva ? ' avp-btn-decisao--salva' : '') + '" id="avpSalvarNaturezaBtn"' +
        (estado.desabilitado ? ' disabled' : '') + '>' + esc(estado.label) + '</button>';
      html += '</div>';
      return html;
    }
    function bindNaturezaBloco() {
      var sel = document.getElementById('avpNaturezaComplementar');
      if (sel) sel.addEventListener('change', function () {
        if (state.salvandoNatureza || !state.naturezaForm) return;
        state.naturezaForm.codigo = sel.value;
        state.naturezaForm.erro = null;
        state.flashNatureza = null;
        render();
      });
      var btn = document.getElementById('avpSalvarNaturezaBtn');
      if (btn) btn.addEventListener('click', salvarNatureza);
      var fechar = document.getElementById('avpFlashNaturezaClose');
      if (fechar) fechar.addEventListener('click', function () { state.flashNatureza = null; render(); });
      var tentar = document.getElementById('avpNaturezaTentarNovamente');
      if (tentar) tentar.addEventListener('click', function () { window.faNaturezas.recarregar(); });
    }
    /* Salvamentos da natureza, por avaliação. Cada envio ganha um número (ultima); `pendente` é o
       envio mais recente que ainda não teve resposta. Regras:
       - resposta antiga nunca vence a nova: só o envio mais recente mexe na tela (valor, "salvo",
         aviso); a resposta de um envio anterior, mesmo chegando depois, só registra a linha de
         auditoria dela no histórico local;
       - confirmação atrasada (depois do relógio de 12 s) não é descartada: se ainda for o envio
         mais recente, a tela passa a mostrar o valor como salvo;
       - o "valor anterior" da auditoria segue a ordem em que o Firebase aplica as gravações de um
         mesmo cliente: com um envio ainda sem resposta, o anterior real é o valor desse envio;
       - o MESMO valor de um envio ainda sem resposta não é enviado de novo (seria uma segunda linha
         de auditoria para uma mudança só). */
    var operacoesNatureza = {};
    var epocaSessao = 0;
    function salvarNatureza() {
      if (!podeDecidir()) return; /* curadoria/decisão: só Arquitetura (a tela nem mostra; o banco também recusa) */
      if (state.salvandoNatureza) return; /* clique repetido enquanto já está salvando: ignora */
      var a = state.atual;
      var f = state.naturezaForm;
      if (!a || !f || !a._key) return;
      if (estadoBotaoNatureza(f, window.faNaturezas.estado()).desabilitado) return;
      var chave = a._key;
      var ops = operacoesNatureza[chave] = operacoesNatureza[chave] || { ultima: 0, pendente: null };
      var registrado = naturezaDoItem(a);
      var anterior = ops.pendente ? ops.pendente.valor : (registrado ? { codigo: registrado.codigo || null, nome: registrado.nome } : null);
      var codigoNovo = f.codigo || '';
      if (ops.pendente && ((ops.pendente.valor && ops.pendente.valor.codigo) || '') === codigoNovo) {
        f.erro = 'Este mesmo valor ainda aguarda a confirmação do salvamento anterior. A tela avisa quando ela chegar.';
        render();
        return;
      }
      var opcao = null;
      if (codigoNovo) {
        opcao = window.faNaturezas.porCodigo(codigoNovo);
        if (!opcao && registrado && registrado.codigo === codigoNovo) opcao = { codigoEstavel: registrado.codigo, nome: registrado.nome, descricao: registrado.descricao };
        if (!opcao) { f.erro = 'Essa opção não existe mais no catálogo. Escolha outra.'; render(); return; }
      }
      var sess = sessaoAtual();
      var agora = new Date().toISOString();
      var campos = {
        naturezaComplementarCodigo: opcao ? opcao.codigoEstavel : null,
        naturezaComplementarNomeNaEpoca: opcao ? opcao.nome : null,
        naturezaComplementarDescricaoNaEpoca: opcao && opcao.descricao ? opcao.descricao : null,
        naturezaComplementarDefinidaPor: opcao ? sess : null,
        naturezaComplementarDefinidaEm: opcao ? agora : null
      };
      /* UMA gravação atômica: os campos da natureza + a linha de auditoria.
         Nunca motorVersion, respostas, classificação nem atualizadoEm; o campo
         do formato antigo (naturezaComplementar) é limpo para não sobrar dois
         valores. A avaliação e a auditoria nunca divergem: ou gravam as duas
         coisas, ou nenhuma. */
      var updates = {};
      Object.keys(campos).forEach(function (k) { updates[NODE + '/' + chave + '/' + k] = campos[k]; });
      updates[NODE + '/' + chave + '/naturezaComplementar'] = null;
      var chaveAud = window.faNaturezas.NODE_AUDITORIA + '/' + chave;
      var valorNovo = opcao ? { codigo: opcao.codigoEstavel, nome: opcao.nome } : null;
      var linhaNatureza = {
        tipo: 'alteracao_natureza_complementar',
        avaliacaoId: chave, avaliacaoNome: a.nome || null,
        valorAnterior: anterior,
        valorNovo: valorNovo,
        usuario: sess, dataHora: agora
      };
      updates[chaveAud + '/' + db().ref(chaveAud).push().key] = linhaNatureza;
      var meu = ++ops.ultima, epoca = epocaSessao;
      ops.pendente = { seq: meu, valor: valorNovo };
      f.erro = null;
      state.salvandoNatureza = true;
      render();

      var atrasou = false;
      var relogio = setTimeout(function () {
        if (epoca !== epocaSessao || meu !== ops.ultima || !ops.pendente || ops.pendente.seq !== meu) return;
        atrasou = true;
        state.salvandoNatureza = false;
        if (state.naturezaForm === f) f.erro = 'A conexão está demorando e ainda não deu para confirmar o salvamento. Ele continua pendente: a tela avisa quando a confirmação chegar.';
        render();
      }, 12000);
      function aoResponder(err) {
        clearTimeout(relogio);
        if (epoca !== epocaSessao) return; /* outra pessoa entrou depois do envio */
        if (ops.pendente && ops.pendente.seq === meu) ops.pendente = null;
        var maisRecente = meu === ops.ultima;
        if (err) {
          console.error('[avaliacao-produto] erro ao salvar natureza complementar:', err);
          if (!maisRecente) return; /* um envio mais novo já cuida da tela */
          state.salvandoNatureza = false;
          if (state.naturezaForm === f) f.erro = 'Não foi possível salvar a natureza complementar. Tente novamente.';
          render();
          return;
        }
        adicionarAoHistoricoLocal([linhaNatureza]); /* a linha existe no banco, seja qual for o envio */
        if (!maisRecente) { render(); return; }    /* resposta antiga: nunca restaura o valor anterior */
        state.salvandoNatureza = false;
        Object.assign(a, campos);
        a.naturezaComplementar = null;
        state.itens = upsertItem(state.itens, clonarItem(a));
        if (state.naturezaForm === f) {
          f.ultimoSalvo = codigoNovo;
          f.erro = null;
          state.flashNatureza = (codigoNovo ? '✓ Natureza complementar salva com sucesso.' : '✓ Natureza complementar removida.') +
            (atrasou ? ' (A confirmação chegou com atraso.)' : '');
        }
        render();
      }
      try {
        db().ref().update(updates, aoResponder);
      } catch (e) {
        aoResponder(e);
      }
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
      if (dirty) return { label: 'SALVAR DECISÃO', desabilitado: false, salva: false };
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
      bindNaturezaBloco();
      var flashDecisaoClose = document.getElementById('avpFlashDecisaoClose');
      if (flashDecisaoClose) flashDecisaoClose.addEventListener('click', function () { state.flashDecisao = null; render(); });
    }
    function salvarDecisao() {
      if (!podeDecidir()) return; /* curadoria/decisão: só Arquitetura (a tela nem mostra; o banco também recusa) */
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
      var decisaoAnterior = { decisaoFinal: decisaoFinalDe(a), decisaoManual: !!a.decisaoManual,
        justificativa: a.justificativaDecisao || null, confirmada: !!a.decisaoConfirmada };
      var updates = { atualizadoEm: new Date().toISOString(), decisaoConfirmada: true };
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

      /* UMA gravação atômica: a decisão + a linha de histórico (decisão anterior,
         nova, quem, quando). Nunca uma sem a outra. O histórico começa aqui:
         decisões anteriores a esta funcionalidade nunca foram registradas e não
         são reconstruídas. */
      var decisaoNova = { decisaoFinal: updates.decisaoFinal, decisaoManual: !!updates.decisaoManual,
        justificativa: updates.justificativaDecisao || null, confirmada: true };
      var linhaDecisao = linhaAuditoriaCuradoria(a, 'alteracao_decisao_final', decisaoAnterior, decisaoNova,
        Object.assign({ origem: 'usuario' }, updates.decisaoManual ? { justificativa: updates.justificativaDecisao } : null));
      var chaveAudDec = NODE_CURADORIA_AUDITORIA + '/' + a._key;
      var tudoDecisao = {};
      Object.keys(updates).forEach(function (k) { tudoDecisao[NODE + '/' + a._key + '/' + k] = updates[k]; });
      tudoDecisao[chaveAudDec + '/' + db().ref(chaveAudDec).push().key] = linhaDecisao;
      db().ref().update(tudoDecisao, function (err) {
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
        adicionarAoHistoricoLocal([linhaDecisao]);
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
      if (!podeDecidir()) return; /* curadoria/decisão: só Arquitetura (a tela nem mostra; o banco também recusa) */
      if (state.salvandoEspecializacao) return;
      var a = state.atual;
      var f = state.especializacaoForm;
      var camadaId = camadaDoItem(a);
      var papelAplicavel = admitePapelEstrutural(camadaId);
      if (estadoBotaoEspecializacao(f, papelAplicavel).desabilitado) return;
      var valor = (f.valor || '').trim();
      var papel = papelAplicavel ? (f.papel || '') : '';
      var dirtyEsp = valor !== (f.ultimoSalvo || '').trim();
      var dirtyPapel = papelAplicavel && papel !== (f.papelUltimoSalvo || '');
      var vigente = curadoriaRegistrada(a);
      var camadaInfo = { id: camadaId, label: rotuloCamadaAtual(a.camadaSugerida) || camadaId };
      /* SÓ o que foi editado é gravado: salvar a Especialização nunca toca no Papel (nem o
         contrário), mesmo que o outro tenha um cadastro sem efeito ou a revisar — antes, numa
         camada sem Papel, isso apagava o papel antigo em silêncio. Cada valor gravado já nasce
         vinculado à camada atual (é uma decisão humana para esta classificação). */
      var campos = {};
      var linhas = [];
      if (dirtyEsp) {
        var espAnterior = vigente.especializacao || null;
        var espSemEfeito = especializacaoCadastradaDe(a);
        campos.especializacaoCadastrada = valor || null;
        campos.especializacaoCamadaConfirmada = valor ? camadaId : null;
        if (espAnterior !== (valor || null)) {
          linhas.push(linhaAuditoriaCuradoria(a, 'alteracao_especializacao', espAnterior, valor || null,
            Object.assign({ camada: camadaInfo }, !espAnterior && espSemEfeito && espSemEfeito !== valor ? { valorSemEfeitoSubstituido: espSemEfeito } : null)));
        }
      }
      if (dirtyPapel) {
        var papelAnterior = vigente.papelEstruturalValor || null;
        var papelSemEfeito = papelCadastrado(a);
        campos.papelEstruturalCadastrado = papel || null;
        campos.papelEstruturalCamadaConfirmada = papel ? camadaId : null;
        if (papelAnterior !== (papel || null)) {
          linhas.push(linhaAuditoriaCuradoria(a, 'alteracao_papel_estrutural', papelAnterior, papel || null,
            Object.assign({ camada: camadaInfo }, !papelAnterior && papelSemEfeito && papelSemEfeito !== papel ? { valorSemEfeitoSubstituido: papelSemEfeito } : null)));
        }
      }
      gravarCuradoriaCadastro(campos, linhas, '✓ Especialização salva com sucesso.', 'Não foi possível salvar a especialização. Tente novamente.');
    }

    /* Confirmação HUMANA de um cadastro anterior que voltou a ser compatível com a classificação
       atual ('especializacao' | 'papelEstrutural'): o valor não muda — só passa a estar vinculado
       à camada vigente, e por isso volta a contar. Usa a trilha da curadoria (mesmo tipo do
       campo: o valor VIGENTE passa de "nenhum" para o valor), marcada como confirmação. */
    function confirmarCuradoriaAnterior(campo) {
      if (!podeDecidir()) return; /* curadoria/decisão: só Arquitetura (a tela nem mostra; o banco também recusa) */
      if (state.salvandoEspecializacao) return;
      var a = state.atual;
      var ant = curadoriaAnterior(a)[campo];
      var camadaId = camadaDoItem(a);
      if (!ant || ant.situacao !== 'a-revisar' || !camadaId) return;
      var ehEsp = campo === 'especializacao';
      var campos = {};
      campos[ehEsp ? 'especializacaoCamadaConfirmada' : 'papelEstruturalCamadaConfirmada'] = camadaId;
      var linha = linhaAuditoriaCuradoria(a, ehEsp ? 'alteracao_especializacao' : 'alteracao_papel_estrutural', null, ant.valor,
        { camada: { id: camadaId, label: rotuloCamadaAtual(a.camadaSugerida) || camadaId }, confirmacao: true });
      gravarCuradoriaCadastro(campos, [linha],
        ehEsp ? '✓ Especialização confirmada para esta classificação.' : '✓ Papel estrutural confirmado para esta classificação.',
        'Não foi possível confirmar. Tente novamente.');
    }

    /* UMA gravação atômica: campos de curadoria + camadaSugerida recalculada + linhas de auditoria.
       Nunca resultadoAutomatico, motivos, justificativaAutomatica ou decisão. */
    function gravarCuradoriaCadastro(campos, linhas, mensagemOk, mensagemErro) {
      var a = state.atual;
      var f = state.especializacaoForm;
      var ident = identificarCamada(Object.assign({}, a, campos));
      var updates = Object.assign({}, campos, {
        'camadaSugerida/especializacao': ident.especializacao,
        'camadaSugerida/papelEstrutural': ident.papelEstrutural,
        atualizadoEm: new Date().toISOString()
      });
      var tudoEsp = {};
      Object.keys(updates).forEach(function (k) { tudoEsp[NODE + '/' + a._key + '/' + k] = updates[k]; });
      var chaveAudEsp = NODE_CURADORIA_AUDITORIA + '/' + a._key;
      linhas.forEach(function (l) { tudoEsp[chaveAudEsp + '/' + db().ref(chaveAudEsp).push().key] = l; });
      state.salvandoEspecializacao = true;
      render();

      var respondido = false;
      var relogio = setTimeout(function () {
        if (respondido) return;
        respondido = true;
        state.salvandoEspecializacao = false;
        f.erro = 'A conexão está demorando e não deu para confirmar o salvamento. Toque no botão de novo.';
        render();
      }, 12000);

      db().ref().update(tudoEsp, function (err) {
        if (respondido) return;
        respondido = true;
        clearTimeout(relogio);
        state.salvandoEspecializacao = false;
        if (err) {
          console.error('[avaliacao-produto] erro ao salvar a curadoria cadastrada:', err);
          render();
          avpAlert(mensagemErro);
          return;
        }
        Object.keys(campos).forEach(function (k) { a[k] = campos[k]; });
        a.atualizadoEm = updates.atualizadoEm;
        a.camadaSugerida = Object.assign({}, a.camadaSugerida, { especializacao: ident.especializacao, papelEstrutural: ident.papelEstrutural });
        state.itens = upsertItem(state.itens, clonarItem(a));
        state.especializacaoForm = especializacaoFormInicial(a);
        adicionarAoHistoricoLocal(linhas);
        state.flashEspecializacao = mensagemOk;
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
      var d = diagnosticoMotor(it);
      return d ? d.situacao : null;
    }
    /* Além das três situações, uma QUARTA — 'verificando' — enquanto a
       configuração do motor não chegou do servidor: versaoAtual() devolve 1
       por falta de dado, então qualquer conclusão ("atual", "desatualizado"
       ou "equivalente") seria chute. Em rede lenta de celular essa janela
       dura segundos, e nela NÃO se oferece reprocessar nem reconciliar
       (mesma lição do incidente de 08-09/09: "ainda não sei" nunca pode ser
       tratado como uma resposta). Devolve também o MOTIVO de cada
       'desatualizado' — para a pessoa ver por que, em vez de só "precisa
       reprocessar":
         codigo    — motorVersion (lógica em código) diferente da atual; não
                     há como provar equivalência de código;
         sem-versao— a avaliação não tem motorVersionArquitetura;
         logica    — a versão das regras difere da vigente (diferencas > 0 em
                     combinacoesAnalisadas);
         sem-prova — não foi possível comprovar (versão sem registro). */
    function diagnosticoMotor(it) {
      if (!it || it.status !== 'concluido') return null;
      var M = window.faMotorArquitetura;
      if (!M.configCarregada()) return { situacao: 'verificando' };
      if (it.motorVersion !== MOTOR_VERSION) {
        return { situacao: 'desatualizado', motivo: { tipo: 'codigo', encontrada: it.motorVersion || null, esperada: MOTOR_VERSION } };
      }
      var vigente = M.versaoAtual();
      if (it.motorVersionArquitetura === vigente) return { situacao: 'atual' };
      if (typeof it.motorVersionArquitetura !== 'number') return { situacao: 'desatualizado', motivo: { tipo: 'sem-versao', destino: vigente } };
      var eq = M.equivalenciaEntreVersoes(it.motorVersionArquitetura, vigente);
      if (eq.equivalentes) return { situacao: 'equivalente', prova: eq };
      return { situacao: 'desatualizado', motivo: eq.diferencas > 0
        ? { tipo: 'logica', origem: eq.versaoA, destino: eq.versaoB, diferencas: eq.diferencas, combinacoes: eq.combinacoesAnalisadas }
        : { tipo: 'sem-prova', origem: eq.versaoA, destino: eq.versaoB, detalhe: eq.motivo || null } };
    }
    function textoMotivoMotor(m) {
      if (!m) return '';
      if (m.tipo === 'codigo') return 'lógica do motor em código diferente (registrada ' + (m.encontrada || '—') + ', atual ' + m.esperada + ')';
      if (m.tipo === 'sem-versao') return 'sem versão das regras registrada';
      if (m.tipo === 'logica') return 'versão ' + m.origem + ' das regras: ' + fmtNumero(m.diferencas) + ' de ' + fmtNumero(m.combinacoes) +
        ' combinações de respostas dão resultado diferente da versão atual (' + m.destino + ')';
      return 'versão ' + m.origem + ' das regras: não foi possível comprovar equivalência com a atual (' + m.destino + ')' +
        (m.detalhe === 'versao-indisponivel' ? ' — a versão não está registrada' : '');
    }
    function equivalenciaDoItem(it) {
      var d = diagnosticoMotor(it);
      return d && d.prova ? d.prova : null;
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
        /* PRESERVAÇÃO HISTÓRICA: cada resposta pertence à versão do questionário em
           que foi DADA (r.questionnaireContentVersion), não à da avaliação — numa
           reavaliação, a resposta herdada e não clicada de novo continua sendo uma
           resposta à pergunta antiga. Por isso:
             - a cópia gravada (textoPerguntaNaEpoca/tituloNaEpoca) e a versão da
               resposta NUNCA são trocadas pelo conteúdo de outra versão;
             - a interpretação é refeita a partir da versão da própria resposta
               (o mesmo texto da época — versões publicadas nunca mudam);
             - resposta sem versão (avaliação LEGADA, anterior a 29/09/2026) fica
               exatamente como está: nenhuma cópia é criada com um texto que a
               pessoa nunca viu. O texto mostrado nesses casos vem de
               conteudoSnapshotOuAtual ('reconstruido'/'indisponivel'), sem gravar.
           questionnaireContentVersion (o da avaliação) só fica como parâmetro por
           compatibilidade de chamada: a versão da avaliação não é a da resposta. */
        var versaoDaResposta = r.questionnaireContentVersion || null;
        var conteudo = def && versaoDaResposta ? conteudoDe(def, versaoDaResposta) : null;
        novo[id] = {
          valor: r.valor,
          justificativaAuto: conteudo ? (r.valor === 'sim' ? conteudo.justSim : conteudo.justNao) : (r.justificativaAuto != null ? r.justificativaAuto : null),
          observacao: r.observacao || '',
          codigoPergunta: def ? def.codigoEstavel : (r.codigoPergunta || null),
          textoPerguntaNaEpoca: r.textoPerguntaNaEpoca || (conteudo ? conteudo.texto : null),
          tituloNaEpoca: r.textoPerguntaNaEpoca ? (r.tituloNaEpoca || null) : (conteudo ? (conteudo.titulo || null) : null),
          /* Sem o "|| null", ausência virava undefined, e o SDK do Firebase RECUSA
             undefined de forma síncrona (relato de 30/09: REPROCESSAR TUDO travado). */
          questionnaireContentVersion: versaoDaResposta
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
    /* O SDK do Firebase lança uma exceção SÍNCRONA ("First argument contains
       undefined…") se QUALQUER valor, em qualquer profundidade, for
       undefined — e avaliações antigas têm campos que simplesmente não
       existem. Tudo o que o reprocessamento grava passa por aqui: undefined
       vira null (ausente, que é o que ele significa), nunca uma exceção. */
    function semUndefined(valor) {
      if (valor === undefined) return null;
      if (Array.isArray(valor)) return valor.map(semUndefined);
      if (valor && typeof valor === 'object') {
        var out = {};
        Object.keys(valor).forEach(function (k) { out[k] = semUndefined(valor[k]); });
        return out;
      }
      return valor;
    }
    /* Trilha da Decisão final quando o REPROCESSAMENTO (individual ou em lote) muda uma
       decisão que era automática: a decisão acompanha a nova recomendação do motor.
       Não é decisão de ninguém — a linha registra origem "Reprocessamento automático",
       a versão do motor que provocou a mudança e quem DISPAROU o reprocessamento.
       Só existe quando a decisão final realmente muda; decisão manual nunca é tocada
       (portanto nunca gera linha). Gravada junto com a avaliação, na mesma gravação. */
    function linhaAuditoriaReprocessamento(a, updates, modo, usuario) {
      if (a.decisaoManual || updates.decisaoFinal === undefined) return null;
      var anterior = decisaoFinalDe(a);
      if (updates.decisaoFinal === anterior) return null;
      return {
        tipo: 'alteracao_decisao_final', avaliacaoId: a._key, avaliacaoNome: a.nome || null,
        valorAnterior: { decisaoFinal: anterior, decisaoManual: false, justificativa: null, confirmada: !!a.decisaoConfirmada },
        valorNovo: { decisaoFinal: updates.decisaoFinal, decisaoManual: false, justificativa: null, confirmada: !!a.decisaoConfirmada },
        origem: 'reprocessamento-automatico', reprocessamento: modo,
        motorVersion: updates.motorVersion || MOTOR_VERSION, motorVersionArquitetura: updates.motorVersionArquitetura || null,
        motorVersionAnterior: a.motorVersion || null, motorVersionArquiteturaAnterior: a.motorVersionArquitetura || null,
        usuario: usuario || null, dataHora: updates.reprocessedAt || new Date().toISOString()
      };
    }
    /* Grava a avaliação reprocessada e, se a decisão mudou, a linha de auditoria — UMA gravação. */
    function gravarReprocessamento(a, updates, modo, usuario, aoTerminar) {
      var tudo = {};
      Object.keys(updates).forEach(function (k) { tudo[NODE + '/' + a._key + '/' + k] = updates[k]; });
      var linha = linhaAuditoriaReprocessamento(a, updates, modo, usuario);
      if (linha) {
        var chaveAud = NODE_CURADORIA_AUDITORIA + '/' + a._key;
        tudo[chaveAud + '/' + db().ref(chaveAud).push().key] = semUndefined(linha);
      }
      db().ref().update(tudo, function (err) { aoTerminar(err, linha); });
    }
    function construirAtualizacaoReprocessamento(a) {
      var calc = computeResultado(a);
      /* Se a camada mudou, o cadastro de curadoria perde/fixa o vínculo AGORA (ver vinculosAoMudarCamada). */
      var vinculos = vinculosAoMudarCamada(a, camadaDoItem(a), calc.camadaSugerida && calc.camadaSugerida.id);
      if (Object.keys(vinculos).length) calc = computeResultado(Object.assign({}, a, vinculos));
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
      Object.assign(updates, vinculos);
      return semUndefined(updates);
    }
    function reprocessarMotor() {
      if (state.reprocessando) return;
      var a = state.atual;
      if (!precisaReprocessar(a)) return; /* já está na versão atual: nada a fazer */
      state.reprocessando = true;
      render();
      quandoCompatibilidadePronta(function () {
        var updates;
        try {
          updates = construirAtualizacaoReprocessamento(a);
        } catch (e) {
          console.error('[avaliacao-produto] erro ao calcular o reprocessamento:', e);
          state.reprocessando = false;
          render();
          avpAlert('Não foi possível reprocessar esta avaliação. Tente novamente.');
          return;
        }
        gravarReprocessamentoIndividual(a, updates);
      });
    }
    function gravarReprocessamentoIndividual(a, updates) {
      var respondido = false;
      var relogio = setTimeout(function () {
        if (respondido) return;
        respondido = true;
        state.reprocessando = false;
        avpAlert('A conexão está demorando e não deu para confirmar o reprocessamento. Toque em "REPROCESSAR COM MOTOR ATUAL" de novo.');
        render();
      }, 12000);

      function falhouAoGravar(err) {
        console.error('[avaliacao-produto] erro ao reprocessar com o motor atual:', err);
        state.reprocessando = false;
        render();
        avpAlert('Não foi possível reprocessar esta avaliação. Tente novamente.');
      }
      try {
        gravarReprocessamento(a, updates, 'individual', sessaoAtual(), aoGravar);
      } catch (e) {
        if (respondido) return;
        respondido = true;
        clearTimeout(relogio);
        falhouAoGravar(e);
      }
      function aoGravar(err, linhaAuditoria) {
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
        if (linhaAuditoria) adicionarAoHistoricoLocal([linhaAuditoria]);
        state.flashResultado = '✓ Avaliação reprocessada com a versão atual do motor de classificação.';
        render();
      }
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
    /* (modal de confirmação: ver abrirModalAtualizarMotor, junto do lote de reprocessamento) */
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
            versaoAnterior: origem, versaoNova: destino, equivalenciaComprovada: true,
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
        /* UMA entrada de auditoria por avaliação reconciliada (avaliacaoId) —
           nunca um resumo por lote: quem consulta a auditoria vê exatamente
           qual avaliação mudou de qual versão para qual. O histórico da
           própria avaliação (reconciliacoesVersao) já foi gravado na MESMA
           transaction que trocou a versão, então ele não existe sem a
           mudança; este registro vem logo depois e, se falhar, o resumo
           avisa. NÃO é um reprocessamento: o motor não rodou. */
        var agora = new Date().toISOString();
        var updates = {};
        origens.forEach(function (origem) {
          var prova = provas[origem];
          var avaliacoes = reconciliadasPorOrigem[origem];
          Object.keys(avaliacoes).forEach(function (avaliacaoId) {
            updates['motor-arquitetura-auditoria/' + db().ref('motor-arquitetura-auditoria').push().key] = {
              tipo: 'reconciliacao_versao_equivalente', campo: null, valorAnterior: null, valorNovo: null,
              avaliacaoId: avaliacaoId, avaliacaoNome: avaliacoes[avaliacaoId] || null,
              versaoAnterior: Number(origem), versaoNova: destino,
              equivalenciaComprovada: true, diferencasSemanticas: prova.diferencas, combinacoesAnalisadas: prova.combinacoesAnalisadas,
              usuario: usuario, dataHora: agora
            };
          });
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
    function renderBarraReprocessarTudo(elegiveisLote, qtdEquivalentes, verificando) {
      var html = '<div class="avp-lote-bar">';
      if (verificando) {
        /* A configuração do motor ainda não chegou: não dá para saber o que
           precisa de quê — nenhuma ação é oferecida (ver diagnosticoMotor). */
        html += '<button class="btn btn--sm" id="avpReprocessarTudoBtn" disabled>Verificando a versão do motor…</button>';
      } else if (elegiveisLote.length) {
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
    /* MODAL ÚNICO "Atualizar avaliações para a versão atual do motor" — uma
       só tela para as duas operações, que são DIFERENTES e nunca se
       misturam: cada uma tem a sua contagem, o seu texto e o seu botão, e
       cada botão age só no seu grupo.
         já no motor atual      — nada a fazer;
         podem ser reconciliadas— versão anterior COMPROVADAMENTE equivalente
                                  (RECONCILIAR: não roda o motor, só o vínculo
                                  de versão muda);
         precisam ser reprocessadas — mudança lógica real (ou sem como
                                  comprovar): REPROCESSAR roda o motor atual.
       As contagens são recalculadas na hora (nunca de um render antigo). Para
       cada avaliação que precisa ser reprocessada, o modal diz POR QUÊ (ver
       textoMotivoMotor), para a pessoa conferir antes de confirmar. */
    function abrirModalAtualizarMotor() {
      var M = window.faMotorArquitetura;
      if (!M.configCarregada()) { avpAlert('A configuração do motor ainda está carregando. Tente de novo em alguns segundos.'); return; }
      var ativos = state.itens.filter(function (it) { return !it.excluido && !temVersaoMaisNova(it._key); });
      var concluidas = ativos.filter(function (it) { return it.status === 'concluido'; });
      var atualizadas = concluidas.filter(function (it) { return situacaoMotor(it) === 'atual'; });
      var paraReconciliar = concluidas.filter(elegivelParaReconciliacaoEmLote);
      var paraReprocessar = concluidas.filter(elegivelParaReprocessamentoEmLote);
      var bloqueadas = concluidas.filter(function (it) {
        var s = situacaoMotor(it);
        return (s === 'desatualizado' || s === 'equivalente') && it.bloqueadaParaReprocessamentoAutomatico;
      });
      if (!paraReconciliar.length && !paraReprocessar.length) return; /* nada a atualizar: os botões da lista já vêm desabilitados */
      function plural(n, um, varios) { return n + ' ' + (n === 1 ? um : varios); }

      var overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9999';
      var box = document.createElement('div');
      box.className = 'modal-box avp-lote-modal-box';
      box.style.cssText = 'max-width:500px;width:92%;padding:24px;display:flex;flex-direction:column;gap:14px;max-height:90vh;overflow-y:auto';
      var html = '<p class="avp-menu-acoes-titulo">Atualizar avaliações para a versão atual do motor</p>';
      html += '<p>Encontramos:</p><ul class="avp-lote-resumo-contagens" id="avpLoteResumoContagens">';
      html += '<li>' + plural(concluidas.length, 'avaliação concluída', 'avaliações concluídas') + '</li>';
      if (atualizadas.length) html += '<li>' + atualizadas.length + ' já ' + (atualizadas.length === 1 ? 'está' : 'estão') + ' no motor atual</li>';
      if (paraReconciliar.length) {
        html += '<li>' + paraReconciliar.length + ' ' + (paraReconciliar.length === 1 ? 'pode' : 'podem') + ' ser reconciliada' + (paraReconciliar.length === 1 ? '' : 's') +
          ' — ' + (paraReconciliar.length === 1 ? 'está' : 'estão') + ' em uma versão anterior equivalente</li>';
      }
      if (paraReprocessar.length) {
        html += '<li>' + paraReprocessar.length + ' precisa' + (paraReprocessar.length === 1 ? '' : 'm') + ' ser reprocessada' + (paraReprocessar.length === 1 ? '' : 's') + ' — motor desatualizado</li>';
      }
      if (bloqueadas.length) {
        html += '<li>' + bloqueadas.length + ' não entra' + (bloqueadas.length === 1 ? '' : 'm') + ' no lote (bloqueada' + (bloqueadas.length === 1 ? '' : 's') + ' para atualização automática)</li>';
      }
      html += '</ul>';

      if (paraReconciliar.length) {
        var grupos = provasPorOrigem(paraReconciliar);
        html += '<div class="avp-atualizar-secao" id="avpSecaoReconciliar">';
        html += '<p class="avp-atualizar-titulo">Reconciliar — sem recalcular</p>';
        html += '<p>As ' + paraReconciliar.length + ' avaliações foram produzidas por uma versão anterior do motor que foi comprovada como semanticamente equivalente à versão atual. ' +
          'As respostas, justificativas e classificações não precisam ser recalculadas.</p>';
        html += '<ul class="avp-lote-resumo-contagens" id="avpReconciliarProvas">';
        grupos.forEach(function (g) {
          html += '<li><strong>' + plural(g.itens.length, 'avaliação', 'avaliações') + ' na versão ' + esc(g.origem) + '.</strong> ' +
            esc(textoProvaEquivalencia(g.prova)) + ' <strong>Versões semanticamente equivalentes.</strong></li>';
        });
        html += '</ul>';
        html += '<p class="avp-decisao-aviso">O motor não roda de novo. Só o número da versão do motor gravado em cada avaliação passa para a versão ' +
          esc(M.versaoAtual()) + ', com a versão anterior preservada no histórico da avaliação e um registro na auditoria do motor. ' +
          'Não é um reprocessamento.</p>';
        html += '<button class="btn btn--primary" id="avpReconciliarConfirmar">RECONCILIAR ' + paraReconciliar.length +
          (paraReconciliar.length === 1 ? ' AVALIAÇÃO' : ' AVALIAÇÕES') + '</button>';
        html += '</div>';
      }
      if (paraReprocessar.length) {
        /* motivos agrupados */
        var motivos = {}, ordemMotivos = [];
        paraReprocessar.forEach(function (it) {
          var t = textoMotivoMotor(diagnosticoMotor(it).motivo);
          if (!motivos[t]) { motivos[t] = 0; ordemMotivos.push(t); }
          motivos[t]++;
        });
        html += '<div class="avp-atualizar-secao" id="avpSecaoReprocessar">';
        html += '<p class="avp-atualizar-titulo">Reprocessar — recalcula com o motor atual</p>';
        html += '<p>Por que ' + (paraReprocessar.length === 1 ? 'precisa' : 'precisam') + ' ser reprocessada' + (paraReprocessar.length === 1 ? '' : 's') + ':</p>';
        html += '<ul class="avp-lote-resumo-contagens" id="avpReprocessarMotivos">';
        ordemMotivos.forEach(function (t) { html += '<li>' + motivos[t] + ' — ' + esc(t) + '</li>'; });
        html += '</ul>';
        html += '<p class="avp-decisao-aviso">O reprocessamento não altera respostas nem justificativas fornecidas pelos usuários. ' +
          'O sistema recalculará apenas conteúdos gerados pelo motor e preservará todas as versões anteriores no histórico.</p>';
        html += '<button class="btn btn--primary" id="avpLoteConfirmar">REPROCESSAR ' + paraReprocessar.length +
          (paraReprocessar.length === 1 ? ' AVALIAÇÃO' : ' AVALIAÇÕES') + '</button>';
        html += '</div>';
      }
      html += '<div class="avp-lote-modal-botoes"><button class="btn" id="avpLoteCancelar">FECHAR</button></div>';
      box.innerHTML = html;
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      function fechar() { if (overlay.parentNode) document.body.removeChild(overlay); }
      box.querySelector('#avpLoteCancelar').addEventListener('click', fechar);
      overlay.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); fechar(); } });
      var btnReconciliar = box.querySelector('#avpReconciliarConfirmar');
      if (btnReconciliar) btnReconciliar.addEventListener('click', function () {
        fechar();
        reconciliarAvaliacoes(paraReconciliar, function () { render(); }, function () { render(); });
      });
      var btnReprocessar = box.querySelector('#avpLoteConfirmar');
      if (btnReprocessar) btnReprocessar.addEventListener('click', function () {
        fechar();
        executarReprocessamentoEmLote(paraReprocessar);
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
      var usuarioLote = sessaoAtual(); /* quem disparou o reprocessamento em lote */
      var CONCORRENCIA = 3;
      var TEMPO_MAXIMO_POR_ITEM = 20000;
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
        /* Cada item termina UMA vez, aconteça o que acontecer: gravou, deu
           erro, a chamada lançou exceção síncrona (o SDK faz isso com
           undefined no payload — era o que congelava o lote em "0 de N"), ou
           o servidor não respondeu a tempo (rede lenta de celular). Nunca um
           worker morre em silêncio e deixa o contador parado. */
        var encerrado = false;
        function encerrar(mensagemErro, erro) {
          if (encerrado) return;
          encerrado = true;
          clearTimeout(relogioItem);
          if (mensagemErro) {
            console.error('[avaliacao-produto] erro ao reprocessar em lote:', it._key, erro || mensagemErro);
            state.reprocessamentoLote.erros.push({ key: it._key, nome: it.nome, mensagem: mensagemErro });
          } else {
            state.reprocessamentoLote.sucesso++;
            Object.assign(it, updates);
            state.itens = upsertItem(state.itens, clonarItem(it));
          }
          terminouItem();
        }
        var relogioItem = setTimeout(function () {
          encerrar('Sem confirmação do servidor a tempo (rede lenta) — confira esta avaliação e, se ainda aparecer desatualizada, reprocesse de novo.');
        }, TEMPO_MAXIMO_POR_ITEM);
        try {
          gravarReprocessamento(it, updates, 'lote', usuarioLote, function (err) {
            encerrar(err ? 'Não foi possível gravar.' : null, err);
          });
        } catch (e) {
          encerrar('Não foi possível gravar (' + (e && e.message ? e.message : 'erro inesperado') + ').', e);
        }
      }
      quandoCompatibilidadePronta(function () {
        var n = Math.min(CONCORRENCIA, fila.length);
        workersAtivos = n;
        for (var i = 0; i < n; i++) worker();
      });
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
    /* Assim que as regras chegam (e a cada troca), a checagem de
       compatibilidade começa em segundo plano — ver quandoCompatibilidadePronta. */
    window.faMotorArquitetura.onMudanca(function () {
      if (window.faMotorArquitetura.configCarregada()) prepararCompatibilidade();
      render();
    });
    if (window.faMotorArquitetura.configCarregada()) prepararCompatibilidade();

    /* ===================== CARGA =====================
       A leitura depende do ACESSO (as regras do banco também): uma leitura
       recusada é cancelada pelo Firebase para sempre, então o ouvinte só é
       ligado depois de o acesso chegar — e nunca se assume nada antes. */
    var cargaIniciada = false;
    var refItens = null; /* a leitura ao vivo de avaliacoes-produto, para poder desligá-la na troca de sessão */
    function aoChegarItens(snap) {
      var arr = [];
      snap.forEach(function (c) { arr.push(Object.assign({ _key: c.key }, c.val())); });
      arr.sort(function (x, y) { return (y.atualizadoEm || '').localeCompare(x.atualizadoEm || ''); });
      state.itens = arr;
      state.itensCarregados = true;
      state.erroCarga = null;
      if (state.tela === 'lista') render();
      sincronizarComHash(); /* resolve um #avaliacoes?avp=<key> pendente (F5, link direto) assim que os dados chegarem */
    }
    function aoFalharCarga(err) {
      state.itensCarregados = true;
      /* As regras do banco exigem acesso à Avaliação (ver
         database.rules.json): chegar aqui sem permissão só acontece se o
         perfil mudar no meio da visita; ainda assim, distinguir "sem
         acesso" de "fora do ar" evita confundir quem abre um link direto. */
      state.erroCarga = (err && err.code === 'PERMISSION_DENIED') ? 'permissao' : 'geral';
      if (state.tela === 'lista' && destinoDaUrl().t === 'lista') {
        wrap.innerHTML = '<p class="admin-empty" style="color:var(--red)">Erro ao carregar avaliações. Recarregue a página.</p>';
      }
      sincronizarComHash();
    }
    function iniciarCarga() {
      if (cargaIniciada) return;
      if (window.faAuth.isAvaliacaoReady && !window.faAuth.isAvaliacaoReady()) return; /* o evento chama de novo */
      if (!pode()) {
        /* sem acesso (ou ainda sem login): mostra o aviso, mas NÃO desiste da
           carga — se o acesso mudar (novo login, registro chegando), o evento
           chama de novo */
        state.itensCarregados = true;
        state.erroCarga = 'permissao';
        return;
      }
      cargaIniciada = true;
      state.erroCarga = null;
      refItens = db().ref(NODE);
      refItens.on('value', aoChegarItens, aoFalharCarga);
    }

    /* ===================== SESSÃO =====================
       Esta tela vive na página inteira, mas a pessoa pode sair e OUTRA entrar sem recarregar.
       Duas coisas têm de acompanhar isso, e antes não acompanhavam:
         1) o ESTADO é de quem estava (tela aberta, usuários carregados, rascunhos, avaliações já
            lidas): na troca de pessoa volta tudo ao início, sem herdar nada;
         2) as DECISÕES de permissão dependem da sessão e da lista de admins, que chegam depois
            do registro de acesso: quando chegam, a tela se redesenha (antes só o registro de
            acesso redesenhava, e a decisão ficava presa no "ainda não sei"). */
    function emailDaSessao() {
      var s = window.faAuth && window.faAuth.getSession && window.faAuth.getSession();
      return s && s.email ? String(s.email).toLowerCase() : null;
    }
    var pessoaDaTela = emailDaSessao();
    /* O que decide o que mostrar. Só redesenha por evento de sessão quando isto muda — um evento
       repetido (o progresso do jogo também avisa) não pode apagar um formulário em preenchimento. */
    function assinaturaDeAcesso() {
      var a = window.faAuth || {};
      var em = emailDaSessao();
      return [em, a.isAdminReady ? a.isAdminReady() : '', em && a.isAdmin ? a.isAdmin(em) : '',
        a.isAvaliacaoReady ? a.isAvaliacaoReady() : '', a.getAvaliacaoTipo ? a.getAvaliacaoTipo() : ''].join('|');
    }
    var ultimaAssinatura = assinaturaDeAcesso();
    function resetarPorSessao() {
      epocaSessao++; /* respostas de salvamentos da pessoa anterior não mexem mais na tela */
      operacoesNatureza = {};
      if (refItens) { try { refItens.off('value', aoChegarItens); } catch (e) { /* já cancelada pelo banco */ } refItens = null; }
      cargaIniciada = false; /* a leitura do banco depende de quem é a pessoa: liga de novo no acesso dela */
      var novo = novoEstado();
      Object.keys(state).forEach(function (k) { delete state[k]; });
      Object.assign(state, novo);
      if (modo === 'operacional') prepararTelaPelaHash();
    }
    function aoMudarSessao(forcar) {
      var pessoa = emailDaSessao();
      var trocouPessoa = !!pessoaDaTela && pessoaDaTela !== pessoa;
      var assinatura = assinaturaDeAcesso();
      pessoaDaTela = pessoa;
      if (!trocouPessoa && !forcar && assinatura === ultimaAssinatura) return;
      ultimaAssinatura = assinatura;
      if (trocouPessoa) resetarPorSessao();
      iniciarCarga();
      render();
    }
    window.addEventListener('fa-avaliacao-ready', function () { aoMudarSessao(true); });
    ['fa-auth-ready', 'fa-auth-change', 'fa-admin-ready'].forEach(function (ev) {
      window.addEventListener(ev, function () { aoMudarSessao(false); });
    });
    iniciarCarga();

    /* Na carga inicial (F5, link direto, nova aba), se a URL já pede uma
       avaliação específica, a PRIMEIRA renderização não pode cair no default
       'lista' — a leitura de avaliacoes-produto ainda nem começou a
       responder nesse instante, então mostrar a lista (vazia) aqui é
       mostrar um estado que nunca existiu de verdade. 'carregando' cobre
       exatamente essa janela; sincronizarComHash() (chamado tanto agora
       quanto de novo quando os dados chegarem) decide o destino final. */
    function prepararTelaPelaHash() {
      var destUrl = destinoDaUrl();
      if (!(modo === 'operacional' && (destUrl.t === 'avaliacao' || destUrl.t === 'editar' || destUrl.t === 'reavaliar'))) return;
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
    prepararTelaPelaHash();
    /* Admin: a área pedida no endereço (#admin?arq=…) é lida ANTES do primeiro desenho — senão esse
       desenho (tela inicial) gravava ?arq=inicio por cima e o F5 de quem só tem a Arquitetura (aba já
       ativa) caía no início em vez da área pedida. */
    var areaInicial = modo === 'admin' ? areaDoEndereco() : null;
    if (areaInicial) aplicandoEnderecoAdmin = true;
    try { render(); } finally { aplicandoEnderecoAdmin = false; }
    sincronizarComHash(); /* tenta resolver um link direto já na carga inicial */
    if (modo === 'admin') {
      /* Endereço próprio por área da Arquitetura (ver sincronizarEnderecoAdmin): Voltar/Avançar do
         navegador e link colado; a troca para a aba Arquitetura grava o endereço da área atual. */
      window.addEventListener('popstate', aplicarEnderecoAdmin);
      window.addEventListener('hashchange', aplicarEnderecoAdmin);
      politicaRolagemAdmin(); /* F5 / link direto numa área: a entrada atual já nasce 'manual' */
      window.addEventListener('fa-admin-aba-arquitetura', function () { sincronizarEnderecoAdmin(); });
      /* F5 / link direto em #admin?arq=<área>: abre a aba e a área de uma vez. */
      if (areaInicial) {
        if (window.faAdminAbrirAba) window.faAdminAbrirAba('adminPanelArquitetura');
        if (areaInicial !== 'inicio') { aplicandoEnderecoAdmin = true; try { abrirAreaAdmin(areaInicial); } finally { aplicandoEnderecoAdmin = false; } }
      }
    }
  };

  /* A área AVALIAÇÃO (#avaliacoes) sobe a instância operacional ao ser aberta
     pela primeira vez. O bloco do Admin sobe a sua em initAdmin (admin.js). */
  if (window.faRouter && window.faRouter.onPageInit) {
    window.faRouter.onPageInit('avaliacoes', function () {
      window.faInitAvaliacaoProduto({ modo: 'operacional' });
      /* Adequação à Squad: a avaliação em si fica aqui, na área AVALIAÇÃO (ver avaliacao-squad.js).
         Se o script dele ainda não carregou, o botão da lista o monta no clique. */
      if (window.faInitAvaliacaoSquad) window.faInitAvaliacaoSquad({ modo: 'operacional' });
    });
  }
})();
