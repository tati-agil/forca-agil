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
   quer interromper. Por isso a trilha mostra os NOMES das dez
   etapas desde o começo (dá para ver onde a conversa vai chegar),
   mas o conteúdo de cada uma só abre quando chega a vez dela.

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
     AS DEZ ETAPAS

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
      orientacao: '[Verbo de mudança] + [o que queremos melhorar] + [para quem/em qual contexto] + [prazo].',
      exemplo: 'Melhorar significativamente a experiência do participante durante a concessão do benefício em 90 dias.',
      dica: 'A missão é o destino da conversa. Ela não descreve o que será feito, e sim o que queremos que fique diferente.',
      campos: [{ chave: 'texto', rotulo: 'Missão', tipo: 'textarea', placeholder: 'Melhorar… para… em…' }]
    },
    {
      id: 'sintoma',
      titulo: 'SINTOMA',
      curto: 'Sintoma',
      pergunta: 'O que vemos hoje?',
      auxiliar: 'Comece pelo que é possível observar na realidade. Ainda não tente explicar por que isso acontece.',
      template: 'Hoje observamos que [fato ou comportamento observável].',
      exemplo: 'Hoje observamos que muitos participantes entram em contato para saber em que etapa está a concessão.',
      dica: 'Sintoma = o que estamos vendo acontecer. Se duas pessoas olhassem para a mesma realidade, as duas veriam isso.',
      campos: [{ chave: 'texto', tipo: 'textarea', rotulo: 'O que observamos', placeholder: 'Hoje observamos que…' }]
    },
    {
      id: 'problema',
      titulo: 'P — PROBLEMA',
      curto: 'Problema',
      pergunta: 'Que problema esse sintoma está revelando?',
      auxiliar: 'Agora transforme o sintoma observado na situação indesejada que ele revela.',
      template: '[Quem é afetado] não consegue [situação/comportamento desejado], evidenciado por [sintoma observado].',
      exemplo: 'Os participantes não conseguem acompanhar o andamento da concessão com autonomia, evidenciado pelos frequentes contatos para saber em que etapa está o processo.',
      dica: 'Sintoma = o que vemos. Problema = a situação indesejada que esse sintoma revela.',
      dependeDe: 'sintoma',
      campos: [
        { chave: 'quem', tipo: 'input', rotulo: 'Quem é afetado', placeholder: 'Os participantes…' },
        { chave: 'naoConsegue', tipo: 'input', rotulo: 'Não consegue…', placeholder: 'acompanhar o andamento com autonomia' },
        { chave: 'evidenciadoPor', tipo: 'textarea', rotulo: 'Evidenciado por', placeholder: 'contatos frequentes para saber a etapa' }
      ]
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
      template: 'Acreditamos que [problema] acontece porque [causa provável], pois [indício que sustenta essa crença].',
      exemplo: 'Acreditamos que os participantes não conseguem acompanhar o andamento com autonomia porque as informações sobre etapa atual e próximo passo não são suficientemente claras, pois muitas solicitações recebidas são perguntas sobre status e prazo.',
      dica: 'Hipótese = nossa explicação atual para o problema. Ela ainda precisa ser testada.',
      dependeDe: 'problema',
      campos: [
        { chave: 'causa', tipo: 'textarea', rotulo: 'Causa provável', placeholder: 'porque…' },
        { chave: 'indicio', tipo: 'textarea', rotulo: 'Por que pensamos assim? Qual indício temos?', placeholder: 'pois…' }
      ]
    },
    {
      id: 'ideia',
      titulo: 'IDEIA DE SOLUÇÃO',
      curto: 'Ideia de solução',
      pergunta: 'O que poderíamos fazer a respeito?',
      template: 'Poderíamos [ação ou abordagem] para [mudança que pretendemos provocar].',
      exemplo: 'Poderíamos dar ao participante maior visibilidade sobre o andamento da concessão, para que consiga se orientar com mais autonomia.',
      rodape: 'A hipótese diz o que acreditamos estar acontecendo. A ideia de solução diz o que imaginamos que podemos fazer a respeito.',
      dica: 'Ainda não é hora de decidir tecnologia. O que importa é a mudança que a ideia pretende provocar.',
      dependeDe: 'hipotese',
      campos: [{ chave: 'texto', tipo: 'textarea', rotulo: 'Ideia', placeholder: 'Poderíamos… para…' }]
    },
    {
      id: 'versao',
      titulo: 'VERSÃO TESTÁVEL',
      curto: 'Versão testável',
      pergunta: 'Como representar essa ideia sem construir tudo?',
      auxiliar: 'Não precisamos construir a solução completa para aprender se a ideia faz sentido.',
      template: 'Sem construir [solução completa], podemos representar essa ideia por meio de [forma simples, manual ou protótipo].',
      exemplo: 'Sem construir um acompanhamento integrado no portal, podemos enviar manualmente uma mensagem com a etapa atual e o próximo passo.',
      rodape: 'Solução imaginada ≠ versão testável. A versão testável é menor, mais barata e mais rápida.',
      dica: 'Vale papel, planilha, mensagem manual, atendimento simulado. O objetivo é aprender, não entregar.',
      dependeDe: 'ideia',
      campos: [
        { chave: 'semConstruir', tipo: 'input', rotulo: 'Sem construir…', placeholder: 'o acompanhamento no portal' },
        { chave: 'podemos', tipo: 'textarea', rotulo: '…podemos representar por meio de', placeholder: 'uma mensagem manual com a etapa atual' }
      ]
    },
    {
      id: 'experimento',
      titulo: 'E — EXPERIMENTO',
      curto: 'Experimento',
      pergunta: 'Como vamos testar essa versão?',
      template: 'Durante [tempo], com [público/quantidade], vamos [aplicar a versão testável] e medir/observar [o quê].',
      exemplo: 'Durante 3 semanas, com 50 participantes, vamos enviar a mensagem de status e medir quantos contatos sobre andamento eles realizam.',
      rodape: 'O experimento não é a solução completa. É a forma organizada de testar uma versão simplificada da ideia.',
      dica: 'Um experimento precisa de três coisas para valer: com quem, por quanto tempo e o que será medido.',
      dependeDe: 'versao',
      campos: [
        { chave: 'oQue', tipo: 'textarea', rotulo: 'O que será feito?', placeholder: 'enviar a mensagem de status' },
        { chave: 'comQuem', tipo: 'input', rotulo: 'Com quem?', placeholder: 'participantes em concessão' },
        { chave: 'quantidade', tipo: 'input', rotulo: 'Quantidade', placeholder: '50' },
        { chave: 'responsavel', tipo: 'input', rotulo: 'Responsável', placeholder: 'nome' },
        { chave: 'duracao', tipo: 'input', rotulo: 'Duração', placeholder: '3 semanas' },
        { chave: 'custo', tipo: 'input', rotulo: 'Custo estimado', placeholder: 'baixo / R$…' },
        { chave: 'medida', tipo: 'textarea', rotulo: 'O que será medido?', placeholder: 'nº de contatos sobre andamento' }
      ]
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
        { chave: 'esperado', tipo: 'textarea', rotulo: 'O que esperamos observar?', antes: true, placeholder: 'esperávamos…' },
        { chave: 'medir', tipo: 'textarea', rotulo: 'O que vamos medir?', antes: true, placeholder: 'nº de contatos por semana' },
        { chave: 'observado', tipo: 'textarea', rotulo: 'O que realmente aconteceu?', placeholder: 'observamos…' }
      ],
      escolha: {
        chave: 'classificacao',
        rotulo: 'Nossa hipótese foi:',
        opcoes: ['Sustentada', 'Parcialmente sustentada', 'Não sustentada']
      }
    },
    {
      id: 'decisao',
      titulo: 'D — DECISÃO',
      curto: 'Decisão',
      pergunta: 'O que fazemos com o que aprendemos?',
      template: 'Com base na evidência, vamos [decisão] + [próxima ação].',
      exemplo: 'Com base na evidência, vamos ajustar a comunicação e realizar um novo teste com um grupo maior.',
      dica: 'A decisão precisa nascer da evidência registrada — não da preferência de quem defende a ideia.',
      dependeDe: 'evidencia',
      escolha: {
        chave: 'decisao',
        rotulo: 'Decisão',
        opcoes: ['Ampliar', 'Ajustar e testar novamente', 'Abandonar essa ideia', 'Formular nova hipótese', 'Investigar mais']
      },
      campos: [
        { chave: 'proximaAcao', tipo: 'textarea', rotulo: 'Próxima ação', placeholder: 'o que acontece a seguir' },
        { chave: 'responsavel', tipo: 'input', rotulo: 'Responsável', placeholder: 'nome' },
        { chave: 'prazo', tipo: 'input', rotulo: 'Prazo', placeholder: 'até…' },
        { chave: 'reavaliacao', tipo: 'input', rotulo: 'Data de reavaliação', placeholder: 'dd/mm' },
        { chave: 'proximaHipotese', tipo: 'textarea', rotulo: 'Próxima hipótese (quando aplicável)', placeholder: 'acreditamos que…' }
      ]
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
      if (MUITA_TECNOLOGIA.test(d.texto || '')) {
        avisos.push('Antes de definir a implementação, qual mudança você pretende provocar?');
      }
    }

    if (etapaId === 'versao') {
      var ideia = normalizar((_dados.ideia || {}).texto);
      var versao = normalizar([d.semConstruir, d.podemos].join(' '));
      if (ideia && versao.indexOf(ideia) !== -1) {
        avisos.push('Há uma maneira menor, manual ou mais rápida de representar essa ideia?');
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
  function etapaPreenchida(etapaId, dados) {
    var d = (dados || {})[etapaId] || {};
    if (etapaId === 'mudancas') return !!(d.itens && d.itens.length);
    var etapa = etapaPorId(etapaId);
    if (!etapa) return false;
    if (etapa.escolha && !d[etapa.escolha.chave]) return false;
    var campos = etapa.campos || [];
    for (var i = 0; i < campos.length; i++) {
      if (normalizar(d[campos[i].chave])) return true;
    }
    return !campos.length && !!etapa.escolha;
  }

  /* ── Frases consolidadas: o que vai no card do mapa e nos cards de
        conexão entre etapas. Uma função só, para o mapa final e a
        trilha nunca contarem histórias diferentes. ── */
  function fraseMudanca(m) {
    if (!m) return '';
    var direcao = m.direcao || 'Alterar';
    var unidade = m.unidade ? ' ' + m.unidade : '';
    return direcao + ' ' + (m.indicador || '—') +
      ' de ' + (m.atual || '—') + unidade +
      ' para ' + (m.meta || '—') + unidade +
      ' em ' + (m.prazo || '—') + '.';
  }
  function resumoEtapa(etapaId, dados) {
    var d = (dados || {})[etapaId] || {};
    switch (etapaId) {
      case 'missao':   return d.texto || '';
      case 'sintoma':  return d.texto ? 'Hoje observamos que ' + d.texto : '';
      case 'problema': return d.quem
        ? d.quem + ' não consegue ' + (d.naoConsegue || '—') + ', evidenciado por ' + (d.evidenciadoPor || '—') + '.'
        : '';
      case 'mudancas': return (d.itens || []).map(fraseMudanca).join(' ');
      case 'hipotese': return d.causa
        ? 'Acreditamos que acontece porque ' + d.causa + (d.indicio ? ', pois ' + d.indicio : '') + '.'
        : '';
      case 'ideia':    return d.texto || '';
      case 'versao':   return d.semConstruir
        ? 'Sem construir ' + d.semConstruir + ', podemos ' + (d.podemos || '—') + '.'
        : (d.podemos || '');
      case 'experimento': return d.oQue
        ? 'Durante ' + (d.duracao || '—') + ', com ' + (d.quantidade || '—') + ' ' + (d.comQuem || '') +
          ', vamos ' + d.oQue + ' e medir ' + (d.medida || '—') + '.'
        : '';
      case 'evidencia': return d.observado
        ? 'Esperávamos ' + (d.esperado || '—') + '. Observamos ' + d.observado + '. Portanto, nossa hipótese foi ' +
          (d.classificacao ? d.classificacao.toLowerCase() : '—') + '.'
        : '';
      case 'decisao': return d.decisao
        ? 'Com base na evidência, vamos ' + d.decisao.toLowerCase() + (d.proximaAcao ? ' — ' + d.proximaAcao : '') + '.'
        : '';
    }
    return '';
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
      if (!habilitadas.length) { cb([]); return; }

      function montar(keys) {
        cb(keys.map(function (tk) {
          return { key: tk, label: turmas[tk].label || tk, eventoKey: turmas[tk].eventoKey || '' };
        }));
      }
      /* Admin revisa antes de liberar: vê todas as turmas habilitadas
         sem precisar estar inscrita em nenhuma. */
      if (souAdmin() || souFacilitadora()) { montar(habilitadas); return; }

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
      host.innerHTML =
        '<div class="aposta-convite">' +
          '<div class="aposta-convite-txt">' +
            '<span class="eyebrow">Dinâmica</span>' +
            '<h2>Construção da Aposta</h2>' +
            '<p>Da missão até uma decisão baseada em evidência, uma etapa por vez.</p>' +
          '</div>' +
          '<div class="aposta-convite-acao">' +
            (turmas.length > 1
              ? '<select id="apostaTurmaSel" class="aposta-select">' +
                  turmas.map(function (t) { return '<option value="' + esc(t.key) + '">' + esc(t.label) + '</option>'; }).join('') +
                '</select>'
              : '<span class="aposta-convite-turma">' + esc(turmas[0].label) + '</span>') +
            '<button class="btn btn--primary" id="apostaAbrirBtn">Abrir dinâmica</button>' +
          '</div>' +
        '</div>';

      document.getElementById('apostaAbrirBtn').addEventListener('click', function () {
        var sel = document.getElementById('apostaTurmaSel');
        var escolhida = sel
          ? turmas.filter(function (t) { return t.key === sel.value; })[0]
          : turmas[0];
        abrirDinamica(escolhida);
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
  function trilhaHtml() {
    var atual = indiceEtapa(_etapaAtual);
    return '<nav class="aposta-trilha" aria-label="Etapas da dinâmica">' +
      ETAPAS.map(function (e, i) {
        var feita = etapaPreenchida(e.id, _dados);
        var cls = 'aposta-trilha-item' +
          (i === atual && !_vendoMapa ? ' is-atual' : '') +
          (feita ? ' is-feita' : '') +
          (i > atual && !feita ? ' is-bloqueada' : '');
        return '<button class="' + cls + '" data-etapa="' + e.id + '"' +
          (i > atual && !feita ? ' disabled aria-disabled="true"' : '') + '>' +
          '<span class="aposta-trilha-num">' + (i + 1) + '</span>' +
          '<span class="aposta-trilha-nome">' + esc(e.curto) + '</span>' +
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

  function campoHtml(c, valor) {
    var id = 'ap-' + c.chave;
    var comum = 'id="' + id + '" data-campo="' + esc(c.chave) + '" class="aposta-campo-input" placeholder="' + esc(c.placeholder || '') + '"';
    return '<label class="aposta-campo">' +
      '<span class="aposta-campo-rot">' + esc(c.rotulo) + (c.antes ? ' <em>(antes do experimento)</em>' : '') + '</span>' +
      (c.tipo === 'textarea'
        ? '<textarea ' + comum + ' rows="3">' + esc(valor || '') + '</textarea>'
        : '<input type="text" ' + comum + ' value="' + esc(valor || '') + '" />') +
    '</label>';
  }

  function renderEtapa() {
    var etapa = etapaPorId(_etapaAtual) || ETAPAS[0];
    var d = _dados[etapa.id] || {};
    var idx = indiceEtapa(etapa.id);

    var corpo;
    if (etapa.lista) {
      corpo = mudancasHtml(d);
    } else {
      corpo = (etapa.campos || []).map(function (c) { return campoHtml(c, d[c.chave]); }).join('');
      if (etapa.escolha) {
        corpo = (etapa.id === 'decisao' ? escolhaHtml(etapa.escolha, d) + corpo : corpo + escolhaHtml(etapa.escolha, d));
      }
    }

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
            (etapa.orientacao ? '<p class="aposta-template">' + esc(etapa.orientacao) + '</p>' : '') +
            (etapa.template ? '<p class="aposta-template">' + esc(etapa.template) + '</p>' : '') +
            '<div class="aposta-campos">' + corpo + '</div>' +
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

  function escolhaHtml(escolha, d) {
    return '<div class="aposta-escolha">' +
      '<span class="aposta-campo-rot">' + esc(escolha.rotulo) + '</span>' +
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
    var itens = d.itens || [];
    return '<div class="aposta-mudancas">' +
      itens.map(function (m, i) {
        return '<div class="aposta-mudanca" data-i="' + i + '">' +
          '<div class="aposta-mudanca-grade">' +
            '<label class="aposta-campo"><span class="aposta-campo-rot">Queremos</span>' +
              '<select class="aposta-campo-input" data-m="direcao">' +
                ['Aumentar', 'Reduzir'].map(function (o) {
                  return '<option' + (m.direcao === o ? ' selected' : '') + '>' + o + '</option>';
                }).join('') +
              '</select></label>' +
            '<label class="aposta-campo"><span class="aposta-campo-rot">Indicador</span>' +
              '<input type="text" class="aposta-campo-input" data-m="indicador" value="' + esc(m.indicador || '') + '" placeholder="contatos sobre andamento" /></label>' +
            '<label class="aposta-campo"><span class="aposta-campo-rot">Situação atual</span>' +
              '<input type="text" class="aposta-campo-input" data-m="atual" value="' + esc(m.atual || '') + '" placeholder="1.000" /></label>' +
            '<label class="aposta-campo"><span class="aposta-campo-rot">Meta desejada</span>' +
              '<input type="text" class="aposta-campo-input" data-m="meta" value="' + esc(m.meta || '') + '" placeholder="700" /></label>' +
            '<label class="aposta-campo"><span class="aposta-campo-rot">Unidade</span>' +
              '<input type="text" class="aposta-campo-input" data-m="unidade" value="' + esc(m.unidade || '') + '" placeholder="por mês" /></label>' +
            '<label class="aposta-campo"><span class="aposta-campo-rot">Prazo</span>' +
              '<input type="text" class="aposta-campo-input" data-m="prazo" value="' + esc(m.prazo || '') + '" placeholder="90 dias" /></label>' +
          '</div>' +
          '<p class="aposta-mudanca-frase">' + esc(fraseMudanca(m)) + '</p>' +
          '<button type="button" class="aposta-mudanca-del" data-del="' + i + '">Remover</button>' +
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
          d.itens.push(m);
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

    var timer = null;
    function salvarDepois() {
      clearTimeout(timer);
      timer = setTimeout(function () { salvarEtapa(etapa.id, coletar()); }, 600);
      if (etapa.lista) atualizarFrases();
    }

    function atualizarFrases() {
      _tela.querySelectorAll('.aposta-mudanca').forEach(function (bloco) {
        var m = {};
        bloco.querySelectorAll('[data-m]').forEach(function (el) { m[el.dataset.m] = el.value; });
        var p = bloco.querySelector('.aposta-mudanca-frase');
        if (p) p.textContent = fraseMudanca(m);
      });
    }

    _tela.querySelectorAll('.aposta-campo-input').forEach(function (el) {
      el.addEventListener('input', salvarDepois);
      el.addEventListener('change', salvarDepois);
    });

    _tela.querySelectorAll('.aposta-opcao').forEach(function (b) {
      b.addEventListener('click', function () {
        _tela.querySelectorAll('.aposta-opcao').forEach(function (o) { o.classList.remove('is-ativa'); });
        b.classList.add('is-ativa');
        salvarEtapa(etapa.id, coletar());
      });
    });

    var add = document.getElementById('apostaAddMudanca');
    if (add) {
      add.addEventListener('click', function () {
        var d = coletar();
        d.itens.push({ direcao: 'Reduzir' });
        _dados[etapa.id] = d;
        salvarEtapa(etapa.id, d, true);
      });
    }
    _tela.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        var d = coletar();
        d.itens.splice(Number(b.dataset.del), 1);
        _dados[etapa.id] = d;
        salvarEtapa(etapa.id, d, true);
      });
    });

    var voltar = document.getElementById('apostaVoltar');
    if (voltar) voltar.addEventListener('click', function () {
      salvarEtapa(etapa.id, coletar());
      _etapaAtual = ETAPAS[Math.max(0, indiceEtapa(etapa.id) - 1)].id;
      render();
    });

    document.getElementById('apostaSeguir').addEventListener('click', function () {
      var d = coletar();
      salvarEtapa(etapa.id, d);
      var avisos = validar(etapa.id, d);
      /* Não bloqueia: mostra o convite a reler e só avança no
         segundo clique, para o aviso ter tempo de ser lido. */
      if (avisos.length && !avisosEl.dataset.mostrado) {
        avisosEl.dataset.mostrado = '1';
        avisosEl.innerHTML = avisos.map(function (a) {
          return '<p class="aposta-aviso-didatico">💡 ' + esc(a) + '</p>';
        }).join('') + '<p class="aposta-aviso-ok">Você pode seguir assim mesmo — clique em Continuar de novo.</p>';
        avisosEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }
      avancar(etapa);
    });

    _tela.querySelectorAll('.aposta-trilha-item').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.disabled) return;
        salvarEtapa(etapa.id, coletar());
        _vendoMapa = false;
        _etapaAtual = b.dataset.etapa;
        render();
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

  /* ── Salvamento automático ── */
  function salvarEtapa(etapaId, dados, redesenhar) {
    if (!_grupoId) return;
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
          '<p class="aposta-mapa-sub">Clique em qualquer card para editar aquela etapa.</p>' +
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

        '<label class="auth-label" style="margin:0">Missão da dinâmica (cadastrada por você)' +
          '<textarea id="apostaMissaoFac" rows="3" placeholder="Melhorar… para… em…">' + esc(_exec.missao || '') + '</textarea>' +
        '</label>' +
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
        '<p style="font-size:.8rem;color:var(--ink-3);margin:0">Enquanto não for revelada, a interface não mostra os termos do final da dinâmica em lugar nenhum.</p>' +
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
      box.querySelector('#apostaSalvarMissao').addEventListener('click', function () {
        var b = box.querySelector('#apostaSalvarMissao');
        db().ref(caminhoExec() + '/missao').set(box.querySelector('#apostaMissaoFac').value, function (err) {
          if (err) { b.textContent = 'Não salvou — tente de novo'; return; }
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
    _etapas: function () { return ETAPAS.map(function (e) { return e.id; }); }
  };

  window.addEventListener('fa-auth-ready', montarEntrada);
  window.addEventListener('fa-auth-change', montarEntrada);
  if (window.faRouter) window.faRouter.onPageInit('treinamento', montarEntrada);
})();
