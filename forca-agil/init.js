document.addEventListener('DOMContentLoaded', function () {
  function updateAdminPage() {
    var sess    = window.faAuth && window.faAuth.getSession();
    var isAdmin = sess && window.faAuth.isAdmin && window.faAuth.isAdmin(sess.email);
    var guard   = document.getElementById('adminGuard');
    var content = document.getElementById('adminContent');
    if (guard)   guard.hidden   = !!isAdmin;
    if (content) content.hidden = !isAdmin;
  }
  updateAdminPage();
  window.addEventListener('fa-auth-change', updateAdminPage);
});
