/* ============================================================
   Força Ágil — Configuração de Questionários (window.faQuestionarios)

   Objetivo: permitir que a REDAÇÃO das perguntas dos questionários
   (título, texto da pergunta, ajuda, exemplo, justificativas automáticas)
   seja alterada por configuração — sem editar código, sem PR, sem deploy —
   mantendo a REGRA de cada pergunta (o que ela significa para o motor de
   classificação) inteiramente fora do alcance dessa edição.

   Separação central deste módulo:
   - codigoEstavel (ex.: 'P5', 'S3'): identificador IMUTÁVEL, definido em
     código (ver CODIGOS_ESTAVEIS em avaliacao-produto.js), nunca editável
     por aqui. É o único identificador que a lógica de negócio pode usar.
   - conteúdo editorial (titulo/texto/textoAjuda/exemplo/justSim/justNao/
     observacaoAdministrativa): só isso é parametrizável, versionado e
     auditável por este módulo. Nunca usado como chave de nada.

   Node no Firebase:
   questionarios-config/<codigo> = {
     nome, descricao,
     versaoPublicada: número da versão vigente (perguntas NOVAS/em
       andamento usam esta versão — ver questionnaireContentVersion em
       avaliacao-produto.js),
     versoes: { "<n>": { perguntas: [...], publicadoEm, publicadoPor } , ... }
       — cada publicação cria uma entrada NOVA; nenhuma entrada existente é
       sobrescrita ou apagada (histórico completo sempre preservado, mesmo
       depois de um "rollback" — ver publicarVersaoAnterior),
     rascunho: { perguntas: [...], atualizadoEm, atualizadoPor } | null
       — edições em andamento, nunca usadas por avaliações reais até
       PUBLICAR; várias perguntas podem ser editadas sem afetar quem está
       respondendo o questionário agora.
   }
   questionarios-auditoria/<codigo>/<pushKey> = {
     pergunta (codigoEstavel), campo, valorAnterior, valorNovo,
     usuario, dataHora, versaoAnterior, novaVersao
   } — uma entrada por CAMPO alterado em cada pergunta, nunca apagável por
   esta aplicação (não existe função de exclusão aqui).

   Quando o node ainda não existe no Firebase (instalação nova, ou nenhuma
   edição feita ainda), versaoAtual/perguntasDaVersao caem no conteúdo de
   FÁBRICA definido em PADRAO abaixo — a mesma redação que já existia
   hardcoded no código antes deste módulo existir. Isso garante que a
   aplicação funciona sem exigir uma primeira publicação manual, e que
   avaliações antigas (sem questionnaireContentVersion nenhum) sempre têm
   uma redação de fallback coerente, nunca um campo vazio ou inventado. */
(function () {
  var NODE_CONFIG = 'questionarios-config';
  var NODE_AUDITORIA = 'questionarios-auditoria';

  function db() { return firebase.database(); }

  /* Único conjunto de campos que PUBLICAR/rascunho tocam — tudo que não
     está aqui (codigoEstavel, ordem, grupo, obrigatoriedade, o próprio
     código do questionário) é identidade/regra, nunca editorial. */
  var CAMPOS_EDITORIAVEIS = ['titulo', 'texto', 'textoAjuda', 'exemplo', 'exemplos', 'ajudaExtra', 'justSim', 'justNao', 'observacaoAdministrativa'];

  var PADRAO = {
    CLASSIFICACAO_ARQUITETURAL: {
      nome: 'Classificação arquitetural (Produto/Serviço)',
      descricao: 'Checklist de 16 perguntas para decidir a classificação arquitetural de um item — 8 critérios principais (P1–P8) e 8 testes de classificação (P9–P16).',
      perguntas: [
        { codigoEstavel: 'P1', titulo: 'Necessidade do cliente',
          texto: 'Este item atende a uma necessidade identificável de um cliente ou público específico?',
          textoAjuda: {
            significado: 'Este critério verifica se existe alguém para quem a solução faz sentido e uma necessidade que justifica sua existência.',
            quandoSim: 'Existe um cliente/público identificável e uma necessidade concreta atendida pelo item.',
            quandoNao: 'O item existe principalmente por uma necessidade interna, administrativa, tecnológica ou operacional, sem uma necessidade de cliente claramente identificável.'
          },
          exemplo: 'Um participante quer se preparar para se aposentar com mais segurança financeira — essa é uma necessidade de cliente identificável.',
          justSim: 'SIM — Existe uma necessidade de cliente identificável associada ao item.',
          justNao: 'NÃO — Não foi identificada uma necessidade de cliente suficientemente clara para caracterizar uma oferta.' },
        { codigoEstavel: 'P2', titulo: 'Resultado próprio para o cliente',
          texto: 'O item entrega um resultado próprio e perceptível para o cliente?',
          textoAjuda: {
            significado: 'Este é o principal critério da avaliação. Um Produto/Serviço precisa produzir um resultado que faça sentido para o cliente por si só.',
            quandoSim: 'O cliente consegue reconhecer o benefício ou resultado obtido ao utilizar a solução — por exemplo: receber uma renda; obter proteção; adquirir um imóvel financiado; receber crédito; obter uma orientação estruturada.',
            quandoNao: 'O item apenas ajuda outra solução a produzir seu resultado — por exemplo: cadastro; cálculo; folha; autenticação; documento; cobrança; análise interna.'
          },
          exemplo: 'Um empréstimo consignado entrega um resultado próprio (o crédito recebido); a análise de crédito que o viabiliza, sozinha, não entrega um resultado independente ao cliente.',
          justSim: 'SIM — O item produz um resultado próprio e perceptível para o cliente.',
          justNao: 'NÃO — O item contribui para uma entrega, mas não apresenta resultado de cliente suficientemente independente.' },
        { codigoEstavel: 'P3', titulo: 'Solução identificável',
          texto: 'O item pode ser entendido pelo cliente como uma solução ou oferta identificável?',
          textoAjuda: {
            significado: 'Avalie se o item representa algo que o cliente consegue reconhecer como uma solução, e não apenas uma parte invisível da operação.',
            quandoSim: 'O item possui identidade e propósito próprios na relação com o cliente.',
            quandoNao: 'O item é apenas uma atividade, mecanismo ou elemento interno de outra solução.'
          },
          exemplo: 'Um plano de previdência é reconhecido pelo participante como uma oferta própria; a rotina interna que atualiza saldo mensalmente não é.',
          justSim: 'SIM — O item pode ser reconhecido como uma solução/oferta com propósito próprio.',
          justNao: 'NÃO — O item parece representar uma parte da operação ou de outra solução, e não uma oferta independente.' },
        { codigoEstavel: 'P4', titulo: 'Fronteira coerente',
          texto: 'É possível delimitar claramente onde essa solução começa e termina?',
          textoAjuda: {
            significado: 'Uma solução deve ter uma fronteira coerente. Seus elementos devem pertencer ao mesmo propósito e contribuir para o mesmo resultado.',
            quandoSim: 'É possível identificar o que faz e o que não faz parte da solução.',
            quandoNao: 'O item é excessivamente genérico, transversal ou misturado com diversas outras soluções.'
          },
          exemplo: 'Um seguro de vida tem escopo claro (o que cobre, quem cobre, por quanto tempo); "atendimento ao participante" em geral atravessa vários produtos e não tem essa fronteira.',
          justSim: 'SIM — Existe uma fronteira coerente e identificável para a solução.',
          justNao: 'NÃO — A fronteira do item não está suficientemente clara para caracterizá-lo como uma solução autônoma.' },
        { codigoEstavel: 'P5', titulo: 'Autonomia estrutural',
          texto: 'O item consegue existir e entregar seu resultado de forma independente, sem depender estruturalmente de outro Produto/Serviço?',
          textoAjuda: {
            significado: 'Resultado próprio, fronteira e mensuração não bastam: uma funcionalidade dentro de outro Produto/Serviço também pode ter tudo isso sem ser, ela mesma, uma solução independente. Este critério verifica a autonomia estrutural.',
            quandoSim: 'O item continuaria fazendo sentido como solução própria mesmo se o Produto/Serviço ao qual está relacionado deixasse de existir.',
            quandoNao: 'O item só existe, ou só faz sentido, porque outro Produto/Serviço existe — ele depende estruturalmente dessa outra solução.'
          },
          exemplo: 'Um seguro de vida faz sentido como solução própria mesmo sem nenhum outro produto; "Alterar Perfil de Investimento" só existe porque o plano de previdência ao qual pertence existe.',
          justSim: 'SIM — O item tem autonomia estrutural: existiria como solução própria mesmo sem outro Produto/Serviço.',
          justNao: 'NÃO — O item depende estruturalmente de outro Produto/Serviço para existir ou fazer sentido.' },
        { codigoEstavel: 'P6', titulo: 'Jornada própria',
          texto: 'Existe uma jornada ou ciclo de vida identificável para esse item na relação com o cliente?',
          textoAjuda: {
            significado: 'Verifique se é possível reconhecer uma sequência coerente como contratar, utilizar, manter, alterar ou encerrar a solução.',
            quandoSim: 'Existe uma jornada identificável associada à solução.',
            quandoNao: 'O item ocorre somente como uma atividade dentro da jornada de outro produto.'
          },
          exemplo: 'Contratar, acompanhar e resgatar um plano de previdência é uma jornada própria; preencher um cadastro não é.',
          justSim: 'SIM — O item possui uma jornada ou ciclo de vida identificável.',
          justNao: 'NÃO — O item aparece principalmente como parte da jornada de outra solução.' },
        { codigoEstavel: 'P7', titulo: 'Medição de resultado',
          texto: 'É possível medir o resultado desse item de forma própria?',
          textoAjuda: {
            significado: 'O objetivo não é apenas medir quantidade de tarefas ou volume operacional. Deve ser possível medir se a solução está gerando seu resultado.',
            quandoSim: 'Existem ou podem existir indicadores próprios relacionados ao resultado da solução.',
            quandoNao: 'Os indicadores disponíveis medem somente atividades internas ou desempenho de outro produto.'
          },
          exemplo: 'Taxa de satisfação de quem recebeu o benefício é um indicador de resultado; volume de cadastros processados por dia é um indicador operacional.',
          justSim: 'SIM — O item admite mensuração própria de resultado.',
          justNao: 'NÃO — A mensuração parece depender essencialmente de outro produto ou de indicadores puramente operacionais.' },
        { codigoEstavel: 'P8', titulo: 'Gestão ponta a ponta',
          texto: 'Este item poderia ser gerido de ponta a ponta como uma solução?',
          textoAjuda: {
            significado: 'Avalie se seria possível atribuir responsabilidade sobre a evolução da solução, seu resultado, suas regras, sua experiência e seu desempenho.',
            quandoSim: 'Existe uma unidade coerente passível de gestão ponta a ponta.',
            quandoNao: 'O item é tão transversal ou fragmentado que funciona melhor como capacidade, processo ou componente de outras soluções.'
          },
          exemplo: 'Um cartão consignado pode ter um dono responsável pela sua evolução; "processamento de pagamentos" em geral é transversal demais para isso.',
          justSim: 'SIM — O item possui coerência suficiente para gestão ponta a ponta.',
          justNao: 'NÃO — O item parece exercer papel de suporte, processo ou capacidade compartilhada.' },
        { codigoEstavel: 'P9', titulo: 'Canal',
          texto: 'O item é principalmente um canal de acesso ou relacionamento?',
          exemplos: ['portal', 'aplicativo', 'telefone', 'atendimento', 'agência', 'chatbot'],
          justSim: 'SIM — O item apresenta características predominantes de canal, e não de Produto/Serviço.',
          justNao: 'NÃO — O item não se resume a um canal de acesso ou relacionamento.' },
        { codigoEstavel: 'P10', titulo: 'Artefato informacional',
          texto: 'O item é principalmente um documento, relatório ou informação entregue ao cliente?',
          exemplos: ['contracheque', 'demonstrativo', 'informe', 'extrato', 'relatório'],
          justSim: 'SIM — O item apresenta características predominantes de artefato informacional, e não de Produto/Serviço independente.',
          justNao: 'NÃO — O item não se limita a uma saída informacional entregue ao cliente.' },
        { codigoEstavel: 'P11', titulo: 'Capacidade',
          texto: 'O item é principalmente uma capacidade que a organização precisa possuir?',
          exemplos: ['gestão de dados', 'gestão atuarial', 'segurança', 'tecnologia', 'cobrança', 'cadastro'],
          justSim: 'SIM — O item apresenta características predominantes de capacidade organizacional.',
          justNao: 'NÃO — O item não se resume a uma capacidade organizacional interna.' },
        { codigoEstavel: 'P12', titulo: 'Processo/Etapa de processo',
          texto: 'O item é principalmente um processo ou uma etapa de processo?',
          exemplos: ['análise', 'cálculo', 'concessão', 'formalização', 'pagamento', 'habilitação'],
          justSim: 'SIM — O item apresenta características predominantes de processo ou etapa operacional.',
          justNao: 'NÃO — O item não se limita a um processo ou etapa operacional.' },
        { codigoEstavel: 'P13', titulo: 'Modalidade/opção',
          texto: 'O item é principalmente uma modalidade, opção ou configuração de outro produto?',
          exemplos: ['perfil', 'modalidade', 'forma de recebimento', 'opção tributária'],
          justSim: 'SIM — O item apresenta características predominantes de modalidade ou configuração de uma solução maior.',
          justNao: 'NÃO — O item não se resume a uma modalidade ou configuração de outra solução.' },
        { codigoEstavel: 'P14', titulo: 'Regra/condição',
          texto: 'O item é principalmente uma regra ou condição de outro produto?',
          exemplos: ['elegibilidade', 'prazo', 'limite', 'carência', 'regime tributário'],
          justSim: 'SIM — O item apresenta características predominantes de regra ou condição de outra solução.',
          justNao: 'NÃO — O item não se limita a uma regra ou condição de outra solução.' },
        { codigoEstavel: 'P15', titulo: 'Componente',
          texto: 'O item existe principalmente para que outro Produto/Serviço consiga entregar seu resultado?',
          ajudaExtra: 'Pergunte: se o produto principal deixasse de existir, este item ainda faria sentido como uma solução independente para o cliente?',
          justSim: 'SIM — O item apresenta características de componente ou elemento pertencente a outra solução.',
          justNao: 'NÃO — O item demonstra maior independência em relação a outras soluções.' },
        { codigoEstavel: 'P16', titulo: 'Funcionalidade/Operação',
          texto: 'O item é principalmente uma funcionalidade ou operação que permite consultar, escolher, solicitar, contratar, alterar, executar ou administrar algo dentro de outro Produto/Serviço?',
          exemplos: ['alterar uma configuração', 'solicitar uma opção', 'consultar saldo', 'alterar contribuição', 'executar uma operação dentro de uma solução maior'],
          justSim: 'SIM — O item apresenta características predominantes de funcionalidade/operação que atua dentro de outro Produto/Serviço.',
          justNao: 'NÃO — O item não se resume a uma funcionalidade ou operação executada dentro de outra solução.' }
      ]
    },
    ADEQUACAO_SQUAD: {
      nome: 'Adequação à gestão por Squad',
      descricao: 'Checklist de 8 perguntas, independente da classificação arquitetural (ver P1–P16) — responde se faz sentido organizar o cuidado deste item com uma squad dedicada, nunca se o item é ou não Produto/Serviço.',
      perguntas: [
        { codigoEstavel: 'S1', titulo: 'Demanda contínua',
          texto: 'Existe demanda contínua e relevante para essa solução?',
          textoAjuda: { significado: 'Avalia se existe fluxo contínuo e relevante de demanda para a solução.' },
          justSim: 'SIM — Existe demanda contínua e relevante para esta solução.',
          justNao: 'NÃO — A demanda não é contínua nem relevante o suficiente.' },
        { codigoEstavel: 'S2', titulo: 'Backlog próprio de evolução',
          texto: 'Existe backlog próprio de evolução, além da operação cotidiana?',
          textoAjuda: { significado: 'Avalia se existe trabalho de evolução contínua, e não apenas operação ou tratamento de casos.' },
          justSim: 'SIM — Existe backlog próprio de evolução além da operação cotidiana.',
          justNao: 'NÃO — Não há backlog próprio de evolução, só operação cotidiana.' },
        { codigoEstavel: 'S3', titulo: 'Indicadores próprios',
          texto: 'Há indicadores de resultado próprios que uma squad conseguiria influenciar diretamente?',
          textoAjuda: { significado: 'Avalia se a equipe conseguiria influenciar diretamente indicadores de resultado próprios.' },
          justSim: 'SIM — Há indicadores de resultado próprios influenciáveis diretamente.',
          justNao: 'NÃO — Não há indicadores de resultado próprios influenciáveis diretamente.' },
        { codigoEstavel: 'S4', titulo: 'Decisões próprias de priorização',
          texto: 'Existem decisões frequentes de priorização próprias desse domínio?',
          textoAjuda: { significado: 'Avalia se há necessidade frequente de decidir o que evoluir, melhorar ou priorizar naquele domínio.' },
          justSim: 'SIM — Existem decisões frequentes de priorização próprias deste domínio.',
          justNao: 'NÃO — Não há decisões frequentes de priorização próprias deste domínio.' },
        { codigoEstavel: 'S5', titulo: 'Volume, complexidade e criticidade',
          texto: 'O volume, a complexidade e a criticidade justificam capacidade dedicada?',
          textoAjuda: { significado: 'Avalia se o tamanho e a importância do trabalho justificam capacidade dedicada.' },
          justSim: 'SIM — Volume, complexidade e criticidade justificam capacidade dedicada.',
          justNao: 'NÃO — Volume, complexidade e criticidade não justificam capacidade dedicada.' },
        { codigoEstavel: 'S6', titulo: 'Conhecimento/capacidades relativamente estáveis',
          texto: 'Existe um conjunto relativamente estável de conhecimentos e capacidades necessário para evoluir essa solução?',
          textoAjuda: { significado: 'Avalia se existe um conjunto de conhecimentos e especialidades que faça sentido manter em um time relativamente estável.' },
          justSim: 'SIM — Existe um conjunto relativamente estável de conhecimentos e capacidades necessário.',
          justNao: 'NÃO — Não existe um conjunto relativamente estável de conhecimentos e capacidades necessário.' },
        { codigoEstavel: 'S7', titulo: 'Autonomia da equipe',
          texto: 'Uma equipe teria autonomia suficiente para melhorar o resultado sem depender continuamente de múltiplas outras squads?',
          textoAjuda: { significado: 'Avalia se uma squad conseguiria melhorar o resultado sem depender continuamente de outras squads para praticamente todas as decisões ou entregas.' },
          justSim: 'SIM — Uma equipe teria autonomia suficiente sem depender continuamente de outras squads.',
          justNao: 'NÃO — Uma equipe dependeria continuamente de múltiplas outras squads.' },
        { codigoEstavel: 'S8', titulo: 'Ownership claro',
          texto: 'Existe um responsável claro pelo resultado dessa solução?',
          textoAjuda: { significado: 'Avalia se existe alguém ou uma estrutura de responsabilidade clara pelo resultado da solução.' },
          justSim: 'SIM — Existe um responsável claro pelo resultado desta solução.',
          justNao: 'NÃO — Não existe um responsável claro pelo resultado desta solução.' }
      ]
    }
  };

  function perguntaPadrao(codigo, codigoEstavel) {
    var q = PADRAO[codigo];
    if (!q) return null;
    return q.perguntas.filter(function (p) { return p.codigoEstavel === codigoEstavel; })[0] || null;
  }

  /* cache[codigo]: snapshot mais recente do Firebase (null = ainda não
     chegou nenhum, ou node inexistente — nesse caso cai sempre no PADRAO).
     Um único listener por código, nunca duplicado mesmo com várias telas
     interessadas (ver onMudanca). */
  var cache = {};
  var carregado = {};
  var listeners = {};

  function garantirSync(codigo) {
    if (carregado[codigo]) return;
    carregado[codigo] = true;
    db().ref(NODE_CONFIG + '/' + codigo).on('value', function (snap) {
      cache[codigo] = snap.val();
      (listeners[codigo] || []).slice().forEach(function (cb) { cb(); });
    });
  }

  /* Registra cb para ser chamado a cada mudança da config (inclusive a
     primeira leitura, que pode chegar depois do primeiro render — quem
     chama deve re-renderizar dentro de cb, do mesmo jeito que já faz com
     db().ref(NODE).on('value', ...) para as avaliações em si). */
  function onMudanca(codigo, cb) {
    garantirSync(codigo);
    listeners[codigo] = listeners[codigo] || [];
    listeners[codigo].push(cb);
  }

  function versaoAtual(codigo) {
    var cfg = cache[codigo];
    return (cfg && cfg.versaoPublicada) || 1;
  }

  function perguntasDaVersao(codigo, versao) {
    var cfg = cache[codigo];
    var v = versao || versaoAtual(codigo);
    if (cfg && cfg.versoes && cfg.versoes[v] && cfg.versoes[v].perguntas) return cfg.versoes[v].perguntas;
    /* Nunca inventa: sem nada gravado para esta versão (instalação nova,
       ou v1 nunca publicada explicitamente), usa o conteúdo de fábrica —
       é exatamente a mesma redação que era hardcoded antes deste módulo. */
    return (PADRAO[codigo] && PADRAO[codigo].perguntas) || [];
  }

  function conteudoPergunta(codigo, codigoEstavel, versao) {
    var achou = perguntasDaVersao(codigo, versao).filter(function (p) { return p.codigoEstavel === codigoEstavel; })[0];
    return achou || perguntaPadrao(codigo, codigoEstavel) ||
      { codigoEstavel: codigoEstavel, titulo: codigoEstavel, texto: '(pergunta ' + codigoEstavel + ' — conteúdo não encontrado)', justSim: 'SIM', justNao: 'NÃO' };
  }

  function rascunhoAtual(codigo) {
    var cfg = cache[codigo];
    return (cfg && cfg.rascunho) || null;
  }

  /* Ponto de partida pra tela de edição: reaproveita um rascunho já
     existente (outra sessão pode ter começado a editar), ou clona a versão
     publicada atual — nunca edita os objetos em cache diretamente. */
  function iniciarOuObterRascunho(codigo) {
    var existente = rascunhoAtual(codigo);
    if (existente && existente.perguntas) return JSON.parse(JSON.stringify(existente));
    return { perguntas: JSON.parse(JSON.stringify(perguntasDaVersao(codigo, versaoAtual(codigo)))) };
  }

  function salvarRascunho(codigo, perguntas, usuario, cb) {
    db().ref(NODE_CONFIG + '/' + codigo + '/rascunho').set(
      { perguntas: perguntas, atualizadoEm: new Date().toISOString(), atualizadoPor: usuario || null },
      function (err) { if (cb) cb(err || null); }
    );
  }

  function descartarRascunho(codigo, cb) {
    db().ref(NODE_CONFIG + '/' + codigo + '/rascunho').remove(function (err) { if (cb) cb(err || null); });
  }

  /* Compara só os CAMPOS_EDITORIAVEIS — qualquer diferença em identidade/
     regra (codigoEstavel, ordem…) nunca chega até aqui, porque a tela de
     edição não permite alterá-los (ver questionarios-admin em
     avaliacao-produto.js). */
  function diffPerguntas(perguntasAntigas, perguntasNovas) {
    var porCodigo = {};
    (perguntasAntigas || []).forEach(function (p) { porCodigo[p.codigoEstavel] = p; });
    var alteradas = [];
    (perguntasNovas || []).forEach(function (novo) {
      var antigo = porCodigo[novo.codigoEstavel] || {};
      var campos = CAMPOS_EDITORIAVEIS.filter(function (campo) {
        return JSON.stringify(antigo[campo] || null) !== JSON.stringify(novo[campo] || null);
      });
      if (campos.length) alteradas.push({ codigoEstavel: novo.codigoEstavel, campos: campos, antigo: antigo, novo: novo });
    });
    return alteradas;
  }

  /* PUBLICAR: cria uma versão NOVA (nunca sobrescreve nenhuma anterior),
     aponta versaoPublicada pra ela, limpa o rascunho e grava uma entrada de
     auditoria por CAMPO alterado em cada pergunta — tudo num update()
     atômico só. Nunca mexe em avaliações já respondidas: elas continuam
     lendo, pra sempre, o snapshot gravado na própria resposta (ver
     avaliacao-produto.js) ou, na falta dele, a versão que estava vigente
     quando a avaliação foi iniciada (questionnaireContentVersion). */
  function publicarRascunho(codigo, usuario, cb) {
    var rascunho = rascunhoAtual(codigo);
    if (!rascunho || !rascunho.perguntas) { cb('sem-rascunho'); return; }
    publicarConteudo(codigo, rascunho.perguntas, usuario, cb);
  }

  function publicarConteudo(codigo, perguntas, usuario, cb) {
    var versaoAntiga = versaoAtual(codigo);
    var perguntasAntigas = perguntasDaVersao(codigo, versaoAntiga);
    var alteradas = diffPerguntas(perguntasAntigas, perguntas);
    var novaVersao = versaoAntiga + 1;
    var agora = new Date().toISOString();
    var updates = {};
    updates[NODE_CONFIG + '/' + codigo + '/versaoPublicada'] = novaVersao;
    updates[NODE_CONFIG + '/' + codigo + '/versoes/' + novaVersao] = { perguntas: perguntas, publicadoEm: agora, publicadoPor: usuario || null };
    updates[NODE_CONFIG + '/' + codigo + '/rascunho'] = null;
    updates[NODE_CONFIG + '/' + codigo + '/nome'] = (PADRAO[codigo] && PADRAO[codigo].nome) || codigo;
    alteradas.forEach(function (alt) {
      alt.campos.forEach(function (campo) {
        var chave = db().ref(NODE_AUDITORIA + '/' + codigo).push().key;
        updates[NODE_AUDITORIA + '/' + codigo + '/' + chave] = {
          pergunta: alt.codigoEstavel, campo: campo,
          valorAnterior: alt.antigo[campo] != null ? alt.antigo[campo] : null,
          valorNovo: alt.novo[campo] != null ? alt.novo[campo] : null,
          usuario: usuario || null, dataHora: agora, versaoAnterior: versaoAntiga, novaVersao: novaVersao
        };
      });
    });
    db().ref().update(updates, function (err) {
      if (cb) cb(err || null, { novaVersao: novaVersao, alteradas: alteradas });
    });
  }

  /* "Rollback": publica o CONTEÚDO de uma versão antiga como uma versão
     NOVA (novaVersao = versaoAtual + 1) — nunca apaga nem reescreve as
     versões existentes, e nunca toca no histórico das avaliações (elas
     continuam com seus próprios snapshots/questionnaireContentVersion,
     intocados). */
  function publicarVersaoAnterior(codigo, versaoAlvo, usuario, cb) {
    var perguntas = perguntasDaVersao(codigo, versaoAlvo);
    if (!perguntas || !perguntas.length) { cb('versao-nao-encontrada'); return; }
    publicarConteudo(codigo, JSON.parse(JSON.stringify(perguntas)), usuario, cb);
  }

  /* A versão 1 (conteúdo de fábrica, PADRAO) nunca é gravada explicitamente
     em versoes/1 — só existe como fallback de leitura (ver perguntasDaVersao)
     — mas continua sendo uma versão real, restaurável (rollback) e listável,
     então entra sempre aqui mesmo sem uma entrada própria no Firebase. */
  function listarVersoes(codigo) {
    var cfg = cache[codigo];
    var numeros = (cfg && cfg.versoes) ? Object.keys(cfg.versoes).map(Number) : [];
    if (numeros.indexOf(1) === -1) numeros.push(1);
    return numeros.sort(function (a, b) { return a - b; });
  }

  function situacao(codigo) {
    var cfg = cache[codigo] || {};
    var v = versaoAtual(codigo);
    var infoVersao = cfg.versoes && cfg.versoes[v];
    return {
      nome: cfg.nome || (PADRAO[codigo] && PADRAO[codigo].nome) || codigo,
      descricao: cfg.descricao || (PADRAO[codigo] && PADRAO[codigo].descricao) || '',
      qtdPerguntas: perguntasDaVersao(codigo, v).length,
      versaoPublicada: v,
      temRascunho: !!rascunhoAtual(codigo),
      ultimaAlteracaoEm: infoVersao ? infoVersao.publicadoEm : null,
      ultimaAlteracaoPor: infoVersao && infoVersao.publicadoPor ? infoVersao.publicadoPor.name || infoVersao.publicadoPor.email : null
    };
  }

  function auditoria(codigo, cb) {
    db().ref(NODE_AUDITORIA + '/' + codigo).once('value', function (snap) {
      var val = snap.val() || {};
      var lista = Object.keys(val).map(function (k) { return Object.assign({ _key: k }, val[k]); });
      lista.sort(function (a, b) { return (a.dataHora || '') < (b.dataHora || '') ? 1 : -1; });
      cb(lista);
    });
  }

  window.faQuestionarios = {
    CODIGOS: { CLASSIFICACAO_ARQUITETURAL: 'CLASSIFICACAO_ARQUITETURAL', ADEQUACAO_SQUAD: 'ADEQUACAO_SQUAD' },
    CAMPOS_EDITORIAVEIS: CAMPOS_EDITORIAVEIS,
    PADRAO: PADRAO,
    onMudanca: onMudanca,
    versaoAtual: versaoAtual,
    perguntasDaVersao: perguntasDaVersao,
    conteudoPergunta: conteudoPergunta,
    rascunhoAtual: rascunhoAtual,
    iniciarOuObterRascunho: iniciarOuObterRascunho,
    salvarRascunho: salvarRascunho,
    descartarRascunho: descartarRascunho,
    diffPerguntas: diffPerguntas,
    publicarRascunho: publicarRascunho,
    /* Publica um conjunto de perguntas dado diretamente por quem chama (ex.:
       o rascunho ainda em memória na tela de edição) — evita depender de um
       round-trip de leitura do Firebase entre salvar o rascunho e publicá-lo
       (o cache local só é atualizado quando o listener de onMudanca dispara,
       de forma assíncrona; ler rascunhoAtual() logo após salvarRascunho()
       pode ver o valor ANTERIOR ainda). Nunca lê o cache: sempre publica
       exatamente o que foi passado. */
    publicarPerguntas: publicarConteudo,
    publicarVersaoAnterior: publicarVersaoAnterior,
    listarVersoes: listarVersoes,
    situacao: situacao,
    auditoria: auditoria
  };
})();
