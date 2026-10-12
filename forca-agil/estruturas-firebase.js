/* ============================================================
   Força Ágil — Núcleo de Avaliação, Taxonomia e Mapa da Floresta
   ESTRUTURAS ORGANIZACIONAIS CONCRETAS — ADAPTADOR FIREBASE (Realtime Database)
   (window.faEstruturasFirebase; em Node, module.exports)

   Implementa as portas de persistência de estruturas-casos-de-uso.js sobre o Realtime Database. Não tem regra de
   negócio: quem decide é o núcleo (pelo caso de uso) e quem GARANTE no banco é database.rules.json
   (nó estruturas-concretas): uma operação aceita grava, numa ÚNICA gravação multipath,
     estruturas-concretas/registros/<id>          a estrutura (+ ultimaOperacao, só do banco)
     estruturas-concretas/eventos/<operacao>:1    o evento de auditoria (sem "antes" — ver abaixo)
     estruturas-concretas/operacoes/<operacao>    a operação (idempotência: existe ⇔ foi aplicada)
   e as regras recusam qualquer uma dessas partes sozinha, apagar, reativar, mudar o que é imutável, pular revisão,
   autoria diferente do token e horário diferente do horário do SERVIDOR.

   Horário: o núcleo recebe ctx.agora só para decidir; o que se grava nos CAMPOS_DE_HORARIO que a operação define é
   o horário do servidor ({'.sv':'timestamp'}), igual em estrutura, evento e operação (uma gravação só).
   "antes" do evento: não é gravado; na leitura é o "depois" do evento anterior da mesma estrutura (a estrutura só
   muda junto com um evento, e as regras conferem que o "depois" é a estrutura gravada) — não há cópia a adulterar.

   criarPortas({ db, codigosFirmes, prazoMs }) → { lerReferencias, lerEstado, gravar, conferirOperacao, lerEventos }
     db = firebase.database() (SDK compat) da pessoa que está agindo; autoria e permissão vêm do token dela.
   ============================================================ */
(function () {
  'use strict';

  var RAIZ = 'estruturas-concretas';
  var AGORA_DO_SERVIDOR = { '.sv': 'timestamp' };
  var HORARIOS = ['criadaEm', 'alteradaEm', 'encerramento.em'];

  function clone(v) { return v === undefined || v === null ? v : JSON.parse(JSON.stringify(v)); }
  function ler(o, caminho) { return caminho.split('.').reduce(function (a, k) { return a && typeof a === 'object' ? a[k] : undefined; }, o); }
  function definir(o, caminho, v) { var p = caminho.split('.'), a = o; for (var i = 0; i < p.length - 1; i++) a = a[p[i]]; a[p[p.length - 1]] = v; }
  /* o Realtime Database não guarda null: um campo nulo é um campo ausente */
  function semNulos(v) {
    if (Array.isArray(v)) return v.map(semNulos);
    if (v && typeof v === 'object') { var o = {}; Object.keys(v).forEach(function (k) { if (v[k] !== null && v[k] !== undefined) o[k] = semNulos(v[k]); }); return o; }
    return v;
  }
  /* devolve a estrutura no formato do núcleo (opcionais ausentes = null; ultimaOperacao é só do banco) */
  function doBanco(e) {
    var x = clone(e); delete x.ultimaOperacao;
    if (!('sigla' in x)) x.sigla = null;
    if (!('descricao' in x)) x.descricao = null;
    return x;
  }
  /* horário do servidor nos campos que ESTA operação define (os que mudaram em relação a antes) */
  function comHorarioDoServidor(depois, antes) {
    var x = clone(depois);
    HORARIOS.forEach(function (c) { var v = ler(x, c); if (v !== undefined && v !== null && (!antes || ler(antes, c) !== v)) definir(x, c, AGORA_DO_SERVIDOR); });
    return x;
  }
  function recusa(codigo) { return { codigo: codigo }; }
  function ehNegado(e) { var t = String((e && (e.code || e.message)) || '').toLowerCase(); return t.indexOf('permission') !== -1 || t.indexOf('denied') !== -1; }

  /* a gravação multipath ÚNICA de uma operação (pura; exportada para os testes adulterarem uma gravação válida) */
  function montarGravacao(op) {
    var multi = {};
    op.mudancas.forEach(function (m, i) {
      var est = semNulos(comHorarioDoServidor(m.depois, m.antes)); est.ultimaOperacao = op.id;
      var ev = clone(op.eventos[i]); delete ev.antes;
      ev.depois = semNulos(comHorarioDoServidor(ev.depois, m.antes)); ev.em = AGORA_DO_SERVIDOR;
      multi[RAIZ + '/registros/' + m.id] = est;
      multi[RAIZ + '/eventos/' + ev.id] = semNulos(ev);
      multi[RAIZ + '/operacoes/' + op.id] = { tipo: op.tipo, estruturaId: m.id, usuario: semNulos({ id: op.usuario.id, email: op.usuario.email }), em: AGORA_DO_SERVIDOR };
    });
    return multi;
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
      return umaVez(RAIZ + '/registros').then(function (v) {
        var estruturas = {}; Object.keys(v || {}).forEach(function (id) { estruturas[id] = doBanco(v[id]); });
        return { estruturas: estruturas, relacoes: {}, vinculos: {} };
      });
    }
    function conferirOperacao(id) {
      return umaVez(RAIZ + '/operacoes/' + id).then(function (v) { return { aplicada: v !== null }; });
    }
    function lerEventos() {
      return umaVez(RAIZ + '/eventos').then(function (v) {
        var lista = Object.keys(v || {}).map(function (k) { return v[k]; })
          .sort(function (a, b) { return a.em !== b.em ? a.em - b.em : (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); });
        var ultimo = {};
        return lista.map(function (ev) {
          var x = clone(ev);
          x.antes = ultimo[x.entidadeId] ? clone(ultimo[x.entidadeId]) : null;
          x.depois = doBanco(x.depois);
          ultimo[x.entidadeId] = x.depois;
          return x;
        });
      });
    }

    function gravar(op) {
      if (!op || !op.id || !(op.mudancas || []).length || (op.eventos || []).length !== op.mudancas.length) return Promise.reject(recusa('RECUSADA'));
      if (op.mudancas.some(function (m) { return m.entidade !== 'estrutura'; })) return Promise.reject(recusa('RECUSADA')); /* 1º cadastro: só estruturas */
      var multi = montarGravacao(op);
      var prazo, venceu = new Promise(function (_, rej) { prazo = setTimeout(function () { rej(recusa('SEM_RESPOSTA')); }, prazoMs); });
      return Promise.race([ref('/').update(multi), venceu]).then(function () { clearTimeout(prazo); return { situacao: 'gravada' }; }, function (e) {
        clearTimeout(prazo);
        if (e && e.codigo === 'SEM_RESPOSTA') return Promise.reject(e);
        /* recusada pelo banco: a mesma operação já aplicada? outra pessoa gravou antes (revisão)? ou recusa de fato */
        return conferirOperacao(op.id).then(function (c) {
          if (c.aplicada) return { situacao: 'repetida' };
          return lerEstado().then(function (s) {
            var conflito = op.mudancas.some(function (m) { var a = s.estruturas[m.id]; return m.antes === null ? !!a : (!a || a.revisao !== m.revisaoAnterior); });
            return Promise.reject(recusa(conflito ? 'CONFLITO_DE_REVISAO' : 'RECUSADA'));
          });
        }, function () { return Promise.reject(recusa('RECUSADA')); });
      });
    }

    return { lerReferencias: lerReferencias, lerEstado: lerEstado, gravar: gravar, conferirOperacao: conferirOperacao, lerEventos: lerEventos };
  }

  var api = Object.freeze({ criarPortas: criarPortas, montarGravacao: montarGravacao, RAIZ: RAIZ });
  if (typeof window !== 'undefined') window.faEstruturasFirebase = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
