const state = { cfg: {}, levels: [], team: [] };
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const url = u => (/^https?:\/\//i.test(u || '') ? esc(u) : '');
const real = n => !!n && n.trim() !== '-';
const pts = rank => state.cfg.pointsBase - rank;
const enc = encodeURIComponent;
const link = (u, text) => (url(u) ? `<a href="${url(u)}" target="_blank" rel="noopener">${text}</a>` : '<span class="muted">—</span>');
const profile = name => `<a href="#/players/${enc(name)}">${esc(name)}</a>`;

let query = '', current = null, curKey = null;

async function load(name) {
  const r = await fetch(`data/v2/${name}.json`, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`data/v2/${name}.json: HTTP ${r.status}`);
  return r.json();
}

function ytId(l) {
  const m = (l || '').match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  return m ? m[1] : null;
}

function completions(lvl) {
  const out = [];
  if (real(lvl.verifier)) out.push({ name: lvl.verifier, role: 'Verifier', link: lvl.video, enjoyment: lvl.verifierEnjoyment });
  for (const v of lvl.victors || [])
    if (real(v.name) && v.name !== lvl.verifier) out.push({ name: v.name, role: 'Victor', link: v.video, enjoyment: v.enjoyment });
  return out;
}

const rating = n => (typeof n === 'number' && n >= 0 && n <= 10 ? n : null);
const dash = '<span class="muted">—</span>';

function enjoyment(lvl) {
  const r = completions(lvl).map(c => rating(c.enjoyment)).filter(n => n !== null);
  return r.length ? (r.reduce((a, b) => a + b, 0) / r.length).toFixed(2) : null;
}

function ranking() {
  const s = {};
  state.levels.forEach(l => completions(l).forEach(c => { s[c.name] = (s[c.name] || 0) + pts(l.rank); }));
  return Object.entries(s).map(([name, points]) => ({ name, points })).sort((a, b) => b.points - a.points).map((p, i) => ({ ...p, pos: i + 1 }));
}

const section = rank => (state.cfg.sections || []).find(s => rank <= s.maxRank)?.name || '';

function entries(kind) {
  const q = query.toLowerCase().trim();
  if (kind === 'demon') {
    const hits = state.levels.filter(l => [l.name, l.creator, l.verifier, l.id].some(f => String(f).toLowerCase().includes(q)));
    if (!hits.length) return `<p class="empty">No levels match “${esc(query)}”.</p>`;
    let last = null;
    return hits.map(l => {
      const s = section(l.rank), h = s && s !== last ? `<h2 class="section">${esc(s)}</h2>` : '';
      last = s;
      return `${h}<a class="entry" data-key="${l.rank}" href="#/demon/${l.rank}"><span class="rank">${l.rank}</span><span class="txt"><b>${esc(l.name)}</b><small>${esc(l.creator)}</small></span></a>`;
    }).join('');
  }
  const hits = ranking().filter(p => p.name.toLowerCase().includes(q));
  if (!hits.length) return `<p class="empty">No players match “${esc(query)}”.</p>`;
  return hits.map(p => `<a class="entry" data-key="${esc(p.name)}" href="#/players/${enc(p.name)}"><span class="rank">${p.pos}</span><span class="txt"><b>${esc(p.name)}</b><small>${p.points.toFixed(2)} pts</small></span></a>`).join('');
}

function demonDetail(key) {
  const l = state.levels.find(x => String(x.rank) === String(key));
  if (!l) return '<p class="empty panel">Level not found.</p>';
  const id = ytId(l.video);
  const media = id
    ? `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${esc(id)}" title="${esc(l.name)} verification" loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`
    : url(l.video) ? `<a class="btn" href="${url(l.video)}" target="_blank" rel="noopener">Watch verification</a>` : '';
  const rows = completions(l).map(c => `<tr><td>${profile(c.name)}</td><td>${c.role}</td><td>${rating(c.enjoyment)?.toFixed(2) ?? dash}</td><td>${link(c.link, 'Watch')}</td></tr>`).join('');
  return `<article class="panel detail"><h1>${esc(l.name)}</h1><p class="byline">by ${esc(l.creator)}</p>${media}
    <dl class="facts"><div><dt>Enjoyment</dt><dd>${enjoyment(l) ?? dash}</dd></div><div><dt>Points</dt><dd>${pts(l.rank).toFixed(2)}</dd></div>
    <div><dt class="copy-label">Level ID</dt><dd class="copy-id" data-id="${esc(l.id)}" title="Click to copy" style="cursor:pointer">${esc(l.id)}</dd></div><div><dt>Verifier</dt><dd>${profile(l.verifier)}</dd></div></dl>
    <h2>Records (${completions(l).length})</h2>${rows ? `<div class="tbl"><table><thead><tr><th>Player</th><th>Role</th><th>Enjoyment</th><th>Video</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="muted">No records yet.</p>'}</article>`;
}

function playerDetail(key) {
  const p = ranking().find(x => x.name === key);
  if (!p) return '<p class="empty panel">Player not found.</p>';
  const rows = state.levels.flatMap(l => completions(l).filter(c => c.name === p.name).map(c =>
    `<tr><td><a href="#/demon/${l.rank}">#${l.rank} ${esc(l.name)}</a></td><td>${c.role}</td><td>${pts(l.rank).toFixed(2)}</td><td>${link(c.link, 'Watch')}</td></tr>`)).join('');
  return `<article class="panel detail"><h1>${esc(p.name)}</h1><dl class="facts"><div><dt>Position</dt><dd>#${p.pos}</dd></div><div><dt>Total points</dt><dd>${p.points.toFixed(2)}</dd></div></dl>
    <h2>Completed levels</h2><div class="tbl"><table><thead><tr><th>Level</th><th>Role</th><th>Points</th><th>Video</th></tr></thead><tbody>${rows}</tbody></table></div></article>`;
}

function teamView() {
  return `<div class="team">${state.team.map(g => `<section class="panel"><h2>${esc(g.title)}</h2>${g.members.map(m => `<div class="member"><span>${esc(m)}</span><span class="muted">${esc(g.role)}</span></div>`).join('')}</section>`).join('')}</div>`;
}

function mark() {
  document.querySelectorAll('.entry').forEach(a => a.classList.toggle('sel', a.dataset.key === String(curKey)));
}

function pane(kind, key) {
  if (kind === 'demon' && !state.levels.length) { $('app').innerHTML = '<p class="empty">No levels yet. Add one to data/v2/levels.json.</p>'; current = null; return; }
  curKey = key ?? (kind === 'demon' ? state.levels[0].rank : ranking()[0]?.name);
  if (current !== kind || !$('entries')) {
    $('app').innerHTML = `<div class="split"><section class="panel list"><div class="search"><input id="q" type="search" aria-label="Search" placeholder="${kind === 'demon' ? 'Search levels, creators, IDs' : 'Search players'}" value="${esc(query)}"></div><div id="entries"></div></section><section id="detail"></section></div>`;
    $('q').oninput = e => { query = e.target.value; $('entries').innerHTML = entries(kind); mark(); };
    $('entries').innerHTML = entries(kind);
    current = kind;
  }
  mark();
  $('detail').innerHTML = kind === 'demon' ? demonDetail(curKey) : playerDetail(curKey);
}

function render() {
  const [view = 'demon', key] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === view));
  if (view === 'team') { current = null; $('app').innerHTML = teamView(); }
  else pane(view === 'players' ? 'players' : 'demon', key);
  if (matchMedia('(max-width:800px)').matches) window.scrollTo(0, 0);
}

async function init() {
  if (location.pathname === "/") {
    location.replace("/#/demon");
  }
  const root = document.documentElement;
  $('theme').onclick = () => {
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('theme', root.dataset.theme); } catch (e) {}
  };
  try {
    const [cfg, levels, team] = await Promise.all([load('config'), load('levels'), load('team')]);
    state.cfg = cfg;
    state.levels = levels.map((l, i) => ({ ...l, rank: i + 1 }));
    state.team = team;
  } catch (e) {
    $('app').innerHTML = `<p class="error">Failed to load data: ${esc(e.message)}</p>`;
    return;
  }
  document.title = state.cfg.title;
  $('brand').textContent = `${state.cfg.icon || ''} ${state.cfg.title}`.trim();
  $('tagline').textContent = state.cfg.subtitle || '';
  $('submit-link').href = state.cfg.submitUrl || '#';
  addEventListener('hashchange', render);
  render();

  document.addEventListener('click', async e => {
    const el = e.target.closest('.copy-id');
    if (!el) return;

    await navigator.clipboard.writeText(el.dataset.id);

    const label = el.closest('div').querySelector('.copy-label');
    label.textContent = 'Copied!';

    setTimeout(() => {
      label.textContent = 'Level ID';
    }, 1000);
  });
}
init();
