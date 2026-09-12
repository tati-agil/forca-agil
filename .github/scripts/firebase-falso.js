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
    ouvintes.push({ path: this.path, cb: ok });
    this.once(evt, ok, err);
    return ok;
  };
  Ref.prototype.off = function (evt, cb) {
    var self = this;
    ouvintes = ouvintes.filter(function (l) {
      return !(norm(l.path) === norm(self.path) && (!cb || l.cb === cb));
    });
  };
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

  /* A escrita agora MUDA o banco falso e avisa quem está ouvindo.
     Antes ela só era anotada: o banco continuava o mesmo e nenhum listener
     acordava. Isso deixava um buraco inteiro fora de alcance — o site lê o
     que gravou (ref.on('value')) para redesenhar a tela, então dava para
     provar que a gravação saiu, e não que a TELA passou a mostrar o
     resultado. É a diferença entre "o pedido foi reenquadrado no banco" e
     "a lista mostra o tipo novo", e a segunda é a que a pessoa vê. */
  function aplicar(path, valor, merge) {
    var parts = String(path).split('/').filter(Boolean);
    if (!parts.length) {
      /* update() na raiz: cada chave é um caminho completo */
      Object.keys(valor || {}).forEach(function (k) { aplicar(k, valor[k], false); });
      return;
    }
    var node = DB;
    for (var i = 0; i < parts.length - 1; i++) {
      if (node[parts[i]] == null || typeof node[parts[i]] !== 'object') node[parts[i]] = {};
      node = node[parts[i]];
    }
    var ultima = parts[parts.length - 1];
    if (valor === null || valor === undefined) { delete node[ultima]; return; }
    if (merge && node[ultima] && typeof node[ultima] === 'object' && typeof valor === 'object' && !Array.isArray(valor)) {
      Object.keys(valor).forEach(function (k) {
        if (valor[k] === null) delete node[ultima][k];
        else node[ultima][k] = valor[k];
      });
    } else {
      node[ultima] = valor;
    }
  }

  var ouvintes = [];
  function norm(p) { return String(p).split('/').filter(Boolean).join('/'); }
  /* Quem ouve a raiz de um nó também é afetado pela escrita num filho dele,
     e vice-versa — é assim que o Firebase de verdade se comporta. */
  function afetado(ouvido, escrito) {
    var a = norm(ouvido), b = norm(escrito);
    if (!a || !b) return true;
    return a === b || b.indexOf(a + '/') === 0 || a.indexOf(b + '/') === 0;
  }
  function notificar(path) {
    ouvintes.slice().forEach(function (l) {
      if (!afetado(l.path, path)) return;
      if (failsFor(l.path)) return;
      setTimeout(function () { l.cb(snap(l.path)); }, delayFor(l.path));
    });
  }

  function escrever(self, cb, valor, merge) {
    setTimeout(function () {
      if (failsFor(self.path)) {
        var e = new Error('PERMISSION_DENIED (falso): ' + self.path);
        if (cb) cb(e);
        return;
      }
      aplicar(self.path, valor, merge);
      if (cb) cb(null);
      notificar(self.path);
    }, delayFor(self.path));
  }
  Ref.prototype.update = function (v, cb) {
    anotar(this.path, v);
    /* Chave com "/" dentro de um update é caminho relativo, não nome de campo. */
    var self = this, direto = {}, relativos = [];
    Object.keys(v || {}).forEach(function (k) {
      if (k.indexOf('/') !== -1) relativos.push(k); else direto[k] = v[k];
    });
    relativos.forEach(function (k) { aplicar(norm(self.path + '/' + k), v[k], false); });
    escrever(this, cb, direto, true);
    return Promise.resolve();
  };
  Ref.prototype.set    = function (v, cb) { anotar(this.path, v); escrever(this, cb, v, false); return Promise.resolve(); };
  Ref.prototype.remove = function (cb)    { anotar(this.path, null); aplicar(this.path, null, false); if (cb) cb(null); notificar(this.path); return Promise.resolve(); };
  Ref.prototype.push   = function (v, cb) { if (cb) cb(null); var r = new Ref(this.path + '/fake'); r.key = 'fake'; return r; };
  Ref.prototype.orderByChild = function () { return this; };
  Ref.prototype.equalTo      = function () { return this; };
  Ref.prototype.limitToLast  = function () { return this; };

  var authCbs = [];

  /* O usuário do Firebase real traz métodos próprios; o falso precisa dos que
     o site usa, senão o caminho que os chama estoura em vez de ser testado. */
  function novoUsuario(email) {
    return {
      email: email, emailVerified: true, uid: 'u1',
      updateEmail: function (novo) {
        if ((CFG.falharUpdateEmail || []).indexOf(novo) !== -1) {
          var err = new Error('e-mail já em uso (falso)');
          err.code = 'auth/email-already-in-use';
          return Promise.reject(err);
        }
        this.email = novo;
        if (CFG.senhas && CFG.senhas[email] !== undefined) {
          CFG.senhas[novo] = CFG.senhas[email];
          delete CFG.senhas[email];
        }
        return Promise.resolve();
      },
      sendEmailVerification: function () { return Promise.resolve(); }
    };
  }

  var currentUser = CFG.user ? novoUsuario(CFG.user.email) : null;

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
        /* A senha importa quando CFG.senhas existe. Sem esse mapa, qualquer
           senha entra — é o comportamento de sempre, que os testes antigos
           usam. Com ele dá para exercitar o que não tinha como testar: o
           painel entrando na conta de outra pessoa para corrigir o e-mail, e
           a recusa quando a pessoa já trocou a senha padrão. */
        signInWithEmailAndPassword: function (e, senha) {
          var mapa = CFG.senhas;
          if (mapa && mapa[e] !== undefined && mapa[e] !== senha) {
            var err = new Error('senha incorreta (falso)');
            err.code = 'auth/wrong-password';
            return Promise.reject(err);
          }
          if (mapa && mapa[e] === undefined) {
            var err2 = new Error('conta inexistente (falso)');
            err2.code = 'auth/user-not-found';
            return Promise.reject(err2);
          }
          currentUser = novoUsuario(e);
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
