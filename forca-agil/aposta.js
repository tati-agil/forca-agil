/* ============================================================
   Força Ágil — Construção da Aposta
   ============================================================

   Uma dinâmica guiada que leva o grupo da missão até uma decisão
   baseada em evidência, uma etapa por vez.

   POR QUE UMA ETAPA POR VEZ
   O valor da dinâmica não está nos campos preenchidos: está em
   perceber que sintoma, problema, hipótese e solução são coisas
   diferentes. Um formulário com tudo à mostra deixa o grupo pular
   direto para a solução — que é exatamente o hábito que a oficina
   quer interromper.

   Por isso a trilha mostra os NÚMEROS das nove etapas desde o começo
   (dá para ver que são dez e onde a conversa está), mas não os
   nomes: ler "Hipótese", "Experimento" e "Evidência" à frente já
   entrega o caminho e muda o que se escreve na etapa atual. O nome
   aparece quando chega a vez — ou quando a etapa já foi preenchida,
   que é quando o grupo pode voltar nela.

   POR QUE O FORMULÁRIO É A PRÓPRIA FRASE
   Cada etapa tem um `molde`: a frase em pedaços, texto fixo e
   lacunas. O fixo aparece na tela como texto, e só as lacunas são
   digitáveis — quem preenche vê o que é dele e o que já está pronto.
   Antes a frase-modelo ficava num quadro no topo e os campos
   embaixo, sem ligação visível: no primeiro uso real a frase inteira
   foi digitada dentro de um campo só, e o mapa saiu com o começo
   duplicado. Embaixo das lacunas, a mesma frase se monta ao vivo,
   com o que falta marcado no lugar exato — e clicável.

   POR QUE "OKR" NÃO APARECE ATÉ O FIM
   A revelação final ("vocês também construíram um OKR") só tem
   efeito se ninguém souber disso enquanto preenche. Quem sabe que
   está escrevendo um Key Result escreve para agradar o conceito, e
   não para descrever a realidade. Então os termos Objective, Key
   Result e OKR não existem em lugar nenhum da interface antes de o
   facilitador clicar em "Revelar conexões" — nem em rótulo, nem em
   ajuda, nem em texto de apoio.

   ONDE VIVE
   Dentro do Treinamento, e só para quem está confirmada numa turma
   que o admin liberou (turmas/<turma>/apostaHabilitada) — mesmo
   par de exigências da Avaliação. A dinâmica em si roda numa tela
   cheia, porque é feita para ser projetada numa sala.

   COMO OS DADOS SÃO GUARDADOS
   apostas/<turmaKey>/atual                       → id da execução em curso.
                                                     Só muda dentro do MESMO
                                                     update() que cria a
                                                     execução nova — nunca
                                                     antes (ver criarExecucao)
   apostas/<turmaKey>/criacaoExecucaoEmAndamento  → lock temporário que
                                                     disputa quem pode criar
                                                     a próxima execução (não
                                                     é "atual" — ver
                                                     criarExecucao); guarda um
                                                     token próprio de cada
                                                     tentativa, para que só
                                                     quem o adquiriu consiga
                                                     removê-lo (nunca um
                                                     remove() às cegas — ver
                                                     liberarLock); some ao
                                                     final de cada ciclo, ou
                                                     expira sozinho
                                                     (LOCK_EXPIRA_MS)
   apostas/<turmaKey>/contadorExecucoes           → só o número da última
                                                     execução criada
                                                     (transaction() — ver
                                                     criarExecucao), nunca
                                                     lido para nada além
                                                     disso
   apostas/<turmaKey>/execucoes/<execId>          → uma execução inteira
     · numero, status ('ativa'/'encerrada'), criadaEm/criadaPor(Nome),
       encerradaEm/encerradaPor(Nome) quando encerrada, missao, revelado
       (`encerrada`, booleano, é campo antigo — mantido por compatibilidade,
       quem decide o estado de verdade é `status`)
     · grupos/<grupoId> → nome, membros, etapa, dados de cada etapa
   "Iniciar nova execução" (Fase 1 da evolução de execuções) encerra
   formalmente a execução atual (status/encerradaEm/encerradaPor) e cria
   uma NOVA. Duas invariantes valem sempre, mesmo em cima de uma falha
   no meio do caminho: no máximo UMA execução com status 'ativa' por
   turma, e "atual" sempre aponta para uma execução que existe e está
   ativa. A disputa entre chamadas concorrentes usa um lock separado
   (nunca o próprio "atual" — ver criarExecucao para o porquê), e
   "atual" só é escrito dentro do update() atômico final, junto com a
   execução nova inteira e o encerramento da antiga — nunca isolado.
   Nada do que um grupo escreveu é apagado nem alterado. Execuções de
   antes desta fase não têm `numero`/`status` — ver compatibilidade em
   qualquer leitura futura desses campos.
   ============================================================ */
(function () {
  'use strict';

  function emailKey(email) {
    return String(email || '').toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function db() { return firebase.database(); }
  function sessao() { return window.faAuth && window.faAuth.getSession ? window.faAuth.getSession() : null; }
  function souAdmin() {
    var s = sessao();
    return !!(s && window.faAuth.isAdmin && window.faAuth.isAdmin(s.email));
  }
  /* Quem conduz: admin ou facilitadora cadastrada. Mesma régua da rota
     #facilitador — não inventa um terceiro critério para a mesma pergunta. */
  function souFacilitadora() {
    var s = sessao();
    if (!s) return false;
    if (souAdmin()) return true;
    return !!(window.faAuth.isFacilitador && window.faAuth.isFacilitador(s.email));
  }

  /* ══════════════════════════════════════════════════════════════
     AS NOVE ETAPAS

     Cada etapa carrega o texto que a tela mostra e a função que lê
     e escreve os seus campos. Ter tudo numa lista só é o que
     garante que a trilha, o mapa final e a navegação concordem
     entre si: acrescentar uma etapa é acrescentar um item aqui.

     `dica` é o que aparece no ícone "?"; `exemplo` fica recolhido
     atrás de "Ver exemplo" para não virar resposta pronta.
     ══════════════════════════════════════════════════════════════ */
  var ETAPAS = [
    {
      id: 'missao',
      titulo: 'MISSÃO',
      curto: 'Missão',
      pergunta: 'O que queremos melhorar?',
      exemplo: 'Melhorar significativamente a experiência do participante durante a concessão do benefício em 90 dias.',
      dica: 'A missão é o destino da conversa. Ela não descreve o que será feito, e sim o que queremos que fique diferente.',
      legado: 'texto',
      campos: [
        { chave: 'verbo', tipo: 'input', rotulo: 'Verbo de mudança', curto: 'o verbo', placeholder: 'Melhorar' },
        { chave: 'oQue', tipo: 'input', rotulo: 'O que queremos melhorar', curto: 'o que queremos melhorar', placeholder: 'a experiência do participante' },
        { chave: 'contexto', tipo: 'input', rotulo: 'Para quem / em qual contexto', curto: 'para quem ou em qual contexto', placeholder: 'durante a concessão do benefício' },
        /* "em" é a palavra que faz parte da FRASE ("…em 90 dias.") — o
           rótulo mostrado colado à lacuna é outra coisa, e "em" sozinho
           não dizia o que preencher ali. `rotuloMolde` troca só o que
           aparece na tela, sem mudar a palavra que vai para o mapa. */
        { chave: 'prazo', tipo: 'quantidade', rotulo: 'Prazo', rotuloMolde: 'Prazo', curto: 'o prazo', placeholder: '90', unidadePadrao: 'dias' }
      ],
      molde: [{ c: 'verbo' }, { c: 'oQue' }, { c: 'contexto' }, 'em', { c: 'prazo' }, '.']
    },
    {
      id: 'sintoma',
      titulo: 'SINTOMA',
      curto: 'Sintoma',
      pergunta: 'O que vemos hoje?',
      auxiliar: 'Descreva um fato, sinal ou comportamento que pode ser observado na realidade. Ainda não tente explicar a causa nem propor uma solução.',
      exemplo: 'Hoje observamos que muitos participantes entram em contato para saber como está o processo de concessão do benefício.',
      rodape: 'Sintoma mostra o que vemos. O problema será definido na próxima etapa.',
      dica: 'Sintoma é um sinal observável de que algo pode não estar funcionando como desejado. Ele descreve o que está acontecendo na realidade, sem explicar ainda por que isso acontece.\n\n' +
        'Bom exemplo: “Muitos participantes entram em contato para perguntar sobre o andamento da concessão.”\n\n' +
        'Não é um bom sintoma: “A comunicação é ruim” — isso já é uma interpretação. Nesta etapa, prefira registrar aquilo que pode ser observado.',
      campos: [
        { chave: 'texto', tipo: 'textarea', rotulo: 'O fato observável', curto: 'o que observamos', placeholder: 'muitos participantes entram em contato para saber em que etapa está a concessão' }
      ],
      molde: ['Hoje observamos que', { c: 'texto' }, '.']
    },
    {
      id: 'problema',
      titulo: 'P — PROBLEMA',
      curto: 'Problema',
      pergunta: 'Que problema esse sintoma está revelando?',
      auxiliar: 'Transforme o sintoma observado na situação indesejada vivida por quem é afetado. Ainda não tente explicar por que isso acontece.',
      exemplo: 'O participante não consegue acompanhar com clareza e autonomia o andamento do seu processo de concessão de benefício.',
      dica: 'Sintoma = o que vemos. Problema = a situação indesejada que esse sintoma revela.',
      rodape: 'O sintoma mostra o que estamos observando. O problema descreve a situação indesejada que esse sinal pode estar revelando. A causa será explorada na etapa Hipótese.',
      dependeDe: 'sintoma',
      campos: [
        { chave: 'quem', tipo: 'input', rotulo: 'Quem é afetado', curto: 'quem é afetado', placeholder: 'O participante', dica: 'Quem vive diretamente essa situação indesejada?' },
        { chave: 'situacaoIndesejada', tipo: 'textarea', rotulo: 'Situação indesejada', curto: 'a situação indesejada', placeholder: 'não consegue acompanhar com clareza e autonomia o andamento do seu processo de concessão de benefício', dica: 'Descreva o que essa pessoa ou grupo não consegue fazer, vivencia ou enfrenta. Não explique ainda a causa.' }
      ],
      molde: [{ c: 'quem' }, { c: 'situacaoIndesejada' }, '.']
    },
    {
      id: 'mudancas',
      titulo: 'MUDANÇAS MENSURÁVEIS',
      curto: 'Mudanças mensuráveis',
      pergunta: 'O que queremos ver diferente e quanto?',
      auxiliar: 'Transforme a melhoria desejada em um resultado observável e mensurável. Defina o que será medido, quanto é hoje, quanto queremos alcançar e em quanto tempo.',
      rodape: 'Uma mudança mensurável diz o que precisa mudar na realidade — não o que será feito.',
      exemplo: 'Reduzir os contatos sobre andamento de 1.000 para 700 por mês em 90 dias.',
      dica: 'Se a frase descreve uma entrega ("criar", "implantar"), ainda não é uma mudança mensurável. Pergunte: se essa entrega funcionasse, o que mudaria na realidade?',
      lista: true
    },
    {
      id: 'hipotese',
      titulo: 'H — HIPÓTESE',
      curto: 'Hipótese',
      pergunta: 'Por que achamos que esse problema acontece?',
      auxiliar: 'Agora podemos explicar. Mas ainda é uma hipótese, não um fato.',
      exemplo: 'Acreditamos que isso acontece porque as informações sobre a etapa atual do processo não são suficientemente claras. Essa hipótese surgiu porque observamos que muitos participantes entram em contato perguntando sobre o andamento do processo.',
      rodape: 'Uma hipótese é uma explicação possível para o problema. O que observamos pode justificar investigá-la, mas ainda não prova que ela seja verdadeira.',
      dica: 'Hipótese = nossa explicação atual para o problema. Ela ainda precisa ser testada.',
      dependeDe: 'problema',
      /* "Pois" ligava causa e indício como se fossem uma coisa só —
         mas são duas: o que acreditamos (a explicação, ainda não
         testada) e o que observamos (o sinal que tornou essa explicação
         plausível). O sinal não é prova da hipótese, só o motivo de
         cogitá-la; por isso vira uma frase própria, não uma oração
         subordinada da primeira. */
      campos: [
        { chave: 'causa', tipo: 'textarea', rotulo: 'Hipótese causal', curto: 'a hipótese causal', placeholder: 'as informações sobre a etapa atual do processo não são suficientemente claras', dica: 'Descreva a explicação que o grupo acredita que pode estar causando o problema. Ela ainda precisa ser testada.' },
        { chave: 'indicio', tipo: 'textarea', rotulo: 'Sinal que motivou a hipótese', curto: 'o sinal que motivou a hipótese', placeholder: 'muitos participantes entram em contato perguntando sobre o andamento do processo', dica: 'Registre o fato ou sinal que levou o grupo a considerar essa explicação plausível. Isso não significa que a hipótese esteja comprovada.' }
      ],
      molde: ['Acreditamos que isso acontece porque', { c: 'causa' }, '. Essa hipótese surgiu porque observamos que', { c: 'indicio' }, '.']
    },
    {
      id: 'ideia',
      titulo: 'IDEIA DE SOLUÇÃO',
      curto: 'Ideia de solução',
      pergunta: 'O que poderíamos fazer a respeito?',
      exemplo: 'Poderíamos disponibilizar no portal de autoatendimento o status do processo de concessão de benefício para que o participante consiga acompanhar o andamento sem precisar entrar em contato.',
      rodape: 'A hipótese diz o que acreditamos estar acontecendo. A ideia de solução diz o que imaginamos que podemos fazer a respeito. A ideia ainda é uma possibilidade — na próxima etapa, ela será transformada em um experimento.',
      dica: 'Ainda não é hora de decidir tecnologia. O que importa é a mudança que a ideia pretende provocar.',
      dependeDe: 'hipotese',
      legado: 'texto',
      campos: [
        { chave: 'acao', tipo: 'textarea', rotulo: 'Ação ou abordagem', curto: 'a ação', placeholder: 'dar ao participante mais visibilidade sobre o andamento', dica: 'Descreva uma possível intervenção. Ainda não precisa explicar como ela será testada.' },
        { chave: 'mudanca', tipo: 'textarea', rotulo: 'Mudança que pretendemos provocar', curto: 'a mudança pretendida', placeholder: 'que o participante consiga acompanhar o andamento sem precisar entrar em contato', dica: 'Que efeito esperamos que essa ideia provoque? Não repita aqui a meta numérica das Mudanças mensuráveis.' }
      ],
      molde: ['Poderíamos', { c: 'acao' }, 'para', { c: 'mudanca' }, '.']
    },
    {
      id: 'experimento',
      titulo: 'E — EXPERIMENTO',
      curto: 'Experimento',
      pergunta: 'Como vamos testar essa ideia?',
      exemplo: 'Durante 3 semanas, com 50 participantes, vamos enviar a mensagem de status.',
      rodape: 'O experimento não é a solução completa. É uma forma organizada de testar a ideia em pequena escala e observar se os resultados esperados começam a acontecer.',
      dica: 'Um experimento precisa de três coisas para valer: com quem, por quanto tempo e o que vai observar.',
      dependeDe: 'ideia',
      campos: [
        /* "Durante" já é a palavra que faz parte da FRASE ("Durante 3
           semanas…") — o rótulo colado à lacuna é outra coisa
           (rotuloMolde), deixando explícito que este prazo é só desta
           execução do teste, não o prazo da meta em Mudanças
           mensuráveis nem o da próxima ação na Decisão. */
        { chave: 'duracao', tipo: 'quantidade', rotulo: 'Duração do experimento', rotuloMolde: 'Duração do experimento', curto: 'quanto tempo', placeholder: '3', unidadePadrao: 'semanas', dica: 'Por quanto tempo este teste será executado?' },
        /* "com" é a palavra que faz parte da FRASE ("…com 50 pessoas…")
           — o rótulo mostrado colado à lacuna é outra coisa, e "com"
           sozinho não dizia o que preencher ali (mesmo caso do "em" da
           Missão: ver rotuloMolde). */
        { chave: 'quantidade', tipo: 'input', rotulo: 'Quantidade', rotuloMolde: 'Quantas pessoas', curto: 'quantas pessoas', placeholder: '50' },
        { chave: 'comQuem', tipo: 'input', rotulo: 'Com quem', curto: 'com quem', placeholder: 'participantes em concessão' },
        { chave: 'oQue', tipo: 'textarea', rotulo: 'O que será feito', curto: 'o que será feito', placeholder: 'enviar a mensagem de status' },
        { chave: 'responsavel', tipo: 'input', rotulo: 'Responsável', placeholder: 'nome' },
        { chave: 'custo', tipo: 'moeda', rotulo: 'Custo estimado', placeholder: 'R$ 0,00' }
      ],
      /* "e medir X" saiu do molde — a frase do Experimento descreve só o
         desenho do teste. O que se observa é uma ESCOLHA entre as
         mudanças mensuráveis já cadastradas (ver resultadosPickerHtml),
         mostrada à parte, como lista — não emendada nesta frase (ver
         "Resultados que vamos observar" em atualizarFrase()). */
      molde: ['Durante', { c: 'duracao' }, ', com', { c: 'quantidade' }, { c: 'comQuem' }, ', vamos', { c: 'oQue' }, '.']
    },
    {
      id: 'evidencia',
      titulo: 'E — EVIDÊNCIA',
      curto: 'Evidência',
      pergunta: 'O que aconteceu de fato?',
      /* Sem `auxiliar` estático: a etapa muda de modo (planejamento x
         registro de resultados) e o banner com a explicação de cada
         modo é montado dinamicamente dentro de evidenciaHtml(), para
         nunca ficar desatualizado em relação ao que a tela mostra. */
      exemplo: 'Esperávamos reduzir os contatos sobre o andamento da concessão de 1.000 para 500 contatos por mês. Após o experimento, observamos 650 contatos por mês.',
      rodape: 'O objetivo do experimento é aprender, não provar que estávamos certos.',
      dica: 'A evidência não julga quem teve a ideia. Ela só diz o que a realidade respondeu.',
      dependeDe: 'experimento',
      /* Um card por resultado esperado selecionado no Experimento — o
         indicador, a situação inicial, a meta, a unidade e o período vêm
         de Mudanças mensuráveis (por resultadoId) e não são editáveis
         aqui. Ver evidenciaHtml().

         Não existe escolha de classificação da hipótese aqui ("Nossa
         hipótese foi: Sustentada/Parcialmente sustentada/Não
         sustentada") — um mesmo experimento pode produzir evidências
         que apontam em direções diferentes (contatos melhoraram, NPS
         quase não mudou), e reduzir isso a um veredito único nesta
         etapa era exatamente o julgamento automático que a dinâmica
         quer evitar. A leitura do conjunto é da etapa Decisão. */
    },
    {
      id: 'decisao',
      titulo: 'D — DECISÃO',
      curto: 'Decisão',
      pergunta: 'O que fazemos com o que aprendemos?',
      exemplo: 'Com base nas evidências observadas, vamos ajustar e testar novamente. Próxima ação: revisar a mensagem de status e repetir o teste com 100 participantes.',
      dica: 'A decisão precisa nascer da evidência registrada — não da preferência de quem defende a ideia.',
      dependeDe: 'evidencia',
      escolha: {
        chave: 'decisao',
        rotulo: 'Decisão',
        curto: 'a decisão',
        /* Fase 4: duas decisões novas — "Rever a mudança mensurável" e
           "Rever o problema" — cada uma abre um Ciclo novo com ponto de
           reinício fixo (ver PONTOS_DE_REINICIO_FIXOS). As cinco
           anteriores continuam com o mesmo sentido de sempre. */
        opcoes: ['Ampliar', 'Ajustar e testar novamente', 'Interromper esta ideia', 'Investigar mais', 'Reformular a hipótese', 'Rever a mudança mensurável', 'Rever o problema'],
        /* Só ajuda/tooltip — a interpretação não decide pela dupla, e o
           bloco de evidência acima já não emite nenhum veredito
           automático de "hipótese certa/errada" (ver cardConexao). */
        dicas: {
          'Ampliar': 'Há evidências suficientes para testar a ideia em uma escala maior ou incorporá-la progressivamente.',
          'Ajustar e testar novamente': 'As evidências sugerem que vale modificar algum aspecto da ideia ou do experimento e realizar novo teste.',
          'Interromper esta ideia': 'As evidências não justificam continuar investindo nesta solução neste momento.',
          'Investigar mais': 'Ainda faltam informações para decidir. É necessário aprender mais antes de escolher o próximo caminho.',
          'Reformular a hipótese': 'As evidências indicam que a explicação atual para o problema precisa ser revista.',
          'Rever a mudança mensurável': 'O que estava sendo medido, ou a meta definida, não descreve mais o que precisa mudar.',
          'Rever o problema': 'O que aprendemos aponta que a própria definição do problema precisa ser revista.'
        },
        /* Microexplicação — sempre visível embaixo dos botões assim que
           uma decisão é escolhida (não é o mesmo texto de "dicas" acima,
           que só aparece no hover/toque longo; aqui o texto tem de estar
           lendo-se sem precisar descobrir que existe uma dica). Textos
           exatos pedidos no ajuste — não reaproveita "dicas" de propósito,
           para não misturar os dois pedidos por engano numa edição futura. */
        explicacoes: {
          'Ampliar': 'As evidências são suficientes para aumentar a escala da aposta.',
          'Ajustar e testar novamente': 'Há sinais promissores, mas algo precisa mudar antes de um novo teste.',
          'Interromper esta ideia': 'O aprendizado indica que não vale continuar investindo nesta ideia.',
          'Investigar mais': 'Ainda não temos evidência suficiente para decidir sobre a aposta.',
          'Reformular a hipótese': 'A evidência sugere que nossa explicação para o problema precisa mudar.',
          'Rever a mudança mensurável': 'O aprendizado indica que a mudança mensurável definida precisa ser revista.',
          'Rever o problema': 'O aprendizado indica que a própria definição do problema precisa ser revista.'
        }
      },
      campos: [
        { chave: 'proximaAcao', tipo: 'textarea', rotulo: 'Próxima ação', curto: 'a próxima ação', placeholder: 'ajustar a comunicação e repetir o teste com um grupo maior', dica: 'O que faremos agora?' },
        { chave: 'responsavel', tipo: 'input', rotulo: 'Responsável pela próxima ação', placeholder: 'nome', dica: 'Quem será responsável por conduzir o próximo passo?' },
        /* "Prazo da próxima ação" é DURAÇÃO ("em quanto tempo"), não uma
           data — o que as próprias execuções antigas mostravam era "10
           dias", não "30/10/2026". Não é o prazo da meta (esse mora em
           Mudanças mensuráveis) nem a Data de reavaliação (essa sim um
           DIA marcado no calendário para reencontrar o grupo) — os
           quatro tempos da dinâmica (prazo da meta, duração do
           experimento, prazo da próxima ação, data de reavaliação)
           nunca se confundem. */
        { chave: 'prazo', tipo: 'quantidade', rotulo: 'Prazo da próxima ação', curto: 'o prazo da próxima ação', placeholder: '10', unidadePadrao: 'dias', dica: 'Em quanto tempo executaremos o próximo passo decidido?' },
        { chave: 'reavaliacao', tipo: 'data', rotulo: 'Data de reavaliação', placeholder: 'dd/mm/aaaa', dica: 'Quando voltaremos a analisar esta aposta e os novos aprendizados?' },
        /* A próxima hipótese é uma hipótese: ganha o mesmo apoio de
           preenchimento da etapa 5 — mesmo molde, mesmas duas lacunas —,
           senão volta a ser um campo em branco pedindo uma frase que a
           pessoa acabou de aprender a montar. O prefixo "proxHip" é só
           para não sobrescrever o que ficou registrado na etapa
           Hipótese: a hipótese original continua lá, intacta. */
        { chave: 'proxHipCausa', tipo: 'textarea', rotulo: 'Causa provável', placeholder: 'a mensagem não chega a quem está em análise' },
        { chave: 'proxHipIndicio', tipo: 'textarea', rotulo: 'Qual indício temos?', placeholder: 'os contatos caíram só no grupo que recebeu a mensagem' }
      ],
      /* O traço solto ("vamos ampliar — a comunicação com um grupo maior")
         não dizia que relação as duas partes têm. A decisão é uma coisa;
         o que se faz a seguir é outra, e agora a frase diz isso. */
      molde: ['Com base nas evidências observadas, vamos', { escolha: true, baixa: true }, '. Próxima ação:', { c: 'proximaAcao' }, '.'],
      /* A Nova Hipótese não aparece do mesmo jeito para toda decisão (ver
         moldeHtml() e atualizarGruposPorEscolha()): "Ampliar" e
         "Investigar mais" encerram ou adiam a pergunta, e o bloco fica
         oculto; "Ajustar e testar novamente" e "Interromper esta ideia"
         deixam a porta aberta, mas começam recolhidos — ninguém é
         obrigado a reformular a hipótese por causa delas; só "Reformular
         a hipótese" abre sozinho, porque é a única que PEDE uma
         explicação nova agora. */
      grupos: [{
        id: 'apostaGrupoNovaHipotese',
        rotulo: 'Nova hipótese',
        resumoQuando: 'Reformular hipótese também',
        dicaObrigatoria: 'A decisão "Reformular a hipótese" pede uma explicação nova para o próximo ciclo.',
        escondeQuando: ['Ampliar', 'Investigar mais'],
        abreAutoQuando: ['Reformular a hipótese'],
        dependeDaEscolha: 'decisao',
        legado: 'proximaHipotese',
        /* Mesmo molde de duas frases da etapa Hipótese (ver comentário
           lá): o sinal continua não sendo prova, só motivo de cogitar. */
        molde: ['Acreditamos que isso acontece porque', { c: 'proxHipCausa' }, '. Essa hipótese surgiu porque observamos que', { c: 'proxHipIndicio' }, '.']
      }]
    }
  ];

  function etapaPorId(id) {
    for (var i = 0; i < ETAPAS.length; i++) if (ETAPAS[i].id === id) return ETAPAS[i];
    return null;
  }
  function indiceEtapa(id) {
    for (var i = 0; i < ETAPAS.length; i++) if (ETAPAS[i].id === id) return i;
    return 0;
  }

  /* ══════════════════════════════════════════════════════════════
     VALIDAÇÕES DIDÁTICAS

     Todas NÃO BLOQUEIAM. O grupo sempre consegue avançar — o aviso
     é um convite a reler, não um portão. Bloquear aqui seria pior
     que o erro: trava a conversa da sala por causa de uma palavra,
     e a facilitadora perde o momento de ensinar a diferença.

     Não há chamada a modelo de linguagem: o site não tem servidor,
     e uma chave de API no navegador é uma chave publicada. As
     regras abaixo são de texto, que é o que a própria dinâmica
     descreve (procurar "porque", "devido a", "precisamos criar"…).
     ══════════════════════════════════════════════════════════════ */
  var CAUSA_OU_SOLUCAO = /\b(porque|por que|porqu[eê]|devido a|em raz[ãa]o de|j[áa] que|uma vez que|a solu[çc][ãa]o|precisamos criar|precisamos implantar|deveríamos criar|basta criar|vamos criar|implementar|implantar)\b/i;
  var PARECE_ACAO = /\b(criar|construir|implantar|implementar|desenvolver|contratar|enviar|lan[çc]ar|fazer|montar|instalar|comprar)\b/i;
  var TEM_NUMERO = /\d/;
  var CERTEZA = /\b(com certeza|certamente|obviamente|[ée] [óo]bvio|sabemos que|com toda certeza|sem d[úu]vida|claramente)\b/i;
  var MUITA_TECNOLOGIA = /\b(api|integra[çc][ãa]o|microsservi[çc]o|banco de dados|app|aplicativo|sistema|plataforma|chatbot|portal|infraestrutura)\b/i;
  var LINGUAGEM_DE_PROVA = /\b(prova que|comprov(ou|a)|confirm(ou|a)|hip[óo]tese (correta|errada)|deu certo|deu errado|sucesso|fracasso)\b/i;

  function normalizar(s) {
    return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  /* Devolve lista de avisos (strings). Lista vazia = nada a dizer. */
  function validar(etapaId, dados) {
    var d = dados || {};
    var avisos = [];

    if (etapaId === 'sintoma') {
      if (CAUSA_OU_SOLUCAO.test(d.texto || '')) {
        avisos.push('Parece que você já está explicando a causa ou propondo uma solução. Neste momento, tente registrar apenas o que é observado.');
      }
    }

    if (etapaId === 'problema') {
      var sint = normalizar((_dados.sintoma || {}).texto);
      var prob = normalizar([d.quem, d.situacaoIndesejada].join(' '));
      /* Repetição literal: o grupo copiou o sintoma e não transformou nada. */
      if (sint && prob.indexOf(sint) !== -1) {
        avisos.push('Isso repete o sintoma. Que situação indesejada esse sintoma revela?');
      }
    }

    if (etapaId === 'mudancas') {
      var lista = d.itens || [];
      if (!lista.length) {
        avisos.push('Como você saberia objetivamente que isso melhorou? Registre pelo menos uma mudança mensurável.');
      }
      lista.forEach(function (m) {
        if (PARECE_ACAO.test(m.indicador || '')) {
          avisos.push('"' + (m.indicador || '') + '" parece uma ação ou solução. Tente descrever qual resultado mudaria se essa ação funcionasse.');
        }
        if (!TEM_NUMERO.test(String(m.atual || '') + String(m.meta || ''))) {
          avisos.push('Falta a medida em "' + (m.indicador || 'sua mudança') + '". Como você saberia objetivamente que isso melhorou?');
        }
        var atualN = paraNumero(m.atual), metaN = paraNumero(m.meta);
        if (atualN != null && metaN != null && atualN !== metaN) {
          if (m.direcao === 'Aumentar' && metaN < atualN) {
            avisos.push('Em "' + (m.indicador || 'sua mudança') + '", a meta é menor que a situação atual — confere se não é "Reduzir"?');
          } else if (m.direcao === 'Reduzir' && metaN > atualN) {
            avisos.push('Em "' + (m.indicador || 'sua mudança') + '", a meta é maior que a situação atual — confere se não é "Aumentar"?');
          }
        }
        /* "1.000 contatos" sozinho não diz se é por dia ou por ano — uma
           contagem ou uma taxa só quer dizer alguma coisa com uma base de
           tempo junto. Não inventa o período (nunca deduzido do prazo,
           nunca de outro campo): só pede para a pessoa informar, ou dizer
           que não se aplica a este indicador. */
        if (m.formaMedicao === 'Quantidade' || m.formaMedicao === 'Taxa / Razão') {
          if (!normalizar(migrarUnidadePeriodo(m).periodo)) {
            avisos.push('"' + (m.indicador || 'sua mudança') + '" conta algo ao longo do tempo — em qual período (por mês, por semana...)? Se não se aplicar, marque "não se aplica".');
          }
        }
      });
    }

    if (etapaId === 'hipotese') {
      if (CERTEZA.test([d.causa, d.indicio].join(' '))) {
        avisos.push('Como ainda não testamos isso, você poderia formulá-la como uma hipótese?');
      }
    }

    if (etapaId === 'ideia') {
      if (MUITA_TECNOLOGIA.test([d.acao, d.mudanca, d.texto].join(' '))) {
        avisos.push('Antes de definir a implementação, qual mudança você pretende provocar?');
      }
    }

    if (etapaId === 'evidencia') {
      (d.itens || []).forEach(function (ev) {
        if (LINGUAGEM_DE_PROVA.test(ev.aprendizado || '')) {
          avisos.push('Isso soa como uma conclusão fechada. O que esta evidência sugere, sem tratá-la como prova definitiva da hipótese?');
        }
        if (ev.fontePrevista === 'Outro' && !normalizar(ev.comoSeraMedido)) {
          avisos.push('A fonte prevista é "Outro" — vale detalhar como esse resultado será medido, para o grupo lembrar depois da execução.');
        }
      });
    }

    if (etapaId === 'decisao') {
      var itensEv = (_dados.evidencia || {}).itens || [];
      var temEvidencia = itensEv.some(function (ev) { return normalizar(ev.observado) || ev.naoMedido === 'sim'; });
      if (!temEvidencia) {
        avisos.push('A decisão precisa se apoiar na evidência. Volte e registre o que realmente aconteceu no experimento.');
      }
      /* Não bloqueia — nenhum aviso aqui bloqueia. É o mesmo convite a
         reler, só que agora específico da decisão escolhida. */
      if (d.decisao === 'Reformular a hipótese' && !normalizar(d.proxHipCausa) && !normalizar(d.proxHipIndicio)) {
        avisos.push('A decisão "Reformular a hipótese" pede uma nova hipótese: o que passa a explicar o problema agora?');
      }
    }

    return avisos;
  }

  /* Uma etapa está "preenchida" quando tem conteúdo de verdade — é o
     que move a trilha e libera a próxima. Não exige perfeição: exige
     que o grupo tenha escrito alguma coisa. */
  /* Uma etapa está "preenchida" quando tem conteúdo de verdade — é o
     que move a trilha e libera a próxima. Não exige perfeição: exige
     que o grupo tenha escrito alguma coisa.

     Campo de VARIANTES não conta: ele já nasce com um valor escolhido
     (a concordância do verbo), e contar esse valor como conteúdo faria
     a etapa se dar por preenchida sem ninguém ter escrito nada — a
     trilha marcaria como feita e liberaria a seguinte. */
  function etapaPreenchida(etapaId, dados) {
    var d = (dados || {})[etapaId] || {};
    if (etapaId === 'mudancas') {
      return (d.itens || []).some(function (m) {
        return ['indicador', 'atual', 'meta', 'unidade', 'prazo', 'limiteMinimo', 'limiteMaximo'].some(function (k) { return normalizar(m[k]); });
      });
    }
    if (etapaId === 'evidencia') {
      return (d.itens || []).some(function (ev) { return normalizar(ev.observado) || ev.naoMedido === 'sim'; });
    }
    var etapa = etapaPorId(etapaId);
    if (!etapa) return false;
    if (etapa.escolha && d[etapa.escolha.chave]) return true;
    var campos = etapa.campos || [];
    for (var i = 0; i < campos.length; i++) {
      if (campos[i].tipo === 'variantes') continue;
      if (normalizar(d[campos[i].chave])) return true;
    }
    if (etapa.legado && normalizar(d[etapa.legado])) return true;
    return false;
  }

  /* ══════════════════════════════════════════════════════════════
     A FRASE DE CADA ETAPA — UM MOLDE SÓ

     `molde` descreve a frase inteira numa lista: texto FIXO (string)
     e LACUNAS ({ c: 'chave' } de um campo, ou { escolha: true }).
     Dele saem as três coisas que precisam concordar entre si:

       · o formulário  — o fixo aparece na tela como texto, e só as
                         lacunas são digitáveis. Antes a frase-modelo
                         ficava num quadro no topo ("[Quem] não
                         consegue [o quê]…") e os campos embaixo, sem
                         ligação visível: no primeiro uso real a frase
                         inteira foi digitada dentro de um campo só;
       · a prévia      — "fica assim no mapa", ao vivo, com o que
                         ainda falta marcado no lugar exato;
       · o mapa/CSV    — resumoEtapa, a mesma montagem.

     Uma descrição só é o que impede a prévia de mentir sobre o mapa.
     ══════════════════════════════════════════════════════════════ */
  /* ── Prazo: número + unidade ──────────────────────────────────────
     "90 dias" digitado à mão vira "90 dia", "3 mes", "90dias" — e o mapa
     sai com a unidade de cada grupo escrita de um jeito. Quem preenche
     escreve só o número e escolhe a unidade numa lista; a flexão é do
     site, não de quem está com o celular na mão numa sala. */
  var UNIDADES = ['segundos', 'minutos', 'horas', 'dias', 'semanas', 'meses', 'bimestres', 'trimestres', 'anos'];
  var SINGULAR = {
    segundos: 'segundo', minutos: 'minuto', horas: 'hora', dias: 'dia', semanas: 'semana',
    meses: 'mês', bimestres: 'bimestre', trimestres: 'trimestre', anos: 'ano'
  };
  function unidadeFlexionada(unidade, numero) {
    var u = UNIDADES.indexOf(unidade) !== -1 ? unidade : 'dias';
    return Number(String(numero).replace(',', '.')) === 1 ? SINGULAR[u] : u;
  }
  function chaveUnidade(chave) { return chave + 'Unidade'; }
  function quantidadeEmTexto(campo, d) {
    var num = String(d[campo.chave] == null ? '' : d[campo.chave]).trim();
    if (!num) return '';
    return num + ' ' + unidadeFlexionada(d[chaveUnidade(campo.chave)] || campo.unidadePadrao, num);
  }

  /* ── Máscaras ──
     Aplicadas enquanto se digita. São de tela: o que vai para o banco é
     o que está no campo, já formatado, para o mapa e o CSV saírem iguais
     ao que a pessoa viu. */
  function mascaraNumero(v) { return String(v == null ? '' : v).replace(/\D/g, '').slice(0, 6); }
  function mascaraData(v) {
    var d = String(v == null ? '' : v).replace(/\D/g, '').slice(0, 8);
    if (d.length > 4) return d.slice(0, 2) + '/' + d.slice(2, 4) + '/' + d.slice(4);
    if (d.length > 2) return d.slice(0, 2) + '/' + d.slice(2);
    return d;
  }
  function mascaraMoeda(v) {
    var d = String(v == null ? '' : v).replace(/\D/g, '').slice(0, 12);
    if (!d) return '';
    var n = parseInt(d, 10) / 100;
    return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  var MASCARAS = { numero: mascaraNumero, data: mascaraData, moeda: mascaraMoeda };
  function aplicarMascara(el) {
    var f = MASCARAS[el.dataset.mascara];
    if (!f) return;
    var novo = f(el.value);
    if (novo !== el.value) el.value = novo;
  }

  function campoPorChave(etapa, chave) {
    var campos = etapa.campos || [];
    for (var i = 0; i < campos.length; i++) if (campos[i].chave === chave) return campos[i];
    return null;
  }
  function rotuloCurto(c, chave) {
    if (!c) return chave;
    return c.curto || String(c.rotulo || chave).toLowerCase();
  }
  /* O campo aceita as opções prontas OU qualquer outro texto — "não
     consegue"/"não conseguem" não esgotam toda concordância possível
     ("não tem conseguido", por exemplo). Só cai na primeira opção
     quando ainda não há nada escrito; o que já foi digitado (mesmo que
     não bata com nenhuma das opções) é respeitado como está. */
  function valorVariante(campo, valor) {
    var v = String(valor == null ? '' : valor).trim();
    if (v) return v;
    var op = (campo && campo.opcoes) || [];
    return op[0] || '';
  }

  /* Devolve a frase em pedaços: { tipo: 'fixo' | 'valor' | 'vazio' }. */
  function partesDaFrase(etapa, d) {
    d = d || {};
    var out = [];
    (etapa.molde || []).forEach(function (p) {
      if (typeof p === 'string') { out.push({ tipo: 'fixo', txt: p }); return; }
      if (p.escolha) {
        var esc_ = etapa.escolha || {};
        var v = d[esc_.chave] || '';
        if (v && p.baixa) v = v.toLowerCase();
        out.push(v
          ? { tipo: 'valor', txt: v, chave: esc_.chave, escolha: true }
          : { tipo: 'vazio', rotulo: esc_.curto || String(esc_.rotulo || '').toLowerCase(), chave: esc_.chave, escolha: true });
        return;
      }
      var campo = campoPorChave(etapa, p.c);
      var val = String(d[p.c] == null ? '' : d[p.c]).trim();
      if (campo && campo.tipo === 'variantes') {
        out.push({ tipo: 'valor', txt: valorVariante(campo, val), chave: p.c, variante: true });
        return;
      }
      if (campo && campo.tipo === 'quantidade') val = quantidadeEmTexto(campo, d);
      out.push(val
        ? { tipo: 'valor', txt: val, chave: p.c }
        : { tipo: 'vazio', rotulo: rotuloCurto(campo, p.c), chave: p.c, opcional: !!(campo && campo.opcional) });
    });
    for (var i = 0; i < out.length - 1; i++) {
      if (out[i].tipo === 'fixo' && out[i + 1].tipo === 'valor') {
        out[i].txt = semPreposicaoDupla(out[i].txt, out[i + 1].txt);
      }
    }
    return out;
  }

  /* Junta os pedaços numa frase. Pontuação cola no que vem antes —
     senão sairia "…autonomia , evidenciado por". */
  function juntarPartes(partes, textoDoVazio) {
    var s = '';
    partes.forEach(function (p) {
      var txt = p.tipo === 'vazio' ? textoDoVazio(p) : p.txt;
      if (!txt) return;
      if (!s) { s = txt; return; }
      s += (/^[,.;:!?]/.test(txt) ? '' : ' ') + txt;
    });
    return s;
  }

  /* A mesma frase em HTML, para a prévia ao vivo: o que a pessoa
     escreveu em destaque, o texto fixo apagado e a lacuna com o nome
     do que falta, no lugar exato em que vai entrar. */
  function htmlDaFrase(partes) {
    var html = '';
    partes.forEach(function (p) {
      var bruto = p.tipo === 'vazio' ? (p.opcional ? '' : p.rotulo) : p.txt;
      if (!bruto) return;
      var peca = p.tipo === 'vazio'
        ? '<span class="aposta-frase-vazio" data-ir="' + esc(p.chave) + '">' + esc(p.rotulo) + '</span>'
        : (p.tipo === 'valor'
            ? '<strong class="aposta-frase-valor">' + esc(p.txt) + '</strong>'
            : '<span class="aposta-frase-fixo">' + esc(p.txt) + '</span>');
      html += (html && !/^[,.;:!?]/.test(bruto) ? ' ' : '') + peca;
    });
    return html;
  }

  /* ── Mudanças mensuráveis: a mesma ideia, uma frase por item ──
     [Direção] [indicador] de [situação atual] para [meta] [unidade]
     [período, quando aplicável] em [prazo]. Percentual é o único caso
     em que a unidade gruda nos dois números ("de 30% para 60%") — nos
     demais ela só aparece uma vez, depois da meta ("para 500 contatos
     por mês"), do jeito que se fala. */
  var FORMAS_MEDICAO = ['Quantidade', 'Percentual', 'Tempo', 'Moeda', 'Pontos / Escala', 'Índice', 'Taxa / Razão', 'Outro'];
  var UNIDADES_SUGERIDAS = {
    'Quantidade': ['contatos', 'processos', 'casos', 'atendimentos', 'pessoas', 'ocorrências', 'demandas', 'iniciativas', 'experimentos', 'decisões'],
    'Tempo': ['minutos', 'horas', 'dias', 'semanas', 'meses'],
    'Pontos / Escala': ['pontos', 'escala de 0 a 5', 'escala de 0 a 10'],
    'Índice': ['NPS', 'índice de satisfação', 'índice interno'],
    'Taxa / Razão': ['erros por 1.000 processos', 'incidentes por atendimento', 'reclamações por 100 concessões']
  };
  /* Percentual e Moeda não pedem escolha: a unidade já nasce certa, e
     continua editável se alguém quiser outra coisa. */
  var UNIDADE_AUTOMATICA = { 'Percentual': '%', 'Moeda': 'R$' };
  var PERIODOS_SUGERIDOS = ['por dia', 'por semana', 'por mês', 'por trimestre', 'por semestre', 'por ano', 'por atendimento', 'por processo', 'não se aplica'];

  /* Antes de existir um campo Período próprio, o que hoje é Período
     morava dentro de Unidade ("por mês", "por atendimento" — ver
     PR #165/#171). Uma execução antiga com esse valor em "unidade"
     continua lida corretamente: é período, não unidade de contagem. */
  var PARECE_PERIODO = /^(por |n[ãa]o se aplica$)/i;
  function migrarUnidadePeriodo(m) {
    var unidade = String((m || {}).unidade == null ? '' : m.unidade).trim();
    var periodo = String((m || {}).periodo == null ? '' : m.periodo).trim();
    if (!periodo && unidade && PARECE_PERIODO.test(unidade)) { periodo = unidade; unidade = ''; }
    return { unidade: unidade, periodo: periodo };
  }

  /* NPS (Forma de medição "Índice", Unidade "NPS") é um índice, não uma
     contagem ao longo do tempo — "5 NPS por dia" não quer dizer nada.
     Período trava em "não se aplica" enquanto essa combinação estiver
     selecionada (ver mudancasHtml/atualizarPeriodoNPS), e as funções que
     montam frase/resumo (partesMudanca, resumoCurtoMudanca,
     sufixoUnidade) leem esse período já corrigido — nenhuma delas
     precisa checar NPS por conta própria. */
  function ehIndiceNPS(m) {
    return String((m || {}).formaMedicao || '').trim() === 'Índice' && normalizar((m || {}).unidade) === 'nps';
  }

  /* "1.000", "1000" e "1.000,5" viram um número comparável — ponto é
     separador de milhar, vírgula é decimal, a mesma convenção de
     mascaraMoeda. null quando não dá para comparar. */
  function paraNumero(v) {
    var s = String(v == null ? '' : v).trim().replace(/\./g, '').replace(',', '.');
    if (!s || !/^-?\d+(\.\d+)?$/.test(s)) return null;
    return parseFloat(s);
  }

  /* Direção da mudança: as quatro opções cobrem tudo, sem precisar de
     uma quinta para "eliminar" (Reduzir para 0), "não ultrapassar"
     (Manter + No máximo), "não ficar abaixo de" (Manter + Pelo menos)
     ou "permanecer numa faixa" (Manter + Entre). */
  var DIRECOES_MUDANCA = ['Aumentar', 'Reduzir', 'Manter', 'Atingir'];
  var TIPOS_LIMITE = ['Pelo menos', 'No máximo', 'Entre'];

  function partesMudanca(m) {
    m = m || {};
    var direcao = String(m.direcao || '').trim() || 'Aumentar';
    var indicador = String(m.indicador || '').trim();
    var mig = migrarUnidadePeriodo(m);
    var periodoAplica = mig.periodo && normalizar(mig.periodo) !== 'não se aplica' && !ehIndiceNPS(m);
    var ehPercentual = mig.unidade === '%';
    /* "Aumentar NPS de 5 NPS para 7 NPS" repete a unidade — só para NPS
       (Índice + Unidade "NPS"): ali o indicador costuma ser o próprio
       nome do índice, e repeti-lo depois de cada número é ruído, não
       informação. Para as demais unidades (ex.: indicador "contatos
       sobre o andamento" com Unidade "contatos") a repetição continua
       de propósito — ver comentário abaixo de numeroComUnidade — por
       isso esta supressão fica restrita a ehIndiceNPS, sem mexer no
       comportamento geral (inclusive o do ramo "Atingir" logo abaixo,
       que já tinha sua própria checagem, mais ampla, antes disto). */
    var suprimirUnidadeNPS = ehIndiceNPS(m);

    function comSufixo(val) { return ehPercentual ? val + '%' : val; }
    /* "contatos por mês" — só entra depois do ÚLTIMO número da frase,
       nunca repetido em cada um (ver Percentual, que já gruda "%" em
       cada valor por conta própria). */
    function unidadePeriodoTxt() {
      var partes = [];
      if (!ehPercentual && mig.unidade && !suprimirUnidadeNPS) partes.push(mig.unidade);
      if (periodoAplica) partes.push(mig.periodo);
      return partes.join(' ');
    }

    var prazo = String(m.prazo == null ? '' : m.prazo).trim();
    if (prazo) prazo = prazo + ' ' + unidadeFlexionada(m.prazoUnidade, prazo);

    if (direcao === 'Manter') {
      var tipoLimite = String(m.tipoLimite || '').trim() || 'Pelo menos';
      var partesM = [
        { tipo: 'valor', txt: 'Manter', chave: 'direcao' },
        indicador ? { tipo: 'valor', txt: indicador, chave: 'indicador' } : { tipo: 'vazio', rotulo: 'o indicador', chave: 'indicador' }
      ];
      if (tipoLimite === 'Entre') {
        var minV = String(m.limiteMinimo == null ? '' : m.limiteMinimo).trim();
        var maxV = String(m.limiteMaximo == null ? '' : m.limiteMaximo).trim();
        partesM.push({ tipo: 'fixo', txt: 'entre' });
        partesM.push(minV
          ? { tipo: 'valor', txt: comSufixo(minV), chave: 'limiteMinimo' }
          : { tipo: 'vazio', rotulo: 'o limite mínimo', chave: 'limiteMinimo' });
        partesM.push({ tipo: 'fixo', txt: 'e' });
        var up = unidadePeriodoTxt();
        partesM.push(maxV
          ? { tipo: 'valor', txt: comSufixo(maxV) + (up ? ' ' + concordarSufixo(maxV, up) : ''), chave: 'limiteMaximo' }
          : { tipo: 'vazio', rotulo: 'o limite máximo', chave: 'limiteMaximo' });
      } else {
        partesM.push({ tipo: 'fixo', txt: tipoLimite === 'No máximo' ? 'em no máximo' : 'em pelo menos' });
        var metaV = String(m.meta == null ? '' : m.meta).trim();
        var up2 = unidadePeriodoTxt();
        partesM.push(metaV
          ? { tipo: 'valor', txt: comSufixo(metaV) + (up2 ? ' ' + concordarSufixo(metaV, up2) : ''), chave: 'meta' }
          : { tipo: 'vazio', rotulo: 'a meta', chave: 'meta' });
      }
      partesM.push({ tipo: 'fixo', txt: 'durante' });
      partesM.push(prazo ? { tipo: 'valor', txt: prazo, chave: 'prazo' } : { tipo: 'vazio', rotulo: 'o prazo', chave: 'prazo' });
      partesM.push({ tipo: 'fixo', txt: '.' });
      return partesM;
    }

    if (direcao === 'Atingir') {
      var metaA = String(m.meta == null ? '' : m.meta).trim();
      /* "Atingir 60 NPS de NPS da experiência..." repete a unidade —
         quando o indicador já começa pelo nome da própria unidade
         (caso comum em índices como NPS), a unidade some do meio da
         frase e some antes do número: "Atingir NPS 60 em 90 dias." */
      var indicadorComecaComUnidade = !!mig.unidade &&
        normalizar(indicador).indexOf(normalizar(mig.unidade)) === 0;
      var partesA = [{ tipo: 'valor', txt: 'Atingir', chave: 'direcao' }];
      if (indicadorComecaComUnidade) {
        partesA.push({ tipo: 'valor', txt: mig.unidade, chave: 'unidade' });
        partesA.push(metaA ? { tipo: 'valor', txt: metaA, chave: 'meta' } : { tipo: 'vazio', rotulo: 'a meta', chave: 'meta' });
      } else {
        var metaTxt = metaA ? comSufixo(metaA) + (!ehPercentual && mig.unidade ? ' ' + concordarSufixo(metaA, mig.unidade) : '') : '';
        partesA.push(metaA ? { tipo: 'valor', txt: metaTxt, chave: 'meta' } : { tipo: 'vazio', rotulo: 'a meta', chave: 'meta' });
        partesA.push({ tipo: 'fixo', txt: 'de' });
        partesA.push(indicador ? { tipo: 'valor', txt: indicador, chave: 'indicador' } : { tipo: 'vazio', rotulo: 'o indicador', chave: 'indicador' });
        if (periodoAplica) partesA.push({ tipo: 'valor', txt: mig.periodo, chave: 'periodo' });
      }
      partesA.push({ tipo: 'fixo', txt: 'em' });
      partesA.push(prazo ? { tipo: 'valor', txt: prazo, chave: 'prazo' } : { tipo: 'vazio', rotulo: 'o prazo', chave: 'prazo' });
      partesA.push({ tipo: 'fixo', txt: '.' });
      return partesA;
    }

    /* Aumentar / Reduzir / uma direção livre digitada por cima. Unidade e
       período de medição qualificam TANTO a situação atual quanto a meta
       — são a mesma referência de medição para os dois números, não só
       do último. "de 1.000 contatos por semana para 700 contatos por
       semana" deixa isso explícito; grudar o sufixo só depois da meta
       ("de 1.000 para 700 contatos por semana") lia como se unidade e
       período fossem só da meta — relatado no pedido de ajuste. */
    var sufixoUP = unidadePeriodoTxt();
    function numeroComUnidade(chave, rotulo) {
      var val = String(m[chave] == null ? '' : m[chave]).trim();
      if (!val) return { tipo: 'vazio', rotulo: rotulo, chave: chave };
      var txt = comSufixo(val);
      if (sufixoUP) txt += ' ' + concordarSufixo(val, sufixoUP);
      return { tipo: 'valor', txt: txt, chave: chave };
    }
    var partes = [
      { tipo: 'valor', txt: direcao, chave: 'direcao' },
      indicador ? { tipo: 'valor', txt: indicador, chave: 'indicador' } : { tipo: 'vazio', rotulo: 'o indicador', chave: 'indicador' },
      { tipo: 'fixo', txt: 'de' },
      numeroComUnidade('atual', 'a situação atual'),
      { tipo: 'fixo', txt: 'para' },
      numeroComUnidade('meta', 'a meta'),
      { tipo: 'fixo', txt: 'em' },
      prazo ? { tipo: 'valor', txt: prazo, chave: 'prazo' } : { tipo: 'vazio', rotulo: 'o prazo', chave: 'prazo' },
      { tipo: 'fixo', txt: '.' }
    ];
    return partes;
  }
  function fraseMudanca(m) {
    return juntarPartes(partesMudanca(m), function (p) { return p.opcional ? '' : '—'; });
  }

  /* "Manter" não tem uma meta única — tem um limite, e o tipo de limite
     decide o que "coerente" significa: Pelo menos X pede situação atual
     ≥ X, No máximo X pede situação atual ≤ X, Entre X e Y pede X ≤
     situação atual ≤ Y (as pontas contam), com X ≤ Y de saída — apagar
     abaixo/acima do intervalo, ou inverter os limites, não é uma questão
     de direção errada, então cada caso tem sua mensagem e (quando faz
     sentido) uma dupla de direções plausíveis, nunca uma escolhida
     sozinha. */
  function inconsistenciaManter(m) {
    m = m || {};
    var atual = paraNumero(m.atual);
    var tipoLimite = String(m.tipoLimite || '').trim() || 'Pelo menos';
    if (tipoLimite === 'Entre') {
      var minV = paraNumero(m.limiteMinimo), maxV = paraNumero(m.limiteMaximo);
      if (minV != null && maxV != null && minV > maxV) {
        return { mensagem: 'O limite mínimo não pode ser maior que o limite máximo.', opcoes: [] };
      }
      if (atual == null || minV == null || maxV == null) return null;
      if (atual < minV) {
        return { mensagem: 'A situação atual está abaixo do intervalo que você deseja manter. Você quis selecionar "Aumentar" ou "Atingir"?', opcoes: ['Aumentar', 'Atingir'] };
      }
      if (atual > maxV) {
        return { mensagem: 'A situação atual está acima do intervalo que você deseja manter. Você quis selecionar "Reduzir" ou "Atingir"?', opcoes: ['Reduzir', 'Atingir'] };
      }
      return null;
    }
    var limite = paraNumero(m.meta);
    if (atual == null || limite == null) return null;
    if (tipoLimite === 'No máximo') {
      if (atual > limite) {
        return { mensagem: 'A situação atual está acima do limite que você deseja manter. Você quis selecionar "Reduzir" ou "Atingir"?', opcoes: ['Reduzir', 'Atingir'] };
      }
      return null;
    }
    /* 'Pelo menos', a opção padrão. */
    if (atual < limite) {
      return { mensagem: 'A situação atual está abaixo do limite que você deseja manter. Você quis selecionar "Aumentar" ou "Atingir"?', opcoes: ['Aumentar', 'Atingir'] };
    }
    return null;
  }

  /* Única fonte da verdade sobre "os números batem com a direção
     escolhida" — usada pelo alerta perto do campo (que corrige com um
     clique, mas nunca sozinho), para decidir se a frase aparece (em vez
     do convite a corrigir) e para bloquear CONTINUAR. Só entra em jogo
     com Aumentar/Reduzir/Manter e os valores numéricos preenchidos —
     Atingir mira um valor-alvo sem "maior/menor" automático, e uma
     direção livre digitada por cima não tem relação obrigatória
     nenhuma. Campos em branco não são "incoerentes", são "incompletos"
     — a lacuna já avisa o que falta, sem mais um aviso por cima. */
  function alertaInfoMudanca(m) {
    var direcao = String((m || {}).direcao || '').trim();
    if (direcao === 'Manter') return inconsistenciaManter(m);
    if (direcao !== 'Aumentar' && direcao !== 'Reduzir') return null;
    var atual = paraNumero((m || {}).atual), meta = paraNumero((m || {}).meta);
    if (atual == null || meta == null || atual === meta) return null;
    if (direcao === 'Aumentar' && meta < atual) {
      return { mensagem: 'A meta informada é menor que a situação atual. Você quis selecionar “Reduzir”?', opcoes: ['Reduzir'] };
    }
    if (direcao === 'Reduzir' && meta > atual) {
      return { mensagem: 'A meta informada é maior que a situação atual. Você quis selecionar “Aumentar”?', opcoes: ['Aumentar'] };
    }
    return null;
  }
  function mudancaCoerente(m) {
    return !alertaInfoMudanca(m);
  }
  /* Alerta próximo ao campo, não um portão: mostra o porquê e, quando
     existe uma ou mais direções plausíveis, um botão por opção — sem
     exigir apagar e escolher de novo, e sem trocar nada sozinho. */
  function alertaConsistenciaMudanca(m) {
    var problema = alertaInfoMudanca(m);
    if (!problema) return '';
    var botoes = (problema.opcoes || []).map(function (o) {
      return '<button type="button" class="btn btn--sm" data-corrigir="' + esc(o) + '">Usar "' + esc(o) + '"</button>';
    }).join(' ');
    return '<p class="aposta-aviso-didatico aposta-mudanca-alerta">' + esc(problema.mensagem) + (botoes ? ' ' : '') + botoes + '</p>';
  }
  /* Índice da primeira mudança incoerente (ou -1) — usado só por
     CONTINUAR, para bloquear e destacar exatamente o card errado, sem
     escape por segundo clique. */
  function indiceMudancaIncoerente(dados) {
    var itens = (dados || {}).itens || [];
    for (var i = 0; i < itens.length; i++) {
      if (!mudancaCoerente(itens[i])) return i;
    }
    return -1;
  }

  /* ── Rastreabilidade: Experimento escolhe quais Mudanças mensuráveis
     vai observar; Evidência usa essa escolha para montar um card por
     resultado, sem pedir para redigitar indicador, situação atual,
     meta, unidade ou período — já definidos em Mudanças mensuráveis. */
  function gerarResultadoId() {
    return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }
  function resultadosDe(dadosMudancas, ids) {
    var todos = (dadosMudancas || {}).itens || [];
    if (!ids) return [];
    return ids.map(function (id) {
      return todos.filter(function (m) { return m.id === id; })[0];
    }).filter(Boolean);
  }
  /* "1.000 → 500 contatos por mês", "40% → 80%", "→ entre 2 e 5 dias",
     "→ pelo menos 98%", "atingir NPS 60" — o resumo compacto nos cards
     de seleção do Experimento e no topo de cada card de Evidência. */
  function resumoCurtoMudanca(m) {
    var mig = migrarUnidadePeriodo(m);
    var direcao = String(m.direcao || '').trim();
    var comPercentual = function (v) { return mig.unidade === '%' ? v + '%' : v; };
    var periodoTxt = (mig.periodo && normalizar(mig.periodo) !== 'não se aplica' && !ehIndiceNPS(m)) ? ' ' + mig.periodo : '';
    /* "NPS \n 5 → 7 NPS" repete o indicador, que já está no título acima
       deste resumo (ver resultadosPickerHtml/resultadosProduzirHtml) —
       mesma supressão de partesMudanca, restrita a NPS pelo mesmo motivo
       (para as demais unidades, ex. "contatos", repetir é de propósito). */
    var unidadeTxt = (mig.unidade && mig.unidade !== '%' && !ehIndiceNPS(m)) ? ' ' + mig.unidade : '';
    var atual = m.atual || '—';
    if (direcao === 'Manter') {
      var tipoLimite = String(m.tipoLimite || '').trim() || 'Pelo menos';
      if (tipoLimite === 'Entre') {
        return comPercentual(atual) + ' → entre ' + (m.limiteMinimo || '—') + ' e ' + comPercentual(m.limiteMaximo || '—') + unidadeTxt + periodoTxt;
      }
      var rotulo = tipoLimite === 'No máximo' ? 'no máx. ' : 'pelo menos ';
      return comPercentual(atual) + ' → ' + rotulo + comPercentual(m.meta || '—') + unidadeTxt + periodoTxt;
    }
    if (direcao === 'Atingir') return 'atingir ' + comPercentual(m.meta || '—') + unidadeTxt;
    return comPercentual(atual) + ' → ' + comPercentual(m.meta || '—') + unidadeTxt + periodoTxt;
  }
  /* Seta que resume a direção no bloco "Resultados que queremos
     produzir" da Ideia de solução — Aumentar sobe, Reduzir desce,
     Manter/Atingir são uma mira (não uma trajetória) e ficam com "→". */
  function setaDirecaoMudanca(m) {
    var direcao = String((m || {}).direcao || '').trim();
    if (direcao === 'Aumentar') return '↑ ';
    if (direcao === 'Reduzir') return '↓ ';
    return '→ ';
  }
  /* Bloco somente-leitura entre a Hipótese e o título "Ideia de
     solução": lembra ao grupo qual resultado a ideia pretende produzir,
     antes de pensar na solução. Mesma lista/estilo do "Resultados que
     vamos observar" do Experimento (reaproveita resumoCurtoMudanca) —
     aqui sem seleção, sem checkbox, todas as mudanças mensuráveis já
     cadastradas. */
  function resultadosProduzirHtml() {
    var todos = ((_dados.mudancas || {}).itens || []).filter(function (m) { return normalizar(m.indicador); });
    if (!todos.length) return '';
    return '<div class="aposta-resultados-observar">' +
      '<span class="aposta-frase-rot">Resultados que queremos produzir</span>' +
      '<ul class="aposta-resultados-observar-lista">' +
        todos.map(function (m) {
          return '<li data-resultado-id="' + esc(m.id || '') + '">' +
            '<strong>' + esc(setaDirecaoMudanca(m) + m.indicador) + '</strong>' +
            '<span>' + esc(resumoCurtoMudanca(m)) + '</span>' +
          '</li>';
        }).join('') +
      '</ul>' +
    '</div>';
  }
  var FONTES_EVIDENCIA = ['Dados do sistema', 'Pesquisa com participantes', 'Registros de atendimento',
    'Observação do experimento', 'Entrevistas', 'Medição manual', 'Relatório', 'Outro'];
  /* O sufixo "contatos por mês" / "%" que acompanha os números, igual
     ao que Mudanças mensuráveis já decidiu para aquele resultado. */
  function sufixoUnidade(m) {
    /* NPS não leva sufixo nenhum — nem unidade, nem período: o
       indicador já aparece como título em todo lugar que usa este
       sufixo (card de Evidência, resumo da Decisão, "Resultados do
       experimento"...), e "5 NPS" ao lado de "NPS" no título é
       repetição, não informação (ver ehIndiceNPS). */
    if (ehIndiceNPS(m)) return '';
    var mig = migrarUnidadePeriodo(m);
    if (mig.unidade === '%') return '%';
    var periodoTxt = (mig.periodo && normalizar(mig.periodo) !== 'não se aplica') ? ' ' + mig.periodo : '';
    return (mig.unidade ? ' ' + mig.unidade : '') + periodoTxt;
  }
  /* Concordância número-substantivo nas frases automáticas ("1 contato",
     "2 contatos") — sufixoUnidade() sempre devolve a forma plural (é
     assim que a unidade nasce, digitada ou escolhida numa sugestão),
     porque um único sufixo costuma ser reaproveitado para vários números
     diferentes da mesma frase (situação atual, meta, observado...), e
     cada um pode valer 1 sem que os outros valham. concordarSufixo()
     ajusta só a unidade em si para o valor específico que está sendo
     mostrado — nunca o período ("por mês"), que não concorda com a
     contagem, nem a cláusula depois de "por" nas unidades de taxa
     ("erros por 1.000 processos": só "erros" concorda com o valor da
     frase, "processos" é o denominador, fixo). Unidade é texto livre
     (a pessoa digita ou escolhe uma sugestão), então não há dicionário
     fechado possível — a heurística cobre os padrões regulares do
     português; "meses" é a única irregularidade das sugestões prontas
     (ver UNIDADES_SUGERIDAS), por isso a exceção explícita. */
  var SINGULAR_UNIDADE_EXCECOES = { meses: 'mês' };
  function singularizarPalavra(p) {
    if (SINGULAR_UNIDADE_EXCECOES[p.toLowerCase()]) return SINGULAR_UNIDADE_EXCECOES[p.toLowerCase()];
    if (/ões$/i.test(p)) return p.slice(0, -3) + 'ão';
    if (/ães$/i.test(p)) return p.slice(0, -3) + 'ão';
    if (/ais$/i.test(p)) return p.slice(0, -3) + 'al';
    if (/[eé]is$/i.test(p)) return p.slice(0, -3) + 'el';
    if (/óis$/i.test(p)) return p.slice(0, -3) + 'ol';
    if (/ns$/i.test(p)) return p.slice(0, -2) + 'm';
    if (/[rz]es$/i.test(p)) return p.slice(0, -2);
    if (/s$/i.test(p) && p.length > 1) return p.slice(0, -1);
    return p;
  }
  function concordarSufixo(valor, sufixo) {
    var n = paraNumero(valor);
    if (n == null || Math.abs(n) !== 1 || !sufixo) return sufixo;
    var partes = String(sufixo).split(/(\s+por\s+)/i);
    partes[0] = partes[0].replace(/\S+/g, singularizarPalavra);
    return partes.join('');
  }
  /* O que o card de Evidência mostra no campo "Meta" (sempre
     desabilitado ali) — em "Manter" não é um valor só, é "pelo menos
     X" / "no máximo X" / "entre X e Y". */
  function metaOuLimiteTexto(m, sufixo) {
    if (String(m.direcao || '').trim() === 'Manter') {
      var tipoLimite = String(m.tipoLimite || '').trim() || 'Pelo menos';
      if (tipoLimite === 'Entre') return 'entre ' + (m.limiteMinimo || '—') + ' e ' + (m.limiteMaximo || '—') + concordarSufixo(m.limiteMaximo, sufixo);
      return (tipoLimite === 'No máximo' ? 'no máximo ' : 'pelo menos ') + (m.meta || '—') + concordarSufixo(m.meta, sufixo);
    }
    return (m.meta || '—') + concordarSufixo(m.meta, sufixo);
  }
  /* "Esperávamos reduzir X de 1.000 para 500 contatos por mês em 90
     dias. Após o experimento, observamos 650 contatos por mês." — a
     primeira frase é a MESMA que Mudanças mensuráveis já monta
     (fraseMudanca cobre as quatro direções sozinha), só com "Esperávamos"
     na frente; nada é redigitado, só o observado é novo. */
  /* A frase "Esperávamos..." da Evidência não repete o prazo — ele já
     está registrado (e visível) em Mudanças mensuráveis, e aqui só
     confundia: "de 1.000 para 700 contatos por mês em 90 dias. Após o
     experimento..." lia como se o prazo fosse sobre a EVIDÊNCIA, não
     sobre a mudança original. As três últimas peças de partesMudanca
     são sempre a cláusula do prazo (fixo "em"/"durante" + valor + ponto
     final, nas três direções) — reaproveita tudo antes disso e fecha
     com o ponto, sem duplicar a lógica de direção. */
  function partesMudancaSemPrazo(m) {
    return partesMudanca(m).slice(0, -3).concat([{ tipo: 'fixo', txt: '.' }]);
  }
  function fraseEvidenciaCard(m, ev) {
    ev = ev || {};
    var sufixo = sufixoUnidade(m);
    var moldeM = juntarPartes(partesMudancaSemPrazo(m), function (p) { return p.opcional ? '' : '—'; });
    var esperavamos = 'Esperávamos ' + moldeM.charAt(0).toLowerCase() + moldeM.slice(1);
    if (ev.naoMedido === 'sim') {
      return esperavamos + ' Não foi possível medir neste experimento' + (normalizar(ev.motivo) ? ' (' + ev.motivo + ')' : '') + '.';
    }
    if (!normalizar(ev.observado)) return esperavamos;
    return esperavamos + ' Após o experimento, observamos ' + ev.observado + concordarSufixo(ev.observado, sufixo) + '.';
  }
  /* "Manter" não tem "% do caminho": o resultado observado está dentro
     do limite combinado, ou não está. */
  function avaliarLimiteMudanca(m, valorObservado) {
    if (String(m.direcao || '').trim() !== 'Manter') return null;
    var obs = paraNumero(valorObservado);
    if (obs == null) return null;
    var tipoLimite = String(m.tipoLimite || '').trim() || 'Pelo menos';
    if (tipoLimite === 'Entre') {
      var min = paraNumero(m.limiteMinimo), max = paraNumero(m.limiteMaximo);
      if (min == null || max == null) return null;
      return obs >= min && obs <= max;
    }
    var meta = paraNumero(m.meta);
    if (meta == null) return null;
    return tipoLimite === 'No máximo' ? obs <= meta : obs >= meta;
  }
  /* O texto de avanço do card de Evidência — "% do caminho até a meta"
     para Aumentar/Reduzir/Atingir, "dentro/fora do limite" para Manter.
     null quando ainda não dá para calcular nada (falta número). */
  /* Número "limpo" para mensagens (sem resíduo de ponto flutuante tipo
     19.999999999998, sem casas decimais quando o resultado é inteiro). */
  function numeroLimpo(n) {
    return String(Math.round(n * 100) / 100);
  }
  function progressoResumo(m, valorObservado) {
    var direcao = String((m || {}).direcao || '').trim();

    /* "Manter" não compara com uma meta única — compara com o LIMITE
       escolhido, e cada lado tem sua própria mensagem (a mesma
       distinção que o alerta de coerência já usa: "abaixo"/"acima"/
       "fora", nunca um "fora do limite" genérico que não diz de que
       lado). Nunca percentual de progresso aqui. */
    if (direcao === 'Manter') {
      var dentro = avaliarLimiteMudanca(m, valorObservado);
      if (dentro == null) return null;
      if (dentro) return { texto: 'O resultado permaneceu dentro da condição que queríamos manter.', ok: true, atingiu: true };
      var tipoLimite = String(m.tipoLimite || '').trim() || 'Pelo menos';
      if (tipoLimite === 'No máximo') return { texto: 'O resultado ficou acima da condição que queríamos manter.', ok: false, atingiu: false };
      if (tipoLimite === 'Entre') return { texto: 'O resultado ficou fora da condição que queríamos manter.', ok: false, atingiu: false };
      return { texto: 'O resultado ficou abaixo da condição que queríamos manter.', ok: false, atingiu: false };
    }

    /* Aumentar / Reduzir / Atingir compartilham a mesma conta: a razão
       entre a mudança OBTIDA (observado − situação atual) e a mudança
       NECESSÁRIA (meta − situação atual) já inverte sozinha o sinal
       para "Reduzir" (e funciona igual para "Atingir", que também é só
       "chegar de A a B" — não há uma conta diferente e incompatível
       para reaproveitar aqui). */
    var atual = paraNumero(m.atual), meta = paraNumero(m.meta), obs = paraNumero(valorObservado);
    if (atual == null || meta == null || obs == null || atual === meta) return null;
    var sufixo = sufixoUnidade(m);

    if (obs === meta) return { texto: 'A mudança esperada foi alcançada.', ok: true, atingiu: true };

    var esperada = meta - atual;
    var alcancada = obs - atual;
    /* Sinais iguais = andou na direção certa (mesmo que ainda não
       tenha chegado, ou tenha ido além); sinais diferentes (ou uma das
       duas é zero) = não avançou na direção esperada — nunca um
       percentual negativo como mensagem principal, só o que foi
       observado comparado com o ponto de partida. */
    var mesmoSentido = (esperada > 0 && alcancada > 0) || (esperada < 0 && alcancada < 0);
    if (!mesmoSentido) {
      var comparativo = obs > atual ? 'acima' : (obs < atual ? 'abaixo' : '');
      return {
        texto: 'O resultado observado não avançou na direção esperada.' +
          (comparativo ? ' Foram observados ' + numeroLimpo(obs) + concordarSufixo(obs, sufixo) + ', ' + comparativo + ' da situação inicial de ' + numeroLimpo(atual) + concordarSufixo(atual, sufixo) + '.' : ''),
        ok: false,
        atingiu: false
      };
    }
    /* Foi além do que a meta pedia — não um percentual acima de 100%,
       a diferença em relação ao que se esperava (sempre positiva, já
       que só chega aqui quando a mudança alcançada supera a esperada). */
    if (Math.abs(alcancada) > Math.abs(esperada)) {
      var diferenca = Math.abs(alcancada - esperada);
      return { texto: 'A mudança esperada foi superada em ' + numeroLimpo(diferenca) + concordarSufixo(diferenca, sufixo) + '.', ok: true, atingiu: true };
    }
    /* Ao contrário de "Manter" (dentro/fora é bom/ruim), um percentual
       é só informação — não é "problema", é o quanto já andou. */
    var pct = Math.round((alcancada / esperada) * 100);
    return { texto: pct + '% da mudança esperada foi alcançada.', ok: true, atingiu: false };
  }

  /* O que vai no card do mapa, no card de conexão e no CSV. Vazio
     quando o grupo ainda não escreveu nada naquela etapa. */
  /* A "Nova hipótese" da Decisão usa o MESMO molde da etapa Hipótese —
     só os nomes dos campos mudam (proxHipCausa/proxHipIndicio), para não
     sobrescrever a hipótese original. Reaproveita partesDaFrase/
     juntarPartes com um objeto-etapa avulso (campos de 'decisao', molde
     do grupo), em vez de duplicar a montagem da frase. */
  function novaHipoteseTexto(d) {
    d = d || {};
    if (!normalizar(d.proxHipCausa) && !normalizar(d.proxHipIndicio)) return '';
    var etapaDecisao = etapaPorId('decisao');
    var g = (etapaDecisao && etapaDecisao.grupos || [])[0];
    if (!g) return '';
    return juntarPartes(partesDaFrase({ campos: etapaDecisao.campos, molde: g.molde }, d), function (p) { return p.opcional ? '' : '—'; });
  }

  function resumoEtapa(etapaId, dados) {
    var d = (dados || {})[etapaId] || {};
    if (etapaId === 'mudancas') return (d.itens || []).map(fraseMudanca).join(' ');
    if (etapaId === 'evidencia') {
      /* Antes da execução, o Mapa não pode ficar em branco só porque
         ninguém digitou nada ainda — isso lia como "etapa não
         preenchida" quando na verdade o grupo já escolheu o que vai
         observar (Experimento) e só falta executar. Por resultado
         escolhido, não só pelos itens já salvos: "aguardando execução"
         enquanto não houver observado nem "não foi possível medir". */
      var resultadosSel = resultadosDe((dados || {}).mudancas, ((dados || {}).experimento || {}).resultadoIds);
      if (!resultadosSel.length) return '';
      function evidenciaDe(id) { return (d.itens || []).filter(function (ev) { return ev.resultadoId === id; })[0] || {}; }
      var frases = resultadosSel.map(function (m) {
        var ev = evidenciaDe(m.id);
        if (!normalizar(ev.observado) && ev.naoMedido !== 'sim') {
          return (m.indicador || 'Resultado esperado') + ': aguardando execução.';
        }
        var f = fraseEvidenciaCard(m, ev);
        return normalizar(ev.aprendizado) ? f + ' Aprendizado: ' + ev.aprendizado : f;
      }).filter(Boolean);
      if (normalizar(d.classificacao)) frases.push('Nossa hipótese foi ' + d.classificacao.toLowerCase() + '.');
      return frases.join(' ');
    }
    var etapa = etapaPorId(etapaId);
    if (!etapa || !etapaPreenchida(etapaId, dados)) return '';
    /* Execuções anteriores guardaram a etapa num campo de texto só.
       Enquanto as lacunas novas estiverem vazias, é esse texto que a
       pessoa escreveu — mostrá-lo é o mínimo para não parecer que a
       dinâmica apagou o que ela tinha feito. */
    if (etapa.legado && normalizar(d[etapa.legado]) && !temLacunaPreenchida(etapa, d)) {
      return String(d[etapa.legado]).trim();
    }
    var base = juntarPartes(partesDaFrase(etapa, d), function (p) { return p.opcional ? '' : '—'; });
    /* A nova hipótese só entra na frase quando a decisão for "Reformular
       a hipótese" — nas outras, ela pode existir preenchida de uma volta
       anterior e mesmo assim não fazer parte desta decisão. */
    if (etapaId === 'decisao' && d.decisao === 'Reformular a hipótese') {
      var nh = novaHipoteseTexto(d);
      if (nh) base += ' Nova hipótese: ' + nh;
    }
    return base;
  }

  function temLacunaPreenchida(etapa, d) {
    return partesDaFrase(etapa, d).some(function (p) { return p.tipo === 'valor' && !p.variante; });
  }

  /* Hipótese, Ideia de solução, Experimento e Decisão não mostram a
     frase com lacunas por dentro enquanto está incompleta (ao contrário
     de Missão/Sintoma/Problema, que continuam com o padrão de sempre)
     — aqui, ou a frase está pronta, ou não aparece frase nenhuma, só a
     orientação do que falta. Pedido explícito: nunca mostrar algo como
     "com quantas pessoas…" ou "vamos a decisão" como se fosse texto de
     verdade. */
  var ETAPAS_FRASE_ESTRITA = { hipotese: true, ideia: true, experimento: true, decisao: true };

  /* O que falta para a frase desta etapa ficar completa — mesma lista
     usada pela prévia (para decidir se mostra a frase ou a orientação)
     e por CONTINUAR (para bloquear até faltar nada): as duas nunca
     podem divergir, senão a tela diria "completo" e CONTINUAR bloquearia
     mesmo assim, ou o contrário. Em Experimento, "o que vamos observar"
     não é uma lacuna do molde — é a escolha feita em "O que vamos
     observar?" —, mas ainda conta como obrigatório. */
  function partesFaltantesEtapa(etapa, d) {
    var faltam = partesDaFrase(etapa, d).filter(function (p) { return p.tipo === 'vazio' && !p.opcional; });
    if (etapa.id === 'experimento' && !((d.resultadoIds || []).length)) {
      faltam = faltam.concat([{ rotulo: 'o que vamos observar' }]);
    }
    return faltam;
  }

  /* Regra especial da Decisão (item 5 do ajuste): só quando a decisão
     escolhida for "Reformular a hipótese" a Nova Hipótese (causa +
     indício) se torna obrigatória — nas outras quatro decisões ela
     continua opcional, mesmo que já tenha sido preenchida numa volta
     anterior (por isso a checagem olha só a decisão ATUAL, nunca se o
     texto já existe). Uma função só, usada tanto para desabilitar
     CONTINUAR (seguirDesabilitado) quanto para a mensagem de pendência
     (mensagemFraseIncompleta) e o bloqueio no clique (ligarEtapa) — as
     três não podem divergir sobre quando falta a nova hipótese. */
  function decisaoFaltaNovaHipotese(d) {
    return String((d || {}).decisao || '').trim() === 'Reformular a hipótese' &&
      !(normalizar(d.proxHipCausa) && normalizar(d.proxHipIndicio));
  }

  /* ══════════════════════════════════════════════════════════════
     FASE 4 — PONTO DE REINÍCIO DA DECISÃO

     Das sete decisões possíveis, cinco abrem um Ciclo novo (ver
     avancar()/concluirOuIniciarNovoCiclo mais abaixo); "Ampliar" e
     "Interromper esta ideia" só finalizam o ciclo atual. Três das
     cinco têm o ponto de reinício FIXO (a própria decisão já diz onde
     recomeçar); as outras duas ("Ajustar e testar novamente" e
     "Investigar mais") pedem à dupla para ESCOLHER onde — itens 20/21
     do pedido, com as opções e a pergunta exatas de lá. */
  var PONTOS_DE_REINICIO_FIXOS = {
    'Reformular a hipótese': 'hipotese',
    'Rever a mudança mensurável': 'mudancas',
    'Rever o problema': 'problema'
  };
  var OPCOES_PONTO_REINICIO = {
    'Ajustar e testar novamente': [
      { valor: 'ideia', rotulo: 'Ideia de Solução' },
      { valor: 'experimento', rotulo: 'Experimento' },
      { valor: 'evidencia', rotulo: 'Planejamento da Evidência' }
    ],
    'Investigar mais': [
      { valor: 'problema', rotulo: 'Problema' },
      { valor: 'mudancas', rotulo: 'Mudanças Mensuráveis' },
      { valor: 'hipotese', rotulo: 'Hipótese' },
      { valor: 'ideia', rotulo: 'Ideia de Solução' },
      { valor: 'experimento', rotulo: 'Experimento' },
      { valor: 'evidencia', rotulo: 'Planejamento da Evidência' }
    ]
  };
  var PERGUNTA_PONTO_REINICIO = {
    'Ajustar e testar novamente': 'O que precisa ser revisto antes do próximo teste?',
    'Investigar mais': 'O que precisamos investigar ou rever?'
  };

  function decisaoPedePontoDeReinicioEscolhido(decisaoValor) {
    return !!OPCOES_PONTO_REINICIO[decisaoValor];
  }
  /* "Ampliar" e "Interromper esta ideia" são as únicas que NÃO abrem
     ciclo novo — todas as outras cinco abrem (item 7/8/12/13 do
     pedido: só uma nova rodada depois de uma Decisão finalizada cria
     ciclo; a decisão em si é sempre humana, nunca automática). */
  function decisaoGeraNovoCiclo(decisaoValor) {
    var v = String(decisaoValor || '').trim();
    return !!v && v !== 'Ampliar' && v !== 'Interromper esta ideia';
  }
  function pontoDeReinicioDaDecisao(d) {
    d = d || {};
    if (PONTOS_DE_REINICIO_FIXOS[d.decisao]) return PONTOS_DE_REINICIO_FIXOS[d.decisao];
    if (decisaoPedePontoDeReinicioEscolhido(d.decisao)) return d.pontoDeReinicioEscolhido || '';
    return '';
  }
  /* Obrigatório só quando a decisão PEDE a escolha (Ajustar/Investigar)
     — as outras três que geram ciclo já sabem sozinhas onde reiniciar,
     e Ampliar/Interromper nem chegam a precisar disso. */
  function decisaoFaltaPontoDeReinicio(d) {
    d = d || {};
    return decisaoPedePontoDeReinicioEscolhido(d.decisao) && !normalizar(d.pontoDeReinicioEscolhido);
  }

  /* Mensagem de orientação quando a etapa ainda não pode mostrar sua
     frase — Hipótese e Ideia têm só duas lacunas cada, então o texto
     fixo do pedido já é claro; o Experimento tem até cinco, então lista
     dinamicamente só o que falta de verdade. Na Decisão, "Reformular a
     hipótese" pode faltar a Nova Hipótese, a Próxima ação, ou as duas —
     cada combinação tem a sua própria frase (item 5 do ajuste); e as
     decisões que pedem ponto de reinício (Fase 4) também bloqueiam sem
     ele, com sua própria mensagem. */
  function mensagemFraseIncompleta(etapaId, faltam, d) {
    if (etapaId === 'hipotese') return 'Preencha a causa percebida e o que foi observado para completar a hipótese.';
    if (etapaId === 'ideia') return 'Preencha o que poderíamos fazer e para quê, para visualizar a ideia de solução.';
    if (etapaId === 'experimento') {
      return 'Complete ' + faltam.map(function (p) { return p.rotulo; }).join(', ') + ' para visualizar o experimento.';
    }
    if (etapaId === 'decisao') {
      var faltaDecisao = faltam.some(function (p) { return p.chave === 'decisao'; });
      if (faltaDecisao) return 'Escolha o que faremos com base no que aprendemos.';
      var faltaProximaAcao = faltam.some(function (p) { return p.chave === 'proximaAcao'; });
      var faltaNovaHip = decisaoFaltaNovaHipotese(d);
      var faltaPonto = decisaoFaltaPontoDeReinicio(d);
      if (faltaPonto && faltaProximaAcao) return 'Escolha o que precisa ser revisto e defina a próxima ação para completar a decisão.';
      if (faltaPonto) return 'Escolha o que precisa ser revisto para completar a decisão.';
      if (faltaNovaHip && faltaProximaAcao) return 'Defina a nova hipótese e a próxima ação para completar a decisão.';
      if (faltaNovaHip) return 'Defina a nova hipótese para completar a decisão.';
      return 'Defina a próxima ação para completar a decisão.';
    }
    return 'Preencha os campos obrigatórios para visualizar a frase desta etapa.';
  }

  /* ══════════════════════════════════════════════════════════════
     ESTADO
     ══════════════════════════════════════════════════════════════ */
  var _turma   = null;   /* { key, label, eventoKey } */
  var _execId  = null;
  var _exec    = {};     /* missao, revelado, encerrada… */
  var _grupoId = null;
  var _grupo   = {};     /* nome, membros, etapa… */
  var _dados   = {};     /* dados de cada etapa do grupo */
  var _etapaAtual = 'missao';
  var _vendoMapa  = false;
  var _refExec = null;
  var _ouvindo = false;

  function caminhoExec()  { return 'apostas/' + _turma.key + '/execucoes/' + _execId; }
  function caminhoGrupo() { return caminhoExec() + '/grupos/' + _grupoId; }

  /* ══════════════════════════════════════════════════════════════
     ELEGIBILIDADE — quem vê a dinâmica no Treinamento

     Duas exigências, as mesmas da Avaliação: estar CONFIRMADA numa
     turma (status inscrito + confirmedByAdmin, o critério completo
     do resto do site) E aquela turma ter sido liberada pelo admin.
     Admin enxerga sempre, para conseguir preparar e revisar antes
     da oficina.
     ══════════════════════════════════════════════════════════════ */
  function turmasElegiveis(cb) {
    var s = sessao();
    if (!s) { cb([]); return; }
    var uKey = emailKey(s.email);
    db().ref('turmas').once('value', function (snapT) {
      var turmas = snapT.val() || {};
      var habilitadas = Object.keys(turmas).filter(function (tk) { return !!turmas[tk].apostaHabilitada; });

      function montar(keys) {
        cb(keys.map(function (tk) {
          return {
            key: tk,
            label: turmas[tk].label || tk,
            eventoKey: turmas[tk].eventoKey || '',
            habilitada: !!turmas[tk].apostaHabilitada
          };
        }));
      }

      /* Quem conduz precisa ENSAIAR antes de liberar, e liberar é um ato
         público: a dinâmica passa a aparecer para todas as pessoas
         confirmadas naquela turma. Se a única forma de ver a tela fosse
         liberando, o ensaio da facilitadora estrearia na frente da turma
         — e voltar atrás depois já teria sido visto.

         Por isso admin e facilitadora enxergam TODAS as turmas, liberadas
         ou não; a turma ainda não liberada vem marcada, e o convite diz
         que só a facilitação a está vendo. É a mesma regra que a Avaliação
         já segue (admin vê a aba independente do flag, para revisar antes
         e depois de liberar) — a alternativa seria um terceiro critério
         para a mesma pergunta. Liberadas primeiro, que é o caso do dia
         da oficina. */
      if (souAdmin() || souFacilitadora()) {
        var todas = Object.keys(turmas).sort(function (a, b) {
          var ha = !!turmas[a].apostaHabilitada, hb = !!turmas[b].apostaHabilitada;
          if (ha !== hb) return ha ? -1 : 1;
          return String(turmas[a].label || a).localeCompare(String(turmas[b].label || b), 'pt-BR');
        });
        montar(todas);
        return;
      }

      /* Para o resto do site, as duas exigências valem juntas: turma
         liberada E pessoa confirmada nela. */
      if (!habilitadas.length) { cb([]); return; }
      db().ref('turmas-interesse').once('value', function (snapI) {
        var interesse = snapI.val() || {};
        var minhas = habilitadas.filter(function (tk) {
          var r = (interesse[tk] || {})[uKey];
          return !!(r && !r.removed && r.status === 'inscrito' && r.confirmedByAdmin);
        });
        montar(minhas);
      }, function () { cb([]); });
    }, function () { cb([]); });
  }

  /* ══════════════════════════════════════════════════════════════
     ENTRADA NO TREINAMENTO
     ══════════════════════════════════════════════════════════════ */
  function montarEntrada() {
    var host = document.getElementById('apostaEntrada');
    if (!host) return;
    if (!sessao()) { host.hidden = true; return; }

    turmasElegiveis(function (turmas) {
      if (!turmas.length) { host.hidden = true; return; }
      host.hidden = false;

      /* O aviso de ensaio muda com a turma escolhida, então é redesenhado
         a cada troca do select: dizer "só você está vendo" sobre uma turma
         que JÁ foi liberada seria pior que não dizer nada. */
      function avisoDe(t) {
        return t && t.habilitada ? '' :
          '<p class="aposta-convite-ensaio">Esta turma ainda não foi liberada: só você e a facilitação estão vendo a dinâmica. ' +
          'Para abrir à turma, use "🎯 Liberar Construção da Aposta" no menu ⋯ dela, no painel.</p>';
      }

      host.innerHTML =
        '<div class="aposta-convite">' +
          '<div class="aposta-convite-txt">' +
            '<span class="eyebrow">Dinâmica</span>' +
            '<h2>Construção da Aposta</h2>' +
            '<p>Da missão até uma decisão baseada em evidência, uma etapa por vez.</p>' +
            '<div id="apostaConviteAviso">' + avisoDe(turmas[0]) + '</div>' +
          '</div>' +
          '<div class="aposta-convite-acao">' +
            (turmas.length > 1
              ? '<select id="apostaTurmaSel" class="aposta-select">' +
                  turmas.map(function (t) {
                    return '<option value="' + esc(t.key) + '">' + esc(t.label) +
                      (t.habilitada ? '' : ' · ensaio') + '</option>';
                  }).join('') +
                '</select>'
              : '<span class="aposta-convite-turma">' + esc(turmas[0].label) + '</span>') +
            '<button class="btn btn--primary" id="apostaAbrirBtn">Abrir dinâmica</button>' +
          '</div>' +
        '</div>';

      function escolhida() {
        var sel = document.getElementById('apostaTurmaSel');
        return sel ? turmas.filter(function (t) { return t.key === sel.value; })[0] : turmas[0];
      }
      var sel = document.getElementById('apostaTurmaSel');
      if (sel) sel.addEventListener('change', function () {
        document.getElementById('apostaConviteAviso').innerHTML = avisoDe(escolhida());
      });

      document.getElementById('apostaAbrirBtn').addEventListener('click', function () {
        abrirDinamica(escolhida());
      });
    });
  }

  /* ══════════════════════════════════════════════════════════════
     TELA CHEIA

     A dinâmica é feita para ser projetada numa sala: ocupa a tela
     inteira, some o menu e sobra uma etapa por vez.
     ══════════════════════════════════════════════════════════════ */
  var _tela = null;

  function abrirDinamica(turma) {
    _turma = turma;
    _tela = document.createElement('div');
    _tela.className = 'aposta-tela';
    document.body.appendChild(_tela);
    document.body.style.overflow = 'hidden';
    _tela.innerHTML = '<div class="aposta-carregando"><p class="loading-msg">Carregando a dinâmica…</p></div>';
    carregarExecucao();
    document.addEventListener('keydown', escFecha);
  }

  function escFecha(e) {
    if (e.key === 'Escape' && _tela && !document.querySelector('.modal-overlay')) fecharDinamica();
  }

  function fecharDinamica() {
    /* Grava o que estava agendado ANTES de derrubar o estado: sair da tela
       no meio dos 600ms do salvamento automático não pode custar a última
       frase digitada. */
    gravarPendente();
    pararDeOuvir();
    document.removeEventListener('keydown', escFecha);
    if (_tela && _tela.parentNode) _tela.parentNode.removeChild(_tela);
    _tela = null;
    document.body.style.overflow = '';
    _execId = null; _grupoId = null; _dados = {}; _vendoMapa = false;
  }

  function pararDeOuvir() {
    if (_refExec && _ouvindo) { _refExec.off(); _ouvindo = false; }
    _refExec = null;
  }

  /* ── Execução em curso: a que o facilitador abriu por último ── */
  function carregarExecucao() {
    db().ref('apostas/' + _turma.key + '/atual').once('value', function (snap) {
      _execId = snap.val();
      if (!_execId) { renderSemExecucao(); return; }
      ouvirExecucao();
    }, function () {
      _tela.innerHTML = erroHtml('Não consegui carregar a dinâmica desta turma.');
    });
  }

  /* Escuta ao vivo: numa oficina, o facilitador libera etapas e
     revela as conexões enquanto os grupos estão com a tela aberta.
     Sem o listener, cada grupo precisaria recarregar para ver. */
  function ouvirExecucao() {
    pararDeOuvir();
    _refExec = db().ref(caminhoExec());
    _ouvindo = true;
    _refExec.on('value', function (snap) {
      var v = snap.val();
      if (!v) { renderSemExecucao(); return; }
      var revelouAgora = _exec.revelado !== v.revelado;
      _exec = v;
      if (_grupoId) {
        _grupo = (v.grupos || {})[_grupoId] || {};
        /* Fase 4: _dados aponta para o ciclo atual (explícito, quando
           existe) — nunca direto para _grupo.dados quando já há
           ciclos/. _etapaAtual é estado de navegação, puramente local,
           e continua fora deste listener (só muda por ação explícita:
           avançar/voltar/clique na trilha/no mapa). */
        _dados = resolverCicloAtual().dados;
      }
      /* O salvamento automático dispara este mesmo listener, com o eco do
         que acabamos de gravar. Redesenhar a etapa por causa desse eco
         faz dois estragos, os dois observados em teste: arranca o campo
         debaixo do dedo de quem digita (o cursor volta para o começo), e
         apaga o aviso didático que tinha acabado de aparecer — o que
         deixava "Continuar" num laço, mostrando o mesmo aviso para
         sempre e nunca avançando.

         Por isso a etapa em edição não se redesenha sozinha: o que o
         grupo escreve já está em _dados, e o que vem de fora entra na
         próxima navegação. Isso também evita que dois membros do mesmo
         grupo sobrescrevam o campo um do outro no meio de uma frase.

         Duas exceções, que precisam aparecer na hora: a revelação (é O
         momento da dinâmica) e as telas que não são de edição — escolha
         de grupo e mapa — onde o grupo só olha. */
      var editando = _grupoId && !_vendoMapa;
      if (editando && !revelouAgora) return;
      render();
    }, function () {
      _tela.innerHTML = erroHtml('Perdi a conexão com a dinâmica. Recarregue a página.');
    });
  }

  function erroHtml(msg) {
    return '<div class="aposta-carregando"><p class="admin-empty">' + esc(msg) + '</p>' +
      '<button class="btn" onclick="window.faAposta.fechar()">Fechar</button></div>';
  }

  /* Toda escrita que falha tem de aparecer. Numa oficina, "salvou" em
     silêncio sobre um dado que não foi gravado é pior que o erro: o
     grupo segue para a próxima etapa confiando no que sumiu. Ver a
     skill editar-e-salvar. */
  function avisar(msg, ehErro) {
    if (!_tela) return;
    var t = _tela.querySelector('.aposta-toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'aposta-toast';
      _tela.appendChild(t);
    }
    t.textContent = msg;
    t.classList.toggle('is-erro', !!ehErro);
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, ehErro ? 6000 : 2200);
  }

  /* "Encerrar por agora" fecha a tela cheia da dinâmica e devolve a
     pessoa ao Treinamento, que já estava montado por baixo. Um aviso
     preso a _tela (avisar()) morre junto com _tela nesse fechamento —
     por isso este é filho de document.body direto, sobrevive ao
     fecharDinamica() e fica tempo suficiente (ou até ser fechado) para
     ser lido já na página de destino. */
  function avisarPosSaida(msg) {
    var t = document.createElement('div');
    t.className = 'aposta-toast aposta-toast--persistente';
    t.innerHTML = '<span></span><button type="button" class="aposta-toast-fechar" aria-label="Fechar aviso">✕</button>';
    t.querySelector('span').textContent = msg;
    document.body.appendChild(t);
    function remover() { if (t.parentNode) t.parentNode.removeChild(t); }
    t.querySelector('.aposta-toast-fechar').addEventListener('click', remover);
    t._timer = setTimeout(remover, 5000);
  }

  /* Item 4 do ajuste de fluxo de Evidência: troca o window.confirm()
     nativo (que muda de cara entre navegadores e não combina com o
     visual do site) por um modal próprio, no mesmo padrão de
     .modal-overlay/.modal-box já usado em admin.js e em
     mostrarTextoParaCopiar acima — z-index acima de .aposta-tela
     (9500), senão o modal nasceria escondido atrás da tela cheia da
     dinâmica. */
  function confirmarRegistroDeResultados(callbackSim) {
    var overlay = document.createElement('div');
    /* aposta-confirmar-overlay: .modal-box é classe genérica (admin.js,
       game.js, facilitador.js, e o próprio index.html — #authModal/#qrModal
       — também usam), então um seletor genérico ".modal-overlay .modal-box"
       pega o modal de login escondido em vez deste. */
    overlay.className = 'modal-overlay aposta-confirmar-overlay';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:10002';
    var box = document.createElement('div');
    box.className = 'modal-box';
    box.style.cssText = 'max-width:440px;width:90%;padding:28px;display:flex;flex-direction:column;gap:18px';
    box.innerHTML =
      '<p style="margin:0;font-size:.95rem;line-height:1.6;color:var(--ink)">O experimento já foi executado?</p>' +
      '<p style="margin:0;font-size:.82rem;line-height:1.5;color:var(--ink-3)">O registro dos resultados deve ser feito depois da execução do experimento.</p>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap">' +
        '<button type="button" class="btn aposta-modal-nao-btn">AINDA NÃO</button>' +
        '<button type="button" class="btn btn--primary aposta-modal-sim-btn">SIM, REGISTRAR RESULTADOS</button>' +
      '</div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function fechar() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
    box.querySelector('.aposta-modal-nao-btn').addEventListener('click', fechar);
    var overlayMousedownFora = false;
    overlay.addEventListener('mousedown', function (e) { overlayMousedownFora = !box.contains(e.target); });
    overlay.addEventListener('click', function (e) { if (overlayMousedownFora && !box.contains(e.target)) fechar(); });
    overlay.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); fechar(); } });
    box.querySelector('.aposta-modal-sim-btn').addEventListener('click', function () { fechar(); callbackSim(); });
  }

  /* Mesmo padrão acima, para "Iniciar nova execução" — troca o
     window.confirm() nativo (Fase 1 da evolução de execuções). */
  function confirmarNovaExecucao(callbackSim) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay aposta-confirmar-overlay';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:10002';
    var box = document.createElement('div');
    box.className = 'modal-box';
    box.style.cssText = 'max-width:440px;width:90%;padding:28px;display:flex;flex-direction:column;gap:18px';
    box.innerHTML =
      '<p style="margin:0;font-size:.95rem;line-height:1.6;color:var(--ink)">Deseja iniciar uma nova execução desta dinâmica?</p>' +
      '<p style="margin:0;font-size:.82rem;line-height:1.5;color:var(--ink-3)">A execução atual será encerrada e continuará disponível no histórico. Uma nova execução vazia será criada para esta turma.</p>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap">' +
        '<button type="button" class="btn aposta-modal-nao-btn">CANCELAR</button>' +
        '<button type="button" class="btn btn--primary aposta-modal-sim-btn">ENCERRAR E INICIAR NOVA EXECUÇÃO</button>' +
      '</div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function fechar() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
    box.querySelector('.aposta-modal-nao-btn').addEventListener('click', fechar);
    var overlayMousedownFora = false;
    overlay.addEventListener('mousedown', function (e) { overlayMousedownFora = !box.contains(e.target); });
    overlay.addEventListener('click', function (e) { if (overlayMousedownFora && !box.contains(e.target)) fechar(); });
    overlay.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); fechar(); } });
    box.querySelector('.aposta-modal-sim-btn').addEventListener('click', function () { fechar(); callbackSim(); });
  }

  /* ══════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════ */
  function render() {
    if (!_tela) return;
    if (!_grupoId) { renderEscolhaGrupo(); return; }
    if (_vendoMapa) { renderMapa(); return; }
    renderEtapa();
  }

  function cabecalho(extra) {
    var conduz = souFacilitadora();
    return '<header class="aposta-topo">' +
      '<div class="aposta-topo-id">' +
        '<strong>Construção da Aposta</strong>' +
        '<span>' + esc(_turma.label) + (_grupo.nome ? ' · ' + esc(_grupo.nome) : '') + '</span>' +
      '</div>' +
      '<div class="aposta-topo-acoes">' +
        (extra || '') +
        (conduz ? '<button class="btn btn--sm" id="apostaPainelBtn">Painel do facilitador</button>' : '') +
        '<button class="btn btn--sm" id="apostaFecharBtn">Sair</button>' +
      '</div>' +
    '</header>';
  }

  function ligarCabecalho() {
    var f = document.getElementById('apostaFecharBtn');
    if (f) f.addEventListener('click', fecharDinamica);
    var p = document.getElementById('apostaPainelBtn');
    if (p) p.addEventListener('click', abrirPainelFacilitador);
  }

  /* ── Sem execução aberta ── */
  function renderSemExecucao() {
    var conduz = souFacilitadora();
    _tela.innerHTML = cabecalho() +
      '<div class="aposta-centro">' +
        '<div class="aposta-aviso">' +
          '<h2>A dinâmica ainda não começou</h2>' +
          '<p>' + (conduz
            ? 'Abra uma execução para esta turma e crie os grupos. O que os grupos escreverem fica guardado nesta execução.'
            : 'Assim que a facilitadora abrir a dinâmica, ela aparece aqui.') + '</p>' +
          (conduz ? '<button class="btn btn--primary" id="apostaNovaExecBtn">Abrir a dinâmica para esta turma</button>' : '') +
        '</div>' +
      '</div>';
    ligarCabecalho();
    var b = document.getElementById('apostaNovaExecBtn');
    if (b) b.addEventListener('click', criarExecucao);
  }

  /* Fase 1 da evolução de execuções (ver PLANO — "ciclo de vida real +
     concorrência"): esta função agora serve tanto para abrir a primeira
     execução de uma turma (_execId ainda vazio, nada a encerrar) quanto
     para "Iniciar nova execução" (_execId aponta para a execução que
     está sendo substituída).

     Duas invariantes têm de valer SEMPRE, mesmo no meio de uma falha:
       1) no máximo UMA execução com status 'ativa' por turma;
       2) "atual" sempre aponta para uma execução que existe e está
          ativa — nunca para uma execução que não foi gravada.

     Uma versão anterior desta função trocava o próprio ponteiro
     "atual" como mecanismo de disputa (transaction() nele). Isso
     garantia a invariante 1, mas abria uma janela real para quebrar a
     invariante 2: entre o instante em que "atual" já apontava para a
     execução nova e o instante em que essa execução era de fato
     gravada, uma queda do navegador de quem venceu deixava "atual"
     apontando para nada.

     Por isso "atual" agora só muda numa única vez, dentro do MESMO
     update() atômico que cria a execução nova inteira e encerra a
     antiga — nunca antes disso. Enquanto esse update() não acontece,
     "atual" continua exatamente onde estava, apontando para uma
     execução que existe e está ativa de verdade. Uma falha em
     qualquer etapa anterior a esse update() não altera "atual" em
     nada.

     A disputa entre chamadas concorrentes passa a usar um LOCK
     separado (apostas/<turmaKey>/criacaoExecucaoEmAndamento), nunca o
     ponteiro "atual". O lock guarda um TOKEN próprio de cada
     tentativa (gerado ao adquirir, nunca reaproveitado) — sem isso,
     uma tentativa antiga que demora demais e só falha depois de
     LOCK_EXPIRA_MS já ter passado poderia limpar o lock de uma
     tentativa mais nova que já tinha assumido a disputa nesse
     meio-tempo. Por isso NENHUM caminho deste código remove o lock
     sem antes conferir, atomicamente (transaction()), que o token lá
     gravado ainda é o mesmo que esta chamada recebeu ao adquiri-lo —
     se não for, a chamada não mexe em nada: o lock já é de outra
     tentativa, e conferir/limpar o lock errado é exatamente o tipo de
     bug que este token existe para impedir.

     1) transaction() no lock: só aceita se ele estiver livre ou tiver
        expirado (LOCK_EXPIRA_MS — ver abaixo por quê), e grava um
        token novo. Quem não vence aborta sem tocar em nada.
     2) Quem vence relê "atual" (agora com exclusividade garantida —
        ninguém mais pode mudá-lo enquanto o lock está com esta
        chamada) e confere se ainda é a execução que esta chamada
        pensava estar substituindo; se não for (outra chamada já
        completou um ciclo inteiro antes desta sequer começar a
        disputar), libera o lock (com o token) e avisa, sem criar
        nada.
     3) Só então pega o número (transaction() pequena, só no contador
        — baixar/regravar todas as execuções existentes a cada clique
        seria pesado demais numa turma com histórico longo).
     4) Só então grava, num ÚNICO update() atômico, a execução nova
        inteira e o encerramento formal da antiga — os dois juntos,
        ou nada. O lock é liberado (com o token) DEPOIS, numa chamada
        separada — nunca dentro deste mesmo update() atômico, porque
        um update() não sabe conferir "isso ainda é meu": só uma
        transaction() com o token confere isso antes de apagar.

     Se a falha acontecer em qualquer ponto ANTES desse update() final
     (lock adquirido mas a leitura de "atual" falhou; número obtido
     mas o update() final falhou; a própria rede caiu no meio), o pior
     resultado possível é: um número de execução pulado (aceitável —
     ver comentário no contador) e/ou o lock ficando preso até expirar
     — "atual" nunca é tocado, então nunca pode ficar quebrado. Por
     isso todo caminho de erro tenta liberar o lock (com o token —
     nunca às cegas) quando ainda é seguro fazê-lo (a própria chamada
     continua viva para tentar), e o LOCK_EXPIRA_MS cobre o caso em
     que ela não continua viva (o navegador realmente caiu): a próxima
     tentativa — um novo clique, de quem for — destrava sozinha, sem
     precisar de conserto manual.

     LOCK_EXPIRA_MS é generoso de propósito: a CLAUDE.md deste projeto
     é explícita que "rede lenta é uma condição de mobile, não um caso
     raro" — uma gravação que no wi-fi leva 200ms pode levar vários
     segundos no 4G da sala. Um valor curto destravaria (e deixaria
     outra chamada assumir) enquanto a primeira ainda está viva, só
     lenta — o que reabriria, num caso raríssimo (rede extremamente
     lenta E uma segunda tentativa nesse meio-tempo), uma versão fraca
     do problema original. Um valor generoso reduz isso a uma
     probabilidade desprezível, ao custo de a recuperação de uma queda
     real levar até esse tanto de tempo. */
  var LOCK_EXPIRA_MS = 20000;

  function criarExecucao() {
    var s = sessao();
    if (!s) return;
    var execAnteriorId = _execId || null;
    var meuToken = db().ref('apostas/' + _turma.key + '/criacaoExecucaoEmAndamento').push().key;
    var lockRef = db().ref('apostas/' + _turma.key + '/criacaoExecucaoEmAndamento');
    lockRef.transaction(function (lockAtual) {
      if (lockAtual && (Date.now() - new Date(lockAtual.em).getTime()) < LOCK_EXPIRA_MS) return undefined;
      return { em: new Date().toISOString(), por: s.email, token: meuToken };
    }, function (errLock, venceu) {
      if (errLock) { avisar('Não consegui abrir a dinâmica. Nada foi criado — tente de novo.', true); return; }
      if (!venceu) {
        /* avisarPosSaida (não avisar): esta chamada pode ser a segunda
           aba da mesma pessoa, cuja PRIMEIRA aba está vencendo a
           disputa agora — e o "ouvirExecucao()" dela, ao terminar,
           redesenha _tela por completo. Um aviso preso a _tela some
           junto nesse redesenho antes de alguém conseguir ler; preso
           a document.body, sobrevive. */
        avisarPosSaida('Outra execução está sendo iniciada agora para esta turma. Tente de novo em alguns segundos.');
        return;
      }
      confirmarAtualAindaValido(execAnteriorId, s, meuToken);
    });
  }

  /* Só apaga o lock se o token gravado nele ainda for O MESMO que
     esta chamada recebeu ao adquiri-lo — nunca um remove() às cegas.
     Sem essa checagem, uma tentativa antiga (que só descobre que
     falhou depois de o lock já ter expirado e sido assumido por uma
     tentativa mais nova) apagaria o lock de quem está trabalhando
     agora, e uma terceira chamada poderia entrar bem no meio dessa
     segunda tentativa — reabrindo a corrida que o lock existe para
     impedir. */
  function liberarLock(meuToken) {
    db().ref('apostas/' + _turma.key + '/criacaoExecucaoEmAndamento').transaction(function (lockAtual) {
      if (lockAtual && lockAtual.token === meuToken) return null;
      return undefined; /* não é mais o nosso lock — não mexe */
    });
  }

  /* Só chega aqui com o lock garantido — nenhuma outra chamada pode
     mudar "atual" enquanto ele está conosco. Ainda assim relemos
     "atual" (em vez de confiar só no execAnteriorId capturado no
     clique) porque um ciclo anterior pode ter terminado por completo
     — lock liberado, "atual" já trocado — entre o carregamento da
     tela e este clique; sem essa checagem, encerraríamos a execução
     ERRADA (uma que a pessoa nem sabe que existe). */
  function confirmarAtualAindaValido(execAnteriorId, s, meuToken) {
    db().ref('apostas/' + _turma.key + '/atual').once('value', function (snap) {
      var atualDeVerdade = snap.val() || null;
      if (atualDeVerdade !== execAnteriorId) {
        liberarLock(meuToken);
        avisarPosSaida('Outra execução já foi iniciada para esta turma. A tela será atualizada.');
        _execId = atualDeVerdade;
        if (_execId) ouvirExecucao(); else renderSemExecucao();
        return;
      }
      obterNumeroEConcluir(execAnteriorId, s, meuToken);
    }, function () {
      liberarLock(meuToken);
      avisar('Não consegui abrir a dinâmica. Tente de novo.', true);
    });
  }

  function obterNumeroEConcluir(execAnteriorId, s, meuToken) {
    var contadorRef = db().ref('apostas/' + _turma.key + '/contadorExecucoes');
    contadorRef.transaction(function (atual) {
      return (atual || 0) + 1;
    }, function (errContador, commitedContador, snapContador) {
      if (errContador || !commitedContador) {
        liberarLock(meuToken);
        avisar('Não consegui abrir a dinâmica. Tente de novo.', true);
        return;
      }
      var meuNumero = snapContador.val();
      var novoKey = db().ref('apostas/' + _turma.key + '/execucoes').push().key;
      concluirCriacaoExecucao(novoKey, meuNumero, execAnteriorId, s, meuToken);
    });
  }

  function concluirCriacaoExecucao(novoKey, meuNumero, execAnteriorId, s, meuToken) {
    var agora = new Date().toISOString();
    var updates = {};
    /* Só encerra formalmente uma execução anterior quando ela existe —
       a primeira execução de uma turma não tem o que encerrar. Nada do
       que os grupos escreveram nela é tocado, só os metadados de
       ciclo de vida. */
    if (execAnteriorId) {
      var caminhoAnterior = 'apostas/' + _turma.key + '/execucoes/' + execAnteriorId;
      updates[caminhoAnterior + '/status'] = 'encerrada';
      updates[caminhoAnterior + '/encerrada'] = true;
      updates[caminhoAnterior + '/encerradaEm'] = agora;
      updates[caminhoAnterior + '/encerradaPor'] = s.email;
      updates[caminhoAnterior + '/encerradaPorNome'] = s.name || s.email;
    }
    updates['apostas/' + _turma.key + '/execucoes/' + novoKey] = {
      numero: meuNumero,
      status: 'ativa',
      criadaEm: agora,
      criadaPor: s.email,
      criadaPorNome: s.name || s.email,
      turmaKey: _turma.key,
      turmaLabel: _turma.label,
      eventoKey: _turma.eventoKey || '',
      missao: '',
      revelado: false,
      encerrada: false
    };
    /* "atual" só muda AQUI, junto com a criação da execução e o
       encerramento da antiga — nunca antes. É o que garante que
       "atual" nunca aponte para uma execução que não existe: ou este
       update() inteiro grava, ou "atual" continua exatamente onde
       estava. O lock NÃO entra neste update() — ele só é liberado
       depois, com o token conferido (ver liberarLock). */
    updates['apostas/' + _turma.key + '/atual'] = novoKey;
    db().ref().update(updates, function (err2) {
      if (err2) {
        /* O update() é atômico: se falhou, nada dele foi gravado —
           "atual" continua na execução antiga, válida. Libera o lock
           agora (a chamada continua viva, é seguro); se nem isso
           chegar a gravar, o LOCK_EXPIRA_MS destrava sozinho depois. */
        liberarLock(meuToken);
        avisar('Não consegui abrir a dinâmica. Tente de novo.', true);
        return;
      }
      _execId = novoKey;
      liberarLock(meuToken);
      ouvirExecucao();
    });
  }

  /* ══════════════════════════════════════════════════════════════
     FASE 4 — CICLOS DE APRENDIZAGEM

     Uma mesma aposta (um grupo) pode passar por várias RODADAS de
     Problema→Mudanças→Hipótese→Ideia→Experimento→Evidência→Decisão —
     cada rodada é um CICLO. Isso é diferente de uma EXECUÇÃO (Fase 1):
     execução é o "jogo" inteiro de uma turma; ciclo é uma volta dentro
     da aposta de UM grupo, dentro de UMA execução. Uma execução nova
     nunca é um novo ciclo, e um novo ciclo nunca cria execução nova.

     CICLO 1 IMPLÍCITO — decisão tomada na Fase 4, sem migração:
     enquanto um grupo nunca precisou de um segundo ciclo, ele continua
     gravando exatamente onde sempre gravou —
     grupos/<grupoId>/dados/<etapaId> — sem NENHUM campo novo. Só
     quando esse grupo de fato precisa de um Ciclo 2 é que a estrutura
     explícita nasce:
       grupos/<grupoId>/ciclos/
         atual                      → id do ciclo em edição agora
         criacaoCicloEmAndamento    → lock (mesmo mecanismo de
                                        token da Fase 1 — ver
                                        criarExecucao/liberarLock acima)
         porId/<cicloId>/
           numero, status ('EM_CONSTRUCAO'|'FINALIZADO' — os estados
             intermediários do pedido são DERIVADOS ao vivo da etapa e
             dos dados, nunca persistidos; ver statusCicloDerivado),
           criadoEm, criadoPorNome, finalizadoEm,
           cicloAnteriorId, pontoDeReinicio, decisaoOrigem, herdadas,
           etapa (mesmo papel de grupos/<grupoId>/etapa, só que por
             ciclo — cada ciclo tem sua própria trilha),
           dados/<etapaId>          (exatamente as mesmas 9 chaves de
             sempre — problema, mudancas, hipotese, ideia, experimento,
             evidencia, decisao… — nada na engine de moldes/validação/
             resumo precisa saber que existe mais de um ciclo)

     Nascer um Ciclo 2 congela o Ciclo 1: copia grupos/<grupoId>/dados
     (e /etapa) para ciclos/porId/<primeiroId>/{dados,etapa} — o
     caminho legado continua existindo, intocado, como um registro
     redundante, mas deixa de ser lido (ver resolverCicloAtual/
     caminhoDadosAtual) assim que ciclos/ existe. Ciclo 1, uma vez
     copiado, nunca mais é escrito — a decisão que o fechou já
     aconteceu antes de ele virar histórico.

     "Ciclo atual finalizado" (para decidir se um clique de edição pede
     confirmação — ver PROTEÇÃO CONTRA EDITAR CICLO FINALIZADO) usa o
     mesmo princípio de não duplicar estado: enquanto o ciclo continua
     implícito, "finalizado" é simplesmente "a Decisão já tem
     dataDecisao" (campo que a etapa Decisão já grava sozinha, desde
     antes desta fase, na primeira vez que Continuar é confirmado —
     nenhum campo novo precisou nascer só para isso). Só ciclos
     explícitos (2, 3…) ganham um `status` de verdade, porque aí já
     existe um registro próprio para guardá-lo.

     A criação de um ciclo é uma ação ESTRUTURAL (Fase 3): qualquer
     pessoa do MESMO grupo, em qualquer aba/dispositivo, pode estar
     clicando Continuar na Decisão ao mesmo tempo — clique duplo real
     entre pessoas diferentes, não só duplo-clique físico. Por isso usa
     o MESMO mecanismo de concorrência real da Fase 1 (lock com token
     próprio de cada tentativa, nunca removido às cegas), não apenas
     disabled=true no botão — ver LOCK_EXPIRA_MS acima, reaproveitado
     aqui sem duplicar a constante:
       1) transaction() no lock — só aceita se livre/expirado;
       2) relê ciclos/atual (com exclusividade garantida pelo lock) e
          confere que ainda é o mesmo que esta chamada pensava estar
          fechando; se não for, libera o lock e avisa, sem criar nada;
       3) relê o ciclo que está sendo fechado (nunca confia só na cópia
          em memória — mesmo cuidado do confirmarAtualAindaValido) e
          deriva dali o número do novo ciclo: nº do anterior + 1 (Ciclo
          1 implícito não tem `numero` gravado, conta como 1). SEM
          contador global — diferente de contadorExecucoes (que pode
          ter mais de uma execução concorrendo pelo próximo número),
          aqui só existe um cicloAtual e uma decisão gera no máximo um
          sucessor: o lock+token acima já garante sozinho que só uma
          chamada por vez chega a ler o anterior e escrever o novo
          número, então não sobra concorrência nenhuma para um contador
          arbitrar. Sem um nó separado para "consumir", uma tentativa
          que falha ANTES do update() final nunca gasta um número que
          nenhum ciclo chegou a usar de verdade (INVARIANTE 8:
          numeração sequencial, sem lacunas — Ciclo 1 → 2 → 3…, nunca
          Ciclo 1 → 3 sem um Ciclo 2 ter existido);
       4) um ÚNICO update() atômico: materializa o Ciclo 1 (se for a
          primeira vez), finaliza o ciclo que está sendo fechado, cria
          o novo com herança/cascata/número e aponta ciclos/atual para
          ele — tudo isso junto, ou nada. O lock só é liberado DEPOIS,
          numa chamada separada (update() não sabe conferir "isso ainda
          é meu" — só transaction() com o token confere isso).
     ══════════════════════════════════════════════════════════════ */

  function caminhoCiclos() { return caminhoGrupo() + '/ciclos'; }
  function cicloAtualId() { return (_grupo.ciclos || {}).atual || null; }

  /* Resolve, a partir de um GRUPO QUALQUER (não só o _grupo selecionado
     — o painel do facilitador lista todos de uma vez), qual é o ciclo
     explícito atual quando ele existe, ou o caminho legado (Ciclo 1
     implícito) quando aquele grupo nunca teve mais de um ciclo. Nunca
     escreve nada, só lê. */
  function cicloAtualDe(gr) {
    var ciclosNode = (gr || {}).ciclos || {};
    var id = ciclosNode.atual || null;
    var c = id && ciclosNode.porId ? ciclosNode.porId[id] : null;
    if (c) return { dados: c.dados || {}, etapa: c.etapa || 'missao' };
    return { dados: (gr || {}).dados || {}, etapa: (gr || {}).etapa || 'missao' };
  }
  /* Mesma resolução, para o grupo em edição agora (_grupo). */
  function resolverCicloAtual() { return cicloAtualDe(_grupo); }

  /* Onde GRAVAR a etapa em edição agora — mesma regra de leitura acima,
     do lado da escrita. */
  function caminhoDadosAtual() {
    var id = cicloAtualId();
    return id ? (caminhoCiclos() + '/porId/' + id + '/dados') : (caminhoGrupo() + '/dados');
  }
  function caminhoEtapaAtualPersistida() {
    var id = cicloAtualId();
    return id ? (caminhoCiclos() + '/porId/' + id + '/etapa') : (caminhoGrupo() + '/etapa');
  }

  /* Ciclo ATUAL finalizado — nunca precisa olhar ciclos que não são o
     atual: esses já são sempre somente leitura por outro caminho (ver
     Mapa multiciclo), nunca por esta checagem.

     Cuidado deliberado com uma falha bem no meio da transição: se a
     Decisão já foi salva (dataDecisao gravado) mas o NASCIMENTO do
     ciclo seguinte falhou (rede caiu nesse instante — ver
     concluirOuIniciarNovoCiclo), o ciclo atual NÃO conta como
     finalizado enquanto o sucessor esperado não existir de verdade.
     Sem esse cuidado, reabrir a Decisão mostraria "ciclo já concluído,
     iniciar um novo a partir desta etapa?" — e confirmar ali criaria
     um ciclo com ponto de reinício ERRADO (a própria etapa Decisão, em
     vez do ponto que a decisão de verdade pedia). Tratar como "ainda
     não finalizado" deixa o grupo simplesmente reabrir a Decisão e
     clicar Continuar de novo, retomando a MESMA transição pendente. */
  function cicloAtualEstaFinalizado() {
    var d = _dados.decisao || {};
    if (!normalizar(d.decisao) || !d.dataDecisao) return false;
    var id = cicloAtualId();
    var registrado = id ? (((_grupo.ciclos || {}).porId || {})[id] || {}).status === 'FINALIZADO' : true;
    if (!registrado) return false;
    if (decisaoGeraNovoCiclo(d.decisao)) {
      var todos = ((_grupo.ciclos || {}).porId) || {};
      var temSucessor = Object.keys(todos).some(function (k) { return todos[k].cicloAnteriorId === id; });
      if (!temSucessor) return false;
    }
    return true;
  }

  /* Etapas estritamente ANTES do ponto de reinício — são as que o novo
     ciclo HERDA (cópia, nunca a mesma referência); do ponto de
     reinício em diante, cada etapa nasce vazia (EFEITO CASCATA, item
     24 do pedido: quanto mais cedo o ponto de reinício, mais etapas
     posteriores precisam ser revisitadas — "vazia" é o mesmo estado de
     "ainda não preenchida" que etapaPreenchida() já sabe reconhecer,
     nenhuma lógica nova precisa entender "cascata"). */
  function etapasAntesDe(etapaId) {
    return ETAPAS.slice(0, indiceEtapa(etapaId)).map(function (e) { return e.id; });
  }

  function montarDadosNovoCiclo(dadosAnteriores, pontoDeReinicio) {
    dadosAnteriores = dadosAnteriores || {};
    var herdadas = etapasAntesDe(pontoDeReinicio);
    var dados = {};
    herdadas.forEach(function (id) {
      if (dadosAnteriores[id] !== undefined) dados[id] = JSON.parse(JSON.stringify(dadosAnteriores[id]));
    });
    ETAPAS.forEach(function (e) { if (herdadas.indexOf(e.id) === -1) dados[e.id] = {}; });
    /* "Reformular a hipótese": a Nova Hipótese que a Decisão do ciclo
       anterior coletou (proxHipCausa/proxHipIndicio) é que vira a
       Hipótese do ciclo novo — nunca fica em outro lugar, e nunca
       sobrescreve a hipótese original do ciclo anterior (ela continua
       congelada em dadosAnteriores, intocada — ver item 19/17 do
       pedido). */
    if (pontoDeReinicio === 'hipotese') {
      var decisaoAnterior = dadosAnteriores.decisao || {};
      if (normalizar(decisaoAnterior.proxHipCausa) || normalizar(decisaoAnterior.proxHipIndicio)) {
        dados.hipotese = { causa: decisaoAnterior.proxHipCausa || '', indicio: decisaoAnterior.proxHipIndicio || '' };
      }
    }
    return { dados: dados, herdadas: herdadas };
  }

  function criarCiclo(pontoDeReinicio, decisaoOrigem, cb) {
    var s = sessao();
    if (!s) { if (cb) cb('sem sessão'); return; }
    var cicloAnteriorIdEsperado = cicloAtualId(); /* null = ainda é o Ciclo 1 implícito */
    var lockRef = db().ref(caminhoCiclos() + '/criacaoCicloEmAndamento');
    var meuToken = lockRef.push().key;
    lockRef.transaction(function (lockAtual) {
      if (lockAtual && (Date.now() - new Date(lockAtual.em).getTime()) < LOCK_EXPIRA_MS) return undefined;
      return { em: new Date().toISOString(), por: s.email, token: meuToken };
    }, function (errLock, venceu) {
      if (errLock) { if (cb) cb(errLock); return; }
      if (!venceu) { if (cb) cb('lock-ocupado'); return; }
      confirmarCicloAindaValido(cicloAnteriorIdEsperado, pontoDeReinicio, decisaoOrigem, s, meuToken, cb);
    });
  }

  /* Só apaga o lock se o token gravado nele ainda for O MESMO que esta
     chamada recebeu ao adquiri-lo — nunca um remove()/set(null) às
     cegas (mesmo motivo do liberarLock da Fase 1, ver comentário lá). */
  function liberarLockCiclo(meuToken) {
    db().ref(caminhoCiclos() + '/criacaoCicloEmAndamento').transaction(function (lockAtual) {
      if (lockAtual && lockAtual.token === meuToken) return null;
      return undefined;
    });
  }

  function confirmarCicloAindaValido(cicloAnteriorIdEsperado, pontoDeReinicio, decisaoOrigem, s, meuToken, cb) {
    db().ref(caminhoGrupo() + '/ciclos/atual').once('value', function (snap) {
      var atualDeVerdade = snap.val() || null;
      if (atualDeVerdade !== cicloAnteriorIdEsperado) {
        liberarLockCiclo(meuToken);
        if (cb) cb('ciclo-mudou');
        return;
      }
      obterNumeroCicloEConcluir(cicloAnteriorIdEsperado, pontoDeReinicio, decisaoOrigem, s, meuToken, cb);
    }, function () {
      liberarLockCiclo(meuToken);
      if (cb) cb('erro-leitura');
    });
  }

  /* Deriva o número do novo ciclo do ciclo que está sendo fechado —
     nº do anterior + 1 (Ciclo 1 implícito não tem `numero` gravado,
     conta como 1) — em vez de um contador global. Ver INVARIANTE 8 no
     comentário de FASE 4 — CICLOS DE APRENDIZAGEM, acima: sem um nó
     separado para "consumir" um número, uma tentativa que falha antes
     do update() final nunca deixa lacuna na numeração. */
  function obterNumeroCicloEConcluir(cicloAnteriorIdEsperado, pontoDeReinicio, decisaoOrigem, s, meuToken, cb) {
    var novoKey = db().ref(caminhoCiclos() + '/porId').push().key;
    var caminhoCicloAnterior = cicloAnteriorIdEsperado
      ? (caminhoCiclos() + '/porId/' + cicloAnteriorIdEsperado)
      : caminhoGrupo();
    /* Relê o que está sendo fechado bem antes do update() final — mesmo
       cuidado do confirmarAtualAindaValido da Fase 1: o que vai
       congelar como histórico (e o número do próximo ciclo) tem de vir
       do que está gravado agora, não de uma cópia em memória que pode
       ter ficado velha. */
    db().ref(caminhoCicloAnterior).once('value', function (snapAnterior) {
      var anterior = snapAnterior.val() || {};
      var meuNumero = (anterior.numero || 1) + 1;
      concluirCriacaoCiclo(cicloAnteriorIdEsperado, anterior, novoKey, meuNumero, pontoDeReinicio, decisaoOrigem, s, meuToken, cb);
    }, function () {
      liberarLockCiclo(meuToken);
      if (cb) cb('erro-leitura-anterior');
    });
  }

  function concluirCriacaoCiclo(cicloAnteriorIdEsperado, anterior, novoKey, meuNumero, pontoDeReinicio, decisaoOrigem, s, meuToken, cb) {
    var agora = new Date().toISOString();
    var updates = {};
    var primeiraMaterializacao = !cicloAnteriorIdEsperado;
    var dadosAnteriores = anterior.dados || {};
    var etapaAnterior = anterior.etapa || 'decisao';
    var cicloAnteriorIdReal = cicloAnteriorIdEsperado;
    var finalizadoEmAnterior = (dadosAnteriores.decisao || {}).dataDecisao || agora;

    if (primeiraMaterializacao) {
      /* Ciclo 1 nasce agora, com exatamente o que já estava gravado no
         grupo — nunca mais alterado depois disso. grupos/<grupoId>/dados
         continua existindo, intocado, como registro redundante (ver
         nota no topo desta seção). */
      cicloAnteriorIdReal = db().ref(caminhoCiclos() + '/porId').push().key;
      updates[caminhoCiclos() + '/porId/' + cicloAnteriorIdReal] = {
        numero: 1,
        status: 'FINALIZADO',
        criadoEm: anterior.criadoEm || null,
        criadoPorNome: null,
        finalizadoEm: finalizadoEmAnterior,
        cicloAnteriorId: null,
        pontoDeReinicio: null,
        decisaoOrigem: null,
        etapa: etapaAnterior,
        dados: dadosAnteriores
      };
    } else {
      updates[caminhoCiclos() + '/porId/' + cicloAnteriorIdReal + '/status'] = 'FINALIZADO';
      updates[caminhoCiclos() + '/porId/' + cicloAnteriorIdReal + '/finalizadoEm'] = finalizadoEmAnterior;
    }

    var montado = montarDadosNovoCiclo(dadosAnteriores, pontoDeReinicio);
    var novoCiclo = {
      numero: meuNumero,
      status: 'EM_CONSTRUCAO',
      criadoEm: agora,
      criadoPorNome: s.name || s.email,
      finalizadoEm: null,
      cicloAnteriorId: cicloAnteriorIdReal,
      pontoDeReinicio: pontoDeReinicio,
      decisaoOrigem: decisaoOrigem,
      herdadas: montado.herdadas,
      etapa: pontoDeReinicio,
      dados: montado.dados
    };
    updates[caminhoCiclos() + '/porId/' + novoKey] = novoCiclo;
    /* ciclos/atual só muda AQUI, junto com tudo o mais — nunca antes.
       Mesma garantia do "atual" de execução (Fase 1): ou o update()
       inteiro grava, ou ciclos/atual continua exatamente onde estava. */
    updates[caminhoCiclos() + '/atual'] = novoKey;

    db().ref().update(updates, function (err) {
      liberarLockCiclo(meuToken);
      if (err) { if (cb) cb(err); return; }
      if (cb) cb(null, novoKey, novoCiclo);
    });
  }

  /* ── Escolha do grupo ── */
  function renderEscolhaGrupo() {
    var grupos = _exec.grupos || {};
    var chaves = Object.keys(grupos);
    var s = sessao();
    var uKey = s ? emailKey(s.email) : '';
    /* Se a pessoa já entrou num grupo antes, volta direto para ele —
       recarregar a página no meio da oficina não pode custar o lugar. */
    var meu = chaves.filter(function (g) { return ((grupos[g].membros || {})[uKey]); })[0];
    if (meu) { entrarNoGrupo(meu, true); return; }

    _tela.innerHTML = cabecalho() +
      '<div class="aposta-centro">' +
        '<div class="aposta-aviso">' +
          '<h2>Escolha seu grupo</h2>' +
          (chaves.length
            ? '<div class="aposta-grupos-escolha">' + chaves.map(function (g) {
                var qtd = Object.keys(grupos[g].membros || {}).length;
                return '<button class="aposta-grupo-btn" data-grupo="' + esc(g) + '">' +
                  '<strong>' + esc(grupos[g].nome || 'Grupo') + '</strong>' +
                  '<span>' + qtd + ' pessoa' + (qtd !== 1 ? 's' : '') + '</span>' +
                '</button>';
              }).join('') + '</div>'
            : '<p>' + (souFacilitadora()
                ? 'Nenhum grupo criado ainda. Abra o painel do facilitador para criar.'
                : 'A facilitadora ainda não criou os grupos.') + '</p>') +
        '</div>' +
      '</div>';
    ligarCabecalho();
    _tela.querySelectorAll('.aposta-grupo-btn').forEach(function (b) {
      b.addEventListener('click', function () { entrarNoGrupo(b.dataset.grupo); });
    });
  }

  function entrarNoGrupo(grupoId, jaEra) {
    _grupoId = grupoId;
    _grupo = (_exec.grupos || {})[grupoId] || {};
    var r = resolverCicloAtual();
    _dados = r.dados;
    _etapaAtual = r.etapa;
    if (!jaEra) {
      var s = sessao();
      if (s) {
        db().ref(caminhoGrupo() + '/membros/' + emailKey(s.email)).set({
          name: s.name || s.email, email: s.email, entrouEm: new Date().toISOString()
        }, function (err) {
          /* Sem isto, a pessoa não consta no grupo: a facilitadora não a vê
             na lista e um F5 faz escolher de novo. Não impede de trabalhar,
             mas não pode passar em silêncio. */
          if (err) avisar('Entrei no grupo, mas não consegui registrar seu nome nele.', true);
        });
      }
    }
    render();
  }

  /* ── Trilha: nomes desde o começo, conteúdo só na vez ── */
  /* ── Trilha: o nome de cada etapa só aparece quando chega a vez ──
     Ver a nota no topo do arquivo. Os números ficam à vista desde o
     começo (dá para ver que são dez e onde a conversa está), os nomes
     não: ler "Hipótese" e "Evidência" à frente já entrega o caminho e
     muda o que o grupo escreve na etapa atual.

     A revelação é CONTÍNUA, até onde o grupo já chegou. Antes bastava a
     etapa ter conteúdo para o nome aparecer, e uma execução retomada
     mostrava "…5 Hipótese, 6, 7, 8, 9 Evidência, 10 Decisão": os nomes
     do fim entregues, os do meio escondidos, e nenhuma explicação
     possível para a pessoa que olha. Agora o que vale é o ponto mais
     longe alcançado — a etapa em que o grupo está, a que o painel
     registrou e a última preenchida, o que vier mais adiante. */
  function ateOndeChegou() {
    /* Fase 4: a etapa "registrada" é a do CICLO atual, não a legada do
       grupo direto — ver resolverCicloAtual/caminhoEtapaAtualPersistida.
       Continua idêntico a antes enquanto a aposta tiver um só ciclo. */
    var etapaRegistrada = resolverCicloAtual().etapa;
    var alcancado = Math.max(indiceEtapa(_etapaAtual), etapaRegistrada ? indiceEtapa(etapaRegistrada) : 0);
    ETAPAS.forEach(function (e, i) {
      if (i > alcancado && etapaPreenchida(e.id, _dados)) alcancado = i;
    });
    return alcancado;
  }

  function trilhaHtml() {
    var atual = indiceEtapa(_etapaAtual);
    var alcancado = _vendoMapa ? ETAPAS.length - 1 : ateOndeChegou();
    return '<nav class="aposta-trilha" aria-label="Etapas da dinâmica">' +
      ETAPAS.map(function (e, i) {
        var feita = etapaPreenchida(e.id, _dados);
        var aberta = i <= alcancado;
        var cls = 'aposta-trilha-item' +
          (i === atual && !_vendoMapa ? ' is-atual' : '') +
          (feita ? ' is-feita' : '') +
          (aberta ? '' : ' is-oculta is-bloqueada');
        return '<button class="' + cls + '" data-etapa="' + e.id + '"' +
          (aberta ? '' : ' disabled aria-disabled="true"') +
          ' title="' + (aberta ? esc(e.curto) : 'Esta etapa aparece quando chegar a vez dela') + '"' +
          ' aria-label="Etapa ' + (i + 1) + (aberta ? ': ' + esc(e.curto) : ', ainda não revelada') + '">' +
          '<span class="aposta-trilha-num">' + (i + 1) + '</span>' +
          '<span class="aposta-trilha-nome">' + (aberta ? esc(e.curto) : '· · ·') + '</span>' +
        '</button>';
      }).join('') +
    '</nav>';
  }

  function progressoHtml() {
    var feitas = ETAPAS.filter(function (e) { return etapaPreenchida(e.id, _dados); }).length;
    var pct = Math.round((feitas / ETAPAS.length) * 100);
    return '<div class="aposta-progresso"><div class="aposta-progresso-barra" style="width:' + pct + '%"></div>' +
      '<span class="aposta-progresso-txt">' + feitas + ' de ' + ETAPAS.length + '</span></div>';
  }

  /* Card de conexão: a etapa anterior fica à vista enquanto a
     próxima é escrita. É o que faz o encadeamento ser sentido em
     vez de explicado. */
  /* Só a Decisão depende da Evidência (dependeDe: 'evidencia') — por
     isso o formato compacto abaixo (indicador + situação inicial/meta/
     observado, sem "Portanto, nossa hipótese foi…") fica só aqui, sem
     mexer em como a própria etapa Evidência ou o mapa final mostram os
     mesmos dados (resumoEtapa continua igual para eles). */
  /* O exemplo de "Próxima ação" muda com a decisão escolhida — o mesmo
     texto genérico ("ajustar a comunicação…") não fazia sentido para
     quem tinha acabado de escolher "Ampliar" ou "Interromper esta
     ideia". Só placeholder: nunca preenche o campo sozinho. */
  var PLACEHOLDER_PROXIMA_ACAO = {
    'Ampliar': 'testar a ideia com um grupo maior ou incorporá-la ao processo padrão',
    'Ajustar e testar novamente': 'ajustar a comunicação e repetir o teste com um grupo maior',
    'Interromper esta ideia': 'encerrar este experimento e registrar o que foi aprendido',
    'Investigar mais': 'conversar com o grupo para entender melhor o que foi observado',
    'Reformular a hipótese': 'testar a nova hipótese com um novo experimento',
    'Rever a mudança mensurável': 'redefinir o que será medido antes de seguir adiante',
    'Rever o problema': 'reunir o grupo para redefinir o problema antes de seguir adiante'
  };

  /* Conversão aproximada só para SUGERIR uma data — meses/bimestres/
     trimestres/anos não têm um número fixo de dias, mas a sugestão é um
     ponto de partida a confirmar, nunca um cálculo que precise ser
     exato. */
  var DIAS_POR_UNIDADE_PRAZO = {
    segundos: 1 / 86400, minutos: 1 / 1440, horas: 1 / 24, dias: 1,
    semanas: 7, meses: 30, bimestres: 60, trimestres: 90, anos: 365
  };
  function dataSugeridaPeloPrazo(num, unidade) {
    var n = parseInt(num, 10);
    if (!n) return '';
    var dias = n * (DIAS_POR_UNIDADE_PRAZO[unidade] || 1);
    try { return new Date(Date.now() + dias * 86400000).toLocaleDateString('pt-BR'); } catch (e) { return ''; }
  }

  function metaLinhaDecisao(m, sufixo) {
    var direcao = String((m || {}).direcao || '').trim();
    if (direcao !== 'Manter') return (m.meta || '—') + concordarSufixo(m.meta, sufixo);
    var tipoLimite = String(m.tipoLimite || '').trim() || 'Pelo menos';
    if (tipoLimite === 'Entre') return 'manter entre ' + (m.limiteMinimo || '—') + ' e ' + (m.limiteMaximo || '—') + concordarSufixo(m.limiteMaximo, sufixo);
    return 'manter em ' + (tipoLimite === 'No máximo' ? 'no máximo ' : 'pelo menos ') + (m.meta || '—') + concordarSufixo(m.meta, sufixo);
  }
  /* Cada item vira indicador + linhas — nunca uma frase remontada com
     lacunas em branco: se o resultado escolhido no Experimento não for
     mais encontrado nas Mudanças mensuráveis, aparece um aviso de
     inconsistência no lugar dele, não uma frase quebrada. */
  function corpoEvidenciaParaDecisao() {
    var ev0 = _dados.evidencia || {};
    var itens = ev0.itens || [];
    if (!itens.length) return '';
    var linhas = itens.map(function (ev) {
      var m = resultadosDe(_dados.mudancas, [ev.resultadoId])[0];
      if (!m) {
        return '<li><span class="aposta-aviso-didatico">Um resultado selecionado no Experimento não foi encontrado nas Mudanças mensuráveis.</span></li>';
      }
      var sufixo = sufixoUnidade(m);
      var direcao = String(m.direcao || '').trim();
      var temAtual = direcao !== 'Atingir' && normalizar(m.atual);
      var observadoTxt = ev.naoMedido === 'sim'
        ? 'Não foi possível medir' + (normalizar(ev.motivo) ? ' (' + ev.motivo + ')' : '')
        : (normalizar(ev.observado) ? (ev.observado + concordarSufixo(ev.observado, sufixo)) : '—');
      return '<li>' +
        '<strong>' + esc(m.indicador || 'Resultado') + '</strong>' +
        (temAtual ? '<span>Situação inicial: ' + esc(m.atual + concordarSufixo(m.atual, sufixo)) + '</span>' : '') +
        '<span>Meta: ' + esc(metaLinhaDecisao(m, sufixo)) + '</span>' +
        '<span>Observado: ' + esc(observadoTxt) + '</span>' +
        (normalizar(ev.fonte) ? '<span>Fonte: ' + esc(ev.fonte) + '</span>' : '') +
        (normalizar(ev.aprendizado) ? '<span>Aprendizado: ' + esc(ev.aprendizado) + '</span>' : '') +
      '</li>';
    }).join('');
    /* A classificação é do CONJUNTO — fica fora da lista de resultados
       (cada <li> é de um resultado só), como uma leitura à parte. */
    var classificacaoTxt = normalizar(ev0.classificacao)
      ? '<p><strong>Nossa hipótese foi:</strong> ' + esc(ev0.classificacao) + '</p>'
      : '';
    return '<ul class="aposta-resultados-observar-lista">' + linhas + '</ul>' + classificacaoTxt;
  }

  /* "Ampliar" pressupõe evidência favorável — ver isso escolhido junto
     com uma meta ainda não atingida é o tipo de contradição que vale
     mostrar sem travar a decisão do grupo (só quem decide sabe o
     contexto todo). Não existe mais uma classificação única da hipótese
     para checar aqui — a leitura é sempre por resultado. */
  function algumaMetaNaoAtingida() {
    var itens = (_dados.evidencia || {}).itens || [];
    return itens.some(function (item) {
      if (item.naoMedido === 'sim') return true;
      var m = resultadosDe(_dados.mudancas, [item.resultadoId])[0];
      if (!m) return false;
      var p = progressoResumo(m, item.observado);
      return !!p && !p.atingiu;
    });
  }
  function mensagemAlertaDecisao(d) {
    if (String(d.decisao || '').trim() !== 'Ampliar') return '';
    if (algumaMetaNaoAtingida()) {
      return 'Pelo menos um resultado esperado ainda não atingiu a meta, mas a decisão escolhida foi "Ampliar". Reveja se já há evidência suficiente para ampliar agora.';
    }
    return '';
  }

  function cardConexao(etapaId) {
    var origem = etapaPorId(etapaId);
    if (!origem) return '';
    if (etapaId === 'evidencia') {
      var corpo = corpoEvidenciaParaDecisao();
      if (!corpo) return '';
      return '<div class="aposta-conexao">' +
        '<span class="aposta-conexao-rot">' + esc(origem.curto) + '</span>' +
        corpo +
      '</div>';
    }
    var texto = resumoEtapa(etapaId, _dados);
    if (!texto) return '';
    return '<div class="aposta-conexao">' +
      '<span class="aposta-conexao-rot">' + esc(origem.curto) + '</span>' +
      '<p>' + esc(texto) + '</p>' +
    '</div>';
  }

  /* Uma quantidade guardada por uma execução anterior veio como texto
     livre ("90 dias"). Lê-se o número e a unidade de dentro dele, para a
     tela nova abrir com o que já estava escrito em vez de em branco. */
  var PISTAS_UNIDADE = [
    ['trimestres', /trimestr/i], ['bimestres', /bimestr/i], ['semanas', /seman/i],
    ['segundos', /segund/i], ['minutos', /minut/i], ['horas', /hora/i],
    ['meses', /m[êe]s/i], ['dias', /dia/i], ['anos', /\bano/i]
  ];
  function lerQuantidade(c, d) {
    var bruto = String((d || {})[c.chave] == null ? '' : d[c.chave]).trim();
    var un = (d || {})[chaveUnidade(c.chave)] || '';
    if (!un) {
      for (var i = 0; i < PISTAS_UNIDADE.length && !un; i++) {
        if (PISTAS_UNIDADE[i][1].test(bruto)) un = PISTAS_UNIDADE[i][0];
      }
    }
    return {
      num: bruto.replace(/\D/g, '').slice(0, 6),
      un: UNIDADES.indexOf(un) !== -1 ? un : (c.unidadePadrao || 'dias'),
      /* Texto que não tem número nenhum não vira quantidade — some se
         ninguém avisar. Ver a nota "você tinha escrito aqui". */
      sobra: /\d/.test(bruto) ? '' : bruto
    };
  }

  /* `semRotulo` é para a lacuna que já vem apresentada pelo texto fixo da
     frase ("e medir" em cima do campo). Repetir "O QUE SERÁ MEDIDO"
     logo abaixo seria dizer a mesma coisa duas vezes; o rótulo continua
     existindo para quem usa leitor de tela, como aria-label. */
  function campoHtml(c, valor, d, semRotulo) {
    var id = 'ap-' + c.chave;
    var rot = semRotulo
      ? ''
      : '<span class="aposta-campo-rot"' + (c.dica ? ' title="' + esc(c.dica) + '"' : '') + '>' + esc(c.rotulo) +
        (c.antes ? ' <em>(antes do experimento)</em>' : '') + '</span>';
    var aria = semRotulo ? ' aria-label="' + esc(c.rotulo) + '"' : '';

    if (c.tipo === 'quantidade') {
      var q = lerQuantidade(c, d || {});
      return '<label class="aposta-campo aposta-campo--qtd">' + rot +
        '<span class="aposta-qtd">' +
          '<input type="text" inputmode="numeric" id="' + id + '" data-campo="' + esc(c.chave) + '"' +
            ' data-mascara="numero" class="aposta-campo-input aposta-qtd-num"' +
            ' value="' + esc(q.num) + '" placeholder="' + esc(c.placeholder || '') + '"' + aria + ' />' +
          '<select data-campo="' + esc(chaveUnidade(c.chave)) + '" class="aposta-campo-input aposta-qtd-un"' +
            ' aria-label="Unidade de ' + esc(c.rotulo) + '">' +
            UNIDADES.map(function (u) {
              return '<option value="' + u + '"' + (q.un === u ? ' selected' : '') + '>' + u + '</option>';
            }).join('') +
          '</select>' +
        '</span>' +
        (q.sobra ? '<span class="aposta-legado-inline">Você tinha escrito aqui: “' + esc(q.sobra) + '”.</span>' : '') +
      '</label>';
    }

    var comum = 'id="' + id + '" data-campo="' + esc(c.chave) + '" class="aposta-campo-input" placeholder="' + esc(c.placeholder || '') + '"' + aria;
    var sobra = '';
    if (c.tipo === 'data' || c.tipo === 'moeda') {
      comum += ' inputmode="numeric" data-mascara="' + (c.tipo === 'data' ? 'data' : 'moeda') + '"';
      /* A máscara só corria enquanto se digitava: o que uma execução
         anterior gravou (o custo "10.0000", visto no uso real) aparecia
         cru, como se a máscara não existisse. Reformatar por conta
         própria também não serve — "10.0000" tanto pode ser R$ 10,00
         quanto R$ 10.000,00, e o site escolheria por ela. Então: o que
         JÁ está no formato fica; o resto sai do campo e aparece escrito
         ao lado, para ser redigitado sem palpite nosso. */
      var visto = valorMascarado(c.tipo, valor);
      valor = visto.valor;
      sobra = visto.sobra;
    }
    return '<label class="aposta-campo' + (c.tipo === 'textarea' ? ' aposta-campo--largo' : '') + '">' + rot +
      (c.tipo === 'textarea'
        ? '<textarea ' + comum + ' rows="2">' + esc(valor || '') + '</textarea>'
        : '<input type="text" ' + comum + ' value="' + esc(valor || '') + '" />') +
      (sobra ? '<span class="aposta-legado-inline">Você tinha escrito aqui: “' + esc(sobra) + '”.</span>' : '') +
    '</label>';
  }

  /* Só sobrevive no campo o que a própria máscara produziria — assim a
     tela nunca mostra um valor que ela mesma não aceitaria. */
  function valorMascarado(tipo, valor) {
    var bruto = String(valor == null ? '' : valor).trim();
    if (!bruto) return { valor: '', sobra: '' };
    return MASCARAS[tipo](bruto) === bruto ? { valor: bruto, sobra: '' } : { valor: '', sobra: bruto };
  }

  /* A escolha entre formas prontas do mesmo texto (a concordância do
     verbo, a direção de uma mudança mensurável): dois cliques preenchem
     na hora com o texto de sempre, mas por baixo é um campo comum —
     "restringir demais", relatado no uso real diante de uma lista com
     só duas opções. Quem tem uma variante que não é nenhuma das prontas
     escreve por cima, e o que for digitado é o que fica salvo — os
     chips são atalho, não portão. */
  /* `opcional` é para campos que fazem sentido ficar em branco de
     verdade (a unidade de uma mudança mensurável nem sempre tem um
     "por X" natural) — aí não força a primeira opção como valor, só
     como sugestão (placeholder), igual um campo comum vazio. */
  function variantePicker(atributo, chave, opcoes, valor, rotulo, id, classeExtra, opcional, desabilitado) {
    var v = opcional ? String(valor == null ? '' : valor).trim() : valorVariante({ opcoes: opcoes }, valor);
    return '<span class="aposta-variante' + (classeExtra ? ' ' + classeExtra : '') + '">' +
      '<input type="text"' + (id ? ' id="' + esc(id) + '"' : '') +
        ' ' + atributo + '="' + esc(chave) + '" class="aposta-campo-input aposta-variante-input"' +
        ' value="' + esc(v) + '"' +
        (opcional ? ' placeholder="' + esc((opcoes || [])[0] || '') + '"' : '') +
        (desabilitado ? ' disabled' : '') +
        ' aria-label="' + esc(rotulo) + '" />' +
      '<span class="aposta-variante-chips">' +
        (opcoes || []).map(function (o) {
          return '<button type="button" class="aposta-variante-chip' + (v === o ? ' is-ativa' : '') + '" data-valor="' + esc(o) + '"' + (desabilitado ? ' disabled' : '') + '>' + esc(o) + '</button>';
        }).join('') +
      '</span>' +
    '</span>';
  }
  function varianteHtml(c, valor) {
    return variantePicker('data-campo', c.chave, c.opcoes || [], valor, c.rotulo, 'ap-' + c.chave);
  }

  /* Texto fixo e lacunas, na ordem da frase. Serve tanto para a frase da
     etapa quanto para os blocos guiados de dentro dela (a próxima
     hipótese, que é uma hipótese e merece o mesmo apoio). */
  /* A pontuação pertence à frase montada, não à tela: um bloco só com
     "." ou "—" seria ruído. O resto do texto fixo aparece. */
  function fixoVisivel(p) {
    var t = String(p).replace(/^[,.;:]+\s*/, '').trim();
    return t && !/^[.…—–-]+$/.test(t) ? t : '';
  }

  /* "por meio de" + "do envio..." lida "por meio de do envio..." — duas
     preposições coladas. Relatado no uso real. Quando o que foi escrito
     já começa com a preposição contraída com artigo (do/da/dos/das) ou
     repete "de", o "de" solto no fim do texto fixo sai de cena — sem
     mexer no resto da frase, e só quando o choque existe de verdade. */
  var PREP_CONTRAIDA = /^(de|do|da|dos|das)\b/i;
  /* "para" duplicado: a Ideia de solução tem "para" fixo no molde
     ("Poderíamos [ação] para [efeito]") — se a pessoa também começar o
     campo "efeito" com "para" ou "para que" (respondendo a pergunta
     como se fosse frase inteira), a frase montada saía "...para para
     que...". Mesma ideia do "de" duplicado logo acima, só que sem
     contração de preposição: aqui o próprio "para" já é a palavra que
     se repete. */
  var PARA_DUPLICADO = /^para\b/i;
  function semPreposicaoDupla(fixo, valorSeguinte) {
    var v = String(valorSeguinte == null ? '' : valorSeguinte).trim();
    if (!v) return fixo;
    if (/\bde$/i.test(fixo)) return PREP_CONTRAIDA.test(v) ? fixo.replace(/\s*de\s*$/i, '') : fixo;
    if (/\bpara$/i.test(fixo)) return PARA_DUPLICADO.test(v) ? fixo.replace(/\s*para\s*$/i, '') : fixo;
    return fixo;
  }

  function lacunaHtml(etapa, p, d, usados, semRotulo) {
    if (p.escolha) { usados['@escolha'] = 1; return escolhaHtml(etapa.escolha, d, semRotulo); }
    var c = campoPorChave(etapa, p.c);
    if (!c) return '';
    usados[c.chave] = 1;
    if (c.tipo === 'quantidade') usados[chaveUnidade(c.chave)] = 1;
    if (c.tipo === 'variantes') return varianteHtml(c, d[p.c]);
    /* Decisão: o exemplo da Próxima ação acompanha a decisão escolhida
       (ver PLACEHOLDER_PROXIMA_ACAO) — só troca o placeholder, nunca o
       valor já digitado. */
    if (c.chave === 'proximaAcao' && PLACEHOLDER_PROXIMA_ACAO[d.decisao]) {
      c = Object.assign({}, c, { placeholder: PLACEHOLDER_PROXIMA_ACAO[d.decisao] });
    }
    return campoHtml(c, d[p.c], d, semRotulo);
  }

  function classeDoPar(etapa, p) {
    if (p.escolha) return ' aposta-par--largo';
    var c = campoPorChave(etapa, p.c);
    if (!c) return '';
    if (c.tipo === 'textarea') return ' aposta-par--largo';
    if (c.tipo === 'quantidade') return ' aposta-par--qtd';
    return '';
  }

  /* O texto fixo sai GRUDADO na lacuna que ele apresenta. Solto, ele cai
     numa linha sozinha entre dois campos largos — foi assim que "e medir"
     apareceu perdido no meio do Experimento, sem nada dizendo a que
     campo pertencia. Junto, cada pedaço da frase é a legenda da sua
     lacuna, e a linha nunca quebra entre os dois. */
  function blocosDoMolde(etapa, molde, d, usados) {
    var partes = molde || [];
    var out = [];
    for (var i = 0; i < partes.length; i++) {
      var p = partes[i];
      if (typeof p === 'string') {
        var t = fixoVisivel(p);
        if (!t) continue;
        var seguinte = partes[i + 1];
        if (seguinte && typeof seguinte !== 'string') {
          if (!seguinte.escolha) t = semPreposicaoDupla(t, d[seguinte.c]);
          /* O texto fixo é quem serve de rótulo visível para a lacuna
             (lacunaHtml chama campoHtml com semRotulo=true) — a dica do
             campo, quando existe, não teria onde aparecer, então vira
             tooltip nele mesmo. `rotuloMolde` troca só o que é MOSTRADO
             ("Prazo" em vez de "em"), sem mudar a palavra que entra na
             frase montada (`t`, inalterado). */
          var campoSeg = !seguinte.escolha ? campoPorChave(etapa, seguinte.c) : null;
          var tExibido = (campoSeg && campoSeg.rotuloMolde) ? campoSeg.rotuloMolde : t;
          var classeFixo = (campoSeg && campoSeg.rotuloMolde) ? 'aposta-campo-rot' : 'aposta-molde-fixo';
          var tituloFixo = campoSeg && campoSeg.dica ? ' title="' + esc(campoSeg.dica) + '"' : '';
          out.push('<div class="aposta-par' + classeDoPar(etapa, seguinte) + '">' +
            '<span class="' + classeFixo + '"' + tituloFixo + '>' + esc(tExibido) + '</span>' +
            lacunaHtml(etapa, seguinte, d, usados, true) +
          '</div>');
          i++;
          continue;
        }
        out.push('<span class="aposta-molde-fixo">' + esc(t) + '</span>');
        continue;
      }
      out.push(lacunaHtml(etapa, p, d, usados, false));
    }
    return out.join('');
  }

  /* Execução gravada quando o campo era texto livre: o que estava lá
     continua guardado (input escondido) e à vista até as lacunas novas
     serem preenchidas. Nada do que o grupo escreveu some. */
  function legadoHtml(chave, d, mostrarAviso) {
    var txt = String((d || {})[chave] || '').trim();
    if (!txt) return '';
    return '<input type="hidden" data-campo="' + esc(chave) + '" value="' + esc(txt) + '" />' +
      (mostrarAviso
        ? '<p class="aposta-legado">Você tinha escrito aqui: “' + esc(txt) + '”. ' +
          'Distribua nas lacunas — enquanto elas estiverem vazias, é esse texto que vai para o mapa.</p>'
        : '');
  }

  /* O formulário É a frase: o texto fixo aparece como texto, e só as
     lacunas são digitáveis, na ordem em que vão sair no mapa. */
  function moldeHtml(etapa, d) {
    var usados = {};
    var html = '<div class="aposta-molde">' +
      '<p class="aposta-molde-legenda">Preencha as lacunas — o texto claro já faz parte da frase.</p>' +
      blocosDoMolde(etapa, etapa.molde, d, usados) +
    '</div>';

    if (etapa.escolha && !usados['@escolha']) html += escolhaHtml(etapa.escolha, d);

    /* Fase 4: logo abaixo da escolha principal da Decisão — só existe
       quando a decisão atual pede um ponto de reinício escolhido. */
    if (etapa.id === 'decisao') html += pontoReinicioHtml(d);

    /* O que o Experimento vai medir não é mais texto redigitado: é a
       escolha de quais Mudanças mensuráveis este teste observa. */
    if (etapa.id === 'experimento') html += resultadosPickerHtml(d);

    /* Decisão: alerta de coerência não-bloqueante entre a decisão
       escolhida e o que a Evidência registrou (ver atualizarAlertaDecisao)
       — nasce vazio, só ganha conteúdo depois do primeiro cálculo. */
    if (etapa.id === 'decisao') html += '<div class="aposta-decisao-alerta" id="apostaDecisaoAlerta"></div>';

    /* Blocos guiados que não entram na frase da etapa, mas também são
       frases (hoje: a nova hipótese da Decisão). Quando o bloco depende
       de uma escolha (dependeDaEscolha), a visibilidade não é só uma
       mensagem — o bloco fica de fato oculto, recolhido ou aberto,
       conforme escondeQuando/abreAutoQuando (ver também
       atualizarGruposPorEscolha, que refaz isso ao vivo quando a
       escolha muda sem recarregar a tela). Um <details> só, com/sem
       `open`, evita trocar a estrutura do DOM ao alternar entre
       recolhido e aberto. */
    (etapa.grupos || []).forEach(function (g) {
      var blocos = blocosDoMolde(etapa, g.molde, d, usados);
      var vazio = !(g.molde || []).some(function (p) {
        return typeof p !== 'string' && p.c && String(d[p.c] || '').trim();
      });
      var escolhido = g.dependeDaEscolha ? String(d[g.dependeDaEscolha] || '').trim() : '';
      var temCondicao = !!(g.escondeQuando || g.abreAutoQuando);
      var escondido = temCondicao && (!escolhido || (g.escondeQuando && g.escondeQuando.indexOf(escolhido) !== -1));
      var abreAuto = temCondicao && !!(g.abreAutoQuando && g.abreAutoQuando.indexOf(escolhido) !== -1);
      html += '<details class="aposta-grupo"' + (g.id ? ' id="' + esc(g.id) + '"' : '') +
          (escondido ? ' hidden' : '') + (abreAuto || !temCondicao ? ' open' : '') + '>' +
        '<summary class="aposta-grupo-rot">' + esc(abreAuto || !temCondicao ? g.rotulo : (g.resumoQuando || g.rotulo)) + '</summary>' +
        (abreAuto && g.dicaObrigatoria ? '<p class="aposta-grupo-dica">' + esc(g.dicaObrigatoria) + '</p>' : '') +
        '<div class="aposta-molde aposta-molde--grupo">' + blocos + '</div>' +
        (g.legado ? legadoHtml(g.legado, d, vazio) : '') +
      '</details>';
      if (g.legado) usados[g.legado] = 1;
    });

    /* Campos que não entram em frase nenhuma (responsável, custo, prazo…)
       ficam separados: misturados ao molde, faziam a frase parecer maior
       do que é. */
    var extras = (etapa.campos || []).filter(function (c) { return !usados[c.chave]; });
    if (extras.length) {
      html += '<div class="aposta-complementos">' +
        '<p class="aposta-complementos-rot">Complementos — combinados do grupo, não entram na frase</p>' +
        extras.map(function (c) { return campoHtml(c, d[c.chave], d); }).join('') +
        /* Prazo e Data de reavaliação são combinados separadamente (ver
           atualizarAlertaPrazo) — a sugestão nasce vazia, calculada só
           depois do primeiro cálculo, e nunca preenche o campo sozinha. */
        (etapa.id === 'decisao' ? '<div class="aposta-decisao-alerta" id="apostaPrazoAlerta"></div>' : '') +
      '</div>';
    }

    if (etapa.legado && !usados[etapa.legado]) {
      html += legadoHtml(etapa.legado, d, !temLacunaPreenchida(etapa, d));
    }
    return html;
  }

  function renderEtapa() {
    var etapa = etapaPorId(_etapaAtual) || ETAPAS[0];
    var d = _dados[etapa.id] || {};
    var idx = indiceEtapa(etapa.id);

    /* Etapa 1 com missão cadastrada pela facilitação: abre com ela na
       tela, ainda não gravada no grupo — quem seguir adiante a adota,
       quem ajustar grava o ajuste. */
    var herdada = etapa.id === 'missao' && !etapaPreenchida('missao', _dados) && temMissaoDaExecucao();
    if (herdada) d = missaoDaExecucao();

    var corpo = (herdada
      ? '<p class="aposta-herdada">Missão cadastrada pela facilitação. Vocês podem ajustar — ' +
        'o que ficar aqui é a missão do grupo.</p>'
      : '') + (etapa.lista ? mudancasHtml(d) : (etapa.id === 'evidencia' ? evidenciaHtml(d) : moldeHtml(etapa, d)));

    /* Evidência muda de pergunta e de rótulo do botão principal conforme
       o modo (planejamento x registro de resultados) — o banner com a
       explicação de cada modo já vem dentro de evidenciaHtml(), então o
       texto de apoio estático da etapa (auxiliar) fica só para as
       demais, para não duplicar a mesma explicação duas vezes. */
    var statusEv = etapa.id === 'evidencia' ? statusEvidencia({ mudancas: _dados.mudancas, experimento: _dados.experimento, evidencia: d }) : null;
    var pergunta = statusEv && !statusEv.registrando ? 'Como saberemos o que aconteceu?' : etapa.pergunta;
    var seguirLabel = idx === ETAPAS.length - 1 ? 'Ver o mapa da aposta →' : 'Continuar →';
    if (statusEv) {
      seguirLabel = !statusEv.registrando
        ? (statusEv.estado === 'pronta' ? 'Registrar resultados do experimento' : 'Salvar plano para execução')
        : 'Continuar para Decisão →';
    }
    /* Item 6/16 do ajuste de usabilidade: o botão principal já nasce
       desabilitado de verdade quando falta algo, em vez de parecer ativo
       até o clique provar o contrário. */
    var seguirBloqueado = seguirDesabilitado(etapa, d);

    _tela.innerHTML = cabecalho() +
      '<div class="aposta-corpo">' +
        trilhaHtml() +
        '<main class="aposta-palco">' +
          progressoHtml() +
          (etapa.dependeDe ? cardConexao(etapa.dependeDe) : '') +
          (etapa.id === 'ideia' ? resultadosProduzirHtml() : '') +
          '<div class="aposta-etapa">' +
            '<div class="aposta-etapa-cab">' +
              '<h1 class="aposta-etapa-titulo">' + esc(etapa.titulo) + '</h1>' +
              '<button class="aposta-ajuda" type="button" title="' + esc(etapa.dica) + '" aria-label="Ajuda">?</button>' +
            '</div>' +
            '<p class="aposta-pergunta">' + esc(pergunta) + '</p>' +
            (etapa.auxiliar && etapa.id !== 'evidencia' ? '<p class="aposta-auxiliar">' + esc(etapa.auxiliar) + '</p>' : '') +
            '<div class="aposta-campos">' + corpo + '</div>' +
            /* A frase montada, ao vivo, embaixo das lacunas: o que ainda
               falta aparece marcado no lugar exato em que vai entrar, e
               clicar nele leva o cursor para o campo. É a resposta a
               "não sei mais o que falta preencher" — a etapa não depende
               de a pessoa reler os campos um por um para descobrir. */
            (etapa.lista || etapa.id === 'evidencia' ? '' :
              '<div class="aposta-frase" id="apostaFrase"></div>') +
            (etapa.rodape ? '<p class="aposta-rodape">' + esc(etapa.rodape) + '</p>' : '') +
            (etapa.exemplo
              ? '<details class="aposta-exemplo"><summary>Ver exemplo</summary><p>' + esc(etapa.exemplo) + '</p></details>'
              : '') +
            '<div class="aposta-avisos" id="apostaAvisos"></div>' +
          '</div>' +
          '<div class="aposta-navegacao">' +
            (idx > 0 ? '<button class="btn" id="apostaVoltar">← Voltar</button>' : '<span></span>') +
            '<span class="aposta-salvo" id="apostaSalvo"></span>' +
            '<button class="btn btn--primary" id="apostaSeguir"' + (seguirBloqueado ? ' disabled' : '') + '>' + esc(seguirLabel) + '</button>' +
          '</div>' +
        '</main>' +
      '</div>';

    ligarCabecalho();
    ligarEtapa(etapa);
  }

  function escolhaHtml(escolha, d, semRotulo) {
    var valorAtual = d[escolha.chave];
    var explicacao = escolha.explicacoes && valorAtual ? escolha.explicacoes[valorAtual] : '';
    return '<div class="aposta-escolha">' +
      (semRotulo ? '' : '<span class="aposta-campo-rot">' + esc(escolha.rotulo) + '</span>') +
      '<div class="aposta-escolha-opcoes">' +
        escolha.opcoes.map(function (o) {
          var dica = escolha.dicas && escolha.dicas[o];
          return '<button type="button" class="aposta-opcao' + (d[escolha.chave] === o ? ' is-ativa' : '') +
            '"' + (dica ? ' title="' + esc(dica) + '"' : '') +
            ' data-escolha="' + esc(escolha.chave) + '" data-valor="' + esc(o) + '">' + esc(o) + '</button>';
        }).join('') +
      '</div>' +
      (explicacao ? '<p class="aposta-grupo-dica" data-escolha-explicacao="' + esc(escolha.chave) + '">' + esc(explicacao) + '</p>' : '') +
    '</div>';
  }

  /* Fase 4 — ponto de reinício da Decisão: mesmo visual de escolhaHtml
     (reaproveita as classes .aposta-escolha/.aposta-opcao, para o
     clique cair no mesmo mecanismo genérico — ver ligarEtapa), mas não
     é um etapa.escolha declarado no molde porque as OPÇÕES mudam
     conforme a decisão escolhida (rotulo ≠ valor, ao contrário da
     escolha principal — ver OPCOES_PONTO_REINICIO). Vazio quando a
     decisão atual não pede essa escolha. */
  function pontoReinicioHtml(d) {
    if (!decisaoPedePontoDeReinicioEscolhido(d.decisao)) return '';
    var opcoes = OPCOES_PONTO_REINICIO[d.decisao] || [];
    var atual = d.pontoDeReinicioEscolhido || '';
    return '<div class="aposta-escolha" id="apostaGrupoPontoReinicio">' +
      '<span class="aposta-campo-rot">' + esc(PERGUNTA_PONTO_REINICIO[d.decisao] || 'O que precisa ser revisto?') + '</span>' +
      '<div class="aposta-escolha-opcoes">' +
        opcoes.map(function (o) {
          return '<button type="button" class="aposta-opcao' + (atual === o.valor ? ' is-ativa' : '') +
            '" data-escolha="pontoDeReinicioEscolhido" data-valor="' + esc(o.valor) + '">' + esc(o.rotulo) + '</button>';
        }).join('') +
      '</div>' +
    '</div>';
  }

  /* O 4º campo da linha 1 muda com a Direção — Meta desejada para
     Aumentar/Reduzir/Atingir; para Manter, Tipo de limite e, dependendo
     dele, Meta OU os dois Limites. Um <span data-meta-area> com
     display:contents (CSS) segura esse pedaço: os campos continuam
     itens diretos do grid, e o JS troca só esse trecho quando a
     Direção ou o Tipo de limite mudam (ver reconstruirCamposMeta). */
  function camposMetaHtml(m) {
    var direcao = String(m.direcao || '').trim();
    if (direcao !== 'Manter') {
      return '<label class="aposta-campo"><span class="aposta-campo-rot" title="Qual valor queremos alcançar?">Meta desejada</span>' +
        '<input type="text" inputmode="decimal" class="aposta-campo-input" data-m="meta" value="' + esc(m.meta || '') + '" placeholder="700" /></label>';
    }
    var tipoLimite = String(m.tipoLimite || '').trim() || 'Pelo menos';
    var html = '<label class="aposta-campo"><span class="aposta-campo-rot">Tipo de limite</span>' +
      variantePicker('data-m', 'tipoLimite', TIPOS_LIMITE, m.tipoLimite, 'Tipo de limite', null, 'aposta-variante--campo') +
    '</label>';
    if (tipoLimite === 'Entre') {
      html += '<label class="aposta-campo"><span class="aposta-campo-rot">Limite mínimo</span>' +
          '<input type="text" inputmode="decimal" class="aposta-campo-input" data-m="limiteMinimo" value="' + esc(m.limiteMinimo || '') + '" placeholder="2" /></label>' +
        '<label class="aposta-campo"><span class="aposta-campo-rot">Limite máximo</span>' +
          '<input type="text" inputmode="decimal" class="aposta-campo-input" data-m="limiteMaximo" value="' + esc(m.limiteMaximo || '') + '" placeholder="5" /></label>';
    } else {
      html += '<label class="aposta-campo"><span class="aposta-campo-rot" title="O nível, teto ou piso que não queremos perder.">Meta</span>' +
        '<input type="text" inputmode="decimal" class="aposta-campo-input" data-m="meta" value="' + esc(m.meta || '') + '" placeholder="98" /></label>';
    }
    return html;
  }

  /* ── Mudanças mensuráveis: várias por missão ── */
  function mudancasHtml(d) {
    /* Começa com uma em branco. Antes, uma etapa sem nenhuma mudança
       mostrava só um botão "+ OUTRA mudança mensurável" — outra que
       quê? — e quem lia isso tinha de descobrir que era ali que se
       começava. O botão continua, para a segunda em diante. */
    var itens = (d.itens && d.itens.length) ? d.itens : [{}];
    var podeRemover = itens.length > 1;
    /* Cada mudança precisa de um id estável para o Experimento poder
       apontar para ela (resultadoIds) e a Evidência montar o card
       certo — inclusive uma mudança gravada antes de isso existir.
       Gerado uma vez e mantido: mutar `d.itens[i]` aqui é o que faz o
       id sobreviver ao próximo salvamento (coletar() relê o campo
       escondido abaixo). */
    itens.forEach(function (m) { if (!m.id) m.id = gerarResultadoId(); });
    return '<div class="aposta-mudancas">' +
      itens.map(function (m, i) {
        var q = lerQuantidade({ chave: 'prazo', unidadePadrao: 'dias' }, m);
        var mig = migrarUnidadePeriodo(m);
        var chipsUnidade = UNIDADES_SUGERIDAS[m.formaMedicao] || [];
        var valorUnidade = UNIDADE_AUTOMATICA[m.formaMedicao] || mig.unidade || '';
        var indiceNPS = ehIndiceNPS(m);
        var valorPeriodo = indiceNPS ? 'não se aplica' : mig.periodo;
        var tituloPeriodo = indiceNPS
          ? 'NPS é um índice, não uma contagem ao longo do tempo — não se mede "por dia" ou "por mês".'
          : 'Esses valores são medidos em qual período? Ex.: por dia, por semana, por mês, por trimestre, por semestre, por ano, por atendimento, por processo, não se aplica.';
        return '<div class="aposta-mudanca" data-i="' + i + '">' +
          '<input type="hidden" data-m="id" value="' + esc(m.id) + '" />' +
          '<div class="aposta-mudanca-grade">' +
            /* Linha 1 */
            '<label class="aposta-campo"><span class="aposta-campo-rot">Direção da mudança</span>' +
              variantePicker('data-m', 'direcao', DIRECOES_MUDANCA, m.direcao, 'Direção da mudança', null, 'aposta-variante--campo') +
            '</label>' +
            '<label class="aposta-campo"><span class="aposta-campo-rot" title="O indicador define o que será observado para saber se a realidade mudou.">Indicador</span>' +
              '<input type="text" class="aposta-campo-input" data-m="indicador" value="' + esc(m.indicador || '') + '" placeholder="Ex.: contatos sobre o andamento da concessão" /></label>' +
            '<label class="aposta-campo"><span class="aposta-campo-rot" title="Qual é o valor atual deste indicador?">Situação atual</span>' +
              '<input type="text" inputmode="decimal" class="aposta-campo-input" data-m="atual" value="' + esc(m.atual || '') + '" placeholder="1.000" /></label>' +
            '<span data-meta-area>' + camposMetaHtml(m) + '</span>' +
            /* Linha 2 */
            '<label class="aposta-campo"><span class="aposta-campo-rot" title="Como este indicador é expresso?">Forma de medição</span>' +
              '<select class="aposta-campo-input" data-m="formaMedicao">' +
                '<option value="">Selecione</option>' +
                FORMAS_MEDICAO.map(function (f) {
                  return '<option value="' + esc(f) + '"' + (m.formaMedicao === f ? ' selected' : '') + '>' + esc(f) + '</option>';
                }).join('') +
              '</select>' +
            '</label>' +
            '<label class="aposta-campo" data-campo-unidade><span class="aposta-campo-rot">Unidade</span>' +
              variantePicker('data-m', 'unidade', chipsUnidade, valorUnidade, 'Unidade', null, 'aposta-variante--campo', true) +
            '</label>' +
            '<label class="aposta-campo" data-campo-periodo><span class="aposta-campo-rot" title="' + esc(tituloPeriodo) + '">Período de medição</span>' +
              variantePicker('data-m', 'periodo', PERIODOS_SUGERIDOS, valorPeriodo, 'Período de medição', null, 'aposta-variante--campo', true, indiceNPS) +
            '</label>' +
            '<label class="aposta-campo aposta-campo--qtd"><span class="aposta-campo-rot" title="Até quando queremos alcançar esta mudança?">Prazo para atingir o resultado</span>' +
              '<span class="aposta-qtd">' +
                '<input type="text" inputmode="numeric" data-mascara="numero" class="aposta-campo-input aposta-qtd-num" data-m="prazo" value="' + esc(q.num) + '" placeholder="90" />' +
                '<select class="aposta-campo-input aposta-qtd-un" data-m="prazoUnidade" aria-label="Unidade do prazo">' +
                  UNIDADES.map(function (u) {
                    return '<option value="' + u + '"' + (q.un === u ? ' selected' : '') + '>' + u + '</option>';
                  }).join('') +
                '</select>' +
              '</span></label>' +
          '</div>' +
          alertaConsistenciaMudanca(m) +
          (mudancaCoerente(m)
            ? '<p class="aposta-mudanca-frase">' + htmlDaFrase(partesMudanca(m)) + '</p>'
            : '<p class="aposta-mudanca-frase aposta-frase-falta">Corrija a inconsistência acima para visualizar a mudança mensurável.</p>') +
          (podeRemover ? '<button type="button" class="aposta-mudanca-del" data-del="' + i + '">Remover</button>' : '') +
        '</div>';
      }).join('') +
      '<button type="button" class="btn btn--sm" id="apostaAddMudanca">+ Outra mudança mensurável</button>' +
    '</div>';
  }

  /* ── "O que vamos observar?" — o Experimento escolhe quais Mudanças
     mensuráveis vai observar, em vez de redigitar um indicador em
     texto livre. Uma só mudança: já vem marcada, sem pedir escolha.
     Várias: todas vêm marcadas (o caso comum é observar tudo), e dá
     para desmarcar as que não valem para este teste. */
  function resultadosPickerHtml(d) {
    var todos = ((_dados.mudancas || {}).itens || []).filter(function (m) { return normalizar(m.indicador); });
    if (!todos.length) {
      return '<div class="aposta-resultados">' +
        '<p class="aposta-campo-rot">O que vamos observar?</p>' +
        '<p class="aposta-auxiliar">Ainda não há nenhuma mudança mensurável cadastrada — volte lá para registrar o que este experimento vai observar.</p>' +
      '</div>';
    }
    var unico = todos.length === 1;
    var jaEscolheu = Array.isArray(d.resultadoIds);
    return '<div class="aposta-resultados">' +
      '<p class="aposta-campo-rot">O que vamos observar?</p>' +
      '<p class="aposta-auxiliar">Selecione quais resultados esperados este experimento ajudará a testar.</p>' +
      todos.map(function (m) {
        var marcado = unico || (jaEscolheu ? d.resultadoIds.indexOf(m.id) !== -1 : true);
        return '<label class="aposta-resultado-item' + (marcado ? ' is-marcado' : '') + '">' +
          '<input type="checkbox" data-campo="resultadoIds" value="' + esc(m.id) + '"' +
            (marcado ? ' checked' : '') + (unico ? ' disabled' : '') + ' />' +
          '<span class="aposta-resultado-txt">' +
            '<strong>' + esc(m.indicador) + '</strong>' +
            '<span>' + esc(resumoCurtoMudanca(m)) + '</span>' +
          '</span>' +
        '</label>';
      }).join('') +
    '</div>';
  }

  /* ── Evidência: um card por resultado escolhido no Experimento —
     indicador, situação inicial, meta, unidade e período vêm prontos
     de Mudanças mensuráveis, sem poder ser editados aqui. O único
     dado novo é o que a realidade respondeu. */
  /* A etapa Evidência inteira alterna entre dois modos — nunca card a
     card (melhoria de usabilidade: misturar planejamento e registro no
     mesmo card, mesmo em momentos diferentes, deixava a pessoa perdida).
     Um card só tem o Plano de Evidência completo quando a fonte
     prevista está escolhida (e, se for "Outro", também o detalhe); só
     está completo como Evidência Observada com Resultado observado +
     Fonte + Aprendizado, ou "não foi possível medir" + Motivo. */
  function planoDeEvidenciaCompleto(ev) {
    return normalizar(ev.fontePrevista) && (ev.fontePrevista !== 'Outro' || normalizar(ev.comoSeraMedido));
  }
  function evidenciaCardCompleto(ev) {
    return ev.naoMedido === 'sim' ? normalizar(ev.motivo)
      : (normalizar(ev.observado) && normalizar(ev.fonte) && normalizar(ev.aprendizado));
  }
  /* Estado da etapa inteira — usado tanto para desenhar a tela quanto
     para decidir o rótulo/comportamento do botão principal.
     PLANEJAMENTO = plano de evidência ainda incompleto.
     PRONTA = plano completo, execução ainda não registrada.
     REGISTRANDO = execução registrada, cards ainda incompletos.
     CONCLUIDA = tudo registrado.
     Uma evidência já registrada por uma versão anterior (sem a flag
     `registrando`) é reconhecida pelo próprio conteúdo, sem perder
     nada. */
  function statusEvidencia(dados) {
    var resultados = resultadosDe(dados.mudancas, (dados.experimento || {}).resultadoIds);
    var itens = (dados.evidencia || {}).itens || [];
    function evidenciaDe(id) { return itens.filter(function (ev) { return ev.resultadoId === id; })[0] || {}; }
    var registrando = (dados.evidencia || {}).registrando === 'sim' || itens.some(function (ev) {
      return ev.naoMedido === 'sim' || normalizar(ev.observado) || normalizar(ev.fonte) ||
        normalizar(ev.motivo) || normalizar(ev.aprendizado);
    });
    if (!resultados.length) return { registrando: registrando, estado: 'planejamento' };
    if (!registrando) {
      var planoCompleto = resultados.every(function (m) { return planoDeEvidenciaCompleto(evidenciaDe(m.id)); });
      return { registrando: false, estado: planoCompleto ? 'pronta' : 'planejamento' };
    }
    var tudoCompleto = resultados.every(function (m) { return evidenciaCardCompleto(evidenciaDe(m.id)); });
    return { registrando: true, estado: tudoCompleto ? 'concluida' : 'registrando' };
  }

  /* Regra global do ajuste de usabilidade (item 6): um botão bloqueado
     precisa estar `disabled` de verdade — nunca só "amarelo mas não
     avança ao clicar". Reaproveita exatamente as mesmas checagens que o
     clique em CONTINUAR já usa para bloquear (mudança incoerente, frase
     estrita incompleta, Nova Hipótese faltando, Evidência incompleta em
     qualquer um dos dois modos), então nunca diverge do que o clique
     realmente permite. Missão/Sintoma/Problema não entram aqui porque
     não têm bloqueio de verdade hoje — só avisos didáticos dispensáveis. */
  function seguirDesabilitado(etapa, d) {
    if (etapa.id === 'mudancas') {
      return indiceMudancaIncoerente(d) !== -1;
    }
    if (etapa.id === 'evidencia') {
      var se = statusEvidencia({ mudancas: _dados.mudancas, experimento: _dados.experimento, evidencia: d });
      if (!se.registrando) return se.estado !== 'pronta';
      return (d.itens || []).some(function (ev) { return !evidenciaCardCompleto(ev); }) || !normalizar(d.classificacao);
    }
    if (ETAPAS_FRASE_ESTRITA[etapa.id]) {
      var faltam = partesFaltantesEtapa(etapa, d);
      var temLegadoValido = etapa.legado && String(d[etapa.legado] || '').trim() && !temLacunaPreenchida(etapa, d);
      if (faltam.length && !temLegadoValido) return true;
      if (etapa.id === 'decisao' && (decisaoFaltaNovaHipotese(d) || decisaoFaltaPontoDeReinicio(d))) return true;
      return false;
    }
    return false;
  }

  /* Bloco "plano pronto" — dois textos diferentes para o mesmo estado,
     conforme o jeito de chegar nele (ver ajuste de usabilidade #2/#3):
     RETOMANDO (render normal da etapa — o plano já estava salvo antes
     de abrir a tela, por exemplo ao voltar noutro dia) mostra só o
     status, sem repetir a ação de sair, que a pessoa já usou; RECÉM-
     COMPLETO (ao vivo, no instante em que a última Fonte prevista é
     escolhida — ver atualizarStatusEvidencia em ligarEtapa) é o
     feedback e o convite a encerrar descritos no pedido de usabilidade. */
  function blocoPlanoProntoHtml(retomando) {
    if (retomando) {
      return '<div class="aposta-herdada" data-plano-pronto>' +
          '<p style="margin:0"><strong>PLANO DE EVIDÊNCIA SALVO.</strong> Aguardando execução do experimento.</p>' +
        '</div>';
    }
    return '<div class="aposta-herdada" data-plano-pronto>' +
        '<p style="margin:0 0 8px">✓ Plano de evidência salvo. Pronto para execução.</p>' +
        '<button type="button" class="btn btn--sm" id="apostaSairEvidencia">Encerrar por agora</button>' +
      '</div>';
  }

  /* Item 8 do ajuste de usabilidade: no modo de registro, uma mensagem
     objetiva (nunca genérica) lista exatamente o que falta, por
     resultado — e reage em tempo real (ver atualizarStatusEvidencia). As
     mesmas três condições de evidenciaCardCompleto(), só que abertas em
     itens nomeados em vez de um booleano só. */
  function pendenciasEvidencia(resultados, evidenciaDe, classificacao) {
    var itens = [];
    resultados.forEach(function (m, i) {
      var ev = evidenciaDe(m.id);
      var rotulo = 'Resultado ' + (i + 1);
      if (ev.naoMedido === 'sim') {
        if (!normalizar(ev.motivo)) itens.push('Motivo do ' + rotulo);
        return;
      }
      if (!normalizar(ev.observado)) itens.push('Resultado observado do ' + rotulo);
      if (!normalizar(ev.fonte)) itens.push('Fonte utilizada do ' + rotulo);
      if (!normalizar(ev.aprendizado)) itens.push('Aprendizado do ' + rotulo);
    });
    /* "Nossa hipótese foi" é do CONJUNTO, não de um resultado — por isso
       entra por último na lista, depois de cada resultado nomeado. */
    if (!normalizar(classificacao)) itens.push('"Nossa hipótese foi" (avaliação do conjunto das evidências)');
    return itens;
  }
  function pendenciasEvidenciaHtml(resultados, evidenciaDe, classificacao) {
    var itens = pendenciasEvidencia(resultados, evidenciaDe, classificacao);
    if (!itens.length) return '<p class="aposta-aviso-ok" data-evidencia-pendencias>✓ Evidências completas.</p>';
    return '<div class="aposta-aviso-didatico" data-evidencia-pendencias>' +
        '<p style="margin:0 0 6px">Complete os dados abaixo para continuar:</p>' +
        '<ul style="margin:0;padding-left:18px">' + itens.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' +
      '</div>';
  }

  /* "Nossa hipótese foi:" é uma leitura ÚNICA do CONJUNTO das evidências
     — nunca por resultado (um mesmo experimento pode produzir evidências
     que apontam em direções diferentes; reduzir isso a um veredito por
     card seria exatamente o julgamento automático que a dinâmica evita).
     Refere-se SEMPRE à hipótese ORIGINAL (etapa H — Hipótese, nunca
     reescrita) — a eventual hipótese NOVA só existe depois, na Decisão,
     em campos separados (proxHipCausa/proxHipIndicio) que nunca
     sobrescrevem esta avaliação nem a hipótese original. */
  var CLASSIFICACOES_HIPOTESE = ['Sustentada', 'Parcialmente sustentada', 'Não sustentada'];
  function classificacaoHipoteseHtml(d) {
    var atual = String(d.classificacao || '').trim();
    return '<div class="aposta-escolha" id="apostaClassificacaoHipotese">' +
      '<span class="aposta-campo-rot">Nossa hipótese foi:</span>' +
      '<p class="aposta-auxiliar">O que as evidências nos dizem sobre a hipótese que testamos?</p>' +
      '<div class="aposta-escolha-opcoes">' +
        CLASSIFICACOES_HIPOTESE.map(function (o) {
          return '<button type="button" class="aposta-opcao' + (atual === o ? ' is-ativa' : '') +
            '" data-classificacao-valor="' + esc(o) + '">' + esc(o) + '</button>';
        }).join('') +
      '</div>' +
      '<input type="hidden" data-campo="classificacao" value="' + esc(atual) + '" />' +
    '</div>';
  }

  function evidenciaHtml(d) {
    var experimento = _dados.experimento || {};
    var resultados = resultadosDe(_dados.mudancas, experimento.resultadoIds);
    var itens = d.itens || [];
    function evidenciaDe(id) { return itens.filter(function (ev) { return ev.resultadoId === id; })[0] || {}; }

    if (!resultados.length) {
      return '<p class="admin-empty">Volte ao Experimento e escolha ao menos um resultado esperado para medir — é a partir dessa escolha que os cards de evidência aparecem aqui.</p>';
    }

    var status = statusEvidencia({ mudancas: _dados.mudancas, experimento: experimento, evidencia: d });
    var registrando = status.registrando;

    var banner = registrando
      ? '<p class="aposta-herdada"><strong>REGISTRO DOS RESULTADOS.</strong> Agora registre o que foi observado durante o experimento e o que aprendemos com cada evidência.</p>'
      : '<p class="aposta-herdada"><strong>PLANEJAMENTO DA EVIDÊNCIA.</strong> Defina agora onde os dados serão buscados. O resultado observado será registrado somente depois da execução do experimento.</p>';

    var html = resultados.map(function (m, i) {
      var ev = evidenciaDe(m.id);
      var naoMedido = ev.naoMedido === 'sim';
      var sufixo = sufixoUnidade(m);
      var metaTxt = metaOuLimiteTexto(m, sufixo);
      var progresso = !naoMedido ? progressoResumo(m, ev.observado) : null;

      var miolo = !registrando
        ? (
          '<p class="aposta-campo-rot" style="margin:14px 0 0">COMO VAMOS MEDIR?</p>' +
          '<div class="aposta-mudanca-grade" style="margin-top:6px">' +
            '<label class="aposta-campo"><span class="aposta-campo-rot" title="Como o grupo pretende saber se esta mudança aconteceu, antes de executar o experimento.">Fonte prevista da evidência</span>' +
              '<select class="aposta-campo-input" data-e="fontePrevista">' +
                '<option value="">Selecione</option>' +
                FONTES_EVIDENCIA.map(function (f) {
                  return '<option value="' + esc(f) + '"' + (ev.fontePrevista === f ? ' selected' : '') + '>' + esc(f) + '</option>';
                }).join('') +
              '</select>' +
            '</label>' +
            '<label class="aposta-campo aposta-campo--largo"><span class="aposta-campo-rot"' +
                (ev.fontePrevista === 'Outro' ? ' title="Fonte “Outro” — detalhe como será medido."' : '') +
              '>Detalhe / como será medido' + (ev.fontePrevista === 'Outro' ? '' : ' (opcional)') + '</span>' +
              '<textarea class="aposta-campo-input" data-e="comoSeraMedido" rows="2" placeholder="ex.: quantidade de contatos sobre andamento registrados no período">' + esc(ev.comoSeraMedido || '') + '</textarea>' +
            '</label>' +
          '</div>' +
          '<p class="aposta-mudanca-frase">' + esc(fraseEvidenciaCard(m, ev)) + '</p>' +
          '<p class="aposta-campo-rot" style="margin-top:10px">Resultado observado: aguardando execução</p>'
        )
        : (
          /* Recapitulação só leitura do que foi planejado — na fase de
             registro, Fonte prevista/Detalhe não são mais editáveis
             aqui (mudar o plano depois de já ter resultado observado
             confundiria o que foi de fato testado). */
          '<p class="aposta-campo-rot" style="margin:14px 0 0">O QUE FOI PLANEJADO</p>' +
          '<div class="aposta-mudanca-grade" style="margin-top:6px">' +
            '<label class="aposta-campo"><span class="aposta-campo-rot">Fonte planejada</span>' +
              '<input type="text" class="aposta-campo-input" value="' + esc(ev.fontePrevista || '—') + '" disabled /></label>' +
            '<label class="aposta-campo aposta-campo--largo"><span class="aposta-campo-rot">Como seria medido</span>' +
              '<input type="text" class="aposta-campo-input" value="' + esc(ev.comoSeraMedido || '—') + '" disabled /></label>' +
          '</div>' +
          '<p class="aposta-campo-rot" style="margin:14px 0 0">O QUE ACONTECEU</p>' +
          '<div class="aposta-mudanca-grade" style="margin-top:6px">' +
            '<label class="aposta-campo"><span class="aposta-campo-rot" title="O que a realidade respondeu, na mesma unidade da meta.">Resultado observado</span>' +
              '<input type="text" inputmode="decimal" class="aposta-campo-input" data-e="observado" value="' + esc(ev.observado || '') + '"' +
                (naoMedido ? ' disabled' : ' placeholder="' + esc(m.meta || '650') + '"') + ' /></label>' +
            '<label class="aposta-campo"><span class="aposta-campo-rot" title="Vem pré-selecionada com a fonte planejada, mas pode ser trocada pela que foi realmente usada.">Fonte utilizada</span>' +
              '<select class="aposta-campo-input" data-e="fonte"' + (naoMedido ? ' disabled' : '') + '>' +
                '<option value="">Selecione</option>' +
                FONTES_EVIDENCIA.map(function (f) {
                  return '<option value="' + esc(f) + '"' + (ev.fonte === f ? ' selected' : '') + '>' + esc(f) + '</option>';
                }).join('') +
              '</select>' +
            '</label>' +
          '</div>' +
          '<label class="aposta-campo aposta-campo--largo" style="margin-top:10px"><span class="aposta-campo-rot">Detalhe da fonte (opcional)</span>' +
            '<input type="text" class="aposta-campo-input" data-e="fonteDetalhe" value="' + esc(ev.fonteDetalhe || '') + '"' +
              (naoMedido ? ' disabled' : '') + ' placeholder="ex.: ServiceNow, período de 01/09 a 21/09" /></label>' +
          '<label class="aposta-checkbox-linha">' +
            '<input type="checkbox" data-e="naoMedido" value="sim"' + (naoMedido ? ' checked' : '') + ' />' +
            ' Não foi possível medir neste experimento' +
          '</label>' +
          '<label class="aposta-campo aposta-campo--largo"><span class="aposta-campo-rot">Motivo' + (naoMedido ? '' : ' (opcional)') + '</span>' +
            '<input type="text" class="aposta-campo-input" data-e="motivo" value="' + esc(ev.motivo || '') + '" placeholder="ex.: pesquisa não foi concluída dentro do período" /></label>' +
          /* Aprendizado é por card, não um veredito único da etapa —
             várias evidências do mesmo experimento podem apontar em
             direções diferentes, e cada uma guarda o que ensinou por si. */
          '<label class="aposta-campo aposta-campo--largo" style="margin-top:10px">' +
            '<span class="aposta-campo-rot" title="Registre o que esta observação nos ensinou. Evite tratar uma única evidência como prova definitiva da hipótese.">O que aprendemos com esta evidência?</span>' +
            '<textarea class="aposta-campo-input" data-e="aprendizado" rows="2" placeholder="ex.: a redução dos contatos sugere que a maior visibilidade pode estar ajudando, mas precisamos observar numa amostra maior">' + esc(ev.aprendizado || '') + '</textarea>' +
          '</label>' +
          '<p class="aposta-mudanca-frase">' + esc(fraseEvidenciaCard(m, ev)) + '</p>' +
          (progresso
            ? '<p class="' + (progresso.ok ? 'aposta-frase-pronta' : 'aposta-frase-falta') + '">' + esc(progresso.texto) + '</p>'
            : (!naoMedido ? '<p class="aposta-frase-falta">Ainda falta: o resultado observado</p>' : '')) +
          /* Um número sozinho não é aprendizado — quando já existe
             resultado medido, falta mesmo o aprendizado até ele ser
             escrito (não se aplica a "não foi possível medir": ali o
             motivo já é obrigatório e o aprendizado continua opcional). */
          (!naoMedido && normalizar(ev.observado) && !normalizar(ev.aprendizado)
            ? '<p class="aposta-aviso-didatico" data-falta-aprendizado="' + esc(m.id) + '">Ainda falta: o aprendizado com esta evidência</p>'
            : '')
        );

      return '<div class="aposta-mudanca" data-resultado="' + esc(m.id) + '">' +
        '<p class="aposta-campo-rot" style="margin:0 0 2px">RESULTADO ESPERADO ' + (i + 1) + '</p>' +
        '<p style="margin:0 0 12px;color:var(--ink)"><strong>' + esc(m.indicador) + '</strong></p>' +
        '<div class="aposta-mudanca-grade">' +
          '<label class="aposta-campo"><span class="aposta-campo-rot">Situação inicial</span>' +
            '<input type="text" class="aposta-campo-input" value="' + esc((m.atual || '—') + concordarSufixo(m.atual, sufixo)) + '" disabled /></label>' +
          '<label class="aposta-campo"><span class="aposta-campo-rot">Meta</span>' +
            '<input type="text" class="aposta-campo-input" value="' + esc(metaTxt) + '" disabled /></label>' +
        '</div>' +
        miolo +
      '</div>';
    }).join('');

    /* Resumo automático — o que a etapa Decisão vai usar para apoiar a
       conversa, sem concluir sozinha se a hipótese estava certa. O
       título muda com o modo: antes de executar ainda não existem
       "resultados do experimento", só resultados que o grupo pretende
       observar. */
    var resumo = resultados.map(function (m) {
      var ev = evidenciaDe(m.id);
      var sufixo = sufixoUnidade(m);
      var obsTxt = normalizar(ev.observado) ? (ev.observado + concordarSufixo(ev.observado, sufixo)) : (ev.naoMedido === 'sim' ? 'não medido' : '—');
      return '<p><strong>' + esc(m.indicador) + ':</strong><br>' +
        esc((m.atual || '—') + concordarSufixo(m.atual, sufixo)) + ' → ' + esc(obsTxt) + ' · Meta: ' + esc(metaOuLimiteTexto(m, sufixo)) + '</p>';
    }).join('');

    var pronto = (!registrando && status.estado === 'pronta') ? blocoPlanoProntoHtml(true) : '';
    /* A classificação da hipótese só faz sentido depois de já haver
       resultado a interpretar — some no modo planejamento, junto com o
       resto do que só existe depois da execução. Fica FORA de
       .aposta-resultados-resumo de propósito: esse bloco é reconstruído
       por inteiro a cada tecla (atualizarResumoEvidencia), e um <div>
       de botões reconstruído a cada tecla perderia o clique em voo. */
    var classificacaoHtml = registrando ? classificacaoHipoteseHtml(d) : '';
    var pendencias = registrando ? pendenciasEvidenciaHtml(resultados, evidenciaDe, d.classificacao) : '';

    return banner +
      '<div class="aposta-mudancas">' + html + '</div>' +
      '<div class="aposta-resultados-resumo">' +
        '<p class="aposta-campo-rot">' + (registrando ? 'Resultados do experimento' : 'Resultados que vamos observar') + '</p>' +
        resumo +
      '</div>' +
      classificacaoHtml +
      pendencias +
      pronto;
  }

  function ligarEtapa(etapa) {
    var avisosEl = document.getElementById('apostaAvisos');

    function coletar() {
      var d = {};
      if (etapa.lista) {
        d.itens = [];
        _tela.querySelectorAll('.aposta-mudanca').forEach(function (bloco) {
          var m = {};
          bloco.querySelectorAll('[data-m]').forEach(function (el) { m[el.dataset.m] = el.value; });
          /* A primeira mudança já aparece na tela em branco, para ninguém
             precisar descobrir um botão antes de começar a escrever. Um
             bloco em que só as listas (direção e unidade de tempo) têm
             valor não é uma mudança: contá-lo daria a etapa por
             preenchida sem ninguém ter escrito nada. */
          var escreveu = ['indicador', 'atual', 'meta', 'unidade', 'prazo', 'limiteMinimo', 'limiteMaximo'].some(function (k) {
            return normalizar(m[k]);
          });
          if (escreveu) d.itens.push(m);
        });
      } else if (etapa.id === 'evidencia') {
        d.itens = [];
        _tela.querySelectorAll('.aposta-mudanca[data-resultado]').forEach(function (bloco) {
          var ev = { resultadoId: bloco.dataset.resultado };
          bloco.querySelectorAll('[data-e]').forEach(function (el) {
            ev[el.dataset.e] = el.type === 'checkbox' ? (el.checked ? 'sim' : '') : el.value;
          });
          d.itens.push(ev);
        });
        /* A conclusão ("o que esta evidência nos faz concluir?") é um
           campo só, fora dos cards por resultado — mesma leitura
           genérica do resto das etapas, feita à parte porque a
           Evidência já usa d.itens para os cards. */
        _tela.querySelectorAll('[data-campo]').forEach(function (el) { d[el.dataset.campo] = el.value; });
      } else {
        _tela.querySelectorAll('[data-campo]').forEach(function (el) {
          /* Checkbox de múltipla escolha (hoje só "O que vamos medir?"):
             junta os valores marcados numa lista, em vez de sobrescrever
             um pelo outro — é o único campo desta etapa que não é
             "um valor por vez". */
          if (el.type === 'checkbox') {
            if (!Array.isArray(d[el.dataset.campo])) d[el.dataset.campo] = [];
            if (el.checked) d[el.dataset.campo].push(el.value);
          } else {
            d[el.dataset.campo] = el.value;
          }
        });
      }
      if (etapa.escolha) {
        /* Escopado por data-escolha (chave), não só ".is-ativa" — a
           Decisão (Fase 4) tem uma SEGUNDA escolha na mesma tela (o
           ponto de reinício, logo abaixo), e um seletor genérico
           pegaria qualquer uma das duas, a que vier primeiro no DOM. */
        var ativa = _tela.querySelector('.aposta-opcao[data-escolha="' + etapa.escolha.chave + '"].is-ativa');
        if (ativa) d[etapa.escolha.chave] = ativa.dataset.valor;
      }
      /* Ponto de reinício (Fase 4): não é um etapa.escolha declarado no
         molde — as opções mudam conforme a decisão escolhida (ver
         pontoReinicioHtml) — mas usa o mesmo mecanismo de botões. */
      var ativaPonto = _tela.querySelector('.aposta-opcao[data-escolha="pontoDeReinicioEscolhido"].is-ativa');
      if (ativaPonto) d.pontoDeReinicioEscolhido = ativaPonto.dataset.valor;
      /* dataDecisao não tem campo no DOM (não é editável) — sem
         preservá-la aqui, QUALQUER salvamento da Decisão (autosave ao
         digitar, clique numa opção, ou o Continuar final) apagaria a
         data já gravada, porque cada um desses salva o objeto 'decisao'
         inteiro a partir deste coletar(). Só fica de fato definida no
         clique de Continuar (ver mais abaixo); aqui só preserva o que
         já existia — nunca inventa uma data antes da hora. */
      if (etapa.id === 'decisao' && (_dados.decisao || {}).dataDecisao) {
        d.dataDecisao = _dados.decisao.dataDecisao;
      }
      return d;
    }

    /* As três checagens que bloqueiam CONTINUAR de verdade (mudança
       mensurável incoerente, frase estrita incompleta, card de
       evidência incompleto) marcam avisosEl com data-bloqueio ao
       aparecer, no clique. Sem isso, corrigir o campo enquanto o aviso
       já está na tela não tirava ele: "Fica assim no mapa" passava a
       dizer "a frase está completa" e o aviso amarelo continuava
       dizendo o contrário, um ao lado do outro, até o próximo clique —
       o estado contraditório relatado no pedido de ajuste. Chamado a
       cada tecla (salvarDepois), este é o único lugar que também
       APAGA esses avisos — nunca os de "convite a reler" (esses usam
       data-mostrado, de propósito só somem no segundo clique). */
    function limparAvisoBloqueioResolvido() {
      var tipo = avisosEl.dataset.bloqueio;
      if (!tipo) return;
      var d = coletar();
      var aindaBloqueado;
      if (tipo === 'mudancas') {
        aindaBloqueado = indiceMudancaIncoerente(d) !== -1;
      } else if (tipo === 'frase') {
        var faltam = partesFaltantesEtapa(etapa, d);
        var temLegadoValido = etapa.legado && String(d[etapa.legado] || '').trim() && !temLacunaPreenchida(etapa, d);
        aindaBloqueado = faltam.length > 0 && !temLegadoValido;
      } else if (tipo === 'evidencia-plano') {
        aindaBloqueado = (d.itens || []).some(function (ev) { return !planoDeEvidenciaCompleto(ev); });
      } else if (tipo === 'evidencia') {
        aindaBloqueado = (d.itens || []).some(function (ev) { return !evidenciaCardCompleto(ev); });
      } else if (tipo === 'evidencia-classificacao') {
        aindaBloqueado = !normalizar(d.classificacao);
      } else if (tipo === 'decisao-nova-hipotese') {
        aindaBloqueado = decisaoFaltaNovaHipotese(d);
      } else if (tipo === 'decisao-ponto-reinicio') {
        aindaBloqueado = decisaoFaltaPontoDeReinicio(d);
      }
      if (!aindaBloqueado) {
        avisosEl.innerHTML = '';
        delete avisosEl.dataset.bloqueio;
      }
    }

    /* Lê os campos AGORA e guarda o que leu; o temporizador só grava.
       Antes ele chamava coletar() 600ms depois — e 600ms depois a tela já
       podia ter trocado de etapa. O que ele lia eram os campos VAZIOS da
       etapa seguinte, e o que ele gravava era o id da etapa anterior:
       bastava digitar e clicar em Continuar em menos de 600ms para a
       etapa recém-preenchida ser sobrescrita por vazio. No mapa ela
       aparecia como "ainda não preenchido", e voltar nela mostrava o
       campo em branco — o texto tinha sido apagado de verdade. */
    function salvarDepois() {
      var d = coletar();
      agendarSalvamento(etapa.id, d);
      limparAvisoBloqueioResolvido();
      if (etapa.lista) atualizarFrases();
      else if (etapa.id === 'evidencia') atualizarCardsEvidencia();
      else atualizarFrase();
      if (etapa.id === 'decisao') atualizarAlertaPrazo();
      /* Item 6/16: mantém o botão principal realmente desabilitado
         enquanto se digita — a Evidência já cuida disso sozinha dentro
         de atualizarCardsEvidencia (dois rótulos, duas checagens). */
      if (etapa.id !== 'evidencia') {
        var seguirBtn = document.getElementById('apostaSeguir');
        if (seguirBtn) seguirBtn.disabled = seguirDesabilitado(etapa, d);
      }
    }

    /* Mesmo molde que monta o card do Mapa da Aposta: o que a pessoa lê
       aqui enquanto digita é exatamente o que vai sair lá. Duas montagens
       diferentes acabariam divergindo, e aí a prévia mentiria.

       A diferença é o que fazer com o que ainda não foi escrito: no mapa
       vira "—", aqui vira a lacuna com nome, no lugar exato da frase, e
       clicável — é assim que a pessoa vê o que falta sem ter de reler os
       campos um a um. */
    function atualizarFrase() {
      var el = document.getElementById('apostaFrase');
      if (!el) return;
      var d = coletar();
      var usaLegado = etapa.legado && String(d[etapa.legado] || '').trim() && !temLacunaPreenchida(etapa, d);
      var faltam = usaLegado ? [] : partesFaltantesEtapa(etapa, d);
      var estrita = !!ETAPAS_FRASE_ESTRITA[etapa.id];
      /* Item 5 do ajuste de Decisão: com "Reformular a hipótese" e a
         Nova Hipótese ainda incompleta, a frase principal (decisão +
         próxima ação) pode estar completa sozinha — mas a etapa como um
         todo não está, então a prévia não pode mostrar a frase como se
         estivesse pronta (CONTINUAR continua bloqueado; ver
         seguirDesabilitado/decisaoFaltaNovaHipotese). */
      var faltaNovaHipDecisao = etapa.id === 'decisao' && decisaoFaltaNovaHipotese(d);
      var faltaPontoDecisao = etapa.id === 'decisao' && decisaoFaltaPontoDeReinicio(d);

      /* Hipótese, Ideia e Experimento: nada de frase com lacunas por
         dentro enquanto falta algo — só a orientação do que falta.
         Assim que tudo estiver preenchido, cai no mesmo caminho de
         sempre logo abaixo. */
      if (estrita && (faltam.length || faltaNovaHipDecisao || faltaPontoDecisao)) {
        el.hidden = false;
        el.innerHTML = '<span class="aposta-frase-rot">Fica assim no mapa</span>' +
          '<p class="aposta-frase-falta">' + esc(mensagemFraseIncompleta(etapa.id, faltam, d)) + '</p>';
        return;
      }

      var partes = partesDaFrase(etapa, d);
      var html = usaLegado
        ? '<strong class="aposta-frase-valor">' + esc(String(d[etapa.legado]).trim()) + '</strong>'
        : htmlDaFrase(partes);

      /* O que o Experimento vai observar não é uma lacuna da frase — é a
         escolha feita em "O que vamos observar?" — mas ainda precisa
         aparecer na prévia, num bloco à parte: uma lista curta, não
         uma frase longa emendada na do experimento. */
      var resultadosHtml = '';
      if (etapa.id === 'experimento') {
        var sel = resultadosDe(_dados.mudancas, d.resultadoIds);
        if (sel.length) {
          resultadosHtml = '<div class="aposta-resultados-observar">' +
            '<span class="aposta-frase-rot">Resultados que vamos observar</span>' +
            '<ul class="aposta-resultados-observar-lista">' +
              sel.map(function (m) {
                return '<li><strong>' + esc(m.indicador) + '</strong><span>' + esc(resumoCurtoMudanca(m)) + '</span></li>';
              }).join('') +
            '</ul>' +
          '</div>';
        }
      }

      /* A nova hipótese (Decisão) só entra na frase quando a decisão
         escolhida for "Reformular a hipótese" — e só se já tiver algo
         escrito. Mesmo texto que resumoEtapa monta para o mapa/CSV. */
      if (etapa.id === 'decisao' && d.decisao === 'Reformular a hipótese') {
        var nh = novaHipoteseTexto(d);
        if (nh) {
          html += ' <span class="aposta-frase-fixo">Nova hipótese:</span> <strong class="aposta-frase-valor">' + esc(nh) + '</strong>';
        }
      }

      el.hidden = false;
      el.innerHTML = '<span class="aposta-frase-rot">Fica assim no mapa</span>' +
        '<p>' + html + '</p>' +
        resultadosHtml +
        (faltam.length
          ? '<p class="aposta-frase-falta">Ainda falta: ' +
              faltam.map(function (p) { return esc(p.rotulo); }).join(' · ') + '</p>'
          : '<p class="aposta-frase-pronta">A frase desta etapa está completa.</p>');

      /* Clicar na lacuna leva ao campo dela — em celular, a frase fica
         longe do campo que falta, e procurar de novo é o que faz a pessoa
         desistir de completar. */
      el.querySelectorAll('.aposta-frase-vazio').forEach(function (b) {
        b.addEventListener('click', function () {
          var alvo = document.getElementById('ap-' + b.dataset.ir);
          if (!alvo) alvo = _tela.querySelector('.aposta-escolha');
          if (!alvo) return;
          alvo.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (alvo.focus) alvo.focus();
        });
      });
    }

    atualizarFrase();

    /* Decisão: alerta de coerência entre a decisão escolhida e a
       evidência registrada — recalcula a cada clique numa opção (nunca
       a cada tecla nos outros campos, porque a evidência já está
       gravada e fixa nesta etapa). Nunca bloqueia CONTINUAR. */
    function atualizarAlertaDecisao() {
      var el = document.getElementById('apostaDecisaoAlerta');
      if (!el) return;
      var msg = mensagemAlertaDecisao(coletar());
      if (!msg) { el.innerHTML = ''; return; }
      el.innerHTML = '<p class="aposta-aviso-didatico">' + esc(msg) + '</p>' +
        '<div class="aposta-decisao-alerta-botoes">' +
          '<button type="button" class="btn btn--sm" data-decisao-alerta="manter">MANTER AMPLIAR</button>' +
          '<button type="button" class="btn btn--sm" data-decisao-alerta="rever">REVER DECISÃO</button>' +
        '</div>';
      var btnManter = el.querySelector('[data-decisao-alerta="manter"]');
      var btnRever = el.querySelector('[data-decisao-alerta="rever"]');
      if (btnManter) btnManter.addEventListener('click', function () { el.innerHTML = ''; });
      if (btnRever) btnRever.addEventListener('click', function () {
        _tela.querySelectorAll('.aposta-opcao').forEach(function (o) { o.classList.remove('is-ativa'); });
        salvarEtapa(etapa.id, coletar());
        atualizarFrase();
        atualizarGruposPorEscolha(etapa.escolha.chave, '');
        atualizarEscolhaEBotao();
        el.innerHTML = '';
        var escolhaEl = _tela.querySelector('.aposta-opcao');
        if (escolhaEl) escolhaEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
    if (etapa.id === 'decisao') atualizarAlertaDecisao();

    /* Prazo (duração) e Data de reavaliação são dois jeitos de dizer
       "quando" — quando só o Prazo está preenchido, sugere a data (um
       clique aceita); quando os dois estão preenchidos e não combinam,
       avisa sem trocar nada sozinho: quem decide escolhe qual manter. */
    function atualizarAlertaPrazo() {
      var el = document.getElementById('apostaPrazoAlerta');
      if (!el) return;
      var prazoEl = document.getElementById('ap-prazo');
      var unidadeEl = _tela.querySelector('[data-campo="prazoUnidade"]');
      var reavEl = document.getElementById('ap-reavaliacao');
      var sugestao = dataSugeridaPeloPrazo(prazoEl ? prazoEl.value : '', unidadeEl ? unidadeEl.value : '');
      var reavAtual = reavEl ? reavEl.value.trim() : '';
      if (!sugestao || reavAtual === sugestao) { el.innerHTML = ''; return; }
      function usarSugestao() {
        if (!reavEl) return;
        reavEl.value = sugestao;
        reavEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (!reavAtual) {
        el.innerHTML = '<p class="aposta-aviso-didatico">Com base no prazo informado, a reavaliação cairia perto de ' +
          esc(sugestao) + '. Quer usar esta data?</p>' +
          '<div class="aposta-decisao-alerta-botoes"><button type="button" class="btn btn--sm" data-prazo-usar>Usar ' + esc(sugestao) + '</button></div>';
      } else {
        el.innerHTML = '<p class="aposta-aviso-didatico">A data de reavaliação (' + esc(reavAtual) +
          ') não bate com o prazo informado — pelo prazo, cairia perto de ' + esc(sugestao) +
          '. Qual informação você deseja manter?</p>' +
          '<div class="aposta-decisao-alerta-botoes">' +
            '<button type="button" class="btn btn--sm" data-prazo-usar>Usar ' + esc(sugestao) + '</button>' +
            '<button type="button" class="btn btn--sm" data-prazo-manter>Manter ' + esc(reavAtual) + '</button>' +
          '</div>';
        var btnManter = el.querySelector('[data-prazo-manter]');
        if (btnManter) btnManter.addEventListener('click', function () { el.innerHTML = ''; });
      }
      var btnUsar = el.querySelector('[data-prazo-usar]');
      if (btnUsar) btnUsar.addEventListener('click', usarSugestao);
    }
    if (etapa.id === 'decisao') atualizarAlertaPrazo();

    /* Atualiza o alerta de consistência de um bloco SEM recriar o nó — só
       o texto e os botões mudam. Substituir o elemento inteiro a cada
       tecla (outerHTML) tem uma corrida real: o clique em "Usar…" solta
       o foco do campo Meta, e esse blur dispara o mesmo recálculo —
       trocar o nó bem nesse instante faz o clique ainda em voo (já
       resolvido pelo Playwright num nó antigo) cair no vazio. Um nó
       estável não tem essa corrida — inclusive quando o número de botões
       muda (Manter chega a sugerir duas direções, não uma só). */
    function atualizarAlertaMudanca(bloco, m) {
      var problema = alertaInfoMudanca(m);
      var el = bloco.querySelector('.aposta-mudanca-alerta');
      if (!problema) {
        if (el && el.parentNode) el.parentNode.removeChild(el);
        return;
      }
      if (!el) {
        el = document.createElement('p');
        el.className = 'aposta-aviso-didatico aposta-mudanca-alerta';
        el.appendChild(document.createTextNode(''));
        var frase = bloco.querySelector('.aposta-mudanca-frase');
        if (frase) frase.insertAdjacentElement('beforebegin', el);
        else bloco.querySelector('.aposta-mudanca-grade').insertAdjacentElement('afterend', el);
      }
      var opcoes = problema.opcoes || [];
      el.firstChild.nodeValue = problema.mensagem + (opcoes.length ? ' ' : '');
      /* Os botões só são reconstruídos quando o CONJUNTO de opções muda
         (não a cada tecla à toa) — e nunca no meio de um clique num
         deles: esse clique já muda a direção e recalcula tudo de novo,
         removendo `el` inteiro se a mudança ficou coerente antes de
         qualquer botão precisar existir de novo. */
      var atuais = Array.prototype.map.call(el.querySelectorAll('button'), function (b) { return b.dataset.corrigir; });
      var mudou = atuais.length !== opcoes.length || atuais.some(function (v, i) { return v !== opcoes[i]; });
      if (mudou) {
        el.querySelectorAll('button').forEach(function (b) { b.remove(); });
        opcoes.forEach(function (opcao) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'btn btn--sm';
          btn.dataset.corrigir = opcao;
          btn.textContent = 'Usar "' + opcao + '"';
          btn.addEventListener('click', function () {
            var direcaoInput = bloco.querySelector('[data-m="direcao"]');
            if (!direcaoInput) return;
            direcaoInput.value = btn.dataset.corrigir;
            direcaoInput.dispatchEvent(new Event('input', { bubbles: true }));
          });
          el.appendChild(btn);
        });
      }
    }

    /* Atualiza a frase e o alerta de consistência de cada bloco — os dois
       dependem dos mesmos campos e mudam juntos a cada tecla.

       Enquanto a mudança está coerente, a frase reage na hora, a cada
       tecla — inclusive voltando a aparecer assim que uma inconsistência
       é corrigida, sem demora nenhuma. Quando fica incoerente, a frase
       continua mostrando o que já foi digitado (não trava a
       experimentação de quem ainda está no meio de escrever um número),
       mas só troca pela mensagem "corrija a inconsistência" depois de
       uma pausa curta sem digitar — reagir a cada tecla enquanto "1100"
       ainda é só "1" faria a mensagem piscar sem motivo. */
    var _timersCoerencia = {};
    function lerCampos(bloco) {
      var m = {};
      bloco.querySelectorAll('[data-m]').forEach(function (el) { m[el.dataset.m] = el.value; });
      return m;
    }
    /* Mantém o campo Período em sincronia com Forma de medição/Unidade a
       cada tecla: trava em "não se aplica" assim que a combinação vira
       Índice+NPS, e destrava se deixar de ser — sem substituir o nó (só
       muda value/disabled), para não perder foco no meio da digitação. */
    function atualizarPeriodoNPS(bloco, m) {
      var wrap = bloco.querySelector('[data-campo-periodo]');
      var inputPeriodo = wrap && wrap.querySelector('[data-m="periodo"]');
      if (!inputPeriodo) return;
      var travar = ehIndiceNPS(m);
      if (travar) {
        inputPeriodo.value = 'não se aplica';
        m.periodo = 'não se aplica';
        wrap.querySelectorAll('.aposta-variante-chip').forEach(function (c) {
          c.classList.toggle('is-ativa', c.dataset.valor === 'não se aplica');
        });
      }
      inputPeriodo.disabled = travar;
      wrap.querySelectorAll('.aposta-variante-chip').forEach(function (c) { c.disabled = travar; });
    }
    function atualizarFrases() {
      _tela.querySelectorAll('.aposta-mudanca').forEach(function (bloco) {
        var m = lerCampos(bloco);
        atualizarPeriodoNPS(bloco, m);
        var idx = bloco.dataset.i;
        atualizarAlertaMudanca(bloco, m);
        var p = bloco.querySelector('.aposta-mudanca-frase');
        if (p) { p.classList.remove('aposta-frase-falta'); p.innerHTML = htmlDaFrase(partesMudanca(m)); }
        if (mudancaCoerente(m)) {
          clearTimeout(_timersCoerencia[idx]);
          delete _timersCoerencia[idx];
          return;
        }
        clearTimeout(_timersCoerencia[idx]);
        _timersCoerencia[idx] = setTimeout(function () {
          delete _timersCoerencia[idx];
          if (!bloco.isConnected) return;
          var mDepois = lerCampos(bloco);
          if (mudancaCoerente(mDepois)) return;
          var pDepois = bloco.querySelector('.aposta-mudanca-frase');
          if (pDepois) {
            pDepois.classList.add('aposta-frase-falta');
            pDepois.textContent = 'Corrija a inconsistência acima para visualizar a mudança mensurável.';
          }
        }, 500);
      });
    }

    /* O mesmo, para os cards de Evidência: a frase "Esperávamos… Após o
       experimento, observamos…", o "% do caminho até a meta" e o
       resumo automático mudam juntos a cada tecla. "Não foi possível
       medir" desliga os campos que ele torna irrelevantes, na hora. */
    function evidenciaColetada(bloco) {
      var ev = { resultadoId: bloco.dataset.resultado };
      bloco.querySelectorAll('[data-e]').forEach(function (el) {
        ev[el.dataset.e] = el.type === 'checkbox' ? (el.checked ? 'sim' : '') : el.value;
      });
      return ev;
    }
    /* Rótulo do botão principal e o bloco "PLANO DE EVIDÊNCIA PRONTO"
       reagem à digitação (ex.: escolher a última Fonte prevista que
       faltava) sem esperar por um novo render completo da etapa — só
       fazem sentido enquanto a etapa ainda está em planejamento; uma vez
       no modo de registro, o próprio DOM (a existência do campo
       "Resultado observado") já denuncia isso, e o rótulo do botão para
       de mudar sozinho. */
    /* Item 1 do ajuste de usabilidade: "Encerrar por agora" precisa dar
       feedback visível antes de sumir da tela — sem isso, a pessoa não
       tinha como saber se o planejamento realmente ficou salvo. */
    function encerrarPlanejamento() {
      /* avisarPosSaida (não avisar) porque este aviso precisa sobreviver
         ao fecharDinamica() logo abaixo e aparecer já na tela de
         Treinamento, para onde a pessoa está voltando — não há mais
         necessidade do atraso de 1,8s que só existia para dar tempo de
         ler antes de _tela sumir. */
      avisarPosSaida('✓ Planejamento salvo. O experimento está pronto para execução. Você poderá registrar os resultados quando retornar.');
      fecharDinamica();
    }
    function atualizarStatusEvidencia() {
      var registrandoAgora = !!_tela.querySelector('.aposta-mudanca[data-resultado] [data-e="observado"]');
      var seguirBtn = document.getElementById('apostaSeguir');
      if (!registrandoAgora) {
        var se = statusEvidencia({ mudancas: _dados.mudancas, experimento: _dados.experimento, evidencia: coletar() });
        if (seguirBtn) {
          seguirBtn.textContent = se.estado === 'pronta' ? 'Registrar resultados do experimento' : 'Salvar plano para execução';
          seguirBtn.disabled = se.estado !== 'pronta';
        }
        var prontoEl = _tela.querySelector('[data-plano-pronto]');
        if (se.estado === 'pronta' && !prontoEl) {
          var resumoWrap = _tela.querySelector('.aposta-resultados-resumo');
          if (resumoWrap) {
            resumoWrap.insertAdjacentHTML('afterend', blocoPlanoProntoHtml(false));
            avisar('✓ Plano de evidência salvo.');
            var novoSairBtn = document.getElementById('apostaSairEvidencia');
            if (novoSairBtn) novoSairBtn.addEventListener('click', encerrarPlanejamento);
          }
        } else if (se.estado !== 'pronta' && prontoEl) {
          prontoEl.parentNode.removeChild(prontoEl);
        }
        return;
      }
      /* Modo de registro: item 8 do ajuste de usabilidade — a mensagem de
         pendências (ou "✓ Evidências completas.") e a habilitação de
         "Continuar para Decisão" reagem em tempo real, a cada tecla. */
      var resultados = resultadosDe(_dados.mudancas, (_dados.experimento || {}).resultadoIds);
      var itensAoVivo = Array.prototype.map.call(_tela.querySelectorAll('.aposta-mudanca[data-resultado]'), evidenciaColetada);
      function evidenciaDeAoVivo(id) { return itensAoVivo.filter(function (e) { return e.resultadoId === id; })[0] || {}; }
      var classificacaoAoVivo = (_tela.querySelector('#apostaClassificacaoHipotese [data-campo]') || {}).value || '';
      var pendenciasEl = _tela.querySelector('[data-evidencia-pendencias]');
      if (pendenciasEl) pendenciasEl.outerHTML = pendenciasEvidenciaHtml(resultados, evidenciaDeAoVivo, classificacaoAoVivo);
      if (seguirBtn) seguirBtn.disabled = pendenciasEvidencia(resultados, evidenciaDeAoVivo, classificacaoAoVivo).length > 0;
    }
    function atualizarCardsEvidencia() {
      atualizarStatusEvidencia();
      _tela.querySelectorAll('.aposta-mudanca[data-resultado]').forEach(function (bloco) {
        var m = resultadosDe(_dados.mudancas, [bloco.dataset.resultado])[0];
        if (!m) return;
        var ev = evidenciaColetada(bloco);
        var naoMedido = ev.naoMedido === 'sim';
        var frase = bloco.querySelector('.aposta-mudanca-frase');
        if (frase) frase.textContent = fraseEvidenciaCard(m, ev);
        /* O modo (planejamento x registro) só muda ao clicar no botão
           principal da etapa, que recarrega a tela inteira — nunca ao
           digitar. Por isso, aqui basta checar se este card já está no
           modo de registro (tem o campo Resultado observado) para saber
           se há mais alguma coisa a sincronizar ao vivo. */
        if (!bloco.querySelector('[data-e="observado"]')) return;
        bloco.querySelectorAll('[data-e="observado"], [data-e="fonte"], [data-e="fonteDetalhe"]').forEach(function (el) {
          el.disabled = naoMedido;
        });
        var motivoInput = bloco.querySelector('[data-e="motivo"]');
        var motivoRot = motivoInput && motivoInput.closest('.aposta-campo').querySelector('.aposta-campo-rot');
        if (motivoRot) motivoRot.textContent = 'Motivo' + (naoMedido ? '' : ' (opcional)');
        var progressoEl = bloco.querySelector('.aposta-frase-pronta, .aposta-frase-falta');
        var progresso = !naoMedido ? progressoResumo(m, ev.observado) : null;
        if (progresso) {
          var classeCerta = progresso.ok ? 'aposta-frase-pronta' : 'aposta-frase-falta';
          if (progressoEl) { progressoEl.className = classeCerta; progressoEl.textContent = progresso.texto; }
          else if (frase) frase.insertAdjacentHTML('afterend', '<p class="' + classeCerta + '">' + esc(progresso.texto) + '</p>');
        } else if (!naoMedido) {
          /* Sem resultado observado ainda, sem "não foi possível medir"
             marcado: nunca finge que já existe evidência. */
          if (progressoEl) { progressoEl.className = 'aposta-frase-falta'; progressoEl.textContent = 'Ainda falta: o resultado observado'; }
          else if (frase) frase.insertAdjacentHTML('afterend', '<p class="aposta-frase-falta">Ainda falta: o resultado observado</p>');
        } else if (progressoEl) {
          progressoEl.parentNode.removeChild(progressoEl);
        }
        var notaAprendizado = bloco.querySelector('[data-falta-aprendizado]');
        var faltaAprendizado = !naoMedido && normalizar(ev.observado) && !normalizar(ev.aprendizado);
        if (faltaAprendizado && !notaAprendizado) {
          bloco.insertAdjacentHTML('beforeend', '<p class="aposta-aviso-didatico" data-falta-aprendizado="' + esc(m.id) + '">Ainda falta: o aprendizado com esta evidência</p>');
        } else if (!faltaAprendizado && notaAprendizado) {
          notaAprendizado.parentNode.removeChild(notaAprendizado);
        }
      });
      atualizarResumoEvidencia();
    }
    function atualizarResumoEvidencia() {
      var wrap = _tela.querySelector('.aposta-resultados-resumo');
      if (!wrap) return;
      var resultados = resultadosDe(_dados.mudancas, (_dados.experimento || {}).resultadoIds);
      var itens = Array.prototype.map.call(_tela.querySelectorAll('.aposta-mudanca[data-resultado]'), evidenciaColetada);
      function evidenciaDe(id) { return itens.filter(function (e) { return e.resultadoId === id; })[0] || {}; }
      var resumo = resultados.map(function (m) {
        var ev = evidenciaDe(m.id);
        var sufixo = sufixoUnidade(m);
        var obsTxt = normalizar(ev.observado) ? (ev.observado + concordarSufixo(ev.observado, sufixo)) : (ev.naoMedido === 'sim' ? 'não medido' : '—');
        return '<p><strong>' + esc(m.indicador) + ':</strong><br>' +
          esc((m.atual || '—') + concordarSufixo(m.atual, sufixo)) + ' → ' + esc(obsTxt) + ' · Meta: ' + esc(metaOuLimiteTexto(m, sufixo)) + '</p>';
      }).join('');
      var registrandoAgora = !!_tela.querySelector('.aposta-mudanca[data-resultado] [data-e="observado"]');
      wrap.innerHTML = '<p class="aposta-campo-rot">' + (registrandoAgora ? 'Resultados do experimento' : 'Resultados que vamos observar') + '</p>' + resumo;
    }

    function ligarCampoInput(el) {
      el.addEventListener('input', function () { aplicarMascara(el); salvarDepois(); });
      el.addEventListener('change', function () { aplicarMascara(el); salvarDepois(); });
    }
    _tela.querySelectorAll('.aposta-campo-input').forEach(ligarCampoInput);
    /* Os checkboxes ("O que vamos medir?", "Não foi possível medir")
       não levam a classe aposta-campo-input — essa classe é a caixa de
       texto/select cheia, e um checkbox com ela virava um retângulo
       gigante em vez do quadradinho de sempre. */
    _tela.querySelectorAll('.aposta-resultado-item input[type="checkbox"], .aposta-checkbox-linha input[type="checkbox"]').forEach(ligarCampoInput);

    /* "Nossa hipótese foi:" — fora do padrão genérico de escolha
       (etapa.escolha/escolhaHtml), porque a Evidência não passa por
       moldeHtml (ver evidenciaHtml). O valor vive num input escondido
       (data-campo="classificacao"), lido por coletar() como qualquer
       outro campo — só o clique nos botões que é próprio daqui. */
    _tela.querySelectorAll('#apostaClassificacaoHipotese [data-classificacao-valor]').forEach(function (b) {
      b.addEventListener('click', function () {
        _tela.querySelectorAll('#apostaClassificacaoHipotese .aposta-opcao').forEach(function (o) { o.classList.remove('is-ativa'); });
        b.classList.add('is-ativa');
        var hidden = _tela.querySelector('#apostaClassificacaoHipotese [data-campo="classificacao"]');
        if (hidden) hidden.value = b.dataset.classificacaoValor;
        salvarDepois();
      });
    });

    /* O card do "O que vamos medir?" destaca visualmente o que está
       marcado — o mesmo card mostra o checkbox e o resumo do
       resultado, então o realce precisa acompanhar o clique. */
    _tela.querySelectorAll('.aposta-resultado-item').forEach(function (item) {
      var caixa = item.querySelector('input[type="checkbox"]');
      if (!caixa) return;
      caixa.addEventListener('change', function () { item.classList.toggle('is-marcado', caixa.checked); });
    });

    /* Os chips são atalho para o campo ao lado, não um controle à parte:
       clicar preenche o texto de sempre (e dispara o mesmo salvamento de
       digitar), e o destaque acompanha o que está no campo — inclusive
       quando a pessoa digita por cima e nenhum chip bate mais. */
    function ligarVariante(wrap) {
      var input = wrap && wrap.querySelector('.aposta-variante-input');
      if (!input) return;
      function sincronizarChips() {
        wrap.querySelectorAll('.aposta-variante-chip').forEach(function (c) {
          c.classList.toggle('is-ativa', c.dataset.valor === input.value);
        });
      }
      input.addEventListener('input', sincronizarChips);
      wrap.querySelectorAll('.aposta-variante-chip').forEach(function (b) {
        b.addEventListener('click', function () {
          input.value = b.dataset.valor;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.focus();
        });
      });
    }
    _tela.querySelectorAll('.aposta-variante').forEach(ligarVariante);

    /* A Unidade sugere opções diferentes conforme a Forma de medição —
       só o pedaço da Unidade é reconstruído (chips + campo), o resto do
       card fica como está. Escolher Percentual ou Moeda É a resposta
       ("%" e "R$" não têm outro sentido possível ali) — por isso os
       dois substituem o que estiver na Unidade, diferente das demais
       formas, que só SUGEREM e nunca apagam o que já foi digitado. */
    function reconstruirUnidade(bloco) {
      var selForma = bloco.querySelector('[data-m="formaMedicao"]');
      var wrapUnidade = bloco.querySelector('[data-campo-unidade]');
      if (!selForma || !wrapUnidade) return;
      var formaMedicao = selForma.value;
      var inputAtual = wrapUnidade.querySelector('.aposta-variante-input');
      var valor = inputAtual ? inputAtual.value.trim() : '';
      var auto = UNIDADE_AUTOMATICA[formaMedicao];
      if (auto) valor = auto;
      var chips = UNIDADES_SUGERIDAS[formaMedicao] || [];
      wrapUnidade.innerHTML = '<span class="aposta-campo-rot">Unidade</span>' +
        variantePicker('data-m', 'unidade', chips, valor, 'Unidade', null, 'aposta-variante--campo', true);
      ligarVariante(wrapUnidade.querySelector('.aposta-variante'));
      var novoInput = wrapUnidade.querySelector('.aposta-campo-input');
      if (novoInput) ligarCampoInput(novoInput);
      salvarDepois();
    }
    _tela.querySelectorAll('[data-m="formaMedicao"]').forEach(function (sel) {
      sel.addEventListener('change', function () { reconstruirUnidade(sel.closest('.aposta-mudanca')); });
    });

    /* "Manter" pede Tipo de limite e, conforme ele, Meta OU os dois
       Limites — as outras três direções só pedem Meta desejada. Só o
       [data-meta-area] é reconstruído; Direção, Indicador e Situação
       atual ficam como estão, sem perder foco nem valor. */
    function reconstruirCamposMeta(bloco) {
      var area = bloco.querySelector('[data-meta-area]');
      var direcaoInput = bloco.querySelector('[data-m="direcao"]');
      if (!area || !direcaoInput) return;
      var m = {
        direcao: direcaoInput.value,
        tipoLimite: (bloco.querySelector('[data-m="tipoLimite"]') || {}).value || '',
        meta: (bloco.querySelector('[data-m="meta"]') || {}).value || '',
        limiteMinimo: (bloco.querySelector('[data-m="limiteMinimo"]') || {}).value || '',
        limiteMaximo: (bloco.querySelector('[data-m="limiteMaximo"]') || {}).value || ''
      };
      area.innerHTML = camposMetaHtml(m);
      area.querySelectorAll('.aposta-campo-input').forEach(ligarCampoInput);
      area.querySelectorAll('.aposta-variante').forEach(ligarVariante);
      var tipoLimiteInput = area.querySelector('[data-m="tipoLimite"]');
      if (tipoLimiteInput) tipoLimiteInput.addEventListener('input', function () { reconstruirCamposMeta(bloco); });
      salvarDepois();
    }
    _tela.querySelectorAll('[data-m="direcao"]').forEach(function (input) {
      input.addEventListener('input', function () { reconstruirCamposMeta(input.closest('.aposta-mudanca')); });
    });
    _tela.querySelectorAll('[data-m="tipoLimite"]').forEach(function (input) {
      input.addEventListener('input', function () { reconstruirCamposMeta(input.closest('.aposta-mudanca')); });
    });

    /* O botão do alerta de consistência troca a direção com um clique só
       — o alerta é recriado a cada tecla (ver atualizarFrases), então o
       clique é ouvido por delegação num ancestral estável, não no botão
       em si. */
    var mudancasWrap = _tela.querySelector('.aposta-mudancas');
    if (mudancasWrap) {
      mudancasWrap.addEventListener('click', function (e) {
        var btnCorrigir = e.target.closest('[data-corrigir]');
        if (btnCorrigir) {
          var blocoCorrigir = btnCorrigir.closest('.aposta-mudanca');
          var direcaoInput = blocoCorrigir && blocoCorrigir.querySelector('[data-m="direcao"]');
          if (!direcaoInput) return;
          direcaoInput.value = btnCorrigir.dataset.corrigir;
          direcaoInput.dispatchEvent(new Event('input', { bubbles: true }));
          return;
        }
      });
    }

    /* "Encerrar por agora" só existe no bloco "plano pronto" recém-
       completo (ver atualizarStatusEvidencia) — ao retomar uma aposta já
       salva, o bloco mostra só o status, sem repetir uma ação que a
       pessoa já usou (itens 2/3 do ajuste de usabilidade). */

    /* Troca de decisão muda quais blocos de grupo (hoje: a Nova
       Hipótese) ficam visíveis, recolhidos ou abertos — sem recarregar
       a tela inteira. Mesmo padrão de nó estável já usado em
       atualizarAlertaMudanca: mexe só no que mudou (hidden/open,
       texto do <summary>, a dica), nunca substitui o <details>. */
    function atualizarGruposPorEscolha(chave, valor) {
      (etapa.grupos || []).forEach(function (g) {
        if (g.dependeDaEscolha !== chave || !g.id) return;
        var el = document.getElementById(g.id);
        if (!el) return;
        var escondido = !valor || (g.escondeQuando && g.escondeQuando.indexOf(valor) !== -1);
        var abreAuto = !!(g.abreAutoQuando && g.abreAutoQuando.indexOf(valor) !== -1);
        el.hidden = escondido;
        el.open = abreAuto;
        var sum = el.querySelector('summary');
        if (sum) sum.textContent = abreAuto ? g.rotulo : (g.resumoQuando || g.rotulo);
        var dicaEl = el.querySelector('.aposta-grupo-dica');
        if (abreAuto && g.dicaObrigatoria) {
          if (!dicaEl) {
            dicaEl = document.createElement('p');
            dicaEl.className = 'aposta-grupo-dica';
            el.insertBefore(dicaEl, el.querySelector('.aposta-molde'));
          }
          dicaEl.textContent = g.dicaObrigatoria;
        } else if (dicaEl) {
          dicaEl.parentNode.removeChild(dicaEl);
        }
      });
    }

    /* Item 3/6 do ajuste de Decisão: a microexplicação embaixo dos
       botões (escolha.explicacoes) e o estado do botão principal
       precisam acompanhar a escolha AO VIVO, sem esperar um clique em
       CONTINUAR nem recarregar — o mesmo princípio de "estado visual e
       funcional sempre iguais" já aplicado à Evidência. Reaproveitado
       tanto pelo clique numa opção quanto por REVER DECISÃO (que limpa
       a escolha). */
    function atualizarEscolhaEBotao() {
      var d = coletar();
      var esc_ = etapa.escolha;
      if (esc_) {
        var explicacaoEl = _tela.querySelector('[data-escolha-explicacao]');
        var texto = esc_.explicacoes && d[esc_.chave] ? esc_.explicacoes[d[esc_.chave]] : '';
        if (texto && explicacaoEl) {
          explicacaoEl.textContent = texto;
        } else if (texto && !explicacaoEl) {
          var opcoesWrap = _tela.querySelector('.aposta-escolha-opcoes');
          if (opcoesWrap) opcoesWrap.insertAdjacentHTML('afterend', '<p class="aposta-grupo-dica" data-escolha-explicacao="' + esc(esc_.chave) + '">' + esc(texto) + '</p>');
        } else if (!texto && explicacaoEl) {
          explicacaoEl.parentNode.removeChild(explicacaoEl);
        }
      }
      var seguirBtn = document.getElementById('apostaSeguir');
      if (seguirBtn) seguirBtn.disabled = seguirDesabilitado(etapa, d);
      return d;
    }

    /* Fase 4: a Decisão pode ter DUAS escolhas na mesma tela (a decisão
       em si e, condicionalmente, o ponto de reinício) — "limpar
       is-ativa" tem de ficar restrito ao MESMO grupo (mesmo
       data-escolha) do botão clicado, senão clicar numa apagaria a
       seleção da outra. */
    function ligarBotaoOpcao(b) {
      b.addEventListener('click', function () {
        _tela.querySelectorAll('.aposta-opcao[data-escolha="' + b.dataset.escolha + '"]').forEach(function (o) { o.classList.remove('is-ativa'); });
        b.classList.add('is-ativa');
        salvarEtapa(etapa.id, coletar());
        atualizarFrase();
        atualizarGruposPorEscolha(b.dataset.escolha, b.dataset.valor);
        atualizarEscolhaEBotao();
        if (etapa.id === 'decisao') {
          atualizarAlertaDecisao();
          var proximaAcaoInput = document.getElementById('ap-proximaAcao');
          if (proximaAcaoInput && PLACEHOLDER_PROXIMA_ACAO[b.dataset.valor]) {
            proximaAcaoInput.placeholder = PLACEHOLDER_PROXIMA_ACAO[b.dataset.valor];
          }
          /* Trocar a decisão principal invalida uma escolha de ponto de
             reinício de uma decisão anterior — as opções mudam (ou o
             bloco nem existe mais para a decisão nova); redesenha o
             bloco do zero a cada troca da decisão principal, nunca
             deixa uma opção de outra decisão marcada como ativa. */
          if (etapa.escolha && b.dataset.escolha === etapa.escolha.chave) atualizarPontoReinicioBloco();
        }
      });
    }
    _tela.querySelectorAll('.aposta-opcao').forEach(ligarBotaoOpcao);

    function atualizarPontoReinicioBloco() {
      var host = document.getElementById('apostaGrupoPontoReinicio');
      var d = coletar();
      d.pontoDeReinicioEscolhido = '';
      var novoHtml = pontoReinicioHtml(d);
      if (host) {
        if (novoHtml) host.outerHTML = novoHtml;
        else host.parentNode.removeChild(host);
      } else if (novoHtml) {
        var escolhaWrap = _tela.querySelector('.aposta-escolha');
        if (escolhaWrap) escolhaWrap.insertAdjacentHTML('afterend', novoHtml);
      }
      var novoHost = document.getElementById('apostaGrupoPontoReinicio');
      if (novoHost) novoHost.querySelectorAll('.aposta-opcao').forEach(ligarBotaoOpcao);
      salvarEtapa(etapa.id, coletar());
      atualizarEscolhaEBotao();
    }

    var add = document.getElementById('apostaAddMudanca');
    if (add) {
      add.addEventListener('click', function () {
        /* Só desenha o bloco novo: gravar um item vazio daria a etapa por
           preenchida sem ninguém ter escrito nada. O que estava digitado
           vai junto, porque vem de coletar(). */
        var d = coletar();
        d.itens.push({ direcao: 'Reduzir' });
        _dados[etapa.id] = d;
        render();
      });
    }
    /* Remover age sobre o BLOCO da tela, não sobre o índice do que foi
       gravado: com um bloco em branco no meio, os dois deixam de
       corresponder e o clique apagaria a mudança errada. */
    _tela.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        var blocos = Array.prototype.slice.call(_tela.querySelectorAll('.aposta-mudanca'));
        var alvo = blocos[Number(b.dataset.del)];
        if (alvo && alvo.parentNode) alvo.parentNode.removeChild(alvo);
        var d = coletar();
        _dados[etapa.id] = d;
        salvarEtapa(etapa.id, d, true);
      });
    });

    /* As três navegações abaixo (Voltar, Continuar, clicar na trilha) só
       trocam de tela DEPOIS de confirmar que a gravação chegou ao banco.
       Antes, salvarEtapa() disparava a escrita e a navegação seguia na
       hora, sem esperar — no wi-fi da sala a resposta chega rápido, mas
       no 4G da oficina real ela demora segundos, e o grupo já tinha
       clicado e trocado de etapa muito antes disso. Se a escrita falhava
       (ou só demorava), o aviso de erro aparecia depois, na tela ERRADA
       (a etapa nova, não a que falhou) ou nem chegava a ser visto — e o
       grupo seguia em frente confiando num dado que nunca foi salvo.
       Esperar trava a tela por um instante, mas é a diferença entre um
       erro visível, na hora, na etapa certa, e um dado que só se
       descobre perdido dias depois. */
    function comEscritaConfirmada(botao, ir) {
      if (botao) botao.disabled = true;
      salvarEtapa(etapa.id, coletar(), false, function (err) {
        if (err) {
          if (botao) botao.disabled = false;
          avisar('Não consegui salvar "' + etapa.curto + '" — verifique a conexão e tente de novo. ' +
            'Nada foi perdido: o que está na tela continua aqui.', true);
          return;
        }
        ir();
      });
    }

    var voltar = document.getElementById('apostaVoltar');
    if (voltar) voltar.addEventListener('click', function () {
      comEscritaConfirmada(voltar, function () {
        _etapaAtual = ETAPAS[Math.max(0, indiceEtapa(etapa.id) - 1)].id;
        render();
      });
    });

    document.getElementById('apostaSeguir').addEventListener('click', function () {
      var seguirBtn = this;
      var d = coletar();

      /* Só em Mudanças mensuráveis: "Reduzir" com meta ≥ situação atual
         (ou "Aumentar" com meta ≤ situação atual) não é uma mudança
         coerente — a direção contradiz os próprios números, e o card já
         mostra o porquê (alertaConsistenciaMudanca, com o botão de
         corrigir num clique). Diferente das avisos didáticas logo
         abaixo, isso BLOQUEIA de verdade, sem escape por segundo
         clique — só destaca exatamente o card errado, não redigita nada
         sozinho. */
      if (etapa.id === 'mudancas') {
        var idxIncoerente = indiceMudancaIncoerente(d);
        if (idxIncoerente !== -1) {
          avisosEl.dataset.bloqueio = 'mudancas';
          avisosEl.innerHTML = '<p class="aposta-aviso-didatico">Corrija a mudança mensurável destacada acima antes de continuar.</p>';
          var blocoIncoerente = _tela.querySelector('.aposta-mudanca[data-i="' + idxIncoerente + '"]');
          (blocoIncoerente || avisosEl).scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
      }

      /* Hipótese, Ideia de solução e Experimento: sem os campos
         obrigatórios (e, no Experimento, sem nenhum resultado
         escolhido), CONTINUAR fica bloqueado de verdade, sem escape por
         segundo clique — a prévia já mostra a mesma orientação do que
         falta, em vez da frase. */
      if (ETAPAS_FRASE_ESTRITA[etapa.id]) {
        var faltamContinuar = partesFaltantesEtapa(etapa, d);
        var temLegadoValido = etapa.legado && String(d[etapa.legado] || '').trim() && !temLacunaPreenchida(etapa, d);
        if (faltamContinuar.length && !temLegadoValido) {
          avisosEl.dataset.bloqueio = 'frase';
          avisosEl.innerHTML = '<p class="aposta-aviso-didatico">' + esc(mensagemFraseIncompleta(etapa.id, faltamContinuar, d)) + '</p>';
          var apostaFraseEl = document.getElementById('apostaFrase');
          (apostaFraseEl || avisosEl).scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        /* Decisão "Reformular a hipótese": a Nova Hipótese abre sozinha e
           é obrigatória nesse caso (item 14 do ajuste de usabilidade) —
           as outras quatro decisões continuam com ela opcional. */
        if (etapa.id === 'decisao' && decisaoFaltaNovaHipotese(d)) {
          avisosEl.dataset.bloqueio = 'decisao-nova-hipotese';
          avisosEl.innerHTML = '<p class="aposta-aviso-didatico">A decisão "Reformular a hipótese" pede a Nova Hipótese completa: preencha a causa provável e o indício que a motivou.</p>';
          var grupoNovaHip = document.getElementById('apostaGrupoNovaHipotese');
          (grupoNovaHip || avisosEl).scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        /* Fase 4 — "Ajustar e testar novamente" e "Investigar mais"
           pedem à dupla para escolher onde o próximo ciclo recomeça
           (itens 20/21 do pedido); sem essa escolha, CONTINUAR fica
           bloqueado de verdade, mesmo padrão da Nova Hipótese acima. */
        if (etapa.id === 'decisao' && decisaoFaltaPontoDeReinicio(d)) {
          avisosEl.dataset.bloqueio = 'decisao-ponto-reinicio';
          avisosEl.innerHTML = '<p class="aposta-aviso-didatico">' + esc(PERGUNTA_PONTO_REINICIO[d.decisao] || 'Escolha o que precisa ser revisto') + ' — escolha uma opção para completar a decisão.</p>';
          var grupoPontoReinicio = document.getElementById('apostaGrupoPontoReinicio');
          (grupoPontoReinicio || avisosEl).scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
      }

      /* Evidência: a etapa inteira alterna entre dois modos, nunca card
         a card. Em planejamento, o clique só libera o modo de registro
         quando TODO o Plano de Evidência estiver completo (fonte
         prevista, e detalhe se for "Outro") — sem avançar para a
         Decisão, porque ela ainda não existe. Já em registro, cada
         resultado medido precisa de Resultado observado + Fonte +
         Aprendizado, OU de "Não foi possível medir" + Motivo, antes de
         seguir para a Decisão de verdade. Nenhum dos dois tem escape
         por segundo clique. */
      if (etapa.id === 'evidencia') {
        var seEvClique = statusEvidencia({ mudancas: _dados.mudancas, experimento: _dados.experimento, evidencia: d });
        if (!seEvClique.registrando) {
          if (seEvClique.estado !== 'pronta') {
            var idxPlanoIncompleto = -1;
            (d.itens || []).forEach(function (ev, idx) {
              if (idxPlanoIncompleto !== -1) return;
              if (!planoDeEvidenciaCompleto(ev)) idxPlanoIncompleto = idx;
            });
            avisosEl.dataset.bloqueio = 'evidencia-plano';
            avisosEl.innerHTML = '<p class="aposta-aviso-didatico">Complete o Plano de Evidência do resultado destacado acima: escolha a Fonte prevista (e, se for "Outro", o Detalhe/como será medido).</p>';
            var blocosPlano = _tela.querySelectorAll('.aposta-mudanca[data-resultado]');
            (blocosPlano[idxPlanoIncompleto] || avisosEl).scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
          }
          /* Item 4 do ajuste de usabilidade: mudar de modo é irreversível
             de fato (a partir daqui os campos de planejamento viram
             recapitulação só leitura), então confirma antes — evita
             entrar sem querer no estado pós-execução. Modal próprio (não
             window.confirm) para manter o visual do site; ver
             confirmarRegistroDeResultados. */
          confirmarRegistroDeResultados(function () {
            /* Plano completo: liga o modo de registro e recarrega a MESMA
               etapa (nunca avança para a Decisão a partir daqui). A Fonte
               utilizada nasce pré-selecionada com a Fonte planejada — o
               grupo troca se tiver sido diferente, mas não precisa
               confirmar a repetição com um clique à parte. */
            (d.itens || []).forEach(function (ev) {
              if (!normalizar(ev.fonte) && normalizar(ev.fontePrevista)) ev.fonte = ev.fontePrevista;
            });
            d.registrando = 'sim';
            seguirBtn.disabled = true;
            salvarEtapa(etapa.id, d, false, function (err) {
              if (err) {
                seguirBtn.disabled = false;
                avisar('Não consegui salvar "' + etapa.curto + '" — verifique a conexão e tente de novo. ' +
                  'Nada foi perdido: o que está na tela continua aqui.', true);
                return;
              }
              /* Sem toast aqui: o próprio modo de registro já mostra, de
                 forma permanente no corpo da tela, o banner "REGISTRO DOS
                 RESULTADOS" — um aviso que some em 2s seria redundante e
                 rápido demais para ler. */
              render();
            });
          });
          return;
        }
        var idxEvidenciaIncompleta = -1;
        (d.itens || []).forEach(function (ev, idx) {
          if (idxEvidenciaIncompleta !== -1) return;
          if (!evidenciaCardCompleto(ev)) idxEvidenciaIncompleta = idx;
        });
        if (idxEvidenciaIncompleta !== -1) {
          avisosEl.dataset.bloqueio = 'evidencia';
          avisosEl.innerHTML = '<p class="aposta-aviso-didatico">Complete o resultado destacado acima: preencha "Resultado observado", "Fonte utilizada" e "O que aprendemos com esta evidência?", ou marque "Não foi possível medir" e informe o motivo.</p>';
          var blocosEvidencia = _tela.querySelectorAll('.aposta-mudanca[data-resultado]');
          (blocosEvidencia[idxEvidenciaIncompleta] || avisosEl).scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        /* Só depois de cada resultado estar completo é que faz sentido
           pedir a leitura do CONJUNTO — "Nossa hipótese foi" nunca
           bloqueia antes disso, sempre depois. */
        if (!normalizar(d.classificacao)) {
          avisosEl.dataset.bloqueio = 'evidencia-classificacao';
          avisosEl.innerHTML = '<p class="aposta-aviso-didatico">Escolha "Nossa hipótese foi:" — a leitura do conjunto das evidências — antes de continuar.</p>';
          var classificacaoEl = _tela.querySelector('#apostaClassificacaoHipotese');
          (classificacaoEl || avisosEl).scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
      }

      var avisos = validar(etapa.id, d);
      /* Não bloqueia: mostra o convite a reler e só avança no
         segundo clique, para o aviso ter tempo de ser lido. Isso é sobre
         o CONTEÚDO (um convite a reler), diferente do erro de gravação
         acima (que impede seguir de verdade, porque nada foi salvo). */
      if (avisos.length && !avisosEl.dataset.mostrado) {
        avisosEl.dataset.mostrado = '1';
        avisosEl.innerHTML = avisos.map(function (a) {
          return '<p class="aposta-aviso-didatico">💡 ' + esc(a) + '</p>';
        }).join('') + '<p class="aposta-aviso-ok">Você pode seguir assim mesmo — clique em Continuar de novo.</p>';
        avisosEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }
      /* Data da Decisão: quando esta decisão foi registrada — auditoria
         automática, nunca digitada. Grava na primeira vez que a Decisão
         avança de verdade e NUNCA muda depois disso — diferente da Data
         de reavaliação, que é quando o grupo PRETENDE voltar a olhar.
         `d` vem de coletar(), que só lê campos com data-campo no DOM:
         dataDecisao não é um desses (não é editável), então preservá-la
         aqui é OBRIGATÓRIO — sem isso, qualquer novo Continuar sobre uma
         Decisão já respondida (Fase 4: reabrir a Decisão para tentar de
         novo depois de uma falha no nascimento do ciclo, ver
         concluirOuIniciarNovoCiclo) apagaria a data já gravada, porque
         salvarEtapa substitui o objeto 'decisao' inteiro. */
      if (etapa.id === 'decisao') {
        d.dataDecisao = (_dados.decisao || {}).dataDecisao || new Date().toISOString();
      }
      seguirBtn.disabled = true;
      salvarEtapa(etapa.id, d, false, function (err) {
        if (err) {
          seguirBtn.disabled = false;
          avisar('Não consegui salvar "' + etapa.curto + '" — verifique a conexão e tente de novo. ' +
            'Nada foi perdido: o que está na tela continua aqui.', true);
          return;
        }
        /* O toast é filho de _tela, que "avancar" substitui na hora — sem
           o atraso curto, a mensagem nunca chegaria a aparecer. */
        if (etapa.id === 'decisao') {
          avisar('✓ Decisão registrada.');
          setTimeout(function () { avancar(etapa); }, 700);
          return;
        }
        avancar(etapa);
      });
    });

    _tela.querySelectorAll('.aposta-trilha-item').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.disabled) return;
        var destino = b.dataset.etapa;
        comEscritaConfirmada(b, function () {
          _vendoMapa = false;
          _etapaAtual = destino;
          render();
        });
      });
    });
  }

  function avancar(etapa) {
    var idx = indiceEtapa(etapa.id);
    if (idx === ETAPAS.length - 1) {
      /* Decisão confirmada — Fase 4 decide entre só finalizar o ciclo
         (Ampliar/Interromper) ou também abrir o próximo (as outras
         cinco decisões). Nas demais etapas (não existe outro caso hoje
         em que idx seja o último senão 'decisao'), mantém o
         comportamento de sempre. */
      if (etapa.id === 'decisao') { concluirOuIniciarNovoCiclo(); return; }
      _vendoMapa = true; render();
      return;
    }
    _etapaAtual = ETAPAS[idx + 1].id;
    /* A etapa do grupo (ou do ciclo atual) é o que o painel do
       facilitador mostra como progresso. Falhar aqui não trava o
       grupo, mas engana quem acompanha — então avisa. */
    db().ref(caminhoEtapaAtualPersistida()).set(_etapaAtual, function (err) {
      if (err) avisar('Avancei aqui, mas não consegui registrar o progresso do grupo.', true);
    });
    render();
  }

  /* ══════════════════════════════════════════════════════════════
     FASE 4 — O QUE ACONTECE QUANDO A DECISÃO É CONFIRMADA

     "Ampliar" e "Interromper esta ideia" (itens 12/13 do pedido)
     apenas finalizam o ciclo atual — nenhum ciclo novo nasce sozinho.
     As outras cinco decisões abrem um ciclo novo, cada uma com seu
     próprio ponto de reinício (fixo para três delas, escolhido pela
     dupla para as outras duas — ver PONTOS_DE_REINICIO_FIXOS/
     OPCOES_PONTO_REINICIO). A decisão continua sempre humana: nada
     aqui decide sozinha QUAL ciclo nascer — só executa a consequência
     estrutural da escolha que a dupla já fez. ══════════════════════ */
  function finalizarCicloAtual(cb) {
    var id = cicloAtualId();
    if (!id) {
      /* Ciclo 1 implícito: nada para persistir além do que a Decisão
         já gravou (dataDecisao) — é esse campo que sinaliza "concluído"
         até o dia em que um Ciclo 2 nascer de verdade (ver CICLO 1
         IMPLÍCITO, na seção de dados de ciclos). */
      if (cb) cb();
      return;
    }
    var finalizadoEm = (_dados.decisao || {}).dataDecisao || new Date().toISOString();
    db().ref(caminhoCiclos() + '/porId/' + id).update({ status: 'FINALIZADO', finalizadoEm: finalizadoEm }, function (err) {
      if (err) avisar('A decisão foi salva, mas não consegui marcar o ciclo como concluído.', true);
      if (cb) cb();
    });
  }

  /* Estado local + navegação depois de um ciclo novo nascer — usado
     tanto pelo fluxo normal (Decisão → Continuar) quanto pela edição
     manual de um ciclo já finalizado (ver PROTEÇÃO CONTRA EDITAR CICLO
     FINALIZADO). Não espera o eco do listener: o mesmo padrão de
     concluirCriacaoExecucao (Fase 1), que também atualiza o estado
     local na hora, sem esperar a rodada seguinte de ouvirExecucao(). */
  function entrarNoNovoCiclo(novoCicloId, novoCiclo, etapaAlvo) {
    _grupo.ciclos = _grupo.ciclos || {};
    _grupo.ciclos.atual = novoCicloId;
    _grupo.ciclos.porId = _grupo.ciclos.porId || {};
    _grupo.ciclos.porId[novoCicloId] = novoCiclo;
    _dados = novoCiclo.dados;
    _etapaAtual = etapaAlvo || novoCiclo.etapa;
    _vendoMapa = false;
    render();
  }

  function concluirOuIniciarNovoCiclo() {
    var d = _dados.decisao || {};
    if (!decisaoGeraNovoCiclo(d.decisao)) {
      finalizarCicloAtual(function () { _vendoMapa = true; render(); });
      return;
    }
    var ponto = pontoDeReinicioDaDecisao(d);
    criarCiclo(ponto, d.decisao, function (err, novoCicloId, novoCiclo) {
      if (err) {
        /* A decisão já foi salva antes de chegar aqui (avancar só roda
           depois do salvarEtapa da Decisão ter confirmado) — só o
           NASCIMENTO do próximo ciclo falhou. Nada foi perdido: mostra
           o mapa com o ciclo atual, já finalizado corretamente por
           dentro de criarCiclo só em caso de sucesso (numa falha, o
           update() atômico não grava nada, então o ciclo atual
           continua exatamente como estava, com a decisão gravada). */
        avisar('A decisão foi salva, mas não consegui abrir o próximo ciclo — verifique a conexão e tente de novo pelo Mapa.', true);
        _vendoMapa = true; render();
        return;
      }
      entrarNoNovoCiclo(novoCicloId, novoCiclo, ponto);
    });
  }

  /* ── Salvamento automático ───────────────────────────────────────
     O agendamento guarda o CONTEÚDO, não a promessa de reler a tela
     depois: quando o temporizador dispara, a etapa em edição pode já
     não ser a mesma. E qualquer gravação explícita (Continuar, Voltar,
     clique na trilha) cancela a agendada — deixar a antiga cair depois
     desfaria o que acabou de ser salvo. */
  var _timerSalvar = null;
  var _pendente = null;   /* { etapaId, dados } ainda não gravado */

  function agendarSalvamento(etapaId, dados) {
    _pendente = { etapaId: etapaId, dados: dados };
    _dados[etapaId] = dados;
    clearTimeout(_timerSalvar);
    _timerSalvar = setTimeout(gravarPendente, 600);
  }

  function gravarPendente() {
    if (!_pendente) return;
    var p = _pendente;
    salvarEtapa(p.etapaId, p.dados);
  }

  /* ══════════════════════════════════════════════════════════════
     FASE 4 — REVISAR UM CAMPO HERDADO GERA EFEITO CASCATA

     "Herdado" (ciclo.herdadas) é o que foi copiado do ciclo anterior
     sem pedir para ser revisto. Enquanto ninguém mexe nisso, tudo
     funciona normal. Mas se o grupo VOLTA e edita de propósito uma
     etapa herdada — Problema, digamos, num ciclo que nasceu na
     Hipótese — o que vinha depois dela (Mudanças, Hipótese, Ideia,
     Experimento, Evidência, Decisão) foi decidido em cima de um
     Problema que acabou de mudar: não pode continuar valendo como se
     nada tivesse acontecido. Isso NUNCA toca o ciclo anterior (só
     existe update() no caminho do ciclo ATUAL) — é sempre uma revisão
     de dentro do mesmo ciclo, nunca a criação de um novo.

     Sem UX própria de confirmação por campo nesta fase (a dupla não é
     avisada ANTES de editar que isso vai limpar o que vem depois) —
     mas o efeito em si é real e imediato, nunca um "válido implícito"
     silencioso: as etapas afetadas voltam a "ainda não preenchida"
     (mesmo estado que etapaPreenchida() já sabe reconhecer) assim que
     o campo herdado é salvo, e um aviso conta o que aconteceu. */
  function etapasEstritamenteDepoisDe(etapaId) {
    return ETAPAS.slice(indiceEtapa(etapaId) + 1).map(function (e) { return e.id; });
  }

  function salvarEtapa(etapaId, dados, redesenhar, cb) {
    clearTimeout(_timerSalvar);
    _timerSalvar = null;
    _pendente = null;
    if (!_grupoId) { if (cb) cb(null); return; }
    _dados[etapaId] = dados;
    var s = sessao();
    var updates = {};

    var idCicloAtual = cicloAtualId();
    var cicloRec = idCicloAtual ? ((((_grupo.ciclos || {}).porId) || {})[idCicloAtual]) : null;
    var revisandoHerdado = !!(cicloRec && (cicloRec.herdadas || []).indexOf(etapaId) !== -1);
    var etapasLimpas = [];
    if (revisandoHerdado) {
      etapasLimpas = etapasEstritamenteDepoisDe(etapaId).filter(function (id) {
        return Object.keys(_dados[id] || {}).length > 0;
      });
      etapasEstritamenteDepoisDe(etapaId).forEach(function (id) {
        _dados[id] = {};
        updates[caminhoCiclos() + '/porId/' + idCicloAtual + '/dados/' + id] = {};
      });
      /* O ponto de reinício "efetivo" deste ciclo passa a ser aqui — é
         daqui em diante que o ciclo precisa ser revisado de novo. As
         etapas entre o pontoDeReinicio original e esta continuam
         herdadas (nunca foram tocadas); desta em diante, ninguém mais
         é herdada — é trabalho deste ciclo, revisado agora. */
      var novasHerdadas = etapasAntesDe(etapaId).filter(function (id) {
        return (cicloRec.herdadas || []).indexOf(id) !== -1;
      });
      updates[caminhoCiclos() + '/porId/' + idCicloAtual + '/herdadas'] = novasHerdadas;
      updates[caminhoCiclos() + '/porId/' + idCicloAtual + '/pontoDeReinicio'] = etapaId;
      _grupo.ciclos.porId[idCicloAtual].herdadas = novasHerdadas;
      _grupo.ciclos.porId[idCicloAtual].pontoDeReinicio = etapaId;
    }

    updates[caminhoDadosAtual() + '/' + etapaId] = dados;
    updates[caminhoGrupo() + '/atualizadoEm'] = new Date().toISOString();
    updates[caminhoGrupo() + '/atualizadoPorNome'] = s ? (s.name || s.email) : '';
    db().ref().update(updates, function (err) {
      var el = document.getElementById('apostaSalvo');
      if (el) {
        el.textContent = err ? 'Não consegui salvar' : 'Salvo';
        el.className = 'aposta-salvo' + (err ? ' is-erro' : '');
      }
      if (!err && etapasLimpas.length) {
        var nomes = etapasLimpas.map(function (id) { return (etapaPorId(id) || {}).curto || id; }).join(', ');
        avisar('Como "' + ((etapaPorId(etapaId) || {}).curto || etapaId) + '" mudou, o que vinha depois neste ciclo (' + nomes + ') foi limpo para ser revisado de novo.', true);
      }
      if (redesenhar && !err) render();
      if (cb) cb(err);
    });
  }

  /* ══════════════════════════════════════════════════════════════
     MAPA DA APOSTA
     ══════════════════════════════════════════════════════════════ */
  /* ══════════════════════════════════════════════════════════════
     FASE 4 — MAPA MULTICICLO

     Enquanto a aposta tem um só ciclo (o caso de sempre), o Mapa
     continua idêntico ao que já era — nenhuma seção "CICLO 1" aparece
     à toa. A partir do Ciclo 2, Missão/Sintoma continuam aparecendo
     uma ÚNICA vez (item 5 do pedido: são contexto da aposta, não do
     ciclo), e cada ciclo ganha sua própria seção, começando no seu
     ponto de reinício (ou em Problema, para o Ciclo 1) — repetir
     Problema/Mudanças herdados e intocados em todo ciclo posterior só
     acrescentaria ruído ao que já está exatamente igual ao anterior.

     Só o ciclo ATUAL tem cards clicáveis (<button>) — os demais são
     <div>, sem clique nenhum, o mesmo padrão já usado no histórico de
     execuções da Fase 2 (nunca <button> = nada ali é editável por
     engano). Isso sozinho já satisfaz "consultar um ciclo anterior
     nunca altera cicloAtual nem escreve nele": não existe UM caminho
     de código que tente. */
  /* Lista pura, sem depender de estado global (_grupo/_dados) — usada
     tanto pelo Mapa ao vivo (com o ciclo atual e ehAtual marcados por
     cima, ver todosOsCiclosOrdenados) quanto pelo Histórico de
     Execuções da Fase 2 e pelo CSV, que leem grupos de uma FOTOGRAFIA
     (.once()) qualquer, atual ou antiga — nunca as variáveis da
     dinâmica ao vivo. */
  function listarCiclosDoGrupo(grupo) {
    var ciclosNode = (grupo || {}).ciclos || {};
    if (!ciclosNode.porId) {
      return [{ id: null, numero: 1, dados: (grupo || {}).dados || {}, pontoDeReinicio: null, status: null }];
    }
    var porId = ciclosNode.porId;
    return Object.keys(porId).sort(function (a, b) {
      return (porId[a].numero || 0) - (porId[b].numero || 0);
    }).map(function (id) {
      var c = porId[id] || {};
      return {
        id: id, numero: c.numero, dados: c.dados || {}, pontoDeReinicio: c.pontoDeReinicio || null,
        decisaoOrigem: c.decisaoOrigem || null, status: c.status || 'EM_CONSTRUCAO'
      };
    });
  }

  function todosOsCiclosOrdenados() {
    var atualId = (_grupo.ciclos || {}).atual || null;
    return listarCiclosDoGrupo(_grupo).map(function (c) {
      var ehAtual = c.id === atualId || (c.id === null && atualId === null);
      return Object.assign({}, c, {
        ehAtual: ehAtual,
        status: c.id ? c.status : (cicloAtualEstaFinalizado() ? 'FINALIZADO' : 'EM_CONSTRUCAO')
      });
    });
  }

  function cardsDoCicloHtml(ciclo) {
    var inicioIdx = ciclo.pontoDeReinicio ? indiceEtapa(ciclo.pontoDeReinicio) : indiceEtapa('problema');
    return ETAPAS.slice(inicioIdx).map(function (e, i) {
      var texto = resumoEtapa(e.id, ciclo.dados);
      var tag = ciclo.ehAtual ? 'button' : 'div';
      return (i ? '<div class="aposta-mapa-seta">↓</div>' : '') +
        '<' + tag + ' class="aposta-mapa-card' + (texto ? '' : ' is-vazio') + (ciclo.ehAtual ? '' : ' is-somente-leitura') +
          '" data-etapa="' + esc(e.id) + '"' + (ciclo.ehAtual ? '' : ' tabindex="-1"') + '>' +
          '<span class="aposta-mapa-rot">' + esc(e.titulo) + '</span>' +
          '<span class="aposta-mapa-txt">' + esc(texto || 'ainda não preenchido') + '</span>' +
        '</' + tag + '>';
    }).join('');
  }

  function cicloTituloHtml(ciclo) {
    var partes = ['CICLO ' + ciclo.numero];
    if (ciclo.pontoDeReinicio) {
      var e = etapaPorId(ciclo.pontoDeReinicio);
      partes.push('Ponto de reinício: ' + (e ? e.curto : ciclo.pontoDeReinicio));
    }
    partes.push(ciclo.status === 'FINALIZADO' ? 'Concluído' : (ciclo.ehAtual ? 'Em andamento' : ''));
    return '<div class="aposta-ciclo-titulo">' + esc(partes.filter(Boolean).join(' · ')) + '</div>';
  }

  /* Item 9 do pedido: tentar editar uma etapa de um ciclo já concluído
     nunca reabre e sobrescreve silenciosamente o histórico — pergunta
     antes, e só cria um Ciclo novo (a partir da etapa clicada) se a
     dupla confirmar. Mesmo padrão visual de confirmarNovaExecucao. */
  function confirmarEditarCicloFinalizado(etapaAlvo, callbackSim) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay aposta-confirmar-overlay';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:10002';
    var box = document.createElement('div');
    box.className = 'modal-box';
    box.style.cssText = 'max-width:440px;width:90%;padding:28px;display:flex;flex-direction:column;gap:18px';
    box.innerHTML =
      '<p style="margin:0;font-size:.95rem;line-height:1.6;color:var(--ink)">Este ciclo já foi concluído. Deseja iniciar um novo ciclo a partir desta etapa?</p>' +
      '<p style="margin:0;font-size:.82rem;line-height:1.5;color:var(--ink-3)">O que já foi decidido neste ciclo continua registrado, sem nenhuma alteração — um Ciclo novo começa a partir de "' +
        esc((etapaPorId(etapaAlvo) || {}).curto || etapaAlvo) + '".</p>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap">' +
        '<button type="button" class="btn aposta-modal-nao-btn">CANCELAR</button>' +
        '<button type="button" class="btn btn--primary aposta-modal-sim-btn">INICIAR NOVO CICLO</button>' +
      '</div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function fechar() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
    box.querySelector('.aposta-modal-nao-btn').addEventListener('click', fechar);
    var overlayMousedownFora = false;
    overlay.addEventListener('mousedown', function (e) { overlayMousedownFora = !box.contains(e.target); });
    overlay.addEventListener('click', function (e) { if (overlayMousedownFora && !box.contains(e.target)) fechar(); });
    overlay.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); fechar(); } });
    box.querySelector('.aposta-modal-sim-btn').addEventListener('click', function () { fechar(); callbackSim(); });
  }

  /* Fase 3 — mesmo padrão de proteção contra clique duplo/repetido já
     usado em #apostaCriarGrupo: desabilita o botão que disparou a
     criação do ciclo manual (via confirmação acima) assim que o clique
     acontece, e só reabilita em caso de erro. */
  function iniciarNovoCicloManual(etapaAlvo, botao) {
    if (botao) botao.disabled = true;
    criarCiclo(etapaAlvo, 'edicao-manual', function (err, novoCicloId, novoCiclo) {
      if (err) {
        if (botao) botao.disabled = false;
        avisar('Não consegui iniciar o novo ciclo. Tente de novo.', true);
        return;
      }
      entrarNoNovoCiclo(novoCicloId, novoCiclo, etapaAlvo);
    });
  }

  function abrirEtapaDoMapa(etapaAlvo, botao) {
    if (!cicloAtualEstaFinalizado()) { _vendoMapa = false; _etapaAtual = etapaAlvo; render(); return; }
    confirmarEditarCicloFinalizado(etapaAlvo, function () { iniciarNovoCicloManual(etapaAlvo, botao); });
  }

  function renderMapa() {
    var conduz = souFacilitadora();
    var ciclos = todosOsCiclosOrdenados();
    var multiCiclo = ciclos.length > 1;
    _tela.innerHTML = cabecalho(
      conduz && !_exec.revelado
        ? '<button class="btn btn--sm btn--primary" id="apostaRevelarBtn">Revelar conexões</button>'
        : ''
    ) +
      '<div class="aposta-corpo">' +
        trilhaHtml() +
        '<main class="aposta-palco aposta-palco--mapa">' +
          '<h1 class="aposta-mapa-titulo">Mapa da Aposta</h1>' +
          '<p class="aposta-mapa-print">' + esc(_turma.label) +
            (_grupo.nome ? ' · ' + esc(_grupo.nome) : '') + ' · ' + esc(dataDeHoje()) + '</p>' +
          '<p class="aposta-mapa-sub">Clique em qualquer card do ciclo atual para editar aquela etapa.</p>' +
          /* Levar a aposta embora: em papel/PDF para a sala e em texto
             para colar onde for analisada. São os dois destinos que a
             oficina pede, e nenhum deles é o CSV do painel (que é da
             facilitadora, com todos os grupos). */
          '<div class="aposta-mapa-acoes">' +
            '<button class="btn btn--sm" id="apostaCopiarBtn">⧉ Copiar em texto</button>' +
            '<button class="btn btn--sm" id="apostaPdfBtn">🖨 Salvar em PDF</button>' +
          '</div>' +
          '<div class="aposta-mapa">' +
            ['missao', 'sintoma'].map(function (id, i) {
              var texto = resumoEtapa(id, _dados);
              var e = etapaPorId(id);
              return (i ? '<div class="aposta-mapa-seta">↓</div>' : '') +
                '<button class="aposta-mapa-card' + (texto ? '' : ' is-vazio') + '" data-etapa="' + id + '">' +
                  '<span class="aposta-mapa-rot">' + esc(e.titulo) + '</span>' +
                  '<span class="aposta-mapa-txt">' + esc(texto || 'ainda não preenchido') + '</span>' +
                '</button>';
            }).join('') +
            ciclos.map(function (ciclo) {
              return '<div class="aposta-mapa-seta">↓</div>' +
                (multiCiclo ? cicloTituloHtml(ciclo) : '') +
                cardsDoCicloHtml(ciclo);
            }).join('') +
          '</div>' +
          (_exec.revelado ? revelacaoHtml() : '') +
        '</main>' +
      '</div>';

    ligarCabecalho();
    /* Escopado a <button> — os cards de ciclos que não são o atual são
       <div> (ver cardsDoCicloHtml), de propósito, para nunca serem
       clicáveis. Um seletor genérico pegaria os dois e um clique num
       card de ciclo ANTERIOR acabaria editando dados do ciclo ATUAL
       (já que _dados sempre aponta para o atual) — o mesmo cuidado que
       o histórico de execuções da Fase 2 já toma. */
    _tela.querySelectorAll('button.aposta-mapa-card').forEach(function (b) {
      b.addEventListener('click', function () { abrirEtapaDoMapa(b.dataset.etapa, b); });
    });
    _tela.querySelectorAll('.aposta-trilha-item').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.disabled) return;
        abrirEtapaDoMapa(b.dataset.etapa, b);
      });
    });
    var rev = document.getElementById('apostaRevelarBtn');
    if (rev) rev.addEventListener('click', function () {
      db().ref(caminhoExec() + '/revelado').set(true);
    });
    var copiar = document.getElementById('apostaCopiarBtn');
    if (copiar) copiar.addEventListener('click', copiarAposta);
    var pdf = document.getElementById('apostaPdfBtn');
    if (pdf) pdf.addEventListener('click', function () { window.print(); });
  }

  /* ══════════════════════════════════════════════════════════════
     LEVAR A APOSTA EMBORA

     Dois formatos, o mesmo conteúdo do mapa:

     · PDF — window.print() com uma folha de impressão própria. Sem
       biblioteca: o "Salvar como PDF" do navegador já existe no
       computador e no celular, e uma biblioteca de PDF neste repo
       (sem bundler, tudo em <script> global) custaria centenas de KB
       para fazer o que o próprio navegador faz.
     · TEXTO — markdown simples, para colar onde a aposta for analisada
       (inclusive numa IA). Sai etapa por etapa, com a pergunta de cada
       uma, porque sem a pergunta o texto vira uma lista de frases soltas
       e quem lê depois não sabe o que cada uma responde.

     Os termos do final da dinâmica não entram em nenhum dos dois: o
     texto sai do mesmo resumoEtapa que alimenta a tela.
     ══════════════════════════════════════════════════════════════ */
  /* ── A missão que a facilitação cadastra ───────────────────────────
     Ela existia como um campo de texto no painel que era gravado e não
     chegava a lugar nenhum: nenhuma tela lia. Enquanto isso a etapa 1
     pedia a missão do zero, e quem tinha acabado de cadastrar uma via a
     pergunta de novo, sem relação com o que escreveu.

     Agora é o começo da etapa 1: o grupo abre com ela já escrita, nas
     mesmas lacunas, e ajusta se quiser — o que ficar na tela é a missão
     do grupo, gravada no grupo. Deixar em branco no painel mantém o
     comportamento antigo: cada grupo escreve a sua. */
  function missaoDaExecucao() {
    var m = _exec.missao;
    if (!m) return {};
    if (typeof m === 'string') return m.trim() ? { texto: m.trim() } : {};
    return m;
  }
  function temMissaoDaExecucao() {
    return etapaPreenchida('missao', { missao: missaoDaExecucao() });
  }

  function dataDeHoje() {
    try { return new Date().toLocaleDateString('pt-BR'); } catch (e) { return ''; }
  }

  /* Fase 2 (Histórico de Execuções): datas de criação/encerramento vêm
     como ISO string — aqui só para exibição, nunca para cálculo. */
  function formatarDataHora(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso);
      return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return String(iso); }
  }

  function complementosEmTexto(etapa) {
    var d = _dados[etapa.id] || {};
    var usados = {};
    (etapa.molde || []).forEach(function (p) {
      if (typeof p !== 'string' && p.c) {
        usados[p.c] = 1;
        var c0 = campoPorChave(etapa, p.c);
        if (c0 && c0.tipo === 'quantidade') usados[chaveUnidade(p.c)] = 1;
      }
    });
    (etapa.grupos || []).forEach(function (g) {
      (g.molde || []).forEach(function (p) { if (typeof p !== 'string' && p.c) usados[p.c] = 1; });
    });
    return (etapa.campos || []).filter(function (c) {
      return !usados[c.chave] && c.tipo !== 'variantes' && String(d[c.chave] || '').trim();
    }).map(function (c) {
      return c.rotulo + ': ' + String(d[c.chave]).trim();
    });
  }

  function textoDaAposta() {
    var l = [];
    l.push('# Construção da Aposta');
    l.push('Turma: ' + _turma.label);
    if (_grupo.nome) l.push('Grupo: ' + _grupo.nome);
    l.push('Exportado em: ' + dataDeHoje());
    l.push('');
    ETAPAS.forEach(function (e, i) {
      l.push('## ' + (i + 1) + '. ' + e.curto);
      l.push('_' + e.pergunta + '_');
      if (e.lista) {
        var itens = (_dados[e.id] || {}).itens || [];
        if (itens.length) itens.forEach(function (m) { l.push('- ' + fraseMudanca(m)); });
        else l.push('(ainda não preenchido)');
      } else {
        l.push(resumoEtapa(e.id, _dados) || '(ainda não preenchido)');
      }
      /* A frase da próxima hipótese é da Decisão, mas não entra na frase
         dela — sem esta linha, sumiria do texto exportado. */
      (e.grupos || []).forEach(function (g) {
        var partes = partesDaFrase({ campos: e.campos, escolha: e.escolha, molde: g.molde }, _dados[e.id] || {});
        if (partes.some(function (p) { return p.tipo === 'valor'; })) {
          l.push('');
          l.push('**' + g.rotulo.split('—')[0].trim() + ':** ' +
            juntarPartes(partes, function () { return '—'; }));
        }
      });
      var extras = complementosEmTexto(e);
      if (extras.length) { l.push(''); l.push('Complementos — ' + extras.join(' · ')); }
      l.push('');
    });
    return l.join('\n');
  }

  function copiarAposta() {
    var txt = textoDaAposta();
    function caiuNoManual() { mostrarTextoParaCopiar(txt); }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(function () {
          avisar('Aposta copiada — é só colar onde você vai analisar.');
        }, caiuNoManual);
        return;
      }
    } catch (e) { /* cai no manual */ }
    caiuNoManual();
  }

  /* Copiar pode ser recusado (permissão, navegador antigo, aba sem foco).
     Dizer "copiado" nesse caso seria mentir — então a saída é mostrar o
     texto já selecionado, que funciona em qualquer navegador. */
  function mostrarTextoParaCopiar(txt) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:10000';
    var box = document.createElement('div');
    box.className = 'modal-box';
    box.style.cssText = 'max-width:680px;width:94%;padding:22px;display:flex;flex-direction:column;gap:12px';
    box.innerHTML = '<h3 style="margin:0;font-family:var(--font-head);color:var(--ink)">Copiar a aposta</h3>' +
      '<p style="margin:0;font-size:.85rem;color:var(--ink-3)">Selecione tudo e copie (Ctrl+C, ou segure para copiar no celular).</p>' +
      '<textarea readonly rows="12" style="width:100%;font-family:var(--font-mono);font-size:.78rem"></textarea>' +
      '<div style="display:flex;justify-content:flex-end"><button class="btn admin-modal-cancel-btn">Fechar</button></div>';
    box.querySelector('textarea').value = txt;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    var ta = box.querySelector('textarea');
    ta.focus(); ta.select();
    box.querySelector('button').addEventListener('click', function () { document.body.removeChild(overlay); });
  }

  /* ══════════════════════════════════════════════════════════════
     REVELAÇÃO — só depois do clique do facilitador

     Cuidado de conteúdo: NÃO afirmar que Missão e Objective são
     sinônimos universais. A frase diz o que aconteceu NESTA
     dinâmica, e só.
     ══════════════════════════════════════════════════════════════ */
  function revelacaoHtml() {
    var mudancas = (_dados.mudancas || {}).itens || [];
    return '<section class="aposta-revelacao">' +
      '<h2>Vocês fizeram 2 em 1</h2>' +
      '<p class="aposta-revelacao-frase">Sem perceber, vocês também construíram a lógica de um OKR.</p>' +

      '<div class="aposta-rev-par">' +
        '<div class="aposta-rev-card is-objective">' +
          '<span class="aposta-rev-de">MISSÃO DA DINÂMICA</span>' +
          '<span class="aposta-rev-seta">→</span>' +
          '<span class="aposta-rev-para">Objective</span>' +
          '<p class="aposta-rev-pergunta">"O que queremos alcançar?"</p>' +
          '<p class="aposta-rev-conteudo">' + esc(resumoEtapa('missao', _dados) || '—') + '</p>' +
        '</div>' +
        '<div class="aposta-rev-card is-kr">' +
          '<span class="aposta-rev-de">MUDANÇAS MENSURÁVEIS</span>' +
          '<span class="aposta-rev-seta">→</span>' +
          '<span class="aposta-rev-para">Key Results</span>' +
          '<p class="aposta-rev-pergunta">"Como saberemos, de forma mensurável, que estamos alcançando isso?"</p>' +
          (mudancas.length
            ? '<ul class="aposta-rev-lista">' + mudancas.map(function (m) {
                return '<li>' + esc(fraseMudanca(m)) + '</li>';
              }).join('') + '</ul>'
            : '<p class="aposta-rev-conteudo">—</p>') +
        '</div>' +
      '</div>' +

      '<div class="aposta-rev-ciclo">' +
        '<span class="aposta-rev-de">Problema → Hipótese → Experimento → Evidência → Decisão</span>' +
        '<span class="aposta-rev-para">ciclo PHEED</span>' +
      '</div>' +

      '<p class="aposta-rev-fecho">O OKR deixou claro o que queremos mudar e como reconhecer o avanço. ' +
        'O PHEED ajudou a investigar e testar caminhos capazes de produzir essa mudança.</p>' +
      '<p class="aposta-rev-ressalva">Nesta dinâmica, aquilo que chamamos de Missão exerceu o papel de Objective.</p>' +
    '</section>';
  }

  /* ══════════════════════════════════════════════════════════════
     PAINEL DO FACILITADOR
     ══════════════════════════════════════════════════════════════ */

  /* As mesmas lacunas da etapa 1, com o mesmo texto fixo: se as duas
     telas pedem a mesma frase, elas têm de pedir do mesmo jeito. Os
     campos são marcados com data-mis (e não com id/data-campo) porque
     a etapa continua montada atrás do painel — dois campos com o mesmo
     id na página fazem um esconder o outro. */
  function missaoFacHtml() {
    var etapa = etapaPorId('missao');
    var d = missaoDaExecucao();
    var blocos = '';
    var molde = etapa.molde || [];
    molde.forEach(function (p, i) {
      if (typeof p === 'string') {
        /* "em" é palavra da FRASE ("…em 90 dias."), não rótulo de campo —
           igual na etapa 1 (ver blocosDoMolde/rotuloMolde), quando o
           campo seguinte tem rotuloMolde, é ELE que aparece aqui, e o
           texto fixo fica de fora da área de edição. */
        var seguinte = molde[i + 1];
        var campoSeg = seguinte && typeof seguinte !== 'string' ? campoPorChave(etapa, seguinte.c) : null;
        if (campoSeg && campoSeg.rotuloMolde) {
          blocos += '<span class="aposta-campo-rot">' + esc(campoSeg.rotuloMolde) + '</span>';
          return;
        }
        var t = fixoVisivel(p);
        if (t) blocos += '<span class="aposta-molde-fixo">' + esc(t) + '</span>';
        return;
      }
      var c = campoPorChave(etapa, p.c);
      if (!c) return;
      if (c.tipo === 'quantidade') {
        var q = lerQuantidade(c, d);
        blocos += '<span class="aposta-qtd">' +
          '<input type="text" inputmode="numeric" data-mascara="numero" data-mis="' + esc(c.chave) + '"' +
            ' class="aposta-campo-input aposta-qtd-num" value="' + esc(q.num) + '"' +
            ' placeholder="' + esc(c.placeholder || '') + '" aria-label="' + esc(c.rotulo) + '" />' +
          '<select data-mis="' + esc(chaveUnidade(c.chave)) + '" class="aposta-campo-input aposta-qtd-un"' +
            ' aria-label="Unidade de ' + esc(c.rotulo) + '">' +
            UNIDADES.map(function (u) {
              return '<option value="' + u + '"' + (q.un === u ? ' selected' : '') + '>' + u + '</option>';
            }).join('') +
          '</select></span>';
        return;
      }
      blocos += '<input type="text" data-mis="' + esc(c.chave) + '" class="aposta-campo-input"' +
        ' value="' + esc(d[c.chave] || '') + '" placeholder="' + esc(c.placeholder || '') + '"' +
        ' aria-label="' + esc(c.rotulo) + '" />';
    });
    var legado = String(d[etapa.legado] || '').trim();
    return '<div class="aposta-molde aposta-molde--fac">' + blocos + '</div>' +
      (legado && !temLacunaPreenchida(etapa, d)
        ? '<p class="aposta-legado">Você tinha escrito aqui: “' + esc(legado) + '”. Distribua nas lacunas acima.</p>'
        : '');
  }
  function abrirPainelFacilitador() {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:10000';
    var box = document.createElement('div');
    box.className = 'modal-box';
    box.style.cssText = 'max-width:620px;width:94%;padding:26px;display:flex;flex-direction:column;gap:16px;max-height:86vh;overflow:auto';
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    function fechar() { document.body.removeChild(overlay); }

    /* A prévia compacta usa o mesmo molde/engine da etapa 1 — é a MESMA
       frase que o grupo vai ver, só que aqui reagindo ao que a
       facilitação está digitando, antes de salvar. Ficam no escopo de
       fora de desenhar() (não redefinidas a cada redesenho) porque
       comMissaoPreservada precisa delas depois de um desenhar() disparado
       por OUTRA ação do painel. */
    function coletarMissaoFac() {
      var d = {};
      box.querySelectorAll('[data-mis]').forEach(function (el) { d[el.dataset.mis] = el.value; });
      return d;
    }
    function atualizarPreviaMissaoFac() {
      var el = box.querySelector('#apostaPreviaMissaoFac');
      if (!el) return;
      var etapaM = etapaPorId('missao');
      var partes = partesDaFrase(etapaM, coletarMissaoFac());
      var falta = partes.some(function (p) { return p.tipo === 'vazio' && !p.opcional; });
      el.innerHTML = '<span class="aposta-frase-rot">Missão-base</span>' +
        '<p>' + htmlDaFrase(partes) + '</p>' +
        (falta ? '' : '<p class="aposta-frase-pronta">A frase está completa.</p>');
      el.querySelectorAll('.aposta-frase-vazio').forEach(function (b) {
        b.addEventListener('click', function () {
          var alvo = box.querySelector('[data-mis="' + b.dataset.ir + '"]');
          if (!alvo) return;
          alvo.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          alvo.focus();
        });
      });
    }
    /* Criar grupo e Revelar conexões também chamam desenhar() — que
       redesenha o painel INTEIRO a partir do que já está gravado. Um
       rascunho da missão-base ainda não salvo (a pessoa só digitou, não
       clicou em Salvar/Atualizar) seria apagado nesse redesenho, mesmo
       sem relação nenhuma com o que a ação fez. Relatado no uso real:
       preencher a missão-base e clicar em "Criar grupo" limpava tudo o
       que tinha sido digitado em cima. Captura antes, reaplica depois —
       o mesmo cuidado que o resto da dinâmica já tem com "não perder o
       que foi digitado". */
    function comMissaoPreservada(acao) {
      var rascunho = coletarMissaoFac();
      acao();
      Object.keys(rascunho).forEach(function (k) {
        var el = box.querySelector('[data-mis="' + k + '"]');
        if (el && rascunho[k]) el.value = rascunho[k];
      });
      atualizarPreviaMissaoFac();
    }

    function desenhar() {
      var grupos = _exec.grupos || {};
      var missaoBaseSalva = temMissaoDaExecucao();
      box.innerHTML =
        '<h3 style="font-family:var(--font-head);letter-spacing:.05em;color:var(--ink);margin:0">Painel do facilitador</h3>' +
        '<p style="font-size:.82rem;color:var(--ink-3);margin:0">' + esc(_turma.label) + '</p>' +

        '<h4 style="margin:8px 0 0">Missão-base da dinâmica</h4>' +
        '<p style="font-size:.8rem;color:var(--ink-3);margin:0">Se cadastrada, esta missão será usada como ponto de partida apenas para grupos que ainda não preencheram a Etapa 1. Cada grupo poderá ajustá-la livremente.</p>' +
        '<p style="font-size:.8rem;color:var(--ink-3);margin:0">Alterações nesta missão não modificam grupos que já iniciaram a Etapa 1.</p>' +
        missaoFacHtml() +
        '<div class="aposta-frase" id="apostaPreviaMissaoFac" style="margin-top:0"></div>' +
        '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">' +
          '<button class="btn btn--sm" id="apostaSalvarMissao">' + (missaoBaseSalva ? 'Atualizar missão-base' : 'Salvar missão-base') + '</button>' +
          (missaoBaseSalva ? '<span class="aposta-salvo" id="apostaMissaoFacStatus">✓ Missão-base salva</span>' : '') +
          (missaoBaseSalva ? '<button type="button" class="aposta-mudanca-del" id="apostaRemoverMissaoFac">Remover missão-base</button>' : '') +
        '</div>' +

        '<h4 style="margin:8px 0 0">Grupos</h4>' +
        '<p style="font-size:.8rem;color:var(--ink-3);margin:0">Cada grupo pode ser formado por uma ou mais pessoas.</p>' +
        (Object.keys(grupos).length
          ? '<div class="aposta-fac-grupos">' + Object.keys(grupos).map(function (g) {
              var gr = grupos[g];
              var dadosAtuaisDoGrupo = cicloAtualDe(gr).dados;
              var feitas = ETAPAS.filter(function (e) { return etapaPreenchida(e.id, dadosAtuaisDoGrupo); }).length;
              var qtdCiclosDoGrupo = ((gr.ciclos || {}).porId) ? Object.keys(gr.ciclos.porId).length : 1;
              /* "X/9 etapas" sozinho não dizia se o grupo tinha acabado de
                 abrir a dinâmica ou estava parado no meio — o status ao
                 lado (não iniciado / em andamento / concluído) responde
                 isso de cara, sem precisar comparar o X com o 9. */
              var status = feitas === 0 ? 'não iniciado' : (feitas === ETAPAS.length ? 'concluído' : 'em andamento');
              var membros = Object.keys(gr.membros || {}).map(function (k) { return (gr.membros[k] || {}).name; }).filter(Boolean);
              return '<div class="aposta-fac-grupo">' +
                '<strong>' + esc(gr.nome || 'Grupo') + '</strong>' +
                '<span>' + feitas + '/' + ETAPAS.length + ' etapas · ' + status +
                  (qtdCiclosDoGrupo > 1 ? ' · ciclo ' + qtdCiclosDoGrupo : '') + '</span>' +
                /* "ninguém ainda" ficava perto do status de etapas
                   (não iniciado/em andamento/concluído) e lia como se
                   fosse sobre progresso — esta linha é sobre QUEM está
                   no grupo, informação diferente. */
                '<span class="aposta-fac-membros">' + esc(membros.join(', ') || 'sem participantes ainda') + '</span>' +
                '<button class="btn btn--sm aposta-fac-ver" data-grupo="' + esc(g) + '">Projetar</button>' +
              '</div>';
            }).join('') + '</div>'
          : '<p class="admin-empty" style="margin:0">Nenhum grupo ainda.</p>') +

        '<div style="display:flex;gap:8px;align-items:flex-end">' +
          '<label class="auth-label" style="margin:0;flex:1">Nome do grupo' +
            '<input type="text" id="apostaNovoGrupo" placeholder="Grupo 1" />' +
          '</label>' +
          '<button class="btn btn--sm" id="apostaCriarGrupo">Criar grupo</button>' +
        '</div>' +

        '<h4 style="margin:8px 0 0">Revelação</h4>' +
        '<p style="font-size:.8rem;color:var(--ink-3);margin:0">' +
          (_exec.revelado
            ? 'Revelado — vale para os 3 grupos de uma vez. O Mapa da Aposta de cada um já mostra a conexão com OKR; clique em "Projetar" num grupo para ver.'
            : 'Enquanto não for revelada, a interface não mostra os termos do final da dinâmica em lugar nenhum. Vale para os grupos todos de uma vez — o efeito aparece no Mapa da Aposta de cada um, não aqui neste painel.') +
        '</p>' +
        '<button class="btn btn--sm' + (_exec.revelado ? '' : ' btn--primary') + '" id="apostaToggleRevelar">' +
          (_exec.revelado ? 'Esconder de novo' : 'Revelar conexões') + '</button>' +

        '<h4 style="margin:8px 0 0">Execução</h4>' +
        '<p style="font-size:.8rem;color:var(--ink-3);margin:0">Iniciar uma nova execução encerra a atual (que continua disponível no histórico) e abre uma execução vazia para esta turma — nada do que os grupos escreveram é apagado.</p>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<button class="btn btn--sm" id="apostaExportar">↓ Exportar mapa (CSV)</button>' +
          '<button class="btn btn--sm" id="apostaReiniciar">Iniciar nova execução</button>' +
          '<button class="btn btn--sm" id="apostaVerHistorico">Histórico de execuções</button>' +
        '</div>' +
        '<div style="display:flex;justify-content:flex-end"><button class="btn admin-modal-cancel-btn" id="apostaFecharPainel">Fechar</button></div>';

      box.querySelector('#apostaFecharPainel').addEventListener('click', fechar);
      atualizarPreviaMissaoFac();

      /* As três escritas abaixo confirmam o erro antes de dizer que deu
         certo. Dizer "Missão-base salva" sobre uma gravação recusada é o
         defeito que a skill editar-e-salvar existe para impedir. */
      box.querySelectorAll('[data-mis]').forEach(function (el) {
        el.addEventListener('input', function () { aplicarMascara(el); atualizarPreviaMissaoFac(); });
      });
      box.querySelector('#apostaSalvarMissao').addEventListener('click', function () {
        var b = box.querySelector('#apostaSalvarMissao');
        var m = coletarMissaoFac();
        db().ref(caminhoExec() + '/missao').set(m, function (err) {
          if (err) { b.textContent = 'Não salvou — tente de novo'; return; }
          _exec.missao = m;
          b.textContent = 'Missão-base salva';
          setTimeout(function () { desenhar(); }, 1200);
        });
      });
      var btnRemoverMissaoFac = box.querySelector('#apostaRemoverMissaoFac');
      if (btnRemoverMissaoFac) {
        btnRemoverMissaoFac.addEventListener('click', function () {
          if (!confirm('Remover a missão-base? Grupos que já criaram sua própria missão não serão alterados. Novos grupos passarão a iniciar a Etapa 1 em branco.')) return;
          db().ref(caminhoExec() + '/missao').remove(function (err) {
            if (err) { avisar('Não consegui remover a missão-base. Tente de novo.', true); return; }
            _exec.missao = null;
            desenhar();
          });
        });
      }
      /* Fase 3 — proteção contra clique duplo: sem isso, dois cliques
         rápidos (ou os dois eventos de um duplo-clique físico) liam o
         mesmo _exec ainda não atualizado, geravam dois nomes-padrão
         iguais e criavam DOIS grupos — cada um com sua própria chave
         push(), nenhum "duplicado" no sentido de ter o mesmo id, mas
         duas linhas reais na turma para o que devia ser um grupo só.
         Mesmo padrão já usado em #apostaSeguir/comEscritaConfirmada:
         desabilita antes de gravar, só reabilita se der erro — no
         sucesso, comMissaoPreservada(desenhar) redesenha o painel
         inteiro com um botão novo, já habilitado. */
      box.querySelector('#apostaCriarGrupo').addEventListener('click', function () {
        var btnCriarGrupo = this;
        if (btnCriarGrupo.disabled) return;
        btnCriarGrupo.disabled = true;
        var nome = (box.querySelector('#apostaNovoGrupo').value || '').trim() ||
          ('Grupo ' + (Object.keys(_exec.grupos || {}).length + 1));
        var ref = db().ref(caminhoExec() + '/grupos').push();
        ref.set({ nome: nome, criadoEm: new Date().toISOString(), etapa: 'missao' }, function (err) {
          if (err) {
            btnCriarGrupo.disabled = false;
            avisar('Não consegui criar o grupo. Tente de novo.', true);
            return;
          }
          comMissaoPreservada(desenhar);
        });
      });
      box.querySelector('#apostaToggleRevelar').addEventListener('click', function () {
        db().ref(caminhoExec() + '/revelado').set(!_exec.revelado, function (err) {
          if (err) { avisar('Não consegui mudar a revelação. Tente de novo.', true); return; }
          comMissaoPreservada(desenhar);
        });
      });
      box.querySelector('#apostaReiniciar').addEventListener('click', function () {
        confirmarNovaExecucao(function () {
          fechar();
          _grupoId = null;
          criarExecucao();
        });
      });
      box.querySelector('#apostaExportar').addEventListener('click', function () { exportarCSV(); });
      box.querySelector('#apostaVerHistorico').addEventListener('click', function () { fechar(); abrirHistorico(); });
      box.querySelectorAll('.aposta-fac-ver').forEach(function (b) {
        b.addEventListener('click', function () {
          fechar();
          _grupoId = b.dataset.grupo;
          _grupo = (_exec.grupos || {})[_grupoId] || {};
          _dados = resolverCicloAtual().dados;
          _vendoMapa = true;
          render();
        });
      });
    }
    desenhar();
  }

  /* ══════════════════════════════════════════════════════════════
     FASE 2 — HISTÓRICO DE EXECUÇÕES (somente leitura)

     Este modal é DELIBERADAMENTE separado do resto da dinâmica: ele
     nunca lê nem escreve _execId, _exec, _grupoId, _grupo, _dados ou
     _vendoMapa — só variáveis locais, presas ao fechamento desta
     função, que desaparecem quando o modal fecha. Isso não é só
     estilo — é o que garante, por construção, as invariantes da
     Fase 2:

       · consultar/abrir/exportar uma execução histórica nunca altera
         "atual" (nenhuma linha aqui escreve em "apostas/.../atual",
         nem em execução nenhuma — é tudo leitura);
       · nada do histórico "vaza" para a execução em andamento: como
         este código nunca toca as variáveis globais que a dinâmica ao
         vivo usa, fechar o modal não deixa resquício nenhum — a tela
         de trás nunca soube que o histórico foi aberto;
       · não existe caminho de escrita: nenhum botão aqui chama
         salvarEtapa, avancar, criarExecucao ou qualquer outra função
         que grave no Firebase — "modo histórico" não é a ausência
         visual de botões de edição, é a ausência REAL deles.

     A lista inteira de execuções (apostas/<turma>/execucoes) é lida
     de uma vez, com .once() — não .on(): o histórico é uma fotografia
     do que já aconteceu, não precisa (nem deve) atualizar sozinho
     enquanto está aberto. Numa turma com histórico longo (a Fase 0
     encontrou uma com 24 execuções) isso é um único download, feito
     só quando a facilitadora pede para ver o histórico — nunca em
     carregamento automático nem repetido. */
  function abrirHistorico() {
    var overlay = document.createElement('div');
    /* aposta-historico-overlay: ".modal-box" é classe genérica (usada
       também pelo modal de login/cadastro escondido em index.html) —
       um seletor genérico ".modal-overlay .modal-box" pegaria aquele
       modal escondido em vez deste, exatamente o cuidado já registrado
       em confirmarRegistroDeResultados/confirmarNovaExecucao acima. */
    overlay.className = 'modal-overlay aposta-historico-overlay';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:10001';
    var box = document.createElement('div');
    box.className = 'modal-box';
    box.style.cssText = 'max-width:640px;width:94%;padding:26px;display:flex;flex-direction:column;gap:14px;max-height:86vh;overflow:auto';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function fechar() { document.body.removeChild(overlay); }

    box.innerHTML = '<p class="admin-empty" style="margin:0">Carregando histórico…</p>';

    /* Compatibilidade por leitura (definida na Fase 1, sem migração):
       execução apontada por "atual" é a ativa; todas as outras são
       históricas/encerradas — mesmo as que nunca tiveram `status`. */
    function statusDeExibicao(exec, execId) {
      if (exec.status) return exec.status;
      return execId === _execId ? 'ativa' : 'encerrada';
    }

    /* Número real quando existe; senão, a POSIÇÃO cronológica dela
       entre todas as execuções da turma (mais antiga = 1). Nunca
       grava nada — é só para exibição, marcado como estimativa. */
    function numeroDeExibicao(idsOrdenados, execucoes, execId) {
      var exec = execucoes[execId] || {};
      if (typeof exec.numero === 'number') return { numero: exec.numero, estimado: false };
      return { numero: idsOrdenados.indexOf(execId) + 1, estimado: true };
    }

    function idsPorCriadaEm(execucoes) {
      return Object.keys(execucoes).sort(function (a, b) {
        return String(execucoes[a].criadaEm || '').localeCompare(String(execucoes[b].criadaEm || ''));
      });
    }

    function linhaExecucaoHtml(execucoes, idsOrdenados, execId) {
      var exec = execucoes[execId] || {};
      var st = statusDeExibicao(exec, execId);
      var n = numeroDeExibicao(idsOrdenados, execucoes, execId);
      var qtdGrupos = Object.keys(exec.grupos || {}).length;
      return '<div class="aposta-fac-grupo aposta-hist-item" data-exec="' + esc(execId) + '">' +
        '<strong>Execução nº ' + n.numero + (n.estimado ? ' (estimado pela ordem)' : '') + '</strong>' +
        '<span>' + (st === 'ativa' ? 'Ativa' : 'Encerrada') + '</span>' +
        '<span>Início: ' + esc(exec.criadaEm ? formatarDataHora(exec.criadaEm) : 'sem data registrada') + '</span>' +
        (exec.encerradaEm ? '<span>Encerrada em: ' + esc(formatarDataHora(exec.encerradaEm)) + '</span>' : '') +
        '<span>Iniciada por: ' + esc(exec.criadaPorNome || exec.criadaPor || 'não registrado') + '</span>' +
        ((exec.encerradaPorNome || exec.encerradaPor)
          ? '<span>Encerrada por: ' + esc(exec.encerradaPorNome || exec.encerradaPor) + '</span>' : '') +
        '<span class="aposta-fac-membros">' + qtdGrupos + ' grupo' + (qtdGrupos !== 1 ? 's' : '') + '</span>' +
        '<button class="btn btn--sm aposta-hist-abrir" data-exec="' + esc(execId) + '">Ver esta execução</button>' +
      '</div>';
    }

    function desenharLista(execucoes) {
      var idsOrdenados = idsPorCriadaEm(execucoes);
      var atuais = idsOrdenados.filter(function (id) { return id === _execId; });
      var anteriores = idsOrdenados.filter(function (id) { return id !== _execId; }).slice().reverse();

      box.innerHTML =
        '<h3 style="font-family:var(--font-head);letter-spacing:.05em;color:var(--ink);margin:0">Histórico de execuções</h3>' +
        '<p style="font-size:.82rem;color:var(--ink-3);margin:0">' + esc(_turma.label) + ' — somente leitura</p>' +
        '<h4 style="margin:8px 0 0">Execução atual</h4>' +
        (atuais.length
          ? '<div class="aposta-fac-grupos">' + atuais.map(function (id) { return linhaExecucaoHtml(execucoes, idsOrdenados, id); }).join('') + '</div>'
          : '<p class="admin-empty" style="margin:0">Nenhuma execução em andamento.</p>') +
        '<h4 style="margin:8px 0 0">Execuções anteriores</h4>' +
        (anteriores.length
          ? '<div class="aposta-fac-grupos">' + anteriores.map(function (id) { return linhaExecucaoHtml(execucoes, idsOrdenados, id); }).join('') + '</div>'
          : '<p class="admin-empty" style="margin:0">Nenhuma execução anterior ainda.</p>') +
        '<div style="display:flex;justify-content:flex-end"><button class="btn admin-modal-cancel-btn" id="apostaHistFechar">Fechar</button></div>';

      box.querySelector('#apostaHistFechar').addEventListener('click', fechar);
      box.querySelectorAll('.aposta-hist-abrir').forEach(function (b) {
        b.addEventListener('click', function () { desenharDetalhe(execucoes, idsOrdenados, b.dataset.exec); });
      });
    }

    function desenharDetalhe(execucoes, idsOrdenados, execId) {
      var exec = execucoes[execId] || {};
      var grupos = exec.grupos || {};
      var gids = Object.keys(grupos);
      var n = numeroDeExibicao(idsOrdenados, execucoes, execId);
      var rotuloArquivo = 'exec' + n.numero;

      box.innerHTML =
        '<h3 style="font-family:var(--font-head);letter-spacing:.05em;color:var(--ink);margin:0">Execução nº ' + n.numero + ' — SOMENTE LEITURA</h3>' +
        '<p style="font-size:.82rem;color:var(--ink-3);margin:0">' + esc(_turma.label) + '</p>' +
        '<h4 style="margin:8px 0 0">Grupos</h4>' +
        (gids.length
          ? '<div class="aposta-fac-grupos">' + gids.map(function (g) {
              return '<div class="aposta-fac-grupo">' +
                '<strong>' + esc(grupos[g].nome || 'Grupo') + '</strong>' +
                '<button class="btn btn--sm aposta-hist-ver-grupo" data-grupo="' + esc(g) + '">Ver mapa</button>' +
              '</div>';
            }).join('') + '</div>'
          : '<p class="admin-empty" style="margin:0">Esta execução não chegou a ter grupos.</p>') +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<button class="btn btn--sm" id="apostaHistExportar">↓ Exportar esta execução (CSV)</button>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;gap:8px">' +
          '<button class="btn" id="apostaHistVoltar">← Voltar ao histórico</button>' +
          '<button class="btn admin-modal-cancel-btn" id="apostaHistFechar">Fechar</button>' +
        '</div>';

      box.querySelector('#apostaHistFechar').addEventListener('click', fechar);
      box.querySelector('#apostaHistVoltar').addEventListener('click', function () { desenharLista(execucoes); });
      /* exportarCSV(grupos, rotulo) só GERA um arquivo local a partir do
         que já foi lido — não escreve nada de volta no Firebase, e não
         toca a execução atual (_exec) de jeito nenhum. */
      box.querySelector('#apostaHistExportar').addEventListener('click', function () {
        exportarCSV(grupos, rotuloArquivo);
      });
      box.querySelectorAll('.aposta-hist-ver-grupo').forEach(function (b) {
        b.addEventListener('click', function () { desenharMapaGrupo(execucoes, idsOrdenados, execId, b.dataset.grupo); });
      });
    }

    /* Fase 4: um grupo histórico pode ter tido vários ciclos — mostra
       todos, cada um com seus próprios cards, exatamente como o Mapa
       ao vivo (ver cardsDoCicloHtml/cicloTituloHtml), só que aqui TUDO
       é <div>, nunca <button> — nenhum ciclo de uma execução histórica
       é editável, nem o "atual" dela (ver nota no topo desta função:
       não há sequer um caminho de escrita nesta tela inteira). Grupo
       sem ciclos/ (sempre teve um só) continua mostrando exatamente o
       que já mostrava antes desta fase. */
    function cardsDoCicloSomenteLeituraHtml(ciclo) {
      var inicioIdx = ciclo.pontoDeReinicio ? indiceEtapa(ciclo.pontoDeReinicio) : indiceEtapa('problema');
      return ETAPAS.slice(inicioIdx).map(function (e, i) {
        var texto = resumoEtapa(e.id, ciclo.dados);
        return (i ? '<div class="aposta-mapa-seta">↓</div>' : '') +
          '<div class="aposta-mapa-card is-somente-leitura' + (texto ? '' : ' is-vazio') + '">' +
            '<span class="aposta-mapa-rot">' + esc(e.titulo) + '</span>' +
            '<span class="aposta-mapa-txt">' + esc(texto || 'não preenchido') + '</span>' +
          '</div>';
      }).join('');
    }

    function desenharMapaGrupo(execucoes, idsOrdenados, execId, grupoId) {
      var exec = execucoes[execId] || {};
      var grupo = (exec.grupos || {})[grupoId] || {};
      var ciclos = listarCiclosDoGrupo(grupo);
      var multiCiclo = ciclos.length > 1;
      /* Missão/Sintoma nunca são ponto de reinício — todo ciclo carrega
         a mesma cópia herdada; ler do último é só para refletir a
         eventual correção mais recente, se algum dia acontecer. */
      var dadosContexto = ciclos[ciclos.length - 1].dados;

      box.innerHTML =
        '<h3 style="font-family:var(--font-head);letter-spacing:.05em;color:var(--ink);margin:0">Mapa histórico — SOMENTE LEITURA</h3>' +
        '<p style="font-size:.82rem;color:var(--ink-3);margin:0">' + esc(_turma.label) + (grupo.nome ? ' · ' + esc(grupo.nome) : '') + '</p>' +
        '<div class="aposta-mapa">' +
          ['missao', 'sintoma'].map(function (id, i) {
            var texto = resumoEtapa(id, dadosContexto);
            var e = etapaPorId(id);
            return (i ? '<div class="aposta-mapa-seta">↓</div>' : '') +
              '<div class="aposta-mapa-card is-somente-leitura' + (texto ? '' : ' is-vazio') + '">' +
                '<span class="aposta-mapa-rot">' + esc(e.titulo) + '</span>' +
                '<span class="aposta-mapa-txt">' + esc(texto || 'não preenchido') + '</span>' +
              '</div>';
          }).join('') +
          ciclos.map(function (ciclo) {
            return '<div class="aposta-mapa-seta">↓</div>' +
              (multiCiclo ? cicloTituloHtml(ciclo) : '') +
              cardsDoCicloSomenteLeituraHtml(ciclo);
          }).join('') +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;gap:8px">' +
          '<button class="btn" id="apostaHistVoltarDetalhe">← Voltar aos grupos</button>' +
          '<button class="btn admin-modal-cancel-btn" id="apostaHistFechar">Fechar</button>' +
        '</div>';

      box.querySelector('#apostaHistFechar').addEventListener('click', fechar);
      box.querySelector('#apostaHistVoltarDetalhe').addEventListener('click', function () { desenharDetalhe(execucoes, idsOrdenados, execId); });
    }

    /* Única leitura desta tela inteira: .once(), nunca .on(). Nada aqui
       assina um listener, então fechar o modal não deixa nada "ouvindo"
       para trás, e nada é reaproveitado na execução em andamento. */
    db().ref('apostas/' + _turma.key + '/execucoes').once('value', function (snap) {
      var execucoes = snap.val() || {};
      desenharLista(execucoes);
    }, function () {
      box.innerHTML = '<p class="admin-empty" style="margin:0">Não consegui carregar o histórico. Tente de novo.</p>' +
        '<div style="display:flex;justify-content:flex-end"><button class="btn admin-modal-cancel-btn" id="apostaHistFechar">Fechar</button></div>';
      box.querySelector('#apostaHistFechar').addEventListener('click', fechar);
    });
  }

  /* Fase 2 (Histórico de Execuções): gruposOverride/rotuloArquivo
     existem só para exportar uma execução HISTÓRICA (ver
     abrirHistorico) sem duplicar esta função — passando ambos, exporta
     os grupos dessa execução; sem passar nada, continua exportando a
     execução atual exatamente como antes. Nenhum dos dois caminhos
     escreve no Firebase — é geração de arquivo local, no navegador.

     Fase 4: a coluna Ciclo (e Ponto de reinício, quando houver um)
     impede que Ciclo 1 e Ciclo 2 sejam achatados como se fossem a
     mesma aposta (item 36 do pedido) — cada ciclo gera seu próprio
     bloco de linhas, a partir dos DADOS DAQUELE ciclo (nunca do
     "atual"), então hipótese/avaliação/decisão de cada rodada saem
     naturalmente distintas, sem precisar de colunas extra dedicadas a
     elas: já são o conteúdo das etapas Hipótese/Evidência/Decisão de
     cada bloco. Grupo sem ciclos/ continua exportando exatamente uma
     linha "Ciclo 1" por etapa, igual a antes desta fase. */
  function exportarCSV(gruposOverride, rotuloArquivo) {
    var grupos = gruposOverride || _exec.grupos || {};
    var linhas = [['Grupo', 'Ciclo', 'Ponto de reinício', 'Etapa', 'Conteúdo']];
    Object.keys(grupos).forEach(function (g) {
      var nomeGrupo = grupos[g].nome || g;
      listarCiclosDoGrupo(grupos[g]).forEach(function (ciclo) {
        var rotuloPonto = ciclo.pontoDeReinicio ? ((etapaPorId(ciclo.pontoDeReinicio) || {}).curto || ciclo.pontoDeReinicio) : '';
        ETAPAS.forEach(function (e) {
          linhas.push([nomeGrupo, ciclo.numero, rotuloPonto, e.curto, resumoEtapa(e.id, ciclo.dados)]);
        });
      });
    });
    var csv = linhas.map(function (l) {
      return l.map(function (c) { return '"' + String(c || '').replace(/"/g, '""') + '"'; }).join(';');
    }).join('\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'aposta-' + _turma.key + (rotuloArquivo ? '-' + rotuloArquivo : '') + '.csv';
    a.click();
  }

  /* ══════════════════════════════════════════════════════════════
     BOOT
     ══════════════════════════════════════════════════════════════ */
  window.faAposta = {
    montarEntrada: montarEntrada,
    fechar: fecharDinamica,
    /* expostos para os testes automatizados da aba Testes */
    _validar: validar,
    _resumo: function (id, dados) { return resumoEtapa(id, dados); },
    _etapas: function () { return ETAPAS.map(function (e) { return e.id; }); },
    _texto: function () { return textoDaAposta(); },
    /* Só para os testes de concorrência e falha da Fase 1 (chamadas
       quase simultâneas de "Iniciar nova execução", e falhas
       provocadas em pontos específicos via window.__CFG.fail) —
       chamar isso direto, sem passar pelo modal de confirmação, é o
       único jeito de provar de verdade que duas chamadas disputando o
       mesmo lock nunca resultam em duas execuções "ativa", e que uma
       falha antes do update() final nunca deixa "atual" apontando
       para uma execução inexistente. */
    _criarExecucao: function () { return criarExecucao(); },
    /* Só para o teste da identidade do lock (Fase 1): prova direto que
       liberarLock() com um token que não é mais o do lock atual não
       remove nada — sem isso, teria que orquestrar uma corrida real
       entre três tentativas só para chegar nesse ponto. */
    _liberarLock: function (token) { return liberarLock(token); },
    /* Fase 4 — mesmo motivo do par acima, agora para o lock de
       criação de ciclo: provar direto que duas chamadas quase
       simultâneas de criarCiclo() nunca resultam em dois ciclos
       sucessores para a mesma decisão, e que liberarLockCiclo() com um
       token velho não remove o lock de uma tentativa mais nova. */
    _criarCiclo: function (pontoDeReinicio, decisaoOrigem, cb) { return criarCiclo(pontoDeReinicio, decisaoOrigem, cb); },
    _liberarLockCiclo: function (token) { return liberarLockCiclo(token); },
    /* Fase 4 — prova direta da cascata ao editar um campo herdado e do
       fix de dataDecisao: chamar salvarEtapa() sem depender de digitar
       em cada campo do formulário e esperar o debounce de 600ms. */
    _salvarEtapa: function (etapaId, dados, redesenhar, cb) { return salvarEtapa(etapaId, dados, redesenhar, cb); }
  };

  window.addEventListener('fa-auth-ready', montarEntrada);
  window.addEventListener('fa-auth-change', montarEntrada);
  if (window.faRouter) window.faRouter.onPageInit('treinamento', montarEntrada);
})();
