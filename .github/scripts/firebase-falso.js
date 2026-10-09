/* Firebase compat FALSO — só o suficiente para o site carregar e autenticar.
   Comportamento controlado por window.__CFG (injetado antes deste script). */
(function () {
  var CFG = window.__CFG || {};
  var DB  = CFG.db || {};
  /* Modo opcional (__CFG.persistenciaReal = true): grava e lê como o
     Firebase DE VERDADE — some com null, objeto vazio e lista vazia, e
     devolve listas no formato do RTDB (ver persistencia-firebase-real.js,
     que precisa ser servido ANTES deste arquivo). Desligado por padrão
     para não mudar o comportamento dos testes que já existem; ligado nos
     testes que precisam provar que a semântica sobrevive à persistência
     (o defeito do fallback do motor arquitetural só existia no banco real). */
  var REAL = !!CFG.persistenciaReal;
  if (REAL && typeof window.__comoFirebaseReal !== 'function') {
    throw new Error('firebase-falso: persistenciaReal exige persistencia-firebase-real.js carregado antes');
  }
  function lerComoBanco(v) { return REAL ? window.__comoFirebaseReal(v) : v; }
  /* O site carrega este arquivo 3 vezes (app/database/auth): a cópia
     normalizada fica em __CFG.__dbReal para as três usarem o MESMO banco
     (e para o teste poder inspecioná-lo). */
  if (REAL) {
    if (!CFG.__dbReal) CFG.__dbReal = lerComoBanco(DB) || {};
    DB = CFG.__dbReal;
  }

  function get(path) {
    var parts = String(path).split('/').filter(Boolean);
    var node = DB;
    for (var i = 0; i < parts.length; i++) {
      if (node == null || typeof node !== 'object') return null;
      node = node[parts[i]];
    }
    return node === undefined ? null : node;
  }
  /* filtro = { campo, valor } (orderByChild(campo).equalTo(valor)): devolve só
     os filhos cujo campo é igual ao valor — como o Firebase de verdade. */
  function snap(path, filtro, porChave) {
    var v = lerComoBanco(get(path));
    /* porChave = { fim, limite } (orderByKey().endAt(fim).limitToLast(limite)): filhos em ordem de chave
       (as chaves de push crescem com o tempo), só até `fim` (inclusive) e só os `limite` últimos. */
    if (porChave && v && typeof v === 'object') {
      var ks = Object.keys(v).sort();
      if (porChave.fim !== undefined && porChave.fim !== null) ks = ks.filter(function (k) { return k <= porChave.fim; });
      if (typeof porChave.limite === 'number') ks = ks.slice(Math.max(0, ks.length - porChave.limite));
      var ord = {};
      ks.forEach(function (k) { ord[k] = v[k]; });
      v = ks.length ? ord : null;
    }
    if (filtro && v && typeof v === 'object') {
      var filtrado = {};
      Object.keys(v).forEach(function (k) {
        var filho = v[k];
        if (filho && typeof filho === 'object' && filho[filtro.campo] === filtro.valor) filtrado[k] = filho;
      });
      v = Object.keys(filtrado).length ? filtrado : null;
    }
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
  /* __CFG.exigeLogin = [prefixos]: como as regras do banco real, leitura sem sessão nesses caminhos é
     RECUSADA — e, como no Firebase de verdade, uma escuta (.on) recusada é CANCELADA e nunca volta
     sozinha, nem depois do login. O estado de login vive em CFG.__logado porque o site carrega este
     arquivo três vezes (app/database/auth) e as três cópias precisam concordar. */
  if (!('__logado' in CFG)) CFG.__logado = CFG.user ? CFG.user.email : null;
  function exigeLoginPara(path) {
    return !CFG.__logado && (CFG.exigeLogin || []).some(function (p) { return String(path).indexOf(p) === 0; });
  }

  /* Caminhos que só aceitam leitura FILTRADA (orderByChild + equalTo), como as
     regras do banco fazem com quem só tem o perfil "consulta" em
     avaliacoes-produto: pedir o nó inteiro é recusado. Serve para provar que a
     tela pede a consulta certa ANTES de ligar o ouvinte. */
  function exigeFiltro(self) {
    var lista = CFG.somenteFiltrado || [];
    return lista.indexOf(norm(self.path)) !== -1 && !self._temIgual;
  }
  function Ref(path) { this.path = path; }
  Ref.prototype.child = function (p) { return new Ref(this.path + '/' + p); };
  Ref.prototype.once = function (evt, ok, err) {
    var self = this;
    var p = new Promise(function (resolve, reject) {
      setTimeout(function () {
        var semLogin = exigeLoginPara(self.path);
        if (semLogin || failsFor(self.path) || exigeFiltro(self)) {
          var e = new Error('PERMISSION_DENIED (falso): ' + self.path);
          e.code = 'PERMISSION_DENIED';
          e.__semLogin = semLogin;
          if (err) err(e);
          reject(e);
          return;
        }
        var s = snap(self.path, self._temIgual ? { campo: self._ordem, valor: self._igual } : null, self._porChave ? { fim: self._fim, limite: self._limite } : null);
        if (ok) ok(s);
        resolve(s);
      }, delayFor(self.path));
    });
    p.catch(function () {});  /* o site precisa tratar; aqui só evita ruído do harness */
    return p;
  };
  Ref.prototype.on = function (evt, ok, err) {
    var ouvinte = { path: this.path, cb: ok, filtro: this._temIgual ? { campo: this._ordem, valor: this._igual } : null };
    ouvintes.push(ouvinte);
    this.once(evt, ok, function (e) {
      /* recusa por falta de sessão cancela a escuta, como no Firebase real */
      if (e && e.__semLogin) ouvintes = ouvintes.filter(function (l) { return l !== ouvinte; });
      if (err) err(e);
    });
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
  /* O SDK de verdade RECUSA, de forma SÍNCRONA, qualquer set/update/push cujo
     valor contenha `undefined` em qualquer profundidade ("Reference.update
     failed: First argument contains undefined in property 'a.b'"). Só em
     persistenciaReal (o modo que imita o banco de verdade) — nos demais o
     falso aceita, como sempre aceitou. Sem isso, um `undefined` esquecido
     num payload passava em todo teste e só estourava em produção, dentro de
     um clique, sem mensagem nenhuma. */
  function acharUndefined(valor, caminho) {
    if (valor === undefined) return caminho;
    if (valor && typeof valor === 'object') {
      var chaves = Object.keys(valor);
      for (var i = 0; i < chaves.length; i++) {
        var r = acharUndefined(valor[chaves[i]], caminho ? caminho + '.' + chaves[i] : chaves[i]);
        if (r) return r;
      }
    }
    return null;
  }
  function anotar(path, valor) {
    if (REAL) {
      var onde = acharUndefined(valor, '');
      if (onde !== null) throw new Error('Reference.update failed: First argument contains undefined in property \'' + onde + '\' (falso em persistenciaReal, como o SDK)');
    }
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
    if (REAL && !merge) {
      valor = lerComoBanco(valor);
      if (valor === null) { delete node[ultima]; podarVazios(parts); return; }
    }
    if (valor === null || valor === undefined) { delete node[ultima]; return; }
    if (merge && node[ultima] && typeof node[ultima] === 'object' && typeof valor === 'object' && !Array.isArray(valor)) {
      Object.keys(valor).forEach(function (k) {
        var vk = lerComoBanco(valor[k]);
        if (vk === null || vk === undefined) delete node[ultima][k];
        else node[ultima][k] = vk;
      });
      if (REAL) podarVazios(parts.concat(['_']));
    } else {
      node[ultima] = valor;
    }
  }
  /* Firebase real: um nó que ficou sem nenhum filho deixa de existir, e
     isso sobe pela árvore. */
  function podarVazios(parts) {
    for (var fim = parts.length - 1; fim > 0; fim--) {
      var pai = DB;
      for (var i = 0; i < fim - 1; i++) { pai = pai && pai[parts[i]]; }
      var chave = parts[fim - 1];
      if (!pai || !pai[chave] || typeof pai[chave] !== 'object' || Object.keys(pai[chave]).length) return;
      delete pai[chave];
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
      setTimeout(function () { l.cb(snap(l.path, l.filtro)); }, delayFor(l.path));
    });
  }

  function escrever(self, cb, valor, merge) {
    setTimeout(function () {
      if (failsFor(self.path)) {
        var e = new Error('PERMISSION_DENIED (falso): ' + self.path);
        e.code = 'PERMISSION_DENIED';
        if (cb) cb(e);
        return;
      }
      aplicar(self.path, valor, merge);
      if (cb) cb(null);
      notificar(self.path);
    }, delayFor(self.path));
  }
  /* update() multi-caminho é UMA gravação atômica de verdade (todos os
     caminhos ou nenhum) — mas os caminhos com "/" (o caso comum: gravar
     numa etapa de dentro de uma execução) passavam direto por `aplicar`,
     sem nunca consultar delayFor/failsFor. Uma tela que chamava só
     update() nunca conseguia ser testada sob rede lenta ou gravação
     recusada — o pior caso real (a pessoa clica, a escrita nem chega,
     e a tela já foi embora) ficava fora do alcance de qualquer teste. */
  Ref.prototype.update = function (v, cb) {
    anotar(this.path, v);
    /* Chave com "/" dentro de um update é caminho relativo, não nome de campo. */
    var self = this, direto = {}, relativos = [];
    Object.keys(v || {}).forEach(function (k) {
      if (k.indexOf('/') !== -1) relativos.push(k); else direto[k] = v[k];
    });
    var caminhosRelativos = relativos.map(function (k) { return norm(self.path + '/' + k); });
    var todosCaminhos = caminhosRelativos.concat(self.path);
    var falha = todosCaminhos.some(failsFor);
    var atraso = todosCaminhos.reduce(function (m, p) { return Math.max(m, delayFor(p)); }, 0);
    setTimeout(function () {
      if (falha) {
        var e = new Error('PERMISSION_DENIED (falso): update ' + todosCaminhos.join(', '));
        e.code = 'PERMISSION_DENIED';
        if (cb) cb(e);
        return;
      }
      relativos.forEach(function (k) { aplicar(norm(self.path + '/' + k), v[k], false); });
      aplicar(self.path, direto, true);
      /* notificar() ANTES do cb (onComplete) — o Firebase de verdade
         aplica update() no cache local de forma otimista e avisa quem
         está ouvindo os caminhos afetados ANTES de o onComplete deste
         update() disparar (que só chega depois de um round-trip com o
         servidor). A ordem importa de verdade: um .off() chamado DENTRO
         do onComplete (ex.: trocar de execução e desligar o listener da
         antiga) só evita o eco se esse eco ainda não tiver sido
         agendado — exatamente como no SDK real. Inverter esta ordem
         (como era antes) escondia essa classe inteira de corrida atrás
         de um comportamento que o Firebase de verdade nunca teve. */
      notificar(self.path);
      /* CFG.semConfirmacao (prefixos): o servidor APLICOU, mas a confirmação nunca chega ao cliente. */
      var semAck = (CFG.semConfirmacao || []).some(function (pfx) { return todosCaminhos.some(function (c) { return String(c).indexOf(pfx) === 0; }); });
      /* CFG.atrasoConfirmacao ({prefixo: ms}): o servidor APLICA na hora (na ordem de envio, como o
         Firebase real faz com as gravações de um mesmo cliente), mas a confirmação chega só depois de
         ms — o caso "a resposta do envio antigo chega por último". Lido no momento da aplicação. */
      var atrasoAck = 0;
      Object.keys(CFG.atrasoConfirmacao || {}).forEach(function (pfx) {
        if (todosCaminhos.some(function (c) { return String(c).indexOf(pfx) === 0; })) atrasoAck = Math.max(atrasoAck, CFG.atrasoConfirmacao[pfx]);
      });
      if (cb && !semAck) { if (atrasoAck) setTimeout(function () { cb(null); }, atrasoAck); else cb(null); }
    }, atraso);
    return Promise.resolve();
  };
  /* transaction(): usado hoje só pelo contador de execuções (Fase 1 da
     evolução de execuções). Cada chamada lê o valor ATUAL do caminho e
     aplica a função de atualização dentro do mesmo setTimeout em que
     grava — como o harness é de thread único, isso já garante que duas
     chamadas em sequência rápida (o caso que os testes de concorrência
     querem provar) nunca leem o mesmo valor de partida: a segunda só
     roda depois que a primeira já commitou, exatamente a garantia que o
     Firebase de verdade dá (mas por serialização de fila, não por
     retry). Retornar `undefined` da função de atualização aborta, como
     no SDK real. */
  Ref.prototype.transaction = function (updateFn, onComplete) {
    var self = this;
    setTimeout(function () {
      if (failsFor(self.path)) {
        var e = new Error('PERMISSION_DENIED (falso): transaction ' + self.path);
        e.code = 'PERMISSION_DENIED';
        if (onComplete) onComplete(e, false, null);
        return;
      }
      var valorAtual = lerComoBanco(get(self.path));
      var novoValor = updateFn(valorAtual);
      if (novoValor === undefined) {
        if (onComplete) onComplete(null, false, snap(self.path));
        return;
      }
      aplicar(self.path, novoValor, false);
      anotar(self.path, novoValor);
      var s = snap(self.path);
      if (onComplete) onComplete(null, true, s);
      notificar(self.path);
    }, delayFor(self.path));
    return Promise.resolve({ committed: true, snapshot: null });
  };
  Ref.prototype.set    = function (v, cb) { anotar(this.path, v); escrever(this, cb, v, false); return Promise.resolve(); };
  Ref.prototype.remove = function (cb)    { anotar(this.path, null); aplicar(this.path, null, false); if (cb) cb(null); notificar(this.path); return Promise.resolve(); };
  /* Uma chave nova por chamada — não "/fake" sempre igual, senão duas
     pushes no mesmo caminho (comum quando um teste revela/refaz mais de
     uma vez, ou cria mais de um grupo) se sobrescreveriam em vez de
     virarem duas entradas, o que o Firebase de verdade nunca faria.
     CFG.pushSeqInicial: um teste que recarrega a página mantendo o banco
     começa a contagem depois das chaves já criadas (senão "fake0" de novo
     sobrescreveria um registro da carga anterior). */
  var _pushSeq = CFG.pushSeqInicial || 0;
  Ref.prototype.push   = function (v, cb) {
    var key = 'fake' + (_pushSeq++);
    var r = new Ref(this.path + '/' + key);
    r.key = key;
    if (v !== undefined) { r.set(v, cb); } else if (cb) { cb(null); }
    return r;
  };
  Ref.prototype.orderByChild = function (campo) { var r = new Ref(this.path); r._ordem = campo; return r; };
  Ref.prototype.equalTo      = function (valor) { var r = new Ref(this.path); r._ordem = this._ordem; r._igual = valor; r._temIgual = true; return r; };
  /* consulta por chave: orderByKey() / endAt(chave) / limitToLast(n). Fora do orderByKey, limitToLast
     continua não filtrando nada (outros testes dependem disso). */
  function clonar(self) { var r = new Ref(self.path); ['_ordem', '_igual', '_temIgual', '_porChave', '_fim', '_limite'].forEach(function (k) { r[k] = self[k]; }); return r; }
  Ref.prototype.orderByKey   = function () { var r = clonar(this); r._porChave = true; return r; };
  Ref.prototype.endAt        = function (valor) { var r = clonar(this); r._fim = valor; return r; };
  Ref.prototype.limitToLast  = function (n) { if (!this._porChave) return this; var r = clonar(this); r._limite = n; return r; };
  /* limitToFirst(n) sem orderByKey: não filtra (devolve o nó inteiro), igual ao limitToLast acima.
     Basta para quem só quer saber se a leitura responde (o Smoke usa assim). */
  Ref.prototype.limitToFirst = function () { return this; };

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
          CFG.__logado = e;
          authCbs.forEach(function (cb) { cb(currentUser); });
          return Promise.resolve({ user: currentUser });
        },
        signOut: function () {
          currentUser = null;
          CFG.__logado = null;
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
