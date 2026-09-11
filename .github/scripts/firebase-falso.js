/* Firebase compat FALSO — só o suficiente para o site carregar e autenticar.
   Comportamento controlado por window.__CFG (injetado antes deste script). */
(function () {
  var CFG = window.__CFG || {};
  var DB  = CFG.db || {};

  function get(path) {
    var parts = String(path).split('/').filter(Boolean);
    var node = DB;
    for (var i = 0; i < parts.length; i++) {
      if (node == null || typeof node !== 'object') return null;
      node = node[parts[i]];
    }
    return node === undefined ? null : node;
  }
  function snap(path) {
    var v = get(path);
    return {
      val: function () { return v; },
      exists: function () { return v !== null; },
      key: String(path).split('/').pop(),
      forEach: function (cb) {
        if (v && typeof v === 'object') {
          Object.keys(v).forEach(function (k) { cb(snap(path + '/' + k)); });
        }
      }
    };
  }
  /* atraso por prefixo de caminho, para simular rede lenta seletiva */
  function delayFor(path) {
    var d = CFG.delays || {};
    var best = CFG.delayDefault || 0;
    Object.keys(d).forEach(function (p) { if (String(path).indexOf(p) === 0) best = d[p]; });
    return best;
  }
  function failsFor(path) {
    return (CFG.fail || []).some(function (p) { return String(path).indexOf(p) === 0; });
  }

  function Ref(path) { this.path = path; }
  Ref.prototype.child = function (p) { return new Ref(this.path + '/' + p); };
  Ref.prototype.once = function (evt, ok, err) {
    var self = this;
    var p = new Promise(function (resolve, reject) {
      setTimeout(function () {
        if (failsFor(self.path)) {
          var e = new Error('PERMISSION_DENIED (falso): ' + self.path);
          if (err) err(e);
          reject(e);
          return;
        }
        var s = snap(self.path);
        if (ok) ok(s);
        resolve(s);
      }, delayFor(self.path));
    });
    p.catch(function () {});  /* o site precisa tratar; aqui só evita ruído do harness */
    return p;
  };
  Ref.prototype.on = function (evt, ok, err) {
    this.once(evt, ok, err);
    return ok;
  };
  Ref.prototype.off = function () {};
  /* Gravação obedece aos mesmos delays/fail da leitura. Antes ela respondia
     sempre, na hora e com sucesso — o que tornava impossível testar o pior
     caso real do 4G da sala: a escrita que NUNCA volta. Um formulário que
     fica "Enviando…" para sempre é indistinguível de site quebrado, e era
     justamente esse caminho que nenhum teste alcançava. */
  /* Registra toda escrita em window.__ESCRITAS. Sem isto não dá para provar
     que uma edição chegou em TODOS os lugares que deveria — só que a tela não
     deu erro, que é coisa bem diferente. */
  function anotar(path, valor) {
    window.__ESCRITAS = window.__ESCRITAS || [];
    if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
      /* update() multi-caminho: cada chave é um caminho próprio a partir da raiz */
      var chaves = Object.keys(valor);
      var pareceMultiPath = path === '' && chaves.some(function (k) { return k.indexOf('/') !== -1; });
      if (pareceMultiPath) {
        chaves.forEach(function (k) { window.__ESCRITAS.push({ path: k, valor: valor[k] }); });
        return;
      }
    }
    window.__ESCRITAS.push({ path: path, valor: valor });
  }

  function escrever(self, cb) {
    setTimeout(function () {
      if (failsFor(self.path)) {
        var e = new Error('PERMISSION_DENIED (falso): ' + self.path);
        if (cb) cb(e);
        return;
      }
      if (cb) cb(null);
    }, delayFor(self.path));
  }
  Ref.prototype.update = function (v, cb) { anotar(this.path, v); escrever(this, cb); return Promise.resolve(); };
  Ref.prototype.set    = function (v, cb) { anotar(this.path, v); escrever(this, cb); return Promise.resolve(); };
  Ref.prototype.remove = function (cb)    { anotar(this.path, null); if (cb) cb(null); return Promise.resolve(); };
  Ref.prototype.push   = function (v, cb) { if (cb) cb(null); var r = new Ref(this.path + '/fake'); r.key = 'fake'; return r; };
  Ref.prototype.orderByChild = function () { return this; };
  Ref.prototype.equalTo      = function () { return this; };
  Ref.prototype.limitToLast  = function () { return this; };

  var authCbs = [];
  var currentUser = CFG.user || null;

  var firebase = {
    apps: [],
    initializeApp: function (c) { firebase.apps.push(c); return {}; },
    auth: function () {
      return {
        currentUser: currentUser,
        onAuthStateChanged: function (cb) {
          authCbs.push(cb);
          setTimeout(function () { cb(currentUser); }, CFG.authDelay || 0);
          return function () {};
        },
        signInWithEmailAndPassword: function (e) {
          currentUser = { email: e, emailVerified: true, uid: 'u1' };
          authCbs.forEach(function (cb) { cb(currentUser); });
          return Promise.resolve({ user: currentUser });
        },
        signOut: function () {
          currentUser = null;
          authCbs.forEach(function (cb) { cb(null); });
          return Promise.resolve();
        },
        sendPasswordResetEmail: function () { return Promise.resolve(); },
        createUserWithEmailAndPassword: function () { return Promise.resolve({ user: currentUser }); }
      };
    },
    database: function () { return { ref: function (p) { return new Ref(p || ''); }, goOnline: function () {}, goOffline: function () {} }; }
  };
  firebase.database.ServerValue = { TIMESTAMP: 1 };
  window.firebase = firebase;
})();
