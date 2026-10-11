/* ============================================================
   INTERFACE DE SERVIÇOS DO POSICIONAMENTO (window.faServicosPosicionamento) — B1 do H2-b

   A única porta entre a tela de Posicionamento e a infraestrutura: a tela não chama o Firebase, chama esta
   interface. Hoje a implementação é o Realtime Database (adaptador abaixo); na migração para o portal corporativo,
   troca-se a implementação (API, banco corporativo) e a tela, o núcleo e as regras de negócio ficam.

   Contrato (os caminhos são os do modelo de dados atual; um adaptador futuro os traduz):
     gravar(payload, prazoMs, cb)  gravação ATÔMICA de várias chaves (entra tudo ou nada). cb(null) = gravou;
                                   cb('sem-resposta') = o prazo acabou sem resposta — NÃO quer dizer "falhou" nem
                                   "gravou": quem chama confere o banco antes de dizer qualquer coisa; cb(erro) =
                                   recusada. Resposta que chega depois do prazo é ignorada (cb é chamado uma vez).
     novaChave(caminho)            chave nova, única e ordenável no tempo, sob o caminho.
     lerUmaVez(caminho)            Promise do valor (null se não existe); rejeita se a leitura for recusada.
     ouvir(caminho, aoValor, aoErro) → cancelar()   leitura ao vivo; aoValor(valor ou null) a cada mudança.

   Sem regra de negócio aqui: só transporte. Operações que exigem autoridade (concluir v ≥ 2, publicar, aprovar,
   ativar) entram nesta mesma interface nas etapas seguintes, executadas pela fronteira confiável.
   ============================================================ */
(function () {
  'use strict';
  function db() { return firebase.database(); }
  function gravar(payload, prazoMs, cb) {
    var respondido = false;
    var relogio = setTimeout(function () { if (respondido) return; respondido = true; cb('sem-resposta'); }, prazoMs);
    try {
      db().ref().update(payload, function (err) {
        if (respondido) return;
        respondido = true; clearTimeout(relogio);
        cb(err || null);
      });
    } catch (e) { if (respondido) return; respondido = true; clearTimeout(relogio); cb(e); }
  }
  function novaChave(caminho) { return db().ref(caminho).push().key; }
  function lerUmaVez(caminho) { return db().ref(caminho).once('value').then(function (s) { var v = s.val(); return v === undefined ? null : v; }); }
  function ouvir(caminho, aoValor, aoErro) {
    var ref = db().ref(caminho);
    var cb = function (snap) { aoValor(snap.val()); };
    ref.on('value', cb, aoErro);
    return function cancelar() { try { ref.off('value', cb); } catch (e) { /* já cancelada */ } };
  }
  window.faServicosPosicionamento = Object.freeze({ implementacao: 'firebase-rtdb', gravar: gravar, novaChave: novaChave, lerUmaVez: lerUmaVez, ouvir: ouvir });
})();
