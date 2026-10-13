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
       eventos/<operacao>:<n>     um evento por mudança (uma substituição tem dois)
       operacoes/<operacao>       (+ objetoId)
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
  /* TRAVA DE PRODUÇÃO: as regras só aceitam gravar em estruturas-concretas, mapa-subagrupadores e estruturas-vinculos com este marcador
     = true. Nenhum cliente o grava nem lê (nem admin geral): só o console ou uma conta de serviço. No banco oficial ele
     não existe — cadastro desligado até a autorização de publicação (depois da Etapa 3 e da paridade); no emulador, a
     semente do ambiente de testes liga. */
  var TRAVA_PRODUCAO = 'estruturas-concretas-config/gravacaoHabilitada';
  var AGORA_DO_SERVIDOR = { '.sv': 'timestamp' };
  /* onde cada entidade mora e quais são os seus campos de horário */
  var ENTIDADES = {
    estrutura: { familia: RAIZ, colecao: 'estruturas', no: RAIZ + '/registros', horarios: ['criadaEm', 'alteradaEm', 'encerramento.em'] },
    subagrupador: { familia: RAIZ_SUBAGRUPADORES, colecao: 'subagrupadores', no: RAIZ_SUBAGRUPADORES + '/registros', horarios: ['criadoEm', 'alteradoEm', 'encerramento.em'] },
    'associacao-subagrupador': { familia: RAIZ_SUBAGRUPADORES, colecao: 'associacoesSubagrupador', no: RAIZ_SUBAGRUPADORES + '/associacoes', horarios: ['criadaEm', 'encerramento.em'] },
    vinculo: { familia: RAIZ_VINCULOS, colecao: 'vinculos', no: RAIZ_VINCULOS + '/registros', horarios: ['criadoEm', 'encerramento.em'] }
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
    if (entidade === 'vinculo' && !('justificativa' in x)) x.justificativa = null;
    return x;
  }
  /* horário do servidor nos campos que ESTA operação define (os que mudaram em relação a antes) */
  function comHorarioDoServidor(depois, antes, entidade) {
    var x = clone(depois);
    ENTIDADES[entidade].horarios.forEach(function (c) { var v = ler(x, c); if (v !== undefined && v !== null && (!antes || ler(antes, c) !== v)) definir(x, c, AGORA_DO_SERVIDOR); });
    return x;
  }
  function recusa(codigo) { return { codigo: codigo }; }
  function ehNegado(e) { var t = String((e && (e.code || e.message)) || '').toLowerCase(); return t.indexOf('permission') !== -1 || t.indexOf('denied') !== -1; }
  function familiaDe(op) { var ent = op.mudancas[0] && ENTIDADES[op.mudancas[0].entidade]; return ent ? ent.familia : null; }

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
      /* índice da associação ativa de cada Linha: a nova ativa ocupa; a que se encerra libera (se nada ocupou) */
      if (m.entidade === 'associacao-subagrupador') {
        if (m.depois.situacao === 'ativa') indice[m.depois.estruturaId] = m.id;
        else if (!(m.depois.estruturaId in indice)) indice[m.depois.estruturaId] = null;
      }
      /* índice do responsável principal ativo de cada item: o novo ocupa; o que se encerra libera (se nada ocupou) */
      if (m.entidade === 'vinculo') {
        if (m.depois.situacao === 'ativa') indice[m.depois.objetoId] = m.id;
        else if (!(m.depois.objetoId in indice)) indice[m.depois.objetoId] = null;
      }
    });
    var noIndice = familia === RAIZ_VINCULOS ? RAIZ_VINCULOS + '/ativo-por-objeto/' : RAIZ_SUBAGRUPADORES + '/ativa-por-estrutura/';
    Object.keys(indice).forEach(function (chave) { multi[noIndice + chave] = indice[chave]; });
    var registroOp = { tipo: op.tipo, usuario: semNulos({ id: op.usuario.id, email: op.usuario.email }), em: AGORA_DO_SERVIDOR };
    if (familia === RAIZ) registroOp.estruturaId = op.mudancas[0].id;
    if (familia === RAIZ_VINCULOS) registroOp.objetoId = op.mudancas[0].depois.objetoId;
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
    eventosVinculos: { no: RAIZ_VINCULOS + '/eventos', chave: 'eventosVinculos', conv: function (v) { return eventosDoValor(v); } }
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
  function lerLigacoes(db, codigosFirmes) {
    return criarPortas({ db: db || window.firebase.database(), codigosFirmes: codigosFirmes }).lerReferencias().then(function (r) { return r.ligacoes; }, function () { return null; });
  }

  function criarPortas(opcoes) {
    var db = opcoes && opcoes.db, firmes = (opcoes && opcoes.codigosFirmes) || [], prazoMs = (opcoes && opcoes.prazoMs) || 20000;
    if (!db || !firmes.length) throw new Error('adaptador Firebase: falta o banco ou os códigos firmes');
    var ref = function (c) { return db.ref(c); };
    var umaVez = function (c) { return ref(c).once('value').then(function (s) { return s.val(); }, function (e) { return Promise.reject(recusa(ehNegado(e) ? 'RECUSADA' : 'SEM_RESPOSTA')); }); };

    /* referências oficiais dos 8 tipos firmes: só o que as regras deixam ler a quem cadastra (ativo do conceito e
       registradoEm da ligação canônica). O banco confere as mesmas duas coisas NA gravação. */
    function lerReferencias() {
      return Promise.all(firmes.map(function (c) {
        return Promise.all([umaVez('taxonomia/organizacional/conceitos/' + c + '/ativo'), umaVez('posicionamento-classificacoes/' + c + '/registradoEm')]);
      })).then(function (lidos) {
        var conceitos = {}, ligacoes = {};
        firmes.forEach(function (c, i) { if (lidos[i][0] !== null) conceitos[c] = { ativo: lidos[i][0] === true }; if (lidos[i][1] !== null) ligacoes[c] = c; });
        return { conceitos: conceitos, ligacoes: ligacoes, relacoesConceituais: [], herancaPeloPai: false };
      });
    }
    function lerEstado() {
      return Promise.all([umaVez(RAIZ + '/registros'), umaVez(RAIZ_SUBAGRUPADORES + '/registros'), umaVez(RAIZ_SUBAGRUPADORES + '/associacoes'), umaVez(RAIZ_VINCULOS + '/registros')]).then(function (v) {
        return { estruturas: estruturasDoValor(v[0]), relacoes: {}, vinculos: registrosDoValor(v[3], 'vinculo'), subagrupadores: registrosDoValor(v[1], 'subagrupador'), associacoesSubagrupador: registrosDoValor(v[2], 'associacao-subagrupador') };
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
      return Promise.all([umaVez(RAIZ + '/operacoes/' + id), umaVez(RAIZ_SUBAGRUPADORES + '/operacoes/' + id), umaVez(RAIZ_VINCULOS + '/operacoes/' + id)]).then(function (v) { return { aplicada: v[0] !== null || v[1] !== null || v[2] !== null }; });
    }
    function lerEventos() { return Promise.all([umaVez(RAIZ + '/eventos'), umaVez(RAIZ_SUBAGRUPADORES + '/eventos'), umaVez(RAIZ_VINCULOS + '/eventos')]).then(function (v) { return eventosDoValor(v[0], v[1], v[2]); }); }

    function gravar(op) {
      if (!op || !op.id || !(op.mudancas || []).length || (op.eventos || []).length !== op.mudancas.length) return Promise.reject(recusa('RECUSADA'));
      if (op.mudancas.some(function (m) { return !ENTIDADES[m.entidade] || ENTIDADES[m.entidade].familia !== familiaDe(op); })) return Promise.reject(recusa('RECUSADA'));
      var multi = montarGravacao(op);
      var prazo, venceu = new Promise(function (_, rej) { prazo = setTimeout(function () { rej(recusa('SEM_RESPOSTA')); }, prazoMs); });
      return Promise.race([ref('/').update(multi), venceu]).then(function () { clearTimeout(prazo); return { situacao: 'gravada' }; }, function (e) {
        clearTimeout(prazo);
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
              if (m.entidade === 'vinculo' && m.antes === null) {
                return Object.keys(s.vinculos || {}).some(function (k) { var x = s.vinculos[k]; return x.situacao === 'ativa' && x.objetoId === m.depois.objetoId && k !== m.depois.substitui; });
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
    eventosDoValor: eventosDoValor, RAIZ: RAIZ, RAIZ_SUBAGRUPADORES: RAIZ_SUBAGRUPADORES, RAIZ_VINCULOS: RAIZ_VINCULOS, TRAVA_PRODUCAO: TRAVA_PRODUCAO });
  if (typeof window !== 'undefined') window.faEstruturasFirebase = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
