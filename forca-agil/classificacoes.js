/* ============================================================
   Força Ágil — Nome e definição das classificações da Avaliação (window.faClassificacoes)

   FONTE ÚNICA. A Taxonomia Arquitetural (taxonomia/arquitetural, editada em Admin › Taxonomia) é a
   ÚNICA fonte editável do NOME e da DEFINIÇÃO das classificações que o motor arquitetural produz.
   A Avaliação continua dona do MOTOR e dos CÓDIGOS (o id da camada que identificarCamada devolve:
   'produto-principal', 'canal'…). O motor nunca lê a Taxonomia: este módulo só diz como um código
   se chama e o que ele significa — nunca decide nada.

   SEM TABELA DE LIGAÇÃO: o conceito lido é o de MESMO código (taxonomia/arquitetural/conceitos/<id>).
   O catálogo de códigos é o CAMADAS de avaliacao-produto.js, registrado aqui por registrarCatalogo
   (código + rótulo de fábrica). O rótulo de fábrica é só CONTINGÊNCIA — usado quando a Taxonomia
   ainda não respondeu e já demorou, recusou a leitura ou não tem o conceito.

   O QUE É LIDO (só isto — as regras do banco liberam à audiência da Avaliação só estes caminhos):
     taxonomia/arquitetural/conceitos/<id>/nome
     taxonomia/arquitetural/conceitos/<id>/ativo
     taxonomia/arquitetural/conceitos/<id>/definicaoVigenteFonteId
     taxonomia/arquitetural/fontes/<id>/<definicaoVigenteFonteId>/texto
   A definição vem EXATAMENTE da fonte apontada por definicaoVigenteFonteId — nunca de uma fonte
   escolhida por ter situacao 'vigente'. Leituras ao vivo (.on): renomear um conceito muda a tela
   sem recarregar; trocar a definição vigente desliga a leitura da fonte antiga e liga a da nova.
   ativo === false não esconde nada: o nome atual continua sendo mostrado (só apresentação).

   CONTINGÊNCIA: nunca bloqueia nada (concluir, reprocessar, exportar seguem funcionando) e nunca
   altera resultado, código, decisão ou histórico — só o texto exibido. Quem mostra o nome mostra
   também um aviso discreto ("Rótulo de contingência"). Não há definição de contingência.

   Mesmo padrão de sessão de naturezas-config.js: só lê com sessão autorizada para a Avaliação;
   troca de pessoa/acesso desliga tudo (geração) e religa; resposta de leitura antiga é descartada.

   API: registrarCatalogo(lista, {sufixoConflito, sufixosAValidar}), codigos(), nome(id), definicao(id), estadoDefinicao(id), ativo(id),
   estado() ('carregando'|'ok'|'contingencia'), usandoContingencia(id), onMudanca(cb), iniciar(),
   recarregar(), rotulo(camadaSugerida), rotuloNaConclusao(camadaSugerida), precisaAviso(ids),
   avisoHtml(ids, idElemento), definicaoHtml(id, idElemento, {comEstado, tag}), atualizarDom(raiz),
   TEXTO_AVISO, TEMPO_DEMORA_MS. */
(function () {
  var RAIZ = 'taxonomia/arquitetural';
  var TEMPO_DEMORA_MS = 6000;
  var TEXTO_AVISO = 'Rótulo de contingência: o nome desta classificação não pôde ser lido da Taxonomia Arquitetural agora; está sendo mostrado o nome de fábrica.';

  var catalogo = [];          /* [{ id, label }] — registrado por avaliacao-produto.js (CAMADAS) */
  var fabrica = {};           /* id → rótulo de fábrica (contingência) */
  var sufixoConflito = '';
  var sufixosAValidar = {};   /* versão 7: tipo de "A validar" no rótulo (incoerência, conflito, recorte) */

  /* Por código: undefined = ainda não respondeu; null = respondeu "não existe". */
  var lido = {};
  var demorando = false;
  var ativoModulo = false;
  var acessoAtual;            /* undefined = ainda não sincronizado; null = não pode ler */
  var geracao = 0;
  var ouvintesFirebase = [];  /* { ref, cb } */
  var ouvintesFonte = {};     /* id → { ref, cb, fonteId } */
  var relogioDemora = null;
  var callbacks = [];
  var relogioNotificar = null, assinaturaNotificada = null;

  function db() { return firebase.database(); }
  function novoLido() { return { nome: undefined, erro: false, fonteId: undefined, texto: undefined, textoDe: null, ativo: undefined }; }
  function limparLidos() { lido = {}; catalogo.forEach(function (c) { lido[c.id] = novoLido(); }); }

  function registrarCatalogo(lista, opcoes) {
    catalogo = (lista || []).map(function (c) { return { id: c.id, label: c.label }; });
    fabrica = {};
    catalogo.forEach(function (c) { fabrica[c.id] = c.label; });
    sufixoConflito = (opcoes && opcoes.sufixoConflito) || '';
    sufixosAValidar = (opcoes && opcoes.sufixosAValidar) || {};
    limparLidos();
    if (ativoModulo && acessoAtual) ligar();
  }
  function codigos() { return catalogo.map(function (c) { return c.id; }); }
  function conhecido(id) { return Object.prototype.hasOwnProperty.call(fabrica, id); }

  function nomeDaTaxonomia(id) {
    var l = lido[id];
    return (l && !l.erro && typeof l.nome === 'string' && l.nome.trim()) ? l.nome.trim() : null;
  }
  function nome(id) {
    var n = nomeDaTaxonomia(id);
    if (n) return n;
    return conhecido(id) ? fabrica[id] : (id ? String(id) : '');
  }
  function usandoContingencia(id) { return !nomeDaTaxonomia(id); }
  /* Só o texto da fonte APONTADA (textoDe guarda de qual fonte o texto veio). */
  function definicao(id) {
    var l = lido[id];
    if (!l || l.erro || typeof l.fonteId !== 'string' || l.textoDe !== l.fonteId) return null;
    return typeof l.texto === 'string' && l.texto.trim() ? l.texto : null;
  }
  /* Estado da definição: 'ok' (texto da fonte apontada), 'carregando' (ainda sem resposta, dentro do
     prazo) ou 'indisponivel' (sem definição vigente, leitura recusada/falhou ou já demorou demais).
     "Ainda não sei" nunca vira "não tem": só é 'indisponivel' quando a resposta chegou ou o prazo passou. */
  function estadoDefinicao(id) {
    if (definicao(id)) return 'ok';
    var l = lido[id];
    if (!l || l.erro || l.fonteId === null || demorando) return 'indisponivel';
    if (l.fonteId === undefined) return 'carregando';
    return (l.textoDe === l.fonteId || l.texto === null) ? 'indisponivel' : 'carregando';
  }
  var TEXTO_DEF = { carregando: 'Carregando a definição vigente da Taxonomia…', indisponivel: 'Definição vigente indisponível no momento.' };
  function ativo(id) { var l = lido[id]; return l && typeof l.ativo === 'boolean' ? l.ativo : null; }
  /* Respondeu de vez (com nome, sem conceito, ou com erro)? */
  function resolvido(id) { var l = lido[id]; return !!l && (l.erro || l.nome !== undefined); }

  function estado() {
    if (!catalogo.length) return 'carregando';
    var ids = codigos();
    if (ids.every(function (id) { return !usandoContingencia(id); })) return 'ok';
    var algumaFinal = ids.some(function (id) { return usandoContingencia(id) && resolvido(id); });
    if (algumaFinal || demorando) return 'contingencia';
    return 'carregando';
  }

  /* Rótulo ATUAL de uma classificação gravada (item.camadaSugerida): nome atual pelo código, mais o
     sufixo do conflito de naturezas quando a avaliação o tem. Código desconhecido: o que está gravado. */
  function rotulo(camada) {
    if (!camada) return '';
    if (!camada.id || !conhecido(camada.id)) return camada.label || camada.id || '';
    if (camada.tipoAValidar && sufixosAValidar[camada.tipoAValidar]) return nome(camada.id) + sufixosAValidar[camada.tipoAValidar];
    return nome(camada.id) + (camada.conflitoNaturezas ? sufixoConflito : '');
  }
  /* Rótulo REGISTRADO na conclusão, só quando difere do atual ('' quando igual ou ausente). */
  function rotuloNaConclusao(camada) {
    if (!camada || !camada.label) return '';
    return camada.label !== rotulo(camada) ? camada.label : '';
  }

  /* Aviso só quando algum dos ids está com o rótulo de contingência E a leitura já terminou mal
     (demora, erro, conceito ausente) — nunca durante uma leitura normal (seria um pisca-pisca). */
  function precisaAviso(ids) {
    var lista = (ids && ids.length) ? ids : codigos();
    return lista.some(function (id) {
      return conhecido(id) && usandoContingencia(id) && (resolvido(id) || demorando);
    });
  }
  function avisoHtml(ids, idElemento) {
    var lista = (ids || []).filter(Boolean);
    return '<p class="fa-classif-aviso" role="status" data-fa-classif-aviso="' + lista.join(',') + '"' +
      (idElemento ? ' id="' + idElemento + '"' : '') + (precisaAviso(lista) ? '' : ' hidden') + '>' + TEXTO_AVISO + '</p>';
  }
  function escAttr(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  /* <span> que se atualiza sozinho (atualizarDom) com o nome atual do código. */
  function spanNome(camada, classe, idElemento) {
    var id = camada && camada.id;
    if (!id || !conhecido(id)) return escAttr(rotulo(camada));
    return '<span class="' + (classe || 'fa-classif') + '" data-fa-classif="' + escAttr(id) + '"' +
      (camada.conflitoNaturezas ? ' data-fa-conflito="1"' : '') + (idElemento ? ' id="' + idElemento + '"' : '') + '>' + escAttr(rotulo(camada)) + '</span>';
  }
  /* "(na conclusão: X)" — some sozinho quando o nome atual volta a ser igual ao registrado. */
  function spanNaConclusao(camada, formato, idElemento) {
    if (!camada || !camada.label || !camada.id || !conhecido(camada.id)) return '';
    var fmt = formato || 'na conclusão: {}';
    return '<span class="fa-classif-epoca" data-fa-epoca-de="' + escAttr(camada.id) + '"' + (camada.conflitoNaturezas ? ' data-fa-conflito="1"' : '') +
      ' data-fa-epoca="' + escAttr(camada.label) + '" data-fa-epoca-formato="' + escAttr(fmt) + '"' + (idElemento ? ' id="' + idElemento + '"' : '') +
      (rotuloNaConclusao(camada) ? '' : ' hidden') + '>' + escAttr(fmt.replace('{}', camada.label)) + '</span>';
  }
  /* Definição vigente; some quando não há. Com opcoes.comEstado, nunca some: sem definição mostra
     "Carregando…" ou "indisponível" (sem texto de fábrica — não há definição de contingência).
     opcoes.tag: 'span' para usar dentro de uma frase. */
  function definicaoHtml(id, idElemento, opcoes) {
    if (!conhecido(id)) return '';
    var o = opcoes || {}, tag = o.tag === 'span' ? 'span' : 'p';
    var d = definicao(id), est = estadoDefinicao(id);
    var texto = d || (o.comEstado ? TEXTO_DEF[est] : '');
    return '<' + tag + ' class="fa-classif-def' + (o.comEstado && !d ? ' fa-classif-def--sem' : '') + '" data-fa-classif-def="' + escAttr(id) + '"' +
      (o.comEstado ? ' data-fa-def-estado="' + est + '"' : '') + (idElemento ? ' id="' + idElemento + '"' : '') +
      (d || o.comEstado ? '' : ' hidden') + '>' + escAttr(texto) + '</' + tag + '>';
  }

  /* Atualização no lugar (sem redesenhar formulário nenhum). */
  function atualizarDom(raiz) {
    if (!raiz || !raiz.querySelectorAll) return;
    raiz.querySelectorAll('[data-fa-classif]').forEach(function (el) {
      var t = rotulo({ id: el.getAttribute('data-fa-classif'), conflitoNaturezas: el.getAttribute('data-fa-conflito') === '1' });
      if (el.textContent !== t) el.textContent = t;
    });
    raiz.querySelectorAll('[data-fa-epoca-de]').forEach(function (el) {
      var camada = { id: el.getAttribute('data-fa-epoca-de'), conflitoNaturezas: el.getAttribute('data-fa-conflito') === '1', label: el.getAttribute('data-fa-epoca') };
      el.hidden = !rotuloNaConclusao(camada);
    });
    raiz.querySelectorAll('[data-fa-classif-def]').forEach(function (el) {
      var id = el.getAttribute('data-fa-classif-def'), d = definicao(id);
      var comEstado = el.hasAttribute('data-fa-def-estado'), est = estadoDefinicao(id);
      var t = d || (comEstado ? TEXTO_DEF[est] : '');
      if (el.textContent !== t) el.textContent = t;
      if (comEstado) { el.setAttribute('data-fa-def-estado', est); el.classList.toggle('fa-classif-def--sem', !d); }
      el.hidden = !d && !comEstado;
    });
    raiz.querySelectorAll('[data-fa-classif-aviso]').forEach(function (el) {
      var ids = String(el.getAttribute('data-fa-classif-aviso') || '').split(',').filter(Boolean);
      el.hidden = !precisaAviso(ids);
    });
  }

  function assinatura() {
    return JSON.stringify([estado(), demorando, codigos().map(function (id) {
      return [nome(id), usandoContingencia(id), resolvido(id), definicao(id), estadoDefinicao(id), ativo(id)];
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
      callbacks.slice().forEach(function (cb) { try { cb(); } catch (e) { console.error('[classificacoes]', e); } });
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

  function desligarFonte(id) {
    var o = ouvintesFonte[id];
    if (o) { try { o.ref.off('value', o.cb); } catch (e) { /* já cancelada pelo banco */ } }
    delete ouvintesFonte[id];
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
      console.error('[classificacoes] não foi possível ler ' + caminho + ':', err);
      aoErro();
    };
    ref.on('value', cb, erro);
    return { ref: ref, cb: cb };
  }
  /* Liga (ou religa) a leitura do texto da fonte APONTADA pelo conceito. */
  function apontarFonte(id, fonteId, minha) {
    var atual = ouvintesFonte[id];
    if (atual && atual.fonteId === fonteId) return;
    desligarFonte(id);
    lido[id].texto = undefined; lido[id].textoDe = null;
    if (!fonteId) return;
    try {
      var o = ouvir(RAIZ + '/fontes/' + id + '/' + fonteId + '/texto', minha, function (v) {
        if (lido[id].fonteId !== fonteId) return; /* o ponteiro já mudou */
        lido[id].texto = typeof v === 'string' ? v : null;
        lido[id].textoDe = fonteId;
        notificar();
      }, function () { lido[id].texto = null; lido[id].textoDe = null; notificar(); });
      o.fonteId = fonteId;
      ouvintesFonte[id] = o;
    } catch (e) { console.error('[classificacoes] erro ao ler a definição de ' + id + ':', e); }
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
    codigos().forEach(function (id) {
      function falhou() { lido[id].erro = true; notificar(); }
      try {
        ouvintesFirebase.push(ouvir(RAIZ + '/conceitos/' + id + '/nome', minha, function (v) {
          lido[id].nome = typeof v === 'string' ? v : null;
          notificar();
        }, falhou));
        ouvintesFirebase.push(ouvir(RAIZ + '/conceitos/' + id + '/ativo', minha, function (v) {
          lido[id].ativo = typeof v === 'boolean' ? v : undefined;
          notificar();
        }, function () { /* ativo é só informativo: sem ele, nada muda */ }));
        ouvintesFirebase.push(ouvir(RAIZ + '/conceitos/' + id + '/definicaoVigenteFonteId', minha, function (v) {
          var fid = typeof v === 'string' && v ? v : null;
          lido[id].fonteId = fid;
          apontarFonte(id, fid, minha);
          notificar();
        }, function () { lido[id].fonteId = null; apontarFonte(id, null, minha); notificar(); }));
      } catch (e) {
        console.error('[classificacoes] erro ao iniciar a leitura de ' + id + ':', e);
        lido[id].erro = true;
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

  window.faClassificacoes = {
    TEXTO_AVISO: TEXTO_AVISO, TEMPO_DEMORA_MS: TEMPO_DEMORA_MS,
    registrarCatalogo: registrarCatalogo, codigos: codigos,
    nome: nome, definicao: definicao, estadoDefinicao: estadoDefinicao, ativo: ativo, estado: estado, usandoContingencia: usandoContingencia,
    rotulo: rotulo, rotuloNaConclusao: rotuloNaConclusao,
    onMudanca: onMudanca, iniciar: iniciar, recarregar: recarregar,
    precisaAviso: precisaAviso, avisoHtml: avisoHtml, spanNome: spanNome, spanNaConclusao: spanNaConclusao,
    definicaoHtml: definicaoHtml, atualizarDom: atualizarDom
  };
})();
