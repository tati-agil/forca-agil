/* ============================================================
   INTERFACE DE SERVIÇOS DO POSICIONAMENTO (window.faServicosPosicionamento) — B1 do H2-b

   A única porta entre a tela de Posicionamento e a infraestrutura: a tela não chama o Firebase, chama esta
   interface. Hoje a implementação é o Realtime Database (adaptador abaixo); na migração para o portal corporativo,
   troca-se a implementação (API, banco corporativo) e a tela, o núcleo e as regras de negócio ficam.

   Contrato (os caminhos são os do modelo de dados atual; um adaptador futuro os traduz):
     gravar(payload, prazoMs, cb, depois)  gravação ATÔMICA de várias chaves (entra tudo ou nada). cb(null) = gravou;
                                   cb('sem-resposta') = o prazo acabou sem resposta — NÃO quer dizer "falhou" nem
                                   "gravou": quem chama confere o banco antes de dizer qualquer coisa; cb(erro) =
                                   recusada. cb é chamado uma vez; a resposta do servidor que chega DEPOIS do prazo vai
                                   para depois(null | erro), se informado. Enquanto ela não chega, o que o SDK mostra no
                                   cache local (ouvintes, lerUmaVez) inclui a própria gravação: não é confirmação.
     novaChave(caminho)            chave nova, única e ordenável no tempo, sob o caminho.
     lerUmaVez(caminho, prazoMs)   Promise do valor (null se não existe); rejeita se a leitura for recusada ou com
                                   'sem-resposta' quando o prazo acaba (padrão 20 s: com a conexão parada, uma leitura
                                   fora do cache local esperaria para sempre).
     ouvir(caminho, aoValor, aoErro) → cancelar()   leitura ao vivo; aoValor(valor ou null) a cada mudança.
     identidade()                  {uid, email} da sessão autenticada, ou null (B3: quem propõe/aprova é o UID).
     agoraServidor()               marca "horário do servidor" para uma gravação (as regras exigem now).
     executar(operacao, dados, prazoMs, cb)  B4: chama uma operação da FRONTEIRA CONFIÁVEL (Cloud Function chamável,
                                   identidade = o token da sessão). cb(null, resultado) | cb('sem-resposta') (prazo acabou: não
                                   quer dizer nem "falhou" nem "fez") | cb({ codigo, mensagem }) — codigo 'indisponivel' quando
                                   a fronteira não está disponível nesta página ou ainda não foi implantada (nunca é "validado").

   Sem regra de negócio aqui: só transporte. Operações que exigem autoridade (concluir v ≥ 2, publicar, aprovar,
   ativar) entram nesta mesma interface nas etapas seguintes, executadas pela fronteira confiável.
   ============================================================ */
(function () {
  'use strict';
  function db() { return firebase.database(); }
  function gravar(payload, prazoMs, cb, depois) {
    var respondido = false;
    var relogio = setTimeout(function () { if (respondido) return; respondido = true; cb('sem-resposta'); }, prazoMs);
    try {
      db().ref().update(payload, function (err) {
        if (respondido) { if (depois) depois(err || null); return; }
        respondido = true; clearTimeout(relogio);
        cb(err || null);
      });
    } catch (e) { if (respondido) return; respondido = true; clearTimeout(relogio); cb(e); }
  }
  function novaChave(caminho) { return db().ref(caminho).push().key; }
  function lerUmaVez(caminho, prazoMs) {
    var t, venceu = new Promise(function (_, rej) { t = setTimeout(function () { rej('sem-resposta'); }, prazoMs || 20000); });
    var leitura = db().ref(caminho).once('value').then(function (s) { var v = s.val(); return v === undefined ? null : v; });
    return Promise.race([leitura, venceu]).then(function (v) { clearTimeout(t); return v; }, function (e) { clearTimeout(t); return Promise.reject(e); });
  }
  function ouvir(caminho, aoValor, aoErro) {
    var ref = db().ref(caminho);
    var cb = function (snap) { aoValor(snap.val()); };
    ref.on('value', cb, aoErro);
    return function cancelar() { try { ref.off('value', cb); } catch (e) { /* já cancelada */ } };
  }
  function identidade() {
    var u = null;
    try { u = firebase.auth().currentUser; } catch (e) { u = null; }
    return u && u.uid && u.email ? { uid: u.uid, email: u.email } : null;
  }
  function agoraServidor() { return firebase.database.ServerValue.TIMESTAMP; }
  /* a mesma região das funções (functions/index.js) e do Realtime Database */
  var REGIAO_FRONTEIRA = 'us-central1';
  var INDISPONIVEL = { 'not-found': 1, unavailable: 1, internal: 1, unimplemented: 1, 'deadline-exceeded': 1 };
  function executar(operacao, dados, prazoMs, cb) {
    var respondido = false, chamada;
    function fim(a, b) { if (respondido) return; respondido = true; clearTimeout(relogio); cb(a, b); }
    var relogio = setTimeout(function () { fim('sem-resposta'); }, prazoMs);
    try {
      if (typeof firebase.app !== 'function' || typeof firebase.app().functions !== 'function') throw new Error('sem SDK de functions');
      chamada = firebase.app().functions(REGIAO_FRONTEIRA).httpsCallable(operacao, { timeout: prazoMs });
    } catch (e) { fim({ codigo: 'indisponivel', mensagem: 'Fronteira confiável indisponível nesta página.' }); return; }
    Promise.resolve().then(function () { return chamada(dados); }).then(function (r) { fim(null, r && r.data); }, function (e) {
      var codigo = String((e && e.code) || 'erro').replace(/^functions\//, '');
      fim({ codigo: INDISPONIVEL[codigo] ? 'indisponivel' : codigo, mensagem: (e && e.message) || '' });
    });
  }
  window.faServicosPosicionamento = Object.freeze({ implementacao: 'firebase-rtdb', gravar: gravar, novaChave: novaChave, lerUmaVez: lerUmaVez, ouvir: ouvir,
    identidade: identidade, agoraServidor: agoraServidor, executar: executar });
})();
