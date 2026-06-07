/* ============================================================
   Arquivo Holocron — repositório de recursos da oficina.
   Recursos-semente (curados) + recursos adicionados pelo usuário,
   persistidos em localStorage. Filtro por tipo.
   ============================================================ */
(function () {
  const STORE = 'fa-repo-v1';

  const KIND = {
    video: { label: 'Vídeo', icon: '#i-play' },
    doc:   { label: 'Documento', icon: '#i-doc' },
    tool:  { label: 'Ferramenta', icon: '#i-tool' },
    link:  { label: 'Link', icon: '#i-link' }
  };

  // Curated starter resources (canonical, stable links).
  const SEEDS = [
    { type: 'doc',  title: 'Manifesto Ágil (PT-BR)', url: 'https://agilemanifesto.org/iso/ptbr/manifesto.html', desc: 'Os 4 valores que abrem a jornada — a Força em sua forma original.' },
    { type: 'doc',  title: 'Os 12 Princípios do Manifesto', url: 'https://agilemanifesto.org/iso/ptbr/principles.html', desc: 'O Código Jedi completo: os princípios por trás dos valores.' },
    { type: 'doc',  title: 'The Scrum Guide', url: 'https://scrumguides.org/', desc: 'Guia oficial do Scrum — papéis, eventos e artefatos.' },
    { type: 'video', title: 'Agile Product Ownership in a Nutshell', url: 'https://www.youtube.com/results?search_query=agile+product+ownership+in+a+nutshell+kniberg', desc: 'Henrik Kniberg explica Product Ownership ágil em ~15 min.' },
    { type: 'video', title: 'O que é Agilidade? (busca)', url: 'https://www.youtube.com/results?search_query=o+que+%C3%A9+agilidade+business+agility', desc: 'Vídeos introdutórios sobre agilidade e business agility.' },
    { type: 'tool', title: 'OKR — Objetivos e Key Results', url: 'https://www.youtube.com/results?search_query=como+escrever+okr+objetivo+key+results', desc: 'Como escrever bons Objetivos e Key Results — dinâmica do Dia 1.' },
    { type: 'tool', title: 'Design Thinking & Duplo Diamante', url: 'https://www.youtube.com/results?search_query=duplo+diamante+design+thinking', desc: 'Divergir e convergir: o conceito trabalhado no Dia 3.' }
  ];

  let userItems = [];
  try { const s = JSON.parse(localStorage.getItem(STORE) || '[]'); if (Array.isArray(s)) userItems = s; } catch (e) {}
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(userItems)); } catch (e) {} };

  let filter = 'all';

  const grid = document.getElementById('repoGrid');
  const emptyMsg = document.getElementById('repoEmpty');
  if (!grid) return;

  function host(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return 'abrir'; } }
  function esc(s) { return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  function card(item, isSeed, idx) {
    const k = KIND[item.type] || KIND.link;
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
        '<svg><use href="#i-ext"/></svg> ' + esc(host(item.url)) + '</a>' +
      (isSeed
        ? '<span class="rc-seed">curado</span>'
        : '<button class="rc-del" title="Remover" data-idx="' + idx + '"><svg width="14" height="14"><use href="#i-x"/></svg></button>');
    return el;
  }

  function render() {
    grid.innerHTML = '';
    const all = SEEDS.map(s => ({ item: s, seed: true }))
      .concat(userItems.map((u, i) => ({ item: u, seed: false, idx: i })));
    const shown = all.filter(x => filter === 'all' || x.item.type === filter);
    shown.forEach(x => grid.appendChild(card(x.item, x.seed, x.idx)));
    if (emptyMsg) emptyMsg.hidden = shown.length > 0;

    grid.querySelectorAll('.rc-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = +btn.dataset.idx;
        userItems.splice(i, 1); save(); render();
      });
    });
  }

  // Filters
  const filters = document.getElementById('repoFilters');
  filters && filters.addEventListener('click', e => {
    const chip = e.target.closest('.repo-chip'); if (!chip) return;
    filters.querySelectorAll('.repo-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    filter = chip.dataset.f; render();
  });

  // Add form toggle
  const form = document.getElementById('repoForm');
  const addBtn = document.getElementById('repoAddBtn');
  const cancelBtn = document.getElementById('repoCancel');
  addBtn && addBtn.addEventListener('click', () => {
    form.hidden = !form.hidden;
    if (!form.hidden) document.getElementById('rfTitle').focus();
  });
  cancelBtn && cancelBtn.addEventListener('click', () => { form.hidden = true; form.reset(); });

  form && form.addEventListener('submit', e => {
    e.preventDefault();
    const title = document.getElementById('rfTitle').value.trim();
    let url = document.getElementById('rfUrl').value.trim();
    const type = document.getElementById('rfType').value;
    const desc = document.getElementById('rfDesc').value.trim();
    if (!title || !url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    userItems.unshift({ type, title, url, desc });
    save(); form.reset(); form.hidden = true;
    // show the matching filter so the new card is visible
    if (filter !== 'all' && filter !== type) {
      filter = 'all';
      filters.querySelectorAll('.repo-chip').forEach(c => c.classList.toggle('active', c.dataset.f === 'all'));
    }
    render();
  });

  render();
})();
