/* ============================================================
   Arquivo Holocron — repositório de recursos da oficina.
   Recursos-semente (curados) + recursos adicionados pelos usuários
   salvos no Firebase Realtime Database — visíveis para todos.
   ============================================================ */
(function () {

  const KIND = {
    video: { label: 'Vídeo',       icon: '#i-play' },
    doc:   { label: 'Documento',   icon: '#i-doc'  },
    tool:  { label: 'Ferramenta',  icon: '#i-tool' },
    link:  { label: 'Link',        icon: '#i-link' }
  };

  // Recursos curados (sempre visíveis, não editáveis)
  const SEEDS = [
    { type: 'doc',   title: 'Manifesto Ágil (PT-BR)',               url: 'https://agilemanifesto.org/iso/ptbr/manifesto.html',                                         desc: 'Os 4 valores que abrem a jornada — a Força em sua forma original.' },
    { type: 'doc',   title: 'Os 12 Princípios do Manifesto',         url: 'https://agilemanifesto.org/iso/ptbr/principles.html',                                        desc: 'O Código Jedi completo: os princípios por trás dos valores.' },
    { type: 'doc',   title: 'The Scrum Guide',                       url: 'https://scrumguides.org/',                                                                    desc: 'Guia oficial do Scrum — papéis, eventos e artefatos.' },
    { type: 'video', title: 'Agile Product Ownership in a Nutshell', url: 'https://www.youtube.com/results?search_query=agile+product+ownership+in+a+nutshell+kniberg', desc: 'Henrik Kniberg explica Product Ownership ágil em ~15 min.' },
    { type: 'video', title: 'O que é Agilidade? (busca)',            url: 'https://www.youtube.com/results?search_query=o+que+%C3%A9+agilidade+business+agility',       desc: 'Vídeos introdutórios sobre agilidade e business agility.' },
    { type: 'tool',  title: 'OKR — Objetivos e Key Results',         url: 'https://www.youtube.com/results?search_query=como+escrever+okr+objetivo+key+results',        desc: 'Como escrever bons Objetivos e Key Results — dinâmica do Dia 1.' },
    { type: 'tool',  title: 'Design Thinking & Duplo Diamante',      url: 'https://www.youtube.com/results?search_query=duplo+diamante+design+thinking',                desc: 'Divergir e convergir: o conceito trabalhado no Dia 3.' }
  ];

  // ---- Helpers ----
  function getPlayer() {
    try { return JSON.parse(localStorage.getItem('fa-player') || 'null') || null; } catch(e) { return null; }
  }
  function host(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch(e) { return 'abrir'; } }
  function esc(s) {
    return String(s || '').replace(/[&<>"]/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function sanitizeKey(str) {
    return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 40);
  }

  // ---- Estado ----
  let filter = 'all';
  let firebaseItems = []; // itens vindos do Firebase

  const grid      = document.getElementById('repoGrid');
  const emptyMsg  = document.getElementById('repoEmpty');
  if (!grid) return;

  // ---- Card builder ----
  function card(item, isSeed, firebaseKey) {
    const k  = KIND[item.type] || KIND.link;
    const me = getPlayer();
    const isMine = !isSeed && me && item.authorKey &&
      item.authorKey === (sanitizeKey(me.name) + '__' + sanitizeKey(me.turma));

    const el = document.createElement('article');
    el.className = 'repo-card';
    el.dataset.type = item.type;

    el.innerHTML =
      '<div class="rc-top">' +
        '<span class="rc-ico"><svg><use href="' + k.icon + '"/></svg></span>' +
        '<span><span class="rc-kind">' + k.label + '</span><h4>' + esc(item.title) + '</h4></span>' +
      '</div>' +
      (item.desc ? '<p>' + esc(item.desc) + '</p>' : '<p></p>') +
      '<a class="rc-open" href="' + esc(item.url) + '" target="_blank" rel="noopener noreferrer">' +
        '<svg><use href="#i-ext"/></svg> ' + esc(host(item.url)) +
      '</a>' +
      (isSeed
        ? '<span class="rc-seed">curado</span>'
        : '<span class="rc-author">' +
            esc(item.authorName || 'Agente') +
            (item.authorTurma ? ' · ' + esc(item.authorTurma) : '') +
          '</span>') +
      (isMine
        ? '<button class="rc-del" title="Remover meu recurso" data-key="' + esc(firebaseKey) + '">' +
            '<svg width="14" height="14"><use href="#i-x"/></svg>' +
          '</button>'
        : '');

    return el;
  }

  // ---- Render ----
  function render() {
    grid.innerHTML = '';
    const seeds = SEEDS.map(function(s) { return { item: s, seed: true, key: null }; });
    const user  = firebaseItems.map(function(x) { return { item: x.data, seed: false, key: x.key }; });
    const all   = seeds.concat(user);
    const shown = all.filter(function(x) { return filter === 'all' || x.item.type === filter; });

    shown.forEach(function(x) {
      var el = card(x.item, x.seed, x.key);
      grid.appendChild(el);
    });

    if (emptyMsg) emptyMsg.hidden = shown.length > 0;

    // botões de deletar (só nos próprios)
    grid.querySelectorAll('.rc-del').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var key = btn.dataset.key;
        if (!key) return;
        if (!confirm('Remover este recurso do holocron?')) return;
        try {
          firebase.database().ref('holocron/' + key).remove();
        } catch(e) { console.warn('Firebase remove error:', e); }
      });
    });
  }

  // ---- Escuta Firebase em tempo real ----
  function listenFirebase() {
    try {
      firebase.database().ref('holocron').orderByChild('createdAt')
        .on('value', function(snapshot) {
          var data = snapshot.val();
          firebaseItems = [];
          if (data) {
            Object.keys(data).forEach(function(k) {
              firebaseItems.push({ key: k, data: data[k] });
            });
            // mais recentes primeiro
            firebaseItems.reverse();
          }
          render();
        });
    } catch(e) {
      console.warn('Firebase holocron listen error:', e);
      render();
    }
  }

  // ---- Filtros ----
  const filters = document.getElementById('repoFilters');
  filters && filters.addEventListener('click', function(e) {
    var chip = e.target.closest('.repo-chip');
    if (!chip) return;
    filters.querySelectorAll('.repo-chip').forEach(function(c) { c.classList.remove('active'); });
    chip.classList.add('active');
    filter = chip.dataset.f;
    render();
  });

  // ---- Formulário de adição ----
  const form      = document.getElementById('repoForm');
  const addBtn    = document.getElementById('repoAddBtn');
  const cancelBtn = document.getElementById('repoCancel');

  addBtn && addBtn.addEventListener('click', function() {
    // exige cadastro
    var p = getPlayer();
    if (!p || !p.name) {
      var btn = document.getElementById('openRegister');
      if (btn) btn.click();
      return;
    }
    form.hidden = !form.hidden;
    if (!form.hidden) document.getElementById('rfTitle').focus();
  });

  cancelBtn && cancelBtn.addEventListener('click', function() {
    form.hidden = true;
    form.reset();
  });

  form && form.addEventListener('submit', function(e) {
    e.preventDefault();
    var p = getPlayer();
    if (!p || !p.name) {
      var btn = document.getElementById('openRegister');
      if (btn) btn.click();
      return;
    }

    var title = document.getElementById('rfTitle').value.trim();
    var url   = document.getElementById('rfUrl').value.trim();
    var type  = document.getElementById('rfType').value;
    var desc  = document.getElementById('rfDesc').value.trim();
    if (!title || !url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

    var entry = {
      type:        type,
      title:       title,
      url:         url,
      desc:        desc,
      authorName:  p.name,
      authorTurma: p.turma || '',
      authorArea:  p.area  || '',
      authorKey:   sanitizeKey(p.name) + '__' + sanitizeKey(p.turma),
      createdAt:   new Date().toISOString()
    };

    try {
      firebase.database().ref('holocron').push(entry)
        .then(function() {
          form.reset();
          form.hidden = true;
          // muda filtro para "todos" para o novo card aparecer
          filter = 'all';
          filters && filters.querySelectorAll('.repo-chip').forEach(function(c) {
            c.classList.toggle('active', c.dataset.f === 'all');
          });
        })
        .catch(function(err) { console.warn('Firebase push error:', err); });
    } catch(err) {
      console.warn('Firebase unavailable:', err);
    }
  });

  // ---- Init ----
  listenFirebase();

})();
