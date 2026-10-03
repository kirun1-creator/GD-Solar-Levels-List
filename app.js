// All content lives in data/*.json. This file only renders it.
const state = { cfg: {}, levels: [], team: [], tab: 'list' };
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const url = u => (/^https?:\/\//i.test(u || '') ? esc(u) : '');
const real = n => !!n && n.trim() !== '-';
const pts = rank => state.cfg.pointsBase - rank;
const watch = (link, cls) => (url(link) ? `<a href="${url(link)}" target="_blank" rel="noopener" class="${cls}">${cls === 'video-btn' ? 'Watch Video' : 'Watch'}</a>` : '');

async function load(name) {
  const r = await fetch(`data/${name}.json`, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`data/${name}.json: HTTP ${r.status}`);
  return r.json();
}

function ytId(link) {
  const m = (link || '').match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  return m ? m[1] : null;
}

// Everyone who completed a level, verifier first, '-' and duplicates skipped.
function completions(lvl) {
  const out = [];
  if (real(lvl.verifier)) out.push({ name: lvl.verifier, role: 'Verifier', link: lvl.video });
  for (const v of lvl.victors || [])
    if (real(v.name) && v.name !== lvl.verifier) out.push({ name: v.name, role: 'Victor', link: v.video });
  return out;
}

function renderList() {
  const q = $('search-bar').value.toLowerCase().trim();
  const hits = state.levels.filter(l => [l.name, l.creator, l.verifier, l.id].some(f => String(f).toLowerCase().includes(q)));
  $('list').innerHTML = hits.length ? '' : '<p class="empty">No levels match your search.</p>';
  hits.forEach(l => {
    const id = ytId(l.video);
    const thumb = id ? `<img src="https://img.youtube.com/vi/${id}/hqdefault.jpg" alt="" class="level-thumb">` : '<div class="level-thumb"></div>';
    const card = document.createElement('div');
    card.className = 'card';
    card.onclick = e => { if (!e.target.closest('a')) openModal(`#${l.rank} ${l.name}`, `ID: ${l.id} | ${pts(l.rank).toFixed(2)} pts`, 'Records / Victors:', levelRows(l)); };
    card.innerHTML = `<div class="card-rank">#${l.rank}</div>${thumb}
      <div class="card-info"><div class="card-title">${esc(l.name)}</div>
      <div class="card-subtitle">Created by <strong>${esc(l.creator)}</strong></div>
      <div class="card-detail">Verified by ${esc(l.verifier)} | <span class="points-badge">${pts(l.rank).toFixed(2)} pts</span></div>
      <div class="level-id-badge">ID: ${esc(l.id)} (Tap to view victors)</div></div>${watch(l.video, 'video-btn')}`;
    $('list').appendChild(card);
  });
}

function scores() {
  const s = {};
  state.levels.forEach(l => completions(l).forEach(c => { s[c.name] = (s[c.name] || 0) + pts(l.rank); }));
  return Object.entries(s).map(([name, points]) => ({ name, points })).sort((a, b) => b.points - a.points);
}

function renderLeaderboard() {
  const q = $('search-bar').value.toLowerCase().trim();
  const hits = scores().map((p, i) => ({ ...p, pos: i + 1 })).filter(p => p.name.toLowerCase().includes(q));
  $('leaderboard').innerHTML = hits.length ? '' : '<p class="empty">No players match your search.</p>';
  hits.forEach(p => {
    const card = document.createElement('div');
    card.className = 'card';
    card.onclick = () => openModal(p.name, `Total Score: ${p.points.toFixed(2)} pts`, 'Completed / Verified Levels:', profileRows(p.name));
    card.innerHTML = `<div class="card-rank">#${p.pos}</div><div class="card-info"><div class="card-title">${esc(p.name)}</div>
      <div class="card-detail"><span class="points-badge" style="margin-left:0">${p.points.toFixed(2)} total pts</span> (Tap to view levels)</div></div>`;
    $('leaderboard').appendChild(card);
  });
}

function renderTeam() {
  $('team').innerHTML = state.team.map(g => `<div class="team-section"><h2 class="team-subheading">${esc(g.title)}</h2>
    ${g.members.map(m => `<div class="team-card"><strong>${esc(m)}</strong><span>${esc(g.role)}</span></div>`).join('')}</div>`).join('');
}

const levelRows = l => completions(l).map(c => `<li class="modal-item"><div><b>${esc(c.name)}</b>${watch(c.link, 'small-yt-btn')}</div><span class="role">${c.role}</span></li>`).join('')
  || '<li class="modal-item">No victors recorded yet.</li>';

function profileRows(name) {
  return state.levels.flatMap(l => completions(l).filter(c => c.name === name).map(c => `<li class="modal-item"><div>
    <b>#${l.rank} ${esc(l.name)}</b>${watch(c.link, 'small-yt-btn')}
    <div style="font-size:.8rem;margin-top:2px">By ${esc(l.creator)} (${c.role})</div></div>
    <span class="role">${pts(l.rank).toFixed(2)} pts</span></li>`)).join('');
}

function openModal(title, stats, heading, rows) {
  $('modal-title').textContent = title;
  $('modal-stats').textContent = stats;
  $('modal-heading').textContent = heading;
  $('modal-list').innerHTML = rows;
  $('modal').style.display = 'flex';
}

function showTab(tab) {
  state.tab = tab;
  ['list', 'leaderboard', 'team'].forEach(t => { $(t).style.display = t === tab ? 'block' : 'none'; });
  document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $('search-box').style.display = tab === 'team' ? 'none' : 'block';
  $('search-bar').placeholder = tab === 'list' ? 'Search levels, creators, IDs...' : 'Search player names...';
  if (tab === 'list') renderList();
  if (tab === 'leaderboard') renderLeaderboard();
}

function search() {
  $('search-clear-btn').style.display = $('search-bar').value ? 'block' : 'none';
  showTab(state.tab);
}

async function init() {
  try {
    const [cfg, levels, team] = await Promise.all([load('config'), load('levels'), load('team')]);
    state.cfg = cfg;
    state.levels = levels.map((l, i) => ({ ...l, rank: i + 1 })); // rank = position in levels.json
    state.team = team;
  } catch (e) {
    $('list').innerHTML = `<p class="error">Failed to load data: ${esc(e.message)}</p>`;
    return;
  }
  document.title = state.cfg.title;
  $('site-title').textContent = `${state.cfg.icon || ''} ${state.cfg.title}`.trim();
  $('site-subtitle').textContent = state.cfg.subtitle || '';
  $('submit-link').href = state.cfg.submitUrl || '#';
  document.querySelectorAll('[data-tab]').forEach(b => { b.onclick = () => showTab(b.dataset.tab); });
  $('search-bar').oninput = search;
  $('search-clear-btn').onclick = () => { $('search-bar').value = ''; search(); $('search-bar').focus(); };
  $('modal-close').onclick = () => { $('modal').style.display = 'none'; };
  $('modal').onclick = e => { if (e.target === $('modal')) $('modal').style.display = 'none'; };
  renderTeam();
  showTab('list');
}
init();
