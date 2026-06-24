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
    link:  { label: 'Link',        icon: '#i-link' },
    book:  { label: 'Livro',       icon: '#i-book' }
  };

  // Recursos curados (sempre visíveis, não editáveis)
  const SEEDS = [
    { type: 'doc',   title: 'The Scrum Guide',                       url: 'https://scrumguides.org/',                                                                    desc: 'Guia oficial do Scrum — papéis, eventos e artefatos.' },
    { type: 'video', title: 'Agile Product Ownership in a Nutshell', url: 'https://www.youtube.com/results?search_query=agile+product+ownership+in+a+nutshell+kniberg', desc: 'Henrik Kniberg explica Product Ownership ágil em ~15 min.' },
    { type: 'video', title: 'O que é Agilidade? (busca)',            url: 'https://www.youtube.com/results?search_query=o+que+%C3%A9+agilidade+business+agility',       desc: 'Vídeos introdutórios sobre agilidade e business agility.' },
    { type: 'tool',  title: 'OKR — Objetivos e Key Results',         url: 'https://www.youtube.com/results?search_query=como+escrever+okr+objetivo+key+results',        desc: 'Como escrever bons Objetivos e Key Results — conectando propósito, metas e entregas de valor.' },
    { type: 'tool',  title: 'Design Thinking & Duplo Diamante',      url: 'https://www.youtube.com/results?search_query=duplo+diamante+design+thinking',                desc: 'Divergir e convergir: a abordagem para resolver problemas complexos com criatividade e foco.' },
    { type: 'book',  title: 'Team OKR em Ação: Como Times de Verdade Transformam Estratégia em Resultados', url: 'https://caroli.org/livro/team-okr/', desc: '' },
    { type: 'book',  title: 'O Poder da Simplicidade no Mundo Ágil — Susanne Andrade', url: 'https://susanneandrade.com.br/livros-2', desc: '"Agilidade é diferente de correria." Uma leitura leve e acessível que mostra o ágil como cuidado com pessoas e colaboração com propósito — ótima porta de entrada para quem está começando a jornada. Indicado por Maira Prado.' },
    { type: 'video', title: 'MBA em Liderança Exponencial e Transformação Digital (Udemy)', url: 'https://www.udemy.com/course/xba-em-lideranca-exponencial-e-transformacao-digital/', desc: 'Liderança colaborativa, times autogerenciáveis e agilidade na prática — conteúdo baseado em casos reais de atendimentos gravados em sala de aula. Indicado por Vanisa Miksucas.' },
    { type: 'book',  title: 'Kanban: Mudança Evolucionária de Sucesso Para Seu Negócio de Tecnologia — David J. Anderson', url: 'https://shop.leankanban.com/collections/kanban-mudanca-evolucionaria-de-sucesso-para-seu-negocio-de-tecnologia-david-j-anderson-portuguese/david-anderson', desc: 'Base fundamental das métricas de fluxo: lead time, cycle time, throughput e WIP. Leitura essencial para entender e melhorar a eficiência de times ágeis. Indicado por Pedro Ferrari.' },
    { type: 'video', title: 'Fome de Poder — Processos (Lean com analogias a Star Wars)', url: 'https://www.youtube.com/watch?v=8Xt63PHuMqU', desc: 'Como eliminar desperdícios, criar fluxo contínuo e padronizar processos — os princípios Lean narrados com analogias diretas à saga Star Wars. Organizações ágeis não dependem de heróis; dependem de sistemas. Indicado por Daniel Frazão.' },
    { type: 'video', title: 'Desdobramento de OKR na prática', url: 'https://www.youtube.com/watch?v=jP35UFXDnzA', desc: 'A explicação mais clara sobre desdobramento de OKR: OKR não é meta de manutenção (isso é indicador) — é desejo de melhoria. OKRs devem ser poucos e receber atenção máxima. O desdobramento segue a árvore de indicadores da empresa: Anual (KR Estratégico) → Semestral (KR Tático) → Trimestral (KR do Squad). Um OKR só está realmente desdobrado quando existem planos de ação claros ligados a ele. Indicado por Rodolfo Credi.' }
  ];
  window.faRepoSeedCount = SEEDS.length;

  // ---- Helpers ----
  function getPlayer() {
    // Prefer new auth session, fall back to legacy fa-player
    const sess = window.faAuth && window.faAuth.getSession && window.faAuth.getSession();
    if (sess) return { name: sess.name, area: sess.area || '', turma: '', email: sess.email };
    try { return JSON.parse(localStorage.getItem('fa-player') || 'null') || null; } catch(e) { return null; }
  }
  function fmtDate(d) {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('pt-BR'); } catch(e) { return ''; }
  }
  function host(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch(e) { return 'abrir'; } }
  function firstName2(name) { var p = (name || '').trim().split(/\s+/); return p.slice(0, 2).join(' '); }
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
  let hiddenSeeds = {};   // seeds ocultos pelo admin
  let hiddenHolo  = {};   // itens de usuário ocultos pelo admin

  function seedKey(url) {
    return (url || '').toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 80);
  }

  const grid      = document.getElementById('repoGrid');
  const emptyMsg  = document.getElementById('repoEmpty');
  if (!grid) return;

  // event delegation para "ver mais / ver menos" — configurado uma vez, funciona após qualquer re-render
  grid.addEventListener('click', function(e) {
    const btn = e.target.closest('.rc-more');
    if (!btn) return;
    const p = btn.previousElementSibling;
    if (!p) return;
    const expanded = p.classList.toggle('rc-desc--expanded');
    btn.textContent = expanded ? 'ver menos' : 'ver mais';
  });

  // ---- Card builder ----
  function card(item, isSeed, firebaseKey) {
    const k  = KIND[item.type] || KIND.link;
    const me = getPlayer();
    const sess = window.faAuth && window.faAuth.getSession && window.faAuth.getSession();
    const isAdminUser = sess && window.faAuth.isAdmin && window.faAuth.isAdmin(sess.email);
    const isMine = !isSeed && me && (
      (item.authorEmail && sess && item.authorEmail === sess.email) ||
      (!item.authorEmail && me && item.authorKey &&
        item.authorKey === (sanitizeKey(me.name) + '__' + sanitizeKey(me.turma)))
    );

    const el = document.createElement('article');
    el.className = 'repo-card';
    el.dataset.type = item.type;

    el.innerHTML =
      '<div class="rc-top">' +
        '<span class="rc-ico"><svg><use href="' + k.icon + '"/></svg></span>' +
        '<span><span class="rc-kind">' + k.label + '</span><h4>' + esc(item.title) + '</h4></span>' +
      '</div>' +
      (function() {
        const raw = item.desc || '';
        const indMatch = raw.match(/\s*Indicado por ([^.]+)\.?\s*$/);
        const indBy = indMatch ? indMatch[1].trim() : null;
        const body = indBy ? raw.slice(0, raw.lastIndexOf(indMatch[0])).trim() : raw;
        const pHtml = '<p class="rc-desc">' + esc(body) + '</p>' +
          (body ? '<button class="rc-more">ver mais</button>' : '');
        const indHtml = indBy ? '<span class="rc-indicated">Indicado por ' + esc(indBy) + '</span>' : '';
        return pHtml + indHtml;
      })() +
      '<a class="rc-open" href="' + esc(item.url) + '" target="_blank" rel="noopener noreferrer">' +
        '<svg><use href="#i-ext"/></svg> ' + esc(host(item.url)) +
      '</a>' +
      (isSeed
        ? '<span class="rc-seed">curado</span>'
        : '<span class="rc-author">' +
            esc(firstName2(item.authorName || 'Agente')) +
            (item.createdAt ? '<span class="rc-date">' + fmtDate(item.createdAt) + '</span>' : '') +
          '</span>') +
      ((isMine || isAdminUser) && !isSeed
        ? '<button class="rc-del" title="Remover conteúdo" data-key="' + esc(firebaseKey) + '">' +
            '<svg width="14" height="14"><use href="#i-x"/></svg>' +
          '</button>'
        : '');

    return el;
  }

  // ---- Render ----
  function render() {
    grid.innerHTML = '';
    const seeds = SEEDS
      .filter(function(s) { return !hiddenSeeds[seedKey(s.url)]; })
      .map(function(s) { return { item: s, seed: true, key: null }; });
    const user  = firebaseItems
      .filter(function(x) { return !hiddenHolo[x.key]; })
      .map(function(x) { return { item: x.data, seed: false, key: x.key }; });
    const all   = seeds.concat(user);
    const shown = all.filter(function(x) { return filter === 'all' || x.item.type === filter; });

    shown.forEach(function(x) {
      const el = card(x.item, x.seed, x.key);
      grid.appendChild(el);
    });

    if (emptyMsg) emptyMsg.hidden = shown.length > 0;

    // botões de deletar (só nos próprios)
    grid.querySelectorAll('.rc-del').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const key = btn.dataset.key;
        if (!key) return;
        if (!confirm('Remover este conteúdo do holocron?')) return;
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
          const data = snapshot.val();
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
    const chip = e.target.closest('.repo-chip');
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

  function openRepoForm() {
    if (!form) return;
    form.hidden = false;
    document.getElementById('rfTitle').focus();
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  const repoLoginMsg = document.getElementById('repoLoginMsg');
  function showRepoMsg(txt) {
    if (!repoLoginMsg) return;
    repoLoginMsg.textContent = txt;
    repoLoginMsg.style.display = txt ? '' : 'none';
  }

  addBtn && addBtn.addEventListener('click', function() {
    const p = getPlayer();
    if (!p || !p.name) {
      showRepoMsg('Faça login para contribuir com o repositório.');
      window._pendingRepoForm = true;
      if (window.faOpenAuthModal) window.faOpenAuthModal('login');
      return;
    }
    showRepoMsg('');
    openRepoForm();
  });

  cancelBtn && cancelBtn.addEventListener('click', function() {
    form.hidden = true;
    form.reset();
  });

  form && form.addEventListener('submit', function(e) {
    e.preventDefault();
    const p = getPlayer();
    if (!p || !p.name) {
      const btn = document.getElementById('openRegister');
      if (btn) btn.click();
      return;
    }

    let title = document.getElementById('rfTitle').value.trim();
    let url   = document.getElementById('rfUrl').value.trim();
    const type  = document.getElementById('rfType').value;
    const desc  = document.getElementById('rfDesc').value.trim();
    if (!title || !url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

    const sess  = window.faAuth && window.faAuth.getSession && window.faAuth.getSession();
    const entry = {
      type:        type,
      title:       title,
      url:         url,
      desc:        desc,
      authorName:  p.name,
      authorEmail: (sess && sess.email) || '',
      authorArea:  p.area  || '',
      authorKey:   sanitizeKey(p.name) + '__' + sanitizeKey(p.turma || ''),
      createdAt:   new Date().toISOString()
    };

    const btn = form.querySelector('[type=submit]');
    if (btn) { btn.disabled = true; btn.textContent = 'Verificando…'; }

    function normalizeUrl(u) { return (u || '').toLowerCase().replace(/\/+$/, ''); }

    try {
      firebase.database().ref('holocron').once('value', function(snap) {
        const data = snap.val();
        if (data) {
          const exists = Object.values(data).some(function(item) {
            return normalizeUrl(item.url) === normalizeUrl(url);
          });
          if (exists) {
            btn.disabled = false; btn.textContent = 'Guardar no Holocron';
            const errEl = document.getElementById('repoFormErr');
            if (errEl) { errEl.textContent = 'Este conteúdo já foi adicionado ao Holocron.'; errEl.hidden = false; }
            return;
          }
        }
        saveEntry();
      }).catch(function() { saveEntry(); });
    } catch(err) {
      console.warn('Firebase unavailable:', err);
    }

    function saveEntry() {
      if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }
      firebase.database().ref('holocron').push(entry)
        .then(function() {
          if (btn) { btn.disabled = false; btn.textContent = 'Guardar no Holocron'; }
          form.reset();
          form.hidden = true;
          filter = 'all';
          filters && filters.querySelectorAll('.repo-chip').forEach(function(c) {
            c.classList.toggle('active', c.dataset.f === 'all');
          });
          // Award repo XP — só conta se patente ainda não foi revelada
          const _rst = window.faStore || localStorage;
          if (_rst.getItem('fa-patente-revealed') !== '1') {
            const cur = parseInt(_rst.getItem('fa-repo-xp') || '0', 10) || 0;
            try { _rst.setItem('fa-repo-xp', String(Math.min(20, cur + 10))); } catch(e) {}
            if (window.faSyncPlayer) window.faSyncPlayer();
            if (window.faSyncProgress) window.faSyncProgress();
          }
        })
        .catch(function(err) { console.warn('Firebase push error:', err); });
    }
  });

  // ---- Após cadastro/login: abre form se estava pendente ----
  function onAuthReady() {
    if (window._pendingRepoForm) {
      window._pendingRepoForm = false;
      setTimeout(openRepoForm, 300);
    }
  }
  window.addEventListener('fa-player-registered', onAuthReady);
  window.addEventListener('fa-auth-change', onAuthReady);

  // ---- Init ----
  try {
    firebase.database().ref('fa-seeds-hidden').on('value', function(snap) {
      hiddenSeeds = snap.val() || {};
      render();
    });
    firebase.database().ref('fa-holocron-hidden').on('value', function(snap) {
      hiddenHolo = snap.val() || {};
      render();
    });
  } catch(e) {}
  listenFirebase();

})();
