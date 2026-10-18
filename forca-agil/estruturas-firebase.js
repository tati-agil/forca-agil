/* ============================================================
   Força Ágil — Núcleo de Avaliação, Taxonomia e Mapa da Floresta
   ESTRUTURAS ORGANIZACIONAIS CONCRETAS — ADAPTADOR FIREBASE (Realtime Database)
   (window.faEstruturasFirebase; em Node, module.exports)

   Implementa as portas de persistência de estruturas-casos-de-uso.js sobre o Realtime Database. Não tem regra de
   negócio: quem decide é o núcleo (pelo caso de uso) e quem GARANTE no banco é database.rules.json. Uma operação
   aceita grava, numa ÚNICA gravação multipath, os registros que mudaram + um evento por mudança + a operação:
     família ESTRUTURA (nó estruturas-concretas):
       registros/<id>             a estrutura (+ ultimaOperacao, só do banco)
       eventos/<operacao>:1       o evento de auditoria (sem "antes" — ver abaixo)
       operacoes/<operacao>       a operação (idempotência: existe ⇔ foi aplicada)
     família SUBAGRUPADOR (Etapa 5; nó mapa-subagrupadores — agrupamento de apresentação do Mapa):
       registros/<id>             o subagrupador (+ ultimaOperacao, ultimoEvento)
       associacoes/<id>           a associação Linha × subagrupador (+ ultimaOperacao, ultimoEvento)
       ativa-por-estrutura/<estrutura>  índice: a associação ATIVA da Linha (no máximo uma, garantido pelas regras)
       eventos/<operacao>:<n>     um evento por mudança (uma troca de subagrupador tem dois)
       operacoes/<operacao>
     família VÍNCULO (M3 do Mapa; nó estruturas-vinculos — item × estrutura responsável principal):
       registros/<id>             o vínculo (+ ultimaOperacao, ultimoEvento)
       ativo-por-objeto/<item>    índice: o vínculo ATIVO de responsável principal do item (no máximo um, pelas regras)
       colaboradoras-ativas/<item>/<estrutura>  índice (E3): a colaboradora ATIVA daquela estrutura no item (nenhuma duplicata)
       eventos/<operacao>:<n>     um evento por mudança (uma substituição tem dois)
       operacoes/<operacao>       (+ objetoId)
     família RELAÇÃO (M6/M7 do Mapa; nó estruturas-relacoes — relações entre estruturas, R1–R7 e C3):
       registros/<id>             a relação (+ ultimaOperacao, ultimoEvento)
       ativa-por-chave/<origem>__<tipo>__<destino>  índice: a relação ATIVA daquela combinação (nenhuma duplicata)
       compoe-ativa-por-origem/<origem>             índice: o "compõe" ATIVO da estrutura (C3: um Squad, uma Linha)
       eventos/<operacao>:<n>     um evento por mudança (alterar = encerrar + criar: dois)
       operacoes/<operacao>       (+ origem)
   e as regras recusam qualquer parte sozinha, apagar, reativar, mudar o que é imutável, pular revisão, autoria
   diferente do token e horário diferente do horário do SERVIDOR.

   Horário: o núcleo recebe ctx.agora só para decidir; o que se grava nos campos de horário que a operação define é
   o horário do servidor ({'.sv':'timestamp'}), igual em registro, evento e operação (uma gravação só).
   "antes" do evento: não é gravado; na leitura é o "depois" do evento anterior da mesma entidade (o registro só
   muda junto com um evento, e as regras conferem que o "depois" é o registro gravado) — não há cópia a adulterar.

   criarPortas({ db, codigosFirmes, prazoMs }) → { lerReferencias, lerEstado, gravar, conferirOperacao, lerEventos }
     db = firebase.database() (SDK compat) da pessoa que está agindo; autoria e permissão vêm do token dela.
   ============================================================ */
(function () {
  'use strict';

  var RAIZ = 'estruturas-concretas';
  var RAIZ_SUBAGRUPADORES = 'mapa-subagrupadores';
  var RAIZ_VINCULOS = 'estruturas-vinculos';
  var RAIZ_RELACOES = 'estruturas-relacoes';
  /* HABILITAÇÃO OPERACIONAL (antes "trava de produção"): as regras só aceitam gravar em estruturas-concretas, mapa-subagrupadores,
     estruturas-vinculos e estruturas-relacoes com este marcador
     = true. Nenhum cliente o grava (nem admin geral): só o console ou uma conta de serviço. Os três perfis da Avaliação o
     LEEM (decisão D2, 2026-10-13): ausente = telas desligadas; false = só consulta; true = manutenção. A paridade com o
     PostgreSQL é requisito da migração futura, não da operação no Firebase. No emulador, a semente do ambiente de testes liga. */
  var TRAVA_PRODUCAO = 'estruturas-concretas-config/gravacaoHabilitada';
  var AGORA_DO_SERVIDOR = { '.sv': 'timestamp' };
  /* onde cada entidade mora e quais são os seus campos de horário */
  var ENTIDADES = {
    estrutura: { familia: RAIZ, colecao: 'estruturas', no: RAIZ + '/registros', horarios: ['criadaEm', 'alteradaEm', 'encerramento.em'] },
    subagrupador: { familia: RAIZ_SUBAGRUPADORES, colecao: 'subagrupadores', no: RAIZ_SUBAGRUPADORES + '/registros', horarios: ['criadoEm', 'alteradoEm', 'encerramento.em'] },
    'associacao-subagrupador': { familia: RAIZ_SUBAGRUPADORES, colecao: 'associacoesSubagrupador', no: RAIZ_SUBAGRUPADORES + '/associacoes', horarios: ['criadaEm', 'encerramento.em'] },
    vinculo: { familia: RAIZ_VINCULOS, colecao: 'vinculos', no: RAIZ_VINCULOS + '/registros', horarios: ['criadoEm', 'encerramento.em'] },
    relacao: { familia: RAIZ_RELACOES, colecao: 'relacoes', no: RAIZ_RELACOES + '/registros', horarios: ['criadaEm', 'encerramento.em'] }
  };
  var CAMPOS_SO_DO_BANCO = ['ultimaOperacao', 'ultimoEvento'];

  function clone(v) { return v === undefined || v === null ? v : JSON.parse(JSON.stringify(v)); }
  function ler(o, caminho) { return caminho.split('.').reduce(function (a, k) { return a && typeof a === 'object' ? a[k] : undefined; }, o); }
  function definir(o, caminho, v) { var p = caminho.split('.'), a = o; for (var i = 0; i < p.length - 1; i++) a = a[p[i]]; a[p[p.length - 1]] = v; }
  /* o Realtime Database não guarda null: um campo nulo é um campo ausente */
  function semNulos(v) {
    if (Array.isArray(v)) return v.map(semNulos);
    if (v && typeof v === 'object') { var o = {}; Object.keys(v).forEach(function (k) { if (v[k] !== null && v[k] !== undefined) o[k] = semNulos(v[k]); }); return o; }
    return v;
  }
  /* devolve o registro no formato do núcleo (campos só do banco fora; na estrutura, opcionais ausentes = null) */
  function doBanco(e, entidade) {
    var x = clone(e); CAMPOS_SO_DO_BANCO.forEach(function (c) { delete x[c]; });
    if ((entidade || 'estrutura') === 'estrutura') { if (!('sigla' in x)) x.sigla = null; if (!('descricao' in x)) x.descricao = null; }
    if ((entidade === 'vinculo' || entidade === 'relacao') && !('justificativa' in x)) x.justificativa = null;
    return x;
  }
  /* horário do servidor nos campos que ESTA operação define (os que mudaram em relação a antes) */
  function comHorarioDoServidor(depois, antes, entidade) {
    var x = clone(depois);
    ENTIDADES[entidade].horarios.forEach(function (c) { var v = ler(x, c); if (v !== undefined && v !== null && (!antes || ler(antes, c) !== v)) definir(x, c, AGORA_DO_SERVIDOR); });
    return x;
  }
  function recusa(codigo) { return { codigo: codigo }; }
  /* toda leitura e gravação de uma operação tem prazo: com a conexão parada, once() de um caminho fora do cache local
     espera para sempre, e a tela ficava em "Salvando…" (homologação, 2026-10-13). Prazo vencido = SEM_RESPOSTA */
  var PRAZO_PADRAO = 20000;
  function comPrazo(p, prazoMs) {
    var t, venceu = new Promise(function (_, rej) { t = setTimeout(function () { rej(recusa('SEM_RESPOSTA')); }, prazoMs || PRAZO_PADRAO); });
    return Promise.race([p, venceu]).then(function (v) { clearTimeout(t); return v; }, function (e) { clearTimeout(t); return Promise.reject(e); });
  }
  /* gravações enviadas cujo servidor ainda não confirmou (operação → promessa do update). O SDK mostra a gravação
     pendente no cache local, então ler o banco agora NÃO confirma nada: enquanto a operação está aqui, ela não conta
     como aplicada e não é enviada de novo (o SDK já a reenvia sozinho quando a conexão volta) */
  var naoConfirmadas = {};
  function ehNegado(e) { var t = String((e && (e.code || e.message)) || '').toLowerCase(); return t.indexOf('permission') !== -1 || t.indexOf('denied') !== -1; }
  function familiaDe(op) { var ent = op.mudancas[0] && ENTIDADES[op.mudancas[0].entidade]; return ent ? ent.familia : null; }

  /* os índices que cada registro ocupa enquanto está ativo (e libera ao encerrar) */
  function chaveRelacao(r) { return r.origem + '__' + r.tipo + '__' + r.destino; }
  function indicesDe(m) {
    var d = m.depois;
    if (m.entidade === 'associacao-subagrupador') return [RAIZ_SUBAGRUPADORES + '/ativa-por-estrutura/' + d.estruturaId];
    if (m.entidade === 'vinculo') return [d.papel === 'colaboradora' ? RAIZ_VINCULOS + '/colaboradoras-ativas/' + d.objetoId + '/' + d.estruturaId : RAIZ_VINCULOS + '/ativo-por-objeto/' + d.objetoId];
    if (m.entidade === 'relacao') return [RAIZ_RELACOES + '/ativa-por-chave/' + chaveRelacao(d)].concat(d.tipo === 'compoe' ? [RAIZ_RELACOES + '/compoe-ativa-por-origem/' + d.origem] : []);
    return [];
  }
  /* a gravação multipath ÚNICA de uma operação (pura; exportada para os testes adulterarem uma gravação válida) */
  function montarGravacao(op) {
    var multi = {}, familia = familiaDe(op), indice = {};
    op.mudancas.forEach(function (m, i) {
      var ent = ENTIDADES[m.entidade], ev = clone(op.eventos[i]);
      var reg = semNulos(comHorarioDoServidor(m.depois, m.antes, m.entidade)); reg.ultimaOperacao = op.id;
      if (familia !== RAIZ) reg.ultimoEvento = ev.id;
      delete ev.antes;
      ev.depois = semNulos(comHorarioDoServidor(ev.depois, m.antes, m.entidade)); ev.em = AGORA_DO_SERVIDOR;
      multi[ent.no + '/' + m.id] = reg;
      multi[familia + '/eventos/' + ev.id] = semNulos(ev);
      /* índices (associação ativa da Linha, responsável ativo do item, relação ativa da combinação e "compõe" ativo da
         estrutura): o registro ativo ocupa; o que se encerra libera, se nada ocupou na mesma operação */
      indicesDe(m).forEach(function (c) {
        if (m.depois.situacao === 'ativa') indice[c] = m.id;
        else if (!(c in indice)) indice[c] = null;
      });
    });
    Object.keys(indice).forEach(function (c) { multi[c] = indice[c]; });
    var registroOp = { tipo: op.tipo, usuario: semNulos({ id: op.usuario.id, email: op.usuario.email }), em: AGORA_DO_SERVIDOR };
    if (familia === RAIZ) registroOp.estruturaId = op.mudancas[0].id;
    if (familia === RAIZ_VINCULOS) registroOp.objetoId = op.mudancas[0].depois.objetoId;
    if (familia === RAIZ_RELACOES) registroOp.origem = op.mudancas[0].depois.origem;
    multi[familia + '/operacoes/' + op.id] = registroOp;
    return multi;
  }

  /* o nó gravado → formato do contrato (puras; usadas pelas portas e pela leitura ao vivo das telas) */
  function registrosDoValor(v, entidade) { var out = {}; Object.keys(v || {}).forEach(function (id) { out[id] = doBanco(v[id], entidade); }); return out; }
  function estruturasDoValor(v) { return registrosDoValor(v, 'estrutura'); }
  /* eventos na ordem gravada (horário do servidor, depois id), com "antes" = "depois" do evento anterior da mesma
     entidade; aceita vários nós de eventos (uma família por nó) */
  function eventosDoValor() {
    var lista = [];
    Array.prototype.forEach.call(arguments, function (v) { Object.keys(v || {}).forEach(function (k) { lista.push(v[k]); }); });
    lista.sort(function (a, b) { return a.em !== b.em ? a.em - b.em : (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); });
    var ultimo = {};
    return lista.map(function (ev) {
      var x = clone(ev), chave = (x.entidade || 'estrutura') + ':' + x.entidadeId;
      x.antes = ultimo[chave] ? clone(ultimo[chave]) : null;
      x.depois = doBanco(x.depois, x.entidade);
      ultimo[chave] = x.depois;
      return x;
    });
  }
  /* leitura AO VIVO (só leitura) para as telas. partes: 'registros' | 'eventos' (estruturas) | 'subagrupadores' |
     'associacoes' | 'eventosSubagrupadores'. aoMudar recebe { estruturas } | { eventos } | { subagrupadores } |
     { associacoesSubagrupador } | { eventosSubagrupadores }; aoFalhar(codigo). Devolve a função que desliga.
     Leitura recusada é erro, nunca "nada cadastrado". */
  var PARTES = {
    registros: { no: RAIZ + '/registros', chave: 'estruturas', conv: estruturasDoValor },
    eventos: { no: RAIZ + '/eventos', chave: 'eventos', conv: function (v) { return eventosDoValor(v); } },
    subagrupadores: { no: RAIZ_SUBAGRUPADORES + '/registros', chave: 'subagrupadores', conv: function (v) { return registrosDoValor(v, 'subagrupador'); } },
    associacoes: { no: RAIZ_SUBAGRUPADORES + '/associacoes', chave: 'associacoesSubagrupador', conv: function (v) { return registrosDoValor(v, 'associacao-subagrupador'); } },
    eventosSubagrupadores: { no: RAIZ_SUBAGRUPADORES + '/eventos', chave: 'eventosSubagrupadores', conv: function (v) { return eventosDoValor(v); } },
    vinculos: { no: RAIZ_VINCULOS + '/registros', chave: 'vinculos', conv: function (v) { return registrosDoValor(v, 'vinculo'); } },
    eventosVinculos: { no: RAIZ_VINCULOS + '/eventos', chave: 'eventosVinculos', conv: function (v) { return eventosDoValor(v); } },
    relacoes: { no: RAIZ_RELACOES + '/registros', chave: 'relacoes', conv: function (v) { return registrosDoValor(v, 'relacao'); } },
    eventosRelacoes: { no: RAIZ_RELACOES + '/eventos', chave: 'eventosRelacoes', conv: function (v) { return eventosDoValor(v); } },
    /* D2: o marcador de habilitação operacional, só leitura (true | false | null = ausente) */
    habilitacao: { no: TRAVA_PRODUCAO, chave: 'habilitacao', conv: function (v) { return v === true || v === false ? v : null; } }
  };
  function ouvir(db, partes, aoMudar, aoFalhar) {
    db = db || window.firebase.database(); /* sem banco informado: o do site (a tela do Mapa não toca o Firebase) */
    var desligar = [];
    (partes || ['registros']).forEach(function (parte) {
      var p = PARTES[parte], r = db.ref(p.no);
      var fn = function (s) { var m = {}; m[p.chave] = p.conv(s.val()); aoMudar(m); };
      r.on('value', fn, function (e) { if (aoFalhar) aoFalhar(ehNegado(e) ? 'RECUSADA' : 'SEM_RESPOSTA'); });
      desligar.push(function () { r.off('value', fn); });
    });
    return function () { desligar.forEach(function (d) { d(); }); };
  }

  /* M4: as ligações oficiais dos códigos firmes, para as telas só de consulta calcularem a situação do vínculo; sem
     banco informado, o do site (a tela do Mapa não toca o Firebase). Leitura recusada (o perfil avaliacao não lê as
     ligações) ou falha → null = "não sei", nunca "sem ligação". */
  /* M6/M7: as relações conceituais da Taxonomia Organizacional ({ de, tipo, para, ativa }) e o Squad — os conceitos da
     camada "Organização do trabalho" que a Taxonomia admite compor um código de Linha (Capítulo fica fora). Lê só o que
     as regras liberam (relações; camada/ativo/nome dos conceitos de trabalho). Rejeita se a leitura for recusada. */
  function lerTaxonomiaDasRelacoes(umaVez, codigosLinha) {
    return umaVez('taxonomia/organizacional/relacoes').then(function (v) {
      var rel = Object.keys(v || {}).map(function (k) { return { de: v[k].de, tipo: v[k].tipo, para: v[k].para, ativa: !v[k].encerrada }; });
      var cand = [];
      rel.forEach(function (r) { if (r.ativa && r.tipo === 'compoe' && (codigosLinha || []).indexOf(r.para) !== -1 && cand.indexOf(r.de) === -1) cand.push(r.de); });
      var talvez = function (c) { return umaVez(c).then(null, function () { return null; }); }; /* conceito que não é de trabalho: leitura recusada = não é Squad */
      return Promise.all(cand.map(function (c) { var b = 'taxonomia/organizacional/conceitos/' + c + '/'; return Promise.all([talvez(b + 'camada'), talvez(b + 'ativo'), talvez(b + 'nome')]); })).then(function (lidos) {
        var trabalho = [], conceitos = {};
        cand.forEach(function (c, i) { if (lidos[i][0] === 'trabalho') { trabalho.push(c); conceitos[c] = { ativo: lidos[i][1] === true, nome: typeof lidos[i][2] === 'string' ? lidos[i][2] : null }; } });
        /* I1: 'compõe' ativo para um conceito que NÃO é um tipo específico de Linha (ex.: o conceito geral "Linha") — só
           para a tela EXPLICAR por que o cadastro não oferece aquele conceito; não muda o que é cadastrável e não lê mais nada
           (as regras só deixam ler camada/nome de um conceito de trabalho que componha um tipo específico) */
        var composicoesGerais = rel.filter(function (r) { return r.ativa && r.tipo === 'compoe' && (codigosLinha || []).indexOf(r.para) === -1; }).map(function (r) { return { de: r.de, para: r.para }; });
        return { relacoesConceituais: rel, conceitosTrabalho: trabalho, conceitos: conceitos, composicoesGerais: composicoesGerais };
      });
    });
  }
  /* para as telas só de consulta (todos os perfis da Avaliação): null se não foi possível ler */
  function lerRelacoesConceituais(db, codigosLinha, prazoMs) {
    db = db || window.firebase.database();
    var umaVez = function (c) { return comPrazo(db.ref(c).once('value').then(function (sn) { return sn.val(); }), prazoMs); };
    return lerTaxonomiaDasRelacoes(umaVez, codigosLinha).then(null, function () { return null; });
  }
  function lerLigacoes(db, codigosFirmes) {
    return criarPortas({ db: db || window.firebase.database(), codigosFirmes: codigosFirmes }).lerReferencias().then(function (r) { return r.ligacoes; }, function () { return null; });
  }

  function criarPortas(opcoes) {
    var db = opcoes && opcoes.db, firmes = (opcoes && opcoes.codigosFirmes) || [], linha = (opcoes && opcoes.codigosLinha) || null, prazoMs = (opcoes && opcoes.prazoMs) || PRAZO_PADRAO;
    if (!db || !firmes.length) throw new Error('adaptador Firebase: falta o banco ou os códigos firmes');
    var ref = function (c) { return db.ref(c); };
    var umaVez = function (c) { return comPrazo(ref(c).once('value').then(function (s) { return s.val(); }, function (e) { return Promise.reject(recusa(ehNegado(e) ? 'RECUSADA' : 'SEM_RESPOSTA')); }), prazoMs); };

    /* referências oficiais dos 8 tipos firmes: só o que as regras deixam ler a quem cadastra (ativo do conceito e
       registradoEm da ligação canônica). O banco confere as mesmas duas coisas NA gravação. */
    function lerReferencias() {
      return Promise.all(firmes.map(function (c) {
        return Promise.all([umaVez('taxonomia/organizacional/conceitos/' + c + '/ativo'), umaVez('posicionamento-classificacoes/' + c + '/registradoEm')]);
      })).then(function (lidos) {
        var conceitos = {}, ligacoes = {};
        firmes.forEach(function (c, i) { if (lidos[i][0] !== null) conceitos[c] = { ativo: lidos[i][0] === true }; if (lidos[i][1] !== null) ligacoes[c] = c; });
        var base = { conceitos: conceitos, ligacoes: ligacoes, relacoesConceituais: [], conceitosTrabalho: [], herancaPeloPai: false };
        if (!linha) return base; /* quem não informa os códigos de Linha não trabalha com relações nem com Squad */
        return lerTaxonomiaDasRelacoes(umaVez, linha).then(function (t) {
          Object.keys(t.conceitos).forEach(function (c) { base.conceitos[c] = t.conceitos[c]; });
          base.relacoesConceituais = t.relacoesConceituais; base.conceitosTrabalho = t.conceitosTrabalho;
          return base;
        });
      });
    }
    function lerEstado() {
      return Promise.all([umaVez(RAIZ + '/registros'), umaVez(RAIZ_SUBAGRUPADORES + '/registros'), umaVez(RAIZ_SUBAGRUPADORES + '/associacoes'), umaVez(RAIZ_VINCULOS + '/registros'), umaVez(RAIZ_RELACOES + '/registros')]).then(function (v) {
        return { estruturas: estruturasDoValor(v[0]), relacoes: registrosDoValor(v[4], 'relacao'), vinculos: registrosDoValor(v[3], 'vinculo'), subagrupadores: registrosDoValor(v[1], 'subagrupador'), associacoesSubagrupador: registrosDoValor(v[2], 'associacao-subagrupador') };
      });
    }
    /* M3: o Posicionamento VIGENTE do item (concluído), no formato de posicionamentoEfetivo do núcleo — só leitura;
       o banco confere de novo, na gravação, que a base do vínculo é este Posicionamento */
    function lerPosicionamento(objetoId) {
      return umaVez('posicionamento-vigente-por-item/' + objetoId).then(function (id) {
        if (typeof id !== 'string' || !id) return null;
        return Promise.all([umaVez('avaliacoes-posicionamento/' + id + '/status'), umaVez('avaliacoes-posicionamento/' + id + '/resultadoAutomatico/codigoResultado'), umaVez('posicionamento-decisoes/' + id + '/codigoFinal')]).then(function (v) {
          if (v[0] !== 'concluido') return null;
          var p = { avaliacaoId: id, recomendacao: { codigoResultado: v[1] } };
          if (v[2] !== null) p.decisao = { codigoFinal: v[2] };
          return p;
        });
      });
    }
    /* o identificador de operação é único entre as famílias: a operação foi aplicada se existe em qualquer uma */
    function conferirOperacao(id) {
      if (naoConfirmadas[id]) return Promise.reject(recusa('SEM_RESPOSTA'));
      return Promise.all([umaVez(RAIZ + '/operacoes/' + id), umaVez(RAIZ_SUBAGRUPADORES + '/operacoes/' + id), umaVez(RAIZ_VINCULOS + '/operacoes/' + id), umaVez(RAIZ_RELACOES + '/operacoes/' + id)]).then(function (v) { return { aplicada: v[0] !== null || v[1] !== null || v[2] !== null || v[3] !== null }; });
    }
    function lerEventos() { return Promise.all([umaVez(RAIZ + '/eventos'), umaVez(RAIZ_SUBAGRUPADORES + '/eventos'), umaVez(RAIZ_VINCULOS + '/eventos'), umaVez(RAIZ_RELACOES + '/eventos')]).then(function (v) { return eventosDoValor(v[0], v[1], v[2], v[3]); }); }

    function gravar(op) {
      if (!op || !op.id || !(op.mudancas || []).length || (op.eventos || []).length !== op.mudancas.length) return Promise.reject(recusa('RECUSADA'));
      if (op.mudancas.some(function (m) { return !ENTIDADES[m.entidade] || ENTIDADES[m.entidade].familia !== familiaDe(op); })) return Promise.reject(recusa('RECUSADA'));
      var multi = montarGravacao(op);
      if (naoConfirmadas[op.id]) return Promise.reject(recusa('SEM_RESPOSTA'));
      var enviada = naoConfirmadas[op.id] = Promise.resolve(ref('/').update(multi));
      enviada.then(function () { delete naoConfirmadas[op.id]; }, function () { delete naoConfirmadas[op.id]; });
      return comPrazo(enviada, prazoMs).then(function () { return { situacao: 'gravada' }; }, function (e) {
        if (e && e.codigo === 'SEM_RESPOSTA') return Promise.reject(e);
        /* recusada pelo banco: a mesma operação já aplicada? outra pessoa gravou antes (revisão, ou a Linha já ganhou
           outra associação ativa)? ou recusa de fato */
        return conferirOperacao(op.id).then(function (c) {
          if (c.aplicada) return { situacao: 'repetida' };
          return lerEstado().then(function (s) {
            var conflito = op.mudancas.some(function (m) {
              var a = (s[ENTIDADES[m.entidade].colecao] || {})[m.id];
              if (m.antes === null ? !!a : (!a || a.revisao !== m.revisaoAnterior)) return true;
              if (m.entidade === 'associacao-subagrupador' && m.antes === null) {
                return Object.keys(s.associacoesSubagrupador || {}).some(function (k) { var x = s.associacoesSubagrupador[k]; return x.situacao === 'ativa' && x.estruturaId === m.depois.estruturaId && k !== m.depois.substitui; });
              }
              if (m.entidade === 'relacao' && m.antes === null) {
                return Object.keys(s.relacoes || {}).some(function (k) {
                  var x = s.relacoes[k];
                  return x.situacao === 'ativa' && k !== m.depois.substitui && ((x.origem === m.depois.origem && x.tipo === m.depois.tipo && x.destino === m.depois.destino) || (m.depois.tipo === 'compoe' && x.tipo === 'compoe' && x.origem === m.depois.origem));
                });
              }
              if (m.entidade === 'vinculo' && m.antes === null) {
                return Object.keys(s.vinculos || {}).some(function (k) {
                  var x = s.vinculos[k], d = m.depois;
                  if (x.situacao !== 'ativa' || x.objetoId !== d.objetoId || k === d.substitui) return false;
                  /* principal: outro principal ativo; colaboradora: a mesma estrutura já colabora (E3) */
                  return d.papel === 'colaboradora' ? (x.papel === 'colaboradora' && x.estruturaId === d.estruturaId) : x.papel !== 'colaboradora';
                });
              }
              return false;
            });
            return Promise.reject(recusa(conflito ? 'CONFLITO_DE_REVISAO' : 'RECUSADA'));
          });
        }, function () { return Promise.reject(recusa('RECUSADA')); });
      });
    }

    return { lerReferencias: lerReferencias, lerEstado: lerEstado, gravar: gravar, conferirOperacao: conferirOperacao, lerEventos: lerEventos, lerPosicionamento: lerPosicionamento };
  }

  var api = Object.freeze({ criarPortas: criarPortas, montarGravacao: montarGravacao, ouvir: ouvir, lerLigacoes: lerLigacoes, estruturasDoValor: estruturasDoValor, registrosDoValor: registrosDoValor,
    eventosDoValor: eventosDoValor, lerRelacoesConceituais: lerRelacoesConceituais, RAIZ: RAIZ, RAIZ_SUBAGRUPADORES: RAIZ_SUBAGRUPADORES, RAIZ_VINCULOS: RAIZ_VINCULOS, RAIZ_RELACOES: RAIZ_RELACOES, TRAVA_PRODUCAO: TRAVA_PRODUCAO });
  if (typeof window !== 'undefined') window.faEstruturasFirebase = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
