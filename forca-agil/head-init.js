document.documentElement.classList.add('js');

/* ARQUITETURA ORGANIZACIONAL: o endereço oficial da área é #arquitetura (antes #avaliacoes). Links antigos, favoritos,
   F5 e entradas antigas do histórico continuam valendo: "#avaliacoes…" (com os mesmos parâmetros) é reescrito para
   "#arquitetura…" ANTES de qualquer outro script ler o endereço — aqui no carregamento e, depois, como o primeiro
   ouvinte de hashchange/popstate da página (ouvintes rodam na ordem em que foram registrados). replaceState: não cria
   entrada nova no histórico. O nome interno da página continua 'avaliacoes' (router.js). */
(function () {
  var ANTIGO = /^#\/?avaliacoes(?=$|\?)/;
  function normalizar() {
    var h = location.hash || '';
    if (ANTIGO.test(h)) history.replaceState(history.state, '', h.replace(ANTIGO, '#arquitetura'));
  }
  window.faRotaArquitetura = { ROTA: '#arquitetura', normalizar: normalizar };
  normalizar();
  window.addEventListener('hashchange', normalizar);
  window.addEventListener('popstate', normalizar);
})();

/* Guarda os erros de JavaScript desde o primeiro instante, antes de qualquer
   outro script rodar. Sem isto, um erro que acontece no carregamento some —
   e é justamente esse que trava o site em silêncio, sem nada na tela. O
   diagnóstico do login mostra o que foi capturado aqui. */
window.__faErros = [];
window.addEventListener('error', function (e) {
  window.__faErros.push({
    tipo: 'erro',
    msg: (e && e.message) || 'erro sem mensagem',
    onde: ((e && e.filename) || '').split('/').pop() + (e && e.lineno ? ':' + e.lineno : '')
  });
});
window.addEventListener('unhandledrejection', function (e) {
  var r = e && e.reason;
  window.__faErros.push({
    tipo: 'promessa',
    msg: (r && (r.message || r.code)) || String(r || 'sem motivo'),
    onde: ''
  });
});
