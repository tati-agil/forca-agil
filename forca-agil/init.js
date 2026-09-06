document.addEventListener('DOMContentLoaded', function () {
  /* Enquanto a autenticação não termina não dá para saber se a pessoa é admin.
     Mostrar "Acesso Restrito" nesse intervalo fazia o próprio admin ver o aviso
     durante o carregamento — o site é revelado no evento fa-auth-ready, mas o
     guarda só era atualizado no fa-auth-change, que chega depois. */
  var authResolvido = false;

  function updateAdminPage() {
    var sess    = window.faAuth && window.faAuth.getSession();
    var isAdmin = sess && window.faAuth.isAdmin && window.faAuth.isAdmin(sess.email);
    var guard   = document.getElementById('adminGuard');
    var content = document.getElementById('adminContent');
    if (content) content.hidden = !isAdmin;
    if (guard)   guard.hidden   = !authResolvido || !!isAdmin;
  }

  /* Saber quem está logado ainda não é saber se é admin: isAdmin() depende
     de uma leitura de fa-admins que corre em paralelo e responde false até
     chegar. Dar o auth por resolvido antes dela mostrava "Acesso Restrito"
     pro próprio admin — o mesmo sintoma que o comentário acima descreve,
     só que causado pelo outro dado. Por isso o guarda só aparece quando as
     DUAS coisas terminaram. */
  function listaAdminsPronta() {
    return !(window.faAuth && window.faAuth.isAdminReady) || window.faAuth.isAdminReady();
  }

  function resolver() {
    if (!listaAdminsPronta()) { updateAdminPage(); return; }
    authResolvido = true;
    updateAdminPage();
  }

  updateAdminPage();
  window.addEventListener('fa-auth-ready',  resolver);
  window.addEventListener('fa-auth-change', resolver);
  window.addEventListener('fa-admin-ready', resolver);
});
