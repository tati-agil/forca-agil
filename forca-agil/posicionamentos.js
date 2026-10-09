/* ============================================================
   Força Ágil — Nome e definição dos posicionamentos organizacionais (window.faPosicionamentos)

   FONTE ÚNICA. A Taxonomia Organizacional (taxonomia/organizacional, editada em Admin › Taxonomia) é a
   ÚNICA fonte editável do NOME e da DEFINIÇÃO dos posicionamentos que o motor de Posicionamento
   Organizacional (window.faMotorPosicionamento) produz ou confirma. O motor é dono dos CÓDIGOS e da
   decisão e nunca lê a Taxonomia; este módulo só diz como um código se chama e o que ele significa —
   nunca decide nada. Renomear ou redefinir um conceito na Taxonomia não muda resultado, regra, código,
   nivelConfirmado, liberaSquad nem versão do motor. Mesmo desenho de classificacoes.js (arquitetural).

   CATÁLOGO: os códigos do PRÓPRIO motor — CODIGOS_INTERMEDIARIOS + CODIGOS_FIRMES (10 códigos; A_VALIDAR
   não é conceito e não entra). Nenhuma lista lógica própria aqui: ROTULO_FABRICA é só o texto de
   CONTINGÊNCIA de cada código (e a ordem de exibição), usado quando a Taxonomia ainda não respondeu e já
   demorou, recusou a leitura ou não tem o conceito. Não há definição de contingência.

   O QUE É LIDO (só isto — as regras do banco liberam aos perfis da Avaliação só estes caminhos, e só
   para estes 10 códigos):
     taxonomia/organizacional/conceitos/<codigo>/nome
     taxonomia/organizacional/conceitos/<codigo>/ativo
     taxonomia/organizacional/conceitos/<codigo>/definicaoVigenteFonteId
     taxonomia/organizacional/fontes/<codigo>/<definicaoVigenteFonteId>/texto
   A definição vem EXATAMENTE da fonte apontada por definicaoVigenteFonteId — nunca de uma fonte
   escolhida por ter situacao 'vigente'. Leituras ao vivo (.on): renomear muda a tela sem recarregar;
   trocar o ponteiro desliga a leitura da fonte antiga e liga a da nova. ativo === false não esconde
   nem muda nada: é só informação de apresentação/governança.

   CONTINGÊNCIA: nunca bloqueia nada e nunca altera resultado, código ou decisão — só o texto exibido,
   com um aviso discreto ("Rótulo de contingência"). Nunca escreve no banco.

   SESSÃO: só lê com sessão autorizada para a Avaliação (admin geral, 'avaliacao' ou
   'avaliacao-arquitetura'); troca de pessoa/acesso desliga tudo (geração) e religa; resposta de leitura
   antiga, de uma geração anterior, é descartada. Nada é lido antes de alguém chamar iniciar()/onMudanca().

   API: codigos(), nome(codigo), definicao(codigo), estadoDefinicao(codigo), ativo(codigo), estado()
   ('carregando'|'ok'|'contingencia'), usandoContingencia(codigo), onMudanca(cb), iniciar(), recarregar(),
   precisaAviso(codigos), avisoHtml(codigos, idElemento), spanNome(codigo, classe, idElemento),
   definicaoHtml(codigo, idElemento, {comEstado, tag}), atualizarDom(raiz), TEXTO_AVISO, TEMPO_DEMORA_MS,
   ROTULO_FABRICA. */
(function () {
  var RAIZ = 'taxonomia/organizacional';
  var TEMPO_DEMORA_MS = 6000;
  var TEXTO_AVISO = 'Rótulo de contingência: o nome deste posicionamento não pôde ser lido da Taxonomia Organizacional agora; está sendo mostrado o nome de fábrica.';
  /* Só contingência visual (e ordem de exibição: Linha e seus desdobramentos, depois Área e CoE). */
  var ROTULO_FABRICA = Object.freeze({
    LINHA: 'Linha',
    ESTRATEGIA_CLIENTES: 'Linha de Estratégia de Clientes',
    NEGOCIOS: 'Linha de Negócios',
    PLATAFORMA: 'Linha de Plataforma',
    PLATAFORMA_CANAIS: 'Plataforma de Canais',
    PLATAFORMA_HABILITADORA_NEGOCIOS: 'Plataforma Habilitadora de Negócios',
    PLATAFORMA_HABILITADORA_TECNOLOGIA: 'Plataforma Habilitadora de Tecnologia',
    PLATAFORMA_CORPORATIVA: 'Plataforma de Gestão Corporativa',
    AREA_ESPECIALIZADA: 'Área Especializada',
    COE: 'Centro de Excelência (CoE)'
  });

  /* Os códigos vêm do motor; a ordem, do rótulo de fábrica (código do motor sem rótulo vai ao fim). */
  var catalogo = (function () {
    var M = window.faMotorPosicionamento;
    if (!M) return [];
    var vistos = {}, lista = [];
    (M.CODIGOS_INTERMEDIARIOS || []).concat(M.CODIGOS_FIRMES || []).forEach(function (c) {
      if (c && c !== M.A_VALIDAR && !vistos[c]) { vistos[c] = true; lista.push(c); }
    });
    var ordem = Object.keys(ROTULO_FABRICA);
    return lista.sort(function (a, b) {
      var ia = ordem.indexOf(a), ib = ordem.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  })();

  /* Por código: undefined = ainda não respondeu; null = respondeu "não existe". */
  var lido = {};
  var demorando = false;
  var ativoModulo = false;
  var acessoAtual;            /* undefined = ainda não sincronizado; null = não pode ler */
  var geracao = 0;
  var ouvintesFirebase = [];  /* { ref, cb } */
  var ouvintesFonte = {};     /* codigo → { ref, cb, fonteId } */
  var relogioDemora = null;
  var callbacks = [];
  var relogioNotificar = null, assinaturaNotificada = null;

  function db() { return firebase.database(); }
  function novoLido() { return { nome: undefined, erro: false, fonteId: undefined, texto: undefined, textoDe: null, ativo: undefined }; }
  function limparLidos() { lido = {}; catalogo.forEach(function (c) { lido[c] = novoLido(); }); }
  limparLidos();

  function codigos() { return catalogo.slice(); }
  function conhecido(c) { return catalogo.indexOf(c) !== -1; }
  function fabrica(c) { return ROTULO_FABRICA[c] || String(c); }

  function nomeDaTaxonomia(c) {
    var l = lido[c];
    return (l && !l.erro && typeof l.nome === 'string' && l.nome.trim()) ? l.nome.trim() : null;
  }
  function nome(c) {
    var n = nomeDaTaxonomia(c);
    if (n) return n;
    return conhecido(c) ? fabrica(c) : (c ? String(c) : '');
  }
  function usandoContingencia(c) { return !nomeDaTaxonomia(c); }
  /* Só o texto da fonte APONTADA (textoDe guarda de qual fonte o texto veio). */
  function definicao(c) {
    var l = lido[c];
    if (!l || l.erro || typeof l.fonteId !== 'string' || l.textoDe !== l.fonteId) return null;
    return typeof l.texto === 'string' && l.texto.trim() ? l.texto : null;
  }
  /* 'ok' | 'carregando' (sem resposta, dentro do prazo) | 'indisponivel' (sem definição vigente, leitura
     recusada/falhou ou já demorou). "Ainda não sei" nunca vira "não tem". */
  function estadoDefinicao(c) {
    if (definicao(c)) return 'ok';
    var l = lido[c];
    if (!l || l.erro || l.fonteId === null || demorando) return 'indisponivel';
    if (l.fonteId === undefined) return 'carregando';
    return (l.textoDe === l.fonteId || l.texto === null) ? 'indisponivel' : 'carregando';
  }
  var TEXTO_DEF = { carregando: 'Carregando a definição vigente da Taxonomia…', indisponivel: 'Definição vigente indisponível no momento.' };
  function ativo(c) { var l = lido[c]; return l && typeof l.ativo === 'boolean' ? l.ativo : null; }
  function resolvido(c) { var l = lido[c]; return !!l && (l.erro || l.nome !== undefined); }

  function estado() {
    if (!catalogo.length) return 'carregando';
    if (catalogo.every(function (c) { return !usandoContingencia(c); })) return 'ok';
    var algumaFinal = catalogo.some(function (c) { return usandoContingencia(c) && resolvido(c); });
    if (algumaFinal || demorando) return 'contingencia';
    return 'carregando';
  }

  /* Aviso só quando algum código está com o rótulo de contingência E a leitura já terminou mal (demora,
     erro, conceito ausente) — nunca durante uma leitura normal (seria um pisca-pisca). */
  function precisaAviso(lista) {
    var cods = (lista && lista.length) ? lista : codigos();
    return cods.some(function (c) { return conhecido(c) && usandoContingencia(c) && (resolvido(c) || demorando); });
  }
  function escAttr(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
  function avisoHtml(lista, idElemento) {
    var cods = (lista || []).filter(Boolean);
    return '<p class="fa-classif-aviso" role="status" data-fa-posic-aviso="' + escAttr(cods.join(',')) + '"' +
      (idElemento ? ' id="' + escAttr(idElemento) + '"' : '') + (precisaAviso(cods) ? '' : ' hidden') + '>' + TEXTO_AVISO + '</p>';
  }
  /* <span> que se atualiza sozinho (atualizarDom) com o nome atual do código. */
  function spanNome(c, classe, idElemento) {
    if (!c || !conhecido(c)) return escAttr(c || '');
    return '<span class="' + escAttr(classe || 'fa-posic') + '" data-fa-posic="' + escAttr(c) + '"' +
      (idElemento ? ' id="' + escAttr(idElemento) + '"' : '') + '>' + escAttr(nome(c)) + '</span>';
  }
  /* Definição vigente; some quando não há. Com opcoes.comEstado nunca some: sem definição mostra
     "Carregando…" ou "indisponível" (sem texto de fábrica). opcoes.tag: 'span' dentro de uma frase. */
  function definicaoHtml(c, idElemento, opcoes) {
    if (!conhecido(c)) return '';
    var o = opcoes || {}, tag = o.tag === 'span' ? 'span' : 'p';
    var d = definicao(c), est = estadoDefinicao(c);
    var texto = d || (o.comEstado ? TEXTO_DEF[est] : '');
    return '<' + tag + ' class="fa-classif-def' + (o.comEstado && !d ? ' fa-classif-def--sem' : '') + '" data-fa-posic-def="' + escAttr(c) + '"' +
      (o.comEstado ? ' data-fa-def-estado="' + est + '"' : '') + (idElemento ? ' id="' + escAttr(idElemento) + '"' : '') +
      (d || o.comEstado ? '' : ' hidden') + '>' + escAttr(texto) + '</' + tag + '>';
  }

  /* Atualização no lugar (sem redesenhar formulário nenhum). Atributos próprios (data-fa-posic*): não
     se mistura com os de faClassificacoes. */
  function atualizarDom(raiz) {
    if (!raiz || !raiz.querySelectorAll) return;
    raiz.querySelectorAll('[data-fa-posic]').forEach(function (el) {
      var t = nome(el.getAttribute('data-fa-posic'));
      if (el.textContent !== t) el.textContent = t;
    });
    raiz.querySelectorAll('[data-fa-posic-def]').forEach(function (el) {
      var c = el.getAttribute('data-fa-posic-def'), d = definicao(c);
      var comEstado = el.hasAttribute('data-fa-def-estado'), est = estadoDefinicao(c);
      var t = d || (comEstado ? TEXTO_DEF[est] : '');
      if (el.textContent !== t) el.textContent = t;
      if (comEstado) { el.setAttribute('data-fa-def-estado', est); el.classList.toggle('fa-classif-def--sem', !d); }
      el.hidden = !d && !comEstado;
    });
    raiz.querySelectorAll('[data-fa-posic-aviso]').forEach(function (el) {
      var cods = String(el.getAttribute('data-fa-posic-aviso') || '').split(',').filter(Boolean);
      el.hidden = !precisaAviso(cods);
    });
  }

  function assinatura() {
    return JSON.stringify([estado(), demorando, catalogo.map(function (c) {
      return [nome(c), usandoContingencia(c), resolvido(c), definicao(c), estadoDefinicao(c), ativo(c)];
    })]);
  }
  /* As respostas chegam quase juntas: agrupa num aviso só, e só avisa se algo visível mudou. */
  function notificar() {
    clearTimeout(relogioNotificar);
    relogioNotificar = setTimeout(function () {
      relogioNotificar = null;
      var a = assinatura();
      if (a === assinaturaNotificada) return;
      assinaturaNotificada = a;
      if (typeof document !== 'undefined') atualizarDom(document);
      callbacks.slice().forEach(function (cb) { try { cb(); } catch (e) { console.error('[posicionamentos]', e); } });
    }, 30);
  }

  /* null = ainda não pode ler (sem login, acesso à Avaliação não resolvido, ou sem acesso). */
  function acessoParaLeitura() {
    var a = window.faAuth;
    if (!a || !a.podeAvaliacao) return null;
    if (a.isAvaliacaoReady && !a.isAvaliacaoReady()) return null;
    if (!a.podeAvaliacao()) return null;
    var u = null;
    try { u = firebase.auth().currentUser; } catch (e) { /* sem Auth */ }
    return u && u.email ? String(u.email).toLowerCase() : 'autorizado';
  }

  function desligarFonte(c) {
    var o = ouvintesFonte[c];
    if (o) { try { o.ref.off('value', o.cb); } catch (e) { /* já cancelada pelo banco */ } }
    delete ouvintesFonte[c];
  }
  function desligar() {
    geracao++;
    ouvintesFirebase.forEach(function (o) { try { o.ref.off('value', o.cb); } catch (e) { /* já cancelada pelo banco */ } });
    ouvintesFirebase = [];
    Object.keys(ouvintesFonte).forEach(desligarFonte);
    clearTimeout(relogioDemora); relogioDemora = null;
  }
  function ouvir(caminho, minha, aoValor, aoErro) {
    var ref = db().ref(caminho);
    var cb = function (snap) { if (minha === geracao) aoValor(snap.val()); };
    var erro = function (err) {
      if (minha !== geracao) return;
      console.error('[posicionamentos] não foi possível ler ' + caminho + ':', err);
      aoErro();
    };
    ref.on('value', cb, erro);
    return { ref: ref, cb: cb };
  }
  /* Liga (ou religa) a leitura do texto da fonte APONTADA pelo conceito. */
  function apontarFonte(c, fonteId, minha) {
    var atual = ouvintesFonte[c];
    if (atual && atual.fonteId === fonteId) return;
    desligarFonte(c);
    lido[c].texto = undefined; lido[c].textoDe = null;
    if (!fonteId) return;
    try {
      var o = ouvir(RAIZ + '/fontes/' + c + '/' + fonteId + '/texto', minha, function (v) {
        if (lido[c].fonteId !== fonteId) return; /* o ponteiro já mudou */
        lido[c].texto = typeof v === 'string' ? v : null;
        lido[c].textoDe = fonteId;
        notificar();
      }, function () { lido[c].texto = null; lido[c].textoDe = null; notificar(); });
      o.fonteId = fonteId;
      ouvintesFonte[c] = o;
    } catch (e) { console.error('[posicionamentos] erro ao ler a definição de ' + c + ':', e); }
  }
  function ligar() {
    desligar();
    var minha = geracao;
    limparLidos();
    demorando = false;
    relogioDemora = setTimeout(function () {
      if (minha !== geracao) return;
      demorando = true;
      notificar();
    }, TEMPO_DEMORA_MS);
    catalogo.forEach(function (c) {
      function falhou() { lido[c].erro = true; notificar(); }
      try {
        ouvintesFirebase.push(ouvir(RAIZ + '/conceitos/' + c + '/nome', minha, function (v) {
          lido[c].nome = typeof v === 'string' ? v : null;
          notificar();
        }, falhou));
        ouvintesFirebase.push(ouvir(RAIZ + '/conceitos/' + c + '/ativo', minha, function (v) {
          lido[c].ativo = typeof v === 'boolean' ? v : undefined;
          notificar();
        }, function () { /* ativo é só informativo: sem ele, nada muda */ }));
        ouvintesFirebase.push(ouvir(RAIZ + '/conceitos/' + c + '/definicaoVigenteFonteId', minha, function (v) {
          var fid = typeof v === 'string' && v ? v : null;
          lido[c].fonteId = fid;
          apontarFonte(c, fid, minha);
          notificar();
        }, function () { lido[c].fonteId = null; apontarFonte(c, null, minha); notificar(); }));
      } catch (e) {
        console.error('[posicionamentos] erro ao iniciar a leitura de ' + c + ':', e);
        lido[c].erro = true;
      }
    });
    notificar();
  }
  /* Pessoa ou acesso mudou → desliga tudo e, se a nova sessão pode ler, religa. */
  function sincronizar() {
    if (!ativoModulo) return;
    var acesso = acessoParaLeitura();
    if (acesso === acessoAtual) return;
    acessoAtual = acesso;
    if (acesso === null) { desligar(); limparLidos(); demorando = false; notificar(); return; }
    ligar();
  }
  function recarregar() {
    if (!ativoModulo) return;
    acessoAtual = acessoParaLeitura();
    if (acessoAtual === null) { desligar(); limparLidos(); demorando = false; notificar(); return; }
    ligar();
  }
  function iniciar() {
    if (ativoModulo) return;
    ativoModulo = true;
    ['fa-auth-ready', 'fa-auth-change', 'fa-admin-ready', 'fa-avaliacao-ready'].forEach(function (ev) {
      window.addEventListener(ev, sincronizar);
    });
    sincronizar();
  }
  function onMudanca(cb) { if (typeof cb === 'function') callbacks.push(cb); iniciar(); }

  window.faPosicionamentos = {
    TEXTO_AVISO: TEXTO_AVISO, TEMPO_DEMORA_MS: TEMPO_DEMORA_MS, ROTULO_FABRICA: ROTULO_FABRICA,
    codigos: codigos,
    nome: nome, definicao: definicao, estadoDefinicao: estadoDefinicao, ativo: ativo, estado: estado, usandoContingencia: usandoContingencia,
    onMudanca: onMudanca, iniciar: iniciar, recarregar: recarregar,
    precisaAviso: precisaAviso, avisoHtml: avisoHtml, spanNome: spanNome,
    definicaoHtml: definicaoHtml, atualizarDom: atualizarDom
  };
})();
