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
   apostas/<turmaKey>/atual                  → id da execução em curso
   apostas/<turmaKey>/execucoes/<execId>     → uma execução inteira
     · missao, revelado, encerrada, quem criou e quando
     · grupos/<grupoId> → nome, membros, etapa, dados de cada etapa
   Reiniciar a dinâmica cria uma execução NOVA e deixa a anterior
   intacta: o que um grupo escreveu numa oficina não pode sumir
   porque outra turma usou a mesma tela depois.
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
        { chave: 'prazo', tipo: 'quantidade', rotulo: 'Prazo', curto: 'o prazo', placeholder: '90', unidadePadrao: 'dias' }
      ],
      molde: [{ c: 'verbo' }, { c: 'oQue' }, { c: 'contexto' }, 'em', { c: 'prazo' }, '.']
    },
    {
      id: 'sintoma',
      titulo: 'SINTOMA',
      curto: 'Sintoma',
      pergunta: 'O que vemos hoje?',
      auxiliar: 'Comece pelo que é possível observar na realidade. Ainda não tente explicar por que isso acontece.',
      exemplo: 'Hoje observamos que muitos participantes entram em contato para saber em que etapa está a concessão.',
      dica: 'Sintoma = o que estamos vendo acontecer. Se duas pessoas olhassem para a mesma realidade, as duas veriam isso.',
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
      auxiliar: 'Agora transforme o sintoma observado na situação indesejada que ele revela.',
      exemplo: 'Os participantes não conseguem acompanhar o andamento da concessão com autonomia, evidenciado pelos frequentes contatos para saber em que etapa está o processo.',
      dica: 'Sintoma = o que vemos. Problema = a situação indesejada que esse sintoma revela.',
      dependeDe: 'sintoma',
      campos: [
        { chave: 'quem', tipo: 'input', rotulo: 'Quem é afetado', curto: 'quem é afetado', placeholder: 'Os participantes' },
        /* A concordância é de quem escreve: "O participante não consegue" e
           "Os participantes não conseguem" são as duas corretas, e o site não
           tem como adivinhar qual. Fixar uma delas fazia o mapa sair com o
           verbo errado — dois cliques resolvem sem pedir para digitar. */
        { chave: 'verbo', tipo: 'variantes', rotulo: 'Verbo', opcoes: ['não consegue', 'não conseguem'] },
        { chave: 'naoConsegue', tipo: 'input', rotulo: 'O quê', curto: 'o que não consegue', placeholder: 'acompanhar o andamento com autonomia' },
        { chave: 'evidenciadoPor', tipo: 'textarea', rotulo: 'O que evidencia isso', curto: 'o que evidencia isso', placeholder: 'contatos frequentes para saber a etapa' }
      ],
      molde: [{ c: 'quem' }, { c: 'verbo' }, { c: 'naoConsegue' }, ', evidenciado por', { c: 'evidenciadoPor' }, '.']
    },
    {
      id: 'mudancas',
      titulo: 'MUDANÇAS MENSURÁVEIS',
      curto: 'Mudanças mensuráveis',
      pergunta: 'O que queremos ver diferente e quanto?',
      auxiliar: 'Agora transforme a melhoria desejada em uma mudança que possa ser observada e medida.',
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
      exemplo: 'Acreditamos que isso acontece porque as informações sobre etapa atual e próximo passo não são suficientemente claras, pois muitas solicitações recebidas são perguntas sobre status e prazo.',
      dica: 'Hipótese = nossa explicação atual para o problema. Ela ainda precisa ser testada.',
      dependeDe: 'problema',
      campos: [
        { chave: 'causa', tipo: 'textarea', rotulo: 'Causa provável', curto: 'a causa provável', placeholder: 'as informações sobre etapa atual não são claras' },
        { chave: 'indicio', tipo: 'textarea', rotulo: 'Qual indício temos?', curto: 'o indício', placeholder: 'muitas perguntas recebidas são sobre status e prazo' }
      ],
      molde: ['Acreditamos que isso acontece porque', { c: 'causa' }, ', pois', { c: 'indicio' }, '.']
    },
    {
      id: 'ideia',
      titulo: 'IDEIA DE SOLUÇÃO',
      curto: 'Ideia de solução',
      pergunta: 'O que poderíamos fazer a respeito?',
      exemplo: 'Poderíamos dar ao participante mais visibilidade sobre o andamento da concessão, para que ele consiga se orientar com mais autonomia.',
      rodape: 'A hipótese diz o que acreditamos estar acontecendo. A ideia de solução diz o que imaginamos que podemos fazer a respeito.',
      dica: 'Ainda não é hora de decidir tecnologia. O que importa é a mudança que a ideia pretende provocar.',
      dependeDe: 'hipotese',
      legado: 'texto',
      campos: [
        { chave: 'acao', tipo: 'textarea', rotulo: 'Ação ou abordagem', curto: 'a ação', placeholder: 'dar ao participante mais visibilidade sobre o andamento' },
        { chave: 'mudanca', tipo: 'textarea', rotulo: 'Mudança que pretendemos provocar', curto: 'a mudança pretendida', placeholder: 'que ele consiga se orientar com mais autonomia' }
      ],
      molde: ['Poderíamos', { c: 'acao' }, 'para', { c: 'mudanca' }, '.']
    },
    {
      id: 'experimento',
      titulo: 'E — EXPERIMENTO',
      curto: 'Experimento',
      pergunta: 'Como vamos testar essa ideia?',
      exemplo: 'Durante 3 semanas, com 50 participantes, vamos enviar a mensagem de status e medir quantos contatos sobre andamento eles realizam.',
      rodape: 'O experimento não é a solução completa. É a forma organizada de testar uma versão simplificada da ideia.',
      dica: 'Um experimento precisa de três coisas para valer: com quem, por quanto tempo e o que será medido.',
      dependeDe: 'ideia',
      campos: [
        { chave: 'duracao', tipo: 'quantidade', rotulo: 'Duração', curto: 'quanto tempo', placeholder: '3', unidadePadrao: 'semanas' },
        { chave: 'quantidade', tipo: 'input', rotulo: 'Quantidade', curto: 'quantas pessoas', placeholder: '50' },
        { chave: 'comQuem', tipo: 'input', rotulo: 'Com quem', curto: 'com quem', placeholder: 'participantes em concessão' },
        { chave: 'oQue', tipo: 'textarea', rotulo: 'O que será feito', curto: 'o que será feito', placeholder: 'enviar a mensagem de status' },
        { chave: 'medida', tipo: 'textarea', rotulo: 'O que será medido', curto: 'o que será medido', placeholder: 'nº de contatos sobre andamento' },
        { chave: 'responsavel', tipo: 'input', rotulo: 'Responsável', placeholder: 'nome' },
        { chave: 'custo', tipo: 'moeda', rotulo: 'Custo estimado', placeholder: 'R$ 0,00' }
      ],
      molde: ['Durante', { c: 'duracao' }, ', com', { c: 'quantidade' }, { c: 'comQuem' }, ', vamos', { c: 'oQue' }, 'e medir', { c: 'medida' }, '.']
    },
    {
      id: 'evidencia',
      titulo: 'E — EVIDÊNCIA',
      curto: 'Evidência',
      pergunta: 'O que aconteceu de verdade?',
      auxiliar: 'Antes de rodar o experimento, registre o que vocês esperam. Depois, o que realmente aconteceu.',
      exemplo: 'Esperávamos redução dos contatos. Observamos 25% menos contatos no grupo testado. Portanto, nossa hipótese foi parcialmente sustentada.',
      rodape: 'O objetivo do experimento é aprender, não provar que estávamos certos.',
      dica: 'A evidência não julga quem teve a ideia. Ela só diz o que a realidade respondeu.',
      dependeDe: 'experimento',
      campos: [
        { chave: 'esperado', tipo: 'textarea', rotulo: 'O que esperamos observar', curto: 'o que esperávamos', antes: true, placeholder: 'redução dos contatos sobre andamento' },
        { chave: 'observado', tipo: 'textarea', rotulo: 'O que realmente aconteceu', curto: 'o que observamos', placeholder: '25% menos contatos no grupo testado' },
        { chave: 'medir', tipo: 'textarea', rotulo: 'O que vamos medir', antes: true, placeholder: 'nº de contatos por semana' }
      ],
      escolha: {
        chave: 'classificacao',
        rotulo: 'Nossa hipótese foi:',
        curto: 'como a hipótese ficou',
        opcoes: ['Sustentada', 'Parcialmente sustentada', 'Não sustentada']
      },
      molde: ['Esperávamos', { c: 'esperado' }, '. Observamos', { c: 'observado' },
              '. Portanto, nossa hipótese foi', { escolha: true, baixa: true }, '.']
    },
    {
      id: 'decisao',
      titulo: 'D — DECISÃO',
      curto: 'Decisão',
      pergunta: 'O que fazemos com o que aprendemos?',
      exemplo: 'Com base na evidência, vamos ajustar e testar novamente — ajustar a comunicação e repetir o teste com um grupo maior.',
      dica: 'A decisão precisa nascer da evidência registrada — não da preferência de quem defende a ideia.',
      dependeDe: 'evidencia',
      escolha: {
        chave: 'decisao',
        rotulo: 'Decisão',
        curto: 'a decisão',
        opcoes: ['Ampliar', 'Ajustar e testar novamente', 'Abandonar essa ideia', 'Formular nova hipótese', 'Investigar mais']
      },
      campos: [
        { chave: 'proximaAcao', tipo: 'textarea', rotulo: 'Próxima ação', curto: 'a próxima ação', placeholder: 'ajustar a comunicação e repetir o teste com um grupo maior' },
        { chave: 'responsavel', tipo: 'input', rotulo: 'Responsável', placeholder: 'nome' },
        /* "Prazo" aqui é DURAÇÃO ("em quanto tempo"), não uma data — o
           que as próprias execuções antigas mostravam era "10 dias", não
           "30/10/2026". Data de reavaliação é o outro caso: um DIA
           marcado no calendário para reencontrar o grupo, esse sim fica
           bem como data. */
        { chave: 'prazo', tipo: 'quantidade', rotulo: 'Prazo', curto: 'o prazo', placeholder: '10', unidadePadrao: 'dias' },
        { chave: 'reavaliacao', tipo: 'data', rotulo: 'Data de reavaliação', placeholder: 'dd/mm/aaaa' },
        /* A próxima hipótese é uma hipótese: ganha o mesmo apoio de
           preenchimento da etapa 5, senão volta a ser um campo em branco
           pedindo uma frase que a pessoa acabou de aprender a montar. */
        { chave: 'proxHipCausa', tipo: 'textarea', rotulo: 'Causa provável', placeholder: 'a mensagem não chega a quem está em análise' },
        { chave: 'proxHipIndicio', tipo: 'textarea', rotulo: 'Qual indício temos?', placeholder: 'os contatos caíram só no grupo que recebeu a mensagem' }
      ],
      /* O traço solto ("vamos ampliar — a comunicação com um grupo maior")
         não dizia que relação as duas partes têm. A decisão é uma coisa;
         o que se faz a seguir é outra, e agora a frase diz isso. */
      molde: ['Com base na evidência, vamos', { escolha: true, baixa: true }, '. Próxima ação:', { c: 'proximaAcao' }, '.'],
      grupos: [{
        rotulo: 'Próxima hipótese — só quando a decisão pede uma explicação nova',
        dica: 'As duas lacunas abaixo formam <b>uma frase só</b>: a hipótese do próximo ciclo. ' +
          'O critério é a decisão que vocês acabaram de tomar — se ela recomeça a investigação ' +
          '(<b>ajustar e testar novamente</b>, <b>formular nova hipótese</b> ou <b>investigar mais</b>), ' +
          'o próximo ciclo precisa de uma explicação nova para testar. Se a decisão encerra a pergunta ' +
          '(<b>ampliar</b> ou <b>abandonar essa ideia</b>), deixe em branco.',
        /* A decisão escolhida decide se este bloco se aplica — dizer isso na
           hora poupa o grupo de reler o critério e concluir sozinho. */
        aplicaQuando: ['Ajustar e testar novamente', 'Formular nova hipótese', 'Investigar mais'],
        dependeDaEscolha: 'decisao',
        legado: 'proximaHipotese',
        molde: ['Acreditamos que isso acontece porque', { c: 'proxHipCausa' }, ', pois', { c: 'proxHipIndicio' }, '.']
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
      var prob = normalizar([d.quem, d.naoConsegue, d.evidenciadoPor].join(' '));
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

    if (etapaId === 'experimento') {
      var faltando = [];
      if (!normalizar(d.comQuem) && !normalizar(d.quantidade)) faltando.push('com quem / quantas pessoas');
      if (!normalizar(d.duracao)) faltando.push('por quanto tempo');
      if (!normalizar(d.medida)) faltando.push('o que será medido');
      if (faltando.length) {
        avisos.push('Para o experimento poder ser executado, ainda falta: ' + faltando.join('; ') + '.');
      }
    }

    if (etapaId === 'evidencia') {
      var esp = normalizar(d.esperado), obs = normalizar(d.observado);
      if (esp && obs && esp === obs) {
        avisos.push('O que foi observado está igual ao que era esperado. Descreva o que a realidade mostrou, com seus números.');
      }
    }

    if (etapaId === 'decisao') {
      var temEvidencia = normalizar((_dados.evidencia || {}).observado);
      if (!temEvidencia) {
        avisos.push('A decisão precisa se apoiar na evidência. Volte e registre o que realmente aconteceu no experimento.');
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
        return ['indicador', 'atual', 'meta', 'unidade', 'prazo'].some(function (k) { return normalizar(m[k]); });
      });
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

  /* ── Mudanças mensuráveis: a mesma ideia, uma frase por item ── */
  var MUDANCA_MOLDE = [
    { c: 'direcao', rotulo: 'a direção' },
    { c: 'indicador', rotulo: 'o indicador' },
    'de', { c: 'atual', rotulo: 'a situação atual' }, { c: 'unidade', opcional: true },
    'para', { c: 'meta', rotulo: 'a meta' }, { c: 'unidade', opcional: true },
    'em', { c: 'prazo', rotulo: 'o prazo' }, '.'
  ];
  function partesMudanca(m) {
    m = m || {};
    return MUDANCA_MOLDE.map(function (p) {
      if (typeof p === 'string') return { tipo: 'fixo', txt: p };
      var val = String(m[p.c] == null ? '' : m[p.c]).trim();
      if (p.c === 'direcao') return { tipo: 'valor', txt: val || 'Aumentar', chave: 'direcao' };
      if (p.c === 'prazo' && val) val = val + ' ' + unidadeFlexionada(m.prazoUnidade, val);
      if (val) return { tipo: 'valor', txt: val, chave: p.c };
      return { tipo: 'vazio', rotulo: p.rotulo || p.c, chave: p.c, opcional: !!p.opcional };
    });
  }
  function fraseMudanca(m) {
    return juntarPartes(partesMudanca(m), function (p) { return p.opcional ? '' : '—'; });
  }

  /* O que vai no card do mapa, no card de conexão e no CSV. Vazio
     quando o grupo ainda não escreveu nada naquela etapa. */
  function resumoEtapa(etapaId, dados) {
    var d = (dados || {})[etapaId] || {};
    if (etapaId === 'mudancas') return (d.itens || []).map(fraseMudanca).join(' ');
    var etapa = etapaPorId(etapaId);
    if (!etapa || !etapaPreenchida(etapaId, dados)) return '';
    /* Execuções anteriores guardaram a etapa num campo de texto só.
       Enquanto as lacunas novas estiverem vazias, é esse texto que a
       pessoa escreveu — mostrá-lo é o mínimo para não parecer que a
       dinâmica apagou o que ela tinha feito. */
    if (etapa.legado && normalizar(d[etapa.legado]) && !temLacunaPreenchida(etapa, d)) {
      return String(d[etapa.legado]).trim();
    }
    return juntarPartes(partesDaFrase(etapa, d), function (p) { return p.opcional ? '' : '—'; });
  }

  function temLacunaPreenchida(etapa, d) {
    return partesDaFrase(etapa, d).some(function (p) { return p.tipo === 'valor' && !p.variante; });
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
        _dados = _grupo.dados || {};
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

  function criarExecucao() {
    var s = sessao();
    if (!s) return;
    var ref = db().ref('apostas/' + _turma.key + '/execucoes').push();
    var agora = new Date().toISOString();
    ref.set({
      criadaEm: agora,
      criadaPor: s.email,
      criadaPorNome: s.name || s.email,
      turmaKey: _turma.key,
      turmaLabel: _turma.label,
      eventoKey: _turma.eventoKey || '',
      missao: '',
      revelado: false,
      encerrada: false
    }, function (err) {
      if (err) { avisar('Não consegui abrir a dinâmica. Nada foi criado — tente de novo.', true); return; }
      /* "atual" é o que faz os outros enxergarem esta execução: se ele
         não gravar, a facilitadora acha que abriu e a sala continua sem
         ver nada. */
      db().ref('apostas/' + _turma.key + '/atual').set(ref.key, function (err2) {
        if (err2) { avisar('A dinâmica foi criada, mas não consegui publicá-la para a turma. Tente de novo.', true); return; }
        _execId = ref.key;
        ouvirExecucao();
      });
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
    _dados = _grupo.dados || {};
    _etapaAtual = _grupo.etapa || 'missao';
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
    var alcancado = Math.max(indiceEtapa(_etapaAtual), _grupo && _grupo.etapa ? indiceEtapa(_grupo.etapa) : 0);
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
  function cardConexao(etapaId) {
    var origem = etapaPorId(etapaId);
    var texto = resumoEtapa(etapaId, _dados);
    if (!origem || !texto) return '';
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
      : '<span class="aposta-campo-rot">' + esc(c.rotulo) +
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
  function variantePicker(atributo, chave, opcoes, valor, rotulo, id, classeExtra, opcional) {
    var v = opcional ? String(valor == null ? '' : valor).trim() : valorVariante({ opcoes: opcoes }, valor);
    return '<span class="aposta-variante' + (classeExtra ? ' ' + classeExtra : '') + '">' +
      '<input type="text"' + (id ? ' id="' + esc(id) + '"' : '') +
        ' ' + atributo + '="' + esc(chave) + '" class="aposta-campo-input aposta-variante-input"' +
        ' value="' + esc(v) + '"' +
        (opcional ? ' placeholder="' + esc((opcoes || [])[0] || '') + '"' : '') +
        ' aria-label="' + esc(rotulo) + '" />' +
      '<span class="aposta-variante-chips">' +
        (opcoes || []).map(function (o) {
          return '<button type="button" class="aposta-variante-chip' + (v === o ? ' is-ativa' : '') + '" data-valor="' + esc(o) + '">' + esc(o) + '</button>';
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
  function semPreposicaoDupla(fixo, valorSeguinte) {
    var v = String(valorSeguinte == null ? '' : valorSeguinte).trim();
    if (!v || !/\bde$/i.test(fixo)) return fixo;
    return PREP_CONTRAIDA.test(v) ? fixo.replace(/\s*de\s*$/i, '') : fixo;
  }

  function lacunaHtml(etapa, p, d, usados, semRotulo) {
    if (p.escolha) { usados['@escolha'] = 1; return escolhaHtml(etapa.escolha, d, semRotulo); }
    var c = campoPorChave(etapa, p.c);
    if (!c) return '';
    usados[c.chave] = 1;
    if (c.tipo === 'quantidade') usados[chaveUnidade(c.chave)] = 1;
    if (c.tipo === 'variantes') return varianteHtml(c, d[p.c]);
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
          out.push('<div class="aposta-par' + classeDoPar(etapa, seguinte) + '">' +
            '<span class="aposta-molde-fixo">' + esc(t) + '</span>' +
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

  /* Diz, com a decisão já escolhida, se o bloco se aplica — em vez de
     deixar o grupo reler o critério e concluir sozinho. */
  function avisoDaEscolha(g, d) {
    if (!g.aplicaQuando || !g.dependeDaEscolha) return '';
    var escolhido = (d || {})[g.dependeDaEscolha];
    if (!escolhido) return '';
    return g.aplicaQuando.indexOf(escolhido) !== -1
      ? 'A decisão de vocês (' + escolhido.toLowerCase() + ') pede uma próxima hipótese.'
      : 'Com a decisão de vocês (' + escolhido.toLowerCase() + '), este bloco pode ficar em branco.';
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

    /* Blocos guiados que não entram na frase da etapa, mas também são
       frases (hoje: a próxima hipótese). */
    (etapa.grupos || []).forEach(function (g) {
      var blocos = blocosDoMolde(etapa, g.molde, d, usados);
      var vazio = !(g.molde || []).some(function (p) {
        return typeof p !== 'string' && p.c && String(d[p.c] || '').trim();
      });
      html += '<div class="aposta-grupo">' +
        '<p class="aposta-grupo-rot">' + esc(g.rotulo) + '</p>' +
        (g.dica ? '<p class="aposta-grupo-dica">' + g.dica +
          '<span class="aposta-grupo-agora" id="apostaGrupoAgora"> ' + esc(avisoDaEscolha(g, d)) + '</span></p>' : '') +
        '<div class="aposta-molde aposta-molde--grupo">' + blocos + '</div>' +
        (g.legado ? legadoHtml(g.legado, d, vazio) : '') +
      '</div>';
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

    /* "Esperávamos" pede de novo A MUDANÇA MENSURÁVEL que o grupo já
       registrou — "esperávamos" é literalmente a mudança que se queria
       ver (com os números: "de 1000 para 700"), não só o nome da
       métrica que o Experimento vai medir, que não carrega expectativa
       nenhuma. Serve só de ponto de partida: nasce editável, e o que o
       grupo mudar é o que fica salvo (coletar() lê o campo da tela,
       nunca este valor).

       "Vazio" inclui o caso de o campo ainda guardar só o próprio
       exemplo (dica) como se fosse resposta — sobra de quando o campo
       ainda não vinha preenchido e alguém digitou exatamente o que via
       ali. Sem essa checagem, essa sobra travava o prefill para sempre,
       mesmo depois de a mudança mensurável ganhar uma resposta de verdade. */
    function aindaSemResposta(campo, valor) {
      var v = normalizar(valor);
      if (!v) return true;
      return !!(campo && campo.placeholder && v === normalizar(campo.placeholder));
    }
    /* Só usa a mudança como ponto de partida se ela estiver completa —
       "Esperávamos" é um campo de texto comum, não a prévia da etapa
       Mudanças mensuráveis, e o "—" que marca lacuna ali (útil no mapa,
       onde é só leitura) virava texto de verdade aqui dentro ("...em
       —."), relatado no uso real. Uma mudança com prazo em aberto não
       vira ponto de partida; melhor nascer em branco do que com um
       traço solto no meio da frase. */
    if (etapa.id === 'evidencia' && aindaSemResposta(campoPorChave(etapa, 'esperado'), d.esperado)) {
      var mudancaCompleta = ((_dados.mudancas || {}).itens || []).filter(function (m) {
        return partesMudanca(m).every(function (p) { return p.tipo !== 'vazio' || p.opcional; });
      })[0];
      /* A mudança é frase própria ("Aumentar X de..."), com maiúscula de
         início de frase — mas aqui ela entra depois de "Esperávamos", no
         meio de OUTRA frase. Só a primeira letra baixa (não a frase
         inteira: "cc"/siglas no meio continuam do jeito que a pessoa
         escreveu). Relatado no uso real. */
      if (mudancaCompleta) {
        var fraseMud = fraseMudanca(mudancaCompleta);
        d = Object.assign({}, d, { esperado: fraseMud.charAt(0).toLowerCase() + fraseMud.slice(1) });
      }
    }

    var corpo = (herdada
      ? '<p class="aposta-herdada">Missão cadastrada pela facilitação. Vocês podem ajustar — ' +
        'o que ficar aqui é a missão do grupo.</p>'
      : '') + (etapa.lista ? mudancasHtml(d) : moldeHtml(etapa, d));

    _tela.innerHTML = cabecalho() +
      '<div class="aposta-corpo">' +
        trilhaHtml() +
        '<main class="aposta-palco">' +
          progressoHtml() +
          (etapa.dependeDe ? cardConexao(etapa.dependeDe) : '') +
          '<div class="aposta-etapa">' +
            '<div class="aposta-etapa-cab">' +
              '<h1 class="aposta-etapa-titulo">' + esc(etapa.titulo) + '</h1>' +
              '<button class="aposta-ajuda" type="button" title="' + esc(etapa.dica) + '" aria-label="Ajuda">?</button>' +
            '</div>' +
            '<p class="aposta-pergunta">' + esc(etapa.pergunta) + '</p>' +
            (etapa.auxiliar ? '<p class="aposta-auxiliar">' + esc(etapa.auxiliar) + '</p>' : '') +
            '<div class="aposta-campos">' + corpo + '</div>' +
            /* A frase montada, ao vivo, embaixo das lacunas: o que ainda
               falta aparece marcado no lugar exato em que vai entrar, e
               clicar nele leva o cursor para o campo. É a resposta a
               "não sei mais o que falta preencher" — a etapa não depende
               de a pessoa reler os campos um por um para descobrir. */
            (etapa.lista ? '' :
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
            '<button class="btn btn--primary" id="apostaSeguir">' +
              (idx === ETAPAS.length - 1 ? 'Ver o mapa da aposta →' : 'Continuar →') +
            '</button>' +
          '</div>' +
        '</main>' +
      '</div>';

    ligarCabecalho();
    ligarEtapa(etapa);
  }

  function escolhaHtml(escolha, d, semRotulo) {
    return '<div class="aposta-escolha">' +
      (semRotulo ? '' : '<span class="aposta-campo-rot">' + esc(escolha.rotulo) + '</span>') +
      '<div class="aposta-escolha-opcoes">' +
        escolha.opcoes.map(function (o) {
          return '<button type="button" class="aposta-opcao' + (d[escolha.chave] === o ? ' is-ativa' : '') +
            '" data-escolha="' + esc(escolha.chave) + '" data-valor="' + esc(o) + '">' + esc(o) + '</button>';
        }).join('') +
      '</div>' +
    '</div>';
  }

  /* ── Mudanças mensuráveis: várias por missão ── */
  function mudancasHtml(d) {
    /* Começa com uma em branco. Antes, uma etapa sem nenhuma mudança
       mostrava só um botão "+ OUTRA mudança mensurável" — outra que
       quê? — e quem lia isso tinha de descobrir que era ali que se
       começava. O botão continua, para a segunda em diante. */
    var itens = (d.itens && d.itens.length) ? d.itens : [{}];
    var podeRemover = itens.length > 1;
    return '<div class="aposta-mudancas">' +
      itens.map(function (m, i) {
        var q = lerQuantidade({ chave: 'prazo', unidadePadrao: 'dias' }, m);
        return '<div class="aposta-mudanca" data-i="' + i + '">' +
          '<div class="aposta-mudanca-grade">' +
            '<label class="aposta-campo"><span class="aposta-campo-rot">Queremos</span>' +
              variantePicker('data-m', 'direcao', ['Aumentar', 'Reduzir'], m.direcao, 'Queremos', null, 'aposta-variante--campo') +
            '</label>' +
            '<label class="aposta-campo"><span class="aposta-campo-rot">Indicador</span>' +
              '<input type="text" class="aposta-campo-input" data-m="indicador" value="' + esc(m.indicador || '') + '" placeholder="contatos sobre andamento" /></label>' +
            '<label class="aposta-campo"><span class="aposta-campo-rot">Situação atual</span>' +
              '<input type="text" class="aposta-campo-input" data-m="atual" value="' + esc(m.atual || '') + '" placeholder="1.000" /></label>' +
            '<label class="aposta-campo"><span class="aposta-campo-rot">Meta desejada</span>' +
              '<input type="text" class="aposta-campo-input" data-m="meta" value="' + esc(m.meta || '') + '" placeholder="700" /></label>' +
            '<label class="aposta-campo"><span class="aposta-campo-rot">Unidade</span>' +
              variantePicker('data-m', 'unidade', ['por mês', 'por semana', 'por atendimento'], m.unidade, 'Unidade', null, 'aposta-variante--campo', true) +
            '</label>' +
            '<label class="aposta-campo aposta-campo--qtd"><span class="aposta-campo-rot">Prazo</span>' +
              '<span class="aposta-qtd">' +
                '<input type="text" inputmode="numeric" data-mascara="numero" class="aposta-campo-input aposta-qtd-num" data-m="prazo" value="' + esc(q.num) + '" placeholder="90" />' +
                '<select class="aposta-campo-input aposta-qtd-un" data-m="prazoUnidade" aria-label="Unidade do prazo">' +
                  UNIDADES.map(function (u) {
                    return '<option value="' + u + '"' + (q.un === u ? ' selected' : '') + '>' + u + '</option>';
                  }).join('') +
                '</select>' +
              '</span></label>' +
          '</div>' +
          '<p class="aposta-mudanca-frase">' + htmlDaFrase(partesMudanca(m)) + '</p>' +
          (podeRemover ? '<button type="button" class="aposta-mudanca-del" data-del="' + i + '">Remover</button>' : '') +
        '</div>';
      }).join('') +
      '<button type="button" class="btn btn--sm" id="apostaAddMudanca">+ Outra mudança mensurável</button>' +
    '</div>';
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
          var escreveu = ['indicador', 'atual', 'meta', 'unidade', 'prazo'].some(function (k) {
            return normalizar(m[k]);
          });
          if (escreveu) d.itens.push(m);
        });
      } else {
        _tela.querySelectorAll('[data-campo]').forEach(function (el) { d[el.dataset.campo] = el.value; });
        if (etapa.escolha) {
          var ativa = _tela.querySelector('.aposta-opcao.is-ativa');
          if (ativa) d[etapa.escolha.chave] = ativa.dataset.valor;
        }
      }
      return d;
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
      agendarSalvamento(etapa.id, coletar());
      if (etapa.lista) atualizarFrases(); else atualizarFrase();
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
      var partes = partesDaFrase(etapa, d);
      var faltam = partes.filter(function (p) { return p.tipo === 'vazio' && !p.opcional; });
      var usaLegado = etapa.legado && String(d[etapa.legado] || '').trim() && !temLacunaPreenchida(etapa, d);

      var html = usaLegado
        ? '<strong class="aposta-frase-valor">' + esc(String(d[etapa.legado]).trim()) + '</strong>'
        : htmlDaFrase(partes);

      var agora = document.getElementById('apostaGrupoAgora');
      if (agora) {
        var g0 = (etapa.grupos || [])[0];
        agora.textContent = g0 ? ' ' + avisoDaEscolha(g0, d) : '';
      }

      el.hidden = false;
      el.innerHTML = '<span class="aposta-frase-rot">Fica assim no mapa</span>' +
        '<p>' + html + '</p>' +
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

    function atualizarFrases() {
      _tela.querySelectorAll('.aposta-mudanca').forEach(function (bloco) {
        var m = {};
        bloco.querySelectorAll('[data-m]').forEach(function (el) { m[el.dataset.m] = el.value; });
        var p = bloco.querySelector('.aposta-mudanca-frase');
        if (p) p.innerHTML = htmlDaFrase(partesMudanca(m));
      });
    }

    _tela.querySelectorAll('.aposta-campo-input').forEach(function (el) {
      el.addEventListener('input', function () { aplicarMascara(el); salvarDepois(); });
      el.addEventListener('change', function () { aplicarMascara(el); salvarDepois(); });
    });

    /* Os chips são atalho para o campo ao lado, não um controle à parte:
       clicar preenche o texto de sempre (e dispara o mesmo salvamento de
       digitar), e o destaque acompanha o que está no campo — inclusive
       quando a pessoa digita por cima e nenhum chip bate mais. */
    _tela.querySelectorAll('.aposta-variante').forEach(function (wrap) {
      var input = wrap.querySelector('.aposta-variante-input');
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
    });

    _tela.querySelectorAll('.aposta-opcao').forEach(function (b) {
      b.addEventListener('click', function () {
        _tela.querySelectorAll('.aposta-opcao').forEach(function (o) { o.classList.remove('is-ativa'); });
        b.classList.add('is-ativa');
        salvarEtapa(etapa.id, coletar());
        atualizarFrase();
      });
    });

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
      seguirBtn.disabled = true;
      salvarEtapa(etapa.id, d, false, function (err) {
        if (err) {
          seguirBtn.disabled = false;
          avisar('Não consegui salvar "' + etapa.curto + '" — verifique a conexão e tente de novo. ' +
            'Nada foi perdido: o que está na tela continua aqui.', true);
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
    if (idx === ETAPAS.length - 1) { _vendoMapa = true; render(); return; }
    _etapaAtual = ETAPAS[idx + 1].id;
    /* A etapa do grupo é o que o painel do facilitador mostra como
       progresso. Falhar aqui não trava o grupo, mas engana quem
       acompanha — então avisa. */
    db().ref(caminhoGrupo() + '/etapa').set(_etapaAtual, function (err) {
      if (err) avisar('Avancei aqui, mas não consegui registrar o progresso do grupo.', true);
    });
    render();
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

  function salvarEtapa(etapaId, dados, redesenhar, cb) {
    clearTimeout(_timerSalvar);
    _timerSalvar = null;
    _pendente = null;
    if (!_grupoId) { if (cb) cb(null); return; }
    _dados[etapaId] = dados;
    var s = sessao();
    var updates = {};
    updates[caminhoGrupo() + '/dados/' + etapaId] = dados;
    updates[caminhoGrupo() + '/atualizadoEm'] = new Date().toISOString();
    updates[caminhoGrupo() + '/atualizadoPorNome'] = s ? (s.name || s.email) : '';
    db().ref().update(updates, function (err) {
      var el = document.getElementById('apostaSalvo');
      if (el) {
        el.textContent = err ? 'Não consegui salvar' : 'Salvo';
        el.className = 'aposta-salvo' + (err ? ' is-erro' : '');
      }
      if (redesenhar && !err) render();
      if (cb) cb(err);
    });
  }

  /* ══════════════════════════════════════════════════════════════
     MAPA DA APOSTA
     ══════════════════════════════════════════════════════════════ */
  function renderMapa() {
    var conduz = souFacilitadora();
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
          '<p class="aposta-mapa-sub">Clique em qualquer card para editar aquela etapa.</p>' +
          /* Levar a aposta embora: em papel/PDF para a sala e em texto
             para colar onde for analisada. São os dois destinos que a
             oficina pede, e nenhum deles é o CSV do painel (que é da
             facilitadora, com todos os grupos). */
          '<div class="aposta-mapa-acoes">' +
            '<button class="btn btn--sm" id="apostaCopiarBtn">⧉ Copiar em texto</button>' +
            '<button class="btn btn--sm" id="apostaPdfBtn">🖨 Salvar em PDF</button>' +
          '</div>' +
          '<div class="aposta-mapa">' +
            ETAPAS.map(function (e, i) {
              var texto = resumoEtapa(e.id, _dados);
              return (i ? '<div class="aposta-mapa-seta">↓</div>' : '') +
                '<button class="aposta-mapa-card' + (texto ? '' : ' is-vazio') + '" data-etapa="' + e.id + '">' +
                  '<span class="aposta-mapa-rot">' + esc(e.titulo) + '</span>' +
                  '<span class="aposta-mapa-txt">' + esc(texto || 'ainda não preenchido') + '</span>' +
                '</button>';
            }).join('') +
          '</div>' +
          (_exec.revelado ? revelacaoHtml() : '') +
        '</main>' +
      '</div>';

    ligarCabecalho();
    _tela.querySelectorAll('.aposta-mapa-card').forEach(function (b) {
      b.addEventListener('click', function () { _vendoMapa = false; _etapaAtual = b.dataset.etapa; render(); });
    });
    _tela.querySelectorAll('.aposta-trilha-item').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.disabled) return;
        _vendoMapa = false; _etapaAtual = b.dataset.etapa; render();
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
    (etapa.molde || []).forEach(function (p, i) {
      if (typeof p === 'string') {
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

    function desenhar() {
      var grupos = _exec.grupos || {};
      box.innerHTML =
        '<h3 style="font-family:var(--font-head);letter-spacing:.05em;color:var(--ink);margin:0">Painel do facilitador</h3>' +
        '<p style="font-size:.82rem;color:var(--ink-3);margin:0">' + esc(_turma.label) + '</p>' +

        '<h4 style="margin:8px 0 0">Missão da dinâmica</h4>' +
        '<p style="font-size:.8rem;color:var(--ink-3);margin:0">Se você cadastrar aqui, os grupos abrem a etapa 1 com esta missão já escrita e podem ajustar. Em branco, cada grupo escreve a sua.</p>' +
        missaoFacHtml() +
        '<button class="btn btn--sm" id="apostaSalvarMissao">Salvar missão</button>' +

        '<h4 style="margin:8px 0 0">Grupos</h4>' +
        (Object.keys(grupos).length
          ? '<div class="aposta-fac-grupos">' + Object.keys(grupos).map(function (g) {
              var gr = grupos[g];
              var feitas = ETAPAS.filter(function (e) { return etapaPreenchida(e.id, gr.dados || {}); }).length;
              var membros = Object.keys(gr.membros || {}).map(function (k) { return (gr.membros[k] || {}).name; }).filter(Boolean);
              return '<div class="aposta-fac-grupo">' +
                '<strong>' + esc(gr.nome || 'Grupo') + '</strong>' +
                '<span>' + feitas + '/' + ETAPAS.length + ' etapas</span>' +
                '<span class="aposta-fac-membros">' + esc(membros.join(', ') || 'ninguém ainda') + '</span>' +
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
        '<p style="font-size:.8rem;color:var(--ink-3);margin:0">Reiniciar abre uma execução nova e mantém a atual guardada — nada do que os grupos escreveram é apagado.</p>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<button class="btn btn--sm" id="apostaExportar">↓ Exportar mapa (CSV)</button>' +
          '<button class="btn btn--sm" id="apostaReiniciar">Reiniciar dinâmica</button>' +
        '</div>' +
        '<div style="display:flex;justify-content:flex-end"><button class="btn admin-modal-cancel-btn" id="apostaFecharPainel">Fechar</button></div>';

      box.querySelector('#apostaFecharPainel').addEventListener('click', fechar);
      /* As três escritas abaixo confirmam o erro antes de dizer que deu
         certo. Dizer "Missão salva" sobre uma gravação recusada é o
         defeito que a skill editar-e-salvar existe para impedir. */
      box.querySelectorAll('[data-mis]').forEach(function (el) {
        el.addEventListener('input', function () { aplicarMascara(el); });
      });
      box.querySelector('#apostaSalvarMissao').addEventListener('click', function () {
        var b = box.querySelector('#apostaSalvarMissao');
        var m = {};
        box.querySelectorAll('[data-mis]').forEach(function (el) { m[el.dataset.mis] = el.value; });
        db().ref(caminhoExec() + '/missao').set(m, function (err) {
          if (err) { b.textContent = 'Não salvou — tente de novo'; return; }
          _exec.missao = m;
          b.textContent = 'Missão salva';
          setTimeout(function () { b.textContent = 'Salvar missão'; }, 1600);
        });
      });
      box.querySelector('#apostaCriarGrupo').addEventListener('click', function () {
        var nome = (box.querySelector('#apostaNovoGrupo').value || '').trim() ||
          ('Grupo ' + (Object.keys(_exec.grupos || {}).length + 1));
        var ref = db().ref(caminhoExec() + '/grupos').push();
        ref.set({ nome: nome, criadoEm: new Date().toISOString(), etapa: 'missao' }, function (err) {
          if (err) { avisar('Não consegui criar o grupo. Tente de novo.', true); return; }
          desenhar();
        });
      });
      box.querySelector('#apostaToggleRevelar').addEventListener('click', function () {
        db().ref(caminhoExec() + '/revelado').set(!_exec.revelado, function (err) {
          if (err) { avisar('Não consegui mudar a revelação. Tente de novo.', true); return; }
          desenhar();
        });
      });
      box.querySelector('#apostaReiniciar').addEventListener('click', function () {
        if (!confirm('Abrir uma execução nova desta dinâmica?\n\nA execução atual continua guardada, com tudo o que os grupos escreveram.')) return;
        fechar();
        _grupoId = null;
        criarExecucao();
      });
      box.querySelector('#apostaExportar').addEventListener('click', exportarCSV);
      box.querySelectorAll('.aposta-fac-ver').forEach(function (b) {
        b.addEventListener('click', function () {
          fechar();
          _grupoId = b.dataset.grupo;
          _grupo = (_exec.grupos || {})[_grupoId] || {};
          _dados = _grupo.dados || {};
          _vendoMapa = true;
          render();
        });
      });
    }
    desenhar();
  }

  function exportarCSV() {
    var grupos = _exec.grupos || {};
    var linhas = [['Grupo', 'Etapa', 'Conteúdo']];
    Object.keys(grupos).forEach(function (g) {
      ETAPAS.forEach(function (e) {
        linhas.push([grupos[g].nome || g, e.curto, resumoEtapa(e.id, grupos[g].dados || {})]);
      });
    });
    var csv = linhas.map(function (l) {
      return l.map(function (c) { return '"' + String(c || '').replace(/"/g, '""') + '"'; }).join(';');
    }).join('\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'aposta-' + _turma.key + '.csv';
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
    _texto: function () { return textoDaAposta(); }
  };

  window.addEventListener('fa-auth-ready', montarEntrada);
  window.addEventListener('fa-auth-change', montarEntrada);
  if (window.faRouter) window.faRouter.onPageInit('treinamento', montarEntrada);
})();
