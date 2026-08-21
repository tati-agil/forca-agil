document.documentElement.classList.add('js');

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
